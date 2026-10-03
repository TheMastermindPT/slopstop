import { Schema } from "effect";
import { LowercaseDomainIdentityTextSchema, ProjectIdSchema } from "./domain-identity-schema.js";
import { NonEmptyTextSchema, wholeUnion } from "./schema-codec.js";

export const StorageIdSchema = LowercaseDomainIdentityTextSchema.pipe(Schema.brand("StorageId"));
export type StorageId = typeof StorageIdSchema.Type;
export const StorageGenerationIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("StorageGenerationId"),
);
export type StorageGenerationId = typeof StorageGenerationIdSchema.Type;
export const CanonicalDatabaseLineageIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("CanonicalDatabaseLineageId"),
);
export type CanonicalDatabaseLineageId = typeof CanonicalDatabaseLineageIdSchema.Type;
export const RuntimeDatabaseLineageIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RuntimeDatabaseLineageId"),
);
export type RuntimeDatabaseLineageId = typeof RuntimeDatabaseLineageIdSchema.Type;
export const ProjectStorageCreateRequestIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("ProjectStorageCreateRequestId"),
);
export type ProjectStorageCreateRequestId = typeof ProjectStorageCreateRequestIdSchema.Type;

export const PersistenceHealthSchema = Schema.Literals([
  "healthy",
  "migration-required",
  "recovery-required",
  "missing",
  "corrupt",
  "identity-conflict",
  "unsupported-newer",
  "unavailable",
  "broken",
]);
export type PersistenceHealth = typeof PersistenceHealthSchema.Type;

type DatabaseHealthDiagnosticCode =
  | "DATABASE_MIGRATION_REQUIRED"
  | "DATABASE_RECOVERY_REQUIRED"
  | "DATABASE_MISSING"
  | "DATABASE_CORRUPT"
  | "DATABASE_IDENTITY_CONFLICT"
  | "DATABASE_UNSUPPORTED_NEWER"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_BROKEN";

function unhealthyHealthSchema<
  const Status extends Exclude<PersistenceHealth, "healthy">,
  const Code extends DatabaseHealthDiagnosticCode,
>(status: Status, code: Code) {
  return Schema.Struct({
    status: Schema.Literal(status),
    diagnostic: Schema.Struct({ code: Schema.Literal(code), message: NonEmptyTextSchema }),
  });
}

const HealthyDatabaseSchema = Schema.Struct({ status: Schema.Literal("healthy") });

export const ProjectDatabaseHealthSchema = Schema.Union([
  HealthyDatabaseSchema,
  unhealthyHealthSchema("migration-required", "DATABASE_MIGRATION_REQUIRED"),
  unhealthyHealthSchema("recovery-required", "DATABASE_RECOVERY_REQUIRED"),
  unhealthyHealthSchema("missing", "DATABASE_MISSING"),
  unhealthyHealthSchema("corrupt", "DATABASE_CORRUPT"),
  unhealthyHealthSchema("identity-conflict", "DATABASE_IDENTITY_CONFLICT"),
  unhealthyHealthSchema("unsupported-newer", "DATABASE_UNSUPPORTED_NEWER"),
  unhealthyHealthSchema("unavailable", "DATABASE_UNAVAILABLE"),
  unhealthyHealthSchema("broken", "DATABASE_BROKEN"),
]);
export type ProjectDatabaseHealth = typeof ProjectDatabaseHealthSchema.Type;

export const ProjectStorageDiagnosticCodeSchema = Schema.Literals([
  "PROJECT_STORAGE_UNAVAILABLE",
  "PROJECT_STORAGE_OWNER_FAILED",
  "PROJECT_STORAGE_RESULT_INVALID",
  "PROJECT_STORAGE_TRANSPORT_FAILED",
  "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
  "PROJECT_STORAGE_ALREADY_REGISTERED",
  "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT",
]);
export type ProjectStorageDiagnosticCode = typeof ProjectStorageDiagnosticCodeSchema.Type;
export const ProjectStorageDiagnosticSchema = Schema.Struct({
  code: ProjectStorageDiagnosticCodeSchema,
  message: NonEmptyTextSchema,
});
export type ProjectStorageDiagnostic = typeof ProjectStorageDiagnosticSchema.Type;

function unavailableResultSchema<RequestSchema extends Schema.Top>(request: RequestSchema) {
  return Schema.Struct({
    status: Schema.Literal("unavailable"),
    request,
    diagnostic: Schema.Struct({
      code: Schema.Literal("PROJECT_STORAGE_UNAVAILABLE"),
      message: NonEmptyTextSchema,
    }),
  });
}

function brokenResultSchema<RequestSchema extends Schema.Top>(request: RequestSchema) {
  return Schema.Struct({
    status: Schema.Literal("broken"),
    request,
    diagnostic: Schema.Struct({
      code: Schema.Literals([
        "PROJECT_STORAGE_OWNER_FAILED",
        "PROJECT_STORAGE_RESULT_INVALID",
        "PROJECT_STORAGE_TRANSPORT_FAILED",
      ]),
      message: NonEmptyTextSchema,
    }),
  });
}

export const ProjectStorageOpenRequestSchema = Schema.Struct({ projectId: ProjectIdSchema });
export type ProjectStorageOpenRequest = typeof ProjectStorageOpenRequestSchema.Type;
export const ProjectStorageCreateRequestSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
});
export type ProjectStorageCreateRequest = typeof ProjectStorageCreateRequestSchema.Type;
export const ProjectStorageCloseRequestSchema = Schema.Struct({ projectId: ProjectIdSchema });
export type ProjectStorageCloseRequest = typeof ProjectStorageCloseRequestSchema.Type;

const OpenedStorageIdentitySchema = Schema.Struct({
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
});
export type OpenedStorageIdentity = typeof OpenedStorageIdentitySchema.Type;

export const SafeModeStorageIdentitySchema = Schema.Struct({
  storageId: Schema.NullOr(StorageIdSchema),
  generationId: Schema.NullOr(StorageGenerationIdSchema),
  canonicalDatabaseLineageId: Schema.NullOr(CanonicalDatabaseLineageIdSchema),
  runtimeDatabaseLineageId: Schema.NullOr(RuntimeDatabaseLineageIdSchema),
});

const OpenedResultSchema = Schema.Struct({
  status: Schema.Literal("opened"),
  request: ProjectStorageOpenRequestSchema,
  mode: Schema.Literal("read-write"),
  identity: OpenedStorageIdentitySchema,
  canonicalHealth: HealthyDatabaseSchema,
  runtimeHealth: HealthyDatabaseSchema,
});
const SafeModeResultSchema = Schema.Struct({
  status: Schema.Literal("safe-mode"),
  request: ProjectStorageOpenRequestSchema,
  mode: Schema.Literal("safe-mode"),
  identity: SafeModeStorageIdentitySchema,
  canonicalHealth: ProjectDatabaseHealthSchema,
  runtimeHealth: ProjectDatabaseHealthSchema,
});
const NotRegisteredResultSchema = Schema.Struct({
  status: Schema.Literal("not-registered"),
  request: ProjectStorageOpenRequestSchema,
});
export const ProjectStorageOpenResultSchema = Schema.Union([
  OpenedResultSchema,
  SafeModeResultSchema,
  NotRegisteredResultSchema,
  unavailableResultSchema(ProjectStorageOpenRequestSchema),
  brokenResultSchema(ProjectStorageOpenRequestSchema),
]).check(
  Schema.makeFilter(
    (value) =>
      value.status !== "safe-mode" ||
      value.canonicalHealth.status !== "healthy" ||
      value.runtimeHealth.status !== "healthy" || {
        path: ["mode"],
        issue: "Safe mode requires at least one non-healthy database.",
      },
  ),
);
export type ProjectStorageOpenResult = typeof ProjectStorageOpenResultSchema.Type;

function blockedCreateResultSchema<
  const Reason extends string,
  const Code extends ProjectStorageDiagnosticCode,
>(reason: Reason, code: Code) {
  return Schema.Struct({
    status: Schema.Literal("blocked"),
    request: ProjectStorageCreateRequestSchema,
    reason: Schema.Literal(reason),
    diagnostic: Schema.Struct({ code: Schema.Literal(code), message: NonEmptyTextSchema }),
  });
}

const CreatedResultSchema = Schema.Struct({
  status: Schema.Literal("created"),
  request: ProjectStorageCreateRequestSchema,
  mode: Schema.Literal("read-write"),
  identity: OpenedStorageIdentitySchema,
});
export const ProjectStorageCreateResultSchema = wholeUnion([
  CreatedResultSchema,
  blockedCreateResultSchema("prior-state-witness", "PROJECT_STORAGE_PRIOR_STATE_WITNESS"),
  blockedCreateResultSchema("already-registered", "PROJECT_STORAGE_ALREADY_REGISTERED"),
  blockedCreateResultSchema("idempotency-conflict", "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT"),
  unavailableResultSchema(ProjectStorageCreateRequestSchema),
  brokenResultSchema(ProjectStorageCreateRequestSchema),
]);
export type ProjectStorageCreateResult = typeof ProjectStorageCreateResultSchema.Type;

const ClosedResultSchema = Schema.Struct({
  status: Schema.Literal("closed"),
  request: ProjectStorageCloseRequestSchema,
});
export const ProjectStorageCloseResultSchema = Schema.Union([
  ClosedResultSchema,
  unavailableResultSchema(ProjectStorageCloseRequestSchema),
  brokenResultSchema(ProjectStorageCloseRequestSchema),
]);
export type ProjectStorageCloseResult = typeof ProjectStorageCloseResultSchema.Type;
