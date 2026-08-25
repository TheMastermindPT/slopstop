import { isDeepStrictEqual } from "node:util";
import {
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";

const smokeQuery = WorkspaceQuerySchema.parse({
  query: "memory-library.read",
  projectId: "00000000-0000-4000-8000-000000000001",
  cursor: null,
});
const smokeIntent = WorkspaceIntentSchema.parse({
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000001",
  proposalId: "00000000-0000-4000-8000-000000000002",
  decision: "accept",
  expectedProjectionRevision: 0,
});
const expectedMethods = [
  "getHarnessStatus",
  "queryWorkspace",
  "retryHarness",
  "submitWorkspaceIntent",
  "subscribeHarnessStatus",
  "subscribeWorkspaceNotifications",
] as const;
const expectedResultKeys = [
  "intentResult",
  "methods",
  "processType",
  "queryResult",
  "requireType",
] as const;
const expectedQueryResult = WorkspaceQueryResultSchema.parse({
  status: "unavailable",
  query: smokeQuery,
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});
const expectedIntentResult = WorkspaceIntentResultSchema.parse({
  status: "unavailable",
  capability: "memory",
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});

export const packageSmokeRendererScript = `
(async () => {
  const query = ${JSON.stringify(smokeQuery)};
  const intent = ${JSON.stringify(smokeIntent)};
  return {
    processType: typeof globalThis.process,
    requireType: typeof globalThis.require,
    methods: Object.keys(window.slopstop).sort(),
    queryResult: await window.slopstop.queryWorkspace(query),
    intentResult: await window.slopstop.submitWorkspaceIntent(intent),
  };
})()
`;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failPackageSmoke(): never {
  throw new Error("Packaged renderer smoke did not satisfy the production boundary.");
}

function validateResultKeys(value: Readonly<Record<string, unknown>>): void {
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  if (!isDeepStrictEqual(keys, expectedResultKeys)) {
    failPackageSmoke();
  }
}

function validateRendererIsolation(value: Readonly<Record<string, unknown>>): void {
  if (value["processType"] !== "undefined") {
    failPackageSmoke();
  }
  if (value["requireType"] !== "undefined") {
    failPackageSmoke();
  }
}

function validatePreloadMethods(value: Readonly<Record<string, unknown>>): void {
  if (!isDeepStrictEqual(value["methods"], expectedMethods)) {
    failPackageSmoke();
  }
}

function validateQueryResult(value: unknown): void {
  const result = WorkspaceQueryResultSchema.parse(value);
  if (!isDeepStrictEqual(result, expectedQueryResult)) {
    failPackageSmoke();
  }
}

function validateIntentResult(value: unknown): void {
  const result = WorkspaceIntentResultSchema.parse(value);
  if (!isDeepStrictEqual(result, expectedIntentResult)) {
    failPackageSmoke();
  }
}

export function validatePackageSmokeResult(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error("Packaged renderer smoke returned an invalid result.");
  }
  validateResultKeys(value);
  validateRendererIsolation(value);
  validatePreloadMethods(value);
  validateQueryResult(value["queryResult"]);
  validateIntentResult(value["intentResult"]);
}
