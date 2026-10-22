import {
  createProjectListCommand,
  createReadyEvent,
  createRequestFailureEvent,
  createWorkspaceProjectionInvalidatedEvent,
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  MessageIdSchema,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import { Effect, Fiber, Result } from "effect";
import { describe, expect, it } from "vitest";
import { makeHarnessRequestCore } from "./harness-request-core.js";
import {
  listReply,
  messageId,
  replyMetadata,
  ScriptedHarnessSession,
} from "./harness-session-test-peers.js";

const listed = { status: "listed", projects: [], hiddenCount: 0 };

function listCommand(id: string): DesktopMessage {
  return createProjectListCommand({ messageId: id, sentAt: "2026-10-19T12:00:00.000Z" });
}

/** A core over a scripted session, and a way to start list requests and watch them settle. */
function harness() {
  const session = new ScriptedHarnessSession();
  const core = makeHarnessRequestCore(session);
  const start = (createCommand: () => DesktopMessage) => {
    const outcome = { settled: false };
    const effect = Effect.result(
      core.request("project-entry", createCommand, "project.list.result"),
    );
    const fiber = Effect.runFork(effect);
    const result = Effect.runPromise(Fiber.join(fiber)).finally(() => {
      outcome.settled = true;
    });
    return { fiber, result, outcome };
  };
  return { session, core, start };
}

/**
 * A send that fails (`fail`) settles its request with `code`; once the session sends again
 * (`heal`), the same id registers, is sent and completes with its own reply.
 */
async function expectSendFailureFreesId(
  code: "HARNESS_SESSION_UNAVAILABLE" | "HARNESS_SESSION_SEND_FAILED",
  fail: (session: ScriptedHarnessSession) => void,
  heal: (session: ScriptedHarnessSession) => void,
): Promise<void> {
  const { session, start } = harness();
  fail(session);
  expect(await start(() => listCommand(messageId(1))).result).toEqual(
    Result.fail({ kind: "send", code }),
  );
  heal(session);
  const retry = start(() => listCommand(messageId(1)));
  expect(session.lastId()).toBe(messageId(1));
  session.message(listReply(messageId(1)));
  expect(await retry.result).toEqual(Result.succeed(listed));
}

async function flush(): Promise<void> {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

describe("harness request core", () => {
  const rows: ReadonlyArray<Readonly<{ name: string; run(): Promise<void> }>> = [
    {
      name: "reply",
      async run() {
        const { session, start } = harness();
        const request = start(() => listCommand(messageId(1)));
        session.message(listReply(messageId(1)));
        expect(await request.result).toEqual(Result.succeed(listed));
        expect(() => session.message(listReply(messageId(1)))).not.toThrow();
      },
    },
    {
      name: "reply during send",
      async run() {
        const { session, start } = harness();
        session.duringSend = (command) => session.message(listReply(command.messageId));
        expect(await start(() => listCommand(messageId(1))).result).toEqual(Result.succeed(listed));
      },
    },
    {
      name: "unbuildable command",
      async run() {
        const { session, start } = harness();
        const request = start(() => {
          throw new Error("private invalid command");
        });
        expect(await request.result).toEqual(
          Result.fail({ kind: "desktop", reason: "invalid-command" }),
        );
        expect(session.sent).toEqual([]);
      },
    },
    {
      name: "colliding id",
      async run() {
        const { session, start } = harness();
        const original = start(() => listCommand(messageId(1)));
        const colliding = start(() => listCommand(messageId(1)));
        expect(await colliding.result).toEqual(
          Result.fail({ kind: "desktop", reason: "identity-collision" }),
        );
        session.message(listReply(messageId(1)));
        expect(await original.result).toEqual(Result.succeed(listed));
      },
    },
    {
      name: "refused send",
      run: () =>
        expectSendFailureFreesId(
          "HARNESS_SESSION_UNAVAILABLE",
          (session) => {
            session.sendResult = { ok: false, error: { code: "HARNESS_SESSION_UNAVAILABLE" } };
          },
          (session) => {
            session.sendResult = { ok: true };
          },
        ),
    },
    {
      name: "throwing send",
      run: () =>
        expectSendFailureFreesId(
          "HARNESS_SESSION_SEND_FAILED",
          (session) => {
            session.sendError = new Error("private send failure");
          },
          (session) => {
            session.sendError = undefined;
          },
        ),
    },
    {
      name: "interrupted",
      async run() {
        const { session, start } = harness();
        const first = start(() => listCommand(messageId(1)));
        // The interrupted request's join rejects; only the second request is observed.
        first.result.catch(() => undefined);
        await Effect.runPromise(Fiber.interrupt(first.fiber));
        const second = start(() => listCommand(messageId(1)));
        expect(session.sent).toHaveLength(2);
        session.message(listReply(messageId(1)));
        expect(await second.result).toEqual(Result.succeed(listed));
      },
    },
    {
      name: "failure for an unknown id",
      async run() {
        const { session, start } = harness();
        const request = start(() => listCommand(messageId(1)));
        const failure = createRequestFailureEvent(
          { ...replyMetadata(null), causationId: decodeStrict(MessageIdSchema, messageId(9)) },
          { code: "HARNESS_INTERNAL_FAILURE", message: "private failure", retryable: false },
        );
        expect(() => session.message(failure)).not.toThrow();
        session.message(listReply(messageId(1)));
        expect(await request.result).toEqual(Result.succeed(listed));
      },
    },
  ];

  it.each(rows)("settles each harness request once by id: $name", async ({ run }) => {
    await run();
  });

  const nonReplies: ReadonlyArray<
    Readonly<{ event: string; message(pending: string): HarnessMessage }>
  > = [
    {
      event: "system.ready with null correlation",
      message: () => createReadyEvent(replyMetadata(null), "0.0.0"),
    },
    {
      event: "workspace.projection.invalidated with null correlation",
      message: () =>
        createWorkspaceProjectionInvalidatedEvent(
          replyMetadata(null),
          decodeStrict(WorkspaceNotificationSchema, {
            capability: "memory",
            scope: { kind: "project", projectId: messageId(10) },
            revision: 1,
          }),
        ),
    },
    {
      event: "system.ready correlated with the pending id",
      message: (pending) => createReadyEvent(replyMetadata(pending), "0.0.0"),
    },
  ];

  it.each(nonReplies)(
    "ignores non-reply events whatever their correlation: $event",
    async (row) => {
      const { session, start } = harness();
      const request = start(() => listCommand(messageId(1)));
      session.message(row.message(messageId(1)));
      await flush();
      expect(request.outcome.settled).toBe(false);
      session.message(listReply(messageId(1)));
      expect(await request.result).toEqual(Result.succeed(listed));
    },
  );
});
