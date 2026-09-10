import type { InArgs, InStatement } from "@libsql/client";
import { z } from "zod";
import type {
  ColumnSpec,
  DatabaseSpec,
  ForeignKeySpec,
  NamedCheckSpec,
  NamedIndexSpec,
} from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { canonicalizeSqliteSchemaExpression } from "./sqlite-schema-expression.js";
import {
  isUnquotedSqliteKeyword,
  readBalancedSqliteExpression,
  scanSqliteSchemaTokens,
} from "./sqlite-schema-scanner.js";

type SchemaResultSet = Readonly<{
  columns: readonly string[];
  rows: readonly ArrayLike<unknown>[];
  rowsAffected: number;
}>;

type SchemaExecutor = Readonly<{
  execute(statement: InStatement | string, args?: InArgs): Promise<SchemaResultSet>;
}>;

type MutableIndex = {
  table: string;
  name: string;
  unique: boolean;
  partial: boolean;
  columns: Array<string | null>;
  predicate: string | null;
};

type ObservedForeignKey = Readonly<{
  table: string;
  columns: readonly string[];
  referencedTable: string;
  referencedColumns: readonly string[];
  onUpdate: string;
  onDelete: string;
  match: string;
}>;

type MutableForeignKey = {
  table: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onUpdate: string;
  onDelete: string;
  match: string;
};

const sqlIntegerSchema = z
  .union([z.number().int(), z.bigint()])
  .transform((value) => Number(value))
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const tableNameRowSchema = z.strictObject({ name: z.string().min(1) });
const tableSqlRowSchema = z.strictObject({
  tableName: z.string().min(1),
  sql: z.string().min(1),
});
const columnMetadataRowSchema = z.strictObject({
  cid: sqlIntegerSchema,
  name: z.string().min(1),
  type: z.string(),
  notNull: sqlIntegerSchema.refine((value) => value === 0 || value === 1),
  defaultValue: z.string().nullable(),
  primaryKey: sqlIntegerSchema,
  hidden: sqlIntegerSchema,
});
const indexMetadataRowSchema = z.strictObject({
  name: z.string().min(1),
  isUnique: sqlIntegerSchema.refine((value) => value === 0 || value === 1),
  partial: sqlIntegerSchema.refine((value) => value === 0 || value === 1),
  sequence: sqlIntegerSchema,
  columnName: z.string().nullable(),
  indexSql: z.string().min(1),
});
const foreignKeyMetadataRowSchema = z.strictObject({
  id: sqlIntegerSchema,
  sequence: sqlIntegerSchema,
  referencedTable: z.string().min(1),
  columnName: z.string().min(1),
  referencedColumn: z.string().min(1),
  onUpdate: z.string().min(1),
  onDelete: z.string().min(1),
  match: z.string().min(1),
});

function resultObjects(result: SchemaResultSet): unknown[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}

function equalStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export async function tableNames(client: SchemaExecutor): Promise<readonly string[]> {
  const result = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return tableNameRowSchema
    .array()
    .parse(resultObjects(result))
    .map((row) => row.name);
}

async function requireNoForbiddenSchemaObjects(client: SchemaExecutor): Promise<void> {
  const result = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type IN ('trigger', 'view') ORDER BY type, name",
  );
  if (tableNameRowSchema.array().parse(resultObjects(result)).length > 0) {
    throw new ProjectStorageBrokenError("Database contains a forbidden schema object.");
  }
}

function requireExactObjectKeys(
  actual: readonly string[],
  expected: readonly string[],
  missingMessage: string,
  unexpectedMessage: string,
): void {
  const counts = (keys: readonly string[]): ReadonlyMap<string, number> => {
    const result = new Map<string, number>();
    for (const key of keys) result.set(key, (result.get(key) ?? 0) + 1);
    return result;
  };
  const actualCounts = counts(actual);
  const expectedCounts = counts(expected);
  if (expected.some((key) => (actualCounts.get(key) ?? 0) < (expectedCounts.get(key) ?? 0))) {
    throw new ProjectStorageBrokenError(missingMessage);
  }
  if (actual.some((key) => (actualCounts.get(key) ?? 0) > (expectedCounts.get(key) ?? 0))) {
    throw new ProjectStorageBrokenError(unexpectedMessage);
  }
}

function invalidExpression(): never {
  throw new ProjectStorageBrokenError("Database schema expression is invalid.");
}

function unexpectedCheck(): never {
  throw new ProjectStorageBrokenError("Database contains an unexpected CHECK constraint.");
}

function requireConstraintPrefix(input: {
  constraint: ReturnType<typeof scanSqliteSchemaTokens>[number] | undefined;
  depth: number;
}): void {
  if (input.constraint === undefined) unexpectedCheck();
  if (!isUnquotedSqliteKeyword({ token: input.constraint, keyword: "constraint" })) {
    unexpectedCheck();
  }
}

function requireCheckName(input: {
  name: ReturnType<typeof scanSqliteSchemaTokens>[number] | undefined;
  depth: number;
}): asserts input is {
  name: ReturnType<typeof scanSqliteSchemaTokens>[number];
  depth: number;
} {
  if (input.name?.kind !== "identifier") return unexpectedCheck();
  if (input.name.depth !== input.depth) return unexpectedCheck();
}

function requireCheckOpening(input: {
  opening: ReturnType<typeof scanSqliteSchemaTokens>[number] | undefined;
  depth: number;
}): asserts input is {
  opening: ReturnType<typeof scanSqliteSchemaTokens>[number];
  depth: number;
} {
  if (input.opening?.kind !== "punctuation") return unexpectedCheck();
  if (input.opening.value !== "(") return unexpectedCheck();
  if (input.opening.depth !== input.depth) return unexpectedCheck();
}

function namedCheckAt(input: {
  definition: z.infer<typeof tableSqlRowSchema>;
  tokens: ReturnType<typeof scanSqliteSchemaTokens>;
  index: number;
}): Readonly<{ check: NamedCheckSpec; end: number }> | undefined {
  const token = input.tokens[input.index];
  if (token === undefined || !isUnquotedSqliteKeyword({ token, keyword: "check" })) {
    return undefined;
  }
  const constraint = input.tokens[input.index - 2];
  const name = input.tokens[input.index - 1];
  const opening = input.tokens[input.index + 1];
  requireConstraintPrefix({ constraint, depth: token.depth });
  const named = { name, depth: token.depth };
  requireCheckName(named);
  const opened = { opening, depth: token.depth };
  requireCheckOpening(opened);
  const extracted = readBalancedSqliteExpression({
    source: input.definition.sql,
    bodyStart: opened.opening.end,
  });
  return {
    check: {
      table: input.definition.tableName,
      name: named.name.value,
      expression: extracted.expression,
    },
    end: extracted.end,
  };
}

function tokenIndexAtOrAfter(input: {
  tokens: ReturnType<typeof scanSqliteSchemaTokens>;
  start: number;
  position: number;
}): number {
  let index = input.start;
  while (true) {
    const token = input.tokens[index];
    if (token === undefined || token.start >= input.position) return index;
    index += 1;
  }
}

function checksFromDefinition(definition: z.infer<typeof tableSqlRowSchema>): NamedCheckSpec[] {
  const checks: NamedCheckSpec[] = [];
  const tokens = scanSqliteSchemaTokens({ source: definition.sql });
  let index = 0;
  while (index < tokens.length) {
    const namedCheck = namedCheckAt({ definition, tokens, index });
    if (namedCheck === undefined) {
      index += 1;
      continue;
    }
    checks.push(namedCheck.check);
    index = tokenIndexAtOrAfter({ tokens, start: index + 1, position: namedCheck.end });
  }
  return checks;
}

async function readNamedChecks(client: SchemaExecutor): Promise<readonly NamedCheckSpec[]> {
  const result = await client.execute(
    "SELECT name AS tableName, sql FROM sqlite_schema " +
      "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return tableSqlRowSchema
    .array()
    .parse(resultObjects(result))
    .flatMap((definition) => checksFromDefinition(definition));
}

async function readDeclaredTableDefinitions(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly z.infer<typeof tableSqlRowSchema>[]> {
  const definitions = await Promise.all(
    tables.map(async (table) => {
      const result = await client.execute({
        sql: "SELECT name AS tableName, sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
        args: [table],
      });
      return tableSqlRowSchema.array().parse(resultObjects(result));
    }),
  );
  return definitions.flat();
}

async function requireNoForbiddenSchemaObjectsForTables(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<void> {
  for (const table of tables) {
    const result = await client.execute({
      sql: "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ? COLLATE NOCASE ORDER BY name",
      args: [table],
    });
    if (tableNameRowSchema.array().parse(resultObjects(result)).length > 0) {
      throw new ProjectStorageBrokenError("Database contains a forbidden schema object.");
    }
  }
}

async function readColumns(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly ColumnSpec[]> {
  const columns: ColumnSpec[] = [];
  for (const table of tables) {
    const rows = columnMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
          sql: `SELECT cid, name, type, "notnull" AS "notNull",
        dflt_value AS defaultValue, pk AS primaryKey, hidden
        FROM pragma_table_xinfo(?) ORDER BY cid`,
          args: [table],
        }),
      ),
    );
    columns.push(...rows.map((row) => ({ table, ...row })));
  }
  return columns;
}

function topLevelWhere(source: string): number | undefined {
  return scanSqliteSchemaTokens({ source }).find(
    (token) => token.depth === 0 && isUnquotedSqliteKeyword({ token, keyword: "where" }),
  )?.end;
}

function indexPredicate(indexSql: string, partial: boolean): string | null {
  const predicateStart = topLevelWhere(indexSql);
  if (!partial) {
    if (predicateStart !== undefined) return invalidExpression();
    return null;
  }
  if (predicateStart === undefined) return invalidExpression();
  const predicate = indexSql.slice(predicateStart).trim();
  if (predicate.length === 0) return invalidExpression();
  canonicalizeSqliteSchemaExpression(predicate);
  return predicate;
}

async function readIndexes(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly MutableIndex[]> {
  const indexes: MutableIndex[] = [];
  for (const table of tables) {
    const rows = indexMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
          sql: `SELECT il.name AS name, il."unique" AS isUnique,
            il.partial AS partial, ii.seqno AS sequence, ii.name AS columnName,
            schema_object.sql AS indexSql
            FROM pragma_index_list(?) AS il
            JOIN pragma_index_xinfo(il.name) AS ii ON ii."key" = 1
            JOIN sqlite_schema AS schema_object
              ON schema_object.type = 'index'
              AND schema_object.name = il.name
              AND schema_object.tbl_name = ?
            WHERE il.origin = 'c' ORDER BY il.name, ii.seqno`,
          args: [table, table],
        }),
      ),
    );
    for (const row of rows) {
      const partial = row.partial === 1;
      const predicate = indexPredicate(row.indexSql, partial);
      const current = indexes.at(-1);
      if (current !== undefined && current.table === table && current.name === row.name) {
        if (
          current.unique !== (row.isUnique === 1) ||
          current.partial !== partial ||
          current.predicate !== predicate
        ) {
          throw new ProjectStorageBrokenError("Database named index metadata is inconsistent.");
        }
        current.columns.push(row.columnName);
      } else {
        indexes.push({
          table,
          name: row.name,
          unique: row.isUnique === 1,
          partial,
          columns: [row.columnName],
          predicate,
        });
      }
    }
  }
  return indexes;
}

async function readForeignKeys(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly ObservedForeignKey[]> {
  const foreignKeys: MutableForeignKey[] = [];
  for (const table of tables) {
    const rows = foreignKeyMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
          sql: `SELECT id, seq AS sequence, "table" AS referencedTable,
            "from" AS columnName, "to" AS referencedColumn,
            on_update AS onUpdate, on_delete AS onDelete, match
            FROM pragma_foreign_key_list(?) ORDER BY id, seq`,
          args: [table],
        }),
      ),
    );
    let previousId: number | undefined;
    for (const row of rows) {
      const current = foreignKeys.at(-1);
      if (current !== undefined && previousId === row.id) {
        current.columns.push(row.columnName);
        current.referencedColumns.push(row.referencedColumn);
      } else {
        foreignKeys.push({
          table,
          columns: [row.columnName],
          referencedTable: row.referencedTable,
          referencedColumns: [row.referencedColumn],
          onUpdate: row.onUpdate,
          onDelete: row.onDelete,
          match: row.match,
        });
      }
      previousId = row.id;
    }
  }
  return foreignKeys;
}

function expressionIdentity(expression: string): string {
  return JSON.stringify(canonicalizeSqliteSchemaExpression(expression));
}

function columnKey(columnSpec: ColumnSpec): string {
  return JSON.stringify([
    columnSpec.table,
    columnSpec.cid,
    columnSpec.name,
    columnSpec.type,
    columnSpec.notNull,
    columnSpec.defaultValue,
    columnSpec.primaryKey,
    columnSpec.hidden,
  ]);
}

function checkKey(check: NamedCheckSpec): string {
  return JSON.stringify([check.table, check.name, expressionIdentity(check.expression)]);
}

function indexKey(indexSpec: NamedIndexSpec | MutableIndex): string {
  return JSON.stringify([
    indexSpec.table,
    indexSpec.name,
    indexSpec.unique,
    indexSpec.partial,
    indexSpec.columns,
    indexSpec.predicate === null ? null : expressionIdentity(indexSpec.predicate),
  ]);
}

function foreignKeyKey(foreignKey: ForeignKeySpec | ObservedForeignKey): string {
  return JSON.stringify([
    foreignKey.table,
    foreignKey.columns,
    foreignKey.referencedTable,
    foreignKey.referencedColumns,
    foreignKey.onUpdate,
    foreignKey.onDelete,
    foreignKey.match,
  ]);
}

async function verifyDeclaredSchemaObjects(
  client: SchemaExecutor,
  spec: DatabaseSpec,
): Promise<void> {
  await requireNoForbiddenSchemaObjects(client);
  const actualTables = [...(await tableNames(client))].sort((left, right) =>
    left.localeCompare(right),
  );
  const expectedTables = [...spec.tables].sort((left, right) => left.localeCompare(right));
  if (!equalStrings(actualTables, expectedTables)) {
    throw new ProjectStorageBrokenError("Database contains an unexpected table set.");
  }
  const [columns, checks, indexes, foreignKeys] = await Promise.all([
    readColumns(client, spec.tables),
    readNamedChecks(client),
    readIndexes(client, spec.tables),
    readForeignKeys(client, spec.tables),
  ]);
  requireExpectedSchemaObjects({ columns, checks, indexes, foreignKeys, spec });
}

function requireExpectedSchemaObjects(input: {
  columns: readonly ColumnSpec[];
  checks: readonly NamedCheckSpec[];
  indexes: readonly MutableIndex[];
  foreignKeys: readonly ObservedForeignKey[];
  spec: DatabaseSpec;
}): void {
  requireExactObjectKeys(
    input.columns.map(columnKey),
    input.spec.columns.map(columnKey),
    "Database required column definition is missing.",
    "Database contains an unexpected column definition.",
  );
  requireExactObjectKeys(
    input.checks.map(checkKey),
    input.spec.checks.map(checkKey),
    "Database required CHECK constraint is missing.",
    "Database contains an unexpected CHECK constraint.",
  );
  requireExactObjectKeys(
    input.indexes.map(indexKey),
    input.spec.indexes.map(indexKey),
    "Database required named index is missing.",
    "Database contains an unexpected named index.",
  );
  requireExactObjectKeys(
    input.foreignKeys.map(foreignKeyKey),
    input.spec.foreignKeys.map(foreignKeyKey),
    "Database required foreign key is missing.",
    "Database contains an unexpected foreign key.",
  );
}

async function verifyOwnedSchemaObjects(client: SchemaExecutor, spec: DatabaseSpec): Promise<void> {
  await requireNoForbiddenSchemaObjectsForTables(client, spec.tables);
  const definitions = await readDeclaredTableDefinitions(client, spec.tables);
  const actualTables = definitions.map((definition) => definition.tableName).sort();
  const expectedTables = [...spec.tables].sort((left, right) => left.localeCompare(right));
  if (!equalStrings(actualTables, expectedTables)) {
    throw new ProjectStorageBrokenError("Database required table is missing.");
  }
  const [columns, indexes, foreignKeys] = await Promise.all([
    readColumns(client, spec.tables),
    readIndexes(client, spec.tables),
    readForeignKeys(client, spec.tables),
  ]);
  requireExpectedSchemaObjects({
    columns,
    checks: definitions.flatMap((definition) => checksFromDefinition(definition)),
    indexes,
    foreignKeys,
    spec,
  });
}

async function requireVerifiedSchemaObjects(verify: () => Promise<void>): Promise<void> {
  try {
    await verify();
  } catch (error) {
    if (error instanceof ProjectStorageBrokenError) throw error;
    throw new ProjectStorageBrokenError("Database schema authority is invalid.", { cause: error });
  }
}

export async function requireDeclaredSchemaObjects(
  client: SchemaExecutor,
  spec: DatabaseSpec,
): Promise<void> {
  return requireVerifiedSchemaObjects(() => verifyDeclaredSchemaObjects(client, spec));
}

export async function requireOwnedSchemaObjects(
  client: SchemaExecutor,
  spec: DatabaseSpec,
): Promise<void> {
  return requireVerifiedSchemaObjects(() => verifyOwnedSchemaObjects(client, spec));
}
