import type {
  CanonicalEventId as KernelCanonicalEventId,
  CanonicalEventOrdinal as KernelCanonicalEventOrdinal,
  CommandId as KernelCommandId,
  CommandReceiptId as KernelCommandReceiptId,
  ProjectActivationId as KernelProjectActivationId,
  ProjectSequence as KernelProjectSequence,
  WriterGeneration as KernelWriterGeneration,
} from "@slopstop/kernel";
import { isCanonicalEventOrdinal, isProjectSequence, isWriterGeneration } from "@slopstop/kernel";
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

export const CommandReceiptIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCommandReceiptId>(),
);
export type CommandReceiptId = z.infer<typeof CommandReceiptIdSchema>;
export const CanonicalEventIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCanonicalEventId>(),
);
export type CanonicalEventId = z.infer<typeof CanonicalEventIdSchema>;
export const ProjectSequenceSchema = z.custom<KernelProjectSequence>(
  (value) => typeof value === "number" && isProjectSequence(value),
);
export type ProjectSequence = z.infer<typeof ProjectSequenceSchema>;
export const CanonicalEventOrdinalSchema = z.custom<KernelCanonicalEventOrdinal>(
  (value) => typeof value === "number" && isCanonicalEventOrdinal(value),
);
export type CanonicalEventOrdinal = z.infer<typeof CanonicalEventOrdinalSchema>;
export const CanonicalSettlementTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => /T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value), {
    message: "Settlement time must include seconds and use UTC Z notation.",
  });

export const SystemCommandRejectionCodeSchema = z.enum([
  "IDEMPOTENCY_CONFLICT",
  "COMMAND_TYPE_UNSUPPORTED",
  "COMMAND_PAYLOAD_INVALID",
]);
export const CommandRejectionCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/u);
export const CommandRejectionSchema = z
  .strictObject({
    code: CommandRejectionCodeSchema,
    retryable: z.boolean(),
  })
  .refine(
    (value) => !SystemCommandRejectionCodeSchema.safeParse(value.code).success || !value.retryable,
    { message: "System command rejections are not retryable." },
  )
  .readonly();
export type CommandRejection = z.infer<typeof CommandRejectionSchema>;

export const CommandReceiptMetadataSchema = z.strictObject({
  receiptId: CommandReceiptIdSchema,
  projectId: ProjectIdSchema,
  commandId: CommandIdSchema,
  commandType: z
    .string()
    .min(1)
    .refine((value) => value === value.trim()),
  commandVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  projectSequence: ProjectSequenceSchema,
  writerGeneration: WriterGenerationSchema,
  settledAt: CanonicalSettlementTimeSchema,
});
const eventReferenceSchema = z
  .strictObject({
    eventId: CanonicalEventIdSchema,
    eventOrdinal: CanonicalEventOrdinalSchema,
  })
  .readonly();
const eventReferencesSchema = z
  .array(eventReferenceSchema)
  .refine(
    (events) =>
      new Set(events.map((event) => event.eventId)).size === events.length &&
      events.every((event, index) => event.eventOrdinal === index),
    { message: "Event references must be unique and in contiguous ordinal order." },
  )
  .readonly();
export const CanonicalCommandReceiptSchema = z
  .discriminatedUnion("outcome", [
    CommandReceiptMetadataSchema.extend({
      outcome: z.literal("applied"),
      events: eventReferencesSchema,
    }),
    CommandReceiptMetadataSchema.extend({
      outcome: z.literal("unchanged"),
      events: z.tuple([]).readonly(),
    }),
    CommandReceiptMetadataSchema.extend({
      outcome: z.literal("rejected"),
      events: z.tuple([]).readonly(),
      rejection: CommandRejectionSchema,
    }),
  ])
  .readonly();
export type CanonicalCommandReceipt = z.infer<typeof CanonicalCommandReceiptSchema>;

const diagnosticSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});
export const CanonicalProjectActivationDiagnosticCodeSchema = z.enum([
  ...RegisteredProjectSelectionCodeSchema.options,
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
  activationFailureSchema("rejected", [
    "PROJECT_ALREADY_ACTIVE",
    ...RegisteredProjectSelectionCodeSchema.extract([
      "REPOSITORY_NOT_FOUND",
      "REPOSITORY_IDENTITY_CHANGED",
      "REPOSITORY_INVALID",
      "OBSERVATION_INVALID",
      "REGISTRATION_IDEMPOTENCY_CONFLICT",
    ]).options,
  ]),
  activationFailureSchema("unavailable", [
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "PROJECT_STORAGE_UNAVAILABLE",
    ...RegisteredProjectSelectionCodeSchema.extract([
      "REGISTRY_BUSY",
      "REGISTRY_MISSING_WITH_WITNESS",
      "OBSERVER_CLEANUP_UNCONFIRMED",
      "REGISTRATION_INCOMPLETE",
      "REPOSITORY_INACCESSIBLE",
      "IDENTITY_CAPABILITY_UNAVAILABLE",
      "REPOSITORY_UNSUPPORTED",
      "OBSERVATION_LIMIT_EXCEEDED",
    ]).options,
  ]),
  activationFailureSchema("broken", [
    "PROJECT_STORAGE_BROKEN",
    ...RegisteredProjectSelectionCodeSchema.extract([
      "REGISTRY_SCHEMA_UNKNOWN",
      "REGISTRY_SCHEMA_NEWER",
      "REGISTRY_CORRUPT",
      "INTERNAL_FAILURE",
    ]).options,
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

function isFiniteJson(value: unknown, ancestors: Set<object>): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      return isFiniteJsonContainer(value, ancestors);
    default:
      return false;
  }
}

function isJsonContainer(value: object): boolean {
  if (Array.isArray(value)) return true;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteJsonMember(value: object, key: string | symbol, ancestors: Set<object>): boolean {
  if (typeof key !== "string") return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return false;
  if (!descriptor.enumerable || !("value" in descriptor)) return false;
  const child: unknown = descriptor.value;
  return isFiniteJson(child, ancestors);
}

function isFiniteJsonContainer(value: object, ancestors: Set<object>): boolean {
  if (ancestors.has(value) || !isJsonContainer(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value)) {
    if (keys.pop() !== "length") return false;
    if (keys.length !== value.length) return false;
    if (!keys.every((key, index) => key === String(index))) return false;
  }
  ancestors.add(value);
  try {
    return keys.every((key) => isFiniteJsonMember(value, key, ancestors));
  } finally {
    ancestors.delete(value);
  }
}

export const CanonicalJsonValueSchema = z.custom<z.infer<ReturnType<typeof z.json>>>(
  (value) => isFiniteJson(value, new Set()),
  { message: "Value must be finite JSON data." },
);
export type CanonicalJsonValue = z.infer<typeof CanonicalJsonValueSchema>;

export const TypedCommandSchema = z.strictObject({
  commandId: CommandIdSchema,
  type: z.string().trim().min(1),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  payload: CanonicalJsonValueSchema,
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
  "COMMAND_IN_PROGRESS",
  "PROJECT_SEQUENCE_EXHAUSTED",
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
export const CanonicalProjectCommandResultSchema = z
  .discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("settled"),
      projectId: ProjectIdSchema,
      activationId: ProjectActivationIdSchema,
      commandId: CommandIdSchema,
      receipt: CanonicalCommandReceiptSchema,
    }),
    commandOutcomeSchema("command-busy", "COMMAND_IN_PROGRESS", true),
    commandOutcomeSchema("writer-unavailable", "WRITER_UNAVAILABLE", false),
    commandOutcomeSchema("sequence-exhausted", "PROJECT_SEQUENCE_EXHAUSTED", false),
    commandOutcomeSchema("inactive", "PROJECT_INACTIVE", false),
    commandOutcomeSchema("project-mismatch", "PROJECT_NOT_ACTIVE", false),
    commandOutcomeSchema("stale-activation", "PROJECT_ACTIVATION_STALE", false),
    commandOutcomeSchema("read-only", "WRITER_UNAVAILABLE", true),
    commandOutcomeSchema("stale-writer", "WRITER_FENCE_STALE", false),
    commandOutcomeSchema("broken", "WRITER_FENCE_CHECK_FAILED", false),
    commandOutcomeSchema("settlement-unavailable", "COMMAND_SETTLEMENT_UNAVAILABLE", false),
    commandOutcomeSchema("coordinator-unavailable", "PROJECT_COORDINATOR_UNAVAILABLE", false),
  ])
  .refine(
    (result) =>
      result.status !== "settled" ||
      (result.receipt.projectId === result.projectId &&
        result.receipt.commandId === result.commandId),
    { path: ["receipt"], message: "Receipt must match command result correlation." },
  );
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
      sourceReleased: z.boolean().optional(),
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

import { RegisteredProjectSelectionCodeSchema } from "./project-registration-protocol.js";
