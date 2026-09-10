import { isDomainIdentity } from "@slopstop/kernel";
import {
  type CommandId,
  CommandIdSchema,
  ProjectActivationIdSchema,
  type ProjectId,
  ProjectIdSchema,
  type WriterGeneration,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  CanonicalSha256Schema,
  canonicalChangedOnce,
  canonicalExactlyOne,
  canonicalJsonText,
  canonicalResultObjects,
} from "../canonical-json.js";
import {
  canonicalWriterUtcInstantSchema,
  currentCanonicalSettlementFence,
  normalizedUtc,
  readCanonicalProjectSequence,
  type readCanonicalWriterFence,
  readCheckedCanonicalSettlement,
} from "./canonical-command-ledger.js";
import type { LocalLibsqlTransaction } from "./local-libsql-worker-client.js";

export type CanonicalUncertaintyDescriptor = Readonly<{
  commandId: CommandId;
  fingerprint: string;
}>;
const recoveryIdentitySchema = z
  .string()
  .refine(isDomainIdentity)
  .refine((value) => value === value.toLowerCase());
const preparedRecoverySchema = z.strictObject({
  projectId: ProjectIdSchema,
  writerGeneration: WriterGenerationSchema,
  commandId: CommandIdSchema,
  fingerprint: CanonicalSha256Schema,
  recoveryRecordId: recoveryIdentitySchema,
  observedAt: canonicalWriterUtcInstantSchema,
});
export type PreparedCanonicalUncertainty = Readonly<z.infer<typeof preparedRecoverySchema>>;
const recordingRowSchema = preparedRecoverySchema.extend({
  reason: z.literal("commit-uncertain"),
  resolution: z.null(),
  resolvedByWriterGeneration: z.null(),
  resolvedAt: z.null(),
  sourceProjectId: ProjectIdSchema,
  sourceGeneration: WriterGenerationSchema,
  sourceActivationId: ProjectActivationIdSchema,
  sourceDigest: CanonicalSha256Schema,
  sourceAcquiredAt: canonicalWriterUtcInstantSchema,
  sourceReleasedAt: canonicalWriterUtcInstantSchema.nullable(),
});

export async function inspectCanonicalRecovery(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
  previous: Awaited<ReturnType<typeof readCanonicalWriterFence>>,
) {
  const rows = await readRecoveryRows(tx, projectId, previous?.generation ?? 0);
  if (rows.length === 0) return undefined;
  if (previous === undefined) throw new Error("Initial Writer has recovery records.");
  const row = recordingRowSchema.parse(canonicalExactlyOne(rows));
  const coherent = [
    row.projectId === projectId,
    row.writerGeneration === previous.generation,
    row.sourceProjectId === projectId,
    row.sourceGeneration === previous.generation,
    row.sourceActivationId === previous.generationActivationId,
    row.sourceDigest === previous.tokenDigest,
    normalizedUtc(row.sourceAcquiredAt) === normalizedUtc(previous.generationAcquiredAt),
    row.sourceReleasedAt === previous.generationReleasedAt,
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical recovery source authority is inconsistent.");
  const lookup = await readCheckedCanonicalSettlement(tx, {
    command: { projectId, commandId: row.commandId },
    fingerprint: row.fingerprint,
    writerGeneration: previous.generation,
    lastProjectSequence: await readCanonicalProjectSequence(tx, projectId),
  });
  return { row, resolution: lookup.status === "settled" ? "receipt-found" : "receipt-absent" };
}

export async function resolveCanonicalRecovery(
  tx: LocalLibsqlTransaction,
  recovery: NonNullable<Awaited<ReturnType<typeof inspectCanonicalRecovery>>>,
  generation: WriterGeneration,
  resolvedAt: string,
) {
  const { row, resolution } = recovery;
  canonicalChangedOnce(
    await tx.execute({
      sql: `UPDATE writer_recovery_records SET resolution=?,resolved_by_writer_generation=?,resolved_at=?
      WHERE project_id=? AND recovery_record_id=? AND writer_generation=? AND reason='commit-uncertain'
      AND command_id=? AND command_fingerprint=? AND observed_at=?
      AND resolution IS NULL AND resolved_by_writer_generation IS NULL AND resolved_at IS NULL`,
      args: [
        resolution,
        generation,
        resolvedAt,
        row.projectId,
        row.recoveryRecordId,
        row.writerGeneration,
        row.commandId,
        row.fingerprint,
        row.observedAt,
      ],
    }),
  );
}

async function readRecoveryRows(
  tx: LocalLibsqlTransaction,
  projectId: ProjectId,
  generation: number,
) {
  return canonicalResultObjects(
    await tx.execute({
      sql: `SELECT r.project_id AS projectId, r.recovery_record_id AS recoveryRecordId,
      r.writer_generation AS writerGeneration, r.reason, r.command_id AS commandId,
      r.command_fingerprint AS fingerprint, r.observed_at AS observedAt, r.resolution,
      r.resolved_by_writer_generation AS resolvedByWriterGeneration, r.resolved_at AS resolvedAt,
      g.project_id AS sourceProjectId, g.writer_generation AS sourceGeneration,
      g.activation_id AS sourceActivationId, g.token_digest AS sourceDigest,
      g.acquired_at AS sourceAcquiredAt, g.released_at AS sourceReleasedAt
      FROM writer_recovery_records AS r LEFT JOIN writer_generations AS g
      ON g.project_id=r.project_id AND g.writer_generation=r.writer_generation
      WHERE r.project_id=? AND (r.writer_generation>=? OR r.resolution IS NULL)`,
      args: [projectId, generation],
    }),
  );
}

export function prepareCanonicalUncertainty(
  source: CanonicalUncertaintyDescriptor &
    Readonly<{ projectId: ProjectId; writerGeneration: WriterGeneration }>,
  dependencies: Readonly<{ createRecoveryRecordId(): string; now(): string }>,
): PreparedCanonicalUncertainty {
  const recoveryRecordId = recoveryIdentitySchema.parse(dependencies.createRecoveryRecordId());
  return Object.freeze(
    preparedRecoverySchema.parse({ ...source, recoveryRecordId, observedAt: dependencies.now() }),
  );
}

export async function recordCanonicalUncertainty(
  tx: LocalLibsqlTransaction,
  record: PreparedCanonicalUncertainty,
  digest: string,
): Promise<Readonly<{ status: "current" | "stale" }>> {
  if (
    !(await currentCanonicalSettlementFence(tx, record.projectId, record.writerGeneration, digest))
  )
    return { status: "stale" };
  const rows = await readRecoveryRows(tx, record.projectId, record.writerGeneration);
  if (rows.length !== 0) {
    checkRecordedUncertainty(canonicalExactlyOne(rows), record, digest);
    return { status: "current" };
  }
  canonicalChangedOnce(
    await tx.execute({
      sql: `INSERT INTO writer_recovery_records (project_id,recovery_record_id,writer_generation,reason,command_id,command_fingerprint,observed_at,resolution,resolved_by_writer_generation,resolved_at)
      VALUES (?,?,?,'commit-uncertain',?,?,?,NULL,NULL,NULL)`,
      args: [
        record.projectId,
        record.recoveryRecordId,
        record.writerGeneration,
        record.commandId,
        record.fingerprint,
        record.observedAt,
      ],
    }),
  );
  return { status: "current" };
}

function checkRecordedUncertainty(
  value: unknown,
  record: PreparedCanonicalUncertainty,
  digest: string,
) {
  const {
    sourceProjectId,
    sourceGeneration,
    sourceActivationId: _activation,
    sourceDigest,
    sourceAcquiredAt: _acquired,
    sourceReleasedAt,
    ...row
  } = recordingRowSchema.parse(value);
  const expected = {
    ...record,
    reason: "commit-uncertain",
    resolution: null,
    resolvedByWriterGeneration: null,
    resolvedAt: null,
  };
  const coherent = [
    sourceProjectId === record.projectId,
    sourceGeneration === record.writerGeneration,
    sourceDigest === digest,
    sourceReleasedAt === null,
    canonicalJsonText(row) === canonicalJsonText(expected),
  ].every(Boolean);
  if (!coherent) throw new Error("Canonical Writer recovery record is inconsistent.");
}
