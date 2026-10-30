import { Schema } from "effect";
import { CanonicalProjectActivationDiagnosticCodeSchema } from "./canonical-project-protocol.js";
import type { HarnessFailureCode } from "./harness-failure-protocol.js";
import type { ProjectStorageDiagnosticCode } from "./project-storage-protocol.js";
import { EpochMillisecondsSchema } from "./project-upgrade-protocol.js";
import type { WorkspaceDiagnostic } from "./workspace-protocol.js";

/** Fatal summaries stay bounded: failures past this many are only counted. */
export const HARNESS_FATAL_SUMMARY_BOUND = 16;

/** A failure tag the summary keeps: an identifier, never text that could hold a path. */
export const HARNESS_FAILURE_TAG_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

/** The tag of the failure naming the unconfirmed registration cleanup parts. */
export const REGISTRATION_CLEANUP_TAG = "RegistrationCleanupUnconfirmed";

/** The tag of the failure naming the activation release code of a failed stop. */
export const CANONICAL_PROJECT_RELEASE_FAILURE_TAG = "CanonicalProjectReleaseFailed";

/** The registration parts whose cleanup at stop can be unconfirmed, in reporting order. */
export const REGISTRATION_CLEANUP_PARTS = ["registry", "observer", "listing"] as const;
export type RegistrationCleanupPart = (typeof REGISTRATION_CLEANUP_PARTS)[number];

/** What a failure value is when it carries no identifier tag. */
export const HARNESS_FATAL_VALUE_KINDS = [
  "error",
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "function",
  "object",
  "null",
  "undefined",
] as const;
export type HarnessFatalValueKind = (typeof HARNESS_FATAL_VALUE_KINDS)[number];

const ValueKindSchema = Schema.Literals(HARNESS_FATAL_VALUE_KINDS);

const failureEntrySchema = Schema.Union([
  Schema.Struct({
    tag: Schema.String.check(
      Schema.isPattern(HARNESS_FAILURE_TAG_PATTERN),
      Schema.makeFilter(
        (tag: string) => tag !== REGISTRATION_CLEANUP_TAG || "A cleanup failure names its parts.",
      ),
    ),
  }),
  Schema.Struct({
    tag: Schema.Literal(REGISTRATION_CLEANUP_TAG),
    parts: Schema.Array(Schema.Literals(REGISTRATION_CLEANUP_PARTS)).check(
      Schema.isMaxLength(REGISTRATION_CLEANUP_PARTS.length),
    ),
  }),
  Schema.Struct({
    tag: Schema.Literal(CANONICAL_PROJECT_RELEASE_FAILURE_TAG),
    code: CanonicalProjectActivationDiagnosticCodeSchema,
  }),
  Schema.Struct({ kind: ValueKindSchema }),
]);

const summaryFields = {
  failures: Schema.Array(failureEntrySchema).check(Schema.isMaxLength(HARNESS_FATAL_SUMMARY_BOUND)),
  omittedFailures: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
};

const fatalLineBase = {
  level: Schema.Literal(60),
  time: EpochMillisecondsSchema,
  service: Schema.Literal("harness"),
};

/** The `code` of every harness fatal line. */
export const harnessFatalCodes = [
  "HARNESS_START_FAILED",
  "HARNESS_RUNTIME_START_FAILED",
  "HARNESS_SHUTDOWN_FAILED",
  "HARNESS_UNCAUGHT_EXCEPTION",
  "HARNESS_UNHANDLED_REJECTION",
] as const;
export type HarnessFatalCode = (typeof harnessFatalCodes)[number];

/** The fixed message of each harness fatal exit; a fatal line carries no other text. */
export const harnessFatalMessages = {
  invalidBootstrap: "Harness received an invalid bootstrap message.",
  noParentPort: "Harness utility process has no parent port.",
  runtimeStartFailed: "Harness runtime failed to start.",
  shutdownFailed: "Harness shutdown failed.",
  uncaughtException: "Harness encountered an uncaught exception.",
  unhandledRejection: "Harness encountered an unhandled rejection.",
} as const;

/** The one owner of which fixed messages each fatal code's lines can carry. */
export const harnessFatalCodeMessages = {
  HARNESS_START_FAILED: [harnessFatalMessages.invalidBootstrap, harnessFatalMessages.noParentPort],
  HARNESS_RUNTIME_START_FAILED: [harnessFatalMessages.runtimeStartFailed],
  HARNESS_SHUTDOWN_FAILED: [harnessFatalMessages.shutdownFailed],
  HARNESS_UNCAUGHT_EXCEPTION: [harnessFatalMessages.uncaughtException],
  HARNESS_UNHANDLED_REJECTION: [harnessFatalMessages.unhandledRejection],
} as const satisfies Record<HarnessFatalCode, readonly [string, ...string[]]>;

/** A fixed message of `Code`'s fatal lines. */
export type HarnessFatalMessage<Code extends HarnessFatalCode = HarnessFatalCode> =
  (typeof harnessFatalCodeMessages)[Code][number];

function fatalLineOf<const Code extends HarnessFatalCode>(code: Code) {
  return {
    ...fatalLineBase,
    code: Schema.Literal(code),
    msg: Schema.Literals(harnessFatalCodeMessages[code]),
  };
}

/**
 * Exactly what the harness logger serializes for one fatal exit, one JSON line each: the code,
 * one of its fixed messages, and metadata only (tags, cleanup part names, value kinds, counts).
 */
export const HarnessFatalLogLineSchema = Schema.Union([
  Schema.Struct({ ...fatalLineOf("HARNESS_SHUTDOWN_FAILED"), ...summaryFields }),
  Schema.Struct({ ...fatalLineOf("HARNESS_RUNTIME_START_FAILED"), ...summaryFields }),
  Schema.Struct({ ...fatalLineOf("HARNESS_START_FAILED"), ...summaryFields }),
  Schema.Struct(fatalLineOf("HARNESS_START_FAILED")),
  Schema.Struct({ ...fatalLineOf("HARNESS_UNCAUGHT_EXCEPTION"), valueKind: ValueKindSchema }),
  Schema.Struct({ ...fatalLineOf("HARNESS_UNHANDLED_REJECTION"), valueKind: ValueKindSchema }),
]);
export type HarnessFatalLogLine = typeof HarnessFatalLogLineSchema.Type;

/** The request boundaries whose catch answers a fixed failure and logs one request-failure line. */
export const HARNESS_REQUEST_BOUNDARIES = [
  "harness.message",
  "harness.notification",
  "harness.registration",
  "project-storage.owner",
  "workspace.query",
  "workspace.intent",
] as const;
export type HarnessRequestBoundary = (typeof HARNESS_REQUEST_BOUNDARIES)[number];

/** The wire code vocabulary each request boundary answers from; every boundary has one. */
type HarnessRequestBoundaryAnswerCodes = Record<HarnessRequestBoundary, string> &
  Readonly<{
    "harness.message": HarnessFailureCode;
    "harness.notification": HarnessFailureCode;
    "harness.registration": HarnessFailureCode;
    "project-storage.owner": ProjectStorageDiagnosticCode;
    "workspace.query": WorkspaceDiagnostic["code"];
    "workspace.intent": WorkspaceDiagnostic["code"];
  }>;

/** The one owner of the code each request boundary answers with. */
export const harnessRequestBoundaryAnswers = {
  "harness.message": "HARNESS_INTERNAL_FAILURE",
  "harness.notification": "HARNESS_INTERNAL_FAILURE",
  "harness.registration": "HARNESS_INTERNAL_FAILURE",
  "project-storage.owner": "PROJECT_STORAGE_OWNER_FAILED",
  "workspace.query": "WORKSPACE_PRODUCER_FAILED",
  "workspace.intent": "WORKSPACE_PRODUCER_FAILED",
} as const satisfies HarnessRequestBoundaryAnswerCodes;

/** The `code` of every harness request-failure line. */
export const harnessRequestFailureCode = "HARNESS_REQUEST_FAILED";

/** The one fixed message of a request-failure line; it carries no other text. */
export const harnessRequestFailureMessage = "Harness request failed.";

function requestFailureLineOf<const Boundary extends HarnessRequestBoundary>(boundary: Boundary) {
  return Schema.Struct({
    level: Schema.Literal(40),
    time: EpochMillisecondsSchema,
    service: Schema.Literal("harness"),
    code: Schema.Literal(harnessRequestFailureCode),
    msg: Schema.Literal(harnessRequestFailureMessage),
    boundary: Schema.Literal(boundary),
    answered: Schema.Literal(harnessRequestBoundaryAnswers[boundary]),
    ...summaryFields,
  });
}

/**
 * Exactly what the harness logger serializes when a request boundary answers a fixed failure:
 * the boundary, the code it answered, and the bounded failure summary the fatal lines use.
 */
export const HarnessRequestFailureLogLineSchema = Schema.Union(
  HARNESS_REQUEST_BOUNDARIES.map(requestFailureLineOf),
);
export type HarnessRequestFailureLogLine = typeof HarnessRequestFailureLogLineSchema.Type;

/** The `code` of the start's registration reconciliation warning. */
export const harnessReconciliationFailureCode = "REGISTRATION_RECONCILIATION_FAILED";

/** The one fixed message of the reconciliation warning; it carries no other text. */
export const harnessReconciliationFailureMessage = "Registration reconciliation failed.";

/** Exactly what the harness logger serializes when the start's reconciliation fails. */
export const HarnessReconciliationFailureLogLineSchema = Schema.Struct({
  level: Schema.Literal(40),
  time: EpochMillisecondsSchema,
  service: Schema.Literal("harness"),
  code: Schema.Literal(harnessReconciliationFailureCode),
  msg: Schema.Literal(harnessReconciliationFailureMessage),
});
export type HarnessReconciliationFailureLogLine =
  typeof HarnessReconciliationFailureLogLineSchema.Type;
