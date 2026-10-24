import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { readPublication } from "./registration-confirmation-store.js";
import { registryFailure } from "./registry-failure.js";

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
  input: Readonly<{ resultJson: string; generation: GenerationAnswer }>,
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
          rows: [[receipt.requestId, input.resultJson, fingerprint]],
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
  if (!outcome.rejected) throw new Error("The receipt check did not reject.");
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
])("classifies a receipt check failure: $name", async (row) => {
  const transaction = publicationTransaction(row);
  const rejection = await rejectionOf(readPublication(transaction, reservation));
  expect(registryFailure(rejection)).toEqual(row.failure);
  // The receipt and its row agreed, so only the generation answer decided the outcome.
  expect(transaction.generationReads()).toBe(row.generationReads);
});
