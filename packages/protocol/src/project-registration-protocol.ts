import { Schema } from "effect";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import {
  ProjectStorageCreateRequestSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";
import { UuidTextSchema } from "./schema-codec.js";

const RepositoryBindingIdSchema = UuidTextSchema.pipe(Schema.brand("RepositoryBindingId"));
const WorkspaceIdSchema = UuidTextSchema.pipe(Schema.brand("WorkspaceId"));
const RegistrationRequestIdSchema = UuidTextSchema.pipe(Schema.brand("RegistrationRequestId"));

export const InitialRepositoryBindingSchema = Schema.Struct({
  ...ProjectStorageCreateRequestSchema.fields,
  reservationId: UuidTextSchema,
  reservationFingerprint: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  repositoryBindingId: RepositoryBindingIdSchema,
  workspaceId: WorkspaceIdSchema,
  registrationRequestId: RegistrationRequestIdSchema,
});
export type InitialRepositoryBinding = typeof InitialRepositoryBindingSchema.Type;

export const RegisteredProjectSchema = Schema.Struct({
  status: Schema.Literal("registered"),
  requestId: RegistrationRequestIdSchema,
  proposalId: UuidTextSchema.pipe(Schema.brand("RegistrationProposalId")),
  projectId: ProjectIdSchema,
  repositoryBindingId: RepositoryBindingIdSchema,
  workspaceId: WorkspaceIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
});
export type RegisteredProject = typeof RegisteredProjectSchema.Type;

export const registeredProjectSelectionCodes = [
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
] as const;
export const RegisteredProjectSelectionCodeSchema = Schema.Literals(
  registeredProjectSelectionCodes,
);
export type RegisteredProjectSelectionCode = typeof RegisteredProjectSelectionCodeSchema.Type;
