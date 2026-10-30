import { Data } from "effect";

/**
 * One refusal per Canonical ledger reader check, so a check swapped for another one is visible
 * even where two checks share a message. A harness vocabulary, not a protocol code.
 */
export const CANONICAL_LEDGER_REFUSALS = [
  "SETTLEMENT_FENCE_INCOHERENT",
  "NON_REJECTED_HAS_REJECTIONS",
  "REJECTION_SOURCE_BINDING",
  "REJECTION_DETAILS_INTEGRITY",
  "ORIGINAL_RECEIPT_ORPHANED",
  "ORIGINAL_RECEIPT_AUTHORITY",
  "ORIGINAL_RECEIPT_IS_CONFLICT",
  "EVENT_SOURCE_BINDING",
  "EVENT_PAYLOAD_INTEGRITY",
  "NON_APPLIED_HAS_EVENTS",
  "CONFLICT_RECEIPT_COMMAND",
  "REQUESTED_RECEIPT_COMMAND",
  "REQUESTED_RECEIPT_AUTHORITY",
  "CONFLICT_RECEIPT_AUTHORITY",
  "CONFLICT_RECEIPT_OUTCOME",
] as const;

export type CanonicalLedgerRefusalCode = (typeof CANONICAL_LEDGER_REFUSALS)[number];

const refusalMessages = {
  SETTLEMENT_FENCE_INCOHERENT: "Canonical settlement fence authority is inconsistent.",
  NON_REJECTED_HAS_REJECTIONS: "Canonical non-rejected receipt has rejection children.",
  REJECTION_SOURCE_BINDING: "Canonical rejection source binding is inconsistent.",
  REJECTION_DETAILS_INTEGRITY: "Canonical rejection details integrity is inconsistent.",
  ORIGINAL_RECEIPT_ORPHANED: "Canonical original receipt is orphaned.",
  ORIGINAL_RECEIPT_AUTHORITY: "Canonical original receipt authority is inconsistent.",
  ORIGINAL_RECEIPT_IS_CONFLICT: "Canonical original receipt authority is inconsistent.",
  EVENT_SOURCE_BINDING: "Canonical event source binding is inconsistent.",
  EVENT_PAYLOAD_INTEGRITY: "Canonical event payload integrity is inconsistent.",
  NON_APPLIED_HAS_EVENTS: "Canonical non-applied receipt has event children.",
  CONFLICT_RECEIPT_COMMAND: "Canonical conflict receipt authority is inconsistent.",
  REQUESTED_RECEIPT_COMMAND: "Canonical requested receipt authority is inconsistent.",
  REQUESTED_RECEIPT_AUTHORITY: "Canonical requested receipt authority is inconsistent.",
  CONFLICT_RECEIPT_AUTHORITY: "Canonical conflict receipt authority is inconsistent.",
  CONFLICT_RECEIPT_OUTCOME: "Canonical conflict receipt outcome is inconsistent.",
} as const satisfies Record<CanonicalLedgerRefusalCode, string>;

/** Stored Canonical ledger state that a reader check refuses; still thrown from Promise code. */
export class CanonicalLedgerRefusal extends Data.TaggedError("CanonicalLedgerRefusal")<{
  readonly refusal: CanonicalLedgerRefusalCode;
  readonly message: string;
}> {}

/** The refusal of one ledger check, with the message that check has always carried. */
export function canonicalLedgerRefusal(
  refusal: CanonicalLedgerRefusalCode,
): CanonicalLedgerRefusal {
  return new CanonicalLedgerRefusal({ refusal, message: refusalMessages[refusal] });
}
