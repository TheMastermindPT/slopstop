import {
  type CanonicalCommandReceipt,
  CanonicalCommandReceiptSchema,
  type CanonicalEventId,
  CanonicalEventIdSchema,
  CanonicalEventOrdinalSchema,
  CanonicalSettlementTimeSchema,
  CommandReceiptMetadataSchema,
  CommandRejectionSchema,
  ProjectSequenceSchema,
  type WriterGeneration,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  type CanonicalEventInput,
  CanonicalEventInputSchema,
} from "../canonical-command-registry.js";
import {
  type CanonicalCommandSnapshot,
  CanonicalSha256Schema,
  canonicalChangedOnce,
  canonicalExactlyOne,
  canonicalJsonText,
  canonicalResultObjects,
  hashCanonicalJson,
  parseCanonicalJson,
} from "../canonical-json.js";
import type { LocalLibsqlTransaction } from "./local-libsql-worker-client.js";

export type AppliedEventRow = Omit<CanonicalEventInput, "payload"> &
  Readonly<{
    eventId: CanonicalEventId;
    eventOrdinal: number;
    payloadText: string;
    payloadHash: string;
  }>;

const storedReceiptSchema = CommandReceiptMetadataSchema.extend({
  outcome: z.enum(["applied", "unchanged", "rejected"]),
  fingerprint: CanonicalSha256Schema,
  generationProjectId: CommandReceiptMetadataSchema.shape.projectId,
  generationNumber: CommandReceiptMetadataSchema.shape.writerGeneration,
});
const pointerSchema = CommandReceiptMetadataSchema.pick({
  projectId: true,
  commandId: true,
  receiptId: true,
}).extend({
  fingerprint: CanonicalSha256Schema,
  createdAt: CanonicalSettlementTimeSchema,
});
const storedEventSchema = CanonicalEventInputSchema.omit({ payload: true }).extend({
  projectId: CommandReceiptMetadataSchema.shape.projectId,
  receiptId: CommandReceiptMetadataSchema.shape.receiptId,
  receiptOutcome: z.literal("applied"),
  projectSequence: ProjectSequenceSchema,
  eventId: CanonicalEventIdSchema,
  eventOrdinal: CanonicalEventOrdinalSchema,
  occurredAt: CanonicalSettlementTimeSchema,
  payloadText: z.string(),
  payloadHash: CanonicalSha256Schema,
});
const receiptSelect = `SELECT r.project_id AS projectId, r.receipt_id AS receiptId, r.command_id AS commandId,
  r.command_type AS commandType, r.command_version AS commandVersion, r.outcome,
  r.project_sequence AS projectSequence, r.writer_generation AS writerGeneration, r.settled_at AS settledAt,
  r.command_fingerprint AS fingerprint, g.project_id AS generationProjectId, g.writer_generation AS generationNumber
  FROM command_receipts AS r LEFT JOIN writer_generations AS g
  ON g.project_id=r.project_id AND g.writer_generation=r.writer_generation WHERE r.project_id=?`;

const storedRejectionSchema = CommandReceiptMetadataSchema.pick({
  projectId: true,
  receiptId: true,
  projectSequence: true,
}).extend({
  receiptOutcome: z.literal("rejected"),
  code: z.string(),
  retryable: z.union([z.literal(0), z.literal(1)]),
  detailsText: z.string(),
  detailsHash: CanonicalSha256Schema,
});

async function readRejection(tx: LocalLibsqlTransaction, row: z.infer<typeof storedReceiptSchema>) {
  const rows = canonicalResultObjects(
    await tx.execute({
      sql: "SELECT project_id AS projectId, receipt_id AS receiptId, receipt_outcome AS receiptOutcome, project_sequence AS projectSequence, rejection_code AS code, retryable, details_json AS detailsText, details_hash AS detailsHash FROM command_rejections WHERE project_id=? AND receipt_id=?",
      args: [row.projectId, row.receiptId],
    }),
  );
  if (row.outcome !== "rejected") {
    if (rows.length !== 0)
      throw new Error("Canonical non-rejected receipt has rejection children.");
    return {};
  }
  const child = canonicalExactlyOne(storedRejectionSchema.array().parse(rows));
  const bound = [
    child.projectId === row.projectId,
    child.receiptId === row.receiptId,
    child.projectSequence === row.projectSequence,
  ].every(Boolean);
  if (!bound) throw new Error("Canonical rejection source binding is inconsistent.");
  const details = z
    .strictObject({ version: z.literal(1) })
    .parse(parseCanonicalJson(child.detailsText));
  const intact = [
    canonicalJsonText(details) === child.detailsText,
    hashCanonicalJson(details) === child.detailsHash,
  ].every(Boolean);
  if (!intact) throw new Error("Canonical rejection details integrity is inconsistent.");
  return {
    rejection: CommandRejectionSchema.parse({ code: child.code, retryable: child.retryable === 1 }),
  };
}

async function originalReceipt(
  tx: LocalLibsqlTransaction,
  command: CanonicalCommandSnapshot,
  lastProjectSequence: number,
  writerGeneration: WriterGeneration,
) {
  const count = canonicalExactlyOne(
    z
      .strictObject({ receiptCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
      .array()
      .parse(
        canonicalResultObjects(
          await tx.execute({
            sql: "SELECT COUNT(*) AS receiptCount FROM command_receipts WHERE project_id=? AND command_id=?",
            args: [command.projectId, command.commandId],
          }),
        ),
      ),
  );
  const pointers = pointerSchema.array().parse(
    canonicalResultObjects(
      await tx.execute({
        sql: "SELECT project_id AS projectId, command_id AS commandId, original_receipt_id AS receiptId, original_command_fingerprint AS fingerprint, created_at AS createdAt FROM command_idempotency WHERE project_id=? AND command_id=?",
        args: [command.projectId, command.commandId],
      }),
    ),
  );
  if (pointers.length === 0) {
    if (count.receiptCount !== 0) throw new Error("Canonical original receipt is orphaned.");
    return undefined;
  }
  const pointer = canonicalExactlyOne(pointers);
  const receipt = canonicalExactlyOne(
    storedReceiptSchema.array().parse(
      canonicalResultObjects(
        await tx.execute({
          sql: `${receiptSelect} AND r.receipt_id=?`,
          args: [command.projectId, pointer.receiptId],
        }),
      ),
    ),
  );
  const coherent = [
    count.receiptCount > 0,
    pointer.projectId === command.projectId,
    pointer.commandId === command.commandId,
    receipt.projectId === pointer.projectId,
    receipt.commandId === pointer.commandId,
    receipt.receiptId === pointer.receiptId,
    receipt.fingerprint === pointer.fingerprint,
    receipt.settledAt === pointer.createdAt,
    receipt.projectSequence <= lastProjectSequence,
    receipt.writerGeneration <= writerGeneration,
    receipt.generationNumber === receipt.writerGeneration,
    receipt.generationProjectId === receipt.projectId,
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical original receipt authority is inconsistent.");
  return receipt;
}

function readEventReference(
  event: z.infer<typeof storedEventSchema>,
  row: z.infer<typeof storedReceiptSchema>,
) {
  const bound = [
    event.projectId === row.projectId,
    event.receiptId === row.receiptId,
    event.projectSequence === row.projectSequence,
    event.occurredAt === row.settledAt,
  ].every(Boolean);
  if (!bound) throw new Error("Canonical event source binding is inconsistent.");
  const payload = parseCanonicalJson(event.payloadText);
  const intact = [
    canonicalJsonText(payload) === event.payloadText,
    hashCanonicalJson(payload) === event.payloadHash,
  ].every(Boolean);
  if (!intact) throw new Error("Canonical event payload integrity is inconsistent.");
  return { eventId: event.eventId, eventOrdinal: event.eventOrdinal };
}

async function readOutcomeReceipt(
  tx: LocalLibsqlTransaction,
  row: z.infer<typeof storedReceiptSchema>,
) {
  const rejection = await readRejection(tx, row);
  const events = storedEventSchema.array().parse(
    canonicalResultObjects(
      await tx.execute({
        sql: `SELECT project_id AS projectId, receipt_id AS receiptId, receipt_outcome AS receiptOutcome,
      project_sequence AS projectSequence, event_id AS eventId, event_ordinal AS eventOrdinal,
      aggregate_type AS aggregateType, aggregate_id AS aggregateId, aggregate_version AS aggregateVersion,
      event_type AS eventType, event_version AS eventVersion, payload_json AS payloadText,
      payload_hash AS payloadHash, occurred_at AS occurredAt
      FROM canonical_events WHERE project_id=? AND receipt_id=? ORDER BY event_ordinal`,
        args: [row.projectId, row.receiptId],
      }),
    ),
  );
  if (row.outcome !== "applied" && events.length !== 0)
    throw new Error("Canonical non-applied receipt has event children.");
  const {
    fingerprint: _fingerprint,
    generationProjectId: _project,
    generationNumber: _generation,
    ...metadata
  } = row;
  return CanonicalCommandReceiptSchema.parse({
    ...metadata,
    ...rejection,
    events: events.map((event) => readEventReference(event, row)),
  });
}

export async function readCanonicalSettlement(
  tx: LocalLibsqlTransaction,
  command: CanonicalCommandSnapshot,
  writerGeneration: WriterGeneration,
) {
  const state = canonicalExactlyOne(
    z
      .strictObject({
        lastProjectSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      })
      .array()
      .parse(
        canonicalResultObjects(
          await tx.execute({
            sql: "SELECT last_project_sequence AS lastProjectSequence FROM project_state WHERE project_id=?",
            args: [command.projectId],
          }),
        ),
      ),
  );
  const original = await originalReceipt(tx, command, state.lastProjectSequence, writerGeneration);
  if (original === undefined) {
    if (state.lastProjectSequence === Number.MAX_SAFE_INTEGER)
      return { status: "sequence-exhausted" as const };
    return {
      status: "new" as const,
      projectSequence: ProjectSequenceSchema.parse(state.lastProjectSequence + 1),
    };
  }
  const fingerprint = hashCanonicalJson(command);
  if (original.fingerprint !== fingerprint) {
    await readOutcomeReceipt(tx, original);
    return readConflict(tx, command, original, {
      lastProjectSequence: state.lastProjectSequence,
      writerGeneration,
    });
  }
  const row = canonicalExactlyOne(
    storedReceiptSchema.array().parse(
      canonicalResultObjects(
        await tx.execute({
          sql: `${receiptSelect} AND r.command_id=? AND r.command_fingerprint=?`,
          args: [command.projectId, command.commandId, fingerprint],
        }),
      ),
    ),
  );
  const matchesRequest = [
    canonicalJsonText(row) === canonicalJsonText(original),
    row.commandType === command.type,
    row.commandVersion === command.version,
  ].every(Boolean);
  if (!matchesRequest) throw new Error("Canonical requested receipt authority is inconsistent.");
  const receipt = await readOutcomeReceipt(tx, row);
  return { status: "settled" as const, receipt };
}

async function readConflict(
  tx: LocalLibsqlTransaction,
  command: CanonicalCommandSnapshot,
  original: z.infer<typeof storedReceiptSchema>,
  authority: Readonly<{ lastProjectSequence: number; writerGeneration: WriterGeneration }>,
) {
  const fingerprint = hashCanonicalJson(command);
  const { lastProjectSequence, writerGeneration } = authority;
  const rows = storedReceiptSchema.array().parse(
    canonicalResultObjects(
      await tx.execute({
        sql: `${receiptSelect} AND r.command_id=? AND r.command_fingerprint=?`,
        args: [command.projectId, command.commandId, fingerprint],
      }),
    ),
  );
  if (rows.length === 0) {
    if (lastProjectSequence === Number.MAX_SAFE_INTEGER)
      return { status: "sequence-exhausted" as const };
    return {
      status: "conflict" as const,
      projectSequence: ProjectSequenceSchema.parse(lastProjectSequence + 1),
    };
  }
  const row = canonicalExactlyOne(rows);
  const coherent = [
    row.projectId === command.projectId,
    row.commandId === command.commandId,
    row.fingerprint === fingerprint,
    row.commandType === command.type,
    row.commandVersion === command.version,
    row.receiptId !== original.receiptId,
    row.projectSequence > original.projectSequence,
    row.projectSequence <= lastProjectSequence,
    row.writerGeneration <= writerGeneration,
    row.generationNumber === row.writerGeneration,
    row.generationProjectId === row.projectId,
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical conflict receipt authority is inconsistent.");
  const receipt = await readOutcomeReceipt(tx, row);
  if (receipt.outcome !== "rejected" || receipt.rejection.code !== "IDEMPOTENCY_CONFLICT")
    throw new Error("Canonical conflict receipt outcome is inconsistent.");
  return { status: "settled" as const, receipt };
}

async function persistRejection(tx: LocalLibsqlTransaction, r: CanonicalCommandReceipt) {
  if (r.outcome !== "rejected") return;
  const details = { version: 1 };
  canonicalChangedOnce(
    await tx.execute({
      sql: "INSERT INTO command_rejections (project_id,receipt_id,receipt_outcome,project_sequence,rejection_code,retryable,details_json,details_hash) VALUES (?,?,?,?,?,?,?,?)",
      args: [
        r.projectId,
        r.receiptId,
        "rejected",
        r.projectSequence,
        r.rejection.code,
        r.rejection.retryable ? 1 : 0,
        canonicalJsonText(details),
        hashCanonicalJson(details),
      ],
    }),
  );
}

async function persistOriginalPointer(
  tx: LocalLibsqlTransaction,
  r: CanonicalCommandReceipt,
  fingerprint: string,
) {
  canonicalChangedOnce(
    await tx.execute({
      sql: "INSERT INTO command_idempotency (project_id,command_id,original_command_fingerprint,original_receipt_id,created_at) VALUES (?,?,?,?,?)",
      args: [r.projectId, r.commandId, fingerprint, r.receiptId, r.settledAt],
    }),
  );
}

export async function persistCanonicalSettlement(
  input: Readonly<{
    transaction: LocalLibsqlTransaction;
    fingerprint: string;
    receipt: CanonicalCommandReceipt;
    events: readonly AppliedEventRow[];
    original: boolean;
  }>,
): Promise<void> {
  const { transaction: tx, receipt: r, fingerprint } = input;
  canonicalChangedOnce(
    await tx.execute({
      sql: "UPDATE project_state SET last_project_sequence=?, updated_at=? WHERE project_id=? AND last_project_sequence=? AND last_writer_generation=?",
      args: [
        r.projectSequence,
        r.settledAt,
        r.projectId,
        r.projectSequence - 1,
        r.writerGeneration,
      ],
    }),
  );
  canonicalChangedOnce(
    await tx.execute({
      sql: "INSERT INTO command_receipts (project_id,receipt_id,command_id,command_type,command_version,command_fingerprint,outcome,project_sequence,writer_generation,settled_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [
        r.projectId,
        r.receiptId,
        r.commandId,
        r.commandType,
        r.commandVersion,
        fingerprint,
        r.outcome,
        r.projectSequence,
        r.writerGeneration,
        r.settledAt,
      ],
    }),
  );
  if (input.original) await persistOriginalPointer(tx, r, fingerprint);
  await persistRejection(tx, r);
  for (const event of input.events) {
    canonicalChangedOnce(
      await tx.execute({
        sql: "INSERT INTO canonical_events (project_id,event_id,receipt_id,receipt_outcome,project_sequence,event_ordinal,aggregate_type,aggregate_id,aggregate_version,event_type,event_version,payload_json,payload_hash,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [
          r.projectId,
          event.eventId,
          r.receiptId,
          "applied",
          r.projectSequence,
          event.eventOrdinal,
          event.aggregateType,
          event.aggregateId,
          event.aggregateVersion,
          event.eventType,
          event.eventVersion,
          event.payloadText,
          event.payloadHash,
          r.settledAt,
        ],
      }),
    );
  }
}
