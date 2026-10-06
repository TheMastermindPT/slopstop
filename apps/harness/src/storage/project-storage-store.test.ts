import {
  CanonicalDatabaseLineageIdSchema,
  decodeStrict,
  type ProjectId,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateRequestSchema,
  type ProjectStorageCreateResult,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import { createPermitLock, withPermit } from "./permit-lock.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import type { ProjectStorageOpenEvidence } from "./project-storage-opening.js";
import {
  createProjectStorageOwner,
  type PriorStateWitnessKind,
  type ProjectStorageStoreDependencies,
} from "./project-storage-store.js";
import type { UnfinishedUpgrade } from "./project-storage-upgrade.js";

const request = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: "00000000-0000-4000-8000-000000000010",
  createRequestId: "00000000-0000-4000-8000-000000000011",
});
const expectedStorageId = decodeStrict(StorageIdSchema, "00000000-0000-4000-8000-000000000012");
const expectedGenerationId = decodeStrict(
  StorageGenerationIdSchema,
  "00000000-0000-4000-8000-000000000014",
);
const expectedCanonicalLineageId = decodeStrict(
  CanonicalDatabaseLineageIdSchema,
  "00000000-0000-4000-8000-000000000015",
);
const expectedRuntimeLineageId = decodeStrict(
  RuntimeDatabaseLineageIdSchema,
  "00000000-0000-4000-8000-000000000016",
);
const expectedCreateRequestFingerprint = "a".repeat(64);
type CreatedResult = Extract<ProjectStorageCreateResult, { status: "created" }>;
const expectedCreatedResult: CreatedResult = {
  status: "created",
  request,
  mode: "read-write",
  identity: {
    storageId: expectedStorageId,
    generationId: expectedGenerationId,
    canonicalDatabaseLineageId: expectedCanonicalLineageId,
    runtimeDatabaseLineageId: expectedRuntimeLineageId,
  },
};
type CreateInspectionFixture = Awaited<
  ReturnType<ProjectStorageStoreDependencies["registry"]["inspectCreate"]>
>;

const allPriorStateWitnessKinds: readonly PriorStateWitnessKind[] = [
  "registration-record",
  "location-record",
  "generation-record",
  "project-root",
  "repository-marker",
  "writer-lease",
  "manifest",
  "generation-directory",
  "canonical-database",
  "runtime-database",
  "canonical-wal",
  "canonical-shm",
  "canonical-rollback-journal",
  "runtime-wal",
  "runtime-shm",
  "runtime-rollback-journal",
  "local-snapshot",
  "deletion-tombstone",
  "unfinished-storage-operation",
];

function generationPaths() {
  return {
    projectRoot: "project",
    writerLease: "project/.slopstop-writer.lock",
    staging: {
      root: "staging",
      canonicalDatabase: "staging/slopstop.db",
      runtimeDatabase: "staging/mastra.db",
      manifest: "staging/manifest.json",
    },
    active: {
      root: "active",
      canonicalDatabase: "active/slopstop.db",
      runtimeDatabase: "active/mastra.db",
      manifest: "active/manifest.json",
    },
  };
}

function databaseDependencies() {
  return {
    createCanonical: vi.fn(async () => ({
      state: "closed" as const,
      formatVersion: 1,
      schemaVersion: 1,
      lastMigrationId: "0000_initial",
    })),
    createRuntime: vi.fn(async () => ({
      state: "closed" as const,
      formatVersion: 1,
      schemaVersion: 1,
      lastMigrationId: "0000_initial",
    })),
    verifySealed: vi.fn(async () => undefined),
  } satisfies ProjectStorageStoreDependencies["databases"];
}

function unopenedProjectDependencies(): ProjectStorageStoreDependencies["opening"] {
  return {
    inspect: vi.fn(
      async (): Promise<ProjectStorageOpenEvidence> => ({
        status: "not-registered",
      }),
    ),
  };
}

function fileDependencies() {
  return {
    createDirectoryExclusive: vi.fn(async () => undefined),
    createDirectoryInProject: vi.fn(async () => undefined),
    removeUpgradeOutput: vi.fn(async () => undefined),
    writeFileExclusive: vi.fn(async () => undefined),
    readFile: vi.fn(async () => ""),
    size: vi.fn(async () => 1),
    renameAtomic: vi.fn(async () => undefined),
  };
}

function unexpectedUpgradeSteps(): ProjectStorageStoreDependencies["upgrades"] {
  const unexpected = async (): Promise<never> => {
    throw new Error("Unexpected upgrade step.");
  };
  return {
    abandoned: () => undefined,
    discardFailed: () => undefined,
    findUnfinished: async () => undefined,
    proveUnfinished: unexpected,
    releaseUnfinished: unexpected,
    plan: unexpected,
    declare: unexpected,
    copyBackup: unexpected,
    verifyBackup: unexpected,
    sealBackup: unexpected,
    stage: unexpected,
    migrate: unexpected,
    verifyStaged: unexpected,
    switchActive: unexpected,
  };
}

function lifecycleDependencies() {
  const registryStop = vi.fn(async () => undefined);
  const afterCreateDrain = vi.fn(async (operation: () => Promise<void>) => {
    await operation();
  });
  const dependencies = {
    applicationVersion: "0.0.0",
    ids: {
      storageId: vi.fn(() => expectedStorageId),
      locationId: vi.fn(() => "00000000-0000-4000-8000-000000000013"),
      generationId: vi.fn(() => expectedGenerationId),
      canonicalLineageId: vi.fn(() => expectedCanonicalLineageId),
      runtimeLineageId: vi.fn(() => expectedRuntimeLineageId),
      upgradeId: vi.fn(() => {
        throw new Error("Unexpected upgrade allocation.");
      }),
    },
    clock: { now: vi.fn(() => "2026-08-31T12:00:00.000Z") },
    hashes: {
      sha256Text: vi.fn(async (_value: string) => expectedCreateRequestFingerprint),
      sha256File: vi.fn(async (_path: string) => "b".repeat(64)),
    },
    paths: { forCreation: vi.fn(generationPaths) },
    registry: {
      inspectCreate: vi.fn(
        async (
          _request: typeof request,
          _fingerprint: string,
        ): Promise<CreateInspectionFixture> => ({ status: "fresh" }),
      ),
      prepareCreate: vi.fn(async () => undefined),
      declareStaging: vi.fn(
        async (
          _creation: Parameters<ProjectStorageStoreDependencies["registry"]["declareStaging"]>[0],
          _paths: Parameters<ProjectStorageStoreDependencies["registry"]["declareStaging"]>[1],
        ): Promise<CreateInspectionFixture> => ({ status: "fresh" }),
      ),
      activate: vi.fn(
        async (
          _creation: Parameters<ProjectStorageStoreDependencies["registry"]["activate"]>[0],
          _paths: Parameters<ProjectStorageStoreDependencies["registry"]["activate"]>[1],
        ) => undefined,
      ),
      stop: registryStop,
    },
    witnesses: {
      inspect: vi.fn(
        async (_projectId: ProjectId): Promise<readonly PriorStateWitnessKind[]> => [],
      ),
    },
    files: fileDependencies(),
    databases: databaseDependencies(),
    opening: unopenedProjectDependencies(),
    upgrades: unexpectedUpgradeSteps(),
    failures: { checkpoint: vi.fn(async () => undefined) },
    locks: {
      forCreate: async <Result>(operation: () => Promise<Result>) => operation(),
      afterCreateDrain,
      forProject: async <Result>(_projectId: ProjectId, operation: () => Promise<Result>) =>
        operation(),
    },
  } satisfies ProjectStorageStoreDependencies;
  return { dependencies, registryStop, afterCreateDrain };
}

function mutationSnapshot(fixture: ReturnType<typeof lifecycleDependencies>) {
  const { dependencies } = fixture;
  return {
    allocations:
      dependencies.ids.storageId.mock.calls.length +
      dependencies.ids.locationId.mock.calls.length +
      dependencies.ids.generationId.mock.calls.length +
      dependencies.ids.canonicalLineageId.mock.calls.length +
      dependencies.ids.runtimeLineageId.mock.calls.length,
    preparations: dependencies.registry.prepareCreate.mock.calls.length,
    stagingDeclarations: dependencies.registry.declareStaging.mock.calls.length,
    activations: dependencies.registry.activate.mock.calls.length,
    directories: dependencies.files.createDirectoryExclusive.mock.calls.length,
    fileWrites: dependencies.files.writeFileExclusive.mock.calls.length,
    databaseCreations:
      dependencies.databases.createCanonical.mock.calls.length +
      dependencies.databases.createRuntime.mock.calls.length,
    sealedVerifications: dependencies.databases.verifySealed.mock.calls.length,
    renames: dependencies.files.renameAtomic.mock.calls.length,
  };
}

const emptyMutationSnapshot = {
  allocations: 0,
  preparations: 0,
  stagingDeclarations: 0,
  activations: 0,
  directories: 0,
  fileWrites: 0,
  databaseCreations: 0,
  sealedVerifications: 0,
  renames: 0,
};

type BlockedReason = "prior-state-witness" | "already-registered" | "idempotency-conflict";

function expectedBlockedResult(
  candidate: ProjectStorageCreateRequest,
  reason: BlockedReason,
): ProjectStorageCreateResult {
  if (reason === "prior-state-witness") {
    return {
      status: "blocked",
      request: candidate,
      reason,
      diagnostic: {
        code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
        message: "Prior Project Storage state requires recovery.",
      },
    };
  }
  if (reason === "already-registered") {
    return {
      status: "blocked",
      request: candidate,
      reason,
      diagnostic: {
        code: "PROJECT_STORAGE_ALREADY_REGISTERED",
        message: "Project Storage is already registered.",
      },
    };
  }
  return {
    status: "blocked",
    request: candidate,
    reason,
    diagnostic: {
      code: "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT",
      message: "The create request identity is already bound to another request.",
    },
  };
}

it.each(allPriorStateWitnessKinds)("blocks the %s witness without allocating", async (kind) => {
  const fixture = lifecycleDependencies();
  fixture.dependencies.witnesses.inspect.mockResolvedValue([kind]);

  const result = await createProjectStorageOwner(fixture.dependencies).create(request);

  expect(result).toEqual({
    status: "ready",
    result: expectedBlockedResult(request, "prior-state-witness"),
  });
  expect(mutationSnapshot(fixture)).toEqual(emptyMutationSnapshot);
});

it("keeps unavailable and broken witness inspection distinct from absence", async () => {
  const unavailable = lifecycleDependencies();
  unavailable.dependencies.witnesses.inspect.mockRejectedValue(
    new ProjectStorageUnavailableError("Project Storage is unavailable."),
  );
  const broken = lifecycleDependencies();
  broken.dependencies.registry.inspectCreate.mockRejectedValue(
    new ProjectStorageBrokenError("Project Storage registry is inconsistent."),
  );

  await expect(
    createProjectStorageOwner(unavailable.dependencies).create(request),
  ).resolves.toEqual({ status: "unavailable", message: "Project Storage is unavailable." });
  await expect(createProjectStorageOwner(broken.dependencies).create(request)).resolves.toEqual({
    status: "broken",
    message: "Project Storage registry is inconsistent.",
  });
  expect(mutationSnapshot(unavailable)).toEqual(emptyMutationSnapshot);
  expect(mutationSnapshot(broken)).toEqual(emptyMutationSnapshot);
});

it("passes the exact request fingerprint to the first registry inspection", async () => {
  const fixture = lifecycleDependencies();
  const events: string[] = [];
  fixture.dependencies.hashes.sha256Text.mockImplementation(async (value) => {
    events.push(`hash:${value}`);
    return expectedCreateRequestFingerprint;
  });
  fixture.dependencies.registry.inspectCreate.mockImplementation(
    async (_candidate, fingerprint) => {
      events.push(`inspect:${fingerprint}`);
      return { status: "fresh" };
    },
  );

  const result = await createProjectStorageOwner(fixture.dependencies).create(request);

  expect(result).toEqual({ status: "ready", result: expectedCreatedResult });
  expect(fixture.dependencies.registry.inspectCreate).toHaveBeenCalledWith(
    request,
    expectedCreateRequestFingerprint,
  );
  expect(events.slice(0, 2)).toEqual([
    `hash:${JSON.stringify({
      version: 1,
      projectId: request.projectId,
      createRequestId: request.createRequestId,
    })}`,
    `inspect:${expectedCreateRequestFingerprint}`,
  ]);
});

type StoredCreation = Readonly<{
  projectId: typeof request.projectId;
  requestId: typeof request.createRequestId;
  fingerprint: string;
  active: boolean;
}>;

function inspectStoredCreation(
  stored: StoredCreation | undefined,
  candidate: typeof request,
  fingerprint: string,
): CreateInspectionFixture {
  if (stored === undefined) return { status: "fresh" };
  if (stored.requestId !== candidate.createRequestId) {
    return stored.projectId === candidate.projectId
      ? { status: "already-registered" }
      : { status: "fresh" };
  }
  if (stored.projectId !== candidate.projectId) return { status: "idempotency-conflict" };
  if (!stored.active) return { status: "incomplete-request" };
  if (stored.fingerprint !== fingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
  return { status: "active-replay", identity: expectedCreatedResult.identity };
}

function installStoredCreationModel(fixture: ReturnType<typeof lifecycleDependencies>): void {
  let stored: StoredCreation | undefined;
  fixture.dependencies.registry.inspectCreate.mockImplementation(async (candidate, fingerprint) =>
    inspectStoredCreation(stored, candidate, fingerprint),
  );
  fixture.dependencies.registry.declareStaging.mockImplementation(async (creation) => {
    stored = {
      projectId: creation.projectId,
      requestId: creation.createRequestId,
      fingerprint: creation.createRequestFingerprint,
      active: false,
    };
    return { status: "fresh" };
  });
  fixture.dependencies.registry.activate.mockImplementation(async () => {
    if (stored === undefined) throw new Error("Expected staged creation before activation.");
    stored = { ...stored, active: true };
  });
}

function createRequestFingerprintInput(candidate: ProjectStorageCreateRequest): string {
  return JSON.stringify({
    version: 1,
    projectId: candidate.projectId,
    createRequestId: candidate.createRequestId,
  });
}

function installFingerprintMap(
  fixture: ReturnType<typeof lifecycleDependencies>,
  entries: readonly (readonly [ProjectStorageCreateRequest, string])[],
): void {
  const fingerprints = new Map<string, string>();
  for (const [candidate, fingerprint] of entries) {
    fingerprints.set(createRequestFingerprintInput(candidate), fingerprint);
  }
  fixture.dependencies.hashes.sha256Text.mockImplementation(async (value) => {
    const fingerprint = fingerprints.get(value);
    if (fingerprint === undefined) throw new Error("Unexpected create request fingerprint input.");
    return fingerprint;
  });
}

it("creates once, replays exactly, and rejects conflicting reuse without mutation", async () => {
  const fixture = lifecycleDependencies();
  const conflictRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: "00000000-0000-4000-8000-000000000020",
    createRequestId: request.createRequestId,
  });
  const registeredRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: request.projectId,
    createRequestId: "00000000-0000-4000-8000-000000000021",
  });
  const conflictFingerprint = "c".repeat(64);
  const registeredFingerprint = "d".repeat(64);
  installStoredCreationModel(fixture);
  installFingerprintMap(fixture, [
    [request, expectedCreateRequestFingerprint],
    [conflictRequest, conflictFingerprint],
    [registeredRequest, registeredFingerprint],
  ]);
  const owner = createProjectStorageOwner(fixture.dependencies);

  const first = await owner.create(request);
  const mutationsAfterFirst = mutationSnapshot(fixture);
  const replay = await owner.create(request);
  const conflict = await owner.create(conflictRequest);
  const registered = await owner.create(registeredRequest);

  expect(first).toEqual({ status: "ready", result: expectedCreatedResult });
  expect(replay).toEqual(first);
  expect(conflict).toEqual({
    status: "ready",
    result: expectedBlockedResult(conflictRequest, "idempotency-conflict"),
  });
  expect(registered).toEqual({
    status: "ready",
    result: expectedBlockedResult(registeredRequest, "already-registered"),
  });
  expect(fixture.dependencies.registry.inspectCreate).toHaveBeenNthCalledWith(
    1,
    request,
    expectedCreateRequestFingerprint,
  );
  expect(fixture.dependencies.registry.inspectCreate).toHaveBeenNthCalledWith(
    2,
    request,
    expectedCreateRequestFingerprint,
  );
  expect(fixture.dependencies.registry.inspectCreate).toHaveBeenNthCalledWith(
    3,
    conflictRequest,
    conflictFingerprint,
  );
  expect(fixture.dependencies.registry.inspectCreate).toHaveBeenNthCalledWith(
    4,
    registeredRequest,
    registeredFingerprint,
  );
  expect(fixture.dependencies.registry.declareStaging).toHaveBeenCalledWith(
    expect.objectContaining({ createRequestFingerprint: expectedCreateRequestFingerprint }),
    generationPaths(),
  );
  expect(fixture.dependencies.witnesses.inspect).toHaveBeenCalledOnce();
  expect(mutationSnapshot(fixture)).toEqual(mutationsAfterFirst);
});

function installSerialCreateLock(fixture: ReturnType<typeof lifecycleDependencies>): void {
  let createTail = Promise.resolve();
  fixture.dependencies.locks.forCreate = async <Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const previous = createTail;
    let release = (): void => undefined;
    createTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}

it("serializes installation-wide create decisions before allocation", async () => {
  const fixture = lifecycleDependencies();
  installSerialCreateLock(fixture);
  let winningProjectId: typeof request.projectId | undefined;
  fixture.dependencies.registry.inspectCreate.mockImplementation(
    async (candidate): Promise<CreateInspectionFixture> => {
      if (winningProjectId === undefined) return { status: "fresh" };
      return winningProjectId === candidate.projectId
        ? { status: "active-replay", identity: expectedCreatedResult.identity }
        : { status: "idempotency-conflict" };
    },
  );
  fixture.dependencies.registry.declareStaging.mockImplementation(async (creation) => {
    winningProjectId = creation.projectId;
    return { status: "fresh" };
  });
  const competingRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: "00000000-0000-4000-8000-000000000020",
    createRequestId: request.createRequestId,
  });
  const owner = createProjectStorageOwner(fixture.dependencies);

  const results = await Promise.all([owner.create(request), owner.create(competingRequest)]);

  expect(results).toEqual([
    { status: "ready", result: expectedCreatedResult },
    {
      status: "ready",
      result: expectedBlockedResult(competingRequest, "idempotency-conflict"),
    },
  ]);
  expect(mutationSnapshot(fixture).allocations).toBe(5);
  expect(fixture.dependencies.ids.storageId).toHaveBeenCalledOnce();
  expect(fixture.dependencies.ids.locationId).toHaveBeenCalledOnce();
  expect(fixture.dependencies.ids.generationId).toHaveBeenCalledOnce();
  expect(fixture.dependencies.ids.canonicalLineageId).toHaveBeenCalledOnce();
  expect(fixture.dependencies.ids.runtimeLineageId).toHaveBeenCalledOnce();
  expect(fixture.dependencies.registry.declareStaging).toHaveBeenCalledOnce();
});

it("applies request and registration precedence before witness inspection", async () => {
  const conflict = lifecycleDependencies();
  conflict.dependencies.registry.inspectCreate.mockResolvedValue({
    status: "idempotency-conflict",
  });
  conflict.dependencies.witnesses.inspect.mockResolvedValue(["project-root"]);
  const registered = lifecycleDependencies();
  registered.dependencies.registry.inspectCreate.mockResolvedValue({
    status: "already-registered",
  });
  registered.dependencies.witnesses.inspect.mockResolvedValue(["project-root"]);

  await expect(createProjectStorageOwner(conflict.dependencies).create(request)).resolves.toEqual({
    status: "ready",
    result: expectedBlockedResult(request, "idempotency-conflict"),
  });
  await expect(createProjectStorageOwner(registered.dependencies).create(request)).resolves.toEqual(
    {
      status: "ready",
      result: expectedBlockedResult(request, "already-registered"),
    },
  );
  expect(conflict.dependencies.witnesses.inspect).not.toHaveBeenCalled();
  expect(registered.dependencies.witnesses.inspect).not.toHaveBeenCalled();
  expect(mutationSnapshot(conflict)).toEqual(emptyMutationSnapshot);
  expect(mutationSnapshot(registered)).toEqual(emptyMutationSnapshot);
});

it("blocks an incomplete exact request without cleanup or reallocation", async () => {
  const fixture = lifecycleDependencies();
  fixture.dependencies.registry.inspectCreate.mockResolvedValue({ status: "incomplete-request" });

  const result = await createProjectStorageOwner(fixture.dependencies).create(request);

  expect(result).toEqual({
    status: "ready",
    result: expectedBlockedResult(request, "prior-state-witness"),
  });
  expect(mutationSnapshot(fixture)).toEqual(emptyMutationSnapshot);
  expect(fixture.dependencies.witnesses.inspect).not.toHaveBeenCalled();
});

function deferred() {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function retainedSessionFixture() {
  const fixture = lifecycleDependencies();
  const failure = new Error("session close failed");
  const release = vi.fn(async () => undefined).mockRejectedValueOnce(failure);
  const evidence: ProjectStorageOpenEvidence = {
    status: "selected-current",
    identity: expectedCreatedResult.identity,
    canonical: {
      status: "present",
      identityMatches: true,
      format: "current",
      migration: "current",
      foreignKeysEnabled: true,
      foreignKeyViolationCount: 0,
      integrityRows: ["ok"],
      domainInvariantsValid: true,
    },
    runtime: {
      status: "present",
      identityMatches: true,
      format: "current",
      migration: "current",
      foreignKeysEnabled: true,
      foreignKeyViolationCount: 0,
      integrityRows: ["ok"],
      domainInvariantsValid: true,
    },
    release,
  };
  const inspect = vi.fn(async (): Promise<ProjectStorageOpenEvidence> => evidence);
  fixture.dependencies.opening = { inspect };
  return {
    ...fixture,
    owner: createProjectStorageOwner(fixture.dependencies),
    release,
    failure,
    inspect,
    evidence,
  };
}

async function acquireSession(owner: ReturnType<typeof createProjectStorageOwner>) {
  const acquire = owner.acquireActivation;
  expect(acquire).toBeTypeOf("function");
  if (typeof acquire !== "function") throw new Error("Activation port is missing.");
  const outcome = await acquire({ projectId: request.projectId });
  expect(outcome).toMatchObject({
    status: "ready",
    session: {
      mode: "read-write",
      canonicalDatabasePath: "active/slopstop.db",
      writerLeasePath: "project/.slopstop-writer.lock",
    },
  });
  if (outcome.status !== "ready") throw new Error("Activation session is missing.");
  const session = outcome.session;
  expect(Object.keys(session).sort()).toEqual([
    "canonicalDatabasePath",
    "close",
    "mode",
    "result",
    "writerLeasePath",
  ]);
  return () => session.close();
}

it("retains Project Storage sessions until close succeeds", async () => {
  const ordinary = retainedSessionFixture();
  await ordinary.owner.open({ projectId: request.projectId });
  await expect(ordinary.owner.close({ projectId: request.projectId })).rejects.toBe(
    ordinary.failure,
  );
  await ordinary.owner.stop();
  expect(ordinary.release).toHaveBeenCalledTimes(2);
  const activation = retainedSessionFixture();
  const close = await acquireSession(activation.owner);
  await expect(close()).rejects.toBe(activation.failure);
  const ordinaryRelease = vi.fn(async () => undefined);
  activation.inspect.mockResolvedValue({ ...activation.evidence, release: ordinaryRelease });
  await activation.owner.open({ projectId: request.projectId });
  expect(activation.release).toHaveBeenCalledTimes(1);
  await activation.owner.close({ projectId: request.projectId });
  expect(ordinaryRelease).toHaveBeenCalledTimes(1);
  await activation.owner.stop();
  await close();
  await activation.owner.stop();
  expect(activation.release).toHaveBeenCalledTimes(2);
  expect(ordinaryRelease).toHaveBeenCalledTimes(1);
});

it.each([1, 2])(
  "retains a late activation release across shutdown (%i failures)",
  async (failures) => {
    const f = retainedSessionFixture();
    const entered = deferred();
    const inspection = deferred();
    const secondFailure = new Error("shutdown release failed");
    if (failures === 2) f.release.mockRejectedValueOnce(secondFailure);
    f.inspect.mockImplementationOnce(async () => {
      entered.resolve();
      await inspection.promise;
      return f.evidence;
    });
    const acquisition = f.owner.acquireActivation({ projectId: request.projectId });
    const acquisitionFailure = acquisition.then(
      () => undefined,
      (error: unknown) => error,
    );
    await entered.promise;
    const stop = f.owner.stop();
    const shutdownFailure = stop.then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(f.owner.stop()).toBe(stop);
    inspection.resolve();
    expect(await acquisitionFailure).toBe(f.failure);
    const error = await shutdownFailure;
    expect(f.release).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(AggregateError);
    if (!(error instanceof AggregateError)) throw new Error("Expected retained shutdown errors.");
    expect(error.message).toBe("Project Storage shutdown failed.");
    expect(error.errors).toEqual(failures === 1 ? [f.failure] : [f.failure, secondFailure]);
    expect(f.registryStop).toHaveBeenCalledTimes(1);
    if (failures === 2) {
      await f.owner.stop();
      await f.owner.stop();
      expect(f.release).toHaveBeenCalledTimes(3);
      expect(f.registryStop).toHaveBeenCalledTimes(1);
    } else expect(f.owner.stop()).toBe(stop);
  },
);

it("does not wait at stop for an operation whose lock threw before admission", async () => {
  const fixture = lifecycleDependencies();
  const failure = new Error("lock refused synchronously");
  const owner = createProjectStorageOwner({
    ...fixture.dependencies,
    locks: {
      ...fixture.dependencies.locks,
      forProject: () => {
        throw failure;
      },
    },
  });

  await expect(owner.create(request)).rejects.toBe(failure);
  const stopped = await Promise.race([
    owner.stop().then(() => "stopped" as const),
    new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 1_000)),
  ]);
  expect(stopped).toBe("stopped");
});

it("retains delayed asynchronous registry failure in the shared stop promise", async () => {
  const fixture = lifecycleDependencies();
  const createLock = createPermitLock();
  const registryStopEntered = deferred();
  const registryStopRelease = deferred();
  const registryFailure = new Error("registry close failed");
  fixture.dependencies.locks.afterCreateDrain.mockImplementation((operation) =>
    withPermit(createLock, operation),
  );
  fixture.registryStop.mockImplementation(async () => {
    registryStopEntered.resolve();
    await registryStopRelease.promise;
    throw registryFailure;
  });
  const owner = createProjectStorageOwner(fixture.dependencies);

  const firstStop = owner.stop();
  const secondStop = owner.stop();
  const outcome = firstStop.then(
    () => ({ status: "resolved" }) as const,
    (error: unknown) => ({ status: "rejected", error }) as const,
  );
  let settled = false;
  void outcome.then(() => {
    settled = true;
  });
  await registryStopEntered.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(secondStop).toBe(firstStop);
  expect(settled).toBe(false);

  registryStopRelease.resolve();
  const result = await outcome;
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") throw new Error("Expected Project Storage stop to reject.");
  expect(result.error).toBeInstanceOf(AggregateError);
  if (!(result.error instanceof AggregateError)) {
    throw new Error("Expected Project Storage stop to retain an aggregate failure.");
  }
  expect(result.error.message).toBe("Project Storage shutdown failed.");
  expect(result.error.errors).toEqual([registryFailure]);
});

const recoveryUpgradeId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-0000000000a1",
);
const recoveryTargetId = decodeStrict(
  StorageGenerationIdSchema,
  "00000000-0000-4000-8000-000000000024",
);
const invalidOutput = new ProjectStorageBrokenError("Project Storage upgrade output is invalid.");

function unfinishedMarker(): UnfinishedUpgrade {
  return {
    projectId: request.projectId,
    storageId: expectedStorageId,
    upgradeId: recoveryUpgradeId,
    sourceGenerationId: expectedGenerationId,
    targetGenerationId: recoveryTargetId,
  };
}

/** Opening evidence of a Project whose canonical database needs a migration. */
function migrationRequiredEvidence(): ProjectStorageOpenEvidence {
  const probe = {
    status: "present",
    identityMatches: true,
    foreignKeysEnabled: true,
    foreignKeyViolationCount: 0,
    integrityRows: ["ok"],
    domainInvariantsValid: true,
  } as const;
  return {
    status: "selected-current",
    identity: {
      storageId: expectedStorageId,
      generationId: expectedGenerationId,
      canonicalDatabaseLineageId: expectedCanonicalLineageId,
      runtimeDatabaseLineageId: expectedRuntimeLineageId,
    },
    canonical: { ...probe, format: "known-older", migration: "known-older" },
    runtime: { ...probe, format: "current", migration: "current" },
    release: async () => undefined,
  };
}

/** Typed fakes around one unfinished upgrade whose output removal is refused as broken. */
function upgradeRecoveryFixture(
  initial: UnfinishedUpgrade | undefined,
  removeUpgradeOutput: ProjectStorageStoreDependencies["files"]["removeUpgradeOutput"] = async () => {
    throw invalidOutput;
  },
) {
  const { dependencies } = lifecycleDependencies();
  const events: unknown[] = [];
  const sink = { failing: false };
  const record = (event: unknown) => {
    if (sink.failing) throw new Error("Diagnostics sink failed.");
    events.push(event);
  };
  let marker = initial;
  const steps = dependencies.upgrades;
  const upgrades: ProjectStorageStoreDependencies["upgrades"] = {
    ...steps,
    abandoned: (event) => record(["abandoned", event]),
    discardFailed: (event) => record(["discardFailed", event]),
    findUnfinished: async () => marker,
    proveUnfinished: async () => ({
      status: "proven",
      retainedGenerationIds: [expectedGenerationId],
    }),
    releaseUnfinished: async () => {
      marker = undefined;
    },
    plan: async () => ({ status: "eligible", source: storedSource(), canonicalMigrations: [] }),
    declare: async () => {
      marker = unfinishedMarker();
    },
    copyBackup: async () => undefined,
    verifyBackup: async () => "verified",
    sealBackup: async () => undefined,
    stage: async () => undefined,
  };
  const owner = createProjectStorageOwner({
    ...dependencies,
    ids: { ...dependencies.ids, upgradeId: () => recoveryUpgradeId },
    files: {
      ...dependencies.files,
      removeUpgradeOutput,
    },
    opening: { inspect: async () => migrationRequiredEvidence() },
    upgrades,
    failures: {
      checkpoint: async (point) => {
        if (point === "after-staged-copy")
          throw new Error("Injected failure at after-staged-copy.");
      },
    },
  });
  return { owner, events, upgrades, sink };
}

function storedSource() {
  return {
    storageId: expectedStorageId,
    generationId: expectedGenerationId,
    projectId: request.projectId,
    locationId: "00000000-0000-4000-8000-000000000013",
    canonicalDatabaseLineageId: expectedCanonicalLineageId,
    runtimeDatabaseLineageId: expectedRuntimeLineageId,
    createRequestId: request.createRequestId,
    createRequestFingerprint: expectedCreateRequestFingerprint,
    generationDirectoryName: expectedGenerationId,
    creationState: "active",
    createdAt: "2026-08-31T12:00:00.000Z",
    activatedAt: "2026-08-31T12:00:00.000Z",
  } as const;
}

const brokenDiscard = [
  "discardFailed",
  { projectId: request.projectId, upgradeId: recoveryUpgradeId, cause: "broken" },
];

it("removes only proven upgrade output: owner, broken discard", async () => {
  const opening = upgradeRecoveryFixture(unfinishedMarker());
  const brokenOutcome = { status: "broken", message: invalidOutput.message };
  expect(await opening.owner.acquireActivation({ projectId: request.projectId })).toEqual(
    brokenOutcome,
  );
  expect(await opening.owner.upgrade({ projectId: request.projectId })).toEqual(brokenOutcome);
  expect(opening.events).toEqual([brokenDiscard, brokenDiscard]);
  await opening.owner.stop();

  const failing = upgradeRecoveryFixture(undefined);
  await expect(failing.owner.upgrade({ projectId: request.projectId })).rejects.toThrow(
    "Injected failure at after-staged-copy.",
  );
  expect(failing.events).toEqual([brokenDiscard]);
  await failing.owner.stop();
});

it("removes only proven upgrade output: owner, client initialization failure", async () => {
  const initialization = new ProjectStorageApplicationClientInitializationError(
    "Project Storage application client initialization failed.",
  );
  const fixture = upgradeRecoveryFixture(unfinishedMarker());
  fixture.upgrades.findUnfinished = async () => {
    throw initialization;
  };
  await expect(fixture.owner.acquireActivation({ projectId: request.projectId })).rejects.toBe(
    initialization,
  );
  await expect(fixture.owner.upgrade({ projectId: request.projectId })).rejects.toBe(
    initialization,
  );
  await fixture.owner.stop().catch(() => undefined);
});

it("reports a discard after a failed upgrade: owner, unreadable registry", async () => {
  const unreadable = new ProjectStorageBrokenError("Project Storage registry is unreadable.");
  const fixture = upgradeRecoveryFixture(undefined);
  // Only the upgrade entry reads the marker; the failure-time discard uses the declared one.
  const findUnfinished = vi.fn(async () => undefined);
  fixture.upgrades.findUnfinished = findUnfinished;
  fixture.upgrades.proveUnfinished = async () => {
    throw unreadable;
  };
  await expect(fixture.owner.upgrade({ projectId: request.projectId })).rejects.toThrow(
    "Injected failure at after-staged-copy.",
  );
  expect(fixture.events).toEqual([brokenDiscard]);
  expect(findUnfinished).toHaveBeenCalledTimes(1);
  await fixture.owner.stop();
});

it("reports a discard after a failed upgrade: owner, client initialization failure", async () => {
  const fixture = upgradeRecoveryFixture(undefined);
  fixture.upgrades.proveUnfinished = async () => {
    throw new ProjectStorageApplicationClientInitializationError(
      "Project Storage application client initialization failed.",
    );
  };
  await expect(fixture.owner.upgrade({ projectId: request.projectId })).rejects.toThrow(
    "Injected failure at after-staged-copy.",
  );
  expect(fixture.events).toEqual([brokenDiscard]);
  await fixture.owner.stop().catch(() => undefined);
});

it("keeps the discard outcome when its diagnostics port throws: owner", async () => {
  const outcomes = [];
  for (const failing of [false, true]) {
    const discarded = upgradeRecoveryFixture(unfinishedMarker(), async () => undefined);
    const refused = upgradeRecoveryFixture(unfinishedMarker());
    discarded.sink.failing = failing;
    refused.sink.failing = failing;
    const activation = await discarded.owner.acquireActivation({ projectId: request.projectId });
    if (activation.status === "ready") await activation.session.close();
    outcomes.push({
      // Sessions hold closures; their data is what the two runs must share.
      discarded: JSON.parse(JSON.stringify(activation)),
      refused: await refused.owner.acquireActivation({ projectId: request.projectId }),
    });
    await discarded.owner.stop();
    await refused.owner.stop();
  }
  expect(outcomes[0]?.discarded).toMatchObject({ status: "ready" });
  expect(outcomes[0]?.refused).toEqual({ status: "broken", message: invalidOutput.message });
  expect(outcomes[1]).toEqual(outcomes[0]);
});
