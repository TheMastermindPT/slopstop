import { describe, expect, it } from "vitest";
import {
  ConversationStorageBroken,
  ConversationStorageBusy,
  conversationStorageFailure,
} from "../conversation/conversation-errors.js";
import { registryFailure } from "../registration/registry-failure.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageOpeningReleaseFailedError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import {
  isCorruptStorageError,
  isKnownStorageFailure,
  isRetryableStorageError,
  isSqliteBusy,
  isUnavailableStorageError,
  normalizeStorageError,
  storageFailureFor,
} from "./project-storage-node-errors.js";
import { ProjectStorageUpgradeBusyError } from "./project-storage-upgrade.js";

describe("Project Storage Node error classification", () => {
  it.each(["SQLITE_CORRUPT", "SQLITE_NOTADB"])(
    "recognizes the exact SQLite corruption code %s",
    (code) => {
      expect(isCorruptStorageError({ error: { code } })).toBe(true);
    },
  );

  it.each(["SQLITE_CORRUPT_VTAB", "SQLITE_NOTADB_EXTRA", "SQLITE_ERROR", undefined])(
    "does not widen corruption to nearby code %s",
    (code) => {
      expect(isCorruptStorageError({ error: { code } })).toBe(false);
    },
  );

  it.each([
    "EACCES",
    "EPERM",
    "EBUSY",
    "SQLITE_AUTH",
    "SQLITE_BUSY_TIMEOUT",
    "SQLITE_CANTOPEN",
    "SQLITE_IOERR_READ",
    "SQLITE_LOCKED",
    "SQLITE_PERM",
    "SQLITE_READONLY_DBMOVED",
  ])("recognizes the storage availability code %s", (code) => {
    expect(isUnavailableStorageError({ error: { code } })).toBe(true);
  });

  it.each(["ENOENT", "SQLITE_ERROR", "SQLITE_CANTOPENED", undefined])(
    "does not widen unavailability to nearby code %s",
    (code) => {
      expect(isUnavailableStorageError({ error: { code } })).toBe(false);
    },
  );

  it.each([
    { name: "broken", error: new ProjectStorageBrokenError("broken"), known: true },
    {
      name: "client initialization",
      error: new ProjectStorageApplicationClientInitializationError("initialization"),
      known: true,
    },
    { name: "unavailable", error: new ProjectStorageUnavailableError("unavailable"), known: true },
    { name: "upgrade busy", error: new ProjectStorageUpgradeBusyError(), known: true },
    { name: "plain error", error: new Error("plain"), known: false },
    {
      name: "busy code",
      error: Object.assign(new Error("busy"), { code: "SQLITE_BUSY" }),
      known: false,
    },
    {
      name: "corrupt code",
      error: Object.assign(new Error("corrupt"), { code: "SQLITE_CORRUPT" }),
      known: false,
    },
    { name: "busy-code object", error: { code: "SQLITE_BUSY" }, known: false },
    { name: "broken-name object", error: { name: "ProjectStorageBrokenError" }, known: false },
    { name: "broken-name string", error: "ProjectStorageBrokenError", known: false },
    { name: "undefined", error: undefined, known: false },
    { name: "null", error: null, known: false },
  ])("knows a storage failure only by its class: $name", ({ error, known }) => {
    expect(isKnownStorageFailure(error)).toBe(known);
  });

  it("treats a non-string error code as no code", () => {
    expect(isUnavailableStorageError({ error: { code: 5 } })).toBe(false);
    expect(isCorruptStorageError({ error: { code: 5 } })).toBe(false);
  });

  it("reads an error code only from an object, never from a function", () => {
    const busyFunction = Object.assign(() => undefined, { code: "SQLITE_BUSY" });
    expect(isUnavailableStorageError({ error: busyFunction })).toBe(false);
  });

  it.each([
    {
      name: "unavailable class",
      error: new ProjectStorageUnavailableError("owner"),
      retryable: true,
    },
    {
      name: "wrapped busy cause",
      error: new Error("wrapped", { cause: { code: "SQLITE_BUSY" } }),
      retryable: true,
    },
    {
      name: "wrapped plain cause",
      error: new Error("wrapped", { cause: new Error("x") }),
      retryable: false,
    },
    { name: "plain error", error: new Error("plain"), retryable: false },
  ])("knows a retryable storage error, directly or by its cause: $name", ({ error, retryable }) => {
    expect(isRetryableStorageError({ error })).toBe(retryable);
  });
});

const codedError = (code: string) => Object.assign(new Error(code), { code });

describe("classifies each storage error code once", () => {
  it.each([
    {
      name: "SQLITE_BUSY",
      error: codedError("SQLITE_BUSY"),
      busy: true,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_LOCKED",
      error: codedError("SQLITE_LOCKED"),
      busy: true,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_BUSY_SNAPSHOT",
      error: codedError("SQLITE_BUSY_SNAPSHOT"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_IOERR",
      error: codedError("SQLITE_IOERR"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_IOERR_WRITE",
      error: codedError("SQLITE_IOERR_WRITE"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_CANTOPEN",
      error: codedError("SQLITE_CANTOPEN"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_READONLY",
      error: codedError("SQLITE_READONLY"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "SQLITE_CORRUPT",
      error: codedError("SQLITE_CORRUPT"),
      busy: false,
      unavailable: false,
      retryable: false,
      corrupt: true,
    },
    {
      name: "SQLITE_NOTADB",
      error: codedError("SQLITE_NOTADB"),
      busy: false,
      unavailable: false,
      retryable: false,
      corrupt: true,
    },
    {
      name: "EACCES",
      error: codedError("EACCES"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "EPERM",
      error: codedError("EPERM"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "EBUSY",
      error: codedError("EBUSY"),
      busy: false,
      unavailable: true,
      retryable: true,
      corrupt: false,
    },
    {
      name: "UNKNOWN",
      error: codedError("UNKNOWN"),
      busy: false,
      unavailable: false,
      retryable: false,
      corrupt: false,
    },
    {
      name: "no code",
      error: new Error("plain"),
      busy: false,
      unavailable: false,
      retryable: false,
      corrupt: false,
    },
    {
      name: "a non-error value",
      error: "SQLITE_BUSY",
      busy: false,
      unavailable: false,
      retryable: false,
      corrupt: false,
    },
    {
      name: "null",
      error: null,
      busy: false,
      unavailable: false,
      retryable: false,
      corrupt: false,
    },
    {
      name: "a cause-wrapped SQLITE_IOERR",
      error: new Error("wrapped", { cause: codedError("SQLITE_IOERR") }),
      busy: false,
      unavailable: false,
      retryable: true,
      corrupt: false,
    },
  ])("$name", ({ error, busy, unavailable, retryable, corrupt }) => {
    expect({
      busy: isSqliteBusy(error),
      unavailable: isUnavailableStorageError({ error }),
      retryable: isRetryableStorageError({ error }),
      corrupt: isCorruptStorageError({ error }),
    }).toEqual({ busy, unavailable, retryable, corrupt });
  });
});

describe("the busy verdicts stay as they were", () => {
  const busyCodes = ["SQLITE_BUSY", "SQLITE_LOCKED"];
  const notBusyCodes = [
    "SQLITE_CANTOPEN",
    "SQLITE_IOERR",
    "SQLITE_READONLY",
    "SQLITE_CORRUPT",
    "SQLITE_BUSY_SNAPSHOT",
    "EBUSY",
    "UNKNOWN",
  ];

  it.each(busyCodes)("registryFailure maps %s to REGISTRY_BUSY", (code) => {
    expect(registryFailure(codedError(code))).toEqual({
      status: "unavailable",
      code: "REGISTRY_BUSY",
    });
  });

  it.each(notBusyCodes)("registryFailure maps %s to INTERNAL_FAILURE", (code) => {
    expect(registryFailure(codedError(code))).toEqual({
      status: "broken",
      code: "INTERNAL_FAILURE",
    });
  });

  it("conversationStorageFailure maps SQLITE_BUSY to ConversationStorageBusy", () => {
    const cause = codedError("SQLITE_BUSY");
    const failure = conversationStorageFailure(cause);
    expect(failure).toBeInstanceOf(ConversationStorageBusy);
    expect(failure._tag).toBe("ConversationStorageBusy");
    expect(failure.cause).toBe(cause);
  });

  it("conversationStorageFailure maps SQLITE_IOERR to ConversationStorageBroken", () => {
    const cause = codedError("SQLITE_IOERR");
    const failure = conversationStorageFailure(cause);
    expect(failure).toBeInstanceOf(ConversationStorageBroken);
    expect(failure._tag).toBe("ConversationStorageBroken");
    expect(failure.cause).toBe(cause);
  });
});

describe("the storage failure an error stands for", () => {
  const message = "Project Storage read failed.";

  function thrownBy(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }
    return undefined;
  }

  it.each([
    { name: "broken", error: new ProjectStorageBrokenError("broken") },
    { name: "unavailable", error: new ProjectStorageUnavailableError("unavailable") },
    { name: "a broken subclass", error: new ProjectStorageOpeningReleaseFailedError("cause") },
  ])("keeps a known storage failure as it is: $name", ({ error }) => {
    expect(storageFailureFor({ error, message })).toBe(error);
    expect(thrownBy(() => normalizeStorageError({ error, message }))).toBe(error);
  });

  it.each(["SQLITE_BUSY", "SQLITE_IOERR_WRITE", "EPERM"])(
    "answers unavailable, without the cause, for the availability code %s",
    (code) => {
      const error = codedError(code);
      for (const failure of [
        storageFailureFor({ error, message }),
        thrownBy(() => normalizeStorageError({ error, message })),
      ]) {
        expect(failure).toBeInstanceOf(ProjectStorageUnavailableError);
        expect(failure).toMatchObject({
          name: "ProjectStorageUnavailableError",
          message: "Project Storage authority is unavailable.",
        });
        expect(failure).not.toHaveProperty("cause");
      }
    },
  );

  it.each([
    { name: "SQLITE_CORRUPT", error: codedError("SQLITE_CORRUPT") },
    { name: "a plain error", error: new Error("plain") },
    {
      name: "a cause-wrapped SQLITE_BUSY",
      error: new Error("wrapped", { cause: codedError("SQLITE_BUSY") }),
    },
    { name: "a non-error value", error: "SQLITE_BUSY" },
  ])("answers broken with the message and the cause for $name", ({ error }) => {
    for (const failure of [
      storageFailureFor({ error, message }),
      thrownBy(() => normalizeStorageError({ error, message })),
    ]) {
      expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
      expect(failure).toMatchObject({ name: "ProjectStorageBrokenError", message });
      expect(failure).toHaveProperty("cause", error);
    }
  });
});
