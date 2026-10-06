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
  };
  return { calls, lines: createHarnessLogLineForwarder(logger, 1) };
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
