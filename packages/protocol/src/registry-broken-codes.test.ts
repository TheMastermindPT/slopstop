import { describe, expect, it } from "vitest";
import {
  acceptsStrict,
  CanonicalProjectActivationResultSchema,
  isRegistryBrokenCode,
  ProjectListResultSchema,
  ProjectRegistrationResultSchema,
  registeredProjectSelectionCodes,
  registryBrokenCodes,
} from "./index.js";

const projectId = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";

describe("registry-broken codes", () => {
  it("names the registry-broken set once", () => {
    expect(registryBrokenCodes).toEqual([
      "REGISTRY_SCHEMA_UNKNOWN",
      "REGISTRY_SCHEMA_NEWER",
      "REGISTRY_CORRUPT",
    ]);
    expect(isRegistryBrokenCode("REGISTRY_BUSY")).toBe(false);
    expect(isRegistryBrokenCode("INTERNAL_FAILURE")).toBe(false);
  });

  it.each(registryBrokenCodes)("carries every registry-broken code (%s)", (code) => {
    expect(acceptsStrict(ProjectListResultSchema, { status: "broken", code })).toBe(true);
    expect(acceptsStrict(ProjectRegistrationResultSchema, { status: "broken", code })).toBe(true);
    expect(
      acceptsStrict(CanonicalProjectActivationResultSchema, {
        status: "broken",
        request: { projectId },
        diagnostic: { code, message: "Saved Projects can't be read.", retryable: false },
      }),
    ).toBe(true);
    expect(registeredProjectSelectionCodes).toContain(code);
    expect(isRegistryBrokenCode(code)).toBe(true);
  });
});
