import {
  CanonicalDatabaseLineageIdSchema,
  dateTimeTextSchema,
  decodeStrictResult,
  NonEmptyTextSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
  TrimmedNonEmptyTextSchema,
  UuidTextSchema,
} from "@slopstop/protocol";
import { Result, Schema } from "effect";
import type { LocalLibsqlResultSet } from "./local-libsql-worker-client.js";
import { SqlIntegerSchema } from "./sql-integer-schema.js";

const sqlIntegerSchema = SqlIntegerSchema.check(Schema.isGreaterThanOrEqualTo(0));

export function integerScalar(result: LocalLibsqlResultSet): number | undefined {
  const row = result.rows[0];
  if (row === undefined) return undefined;
  const validShape = [result.rows.length === 1, row.length === 1].every(Boolean);
  if (!validShape) return undefined;
  const parsed = decodeStrictResult(sqlIntegerSchema, row[0]);
  return Result.isSuccess(parsed) ? parsed.success : undefined;
}
export const utcInstantSchema = dateTimeTextSchema({ offset: true }).check(
  Schema.makeFilter((value: string) => value.endsWith("Z") || "UTC instant must end in Z."),
);
export const privateLocationIdSchema = UuidTextSchema.check(
  Schema.makeFilter(
    (value: string) => value === value.toLowerCase() || "Identity must use lowercase UUID text.",
  ),
);
const sha256Schema = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));

export const stagingDeclarationSchema = Schema.Struct({
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
  normalizedPath: NonEmptyTextSchema,
  generationDirectoryName: StorageGenerationIdSchema,
  locationState: Schema.Literal("staging"),
  creationState: Schema.Literal("staging"),
});
export type StagingDeclaration = typeof stagingDeclarationSchema.Type;

export const activationSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  generationId: StorageGenerationIdSchema,
  activatedAt: utcInstantSchema,
});
export type Activation = typeof activationSchema.Type;

export const metadataRowSchema = Schema.Struct({
  metadataKey: TrimmedNonEmptyTextSchema,
  databaseKind: Schema.Literals(["application", "canonical", "runtime-adapter"]),
  formatVersion: sqlIntegerSchema,
  schemaVersion: sqlIntegerSchema,
  lastMigrationId: TrimmedNonEmptyTextSchema,
});
export type MetadataRow = typeof metadataRowSchema.Type;

export const generationRowSchema = Schema.Struct({
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  projectId: ProjectIdSchema,
  locationId: privateLocationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
  createRequestFingerprint: sha256Schema,
  generationDirectoryName: StorageGenerationIdSchema,
  creationState: Schema.Literals(["staging", "active"]),
  createdAt: utcInstantSchema,
  activatedAt: Schema.NullOr(utcInstantSchema),
});
export type GenerationRow = typeof generationRowSchema.Type;

export const registrationRowSchema = Schema.Struct({
  storageId: StorageIdSchema,
  projectId: ProjectIdSchema,
  activeGenerationId: Schema.NullOr(StorageGenerationIdSchema),
  activeLocationId: Schema.NullOr(privateLocationIdSchema),
  createdAt: utcInstantSchema,
  activatedAt: Schema.NullOr(utcInstantSchema),
});
export type RegistrationRow = typeof registrationRowSchema.Type;

export const locationRowSchema = Schema.Struct({
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  normalizedPath: NonEmptyTextSchema,
  locationState: Schema.Literals(["staging", "committed"]),
  observedAt: utcInstantSchema,
});
export type LocationRow = typeof locationRowSchema.Type;

export const canonicalIdentityRowSchema = Schema.Struct({
  identityKey: Schema.Literal("storage"),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  createdAt: utcInstantSchema,
});

export const runtimeIdentityRowSchema = Schema.Struct({
  identityKey: Schema.Literal("storage"),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createdAt: utcInstantSchema,
});
