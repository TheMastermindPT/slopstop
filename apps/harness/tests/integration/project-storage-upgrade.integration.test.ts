import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeStrict, ProjectStorageOpenRequestSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  parseProjectStorageBackupManifest,
  parseProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import { seedGenerationOneCanonical } from "./project-storage-historical-fixture.js";
import {
  corruptHealth,
  generationPaths,
  identityConflictHealth,
  migrationRequiredHealth,
  openRequest,
  seedContradictoryActiveLocation,
} from "./project-storage-open-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  pathExists,
  projectStorageIntegrationTimeout,
  readRows,
  sha256File,
  upgradeIds,
  upgradeTimes,
} from "./project-storage-runtime-fixture.js";
import {
  conflictingStagedTable,
  holdExclusiveLock,
  upgradePaths,
} from "./project-storage-upgrade-faults.js";
import {
  comparableCanonicalTables,
  createGenerationTwoProject,
  createUpgradedProject,
  expectReleased,
  integrity,
  orderedRows,
  storageSnapshot,
  tableNames,
  withFixtureWriter,
} from "./project-storage-upgrade-fixture.js";
import {
  abandonedEvent,
  createCurrentProject,
  entriesOf,
  expectDiscardedUpgrade,
  expectMigrationRequiredOnSource,
  expectReadWriteOn,
  stopDuringUpgrade,
} from "./project-storage-upgrade-recovery-fixture.js";

type DatabaseRows = Readonly<Record<string, unknown[]>>;
type SourceSnapshot = Readonly<{ canonical: DatabaseRows; runtime: DatabaseRows }>;
type TargetPaths = ReturnType<typeof targetPaths>;

type SourcePaths = ReturnType<typeof generationPaths>;
type ProjectRoot = Readonly<{ root: string }>;

function targetPaths(source: SourcePaths) {
  const target = path.join(source.project, upgradeIds.targetGenerationId);
  return {
    canonical: path.join(target, "slopstop.db"),
    runtime: path.join(target, "mastra.db"),
  };
}

function databaseRows({ databasePath }: Readonly<{ databasePath: string }>): DatabaseRows {
  return Object.fromEntries(
    tableNames({ databasePath }).map((table) => [table, orderedRows({ databasePath, table })]),
  );
}

function snapshotSource(source: SourcePaths): SourceSnapshot {
  return {
    canonical: databaseRows({ databasePath: source.canonical }),
    runtime: databaseRows({ databasePath: source.runtime }),
  };
}

/** The source identity rows, re-identified as the upgraded generation. */
function reidentified(rows: unknown[] | undefined) {
  return (rows ?? []).map((row) => ({
    ...(row as Record<string, unknown>),
    generation_id: upgradeIds.targetGenerationId,
    created_at: upgradeTimes.started,
  }));
}

function expectUpgradedCanonical(before: SourceSnapshot, target: TargetPaths): void {
  const after = databaseRows({ databasePath: target.canonical });
  expect(after["schema_metadata"]).toEqual([
    {
      metadata_key: "canonical",
      database_kind: "canonical",
      format_version: 1,
      schema_version: 3,
      last_migration_id: "0002_initial_repository_binding",
    },
  ]);
  expect(after["repository_bindings"]).toEqual([]);
  expect(after["project_workspaces"]).toEqual([]);
  for (const table of comparableCanonicalTables) {
    expect(after[table], table).toEqual(before.canonical[table]);
  }
  expect(after["storage_identity"]).toEqual(reidentified(before.canonical["storage_identity"]));
}

function expectUpgradedRuntime(before: SourceSnapshot, target: TargetPaths): void {
  const after = databaseRows({ databasePath: target.runtime });
  expect(Object.keys(after)).toEqual(Object.keys(before.runtime));
  expect(after["slopstop_runtime_schema_metadata"]).toEqual(
    before.runtime["slopstop_runtime_schema_metadata"],
  );
  expect(after["slopstop_runtime_storage_identity"]).toEqual(
    reidentified(before.runtime["slopstop_runtime_storage_identity"]),
  );
}

it(
  "upgrades a generation-two Project and opens it read-write with identical data",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const before = snapshotSource(generationPaths(root));
    const fixture = createUpgradeStorageOwner(root);
    try {
      expect(await fixture.upgrade(openRequest)).toEqual({
        status: "ready",
        result: {
          status: "upgraded",
          request: openRequest,
          sourceGenerationId: upgradeIds.sourceGenerationId,
          generationId: upgradeIds.targetGenerationId,
          upgradeId: upgradeIds.upgradeId,
        },
      });
      await expectReadWriteOn(fixture.owner, upgradeIds.targetGenerationId);

      const target = targetPaths(generationPaths(root));
      expectUpgradedCanonical(before, target);
      expectUpgradedRuntime(before, target);
      for (const database of [target.canonical, target.runtime]) {
        expect(integrity({ databasePath: database })).toEqual({
          integrity: [{ integrity_check: "ok" }],
          foreignKeys: [],
        });
      }
      const writer = { storage: fixture.owner, projectId: openRequest.projectId };
      await withFixtureWriter(writer, async (submit) => {
        expect(await submit("after upgrade")).toMatchObject({
          status: "settled",
          receipt: { outcome: "applied" },
        });
      });
      expect(
        await readRows(target.canonical, "SELECT last_project_sequence FROM project_state"),
      ).toEqual([[4]]);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);

it(
  "answers not-required or not-registered without changing anything",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const fixture = createUpgradeStorageOwner(root);
    try {
      expect(await fixture.owner.create(createRequest)).toMatchObject({
        status: "ready",
        result: { status: "created" },
      });
      const before = await storageSnapshot(root);
      expect(await fixture.upgrade(openRequest)).toEqual({
        status: "ready",
        result: { status: "not-required", request: openRequest },
      });
      expect(await storageSnapshot(root)).toEqual(before);
      await expectReleased({ directory: generationPaths(root).generation });
      const activation = await fixture.owner.acquireActivation(openRequest);
      expect(activation).toMatchObject({
        status: "ready",
        session: {
          mode: "read-write",
          result: { identity: { generationId: upgradeIds.sourceGenerationId } },
        },
      });
      if (activation.status === "ready") await activation.session.close();

      const unknown = decodeStrict(ProjectStorageOpenRequestSchema, {
        projectId: "00000000-0000-4000-8000-0000000000f1",
      });
      expect(await fixture.upgrade(unknown)).toEqual({
        status: "ready",
        result: { status: "not-registered", request: unknown },
      });
      await expect(pathExists(path.join(root, "projects", unknown.projectId))).resolves.toBe(false);
      expect((await storageSnapshot(root)).registry).toEqual(before.registry);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);

const refusedUnsupported = {
  status: "ready",
  result: {
    status: "refused",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_UPGRADE_UNSUPPORTED",
      message: "This Project needs a database change that cannot run automatically.",
    },
  },
} as const;
const refusedNotEligible = {
  status: "ready",
  result: {
    status: "refused",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_UPGRADE_NOT_ELIGIBLE",
      message: "This Project's storage cannot be upgraded in its current state.",
    },
  },
} as const;

const ineligibleCases = [
  {
    name: "generation-one Project",
    seed: async ({ root }: ProjectRoot) => {
      await createCurrentProject({ root });
      await seedGenerationOneCanonical(root);
    },
    expected: refusedUnsupported,
  },
  {
    name: "corrupt manifest",
    seed: async ({ root }: ProjectRoot) => {
      await createCurrentProject({ root });
      await writeFile(generationPaths(root).manifest, "{not-json");
    },
    expected: refusedNotEligible,
  },
  {
    name: "generation-two canonical with a corrupt runtime database",
    seed: async ({ root }: ProjectRoot) => {
      await createGenerationTwoProject(root);
      await writeFile(generationPaths(root).runtime, "not a sqlite database");
    },
    expected: refusedNotEligible,
  },
] as const;

it(
  "refuses ineligible Projects without changing anything",
  async () => {
    for (const ineligible of ineligibleCases) {
      const root = await createTemporaryApplicationRoot();
      await ineligible.seed({ root });
      const before = await storageSnapshot(root);
      const fixture = createUpgradeStorageOwner(root);
      try {
        expect
          .soft(await fixture.upgrade(openRequest), ineligible.name)
          .toEqual(ineligible.expected);
        expect.soft(await storageSnapshot(root), ineligible.name).toEqual(before);
        await expectReleased({ directory: generationPaths(root).generation });
        if (ineligible.expected === refusedUnsupported) {
          const activation = await fixture.owner.acquireActivation(openRequest);
          expect.soft(activation).toMatchObject({
            status: "ready",
            session: { mode: "safe-mode", result: { canonicalHealth: migrationRequiredHealth } },
          });
          if (activation.status === "ready") await activation.session.close();
        }
      } finally {
        await fixture.owner.stop();
      }
    }
  },
  projectStorageIntegrationTimeout,
);

function registryRows(root: string, table: string) {
  return orderedRows({ databasePath: path.join(root, "application.db"), table });
}

async function sourceFileHashes(source: SourcePaths) {
  return Promise.all([source.canonical, source.runtime, source.manifest].map(sha256File));
}

type DeclaredObservation = Readonly<{
  upgrades: unknown[];
  generations: unknown[];
  snapshotExists: boolean;
  stagingExists: boolean;
}>;

async function observeDeclared(root: string): Promise<DeclaredObservation> {
  const project = generationPaths(root).project;
  return {
    upgrades: registryRows(root, "storage_upgrades"),
    generations: registryRows(root, "storage_generations"),
    snapshotExists: await pathExists(path.join(project, "snapshots", upgradeIds.upgradeId)),
    stagingExists: await pathExists(
      path.join(project, `.staging-${upgradeIds.targetGenerationId}`),
    ),
  };
}

function expectDeclaredFirst(observed: DeclaredObservation | undefined): void {
  expect(observed?.upgrades).toEqual([
    expect.objectContaining({
      source_generation_id: upgradeIds.sourceGenerationId,
      target_generation_id: upgradeIds.targetGenerationId,
      state: "in-progress",
      completed_at: null,
    }),
  ]);
  expect(observed?.generations).toContainEqual(
    expect.objectContaining({
      generation_id: upgradeIds.targetGenerationId,
      creation_state: "staging",
    }),
  );
  expect(observed?.snapshotExists).toBe(false);
  expect(observed?.stagingExists).toBe(false);
}

async function fileBaseline(file: string) {
  return {
    algorithm: "sha256",
    sizeBytes: (await stat(file)).size,
    sha256: await sha256File(file),
  };
}

async function expectVerifiedBackup(root: string, before: SourceSnapshot): Promise<void> {
  const backup = path.join(generationPaths(root).project, "snapshots", upgradeIds.upgradeId);
  expect((await readdir(backup)).sort()).toEqual(["manifest.json", "mastra.db", "slopstop.db"]);
  const canonical = path.join(backup, "slopstop.db");
  const runtime = path.join(backup, "mastra.db");
  for (const databasePath of [canonical, runtime]) {
    expect(integrity({ databasePath })).toEqual({
      integrity: [{ integrity_check: "ok" }],
      foreignKeys: [],
    });
  }
  expect(databaseRows({ databasePath: canonical })).toEqual(before.canonical);
  expect(databaseRows({ databasePath: runtime })).toEqual(before.runtime);
  const sourceManifest = parseProjectStorageManifest(
    await readFile(generationPaths(root).manifest, "utf8"),
  );
  expect(
    parseProjectStorageBackupManifest(await readFile(path.join(backup, "manifest.json"), "utf8")),
  ).toEqual({
    manifestVersion: 1,
    kind: "pre-upgrade-backup",
    backupId: upgradeIds.upgradeId,
    projectId: openRequest.projectId,
    storageId: sourceManifest.storageId,
    sourceGenerationId: upgradeIds.sourceGenerationId,
    canonical: {
      ...sourceManifest.canonical,
      formatVersion: 1,
      schemaVersion: 2,
      lastMigrationId: "0001_canonical_project_writer",
      activationBaseline: await fileBaseline(canonical),
    },
    runtime: { ...sourceManifest.runtime, activationBaseline: await fileBaseline(runtime) },
    projectSequence: 3,
    runtimeWaterline: 0,
    producingApplicationVersion: "0.0.0",
    createdAt: upgradeTimes.started,
  });
}

function upgradeFingerprint(): string {
  const input = JSON.stringify({
    version: 1,
    projectId: openRequest.projectId,
    createRequestId: upgradeIds.upgradeId,
  });
  return createHash("sha256").update(input).digest("hex");
}

function expectSwitchedRegistry(root: string, sourceRow: Record<string, unknown>): void {
  expect(registryRows(root, "storage_registrations")).toEqual([
    expect.objectContaining({
      active_generation_id: upgradeIds.targetGenerationId,
      active_location_id: sourceRow["location_id"],
      created_at: upgradeTimes.created,
      activated_at: upgradeTimes.activated,
    }),
  ]);
  expect(registryRows(root, "storage_generations")).toEqual([
    {
      ...sourceRow,
      generation_id: upgradeIds.targetGenerationId,
      generation_directory_name: upgradeIds.targetGenerationId,
      creation_state: "active",
      create_request_id: upgradeIds.upgradeId,
      create_request_fingerprint: upgradeFingerprint(),
      created_at: upgradeTimes.started,
      activated_at: upgradeTimes.activated,
    },
  ]);
  expect(registryRows(root, "storage_upgrades")).toEqual([
    {
      upgrade_id: upgradeIds.upgradeId,
      storage_id: sourceRow["storage_id"],
      project_id: sourceRow["project_id"],
      location_id: sourceRow["location_id"],
      source_generation_id: upgradeIds.sourceGenerationId,
      target_generation_id: upgradeIds.targetGenerationId,
      source_canonical_lineage_id: sourceRow["canonical_lineage_id"],
      source_runtime_lineage_id: sourceRow["runtime_lineage_id"],
      source_create_request_id: sourceRow["create_request_id"],
      source_create_request_fingerprint: sourceRow["create_request_fingerprint"],
      source_created_at: sourceRow["created_at"],
      source_activated_at: sourceRow["activated_at"],
      state: "completed",
      started_at: upgradeTimes.started,
      completed_at: upgradeTimes.activated,
    },
  ]);
}

it(
  "declares first, keeps the prior generation byte-identical, a verified backup and an exact registry record",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const source = generationPaths(root);
    const before = snapshotSource(source);
    const hashes = await sourceFileHashes(source);
    const [sourceRow] = registryRows(root, "storage_generations") as Record<string, unknown>[];
    let declared: DeclaredObservation | undefined;
    const fixture = createUpgradeStorageOwner(root, {
      onCheckpoint: async (checkpoint) => {
        if (checkpoint === "after-upgrade-declared") declared = await observeDeclared(root);
      },
    });
    try {
      expect(await fixture.upgrade(openRequest)).toMatchObject({
        status: "ready",
        result: { status: "upgraded" },
      });
    } finally {
      await fixture.owner.stop();
    }
    expectDeclaredFirst(declared);
    await expect(sourceFileHashes(source)).resolves.toEqual(hashes);
    await expectReleased({ directory: source.generation });
    await expectVerifiedBackup(root, before);
    expectSwitchedRegistry(root, sourceRow ?? {});
  },
  projectStorageIntegrationTimeout,
);

it(
  "records upgrade provenance and reopens healthy with retained generations",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const fixture = createUpgradeStorageOwner(root);
    try {
      expect(await fixture.upgrade(openRequest)).toMatchObject({
        status: "ready",
        result: { status: "upgraded" },
      });
      const target = path.join(generationPaths(root).project, upgradeIds.targetGenerationId);
      const manifest = parseProjectStorageManifest(
        await readFile(path.join(target, "manifest.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        manifestVersion: 2,
        generationId: upgradeIds.targetGenerationId,
        provenance: {
          kind: "staged-upgrade",
          createRequestId: upgradeIds.upgradeId,
          sourceGenerationId: upgradeIds.sourceGenerationId,
          storageOperationId: upgradeIds.upgradeId,
        },
        projectSequence: 3,
        runtimeWaterline: 0,
        createdAt: upgradeTimes.started,
        canonical: { schemaVersion: 3 },
      });
      for (const attempt of [1, 2, 3]) {
        const activation = await fixture.owner.acquireActivation(openRequest);
        expect(activation, `activation ${attempt}`).toMatchObject({
          status: "ready",
          session: {
            mode: "read-write",
            result: { identity: { generationId: upgradeIds.targetGenerationId } },
          },
        });
        if (activation.status === "ready") await activation.session.close();
      }
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);

function targetManifestPath({ root }: ProjectRoot): string {
  return path.join(generationPaths(root).project, upgradeIds.targetGenerationId, "manifest.json");
}

async function rewriteManifest(
  manifestPath: string,
  mutate: (manifest: Record<string, unknown>) => unknown,
): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  await writeFile(manifestPath, `${JSON.stringify(mutate(manifest), null, 2)}\n`);
}

function withProvenance(manifest: Record<string, unknown>, changes: Record<string, unknown>) {
  return {
    ...manifest,
    provenance: { ...(manifest["provenance"] as Record<string, unknown>), ...changes },
  };
}

const otherId = "00000000-0000-4000-8000-0000000000e1";
const otherInstant = "2026-10-05T11:00:00.000Z";

const provenanceCases = [
  {
    name: "manifest generationId",
    seed: (input: ProjectRoot) =>
      rewriteManifest(targetManifestPath(input), (manifest) => ({
        ...manifest,
        generationId: otherId,
      })),
    expected: identityConflictHealth,
  },
  {
    name: "manifest createRequestId",
    seed: (input: ProjectRoot) =>
      rewriteManifest(targetManifestPath(input), (manifest) =>
        withProvenance(manifest, { createRequestId: otherId, storageOperationId: otherId }),
      ),
    expected: identityConflictHealth,
  },
  {
    name: "manifest createdAt",
    seed: (input: ProjectRoot) =>
      rewriteManifest(targetManifestPath(input), (manifest) => ({
        ...manifest,
        createdAt: otherInstant,
      })),
    expected: identityConflictHealth,
  },
  {
    name: "manifest sourceGenerationId only",
    seed: (input: ProjectRoot) =>
      rewriteManifest(targetManifestPath(input), (manifest) =>
        withProvenance(manifest, { sourceGenerationId: otherId }),
      ),
    expected: identityConflictHealth,
  },
  {
    name: "version-2 manifest without sourceGenerationId",
    seed: (input: ProjectRoot) =>
      rewriteManifest(targetManifestPath(input), (manifest) => {
        const { sourceGenerationId: _removed, ...provenance } = manifest["provenance"] as Record<
          string,
          unknown
        >;
        return { ...manifest, provenance };
      }),
    expected: corruptHealth,
  },
  {
    name: "version-1 manifest on the upgraded generation",
    seed: (input: ProjectRoot) =>
      rewriteManifest(targetManifestPath(input), (manifest) => ({
        ...withProvenance(manifest, {
          kind: "initial-create",
          sourceGenerationId: null,
          storageOperationId: null,
        }),
        manifestVersion: 1,
        projectSequence: 0,
        runtimeWaterline: 0,
      })),
    expected: identityConflictHealth,
  },
] as const;

async function expectSafeModeHealth(root: string, expected: object, name: string) {
  const fixture = createUpgradeStorageOwner(root);
  try {
    const activation = await fixture.owner.acquireActivation(openRequest);
    expect.soft(activation, name).toMatchObject({
      status: "ready",
      session: {
        mode: "safe-mode",
        result: { canonicalHealth: expected, runtimeHealth: expected },
      },
    });
    if (activation.status === "ready") await activation.session.close();
  } finally {
    await fixture.owner.stop();
  }
}

it(
  "bounds manifest versions and provenance at opening",
  async () => {
    for (const provenanceCase of provenanceCases) {
      const root = await createTemporaryApplicationRoot();
      await createUpgradedProject({ root });
      await provenanceCase.seed({ root });
      await expectSafeModeHealth(root, provenanceCase.expected, provenanceCase.name);
    }
    const root = await createTemporaryApplicationRoot();
    await createCurrentProject({ root });
    await rewriteManifest(generationPaths(root).manifest, (manifest) => ({
      ...withProvenance(manifest, {
        kind: "staged-upgrade",
        sourceGenerationId: otherId,
        storageOperationId: (manifest["provenance"] as Record<string, unknown>)["createRequestId"],
      }),
      manifestVersion: 2,
    }));
    await expectSafeModeHealth(
      root,
      identityConflictHealth,
      "version-2 on a never-upgraded Project",
    );
  },
  projectStorageIntegrationTimeout,
);

const busyOutcome = {
  status: "unavailable",
  message: "Project Storage is busy; the upgrade can be retried.",
} as const;

it(
  "keeps unavailable and broken outcomes for upgrade",
  async () => {
    const stoppedRoot = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(stoppedRoot);
    const stoppedBefore = await storageSnapshot(stoppedRoot);
    const stopped = createUpgradeStorageOwner(stoppedRoot);
    await stopped.owner.stop();
    expect.soft(await stopped.upgrade(openRequest)).toEqual({
      status: "unavailable",
      message: "Project Storage owner is stopped.",
    });
    expect.soft(await storageSnapshot(stoppedRoot)).toEqual(stoppedBefore);

    for (const database of ["canonical", "runtime"] as const) {
      const root = await createTemporaryApplicationRoot();
      await createGenerationTwoProject(root);
      const before = await storageSnapshot(root);
      const lock = holdExclusiveLock({ databasePath: generationPaths(root)[database] });
      const fixture = createUpgradeStorageOwner(root);
      try {
        expect.soft(await fixture.upgrade(openRequest), database).toEqual(busyOutcome);
      } finally {
        lock.release();
        await fixture.owner.stop();
      }
      expect.soft(await storageSnapshot(root), database).toEqual(before);
      await expectReleased({ directory: generationPaths(root).generation });
    }

    const brokenRoot = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(brokenRoot);
    seedContradictoryActiveLocation(brokenRoot);
    const brokenBefore = await storageSnapshot(brokenRoot);
    const broken = createUpgradeStorageOwner(brokenRoot);
    try {
      expect.soft(await broken.upgrade(openRequest)).toEqual({
        status: "broken",
        message: "Project Storage authority is internally inconsistent.",
      });
    } finally {
      await broken.owner.stop();
    }
    expect.soft(await storageSnapshot(brokenRoot)).toEqual(brokenBefore);
    await expectReleased({ directory: generationPaths(brokenRoot).generation });
  },
  projectStorageIntegrationTimeout,
);

it(
  "keeps unavailable and broken outcomes for upgrade: an unexpected step error is rethrown",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const fixture = createUpgradeStorageOwner(root, { onCheckpoint: conflictingStagedTable(root) });
    try {
      await expect(fixture.upgrade(openRequest)).rejects.toThrow(/already exists/u);
    } finally {
      await fixture.owner.stop();
    }
  },
  projectStorageIntegrationTimeout,
);

async function registrySnapshot({ root }: ProjectRoot) {
  return (await storageSnapshot(root)).registry;
}

it(
  "rolls back declare and switch transactions on failure: declaration",
  async () => {
    const declareRoot = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(declareRoot);
    const beforeDeclare = await registrySnapshot({ root: declareRoot });
    const declare = createUpgradeStorageOwner(declareRoot, { failAt: "during-upgrade-declare" });
    try {
      expect.soft(await declare.upgrade(openRequest)).toEqual({
        status: "broken",
        message: "Project Storage upgrade declaration failed.",
      });
    } finally {
      await declare.owner.stop();
    }
    expect.soft(await registrySnapshot({ root: declareRoot })).toEqual(beforeDeclare);
    await expect
      .soft(pathExists(path.join(generationPaths(declareRoot).project, "snapshots")))
      .resolves.toBe(false);
  },
  projectStorageIntegrationTimeout,
);

it(
  "settles on owner stop and recovers at the next opening",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const sourceHashes = await sourceFileHashes(generationPaths(root));
    const stopped = await stopDuringUpgrade({ root });
    expect(stopped.outcome).toEqual({
      status: "unavailable",
      message: "Project Storage owner is stopped.",
    });
    await expect(stopped.stopping).resolves.toBeUndefined();
    expect(stopped.diagnostics).toEqual([]);
    expect(registryRows(root, "storage_upgrades")).toEqual([
      expect.objectContaining({ state: "in-progress" }),
    ]);
    expect(registryRows(root, "storage_generations")).toContainEqual(
      expect.objectContaining({
        generation_id: upgradeIds.targetGenerationId,
        creation_state: "staging",
      }),
    );
    await expect(pathExists(upgradePaths({ root }).staging)).resolves.toBe(true);
    const backup = await entriesOf({ directory: upgradePaths({ root }).backup });

    const next = createUpgradeStorageOwner(root, { attempt: 2 });
    try {
      await expectMigrationRequiredOnSource(next.owner);
      expect(next.diagnostics).toEqual([abandonedEvent("interrupted")]);
    } finally {
      await next.owner.stop();
    }
    await expectDiscardedUpgrade({ root }, { sourceHashes, backup });
  },
  projectStorageIntegrationTimeout,
);
