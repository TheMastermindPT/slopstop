import { setImmediate as nextTurn } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import { unusedCanonicalApplication as createUnusedCanonicalApplication } from "../tests/integration/canonical-runtime-application-fixture.js";
import { switchDeferred } from "../tests/integration/project-storage-runtime-fixture.js";
import {
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type ProjectStorageApplication,
  type StopHarnessRuntime,
  startHarnessRuntime,
  type WorkspaceApplication,
} from "./index.js";

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
    transport: { send: () => undefined, subscribe: () => stopMessages },
    canonicalProjectApplication: { ...unusedCanonicalApplication(), stop: stopCanonical },
    workspaceApplication: {
      ...createUnavailableWorkspaceApplication(),
      subscribe: () => stopNotifications,
    },
    projectStorageApplication: {
      ...createUnavailableProjectStorageApplication(),
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

function applicationDatabaseShutdownFixture(canonicalStop: () => Promise<void>) {
  const calls: string[] = [];
  const listingRelease = switchDeferred<void>();
  const stop = startHarnessRuntime({
    transport: { send: () => undefined, subscribe: () => () => undefined },
    canonicalProjectApplication: { ...unusedCanonicalApplication(), stop: canonicalStop },
    projectStorageApplication: {
      ...createUnavailableProjectStorageApplication(),
      stop: async () => {
        calls.push("storage");
      },
    },
    projectListing: {
      list: async () => {
        throw new Error("Listing is not used by this test.");
      },
      stop: async () => {
        calls.push("listing-started");
        await listingRelease.promise;
        calls.push("listing");
      },
    },
    applicationDatabase: {
      stop: async () => {
        calls.push("application-database");
      },
    },
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });
  return { calls, stop, releaseListing: () => listingRelease.resolve() };
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
});
