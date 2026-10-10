import {
  decodeStrict,
  type ProjectConversationReadRequest,
  type ProjectConversationReadResult,
  ProjectConversationReadResultSchema,
  type ProjectConversationSaveRequest,
  type ProjectConversationSaveResult,
  ProjectConversationSaveResultSchema,
  type ProjectId,
  projectConversationDiagnostics as rows,
} from "@slopstop/protocol";
import { Effect, Result } from "effect";
import type { ActiveWorkAdmission, ActiveWorkRefusal } from "./active-work-admission.js";
import type { CanonicalProjectWriter } from "./canonical-project-writer.js";
import type { ConversationStorageFailure } from "./conversation/conversation-errors.js";
import {
  type ConversationCommitUncertain,
  saveConversationMessage,
} from "./conversation/conversation-save.js";
import {
  type ProjectConversationPage,
  readProjectConversation,
  type SaveProjectMessageOutcome,
} from "./conversation/conversation-store.js";
import type { LocalLibsqlClient } from "./storage/local-libsql-worker-client.js";

/** The activation conversation work runs against. */
export type ConversationActivation = Readonly<{ canonicalDatabasePath: string }> &
  (
    | Readonly<{ access: "read-only" }>
    | Readonly<{
        access: "read-write";
        writer: Pick<CanonicalProjectWriter, "conversation" | "conversationRead">;
      }>
  );

/** What the conversation programs need besides the activation. */
export type ConversationPorts = Readonly<{
  createId(): string;
  now(): string;
  /** Reads one page through a per-request read-only client. */
  readConversationReadOnly(
    input: Readonly<{ canonicalDatabasePath: string; projectId: ProjectId; after: number | null }>,
  ): Effect.Effect<ProjectConversationPage, ConversationStorageFailure>;
  /** Opens the save reconciliation's read-only client (default: the generation pool). */
  openReconciliationClient?: (databasePath: string) => LocalLibsqlClient;
}>;

/** The conversation row of each admission refusal. */
const refusalRows = {
  "coordinator-unavailable": rows.coordinatorUnavailable,
  inactive: rows.inactive,
  "project-mismatch": rows.projectMismatch,
  "stale-activation": rows.staleActivation,
  "read-only": rows.readOnly,
} as const satisfies Record<ActiveWorkRefusal, unknown>;

/** A storage failure as its result status and row. */
function storageFailure(failure: Readonly<{ _tag: string }>) {
  return failure._tag === "ConversationStorageBusy"
    ? { status: "unavailable", diagnostic: rows.storageUnavailable }
    : { status: "broken", diagnostic: rows.storageBroken };
}

/** The store's page as the protocol's conversation. */
function conversationOf(page: ProjectConversationPage) {
  const conversation = page.conversation;
  if (conversation === null) return null;
  return {
    conversationId: conversation.conversationId,
    branchId: conversation.branchId,
    revision: conversation.revision,
    messages: conversation.messages.map((stored) => ({
      conversationMessageId: stored.messageId,
      cursor: stored.cursor,
      author: stored.author,
      text: stored.text,
      savedAt: stored.savedAt,
    })),
    nextCursor: conversation.nextCursor,
  };
}

/** One page through the per-request read-only client on the activation's database. */
function readOnlyPage(
  activation: ConversationActivation,
  request: ProjectConversationReadRequest,
  ports: ConversationPorts,
) {
  return Effect.result(
    ports.readConversationReadOnly({
      canonicalDatabasePath: activation.canonicalDatabasePath,
      projectId: request.projectId,
      after: request.after,
    }),
  );
}

/**
 * One page read through the writer's slot or, on a read-only activation or when the writer
 * refuses the read in its slot (its admission closed, G17/G18), through the per-request
 * read-only client.
 */
const readPage = Effect.fn("readPage")(function* (
  activation: ConversationActivation,
  request: ProjectConversationReadRequest,
  ports: ConversationPorts,
) {
  if (activation.access === "read-only") return yield* readOnlyPage(activation, request, ports);
  const writer = activation.writer;
  const outcome = yield* Effect.promise(() =>
    writer.conversationRead((tx) =>
      readProjectConversation(tx, { projectId: request.projectId, after: request.after }),
    ),
  );
  if (outcome.status === "completed") return outcome.result;
  return yield* readOnlyPage(activation, request, ports);
});

/** Reads one conversation page for admitted work, or answers the refusal. */
export const readConversation = Effect.fn("readConversation")(function* (
  admission: ActiveWorkAdmission<ConversationActivation>,
  request: ProjectConversationReadRequest,
  ports: ConversationPorts,
) {
  const answer = (fields: object): ProjectConversationReadResult =>
    decodeStrict(ProjectConversationReadResultSchema, { ...fields, request });
  if (admission.status === "refused")
    return answer({ status: admission.refusal, diagnostic: refusalRows[admission.refusal] });
  const result = yield* readPage(admission.activation, request, ports);
  if (Result.isFailure(result)) return answer(storageFailure(result.failure));
  return answer({ status: "read", conversation: conversationOf(result.success) });
});

/** Saves one message for admitted work, or answers the refusal. */
export const saveConversation = Effect.fn("saveConversation")(function* (
  admission: ActiveWorkAdmission<ConversationActivation>,
  request: ProjectConversationSaveRequest,
  ports: ConversationPorts,
) {
  const answer = (fields: object): ProjectConversationSaveResult =>
    decodeStrict(ProjectConversationSaveResultSchema, { ...fields, request });
  if (admission.status === "refused")
    return answer({ status: admission.refusal, diagnostic: refusalRows[admission.refusal] });
  const activation = admission.activation;
  if (activation.access === "read-only")
    return answer({ status: "read-only", diagnostic: rows.readOnly });
  const outcome = yield* saveConversationMessage({
    writer: activation.writer,
    canonicalDatabasePath: activation.canonicalDatabasePath,
    message: {
      projectId: request.projectId,
      saveId: request.saveId,
      expectedRevision: request.expectedRevision,
      text: request.text,
    },
    dependencies: { createId: ports.createId, now: ports.now },
    ...(ports.openReconciliationClient === undefined
      ? {}
      : { openReadOnlyClient: ports.openReconciliationClient }),
  });
  if (outcome.status === "writer-unavailable")
    return answer({ status: "writer-unavailable", diagnostic: rows.writerUnavailable });
  if (outcome.status === "stale-writer")
    return answer({ status: "stale-writer", diagnostic: rows.staleWriter });
  // The writer's answer, or the reconciliation's after an uncertain commit.
  const result: Result.Result<
    SaveProjectMessageOutcome,
    ConversationStorageFailure | ConversationCommitUncertain
  > = outcome.result;
  if (Result.isFailure(result))
    return result.failure._tag === "ConversationCommitUncertain"
      ? answer({ status: "uncertain", diagnostic: rows.saveUnconfirmed })
      : answer(storageFailure(result.failure));
  const saved = result.success;
  if (saved.status === "conflict")
    return answer({ status: "conflict", currentRevision: saved.currentRevision });
  if (saved.status === "rejected")
    return answer({ status: "rejected", diagnostic: rows.saveIdReused });
  return answer({
    status: "saved",
    conversationMessageId: saved.messageId,
    cursor: saved.cursor,
    revision: saved.revision,
    savedAt: saved.savedAt,
    replayed: saved.replayed,
  });
});
