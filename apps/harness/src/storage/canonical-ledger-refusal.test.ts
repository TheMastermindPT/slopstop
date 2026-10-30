import { describe, expect, it } from "vitest";
import {
  CANONICAL_LEDGER_REFUSALS,
  CanonicalLedgerRefusal,
  canonicalLedgerRefusal,
} from "./canonical-ledger-refusal.js";

/** Each refusal with the message the ledger has always thrown for its check, written out. */
const expectedRefusals = [
  ["SETTLEMENT_FENCE_INCOHERENT", "Canonical settlement fence authority is inconsistent."],
  ["NON_REJECTED_HAS_REJECTIONS", "Canonical non-rejected receipt has rejection children."],
  ["REJECTION_SOURCE_BINDING", "Canonical rejection source binding is inconsistent."],
  ["REJECTION_DETAILS_INTEGRITY", "Canonical rejection details integrity is inconsistent."],
  ["ORIGINAL_RECEIPT_ORPHANED", "Canonical original receipt is orphaned."],
  ["ORIGINAL_RECEIPT_AUTHORITY", "Canonical original receipt authority is inconsistent."],
  ["ORIGINAL_RECEIPT_IS_CONFLICT", "Canonical original receipt authority is inconsistent."],
  ["EVENT_SOURCE_BINDING", "Canonical event source binding is inconsistent."],
  ["EVENT_PAYLOAD_INTEGRITY", "Canonical event payload integrity is inconsistent."],
  ["NON_APPLIED_HAS_EVENTS", "Canonical non-applied receipt has event children."],
  ["CONFLICT_RECEIPT_COMMAND", "Canonical conflict receipt authority is inconsistent."],
  ["REQUESTED_RECEIPT_COMMAND", "Canonical requested receipt authority is inconsistent."],
  ["REQUESTED_RECEIPT_AUTHORITY", "Canonical requested receipt authority is inconsistent."],
  ["CONFLICT_RECEIPT_AUTHORITY", "Canonical conflict receipt authority is inconsistent."],
  ["CONFLICT_RECEIPT_OUTCOME", "Canonical conflict receipt outcome is inconsistent."],
] as const;

describe("the canonical ledger refusal table", () => {
  it("names one refusal per ledger check, in the prediction table's order", () => {
    expect(CANONICAL_LEDGER_REFUSALS).toEqual(expectedRefusals.map(([refusal]) => refusal));
    expect(new Set(expectedRefusals.map(([, message]) => message)).size).toBe(12);
  });

  it.each(expectedRefusals)("refuses %s with its own message", (refusal, message) => {
    const refused = canonicalLedgerRefusal(refusal);
    expect(refused).toBeInstanceOf(Error);
    expect(refused).toBeInstanceOf(CanonicalLedgerRefusal);
    expect(refused._tag).toBe("CanonicalLedgerRefusal");
    expect(refused.refusal).toBe(refusal);
    expect(refused.message).toBe(message);
  });
});
