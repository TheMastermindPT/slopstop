import {
  CanonicalDatabaseLineageIdSchema,
  dateTimeTextSchema,
  decodeStrict,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
  TrimmedNonEmptyTextSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";

export const projectStorageManifestFilename = "manifest.json";
export const canonicalDatabaseFilename = "slopstop.db";
export const runtimeDatabaseFilename = "mastra.db";
export const canonicalWriterLeaseFilename = ".slopstop-writer.lock";

const safeNonnegativeIntegerSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);
const utcInstantSchema = dateTimeTextSchema({ offset: true }).check(
  Schema.makeFilter((value: string) => value.endsWith("Z") || "UTC instant must end in Z."),
);
const activationBaselineSchema = Schema.Struct({
  algorithm: Schema.Literal("sha256"),
  sizeBytes: safeNonnegativeIntegerSchema,
  sha256: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u)),
});

const manifestIdentityFields = {
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
};
const manifestTrailerFields = {
  producingApplicationVersion: TrimmedNonEmptyTextSchema,
  createdAt: utcInstantSchema,
};

const ProjectStorageManifestV1Schema = Schema.Struct({
  manifestVersion: Schema.Literal(1),
  ...manifestIdentityFields,
  provenance: Schema.Struct({
    kind: Schema.Literal("initial-create"),
    createRequestId: ProjectStorageCreateRequestIdSchema,
    sourceGenerationId: Schema.Null,
    storageOperationId: Schema.Null,
  }),
  canonical: Schema.Struct({
    kind: Schema.Literal("canonical"),
    databaseLineageId: CanonicalDatabaseLineageIdSchema,
    filename: Schema.Literal(canonicalDatabaseFilename),
    formatVersion: safeNonnegativeIntegerSchema,
    schemaVersion: safeNonnegativeIntegerSchema,
    lastMigrationId: TrimmedNonEmptyTextSchema,
    activationBaseline: activationBaselineSchema,
  }),
  runtime: Schema.Struct({
    kind: Schema.Literal("runtime"),
    databaseLineageId: RuntimeDatabaseLineageIdSchema,
    filename: Schema.Literal(runtimeDatabaseFilename),
    adapterFormatVersion: safeNonnegativeIntegerSchema,
    adapterSchemaVersion: safeNonnegativeIntegerSchema,
    adapterLastMigrationId: TrimmedNonEmptyTextSchema,
    mastraMigrationHead: Schema.Null,
    activationBaseline: activationBaselineSchema,
  }),
  projectSequence: Schema.Literal(0),
  runtimeWaterline: Schema.Literal(0),
  ...manifestTrailerFields,
});

const stagedUpgradeProvenanceSchema = Schema.Struct({
  kind: Schema.Literal("staged-upgrade"),
  createRequestId: ProjectStorageCreateRequestIdSchema,
  sourceGenerationId: StorageGenerationIdSchema,
  storageOperationId: ProjectStorageCreateRequestIdSchema,
}).check(
  Schema.makeFilter(
    (provenance) =>
      provenance.storageOperationId === provenance.createRequestId ||
      "Upgrade storage operation must equal its create request.",
  ),
);

const ProjectStorageManifestV2Schema = Schema.Struct({
  manifestVersion: Schema.Literal(2),
  ...manifestIdentityFields,
  provenance: stagedUpgradeProvenanceSchema,
  canonical: ProjectStorageManifestV1Schema.fields.canonical,
  runtime: ProjectStorageManifestV1Schema.fields.runtime,
  projectSequence: safeNonnegativeIntegerSchema,
  runtimeWaterline: safeNonnegativeIntegerSchema,
  ...manifestTrailerFields,
});

const ProjectStorageManifestSchema = Schema.Union([
  ProjectStorageManifestV1Schema,
  ProjectStorageManifestV2Schema,
]);
export type ProjectStorageManifest = typeof ProjectStorageManifestSchema.Type;

export function parseProjectStorageManifest(source: string): ProjectStorageManifest {
  const json: unknown = JSON.parse(source);
  return decodeStrict(ProjectStorageManifestSchema, json);
}

export function serializeProjectStorageManifest(input: unknown): string {
  const manifest = decodeStrict(ProjectStorageManifestSchema, input);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const ProjectStorageBackupManifestV1Schema = Schema.Struct({
  manifestVersion: Schema.Literal(1),
  kind: Schema.Literal("pre-upgrade-backup"),
  backupId: ProjectStorageCreateRequestIdSchema,
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  sourceGenerationId: StorageGenerationIdSchema,
  canonical: ProjectStorageManifestV1Schema.fields.canonical,
  runtime: ProjectStorageManifestV1Schema.fields.runtime,
  projectSequence: safeNonnegativeIntegerSchema,
  runtimeWaterline: safeNonnegativeIntegerSchema,
  ...manifestTrailerFields,
});
export type ProjectStorageBackupManifest = typeof ProjectStorageBackupManifestV1Schema.Type;

/** Decodes a pre-upgrade backup manifest strictly; it holds no paths or credentials. */
export function parseProjectStorageBackupManifest(source: string): ProjectStorageBackupManifest {
  const json: unknown = JSON.parse(source);
  return decodeStrict(ProjectStorageBackupManifestV1Schema, json);
}

export function serializeProjectStorageBackupManifest(input: unknown): string {
  const manifest = decodeStrict(ProjectStorageBackupManifestV1Schema, input);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
