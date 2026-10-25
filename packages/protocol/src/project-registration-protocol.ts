import { Schema } from "effect";
import { LowercaseDomainIdentityTextSchema, ProjectIdSchema } from "./domain-identity-schema.js";
import {
  ProjectStorageCreateRequestSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";
import { Sha256HexSchema } from "./schema-codec.js";

export const RepositoryBindingIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RepositoryBindingId"),
);
export type RepositoryBindingId = typeof RepositoryBindingIdSchema.Type;
export const WorkspaceIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("WorkspaceId"),
);
export type WorkspaceId = typeof WorkspaceIdSchema.Type;
export const RegistrationRequestIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RegistrationRequestId"),
);
export type RegistrationRequestId = typeof RegistrationRequestIdSchema.Type;
export const RegistrationProposalIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RegistrationProposalId"),
);
export type RegistrationProposalId = typeof RegistrationProposalIdSchema.Type;

export const InitialRepositoryBindingSchema = Schema.Struct({
  ...ProjectStorageCreateRequestSchema.fields,
  reservationId: LowercaseDomainIdentityTextSchema,
  reservationFingerprint: Sha256HexSchema,
  repositoryBindingId: RepositoryBindingIdSchema,
  workspaceId: WorkspaceIdSchema,
  registrationRequestId: RegistrationRequestIdSchema,
});
export type InitialRepositoryBinding = typeof InitialRepositoryBindingSchema.Type;

export const RegisteredProjectSchema = Schema.Struct({
  status: Schema.Literal("registered"),
  requestId: RegistrationRequestIdSchema,
  proposalId: RegistrationProposalIdSchema,
  projectId: ProjectIdSchema,
  repositoryBindingId: RepositoryBindingIdSchema,
  workspaceId: WorkspaceIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
});
export type RegisteredProject = typeof RegisteredProjectSchema.Type;

/** The codes of an installation registry that cannot be read: one set for every result. */
export const registryBrokenCodes = [
  "REGISTRY_SCHEMA_UNKNOWN",
  "REGISTRY_SCHEMA_NEWER",
  "REGISTRY_CORRUPT",
] as const;
export const RegistryBrokenCodeSchema = Schema.Literals(registryBrokenCodes);
export type RegistryBrokenCode = typeof RegistryBrokenCodeSchema.Type;

const registryBrokenCodeSet: ReadonlySet<string> = new Set(registryBrokenCodes);

/** Whether a wider code is one of the registry-broken codes. */
export function isRegistryBrokenCode(code: string): code is RegistryBrokenCode {
  return registryBrokenCodeSet.has(code);
}

export const registeredProjectSelectionCodes = [
  ...registryBrokenCodes,
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
