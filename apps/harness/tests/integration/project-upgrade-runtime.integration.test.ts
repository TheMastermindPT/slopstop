import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  decodeStrict,
  ProjectStorageCreateRequestSchema,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { seedGenerationOneCanonical } from "./project-storage-historical-fixture.js";
import {
  generationPaths,
  migrationRequiredHealth,
  openRequest,
  seedContradictoryActiveLocation,
} from "./project-storage-open-fixture.js";
import {
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  fixedCreationIds,
  projectStorageIntegrationTimeout,
  retryUpgradeIds,
  type UpgradeOwnerOptions,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import {
  backupFaults,
  conflictingStagedTable,
  holdExclusiveLock,
  stagedCopyFaults,
  upgradePaths,
} from "./project-storage-upgrade-faults.js";
import {
  createGenerationTwoProject,
  orderedRows,
  storageSnapshot,
  tableNames,
} from "./project-storage-upgrade-fixture.js";
import {
  createCurrentProject,
  registryRows,
  stopDuringUpgrade,
} from "./project-storage-upgrade-recovery-fixture.js";
import {
  startRealUpgradeRuntime,
  startTestUpgradeRuntime,
} from "./project-upgrade-runtime-fixture.js";

const timeout = { timeout: projectStorageIntegrationTimeout };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const request = { projectId: openRequest.projectId };
// The protocol test pins this constant to the design's table, row by row.
const rows = projectUpgradeDiagnostics;
const outcomeTitle = "maps upgrade outcomes through the harness";
const otherProjectId = "00000000-0000-4000-8000-0000000000f1";

it("upgrades a migration-required Project through the harness", timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const runtime = startRealUpgradeRuntime(root);
  try {
    expect((await runtime.activate(request.projectId)).payload).toEqual({
      status: "safe-mode",
      request,
      identity: {
        storageId: fixedCreationIds.storageId,
        generationId: fixedCreationIds.generationId,
        canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
        runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
      },
      canonicalHealth: migrationRequiredHealth,
      runtimeHealth: { status: "healthy" },
    });

    const upgraded = await runtime.upgrade(request.projectId);
    expect(upgraded.event).toBe("project.upgrade.result");
    expect(upgraded.payload).toEqual({
      status: "upgraded",
      request,
      sourceGenerationId: fixedCreationIds.generationId,
      generationId: expect.stringMatching(uuid),
      upgradeId: expect.stringMatching(uuid),
    });
    const target = Reflect.get(upgraded.payload as object, "generationId");
    expect(target).not.toBe(fixedCreationIds.generationId);

    expect((await runtime.activate(request.projectId)).payload).toMatchObject({
      status: "active",
      request,
      access: "read-write",
    });
    expect(registryRows({ root }, "storage_registrations")).toEqual([
      expect.objectContaining({ active_generation_id: target }),
    ]);
  } finally {
    await runtime.stop();
  }
});

/** One mapped outcome: how the Project is seeded, the fixture options, and the whole payload. */
type MappedRow = Readonly<{
  name: string;
  seed: (root: string) => Promise<void>;
  options?: (root: string) => UpgradeOwnerOptions;
  projectId?: string;
  expected: unknown;
}>;

const mappedRows: readonly MappedRow[] = [
  {
    name: "a generation-one Project",
    seed: async (root) => {
      await createCurrentProject({ root });
      await seedGenerationOneCanonical(root);
    },
    expected: { status: "refused", request, diagnostic: rows.unsupported },
  },
  {
    name: "a corrupt manifest",
    seed: async (root) => {
      await createCurrentProject({ root });
      await writeFile(generationPaths(root).manifest, "{not-json");
    },
    expected: { status: "refused", request, diagnostic: rows.notEligible },
  },
  {
    name: "a backup fault",
    seed: createGenerationTwoProject,
    options: (root) => ({
      onCheckpoint: async (checkpoint) => {
        if (checkpoint === "after-backup-copied") await backupFaults[0]?.apply(root);
      },
    }),
    expected: { status: "failed", request, diagnostic: rows.backupInvalid },
  },
  {
    name: "a current Project",
    seed: (root) => createCurrentProject({ root }),
    expected: { status: "not-required", request },
  },
  {
    name: "an unknown Project",
    seed: createGenerationTwoProject,
    projectId: otherProjectId,
    expected: { status: "not-registered", request: { projectId: otherProjectId } },
  },
  {
    name: "a contradictory active location",
    seed: async (root) => {
      await createGenerationTwoProject(root);
      seedContradictoryActiveLocation(root);
    },
    expected: { status: "broken", request, diagnostic: rows.storageBroken },
  },
];

it.for(mappedRows)(`${outcomeTitle}: $name`, timeout, async (row) => {
  const root = await createTemporaryApplicationRoot();
  await row.seed(root);
  const runtime = startTestUpgradeRuntime(root, row.options?.(root));
  try {
    expect((await runtime.upgrade(row.projectId ?? request.projectId)).payload).toEqual(
      row.expected,
    );
  } finally {
    await runtime.stop();
  }
});

it(`${outcomeTitle}: a staged-copy fault, then a retry`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const runtime = startTestUpgradeRuntime(root, {
    onCheckpoint: async (checkpoint) => {
      if (checkpoint === "after-staged-migration") stagedCopyFaults[0]?.apply(root);
    },
  });
  try {
    expect((await runtime.upgrade(request.projectId)).payload).toEqual({
      status: "failed",
      request,
      diagnostic: rows.verificationFailed,
    });
    expect((await runtime.activate(request.projectId)).payload).toMatchObject({
      status: "safe-mode",
      canonicalHealth: migrationRequiredHealth,
    });
    expect((await runtime.upgrade(request.projectId)).payload).toEqual({
      status: "upgraded",
      request,
      sourceGenerationId: upgradeIds.sourceGenerationId,
      generationId: retryUpgradeIds.targetGenerationId,
      upgradeId: retryUpgradeIds.upgradeId,
    });
  } finally {
    await runtime.stop();
  }
});

it(`${outcomeTitle}: a busy source`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const lock = holdExclusiveLock({ databasePath: generationPaths(root).canonical });
  const runtime = startTestUpgradeRuntime(root);
  try {
    expect((await runtime.upgrade(request.projectId)).payload).toEqual({
      status: "unavailable",
      request,
      diagnostic: rows.storageUnavailable,
    });
  } finally {
    lock.release();
    await runtime.stop();
  }
});

/** Creates a current Project with `otherProjectId` in its own root. */
async function createOtherProject(): Promise<string> {
  const otherRoot = await createTemporaryApplicationRoot();
  const creator = createUpgradeStorageOwner(otherRoot);
  try {
    expect(
      await creator.owner.create(
        decodeStrict(ProjectStorageCreateRequestSchema, {
          projectId: otherProjectId,
          createRequestId: "00000000-0000-4000-8000-0000000000f2",
        }),
      ),
    ).toMatchObject({ status: "ready", result: { status: "created" } });
  } finally {
    await creator.owner.stop();
  }
  return otherRoot;
}

/**
 * The registry and the Project's directory layout. Files are not hashed: a Project held
 * read-write keeps them locked against reading.
 */
async function heldSnapshot(root: string) {
  const application = path.join(root, "application.db");
  return {
    entries: (await readdir(path.join(root, "projects"), { recursive: true })).sort(),
    registry: Object.fromEntries(
      tableNames({ databasePath: application }).map((table) => [
        table,
        orderedRows({ databasePath: application, table }),
      ]),
    ),
  };
}

const heldCases = [
  {
    name: "another Project active",
    seed: createGenerationTwoProject,
    held: otherProjectId,
    // The upgrade target is not open: its files can be hashed.
    snapshot: storageSnapshot,
  },
  {
    name: "the upgrade target held read-write",
    seed: (root: string) => createCurrentProject({ root }),
    held: request.projectId,
    snapshot: heldSnapshot,
  },
] as const;

it.for(heldCases)(`${outcomeTitle}: $name`, timeout, async (heldCase) => {
  const root = await createTemporaryApplicationRoot();
  await heldCase.seed(root);
  const otherRoot = await createOtherProject();
  const runtime = startTestUpgradeRuntime(root, {
    other: { root: otherRoot, projectId: otherProjectId },
  });
  try {
    expect((await runtime.activate(heldCase.held)).payload).toMatchObject({
      status: "active",
      access: "read-write",
    });
    const before = await heldCase.snapshot(root);
    expect((await runtime.upgrade(request.projectId)).payload).toEqual({
      status: "rejected",
      request,
      diagnostic: rows.alreadyActive,
    });
    expect(await heldCase.snapshot(root)).toEqual(before);
  } finally {
    await runtime.stop();
  }
});

/** Holds the first upgrade attempt at `after-staged-copy` until released. */
function heldAtStagedCopy() {
  let reached = (): void => undefined;
  let release = (): void => undefined;
  const arrived = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const options: UpgradeOwnerOptions = {
    onCheckpoint: async (checkpoint) => {
      if (checkpoint !== "after-staged-copy") return;
      reached();
      await released;
    },
  };
  return { arrived, release, options };
}

it(`${outcomeTitle}: activations and commands wait for a running upgrade`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const hold = heldAtStagedCopy();
  const runtime = startTestUpgradeRuntime(root, hold.options);
  try {
    const upgrading = runtime.upgrade(request.projectId);
    await hold.arrived;
    const activating = runtime.activate(request.projectId);
    expect((await runtime.command(request.projectId)).payload).toMatchObject({
      status: "coordinator-unavailable",
      diagnostic: { code: "PROJECT_COORDINATOR_UNAVAILABLE" },
    });
    hold.release();
    const upgraded = await upgrading;
    const activated = await activating;
    expect(upgraded.payload).toMatchObject({ status: "upgraded" });
    expect(runtime.received.indexOf(upgraded)).toBeLessThan(runtime.received.indexOf(activated));
    expect(activated.payload).toMatchObject({ status: "active", access: "read-write" });
    expect(registryRows({ root }, "storage_registrations")).toEqual([
      expect.objectContaining({ active_generation_id: upgradeIds.targetGenerationId }),
    ]);
  } finally {
    hold.release();
    await runtime.stop();
  }
});

it(
  `${outcomeTitle}: a lone command and another Project wait for a running upgrade`,
  timeout,
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const otherRoot = await createOtherProject();
    const hold = heldAtStagedCopy();
    const runtime = startTestUpgradeRuntime(root, {
      ...hold.options,
      other: { root: otherRoot, projectId: otherProjectId },
    });
    try {
      const upgrading = runtime.upgrade(request.projectId);
      await hold.arrived;
      // No activation is queued yet: only the running upgrade makes the coordinator busy.
      expect((await runtime.command(request.projectId)).payload).toMatchObject({
        status: "coordinator-unavailable",
        diagnostic: { code: "PROJECT_COORDINATOR_UNAVAILABLE" },
      });
      const otherActivation = runtime.activate(otherProjectId);
      // A message the coordinator answers at once: the activation sent before it is now there.
      expect((await runtime.command(request.projectId)).payload).toMatchObject({
        status: "coordinator-unavailable",
      });
      hold.release();
      const upgraded = await upgrading;
      const activated = await otherActivation;
      expect(upgraded.payload).toMatchObject({ status: "upgraded" });
      expect(runtime.received.indexOf(upgraded)).toBeLessThan(runtime.received.indexOf(activated));
      expect(activated.payload).toMatchObject({ status: "active", access: "read-write" });
    } finally {
      hold.release();
      await runtime.stop();
    }
  },
);

it(`${outcomeTitle}: a listing during a running upgrade`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const hold = heldAtStagedCopy();
  const runtime = startTestUpgradeRuntime(root, hold.options);
  try {
    const upgrading = runtime.upgrade(request.projectId);
    await hold.arrived;
    expect((await runtime.list()).payload).toMatchObject({
      projects: [
        expect.objectContaining({
          projectId: request.projectId,
          storage: expect.objectContaining({
            status: "safe-mode",
            canonical: "recovery-required",
            runtime: "recovery-required",
          }),
        }),
      ],
    });
    hold.release();
    expect((await upgrading).payload).toMatchObject({ status: "upgraded" });
  } finally {
    hold.release();
    await runtime.stop();
  }
});

it(`${outcomeTitle}: an unexpected step error`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const runtime = startTestUpgradeRuntime(root, { onCheckpoint: conflictingStagedTable(root) });
  try {
    const answer = await runtime.upgrade(request.projectId);
    expect(answer.event).toBe("request.failure");
    expect(answer.payload).toEqual({
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    });
    expect(
      runtime.received.filter((message) => message.event === "project.upgrade.result"),
    ).toEqual([]);
    expect((await runtime.activate(request.projectId)).payload).toMatchObject({
      status: "safe-mode",
      identity: { generationId: upgradeIds.sourceGenerationId },
      canonicalHealth: migrationRequiredHealth,
    });
    expect(
      runtime.received.filter(
        (message) =>
          message.event === "request.failure" && message.causationId === answer.causationId,
      ),
    ).toEqual([answer]);
  } finally {
    await runtime.stop();
  }
});

/** A process logger that records each call, optionally throwing from one level. */
function recordingLogger(throwing?: "info" | "warn") {
  const calls: unknown[] = [];
  const record = (level: "info" | "warn") => (object: Readonly<Record<string, unknown>>) => {
    calls.push([level, object]);
    if (throwing === level) throw new Error(`The ${level} log sink failed.`);
  };
  return { calls, info: record("info"), warn: record("warn") };
}

const logTitle = "logs abandoned upgrades without paths";
const abandonedLine = (reason: string) => [
  "info",
  {
    event: "project-storage.upgrade.abandoned",
    projectId: request.projectId,
    upgradeId: upgradeIds.upgradeId,
    reason,
  },
];

const failingStagedCopy = (root: string): UpgradeOwnerOptions => ({
  onCheckpoint: (checkpoint) => {
    if (checkpoint === "after-staged-migration") stagedCopyFaults[0]?.apply(root);
  },
});

it.for([undefined, "info"] as const)(
  `${logTitle}: a failed upgrade, sink %s`,
  timeout,
  async (throwing) => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const logger = recordingLogger(throwing);
    const runtime = startTestUpgradeRuntime(root, { ...failingStagedCopy(root), logger });
    try {
      expect((await runtime.upgrade(request.projectId)).payload).toEqual({
        status: "failed",
        request,
        diagnostic: rows.verificationFailed,
      });
      expect(logger.calls).toEqual([abandonedLine("failed")]);
      expect(JSON.stringify(logger.calls)).not.toContain(JSON.stringify(root).slice(1, -1));
    } finally {
      await runtime.stop();
    }
  },
);

it(`${logTitle}: an interrupted upgrade`, timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  await (await stopDuringUpgrade({ root })).stopping;
  const logger = recordingLogger();
  const runtime = startRealUpgradeRuntime(root, logger);
  try {
    expect((await runtime.activate(request.projectId)).payload).toMatchObject({
      status: "safe-mode",
      canonicalHealth: migrationRequiredHealth,
    });
    expect(logger.calls).toEqual([abandonedLine("interrupted")]);
    expect(JSON.stringify(logger.calls)).not.toContain(JSON.stringify(root).slice(1, -1));
  } finally {
    await runtime.stop();
  }
});

it(`${logTitle}: a busy discard`, timeout, async () => {
  const payloads: unknown[] = [];
  for (const throwing of [undefined, "warn"] as const) {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    await (await stopDuringUpgrade({ root })).stopping;
    const handle = new DatabaseSync(upgradePaths({ root }).stagedCanonical);
    const logger = recordingLogger(throwing);
    const runtime = startRealUpgradeRuntime(root, logger);
    try {
      payloads.push((await runtime.activate(request.projectId)).payload);
      expect(logger.calls).toEqual([
        [
          "warn",
          {
            event: "project-storage.upgrade.discard-failed",
            projectId: request.projectId,
            upgradeId: upgradeIds.upgradeId,
            cause: "busy",
          },
        ],
      ]);
    } finally {
      handle.close();
      await runtime.stop();
    }
  }
  expect(payloads[0]).toMatchObject({ status: "unavailable" });
  expect(payloads[1]).toEqual(payloads[0]);
});
