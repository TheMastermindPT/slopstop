import { Schema } from "effect";
import { EpochMillisecondsSchema } from "./project-upgrade-protocol.js";

/** Fatal summaries stay bounded: failures past this many are only counted. */
export const HARNESS_FATAL_SUMMARY_BOUND = 16;

/** A failure tag the summary keeps: an identifier, never text that could hold a path. */
export const HARNESS_FAILURE_TAG_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

/** The tag of the failure naming the unconfirmed registration cleanup parts. */
export const REGISTRATION_CLEANUP_TAG = "RegistrationCleanupUnconfirmed";

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
