import {
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  protocolVersion,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQueryResult,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type StopHarnessRuntime,
  startHarnessRuntime,
  type WorkspaceApplication,
} from "./index.js";

const handshake = {
  protocolVersion,
  messageType: "command",
  messageId: "00000000-0000-4000-8000-000000000001",
  sentAt: "2026-08-14T12:00:00.000Z",
  command: "system.handshake",
  payload: {
    desktopVersion: "0.0.0",
  },
} as const;

function memoryQuery(projectId: string) {
  return WorkspaceQuerySchema.parse({
    query: "memory-library.read",
    projectId,
    cursor: null,
  });
}

function unavailableMemoryResult(query: ReturnType<typeof memoryQuery>): WorkspaceQueryResult {
  return WorkspaceQueryResultSchema.parse({
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  });
}

const memoryIntent = WorkspaceIntentSchema.parse({
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000010",
  proposalId: "00000000-0000-4000-8000-000000000011",
  decision: "accept",
  expectedProjectionRevision: 0,
});

const unavailableMemoryIntentResult = WorkspaceIntentResultSchema.parse({
  status: "unavailable",
  capability: "memory",
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});

const memoryNotification = WorkspaceNotificationSchema.parse({
  capability: "memory",
  scope: {
    kind: "project",
    projectId: "00000000-0000-4000-8000-000000000010",
  },
  revision: 1,
});

class TestTransport implements HarnessTransport {
  readonly sent: unknown[] = [];
  #listener: ((message: unknown) => void) | undefined;

  emit(message: unknown): void {
    this.#listener?.(message);
  }

  send(message: unknown): void {
    this.sent.push(message);
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = undefined;
    };
  }
}

function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      if (settle === undefined) {
        throw new Error("Deferred promise was not initialized.");
      }
      settle(value);
    },
  };
}

function startRuntime(transport: TestTransport): StopHarnessRuntime {
  let generatedId = 2;
  return startHarnessRuntime({
    transport,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-08-14T12:00:01.000Z",
  });
}

describe("harness runtime transport", () => {
  it("dispatches workspace queries without false system ready", async () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);
    const query = WorkspaceQuerySchema.parse({
      query: "memory-library.read",
      projectId: "00000000-0000-4000-8000-000000000010",
      cursor: null,
    });

    transport.emit(handshake);
    transport.emit(
      createWorkspaceQueryCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000003",
          sentAt: "2026-08-14T12:00:02.000Z",
        },
        query,
      ),
    );
    await vi.waitFor(() => expect(transport.sent).toHaveLength(2));

    expect(transport.sent[0]).toMatchObject({
      event: "system.ready",
      sequence: 1,
    });
    expect(transport.sent[1]).toEqual({
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000003",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 2,
      causationId: "00000000-0000-4000-8000-000000000003",
      event: "workspace.query.result",
      payload: {
        status: "unavailable",
        query,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      },
    });
    expect(
      transport.sent.filter(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "event" in message &&
          message.event === "system.ready",
      ),
    ).toHaveLength(1);

    stop();
  });

  it("sequences concurrent workspace responses when they emit", async () => {
    const transport = new TestTransport();
    const pendingA = deferred<WorkspaceQueryResult>();
    const pendingB = deferred<WorkspaceQueryResult>();
    const workspaceApplication: WorkspaceApplication = {
      query: async (query) => {
        if (query.query !== "memory-library.read") {
          throw new Error("Test accepts only Memory queries.");
        }
        return query.projectId.endsWith("10") ? pendingA.promise : pendingB.promise;
      },
      submit: async () => {
        throw new Error("Intent dispatch is not used by this test.");
      },
      subscribe: () => () => undefined,
    };
    let generatedId = 11;
    const stop = startHarnessRuntime({
      transport,
      workspaceApplication,
      harnessVersion: "0.0.0",
      createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
      now: () => "2026-08-14T12:00:01.000Z",
    });
    const queryA = memoryQuery("00000000-0000-4000-8000-000000000010");
    const queryB = memoryQuery("00000000-0000-4000-8000-000000000011");
    transport.emit(
      createWorkspaceQueryCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000001",
          sentAt: "2026-08-14T12:00:00.000Z",
        },
        queryA,
      ),
    );
    transport.emit(
      createWorkspaceQueryCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000002",
          sentAt: "2026-08-14T12:00:00.000Z",
        },
        queryB,
      ),
    );

    pendingB.resolve(unavailableMemoryResult(queryB));
    await vi.waitFor(() => expect(transport.sent).toHaveLength(1));
    expect(transport.sent[0]).toMatchObject({
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000002",
    });

    pendingA.resolve(unavailableMemoryResult(queryA));
    await vi.waitFor(() => expect(transport.sent).toHaveLength(2));
    expect(transport.sent[1]).toMatchObject({
      sequence: 2,
      causationId: "00000000-0000-4000-8000-000000000001",
    });

    stop();
  });

  it("dispatches intents and valid notifications through the runtime", async () => {
    const transport = new TestTransport();
    let notificationSubscriber: ((notification: WorkspaceNotification) => void) | undefined;
    const workspaceApplication: WorkspaceApplication = {
      query: async () => {
        throw new Error("Queries are not used by this test.");
      },
      submit: async () => unavailableMemoryIntentResult,
      subscribe(listener) {
        notificationSubscriber = listener;
        return () => {
          notificationSubscriber = undefined;
        };
      },
    };
    let generatedId = 2;
    const stop = startHarnessRuntime({
      transport,
      workspaceApplication,
      harnessVersion: "0.0.0",
      createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
      now: () => "2026-08-14T12:00:01.000Z",
    });

    transport.emit(
      createWorkspaceIntentCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000001",
          sentAt: "2026-08-14T12:00:00.000Z",
        },
        memoryIntent,
      ),
    );
    await vi.waitFor(() => expect(transport.sent).toHaveLength(1));
    expect(transport.sent[0]).toMatchObject({
      event: "workspace.intent.result",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000001",
      payload: unavailableMemoryIntentResult,
    });

    notificationSubscriber?.(memoryNotification);
    expect(transport.sent[1]).toMatchObject({
      event: "workspace.projection.invalidated",
      sequence: 2,
      causationId: null,
    });

    stop();
    expect(notificationSubscriber).toBeUndefined();
  });

  it("turns an unexpected application rejection into correlated harness failure", async () => {
    const transport = new TestTransport();
    const workspaceApplication: WorkspaceApplication = {
      query: async () => {
        throw new Error("unexpected query failure");
      },
      submit: async () => {
        throw new Error("Intents are not used by this test.");
      },
      subscribe: () => () => undefined,
    };
    const stop = startHarnessRuntime({
      transport,
      workspaceApplication,
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    const query = WorkspaceQuerySchema.parse({
      query: "memory-library.read",
      projectId: "00000000-0000-4000-8000-000000000010",
      cursor: null,
    });

    transport.emit(
      createWorkspaceQueryCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000001",
          sentAt: "2026-08-14T12:00:00.000Z",
        },
        query,
      ),
    );
    await vi.waitFor(() => expect(transport.sent).toHaveLength(1));
    expect(transport.sent[0]).toMatchObject({
      event: "system.failure",
      causationId: "00000000-0000-4000-8000-000000000001",
      payload: {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a workspace message.",
      },
    });
    stop();
  });

  it("turns an invalid workspace notification into harness failure", () => {
    const transport = new TestTransport();
    let notificationSubscriber: ((notification: WorkspaceNotification) => void) | undefined;
    const workspaceApplication: WorkspaceApplication = {
      query: async () => {
        throw new Error("Queries are not used by this test.");
      },
      submit: async () => {
        throw new Error("Intents are not used by this test.");
      },
      subscribe(listener) {
        notificationSubscriber = listener;
        return () => {
          notificationSubscriber = undefined;
        };
      },
    };
    const stop = startHarnessRuntime({
      transport,
      workspaceApplication,
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    if (notificationSubscriber === undefined) {
      throw new Error("Workspace notification subscriber was not registered.");
    }

    Reflect.apply(notificationSubscriber, undefined, [
      {
        capability: "memory",
        scope: { kind: "project", projectId: "00000000-0000-4000-8000-000000000001" },
        revision: -1,
      },
    ]);

    expect(transport.sent).toEqual([
      {
        protocolVersion,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: null,
        event: "system.failure",
        payload: {
          code: "HARNESS_INTERNAL_FAILURE",
          message: "Harness failed while handling a workspace message.",
          retryable: false,
        },
      },
    ]);

    stop();
    expect(notificationSubscriber).toBeUndefined();
  });

  it("answers a valid handshake with an exact sequenced ready event", () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    transport.emit(handshake);

    expect(transport.sent).toEqual([
      {
        protocolVersion,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: handshake.messageId,
        event: "system.ready",
        payload: {
          harnessVersion: "0.0.0",
        },
      },
    ]);

    stop();
  });

  it("reports an unsupported peer as a failure rather than ready or absent", () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    transport.emit({
      ...handshake,
      protocolVersion: 1,
    });

    expect(transport.sent).toEqual([
      {
        protocolVersion,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: handshake.messageId,
        event: "system.failure",
        payload: {
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          message: "Desktop and harness protocol versions are incompatible.",
          retryable: false,
        },
      },
    ]);

    stop();
  });

  it("stops receiving messages after disposal", () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    stop();
    transport.emit(handshake);

    expect(transport.sent).toEqual([]);
  });
});
