import { writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
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
