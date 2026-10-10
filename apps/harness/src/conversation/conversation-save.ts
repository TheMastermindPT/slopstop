import { Data, Effect } from "effect";
import type { CanonicalProjectWriter } from "../canonical-project-writer.js";
import type { LocalLibsqlClient } from "../storage/local-libsql-worker-client.js";
import { ConversationStorageBusy } from "./conversation-errors.js";
import {
  type ConversationStoreDependencies,
  priorSave,
  type SaveProjectMessageInput,
  saveFingerprint,
  saveProjectMessage,
  withReadOnlyClient,
} from "./conversation-store.js";

/** The commit's outcome could not be confirmed: the reconciliation read failed. Retryable. */
export class ConversationCommitUncertain extends Data.TaggedError("ConversationCommitUncertain")<{
  readonly cause: unknown;
}> {}

export type ConversationSaveInput = Readonly<{
  writer: CanonicalProjectWriter;
  canonicalDatabasePath: string;
  message: SaveProjectMessageInput;
  dependencies: ConversationStoreDependencies;
  /** Opens the reconciliation's read-only client (default: the generation pool). */
  openReadOnlyClient?: (databasePath: string) => LocalLibsqlClient;
}>;

/**
 * After an uncertain commit, the save's answer from a separate read-only connection (G6): the
 * row present is saved; absent was not saved and is safe to resend (busy); a failed read is
 * uncertain.
 */
const reconcileSave = (input: ConversationSaveInput) =>
  withReadOnlyClient(input, (client) =>
    priorSave(client, input.message.saveId, saveFingerprint(input.message)),
  ).pipe(
    Effect.mapError((cause) => new ConversationCommitUncertain({ cause })),
    Effect.flatMap((found) =>
      found === undefined
        ? Effect.fail(new ConversationStorageBusy({ cause: "The save was not committed." }))
        : Effect.succeed(found.status === "saved" ? { ...found, replayed: false } : found),
    ),
  );

/**
 * Saves one message through the writer's slot and reconciles an uncertain commit by its save
 * id. A new identity is never minted: a resend with the same save id converges.
 */
export const saveConversationMessage = Effect.fn("saveConversationMessage")(function* (
  input: ConversationSaveInput,
) {
  const outcome = yield* Effect.promise(() =>
    input.writer.conversation((tx) => saveProjectMessage(tx, input.message, input.dependencies)),
  );
  if (outcome.status !== "commit-uncertain") return outcome;
  return { status: "completed", result: yield* Effect.result(reconcileSave(input)) } as const;
});
