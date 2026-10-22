import { randomUUID } from "node:crypto";
import {
  createProjectOpenResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  decodeStrict,
  ProjectConversationReadRequestSchema,
  ProjectStorageOpenRequestSchema,
  ProjectStorageOpenResultSchema,
  projectConversationDiagnostics,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import { createHarnessBridges } from "./harness-bridges.js";
import {
  flushMicrotasks,
  messageId,
  replyMetadata,
  ScriptedHarnessSession,
  undecodableReply,
  watch,
} from "./harness-session-test-peers.js";

const activation = { projectId: randomUUID(), activationId: randomUUID() };
const read = decodeStrict(ProjectConversationReadRequestSchema, { ...activation, after: null });
const open = decodeStrict(ProjectStorageOpenRequestSchema, { projectId: activation.projectId });
const query = decodeStrict(WorkspaceQuerySchema, {
  query: "memory-library.read",
  projectId: activation.projectId,
  cursor: null,
});
const queryAnswer = decodeStrict(WorkspaceQueryResultSchema, {
  status: "unavailable",
  query,
  diagnostic: { code: "WORKSPACE_CAPABILITY_UNAVAILABLE", message: "Memory producer is down." },
});
const openAnswer = decodeStrict(ProjectStorageOpenResultSchema, {
  status: "not-registered",
  request: open,
});
const listClosing = { status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" };
/** The query's answer when the release's final `failAll` settles it (no bridge stop did). */
const queryTransport = {
  status: "broken",
  query,
  diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message: "Harness session disconnected." },
};
const storageStopped = {
  status: "broken",
  request: open,
  diagnostic: {
    code: "PROJECT_STORAGE_TRANSPORT_FAILED",
    message: "Project Storage bridge is stopped.",
  },
};
const queryClosing = {
  status: "unavailable",
  query,
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "The workspace is unavailable while SlopStop closes.",
  },
};

/** The real shared bridges over a scripted session, with sequential message ids. */
function shared(configure: (session: ScriptedHarnessSession) => void = () => {}) {
  const session = new ScriptedHarnessSession();
  configure(session);
  let next = 1;
  const bridges = createHarnessBridges({
    session,
    createId: () => messageId(next++),
    now: () => "2026-10-19T12:00:00.000Z",
  });
  return { session, bridges };
}

/** Starts the three requests `release()` must answer, with their stop order recorded. */
function pendingForRelease(bridges: ReturnType<typeof shared>["bridges"]) {
  const order: string[] = [];
  for (const [name, bridge] of [
    ["project-storage", bridges.projectStorage],
    ["workspace", bridges.workspace],
    ["project-entry", bridges.projectEntry],
  ] as const) {
    const stop = bridge.stop.bind(bridge);
    vi.spyOn(bridge, "stop").mockImplementation(() => {
      order.push(name);
      stop();
    });
  }
  return {
    order,
    list: watch(bridges.projectEntry.list()),
    open: watch(bridges.projectStorage.open(open)),
    query: watch(bridges.workspace.query(query)),
  };
}

/** The pending requests' answers, in list, open, query order. */
function answers(pending: ReturnType<typeof pendingForRelease>) {
  return [pending.list, pending.open, pending.query].map((request) => request.value);
}

/** The id of the command sent for `command`. */
function sentId(session: ScriptedHarnessSession, command: string): string {
  const sent = session.sent.find((message) => message.command === command);
  if (sent === undefined) throw new Error(`No ${command} sent`);
  return sent.messageId;
}

/** Makes the workspace stop throw `failure` inside `release()`, without settling its query. */
function failWorkspaceStop(bridges: ReturnType<typeof shared>["bridges"], failure: Error): void {
  vi.mocked(bridges.workspace.stop).mockImplementation(() => {
    throw failure;
  });
}

type CrossBridgeCommand = "project.open" | "workspace.query";

/** Each command's own reply, correlated to `id`, and what it answers. */
const ownReply = {
  "project.open": {
    event: (id: string) => createProjectOpenResultEvent(replyMetadata(id), openAnswer),
    answer: openAnswer,
  },
  "workspace.query": {
    event: (id: string) => createWorkspaceQueryResultEvent(replyMetadata(id), queryAnswer),
    answer: queryAnswer,
  },
} as const;

/**
 * A Project Storage open and a workspace query are pending. The other bridge's reply event,
 * correlated to `target`'s id, fails `target` with `expected`; the other request is unaffected and
 * still completes with its own reply (S7-K10).
 */
async function expectCrossBridgeMismatch(target: CrossBridgeCommand, expected: unknown) {
  const { session, bridges } = shared();
  const pending = {
    "project.open": watch(bridges.projectStorage.open(open)),
    "workspace.query": watch(bridges.workspace.query(query)),
  };
  const other: CrossBridgeCommand = target === "project.open" ? "workspace.query" : "project.open";
  session.message(ownReply[other].event(sentId(session, target)));
  await flushMicrotasks();
  expect(pending[target].value).toEqual(expected);
  expect(pending[other].settled).toBe(false);
  session.message(ownReply[other].event(sentId(session, other)));
  await flushMicrotasks();
  expect(pending[other].value).toEqual(ownReply[other].answer);
}

describe("harness bridges", () => {
  const rows: ReadonlyArray<Readonly<{ name: string; run(): Promise<void> }>> = [
    {
      name: "one subscription",
      async run() {
        const { session } = shared();
        expect(session.subscribeCalls).toBe(1);
        expect(session.subscriptions).toBe(1);
      },
    },
    {
      name: "stop scoped to its bridge",
      async run() {
        const { session, bridges } = shared();
        const entryRead = bridges.projectEntry.readConversation(read);
        const workspaceQuery = bridges.workspace.query(query);
        const queryId = session.lastId();
        bridges.projectEntry.stop();
        await expect(entryRead).resolves.toEqual({
          status: "unavailable",
          request: read,
          diagnostic: projectConversationDiagnostics.connectionLost,
        });
        session.message(createWorkspaceQueryResultEvent(replyMetadata(queryId), queryAnswer));
        await expect(workspaceQuery).resolves.toEqual(queryAnswer);
        const sent = session.sent.length;
        await expect(bridges.projectEntry.list()).resolves.toEqual({
          status: "broken",
          code: "PROJECT_LIST_TRANSPORT_FAILED",
        });
        expect(session.sent).toHaveLength(sent);
        // The other bridges still send new work after the project-entry stop (S7-K5).
        const laterQuery = bridges.workspace.query(query);
        const laterQueryId = session.lastId();
        const laterOpen = bridges.projectStorage.open(open);
        const laterOpenId = session.lastId();
        expect(session.sent).toHaveLength(sent + 2);
        session.message(createWorkspaceQueryResultEvent(replyMetadata(laterQueryId), queryAnswer));
        session.message(createProjectOpenResultEvent(replyMetadata(laterOpenId), openAnswer));
        await expect(laterQuery).resolves.toEqual(queryAnswer);
        await expect(laterOpen).resolves.toEqual(openAnswer);
      },
    },
    {
      name: "release answers and order",
      async run() {
        const { session, bridges } = shared();
        const pending = pendingForRelease(bridges);
        bridges.release();
        await flushMicrotasks();
        expect([pending.list, pending.open, pending.query].map((request) => request.value)).toEqual(
          [listClosing, storageStopped, queryClosing],
        );
        expect(pending.order).toEqual(["project-storage", "workspace", "project-entry"]);
        expect(session.subscriptions).toBe(0);
      },
    },
    {
      name: "a throwing shared stop",
      async run() {
        const { session, bridges } = shared();
        const pending = pendingForRelease(bridges);
        const failure = new Error("private workspace stop failure");
        failWorkspaceStop(bridges, failure);
        expect(() => bridges.release()).toThrow(failure);
        await flushMicrotasks();
        expect([pending.list.value, pending.open.value]).toEqual([listClosing, storageStopped]);
        expect(session.subscriptions).toBe(0);
        // The query its stop never settled ends with the release's transport fault (S7-K2).
        expect(pending.query.value).toEqual(queryTransport);
      },
    },
    {
      name: "release with two failures",
      async run() {
        const { session, bridges } = shared((scripted) => {
          scripted.failUnsubscribe = 1;
        });
        const pending = pendingForRelease(bridges);
        const failure = new Error("private workspace stop failure");
        failWorkspaceStop(bridges, failure);
        expect(() => bridges.release()).toThrow(failure);
        await flushMicrotasks();
        expect(answers(pending)).toEqual([listClosing, storageStopped, queryTransport]);
        expect(session.unsubscribeCalls).toBe(1);
      },
    },
    {
      name: "release twice",
      async run() {
        const { session, bridges } = shared();
        const pending = pendingForRelease(bridges);
        bridges.release();
        expect(() => bridges.release()).not.toThrow();
        expect(pending.order).toEqual(["project-storage", "workspace", "project-entry"]);
        expect(session.unsubscribeCalls).toBe(1);
      },
    },
    {
      name: "release after the program",
      async run() {
        const { session, bridges } = shared();
        const pending = pendingForRelease(bridges);
        // The s6 shutdown program's order, before the runtime's release.
        bridges.projectStorage.stop();
        bridges.workspace.stop();
        bridges.projectEntry.stop();
        await flushMicrotasks();
        const answered = answers(pending);
        expect(answered).toEqual([listClosing, storageStopped, queryClosing]);
        expect(() => bridges.release()).not.toThrow();
        await flushMicrotasks();
        expect(answers(pending)).toEqual(answered);
        expect(session.subscriptions).toBe(0);
      },
    },
    {
      name: "release settles before unsubscribe fails",
      async run() {
        const { session, bridges } = shared((scripted) => {
          scripted.failUnsubscribe = 1;
        });
        const pending = pendingForRelease(bridges);
        expect(() => bridges.release()).toThrow(session.unsubscribeError as Error);
        await flushMicrotasks();
        expect([pending.list, pending.open, pending.query].map((request) => request.value)).toEqual(
          [listClosing, storageStopped, queryClosing],
        );
      },
    },
    {
      name: "partial construction",
      async run() {
        const session = new ScriptedHarnessSession();
        session.failSubscribe = 1;
        expect(() =>
          createHarnessBridges({ session, createId: randomUUID, now: () => "2026-10-19" }),
        ).toThrow(session.subscribeError as Error);
        expect(session.subscriptions).toBe(0);
        expect(session.sent).toEqual([]);
      },
    },
    {
      name: "cross-bridge uncorrelated result",
      async run() {
        const { session, bridges } = shared();
        const storageOpen = watch(bridges.projectStorage.open(open));
        session.message(createWorkspaceQueryResultEvent(replyMetadata(null), queryAnswer));
        await flushMicrotasks();
        expect(storageOpen.value).toEqual({
          ...storageStopped,
          diagnostic: {
            code: "PROJECT_STORAGE_TRANSPORT_FAILED",
            message: "Harness returned an uncorrelated Project Storage response.",
          },
        });
      },
    },
    {
      name: "cross-bridge correlated reply: storage open",
      run: () =>
        expectCrossBridgeMismatch("project.open", {
          ...storageStopped,
          diagnostic: {
            code: "PROJECT_STORAGE_TRANSPORT_FAILED",
            message: "Harness returned a mismatched Project Storage response.",
          },
        }),
    },
    {
      name: "cross-bridge correlated reply: workspace query",
      run: () =>
        expectCrossBridgeMismatch("workspace.query", {
          status: "broken",
          query,
          diagnostic: {
            code: "WORKSPACE_TRANSPORT_FAILED",
            message: "Harness returned a mismatched workspace response.",
          },
        }),
    },
    {
      name: "notifications after stop",
      async run() {
        const { session, bridges } = shared();
        const listener = vi.fn();
        bridges.workspace.subscribe(listener);
        bridges.workspace.stop();
        session.message(
          createWorkspaceProjectionInvalidatedEvent(
            replyMetadata(null),
            decodeStrict(WorkspaceNotificationSchema, {
              capability: "memory",
              scope: { kind: "project", projectId: activation.projectId },
              revision: 1,
            }),
          ),
        );
        expect(listener).not.toHaveBeenCalled();
        // The stopped bridge no longer decodes notifications, so an invalid one throws nothing (S7-K4).
        expect(() =>
          session.message(undecodableReply("workspace.projection.invalidated", null)),
        ).not.toThrow();
      },
    },
  ];

  it.each(rows)("shares one core across the three bridges: $name", async ({ run }) => {
    await run();
  });
});
