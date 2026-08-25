import { describe, expect, it } from "vitest";
import { isDomainIdentity, isWorkspaceProjectionRevision } from "./workspace-identifiers.js";

describe("workspace identifiers", () => {
  it("recognizes only boundary-safe identities and revisions", () => {
    expect(isDomainIdentity("018f47a3-4e3d-7d2b-9c41-7df4605c0a11")).toBe(true);
    for (const value of [null, 1, "not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
      expect(isDomainIdentity(value)).toBe(false);
    }
    expect(
      isDomainIdentity({
        toString: () => "018f47a3-4e3d-7d2b-9c41-7df4605c0a11",
      }),
    ).toBe(false);

    for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) {
      expect(isWorkspaceProjectionRevision(value)).toBe(true);
    }
    for (const value of [null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isWorkspaceProjectionRevision(value)).toBe(false);
    }
  });
});
