import { isDeepStrictEqual } from "node:util";
import {
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  type DesktopMessage,
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
import { dispatchPendingHarnessEvent, requestHarness } from "./harness-pending-request.js";
import { harnessSendFailureMessage } from "./harness-send-failure.js";
import type { HarnessSessionClient, HarnessSessionEvent } from "./harness-session.js";

type PendingQuery = Readonly<{
  kind: "query";
  query: WorkspaceQuery;
  resolve: (result: WorkspaceQueryResult) => void;
}>;

type PendingIntent = Readonly<{
  kind: "intent";
  capability: WorkspaceCapability;
  resolve: (result: WorkspaceIntentResult) => void;
}>;

type PendingRequest = PendingQuery | PendingIntent;

type WorkspaceBridgeOptions = Readonly<{
  session: HarnessSessionClient;
  createId: () => string;
  now: () => string;
}>;

function capabilityForIntent(intent: WorkspaceIntent): WorkspaceCapability {
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
  return WorkspaceQueryResultSchema.parse({
    status: "broken",
    query,
    diagnostic: { code, message },
  });
}

function brokenIntent(capability: WorkspaceCapability, message: string): WorkspaceIntentResult {
  return WorkspaceIntentResultSchema.parse({
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

class WorkspaceBridge implements WorkspaceBridgeClient {
  readonly #createId: () => string;
  readonly #now: () => string;
  readonly #notificationListeners = new Set<(notification: WorkspaceNotification) => void>();
  readonly #projectionRevisions = new Map<string, number>();
  readonly #pending = new Map<string, PendingRequest>();
  readonly #session: HarnessSessionClient;
  readonly #stopSessionSubscription: () => void;
  #stopped = false;

  constructor(options: WorkspaceBridgeOptions) {
    this.#createId = options.createId;
    this.#now = options.now;
    this.#session = options.session;
    this.#stopSessionSubscription = this.#session.subscribe((event) => {
      dispatchPendingHarnessEvent(event, {
        failAll: (message) => this.#failAllPending(message),
        failRequest: (causationId, message) => this.#failRequest(causationId, message),
        message: (message) => this.#handleHarnessMessage(message),
      });
    });
  }

  query(query: WorkspaceQuery): Promise<WorkspaceQueryResult> {
    return this.#request(
      () =>
        createWorkspaceQueryCommand({ messageId: this.#createId(), sentAt: this.#now() }, query),
      (resolve) => ({ kind: "query", query, resolve }),
      (message) => brokenQuery(query, message),
    );
  }

  submit(intent: WorkspaceIntent): Promise<WorkspaceIntentResult> {
    const capability = capabilityForIntent(intent);
    return this.#request(
      () =>
        createWorkspaceIntentCommand({ messageId: this.#createId(), sentAt: this.#now() }, intent),
      (resolve) => ({ kind: "intent", capability, resolve }),
      (message) => brokenIntent(capability, message),
    );
  }

  #request<Result>(
    createCommand: () => DesktopMessage,
    createPending: (resolve: (result: Result) => void) => PendingRequest,
    broken: (message: string) => Result,
  ): Promise<Result> {
    if (this.#stopped) {
      return Promise.resolve(broken("Workspace bridge is stopped."));
    }

    return requestHarness({
      pending: this.#pending,
      createCommand,
      createPending,
      broken,
      send: (command, resolve) => {
        const sent = this.#session.send(command);
        if (!sent.ok) {
          this.#pending.delete(command.messageId);
          resolve(broken(harnessSendFailureMessage(sent)));
        }
      },
    });
  }

  subscribe(listener: (notification: WorkspaceNotification) => void): () => void {
    this.#notificationListeners.add(listener);
    return () => {
      this.#notificationListeners.delete(listener);
    };
  }

  stop(): void {
    if (this.#stopped) {
      return;
    }
    this.#stopped = true;
    this.#stopSessionSubscription();
    this.#failAllPending("Workspace bridge is stopped.");
    this.#notificationListeners.clear();
  }

  #failAllPending(message: string): void {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const request of pending) {
      if (request.kind === "query") {
        request.resolve(brokenQuery(request.query, message));
      } else {
        request.resolve(brokenIntent(request.capability, message));
      }
    }
  }

  #failRequest(causationId: string, message: string): void {
    const request = this.#pending.get(causationId);
    if (request === undefined) return;
    this.#pending.delete(causationId);
    this.#failPending(request, message);
  }

  #failPending(request: PendingRequest, message: string): void {
    if (request.kind === "query") {
      request.resolve(brokenQuery(request.query, message));
    } else {
      request.resolve(brokenIntent(request.capability, message));
    }
  }

  #handleHarnessMessage(
    message: Extract<HarnessSessionEvent, { type: "message" }>["message"],
  ): void {
    switch (message.event) {
      case "request.failure":
        return;
      case "system.failure":
        this.#failAllPending(message.payload.message);
        return;
      case "system.ready":
        return;
      case "workspace.projection.invalidated":
        this.#publishNotification(message.payload);
        return;
      case "workspace.query.result":
        this.#settleQuery(message.causationId, message.payload);
        return;
      case "workspace.intent.result":
        this.#settleIntent(message.causationId, message.payload);
    }
  }

  #publishNotification(notification: WorkspaceNotification): void {
    const parsed = WorkspaceNotificationSchema.parse(notification);
    const key = revisionKey(parsed.capability, parsed.scope);
    const previous = this.#projectionRevisions.get(key);
    if (previous !== undefined && parsed.revision <= previous) {
      return;
    }
    this.#projectionRevisions.set(key, parsed.revision);
    for (const listener of this.#notificationListeners) {
      listener(parsed);
    }
  }

  #settleQuery(causationId: string | null, result: WorkspaceQueryResult): void {
    const request = this.#takePending(causationId, "query");
    if (request?.kind !== "query") {
      return;
    }
    const parsed = WorkspaceQueryResultSchema.parse(result);
    if (!isDeepStrictEqual(parsed.query, request.query)) {
      request.resolve(brokenQuery(request.query, "Harness returned a mismatched workspace query."));
      return;
    }
    if (parsed.status === "ready") {
      const key = queryRevisionKey(parsed.query);
      const previous = this.#projectionRevisions.get(key);
      if (previous !== undefined && parsed.projection.revision < previous) {
        request.resolve(
          brokenQuery(
            request.query,
            "Harness returned an older workspace projection.",
            "WORKSPACE_PROJECTION_INVALID",
          ),
        );
        return;
      }
      this.#projectionRevisions.set(key, parsed.projection.revision);
    }
    request.resolve(parsed);
  }

  #settleIntent(causationId: string | null, result: WorkspaceIntentResult): void {
    const request = this.#takePending(causationId, "intent");
    if (request?.kind !== "intent") {
      return;
    }
    const parsed = WorkspaceIntentResultSchema.parse(result);
    if (parsed.capability !== request.capability) {
      request.resolve(
        brokenIntent(request.capability, "Harness returned a mismatched workspace capability."),
      );
      return;
    }
    request.resolve(parsed);
  }

  #takePending(
    causationId: string | null,
    expectedKind: PendingRequest["kind"],
  ): PendingRequest | undefined {
    if (causationId === null) {
      this.#failAllPending("Harness returned an uncorrelated workspace response.");
      return undefined;
    }
    const request = this.#pending.get(causationId);
    if (request === undefined) {
      return undefined;
    }
    this.#pending.delete(causationId);
    if (request.kind !== expectedKind) {
      this.#failPending(request, "Harness returned a mismatched workspace response.");
      return undefined;
    }
    return request;
  }
}

export function createWorkspaceBridge(options: WorkspaceBridgeOptions): WorkspaceBridgeClient {
  return new WorkspaceBridge(options);
}
