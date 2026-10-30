import { describe, expect, it } from "vitest";
import { CanonicalProjectApplicationError } from "../canonical-project-application.js";
import { CanonicalProjectWriterReleaseError } from "../canonical-project-writer.js";
import { ApplicationDatabaseFault } from "./application-database-migration.js";
import { CanonicalCommandRepositoryError } from "./canonical-command-repository.js";
import { CanonicalWriterLeaseError } from "./canonical-writer-lease.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageOpeningReleaseFailedError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import {
  ProjectStorageUpgradeBusyError,
  projectStorageUpgradeBusyMessage,
} from "./project-storage-upgrade.js";

type ErrorClass = abstract new (...args: never[]) => Error;

/** One construction and the contract it keeps: tag, classes, message and its own field. */
type ContractRow = Readonly<{
  tag: string;
  error: Error;
  classes: readonly ErrorClass[];
  message: string;
  field?: readonly [key: string, value: unknown];
}>;

const brokenFailure = { status: "broken", code: "REGISTRY_CORRUPT" } as const;

const contractRows: readonly ContractRow[] = [
  {
    tag: "ProjectStorageBrokenError",
    error: new ProjectStorageBrokenError("broken"),
    classes: [ProjectStorageBrokenError],
    message: "broken",
  },
  {
    tag: "ProjectStorageBrokenError",
    error: new ProjectStorageBrokenError(),
    classes: [ProjectStorageBrokenError],
    message: "",
  },
  {
    tag: "ProjectStorageBrokenError",
    error: new ProjectStorageOpeningReleaseFailedError(new Error("release")),
    classes: [ProjectStorageOpeningReleaseFailedError, ProjectStorageBrokenError],
    message: "Project Storage opening release failed.",
  },
  {
    tag: "ProjectStorageBrokenError",
    error: new ProjectStorageApplicationClientInitializationError("initialization"),
    classes: [ProjectStorageApplicationClientInitializationError, ProjectStorageBrokenError],
    message: "initialization",
  },
  {
    tag: "ProjectStorageUnavailableError",
    error: new ProjectStorageUnavailableError("unavailable"),
    classes: [ProjectStorageUnavailableError],
    message: "unavailable",
  },
  {
    tag: "ProjectStorageUnavailableError",
    error: new ProjectStorageUpgradeBusyError(),
    classes: [ProjectStorageUpgradeBusyError, ProjectStorageUnavailableError],
    message: projectStorageUpgradeBusyMessage,
  },
  {
    tag: "CanonicalCommandRepositoryError",
    error: new CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED"),
    classes: [CanonicalCommandRepositoryError],
    message: "Canonical Writer fence verification failed.",
    field: ["code", "WRITER_FENCE_CHECK_FAILED"],
  },
  {
    tag: "CanonicalWriterLeaseError",
    error: new CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED"),
    classes: [CanonicalWriterLeaseError],
    message: "Writer lease could not be acquired.",
    field: ["code", "WRITER_LEASE_LOCK_FAILED"],
  },
  {
    tag: "CanonicalProjectWriterReleaseError",
    error: new CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE"),
    classes: [CanonicalProjectWriterReleaseError],
    message: "Canonical Project Writer release failed.",
    field: ["code", "WRITER_FENCE_STALE"],
  },
  {
    tag: "ApplicationDatabaseFault",
    error: new ApplicationDatabaseFault(brokenFailure),
    classes: [ApplicationDatabaseFault],
    message: "Application database authority refused the operation.",
    field: ["failure", brokenFailure],
  },
  {
    tag: "CanonicalProjectApplicationError",
    error: new CanonicalProjectApplicationError(),
    classes: [CanonicalProjectApplicationError],
    message: "Canonical Project application returned an invalid result.",
  },
];

/** Builds one class with a cause option, or with no options at all. */
type CauseRow = Readonly<{ name: string; make: (options?: ErrorOptions) => Error }>;

const causeRows: readonly CauseRow[] = [
  {
    name: "ProjectStorageBrokenError",
    make: (options) => new ProjectStorageBrokenError("m", options),
  },
  {
    name: "CanonicalWriterLeaseError",
    make: (options) => new CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED", options),
  },
  {
    name: "ApplicationDatabaseFault",
    make: (options) => new ApplicationDatabaseFault(brokenFailure, options),
  },
];

describe("storage error contract", () => {
  it.each(contractRows)("keeps the contract of $tag: $message", (row) => {
    const { error } = row;
    expect(error.name).toBe(row.tag);
    expect(error).toBeInstanceOf(Error);
    for (const errorClass of row.classes) expect(error).toBeInstanceOf(errorClass);
    expect(error.message).toBe(row.message);
    if (row.field !== undefined) expect(Reflect.get(error, row.field[0])).toBe(row.field[1]);
    expect(String(error)).toBe(row.message === "" ? row.tag : `${row.tag}: ${row.message}`);
    expect(Reflect.get(error, "_tag")).toBe(row.tag);
  });

  describe.each(causeRows)("$name cause", ({ make }) => {
    it("keeps a given error as its cause", () => {
      const cause = new Error("cause");
      expect(make({ cause }).cause).toBe(cause);
    });

    it("keeps a null cause", () => {
      expect(make({ cause: null }).cause).toBeNull();
    });

    it("has no own cause without options", () => {
      expect(Object.hasOwn(make(), "cause")).toBe(false);
    });
  });

  it("keeps an undefined opening release cause", () => {
    expect(new ProjectStorageOpeningReleaseFailedError(undefined).cause).toBeUndefined();
  });

  describe("equality between two converted errors", () => {
    const broken = (message: string, options?: ErrorOptions) =>
      new ProjectStorageBrokenError(message, options);

    it("tells apart two messages under toEqual and toStrictEqual", () => {
      expect(broken("a")).not.toEqual(broken("b"));
      expect(broken("a")).not.toStrictEqual(broken("b"));
    });

    it("tells apart two messages under toThrow with an instance", () => {
      expect(() => {
        throw broken("a");
      }).not.toThrow(broken("b"));
    });

    it("tells apart two messages under rejects", async () => {
      await expect(Promise.reject(broken("a"))).rejects.not.toThrow(broken("b"));
      await expect(Promise.reject(broken("a"))).rejects.not.toEqual(broken("b"));
    });

    it("tells apart two different truthy causes", () => {
      expect(broken("a", { cause: new Error("x") })).not.toEqual(
        broken("a", { cause: new Error("y") }),
      );
    });

    it("keeps two equal errors equal", () => {
      const cause = new Error("x");
      expect(broken("a", { cause })).toEqual(broken("a", { cause }));
      expect(() => {
        throw broken("a");
      }).toThrow(broken("a"));
    });
  });
});
