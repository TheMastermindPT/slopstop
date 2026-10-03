import { lstat, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  decodeStrict,
  type OpenedStorageIdentity,
  type ProjectDatabaseHealth,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { expect } from "vitest";
import {
  parseProjectStorageManifest,
  serializeProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import {
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  fixedCreationIds,
  pathExists,
  sha256File,
} from "./project-storage-create-fixture.js";

export const openRequest = decodeStrict(ProjectStorageOpenRequestSchema, {
  projectId: createRequest.projectId,
});
export const closeRequest = decodeStrict(ProjectStorageCloseRequestSchema, {
  projectId: createRequest.projectId,
});
export const recoveryRequiredHealth = {
  status: "recovery-required",
  diagnostic: {
    code: "DATABASE_RECOVERY_REQUIRED",
    message: "Database recovery is required.",
  },
} as const;
export const healthyHealth = { status: "healthy" } as const satisfies ProjectDatabaseHealth;
export const migrationRequiredHealth = {
  status: "migration-required",
  diagnostic: {
    code: "DATABASE_MIGRATION_REQUIRED",
    message: "Database migration is required.",
  },
} as const satisfies ProjectDatabaseHealth;
export const missingHealth = {
  status: "missing",
  diagnostic: {
    code: "DATABASE_MISSING",
    message: "Expected database state is missing.",
  },
} as const satisfies ProjectDatabaseHealth;
export const corruptHealth = {
  status: "corrupt",
  diagnostic: {
    code: "DATABASE_CORRUPT",
    message: "Database integrity validation failed.",
  },
} as const satisfies ProjectDatabaseHealth;
export const identityConflictHealth = {
  status: "identity-conflict",
  diagnostic: {
    code: "DATABASE_IDENTITY_CONFLICT",
    message: "Database identity does not agree.",
  },
} as const satisfies ProjectDatabaseHealth;
export const unsupportedNewerHealth = {
  status: "unsupported-newer",
  diagnostic: {
    code: "DATABASE_UNSUPPORTED_NEWER",
    message: "Database version is newer than supported.",
  },
} as const satisfies ProjectDatabaseHealth;
export const unavailableHealth = {
  status: "unavailable",
  diagnostic: {
    code: "DATABASE_UNAVAILABLE",
    message: "Database could not be inspected.",
  },
} as const satisfies ProjectDatabaseHealth;
export const brokenHealth = {
  status: "broken",
  diagnostic: {
    code: "DATABASE_BROKEN",
    message: "Database authority is internally inconsistent.",
  },
} as const satisfies ProjectDatabaseHealth;
export const openedIdentity = {
  storageId: fixedCreationIds.storageId,
  generationId: fixedCreationIds.generationId,
  canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
  runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
};

export type ApplicationRootPath = string;
type StorageArtifactPath = string;
type SensitiveValue = string;
export type StorageRuntimeOptions = NonNullable<Parameters<typeof createStorageRuntimeForRoot>[1]>;
type OpeningIdentity = {
  readonly [Key in keyof OpenedStorageIdentity]: OpenedStorageIdentity[Key] | null;
};
export type OpeningHealthCase = Readonly<{
  name: string;
  seed(root: ApplicationRootPath): Promise<StorageRuntimeOptions | undefined>;
  expectedIdentity: OpeningIdentity;
  expectedCanonical: ProjectDatabaseHealth;
  expectedRuntime: ProjectDatabaseHealth;
}>;
type SafeModeExpectation = Readonly<{
  root: ApplicationRootPath;
  runtimeOptions?: StorageRuntimeOptions;
  identity: OpeningIdentity;
  canonicalHealth: ProjectDatabaseHealth;
  runtimeHealth: ProjectDatabaseHealth;
  hiddenValues?: readonly string[];
  verifyDatabaseRelease?: boolean;
}>;
type ExistingCanonicalSafeModeExpectation = Readonly<{
  root: ApplicationRootPath;
  canonicalHealth: Extract<
    ProjectDatabaseHealth,
    { status: "corrupt" | "identity-conflict" | "unsupported-newer" | "broken" }
  >;
}>;

export const rejectProjectDatabaseOpen: NonNullable<
  StorageRuntimeOptions["openProjectDatabaseClient"]
> = () => {
  throw new Error("Project database opening was not expected.");
};

export function payloadOf(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "payload")
    : undefined;
}

export function expectNotToExpose(value: unknown, secret: SensitiveValue): void {
  const encodedSecret = JSON.stringify(secret).slice(1, -1);
  expect(JSON.stringify(value)).not.toContain(encodedSecret);
}

export function generationPaths(root: ApplicationRootPath) {
  const generation = path.join(
    root,
    "projects",
    createRequest.projectId,
    fixedCreationIds.generationId,
  );
  return {
    application: path.join(root, "application.db"),
    project: path.dirname(generation),
    generation,
    manifest: path.join(generation, "manifest.json"),
    canonical: path.join(generation, "slopstop.db"),
    runtime: path.join(generation, "mastra.db"),
  };
}

export async function createHealthyProjectStorageFixture(): Promise<ApplicationRootPath> {
  const root = await createTemporaryApplicationRoot();
  const runtime = await createStorageRuntimeForRoot(root);
  try {
    await expect(runtime.create(createRequest)).resolves.toMatchObject({
      event: "project.create.result",
      payload: { status: "created" },
    });
  } finally {
    await runtime.stop();
  }
  return root;
}

export async function initializeApplicationAuthority(root: ApplicationRootPath): Promise<void> {
  const initializer = await createStorageRuntimeForRoot(root);
  const request = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: "00000000-0000-4000-8000-000000000050",
    createRequestId: "00000000-0000-4000-8000-000000000051",
  });
  await expect(initializer.create(request)).resolves.toMatchObject({
    payload: { status: "created" },
  });
  await initializer.stop();
}

export async function mutateCanonicalBytesWithoutChangingAuthority(
  root: ApplicationRootPath,
): Promise<void> {
  const paths = generationPaths(root);
  const manifest = parseProjectStorageManifest(await readFile(paths.manifest, "utf8"));
  const database = new DatabaseSync(paths.canonical);
  try {
    database.exec("PRAGMA user_version = 1");
  } finally {
    database.close();
  }
  await expect(sha256File(paths.canonical)).resolves.not.toBe(
    manifest.canonical.activationBaseline.sha256,
  );
}

async function inspectManifestState(manifestPath: StorageArtifactPath) {
  if (!(await pathExists(manifestPath))) return null;
  const entry = await lstat(manifestPath);
  if (entry.isFile()) return readFile(manifestPath, "utf8");
  return { directory: entry.isDirectory(), symbolicLink: entry.isSymbolicLink() };
}

async function hashIfPresent(filePath: StorageArtifactPath): Promise<string | null> {
  return (await pathExists(filePath)) ? sha256File(filePath) : null;
}

export async function inspectDurableProjectStorageState(root: ApplicationRootPath) {
  const paths = generationPaths(root);
  const [
    application,
    manifest,
    canonical,
    runtime,
    rootEntries,
    projectEntries,
    generationEntries,
  ] = await Promise.all([
    sha256File(paths.application),
    inspectManifestState(paths.manifest),
    hashIfPresent(paths.canonical),
    hashIfPresent(paths.runtime),
    readdir(root),
    readdir(paths.project),
    readdir(paths.generation),
  ]);
  return {
    application,
    manifest,
    canonical,
    runtime,
    rootEntries: rootEntries.sort(),
    projectEntries: projectEntries.sort(),
    generationEntries: generationEntries.sort(),
  };
}

export async function expectSafeModeWithoutMutation({
  root,
  runtimeOptions,
  identity,
  canonicalHealth,
  runtimeHealth,
  hiddenValues = [],
  verifyDatabaseRelease = false,
}: SafeModeExpectation): Promise<void> {
  const paths = generationPaths(root);
  const before = await inspectDurableProjectStorageState(root);
  const runtime = await createStorageRuntimeForRoot(root, runtimeOptions);
  try {
    const result = await runtime.open(openRequest);
    expect(result).toMatchObject({ event: "project.open.result" });
    expect(payloadOf(result)).toEqual({
      status: "safe-mode",
      request: openRequest,
      mode: "safe-mode",
      identity,
      canonicalHealth,
      runtimeHealth,
    });
    expectNotToExpose(result, root);
    for (const hiddenValue of hiddenValues) expectNotToExpose(result, hiddenValue);
    if (verifyDatabaseRelease) {
      await expect(runtime.close(closeRequest)).resolves.toMatchObject({
        event: "project.close.result",
        payload: { status: "closed", request: closeRequest },
      });
      for (const databasePath of [paths.canonical, paths.runtime]) {
        const releaseProbe = `${databasePath}.release-probe`;
        await rename(databasePath, releaseProbe);
        await rename(releaseProbe, databasePath);
      }
    }
  } finally {
    await runtime.stop();
  }
  expect(await inspectDurableProjectStorageState(root)).toEqual(before);
}

export function expectExistingCanonicalSafeMode({
  root,
  canonicalHealth,
}: ExistingCanonicalSafeModeExpectation): Promise<void> {
  return expectSafeModeWithoutMutation({
    root,
    identity: openedIdentity,
    canonicalHealth,
    runtimeHealth: healthyHealth,
    verifyDatabaseRelease: true,
  });
}

export async function seedNewerCanonicalAuthority(root: ApplicationRootPath): Promise<void> {
  const paths = generationPaths(root);
  const manifest = parseProjectStorageManifest(await readFile(paths.manifest, "utf8"));
  await writeFile(
    paths.manifest,
    serializeProjectStorageManifest({
      ...manifest,
      canonical: { ...manifest.canonical, formatVersion: 2, schemaVersion: 2 },
    }),
  );
  const database = new DatabaseSync(paths.canonical);
  try {
    database.exec("UPDATE schema_metadata SET format_version = 2, schema_version = 2");
  } finally {
    database.close();
  }
}

export function seedConflictingCanonicalIdentity(root: ApplicationRootPath): void {
  const database = new DatabaseSync(generationPaths(root).canonical);
  try {
    database.exec(
      `UPDATE storage_identity
        SET canonical_database_lineage_id = '00000000-0000-4000-8000-000000000091'`,
    );
  } finally {
    database.close();
  }
}

export async function inspectFilesystemOnlyProject(root: ApplicationRootPath) {
  const projectRoot = path.join(root, "projects", openRequest.projectId);
  const witnessPath = path.join(projectRoot, "slopstop.db-wal");
  const [rootEntries, projectEntries, witness] = await Promise.all([
    readdir(root),
    readdir(projectRoot),
    readFile(witnessPath, "utf8"),
  ]);
  return {
    applicationExists: await pathExists(path.join(root, "application.db")),
    rootEntries: rootEntries.sort(),
    projectEntries: projectEntries.sort(),
    witness,
  };
}

export async function inspectApplicationStorageRoot(root: ApplicationRootPath) {
  const projectRoot = path.join(root, "projects", openRequest.projectId);
  const applicationPath = path.join(root, "application.db");
  const projectsRoot = path.join(root, "projects");
  const [applicationExists, projectsExist, rootEntries, targetExists] = await Promise.all([
    pathExists(applicationPath),
    pathExists(projectsRoot),
    readdir(root),
    pathExists(projectRoot),
  ]);
  return {
    application: applicationExists ? await sha256File(applicationPath) : null,
    rootEntries: rootEntries.sort(),
    projectEntries: projectsExist ? (await readdir(projectsRoot)).sort() : null,
    targetExists,
  };
}
