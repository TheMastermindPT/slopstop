import { Data } from "effect";
import { isSqliteBusy } from "../storage/sqlite-busy.js";

/** Another connection holds the Project database past the bounded wait; retryable. */
export class ConversationStorageBusy extends Data.TaggedError("ConversationStorageBusy")<{
  readonly cause: unknown;
}> {}

/** The Project database could not be read or written safely; never reported as empty. */
export class ConversationStorageBroken extends Data.TaggedError("ConversationStorageBroken")<{
  readonly cause: unknown;
}> {}

export type ConversationStorageFailure = ConversationStorageBusy | ConversationStorageBroken;

/** A storage failure classified once: SQLite BUSY/LOCKED is busy, everything else is broken (G7). */
export function conversationStorageFailure(cause: unknown): ConversationStorageFailure {
  return isSqliteBusy(cause)
    ? new ConversationStorageBusy({ cause })
    : new ConversationStorageBroken({ cause });
}
