import { decodeStrict, HarnessRequestFailureLogLineSchema } from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import { memoryLogDestination } from "../tests/integration/request-diagnostics-fixture.js";
import { CanonicalProjectApplicationError } from "./canonical-project-application.js";
import { CanonicalProjectWriterReleaseError } from "./canonical-project-writer.js";
import { createHarnessLogger } from "./harness-logger.js";
import { createHarnessRequestDiagnostics } from "./harness-request-diagnostics.js";
import { RegistrationPublicationCancelled } from "./registration/registration-confirmation-store.js";
import { RegistryFault, registryCorrupt } from "./registration/registry-failure.js";
import { WindowsObserverApiError } from "./registration/windows-observer-api.js";
import { ApplicationDatabaseFault } from "./storage/application-database-migration.js";
import { CanonicalCommandRepositoryError } from "./storage/canonical-command-repository.js";
import { canonicalLedgerRefusal } from "./storage/canonical-ledger-refusal.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageOpeningReleaseFailedError,
  ProjectStorageUnavailableError,
} from "./storage/project-storage-errors.js";
import { ProjectStorageUpgradeBusyError } from "./storage/project-storage-upgrade.js";

/** The one line a request failure at `boundary` writes, decoded strictly. */
function reportedLine(
  boundary: Parameters<ReturnType<typeof createHarnessRequestDiagnostics>["requestFailed"]>[0],
  failure: unknown,
) {
  const destination = memoryLogDestination();
  createHarnessRequestDiagnostics(createHarnessLogger(destination.stream)).requestFailed(
    boundary,
    failure,
  );
  expect(destination.lines).toHaveLength(1);
  const [raw = ""] = destination.lines;
  return { raw, line: decodeStrict(HarnessRequestFailureLogLineSchema, JSON.parse(raw)) };
}

/** One storage failure per converted class and subclass, with the tag its summary must carry. */
const storageFailures: ReadonlyArray<readonly [string, () => Error]> = [
  [
    "ProjectStorageBrokenError",
    () => new ProjectStorageBrokenError("C:\\private\\a.db", { cause: new Error("secret") }),
  ],
  [
    "ProjectStorageBrokenError",
    () => new ProjectStorageOpeningReleaseFailedError(new Error("secret")),
  ],
  ["ProjectStorageBrokenError", () => new ProjectStorageApplicationClientInitializationError("m")],
  ["ProjectStorageUnavailableError", () => new ProjectStorageUnavailableError("m")],
  ["ProjectStorageUnavailableError", () => new ProjectStorageUpgradeBusyError()],
  [
    "CanonicalCommandRepositoryError",
    () => new CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED"),
  ],
  ["CanonicalWriterLeaseError", () => new CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED")],
  [
    "CanonicalProjectWriterReleaseError",
    () => new CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE"),
  ],
  [
    "ApplicationDatabaseFault",
    () => new ApplicationDatabaseFault({ status: "broken", code: "REGISTRY_CORRUPT" }),
  ],
  ["CanonicalProjectApplicationError", () => new CanonicalProjectApplicationError()],
];

/** One registration failure per exported converted class, with the tag its summary must carry. */
const registrationFailures: ReadonlyArray<readonly [string, () => Error]> = [
  ["RegistryFault", () => registryCorrupt()],
  [
    "RegistryFault",
    () => new RegistryFault({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }),
  ],
  ["WindowsObserverApiError", () => new WindowsObserverApiError(5)],
  ["RegistrationPublicationCancelled", () => new RegistrationPublicationCancelled()],
];

describe("harness request diagnostics", () => {
  it("writes one exact line and nothing private for a failure at a request boundary", () => {
    const failure = new Error("C:\\private\\project\\slopstop.db", {
      cause: new Error("secret cause"),
    });
    const { raw, line } = reportedLine("harness.message", failure);
    expect(line).toMatchObject({
      level: 40,
      service: "harness",
      code: "HARNESS_REQUEST_FAILED",
      msg: "Harness request failed.",
      boundary: "harness.message",
      answered: "HARNESS_INTERNAL_FAILURE",
      failures: [{ kind: "error" }],
      omittedFailures: 0,
    });
    for (const text of ["private", "slopstop.db", "secret", "C:\\\\", "stack"]) {
      expect(raw).not.toContain(text);
    }
  });

  it("names a tagged failure by its tag", () => {
    const { line } = reportedLine(
      "harness.message",
      canonicalLedgerRefusal("ORIGINAL_RECEIPT_ORPHANED"),
    );
    expect(line.failures).toEqual([{ tag: "CanonicalLedgerRefusal" }]);
    expect(line.omittedFailures).toBe(0);
  });

  it("bounds an aggregate of 17 failures to 16 entries and counts the rest", () => {
    const failure = new AggregateError(
      Array.from({ length: 17 }, (_, index) => new Error(`failure ${index}`)),
      "seventeen",
    );
    const { line } = reportedLine("harness.message", failure);
    expect(line.failures).toHaveLength(16);
    expect(line.omittedFailures).toBe(1);
  });

  it("answers each boundary with its own code", () => {
    const { line } = reportedLine("project-storage.owner", new Error("owner"));
    expect(line).toMatchObject({
      boundary: "project-storage.owner",
      answered: "PROJECT_STORAGE_OWNER_FAILED",
    });
  });

  it("returns normally when the logger itself throws", () => {
    const throwing = {
      info: () => undefined,
      warn: () => {
        throw new Error("log write failed");
      },
    };
    expect(() =>
      createHarnessRequestDiagnostics(throwing).requestFailed("harness.message", new Error("x")),
    ).not.toThrow();
  });

  it.each(storageFailures)("summarizes storage failure %# by its tag %s", (tag, failure) => {
    const { raw, line } = reportedLine("project-storage.owner", failure());
    expect(line).toMatchObject({
      boundary: "project-storage.owner",
      answered: "PROJECT_STORAGE_OWNER_FAILED",
      omittedFailures: 0,
    });
    expect(line.failures).toEqual([{ tag }]);
    for (const text of ["private", "secret"]) expect(raw).not.toContain(text);
  });

  it.each(registrationFailures)(
    "summarizes registration failure %# by its tag %s",
    (tag, failure) => {
      const { raw, line } = reportedLine("harness.registration", failure());
      expect(line).toMatchObject({
        boundary: "harness.registration",
        answered: "HARNESS_INTERNAL_FAILURE",
        omittedFailures: 0,
      });
      expect(line.failures).toEqual([{ tag }]);
      for (const text of ["REGISTRY_CORRUPT", "OBSERVER_CLEANUP", "(5)"]) {
        expect(raw).not.toContain(text);
      }
    },
  );
});
