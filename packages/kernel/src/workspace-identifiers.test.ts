import { Result, Schema, SchemaIssue } from "effect";
import { describe, expect, it } from "vitest";
import {
  isDomainIdentity,
  isWorkspaceProjectionRevision,
  LowercaseDomainIdentityTextSchema,
} from "./workspace-identifiers.js";

const validIdentity = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";
const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();

function lowercaseIssues(value: unknown) {
  const decoded = Schema.decodeUnknownResult(LowercaseDomainIdentityTextSchema)(value);
  return Result.isFailure(decoded) ? formatIssue(decoded.failure.issue).issues : [];
}

describe("workspace identifiers", () => {
  it("recognizes only boundary-safe identities and revisions", () => {
    expect(isDomainIdentity(validIdentity)).toBe(true);
    for (const value of [
      null,
      1,
      "not-a-uuid",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      validIdentity.toUpperCase(),
      "018f47a3-4e3d-0d2b-9c41-7df4605c0a11",
    ]) {
      expect(isDomainIdentity(value), String(value)).toBe(false);
    }
    expect(
      isDomainIdentity({
        toString: () => validIdentity,
      }),
    ).toBe(false);
    expect(lowercaseIssues(validIdentity)).toEqual([]);
    expect(lowercaseIssues(validIdentity.toUpperCase())).toEqual([
      { path: [], message: "Identity must use lowercase UUID text." },
    ]);

    for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) {
      expect(isWorkspaceProjectionRevision(value)).toBe(true);
    }
    for (const value of [null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isWorkspaceProjectionRevision(value)).toBe(false);
    }
  });
});
