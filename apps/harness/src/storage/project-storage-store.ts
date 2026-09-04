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
import type {
  ProjectStorageOwnerOutcome,
  ProjectStorageOwnerPort,
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

type AdmittedProjectStorageOperation = Readonly<{
  admissionOrder: number;
  settlement: Promise<void>;
  failure(): Readonly<{ error: unknown }> | undefined;
}>;

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

async function collectOperationShutdownErrors(
  admittedOperations: ReadonlySet<AdmittedProjectStorageOperation>,
): Promise<unknown[]> {
  const errors: unknown[] = [];
  const operations = [...admittedOperations].sort(
    (left, right) => left.admissionOrder - right.admissionOrder,
  );
  await Promise.all(operations.map(({ settlement }) => settlement));
  for (const operation of operations) {
    const failure = operation.failure();
    if (failure !== undefined) errors.push(shutdownOperationFailure(failure.error));
  }
  return errors;
}

async function collectSessionShutdownErrors(input: {
  sessions: ReadonlyMap<ProjectId, AdmittedProjectStorageSession>;
  close(projectId: ProjectId): Promise<void>;
}): Promise<unknown[]> {
  const errors: unknown[] = [];
  const projects = [...input.sessions.entries()].sort(
    ([, left], [, right]) => left.admissionOrder - right.admissionOrder,
  );
  for (const [projectId] of projects) {
    try {
      await input.close(projectId);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
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

export function createProjectStorageOwner(
  dependencies: ProjectStorageStoreDependencies,
): ProjectStorageOwnerPort {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  let nextSessionAdmissionOrder = 0;
  let nextOperationAdmissionOrder = 0;
  const sessions = new Map<ProjectId, AdmittedProjectStorageSession>();
  const admittedOperations = new Set<AdmittedProjectStorageOperation>();
  const ownerStoppedError = new ProjectStorageUnavailableError("Project Storage owner is stopped.");

  const lifecycle: ProjectStorageLifecycle = {
    assertRunning: () => {
      if (stopped) {
        throw ownerStoppedError;
      }
    },
  };

  const stoppedOutcome = (): ProjectStorageOwnerOutcome => ({
    status: "unavailable",
    message: ownerStoppedError.message,
  });

  const closeSession = async (projectId: ProjectId): Promise<void> => {
    const admittedSession = sessions.get(projectId);
    sessions.delete(projectId);
    await admittedSession?.session.close();
  };

  const operate = async (
    operation: () => Promise<
      ProjectStorageOpenResult | ProjectStorageCreateResult | ProjectStorageCloseResult
    >,
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

  const trackAdmittedOperation = (
    operation: () => Promise<ProjectStorageOperationResult>,
  ): Promise<ProjectStorageOwnerOutcome> => {
    const admissionOrder = nextOperationAdmissionOrder;
    nextOperationAdmissionOrder += 1;
    const pendingOperation = operation();
    let failure: Readonly<{ error: unknown }> | undefined;
    const settlement = pendingOperation.then(
      () => undefined,
      (error: unknown) => {
        if (error !== ownerStoppedError) {
          failure = { error };
        }
      },
    );
    const admittedOperation = {
      admissionOrder,
      settlement,
      failure: () => failure,
    } satisfies AdmittedProjectStorageOperation;
    admittedOperations.add(admittedOperation);
    void settlement.then(() => admittedOperations.delete(admittedOperation));
    return operate(() => pendingOperation);
  };

  return {
    create: async (request) => {
      if (stopped) {
        return stoppedOutcome();
      }
      return trackAdmittedOperation(() =>
        dependencies.locks.forProject(request.projectId, async () => {
          lifecycle.assertRunning();
          const result = await createProjectStorage(request, dependencies, lifecycle);
          lifecycle.assertRunning();
          return result;
        }),
      );
    },
    open: async (request: ProjectStorageOpenRequest) => {
      if (stopped) return stoppedOutcome();
      const admissionOrder = nextSessionAdmissionOrder;
      nextSessionAdmissionOrder += 1;
      return trackAdmittedOperation(() =>
        dependencies.locks.forProject(request.projectId, async () => {
          await closeSession(request.projectId);
          lifecycle.assertRunning();
          const classified = classifyProjectStorageOpening(
            request,
            await dependencies.opening.inspect(request.projectId),
          );
          if (stopped && classified.session !== undefined) {
            try {
              await classified.session.close();
            } catch (error) {
              throw new ProjectStorageBrokenError("Project Storage opening release failed.", {
                cause: error,
              });
            }
          }
          lifecycle.assertRunning();
          if (classified.session !== undefined) {
            sessions.set(request.projectId, { admissionOrder, session: classified.session });
          }
          return classified.result;
        }),
      );
    },
    close: async (request: ProjectStorageCloseRequest) => {
      if (stopped) return stoppedOutcome();
      return trackAdmittedOperation(() =>
        dependencies.locks.forProject(request.projectId, async () => {
          lifecycle.assertRunning();
          await closeSession(request.projectId);
          return { status: "closed", request };
        }),
      );
    },
    stop: () => {
      if (stopPromise !== undefined) {
        return stopPromise;
      }
      stopped = true;
      stopPromise = (async () => {
        const shutdownErrors = await collectOperationShutdownErrors(admittedOperations);
        shutdownErrors.push(
          ...(await collectSessionShutdownErrors({ sessions, close: closeSession })),
        );
        try {
          await dependencies.locks.afterCreateDrain(() => dependencies.registry.stop());
        } catch (error) {
          shutdownErrors.push(error);
        }
        if (shutdownErrors.length > 0) {
          throw new AggregateError(shutdownErrors, "Project Storage shutdown failed.");
        }
      })();
      return stopPromise;
    },
  };
}
