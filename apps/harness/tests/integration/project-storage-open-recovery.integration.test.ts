import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type OpenedStorageIdentity, StorageIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  fixedCreationIds,
  pathExists,
  projectStorageIntegrationTimeout,
} from "./project-storage-create-fixture.js";
import {
  closeRequest,
  createHealthyProjectStorageFixture,
  expectNotToExpose,
  initializeApplicationAuthority,
  inspectApplicationStorageRoot,
  inspectDurableProjectStorageState,
  inspectFilesystemOnlyProject,
  openedIdentity,
  openRequest,
  payloadOf,
  recoveryRequiredHealth,
} from "./project-storage-open-fixture.js";

type RecoveryIdentity = {
  readonly [Key in keyof OpenedStorageIdentity]: OpenedStorageIdentity[Key] | null;
};

const absentIdentity: RecoveryIdentity = {
  storageId: null,
  generationId: null,
  canonicalDatabaseLineageId: null,
  runtimeDatabaseLineageId: null,
};

function expectRecoveryResult(result: unknown, identity: RecoveryIdentity) {
  expect(result).toMatchObject({ event: "project.open.result" });
  expect(payloadOf(result)).toEqual({
    status: "safe-mode",
    request: openRequest,
    mode: "safe-mode",
    identity,
    canonicalHealth: recoveryRequiredHealth,
    runtimeHealth: recoveryRequiredHealth,
  });
}

it(
  "classifies a filesystem-only witness as recovery-required without initializing",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const projectRoot = path.join(root, "projects", openRequest.projectId);
    await mkdir(projectRoot, { recursive: true });
    await writeFile(path.join(projectRoot, "slopstop.db-wal"), "witness", { flag: "wx" });
    const before = await inspectFilesystemOnlyProject(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      const result = await runtime.open(openRequest);
      expectRecoveryResult(result, absentIdentity);
      expectNotToExpose(result, root);
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        event: "project.close.result",
        payload: { status: "closed", request: closeRequest },
      });
    } finally {
      await runtime.stop();
    }

    expect(await inspectFilesystemOnlyProject(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "observes clean absence without creating application.db",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const before = await readdir(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      const result = await runtime.open(openRequest);
      expect(result).toMatchObject({ event: "project.open.result" });
      expect(payloadOf(result)).toEqual({ status: "not-registered", request: openRequest });
      expectNotToExpose(result, root);
    } finally {
      await runtime.stop();
    }

    expect(await pathExists(path.join(root, "application.db"))).toBe(false);
    await expect(readdir(root)).resolves.toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "uses one orphan location witness consistently for create and open",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await initializeApplicationAuthority(root);
    const targetRoot = path.join(root, "projects", openRequest.projectId);
    const database = new DatabaseSync(path.join(root, "application.db"));
    try {
      database
        .prepare(
          `INSERT INTO storage_locations
            (storage_id, location_id, normalized_path, location_state, observed_at)
            VALUES (?, ?, ?, 'staging', ?)`,
        )
        .run(
          "00000000-0000-4000-8000-000000000061",
          "00000000-0000-4000-8000-000000000062",
          path.resolve(targetRoot),
          "2026-08-31T12:00:00.000Z",
        );
    } finally {
      database.close();
    }
    const before = await inspectApplicationStorageRoot(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      const createResult = await runtime.create(createRequest);
      const openResult = await runtime.open(openRequest);
      expect(createResult).toMatchObject({
        event: "project.create.result",
        payload: {
          status: "blocked",
          reason: "prior-state-witness",
          diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
        },
      });
      expectRecoveryResult(openResult, absentIdentity);
      expectNotToExpose([createResult, openResult], root);
    } finally {
      await runtime.stop();
    }
    expect(await inspectApplicationStorageRoot(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "opens an incomplete registration in recovery mode with partial identity",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await initializeApplicationAuthority(root);
    const storageId = StorageIdSchema.parse("00000000-0000-4000-8000-000000000071");
    const database = new DatabaseSync(path.join(root, "application.db"));
    try {
      database
        .prepare(
          `INSERT INTO storage_registrations
            (storage_id, project_id, active_generation_id, active_location_id,
              created_at, activated_at)
            VALUES (?, ?, NULL, NULL, ?, NULL)`,
        )
        .run(storageId, openRequest.projectId, "2026-08-31T12:00:00.000Z");
    } finally {
      database.close();
    }
    const before = await inspectApplicationStorageRoot(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      const result = await runtime.open(openRequest);
      expectRecoveryResult(result, { ...absentIdentity, storageId });
      expectNotToExpose(result, root);
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        payload: { status: "closed", request: closeRequest },
      });
    } finally {
      await runtime.stop();
    }
    expect(await inspectApplicationStorageRoot(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "opens in recovery mode when an active generation has staging residue",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const stagingGenerationId = "00000000-0000-4000-8000-000000000081";
    const stagingRoot = path.join(
      root,
      "projects",
      openRequest.projectId,
      `.staging-${stagingGenerationId}`,
    );
    await mkdir(stagingRoot);
    const database = new DatabaseSync(path.join(root, "application.db"));
    try {
      database
        .prepare(
          `INSERT INTO storage_generations
            (storage_id, generation_id, project_id, location_id,
              canonical_lineage_id, runtime_lineage_id, create_request_id,
              create_request_fingerprint, generation_directory_name, creation_state,
              created_at, activated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staging', ?, NULL)`,
        )
        .run(
          fixedCreationIds.storageId,
          stagingGenerationId,
          openRequest.projectId,
          fixedCreationIds.locationId,
          "00000000-0000-4000-8000-000000000082",
          "00000000-0000-4000-8000-000000000083",
          "00000000-0000-4000-8000-000000000084",
          "0".repeat(64),
          stagingGenerationId,
          "2026-08-31T12:00:00.000Z",
        );
    } finally {
      database.close();
    }
    const before = await inspectDurableProjectStorageState(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      const result = await runtime.open(openRequest);
      expectRecoveryResult(result, openedIdentity);
      expectNotToExpose(result, root);
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        payload: { status: "closed", request: closeRequest },
      });
    } finally {
      await runtime.stop();
    }
    expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it.each(["existing", "mutable"] as const)(
  "normalizes %s application initialization failure at the owner boundary",
  async (kind) => {
    const root =
      kind === "existing"
        ? await createHealthyProjectStorageFixture()
        : await createTemporaryApplicationRoot();
    const caughtText = `${root}: foreign key initialization failed`;
    const before = await inspectApplicationStorageRoot(root);
    const runtime = await createStorageRuntimeForRoot(root, {
      initializeApplicationClient: async () => {
        throw new Error(caughtText);
      },
    });

    let result: unknown;
    try {
      result =
        kind === "existing" ? await runtime.open(openRequest) : await runtime.create(createRequest);
    } finally {
      await runtime.stop();
    }

    expect(payloadOf(result)).toMatchObject({
      status: "broken",
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage owner failed.",
      },
    });
    expect(await inspectApplicationStorageRoot(root)).toEqual(before);
    expectNotToExpose(result, root);
    expectNotToExpose(result, caughtText);
  },
  projectStorageIntegrationTimeout,
);
