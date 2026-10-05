import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { ProjectStorageBrokenError } from "../../src/storage/project-storage-errors.js";
import {
  createNodeProjectStorageDependencies,
  type DatabaseSpec,
  databaseSpecs,
  loadGeneratedMigrations,
} from "../../src/storage/project-storage-node-adapters.js";
import {
  createMigrationGuardFixture,
  generationOneGuardSpec,
  initialJournalEntry,
  type MigrationGuardFixture,
  validCanonicalMigrationSql,
} from "./migration-guard-fixture.js";
import { createRequest } from "./project-storage-create-request.js";

type MigrationGuardCase = Readonly<{
  name: string;
  expectedMessage: string;
  arrange(fixture: MigrationGuardFixture): Promise<DatabaseSpec>;
}>;

const migrationGuardCases: readonly MigrationGuardCase[] = [
  {
    name: "escaped trusted root",
    expectedMessage: "Generated migration root escaped trusted resources.",
    arrange: async () => {
      const spec = structuredClone(generationOneGuardSpec);
      Reflect.set(spec, "resourceKind", "../escaped");
      return spec;
    },
  },
  {
    name: "missing kind directory",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.kindRoot, { recursive: true });
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-directory kind resource",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.kindRoot, { recursive: true });
      await writeFile(fixture.kindRoot, "not a directory");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink kind directory",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "kind-target");
      await rm(fixture.kindRoot, { recursive: true });
      await mkdir(target);
      await symlink(target, fixture.kindRoot, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing metadata directory",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.metadataRoot, { recursive: true });
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-directory metadata resource",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.metadataRoot, { recursive: true });
      await writeFile(fixture.metadataRoot, "not a directory");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink metadata directory",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "metadata-target");
      await rm(fixture.metadataRoot, { recursive: true });
      await mkdir(target);
      await symlink(target, fixture.metadataRoot, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing journal",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.journalPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-file journal resource",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.journalPath);
      await mkdir(fixture.journalPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink journal resource",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "journal-target");
      await rm(fixture.journalPath);
      await mkdir(target);
      await symlink(target, fixture.journalPath, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "malformed journal",
    expectedMessage: "Generated migration journal is invalid.",
    arrange: async (fixture) => {
      await writeFile(fixture.journalPath, "{not-json");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "invalid journal shape",
    expectedMessage: "Generated migration journal is invalid.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.journalPath,
        JSON.stringify({ version: "7", dialect: "postgresql", entries: [] }),
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-contiguous journal index",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      await fixture.writeJournal([{ ...initialJournalEntry, idx: 1 }]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "decreasing journal time",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      const second = { ...initialJournalEntry, idx: 1, when: 0, tag: "0001_next" };
      await fixture.writeJournal([initialJournalEntry, second]);
      await writeFile(path.join(fixture.kindRoot, "0001_next.sql"), validCanonicalMigrationSql);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "duplicate journal tag",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      await fixture.writeJournal([
        initialJournalEntry,
        { ...initialJournalEntry, idx: 1, when: 2 },
      ]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "empty journal",
    expectedMessage: "Generated migration journal is empty.",
    arrange: async (fixture) => {
      await fixture.writeJournal([]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing journal resource",
    expectedMessage: "Generated migration resources disagree with the journal.",
    arrange: async (fixture) => {
      await rm(fixture.sqlPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "extra journal resource",
    expectedMessage: "Generated migration resources disagree with the journal.",
    arrange: async (fixture) => {
      await writeFile(path.join(fixture.kindRoot, "extra.sql"), validCanonicalMigrationSql);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "wrong SQL resource type",
    expectedMessage: "Generated migration resource type is invalid.",
    arrange: async (fixture) => {
      await rm(fixture.sqlPath);
      await mkdir(fixture.sqlPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink SQL resource",
    expectedMessage: "Generated migration resource type is invalid.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "sql-target");
      await rm(fixture.sqlPath);
      await mkdir(target);
      await symlink(target, fixture.sqlPath, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "empty SQL",
    expectedMessage: "Generated migration SQL is empty.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "SQL without statements",
    expectedMessage: "Generated migration contains no statements.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "--> statement-breakpoint");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "implicit ledger",
    expectedMessage: "Generated migration uses a forbidden implicit ledger.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "CREATE TABLE __drizzle_migrations (id INTEGER);");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "trigger",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE TRIGGER forbidden AFTER INSERT ON storage_identity BEGIN SELECT 1; END;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "view",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE VIEW forbidden AS SELECT 1;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "comment-separated trigger",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE /* authority bypass */ TRIGGER forbidden AFTER INSERT ON storage_identity BEGIN SELECT 1; END;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "comment-separated view",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE /* authority bypass */ VIEW forbidden AS SELECT 1;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "unknown table",
    expectedMessage: "Generated migration creates an unknown table.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE TABLE future_owner (id TEXT);`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "incomplete table authority",
    expectedMessage: "Generated migration table authority is incomplete.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "CREATE TABLE schema_metadata (metadata_key TEXT);");
      return databaseSpecs.canonical;
    },
  },
];

async function captureMigrationGuardFailure(
  fixture: MigrationGuardFixture,
  spec: DatabaseSpec,
): Promise<unknown> {
  try {
    await loadGeneratedMigrations(fixture.root, {
      ...spec,
      schemaVersion: generationOneGuardSpec.schemaVersion,
      tables: generationOneGuardSpec.tables,
    });
    return undefined;
  } catch (error) {
    return error;
  }
}

it.each(migrationGuardCases)(
  "rejects generated migration guard: $name",
  async ({ arrange, expectedMessage }) => {
    const fixture = await createMigrationGuardFixture();
    try {
      const failure = await captureMigrationGuardFailure(fixture, await arrange(fixture));
      expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
      if (!(failure instanceof ProjectStorageBrokenError)) {
        throw new Error("Expected generated migration guard to fail closed.");
      }
      expect(failure.message).toBe(expectedMessage);
      expect(String(failure)).not.toContain(fixture.root);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
);

it.each(["existing", "mutable"] as const)(
  "retains then closes a failing %s application client exactly once",
  async (kind) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-client-"));
    const migrationResourcesRoot = path.resolve(import.meta.dirname, "../../drizzle");
    try {
      if (kind === "existing") {
        const initializer = createNodeProjectStorageDependencies({
          applicationStorageRoot: root,
          migrationResourcesRoot,
          applicationVersion: "0.0.0",
        });
        try {
          await initializer.registry.prepareCreate();
        } finally {
          await initializer.registry.stop();
        }
      }
      const initializationFailure = new Error("application initialization failed");
      let closeCount: (() => number) | undefined;
      const dependencies = createNodeProjectStorageDependencies({
        applicationStorageRoot: root,
        migrationResourcesRoot,
        applicationVersion: "0.0.0",
        initializeApplicationClient: async (client) => {
          const close = vi.spyOn(client, "close");
          closeCount = () => close.mock.calls.length;
          throw initializationFailure;
        },
      });

      try {
        const operation =
          kind === "existing"
            ? dependencies.opening.inspect(createRequest.projectId)
            : dependencies.registry.prepareCreate();
        await expect(operation).rejects.toMatchObject({
          name: "ProjectStorageBrokenError",
          message:
            kind === "existing"
              ? "Project Storage application authority is invalid."
              : "Project Storage application authority cannot be created.",
        });
        const observeCloseCount = closeCount;
        if (observeCloseCount === undefined) {
          throw new Error("Application client close observation is unavailable.");
        }
        expect(observeCloseCount()).toBe(1);
      } finally {
        await dependencies.registry.stop();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
