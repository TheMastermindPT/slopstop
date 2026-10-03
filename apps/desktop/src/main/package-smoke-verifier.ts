import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  decodeStrict,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
  WriterProofNativeTargetSchema,
  writerProofNativeBindingFilename,
  writerProofNativePackageVersion,
} from "@slopstop/protocol";

const smokeQuery = decodeStrict(WorkspaceQuerySchema, {
  query: "memory-library.read",
  projectId: "00000000-0000-4000-8000-000000000001",
  cursor: null,
});
const smokeIntent = decodeStrict(WorkspaceIntentSchema, {
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000001",
  proposalId: "00000000-0000-4000-8000-000000000002",
  decision: "accept",
  expectedProjectionRevision: 0,
});
const expectedMethods = [
  "activateProject",
  "getHarnessStatus",
  "listProjects",
  "queryWorkspace",
  "retryHarness",
  "submitWorkspaceIntent",
  "subscribeHarnessStatus",
  "subscribeWorkspaceNotifications",
  "switchProject",
] as const;
const expectedResultKeys = [
  "intentResult",
  "methods",
  "processType",
  "queryResult",
  "requireType",
] as const;
const expectedQueryResult = decodeStrict(WorkspaceQueryResultSchema, {
  status: "unavailable",
  query: smokeQuery,
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});
const expectedIntentResult = decodeStrict(WorkspaceIntentResultSchema, {
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
  const result = decodeStrict(WorkspaceQueryResultSchema, value);
  if (!isDeepStrictEqual(result, expectedQueryResult)) {
    failPackageSmoke();
  }
}

function validateIntentResult(value: unknown): void {
  const result = decodeStrict(WorkspaceIntentResultSchema, value);
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

export type WriterProofStage =
  | "native-preflight"
  | "spawn"
  | "handshake"
  | "transport"
  | "unexpected-message"
  | "inactive"
  | "activate"
  | "first-settlement"
  | "contention"
  | "read-only"
  | "hard-kill"
  | "takeover"
  | "replay"
  | "stale-activation"
  | "next-settlement"
  | "audit"
  | "stale-initialize"
  | "stale-release"
  | "stale-attempt"
  | "stale-finish"
  | "clean-stop"
  | "process-exit"
  | "stdio-drain"
  | "output-bound"
  | "cancelled"
  | "proof-deadline"
  | "cleanup"
  | "internal";

export class WriterProofError extends Error {
  override readonly name = "WriterProofError";
  constructor(readonly stage: WriterProofStage) {
    super("Packaged Writer proof failed.");
  }
}

export function requireWriterProof(condition: boolean, stage: WriterProofStage): asserts condition {
  if (!condition) throw new WriterProofError(stage);
}

// Published v1.5.1 prebuild SHA-256, base64; approved Architecture preflight.
const writerBindingSha256 = Object.freeze({
  "win32-x64": "3T+OsdU0QfFRVRyEoSEceVJLHqt0/4Ork+aAN/OZe6Q=",
  "linux-x64": "E2V9t86S+CPugGbMckTzpHU0Bwf8Bl/U9azu67+omMM=",
  "linux-arm64": "iV3Q3KCUOEVPKLuiULyvo+ack3/pfqRrG2IS3DqBMVw=",
  "darwin-x64": "lz5LKt3zCQG5VcdWJqwVPTo3zrz6YhN1vNSQ8ZmITI4=",
  "darwin-arm64": "HpO3TlVrfRdn1X+rsZfZ0d9WQUU5ZxcFNyePcu1G8Bg=",
});

type WriterNativeInput = Readonly<{
  resourcesPath: string;
  mainBundleDirectory: string;
}>;

function nativePackagePaths(input: WriterNativeInput) {
  requireWriterProof(path.isAbsolute(input.resourcesPath), "native-preflight");
  requireWriterProof(
    path.normalize(input.resourcesPath) === input.resourcesPath,
    "native-preflight",
  );
  const buildDirectory = path.join(input.resourcesPath, "app.asar", ".vite", "build");
  requireWriterProof(input.mainBundleDirectory === buildDirectory, "native-preflight");
  const relativePackage = path.join(".vite", "build", "node_modules", "fs-native-extensions");
  return {
    virtualRoot: path.join(input.resourcesPath, "app.asar", relativePackage),
    unpackedRoot: path.join(input.resourcesPath, "app.asar.unpacked", relativePackage),
  };
}

function verifyNativeFile(filename: string, expectedHash: string): void {
  const entry = lstatSync(filename);
  requireWriterProof(
    entry.isFile() && !entry.isSymbolicLink() && entry.size > 0,
    "native-preflight",
  );
  requireWriterProof(realpathSync.native(filename) === filename, "native-preflight");
  const hash = createHash("sha256").update(readFileSync(filename)).digest("base64");
  requireWriterProof(hash === expectedHash, "native-preflight");
}

function verifyNativeManifest(virtualRoot: string): void {
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(virtualRoot, "package.json"), "utf8"),
  );
  requireWriterProof(isRecord(manifest), "native-preflight");
  requireWriterProof(manifest["name"] === "fs-native-extensions", "native-preflight");
  requireWriterProof(manifest["version"] === writerProofNativePackageVersion, "native-preflight");
}

function observeNativeLoad(
  load: () => unknown,
  virtualBinding: string,
  unpackedBinding: string,
): void {
  const originalDlopen = process.dlopen;
  let loads = 0;
  process.dlopen = (...args) => {
    const [, filename] = args;
    requireWriterProof(
      filename === virtualBinding ||
        filename === unpackedBinding ||
        filename === path.toNamespacedPath(unpackedBinding),
      "native-preflight",
    );
    const result = originalDlopen.apply(process, args);
    loads += 1;
    return result;
  };
  try {
    const native = load();
    requireWriterProof(loads === 1 && isRecord(native), "native-preflight");
    requireWriterProof(typeof native["tryLock"] === "function", "native-preflight");
    requireWriterProof(typeof native["unlock"] === "function", "native-preflight");
  } finally {
    process.dlopen = originalDlopen;
  }
}

export function verifyPackagedWriterNative(input: WriterNativeInput): void {
  try {
    const target = decodeStrict(
      WriterProofNativeTargetSchema,
      `${process.platform}-${process.arch}`,
    );
    const { virtualRoot, unpackedRoot } = nativePackagePaths(input);
    const suffix = path.join("prebuilds", target, writerProofNativeBindingFilename);
    const unpackedBinding = path.join(unpackedRoot, suffix);
    verifyNativeFile(unpackedBinding, writerBindingSha256[target]);
    verifyNativeManifest(virtualRoot);
    const requireFromHarness = createRequire(path.join(input.mainBundleDirectory, "harness.cjs"));
    requireWriterProof(
      requireFromHarness.resolve("fs-native-extensions") === path.join(virtualRoot, "index.js"),
      "native-preflight",
    );
    observeNativeLoad(
      () => requireFromHarness("fs-native-extensions"),
      path.join(virtualRoot, suffix),
      unpackedBinding,
    );
  } catch {
    throw new WriterProofError("native-preflight");
  }
}
