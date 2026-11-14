import { describe, expect, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import {
  exactRowSchema,
  type HarnessFailureCode,
  harnessFailureMessages,
  harnessFailureRow,
} from "./harness-failure-protocol.js";
import { harnessFailureRows } from "./index.js";
import { projectConversationDiagnostics } from "./project-conversation-protocol.js";
import { projectUpgradeDiagnostics } from "./project-upgrade-protocol.js";

const codes = [
  "PROTOCOL_MESSAGE_INVALID",
  "PROTOCOL_VERSION_UNSUPPORTED",
  "HARNESS_INTERNAL_FAILURE",
] as const satisfies readonly HarnessFailureCode[];

const tables = [
  ["upgrade", projectUpgradeDiagnostics],
  ["conversation", projectConversationDiagnostics],
] as const;

describe("harness failure rows", () => {
  it.each(codes)("builds the %s row from its one message, final", (code) => {
    expect(harnessFailureRow(code)).toEqual({
      code,
      message: harnessFailureMessages[code],
      retryable: false,
    });
  });

  it.each(tables.flatMap(([name, table]) => codes.map((code) => [name, code, table] as const)))(
    "the %s diagnostics carry the owner's %s row",
    (_name, code, table) => {
      expect(Object.values(table)).toContainEqual(harnessFailureRow(code));
    },
  );
});

describe("the exported harness failure rows", () => {
  it("has one row per harness failure code", () => {
    expect(Object.keys(harnessFailureRows).sort()).toEqual([...codes].sort());
  });

  it.each(codes)("holds the owner's %s row", (code) => {
    expect(harnessFailureRows[code]).toEqual(harnessFailureRow(code));
  });

  it.each(tables.flatMap(([name, table]) => codes.map((code) => [name, code, table] as const)))(
    "matches the %s diagnostics row for %s",
    (_name, code, table) => {
      expect(Object.values(table).find((row) => row.code === code)).toEqual(
        harnessFailureRows[code],
      );
    },
  );

  it("is frozen", () => {
    expect(Object.isFrozen(harnessFailureRows)).toBe(true);
  });
});

describe("exact row schema", () => {
  const row = () => harnessFailureRow("HARNESS_INTERNAL_FAILURE");
  const rejects = (path: readonly PropertyKey[]) => ({
    success: false,
    error: { issues: [{ code: "invalid_value", path }] },
  });

  it("accepts its own row", () => {
    expect(decodeWithIssues(exactRowSchema(row()), row())).toEqual({
      success: true,
      data: row(),
    });
  });

  it.each([
    ["a changed message", { message: "Harness failed." }, ["message"]],
    ["a retryable row", { retryable: true }, ["retryable"]],
    ["a changed code", { code: "PROTOCOL_MESSAGE_INVALID" }, ["code"]],
  ] as const)("rejects %s", (_name, change, path) => {
    expect(decodeWithIssues(exactRowSchema(row()), { ...row(), ...change })).toEqual(rejects(path));
  });

  it("rejects an extra key", () => {
    expect(decodeWithIssues(exactRowSchema(row()), { ...row(), extra: true })).toEqual({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", path: [], keys: ["extra"] }] },
    });
  });
});
