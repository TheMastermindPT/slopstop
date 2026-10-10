import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { ProjectStorageBrokenError } from "../../src/storage/project-storage-errors.js";
import {
  databaseSpecs,
  loadGeneratedMigrations,
} from "../../src/storage/project-storage-node-adapters.js";

const checkedInCanonical = path.resolve(import.meta.dirname, "../../drizzle/canonical");
const conversationTag = "0003_conversation_messages";

type Journal = { entries: { tag: string }[] };

/** A copy of the checked-in canonical migrations, changed by `change` before loading. */
async function loadChangedCopy(
  change: (kindRoot: string) => Promise<void>,
  spec = databaseSpecs.canonical,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-generation-four-pin-"));
  try {
    const kindRoot = path.join(root, "canonical");
    await cp(checkedInCanonical, kindRoot, { recursive: true });
    await change(kindRoot);
    return await loadGeneratedMigrations(root, spec);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function editJournal(kindRoot: string, edit: (journal: Journal) => Journal) {
  const journalPath = path.join(kindRoot, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
  await writeFile(journalPath, JSON.stringify(edit(journal)));
}

const refusals = [
  {
    name: "a changed 0003 statement",
    change: async (kindRoot: string) => {
      const sqlPath = path.join(kindRoot, `${conversationTag}.sql`);
      const sql = await readFile(sqlPath, "utf8");
      await writeFile(sqlPath, sql.replace("between 1 and 32768", "between 1 and 65536"));
    },
  },
  {
    name: "a wrong 0003 tag",
    change: async (kindRoot: string) => {
      const sql = await readFile(path.join(kindRoot, `${conversationTag}.sql`), "utf8");
      await rm(path.join(kindRoot, `${conversationTag}.sql`));
      await writeFile(path.join(kindRoot, "0003_other_messages.sql"), sql);
      await editJournal(kindRoot, (journal) => ({
        ...journal,
        entries: journal.entries.map((entry) =>
          entry.tag === conversationTag ? { ...entry, tag: "0003_other_messages" } : entry,
        ),
      }));
    },
  },
  {
    name: "a schema-4 spec with three migrations",
    change: async (kindRoot: string) => {
      await rm(path.join(kindRoot, `${conversationTag}.sql`));
      await rm(path.join(kindRoot, "meta", "0003_snapshot.json"));
      await editJournal(kindRoot, (journal) => ({
        ...journal,
        entries: journal.entries.filter((entry) => entry.tag !== conversationTag),
      }));
    },
  },
] as const;

it("loads the checked-in canonical migrations under the generation-four pin", async () => {
  const migrations = await loadChangedCopy(async () => undefined);
  expect(migrations.map((migration) => migration.migrationId)).toEqual([
    "0000_fat_doctor_octopus",
    "0001_canonical_project_writer",
    "0002_initial_repository_binding",
    conversationTag,
  ]);
});

it.for(refusals)("refuses the generation-four pin for $name", async ({ change }) => {
  await expect(loadChangedCopy(change)).rejects.toEqual(
    new ProjectStorageBrokenError("Generated canonical storage identity rebuild is invalid."),
  );
});
