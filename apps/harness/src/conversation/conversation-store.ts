import type { ProjectId } from "@slopstop/protocol";
import { Effect } from "effect";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../storage/local-libsql-worker-client.js";
import {
  ConversationStorageBroken,
  type ConversationStorageFailure,
  conversationStorageFailure,
} from "./conversation-errors.js";
import {
  BranchRowSchema,
  BranchShapeRowSchema,
  type ConversationExecutor,
  ConversationRowSchema,
  executeStatement,
  type MessageRow,
  MessageRowSchema,
  SavedRowSchema,
  selectRows,
} from "./conversation-rows.js";

export type ConversationStoreDependencies = Readonly<{
  createId(): string;
  now(): string;
}>;

export type SaveProjectMessageInput = Readonly<{
  projectId: ProjectId;
  saveId: string;
  expectedRevision: number;
  text: string;
}>;

export type SaveProjectMessageOutcome =
  | Readonly<{
      status: "saved";
      messageId: string;
      cursor: number;
      revision: number;
      savedAt: string;
      replayed: boolean;
    }>
  | Readonly<{ status: "conflict"; currentRevision: number }>
  | Readonly<{ status: "rejected"; code: "SAVE_ID_REUSED" }>;

export type ProjectConversationPage = Readonly<{
  conversation: Readonly<{
    conversationId: string;
    branchId: string;
    revision: number;
    messages: readonly MessageRow[];
    nextCursor: number | null;
  }> | null;
}>;

/** Messages per read page. */
const pageSize = 100;

type ProjectBranch = Readonly<{ conversationId: string; branchId: string; revision: number }>;

/** The Project conversation's root branch and its revision, or `undefined` before the first save. */
const findProjectBranch = Effect.fn("findProjectBranch")(function* (
  tx: ConversationExecutor,
  projectId: ProjectId,
): Effect.fn.Return<ProjectBranch | undefined, ConversationStorageFailure> {
  const [conversation] = yield* selectRows(
    tx,
    {
      sql: "SELECT conversation_id AS conversationId FROM conversations WHERE project_id = ? AND scope_kind = 'project'",
      args: [projectId],
    },
    ConversationRowSchema,
  );
  if (conversation === undefined) return undefined;
  const [branch] = yield* selectRows(
    tx,
    {
      sql: "SELECT branch_id AS branchId FROM conversation_branches WHERE conversation_id = ? AND parent_branch_id IS NULL",
      args: [conversation.conversationId],
    },
    BranchRowSchema,
  );
  if (branch === undefined)
    return yield* new ConversationStorageBroken({ cause: "The conversation has no root branch." });
  const [shape] = yield* selectRows(
    tx,
    {
      sql: `SELECT count(*) AS total, coalesce(max(cursor), 0) AS revision,
          (SELECT count(*) FROM conversation_messages WHERE conversation_id = ? AND branch_id <> ?)
            AS stray
        FROM conversation_messages WHERE branch_id = ?`,
      args: [conversation.conversationId, branch.branchId, branch.branchId],
    },
    BranchShapeRowSchema,
  );
  const contiguous = shape !== undefined && shape.total === shape.revision && shape.stray === 0;
  if (!contiguous)
    return yield* new ConversationStorageBroken({ cause: "The conversation is not contiguous." });
  return {
    conversationId: conversation.conversationId,
    branchId: branch.branchId,
    revision: shape.revision,
  };
});

/** Creates the Project conversation and its root branch on the first save (G4). */
const createProjectBranch = Effect.fn("createProjectBranch")(function* (
  tx: ConversationExecutor,
  projectId: ProjectId,
  dependencies: ConversationStoreDependencies,
): Effect.fn.Return<ProjectBranch, ConversationStorageFailure> {
  const conversationId = dependencies.createId();
  const branchId = dependencies.createId();
  const createdAt = dependencies.now();
  yield* executeStatement(tx, {
    sql: "INSERT INTO conversations (conversation_id, project_id, scope_kind, waypoint_id, created_at) VALUES (?, ?, 'project', NULL, ?)",
    args: [conversationId, projectId, createdAt],
  });
  yield* executeStatement(tx, {
    sql: "INSERT INTO conversation_branches (branch_id, conversation_id, parent_branch_id, fork_message_id, created_at) VALUES (?, ?, NULL, NULL, ?)",
    args: [branchId, conversationId, createdAt],
  });
  return { conversationId, branchId, revision: 0 };
});

/** The saved row for `saveId`, answered as its original result or as a reuse. */
export const priorSave = Effect.fn("priorSave")(function* (
  tx: ConversationExecutor,
  saveId: string,
  fingerprint: string,
): Effect.fn.Return<SaveProjectMessageOutcome | undefined, ConversationStorageFailure> {
  const [saved] = yield* selectRows(
    tx,
    {
      sql: `SELECT message_id AS messageId, cursor, saved_at AS savedAt,
          save_fingerprint AS fingerprint
        FROM conversation_messages WHERE save_id = ?`,
      args: [saveId],
    },
    SavedRowSchema,
  );
  if (saved === undefined) return undefined;
  if (saved.fingerprint !== fingerprint) return { status: "rejected", code: "SAVE_ID_REUSED" };
  const { messageId, cursor, savedAt } = saved;
  return { status: "saved", messageId, cursor, revision: cursor, savedAt, replayed: true };
});

/** The fingerprint an exact retry must repeat: Project, scope and text, never the activation. */
export function saveFingerprint(input: Pick<SaveProjectMessageInput, "projectId" | "text">) {
  return hashCanonicalJson({ projectId: input.projectId, scope: "project", text: input.text });
}

/**
 * Saves one user message in the Project conversation, in the caller's write transaction:
 * identity first (an exact retry or a reuse), then the revision, then the append (G5).
 */
export const saveProjectMessage = Effect.fn("saveProjectMessage")(function* (
  tx: ConversationExecutor,
  input: SaveProjectMessageInput,
  dependencies: ConversationStoreDependencies,
): Effect.fn.Return<SaveProjectMessageOutcome, ConversationStorageFailure> {
  const fingerprint = saveFingerprint(input);
  const prior = yield* priorSave(tx, input.saveId, fingerprint);
  if (prior !== undefined) return prior;
  const existing = yield* findProjectBranch(tx, input.projectId);
  const currentRevision = existing?.revision ?? 0;
  if (input.expectedRevision !== currentRevision) return { status: "conflict", currentRevision };
  const branch = existing ?? (yield* createProjectBranch(tx, input.projectId, dependencies));
  const cursor = currentRevision + 1;
  const messageId = dependencies.createId();
  const savedAt = dependencies.now();
  yield* executeStatement(tx, {
    sql: `INSERT INTO conversation_messages (message_id, conversation_id, branch_id, cursor, author,
        body, save_id, save_fingerprint, saved_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`,
    args: [
      messageId,
      branch.conversationId,
      branch.branchId,
      cursor,
      input.text,
      input.saveId,
      fingerprint,
      savedAt,
    ],
  });
  return { status: "saved", messageId, cursor, revision: cursor, savedAt, replayed: false };
});

/** One page of the Project conversation after `after` (exclusive), in cursor order. */
export const readProjectConversation = Effect.fn("readProjectConversation")(function* (
  tx: ConversationExecutor,
  input: Readonly<{ projectId: ProjectId; after: number | null }>,
): Effect.fn.Return<ProjectConversationPage, ConversationStorageFailure> {
  const branch = yield* findProjectBranch(tx, input.projectId);
  if (branch === undefined) return { conversation: null };
  const rows = yield* selectRows(
    tx,
    {
      sql: `SELECT message_id AS messageId, cursor, author, body AS text, saved_at AS savedAt
        FROM conversation_messages WHERE branch_id = ? AND cursor > ? ORDER BY cursor LIMIT ?`,
      args: [branch.branchId, input.after ?? 0, pageSize + 1],
    },
    MessageRowSchema,
  );
  const messages = rows.slice(0, pageSize);
  return {
    conversation: {
      conversationId: branch.conversationId,
      branchId: branch.branchId,
      revision: branch.revision,
      messages,
      nextCursor: rows.length > pageSize ? (messages.at(-1)?.cursor ?? null) : null,
    },
  };
});

/** The read-only client's bounded wait for another process's commit (R2-C4). */
const readOnlyBusyTimeoutMs = 2000;

/** Opens a read-only client on the generation pool. */
function openGenerationReadOnlyClient(databasePath: string): LocalLibsqlClient {
  return createWorkerLocalLibsqlClient(databasePath, "generation", { readOnly: true });
}

type ReadOnlyProgram<Value> = (
  client: ConversationExecutor,
) => Effect.Effect<Value, ConversationStorageFailure>;

/** One read transaction with a bounded busy wait; a failed rollback fails the read. */
const readTransaction = <Value>(client: LocalLibsqlClient, program: ReadOnlyProgram<Value>) =>
  executeStatement(client, {
    sql: `PRAGMA busy_timeout = ${readOnlyBusyTimeoutMs}`,
    args: [],
  }).pipe(
    Effect.andThen(
      Effect.acquireUseRelease(
        executeStatement(client, { sql: "BEGIN", args: [] }),
        () => program(client),
        () => executeStatement(client, { sql: "ROLLBACK", args: [] }),
      ),
    ),
  );

/**
 * Runs `program` on a short-lived read-only client, in one read transaction. A failed open or
 * close is a typed storage failure, never a defect: the client's state is then unknown.
 */
export const withReadOnlyClient = <Value>(
  input: Readonly<{
    canonicalDatabasePath: string;
    openReadOnlyClient?: (databasePath: string) => LocalLibsqlClient;
  }>,
  program: ReadOnlyProgram<Value>,
): Effect.Effect<Value, ConversationStorageFailure> => {
  const open = input.openReadOnlyClient ?? openGenerationReadOnlyClient;
  return Effect.acquireUseRelease(
    Effect.try({ try: () => open(input.canonicalDatabasePath), catch: conversationStorageFailure }),
    (client) => readTransaction(client, program),
    (client) =>
      Effect.tryPromise({
        try: () => client.close(),
        catch: (cause) => new ConversationStorageBroken({ cause }),
      }),
  );
};

/**
 * Reads one page through a short-lived read-only client, for a read-only activation or a
 * writer whose admission closed.
 */
export const readProjectConversationReadOnly = (
  input: Readonly<{ canonicalDatabasePath: string; projectId: ProjectId; after: number | null }>,
): Effect.Effect<ProjectConversationPage, ConversationStorageFailure> =>
  withReadOnlyClient(input, (client) => readProjectConversation(client, input));
