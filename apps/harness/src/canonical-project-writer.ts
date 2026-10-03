import type {
  CanonicalProjectCommandResult,
  ProjectActivationId,
  ProjectId,
  TypedCommand,
  WriterGeneration,
} from "@slopstop/protocol";
import { CanonicalProjectCommandResultSchema, decodeStrict } from "@slopstop/protocol";
import { snapshotCanonicalCommand } from "./canonical-json.js";
import type { CanonicalCommandRepository } from "./storage/canonical-command-repository.js";
import type {
  CanonicalWriterLease,
  CanonicalWriterLeaseFailureCode,
} from "./storage/canonical-writer-lease.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";
export type CanonicalProjectWriterReleaseFailureCode =
  | "WRITER_FENCE_STALE"
  | "WRITER_FENCE_RELEASE_FAILED"
  | "WRITER_REPOSITORY_CLOSE_FAILED"
  | CanonicalWriterLeaseFailureCode;
export interface CanonicalProjectWriter {
  readonly projectId: ProjectId;
  readonly activationId: ProjectActivationId;
  readonly writerGeneration: WriterGeneration;
  settle(command: TypedCommand): CanonicalProjectWriterSubmission;
  verifyFence(): Promise<
    { status: "current" | "stale" } | { status: "broken"; code: "WRITER_FENCE_CHECK_FAILED" }
  >;
  close(releasedAt: string): Promise<void>;
}
export type CanonicalProjectWriterSubmission =
  | Readonly<{ status: "completed"; result: CanonicalProjectCommandResult }>
  | Readonly<{ status: "pending"; result: Promise<CanonicalProjectCommandResult> }>;
export type CanonicalProjectWriterInput = Readonly<{
  projectId: ProjectId;
  activationId: ProjectActivationId;
  writerGeneration: WriterGeneration;
  repository: CanonicalCommandRepository;
  lease: CanonicalWriterLease;
}>;
export class CanonicalProjectWriterReleaseError extends Error {
  override readonly name = "CanonicalProjectWriterReleaseError";
  constructor(
    readonly code: CanonicalProjectWriterReleaseFailureCode,
    options?: ErrorOptions,
  ) {
    super("Canonical Project Writer release failed.", options);
  }
}

function writerFailure(
  input: CanonicalProjectWriterInput,
  commandId: TypedCommand["commandId"],
  status: "stale-writer" | "sequence-exhausted" | "command-busy" | "writer-unavailable",
): CanonicalProjectCommandResult {
  const diagnostics = {
    "writer-unavailable": {
      code: "WRITER_UNAVAILABLE",
      message: "The Writer requires explicit reactivation.",
      retryable: false,
    },
    "command-busy": {
      code: "COMMAND_IN_PROGRESS",
      message: "Another command is in progress.",
      retryable: true,
    },
    "stale-writer": {
      code: "WRITER_FENCE_STALE",
      message: "The active Writer fence is stale.",
      retryable: false,
    },
    "sequence-exhausted": {
      code: "PROJECT_SEQUENCE_EXHAUSTED",
      message: "The Project sequence is exhausted.",
      retryable: false,
    },
  } as const;
  return decodeStrict(CanonicalProjectCommandResultSchema, {
    status,
    projectId: input.projectId,
    activationId: input.activationId,
    commandId,
    diagnostic: diagnostics[status],
  });
}

export function createCanonicalProjectWriter(
  input: CanonicalProjectWriterInput,
): CanonicalProjectWriter {
  const release = stagedWriterRelease(input);
  let attempt: Promise<void> | undefined;
  let admissionClosed = false;
  let inFlight:
    | Readonly<{ key: string; result: Promise<CanonicalProjectCommandResult> }>
    | undefined;
  const runSettlement = async (
    key: string,
    commandId: TypedCommand["commandId"],
  ): Promise<CanonicalProjectCommandResult> => {
    try {
      return await settleWriterCommand(input, key, commandId);
    } catch (error) {
      admissionClosed = true;
      throw error;
    }
  };
  const settle = (command: TypedCommand): CanonicalProjectWriterSubmission => {
    const commandId = command.commandId;
    if (admissionClosed)
      return { status: "completed", result: writerFailure(input, commandId, "writer-unavailable") };
    let key: string;
    try {
      key = snapshotCanonicalCommand(input.projectId, command);
    } catch (error) {
      admissionClosed = true;
      throw error;
    }
    if (inFlight !== undefined) {
      return inFlight.key === key
        ? { status: "pending", result: inFlight.result }
        : { status: "completed", result: writerFailure(input, commandId, "command-busy") };
    }
    // Reserve the slot before invoking even a synchronously throwing repository.
    const result = Promise.resolve().then(() => runSettlement(key, commandId));
    inFlight = { key, result };
    const clear = () => {
      inFlight = undefined;
    };
    void result.then(clear, clear);
    return { status: "pending", result };
  };
  return {
    projectId: input.projectId,
    activationId: input.activationId,
    writerGeneration: input.writerGeneration,
    settle,
    verifyFence: async () => {
      try {
        return await input.repository.verifyFence();
      } catch {
        return { status: "broken", code: "WRITER_FENCE_CHECK_FAILED" };
      }
    },
    close: (time) => {
      admissionClosed = true;
      if (attempt !== undefined) return attempt;
      const settlement = inFlight?.result;
      const pending = (async () => {
        // Drain only; the original result still rejects for every admitted caller.
        if (settlement !== undefined)
          await settlement.then(
            () => undefined,
            () => undefined,
          );
        await release(time);
      })();
      attempt = pending;
      void pending.catch(() => {
        if (attempt === pending) attempt = undefined;
      });
      return pending;
    },
  };
}

async function settleWriterCommand(
  input: CanonicalProjectWriterInput,
  key: string,
  commandId: TypedCommand["commandId"],
): Promise<CanonicalProjectCommandResult> {
  const outcome = await input.repository.settle(key);
  if (outcome.status !== "settled") return writerFailure(input, commandId, outcome.status);
  return decodeStrict(CanonicalProjectCommandResultSchema, {
    status: "settled",
    projectId: input.projectId,
    activationId: input.activationId,
    commandId,
    receipt: outcome.receipt,
  });
}

function stagedWriterRelease(input: CanonicalProjectWriterInput) {
  const releaseFence = async (time: string) => {
    let result: Awaited<ReturnType<CanonicalCommandRepository["releaseFence"]>>;
    try {
      result = await input.repository.releaseFence(time);
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError("WRITER_FENCE_RELEASE_FAILED", { cause });
    }
    if (result.status === "stale")
      throw new CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE");
  };
  const closeRepository = async () => {
    try {
      await input.repository.close();
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError("WRITER_REPOSITORY_CLOSE_FAILED", { cause });
    }
  };
  const releaseLease = async () => {
    try {
      await input.lease.release();
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError(
        cause instanceof CanonicalWriterLeaseError ? cause.code : "WRITER_LEASE_CLOSE_FAILED",
        { cause },
      );
    }
  };
  const stages = [releaseFence, closeRepository, releaseLease];
  let completed = 0;
  return async (time: string) => {
    for (const stage of stages.slice(completed)) {
      await stage(time);
      completed += 1;
    }
  };
}
