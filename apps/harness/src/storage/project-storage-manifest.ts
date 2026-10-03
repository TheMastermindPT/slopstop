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

const ProjectStorageManifestV1Schema = Schema.Struct({
  manifestVersion: Schema.Literal(1),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
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
  producingApplicationVersion: TrimmedNonEmptyTextSchema,
  createdAt: utcInstantSchema,
});
export type ProjectStorageManifestV1 = typeof ProjectStorageManifestV1Schema.Type;

export function parseProjectStorageManifest(source: string): ProjectStorageManifestV1 {
  const json: unknown = JSON.parse(source);
  return decodeStrict(ProjectStorageManifestV1Schema, json);
}

export function serializeProjectStorageManifest(input: unknown): string {
  const manifest = decodeStrict(ProjectStorageManifestV1Schema, input);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
