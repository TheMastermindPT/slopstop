import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { projectConversationDiagnostics as rows } from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import { moveWriterFence } from "./conversation-fence-fixture.js";
import { rawCanonical, readOnlyClientOpenHooks } from "./conversation-writer-fixture.js";
import {
  closeAdmission,
  closureKinds,
  expectSourceReleased,
  hold,
} from "./project-conversation-closure-fixture.js";
import {
  activeTarget,
  type ConversationProcessRuntime,
  type ConversationTarget,
  runThenCleanUp,
  startComposedConversationRuntime,
  startConversationProcessRuntime,
} from "./project-conversation-runtime-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
  projectStorageIntegrationTimeout,
} from "./project-storage-runtime-fixture.js";
import {
  conversationWorkHolds,
  writerClientCalls,
  writerClientCloses,
  writerClientFaults,
} from "./project-storage-upgrade-fixture.js";
import { createCurrentProject } from "./project-storage-upgrade-recovery-fixture.js";

const timeout = { timeout: projectStorageIntegrationTimeout * 2 };
const uuid = expect.stringMatching(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const instant = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const projectId = createRequest.projectId;
const otherProjectId = "00000000-0000-4000-8000-0000000000f2";

/**
 * A schema-4 Project on a fresh root, a runtime over it (seam (a) by default), and a read-write
 * activation.
 */
async function inRuntime(
  body: (
    runtime: ConversationProcessRuntime,
    target: ConversationTarget,
    root: string,
  ) => Promise<void>,
  start: (
    root: string,
  ) =>
    | ConversationProcessRuntime
    | Promise<ConversationProcessRuntime> = startConversationProcessRuntime,
) {
  const root = await createTemporaryApplicationRoot();
  await createCurrentProject({ root });
  const runtime = await start(root);
  await runThenCleanUp(async () => {
    const target = await activeTarget(runtime, projectId);
    expect(target.access).toBe("read-write");
    await body(runtime, { projectId, activationId: target.activationId }, root);
  }, runtime.stop);
}

const message = (text: string, expectedRevision = 0, saveId: string = randomUUID()) => ({
  saveId,
  expectedRevision,
  text,
});

const saveResult = (payload: object) => ({ event: "project.conversation.save.result", payload });
const readResult = (payload: object) => ({ event: "project.conversation.read.result", payload });

/** A read's answer: its event checked, its payload returned for an exact comparison. */
async function readPayload(runtime: ConversationProcessRuntime, target: ConversationTarget) {
  const answer = await runtime.read(target);
  expect(answer.event).toBe("project.conversation.read.result");
  return answer.payload;
}

function failureRow(status: string, request: object, diagnostic: object) {
  return { status, request, diagnostic };
}

it("maps saved, replayed, conflict and reuse through the harness for save (CNV-B13)", timeout, () =>
  inRuntime(async (runtime, target) => {
    const first = message("first");
    const saved = await runtime.save(target, first);
    const request = { ...target, ...first };
    expect(saved).toMatchObject(
      saveResult({
        status: "saved",
        request,
        conversationMessageId: uuid,
        cursor: 1,
        revision: 1,
        savedAt: instant,
        replayed: false,
      }),
    );
    const savedPayload = Object(saved.payload);
    expect((await runtime.save(target, first)).payload).toEqual({
      ...savedPayload,
      replayed: true,
    });
    const late = message("late");
    expect(await runtime.save(target, late)).toMatchObject(
      saveResult({ status: "conflict", request: { ...target, ...late }, currentRevision: 1 }),
    );
    const reused = { ...first, text: "other text" };
    expect((await runtime.save(target, reused)).payload).toEqual(
      failureRow("rejected", { ...target, ...reused }, rows.saveIdReused),
    );
  }),
);

it("maps a stale writer through the harness for save (CNV-B13)", timeout, () =>
  inRuntime(async (runtime, target, root) => {
    const restore = moveWriterFence(root);
    try {
      const late = message("late");
      expect((await runtime.save(target, late)).payload).toEqual(
        failureRow("stale-writer", { ...target, ...late }, rows.staleWriter),
      );
    } finally {
      restore();
    }
  }),
);

it("maps the refusals through the harness for save and read (CNV-B13)", timeout, () =>
  inRuntime(async (runtime, target) => {
    const mismatch = { ...target, projectId: otherProjectId };
    const stale = { ...target, activationId: randomUUID() };
    const text = message("refused");
    const saveRefusal = async (to: ConversationTarget, status: string, row: object) =>
      expect((await runtime.save(to, text)).payload).toEqual(
        failureRow(status, { ...to, ...text }, row),
      );
    const readRefusal = async (to: ConversationTarget, status: string, row: object) =>
      expect((await runtime.read(to)).payload).toEqual(
        failureRow(status, { ...to, after: null }, row),
      );
    await saveRefusal(mismatch, "project-mismatch", rows.projectMismatch);
    await saveRefusal(stale, "stale-activation", rows.staleActivation);
    await readRefusal(mismatch, "project-mismatch", rows.projectMismatch);
    await readRefusal(stale, "stale-activation", rows.staleActivation);
    // A command sent in the same turn as a lifecycle change meets the pending lifecycle.
    const switching = runtime.switchTo(target, projectId);
    const pendingSave = runtime.save(target, text);
    const pendingRead = runtime.read(target);
    expect((await pendingSave).payload).toEqual(
      failureRow("coordinator-unavailable", { ...target, ...text }, rows.coordinatorUnavailable),
    );
    expect((await pendingRead).payload).toEqual(
      failureRow(
        "coordinator-unavailable",
        { ...target, after: null },
        rows.coordinatorUnavailable,
      ),
    );
    await switching;
  }),
);

it("maps inactive through the harness for save and read (CNV-B13)", timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createCurrentProject({ root });
  const runtime = await startConversationProcessRuntime(root);
  await runThenCleanUp(async () => {
    const target = { projectId, activationId: randomUUID() };
    const text = message("refused");
    expect((await runtime.save(target, text)).payload).toEqual(
      failureRow("inactive", { ...target, ...text }, rows.inactive),
    );
    expect((await runtime.read(target)).payload).toEqual(
      failureRow("inactive", { ...target, after: null }, rows.inactive),
    );
  }, runtime.stop);
});

it("reads null, then the saved messages, through the harness (CNV-B13)", timeout, () =>
  inRuntime(async (runtime, target) => {
    expect(await readPayload(runtime, target)).toEqual({
      status: "read",
      request: { ...target, after: null },
      conversation: null,
    });
    const saved = Object((await runtime.save(target, message("kept"))).payload);
    expect(await readPayload(runtime, target)).toEqual({
      status: "read",
      request: { ...target, after: null },
      conversation: {
        conversationId: uuid,
        branchId: uuid,
        revision: 1,
        messages: [
          {
            conversationMessageId: saved.conversationMessageId,
            cursor: 1,
            author: "user",
            text: "kept",
            savedAt: saved.savedAt,
          },
        ],
        nextCursor: null,
      },
    });
  }),
);

it.runIf(process.platform === "win32")(
  "answers read-only for a save and reads the earlier messages on a read-only Project (CNV-B13)",
  timeout,
  () =>
    inRuntime(async (writer, writerTarget, root) => {
      await writer.save(writerTarget, message("before the reader"));
      const reader = await startConversationProcessRuntime(root);
      await runThenCleanUp(async () => {
        const selected = await activeTarget(reader, projectId);
        expect(selected.access).toBe("read-only");
        const target = { projectId, activationId: selected.activationId };
        const text = message("refused");
        expect((await reader.save(target, text)).payload).toEqual(
          failureRow("read-only", { ...target, ...text }, rows.readOnly),
        );
        expect(await reader.read(target)).toMatchObject(
          readResult({
            status: "read",
            conversation: { revision: 1, messages: [{ text: "before the reader" }] },
          }),
        );
      }, reader.stop);
    }),
);

/** Inserts user messages `from` to `to` (cursors) on one branch, by raw SQL. */
function insertMessages(
  database: DatabaseSync,
  branch: Readonly<{ conversationId: string; branchId: string }>,
  from: number,
  to: number,
) {
  const insert = database.prepare(
    `INSERT INTO conversation_messages (message_id, conversation_id, branch_id, cursor, author,
      body, save_id, save_fingerprint, saved_at) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`,
  );
  for (let cursor = from; cursor <= to; cursor += 1)
    insert.run(
      randomUUID(),
      branch.conversationId,
      branch.branchId,
      cursor,
      `m${cursor}`,
      randomUUID(),
      "0".repeat(64),
      "2026-10-10T12:00:00.000Z",
    );
}

/** Seeds `count` user messages by raw SQL, cursors 1 to `count`. */
function seedMessages(root: string, count: number) {
  const conversationId = randomUUID();
  const branchId = randomUUID();
  const at = "2026-10-10T12:00:00.000Z";
  rawCanonical(root, (database) => {
    database
      .prepare(
        "INSERT INTO conversations (conversation_id, project_id, scope_kind, waypoint_id, created_at) VALUES (?, ?, 'project', NULL, ?)",
      )
      .run(conversationId, projectId, at);
    database
      .prepare(
        "INSERT INTO conversation_branches (branch_id, conversation_id, parent_branch_id, fork_message_id, created_at) VALUES (?, ?, NULL, NULL, ?)",
      )
      .run(branchId, conversationId, at);
    insertMessages(database, { conversationId: conversationId, branchId: branchId }, 1, count);
  });
}

/** 101 messages read as two pages: 100 with nextCursor 100, then the last with null. */
async function expectTwoPages(runtime: ConversationProcessRuntime, target: ConversationTarget) {
  const first = await runtime.read(target);
  expect(first).toMatchObject(
    readResult({ status: "read", conversation: { revision: 101, nextCursor: 100 } }),
  );
  expect(Object(first.payload).conversation.messages).toHaveLength(100);
  expect(await runtime.read(target, 100)).toMatchObject(
    readResult({
      status: "read",
      conversation: { revision: 101, nextCursor: null, messages: [{ cursor: 101, text: "m101" }] },
    }),
  );
}

it("pages the conversation through the writer (CNV-B13)", timeout, () =>
  inRuntime(async (runtime, target, root) => {
    seedMessages(root, 101);
    await expectTwoPages(runtime, target);
  }),
);

it("keeps message identity after a switch and after a new runtime (CNV-B30)", timeout, async () => {
  const root = await createTemporaryApplicationRoot();
  await createCurrentProject({ root });
  let original: unknown;
  const runtime = await startConversationProcessRuntime(root);
  await runThenCleanUp(async () => {
    const target = await activeTarget(runtime, projectId);
    const at = { projectId, activationId: target.activationId };
    await runtime.save(at, message("one"));
    await runtime.save(at, message("two", 1));
    const read = await runtime.read(at);
    expect(read).toMatchObject(
      readResult({ status: "read", conversation: { revision: 2, messages: [{}, {}] } }),
    );
    original = Object(read.payload).conversation;
    const switched = Object((await runtime.switchTo(at, projectId)).payload);
    const reopened = { projectId, activationId: switched.target.activationId };
    expect(Object((await runtime.read(reopened)).payload).conversation).toEqual(original);
  }, runtime.stop);
  const next = await startConversationProcessRuntime(root);
  await runThenCleanUp(async () => {
    const target = await activeTarget(next, projectId);
    const at = { projectId, activationId: target.activationId };
    expect(Object((await next.read(at)).payload).conversation).toEqual(original);
  }, next.stop);
});

const sqliteError = (code: string) => Object.assign(new Error(code), { code });

it("maps an injected storage failure to broken for save and read (CNV-B13, seam b)", timeout, () =>
  inRuntime(async (runtime, target) => {
    const text = message("refused");
    writerClientFaults.push({
      match: /INSERT INTO conversation_messages/,
      error: sqliteError("SQLITE_IOERR"),
    });
    expect((await runtime.save(target, text)).payload).toEqual(
      failureRow("broken", { ...target, ...text }, rows.storageBroken),
    );
    writerClientFaults.push({ match: /FROM conversations/, error: sqliteError("SQLITE_IOERR") });
    expect(await readPayload(runtime, target)).toEqual(
      failureRow("broken", { ...target, after: null }, rows.storageBroken),
    );
  }, startComposedConversationRuntime),
);

it(
  "answers writer-unavailable for a save after the client is abandoned (CNV-B13, seam b)",
  timeout,
  () =>
    inRuntime(async (runtime, target) => {
      writerClientFaults.push({ match: /^close$/, error: new Error("Injected close failure.") });
      expect(await runtime.save(target, message("closing"))).toMatchObject(
        saveResult({ status: "saved", replayed: false }),
      );
      const text = message("refused", 1);
      expect((await runtime.save(target, text)).payload).toEqual(
        failureRow("writer-unavailable", { ...target, ...text }, rows.writerUnavailable),
      );
      await expectSourceReleased(runtime, target);
    }, startComposedConversationRuntime),
);

/**
 * Holds the next per-request read-only client on its first statement, before any statement runs
 * (so no SHARED lock is taken); `entered` resolves when the read reaches the gate.
 */
function holdNextReadOnlyRead() {
  let enter: () => void = () => undefined;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  readOnlyClientOpenHooks.push(() => (client) => {
    let first = true;
    return {
      execute: async (statement, args) => {
        if (first) {
          first = false;
          enter();
          await opened;
        }
        return client.execute(statement, args);
      },
      transaction: (mode) => client.transaction(mode),
      close: () => client.close(),
    };
  });
  return { entered, open };
}

/** Waits real time: the lifecycle under test runs on real I/O, so no test clock applies. */
const elapsed = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const drainLifecycles = ["switch", "stop"] as const;

// A read-only activation needs another runtime's writer lease: Windows only, as the read-only
// rows above.
it.runIf(process.platform === "win32").each(drainLifecycles)(
  "drains a held per-request read before %s releases, refusing work meanwhile (CNV-B14, seam b)",
  timeout,
  async (lifecycle) => {
    const root = await createTemporaryApplicationRoot();
    await createCurrentProject({ root });
    const writer = await startConversationProcessRuntime(root);
    const composed = startComposedConversationRuntime(root);
    let held: ReturnType<typeof holdNextReadOnlyRead> | undefined;
    // An assertion failure must not leave the read held: teardown would wait on it.
    const release = () => held?.open();
    await runThenCleanUp(
      async () => {
        const writable = await activeTarget(writer, projectId);
        await writer.save({ projectId, activationId: writable.activationId }, message("kept"));
        const selected = await activeTarget(composed, projectId);
        expect(selected.access).toBe("read-only");
        const target = { projectId, activationId: selected.activationId };
        const order: string[] = [];
        held = holdNextReadOnlyRead();
        const read = composed.read(target).then((answer) => {
          order.push("read");
          return answer;
        });
        await held.entered;
        const released = (
          lifecycle === "switch"
            ? composed.switchTo(target, projectId)
            : composed.coordinator.stop().then(() => ({}))
        ).then((answer) => {
          order.push(lifecycle);
          return answer;
        });
        const text = message("refused");
        expect((await composed.save(target, text)).payload).toEqual(
          failureRow(
            "coordinator-unavailable",
            { ...target, ...text },
            rows.coordinatorUnavailable,
          ),
        );
        expect(await readPayload(composed, target)).toEqual(
          failureRow(
            "coordinator-unavailable",
            { ...target, after: null },
            rows.coordinatorUnavailable,
          ),
        );
        // A lifecycle that does not wait for the held read finishes well within this real-time window
        // (its release and re-activation are local I/O); one that waits leaves the order empty.
        await Promise.race([released, elapsed(2000)]);
        expect(order).toEqual([]);
        held.open();
        expect(await read).toMatchObject(
          readResult({ status: "read", conversation: { messages: [{ text: "kept" }] } }),
        );
        const answer = await released;
        expect(order).toEqual(["read", lifecycle]);
        if (lifecycle === "switch") {
          const reopened = { projectId, activationId: Object(answer).payload.target.activationId };
          expect(await composed.read(reopened)).toMatchObject(
            readResult({ status: "read", conversation: { messages: [{ text: "kept" }] } }),
          );
        }
      },
      release,
      composed.stop,
      writer.stop,
    );
  },
);

it.each(closureKinds)(
  "reads through the read-only client after a closure by %s (CNV-B13, seam b)",
  timeout,
  (kind) =>
    inRuntime(async (runtime, target) => {
      const { expected } = await closeAdmission(runtime, target, kind);
      const calls = writerClientCalls.count;
      const closes = writerClientCloses.count;
      expect(await readPayload(runtime, target)).toEqual(expected);
      const text = message("refused", 2);
      expect((await runtime.save(target, text)).payload).toEqual(
        failureRow("writer-unavailable", { ...target, ...text }, rows.writerUnavailable),
      );
      readOnlyClientOpenHooks.push(() => {
        throw Object.assign(new Error("Injected open failure."), { code: "SQLITE_CANTOPEN" });
      });
      expect(await readPayload(runtime, target)).toEqual(
        failureRow("broken", { ...target, after: null }, rows.storageBroken),
      );
      // The reads never used the writer's client, and nothing force-closed it.
      expect(writerClientCalls.count).toBe(calls);
      expect(writerClientCloses.count).toBe(closes);
      await expectSourceReleased(runtime, target);
    }, startComposedConversationRuntime),
);

it.each(closureKinds)(
  "reads through the read-only client when a read queues behind a closure by %s (CNV-B13, seam b)",
  timeout,
  (kind) =>
    inRuntime(async (runtime, target) => {
      // The writer's own read statement fails if the queued read ever runs on the writer: it
      // must take the in-slot refusal and read through the read-only client instead.
      const writerRead = { match: /ORDER BY cursor LIMIT/, error: sqliteError("SQLITE_IOERR") };
      // The unused fault is cleared even when an assertion fails, so it cannot reach later rows.
      const clearFaults = () => {
        writerClientFaults.length = 0;
      };
      await runThenCleanUp(async () => {
        const { expected, queuedWork } = await closeAdmission(runtime, target, kind, {
          whileHeld: () => {
            writerClientFaults.push(writerRead);
            return runtime.read(target);
          },
        });
        const queued = await queuedWork;
        expect(Object(queued).payload).toEqual(expected);
        expect(writerClientFaults).toEqual([writerRead]);
      }, clearFaults);
      await expectSourceReleased(runtime, target);
    }, startComposedConversationRuntime),
);

/**
 * Starts `lifecycle` while `work` is held, checks that it does not answer within a real-time
 * window, releases the work, and checks that the work answers first. Answers both answers.
 */
async function expectLifecycleAfterHeldWork(
  runtime: ReturnType<typeof startComposedConversationRuntime>,
  target: ConversationTarget,
  lifecycle: (typeof drainLifecycles)[number],
  held: Readonly<{ entered: Promise<void>; open(): void }>,
  work: Promise<Readonly<{ payload?: unknown }>>,
  whilePending: () => Promise<void> = async () => undefined,
) {
  const order: string[] = [];
  const answered = work.then((answer) => {
    order.push("work");
    return answer;
  });
  await held.entered;
  const released = (
    lifecycle === "switch"
      ? runtime.switchTo(target, projectId)
      : runtime.coordinator.stop().then(() => ({}))
  ).then((answer) => {
    order.push(lifecycle);
    return answer;
  });
  await whilePending();
  await Promise.race([released, elapsed(2000)]);
  expect(order).toEqual([]);
  held.open();
  const workAnswer = await answered;
  const lifecycleAnswer = await released;
  expect(order).toEqual(["work", lifecycle]);
  return { workAnswer, lifecycleAnswer };
}

/** A save and a read sent while a lifecycle is pending answer coordinator-unavailable. */
async function expectRefusedWhilePending(
  runtime: ConversationProcessRuntime,
  target: ConversationTarget,
) {
  const text = message("refused");
  expect((await runtime.save(target, text)).payload).toEqual(
    failureRow("coordinator-unavailable", { ...target, ...text }, rows.coordinatorUnavailable),
  );
  expect(await readPayload(runtime, target)).toEqual(
    failureRow("coordinator-unavailable", { ...target, after: null }, rows.coordinatorUnavailable),
  );
}

/** `inRuntime` over the composed runtime, typed with its coordinator. */
async function inComposedRuntime(
  body: (
    runtime: ReturnType<typeof startComposedConversationRuntime>,
    target: ConversationTarget,
  ) => Promise<void>,
) {
  let composed: ReturnType<typeof startComposedConversationRuntime> | undefined;
  await inRuntime(
    (_runtime, target) => (composed === undefined ? Promise.resolve() : body(composed, target)),
    (root) => {
      composed = startComposedConversationRuntime(root);
      return composed;
    },
  );
}

it.each(drainLifecycles)(
  "drains a held fallback read after a failed settlement before %s releases (CNV-B14 phase 2, seam b)",
  timeout,
  (lifecycle) =>
    inComposedRuntime(async (runtime, target) => {
      const { expected } = await closeAdmission(runtime, target, "failed settlement");
      const held = holdNextReadOnlyRead();
      try {
        const { workAnswer, lifecycleAnswer } = await expectLifecycleAfterHeldWork(
          runtime,
          target,
          lifecycle,
          held,
          runtime.read(target),
          () => expectRefusedWhilePending(runtime, target),
        );
        expect(workAnswer.payload).toEqual(expected);
        if (lifecycle === "switch") {
          const reopened = {
            projectId,
            activationId: Object(lifecycleAnswer).payload.target.activationId,
          };
          expect(await runtime.read(reopened)).toMatchObject(
            readResult({
              status: "read",
              conversation: { messages: [{ text: "before the closure" }] },
            }),
          );
        }
      } finally {
        held.open();
      }
    }),
);

const heldWriterWork = ["save", "read"] as const;

describe.each(heldWriterWork)("a %s held in the writer's slot", (kind) => {
  it.each(drainLifecycles)("answers before %s releases (CNV-B14, seam b)", timeout, (lifecycle) =>
    inComposedRuntime(async (runtime, target) => {
      const held = hold();
      conversationWorkHolds.push(held.wait);
      try {
        const work = kind === "save" ? runtime.save(target, message("held")) : runtime.read(target);
        const { workAnswer, lifecycleAnswer } = await expectLifecycleAfterHeldWork(
          runtime,
          target,
          lifecycle,
          held,
          work,
        );
        expect(workAnswer.payload).toMatchObject({ status: kind === "save" ? "saved" : "read" });
        if (lifecycle === "switch")
          expect(lifecycleAnswer).toMatchObject({
            payload: { status: "target-result", sourceReleased: true },
          });
      } finally {
        held.open();
      }
    }),
  );
});

/** Appends messages `from` to `to` (cursors) to the Project conversation, by raw SQL. */
function appendMessages(root: string, from: number, to: number) {
  rawCanonical(root, (database) => {
    const branch = database
      .prepare(
        "SELECT conversation_id AS conversationId, branch_id AS branchId FROM conversation_messages LIMIT 1",
      )
      .get();
    insertMessages(
      database,
      {
        conversationId: String(branch?.["conversationId"]),
        branchId: String(branch?.["branchId"]),
      },
      from,
      to,
    );
  });
}

it(
  "pages the conversation through the read-only fallback after a failed settlement (CNV-B13, seam b)",
  timeout,
  () =>
    inRuntime(async (runtime, target, root) => {
      await closeAdmission(runtime, target, "failed settlement");
      appendMessages(root, 2, 101);
      const calls = writerClientCalls.count;
      await expectTwoPages(runtime, target);
      expect(writerClientCalls.count).toBe(calls);
      await expectSourceReleased(runtime, target);
    }, startComposedConversationRuntime),
);
