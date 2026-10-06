import type {
  ProjectId,
  ProjectStorageCreateRequest,
  StorageGenerationId,
  StorageId,
} from "@slopstop/protocol";
import type { GeneratedMigration } from "./generated-migrations.js";
import type { GenerationRow } from "./project-storage-node-schemas.js";

/** The `unavailable` message of an upgrade that met busy storage; it can be retried. */
export const projectStorageUpgradeBusyMessage =
  "Project Storage is busy; the upgrade can be retried.";

export type ProjectStorageUpgradeRequest = Readonly<{ projectId: ProjectId }>;
export type ProjectStorageUpgradeId = ProjectStorageCreateRequest["createRequestId"];

type UpgradeDiagnostic<Code extends string> = Readonly<{ code: Code; message: string }>;

export type ProjectStorageUpgradeResult =
  | Readonly<{
      status: "upgraded";
      request: ProjectStorageUpgradeRequest;
      sourceGenerationId: StorageGenerationId;
      generationId: StorageGenerationId;
      upgradeId: ProjectStorageUpgradeId;
    }>
  | Readonly<{ status: "not-required" | "not-registered"; request: ProjectStorageUpgradeRequest }>
  | Readonly<{
      status: "refused";
      request: ProjectStorageUpgradeRequest;
      diagnostic: UpgradeDiagnostic<"PROJECT_UPGRADE_UNSUPPORTED" | "PROJECT_UPGRADE_NOT_ELIGIBLE">;
    }>
  | Readonly<{
      status: "failed";
      request: ProjectStorageUpgradeRequest;
      diagnostic: UpgradeDiagnostic<
        "PROJECT_UPGRADE_BACKUP_INVALID" | "PROJECT_UPGRADE_VERIFICATION_FAILED"
      >;
    }>;

export type ProjectStorageUpgradeOutcome =
  | Readonly<{ status: "ready"; result: ProjectStorageUpgradeResult }>
  | Readonly<{ status: "unavailable" | "broken"; message: string }>;

export interface ProjectStorageUpgradePort {
  upgrade(request: ProjectStorageUpgradeRequest): Promise<ProjectStorageUpgradeOutcome>;
}

export type ProjectStorageUpgradeCheckpoint =
  | "during-upgrade-declare"
  | "after-upgrade-declared"
  | "after-backup-copied"
  | "after-backup-verified"
  | "after-staged-copy"
  | "after-staged-migration"
  | "after-staged-verified"
  | "after-generation-rename"
  | "before-upgrade-switch"
  | "during-upgrade-switch"
  | "after-upgrade-switch";

/** Format, schema and migration head of one closed database. */
export type DatabaseHead = Readonly<{
  formatVersion: number;
  schemaVersion: number;
  lastMigrationId: string;
}>;

type UpgradePlan =
  | Readonly<{ status: "unsupported" }>
  | Readonly<{
      status: "eligible";
      source: GenerationRow;
      canonicalMigrations: readonly GeneratedMigration[];
    }>;

/** One declared upgrade of `source` into the target generation. */
export type StagedUpgrade = Readonly<{
  projectId: ProjectId;
  source: GenerationRow;
  targetGenerationId: StorageGenerationId;
  upgradeId: ProjectStorageUpgradeId;
  createRequestFingerprint: string;
  startedAt: string;
}>;

export type MigratedUpgrade = Readonly<{
  canonical: DatabaseHead;
  runtime: DatabaseHead;
  projectSequence: number;
  runtimeWaterline: number;
}>;

export type UpgradeAbandonedEvent = Readonly<{
  projectId: ProjectId;
  upgradeId: ProjectStorageUpgradeId;
  reason: "failed" | "interrupted";
}>;
type UpgradeDiscardFailedEvent = Readonly<{
  projectId: ProjectId;
  upgradeId: ProjectStorageUpgradeId;
  cause: "busy" | "broken" | "unproven";
}>;

/** The in-progress marker of an upgrade that did not finish. */
export type UnfinishedUpgrade = Readonly<{
  projectId: ProjectId;
  storageId: StorageId;
  upgradeId: ProjectStorageUpgradeId;
  sourceGenerationId: StorageGenerationId;
  targetGenerationId: StorageGenerationId;
}>;

export type UnfinishedProof =
  | Readonly<{ status: "proven"; retainedGenerationIds: readonly StorageGenerationId[] }>
  | Readonly<{ status: "unproven" }>;

/** Diagnostics of discarded and undiscardable upgrades; ids and a class only. */
export type ProjectStorageUpgradeDiagnostics = Readonly<{
  abandoned(event: UpgradeAbandonedEvent): void;
  discardFailed(event: UpgradeDiscardFailedEvent): void;
}>;

/** The Storage-adapter steps of a staged upgrade; each step is all-or-nothing on its own. */
export interface ProjectStorageUpgradeSteps extends ProjectStorageUpgradeDiagnostics {
  /**
   * The Project's in-progress marker. A registry that cannot be queried answers none; marker
   * rows that were read but do not decode, or more than one, reject with
   * `ProjectStorageBrokenError("Project Storage upgrade marker is invalid.")`.
   */
  findUnfinished(projectId: ProjectId): Promise<UnfinishedUpgrade | undefined>;
  /** Proven leftovers answer the generations the Project keeps; anything else is unproven. */
  proveUnfinished(upgrade: UnfinishedUpgrade): Promise<UnfinishedProof>;
  releaseUnfinished(upgrade: UnfinishedUpgrade): Promise<void>;
  plan(projectId: ProjectId, sourceGenerationId: StorageGenerationId): Promise<UpgradePlan>;
  declare(upgrade: StagedUpgrade): Promise<void>;
  copyBackup(upgrade: StagedUpgrade): Promise<void>;
  verifyBackup(upgrade: StagedUpgrade): Promise<"verified" | "invalid">;
  sealBackup(upgrade: StagedUpgrade, applicationVersion: string): Promise<void>;
  stage(upgrade: StagedUpgrade): Promise<void>;
  migrate(
    upgrade: StagedUpgrade,
    canonicalMigrations: readonly GeneratedMigration[],
  ): Promise<MigratedUpgrade>;
  verifyStaged(
    upgrade: StagedUpgrade,
    canonicalMigrations: readonly GeneratedMigration[],
  ): Promise<"verified" | "mismatch">;
  switchActive(upgrade: StagedUpgrade, activatedAt: string): Promise<void>;
}
