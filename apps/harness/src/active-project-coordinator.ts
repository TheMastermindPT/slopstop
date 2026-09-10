import type {
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectCommandRequest,
  CanonicalProjectCommandResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
  ProjectActivationId,
} from "@slopstop/protocol";
import {
  type CanonicalProjectActivationDiagnosticCode,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchResultSchema,
  type ProjectId,
} from "@slopstop/protocol";
import {
  type CanonicalProjectWriter,
  CanonicalProjectWriterReleaseError,
  createCanonicalProjectWriter,
} from "./canonical-project-writer.js";
import type {
  ProjectStorageActivationOutcome,
  ProjectStorageActivationPort,
  ProjectStorageActivationSession,
} from "./project-storage-application.js";
import type {
  CanonicalCommandRepositoryActivationResult,
  CanonicalCommandRepositoryFactory,
  WriterCapabilityToken,
} from "./storage/canonical-command-repository.js";
import {
  type CanonicalWriterLease,
  type CanonicalWriterLeaseAcquisition,
  type CanonicalWriterLeaseCleanup,
  CanonicalWriterLeaseError,
  type CanonicalWriterLeaseFactory,
} from "./storage/canonical-writer-lease.js";
import { SerialLock } from "./storage/serial-lock.js";
export interface ActiveProjectCoordinator {
  activate(request: CanonicalProjectActivationRequest): Promise<CanonicalProjectActivationResult>;
  switchProject(request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult>;
  execute(request: CanonicalProjectCommandRequest): Promise<CanonicalProjectCommandResult>;
  stop(): Promise<void>;
}
export type ActiveProjectCoordinatorDependencies = Readonly<{
  storage: ProjectStorageActivationPort;
  leases: CanonicalWriterLeaseFactory;
  repositories: CanonicalCommandRepositoryFactory;
  createActivationId(): ProjectActivationId;
  createWriterToken(): WriterCapabilityToken;
  now(): string;
}>;
type Ownership = Readonly<{ session: ProjectStorageActivationSession }> &
  (
    | Readonly<{ stage: "storage" }>
    | Readonly<{ stage: "lease"; lease: CanonicalWriterLease }>
    | Readonly<{ stage: "lease-file-cleanup"; cleanup: CanonicalWriterLeaseCleanup }>
    | Readonly<{
        stage: "repository-cleanup";
        cleanup: Readonly<{ close(): Promise<void> }>;
        lease: CanonicalWriterLease;
      }>
    | Readonly<{ stage: "writer"; writer: CanonicalProjectWriter }>
  );
type ActiveActivation = Readonly<{
  projectId: ProjectId;
  activationId: ProjectActivationId;
  ownership: Ownership;
}> &
  (
    | Readonly<{ access: "read-only" }>
    | Readonly<{ access: "read-write"; writer: CanonicalProjectWriter }>
  );
type State =
  | Readonly<{ status: "inactive" }>
  | Readonly<{ status: "activating" }>
  | Readonly<{ status: "stopped" }>
  | Readonly<{ status: "active"; activation: ActiveActivation }>
  | Readonly<{
      status: "releasing" | "release-failed";
      projectId: ProjectId;
      activationId: ProjectActivationId | null;
      ownership: Ownership;
    }>;
type ReleaseResult =
  | Readonly<{ status: "released" }>
  | Readonly<{
      status: "failed";
      ownership: Ownership;
      code: CanonicalProjectActivationDiagnosticCode;
    }>;

function activationFailure(
  request: CanonicalProjectActivationRequest,
  status: "broken" | "unavailable" | "rejected",
  code: CanonicalProjectActivationDiagnosticCode,
  message: string,
  retryable = false,
): CanonicalProjectActivationResult {
  return CanonicalProjectActivationResultSchema.parse({
    status,
    request,
    diagnostic: { code, message, retryable },
  });
}
const commandDiagnostics = {
  inactive: {
    code: "PROJECT_INACTIVE",
    message: "No Project is active for Typed commands.",
    retryable: false,
  },
  "project-mismatch": {
    code: "PROJECT_NOT_ACTIVE",
    message: "The command Project is not active.",
    retryable: false,
  },
  "stale-activation": {
    code: "PROJECT_ACTIVATION_STALE",
    message: "The command activation is stale.",
    retryable: false,
  },
  "read-only": {
    code: "WRITER_UNAVAILABLE",
    message: "The active Project has no write authority.",
    retryable: true,
  },
  "stale-writer": {
    code: "WRITER_FENCE_STALE",
    message: "The active Writer fence is stale.",
    retryable: false,
  },
  broken: {
    code: "WRITER_FENCE_CHECK_FAILED",
    message: "The active Writer fence could not be verified.",
    retryable: false,
  },
  "settlement-unavailable": {
    code: "COMMAND_SETTLEMENT_UNAVAILABLE",
    message: "Typed-command settlement is not available in this release slice.",
    retryable: false,
  },
  "coordinator-unavailable": {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: "Canonical Project coordination is unavailable.",
    retryable: false,
  },
} as const;
const switchDiagnostics = {
  inactive: {
    code: "PROJECT_INACTIVE",
    message: "No Project is active for switching.",
    retryable: false,
  },
  "coordinator-unavailable": commandDiagnostics["coordinator-unavailable"],
  "project-mismatch": {
    code: "PROJECT_NOT_ACTIVE",
    message: "The switch source Project is not active.",
    retryable: false,
  },
  "stale-activation": {
    code: "PROJECT_ACTIVATION_STALE",
    message: "The switch source activation is stale.",
    retryable: false,
  },
} as const;

function switchRejection(state: State): keyof typeof switchDiagnostics | undefined {
  if (state.status === "inactive") return "inactive";
  if (state.status === "active") return undefined;
  if (state.status === "release-failed" && state.activationId !== null) return undefined;
  return "coordinator-unavailable";
}

function ownedActivation(state: State) {
  if (state.status === "active") return state.activation;
  if (state.status === "release-failed" || state.status === "releasing") return state;
  throw new Error("Canonical Project lifecycle state is inconsistent.");
}

function rejectSwitchSource(state: State, request: CanonicalProjectSwitchRequest) {
  const unavailable = switchRejection(state);
  if (unavailable !== undefined) return unavailable;
  const source = ownedActivation(state);
  if (source.projectId !== request.from.projectId) return "project-mismatch";
  if (source.activationId !== request.from.activationId) return "stale-activation";
  return undefined;
}
function commandFailure(
  request: CanonicalProjectCommandRequest,
  status: keyof typeof commandDiagnostics,
): CanonicalProjectCommandResult {
  return CanonicalProjectCommandResultSchema.parse({
    status,
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    diagnostic: commandDiagnostics[status],
  });
}

async function releaseStage(owned: Ownership, time: string): Promise<Ownership | undefined> {
  switch (owned.stage) {
    case "writer":
      await owned.writer.close(time);
      return { stage: "storage", session: owned.session };
    case "repository-cleanup":
      await owned.cleanup.close();
      return { stage: "lease", session: owned.session, lease: owned.lease };
    case "lease-file-cleanup":
      await owned.cleanup.close();
      return { stage: "storage", session: owned.session };
    case "lease":
      await owned.lease.release();
      return { stage: "storage", session: owned.session };
    case "storage":
      await owned.session.close();
      return undefined;
  }
}
function releaseCode(owned: Ownership, error: unknown): CanonicalProjectActivationDiagnosticCode {
  if (owned.stage === "writer")
    return error instanceof CanonicalProjectWriterReleaseError
      ? error.code
      : "WRITER_FENCE_RELEASE_FAILED";
  if (owned.stage === "lease")
    return error instanceof CanonicalWriterLeaseError ? error.code : "WRITER_LEASE_CLOSE_FAILED";
  const codes = {
    "repository-cleanup": "WRITER_REPOSITORY_CLOSE_FAILED",
    "lease-file-cleanup": "WRITER_LEASE_CLOSE_FAILED",
    storage: "PROJECT_STORAGE_RELEASE_FAILED",
  } as const;
  return codes[owned.stage];
}
async function releaseOwnership(ownership: Ownership, time: string): Promise<ReleaseResult> {
  let remaining: Ownership | undefined = ownership;
  while (remaining !== undefined) {
    const current = remaining;
    try {
      remaining = await releaseStage(current, time);
    } catch (error) {
      return { status: "failed", ownership: current, code: releaseCode(current, error) };
    }
  }
  return { status: "released" };
}

function nonReadyResult(
  request: CanonicalProjectActivationRequest,
  storage: Exclude<ProjectStorageActivationOutcome, { status: "ready" }>,
): CanonicalProjectActivationResult {
  switch (storage.status) {
    case "unavailable":
      return activationFailure(
        request,
        "unavailable",
        "PROJECT_STORAGE_UNAVAILABLE",
        "Project Storage is unavailable.",
        true,
      );
    case "broken":
      return activationFailure(
        request,
        "broken",
        "PROJECT_STORAGE_BROKEN",
        "Project Storage activation failed.",
      );
    case "not-registered":
      return { status: "not-registered", request };
  }
}

type AcquisitionContext = Readonly<{
  dependencies: ActiveProjectCoordinatorDependencies;
  request: CanonicalProjectActivationRequest;
  hold(owned: Ownership): void;
  publish(active: ActiveActivation): CanonicalProjectActivationResult;
  cleanup(): Promise<ReleaseResult>;
  retain(
    owned: Ownership,
    code: CanonicalProjectActivationDiagnosticCode,
  ): CanonicalProjectActivationResult;
  failed(
    code: CanonicalProjectActivationDiagnosticCode,
    message: string,
  ): Promise<CanonicalProjectActivationResult>;
}>;

function activationRejection(
  state: State,
  request: CanonicalProjectActivationRequest,
): CanonicalProjectActivationResult | undefined {
  if (state.status === "stopped")
    return activationFailure(
      request,
      "unavailable",
      "PROJECT_COORDINATOR_UNAVAILABLE",
      "Canonical Project coordination is unavailable.",
    );
  if (state.status !== "inactive")
    return activationFailure(
      request,
      "rejected",
      "PROJECT_ALREADY_ACTIVE",
      "A Project activation already owns this harness session.",
    );
  return undefined;
}

function activeResult(
  request: CanonicalProjectActivationRequest,
  active: ActiveActivation,
): CanonicalProjectActivationResult {
  if (active.access === "read-write")
    return {
      status: "active",
      request,
      access: "read-write",
      activationId: active.activationId,
      writerGeneration: active.writer.writerGeneration,
    };
  return {
    status: "active",
    request,
    access: "read-only",
    activationId: active.activationId,
    writerGeneration: null,
    diagnostic: {
      code: "WRITER_UNAVAILABLE",
      message: "Another SlopStop process holds Project write authority.",
      retryable: true,
    },
  };
}

async function failedLease(
  context: AcquisitionContext,
  session: ProjectStorageActivationSession,
  acquisition: Extract<CanonicalWriterLeaseAcquisition, { status: "broken" }>,
): Promise<CanonicalProjectActivationResult> {
  if (acquisition.cleanup !== undefined)
    return context.retain(
      { stage: "lease-file-cleanup", cleanup: acquisition.cleanup, session },
      "WRITER_LEASE_CLOSE_FAILED",
    );
  return context.failed(
    acquisition.error.code,
    new CanonicalWriterLeaseError(acquisition.error.code).message,
  );
}

async function failedRepository(
  context: AcquisitionContext,
  ownership: Extract<Ownership, { stage: "lease" }>,
  repository: Extract<CanonicalCommandRepositoryActivationResult, { status: "broken" }>,
): Promise<CanonicalProjectActivationResult> {
  if (repository.cleanup !== undefined)
    return context.retain(
      { ...ownership, stage: "repository-cleanup", cleanup: repository.cleanup },
      "WRITER_REPOSITORY_CLOSE_FAILED",
    );
  return context.failed("WRITER_FENCE_ACTIVATION_FAILED", "Writer fence could not be activated.");
}

async function acquireWritable(
  context: AcquisitionContext,
  session: Extract<ProjectStorageActivationSession, { mode: "read-write" }>,
): Promise<CanonicalProjectActivationResult> {
  const { dependencies, request } = context;
  const activationId = dependencies.createActivationId();
  const acquisition = await dependencies.leases.acquire(session.writerLeasePath);
  if (acquisition.status === "contended")
    return context.publish({
      access: "read-only",
      projectId: request.projectId,
      activationId,
      ownership: { stage: "storage", session },
    });
  if (acquisition.status === "broken") return failedLease(context, session, acquisition);
  const ownership = { stage: "lease", lease: acquisition.lease, session } as const;
  context.hold(ownership);
  const repository = await dependencies.repositories.activate({
    canonicalDatabasePath: session.canonicalDatabasePath,
    projectId: request.projectId,
    activationId,
    writerToken: dependencies.createWriterToken(),
    activatedAt: dependencies.now(),
  });
  if (repository.status === "broken") return failedRepository(context, ownership, repository);
  const writer = createCanonicalProjectWriter({
    projectId: request.projectId,
    activationId,
    writerGeneration: repository.writerGeneration,
    repository: repository.repository,
    lease: acquisition.lease,
  });
  return context.publish({
    projectId: request.projectId,
    activationId,
    ownership: { stage: "writer", writer, session },
    access: "read-write",
    writer,
  });
}

async function acquireProject(
  context: AcquisitionContext,
): Promise<CanonicalProjectActivationResult> {
  const { request, dependencies } = context;
  const storage = await dependencies.storage.acquireActivation(request);
  if (storage.status !== "ready") {
    await context.cleanup();
    return nonReadyResult(request, storage);
  }
  const session = storage.session;
  context.hold({ stage: "storage", session });
  if (session.mode === "safe-mode") {
    const closed = await context.cleanup();
    if (closed.status === "failed") return context.retain(closed.ownership, closed.code);
    return {
      status: "safe-mode",
      request,
      identity: session.result.identity,
      canonicalHealth: session.result.canonicalHealth,
      runtimeHealth: session.result.runtimeHealth,
    };
  }
  return acquireWritable(context, session);
}

export function createActiveProjectCoordinator(
  dependencies: ActiveProjectCoordinatorDependencies,
): ActiveProjectCoordinator {
  const lifecycle = new SerialLock();
  const admitted = new Set<Promise<void>>();
  let state: State = { status: "inactive" };
  let stopAttempt: Promise<void> | undefined;
  let pendingLifecycle = 0;

  const enqueue = <Result>(operation: () => Promise<Result>): Promise<Result> => {
    pendingLifecycle++;
    return lifecycle.run(async () => {
      try {
        return await operation();
      } finally {
        pendingLifecycle--;
      }
    });
  };

  const release = async (
    owned: Readonly<{
      projectId: ProjectId;
      activationId: ProjectActivationId | null;
      ownership: Ownership;
    }>,
  ): Promise<ReleaseResult> => {
    await Promise.all([...admitted]);
    // Clock failure must leave the original active or retained state intact.
    const time = dependencies.now();
    state = { ...owned, status: "releasing" };
    const result = await releaseOwnership(owned.ownership, time);
    state =
      result.status === "released"
        ? { status: "inactive" }
        : { ...owned, status: "release-failed", ownership: result.ownership };
    return result;
  };

  const retainFailure = (
    request: CanonicalProjectActivationRequest,
    ownership: Ownership,
    code: CanonicalProjectActivationDiagnosticCode,
  ): CanonicalProjectActivationResult => {
    state = {
      status: "release-failed",
      projectId: request.projectId,
      activationId: null,
      ownership,
    };
    return activationFailure(
      request,
      "broken",
      code,
      "Project activation resources could not be released.",
    );
  };

  const activateWithinLifecycle = async (
    request: CanonicalProjectActivationRequest,
  ): Promise<CanonicalProjectActivationResult> => {
    const rejected = activationRejection(state, request);
    if (rejected !== undefined) return rejected;
    state = { status: "activating" };
    let ownership: Ownership | undefined;
    let cleanupAttempt: Promise<ReleaseResult> | undefined;
    const cleanup = (): Promise<ReleaseResult> => {
      if (cleanupAttempt !== undefined) return cleanupAttempt;
      if (ownership === undefined) {
        state = { status: "inactive" };
        return Promise.resolve({ status: "released" });
      }
      const retained = { projectId: request.projectId, activationId: null, ownership };
      state = { ...retained, status: "release-failed" };
      cleanupAttempt = release(retained);
      return cleanupAttempt;
    };
    const failed = async (
      code: CanonicalProjectActivationDiagnosticCode,
      message: string,
    ): Promise<CanonicalProjectActivationResult> => {
      const result = await cleanup();
      if (result.status === "failed") return retainFailure(request, result.ownership, result.code);
      return activationFailure(request, "broken", code, message);
    };
    try {
      return await acquireProject({
        dependencies,
        request,
        cleanup,
        failed,
        hold: (owned) => {
          ownership = owned;
        },
        retain: (owned, code) => {
          ownership = owned;
          return retainFailure(request, owned, code);
        },
        publish: (activation) => {
          ownership = activation.ownership;
          state = { status: "active", activation };
          return activeResult(request, activation);
        },
      });
    } catch (error) {
      const result = await cleanup();
      if (result.status === "failed") return retainFailure(request, result.ownership, result.code);
      throw error;
    }
  };

  const stop = async (): Promise<void> => {
    const current = state;
    if (current.status === "stopped") return;
    if (current.status === "inactive") {
      state = { status: "stopped" };
      return;
    }
    const result = await release(ownedActivation(current));
    if (result.status === "failed") throw new Error("Canonical Project activation release failed.");
    state = { status: "stopped" };
  };

  return {
    activate: (request) => enqueue(() => activateWithinLifecycle(request)),
    switchProject: (request) =>
      enqueue(async () => {
        const rejected = rejectSwitchSource(state, request);
        if (rejected !== undefined)
          return CanonicalProjectSwitchResultSchema.parse({
            status: rejected,
            request,
            diagnostic: switchDiagnostics[rejected],
          });
        const released = await release(ownedActivation(state));
        if (released.status === "failed")
          return CanonicalProjectSwitchResultSchema.parse({
            status: "release-failed",
            request,
            diagnostic: {
              code: released.code,
              message: "Project activation resources could not be released.",
              retryable: released.code !== "WRITER_FENCE_STALE",
            },
          });
        return {
          status: "target-result",
          request,
          target: await activateWithinLifecycle(request.to),
        };
      }),
    execute: async (request) => {
      if (pendingLifecycle > 0) return commandFailure(request, "coordinator-unavailable");
      if (state.status === "inactive") return commandFailure(request, "inactive");
      if (state.status !== "active") return commandFailure(request, "coordinator-unavailable");
      const active = state.activation;
      if (active.projectId !== request.projectId)
        return commandFailure(request, "project-mismatch");
      if (active.activationId !== request.activationId)
        return commandFailure(request, "stale-activation");
      if (active.access === "read-only") return commandFailure(request, "read-only");
      const operation = active.writer.verifyFence();
      const completion = operation.then(
        () => undefined,
        () => undefined,
      );
      admitted.add(completion);
      try {
        const fence = await operation;
        const status = {
          current: "settlement-unavailable",
          stale: "stale-writer",
          broken: "broken",
        } as const;
        return commandFailure(request, status[fence.status]);
      } finally {
        await completion;
        admitted.delete(completion);
      }
    },
    stop: () => {
      if (stopAttempt !== undefined) return stopAttempt;
      const attempt = enqueue(stop);
      stopAttempt = attempt;
      void attempt.catch(() => {
        if (stopAttempt === attempt) stopAttempt = undefined;
      });
      return attempt;
    },
  };
}
