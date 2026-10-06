import { createHash } from "node:crypto";
import { lstat, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import {
  generationPaths,
  migrationRequiredHealth,
  openRequest,
} from "./project-storage-open-fixture.js";
import {
  createRequest,
  createUpgradeStorageOwner,
  pathExists,
  retryUpgradeIds,
  type UpgradeOwnerOptions,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import { restartApplicationAuthority, upgradePaths } from "./project-storage-upgrade-faults.js";
import { orderedRows } from "./project-storage-upgrade-fixture.js";

type ProjectRoot = Readonly<{ root: string }>;
type UpgradeOwner = ReturnType<typeof createUpgradeStorageOwner>;

/** Every entry beneath a directory with its kind and file digest, never following links. */
export async function entriesOf({
  directory,
}: Readonly<{ directory: string }>): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  const visit = async (current: string): Promise<void> => {
    for (const name of (await readdir(current)).sort()) {
      const entryPath = path.join(current, name);
      const relative = path.relative(directory, entryPath).split(path.sep).join("/");
      const entry = await lstat(entryPath);
      if (entry.isSymbolicLink()) {
        entries[relative] = "link";
      } else if (entry.isDirectory()) {
        entries[relative] = "directory";
        await visit(entryPath);
      } else {
        entries[relative] = createHash("sha256")
          .update(await readFile(entryPath))
          .digest("hex");
      }
    }
  };
  await visit(directory);
  return entries;
}

export async function sourceFileHashes({ root }: ProjectRoot): Promise<string[]> {
  const source = generationPaths(root);
  return Promise.all(
    [source.canonical, source.runtime, source.manifest].map(async (file) =>
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ),
  );
}

export function registryRows({ root }: ProjectRoot, table: string): unknown[] {
  return orderedRows({ databasePath: path.join(root, "application.db"), table });
}

/** A directory whose handles are all released can be renamed away and back. */
async function expectReleased(directory: string): Promise<void> {
  const away = `${directory}-released`;
  await rename(directory, away);
  await rename(away, directory);
}

/** What the discarded upgrade must leave: the source's bytes and the backup as it was. */
export type DiscardedExpectation = Readonly<{
  sourceHashes: readonly string[];
  backup: Readonly<Record<string, string>> | undefined;
}>;

/** Opening answers read-only `migration-required` on the source generation. */
export async function expectMigrationRequiredOnSource(owner: UpgradeOwner["owner"]) {
  const activation = await owner.acquireActivation(openRequest);
  expect(activation).toMatchObject({
    status: "ready",
    session: {
      mode: "safe-mode",
      result: {
        identity: { generationId: upgradeIds.sourceGenerationId },
        canonicalHealth: migrationRequiredHealth,
        runtimeHealth: { status: "healthy" },
      },
    },
  });
  if (activation.status === "ready") await activation.session.close();
}

/** The discarded state of attempt 1: no marker, no target row or output, source untouched. */
export async function expectDiscardedUpgrade(
  { root }: ProjectRoot,
  expected: DiscardedExpectation,
): Promise<void> {
  const paths = upgradePaths({ root });
  expect(registryRows({ root }, "storage_upgrades")).toEqual([]);
  expect(registryRows({ root }, "storage_generations")).toEqual([
    expect.objectContaining({
      generation_id: upgradeIds.sourceGenerationId,
      creation_state: "active",
    }),
  ]);
  expect(registryRows({ root }, "storage_registrations")).toEqual([
    expect.objectContaining({ active_generation_id: upgradeIds.sourceGenerationId }),
  ]);
  await expect(sourceFileHashes({ root })).resolves.toEqual(expected.sourceHashes);
  const projectEntries = await readdir(generationPaths(root).project);
  expect(projectEntries.filter((entry) => entry.startsWith(".staging-"))).toEqual([]);
  expect(projectEntries).not.toContain(upgradeIds.targetGenerationId);
  if (expected.backup === undefined) {
    await expect(pathExists(paths.backup)).resolves.toBe(false);
  } else {
    expect(await entriesOf({ directory: paths.backup })).toEqual(expected.backup);
    await expectReleased(paths.backup);
  }
  await expectReleased(generationPaths(root).generation);
  expect(await restartApplicationAuthority({ root })).toBe("current");
}

/** The attempt-1 abandonment event, as the diagnostics port receives it. */
export function abandonedEvent(reason: "failed" | "interrupted") {
  return {
    kind: "abandoned",
    event: { projectId: openRequest.projectId, upgradeId: upgradeIds.upgradeId, reason },
  } as const;
}

/** Stops the owner from inside an upgrade at `after-staged-copy`, leaving it unfinished. */
export async function stopDuringUpgrade(
  { root }: ProjectRoot,
  options: Pick<UpgradeOwnerOptions, "targetGenerationId"> = {},
) {
  let stopping: Promise<void> | undefined;
  const fixture: UpgradeOwner = createUpgradeStorageOwner(root, {
    ...options,
    onCheckpoint: (checkpoint) => {
      if (checkpoint === "after-staged-copy") stopping = fixture.owner.stop();
    },
  });
  const outcome = await fixture.upgrade(openRequest);
  return { outcome, stopping, diagnostics: fixture.diagnostics };
}

/** Opening answers read-write on `generationId`. */
export async function expectReadWriteOn(
  owner: UpgradeOwner["owner"],
  generationId: string,
): Promise<void> {
  const activation = await owner.acquireActivation(openRequest);
  expect(activation).toMatchObject({
    status: "ready",
    session: { mode: "read-write", result: { identity: { generationId } } },
  });
  if (activation.status === "ready") await activation.session.close();
}

/** "Try again": the second attempt upgrades to T2 and opens read-write on it. */
export async function expectRetryUpgrades(fixture: UpgradeOwner): Promise<void> {
  expect(await fixture.upgrade(openRequest)).toMatchObject({
    status: "ready",
    result: {
      status: "upgraded",
      generationId: retryUpgradeIds.targetGenerationId,
      upgradeId: retryUpgradeIds.upgradeId,
    },
  });
  await expectReadWriteOn(fixture.owner, retryUpgradeIds.targetGenerationId);
}

/** A current (schema-3) Project created through the real owner. */
export async function createCurrentProject({ root }: ProjectRoot): Promise<void> {
  const creator = createUpgradeStorageOwner(root);
  try {
    expect(await creator.owner.create(createRequest)).toMatchObject({
      status: "ready",
      result: { status: "created" },
    });
  } finally {
    await creator.owner.stop();
  }
}
