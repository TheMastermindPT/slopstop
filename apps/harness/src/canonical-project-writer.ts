import type {
  CanonicalProjectCommandResult,
  ProjectActivationId,
  ProjectId,
  TypedCommand,
  WriterGeneration,
} from "@slopstop/protocol";
import { CanonicalProjectCommandResultSchema, decodeStrict } from "@slopstop/protocol";
import { Cause, Effect, Exit, Semaphore } from "effect";
import { snapshotCanonicalCommand } from "./canonical-json.js";
import {
  type ConversationWork,
  type ConversationWorkOutcome,
  type ConversationWriteOutcome,
  runConversationRead,
  runConversationWork,
} from "./canonical-writer-conversation.js";
import {
  type CanonicalCommandRepository,
  WriterOwnerBusy,
} from "./storage/canonical-command-repository.js";
import type {
  CanonicalWriterLease,
  CanonicalWriterLeaseFailureCode,
} from "./storage/canonical-writer-lease.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";
import { retryableAttempt } from "./storage/retryable-attempt.js";
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
  /**
   * Runs Conversation work in the writer's slot, after any queued settlement. Temporary Promise
   * facade over the Effect slot queue: delete it once the writer's callers are Effects.
   */
  conversation<Value, Failure>(
    work: ConversationWork<Value, Failure>,
  ): Promise<ConversationWriteOutcome<Value, Failure>>;
  /** Runs Conversation read work in the writer's slot; the same temporary facade. */
  conversationRead<Value, Failure>(
    work: ConversationWork<Value, Failure>,
  ): Promise<ConversationWorkOutcome<Value, Failure>>;
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

/** Runs a Promise in the slot and settles exactly as the Promise did. */
async function inSlot<Value>(slot: Semaphore.Semaphore, run: () => Promise<Value>): Promise<Value> {
  const exit = await Effect.runPromiseExit(
    Semaphore.withPermit(slot)(Effect.tryPromise({ try: run, catch: (cause) => cause })),
  );
  if (Exit.isSuccess(exit)) return exit.value;
  throw Cause.squash(exit.cause);
}

export function createCanonicalProjectWriter(
  input: CanonicalProjectWriterInput,
): CanonicalProjectWriter {
  // An unknown client state abandons the client: admission closes and release force-closes it.
  let abandoned = false;
  // A failure closed admission: work already queued in the slot is refused, not run.
  let failed = false;
  const refusesQueued = () => abandoned || failed;
  const release = stagedWriterRelease(input, () => abandoned);
  // One FIFO slot for canonical settlement and Conversation work.
  const slot = Semaphore.makeUnsafe(1);
  const conversations = new Set<Promise<unknown>>();
  let admissionClosed = false;
  let inFlight:
    | Readonly<{ key: string; result: Promise<CanonicalProjectCommandResult> }>
    | undefined;
  let requestedCloseTime = "";
  // The release time is the one given by the call that starts each close attempt.
  const closeOnce = retryableAttempt(() => {
    const time = requestedCloseTime;
    const pending = [inFlight?.result, ...conversations];
    return (async () => {
      // Drain only; the original result still rejects for every admitted caller.
      await Promise.allSettled(pending);
      await release(time);
    })();
  });
  const closeAttempt = (time: string): Promise<void> => {
    requestedCloseTime = time;
    return closeOnce();
  };
  const unavailable = { status: "writer-unavailable" } as const;
  // Conversation work in the slot, drained by close; refused once admission closes. Admitted
  // work that waited behind an abandonment or a failure is refused too; a plain close drains it.
  const tracked = <Outcome>(run: () => Promise<Outcome>): Promise<Outcome | typeof unavailable> => {
    if (admissionClosed) return Promise.resolve(unavailable);
    const outcome = inSlot(slot, async () => {
      if (refusesQueued()) return unavailable;
      try {
        return await run();
      } finally {
        // Resolved or rejected, an unfinished client is abandoned.
        if (input.repository.hasUnfinishedClient) {
          abandoned = true;
          admissionClosed = true;
        }
      }
    });
    conversations.add(outcome);
    const clear = () => {
      conversations.delete(outcome);
    };
    void outcome.then(clear, clear);
    return outcome;
  };
  const runSettlement = async (
    key: string,
    commandId: TypedCommand["commandId"],
  ): Promise<CanonicalProjectCommandResult> => {
    // A command queued behind an abandonment or a failure answers writer-unavailable (R2-C1).
    return inSlot(slot, async () => {
      if (refusesQueued()) return writerFailure(input, commandId, "writer-unavailable");
      try {
        return await settleWriterCommand(input, key, commandId);
      } catch (error) {
        // A busy owner is plain contention: retryable, and admission stays open.
        if (error instanceof WriterOwnerBusy)
          return writerFailure(input, commandId, "command-busy");
        // Closed while the permit is held, so no call can take the slot behind the failure.
        admissionClosed = true;
        failed = true;
        throw error;
      }
    });
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
    conversation: (work) => tracked(() => runConversationWork(input.repository, work)),
    conversationRead: (work) => tracked(() => runConversationRead(input.repository, work)),
    verifyFence: async () => {
      try {
        return await input.repository.verifyFence();
      } catch {
        return { status: "broken", code: "WRITER_FENCE_CHECK_FAILED" };
      }
    },
    close: (time) => {
      admissionClosed = true;
      return closeAttempt(time);
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

function stagedWriterRelease(input: CanonicalProjectWriterInput, isAbandoned: () => boolean) {
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
  // The abandoned client cannot release its fence; the next activation recovers it.
  const abandonClient = async () => {
    try {
      await input.repository.abandonClient();
    } catch (cause) {
      throw new CanonicalProjectWriterReleaseError("WRITER_REPOSITORY_CLOSE_FAILED", {
        cause: new Error("WRITER_CLIENT_ABANDON_FAILED", { cause }),
      });
    }
  };
  let stages: readonly ((time: string) => Promise<void>)[] | undefined;
  let completed = 0;
  return async (time: string) => {
    stages ??= isAbandoned()
      ? [abandonClient, releaseLease]
      : [releaseFence, closeRepository, releaseLease];
    for (const stage of stages.slice(completed)) {
      await stage(time);
      completed += 1;
    }
  };
}
