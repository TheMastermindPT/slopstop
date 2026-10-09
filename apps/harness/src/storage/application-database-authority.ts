import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Deferred, Effect, Semaphore } from "effect";
import {
  ApplicationDatabaseFault,
  type ApplicationDatabaseMigrationFailures,
  firstRequiredApplicationMigration,
  migrateApplicationDatabase,
  missingWithWitnessFailure,
  requireForeignKeys,
} from "./application-database-migration.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";
import { ProjectStorageUnavailableError } from "./project-storage-errors.js";
import { lstatIfPresent, requirePlainEntry } from "./project-storage-filesystem-authority.js";
import { storageErrorCode } from "./project-storage-node-errors.js";
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
//
// The Promise interface is a deliberate boundary: its consumers (Storage, registration and
// listing owners) are still Promise code. Admission, initialization and stop drain run on
// Effect primitives behind it, with no coordination logic outside Effect. It goes away when
// those consumers become Effect programs and can use the primitives directly.
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

// Whether a missing database under a root that already holds entries is refused as a
// witness of lost state (the registry's path) or left to the caller's own checks (Storage's).
type RootWitnessPolicy = "refuse" | "ignore";

// The registry's path refuses a witnessed root and shares a fresh creation it starts, so
// later callers wait for it; Storage's path registers its own initialization beforehand.
type DecisionPolicy = Readonly<{
  createIfMissing: boolean;
  rootWitness: RootWitnessPolicy;
  share: boolean;
}>;

// An initialization in flight, completed with its exact outcome for every caller that joins.
// A fresh creation on the registry's path is registered while its decision holds the permit.
type Initialization = Deferred.Deferred<"absent" | "current", unknown>;

function publish(slot: Initialization, run: Promise<"absent" | "current">): void {
  void run.then(
    (state) => Deferred.doneUnsafe(slot, Effect.succeed(state)),
    (error: unknown) => Deferred.doneUnsafe(slot, Effect.fail(error)),
  );
}

function isEmptyPlainFile(entry: Awaited<ReturnType<typeof lstatIfPresent>>): boolean {
  if (entry === undefined || entry.isSymbolicLink()) return false;
  return entry.isFile() && entry.size === 0;
}

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
  const deciding = Semaphore.makeUnsafe(1);
  // Completed once, after stop, when no accepted work remains; every stop awaits it.
  const closed = Deferred.makeUnsafe<void>();
  let stopped = false;
  let accepted = 0;
  let createdEmpty = false;
  let observed = false;
  let initializing = 0;
  let initialization: Initialization | undefined;

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

  const missingWithWitness = () => new ApplicationDatabaseFault(missingWithWitnessFailure);

  const requireExistingFile = async (): Promise<void> => {
    if ((await lstatIfPresent({ targetPath: applicationDatabasePath })) === undefined) {
      throw missingWithWitness();
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

  // Confirms an uncertain migration commit on a replacement client and returns it; the
  // original migration error stands when the schema is still not current.
  const verifyUncertainCommit = async (migrationError: unknown): Promise<LocalLibsqlClient> => {
    await requireExistingFile();
    const client = openClient();
    try {
      await requireForeignKeys(client);
      await withWriteTransaction(client, async (transaction) => {
        const remaining = await firstRequiredApplicationMigration(transaction, false);
        if (remaining !== null) throw migrationError;
      });
      return client;
    } catch (error) {
      await client.close();
      throw error;
    }
  };

  // Brings the schema current on an admitted client and returns the client to keep using;
  // an uncertain migration commit is verified on a replacement client. Closes on failure.
  const migrateOn = async (opened: LocalLibsqlClient): Promise<LocalLibsqlClient> => {
    let client: LocalLibsqlClient | undefined = opened;
    try {
      await requireForeignKeys(opened);
      const migration = await migrateApplicationDatabase(opened, {
        migrationResourcesRoot: input.migrationResourcesRoot,
        fresh: createdEmpty,
        failures: input.failures,
      });
      if (migration.status === "failed") {
        if (migration.commit !== "uncertain") throw migration.error;
        await opened.close();
        client = undefined;
        client = await verifyUncertainCommit(migration.error);
      }
      createdEmpty = false;
      observed = true;
      return client;
    } catch (error) {
      await client?.close();
      throw error;
    }
  };

  // A missing database under a root that already holds entries is a witness of lost state,
  // unless those entries are this authority's own fresh creation still in flight.
  const refuseWitnessedRoot = async (): Promise<void> => {
    if (createdEmpty) return;
    const entries = await readdir(applicationStorageRoot).catch((error: unknown) => {
      if (storageErrorCode({ error }) === "ENOENT") return [];
      throw error;
    });
    if (entries.length > 0) throw missingWithWitness();
  };

  const createMissing = async (
    policy: DecisionPolicy,
  ): Promise<"present" | "created" | Initialization> => {
    if (policy.rootWitness === "refuse") await refuseWitnessedRoot();
    if (createdEmpty) return "present";
    await mkdir(applicationStorageRoot, { recursive: true });
    // Its client creates the file lazily: a fresh database still being created by this
    // authority is not yet observed, so concurrent initializers must not see a witness.
    createdEmpty = true;
    if (!policy.share) return "created";
    const creation = Deferred.makeUnsafe<"absent" | "current", unknown>();
    initialization = creation;
    return creation;
  };

  // An open-only registry caller that decides while a registered creation is still in
  // flight waits for it instead of answering absent.
  const missingWithoutCreating = (policy: DecisionPolicy): "absent" | "join" =>
    policy.share && createdEmpty && initialization !== undefined ? "join" : "absent";

  // Applies the caller's missing-file policy before any client can create the file. One
  // decision at a time, so a concurrent caller sees either no creation or a registered one.
  const decideMissingFile = async (
    policy: DecisionPolicy,
  ): Promise<"absent" | "join" | "present" | "created" | Initialization> => {
    if (stopped) throw stoppedError();
    if ((await lstatIfPresent({ targetPath: applicationDatabasePath })) !== undefined) {
      observed = true;
      return "present";
    }
    // A database this authority already observed must never be recreated silently.
    if (observed) throw missingWithWitness();
    if (!policy.createIfMissing) return missingWithoutCreating(policy);
    return createMissing(policy);
  };
  const prepare = async (policy: DecisionPolicy) => {
    await Effect.runPromise(Semaphore.take(deciding, 1));
    try {
      return await decideMissingFile(policy);
    } finally {
      Effect.runSync(Semaphore.release(deciding, 1));
    }
  };

  // A fresh initialization that fails rolls back, leaving the empty file its client created.
  // The sole initializer removes that file (never one with content) so the next start
  // initializes again; a failed removal is reported as its own failure. With another
  // initializer still in flight, the creation (and its exemption) stays with that one.
  const discardFailedCreation = async (error: unknown): Promise<unknown> => {
    if (!createdEmpty || initializing !== 1) return error;
    // The creation is no longer in flight, so its witness exemption ends with it.
    createdEmpty = false;
    try {
      if (isEmptyPlainFile(await lstatIfPresent({ targetPath: applicationDatabasePath }))) {
        await unlink(applicationDatabasePath);
      }
      return error;
    } catch (cleanup) {
      return new AggregateError(
        [error, cleanup],
        "Application database initialization cleanup failed.",
      );
    }
  };

  const initializeOnNewClient = async (): Promise<LocalLibsqlClient> => {
    initializing += 1;
    try {
      return await migrateOn(openClient());
    } catch (error) {
      throw await discardFailedCreation(error);
    } finally {
      initializing -= 1;
    }
  };

  const initialize = async (createIfMissing: boolean): Promise<"absent" | "current"> => {
    const decision = await prepare({ createIfMissing, rootWitness: "ignore", share: false });
    if (decision === "absent") return "absent";
    const client = await initializeOnNewClient();
    await client.close();
    return "current";
  };

  // A caller that finds an initialization in flight awaits it; it then proceeds on its own
  // only when that one found no database and this caller may create it. With nothing in
  // flight it answers at once, so the caller registers its own with no pause in between.
  const joinInFlight = (
    createIfMissing: boolean,
  ): Promise<"absent" | "current" | undefined> | undefined => {
    const inFlight = initialization;
    if (inFlight === undefined) return undefined;
    return Effect.runPromise(Deferred.await(inFlight)).then((joined) =>
      joined === "current" || !createIfMissing ? joined : undefined,
    );
  };

  // Opens the creation this caller registered and completes it for its joiners.
  const openShared = async (creation: Initialization): Promise<LocalLibsqlClient> => {
    const opening = initializeOnNewClient();
    publish(
      creation,
      opening.then(() => "current" as const),
    );
    try {
      return await opening;
    } finally {
      if (initialization === creation) initialization = undefined;
    }
  };

  const openOnRegistryPath = async (
    createIfMissing: boolean,
  ): Promise<LocalLibsqlClient | undefined> => {
    if ((await joinInFlight(createIfMissing)) === "absent") return undefined;
    const decision = await prepare({ createIfMissing, rootWitness: "refuse", share: true });
    if (decision === "join") return openOnRegistryPath(createIfMissing);
    if (decision === "absent") return undefined;
    if (typeof decision === "object") return openShared(decision);
    return initializeOnNewClient();
  };

  const sharing = async (run: Promise<"absent" | "current">): Promise<"absent" | "current"> => {
    const slot = Deferred.makeUnsafe<"absent" | "current", unknown>();
    initialization = slot;
    publish(slot, run);
    try {
      return await run;
    } finally {
      if (initialization === slot) initialization = undefined;
    }
  };

  return {
    applicationDatabasePath,
    admitClient,
    ensureCurrent: async ({ createIfMissing }) => {
      const end = accept();
      try {
        const joining = joinInFlight(createIfMissing);
        const joined = joining === undefined ? undefined : await joining;
        if (joined !== undefined) return joined;
        return await sharing(initialize(createIfMissing));
      } finally {
        end();
      }
    },
    // The registry's path: a missing database under a root that holds entries is refused.
    openCurrent: async ({ createIfMissing }) => {
      const end = accept();
      try {
        return await openOnRegistryPath(createIfMissing);
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
