import { acceptsStrict, decodeStrictResult, NonEmptyTextSchema } from "@slopstop/protocol";
import { Result, Schema } from "effect";
import { requireDeclaredSchemaObjects, tableNames } from "./database-schema-verifier.js";
import { loadGeneratedMigrations } from "./generated-migration-resources.js";
import type { GeneratedMigration } from "./generated-migrations.js";
import type {
  LocalLibsqlClient,
  LocalLibsqlResultSet,
  LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";
import {
  type DatabaseSpec,
  databaseSpecs,
  previousApplicationDatabaseSpec,
  previousIdentityQueryDatabaseSpec,
  previousProposalDatabaseSpec,
  previousPublicationDatabaseSpec,
  previousRegistrationDatabaseSpec,
  previousReservationDatabaseSpec,
  previousVisibilityDatabaseSpec,
} from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  type ClassifiedWriteTransactionOutcome,
  runClassifiedWriteTransaction,
} from "./project-storage-transaction.js";
import { SqlIntegerSchema } from "./sql-integer-schema.js";

export type ApplicationDatabaseFailure =
  | Readonly<{
      status: "broken";
      code: "REGISTRY_SCHEMA_UNKNOWN" | "REGISTRY_SCHEMA_NEWER" | "REGISTRY_CORRUPT";
    }>
  | typeof missingWithWitnessFailure;

// A missing application database where prior state proves it existed; the one owner of this
// failure for the authority and the registry.
export const missingWithWitnessFailure = {
  status: "pending-recovery",
  code: "REGISTRY_MISSING_WITH_WITNESS",
} as const;

// Typed refusal of the installation application database; owners map it to their own codes.
export class ApplicationDatabaseFault extends Error {
  constructor(
    readonly failure: ApplicationDatabaseFailure,
    options?: ErrorOptions,
  ) {
    super("Application database authority refused the operation.", options);
    this.name = "ApplicationDatabaseFault";
  }
}

export type ApplicationDatabaseMigrationCheckpoint =
  | "before-ddl"
  | "after-ddl"
  | "before-metadata"
  | "before-commit"
  | "commit-before-boundary"
  | "commit-acknowledgement";

export type ApplicationDatabaseMigrationFailures = Readonly<{
  checkpoint(point: ApplicationDatabaseMigrationCheckpoint): Promise<void>;
}>;

const PREVIOUS_APPLICATION_DATABASE_HEAD = "0000_gray_eddie_brock";
const CURRENT_APPLICATION_DATABASE_HEAD = "0007_storage_upgrades";

const noMigrationFailures: ApplicationDatabaseMigrationFailures = {
  checkpoint: async () => undefined,
};

const sqliteVersionSchema = SqlIntegerSchema.check(Schema.isGreaterThanOrEqualTo(0));

const metadataSchema = Schema.Struct({
  metadataKey: Schema.Literal("application"),
  databaseKind: Schema.Literal("application"),
  formatVersion: sqliteVersionSchema,
  schemaVersion: sqliteVersionSchema,
  lastMigrationId: NonEmptyTextSchema,
});
const metadataRowsSchema = Schema.Tuple([metadataSchema]);

const healthyIntegritySchema = Schema.Tuple([Schema.Tuple([Schema.Literal("ok")])]);
// Checks only the version members of the already-decoded metadata row.
const isSupportedVersion = Schema.is(
  Schema.Struct({
    formatVersion: Schema.Literal(1),
    schemaVersion: Schema.Literal(1),
  }),
);

export function applicationDatabaseRows(result: LocalLibsqlResultSet): unknown[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((name, index) => [name, row[index]])),
  );
}

function corrupt(cause?: ProjectStorageBrokenError): ApplicationDatabaseFault {
  return new ApplicationDatabaseFault(
    { status: "broken", code: "REGISTRY_CORRUPT" },
    cause === undefined ? undefined : { cause },
  );
}

async function requireApplicationSchema(
  transaction: LocalLibsqlTransaction,
  spec: DatabaseSpec,
): Promise<void> {
  try {
    await requireDeclaredSchemaObjects(transaction, spec);
    await requireApplicationRelationships(transaction);
  } catch (error) {
    // Keeps the verifier's precise mismatch for owners that report it.
    if (isDefiniteSchemaMismatch(error)) throw corrupt(error);
    throw error;
  }
}

async function requireApplicationRelationships(transaction: LocalLibsqlTransaction): Promise<void> {
  const conflicts = await transaction.execute(
    "SELECT 1 FROM storage_generations AS g LEFT JOIN storage_registrations AS r ON r.storage_id = g.storage_id WHERE r.storage_id IS NULL OR r.project_id <> g.project_id LIMIT 1",
  );
  if (conflicts.rows.length !== 0) throw corrupt();
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
  if (activeConflicts.rows.length !== 0) throw corrupt();
  await requireUpgradeRelationships(transaction);
}

/**
 * Registry heads that include `storage_upgrades`: every upgrade belongs to its Storage's registered
 * Project; an in-progress upgrade's source is the active generation and its target is staging; a
 * completed upgrade's target is active and its source is gone; at most one completed upgrade per
 * Storage (chained upgrades are a later gate).
 */
async function requireUpgradeRelationships(transaction: LocalLibsqlTransaction): Promise<void> {
  const table = await transaction.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'storage_upgrades'",
  );
  if (table.rows.length === 0) return;
  const conflicts = await transaction.execute(`
      SELECT 1 FROM storage_upgrades AS u
      LEFT JOIN storage_registrations AS r ON r.storage_id = u.storage_id
      LEFT JOIN storage_generations AS s
        ON s.storage_id = u.storage_id AND s.generation_id = u.source_generation_id
      LEFT JOIN storage_generations AS t
        ON t.storage_id = u.storage_id AND t.generation_id = u.target_generation_id
      WHERE r.project_id IS NOT u.project_id
        OR (u.state = 'in-progress' AND (r.active_generation_id IS NOT u.source_generation_id
          OR s.generation_id IS NULL OR t.creation_state IS NOT 'staging'))
        OR (u.state = 'completed' AND (r.active_generation_id IS NOT u.target_generation_id
          OR s.generation_id IS NOT NULL))
      UNION ALL
      SELECT 1 FROM storage_upgrades WHERE state = 'completed'
      GROUP BY storage_id HAVING COUNT(*) > 1
      LIMIT 1`);
  if (conflicts.rows.length !== 0) throw corrupt();
}

function isDefiniteSchemaMismatch(error: unknown): error is ProjectStorageBrokenError {
  return error instanceof ProjectStorageBrokenError && error.cause === undefined;
}

async function requireIntegrity(transaction: LocalLibsqlTransaction): Promise<void> {
  const integrity = await transaction.execute("PRAGMA integrity_check");
  if (!acceptsStrict(healthyIntegritySchema, integrity.rows)) throw corrupt();
  if ((await transaction.execute("PRAGMA foreign_key_check")).rows.length !== 0) throw corrupt();
}

async function readApplicationMetadata(transaction: LocalLibsqlTransaction) {
  const parsed = decodeStrictResult(
    metadataRowsSchema,
    applicationDatabaseRows(
      await transaction.execute(
        "SELECT metadata_key AS metadataKey, database_kind AS databaseKind, format_version AS formatVersion, schema_version AS schemaVersion, last_migration_id AS lastMigrationId FROM schema_metadata",
      ),
    ),
  );
  if (Result.isFailure(parsed)) throw corrupt();
  return parsed.success[0];
}

function requireSupportedVersions(metadata: typeof metadataSchema.Type): void {
  if (metadata.formatVersion > 1 || metadata.schemaVersion > 1) {
    throw new ApplicationDatabaseFault({ status: "broken", code: "REGISTRY_SCHEMA_NEWER" });
  }
  if (!isSupportedVersion(metadata)) {
    throw new ApplicationDatabaseFault({ status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" });
  }
}

// Inspects inside the caller's write transaction: null means the schema is already current.
export async function firstRequiredApplicationMigration(
  transaction: LocalLibsqlTransaction,
  fresh: boolean,
): Promise<number | null> {
  const names = await tableNames(transaction);
  if (names.length === 0) {
    // A schema-less file this authority did not just create (e.g. left by a crash) is
    // refused explicitly, never initialized as if fresh.
    if (!fresh) throw corrupt();
    return 0;
  }
  await requireIntegrity(transaction);
  const metadata = await readApplicationMetadata(transaction);
  requireSupportedVersions(metadata);
  if (metadata.lastMigrationId === CURRENT_APPLICATION_DATABASE_HEAD) {
    await requireApplicationSchema(transaction, databaseSpecs.application);
    return null;
  }
  const known = knownPreviousHeads.get(metadata.lastMigrationId);
  if (known === undefined) {
    throw new ApplicationDatabaseFault({ status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" });
  }
  await requireApplicationSchema(transaction, known.spec);
  return known.firstRequiredMigration;
}

// Each historical head, the schema it must match, and the first migration still to apply.
const knownPreviousHeads = new Map<
  string,
  Readonly<{ spec: DatabaseSpec; firstRequiredMigration: number }>
>([
  [
    PREVIOUS_APPLICATION_DATABASE_HEAD,
    { spec: previousApplicationDatabaseSpec, firstRequiredMigration: 1 },
  ],
  [
    "0001_project_registration",
    { spec: previousRegistrationDatabaseSpec, firstRequiredMigration: 2 },
  ],
  [
    "0002_identity_query_attempts",
    { spec: previousIdentityQueryDatabaseSpec, firstRequiredMigration: 3 },
  ],
  [
    "0003_registration_proposals",
    { spec: previousProposalDatabaseSpec, firstRequiredMigration: 4 },
  ],
  [
    "0004_registration_reservations",
    { spec: previousReservationDatabaseSpec, firstRequiredMigration: 5 },
  ],
  [
    "0005_registration_publications",
    { spec: previousPublicationDatabaseSpec, firstRequiredMigration: 6 },
  ],
  [
    "0006_registration_list_visibility",
    { spec: previousVisibilityDatabaseSpec, firstRequiredMigration: 7 },
  ],
]);

async function applyStatements(
  transaction: LocalLibsqlTransaction,
  migrations: readonly GeneratedMigration[],
): Promise<void> {
  for (const migration of migrations) {
    for (const statement of migration.statements) await transaction.execute(statement);
  }
}

function checkpointedClient(
  client: LocalLibsqlClient,
  failures: ApplicationDatabaseMigrationFailures,
): Pick<LocalLibsqlClient, "transaction"> {
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

export async function requireForeignKeys(client: LocalLibsqlClient): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  const enabled = await client.execute("PRAGMA foreign_keys");
  if (Number(enabled.rows[0]?.[0]) !== 1)
    throw new Error("Registration foreign-key enforcement unavailable.");
}

export async function migrateApplicationDatabase(
  client: LocalLibsqlClient,
  input: Readonly<{
    migrationResourcesRoot: string;
    fresh: boolean;
    failures?: ApplicationDatabaseMigrationFailures | undefined;
  }>,
): Promise<ClassifiedWriteTransactionOutcome<void>> {
  const failures = input.failures ?? noMigrationFailures;
  const migrations = await loadGeneratedMigrations(
    input.migrationResourcesRoot,
    databaseSpecs.application,
  );
  if (migrations.at(-1)?.migrationId !== CURRENT_APPLICATION_DATABASE_HEAD)
    throw new Error("Registration migration resources are incompatible.");
  return runClassifiedWriteTransaction(
    checkpointedClient(client, failures),
    async (transaction) => {
      const firstMigration = await firstRequiredApplicationMigration(transaction, input.fresh);
      if (firstMigration === null) return;
      await failures.checkpoint("before-ddl");
      await applyStatements(transaction, migrations.slice(firstMigration));
      await failures.checkpoint("after-ddl");
      await failures.checkpoint("before-metadata");
      await transaction.execute({
        sql: "INSERT INTO schema_metadata (metadata_key, database_kind, format_version, schema_version, last_migration_id) VALUES ('application', 'application', 1, 1, ?) ON CONFLICT(metadata_key) DO UPDATE SET last_migration_id = excluded.last_migration_id",
        args: [CURRENT_APPLICATION_DATABASE_HEAD],
      });
      await requireApplicationSchema(transaction, databaseSpecs.application);
      await requireIntegrity(transaction);
      await failures.checkpoint("before-commit");
    },
  );
}
