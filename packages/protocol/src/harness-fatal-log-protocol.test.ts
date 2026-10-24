import { Result } from "effect";
import { expect, it } from "vitest";
import { HarnessFatalLogLineSchema } from "./harness-fatal-log-protocol.js";
import { decodeStrictResult } from "./schema-codec.js";

type Line = Readonly<Record<string, unknown>>;

function fatalLine(code: string, msg: string, metadata: Line = {}): Line {
  return { level: 60, time: 0, service: "harness", msg, code, ...metadata };
}

const cleanupEntry = { tag: "RegistrationCleanupUnconfirmed", parts: ["registry", "listing"] };
const shutdownLine = (metadata: Line = {}) =>
  fatalLine("HARNESS_SHUTDOWN_FAILED", "Harness shutdown failed.", {
    failures: [cleanupEntry, { kind: "error" }],
    omittedFailures: 0,
    ...metadata,
  });
const sixteenEntries = Array.from({ length: 16 }, (_, index) => ({ tag: `Failure${index}` }));

const acceptedLines = [
  { name: "shutdown with a cleanup entry and a value kind", line: shutdownLine() },
  {
    name: "shutdown with a release failure and its code",
    line: shutdownLine({
      failures: [{ tag: "CanonicalProjectReleaseFailed", code: "WRITER_FENCE_STALE" }],
    }),
  },
  {
    name: "runtime start with 16 entries and 3 omitted",
    line: fatalLine("HARNESS_RUNTIME_START_FAILED", "Harness runtime failed to start.", {
      failures: sixteenEntries,
      omittedFailures: 3,
    }),
  },
  {
    name: "start with a summary",
    line: fatalLine("HARNESS_START_FAILED", "Harness received an invalid bootstrap message.", {
      failures: [{ tag: "SchemaError" }],
      omittedFailures: 0,
    }),
  },
  {
    name: "start without metadata, no parent port",
    line: fatalLine("HARNESS_START_FAILED", "Harness utility process has no parent port."),
  },
  {
    name: "start without metadata, invalid bootstrap",
    line: fatalLine("HARNESS_START_FAILED", "Harness received an invalid bootstrap message."),
  },
  {
    name: "uncaught exception",
    line: fatalLine("HARNESS_UNCAUGHT_EXCEPTION", "Harness encountered an uncaught exception.", {
      valueKind: "error",
    }),
  },
  {
    name: "unhandled rejection",
    line: fatalLine("HARNESS_UNHANDLED_REJECTION", "Harness encountered an unhandled rejection.", {
      valueKind: "string",
    }),
  },
] as const;

it.for(acceptedLines)("accepts each harness fatal line: $name", ({ line }) => {
  const decoded = decodeStrictResult(HarnessFatalLogLineSchema, line);
  expect(Result.isSuccess(decoded)).toBe(true);
  if (Result.isSuccess(decoded)) expect(decoded.success).toEqual(line);
});

const withEntry = (entry: unknown) => shutdownLine({ failures: [entry], omittedFailures: 0 });

const textCarryingLines = [
  ...["message", "stack", "cause", "path"].map((key) => ({
    name: `an extra ${key} key at the top`,
    line: shutdownLine({ [key]: "C:\\private\\project" }),
  })),
  ...["message", "stack", "cause", "path"].map((key) => ({
    name: `an extra ${key} key inside an entry`,
    line: withEntry({ tag: "Failure", [key]: "C:\\private\\project" }),
  })),
  { name: "an extra key inside a kind entry", line: withEntry({ kind: "error", stack: "at x" }) },
  { name: "a msg other than the fixed message", line: shutdownLine({ msg: "C:\\private" }) },
  {
    name: "a msg of another code",
    line: fatalLine("HARNESS_START_FAILED", "Harness shutdown failed."),
  },
  ...["a/b", "a\\b", "a.b", "a:b", "a b", "A".repeat(65)].map((tag) => ({
    name: `the tag ${JSON.stringify(tag.slice(0, 8))} (${tag.length} characters)`,
    line: withEntry({ tag }),
  })),
  {
    name: "17 entries",
    line: shutdownLine({ failures: [...sixteenEntries, { kind: "error" }] }),
  },
  {
    name: "an unknown part",
    line: withEntry({ tag: "RegistrationCleanupUnconfirmed", parts: ["storage"] }),
  },
  { name: "parts on another tag", line: withEntry({ tag: "Failure", parts: ["registry"] }) },
  {
    name: "parts that are not an array",
    line: withEntry({ tag: "RegistrationCleanupUnconfirmed", parts: "registry" }),
  },
  {
    name: "an unknown release code",
    line: withEntry({ tag: "CanonicalProjectReleaseFailed", code: "C:\\private" }),
  },
  {
    name: "a code on another tag",
    line: withEntry({ tag: "Failure", code: "WRITER_FENCE_STALE" }),
  },
  { name: "a non-string tag", line: withEntry({ tag: 42 }) },
  { name: "an unknown value kind", line: withEntry({ kind: "C:\\private" }) },
  { name: "a negative omittedFailures", line: shutdownLine({ omittedFailures: -1 }) },
  { name: "a fractional omittedFailures", line: shutdownLine({ omittedFailures: 1.5 }) },
  { name: "an unknown code", line: shutdownLine({ code: "HARNESS_OTHER" }) },
  { name: "level 50", line: shutdownLine({ level: 50 }) },
  {
    name: "a summary on an uncaught exception",
    line: fatalLine("HARNESS_UNCAUGHT_EXCEPTION", "Harness encountered an uncaught exception.", {
      valueKind: "error",
      failures: [],
      omittedFailures: 0,
    }),
  },
] as const;

it.for(textCarryingLines)("rejects a fatal line that could carry text: $name", ({ line }) => {
  expect(Result.isFailure(decodeStrictResult(HarnessFatalLogLineSchema, line))).toBe(true);
});
