import {
  CanonicalDatabaseLineageIdSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { z } from "zod";
import type { LocalLibsqlResultSet } from "./local-libsql-worker-client.js";

const sqlIntegerSchema = z
  .union([z.number().int(), z.bigint()])
  .transform((value) => Number(value))
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));

export function integerScalar(result: LocalLibsqlResultSet): number | undefined {
  const row = result.rows[0];
  if (row === undefined) return undefined;
  const validShape = [result.rows.length === 1, row.length === 1].every(Boolean);
  if (!validShape) return undefined;
  const parsed = sqlIntegerSchema.safeParse(row[0]);
  return parsed.success ? parsed.data : undefined;
}
export const utcInstantSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "UTC instant must end in Z.");
export const privateLocationIdSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase(), "Identity must use lowercase UUID text.");
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);

export const stagingDeclarationSchema = z.strictObject({
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
  createRequestFingerprint: sha256Schema,
  createdAt: utcInstantSchema,
  observedAt: utcInstantSchema,
  normalizedPath: z.string().min(1),
  generationDirectoryName: StorageGenerationIdSchema,
  locationState: z.literal("staging"),
  creationState: z.literal("staging"),
});
export type StagingDeclaration = z.infer<typeof stagingDeclarationSchema>;

export const activationSchema = z.strictObject({
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  generationId: StorageGenerationIdSchema,
  activatedAt: utcInstantSchema,
});
export type Activation = z.infer<typeof activationSchema>;

export const metadataRowSchema = z.strictObject({
  metadataKey: z.string().trim().min(1),
  databaseKind: z.enum(["application", "canonical", "runtime-adapter"]),
  formatVersion: sqlIntegerSchema,
  schemaVersion: sqlIntegerSchema,
  lastMigrationId: z.string().trim().min(1),
});
export type MetadataRow = z.infer<typeof metadataRowSchema>;

export const generationRowSchema = z.strictObject({
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  projectId: ProjectIdSchema,
  locationId: privateLocationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
  createRequestFingerprint: sha256Schema,
  generationDirectoryName: StorageGenerationIdSchema,
  creationState: z.enum(["staging", "active"]),
  createdAt: utcInstantSchema,
  activatedAt: utcInstantSchema.nullable(),
});
export type GenerationRow = z.infer<typeof generationRowSchema>;

export const registrationRowSchema = z.strictObject({
  storageId: StorageIdSchema,
  projectId: ProjectIdSchema,
  activeGenerationId: StorageGenerationIdSchema.nullable(),
  activeLocationId: privateLocationIdSchema.nullable(),
  createdAt: utcInstantSchema,
  activatedAt: utcInstantSchema.nullable(),
});
export type RegistrationRow = z.infer<typeof registrationRowSchema>;

export const locationRowSchema = z.strictObject({
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  normalizedPath: z.string().min(1),
  locationState: z.enum(["staging", "committed"]),
  observedAt: utcInstantSchema,
});
export type LocationRow = z.infer<typeof locationRowSchema>;

export const canonicalIdentityRowSchema = z.strictObject({
  identityKey: z.literal("storage"),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  createdAt: utcInstantSchema,
});

export const runtimeIdentityRowSchema = z.strictObject({
  identityKey: z.literal("storage"),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createdAt: utcInstantSchema,
});
