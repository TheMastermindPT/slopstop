import { randomUUID } from "node:crypto";
import { decodeStrict, decodeStrictResult, UuidTextSchema } from "@slopstop/protocol";
import { Result, Schema } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { observeRepositoryDirectory } from "../storage/repository-identity-observer.js";
import {
  type IdentityQueryConsentAuthority,
  IdentityQueryConsentRequestSchema,
  resolveIdentityQueryConsent,
} from "./identity-query-consent.js";
import { hasUnsettled } from "./observer-journal.js";
import {
  PhysicalDirectoryKeySchema,
  type PhysicalIdentity,
  type RepositoryDirectoryObservation,
  samePhysicalIdentity,
} from "./physical-identity.js";
import {
  type PreparedRegistryRunner,
  type RegistryRunner,
  registryRows,
} from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";

const RepositorySelectionIdSchema = UuidTextSchema.pipe(Schema.brand("RepositorySelectionId"));
export const RepositoryTrustRequestSchema = Schema.Struct({
  repositorySelectionId: RepositorySelectionIdSchema,
  trustId: UuidTextSchema.pipe(Schema.brand("RepositoryTrustId")),
});
const TrustDecisionValueSchema = Schema.Literals(["accepted", "declined"]);
export const RepositoryTrustDecisionSchema = Schema.Struct({
  ...RepositoryTrustRequestSchema.fields,
  decision: TrustDecisionValueSchema,
});
export const RepositoryIdentityAdmissionRequestSchema = Schema.Struct({
  ...IdentityQueryConsentRequestSchema.fields,
  ...RepositoryTrustRequestSchema.fields,
});
type TrustDecision = typeof RepositoryTrustDecisionSchema.Type;
type AdmissionRequest = typeof RepositoryIdentityAdmissionRequestSchema.Type;
const trustDecisionRowsSchema = Schema.Array(RepositoryTrustDecisionSchema).check(
  Schema.isMaxLength(1),
);
const trustDecisionCellSchema = Schema.Tuple([Schema.Tuple([TrustDecisionValueSchema])]);
type ExecutableAuthority = Awaited<
  ReturnType<IdentityQueryConsentAuthority["resolveIdentityQueries"]>
>;
type Failure =
  | ReturnType<typeof registryFailure>
  | Exclude<RepositoryDirectoryObservation, { status: "observed" }>
  | Readonly<{ status: "unavailable"; code: "REPOSITORY_TRUST_REQUIRED" }>;

// Installed by the application owner, never populated from a renderer path/boolean.
export interface NativeRepositorySelectionPort {
  select(): Promise<
    Readonly<{ status: "selected"; directory: string }> | Readonly<{ status: "cancelled" }>
  >;
}

export interface RepositoryTrustOwner {
  selectRepository(): Promise<
    | Readonly<{
        status: "prepared";
        repositorySelectionId: typeof RepositorySelectionIdSchema.Type;
      }>
    | Readonly<{ status: "cancelled" }>
    | Failure
  >;
  decideRepositoryTrust(
    request: TrustDecision,
  ): Promise<Readonly<{ status: "recorded" }> | Failure>;
  admitRepositoryIdentityQueries(
    request: AdmissionRequest,
    port: IdentityQueryAdmissionPort,
  ): Promise<
    | Readonly<{ status: "admitted" }>
    | Failure
    | Exclude<ExecutableAuthority, { status: "authorized" }>
  >;
}

// Admission evidence only; this port is not a completed six-query observation.
// A real executor must retain per-child identity checks and durable lifecycle ownership.
export interface IdentityQueryAdmissionPort {
  admit(
    input: Readonly<{
      repositoryDirectory: string;
      repositoryIdentity: PhysicalIdentity;
      executable: Extract<ExecutableAuthority, { status: "authorized" }>;
    }>,
  ): Promise<void>;
}

const trustRequired = { status: "unavailable", code: "REPOSITORY_TRUST_REQUIRED" } as const;
const selectionRowsSchema = Schema.Array(
  Schema.Struct({ directory: Schema.String, identityJson: Schema.String }),
).check(Schema.isMaxLength(1));

async function readRepositorySelection(transaction: LocalLibsqlTransaction, selectionId: string) {
  const rows = await transaction.execute({
    sql: "SELECT directory_path AS directory, identity_json AS identityJson FROM registration_repository_selections WHERE selection_id = ?",
    args: [selectionId],
  });
  const row = decodeStrict(selectionRowsSchema, registryRows(rows))[0];
  if (row === undefined) return undefined;
  const identity = decodeStrictResult(PhysicalDirectoryKeySchema, JSON.parse(row.identityJson));
  if (Result.isFailure(identity)) {
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  }
  return {
    directory: row.directory,
    identity: identity.success,
  };
}

async function chooseRepository(selection: NativeRepositorySelectionPort | undefined) {
  if (selection === undefined) {
    return { status: "unavailable" as const, code: "IDENTITY_CAPABILITY_UNAVAILABLE" as const };
  }
  return selection.select();
}

async function persistRepositorySelection(transaction: LocalLibsqlTransaction, directory: string) {
  const observed = await observeRepositoryDirectory(directory);
  if (observed.status !== "observed") return observed;
  const repositorySelectionId = decodeStrict(RepositorySelectionIdSchema, randomUUID());
  await transaction.execute({
    sql: "INSERT INTO registration_repository_selections (selection_id, directory_path, identity_json, captured_at) VALUES (?, ?, ?, ?)",
    args: [
      repositorySelectionId,
      directory,
      JSON.stringify(observed.key),
      new Date().toISOString(),
    ],
  });
  return { status: "prepared" as const, repositorySelectionId };
}

async function decideTrust(transaction: LocalLibsqlTransaction, request: TrustDecision) {
  const rows = await transaction.execute({
    sql: "SELECT trust_id AS trustId, selection_id AS repositorySelectionId, decision FROM registration_repository_trust WHERE trust_id = ?",
    args: [request.trustId],
  });
  const previous = decodeStrict(trustDecisionRowsSchema, registryRows(rows))[0];
  if (previous !== undefined) {
    if (
      previous.repositorySelectionId !== request.repositorySelectionId ||
      previous.decision !== request.decision
    ) {
      throw new RegistryFault({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" });
    }
    return { status: "recorded" as const };
  }
  if ((await readRepositorySelection(transaction, request.repositorySelectionId)) === undefined) {
    return trustRequired;
  }
  await transaction.execute({
    sql: "INSERT INTO registration_repository_trust (trust_id, selection_id, decision, decided_at) VALUES (?, ?, ?, ?)",
    args: [
      request.trustId,
      request.repositorySelectionId,
      request.decision,
      new Date().toISOString(),
    ],
  });
  return { status: "recorded" as const };
}

export async function authorizeQueries(
  transaction: LocalLibsqlTransaction,
  request: AdmissionRequest,
) {
  if (await hasUnsettled(transaction)) {
    return { status: "pending-recovery" as const, code: "OBSERVER_CLEANUP_UNCONFIRMED" as const };
  }
  const executable = await resolveIdentityQueryConsent(transaction, request);
  if (executable.status !== "authorized") return executable;
  const rows = await transaction.execute({
    sql: "SELECT decision FROM registration_repository_trust WHERE trust_id = ? AND selection_id = ?",
    args: [request.trustId, request.repositorySelectionId],
  });
  if (rows.rows.length === 0) return trustRequired;
  const decision = decodeStrict(trustDecisionCellSchema, rows.rows)[0][0];
  if (decision === "declined") return { status: "cancelled" as const };
  const selection = await readRepositorySelection(transaction, request.repositorySelectionId);
  if (selection === undefined) return trustRequired;
  const observed = await observeRepositoryDirectory(selection.directory);
  if (observed.status !== "observed") return observed;
  if (!samePhysicalIdentity(observed.key, selection.identity)) return trustRequired;
  return {
    status: "authorized" as const,
    repositoryDirectory: selection.directory,
    repositoryIdentity: selection.identity,
    executable,
  };
}

export function createRepositoryTrustOwner(
  run: RegistryRunner,
  prepareAndRun: PreparedRegistryRunner,
  selection?: NativeRepositorySelectionPort,
): RepositoryTrustOwner {
  const write = <Result>(operation: (transaction: LocalLibsqlTransaction) => Promise<Result>) =>
    run((client) => withWriteTransaction(client, operation));
  return {
    selectRepository: () =>
      prepareAndRun(
        () => chooseRepository(selection),
        async (chosen, reopen) => {
          if (chosen.status !== "selected") return chosen;
          return reopen((client) =>
            withWriteTransaction(client, (transaction) =>
              persistRepositorySelection(transaction, chosen.directory),
            ),
          );
        },
      ).catch(registryFailure),
    decideRepositoryTrust: (input) =>
      write((transaction) =>
        decideTrust(transaction, decodeStrict(RepositoryTrustDecisionSchema, input)),
      ).catch(registryFailure),
    admitRepositoryIdentityQueries: (input, port) =>
      run(async (client) => {
        const authority = await withWriteTransaction(client, (transaction) =>
          authorizeQueries(
            transaction,
            decodeStrict(RepositoryIdentityAdmissionRequestSchema, input),
          ),
        );
        if (authority.status !== "authorized") return authority;
        await port.admit({
          repositoryDirectory: authority.repositoryDirectory,
          repositoryIdentity: authority.repositoryIdentity,
          executable: authority.executable,
        });
        return { status: "admitted" as const };
      }).catch(registryFailure),
  };
}
