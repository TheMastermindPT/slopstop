import { lstat } from "node:fs/promises";
import path from "node:path";
import type { InitialRepositoryBinding } from "@slopstop/protocol";
import { requireDeclaredSchemaObjects } from "./database-schema-verifier.js";
import { applyGeneratedMigrations, type GeneratedMigration } from "./generated-migrations.js";
import { seedInitialRepositoryBinding } from "./initial-repository-binding.js";
import {
  createMigrationTarget,
  databaseIdentityMatches,
  insertDatabaseIdentity,
  requireCurrentMetadata,
  requireDatabaseIntegrity,
  requireForeignKeys,
} from "./project-storage-database-authority.js";
import { type DatabaseSpec, databaseSpecs } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { readPlainFile, sha256File } from "./project-storage-file-adapter.js";
import { lstatIfPresent, requirePlainEntry } from "./project-storage-filesystem-authority.js";
import {
  type ProjectStorageManifest,
  parseProjectStorageManifest,
} from "./project-storage-manifest.js";
import {
  type AllocatedCreation,
  assertRowsAffected,
  createLocalClient,
  type LocalClient,
  normalizeStorageError,
  type ProjectStorageGenerationPaths,
} from "./project-storage-node-support.js";
import { expectedOpeningMetadata, openingMetadataAgrees } from "./project-storage-opening.js";
import {
  type ManifestIdentityAuthority,
  manifestIdentityMatches,
} from "./project-storage-opening-manifest.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";

type ClosedDatabaseBuild = Awaited<
  ReturnType<ProjectStorageStoreDependencies["databases"]["createCanonical"]>
>;

async function insertCanonicalProjectState(
  client: LocalClient,
  creation: AllocatedCreation,
): Promise<void> {
  const result = await client.execute({
    sql: `INSERT INTO project_state
      (project_id, last_project_sequence, last_writer_generation, created_at, updated_at)
      VALUES (?, 0, 0, ?, ?)`,
    args: [creation.projectId, creation.createdAt, creation.createdAt],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Project state was not inserted exactly once.");
}

export async function buildDatabase(
  databasePath: string,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
  initialBinding?: InitialRepositoryBinding,
): Promise<ClosedDatabaseBuild> {
  try {
    await requirePlainEntry({
      entryPath: path.dirname(databasePath),
      message: "Database creation directory is unavailable.",
      kind: "directory",
    });
    if ((await lstatIfPresent({ targetPath: databasePath })) !== undefined) {
      throw new ProjectStorageBrokenError("Database creation target already exists.");
    }
    const client = createLocalClient(databasePath, "generation");
    try {
      await requireForeignKeys(client);
      const migrations = await loadMigrations(spec);
      await applyGeneratedMigrations({
        target: createMigrationTarget(client, spec),
        expectedKind: spec.databaseKind,
        expectedFormatVersion: spec.formatVersion,
        expectedSchemaVersion: spec.schemaVersion,
        migrations,
      });
      if (spec.databaseKind === "canonical") await insertCanonicalProjectState(client, creation);
      if (spec.databaseKind === "canonical" && initialBinding !== undefined)
        await seedInitialRepositoryBinding(client, creation, initialBinding);
      await insertDatabaseIdentity(client, spec, creation);
      await requireDeclaredSchemaObjects(client, spec);
      const metadata = await requireCurrentMetadata(client, spec, migrations);
      if (!(await databaseIdentityMatches(client, spec, creation))) {
        throw new ProjectStorageBrokenError("Database identity does not agree.");
      }
      await requireDatabaseIntegrity(client);
      return {
        state: "closed",
        formatVersion: metadata.formatVersion,
        schemaVersion: metadata.schemaVersion,
        lastMigrationId: metadata.lastMigrationId,
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    normalizeStorageError(error, "Database creation failed.");
  }
}

async function verifyOwnedDatabase(
  databasePath: string,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
  manifest: ProjectStorageManifest,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<void> {
  await requirePlainEntry({
    entryPath: databasePath,
    message: "Sealed database is unavailable.",
    kind: "file",
  });
  const client = createLocalClient(databasePath, "generation");
  try {
    await requireForeignKeys(client);
    const migrations = await loadMigrations(spec);
    const metadata = await requireCurrentMetadata(client, spec, migrations);
    if (!openingMetadataAgrees(metadata, expectedOpeningMetadata(spec.databaseKind, manifest))) {
      throw new ProjectStorageBrokenError("Database metadata disagrees with the manifest.");
    }
    if (!(await databaseIdentityMatches(client, spec, creation))) {
      throw new ProjectStorageBrokenError("Database identity does not agree.");
    }
    await requireDeclaredSchemaObjects(client, spec);
    await requireDatabaseIntegrity(client);
  } finally {
    await client.close();
  }
}

function requireManifestIdentity(input: {
  manifest: ProjectStorageManifest;
  creation: ManifestIdentityAuthority;
}): void {
  if (!manifestIdentityMatches({ manifest: input.manifest, authority: input.creation })) {
    throw new ProjectStorageBrokenError("Project Storage manifest identity does not agree.");
  }
}

async function requireActivationBaseline(input: {
  paths: ProjectStorageGenerationPaths;
  manifest: ProjectStorageManifest;
}): Promise<void> {
  const [canonicalEntry, runtimeEntry, canonicalHash, runtimeHash] = await Promise.all([
    lstat(input.paths.canonicalDatabase),
    lstat(input.paths.runtimeDatabase),
    sha256File({ filePath: input.paths.canonicalDatabase }),
    sha256File({ filePath: input.paths.runtimeDatabase }),
  ]);
  const agrees = [
    !canonicalEntry.isSymbolicLink(),
    canonicalEntry.isFile(),
    !runtimeEntry.isSymbolicLink(),
    runtimeEntry.isFile(),
    canonicalEntry.size === input.manifest.canonical.activationBaseline.sizeBytes,
    canonicalHash === input.manifest.canonical.activationBaseline.sha256,
    runtimeEntry.size === input.manifest.runtime.activationBaseline.sizeBytes,
    runtimeHash === input.manifest.runtime.activationBaseline.sha256,
  ].every(Boolean);
  if (!agrees) {
    throw new ProjectStorageBrokenError("Sealed database activation baseline does not agree.");
  }
}

export async function verifySealedGeneration(
  paths: ProjectStorageGenerationPaths,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<void> {
  try {
    await requirePlainEntry({
      entryPath: paths.root,
      message: "Project Storage generation is unavailable.",
      kind: "directory",
    });
    const manifestSource = await readPlainFile({
      filePath: paths.manifest,
      message: "Project Storage manifest is unavailable.",
    });
    const manifest = parseProjectStorageManifest(manifestSource.toString("utf8"));
    requireManifestIdentity({ manifest, creation });
    await verifyOwnedDatabase(
      paths.canonicalDatabase,
      databaseSpecs.canonical,
      creation,
      manifest,
      loadMigrations,
    );
    await verifyOwnedDatabase(
      paths.runtimeDatabase,
      databaseSpecs.runtime,
      creation,
      manifest,
      loadMigrations,
    );
    await requireActivationBaseline({ paths, manifest });
  } catch (error) {
    normalizeStorageError(error, "Project Storage sealed generation verification failed.");
  }
}
