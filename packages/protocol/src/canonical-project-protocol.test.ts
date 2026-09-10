import { expect, it } from "vitest";
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
