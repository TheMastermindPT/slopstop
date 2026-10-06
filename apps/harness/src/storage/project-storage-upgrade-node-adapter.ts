import path from "node:path";
import { decodeStrict, type ProjectId, type StorageGenerationId } from "@slopstop/protocol";
import { Schema } from "effect";
import { type GeneratedMigration, planUpgradeMigrations } from "./generated-migrations.js";
import {
  type LocalLibsqlClient,
  type LocalLibsqlTransaction,
  withDatabase,
} from "./local-libsql-worker-client.js";
import { type DatabaseSpec, databaseSpecs } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  canonicalDatabaseFilename,
  parseProjectStorageManifest,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
  serializeProjectStorageBackupManifest,
} from "./project-storage-manifest.js";
import { normalizeStorageError } from "./project-storage-node-errors.js";
import {
  type GenerationRow,
  generationRowColumns,
  generationRowSchema,
  integerScalar,
  type MetadataRow,
  resultObjects,
} from "./project-storage-node-schemas.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";
import { withWriteTransaction } from "./project-storage-transaction.js";
import type {
  DatabaseHead,
  MigratedUpgrade,
  ProjectStorageUpgradeSteps,
  StagedUpgrade,
} from "./project-storage-upgrade.js";
import { classifyUpgradeStatements } from "./project-storage-upgrade-eligibility.js";
import { verifyBackupCopies, verifyStagedCopies } from "./project-storage-upgrade-verification.js";

type OwnedDatabaseSpec = typeof databaseSpecs.canonical | typeof databaseSpecs.runtime;

export type UpgradeAdapterContext = Readonly<{
  /** The existing application database client, checked current before it is answered. */
  applicationClient(): Promise<LocalLibsqlClient>;
  loadMigrations(spec: DatabaseSpec): Promise<readonly GeneratedMigration[]>;
  readMetadata(client: LocalLibsqlClient, spec: DatabaseSpec): Promise<MetadataRow>;
  paths: ProjectStorageStoreDependencies["paths"];
  files: ProjectStorageStoreDependencies["files"];
  sha256File(filePath: string): Promise<string>;
  failures: ProjectStorageStoreDependencies["failures"];
}>;

type BackupPaths = Readonly<{
  root: string;
  canonicalDatabase: string;
  runtimeDatabase: string;
  manifest: string;
}>;

function backupPaths(context: UpgradeAdapterContext, upgrade: StagedUpgrade): BackupPaths {
  const projectRoot = context.paths.forCreation(
    upgrade.projectId,
    upgrade.targetGenerationId,
  ).projectRoot;
  const root = path.join(projectRoot, "snapshots", upgrade.upgradeId);
  return {
    root,
    canonicalDatabase: path.join(root, canonicalDatabaseFilename),
    runtimeDatabase: path.join(root, runtimeDatabaseFilename),
    manifest: path.join(root, projectStorageManifestFilename),
  };
}

async function baselineOf(context: UpgradeAdapterContext, filePath: string) {
  return {
    algorithm: "sha256",
    sizeBytes: await context.files.size(filePath),
    sha256: await context.sha256File(filePath),
  } as const;
}

async function lastProjectSequence(databasePath: string): Promise<number> {
  return withDatabase(databasePath, { readOnly: true }, async (client) => {
    const sequence = integerScalar(
      await client.execute("SELECT last_project_sequence FROM project_state"),
    );
    if (sequence === undefined) {
      throw new ProjectStorageBrokenError("Project Storage upgrade source sequence is invalid.");
    }
    return sequence;
  });
}

/** Writes the backup manifest exclusively from the backup files and the source manifest. */
async function sealBackupManifest(
  context: UpgradeAdapterContext,
  upgrade: StagedUpgrade,
  applicationVersion: string,
): Promise<void> {
  const backup = backupPaths(context, upgrade);
  const sourcePaths = context.paths.forCreation(upgrade.projectId, upgrade.source.generationId);
  const source = parseProjectStorageManifest(
    await context.files.readFile(sourcePaths.active.manifest),
  );
  const manifest = serializeProjectStorageBackupManifest({
    manifestVersion: 1,
    kind: "pre-upgrade-backup",
    backupId: upgrade.upgradeId,
    projectId: upgrade.projectId,
    storageId: upgrade.source.storageId,
    sourceGenerationId: upgrade.source.generationId,
    canonical: {
      ...source.canonical,
      activationBaseline: await baselineOf(context, backup.canonicalDatabase),
    },
    runtime: {
      ...source.runtime,
      activationBaseline: await baselineOf(context, backup.runtimeDatabase),
    },
    projectSequence: await lastProjectSequence(backup.canonicalDatabase),
    runtimeWaterline: source.runtimeWaterline,
    producingApplicationVersion: applicationVersion,
    createdAt: upgrade.startedAt,
  });
  await context.files.writeFileExclusive(backup.manifest, manifest);
}

function requireOneRow(rowsAffected: number, message: string): void {
  if (rowsAffected !== 1) throw new ProjectStorageBrokenError(message);
}

async function readSourceGeneration(
  client: LocalLibsqlClient,
  projectId: ProjectId,
  generationId: StorageGenerationId,
): Promise<GenerationRow> {
  const result = await client.execute({
    sql: `SELECT ${generationRowColumns} FROM storage_generations
      WHERE project_id = ? AND generation_id = ?`,
    args: [projectId, generationId],
  });
  const [source, ...others] = decodeStrict(
    Schema.Array(generationRowSchema),
    resultObjects(result),
  );
  if (source?.creationState !== "active" || others.length > 0) {
    throw new ProjectStorageBrokenError(
      "Project Storage upgrade source is not the active generation.",
    );
  }
  return source;
}

async function insertUpgradeDeclaration(
  transaction: LocalLibsqlTransaction,
  upgrade: StagedUpgrade,
): Promise<void> {
  const { source } = upgrade;
  const declared = await transaction.execute({
    sql: `INSERT INTO storage_upgrades
      (upgrade_id, storage_id, project_id, location_id, source_generation_id,
        target_generation_id, source_canonical_lineage_id, source_runtime_lineage_id,
        source_create_request_id, source_create_request_fingerprint, source_created_at,
        source_activated_at, state, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in-progress', ?, NULL)`,
    args: [
      upgrade.upgradeId,
      source.storageId,
      source.projectId,
      source.locationId,
      source.generationId,
      upgrade.targetGenerationId,
      source.canonicalDatabaseLineageId,
      source.runtimeDatabaseLineageId,
      source.createRequestId,
      source.createRequestFingerprint,
      source.createdAt,
      source.activatedAt,
      upgrade.startedAt,
    ],
  });
  requireOneRow(declared.rowsAffected, "Project Storage upgrade was not declared exactly once.");
}

async function insertTargetStaging(
  transaction: LocalLibsqlTransaction,
  upgrade: StagedUpgrade,
): Promise<void> {
  const { source } = upgrade;
  const staged = await transaction.execute({
    sql: `INSERT INTO storage_generations
      (storage_id, generation_id, project_id, location_id, canonical_lineage_id,
        runtime_lineage_id, create_request_id, create_request_fingerprint,
        generation_directory_name, creation_state, created_at, activated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staging', ?, NULL)`,
    args: [
      source.storageId,
      upgrade.targetGenerationId,
      source.projectId,
      source.locationId,
      source.canonicalDatabaseLineageId,
      source.runtimeDatabaseLineageId,
      upgrade.upgradeId,
      upgrade.createRequestFingerprint,
      upgrade.targetGenerationId,
      upgrade.startedAt,
    ],
  });
  requireOneRow(staged.rowsAffected, "Project Storage upgrade target was not staged exactly once.");
}

async function vacuumInto(sourcePath: string, targetPath: string): Promise<void> {
  await withDatabase(sourcePath, { readOnly: true }, async (client) => {
    await client.execute({ sql: "VACUUM INTO ?", args: [targetPath] });
  });
}

async function updateIdentity(
  transaction: LocalLibsqlTransaction,
  spec: OwnedDatabaseSpec,
  upgrade: StagedUpgrade,
): Promise<void> {
  const table =
    spec.databaseKind === "canonical" ? "storage_identity" : "slopstop_runtime_storage_identity";
  const updated = await transaction.execute({
    sql: `UPDATE ${table} SET generation_id = ?, created_at = ? WHERE identity_key = 'storage'`,
    args: [upgrade.targetGenerationId, upgrade.startedAt],
  });
  requireOneRow(updated.rowsAffected, "Staged database identity was not updated exactly once.");
}

async function migrateCanonical(
  transaction: LocalLibsqlTransaction,
  migrations: readonly GeneratedMigration[],
): Promise<void> {
  const spec = databaseSpecs.canonical;
  const last = migrations.at(-1);
  if (last === undefined)
    throw new ProjectStorageBrokenError("Project Storage upgrade plan is empty.");
  for (const migration of migrations) {
    for (const statement of migration.statements) await transaction.execute(statement);
  }
  const head = await transaction.execute({
    sql: `UPDATE ${spec.metadataTable} SET format_version = ?, schema_version = ?,
      last_migration_id = ? WHERE metadata_key = ?`,
    args: [spec.formatVersion, spec.schemaVersion, last.migrationId, spec.metadataKey],
  });
  requireOneRow(head.rowsAffected, "Staged database head was not updated exactly once.");
}

async function migrateStagedDatabase(
  context: UpgradeAdapterContext,
  input: Readonly<{
    databasePath: string;
    spec: OwnedDatabaseSpec;
    upgrade: StagedUpgrade;
    migrations: readonly GeneratedMigration[];
  }>,
): Promise<DatabaseHead> {
  return withDatabase(input.databasePath, { readOnly: false }, async (client) => {
    await withWriteTransaction(client, async (transaction) => {
      if (input.migrations.length > 0) await migrateCanonical(transaction, input.migrations);
      await updateIdentity(transaction, input.spec, input.upgrade);
    });
    const metadata = await context.readMetadata(client, input.spec);
    return {
      formatVersion: metadata.formatVersion,
      schemaVersion: metadata.schemaVersion,
      lastMigrationId: metadata.lastMigrationId,
    };
  });
}

/** The source generation row still equals the copy the upgrade declared. */
async function requireUnchangedSource(
  transaction: LocalLibsqlTransaction,
  upgrade: StagedUpgrade,
): Promise<void> {
  const unchanged = await transaction.execute({
    sql: `SELECT 1 FROM storage_generations AS g JOIN storage_upgrades AS u
      ON u.source_generation_id = g.generation_id AND u.storage_id = g.storage_id
      WHERE u.upgrade_id = ? AND u.state = 'in-progress' AND g.creation_state = 'active'
        AND g.project_id = u.project_id AND g.location_id = u.location_id
        AND g.canonical_lineage_id = u.source_canonical_lineage_id
        AND g.runtime_lineage_id = u.source_runtime_lineage_id
        AND g.create_request_id = u.source_create_request_id
        AND g.create_request_fingerprint = u.source_create_request_fingerprint
        AND g.created_at = u.source_created_at
        AND g.activated_at IS u.source_activated_at`,
    args: [upgrade.upgradeId],
  });
  if (unchanged.rows.length !== 1) {
    throw new ProjectStorageBrokenError(
      "Project Storage upgrade source changed before the switch.",
    );
  }
}

async function switchRows(
  transaction: LocalLibsqlTransaction,
  upgrade: StagedUpgrade,
  activatedAt: string,
  failures: UpgradeAdapterContext["failures"],
): Promise<void> {
  const { source } = upgrade;
  const registration = await transaction.execute({
    sql: `UPDATE storage_registrations SET active_generation_id = ?, activated_at = ?
      WHERE storage_id = ? AND project_id = ? AND active_generation_id = ?`,
    args: [
      upgrade.targetGenerationId,
      activatedAt,
      source.storageId,
      source.projectId,
      source.generationId,
    ],
  });
  requireOneRow(registration.rowsAffected, "Project Storage registration was not switched.");
  await failures.checkpoint("during-upgrade-switch");
  const removed = await transaction.execute({
    sql: `DELETE FROM storage_generations
      WHERE storage_id = ? AND generation_id = ? AND creation_state = 'active'`,
    args: [source.storageId, source.generationId],
  });
  requireOneRow(removed.rowsAffected, "Project Storage source generation was not superseded.");
  const activated = await transaction.execute({
    sql: `UPDATE storage_generations SET creation_state = 'active', activated_at = ?
      WHERE storage_id = ? AND generation_id = ? AND creation_state = 'staging'`,
    args: [activatedAt, source.storageId, upgrade.targetGenerationId],
  });
  requireOneRow(activated.rowsAffected, "Project Storage upgrade target was not activated.");
  const completed = await transaction.execute({
    sql: `UPDATE storage_upgrades SET state = 'completed', completed_at = ?
      WHERE upgrade_id = ? AND state = 'in-progress'`,
    args: [activatedAt, upgrade.upgradeId],
  });
  requireOneRow(completed.rowsAffected, "Project Storage upgrade was not completed.");
}

/**
 * Normalizes unknown errors of a registry step to `ProjectStorageBrokenError`, as the staging
 * declaration does; the other steps keep their errors for the owner's mapping.
 */
async function guarded<Value>(message: string, run: () => Promise<Value>): Promise<Value> {
  try {
    return await run();
  } catch (error) {
    normalizeStorageError({ error, message });
  }
}

/** The canonical head a plan's last pending migration moves the database to. */
function packagedHead(migrations: readonly GeneratedMigration[]): DatabaseHead {
  const last = migrations.at(-1);
  if (last === undefined)
    throw new ProjectStorageBrokenError("Project Storage upgrade plan is empty.");
  const spec = databaseSpecs.canonical;
  return {
    formatVersion: spec.formatVersion,
    schemaVersion: spec.schemaVersion,
    lastMigrationId: last.migrationId,
  };
}

/** Node adapters for the staged-upgrade steps over the application and Project databases. */
export function createProjectStorageUpgradeSteps(
  context: UpgradeAdapterContext,
): ProjectStorageUpgradeSteps {
  const generationPaths = (projectId: ProjectId, generationId: StorageGenerationId) =>
    context.paths.forCreation(projectId, generationId);
  return {
    plan: (projectId, sourceGenerationId) =>
      (async () => {
        const source = await readSourceGeneration(
          await context.applicationClient(),
          projectId,
          sourceGenerationId,
        );
        const spec = databaseSpecs.canonical;
        const metadata = await withDatabase(
          generationPaths(projectId, sourceGenerationId).active.canonicalDatabase,
          { readOnly: true },
          (client) => context.readMetadata(client, spec),
        );
        const canonicalMigrations = planUpgradeMigrations({
          expectedKind: spec.databaseKind,
          expectedFormatVersion: spec.formatVersion,
          expectedSchemaVersion: spec.schemaVersion,
          migrations: await context.loadMigrations(spec),
          authority: { status: "existing", ...metadata },
        });
        const eligibility = classifyUpgradeStatements(
          canonicalMigrations.flatMap((migration) => migration.statements),
        );
        if (eligibility.status === "empty") {
          throw new ProjectStorageBrokenError("Project Storage upgrade plan is empty.");
        }
        if (eligibility.status === "unsupported") return { status: "unsupported" };
        return { status: "eligible", source, canonicalMigrations };
      })(),
    declare: (upgrade) =>
      guarded("Project Storage upgrade declaration failed.", async () => {
        const client = await context.applicationClient();
        await withWriteTransaction(client, async (transaction) => {
          await insertUpgradeDeclaration(transaction, upgrade);
          await context.failures.checkpoint("during-upgrade-declare");
          await insertTargetStaging(transaction, upgrade);
        });
      }),
    copyBackup: (upgrade) =>
      (async () => {
        const source = generationPaths(upgrade.projectId, upgrade.source.generationId).active;
        const backup = backupPaths(context, upgrade);
        await context.files.createDirectoryInProject(backup.root);
        await vacuumInto(source.canonicalDatabase, backup.canonicalDatabase);
        await vacuumInto(source.runtimeDatabase, backup.runtimeDatabase);
      })(),
    verifyBackup: (upgrade) =>
      verifyBackupCopies({
        source: generationPaths(upgrade.projectId, upgrade.source.generationId).active,
        backup: backupPaths(context, upgrade),
      }),
    sealBackup: (upgrade, applicationVersion) =>
      sealBackupManifest(context, upgrade, applicationVersion),
    stage: (upgrade) =>
      (async () => {
        const source = generationPaths(upgrade.projectId, upgrade.source.generationId).active;
        const target = generationPaths(upgrade.projectId, upgrade.targetGenerationId).staging;
        await context.files.createDirectoryInProject(target.root);
        await vacuumInto(source.canonicalDatabase, target.canonicalDatabase);
        await vacuumInto(source.runtimeDatabase, target.runtimeDatabase);
      })(),
    migrate: (upgrade, migrations): Promise<MigratedUpgrade> =>
      (async () => {
        const target = generationPaths(upgrade.projectId, upgrade.targetGenerationId).staging;
        const canonical = await migrateStagedDatabase(context, {
          databasePath: target.canonicalDatabase,
          spec: databaseSpecs.canonical,
          upgrade,
          migrations,
        });
        const runtime = await migrateStagedDatabase(context, {
          databasePath: target.runtimeDatabase,
          spec: databaseSpecs.runtime,
          upgrade,
          migrations: [],
        });
        const sourceManifest = parseProjectStorageManifest(
          await context.files.readFile(
            generationPaths(upgrade.projectId, upgrade.source.generationId).active.manifest,
          ),
        );
        return {
          canonical,
          runtime,
          projectSequence: await lastProjectSequence(target.canonicalDatabase),
          runtimeWaterline: sourceManifest.runtimeWaterline,
        };
      })(),
    verifyStaged: (upgrade, canonicalMigrations) =>
      verifyStagedCopies({
        upgrade,
        canonicalHead: packagedHead(canonicalMigrations),
        source: generationPaths(upgrade.projectId, upgrade.source.generationId).active,
        staged: generationPaths(upgrade.projectId, upgrade.targetGenerationId).staging,
      }),
    switchActive: (upgrade, activatedAt) =>
      guarded("Project Storage upgrade switch failed.", async () => {
        const client = await context.applicationClient();
        await withWriteTransaction(client, async (transaction) => {
          await requireUnchangedSource(transaction, upgrade);
          await switchRows(transaction, upgrade, activatedAt, context.failures);
        });
      }),
  };
}

const completedUpgradeSchema = Schema.Struct({
  upgradeId: generationRowSchema.fields.createRequestId,
  sourceGenerationId: generationRowSchema.fields.generationId,
  targetGenerationId: generationRowSchema.fields.generationId,
  sourceCreatedAt: generationRowSchema.fields.createdAt,
});
export type CompletedUpgrade = typeof completedUpgradeSchema.Type;

/**
 * The single completed upgrade of a Storage, if any. A registry head older than the upgrade
 * table has none; more than one is broken until chained upgrades are supported.
 */
export async function completedUpgradeFor(
  client: Pick<LocalLibsqlClient, "execute">,
  storageId: GenerationRow["storageId"],
): Promise<CompletedUpgrade | undefined> {
  const table = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'storage_upgrades'",
  );
  if (table.rows.length === 0) return undefined;
  const result = await client.execute({
    sql: `SELECT upgrade_id AS upgradeId, source_generation_id AS sourceGenerationId,
      target_generation_id AS targetGenerationId, source_created_at AS sourceCreatedAt FROM storage_upgrades
      WHERE storage_id = ? AND state = 'completed'`,
    args: [storageId],
  });
  const rows = decodeStrict(Schema.Array(completedUpgradeSchema), resultObjects(result));
  if (rows.length > 1) {
    throw new ProjectStorageBrokenError("Project Storage upgrade authority is not unique.");
  }
  return rows[0];
}

const upgradedCreateSchema = Schema.Struct({
  projectId: generationRowSchema.fields.projectId,
  createRequestFingerprint: generationRowSchema.fields.createRequestFingerprint,
});
export type UpgradedCreateRequest = typeof upgradedCreateSchema.Type;

/** The original create request of a generation a completed upgrade superseded, if any. */
export async function upgradedCreateRequest(
  client: Pick<LocalLibsqlClient, "execute">,
  createRequestId: GenerationRow["createRequestId"],
): Promise<UpgradedCreateRequest | undefined> {
  const table = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'storage_upgrades'",
  );
  if (table.rows.length === 0) return undefined;
  const result = await client.execute({
    sql: `SELECT project_id AS projectId,
      source_create_request_fingerprint AS createRequestFingerprint
      FROM storage_upgrades WHERE source_create_request_id = ? AND state = 'completed'`,
    args: [createRequestId],
  });
  const [row, ...others] = decodeStrict(Schema.Array(upgradedCreateSchema), resultObjects(result));
  if (others.length > 0) {
    throw new ProjectStorageBrokenError("Create request authority is not unique.");
  }
  return row;
}
