import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { InArgs, InStatement } from "@libsql/client";
import {
  type DatabaseSpec,
  databaseSpecs,
} from "../../src/storage/project-storage-node-adapters.js";

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

export const schemaObjectOmissionCases = [
  {
    name: "CHECK constraint",
    expectedMessage: "Database required CHECK constraint is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
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
