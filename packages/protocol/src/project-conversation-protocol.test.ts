import { describe, expect, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import * as protocol from "./index.js";
import { acceptsStrict } from "./schema-codec.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const activationId = "00000000-0000-4000-8000-000000000011";
const saveId = "00000000-0000-4000-8000-000000000012";
const readRequest = { projectId, activationId, after: null };
const saveRequest = { projectId, activationId, saveId, expectedRevision: 0, text: "Hello" };
const envelope = {
  protocolVersion: 9,
  messageType: "command",
  messageId: "00000000-0000-4000-8000-000000000013",
  sentAt: "2026-10-10T12:00:00.000Z",
} as const;

/** The design's result table, one row per line: key, code, message, retryable. */
const resultTable = [
  ["saveIdReused", "SAVE_ID_REUSED", "This save was already used for different text.", false],
  [
    "saveUnconfirmed",
    "CONVERSATION_SAVE_UNCONFIRMED",
    "The save could not be confirmed. Try again to check it.",
    true,
  ],
  ["inactive", "PROJECT_INACTIVE", "No Project is open.", false],
  ["projectMismatch", "PROJECT_NOT_ACTIVE", "This Project is not the open Project.", false],
  [
    "staleActivation",
    "PROJECT_ACTIVATION_STALE",
    "The Project was reopened. Reload the conversation.",
    false,
  ],
  [
    "coordinatorUnavailable",
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "Canonical Project coordination is unavailable.",
    false,
  ],
  [
    "readOnly",
    "WRITER_UNAVAILABLE",
    "This Project is open read-only because another process is using it, so saving is disabled.",
    true,
  ],
  [
    "writerUnavailable",
    "WRITER_UNAVAILABLE",
    "Saving is unavailable until the Project is reopened.",
    false,
  ],
  [
    "staleWriter",
    "WRITER_FENCE_STALE",
    "Another writer took over this Project. Reopen it to continue.",
    false,
  ],
  ["storageUnavailable", "PROJECT_STORAGE_UNAVAILABLE", "Project Storage is unavailable.", true],
  [
    "connectionLost",
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "The Project connection is unavailable.",
    true,
  ],
  ["storageBroken", "PROJECT_STORAGE_BROKEN", "Project Storage could not be read safely.", false],
  [
    "harnessInternalFailure",
    "HARNESS_INTERNAL_FAILURE",
    "Harness failed while handling a message.",
    false,
  ],
  [
    "protocolMessageInvalid",
    "PROTOCOL_MESSAGE_INVALID",
    "Harness received an invalid protocol message.",
    false,
  ],
  [
    "protocolVersionUnsupported",
    "PROTOCOL_VERSION_UNSUPPORTED",
    "Desktop and harness protocol versions are incompatible.",
    false,
  ],
] as const;
type RowKey = (typeof resultTable)[number][0];
const expectedDiagnostics = Object.fromEntries(
  resultTable.map(([key, code, message, retryable]) => [key, { code, message, retryable }]),
);
/** One row of the table, as a result's diagnostic. */
function expectedRow(key: RowKey) {
  const found = resultTable.find(([name]) => name === key);
  if (found === undefined) throw new Error(`No result row ${key}.`);
  const [, code, message, retryable] = found;
  return { code, message, retryable };
}

const sharedRows: readonly (readonly [string, RowKey])[] = [
  ["inactive", "inactive"],
  ["project-mismatch", "projectMismatch"],
  ["stale-activation", "staleActivation"],
  ["coordinator-unavailable", "coordinatorUnavailable"],
  ["unavailable", "storageUnavailable"],
  ["unavailable", "connectionLost"],
  ["broken", "storageBroken"],
  ["broken", "harnessInternalFailure"],
  ["broken", "protocolMessageInvalid"],
  ["broken", "protocolVersionUnsupported"],
];
const saveOnlyRows: readonly (readonly [string, RowKey])[] = [
  ["rejected", "saveIdReused"],
  ["uncertain", "saveUnconfirmed"],
  ["read-only", "readOnly"],
  ["writer-unavailable", "writerUnavailable"],
  ["stale-writer", "staleWriter"],
];

const storedMessage = {
  conversationMessageId: "00000000-0000-4000-8000-000000000022",
  cursor: 1,
  author: "user",
  text: "Hello",
  savedAt: "2026-10-10T12:00:01.000Z",
};
const conversation = {
  conversationId: "00000000-0000-4000-8000-000000000020",
  branchId: "00000000-0000-4000-8000-000000000021",
  revision: 1,
  messages: [storedMessage],
  nextCursor: null,
};
const saved = {
  status: "saved",
  request: saveRequest,
  conversationMessageId: "00000000-0000-4000-8000-000000000022",
  cursor: 1,
  revision: 1,
  savedAt: "2026-10-10T12:00:01.000Z",
  replayed: false,
};

const readCommand = (payload: unknown) => ({
  ...envelope,
  command: "project.conversation.read",
  payload,
});
const saveCommand = (payload: unknown) => ({
  ...envelope,
  command: "project.conversation.save",
  payload,
});
const failureRow = (status: string, diagnostic: unknown) => ({
  status,
  request: saveRequest,
  diagnostic,
});

describe("CNV-B12 encodes conversation messages strictly", () => {
  it("keeps one diagnostic map equal to the result table", () => {
    expect(protocol.projectConversationDiagnostics).toEqual(expectedDiagnostics);
  });

  it.each([...sharedRows, ...saveOnlyRows])("round-trips save %s %s", (status, key) => {
    const result = { status, request: saveRequest, diagnostic: expectedRow(key) };
    expect(protocol.decodeStrict(protocol.ProjectConversationSaveResultSchema, result)).toEqual(
      result,
    );
  });

  it.each(sharedRows)("round-trips read %s %s", (status, key) => {
    const result = { status, request: readRequest, diagnostic: expectedRow(key) };
    expect(protocol.decodeStrict(protocol.ProjectConversationReadResultSchema, result)).toEqual(
      result,
    );
  });

  it.each(saveOnlyRows)("refuses the save-only row %s %s on a read", (status, key) => {
    const result = { status, request: readRequest, diagnostic: expectedRow(key) };
    expect(acceptsStrict(protocol.ProjectConversationReadResultSchema, result)).toBe(false);
  });

  it.each([
    ["a row in the wrong status", failureRow("unavailable", expectedRow("storageBroken"))],
    [
      "the read-only row as writer-unavailable",
      failureRow("writer-unavailable", expectedRow("readOnly")),
    ],
    [
      "a changed message",
      failureRow("broken", { ...expectedRow("storageBroken"), message: "Broken." }),
    ],
    [
      "a changed retryable flag",
      failureRow("read-only", { ...expectedRow("readOnly"), retryable: false }),
    ],
    ["an extra key", { ...failureRow("inactive", expectedRow("inactive")), extra: 1 }],
    ["an extra key on saved", { ...saved, extra: 1 }],
  ])("refuses a save result with %s", (_name, value) => {
    expect(acceptsStrict(protocol.ProjectConversationSaveResultSchema, value)).toBe(false);
  });

  it("round-trips read, saved and conflict results", () => {
    const read = protocol.ProjectConversationReadResultSchema;
    const save = protocol.ProjectConversationSaveResultSchema;
    for (const value of [
      { status: "read", request: readRequest, conversation: null },
      { status: "read", request: { ...readRequest, after: 100 }, conversation },
    ])
      expect(protocol.decodeStrict(read, value)).toEqual(value);
    for (const value of [
      saved,
      { ...saved, replayed: true },
      { status: "conflict", request: saveRequest, currentRevision: 3 },
    ])
      expect(protocol.decodeStrict(save, value)).toEqual(value);
  });

  it.each([
    ["a message cursor 0", { messages: [{ ...storedMessage, cursor: 0 }] }],
    ["a negative revision", { revision: -1 }],
    ["a negative nextCursor", { nextCursor: -1 }],
    ["a fractional revision", { revision: 1.5 }],
  ])("refuses a read result with %s", (_name, change) => {
    const value = {
      status: "read",
      request: readRequest,
      conversation: { ...conversation, ...change },
    };
    expect(acceptsStrict(protocol.ProjectConversationReadResultSchema, value)).toBe(false);
  });

  it.each([
    ["a saved cursor 0", { ...saved, cursor: 0 }],
    ["a saved negative revision", { ...saved, revision: -1 }],
    [
      "a conflict with a negative revision",
      { status: "conflict", request: saveRequest, currentRevision: -1 },
    ],
  ])("refuses %s", (_name, value) => {
    expect(acceptsStrict(protocol.ProjectConversationSaveResultSchema, value)).toBe(false);
  });

  it.each([
    ["read after null", readCommand(readRequest)],
    ["read after 0", readCommand({ ...readRequest, after: 0 })],
    ["read after 100", readCommand({ ...readRequest, after: 100 })],
    ["save expectedRevision 0", saveCommand(saveRequest)],
    ["save expectedRevision 7", saveCommand({ ...saveRequest, expectedRevision: 7 })],
  ])("accepts %s", (_name, command) => {
    expect(protocol.parseDesktopMessage(command)).toEqual({ ok: true, value: command });
  });

  it.each([
    ["read after -1", readCommand({ ...readRequest, after: -1 })],
    ["read after 1.5", readCommand({ ...readRequest, after: 1.5 })],
    ["read without activationId", readCommand({ projectId, after: null })],
    ["read with a non-UUID projectId", readCommand({ ...readRequest, projectId: "project" })],
    ["read with an extra key", readCommand({ ...readRequest, extra: 1 })],
    ["save expectedRevision -1", saveCommand({ ...saveRequest, expectedRevision: -1 })],
    ["save expectedRevision 1.5", saveCommand({ ...saveRequest, expectedRevision: 1.5 })],
    ["save saveId not-a-uuid", saveCommand({ ...saveRequest, saveId: "not-a-uuid" })],
    [
      "save without activationId",
      saveCommand({ projectId, saveId, expectedRevision: 0, text: "Hello" }),
    ],
    ["save with a non-UUID projectId", saveCommand({ ...saveRequest, projectId: "project" })],
    ["save with an extra key", saveCommand({ ...saveRequest, extra: 1 })],
  ])("rejects %s", (_name, command) => {
    expect(protocol.parseDesktopMessage(command)).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_MESSAGE_INVALID" },
    });
  });

  it("rejects a version-7 conversation command as unsupported", () => {
    expect(
      protocol.parseDesktopMessage({ ...saveCommand(saveRequest), protocolVersion: 7 }),
    ).toMatchObject({ ok: false, error: { code: "PROTOCOL_VERSION_UNSUPPORTED" } });
  });

  const largest = "é".repeat(16_384);
  it.each([
    ["32768 UTF-8 bytes", largest, undefined],
    ["32769 UTF-8 bytes", `${largest}a`, "too-large"],
    ["empty text", "", "empty"],
    ["spaces, a tab and line breaks", " \t\r\n", "whitespace-only"],
    ["no-break spaces", "  ", "whitespace-only"],
    ["text with surrounding spaces", "  kept  ", undefined],
  ])("judges %s", (_name, text, problem) => {
    expect(protocol.conversationTextProblem(text)).toBe(problem);
    const parsed = protocol.parseDesktopMessage(saveCommand({ ...saveRequest, text }));
    expect(parsed.ok).toBe(problem === undefined);
  });

  /** The platform encoder's byte count, the independent oracle for the size rule. */
  function encodedBytes(text: string): number {
    const Encoder: unknown = Reflect.get(globalThis, "TextEncoder");
    if (typeof Encoder !== "function") throw new Error("TextEncoder is unavailable.");
    const encoded: unknown = Reflect.construct(Encoder, []).encode(text);
    const length: unknown = Reflect.get(Object(encoded), "length");
    if (typeof length !== "number") throw new Error("TextEncoder returned no length.");
    return length;
  }

  it.each([
    ["ASCII", "a", 1],
    ["a 2-byte character", "é", 2],
    ["a 3-byte character", "€", 3],
    ["a 4-byte character", "\u{1f600}", 4],
    ["a lone surrogate", "\ud800", 3],
    ["U+007F, the last 1-byte code point", "\u007f", 1],
    ["U+0080, the first 2-byte code point", "\u0080", 2],
    ["U+07FF, the last 2-byte code point", "߿", 2],
    ["U+0800, the first 3-byte code point", "ࠀ", 3],
    ["U+FFFF, the last 3-byte code point", "￿", 3],
    ["U+10000, the first 4-byte code point", "\u{10000}", 4],
  ])("counts %s at the 32768-byte boundary as the platform encoder does", (_name, unit, bytes) => {
    expect(encodedBytes(unit)).toBe(bytes);
    const units = Math.floor(32_768 / bytes);
    const atLimit = unit.repeat(units) + "a".repeat(32_768 - units * bytes);
    expect(encodedBytes(atLimit)).toBe(32_768);
    expect(protocol.conversationTextProblem(atLimit)).toBeUndefined();
    expect(encodedBytes(`${atLimit}a`)).toBe(32_769);
    expect(protocol.conversationTextProblem(`${atLimit}a`)).toBe("too-large");
    expect(protocol.conversationTextProblem(`${atLimit}${unit}`)).toBe("too-large");
  });
});

it("names why message text cannot be saved (CNV-B12)", () => {
  expect(() =>
    protocol.decodeStrict(protocol.ProjectConversationSaveRequestSchema, {
      ...saveRequest,
      text: " ",
    }),
  ).toThrow("Message text cannot be saved.");
});

it.each([
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF",
])("rejects a non-strict save id (%s)", (value) => {
  expect(decodeWithIssues(protocol.ProjectConversationSaveRequestSchema, saveRequest).success).toBe(
    true,
  );
  const decoded = decodeWithIssues(protocol.ProjectConversationSaveRequestSchema, {
    ...saveRequest,
    saveId: value,
  });
  expect(decoded.success).toBe(false);
  expect(decoded.error?.issues.map((issue) => issue.path)).toEqual([["saveId"]]);
});
