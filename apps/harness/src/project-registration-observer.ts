import { NonEmptyTextSchema, UuidTextSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./registration/observer-limits.js";
import { RegistryFailureSchema, registryFailure } from "./registration/registry-failure.js";

const ExecutableSelectionIdSchema = UuidTextSchema.pipe(Schema.brand("ExecutableSelectionId"));
const ExecutableConsentIdSchema = UuidTextSchema.pipe(Schema.brand("ExecutableConsentId"));
const VersionObservationIdSchema = UuidTextSchema.pipe(Schema.brand("VersionObservationId"));

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

export const ObserverFailureTriggerSchema = Schema.Literals([
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

export interface ProjectRegistrationObserver {
  inspectGitVersion(request: GitVersionInspectionRequest): Promise<GitVersionInspectionResult>;
  close(): Promise<
    | Readonly<{ status: "closed" }>
    | Readonly<{
        status: "pending-recovery";
        code: "OBSERVER_CLEANUP_UNCONFIRMED";
      }>
  >;
}

type ObserverCloseResult = Awaited<ReturnType<ProjectRegistrationObserver["close"]>>;
const cleanupUnconfirmed = {
  status: "pending-recovery",
  code: "OBSERVER_CLEANUP_UNCONFIRMED",
} as const;

async function settleClose(
  work: Iterable<Promise<GitVersionInspectionResult>>,
): Promise<ObserverCloseResult> {
  const deadline = performance.now() + REGISTRATION_CLEANUP_BUDGET_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all(work).then((results): ObserverCloseResult => {
        if (
          performance.now() >= deadline ||
          results.some((result) => result.status === "pending-recovery")
        ) {
          return cleanupUnconfirmed;
        }
        return { status: "closed" };
      }),
      new Promise<ObserverCloseResult>((resolve) => {
        timer = setTimeout(() => resolve(cleanupUnconfirmed), REGISTRATION_CLEANUP_BUDGET_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export interface ObserverAdmissionPort {
  hasUnsettled(): Promise<boolean>;
}

export function createProjectRegistrationObserver(
  version: GitVersionInspectionPort,
  admission: ObserverAdmissionPort,
): ProjectRegistrationObserver {
  let closed = false;
  let closing: Promise<ObserverCloseResult> | undefined;
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
  return {
    close: async () => {
      if (closing !== undefined) return closing;
      closed = true;
      for (const controller of active.keys()) controller.abort();
      closing = settleClose(active.values());
      return closing;
    },
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
