import { describe, expect, it } from "vitest";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { classifyUpgradeStatements } from "./project-storage-upgrade-eligibility.js";

const eligibleLists: readonly (readonly string[])[] = [
  ["CREATE TABLE a (x)", "CREATE UNIQUE INDEX i ON a(x)"],
  ["CREATE INDEX j ON a(y)"],
  ["create index k on a(z)"],
  ["CREATE TABLE a (x);"],
];

const unsupportedLists: readonly (readonly string[])[] = [
  ["ALTER TABLE a ADD b"],
  ["-- note\nALTER TABLE a ADD b"],
  ["INSERT INTO a VALUES (1)"],
  ["DROP TABLE a"],
  ["CREATE TABLE a (x); DROP TABLE b"],
  ["CREATE VIEW v AS SELECT 1"],
  ["CREATE TRIGGER t AFTER INSERT ON a BEGIN SELECT 1; END"],
  ["CREATE VIRTUAL TABLE f USING fts5(x)"],
  ["CREATE TEMP TABLE a (x)"],
  ["CREATE TABLE IF NOT EXISTS a (x)"],
  ["CREATE TABLE b AS SELECT * FROM a"],
  ["CREATE TABLE __new_a (x)"],
  ["CREATE INDEX __new_i ON a(x)"],
];

describe("project storage upgrade eligibility", () => {
  it("classifies pending statements by additive kind", () => {
    for (const statements of eligibleLists) {
      expect.soft(classifyUpgradeStatements(statements), statements.join(" | ")).toEqual({
        status: "eligible",
      });
    }
    for (const statements of unsupportedLists) {
      expect.soft(classifyUpgradeStatements(statements), statements.join(" | ")).toEqual({
        status: "unsupported",
      });
    }
    expect.soft(classifyUpgradeStatements([])).toEqual({ status: "empty" });
    expect
      .soft(() => classifyUpgradeStatements(['CREATE TABLE "a (x)']))
      .toThrow(ProjectStorageBrokenError);
  });
});
