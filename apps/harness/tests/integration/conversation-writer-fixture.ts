import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { ProjectId } from "@slopstop/protocol";
import { Effect, Result } from "effect";
import { expect } from "vitest";
import type { CanonicalProjectWriter } from "../../src/canonical-project-writer.js";
import type { ConversationWriteOutcome } from "../../src/canonical-writer-conversation.js";
import type { ConversationStorageFailure } from "../../src/conversation/conversation-errors.js";
import {
  type ConversationCommitUncertain,
  saveConversationMessage,
} from "../../src/conversation/conversation-save.js";
import {
  readProjectConversation,
  type SaveProjectMessageInput,
  type SaveProjectMessageOutcome,
  saveProjectMessage,
} from "../../src/conversation/conversation-store.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../../src/storage/local-libsql-worker-client.js";
import { generationPaths } from "./project-storage-open-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
} from "./project-storage-runtime-fixture.js";
import {
  orderedRows,
  type WriterControl,
  withFixtureWriter,
} from "./project-storage-upgrade-fixture.js";

type StorageOwner = ReturnType<typeof createUpgradeStorageOwner>["owner"];

/**
 * Runs before the reconciling save opens its read-only client, first in first out: a test takes
 * a real lock there, after the writer's own transaction has ended. A hook may throw to fail the
 * open, or return a wrapper for the opened client.
 */
export const readOnlyClientOpenHooks: (() =>
  | ((client: LocalLibsqlClient) => LocalLibsqlClient)
  | undefined)[] = [];

const storeDependencies = { createId: randomUUID, now: () => new Date().toISOString() };

function openReadOnlyClient(databasePath: string) {
  const wrap = readOnlyClientOpenHooks.shift()?.();
  const client = createWorkerLocalLibsqlClient(databasePath, "generation", { readOnly: true });
  return wrap === undefined ? client : wrap(client);
}

/** The Conversation operations of one read-write activation, through its real writer. */
export type ConversationSession = Readonly<{
  /** Saves; `hold` runs after the insert, inside the save's transaction. */
  save(
    input: Omit<SaveProjectMessageInput, "projectId">,
    hold?: Effect.Effect<void>,
  ): ReturnType<typeof saveThrough>;
  read(after?: number | null): ReturnType<typeof readThrough>;
  submitNote: Parameters<Parameters<typeof withFixtureWriter>[1]>[0];
  control: WriterControl;
}>;

/** A save's answer: the writer's outcome, with the reconciliation's failures. */
type SaveOutcome = ConversationWriteOutcome<
  SaveProjectMessageOutcome,
  ConversationStorageFailure | ConversationCommitUncertain
>;

/**
 * Saves through the reconciling save. With `hold`, the save goes straight to the writer and
 * holds inside its transaction after the insert.
 */
function saveThrough(
  writer: CanonicalProjectWriter,
  input: Omit<SaveProjectMessageInput, "projectId">,
  hold?: Effect.Effect<void>,
): Promise<SaveOutcome> {
  const message = { ...input, projectId: writer.projectId };
  if (hold !== undefined)
    return writer.conversation((tx) =>
      saveProjectMessage(tx, message, storeDependencies).pipe(Effect.tap(() => hold)),
    );
  return Effect.runPromise(
    saveConversationMessage({
      writer,
      canonicalDatabasePath: canonicalPathOf(writer),
      message,
      dependencies: storeDependencies,
      openReadOnlyClient,
    }),
  );
}

/** The fixture Project's canonical database: one Project per fixture root. */
const canonicalPaths = new Map<string, string>();
function canonicalPathOf(writer: CanonicalProjectWriter): string {
  const path = canonicalPaths.get(writer.projectId);
  if (path === undefined) throw new Error("No canonical path for this Project.");
  return path;
}

function readThrough(writer: CanonicalProjectWriter, after: number | null = null) {
  return writer.conversationRead((tx) =>
    readProjectConversation(tx, { projectId: writer.projectId, after }),
  );
}

/** `withFixtureWriter`, with the activation's Conversation save and read. */
export async function withConversationWriter(
  target: Readonly<{ storage: StorageOwner; projectId: ProjectId }>,
  run: (session: ConversationSession) => Promise<void>,
): Promise<void> {
  await withFixtureWriter(target, (submitNote, _first, control) =>
    run({
      save: (input, hold) => saveThrough(control.currentWriter(), input, hold),
      read: (after) => readThrough(control.currentWriter(), after),
      submitNote,
      control,
    }),
  );
}

/** The canonical tables a Conversation save must never change, every row in a total order. */
export function canonicalSnapshot(root: string) {
  const databasePath = generationPaths(root).canonical;
  return Object.fromEntries(
    ["project_state", "command_receipts", "command_idempotency", "canonical_events"].map(
      (table) => [table, orderedRows({ databasePath, table })],
    ),
  );
}

/** A schema-4 Project created through the real owner, its owner left running for the test. */
export async function createConversationProject(root: string) {
  const fixture = createUpgradeStorageOwner(root);
  canonicalPaths.set(createRequest.projectId, generationPaths(root).canonical);
  expect(await fixture.owner.create(createRequest)).toMatchObject({
    status: "ready",
    result: { status: "created" },
  });
  return fixture;
}

/** The Project conversation as one read answers it; a failed read fails the test. */
export async function readConversation(session: ConversationSession) {
  const read = await session.read();
  if (read.status !== "completed" || Result.isFailure(read.result))
    throw new Error(`Read failed: ${JSON.stringify(read)}`);
  return read.result.success.conversation;
}

/**
 * Runs `body` in a read-write activation of a new Project. Unless `pinCanonical` is false (a body
 * that settles commands itself), the canonical snapshot must be unchanged at the end.
 */
export async function inConversationProject(
  body: (session: ConversationSession, root: string) => Promise<void>,
  { pinCanonical = true }: Readonly<{ pinCanonical?: boolean }> = {},
) {
  const root = await createTemporaryApplicationRoot();
  const fixture = await createConversationProject(root);
  try {
    await withConversationWriter(
      { storage: fixture.owner, projectId: createRequest.projectId },
      async (session) => {
        const before = canonicalSnapshot(root);
        await body(session, root);
        if (pinCanonical) expect(canonicalSnapshot(root)).toEqual(before);
      },
    );
  } finally {
    await fixture.owner.stop();
  }
}

/** The store's answer to one save; a writer refusal or a typed failure fails the test. */
export async function saveOutcome(session: ConversationSession, input: SaveInput) {
  const saved = await session.save(input);
  if (saved.status !== "completed" || Result.isFailure(saved.result))
    throw new Error(`Save failed: ${JSON.stringify(saved)}`);
  return saved.result.success;
}

export type SaveInput = Parameters<ConversationSession["save"]>[0];

/** Runs raw SQL on the Project database, without FK checks. */
export function rawCanonical(root: string, run: (database: DatabaseSync) => void): void {
  const database = new DatabaseSync(generationPaths(root).canonical, {
    enableForeignKeyConstraints: false,
  });
  try {
    run(database);
  } finally {
    database.close();
  }
}

/** Activates an existing fixture Project in `root` read-write again and runs `body`. */
export async function reopenConversationProject(
  root: string,
  body: (session: ConversationSession) => Promise<void>,
) {
  const fixture = createUpgradeStorageOwner(root);
  try {
    await withConversationWriter(
      { storage: fixture.owner, projectId: createRequest.projectId },
      body,
    );
  } finally {
    await fixture.owner.stop();
  }
}

/** The work's result, timed; the duration is recorded in the test output (#94 margins). */
export async function timed<Value>(name: string, run: () => Promise<Value>) {
  const started = performance.now();
  const value = await run();
  const milliseconds = Math.round(performance.now() - started);
  console.info(`[conversation busy] ${name}: ${milliseconds} ms`);
  return { value, milliseconds };
}

/** Another connection holding an exclusive lock on the Project database until released. */
export function exclusiveLock(root: string) {
  const database = new DatabaseSync(generationPaths(root).canonical);
  database.exec("BEGIN EXCLUSIVE");
  return {
    release: () => {
      database.exec("COMMIT");
      database.close();
    },
  };
}

/** A completed outcome whose result failed with `tag`. */
export const failedWith = (tag: string) => ({
  status: "completed",
  result: { _tag: "Failure", failure: { _tag: tag } },
});
