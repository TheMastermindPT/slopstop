import { describe, expect, it } from "vitest";
import { registryFailure } from "../registration/registry-failure.js";
import { isSqliteBusy } from "./sqlite-busy.js";

const sqliteError = (code: string) => Object.assign(new Error(code), { code });

const busyCodes = ["SQLITE_BUSY", "SQLITE_LOCKED"];
const otherCodes = [
  "SQLITE_CANTOPEN",
  "SQLITE_IOERR",
  "SQLITE_READONLY",
  "SQLITE_CORRUPT",
  "SQLITE_BUSY_SNAPSHOT",
  "EBUSY",
  "UNKNOWN",
];

describe("isSqliteBusy", () => {
  it.each(busyCodes)("classifies %s as busy", (code) => {
    expect(isSqliteBusy(sqliteError(code))).toBe(true);
  });

  it.each(otherCodes)("does not classify %s as busy", (code) => {
    expect(isSqliteBusy(sqliteError(code))).toBe(false);
  });

  it.each([
    { name: "an error without a code", error: new Error("plain") },
    { name: "a non-error value", error: "SQLITE_BUSY" },
    { name: "null", error: null },
  ])("does not classify $name as busy", ({ error }) => {
    expect(isSqliteBusy(error)).toBe(false);
  });
});

describe("registryFailure keeps its answers", () => {
  it.each(busyCodes)("maps %s to REGISTRY_BUSY", (code) => {
    expect(registryFailure(sqliteError(code))).toEqual({
      status: "unavailable",
      code: "REGISTRY_BUSY",
    });
  });

  it.each(otherCodes)("maps %s to INTERNAL_FAILURE", (code) => {
    expect(registryFailure(sqliteError(code))).toEqual({
      status: "broken",
      code: "INTERNAL_FAILURE",
    });
  });
});
