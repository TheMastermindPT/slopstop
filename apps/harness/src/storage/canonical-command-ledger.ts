import {
  type CanonicalCommandReceipt,
  CanonicalCommandReceiptSchema,
  type CanonicalEventId,
  CanonicalEventIdSchema,
  CanonicalEventOrdinalSchema,
  CanonicalSettlementTimeSchema,
  CommandReceiptMetadataSchema,
  CommandRejectionSchema,
  dateTimeTextSchema,
  decodeStrict,
  ProjectActivationIdSchema,
  type ProjectId,
  ProjectIdSchema,
  ProjectSequenceSchema,
  type WriterGeneration,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
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

export const canonicalWriterUtcInstantSchema = dateTimeTextSchema({ offset: true }).check(
  Schema.isPattern(/T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u),
);
export const canonicalWriterFenceSchema = Schema.Struct({
  generation: WriterGenerationSchema,
  tokenDigest: CanonicalSha256Schema,
  state: Schema.Literals(["active", "released"]),
  activatedAt: canonicalWriterUtcInstantSchema,
  releasedAt: Schema.NullOr(canonicalWriterUtcInstantSchema),
  generationNumber: Schema.NullOr(WriterGenerationSchema),
  generationDigest: Schema.NullOr(CanonicalSha256Schema),
  generationAcquiredAt: Schema.NullOr(canonicalWriterUtcInstantSchema),
  generationReleasedAt: Schema.NullOr(canonicalWriterUtcInstantSchema),
});
const settlementFenceRowsSchema = Schema.Array(
  Schema.Struct({
    ...canonicalWriterFenceSchema.fields,
    projectId: ProjectIdSchema,
    generationProjectId: ProjectIdSchema,
    generationActivationId: ProjectActivationIdSchema,
    generationNumber: WriterGenerationSchema,
    generationDigest: CanonicalSha256Schema,
    generationAcquiredAt: canonicalWriterUtcInstantSchema,
  }),
);
const SqlCountSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export function normalizedUtc(value: string): string {
  const [seconds, fraction = ""] = decodeStrict(canonicalWriterUtcInstantSchema, value)
    .slice(0, -1)
    .split(".");
  return `${seconds}.${fraction.replace(/0+$/u, "")}`;
}
export function coherentCanonicalWriterRelease(
  fence: typeof canonicalWriterFenceSchema.Type,
): boolean {
  if (fence.state === "active")
    return fence.releasedAt === null && fence.generationReleasedAt === null;
  if (fence.releasedAt === null || fence.generationReleasedAt === null) return false;
  return normalizedUtc(fence.releasedAt) === normalizedUtc(fence.generationReleasedAt);
}

export async function currentCanonicalSettlementFence(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
  generation: WriterGeneration,
  digest: string,
): Promise<boolean> {
  const fence = await readCanonicalWriterFence(tx, projectId);
  return (
    fence !== undefined &&
    fence.state === "active" &&
    fence.generation === generation &&
    fence.tokenDigest === digest
  );
}

export async function readCanonicalWriterFence(tx: LocalLibsqlTransaction, projectId: ProjectId) {
  const rows = decodeStrict(
    settlementFenceRowsSchema,
    canonicalResultObjects(
      await tx.execute({
        sql: `SELECT f.project_id AS projectId, f.writer_generation AS generation,
      f.token_digest AS tokenDigest, f.state, f.activated_at AS activatedAt, f.released_at AS releasedAt,
      g.project_id AS generationProjectId, g.activation_id AS generationActivationId,
      g.writer_generation AS generationNumber, g.token_digest AS generationDigest,
      g.acquired_at AS generationAcquiredAt, g.released_at AS generationReleasedAt
      FROM writer_fence AS f LEFT JOIN writer_generations AS g
      ON g.project_id=f.project_id AND g.writer_generation=f.writer_generation WHERE f.project_id=?`,
        args: [projectId],
      }),
    ),
  );
  if (rows.length === 0) return undefined;
  const fence = canonicalExactlyOne(rows);
  const coherent = [
    fence.projectId === projectId,
    fence.generationProjectId === projectId,
    fence.generation === fence.generationNumber,
    fence.tokenDigest === fence.generationDigest,
    normalizedUtc(fence.activatedAt) === normalizedUtc(fence.generationAcquiredAt),
    coherentCanonicalWriterRelease(fence),
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical settlement fence authority is inconsistent.");
  return fence;
}

export type AppliedEventRow = Omit<CanonicalEventInput, "payload"> &
  Readonly<{
    eventId: CanonicalEventId;
    eventOrdinal: number;
    payloadText: string;
    payloadHash: string;
  }>;

const storedReceiptSchema = Schema.Struct({
  ...CommandReceiptMetadataSchema.fields,
  outcome: Schema.Literals(["applied", "unchanged", "rejected"]),
  fingerprint: CanonicalSha256Schema,
  generationProjectId: CommandReceiptMetadataSchema.fields.projectId,
  generationNumber: CommandReceiptMetadataSchema.fields.writerGeneration,
});
type StoredReceipt = typeof storedReceiptSchema.Type;
const storedReceiptRowsSchema = Schema.Array(storedReceiptSchema);
type CommandIdentity = Pick<CanonicalCommandSnapshot, "projectId" | "commandId">;
type SettlementLookup = Readonly<{
  command: CommandIdentity;
  fingerprint: string;
  lastProjectSequence: number;
  writerGeneration: WriterGeneration;
  checkRequested?: (row: StoredReceipt, conflict: boolean) => void;
}>;
const pointerRowsSchema = Schema.Array(
  Schema.Struct({
    projectId: CommandReceiptMetadataSchema.fields.projectId,
    commandId: CommandReceiptMetadataSchema.fields.commandId,
    receiptId: CommandReceiptMetadataSchema.fields.receiptId,
    fingerprint: CanonicalSha256Schema,
    createdAt: CanonicalSettlementTimeSchema,
  }),
);
const { payload: _payload, ...eventInputFields } = CanonicalEventInputSchema.fields;
const storedEventSchema = Schema.Struct({
  ...eventInputFields,
  projectId: CommandReceiptMetadataSchema.fields.projectId,
  receiptId: CommandReceiptMetadataSchema.fields.receiptId,
  receiptOutcome: Schema.Literal("applied"),
  projectSequence: ProjectSequenceSchema,
  eventId: CanonicalEventIdSchema,
  eventOrdinal: CanonicalEventOrdinalSchema,
  occurredAt: CanonicalSettlementTimeSchema,
  payloadText: Schema.String,
  payloadHash: CanonicalSha256Schema,
});
const storedEventRowsSchema = Schema.Array(storedEventSchema);
const receiptSelect = `SELECT r.project_id AS projectId, r.receipt_id AS receiptId, r.command_id AS commandId,
  r.command_type AS commandType, r.command_version AS commandVersion, r.outcome,
  r.project_sequence AS projectSequence, r.writer_generation AS writerGeneration, r.settled_at AS settledAt,
  r.command_fingerprint AS fingerprint, g.project_id AS generationProjectId, g.writer_generation AS generationNumber
  FROM command_receipts AS r LEFT JOIN writer_generations AS g
  ON g.project_id=r.project_id AND g.writer_generation=r.writer_generation WHERE r.project_id=?`;

const storedRejectionRowsSchema = Schema.Array(
  Schema.Struct({
    projectId: CommandReceiptMetadataSchema.fields.projectId,
    receiptId: CommandReceiptMetadataSchema.fields.receiptId,
    projectSequence: CommandReceiptMetadataSchema.fields.projectSequence,
    receiptOutcome: Schema.Literal("rejected"),
    code: Schema.String,
    retryable: Schema.Literals([0, 1]),
    detailsText: Schema.String,
    detailsHash: CanonicalSha256Schema,
  }),
);
const rejectionDetailsSchema = Schema.Struct({ version: Schema.Literal(1) });

async function readRejection(tx: LocalLibsqlTransaction, row: StoredReceipt) {
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
  const child = canonicalExactlyOne(decodeStrict(storedRejectionRowsSchema, rows));
  const bound = [
    child.projectId === row.projectId,
    child.receiptId === row.receiptId,
    child.projectSequence === row.projectSequence,
  ].every(Boolean);
  if (!bound) throw new Error("Canonical rejection source binding is inconsistent.");
  const details = decodeStrict(rejectionDetailsSchema, parseCanonicalJson(child.detailsText));
  const intact = [
    canonicalJsonText(details) === child.detailsText,
    hashCanonicalJson(details) === child.detailsHash,
  ].every(Boolean);
  if (!intact) throw new Error("Canonical rejection details integrity is inconsistent.");
  return {
    rejection: decodeStrict(CommandRejectionSchema, {
      code: child.code,
      retryable: child.retryable === 1,
    }),
  };
}

async function originalReceipt(
  tx: LocalLibsqlTransaction,
  command: CommandIdentity,
  lastProjectSequence: number,
  writerGeneration: WriterGeneration,
) {
  const count = canonicalExactlyOne(
    decodeStrict(
      Schema.Array(Schema.Struct({ receiptCount: SqlCountSchema })),
      canonicalResultObjects(
        await tx.execute({
          sql: "SELECT COUNT(*) AS receiptCount FROM command_receipts WHERE project_id=? AND command_id=?",
          args: [command.projectId, command.commandId],
        }),
      ),
    ),
  );
  const pointers = decodeStrict(
    pointerRowsSchema,
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
    decodeStrict(
      storedReceiptRowsSchema,
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

function readEventReference(event: typeof storedEventSchema.Type, row: StoredReceipt) {
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

async function readOutcomeReceipt(tx: LocalLibsqlTransaction, row: StoredReceipt) {
  const rejection = await readRejection(tx, row);
  const events = decodeStrict(
    storedEventRowsSchema,
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
  return decodeStrict(CanonicalCommandReceiptSchema, {
    ...metadata,
    ...rejection,
    events: events.map((event) => readEventReference(event, row)),
  });
}

export async function readCanonicalProjectSequence(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
) {
  const state = canonicalExactlyOne(
    decodeStrict(
      Schema.Array(Schema.Struct({ lastProjectSequence: SqlCountSchema })),
      canonicalResultObjects(
        await tx.execute({
          sql: "SELECT last_project_sequence AS lastProjectSequence FROM project_state WHERE project_id=?",
          args: [projectId],
        }),
      ),
    ),
  );
  return state.lastProjectSequence;
}

export async function readCanonicalSettlement(
  tx: LocalLibsqlTransaction,
  command: CanonicalCommandSnapshot,
  writerGeneration: WriterGeneration,
  fingerprint: string,
) {
  const lastProjectSequence = await readCanonicalProjectSequence(tx, command.projectId);
  return readCheckedCanonicalSettlement(tx, {
    command,
    fingerprint,
    lastProjectSequence,
    writerGeneration,
    checkRequested: (row, conflict) => {
      if (row.commandType !== command.type || row.commandVersion !== command.version)
        throw new Error(
          conflict
            ? "Canonical conflict receipt authority is inconsistent."
            : "Canonical requested receipt authority is inconsistent.",
        );
    },
  });
}

export async function readCheckedCanonicalSettlement(
  tx: LocalLibsqlTransaction,
  lookup: SettlementLookup,
) {
  const { command, fingerprint, lastProjectSequence, writerGeneration } = lookup;
  const original = await originalReceipt(tx, command, lastProjectSequence, writerGeneration);
  if (original === undefined) {
    if (lastProjectSequence === Number.MAX_SAFE_INTEGER)
      return { status: "sequence-exhausted" as const };
    return {
      status: "new" as const,
      projectSequence: decodeStrict(ProjectSequenceSchema, lastProjectSequence + 1),
    };
  }
  const receipt = await readOriginalReceiptOutcome(tx, original);
  if (original.fingerprint !== fingerprint) {
    return readConflict(tx, lookup, original);
  }
  const row = canonicalExactlyOne(
    decodeStrict(
      storedReceiptRowsSchema,
      canonicalResultObjects(
        await tx.execute({
          sql: `${receiptSelect} AND r.command_id=? AND r.command_fingerprint=?`,
          args: [command.projectId, command.commandId, fingerprint],
        }),
      ),
    ),
  );
  const matchesRequest = canonicalJsonText(row) === canonicalJsonText(original);
  if (!matchesRequest) throw new Error("Canonical requested receipt authority is inconsistent.");
  checkRequestedReceipt(lookup, row, false);
  return { status: "settled" as const, receipt };
}

async function readOriginalReceiptOutcome(tx: LocalLibsqlTransaction, original: StoredReceipt) {
  const receipt = await readOutcomeReceipt(tx, original);
  if (receipt.outcome === "rejected" && receipt.rejection.code === "IDEMPOTENCY_CONFLICT")
    throw new Error("Canonical original receipt authority is inconsistent.");
  return receipt;
}

async function readConflict(
  tx: LocalLibsqlTransaction,
  lookup: SettlementLookup,
  original: StoredReceipt,
) {
  const { command, fingerprint, lastProjectSequence, writerGeneration } = lookup;
  const rows = decodeStrict(
    storedReceiptRowsSchema,
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
      projectSequence: decodeStrict(ProjectSequenceSchema, lastProjectSequence + 1),
    };
  }
  const row = canonicalExactlyOne(rows);
  const coherent = [
    row.projectId === command.projectId,
    row.commandId === command.commandId,
    row.fingerprint === fingerprint,
    row.receiptId !== original.receiptId,
    row.projectSequence > original.projectSequence,
    row.projectSequence <= lastProjectSequence,
    row.writerGeneration <= writerGeneration,
    row.generationNumber === row.writerGeneration,
    row.generationProjectId === row.projectId,
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical conflict receipt authority is inconsistent.");
  checkRequestedReceipt(lookup, row, true);
  const receipt = await readOutcomeReceipt(tx, row);
  if (receipt.outcome !== "rejected" || receipt.rejection.code !== "IDEMPOTENCY_CONFLICT")
    throw new Error("Canonical conflict receipt outcome is inconsistent.");
  return { status: "settled" as const, receipt };
}

function checkRequestedReceipt(lookup: SettlementLookup, row: StoredReceipt, conflict: boolean) {
  lookup.checkRequested?.(row, conflict);
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
