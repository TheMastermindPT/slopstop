import {
  createReadyEvent,
  createRequestFailureEvent,
  createSystemFailureEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type DesktopMessage,
  DesktopMessageSchema,
  decodeStrict,
  MessageIdSchema,
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
} from "@slopstop/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import type {
  HarnessSessionClient,
  HarnessSessionEvent,
  HarnessSessionSendResult,
} from "./harness-session.js";
import { broadcastWorkspaceNotification, registerWorkspaceIpc } from "./main.js";
import { createWorkspaceBridge, type WorkspaceBridgeClient } from "./workspace-bridge.js";

const mainMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  handle: vi.fn(),
  on: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    exit: vi.fn(),
    isPackaged: false,
    on: mainMocks.on,
    quit: vi.fn(),
    whenReady: () => new Promise<void>(() => undefined),
  },
  BrowserWindow: { getAllWindows: mainMocks.getAllWindows },
  ipcMain: { handle: mainMocks.handle },
}));
vi.mock("./crash-reporting.js", () => ({ initializeCrashReporting: vi.fn() }));
vi.mock("./harness-supervisor.js", () => ({
  HarnessSupervisor: vi.fn(),
  harnessEntryPath: vi.fn(),
}));
vi.mock("./logger.js", () => ({ createMainLogger: vi.fn() }));
vi.mock("./security.js", () => ({ configureSessionSecurity: vi.fn(), lockNavigation: vi.fn() }));

class FakeSession implements HarnessSessionClient {
  readonly sent: DesktopMessage[] = [];
  readonly #listeners = new Set<(event: HarnessSessionEvent) => void>();
  sendResult: HarnessSessionSendResult = { ok: true };
  unsubscribeCalls = 0;

  get listenerCount(): number {
    return this.#listeners.size;
  }

  emit(event: HarnessSessionEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  send(message: unknown): HarnessSessionSendResult {
    if (this.sendResult.ok) {
      this.sent.push(decodeStrict(DesktopMessageSchema, message));
    }
    return this.sendResult;
  }

  subscribe(listener: (event: HarnessSessionEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.unsubscribeCalls += 1;
      this.#listeners.delete(listener);
    };
  }
}

function id(value: number): string {
  return decodeStrict(
    MessageIdSchema,
    `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  );
}

function memoryQuery(project = 10): WorkspaceQuery {
  return decodeStrict(WorkspaceQuerySchema, {
    query: "memory-library.read",
    projectId: id(project),
    cursor: null,
  });
}

function conversationWaypointQuery(): WorkspaceQuery {
  return decodeStrict(WorkspaceQuerySchema, {
    query: "conversation.read",
    scope: { kind: "waypoint", projectId: id(10), waypointId: id(40) },
    cursor: null,
  });
}

function conversationProjectQuery(project = 10): WorkspaceQuery {
  return decodeStrict(WorkspaceQuerySchema, {
    query: "conversation.read",
    scope: { kind: "project", projectId: id(project) },
    cursor: null,
  });
}

function contextRecordQuery(project = 10): WorkspaceQuery {
  return decodeStrict(WorkspaceQuerySchema, {
    query: "context-record.read",
    projectId: id(project),
    contextRecordId: id(60),
  });
}

function frameQuery(project = 10): WorkspaceQuery {
  return decodeStrict(WorkspaceQuerySchema, {
    query: "frame-review.read",
    projectId: id(project),
  });
}

function conversationIntent(): WorkspaceIntent {
  return decodeStrict(WorkspaceIntentSchema, {
    intent: "conversation.message.submit",
    scope: { kind: "project", projectId: id(10) },
    branchId: id(20),
    text: "Keep the boundary narrow.",
    contextProposalId: id(21),
    expectedProjectionRevision: 0,
  });
}

function memoryIntent(): WorkspaceIntent {
  return decodeStrict(WorkspaceIntentSchema, {
    intent: "memory.proposal.review",
    projectId: id(10),
    proposalId: id(30),
    decision: "accept",
    expectedProjectionRevision: 0,
  });
}

function workspaceIntents(): readonly WorkspaceIntent[] {
  return [
    conversationIntent(),
    decodeStrict(WorkspaceIntentSchema, {
      intent: "conversation.influence.select",
      projectId: id(10),
      frameDraftId: id(22),
      includedMessageIds: [id(23)],
      excludedMessageIds: [id(24)],
      expectedProjectionRevision: 0,
    }),
    decodeStrict(WorkspaceIntentSchema, {
      intent: "frame-review.annotate",
      projectId: id(10),
      frameDraftId: id(22),
      sectionId: id(25),
      selectedText: "selected",
      comment: "Clarify this.",
      expectedProjectionRevision: 0,
    }),
    decodeStrict(WorkspaceIntentSchema, {
      intent: "frame.decision.accept",
      projectId: id(10),
      frameDraftId: id(22),
      sectionId: id(25),
      expectedProjectionRevision: 0,
    }),
    decodeStrict(WorkspaceIntentSchema, {
      intent: "frame.accept",
      projectId: id(10),
      frameDraftId: id(22),
      expectedProjectionRevision: 0,
    }),
    memoryIntent(),
  ];
}

function unavailableQueryResult(query: WorkspaceQuery) {
  return decodeStrict(WorkspaceQueryResultSchema, {
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  });
}

function readyResult(query: WorkspaceQuery, revision: number): WorkspaceQueryResult {
  switch (query.query) {
    case "memory-library.read":
      return decodeStrict(WorkspaceQueryResultSchema, {
        status: "ready",
        query,
        projection: {
          projection: "memory-library",
          revision,
          projectId: query.projectId,
          items: [],
          nextCursor: null,
        },
      });
    case "conversation.read":
      return decodeStrict(WorkspaceQueryResultSchema, {
        status: "ready",
        query,
        projection: {
          projection: "conversation",
          revision,
          scope: query.scope,
          conversationId: id(50),
          branches: [],
          messages: { items: [], nextCursor: null },
          contextProposal: null,
        },
      });
    case "context-record.read":
      return decodeStrict(WorkspaceQueryResultSchema, {
        status: "ready",
        query,
        projection: {
          projection: "context-record",
          revision,
          projectId: query.projectId,
          id: query.contextRecordId,
          responseMessageId: id(61),
          included: [],
          excluded: [],
          completeness: "complete",
          technicalDetails: null,
        },
      });
    case "frame-review.read":
      return decodeStrict(WorkspaceQueryResultSchema, {
        status: "ready",
        query,
        projection: {
          projection: "frame-review",
          revision,
          projectId: query.projectId,
          draftId: id(62),
          sections: [],
          annotations: [],
          decisions: [],
        },
      });
  }
}

function emitResult(
  session: FakeSession,
  causationId: string | null,
  result: WorkspaceQueryResult | WorkspaceIntentResult,
): void {
  const metadata = {
    messageId: id(900),
    sentAt: "2026-08-14T12:00:01.000Z",
    sequence: 1,
    causationId,
  };
  const message =
    "query" in result
      ? createWorkspaceQueryResultEvent(metadata, result)
      : createWorkspaceIntentResultEvent(metadata, result);
  session.emit({
    type: "message",
    message,
  });
}

const readyMemoryResult = readyResult;
const readyConversationResult = readyResult;
const readyContextRecordResult = readyResult;
const readyFrameResult = readyResult;
const emitQueryResult = emitResult;
const emitIntentResult = emitResult;

function bridgeWith(
  session: FakeSession,
  ids: readonly string[] = [id(1), id(2), id(3), id(4)],
): WorkspaceBridgeClient {
  let index = 0;
  return createWorkspaceBridge({
    session,
    createId: () => ids[index++] ?? id(999),
    now: () => "2026-08-14T12:00:00.000Z",
  });
}

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  mainMocks.getAllWindows.mockReset();
  mainMocks.handle.mockReset();
});

describe("WorkspaceBridge", () => {
  it("request failure settles only its correlated Workspace request", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session, [
      "00000000-0000-4000-8000-000000000401",
      "00000000-0000-4000-8000-000000000402",
    ]);
    let queryResult: WorkspaceQueryResult | "pending" = "pending";
    void bridge.query(memoryQuery()).then((result) => {
      queryResult = result;
    });
    let intentSettled = false;
    const intent = bridge.submit(memoryIntent()).then((result) => {
      intentSettled = true;
      return result;
    });
    try {
      session.emit({
        type: "message",
        message: createRequestFailureEvent(
          {
            messageId: id(901),
            sentAt: "2026-08-14T12:00:01.000Z",
            sequence: 1,
            causationId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000401"),
          },
          {
            code: "HARNESS_INTERNAL_FAILURE",
            message: "Harness failed while handling a message.",
            retryable: false,
          },
        ),
      });
      await Promise.resolve();
      expect(queryResult).toEqual({
        status: "broken",
        query: {
          query: "memory-library.read",
          projectId: "00000000-0000-4000-8000-000000000010",
          cursor: null,
        },
        diagnostic: {
          code: "WORKSPACE_TRANSPORT_FAILED",
          message: "Harness failed while handling a message.",
        },
      });
      expect(intentSettled).toBe(false);
      emitIntentResult(
        session,
        "00000000-0000-4000-8000-000000000402",
        decodeStrict(WorkspaceIntentResultSchema, { status: "forwarded", capability: "memory" }),
      );
      await expect(intent).resolves.toEqual({ status: "forwarded", capability: "memory" });
    } finally {
      bridge.stop();
    }
  });

  it("correlates out-of-order workspace responses", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    const query1 = memoryQuery(10);
    const query2 = memoryQuery(11);
    const pending1 = bridge.query(query1);
    const pending2 = bridge.query(query2);

    expect(session.sent).toHaveLength(2);
    emitQueryResult(session, id(2), unavailableQueryResult(query2));
    await expect(pending2).resolves.toEqual(unavailableQueryResult(query2));
    emitQueryResult(session, id(1), unavailableQueryResult(query1));
    await expect(pending1).resolves.toEqual(unavailableQueryResult(query1));
  });

  it("maps every matching intent result to its exact capability", async () => {
    const cases = [
      [workspaceIntents()[0], "conversation"],
      [workspaceIntents()[1], "conversation"],
      [workspaceIntents()[2], "frame"],
      [workspaceIntents()[3], "frame"],
      [workspaceIntents()[4], "frame"],
      [workspaceIntents()[5], "memory"],
    ] as const;

    for (const [intent, capability] of cases) {
      if (intent === undefined) {
        throw new Error("Intent fixture is missing.");
      }
      const session = new FakeSession();
      const bridge = bridgeWith(session, [id(1)]);
      const pending = bridge.submit(intent);
      const result = decodeStrict(WorkspaceIntentResultSchema, { status: "forwarded", capability });

      emitIntentResult(session, id(1), result);

      await expect(pending).resolves.toEqual(result);
    }
  });

  it("releases request identities after failure and settlement", async () => {
    const failedSession = new FakeSession();
    failedSession.sendResult = {
      ok: false,
      error: { code: "HARNESS_SESSION_SEND_FAILED" },
    };
    const failedBridge = bridgeWith(failedSession, [id(1), id(1)]);
    await expect(failedBridge.query(memoryQuery(10))).resolves.toMatchObject({
      status: "broken",
    });
    failedSession.sendResult = { ok: true };
    const retry = failedBridge.query(memoryQuery(11));
    expect(failedSession.sent).toHaveLength(1);
    emitQueryResult(failedSession, id(1), unavailableQueryResult(memoryQuery(11)));
    await expect(retry).resolves.toEqual(unavailableQueryResult(memoryQuery(11)));

    const settledSession = new FakeSession();
    const settledBridge = bridgeWith(settledSession, [id(1), id(1)]);
    const first = settledBridge.query(memoryQuery(10));
    emitQueryResult(settledSession, id(1), unavailableQueryResult(memoryQuery(10)));
    await expect(first).resolves.toEqual(unavailableQueryResult(memoryQuery(10)));
    const second = settledBridge.query(memoryQuery(11));
    expect(settledSession.sent).toHaveLength(2);
    emitQueryResult(settledSession, id(1), unavailableQueryResult(memoryQuery(11)));
    await expect(second).resolves.toEqual(unavailableQueryResult(memoryQuery(11)));

    const failedIntentSession = new FakeSession();
    failedIntentSession.sendResult = {
      ok: false,
      error: { code: "HARNESS_SESSION_SEND_FAILED" },
    };
    const failedIntentBridge = bridgeWith(failedIntentSession, [id(1), id(1)]);
    await expect(failedIntentBridge.submit(memoryIntent())).resolves.toMatchObject({
      status: "broken",
    });
    failedIntentSession.sendResult = { ok: true };
    const intentRetry = failedIntentBridge.submit(memoryIntent());
    expect(failedIntentSession.sent).toHaveLength(1);
    const forwarded = decodeStrict(WorkspaceIntentResultSchema, {
      status: "forwarded",
      capability: "memory",
    });
    emitIntentResult(failedIntentSession, id(1), forwarded);
    await expect(intentRetry).resolves.toEqual(forwarded);
  });

  it("rejects a colliding intent without replacing the original", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session, [id(1), id(1)]);
    const first = bridge.submit(memoryIntent());
    const second = bridge.submit(memoryIntent());

    await expect(second).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Harness request identity collided." },
    });
    expect(session.sent).toHaveLength(1);
    const forwarded = decodeStrict(WorkspaceIntentResultSchema, {
      status: "forwarded",
      capability: "memory",
    });
    emitIntentResult(session, id(1), forwarded);
    await expect(first).resolves.toEqual(forwarded);
  });

  it("clears failed pending identities before later requests", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session, [id(1), id(1)]);
    const first = bridge.query(memoryQuery(10));
    session.emit({ type: "disconnected" });
    await expect(first).resolves.toMatchObject({ status: "broken" });

    const second = bridge.query(memoryQuery(11));
    expect(session.sent).toHaveLength(2);
    emitQueryResult(session, id(1), unavailableQueryResult(memoryQuery(11)));
    await expect(second).resolves.toEqual(unavailableQueryResult(memoryQuery(11)));
  });

  it("stops once and rejects later requests without observing the session", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    const received: WorkspaceNotification[] = [];
    bridge.subscribe((notification) => received.push(notification));
    expect(session.listenerCount).toBe(1);

    bridge.stop();
    bridge.stop();

    expect(session.listenerCount).toBe(0);
    expect(session.unsubscribeCalls).toBe(1);
    await expect(bridge.query(memoryQuery())).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Workspace bridge is stopped." },
    });
    await expect(bridge.submit(memoryIntent())).resolves.toMatchObject({
      status: "broken",
      capability: "memory",
      diagnostic: { message: "Workspace bridge is stopped." },
    });
    expect(session.sent).toEqual([]);
    expect(received).toEqual([]);
  });

  it("rejects invalid locally generated command metadata before send", async () => {
    const querySession = new FakeSession();
    const queryBridge = bridgeWith(querySession, ["not-a-message-id"]);
    await expect(queryBridge.query(memoryQuery())).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Desktop created an invalid harness message." },
    });
    expect(querySession.sent).toEqual([]);

    const intentSession = new FakeSession();
    const intentBridge = bridgeWith(intentSession, ["not-a-message-id"]);
    await expect(intentBridge.submit(memoryIntent())).resolves.toMatchObject({
      status: "broken",
      capability: "memory",
      diagnostic: { message: "Desktop created an invalid harness message." },
    });
    expect(intentSession.sent).toEqual([]);
  });

  it("ignores system readiness while a workspace request is pending", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    let settled = false;
    const query = memoryQuery();
    const pending = bridge.query(query).then((result) => {
      settled = true;
      return result;
    });

    session.emit({
      type: "message",
      message: createReadyEvent(
        {
          messageId: id(905),
          sentAt: "2026-08-14T12:00:01.000Z",
          sequence: 1,
          causationId: null,
        },
        "0.0.0",
      ),
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    emitQueryResult(session, id(1), unavailableQueryResult(query));
    await expect(pending).resolves.toEqual(unavailableQueryResult(query));
  });

  it.each([
    ["HARNESS_SESSION_UNAVAILABLE", "Harness session is unavailable."],
    ["HARNESS_SESSION_MESSAGE_INVALID", "Desktop created an invalid harness message."],
    ["HARNESS_SESSION_SEND_FAILED", "Harness session send failed."],
  ] as const)("maps %s without blaming producers", async (code, message) => {
    const session = new FakeSession();
    session.sendResult = { ok: false, error: { code } };
    const bridge = bridgeWith(session);
    const query = memoryQuery();

    await expect(bridge.query(query)).resolves.toEqual({
      status: "broken",
      query,
      diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message },
    });
    await expect(bridge.submit(memoryIntent())).resolves.toEqual({
      status: "broken",
      capability: "memory",
      diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message },
    });
  });

  it.each([
    ["disconnect", "Harness session disconnected."],
    ["protocol", "Harness session received an invalid protocol message."],
    ["failure", "Harness failed pending work."],
    ["stop", "Workspace bridge is stopped."],
  ] as const)("fails all pending work on %s", async (failure, message) => {
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    const pending = [
      bridge.query(memoryQuery(10)),
      bridge.query(memoryQuery(11)),
      bridge.submit(memoryIntent()),
    ];
    const resolutions = [0, 0, 0];
    pending.forEach((request, index) => {
      void request.then(() => {
        resolutions[index] = (resolutions[index] ?? 0) + 1;
      });
    });

    if (failure === "disconnect") {
      session.emit({ type: "disconnected" });
    } else if (failure === "protocol") {
      session.emit({ type: "protocol-error" });
    } else if (failure === "failure") {
      session.emit({
        type: "message",
        message: createSystemFailureEvent(
          {
            messageId: id(902),
            sentAt: "2026-08-14T12:00:01.000Z",
            sequence: 1,
            causationId: null,
          },
          { code: "HARNESS_INTERNAL_FAILURE", message, retryable: false },
        ),
      });
    } else {
      bridge.stop();
    }

    const results = await Promise.all(pending);
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toMatchObject({
        status: "broken",
        diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message },
      });
    }
    bridge.stop();
    emitQueryResult(session, id(1), unavailableQueryResult(memoryQuery(10)));
    await Promise.resolve();
    expect(resolutions).toEqual([1, 1, 1]);
  });

  it("rejects invalid response correlation", async () => {
    const nullSession = new FakeSession();
    const nullBridge = bridgeWith(nullSession);
    const nullPending = [nullBridge.query(memoryQuery(10)), nullBridge.query(memoryQuery(11))];
    emitQueryResult(nullSession, null, unavailableQueryResult(memoryQuery(10)));
    for (const result of await Promise.all(nullPending)) {
      expect(result).toMatchObject({
        status: "broken",
        diagnostic: { message: "Harness returned an uncorrelated workspace response." },
      });
    }

    const kindSession = new FakeSession();
    const kindBridge = bridgeWith(kindSession);
    const kindPending = kindBridge.query(memoryQuery(10));
    emitIntentResult(
      kindSession,
      id(1),
      decodeStrict(WorkspaceIntentResultSchema, { status: "forwarded", capability: "memory" }),
    );
    await expect(kindPending).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Harness returned a mismatched workspace response." },
    });

    const reverseKindSession = new FakeSession();
    const reverseKindBridge = bridgeWith(reverseKindSession);
    const reverseKindPending = reverseKindBridge.submit(memoryIntent());
    emitQueryResult(reverseKindSession, id(1), unavailableQueryResult(memoryQuery(10)));
    await expect(reverseKindPending).resolves.toMatchObject({
      status: "broken",
      capability: "memory",
      diagnostic: { message: "Harness returned a mismatched workspace response." },
    });

    const querySession = new FakeSession();
    const queryBridge = bridgeWith(querySession);
    const queryPending = queryBridge.query(memoryQuery(10));
    emitQueryResult(querySession, id(1), unavailableQueryResult(memoryQuery(11)));
    await expect(queryPending).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Harness returned a mismatched workspace query." },
    });

    const capabilitySession = new FakeSession();
    const capabilityBridge = bridgeWith(capabilitySession);
    const capabilityPending = capabilityBridge.submit(conversationIntent());
    emitIntentResult(
      capabilitySession,
      id(1),
      decodeStrict(WorkspaceIntentResultSchema, { status: "forwarded", capability: "memory" }),
    );
    await expect(capabilityPending).resolves.toMatchObject({
      status: "broken",
      capability: "conversation",
      diagnostic: { message: "Harness returned a mismatched workspace capability." },
    });

    const unknownSession = new FakeSession();
    const unknownBridge = bridgeWith(unknownSession);
    let settled = false;
    const unknownPending = unknownBridge.query(memoryQuery(10)).then((result) => {
      settled = true;
      return result;
    });
    emitQueryResult(unknownSession, id(99), unavailableQueryResult(memoryQuery(10)));
    await Promise.resolve();
    expect(settled).toBe(false);
    unknownSession.emit({ type: "disconnected" });
    await expect(unknownPending).resolves.toMatchObject({ status: "broken" });
  });

  it("rejects a colliding pending request identity", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session, [id(1), id(1)]);
    const query1 = memoryQuery(10);
    const query2 = memoryQuery(11);
    const pending1 = bridge.query(query1);
    const pending2 = bridge.query(query2);

    await expect(pending2).resolves.toEqual({
      status: "broken",
      query: query2,
      diagnostic: {
        code: "WORKSPACE_TRANSPORT_FAILED",
        message: "Harness request identity collided.",
      },
    });
    expect(session.sent).toHaveLength(1);
    emitQueryResult(session, id(1), unavailableQueryResult(query1));
    await expect(pending1).resolves.toEqual(unavailableQueryResult(query1));
  });

  it("publishes only increasing projection revisions per scope", () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    const received: WorkspaceNotification[] = [];
    const unsubscribe = bridge.subscribe((notification) => received.push(notification));
    const projectScope = { kind: "project" as const, projectId: id(10) };
    const waypointScope = {
      kind: "waypoint" as const,
      projectId: id(10),
      waypointId: id(40),
    };
    const otherWaypointScope = { ...waypointScope, waypointId: id(41) };

    const publish = (notification: WorkspaceNotification) => {
      session.emit({
        type: "message",
        message: createWorkspaceProjectionInvalidatedEvent(
          {
            messageId: id(903),
            sentAt: "2026-08-14T12:00:01.000Z",
            sequence: 1,
            causationId: null,
          },
          notification,
        ),
      });
    };
    for (const revision of [4, 3, 4, 5]) {
      publish(
        decodeStrict(WorkspaceNotificationSchema, {
          capability: "conversation",
          scope: projectScope,
          revision,
        }),
      );
    }
    publish(
      decodeStrict(WorkspaceNotificationSchema, {
        capability: "conversation",
        scope: waypointScope,
        revision: 1,
      }),
    );
    publish(
      decodeStrict(WorkspaceNotificationSchema, {
        capability: "conversation",
        scope: otherWaypointScope,
        revision: 1,
      }),
    );
    publish(
      decodeStrict(WorkspaceNotificationSchema, {
        capability: "memory",
        scope: projectScope,
        revision: 1,
      }),
    );

    expect(
      received.map(({ capability, scope, revision }) => ({ capability, scope, revision })),
    ).toEqual([
      { capability: "conversation", scope: projectScope, revision: 4 },
      { capability: "conversation", scope: projectScope, revision: 5 },
      { capability: "conversation", scope: waypointScope, revision: 1 },
      { capability: "conversation", scope: otherWaypointScope, revision: 1 },
      { capability: "memory", scope: projectScope, revision: 1 },
    ]);
    unsubscribe();
    publish(
      decodeStrict(WorkspaceNotificationSchema, {
        capability: "memory",
        scope: projectScope,
        revision: 2,
      }),
    );
    expect(received).toHaveLength(5);
  });

  it("rejects stale ready query projections", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    const query = memoryQuery();
    session.emit({
      type: "message",
      message: createWorkspaceProjectionInvalidatedEvent(
        {
          messageId: id(904),
          sentAt: "2026-08-14T12:00:01.000Z",
          sequence: 1,
          causationId: null,
        },
        decodeStrict(WorkspaceNotificationSchema, {
          capability: "memory",
          scope: { kind: "project", projectId: id(10) },
          revision: 5,
        }),
      ),
    });

    const stale = bridge.query(query);
    emitQueryResult(session, id(1), readyMemoryResult(query, 4));
    await expect(stale).resolves.toEqual({
      status: "broken",
      query,
      diagnostic: {
        code: "WORKSPACE_PROJECTION_INVALID",
        message: "Harness returned an older workspace projection.",
      },
    });

    const equal = bridge.query(query);
    emitQueryResult(session, id(2), readyMemoryResult(query, 5));
    await expect(equal).resolves.toEqual(readyMemoryResult(query, 5));
    const newer = bridge.query(query);
    emitQueryResult(session, id(3), readyMemoryResult(query, 6));
    await expect(newer).resolves.toEqual(readyMemoryResult(query, 6));
    const staleAfterReady = bridge.query(query);
    emitQueryResult(session, id(4), readyMemoryResult(query, 5));
    await expect(staleAfterReady).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Harness returned an older workspace projection." },
    });

    const conversationQuery = conversationWaypointQuery();
    const independent = bridge.query(conversationQuery);
    emitQueryResult(session, id(999), readyConversationResult(conversationQuery, 1));
    await expect(independent).resolves.toEqual(readyConversationResult(conversationQuery, 1));
  });

  it("shares revision floors only within the same capability and scope", async () => {
    const session = new FakeSession();
    const bridge = bridgeWith(session, [id(1), id(2), id(3), id(4), id(5)]);
    session.emit({
      type: "message",
      message: createWorkspaceProjectionInvalidatedEvent(
        {
          messageId: id(906),
          sentAt: "2026-08-14T12:00:01.000Z",
          sequence: 1,
          causationId: null,
        },
        decodeStrict(WorkspaceNotificationSchema, {
          capability: "conversation",
          scope: { kind: "project", projectId: id(10) },
          revision: 5,
        }),
      ),
    });

    const context = contextRecordQuery();
    const staleContext = bridge.query(context);
    emitQueryResult(session, id(1), readyContextRecordResult(context, 4));
    await expect(staleContext).resolves.toMatchObject({ status: "broken" });

    const conversation = conversationProjectQuery();
    const staleConversation = bridge.query(conversation);
    emitQueryResult(session, id(2), readyConversationResult(conversation, 4));
    await expect(staleConversation).resolves.toMatchObject({ status: "broken" });

    const frame = frameQuery();
    const independentFrame = bridge.query(frame);
    emitQueryResult(session, id(3), readyFrameResult(frame, 1));
    await expect(independentFrame).resolves.toEqual(readyFrameResult(frame, 1));
    session.emit({
      type: "message",
      message: createWorkspaceProjectionInvalidatedEvent(
        {
          messageId: id(907),
          sentAt: "2026-08-14T12:00:02.000Z",
          sequence: 2,
          causationId: null,
        },
        decodeStrict(WorkspaceNotificationSchema, {
          capability: "frame",
          scope: { kind: "project", projectId: id(10) },
          revision: 5,
        }),
      ),
    });
    const staleFrame = bridge.query(frame);
    emitQueryResult(session, id(4), readyFrameResult(frame, 4));
    await expect(staleFrame).resolves.toMatchObject({ status: "broken" });

    const memory = memoryQuery();
    const independentMemory = bridge.query(memory);
    emitQueryResult(session, id(5), readyMemoryResult(memory, 1));
    await expect(independentMemory).resolves.toEqual(readyMemoryResult(memory, 1));

    const otherContext = contextRecordQuery(11);
    const independentProject = bridge.query(otherContext);
    emitQueryResult(session, id(999), readyContextRecordResult(otherContext, 1));
    await expect(independentProject).resolves.toEqual(readyContextRecordResult(otherContext, 1));
  });

  it("keeps a connected pending request until response or lifecycle failure", async () => {
    vi.useFakeTimers();
    const session = new FakeSession();
    const bridge = bridgeWith(session);
    let settled = false;
    const pending = bridge.query(memoryQuery()).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
    session.emit({ type: "disconnected" });
    await expect(pending).resolves.toMatchObject({
      status: "broken",
      diagnostic: { message: "Harness session disconnected." },
    });
  });

  it("keeps workspace IPC handlers narrow and validated", async () => {
    const query = memoryQuery();
    const intent = memoryIntent();
    const bridge = {
      query: vi.fn().mockResolvedValue(unavailableQueryResult(query)),
      stop: vi.fn(),
      submit: vi.fn().mockResolvedValue({ status: "forwarded", capability: "memory" }),
      subscribe: vi.fn(),
    } satisfies WorkspaceBridgeClient;
    registerWorkspaceIpc(bridge);
    const handlers = new Map(
      mainMocks.handle.mock.calls.map(([channel, handler]) => [channel as string, handler]),
    );
    const queryHandler = handlers.get(desktopIpcChannels.queryWorkspace);
    const intentHandler = handlers.get(desktopIpcChannels.submitWorkspaceIntent);

    await expect(queryHandler?.({}, query)).resolves.toEqual(unavailableQueryResult(query));
    await expect(intentHandler?.({}, intent)).resolves.toEqual({
      status: "forwarded",
      capability: "memory",
    });
    expect(bridge.query).toHaveBeenCalledExactlyOnceWith(query);
    expect(bridge.submit).toHaveBeenCalledExactlyOnceWith(intent);
    expect(() => queryHandler?.({}, { ...query, extra: true })).toThrow();
    expect(() => queryHandler?.({}, { query: "unknown" })).toThrow();
    expect(() => intentHandler?.({}, { ...intent, extra: true })).toThrow();
    expect(() => intentHandler?.({}, { intent: "unknown" })).toThrow();
    expect(bridge.query).toHaveBeenCalledTimes(1);
    expect(bridge.submit).toHaveBeenCalledTimes(1);

    const liveSend = vi.fn();
    const destroyedSend = vi.fn();
    mainMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send: liveSend } },
      { isDestroyed: () => true, webContents: { send: destroyedSend } },
    ]);
    const notification = decodeStrict(WorkspaceNotificationSchema, {
      capability: "memory",
      scope: { kind: "project", projectId: id(10) },
      revision: 1,
    });

    broadcastWorkspaceNotification(notification);
    expect(liveSend).toHaveBeenCalledExactlyOnceWith(
      desktopIpcChannels.workspaceNotification,
      notification,
    );
    expect(destroyedSend).not.toHaveBeenCalled();
    expect(() =>
      Reflect.apply(broadcastWorkspaceNotification, undefined, [{ ...notification, revision: -1 }]),
    ).toThrow();
    expect(liveSend).toHaveBeenCalledTimes(1);
  });
});
