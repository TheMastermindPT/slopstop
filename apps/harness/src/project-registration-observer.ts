import {
  ExecutableConsentIdSchema,
  ExecutableSelectionIdSchema,
  NonEmptyTextSchema,
  VersionObservationIdSchema,
} from "@slopstop/protocol";
import { Deferred, Effect, Exit, Schema } from "effect";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./registration/observer-limits.js";
import { RegistryFailureSchema, registryFailure } from "./registration/registry-failure.js";

export const GitVersionInspectionRequestSchema = Schema.Struct({
  selectionId: ExecutableSelectionIdSchema,
  consentId: Schema.NullOr(ExecutableConsentIdSchema),
});

export type GitVersionInspectionRequest = typeof GitVersionInspectionRequestSchema.Type;
export const PreparedGitVersionSchema = Schema.Struct({
  status: Schema.Literal("prepared"),
  selectionId: ExecutableSelectionIdSchema,
  observationId: VersionObservationIdSchema,
  version: NonEmptyTextSchema,
});

const ObserverFailureTriggerSchema = Schema.Literals([
  "INTERNAL_FAILURE",
  "OBSERVATION_LIMIT_EXCEEDED",
  "CANCELLED",
]);
export type ObserverFailureTrigger = typeof ObserverFailureTriggerSchema.Type;

export const GitVersionInspectionResultSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("cancelled") }),
  Schema.Struct({
    status: Schema.Literal("pending-recovery"),
    code: Schema.Literal("OBSERVER_CLEANUP_UNCONFIRMED"),
    trigger: Schema.optional(ObserverFailureTriggerSchema),
  }),
  RegistryFailureSchema,
  Schema.Struct({
    status: Schema.Literal("broken"),
    code: Schema.Literal("INTERNAL_FAILURE"),
    reconciliation: Schema.optional(Schema.Literal("exact-owner-absence")),
  }),
  Schema.Struct({
    status: Schema.Literal("rejected"),
    code: Schema.Literal("OBSERVATION_INVALID"),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literal("GIT_QUERY_FAILED"),
    exitCode: Schema.Number.check(Schema.isInt()),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literals([
      "GIT_UNAVAILABLE",
      "GIT_CONFIRMATION_REQUIRED",
      "OBSERVATION_LIMIT_EXCEEDED",
      "IDENTITY_CAPABILITY_UNAVAILABLE",
    ]),
  }),
  PreparedGitVersionSchema,
]);

export type GitVersionInspectionResult = typeof GitVersionInspectionResultSchema.Type;

export interface GitVersionInspectionPort {
  inspect(
    request: GitVersionInspectionRequest,
    signal?: AbortSignal,
  ): Promise<GitVersionInspectionResult>;
}

type ObserverCloseResult =
  | Readonly<{ status: "closed" }>
  | Readonly<{
      status: "pending-recovery";
      code: "OBSERVER_CLEANUP_UNCONFIRMED";
    }>;

export interface ProjectRegistrationObserver {
  inspectGitVersion(request: GitVersionInspectionRequest): Promise<GitVersionInspectionResult>;
  /** Closes the observer: aborts the active inspections and settles them within the budget. */
  closeEffect: Effect.Effect<ObserverCloseResult>;
  /** Temporary Promise facade over `closeEffect`, for test callers only. */
  close(): Promise<ObserverCloseResult>;
}
const cleanupUnconfirmed = {
  status: "pending-recovery",
  code: "OBSERVER_CLEANUP_UNCONFIRMED",
} as const;

/**
 * Waits for the aborted inspections until the cleanup budget ends; work still running then, or
 * any inspection left pending recovery, leaves the cleanup unconfirmed.
 */
function settleClose(
  work: readonly Promise<GitVersionInspectionResult>[],
): Effect.Effect<ObserverCloseResult> {
  // Only awaits inspections already running and starts no work, so no `concurrency`.
  return Effect.forEach(work, (inspection) => Effect.promise(() => inspection)).pipe(
    Effect.map(
      (results): ObserverCloseResult =>
        results.some((result) => result.status === "pending-recovery")
          ? cleanupUnconfirmed
          : { status: "closed" },
    ),
    Effect.timeoutOrElse({
      duration: REGISTRATION_CLEANUP_BUDGET_MS,
      orElse: () => Effect.succeed(cleanupUnconfirmed),
    }),
  );
}

export interface ObserverAdmissionPort {
  hasUnsettled(): Promise<boolean>;
}

export function createProjectRegistrationObserver(
  version: GitVersionInspectionPort,
  admission: ObserverAdmissionPort,
): ProjectRegistrationObserver {
  let closed = false;
  let closeStarted = false;
  // The one close outcome; a first close that is interrupted leaves it unconfirmed.
  const closeOutcome = Deferred.makeUnsafe<ObserverCloseResult>();
  const active = new Map<AbortController, Promise<GitVersionInspectionResult>>();
  const inspect = async (
    request: GitVersionInspectionRequest,
    signal: AbortSignal,
  ): Promise<GitVersionInspectionResult> => {
    try {
      if (await admission.hasUnsettled()) {
        return { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" };
      }
      if (signal.aborted) return { status: "cancelled" };
      if (request.consentId === null) {
        return { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" };
      }
      const result = await version.inspect(request, signal);
      if (signal.aborted && result.status === "prepared") return cleanupUnconfirmed;
      return result;
    } catch (error) {
      return registryFailure(error);
    }
  };
  const closeEffect = Effect.suspend(() => {
    if (closeStarted) return Deferred.await(closeOutcome);
    closeStarted = true;
    closed = true;
    for (const controller of active.keys()) controller.abort();
    return settleClose([...active.values()]).pipe(
      Effect.onExit((exit) =>
        Effect.asVoid(
          Deferred.succeed(closeOutcome, Exit.isSuccess(exit) ? exit.value : cleanupUnconfirmed),
        ),
      ),
    );
  });
  return {
    closeEffect,
    close: () => Effect.runPromise(closeEffect),
    inspectGitVersion: async (request) => {
      if (closed) return { status: "cancelled" };
      const controller = new AbortController();
      const work = inspect(request, controller.signal);
      active.set(controller, work);
      try {
        return await work;
      } finally {
        active.delete(controller);
      }
    },
  };
}
