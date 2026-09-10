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

describe("S5 finite JSON payloads", () => {
  it("preserves finite JSON edge values without prototype assignment: own data", () => {
    const payload: unknown = JSON.parse(
      '{"__proto__":{"x":1},"10":10,"2":2,"text":"  e\\u0301  ","n":-0}',
    );
    const parsed = protocol.TypedCommandSchema.parse({ ...commandRequest.command, payload });
    expect(parsed.payload).toEqual(payload);
    if (parsed.payload === null || typeof parsed.payload !== "object") {
      throw new Error("Expected an object payload.");
    }
    expect(Object.hasOwn(parsed.payload, "__proto__")).toBe(true);
    expect(Object.hasOwn(parsed.payload, "x")).toBe(false);
    expect(Reflect.get(parsed.payload, "x")).toBeUndefined();
  });

  it.each([null, true, false, "", "  text  ", 0, -0, 0.125, [], {}])(
    "preserves finite JSON edge values without prototype assignment: valid %j",
    (payload) => {
      expect(
        protocol.TypedCommandSchema.parse({ ...commandRequest.command, payload }).payload,
      ).toEqual(payload);
    },
  );

  it("preserves finite JSON edge values without prototype assignment: shared acyclic data", () => {
    const shared = { n: 1 };
    const payload = { left: shared, right: shared };
    expect(
      protocol.TypedCommandSchema.parse({ ...commandRequest.command, payload }).payload,
    ).toEqual({ left: { n: 1 }, right: { n: 1 } });
  });

  it.each([NaN, Infinity, -Infinity, undefined, 1n, () => undefined, Symbol("invalid")])(
    "preserves finite JSON edge values without prototype assignment: invalid own proto %s",
    (value) => {
      const payload: object = JSON.parse('{"__proto__":null}');
      Reflect.set(payload, "__proto__", value);
      expect(
        protocol.TypedCommandSchema.safeParse({ ...commandRequest.command, payload }).success,
      ).toBe(false);
    },
  );

  it.each([
    { name: "sparse array", make: () => new Array(1) },
    { name: "extra array property", make: () => Object.assign([1], { extra: 2 }) },
    { name: "array symbol", make: () => Object.assign([1], { [Symbol("extra")]: 2 }) },
    { name: "hidden property", make: () => Object.defineProperty({}, "hidden", { value: 1 }) },
    { name: "symbol property", make: () => ({ [Symbol("hidden")]: 1 }) },
    { name: "date", make: () => new Date("2026-09-05T12:00:00Z") },
    {
      name: "accessor",
      make: () =>
        Object.defineProperty({}, "value", {
          enumerable: true,
          get: () => {
            throw new Error("JSON parsing must not invoke accessors.");
          },
        }),
    },
    {
      name: "cycle",
      make: () => {
        const value: Record<string, unknown> = {};
        value["self"] = value;
        return value;
      },
    },
  ])(
    "preserves finite JSON edge values without prototype assignment: rejects $name",
    ({ make }) => {
      expect(
        protocol.TypedCommandSchema.safeParse({
          ...commandRequest.command,
          payload: make(),
        }).success,
      ).toBe(false);
    },
  );
});

const appliedReceipt = {
  receiptId: "66666666-6666-4666-8666-666666666501",
  projectId: sourceProjectId,
  commandId: "44444444-4444-4444-8444-444444444501",
  commandType: "conformance.counter.set",
  commandVersion: 1,
  outcome: "applied",
  projectSequence: 1,
  writerGeneration: 1,
  settledAt: "2026-09-05T12:00:01.000Z",
  events: [
    { eventId: "77777777-7777-4777-8777-777777777501", eventOrdinal: 0 },
    { eventId: "77777777-7777-4777-8777-777777777502", eventOrdinal: 1 },
  ],
};
const unchangedReceipt = {
  ...appliedReceipt,
  receiptId: "66666666-6666-4666-8666-666666666502",
  commandId: "44444444-4444-4444-8444-444444444502",
  projectSequence: 2,
  settledAt: "2026-09-05T12:00:02.000Z",
  outcome: "unchanged",
  events: [],
};
const rejectedReceipt = {
  ...appliedReceipt,
  receiptId: "66666666-6666-4666-8666-666666666503",
  commandId: "44444444-4444-4444-8444-444444444503",
  projectSequence: 3,
  settledAt: "2026-09-05T12:00:03.000Z",
  outcome: "rejected",
  events: [],
  rejection: { code: "TEST_COUNTER_REJECTED", retryable: false },
};
const settledResult = {
  status: "settled",
  projectId: appliedReceipt.projectId,
  activationId: switchRequest.from.activationId,
  commandId: appliedReceipt.commandId,
  receipt: appliedReceipt,
};
const settlementFailures = [
  ["command-busy", "COMMAND_IN_PROGRESS", "Another command is in progress.", true],
  ["writer-unavailable", "WRITER_UNAVAILABLE", "The Writer requires explicit reactivation.", false],
  ["sequence-exhausted", "PROJECT_SEQUENCE_EXHAUSTED", "The Project sequence is exhausted.", false],
] as const;
const invalidReceiptIds = [
  "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "not-a-uuid",
];
const invalidPositiveOrders = [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1];
const privateReceiptKeys = [
  "extra",
  "payload",
  "eventPayload",
  "commandFingerprint",
  "writerToken",
  "tokenDigest",
  "path",
  "cause",
  "exceptionDetails",
];

describe("S5 G2 receipt protocol", () => {
  it.each([appliedReceipt, unchangedReceipt, rejectedReceipt])(
    "validates settled receipts and new non-durable result branches: exact $outcome",
    (receipt) => {
      expect(schema("CanonicalCommandReceiptSchema").parse(receipt)).toEqual(receipt);
      const result = { ...settledResult, commandId: receipt.commandId, receipt };
      expect(protocol.CanonicalProjectCommandResultSchema.parse(result)).toEqual(result);
    },
  );

  it("validates settled receipts and new non-durable result branches: old receipt under new epoch", () => {
    const result = { ...settledResult, activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2" };
    expect(protocol.CanonicalProjectCommandResultSchema.parse(result)).toEqual(result);
  });

  it.each(["projectId", "commandId"])(
    "validates settled receipts and new non-durable result branches: correlation %s",
    (key) => {
      const result = changedField(settledResult, ["receipt"], key, otherProjectId);
      expect(protocol.CanonicalProjectCommandResultSchema.safeParse(result).success).toBe(false);
    },
  );

  it.each(settlementFailures)(
    "validates settled receipts and new non-durable result branches: %s",
    (status, code, message, retryable) => {
      const result = {
        status,
        projectId: sourceProjectId,
        activationId: switchRequest.from.activationId,
        commandId: appliedReceipt.commandId,
        diagnostic: { code, message, retryable },
      };
      expect(protocol.CanonicalProjectCommandResultSchema.parse(result)).toEqual(result);
    },
  );

  describe.each(settlementFailures)("non-durable %s", (status, code, message, retryable) => {
    const result = {
      status,
      projectId: sourceProjectId,
      activationId: switchRequest.from.activationId,
      commandId: appliedReceipt.commandId,
      diagnostic: { code, message, retryable },
    };
    it.each([
      { ...result, diagnostic: { ...result.diagnostic, retryable: !retryable } },
      { ...result, diagnostic: { ...result.diagnostic, code: "UNKNOWN_CODE" } },
      { ...result, receipt: appliedReceipt },
      ...settlementFailures
        .filter((failure) => failure[1] !== code)
        .map((failure) => ({
          ...result,
          diagnostic: { ...result.diagnostic, code: failure[1] },
        })),
      ...privateReceiptKeys.flatMap((key) => [
        { ...result, [key]: "private" },
        { ...result, diagnostic: { ...result.diagnostic, [key]: "private" } },
      ]),
    ])("rejects invalid non-durable variant %#", (invalid) => {
      expect(protocol.CanonicalProjectCommandResultSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe.each(["receiptId", "projectId", "commandId"])("receipt identity %s", (key) => {
    it.each(invalidReceiptIds)("rejects %s", (value) => {
      rejectsField(schema("CanonicalCommandReceiptSchema"), { ...appliedReceipt, [key]: value }, [
        key,
      ]);
    });
  });

  describe.each(["projectSequence", "writerGeneration", "commandVersion"])(
    "receipt order %s",
    (key) => {
      it.each(invalidPositiveOrders)("rejects %s", (value) => {
        rejectsField(schema("CanonicalCommandReceiptSchema"), { ...appliedReceipt, [key]: value }, [
          key,
        ]);
      });
      it("preserves the maximum safe integer", () => {
        const value = { ...appliedReceipt, [key]: Number.MAX_SAFE_INTEGER };
        expect(schema("CanonicalCommandReceiptSchema").parse(value)).toEqual(value);
      });
    },
  );

  it.each(["", " ", " conformance.counter.set", "conformance.counter.set "])(
    "rejects receipt command type %j without normalization",
    (commandType) => {
      rejectsField(schema("CanonicalCommandReceiptSchema"), { ...appliedReceipt, commandType }, [
        "commandType",
      ]);
    },
  );

  it.each([
    {
      name: "duplicate identity",
      events: [appliedReceipt.events[0], { ...appliedReceipt.events[0], eventOrdinal: 1 }],
    },
    { name: "reversed order", events: [...appliedReceipt.events].reverse() },
    {
      name: "gap",
      events: [appliedReceipt.events[0], { ...appliedReceipt.events[1], eventOrdinal: 2 }],
    },
    { name: "starts at one", events: [appliedReceipt.events[1]] },
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((eventOrdinal) => ({
      name: `ordinal ${eventOrdinal}`,
      events: [{ ...appliedReceipt.events[0], eventOrdinal }],
    })),
    ...invalidReceiptIds.map((eventId) => ({
      name: `identity ${eventId}`,
      events: [{ eventId, eventOrdinal: 0 }],
    })),
  ])("rejects event references: $name", ({ events }) => {
    expect(
      schema("CanonicalCommandReceiptSchema").safeParse({ ...appliedReceipt, events }).success,
    ).toBe(false);
  });

  it.each([
    { ...appliedReceipt, events: [] },
    { ...rejectedReceipt, rejection: { code: "COUNTER_POLICY_REJECTED", retryable: true } },
    ...["IDEMPOTENCY_CONFLICT", "COMMAND_TYPE_UNSUPPORTED", "COMMAND_PAYLOAD_INVALID"].map(
      (code) => ({ ...rejectedReceipt, rejection: { code, retryable: false } }),
    ),
    { ...rejectedReceipt, rejection: { code: "A", retryable: false } },
    { ...rejectedReceipt, rejection: { code: `A${"_".repeat(63)}`, retryable: false } },
  ])("preserves valid receipt variant %#", (receipt) => {
    expect(schema("CanonicalCommandReceiptSchema").parse(receipt)).toEqual(receipt);
  });

  it.each([
    { ...unchangedReceipt, events: appliedReceipt.events },
    { ...rejectedReceipt, events: appliedReceipt.events },
    { ...appliedReceipt, rejection: rejectedReceipt.rejection },
    { ...unchangedReceipt, rejection: rejectedReceipt.rejection },
    { ...unchangedReceipt, outcome: "rejected" },
    { ...appliedReceipt, outcome: "unknown" },
    ...["IDEMPOTENCY_CONFLICT", "COMMAND_TYPE_UNSUPPORTED", "COMMAND_PAYLOAD_INVALID"].map(
      (code) => ({ ...rejectedReceipt, rejection: { code, retryable: true } }),
    ),
    ...["", "lower_case", " CODE", "CODE ", "1CODE", "CODE-DASH", "A".repeat(65)].map((code) => ({
      ...rejectedReceipt,
      rejection: { code, retryable: false },
    })),
    { ...rejectedReceipt, rejection: { code: "COUNTER_POLICY_REJECTED" } },
    { ...rejectedReceipt, rejection: { code: "COUNTER_POLICY_REJECTED", retryable: "false" } },
  ])("rejects mutually exclusive receipt/rejection variant %#", (receipt) => {
    expect(schema("CanonicalCommandReceiptSchema").safeParse(receipt).success).toBe(false);
  });

  describe.each(privateReceiptKeys)("private field %s", (key) => {
    it.each([
      { name: "result", value: { ...settledResult, [key]: "private" } },
      {
        name: "receipt",
        value: { ...settledResult, receipt: { ...appliedReceipt, [key]: "private" } },
      },
      {
        name: "rejection",
        value: {
          ...settledResult,
          commandId: rejectedReceipt.commandId,
          receipt: {
            ...rejectedReceipt,
            rejection: { ...rejectedReceipt.rejection, [key]: "private" },
          },
        },
      },
      {
        name: "event reference",
        value: {
          ...settledResult,
          receipt: {
            ...appliedReceipt,
            events: [{ ...appliedReceipt.events[0], [key]: "private" }, appliedReceipt.events[1]],
          },
        },
      },
    ])("rejects $name without stripping", ({ value }) => {
      expect(protocol.CanonicalProjectCommandResultSchema.safeParse(value).success).toBe(false);
      if (value.receipt !== appliedReceipt) {
        expect(schema("CanonicalCommandReceiptSchema").safeParse(value.receipt).success).toBe(
          false,
        );
      }
    });
  });

  it.each([appliedReceipt, unchangedReceipt, rejectedReceipt])(
    "freezes $outcome receipt and every nested property",
    (receipt) => {
      const parsed: unknown = schema("CanonicalCommandReceiptSchema").parse(receipt);
      if (typeof parsed !== "object" || parsed === null)
        throw new Error("Expected receipt object.");
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(Reflect.set(parsed, "settledAt", "changed")).toBe(false);
      expect(Reflect.deleteProperty(parsed, "commandId")).toBe(false);
      const events: unknown = Reflect.get(parsed, "events");
      if (!Array.isArray(events)) throw new Error("Expected event list.");
      expect(Object.isFrozen(events)).toBe(true);
      expect(() => events.push({ eventId: "new", eventOrdinal: 2 })).toThrow(TypeError);
      expect(Reflect.set(events, "0", {})).toBe(false);
      for (const event of events) {
        expect(Object.isFrozen(event)).toBe(true);
        expect(Reflect.set(event, "eventOrdinal", 99)).toBe(false);
      }
      if (Object.hasOwn(parsed, "rejection")) {
        const rejection: object = Reflect.get(parsed, "rejection");
        expect(Object.isFrozen(rejection)).toBe(true);
        expect(Reflect.set(rejection, "retryable", true)).toBe(false);
      }
      expect(parsed).toEqual(receipt);
    },
  );

  it.each(["2026-09-05T12:00:00Z", "2026-09-05T12:00:00.123Z", "2026-09-05T12:00:00.123456Z"])(
    "requires seconds in settlement clocks and persisted receipt instants: preserves %s",
    (settledAt) => {
      expect(schema("CanonicalSettlementTimeSchema").parse(settledAt)).toBe(settledAt);
      const receipt = { ...appliedReceipt, settledAt };
      expect(schema("CanonicalCommandReceiptSchema").parse(receipt)).toEqual(receipt);
    },
  );
  it.each([
    "2026-09-05T12:00Z",
    "2026-09-05T12:00:00+00:00",
    "2026-09-05T12:00:00",
    "2026-02-30T12:00:00Z",
    "2026-09-05T12:00:00+01:00",
  ])(
    "requires seconds in settlement clocks and persisted receipt instants: rejects %s",
    (settledAt) => {
      expect(schema("CanonicalSettlementTimeSchema").safeParse(settledAt).success).toBe(false);
      rejectsField(schema("CanonicalCommandReceiptSchema"), { ...appliedReceipt, settledAt }, [
        "settledAt",
      ]);
    },
  );
});
