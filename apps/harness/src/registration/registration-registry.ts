import type {
  GitVersionInspectionRequest,
  GitVersionInspectionResult,
  ObserverAdmissionPort,
} from "../project-registration-observer.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { observeSelectedExecutable } from "../storage/repository-identity-observer.js";
import { readConsent, readSelection } from "./executable-consent-store.js";
import type { VersionConsentAuthority } from "./git-version-inspection.js";
import {
  createIdentityQueryConsentAuthority,
  type IdentityQueryConsentAuthority,
} from "./identity-query-consent.js";
import { createRegistryObserverJournal, type ObserverRecoveryPort } from "./observer-journal.js";
import {
  type PreparedRegistryRunner,
  type RegistrationDatabaseOptions,
  type RegistryRunner,
  withRegistrationDatabase,
} from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";
import {
  createRepositoryTrustOwner,
  type NativeRepositorySelectionPort,
  type RepositoryTrustOwner,
} from "./repository-trust.js";
import type { VersionObserverJournal } from "./version-observation-execution.js";

export type ExecutableSelectionRequest = Readonly<{
  selectionId: GitVersionInspectionRequest["selectionId"];
  executablePath: string;
}>;

type RegistryFailure = Exclude<GitVersionInspectionResult, { status: "prepared" }>;

export interface RegistrationRegistry
  extends VersionConsentAuthority,
    IdentityQueryConsentAuthority,
    RepositoryTrustOwner,
    VersionObserverJournal,
    ObserverAdmissionPort,
    ObserverRecoveryPort {
  prepareExecutable(
    request: ExecutableSelectionRequest,
  ): Promise<
    | Readonly<{ status: "prepared"; selectionId: ExecutableSelectionRequest["selectionId"] }>
    | RegistryFailure
  >;
  decideVersion(
    request: Readonly<{
      selectionId: GitVersionInspectionRequest["selectionId"];
      consentId: NonNullable<GitVersionInspectionRequest["consentId"]>;
      decision: "accepted" | "declined";
    }>,
  ): Promise<Readonly<{ status: "recorded" }> | RegistryFailure>;
  stop(): Promise<void>;
}

export function createRegistrationRegistry(
  options: RegistrationDatabaseOptions,
  repositorySelection?: NativeRepositorySelectionPort,
): RegistrationRegistry {
  let stopped = false;
  const pending = new Set<Promise<unknown>>();
  const track = async <Result>(operation: () => Promise<Result>): Promise<Result> => {
    if (stopped) throw new Error("Registration registry is stopped.");
    const work = operation();
    pending.add(work);
    try {
      return await work;
    } finally {
      pending.delete(work);
    }
  };
  const run: RegistryRunner = (operation) =>
    track(() => withRegistrationDatabase(options, operation));
  const prepareAndRun: PreparedRegistryRunner = (prepare, operation) =>
    track(async () => {
      await withRegistrationDatabase(options, async () => undefined);
      const prepared = await prepare();
      return operation(prepared, (next) =>
        withRegistrationDatabase(options, next, "existing-only"),
      );
    });
  return {
    ...createIdentityQueryConsentAuthority(run),
    ...createRepositoryTrustOwner(run, prepareAndRun, repositorySelection),
    ...createRegistryObserverJournal(run),
    prepareExecutable: async (request) => {
      try {
        return await run(async (client) => {
          const observed = await observeSelectedExecutable(request.executablePath);
          if (observed.status !== "observed") return observed;
          return withWriteTransaction(client, async (transaction) => {
            const existing = await readSelection(transaction, request.selectionId);
            if (existing === undefined) {
              await transaction.execute({
                sql: "INSERT INTO registration_executable_selections (selection_id, executable_path, platform, volume_identity, file_identity, birth_identity, sha256, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                args: [
                  request.selectionId,
                  request.executablePath,
                  observed.identity.platform,
                  observed.identity.volumeIdentity,
                  observed.identity.fileIdentity,
                  observed.identity.birthIdentity,
                  observed.identity.sha256,
                  new Date().toISOString(),
                ],
              });
            } else if (existing.executablePath !== request.executablePath) {
              throw new Error("Registration selection identity conflicts.");
            }
            return { status: "prepared" as const, selectionId: request.selectionId };
          });
        });
      } catch (error) {
        return registryFailure(error);
      }
    },
    decideVersion: async (request) => {
      try {
        return await run((client) =>
          withWriteTransaction(client, async (transaction) => {
            const existing = await readConsent(transaction, request.consentId);
            if (existing !== undefined) {
              if (
                existing.selectionId === request.selectionId &&
                existing.decision === request.decision
              ) {
                return { status: "recorded" as const };
              }
              throw new RegistryFault({
                status: "rejected",
                code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
              });
            }
            const selection = await readSelection(transaction, request.selectionId);
            if (selection === undefined)
              return { status: "unavailable" as const, code: "GIT_CONFIRMATION_REQUIRED" as const };
            await transaction.execute({
              sql: "INSERT INTO registration_version_consents (consent_id, selection_id, decision, decided_at) VALUES (?, ?, ?, ?)",
              args: [
                request.consentId,
                request.selectionId,
                request.decision,
                new Date().toISOString(),
              ],
            });
            return { status: "recorded" as const };
          }),
        );
      } catch (error) {
        return registryFailure(error);
      }
    },
    resolve: async (request) =>
      run((client) =>
        withWriteTransaction(client, async (transaction) => {
          const consent = await readConsent(transaction, request.consentId);
          if (consent?.decision !== "accepted" || consent.selectionId !== request.selectionId)
            return { status: "unconfirmed" as const };
          const selection = await readSelection(transaction, consent.selectionId);
          if (selection === undefined) throw new Error("Consent selection is missing.");
          return {
            status: "accepted" as const,
            executablePath: selection.executablePath,
            executableIdentity: selection.executableIdentity,
          };
        }),
      ),
    stop: async () => {
      stopped = true;
      const results = await Promise.allSettled([...pending]);
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0)
        throw new AggregateError(
          failed.map((result) => result.reason),
          "Registration registry did not stop cleanly.",
        );
    },
  };
}
