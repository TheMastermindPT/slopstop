import { describe, expect, it } from "vitest";
import { isCorruptStorageError, isUnavailableStorageError } from "./project-storage-node-errors.js";

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
});
