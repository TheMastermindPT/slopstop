import {
  CanonicalEventOrdinalSchema as KernelCanonicalEventOrdinalSchema,
  ProjectSequenceSchema as KernelProjectSequenceSchema,
  WriterGenerationSchema as KernelWriterGenerationSchema,
} from "@slopstop/kernel";
import { Schema } from "effect";
import { LowercaseDomainIdentityTextSchema, ProjectIdSchema } from "./domain-identity-schema.js";
import {
  type RegisteredProjectSelectionCode,
  registeredProjectSelectionCodes,
} from "./project-registration-protocol.js";
import {
  ProjectDatabaseHealthSchema,
  SafeModeStorageIdentitySchema,
} from "./project-storage-protocol.js";
import {
  dateTimeTextSchema,
  frozenOutput,
  NonEmptyTextSchema,
  TrimmedNonEmptyTextSchema,
  wholeUnion,
} from "./schema-codec.js";

export const ProjectActivationIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("ProjectActivationId"),
);
export type ProjectActivationId = typeof ProjectActivationIdSchema.Type;
export const CommandIdSchema = LowercaseDomainIdentityTextSchema.pipe(Schema.brand("CommandId"));
export type CommandId = typeof CommandIdSchema.Type;
export const WriterGenerationSchema = KernelWriterGenerationSchema.annotate({
  message: "Writer generation must be a positive safe integer.",
});
export type WriterGeneration = typeof WriterGenerationSchema.Type;

export const CommandReceiptIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("CommandReceiptId"),
);
export type CommandReceiptId = typeof CommandReceiptIdSchema.Type;
export const CanonicalEventIdSchema = LowercaseDomainIdentityTextSchema.pipe(
  Schema.brand("CanonicalEventId"),
);
export type CanonicalEventId = typeof CanonicalEventIdSchema.Type;
export const ProjectSequenceSchema = KernelProjectSequenceSchema;
export type ProjectSequence = typeof ProjectSequenceSchema.Type;
export const CanonicalEventOrdinalSchema = KernelCanonicalEventOrdinalSchema;
export type CanonicalEventOrdinal = typeof CanonicalEventOrdinalSchema.Type;
export const CanonicalSettlementTimeSchema = dateTimeTextSchema({ offset: true }).check(
  Schema.isPattern(/T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u, {
    message: "Settlement time must include seconds and use UTC Z notation.",
  }),
);

const systemCommandRejectionCodes = [
  "IDEMPOTENCY_CONFLICT",
  "COMMAND_TYPE_UNSUPPORTED",
  "COMMAND_PAYLOAD_INVALID",
] as const;
export const SystemCommandRejectionCodeSchema = Schema.Literals(systemCommandRejectionCodes);
const isSystemCommandRejectionCode = Schema.is(SystemCommandRejectionCodeSchema);
export const CommandRejectionCodeSchema = Schema.String.check(
  Schema.isPattern(/^[A-Z][A-Z0-9_]{0,63}$/u),
);
export const CommandRejectionSchema = frozenOutput(
  Schema.Struct({
    code: CommandRejectionCodeSchema,
    retryable: Schema.Boolean,
  }).check(
    Schema.makeFilter(
      (value) =>
        !isSystemCommandRejectionCode(value.code) ||
        !value.retryable ||
        "System command rejections are not retryable.",
    ),
  ),
);
export type CommandRejection = typeof CommandRejectionSchema.Type;

const PositiveVersionSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));

export const CommandReceiptMetadataSchema = Schema.Struct({
  receiptId: CommandReceiptIdSchema,
  projectId: ProjectIdSchema,
  commandId: CommandIdSchema,
  commandType: NonEmptyTextSchema.check(Schema.isTrimmed()),
  commandVersion: PositiveVersionSchema,
  projectSequence: ProjectSequenceSchema,
  writerGeneration: WriterGenerationSchema,
  settledAt: CanonicalSettlementTimeSchema,
});
const eventReferenceSchema = frozenOutput(
  Schema.Struct({
    eventId: CanonicalEventIdSchema,
    eventOrdinal: CanonicalEventOrdinalSchema,
  }),
);
const eventReferencesSchema = frozenOutput(
  Schema.Array(eventReferenceSchema).check(
    Schema.makeFilter(
      (events) =>
        (new Set(events.map((event) => event.eventId)).size === events.length &&
          events.every((event, index) => event.eventOrdinal === index)) ||
        "Event references must be unique and in contiguous ordinal order.",
    ),
  ),
);
const NoEventsSchema = frozenOutput(Schema.Tuple([]));
const CanonicalCommandReceiptVariantsSchema = Schema.Union([
  Schema.Struct({
    ...CommandReceiptMetadataSchema.fields,
    outcome: Schema.Literal("applied"),
    events: eventReferencesSchema,
  }),
  Schema.Struct({
    ...CommandReceiptMetadataSchema.fields,
    outcome: Schema.Literal("unchanged"),
    events: NoEventsSchema,
  }),
  Schema.Struct({
    ...CommandReceiptMetadataSchema.fields,
    outcome: Schema.Literal("rejected"),
    events: NoEventsSchema,
    rejection: CommandRejectionSchema,
  }),
]);
export const CanonicalCommandReceiptSchema = frozenOutput(CanonicalCommandReceiptVariantsSchema);
export type CanonicalCommandReceipt = typeof CanonicalCommandReceiptSchema.Type;

const diagnosticFields = {
  code: NonEmptyTextSchema,
  message: NonEmptyTextSchema,
  retryable: Schema.Boolean,
};

function diagnosticSchema<CodeSchema extends Schema.Top, RetryableSchema extends Schema.Top>(
  code: CodeSchema,
  retryable: RetryableSchema,
) {
  return Schema.Struct({ ...diagnosticFields, code, retryable });
}

const canonicalProjectActivationDiagnosticCodes = [
  ...registeredProjectSelectionCodes,
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
] as const;
export const CanonicalProjectActivationDiagnosticCodeSchema = Schema.Literals(
  canonicalProjectActivationDiagnosticCodes,
);
export type CanonicalProjectActivationDiagnosticCode =
  typeof CanonicalProjectActivationDiagnosticCodeSchema.Type;
export const CanonicalProjectActivationRequestSchema = Schema.Struct({
  projectId: ProjectIdSchema,
});
export type CanonicalProjectActivationRequest = typeof CanonicalProjectActivationRequestSchema.Type;
const activationBase = { request: CanonicalProjectActivationRequestSchema };

function activationFailureSchema<
  const Status extends "rejected" | "unavailable" | "broken",
  const Codes extends readonly [
    CanonicalProjectActivationDiagnosticCode,
    ...CanonicalProjectActivationDiagnosticCode[],
  ],
>(status: Status, codes: Codes) {
  return Schema.Struct({
    status: Schema.Literal(status),
    ...activationBase,
    diagnostic: diagnosticSchema(Schema.Literals(codes), Schema.Boolean),
  });
}

const selectionCodes = <const Codes extends readonly RegisteredProjectSelectionCode[]>(
  codes: Codes,
) => codes;

export const CanonicalProjectActivationResultSchema = wholeUnion([
  Schema.Struct({
    status: Schema.Literal("active"),
    ...activationBase,
    access: Schema.Literal("read-write"),
    activationId: ProjectActivationIdSchema,
    writerGeneration: WriterGenerationSchema,
  }),
  Schema.Struct({
    status: Schema.Literal("active"),
    ...activationBase,
    access: Schema.Literal("read-only"),
    activationId: ProjectActivationIdSchema,
    writerGeneration: Schema.Null,
    diagnostic: diagnosticSchema(Schema.Literal("WRITER_UNAVAILABLE"), Schema.Literal(true)),
  }),
  Schema.Struct({
    status: Schema.Literal("safe-mode"),
    ...activationBase,
    identity: SafeModeStorageIdentitySchema,
    canonicalHealth: ProjectDatabaseHealthSchema,
    runtimeHealth: ProjectDatabaseHealthSchema,
  }),
  Schema.Struct({ status: Schema.Literal("not-registered"), ...activationBase }),
  activationFailureSchema("rejected", [
    "PROJECT_ALREADY_ACTIVE",
    ...selectionCodes([
      "REPOSITORY_NOT_FOUND",
      "REPOSITORY_IDENTITY_CHANGED",
      "REPOSITORY_INVALID",
      "OBSERVATION_INVALID",
      "REGISTRATION_IDEMPOTENCY_CONFLICT",
    ]),
  ]),
  activationFailureSchema("unavailable", [
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "PROJECT_STORAGE_UNAVAILABLE",
    ...selectionCodes([
      "REGISTRY_BUSY",
      "REGISTRY_MISSING_WITH_WITNESS",
      "OBSERVER_CLEANUP_UNCONFIRMED",
      "REGISTRATION_INCOMPLETE",
      "REPOSITORY_INACCESSIBLE",
      "IDENTITY_CAPABILITY_UNAVAILABLE",
      "REPOSITORY_UNSUPPORTED",
      "OBSERVATION_LIMIT_EXCEEDED",
    ]),
  ]),
  activationFailureSchema("broken", [
    "PROJECT_STORAGE_BROKEN",
    ...selectionCodes([
      "REGISTRY_SCHEMA_UNKNOWN",
      "REGISTRY_SCHEMA_NEWER",
      "REGISTRY_CORRUPT",
      "INTERNAL_FAILURE",
    ]),
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
export type CanonicalProjectActivationResult = typeof CanonicalProjectActivationResultSchema.Type;

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

export type CanonicalJsonValue =
  | string
  | number
  | boolean
  | null
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export const CanonicalJsonValueSchema = Schema.declare<CanonicalJsonValue>(
  (value): value is CanonicalJsonValue => isFiniteJson(value, new Set()),
  { message: "Value must be finite JSON data." },
);

export const TypedCommandSchema = Schema.Struct({
  commandId: CommandIdSchema,
  type: TrimmedNonEmptyTextSchema,
  version: PositiveVersionSchema,
  payload: CanonicalJsonValueSchema,
});
export type TypedCommand = typeof TypedCommandSchema.Type;
export const CanonicalProjectCommandRequestSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  activationId: ProjectActivationIdSchema,
  command: TypedCommandSchema,
});
export type CanonicalProjectCommandRequest = typeof CanonicalProjectCommandRequestSchema.Type;
export const CanonicalProjectCommandDiagnosticCodeSchema = Schema.Literals([
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
export type CanonicalProjectCommandDiagnosticCode =
  typeof CanonicalProjectCommandDiagnosticCodeSchema.Type;

function commandOutcomeSchema<
  const Status extends string,
  const Code extends CanonicalProjectCommandDiagnosticCode,
  const Retryable extends boolean,
>(status: Status, code: Code, retryable: Retryable) {
  return Schema.Struct({
    status: Schema.Literal(status),
    projectId: ProjectIdSchema,
    activationId: ProjectActivationIdSchema,
    commandId: CommandIdSchema,
    diagnostic: diagnosticSchema(Schema.Literal(code), Schema.Literal(retryable)),
  });
}
export const CanonicalProjectCommandResultSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("settled"),
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
]).check(
  Schema.makeFilter(
    (result) =>
      result.status !== "settled" ||
      (result.receipt.projectId === result.projectId &&
        result.receipt.commandId === result.commandId) || {
        path: ["receipt"],
        issue: "Receipt must match command result correlation.",
      },
  ),
);
export type CanonicalProjectCommandResult = typeof CanonicalProjectCommandResultSchema.Type;

export const CanonicalProjectSwitchRequestSchema = Schema.Struct({
  from: Schema.Struct({
    projectId: ProjectIdSchema,
    activationId: ProjectActivationIdSchema,
  }),
  to: CanonicalProjectActivationRequestSchema,
});
export type CanonicalProjectSwitchRequest = typeof CanonicalProjectSwitchRequestSchema.Type;

function switchOutcomeSchema<
  const Status extends
    | "inactive"
    | "project-mismatch"
    | "stale-activation"
    | "coordinator-unavailable",
  const Code extends CanonicalProjectCommandDiagnosticCode,
>(status: Status, code: Code) {
  return Schema.Struct({
    status: Schema.Literal(status),
    request: CanonicalProjectSwitchRequestSchema,
    diagnostic: diagnosticSchema(Schema.Literal(code), Schema.Literal(false)),
  });
}

const switchReleaseDiagnosticSchema = wholeUnion([
  diagnosticSchema(Schema.Literal("WRITER_FENCE_STALE"), Schema.Literal(false)),
  diagnosticSchema(
    Schema.Literals([
      "WRITER_FENCE_RELEASE_FAILED",
      "WRITER_REPOSITORY_CLOSE_FAILED",
      "WRITER_LEASE_OPEN_FAILED",
      "WRITER_LEASE_LOCK_FAILED",
      "WRITER_LEASE_UNLOCK_FAILED",
      "WRITER_LEASE_CLOSE_FAILED",
      "PROJECT_STORAGE_RELEASE_FAILED",
    ]),
    Schema.Literal(true),
  ),
]);

export const CanonicalProjectSwitchResultSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("target-result"),
    sourceReleased: Schema.optional(Schema.Boolean),
    request: CanonicalProjectSwitchRequestSchema,
    target: CanonicalProjectActivationResultSchema,
  }),
  switchOutcomeSchema("inactive", "PROJECT_INACTIVE"),
  switchOutcomeSchema("project-mismatch", "PROJECT_NOT_ACTIVE"),
  switchOutcomeSchema("stale-activation", "PROJECT_ACTIVATION_STALE"),
  switchOutcomeSchema("coordinator-unavailable", "PROJECT_COORDINATOR_UNAVAILABLE"),
  Schema.Struct({
    status: Schema.Literal("release-failed"),
    request: CanonicalProjectSwitchRequestSchema,
    diagnostic: switchReleaseDiagnosticSchema,
  }),
]).check(
  Schema.makeFilter(
    (result) =>
      result.status !== "target-result" ||
      result.target.request.projectId === result.request.to.projectId || {
        path: ["target", "request", "projectId"],
        issue: "Switch target Project must match the requested destination.",
      },
  ),
);
export type CanonicalProjectSwitchResult = typeof CanonicalProjectSwitchResultSchema.Type;
