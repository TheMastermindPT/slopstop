import os from "node:os";
import path from "node:path";
import { setImmediate as nextTurn } from "node:timers/promises";
import { Effect, Layer, ManagedRuntime } from "effect";
import { expect, it, vi } from "vitest";
import {
  advance,
  fakeClient,
  track,
} from "../tests/integration/application-database-close-fixture.js";
import { unusedCanonicalApplication as createUnusedCanonicalApplication } from "../tests/integration/canonical-runtime-application-fixture.js";
import { switchDeferred } from "../tests/integration/project-storage-runtime-fixture.js";
import { silentRequestDiagnostics } from "../tests/integration/request-diagnostics-fixture.js";
import {
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type ProjectStorageApplication,
  type StopHarnessRuntime,
  startHarnessRuntime,
  type WorkspaceApplication,
} from "./index.js";
import {
  ApplicationDatabaseCloseUnconfirmed,
  createApplicationDatabaseAuthority,
} from "./storage/application-database-authority.js";

const unusedRoot = path.join(os.tmpdir(), "slopstop-runtime-shutdown-unit-unused");

async function unexpectedCanonicalSwitch(): Promise<never> {
  throw new Error("Unexpected canonical Project switch in this fixture.");
}

function unusedCanonicalApplication() {
  return createUnusedCanonicalApplication(unexpectedCanonicalSwitch);
}

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
    requestDiagnostics: silentRequestDiagnostics,
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

  expect(calls).toEqual(["stopMessages", "stopNotifications", "canonicalProjectApplication.stop"]);
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

it("shares one stop promise when a cleanup callback re-enters stop", async () => {
  const calls: string[] = [];
  let reentered: Promise<void> | undefined;
  let stop: StopHarnessRuntime | undefined;
  const stopMessages = vi.fn(() => calls.push("stopMessages"));
  const stopNotifications = vi.fn(() => calls.push("stopNotifications"));
  const stopCanonical = vi.fn(async () => {
    calls.push("canonicalProjectApplication.stop");
    reentered = stop?.();
  });
  const stopProjectStorage = vi.fn(async () => {
    calls.push("projectStorageApplication.stop");
  });
  stop = startHarnessRuntime({
    requestDiagnostics: silentRequestDiagnostics,
    transport: { send: () => undefined, subscribe: () => stopMessages },
    canonicalProjectApplication: { ...unusedCanonicalApplication(), stop: stopCanonical },
    workspaceApplication: {
      ...createUnavailableWorkspaceApplication(silentRequestDiagnostics),
      subscribe: () => stopNotifications,
    },
    projectStorageApplication: {
      ...createUnavailableProjectStorageApplication(silentRequestDiagnostics),
      stop: stopProjectStorage,
    },
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });

  const firstStop = stop();

  expect(reentered).toBe(firstStop);
  expect(calls).toEqual(["stopMessages", "stopNotifications", "canonicalProjectApplication.stop"]);
  await expect(firstStop).resolves.toBeUndefined();
  expect(stopMessages).toHaveBeenCalledOnce();
  expect(stopNotifications).toHaveBeenCalledOnce();
  expect(stopCanonical).toHaveBeenCalledOnce();
  expect(stopProjectStorage).toHaveBeenCalledOnce();
});

/** A runtime whose unsubscribes and owner stops are the given fakes; the canonical stop is recorded. */
function cleanupRecordingRuntime(
  calls: string[],
  stops: Readonly<{
    stopMessages: () => unknown;
    stopNotifications: () => unknown;
    storageStop: () => Promise<void>;
  }>,
) {
  return startHarnessRuntime({
    requestDiagnostics: silentRequestDiagnostics,
    transport: { send: () => undefined, subscribe: () => () => void stops.stopMessages() },
    canonicalProjectApplication: {
      ...unusedCanonicalApplication(),
      stop: async () => {
        calls.push("canonicalProjectApplication.stop");
      },
    },
    workspaceApplication: {
      ...createUnavailableWorkspaceApplication(silentRequestDiagnostics),
      subscribe: () => () => void stops.stopNotifications(),
    },
    projectStorageApplication: {
      ...createUnavailableProjectStorageApplication(silentRequestDiagnostics),
      stop: stops.storageStop,
    },
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });
}

it("retains synchronous shutdown failures while attempting every cleanup", async () => {
  const calls: string[] = [];
  const intakeFailure = new Error("private intake shutdown failure");
  const storageFailure = new Error("private Storage shutdown failure");
  const stopMessages = vi.fn(() => {
    calls.push("stopMessages");
    throw intakeFailure;
  });
  const stopNotifications = vi.fn(() => calls.push("stopNotifications"));
  const stop = cleanupRecordingRuntime(calls, {
    stopMessages,
    stopNotifications,
    storageStop: () => {
      calls.push("projectStorageApplication.stop");
      throw storageFailure;
    },
  });
  let firstStop: Promise<void> | undefined;

  expect(() => {
    firstStop = stop();
  }).not.toThrow();
  if (firstStop === undefined) {
    throw new Error("Runtime stop did not return a Promise.");
  }

  expect(stop()).toBe(firstStop);
  expect(calls).toEqual(["stopMessages", "stopNotifications", "canonicalProjectApplication.stop"]);
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

it("retains a throwing workspace unsubscribe as a stop failure while attempting every cleanup", async () => {
  const calls: string[] = [];
  const notificationsFailure = new Error("private workspace unsubscribe failure");
  const stopMessages = vi.fn(() => calls.push("stopMessages"));
  const stopNotifications = vi.fn(() => {
    calls.push("stopNotifications");
    throw notificationsFailure;
  });
  const stop = cleanupRecordingRuntime(calls, {
    stopMessages,
    stopNotifications,
    storageStop: async () => {
      calls.push("projectStorageApplication.stop");
    },
  });
  let stopping: Promise<void> | undefined;

  expect(() => {
    stopping = stop();
  }).not.toThrow();
  await expect(stopping).rejects.toBe(notificationsFailure);
  expect(calls).toEqual([
    "stopMessages",
    "stopNotifications",
    "canonicalProjectApplication.stop",
    "projectStorageApplication.stop",
  ]);
  expect(stopMessages).toHaveBeenCalledOnce();
  expect(stopNotifications).toHaveBeenCalledOnce();
});

function applicationDatabaseShutdownFixture(canonicalStop: () => Promise<void>) {
  const calls: string[] = [];
  // Recorded apart from `calls`, so the exact shutdown order pins stay unchanged.
  const withhold = vi.fn();
  const listingRelease = switchDeferred<void>();
  const stop = startHarnessRuntime({
    requestDiagnostics: silentRequestDiagnostics,
    transport: { send: () => undefined, subscribe: () => () => undefined },
    canonicalProjectApplication: { ...unusedCanonicalApplication(), stop: canonicalStop },
    projectStorageApplication: {
      ...createUnavailableProjectStorageApplication(silentRequestDiagnostics),
      stop: async () => {
        calls.push("storage");
      },
    },
    projectListing: {
      list: async () => {
        throw new Error("Listing is not used by this test.");
      },
      stop: Effect.promise(async () => {
        calls.push("listing-started");
        await listingRelease.promise;
        calls.push("listing");
      }),
    },
    applicationDatabase: {
      stop: async () => {
        calls.push("application-database");
      },
      withhold,
    },
    workspaceApplication: createUnavailableWorkspaceApplication(silentRequestDiagnostics),
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });
  return { calls, stop, withhold, releaseListing: () => listingRelease.resolve() };
}

it("stops the shared application database only after Storage and listing have stopped", async () => {
  const f = applicationDatabaseShutdownFixture(async () => undefined);
  const stopping = f.stop();
  await nextTurn();
  expect(f.calls).toEqual(["listing-started", "storage"]);
  f.releaseListing();
  await stopping;
  expect(f.calls).toEqual(["listing-started", "storage", "listing", "application-database"]);
});

it("keeps the shared application database when canonical release withholds Storage", async () => {
  const failure = new Error("canonical release failed");
  const f = applicationDatabaseShutdownFixture(async () => {
    throw failure;
  });
  const stopping = f.stop();
  f.releaseListing();
  await expect(stopping).rejects.toBe(failure);
  expect(f.calls).toEqual(["listing-started", "listing"]);
  expect(f.withhold).toHaveBeenCalledOnce();
});

it.each([
  { name: "alone", listingFailure: undefined },
  { name: "with a listing failure", listingFailure: new Error("listing stop failed") },
])("reports an unconfirmed application database close: $name", async ({ listingFailure }) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const authority = createApplicationDatabaseAuthority({
      applicationStorageRoot: unusedRoot,
      migrationResourcesRoot: unusedRoot,
      closeDeadlineMs: 50,
    });
    await authority.admitClient(fakeClient()).transaction("write");
    const databaseStopCalled = switchDeferred<void>();
    const stop = startHarnessRuntime({
      ...unusedRuntimeOptions(),
      projectListing: {
        list: async () => {
          throw new Error("Listing is not used by this test.");
        },
        stop: listingFailure === undefined ? Effect.void : Effect.fail(listingFailure),
      },
      applicationDatabase: {
        stop: () => {
          databaseStopCalled.resolve();
          return authority.stop();
        },
        withhold: () => authority.withhold(),
      },
    });
    const stopping = stop();
    const seen = track(stopping);
    await databaseStopCalled.promise;
    await advance(49);
    expect(seen.state).toBe("pending");
    await advance(1);
    expect(seen.state).toBe("rejected");
    const unconfirmed = await authority.stop().catch((error: unknown) => error);
    expect(unconfirmed).toBeInstanceOf(ApplicationDatabaseCloseUnconfirmed);
    if (listingFailure === undefined) expect(seen.value).toBe(unconfirmed);
    else {
      expect(seen.value).toBeInstanceOf(AggregateError);
      const errors = (seen.value as AggregateError).errors;
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBe(listingFailure);
      expect(errors[1]).toBe(unconfirmed);
    }
  } finally {
    vi.useRealTimers();
  }
});

/** The runtime options a shutdown row does not read: a silent port and unused applications. */
function unusedRuntimeOptions() {
  return {
    requestDiagnostics: silentRequestDiagnostics,
    transport: { send: () => undefined, subscribe: () => () => undefined },
    canonicalProjectApplication: unusedCanonicalApplication(),
    projectStorageApplication: createUnavailableProjectStorageApplication(silentRequestDiagnostics),
    workspaceApplication: createUnavailableWorkspaceApplication(silentRequestDiagnostics),
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  };
}

/** A runtime whose only cleanup is `listingStop`, run on `runtime` when one is given. */
function listingOnlyRuntime(
  listingStop: Effect.Effect<void, Error>,
  runtime?: ManagedRuntime.ManagedRuntime<never, never>,
) {
  return startHarnessRuntime({
    ...unusedRuntimeOptions(),
    projectListing: {
      list: async () => {
        throw new Error("Listing is not used by this test.");
      },
      stop: listingStop,
    },
    ...(runtime === undefined ? {} : { runtime }),
  });
}

/**
 * With `stop()` still pending, disposes `runtime`: the stop then rejects with the squashed
 * interruption, and a second `stop()` returns the same promise.
 */
async function expectStopInterruptedByDispose(
  stop: StopHarnessRuntime,
  runtime: Readonly<{ dispose(): Promise<void> }>,
  afterDispose: () => void = () => undefined,
) {
  const stopping = stop();
  const seen = track(stopping);
  await advance(0);
  expect(seen.state).toBe("pending");
  const disposing = track(runtime.dispose());
  await advance(0);
  expect(disposing.state).toBe("resolved");
  afterDispose();
  expect(seen.state).toBe("rejected");
  expect(seen.value).toBeInstanceOf(Error);
  expect(seen.value).toMatchObject({ message: "All fibers interrupted without error" });
  expect(stop()).toBe(stopping);
}

/** A process runtime over an empty Layer, built before the behaviour under test. */
function builtProcessRuntime() {
  const runtime = ManagedRuntime.make(Layer.empty);
  runtime.runSync(Effect.void);
  return runtime;
}

it("settles the stop when the process runtime is disposed during the program", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const calls: string[] = [];
    const runtime = builtProcessRuntime();
    const listingStop = Effect.sync(() => calls.push("listing-started")).pipe(
      Effect.andThen(Effect.never),
      Effect.onInterrupt(() => Effect.sync(() => calls.push("listing-interrupted"))),
    );
    const stop = listingOnlyRuntime(listingStop, runtime);
    await expectStopInterruptedByDispose(stop, runtime, () =>
      expect(calls).toEqual(["listing-started", "listing-interrupted"]),
    );
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  { runner: "default", runtime: () => undefined },
  { runner: "process runtime", runtime: builtProcessRuntime },
])("starts the listing stop in the caller's turn: $runner", async ({ runtime }) => {
  const calls: string[] = [];
  const processRuntime = runtime();
  const stop = listingOnlyRuntime(
    Effect.sync(() => {
      calls.push("listing-started");
    }),
    processRuntime,
  );
  const stopping = stop();
  expect(calls).toContain("listing-started");
  await stopping;
  await processRuntime?.dispose();
});

it("settles the stop when the process runtime is disposed while Storage stops", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const runtime = builtProcessRuntime();
    const stop = startHarnessRuntime({
      requestDiagnostics: silentRequestDiagnostics,
      transport: { send: () => undefined, subscribe: () => () => undefined },
      canonicalProjectApplication: { ...unusedCanonicalApplication(), holdsProject: () => false },
      projectStorageApplication: {
        ...createUnavailableProjectStorageApplication(silentRequestDiagnostics),
        stop: () => new Promise<void>(() => undefined),
      },
      runtime,
      workspaceApplication: createUnavailableWorkspaceApplication(silentRequestDiagnostics),
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    await expectStopInterruptedByDispose(stop, runtime);
  } finally {
    vi.useRealTimers();
  }
});

it("rejects a stop first called after the process runtime is disposed", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const runtime = builtProcessRuntime();
    const stopMessages = vi.fn();
    const stopNotifications = vi.fn();
    const stop = startHarnessRuntime({
      requestDiagnostics: silentRequestDiagnostics,
      transport: { send: () => undefined, subscribe: () => stopMessages },
      canonicalProjectApplication: unusedCanonicalApplication(),
      projectStorageApplication:
        createUnavailableProjectStorageApplication(silentRequestDiagnostics),
      projectListing: {
        list: async () => {
          throw new Error("Listing is not used by this test.");
        },
        stop: Effect.void,
      },
      runtime,
      workspaceApplication: {
        ...createUnavailableWorkspaceApplication(silentRequestDiagnostics),
        subscribe: () => stopNotifications,
      },
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    await runtime.dispose();
    const stopping = stop();
    const seen = track(stopping);
    await advance(0);
    expect(seen.state).toBe("rejected");
    expect(seen.value).toBe("ManagedRuntime disposed");
    expect(stopMessages).toHaveBeenCalledOnce();
    expect(stopNotifications).toHaveBeenCalledOnce();
    expect(stop()).toBe(stopping);
  } finally {
    vi.useRealTimers();
  }
});

it("leaves no unhandled rejection when a stop first called after the dispose meets a failing canonical stop", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  try {
    const runtime = builtProcessRuntime();
    const canonicalFailure = new Error("private canonical stop failure");
    // A plain function: a `vi.fn` spy tracks its settled result, which would handle the rejection.
    let canonicalStops = 0;
    const canonicalStop = () => {
      canonicalStops += 1;
      return Promise.reject(canonicalFailure);
    };
    const stop = startHarnessRuntime({
      requestDiagnostics: silentRequestDiagnostics,
      transport: { send: () => undefined, subscribe: () => () => undefined },
      canonicalProjectApplication: {
        ...unusedCanonicalApplication(),
        holdsProject: () => false,
        stop: canonicalStop,
      },
      projectStorageApplication:
        createUnavailableProjectStorageApplication(silentRequestDiagnostics),
      projectListing: {
        list: async () => {
          throw new Error("Listing is not used by this test.");
        },
        stop: Effect.void,
      },
      runtime,
      workspaceApplication: createUnavailableWorkspaceApplication(silentRequestDiagnostics),
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    await runtime.dispose();
    const seen = track(stop());
    await advance(0);
    await nextTurn();
    expect(seen).toMatchObject({ state: "rejected", value: "ManagedRuntime disposed" });
    expect(canonicalStops).toBe(1);
    expect(rejections).toEqual([]);
  } finally {
    process.off("unhandledRejection", onRejection);
    vi.useRealTimers();
  }
});
