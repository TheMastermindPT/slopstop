import { createHash } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { ProjectStorageBrokenError } from "../../src/storage/project-storage-errors.js";
import {
  type DatabaseSpec,
  loadGeneratedMigrations,
} from "../../src/storage/project-storage-node-adapters.js";
import {
  createMigrationGuardFixture,
  generationOneGuardSpec,
  initialJournalEntry,
} from "./migration-guard-fixture.js";
import { canonicalGenerationTwoTables } from "./project-storage-schema-cases.js";

type RebuildInput = Readonly<{
  predecessor: string;
  statements: readonly string[];
  tags: readonly [string, string];
  spec: DatabaseSpec;
}>;
type RebuildCase = Readonly<{
  name: string;
  change(input: RebuildInput): RebuildInput;
  message?: string;
}>;
const rebuildInvalidMessage = "Generated canonical storage identity rebuild is invalid.";
const rebuildInvalidCases: readonly RebuildCase[] = [
  { name: "successor tag", change: (input) => ({ ...input, tags: [input.tags[0], "0001_wrong"] }) },
  {
    name: "predecessor tag",
    change: (input) => ({ ...input, tags: ["0000_wrong", input.tags[1]] }),
  },
  {
    name: "predecessor bytes",
    change: (input) => ({ ...input, predecessor: `${input.predecessor}\n-- changed` }),
  },
  { name: "format", change: (input) => ({ ...input, spec: { ...input.spec, formatVersion: 2 } }) },
  { name: "schema", change: (input) => ({ ...input, spec: { ...input.spec, schemaVersion: 1 } }) },
  {
    name: "metadata key",
    change: (input) => ({ ...input, spec: { ...input.spec, metadataKey: "application" } }),
  },
  {
    name: "metadata table",
    change: (input) => ({
      ...input,
      spec: { ...input.spec, metadataTable: "slopstop_runtime_schema_metadata" },
    }),
  },
  ...[24, 25, 26, 27, 28, 29].map(
    (index): RebuildCase => ({
      name: `missing rebuild statement ${index}`,
      change: (input) => ({
        ...input,
        statements: input.statements.filter((_, position) => position !== index),
      }),
    }),
  ),
  {
    name: "reordered block",
    change: (input) => ({
      ...input,
      statements: [...input.statements.slice(0, 24), ...input.statements.slice(24).reverse()],
    }),
  },
  {
    name: "interleaved block",
    change: (input) => ({
      ...input,
      statements: [...input.statements.slice(0, 27), "SELECT 1;", ...input.statements.slice(27)],
    }),
  },
  ...[27, 28].map(
    (index): RebuildCase => ({
      name: `isolated rebuild statement ${index}`,
      change: (input) => ({
        ...input,
        statements: input.statements.filter((_, position) => position < 24 || position === index),
      }),
    }),
  ),
  ...[
    [25, "`created_at` text NOT NULL", "`created_at` integer NOT NULL"],
    [25, "= 'storage'", "= 'other'"],
    [25, "ON DELETE restrict", "ON DELETE no action"],
    [26, 'SELECT "identity_key", "project_id"', 'SELECT "project_id", "identity_key"'],
    [26, "FROM `storage_identity`", "FROM `project_state`"],
    [28, "RENAME TO `storage_identity`", "RENAME TO `other`"],
  ].map(
    ([index, before, after]): RebuildCase => ({
      name: `altered statement ${index}: ${before}`,
      change: (input) => ({
        ...input,
        statements: input.statements.map((statement, position) =>
          position === index ? statement.replace(String(before), String(after)) : statement,
        ),
      }),
    }),
  ),
  {
    name: "duplicate block",
    change: (input) => ({
      ...input,
      statements: [...input.statements, ...input.statements.slice(24)],
    }),
  },
  {
    name: "recreated temporary table",
    change: (input) => ({
      ...input,
      statements: [...input.statements, "CREATE TABLE __new_storage_identity (id TEXT);"],
    }),
  },
  {
    name: "extra temporary reference",
    change: (input) => ({
      ...input,
      statements: [...input.statements, "SELECT * FROM __new_storage_identity;"],
    }),
  },
  ...["__new_other", "future_owner"].map(
    (name): RebuildCase => ({
      name,
      message: "Generated migration creates an unknown table.",
      change: (input) => ({
        ...input,
        statements: [...input.statements, `CREATE TABLE ${name} (id TEXT);`],
      }),
    }),
  ),
  ...[
    [
      "CREATE TRIGGER forbidden AFTER INSERT ON storage_identity BEGIN SELECT 1; END;",
      "Generated migration creates a forbidden object.",
    ],
    ["CREATE VIEW forbidden AS SELECT 1;", "Generated migration creates a forbidden object."],
    [
      "CREATE TABLE __drizzle_migrations (id INTEGER);",
      "Generated migration uses a forbidden implicit ledger.",
    ],
  ].map(
    ([statement, message]): RebuildCase => ({
      name: String(statement),
      message: String(message),
      change: (input) => ({ ...input, statements: [...input.statements, String(statement)] }),
    }),
  ),
  ...(["application", "runtime"] as const).map(
    (kind): RebuildCase => ({
      name: `scope ${kind}`,
      message: "Generated migration creates an unknown table.",
      change: (input) => ({
        ...input,
        spec: {
          ...input.spec,
          resourceKind: kind,
          databaseKind: kind === "runtime" ? "runtime-adapter" : "application",
        },
      }),
    }),
  ),
];

async function readRebuildInput(): Promise<RebuildInput> {
  const predecessor = await readFile(
    path.resolve(import.meta.dirname, "../../drizzle/canonical/0000_fat_doctor_octopus.sql"),
    "utf8",
  );
  const successor = await readFile(
    path.resolve(import.meta.dirname, "../fixtures/canonical-project-writer-generation-2.sql"),
    "utf8",
  );
  return {
    predecessor,
    statements: successor
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean),
    tags: ["0000_fat_doctor_octopus", "0001_canonical_project_writer"],
    spec: { ...generationOneGuardSpec, schemaVersion: 2, tables: canonicalGenerationTwoTables },
  };
}

async function loadRebuildFixture(input: RebuildInput) {
  const fixture = await createMigrationGuardFixture();
  try {
    await rm(fixture.sqlPath);
    await fixture.writeJournal(
      input.tags.map((tag, idx) => ({ ...initialJournalEntry, tag, idx, when: idx + 1 })),
    );
    await writeFile(path.join(fixture.kindRoot, `${input.tags[0]}.sql`), input.predecessor);
    await writeFile(
      path.join(fixture.kindRoot, `${input.tags[1]}.sql`),
      input.statements.join("\n--> statement-breakpoint\n"),
    );
    if (input.spec.resourceKind !== "canonical") {
      await rename(fixture.kindRoot, path.join(fixture.root, input.spec.resourceKind));
    }
    return await loadGeneratedMigrations(fixture.root, input.spec);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

it("authorizes only the pinned canonical storage-identity rebuild", async () => {
  const input = await readRebuildInput();
  expect(createHash("sha256").update(input.predecessor).digest("hex")).toBe(
    "e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c",
  );
  expect(createHash("sha256").update(JSON.stringify(input.statements)).digest("hex")).toBe(
    "e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14",
  );
  const expected = [
    {
      migrationId: "0000_fat_doctor_octopus",
      statements: input.predecessor
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean),
    },
    { migrationId: "0001_canonical_project_writer", statements: input.statements },
  ];
  expect(expected.map((migration) => migration.statements.length)).toEqual([2, 30]);
  await expect(loadRebuildFixture(input)).resolves.toEqual(expected);
  for (const scenario of rebuildInvalidCases) {
    await expect(loadRebuildFixture(scenario.change(input)), scenario.name).rejects.toEqual(
      new ProjectStorageBrokenError(scenario.message ?? rebuildInvalidMessage),
    );
  }
  const original = await createMigrationGuardFixture();
  try {
    await expect(loadGeneratedMigrations(original.root, generationOneGuardSpec)).resolves.toEqual([
      {
        migrationId: "0000_initial",
        statements: [
          "CREATE TABLE schema_metadata (metadata_key TEXT);",
          "CREATE TABLE storage_identity (identity_key TEXT);",
        ],
      },
    ]);
  } finally {
    await rm(original.root, { recursive: true, force: true });
  }
});
