import { Deferred, Effect, Result } from "effect";
import { unwrapRejection } from "../effect-rejection.js";
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
  stopStandaloneAuthority,
  withRegistrationDatabase,
} from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";
import {
  createRepositoryTrustOwner,
  type NativeRepositorySelectionPort,
  type RepositoryTrustOwner,
} from "./repository-trust.js";
import type { VersionObserverJournal } from "./version-observation-execution.js";

type ExecutableSelectionRequest = Readonly<{
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
  /**
   * The harness start's one reconciliation of observations a killed harness left. It is not
   * tracked, so a stop never waits for it or reports its outcome.
   */
  reconcileAtStart: ObserverRecoveryPort["reconcileObservers"];
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
  let nextAdmission = 0;
  // Completion of each admitted operation, failing with its rejection for the stop report.
  const pending = new Map<number, Deferred.Deferred<void, unknown>>();
  const track = async <Value>(operation: () => Promise<Value>): Promise<Value> => {
    if (stopped) throw new Error("Registration registry is stopped.");
    const work = operation();
    const admission = nextAdmission++;
    const completion = Deferred.makeUnsafe<void, unknown>();
    pending.set(admission, completion);
    const settle = (outcome: Effect.Effect<void, unknown>) => {
      Deferred.doneUnsafe(completion, outcome);
      pending.delete(admission);
    };
    void work.then(
      () => settle(Effect.void),
      (error: unknown) => settle(Effect.fail(error)),
    );
    return work;
  };
  const run: RegistryRunner = (operation) =>
    track(() => withRegistrationDatabase(options, operation));
  const untracked: RegistryRunner = (operation) => withRegistrationDatabase(options, operation);
  const prepareAndRun: PreparedRegistryRunner = (prepare, operation) =>
    track(async () => {
      await withRegistrationDatabase(options, async () => undefined);
      const prepared = await prepare();
      return operation(prepared, (next) =>
        withRegistrationDatabase(options, next, "existing-only"),
      );
    });
  // The harness start's one reconciliation: both unsettled-observer gates wait for its end.
  let startReconciled: Deferred.Deferred<void> | undefined;
  // Without a start reconciliation the gate runs at once, so a stop still finds it tracked.
  const afterStartReconciliation = <Value>(gate: () => Promise<Value>): Promise<Value> =>
    startReconciled === undefined
      ? gate()
      : Effect.runPromise(Deferred.await(startReconciled)).then(gate);
  const trust = createRepositoryTrustOwner(run, prepareAndRun, repositorySelection);
  const observers = createRegistryObserverJournal(run);
  return {
    ...createIdentityQueryConsentAuthority(run),
    ...trust,
    ...observers,
    admitRepositoryIdentityQueries: (input, port) =>
      afterStartReconciliation(() => trust.admitRepositoryIdentityQueries(input, port)),
    hasUnsettled: () => afterStartReconciliation(observers.hasUnsettled),
    reconcileAtStart: async (absence) => {
      const ended = Deferred.makeUnsafe<void>();
      startReconciled = ended;
      try {
        return await createRegistryObserverJournal(untracked).reconcileObservers(absence);
      } finally {
        Deferred.doneUnsafe(ended, Effect.void);
      }
    },
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
              throw new RegistryFault({
                status: "rejected",
                code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
              });
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
      const results = await Effect.runPromise(
        Effect.gen(function* () {
          // Only awaits admissions already running and starts no work, so no `concurrency`.
          const admissions = yield* Effect.forEach([...pending.values()], (completion) =>
            Effect.result(Deferred.await(completion)),
          );
          // Only after the admissions drain; it runs even when one of them failed.
          const database = yield* Effect.result(stopStandaloneAuthority(options));
          return [...admissions, database];
        }),
      );
      const failed = results
        .filter(Result.isFailure)
        .map((result) => unwrapRejection(result.failure));
      if (failed.length > 0)
        throw new AggregateError(failed, "Registration registry did not stop cleanly.");
    },
  };
}
