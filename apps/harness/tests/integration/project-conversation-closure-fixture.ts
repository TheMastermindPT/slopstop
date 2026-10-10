import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import type {
  ConversationProcessRuntime,
  ConversationTarget,
} from "./project-conversation-runtime-fixture.js";
import {
  conversationWorkHolds,
  noteSettlementHolds,
  writerClientFaults,
} from "./project-storage-upgrade-fixture.js";

/** How the writer's admission closes before the reads under test (CNV-B13, G17). */
export const closureKinds = ["abandonment", "failed settlement"] as const;
export type ClosureKind = (typeof closureKinds)[number];

type Page = Readonly<{
  status: "read";
  request: object;
  conversation: Readonly<{ revision: number; messages: readonly object[] }> & object;
}>;

/** A gate a test opens; `entered` resolves when the held work reaches it. */
export function hold() {
  let enter: () => void = () => undefined;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return {
    entered,
    open,
    wait: async () => {
      enter();
      await opened;
    },
  };
}

function readPage(answer: Readonly<{ payload?: unknown }>): Page {
  const payload: unknown = answer.payload;
  if (Reflect.get(Object(payload), "status") !== "read")
    throw new Error(`Expected a read page: ${JSON.stringify(payload)}`);
  return Object(payload);
}

/** The page P1 plus the closing save's message, as the abandonment's expected page. */
function withClosingMessage(page: Page, saved: Readonly<{ payload?: unknown }>) {
  const closing = Object(saved.payload);
  return {
    ...page,
    conversation: {
      ...page.conversation,
      revision: page.conversation.revision + 1,
      messages: [
        ...page.conversation.messages,
        {
          conversationMessageId: closing.conversationMessageId,
          cursor: closing.cursor,
          author: "user",
          text: closing.request.text,
          savedAt: closing.savedAt,
        },
      ],
      nextCursor: null,
    },
  };
}

/**
 * Saves one message and reads its page (P1), then closes the writer's admission by `kind`:
 * an abandonment (a closing save whose close fails after its acknowledged commit) or a failed
 * settlement (a fixture note whose transaction close fails). With `queued`, the closing work is
 * held in the writer's slot while `whileHeld` sends work that queues behind it. Answers the page
 * a read must show after the closure.
 */
export async function closeAdmission(
  runtime: ConversationProcessRuntime,
  target: ConversationTarget,
  kind: ClosureKind,
  queued?: Readonly<{ whileHeld: () => Promise<unknown> }>,
) {
  const first = { saveId: randomUUID(), expectedRevision: 0, text: "before the closure" };
  expect(await runtime.save(target, first)).toMatchObject({ payload: { status: "saved" } });
  const p1 = readPage(await runtime.read(target));
  writerClientFaults.push({ match: /^close$/, error: new Error("Injected close failure.") });
  const gate = hold();
  if (queued !== undefined)
    (kind === "abandonment" ? conversationWorkHolds : noteSettlementHolds).push(gate.wait);
  const closing =
    kind === "abandonment"
      ? runtime.save(target, { saveId: randomUUID(), expectedRevision: 1, text: "closing" })
      : runtime.note(target, "closing note");
  let queuedWork: Promise<unknown> | undefined;
  if (queued !== undefined) {
    await gate.entered;
    queuedWork = queued.whileHeld();
    // Lets the queued work cross the transport and reach the writer's slot before the release.
    for (let turn = 0; turn < 10; turn += 1) await new Promise((next) => setImmediate(next));
    gate.open();
  }
  const closed = await closing;
  if (kind === "abandonment") {
    expect(closed).toMatchObject({ payload: { status: "saved", replayed: false } });
    return { expected: withClosingMessage(p1, closed), queuedWork };
  }
  expect(closed).toMatchObject({ event: "request.failure" });
  return { expected: p1, queuedWork };
}

/**
 * Ends a row whose writer was abandoned or failed: a switch to the same Project releases the
 * source (force-closing an abandoned client) and activates again (#102: the release outcome is
 * asserted, never left to teardown).
 */
export async function expectSourceReleased(
  runtime: ConversationProcessRuntime,
  target: ConversationTarget,
) {
  expect(await runtime.switchTo(target, target.projectId)).toMatchObject({
    payload: { status: "target-result", sourceReleased: true, target: { status: "active" } },
  });
}
