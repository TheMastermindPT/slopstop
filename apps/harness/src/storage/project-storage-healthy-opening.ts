import type { ProjectId } from "@slopstop/protocol";
import { chainRetainedGenerationIds } from "./application-database-migration.js";
import {
  requireDeclaredSchemaObjects,
  requireOwnedSchemaObjects,
} from "./database-schema-verifier.js";
import type { GeneratedMigration } from "./generated-migrations.js";
import type { LocalLibsqlClient } from "./local-libsql-worker-client.js";
import { requireRegisteredProjectAuthority } from "./project-storage-create-inspection.js";
import {
  databaseIdentityMatches,
  inspectDatabaseIntegrity,
  metadataRows,
  requireForeignKeys,
} from "./project-storage-database-authority.js";
import { type DatabaseSpec, databaseSpecs } from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  type FilesystemWitnessScan,
  inspectFilesystemWitnesses,
  openingDatabaseIsPresent,
} from "./project-storage-filesystem-authority.js";
import type { ProjectStorageManifest } from "./project-storage-manifest.js";
import { isCorruptStorageError, isUnavailableStorageError } from "./project-storage-node-errors.js";
import type { GenerationRow, RegistrationRow } from "./project-storage-node-schemas.js";
import {
  createLocalClient,
  exactlyOne,
  type LocalClient,
  type ProjectStorageGenerationPaths,
} from "./project-storage-node-support.js";
import {
  compatibilityPrecedesIntegrity,
  expectedOpeningMetadata,
  inspectOpeningMetadata,
  inspectRegisteredRecovery,
  inspectUnregisteredOpening,
  type OpeningInspection,
  type ProjectDatabaseProbe,
  type ProjectStorageOpenEvidence,
  presentProjectDatabaseProbe,
  recoveryOpeningIdentity,
} from "./project-storage-opening.js";
import {
  generationRowsByProject,
  locationRowsByNormalizedPath,
  registrationRowsByProject,
} from "./project-storage-registry-rows.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";
import { type CompletedUpgrade, upgradeChainFor } from "./project-storage-upgrade-node-adapter.js";

type OpeningSelection = Readonly<{
  identity: Extract<ProjectStorageOpenEvidence, { status: "selected-current" }>["identity"];
  generation: GenerationRow;
  paths: ProjectStorageGenerationPaths;
  completedUpgrade: CompletedUpgrade | undefined;
}>;
export type HealthyOpeningSelectionInput = Readonly<{
  client: LocalClient;
  projectId: ProjectId;
  normalizedProjectRoot: string;
  filesystem: FilesystemWitnessScan;
  paths: ProjectStorageStoreDependencies["paths"];
}>;
export type MutableOpeningClients = {
  canonical: LocalClient | undefined;
  runtime: LocalClient | undefined;
};

export type ProjectDatabaseClientOpener = (input: {
  databaseKind: "canonical" | "runtime-adapter";
  open(): LocalLibsqlClient;
}) => LocalLibsqlClient;

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
  const chain = await upgradeChainFor(input.client, registration.storageId);
  const filesystemAgrees = [
    !input.filesystem.hasRootDatabaseWitness,
    sameDirectories(input.filesystem.ordinaryGenerationIds, [
      registration.activeGenerationId,
      ...chainRetainedGenerationIds(chain),
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
      completedUpgrade: chain.at(-1),
    },
  };
}

export async function confirmHealthyOpening(
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
  openProjectDatabaseClient?: ProjectDatabaseClientOpener | undefined;
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

export async function settledOpeningProbes(input: {
  selection: OpeningSelection;
  manifest: ProjectStorageManifest;
  loadMigrations(spec: DatabaseSpec): Promise<readonly GeneratedMigration[]>;
  openProjectDatabaseClient?: ProjectDatabaseClientOpener | undefined;
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
