import { Cause, Effect, Exit, Option, Result } from "effect";
import {
  ConversationStorageBroken,
  ConversationStorageBusy,
  type ConversationStorageFailure,
  conversationStorageFailure,
} from "./conversation/conversation-errors.js";
import {
  type CanonicalCommandRepository,
  type FencedConversationWork,
  WriterOwnerBusy,
} from "./storage/canonical-command-repository.js";
import type { LocalLibsqlTransaction } from "./storage/local-libsql-worker-client.js";
import type { ClassifiedWriteTransactionOutcome } from "./storage/project-storage-transaction.js";

/** Conversation work inside one write transaction on the writer's client. */
export type ConversationWork<Value, Failure> = (
  tx: LocalLibsqlTransaction,
) => Effect.Effect<Value, Failure>;

export type ConversationWorkOutcome<Value, Failure> =
  | Readonly<{
      status: "completed";
      result: Result.Result<Value, Failure | ConversationStorageFailure>;
    }>
  | Readonly<{ status: "writer-unavailable" }>;

/**
 * The commit's outcome is unknown: it failed or was classified uncertain, or the close after it
 * failed. The caller reconciles on a separate connection (G6).
 */
type ConversationCommitUncertainOutcome = Readonly<{ status: "commit-uncertain" }>;

export type ConversationWriteOutcome<Value, Failure> =
  | ConversationWorkOutcome<Value, Failure>
  | Readonly<{ status: "stale-writer" }>
  | ConversationCommitUncertainOutcome;

/** The work's typed failure, carried out of the transaction body so the body rolls back. */
class ConversationWorkFailed<Failure> {
  constructor(readonly failure: Failure) {}
}

/** The work's defect or interruption, carried out of the body so it is rethrown unclassified. */
class ConversationWorkDefect {
  constructor(readonly cause: Cause.Cause<unknown>) {}
}

/** The work as a transaction body: any failure throws, so the body rolls back. */
function transactionBody<Value, Failure>(work: ConversationWork<Value, Failure>) {
  return async (tx: LocalLibsqlTransaction): Promise<Value> => {
    const exit = await Effect.runPromiseExit(work(tx));
    if (Exit.isSuccess(exit)) return exit.value;
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure)) throw new ConversationWorkFailed(failure.value);
    throw new ConversationWorkDefect(exit.cause);
  };
}

/**
 * The classified transaction outcome as the work's own result. A failure before the commit
 * (begin, or the body outside the work) is classified storage; a commit or close failure leaves
 * the commit uncertain.
 */
function workResult<Value, Failure>(
  outcome: ClassifiedWriteTransactionOutcome<Value>,
): Result.Result<Value, Failure | ConversationStorageFailure> | ConversationCommitUncertainOutcome {
  if (outcome.status === "succeeded") return Result.succeed(outcome.result);
  // Defects stay defects: the facade rejects with them, never a storage failure.
  if (outcome.stage === "body" && outcome.primaryError instanceof ConversationWorkDefect)
    throw Cause.squash(outcome.primaryError.cause);
  if (outcome.stage === "body" && outcome.error instanceof ConversationWorkFailed)
    return Result.fail(outcome.error.failure as Failure);
  if (outcome.commit === "not-attempted")
    return Result.fail(conversationStorageFailure(outcome.primaryError));
  return { status: "commit-uncertain" };
}

/** Runs one repository call; a busy owner is plain contention (unreachable through the slot). */
async function ownedTransaction<Value>(
  run: () => Promise<ClassifiedWriteTransactionOutcome<Value>>,
): Promise<ClassifiedWriteTransactionOutcome<Value> | ConversationStorageBusy> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof WriterOwnerBusy) return new ConversationStorageBusy({ cause: error });
    throw error;
  }
}

export async function runConversationWork<Value, Failure>(
  repository: CanonicalCommandRepository,
  work: ConversationWork<Value, Failure>,
): Promise<ConversationWriteOutcome<Value, Failure>> {
  const owned = await ownedTransaction(() =>
    repository.conversationTransaction(transactionBody(work)),
  );
  if (owned instanceof ConversationStorageBusy)
    return { status: "completed", result: Result.fail(owned) };
  const fenced = workResult<FencedConversationWork<Value>, Failure>(owned);
  if ("status" in fenced) return fenced;
  if (Result.isFailure(fenced)) return { status: "completed", result: Result.fail(fenced.failure) };
  if (fenced.success.status === "stale-writer") return { status: "stale-writer" };
  return { status: "completed", result: Result.succeed(fenced.success.result) };
}

export async function runConversationRead<Value, Failure>(
  repository: CanonicalCommandRepository,
  work: ConversationWork<Value, Failure>,
): Promise<ConversationWorkOutcome<Value, Failure>> {
  const owned = await ownedTransaction(() => repository.conversationRead(transactionBody(work)));
  if (owned instanceof ConversationStorageBusy)
    return { status: "completed", result: Result.fail(owned) };
  const result = workResult<Value, Failure>(owned);
  // A read commits nothing; a failed close still leaves the client unknown, so it is broken.
  if ("status" in result)
    return {
      status: "completed",
      result: Result.fail(new ConversationStorageBroken({ cause: "The read did not close." })),
    };
  return { status: "completed", result };
}
