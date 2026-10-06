import { projectUpgradeDiagnostics } from "@slopstop/protocol";
import { Data, Effect, Result } from "effect";
import { projectStorageCreateRequestFingerprintInput } from "./project-storage-create-request.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import {
  readGenerationBaselines,
  serializeGenerationManifest,
} from "./project-storage-generation-manifest.js";
import { isBusyStorageError } from "./project-storage-node-errors.js";
import { classifyProjectStorageOpening } from "./project-storage-opening.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";
import {
  type MigratedUpgrade,
  type ProjectStorageUpgradeCheckpoint,
  type ProjectStorageUpgradeOutcome,
  type ProjectStorageUpgradeRequest,
  type ProjectStorageUpgradeResult,
  projectStorageUpgradeBusyMessage,
  type StagedUpgrade,
} from "./project-storage-upgrade.js";
import {
  discardKnownUpgrade,
  discardUnfinishedUpgrade,
} from "./project-storage-upgrade-recovery.js";

type StorageGenerationId = StagedUpgrade["targetGenerationId"];
type AllocatedCreation = Parameters<
  ProjectStorageStoreDependencies["databases"]["verifySealed"]
>[1];
type Lifecycle = Readonly<{ assertRunning(): void }>;
type Pipeline = Readonly<{
  request: ProjectStorageUpgradeRequest;
  dependencies: ProjectStorageStoreDependencies;
  lifecycle: Lifecycle;
}>;

/** Discarding an earlier unfinished upgrade failed. */
class UpgradeRecoveryFailed extends Data.TaggedError("UpgradeRecoveryFailed")<{
  readonly cause: unknown;
}> {}
/** Opening inspection for the upgrade failed. */
class UpgradeInspectionFailed extends Data.TaggedError("UpgradeInspectionFailed")<{
  readonly cause: unknown;
}> {}
/** The version-moving plan could not be read. */
class UpgradePlanFailed extends Data.TaggedError("UpgradePlanFailed")<{
  readonly cause: unknown;
}> {}
/** The upgrade identity or its registry declaration failed. */
class UpgradeDeclarationFailed extends Data.TaggedError("UpgradeDeclarationFailed")<{
  readonly cause: unknown;
}> {}
/** The pre-upgrade backup could not be made or recorded. */
class UpgradeBackupFailed extends Data.TaggedError("UpgradeBackupFailed")<{
  readonly cause: unknown;
}> {}
/** The staged copies could not be made. */
class UpgradeStagingFailed extends Data.TaggedError("UpgradeStagingFailed")<{
  readonly cause: unknown;
}> {}
/** The staged copies could not be migrated and re-identified. */
class UpgradeMigrationFailed extends Data.TaggedError("UpgradeMigrationFailed")<{
  readonly cause: unknown;
}> {}
/** The staged copies could not be read for verification. */
class UpgradeVerificationFailed extends Data.TaggedError("UpgradeVerificationFailed")<{
  readonly cause: unknown;
}> {}
/** The staged generation could not be sealed and renamed. */
class UpgradeSealFailed extends Data.TaggedError("UpgradeSealFailed")<{
  readonly cause: unknown;
}> {}
/** The registry switch to the upgraded generation failed. */
class UpgradeSwitchFailed extends Data.TaggedError("UpgradeSwitchFailed")<{
  readonly cause: unknown;
}> {}
/** An upgrade checkpoint failed. */
class UpgradeCheckpointFailed extends Data.TaggedError("UpgradeCheckpointFailed")<{
  readonly checkpoint: ProjectStorageUpgradeCheckpoint;
  readonly cause: unknown;
}> {}

type UpgradeStepError =
  | UpgradeRecoveryFailed
  | UpgradeInspectionFailed
  | UpgradePlanFailed
  | UpgradeDeclarationFailed
  | UpgradeBackupFailed
  | UpgradeStagingFailed
  | UpgradeMigrationFailed
  | UpgradeVerificationFailed
  | UpgradeSealFailed
  | UpgradeSwitchFailed
  | UpgradeCheckpointFailed;

function step<Value, Failure>(
  pipeline: Pipeline,
  run: () => Promise<Value>,
  fail: (cause: unknown) => Failure,
): Effect.Effect<Value, Failure> {
  return Effect.tryPromise({
    try: async () => {
      pipeline.lifecycle.assertRunning();
      const value = await run();
      pipeline.lifecycle.assertRunning();
      return value;
    },
    catch: fail,
  });
}

function checkpoint(pipeline: Pipeline, point: ProjectStorageUpgradeCheckpoint) {
  return step(
    pipeline,
    () => pipeline.dependencies.failures.checkpoint(point),
    (cause) => new UpgradeCheckpointFailed({ checkpoint: point, cause }),
  );
}

type Eligibility =
  | Readonly<{ status: "answered"; result: ProjectStorageUpgradeResult }>
  | Readonly<{ status: "eligible"; sourceGenerationId: StorageGenerationId }>;

const upgradeRows = projectUpgradeDiagnostics;
type RefusalCode = typeof upgradeRows.unsupported.code | typeof upgradeRows.notEligible.code;
type FailureCode =
  | typeof upgradeRows.backupInvalid.code
  | typeof upgradeRows.verificationFailed.code;
const refusalRows = {
  PROJECT_UPGRADE_UNSUPPORTED: upgradeRows.unsupported,
  PROJECT_UPGRADE_NOT_ELIGIBLE: upgradeRows.notEligible,
} as const satisfies Record<RefusalCode, unknown>;
const failureRows = {
  PROJECT_UPGRADE_BACKUP_INVALID: upgradeRows.backupInvalid,
  PROJECT_UPGRADE_VERIFICATION_FAILED: upgradeRows.verificationFailed,
} as const satisfies Record<FailureCode, unknown>;

function refused(
  request: ProjectStorageUpgradeRequest,
  code: RefusalCode,
): ProjectStorageUpgradeResult {
  return { status: "refused", request, diagnostic: { code, message: refusalRows[code].message } };
}

function failed(
  request: ProjectStorageUpgradeRequest,
  code: FailureCode,
): ProjectStorageUpgradeResult {
  return { status: "failed", request, diagnostic: { code, message: failureRows[code].message } };
}

async function inspectEligibility(pipeline: Pipeline): Promise<Eligibility> {
  const { request, dependencies } = pipeline;
  const classified = classifyProjectStorageOpening(
    request,
    await dependencies.opening.inspect(request.projectId),
  );
  const notRequired = { status: "answered", result: { status: "not-required", request } } as const;
  if (!("session" in classified)) {
    return { status: "answered", result: { status: "not-registered", request } };
  }
  await classified.session.close();
  const opening = classified.result;
  if (opening.status !== "safe-mode") return notRequired;
  const healths = [opening.canonicalHealth.status, opening.runtimeHealth.status];
  if (healths.includes("unavailable")) {
    throw new ProjectStorageUnavailableError(projectStorageUpgradeBusyMessage);
  }
  const sourceGenerationId = opening.identity.generationId;
  const eligible = [
    opening.canonicalHealth.status === "migration-required",
    opening.runtimeHealth.status === "healthy",
  ].every(Boolean);
  if (!eligible || sourceGenerationId === null) {
    return { status: "answered", result: refused(request, "PROJECT_UPGRADE_NOT_ELIGIBLE") };
  }
  return { status: "eligible", sourceGenerationId };
}

async function allocateUpgrade(
  pipeline: Pipeline,
  source: StagedUpgrade["source"],
): Promise<StagedUpgrade> {
  const { dependencies, request } = pipeline;
  const upgradeId = dependencies.ids.upgradeId();
  const targetGenerationId = dependencies.ids.generationId();
  const createRequestFingerprint = await dependencies.hashes.sha256Text(
    projectStorageCreateRequestFingerprintInput({
      projectId: request.projectId,
      createRequestId: upgradeId,
    }),
  );
  return {
    projectId: request.projectId,
    source,
    targetGenerationId,
    upgradeId,
    createRequestFingerprint,
    startedAt: dependencies.clock.now(),
  };
}

/** The target generation as a sealed-creation identity: the source's ids, the upgrade's own. */
function targetCreation(upgrade: StagedUpgrade): AllocatedCreation {
  return {
    projectId: upgrade.projectId,
    storageId: upgrade.source.storageId,
    locationId: upgrade.source.locationId,
    generationId: upgrade.targetGenerationId,
    canonicalDatabaseLineageId: upgrade.source.canonicalDatabaseLineageId,
    runtimeDatabaseLineageId: upgrade.source.runtimeDatabaseLineageId,
    createRequestId: upgrade.upgradeId,
    createRequestFingerprint: upgrade.createRequestFingerprint,
    createdAt: upgrade.startedAt,
  };
}

async function sealTarget(
  pipeline: Pipeline,
  upgrade: StagedUpgrade,
  migrated: MigratedUpgrade,
): Promise<void> {
  const { dependencies } = pipeline;
  const paths = dependencies.paths.forCreation(upgrade.projectId, upgrade.targetGenerationId);
  const creation = targetCreation(upgrade);
  const baselines = await readGenerationBaselines(dependencies, paths.staging);
  const manifest = serializeGenerationManifest({
    creation,
    provenance: {
      kind: "staged-upgrade",
      sourceGenerationId: upgrade.source.generationId,
      projectSequence: migrated.projectSequence,
      runtimeWaterline: migrated.runtimeWaterline,
    },
    canonical: migrated.canonical,
    runtime: migrated.runtime,
    baselines,
    applicationVersion: dependencies.applicationVersion,
  });
  await dependencies.files.writeFileExclusive(paths.staging.manifest, manifest);
  await dependencies.databases.verifySealed(paths.staging, creation);
  await dependencies.files.renameAtomic(paths.staging.root, paths.active.root);
}

async function verifyRenamedTarget(pipeline: Pipeline, upgrade: StagedUpgrade): Promise<void> {
  const { dependencies } = pipeline;
  const paths = dependencies.paths.forCreation(upgrade.projectId, upgrade.targetGenerationId);
  await dependencies.databases.verifySealed(paths.active, targetCreation(upgrade));
}

function backupSource(pipeline: Pipeline, upgrade: StagedUpgrade) {
  const { dependencies } = pipeline;
  return Effect.gen(function* () {
    yield* step(
      pipeline,
      () => dependencies.upgrades.copyBackup(upgrade),
      (cause) => new UpgradeBackupFailed({ cause }),
    );
    yield* checkpoint(pipeline, "after-backup-copied");
    const verification = yield* step(
      pipeline,
      () => dependencies.upgrades.verifyBackup(upgrade),
      (cause) => new UpgradeBackupFailed({ cause }),
    );
    if (verification === "invalid") return verification;
    yield* step(
      pipeline,
      () => dependencies.upgrades.sealBackup(upgrade, dependencies.applicationVersion),
      (cause) => new UpgradeBackupFailed({ cause }),
    );
    yield* checkpoint(pipeline, "after-backup-verified");
    return verification;
  });
}

function buildTarget(
  pipeline: Pipeline,
  upgrade: StagedUpgrade,
  canonicalMigrations: Parameters<ProjectStorageStoreDependencies["upgrades"]["migrate"]>[1],
) {
  const { dependencies } = pipeline;
  return Effect.gen(function* () {
    yield* step(
      pipeline,
      () => dependencies.upgrades.stage(upgrade),
      (cause) => new UpgradeStagingFailed({ cause }),
    );
    yield* checkpoint(pipeline, "after-staged-copy");
    const migrated = yield* step(
      pipeline,
      () => dependencies.upgrades.migrate(upgrade, canonicalMigrations),
      (cause) => new UpgradeMigrationFailed({ cause }),
    );
    yield* checkpoint(pipeline, "after-staged-migration");
    const verification = yield* step(
      pipeline,
      () => dependencies.upgrades.verifyStaged(upgrade, canonicalMigrations),
      (cause) => new UpgradeVerificationFailed({ cause }),
    );
    if (verification === "mismatch") return verification;
    yield* checkpoint(pipeline, "after-staged-verified");
    yield* step(
      pipeline,
      () => sealTarget(pipeline, upgrade, migrated),
      (cause) => new UpgradeSealFailed({ cause }),
    );
    yield* checkpoint(pipeline, "after-generation-rename");
    yield* step(
      pipeline,
      () => verifyRenamedTarget(pipeline, upgrade),
      (cause) => new UpgradeSealFailed({ cause }),
    );
    return verification;
  });
}

function upgradeProgram(
  pipeline: Pipeline,
): Effect.Effect<ProjectStorageUpgradeResult, UpgradeStepError> {
  const { dependencies, request } = pipeline;
  return Effect.gen(function* () {
    yield* step(
      pipeline,
      () => discardUnfinishedUpgrade(request.projectId, "interrupted", dependencies),
      (cause) => new UpgradeRecoveryFailed({ cause }),
    );
    const eligibility = yield* step(
      pipeline,
      () => inspectEligibility(pipeline),
      (cause) => new UpgradeInspectionFailed({ cause }),
    );
    if (eligibility.status === "answered") return eligibility.result;
    const plan = yield* step(
      pipeline,
      () => dependencies.upgrades.plan(request.projectId, eligibility.sourceGenerationId),
      (cause) => new UpgradePlanFailed({ cause }),
    );
    if (plan.status === "unsupported") return refused(request, "PROJECT_UPGRADE_UNSUPPORTED");
    const upgrade = yield* step(
      pipeline,
      async () => {
        const allocated = await allocateUpgrade(pipeline, plan.source);
        await dependencies.upgrades.declare(allocated);
        return allocated;
      },
      (cause) => new UpgradeDeclarationFailed({ cause }),
    );
    const settled = yield* Effect.result(
      runDeclaredUpgrade(pipeline, upgrade, plan.canonicalMigrations),
    );
    const switched = Result.isSuccess(settled) && settled.success.status === "upgraded";
    if (!switched) yield* discardAfterFailure(pipeline, upgrade);
    if (Result.isFailure(settled)) return yield* Effect.fail(settled.failure);
    if (switched) yield* checkpoint(pipeline, "after-upgrade-switch");
    return settled.success;
  });
}

/** Every step from the declaration up to and including the committed switch. */
function runDeclaredUpgrade(
  pipeline: Pipeline,
  upgrade: StagedUpgrade,
  canonicalMigrations: Parameters<ProjectStorageStoreDependencies["upgrades"]["migrate"]>[1],
): Effect.Effect<ProjectStorageUpgradeResult, UpgradeStepError> {
  const { dependencies, request } = pipeline;
  return Effect.gen(function* () {
    yield* checkpoint(pipeline, "after-upgrade-declared");
    const backup = yield* backupSource(pipeline, upgrade);
    if (backup === "invalid") return failed(request, "PROJECT_UPGRADE_BACKUP_INVALID");
    const built = yield* buildTarget(pipeline, upgrade, canonicalMigrations);
    if (built === "mismatch") return failed(request, "PROJECT_UPGRADE_VERIFICATION_FAILED");
    yield* checkpoint(pipeline, "before-upgrade-switch");
    yield* step(
      pipeline,
      () => dependencies.upgrades.switchActive(upgrade, dependencies.clock.now()),
      (cause) => new UpgradeSwitchFailed({ cause }),
    );
    return {
      status: "upgraded",
      request,
      sourceGenerationId: upgrade.source.generationId,
      generationId: upgrade.targetGenerationId,
      upgradeId: upgrade.upgradeId,
    } as const;
  });
}

function isRunning(lifecycle: Lifecycle): boolean {
  try {
    lifecycle.assertRunning();
    return true;
  } catch {
    return false;
  }
}

/**
 * Discards the declared upgrade after any failure before its switch commits, unless the owner
 * is stopping. The original outcome stays the answer: a discard that does not complete has
 * already reported itself, and the next opening handles what remains.
 */
function discardAfterFailure(pipeline: Pipeline, upgrade: StagedUpgrade): Effect.Effect<void> {
  return Effect.promise(async () => {
    if (!isRunning(pipeline.lifecycle)) return;
    // The declared marker is known: a registry that cannot be read is then a reported failure.
    const unfinished = {
      projectId: upgrade.projectId,
      storageId: upgrade.source.storageId,
      upgradeId: upgrade.upgradeId,
      sourceGenerationId: upgrade.source.generationId,
      targetGenerationId: upgrade.targetGenerationId,
    };
    try {
      await discardKnownUpgrade(unfinished, "failed", pipeline.dependencies);
    } catch {
      // Reported through the diagnostics port by the discard itself.
    }
  });
}

/** Converts a failed step to the owner outcome; anything else stays an unexpected failure. */
function stepFailureOutcome(failure: UpgradeStepError): ProjectStorageUpgradeOutcome {
  const { cause } = failure;
  if (cause instanceof ProjectStorageApplicationClientInitializationError) throw cause;
  if (cause instanceof ProjectStorageUnavailableError) {
    return { status: "unavailable", message: cause.message };
  }
  // A raw busy-class error from any step is busy too (D12); other unknown errors are rethrown.
  if (isBusyStorageError({ error: cause })) {
    return { status: "unavailable", message: projectStorageUpgradeBusyMessage };
  }
  if (cause instanceof ProjectStorageBrokenError)
    return { status: "broken", message: cause.message };
  throw cause;
}

/**
 * Runs one staged upgrade of a Project's Storage. Step failures stay typed inside the program
 * and are converted to the owner outcome shape here, once.
 */
export async function runProjectStorageUpgrade(
  request: ProjectStorageUpgradeRequest,
  dependencies: ProjectStorageStoreDependencies,
  lifecycle: Lifecycle,
): Promise<ProjectStorageUpgradeOutcome> {
  const outcome = await Effect.runPromise(
    Effect.result(upgradeProgram({ request, dependencies, lifecycle })),
  );
  if (Result.isSuccess(outcome)) return { status: "ready", result: outcome.success };
  return stepFailureOutcome(outcome.failure);
}
