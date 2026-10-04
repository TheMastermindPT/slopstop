import { createHash, randomUUID } from "node:crypto";
import {
  dateTimeTextSchema,
  decodeStrict,
  decodeStrictResult,
  ProjectIdSchema,
  type RegisteredProject,
  RegisteredProjectSchema,
  UuidTextSchema,
} from "@slopstop/protocol";
import { Result, Schema } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { PhysicalDirectoryKeySchema, samePhysicalIdentity } from "./physical-identity.js";
import {
  PrepareProjectRegistrationSchema,
  preparationFingerprint,
  type RegistrationProposalRecord,
  RegistrationProposalRecordSchema,
  readProposal,
} from "./registration-proposal-store.js";
import { registryRows } from "./registry-database.js";
import { RegistryFault } from "./registry-failure.js";
import type { discoverSelectedPhysical } from "./repository-physical-observation.js";
import type { RepositoryTrustOwner } from "./repository-trust.js";

export const ConfirmationValidationRequestSchema = Schema.Struct({
  version: Schema.Literal(1),
  requestId: UuidTextSchema.pipe(Schema.brand("RegistrationRequestId")),
  preparation: PrepareProjectRegistrationSchema,
  proposalId: RegistrationProposalRecordSchema.fields.proposalId,
  proposalFingerprint: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
});
export type ConfirmationRequest = typeof ConfirmationValidationRequestSchema.Type;

const reservationSchema = Schema.Struct({
  version: Schema.Literal(1),
  reservationId: UuidTextSchema.pipe(Schema.brand("RegistrationReservationId")),
  projectId: ProjectIdSchema,
  repositoryBindingId: UuidTextSchema.pipe(Schema.brand("RepositoryBindingId")),
  workspaceId: UuidTextSchema.pipe(Schema.brand("WorkspaceId")),
  createRequestId: UuidTextSchema.pipe(Schema.brand("ProjectStorageCreateRequestId")),
  createdAt: dateTimeTextSchema(),
  proposal: RegistrationProposalRecordSchema,
  confirmationPhaseId: UuidTextSchema,
});
export type Reservation = typeof reservationSchema.Type;
const { version: _keyVersion, ...commonKeyFields } = PhysicalDirectoryKeySchema.fields;
const reservationKeyRowsSchema = Schema.Tuple([
  Schema.Struct({ ...commonKeyFields, recordJson: Schema.String, fingerprint: Schema.String }),
]);
const requestRowsSchema = Schema.Array(
  Schema.Struct({
    fingerprint: Schema.String,
    requestJson: Schema.String,
    reservationId: UuidTextSchema,
  }),
).check(Schema.isMaxLength(1));
const reservationIdRowsSchema = Schema.Array(Schema.Struct({ reservationId: UuidTextSchema }));
const publicationRowsSchema = Schema.Array(
  Schema.Struct({
    requestId: UuidTextSchema,
    resultJson: Schema.String,
    fingerprint: Schema.String,
  }),
).check(Schema.isMaxLength(1));
const reservationRequestRowsSchema = Schema.Array(
  Schema.Struct({
    requestId: ConfirmationValidationRequestSchema.fields.requestId,
    reservationId: reservationSchema.fields.reservationId,
    requestJson: Schema.String,
  }),
).check(Schema.isMinLength(1));
export type RegistrationBootstrap = (
  reservation: Reservation,
  request: ConfirmationRequest,
  signal: AbortSignal,
) => Promise<
  | RegisteredProject
  | {
      status: "pending-recovery";
      code: "REGISTRATION_INCOMPLETE" | "PRIOR_STATE_WITNESS";
      requestId: string;
    }
  | { status: "broken"; code: "INTERNAL_FAILURE" }
  | { status: "rejected"; code: "REPOSITORY_IDENTITY_CHANGED" }
  | Exclude<
      Awaited<ReturnType<RepositoryTrustOwner["admitRepositoryIdentityQueries"]>>,
      { status: "admitted" }
    >
  | Exclude<
      Awaited<ReturnType<typeof discoverSelectedPhysical>>,
      { status: "captured" } | { status: "unresolved" }
    >
>;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const corrupt = () => new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });

export function incomplete(request: ConfirmationRequest) {
  return {
    status: "pending-recovery",
    code: "REGISTRATION_INCOMPLETE",
    requestId: request.requestId,
  } as const;
}

async function readReservation(transaction: LocalLibsqlTransaction, id: string) {
  const result = await transaction.execute({
    sql: "SELECT common_platform AS platform, common_volume_identity AS volumeIdentity, common_file_identity AS fileIdentity, common_birth_identity AS birthIdentity, record_json AS recordJson, record_fingerprint AS fingerprint FROM registration_reservations WHERE reservation_id = ?",
    args: [id],
  });
  try {
    const row = decodeStrict(reservationKeyRowsSchema, registryRows(result))[0];
    const record = decodeStrict(reservationSchema, JSON.parse(row.recordJson));
    const common = record.proposal.observation.physical.commonDirectory;
    if (
      record.reservationId !== id ||
      digest(record) !== row.fingerprint ||
      common.platform !== row.platform ||
      common.volumeIdentity !== row.volumeIdentity ||
      common.fileIdentity !== row.fileIdentity ||
      common.birthIdentity !== row.birthIdentity
    )
      throw corrupt();
    return record;
  } catch {
    throw corrupt();
  }
}

export async function readConfirmation(
  transaction: LocalLibsqlTransaction,
  request: ConfirmationRequest,
) {
  const result = await transaction.execute({
    sql: "SELECT input_fingerprint AS fingerprint, request_json AS requestJson, reservation_id AS reservationId FROM registration_requests WHERE request_id = ?",
    args: [request.requestId],
  });
  const parsed = decodeStrictResult(requestRowsSchema, registryRows(result));
  if (Result.isFailure(parsed)) throw corrupt();
  const row = parsed.success[0];
  if (row === undefined) return undefined;
  let saved: ConfirmationRequest;
  try {
    saved = decodeStrict(ConfirmationValidationRequestSchema, JSON.parse(row.requestJson));
  } catch {
    throw corrupt();
  }
  if (saved.requestId !== request.requestId || digest(saved) !== row.fingerprint) throw corrupt();
  const reservation = await readReservation(transaction, row.reservationId);
  const proposal = await readProposal(transaction, saved.preparation);
  if (
    proposal === undefined ||
    proposal.proposalId !== saved.proposalId ||
    preparationFingerprint(proposal) !== saved.proposalFingerprint ||
    !samePhysicalIdentity(
      proposal.observation.physical.commonDirectory,
      reservation.proposal.observation.physical.commonDirectory,
    )
  )
    throw corrupt();
  if (digest(request) !== row.fingerprint) {
    throw new RegistryFault({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
  }
  const publication = await readPublication(transaction, reservation);
  if (publication === undefined) return incomplete(request);
  if (publication.requestId === request.requestId) return publication;
  return {
    status: "requires-project-selection",
    projectId: publication.projectId,
    requestId: request.requestId,
  } as const;
}

async function findCommonReservation(
  transaction: LocalLibsqlTransaction,
  proposal: RegistrationProposalRecord,
) {
  const key = proposal.observation.physical.commonDirectory;
  const result = await transaction.execute({
    sql: "SELECT reservation_id AS reservationId FROM registration_reservations WHERE common_platform = ? AND common_volume_identity = ? AND common_file_identity = ? AND common_birth_identity = ?",
    args: [key.platform, key.volumeIdentity, key.fileIdentity, key.birthIdentity],
  });
  const rows = decodeStrictResult(
    reservationIdRowsSchema.check(Schema.isMaxLength(1)),
    registryRows(result),
  );
  if (Result.isFailure(rows)) throw corrupt();
  const found = rows.success[0];
  return found === undefined ? undefined : readReservation(transaction, found.reservationId);
}

async function insertReservation(transaction: LocalLibsqlTransaction, record: Reservation) {
  const key = record.proposal.observation.physical.commonDirectory;
  await transaction.execute({
    sql: "INSERT INTO registration_reservations (reservation_id, common_platform, common_volume_identity, common_file_identity, common_birth_identity, record_json, record_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [
      record.reservationId,
      key.platform,
      key.volumeIdentity,
      key.fileIdentity,
      key.birthIdentity,
      JSON.stringify(record),
      digest(record),
    ],
  });
}

export async function reserveConfirmation(
  transaction: LocalLibsqlTransaction,
  input: { request: ConfirmationRequest; saved: RegistrationProposalRecord; phaseId: string },
  signal: AbortSignal,
) {
  const previous = await readConfirmation(transaction, input.request);
  if (previous !== undefined) return previous;
  if (signal.aborted) return { status: "cancelled" } as const;
  let reservation = await findCommonReservation(transaction, input.saved);
  const created = reservation === undefined;
  if (reservation === undefined) {
    reservation = decodeStrict(reservationSchema, {
      version: 1,
      reservationId: randomUUID(),
      projectId: randomUUID(),
      repositoryBindingId: randomUUID(),
      workspaceId: randomUUID(),
      createRequestId: randomUUID(),
      createdAt: new Date().toISOString(),
      proposal: input.saved,
      confirmationPhaseId: input.phaseId,
    });
    await insertReservation(transaction, reservation);
  }
  await transaction.execute({
    sql: "INSERT INTO registration_requests (request_id, input_fingerprint, request_json, reservation_id) VALUES (?, ?, ?, ?)",
    args: [
      input.request.requestId,
      digest(input.request),
      JSON.stringify(input.request),
      reservation.reservationId,
    ],
  });
  return { status: "reserved" as const, reservation, request: input.request, created };
}

async function readPublication(transaction: LocalLibsqlTransaction, reservation: Reservation) {
  const result = await transaction.execute({
    sql: "SELECT request_id AS requestId, result_json AS resultJson, result_fingerprint AS fingerprint FROM registration_publications WHERE reservation_id = ?",
    args: [reservation.reservationId],
  });
  try {
    const row = decodeStrict(publicationRowsSchema, registryRows(result))[0];
    if (row === undefined) return undefined;
    const receipt = decodeStrict(RegisteredProjectSchema, JSON.parse(row.resultJson));
    if (
      digest(receipt) !== row.fingerprint ||
      receipt.requestId !== row.requestId ||
      receipt.projectId !== reservation.projectId ||
      receipt.repositoryBindingId !== reservation.repositoryBindingId ||
      receipt.workspaceId !== reservation.workspaceId ||
      receipt.proposalId !== reservation.proposal.proposalId
    )
      throw corrupt();
    const generation = await transaction.execute({
      sql: "SELECT project_id, storage_id, create_request_id FROM storage_generations WHERE generation_id = ? AND activated_at IS NOT NULL",
      args: [receipt.generationId],
    });
    if (
      JSON.stringify(generation.rows) !==
      JSON.stringify([[reservation.projectId, receipt.storageId, reservation.createRequestId]])
    )
      throw corrupt();
    return receipt;
  } catch {
    throw corrupt();
  }
}

export class RegistrationPublicationCancelled extends Error {}

export async function publishRegistration(
  transaction: LocalLibsqlTransaction,
  reservation: Reservation,
  input: RegisteredProject,
  signal: AbortSignal,
) {
  const result = decodeStrict(RegisteredProjectSchema, input);
  const previous = await readPublication(transaction, reservation);
  if (previous !== undefined) return previous;
  if (signal.aborted) throw new RegistrationPublicationCancelled();
  await transaction.execute({
    sql: "INSERT INTO registration_publications (reservation_id, request_id, result_json, result_fingerprint) VALUES (?, ?, ?, ?)",
    args: [reservation.reservationId, result.requestId, JSON.stringify(result), digest(result)],
  });
  const publication = await readPublication(transaction, reservation);
  // Throw while still inside the write transaction: only uncommitted publication
  // is rolled back. A receipt committed before cancellation is never erased.
  if (signal.aborted) throw new RegistrationPublicationCancelled();
  return (
    publication ??
    (() => {
      throw corrupt();
    })()
  );
}

export function reservationFingerprint(reservation: Reservation) {
  return digest(reservation);
}

export async function readProjectRegistrationRecords(transaction: LocalLibsqlTransaction) {
  const ids = decodeStrictResult(
    reservationIdRowsSchema,
    registryRows(
      await transaction.execute(
        "SELECT reservation_id AS reservationId FROM registration_reservations ORDER BY reservation_id",
      ),
    ),
  );
  if (Result.isFailure(ids)) throw corrupt();
  const records = [];
  const projects = new Set<string>();
  for (const { reservationId } of ids.success) {
    const reservation = await readReservation(transaction, reservationId);
    if (projects.has(reservation.projectId)) throw corrupt();
    projects.add(reservation.projectId);
    const requests = await transaction.execute({
      sql: "SELECT request_id AS requestId, reservation_id AS reservationId, request_json AS requestJson FROM registration_requests WHERE reservation_id = ?",
      args: [reservationId],
    });
    const rows = decodeStrictResult(reservationRequestRowsSchema, registryRows(requests));
    if (Result.isFailure(rows)) throw corrupt();
    for (const row of rows.success) {
      let request: ConfirmationRequest;
      try {
        request = decodeStrict(ConfirmationValidationRequestSchema, JSON.parse(row.requestJson));
      } catch {
        throw corrupt();
      }
      if (request.requestId !== row.requestId || row.reservationId !== reservationId)
        throw corrupt();
      if ((await readConfirmation(transaction, request)) === undefined) throw corrupt();
    }
    const publication = await readPublication(transaction, reservation);
    records.push({ reservation, publication });
  }
  return records;
}
