import { createHash } from "node:crypto";
import {
  dateTimeTextSchema,
  decodeStrict,
  decodeStrictResult,
  NonEmptyTextSchema,
  UuidTextSchema,
} from "@slopstop/protocol";
import { Result, Schema } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { ExecutableIdentitySchema } from "./executable-identity.js";
import {
  PhysicalDirectoryKeySchema,
  RepositoryPhysicalSnapshotSchema,
} from "./physical-identity.js";
import { registryRows } from "./registry-database.js";
import { RegistryFault } from "./registry-failure.js";
import { RepositoryIdentityAdmissionRequestSchema } from "./repository-trust.js";

export const PrepareProjectRegistrationSchema = Schema.Struct({
  version: Schema.Literal(1),
  requestId: UuidTextSchema.pipe(Schema.brand("RegistrationPreparationRequestId")),
  admission: RepositoryIdentityAdmissionRequestSchema,
});
export type PrepareProjectRegistration = typeof PrepareProjectRegistrationSchema.Type;

const pathSchema = NonEmptyTextSchema.check(Schema.isPattern(/^[^\r\n\0]+$/));
export const RegistrationProposalRecordSchema = Schema.Struct({
  request: PrepareProjectRegistrationSchema,
  proposalId: UuidTextSchema.pipe(Schema.brand("RegistrationProposalId")),
  preparedAt: dateTimeTextSchema(),
  authority: Schema.Struct({
    repositoryDirectory: pathSchema,
    repositoryIdentity: PhysicalDirectoryKeySchema,
    executable: Schema.Struct({
      status: Schema.Literal("authorized"),
      executablePath: pathSchema,
      executableIdentity: ExecutableIdentitySchema,
      version: NonEmptyTextSchema,
    }),
  }),
  observation: Schema.Struct({
    status: Schema.Literal("physically-observed"),
    phaseId: UuidTextSchema,
    booleans: Schema.Struct({
      insideWorkTree: Schema.Literal(true),
      bareRepository: Schema.Literal(false),
      insideGitDirectory: Schema.Literal(false),
    }),
    paths: Schema.Struct({
      worktree: pathSchema,
      gitDirectory: pathSchema,
      commonDirectory: pathSchema,
    }),
    physical: RepositoryPhysicalSnapshotSchema.fields.physical,
  }),
});
export type RegistrationProposalRecord = typeof RegistrationProposalRecordSchema.Type;
const proposalRowsSchema = Schema.Array(
  Schema.Struct({
    proposalId: UuidTextSchema,
    inputFingerprint: Schema.String,
    proposalFingerprint: Schema.String,
    recordJson: Schema.String,
  }),
).check(Schema.isMaxLength(1));

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
  const rows = decodeStrictResult(proposalRowsSchema, registryRows(result));
  if (Result.isFailure(rows)) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  const row = rows.success[0];
  if (row === undefined) return undefined;
  let record: RegistrationProposalRecord;
  try {
    record = decodeStrict(RegistrationProposalRecordSchema, JSON.parse(row.recordJson));
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
