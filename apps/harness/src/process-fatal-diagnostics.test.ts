import { expect, it, vi } from "vitest";
import { HarnessRuntimeDisposeUnconfirmed } from "./process-bootstrap.js";
import {
  createHarnessFatalHandlers,
  summarizeHarnessFailure,
} from "./process-fatal-diagnostics.js";
import { ApplicationDatabaseCloseUnconfirmed } from "./storage/application-database-authority.js";

it("reports process fatal values as metadata only", () => {
  const fatal = vi.fn();
  const exit = vi.fn();
  const handlers = createHarnessFatalHandlers({ fatal, exit });

  handlers.uncaughtException(new Error("private C:\\repo\\source.ts"));
  handlers.unhandledRejection({ token: "secret" });

  expect(fatal).toHaveBeenNthCalledWith(
    1,
    { code: "HARNESS_UNCAUGHT_EXCEPTION", valueKind: "error" },
    "Harness encountered an uncaught exception.",
  );
  expect(fatal).toHaveBeenNthCalledWith(
    2,
    { code: "HARNESS_UNHANDLED_REJECTION", valueKind: "object" },
    "Harness encountered an unhandled rejection.",
  );
  expect(exit.mock.calls).toEqual([[1], [1]]);
  const serialized = JSON.stringify(fatal.mock.calls);
  expect(serialized).not.toContain("private");
  expect(serialized).not.toContain("source.ts");
  expect(serialized).not.toContain("token");
  expect(serialized).not.toContain("secret");
});

it("classifies null separately from objects", () => {
  const fatal = vi.fn();
  const exit = vi.fn();
  const handlers = createHarnessFatalHandlers({ fatal, exit });

  handlers.unhandledRejection(null);

  expect(fatal).toHaveBeenCalledWith(
    { code: "HARNESS_UNHANDLED_REJECTION", valueKind: "null" },
    "Harness encountered an unhandled rejection.",
  );
  expect(exit).toHaveBeenCalledWith(1);
});

const P = "C:\\private\\project\\slopstop.db";

/** The shape `RegistrationCleanupUnconfirmed` has; the summary reads only `_tag` and `parts`. */
function cleanupUnconfirmed(parts: readonly string[], cause?: unknown) {
  return {
    _tag: "RegistrationCleanupUnconfirmed",
    name: "RegistrationCleanupUnconfirmed",
    message: P,
    parts,
    cause,
  };
}

const tagged = (index: number) => ({ _tag: `Failure${index}` });

function cyclicAggregate() {
  const aggregate = new AggregateError([], "cycle");
  aggregate.errors = [new ApplicationDatabaseCloseUnconfirmed(1000), aggregate];
  return aggregate;
}

it.each([
  {
    name: "one tagged failure",
    value: new ApplicationDatabaseCloseUnconfirmed(1000),
    failures: [{ tag: "ApplicationDatabaseCloseUnconfirmed" }],
    omittedFailures: 0,
  },
  {
    name: "cleanup parts",
    value: cleanupUnconfirmed(["observer", "listing"], new Error(P)),
    failures: [{ tag: "RegistrationCleanupUnconfirmed", parts: ["observer", "listing"] }],
    omittedFailures: 0,
  },
  {
    name: "unknown parts dropped",
    value: cleanupUnconfirmed(["registry", P]),
    failures: [{ tag: "RegistrationCleanupUnconfirmed", parts: ["registry"] }],
    omittedFailures: 0,
  },
  {
    name: "nested aggregates in order",
    value: new AggregateError([
      new AggregateError([
        cleanupUnconfirmed(["registry"]),
        new ApplicationDatabaseCloseUnconfirmed(1000),
      ]),
      new HarnessRuntimeDisposeUnconfirmed(500),
    ]),
    failures: [
      { tag: "RegistrationCleanupUnconfirmed", parts: ["registry"] },
      { tag: "ApplicationDatabaseCloseUnconfirmed" },
      { tag: "HarnessRuntimeDisposeUnconfirmed" },
    ],
    omittedFailures: 0,
  },
  {
    name: "untagged values: an error",
    value: new Error(P),
    failures: [{ kind: "error" }],
    omittedFailures: 0,
  },
  {
    name: "untagged values: a string",
    value: P,
    failures: [{ kind: "string" }],
    omittedFailures: 0,
  },
  { name: "untagged values: null", value: null, failures: [{ kind: "null" }], omittedFailures: 0 },
  {
    name: "untagged values: an object",
    value: { token: P },
    failures: [{ kind: "object" }],
    omittedFailures: 0,
  },
  {
    name: "a non-identifier tag: private",
    value: { _tag: P },
    failures: [{ kind: "object" }],
    omittedFailures: 0,
  },
  {
    name: "a non-identifier tag: 65 characters",
    value: { _tag: "A".repeat(65) },
    failures: [{ kind: "object" }],
    omittedFailures: 0,
  },
  {
    name: "a non-identifier tag: 64 characters is one",
    value: { _tag: "A".repeat(64) },
    failures: [{ tag: "A".repeat(64) }],
    omittedFailures: 0,
  },
  {
    name: "an empty aggregate",
    value: new AggregateError([]),
    failures: [{ kind: "error" }],
    omittedFailures: 0,
  },
  {
    name: "the bound: 16",
    value: new AggregateError(Array.from({ length: 16 }, (_, index) => tagged(index))),
    failures: Array.from({ length: 16 }, (_, index) => ({ tag: `Failure${index}` })),
    omittedFailures: 0,
  },
  {
    name: "the bound: 17",
    value: new AggregateError(Array.from({ length: 17 }, (_, index) => tagged(index))),
    failures: Array.from({ length: 16 }, (_, index) => ({ tag: `Failure${index}` })),
    omittedFailures: 1,
  },
  {
    name: "a cycle",
    value: cyclicAggregate(),
    failures: [{ tag: "ApplicationDatabaseCloseUnconfirmed" }],
    omittedFailures: 1,
  },
])("summarizes a fatal failure as metadata only: $name", ({ value, failures, omittedFailures }) => {
  const summary = summarizeHarnessFailure(value);

  expect(summary).toEqual({ failures, omittedFailures });
  const serialized = JSON.stringify(summary);
  expect(serialized).not.toContain("private");
  expect(serialized).not.toContain("is unconfirmed");
});

/** The shape `CanonicalProjectReleaseFailed` has; the summary reads only `_tag` and `code`. */
function releaseFailed(code: string) {
  return {
    _tag: "CanonicalProjectReleaseFailed",
    name: "CanonicalProjectReleaseFailed",
    message: P,
    code,
  };
}

it("summarizes a release failure with its code", () => {
  expect(summarizeHarnessFailure(releaseFailed("WRITER_FENCE_STALE"))).toEqual({
    failures: [{ tag: "CanonicalProjectReleaseFailed", code: "WRITER_FENCE_STALE" }],
    omittedFailures: 0,
  });
  // A code outside the protocol's activation codes is dropped, never echoed.
  const unknown = summarizeHarnessFailure(releaseFailed(P));
  expect(unknown).toEqual({
    failures: [{ tag: "CanonicalProjectReleaseFailed" }],
    omittedFailures: 0,
  });
  expect(JSON.stringify(unknown)).not.toContain("private");
});
