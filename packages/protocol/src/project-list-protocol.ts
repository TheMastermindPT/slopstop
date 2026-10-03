import { z } from "zod";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { InitialRepositoryBindingSchema } from "./project-registration-protocol.js";
import {
  PersistenceHealthSchema,
  ProjectStorageDiagnosticCodeSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";

export const ProjectListStorageSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("healthy"),
    storageId: StorageIdSchema,
    generationId: StorageGenerationIdSchema,
  }),
  z.strictObject({
    status: z.literal("safe-mode"),
    storageId: StorageIdSchema.nullable(),
    generationId: StorageGenerationIdSchema.nullable(),
    canonical: PersistenceHealthSchema,
    runtime: PersistenceHealthSchema,
  }),
  z.strictObject({ status: z.literal("not-registered") }),
  z.strictObject({ status: z.literal("unavailable"), code: ProjectStorageDiagnosticCodeSchema }),
  z.strictObject({ status: z.literal("broken"), code: ProjectStorageDiagnosticCodeSchema }),
]);
export const ProjectListLocationSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("present") }),
  z.strictObject({ status: z.literal("not-bound") }),
  z.strictObject({ status: z.literal("missing"), code: z.literal("REPOSITORY_NOT_FOUND") }),
  z.strictObject({ status: z.literal("changed"), code: z.literal("REPOSITORY_IDENTITY_CHANGED") }),
  z.strictObject({
    status: z.literal("unavailable"),
    code: z.enum(["REPOSITORY_INACCESSIBLE", "IDENTITY_CAPABILITY_UNAVAILABLE"]),
  }),
  z.strictObject({ status: z.literal("invalid"), code: z.literal("OBSERVATION_INVALID") }),
  z.strictObject({ status: z.literal("broken"), code: z.literal("INTERNAL_FAILURE") }),
]);
const common = {
  projectId: ProjectIdSchema,
  storage: ProjectListStorageSchema,
  repositoryLocation: ProjectListLocationSchema,
  access: z.literal("not-assessed"),
};
const binding = {
  repositoryBindingId: InitialRepositoryBindingSchema.shape.repositoryBindingId,
  workspaceId: InitialRepositoryBindingSchema.shape.workspaceId,
};
export const ProjectListEntrySchema = z.discriminatedUnion("registration", [
  z.strictObject({ registration: z.literal("registered"), ...common, ...binding }),
  z.strictObject({
    registration: z.literal("incomplete"),
    code: z.literal("REGISTRATION_INCOMPLETE"),
    ...common,
    ...binding,
  }),
  z.strictObject({ registration: z.literal("unbound"), ...common }),
]);
export const ProjectListSchema = z.strictObject({
  status: z.literal("listed"),
  projects: z.array(ProjectListEntrySchema),
});
export type ProjectList = z.infer<typeof ProjectListSchema>;

export const ProjectListRequestSchema = z.strictObject({});
export const ProjectListResultSchema = z.union([
  ProjectListSchema,
  z.strictObject({ status: z.literal("cancelled") }),
  z.strictObject({
    status: z.literal("broken"),
    code: z.enum([
      "REGISTRY_SCHEMA_UNKNOWN",
      "REGISTRY_SCHEMA_NEWER",
      "REGISTRY_CORRUPT",
      "INTERNAL_FAILURE",
      "PROJECT_LIST_TRANSPORT_FAILED",
    ]),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    code: z.enum(["REGISTRY_BUSY", "PROJECT_LIST_UNAVAILABLE"]),
  }),
  z.strictObject({
    status: z.literal("pending-recovery"),
    code: z.enum(["REGISTRY_MISSING_WITH_WITNESS", "OBSERVER_CLEANUP_UNCONFIRMED"]),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    code: z.literal("REGISTRATION_IDEMPOTENCY_CONFLICT"),
  }),
]);
export type ProjectListResult = z.infer<typeof ProjectListResultSchema>;
