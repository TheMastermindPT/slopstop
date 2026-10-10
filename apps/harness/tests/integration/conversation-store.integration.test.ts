import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { executeStatement } from "../../src/conversation/conversation-rows.js";
import {
  readProjectConversation,
  readProjectConversationReadOnly,
  withReadOnlyClient,
} from "../../src/conversation/conversation-store.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  type ConversationSession,
  inConversationProject,
  rawCanonical,
  readConversation,
  saveOutcome,
} from "./conversation-writer-fixture.js";
import { generationPaths } from "./project-storage-open-fixture.js";
import {
  createRequest,
  projectStorageIntegrationTimeout,
} from "./project-storage-runtime-fixture.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Exact texts: surrounding spaces, CRLF, a tab and non-ASCII. */
const texts = ["  leading and trailing  ", "line one\r\nline two", "tab\there · ação 🌱"];

it(
  "saves and reads messages in order",
  () =>
    inConversationProject(async (session) => {
      for (const [index, text] of texts.entries()) {
        expect(
          await session.save({ saveId: randomUUID(), expectedRevision: index, text }),
        ).toMatchObject({
          status: "completed",
          result: { _tag: "Success", success: { cursor: index + 1, replayed: false } },
        });
      }
      const conversation = await readConversation(session);
      expect(conversation).toMatchObject({
        conversationId: expect.stringMatching(uuid),
        branchId: expect.stringMatching(uuid),
        revision: 3,
        nextCursor: null,
      });
      expect(conversation?.messages).toEqual(
        texts.map((text, index) => ({
          messageId: expect.stringMatching(uuid),
          cursor: index + 1,
          author: "user",
          text,
          savedAt: expect.stringMatching(instant),
        })),
      );
    }),
  projectStorageIntegrationTimeout * 2,
);

it(
  "returns the original result for an exact retry",
  () =>
    inConversationProject(async (session) => {
      const first = { saveId: randomUUID(), expectedRevision: 0, text: "first" };
      const original = await saveOutcome(session, first);
      await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 1, text: "second" });
      expect(await saveOutcome(session, first)).toEqual({ ...original, replayed: true });
      expect(await saveOutcome(session, { ...first, expectedRevision: 2 })).toEqual({
        ...original,
        replayed: true,
      });
      expect(await saveOutcome(session, { ...first, text: "other" })).toEqual({
        status: "rejected",
        code: "SAVE_ID_REUSED",
      });
      expect(await readConversation(session)).toMatchObject({ revision: 2 });
    }),
  projectStorageIntegrationTimeout * 2,
);

it(
  "reports a revision conflict",
  () =>
    inConversationProject(async (session) => {
      await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "first" });
      expect(
        await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "stale" }),
      ).toEqual({ status: "conflict", currentRevision: 1 });
      const conversation = await readConversation(session);
      expect(conversation?.messages.map((message) => message.text)).toEqual(["first"]);
    }),
  projectStorageIntegrationTimeout * 2,
);

/** Saves `count` more messages, one after another. */
async function saveMore(session: ConversationSession, from: number, count: number) {
  for (let revision = from; revision < from + count; revision += 1)
    await saveOutcome(session, {
      saveId: randomUUID(),
      expectedRevision: revision,
      text: `m${revision + 1}`,
    });
}

/** One page after `after` (exclusive; null from the start); a failed read fails the test. */
async function readPage(session: ConversationSession, after: number | null) {
  const read = await session.read(after);
  if (read.status !== "completed" || Result.isFailure(read.result))
    throw new Error(`Read failed: ${JSON.stringify(read)}`);
  return read.result.success.conversation;
}

/** Every page from the start: its size and `nextCursor`, following `nextCursor` until null. */
async function pages(session: ConversationSession) {
  const seen: [number, number | null][] = [];
  let after: number | null = null;
  do {
    const page: Awaited<ReturnType<typeof readPage>> = await readPage(session, after);
    after = page?.nextCursor ?? null;
    seen.push([page?.messages.length ?? 0, after]);
  } while (after !== null);
  return seen;
}

it(
  "pages by cursor",
  () =>
    inConversationProject(async (session) => {
      await saveMore(session, 0, 100);
      expect(await pages(session)).toEqual([[100, null]]);
      await saveMore(session, 100, 1);
      expect(await pages(session)).toEqual([
        [100, 100],
        [1, null],
      ]);
      await saveMore(session, 101, 100);
      expect(await pages(session)).toEqual([
        [100, 100],
        [100, 200],
        [1, null],
      ]);
      const after = await readPage(session, 100);
      expect(after?.messages[0]).toMatchObject({ cursor: 101, text: "m101" });
      expect(after).toMatchObject({ revision: 201 });
    }),
  projectStorageIntegrationTimeout * 6,
);

/** How many conversation and root-branch rows the Project database holds. */
function conversationRowCounts(root: string) {
  const database = new DatabaseSync(generationPaths(root).canonical, { readOnly: true });
  try {
    return database
      .prepare(
        `SELECT (SELECT count(*) FROM conversations) AS conversations,
          (SELECT count(*) FROM conversation_branches WHERE parent_branch_id IS NULL) AS roots`,
      )
      .get();
  } finally {
    database.close();
  }
}

it(
  "creates one conversation for two first saves",
  async () => {
    let root = "";
    await inConversationProject(async (session, projectRoot) => {
      root = projectRoot;
      const both = await Promise.all(
        ["one", "two"].map((text) =>
          saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text }),
        ),
      );
      expect(both).toMatchObject([
        { status: "saved", cursor: 1 },
        { status: "conflict", currentRevision: 1 },
      ]);
    });
    expect(conversationRowCounts(root)).toEqual({ conversations: 1, roots: 1 });
  },
  projectStorageIntegrationTimeout * 2,
);

const newerToken = "d".repeat(64);

/**
 * Moves the writer fence to a newer generation with another token, coherently, as a newer
 * writer would. The returned restore moves it back, so the activation releases normally.
 */
function moveWriterFence(root: string): () => void {
  let original: Record<string, unknown> = {};
  rawCanonical(root, (database) => {
    original =
      database.prepare("SELECT writer_generation, token_digest FROM writer_fence").get() ?? {};
    database
      .prepare(
        `INSERT INTO writer_generations (project_id, writer_generation, activation_id, token_digest,
          acquired_at, released_at)
        SELECT project_id, writer_generation + 1, ?, ?, activated_at, NULL FROM writer_fence`,
      )
      .run(randomUUID(), newerToken);
    database
      .prepare(
        "UPDATE writer_fence SET writer_generation = writer_generation + 1, token_digest = ?",
      )
      .run(newerToken);
  });
  return () =>
    rawCanonical(root, (database) => {
      database
        .prepare("UPDATE writer_fence SET writer_generation = ?, token_digest = ?")
        .run(Number(original["writer_generation"]), String(original["token_digest"]));
      database.prepare("DELETE FROM writer_generations WHERE token_digest = ?").run(newerToken);
    });
}

it(
  "refuses a save from a stale writer",
  () =>
    inConversationProject(async (session, root) => {
      const restore = moveWriterFence(root);
      try {
        expect(
          await session.save({ saveId: randomUUID(), expectedRevision: 0, text: "late" }),
        ).toEqual({ status: "stale-writer" });
        expect(await readConversation(session)).toBeNull();
      } finally {
        restore();
      }
    }),
  projectStorageIntegrationTimeout * 2,
);

const strayId = "00000000-0000-4000-8000-0000000000f1";

/** Raw SQL that leaves the Project conversation partial or undecodable, after one save or none. */
const partialStates = [
  {
    name: "a conversation without a root branch",
    saved: false,
    sql: `INSERT INTO conversations (conversation_id, project_id, scope_kind, waypoint_id, created_at)
      SELECT '${strayId}', project_id, 'project', NULL, '2026-10-09T10:00:00.000Z' FROM project_state`,
  },
  {
    name: "a cursor gap",
    saved: true,
    sql: `INSERT INTO conversation_messages SELECT '${strayId}', conversation_id, branch_id, 3,
        author, body, '${strayId}', save_fingerprint, saved_at FROM conversation_messages`,
  },
  {
    name: "a message on another branch",
    saved: true,
    sql: `INSERT INTO conversation_branches SELECT '${strayId}', conversation_id, branch_id,
        message_id, saved_at FROM conversation_messages;
      INSERT INTO conversation_messages SELECT '${randomUUID()}', conversation_id, '${strayId}', 1,
        author, body, '${randomUUID()}', save_fingerprint, saved_at FROM conversation_messages`,
  },
  {
    name: "an undecodable row",
    saved: true,
    sql: "PRAGMA ignore_check_constraints = ON; UPDATE conversation_messages SET saved_at = 'yesterday'",
  },
] as const;

it("reads a Project without messages as no conversation", () =>
  inConversationProject(async (session) => {
    expect(await readConversation(session)).toBeNull();
  }));

it.for(partialStates)(
  "never reads partial state as empty: $name",
  { timeout: projectStorageIntegrationTimeout * 2 },
  ({ saved, sql }) =>
    inConversationProject(async (session, root) => {
      if (saved)
        await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "kept" });
      rawCanonical(root, (database) => database.exec(sql));
      expect(await session.read()).toMatchObject({
        status: "completed",
        result: { _tag: "Failure", failure: { _tag: "ConversationStorageBroken" } },
      });
    }),
);

it(
  "reads the conversation through a per-request read-only client",
  async () => {
    let root = "";
    await inConversationProject(async (session, projectRoot) => {
      root = projectRoot;
      await saveMore(session, 0, 101);
    });
    const read = (after: number | null) =>
      Effect.runPromise(
        Effect.result(
          readProjectConversationReadOnly({
            canonicalDatabasePath: generationPaths(root).canonical,
            projectId: createRequest.projectId,
            after,
          }),
        ),
      );
    expect(await read(null)).toMatchObject({
      _tag: "Success",
      success: { conversation: { revision: 101, nextCursor: 100 } },
    });
    expect(await read(100)).toMatchObject({
      _tag: "Success",
      success: { conversation: { messages: [{ cursor: 101, text: "m101" }], nextCursor: null } },
    });
  },
  projectStorageIntegrationTimeout * 4,
);

it(
  "keeps a defect in Conversation work a defect, on save and read",
  () =>
    inConversationProject(async (session) => {
      const writer = session.control.currentWriter();
      const bug = new Error("Conversation work defect.");
      await expect(writer.conversation(() => Effect.die(bug))).rejects.toBe(bug);
      await expect(writer.conversationRead(() => Effect.die(bug))).rejects.toBe(bug);
      expect(
        await session.save({ saveId: randomUUID(), expectedRevision: 0, text: "after a defect" }),
      ).toMatchObject({ status: "completed", result: { _tag: "Success" } });
    }),
  projectStorageIntegrationTimeout,
);

it(
  "opens the per-request client read-only and stores the pinned save fingerprint (T10)",
  async () => {
    let root = "";
    await inConversationProject(async (session, projectRoot) => {
      root = projectRoot;
      await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "pinned" });
    });
    const canonicalDatabasePath = generationPaths(root).canonical;
    const write = await Effect.runPromise(
      Effect.result(
        withReadOnlyClient({ canonicalDatabasePath }, (client) =>
          executeStatement(client, { sql: "DELETE FROM conversation_messages", args: [] }),
        ),
      ),
    );
    expect(write).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ConversationStorageBroken" },
    });
    const expected = createHash("sha256")
      .update(
        `{"projectId":${JSON.stringify(createRequest.projectId)},"scope":"project","text":"pinned"}`,
      )
      .digest("hex");
    const database = new DatabaseSync(canonicalDatabasePath, { readOnly: true });
    try {
      expect(
        database.prepare("SELECT save_fingerprint AS fingerprint FROM conversation_messages").all(),
      ).toEqual([{ fingerprint: expected }]);
    } finally {
      database.close();
    }
  },
  projectStorageIntegrationTimeout,
);

/** A read-only client that records its statements and fails the stages named in `failing`. */
function recordingReadOnlyClient(failing: ReadonlySet<"ROLLBACK" | "close">) {
  const statements: string[] = [];
  const open = (databasePath: string): LocalLibsqlClient => {
    const client = createWorkerLocalLibsqlClient(databasePath, "generation", { readOnly: true });
    return {
      execute: (statement, args) => {
        const sql = typeof statement === "string" ? statement : statement.sql;
        statements.push(sql);
        if (sql === "ROLLBACK" && failing.has("ROLLBACK"))
          return Promise.reject(new Error("Injected rollback failure."));
        return client.execute(statement, args);
      },
      transaction: (mode) => client.transaction(mode),
      close: () =>
        failing.has("close")
          ? client.close().then(() => Promise.reject(new Error("Injected close failure.")))
          : client.close(),
    };
  };
  return { statements, open };
}

it(
  "ends the read-only read with ROLLBACK and types its rollback and close failures",
  async () => {
    let root = "";
    await inConversationProject(async (session, projectRoot) => {
      root = projectRoot;
      await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "kept" });
    });
    const read = (failing: ReadonlySet<"ROLLBACK" | "close">) => {
      const recording = recordingReadOnlyClient(failing);
      return Effect.runPromise(
        Effect.result(
          withReadOnlyClient(
            {
              canonicalDatabasePath: generationPaths(root).canonical,
              openReadOnlyClient: recording.open,
            },
            (client) =>
              readProjectConversation(client, { projectId: createRequest.projectId, after: null }),
          ),
        ),
      ).then((result) => ({ result, statements: recording.statements }));
    };
    const clean = await read(new Set());
    expect(clean.result).toMatchObject({ _tag: "Success" });
    expect(clean.statements.at(1)).toBe("BEGIN");
    expect(clean.statements.at(-1)).toBe("ROLLBACK");
    for (const stage of ["ROLLBACK", "close"] as const)
      expect((await read(new Set([stage]))).result).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "ConversationStorageBroken" },
      });
  },
  projectStorageIntegrationTimeout,
);
