import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { expect } from "vitest";
import type { InArgs, InStatement } from "../../src/storage/local-libsql-worker-client.js";
import type { ColumnSpec } from "../../src/storage/project-storage-database-specs.js";
import {
  type DatabaseSpec,
  databaseSpecs,
  requireDeclaredSchemaObjects,
} from "../../src/storage/project-storage-node-adapters.js";

export const canonicalGenerationTwoTables = [
  "canonical_events",
  "command_idempotency",
  "command_receipts",
  "command_rejections",
  "project_state",
  "schema_metadata",
  "storage_identity",
  "writer_fence",
  "writer_generations",
  "writer_handoffs",
  "writer_recovery_records",
] as const;

const canonicalGenerationThreeTables = [
  ...canonicalGenerationTwoTables,
  "project_workspaces",
  "repository_bindings",
].sort();

export const canonicalConversationTables = [
  "conversation_branches",
  "conversation_messages",
  "conversations",
] as const;

export const canonicalCurrentTables = [
  ...canonicalGenerationThreeTables,
  ...canonicalConversationTables,
].sort();

const project = "00000000-0000-4000-8000-000000000010";
const instant = "2026-09-04T12:00:00.000Z";
const identity = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const digest = "a".repeat(64);
const otherDigest = "b".repeat(64);

function writerInsert(input: { generation: number; projectId?: string; token?: string }): string {
  const { generation, projectId = project, token = digest } = input;
  return `INSERT INTO writer_generations VALUES ('${projectId}', ${generation}, '${identity(20 + generation)}', '${token}', '${instant}', NULL)`;
}

function receiptInsert(
  id: number,
  sequence: number,
  outcome: string,
  fingerprint = digest,
): string {
  return `INSERT INTO command_receipts VALUES ('${project}', '${identity(id)}', '${identity(id + 10)}', 'fixture.command', 1, '${fingerprint}', '${outcome}', ${sequence}, 1, '${instant}')`;
}

function eventInsert(input: {
  id: number;
  receipt: number;
  sequence: number;
  aggregateVersion?: number;
}): string {
  const { id, receipt, sequence, aggregateVersion = 1 } = input;
  return `INSERT INTO canonical_events VALUES ('${project}', '${identity(id)}', '${identity(receipt)}', 'applied', ${sequence}, 0, 'fixture', '${identity(70)}', ${aggregateVersion}, 'fixture.event', 1, '{}', '${digest}', '${instant}')`;
}

function fenceInsert(state: string, release: string, token = digest): string {
  return `INSERT INTO writer_fence VALUES ('${project}', 1, '${token}', '${state}', '${instant}', ${release})`;
}

export function seedCanonicalConstraintAuthority(database: DatabaseSync): void {
  for (const generation of [1, 2, 3]) database.exec(writerInsert({ generation }));
  database.exec(receiptInsert(40, 1, "applied"));
  database.exec(receiptInsert(41, 2, "unchanged"));
  database.exec(receiptInsert(42, 3, "rejected"));
  database.exec(eventInsert({ id: 60, receipt: 40, sequence: 1 }));
}

export function canonicalTableCounts(database: DatabaseSync): readonly number[] {
  return canonicalCurrentTables.map((table) =>
    Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.["count"]),
  );
}

export async function expectCreatedCanonicalSchema(
  canonical: DatabaseSync,
  identity: Readonly<{
    projectId: string;
    storageId: string;
    generationId: string;
    canonicalDatabaseLineageId: string;
  }>,
): Promise<void> {
  expect(canonical.prepare("SELECT * FROM schema_metadata").all()).toEqual([
    {
      metadata_key: "canonical",
      database_kind: "canonical",
      format_version: 1,
      schema_version: 4,
      last_migration_id: "0003_conversation_messages",
    },
  ]);
  expect(canonical.prepare("SELECT * FROM project_state").all()).toEqual([
    {
      project_id: "00000000-0000-4000-8000-000000000010",
      last_project_sequence: 0,
      last_writer_generation: 0,
      created_at: "2026-09-04T12:00:00.000Z",
      updated_at: "2026-09-04T12:00:00.000Z",
    },
  ]);
  expect(canonical.prepare("SELECT * FROM storage_identity").all()).toEqual([
    {
      identity_key: "storage",
      project_id: identity.projectId,
      storage_id: identity.storageId,
      generation_id: identity.generationId,
      canonical_database_lineage_id: identity.canonicalDatabaseLineageId,
      created_at: "2026-09-04T12:00:00.000Z",
    },
  ]);
  expect(canonicalTableCounts(canonical)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0]);
  expect(databaseSpecs.canonical.columns).toHaveLength(109);
  expect(databaseSpecs.canonical.checks).toHaveLength(75);
  expect(databaseSpecs.canonical.indexes).toHaveLength(20);
  expect(databaseSpecs.canonical.foreignKeys).toHaveLength(18);
  await expect(
    requireDeclaredSchemaObjects(sqliteExecutor(canonical), databaseSpecs.canonical),
  ).resolves.toBeUndefined();
}

const checkFailure = /^CHECK constraint failed:/u;
const foreignKeyFailure = /^FOREIGN KEY constraint failed/u;
const uniqueFailure = /^UNIQUE constraint failed:/u;

export const canonicalConstraintCases = [
  {
    name: "invalid Project UUID",
    sql: `INSERT INTO project_state VALUES ('invalid', 0, 0, '${instant}', '${instant}')`,
    failure: checkFailure,
  },
  {
    name: "malformed token digest",
    sql: writerInsert({ generation: 4, token: "not-a-digest" }),
    failure: checkFailure,
  },
  {
    name: "malformed command fingerprint",
    sql: receiptInsert(43, 4, "applied", "invalid"),
    failure: checkFailure,
  },
  {
    name: "orphan Writer generation",
    sql: writerInsert({ generation: 4, projectId: identity(99) }),
    failure: foreignKeyFailure,
  },
  {
    name: "fence generation/token mismatch",
    sql: fenceInsert("active", "NULL", otherDigest),
    failure: foreignKeyFailure,
  },
  { name: "invalid fence state", sql: fenceInsert("paused", "NULL"), failure: checkFailure },
  {
    name: "active fence released",
    sql: fenceInsert("active", `'${instant}'`),
    failure: checkFailure,
  },
  {
    name: "released fence without time",
    sql: fenceInsert("released", "NULL"),
    failure: checkFailure,
  },
  {
    name: "initial handoff with predecessor",
    sql: `INSERT INTO writer_handoffs VALUES ('${project}', '${identity(80)}', 1, 2, 'initial', '${instant}')`,
    failure: checkFailure,
  },
  {
    name: "clean handoff without predecessor",
    sql: `INSERT INTO writer_handoffs VALUES ('${project}', '${identity(80)}', NULL, 2, 'clean', '${instant}')`,
    failure: checkFailure,
  },
  {
    name: "uncertain recovery without command",
    sql: `INSERT INTO writer_recovery_records VALUES ('${project}', '${identity(81)}', 1, 'commit-uncertain', NULL, NULL, '${instant}', NULL, NULL, NULL)`,
    failure: checkFailure,
  },
  {
    name: "abandoned recovery with command",
    sql: `INSERT INTO writer_recovery_records VALUES ('${project}', '${identity(81)}', 1, 'abandoned-active-fence', '${identity(50)}', '${digest}', '${instant}', NULL, NULL, NULL)`,
    failure: checkFailure,
  },
  {
    name: "non-increasing resolver generation",
    sql: `INSERT INTO writer_recovery_records VALUES ('${project}', '${identity(81)}', 2, 'abandoned-active-fence', NULL, NULL, '${instant}', 'generation-superseded', 1, '${instant}')`,
    failure: checkFailure,
  },
  {
    name: "duplicate Project sequence",
    sql: receiptInsert(43, 1, "applied"),
    failure: uniqueFailure,
  },
  {
    name: "idempotency/receipt command mismatch",
    sql: `INSERT INTO command_idempotency VALUES ('${project}', '${identity(51)}', '${digest}', '${identity(40)}', '${instant}')`,
    failure: foreignKeyFailure,
  },
  {
    name: "idempotency/receipt fingerprint mismatch",
    sql: `INSERT INTO command_idempotency VALUES ('${project}', '${identity(50)}', '${otherDigest}', '${identity(40)}', '${instant}')`,
    failure: foreignKeyFailure,
  },
  {
    name: "rejection of applied receipt",
    sql: `INSERT INTO command_rejections VALUES ('${project}', '${identity(40)}', 'rejected', 1, 'FIXTURE_REJECTED', 0, '{}', '${digest}')`,
    failure: foreignKeyFailure,
  },
  {
    name: "event on unchanged receipt",
    sql: eventInsert({ id: 61, receipt: 41, sequence: 2 }),
    failure: foreignKeyFailure,
  },
  {
    name: "duplicate event ordinal",
    sql: eventInsert({ id: 61, receipt: 40, sequence: 1 }),
    failure: uniqueFailure,
  },
  {
    name: "fractional Project sequence",
    sql: `UPDATE project_state SET last_project_sequence = 0.5 WHERE project_id = '${project}'`,
    failure: checkFailure,
  },
  {
    name: "fractional Writer generation",
    sql: `INSERT INTO writer_generations VALUES ('${project}', 1.5, '${identity(24)}', '${digest}', '${instant}', NULL)`,
    failure: checkFailure,
  },
  {
    name: "fractional aggregate version",
    sql: eventInsert({ id: 61, receipt: 40, sequence: 1, aggregateVersion: 1.5 }),
    failure: checkFailure,
  },
] as const;

export function sqliteExecutor(database: DatabaseSync) {
  const primitiveSqliteInput = (value: unknown): SQLInputValue | undefined => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return value;
    if (value === null) return value;
    if (value instanceof Uint8Array) return value;
    return undefined;
  };
  const sqliteInput = (value: unknown): SQLInputValue => {
    const primitive = primitiveSqliteInput(value);
    if (primitive !== undefined) return primitive;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value instanceof Date) return value.valueOf();
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    throw new TypeError("Unsupported SQLite test input.");
  };
  return {
    execute: async (statement: InStatement | string, args?: InArgs) => {
      const normalized =
        typeof statement === "string" ? { sql: statement, args: args ?? [] } : statement;
      const prepared = database.prepare(normalized.sql);
      const bound = normalized.args ?? [];
      if (!Array.isArray(bound)) throw new TypeError("Named SQLite test inputs are unsupported.");
      const records = prepared.all(...bound.map(sqliteInput));
      const columns = prepared.columns().map((column) => column.name);
      return {
        columns,
        rows: records.map((record) => columns.map((column) => record[column])),
        rowsAffected: 0,
      };
    },
  };
}

export const schemaProbeColumns = [
  {
    table: "parent",
    cid: 0,
    name: "id",
    type: "TEXT",
    notNull: 0,
    defaultValue: null,
    primaryKey: 1,
    hidden: 0,
  },
  {
    table: "child",
    cid: 0,
    name: "id",
    type: "TEXT",
    notNull: 0,
    defaultValue: null,
    primaryKey: 1,
    hidden: 0,
  },
  {
    table: "child",
    cid: 1,
    name: "parent_id",
    type: "TEXT",
    notNull: 0,
    defaultValue: null,
    primaryKey: 0,
    hidden: 0,
  },
] as const satisfies readonly ColumnSpec[];

export const schemaObjectOmissionCases = [
  {
    name: "CHECK constraint",
    expectedMessage: "Database required CHECK constraint is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      columns: schemaProbeColumns,
      checks: [
        {
          table: "child",
          name: "child_parent_nonempty",
          expression: "length(parent_id) > 0",
        },
      ],
      indexes: [],
      foreignKeys: [],
    } satisfies DatabaseSpec,
  },
  {
    name: "named index",
    expectedMessage: "Database required named index is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      columns: schemaProbeColumns,
      checks: [],
      indexes: [
        {
          table: "child",
          name: "child_parent_idx",
          unique: false,
          partial: false,
          columns: ["parent_id"],
          predicate: null,
        },
      ],
      foreignKeys: [],
    } satisfies DatabaseSpec,
  },
  {
    name: "foreign key",
    expectedMessage: "Database required foreign key is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      columns: schemaProbeColumns,
      checks: [],
      indexes: [],
      foreignKeys: [
        {
          table: "child",
          columns: ["parent_id"],
          referencedTable: "parent",
          referencedColumns: ["id"],
          onUpdate: "NO ACTION",
          onDelete: "NO ACTION",
          match: "NONE",
        },
      ],
    } satisfies DatabaseSpec,
  },
];

export type SqlTransform = (sql: string) => string;
type SameNameSchemaMutationCase = Readonly<{
  name: string;
  expectedMessage: string;
  mutate: SqlTransform;
  formattingOnly?: SqlTransform;
}>;

function replaceSqlOnce(sql: string, expected: string, replacement: string): string {
  const firstIndex = sql.indexOf(expected);
  if (firstIndex < 0 || sql.indexOf(expected, firstIndex + expected.length) >= 0) {
    throw new Error("Expected exactly one migration SQL fragment.");
  }
  return `${sql.slice(0, firstIndex)}${replacement}${sql.slice(firstIndex + expected.length)}`;
}

const locationStateCheck =
  `CONSTRAINT "storage_locations_state" ` +
  `CHECK("storage_locations"."location_state" in ('staging', 'committed'))`;
const activeGenerationPredicate = `WHERE "storage_generations"."creation_state" = 'active'`;
const generationLocationForeignKey =
  "FOREIGN KEY (`storage_id`,`location_id`) " +
  "REFERENCES `storage_locations`(`storage_id`,`location_id`) " +
  "ON UPDATE no action ON DELETE restrict";

export const sameNameSchemaMutationCases: readonly SameNameSchemaMutationCase[] = [
  {
    name: "CHECK expression",
    expectedMessage: "Database required CHECK constraint is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        locationStateCheck,
        `CONSTRAINT "storage_locations_state" ` +
          `CHECK("storage_locations"."location_state" in ('staging', 'retired'))`,
      ),
    formattingOnly: (sql) =>
      replaceSqlOnce(
        sql,
        locationStateCheck,
        `CONSTRAINT \`storage_locations_state\` CHECK (
          /* insignificant formatting */
          \`storage_locations\`.\`location_state\` IN ('staging', 'committed')
        )`,
      ),
  },
  {
    name: "partial-index predicate",
    expectedMessage: "Database required named index is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        activeGenerationPredicate,
        `WHERE "storage_generations"."creation_state" = 'staging'`,
      ),
    formattingOnly: (sql) =>
      replaceSqlOnce(
        sql,
        activeGenerationPredicate,
        `WHERE /* insignificant formatting */
          \`storage_generations\`.\`creation_state\` = 'active'`,
      ),
  },
  {
    name: "foreign-key source column",
    expectedMessage: "Database required foreign key is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        generationLocationForeignKey,
        "FOREIGN KEY (`storage_id`,`generation_id`) " +
          "REFERENCES `storage_locations`(`storage_id`,`location_id`) " +
          "ON UPDATE no action ON DELETE restrict",
      ),
  },
  {
    name: "foreign-key target table",
    expectedMessage: "Database required foreign key is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        generationLocationForeignKey,
        "FOREIGN KEY (`storage_id`,`location_id`) " +
          "REFERENCES `storage_registrations`(`storage_id`,`active_location_id`) " +
          "ON UPDATE no action ON DELETE restrict",
      ),
  },
  {
    name: "foreign-key target column",
    expectedMessage: "Database required foreign key is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        generationLocationForeignKey,
        "FOREIGN KEY (`storage_id`,`location_id`) " +
          "REFERENCES `storage_locations`(`storage_id`,`normalized_path`) " +
          "ON UPDATE no action ON DELETE restrict",
      ),
  },
  {
    name: "foreign-key update action",
    expectedMessage: "Database required foreign key is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        generationLocationForeignKey,
        "FOREIGN KEY (`storage_id`,`location_id`) " +
          "REFERENCES `storage_locations`(`storage_id`,`location_id`) " +
          "ON UPDATE restrict ON DELETE restrict",
      ),
  },
  {
    name: "foreign-key delete action",
    expectedMessage: "Database required foreign key is missing.",
    mutate: (sql) =>
      replaceSqlOnce(
        sql,
        generationLocationForeignKey,
        "FOREIGN KEY (`storage_id`,`location_id`) " +
          "REFERENCES `storage_locations`(`storage_id`,`location_id`) " +
          "ON UPDATE no action ON DELETE no action",
      ),
  },
];
