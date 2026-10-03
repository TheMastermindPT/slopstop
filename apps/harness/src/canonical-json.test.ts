import { createHash } from "node:crypto";
import {
  CanonicalProjectCommandRequestSchema,
  decodeStrict,
  ProjectIdSchema,
  TypedCommandSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
import { expect, it } from "vitest";
import {
  canonicalJsonText,
  hashCanonicalJson,
  readCanonicalCommandSnapshot,
  snapshotCanonicalCommand,
} from "./canonical-json.js";

it.each([
  [null, "null"],
  [true, "true"],
  [false, "false"],
  [[], "[]"],
  [{}, "{}"],
  ["", '""'],
  ["  e\u0301  ", '"  e\u0301  "'],
  ["\u00e9", '"\u00e9"'],
  [-0, "0"],
  [0, "0"],
  ["0", '"0"'],
  [0.125, "0.125"],
  [["x", "y"], '["x","y"]'],
  [["y", "x"], '["y","x"]'],
  [{ "\ue000": 2, "\ud83d\ude00": 1 }, '{"\ud83d\ude00":1,"\ue000":2}'],
])("preserves finite JSON edge values without prototype assignment: %j -> %s", (value, text) => {
  expect(canonicalJsonText(value)).toBe(text);
  expect(hashCanonicalJson(value)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
});

it("preserves finite JSON edge values without prototype assignment: own proto and numeric keys", () => {
  const value: unknown = JSON.parse(
    '{"__proto__":{"x":1},"10":10,"2":2,"text":"  e\\u0301  ","n":-0}',
  );
  const text = '{"10":10,"2":2,"__proto__":{"x":1},"n":0,"text":"  e\u0301  "}';
  expect(canonicalJsonText(value)).toBe(text);
  expect(hashCanonicalJson(value)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
});

it("canonicalizes submitted command content without changing its meaning: recursive key order", () => {
  const left = { tags: ["x", "y"], value: 7, meta: { b: 2, a: 1 } };
  const right = { meta: { a: 1, b: 2 }, tags: ["x", "y"], value: 7 };
  const text = '{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7}';
  expect(canonicalJsonText(left)).toBe(text);
  expect(canonicalJsonText(right)).toBe(text);
  const digest = createHash("sha256").update(text, "utf8").digest("hex");
  expect(hashCanonicalJson(left)).toBe(digest);
  expect(hashCanonicalJson(right)).toBe(digest);
});

it.each([NaN, Infinity, -Infinity, undefined, 1n, Symbol("invalid"), () => 1, new Date()])(
  "preserves finite JSON edge values without prototype assignment: invalid direct value %s",
  (value) => {
    expect(() => canonicalJsonText(value)).toThrow(Schema.SchemaError);
    expect(() => canonicalJsonText({ nested: value })).toThrow(Schema.SchemaError);
  },
);

const submitted = {
  projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  command: {
    commandId: "44444444-4444-4444-8444-444444444501",
    type: "conformance.counter.set",
    version: 1,
    payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
  },
};
const fingerprintText =
  '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';

it("freezes submission meaning before asynchronous repository work: synchronous snapshot", () => {
  const input = decodeStrict(CanonicalProjectCommandRequestSchema, structuredClone(submitted));
  const text = snapshotCanonicalCommand(input.projectId, input.command);
  Reflect.set(input.command, "commandId", "44444444-4444-4444-8444-444444444502");
  Reflect.set(input.command, "type", "conformance.counter.other");
  Reflect.set(input.command, "version", 2);
  if (input.command.payload === null || typeof input.command.payload !== "object") {
    throw new Error("Expected object payload.");
  }
  Reflect.set(input.command.payload, "value", 8);
  Reflect.set(input.command.payload, "meta", { a: 99, b: 2 });
  expect(text).toBe(fingerprintText);
  const snapshot = readCanonicalCommandSnapshot(text);
  expect(snapshot).toEqual({
    ...submitted.command,
    projectId: submitted.projectId,
    fingerprintVersion: 1,
  });
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(hashCanonicalJson(snapshot)).toBe(
    createHash("sha256").update(fingerprintText, "utf8").digest("hex"),
  );
});

it.each([
  {
    field: "tags",
    command: { ...submitted.command, payload: { ...submitted.command.payload, tags: ["y", "x"] } },
    text: fingerprintText.replace('["x","y"]', '["y","x"]'),
  },
  {
    field: "value",
    command: { ...submitted.command, payload: { ...submitted.command.payload, value: 8 } },
    text: fingerprintText.replace('"value":7', '"value":8'),
  },
  {
    field: "type",
    command: { ...submitted.command, type: "conformance.counter.other" },
    text: fingerprintText.replace("conformance.counter.set", "conformance.counter.other"),
  },
  {
    field: "version",
    command: { ...submitted.command, version: 2 },
    text: fingerprintText.replace('"version":1', '"version":2'),
  },
])(
  "canonicalizes submitted command content without changing its meaning: fingerprint $field",
  ({ command, text }) => {
    const actual = snapshotCanonicalCommand(
      decodeStrict(ProjectIdSchema, submitted.projectId),
      decodeStrict(TypedCommandSchema, command),
    );
    expect(actual).toBe(text);
    expect(hashCanonicalJson(readCanonicalCommandSnapshot(actual))).toBe(
      createHash("sha256").update(text, "utf8").digest("hex"),
    );
    expect(actual).not.toBe(fingerprintText);
  },
);

it("canonicalizes submitted command content without changing its meaning: Project versus epoch", () => {
  const first = decodeStrict(CanonicalProjectCommandRequestSchema, submitted);
  const second = decodeStrict(CanonicalProjectCommandRequestSchema, {
    ...submitted,
    activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  });
  expect(snapshotCanonicalCommand(first.projectId, first.command)).toBe(fingerprintText);
  expect(snapshotCanonicalCommand(second.projectId, second.command)).toBe(fingerprintText);
  const otherProject = decodeStrict(ProjectIdSchema, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2");
  expect(snapshotCanonicalCommand(otherProject, first.command)).toBe(
    fingerprintText.replace(submitted.projectId, otherProject),
  );
});

it("canonicalizes submitted command content without changing its meaning: raw omitted tags", () => {
  const project = decodeStrict(ProjectIdSchema, submitted.projectId);
  const base = decodeStrict(TypedCommandSchema, { ...submitted.command, payload: { value: 7 } });
  const explicit = decodeStrict(TypedCommandSchema, {
    ...submitted.command,
    payload: { value: 7, tags: [] },
  });
  const prefix =
    '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":';
  const suffix =
    ',"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';
  expect(snapshotCanonicalCommand(project, base)).toBe(`${prefix}{"value":7}${suffix}`);
  expect(snapshotCanonicalCommand(project, explicit)).toBe(
    `${prefix}{"tags":[],"value":7}${suffix}`,
  );
});

it.each([
  ` ${fingerprintText}`,
  fingerprintText.replace('"fingerprintVersion":1', '"fingerprintVersion":2'),
  fingerprintText.replace('"commandId":', '"extra":true,"commandId":'),
  fingerprintText.replace('"version":1', '"version":0'),
])(
  "freezes submission meaning before asynchronous repository work: rejects invalid snapshot %s",
  (text) => {
    expect(() => readCanonicalCommandSnapshot(text)).toThrow();
  },
);
