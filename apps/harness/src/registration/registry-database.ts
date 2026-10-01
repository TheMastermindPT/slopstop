import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireDeclaredSchemaObjects, tableNames } from "../storage/database-schema-verifier.js";
import { loadGeneratedMigrations } from "../storage/generated-migration-resources.js";
import type { GeneratedMigration } from "../storage/generated-migrations.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlResultSet,
  type LocalLibsqlTransaction,
} from "../storage/local-libsql-worker-client.js";
import {
  type DatabaseSpec,
  databaseSpecs,
  previousApplicationDatabaseSpec,
  previousIdentityQueryDatabaseSpec,
  previousProposalDatabaseSpec,
  previousRegistrationDatabaseSpec,
  previousReservationDatabaseSpec,
} from "../storage/project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "../storage/project-storage-errors.js";
import {
  lstatIfPresent,
  requirePlainEntry,
} from "../storage/project-storage-filesystem-authority.js";
import {
  type ClassifiedWriteTransactionOutcome,
  runClassifiedWriteTransaction,
  withWriteTransaction,
} from "../storage/project-storage-transaction.js";
import { RegistryFault } from "./registry-failure.js";

export type RegistrationDatabaseOptions = Readonly<{
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
  failures?: Readonly<{
    checkpoint(
      point:
        | "before-ddl"
        | "after-ddl"
        | "before-metadata"
        | "before-commit"
        | "commit-before-boundary"
        | "commit-acknowledgement",
    ): Promise<void>;
  }>;
}>;

export type RegistryRunner = <Result>(
  operation: (client: LocalLibsqlClient) => Promise<Result>,
) => Promise<Result>;

export type PreparedRegistryRunner = <Prepared, Result>(
  prepare: () => Promise<Prepared>,
  operation: (prepared: Prepared, reopen: RegistryRunner) => Promise<Result>,
) => Promise<Result>;

export const PREVIOUS_REGISTRY_HEAD = "0000_gray_eddie_brock";
export const CURRENT_REGISTRY_HEAD = "0005_registration_publications";

const noMigrationFailures = { checkpoint: async (_point: string) => undefined };
function migrationFailures(options: RegistrationDatabaseOptions) {
  return options.failures ?? noMigrationFailures;
}

const sqliteVersionSchema = z
  .union([z.number().int(), z.bigint()])
  .transform(Number)
  .pipe(z.number().int().nonnegative());

const metadataSchema = z.strictObject({
  metadataKey: z.literal("application"),
  databaseKind: z.literal("application"),
  formatVersion: sqliteVersionSchema,
  schemaVersion: sqliteVersionSchema,
  lastMigrationId: z.string().min(1),
});

const healthyIntegritySchema = z.tuple([z.tuple([z.literal("ok")])]);
const supportedVersionsSchema = z.object({
  formatVersion: z.literal(1),
  schemaVersion: z.literal(1),
});

export function registryRows(result: LocalLibsqlResultSet): unknown[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((name, index) => [name, row[index]])),
  );
}

async function requireRegistrySchema(
  transaction: LocalLibsqlTransaction,
  spec: DatabaseSpec,
): Promise<void> {
  try {
    await requireDeclaredSchemaObjects(transaction, spec);
    await requireRegistryRelationships(transaction);
  } catch (error) {
    if (isDefiniteSchemaMismatch(error)) {
      throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
    }
    throw error;
  }
}

async function requireRegistryRelationships(transaction: LocalLibsqlTransaction): Promise<void> {
  const conflicts = await transaction.execute(
    "SELECT 1 FROM storage_generations AS g LEFT JOIN storage_registrations AS r ON r.storage_id = g.storage_id WHERE r.storage_id IS NULL OR r.project_id <> g.project_id LIMIT 1",
  );
  if (conflicts.rows.length !== 0) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  const activeConflicts = await transaction.execute(`
      SELECT 1 FROM storage_registrations AS r
      JOIN storage_generations AS g
        ON g.storage_id = r.storage_id AND g.generation_id = r.active_generation_id
      JOIN storage_locations AS l
        ON l.storage_id = r.storage_id AND l.location_id = r.active_location_id
      WHERE g.creation_state <> 'active' OR l.location_state <> 'committed'
        OR g.location_id <> r.active_location_id OR g.activated_at IS NOT r.activated_at
      UNION ALL
      SELECT 1 FROM storage_generations AS g
      JOIN storage_registrations AS r ON r.storage_id = g.storage_id
      WHERE g.creation_state = 'active' AND r.active_generation_id IS NOT g.generation_id
      LIMIT 1`);
  if (activeConflicts.rows.length !== 0) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
}

function isDefiniteSchemaMismatch(error: unknown): error is ProjectStorageBrokenError {
  return error instanceof ProjectStorageBrokenError && error.cause === undefined;
}

async function requireIntegrity(transaction: LocalLibsqlTransaction): Promise<void> {
  const integrity = await transaction.execute("PRAGMA integrity_check");
  if (!healthyIntegritySchema.safeParse(integrity.rows).success) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  if ((await transaction.execute("PRAGMA foreign_key_check")).rows.length !== 0) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
}

type RegistryOpenMode = "initialize-or-open" | "existing-only";

async function prepareFile(
  options: RegistrationDatabaseOptions,
  mode: RegistryOpenMode,
): Promise<{ databasePath: string; fresh: boolean }> {
  const root = path.resolve(options.applicationStorageRoot);
  const databasePath = path.join(root, "application.db");
  if (mode === "existing-only") {
    await requireExistingRegistryFile(options, databasePath);
    return { databasePath, fresh: false };
  }
  const existing = await lstatIfPresent({ targetPath: databasePath });
  const rootEntry = await lstatIfPresent({ targetPath: root });
  if (rootEntry !== undefined) {
    await requirePlainEntry({
      entryPath: root,
      kind: "directory",
      message: "Registration root is invalid.",
    });
  }
  if (existing !== undefined) {
    await requirePlainEntry({
      entryPath: databasePath,
      kind: "file",
      message: "Registration registry is invalid.",
    });
    return { databasePath, fresh: false };
  }
  if (rootEntry !== undefined && (await readdir(root)).length > 0) {
    throw new RegistryFault({ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" });
  }
  await mkdir(root, { recursive: true });
  return { databasePath, fresh: true };
}

async function readRegistryMetadata(transaction: LocalLibsqlTransaction) {
  const parsed = z
    .tuple([metadataSchema])
    .safeParse(
      registryRows(
        await transaction.execute(
          "SELECT metadata_key AS metadataKey, database_kind AS databaseKind, format_version AS formatVersion, schema_version AS schemaVersion, last_migration_id AS lastMigrationId FROM schema_metadata",
        ),
      ),
    );
  if (!parsed.success) throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  return parsed.data[0];
}

function requireSupportedVersions(metadata: z.infer<typeof metadataSchema>): void {
  if (metadata.formatVersion > 1 || metadata.schemaVersion > 1) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_SCHEMA_NEWER" });
  }
  if (!supportedVersionsSchema.safeParse(metadata).success) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" });
  }
}

async function firstRequiredMigration(
  transaction: LocalLibsqlTransaction,
  fresh: boolean,
): Promise<number | null> {
  const names = await tableNames(transaction);
  if (names.length === 0) {
    if (!fresh) throw new Error("Existing registration registry has no schema.");
    return 0;
  }
  await requireIntegrity(transaction);
  const metadata = await readRegistryMetadata(transaction);
  requireSupportedVersions(metadata);
  if (metadata.lastMigrationId === CURRENT_REGISTRY_HEAD) {
    await requireRegistrySchema(transaction, databaseSpecs.application);
    return null;
  }
  if (metadata.lastMigrationId === "0001_project_registration") {
    await requireRegistrySchema(transaction, previousRegistrationDatabaseSpec);
    return 2;
  }
  if (metadata.lastMigrationId === "0002_identity_query_attempts") {
    await requireRegistrySchema(transaction, previousIdentityQueryDatabaseSpec);
    return 3;
  }
  if (metadata.lastMigrationId === "0003_registration_proposals") {
    await requireRegistrySchema(transaction, previousProposalDatabaseSpec);
    return 4;
  }
  if (metadata.lastMigrationId === "0004_registration_reservations") {
    await requireRegistrySchema(transaction, previousReservationDatabaseSpec);
    return 5;
  }
  if (metadata.lastMigrationId !== PREVIOUS_REGISTRY_HEAD) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" });
  }
  await requireRegistrySchema(transaction, previousApplicationDatabaseSpec);
  return 1;
}

async function applyRegistryStatements(
  transaction: LocalLibsqlTransaction,
  migrations: readonly GeneratedMigration[],
): Promise<void> {
  for (const migration of migrations) {
    for (const statement of migration.statements) await transaction.execute(statement);
  }
}

function migrationClient(
  client: LocalLibsqlClient,
  options: RegistrationDatabaseOptions,
): Pick<LocalLibsqlClient, "transaction"> {
  const failures = migrationFailures(options);
  return {
    transaction: async (mode) => {
      const inner = await client.transaction(mode);
      const guarded: LocalLibsqlTransaction = {
        get closed() {
          return inner.closed;
        },
        execute: (statement, args) => inner.execute(statement, args),
        commit: async () => {
          await failures.checkpoint("commit-before-boundary");
          await inner.commit();
          await failures.checkpoint("commit-acknowledgement");
        },
        rollback: () => inner.rollback(),
        close: () => inner.close(),
      };
      return guarded;
    },
  };
}

async function migrateRegistry(
  client: LocalLibsqlClient,
  options: RegistrationDatabaseOptions,
  fresh: boolean,
): Promise<ClassifiedWriteTransactionOutcome<void>> {
  const failures = migrationFailures(options);
  const migrations = await loadGeneratedMigrations(
    options.migrationResourcesRoot,
    databaseSpecs.application,
  );
  if (migrations.at(-1)?.migrationId !== CURRENT_REGISTRY_HEAD)
    throw new Error("Registration migration resources are incompatible.");
  return runClassifiedWriteTransaction(migrationClient(client, options), async (transaction) => {
    const firstMigration = await firstRequiredMigration(transaction, fresh);
    if (firstMigration === null) return;
    await failures.checkpoint("before-ddl");
    await applyRegistryStatements(transaction, migrations.slice(firstMigration));
    await failures.checkpoint("after-ddl");
    await failures.checkpoint("before-metadata");
    await transaction.execute({
      sql: "INSERT INTO schema_metadata (metadata_key, database_kind, format_version, schema_version, last_migration_id) VALUES ('application', 'application', 1, 1, ?) ON CONFLICT(metadata_key) DO UPDATE SET last_migration_id = excluded.last_migration_id",
      args: [CURRENT_REGISTRY_HEAD],
    });
    await requireRegistrySchema(transaction, databaseSpecs.application);
    await requireIntegrity(transaction);
    await failures.checkpoint("before-commit");
  });
}

async function requireForeignKeys(client: LocalLibsqlClient): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  const enabled = await client.execute("PRAGMA foreign_keys");
  if (Number(enabled.rows[0]?.[0]) !== 1)
    throw new Error("Registration foreign-key enforcement unavailable.");
}

async function requireExistingRegistryFile(
  options: RegistrationDatabaseOptions,
  databasePath: string,
): Promise<void> {
  if ((await lstatIfPresent({ targetPath: databasePath })) === undefined) {
    throw new RegistryFault({ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" });
  }
  await requirePlainEntry({
    entryPath: options.applicationStorageRoot,
    kind: "directory",
    message: "Registration root is invalid.",
  });
  await requirePlainEntry({
    entryPath: databasePath,
    kind: "file",
    message: "Registration registry is invalid.",
  });
}

export async function withRegistrationDatabase<Result>(
  options: RegistrationDatabaseOptions,
  operation: (client: LocalLibsqlClient) => Promise<Result>,
  mode: RegistryOpenMode = "initialize-or-open",
): Promise<Result> {
  const prepared = await prepareFile(options, mode);
  let client: LocalLibsqlClient | undefined = createWorkerLocalLibsqlClient(
    prepared.databasePath,
    "application",
  );
  try {
    await requireForeignKeys(client);
    const migration = await migrateRegistry(client, options, prepared.fresh);
    if (migration.status === "failed") {
      if (migration.commit !== "uncertain") throw migration.error;
      await client.close();
      client = undefined;
      await requireExistingRegistryFile(options, prepared.databasePath);
      client = createWorkerLocalLibsqlClient(prepared.databasePath, "application");
      await requireForeignKeys(client);
      await withWriteTransaction(client, async (transaction) => {
        const remaining = await firstRequiredMigration(transaction, false);
        if (remaining !== null) throw migration.error;
      });
    }
    return await operation(client);
  } finally {
    await client?.close();
  }
}
