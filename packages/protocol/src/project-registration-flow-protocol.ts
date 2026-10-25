import { Schema } from "effect";
import { LowercaseDomainIdentityTextSchema, ProjectIdSchema } from "./domain-identity-schema.js";
import {
  RegistrationIdempotencyConflictSchema,
  RegistryPendingRecoverySchema,
} from "./project-list-protocol.js";
import { registryBrokenCodes } from "./project-registration-protocol.js";
import { NonEmptyTextSchema, Sha256HexSchema, wholeUnion } from "./schema-codec.js";

const DecisionSchema = Schema.Literals(["accepted", "declined"]);

/** Registration flow identities; the wire carries them as plain strict text, the harness brands them. */
export const RegistrationPreparationRequestIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RegistrationPreparationRequestId"),
);
export type RegistrationPreparationRequestId = typeof RegistrationPreparationRequestIdSchema.Type;
export const ExecutableSelectionIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("ExecutableSelectionId"),
);
export type ExecutableSelectionId = typeof ExecutableSelectionIdSchema.Type;
export const VersionObservationIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("VersionObservationId"),
);
export type VersionObservationId = typeof VersionObservationIdSchema.Type;
export const IdentityQueryConsentIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("IdentityQueryConsentId"),
);
export type IdentityQueryConsentId = typeof IdentityQueryConsentIdSchema.Type;
export const RepositorySelectionIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RepositorySelectionId"),
);
export type RepositorySelectionId = typeof RepositorySelectionIdSchema.Type;
export const RepositoryTrustIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("RepositoryTrustId"),
);
export type RepositoryTrustId = typeof RepositoryTrustIdSchema.Type;
export const ExecutableConsentIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("ExecutableConsentId"),
);
export type ExecutableConsentId = typeof ExecutableConsentIdSchema.Type;

/** The folder trust and Git consent a proposal is prepared under. */
const PreparationFields = {
  preparationRequestId: LowercaseDomainIdentityTextSchema,
  selectionId: LowercaseDomainIdentityTextSchema,
  observationId: LowercaseDomainIdentityTextSchema,
  identityQueryConsentId: LowercaseDomainIdentityTextSchema,
  repositorySelectionId: LowercaseDomainIdentityTextSchema,
  trustId: LowercaseDomainIdentityTextSchema,
};

/** A Project answered for the folder; its name is the registered worktree folder name. */
const NamedProjectFields = { projectId: ProjectIdSchema, name: NonEmptyTextSchema };

/** The registration steps the renderer may request through the preload API. */
const RendererRegistrationSteps = [
  Schema.Struct({
    step: Schema.Literal("decide-trust"),
    repositorySelectionId: LowercaseDomainIdentityTextSchema,
    trustId: LowercaseDomainIdentityTextSchema,
    decision: DecisionSchema,
  }),
  Schema.Struct({ step: Schema.Literal("prepare-git") }),
  Schema.Struct({
    step: Schema.Literal("decide-git-version"),
    selectionId: LowercaseDomainIdentityTextSchema,
    executableConsentId: LowercaseDomainIdentityTextSchema,
    decision: DecisionSchema,
  }),
  Schema.Struct({
    step: Schema.Literal("decide-identity-queries"),
    selectionId: LowercaseDomainIdentityTextSchema,
    observationId: LowercaseDomainIdentityTextSchema,
    identityQueryConsentId: LowercaseDomainIdentityTextSchema,
    decision: DecisionSchema,
  }),
  Schema.Struct({ step: Schema.Literal("prepare"), ...PreparationFields }),
  Schema.Struct({
    step: Schema.Literal("confirm"),
    requestId: LowercaseDomainIdentityTextSchema,
    ...PreparationFields,
    proposalId: LowercaseDomainIdentityTextSchema,
    proposalFingerprint: Sha256HexSchema,
  }),
  Schema.Struct({ step: Schema.Literal("remove-from-list"), projectId: ProjectIdSchema }),
] as const;

/**
 * One step of adding an existing repository. The selected directory comes from the desktop
 * main process's native folder dialog, never from the renderer.
 */
export const ProjectRegistrationRequestSchema = Schema.Union([
  Schema.Struct({ step: Schema.Literal("select-repository"), directory: NonEmptyTextSchema }),
  ...RendererRegistrationSteps,
]);
export type ProjectRegistrationRequest = typeof ProjectRegistrationRequestSchema.Type;

/** Failures every registration step can report; busy and broken registries stay distinct. */
const ProjectRegistrationFailureSchemas = [
  Schema.Struct({ status: Schema.Literal("cancelled") }),
  Schema.Struct({
    status: Schema.Literal("broken"),
    code: Schema.Literals([
      ...registryBrokenCodes,
      "INTERNAL_FAILURE",
      "PROJECT_REGISTRATION_TRANSPORT_FAILED",
    ]),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literals([
      "REGISTRY_BUSY",
      "PROJECT_REGISTRATION_UNAVAILABLE",
      "IDENTITY_CAPABILITY_UNAVAILABLE",
      "REPOSITORY_INACCESSIBLE",
      "REPOSITORY_TRUST_REQUIRED",
      "GIT_UNAVAILABLE",
      "GIT_CONFIRMATION_REQUIRED",
      "OBSERVATION_LIMIT_EXCEEDED",
    ]),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literal("GIT_QUERY_FAILED"),
    exitCode: Schema.Number.check(Schema.isInt()),
  }),
  Schema.Struct({
    status: Schema.Literal("rejected"),
    code: Schema.Literals([
      "REPOSITORY_NOT_FOUND",
      "OBSERVATION_INVALID",
      "REPOSITORY_INVALID",
      "NOT_WORKING_TREE",
      "BARE_REPOSITORY",
      "REPOSITORY_UNSUPPORTED",
      "REPOSITORY_IDENTITY_CHANGED",
      "PROJECT_ACTIVE",
      "PROJECT_NOT_FOUND",
      "REGISTRATION_INCOMPLETE",
    ]),
  }),
  RegistrationIdempotencyConflictSchema,
  RegistryPendingRecoverySchema,
  Schema.Struct({
    status: Schema.Literal("pending-recovery"),
    code: Schema.Literals(["REGISTRATION_INCOMPLETE", "PRIOR_STATE_WITNESS"]),
  }),
] as const;

export const ProjectRegistrationResultSchema = wholeUnion([
  Schema.Struct({
    status: Schema.Literal("repository-selected"),
    repositorySelectionId: LowercaseDomainIdentityTextSchema,
  }),
  Schema.Struct({ status: Schema.Literal("trust-recorded") }),
  Schema.Struct({
    status: Schema.Literal("git-prepared"),
    selectionId: LowercaseDomainIdentityTextSchema,
    executablePath: NonEmptyTextSchema,
  }),
  Schema.Struct({
    status: Schema.Literal("git-version-observed"),
    selectionId: LowercaseDomainIdentityTextSchema,
    observationId: LowercaseDomainIdentityTextSchema,
    version: NonEmptyTextSchema,
  }),
  Schema.Struct({ status: Schema.Literal("identity-queries-recorded") }),
  Schema.Struct({
    status: Schema.Literal("proposal-prepared"),
    proposalId: LowercaseDomainIdentityTextSchema,
    proposalFingerprint: Sha256HexSchema,
    name: NonEmptyTextSchema,
    repositoryDirectory: NonEmptyTextSchema,
    worktree: NonEmptyTextSchema,
    gitVersion: NonEmptyTextSchema,
  }),
  Schema.Struct({ status: Schema.Literal("registered"), ...NamedProjectFields }),
  Schema.Struct({ status: Schema.Literal("already-registered"), ...NamedProjectFields }),
  Schema.Struct({
    status: Schema.Literal("belongs-to-project"),
    ...NamedProjectFields,
    /** Present when that Project was removed from the saved list. */
    hiddenFromList: Schema.optional(Schema.Literal(true)),
  }),
  Schema.Struct({ status: Schema.Literal("restored-to-list"), ...NamedProjectFields }),
  Schema.Struct({ status: Schema.Literal("removed"), projectId: ProjectIdSchema }),
  ...ProjectRegistrationFailureSchemas,
]);
export type ProjectRegistrationResult = typeof ProjectRegistrationResultSchema.Type;

/** A registration step the renderer requests; it can never carry a directory. */
export const RendererRegistrationRequestSchema = Schema.Union(RendererRegistrationSteps);
export type RendererRegistrationRequest = typeof RendererRegistrationRequestSchema.Type;

/**
 * The outcome of the main process's own folder dialog: the selection it recorded, with the
 * chosen directory for display only.
 */
export const RepositoryChoiceResultSchema = wholeUnion([
  Schema.Struct({
    status: Schema.Literal("repository-selected"),
    repositorySelectionId: LowercaseDomainIdentityTextSchema,
    directory: NonEmptyTextSchema,
  }),
  ...ProjectRegistrationFailureSchemas,
]);
export type RepositoryChoiceResult = typeof RepositoryChoiceResultSchema.Type;

/** Whether this platform can add repositories at all, known before any folder dialog (B4). */
export const RegistrationCapabilitySchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("available") }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literal("IDENTITY_CAPABILITY_UNAVAILABLE"),
  }),
]);
export type RegistrationCapability = typeof RegistrationCapabilitySchema.Type;
