import { createHash, randomUUID } from "node:crypto";
import {
  ProjectIdSchema,
  type RegisteredProject,
  RegisteredProjectSchema,
} from "@slopstop/protocol";
import { z } from "zod";
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

export const ConfirmationValidationRequestSchema = z.strictObject({
  version: z.literal(1),
  requestId: z.uuid().brand<"RegistrationRequestId">(),
  preparation: PrepareProjectRegistrationSchema,
  proposalId: RegistrationProposalRecordSchema.shape.proposalId,
  proposalFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ConfirmationRequest = z.infer<typeof ConfirmationValidationRequestSchema>;

const reservationSchema = z.strictObject({
  version: z.literal(1),
  reservationId: z.uuid().brand<"RegistrationReservationId">(),
  projectId: ProjectIdSchema,
  repositoryBindingId: z.uuid().brand<"RepositoryBindingId">(),
  workspaceId: z.uuid().brand<"WorkspaceId">(),
  createRequestId: z.uuid().brand<"ProjectStorageCreateRequestId">(),
  createdAt: z.iso.datetime(),
  proposal: RegistrationProposalRecordSchema,
  confirmationPhaseId: z.uuid(),
});
export type Reservation = z.infer<typeof reservationSchema>;
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
    const row = z
      .tuple([
        PhysicalDirectoryKeySchema.omit({ version: true }).extend({
          recordJson: z.string(),
          fingerprint: z.string(),
        }),
      ])
      .parse(registryRows(result))[0];
    const record = reservationSchema.parse(JSON.parse(row.recordJson));
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
  const parsed = z
    .strictObject({ fingerprint: z.string(), requestJson: z.string(), reservationId: z.uuid() })
    .array()
    .max(1)
    .safeParse(registryRows(result));
  if (!parsed.success) throw corrupt();
  const row = parsed.data[0];
  if (row === undefined) return undefined;
  let saved: ConfirmationRequest;
  try {
    saved = ConfirmationValidationRequestSchema.parse(JSON.parse(row.requestJson));
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
  const rows = z
    .strictObject({ reservationId: z.uuid() })
    .array()
    .max(1)
    .safeParse(registryRows(result));
  if (!rows.success) throw corrupt();
  return rows.data[0] === undefined
    ? undefined
    : readReservation(transaction, rows.data[0].reservationId);
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
    reservation = reservationSchema.parse({
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
    const row = z
      .strictObject({ requestId: z.uuid(), resultJson: z.string(), fingerprint: z.string() })
      .array()
      .max(1)
      .parse(registryRows(result))[0];
    if (row === undefined) return undefined;
    const receipt = RegisteredProjectSchema.parse(JSON.parse(row.resultJson));
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
  const result = RegisteredProjectSchema.parse(input);
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
  const ids = z
    .strictObject({ reservationId: z.uuid() })
    .array()
    .safeParse(
      registryRows(
        await transaction.execute(
          "SELECT reservation_id AS reservationId FROM registration_reservations ORDER BY reservation_id",
        ),
      ),
    );
  if (!ids.success) throw corrupt();
  const records = [];
  const projects = new Set<string>();
  for (const { reservationId } of ids.data) {
    const reservation = await readReservation(transaction, reservationId);
    if (projects.has(reservation.projectId)) throw corrupt();
    projects.add(reservation.projectId);
    const requests = await transaction.execute({
      sql: "SELECT request_id AS requestId, reservation_id AS reservationId, request_json AS requestJson FROM registration_requests WHERE reservation_id = ?",
      args: [reservationId],
    });
    const rows = z
      .strictObject({
        requestId: ConfirmationValidationRequestSchema.shape.requestId,
        reservationId: reservationSchema.shape.reservationId,
        requestJson: z.string(),
      })
      .array()
      .min(1)
      .safeParse(registryRows(requests));
    if (!rows.success) throw corrupt();
    for (const row of rows.data) {
      let request: ConfirmationRequest;
      try {
        request = ConfirmationValidationRequestSchema.parse(JSON.parse(row.requestJson));
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
