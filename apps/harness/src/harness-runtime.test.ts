import {
  createProjectActivateCommand,
  createProjectCloseCommand,
  createProjectCommand,
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
  createCanonicalRuntimeApplicationFixture,
  unusedCanonicalApplication as createUnusedCanonicalApplication,
} from "../tests/integration/canonical-runtime-application-fixture.js";
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

function canonicalRuntimeFixture() {
  const transport = new TestTransport();
  const calls: string[] = [];
  const { request, activationResult, commandResult, application } =
    createCanonicalRuntimeApplicationFixture({
      switchProject: unexpectedCanonicalSwitch,
      stop: vi.fn(async () => {
        calls.push("canonical");
      }),
    });
  const storage = {
    ...createUnavailableProjectStorageApplication(),
    stop: vi.fn(async () => {
      calls.push("storage");
    }),
  };
  let sequence = 900;
  const options = {
    transport,
    canonicalProjectApplication: application,
    projectStorageApplication: storage,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    now: () => "2026-09-04T12:00:00.000Z",
  };
  const stop = startHarnessRuntime(options);
  const activate = createProjectActivateCommand(
    { messageId: "00000000-0000-4000-8000-000000000101", sentAt: options.now() },
    { projectId: request.projectId },
  );
  const execute = createProjectCommand(
    { messageId: "00000000-0000-4000-8000-000000000102", sentAt: options.now() },
    request,
  );
  const expected = (event: string, payload: unknown, number: number, causationId: string) => ({
    protocolVersion: 4,
    messageType: "event",
    messageId: `00000000-0000-4000-8000-${String(900 + number).padStart(12, "0")}`,
    sentAt: options.now(),
    sequence: number,
    causationId,
    event,
    payload,
  });
  return {
    transport,
    application,
    storage,
    calls,
    stop,
    activate,
    execute,
    expected,
    activationResult,
    commandResult,
  };
}

it("round-trips canonical activation and contains canonical request failures", async () => {
  const f = canonicalRuntimeFixture();
  try {
    f.transport.emit(f.activate);
    await nextTurn();
    expect(f.transport.sent).toEqual([
      f.expected("project.activate.result", f.activationResult, 1, f.activate.messageId),
    ]);
    f.transport.emit(f.execute);
    await nextTurn();
    expect(f.transport.sent[1]).toEqual(
      f.expected("project.command.result", f.commandResult, 2, f.execute.messageId),
    );
    f.application.activate.mockRejectedValueOnce(new Error("C:\\private\\project\\slopstop.db"));
    f.application.execute.mockRejectedValueOnce(new Error("secret command payload"));
    for (const [index, message] of [f.activate, f.execute].entries()) {
      f.transport.emit(message);
      await nextTurn();
      expect(f.transport.sent[index + 2]).toEqual(
        f.expected(
          "request.failure",
          {
            code: "HARNESS_INTERNAL_FAILURE",
            message: "Harness failed while handling a message.",
            retryable: false,
          },
          index + 3,
          message.messageId,
        ),
      );
    }
  } finally {
    await f.stop();
  }
  expect(f.calls).toEqual(["canonical", "storage"]);
});

it("awaits canonical release and withholds Storage shutdown after rejection", async () => {
  const f = canonicalRuntimeFixture();
  const pending = deferred<void>();
  const failure = new Error("canonical release failed");
  f.application.stop.mockImplementationOnce(async () => {
    f.calls.push("canonical");
    await pending.promise;
    throw failure;
  });
  const stop = f.stop();
  const observed = stop.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(f.stop()).toBe(stop);
  const immediateCalls = [...f.calls];
  const immediateStorageCalls = f.storage.stop.mock.calls.length;
  pending.resolve();
  const error = await observed;
  expect(immediateCalls).toEqual(["canonical"]);
  expect(immediateStorageCalls).toBe(0);
  expect(error).toBe(failure);
  expect(f.storage.stop).not.toHaveBeenCalled();
});

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

async function unexpectedCanonicalSwitch(): Promise<never> {
  throw new Error("Unexpected canonical Project switch in this fixture.");
}

function unusedCanonicalApplication() {
  return createUnusedCanonicalApplication(unexpectedCanonicalSwitch);
}

function startRuntime(transport: TestTransport): StopHarnessRuntime {
  let generatedId = 2;
  return startHarnessRuntime({
    transport,
    canonicalProjectApplication: unusedCanonicalApplication(),
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

const invalidPayload = {
  code: "PROTOCOL_MESSAGE_INVALID",
  message: "Harness received an invalid protocol message.",
  retryable: false,
};
const failureScopeCases = [
  {
    kind: "message",
    input: {
      protocolVersion: 4,
      messageType: "command",
      messageId: "00000000-0000-4000-8000-000000000202",
      sentAt: "2026-08-14T12:00:00.000Z",
      command: "unknown",
      payload: {},
    },
    expected: {
      event: "request.failure",
      causationId: "00000000-0000-4000-8000-000000000202",
      payload: invalidPayload,
    },
  },
  {
    kind: "message",
    input: { invalid: true },
    expected: { event: "system.failure", causationId: null, payload: invalidPayload },
  },
  {
    kind: "notification",
    input: { capability: "memory" },
    expected: {
      event: "system.failure",
      causationId: null,
      payload: {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a message.",
        retryable: false,
      },
    },
  },
];

describe("harness runtime transport", () => {
  it("chooses failure scope from recoverable causation", async () => {
    for (const testCase of failureScopeCases) {
      const transport = new TestTransport();
      const missingSubscriber = (_notification: WorkspaceNotification): void => {
        throw new Error("Notification subscriber was not registered.");
      };
      let notify = missingSubscriber;
      const stop = startHarnessRuntime({
        transport,
        canonicalProjectApplication: unusedCanonicalApplication(),
        projectStorageApplication: createUnavailableProjectStorageApplication(),
        workspaceApplication: {
          ...createUnavailableWorkspaceApplication(),
          subscribe(listener) {
            notify = listener;
            return () => {
              notify = missingSubscriber;
            };
          },
        },
        harnessVersion: "0.0.0",
        createId: () => "00000000-0000-4000-8000-000000000002",
        now: () => "2026-08-14T12:00:01.000Z",
      });
      try {
        if (testCase.kind === "message") {
          transport.emit(testCase.input);
        } else {
          Reflect.apply(notify, undefined, [testCase.input]);
        }
        expect(transport.sent).toEqual([
          {
            protocolVersion: 4,
            messageType: "event",
            messageId: "00000000-0000-4000-8000-000000000002",
            sentAt: "2026-08-14T12:00:01.000Z",
            sequence: 1,
            ...testCase.expected,
          },
        ]);
      } finally {
        await stop();
      }
    }
  });

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
      canonicalProjectApplication: unusedCanonicalApplication(),
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
      canonicalProjectApplication: unusedCanonicalApplication(),
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
      canonicalProjectApplication: unusedCanonicalApplication(),
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
      event: "request.failure",
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
        protocolVersion: 4,
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
        protocolVersion: 4,
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
        protocolVersion: 4,
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
      canonicalProjectApplication: unusedCanonicalApplication(),
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
        protocolVersion: 4,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: open.messageId,
        event: "request.failure",
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
    const stopProjectStorage = vi.fn(() => {
      calls.push("projectStorageApplication.stop");
      return Promise.reject(shutdownFailure);
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
      canonicalProjectApplication: {
        ...unusedCanonicalApplication(),
        stop: async () => {
          calls.push("canonicalProjectApplication.stop");
        },
      },
      workspaceApplication,
      projectStorageApplication,
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });

    const firstStop = stop();
    const repeatedStop = stop();

    expect(calls).toEqual([
      "stopMessages",
      "stopNotifications",
      "canonicalProjectApplication.stop",
    ]);
    expect(stopMessages).toHaveBeenCalledOnce();
    expect(stopNotifications).toHaveBeenCalledOnce();
    expect(stopProjectStorage).not.toHaveBeenCalled();
    expect(repeatedStop).toBe(firstStop);
    await expect(firstStop).rejects.toBe(shutdownFailure);
    expect(calls).toEqual([
      "stopMessages",
      "stopNotifications",
      "canonicalProjectApplication.stop",
      "projectStorageApplication.stop",
    ]);
    expect(stopProjectStorage).toHaveBeenCalledOnce();
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
      canonicalProjectApplication: {
        ...unusedCanonicalApplication(),
        stop: async () => {
          calls.push("canonicalProjectApplication.stop");
        },
      },
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
    expect(calls).toEqual([
      "stopMessages",
      "stopNotifications",
      "canonicalProjectApplication.stop",
    ]);
    await expect(firstStop).rejects.toMatchObject({ errors: [intakeFailure, storageFailure] });
    expect(calls).toEqual([
      "stopMessages",
      "stopNotifications",
      "canonicalProjectApplication.stop",
      "projectStorageApplication.stop",
    ]);
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
      canonicalProjectApplication: unusedCanonicalApplication(),
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
        event: "request.failure",
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

import { setImmediate as nextTurn } from "node:timers/promises";
import {
  type CanonicalProjectSwitchResult,
  CanonicalProjectSwitchResultSchema,
} from "@slopstop/protocol";
import { migratedUnsupported } from "../tests/integration/conformance-counter-command.js";
import {
  activateSwitchSource,
  expectInvalidSwitchRuntime,
  newAEpoch,
  switchActive,
  switchApplicationFailures,
  switchApplicationResults,
  switchApplicationTargets,
  switchCommandFailure,
  switchCommands,
  switchDeferred,
  switchEvent,
  switchFixture,
  switchInternalFailure,
  switchMessages,
  switchPrivateFailure,
  switchProjects,
  switchRequests,
  switchResultBoundaries,
  switchRuntimeLifecycles,
  switchRuntimeOptions,
  switchTarget,
} from "../tests/integration/project-storage-create-fixture.js";

async function observeRuntimeSend(transport: TestTransport, trigger: () => void) {
  const emitted = switchDeferred<void>();
  const original = transport.send.bind(transport);
  const observer = vi.spyOn(transport, "send").mockImplementationOnce((message) => {
    original(message);
    emitted.resolve();
  });
  try {
    trigger();
    await emitted.promise;
  } finally {
    observer.mockRestore();
  }
}

it.each(switchRuntimeLifecycles)(
  "closes command admission in the same turn as lifecycle enqueue: runtime $kind",
  async ({ kind, message, event }) => {
    const f = switchFixture(kind === "activate");
    if (kind !== "initial activate") await activateSwitchSource(f);
    const transport = new TestTransport();
    const stop = startHarnessRuntime(switchRuntimeOptions(f.owner, transport));
    try {
      const lifecycle = message === undefined ? f.owner.stop() : transport.emit(message);
      transport.emit(switchMessages.A);
      await lifecycle;
      await nextTurn();
      const expected = [
        switchEvent(
          1,
          403,
          "project.command.result",
          switchCommandFailure("coordinator-unavailable"),
        ),
      ];
      if (event !== undefined) expected.push(event);
      expect(transport.sent).toEqual(expected);
      expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
      if (kind === "activate") {
        await observeRuntimeSend(transport, () => transport.emit(switchMessages.A));
        expected.push(
          switchEvent(3, 403, "project.command.result", migratedUnsupported(switchCommands.A)),
        );
        expect(transport.sent).toEqual(expected);
        expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(1);
      }
    } finally {
      await stop();
    }
  },
);

it.each(["A.fence", "B.storage.acquire"])(
  "closes command admission in the same turn as lifecycle enqueue: held runtime %s",
  async (stage) => {
    const f = switchFixture(true);
    await activateSwitchSource(f);
    const hold = f.hold(stage);
    const transport = new TestTransport();
    const stop = startHarnessRuntime(switchRuntimeOptions(f.owner, transport));
    try {
      transport.emit(switchMessages.switch);
      await hold.entered;
      expect(f.all).toContain(stage);
      expect(transport.sent).toEqual([]);
      transport.emit(switchMessages.A);
      transport.emit(switchMessages.B);
      await nextTurn();
      const expected = [
        switchEvent(
          1,
          403,
          "project.command.result",
          switchCommandFailure("coordinator-unavailable"),
        ),
        switchEvent(
          2,
          404,
          "project.command.result",
          switchCommandFailure("coordinator-unavailable", switchCommands.B),
        ),
      ];
      expect(transport.sent).toEqual(expected);
      expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
      expect(f.projects.B.repository.settle).toHaveBeenCalledTimes(0);
      await observeRuntimeSend(transport, hold.resolve);
      expected.push(switchEvent(3, 402, "project.switch.result", switchTarget()));
      expect(transport.sent).toEqual(expected);
      await observeRuntimeSend(transport, () => transport.emit(switchMessages.B));
      expected.push(
        switchEvent(4, 404, "project.command.result", migratedUnsupported(switchCommands.B)),
      );
      transport.emit(switchMessages.A);
      await nextTurn();
      expected.push(
        switchEvent(5, 403, "project.command.result", switchCommandFailure("project-mismatch")),
      );
      expect(transport.sent).toEqual(expected);
      expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
      expect(f.projects.B.repository.settle).toHaveBeenCalledTimes(1);
    } finally {
      hold.resolve();
      await stop();
    }
  },
);

it.each(switchApplicationResults)(
  "validates complete switch correlation and preserves owner exceptions: runtime original identities $name",
  async ({ value }) => {
    const changed = CanonicalProjectSwitchResultSchema.parse(value);
    for (const [boundary, key, replacement] of [
      [changed.request.from, "projectId", switchProjects.C.projectId],
      [changed.request.from, "activationId", newAEpoch],
      [changed.request.to, "projectId", switchProjects.C.projectId],
    ] as const) {
      const original: unknown = Reflect.get(boundary, key);
      Reflect.set(boundary, key, replacement);
      await expectInvalidSwitchRuntime(changed, new TestTransport());
      Reflect.set(boundary, key, original);
    }
  },
);
it.each(switchApplicationResults)(
  "validates complete switch correlation and preserves owner exceptions: runtime private fields $name",
  async ({ value }) => {
    const changed = CanonicalProjectSwitchResultSchema.parse(value);
    for (const boundary of switchResultBoundaries(changed)) {
      for (const key of [
        "extra",
        "writerToken",
        "tokenDigest",
        "canonicalDatabasePath",
        "writerLeasePath",
        "error",
        "cause",
      ]) {
        Reflect.set(boundary, key, switchPrivateFailure);
        await expectInvalidSwitchRuntime(changed, new TestTransport());
        Reflect.deleteProperty(boundary, key);
      }
    }
  },
);
it.each(switchApplicationTargets)(
  "validates complete switch correlation and preserves owner exceptions: runtime nested identities $name",
  async ({ target }) => {
    const changed = CanonicalProjectSwitchResultSchema.parse(switchTarget(target));
    if (changed.status !== "target-result") throw new Error("Expected a target fixture.");
    Reflect.set(changed.target.request, "projectId", switchProjects.A.projectId);
    await expectInvalidSwitchRuntime(changed, new TestTransport());
    Reflect.set(changed.request.to, "projectId", switchProjects.C.projectId);
    Reflect.set(changed.target.request, "projectId", switchProjects.C.projectId);
    expect(CanonicalProjectSwitchResultSchema.parse(changed)).toEqual(changed);
    await expectInvalidSwitchRuntime(changed, new TestTransport());
  },
);
it.each(switchApplicationFailures)(
  "validates complete switch correlation and preserves owner exceptions: runtime retryability $name",
  async ({ value }) => {
    const changed = CanonicalProjectSwitchResultSchema.parse(value);
    if (changed.status === "target-result") throw new Error("Expected a failure fixture.");
    Reflect.set(changed.diagnostic, "retryable", !changed.diagnostic.retryable);
    await expectInvalidSwitchRuntime(changed, new TestTransport());
  },
);
it("validates complete switch correlation and preserves owner exceptions: runtime read-only retryability", async () => {
  const changed = CanonicalProjectSwitchResultSchema.parse(
    switchTarget(switchActive("B", 1, "read-only")),
  );
  if (changed.status !== "target-result" || !("diagnostic" in changed.target))
    throw new Error("Expected read-only fixture.");
  Reflect.set(changed.target.diagnostic, "retryable", false);
  await expectInvalidSwitchRuntime(changed, new TestTransport());
});
it.each(["throw", "reject"])(
  "validates complete switch correlation and preserves owner exceptions: runtime owner %s",
  async (kind) => {
    const transport = new TestTransport();
    const f = switchFixture();
    const error = new Error(switchPrivateFailure);
    const switchProject = vi.fn((): Promise<CanonicalProjectSwitchResult> => {
      throw error;
    });
    if (kind === "reject") switchProject.mockRejectedValue(error);
    const stop = startHarnessRuntime(
      switchRuntimeOptions({ ...f.owner, switchProject }, transport),
    );
    try {
      transport.emit(switchMessages.switch);
      await nextTurn();
      expect(transport.sent).toEqual([
        switchEvent(1, 402, "request.failure", switchInternalFailure),
      ]);
      expect(switchProject).toHaveBeenCalledExactlyOnceWith(switchRequests.AB);
    } finally {
      await stop();
    }
  },
);
