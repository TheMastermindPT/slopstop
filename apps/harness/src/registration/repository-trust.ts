import { randomUUID } from "node:crypto";
import { z } from "zod";
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

const RepositorySelectionIdSchema = z.uuid().brand<"RepositorySelectionId">();
export const RepositoryTrustRequestSchema = z.strictObject({
  repositorySelectionId: RepositorySelectionIdSchema,
  trustId: z.uuid().brand<"RepositoryTrustId">(),
});
export const RepositoryTrustDecisionSchema = RepositoryTrustRequestSchema.extend({
  decision: z.enum(["accepted", "declined"]),
});
export const RepositoryIdentityAdmissionRequestSchema = IdentityQueryConsentRequestSchema.extend(
  RepositoryTrustRequestSchema.shape,
);
type TrustDecision = z.infer<typeof RepositoryTrustDecisionSchema>;
type AdmissionRequest = z.infer<typeof RepositoryIdentityAdmissionRequestSchema>;
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
        repositorySelectionId: z.infer<typeof RepositorySelectionIdSchema>;
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
const selectionSchema = z.strictObject({ directory: z.string(), identityJson: z.string() });

async function readRepositorySelection(transaction: LocalLibsqlTransaction, selectionId: string) {
  const rows = await transaction.execute({
    sql: "SELECT directory_path AS directory, identity_json AS identityJson FROM registration_repository_selections WHERE selection_id = ?",
    args: [selectionId],
  });
  const row = selectionSchema.array().max(1).parse(registryRows(rows))[0];
  if (row === undefined) return undefined;
  const identity = PhysicalDirectoryKeySchema.safeParse(JSON.parse(row.identityJson));
  if (!identity.success) throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  return {
    directory: row.directory,
    identity: identity.data,
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
  const repositorySelectionId = RepositorySelectionIdSchema.parse(randomUUID());
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
  const previous = RepositoryTrustDecisionSchema.array().max(1).parse(registryRows(rows))[0];
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

async function admitQueries(
  transaction: LocalLibsqlTransaction,
  request: AdmissionRequest,
  port: IdentityQueryAdmissionPort,
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
  const decision = z
    .tuple([z.tuple([RepositoryTrustDecisionSchema.shape.decision])])
    .parse(rows.rows)[0][0];
  if (decision === "declined") return { status: "cancelled" as const };
  const selection = await readRepositorySelection(transaction, request.repositorySelectionId);
  if (selection === undefined) return trustRequired;
  const observed = await observeRepositoryDirectory(selection.directory);
  if (observed.status !== "observed") return observed;
  if (!samePhysicalIdentity(observed.key, selection.identity)) return trustRequired;
  await port.admit({
    repositoryDirectory: selection.directory,
    repositoryIdentity: selection.identity,
    executable,
  });
  return { status: "admitted" as const };
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
        decideTrust(transaction, RepositoryTrustDecisionSchema.parse(input)),
      ).catch(registryFailure),
    admitRepositoryIdentityQueries: (input, port) =>
      write((transaction) =>
        admitQueries(transaction, RepositoryIdentityAdmissionRequestSchema.parse(input), port),
      ).catch(registryFailure),
  };
}
