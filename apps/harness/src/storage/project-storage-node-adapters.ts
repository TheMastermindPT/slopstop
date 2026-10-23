import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { InitialRepositoryBinding } from "@slopstop/protocol";
import {
  CanonicalDatabaseLineageIdSchema,
  decodeStrict,
  type ProjectId,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { Effect } from "effect";
import {
  type ApplicationDatabaseAuthority,
  createApplicationDatabaseAuthority,
} from "./application-database-authority.js";
import { ApplicationDatabaseFault } from "./application-database-migration.js";
import { requireDeclaredSchemaObjects } from "./database-schema-verifier.js";
import { loadGeneratedMigrations } from "./generated-migration-resources.js";
import type { GeneratedMigration } from "./generated-migrations.js";
import { requirePhysicalRoot } from "./physical-root.js";
import { createApplicationClientManager } from "./project-storage-application-client.js";
import { type CreateInspection, inspectCreateRows } from "./project-storage-create-inspection.js";
import {
  assertCurrentAuthority,
  assertKnownAuthority,
  createMigrationTarget,
  metadataRows,
  requireApplicationIntegrity,
  requireCurrentMetadata,
  requireDatabaseIntegrity,
  requireForeignKeys,
} from "./project-storage-database-authority.js";
import { buildDatabase, verifySealedGeneration } from "./project-storage-database-build.js";
import { type DatabaseSpec, databaseSpecs } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { createProjectStorageFileAdapter, sha256File } from "./project-storage-file-adapter.js";
import {
  inspectFilesystemWitnesses,
  projectRootPath,
  upgradeOutputNames,
  witnessOrder,
} from "./project-storage-filesystem-authority.js";
import {
  confirmHealthyOpening,
  type HealthyOpeningSelectionInput,
  type MutableOpeningClients,
  type ProjectDatabaseClientOpener,
  settledOpeningProbes,
} from "./project-storage-healthy-opening.js";
import { createProjectStorageLocksFacade } from "./project-storage-locks.js";
import {
  canonicalDatabaseFilename,
  canonicalWriterLeaseFilename,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
} from "./project-storage-manifest.js";
import { createNodeRegistryOperations } from "./project-storage-node-registry.js";
import { privateLocationIdSchema, utcInstantSchema } from "./project-storage-node-schemas.js";
import {
  createLocalClient,
  exactlyOne,
  type LocalClient,
  normalizeStorageError,
  type ProjectStorageGenerationPaths,
} from "./project-storage-node-support.js";
import {
  createOpeningRelease,
  openingFailureAfterRelease,
  openingWithoutApplication,
  type ProjectStorageOpenEvidence,
} from "./project-storage-opening.js";
import { inspectOpeningManifest } from "./project-storage-opening-manifest.js";
import type {
  PriorStateWitnessKind,
  ProjectStorageStoreDependencies,
} from "./project-storage-store.js";
import type { ProjectStorageUpgradeDiagnostics } from "./project-storage-upgrade.js";
import { createProjectStorageUpgradeSteps } from "./project-storage-upgrade-node-adapter.js";

export { requireDeclaredSchemaObjects } from "./database-schema-verifier.js";
export { loadGeneratedMigrations } from "./generated-migration-resources.js";
export type { DatabaseSpec } from "./project-storage-database-specs.js";
export { databaseSpecs } from "./project-storage-database-specs.js";
export { withWriteTransaction } from "./project-storage-transaction.js";

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
  openProjectDatabaseClient?: ProjectDatabaseClientOpener;
}>;

function createNodeAdapters(options: NodeProjectStorageOptions): ProjectStorageStoreDependencies {
  const applicationStorageRoot = requirePhysicalRoot(options.applicationStorageRoot);
  const migrationResourcesRoot = requirePhysicalRoot(options.migrationResourcesRoot);
  const applicationDatabasePath = path.join(applicationStorageRoot, "application.db");
  const projectRootFor = (projectId: ProjectId): string =>
    projectRootPath(applicationStorageRoot, projectId);
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
  const paths: ProjectStorageStoreDependencies["paths"] = {
    forCreation: (projectId, generationId) => {
      const projectRoot = projectRootFor(projectId);
      const generationPaths = (root: string): ProjectStorageGenerationPaths => ({
        root,
        canonicalDatabase: path.join(root, canonicalDatabaseFilename),
        runtimeDatabase: path.join(root, runtimeDatabaseFilename),
        manifest: path.join(root, projectStorageManifestFilename),
      });
      const [stagingName, activeName] = upgradeOutputNames(generationId);
      return {
        projectRoot,
        writerLease: path.join(projectRoot, canonicalWriterLeaseFilename),
        staging: generationPaths(path.join(projectRoot, stagingName)),
        active: generationPaths(path.join(projectRoot, activeName)),
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

  const registryOperations = createNodeRegistryOperations({
    existingApplicationClient,
    mutableApplicationClient,
    requireApplicationAuthority,
    prepareCreate,
    projectRootFor,
    clock,
    failures,
    databases,
    options,
  });

  /**
   * `declareStaging` and `activate` are temporary Promise facades over the registry programs
   * for the store's Promise callers, as is the `registryWitnesses` call in `witnesses.inspect`;
   * delete them once those callers are Effects (#123).
   */
  const registry: ProjectStorageStoreDependencies["registry"] = {
    inspectCreate,
    prepareCreate,
    declareStaging: (creation, creationPaths) =>
      Effect.runPromise(registryOperations.declareStaging(creation, creationPaths)),
    activate: (creation, creationPaths) =>
      Effect.runPromise(registryOperations.activate(creation, creationPaths)),
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
    sha256File: (filePath) => sha256File({ filePath }),
    failures,
    diagnostics: options.upgradeDiagnostics,
  });

  return {
    applicationVersion: options.applicationVersion,
    ids,
    clock,
    hashes: {
      sha256Text: async (value) => createHash("sha256").update(value).digest("hex"),
      sha256File: (filePath) => sha256File({ filePath }),
    },
    paths,
    registry,
    opening: { inspect: inspectOpening },
    witnesses: {
      inspect: async (projectId) => {
        try {
          const projectRoot = projectRootFor(projectId);
          const [registryKinds, filesystem] = await Promise.all([
            Effect.runPromise(
              registryOperations.registryWitnesses(projectId, path.resolve(projectRoot)),
            ),
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
    locks: createProjectStorageLocksFacade(),
  };
}

export function createNodeProjectStorageDependencies(
  options: NodeProjectStorageOptions,
): ProjectStorageStoreDependencies {
  return createNodeAdapters(options);
}

export { createOpeningRelease };
