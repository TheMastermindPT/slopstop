import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readdir,
  readFile as readNodeFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { acceptsStrict, decodeStrict, StorageGenerationIdSchema } from "@slopstop/protocol";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  assertStagingPath,
  lstatIfPresent,
  projectRootPath,
  requirePlainEntry,
  upgradeDirectoryProjectRoot,
  upgradeOutputNames,
} from "./project-storage-filesystem-authority.js";
import { isUnavailableStorageError, normalizeStorageError } from "./project-storage-node-errors.js";
import type { ProjectStorageStoreDependencies, UpgradeOutput } from "./project-storage-store.js";
import { ProjectStorageUpgradeBusyError } from "./project-storage-upgrade.js";

export async function readPlainFile(input: { filePath: string; message: string }): Promise<Buffer> {
  await requirePlainEntry({
    entryPath: input.filePath,
    message: input.message,
    kind: "file",
  });
  try {
    return await readNodeFile(input.filePath);
  } catch (error) {
    normalizeStorageError({ error, message: input.message });
  }
}

export async function sha256File(input: { filePath: string }): Promise<string> {
  return createHash("sha256")
    .update(
      await readPlainFile({
        filePath: input.filePath,
        message: "Project Storage file is unavailable.",
      }),
    )
    .digest("hex");
}

async function requireDirectory(directoryPath: string, message: string): Promise<void> {
  await requirePlainEntry({
    entryPath: directoryPath,
    message,
    kind: "directory",
  });
}

async function createProjectsRoot(input: { projectsRoot: string }): Promise<void> {
  const projectsEntry = await lstatIfPresent({
    targetPath: input.projectsRoot,
  });
  if (projectsEntry === undefined) {
    await mkdir(input.projectsRoot);
  } else if (projectsEntry.isSymbolicLink() || !projectsEntry.isDirectory()) {
    throw new ProjectStorageBrokenError("Project Storage projects root type is invalid.");
  }
  await requireDirectory(input.projectsRoot, "Project Storage projects root type is invalid.");
}

async function createDirectoryExclusive(input: {
  directoryPath: string;
  applicationStorageRoot: string;
}): Promise<void> {
  try {
    const normalizedDirectory = path.resolve(input.directoryPath);
    assertStagingPath({
      directoryPath: normalizedDirectory,
      applicationStorageRoot: input.applicationStorageRoot,
    });
    const projectRoot = path.dirname(normalizedDirectory);
    const projectsRoot = path.dirname(projectRoot);
    await mkdir(input.applicationStorageRoot, { recursive: true });
    await requireDirectory(
      input.applicationStorageRoot,
      "Project Storage application root type is invalid.",
    );
    await createProjectsRoot({ projectsRoot });
    await mkdir(projectRoot);
    await requireDirectory(projectRoot, "Project Storage root type is invalid.");
    await mkdir(normalizedDirectory);
    await requireDirectory(
      normalizedDirectory,
      "Project Storage staging directory type is invalid.",
    );
  } catch (error) {
    normalizeStorageError({
      error,
      message: "Project Storage staging directory creation failed.",
    });
  }
}

async function writeFileExclusive(input: { filePath: string; contents: string }): Promise<void> {
  try {
    await requireDirectory(
      path.dirname(input.filePath),
      "Project Storage file parent is unavailable.",
    );
    if ((await lstatIfPresent({ targetPath: input.filePath })) !== undefined) {
      throw new ProjectStorageBrokenError("Project Storage file already exists.");
    }
    await writeFile(input.filePath, input.contents, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    normalizeStorageError({
      error,
      message: "Project Storage exclusive file write failed.",
    });
  }
}

async function fileSize(input: { filePath: string }): Promise<number> {
  try {
    await requirePlainEntry({
      entryPath: input.filePath,
      message: "Project Storage file is unavailable.",
      kind: "file",
    });
    const entry = await lstat(input.filePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new ProjectStorageBrokenError("Project Storage file type is invalid.");
    }
    return entry.size;
  } catch (error) {
    normalizeStorageError({
      error,
      message: "Project Storage file size inspection failed.",
    });
  }
}

function requireAtomicRenameShape(input: { source: string; destination: string }): void {
  const sourceName = path.basename(input.source);
  const renameAgrees = [
    path.dirname(input.source) === path.dirname(input.destination),
    sourceName.startsWith(".staging-"),
    sourceName.slice(".staging-".length) === path.basename(input.destination),
  ].every(Boolean);
  if (!renameAgrees) {
    throw new ProjectStorageBrokenError("Project Storage rename must stay on one filesystem.");
  }
  decodeStrict(StorageGenerationIdSchema, path.basename(input.destination));
}

async function renameAtomic(input: { source: string; destination: string }): Promise<void> {
  try {
    const source = path.resolve(input.source);
    const destination = path.resolve(input.destination);
    requireAtomicRenameShape({ source, destination });
    await requireDirectory(path.dirname(source), "Project Storage rename parent is unavailable.");
    await requireDirectory(source, "Project Storage rename source is unavailable.");
    if ((await lstatIfPresent({ targetPath: destination })) !== undefined) {
      throw new ProjectStorageBrokenError("Project Storage activation target already exists.");
    }
    await rename(source, destination);
    await requireDirectory(destination, "Project Storage activation target type is invalid.");
  } catch (error) {
    normalizeStorageError({
      error,
      message: "Project Storage atomic rename failed.",
    });
  }
}

const invalidUpgradeDirectory = "Project Storage upgrade directory is invalid.";

async function isPlainDirectory(directoryPath: string): Promise<boolean> {
  const entry = await lstatIfPresent({ targetPath: directoryPath });
  return entry !== undefined && !entry.isSymbolicLink() && entry.isDirectory();
}

/** Creates `snapshots/` once, beneath an existing Project root only. */
async function requireSnapshotsParent(parent: string, projectRoot: string): Promise<void> {
  if (parent === projectRoot || (await isPlainDirectory(parent))) return;
  if ((await lstatIfPresent({ targetPath: parent })) !== undefined) {
    throw new ProjectStorageBrokenError(invalidUpgradeDirectory);
  }
  await mkdir(parent);
}

async function createDirectoryInProject(input: {
  directoryPath: string;
  applicationStorageRoot: string;
}): Promise<void> {
  try {
    const target = path.resolve(input.directoryPath);
    const projectRoot = upgradeDirectoryProjectRoot({
      directoryPath: target,
      applicationStorageRoot: input.applicationStorageRoot,
    });
    const refused = [
      projectRoot === undefined,
      projectRoot !== undefined && !(await isPlainDirectory(projectRoot)),
      (await lstatIfPresent({ targetPath: target })) !== undefined,
    ].some(Boolean);
    if (refused || projectRoot === undefined) {
      throw new ProjectStorageBrokenError(invalidUpgradeDirectory);
    }
    await requireSnapshotsParent(path.dirname(target), projectRoot);
    await mkdir(target);
  } catch (error) {
    normalizeStorageError({ error, message: invalidUpgradeDirectory });
  }
}

const invalidUpgradeOutput = "Project Storage upgrade output is invalid.";

/** The present output directories of T, each a plain directory, or a refusal. */
async function requireUpgradeOutputDirectories(projectRoot: string, output: UpgradeOutput) {
  const valid = [
    output.targetGenerationId !== output.activeGenerationId,
    !output.retainedGenerationIds.includes(output.targetGenerationId),
    acceptsStrict(StorageGenerationIdSchema, output.targetGenerationId),
    await isPlainDirectory(projectRoot),
  ].every(Boolean);
  if (!valid) throw new ProjectStorageBrokenError(invalidUpgradeOutput);
  const spelled = new Set(await readdir(projectRoot));
  const present: string[] = [];
  for (const name of upgradeOutputNames(output.targetGenerationId)) {
    const directory = path.join(projectRoot, name);
    if ((await lstatIfPresent({ targetPath: directory })) === undefined) continue;
    // A case-insensitive file system resolves a case variant to this path; never remove it.
    if (!spelled.has(name) || !(await isPlainDirectory(directory))) {
      throw new ProjectStorageBrokenError(invalidUpgradeOutput);
    }
    present.push(directory);
  }
  return present;
}

/**
 * Removes `.staging-<target>/` then `<target>/` of one Project, and nothing else: every other
 * name, a link or junction, a non-directory or the active generation is refused untouched.
 */
async function removeUpgradeOutput(input: {
  output: UpgradeOutput;
  applicationStorageRoot: string;
}): Promise<void> {
  try {
    const projectRoot = projectRootPath(
      path.resolve(input.applicationStorageRoot),
      input.output.projectId,
    );
    for (const directory of await requireUpgradeOutputDirectories(projectRoot, input.output)) {
      await rm(directory, { recursive: true });
    }
  } catch (error) {
    if (error instanceof ProjectStorageBrokenError) throw error;
    if (isUnavailableStorageError({ error })) {
      throw new ProjectStorageUpgradeBusyError({ cause: error });
    }
    normalizeStorageError({ error, message: invalidUpgradeOutput });
  }
}

export function createProjectStorageFileAdapter(input: {
  applicationStorageRoot: string;
}): ProjectStorageStoreDependencies["files"] {
  return {
    createDirectoryExclusive: (directoryPath) =>
      createDirectoryExclusive({
        directoryPath,
        applicationStorageRoot: input.applicationStorageRoot,
      }),
    removeUpgradeOutput: (output) =>
      removeUpgradeOutput({ output, applicationStorageRoot: input.applicationStorageRoot }),
    createDirectoryInProject: (directoryPath) =>
      createDirectoryInProject({
        directoryPath,
        applicationStorageRoot: input.applicationStorageRoot,
      }),
    writeFileExclusive: (filePath, contents) => writeFileExclusive({ filePath, contents }),
    readFile: async (filePath) =>
      (
        await readPlainFile({
          filePath,
          message: "Project Storage file is unavailable.",
        })
      ).toString("utf8"),
    size: (filePath) => fileSize({ filePath }),
    renameAtomic: (source, destination) => renameAtomic({ source, destination }),
  };
}
