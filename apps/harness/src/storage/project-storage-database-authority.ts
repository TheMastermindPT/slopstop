import { decodeStrict } from "@slopstop/protocol";
import { Schema } from "effect";
import { tableNames } from "./database-schema-verifier.js";
import type {
  GeneratedMigration,
  GeneratedMigrationTarget,
  MigrationAuthority,
} from "./generated-migrations.js";
import type { LocalLibsqlResultSet } from "./local-libsql-worker-client.js";
import type { DatabaseSpec, databaseSpecs } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  canonicalIdentityRowSchema,
  integerScalar,
  type MetadataRow,
  metadataRowSchema,
  resultObjects,
  runtimeIdentityRowSchema,
} from "./project-storage-node-schemas.js";
import {
  type AllocatedCreation,
  exactlyOne,
  type LocalClient,
  type LocalTransaction,
} from "./project-storage-node-support.js";
import { withWriteTransaction } from "./project-storage-transaction.js";

export async function metadataRows(
  client: LocalClient | LocalTransaction,
  spec: DatabaseSpec,
): Promise<readonly MetadataRow[]> {
  const result = await client.execute(
    `SELECT metadata_key AS metadataKey, database_kind AS databaseKind,
      format_version AS formatVersion, schema_version AS schemaVersion,
      last_migration_id AS lastMigrationId FROM ${spec.metadataTable}`,
  );
  return decodeStrict(Schema.Array(metadataRowSchema), resultObjects(result));
}

function migrationMetadataSql(spec: DatabaseSpec): string {
  return `INSERT INTO ${spec.metadataTable}
    (metadata_key, database_kind, format_version, schema_version, last_migration_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(metadata_key) DO UPDATE SET
      database_kind = excluded.database_kind,
      format_version = excluded.format_version,
      schema_version = excluded.schema_version,
      last_migration_id = excluded.last_migration_id`;
}

export function createMigrationTarget(
  client: LocalClient,
  spec: DatabaseSpec,
): GeneratedMigrationTarget {
  return {
    inspectAuthority: async (): Promise<MigrationAuthority> => {
      const names = await tableNames(client);
      if (!names.includes(spec.metadataTable)) {
        if (names.length === 0) return { status: "fresh" };
        throw new ProjectStorageBrokenError("Database metadata authority is missing.");
      }
      const metadata = exactlyOne(
        await metadataRows(client, spec),
        "Database metadata authority must contain exactly one row.",
      );
      if (metadata.metadataKey !== spec.metadataKey) {
        throw new ProjectStorageBrokenError("Database metadata singleton key is invalid.");
      }
      return {
        status: "existing",
        databaseKind: metadata.databaseKind,
        formatVersion: metadata.formatVersion,
        schemaVersion: metadata.schemaVersion,
        lastMigrationId: metadata.lastMigrationId,
      };
    },
    applyBatch: async (input) => {
      await withWriteTransaction(client, async (transaction) => {
        for (const migration of input.migrations) {
          for (const statement of migration.statements) {
            await transaction.execute(statement);
          }
        }
        await transaction.execute({
          sql: migrationMetadataSql(spec),
          args: [
            spec.metadataKey,
            input.databaseKind,
            input.formatVersion,
            input.schemaVersion,
            input.lastMigrationId,
          ],
        });
      });
    },
  };
}

export function assertKnownAuthority(
  authority: MigrationAuthority,
  migrations: readonly GeneratedMigration[],
  spec: DatabaseSpec,
): asserts authority is Extract<MigrationAuthority, { status: "existing" }> {
  if (authority.status === "fresh") {
    throw new ProjectStorageBrokenError("Existing database has no migration authority.");
  }
  const migrationIndex = migrations.findIndex(
    (migration) => migration.migrationId === authority.lastMigrationId,
  );
  if (
    authority.databaseKind !== spec.databaseKind ||
    authority.formatVersion !== spec.formatVersion ||
    authority.schemaVersion !== spec.schemaVersion ||
    migrationIndex < 0
  ) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
}

export function assertCurrentAuthority(
  authority: MigrationAuthority,
  migrations: readonly GeneratedMigration[],
  spec: DatabaseSpec,
): void {
  assertKnownAuthority(authority, migrations, spec);
  if (authority.lastMigrationId !== migrations.at(-1)?.migrationId) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
}

export async function requireForeignKeys(client: LocalClient): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  if (integerScalar(await client.execute("PRAGMA foreign_keys")) !== 1) {
    throw new ProjectStorageBrokenError("Database foreign-key enforcement is unavailable.");
  }
}

function stringScalarRows(result: LocalLibsqlResultSet): readonly string[] {
  const values: string[] = [];
  for (const row of result.rows) {
    const value = row[0];
    if (row.length !== 1 || typeof value !== "string") return [];
    values.push(value);
  }
  return values;
}

export async function inspectDatabaseIntegrity(client: LocalClient): Promise<
  Readonly<{
    foreignKeyViolationCount: number;
    integrityRows: readonly string[];
  }>
> {
  return {
    foreignKeyViolationCount: (await client.execute("PRAGMA foreign_key_check")).rows.length,
    integrityRows: stringScalarRows(await client.execute("PRAGMA integrity_check")),
  };
}

export async function requireDatabaseIntegrity(client: LocalClient): Promise<void> {
  const integrity = await inspectDatabaseIntegrity(client);
  if (integrity.foreignKeyViolationCount !== 0) {
    throw new ProjectStorageBrokenError("Database foreign-key integrity validation failed.");
  }
  const valid = integrity.integrityRows.length === 1 && integrity.integrityRows[0] === "ok";
  if (!valid) {
    throw new ProjectStorageBrokenError("Database integrity validation failed.");
  }
}

export async function requireApplicationIntegrity(client: LocalClient): Promise<void> {
  const integrity = await inspectDatabaseIntegrity(client);
  if (integrity.integrityRows.length !== 1 || integrity.integrityRows[0] !== "ok") {
    throw new ProjectStorageBrokenError("Project Storage application authority is corrupt.");
  }
  if (integrity.foreignKeyViolationCount !== 0) {
    throw new ProjectStorageBrokenError(
      "Project Storage application authority has foreign-key violations.",
    );
  }
}

function metadataIsStale(
  metadata: MetadataRow,
  spec: DatabaseSpec,
  lastMigration: GeneratedMigration | undefined,
): boolean {
  return (
    lastMigration === undefined ||
    metadata.metadataKey !== spec.metadataKey ||
    metadata.databaseKind !== spec.databaseKind ||
    metadata.formatVersion !== spec.formatVersion ||
    metadata.schemaVersion !== spec.schemaVersion ||
    metadata.lastMigrationId !== lastMigration.migrationId
  );
}

export async function requireCurrentMetadata(
  client: LocalClient,
  spec: DatabaseSpec,
  migrations: readonly GeneratedMigration[],
): Promise<MetadataRow> {
  const metadata = exactlyOne(
    await metadataRows(client, spec),
    "Database metadata authority must contain exactly one row.",
  );
  const lastMigration = migrations.at(-1);
  if (metadataIsStale(metadata, spec, lastMigration)) {
    throw new ProjectStorageBrokenError("Database metadata authority is not current.");
  }
  return metadata;
}

export async function insertDatabaseIdentity(
  client: LocalClient,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
): Promise<void> {
  if (spec.databaseKind === "canonical") {
    const row = decodeStrict(canonicalIdentityRowSchema, {
      identityKey: "storage",
      projectId: creation.projectId,
      storageId: creation.storageId,
      generationId: creation.generationId,
      canonicalDatabaseLineageId: creation.canonicalDatabaseLineageId,
      createdAt: creation.createdAt,
    });
    await client.execute({
      sql: `INSERT INTO storage_identity
        (identity_key, project_id, storage_id, generation_id,
          canonical_database_lineage_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        row.identityKey,
        row.projectId,
        row.storageId,
        row.generationId,
        row.canonicalDatabaseLineageId,
        row.createdAt,
      ],
    });
    return;
  }
  const row = decodeStrict(runtimeIdentityRowSchema, {
    identityKey: "storage",
    projectId: creation.projectId,
    storageId: creation.storageId,
    generationId: creation.generationId,
    runtimeDatabaseLineageId: creation.runtimeDatabaseLineageId,
    createdAt: creation.createdAt,
  });
  await client.execute({
    sql: `INSERT INTO slopstop_runtime_storage_identity
      (identity_key, project_id, storage_id, generation_id,
        runtime_database_lineage_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      row.identityKey,
      row.projectId,
      row.storageId,
      row.generationId,
      row.runtimeDatabaseLineageId,
      row.createdAt,
    ],
  });
}

export async function databaseIdentityMatches(
  client: LocalClient,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
): Promise<boolean> {
  if (spec.databaseKind === "canonical") {
    const result = await client.execute(
      `SELECT identity_key AS identityKey, project_id AS projectId,
        storage_id AS storageId, generation_id AS generationId,
        canonical_database_lineage_id AS canonicalDatabaseLineageId,
        created_at AS createdAt FROM storage_identity`,
    );
    const row = exactlyOne(
      decodeStrict(Schema.Array(canonicalIdentityRowSchema), resultObjects(result)),
      "Canonical Storage identity must contain exactly one row.",
    );
    return [
      row.projectId === creation.projectId,
      row.storageId === creation.storageId,
      row.generationId === creation.generationId,
      row.canonicalDatabaseLineageId === creation.canonicalDatabaseLineageId,
      row.createdAt === creation.createdAt,
    ].every(Boolean);
  }
  const result = await client.execute(
    `SELECT identity_key AS identityKey, project_id AS projectId,
      storage_id AS storageId, generation_id AS generationId,
      runtime_database_lineage_id AS runtimeDatabaseLineageId,
      created_at AS createdAt FROM slopstop_runtime_storage_identity`,
  );
  const row = exactlyOne(
    decodeStrict(Schema.Array(runtimeIdentityRowSchema), resultObjects(result)),
    "Runtime Storage identity must contain exactly one row.",
  );
  return [
    row.projectId === creation.projectId,
    row.storageId === creation.storageId,
    row.generationId === creation.generationId,
    row.runtimeDatabaseLineageId === creation.runtimeDatabaseLineageId,
    row.createdAt === creation.createdAt,
  ].every(Boolean);
}
