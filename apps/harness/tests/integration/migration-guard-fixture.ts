import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type DatabaseSpec,
  databaseSpecs,
} from "../../src/storage/project-storage-node-adapters.js";

export type MigrationGuardFixture = Readonly<{
  root: string;
  kindRoot: string;
  metadataRoot: string;
  journalPath: string;
  sqlPath: string;
  writeJournal(entries: readonly Record<string, unknown>[]): Promise<void>;
}>;

export const initialJournalEntry = {
  idx: 0,
  version: "7",
  when: 1,
  tag: "0000_initial",
  breakpoints: true,
};
export const validCanonicalMigrationSql = `CREATE TABLE schema_metadata (metadata_key TEXT);
--> statement-breakpoint
CREATE TABLE storage_identity (identity_key TEXT);`;

export const generationOneGuardSpec: DatabaseSpec = {
  ...databaseSpecs.canonical,
  schemaVersion: 1,
  tables: ["schema_metadata", "storage_identity"],
};

export async function createMigrationGuardFixture(): Promise<MigrationGuardFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-migration-guard-"));
  const kindRoot = path.join(root, "canonical");
  const metadataRoot = path.join(kindRoot, "meta");
  const journalPath = path.join(metadataRoot, "_journal.json");
  const sqlPath = path.join(kindRoot, "0000_initial.sql");
  await mkdir(metadataRoot, { recursive: true });
  const writeJournal = async (entries: readonly Record<string, unknown>[]): Promise<void> => {
    await writeFile(journalPath, JSON.stringify({ version: "7", dialect: "sqlite", entries }));
  };
  await writeJournal([initialJournalEntry]);
  await writeFile(sqlPath, validCanonicalMigrationSql);
  return { root, kindRoot, metadataRoot, journalPath, sqlPath, writeJournal };
}
