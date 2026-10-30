import { Schema } from "effect";
import { expect } from "vitest";
import {
  CanonicalLedgerRefusal,
  type CanonicalLedgerRefusalCode,
} from "../../src/storage/canonical-ledger-refusal.js";

/**
 * The one failure a broken Canonical replay may answer. Every oracle call names it: there is
 * no "any error" member and no default.
 */
export type LedgerFailure =
  | Readonly<{ refusal: CanonicalLedgerRefusalCode }>
  | Readonly<{ decode: true }>
  | Readonly<{ shape: string }>
  | Readonly<{ syntax: true }>
  | Readonly<{ sentinel: unknown }>;

/**
 * Each message the ledger has always thrown, written out with the refusals that carry it, so a
 * changed table fails. Keyed by message, not by refusal, so it is not a copy of the table.
 */
const writtenMessages: Readonly<Record<string, readonly CanonicalLedgerRefusalCode[]>> = {
  "Canonical settlement fence authority is inconsistent.": ["SETTLEMENT_FENCE_INCOHERENT"],
  "Canonical non-rejected receipt has rejection children.": ["NON_REJECTED_HAS_REJECTIONS"],
  "Canonical rejection source binding is inconsistent.": ["REJECTION_SOURCE_BINDING"],
  "Canonical rejection details integrity is inconsistent.": ["REJECTION_DETAILS_INTEGRITY"],
  "Canonical original receipt is orphaned.": ["ORIGINAL_RECEIPT_ORPHANED"],
  "Canonical original receipt authority is inconsistent.": [
    "ORIGINAL_RECEIPT_AUTHORITY",
    "ORIGINAL_RECEIPT_IS_CONFLICT",
  ],
  "Canonical event source binding is inconsistent.": ["EVENT_SOURCE_BINDING"],
  "Canonical event payload integrity is inconsistent.": ["EVENT_PAYLOAD_INTEGRITY"],
  "Canonical non-applied receipt has event children.": ["NON_APPLIED_HAS_EVENTS"],
  "Canonical conflict receipt authority is inconsistent.": [
    "CONFLICT_RECEIPT_COMMAND",
    "CONFLICT_RECEIPT_AUTHORITY",
  ],
  "Canonical requested receipt authority is inconsistent.": [
    "REQUESTED_RECEIPT_COMMAND",
    "REQUESTED_RECEIPT_AUTHORITY",
  ],
  "Canonical conflict receipt outcome is inconsistent.": ["CONFLICT_RECEIPT_OUTCOME"],
};

/** The written-out message of `refusal`; a refusal with no written message has none. */
const writtenMessageOf = (refusal: CanonicalLedgerRefusalCode): string | undefined =>
  Object.keys(writtenMessages).find((message) => writtenMessages[message]?.includes(refusal));

/** The `canonical-json.ts` shape messages a replay can fail with. */
export const shapeFailures = {
  aliases: { shape: "Canonical Writer result contains duplicate column aliases." },
  width: { shape: "Canonical Writer result row width does not match its columns." },
  exactlyOne: { shape: "Canonical Writer authority must contain exactly one row." },
  changedOnce: { shape: "Canonical Writer row was not changed exactly once." },
} as const;

export const decodeFailure = { decode: true } as const;
export const syntaxFailure = { syntax: true } as const;

/** The ledger refusal expectation for `refusal`. */
export const refused = (refusal: CanonicalLedgerRefusalCode) => ({ refusal }) as const;

const field = (value: unknown, name: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined;

/** Asserts that `error` is exactly the declared failure. */
export function expectLedgerFailure(error: unknown, expected: LedgerFailure): void {
  if ("refusal" in expected) {
    expect(error).toBeInstanceOf(Error);
    expect(writtenMessageOf(expected.refusal)).toBeDefined();
    expect(field(error, "message")).toBe(writtenMessageOf(expected.refusal));
    expect(field(error, "_tag")).toBe("CanonicalLedgerRefusal");
    expect(field(error, "refusal")).toBe(expected.refusal);
    return;
  }
  if ("decode" in expected) {
    expect(error).toBeInstanceOf(Schema.SchemaError);
    expect(error).not.toBeInstanceOf(CanonicalLedgerRefusal);
    return;
  }
  if ("shape" in expected) {
    expect(error).toBeInstanceOf(Error);
    expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
    expect(field(error, "_tag")).toBeUndefined();
    expect(field(error, "message")).toBe(expected.shape);
    return;
  }
  if ("syntax" in expected) {
    expect(error).toBeInstanceOf(SyntaxError);
    return;
  }
  expect(error).toBe(expected.sentinel);
}
