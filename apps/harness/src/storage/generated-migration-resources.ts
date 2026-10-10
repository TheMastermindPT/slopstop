import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { decodeStrict, TrimmedNonEmptyTextSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import type { GeneratedMigration } from "./generated-migrations.js";
import type { DatabaseSpec } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  isUnquotedSqliteKeyword,
  type SqliteSchemaToken,
  scanSqliteSchemaTokens,
} from "./sqlite-schema-scanner.js";

const NonnegativeIntegerSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);
const drizzleJournalSchema = Schema.Struct({
  version: TrimmedNonEmptyTextSchema,
  dialect: Schema.Literal("sqlite"),
  entries: Schema.Array(
    Schema.Struct({
      idx: NonnegativeIntegerSchema,
      version: TrimmedNonEmptyTextSchema,
      when: NonnegativeIntegerSchema,
      tag: Schema.String.check(Schema.isPattern(/^[0-9]{4}_[a-z0-9_]+$/u)),
      breakpoints: Schema.Boolean,
    }),
  ),
});

type DrizzleJournal = typeof drizzleJournalSchema.Type;

function equalStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

async function lstatIfPresent(input: { targetPath: string; failureMessage: string }) {
  try {
    return await lstat(input.targetPath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw new ProjectStorageBrokenError(input.failureMessage);
  }
}

async function requirePlainEntry(input: {
  targetPath: string;
  message: string;
  accepts(entry: Awaited<ReturnType<typeof lstat>>): boolean;
}): Promise<void> {
  const entry = await lstatIfPresent({
    targetPath: input.targetPath,
    failureMessage: input.message,
  });
  if (entry === undefined) throw new ProjectStorageBrokenError(input.message);
  if (entry.isSymbolicLink()) throw new ProjectStorageBrokenError(input.message);
  if (!input.accepts(entry)) throw new ProjectStorageBrokenError(input.message);
}

function trustedKindRoot(input: { migrationResourcesRoot: string; spec: DatabaseSpec }): string {
  const trustedRoot = path.resolve(input.migrationResourcesRoot);
  const kindRoot = path.resolve(trustedRoot, input.spec.resourceKind);
  const relativeRoot = path.relative(trustedRoot, kindRoot);
  const rejectEscapedRoot = (): never => {
    throw new ProjectStorageBrokenError("Generated migration root escaped trusted resources.");
  };
  const directChild = [
    relativeRoot.length > 0,
    !relativeRoot.startsWith(".."),
    !path.isAbsolute(relativeRoot),
    path.dirname(relativeRoot) === ".",
  ].every(Boolean);
  return directChild ? kindRoot : rejectEscapedRoot();
}

async function readTextFile(input: { filePath: string; message: string }): Promise<string> {
  try {
    return await readFile(input.filePath, "utf8");
  } catch {
    throw new ProjectStorageBrokenError(input.message);
  }
}

async function readJournal(input: { journalPath: string }): Promise<DrizzleJournal> {
  const source = await readTextFile({
    filePath: input.journalPath,
    message: "Generated migration journal is unavailable.",
  });
  try {
    return decodeStrict(drizzleJournalSchema, JSON.parse(source));
  } catch {
    throw new ProjectStorageBrokenError("Generated migration journal is invalid.");
  }
}

function requireOrderedJournal(journal: DrizzleJournal): void {
  const tags = new Set<string>();
  let previousWhen = -1;
  for (const [index, entry] of journal.entries.entries()) {
    const ordered = [entry.idx === index, entry.when >= previousWhen, !tags.has(entry.tag)];
    if (!ordered.every(Boolean)) {
      throw new ProjectStorageBrokenError("Generated migration journal ordering is invalid.");
    }
    previousWhen = entry.when;
    tags.add(entry.tag);
  }
  if (journal.entries.length === 0) {
    throw new ProjectStorageBrokenError("Generated migration journal is empty.");
  }
}

async function readRootEntries(input: { kindRoot: string }) {
  try {
    return await readdir(input.kindRoot, { withFileTypes: true });
  } catch {
    throw new ProjectStorageBrokenError("Generated migration directory is unavailable.");
  }
}

async function requireExactResources(input: {
  kindRoot: string;
  journal: DrizzleJournal;
}): Promise<void> {
  const rootEntries = await readRootEntries({ kindRoot: input.kindRoot });
  const actualNames = sortedStrings(rootEntries.map((entry) => entry.name));
  const expectedNames = sortedStrings([
    "meta",
    ...input.journal.entries.map((entry) => `${entry.tag}.sql`),
  ]);
  if (!equalStrings(actualNames, expectedNames)) {
    throw new ProjectStorageBrokenError("Generated migration resources disagree with the journal.");
  }
  for (const entry of rootEntries) {
    const validType = entry.name === "meta" ? entry.isDirectory() : entry.isFile();
    if (entry.isSymbolicLink() || !validType) {
      throw new ProjectStorageBrokenError("Generated migration resource type is invalid.");
    }
  }
}

function migrationStatements(input: { source: string }): readonly string[] {
  const statements = input.source
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  if (statements.length === 0) {
    throw new ProjectStorageBrokenError("Generated migration contains no statements.");
  }
  return statements;
}

async function readSqlMigrations(
  input: Readonly<{ kindRoot: string; journal: DrizzleJournal }>,
): Promise<Readonly<{ migrations: readonly GeneratedMigration[]; sources: readonly string[] }>> {
  const sources: string[] = [];
  const migrations: GeneratedMigration[] = [];
  for (const entry of input.journal.entries) {
    const sqlPath = path.join(input.kindRoot, `${entry.tag}.sql`);
    await requirePlainEntry({
      targetPath: sqlPath,
      message: "Generated migration resource type is invalid.",
      accepts: (resource) => resource.isFile(),
    });
    const source = await readTextFile({
      filePath: sqlPath,
      message: "Generated migration SQL is unavailable.",
    });
    if (source.trim().length === 0) {
      throw new ProjectStorageBrokenError("Generated migration SQL is empty.");
    }
    sources.push(source);
    migrations.push({ migrationId: entry.tag, statements: migrationStatements({ source }) });
  }
  return { migrations, sources };
}

type CreatedObject = Readonly<{
  kind: "table" | "trigger" | "view";
  name: string;
}>;

function tokenAfterOptionalKeywords(
  input: Readonly<{
    tokens: readonly SqliteSchemaToken[];
    start: number;
    keywords: readonly string[];
  }>,
): number {
  let index = input.start;
  for (const keyword of input.keywords) {
    const token = input.tokens[index];
    if (token !== undefined && isUnquotedSqliteKeyword({ token, keyword })) index += 1;
  }
  return index;
}

const createdObjectKinds = ["table", "trigger", "view"] as const;

/** The kind of object a `CREATE` at `createIndex` makes, and where that kind keyword is. */
function createdKindAt(
  tokens: readonly SqliteSchemaToken[],
  createIndex: number,
): Readonly<{ kind: CreatedObject["kind"]; kindIndex: number }> | undefined {
  let kindIndex = tokenAfterOptionalKeywords({
    tokens,
    start: createIndex + 1,
    keywords: ["temp", "temporary"],
  });
  if (isKeywordAt(tokens, kindIndex, "virtual")) kindIndex += 1;
  const kindToken = tokens[kindIndex];
  if (kindToken === undefined) return undefined;
  const kind = createdObjectKinds.find((keyword) =>
    isUnquotedSqliteKeyword({ token: kindToken, keyword }),
  );
  return kind === undefined ? undefined : { kind, kindIndex };
}

function isKeywordAt(tokens: readonly SqliteSchemaToken[], index: number, keyword: string) {
  const token = tokens[index];
  return token !== undefined && isUnquotedSqliteKeyword({ token, keyword });
}

/** A table name may follow `IF NOT EXISTS`; other objects name themselves right away. */
function createdNameIndex(
  tokens: readonly SqliteSchemaToken[],
  created: Readonly<{ kind: CreatedObject["kind"]; kindIndex: number }>,
): number {
  const start = created.kindIndex + 1;
  if (created.kind !== "table") return start;
  return tokenAfterOptionalKeywords({ tokens, start, keywords: ["if", "not", "exists"] });
}

/** The object a `CREATE` keyword at `index` makes; `undefined` for any other token. */
function createdObjectAt(
  tokens: readonly SqliteSchemaToken[],
  index: number,
): CreatedObject | undefined {
  if (!isKeywordAt(tokens, index, "create")) return undefined;
  const created = createdKindAt(tokens, index);
  if (created === undefined) return undefined;
  const name = tokens[createdNameIndex(tokens, created)];
  if (name?.kind !== "identifier") {
    throw new ProjectStorageBrokenError("Generated migration object name is invalid.");
  }
  return { kind: created.kind, name: name.value };
}

function createdObjects(tokens: readonly SqliteSchemaToken[]): readonly CreatedObject[] {
  return tokens.flatMap((_, index) => createdObjectAt(tokens, index) ?? []);
}

/** The reviewed canonical migrations after the rebuild, in order, each pinned by its statements. */
const pinnedCanonicalSuccessors = [
  {
    migrationId: "0002_initial_repository_binding",
    statementsSha256: "332ea4d600ae9c32789d760f86b215ac9bbd578f12f17a27061c03696779d134",
  },
  {
    migrationId: "0003_conversation_messages",
    statementsSha256: "a81cce4fcaa19e59ef125326bceea698dd7c3987a9bbfdce82e905267bb044bf",
  },
] as const;

/** Schema N has exactly N migrations, and every one after the rebuild pair is a reviewed pin. */
function pinnedAfterRebuild(input: {
  sources: readonly string[];
  migrations: readonly GeneratedMigration[];
  spec: DatabaseSpec;
}): boolean {
  const version = input.spec.schemaVersion;
  if (version < 2 || version > pinnedCanonicalSuccessors.length + 2) return false;
  if (input.migrations.length !== version || input.sources.length !== version) return false;
  return input.migrations.slice(2).every((migration, index) => {
    const pin = pinnedCanonicalSuccessors[index];
    return (
      migration.migrationId === pin?.migrationId &&
      createHash("sha256").update(JSON.stringify(migration.statements)).digest("hex") ===
        pin.statementsSha256
    );
  });
}

function requireCanonicalRebuild(input: {
  sources: readonly string[];
  migrations: readonly GeneratedMigration[];
  spec: DatabaseSpec;
}): void {
  const invalid: () => never = () => {
    throw new ProjectStorageBrokenError("Generated canonical storage identity rebuild is invalid.");
  };
  const predecessor = input.sources[0];
  const original = input.migrations[0];
  const successor = input.migrations[1];
  if (predecessor === undefined) invalid();
  if (original === undefined) invalid();
  if (successor === undefined) invalid();
  const authorityAgrees = [
    input.spec.resourceKind === "canonical",
    input.spec.databaseKind === "canonical",
    input.spec.metadataKey === "canonical",
    input.spec.metadataTable === "schema_metadata",
    input.spec.formatVersion === 1,
    pinnedAfterRebuild(input),
    !input.spec.tables.includes("__new_storage_identity"),
    original.migrationId === "0000_fat_doctor_octopus",
    successor.migrationId === "0001_canonical_project_writer",
  ].every(Boolean);
  if (!authorityAgrees) invalid();
  // Pins identify the reviewed executable proposal, never caller-supplied metadata.
  const predecessorHash = createHash("sha256").update(predecessor).digest("hex");
  const successorHash = createHash("sha256")
    .update(JSON.stringify(successor.statements))
    .digest("hex");
  if (predecessorHash !== "e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c")
    invalid();
  if (successorHash !== "e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14")
    invalid();
}

function isCanonicalSpec(spec: DatabaseSpec): boolean {
  return spec.resourceKind === "canonical" && spec.databaseKind === "canonical";
}

function requireNoImplicitLedger(tokens: readonly SqliteSchemaToken[]): void {
  const usesLedger = tokens.some(
    (token) => token.kind === "identifier" && token.value.toLowerCase() === "__drizzle_migrations",
  );
  if (usesLedger) {
    throw new ProjectStorageBrokenError("Generated migration uses a forbidden implicit ledger.");
  }
}

/** A created object is the canonical rebuild candidate or one of the spec's tables. */
function authorizedObject(object: CreatedObject, spec: DatabaseSpec): "rebuild" | "table" {
  if (object.kind !== "table") {
    throw new ProjectStorageBrokenError("Generated migration creates a forbidden object.");
  }
  if (object.name === "__new_storage_identity" && isCanonicalSpec(spec)) return "rebuild";
  if (!spec.tables.includes(object.name)) {
    throw new ProjectStorageBrokenError("Generated migration creates an unknown table.");
  }
  return "table";
}

function requireAuthorizedSql(
  sources: readonly string[],
  spec: DatabaseSpec,
  migrations: readonly GeneratedMigration[],
): void {
  const created = sources.flatMap((source) => {
    const tokens = scanSqliteSchemaTokens({ source });
    requireNoImplicitLedger(tokens);
    return createdObjects(tokens).map((object) => ({
      object,
      use: authorizedObject(object, spec),
    }));
  });
  const hasRebuildCandidate = created.some(({ use }) => use === "rebuild");
  const createdTables = new Set(
    created.filter(({ use }) => use === "table").map(({ object }) => object.name),
  );
  const rebuildPinned = spec.resourceKind === "canonical" && spec.schemaVersion >= 2;
  if (hasRebuildCandidate || rebuildPinned) requireCanonicalRebuild({ sources, migrations, spec });
  if (!equalStrings(sortedStrings(createdTables), sortedStrings(spec.tables))) {
    throw new ProjectStorageBrokenError("Generated migration table authority is incomplete.");
  }
}

async function loadGeneratedMigrationResources(
  migrationResourcesRoot: string,
  spec: DatabaseSpec,
): Promise<readonly GeneratedMigration[]> {
  const trustedRoot = path.resolve(migrationResourcesRoot);
  const kindRoot = trustedKindRoot({ migrationResourcesRoot: trustedRoot, spec });
  await requirePlainEntry({
    targetPath: trustedRoot,
    message: "Generated migration directory is unavailable.",
    accepts: (entry) => entry.isDirectory(),
  });
  await requirePlainEntry({
    targetPath: kindRoot,
    message: "Generated migration directory is unavailable.",
    accepts: (entry) => entry.isDirectory(),
  });
  const metadataRoot = path.join(kindRoot, "meta");
  await requirePlainEntry({
    targetPath: metadataRoot,
    message: "Generated migration metadata is unavailable.",
    accepts: (entry) => entry.isDirectory(),
  });
  const journalPath = path.join(metadataRoot, "_journal.json");
  await requirePlainEntry({
    targetPath: journalPath,
    message: "Generated migration journal is unavailable.",
    accepts: (entry) => entry.isFile(),
  });
  const journal = await readJournal({ journalPath });
  requireOrderedJournal(journal);
  await requireExactResources({ kindRoot, journal });
  const loaded = await readSqlMigrations({ kindRoot, journal });
  requireAuthorizedSql(loaded.sources, spec, loaded.migrations);
  return loaded.migrations;
}

export async function loadGeneratedMigrations(
  migrationResourcesRoot: string,
  spec: DatabaseSpec,
): Promise<readonly GeneratedMigration[]> {
  try {
    return await loadGeneratedMigrationResources(migrationResourcesRoot, spec);
  } catch (error) {
    if (error instanceof ProjectStorageBrokenError) throw error;
    throw new ProjectStorageBrokenError("Generated migration resources are invalid.");
  }
}
