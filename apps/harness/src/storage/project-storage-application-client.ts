import { unlink } from "node:fs/promises";
import type { LocalLibsqlClient } from "./local-libsql-worker-client.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import {
  lstatIfPresent,
  prepareApplicationDatabase,
} from "./project-storage-filesystem-authority.js";
import { isUnavailableStorageError, normalizeStorageError } from "./project-storage-node-errors.js";
import {
  ApplicationClientInitializationCloseError,
  initializeRetainedApplicationClient,
} from "./retained-application-client.js";

class ApplicationClientInitializationFailure extends Error {
  override readonly name = "ApplicationClientInitializationFailure";
}

export type ApplicationClientManager = Readonly<{
  existing(): Promise<LocalLibsqlClient | undefined>;
  mutable(): Promise<LocalLibsqlClient>;
  stop(): Promise<void>;
}>;

function emptyPlainFile(
  entry: Awaited<ReturnType<typeof lstatIfPresent>>,
): entry is Exclude<typeof entry, undefined> {
  return entry !== undefined && !entry.isSymbolicLink() && entry.isFile() && entry.size === 0;
}

async function cleanupFailedNewAuthority(input: {
  applicationDatabasePath: string;
  initializationError: unknown;
}): Promise<unknown> {
  try {
    const candidate = await lstatIfPresent({ targetPath: input.applicationDatabasePath });
    if (!emptyPlainFile(candidate)) return input.initializationError;
    await unlink(input.applicationDatabasePath);
    return input.initializationError;
  } catch (cleanupFailure) {
    return new AggregateError(
      [input.initializationError, cleanupFailure],
      "Project Storage application client initialization cleanup failed.",
    );
  }
}

function applicationClientInitializationFailure(cause: unknown): Error {
  return new ApplicationClientInitializationFailure(
    "Project Storage application client initialization failed.",
    { cause },
  );
}

async function rejectInitialization(input: {
  applicationDatabasePath: string;
  createIfMissing: boolean;
  existed: boolean;
  error: unknown;
}): Promise<never> {
  const shouldCleanup = [
    input.createIfMissing,
    !input.existed,
    !(input.error instanceof ApplicationClientInitializationCloseError),
  ].every(Boolean);
  const cause = shouldCleanup
    ? await cleanupFailedNewAuthority({
        applicationDatabasePath: input.applicationDatabasePath,
        initializationError: input.error,
      })
    : input.error;
  if (cause !== input.error) throw applicationClientInitializationFailure(cause);
  if (
    input.error instanceof ProjectStorageUnavailableError ||
    isUnavailableStorageError({ error: input.error })
  ) {
    throw input.error;
  }
  throw applicationClientInitializationFailure(cause);
}

export function createApplicationClientManager(input: {
  applicationDatabasePath: string;
  applicationStorageRoot: string;
  // Initializes application.db through its shared authority before a client is retained.
  ensureInitialized(createIfMissing: boolean): Promise<"absent" | "present">;
  createClient(): LocalLibsqlClient;
  initialize(client: LocalLibsqlClient): Promise<void>;
}): ApplicationClientManager {
  let applicationClient: LocalLibsqlClient | undefined;
  let initialization: Promise<LocalLibsqlClient | undefined> | undefined;
  let stopped = false;

  const initializeCandidate = async (
    createIfMissing: boolean,
  ): Promise<LocalLibsqlClient | undefined> => {
    const existed =
      (await lstatIfPresent({ targetPath: input.applicationDatabasePath })) !== undefined;
    const available = await prepareApplicationDatabase({
      applicationDatabasePath: input.applicationDatabasePath,
      applicationStorageRoot: input.applicationStorageRoot,
      createIfMissing,
    });
    if (!available) return undefined;
    if ((await input.ensureInitialized(createIfMissing)) === "absent") return undefined;
    try {
      return await initializeRetainedApplicationClient(
        input.createClient(),
        (retained) => {
          applicationClient = retained;
        },
        input.initialize,
      );
    } catch (error) {
      return rejectInitialization({
        applicationDatabasePath: input.applicationDatabasePath,
        createIfMissing,
        existed,
        error,
      });
    }
  };

  const acquire = async (createIfMissing: boolean): Promise<LocalLibsqlClient | undefined> => {
    if (stopped) throw new ProjectStorageUnavailableError("Project Storage registry is stopped.");
    if (initialization !== undefined) return initialization;
    if (applicationClient !== undefined) return applicationClient;
    const candidate = initializeCandidate(createIfMissing);
    initialization = candidate;
    try {
      return await candidate;
    } finally {
      if (initialization === candidate) initialization = undefined;
    }
  };

  const existing = async (): Promise<LocalLibsqlClient | undefined> => {
    try {
      return await acquire(false);
    } catch (error) {
      if (error instanceof ApplicationClientInitializationFailure) {
        throw new ProjectStorageApplicationClientInitializationError(
          "Project Storage application authority is invalid.",
          { cause: error.cause },
        );
      }
      normalizeStorageError({
        error,
        message: "Project Storage application authority is invalid.",
      });
    }
  };

  return {
    existing,
    mutable: async () => {
      const retained = await existing();
      if (retained !== undefined) return retained;
      try {
        const created = await acquire(true);
        if (created === undefined) {
          throw new ProjectStorageBrokenError(
            "Project Storage application authority was not created.",
          );
        }
        return created;
      } catch (error) {
        if (error instanceof ApplicationClientInitializationFailure) {
          throw new ProjectStorageApplicationClientInitializationError(
            "Project Storage application authority cannot be created.",
            { cause: error.cause },
          );
        }
        normalizeStorageError({
          error,
          message: "Project Storage application authority cannot be created.",
        });
      }
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await initialization;
      const retained = applicationClient;
      applicationClient = undefined;
      await retained?.close();
    },
  };
}
