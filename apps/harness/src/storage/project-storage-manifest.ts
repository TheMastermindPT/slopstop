import {
  CanonicalDatabaseLineageIdSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { z } from "zod";

export const projectStorageManifestFilename = "manifest.json";
export const canonicalDatabaseFilename = "slopstop.db";
export const runtimeDatabaseFilename = "mastra.db";
export const canonicalWriterLeaseFilename = ".slopstop-writer.lock";

const safeNonnegativeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const utcInstantSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "UTC instant must end in Z.");
const activationBaselineSchema = z.strictObject({
  algorithm: z.literal("sha256"),
  sizeBytes: safeNonnegativeIntegerSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
});

const ProjectStorageManifestV1Schema = z.strictObject({
  manifestVersion: z.literal(1),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  provenance: z.strictObject({
    kind: z.literal("initial-create"),
    createRequestId: ProjectStorageCreateRequestIdSchema,
    sourceGenerationId: z.null(),
    storageOperationId: z.null(),
  }),
  canonical: z.strictObject({
    kind: z.literal("canonical"),
    databaseLineageId: CanonicalDatabaseLineageIdSchema,
    filename: z.literal(canonicalDatabaseFilename),
    formatVersion: safeNonnegativeIntegerSchema,
    schemaVersion: safeNonnegativeIntegerSchema,
    lastMigrationId: z.string().trim().min(1),
    activationBaseline: activationBaselineSchema,
  }),
  runtime: z.strictObject({
    kind: z.literal("runtime"),
    databaseLineageId: RuntimeDatabaseLineageIdSchema,
    filename: z.literal(runtimeDatabaseFilename),
    adapterFormatVersion: safeNonnegativeIntegerSchema,
    adapterSchemaVersion: safeNonnegativeIntegerSchema,
    adapterLastMigrationId: z.string().trim().min(1),
    mastraMigrationHead: z.null(),
    activationBaseline: activationBaselineSchema,
  }),
  projectSequence: z.literal(0),
  runtimeWaterline: z.literal(0),
  producingApplicationVersion: z.string().trim().min(1),
  createdAt: utcInstantSchema,
});
export type ProjectStorageManifestV1 = z.infer<typeof ProjectStorageManifestV1Schema>;

export function parseProjectStorageManifest(source: string): ProjectStorageManifestV1 {
  const json: unknown = JSON.parse(source);
  return ProjectStorageManifestV1Schema.parse(json);
}

export function serializeProjectStorageManifest(input: unknown): string {
  const manifest = ProjectStorageManifestV1Schema.parse(input);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
