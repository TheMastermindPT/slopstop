import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { ConversationStorageBroken } from "./conversation-errors.js";
import {
  BranchRowSchema,
  type ConversationExecutor,
  ConversationRowSchema,
  MessageRowSchema,
  SavedRowSchema,
  selectRows,
} from "./conversation-rows.js";

const valid = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";
const savedAt = "2026-10-24T12:00:00Z";
const tables = [
  ["ConversationRowSchema.conversationId", ConversationRowSchema, {}, "conversationId"],
  ["BranchRowSchema.branchId", BranchRowSchema, {}, "branchId"],
  [
    "MessageRowSchema.messageId",
    MessageRowSchema,
    { cursor: 1, author: "user", text: "hello", savedAt },
    "messageId",
  ],
  [
    "SavedRowSchema.messageId",
    SavedRowSchema,
    { cursor: 1, savedAt, fingerprint: "a".repeat(64) },
    "messageId",
  ],
] as const;
const spellings = [
  ["nil", "00000000-0000-0000-0000-000000000000"],
  ["max", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
  ["uppercase", valid.toUpperCase()],
] as const;
const cases = tables.flatMap(([name, schema, rest, field]) =>
  spellings.map(([spelling, identity]) => ({
    name: `${name} ${spelling}`,
    schema,
    rest,
    field,
    identity,
  })),
);

/** Answers every statement with one row built from `row`. */
function oneRow(row: Readonly<Record<string, string | number>>): ConversationExecutor {
  return {
    execute: async () => ({
      columns: Object.keys(row),
      rows: [Object.values(row)],
      rowsAffected: 0,
      lastInsertRowid: null,
    }),
  };
}

const statement = { sql: "SELECT", args: [] };

describe("conversation rows", () => {
  it.each(cases)(
    "treats a stored row with a non-strict identity as broken storage ($name)",
    async ({ schema, rest, field, identity }) => {
      const read = (value: string) =>
        Effect.runPromise(
          Effect.result(selectRows(oneRow({ ...rest, [field]: value }), statement, schema)),
        );
      const accepted = await read(valid);
      expect(Result.isSuccess(accepted) && accepted.success).toEqual([
        expect.objectContaining({ [field]: valid }),
      ]);
      const refused = await read(identity);
      expect(Result.isFailure(refused) && refused.failure).toBeInstanceOf(
        ConversationStorageBroken,
      );
    },
  );
});
