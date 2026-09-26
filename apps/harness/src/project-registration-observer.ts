import { z } from "zod";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./registration/observer-limits.js";
import { RegistryFailureSchema, registryFailure } from "./registration/registry-failure.js";

const ExecutableSelectionIdSchema = z.uuid().brand<"ExecutableSelectionId">();
const ExecutableConsentIdSchema = z.uuid().brand<"ExecutableConsentId">();
const VersionObservationIdSchema = z.uuid().brand<"VersionObservationId">();

export const GitVersionInspectionRequestSchema = z.strictObject({
  selectionId: ExecutableSelectionIdSchema,
  consentId: ExecutableConsentIdSchema.nullable(),
});

export type GitVersionInspectionRequest = z.infer<typeof GitVersionInspectionRequestSchema>;
export const PreparedGitVersionSchema = z.strictObject({
  status: z.literal("prepared"),
  selectionId: ExecutableSelectionIdSchema,
  observationId: VersionObservationIdSchema,
  version: z.string().min(1),
});

export const ObserverFailureTriggerSchema = z.enum([
  "INTERNAL_FAILURE",
  "OBSERVATION_LIMIT_EXCEEDED",
  "CANCELLED",
]);
export type ObserverFailureTrigger = z.infer<typeof ObserverFailureTriggerSchema>;

export const GitVersionInspectionResultSchema = z.union([
  z.strictObject({ status: z.literal("cancelled") }),
  z.strictObject({
    status: z.literal("pending-recovery"),
    code: z.literal("OBSERVER_CLEANUP_UNCONFIRMED"),
    trigger: ObserverFailureTriggerSchema.optional(),
  }),
  RegistryFailureSchema,
  z.strictObject({
    status: z.literal("broken"),
    code: z.literal("INTERNAL_FAILURE"),
    reconciliation: z.literal("exact-owner-absence").optional(),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    code: z.literal("OBSERVATION_INVALID"),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    code: z.literal("GIT_QUERY_FAILED"),
    exitCode: z.int(),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    code: z.enum([
      "GIT_UNAVAILABLE",
      "GIT_CONFIRMATION_REQUIRED",
      "OBSERVATION_LIMIT_EXCEEDED",
      "IDENTITY_CAPABILITY_UNAVAILABLE",
    ]),
  }),
  PreparedGitVersionSchema,
]);

export type GitVersionInspectionResult = z.infer<typeof GitVersionInspectionResultSchema>;

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
