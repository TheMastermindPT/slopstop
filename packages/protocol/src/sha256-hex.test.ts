import { Result, SchemaIssue } from "effect";
import { describe, expect, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import { decodeStrictResult, Sha256HexSchema } from "./index.js";

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();

/** The decode's issues, each with the message a reader of the failure sees. */
function issues(value: string) {
  const decoded = decodeStrictResult(Sha256HexSchema, value);
  if (Result.isSuccess(decoded)) return [];
  const messages = formatIssue(decoded.failure.issue).issues.map((issue) => issue.message);
  return (decodeWithIssues(Sha256HexSchema, value).error?.issues ?? []).map((issue, index) => ({
    ...issue,
    message: messages[index],
  }));
}

const refusal = [
  {
    code: "invalid_format",
    path: [],
    message: "Expected a string matching the RegExp ^[0-9a-f]{64}$",
  },
];

describe("SHA-256 hex", () => {
  it.each([
    ["zeros", "0".repeat(64), []],
    ["fs", "f".repeat(64), []],
    ["digest of abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", []],
    ["uppercase", "A".repeat(64), refusal],
    ["63 characters", "0".repeat(63), refusal],
    ["65 characters", "0".repeat(65), refusal],
    ["non-hex", "g".repeat(64), refusal],
    ["empty", "", refusal],
  ])("accepts only lowercase 64-character hex digests (%s)", (_name, value, expected) => {
    expect(issues(value)).toEqual(expected);
  });
});
