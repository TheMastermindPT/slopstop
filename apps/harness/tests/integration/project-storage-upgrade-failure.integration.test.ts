import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import {
  corruptHealth,
  generationPaths,
  openRequest,
  recoveryRequiredHealth,
} from "./project-storage-open-fixture.js";
import {
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  pathExists,
  projectStorageIntegrationTimeout,
  retryUpgradeIds,
  type UpgradeOwnerOptions,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import {
  backupFaults,
  holdExclusiveLock,
  restartApplicationAuthority,
  stagedCopyFaults,
  upgradePaths,
  zeroFile,
} from "./project-storage-upgrade-faults.js";
import { createGenerationTwoProject, expectReleased } from "./project-storage-upgrade-fixture.js";
import {
  abandonedEvent,
  entriesOf,
  expectDiscardedUpgrade,
  expectMigrationRequiredOnSource,
  expectReadWriteOn,
  expectRetryUpgrades,
  registryRows,
  sourceFileHashes,
} from "./project-storage-upgrade-recovery-fixture.js";

type ProjectRoot = Readonly<{ root: string }>;
type UpgradeOwner = ReturnType<typeof createUpgradeStorageOwner>;
type UpgradeOutcome = Awaited<ReturnType<UpgradeOwner["upgrade"]>>;
type Checkpoint = NonNullable<UpgradeOwnerOptions["failAt"]>;
type BackupEntries = Awaited<ReturnType<typeof backupEntries>>;

const title = "discards a failed upgrade before answering and upgrades on retry";
const timeout = { timeout: projectStorageIntegrationTimeout };
const busy = {
  status: "unavailable",
  reason: "busy",
  message: "Project Storage is busy; the upgrade can be retried.",
} as const;

function failedResult(
  code: "PROJECT_UPGRADE_BACKUP_INVALID" | "PROJECT_UPGRADE_VERIFICATION_FAILED",
  message: string,
) {
  return {
    status: "ready",
    result: { status: "failed", request: openRequest, diagnostic: { code, message } },
  } as const;
}
const backupInvalid = failedResult(
  "PROJECT_UPGRADE_BACKUP_INVALID",
  "The pre-upgrade backup failed its integrity check.",
);
const verificationFailed = failedResult(
  "PROJECT_UPGRADE_VERIFICATION_FAILED",
  "The upgraded copy did not match the original data.",
);

/** One failure row: the attempt-1 options and the exact S1 outcome it answers. */
type FailureRow = Readonly<{
  name: string;
  /** The checkpoint the attempt fails at, after any fault is applied there. */
  failingAt: Checkpoint;
  options: (root: string) => UpgradeOwnerOptions;
  /** The answer, or the injected error message the `upgrade` call rejects with. */
  expected: UpgradeOutcome | Readonly<{ rejects: string }>;
}>;

const injectedCheckpoints = [
  "after-upgrade-declared",
  "after-backup-copied",
  "after-backup-verified",
  "after-staged-copy",
  "after-staged-migration",
  "after-staged-verified",
  "after-generation-rename",
  "before-upgrade-switch",
] as const;

const discardedRows: readonly FailureRow[] = [
  ...injectedCheckpoints.map(
    (checkpoint): FailureRow => ({
      name: `injected failure at ${checkpoint}`,
      failingAt: checkpoint,
      options: () => ({ failAt: checkpoint }),
      expected: { rejects: `Injected failure at ${checkpoint}.` },
    }),
  ),
  {
    name: "failure during the switch",
    failingAt: "during-upgrade-switch",
    options: () => ({ failAt: "during-upgrade-switch" }),
    expected: { status: "broken", message: "Project Storage upgrade switch failed." },
  },
  ...backupFaults.map(
    (fault): FailureRow => ({
      name: `backup fault: ${fault.name}`,
      failingAt: "after-backup-copied",
      options: (root: string) => ({
        onCheckpoint: async (checkpoint: string) => {
          if (checkpoint === "after-backup-copied") await fault.apply(root);
        },
      }),
      expected: backupInvalid,
    }),
  ),
  ...stagedCopyFaults.map(
    (fault): FailureRow => ({
      name: `staged-copy fault: ${fault.name}`,
      failingAt: "after-staged-migration",
      options: (root: string) => ({
        onCheckpoint: async (checkpoint: string) => {
          if (checkpoint === "after-staged-migration") await fault.apply(root);
        },
      }),
      expected: verificationFailed,
    }),
  ),
];

async function expectOutcome(fixture: UpgradeOwner, expected: FailureRow["expected"]) {
  if ("rejects" in expected) {
    await expect(fixture.upgrade(openRequest)).rejects.toThrow(expected.rejects);
    return;
  }
  expect(await fixture.upgrade(openRequest)).toEqual(expected);
}

async function backupEntries({ root }: ProjectRoot) {
  const backup = upgradePaths({ root }).backup;
  return (await pathExists(backup)) ? entriesOf({ directory: backup }) : undefined;
}

/**
 * Wraps `options` to record the backup's entries at `failingAt`, after the row's own checkpoint
 * work, so the discard's effect on the backup is compared with what existed before it ran.
 */
function capturingBackup(
  { root }: ProjectRoot,
  failingAt: Checkpoint,
  options: UpgradeOwnerOptions,
): Readonly<{ options: UpgradeOwnerOptions; captured: () => BackupEntries }> {
  let captured: { backup: BackupEntries } | undefined;
  return {
    options: {
      ...options,
      onCheckpoint: async (checkpoint) => {
        await options.onCheckpoint?.(checkpoint);
        if (checkpoint === failingAt) captured = { backup: await backupEntries({ root }) };
      },
    },
    captured: () => {
      expect(captured, `the attempt reached ${failingAt}`).toBeDefined();
      return captured?.backup;
    },
  };
}

/** "Try again": the second attempt upgrades to T2 and keeps every backup. */
async function expectRetryKeepsBackups(
  fixture: UpgradeOwner,
  { root }: ProjectRoot,
  backup: BackupEntries,
) {
  await expectRetryUpgrades(fixture);
  if (backup !== undefined) {
    expect(await entriesOf({ directory: upgradePaths({ root }).backup })).toEqual(backup);
  }
  const retryBackup = path.join(
    generationPaths(root).project,
    "snapshots",
    retryUpgradeIds.upgradeId,
  );
  await expect(pathExists(retryBackup)).resolves.toBe(true);
}

it.for(discardedRows)(`${title}: $name`, timeout, async (row) => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const sourceHashes = await sourceFileHashes({ root });
  const capture = capturingBackup({ root }, row.failingAt, row.options(root));
  const fixture = createUpgradeStorageOwner(root, capture.options);
  try {
    await expectOutcome(fixture, row.expected);
    const backup = capture.captured();
    expect(fixture.diagnostics).toEqual([abandonedEvent("failed")]);
    await expectDiscardedUpgrade({ root }, { sourceHashes, backup });
    await expectMigrationRequiredOnSource(fixture.owner);
    expect(fixture.diagnostics).toEqual([abandonedEvent("failed")]);
    await expectRetryKeepsBackups(fixture, { root }, backup);
  } finally {
    await fixture.owner.stop();
  }
});

const busyRows = [
  {
    name: "a busy source while copying",
    checkpoint: "after-upgrade-declared",
    lockedFile: (root: string) => generationPaths(root).canonical,
  },
  {
    name: "a busy backup",
    checkpoint: "after-backup-copied",
    lockedFile: (root: string) => upgradePaths({ root }).backupCanonical,
  },
] as const;

it.for(busyRows)(`${title}: $name`, timeout, async (row) => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const sourceHashes = await sourceFileHashes({ root });
  let lock: ReturnType<typeof holdExclusiveLock> | undefined;
  const capture = capturingBackup({ root }, row.checkpoint, {
    onCheckpoint: (checkpoint) => {
      if (checkpoint === row.checkpoint)
        lock = holdExclusiveLock({ databasePath: row.lockedFile(root) });
    },
  });
  const fixture = createUpgradeStorageOwner(root, capture.options);
  try {
    try {
      expect(await fixture.upgrade(openRequest)).toEqual(busy);
    } finally {
      lock?.release();
    }
    // A busy source fails inside the backup copy, after its last checkpoint: the backup the
    // discard must keep is whatever the copy left, so it must at least exist.
    const backup =
      row.checkpoint === "after-upgrade-declared"
        ? await backupEntries({ root })
        : capture.captured();
    expect(backup).toBeDefined();
    expect(fixture.diagnostics).toEqual([abandonedEvent("failed")]);
    await expectDiscardedUpgrade({ root }, { sourceHashes, backup });
    await expectMigrationRequiredOnSource(fixture.owner);
    await expectRetryKeepsBackups(fixture, { root }, backup);
  } finally {
    await fixture.owner.stop();
  }
});

/** Changes the source generation row behind the upgrade's back. */
function changeSourceCreatedAt({ root }: ProjectRoot): void {
  const database = new DatabaseSync(path.join(root, "application.db"));
  try {
    database
      .prepare("UPDATE storage_generations SET created_at = ? WHERE generation_id = ?")
      .run("2026-08-31T12:00:09.000Z", upgradeIds.sourceGenerationId);
  } finally {
    database.close();
  }
}

it(`${title}: a source changed before the switch stays quarantined`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const fixture = createUpgradeStorageOwner(root, {
    onCheckpoint: (checkpoint) => {
      if (checkpoint === "before-upgrade-switch") changeSourceCreatedAt({ root });
    },
  });
  try {
    expect(await fixture.upgrade(openRequest)).toEqual({
      status: "broken",
      message: "Project Storage upgrade source changed before the switch.",
    });
    const unproven = {
      kind: "discardFailed",
      event: {
        projectId: openRequest.projectId,
        upgradeId: upgradeIds.upgradeId,
        cause: "unproven",
      },
    };
    expect(fixture.diagnostics).toEqual([unproven]);
    expect(registryRows({ root }, "storage_upgrades")).toEqual([
      expect.objectContaining({ state: "in-progress" }),
    ]);
    expect(registryRows({ root }, "storage_generations")).toContainEqual(
      expect.objectContaining({
        generation_id: upgradeIds.targetGenerationId,
        creation_state: "staging",
      }),
    );
    expect(registryRows({ root }, "storage_registrations")).toEqual([
      expect.objectContaining({ active_generation_id: upgradeIds.sourceGenerationId }),
    ]);
    await expect(
      pathExists(path.join(generationPaths(root).project, upgradeIds.targetGenerationId)),
    ).resolves.toBe(true);
    const activation = await fixture.owner.acquireActivation(openRequest);
    expect(activation).toMatchObject({
      status: "ready",
      session: {
        mode: "safe-mode",
        result: {
          identity: { generationId: upgradeIds.sourceGenerationId },
          canonicalHealth: recoveryRequiredHealth,
          runtimeHealth: recoveryRequiredHealth,
        },
      },
    });
    if (activation.status === "ready") await activation.session.close();
    expect(fixture.diagnostics).toEqual([unproven, unproven]);
  } finally {
    await fixture.owner.stop();
  }
});

const brokenSourceRows = [
  { name: "a broken source while verifying the backup", checkpoint: "after-backup-copied" },
  { name: "a broken source while verifying the staged copy", checkpoint: "after-staged-migration" },
] as const;

it.for(brokenSourceRows)(`${title}: $name`, timeout, async (row) => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const fixture = createUpgradeStorageOwner(root, {
    onCheckpoint: async (checkpoint) => {
      if (checkpoint === row.checkpoint) {
        await zeroFile({ databasePath: generationPaths(root).canonical });
      }
    },
  });
  try {
    expect(await fixture.upgrade(openRequest)).toEqual({
      status: "broken",
      message: "Project Storage upgrade source verification failed.",
    });
    expect(fixture.diagnostics).toEqual([abandonedEvent("failed")]);
    expect(registryRows({ root }, "storage_upgrades")).toEqual([]);
    expect(registryRows({ root }, "storage_generations")).toHaveLength(1);
    await expect(pathExists(upgradePaths({ root }).staging)).resolves.toBe(false);
    await expectReleased({ directory: upgradePaths({ root }).backup });
    expect(await restartApplicationAuthority({ root })).toBe("current");
    const activation = await fixture.owner.acquireActivation(openRequest);
    expect(activation).toMatchObject({
      status: "ready",
      session: {
        mode: "safe-mode",
        result: {
          identity: { generationId: upgradeIds.sourceGenerationId },
          canonicalHealth: corruptHealth,
          runtimeHealth: { status: "healthy" },
        },
      },
    });
    if (activation.status === "ready") await activation.session.close();
  } finally {
    await fixture.owner.stop();
  }
});

it(`${title}: a busy staged copy is discarded at the next opening`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const sourceHashes = await sourceFileHashes({ root });
  let lock: ReturnType<typeof holdExclusiveLock> | undefined;
  const capture = capturingBackup({ root }, "after-staged-migration", {
    onCheckpoint: (checkpoint) => {
      if (checkpoint === "after-staged-migration") {
        lock = holdExclusiveLock({ databasePath: upgradePaths({ root }).stagedCanonical });
      }
    },
  });
  const fixture = createUpgradeStorageOwner(root, capture.options);
  const busyDiscard = {
    kind: "discardFailed",
    event: { projectId: openRequest.projectId, upgradeId: upgradeIds.upgradeId, cause: "busy" },
  };
  try {
    try {
      expect(await fixture.upgrade(openRequest)).toEqual(busy);
      expect(fixture.diagnostics).toEqual([busyDiscard]);
      expect(registryRows({ root }, "storage_upgrades")).toEqual([
        expect.objectContaining({ state: "in-progress" }),
      ]);
    } finally {
      lock?.release();
    }
    const backup = capture.captured();
    expect(backup).toBeDefined();
    await expectMigrationRequiredOnSource(fixture.owner);
    expect(fixture.diagnostics).toEqual([busyDiscard, abandonedEvent("interrupted")]);
    await expectDiscardedUpgrade({ root }, { sourceHashes, backup });
  } finally {
    await fixture.owner.stop();
  }
});

it(
  "keeps a committed switch when a later step fails",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const fixture = createUpgradeStorageOwner(root, { failAt: "after-upgrade-switch" });
    try {
      await expect(fixture.upgrade(openRequest)).rejects.toThrow(
        "Injected failure at after-upgrade-switch.",
      );
      expect(registryRows({ root }, "storage_registrations")).toEqual([
        expect.objectContaining({ active_generation_id: upgradeIds.targetGenerationId }),
      ]);
      expect(registryRows({ root }, "storage_upgrades")).toEqual([
        expect.objectContaining({ state: "completed" }),
      ]);
      await expectReadWriteOn(fixture.owner, upgradeIds.targetGenerationId);
      expect(fixture.diagnostics).toEqual([]);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);

it(
  "upgrades once when two calls race",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const fixture = createUpgradeStorageOwner(root);
    try {
      // The second call goes to the raw owner: it reads no clock or id when it is not required.
      const outcomes = await Promise.all([
        fixture.upgrade(openRequest),
        fixture.owner.upgrade(openRequest),
      ]);
      expect(
        outcomes.map((outcome) => outcome.status === "ready" && outcome.result.status),
      ).toEqual(["upgraded", "not-required"]);
      expect(registryRows({ root }, "storage_upgrades")).toEqual([
        expect.objectContaining({ state: "completed" }),
      ]);
      expect(fixture.diagnostics).toEqual([]);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);
