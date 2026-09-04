import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
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
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type ProjectStorageApplication,
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
    projectStorageApplication: createUnavailableProjectStorageApplication(),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-08-14T12:00:01.000Z",
  });
}

function projectStorageCommands() {
  const projectId = "00000000-0000-4000-8000-000000000010";
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId: "00000000-0000-4000-8000-000000000011",
  });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });
  const open = createProjectOpenCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000100",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    openRequest,
  );
  const create = createProjectCreateCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000101",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    createRequest,
  );
  const close = createProjectCloseCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000102",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    closeRequest,
  );
  return { close, closeRequest, create, createRequest, open, openRequest };
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

    await stop();
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
      projectStorageApplication: createUnavailableProjectStorageApplication(),
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

    await stop();
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
      projectStorageApplication: createUnavailableProjectStorageApplication(),
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

    await stop();
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
      projectStorageApplication: createUnavailableProjectStorageApplication(),
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
        message: "Harness failed while handling a message.",
      },
    });
    await stop();
  });

  it("dispatches Project Storage commands sequentially with exact unavailable results", async () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);
    const { close, closeRequest, create, createRequest, open, openRequest } =
      projectStorageCommands();

    for (const [index, command] of [open, create, close].entries()) {
      transport.emit(command);
      await vi.waitFor(() => expect(transport.sent).toHaveLength(index + 1));
    }

    expect(transport.sent).toMatchObject([
      {
        protocolVersion: 3,
        sequence: 1,
        causationId: open.messageId,
        event: "project.open.result",
        payload: {
          status: "unavailable",
          request: openRequest,
          diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
        },
      },
      {
        protocolVersion: 3,
        sequence: 2,
        causationId: create.messageId,
        event: "project.create.result",
        payload: {
          status: "unavailable",
          request: createRequest,
          diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
        },
      },
      {
        protocolVersion: 3,
        sequence: 3,
        causationId: close.messageId,
        event: "project.close.result",
        payload: {
          status: "unavailable",
          request: closeRequest,
          diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
        },
      },
    ]);

    await stop();
  });

  it("reports a neutral internal failure when Project dispatch throws", async () => {
    const transport = new TestTransport();
    const thrownMessage = "C:\\private\\project\\slopstop.db";
    const projectStorageApplication: ProjectStorageApplication = {
      open: async () => {
        throw new Error(thrownMessage);
      },
      create: async () => {
        throw new Error("Create is not used by this test.");
      },
      close: async () => {
        throw new Error("Close is not used by this test.");
      },
      stop: async () => undefined,
    };
    const stop = startHarnessRuntime({
      transport,
      workspaceApplication: createUnavailableWorkspaceApplication(),
      projectStorageApplication,
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    const { open } = projectStorageCommands();

    transport.emit(open);
    await vi.waitFor(() => expect(transport.sent).toHaveLength(1));

    expect(transport.sent).toEqual([
      {
        protocolVersion: 3,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: open.messageId,
        event: "system.failure",
        payload: {
          code: "HARNESS_INTERNAL_FAILURE",
          message: "Harness failed while handling a message.",
          retryable: false,
        },
      },
    ]);
    const serialized = JSON.stringify(transport.sent);
    expect(serialized.toLowerCase()).not.toContain("workspace");
    expect(serialized).not.toContain(thrownMessage);
    await stop();
  });

  it("stops intake before exposing one observable Project Storage stop promise", async () => {
    const calls: string[] = [];
    const stopMessages = vi.fn(() => calls.push("stopMessages"));
    const stopNotifications = vi.fn(() => calls.push("stopNotifications"));
    const shutdownFailure = new Error("private shutdown failure");
    const projectStorageStop = Promise.reject(shutdownFailure);
    const stopProjectStorage = vi.fn(() => {
      calls.push("projectStorageApplication.stop");
      return projectStorageStop;
    });
    const transport: HarnessTransport = {
      send: () => undefined,
      subscribe: () => stopMessages,
    };
    const workspaceApplication: WorkspaceApplication = {
      query: async () => {
        throw new Error("Queries are not used by this test.");
      },
      submit: async () => {
        throw new Error("Intents are not used by this test.");
      },
      subscribe: () => stopNotifications,
    };
    const projectStorageApplication: ProjectStorageApplication = {
      open: async () => {
        throw new Error("Open is not used by this test.");
      },
      create: async () => {
        throw new Error("Create is not used by this test.");
      },
      close: async () => {
        throw new Error("Close is not used by this test.");
      },
      stop: stopProjectStorage,
    };
    const stop = startHarnessRuntime({
      transport,
      workspaceApplication,
      projectStorageApplication,
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });

    const firstStop = stop();
    const repeatedStop = stop();

    expect(calls).toEqual(["stopMessages", "stopNotifications", "projectStorageApplication.stop"]);
    expect(stopMessages).toHaveBeenCalledOnce();
    expect(stopNotifications).toHaveBeenCalledOnce();
    expect(stopProjectStorage).toHaveBeenCalledOnce();
    expect(repeatedStop).toBe(firstStop);
    await expect(firstStop).rejects.toBe(shutdownFailure);
  });

  it("retains synchronous shutdown failures while attempting every cleanup", async () => {
    const calls: string[] = [];
    const intakeFailure = new Error("private intake shutdown failure");
    const storageFailure = new Error("private Storage shutdown failure");
    const stopMessages = vi.fn(() => {
      calls.push("stopMessages");
      throw intakeFailure;
    });
    const stopNotifications = vi.fn(() => calls.push("stopNotifications"));
    const projectStorageApplication = {
      ...createUnavailableProjectStorageApplication(),
      stop: () => {
        calls.push("projectStorageApplication.stop");
        throw storageFailure;
      },
    };
    const stop = startHarnessRuntime({
      transport: { send: () => undefined, subscribe: () => stopMessages },
      workspaceApplication: {
        ...createUnavailableWorkspaceApplication(),
        subscribe: () => stopNotifications,
      },
      projectStorageApplication,
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    let firstStop: Promise<void> | undefined;

    expect(() => {
      firstStop = stop();
    }).not.toThrow();
    if (firstStop === undefined) {
      throw new Error("Runtime stop did not return a Promise.");
    }

    expect(stop()).toBe(firstStop);
    expect(calls).toEqual(["stopMessages", "stopNotifications", "projectStorageApplication.stop"]);
    await expect(firstStop).rejects.toMatchObject({ errors: [intakeFailure, storageFailure] });
    expect(stopMessages).toHaveBeenCalledOnce();
    expect(stopNotifications).toHaveBeenCalledOnce();
  });

  it("turns an invalid workspace notification into harness failure", async () => {
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
      projectStorageApplication: createUnavailableProjectStorageApplication(),
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
          message: "Harness failed while handling a message.",
          retryable: false,
        },
      },
    ]);

    await stop();
    expect(notificationSubscriber).toBeUndefined();
  });

  it("answers a valid handshake with an exact sequenced ready event", async () => {
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

    await stop();
  });

  it("reports an unsupported peer as a failure rather than ready or absent", async () => {
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

    await stop();
  });

  it("stops receiving messages after disposal", async () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    await stop();
    transport.emit(handshake);

    expect(transport.sent).toEqual([]);
  });
});
