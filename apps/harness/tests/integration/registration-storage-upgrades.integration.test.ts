import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, ProjectStorageCreateRequestSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  generationPaths,
  openRequest,
  recoveryRequiredHealth,
} from "./project-storage-open-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  projectStorageIntegrationTimeout,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import { restartApplicationAuthority, stagedCopyFaults } from "./project-storage-upgrade-faults.js";
import {
  createGenerationTwoProject,
  createUpgradedProject,
} from "./project-storage-upgrade-fixture.js";

type ProjectRoot = Readonly<{ root: string }>;

const unknownId = "00000000-0000-4000-8000-0000000000e3";
const registryCorrupt = { status: "broken", code: "REGISTRY_CORRUPT" } as const;

/** Leaves the state of a staged copy that failed verification: the marker stays in progress. */
async function createFailedUpgradeProject({ root }: ProjectRoot): Promise<void> {
  await createGenerationTwoProject(root);
  const [fault] = stagedCopyFaults;
  const upgrader = createUpgradeStorageOwner(root, {
    onCheckpoint: (checkpoint) => {
      if (checkpoint === "after-staged-migration") fault.apply(root);
    },
  });
  try {
    expect(await upgrader.upgrade(openRequest)).toMatchObject({
      status: "ready",
      result: { status: "failed" },
    });
  } finally {
    await upgrader.owner.stop();
  }
}

function writeRegistry({ root }: ProjectRoot, sql: string): void {
  const database = new DatabaseSync(path.join(root, "application.db"), {
    enableForeignKeyConstraints: false,
  });
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

const secondCompletedUpgrade = `INSERT INTO storage_upgrades
  SELECT '${unknownId}', storage_id, project_id, location_id, '${unknownId}',
    target_generation_id, source_canonical_lineage_id, source_runtime_lineage_id,
    '${unknownId}', source_create_request_fingerprint, source_created_at,
    source_activated_at, 'completed', started_at, completed_at
  FROM storage_upgrades`;

const corruptRegistryCases = [
  {
    name: "completed target unknown",
    seed: createUpgradedProject,
    sql: `UPDATE storage_upgrades SET target_generation_id = '${unknownId}'`,
  },
  {
    name: "source row re-inserted as staging",
    seed: createUpgradedProject,
    sql: `INSERT INTO storage_generations
      SELECT storage_id, source_generation_id, project_id, location_id,
        source_canonical_lineage_id, source_runtime_lineage_id, source_create_request_id,
        source_create_request_fingerprint, source_generation_id, 'staging', source_created_at, NULL
      FROM storage_upgrades`,
  },
  {
    name: "second completed upgrade",
    seed: createUpgradedProject,
    sql: secondCompletedUpgrade,
  },
  {
    name: "in-progress target unknown",
    seed: createFailedUpgradeProject,
    sql: `UPDATE storage_upgrades SET target_generation_id = '${unknownId}'`,
  },
  {
    name: "in-progress source not active",
    seed: createFailedUpgradeProject,
    sql: `UPDATE storage_upgrades SET source_generation_id = '${unknownId}'`,
  },
] as const;

async function activationOf({ root }: ProjectRoot) {
  const fixture = createUpgradeStorageOwner(root);
  try {
    const activation = await fixture.owner.acquireActivation(openRequest);
    if (activation.status === "ready") await activation.session.close();
    return activation;
  } finally {
    await fixture.owner.stop();
  }
}

async function replayCreate({ root }: ProjectRoot, request = createRequest) {
  const fixture = createUpgradeStorageOwner(root);
  try {
    return await fixture.owner.create(request);
  } finally {
    await fixture.owner.stop();
  }
}

async function expectReplayAndConflict({ root }: ProjectRoot): Promise<void> {
  expect.soft(await replayCreate({ root })).toEqual({
    status: "ready",
    result: {
      status: "created",
      request: createRequest,
      mode: "read-write",
      identity: expect.objectContaining({ generationId: upgradeIds.targetGenerationId }),
    },
  });
  const conflicting = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: unknownId,
    createRequestId: createRequest.createRequestId,
  });
  expect.soft(await replayCreate({ root }, conflicting)).toMatchObject({
    status: "ready",
    result: {
      status: "blocked",
      diagnostic: { code: "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT" },
    },
  });
  expect.soft(await restartApplicationAuthority({ root })).toBe("current");
}

async function expectBrokenAuthority({ root }: ProjectRoot): Promise<void> {
  writeRegistry(
    { root },
    "UPDATE storage_upgrades SET source_created_at = '2026-08-31T12:00:09.000Z'",
  );
  expect.soft(await activationOf({ root }), "changed source createdAt").toMatchObject({
    status: "broken",
  });
  expect.soft(await replayCreate({ root }), "replay after changed createdAt").toMatchObject({
    status: "broken",
  });
  const conflicting = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: unknownId,
    createRequestId: createRequest.createRequestId,
  });
  expect
    .soft(await replayCreate({ root }, conflicting), "conflict after changed createdAt")
    .toEqual({ status: "broken", message: "Active create request authority is inconsistent." });
}

async function expectRecoveryRequired({ root }: ProjectRoot, name: string): Promise<void> {
  expect.soft(await activationOf({ root }), name).toMatchObject({
    status: "ready",
    session: {
      mode: "safe-mode",
      result: { canonicalHealth: recoveryRequiredHealth, runtimeHealth: recoveryRequiredHealth },
    },
  });
}

const title = "replays, validates the registry and bounds directories after an upgrade";
const timeout = { timeout: projectStorageIntegrationTimeout };

it(`${title}: create replay and idempotency`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createUpgradedProject({ root });
  await expectReplayAndConflict({ root });
});

it.for(corruptRegistryCases)(
  `${title}: registry corrupt when $name`,
  timeout,
  async (corruptCase) => {
    const root = await createTemporaryApplicationRoot();
    await corruptCase.seed({ root });
    writeRegistry({ root }, corruptCase.sql);
    expect(await restartApplicationAuthority({ root })).toEqual(registryCorrupt);
  },
);

it(`${title}: createdAt and upgrade authority`, timeout, async () => {
  const createdAtRoot = await createTemporaryApplicationRoot();
  await createUpgradedProject({ root: createdAtRoot });
  await expectBrokenAuthority({ root: createdAtRoot });

  const secondRoot = await createTemporaryApplicationRoot();
  await createUpgradedProject({ root: secondRoot });
  writeRegistry({ root: secondRoot }, secondCompletedUpgrade);
  expect.soft(await activationOf({ root: secondRoot }), "second completed").toMatchObject({
    status: "broken",
  });
});

it(`${title}: exact generation directories`, timeout, async () => {
  const extraRoot = await createTemporaryApplicationRoot();
  await createUpgradedProject({ root: extraRoot });
  await mkdir(path.join(generationPaths(extraRoot).project, unknownId));
  await expectRecoveryRequired({ root: extraRoot }, "extra generation directory");

  const missingRoot = await createTemporaryApplicationRoot();
  await createUpgradedProject({ root: missingRoot });
  await rm(generationPaths(missingRoot).generation, { recursive: true });
  await expectRecoveryRequired({ root: missingRoot }, "retained source directory removed");
});

function registryState({ root }: ProjectRoot) {
  const database = new DatabaseSync(path.join(root, "application.db"), { readOnly: true });
  try {
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => String(row["name"]));
    return Object.fromEntries(
      tables.map((table) => [table, database.prepare(`SELECT * FROM ${table}`).all()]),
    );
  } finally {
    database.close();
  }
}

it(
  "upgrades an exact 0006 registry with a created Project to 0007",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const creator = createUpgradeStorageOwner(root);
    try {
      expect(await creator.owner.create(createRequest)).toMatchObject({
        status: "ready",
        result: { status: "created" },
      });
    } finally {
      await creator.owner.stop();
    }
    writeRegistry(
      { root },
      `DROP TABLE storage_upgrades;
        UPDATE schema_metadata SET last_migration_id = '0006_registration_list_visibility'`,
    );
    const { schema_metadata: _head, ...before } = registryState({ root });

    expect(await restartApplicationAuthority({ root })).toBe("current");
    const {
      schema_metadata: head,
      storage_upgrades: upgrades,
      ...after
    } = registryState({
      root,
    });
    expect(head).toEqual([expect.objectContaining({ last_migration_id: "0007_storage_upgrades" })]);
    expect(upgrades).toEqual([]);
    expect(after).toEqual(before);
    expect(await activationOf({ root })).toMatchObject({
      status: "ready",
      session: { mode: "read-write" },
    });
  },
  projectStorageIntegrationTimeout,
);
