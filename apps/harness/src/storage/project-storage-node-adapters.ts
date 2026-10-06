import { createHash, randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import path from "node:path";
import {
  CanonicalDatabaseLineageIdSchema,
  decodeStrict,
  type ProjectId,
  ProjectIdSchema,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import {
  type ApplicationDatabaseAuthority,
  createApplicationDatabaseAuthority,
} from "./application-database-authority.js";
import { ApplicationDatabaseFault } from "./application-database-migration.js";
import {
  requireDeclaredSchemaObjects,
  requireOwnedSchemaObjects,
  tableNames,
} from "./database-schema-verifier.js";
import { loadGeneratedMigrations } from "./generated-migration-resources.js";
import {
  applyGeneratedMigrations,
  type GeneratedMigration,
  type GeneratedMigrationTarget,
  type MigrationAuthority,
} from "./generated-migrations.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlResultSet,
  type LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";
import { createApplicationClientManager } from "./project-storage-application-client.js";
import { projectStorageCreateRequestFingerprintInput } from "./project-storage-create-request.js";
import { type DatabaseSpec, databaseSpecs } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  createProjectStorageFileAdapter,
  sha256File as hashNodeStorageFile,
  readPlainFile as readNodeStorageFile,
} from "./project-storage-file-adapter.js";
import {
  type FilesystemWitnessScan,
  inspectFilesystemWitnesses,
  lstatIfPresent as inspectPathIfPresent,
  openingDatabaseIsPresent,
  requirePlainEntry,
  witnessOrder,
} from "./project-storage-filesystem-authority.js";
import {
  canonicalDatabaseFilename,
  canonicalWriterLeaseFilename,
  type ProjectStorageManifest,
  parseProjectStorageManifest,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
} from "./project-storage-manifest.js";
import {
  isCorruptStorageError,
  isUnavailableStorageError,
  normalizeStorageError as normalizeNodeStorageError,
} from "./project-storage-node-errors.js";
import {
  type Activation,
  activationSchema,
  canonicalIdentityRowSchema,
  type GenerationRow,
  generationRowColumns,
  generationRowSchema,
  integerScalar,
  type LocationRow,
  locationRowSchema,
  type MetadataRow,
  metadataRowSchema,
  privateLocationIdSchema,
  type RegistrationRow,
  registrationRowSchema,
  resultObjects,
  runtimeIdentityRowSchema,
  type StagingDeclaration,
  stagingDeclarationSchema,
  utcInstantSchema,
} from "./project-storage-node-schemas.js";
import {
  compatibilityPrecedesIntegrity,
  createOpeningRelease,
  expectedOpeningMetadata,
  inspectOpeningMetadata,
  inspectRegisteredRecovery,
  inspectUnregisteredOpening,
  type OpeningInspection,
  openingFailureAfterRelease,
  openingWithoutApplication,
  type ProjectDatabaseProbe,
  type ProjectStorageOpenEvidence,
  presentProjectDatabaseProbe,
  recoveryOpeningIdentity,
} from "./project-storage-opening.js";
import {
  inspectOpeningManifest,
  type ManifestIdentityAuthority,
  manifestIdentityMatches,
} from "./project-storage-opening-manifest.js";
import type {
  PriorStateWitnessKind,
  ProjectStorageStoreDependencies,
} from "./project-storage-store.js";
import { withWriteTransaction } from "./project-storage-transaction.js";

export { requireDeclaredSchemaObjects } from "./database-schema-verifier.js";
export { loadGeneratedMigrations } from "./generated-migration-resources.js";
export type { DatabaseSpec } from "./project-storage-database-specs.js";
export { databaseSpecs } from "./project-storage-database-specs.js";
export { withWriteTransaction } from "./project-storage-transaction.js";

type LocalClient = LocalLibsqlClient;
type LocalTransaction = LocalLibsqlTransaction;
type AllocatedCreation = Parameters<
  ProjectStorageStoreDependencies["registry"]["declareStaging"]
>[0];
type ProjectStorageGenerationPaths = Parameters<
  ProjectStorageStoreDependencies["databases"]["verifySealed"]
>[0];
type ClosedDatabaseBuild = Awaited<
  ReturnType<ProjectStorageStoreDependencies["databases"]["createCanonical"]>
>;
type CreateInspection = Awaited<
  ReturnType<ProjectStorageStoreDependencies["registry"]["inspectCreate"]>
>;
type ProjectLockEntry = { lock: PermitLock; users: number };
type OpeningSelection = Readonly<{
  identity: Extract<ProjectStorageOpenEvidence, { status: "selected-current" }>["identity"];
  generation: GenerationRow;
  paths: ProjectStorageGenerationPaths;
  completedUpgrade: CompletedUpgrade | undefined;
}>;
type HealthyOpeningSelectionInput = Readonly<{
  client: LocalClient;
  projectId: ProjectId;
  normalizedProjectRoot: string;
  filesystem: FilesystemWitnessScan;
  paths: ProjectStorageStoreDependencies["paths"];
}>;
type MutableOpeningClients = {
  canonical: LocalClient | undefined;
  runtime: LocalClient | undefined;
};

const maximumRegistryGenerationsPerProject = 256;

export type NodeProjectStorageOptions = Readonly<{
  initialRepositoryBinding?: InitialRepositoryBinding;
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
  applicationVersion: string;
  ids?: ProjectStorageStoreDependencies["ids"];
  clock?: ProjectStorageStoreDependencies["clock"];
  failures?: ProjectStorageStoreDependencies["failures"];
  upgradeDiagnostics?: ProjectStorageUpgradeDiagnostics;
  initializeApplicationClient?: (client: LocalClient) => Promise<void>;
  // The harness's shared application database authority; a standalone owner gets its own.
  applicationDatabase?: ApplicationDatabaseAuthority;
  openProjectDatabaseClient?: (input: {
    databaseKind: "canonical" | "runtime-adapter";
    open(): LocalLibsqlClient;
  }) => LocalLibsqlClient;
}>;

function createLocalClient(databasePath: string, pool: "application" | "generation"): LocalClient {
  return createWorkerLocalLibsqlClient(databasePath, pool);
}

function normalizeStorageError(error: unknown, message: string): never {
  normalizeNodeStorageError({ error, message });
}

function lstatIfPresent(targetPath: string) {
  return inspectPathIfPresent({ targetPath });
}

async function requirePlainDirectory(directoryPath: string, message: string): Promise<void> {
  await requirePlainEntry({
    entryPath: directoryPath,
    message,
    kind: "directory",
  });
}

async function requirePlainFile(filePath: string, message: string): Promise<void> {
  await requirePlainEntry({ entryPath: filePath, message, kind: "file" });
}

function exactlyOne<Output>(rows: readonly Output[], message: string): Output {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw new ProjectStorageBrokenError(message);
  }
  return row;
}

async function metadataRows(
  client: LocalClient | LocalTransaction,
  spec: DatabaseSpec,
): Promise<readonly MetadataRow[]> {
  const result = await client.execute(
    `SELECT metadata_key AS metadataKey, database_kind AS databaseKind,
      format_version AS formatVersion, schema_version AS schemaVersion,
      last_migration_id AS lastMigrationId FROM ${spec.metadataTable}`,
  );
  return decodeStrict(Schema.Array(metadataRowSchema), resultObjects(result));
}

function migrationMetadataSql(spec: DatabaseSpec): string {
  return `INSERT INTO ${spec.metadataTable}
    (metadata_key, database_kind, format_version, schema_version, last_migration_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(metadata_key) DO UPDATE SET
      database_kind = excluded.database_kind,
      format_version = excluded.format_version,
      schema_version = excluded.schema_version,
      last_migration_id = excluded.last_migration_id`;
}

function createMigrationTarget(client: LocalClient, spec: DatabaseSpec): GeneratedMigrationTarget {
  return {
    inspectAuthority: async (): Promise<MigrationAuthority> => {
      const names = await tableNames(client);
      if (!names.includes(spec.metadataTable)) {
        if (names.length === 0) return { status: "fresh" };
        throw new ProjectStorageBrokenError("Database metadata authority is missing.");
      }
      const metadata = exactlyOne(
        await metadataRows(client, spec),
        "Database metadata authority must contain exactly one row.",
      );
      if (metadata.metadataKey !== spec.metadataKey) {
        throw new ProjectStorageBrokenError("Database metadata singleton key is invalid.");
      }
      return {
        status: "existing",
        databaseKind: metadata.databaseKind,
        formatVersion: metadata.formatVersion,
        schemaVersion: metadata.schemaVersion,
        lastMigrationId: metadata.lastMigrationId,
      };
    },
    applyBatch: async (input) => {
      await withWriteTransaction(client, async (transaction) => {
        for (const migration of input.migrations) {
          for (const statement of migration.statements) {
            await transaction.execute(statement);
          }
        }
        await transaction.execute({
          sql: migrationMetadataSql(spec),
          args: [
            spec.metadataKey,
            input.databaseKind,
            input.formatVersion,
            input.schemaVersion,
            input.lastMigrationId,
          ],
        });
      });
    },
  };
}

function assertKnownAuthority(
  authority: MigrationAuthority,
  migrations: readonly GeneratedMigration[],
  spec: DatabaseSpec,
): asserts authority is Extract<MigrationAuthority, { status: "existing" }> {
  if (authority.status === "fresh") {
    throw new ProjectStorageBrokenError("Existing database has no migration authority.");
  }
  const migrationIndex = migrations.findIndex(
    (migration) => migration.migrationId === authority.lastMigrationId,
  );
  if (
    authority.databaseKind !== spec.databaseKind ||
    authority.formatVersion !== spec.formatVersion ||
    authority.schemaVersion !== spec.schemaVersion ||
    migrationIndex < 0
  ) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
}

function assertCurrentAuthority(
  authority: MigrationAuthority,
  migrations: readonly GeneratedMigration[],
  spec: DatabaseSpec,
): void {
  assertKnownAuthority(authority, migrations, spec);
  if (authority.lastMigrationId !== migrations.at(-1)?.migrationId) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
}

async function requireForeignKeys(client: LocalClient): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  if (integerScalar(await client.execute("PRAGMA foreign_keys")) !== 1) {
    throw new ProjectStorageBrokenError("Database foreign-key enforcement is unavailable.");
  }
}

function stringScalarRows(result: LocalLibsqlResultSet): readonly string[] {
  const values: string[] = [];
  for (const row of result.rows) {
    const value = row[0];
    if (row.length !== 1 || typeof value !== "string") return [];
    values.push(value);
  }
  return values;
}

async function inspectDatabaseIntegrity(client: LocalClient): Promise<
  Readonly<{
    foreignKeyViolationCount: number;
    integrityRows: readonly string[];
  }>
> {
  return {
    foreignKeyViolationCount: (await client.execute("PRAGMA foreign_key_check")).rows.length,
    integrityRows: stringScalarRows(await client.execute("PRAGMA integrity_check")),
  };
}

async function requireDatabaseIntegrity(client: LocalClient): Promise<void> {
  const integrity = await inspectDatabaseIntegrity(client);
  if (integrity.foreignKeyViolationCount !== 0) {
    throw new ProjectStorageBrokenError("Database foreign-key integrity validation failed.");
  }
  const valid = integrity.integrityRows.length === 1 && integrity.integrityRows[0] === "ok";
  if (!valid) {
    throw new ProjectStorageBrokenError("Database integrity validation failed.");
  }
}

async function requireApplicationIntegrity(client: LocalClient): Promise<void> {
  const integrity = await inspectDatabaseIntegrity(client);
  if (integrity.integrityRows.length !== 1 || integrity.integrityRows[0] !== "ok") {
    throw new ProjectStorageBrokenError("Project Storage application authority is corrupt.");
  }
  if (integrity.foreignKeyViolationCount !== 0) {
    throw new ProjectStorageBrokenError(
      "Project Storage application authority has foreign-key violations.",
    );
  }
}

async function requireCurrentMetadata(
  client: LocalClient,
  spec: DatabaseSpec,
  migrations: readonly GeneratedMigration[],
): Promise<MetadataRow> {
  const metadata = exactlyOne(
    await metadataRows(client, spec),
    "Database metadata authority must contain exactly one row.",
  );
  const lastMigration = migrations.at(-1);
  if (
    lastMigration === undefined ||
    metadata.metadataKey !== spec.metadataKey ||
    metadata.databaseKind !== spec.databaseKind ||
    metadata.formatVersion !== spec.formatVersion ||
    metadata.schemaVersion !== spec.schemaVersion ||
    metadata.lastMigrationId !== lastMigration.migrationId
  ) {
    throw new ProjectStorageBrokenError("Database metadata authority is not current.");
  }
  return metadata;
}

async function insertDatabaseIdentity(
  client: LocalClient,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
): Promise<void> {
  if (spec.databaseKind === "canonical") {
    const row = decodeStrict(canonicalIdentityRowSchema, {
      identityKey: "storage",
      projectId: creation.projectId,
      storageId: creation.storageId,
      generationId: creation.generationId,
      canonicalDatabaseLineageId: creation.canonicalDatabaseLineageId,
      createdAt: creation.createdAt,
    });
    await client.execute({
      sql: `INSERT INTO storage_identity
        (identity_key, project_id, storage_id, generation_id,
          canonical_database_lineage_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        row.identityKey,
        row.projectId,
        row.storageId,
        row.generationId,
        row.canonicalDatabaseLineageId,
        row.createdAt,
      ],
    });
    return;
  }
  const row = decodeStrict(runtimeIdentityRowSchema, {
    identityKey: "storage",
    projectId: creation.projectId,
    storageId: creation.storageId,
    generationId: creation.generationId,
    runtimeDatabaseLineageId: creation.runtimeDatabaseLineageId,
    createdAt: creation.createdAt,
  });
  await client.execute({
    sql: `INSERT INTO slopstop_runtime_storage_identity
      (identity_key, project_id, storage_id, generation_id,
        runtime_database_lineage_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      row.identityKey,
      row.projectId,
      row.storageId,
      row.generationId,
      row.runtimeDatabaseLineageId,
      row.createdAt,
    ],
  });
}

async function databaseIdentityMatches(
  client: LocalClient,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
): Promise<boolean> {
  if (spec.databaseKind === "canonical") {
    const result = await client.execute(
      `SELECT identity_key AS identityKey, project_id AS projectId,
        storage_id AS storageId, generation_id AS generationId,
        canonical_database_lineage_id AS canonicalDatabaseLineageId,
        created_at AS createdAt FROM storage_identity`,
    );
    const row = exactlyOne(
      decodeStrict(Schema.Array(canonicalIdentityRowSchema), resultObjects(result)),
      "Canonical Storage identity must contain exactly one row.",
    );
    return [
      row.projectId === creation.projectId,
      row.storageId === creation.storageId,
      row.generationId === creation.generationId,
      row.canonicalDatabaseLineageId === creation.canonicalDatabaseLineageId,
      row.createdAt === creation.createdAt,
    ].every(Boolean);
  }
  const result = await client.execute(
    `SELECT identity_key AS identityKey, project_id AS projectId,
      storage_id AS storageId, generation_id AS generationId,
      runtime_database_lineage_id AS runtimeDatabaseLineageId,
      created_at AS createdAt FROM slopstop_runtime_storage_identity`,
  );
  const row = exactlyOne(
    decodeStrict(Schema.Array(runtimeIdentityRowSchema), resultObjects(result)),
    "Runtime Storage identity must contain exactly one row.",
  );
  return [
    row.projectId === creation.projectId,
    row.storageId === creation.storageId,
    row.generationId === creation.generationId,
    row.runtimeDatabaseLineageId === creation.runtimeDatabaseLineageId,
    row.createdAt === creation.createdAt,
  ].every(Boolean);
}

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

async function buildDatabase(
  databasePath: string,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
  initialBinding?: InitialRepositoryBinding,
): Promise<ClosedDatabaseBuild> {
  try {
    await requirePlainDirectory(
      path.dirname(databasePath),
      "Database creation directory is unavailable.",
    );
    if ((await lstatIfPresent(databasePath)) !== undefined) {
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
  await requirePlainFile(databasePath, "Sealed database is unavailable.");
  const client = createLocalClient(databasePath, "generation");
  try {
    await requireForeignKeys(client);
    const migrations = await loadMigrations(spec);
    const metadata = await requireCurrentMetadata(client, spec, migrations);
    const expectedMetadata =
      spec.databaseKind === "canonical"
        ? {
            formatVersion: manifest.canonical.formatVersion,
            schemaVersion: manifest.canonical.schemaVersion,
            lastMigrationId: manifest.canonical.lastMigrationId,
          }
        : {
            formatVersion: manifest.runtime.adapterFormatVersion,
            schemaVersion: manifest.runtime.adapterSchemaVersion,
            lastMigrationId: manifest.runtime.adapterLastMigrationId,
          };
    if (
      metadata.formatVersion !== expectedMetadata.formatVersion ||
      metadata.schemaVersion !== expectedMetadata.schemaVersion ||
      metadata.lastMigrationId !== expectedMetadata.lastMigrationId
    ) {
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

async function readPlainFile(filePath: string, message: string): Promise<Buffer> {
  return readNodeStorageFile({ filePath, message });
}

async function sha256File(filePath: string): Promise<string> {
  return hashNodeStorageFile({ filePath });
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
    sha256File(input.paths.canonicalDatabase),
    sha256File(input.paths.runtimeDatabase),
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

async function verifySealedGeneration(
  paths: ProjectStorageGenerationPaths,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<void> {
  try {
    await requirePlainDirectory(paths.root, "Project Storage generation is unavailable.");
    const manifestSource = await readPlainFile(
      paths.manifest,
      "Project Storage manifest is unavailable.",
    );
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

async function generationRowsByRequest(
  client: LocalClient | LocalTransaction,
  createRequestId: ProjectStorageCreateRequest["createRequestId"],
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT ${generationRowColumns}
      FROM storage_generations WHERE create_request_id = ?`,
    args: [createRequestId],
  });
  return decodeStrict(Schema.Array(generationRowSchema), resultObjects(result));
}

async function registrationRowsByProject(
  client: LocalClient | LocalTransaction,
  projectId: ProjectId,
): Promise<readonly RegistrationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, project_id AS projectId,
      active_generation_id AS activeGenerationId,
      active_location_id AS activeLocationId,
      created_at AS createdAt, activated_at AS activatedAt
      FROM storage_registrations WHERE project_id = ?`,
    args: [projectId],
  });
  return decodeStrict(Schema.Array(registrationRowSchema), resultObjects(result));
}

async function generationRowsByProject(
  client: LocalClient | LocalTransaction,
  projectId: ProjectId,
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT ${generationRowColumns} FROM storage_generations
      WHERE project_id = ? LIMIT ?`,
    args: [projectId, maximumRegistryGenerationsPerProject + 1],
  });
  const generations = decodeStrict(Schema.Array(generationRowSchema), resultObjects(result));
  if (generations.length > maximumRegistryGenerationsPerProject) {
    throw new ProjectStorageBrokenError("Project Storage registry witness set is unbounded.");
  }
  return generations;
}

async function locationRowsByStorage(
  client: LocalClient | LocalTransaction,
  storageId: GenerationRow["storageId"],
  locationId: GenerationRow["locationId"],
): Promise<readonly LocationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, location_id AS locationId,
      normalized_path AS normalizedPath, location_state AS locationState,
      observed_at AS observedAt FROM storage_locations
      WHERE storage_id = ? AND location_id = ?`,
    args: [storageId, locationId],
  });
  return decodeStrict(Schema.Array(locationRowSchema), resultObjects(result));
}

async function locationRowsByNormalizedPath(
  client: LocalClient | LocalTransaction,
  normalizedProjectRoot: string,
): Promise<readonly LocationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, location_id AS locationId,
      normalized_path AS normalizedPath, location_state AS locationState,
      observed_at AS observedAt FROM storage_locations
      WHERE normalized_path = ?`,
    args: [normalizedProjectRoot],
  });
  return decodeStrict(Schema.Array(locationRowSchema), resultObjects(result));
}

async function hasGenerationLocationWitness(
  client: LocalClient,
  generations: readonly GenerationRow[],
): Promise<boolean> {
  let found = false;
  for (const generation of generations) {
    const linked = await locationRowsByStorage(client, generation.storageId, generation.locationId);
    if (linked.length > 1) {
      throw new ProjectStorageBrokenError("Project Storage location authority is not unique.");
    }
    if (linked.length === 1) found = true;
  }
  return found;
}

function registryWitnessKinds(input: {
  registrations: readonly RegistrationRow[];
  directLocations: readonly LocationRow[];
  generations: readonly GenerationRow[];
  hasGenerationLinkedLocation: boolean;
}): readonly PriorStateWitnessKind[] {
  const kinds = new Set<PriorStateWitnessKind>();
  if (input.registrations.length === 1) kinds.add("registration-record");
  if (input.directLocations.length === 1) kinds.add("location-record");
  if (input.hasGenerationLinkedLocation) kinds.add("location-record");
  if (input.generations.length > 0) kinds.add("generation-record");
  return witnessOrder.filter((kind) => kinds.has(kind));
}

function requireUniqueRegistryWitnessRows(input: {
  registrations: readonly RegistrationRow[];
  directLocations: readonly LocationRow[];
}): void {
  if (input.registrations.length > 1) {
    throw new ProjectStorageBrokenError("Project Storage registry witness authority is invalid.");
  }
  if (input.directLocations.length > 1) {
    throw new ProjectStorageBrokenError("Project Storage registry witness authority is invalid.");
  }
}

async function requireStagingCreateAuthority(input: {
  client: LocalClient | LocalTransaction;
  expectedProjectRoot: string;
  generation: GenerationRow;
}): Promise<void> {
  const [registration, location] = await Promise.all([
    registrationRowsByProject(input.client, input.generation.projectId).then((rows) =>
      exactlyOne(rows, "Staging create request authority is inconsistent."),
    ),
    locationRowsByStorage(
      input.client,
      input.generation.storageId,
      input.generation.locationId,
    ).then((rows) => exactlyOne(rows, "Staging create request authority is inconsistent.")),
  ]);
  const rowsAgree = [
    registration.storageId === input.generation.storageId,
    registration.activeGenerationId === null,
    registration.activeLocationId === null,
    registration.createdAt === input.generation.createdAt,
    registration.activatedAt === null,
    location.locationState === "staging",
    location.normalizedPath === input.expectedProjectRoot,
    input.generation.generationDirectoryName === input.generation.generationId,
    input.generation.activatedAt === null,
  ].every(Boolean);
  if (!rowsAgree) {
    throw new ProjectStorageBrokenError("Staging create request authority is inconsistent.");
  }
}

async function requireActiveCreateAuthority(input: {
  client: LocalClient | LocalTransaction;
  expectedProjectRoot: string;
  generation: GenerationRow;
  message: string;
}): Promise<void> {
  const [registration, location] = await Promise.all([
    registrationRowsByProject(input.client, input.generation.projectId).then((rows) =>
      exactlyOne(rows, input.message),
    ),
    locationRowsByStorage(
      input.client,
      input.generation.storageId,
      input.generation.locationId,
    ).then((rows) => exactlyOne(rows, input.message)),
  ]);
  const completed = await completedUpgradeFor(input.client, input.generation.storageId);
  const rowsAgree = [
    registration.storageId === input.generation.storageId,
    registration.activeGenerationId === input.generation.generationId,
    registration.activeLocationId === input.generation.locationId,
    registration.createdAt === (completed?.sourceCreatedAt ?? input.generation.createdAt),
    registration.activatedAt === input.generation.activatedAt,
    location.locationState === "committed",
    location.normalizedPath === input.expectedProjectRoot,
    input.generation.generationDirectoryName === input.generation.generationId,
    input.generation.activatedAt !== null,
  ].every(Boolean);
  if (!rowsAgree) throw new ProjectStorageBrokenError(input.message);
}

function requireCanonicalCreateRequestFingerprint(generation: GenerationRow): void {
  const expectedFingerprint = createHash("sha256")
    .update(
      projectStorageCreateRequestFingerprintInput({
        projectId: generation.projectId,
        createRequestId: generation.createRequestId,
      }),
    )
    .digest("hex");
  if (generation.createRequestFingerprint !== expectedFingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
}

async function requireRegisteredProjectAuthority(input: {
  client: LocalClient | LocalTransaction;
  expectedProjectRoot: string;
  registration: RegistrationRow;
}): Promise<void> {
  const message = "Registered Project Storage authority is inconsistent.";
  const generation = exactlyOne(
    await generationRowsByProject(input.client, input.registration.projectId),
    message,
  );
  requireCanonicalCreateRequestFingerprint(generation);
  if (generation.storageId !== input.registration.storageId) {
    throw new ProjectStorageBrokenError(message);
  }
  if (input.registration.activeGenerationId === null) {
    if (generation.creationState !== "staging") throw new ProjectStorageBrokenError(message);
    await requireStagingCreateAuthority({
      client: input.client,
      expectedProjectRoot: input.expectedProjectRoot,
      generation,
    });
    return;
  }
  if (generation.creationState !== "active") throw new ProjectStorageBrokenError(message);
  await requireActiveCreateAuthority({
    client: input.client,
    expectedProjectRoot: input.expectedProjectRoot,
    generation,
    message,
  });
}

async function inspectExistingCreateGeneration(input: {
  client: LocalClient | LocalTransaction;
  request: ProjectStorageCreateRequest;
  createRequestFingerprint: string;
  expectedProjectRoot: string;
  generation: GenerationRow;
}): Promise<CreateInspection> {
  if (input.generation.projectId !== input.request.projectId) {
    requireCanonicalCreateRequestFingerprint(input.generation);
    const generationProjectRoot = path.resolve(
      path.dirname(input.expectedProjectRoot),
      input.generation.projectId,
    );
    if (input.generation.creationState === "staging") {
      await requireStagingCreateAuthority({
        client: input.client,
        expectedProjectRoot: generationProjectRoot,
        generation: input.generation,
      });
    } else {
      await requireActiveCreateAuthority({
        client: input.client,
        expectedProjectRoot: generationProjectRoot,
        generation: input.generation,
        message: "Active create request authority is inconsistent.",
      });
    }
    return { status: "idempotency-conflict" };
  }
  if (input.generation.createRequestFingerprint !== input.createRequestFingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
  if (input.generation.creationState === "staging") {
    await requireStagingCreateAuthority(input);
    return { status: "incomplete-request" };
  }
  await requireActiveCreateAuthority({
    client: input.client,
    expectedProjectRoot: input.expectedProjectRoot,
    generation: input.generation,
    message: "Active create request authority is inconsistent.",
  });
  return activeReplay(input.generation);
}

function activeReplay(generation: GenerationRow): CreateInspection {
  return {
    status: "active-replay",
    identity: {
      storageId: generation.storageId,
      generationId: generation.generationId,
      canonicalDatabaseLineageId: generation.canonicalDatabaseLineageId,
      runtimeDatabaseLineageId: generation.runtimeDatabaseLineageId,
    },
  };
}

async function inspectCreateRows(
  client: LocalClient | LocalTransaction,
  request: ProjectStorageCreateRequest,
  createRequestFingerprint: string,
  expectedProjectRoot: string,
): Promise<CreateInspection> {
  const requestRows = await generationRowsByRequest(client, request.createRequestId);
  if (requestRows.length > 1) {
    throw new ProjectStorageBrokenError("Create request authority is not unique.");
  }
  const generation = requestRows[0];
  if (generation !== undefined) {
    return inspectExistingCreateGeneration({
      client,
      request,
      createRequestFingerprint,
      expectedProjectRoot,
      generation,
    });
  }
  const upgraded = await upgradedCreateRequest(client, request.createRequestId);
  if (upgraded !== undefined) {
    return inspectUpgradedCreate({
      client,
      request,
      createRequestFingerprint,
      expectedProjectRoot,
      upgraded,
    });
  }
  return inspectProjectRegistration({ client, request, expectedProjectRoot });
}

/** A create request whose generation an upgrade superseded replays the current generation. */
async function inspectUpgradedCreate(input: {
  client: LocalClient | LocalTransaction;
  request: ProjectStorageCreateRequest;
  createRequestFingerprint: string;
  expectedProjectRoot: string;
  upgraded: UpgradedCreateRequest;
}): Promise<CreateInspection> {
  const { projectId } = input.upgraded;
  const message = "Active create request authority is inconsistent.";
  const generation = exactlyOne(
    (await generationRowsByProject(input.client, projectId)).filter(
      (row) => row.creationState === "active",
    ),
    message,
  );
  await requireActiveCreateAuthority({
    client: input.client,
    expectedProjectRoot: path.resolve(path.dirname(input.expectedProjectRoot), projectId),
    generation,
    message,
  });
  if (projectId !== input.request.projectId) return { status: "idempotency-conflict" };
  if (input.upgraded.createRequestFingerprint !== input.createRequestFingerprint) {
    throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
  }
  return activeReplay(generation);
}

function activeGenerationFor(
  registration: RegistrationRow,
  generations: readonly GenerationRow[],
): GenerationRow | undefined {
  const activeGenerations = generations.filter(
    (generation) =>
      generation.storageId === registration.storageId && generation.creationState === "active",
  );
  if (activeGenerations.length > 1) {
    throw new ProjectStorageBrokenError("Active generation authority is not unique.");
  }
  return activeGenerations[0];
}

function requireActiveRegistrationAgreement(
  registration: RegistrationRow,
  generation: GenerationRow | undefined,
): void {
  const registrationSelectsGeneration =
    registration.activeGenerationId !== null && registration.activeLocationId !== null;
  if (!registrationSelectsGeneration) return;
  if (generation === undefined) {
    throw new ProjectStorageBrokenError("Project Storage authority is internally inconsistent.");
  }
  const selectionAgrees =
    registration.activeGenerationId === generation.generationId &&
    registration.activeLocationId === generation.locationId;
  if (!selectionAgrees) {
    throw new ProjectStorageBrokenError("Project Storage authority is internally inconsistent.");
  }
}

/** The ordinary generation directories are exactly the expected (defined) generation ids. */
function sameDirectories(
  actual: readonly string[],
  expected: readonly (string | null | undefined)[],
): boolean {
  const wanted = expected.filter((id): id is string => typeof id === "string").sort();
  const present = [...actual].sort();
  return present.length === wanted.length && present.every((id, index) => id === wanted[index]);
}

async function selectHealthyOpening(
  input: HealthyOpeningSelectionInput,
): Promise<OpeningInspection<OpeningSelection>> {
  const [registrations, generations, directLocations] = await Promise.all([
    registrationRowsByProject(input.client, input.projectId),
    generationRowsByProject(input.client, input.projectId),
    locationRowsByNormalizedPath(input.client, input.normalizedProjectRoot),
  ]);
  const unregistered = inspectUnregisteredOpening({
    registrationCount: registrations.length,
    generations,
    locationCount: directLocations.length,
    filesystemWitnessCount: input.filesystem.kinds.length,
  });
  if (unregistered !== undefined) return unregistered;
  const registration = exactlyOne(registrations, "Project registration authority is not unique.");
  requireActiveRegistrationAgreement(registration, activeGenerationFor(registration, generations));
  const recovery = inspectRegisteredRecovery({
    registration,
    generations,
    hasFilesystemStaging: input.filesystem.hasStagingGeneration,
  });
  if (recovery !== undefined) return recovery;
  await requireRegisteredProjectAuthority({
    client: input.client,
    expectedProjectRoot: input.normalizedProjectRoot,
    registration,
  });
  const generation = exactlyOne(generations, "Active generation authority is not unique.");
  const completed = await completedUpgradeFor(input.client, registration.storageId);
  const filesystemAgrees = [
    !input.filesystem.hasRootDatabaseWitness,
    sameDirectories(input.filesystem.ordinaryGenerationIds, [
      registration.activeGenerationId,
      completed?.sourceGenerationId,
    ]),
  ].every(Boolean);
  if (!filesystemAgrees) {
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity({ registration, generation }),
    };
  }
  if (generation.creationState !== "active") {
    throw new ProjectStorageBrokenError("Project Storage opening authority is incomplete.");
  }
  return {
    status: "selected",
    selection: {
      identity: {
        storageId: generation.storageId,
        generationId: generation.generationId,
        canonicalDatabaseLineageId: generation.canonicalDatabaseLineageId,
        runtimeDatabaseLineageId: generation.runtimeDatabaseLineageId,
      },
      generation,
      paths: input.paths.forCreation(input.projectId, generation.generationId).active,
      completedUpgrade: completed,
    },
  };
}

async function confirmHealthyOpening(
  input: HealthyOpeningSelectionInput,
): Promise<OpeningInspection<OpeningSelection>> {
  const inspection = await selectHealthyOpening(input);
  if (inspection.status !== "selected") return inspection;
  return selectHealthyOpening({
    ...input,
    filesystem: await inspectFilesystemWitnesses({
      projectRoot: input.normalizedProjectRoot,
      deferManifestTypeValidation: true,
    }),
  });
}

async function inspectHealthyOpeningDatabase(input: {
  databasePath: string;
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime;
  selection: OpeningSelection;
  manifest: ProjectStorageManifest;
  loadMigrations(spec: DatabaseSpec): Promise<readonly GeneratedMigration[]>;
  openProjectDatabaseClient?: NodeProjectStorageOptions["openProjectDatabaseClient"];
  clientSlot: "canonical" | "runtime";
  openedClients: MutableOpeningClients;
}): Promise<ProjectDatabaseProbe> {
  try {
    if (!(await openingDatabaseIsPresent(input.databasePath))) return { status: "missing" };
    const open = () => createLocalClient(input.databasePath, "generation");
    const client =
      input.openProjectDatabaseClient?.({
        databaseKind: input.spec.databaseKind,
        open,
      }) ?? open();
    input.openedClients[input.clientSlot] = client;
    const migrations = await input.loadMigrations(input.spec);
    const metadata = exactlyOne(
      await metadataRows(client, input.spec),
      "Database metadata authority must contain exactly one row.",
    );
    const compatibility = inspectOpeningMetadata({
      actual: metadata,
      expected: expectedOpeningMetadata(input.spec.databaseKind, input.manifest),
      supported: input.spec,
      migrationIds: migrations.map((migration) => migration.migrationId),
    });
    if (compatibility === undefined) {
      throw new ProjectStorageBrokenError("Database metadata authority is incompatible.");
    }
    const probe = presentProjectDatabaseProbe({
      identityMatches: await databaseIdentityMatches(
        client,
        input.spec,
        input.selection.generation,
      ),
      ...compatibility,
    });
    return await completeOpeningDatabaseProbe({ client, spec: input.spec, probe });
  } catch (error) {
    if (isUnavailableStorageError({ error })) return { status: "unavailable" };
    if (isCorruptStorageError({ error })) return { status: "corrupt" };
    return { status: "broken" };
  }
}

async function completeOpeningDatabaseProbe(input: {
  client: LocalClient;
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime;
  probe: Extract<ProjectDatabaseProbe, { status: "present" }>;
}): Promise<ProjectDatabaseProbe> {
  if (compatibilityPrecedesIntegrity(input.probe)) return input.probe;
  await requireForeignKeys(input.client);
  if (input.probe.format === "current" && input.probe.migration === "current") {
    if (input.spec.databaseKind === "runtime-adapter") {
      await requireOwnedSchemaObjects(input.client, input.spec);
    } else {
      await requireDeclaredSchemaObjects(input.client, input.spec);
    }
  }
  return { ...input.probe, ...(await inspectDatabaseIntegrity(input.client)) };
}

async function settledOpeningProbes(input: {
  selection: OpeningSelection;
  manifest: ProjectStorageManifest;
  loadMigrations(spec: DatabaseSpec): Promise<readonly GeneratedMigration[]>;
  openProjectDatabaseClient?: NodeProjectStorageOptions["openProjectDatabaseClient"];
  openedClients: MutableOpeningClients;
}): Promise<Readonly<{ canonical: ProjectDatabaseProbe; runtime: ProjectDatabaseProbe }>> {
  const [canonical, runtime] = await Promise.allSettled([
    inspectHealthyOpeningDatabase({
      databasePath: input.selection.paths.canonicalDatabase,
      spec: databaseSpecs.canonical,
      selection: input.selection,
      manifest: input.manifest,
      loadMigrations: input.loadMigrations,
      openProjectDatabaseClient: input.openProjectDatabaseClient,
      clientSlot: "canonical",
      openedClients: input.openedClients,
    }),
    inspectHealthyOpeningDatabase({
      databasePath: input.selection.paths.runtimeDatabase,
      spec: databaseSpecs.runtime,
      selection: input.selection,
      manifest: input.manifest,
      loadMigrations: input.loadMigrations,
      openProjectDatabaseClient: input.openProjectDatabaseClient,
      clientSlot: "runtime",
      openedClients: input.openedClients,
    }),
  ]);
  if (canonical.status === "rejected") throw canonical.reason;
  if (runtime.status === "rejected") throw runtime.reason;
  return { canonical: canonical.value, runtime: runtime.value };
}

async function inspectProjectRegistration(input: {
  client: LocalClient | LocalTransaction;
  request: ProjectStorageCreateRequest;
  expectedProjectRoot: string;
}): Promise<CreateInspection> {
  const registrations = await registrationRowsByProject(input.client, input.request.projectId);
  if (registrations.length > 1) {
    throw new ProjectStorageBrokenError("Project registration authority is not unique.");
  }
  const registration = registrations[0];
  if (registration === undefined) {
    const generations = await generationRowsByProject(input.client, input.request.projectId);
    if (generations.length > 0) {
      throw new ProjectStorageBrokenError("Registered Project Storage authority is inconsistent.");
    }
    return { status: "fresh" };
  }
  await requireRegisteredProjectAuthority({
    client: input.client,
    expectedProjectRoot: input.expectedProjectRoot,
    registration,
  });
  return { status: "already-registered" };
}

function assertRowsAffected(rowsAffected: number, message: string): void {
  if (rowsAffected !== 1) throw new ProjectStorageBrokenError(message);
}

async function insertStagingRows(
  transaction: LocalTransaction,
  declaration: StagingDeclaration,
): Promise<void> {
  const location = await transaction.execute({
    sql: `INSERT INTO storage_locations
      (storage_id, location_id, normalized_path, location_state, observed_at)
      VALUES (?, ?, ?, ?, ?)`,
    args: [
      declaration.storageId,
      declaration.locationId,
      declaration.normalizedPath,
      declaration.locationState,
      declaration.observedAt,
    ],
  });
  assertRowsAffected(location.rowsAffected, "Staging location was not inserted exactly once.");
  const generation = await transaction.execute({
    sql: `INSERT INTO storage_generations
      (storage_id, generation_id, project_id, location_id,
        canonical_lineage_id, runtime_lineage_id, create_request_id,
        create_request_fingerprint, generation_directory_name,
        creation_state, created_at, activated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    args: [
      declaration.storageId,
      declaration.generationId,
      declaration.projectId,
      declaration.locationId,
      declaration.canonicalDatabaseLineageId,
      declaration.runtimeDatabaseLineageId,
      declaration.createRequestId,
      declaration.createRequestFingerprint,
      declaration.generationDirectoryName,
      declaration.creationState,
      declaration.createdAt,
    ],
  });
  assertRowsAffected(generation.rowsAffected, "Staging generation was not inserted exactly once.");
  const registration = await transaction.execute({
    sql: `INSERT INTO storage_registrations
      (storage_id, project_id, active_generation_id, active_location_id,
        created_at, activated_at)
      VALUES (?, ?, NULL, NULL, ?, NULL)`,
    args: [declaration.storageId, declaration.projectId, declaration.createdAt],
  });
  assertRowsAffected(
    registration.rowsAffected,
    "Staging registration was not inserted exactly once.",
  );
}

async function activateRows(
  transaction: LocalTransaction,
  activation: Activation,
  failures: ProjectStorageStoreDependencies["failures"],
): Promise<void> {
  const generation = await transaction.execute({
    sql: `UPDATE storage_generations SET creation_state = 'active', activated_at = ?
      WHERE storage_id = ? AND generation_id = ? AND project_id = ?
        AND location_id = ? AND creation_state = 'staging' AND activated_at IS NULL`,
    args: [
      activation.activatedAt,
      activation.storageId,
      activation.generationId,
      activation.projectId,
      activation.locationId,
    ],
  });
  assertRowsAffected(generation.rowsAffected, "Staging generation was not activated exactly once.");
  const location = await transaction.execute({
    sql: `UPDATE storage_locations SET location_state = 'committed'
      WHERE storage_id = ? AND location_id = ? AND location_state = 'staging'`,
    args: [activation.storageId, activation.locationId],
  });
  assertRowsAffected(location.rowsAffected, "Staging location was not committed exactly once.");
  const registration = await transaction.execute({
    sql: `UPDATE storage_registrations
      SET active_generation_id = ?, active_location_id = ?, activated_at = ?
      WHERE storage_id = ? AND project_id = ?
        AND active_generation_id IS NULL AND active_location_id IS NULL
        AND activated_at IS NULL`,
    args: [
      activation.generationId,
      activation.locationId,
      activation.activatedAt,
      activation.storageId,
      activation.projectId,
    ],
  });
  assertRowsAffected(
    registration.rowsAffected,
    "Staging registration was not activated exactly once.",
  );
  await failures.checkpoint("during-activation-transaction");
}

function createNodeAdapters(options: NodeProjectStorageOptions): ProjectStorageStoreDependencies {
  const applicationStorageRoot = path.resolve(options.applicationStorageRoot);
  const migrationResourcesRoot = path.resolve(options.migrationResourcesRoot);
  const applicationDatabasePath = path.join(applicationStorageRoot, "application.db");
  const projectRootFor = (projectId: ProjectId): string =>
    path.join(applicationStorageRoot, "projects", decodeStrict(ProjectIdSchema, projectId));
  const migrationCache = new Map<string, Promise<readonly GeneratedMigration[]>>();
  const loadMigrations = (spec: DatabaseSpec): Promise<readonly GeneratedMigration[]> => {
    const existing = migrationCache.get(spec.resourceKind);
    if (existing !== undefined) return existing;
    const loaded = loadGeneratedMigrations(migrationResourcesRoot, spec);
    migrationCache.set(spec.resourceKind, loaded);
    return loaded;
  };
  const failures =
    options.failures ??
    ({
      checkpoint: async () => undefined,
    } satisfies ProjectStorageStoreDependencies["failures"]);
  const ids =
    options.ids ??
    ({
      storageId: () => decodeStrict(StorageIdSchema, randomUUID()),
      locationId: () => decodeStrict(privateLocationIdSchema, randomUUID()),
      generationId: () => decodeStrict(StorageGenerationIdSchema, randomUUID()),
      canonicalLineageId: () => decodeStrict(CanonicalDatabaseLineageIdSchema, randomUUID()),
      runtimeLineageId: () => decodeStrict(RuntimeDatabaseLineageIdSchema, randomUUID()),
      upgradeId: () => decodeStrict(ProjectStorageCreateRequestIdSchema, randomUUID()),
    } satisfies ProjectStorageStoreDependencies["ids"]);
  const clock =
    options.clock ??
    ({
      now: () => decodeStrict(utcInstantSchema, new Date().toISOString()),
    } satisfies ProjectStorageStoreDependencies["clock"]);
  const createLock = createPermitLock();
  const projectLocks = new Map<ProjectId, ProjectLockEntry>();
  const paths: ProjectStorageStoreDependencies["paths"] = {
    forCreation: (projectId, generationId) => {
      const projectRoot = projectRootFor(projectId);
      const generationPaths = (root: string): ProjectStorageGenerationPaths => ({
        root,
        canonicalDatabase: path.join(root, canonicalDatabaseFilename),
        runtimeDatabase: path.join(root, runtimeDatabaseFilename),
        manifest: path.join(root, projectStorageManifestFilename),
      });
      return {
        projectRoot,
        writerLease: path.join(projectRoot, canonicalWriterLeaseFilename),
        staging: generationPaths(path.join(projectRoot, `.staging-${generationId}`)),
        active: generationPaths(path.join(projectRoot, generationId)),
      };
    },
  };

  const ownsApplicationDatabase = options.applicationDatabase === undefined;
  const applicationDatabase =
    options.applicationDatabase ??
    createApplicationDatabaseAuthority({ applicationStorageRoot, migrationResourcesRoot });
  if (applicationDatabase.applicationDatabasePath !== applicationDatabasePath)
    throw new Error("Application database authority belongs to another installation root.");
  // The authority only initializes; Storage keeps its own authority contract. A broken
  // existing database is refused without initialization, so Storage's checks that follow
  // still report its precise broken diagnostic instead of the registry's coarser code.
  const ensureApplicationDatabase = async (
    createIfMissing: boolean,
  ): Promise<"absent" | "present"> => {
    try {
      const state = await applicationDatabase.ensureCurrent({ createIfMissing });
      return state === "absent" ? "absent" : "present";
    } catch (error) {
      if (!(error instanceof ApplicationDatabaseFault) || error.failure.status !== "broken")
        throw error;
      // A definite schema mismatch keeps the shared verifier's precise Storage diagnostic.
      if (error.cause instanceof ProjectStorageBrokenError) throw error.cause;
      return "present";
    }
  };
  const applicationClients = createApplicationClientManager({
    applicationDatabasePath,
    applicationStorageRoot,
    ensureInitialized: ensureApplicationDatabase,
    createClient: () =>
      applicationDatabase.admitClient(createLocalClient(applicationDatabasePath, "application")),
    initialize: options.initializeApplicationClient ?? requireForeignKeys,
  });
  const existingApplicationClient = applicationClients.existing;
  const mutableApplicationClient = applicationClients.mutable;

  const requireApplicationAuthority = async (
    client: LocalClient,
    requirement: "known" | "current",
  ): Promise<void> => {
    const migrations = await loadMigrations(databaseSpecs.application);
    const authority = await createMigrationTarget(
      client,
      databaseSpecs.application,
    ).inspectAuthority();
    if (requirement === "current") {
      assertCurrentAuthority(authority, migrations, databaseSpecs.application);
    } else {
      assertKnownAuthority(authority, migrations, databaseSpecs.application);
    }
    await requireDeclaredSchemaObjects(client, databaseSpecs.application);
    await requireApplicationIntegrity(client);
  };

  const prepareCreate = async (): Promise<void> => {
    try {
      const client = await mutableApplicationClient();
      const migrations = await loadMigrations(databaseSpecs.application);
      // The shared authority is the only application schema initializer.
      await ensureApplicationDatabase(true);
      await requireDeclaredSchemaObjects(client, databaseSpecs.application);
      await requireCurrentMetadata(client, databaseSpecs.application, migrations);
      await requireDatabaseIntegrity(client);
    } catch (error) {
      normalizeStorageError(error, "Project Storage application authority cannot be prepared.");
    }
  };

  const inspectOpening = async (projectId: ProjectId): Promise<ProjectStorageOpenEvidence> => {
    const openedClients: MutableOpeningClients = { canonical: undefined, runtime: undefined };
    const release = createOpeningRelease(openedClients);
    try {
      const normalizedProjectRoot = path.resolve(projectRootFor(projectId));
      const [candidateClient, filesystem] = await Promise.all([
        existingApplicationClient(),
        inspectFilesystemWitnesses({
          projectRoot: normalizedProjectRoot,
          deferManifestTypeValidation: true,
        }),
      ]);
      if (candidateClient === undefined) {
        return openingWithoutApplication(filesystem.kinds.length, release);
      }
      const client = candidateClient;
      await requireApplicationAuthority(client, "current");
      const selectionInput: HealthyOpeningSelectionInput = {
        client,
        projectId,
        normalizedProjectRoot,
        paths,
        filesystem,
      };
      const inspection = await confirmHealthyOpening(selectionInput);
      if (inspection.status === "not-registered") return inspection;
      if (inspection.status === "recovery-required") {
        return { ...inspection, release };
      }
      const { selection } = inspection;
      const manifestInspection = await inspectOpeningManifest({
        manifestPath: selection.paths.manifest,
        authority: selection.generation,
        completedUpgrade: selection.completedUpgrade,
      });
      if (manifestInspection.status === "blocked") {
        return {
          status: "selected-blocked",
          identity: selection.identity,
          manifestStatus: manifestInspection.manifestStatus,
          release,
        };
      }
      const probes = await settledOpeningProbes({
        selection,
        manifest: manifestInspection.manifest,
        loadMigrations,
        openProjectDatabaseClient: options.openProjectDatabaseClient,
        openedClients,
      });
      return {
        status: "selected-current",
        identity: selection.identity,
        canonical: probes.canonical,
        runtime: probes.runtime,
        release,
      };
    } catch (error) {
      normalizeStorageError(
        await openingFailureAfterRelease(error, release),
        "Project Storage opening authority is invalid.",
      );
    }
  };

  const inspectCreate = async (
    request: ProjectStorageCreateRequest,
    createRequestFingerprint: string,
  ): Promise<CreateInspection> => {
    try {
      const client = await existingApplicationClient();
      if (client === undefined) return { status: "fresh" };
      await requireApplicationAuthority(client, "known");
      return await inspectCreateRows(
        client,
        request,
        createRequestFingerprint,
        projectRootFor(request.projectId),
      );
    } catch (error) {
      normalizeStorageError(error, "Project Storage create authority is invalid.");
    }
  };

  const registryWitnesses = async (
    projectId: ProjectId,
    normalizedProjectRoot: string,
  ): Promise<readonly PriorStateWitnessKind[]> => {
    const client = await existingApplicationClient();
    if (client === undefined) return [];
    await requireApplicationAuthority(client, "known");
    const [registrations, directLocations, generations] = await Promise.all([
      registrationRowsByProject(client, projectId),
      locationRowsByNormalizedPath(client, normalizedProjectRoot),
      generationRowsByProject(client, projectId),
    ]);
    requireUniqueRegistryWitnessRows({ registrations, directLocations });
    const hasGenerationLinkedLocation = await hasGenerationLocationWitness(client, generations);
    const kinds = registryWitnessKinds({
      registrations,
      directLocations,
      generations,
      hasGenerationLinkedLocation,
    });
    const reservationTable = await client.execute(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'registration_reservations'",
    );
    if (reservationTable.rows.length === 0) return kinds;
    const reservations = await client.execute({
      sql: "SELECT reservation_id, record_fingerprint FROM registration_reservations WHERE json_extract(record_json, '$.projectId') = ?",
      args: [projectId],
    });
    if (reservations.rows.length === 0) return kinds;
    const seed = options.initialRepositoryBinding;
    if (
      seed !== undefined &&
      seed.projectId === projectId &&
      JSON.stringify(reservations.rows) ===
        JSON.stringify([[seed.reservationId, seed.reservationFingerprint]])
    )
      return kinds;
    return [...kinds, "registration-record"];
  };

  const databases: ProjectStorageStoreDependencies["databases"] = {
    createCanonical: (databasePath, creation) =>
      buildDatabase(
        databasePath,
        databaseSpecs.canonical,
        creation,
        loadMigrations,
        options.initialRepositoryBinding,
      ),
    createRuntime: (databasePath, creation) =>
      buildDatabase(databasePath, databaseSpecs.runtime, creation, loadMigrations),
    verifySealed: (generationPaths, creation) =>
      verifySealedGeneration(generationPaths, creation, loadMigrations),
  };

  const registry: ProjectStorageStoreDependencies["registry"] = {
    inspectCreate,
    prepareCreate,
    declareStaging: async (creation, creationPaths) => {
      const declaration = decodeStrict(stagingDeclarationSchema, {
        ...creation,
        observedAt: clock.now(),
        normalizedPath: path.resolve(creationPaths.projectRoot),
        generationDirectoryName: creation.generationId,
        locationState: "staging",
        creationState: "staging",
      });
      try {
        await prepareCreate();
        const client = await mutableApplicationClient();
        const current = await inspectCreateRows(
          client,
          {
            projectId: creation.projectId,
            createRequestId: creation.createRequestId,
          },
          creation.createRequestFingerprint,
          projectRootFor(creation.projectId),
        );
        if (current.status !== "fresh") return current;
        // Re-open the pre-transaction checkpoint after the optimistic read.
        await failures.checkpoint("before-staging-transaction");
        return await withWriteTransaction(client, async (transaction) => {
          const transactionInspection = await inspectCreateRows(
            transaction,
            {
              projectId: creation.projectId,
              createRequestId: creation.createRequestId,
            },
            creation.createRequestFingerprint,
            projectRootFor(creation.projectId),
          );
          if (transactionInspection.status !== "fresh") return transactionInspection;
          await insertStagingRows(transaction, declaration);
          await failures.checkpoint("during-staging-transaction");
          const row = exactlyOne(
            await generationRowsByRequest(transaction, creation.createRequestId),
            "Staging generation was not persisted exactly once.",
          );
          const rowAgrees = [
            row.storageId === creation.storageId,
            row.generationId === creation.generationId,
            row.creationState === "staging",
            row.activatedAt === null,
          ].every(Boolean);
          if (!rowAgrees) {
            throw new ProjectStorageBrokenError("Staging generation authority does not agree.");
          }
          return { status: "fresh" };
        });
      } catch (error) {
        normalizeStorageError(error, "Project Storage staging declaration failed.");
      }
    },
    activate: async (creation, creationPaths) => {
      const activation = decodeStrict(activationSchema, {
        projectId: creation.projectId,
        storageId: creation.storageId,
        locationId: creation.locationId,
        generationId: creation.generationId,
        activatedAt: clock.now(),
      });
      try {
        await databases.verifySealed(creationPaths.active, creation);
        const client = await existingApplicationClient();
        if (client === undefined) {
          throw new ProjectStorageBrokenError("Project Storage application authority is missing.");
        }
        await requireApplicationAuthority(client, "current");
        await withWriteTransaction(client, async (transaction) => {
          await activateRows(transaction, activation, failures);
          const replay = await inspectCreateRows(
            transaction,
            {
              projectId: creation.projectId,
              createRequestId: creation.createRequestId,
            },
            creation.createRequestFingerprint,
            projectRootFor(creation.projectId),
          );
          const replayAgrees =
            replay.status === "active-replay" &&
            [
              replay.identity.storageId === creation.storageId,
              replay.identity.generationId === creation.generationId,
              replay.identity.canonicalDatabaseLineageId === creation.canonicalDatabaseLineageId,
              replay.identity.runtimeDatabaseLineageId === creation.runtimeDatabaseLineageId,
            ].every(Boolean);
          if (!replayAgrees) {
            throw new ProjectStorageBrokenError(
              "Activated Project Storage authority does not agree.",
            );
          }
        });
      } catch (error) {
        normalizeStorageError(error, "Project Storage activation failed.");
      }
    },
    stop: async () => {
      await applicationClients.stop();
      // A shared authority outlives this consumer; only a standalone owner's own one stops here.
      if (ownsApplicationDatabase) await applicationDatabase.stop();
    },
  };

  const files = createProjectStorageFileAdapter({ applicationStorageRoot });
  const upgrades = createProjectStorageUpgradeSteps({
    applicationClient: async () => {
      const client = await existingApplicationClient();
      if (client === undefined) {
        throw new ProjectStorageBrokenError("Project Storage application authority is missing.");
      }
      await requireApplicationAuthority(client, "current");
      return client;
    },
    existingApplicationClient,
    loadMigrations,
    readMetadata: async (client, spec) =>
      exactlyOne(
        await metadataRows(client, spec),
        "Database metadata authority must contain exactly one row.",
      ),
    paths,
    files,
    sha256File,
    failures,
    diagnostics: options.upgradeDiagnostics,
  });

  return {
    applicationVersion: options.applicationVersion,
    ids,
    clock,
    hashes: {
      sha256Text: async (value) => createHash("sha256").update(value).digest("hex"),
      sha256File,
    },
    paths,
    registry,
    opening: { inspect: inspectOpening },
    witnesses: {
      inspect: async (projectId) => {
        try {
          const projectRoot = projectRootFor(projectId);
          const [registryKinds, filesystem] = await Promise.all([
            registryWitnesses(projectId, path.resolve(projectRoot)),
            inspectFilesystemWitnesses({ projectRoot }),
          ]);
          const kinds = new Set<PriorStateWitnessKind>([...registryKinds, ...filesystem.kinds]);
          return witnessOrder.filter((kind) => kinds.has(kind));
        } catch (error) {
          normalizeStorageError(error, "Project Storage witness authority is invalid.");
        }
      },
    },
    files,
    databases,
    upgrades,
    failures,
    locks: {
      forCreate: (operation) => withPermit(createLock, operation),
      // Queues behind every create already waiting for or holding the create permit.
      afterCreateDrain: (operation) => withPermit(createLock, operation),
      forProject: (projectId, operation) => {
        let entry = projectLocks.get(projectId);
        if (entry === undefined) {
          entry = { lock: createPermitLock(), users: 0 };
          projectLocks.set(projectId, entry);
        }
        const retainedEntry = entry;
        retainedEntry.users += 1;
        return withPermit(retainedEntry.lock, operation).finally(() => {
          retainedEntry.users -= 1;
          if (retainedEntry.users === 0 && projectLocks.get(projectId) === retainedEntry) {
            projectLocks.delete(projectId);
          }
        });
      },
    },
  };
}

export function createNodeProjectStorageDependencies(
  options: NodeProjectStorageOptions,
): ProjectStorageStoreDependencies {
  return createNodeAdapters(options);
}

export { createOpeningRelease };

import type { InitialRepositoryBinding } from "@slopstop/protocol";
import { Schema } from "effect";
import { seedInitialRepositoryBinding } from "./initial-repository-binding.js";
import { createPermitLock, type PermitLock, withPermit } from "./permit-lock.js";
import type { ProjectStorageUpgradeDiagnostics } from "./project-storage-upgrade.js";
import {
  type CompletedUpgrade,
  completedUpgradeFor,
  createProjectStorageUpgradeSteps,
  type UpgradedCreateRequest,
  upgradedCreateRequest,
} from "./project-storage-upgrade-node-adapter.js";
