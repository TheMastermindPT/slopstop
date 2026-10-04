import { createHash } from "node:crypto";
import {
  type CanonicalJsonValue,
  CanonicalJsonValueSchema,
  decodeStrict,
  frozenOutput,
  type ProjectId,
  ProjectIdSchema,
  type TypedCommand,
  TypedCommandSchema,
  UuidTextSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
import type { LocalLibsqlResultSet } from "./storage/local-libsql-worker-client.js";

export const CanonicalSha256Schema = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));

export function canonicalResultObjects(result: LocalLibsqlResultSet): unknown[] {
  if (new Set(result.columns).size !== result.columns.length)
    throw new Error("Canonical Writer result contains duplicate column aliases.");
  if (result.rows.some((row) => row.length !== result.columns.length))
    throw new Error("Canonical Writer result row width does not match its columns.");
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}
export function canonicalExactlyOne<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined)
    throw new Error("Canonical Writer authority must contain exactly one row.");
  return row;
}
export function canonicalChangedOnce(result: LocalLibsqlResultSet): void {
  if (result.rowsAffected !== 1)
    throw new Error("Canonical Writer row was not changed exactly once.");
}

export const CanonicalStoredIdentitySchema = UuidTextSchema.check(
  Schema.makeFilter((value: string) => value === value.toLowerCase()),
);

function renderJson(value: CanonicalJsonValue): string {
  if (value === null || typeof value !== "object") {
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error("Canonical JSON value is invalid.");
    return text;
  }
  if (Array.isArray(value)) return `[${value.map(renderJson).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${renderJson(child)}`).join(",")}}`;
}

export function canonicalJsonText(value: unknown): string {
  return renderJson(decodeStrict(CanonicalJsonValueSchema, value));
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonText(value), "utf8").digest("hex");
}

const commandSnapshotSchema = frozenOutput(
  Schema.Struct({
    ...TypedCommandSchema.fields,
    projectId: ProjectIdSchema,
    fingerprintVersion: Schema.Literal(1),
  }),
);
export type CanonicalCommandSnapshot = typeof commandSnapshotSchema.Type;

export function snapshotCanonicalCommand(projectId: ProjectId, command: TypedCommand): string {
  return canonicalJsonText(
    decodeStrict(commandSnapshotSchema, { ...command, projectId, fingerprintVersion: 1 }),
  );
}

export function parseCanonicalJson(text: string): CanonicalJsonValue {
  const value: unknown = JSON.parse(text);
  return decodeStrict(CanonicalJsonValueSchema, value);
}

export function readCanonicalCommandSnapshot(text: string): CanonicalCommandSnapshot {
  const snapshot = decodeStrict(commandSnapshotSchema, parseCanonicalJson(text));
  if (canonicalJsonText(snapshot) !== text) throw new Error("Command snapshot is not canonical.");
  return snapshot;
}
