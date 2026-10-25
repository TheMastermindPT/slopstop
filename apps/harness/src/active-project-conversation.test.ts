import {
  ConversationMessageIdSchema,
  decodeStrict,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  projectConversationDiagnostics as rows,
} from "@slopstop/protocol";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  type ConversationActivation,
  type ConversationPorts,
  readConversation,
  saveConversation,
} from "./active-project-conversation.js";
import type { CanonicalProjectWriter } from "./canonical-project-writer.js";
import {
  ConversationStorageBroken,
  ConversationStorageBusy,
} from "./conversation/conversation-errors.js";
import type { LocalLibsqlTransaction } from "./storage/local-libsql-worker-client.js";

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
const activationId = decodeStrict(
  ProjectActivationIdSchema,
  "00000000-0000-4000-8000-000000000011",
);
const savedAt = "2026-10-10T12:00:00.000Z";
const ids = [
  "00000000-0000-4000-8000-000000000071",
  "00000000-0000-4000-8000-000000000072",
  "00000000-0000-4000-8000-000000000073",
];

/** Ports whose ids come in order and whose clock is fixed; read-only reads are refused. */
function ports(overrides: Partial<ConversationPorts> = {}): ConversationPorts {
  let next = 0;
  return {
    createId: () => ids[next++ % ids.length] ?? "",
    now: () => savedAt,
    readConversationReadOnly: () => Effect.die(new Error("Unexpected read-only read.")),
    ...overrides,
  };
}

const empty = { columns: [], rows: [], rowsAffected: 0, lastInsertRowid: null } as const;

/** A transaction answering `answer(sql, args)`: no rows unless a test gives a row set. */
function transaction(
  answer: (sql: string, args: unknown) => Promise<typeof empty | object> = async () => empty,
): LocalLibsqlTransaction {
  return {
    closed: false,
    execute: async (statement) => {
      const sql = typeof statement === "string" ? statement : statement.sql;
      const args = typeof statement === "string" ? [] : statement.args;
      return Object.assign({}, empty, await answer(sql, args));
    },
    commit: async () => undefined,
    rollback: async () => undefined,
    close: async () => undefined,
  };
}

type Writer = Pick<CanonicalProjectWriter, "conversation" | "conversationRead">;

/** A writer that runs the work on `tx` and answers completed, or answers `status` instead. */
function writer(
  tx: LocalLibsqlTransaction,
  status?: "writer-unavailable" | "stale-writer" | "commit-uncertain",
): Writer {
  const run: Writer["conversation"] = async (work) =>
    status === undefined
      ? { status: "completed", result: await Effect.runPromise(Effect.result(work(tx))) }
      : { status };
  return {
    conversation: run,
    conversationRead: async (work) => ({
      status: "completed",
      result: await Effect.runPromise(Effect.result(work(tx))),
    }),
  };
}

const activation = (activeWriter: Writer): ConversationActivation => ({
  canonicalDatabasePath: "unused.db",
  access: "read-write",
  writer: activeWriter,
});
const admitted = (active: ConversationActivation) =>
  ({ status: "admitted", activation: active }) as const;
const save = {
  projectId,
  activationId,
  saveId: "00000000-0000-4000-8000-000000000074",
  expectedRevision: 0,
  text: "Hello",
};

const sqliteError = (code: string) => Object.assign(new Error(code), { code });

/** A conversation whose root branch holds three contiguous messages. */
const threeSaved = async (sql: string) => {
  if (sql.includes("FROM conversations WHERE"))
    return { columns: ["conversationId"], rows: [[ids[0]]] };
  if (sql.includes("FROM conversation_branches WHERE"))
    return { columns: ["branchId"], rows: [[ids[1]]] };
  if (sql.includes("AS total"))
    return { columns: ["total", "revision", "stray"], rows: [[3, 3, 0]] };
  return empty;
};

describe("saveConversation maps every store outcome to its protocol row", () => {
  it("answers saved for a first message", async () => {
    const result = await Effect.runPromise(
      saveConversation(admitted(activation(writer(transaction()))), save, ports()),
    );
    expect(result).toEqual({
      status: "saved",
      request: save,
      conversationMessageId: ids[2],
      cursor: 1,
      revision: 1,
      savedAt,
      replayed: false,
    });
  });

  it("answers conflict with the current revision", async () => {
    expect(
      await Effect.runPromise(
        saveConversation(admitted(activation(writer(transaction(threeSaved)))), save, ports()),
      ),
    ).toEqual({ status: "conflict", request: save, currentRevision: 3 });
  });

  it("answers rejected for a save id reused with other text", async () => {
    const reused = transaction(async (sql) =>
      sql.includes("WHERE save_id")
        ? {
            columns: ["messageId", "cursor", "savedAt", "fingerprint"],
            rows: [[ids[0], 1, savedAt, "other"]],
          }
        : empty,
    );
    expect(
      await Effect.runPromise(
        saveConversation(admitted(activation(writer(reused))), save, ports()),
      ),
    ).toEqual({
      status: "rejected",
      request: save,
      diagnostic: rows.saveIdReused,
    });
  });

  it.each([
    ["writer-unavailable", rows.writerUnavailable],
    ["stale-writer", rows.staleWriter],
  ] as const)("answers %s from the writer", async (status, diagnostic) => {
    expect(
      await Effect.runPromise(
        saveConversation(admitted(activation(writer(transaction(), status))), save, ports()),
      ),
    ).toEqual({
      status,
      request: save,
      diagnostic,
    });
  });

  it.each([
    ["SQLITE_BUSY", "unavailable", rows.storageUnavailable],
    ["SQLITE_IOERR", "broken", rows.storageBroken],
  ] as const)("answers %s storage as %s", async (code, status, diagnostic) => {
    const failing = transaction(async () => {
      throw sqliteError(code);
    });
    expect(
      await Effect.runPromise(
        saveConversation(admitted(activation(writer(failing))), save, ports()),
      ),
    ).toEqual({
      status,
      request: save,
      diagnostic,
    });
  });

  it("answers uncertain through the injected reconciliation opener", async () => {
    const openReconciliationClient = vi.fn<
      NonNullable<ConversationPorts["openReconciliationClient"]>
    >(() => {
      throw sqliteError("SQLITE_CANTOPEN");
    });
    const reconciliation = ports({ openReconciliationClient });
    expect(
      await Effect.runPromise(
        saveConversation(
          admitted(activation(writer(transaction(), "commit-uncertain"))),
          save,
          reconciliation,
        ),
      ),
    ).toEqual({ status: "uncertain", request: save, diagnostic: rows.saveUnconfirmed });
    expect(openReconciliationClient).toHaveBeenCalledExactlyOnceWith("unused.db");
  });

  it("answers read-only for a read-only activation", async () => {
    const readOnly: ConversationActivation = {
      canonicalDatabasePath: "unused.db",
      access: "read-only",
    };
    expect(await Effect.runPromise(saveConversation(admitted(readOnly), save, ports()))).toEqual({
      status: "read-only",
      request: save,
      diagnostic: rows.readOnly,
    });
  });
});

describe("readConversation reads through the writer's slot", () => {
  it("reads the request's Project after the request's cursor", async () => {
    const statements: unknown[][] = [];
    const recording = transaction(async (sql, args) => {
      statements.push(Array.isArray(args) ? args : []);
      return threeSaved(sql);
    });
    const read = { projectId, activationId, after: 2 };
    const result = await Effect.runPromise(
      readConversation(admitted(activation(writer(recording))), read, ports()),
    );
    expect(result.status).toBe("read");
    expect(statements[0]).toContain(projectId);
    expect(statements.at(-1)?.[1]).toBe(2);
  });
});

describe("readConversation maps the read-only reader's answers", () => {
  const read = { projectId, activationId, after: null };
  const readOnly: ConversationActivation = {
    canonicalDatabasePath: "unused.db",
    access: "read-only",
  };

  it("answers the page with its messages", async () => {
    const page = {
      conversation: {
        conversationId: ids[0] ?? "",
        branchId: ids[1] ?? "",
        revision: 1,
        messages: [
          {
            messageId: decodeStrict(ConversationMessageIdSchema, ids[2]),
            cursor: 1,
            author: "user" as const,
            text: "Hello",
            savedAt,
          },
        ],
        nextCursor: null,
      },
    };
    expect(
      await Effect.runPromise(
        readConversation(
          admitted(readOnly),
          read,
          ports({ readConversationReadOnly: () => Effect.succeed(page) }),
        ),
      ),
    ).toEqual({
      status: "read",
      request: read,
      conversation: {
        conversationId: ids[0],
        branchId: ids[1],
        revision: 1,
        messages: [
          { conversationMessageId: ids[2], cursor: 1, author: "user", text: "Hello", savedAt },
        ],
        nextCursor: null,
      },
    });
  });

  it.each([
    [
      "busy",
      new ConversationStorageBusy({ cause: "held" }),
      "unavailable",
      rows.storageUnavailable,
    ],
    ["broken", new ConversationStorageBroken({ cause: "corrupt" }), "broken", rows.storageBroken],
  ] as const)("answers a %s reader with its row", async (_name, failure, status, diagnostic) => {
    expect(
      await Effect.runPromise(
        readConversation(
          admitted(readOnly),
          read,
          ports({ readConversationReadOnly: () => Effect.fail(failure) }),
        ),
      ),
    ).toEqual({
      status,
      request: read,
      diagnostic,
    });
  });
});
