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
import { receiptGenerationResolves } from "../storage/application-database-migration.js";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { upgradeChainFor } from "../storage/project-storage-upgrade-node-adapter.js";
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

/** The reservation record, its row's fingerprint and its row's common-directory key agree. */
function reservationRowAgrees(
  input: Readonly<{
    record: Reservation;
    row: (typeof reservationKeyRowsSchema.Type)[0];
    id: string;
  }>,
): boolean {
  const { record, row, id } = input;
  const common = record.proposal.observation.physical.commonDirectory;
  return [
    record.reservationId === id,
    digest(record) === row.fingerprint,
    common.platform === row.platform,
    common.volumeIdentity === row.volumeIdentity,
    common.fileIdentity === row.fileIdentity,
    common.birthIdentity === row.birthIdentity,
  ].every(Boolean);
}

async function readReservation(transaction: LocalLibsqlTransaction, id: string) {
  const result = await transaction.execute({
    sql: "SELECT common_platform AS platform, common_volume_identity AS volumeIdentity, common_file_identity AS fileIdentity, common_birth_identity AS birthIdentity, record_json AS recordJson, record_fingerprint AS fingerprint FROM registration_reservations WHERE reservation_id = ?",
    args: [id],
  });
  try {
    const row = decodeStrict(reservationKeyRowsSchema, registryRows(result))[0];
    const record = decodeStrict(reservationSchema, JSON.parse(row.recordJson));
    if (!reservationRowAgrees({ record, row, id })) throw corrupt();
    return record;
  } catch {
    throw corrupt();
  }
}

/** The stored request row for `requestId` with its strictly decoded, self-consistent request. */
async function readSavedConfirmation(
  transaction: LocalLibsqlTransaction,
  requestId: ConfirmationRequest["requestId"],
) {
  const result = await transaction.execute({
    sql: "SELECT input_fingerprint AS fingerprint, request_json AS requestJson, reservation_id AS reservationId FROM registration_requests WHERE request_id = ?",
    args: [requestId],
  });
  const parsed = decodeStrictResult(requestRowsSchema, registryRows(result));
  if (Result.isFailure(parsed)) throw corrupt();
  const row = parsed.success[0];
  if (row === undefined) return undefined;
  const saved = decodeSavedRequest(row.requestJson);
  if (saved.requestId !== requestId || digest(saved) !== row.fingerprint) throw corrupt();
  return { row, saved };
}

export async function readConfirmation(
  transaction: LocalLibsqlTransaction,
  request: ConfirmationRequest,
) {
  const stored = await readSavedConfirmation(transaction, request.requestId);
  if (stored === undefined) return undefined;
  const { row, saved } = stored;
  const reservation = await readReservation(transaction, row.reservationId);
  const proposal = await readProposal(transaction, saved.preparation);
  if (!savedProposalAgrees({ proposal, saved, reservation })) throw corrupt();
  if (digest(request) !== row.fingerprint) {
    throw new RegistryFault({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
  }
  return confirmationOutcome(transaction, { request, reservation });
}

/** A stored confirmation request decodes strictly, or the registry is corrupt. */
function decodeSavedRequest(requestJson: string): ConfirmationRequest {
  try {
    return decodeStrict(ConfirmationValidationRequestSchema, JSON.parse(requestJson));
  } catch {
    throw corrupt();
  }
}

/** The saved request's proposal still exists, unchanged, at the reservation's directory. */
function savedProposalAgrees(
  input: Readonly<{
    proposal: Awaited<ReturnType<typeof readProposal>>;
    saved: ConfirmationRequest;
    reservation: Reservation;
  }>,
): boolean {
  const { proposal, saved, reservation } = input;
  if (proposal === undefined) return false;
  return [
    proposal.proposalId === saved.proposalId,
    preparationFingerprint(proposal) === saved.proposalFingerprint,
    samePhysicalIdentity(
      proposal.observation.physical.commonDirectory,
      reservation.proposal.observation.physical.commonDirectory,
    ),
  ].every(Boolean);
}

async function confirmationOutcome(
  transaction: LocalLibsqlTransaction,
  input: Readonly<{ request: ConfirmationRequest; reservation: Reservation }>,
) {
  const { request, reservation } = input;
  const publication = await readPublication(transaction, reservation);
  if (publication === undefined) return incomplete(request);
  if (publication.requestId === request.requestId) return publication;
  return {
    status: "requires-project-selection",
    projectId: publication.projectId,
    requestId: request.requestId,
  } as const;
}

export async function findCommonReservation(
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

/** The published receipt matches its row and the reservation it was published for. */
function receiptRowAgrees(
  input: Readonly<{
    receipt: RegisteredProject;
    row: (typeof publicationRowsSchema.Type)[number];
    reservation: Reservation;
  }>,
): boolean {
  const { receipt, row, reservation } = input;
  return [
    digest(receipt) === row.fingerprint,
    receipt.requestId === row.requestId,
    receipt.projectId === reservation.projectId,
    receipt.repositoryBindingId === reservation.repositoryBindingId,
    receipt.workspaceId === reservation.workspaceId,
    receipt.proposalId === reservation.proposal.proposalId,
  ].every(Boolean);
}

export async function readPublication(
  transaction: LocalLibsqlTransaction,
  reservation: Reservation,
) {
  const result = await transaction.execute({
    sql: "SELECT request_id AS requestId, result_json AS resultJson, result_fingerprint AS fingerprint FROM registration_publications WHERE reservation_id = ?",
    args: [reservation.reservationId],
  });
  try {
    const row = decodeStrict(publicationRowsSchema, registryRows(result))[0];
    if (row === undefined) return undefined;
    const receipt = decodeStrict(RegisteredProjectSchema, JSON.parse(row.resultJson));
    if (!receiptRowAgrees({ receipt, row, reservation })) throw corrupt();
    if (!(await receiptGenerationAgrees(transaction, reservation, receipt))) throw corrupt();
    return receipt;
  } catch {
    throw corrupt();
  }
}

/**
 * The receipt's generation is the activated generation its reservation created, or, after
 * upgrades superseded it, the root source of the Storage's upgrade chain created by the same
 * request, the chain ending at the registration's active generation.
 */
async function receiptGenerationAgrees(
  transaction: LocalLibsqlTransaction,
  reservation: Reservation,
  receipt: RegisteredProject,
): Promise<boolean> {
  const generation = await transaction.execute({
    sql: "SELECT project_id, storage_id, create_request_id FROM storage_generations WHERE generation_id = ? AND activated_at IS NOT NULL",
    args: [receipt.generationId],
  });
  if (generation.rows.length !== 0) {
    return (
      JSON.stringify(generation.rows) ===
      JSON.stringify([[reservation.projectId, receipt.storageId, reservation.createRequestId]])
    );
  }
  const registration = await transaction.execute({
    sql: "SELECT project_id FROM storage_registrations WHERE storage_id = ?",
    args: [receipt.storageId],
  });
  if (JSON.stringify(registration.rows) !== JSON.stringify([[reservation.projectId]])) return false;
  return receiptGenerationResolves(await upgradeChainFor(transaction, receipt.storageId), {
    generationId: receipt.generationId,
    createRequestId: reservation.createRequestId,
  });
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

/** Every confirmation request of a reservation decodes, belongs to it and still reads back. */
async function requireReservationRequests(
  transaction: LocalLibsqlTransaction,
  reservationId: string,
): Promise<void> {
  const requests = await transaction.execute({
    sql: "SELECT request_id AS requestId, reservation_id AS reservationId, request_json AS requestJson FROM registration_requests WHERE reservation_id = ?",
    args: [reservationId],
  });
  const rows = decodeStrictResult(reservationRequestRowsSchema, registryRows(requests));
  if (Result.isFailure(rows)) throw corrupt();
  for (const row of rows.success) await requireReservationRequest(transaction, row, reservationId);
}

async function requireReservationRequest(
  transaction: LocalLibsqlTransaction,
  row: (typeof reservationRequestRowsSchema.Type)[number],
  reservationId: string,
): Promise<void> {
  const request = decodeSavedRequest(row.requestJson);
  const belongs = request.requestId === row.requestId && row.reservationId === reservationId;
  if (!belongs) throw corrupt();
  if ((await readConfirmation(transaction, request)) === undefined) throw corrupt();
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
    await requireReservationRequests(transaction, reservationId);
    const publication = await readPublication(transaction, reservation);
    records.push({ reservation, publication });
  }
  return records;
}
