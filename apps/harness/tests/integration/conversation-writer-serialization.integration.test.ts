import { randomUUID } from "node:crypto";
import { Deferred, Effect } from "effect";
import { expect, it } from "vitest";
import {
  type ConversationSession,
  createConversationProject,
  withConversationWriter,
} from "./conversation-writer-fixture.js";
import { generationPaths } from "./project-storage-open-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
  projectStorageIntegrationTimeout,
} from "./project-storage-runtime-fixture.js";
import { noteSettlementHolds, orderedRows } from "./project-storage-upgrade-fixture.js";

const notes = ["held or waiting", "next"] as const;

/** The canonical facts the commands decide, without their minted ids and times. */
function canonicalOutcome(root: string) {
  const databasePath = generationPaths(root).canonical;
  return {
    events: orderedRows({ databasePath, table: "canonical_events" })
      .map((row) => {
        const event = row as Record<string, unknown>;
        return [event["project_sequence"], event["event_type"], event["payload_json"]];
      })
      .sort(([left], [right]) => Number(left) - Number(right)),
    receipts: orderedRows({ databasePath, table: "command_receipts" })
      .map((row) => {
        const receipt = row as Record<string, unknown>;
        return [receipt["project_sequence"], receipt["outcome"]];
      })
      .sort(([left], [right]) => Number(left) - Number(right)),
  };
}

/** Runs `body` in a read-write activation of a new Project and answers the canonical outcome. */
async function inProject(body: (session: ConversationSession) => Promise<void>) {
  const root = await createTemporaryApplicationRoot();
  const fixture = await createConversationProject(root);
  try {
    await withConversationWriter(
      { storage: fixture.owner, projectId: createRequest.projectId },
      body,
    );
  } finally {
    await fixture.owner.stop();
  }
  return canonicalOutcome(root);
}

/** One gate a held operation signals and then waits on. */
function gate() {
  const entered = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  return {
    hold: Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release))),
    entered: () => Effect.runPromise(Deferred.await(entered)),
    release: () => Effect.runPromise(Deferred.succeed(release, undefined)),
  };
}

/** Lets every already-runnable callback run, so a waiting operation would have finished. */
const drained = () => new Promise<void>((resolve) => setImmediate(resolve));

const save = (session: ConversationSession, expectedRevision: number, hold?: Effect.Effect<void>) =>
  session.save({ saveId: randomUUID(), expectedRevision, text: `save ${expectedRevision}` }, hold);

/** The next command and the next save are both accepted. */
async function expectBothAccepted(session: ConversationSession) {
  expect(await session.submitNote(notes[1])).toMatchObject({ status: "settled" });
  expect(await save(session, 1)).toMatchObject({
    status: "completed",
    result: { _tag: "Success", success: { status: "saved", cursor: 2 } },
  });
}

const timeout = projectStorageIntegrationTimeout * 3;

it(
  "serializes canonical commands and saves without closing admission",
  async () => {
    const control = await inProject(async (session) => {
      for (const note of notes) await session.submitNote(note);
    });

    const order: string[] = [];
    const saveFirst = await inProject(async (session) => {
      const held = gate();
      const saving = save(session, 0, held.hold).then((result) => order.push("save") && result);
      await held.entered();
      const command = session
        .submitNote(notes[0])
        .then((result) => order.push("command") && result);
      await drained();
      expect(order).toEqual([]);
      await held.release();
      expect(await saving).toMatchObject({ status: "completed", result: { _tag: "Success" } });
      expect(await command).toMatchObject({ status: "settled" });
      expect(order).toEqual(["save", "command"]);
      await expectBothAccepted(session);
    });
    expect(saveFirst).toEqual(control);

    order.length = 0;
    const commandFirst = await inProject(async (session) => {
      const held = gate();
      noteSettlementHolds.push(() => Effect.runPromise(held.hold));
      const command = session
        .submitNote(notes[0])
        .then((result) => order.push("command") && result);
      await held.entered();
      const saving = save(session, 0).then((result) => order.push("save") && result);
      await drained();
      expect(order).toEqual([]);
      await held.release();
      expect(await command).toMatchObject({ status: "settled" });
      expect(await saving).toMatchObject({ status: "completed", result: { _tag: "Success" } });
      expect(order).toEqual(["command", "save"]);
      await expectBothAccepted(session);
    });
    expect(commandFirst).toEqual(control);
  },
  timeout,
);
