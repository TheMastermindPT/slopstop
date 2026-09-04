import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const harnessDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productionMigrationsDirectory = join(harnessDirectory, "drizzle");
const changedTreeMessage = "Generated migrations changed after regeneration.";

const hashFile = async (filePath) =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");

const snapshotMigrationTree = async (migrationsDirectory) => {
  const rootStats = await lstat(migrationsDirectory);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error("Generated migrations directory is invalid.");
  }

  const manifest = [];

  const visitDirectory = async (directoryPath, parentSegments) => {
    const names = await readdir(directoryPath);
    names.sort();

    for (const name of names) {
      const segments = [...parentSegments, name];
      const relativePath = segments.join("/");
      const entryPath = join(directoryPath, name);
      const stats = await lstat(entryPath);

      if (stats.isSymbolicLink()) {
        throw new Error("Generated migrations tree contains a symbolic link.");
      }

      if (stats.isDirectory()) {
        manifest.push({ path: relativePath, type: "directory" });
        await visitDirectory(entryPath, segments);
        continue;
      }

      if (!stats.isFile()) {
        throw new Error("Generated migrations tree contains an unsupported entry.");
      }

      manifest.push({
        path: relativePath,
        type: "file",
        sha256: await hashFile(entryPath),
      });
    }
  };

  await visitDirectory(migrationsDirectory, []);
  return manifest;
};

const regenerateProductionMigrations = async () =>
  new Promise((resolveRegeneration, rejectRegeneration) => {
    const packageManagerEntrypoint = process.env["npm_execpath"];
    if (packageManagerEntrypoint === undefined) {
      rejectRegeneration(new Error("pnpm entrypoint is unavailable."));
      return;
    }
    const child = spawn(process.execPath, [packageManagerEntrypoint, "db:generate"], {
      cwd: harnessDirectory,
      stdio: "inherit",
    });

    child.once("error", rejectRegeneration);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolveRegeneration();
        return;
      }

      const outcome = signal === null ? `exit code ${String(code)}` : `signal ${signal}`;
      rejectRegeneration(new Error(`pnpm db:generate failed with ${outcome}.`));
    });
  });

export const checkGeneratedMigrations = async ({
  migrationsDirectory = productionMigrationsDirectory,
  regenerate = regenerateProductionMigrations,
} = {}) => {
  const before = await snapshotMigrationTree(migrationsDirectory);
  await regenerate();
  const after = await snapshotMigrationTree(migrationsDirectory);

  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(changedTreeMessage);
  }
};

const entrypoint = process.argv[1];
if (entrypoint !== undefined && pathToFileURL(resolve(entrypoint)).href === import.meta.url) {
  await checkGeneratedMigrations();
}
