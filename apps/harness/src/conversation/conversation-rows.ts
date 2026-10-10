import { decodeStrictResult, UuidTextSchema } from "@slopstop/protocol";
import { Effect, Result, Schema } from "effect";
import { canonicalResultObjects } from "../canonical-json.js";
import { canonicalWriterUtcInstantSchema } from "../storage/canonical-command-ledger.js";
import type {
  LocalLibsqlResultSet,
  LocalLibsqlTransaction,
} from "../storage/local-libsql-worker-client.js";
import {
  ConversationStorageBroken,
  type ConversationStorageFailure,
  conversationStorageFailure,
} from "./conversation-errors.js";

const CursorSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));

export const ConversationRowSchema = Schema.Struct({ conversationId: UuidTextSchema });
export const BranchRowSchema = Schema.Struct({ branchId: UuidTextSchema });
const CountSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
/** A branch's message count, highest cursor, and messages of its conversation on other branches. */
export const BranchShapeRowSchema = Schema.Struct({
  total: CountSchema,
  revision: CountSchema,
  stray: CountSchema,
});
export const MessageRowSchema = Schema.Struct({
  messageId: UuidTextSchema,
  cursor: CursorSchema,
  author: Schema.Literal("user"),
  text: Schema.String,
  savedAt: canonicalWriterUtcInstantSchema,
});
export type MessageRow = typeof MessageRowSchema.Type;
export const SavedRowSchema = Schema.Struct({
  messageId: UuidTextSchema,
  cursor: CursorSchema,
  savedAt: canonicalWriterUtcInstantSchema,
  fingerprint: Schema.String,
});

/** What a store program runs statements on: a write transaction or a read-only client. */
export type ConversationExecutor = Pick<LocalLibsqlTransaction, "execute">;

type Statement = Readonly<{ sql: string; args: readonly (string | number)[] }>;

type RowSchema = Schema.ConstraintDecoder<unknown> & Schema.Top;

function decodedRows<S extends RowSchema>(
  schema: S,
  result: LocalLibsqlResultSet,
): Result.Result<readonly S["Type"][], unknown> {
  try {
    return decodeStrictResult(Schema.Array(schema), canonicalResultObjects(result));
  } catch (cause) {
    return Result.fail(cause);
  }
}

/** Runs one statement and strictly decodes every row; any failure is broken storage. */
export function selectRows<S extends RowSchema>(
  tx: ConversationExecutor,
  statement: Statement,
  schema: S,
): Effect.Effect<readonly S["Type"][], ConversationStorageFailure> {
  return Effect.tryPromise({
    try: () => tx.execute({ sql: statement.sql, args: [...statement.args] }),
    catch: conversationStorageFailure,
  }).pipe(
    Effect.flatMap((result) => {
      const rows = decodedRows(schema, result);
      return Result.isSuccess(rows)
        ? Effect.succeed(rows.success)
        : Effect.fail(new ConversationStorageBroken({ cause: rows.failure }));
    }),
  );
}

/** Runs one statement for its effect; any failure is broken storage. */
export function executeStatement(
  tx: ConversationExecutor,
  statement: Statement,
): Effect.Effect<void, ConversationStorageFailure> {
  return Effect.tryPromise({
    try: () => tx.execute({ sql: statement.sql, args: [...statement.args] }),
    catch: conversationStorageFailure,
  }).pipe(Effect.asVoid);
}
