import { createHash } from "node:crypto";
import { z } from "zod";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { ExecutableIdentitySchema } from "./executable-identity.js";
import {
  PhysicalDirectoryKeySchema,
  RepositoryPhysicalSnapshotSchema,
} from "./physical-identity.js";
import { registryRows } from "./registry-database.js";
import { RegistryFault } from "./registry-failure.js";
import { RepositoryIdentityAdmissionRequestSchema } from "./repository-trust.js";

export const PrepareProjectRegistrationSchema = z.strictObject({
  version: z.literal(1),
  requestId: z.uuid().brand<"RegistrationPreparationRequestId">(),
  admission: RepositoryIdentityAdmissionRequestSchema,
});
export type PrepareProjectRegistration = z.infer<typeof PrepareProjectRegistrationSchema>;

const pathSchema = z
  .string()
  .min(1)
  .regex(/^[^\r\n\0]+$/);
export const RegistrationProposalRecordSchema = z.strictObject({
  request: PrepareProjectRegistrationSchema,
  proposalId: z.uuid().brand<"RegistrationProposalId">(),
  preparedAt: z.iso.datetime(),
  authority: z.strictObject({
    repositoryDirectory: pathSchema,
    repositoryIdentity: PhysicalDirectoryKeySchema,
    executable: z.strictObject({
      status: z.literal("authorized"),
      executablePath: pathSchema,
      executableIdentity: ExecutableIdentitySchema,
      version: z.string().min(1),
    }),
  }),
  observation: z.strictObject({
    status: z.literal("physically-observed"),
    phaseId: z.uuid(),
    booleans: z.strictObject({
      insideWorkTree: z.literal(true),
      bareRepository: z.literal(false),
      insideGitDirectory: z.literal(false),
    }),
    paths: z.strictObject({
      worktree: pathSchema,
      gitDirectory: pathSchema,
      commonDirectory: pathSchema,
    }),
    physical: RepositoryPhysicalSnapshotSchema.shape.physical,
  }),
});
export type RegistrationProposalRecord = z.infer<typeof RegistrationProposalRecordSchema>;

export function preparationFingerprint(
  value: PrepareProjectRegistration | RegistrationProposalRecord,
) {
  // Versioned, schema-ordered fields; never hash caller object order or mutable caller objects.
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function preparedResult(record: RegistrationProposalRecord) {
  return {
    status: "prepared" as const,
    requestId: record.request.requestId,
    proposalId: record.proposalId,
    inputFingerprint: preparationFingerprint(record.request),
    proposalFingerprint: preparationFingerprint(record),
    preparedAt: record.preparedAt,
    requiresFreshValidation: true as const,
  };
}

export async function readProposal(
  transaction: LocalLibsqlTransaction,
  request: PrepareProjectRegistration,
) {
  const result = await transaction.execute({
    sql: "SELECT proposal_id AS proposalId, input_fingerprint AS inputFingerprint, proposal_fingerprint AS proposalFingerprint, record_json AS recordJson FROM registration_proposals WHERE request_id = ?",
    args: [request.requestId],
  });
  const rows = z
    .strictObject({
      proposalId: z.uuid(),
      inputFingerprint: z.string(),
      proposalFingerprint: z.string(),
      recordJson: z.string(),
    })
    .array()
    .max(1)
    .safeParse(registryRows(result));
  if (!rows.success) throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  const row = rows.data[0];
  if (row === undefined) return undefined;
  let record: RegistrationProposalRecord;
  try {
    record = RegistrationProposalRecordSchema.parse(JSON.parse(row.recordJson));
  } catch {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  if (
    record.request.requestId !== request.requestId ||
    record.proposalId !== row.proposalId ||
    preparationFingerprint(record.request) !== row.inputFingerprint ||
    preparationFingerprint(record) !== row.proposalFingerprint
  ) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  if (preparationFingerprint(record.request) !== preparationFingerprint(request)) {
    throw new RegistryFault({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
  }
  return record;
}

export async function insertProposal(
  transaction: LocalLibsqlTransaction,
  record: RegistrationProposalRecord,
) {
  const result = preparedResult(record);
  await transaction.execute({
    sql: "INSERT INTO registration_proposals (request_id, proposal_id, input_fingerprint, proposal_fingerprint, record_json) VALUES (?, ?, ?, ?, ?)",
    args: [
      result.requestId,
      result.proposalId,
      result.inputFingerprint,
      result.proposalFingerprint,
      JSON.stringify(record),
    ],
  });
  return result;
}
