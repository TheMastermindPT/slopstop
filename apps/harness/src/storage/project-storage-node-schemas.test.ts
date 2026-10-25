import { decodeStrictResult, summarizeSchemaError } from "@slopstop/protocol";
import { Result, type Schema, SchemaIssue } from "effect";
import { describe, expect, it } from "vitest";
import { privateLocationIdSchema, utcInstantSchema } from "./project-storage-node-schemas.js";

const valid = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";
const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();

/** The decode's issues as code and path, with each issue's message when it carries one. */
function issues(
  value: string,
  schema: Schema.ConstraintDecoder<unknown> = privateLocationIdSchema,
) {
  const decoded = decodeStrictResult(schema, value);
  if (Result.isSuccess(decoded)) return [];
  const messages = formatIssue(decoded.failure.issue).issues;
  return summarizeSchemaError(decoded.failure).map((summary, index) =>
    summary.code === "custom" ? { ...summary, message: messages[index]?.message } : summary,
  );
}

describe("project storage node schemas", () => {
  it.each([
    ["nil", "00000000-0000-0000-0000-000000000000", [{ code: "invalid_format", path: [] }]],
    ["max", "ffffffff-ffff-ffff-ffff-ffffffffffff", [{ code: "invalid_format", path: [] }]],
    [
      "uppercase",
      valid.toUpperCase(),
      [{ code: "custom", path: [], message: "Identity must use lowercase UUID text." }],
    ],
  ])("rejects a non-strict private location identity (%s)", (_name, value, expected) => {
    expect(issues(valid)).toEqual([]);
    expect(issues(value)).toEqual(expected);
  });

  it.each([
    [
      "minute only",
      "2026-10-03T12:00Z",
      [{ code: "custom", path: [], message: "UTC instant must include seconds." }],
    ],
    [
      "offset",
      "2026-10-03T12:00:00+01:00",
      [{ code: "custom", path: [], message: "UTC instant must end in Z." }],
    ],
  ])("rejects a minute-only stored instant (%s)", (_name, value, expected) => {
    expect(issues("2026-10-03T12:00:00.000Z", utcInstantSchema)).toEqual([]);
    expect(issues(value, utcInstantSchema)).toEqual(expected);
  });
});
