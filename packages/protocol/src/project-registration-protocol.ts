import { z } from "zod";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import {
  ProjectStorageCreateRequestSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";

export const InitialRepositoryBindingSchema = ProjectStorageCreateRequestSchema.extend({
  reservationId: z.uuid(),
  reservationFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  repositoryBindingId: z.uuid().brand<"RepositoryBindingId">(),
  workspaceId: z.uuid().brand<"WorkspaceId">(),
  registrationRequestId: z.uuid().brand<"RegistrationRequestId">(),
});
export type InitialRepositoryBinding = z.infer<typeof InitialRepositoryBindingSchema>;

export const RegisteredProjectSchema = z.strictObject({
  status: z.literal("registered"),
  requestId: InitialRepositoryBindingSchema.shape.registrationRequestId,
  proposalId: z.uuid().brand<"RegistrationProposalId">(),
  projectId: ProjectIdSchema,
  repositoryBindingId: InitialRepositoryBindingSchema.shape.repositoryBindingId,
  workspaceId: InitialRepositoryBindingSchema.shape.workspaceId,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
});
export type RegisteredProject = z.infer<typeof RegisteredProjectSchema>;
export const RegisteredProjectSelectionCodeSchema = z.enum([
  "REGISTRY_SCHEMA_UNKNOWN",
  "REGISTRY_SCHEMA_NEWER",
  "REGISTRY_CORRUPT",
  "REGISTRY_BUSY",
  "REGISTRY_MISSING_WITH_WITNESS",
  "OBSERVER_CLEANUP_UNCONFIRMED",
  "REGISTRATION_INCOMPLETE",
  "REGISTRATION_IDEMPOTENCY_CONFLICT",
  "REPOSITORY_NOT_FOUND",
  "REPOSITORY_IDENTITY_CHANGED",
  "REPOSITORY_INACCESSIBLE",
  "IDENTITY_CAPABILITY_UNAVAILABLE",
  "REPOSITORY_INVALID",
  "REPOSITORY_UNSUPPORTED",
  "OBSERVATION_INVALID",
  "OBSERVATION_LIMIT_EXCEEDED",
  "INTERNAL_FAILURE",
]);
