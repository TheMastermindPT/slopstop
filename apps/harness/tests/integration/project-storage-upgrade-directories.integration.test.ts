import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { ProjectStorageBrokenError } from "../../src/storage/project-storage-errors.js";
import { createProjectStorageFileAdapter } from "../../src/storage/project-storage-file-adapter.js";
import { pathExists } from "./project-storage-runtime-fixture.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const uuid = "00000000-0000-4000-8000-0000000000c1";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-upgrade-directories-"));
  roots.push(root);
  return root;
}

async function treeOf(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true });
  return entries.map((entry) => entry.split(path.sep).join("/")).sort();
}

async function installation() {
  const applicationStorageRoot = await temporaryDirectory();
  const projectRoot = path.join(applicationStorageRoot, "projects", projectId);
  await mkdir(projectRoot, { recursive: true });
  const files = createProjectStorageFileAdapter({ applicationStorageRoot });
  return { applicationStorageRoot, projectRoot, files };
}

const invalidDirectory = new ProjectStorageBrokenError(
  "Project Storage upgrade directory is invalid.",
);

it("creates upgrade directories only beneath an existing Project root", async () => {
  const { applicationStorageRoot, projectRoot, files } = await installation();
  await files.createDirectoryInProject(path.join(projectRoot, `.staging-${uuid}`));
  await files.createDirectoryInProject(path.join(projectRoot, "snapshots", uuid));
  expect(await treeOf(projectRoot)).toEqual([`.staging-${uuid}`, "snapshots", `snapshots/${uuid}`]);

  const outside = await temporaryDirectory();
  const missingRoot = path.join(applicationStorageRoot, "projects", uuid);
  const refused = [
    path.join(missingRoot, `.staging-${uuid}`),
    path.join(projectRoot, "backup"),
    path.join(projectRoot, ".staging-x"),
    path.join(projectRoot, "snapshots", "x"),
    path.join(projectRoot, uuid),
    path.join(projectRoot, "snapshots", uuid, uuid),
    path.join(applicationStorageRoot, "projects", `.staging-${uuid}`),
    path.join(outside, `.staging-${uuid}`),
  ];
  const before = await treeOf(applicationStorageRoot);
  for (const target of refused) {
    const attempt = files.createDirectoryInProject(target);
    await expect.soft(attempt, target).rejects.toBeInstanceOf(ProjectStorageBrokenError);
    await expect.soft(attempt, target).rejects.toThrow(invalidDirectory);
  }
  expect.soft(await treeOf(applicationStorageRoot)).toEqual(before);
  expect.soft(await treeOf(outside)).toEqual([]);
  await expect.soft(pathExists(missingRoot)).resolves.toBe(false);

  const existing = path.join(projectRoot, `.staging-${uuid}`);
  await writeFile(path.join(existing, "kept.txt"), "kept");
  const overExisting = files.createDirectoryInProject(existing);
  await expect.soft(overExisting).rejects.toBeInstanceOf(ProjectStorageBrokenError);
  await expect.soft(overExisting).rejects.toThrow(invalidDirectory);
  expect.soft(await treeOf(existing)).toEqual(["kept.txt"]);
});
