import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Deferred, Effect, Semaphore } from "effect";
import {
  ApplicationDatabaseFault,
  type ApplicationDatabaseMigrationFailures,
  firstRequiredApplicationMigration,
  migrateApplicationDatabase,
  requireForeignKeys,
} from "./application-database-migration.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";
import { ProjectStorageUnavailableError } from "./project-storage-errors.js";
import { lstatIfPresent, requirePlainEntry } from "./project-storage-filesystem-authority.js";
import { withWriteTransaction } from "./project-storage-transaction.js";

// One per installation application database and harness. It owns schema initialization and
// admits one write transaction at a time. Callers await admission in their own async code,
// before BEGIN is posted, so the serial libSQL worker never runs a BEGIN that waits on a
// COMMIT queued behind it. It does not coordinate other processes using the same file.
//
// Read policy, as observed rather than chosen: application.db is not configured for WAL
// (ADR 0001 names WAL), so SQLite uses its default rollback journal. Every write transaction
// is BEGIN IMMEDIATE and this harness's connections share the one application-pool worker,
// which executes one request at a time, so a single non-transactional read issued through
// that worker never overlaps another of its connections' COMMIT. External connections are
// not covered; consistent multi-statement reads must run inside an admitted transaction.
export type ApplicationDatabaseAuthority = Readonly<{
  applicationDatabasePath: string;
  admitClient(client: LocalLibsqlClient): LocalLibsqlClient;
  ensureCurrent(input: Readonly<{ createIfMissing: boolean }>): Promise<"absent" | "current">;
  // Same initialization on a new admitted client that the caller then owns and closes.
  openCurrent(
    input: Readonly<{ createIfMissing: boolean }>,
  ): Promise<LocalLibsqlClient | undefined>;
  stop(): Promise<void>;
}>;

function stoppedError(): ProjectStorageUnavailableError {
  return new ProjectStorageUnavailableError("Project Storage application database is stopped.");
}

function admittedTransaction(
  inner: LocalLibsqlTransaction,
  release: () => void,
): LocalLibsqlTransaction {
  const releaseWhenClosed = () => {
    if (inner.closed) release();
  };
  return {
    get closed() {
      return inner.closed;
    },
    execute: (statement, args) => inner.execute(statement, args),
    // A failed commit stays admitted: its outcome is uncertain until rollback or close.
    commit: async () => {
      await inner.commit();
      releaseWhenClosed();
    },
    rollback: async () => {
      try {
        await inner.rollback();
      } finally {
        releaseWhenClosed();
      }
    },
    // Released only after the worker confirms termination; a failed close keeps the lease.
    close: async () => {
      try {
        await inner.close();
      } finally {
        releaseWhenClosed();
      }
    },
  };
}

export function createApplicationDatabaseAuthority(
  input: Readonly<{
    applicationStorageRoot: string;
    migrationResourcesRoot: string;
    failures?: ApplicationDatabaseMigrationFailures | undefined;
    // Opens a raw client for the authority's own initialization; defaults to the worker.
    openClient?: ((databasePath: string) => LocalLibsqlClient) | undefined;
  }>,
): ApplicationDatabaseAuthority {
  const applicationStorageRoot = path.resolve(input.applicationStorageRoot);
  const applicationDatabasePath = path.join(applicationStorageRoot, "application.db");
  const permits = Semaphore.makeUnsafe(1);
  // Completed once, after stop, when no accepted work remains; every stop awaits it.
  const closed = Deferred.makeUnsafe<void>();
  let stopped = false;
  let accepted = 0;
  let createdEmpty = false;
  let observed = false;
  let initialization: Promise<"absent" | "current"> | undefined;

  // Accepted work: queued or held admissions and initializations. Each ends exactly once.
  const accept = (): (() => void) => {
    if (stopped) throw stoppedError();
    accepted += 1;
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      accepted -= 1;
      if (stopped && accepted === 0) Deferred.doneUnsafe(closed, Effect.void);
    };
  };

  const admit = async (): Promise<() => void> => {
    const end = accept();
    try {
      await Effect.runPromise(Semaphore.take(permits, 1));
    } catch (error) {
      end();
      throw error;
    }
    if (stopped) {
      Effect.runSync(Semaphore.release(permits, 1));
      end();
      throw stoppedError();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      Effect.runSync(Semaphore.release(permits, 1));
      end();
    };
  };

  const admitClient = (client: LocalLibsqlClient): LocalLibsqlClient => {
    const leases = new Set<() => void>();
    return {
      execute: (statement, args) => client.execute(statement, args),
      // The worker closes every transaction of a client it confirms closed; a failed client
      // close keeps their leases because their termination is unconfirmed.
      close: async () => {
        await client.close();
        for (const release of [...leases]) release();
      },
      transaction: async (mode) => {
        const admitted = await admit();
        const release = () => {
          leases.delete(release);
          admitted();
        };
        leases.add(release);
        try {
          return admittedTransaction(await client.transaction(mode), release);
        } catch (error) {
          release();
          throw error;
        }
      },
    };
  };

  const openRawClient =
    input.openClient ??
    ((databasePath: string) => createWorkerLocalLibsqlClient(databasePath, "application"));
  const openClient = () => admitClient(openRawClient(applicationDatabasePath));

  const requireExistingFile = async (): Promise<void> => {
    if ((await lstatIfPresent({ targetPath: applicationDatabasePath })) === undefined) {
      throw new ApplicationDatabaseFault({
        status: "pending-recovery",
        code: "REGISTRY_MISSING_WITH_WITNESS",
      });
    }
    await requirePlainEntry({
      entryPath: applicationStorageRoot,
      kind: "directory",
      message: "Registration root is invalid.",
    });
    await requirePlainEntry({
      entryPath: applicationDatabasePath,
      kind: "file",
      message: "Registration registry is invalid.",
    });
  };

  // Brings the schema current on an admitted client and returns the client to keep using;
  // an uncertain migration commit is verified on a replacement client. Closes on failure.
  const migrateOn = async (opened: LocalLibsqlClient): Promise<LocalLibsqlClient> => {
    let client: LocalLibsqlClient | undefined = opened;
    try {
      await requireForeignKeys(client);
      const migration = await migrateApplicationDatabase(client, {
        migrationResourcesRoot: input.migrationResourcesRoot,
        fresh: createdEmpty,
        failures: input.failures,
      });
      if (migration.status === "failed") {
        if (migration.commit !== "uncertain") throw migration.error;
        await client.close();
        client = undefined;
        await requireExistingFile();
        client = openClient();
        await requireForeignKeys(client);
        await withWriteTransaction(client, async (transaction) => {
          const remaining = await firstRequiredApplicationMigration(transaction, false);
          if (remaining !== null) throw migration.error;
        });
      }
      createdEmpty = false;
      observed = true;
      return client;
    } catch (error) {
      await client?.close();
      throw error;
    }
  };

  // Applies the caller's missing-file policy before any client can create the file.
  const prepare = async (createIfMissing: boolean): Promise<"absent" | "present"> => {
    if (stopped) throw stoppedError();
    if ((await lstatIfPresent({ targetPath: applicationDatabasePath })) === undefined) {
      // A database this authority already observed must never be recreated silently.
      if (observed) {
        throw new ApplicationDatabaseFault({
          status: "pending-recovery",
          code: "REGISTRY_MISSING_WITH_WITNESS",
        });
      }
      if (!createIfMissing) return "absent";
      await mkdir(applicationStorageRoot, { recursive: true });
      // Its client creates the file lazily: a fresh database still being created by this
      // authority is not yet observed, so concurrent initializers must not see a witness.
      createdEmpty = true;
      return "present";
    }
    observed = true;
    return "present";
  };

  const initialize = async (createIfMissing: boolean): Promise<"absent" | "current"> => {
    if ((await prepare(createIfMissing)) === "absent") return "absent";
    const client = await migrateOn(openClient());
    await client.close();
    return "current";
  };

  return {
    applicationDatabasePath,
    admitClient,
    ensureCurrent: async ({ createIfMissing }) => {
      const end = accept();
      try {
        const inFlight = initialization;
        if (inFlight !== undefined) {
          const joined = await inFlight;
          if (joined === "current" || !createIfMissing) return joined;
        }
        const run = initialize(createIfMissing);
        initialization = run;
        try {
          return await run;
        } finally {
          if (initialization === run) initialization = undefined;
        }
      } finally {
        end();
      }
    },
    openCurrent: async ({ createIfMissing }) => {
      const end = accept();
      try {
        if ((await prepare(createIfMissing)) === "absent") return undefined;
        return await migrateOn(openClient());
      } finally {
        end();
      }
    },
    stop: async () => {
      stopped = true;
      if (accepted === 0) Deferred.doneUnsafe(closed, Effect.void);
      await Effect.runPromise(Deferred.await(closed));
    },
  };
}
