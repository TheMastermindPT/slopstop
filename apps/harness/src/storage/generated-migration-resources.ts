import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { GeneratedMigration } from "./generated-migrations.js";
import type { DatabaseSpec } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  isUnquotedSqliteKeyword,
  type SqliteSchemaToken,
  scanSqliteSchemaTokens,
} from "./sqlite-schema-scanner.js";

const drizzleJournalSchema = z.strictObject({
  version: z.string().trim().min(1),
  dialect: z.literal("sqlite"),
  entries: z.array(
    z.strictObject({
      idx: z.number().int().nonnegative(),
      version: z.string().trim().min(1),
      when: z.number().int().nonnegative(),
      tag: z.string().regex(/^[0-9]{4}_[a-z0-9_]+$/u),
      breakpoints: z.boolean(),
    }),
  ),
});

type DrizzleJournal = z.infer<typeof drizzleJournalSchema>;

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
  if (relativeRoot.length === 0) return rejectEscapedRoot();
  if (relativeRoot.startsWith("..")) return rejectEscapedRoot();
  if (path.isAbsolute(relativeRoot)) return rejectEscapedRoot();
  if (path.dirname(relativeRoot) !== ".") return rejectEscapedRoot();
  return kindRoot;
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
    return drizzleJournalSchema.parse(JSON.parse(source));
  } catch {
    throw new ProjectStorageBrokenError("Generated migration journal is invalid.");
  }
}

function requireOrderedJournal(journal: DrizzleJournal): void {
  const tags = new Set<string>();
  let previousWhen = -1;
  for (const [index, entry] of journal.entries.entries()) {
    const rejectInvalidOrder = (): never => {
      throw new ProjectStorageBrokenError("Generated migration journal ordering is invalid.");
    };
    if (entry.idx !== index) rejectInvalidOrder();
    if (entry.when < previousWhen) rejectInvalidOrder();
    if (tags.has(entry.tag)) rejectInvalidOrder();
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

function createdObjects(tokens: readonly SqliteSchemaToken[]): readonly CreatedObject[] {
  const objects: CreatedObject[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const create = tokens[index];
    if (create === undefined || !isUnquotedSqliteKeyword({ token: create, keyword: "create" })) {
      continue;
    }
    let kindIndex = tokenAfterOptionalKeywords({
      tokens,
      start: index + 1,
      keywords: ["temp", "temporary"],
    });
    if (isUnquotedSqliteKeyword({ token: tokens[kindIndex] ?? create, keyword: "virtual" })) {
      kindIndex += 1;
    }
    const kindToken = tokens[kindIndex];
    const kind = ["table", "trigger", "view"].find(
      (candidate) =>
        kindToken !== undefined &&
        isUnquotedSqliteKeyword({ token: kindToken, keyword: candidate }),
    ) as CreatedObject["kind"] | undefined;
    if (kind === undefined) continue;
    let nameIndex = kindIndex + 1;
    if (kind === "table") {
      nameIndex = tokenAfterOptionalKeywords({
        tokens,
        start: nameIndex,
        keywords: ["if", "not", "exists"],
      });
    }
    const name = tokens[nameIndex];
    if (name?.kind !== "identifier") {
      throw new ProjectStorageBrokenError("Generated migration object name is invalid.");
    }
    objects.push({ kind, name: name.value });
  }
  return objects;
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
  const binding = input.migrations[2];
  const generationThree =
    input.spec.schemaVersion === 3 &&
    input.migrations.length === 3 &&
    input.sources.length === 3 &&
    binding?.migrationId === "0002_initial_repository_binding" &&
    createHash("sha256").update(JSON.stringify(binding.statements)).digest("hex") ===
      "332ea4d600ae9c32789d760f86b215ac9bbd578f12f17a27061c03696779d134";
  const authorityAgrees = [
    input.spec.resourceKind === "canonical",
    input.spec.databaseKind === "canonical",
    input.spec.metadataKey === "canonical",
    input.spec.metadataTable === "schema_metadata",
    input.spec.formatVersion === 1,
    (input.spec.schemaVersion === 2 &&
      input.migrations.length === 2 &&
      input.sources.length === 2) ||
      generationThree,
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

function requireAuthorizedSql(
  sources: readonly string[],
  spec: DatabaseSpec,
  migrations: readonly GeneratedMigration[],
): void {
  const createdTables = new Set<string>();
  let hasRebuildCandidate = false;
  for (const source of sources) {
    const tokens = scanSqliteSchemaTokens({ source });
    if (
      tokens.some(
        (token) =>
          token.kind === "identifier" && token.value.toLowerCase() === "__drizzle_migrations",
      )
    ) {
      throw new ProjectStorageBrokenError("Generated migration uses a forbidden implicit ledger.");
    }
    for (const object of createdObjects(tokens)) {
      if (object.kind === "trigger" || object.kind === "view") {
        throw new ProjectStorageBrokenError("Generated migration creates a forbidden object.");
      }
      if (
        object.name === "__new_storage_identity" &&
        spec.resourceKind === "canonical" &&
        spec.databaseKind === "canonical"
      ) {
        hasRebuildCandidate = true;
        continue;
      }
      if (!spec.tables.includes(object.name)) {
        throw new ProjectStorageBrokenError("Generated migration creates an unknown table.");
      }
      createdTables.add(object.name);
    }
  }
  if (
    hasRebuildCandidate ||
    (spec.resourceKind === "canonical" && [2, 3].includes(spec.schemaVersion))
  ) {
    requireCanonicalRebuild({ sources, migrations, spec });
  }
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
