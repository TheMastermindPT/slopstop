import { Schema } from "effect";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { InitialRepositoryBindingSchema } from "./project-registration-protocol.js";
import {
  PersistenceHealthSchema,
  ProjectStorageDiagnosticCodeSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";
import { EmptyObjectSchema, NonEmptyTextSchema, wholeUnion } from "./schema-codec.js";

/** Registry recovery outcome shared by the harness registry and the Project list result. */
export const RegistryPendingRecoverySchema = Schema.Struct({
  status: Schema.Literal("pending-recovery"),
  code: Schema.Literals(["REGISTRY_MISSING_WITH_WITNESS", "OBSERVER_CLEANUP_UNCONFIRMED"]),
});

/** Registration request reuse with a different payload, shared like the recovery outcome. */
export const RegistrationIdempotencyConflictSchema = Schema.Struct({
  status: Schema.Literal("rejected"),
  code: Schema.Literal("REGISTRATION_IDEMPOTENCY_CONFLICT"),
});

export const ProjectListStorageSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("healthy"),
    storageId: StorageIdSchema,
    generationId: StorageGenerationIdSchema,
  }),
  Schema.Struct({
    status: Schema.Literal("safe-mode"),
    storageId: Schema.NullOr(StorageIdSchema),
    generationId: Schema.NullOr(StorageGenerationIdSchema),
    canonical: PersistenceHealthSchema,
    runtime: PersistenceHealthSchema,
  }),
  Schema.Struct({ status: Schema.Literal("not-registered") }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: ProjectStorageDiagnosticCodeSchema,
  }),
  Schema.Struct({ status: Schema.Literal("broken"), code: ProjectStorageDiagnosticCodeSchema }),
]);
export const ProjectListLocationSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("present") }),
  Schema.Struct({ status: Schema.Literal("not-bound") }),
  Schema.Struct({
    status: Schema.Literal("missing"),
    code: Schema.Literal("REPOSITORY_NOT_FOUND"),
  }),
  Schema.Struct({
    status: Schema.Literal("changed"),
    code: Schema.Literal("REPOSITORY_IDENTITY_CHANGED"),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literals(["REPOSITORY_INACCESSIBLE", "IDENTITY_CAPABILITY_UNAVAILABLE"]),
  }),
  Schema.Struct({ status: Schema.Literal("invalid"), code: Schema.Literal("OBSERVATION_INVALID") }),
  Schema.Struct({ status: Schema.Literal("broken"), code: Schema.Literal("INTERNAL_FAILURE") }),
]);
const common = {
  projectId: ProjectIdSchema,
  storage: ProjectListStorageSchema,
  repositoryLocation: ProjectListLocationSchema,
  access: Schema.Literal("not-assessed"),
};
const binding = {
  name: NonEmptyTextSchema,
  repositoryBindingId: InitialRepositoryBindingSchema.fields.repositoryBindingId,
  workspaceId: InitialRepositoryBindingSchema.fields.workspaceId,
};
export const ProjectListEntrySchema = Schema.Union([
  Schema.Struct({ registration: Schema.Literal("registered"), ...common, ...binding }),
  Schema.Struct({
    registration: Schema.Literal("incomplete"),
    code: Schema.Literal("REGISTRATION_INCOMPLETE"),
    ...common,
    ...binding,
  }),
  Schema.Struct({ registration: Schema.Literal("unbound"), ...common }),
]);
export const ProjectListSchema = Schema.Struct({
  status: Schema.Literal("listed"),
  projects: Schema.Array(ProjectListEntrySchema),
});
export type ProjectList = typeof ProjectListSchema.Type;

export const ProjectListRequestSchema = EmptyObjectSchema;
export const ProjectListResultSchema = wholeUnion([
  ProjectListSchema,
  Schema.Struct({ status: Schema.Literal("cancelled") }),
  Schema.Struct({
    status: Schema.Literal("broken"),
    code: Schema.Literals([
      "REGISTRY_SCHEMA_UNKNOWN",
      "REGISTRY_SCHEMA_NEWER",
      "REGISTRY_CORRUPT",
      "INTERNAL_FAILURE",
      "PROJECT_LIST_TRANSPORT_FAILED",
    ]),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literals(["REGISTRY_BUSY", "PROJECT_LIST_UNAVAILABLE"]),
  }),
  RegistryPendingRecoverySchema,
  RegistrationIdempotencyConflictSchema,
]);
export type ProjectListResult = typeof ProjectListResultSchema.Type;
