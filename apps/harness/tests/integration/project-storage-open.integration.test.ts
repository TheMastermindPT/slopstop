import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  decodeStrict,
  type ProjectDatabaseHealth,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import {
  type ProjectStorageManifestV1,
  parseProjectStorageManifest,
  serializeProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import {
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  fixedCreationIds,
  projectStorageIntegrationTimeout,
  sha256File,
} from "./project-storage-create-fixture.js";
import {
  historicalMigrationPath,
  seedGenerationOneCanonical,
} from "./project-storage-historical-fixture.js";
import {
  type ApplicationRootPath,
  brokenHealth,
  closeRequest,
  corruptHealth,
  createHealthyProjectStorageFixture,
  expectExistingCanonicalSafeMode,
  expectNotToExpose,
  expectSafeModeWithoutMutation,
  generationPaths,
  healthyHealth,
  identityConflictHealth,
  inspectDurableProjectStorageState,
  migrationRequiredHealth,
  missingHealth,
  mutateCanonicalBytesWithoutChangingAuthority,
  type OpeningHealthCase,
  openedIdentity,
  openRequest,
  payloadOf,
  recoveryRequiredHealth,
  rejectProjectDatabaseOpen,
  type StorageRuntimeOptions,
  seedConflictingCanonicalIdentity,
  seedNewerCanonicalAuthority,
  unavailableHealth,
  unsupportedNewerHealth,
} from "./project-storage-open-fixture.js";
import { createPreviousRegistry } from "./registration-schema-fixture.js";

const manifestReadFailure = vi.hoisted(() => ({ filePath: undefined as string | undefined }));
const previousRegistryProjectId = "71938cf7-9874-4dd8-8f10-7507a8ef9a82";

function queryApplicationDatabase(root: ApplicationRootPath | string, sql: string) {
  const database = new DatabaseSync(path.join(root, "application.db"), { readOnly: true });
  try {
    return database.prepare(sql).all();
  } finally {
    database.close();
  }
}

const readApplicationHead = (root: ApplicationRootPath | string) =>
  queryApplicationDatabase(root, "SELECT last_migration_id FROM schema_metadata")[0];

const readPreviousRegistrations = (root: ApplicationRootPath | string) =>
  queryApplicationDatabase(
    root,
    "SELECT storage_id, project_id, created_at FROM storage_registrations",
  );

const applicationUpgradeCreateRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: openRequest.projectId,
  createRequestId: "00000000-0000-4000-8000-000000000019",
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const mockedReadFile = vi.fn(actual.readFile);
  mockedReadFile.mockImplementation(async (...args) => {
    if (String(args[0]) === manifestReadFailure.filePath) {
      manifestReadFailure.filePath = undefined;
      throw Object.assign(new Error("injected manifest access failure"), { code: "EACCES" });
    }
    return actual.readFile(...args);
  });
  return { ...actual, readFile: mockedReadFile };
});

async function expectBrokenOpenWithoutMutation(
  input: Readonly<{
    root: ApplicationRootPath;
    runtimeOptions?: StorageRuntimeOptions;
    expectedPayload: unknown;
    hiddenValues?: readonly string[];
  }>,
): Promise<void> {
  const before = await inspectDurableProjectStorageState(input.root);
  const runtime = await createStorageRuntimeForRoot(input.root, input.runtimeOptions);
  let result: unknown;
  try {
    result = await runtime.open(openRequest);
  } finally {
    await runtime.stop();
  }
  expect(result).toMatchObject({ event: "project.open.result" });
  expect(payloadOf(result)).toEqual(input.expectedPayload);
  expectNotToExpose(result, input.root);
  for (const hiddenValue of input.hiddenValues ?? []) expectNotToExpose(result, hiddenValue);
  expect(await inspectDurableProjectStorageState(input.root)).toEqual(before);
}

async function historicalOpeningHashes(root: ApplicationRootPath) {
  const paths = generationPaths(root);
  const database = new DatabaseSync(paths.canonical, { readOnly: true });
  let metadata: string;
  try {
    metadata = JSON.stringify(
      database
        .prepare(
          "SELECT metadata_key, database_kind, format_version, schema_version, last_migration_id FROM schema_metadata ORDER BY metadata_key",
        )
        .all(),
    );
  } finally {
    database.close();
  }
  return Promise.all([
    sha256File(paths.canonical),
    createHash("sha256").update(metadata).digest("hex"),
    sha256File(paths.manifest),
    sha256File(historicalMigrationPath),
  ]);
}

it(
  "reports generation 1 as migration-required without mutation",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    await seedGenerationOneCanonical(root);
    const before = await historicalOpeningHashes(root);
    const runtime = await createStorageRuntimeForRoot(root);
    let result: unknown;
    try {
      result = await runtime.open(openRequest);
    } finally {
      await runtime.stop();
    }
    expect(payloadOf(result)).toEqual({
      status: "safe-mode",
      request: openRequest,
      mode: "safe-mode",
      identity: openedIdentity,
      canonicalHealth: {
        status: "migration-required",
        diagnostic: {
          code: "DATABASE_MIGRATION_REQUIRED",
          message: "Database migration is required.",
        },
      },
      runtimeHealth: healthyHealth,
    });
    expect(await historicalOpeningHashes(root)).toEqual(before);
    expect(before[3]).toBe("e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c");
  },
  projectStorageIntegrationTimeout,
);

async function seedIncompleteGeneration(root: ApplicationRootPath): Promise<void> {
  const database = new DatabaseSync(generationPaths(root).application);
  try {
    database
      .prepare(
        `UPDATE storage_registrations
          SET active_generation_id = NULL, active_location_id = NULL, activated_at = NULL
          WHERE project_id = ?`,
      )
      .run(openRequest.projectId);
  } finally {
    database.close();
  }
}

async function seedUnknownCanonicalMigration(root: ApplicationRootPath): Promise<void> {
  const paths = generationPaths(root);
  const manifest = parseProjectStorageManifest(await readFile(paths.manifest, "utf8"));
  await writeFile(
    paths.manifest,
    serializeProjectStorageManifest({
      ...manifest,
      canonical: { ...manifest.canonical, lastMigrationId: "9999_unknown" },
    }),
  );
  const database = new DatabaseSync(paths.canonical);
  try {
    database.exec("UPDATE schema_metadata SET last_migration_id = '9999_unknown'");
  } finally {
    database.close();
  }
}

async function seedCanonicalIntegrityFailure(root: ApplicationRootPath): Promise<void> {
  const canonicalPath = generationPaths(root).canonical;
  const databaseBytes = await readFile(canonicalPath);
  const freelistPageCountOffset = 36;
  const freelistPageCount = databaseBytes.readUInt32BE(freelistPageCountOffset);
  databaseBytes.writeUInt32BE(freelistPageCount + 1, freelistPageCountOffset);
  await writeFile(canonicalPath, databaseBytes);
}

function seedMastraPrivateRuntimeSchema(root: ApplicationRootPath): void {
  const database = new DatabaseSync(generationPaths(root).runtime);
  try {
    database.exec(`
      CREATE TABLE mastra_private_state (
        id text PRIMARY KEY NOT NULL,
        parent_id text REFERENCES mastra_private_state(id),
        CONSTRAINT mastra_private_nonempty CHECK(length(id) > 0)
      );
      CREATE INDEX mastra_private_parent_idx ON mastra_private_state(parent_id);
      CREATE VIEW mastra_private_view AS SELECT id FROM mastra_private_state;
      CREATE TRIGGER mastra_private_trigger
        AFTER INSERT ON mastra_private_state
        BEGIN
          SELECT NEW.id;
        END;
    `);
  } finally {
    database.close();
  }
}

function seedCaseVariedRuntimeAdapterTrigger(root: ApplicationRootPath): void {
  const database = new DatabaseSync(generationPaths(root).runtime);
  try {
    database.exec(`
      CREATE TRIGGER unexpected_runtime_adapter_trigger
        AFTER INSERT ON SLOPSTOP_RUNTIME_STORAGE_IDENTITY
        BEGIN
          SELECT NEW.storage_id;
        END;
    `);
  } finally {
    database.close();
  }
}

const healthyOpeningCases = [
  {
    name: "opens a healthy created generation without comparing mutable bytes to baselines",
    seed: mutateCanonicalBytesWithoutChangingAuthority,
  },
  {
    name: "ignores Mastra-private runtime schema while validating adapter authority",
    seed: async (root: ApplicationRootPath) => seedMastraPrivateRuntimeSchema(root),
  },
] as const;

const openingHealthCases = [
  {
    name: "canonical known-older authority",
    seed: async (root) => {
      await seedGenerationOneCanonical(root);
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: migrationRequiredHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "incomplete generation",
    seed: async (root) => {
      await seedIncompleteGeneration(root);
      return undefined;
    },
    expectedIdentity: {
      storageId: fixedCreationIds.storageId,
      generationId: null,
      canonicalDatabaseLineageId: null,
      runtimeDatabaseLineageId: null,
    },
    expectedCanonical: recoveryRequiredHealth,
    expectedRuntime: recoveryRequiredHealth,
  },
  {
    name: "deleted canonical database",
    seed: async (root) => {
      await rm(generationPaths(root).canonical);
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: missingHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "malformed canonical database",
    seed: async (root) => {
      await writeFile(generationPaths(root).canonical, "not a sqlite database");
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: corruptHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "changed canonical lineage",
    seed: async (root) => {
      seedConflictingCanonicalIdentity(root);
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: identityConflictHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "newer canonical metadata",
    seed: async (root) => {
      await seedNewerCanonicalAuthority(root);
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: unsupportedNewerHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "canonical open-access failure",
    seed: async (root) => ({
      openProjectDatabaseClient: ({ databaseKind, open }) => {
        if (databaseKind === "canonical") {
          throw Object.assign(new Error(`${root}: injected canonical open-access failure`), {
            code: "SQLITE_CANTOPEN",
          });
        }
        return open();
      },
    }),
    expectedIdentity: openedIdentity,
    expectedCanonical: unavailableHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "unknown canonical migration",
    seed: async (root) => {
      await seedUnknownCanonicalMigration(root);
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: brokenHealth,
    expectedRuntime: healthyHealth,
  },
  {
    name: "corrupt runtime database",
    seed: async (root) => {
      await writeFile(generationPaths(root).runtime, "not a sqlite database");
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: healthyHealth,
    expectedRuntime: corruptHealth,
  },
  {
    name: "case-varied trigger on a runtime adapter table",
    seed: async (root) => {
      seedCaseVariedRuntimeAdapterTrigger(root);
      return undefined;
    },
    expectedIdentity: openedIdentity,
    expectedCanonical: healthyHealth,
    expectedRuntime: brokenHealth,
  },
] as const satisfies readonly OpeningHealthCase[];

async function seedManifestIdentityConflict(
  root: ApplicationRootPath,
  mutate: (manifest: ProjectStorageManifestV1) => unknown,
): Promise<void> {
  const paths = generationPaths(root);
  const manifest = parseProjectStorageManifest(await readFile(paths.manifest, "utf8"));
  await writeFile(paths.manifest, serializeProjectStorageManifest(mutate(manifest)));
}

const manifestIdentityConflictCases = [
  {
    name: "Project ID",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      projectId: "00000000-0000-4000-8000-000000000099",
    }),
  },
  {
    name: "Storage ID",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      storageId: "00000000-0000-4000-8000-000000000099",
    }),
  },
  {
    name: "generation ID",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      generationId: "00000000-0000-4000-8000-000000000099",
    }),
  },
  {
    name: "create request ID",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      provenance: {
        ...manifest.provenance,
        createRequestId: "00000000-0000-4000-8000-000000000099",
      },
    }),
  },
  {
    name: "canonical lineage ID",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      canonical: {
        ...manifest.canonical,
        databaseLineageId: "00000000-0000-4000-8000-000000000099",
      },
    }),
  },
  {
    name: "runtime lineage ID",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      runtime: {
        ...manifest.runtime,
        databaseLineageId: "00000000-0000-4000-8000-000000000099",
      },
    }),
  },
  {
    name: "creation time",
    mutate: (manifest: ProjectStorageManifestV1) => ({
      ...manifest,
      createdAt: "2026-08-31T12:00:01.000Z",
    }),
  },
] as const;

const manifestHealthCases = [
  {
    name: "missing",
    seed: async (root: ApplicationRootPath) => {
      await rm(generationPaths(root).manifest);
    },
    expectedHealth: missingHealth,
  },
  {
    name: "unreadable",
    seed: async () => {},
    failRead: true,
    expectedHealth: unavailableHealth,
  },
  {
    name: "malformed",
    seed: async (root: ApplicationRootPath) => {
      await writeFile(generationPaths(root).manifest, "{not-json");
    },
    expectedHealth: corruptHealth,
  },
  {
    name: "non-file",
    seed: async (root: ApplicationRootPath) => {
      const manifestPath = generationPaths(root).manifest;
      await rm(manifestPath);
      await mkdir(manifestPath);
    },
    expectedHealth: brokenHealth,
  },
  {
    name: "symbolic-link",
    seed: async (root: ApplicationRootPath) => {
      const manifestPath = generationPaths(root).manifest;
      const target = path.join(root, "manifest-junction-target");
      await rm(manifestPath);
      await mkdir(target);
      await symlink(target, manifestPath, "junction");
    },
    expectedHealth: brokenHealth,
  },
  {
    name: "unsupported-newer",
    seed: async (root: ApplicationRootPath) => {
      await writeFile(generationPaths(root).manifest, '{"manifestVersion":2}\n');
    },
    expectedHealth: unsupportedNewerHealth,
  },
  ...manifestIdentityConflictCases.map(({ name, mutate }) => ({
    name: `identity-conflicting ${name}`,
    seed: (root: ApplicationRootPath) => seedManifestIdentityConflict(root, mutate),
    expectedHealth: identityConflictHealth,
  })),
] as const satisfies readonly Readonly<{
  name: string;
  seed(root: ApplicationRootPath): Promise<void>;
  failRead?: true;
  expectedHealth: ProjectDatabaseHealth;
}>[];

function seedContradictoryActiveLocation(root: ApplicationRootPath): string {
  const contradictoryLocationId = "00000000-0000-4000-8000-000000000098";
  const contradictoryPath = path.resolve(root, "contradictory-location");
  const database = new DatabaseSync(generationPaths(root).application);
  try {
    database
      .prepare(
        `INSERT INTO storage_locations
          (storage_id, location_id, normalized_path, location_state, observed_at)
          VALUES (?, ?, ?, 'staging', ?)`,
      )
      .run(
        fixedCreationIds.storageId,
        contradictoryLocationId,
        contradictoryPath,
        "2026-08-31T12:00:00.000Z",
      );
    database
      .prepare("UPDATE storage_registrations SET active_location_id = ? WHERE project_id = ?")
      .run(contradictoryLocationId, openRequest.projectId);
  } finally {
    database.close();
  }
  return contradictoryPath;
}

function seedActiveRegistrationTargetingStaging(root: ApplicationRootPath): void {
  const database = new DatabaseSync(generationPaths(root).application);
  try {
    database
      .prepare(
        `UPDATE storage_generations
          SET creation_state = 'staging', activated_at = NULL
          WHERE project_id = ? AND generation_id = ?`,
      )
      .run(openRequest.projectId, fixedCreationIds.generationId);
  } finally {
    database.close();
  }
}

const applicationOpeningFailureCases = [
  {
    name: "is unavailable",
    seed: async (root: ApplicationRootPath): Promise<StorageRuntimeOptions> => ({
      initializeApplicationClient: async () => {
        throw Object.assign(new Error(`${root}: injected application access failure`), {
          code: "EACCES",
        });
      },
    }),
    expectedStatus: "unavailable",
    expectedCode: "PROJECT_STORAGE_UNAVAILABLE",
    expectedMessage: "Project Storage authority is unavailable.",
  },
  {
    name: "has malformed metadata",
    seed: async (root: ApplicationRootPath): Promise<undefined> => {
      const database = new DatabaseSync(generationPaths(root).application);
      try {
        database.exec("UPDATE schema_metadata SET last_migration_id = '9999_unknown'");
      } finally {
        database.close();
      }
      return undefined;
    },
    expectedStatus: "broken",
    expectedCode: "PROJECT_STORAGE_OWNER_FAILED",
    expectedMessage: "Database migration authority is incompatible.",
  },
  // A known older head left this no-mutation table (user-approved option (ii), 2026-10-03):
  // the shared application database authority upgrades it before Storage opens, as the
  // registry already does. Unknown and newer heads stay here: broken, never mutated.
  {
    name: "has a newer application head",
    seed: async (root: ApplicationRootPath): Promise<undefined> => {
      const database = new DatabaseSync(generationPaths(root).application);
      try {
        database.exec("UPDATE schema_metadata SET schema_version = 2");
      } finally {
        database.close();
      }
      return undefined;
    },
    expectedStatus: "broken",
    expectedCode: "PROJECT_STORAGE_OWNER_FAILED",
    expectedMessage: "Database migration authority is incompatible.",
  },
  {
    name: "has malformed rows",
    seed: async (root: ApplicationRootPath): Promise<undefined> => {
      const database = new DatabaseSync(generationPaths(root).application);
      try {
        database.exec("PRAGMA ignore_check_constraints = ON");
        database
          .prepare("UPDATE storage_locations SET observed_at = 'invalid' WHERE storage_id = ?")
          .run(fixedCreationIds.storageId);
      } finally {
        database.close();
      }
      return undefined;
    },
    expectedStatus: "broken",
    expectedCode: "PROJECT_STORAGE_OWNER_FAILED",
    expectedMessage: "Project Storage opening authority is invalid.",
  },
  {
    name: "has disagreeing active pointers",
    seed: async (root: ApplicationRootPath): Promise<undefined> => {
      seedContradictoryActiveLocation(root);
      return undefined;
    },
    expectedStatus: "broken",
    expectedCode: "PROJECT_STORAGE_OWNER_FAILED",
    expectedMessage: "Project Storage authority is internally inconsistent.",
  },
  {
    name: "points active authority at a staging generation",
    seed: async (root: ApplicationRootPath): Promise<undefined> => {
      seedActiveRegistrationTargetingStaging(root);
      return undefined;
    },
    expectedStatus: "broken",
    expectedCode: "PROJECT_STORAGE_OWNER_FAILED",
    expectedMessage: "Project Storage authority is internally inconsistent.",
  },
] as const;

it.each(healthyOpeningCases)(
  "$name",
  async ({ seed }) => {
    const root = await createHealthyProjectStorageFixture();
    await seed(root);
    const before = await inspectDurableProjectStorageState(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      await expect(runtime.open(openRequest)).resolves.toMatchObject({
        event: "project.open.result",
        payload: {
          status: "opened",
          request: openRequest,
          mode: "read-write",
          identity: {
            storageId: fixedCreationIds.storageId,
            generationId: fixedCreationIds.generationId,
            canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
            runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
          },
          canonicalHealth: { status: "healthy" },
          runtimeHealth: { status: "healthy" },
        },
      });
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        event: "project.close.result",
        payload: { status: "closed", request: closeRequest },
      });
      const paths = generationPaths(root);
      for (const databasePath of [paths.canonical, paths.runtime]) {
        const releaseProbe = `${databasePath}.release-probe`;
        await rename(databasePath, releaseProbe);
        await rename(releaseProbe, databasePath);
      }
    } finally {
      await runtime.stop();
    }

    expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it.each(openingHealthCases)(
  "classifies $name independently without mutation",
  async ({ seed, expectedIdentity, expectedCanonical, expectedRuntime }) => {
    const root = await createHealthyProjectStorageFixture();
    const runtimeOptions = await seed(root);
    await expectSafeModeWithoutMutation({
      root,
      ...(runtimeOptions === undefined ? {} : { runtimeOptions }),
      identity: expectedIdentity,
      canonicalHealth: expectedCanonical,
      runtimeHealth: expectedRuntime,
    });
  },
  projectStorageIntegrationTimeout,
);

it.each(manifestHealthCases)(
  "opens in retained safe mode when the selected manifest is $name",
  async ({ seed, expectedHealth, ...manifestCase }) => {
    const root = await createHealthyProjectStorageFixture();
    await seed(root);
    const before = await inspectDurableProjectStorageState(root);
    if ("failRead" in manifestCase) {
      manifestReadFailure.filePath = generationPaths(root).manifest;
    }
    const databaseOpenCalls: ("canonical" | "runtime-adapter")[] = [];
    const runtime = await createStorageRuntimeForRoot(root, {
      openProjectDatabaseClient: ({ databaseKind, open }) => {
        databaseOpenCalls.push(databaseKind);
        return open();
      },
    });
    let result: unknown;
    try {
      result = await runtime.open(openRequest);
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        event: "project.close.result",
        payload: { status: "closed", request: closeRequest },
      });
    } finally {
      manifestReadFailure.filePath = undefined;
      await runtime.stop();
    }

    expect(result).toMatchObject({ event: "project.open.result" });
    expect(payloadOf(result)).toEqual({
      status: "safe-mode",
      request: openRequest,
      mode: "safe-mode",
      identity: openedIdentity,
      canonicalHealth: expectedHealth,
      runtimeHealth: expectedHealth,
    });
    expectNotToExpose(result, root);
    expectNotToExpose(result, "injected manifest access failure");
    expect(databaseOpenCalls).toEqual([]);
    expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "reports corrupt when a known-older database also fails integrity",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    await seedGenerationOneCanonical(root);
    await seedCanonicalIntegrityFailure(root);
    await expectSafeModeWithoutMutation({
      root,
      identity: openedIdentity,
      canonicalHealth: corruptHealth,
      runtimeHealth: healthyHealth,
    });
  },
  projectStorageIntegrationTimeout,
);

it.each(applicationOpeningFailureCases)(
  "keeps application authority $name distinct from absence",
  async ({ seed, expectedStatus, expectedCode, expectedMessage }) => {
    const root = await createHealthyProjectStorageFixture();
    const runtimeOptions = await seed(root);
    const before = await inspectDurableProjectStorageState(root);
    const runtime = await createStorageRuntimeForRoot(root, runtimeOptions);
    let result: unknown;
    try {
      result = await runtime.open(openRequest);
    } finally {
      await runtime.stop();
    }

    expect(result).toMatchObject({ event: "project.open.result" });
    expect(payloadOf(result)).toEqual({
      status: expectedStatus,
      request: openRequest,
      diagnostic: { code: expectedCode, message: expectedMessage },
    });
    expectNotToExpose(result, root);
    expectNotToExpose(result, "injected application access failure");
    expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "upgrades known older application authority before creating",
  async () => {
    // Real historical head instead of a synthetic successor (user-approved option (ii)).
    const root = await createTemporaryApplicationRoot();
    await createPreviousRegistry(root);
    const before = readPreviousRegistrations(root);
    const runtime = await createStorageRuntimeForRoot(root);
    try {
      await expect(runtime.create(applicationUpgradeCreateRequest)).resolves.toMatchObject({
        event: "project.create.result",
        payload: { status: "created", request: applicationUpgradeCreateRequest },
      });
    } finally {
      await runtime.stop();
    }

    expect(readApplicationHead(root)).toEqual({
      last_migration_id: "0006_registration_list_visibility",
    });
    expect(readPreviousRegistrations(root)).toEqual(
      expect.arrayContaining(before.map((row) => expect.objectContaining(row))),
    );
  },
  projectStorageIntegrationTimeout,
);

// Storage open upgrades a known older application head through the shared authority
// (user-approved option (ii) with PC-B8). A failed upgrade before commit leaving the old
// schema exact is covered by project-registration.integration.test.ts checkpoint cases.
it(
  "upgrades a known older application authority on open instead of treating it as absent",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createPreviousRegistry(root);
    const before = readPreviousRegistrations(root);
    // Another Project's files: the upgrade and the opening must leave them byte-identical.
    const projectFile = path.join(
      root,
      "projects",
      "5b0d2e64-8a39-4f5e-9d1c-2f3a4b5c6d7e",
      "untouched.bin",
    );
    await mkdir(path.dirname(projectFile), { recursive: true });
    await writeFile(projectFile, Buffer.from("project bytes the opening must not touch"));
    const projectBytes = await readFile(projectFile);
    const request = decodeStrict(ProjectStorageOpenRequestSchema, {
      projectId: previousRegistryProjectId,
    });
    const runtime = await createStorageRuntimeForRoot(root);
    let result: unknown;
    try {
      result = await runtime.open(request);
    } finally {
      await runtime.stop();
    }

    // The migrated registration (no generation yet) needs recovery: never absent.
    expect(payloadOf(result)).toEqual({
      status: "safe-mode",
      request,
      mode: "safe-mode",
      identity: {
        storageId: before[0]?.["storage_id"],
        generationId: null,
        canonicalDatabaseLineageId: null,
        runtimeDatabaseLineageId: null,
      },
      canonicalHealth: recoveryRequiredHealth,
      runtimeHealth: recoveryRequiredHealth,
    });
    expect(readApplicationHead(root)).toEqual({
      last_migration_id: "0006_registration_list_visibility",
    });
    expect(readPreviousRegistrations(root)).toEqual(before);
    expect(await readFile(projectFile)).toEqual(projectBytes);
  },
  projectStorageIntegrationTimeout,
);

it(
  "checks application integrity before returning Project recovery evidence",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const application = new DatabaseSync(generationPaths(root).application);
    try {
      application.exec("PRAGMA foreign_keys = OFF");
      application
        .prepare(
          `DELETE FROM storage_locations
            WHERE storage_id = ? AND location_id = ?`,
        )
        .run(fixedCreationIds.storageId, fixedCreationIds.locationId);
      expect(application.prepare("PRAGMA foreign_key_check").all().length).toBeGreaterThan(0);
    } finally {
      application.close();
    }
    await expectBrokenOpenWithoutMutation({
      root,
      runtimeOptions: { openProjectDatabaseClient: rejectProjectDatabaseOpen },
      expectedPayload: {
        status: "broken",
        request: openRequest,
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: "Project Storage application authority has foreign-key violations.",
        },
      },
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "treats contradictory active location authority as broken without mutation",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const contradictoryPath = seedContradictoryActiveLocation(root);
    await mkdir(
      path.join(generationPaths(root).project, ".staging-00000000-0000-4000-8000-000000000097"),
    );
    await expectBrokenOpenWithoutMutation({
      root,
      expectedPayload: {
        status: "broken",
        request: openRequest,
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: "Project Storage authority is internally inconsistent.",
        },
      },
      hiddenValues: [contradictoryPath],
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "requires recovery when an orphan generation accompanies the active generation",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    await mkdir(path.join(generationPaths(root).project, "00000000-0000-4000-8000-000000000099"));
    await expectSafeModeWithoutMutation({
      root,
      runtimeOptions: { openProjectDatabaseClient: rejectProjectDatabaseOpen },
      identity: openedIdentity,
      canonicalHealth: recoveryRequiredHealth,
      runtimeHealth: recoveryRequiredHealth,
    });
  },
  projectStorageIntegrationTimeout,
);

it.each(["slopstop.db", "mastra.db-wal"] as const)(
  "requires recovery for root-level %s witness beside the active generation",
  async (filename) => {
    const root = await createHealthyProjectStorageFixture();
    await writeFile(path.join(generationPaths(root).project, filename), "witness", { flag: "wx" });
    await expectSafeModeWithoutMutation({
      root,
      runtimeOptions: { openProjectDatabaseClient: rejectProjectDatabaseOpen },
      identity: openedIdentity,
      canonicalHealth: recoveryRequiredHealth,
      runtimeHealth: recoveryRequiredHealth,
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "opens in safe mode when the canonical database is missing",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const paths = generationPaths(root);
    await rm(paths.canonical);
    const before = await inspectDurableProjectStorageState(root);
    const runtime = await createStorageRuntimeForRoot(root);

    try {
      await expect(runtime.open(openRequest)).resolves.toMatchObject({
        event: "project.open.result",
        payload: {
          status: "safe-mode",
          request: openRequest,
          mode: "safe-mode",
          identity: {
            storageId: fixedCreationIds.storageId,
            generationId: fixedCreationIds.generationId,
            canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
            runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
          },
          canonicalHealth: {
            status: "missing",
            diagnostic: {
              code: "DATABASE_MISSING",
              message: "Expected database state is missing.",
            },
          },
          runtimeHealth: { status: "healthy" },
        },
      });
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        event: "project.close.result",
        payload: { status: "closed", request: closeRequest },
      });
      const releaseProbe = `${paths.runtime}.release-probe`;
      await rename(paths.runtime, releaseProbe);
      await rename(releaseProbe, paths.runtime);
    } finally {
      await runtime.stop();
    }

    expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  },
  projectStorageIntegrationTimeout,
);

it(
  "maps recognized SQLite not-a-database failure only to corrupt",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const paths = generationPaths(root);
    await writeFile(paths.canonical, "not a sqlite database");
    await expectExistingCanonicalSafeMode({
      root,
      canonicalHealth: {
        status: "corrupt",
        diagnostic: {
          code: "DATABASE_CORRUPT",
          message: "Database integrity validation failed.",
        },
      },
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "maps an unexpected probe SQL failure to the stable broken diagnostic",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    const paths = generationPaths(root);
    const database = new DatabaseSync(paths.canonical);
    try {
      database.exec("DROP TABLE schema_metadata");
    } finally {
      database.close();
    }
    await expectExistingCanonicalSafeMode({
      root,
      canonicalHealth: {
        status: "broken",
        diagnostic: {
          code: "DATABASE_BROKEN",
          message: "Database authority is internally inconsistent.",
        },
      },
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "opens in safe mode when canonical authority is newer than supported",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    await seedNewerCanonicalAuthority(root);
    await expectExistingCanonicalSafeMode({
      root,
      canonicalHealth: {
        status: "unsupported-newer",
        diagnostic: {
          code: "DATABASE_UNSUPPORTED_NEWER",
          message: "Database version is newer than supported.",
        },
      },
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "opens in safe mode when canonical identity conflicts with registry authority",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    seedConflictingCanonicalIdentity(root);
    await expectExistingCanonicalSafeMode({
      root,
      canonicalHealth: {
        status: "identity-conflict",
        diagnostic: {
          code: "DATABASE_IDENTITY_CONFLICT",
          message: "Database identity does not agree.",
        },
      },
    });
  },
  projectStorageIntegrationTimeout,
);
