import { mkdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, StorageGenerationIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  generationPaths,
  openRequest,
  recoveryRequiredHealth,
} from "./project-storage-open-fixture.js";
import {
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  projectStorageIntegrationTimeout,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import { holdExclusiveLock, upgradePaths } from "./project-storage-upgrade-faults.js";
import {
  createGenerationTwoProject,
  createUpgradedProject,
} from "./project-storage-upgrade-fixture.js";
import {
  abandonedEvent,
  createCurrentProject,
  entriesOf,
  expectDiscardedUpgrade,
  expectMigrationRequiredOnSource,
  registryRows,
  sourceFileHashes,
  stopDuringUpgrade,
} from "./project-storage-upgrade-recovery-fixture.js";

type ProjectRoot = Readonly<{ root: string }>;

it(
  "keeps a registry whose upgrade marker cannot be read broken at opening",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createCurrentProject({ root });
    const database = new DatabaseSync(path.join(root, "application.db"));
    try {
      database.exec("DROP TABLE storage_upgrades; CREATE TABLE storage_upgrades (unreadable)");
    } finally {
      database.close();
    }
    const fixture = createUpgradeStorageOwner(root);
    try {
      const broken = {
        status: "broken",
        message: "Database required column definition is missing.",
      };
      expect(await fixture.owner.acquireActivation(openRequest)).toEqual(broken);
      expect(await fixture.upgrade(openRequest)).toEqual(broken);
      expect(fixture.diagnostics).toEqual([]);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);

it(
  "answers retryable unavailable, changing nothing, when the registry is locked at activation",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    await (await stopDuringUpgrade({ root })).stopping;
    const before = await unprovenSnapshot({ root });
    const fixture = createUpgradeStorageOwner(root);
    const lock = holdExclusiveLock({ databasePath: path.join(root, "application.db") });
    try {
      // The registry authority meets the lock first and answers its own typed unavailable,
      // which the marker lookup passes through unchanged.
      expect(await fixture.owner.acquireActivation(openRequest)).toEqual({
        status: "unavailable",
        message: "Project Storage authority is unavailable.",
      });
      expect(fixture.diagnostics).toEqual([]);
    } finally {
      lock.release();
      await fixture.owner.stop();
    }
    expect(await unprovenSnapshot({ root })).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

const otherUuid = "00000000-0000-4000-8000-0000000000e4";

async function unprovenSnapshot({ root }: ProjectRoot) {
  const application = path.join(root, "application.db");
  const database = new DatabaseSync(application, { readOnly: true });
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row["name"]));
    return {
      files: await entriesOf({ directory: path.join(root, "projects") }),
      registry: Object.fromEntries(
        tables.map((table) => [table, database.prepare(`SELECT * FROM ${table}`).all()]),
      ),
    };
  } finally {
    database.close();
  }
}

function writeRegistry({ root }: ProjectRoot, sql: string): void {
  const database = new DatabaseSync(path.join(root, "application.db"));
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

type UnprovenCase = Readonly<{
  name: string;
  seed: (input: ProjectRoot) => Promise<string | undefined>;
  activation: unknown;
  upgrade: unknown;
}>;

const recoveryRequiredOnSource = {
  status: "ready",
  session: {
    mode: "safe-mode",
    result: {
      identity: { generationId: upgradeIds.sourceGenerationId },
      canonicalHealth: recoveryRequiredHealth,
      runtimeHealth: recoveryRequiredHealth,
    },
  },
};
const notEligible = {
  status: "ready",
  result: { status: "refused", diagnostic: { code: "PROJECT_UPGRADE_NOT_ELIGIBLE" } },
};

const unprovenCases: readonly UnprovenCase[] = [
  {
    name: "an extra file inside the staging output",
    seed: async ({ root }) => {
      await writeFile(path.join(upgradePaths({ root }).staging, "note.txt"), "note");
      return undefined;
    },
    activation: {
      status: "broken",
      message: "Project Storage generation contains an unknown witness.",
    },
    upgrade: {
      status: "broken",
      message: "Project Storage generation contains an unknown witness.",
    },
  },
  {
    name: "an extra generation directory",
    seed: async ({ root }) => {
      await mkdir(path.join(generationPaths(root).project, otherUuid));
      return undefined;
    },
    activation: recoveryRequiredOnSource,
    upgrade: notEligible,
  },
  {
    name: "a target row at another location",
    seed: async ({ root }) => {
      writeRegistry(
        { root },
        `INSERT INTO storage_locations (storage_id, location_id, normalized_path, location_state, observed_at)
          SELECT storage_id, '${otherUuid}', normalized_path || '-elsewhere', 'staging', observed_at
          FROM storage_locations;
        UPDATE storage_generations SET location_id = '${otherUuid}'
          WHERE generation_id = '${upgradeIds.targetGenerationId}'`,
      );
      return undefined;
    },
    activation: recoveryRequiredOnSource,
    upgrade: notEligible,
  },
  {
    name: "a staging junction to another directory",
    seed: async ({ root }) => {
      const outside = await createTemporaryApplicationRoot();
      await writeFile(path.join(outside, "outside.txt"), "outside");
      await rm(upgradePaths({ root }).staging, { recursive: true });
      await symlink(outside, upgradePaths({ root }).staging, "junction");
      return outside;
    },
    activation: {
      status: "broken",
      message: "Project Storage witness must not be a symbolic link.",
    },
    upgrade: { status: "broken", message: "Project Storage witness must not be a symbolic link." },
  },
];

const unprovenEvent = {
  kind: "discardFailed",
  event: { projectId: openRequest.projectId, upgradeId: upgradeIds.upgradeId, cause: "unproven" },
};

it.for(unprovenCases)(
  "keeps unproven upgrade leftovers quarantined: $name",
  { timeout: projectStorageIntegrationTimeout },
  async (unproven) => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const stopped = await stopDuringUpgrade({ root });
    await stopped.stopping;
    const outside = await unproven.seed({ root });
    const outsideBefore =
      outside === undefined ? undefined : await entriesOf({ directory: outside });
    const before = await unprovenSnapshot({ root });
    const fixture = createUpgradeStorageOwner(root, { attempt: 2 });
    try {
      const activation = await fixture.owner.acquireActivation(openRequest);
      expect.soft(activation, "activation").toMatchObject(unproven.activation as object);
      if (activation.status === "ready") await activation.session.close();
      expect.soft(await unprovenSnapshot({ root }), "after activation").toEqual(before);
      expect
        .soft(await fixture.upgrade(openRequest), "upgrade")
        .toMatchObject(unproven.upgrade as object);
      expect.soft(await unprovenSnapshot({ root }), "after upgrade").toEqual(before);
      expect(fixture.diagnostics).toEqual([unprovenEvent, unprovenEvent]);
    } finally {
      await fixture.owner.stop();
    }
    if (outside !== undefined) {
      expect(await entriesOf({ directory: outside })).toEqual(outsideBefore);
    }
  },
);

it(
  "removes only proven upgrade output: owner, held handle",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const sourceHashes = await sourceFileHashes({ root });
    const stopped = await stopDuringUpgrade({ root });
    await stopped.stopping;
    const backup = await entriesOf({ directory: upgradePaths({ root }).backup });
    const busyEvent = {
      kind: "discardFailed",
      event: { projectId: openRequest.projectId, upgradeId: upgradeIds.upgradeId, cause: "busy" },
    };
    const fixture = createUpgradeStorageOwner(root, { attempt: 2 });
    try {
      const handle = new DatabaseSync(path.join(upgradePaths({ root }).staging, "slopstop.db"));
      try {
        expect(await fixture.owner.acquireActivation(openRequest)).toEqual({
          status: "unavailable",
          message: "Project Storage is busy; the upgrade can be retried.",
        });
        expect(fixture.diagnostics).toEqual([busyEvent]);
        expect(registryRows({ root }, "storage_upgrades")).toEqual([
          expect.objectContaining({ state: "in-progress" }),
        ]);
      } finally {
        handle.close();
      }
      await expectMigrationRequiredOnSource(fixture.owner);
      expect(fixture.diagnostics).toEqual([busyEvent, abandonedEvent("interrupted")]);
    } finally {
      await fixture.owner.stop();
    }
    await expectDiscardedUpgrade({ root }, { sourceHashes, backup });
  },
  projectStorageIntegrationTimeout,
);

const rogueUpgradeId = "00000000-0000-4000-8000-0000000000b9";

/** A target id with hex letters, so that its letter case can vary. */
const letteredTarget = decodeStrict(
  StorageGenerationIdSchema,
  "00000000-0000-4000-8000-0000000000fa",
);

const caseVariantNames = [
  { name: "an upper-case target directory", entry: letteredTarget.toUpperCase() },
  { name: "an upper-case staging target", entry: `.staging-${letteredTarget.toUpperCase()}` },
  { name: "a case-variant staging prefix", entry: `.Staging-${letteredTarget}` },
] as const;

it.for(caseVariantNames)(
  "keeps unproven upgrade leftovers quarantined: $name",
  { timeout: projectStorageIntegrationTimeout },
  async (variantCase) => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const stopped = await stopDuringUpgrade({ root }, { targetGenerationId: letteredTarget });
    await stopped.stopping;
    // The staged copy holds only generation files: letter case is the only reason to refuse.
    const project = generationPaths(root).project;
    await rename(
      path.join(project, `.staging-${letteredTarget}`),
      path.join(project, variantCase.entry),
    );
    const before = await unprovenSnapshot({ root });
    const fixture = createUpgradeStorageOwner(root, { attempt: 2 });
    try {
      const activation = await fixture.owner.acquireActivation(openRequest);
      if (activation.status === "ready") await activation.session.close();
      expect(await unprovenSnapshot({ root })).toEqual(before);
      expect(fixture.diagnostics).toEqual([unprovenEvent]);
    } finally {
      await fixture.owner.stop();
    }
  },
);

it(
  "keeps upgrade leftovers quarantined as broken: a target equal to a retained generation",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createUpgradedProject({ root });
    const source = upgradeIds.sourceGenerationId;
    const active = upgradeIds.targetGenerationId;
    writeRegistry(
      { root },
      `INSERT INTO storage_upgrades
        SELECT '${rogueUpgradeId}', storage_id, project_id, location_id, generation_id, '${source}',
          canonical_lineage_id, runtime_lineage_id, create_request_id, create_request_fingerprint,
          created_at, activated_at, 'in-progress', created_at, NULL
        FROM storage_generations WHERE generation_id = '${active}';
      INSERT INTO storage_generations (storage_id, generation_id, project_id, location_id,
          canonical_lineage_id, runtime_lineage_id, create_request_id, create_request_fingerprint,
          generation_directory_name, creation_state, created_at, activated_at)
        SELECT storage_id, '${source}', project_id, location_id, canonical_lineage_id,
          runtime_lineage_id, '${rogueUpgradeId}', create_request_fingerprint, '${source}',
          'staging', created_at, NULL
        FROM storage_generations WHERE generation_id = '${active}'`,
    );
    const retained = await entriesOf({ directory: generationPaths(root).generation });
    const fixture = createUpgradeStorageOwner(root, { attempt: 2 });
    try {
      const activation = await fixture.owner.acquireActivation(openRequest);
      if (activation.status === "ready") await activation.session.close();
      expect(await entriesOf({ directory: generationPaths(root).generation })).toEqual(retained);
      // The rogue target row puts the completed upgrade's source back in `storage_generations`,
      // so the upgrade chain rule refuses the registry before the proof compares directories.
      expect(fixture.diagnostics).toEqual([
        {
          kind: "discardFailed",
          event: { projectId: openRequest.projectId, upgradeId: rogueUpgradeId, cause: "broken" },
        },
      ]);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);
