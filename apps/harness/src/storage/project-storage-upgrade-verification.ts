import { createHash } from "node:crypto";
import { requireDeclaredSchemaObjects, tableNames } from "./database-schema-verifier.js";
import { type LocalLibsqlClient, withDatabase } from "./local-libsql-worker-client.js";
import { databaseSpecs } from "./project-storage-database-specs.js";
import {
  ProjectStorageBrokenError,
  type ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import { isBusyStorageError, isCorruptStorageError } from "./project-storage-node-errors.js";
import { resultObjects } from "./project-storage-node-schemas.js";
import {
  type DatabaseHead,
  ProjectStorageUpgradeBusyError,
  type StagedUpgrade,
} from "./project-storage-upgrade.js";

type OwnedSpec = typeof databaseSpecs.canonical | typeof databaseSpecs.runtime;
type DatabaseFiles = Readonly<{ canonicalDatabase: string; runtimeDatabase: string }>;

/** One database of the upgrade: the source file, its staged copy, and how it is compared. */
type ComparedDatabase = Readonly<{
  sourcePath: string;
  stagedPath: string;
  spec: OwnedSpec;
  identityTable: "storage_identity" | "slopstop_runtime_storage_identity";
  lineageColumn: "canonical_database_lineage_id" | "runtime_database_lineage_id";
  /** Tables the upgrade is allowed to change besides the identity row. */
  changedTables: readonly string[];
}>;

export type StagedVerification = "verified" | "mismatch";
export type BackupVerification = "verified" | "invalid";

/** A copy that does not prove itself: reported as a failed result, never as a crash. */
class StagedCopyMismatch extends Error {
  override readonly name = "StagedCopyMismatch";
}

function withReadOnly<Value>(
  databasePath: string,
  read: (client: LocalLibsqlClient) => Promise<Value>,
): Promise<Value> {
  return withDatabase(databasePath, { readOnly: true }, read);
}

/** Encodes BLOB values with a type tag so they take part in the digest. */
function digestRows(rows: unknown): string {
  const encoded = JSON.stringify(rows, (_key, value: unknown) =>
    value instanceof ArrayBuffer ? ["blob", Buffer.from(value).toString("hex")] : value,
  );
  return createHash("sha256").update(encoded).digest("hex");
}

/** Row count and a digest over every column of every row, in a total order. */
export async function tableFingerprints(
  client: LocalLibsqlClient,
  excluded: ReadonlySet<string>,
): Promise<Record<string, string>> {
  const fingerprints: Record<string, string> = {};
  for (const table of await tableNames(client)) {
    if (excluded.has(table)) continue;
    const columns = await client.execute(`PRAGMA table_info("${table}")`);
    const order = columns.rows.map((_, index) => index + 1).join(", ");
    const rows = await client.execute(`SELECT * FROM "${table}" ORDER BY ${order}`);
    fingerprints[table] = `${rows.rows.length}:${digestRows(rows.rows)}`;
  }
  return fingerprints;
}

async function identityRow(
  client: LocalLibsqlClient,
  database: Pick<ComparedDatabase, "identityTable">,
): Promise<Record<string, unknown>> {
  const result = await client.execute(`SELECT * FROM ${database.identityTable}`);
  const [row, ...others] = resultObjects(result) as Record<string, unknown>[];
  if (row === undefined || others.length > 0) throw new StagedCopyMismatch();
  return row;
}

async function requireIntegrity(client: LocalLibsqlClient): Promise<void> {
  const integrity = await client.execute("PRAGMA integrity_check");
  const foreignKeys = await client.execute("PRAGMA foreign_key_check");
  const intact = [
    integrity.rows.length === 1,
    integrity.rows[0]?.[0] === "ok",
    foreignKeys.rows.length === 0,
  ].every(Boolean);
  if (!intact) throw new StagedCopyMismatch();
}

function requireSameIdentity(
  source: Record<string, unknown>,
  staged: Record<string, unknown>,
  input: Readonly<{ database: ComparedDatabase; upgrade: StagedUpgrade }>,
): void {
  const agrees = [
    staged["project_id"] === source["project_id"],
    staged["storage_id"] === source["storage_id"],
    staged[input.database.lineageColumn] === source[input.database.lineageColumn],
    staged["generation_id"] === input.upgrade.targetGenerationId,
    staged["created_at"] === input.upgrade.startedAt,
  ].every(Boolean);
  if (!agrees) throw new StagedCopyMismatch();
}

function isBusy(error: unknown): boolean {
  return isBusyStorageError({ error });
}

function busy(cause: unknown): ProjectStorageUnavailableError {
  return new ProjectStorageUpgradeBusyError({ cause });
}

/** The source must be readable: a busy source is busy, any other failure is broken. */
async function readSource<Value>(read: () => Promise<Value>): Promise<Value> {
  try {
    return await read();
  } catch (error) {
    if (isBusy(error)) throw busy(error);
    throw new ProjectStorageBrokenError("Project Storage upgrade source verification failed.", {
      cause: error,
    });
  }
}

/** A copy that cannot prove itself is a mismatch; a busy copy stays busy. */
async function classifyCopy<Value>(
  prove: () => Promise<void>,
  outcomes: Readonly<{ proven: Value; mismatch: Value }>,
): Promise<Value> {
  try {
    await prove();
    return outcomes.proven;
  } catch (error) {
    if (isBusy(error)) throw busy(error);
    const failed = [
      error instanceof StagedCopyMismatch,
      error instanceof ProjectStorageBrokenError,
      isCorruptStorageError({ error }),
    ].some(Boolean);
    if (failed) return outcomes.mismatch;
    throw error;
  }
}

type SourceEvidence = Readonly<{
  fingerprints: Record<string, string>;
  identity: Record<string, unknown>;
}>;

function excludedTables(database: ComparedDatabase): ReadonlySet<string> {
  return new Set([database.identityTable, ...database.changedTables]);
}

async function readSourceEvidence(database: ComparedDatabase): Promise<SourceEvidence> {
  return withReadOnly(database.sourcePath, async (client) => ({
    fingerprints: await tableFingerprints(client, excludedTables(database)),
    identity: await identityRow(client, database),
  }));
}

/** The staged canonical head is exactly the packaged head the plan migrated to. */
async function requireStagedHead(client: LocalLibsqlClient, head: DatabaseHead): Promise<void> {
  const spec = databaseSpecs.canonical;
  const result = await client.execute(
    `SELECT metadata_key, database_kind, format_version, schema_version, last_migration_id
      FROM ${spec.metadataTable}`,
  );
  const expected = [
    spec.metadataKey,
    spec.databaseKind,
    head.formatVersion,
    head.schemaVersion,
    head.lastMigrationId,
  ];
  if (JSON.stringify(result.rows) !== JSON.stringify([expected])) {
    throw new StagedCopyMismatch();
  }
}

async function requireStagedCopy(
  database: ComparedDatabase,
  input: Readonly<{ source: SourceEvidence; upgrade: StagedUpgrade; head?: DatabaseHead }>,
): Promise<void> {
  await withReadOnly(database.stagedPath, async (client) => {
    await requireDeclaredSchemaObjects(client, database.spec);
    await requireIntegrity(client);
    if (input.head !== undefined) await requireStagedHead(client, input.head);
    const staged = await tableFingerprints(client, excludedTables(database));
    const unchanged = Object.entries(input.source.fingerprints).every(
      ([table, fingerprint]) => staged[table] === fingerprint,
    );
    if (!unchanged) throw new StagedCopyMismatch();
    requireSameIdentity(input.source.identity, await identityRow(client, database), {
      database,
      upgrade: input.upgrade,
    });
  });
}

function comparedDatabases(source: DatabaseFiles, staged: DatabaseFiles) {
  return {
    canonical: {
      sourcePath: source.canonicalDatabase,
      stagedPath: staged.canonicalDatabase,
      spec: databaseSpecs.canonical,
      identityTable: "storage_identity",
      lineageColumn: "canonical_database_lineage_id",
      changedTables: [databaseSpecs.canonical.metadataTable],
    },
    runtime: {
      sourcePath: source.runtimeDatabase,
      stagedPath: staged.runtimeDatabase,
      spec: databaseSpecs.runtime,
      identityTable: "slopstop_runtime_storage_identity",
      lineageColumn: "runtime_database_lineage_id",
      changedTables: [],
    },
  } as const satisfies Record<string, ComparedDatabase>;
}

/**
 * Proves the closed staged copies: the packaged schema and head, intact pages and keys, every
 * source row unchanged, and the source identity re-identified as the target. A source that
 * cannot be read is broken and a busy file is busy; neither is reported as a mismatch.
 */
export async function verifyStagedCopies(
  input: Readonly<{
    upgrade: StagedUpgrade;
    canonicalHead: DatabaseHead;
    source: DatabaseFiles;
    staged: DatabaseFiles;
  }>,
): Promise<StagedVerification> {
  const databases = comparedDatabases(input.source, input.staged);
  const sources = await readSource(async () => ({
    canonical: await readSourceEvidence(databases.canonical),
    runtime: await readSourceEvidence(databases.runtime),
  }));
  return classifyCopy<StagedVerification>(
    async () => {
      await requireStagedCopy(databases.canonical, {
        source: sources.canonical,
        upgrade: input.upgrade,
        head: input.canonicalHead,
      });
      await requireStagedCopy(databases.runtime, {
        source: sources.runtime,
        upgrade: input.upgrade,
      });
    },
    { proven: "verified", mismatch: "mismatch" },
  );
}

type BackupDatabase = Pick<ComparedDatabase, "identityTable" | "spec">;

const backupDatabases = {
  canonical: { identityTable: "storage_identity", spec: databaseSpecs.canonical },
  runtime: { identityTable: "slopstop_runtime_storage_identity", spec: databaseSpecs.runtime },
} as const satisfies Record<string, BackupDatabase>;

async function identityAndHead(databasePath: string, database: BackupDatabase): Promise<string> {
  return withReadOnly(databasePath, async (client) => {
    const identity = await client.execute(`SELECT * FROM ${database.identityTable}`);
    const head = await client.execute(`SELECT * FROM ${database.spec.metadataTable}`);
    return JSON.stringify([identity.rows, head.rows]);
  });
}

async function requireBackupDatabase(
  backupPath: string,
  database: BackupDatabase,
  source: string,
): Promise<void> {
  await withReadOnly(backupPath, requireIntegrity);
  let backup: string;
  try {
    backup = await identityAndHead(backupPath, database);
  } catch (error) {
    // A copy whose identity or head cannot be read does not prove itself.
    if (isBusy(error)) throw error;
    throw new StagedCopyMismatch();
  }
  if (backup !== source) throw new StagedCopyMismatch();
}

/**
 * Reads the closed backup copies back: intact pages and keys, and the source's identity row and
 * schema head. A busy file answers busy; a source that cannot be read is broken; any other
 * failure to prove the copy is invalid.
 */
export async function verifyBackupCopies(
  input: Readonly<{ source: DatabaseFiles; backup: DatabaseFiles }>,
): Promise<BackupVerification> {
  const sources = await readSource(async () => ({
    canonical: await identityAndHead(input.source.canonicalDatabase, backupDatabases.canonical),
    runtime: await identityAndHead(input.source.runtimeDatabase, backupDatabases.runtime),
  }));
  return classifyCopy<BackupVerification>(
    async () => {
      await requireBackupDatabase(
        input.backup.canonicalDatabase,
        backupDatabases.canonical,
        sources.canonical,
      );
      await requireBackupDatabase(
        input.backup.runtimeDatabase,
        backupDatabases.runtime,
        sources.runtime,
      );
    },
    { proven: "verified", mismatch: "invalid" },
  );
}
