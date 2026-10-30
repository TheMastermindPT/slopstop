import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { LocalLibsqlResultSet } from "../storage/local-libsql-worker-client.js";
import { decodeRegistryJson, decodeRegistryRows } from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";

const projectRowsSchema = Schema.Array(Schema.Struct({ projectId: Schema.String }));
const storedRecordSchema = Schema.Struct({ requestId: Schema.String });

function resultSet(rows: LocalLibsqlResultSet["rows"]): LocalLibsqlResultSet {
  return { columns: ["projectId"], rows, rowsAffected: 0, lastInsertRowid: null };
}

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("registry decode owner", () => {
  it.each<[string, () => unknown]>([
    ["a row that fails its schema", () => decodeRegistryRows(projectRowsSchema, resultSet([[7]]))],
    ["stored text that is not JSON", () => decodeRegistryJson(storedRecordSchema, "{")],
    ["stored JSON without a required field", () => decodeRegistryJson(storedRecordSchema, "{}")],
  ])("classifies stored registry data that does not decode as corrupt (%s)", (_name, run) => {
    const thrown = thrownBy(run);
    expect(thrown).toBeInstanceOf(RegistryFault);
    expect(thrown).toHaveProperty("failure", { status: "broken", code: "REGISTRY_CORRUPT" });
    expect(registryFailure(thrown)).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
  });

  it("returns the named, decoded rows", () => {
    expect(decodeRegistryRows(projectRowsSchema, resultSet([["a"], ["b"]]))).toEqual([
      { projectId: "a" },
      { projectId: "b" },
    ]);
  });

  it("returns the decoded stored JSON", () => {
    expect(decodeRegistryJson(storedRecordSchema, '{"requestId":"r"}')).toEqual({
      requestId: "r",
    });
  });
});
