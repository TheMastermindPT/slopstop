import { describe, expect, it } from "vitest";
import {
  packageSmokeRendererScript,
  validatePackageSmokeResult,
} from "./package-smoke-verifier.js";

const query = {
  query: "memory-library.read",
  projectId: "00000000-0000-4000-8000-000000000001",
  cursor: null,
} as const;
const exactResult = {
  processType: "undefined",
  requireType: "undefined",
  methods: [
    "getHarnessStatus",
    "queryWorkspace",
    "retryHarness",
    "submitWorkspaceIntent",
    "subscribeHarnessStatus",
    "subscribeWorkspaceNotifications",
  ],
  queryResult: {
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  },
  intentResult: {
    status: "unavailable",
    capability: "memory",
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  },
} as const;

describe("packaged renderer boundary verifier", () => {
  it("validates exact packaged renderer boundary results", () => {
    expect(() => validatePackageSmokeResult(exactResult)).not.toThrow();

    for (const value of [null, "not-an-object", []]) {
      expect(() => validatePackageSmokeResult(value)).toThrowError(
        "Packaged renderer smoke returned an invalid result.",
      );
    }
    expect(() =>
      validatePackageSmokeResult({ ...exactResult, requireType: "function" }),
    ).toThrowError("Packaged renderer smoke did not satisfy the production boundary.");

    const invalidResults = [
      { ...exactResult, injected: true },
      { ...exactResult, methods: [...exactResult.methods, "unexpected"] },
      { ...exactResult, processType: "object" },
      {
        ...exactResult,
        queryResult: {
          status: "ready",
          query,
          projection: {
            projection: "memory-library",
            revision: 0,
            projectId: query.projectId,
            items: [],
            nextCursor: null,
          },
        },
      },
      { ...exactResult, intentResult: { status: "forwarded", capability: "memory" } },
      { methods: exactResult.methods },
    ];
    for (const value of invalidResults) {
      expect(() => validatePackageSmokeResult(value)).toThrow();
    }

    expect(packageSmokeRendererScript).toContain(JSON.stringify(query));
    expect(packageSmokeRendererScript).not.toContain("process.env");
    expect(packageSmokeRendererScript).not.toContain("process.argv");
    expect(packageSmokeRendererScript).not.toContain("SLOPSTOP_");
  });
});
