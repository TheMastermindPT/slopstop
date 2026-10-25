import { createHash } from "node:crypto";
import { decodeStrict } from "@slopstop/protocol";
import { expect, it } from "vitest";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { findCommonReservation, readPublication } from "./registration-confirmation-store.js";
import { RegistrationProposalRecordSchema } from "./registration-proposal-store.js";
import { registryFailure } from "./registry-failure.js";

const strictId = (suffix: number) =>
  `018f47a3-4e3d-7d2b-9c41-7df4605c0${String(suffix).padStart(3, "0")}`;
const nil = "00000000-0000-0000-0000-000000000000";
const upper = (value: string) => value.toUpperCase();
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const reservation = {
  reservationId: id(1),
  projectId: id(2),
  repositoryBindingId: id(3),
  workspaceId: id(4),
  createRequestId: id(5),
  proposal: { proposalId: id(6) },
};
// Fields in schema order: the stored fingerprint is the digest of the decoded receipt.
const receipt = {
  status: "registered",
  requestId: id(7),
  proposalId: reservation.proposal.proposalId,
  projectId: reservation.projectId,
  repositoryBindingId: reservation.repositoryBindingId,
  workspaceId: reservation.workspaceId,
  storageId: id(8),
  generationId: id(9),
};
const agreeingGeneration = [reservation.projectId, receipt.storageId, reservation.createRequestId];

type GenerationAnswer = Readonly<{ rows: (string | null)[][] }> | Readonly<{ error: unknown }>;

/** Answers the publication row, then the given answer for the receipt's generation. */
function publicationTransaction(
  input: Readonly<{ resultJson: string; generation: GenerationAnswer; rowRequestId?: string }>,
): Pick<LocalLibsqlTransaction, "execute"> & { generationReads: () => number } {
  const fingerprint = createHash("sha256").update(input.resultJson).digest("hex");
  let generationReads = 0;
  return {
    generationReads: () => generationReads,
    execute: async (statement) => {
      const sql = typeof statement === "string" ? statement : statement.sql;
      if (sql.includes("FROM registration_publications")) {
        return {
          columns: ["requestId", "resultJson", "fingerprint"],
          rows: [[input.rowRequestId ?? receipt.requestId, input.resultJson, fingerprint]],
          rowsAffected: 0,
          lastInsertRowid: null,
        };
      }
      if (!sql.includes("FROM storage_generations")) throw new Error(`Unexpected SQL: ${sql}`);
      generationReads += 1;
      if ("error" in input.generation) throw input.generation.error;
      return { columns: [], rows: input.generation.rows, rowsAffected: 0, lastInsertRowid: null };
    },
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  const outcome = await promise.then(
    () => ({ rejected: false as const }),
    (error: unknown) => ({ rejected: true as const, error }),
  );
  if (!outcome.rejected) throw new Error("The read did not reject.");
  return outcome.error;
}

const receiptJson = JSON.stringify(receipt);

it.each([
  {
    name: "busy generation read",
    resultJson: receiptJson,
    generation: { error: Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" }) },
    failure: { status: "unavailable", code: "REGISTRY_BUSY" },
    generationReads: 1,
  },
  {
    name: "failed generation read",
    resultJson: receiptJson,
    generation: { error: new Error("I/O") },
    failure: { status: "broken", code: "INTERNAL_FAILURE" },
    generationReads: 1,
  },
  {
    name: "generation of another project",
    resultJson: receiptJson,
    generation: { rows: [[id(99), receipt.storageId, reservation.createRequestId]] },
    failure: { status: "broken", code: "REGISTRY_CORRUPT" },
    generationReads: 1,
  },
  {
    name: "receipt that does not decode",
    resultJson: JSON.stringify({ ...receipt, status: "unknown" }),
    generation: { rows: [agreeingGeneration] },
    failure: { status: "broken", code: "REGISTRY_CORRUPT" },
    generationReads: 0,
  },
  {
    name: "receipt storageId uppercase",
    resultJson: JSON.stringify({ ...receipt, storageId: upper(strictId(20)) }),
    generation: { rows: [agreeingGeneration] },
    failure: { status: "broken", code: "REGISTRY_CORRUPT" },
    generationReads: 0,
  },
  {
    name: "receipt generationId nil",
    resultJson: JSON.stringify({ ...receipt, generationId: nil }),
    generation: { rows: [agreeingGeneration] },
    failure: { status: "broken", code: "REGISTRY_CORRUPT" },
    generationReads: 0,
  },
  {
    name: "publication row requestId uppercase",
    resultJson: JSON.stringify({ ...receipt, requestId: strictId(21) }),
    rowRequestId: upper(strictId(21)),
    generation: { rows: [agreeingGeneration] },
    failure: { status: "broken", code: "REGISTRY_CORRUPT" },
    generationReads: 0,
  },
])("classifies a receipt check failure: $name", async (row) => {
  const transaction = publicationTransaction(row);
  const rejection = await rejectionOf(readPublication(transaction, reservation));
  expect(registryFailure(rejection)).toEqual(row.failure);
  // The receipt and its row agreed, so only the generation answer decided the outcome.
  expect(transaction.generationReads()).toBe(row.generationReads);
});

const directoryKey = (fileIdentity: string) => ({
  platform: "win32",
  volumeIdentity: "1",
  fileIdentity,
  birthIdentity: "1",
  version: "physical-directory/v1",
});
// Fields in schema order: the stored fingerprint is the digest of the decoded record.
const storedReservation = {
  version: 1,
  reservationId: strictId(1),
  projectId: strictId(2),
  repositoryBindingId: strictId(3),
  workspaceId: strictId(4),
  createRequestId: strictId(5),
  createdAt: "2026-10-24T12:00:00.000Z",
  proposal: {
    request: {
      version: 1,
      requestId: strictId(6),
      admission: {
        selectionId: strictId(7),
        observationId: strictId(8),
        consentId: strictId(9),
        repositorySelectionId: strictId(10),
        trustId: strictId(11),
      },
    },
    proposalId: strictId(12),
    preparedAt: "2026-10-24T12:00:00.000Z",
    authority: {
      repositoryDirectory: "C:/repo",
      repositoryIdentity: directoryKey("2"),
      executable: {
        status: "authorized",
        executablePath: "C:/git/git.exe",
        executableIdentity: {
          platform: "win32",
          volumeIdentity: "1",
          fileIdentity: "9",
          birthIdentity: "1",
          sha256: "a".repeat(64),
        },
        version: "2.47.0",
      },
    },
    observation: {
      status: "physically-observed",
      phaseId: strictId(13),
      booleans: { insideWorkTree: true, bareRepository: false, insideGitDirectory: false },
      paths: { worktree: "C:/repo", gitDirectory: "C:/repo/.git", commonDirectory: "C:/repo/.git" },
      physical: {
        worktree: directoryKey("2"),
        gitDirectory: directoryKey("3"),
        commonDirectory: directoryKey("3"),
      },
    },
  },
  confirmationPhaseId: strictId(14),
};
type StoredReservation = typeof storedReservation;
const proposal = decodeStrict(RegistrationProposalRecordSchema, storedReservation.proposal);

/** Answers the common-directory lookup with the record's id, then the agreeing reservation row. */
function reservationTransaction(
  record: StoredReservation,
): Pick<LocalLibsqlTransaction, "execute"> {
  const recordJson = JSON.stringify(record);
  const fingerprint = createHash("sha256").update(recordJson).digest("hex");
  const common = record.proposal.observation.physical.commonDirectory;
  return {
    execute: async (statement) => {
      const sql = typeof statement === "string" ? statement : statement.sql;
      if (sql.includes("WHERE common_platform")) {
        return {
          columns: ["reservationId"],
          rows: [[record.reservationId]],
          rowsAffected: 0,
          lastInsertRowid: null,
        };
      }
      if (!sql.includes("WHERE reservation_id")) throw new Error(`Unexpected SQL: ${sql}`);
      return {
        columns: [
          "platform",
          "volumeIdentity",
          "fileIdentity",
          "birthIdentity",
          "recordJson",
          "fingerprint",
        ],
        rows: [
          [
            common.platform,
            common.volumeIdentity,
            common.fileIdentity,
            common.birthIdentity,
            recordJson,
            fingerprint,
          ],
        ],
        rowsAffected: 0,
        lastInsertRowid: null,
      };
    },
  };
}

it("reads a stored reservation whose identities are strict", async () => {
  const transaction = reservationTransaction(storedReservation);
  await expect(findCommonReservation(transaction, proposal)).resolves.toEqual(storedReservation);
});

it.each([
  // The row's reservation_id and the record's reservationId must agree, so both change together.
  ["reservationId uppercase", { reservationId: upper(storedReservation.reservationId) }],
  [
    "repositoryBindingId uppercase",
    { repositoryBindingId: upper(storedReservation.repositoryBindingId) },
  ],
  ["workspaceId uppercase", { workspaceId: upper(storedReservation.workspaceId) }],
  ["createRequestId uppercase", { createRequestId: upper(storedReservation.createRequestId) }],
  [
    "confirmationPhaseId uppercase",
    { confirmationPhaseId: upper(storedReservation.confirmationPhaseId) },
  ],
  ["createRequestId nil", { createRequestId: nil }],
] as const)(
  "classifies a stored reservation with a non-strict identity as corrupt (%s)",
  async (_name, change) => {
    const transaction = reservationTransaction({ ...storedReservation, ...change });
    const rejection = await rejectionOf(findCommonReservation(transaction, proposal));
    expect(registryFailure(rejection)).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
  },
);
