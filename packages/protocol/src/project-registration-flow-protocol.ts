import { Schema } from "effect";
import {
  RegistrationIdempotencyConflictSchema,
  RegistryPendingRecoverySchema,
} from "./project-list-protocol.js";
import { NonEmptyTextSchema, UuidTextSchema, wholeUnion } from "./schema-codec.js";

const DecisionSchema = Schema.Literals(["accepted", "declined"]);

/**
 * One step of adding an existing repository. The selected directory comes from the desktop
 * main process's native folder dialog, never from the renderer.
 */
export const ProjectRegistrationRequestSchema = Schema.Union([
  Schema.Struct({ step: Schema.Literal("select-repository"), directory: NonEmptyTextSchema }),
  Schema.Struct({
    step: Schema.Literal("decide-trust"),
    repositorySelectionId: UuidTextSchema,
    trustId: UuidTextSchema,
    decision: DecisionSchema,
  }),
  Schema.Struct({ step: Schema.Literal("prepare-git") }),
  Schema.Struct({
    step: Schema.Literal("decide-git-version"),
    selectionId: UuidTextSchema,
    consentId: UuidTextSchema,
    decision: DecisionSchema,
  }),
  Schema.Struct({
    step: Schema.Literal("decide-identity-queries"),
    selectionId: UuidTextSchema,
    observationId: UuidTextSchema,
    consentId: UuidTextSchema,
    decision: DecisionSchema,
  }),
]);
export type ProjectRegistrationRequest = typeof ProjectRegistrationRequestSchema.Type;

/** Failures every registration step can report; busy and broken registries stay distinct. */
const ProjectRegistrationFailureSchemas = [
  Schema.Struct({ status: Schema.Literal("cancelled") }),
  Schema.Struct({
    status: Schema.Literal("broken"),
    code: Schema.Literals([
      "REGISTRY_SCHEMA_UNKNOWN",
      "REGISTRY_SCHEMA_NEWER",
      "REGISTRY_CORRUPT",
      "INTERNAL_FAILURE",
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
    code: Schema.Literals(["REPOSITORY_NOT_FOUND", "OBSERVATION_INVALID"]),
  }),
  RegistrationIdempotencyConflictSchema,
  RegistryPendingRecoverySchema,
] as const;

export const ProjectRegistrationResultSchema = wholeUnion([
  Schema.Struct({
    status: Schema.Literal("repository-selected"),
    repositorySelectionId: UuidTextSchema,
  }),
  Schema.Struct({ status: Schema.Literal("trust-recorded") }),
  Schema.Struct({
    status: Schema.Literal("git-prepared"),
    selectionId: UuidTextSchema,
    executablePath: NonEmptyTextSchema,
  }),
  Schema.Struct({
    status: Schema.Literal("git-version-observed"),
    selectionId: UuidTextSchema,
    observationId: UuidTextSchema,
    version: NonEmptyTextSchema,
  }),
  Schema.Struct({ status: Schema.Literal("identity-queries-recorded") }),
  ...ProjectRegistrationFailureSchemas,
]);
export type ProjectRegistrationResult = typeof ProjectRegistrationResultSchema.Type;
