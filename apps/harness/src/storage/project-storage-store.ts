import type {
  CanonicalDatabaseLineageId,
  OpenedStorageIdentity,
  ProjectId,
  ProjectStorageCloseRequest,
  ProjectStorageCloseResult,
  ProjectStorageCreateRequest,
  ProjectStorageCreateResult,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
  RuntimeDatabaseLineageId,
  StorageGenerationId,
  StorageId,
} from "@slopstop/protocol";
import { Deferred, Effect, Result } from "effect";
import type {
  ProjectStorageActivationOutcome,
  ProjectStorageActivationSession,
  ProjectStorageOwner,
  ProjectStorageOwnerOutcome,
} from "../project-storage-application.js";
import { projectStorageCreateRequestFingerprintInput } from "./project-storage-create-request.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import {
  canonicalDatabaseFilename,
  runtimeDatabaseFilename,
  serializeProjectStorageManifest,
} from "./project-storage-manifest.js";
import {
  classifyProjectStorageOpening,
  type ProjectStorageOpenEvidence,
  type RetainedProjectStorageSession,
} from "./project-storage-opening.js";

export type PriorStateWitnessKind =
  | "registration-record"
  | "location-record"
  | "generation-record"
  | "project-root"
  | "repository-marker"
  | "writer-lease"
  | "manifest"
  | "generation-directory"
  | "canonical-database"
  | "runtime-database"
  | "canonical-wal"
  | "canonical-shm"
  | "canonical-rollback-journal"
  | "runtime-wal"
  | "runtime-shm"
  | "runtime-rollback-journal"
  | "local-snapshot"
  | "deletion-tombstone"
  | "unfinished-storage-operation";

export type CreationCheckpoint =
  | "before-staging-transaction"
  | "during-staging-transaction"
  | "after-staging-transaction"
  | "after-staging-directory"
  | "after-canonical-database"
  | "after-runtime-database"
  | "after-databases-closed"
  | "after-baselines-computed"
  | "after-manifest-written"
  | "after-staging-verified"
  | "before-generation-rename"
  | "after-generation-rename"
  | "after-renamed-verification"
  | "before-activation-transaction"
  | "during-activation-transaction"
  | "after-activation-transaction"
  | "before-created-result";

type AllocatedCreation = Readonly<{
  projectId: ProjectId;
  storageId: StorageId;
  locationId: string;
  generationId: StorageGenerationId;
  canonicalDatabaseLineageId: CanonicalDatabaseLineageId;
  runtimeDatabaseLineageId: RuntimeDatabaseLineageId;
  createRequestId: ProjectStorageCreateRequest["createRequestId"];
  createRequestFingerprint: string;
  createdAt: string;
}>;

type CreateInspection =
  | Readonly<{ status: "fresh" }>
  | Readonly<{ status: "active-replay"; identity: OpenedStorageIdentity }>
  | Readonly<{ status: "incomplete-request" }>
  | Readonly<{ status: "idempotency-conflict" }>
  | Readonly<{ status: "already-registered" }>;

type ProjectStorageGenerationPaths = Readonly<{
  root: string;
  canonicalDatabase: string;
  runtimeDatabase: string;
  manifest: string;
}>;

type ProjectStoragePaths = Readonly<{
  projectRoot: string;
  writerLease: string;
  staging: ProjectStorageGenerationPaths;
  active: ProjectStorageGenerationPaths;
}>;

type ClosedDatabaseBuild = Readonly<{
  state: "closed";
  formatVersion: number;
  schemaVersion: number;
  lastMigrationId: string;
}>;

type ProjectStorageLifecycle = Readonly<{
  assertRunning(): void;
}>;

type AdmittedProjectStorageSession = Readonly<{
  admissionOrder: number;
  session: RetainedProjectStorageSession;
}>;

// Completes once its admitted operation settles; fails only with a shutdown-relevant error.
type AdmittedOperationCompletion = Deferred.Deferred<void, unknown>;

type ProjectStorageOperationResult =
  | ProjectStorageOpenResult
  | ProjectStorageCreateResult
  | ProjectStorageCloseResult;

function shutdownOperationFailure(error: unknown): unknown {
  return error instanceof ProjectStorageBrokenError &&
    error.message === "Project Storage opening release failed." &&
    error.cause !== undefined
    ? error.cause
    : error;
}

function failureOf<A>(result: Result.Result<A, unknown>): unknown[] {
  return Result.isFailure(result) ? [result.failure] : [];
}

function attempt(operation: () => Promise<void>): Effect.Effect<unknown[]> {
  return Effect.map(
    Effect.result(Effect.tryPromise({ try: operation, catch: (error) => error })),
    failureOf,
  );
}

// Waits for every admitted operation, reporting failures in admission order.
function drainAdmittedOperations(
  admittedOperations: ReadonlyMap<number, AdmittedOperationCompletion>,
): Effect.Effect<unknown[]> {
  const ordered = [...admittedOperations.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, completion]) => completion);
  return Effect.map(
    Effect.forEach(ordered, (completion) => Effect.result(Deferred.await(completion)), {
      concurrency: "unbounded",
    }),
    (results) => results.flatMap(failureOf).map(shutdownOperationFailure),
  );
}

// Closes retained sessions one at a time in admission order, keeping every failure.
function closeSessionsInAdmissionOrder(
  sessions: readonly Readonly<{ admissionOrder: number; close(): Promise<void> }>[],
): Effect.Effect<unknown[]> {
  const ordered = [...sessions].sort((left, right) => left.admissionOrder - right.admissionOrder);
  return Effect.map(
    Effect.forEach(ordered, (session) => attempt(() => session.close())),
    (failures) => failures.flat(),
  );
}

export interface ProjectStorageStoreDependencies {
  readonly applicationVersion: string;
  readonly ids: Readonly<{
    storageId(): StorageId;
    locationId(): string;
    generationId(): StorageGenerationId;
    canonicalLineageId(): CanonicalDatabaseLineageId;
    runtimeLineageId(): RuntimeDatabaseLineageId;
  }>;
  readonly clock: Readonly<{ now(): string }>;
  readonly hashes: Readonly<{
    sha256Text(value: string): Promise<string>;
    sha256File(path: string): Promise<string>;
  }>;
  readonly paths: Readonly<{
    forCreation(projectId: ProjectId, generationId: StorageGenerationId): ProjectStoragePaths;
  }>;
  readonly registry: Readonly<{
    inspectCreate(
      request: ProjectStorageCreateRequest,
      createRequestFingerprint: string,
    ): Promise<CreateInspection>;
    prepareCreate(): Promise<void>;
    declareStaging(
      creation: AllocatedCreation,
      paths: ProjectStoragePaths,
    ): Promise<CreateInspection>;
    activate(creation: AllocatedCreation, paths: ProjectStoragePaths): Promise<void>;
    stop(): Promise<void>;
  }>;
  readonly witnesses: Readonly<{
    inspect(projectId: ProjectId): Promise<readonly PriorStateWitnessKind[]>;
  }>;
  readonly files: Readonly<{
    createDirectoryExclusive(path: string): Promise<void>;
    writeFileExclusive(path: string, contents: string): Promise<void>;
    readFile(path: string): Promise<string>;
    size(path: string): Promise<number>;
    renameAtomic(source: string, destination: string): Promise<void>;
  }>;
  readonly databases: Readonly<{
    createCanonical(path: string, creation: AllocatedCreation): Promise<ClosedDatabaseBuild>;
    createRuntime(path: string, creation: AllocatedCreation): Promise<ClosedDatabaseBuild>;
    verifySealed(paths: ProjectStorageGenerationPaths, creation: AllocatedCreation): Promise<void>;
  }>;
  readonly opening: Readonly<{
    inspect(projectId: ProjectId): Promise<ProjectStorageOpenEvidence>;
  }>;
  readonly failures: Readonly<{
    checkpoint(point: CreationCheckpoint): Promise<void>;
  }>;
  readonly locks: Readonly<{
    forCreate<Result>(operation: () => Promise<Result>): Promise<Result>;
    afterCreateDrain(operation: () => Promise<void>): Promise<void>;
    forProject<Result>(projectId: ProjectId, operation: () => Promise<Result>): Promise<Result>;
  }>;
}

async function runWhileRunning<Result>(
  lifecycle: ProjectStorageLifecycle,
  operation: () => Promise<Result>,
): Promise<Result> {
  lifecycle.assertRunning();
  const result = await operation();
  lifecycle.assertRunning();
  return result;
}

function blockedResult(
  request: ProjectStorageCreateRequest,
  reason: "prior-state-witness" | "already-registered" | "idempotency-conflict",
): ProjectStorageCreateResult {
  switch (reason) {
    case "prior-state-witness":
      return {
        status: "blocked",
        request,
        reason,
        diagnostic: {
          code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
          message: "Prior Project Storage state requires recovery.",
        },
      };
    case "already-registered":
      return {
        status: "blocked",
        request,
        reason,
        diagnostic: {
          code: "PROJECT_STORAGE_ALREADY_REGISTERED",
          message: "Project Storage is already registered.",
        },
      };
    case "idempotency-conflict":
      return {
        status: "blocked",
        request,
        reason,
        diagnostic: {
          code: "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT",
          message: "The create request identity is already bound to another request.",
        },
      };
  }
}

function inspectionResult(
  request: ProjectStorageCreateRequest,
  inspection: Exclude<CreateInspection, { status: "fresh" }>,
): ProjectStorageCreateResult {
  switch (inspection.status) {
    case "active-replay":
      return {
        status: "created",
        request,
        mode: "read-write",
        identity: inspection.identity,
      };
    case "incomplete-request":
      return blockedResult(request, "prior-state-witness");
    case "idempotency-conflict":
      return blockedResult(request, "idempotency-conflict");
    case "already-registered":
      return blockedResult(request, "already-registered");
  }
}

async function createFreshGeneration(
  request: ProjectStorageCreateRequest,
  fingerprint: string,
  dependencies: ProjectStorageStoreDependencies,
  lifecycle: ProjectStorageLifecycle,
): Promise<ProjectStorageCreateResult> {
  lifecycle.assertRunning();
  const creation: AllocatedCreation = {
    projectId: request.projectId,
    storageId: dependencies.ids.storageId(),
    locationId: dependencies.ids.locationId(),
    generationId: dependencies.ids.generationId(),
    canonicalDatabaseLineageId: dependencies.ids.canonicalLineageId(),
    runtimeDatabaseLineageId: dependencies.ids.runtimeLineageId(),
    createRequestId: request.createRequestId,
    createRequestFingerprint: fingerprint,
    createdAt: dependencies.clock.now(),
  };
  const identity: OpenedStorageIdentity = {
    storageId: creation.storageId,
    generationId: creation.generationId,
    canonicalDatabaseLineageId: creation.canonicalDatabaseLineageId,
    runtimeDatabaseLineageId: creation.runtimeDatabaseLineageId,
  };
  const paths = dependencies.paths.forCreation(request.projectId, creation.generationId);

  const declaration = await runWhileRunning(lifecycle, () =>
    dependencies.registry.declareStaging(creation, paths),
  );
  if (declaration.status !== "fresh") {
    return inspectionResult(request, declaration);
  }
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-staging-transaction"),
  );

  await runWhileRunning(lifecycle, () =>
    dependencies.files.createDirectoryExclusive(paths.staging.root),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-staging-directory"),
  );
  const canonical = await runWhileRunning(lifecycle, () =>
    dependencies.databases.createCanonical(paths.staging.canonicalDatabase, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-canonical-database"),
  );
  const runtime = await runWhileRunning(lifecycle, () =>
    dependencies.databases.createRuntime(paths.staging.runtimeDatabase, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-runtime-database"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-databases-closed"),
  );

  const [canonicalSize, canonicalHash, runtimeSize, runtimeHash] = await runWhileRunning(
    lifecycle,
    () =>
      Promise.all([
        dependencies.files.size(paths.staging.canonicalDatabase),
        dependencies.hashes.sha256File(paths.staging.canonicalDatabase),
        dependencies.files.size(paths.staging.runtimeDatabase),
        dependencies.hashes.sha256File(paths.staging.runtimeDatabase),
      ]),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-baselines-computed"),
  );
  const manifest = serializeProjectStorageManifest({
    manifestVersion: 1,
    projectId: request.projectId,
    storageId: creation.storageId,
    generationId: creation.generationId,
    provenance: {
      kind: "initial-create",
      createRequestId: request.createRequestId,
      sourceGenerationId: null,
      storageOperationId: null,
    },
    canonical: {
      kind: "canonical",
      databaseLineageId: creation.canonicalDatabaseLineageId,
      filename: canonicalDatabaseFilename,
      formatVersion: canonical.formatVersion,
      schemaVersion: canonical.schemaVersion,
      lastMigrationId: canonical.lastMigrationId,
      activationBaseline: {
        algorithm: "sha256",
        sizeBytes: canonicalSize,
        sha256: canonicalHash,
      },
    },
    runtime: {
      kind: "runtime",
      databaseLineageId: creation.runtimeDatabaseLineageId,
      filename: runtimeDatabaseFilename,
      adapterFormatVersion: runtime.formatVersion,
      adapterSchemaVersion: runtime.schemaVersion,
      adapterLastMigrationId: runtime.lastMigrationId,
      mastraMigrationHead: null,
      activationBaseline: {
        algorithm: "sha256",
        sizeBytes: runtimeSize,
        sha256: runtimeHash,
      },
    },
    projectSequence: 0,
    runtimeWaterline: 0,
    producingApplicationVersion: dependencies.applicationVersion,
    createdAt: creation.createdAt,
  });
  await runWhileRunning(lifecycle, () =>
    dependencies.files.writeFileExclusive(paths.staging.manifest, manifest),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-manifest-written"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.databases.verifySealed(paths.staging, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-staging-verified"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("before-generation-rename"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.files.renameAtomic(paths.staging.root, paths.active.root),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-generation-rename"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.databases.verifySealed(paths.active, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-renamed-verification"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("before-activation-transaction"),
  );
  await runWhileRunning(lifecycle, () => dependencies.registry.activate(creation, paths));
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-activation-transaction"),
  );
  await runWhileRunning(lifecycle, () => dependencies.failures.checkpoint("before-created-result"));

  return { status: "created", request, mode: "read-write", identity };
}

async function createProjectStorage(
  request: ProjectStorageCreateRequest,
  dependencies: ProjectStorageStoreDependencies,
  lifecycle: ProjectStorageLifecycle,
): Promise<ProjectStorageCreateResult> {
  return dependencies.locks.forCreate(async () => {
    const fingerprint = await runWhileRunning(lifecycle, () =>
      dependencies.hashes.sha256Text(projectStorageCreateRequestFingerprintInput(request)),
    );
    const inspection = await runWhileRunning(lifecycle, () =>
      dependencies.registry.inspectCreate(request, fingerprint),
    );
    if (inspection.status !== "fresh") {
      return inspectionResult(request, inspection);
    }
    const witnesses = await runWhileRunning(lifecycle, () =>
      dependencies.witnesses.inspect(request.projectId),
    );
    if (witnesses.length > 0) {
      return blockedResult(request, "prior-state-witness");
    }
    await runWhileRunning(lifecycle, () =>
      dependencies.failures.checkpoint("before-staging-transaction"),
    );
    await runWhileRunning(lifecycle, () => dependencies.registry.prepareCreate());
    const result = await createFreshGeneration(request, fingerprint, dependencies, lifecycle);
    lifecycle.assertRunning();
    return result;
  });
}

function activationFailure(error: unknown): ProjectStorageActivationOutcome {
  if (error instanceof ProjectStorageUnavailableError)
    return { status: "unavailable", message: error.message };
  if (error instanceof ProjectStorageBrokenError)
    return { status: "broken", message: error.message };
  throw error;
}

export function createProjectStorageOwner(
  dependencies: ProjectStorageStoreDependencies,
): ProjectStorageOwner {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  let registryClosed = false;
  let nextSessionAdmissionOrder = 0;
  let nextOperationAdmissionOrder = 0;
  const sessions = new Map<ProjectId, AdmittedProjectStorageSession>();
  const activationSessions = new Set<
    Readonly<{ admissionOrder: number; session: ProjectStorageActivationSession }>
  >();
  const admittedOperations = new Map<number, AdmittedOperationCompletion>();
  const ownerStoppedError = new ProjectStorageUnavailableError("Project Storage owner is stopped.");

  const lifecycle: ProjectStorageLifecycle = {
    assertRunning: () => {
      if (stopped) {
        throw ownerStoppedError;
      }
    },
  };

  const stoppedOutcome = () => ({
    status: "unavailable" as const,
    message: ownerStoppedError.message,
  });

  const closeSession = async (projectId: ProjectId): Promise<void> => {
    const admittedSession = sessions.get(projectId);
    await admittedSession?.session.close();
    if (sessions.get(projectId) === admittedSession) sessions.delete(projectId);
  };

  const operate = async (
    operation: () => Promise<ProjectStorageOperationResult>,
  ): Promise<ProjectStorageOwnerOutcome> => {
    try {
      const result = await operation();
      lifecycle.assertRunning();
      return { status: "ready", result };
    } catch (error) {
      if (error instanceof ProjectStorageApplicationClientInitializationError) {
        throw error;
      }
      if (error instanceof ProjectStorageUnavailableError) {
        return { status: "unavailable", message: error.message };
      }
      if (error instanceof ProjectStorageBrokenError) {
        return { status: "broken", message: error.message };
      }
      throw error;
    }
  };

  const trackAdmittedOperation = <Value>(operation: () => Promise<Value>): Promise<Value> => {
    const admissionOrder = nextOperationAdmissionOrder;
    nextOperationAdmissionOrder += 1;
    // Registered only once admitted: an operation that throws synchronously never started.
    const pendingOperation = operation();
    const completion: AdmittedOperationCompletion = Deferred.makeUnsafe<void, unknown>();
    admittedOperations.set(admissionOrder, completion);
    const settle = (outcome: Effect.Effect<void, unknown>) => {
      Deferred.doneUnsafe(completion, outcome);
      admittedOperations.delete(admissionOrder);
    };
    void pendingOperation.then(
      () => settle(Effect.void),
      // A refusal because the owner stopped is expected during shutdown, not a failure.
      (error: unknown) => settle(error === ownerStoppedError ? Effect.void : Effect.fail(error)),
    );
    return pendingOperation;
  };

  const retainActivation = (
    admissionOrder: number,
    session: ProjectStorageActivationSession,
  ): ProjectStorageActivationSession => {
    let closed = false;
    const retained = {
      admissionOrder,
      session: {
        ...session,
        close: async () => {
          if (closed) return;
          await session.close();
          closed = true;
          activationSessions.delete(retained);
        },
      },
    };
    activationSessions.add(retained);
    return retained.session;
  };

  const acquireActivation = async (
    request: ProjectStorageOpenRequest,
  ): Promise<ProjectStorageActivationOutcome> => {
    if (stopped) return stoppedOutcome();
    const admissionOrder = nextSessionAdmissionOrder++;
    try {
      return await trackAdmittedOperation(() =>
        dependencies.locks.forProject(request.projectId, async () => {
          lifecycle.assertRunning();
          const classified = classifyProjectStorageOpening(
            request,
            await dependencies.opening.inspect(request.projectId),
          );
          if (!("session" in classified)) {
            lifecycle.assertRunning();
            return { status: "not-registered", result: classified.result } as const;
          }
          let session: ProjectStorageActivationSession;
          if (classified.result.status === "opened") {
            const paths = dependencies.paths.forCreation(
              request.projectId,
              classified.result.identity.generationId,
            );
            session = {
              mode: "read-write",
              result: classified.result,
              canonicalDatabasePath: paths.active.canonicalDatabase,
              writerLeasePath: paths.writerLease,
              close: classified.session.close,
            };
          } else {
            session = {
              mode: "safe-mode",
              result: classified.result,
              close: classified.session.close,
            };
          }
          const retained = retainActivation(admissionOrder, session);
          if (stopped) await retained.close();
          lifecycle.assertRunning();
          return { status: "ready", session: retained } as const;
        }),
      );
    } catch (error) {
      return activationFailure(error);
    }
  };

  const closeRegistry = async (): Promise<void> => {
    if (registryClosed) return;
    await dependencies.locks.afterCreateDrain(async () => {
      await dependencies.registry.stop();
      registryClosed = true;
    });
  };

  return {
    acquireActivation,
    create: async (request) => {
      if (stopped) {
        return stoppedOutcome();
      }
      return operate(() =>
        trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            const result = await createProjectStorage(request, dependencies, lifecycle);
            lifecycle.assertRunning();
            return result;
          }),
        ),
      );
    },
    open: async (request: ProjectStorageOpenRequest) => {
      if (stopped) return stoppedOutcome();
      const admissionOrder = nextSessionAdmissionOrder;
      nextSessionAdmissionOrder += 1;
      return operate(() =>
        trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            await closeSession(request.projectId);
            lifecycle.assertRunning();
            const classified = classifyProjectStorageOpening(
              request,
              await dependencies.opening.inspect(request.projectId),
            );
            if (!("session" in classified)) {
              lifecycle.assertRunning();
              return classified.result;
            }
            if (stopped) {
              try {
                await classified.session.close();
              } catch (error) {
                throw new ProjectStorageBrokenError("Project Storage opening release failed.", {
                  cause: error,
                });
              }
            }
            lifecycle.assertRunning();
            sessions.set(request.projectId, { admissionOrder, session: classified.session });
            return classified.result;
          }),
        ),
      );
    },
    close: async (request: ProjectStorageCloseRequest) => {
      if (stopped) return stoppedOutcome();
      return operate(() =>
        trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            await closeSession(request.projectId);
            return { status: "closed", request } as const;
          }),
        ),
      );
    },
    stop: () => {
      if (stopPromise !== undefined) {
        return stopPromise;
      }
      stopped = true;
      // Drain admitted operations, then close sessions in admission order, then close the
      // registry after any pending create; every failure is kept.
      const shutdown = Effect.gen(function* () {
        const operationFailures = yield* drainAdmittedOperations(admittedOperations);
        const sessionFailures = yield* closeSessionsInAdmissionOrder([
          ...[...sessions.entries()].map(([projectId, admitted]) => ({
            admissionOrder: admitted.admissionOrder,
            close: () => closeSession(projectId),
          })),
          ...[...activationSessions].map((admitted) => ({
            admissionOrder: admitted.admissionOrder,
            close: admitted.session.close,
          })),
        ]);
        const registryFailures = yield* attempt(closeRegistry);
        return [...operationFailures, ...sessionFailures, ...registryFailures];
      });
      const stopAttempt = Effect.runPromise(shutdown).then((shutdownErrors) => {
        if (shutdownErrors.length > 0) {
          throw new AggregateError(
            [...new Set(shutdownErrors)],
            "Project Storage shutdown failed.",
          );
        }
      });
      stopPromise = stopAttempt;
      // A failed stop that still retains sessions may be retried; otherwise it is final.
      void stopAttempt.catch(() => {
        if (sessions.size + activationSessions.size === 0) return;
        if (stopPromise === stopAttempt) stopPromise = undefined;
      });
      return stopAttempt;
    },
  };
}
