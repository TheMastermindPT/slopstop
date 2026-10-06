import { describe, expect, expectTypeOf, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import {
  acceptsStrict,
  decodeStrict,
  type MessageId,
  type WriterProofControl,
  WriterProofControlSchema,
  type WriterProofEvent,
  WriterProofEventSchema,
  WriterProofNativeMetadataSchema,
  type WriterProofStart,
  WriterProofStartSchema,
  writerProofFirstCommand,
  writerProofInactiveActivationId,
  writerProofNativeBindingFilename,
  writerProofNativePackageVersion,
  writerProofNextCommand,
  writerProofProjectId,
  writerProofStaleCommand,
  writerProofStaleCreateRequestId,
  writerProofStaleProjectId,
} from "./index.js";
import { DesktopMessageSchema, HarnessMessageSchema, MessageIdSchema } from "./protocol.js";

const projectId = "00000000-0000-4000-8000-000000000101";
const staleProjectId = "00000000-0000-4000-8000-000000000104";
const activation1 = "00000000-0000-4000-8000-000000000141";
const activation2 = "00000000-0000-4000-8000-000000000142";
const oldActivation = "00000000-0000-4000-8000-000000000143";
const replacementActivation = "00000000-0000-4000-8000-000000000144";
const command1 = "00000000-0000-4000-8000-000000000131";
const command2 = "00000000-0000-4000-8000-000000000132";
const command3 = "00000000-0000-4000-8000-000000000133";
const nil = "00000000-0000-0000-0000-000000000000";
const max = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const uppercaseMessageId = "ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF";
const invalidIdentities = [nil, max, "not-a-uuid", "", ` ${activation1}`, uppercaseMessageId];
const invalidMessageIds = [nil, max, "not-a-uuid", "", ` ${activation1}`, max.toUpperCase()];
const privateFields = ["path", "token", "fingerprint", "cause", "sql", "rawRows", "extra"];
const targets = ["win32-x64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"];
const native = {
  packageName: "fs-native-extensions",
  packageVersion: "1.5.1",
  target: "win32-x64",
  unpackedTargetBinding: true,
  fallbackLoaded: false,
};
const start = {
  version: 1,
  kind: "writer-proof.connect",
  proofId: "00000000-0000-4000-8000-000000000161",
  bootstrap: {
    kind: "harness.connect",
    applicationStorageRootUrl: "file:///C:/smoke/storage/",
    migrationResourcesRootUrl: "file:///C:/smoke/migrations/",
  },
};
const correlation = {
  version: 1,
  proofId: start.proofId,
  requestId: "00000000-0000-4000-8000-000000000171",
};
const receipt1 = {
  receiptId: "00000000-0000-4000-8000-000000000151",
  projectId,
  commandId: command1,
  commandType: "conformance.writer.noop",
  commandVersion: 1,
  projectSequence: 1,
  writerGeneration: 1,
  settledAt: "2026-09-05T12:00:01.000Z",
  outcome: "rejected",
  events: [],
  rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
};
const receipt2 = {
  ...receipt1,
  receiptId: "00000000-0000-4000-8000-000000000152",
  commandId: command2,
  projectSequence: 2,
  writerGeneration: 2,
  settledAt: "2026-09-05T12:00:02.000Z",
};
const initialize = { ...correlation, step: "stale.initialize", stepNumber: 1 };
const release = {
  ...correlation,
  requestId: "00000000-0000-4000-8000-000000000172",
  step: "stale.release",
  stepNumber: 2,
};
const attempt = {
  ...correlation,
  requestId: "00000000-0000-4000-8000-000000000173",
  step: "stale.attempt",
  stepNumber: 3,
};
const finish = {
  ...correlation,
  requestId: "00000000-0000-4000-8000-000000000174",
  step: "stale.finish",
  stepNumber: 4,
};
const audit = {
  ...correlation,
  proofId: "00000000-0000-4000-8000-000000000162",
  requestId: "00000000-0000-4000-8000-000000000175",
  step: "audit.initialize",
  stepNumber: 1,
};
const auditControl = {
  ...audit,
  kind: "writer-proof.control",
  activationIds: [activation1, activation2],
  expectedReceipts: [receipt1, receipt2],
};
const attemptControl = {
  ...attempt,
  kind: "writer-proof.control",
  replacementActivationId: replacementActivation,
  replacementWriterGeneration: 2,
};
const initializeResult = {
  ...initialize,
  kind: "writer-proof.result",
  projectId: staleProjectId,
  activationId: oldActivation,
  writerGeneration: 1,
  native,
};
const attemptResult = {
  ...attempt,
  kind: "writer-proof.result",
  projectId: staleProjectId,
  activationId: oldActivation,
  commandId: command3,
  replacementActivationId: replacementActivation,
  replacementWriterGeneration: 2,
  status: "stale-writer",
  code: "WRITER_FENCE_STALE",
  retryable: false,
  allCanonicalRowsUnchanged: true,
  registryCalls: 0,
  handlerCalls: 0,
  identityCalls: 0,
  settlementClockCalls: 0,
  writerClose: "stale-refused",
  operationalReleaseAuthorized: false,
};
const auditResult = {
  ...audit,
  kind: "writer-proof.result",
  projectId,
  audit: "exact-ledger-and-abandoned-recovery",
  lastProjectSequence: 2,
  lastWriterGeneration: 2,
  receipts: 2,
  rejections: 2,
  idempotency: 2,
  events: 0,
  generations: 2,
  handoffs: 2,
  abandonedRecoveryRecords: 1,
  uncertainRecoveryRecords: 0,
  fence: "released",
  native,
};
const controls = [
  { ...initialize, kind: "writer-proof.control" },
  { ...release, kind: "writer-proof.control" },
  attemptControl,
  { ...finish, kind: "writer-proof.control" },
  auditControl,
];
const results = [
  initializeResult,
  { ...release, kind: "writer-proof.result", testLeaseReleased: true, oldWriterRetained: true },
  attemptResult,
  { ...finish, kind: "writer-proof.result", teardown: "test-resources-only" },
  auditResult,
];
const envelopes = [
  { name: "start", schema: WriterProofStartSchema, value: start },
  ...controls.map((value) => ({
    name: `control ${value.step}`,
    schema: WriterProofControlSchema,
    value,
  })),
  ...results.map((value) => ({
    name: `result ${value.step}`,
    schema: WriterProofEventSchema,
    value,
  })),
];

describe.each(envelopes)("$name closed envelope", ({ schema, value }) => {
  it("round-trips the exact approved fields unchanged", () => {
    expect(decodeStrict(schema, value)).toEqual(value);
  });
  it.each(Object.keys(value))("rejects missing field %s", (key) => {
    const incomplete = Object.fromEntries(Object.entries(value).filter(([field]) => field !== key));
    expect(decodeWithIssues(schema, incomplete).success).toBe(false);
  });
  it.each(privateFields)("rejects extra/private field %s", (key) => {
    expect(decodeWithIssues(schema, { ...value, [key]: "private" }).success).toBe(false);
  });
  it.each([0, 2, "1", null])("rejects version %j", (version) => {
    expect(decodeWithIssues(schema, { ...value, version }).success).toBe(false);
  });
  it("rejects a different kind", () => {
    expect(decodeWithIssues(schema, { ...value, kind: "writer-proof.wrong" }).success).toBe(false);
  });
  it.each(invalidMessageIds)("rejects smoke proofId %s", (proofId) => {
    expect(decodeWithIssues(schema, { ...value, proofId }).success).toBe(false);
  });
  it("retains valid uppercase MessageId spelling", () => {
    const uppercase = { ...value, proofId: uppercaseMessageId };
    expect(decodeStrict(schema, uppercase)).toEqual(uppercase);
  });
  it("rejects fixture kinds at both product boundaries", () => {
    expect(acceptsStrict(DesktopMessageSchema, value)).toBe(false);
    expect(acceptsStrict(HarnessMessageSchema, value)).toBe(false);
    const metadata = {
      protocolVersion: 6,
      messageId: correlation.requestId,
      sentAt: "2026-09-05T12:00:00.000Z",
      payload: value,
    };
    expect(
      decodeWithIssues(DesktopMessageSchema, {
        ...metadata,
        messageType: "command",
        command: value.kind,
      }).success,
    ).toBe(false);
    expect(
      acceptsStrict(HarnessMessageSchema, {
        ...metadata,
        messageType: "event",
        event: value.kind,
        sequence: 1,
        causationId: correlation.requestId,
      }),
    ).toBe(false);
  });
});

describe.each(envelopes.filter(({ name }) => name !== "start"))(
  "$name correlation",
  ({ schema, value }) => {
    it.each(invalidMessageIds)("rejects smoke requestId %s", (requestId) => {
      expect(decodeWithIssues(schema, { ...value, requestId }).success).toBe(false);
    });
    it("retains valid uppercase requestId spelling", () => {
      const uppercase = { ...value, requestId: uppercaseMessageId };
      expect(decodeStrict(schema, uppercase)).toEqual(uppercase);
    });
    it.each([0, 1, 2, 3, 4, 5, 1.5, "1", null])(
      "requires its exact stepNumber %j",
      (stepNumber) => {
        if (!("stepNumber" in value))
          throw new Error("Control/result fixture requires stepNumber.");
        expect(decodeWithIssues(schema, { ...value, stepNumber }).success).toBe(
          stepNumber === value.stepNumber,
        );
      },
    );
    it("rejects unknown steps", () => {
      expect(decodeWithIssues(schema, { ...value, step: "stale.unknown" }).success).toBe(false);
    });
  },
);

describe("start bootstrap and general MessageId owner", () => {
  it("preserves the MessageId brand on all smoke correlation fields", () => {
    expectTypeOf<WriterProofStart["proofId"]>().toEqualTypeOf<MessageId>();
    expectTypeOf<WriterProofControl["proofId"]>().toEqualTypeOf<MessageId>();
    expectTypeOf<WriterProofControl["requestId"]>().toEqualTypeOf<MessageId>();
    expectTypeOf<WriterProofEvent["proofId"]>().toEqualTypeOf<MessageId>();
    expectTypeOf<WriterProofEvent["requestId"]>().toEqualTypeOf<MessageId>();
  });
  it.each([nil, max, uppercaseMessageId])("preserves legacy MessageId acceptance %s", (value) => {
    expect(decodeStrict(MessageIdSchema, value)).toBe(value);
  });
  it.each([
    { kind: "writer-proof.connect" },
    { applicationStorageRootUrl: "https://example.com/storage" },
    { migrationResourcesRootUrl: "file://server/share" },
    { applicationStorageRootUrl: "file:///C:/smoke/%2fsecret" },
    { token: "private" },
  ])("rejects invalid bootstrap %j", (change) => {
    expect(
      decodeWithIssues(WriterProofStartSchema, {
        ...start,
        bootstrap: { ...start.bootstrap, ...change },
      }).success,
    ).toBe(false);
  });
  it.each(Object.keys(start.bootstrap))("rejects missing bootstrap field %s", (key) => {
    const bootstrap = Object.fromEntries(
      Object.entries(start.bootstrap).filter(([field]) => field !== key),
    );
    expect(acceptsStrict(WriterProofStartSchema, { ...start, bootstrap })).toBe(false);
  });
});

describe("control audit receipt authority", () => {
  it.each(
    [[], [activation1], [activation1, activation1], [activation1, activation2, oldActivation]].map(
      (activationIds) => ({ activationIds }),
    ),
  )("rejects invalid activation pairs %j", ({ activationIds }) => {
    expect(acceptsStrict(WriterProofControlSchema, { ...auditControl, activationIds })).toBe(false);
  });
  it.each(invalidIdentities)("rejects malformed durable activation %s", (identity) => {
    expect(
      decodeWithIssues(WriterProofControlSchema, {
        ...attemptControl,
        replacementActivationId: identity,
      }).success,
    ).toBe(false);
    for (const activationIds of [
      [identity, activation2],
      [activation1, identity],
    ]) {
      expect(acceptsStrict(WriterProofControlSchema, { ...auditControl, activationIds })).toBe(
        false,
      );
    }
  });
  it.each(
    [
      [],
      [receipt1],
      [receipt2, receipt1],
      [receipt1, receipt2, receipt2],
      [receipt1, { ...receipt2, receiptId: receipt1.receiptId }],
    ].map((expectedReceipts) => ({ expectedReceipts })),
  )("rejects wrong receipt tuple %j", ({ expectedReceipts }) => {
    expect(acceptsStrict(WriterProofControlSchema, { ...auditControl, expectedReceipts })).toBe(
      false,
    );
  });
  it.each([
    { projectId: staleProjectId },
    { commandId: command3 },
    { commandType: "conformance.other" },
    { commandVersion: 2 },
    { projectSequence: 3 },
    { writerGeneration: 3 },
    { outcome: "unchanged", rejection: undefined },
    { outcome: "applied", rejection: undefined },
    { events: [{ eventId: activation1, eventOrdinal: 0 }] },
    { rejection: { code: "OTHER_REJECTION", retryable: false } },
    { rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: true } },
    { settledAt: "2026-09-05T12:00:01+01:00" },
    { settledAt: "not-a-time" },
  ])("rejects contradictory receipt metadata %j", (change) => {
    for (const expectedReceipts of [
      [{ ...receipt1, ...change }, receipt2],
      [receipt1, { ...receipt2, ...change }],
    ]) {
      expect(acceptsStrict(WriterProofControlSchema, { ...auditControl, expectedReceipts })).toBe(
        false,
      );
    }
  });
  it("rejects a retry receipt relabelled with the replacement generation", () => {
    expect(
      acceptsStrict(WriterProofControlSchema, {
        ...auditControl,
        expectedReceipts: [{ ...receipt1, writerGeneration: 2 }, receipt2],
      }),
    ).toBe(false);
  });
  it("rejects relabelled first and second sequence/generation bindings", () => {
    for (const expectedReceipts of [
      [{ ...receipt1, projectSequence: 2 }, receipt2],
      [receipt1, { ...receipt2, projectSequence: 1 }],
      [receipt1, { ...receipt2, writerGeneration: 1 }],
    ]) {
      expect(acceptsStrict(WriterProofControlSchema, { ...auditControl, expectedReceipts })).toBe(
        false,
      );
    }
  });
  it.each(Object.keys(receipt1))("rejects missing receipt field %s", (key) => {
    const incomplete = Object.fromEntries(
      Object.entries(receipt1).filter(([field]) => field !== key),
    );
    expect(
      acceptsStrict(WriterProofControlSchema, {
        ...auditControl,
        expectedReceipts: [incomplete, receipt2],
      }),
    ).toBe(false);
  });
  it.each(["receiptId", "projectId", "commandId"])(
    "rejects malformed durable receipt identity %s",
    (key) => {
      for (const identity of invalidIdentities) {
        expect(
          acceptsStrict(WriterProofControlSchema, {
            ...auditControl,
            expectedReceipts: [{ ...receipt1, [key]: identity }, receipt2],
          }),
        ).toBe(false);
      }
    },
  );
  it.each(privateFields)("rejects private receipt/rejection data %s", (key) => {
    for (const first of [
      { ...receipt1, [key]: "private" },
      { ...receipt1, rejection: { ...receipt1.rejection, [key]: "private" } },
    ]) {
      expect(
        acceptsStrict(WriterProofControlSchema, {
          ...auditControl,
          expectedReceipts: [first, receipt2],
        }),
      ).toBe(false);
    }
  });
});

it("exports the exact collaborating proof identities and inert commands", () => {
  expect(writerProofProjectId).toBe(projectId);
  expect(writerProofStaleProjectId).toBe(staleProjectId);
  expect(writerProofStaleCreateRequestId).toBe("00000000-0000-4000-8000-000000000114");
  expect(writerProofInactiveActivationId).toBe("00000000-0000-4000-8000-000000000121");
  expect(writerProofNativePackageVersion).toBe("1.5.1");
  expect(writerProofNativeBindingFilename).toBe("fs-native-extensions.node");
  expect([writerProofFirstCommand, writerProofNextCommand, writerProofStaleCommand]).toEqual(
    [command1, command2, command3].map((commandId) => ({
      commandId,
      type: "conformance.writer.noop",
      version: 1,
      payload: {},
    })),
  );
});

describe.each([
  { name: "control", schema: WriterProofControlSchema, value: attemptControl },
  { name: "result", schema: WriterProofEventSchema, value: attemptResult },
])("$name replacement generation", ({ schema, value }) => {
  it.each([-1, 0, 1, 3, 2.5, "2", null])("rejects generation %j", (replacementWriterGeneration) => {
    expect(decodeWithIssues(schema, { ...value, replacementWriterGeneration }).success).toBe(false);
  });
});

describe("result durable identities and exact proof observations", () => {
  it.each(invalidIdentities)("rejects invalid result identities %s", (identity) => {
    for (const value of [initializeResult, attemptResult]) {
      expect(acceptsStrict(WriterProofEventSchema, { ...value, activationId: identity })).toBe(
        false,
      );
      expect(acceptsStrict(WriterProofEventSchema, { ...value, projectId: identity })).toBe(false);
    }
    expect(
      decodeWithIssues(WriterProofEventSchema, {
        ...attemptResult,
        replacementActivationId: identity,
      }).success,
    ).toBe(false);
    expect(acceptsStrict(WriterProofEventSchema, { ...attemptResult, commandId: identity })).toBe(
      false,
    );
  });
  it("rejects repeated old and replacement epochs", () => {
    expect(
      acceptsStrict(WriterProofEventSchema, {
        ...attemptResult,
        replacementActivationId: oldActivation,
      }),
    ).toBe(false);
  });
  it.each([
    { projectId },
    { commandId: command1 },
    { status: "settled" },
    { code: "PROJECT_ACTIVATION_STALE" },
    { retryable: true },
    { allCanonicalRowsUnchanged: false },
    { registryCalls: 1 },
    { handlerCalls: 1 },
    { identityCalls: 1 },
    { settlementClockCalls: 1 },
    { writerClose: "closed" },
    { operationalReleaseAuthorized: true },
  ])("rejects weakened stale observations %j", (change) => {
    expect(acceptsStrict(WriterProofEventSchema, { ...attemptResult, ...change })).toBe(false);
  });
  it.each([
    { projectId: staleProjectId },
    { audit: "counts-only" },
    { lastProjectSequence: 1 },
    { lastWriterGeneration: 1 },
    { receipts: 1 },
    { rejections: 1 },
    { idempotency: 1 },
    { events: 1 },
    { generations: 1 },
    { handoffs: 1 },
    { abandonedRecoveryRecords: 0 },
    { uncertainRecoveryRecords: 1 },
    { fence: "active" },
  ])("rejects weakened audit observations %j", (change) => {
    expect(acceptsStrict(WriterProofEventSchema, { ...auditResult, ...change })).toBe(false);
  });
  it("rejects wrong initialization identity and generation", () => {
    for (const change of [{ projectId }, { writerGeneration: 0 }, { writerGeneration: 2 }]) {
      expect(acceptsStrict(WriterProofEventSchema, { ...initializeResult, ...change })).toBe(false);
    }
  });
  it("rejects weakened release and teardown witnesses", () => {
    for (const change of [{ testLeaseReleased: false }, { oldWriterRetained: false }]) {
      expect(
        acceptsStrict(WriterProofEventSchema, {
          ...release,
          kind: "writer-proof.result",
          testLeaseReleased: true,
          oldWriterRetained: true,
          ...change,
        }),
      ).toBe(false);
    }
    for (const teardown of ["complete", "operational-release", "test-resources-only "]) {
      expect(
        decodeWithIssues(WriterProofEventSchema, {
          ...finish,
          kind: "writer-proof.result",
          teardown,
        }).success,
      ).toBe(false);
    }
  });
});

describe("native metadata", () => {
  it.each(targets)("accepts pinned metadata for supported target %s", (target) => {
    const metadata = { ...native, target };
    expect(decodeStrict(WriterProofNativeMetadataSchema, metadata)).toEqual(metadata);
    expect(decodeStrict(WriterProofEventSchema, { ...initializeResult, native: metadata })).toEqual(
      {
        ...initializeResult,
        native: metadata,
      },
    );
    expect(decodeStrict(WriterProofEventSchema, { ...auditResult, native: metadata })).toEqual({
      ...auditResult,
      native: metadata,
    });
  });
  it.each([
    { packageName: "other-native" },
    { packageVersion: "1.5.0" },
    { packageVersion: "1.5.2" },
    { target: "win32-arm64" },
    { target: "linux-ia32" },
    { target: "linux-x64-musl" },
    { target: "WIN32-X64" },
    { target: "win32-x64 " },
    { fallbackLoaded: true },
    { unpackedTargetBinding: false },
    ...privateFields.map((key) => ({ [key]: "private" })),
  ])("rejects mismatched or leaking native metadata %j", (change) => {
    const metadata = { ...native, ...change };
    expect(acceptsStrict(WriterProofNativeMetadataSchema, metadata)).toBe(false);
    expect(acceptsStrict(WriterProofEventSchema, { ...initializeResult, native: metadata })).toBe(
      false,
    );
    expect(acceptsStrict(WriterProofEventSchema, { ...auditResult, native: metadata })).toBe(false);
  });
  it.each(Object.keys(native))("rejects missing native field %s", (key) => {
    const metadata = Object.fromEntries(Object.entries(native).filter(([field]) => field !== key));
    expect(acceptsStrict(WriterProofNativeMetadataSchema, metadata)).toBe(false);
  });
});
