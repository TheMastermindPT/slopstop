import { Schema } from "effect";
import { projectAvailabilityMessages as messages } from "./availability-messages.js";
import {
  CanonicalSettlementTimeSchema,
  ProjectActivationIdSchema,
} from "./canonical-project-protocol.js";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { type HarnessFailureCode, harnessFailureMessages } from "./harness-failure-protocol.js";
import { UuidTextSchema } from "./schema-codec.js";
import {
  ConversationBranchIdSchema,
  ConversationIdSchema,
  ConversationMessageIdSchema,
} from "./workspace-protocol.js";

/** A harness failure passed on inside a conversation result: its own code and message, final. */
function harnessFailureRow<const Code extends HarnessFailureCode>(code: Code) {
  return { code, message: harnessFailureMessages[code], retryable: false } as const;
}

/**
 * Every (code, message, retryable) row a conversation result can carry. `retryable` says
 * whether the same request can succeed unchanged.
 */
export const projectConversationDiagnostics = {
  saveIdReused: {
    code: "SAVE_ID_REUSED",
    message: "This save was already used for different text.",
    retryable: false,
  },
  saveUnconfirmed: {
    code: "CONVERSATION_SAVE_UNCONFIRMED",
    message: "The save could not be confirmed. Try again to check it.",
    retryable: true,
  },
  inactive: { code: "PROJECT_INACTIVE", message: "No Project is open.", retryable: false },
  projectMismatch: {
    code: "PROJECT_NOT_ACTIVE",
    message: "This Project is not the open Project.",
    retryable: false,
  },
  staleActivation: {
    code: "PROJECT_ACTIVATION_STALE",
    message: "The Project was reopened. Reload the conversation.",
    retryable: false,
  },
  coordinatorUnavailable: {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: messages.coordinatorUnavailable,
    retryable: false,
  },
  readOnly: {
    code: "WRITER_UNAVAILABLE",
    message:
      "This Project is open read-only because another process is using it, so saving is disabled.",
    retryable: true,
  },
  writerUnavailable: {
    code: "WRITER_UNAVAILABLE",
    message: "Saving is unavailable until the Project is reopened.",
    retryable: false,
  },
  staleWriter: {
    code: "WRITER_FENCE_STALE",
    message: "Another writer took over this Project. Reopen it to continue.",
    retryable: false,
  },
  storageUnavailable: {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: messages.storageUnavailable,
    retryable: true,
  },
  connectionLost: {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: messages.connectionLost,
    retryable: true,
  },
  storageBroken: {
    code: "PROJECT_STORAGE_BROKEN",
    message: "Project Storage could not be read safely.",
    retryable: false,
  },
  harnessInternalFailure: harnessFailureRow("HARNESS_INTERNAL_FAILURE"),
  protocolMessageInvalid: harnessFailureRow("PROTOCOL_MESSAGE_INVALID"),
  protocolVersionUnsupported: harnessFailureRow("PROTOCOL_VERSION_UNSUPPORTED"),
} as const;

export type ProjectConversationDiagnostic =
  (typeof projectConversationDiagnostics)[keyof typeof projectConversationDiagnostics];

/** The largest message text, in UTF-8 bytes. */
const maximumTextBytes = 32_768;

/**
 * The text's UTF-8 size: the byte count `TextEncoder` produces, a lone surrogate counting as its
 * three-byte replacement. Computed here because this package targets plain ES2022.
 */
function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Why a message text cannot be saved, or `undefined` when it can. Whitespace is `\s` (Unicode). */
export function conversationTextProblem(
  text: string,
): "empty" | "whitespace-only" | "too-large" | undefined {
  if (text.length === 0) return "empty";
  if (/^\s+$/u.test(text)) return "whitespace-only";
  if (utf8ByteLength(text) > maximumTextBytes) return "too-large";
  return undefined;
}

const CountSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const CursorSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
const ConversationTextSchema = Schema.String.check(
  Schema.makeFilter(
    (text: string) =>
      conversationTextProblem(text) === undefined || "Message text cannot be saved.",
  ),
);

export const ProjectConversationReadRequestSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  activationId: ProjectActivationIdSchema,
  after: Schema.NullOr(CountSchema),
});
export type ProjectConversationReadRequest = typeof ProjectConversationReadRequestSchema.Type;

export const ProjectConversationSaveRequestSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  activationId: ProjectActivationIdSchema,
  saveId: UuidTextSchema,
  expectedRevision: CountSchema,
  text: ConversationTextSchema,
});
export type ProjectConversationSaveRequest = typeof ProjectConversationSaveRequestSchema.Type;

function rowSchema<const Row extends ProjectConversationDiagnostic>(row: Row) {
  return Schema.Struct({
    code: Schema.Literal(row.code),
    message: Schema.Literal(row.message),
    retryable: Schema.Literal(row.retryable),
  });
}

const rows = projectConversationDiagnostics;

type ConversationRequestSchema =
  | typeof ProjectConversationReadRequestSchema
  | typeof ProjectConversationSaveRequestSchema;

function failure<const Status extends string, Request extends ConversationRequestSchema>(
  status: Status,
  request: Request,
  diagnostics: readonly [ProjectConversationDiagnostic, ...ProjectConversationDiagnostic[]],
) {
  return Schema.Struct({
    status: Schema.Literal(status),
    request,
    diagnostic: Schema.Union(diagnostics.map(rowSchema)),
  });
}

const sharedFailures = <Request extends ConversationRequestSchema>(request: Request) => [
  failure("inactive", request, [rows.inactive]),
  failure("project-mismatch", request, [rows.projectMismatch]),
  failure("stale-activation", request, [rows.staleActivation]),
  failure("coordinator-unavailable", request, [rows.coordinatorUnavailable]),
  failure("unavailable", request, [rows.storageUnavailable, rows.connectionLost]),
  failure("broken", request, [
    rows.storageBroken,
    rows.harnessInternalFailure,
    rows.protocolMessageInvalid,
    rows.protocolVersionUnsupported,
  ]),
];

const ConversationMessageSchema = Schema.Struct({
  conversationMessageId: ConversationMessageIdSchema,
  cursor: CursorSchema,
  author: Schema.Literal("user"),
  text: Schema.String,
  savedAt: CanonicalSettlementTimeSchema,
});

export const ProjectConversationReadResultSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("read"),
    request: ProjectConversationReadRequestSchema,
    conversation: Schema.NullOr(
      Schema.Struct({
        conversationId: ConversationIdSchema,
        branchId: ConversationBranchIdSchema,
        revision: CountSchema,
        messages: Schema.Array(ConversationMessageSchema),
        nextCursor: Schema.NullOr(CountSchema),
      }),
    ),
  }),
  ...sharedFailures(ProjectConversationReadRequestSchema),
]);
export type ProjectConversationReadResult = typeof ProjectConversationReadResultSchema.Type;

export const ProjectConversationSaveResultSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("saved"),
    request: ProjectConversationSaveRequestSchema,
    conversationMessageId: ConversationMessageIdSchema,
    cursor: CursorSchema,
    revision: CountSchema,
    savedAt: CanonicalSettlementTimeSchema,
    replayed: Schema.Boolean,
  }),
  Schema.Struct({
    status: Schema.Literal("conflict"),
    request: ProjectConversationSaveRequestSchema,
    currentRevision: CountSchema,
  }),
  failure("rejected", ProjectConversationSaveRequestSchema, [rows.saveIdReused]),
  failure("uncertain", ProjectConversationSaveRequestSchema, [rows.saveUnconfirmed]),
  failure("read-only", ProjectConversationSaveRequestSchema, [rows.readOnly]),
  failure("writer-unavailable", ProjectConversationSaveRequestSchema, [rows.writerUnavailable]),
  failure("stale-writer", ProjectConversationSaveRequestSchema, [rows.staleWriter]),
  ...sharedFailures(ProjectConversationSaveRequestSchema),
]);
export type ProjectConversationSaveResult = typeof ProjectConversationSaveResultSchema.Type;
