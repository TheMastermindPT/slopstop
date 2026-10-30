import { expect, it, vi } from "vitest";
import { createHarnessLogLineForwarder } from "./harness-log-lines.js";

const limit = 16 * 1024;
const tooLong = [
  "warn",
  { code: "HARNESS_LOG_LINE_TOO_LONG", attempt: 1 },
  "Harness output line dropped.",
];

function forwarder() {
  const calls: unknown[][] = [];
  const logger = {
    info: vi.fn((object: unknown, message?: unknown) => calls.push(["info", object, message])),
    warn: vi.fn((object: unknown, message?: unknown) => calls.push(["warn", object, message])),
    error: vi.fn((object: unknown, message?: unknown) => calls.push(["error", object, message])),
  };
  return { calls, lines: createHarnessLogLineForwarder(logger, 1) };
}

/** Pushes one complete `line` and expects exactly `expected` logger calls. */
function expectOnlyCall(line: string, expected: readonly unknown[]) {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from(`${line}\n`));
  expect(calls).toEqual(expected);
}

const cases = [
  { name: "exactly 16 KiB in one chunk", chunks: [`${"x".repeat(limit)}\n`], expected: [] },
  {
    name: "exactly 16 KiB buffered before its newline",
    chunks: ["x".repeat(limit), "\n"],
    expected: [],
  },
  { name: "16 KiB + 1 in one chunk", chunks: [`${"x".repeat(limit + 1)}\n`], expected: [tooLong] },
  {
    name: "16 KiB + 1 across chunks",
    chunks: ["x".repeat(limit), "x", "\n"],
    expected: [tooLong],
  },
] as const;

it.for(cases)("bounds every harness output line at 16 KiB: $name", (lineCase) => {
  const { calls, lines } = forwarder();
  for (const chunk of lineCase.chunks) lines.push(Buffer.from(chunk));
  lines.end();
  expect(calls).toEqual(lineCase.expected);
});

it("reports a partial character left at exit as an incomplete line", () => {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from("€").subarray(0, 1));
  lines.end();
  expect(calls).toEqual([
    [
      "warn",
      { code: "HARNESS_LOG_LINE_INCOMPLETE", attempt: 1 },
      "Harness output line incomplete.",
    ],
  ]);
});

const abandonedLine = (time: number) =>
  JSON.stringify({
    level: 30,
    time,
    service: "harness",
    event: "project-storage.upgrade.abandoned",
    projectId: "00000000-0000-4000-8000-000000000010",
    upgradeId: "00000000-0000-4000-8000-0000000000a1",
    reason: "failed",
  });
const invalidAbandoned = [
  "warn",
  { code: "HARNESS_LOG_LINE_INVALID", attempt: 1, event: "project-storage.upgrade.abandoned" },
  "Harness upgrade log line rejected.",
];

it("reports an overlong unfinished line once, as too long rather than incomplete", () => {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from("x".repeat(limit)));
  expect(calls).toEqual([]);
  lines.push(Buffer.from("x"));
  expect(calls).toEqual([tooLong]);
  lines.end();
  expect(calls).toEqual([tooLong]);
});

it("drops the whole overlong line once and forwards the next line", () => {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from("x".repeat(limit + 1)));
  lines.push(Buffer.from("y".repeat(limit + 1)));
  lines.push(Buffer.from(`\n${abandonedLine(0)}\n`));
  expect(calls).toEqual([
    tooLong,
    [
      "info",
      {
        source: "harness",
        event: "project-storage.upgrade.abandoned",
        projectId: "00000000-0000-4000-8000-000000000010",
        upgradeId: "00000000-0000-4000-8000-0000000000a1",
        reason: "failed",
        harnessTime: "1970-01-01T00:00:00.000Z",
      },
      "Harness upgrade event.",
    ],
  ]);
});

it("ignores JSON lines that are not objects", () => {
  const { calls, lines } = forwarder();
  expect(() => lines.push(Buffer.from("null\n42\n"))).not.toThrow();
  expect(calls).toEqual([]);
});

const outOfRange = [
  { name: "after year 9999", time: 253_402_300_800_000 },
  { name: "before year 0000", time: -62_167_219_200_001 },
] as const;

it.for(outOfRange)("rejects an upgrade line whose time is $name", (range) => {
  const { calls, lines } = forwarder();
  expect(() => lines.push(Buffer.from(`${abandonedLine(range.time)}\n`))).not.toThrow();
  expect(calls).toEqual([invalidAbandoned]);
});

const inRange = [
  { name: "the last instant of year 9999", time: 253_402_300_799_999 },
  { name: "the first instant of year 0000", time: -62_167_219_200_000 },
] as const;

it.for(inRange)("forwards an upgrade line whose time is $name", (range) => {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from(`${abandonedLine(range.time)}\n`));
  expect(calls).toEqual([
    [
      "info",
      expect.objectContaining({ harnessTime: new Date(range.time).toISOString() }),
      "Harness upgrade event.",
    ],
  ]);
});

const completedFields = {
  event: "project-storage.upgrade.completed",
  projectId: "00000000-0000-4000-8000-000000000010",
  upgradeId: "00000000-0000-4000-8000-0000000000a1",
  sourceGenerationId: "00000000-0000-4000-8000-000000000014",
  targetGenerationId: "00000000-0000-4000-8000-0000000000a2",
} as const;
const completedLine = (overrides: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({ level: 30, time: 0, service: "harness", ...completedFields, ...overrides });

it("decodes the completed upgrade line", () => {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from(`${completedLine()}\n`));
  expect(calls).toEqual([
    [
      "info",
      { source: "harness", ...completedFields, harnessTime: "1970-01-01T00:00:00.000Z" },
      "Harness upgrade event.",
    ],
  ]);
});

const invalidCompletedLines = [
  { name: "an extra path key", line: completedLine({ path: "C:\\private\\project" }) },
  { name: "level 40", line: completedLine({ level: 40 }) },
  { name: "a missing targetGenerationId", line: completedLine({ targetGenerationId: undefined }) },
  {
    name: "a sourceGenerationId that is not a lowercase UUID",
    line: completedLine({ sourceGenerationId: "00000000-0000-4000-8000-00000000000A" }),
  },
] as const;

const rejectedLine = (key: "event" | "fatalCode", name: string, message: string) => [
  "warn",
  { code: "HARNESS_LOG_LINE_INVALID", attempt: 1, [key]: name },
  message,
];

it.for(invalidCompletedLines)("rejects an invalid completed line: $name", (invalid) => {
  expectOnlyCall(invalid.line, [
    rejectedLine("event", completedFields.event, "Harness upgrade log line rejected."),
  ]);
});

const shutdownFatalFields = {
  failures: [
    { tag: "RegistrationCleanupUnconfirmed", parts: ["registry", "listing"] },
    { tag: "CanonicalProjectReleaseFailed", code: "WRITER_FENCE_STALE" },
    { kind: "error" },
  ],
  omittedFailures: 0,
};
const fatalLine = (overrides: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({
    level: 60,
    time: 0,
    service: "harness",
    msg: "Harness shutdown failed.",
    code: "HARNESS_SHUTDOWN_FAILED",
    ...shutdownFatalFields,
    ...overrides,
  });

it("forwards a harness fatal line", () => {
  const { calls, lines } = forwarder();
  lines.push(Buffer.from(`${fatalLine()}\n`));
  expect(calls).toEqual([
    [
      "error",
      {
        source: "harness",
        attempt: 1,
        code: "HARNESS_SHUTDOWN_FAILED",
        ...shutdownFatalFields,
        harnessTime: "1970-01-01T00:00:00.000Z",
      },
      "Harness fatal event.",
    ],
  ]);
});

const invalidFatalLines = [
  { name: "an extra message key", line: fatalLine({ message: "C:\\private\\project" }) },
  {
    name: "17 entries",
    line: fatalLine({ failures: Array.from({ length: 17 }, () => ({ kind: "error" })) }),
  },
  { name: "a path in a tag", line: fatalLine({ failures: [{ tag: "C:\\private" }] }) },
] as const;

it.for(invalidFatalLines)("rejects an invalid fatal line: $name", (invalid) => {
  expectOnlyCall(invalid.line, [
    rejectedLine("fatalCode", "HARNESS_SHUTDOWN_FAILED", "Harness fatal log line rejected."),
  ]);
});

const otherHarnessLines = [
  {
    name: "an info line",
    line: JSON.stringify({
      level: 30,
      time: 0,
      service: "harness",
      msg: "Harness message port connected.",
    }),
  },
  { name: "a level-60 line with an unknown code", line: fatalLine({ code: "HARNESS_OTHER" }) },
  { name: "a level-50 line with a known code", line: fatalLine({ level: 50 }) },
] as const;

it.for(otherHarnessLines)("ignores other harness lines: $name", (other) => {
  expectOnlyCall(other.line, []);
});

const requestTime = 1_761_480_000_000;
const requestFailureLine = (metadata: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({
    level: 40,
    time: requestTime,
    service: "harness",
    code: "HARNESS_REQUEST_FAILED",
    msg: "Harness request failed.",
    boundary: "project-storage.owner",
    answered: "PROJECT_STORAGE_OWNER_FAILED",
    failures: [{ tag: "CanonicalLedgerRefusal" }],
    omittedFailures: 0,
    ...metadata,
  });

it("forwards a valid harness request failure line", () => {
  expectOnlyCall(requestFailureLine(), [
    [
      "warn",
      {
        source: "harness",
        attempt: 1,
        code: "HARNESS_REQUEST_FAILED",
        boundary: "project-storage.owner",
        answered: "PROJECT_STORAGE_OWNER_FAILED",
        failures: [{ tag: "CanonicalLedgerRefusal" }],
        omittedFailures: 0,
        harnessTime: new Date(requestTime).toISOString(),
      },
      "Harness request failure.",
    ],
  ]);
});

it("rejects a harness request failure line with an extra key", () => {
  expectOnlyCall(requestFailureLine({ message: "C:\\private\\project" }), [
    [
      "warn",
      { code: "HARNESS_LOG_LINE_INVALID", attempt: 1, requestCode: "HARNESS_REQUEST_FAILED" },
      "Harness request failure log line rejected.",
    ],
  ]);
});

it("drops a harness request failure line at another level", () => {
  expectOnlyCall(requestFailureLine({ level: 30 }), []);
});

const reconciliationLine = (metadata: Readonly<Record<string, unknown>> = {}) =>
  JSON.stringify({
    level: 40,
    time: requestTime,
    service: "harness",
    code: "REGISTRATION_RECONCILIATION_FAILED",
    msg: "Registration reconciliation failed.",
    ...metadata,
  });

it("forwards a valid registration reconciliation failure line", () => {
  expectOnlyCall(reconciliationLine(), [
    [
      "warn",
      {
        source: "harness",
        attempt: 1,
        code: "REGISTRATION_RECONCILIATION_FAILED",
        harnessTime: new Date(requestTime).toISOString(),
      },
      "Harness registration reconciliation failure.",
    ],
  ]);
});

it.each([50, 60])("drops a registration reconciliation line at level %i", (level) => {
  expectOnlyCall(reconciliationLine({ level }), []);
});

it("rejects a registration reconciliation line with an extra key", () => {
  expectOnlyCall(reconciliationLine({ message: "C:\\private\\registry" }), [
    [
      "warn",
      {
        code: "HARNESS_LOG_LINE_INVALID",
        attempt: 1,
        reconciliationCode: "REGISTRATION_RECONCILIATION_FAILED",
      },
      "Harness reconciliation log line rejected.",
    ],
  ]);
});
