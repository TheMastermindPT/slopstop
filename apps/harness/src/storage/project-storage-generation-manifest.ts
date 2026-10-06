import {
  canonicalDatabaseFilename,
  type ProjectStorageManifest,
  runtimeDatabaseFilename,
  serializeProjectStorageManifest,
} from "./project-storage-manifest.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";

type AllocatedCreation = Parameters<
  ProjectStorageStoreDependencies["databases"]["verifySealed"]
>[1];
type GenerationPaths = Parameters<ProjectStorageStoreDependencies["databases"]["verifySealed"]>[0];
type DatabaseBuild = Awaited<
  ReturnType<ProjectStorageStoreDependencies["databases"]["createCanonical"]>
>;
type DatabaseHead = Pick<DatabaseBuild, "formatVersion" | "schemaVersion" | "lastMigrationId">;
type ActivationBaseline = ProjectStorageManifest["canonical"]["activationBaseline"];

export type GenerationBaselines = Readonly<{
  canonical: ActivationBaseline;
  runtime: ActivationBaseline;
}>;

export async function readGenerationBaselines(
  dependencies: Pick<ProjectStorageStoreDependencies, "files" | "hashes">,
  paths: GenerationPaths,
): Promise<GenerationBaselines> {
  const [canonicalSize, canonicalHash, runtimeSize, runtimeHash] = await Promise.all([
    dependencies.files.size(paths.canonicalDatabase),
    dependencies.hashes.sha256File(paths.canonicalDatabase),
    dependencies.files.size(paths.runtimeDatabase),
    dependencies.hashes.sha256File(paths.runtimeDatabase),
  ]);
  return {
    canonical: { algorithm: "sha256", sizeBytes: canonicalSize, sha256: canonicalHash },
    runtime: { algorithm: "sha256", sizeBytes: runtimeSize, sha256: runtimeHash },
  };
}

/** How a generation came to be: an initial create, or a staged upgrade of a source generation. */
export type GenerationProvenance =
  | Readonly<{ kind: "initial-create" }>
  | Readonly<{
      kind: "staged-upgrade";
      sourceGenerationId: AllocatedCreation["generationId"];
      projectSequence: number;
      runtimeWaterline: number;
    }>;

function provenanceFields(creation: AllocatedCreation, provenance: GenerationProvenance) {
  if (provenance.kind === "initial-create") {
    return {
      manifestVersion: 1,
      provenance: {
        kind: "initial-create",
        createRequestId: creation.createRequestId,
        sourceGenerationId: null,
        storageOperationId: null,
      },
      projectSequence: 0,
      runtimeWaterline: 0,
    };
  }
  return {
    manifestVersion: 2,
    provenance: {
      kind: "staged-upgrade",
      createRequestId: creation.createRequestId,
      sourceGenerationId: provenance.sourceGenerationId,
      storageOperationId: creation.createRequestId,
    },
    projectSequence: provenance.projectSequence,
    runtimeWaterline: provenance.runtimeWaterline,
  };
}

/** The exact manifest of a sealed generation, decoded strictly before it is written. */
export function serializeGenerationManifest(
  input: Readonly<{
    creation: AllocatedCreation;
    provenance: GenerationProvenance;
    canonical: DatabaseHead;
    runtime: DatabaseHead;
    baselines: GenerationBaselines;
    applicationVersion: string;
  }>,
): string {
  const { creation, canonical, runtime, baselines } = input;
  return serializeProjectStorageManifest({
    ...provenanceFields(creation, input.provenance),
    projectId: creation.projectId,
    storageId: creation.storageId,
    generationId: creation.generationId,
    canonical: {
      kind: "canonical",
      databaseLineageId: creation.canonicalDatabaseLineageId,
      filename: canonicalDatabaseFilename,
      formatVersion: canonical.formatVersion,
      schemaVersion: canonical.schemaVersion,
      lastMigrationId: canonical.lastMigrationId,
      activationBaseline: baselines.canonical,
    },
    runtime: {
      kind: "runtime",
      databaseLineageId: creation.runtimeDatabaseLineageId,
      filename: runtimeDatabaseFilename,
      adapterFormatVersion: runtime.formatVersion,
      adapterSchemaVersion: runtime.schemaVersion,
      adapterLastMigrationId: runtime.lastMigrationId,
      mastraMigrationHead: null,
      activationBaseline: baselines.runtime,
    },
    producingApplicationVersion: input.applicationVersion,
    createdAt: creation.createdAt,
  });
}
