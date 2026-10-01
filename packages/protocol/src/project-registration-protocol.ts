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
