import { randomUUID } from "node:crypto";
import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { readProjectConversationReadOnly } from "../../src/conversation/conversation-store.js";
import {
  type ConversationSession,
  canonicalSnapshot,
  exclusiveLock,
  failedWith,
  inConversationProject,
  rawCanonical,
  readConversation,
  saveOutcome,
  timed,
} from "./conversation-writer-fixture.js";
import { generationPaths } from "./project-storage-open-fixture.js";
import { createRequest } from "./project-storage-runtime-fixture.js";
import { writerClientFaults } from "./project-storage-upgrade-fixture.js";

const save = (session: ConversationSession, text: string) =>
  session.save({ saveId: randomUUID(), expectedRevision: 0, text });

/**
 * After a refused save, the canonical snapshot is unchanged, and the next save and the next
 * command are both accepted (R2-B2).
 */
async function expectNextAccepted(
  session: ConversationSession,
  canonical: Readonly<{ root: string; before: unknown }>,
) {
  expect(canonicalSnapshot(canonical.root)).toEqual(canonical.before);
  expect(
    await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "next" }),
  ).toMatchObject({ status: "saved", cursor: 1 });
  expect(await session.submitNote("after the refusal")).toMatchObject({ status: "settled" });
}

/** These bodies settle a command themselves, so they compare the canonical snapshot before it. */
const unpinned = { pinCanonical: false } as const;

const sqliteError = (code: string) => Object.assign(new Error(code), { code });

it("keeps busy and broken storage distinct: another connection's exclusive lock", () =>
  inConversationProject(async (session, root) => {
    const before = canonicalSnapshot(root);
    const lock = exclusiveLock(root);
    try {
      const { value, milliseconds } = await timed("save behind an exclusive lock", () =>
        save(session, "blocked"),
      );
      expect(value).toMatchObject(failedWith("ConversationStorageBusy"));
      expect(milliseconds).toBeGreaterThanOrEqual(4_500);
    } finally {
      lock.release();
    }
    expect(await readConversation(session)).toBeNull();
    await expectNextAccepted(session, { root, before });
  }, unpinned));

const insert = /INSERT INTO conversation_messages/;
/** The fence check runs in the save's transaction body, before the work (T7). */
const fenceCheck = /FROM writer_fence/;
const injectedCases = [
  { site: "insert", match: insert, code: "SQLITE_LOCKED", tag: "ConversationStorageBusy" },
  { site: "insert", match: insert, code: "SQLITE_CANTOPEN", tag: "ConversationStorageBroken" },
  { site: "insert", match: insert, code: "SQLITE_IOERR", tag: "ConversationStorageBroken" },
  { site: "insert", match: insert, code: "SQLITE_READONLY", tag: "ConversationStorageBroken" },
  { site: "fence check", match: fenceCheck, code: "SQLITE_LOCKED", tag: "ConversationStorageBusy" },
  {
    site: "fence check",
    match: fenceCheck,
    code: "SQLITE_IOERR",
    tag: "ConversationStorageBroken",
  },
] as const;

it.for(injectedCases)(
  "keeps busy and broken storage distinct: $site $code",
  ({ match, code, tag }) =>
    inConversationProject(async (session, root) => {
      const before = canonicalSnapshot(root);
      writerClientFaults.push({ match, error: sqliteError(code) });
      expect(await save(session, "refused")).toMatchObject(failedWith(tag));
      expect(await readConversation(session)).toBeNull();
      await expectNextAccepted(session, { root, before });
    }, unpinned),
);

it("keeps busy and broken storage distinct: a corrupt row", () =>
  inConversationProject(async (session, root) => {
    const before = canonicalSnapshot(root);
    rawCanonical(root, (database) =>
      database.exec(`PRAGMA ignore_check_constraints = ON;
        INSERT INTO conversations (conversation_id, project_id, scope_kind, waypoint_id, created_at)
        SELECT 'not-a-uuid', project_id, 'project', NULL, 'later' FROM project_state`),
    );
    expect(await save(session, "refused")).toMatchObject(failedWith("ConversationStorageBroken"));
    rawCanonical(root, (database) =>
      database.exec("DELETE FROM conversations WHERE conversation_id = 'not-a-uuid'"),
    );
    expect(await readConversation(session)).toBeNull();
    await expectNextAccepted(session, { root, before });
  }, unpinned));

it("answers busy for a read behind a held lock, then reads, saves and settles", () =>
  inConversationProject(async (session, root) => {
    const before = canonicalSnapshot(root);
    const lock = exclusiveLock(root);
    try {
      const { value } = await timed("writer read behind an exclusive lock", () => session.read());
      expect(value).toMatchObject(failedWith("ConversationStorageBusy"));
    } finally {
      lock.release();
    }
    expect(await readConversation(session)).toBeNull();
    await expectNextAccepted(session, { root, before });
  }, unpinned));

const readOnly = (root: string) =>
  Effect.runPromise(
    Effect.result(
      readProjectConversationReadOnly({
        canonicalDatabasePath: generationPaths(root).canonical,
        projectId: createRequest.projectId,
        after: null,
      }),
    ),
  );

/** Waits real time: the SQLite busy handler measures real time, so no test clock applies. */
const elapsed = (milliseconds: number) => Effect.runPromise(Effect.sleep(`${milliseconds} millis`));

it("reads read-only through a short external commit", () =>
  inConversationProject(async (session, root) => {
    await saveOutcome(session, { saveId: randomUUID(), expectedRevision: 0, text: "kept" });
    const lock = exclusiveLock(root);
    const reading = timed("read-only read through a 500 ms commit", () => readOnly(root));
    await elapsed(500);
    lock.release();
    const { value } = await reading;
    expect(Result.isSuccess(value) && value.success.conversation?.revision).toBe(1);
  }));

it("answers busy for a read-only read behind a lock held past its wait", () =>
  inConversationProject(async (_session, root) => {
    const lock = exclusiveLock(root);
    try {
      const { value, milliseconds } = await timed("read-only read behind a held lock", () =>
        readOnly(root),
      );
      expect(value).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "ConversationStorageBusy" },
      });
      expect(milliseconds).toBeGreaterThanOrEqual(1_800);
    } finally {
      lock.release();
    }
  }));

it("answers broken for a read whose close fails, then refuses the next save (T5)", () =>
  inConversationProject(async (session) => {
    writerClientFaults.push({ match: /^close$/, error: new Error("Injected read close failure.") });
    expect(await session.read()).toMatchObject(failedWith("ConversationStorageBroken"));
    expect(await save(session, "refused")).toEqual({ status: "writer-unavailable" });
    expect(await session.submitNote("refused")).toMatchObject({ status: "writer-unavailable" });
  }, unpinned));
