import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, ProjectIdSchema, StorageGenerationIdSchema } from "@slopstop/protocol";
import { afterEach, expect, it } from "vitest";
import {
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "../../src/storage/project-storage-errors.js";
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

const sourceId = decodeStrict(StorageGenerationIdSchema, "00000000-0000-4000-8000-000000000014");
// Hex letters in the target let its letter case vary.
const targetId = decodeStrict(StorageGenerationIdSchema, "00000000-0000-4000-8000-0000000000fa");
const projectIdentity = decodeStrict(ProjectIdSchema, projectId);
const otherId = "00000000-0000-4000-8000-0000000000c2";
const invalidOutput = new ProjectStorageBrokenError("Project Storage upgrade output is invalid.");

/** Every entry beneath a directory with its kind and file digest, never following links. */
async function entriesOf({ directory }: Readonly<{ directory: string }>) {
  const entries: Record<string, string> = {};
  const visit = async (current: string): Promise<void> => {
    for (const name of (await readdir(current)).sort()) {
      const entryPath = path.join(current, name);
      const relative = path.relative(directory, entryPath).split(path.sep).join("/");
      const entry = await lstat(entryPath);
      if (entry.isSymbolicLink()) entries[relative] = "link";
      else if (entry.isDirectory()) {
        entries[relative] = "directory";
        await visit(entryPath);
      } else
        entries[relative] = createHash("sha256")
          .update(await readFile(entryPath))
          .digest("hex");
    }
  };
  await visit(directory);
  return entries;
}

async function seedFile({ filePath }: Readonly<{ filePath: string }>): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `content of ${path.basename(path.dirname(filePath))}`);
}

/** A Project root with the output of T and siblings that must survive its removal. */
async function upgradeOutputInstallation() {
  const { applicationStorageRoot, projectRoot, files } = await installation();
  for (const relative of [
    `${sourceId}/slopstop.db`,
    `${otherId}/slopstop.db`,
    `.staging-${otherId}/slopstop.db`,
    `snapshots/${uuid}/manifest.json`,
    `${targetId}/slopstop.db`,
    `.staging-${targetId}/slopstop.db`,
  ]) {
    await seedFile({ filePath: path.join(projectRoot, relative) });
  }
  const output = {
    projectId: projectIdentity,
    targetGenerationId: targetId,
    activeGenerationId: sourceId,
    retainedGenerationIds: [sourceId],
  };
  return { applicationStorageRoot, projectRoot, files, output };
}

function withoutTarget(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([relative]) =>
        !relative.startsWith(targetId) && !relative.startsWith(`.staging-${targetId}`),
    ),
  );
}

async function replaceWithJunction({ linkPath }: Readonly<{ linkPath: string }>) {
  const target = await temporaryDirectory();
  await writeFile(path.join(target, "outside.txt"), "outside");
  await rm(linkPath, { recursive: true, force: true });
  await symlink(target, linkPath, "junction");
  return target;
}

async function expectRefused(
  attempt: Promise<void>,
  input: Readonly<{ name: string; projectRoot: string; before: Record<string, string> }>,
): Promise<void> {
  await expect.soft(attempt, input.name).rejects.toBeInstanceOf(ProjectStorageBrokenError);
  await expect.soft(attempt, input.name).rejects.toThrow(invalidOutput);
  expect.soft(await entriesOf({ directory: input.projectRoot }), input.name).toEqual(input.before);
}

it("removes only proven upgrade output: adapter", async () => {
  const removed = await upgradeOutputInstallation();
  const before = await entriesOf({ directory: removed.projectRoot });
  await removed.files.removeUpgradeOutput(removed.output);
  expect(await entriesOf({ directory: removed.projectRoot })).toEqual(withoutTarget(before));

  const active = await upgradeOutputInstallation();
  const activeBefore = await entriesOf({ directory: active.projectRoot });
  await expectRefused(
    active.files.removeUpgradeOutput({ ...active.output, activeGenerationId: targetId }),
    { name: "active target", projectRoot: active.projectRoot, before: activeBefore },
  );

  for (const name of [`.staging-${targetId}`, targetId]) {
    const linked = await upgradeOutputInstallation();
    const outside = await replaceWithJunction({ linkPath: path.join(linked.projectRoot, name) });
    const linkedBefore = await entriesOf({ directory: linked.projectRoot });
    await expectRefused(linked.files.removeUpgradeOutput(linked.output), {
      name: `junction at ${name}`,
      projectRoot: linked.projectRoot,
      before: linkedBefore,
    });
    expect.soft(await entriesOf({ directory: outside })).toEqual({
      "outside.txt": createHash("sha256").update("outside").digest("hex"),
    });
  }

  const plain = await upgradeOutputInstallation();
  await rm(path.join(plain.projectRoot, targetId), { recursive: true });
  await writeFile(path.join(plain.projectRoot, targetId), "not a directory");
  const plainBefore = await entriesOf({ directory: plain.projectRoot });
  await expectRefused(plain.files.removeUpgradeOutput(plain.output), {
    name: "plain file at the target",
    projectRoot: plain.projectRoot,
    before: plainBefore,
  });

  const missing = await upgradeOutputInstallation();
  const missingBefore = await entriesOf({ directory: missing.projectRoot });
  await expectRefused(
    missing.files.removeUpgradeOutput({
      ...missing.output,
      projectId: decodeStrict(ProjectIdSchema, uuid),
    }),
    {
      name: "missing Project root",
      projectRoot: missing.projectRoot,
      before: missingBefore,
    },
  );
  await expect
    .soft(pathExists(path.join(missing.applicationStorageRoot, "projects", uuid)))
    .resolves.toBe(false);

  const linkedRoot = await upgradeOutputInstallation();
  const realRoot = `${linkedRoot.projectRoot}-real`;
  await rename(linkedRoot.projectRoot, realRoot);
  await symlink(realRoot, linkedRoot.projectRoot, "junction");
  const linkedRootBefore = await entriesOf({ directory: realRoot });
  await expectRefused(linkedRoot.files.removeUpgradeOutput(linkedRoot.output), {
    name: "Project root junction",
    projectRoot: realRoot,
    before: linkedRootBefore,
  });
});

it("removes only proven upgrade output: adapter, retained or case-variant target", async () => {
  const retained = await upgradeOutputInstallation();
  const retainedBefore = await entriesOf({ directory: retained.projectRoot });
  await expectRefused(
    retained.files.removeUpgradeOutput({
      ...retained.output,
      retainedGenerationIds: [sourceId, targetId],
    }),
    { name: "retained target", projectRoot: retained.projectRoot, before: retainedBefore },
  );

  const variants = [
    [targetId, targetId.toUpperCase()],
    [`.staging-${targetId}`, `.staging-${targetId.toUpperCase()}`],
    [`.staging-${targetId}`, `.Staging-${targetId}`],
  ] as const;
  for (const [exact, variantName] of variants) {
    const variant = await upgradeOutputInstallation();
    await rename(
      path.join(variant.projectRoot, exact),
      path.join(variant.projectRoot, variantName),
    );
    const variantBefore = await entriesOf({ directory: variant.projectRoot });
    await expectRefused(variant.files.removeUpgradeOutput(variant.output), {
      name: `case-variant name ${variantName}`,
      projectRoot: variant.projectRoot,
      before: variantBefore,
    });
  }
});

it("removes only proven upgrade output: adapter, held handle", async () => {
  const held = await upgradeOutputInstallation();
  const handle = new DatabaseSync(path.join(held.projectRoot, targetId, "slopstop.db"));
  try {
    const attempt = held.files.removeUpgradeOutput(held.output);
    await expect(attempt).rejects.toBeInstanceOf(ProjectStorageUnavailableError);
    await expect(attempt).rejects.toThrow("Project Storage is busy; the upgrade can be retried.");
  } finally {
    handle.close();
  }
});
