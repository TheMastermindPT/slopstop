import type {
  CanonicalDatabaseLineageId as KernelCanonicalDatabaseLineageId,
  ProjectStorageCreateRequestId as KernelProjectStorageCreateRequestId,
  RuntimeDatabaseLineageId as KernelRuntimeDatabaseLineageId,
  StorageGenerationId as KernelStorageGenerationId,
  StorageId as KernelStorageId,
} from "@slopstop/kernel";
import { z } from "zod";
import {
  domainIdentitySchema,
  lowercaseDomainIdentitySchema,
  ProjectIdSchema,
} from "./domain-identity-schema.js";

export const StorageIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelStorageId>(),
);
export type StorageId = z.infer<typeof StorageIdSchema>;
export const StorageGenerationIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelStorageGenerationId>(),
);
export type StorageGenerationId = z.infer<typeof StorageGenerationIdSchema>;
export const CanonicalDatabaseLineageIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCanonicalDatabaseLineageId>(),
);
export type CanonicalDatabaseLineageId = z.infer<typeof CanonicalDatabaseLineageIdSchema>;
export const RuntimeDatabaseLineageIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelRuntimeDatabaseLineageId>(),
);
export type RuntimeDatabaseLineageId = z.infer<typeof RuntimeDatabaseLineageIdSchema>;
export const ProjectStorageCreateRequestIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelProjectStorageCreateRequestId>(),
);
export type ProjectStorageCreateRequestId = z.infer<typeof ProjectStorageCreateRequestIdSchema>;

export const PersistenceHealthSchema = z.enum([
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
export type PersistenceHealth = z.infer<typeof PersistenceHealthSchema>;

const DatabaseHealthDiagnosticSchema = z.strictObject({
  code: z.enum([
    "DATABASE_MIGRATION_REQUIRED",
    "DATABASE_RECOVERY_REQUIRED",
    "DATABASE_MISSING",
    "DATABASE_CORRUPT",
    "DATABASE_IDENTITY_CONFLICT",
    "DATABASE_UNSUPPORTED_NEWER",
    "DATABASE_UNAVAILABLE",
    "DATABASE_BROKEN",
  ]),
  message: z.string().min(1),
});

function unhealthyHealthSchema<
  const Status extends Exclude<PersistenceHealth, "healthy">,
  const Code extends z.infer<typeof DatabaseHealthDiagnosticSchema>["code"],
>(status: Status, code: Code) {
  return z.strictObject({
    status: z.literal(status),
    diagnostic: DatabaseHealthDiagnosticSchema.extend({ code: z.literal(code) }),
  });
}

export const ProjectDatabaseHealthSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("healthy") }),
  unhealthyHealthSchema("migration-required", "DATABASE_MIGRATION_REQUIRED"),
  unhealthyHealthSchema("recovery-required", "DATABASE_RECOVERY_REQUIRED"),
  unhealthyHealthSchema("missing", "DATABASE_MISSING"),
  unhealthyHealthSchema("corrupt", "DATABASE_CORRUPT"),
  unhealthyHealthSchema("identity-conflict", "DATABASE_IDENTITY_CONFLICT"),
  unhealthyHealthSchema("unsupported-newer", "DATABASE_UNSUPPORTED_NEWER"),
  unhealthyHealthSchema("unavailable", "DATABASE_UNAVAILABLE"),
  unhealthyHealthSchema("broken", "DATABASE_BROKEN"),
]);
export type ProjectDatabaseHealth = z.infer<typeof ProjectDatabaseHealthSchema>;

export const ProjectStorageDiagnosticCodeSchema = z.enum([
  "PROJECT_STORAGE_UNAVAILABLE",
  "PROJECT_STORAGE_OWNER_FAILED",
  "PROJECT_STORAGE_RESULT_INVALID",
  "PROJECT_STORAGE_TRANSPORT_FAILED",
  "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
  "PROJECT_STORAGE_ALREADY_REGISTERED",
  "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT",
]);
export type ProjectStorageDiagnosticCode = z.infer<typeof ProjectStorageDiagnosticCodeSchema>;
export const ProjectStorageDiagnosticSchema = z.strictObject({
  code: ProjectStorageDiagnosticCodeSchema,
  message: z.string().min(1),
});
export type ProjectStorageDiagnostic = z.infer<typeof ProjectStorageDiagnosticSchema>;

function unavailableResultSchema<RequestSchema extends z.ZodType>(request: RequestSchema) {
  return z.strictObject({
    status: z.literal("unavailable"),
    request,
    diagnostic: ProjectStorageDiagnosticSchema.extend({
      code: z.literal("PROJECT_STORAGE_UNAVAILABLE"),
    }),
  });
}

function brokenResultSchema<RequestSchema extends z.ZodType>(request: RequestSchema) {
  return z.strictObject({
    status: z.literal("broken"),
    request,
    diagnostic: ProjectStorageDiagnosticSchema.extend({
      code: z.enum([
        "PROJECT_STORAGE_OWNER_FAILED",
        "PROJECT_STORAGE_RESULT_INVALID",
        "PROJECT_STORAGE_TRANSPORT_FAILED",
      ]),
    }),
  });
}

export const ProjectStorageOpenRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
});
export type ProjectStorageOpenRequest = z.infer<typeof ProjectStorageOpenRequestSchema>;
export const ProjectStorageCreateRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
});
export type ProjectStorageCreateRequest = z.infer<typeof ProjectStorageCreateRequestSchema>;
export const ProjectStorageCloseRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
});
export type ProjectStorageCloseRequest = z.infer<typeof ProjectStorageCloseRequestSchema>;

const OpenedStorageIdentitySchema = z.strictObject({
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
});
export type OpenedStorageIdentity = z.infer<typeof OpenedStorageIdentitySchema>;

const OpenedResultSchema = z.strictObject({
  status: z.literal("opened"),
  request: ProjectStorageOpenRequestSchema,
  mode: z.literal("read-write"),
  identity: OpenedStorageIdentitySchema,
  canonicalHealth: z.strictObject({ status: z.literal("healthy") }),
  runtimeHealth: z.strictObject({ status: z.literal("healthy") }),
});
const SafeModeResultSchema = z.strictObject({
  status: z.literal("safe-mode"),
  request: ProjectStorageOpenRequestSchema,
  mode: z.literal("safe-mode"),
  identity: z.strictObject({
    storageId: StorageIdSchema.nullable(),
    generationId: StorageGenerationIdSchema.nullable(),
    canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.nullable(),
    runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.nullable(),
  }),
  canonicalHealth: ProjectDatabaseHealthSchema,
  runtimeHealth: ProjectDatabaseHealthSchema,
});
const NotRegisteredResultSchema = z.strictObject({
  status: z.literal("not-registered"),
  request: ProjectStorageOpenRequestSchema,
});
const OpenUnavailableResultSchema = unavailableResultSchema(ProjectStorageOpenRequestSchema);
const OpenBrokenResultSchema = brokenResultSchema(ProjectStorageOpenRequestSchema);
export const ProjectStorageOpenResultSchema = z
  .discriminatedUnion("status", [
    OpenedResultSchema,
    SafeModeResultSchema,
    NotRegisteredResultSchema,
    OpenUnavailableResultSchema,
    OpenBrokenResultSchema,
  ])
  .superRefine((value, context) => {
    if (
      value.status === "safe-mode" &&
      value.canonicalHealth.status === "healthy" &&
      value.runtimeHealth.status === "healthy"
    ) {
      context.addIssue({
        code: "custom",
        message: "Safe mode requires at least one non-healthy database.",
        path: ["mode"],
      });
    }
  });
export type ProjectStorageOpenResult = z.infer<typeof ProjectStorageOpenResultSchema>;

function blockedCreateResultSchema<
  const Reason extends string,
  const Code extends z.infer<typeof ProjectStorageDiagnosticSchema>["code"],
>(reason: Reason, code: Code) {
  return z.strictObject({
    status: z.literal("blocked"),
    request: ProjectStorageCreateRequestSchema,
    reason: z.literal(reason),
    diagnostic: ProjectStorageDiagnosticSchema.extend({ code: z.literal(code) }),
  });
}

const CreatedResultSchema = z.strictObject({
  status: z.literal("created"),
  request: ProjectStorageCreateRequestSchema,
  mode: z.literal("read-write"),
  identity: OpenedStorageIdentitySchema,
});
const CreateUnavailableResultSchema = unavailableResultSchema(ProjectStorageCreateRequestSchema);
const CreateBrokenResultSchema = brokenResultSchema(ProjectStorageCreateRequestSchema);
export const ProjectStorageCreateResultSchema = z.union([
  CreatedResultSchema,
  blockedCreateResultSchema("prior-state-witness", "PROJECT_STORAGE_PRIOR_STATE_WITNESS"),
  blockedCreateResultSchema("already-registered", "PROJECT_STORAGE_ALREADY_REGISTERED"),
  blockedCreateResultSchema("idempotency-conflict", "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT"),
  CreateUnavailableResultSchema,
  CreateBrokenResultSchema,
]);
export type ProjectStorageCreateResult = z.infer<typeof ProjectStorageCreateResultSchema>;

const ClosedResultSchema = z.strictObject({
  status: z.literal("closed"),
  request: ProjectStorageCloseRequestSchema,
});
const CloseUnavailableResultSchema = unavailableResultSchema(ProjectStorageCloseRequestSchema);
const CloseBrokenResultSchema = brokenResultSchema(ProjectStorageCloseRequestSchema);
export const ProjectStorageCloseResultSchema = z.discriminatedUnion("status", [
  ClosedResultSchema,
  CloseUnavailableResultSchema,
  CloseBrokenResultSchema,
]);
export type ProjectStorageCloseResult = z.infer<typeof ProjectStorageCloseResultSchema>;
