import { writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { UntypedRejection } from "../../src/effect-rejection.js";
import type { LocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { createApplicationClientManager } from "../../src/storage/project-storage-application-client.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageUnavailableError,
} from "../../src/storage/project-storage-errors.js";

const { unlinkMock } = vi.hoisted(() => ({ unlinkMock: vi.fn() }));

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  unlink: unlinkMock,
}));

afterEach(() => {
  unlinkMock.mockReset();
});

function createClient(close: () => Promise<void>): LocalLibsqlClient {
  const unexpectedOperation = async (): Promise<never> => {
    throw new Error("Unexpected application client operation.");
  };
  return {
    execute: unexpectedOperation,
    transaction: unexpectedOperation,
    close,
  };
}

it("waits for pending initialization before stopping its retained client", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-stop-"));
  const databasePath = path.join(root, "application.db");
  await writeFile(databasePath, "");
  let releaseInitialization: (() => void) | undefined;
  let markInitializationStarted: (() => void) | undefined;
  const initializationStarted = new Promise<void>((resolve) => {
    markInitializationStarted = resolve;
  });
  const initializationReleased = new Promise<void>((resolve) => {
    releaseInitialization = resolve;
  });
  const close = vi.fn(async () => undefined);
  const client = createClient(close);
  const manager = createApplicationClientManager({
    applicationDatabasePath: databasePath,
    applicationStorageRoot: root,
    // Schema authority is outside these client-lifecycle cases.
    ensureInitialized: async () => "present",
    createClient: () => client,
    initialize: async () => {
      markInitializationStarted?.();
      await initializationReleased;
    },
  });
  const opening = manager.existing();
  const stopping = manager.stop();

  try {
    await initializationStarted;
    expect(
      await Promise.race([
        stopping.then(() => "settled" as const),
        new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 50)),
      ]),
    ).toBe("pending");
    releaseInitialization?.();
    await expect(opening).resolves.toBe(client);
    await expect(stopping).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  } finally {
    releaseInitialization?.();
    await Promise.allSettled([opening, stopping]);
    if (close.mock.calls.length === 0) await close();
    await rm(root, { recursive: true, force: true });
  }
});

it("preserves typed unavailability from application initialization", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-unavailable-"));
  const databasePath = path.join(root, "application.db");
  await writeFile(databasePath, "");
  const failure = new ProjectStorageUnavailableError("Project Storage authority is unavailable.");
  const manager = createApplicationClientManager({
    applicationDatabasePath: databasePath,
    applicationStorageRoot: root,
    // Schema authority is outside these client-lifecycle cases.
    ensureInitialized: async () => "present",
    createClient: () => createClient(async () => undefined),
    initialize: async () => {
      throw failure;
    },
  });

  try {
    await expect(manager.existing()).rejects.toBe(failure);
  } finally {
    await manager.stop();
    await rm(root, { recursive: true, force: true });
  }
});

it("keeps failed new-authority cleanup with the initialization failure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-cleanup-"));
  const databasePath = path.join(root, "application.db");
  const initializationFailure = Object.assign(new Error("application access failed"), {
    code: "EACCES",
  });
  const cleanupFailure = new Error("application cleanup failed");
  unlinkMock.mockRejectedValueOnce(cleanupFailure);
  const manager = createApplicationClientManager({
    applicationDatabasePath: databasePath,
    applicationStorageRoot: root,
    // Schema authority is outside these client-lifecycle cases.
    ensureInitialized: async () => "present",
    createClient: () => {
      writeFileSync(databasePath, "");
      return createClient(async () => undefined);
    },
    initialize: async () => {
      throw initializationFailure;
    },
  });

  let failure: unknown;
  try {
    await manager.mutable();
  } catch (error) {
    failure = error;
  } finally {
    await manager.stop();
    await rm(root, { recursive: true, force: true });
  }

  expect(failure).toBeInstanceOf(ProjectStorageApplicationClientInitializationError);
  if (!(failure instanceof ProjectStorageApplicationClientInitializationError)) {
    throw new Error("Expected application client initialization failure.");
  }
  expect(failure.cause).toBeInstanceOf(AggregateError);
  if (!(failure.cause instanceof AggregateError)) {
    throw new Error("Expected application initialization and cleanup aggregate.");
  }
  expect(failure.cause.errors).toEqual([initializationFailure, cleanupFailure]);
});

/** A manager on an existing empty database whose initialization waits for `release`, then fails. */
async function gatedFailingManager(prefix: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const databasePath = path.join(root, "application.db");
  await writeFile(databasePath, "");
  const failure = new ProjectStorageUnavailableError("Project Storage authority is unavailable.");
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const close = vi.fn(async () => undefined);
  const manager = createApplicationClientManager({
    applicationDatabasePath: databasePath,
    applicationStorageRoot: root,
    // Schema authority is outside these client-lifecycle cases.
    ensureInitialized: async () => "present",
    createClient: () => createClient(close),
    initialize: async () => {
      markStarted();
      await released;
      throw failure;
    },
  });
  return { root, failure, release, started, close, manager };
}

it("rejects a caller joining a failing initialization with that initialization's failure", async () => {
  const f = await gatedFailingManager("slopstop-application-join-failure-");
  try {
    const first = f.manager.existing().catch((error: unknown) => error);
    await f.started;
    const second = f.manager.existing().catch((error: unknown) => error);
    f.release();
    expect(await first).toBe(f.failure);
    const joined = await second;
    expect(joined).not.toBeInstanceOf(UntypedRejection);
    expect(joined).toBe(f.failure);
  } finally {
    f.release();
    await rm(f.root, { recursive: true, force: true });
  }
});

it("rejects a stop awaiting a failing initialization with that failure, closing no client", async () => {
  const f = await gatedFailingManager("slopstop-application-stop-failure-");
  try {
    const opening = f.manager.existing().catch((error: unknown) => error);
    await f.started;
    const stopping = f.manager.stop().catch((error: unknown) => error);
    f.release();
    expect(await opening).toBe(f.failure);
    const stopped = await stopping;
    expect(stopped).not.toBeInstanceOf(UntypedRejection);
    expect(stopped).toBe(f.failure);
    // Only the failed initialization's own cleanup closes its client; the stop closes none.
    expect(f.close).toHaveBeenCalledOnce();
  } finally {
    f.release();
    await rm(f.root, { recursive: true, force: true });
  }
});
