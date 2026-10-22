import {
  type CleanupPart,
  REGISTRATION_CLEANUP_PARTS,
  REGISTRATION_CLEANUP_TAG,
} from "./registration/registration-listing.js";

type FatalValueKind =
  | "error"
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "symbol"
  | "function"
  | "object"
  | "null"
  | "undefined";

/** One failure in a summary: its tag (with the unconfirmed cleanup parts) or its value kind. */
type HarnessFailureEntry =
  | Readonly<{ tag: string; parts?: readonly CleanupPart[] }>
  | Readonly<{ kind: FatalValueKind }>;

/** A failure value as metadata only: no message, path, cause or stack. */
type HarnessFailureSummary = Readonly<{
  failures: readonly HarnessFailureEntry[];
  omittedFailures: number;
}>;

type HarnessExitCode =
  | "HARNESS_START_FAILED"
  | "HARNESS_RUNTIME_START_FAILED"
  | "HARNESS_SHUTDOWN_FAILED";

type FatalMetadata =
  | Readonly<{
      code: "HARNESS_UNCAUGHT_EXCEPTION" | "HARNESS_UNHANDLED_REJECTION";
      valueKind: FatalValueKind;
    }>
  | (Readonly<{ code: HarnessExitCode }> & HarnessFailureSummary);

/** Where a harness fatal exit is reported: one `fatal` line, then `exit(1)`. */
export type HarnessFatalSink = Readonly<{
  fatal(metadata: FatalMetadata, message: string): void;
  exit(code: 1): void;
}>;

function valueKind(value: unknown): FatalValueKind {
  if (value instanceof Error) {
    return "error";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

/** Pino logs stay bounded: failures past this many are only counted. */
const MAX_SUMMARIZED_FAILURES = 16;
const IDENTIFIER_TAG = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

/** A field of an object value; any other value has none. */
function fieldOf(value: unknown, key: "_tag" | "parts"): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function identifierTag(value: unknown): string | undefined {
  const tag = fieldOf(value, "_tag");
  return typeof tag === "string" && IDENTIFIER_TAG.test(tag) ? tag : undefined;
}

function isCleanupPart(part: unknown): part is CleanupPart {
  return REGISTRATION_CLEANUP_PARTS.some((name) => name === part);
}

function cleanupParts(value: unknown): CleanupPart[] {
  const parts = fieldOf(value, "parts");
  return Array.isArray(parts) ? parts.filter(isCleanupPart) : [];
}

function failureEntry(value: unknown): HarnessFailureEntry {
  const tag = identifierTag(value);
  if (tag === undefined) {
    return { kind: valueKind(value) };
  }
  return tag === REGISTRATION_CLEANUP_TAG ? { tag, parts: cleanupParts(value) } : { tag };
}

/** An aggregate with failures to flatten; an empty one is summarized as one error. */
function nestedFailures(value: unknown): readonly unknown[] | undefined {
  if (!(value instanceof AggregateError) || !Array.isArray(value.errors)) {
    return undefined;
  }
  return value.errors.length > 0 ? value.errors : undefined;
}

type SummaryWalk = {
  readonly failures: HarnessFailureEntry[];
  omittedFailures: number;
  readonly seen: Set<unknown>;
  readonly pending: unknown[];
};

/** Queues an aggregate's failures in order; an aggregate met again is only counted. */
function expandAggregate(walk: SummaryWalk, aggregate: unknown, nested: readonly unknown[]): void {
  if (walk.seen.has(aggregate)) {
    walk.omittedFailures += 1;
    return;
  }
  walk.seen.add(aggregate);
  for (let index = nested.length - 1; index >= 0; index -= 1) walk.pending.push(nested[index]);
}

function visitFailure(walk: SummaryWalk, value: unknown): void {
  const nested = nestedFailures(value);
  if (nested !== undefined) {
    expandAggregate(walk, value, nested);
  } else if (walk.failures.length < MAX_SUMMARIZED_FAILURES) {
    walk.failures.push(failureEntry(value));
  } else {
    walk.omittedFailures += 1;
  }
}

/**
 * Summarizes a failure value as tags, cleanup part names and value kinds, depth first and in
 * order, flattening aggregates. No message, path, cause or stack is read. Entries past the
 * bound and aggregates met again are only counted.
 */
export function summarizeHarnessFailure(value: unknown): HarnessFailureSummary {
  const walk: SummaryWalk = { failures: [], omittedFailures: 0, seen: new Set(), pending: [value] };
  while (walk.pending.length > 0) {
    visitFailure(walk, walk.pending.pop());
  }
  return { failures: walk.failures, omittedFailures: walk.omittedFailures };
}

/** Reports `failure` once on `sink` with its code and summary, then exits 1. */
export function reportHarnessFailure(
  sink: HarnessFatalSink,
  code: HarnessExitCode,
  message: string,
  failure: unknown,
): void {
  sink.fatal({ code, ...summarizeHarnessFailure(failure) }, message);
  sink.exit(1);
}

export function createHarnessFatalHandlers(options: HarnessFatalSink) {
  return {
    uncaughtException(value: unknown): void {
      options.fatal(
        { code: "HARNESS_UNCAUGHT_EXCEPTION", valueKind: valueKind(value) },
        "Harness encountered an uncaught exception.",
      );
      options.exit(1);
    },
    unhandledRejection(value: unknown): void {
      options.fatal(
        { code: "HARNESS_UNHANDLED_REJECTION", valueKind: valueKind(value) },
        "Harness encountered an unhandled rejection.",
      );
      options.exit(1);
    },
  };
}
