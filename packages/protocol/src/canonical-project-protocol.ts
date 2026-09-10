import type {
  CommandId as KernelCommandId,
  ProjectActivationId as KernelProjectActivationId,
  WriterGeneration as KernelWriterGeneration,
} from "@slopstop/kernel";
import { isWriterGeneration } from "@slopstop/kernel";
import { z } from "zod";
import {
  domainIdentitySchema,
  lowercaseDomainIdentitySchema,
  ProjectIdSchema,
} from "./domain-identity-schema.js";
import {
  CanonicalDatabaseLineageIdSchema,
  ProjectDatabaseHealthSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";

export const ProjectActivationIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelProjectActivationId>(),
);
export type ProjectActivationId = z.infer<typeof ProjectActivationIdSchema>;
export const CommandIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCommandId>(),
);
export type CommandId = z.infer<typeof CommandIdSchema>;
export const WriterGenerationSchema = z.custom<KernelWriterGeneration>(
  (value) => typeof value === "number" && isWriterGeneration(value),
  { message: "Writer generation must be a positive safe integer." },
);
export type WriterGeneration = z.infer<typeof WriterGenerationSchema>;

const diagnosticSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});
export const CanonicalProjectActivationDiagnosticCodeSchema = z.enum([
  "PROJECT_ALREADY_ACTIVE",
  "PROJECT_COORDINATOR_UNAVAILABLE",
  "PROJECT_STORAGE_UNAVAILABLE",
  "PROJECT_STORAGE_BROKEN",
  "PROJECT_STORAGE_RELEASE_FAILED",
  "WRITER_LEASE_OPEN_FAILED",
  "WRITER_LEASE_LOCK_FAILED",
  "WRITER_LEASE_UNLOCK_FAILED",
  "WRITER_LEASE_CLOSE_FAILED",
  "WRITER_FENCE_ACTIVATION_FAILED",
  "WRITER_FENCE_STALE",
  "WRITER_FENCE_RELEASE_FAILED",
  "WRITER_REPOSITORY_CLOSE_FAILED",
]);
export type CanonicalProjectActivationDiagnosticCode = z.infer<
  typeof CanonicalProjectActivationDiagnosticCodeSchema
>;
export const CanonicalProjectActivationRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
});
export type CanonicalProjectActivationRequest = z.infer<
  typeof CanonicalProjectActivationRequestSchema
>;
const activationBase = { request: CanonicalProjectActivationRequestSchema };

function activationFailureSchema<const Status extends "rejected" | "unavailable" | "broken">(
  status: Status,
  codes: readonly [
    CanonicalProjectActivationDiagnosticCode,
    ...CanonicalProjectActivationDiagnosticCode[],
  ],
) {
  return z.strictObject({
    status: z.literal(status),
    ...activationBase,
    diagnostic: diagnosticSchema.extend({ code: z.enum(codes) }),
  });
}

export const CanonicalProjectActivationResultSchema = z.union([
  z.discriminatedUnion("access", [
    z.strictObject({
      status: z.literal("active"),
      ...activationBase,
      access: z.literal("read-write"),
      activationId: ProjectActivationIdSchema,
      writerGeneration: WriterGenerationSchema,
    }),
    z.strictObject({
      status: z.literal("active"),
      ...activationBase,
      access: z.literal("read-only"),
      activationId: ProjectActivationIdSchema,
      writerGeneration: z.null(),
      diagnostic: diagnosticSchema.extend({
        code: z.literal("WRITER_UNAVAILABLE"),
        retryable: z.literal(true),
      }),
    }),
  ]),
  z.strictObject({
    status: z.literal("safe-mode"),
    ...activationBase,
    identity: z.strictObject({
      storageId: StorageIdSchema.nullable(),
      generationId: StorageGenerationIdSchema.nullable(),
      canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.nullable(),
      runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.nullable(),
    }),
    canonicalHealth: ProjectDatabaseHealthSchema,
    runtimeHealth: ProjectDatabaseHealthSchema,
  }),
  z.strictObject({ status: z.literal("not-registered"), ...activationBase }),
  activationFailureSchema("rejected", ["PROJECT_ALREADY_ACTIVE"]),
  activationFailureSchema("unavailable", [
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "PROJECT_STORAGE_UNAVAILABLE",
  ]),
  activationFailureSchema("broken", [
    "PROJECT_STORAGE_BROKEN",
    "PROJECT_STORAGE_RELEASE_FAILED",
    "WRITER_LEASE_OPEN_FAILED",
    "WRITER_LEASE_LOCK_FAILED",
    "WRITER_LEASE_UNLOCK_FAILED",
    "WRITER_LEASE_CLOSE_FAILED",
    "WRITER_FENCE_ACTIVATION_FAILED",
    "WRITER_FENCE_STALE",
    "WRITER_FENCE_RELEASE_FAILED",
    "WRITER_REPOSITORY_CLOSE_FAILED",
  ]),
]);
export type CanonicalProjectActivationResult = z.infer<
  typeof CanonicalProjectActivationResultSchema
>;

export const TypedCommandSchema = z.strictObject({
  commandId: CommandIdSchema,
  type: z.string().trim().min(1),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  payload: z.json(),
});
export type TypedCommand = z.infer<typeof TypedCommandSchema>;
export const CanonicalProjectCommandRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
  activationId: ProjectActivationIdSchema,
  command: TypedCommandSchema,
});
export type CanonicalProjectCommandRequest = z.infer<typeof CanonicalProjectCommandRequestSchema>;
export const CanonicalProjectCommandDiagnosticCodeSchema = z.enum([
  "PROJECT_INACTIVE",
  "PROJECT_NOT_ACTIVE",
  "PROJECT_ACTIVATION_STALE",
  "WRITER_UNAVAILABLE",
  "WRITER_FENCE_STALE",
  "WRITER_FENCE_CHECK_FAILED",
  "COMMAND_SETTLEMENT_UNAVAILABLE",
  "PROJECT_COORDINATOR_UNAVAILABLE",
]);
export type CanonicalProjectCommandDiagnosticCode = z.infer<
  typeof CanonicalProjectCommandDiagnosticCodeSchema
>;

function commandOutcomeSchema<
  const Status extends string,
  const Code extends CanonicalProjectCommandDiagnosticCode,
>(status: Status, code: Code, retryable: boolean) {
  return z.strictObject({
    status: z.literal(status),
    projectId: ProjectIdSchema,
    activationId: ProjectActivationIdSchema,
    commandId: CommandIdSchema,
    diagnostic: diagnosticSchema.extend({ code: z.literal(code), retryable: z.literal(retryable) }),
  });
}
export const CanonicalProjectCommandResultSchema = z.discriminatedUnion("status", [
  commandOutcomeSchema("inactive", "PROJECT_INACTIVE", false),
  commandOutcomeSchema("project-mismatch", "PROJECT_NOT_ACTIVE", false),
  commandOutcomeSchema("stale-activation", "PROJECT_ACTIVATION_STALE", false),
  commandOutcomeSchema("read-only", "WRITER_UNAVAILABLE", true),
  commandOutcomeSchema("stale-writer", "WRITER_FENCE_STALE", false),
  commandOutcomeSchema("broken", "WRITER_FENCE_CHECK_FAILED", false),
  commandOutcomeSchema("settlement-unavailable", "COMMAND_SETTLEMENT_UNAVAILABLE", false),
  commandOutcomeSchema("coordinator-unavailable", "PROJECT_COORDINATOR_UNAVAILABLE", false),
]);
export type CanonicalProjectCommandResult = z.infer<typeof CanonicalProjectCommandResultSchema>;

export const CanonicalProjectSwitchRequestSchema = z.strictObject({
  from: z.strictObject({
    projectId: ProjectIdSchema,
    activationId: ProjectActivationIdSchema,
  }),
  to: CanonicalProjectActivationRequestSchema,
});
export type CanonicalProjectSwitchRequest = z.infer<typeof CanonicalProjectSwitchRequestSchema>;

function switchOutcomeSchema<
  const Status extends
    | "inactive"
    | "project-mismatch"
    | "stale-activation"
    | "coordinator-unavailable",
  const Code extends CanonicalProjectCommandDiagnosticCode,
>(status: Status, code: Code) {
  return z.strictObject({
    status: z.literal(status),
    request: CanonicalProjectSwitchRequestSchema,
    diagnostic: diagnosticSchema.extend({
      code: z.literal(code),
      retryable: z.literal(false),
    }),
  });
}

const switchReleaseDiagnosticSchema = z.union([
  diagnosticSchema.extend({
    code: CanonicalProjectActivationDiagnosticCodeSchema.extract(["WRITER_FENCE_STALE"]),
    retryable: z.literal(false),
  }),
  diagnosticSchema.extend({
    code: CanonicalProjectActivationDiagnosticCodeSchema.extract([
      "WRITER_FENCE_RELEASE_FAILED",
      "WRITER_REPOSITORY_CLOSE_FAILED",
      "WRITER_LEASE_OPEN_FAILED",
      "WRITER_LEASE_LOCK_FAILED",
      "WRITER_LEASE_UNLOCK_FAILED",
      "WRITER_LEASE_CLOSE_FAILED",
      "PROJECT_STORAGE_RELEASE_FAILED",
    ]),
    retryable: z.literal(true),
  }),
]);

export const CanonicalProjectSwitchResultSchema = z
  .discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("target-result"),
      request: CanonicalProjectSwitchRequestSchema,
      target: CanonicalProjectActivationResultSchema,
    }),
    switchOutcomeSchema("inactive", "PROJECT_INACTIVE"),
    switchOutcomeSchema("project-mismatch", "PROJECT_NOT_ACTIVE"),
    switchOutcomeSchema("stale-activation", "PROJECT_ACTIVATION_STALE"),
    switchOutcomeSchema("coordinator-unavailable", "PROJECT_COORDINATOR_UNAVAILABLE"),
    z.strictObject({
      status: z.literal("release-failed"),
      request: CanonicalProjectSwitchRequestSchema,
      diagnostic: switchReleaseDiagnosticSchema,
    }),
  ])
  .refine(
    (result) =>
      result.status !== "target-result" ||
      result.target.request.projectId === result.request.to.projectId,
    {
      path: ["target", "request", "projectId"],
      message: "Switch target Project must match the requested destination.",
    },
  );
export type CanonicalProjectSwitchResult = z.infer<typeof CanonicalProjectSwitchResultSchema>;
