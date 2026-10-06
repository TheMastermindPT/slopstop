import { open, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect } from "vitest";
import { createApplicationDatabaseAuthority } from "../../src/storage/application-database-authority.js";
import { generationPaths } from "./project-storage-open-fixture.js";
import { checkedInMigrationRoot, upgradeIds } from "./project-storage-runtime-fixture.js";

const otherId = "00000000-0000-4000-8000-0000000000e2";

type DatabaseFile = Readonly<{ databasePath: string }>;

/** The closed files of the upgrade's staged generation and of its backup. */
export function upgradePaths({ root }: Readonly<{ root: string }>) {
  const project = generationPaths(root).project;
  const staging = path.join(project, `.staging-${upgradeIds.targetGenerationId}`);
  const backup = path.join(project, "snapshots", upgradeIds.upgradeId);
  return {
    staging,
    backup,
    stagedCanonical: path.join(staging, "slopstop.db"),
    stagedRuntime: path.join(staging, "mastra.db"),
    backupCanonical: path.join(backup, "slopstop.db"),
    backupRuntime: path.join(backup, "mastra.db"),
  };
}

/** Runs SQL against a closed database with foreign keys off, as an outside writer would. */
function mutateDatabase({ databasePath }: DatabaseFile, sql: string): void {
  const database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: false });
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

/** Overwrites 16 bytes of page 2 after its b-tree header byte, leaving the file header intact. */
async function corruptSecondPage({ databasePath }: DatabaseFile): Promise<void> {
  const handle = await open(databasePath, "r+");
  try {
    const header = Buffer.alloc(2);
    await handle.read(header, 0, 2, 16);
    const encoded = header.readUInt16BE(0);
    const pageSize = encoded === 1 ? 65_536 : encoded;
    await handle.write(Buffer.alloc(16, 0xff), 0, 16, pageSize + 8);
  } finally {
    await handle.close();
  }
}

export const stagedCopyFaults = [
  {
    name: "a deleted canonical event",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedCanonical },
        "DELETE FROM canonical_events WHERE rowid = (SELECT MIN(rowid) FROM canonical_events)",
      ),
  },
  {
    name: "a dropped schema-3 table",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedCanonical },
        "DROP TABLE repository_bindings",
      ),
  },
  {
    name: "a changed runtime head",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedRuntime },
        "UPDATE slopstop_runtime_schema_metadata SET last_migration_id = 'another-head'",
      ),
  },
  {
    name: "a changed canonical storage identity",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedCanonical },
        `UPDATE storage_identity SET storage_id = '${otherId}'`,
      ),
  },
  {
    name: "a changed canonical event value",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedCanonical },
        `UPDATE canonical_events SET payload_json = '{"note":"changed"}'
          WHERE rowid = (SELECT MIN(rowid) FROM canonical_events)`,
      ),
  },
  {
    name: "an orphan workspace row",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedCanonical },
        `INSERT INTO project_workspaces (project_id, workspace_id, binding_id, created_at)
          SELECT project_id, '${otherId}', '${otherId}', created_at FROM project_state`,
      ),
  },
  {
    name: "a changed runtime lineage",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedRuntime },
        `UPDATE slopstop_runtime_storage_identity SET runtime_database_lineage_id = '${otherId}'`,
      ),
  },
  {
    name: "a changed canonical head",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).stagedCanonical },
        "UPDATE schema_metadata SET last_migration_id = '0001_canonical_project_writer'",
      ),
  },
  {
    name: "a corrupted canonical page",
    apply: (root: string) =>
      corruptSecondPage({ databasePath: upgradePaths({ root }).stagedCanonical }),
  },
] as const;

/** Starts a fresh application database authority over the root, as the next launch would. */
export async function restartApplicationAuthority({ root }: Readonly<{ root: string }>) {
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot: checkedInMigrationRoot,
  });
  try {
    return await authority.ensureCurrent({ createIfMissing: false });
  } catch (error) {
    return Reflect.get(error as object, "failure");
  } finally {
    await authority.stop();
  }
}

export function expectNoCorruptRegistry(outcome: unknown): void {
  expect(outcome).toBe("current");
}

export async function zeroFile({ databasePath }: DatabaseFile): Promise<void> {
  await writeFile(databasePath, Buffer.alloc(4096));
}

export const backupFaults = [
  {
    name: "a zeroed canonical backup",
    apply: (root: string) => zeroFile({ databasePath: upgradePaths({ root }).backupCanonical }),
  },
  {
    name: "a zeroed runtime backup",
    apply: (root: string) => zeroFile({ databasePath: upgradePaths({ root }).backupRuntime }),
  },
  {
    name: "a corrupted canonical backup page",
    apply: (root: string) =>
      corruptSecondPage({ databasePath: upgradePaths({ root }).backupCanonical }),
  },
  {
    name: "a backup with another identity",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).backupCanonical },
        `UPDATE storage_identity SET storage_id = '${otherId}',
          canonical_database_lineage_id = '${otherId}'`,
      ),
  },
  {
    name: "a backup without its identity table",
    apply: (root: string) =>
      mutateDatabase(
        { databasePath: upgradePaths({ root }).backupCanonical },
        "DROP TABLE storage_identity",
      ),
  },
] as const;

/** Holds an exclusive SQLite lock on a database from another connection until released. */
export function holdExclusiveLock({ databasePath }: DatabaseFile) {
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA locking_mode = EXCLUSIVE");
  database.exec("BEGIN EXCLUSIVE");
  return {
    release: () => {
      database.exec("ROLLBACK");
      database.close();
    },
  };
}
