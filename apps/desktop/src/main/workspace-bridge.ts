import { isDeepStrictEqual } from "node:util";
import {
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  type WorkspaceCapability,
  type WorkspaceIntent,
  type WorkspaceIntentResult,
  WorkspaceIntentResultSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQuery,
  type WorkspaceQueryResult,
  WorkspaceQueryResultSchema,
  type WorkspaceScope,
} from "@slopstop/protocol";
import { Effect, Match, type Schema } from "effect";
import {
  answerRequest,
  bridgeNeutralText,
  type Clock,
  decodeReply,
  type HarnessRequestCore,
  makeHarnessRequestCore,
  type ProjectRequestFault,
} from "./harness-request-core.js";
import { harnessSendFailureMessage } from "./harness-send-failure.js";
import type { HarnessSessionClient } from "./harness-session.js";

type WorkspaceBridgeOptions = Readonly<{
  session: HarnessSessionClient;
  createId: () => string;
  now: () => string;
}>;

/** The capability an intent belongs to. */
export function capabilityForIntent(intent: WorkspaceIntent): WorkspaceCapability {
  switch (intent.intent) {
    case "conversation.message.submit":
    case "conversation.influence.select":
      return "conversation";
    case "frame-review.annotate":
    case "frame.decision.accept":
    case "frame.accept":
      return "frame";
    case "memory.proposal.review":
      return "memory";
  }
}

function brokenQuery(
  query: WorkspaceQuery,
  message: string,
  code:
    | "WORKSPACE_TRANSPORT_FAILED"
    | "WORKSPACE_PROJECTION_INVALID" = "WORKSPACE_TRANSPORT_FAILED",
): WorkspaceQueryResult {
  return decodeStrict(WorkspaceQueryResultSchema, {
    status: "broken",
    query,
    diagnostic: { code, message },
  });
}

function brokenIntent(capability: WorkspaceCapability, message: string): WorkspaceIntentResult {
  return decodeStrict(WorkspaceIntentResultSchema, {
    status: "broken",
    capability,
    diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message },
  });
}

function revisionKey(capability: WorkspaceCapability, scope: WorkspaceScope): string {
  return scope.kind === "project"
    ? `${capability}:project:${scope.projectId}`
    : `${capability}:waypoint:${scope.projectId}:${scope.waypointId}`;
}

function queryRevisionKey(query: WorkspaceQuery): string {
  switch (query.query) {
    case "conversation.read":
      return revisionKey("conversation", query.scope);
    case "context-record.read":
      return revisionKey("conversation", { kind: "project", projectId: query.projectId });
    case "frame-review.read":
      return revisionKey("frame", { kind: "project", projectId: query.projectId });
    case "memory-library.read":
      return revisionKey("memory", { kind: "project", projectId: query.projectId });
  }
}

export interface WorkspaceBridgeClient {
  query(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submit(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribe(listener: (notification: WorkspaceNotification) => void): () => void;
  stop(): void;
}

const closingDiagnostic = {
  code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
  message: "The workspace is unavailable while SlopStop closes.",
} as const;

/** The query answer while SlopStop closes (D11): at the IPC gate and for work in flight at stop. */
export function workspaceQueryClosing(query: WorkspaceQuery): WorkspaceQueryResult {
  return { status: "unavailable", query, diagnostic: closingDiagnostic };
}

/** The intent answer while SlopStop closes (D11). */
export function workspaceIntentClosing(capability: WorkspaceCapability): WorkspaceIntentResult {
  return { status: "unavailable", capability, diagnostic: closingDiagnostic };
}

const desktopText = {
  "invalid-command": harnessSendFailureMessage({
    ok: false,
    error: { code: "HARNESS_SESSION_MESSAGE_INVALID" },
  }),
  ...bridgeNeutralText.desktop,
  "mismatched-event": "Harness returned a mismatched workspace response.",
} as const;

const protocolText = {
  ...bridgeNeutralText.protocol,
  uncorrelated: "Harness returned an uncorrelated workspace response.",
  undecodable: "Harness returned an invalid workspace response.",
} as const;

/**
 * The fixed text a workspace request answers for each fault; `echo` names a mismatched echo. A
 * stopped request has no text: it answers the closing envelope.
 */
function faultText(fault: Exclude<ProjectRequestFault, { kind: "stopped" }>, echo: string): string {
  return Match.value(fault).pipe(
    Match.discriminatorsExhaustive("kind")({
      transport: () => bridgeNeutralText.transport,
      protocol: ({ reason }) => protocolText[reason],
      harness: ({ message }) => message,
      send: ({ code }) => harnessSendFailureMessage({ ok: false, error: { code } }),
      // The one owner of the stopped text, evaluated per answer (not a module-load static).
      unsent: () => "Workspace bridge is stopped.",
      desktop: ({ reason }) => (reason === "mismatched-echo" ? echo : desktopText[reason]),
    }),
  );
}

/**
 * The workspace bridge over a request core. Its notifications arrive through the core's observer
 * hook, so it opens no session subscription of its own. `afterStop` runs once, inside the
 * bridge's own stop: the standalone bridge ends its private core there.
 */
export function workspaceBridgeOver(
  core: HarnessRequestCore,
  clock: Clock,
  afterStop: () => void,
): WorkspaceBridgeClient {
  const notificationListeners = new Set<(notification: WorkspaceNotification) => void>();
  const projectionRevisions = new Map<string, number>();
  let stopped = false;
  const metadata = () => ({ messageId: clock.createId(), sentAt: clock.now() });

  const publishNotification = (message: HarnessMessage) => {
    if (message.event !== "workspace.projection.invalidated") return;
    // An undecodable notification throws, after the session delivered it to every listener.
    const parsed = decodeStrict(WorkspaceNotificationSchema, message.payload);
    const key = revisionKey(parsed.capability, parsed.scope);
    const previous = projectionRevisions.get(key);
    if (previous !== undefined && parsed.revision <= previous) return;
    projectionRevisions.set(key, parsed.revision);
    for (const listener of notificationListeners) listener(parsed);
  };
  const removeObserver = core.observe(publishNotification);

  /** A ready result older than the scope's floor is invalid; otherwise it raises the floor. */
  const acceptQueryResult = (result: WorkspaceQueryResult): WorkspaceQueryResult => {
    if (result.status !== "ready") return result;
    const key = queryRevisionKey(result.query);
    const previous = projectionRevisions.get(key);
    if (previous !== undefined && result.projection.revision < previous) {
      return brokenQuery(
        result.query,
        "Harness returned an older workspace projection.",
        "WORKSPACE_PROJECTION_INVALID",
      );
    }
    projectionRevisions.set(key, result.projection.revision);
    return result;
  };

  /** One workspace request: a stopped bridge answers `unsent`; a reply that fails `check` is a mismatched echo. */
  function request<Result>(
    operation: Readonly<{
      command: () => DesktopMessage;
      event: HarnessMessage["event"];
      schema: Schema.Decoder<Result>;
      check(result: Result): Result | undefined;
      broken(fault: ProjectRequestFault): Result;
    }>,
  ): Promise<Result> {
    if (stopped) return Promise.resolve(operation.broken({ kind: "unsent" }));
    return answerRequest(
      core.request("workspace", operation.command, operation.event).pipe(
        Effect.flatMap((value) => decodeReply(operation.schema, value)),
        Effect.flatMap((result) => {
          const accepted = operation.check(result);
          return accepted === undefined
            ? Effect.fail({ kind: "desktop", reason: "mismatched-echo" } as const)
            : Effect.succeed(accepted);
        }),
      ),
      operation.broken,
    );
  }

  return {
    query: (query) =>
      request({
        command: () => createWorkspaceQueryCommand(metadata(), query),
        event: "workspace.query.result",
        schema: WorkspaceQueryResultSchema,
        check: (result) =>
          isDeepStrictEqual(result.query, query) ? acceptQueryResult(result) : undefined,
        broken: (fault) =>
          fault.kind === "stopped"
            ? workspaceQueryClosing(query)
            : brokenQuery(
                query,
                faultText(fault, "Harness returned a mismatched workspace query."),
              ),
      }),
    submit: (intent) => {
      const capability = capabilityForIntent(intent);
      return request({
        command: () => createWorkspaceIntentCommand(metadata(), intent),
        event: "workspace.intent.result",
        schema: WorkspaceIntentResultSchema,
        check: (result) => (result.capability === capability ? result : undefined),
        broken: (fault) =>
          fault.kind === "stopped"
            ? workspaceIntentClosing(capability)
            : brokenIntent(
                capability,
                faultText(fault, "Harness returned a mismatched workspace capability."),
              ),
      });
    },
    subscribe: (listener) => {
      notificationListeners.add(listener);
      return () => {
        notificationListeners.delete(listener);
      };
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      // Settle first: an unsubscribe failure in `afterStop` surfaces only after.
      core.failBridge("workspace", { kind: "stopped" });
      removeObserver();
      notificationListeners.clear();
      afterStop();
    },
  };
}

/** A standalone workspace bridge, with its own core over `session`. */
export function createWorkspaceBridge(options: WorkspaceBridgeOptions): WorkspaceBridgeClient {
  const core = makeHarnessRequestCore(options.session);
  return workspaceBridgeOver(core, options, core.unsubscribe);
}
