import { Schema } from "effect";

export const HarnessFailureCodeSchema = Schema.Literals([
  "PROTOCOL_MESSAGE_INVALID",
  "PROTOCOL_VERSION_UNSUPPORTED",
  "HARNESS_INTERNAL_FAILURE",
]);
export type HarnessFailureCode = typeof HarnessFailureCodeSchema.Type;

/** The one message each harness failure code is sent with. */
export const harnessFailureMessages = {
  PROTOCOL_MESSAGE_INVALID: "Harness received an invalid protocol message.",
  PROTOCOL_VERSION_UNSUPPORTED: "Desktop and harness protocol versions are incompatible.",
  HARNESS_INTERNAL_FAILURE: "Harness failed while handling a message.",
} as const satisfies Record<HarnessFailureCode, string>;

/** A harness failure passed on inside a result: its own code and message, final. */
export function harnessFailureRow<const Code extends HarnessFailureCode>(code: Code) {
  return { code, message: harnessFailureMessages[code], retryable: false } as const;
}

/**
 * Every harness failure row, by its code: the one table every desktop fault mapper reads (upgrade,
 * conversation, activation and switch).
 */
export const harnessFailureRows = Object.freeze({
  PROTOCOL_MESSAGE_INVALID: harnessFailureRow("PROTOCOL_MESSAGE_INVALID"),
  PROTOCOL_VERSION_UNSUPPORTED: harnessFailureRow("PROTOCOL_VERSION_UNSUPPORTED"),
  HARNESS_INTERNAL_FAILURE: harnessFailureRow("HARNESS_INTERNAL_FAILURE"),
} satisfies Record<HarnessFailureCode, DiagnosticRow>);

/** A diagnostics row a result carries; `retryable` says whether the same request can succeed. */
type DiagnosticRow = Readonly<{ code: string; message: string; retryable: boolean }>;

/** One exact row: its code, message and retryability, nothing else. */
export function exactRowSchema<const Row extends DiagnosticRow>(row: Row) {
  return Schema.Struct({
    code: Schema.Literal(row.code),
    message: Schema.Literal(row.message),
    retryable: Schema.Literal(row.retryable),
  });
}
