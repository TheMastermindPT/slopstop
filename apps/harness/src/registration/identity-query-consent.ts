import { decodeStrict, decodeStrictResult, UuidTextSchema } from "@slopstop/protocol";
import { Result, Schema } from "effect";
import {
  GitVersionInspectionResultSchema,
  PreparedGitVersionSchema,
} from "../project-registration-observer.js";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { observeSelectedExecutable } from "../storage/repository-identity-observer.js";
import { readSelection } from "./executable-consent-store.js";
import {
  type ExecutableIdentity,
  type ExecutableIdentityObservation,
  sameExecutableIdentity,
} from "./executable-identity.js";
import { type RegistryRunner, registryRows } from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";

export const IdentityQueryConsentRequestSchema = Schema.Struct({
  selectionId: PreparedGitVersionSchema.fields.selectionId,
  observationId: PreparedGitVersionSchema.fields.observationId,
  consentId: UuidTextSchema.pipe(Schema.brand("IdentityQueryConsentId")),
});
const ConsentDecisionSchema = Schema.Literals(["accepted", "declined"]);
export const IdentityQueryDecisionSchema = Schema.Struct({
  ...IdentityQueryConsentRequestSchema.fields,
  decision: ConsentDecisionSchema,
});
export type IdentityQueryConsentRequest = typeof IdentityQueryConsentRequestSchema.Type;
type IdentityQueryDecision = typeof IdentityQueryDecisionSchema.Type;
const versionRowsSchema = Schema.Array(Schema.Struct({ resultJson: Schema.String })).check(
  Schema.isMaxLength(1),
);
const decisionRowsSchema = Schema.Array(IdentityQueryDecisionSchema).check(Schema.isMaxLength(1));
const decisionCellSchema = Schema.Tuple([Schema.Tuple([ConsentDecisionSchema])]);
type ConsentFailure =
  | ReturnType<typeof registryFailure>
  | Exclude<ExecutableIdentityObservation, { status: "observed" }>
  | Readonly<{ status: "unavailable"; code: "GIT_CONFIRMATION_REQUIRED" }>;

export interface IdentityQueryConsentAuthority {
  decideIdentityQueries(
    request: IdentityQueryDecision,
  ): Promise<Readonly<{ status: "recorded" }> | ConsentFailure>;
  resolveIdentityQueries(request: IdentityQueryConsentRequest): Promise<
    | Readonly<{ status: "cancelled" }>
    | ConsentFailure
    | Readonly<{
        status: "authorized";
        executablePath: string;
        executableIdentity: ExecutableIdentity;
        version: string;
      }>
  >;
}

const unconfirmed = { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" } as const;

async function readValidatedVersion(
  transaction: LocalLibsqlTransaction,
  request: IdentityQueryConsentRequest,
) {
  const result = await transaction.execute({
    sql: "SELECT o.result_json AS resultJson FROM registration_observer_intents i JOIN registration_observer_outcomes o ON o.observation_id = i.observation_id WHERE i.observation_id = ? AND i.selection_id = ?",
    args: [request.observationId, request.selectionId],
  });
  const row = decodeStrict(versionRowsSchema, registryRows(result))[0];
  if (row === undefined) return undefined;
  const parsed = decodeStrictResult(GitVersionInspectionResultSchema, JSON.parse(row.resultJson));
  if (Result.isFailure(parsed)) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  const version = parsed.success;
  if (version.status !== "prepared") return undefined;
  if (
    version.observationId !== request.observationId ||
    version.selectionId !== request.selectionId
  ) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  return version;
}

async function recordDecision(transaction: LocalLibsqlTransaction, request: IdentityQueryDecision) {
  const rows = await transaction.execute({
    sql: "SELECT consent_id AS consentId, selection_id AS selectionId, observation_id AS observationId, decision FROM registration_identity_consents WHERE consent_id = ?",
    args: [request.consentId],
  });
  const existing = decodeStrict(decisionRowsSchema, registryRows(rows))[0];
  if (existing !== undefined) {
    if (!sameDecision(existing, request)) {
      throw new RegistryFault({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
    }
    return { status: "recorded" as const };
  }
  if ((await readValidatedVersion(transaction, request)) === undefined) return unconfirmed;
  await transaction.execute({
    sql: "INSERT INTO registration_identity_consents (consent_id, selection_id, observation_id, decision, decided_at) VALUES (?, ?, ?, ?, ?)",
    args: [
      request.consentId,
      request.selectionId,
      request.observationId,
      request.decision,
      new Date().toISOString(),
    ],
  });
  return { status: "recorded" as const };
}

function sameDecision(left: IdentityQueryDecision, right: IdentityQueryDecision) {
  return (
    left.selectionId === right.selectionId &&
    left.observationId === right.observationId &&
    left.decision === right.decision
  );
}

export async function resolveIdentityQueryConsent(
  transaction: LocalLibsqlTransaction,
  request: IdentityQueryConsentRequest,
) {
  const rows = await transaction.execute({
    sql: "SELECT decision FROM registration_identity_consents WHERE consent_id = ? AND selection_id = ? AND observation_id = ?",
    args: [request.consentId, request.selectionId, request.observationId],
  });
  if (rows.rows.length === 0) return unconfirmed;
  const decision = decodeStrict(decisionCellSchema, rows.rows)[0][0];
  if (decision === "declined") return { status: "cancelled" as const };
  const version = await readValidatedVersion(transaction, request);
  const selection = await readSelection(transaction, request.selectionId);
  if (version === undefined || selection === undefined) return unconfirmed;
  const current = await observeSelectedExecutable(selection.executablePath);
  if (current.status !== "observed") return current;
  if (!sameExecutableIdentity(current.identity, selection.executableIdentity)) return unconfirmed;
  return {
    status: "authorized" as const,
    executablePath: selection.executablePath,
    executableIdentity: selection.executableIdentity,
    version: version.version,
  };
}

export function createIdentityQueryConsentAuthority(
  run: RegistryRunner,
): IdentityQueryConsentAuthority {
  const write = <Result>(operation: (transaction: LocalLibsqlTransaction) => Promise<Result>) =>
    run((client) => withWriteTransaction(client, operation));
  return {
    decideIdentityQueries: (input) =>
      write((transaction) =>
        recordDecision(transaction, decodeStrict(IdentityQueryDecisionSchema, input)),
      ).catch(registryFailure),
    resolveIdentityQueries: (input) =>
      write((transaction) =>
        resolveIdentityQueryConsent(
          transaction,
          decodeStrict(IdentityQueryConsentRequestSchema, input),
        ),
      ).catch(registryFailure),
  };
}
