import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { readProjectConversationReadOnly } from "../../src/conversation/conversation-store.js";
import {
  type ConversationSession,
  canonicalSnapshot,
  exclusiveLock,
  failedWith,
  inConversationProject,
  readConversation,
  readOnlyClientOpenHooks,
  reopenConversationProject,
  timed,
} from "./conversation-writer-fixture.js";
import { generationPaths } from "./project-storage-open-fixture.js";
import { createRequest } from "./project-storage-runtime-fixture.js";
import {
  orderedRows,
  writerClientCloses,
  writerClientFaults,
} from "./project-storage-upgrade-fixture.js";

/** Another connection's open read transaction: its SHARED lock blocks a COMMIT. */
function sharedReader(root: string) {
  const database = new DatabaseSync(generationPaths(root).canonical, { readOnly: true });
  database.exec("BEGIN");
  database.prepare("SELECT count(*) FROM conversations").get();
  return {
    release: () => {
      database.exec("COMMIT");
      database.close();
    },
  };
}

const unpinned = { pinCanonical: false } as const;
const message = (saveId: string) => ({ saveId, expectedRevision: 0, text: "uncertain" });

function readOnly(root: string) {
  return Effect.runPromise(
    Effect.result(
      readProjectConversationReadOnly({
        canonicalDatabasePath: generationPaths(root).canonical,
        projectId: createRequest.projectId,
        after: null,
      }),
    ),
  );
}

async function readOnlyTexts(root: string) {
  const read = await readOnly(root);
  if (Result.isFailure(read)) throw new Error("Read-only read failed.");
  return read.success.conversation?.messages.map((stored) => stored.text) ?? [];
}

it("reconciles an uncertain commit by its save id: known client state", () =>
  inConversationProject(async (session, root) => {
    const before = canonicalSnapshot(root);
    const saveId = randomUUID();
    const reader = sharedReader(root);
    let blocked: Awaited<ReturnType<ConversationSession["save"]>>;
    try {
      ({ value: blocked } = await timed("B10(a) save with a commit blocked by a reader", () =>
        session.save(message(saveId)),
      ));
    } finally {
      reader.release();
    }
    expect(blocked).toMatchObject(failedWith("ConversationStorageBusy"));
    expect(await session.save(message(saveId))).toMatchObject({
      status: "completed",
      result: { _tag: "Success", success: { status: "saved", cursor: 1, replayed: false } },
    });
    expect(await readOnlyTexts(root)).toEqual(["uncertain"]);
    expect(canonicalSnapshot(root)).toEqual(before);
    expect(await session.submitNote("after the uncertain commit")).toMatchObject({
      status: "settled",
    });
  }, unpinned));

/** Saves with a failed close after the acknowledged commit, a command and a save queued behind it. */
async function abandonOnSave(session: ConversationSession, saveId: string) {
  writerClientFaults.push({ match: /^close$/, error: new Error("Injected close failure.") });
  const saving = session.save(message(saveId));
  const queued = session.submitNote("queued behind the failing save");
  const queuedSave = session.save(message(randomUUID()));
  const saved = await saving;
  expect(saved).toMatchObject({
    status: "completed",
    result: { _tag: "Success", success: { status: "saved", cursor: 1, replayed: false } },
  });
  expect(await queued).toMatchObject({
    status: "writer-unavailable",
    diagnostic: { code: "WRITER_UNAVAILABLE" },
  });
  expect(await queuedSave).toEqual({ status: "writer-unavailable" });
  expect(await session.submitNote("after abandonment")).toMatchObject({
    status: "writer-unavailable",
  });
  expect(await session.save(message(randomUUID()))).toEqual({ status: "writer-unavailable" });
}

function abandonedFenceRecoveries(root: string) {
  return orderedRows({
    databasePath: generationPaths(root).canonical,
    table: "writer_recovery_records",
  }).filter((row) => (row as Record<string, unknown>)["reason"] === "abandoned-active-fence");
}

/** Switches to the same Project; the abandoned client's raw close runs exactly once (T1). */
async function switchReleasingAbandonedClient(session: ConversationSession, root: string) {
  const closes = writerClientCloses.count;
  expect(await session.control.switchToSelf()).toMatchObject({
    status: "target-result",
    sourceReleased: true,
    target: { status: "active", access: "read-write" },
  });
  expect(writerClientCloses.count).toBe(closes + 1);
  expect(abandonedFenceRecoveries(root)).toHaveLength(1);
}

it("reconciles an uncertain commit by its save id: unknown client state, then a switch", () =>
  inConversationProject(async (session, root) => {
    const before = canonicalSnapshot(root);
    const saveId = randomUUID();
    await abandonOnSave(session, saveId);
    expect(await readOnlyTexts(root)).toEqual(["uncertain"]);
    expect(canonicalSnapshot(root)).toEqual(before);
    await switchReleasingAbandonedClient(session, root);
    expect(await session.save(message(saveId))).toMatchObject({
      status: "completed",
      result: { _tag: "Success", success: { status: "saved", cursor: 1, replayed: true } },
    });
  }, unpinned));

it("reconciles an uncertain commit by its save id: unknown client state, then a stop", async () => {
  let projectRoot = "";
  await inConversationProject(async (session, root) => {
    projectRoot = root;
    const before = canonicalSnapshot(root);
    await abandonOnSave(session, randomUUID());
    const closes = writerClientCloses.count;
    await session.control.stop();
    expect(writerClientCloses.count).toBe(closes + 1);
    expect(canonicalSnapshot(root)).toEqual(before);
  }, unpinned);
  // The fixture activates read-write again or fails.
  await reopenConversationProject(projectRoot, async (session) => {
    expect(abandonedFenceRecoveries(projectRoot)).toHaveLength(1);
    expect(await readConversation(session)).toMatchObject({ revision: 1 });
  });
});

it("releases a truly broken client that holds its write lock, then a switch (U1)", () =>
  inConversationProject(async (session, root) => {
    const before = canonicalSnapshot(root);
    const saveId = randomUUID();
    // The commit, its rollback and the close all fail without running: the insert stays
    // uncommitted and the client keeps its write lock.
    for (const stage of ["commit", "rollback", "close"])
      writerClientFaults.push({
        match: new RegExp(`^${stage}$`),
        error: new Error(`Injected ${stage} failure.`),
      });
    expect(await session.save(message(saveId))).toMatchObject(
      failedWith("ConversationStorageBusy"),
    );
    expect(await session.save(message(randomUUID()))).toEqual({ status: "writer-unavailable" });
    expect(await readOnlyTexts(root)).toEqual([]);
    expect(canonicalSnapshot(root)).toEqual(before);
    await switchReleasingAbandonedClient(session, root);
    expect(await session.save(message(saveId))).toMatchObject({
      status: "completed",
      result: { _tag: "Success", success: { status: "saved", cursor: 1, replayed: false } },
    });
  }, unpinned));

it("answers uncertain when the reconciliation read cannot run", () =>
  inConversationProject(async (session, root) => {
    const reader = sharedReader(root);
    let lock: ReturnType<typeof exclusiveLock> | undefined;
    readOnlyClientOpenHooks.push(() => {
      reader.release();
      lock = exclusiveLock(root);
      return undefined;
    });
    try {
      const { value } = await timed("B10(c) save whose reconciliation read cannot run", () =>
        session.save(message(randomUUID())),
      );
      expect(value).toMatchObject(failedWith("ConversationCommitUncertain"));
    } finally {
      lock?.release();
    }
    expect(await readOnlyTexts(root)).toEqual([]);
  }));

it.each(["open", "close"] as const)(
  "answers uncertain when the reconciliation's read-only client fails to %s",
  (stage) =>
    inConversationProject(async (session, root) => {
      const reader = sharedReader(root);
      const failure = new Error(`Injected read-only ${stage} failure.`);
      readOnlyClientOpenHooks.push(() => {
        reader.release();
        if (stage === "open") throw failure;
        // The real client still closes; only its answer fails.
        return (client) => ({
          execute: (statement, args) => client.execute(statement, args),
          transaction: (mode) => client.transaction(mode),
          close: () => client.close().then(() => Promise.reject(failure)),
        });
      });
      expect(await session.save(message(randomUUID()))).toMatchObject(
        failedWith("ConversationCommitUncertain"),
      );
    }),
);

/** Another process's committed save under `saveId`, with a different fingerprint. */
function foreignSave(root: string, saveId: string) {
  const [conversationId, branchId, messageId] = [randomUUID(), randomUUID(), randomUUID()];
  const at = new Date().toISOString();
  const database = new DatabaseSync(generationPaths(root).canonical);
  try {
    database
      .prepare(
        "INSERT INTO conversations (conversation_id, project_id, scope_kind, waypoint_id, created_at) VALUES (?, ?, 'project', NULL, ?)",
      )
      .run(conversationId, createRequest.projectId, at);
    database
      .prepare(
        "INSERT INTO conversation_branches (branch_id, conversation_id, parent_branch_id, fork_message_id, created_at) VALUES (?, ?, NULL, NULL, ?)",
      )
      .run(branchId, conversationId, at);
    database
      .prepare(
        `INSERT INTO conversation_messages (message_id, conversation_id, branch_id, cursor, author,
          body, save_id, save_fingerprint, saved_at) VALUES (?, ?, ?, 1, 'user', 'foreign', ?, ?, ?)`,
      )
      .run(messageId, conversationId, branchId, saveId, "0".repeat(64), at);
  } finally {
    database.close();
  }
}

it("answers a reused save id found by the reconciliation as rejected", () =>
  inConversationProject(async (session, root) => {
    const saveId = randomUUID();
    const reader = sharedReader(root);
    readOnlyClientOpenHooks.push(() => {
      reader.release();
      foreignSave(root, saveId);
      return undefined;
    });
    // The reconciled answer is the reuse itself, with no saved-only fields added.
    const outcome = await session.save(message(saveId));
    expect(outcome.status === "completed" && outcome.result).toEqual(
      Result.succeed({ status: "rejected", code: "SAVE_ID_REUSED" }),
    );
  }, unpinned));
