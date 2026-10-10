import { createHash } from "node:crypto";
import { cp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CanonicalDatabaseLineageIdSchema,
  decodeStrict,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { projectStorageCreateRequestFingerprintInput } from "../../src/storage/project-storage-create-request.js";
import {
  generationPaths,
  migrationRequiredHealth,
  openRequest,
  recoveryRequiredHealth,
} from "./project-storage-open-fixture.js";
import {
  chainedUpgradeTimes,
  createRequest,
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  fixedCreationIds,
  fourthUpgradeIds,
  pathExists,
  projectStorageIntegrationTimeout,
  retryUpgradeIds,
  thirdUpgradeIds,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import { restartApplicationAuthority } from "./project-storage-upgrade-faults.js";
import {
  createChainedProject,
  createThreeLinkChainProject,
  createUpgradedOnceProject,
  orderedRows,
  rewindToGenerationThree,
} from "./project-storage-upgrade-fixture.js";
import {
  entriesOf,
  expectReadWriteOn,
  stopDuringUpgrade,
} from "./project-storage-upgrade-recovery-fixture.js";
import { captureStorageRoot, serializeStorageRootCapture } from "./storage-root-capture.js";

const capturePath = path.resolve(
  import.meta.dirname,
  "../fixtures/c1-0-upgrade-capture/capture.jsonl",
);

it(
  "reproduces a real C1-0 upgrade",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createUpgradedOnceProject({ root });
    expect(serializeStorageRootCapture(await captureStorageRoot(root))).toBe(
      await readFile(capturePath, "utf8"),
    );
  },
  projectStorageIntegrationTimeout * 2,
);

/** The second link of a chain reuses the fixture's attempt-2 ids, at later instants. */
const secondUpgradeIds = retryUpgradeIds;

function chainedUpgrader(root: string) {
  return createUpgradeStorageOwner(root, { attempt: 2, times: chainedUpgradeTimes });
}

function completedUpgradeLinks(root: string) {
  return orderedRows({
    databasePath: generationPaths(root).application,
    table: "storage_upgrades",
  }).map((row) => {
    const { source_generation_id, target_generation_id, state } = row as Record<string, string>;
    return { source_generation_id, target_generation_id, state };
  });
}

it(
  "upgrades a Project that was already upgraded",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createUpgradedOnceProject({ root });
    const fixture = chainedUpgrader(root);
    try {
      expect(await fixture.upgrade(openRequest)).toEqual({
        status: "ready",
        result: {
          status: "upgraded",
          request: openRequest,
          sourceGenerationId: upgradeIds.targetGenerationId,
          generationId: secondUpgradeIds.targetGenerationId,
          upgradeId: secondUpgradeIds.upgradeId,
        },
      });
      await expectReadWriteOn(fixture.owner, secondUpgradeIds.targetGenerationId);
    } finally {
      await fixture.owner.stop();
    }
    const project = generationPaths(root).project;
    const generations = [
      upgradeIds.sourceGenerationId,
      upgradeIds.targetGenerationId,
      secondUpgradeIds.targetGenerationId,
    ];
    expect(
      generations.map((generation) =>
        orderedRows({
          databasePath: path.join(project, generation, "slopstop.db"),
          table: "schema_metadata",
        }).map((row) => (row as Record<string, unknown>)["schema_version"]),
      ),
    ).toEqual([[2], [3], [4]]);
    for (const upgrade of [upgradeIds.upgradeId, secondUpgradeIds.upgradeId]) {
      await expect(
        pathExists(path.join(project, "snapshots", upgrade, "manifest.json")),
      ).resolves.toBe(true);
    }
    expect(completedUpgradeLinks(root)).toEqual([
      {
        source_generation_id: upgradeIds.sourceGenerationId,
        target_generation_id: upgradeIds.targetGenerationId,
        state: "completed",
      },
      {
        source_generation_id: upgradeIds.targetGenerationId,
        target_generation_id: secondUpgradeIds.targetGenerationId,
        state: "completed",
      },
    ]);

    const reopened = createUpgradeStorageOwner(root);
    try {
      await expectReadWriteOn(reopened.owner, secondUpgradeIds.targetGenerationId);
      expect(await reopened.owner.create(createRequest)).toMatchObject({
        status: "ready",
        result: {
          status: "created",
          identity: {
            storageId: fixedCreationIds.storageId,
            generationId: secondUpgradeIds.targetGenerationId,
          },
        },
      });
    } finally {
      await reopened.owner.stop();
    }
  },
  projectStorageIntegrationTimeout * 3,
);

function writeRegistry(root: string, sql: string): void {
  const database = new DatabaseSync(generationPaths(root).application, {
    enableForeignKeyConstraints: false,
  });
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

const strayId = "00000000-0000-4000-8000-0000000000e7";
const otherStrayId = "00000000-0000-4000-8000-0000000000e8";
const secondLink = `upgrade_id = '${secondUpgradeIds.upgradeId}'`;

/** A completed row copied from the second link, re-identified, with its source replaced. */
function copiedLink(input: { upgradeId: string; source: string; target: string }): string {
  return `INSERT INTO storage_upgrades
    SELECT '${input.upgradeId}', storage_id, project_id, location_id, ${input.source},
      ${input.target}, source_canonical_lineage_id, source_runtime_lineage_id,
      '${input.upgradeId}', source_create_request_fingerprint, source_created_at,
      source_activated_at, 'completed', started_at, completed_at
    FROM storage_upgrades WHERE ${secondLink}`;
}

const brokenChainCases = [
  {
    name: "a source that is not the previous target",
    opening: { status: "broken" },
    sql: `UPDATE storage_upgrades SET source_generation_id = '${strayId}' WHERE ${secondLink}`,
  },
  {
    name: "two rows targeting the active generation",
    opening: { status: "broken" },
    sql: copiedLink({
      upgradeId: strayId,
      source: `'${otherStrayId}'`,
      target: "target_generation_id",
    }),
  },
  {
    name: "a source still in storage_generations",
    // A staging row is the opening's recovery case: safe mode, never read-write.
    opening: {
      status: "ready",
      session: {
        mode: "safe-mode",
        result: { canonicalHealth: recoveryRequiredHealth, runtimeHealth: recoveryRequiredHealth },
      },
    },
    sql: `INSERT INTO storage_generations
      SELECT storage_id, source_generation_id, project_id, location_id,
        source_canonical_lineage_id, source_runtime_lineage_id, source_create_request_id,
        source_create_request_fingerprint, source_generation_id, 'staging', source_created_at, NULL
      FROM storage_upgrades WHERE upgrade_id = '${upgradeIds.upgradeId}'`,
  },
  {
    name: "a detached cycle beside the chain",
    opening: { status: "broken" },
    sql: `${copiedLink({ upgradeId: strayId, source: `'${strayId}'`, target: `'${otherStrayId}'` })};
      ${copiedLink({ upgradeId: otherStrayId, source: `'${otherStrayId}'`, target: `'${strayId}'` })}`,
  },
  {
    name: "a last link whose target is not the active generation",
    opening: { status: "broken" },
    sql: `UPDATE storage_upgrades SET target_generation_id = '${strayId}' WHERE ${secondLink}`,
  },
  {
    name: "a three-row chain with a gap",
    opening: { status: "broken" },
    sql: `${copiedLink({ upgradeId: strayId, source: `'${otherStrayId}'`, target: `'${strayId}'` })};
      UPDATE storage_upgrades SET source_generation_id = '${strayId}' WHERE ${secondLink}`,
  },
] as const;

it.for(brokenChainCases)(
  "refuses a broken upgrade chain: $name",
  { timeout: projectStorageIntegrationTimeout * 3 },
  async (brokenCase) => {
    const root = await createTemporaryApplicationRoot();
    await createChainedProject({ root });
    writeRegistry(root, brokenCase.sql);
    expect(await restartApplicationAuthority({ root })).toEqual({
      status: "broken",
      code: "REGISTRY_CORRUPT",
    });
    const fixture = createUpgradeStorageOwner(root);
    try {
      expect(await fixture.owner.acquireActivation(openRequest)).toMatchObject(brokenCase.opening);
    } finally {
      await fixture.owner.stop();
    }
  },
);

const unorderedTimeCases = [
  { clock: "equal", startedAt: "2026-10-05T10:00:00.000Z" },
  { clock: "backward", startedAt: "2026-10-01T10:00:00.000Z" },
] as const;

it.for(unorderedTimeCases)(
  "orders a chain by its links only: a $clock clock",
  { timeout: projectStorageIntegrationTimeout * 3 },
  async ({ startedAt }) => {
    const root = await createTemporaryApplicationRoot();
    await createChainedProject({ root });
    writeRegistry(
      root,
      `UPDATE storage_upgrades SET started_at = '${startedAt}' WHERE ${secondLink}`,
    );
    expect(await restartApplicationAuthority({ root })).toBe("current");
    const fixture = createUpgradeStorageOwner(root);
    try {
      await expectReadWriteOn(fixture.owner, secondUpgradeIds.targetGenerationId);
    } finally {
      await fixture.owner.stop();
    }
  },
);

/** What a discarded upgrade on a chain must leave untouched. */
async function chainKeepsakes(
  root: string,
  chain: Readonly<{ sourceGenerationIds: readonly string[]; upgradeIds: readonly string[] }>,
) {
  const project = generationPaths(root).project;
  return {
    upgrades: orderedRows({
      databasePath: generationPaths(root).application,
      table: "storage_upgrades",
    }),
    sources: await Promise.all(
      chain.sourceGenerationIds.map((id) => entriesOf({ directory: path.join(project, id) })),
    ),
    backups: await Promise.all(
      chain.upgradeIds.map((id) => entriesOf({ directory: path.join(project, "snapshots", id) })),
    ),
  };
}

const onceChain = {
  sourceGenerationIds: [upgradeIds.sourceGenerationId],
  upgradeIds: [upgradeIds.upgradeId],
};
const twiceChain = {
  sourceGenerationIds: [upgradeIds.sourceGenerationId, upgradeIds.targetGenerationId],
  upgradeIds: [upgradeIds.upgradeId, secondUpgradeIds.upgradeId],
};

const interruptedEvent = {
  kind: "abandoned",
  event: {
    projectId: openRequest.projectId,
    upgradeId: thirdUpgradeIds.upgradeId,
    reason: "interrupted",
  },
} as const;

it(
  "discards an interrupted upgrade on a chain: upgraded once, then completes the chain",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createUpgradedOnceProject({ root });
    const before = await chainKeepsakes(root, onceChain);
    const stopped = await stopDuringUpgrade(
      { root },
      { ...thirdUpgradeIds, times: chainedUpgradeTimes },
    );
    expect(stopped.outcome).toMatchObject({ status: "unavailable" });
    await stopped.stopping;

    const next = chainedUpgrader(root);
    try {
      const activation = await next.owner.acquireActivation(openRequest);
      expect(activation).toMatchObject({
        status: "ready",
        session: {
          mode: "safe-mode",
          result: {
            identity: { generationId: upgradeIds.targetGenerationId },
            canonicalHealth: migrationRequiredHealth,
            runtimeHealth: { status: "healthy" },
          },
        },
      });
      if (activation.status === "ready") await activation.session.close();
      expect(next.diagnostics).toEqual([interruptedEvent]);
      expect(await chainKeepsakes(root, onceChain)).toEqual(before);

      expect(await next.upgrade(openRequest)).toMatchObject({
        status: "ready",
        result: { status: "upgraded", generationId: secondUpgradeIds.targetGenerationId },
      });
      await expectReadWriteOn(next.owner, secondUpgradeIds.targetGenerationId);
    } finally {
      await next.owner.stop();
    }
    expect(completedUpgradeLinks(root)).toHaveLength(2);
  },
  projectStorageIntegrationTimeout * 3,
);

/**
 * Leaves an in-progress upgrade on a chain, by SQL and file copy: its marker, its staging row
 * and a staged copy of the active generation. No further migration exists to run.
 */
async function seedInterruptedUpgrade(
  root: string,
  input: Readonly<{ active: string; next: typeof thirdUpgradeIds; startedAt: string }>,
): Promise<void> {
  const { active, startedAt } = input;
  const target = input.next.targetGenerationId;
  const upgrade = input.next.upgradeId;
  const fingerprint = createHash("sha256")
    .update(
      projectStorageCreateRequestFingerprintInput({
        projectId: createRequest.projectId,
        createRequestId: upgrade,
      }),
    )
    .digest("hex");
  writeRegistry(
    root,
    `INSERT INTO storage_upgrades
      SELECT '${upgrade}', storage_id, project_id, location_id, generation_id, '${target}',
        canonical_lineage_id, runtime_lineage_id, create_request_id, create_request_fingerprint,
        created_at, activated_at, 'in-progress', '${startedAt}', NULL
      FROM storage_generations WHERE generation_id = '${active}';
    INSERT INTO storage_generations
      SELECT storage_id, '${target}', project_id, location_id, canonical_lineage_id,
        runtime_lineage_id, '${upgrade}', '${fingerprint}', '${target}', 'staging',
        '${startedAt}', NULL
      FROM storage_generations WHERE generation_id = '${active}'`,
  );
  const project = generationPaths(root).project;
  await cp(path.join(project, active), path.join(project, `.staging-${target}`), {
    recursive: true,
  });
}

it(
  "discards an interrupted upgrade on a chain: two completed upgrades retain both sources",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createChainedProject({ root });
    const before = await chainKeepsakes(root, twiceChain);
    await seedInterruptedUpgrade(root, {
      active: secondUpgradeIds.targetGenerationId,
      next: thirdUpgradeIds,
      startedAt: "2026-10-09T11:00:00.000Z",
    });

    const next = chainedUpgrader(root);
    try {
      await expectReadWriteOn(next.owner, secondUpgradeIds.targetGenerationId);
      expect(next.diagnostics).toEqual([interruptedEvent]);
    } finally {
      await next.owner.stop();
    }
    expect(await chainKeepsakes(root, twiceChain)).toEqual(before);
    await expect(
      pathExists(
        path.join(generationPaths(root).project, `.staging-${thirdUpgradeIds.targetGenerationId}`),
      ),
    ).resolves.toBe(false);
    expect(await restartApplicationAuthority({ root })).toBe("current");
  },
  projectStorageIntegrationTimeout * 3,
);

it(
  "accepts a chain of three",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createThreeLinkChainProject({ root });
    expect(completedUpgradeLinks(root)).toEqual(
      [
        [upgradeIds.sourceGenerationId, upgradeIds.targetGenerationId],
        [upgradeIds.targetGenerationId, secondUpgradeIds.targetGenerationId],
        [secondUpgradeIds.targetGenerationId, thirdUpgradeIds.targetGenerationId],
      ].map(([source_generation_id, target_generation_id]) => ({
        source_generation_id,
        target_generation_id,
        state: "completed",
      })),
    );
    expect(await restartApplicationAuthority({ root })).toBe("current");
    const threeChain = {
      sourceGenerationIds: [...twiceChain.sourceGenerationIds, secondUpgradeIds.targetGenerationId],
      upgradeIds: [...twiceChain.upgradeIds, thirdUpgradeIds.upgradeId],
    };
    const before = await chainKeepsakes(root, threeChain);
    await seedInterruptedUpgrade(root, {
      active: thirdUpgradeIds.targetGenerationId,
      next: fourthUpgradeIds,
      startedAt: "2026-10-10T11:00:00.000Z",
    });
    const next = createUpgradeStorageOwner(root);
    try {
      await expectReadWriteOn(next.owner, thirdUpgradeIds.targetGenerationId);
      expect(next.diagnostics).toEqual([
        {
          ...interruptedEvent,
          event: { ...interruptedEvent.event, upgradeId: fourthUpgradeIds.upgradeId },
        },
      ]);
    } finally {
      await next.owner.stop();
    }
    expect(await chainKeepsakes(root, threeChain)).toEqual(before);
    const reopened = createUpgradeStorageOwner(root);
    try {
      await expectReadWriteOn(reopened.owner, thirdUpgradeIds.targetGenerationId);
    } finally {
      await reopened.owner.stop();
    }
  },
  projectStorageIntegrationTimeout * 4,
);

const otherCreateRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: "00000000-0000-4000-8000-0000000000c0",
  createRequestId: "00000000-0000-4000-8000-0000000000c1",
});
const otherOpenRequest = decodeStrict(ProjectStorageOpenRequestSchema, {
  projectId: otherCreateRequest.projectId,
});
const otherIdentity = {
  storageId: decodeStrict(StorageIdSchema, "00000000-0000-4000-8000-0000000000c2"),
  locationId: "00000000-0000-4000-8000-0000000000c3",
  generationId: decodeStrict(StorageGenerationIdSchema, "00000000-0000-4000-8000-0000000000c4"),
  canonicalDatabaseLineageId: decodeStrict(
    CanonicalDatabaseLineageIdSchema,
    "00000000-0000-4000-8000-0000000000c5",
  ),
  runtimeDatabaseLineageId: decodeStrict(
    RuntimeDatabaseLineageIdSchema,
    "00000000-0000-4000-8000-0000000000c6",
  ),
} as const;
const otherUpgradeIds = {
  targetGenerationId: decodeStrict(
    StorageGenerationIdSchema,
    "00000000-0000-4000-8000-0000000000c7",
  ),
  upgradeId: decodeStrict(
    ProjectStorageCreateRequestIdSchema,
    "00000000-0000-4000-8000-0000000000c8",
  ),
} as const;

/** A second Project in the root, created at schema 4, rewound to 3 and upgraded once. */
async function createOtherUpgradedOnceProject(root: string): Promise<void> {
  const options = { identity: otherIdentity, ...otherUpgradeIds };
  const creator = createUpgradeStorageOwner(root, options);
  try {
    expect(await creator.owner.create(otherCreateRequest)).toMatchObject({
      status: "ready",
      result: { status: "created" },
    });
  } finally {
    await creator.owner.stop();
  }
  await rewindToGenerationThree({
    generationDirectory: path.join(
      root,
      "projects",
      otherCreateRequest.projectId,
      otherIdentity.generationId,
    ),
  });
  const upgrader = createUpgradeStorageOwner(root, options);
  try {
    expect(await upgrader.upgrade(otherOpenRequest)).toMatchObject({
      status: "ready",
      result: { status: "upgraded", generationId: otherUpgradeIds.targetGenerationId },
    });
  } finally {
    await upgrader.owner.stop();
  }
}

it(
  "checks each Storage's chain on its own: two upgraded Projects in one root",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createChainedProject({ root });
    await createOtherUpgradedOnceProject(root);
    expect(await restartApplicationAuthority({ root })).toBe("current");
    const fixture = createUpgradeStorageOwner(root);
    try {
      await expectReadWriteOn(fixture.owner, secondUpgradeIds.targetGenerationId);
      await expectReadWriteOn(fixture.owner, otherUpgradeIds.targetGenerationId, otherOpenRequest);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout * 4,
);

const disagreeingDirectoryCases = [
  {
    name: "a missing chain root source directory",
    apply: (project: string) =>
      rm(path.join(project, upgradeIds.sourceGenerationId), { recursive: true }),
  },
  {
    name: "an extra generation directory",
    apply: (project: string) =>
      cp(
        path.join(project, upgradeIds.sourceGenerationId),
        path.join(project, "00000000-0000-4000-8000-0000000000c9"),
        { recursive: true },
      ),
  },
] as const;

it.for(disagreeingDirectoryCases)(
  "opens a chain of two in safe mode when its directories disagree: $name",
  { timeout: projectStorageIntegrationTimeout * 3 },
  async ({ apply }) => {
    const root = await createTemporaryApplicationRoot();
    await createChainedProject({ root });
    await apply(generationPaths(root).project);
    const fixture = createUpgradeStorageOwner(root);
    try {
      const activation = await fixture.owner.acquireActivation(openRequest);
      expect(activation).toMatchObject({
        status: "ready",
        session: {
          mode: "safe-mode",
          result: {
            canonicalHealth: recoveryRequiredHealth,
            runtimeHealth: recoveryRequiredHealth,
          },
        },
      });
      if (activation.status === "ready") await activation.session.close();
    } finally {
      await fixture.owner.stop();
    }
  },
);
