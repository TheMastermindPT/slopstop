import {
  createProjectActivateCommand,
  createProjectCloseCommand,
  createProjectCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  createProjectRegistrationCommand,
  createProjectUpgradeCommand,
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  decodeStrict,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
  ProjectUpgradeResultSchema,
  protocolVersion,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQueryResult,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  createCanonicalRuntimeApplicationFixture,
  unusedCanonicalApplication as createUnusedCanonicalApplication,
} from "../tests/integration/canonical-runtime-application-fixture.js";
import { closesRuntimeAdmission } from "../tests/integration/command-admission-cases.js";
import { TestTransport } from "../tests/integration/harness-test-transport.js";
import {
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type ProjectStorageApplication,
  type StopHarnessRuntime,
  startHarnessRuntime,
  type WorkspaceApplication,
} from "./index.js";
import type { ProjectRegistrationFlow } from "./registration/project-registration-flow.js";

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
  return decodeStrict(WorkspaceQuerySchema, {
    query: "memory-library.read",
    projectId,
    cursor: null,
  });
}

function unavailableMemoryResult(query: ReturnType<typeof memoryQuery>): WorkspaceQueryResult {
  return decodeStrict(WorkspaceQueryResultSchema, {
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  });
}

const memoryIntent = decodeStrict(WorkspaceIntentSchema, {
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000010",
  proposalId: "00000000-0000-4000-8000-000000000011",
  decision: "accept",
  expectedProjectionRevision: 0,
});

const unavailableMemoryIntentResult = decodeStrict(WorkspaceIntentResultSchema, {
  status: "unavailable",
  capability: "memory",
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});

const memoryNotification = decodeStrict(WorkspaceNotificationSchema, {
  capability: "memory",
  scope: {
    kind: "project",
    projectId: "00000000-0000-4000-8000-000000000010",
  },
  revision: 1,
});

function canonicalRuntimeFixture(
  holdsProject?: () => boolean,
  // A listing owner that does not write to `calls`, so the exact `calls` pins stay unchanged.
  projectListing?: Readonly<{ list(): Promise<never>; stop: Effect.Effect<void, unknown> }>,
) {
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
  const applicationDatabase = {
    stop: vi.fn(async () => {
      calls.push("application-database");
    }),
    withhold: vi.fn(),
  };
  let sequence = 900;
  const options = {
    transport,
    applicationDatabase,
    ...(projectListing === undefined ? {} : { projectListing }),
    canonicalProjectApplication:
      holdsProject === undefined ? application : { ...application, holdsProject },
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
    protocolVersion: 9,
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
    applicationDatabase,
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
  expect(f.calls).toEqual(["canonical", "storage", "application-database"]);
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

it("stops Storage only after canonical release while a Project is held", async () => {
  const f = canonicalRuntimeFixture(() => true);
  const released = deferred<void>();
  f.application.stop.mockImplementationOnce(async () => {
    f.calls.push("canonical");
    await released.promise;
  });
  const stop = f.stop();
  await nextTurn();
  expect(f.storage.stop).not.toHaveBeenCalled();
  released.resolve();
  await stop;
  expect(f.calls).toEqual(["canonical", "storage", "application-database"]);
});

it("stops Storage together with the canonical application while no Project is held", async () => {
  const f = canonicalRuntimeFixture(() => false);
  const released = deferred<void>();
  f.application.stop.mockImplementationOnce(async () => {
    f.calls.push("canonical");
    await released.promise;
  });
  const stop = f.stop();
  expect(f.calls).toEqual(["canonical", "storage"]);
  released.resolve();
  await stop;
});

describe("shutdown failures while no Project is held", () => {
  const canonicalFailure = new Error("canonical stop failed");
  const storageFailure = new Error("storage stop failed");
  const listingFailure = new Error("listing stop failed");

  // Rule: the shared application database stops whenever Storage stopped; a canonical failure
  // is reported but, with no Project held, does not keep it alive.
  const failureOf = {
    canonical: canonicalFailure,
    storage: storageFailure,
    listing: listingFailure,
  } as const;
  type Failing = keyof typeof failureOf;

  /** A runtime whose owners named in `failing` fail their stop. */
  function failingRuntime(failing: readonly Failing[]) {
    const listing = {
      list: () => Promise.reject(new Error("Listing is not used by this test.")),
      stop: Effect.fail(listingFailure),
    };
    const f = canonicalRuntimeFixture(
      () => false,
      failing.includes("listing") ? listing : undefined,
    );
    if (failing.includes("canonical")) f.application.stop.mockRejectedValueOnce(canonicalFailure);
    if (failing.includes("storage")) f.storage.stop.mockRejectedValueOnce(storageFailure);
    return f;
  }

  /** One failure is reported as is; several are reported as one aggregate, in order. */
  function expectShutdownError(error: unknown, failures: readonly Error[]) {
    if (failures.length === 1) expect(error).toBe(failures[0]);
    else {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual(failures);
    }
  }

  it.for<{ name: string; failing: readonly Failing[]; databaseStops: boolean }>([
    { name: "canonical fails", failing: ["canonical"], databaseStops: true },
    { name: "Storage fails", failing: ["storage"], databaseStops: false },
    { name: "both fail", failing: ["canonical", "storage"], databaseStops: false },
    { name: "listing fails", failing: ["listing"], databaseStops: true },
  ])("$name", async (row) => {
    const f = failingRuntime(row.failing);
    const error = await f.stop().catch((caught: unknown) => caught);
    expectShutdownError(
      error,
      row.failing.map((owner) => failureOf[owner]),
    );
    expect(f.storage.stop).toHaveBeenCalledOnce();
    expect(f.applicationDatabase.stop).toHaveBeenCalledTimes(row.databaseStops ? 1 : 0);
    // Storage was withheld exactly when the database does not stop.
    expect(f.applicationDatabase.withhold).toHaveBeenCalledTimes(row.databaseStops ? 0 : 1);
  });

  /** A runtime with no Project held whose listing stop is `stop`. */
  function listingStopRuntime(stop: Effect.Effect<void, unknown>) {
    return canonicalRuntimeFixture(() => false, {
      list: () => Promise.reject(new Error("Listing is not used by this test.")),
      stop,
    });
  }

  it("the listing stop dies", async () => {
    const defect = new Error("listing stop defect");
    const f = listingStopRuntime(Effect.die(defect));
    const error = await f.stop().catch((caught: unknown) => caught);
    expect(error).toBe(defect);
    expect(f.applicationDatabase.stop).toHaveBeenCalledOnce();
    expect(f.applicationDatabase.withhold).not.toHaveBeenCalled();
  });

  it("the listing stop interrupts itself", async () => {
    const f = listingStopRuntime(Effect.interrupt);
    const error = await f.stop().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: "All fibers interrupted without error" });
    expect(f.applicationDatabase.stop).not.toHaveBeenCalled();
    expect(f.applicationDatabase.withhold).not.toHaveBeenCalled();
  });
});

it("treats a throwing held-Project query as held and reports it", async () => {
  const failure = new Error("held query failed");
  const f = canonicalRuntimeFixture(() => {
    throw failure;
  });
  const released = deferred<void>();
  f.application.stop.mockImplementationOnce(async () => {
    f.calls.push("canonical");
    await released.promise;
  });
  const stop = f.stop().catch((caught: unknown) => caught);
  await nextTurn();
  expect(f.storage.stop).not.toHaveBeenCalled();
  released.resolve();
  expect(await stop).toBe(failure);
  expect(f.calls).toEqual(["canonical", "storage", "application-database"]);
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
  const openRequest = decodeStrict(ProjectStorageOpenRequestSchema, { projectId });
  const createRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId,
    createRequestId: "00000000-0000-4000-8000-000000000011",
  });
  const closeRequest = decodeStrict(ProjectStorageCloseRequestSchema, { projectId });
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
      protocolVersion: 9,
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
            protocolVersion: 9,
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
    const query = decodeStrict(WorkspaceQuerySchema, {
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
    const query = decodeStrict(WorkspaceQuerySchema, {
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
        protocolVersion: 9,
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
        protocolVersion: 9,
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
        protocolVersion: 9,
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

  it("answers registration steps as unavailable when no registration owner is installed", async () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);
    const command = createProjectRegistrationCommand(
      { messageId: "00000000-0000-4000-8000-000000000031", sentAt: "2026-10-04T12:00:00.000Z" },
      { step: "prepare-git" },
    );

    transport.emit(command);
    await vi.waitFor(() => expect(transport.sent).toHaveLength(1));

    expect(transport.sent).toMatchObject([
      {
        protocolVersion: 9,
        causationId: command.messageId,
        event: "project.registration.result",
        payload: { status: "unavailable", code: "PROJECT_REGISTRATION_UNAVAILABLE" },
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
        protocolVersion: 9,
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
import {
  expectInvalidSwitchRuntime,
  newAEpoch,
  switchActive,
  switchApplicationFailures,
  switchApplicationResults,
  switchApplicationTargets,
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

it.each(switchRuntimeLifecycles.filter(({ kind }) => kind !== "activate"))(
  "closes command admission in the same turn as lifecycle enqueue: runtime $kind",
  closesRuntimeAdmission,
);

it.each(switchApplicationResults)(
  "validates complete switch correlation and preserves owner exceptions: runtime original identities $name",
  async ({ value }) => {
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, value);
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
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, value);
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
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, switchTarget(target));
    if (changed.status !== "target-result") throw new Error("Expected a target fixture.");
    Reflect.set(changed.target.request, "projectId", switchProjects.A.projectId);
    await expectInvalidSwitchRuntime(changed, new TestTransport());
    Reflect.set(changed.request.to, "projectId", switchProjects.C.projectId);
    Reflect.set(changed.target.request, "projectId", switchProjects.C.projectId);
    expect(decodeStrict(CanonicalProjectSwitchResultSchema, changed)).toEqual(changed);
    await expectInvalidSwitchRuntime(changed, new TestTransport());
  },
);
it.each(switchApplicationFailures)(
  "validates complete switch correlation and preserves owner exceptions: runtime retryability $name",
  async ({ value }) => {
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, value);
    if (changed.status === "target-result") throw new Error("Expected a failure fixture.");
    Reflect.set(changed.diagnostic, "retryable", !changed.diagnostic.retryable);
    await expectInvalidSwitchRuntime(changed, new TestTransport());
  },
);
it("validates complete switch correlation and preserves owner exceptions: runtime read-only retryability", async () => {
  const changed = decodeStrict(
    CanonicalProjectSwitchResultSchema,
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

it("routes an upgrade to the canonical application and answers its result", async () => {
  const transport = new TestTransport();
  const result = decodeStrict(ProjectUpgradeResultSchema, {
    status: "not-required",
    request: { projectId: "00000000-0000-4000-8000-000000000010" },
  });
  const upgrade = vi.fn(async () => result);
  const stop = startHarnessRuntime({
    transport,
    canonicalProjectApplication: { ...unusedCanonicalApplication(), upgrade },
    projectStorageApplication: createUnavailableProjectStorageApplication(),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000901",
    now: () => "2026-10-06T12:00:00.000Z",
  });
  try {
    const command = createProjectUpgradeCommand(
      { messageId: "00000000-0000-4000-8000-000000000101", sentAt: "2026-10-06T12:00:00.000Z" },
      result.request,
    );
    transport.emit(command);
    await nextTurn();
    expect(upgrade).toHaveBeenCalledWith(result.request);
    expect(transport.sent).toEqual([
      {
        protocolVersion: 9,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000901",
        sentAt: "2026-10-06T12:00:00.000Z",
        sequence: 1,
        causationId: command.messageId,
        event: "project.upgrade.result",
        payload: result,
      },
    ]);
  } finally {
    await stop();
  }
});

import {
  createProjectConversationReadCommand,
  createProjectConversationSaveCommand,
  ProjectConversationReadResultSchema,
  ProjectConversationSaveResultSchema,
} from "@slopstop/protocol";

const conversationTarget = {
  projectId: "00000000-0000-4000-8000-000000000010",
  activationId: "00000000-0000-4000-8000-000000000011",
};
const conversationReadResult = decodeStrict(ProjectConversationReadResultSchema, {
  status: "read",
  request: { ...conversationTarget, after: null },
  conversation: null,
});
const conversationSaveResult = decodeStrict(ProjectConversationSaveResultSchema, {
  status: "conflict",
  request: {
    ...conversationTarget,
    saveId: "00000000-0000-4000-8000-000000000012",
    expectedRevision: 0,
    text: "Hello",
  },
  currentRevision: 1,
});
const conversationSentAt = "2026-10-10T12:00:00.000Z";

/** One harness event the conversation dispatch test expects, its ids counted from 900. */
function conversationEvent(sequence: number, causationId: string, name: string, payload: unknown) {
  return {
    protocolVersion: 9,
    messageType: "event",
    messageId: `00000000-0000-4000-8000-${String(899 + sequence).padStart(12, "0")}`,
    sentAt: conversationSentAt,
    sequence,
    causationId,
    event: name,
    payload,
  };
}

it("dispatches conversation commands to the coordinator (CNV-B39)", async () => {
  const transport = new TestTransport();
  const readResult = conversationReadResult;
  const saveResult = conversationSaveResult;
  const conversationRead = vi.fn(async () => readResult);
  const conversationSave = vi.fn(async () => saveResult);
  let generatedId = 900;
  const stop = startHarnessRuntime({
    transport,
    canonicalProjectApplication: {
      ...unusedCanonicalApplication(),
      conversationRead,
      conversationSave,
    },
    projectStorageApplication: createUnavailableProjectStorageApplication(),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-10-10T12:00:00.000Z",
  });
  try {
    const sentAt = conversationSentAt;
    const read = createProjectConversationReadCommand(
      { messageId: "00000000-0000-4000-8000-000000000101", sentAt },
      readResult.request,
    );
    const save = createProjectConversationSaveCommand(
      { messageId: "00000000-0000-4000-8000-000000000102", sentAt },
      saveResult.request,
    );
    transport.emit(read);
    await nextTurn();
    transport.emit(save);
    await nextTurn();
    transport.emit({ ...save, messageId: "00000000-0000-4000-8000-000000000103", payload: {} });
    await nextTurn();
    expect(conversationRead).toHaveBeenCalledExactlyOnceWith(readResult.request);
    expect(conversationSave).toHaveBeenCalledExactlyOnceWith(saveResult.request);
    const event = conversationEvent;
    expect(transport.sent).toEqual([
      event(1, read.messageId, "project.conversation.read.result", readResult),
      event(2, save.messageId, "project.conversation.save.result", saveResult),
      event(3, "00000000-0000-4000-8000-000000000103", "request.failure", {
        code: "PROTOCOL_MESSAGE_INVALID",
        message: "Harness received an invalid protocol message.",
        retryable: false,
      }),
    ]);
  } finally {
    await stop();
  }
});

describe("registration requests on the process runtime", () => {
  const registrationRequest = createProjectRegistrationCommand(
    { messageId: "00000000-0000-4000-8000-000000000041", sentAt: "2026-10-18T12:00:00.000Z" },
    { step: "prepare-git" },
  );

  /** A process runtime over an empty Layer, built before the behaviour under test. */
  function builtProcessRuntime() {
    const runtime = ManagedRuntime.make(Layer.empty);
    runtime.runSync(Effect.void);
    return runtime;
  }

  function registrationRuntime(
    transport: TestTransport,
    handle: ProjectRegistrationFlow["handle"],
    runtime: ManagedRuntime.ManagedRuntime<never, never>,
  ) {
    let generatedId = 2;
    return startHarnessRuntime({
      transport,
      projectRegistration: { handle },
      runtime,
      canonicalProjectApplication: unusedCanonicalApplication(),
      projectStorageApplication: createUnavailableProjectStorageApplication(),
      workspaceApplication: createUnavailableWorkspaceApplication(),
      harnessVersion: "0.0.0",
      createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
      now: () => "2026-10-18T12:00:01.000Z",
    });
  }

  it("interrupts an in-flight registration request at dispose without a reply", async () => {
    const calls: string[] = [];
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      const runtime = builtProcessRuntime();
      const transport = new TestTransport();
      const stop = registrationRuntime(
        transport,
        () =>
          Effect.sync(() => calls.push("handle-started")).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Effect.sync(() => calls.push("handle-interrupted"))),
          ),
        runtime,
      );
      transport.emit(registrationRequest);
      await vi.waitFor(() => expect(calls).toEqual(["handle-started"]));
      await stop();
      await runtime.dispose();
      expect(calls).toEqual(["handle-started", "handle-interrupted"]);
      expect(transport.sent).toEqual([]);
      await nextTurn();
      // A late reply to the interrupted request would arrive by now.
      expect(transport.sent).toEqual([]);
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  // `sequence: 1`: the one reply, with no registration result attempted before it.
  const internalFailure = {
    event: "request.failure",
    sequence: 1,
    causationId: registrationRequest.messageId,
    payload: {
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    },
  };

  it.each<{ name: string; handle: ProjectRegistrationFlow["handle"]; reply: unknown }>([
    {
      name: "handle succeeds",
      handle: () => Effect.succeed({ status: "trust-recorded" }),
      reply: {
        event: "project.registration.result",
        causationId: registrationRequest.messageId,
        payload: { status: "trust-recorded" },
      },
    },
    {
      name: "handle dies",
      handle: () => Effect.die(new Error("private registration defect")),
      reply: internalFailure,
    },
    {
      name: "handle interrupts itself before any stop",
      handle: () => Effect.interrupt,
      reply: internalFailure,
    },
  ])("answers registration exits on the process runtime: $name", async ({ handle, reply }) => {
    const runtime = builtProcessRuntime();
    const transport = new TestTransport();
    const stop = registrationRuntime(transport, handle, runtime);
    transport.emit(registrationRequest);
    await vi.waitFor(() => expect(transport.sent).toHaveLength(1));
    expect(transport.sent).toMatchObject([reply]);
    await stop();
    await runtime.dispose();
    expect(transport.sent).toHaveLength(1);
  });
});
