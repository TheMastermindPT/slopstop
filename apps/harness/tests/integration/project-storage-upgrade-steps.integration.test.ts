import { rename } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, StorageGenerationIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
} from "../../src/storage/project-storage-errors.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import {
  ProjectStorageUpgradeBusyError,
  projectStorageUpgradeBusyMessage,
} from "../../src/storage/project-storage-upgrade.js";
import { generationPaths, openRequest } from "./project-storage-open-fixture.js";
import {
  checkedInMigrationRoot,
  createTemporaryApplicationRoot,
  projectStorageIntegrationTimeout,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import { holdExclusiveLock } from "./project-storage-upgrade-faults.js";
import { createGenerationTwoProject } from "./project-storage-upgrade-fixture.js";
import { registryRows, stopDuringUpgrade } from "./project-storage-upgrade-recovery-fixture.js";

type ProjectRoot = Readonly<{ root: string }>;
type Dependencies = ReturnType<typeof createNodeProjectStorageDependencies>;

const timeout = { timeout: projectStorageIntegrationTimeout };
const otherUuid = (index: number) => `00000000-0000-4000-8000-0000000000e${index}`;

/** A Project whose upgrade stopped after its staged copy, leaving its in-progress marker. */
async function createInterruptedUpgrade({ root }: ProjectRoot): Promise<void> {
  await createGenerationTwoProject(root);
  const stopped = await stopDuringUpgrade({ root });
  await stopped.stopping;
}

/** Changes the registry directly, without its foreign keys, as damage would. */
function damageRegistry({ root }: ProjectRoot, sql: string): void {
  const database = new DatabaseSync(path.join(root, "application.db"), {
    enableForeignKeyConstraints: false,
  });
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

async function withUpgradeSteps(
  { root }: ProjectRoot,
  run: (upgrades: Dependencies["upgrades"]) => Promise<void>,
  initializeApplicationClient?: () => Promise<void>,
): Promise<void> {
  const dependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
    ...(initializeApplicationClient === undefined ? {} : { initializeApplicationClient }),
  });
  try {
    await run(dependencies.upgrades);
  } finally {
    await dependencies.registry.stop();
  }
}

const unreadableMarkers = [
  {
    name: "a marker that does not decode",
    sql: `UPDATE storage_upgrades SET target_generation_id = 'not-a-generation'`,
  },
  {
    name: "two in-progress markers",
    // One in-progress row per storage is indexed; a second storage of the Project is not.
    sql: `CREATE TEMP TABLE copied AS SELECT * FROM storage_upgrades;
      UPDATE copied SET upgrade_id = '${otherUuid(1)}', storage_id = '${otherUuid(2)}',
        source_generation_id = '${otherUuid(3)}', source_create_request_id = '${otherUuid(4)}';
      INSERT INTO storage_upgrades SELECT * FROM copied`,
  },
] as const;

it.for(unreadableMarkers)(
  "finds an unfinished upgrade only from a readable marker: $name",
  timeout,
  async (marker) => {
    const root = await createTemporaryApplicationRoot();
    await createInterruptedUpgrade({ root });
    damageRegistry({ root }, marker.sql);
    await withUpgradeSteps({ root }, async (upgrades) => {
      await expect(upgrades.findUnfinished(openRequest.projectId)).rejects.toThrow(
        new ProjectStorageBrokenError("Project Storage upgrade marker is invalid."),
      );
    });
  },
);

it(
  "finds an unfinished upgrade only from a readable marker: a client initialization failure",
  timeout,
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createInterruptedUpgrade({ root });
    await withUpgradeSteps(
      { root },
      async (upgrades) => {
        await expect(upgrades.findUnfinished(openRequest.projectId)).rejects.toBeInstanceOf(
          ProjectStorageApplicationClientInitializationError,
        );
      },
      async () => {
        throw new Error("Injected initialization failure.");
      },
    );
  },
);

it(
  "finds an unfinished upgrade only from a readable marker: a busy registry answers busy",
  timeout,
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createInterruptedUpgrade({ root });
    await withUpgradeSteps({ root }, async (upgrades) => {
      // The client opens before the lock, so the marker query is what meets the busy registry.
      await upgrades.findUnfinished(openRequest.projectId);
      const lock = holdExclusiveLock({ databasePath: path.join(root, "application.db") });
      try {
        const lookup = upgrades.findUnfinished(openRequest.projectId);
        await expect(lookup).rejects.toBeInstanceOf(ProjectStorageUpgradeBusyError);
        await expect(lookup).rejects.toThrow(projectStorageUpgradeBusyMessage);
      } finally {
        lock.release();
      }
    });
  },
);

it(
  "finds an unfinished upgrade only from a readable marker: an unreadable marker query is broken",
  timeout,
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createInterruptedUpgrade({ root });
    await withUpgradeSteps({ root }, async (upgrades) => {
      // The client opens first; the marker query then meets a table it cannot read.
      await upgrades.findUnfinished(openRequest.projectId);
      damageRegistry({ root }, "ALTER TABLE storage_upgrades RENAME COLUMN upgrade_id TO lost_id");
      await expect(upgrades.findUnfinished(openRequest.projectId)).rejects.toThrow(
        new ProjectStorageBrokenError("Project Storage upgrade marker could not be read."),
      );
    });
  },
);

it("releases an unfinished upgrade only while the registry agrees", timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createInterruptedUpgrade({ root });
  await withUpgradeSteps({ root }, async (upgrades) => {
    const upgrade = await upgrades.findUnfinished(openRequest.projectId);
    expect(upgrade).toMatchObject({ upgradeId: upgradeIds.upgradeId });
    if (upgrade === undefined) return;
    damageRegistry(
      { root },
      `UPDATE storage_registrations
        SET active_generation_id = '${upgradeIds.targetGenerationId}'`,
    );
    const marker = registryRows({ root }, "storage_upgrades");
    const generations = registryRows({ root }, "storage_generations");
    await expect(upgrades.releaseUnfinished(upgrade)).rejects.toThrow(
      new ProjectStorageBrokenError("Project Storage upgrade release does not agree."),
    );
    expect(registryRows({ root }, "storage_upgrades")).toEqual(marker);
    expect(marker).toEqual([expect.objectContaining({ state: "in-progress" })]);
    expect(registryRows({ root }, "storage_generations")).toEqual(generations);
    expect(generations).toContainEqual(
      expect.objectContaining({
        generation_id: upgradeIds.targetGenerationId,
        creation_state: "staging",
      }),
    );
  });
});

it("proves an unfinished upgrade only for its own marker", timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createInterruptedUpgrade({ root });
  const otherTarget = decodeStrict(StorageGenerationIdSchema, otherUuid(5));
  const project = generationPaths(root).project;
  // The output on disk agrees with the passed target, so only the registry can refuse it.
  await rename(
    path.join(project, `.staging-${upgradeIds.targetGenerationId}`),
    path.join(project, `.staging-${otherTarget}`),
  );
  await withUpgradeSteps({ root }, async (upgrades) => {
    const upgrade = await upgrades.findUnfinished(openRequest.projectId);
    expect(upgrade).toMatchObject({ upgradeId: upgradeIds.upgradeId });
    if (upgrade === undefined) return;
    const otherSource = decodeStrict(StorageGenerationIdSchema, otherUuid(6));
    for (const passed of [
      { ...upgrade, targetGenerationId: otherTarget },
      { ...upgrade, sourceGenerationId: otherSource },
    ]) {
      expect.soft(await upgrades.proveUnfinished(passed)).toEqual({ status: "unproven" });
    }
  });
});
