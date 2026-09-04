import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { checkGeneratedMigrations } from "./check-generated-migrations.mjs";

const changedTreeError = /^Generated migrations changed after regeneration\.$/;

it("detects every generated migration tree change", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "slopstop-generated-migrations-"));

  const createMigrationTree = async (name) => {
    const migrationsDirectory = join(temporaryRoot, name);
    await mkdir(join(migrationsDirectory, "meta"), { recursive: true });
    await Promise.all([
      writeFile(join(migrationsDirectory, "0000_initial.sql"), "SELECT 1;\n"),
      writeFile(join(migrationsDirectory, "meta", "_journal.json"), '{"version":"1"}\n'),
    ]);
    return migrationsDirectory;
  };

  try {
    const unchangedDirectory = await createMigrationTree("unchanged");
    await checkGeneratedMigrations({
      migrationsDirectory: unchangedDirectory,
      regenerate: async () => undefined,
    });

    const changes = [
      {
        name: "byte-change",
        regenerate: (directory) => writeFile(join(directory, "0000_initial.sql"), "SELECT 2;\n"),
      },
      {
        name: "file-addition",
        regenerate: (directory) => writeFile(join(directory, "0001_added.sql"), "SELECT 2;\n"),
      },
      {
        name: "file-removal",
        regenerate: (directory) => rm(join(directory, "meta", "_journal.json")),
      },
      {
        name: "file-rename",
        regenerate: (directory) =>
          rename(join(directory, "0000_initial.sql"), join(directory, "0001_renamed.sql")),
      },
    ];

    for (const change of changes) {
      const migrationsDirectory = await createMigrationTree(change.name);
      await expect(
        checkGeneratedMigrations({
          migrationsDirectory,
          regenerate: () => change.regenerate(migrationsDirectory),
        }),
      ).rejects.toThrowError(changedTreeError);
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});
