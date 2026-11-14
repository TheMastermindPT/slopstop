import {
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  decodeStrict,
  type HarnessMessage,
  type WorkspaceCapability,
  type WorkspaceIntent,
  type WorkspaceIntentResult,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQuery,
  type WorkspaceQueryResult,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
  type WorkspaceScope,
} from "@slopstop/protocol";
import {
  type BridgeOperation,
  bridgeFaultText,
  bridgeRequest,
  type Clock,
  type HarnessRequestCore,
  type ProjectRequestFault,
} from "./harness-request-core.js";

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

/**
 * The workspace bridge over a request core. Its notifications arrive through the core's observer
 * hook, so it opens no session subscription of its own.
 */
export function workspaceBridgeOver(core: HarnessRequestCore, clock: Clock): WorkspaceBridgeClient {
  const notificationListeners = new Set<(notification: WorkspaceNotification) => void>();
  const projectionRevisions = new Map<string, number>();
  let stopped = false;
  const bridge = { tag: "workspace", isStopped: () => stopped } as const;
  const metadata = () => ({ messageId: clock.createId(), sentAt: clock.now() });
  // The one owner of the workspace fault words, built per answer (not a module-load static).
  const workspaceFaultText = (fault: ProjectRequestFault, echo: string) =>
    bridgeFaultText(fault, { noun: "workspace", stopped: "Workspace bridge is stopped.", echo });

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

  const query: BridgeOperation<WorkspaceQuery, WorkspaceQueryResult> = {
    requestSchema: WorkspaceQuerySchema,
    command: (request) => createWorkspaceQueryCommand(metadata(), request),
    event: "workspace.query.result",
    resultSchema: WorkspaceQueryResultSchema,
    echo: { reply: (result) => result.query },
    accept: acceptQueryResult,
    broken: (request, fault) =>
      fault.kind === "stopped"
        ? workspaceQueryClosing(request)
        : brokenQuery(
            request,
            workspaceFaultText(fault, "Harness returned a mismatched workspace query."),
          ),
  };
  const submit: BridgeOperation<WorkspaceIntent, WorkspaceIntentResult> = {
    requestSchema: WorkspaceIntentSchema,
    command: (request) => createWorkspaceIntentCommand(metadata(), request),
    event: "workspace.intent.result",
    resultSchema: WorkspaceIntentResultSchema,
    echo: {
      reply: (result) => result.capability,
      sent: (command) =>
        command.command === "workspace.intent" ? capabilityForIntent(command.payload) : undefined,
    },
    broken: (request, fault) => {
      const capability = capabilityForIntent(request);
      return fault.kind === "stopped"
        ? workspaceIntentClosing(capability)
        : brokenIntent(
            capability,
            workspaceFaultText(fault, "Harness returned a mismatched workspace capability."),
          );
    },
  };

  return {
    query: (request) => bridgeRequest(core, bridge, query, request),
    submit: (intent) => bridgeRequest(core, bridge, submit, intent),
    subscribe: (listener) => {
      notificationListeners.add(listener);
      return () => {
        notificationListeners.delete(listener);
      };
    },
    stop: () => {
      stopped = true;
      core.failBridge("workspace", { kind: "stopped" });
      removeObserver();
      notificationListeners.clear();
    },
  };
}
