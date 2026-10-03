import { decodeStrict } from "@slopstop/protocol";
import {
  type GitVersionInspectionResult,
  type ObserverFailureTrigger,
  PreparedGitVersionSchema,
} from "../project-registration-observer.js";
import {
  type ExecutableIdentityObservation,
  sameExecutableIdentity,
} from "./executable-identity.js";
import type { VersionObservationExecution } from "./git-version-inspection.js";
import { REGISTRATION_STREAM_BYTE_LIMIT } from "./observer-limits.js";

export type VersionDispatch = Parameters<VersionObservationExecution["inspect"]>[0];
type PreparedVersion = Extract<GitVersionInspectionResult, { status: "prepared" }>;

export type WindowsObserverChildIdentity = Readonly<{
  platform: "win32";
  processId: number;
  creationTime100ns: string;
  jobName: string;
  sessionId?: number | undefined;
}>;

export interface ObserverAbsencePort {
  inspect(
    child: WindowsObserverChildIdentity,
  ): Promise<Readonly<{ status: "absent" | "unconfirmed" }>>;
}

export type ObserverTerminalProof = Readonly<{
  exitCode: number;
  stdoutClosed: true;
  stderrClosed: true;
  treeEmpty: true;
}>;

export interface VersionObserverJournal {
  readResult(request: VersionDispatch): Promise<GitVersionInspectionResult | undefined>;
  begin(
    request: VersionDispatch,
  ): Promise<
    | { status: "started"; observationId: PreparedVersion["observationId"] }
    | { status: "settled"; result: GitVersionInspectionResult }
  >;
  complete(result: PreparedVersion): Promise<void>;
  recordNoDispatch(
    observationId: PreparedVersion["observationId"],
    reason?: "cancelled",
  ): Promise<void>;
  cancel(observationId: PreparedVersion["observationId"]): Promise<void>;
  recordChild(
    observationId: PreparedVersion["observationId"],
    child: WindowsObserverChildIdentity,
  ): Promise<void>;
  recordTerminal(
    observationId: PreparedVersion["observationId"],
    terminal: ObserverTerminalProof,
  ): Promise<void>;
  invalidate(
    observationId: PreparedVersion["observationId"],
    code: Exclude<GitVersionInspectionResult, { status: "prepared" | "cancelled" }>["code"],
  ): Promise<void>;
}

export interface GitVersionChildPort {
  run(
    request: Readonly<{
      executablePath: string;
      argv: readonly ["--version"];
      observationId: PreparedVersion["observationId"];
      onOwned(child: WindowsObserverChildIdentity): Promise<void>;
    }>,
    signal?: AbortSignal,
  ): Promise<
    | Readonly<{
        status: "exited";
        exitCode: number;
        stdout: Uint8Array;
        stderr: Uint8Array;
      }>
    | Readonly<{
        status: "failed";
        code: "OBSERVATION_LIMIT_EXCEEDED";
        terminal: ObserverTerminalProof;
      }>
    | Readonly<{ status: "cancelled"; terminal: ObserverTerminalProof }>
    | Readonly<{
        status: "cleanup-unconfirmed";
        trigger: ObserverFailureTrigger;
      }>
    // Capability refusal before any process creation; exceptions never imply no dispatch.
    | Readonly<{ status: "unavailable"; code: "GIT_UNAVAILABLE" }>
  >;
}

export type VersionExecutionDependencies = Readonly<{
  inspectIdentity(path: string): Promise<ExecutableIdentityObservation>;
  journal: VersionObserverJournal;
  child: GitVersionChildPort;
}>;

function parseVersion(bytes: Uint8Array): string | undefined {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  return /^git version ([0-9]+\.[0-9]+\.[0-9]+(?:[.-][A-Za-z0-9]+)*)\r?\n$/.exec(text)?.[1];
}

async function checkIdentity(
  dependencies: VersionExecutionDependencies,
  request: VersionDispatch,
): Promise<
  Exclude<GitVersionInspectionResult, { status: "prepared" | "cancelled" }> | { status: "matched" }
> {
  const observed = await dependencies.inspectIdentity(request.executablePath);
  if (observed.status !== "observed") return observed;
  if (!sameExecutableIdentity(observed.identity, request.executableIdentity)) {
    return { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" };
  }
  return { status: "matched" };
}

async function publishVersion(
  dependencies: VersionExecutionDependencies,
  request: VersionDispatch,
  observationId: PreparedVersion["observationId"],
  stdout: Uint8Array,
  signal?: AbortSignal,
): Promise<GitVersionInspectionResult> {
  const after = await checkIdentity(dependencies, request);
  if (signal?.aborted) {
    await dependencies.journal.cancel(observationId);
    return { status: "cancelled" };
  }
  if (after.status !== "matched") {
    await dependencies.journal.invalidate(observationId, after.code);
    return after;
  }
  const version = parseVersion(stdout);
  if (version === undefined) {
    await dependencies.journal.invalidate(observationId, "OBSERVATION_INVALID");
    return { status: "rejected", code: "OBSERVATION_INVALID" };
  }
  const result = decodeStrict(PreparedGitVersionSchema, {
    status: "prepared",
    selectionId: request.selectionId,
    observationId,
    version,
  });
  await dependencies.journal.complete(result);
  return result;
}

async function recordChildOutcome(
  dependencies: VersionExecutionDependencies,
  observationId: PreparedVersion["observationId"],
  child: Awaited<ReturnType<GitVersionChildPort["run"]>>,
): Promise<GitVersionInspectionResult | undefined> {
  if (child.status === "cleanup-unconfirmed") {
    return {
      status: "pending-recovery",
      code: "OBSERVER_CLEANUP_UNCONFIRMED",
      trigger: child.trigger,
    };
  }
  if (child.status === "cancelled") {
    await dependencies.journal.recordTerminal(observationId, child.terminal);
    await dependencies.journal.cancel(observationId);
    return { status: "cancelled" };
  }
  if (child.status === "unavailable") {
    await dependencies.journal.recordNoDispatch(observationId);
    return child;
  }
  if (child.status === "failed") {
    await dependencies.journal.recordTerminal(observationId, child.terminal);
    await dependencies.journal.invalidate(observationId, child.code);
    return { status: "unavailable", code: child.code };
  }
  await dependencies.journal.recordTerminal(observationId, {
    exitCode: child.exitCode,
    stdoutClosed: true,
    stderrClosed: true,
    treeEmpty: true,
  });
  if (
    child.stdout.byteLength > REGISTRATION_STREAM_BYTE_LIMIT ||
    child.stderr.byteLength > REGISTRATION_STREAM_BYTE_LIMIT
  ) {
    await dependencies.journal.invalidate(observationId, "OBSERVATION_LIMIT_EXCEEDED");
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" };
  }
  if (child.exitCode !== 0) {
    await dependencies.journal.invalidate(observationId, "GIT_QUERY_FAILED");
    return { status: "unavailable", code: "GIT_QUERY_FAILED", exitCode: child.exitCode };
  }
  return undefined;
}

function dispatchVersionChild(
  dependencies: VersionExecutionDependencies,
  request: VersionDispatch,
  observationId: PreparedVersion["observationId"],
  signal?: AbortSignal,
) {
  return dependencies.child
    .run(
      {
        executablePath: request.executablePath,
        argv: ["--version"],
        observationId,
        onOwned: (owned) => dependencies.journal.recordChild(observationId, owned),
      },
      signal,
    )
    .catch(() => undefined);
}

async function observeAdmittedVersion(
  dependencies: VersionExecutionDependencies,
  request: VersionDispatch,
  observationId: PreparedVersion["observationId"],
  signal?: AbortSignal,
): Promise<GitVersionInspectionResult> {
  if (signal?.aborted) {
    await dependencies.journal.recordNoDispatch(observationId, "cancelled");
    return { status: "cancelled" };
  }
  const child = await dispatchVersionChild(dependencies, request, observationId, signal);
  if (child === undefined) {
    return {
      status: "pending-recovery",
      code: "OBSERVER_CLEANUP_UNCONFIRMED",
      trigger: "INTERNAL_FAILURE",
    };
  }
  const outcome = await recordChildOutcome(dependencies, observationId, child);
  if (outcome !== undefined) return outcome;
  if (child.status !== "exited") throw new Error("Missing observer outcome.");
  return publishVersion(dependencies, request, observationId, child.stdout, signal);
}

export function createVersionObservationExecution(
  dependencies: VersionExecutionDependencies,
): VersionObservationExecution {
  return {
    inspect: async (request: VersionDispatch, signal?: AbortSignal) => {
      const identity = await checkIdentity(dependencies, request);
      if (identity.status !== "matched") return identity;
      const previous = await dependencies.journal.readResult(request);
      if (previous !== undefined) return previous;
      const admission = await dependencies.journal.begin(request);
      if (admission.status === "settled") return admission.result;
      return observeAdmittedVersion(dependencies, request, admission.observationId, signal);
    },
  };
}
