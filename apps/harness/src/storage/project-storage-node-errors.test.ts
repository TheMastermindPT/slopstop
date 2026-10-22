import { describe, expect, it } from "vitest";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import {
  isBusyStorageError,
  isCorruptStorageError,
  isKnownStorageFailure,
  isUnavailableStorageError,
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
    { name: "unavailable class", error: new ProjectStorageUnavailableError("owner"), busy: true },
    {
      name: "wrapped busy cause",
      error: new Error("wrapped", { cause: { code: "SQLITE_BUSY" } }),
      busy: true,
    },
    {
      name: "wrapped plain cause",
      error: new Error("wrapped", { cause: new Error("x") }),
      busy: false,
    },
    { name: "plain error", error: new Error("plain"), busy: false },
  ])("knows a busy storage error, directly or by its cause: $name", ({ error, busy }) => {
    expect(isBusyStorageError({ error })).toBe(busy);
  });
});
