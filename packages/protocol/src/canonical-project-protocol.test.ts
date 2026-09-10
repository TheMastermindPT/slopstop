import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as protocol from "./index.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const activationId = "00000000-0000-4000-8000-000000000011";
const commandId = "00000000-0000-4000-8000-000000000012";
const request = { projectId };
const writable = {
  status: "active",
  request,
  access: "read-write",
  activationId,
  writerGeneration: 1,
};
const readOnly = {
  status: "active",
  request,
  access: "read-only",
  activationId,
  writerGeneration: null,
  diagnostic: {
    code: "WRITER_UNAVAILABLE",
    message: "Another SlopStop process holds Project write authority.",
    retryable: true,
  },
};
const commandRequest = {
  projectId,
  activationId,
  command: { commandId, type: "fixture.noop", version: 1, payload: {} },
};

function schema(name: string): z.ZodType {
  const value: unknown = Reflect.get(protocol, name);
  expect(value, name).toBeInstanceOf(z.ZodType);
  if (!(value instanceof z.ZodType)) throw new Error("Expected a public canonical schema.");
  return value;
}

function leafIssues(
  issues: readonly z.core.$ZodIssue[],
  prefix: PropertyKey[] = [],
): { path: PropertyKey[]; code: string; keys?: string[] }[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    if (issue.code === "invalid_union")
      return issue.errors.flatMap((branch) => leafIssues(branch, path));
    return [
      {
        path,
        code: issue.code,
        ...(issue.code === "unrecognized_keys" ? { keys: issue.keys } : {}),
      },
    ];
  });
}

function rejectsField(target: z.ZodType, value: unknown, path: PropertyKey[], code?: string): void {
  const parsed = target.safeParse(value);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error("Expected invalid canonical input.");
  expect(leafIssues(parsed.error.issues)).toContainEqual(
    expect.objectContaining({ path, ...(code === undefined ? {} : { code }) }),
  );
}

function commandInvalidCases(target: z.ZodType): void {
  for (const version of [0, 0.5, 9007199254740992])
    rejectsField(target, { ...commandRequest, command: { ...commandRequest.command, version } }, [
      "command",
      "version",
    ]);
  rejectsField(target, { ...commandRequest, command: { ...commandRequest.command, type: "  " } }, [
    "command",
    "type",
  ]);
  for (const payload of [undefined, () => undefined, 1n, NaN, Infinity, new Set()]) {
    rejectsField(target, { ...commandRequest, command: { ...commandRequest.command, payload } }, [
      "command",
      "payload",
    ]);
  }
  for (const invalidId of [
    "018F47A3-4E3D-4D2B-9C41-7DF4605C0A11",
    "bad",
    "00000000-0000-0000-0000-000000000000",
  ]) {
    rejectsField(target, { ...commandRequest, projectId: invalidId }, ["projectId"]);
    rejectsField(target, { ...commandRequest, activationId: invalidId }, ["activationId"]);
    rejectsField(
      target,
      { ...commandRequest, command: { ...commandRequest.command, commandId: invalidId } },
      ["command", "commandId"],
    );
  }
}

const outcomes = [
  ["inactive", "PROJECT_INACTIVE", false],
  ["project-mismatch", "PROJECT_NOT_ACTIVE", false],
  ["stale-activation", "PROJECT_ACTIVATION_STALE", false],
  ["read-only", "WRITER_UNAVAILABLE", true],
  ["stale-writer", "WRITER_FENCE_STALE", false],
  ["broken", "WRITER_FENCE_CHECK_FAILED", false],
  ["settlement-unavailable", "COMMAND_SETTLEMENT_UNAVAILABLE", false],
  ["coordinator-unavailable", "PROJECT_COORDINATOR_UNAVAILABLE", false],
] as const;

function assertPrivateKeysRejected(target: z.ZodType, values: readonly object[]): void {
  for (const value of values) {
    expect(target.parse(value)).toEqual(value);
    for (const key of ["writerToken", "tokenDigest", "canonicalDatabasePath", "writerLeasePath"]) {
      const parsed = target.safeParse({ ...value, [key]: "private" });
      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error("Private field was accepted.");
      expect(leafIssues(parsed.error.issues)).toContainEqual({
        path: [],
        code: "unrecognized_keys",
        keys: [key],
      });
    }
  }
}

function activationOutcomes(): object[] {
  return [
    writable,
    readOnly,
    { status: "not-registered", request },
    {
      status: "safe-mode",
      request,
      identity: {
        storageId: null,
        generationId: null,
        canonicalDatabaseLineageId: null,
        runtimeDatabaseLineageId: null,
      },
      canonicalHealth: {
        status: "missing",
        diagnostic: { code: "DATABASE_MISSING", message: "missing" },
      },
      runtimeHealth: { status: "healthy" },
    },
    ...[
      ["rejected", "PROJECT_ALREADY_ACTIVE"],
      ["unavailable", "PROJECT_COORDINATOR_UNAVAILABLE"],
      ["unavailable", "PROJECT_STORAGE_UNAVAILABLE"],
      ["broken", "PROJECT_STORAGE_BROKEN"],
      ["broken", "WRITER_FENCE_ACTIVATION_FAILED"],
      ["broken", "WRITER_LEASE_OPEN_FAILED"],
      ["broken", "WRITER_LEASE_LOCK_FAILED"],
      ["broken", "WRITER_LEASE_UNLOCK_FAILED"],
      ["broken", "WRITER_LEASE_CLOSE_FAILED"],
      ["broken", "WRITER_FENCE_STALE"],
      ["broken", "WRITER_FENCE_RELEASE_FAILED"],
      ["broken", "WRITER_REPOSITORY_CLOSE_FAILED"],
      ["broken", "PROJECT_STORAGE_RELEASE_FAILED"],
    ].map(([status, code]) => ({
      status,
      request,
      diagnostic: { code, message: "failure", retryable: false },
    })),
  ];
}

it("parses canonical Project activation and command protocol branches", () => {
  const activation = schema("CanonicalProjectActivationResultSchema");
  const command = schema("CanonicalProjectCommandRequestSchema");
  expect(schema("CanonicalProjectActivationRequestSchema").parse(request)).toEqual(request);
  expect(command.parse(commandRequest)).toEqual(commandRequest);
  assertPrivateKeysRejected(activation, activationOutcomes());
  for (const writerGeneration of [0, 0.5, 9007199254740992])
    rejectsField(activation, { ...writable, writerGeneration }, ["writerGeneration"]);
  rejectsField(
    activation,
    { ...readOnly, writerGeneration: 1 },
    ["writerGeneration"],
    "invalid_type",
  );
  rejectsField(
    activation,
    { ...readOnly, diagnostic: { ...readOnly.diagnostic, retryable: false } },
    ["diagnostic", "retryable"],
  );
  commandInvalidCases(command);
  rejectsField(command, { ...commandRequest, extra: true }, [], "unrecognized_keys");
  assertPrivateKeysRejected(
    schema("CanonicalProjectCommandResultSchema"),
    outcomes.map(([status, code, retryable]) => ({
      status,
      projectId,
      activationId,
      commandId,
      diagnostic: { code, message: "failure", retryable },
    })),
  );
});

const sourceProjectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const targetProjectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const otherProjectId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const switchRequest = {
  from: {
    projectId: sourceProjectId,
    activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  },
  to: { projectId: targetProjectId },
};

function changedField(value: object, path: readonly string[], key: string, replacement: unknown) {
  const changed = { ...value };
  let parent: object = changed;
  for (const segment of path) {
    const child: unknown = Reflect.get(parent, segment);
    if (typeof child !== "object" || child === null) throw new Error("Invalid fixture path.");
    const copy = { ...child };
    Reflect.set(parent, segment, copy);
    parent = copy;
  }
  if (replacement === undefined) Reflect.deleteProperty(parent, key);
  else Reflect.set(parent, key, replacement);
  return changed;
}

const switchIdentityFields = [
  { parent: "from", key: "projectId", value: sourceProjectId },
  { parent: "from", key: "activationId", value: switchRequest.from.activationId },
  { parent: "to", key: "projectId", value: targetProjectId },
] as const;

describe.each([
  { name: "A to B", value: switchRequest },
  { name: "A to A", value: { ...switchRequest, to: { projectId: sourceProjectId } } },
])("$name", ({ value }) => {
  it("parses only strict source-qualified switch requests", () => {
    expect(schema("CanonicalProjectSwitchRequestSchema").parse(value)).toEqual(value);
  });
});

describe.each([
  ...[[], ["from"], ["to"]].map((path) => ({ path, key: "extra", value: true })),
  { path: ["to"], key: "activationId", value: switchRequest.from.activationId },
  { path: [], key: "from", value: undefined },
  ...switchIdentityFields.map(({ parent, key }) => ({ path: [parent], key, value: undefined })),
  ...switchIdentityFields.flatMap(({ parent, key, value }) =>
    ["not-a-uuid", "00000000-0000-0000-0000-000000000000", value.toUpperCase()].map((invalid) => ({
      path: [parent],
      key,
      value: invalid,
    })),
  ),
])("invalid switch request $path / $key = $value", ({ path, key, value }) => {
  it("parses only strict source-qualified switch requests", () => {
    const parsed = schema("CanonicalProjectSwitchRequestSchema").safeParse(
      changedField(switchRequest, path, key, value),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Invalid switch request was accepted.");
    if (typeof value === "string" && value !== value.toLowerCase()) {
      expect(parsed.error.issues).toEqual([
        {
          code: "custom",
          path: [...path, key],
          message:
            key === "projectId"
              ? "Project identity must use lowercase UUID text."
              : "Identity must use lowercase UUID text.",
        },
      ]);
    }
  });
});

const targetRequest = { projectId: targetProjectId };
const writableSwitchTarget = {
  status: "active",
  request: targetRequest,
  access: "read-write",
  activationId: "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  writerGeneration: 1,
};
const switchTargets = [
  { name: "B_RW", value: writableSwitchTarget },
  {
    name: "B_RO",
    value: {
      status: "active",
      request: targetRequest,
      access: "read-only",
      activationId: "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      writerGeneration: null,
      diagnostic: {
        code: "WRITER_UNAVAILABLE",
        message: "Another SlopStop process holds Project write authority.",
        retryable: true,
      },
    },
  },
  {
    name: "B_SAFE",
    value: {
      status: "safe-mode",
      request: targetRequest,
      identity: {
        storageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1",
        generationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2",
        canonicalDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3",
        runtimeDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc4",
      },
      canonicalHealth: {
        status: "migration-required",
        diagnostic: {
          code: "DATABASE_MIGRATION_REQUIRED",
          message: "Database migration is required.",
        },
      },
      runtimeHealth: { status: "healthy" },
    },
  },
  { name: "not-registered", value: { status: "not-registered", request: targetRequest } },
  ...[
    ["unavailable", "PROJECT_STORAGE_UNAVAILABLE", "Project Storage is unavailable.", true],
    ["broken", "PROJECT_STORAGE_BROKEN", "Project Storage activation failed.", false],
    ["broken", "WRITER_LEASE_OPEN_FAILED", "Writer lease file could not be opened.", false],
    ["broken", "WRITER_LEASE_LOCK_FAILED", "Writer lease could not be acquired.", false],
    ["broken", "WRITER_FENCE_ACTIVATION_FAILED", "Writer fence could not be activated.", false],
    [
      "unavailable",
      "PROJECT_COORDINATOR_UNAVAILABLE",
      "Canonical Project coordination is unavailable.",
      false,
    ],
    [
      "rejected",
      "PROJECT_ALREADY_ACTIVE",
      "A Project activation already owns this harness session.",
      false,
    ],
  ].map(([status, code, message, retryable]) => ({
    name: code,
    value: { status, request: targetRequest, diagnostic: { code, message, retryable } },
  })),
];

const switchFailures = [
  ["inactive", "PROJECT_INACTIVE", "No Project is active for switching.", false],
  ["project-mismatch", "PROJECT_NOT_ACTIVE", "The switch source Project is not active.", false],
  ["stale-activation", "PROJECT_ACTIVATION_STALE", "The switch source activation is stale.", false],
  [
    "coordinator-unavailable",
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "Canonical Project coordination is unavailable.",
    false,
  ],
  ...[
    ["WRITER_FENCE_RELEASE_FAILED", true],
    ["WRITER_FENCE_STALE", false],
    ["WRITER_REPOSITORY_CLOSE_FAILED", true],
    ["WRITER_LEASE_UNLOCK_FAILED", true],
    ["WRITER_LEASE_CLOSE_FAILED", true],
    ["PROJECT_STORAGE_RELEASE_FAILED", true],
    ["WRITER_LEASE_OPEN_FAILED", true],
    ["WRITER_LEASE_LOCK_FAILED", true],
  ].map(([code, retryable]) => [
    "release-failed",
    code,
    "Project activation resources could not be released.",
    retryable,
  ]),
].map(([status, code, message, retryable]) => ({
  status,
  request: switchRequest,
  diagnostic: { code, message, retryable },
}));

function rejectsSwitchExtras(target: z.ZodType, value: object, paths: readonly string[][]): void {
  for (const path of paths) {
    for (const key of [
      "extra",
      "writerToken",
      "tokenDigest",
      "canonicalDatabasePath",
      "writerLeasePath",
      "error",
      "cause",
    ]) {
      rejectsField(target, changedField(value, path, key, true), path, "unrecognized_keys");
    }
  }
  expect(target.safeParse(changedField(value, [], "request", undefined)).success).toBe(false);
  expect(target.safeParse(changedField(value, [], "status", "switched")).success).toBe(false);
}

describe.each(switchTargets)("switch target $name", ({ value }) => {
  it("validates switch result branches and destination correlation", () => {
    const target = schema("CanonicalProjectSwitchResultSchema");
    const result = { status: "target-result", request: switchRequest, target: value };
    expect(target.parse(result)).toEqual(result);
    for (const projectId of [sourceProjectId, otherProjectId]) {
      const parsed = target.safeParse(
        changedField(result, ["target", "request"], "projectId", projectId),
      );
      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error("Mismatched switch destination was accepted.");
      expect(parsed.error.issues).toEqual([
        {
          code: "custom",
          path: ["target", "request", "projectId"],
          message: "Switch target Project must match the requested destination.",
        },
      ]);
    }
    const paths = [
      [],
      ["request"],
      ["request", "from"],
      ["request", "to"],
      ["target"],
      ["target", "request"],
    ];
    if ("diagnostic" in value && value.diagnostic !== undefined)
      paths.push(["target", "diagnostic"]);
    if ("identity" in value) {
      paths.push(
        ["target", "identity"],
        ["target", "canonicalHealth"],
        ["target", "canonicalHealth", "diagnostic"],
        ["target", "runtimeHealth"],
      );
    }
    rejectsSwitchExtras(target, result, paths);
  });
});

describe.each(
  switchTargets.flatMap(({ name, value }) =>
    "diagnostic" in value && value.diagnostic !== undefined
      ? [{ name, value, diagnostic: value.diagnostic }]
      : [],
  ),
)("nested activation retryability $name", ({ name, value, diagnostic }) => {
  it("validates switch result branches and destination correlation", () => {
    const target = schema("CanonicalProjectSwitchResultSchema");
    const result = { status: "target-result", request: switchRequest, target: value };
    const flipped = changedField(
      result,
      ["target", "diagnostic"],
      "retryable",
      !diagnostic.retryable,
    );
    if (name === "B_RO") expect(target.safeParse(flipped).success).toBe(false);
    else expect(target.parse(flipped)).toEqual(flipped);
  });
});

describe.each(switchFailures)("switch failure $status/$diagnostic.code", (result) => {
  it("validates switch result branches and destination correlation", () => {
    const target = schema("CanonicalProjectSwitchResultSchema");
    expect(target.parse(result)).toEqual(result);
    expect(
      target.safeParse(
        changedField(result, ["diagnostic"], "retryable", !result.diagnostic.retryable),
      ).success,
    ).toBe(false);
    const wrongCodes = switchFailures
      .filter(({ status }) => status !== result.status)
      .map(({ diagnostic }) => diagnostic.code);
    for (const code of [...wrongCodes, "WRITER_UNKNOWN"]) {
      expect(target.safeParse(changedField(result, ["diagnostic"], "code", code)).success).toBe(
        false,
      );
    }
    expect(target.safeParse({ ...result, target: writableSwitchTarget }).success).toBe(false);
    rejectsSwitchExtras(target, result, [
      [],
      ["request"],
      ["request", "from"],
      ["request", "to"],
      ["diagnostic"],
    ]);
  });
});
