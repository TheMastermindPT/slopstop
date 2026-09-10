import { createHash } from "node:crypto";
import { ProjectActivationIdSchema, ProjectIdSchema } from "@slopstop/protocol";
import { expect } from "vitest";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  alterFence,
  appliedReceipt,
  canonicalCommandProjectId,
  corruptReplayResult,
  createCanonicalCommandDatabase,
  expectBrokenReplay,
  forbidReplayWork,
  registerCounter,
  settlementRows,
  settlementT0,
  settlementT1,
  settlementText,
} from "./canonical-command-fixture.js";
import {
  activateRecovery,
  advanceRecoveryFixture,
  createRecoveryFixture,
  expectBrokenRecoveryActivation,
  expectedUnresolvedRecoveryRow,
  expectRecoveryActivationRows,
  prepareRecoveryActivation,
  type RecoveryChanges,
  type RecoveryFixture,
  recoveryActivationTime,
  recoveryRecordId,
  recoveryReleaseTime,
  rejectRecoveryCommit,
} from "./canonical-writer-recovery-fixture.js";
import { expectPublicBrokenRecoveryActivation } from "./canonical-writer-recovery-runtime-fixture.js";
import { writeCounter99 } from "./conformance-counter-command.js";

async function prepareRecoveryFamily(f: RecoveryFixture, family: string) {
  if (["conflict", "older"].includes(family))
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
  if (family === "older") {
    await advanceRecoveryFixture(f);
    f.dependencies.createRecoveryRecordId.mockReturnValue("88888888-8888-4888-8888-888888888602");
  }
  if (family === "unsupported") {
    const empty = createCanonicalCommandRegistry([]);
    f.dependencies.registry.prepare.mockImplementation((command) => empty.prepare(command));
  }
  if (family === "unchanged")
    registerCounter(f, async (context) => {
      await writeCounter99(context);
      return { outcome: "unchanged" };
    });
  if (family === "conflict") {
    f.dependencies.createReceiptId.mockReturnValue("66666666-6666-4666-8666-666666666502");
    f.dependencies.now.mockReturnValueOnce("2026-09-05T12:00:02.000Z");
  }
}

function expectedFamilyReceipt(family: string) {
  const rejected = { ...appliedReceipt, outcome: "rejected", events: [] };
  const receipts: Record<string, unknown> = {
    older: appliedReceipt,
    unchanged: { ...appliedReceipt, outcome: "unchanged", events: [] },
    unsupported: { ...rejected, rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false } },
    conflict: {
      ...rejected,
      receiptId: "66666666-6666-4666-8666-666666666502",
      projectSequence: 2,
      settledAt: "2026-09-05T12:00:02.000Z",
      rejection: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
    },
  };
  return receipts[family];
}

function expectedFamilyMarker(family: string, landed: boolean) {
  const marker = expectedUnresolvedRecoveryRow();
  if (family === "conflict")
    marker[5] = createHash("sha256")
      .update(
        '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":8},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
      )
      .digest("hex");
  if (family === "older") {
    marker[1] = "88888888-8888-4888-8888-888888888602";
    marker[2] = 2;
    marker[6] = "2026-09-05T12:00:06.000Z";
  }
  marker.splice(
    7,
    3,
    landed || family === "older" ? "receipt-found" : "receipt-absent",
    family === "older" ? 3 : 2,
    family === "older" ? "2026-09-05T12:00:07.000Z" : recoveryActivationTime,
  );
  return marker;
}

type RecoveryFamilyCase = { family: string; landed: boolean };

async function interruptRecoveryFamily(f: RecoveryFixture, { family, landed }: RecoveryFamilyCase) {
  const text =
    family === "conflict" ? settlementText.replace('"value":7', '"value":8') : settlementText;
  const fault = rejectRecoveryCommit(f, landed);
  await expect(f.repository.settle(text)).rejects.toBe(fault);
  if (family === "older") f.dependencies.now.mockReturnValue("2026-09-05T12:00:06.000Z");
  await f.repository.releaseFence(
    family === "older" ? "2026-09-05T12:00:06.000Z" : recoveryReleaseTime,
  );
  return { text, generation: family === "older" ? 3 : 2, found: landed || family === "older" };
}

export async function expectRecoveryReceiptFamily(entry: RecoveryFamilyCase) {
  const { family, landed } = entry;
  const f = await createRecoveryFixture();
  try {
    await prepareRecoveryFamily(f, family);
    const { text, generation, found } = await interruptRecoveryFamily(f, entry);
    const before = await f.snapshot();
    forbidReplayWork(f);
    const result = await activateRecovery(f, generation);
    expect(result.status).toBe("activated");
    const after = await f.snapshot();
    expect(after["writer_recovery_records"]).toEqual([expectedFamilyMarker(family, landed)]);
    for (const table of [
      "command_receipts",
      "command_idempotency",
      "command_rejections",
      "canonical_events",
      "conformance_counter",
    ])
      expect(after[table]).toEqual(before[table]);
    if (result.status !== "activated") throw result.error;
    if (found) {
      const receipt = expectedFamilyReceipt(family);
      expect(await result.repository.settle(text)).toEqual({ status: "settled", receipt });
      expect(await f.snapshot()).toEqual(after);
    }
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
    expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
    expect(f.dependencies.now).not.toHaveBeenCalled();
    if (!landed && family === "conflict")
      await expectAbsentConflictRetry(f, result.repository, text, after);
  } finally {
    await f.raw.close();
  }
}

const absentConflictReceipt = {
  ...appliedReceipt,
  receiptId: "66666666-6666-4666-8666-666666666503",
  writerGeneration: 2,
  projectSequence: 2,
  settledAt: "2026-09-05T12:00:06.000Z",
  outcome: "rejected",
  rejection: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
  events: [],
};

function expectedConflictRetryRows(after: Awaited<ReturnType<RecoveryFixture["snapshot"]>>) {
  const receipt = absentConflictReceipt;
  return {
    ...after,
    project_state: [[canonicalCommandProjectId, 2, 2, settlementT0, receipt.settledAt]],
    command_receipts: [
      ...(after["command_receipts"] ?? []),
      [
        canonicalCommandProjectId,
        receipt.receiptId,
        receipt.commandId,
        receipt.commandType,
        1,
        expectedFamilyMarker("conflict", false)[5],
        "rejected",
        2,
        2,
        receipt.settledAt,
      ],
    ],
    command_rejections: [
      [
        canonicalCommandProjectId,
        receipt.receiptId,
        "rejected",
        2,
        "IDEMPOTENCY_CONFLICT",
        0,
        '{"version":1}',
        createHash("sha256").update('{"version":1}').digest("hex"),
      ],
    ],
  };
}

async function expectAbsentConflictRetry(
  f: RecoveryFixture,
  repository: RecoveryFixture["repository"],
  text: string,
  after: Awaited<ReturnType<RecoveryFixture["snapshot"]>>,
) {
  const receipt = absentConflictReceipt;
  f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
  f.dependencies.now.mockReturnValue(receipt.settledAt);
  expect(await repository.settle(text)).toEqual({ status: "settled", receipt });
  const retried = await f.snapshot();
  expect(retried).toEqual(expectedConflictRetryRows(after));
  expect(retried["command_idempotency"]).toEqual([
    [
      canonicalCommandProjectId,
      appliedReceipt.commandId,
      expectedUnresolvedRecoveryRow()[5],
      appliedReceipt.receiptId,
      settlementT1,
    ],
  ]);
  expect(retried["conformance_counter"]).toEqual([
    [canonicalCommandProjectId, "55555555-5555-4555-8555-555555555501", 7, 2],
  ]);
  expect(retried["canonical_events"]).toEqual(after["canonical_events"]);
  expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
  expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  forbidReplayWork(f);
  const start = f.calls.length;
  expect(await repository.settle(text)).toEqual({ status: "settled", receipt });
  expect(await f.snapshot()).toEqual(retried);
  expect(f.calls.slice(start).filter((sql) => /^(INSERT|UPDATE|DELETE)/u.test(sql))).toEqual([]);
  expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
  expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
  expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  expect(f.dependencies.now).not.toHaveBeenCalled();
}

export async function expectOtherProjectRecoveryIsolation() {
  const other = ProjectIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2");
  const file = await createCanonicalCommandDatabase(true, other);
  const f = await prepareRecoveryActivation(true);
  const client = createWorkerLocalLibsqlClient(file, "generation");
  try {
    const before = await f.snapshot();
    const factory = createCanonicalCommandRepositoryFactory({
      ...f.dependencies,
      openClient: () => client,
      createHandoffId: () => "88888888-8888-4888-9888-888888888603",
    });
    const result = await factory.activate({
      canonicalDatabasePath: file,
      projectId: other,
      activationId: ProjectActivationIdSchema.parse("ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"),
      writerToken: WriterCapabilityTokenSchema.parse("3".repeat(64)),
      activatedAt: recoveryActivationTime,
    });
    expect(result.status).toBe("activated");
    expect(await f.snapshot()).toEqual(before);
    expect((await settlementRows(file))["writer_recovery_records"]).toEqual([]);
    if (result.status !== "activated") throw result.error;
    await result.repository.releaseFence("2026-09-05T12:00:06.000Z");
    const otherBefore = await settlementRows(file);
    expect((await activateRecovery(f)).status).toBe("activated");
    expectRecoveryActivationRows(before, await f.snapshot(), true, false);
    expect(await settlementRows(file)).toEqual(otherBefore);
  } finally {
    await client.close();
    await f.raw.close();
  }
}

export async function expectRecoveryHistory({ landed }: { landed: boolean }) {
  const f = await prepareRecoveryActivation(landed);
  try {
    const result = await activateRecovery(f);
    expect(result.status).toBe("activated");
    if (result.status !== "activated") throw result.error;
    const before = await f.snapshot();
    const marker = expectedUnresolvedRecoveryRow();
    marker.splice(7, 3, landed ? "receipt-found" : "receipt-absent", 2, recoveryActivationTime);
    expect(before["writer_recovery_records"]).toEqual([marker]);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(await f.snapshot()).toEqual(before);
    const receipt = landed
      ? appliedReceipt
      : {
          ...appliedReceipt,
          receiptId: "66666666-6666-4666-8666-666666666502",
          writerGeneration: 2,
          settledAt: "2026-09-05T12:00:06.000Z",
          events: [
            { eventId: "77777777-7777-4777-8777-777777777603", eventOrdinal: 0 },
            { eventId: "77777777-7777-4777-8777-777777777604", eventOrdinal: 1 },
          ],
        };
    if (!landed) {
      registerCounter(f);
      f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
      f.dependencies.now.mockReturnValue(receipt.settledAt);
      f.dependencies.createEventId
        .mockReturnValueOnce("77777777-7777-4777-8777-777777777603")
        .mockReturnValueOnce("77777777-7777-4777-8777-777777777604");
    }
    expect(await result.repository.settle(settlementText)).toEqual({ status: "settled", receipt });
    const after = await f.snapshot();
    expect(after["writer_recovery_records"]).toEqual([marker]);
    expect(after["conformance_counter"]).toEqual([
      [canonicalCommandProjectId, "55555555-5555-4555-8555-555555555501", 7, 2],
    ]);
    forbidReplayWork(f);
    expect(await result.repository.settle(settlementText)).toEqual({ status: "settled", receipt });
    expect(await f.snapshot()).toEqual(after);
  } finally {
    await f.raw.close();
  }
}

export const recoveryFenceCases: ReadonlyArray<{
  name: string;
  changes: RecoveryChanges;
  strongOnly?: boolean;
}> = [
  { name: "syntax", changes: { activatedAt: "not-a-time" } },
  { name: "minute", changes: { activatedAt: "2026-09-05T12:00Z" } },
  { name: "different seconds", changes: { generationAcquiredAt: "2026-09-05T12:00:01.000Z" } },
  {
    name: "different submillisecond",
    changes: { generationAcquiredAt: "2026-09-05T12:00:00.000001Z" },
  },
  { name: "source activation", changes: { generationActivationId: "invalid" } },
  {
    name: "source project",
    changes: { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  },
  { name: "source missing", changes: { generationNumber: null } },
  { name: "source generation", changes: { generationNumber: 2 } },
  { name: "source digest", changes: { generationDigest: "a".repeat(64) } },
  { name: "strong reader absent", changes: {}, strongOnly: true },
];

export async function expectRecoveryFenceCase(
  entry: (typeof recoveryFenceCases)[number],
  active: boolean,
  marked: boolean,
) {
  const f = await prepareRecoveryActivation(false, active);
  try {
    if (!marked) {
      await f.raw.execute("DELETE FROM writer_recovery_records");
      f.dependencies.createRecoveryRecordId.mockReturnValue(recoveryRecordId);
    }
    f.observation.after = (sql, result) => {
      if (!sql.includes("FROM writer_fence")) return result;
      if (entry.strongOnly)
        return sql.includes("generationActivationId") ? { ...result, rows: [] } : result;
      return alterFence(result, entry.changes);
    };
    await expectBrokenRecoveryActivation(f);
  } finally {
    await f.raw.close();
  }
}

export const recoveryMarkerCases: ReadonlyArray<{
  name: string;
  changes: RecoveryChanges;
  shape?: string;
}> = [
  ...[
    "bad",
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAA601",
  ].map((value) => ({ name: `identity ${value}`, changes: { recoveryRecordId: value } })),
  ...["2026-09-05T12:00Z", "2026-09-05T12:00:04+00:00", "2026-02-30T12:00:04Z"].map((value) => ({
    name: `time ${value}`,
    changes: { observedAt: value },
  })),
  { name: "foreign project", changes: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" } },
  { name: "future", changes: { writerGeneration: 2 } },
  { name: "older unresolved", changes: { writerGeneration: 0 } },
  {
    name: "unresolved abandoned",
    changes: { reason: "abandoned-active-fence", commandId: null, fingerprint: null },
  },
  { name: "reason", changes: { reason: "unknown" } },
  { name: "command", changes: { commandId: "invalid" } },
  { name: "fingerprint", changes: { fingerprint: "invalid" } },
  { name: "partial resolution", changes: { resolution: "receipt-found" } },
  { name: "partial resolver", changes: { resolvedByWriterGeneration: 2 } },
  { name: "partial time", changes: { resolvedAt: recoveryActivationTime } },
  {
    name: "current resolved missing resolver",
    changes: {
      resolution: "receipt-found",
      resolvedByWriterGeneration: null,
      resolvedAt: recoveryActivationTime,
    },
  },
  ...[1, 2, 3].map((value) => ({
    name: `current resolved ${value}`,
    changes: {
      resolution: "receipt-found",
      resolvedByWriterGeneration: value,
      resolvedAt: recoveryActivationTime,
    },
  })),
  { name: "missing source", changes: { sourceGeneration: null } },
  { name: "source project", changes: { sourceProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" } },
  { name: "source generation", changes: { sourceGeneration: 2 } },
  { name: "source activation", changes: { sourceActivationId: "invalid" } },
  { name: "source digest", changes: { sourceDigest: "a".repeat(64) } },
  { name: "source time", changes: { sourceAcquiredAt: "2026-09-05T12:00:01Z" } },
  { name: "source release", changes: { sourceReleasedAt: null } },
  ...["duplicate", "width", "extra"].map((shape) => ({ name: shape, changes: {}, shape })),
];

export async function expectRecoveryMarkerCase(entry: (typeof recoveryMarkerCases)[number]) {
  const f = await prepareRecoveryActivation(false);
  try {
    f.observation.after = (sql, result) => {
      if (!sql.includes("FROM writer_recovery_records")) return result;
      if (entry.shape === "duplicate") return { ...result, rows: [...result.rows, ...result.rows] };
      if (entry.shape === "width")
        return { ...result, rows: result.rows.map((row) => [...row, null]) };
      if (entry.shape === "extra")
        return {
          ...result,
          columns: [...result.columns, "extra"],
          rows: result.rows.map((row) => [...row, null]),
        };
      return alterFence(result, entry.changes);
    };
    await expectBrokenRecoveryActivation(f);
  } finally {
    await f.raw.close();
  }
}

type LedgerCase = {
  target: Parameters<typeof corruptReplayResult>[1];
  changes: RecoveryChanges;
  shape?: string;
  family?: "applied" | "unchanged" | "rejected" | "conflict";
};

export const recoveryLedgerCases: LedgerCase[] = [
  { target: "events", family: "unchanged", shape: "forbidden child", changes: {} },
  { target: "rejections", family: "unchanged", shape: "forbidden child", changes: {} },
  { target: "rejections", family: "applied", shape: "forbidden child", changes: {} },
  { target: "events", family: "rejected", shape: "forbidden child", changes: {} },
  ...["absent", "duplicate", "duplicate alias", "row width", "extra alias"].map((shape) => ({
    target: "count" as const,
    changes: {},
    shape,
  })),
  { target: "pointer", changes: { receiptId: "66666666-6666-4666-8666-666666666506" } },
  ...(["original", "requested"] as const).flatMap((target) =>
    [
      { receiptId: "66666666-6666-4666-8666-666666666506" },
      { receiptId: "00000000-0000-0000-0000-000000000000" },
      { receiptId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1" },
      { projectId: "invalid" },
      { commandId: "invalid" },
      { commandType: " " },
      { commandType: " conformance.counter.set" },
      { generationNumber: 2 },
      ...[0, 1.5, 9007199254740992].flatMap((value) => [
        { commandVersion: value },
        { projectSequence: value },
        { writerGeneration: value },
      ]),
      ...["2026-09-05T12:00:00+00:00", "2026-09-05T12:00:00", "2026-02-30T12:00:00Z"].map(
        (settledAt) => ({ settledAt }),
      ),
    ].map((changes) => ({ target, changes })),
  ),
  { target: "requested", changes: { commandType: "conformance.counter.other" } },
  { target: "requested", changes: { commandVersion: 2 } },
  { target: "events", changes: {}, shape: "reordered" },
  ...[
    { eventOrdinal: 0 },
    { eventOrdinal: 2 },
    { eventId: appliedReceipt.events[0].eventId },
    { payloadHash: "abcd" },
    { payloadHash: "A".repeat(64) },
    { payloadText: '{"value":8}' },
  ].map((changes) => ({ target: "events" as const, changes })),
  ...(["pointer", "original", "requested"] as const).flatMap((target) => [
    ...["absent", "duplicate", "duplicate alias", "row width", "extra alias"].map((shape) => ({
      target,
      changes: {},
      shape,
    })),
    ...[
      { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
      { commandId: "44444444-4444-4444-8444-444444444502" },
      { receiptId: "invalid" },
      { fingerprint: "a".repeat(64) },
      { fingerprint: "bad" },
    ].map((changes) => ({ target, changes })),
  ]),
  { target: "pointer", changes: { createdAt: "2026-09-05T12:00:02.000Z" } },
  { target: "pointer", changes: { createdAt: "2026-09-05T12:00Z" } },
  ...(["original", "requested"] as const).flatMap((target) => [
    ...[
      { projectSequence: 2 },
      { writerGeneration: 2, generationNumber: 2 },
      { generationNumber: null },
      { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
      { settledAt: "2026-09-05T12:00Z" },
      { outcome: "unknown" },
    ].map((changes) => ({ target, changes })),
  ]),
  ...[null, "1", -1, 0.5, 9007199254740992, 0].map((value) => ({
    target: "count" as const,
    changes: { receiptCount: value },
  })),
  ...["duplicate", "duplicate alias", "row width", "extra alias"].map((shape) => ({
    target: "events" as const,
    changes: {},
    shape,
  })),
  ...[
    { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
    { receiptId: "66666666-6666-4666-8666-666666666506" },
    { receiptOutcome: "unchanged" },
    { projectSequence: 2 },
    { occurredAt: "2026-09-05T12:00:01.000001Z" },
    { occurredAt: "2026-09-05T12:00Z" },
    { eventOrdinal: 1 },
    { payloadHash: "a".repeat(64) },
    { aggregateType: " " },
    { eventType: " " },
  ].map((changes) => ({ target: "events" as const, changes })),
  ...["eventId", "aggregateId"].flatMap((field) =>
    [
      "invalid",
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    ].map((value) => ({ target: "events" as const, changes: { [field]: value } })),
  ),
  ...[0, -1, 0.5, 9007199254740992].flatMap((value) =>
    ["aggregateVersion", "eventVersion"].map((field) => ({
      target: "events" as const,
      changes: { [field]: value },
    })),
  ),
  ...[
    "{",
    '{"value":1e999}',
    '{"value":7,"previous":0}',
    '{ "value":7}',
    '{"value":7,"value":7}',
  ].map((text) => ({
    target: "events" as const,
    changes: { payloadText: text, payloadHash: createHash("sha256").update(text).digest("hex") },
  })),
  ...["absent", "duplicate", "duplicate alias", "row width", "extra alias"].map((shape) => ({
    target: "rejections" as const,
    changes: {},
    shape,
    family: "rejected" as const,
  })),
  ...[
    { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
    { receiptId: "66666666-6666-4666-8666-666666666502" },
    { receiptOutcome: "applied" },
    { projectSequence: 2 },
    { code: "" },
    { code: "lowercase" },
    { code: "A".repeat(65) },
    { code: "COMMAND_TYPE_UNSUPPORTED", retryable: 1 },
    { code: "COMMAND_PAYLOAD_INVALID", retryable: 1 },
    { code: "IDEMPOTENCY_CONFLICT", retryable: 1 },
    { detailsHash: "a".repeat(64) },
    { detailsHash: "short" },
    { detailsHash: "A".repeat(64) },
  ].map((changes) => ({ target: "rejections" as const, changes, family: "rejected" as const })),
  ...[-1, 2, 0.5, "0", null].map((value) => ({
    target: "rejections" as const,
    changes: { retryable: value },
    family: "rejected" as const,
  })),
  ...[
    "{",
    '{"version":2}',
    '{"private":"secret","version":1}',
    "[1]",
    "{}",
    "null",
    '{ "version":1}',
    '{"version":1,"version":1}',
  ].map((text) => ({
    target: "rejections" as const,
    changes: { detailsText: text, detailsHash: createHash("sha256").update(text).digest("hex") },
    family: "rejected" as const,
  })),
  ...[
    { outcome: "applied" },
    { outcome: "unchanged" },
    { receiptId: appliedReceipt.receiptId },
    { projectSequence: 1 },
    { projectSequence: 3 },
    { writerGeneration: 2, generationNumber: 2 },
    { fingerprint: "a".repeat(64) },
  ].map((changes) => ({ target: "requested" as const, changes, family: "conflict" as const })),
  ...["TEST_COUNTER_REJECTED", "COMMAND_TYPE_UNSUPPORTED", "COMMAND_PAYLOAD_INVALID"].map(
    (code) => ({ target: "rejections" as const, changes: { code }, family: "conflict" as const }),
  ),
];

async function prepareRecoveryLedger(f: RecoveryFixture, entry: LedgerCase) {
  await prepareRecoveryFamily(
    f,
    entry.family === "rejected" ? "unsupported" : (entry.family ?? "applied"),
  );
  return entry.family === "conflict"
    ? settlementText.replace('"value":7', '"value":8')
    : settlementText;
}

export async function expectRecoveryLedgerCase(entry: LedgerCase, baseline = false) {
  const f = await createRecoveryFixture();
  try {
    const text = await prepareRecoveryLedger(f, entry);
    await settleRecoveryLedger(f, text, baseline);
    forbidReplayWork(f);
    observeRecoveryLedger(f, entry);
    if (entry.shape === "forbidden child") {
      await expectForbiddenRecoveryChild(f, entry.target, baseline);
      return;
    }
    if (baseline) await expectBrokenReplay(f, text);
    else await expectBrokenRecoveryActivation(f);
  } finally {
    await f.raw.close();
  }
}

async function settleRecoveryLedger(f: RecoveryFixture, text: string, baseline: boolean) {
  if (baseline) {
    await f.repository.settle(text);
    return;
  }
  const error = rejectRecoveryCommit(f, true);
  await expect(f.repository.settle(text)).rejects.toBe(error);
  await f.repository.releaseFence(recoveryReleaseTime);
}

function observeRecoveryLedger(f: RecoveryFixture, entry: LedgerCase) {
  corruptReplayResult(f, entry.target, entry.changes, entry.shape);
  if (entry.shape === "reordered") {
    f.observation.after = (sql, result) =>
      sql.includes("FROM canonical_events")
        ? { ...result, rows: [...result.rows].reverse() }
        : result;
  }
}

async function expectForbiddenRecoveryChild(
  f: RecoveryFixture,
  target: LedgerCase["target"],
  baseline: boolean,
) {
  let reached = false;
  const child: RecoveryChanges = {
    projectId: canonicalCommandProjectId,
    receiptId: appliedReceipt.receiptId,
    receiptOutcome: "applied",
    projectSequence: 1,
    eventId: appliedReceipt.events[0].eventId,
    eventOrdinal: 0,
    aggregateType: "conformance.counter",
    aggregateId: "55555555-5555-4555-8555-555555555501",
    aggregateVersion: 2,
    eventType: "conformance.counter.changed",
    eventVersion: 1,
    payloadText: '{"previous":0,"value":7}',
    payloadHash: createHash("sha256").update('{"previous":0,"value":7}').digest("hex"),
    occurredAt: settlementT1,
  };
  f.observation.after = (sql, result) => {
    const table = target === "events" ? "canonical_events" : "command_rejections";
    if (!sql.includes(`FROM ${table}`)) return result;
    reached = true;
    return { ...result, rows: [result.columns.map((column) => child[column] ?? null)] };
  };
  if (baseline) await expectBrokenReplay(f);
  else await expectPublicBrokenRecoveryActivation(f);
  expect(reached).toBe(true);
}
