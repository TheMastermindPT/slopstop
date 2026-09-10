import { createHash } from "node:crypto";
import {
  type CanonicalCommandReceipt,
  CommandIdSchema,
  ProjectActivationIdSchema,
} from "@slopstop/protocol";
import { expect, vi } from "vitest";
import type { CanonicalCommandDecision } from "../../src/canonical-command-registry.js";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import { snapshotCanonicalCommand } from "../../src/canonical-json.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import type { CanonicalSettlementDependencies } from "../../src/storage/canonical-command-settlement.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlResultSet,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  appliedReceipt,
  authorityPassed,
  canonicalCommandAggregateId,
  canonicalCommandProjectId,
  createCanonicalCommandDatabase,
  observedSettlementClient,
  type SettlementObservation,
  settlementRequest,
  settlementRows,
  settlementT0,
  settlementT1,
  settlementText,
} from "./canonical-command-database-fixture.js";
import {
  type admissionCases,
  type CounterContext,
  conflictCases,
  createConformanceCounterCommand,
  expectCorrectedRows,
  writeCounter99,
} from "./conformance-counter-command.js";

export {
  appliedReceipt,
  authorityPassed,
  canonicalCommandAggregateId,
  canonicalCommandProjectId,
  createCanonicalCommandDatabase,
  observedSettlementClient,
  type SettlementObservation,
  settlementRequest,
  settlementRows,
  settlementT0,
  settlementT1,
  settlementText,
  statementText,
} from "./canonical-command-database-fixture.js";

type ExpectedReceipt = Readonly<{
  projectId: string;
  receiptId: string;
  commandId: string;
  commandType: string;
  commandVersion: number;
  outcome: "applied" | "unchanged" | "rejected";
  projectSequence: number;
  writerGeneration: number;
  settledAt: string;
}>;

// These rows use fixture expectations, never a receipt returned by the repository.
function expectedReceiptRow(r: ExpectedReceipt, fingerprint: string) {
  return [
    r.projectId,
    r.receiptId,
    r.commandId,
    r.commandType,
    r.commandVersion,
    fingerprint,
    r.outcome,
    r.projectSequence,
    r.writerGeneration,
    r.settledAt,
  ];
}

function expectedRejectionRow(
  r: ExpectedReceipt,
  rejection: Readonly<{ code: string; retryable: boolean }>,
) {
  return [
    r.projectId,
    r.receiptId,
    "rejected",
    r.projectSequence,
    rejection.code,
    rejection.retryable ? 1 : 0,
    '{"version":1}',
    createHash("sha256").update('{"version":1}').digest("hex"),
  ];
}

export async function expectMalformedSequenceState(value: string | number | null) {
  const f = await createSettlementFixture();
  try {
    f.observation.after = (sql, result) => {
      if (!sql.includes("last_project_sequence AS lastProjectSequence")) return result;
      if (value === "missing") return { ...result, rows: [] };
      if (value === "duplicate") return { ...result, rows: [...result.rows, ...result.rows] };
      return alterFence(result, { lastProjectSequence: value });
    };
    await expectBrokenReplay(f);
  } finally {
    await f.close();
  }
}

export async function expectSequenceBound(priorConflict: boolean, newConflict: boolean) {
  const f = await createSettlementFixture();
  try {
    if (priorConflict) await prepareConflict(f);
    await f.raw.execute({
      sql: "UPDATE project_state SET last_project_sequence=? WHERE project_id=?",
      args: [
        priorConflict ? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER - 1,
        settlementRequest.projectId,
      ],
    });
    const receipt = priorConflict
      ? appliedReceipt
      : { ...appliedReceipt, projectSequence: Number.MAX_SAFE_INTEGER };
    if (!priorConflict) await expectFirstAtSequenceBound(f);
    forbidReplayWork(f);
    const empty = createCanonicalCommandRegistry([]);
    f.dependencies.registry.prepare.mockImplementation((command) => empty.prepare(command));
    const before = await f.snapshot();
    expect(await f.repository.settle(settlementText)).toEqual({ status: "settled", receipt });
    if (priorConflict)
      expect(await f.repository.settle(conflictInput(conflictCases[0]))).toEqual({
        status: "settled",
        receipt: conflictReceipt(2),
      });
    expect(await f.snapshot()).toEqual(before);
    const text = newConflict ? conflictInput(conflictCases[priorConflict ? 1 : 0]) : unchangedText;
    expect(await f.repository.settle(text)).toEqual({ status: "sequence-exhausted" });
    expect(await f.snapshot()).toEqual(before);
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
    expect(f.dependencies.now).not.toHaveBeenCalled();
    expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
}

async function expectFirstAtSequenceBound(f: Awaited<ReturnType<typeof createSettlementFixture>>) {
  registerCounter(f);
  const receipt = { ...appliedReceipt, projectSequence: Number.MAX_SAFE_INTEGER };
  expect(await f.repository.settle(settlementText)).toEqual({ status: "settled", receipt });
  const rows = await f.snapshot();
  expect(rows["project_state"]).toEqual([
    [receipt.projectId, Number.MAX_SAFE_INTEGER, 1, settlementT0, settlementT1],
  ]);
  expect(rows["command_receipts"]?.map((row) => row[7])).toEqual([Number.MAX_SAFE_INTEGER]);
  expect(rows["canonical_events"]?.map((row) => row[4])).toEqual([
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  ]);
}

export async function expectAdmissionRejection(entry: (typeof admissionCases)[number]) {
  const f = await createSettlementFixture();
  try {
    registerCounter(f, () => {
      throw new Error("Invalid admission ran its handler.");
    });
    const text = snapshotCanonicalCommand(settlementRequest.projectId, {
      ...settlementRequest.command,
      type: entry.type,
      version: entry.version,
      payload: entry.payload,
    });
    const receipt = {
      ...appliedReceipt,
      commandType: entry.type,
      commandVersion: entry.version,
      outcome: "rejected" as const,
      events: [],
      rejection: { code: entry.code, retryable: false },
    };
    const before = await f.snapshot();
    expect(await f.repository.settle(text)).toEqual({ status: "settled", receipt });
    const h = (literal: string) => createHash("sha256").update(literal).digest("hex");
    expect(await f.snapshot()).toEqual({
      ...before,
      project_state: [[receipt.projectId, 1, 1, settlementT0, settlementT1]],
      command_receipts: [expectedReceiptRow(receipt, h(entry.literal))],
      command_idempotency: [
        [receipt.projectId, receipt.commandId, h(entry.literal), receipt.receiptId, settlementT1],
      ],
      command_rejections: [expectedRejectionRow(receipt, receipt.rejection)],
    });
    expect(f.dependencies.registry.prepare).toHaveBeenCalledTimes(1);
    expect(f.dependencies.now).toHaveBeenCalledTimes(1);
    expect(f.dependencies.createReceiptId).toHaveBeenCalledTimes(1);
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
    expect(f.calls.some((sql) => /SAVEPOINT|UPDATE conformance_counter/.test(sql))).toBe(false);
    await expectAdmissionRetry(f, text, receipt, entry);
    await expectAdmissionCorrection(f);
  } finally {
    await f.close();
  }
}

async function expectAdmissionRetry(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  text: string,
  receipt: unknown,
  entry: (typeof admissionCases)[number],
) {
  const installed = createCanonicalCommandRegistry([
    { ...createConformanceCounterCommand(), type: entry.type, version: entry.version },
  ]);
  for (const registry of [installed, createCanonicalCommandRegistry([])]) {
    forbidReplayWork(f);
    f.dependencies.registry.prepare.mockImplementation((command) => registry.prepare(command));
    const before = await f.snapshot();
    expect(await f.repository.settle(text)).toEqual({ status: "settled", receipt });
    expect(await f.snapshot()).toEqual(before);
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
    expect(f.dependencies.now).not.toHaveBeenCalled();
    expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  }
}

const correctedAppliedReceipt = {
  ...appliedReceipt,
  receiptId: "66666666-6666-4666-8666-666666666503",
  commandId: "44444444-4444-4444-8444-444444444502",
  projectSequence: 3,
  settledAt: "2026-09-05T12:00:03.000Z",
};

async function expectAdmissionCorrection(f: Awaited<ReturnType<typeof createSettlementFixture>>) {
  const literal =
    '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';
  const text = snapshotCanonicalCommand(settlementRequest.projectId, {
    ...settlementRequest.command,
    payload: { value: 7 },
  });
  const receipt = conflictReceipt(2);
  f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
  f.dependencies.now.mockReturnValue(receipt.settledAt);
  const before = await f.snapshot();
  expect(await f.repository.settle(text)).toEqual({ status: "settled", receipt });
  expectConflictRows(before, await f.snapshot(), receipt, literal);
  registerCounter(f);
  const applied = correctedAppliedReceipt;
  f.dependencies.createReceiptId.mockReturnValue(applied.receiptId);
  f.dependencies.now.mockReturnValue(applied.settledAt);
  f.dependencies.createEventId
    .mockReturnValueOnce(appliedReceipt.events[0].eventId)
    .mockReturnValueOnce(appliedReceipt.events[1].eventId);
  const afterConflict = await f.snapshot();
  expect(await f.repository.settle(unchangedText)).toEqual({ status: "settled", receipt: applied });
  expectCorrectedRows(afterConflict, await f.snapshot(), applied);
}

export function conflictInput(entry: (typeof conflictCases)[number]) {
  return snapshotCanonicalCommand(settlementRequest.projectId, {
    ...settlementRequest.command,
    type: entry.type,
    version: entry.version,
    payload: { ...entry.payload, tags: [...entry.payload.tags] },
  });
}

export function conflictReceipt(
  sequence: number,
  type = "conformance.counter.set",
  version = 1,
  writerGeneration = 1,
) {
  return {
    ...appliedReceipt,
    receiptId: `66666666-6666-4666-8666-66666666650${sequence}`,
    commandType: type,
    commandVersion: version,
    writerGeneration,
    outcome: "rejected" as const,
    projectSequence: sequence,
    settledAt: `2026-09-05T12:00:0${sequence}.000Z`,
    events: [],
    rejection: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
  };
}

export function expectConflictRows(
  before: Awaited<ReturnType<typeof settlementRows>>,
  after: Awaited<ReturnType<typeof settlementRows>>,
  receipt: ReturnType<typeof conflictReceipt>,
  literal: string,
) {
  const h = (text: string) => createHash("sha256").update(text).digest("hex");
  const r = receipt;
  expect(after).toEqual({
    ...before,
    project_state: [
      [r.projectId, r.projectSequence, r.writerGeneration, settlementT0, r.settledAt],
    ],
    command_receipts: [...(before["command_receipts"] ?? []), expectedReceiptRow(r, h(literal))],
    command_rejections: [
      ...(before["command_rejections"] ?? []),
      expectedRejectionRow(r, { code: "IDEMPOTENCY_CONFLICT", retryable: false }),
    ],
  });
}

export async function expectFirstConflict(entry: (typeof conflictCases)[number]) {
  const f = await createSettlementFixture();
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    expectAppliedRows(await f.snapshot());
    forbidReplayWork(f);
    const receipt = conflictReceipt(2, entry.type, entry.version);
    f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
    f.dependencies.now.mockReturnValue(receipt.settledAt);
    const before = await f.snapshot();
    expect(await f.repository.settle(conflictInput(entry))).toEqual({ status: "settled", receipt });
    expectConflictRows(before, await f.snapshot(), receipt, entry.literal);
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
    expect(f.dependencies.now).toHaveBeenCalledTimes(1);
    expect(f.dependencies.createReceiptId).toHaveBeenCalledTimes(1);
  } finally {
    await f.close();
  }
}

export async function expectRawConflictDistinction(kind: "default" | "transform") {
  const f = await createSettlementFixture();
  try {
    const registry = createCanonicalCommandRegistry([
      createConformanceCounterCommand(undefined, (payload) =>
        kind === "default" ? { ...payload, tags: payload.tags ?? [] } : { ...payload, value: 7 },
      ),
    ]);
    f.dependencies.registry.prepare.mockImplementation((command) => registry.prepare(command));
    const original = snapshotCanonicalCommand(settlementRequest.projectId, {
      ...settlementRequest.command,
      payload: { value: 7 },
    });
    expect(await f.repository.settle(original)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    const originalLiteral =
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';
    const before = await f.snapshot();
    const fingerprint = createHash("sha256").update(originalLiteral).digest("hex");
    expect(before["command_receipts"]).toEqual([
      [
        appliedReceipt.projectId,
        appliedReceipt.receiptId,
        appliedReceipt.commandId,
        "conformance.counter.set",
        1,
        fingerprint,
        "applied",
        1,
        1,
        settlementT1,
      ],
    ]);
    expect(before["command_idempotency"]).toEqual([
      [
        appliedReceipt.projectId,
        appliedReceipt.commandId,
        fingerprint,
        appliedReceipt.receiptId,
        settlementT1,
      ],
    ]);
    const receipt = conflictReceipt(2);
    forbidReplayWork(f);
    f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
    f.dependencies.now.mockReturnValue(receipt.settledAt);
    const payload = kind === "default" ? { value: 7, tags: [] } : { value: 8 };
    const text = snapshotCanonicalCommand(settlementRequest.projectId, {
      ...settlementRequest.command,
      payload,
    });
    const literal =
      kind === "default"
        ? '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"tags":[],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}'
        : '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":8},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';
    expect(await f.repository.settle(text)).toEqual({ status: "settled", receipt });
    expectConflictRows(before, await f.snapshot(), receipt, literal);
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
}

export async function prepareConflict(f: Awaited<ReturnType<typeof createSettlementFixture>>) {
  registerCounter(f);
  expect(await f.repository.settle(settlementText)).toEqual({
    status: "settled",
    receipt: appliedReceipt,
  });
  expectAppliedRows(await f.snapshot());
  forbidReplayWork(f);
  const receipt = conflictReceipt(2);
  f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
  f.dependencies.now.mockReturnValue(receipt.settledAt);
  const before = await f.snapshot();
  expect(await f.repository.settle(conflictInput(conflictCases[0]))).toEqual({
    status: "settled",
    receipt,
  });
  expectConflictRows(before, await f.snapshot(), receipt, conflictCases[0].literal);
  return receipt;
}

export async function expectOriginalChildrenBeforeConflict(target: "events" | "rejections") {
  const f = await createSettlementFixture();
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    corruptReplayResult(f, target, {}, "duplicate alias");
    await expectBrokenReplay(f, conflictInput(conflictCases[2]));
  } finally {
    await f.close();
  }
}

export async function expectConflictHistory() {
  const f = await createSettlementFixture();
  try {
    await prepareConflict(f);
    const receipts = [appliedReceipt, conflictReceipt(2)];
    for (const [index, entry] of conflictCases.entries()) {
      if (index === 0) continue;
      const receipt = conflictReceipt(index + 2, entry.type, entry.version);
      f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
      f.dependencies.now.mockReturnValue(receipt.settledAt);
      const before = await f.snapshot();
      expect(await f.repository.settle(conflictInput(entry))).toEqual({
        status: "settled",
        receipt,
      });
      expectConflictRows(before, await f.snapshot(), receipt, entry.literal);
      receipts.push(receipt);
    }
    forbidReplayWork(f);
    const texts = [settlementText, ...conflictCases.map(conflictInput)];
    const before = await f.snapshot();
    for (const [index, text] of texts.entries())
      expect(await f.repository.settle(text)).toEqual({
        status: "settled",
        receipt: receipts[index],
      });
    expect(await f.snapshot()).toEqual(before);
    await f.repository.releaseFence("2026-09-05T12:00:04.000Z");
    await f.close();
    const empty = createCanonicalCommandRegistry([]);
    f.dependencies.registry.prepare.mockImplementation((command) => empty.prepare(command));
    const repository = await activateReplayRepository(f);
    try {
      const reactivated = await f.snapshot();
      for (const [index, text] of texts.entries())
        expect(await repository.settle(text)).toEqual({
          status: "settled",
          receipt: receipts[index],
        });
      expect(await f.snapshot()).toEqual(reactivated);
      expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
      const receipt = { ...conflictReceipt(6), writerGeneration: 2 };
      f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
      f.dependencies.now.mockReturnValue(receipt.settledAt);
      const text = snapshotCanonicalCommand(settlementRequest.projectId, {
        ...settlementRequest.command,
        payload: { value: 9 },
      });
      expect(await repository.settle(text)).toEqual({ status: "settled", receipt });
      expectConflictRows(
        reactivated,
        await f.snapshot(),
        receipt,
        '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":9},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
      );
    } finally {
      await repository.close();
    }
  } finally {
    await f.close();
  }
}

export async function expectCorruptedConflict(
  target: Parameters<typeof corruptReplayResult>[1],
  changes: Record<string, string | number | null>,
) {
  const f = await createSettlementFixture();
  try {
    await prepareConflict(f);
    corruptReplayResult(f, target, changes);
    await expectBrokenReplay(f, conflictInput(conflictCases[0]));
  } finally {
    await f.close();
  }
}

export const unchangedText = snapshotCanonicalCommand(settlementRequest.projectId, {
  commandId: CommandIdSchema.parse("44444444-4444-4444-8444-444444444502"),
  type: "conformance.counter.set",
  version: 1,
  payload: { value: 7 },
});
export const unchangedReceipt = {
  ...appliedReceipt,
  receiptId: "66666666-6666-4666-8666-666666666502",
  commandId: "44444444-4444-4444-8444-444444444502",
  outcome: "unchanged",
  projectSequence: 2,
  settledAt: "2026-09-05T12:00:02.000Z",
  events: [],
} as const;

export const rejectedText = snapshotCanonicalCommand(settlementRequest.projectId, {
  commandId: CommandIdSchema.parse("44444444-4444-4444-8444-444444444503"),
  type: "conformance.counter.set",
  version: 1,
  payload: { value: 9 },
});

export function rejectedReceipt(retryable: boolean) {
  return {
    ...unchangedReceipt,
    receiptId: "66666666-6666-4666-8666-666666666503",
    commandId: "44444444-4444-4444-8444-444444444503",
    projectSequence: 3,
    settledAt: "2026-09-05T12:00:03.000Z",
    outcome: "rejected" as const,
    rejection: { code: retryable ? "TEST_COUNTER_RETRYABLE" : "TEST_COUNTER_REJECTED", retryable },
  };
}

export const interleavedSequenceCases = [
  { text: settlementText, receipt: appliedReceipt },
  { text: unchangedText, receipt: unchangedReceipt },
  { text: rejectedText, receipt: rejectedReceipt(false) },
  { text: conflictInput(conflictCases[0]), receipt: conflictReceipt(4) },
];

export async function prepareRejected(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  retryable = false,
) {
  await prepareUnchanged(f);
  const before = await f.snapshot();
  expect(await f.repository.settle(unchangedText)).toEqual({
    status: "settled",
    receipt: unchangedReceipt,
  });
  expectUnchangedRows(before, await f.snapshot());
  const receipt = rejectedReceipt(retryable);
  f.dependencies.createReceiptId.mockReturnValue(receipt.receiptId);
  f.dependencies.now.mockReturnValue(receipt.settledAt);
  registerCounter(f, async (context) => {
    await writeCounter99(context);
    return { outcome: "rejected", rejection: receipt.rejection };
  });
  f.calls.length = 0;
  return receipt;
}

export function expectRejectedRows(
  before: Awaited<ReturnType<typeof settlementRows>>,
  after: Awaited<ReturnType<typeof settlementRows>>,
  retryable: boolean,
) {
  const h = (text: string) => createHash("sha256").update(text).digest("hex");
  const fingerprint = h(
    '{"commandId":"44444444-4444-4444-8444-444444444503","fingerprintVersion":1,"payload":{"value":9},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
  );
  const r = rejectedReceipt(retryable);
  expect(after).toEqual({
    ...before,
    project_state: [[r.projectId, 3, 1, settlementT0, r.settledAt]],
    command_receipts: [...(before["command_receipts"] ?? []), expectedReceiptRow(r, fingerprint)],
    command_idempotency: [
      ...(before["command_idempotency"] ?? []),
      [r.projectId, r.commandId, fingerprint, r.receiptId, r.settledAt],
    ],
    command_rejections: [expectedRejectionRow(r, r.rejection)],
  });
}

export async function expectRejectedReplay(retryable: boolean, replacement: boolean) {
  const f = await createSettlementFixture();
  try {
    const receipt = await prepareRejected(f, retryable);
    const before = await f.snapshot();
    expect(await f.repository.settle(rejectedText)).toEqual({ status: "settled", receipt });
    expectRejectedRows(before, await f.snapshot(), retryable);
    await expectReceiptReplay(f, rejectedText, receipt, replacement);
  } finally {
    await f.close();
  }
}

export async function expectCorruptedRejectedReplay(
  changes: Record<string, string | number | null>,
  shape = "fields",
) {
  const f = await createSettlementFixture();
  try {
    const receipt = await prepareRejected(f);
    const before = await f.snapshot();
    expect(await f.repository.settle(rejectedText)).toEqual({ status: "settled", receipt });
    expectRejectedRows(before, await f.snapshot(), false);
    corruptReplayResult(f, "rejections", changes, shape);
    await expectBrokenReplay(f, rejectedText);
  } finally {
    await f.close();
  }
}

export async function expectFirstRejected(retryable: boolean) {
  const f = await createSettlementFixture();
  try {
    const receipt = await prepareRejected(f, retryable);
    const before = await f.snapshot();
    expect(await f.repository.settle(rejectedText)).toEqual({ status: "settled", receipt });
    expectRejectedRows(before, await f.snapshot(), retryable);
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
    expect(f.calls.indexOf("ROLLBACK TO canonical_command_handler")).toBeGreaterThan(0);
    expect(f.calls.indexOf("RELEASE canonical_command_handler")).toBeGreaterThan(
      f.calls.indexOf("ROLLBACK TO canonical_command_handler"),
    );
  } finally {
    await f.close();
  }
}

export async function expectRejectedEventExclusion() {
  const f = await createSettlementFixture();
  try {
    const receipt = await prepareRejected(f);
    expect(await f.repository.settle(rejectedText)).toEqual({ status: "settled", receipt });
    let events: LocalLibsqlResultSet | undefined;
    f.observation.after = (sql, result) => {
      if (sql.includes("FROM canonical_events")) events = result;
      return result;
    };
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    expect(events?.rows.length).toBe(2);
    f.observation.after = (sql, result) =>
      sql.includes("FROM canonical_events") && events !== undefined ? events : result;
    await expectBrokenReplay(f, rejectedText);
  } finally {
    await f.close();
  }
}

export async function expectPersistedRejectionCorruption(mode: "hash" | "details") {
  const f = await createSettlementFixture();
  try {
    const receipt = await prepareRejected(f);
    expect(await f.repository.settle(rejectedText)).toEqual({ status: "settled", receipt });
    if (mode === "hash")
      await f.raw.execute("UPDATE command_rejections SET details_hash=?", ["a".repeat(64)]);
    else
      await f.raw.execute("UPDATE command_rejections SET details_json=?, details_hash=?", [
        '{"version":2}',
        createHash("sha256").update('{"version":2}').digest("hex"),
      ]);
    await expectBrokenReplay(f, rejectedText);
  } finally {
    await f.close();
  }
}

export async function expectRejectedOutputRetention() {
  const f = await createSettlementFixture();
  const held = settlementBarrier();
  const release = settlementBarrier();
  const retained: { transaction?: CounterContext["transaction"] } = {};
  try {
    const receipt = await prepareRejected(f);
    const before = await f.snapshot();
    const rejection = { ...receipt.rejection };
    registerCounter(f, async (context) => {
      retained.transaction = context.transaction;
      await writeCounter99(context);
      return { outcome: "rejected", rejection };
    });
    f.observation.before = async (sql) => {
      if (sql === "RELEASE canonical_command_handler") {
        held.release();
        await release.promise;
      }
    };
    const pending = f.repository.settle(rejectedText);
    await held.promise;
    rejection.code = "PRIVATE_CHANGED";
    rejection.retryable = true;
    Reflect.set(rejection, "details", "private handler data");
    if (retained.transaction === undefined) throw new Error("Handler did not retain its facade.");
    const capability = retained.transaction;
    const calls = [...f.calls];
    expect(() => capability.execute("SELECT 99")).toThrow(
      "Canonical command transaction capability is revoked.",
    );
    expect(f.calls).toEqual(calls);
    release.release();
    expect(await pending).toEqual({ status: "settled", receipt });
    expectRejectedRows(before, await f.snapshot(), false);
    const settledCalls = [...f.calls];
    expect(() => capability.execute("SELECT 99")).toThrow(
      "Canonical command transaction capability is revoked.",
    );
    expect(f.calls).toEqual(settledCalls);
    await expectReceiptReplay(f, rejectedText, receipt, false);
    expect(() => capability.execute("SELECT 99")).toThrow(
      "Canonical command transaction capability is revoked.",
    );
  } finally {
    release.release();
    await f.close();
  }
}

export async function expectRejectionInsertFault(mode: "throw" | 0 | 2) {
  const f = await createSettlementFixture();
  try {
    await prepareRejected(f);
    const before = await f.snapshot();
    const fault = new Error("G8 rejection INSERT fault");
    let inserted = false;
    f.observation.after = (sql, result) => {
      if (!sql.startsWith("INSERT INTO command_rejections")) return result;
      inserted = true;
      if (mode === "throw") throw fault;
      return { ...result, rowsAffected: mode };
    };
    const error = await f.repository.settle(rejectedText).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    if (mode === "throw") expect(error).toBe(fault);
    expect(inserted).toBe(true);
    expect(await f.snapshot()).toEqual(before);
    expect(f.calls.slice(-2)).toEqual(["rollback", "close"]);
  } finally {
    await f.close();
  }
}

export async function prepareUnchanged(f: Awaited<ReturnType<typeof createSettlementFixture>>) {
  registerCounter(f);
  expect(await f.repository.settle(settlementText)).toEqual({
    status: "settled",
    receipt: appliedReceipt,
  });
  expectAppliedRows(await f.snapshot());
  f.dependencies.createReceiptId.mockReturnValue(unchangedReceipt.receiptId);
  f.dependencies.now.mockReturnValue(unchangedReceipt.settledAt);
  f.dependencies.createEventId.mockClear();
  f.calls.length = 0;
}

export function expectUnchangedRows(
  before: Awaited<ReturnType<typeof settlementRows>>,
  after: Awaited<ReturnType<typeof settlementRows>>,
) {
  const fingerprint = createHash("sha256")
    .update(
      '{"commandId":"44444444-4444-4444-8444-444444444502","fingerprintVersion":1,"payload":{"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
    )
    .digest("hex");
  const r = unchangedReceipt;
  expect(after).toEqual({
    ...before,
    project_state: [[r.projectId, 2, 1, settlementT0, r.settledAt]],
    command_receipts: [...(before["command_receipts"] ?? []), expectedReceiptRow(r, fingerprint)],
    command_idempotency: [
      ...(before["command_idempotency"] ?? []),
      [r.projectId, r.commandId, fingerprint, r.receiptId, r.settledAt],
    ],
  });
}

function expectedFingerprint(projectId: string) {
  const hash = (literal: string) => createHash("sha256").update(literal).digest("hex");
  expect([canonicalCommandProjectId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"]).toContain(projectId);
  return hash(
    projectId === canonicalCommandProjectId
      ? '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}'
      : '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2","type":"conformance.counter.set","version":1}',
  );
}

export function expectAppliedRows(
  rows: Awaited<ReturnType<typeof settlementRows>>,
  eventCount = 2,
  settledAt = settlementT1,
  projectId = canonicalCommandProjectId,
) {
  const receiptId = appliedReceipt.receiptId;
  const hash = (literal: string) => createHash("sha256").update(literal).digest("hex");
  const fingerprint = expectedFingerprint(projectId);
  expect(rows["conformance_counter"]).toEqual([[projectId, canonicalCommandAggregateId, 7, 2]]);
  expect(rows["project_state"]).toEqual([[projectId, 1, 1, settlementT0, settledAt]]);
  expect(rows["command_receipts"]).toEqual([
    expectedReceiptRow({ ...appliedReceipt, projectId, settledAt }, fingerprint),
  ]);
  expect(rows["command_idempotency"]).toEqual([
    [projectId, appliedReceipt.commandId, fingerprint, receiptId, settledAt],
  ]);
  expect(rows["command_rejections"]).toEqual([]);
  expect(rows["canonical_events"]).toEqual(
    [
      [
        projectId,
        appliedReceipt.events[0].eventId,
        receiptId,
        "applied",
        1,
        0,
        "conformance.counter",
        canonicalCommandAggregateId,
        2,
        "conformance.counter.changed",
        1,
        '{"previous":0,"value":7}',
        hash('{"previous":0,"value":7}'),
        settledAt,
      ],
      [
        projectId,
        appliedReceipt.events[1].eventId,
        receiptId,
        "applied",
        1,
        1,
        "conformance.counter",
        canonicalCommandAggregateId,
        2,
        "conformance.counter.checked",
        1,
        '{"value":7}',
        hash('{"value":7}'),
        settledAt,
      ],
    ].slice(0, eventCount),
  );
  expect(rows["foreign_keys"]).toEqual([]);
}

export async function createSettlementFixture(handoffId = "88888888-8888-4888-8888-888888888501") {
  const file = await createCanonicalCommandDatabase();
  const raw = createWorkerLocalLibsqlClient(file, "generation");
  const observation: SettlementObservation = {};
  const calls: string[] = [];
  let event = 500;
  const dependencies = {
    sha256Text: vi.fn(async (text: string) => createHash("sha256").update(text).digest("hex")),
    createRecoveryRecordId: vi.fn(() => "99999999-9999-4999-8999-999999999501"),
    registry: {
      prepare: vi.fn<CanonicalSettlementDependencies["registry"]["prepare"]>(() => {
        throw authorityPassed;
      }),
    },
    createReceiptId: vi.fn(() => "66666666-6666-4666-8666-666666666501"),
    createEventId: vi.fn(() => `77777777-7777-4777-8777-777777777${++event}`),
    now: vi.fn(() => settlementT1),
  };
  const factory = createCanonicalCommandRepositoryFactory({
    ...dependencies,
    openClient: () => observedSettlementClient(raw, observation, calls),
    createHandoffId: () => handoffId,
  });
  const activated = await factory.activate({
    canonicalDatabasePath: file,
    projectId: settlementRequest.projectId,
    activationId: settlementRequest.activationId,
    writerToken: WriterCapabilityTokenSchema.parse("1".repeat(64)),
    activatedAt: settlementT0,
  });
  if (activated.status !== "activated") {
    await raw.close();
    throw activated.error;
  }
  calls.length = 0;
  return {
    file,
    raw,
    observation,
    calls,
    dependencies,
    repository: activated.repository,
    snapshot: () => settlementRows(file),
    close: () => activated.repository.close(),
  };
}

export function alterFence(
  result: LocalLibsqlResultSet,
  changes: Record<string, string | number | null>,
): LocalLibsqlResultSet {
  return {
    ...result,
    rows: result.rows.map((row) =>
      result.columns.map((column, index) =>
        Object.hasOwn(changes, column) ? (changes[column] ?? null) : (row[index] ?? null),
      ),
    ),
  };
}

export function registerCounter(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  handle?: (
    context: CounterContext,
  ) => CanonicalCommandDecision | Promise<CanonicalCommandDecision>,
) {
  const registry = createCanonicalCommandRegistry([createConformanceCounterCommand(handle)]);
  f.dependencies.registry.prepare.mockImplementation((command) => registry.prepare(command));
}

export function forbidReplayWork(f: Awaited<ReturnType<typeof createSettlementFixture>>) {
  const forbidden = () => {
    throw new Error("Replay allocated or prepared a command.");
  };
  f.dependencies.registry.prepare.mockClear().mockImplementation(forbidden);
  f.dependencies.createReceiptId.mockClear().mockImplementation(forbidden);
  f.dependencies.createEventId.mockClear().mockImplementation(forbidden);
  f.dependencies.now.mockClear().mockImplementation(forbidden);
}

export async function expectReceiptReplay(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  text: string,
  receipt: CanonicalCommandReceipt | typeof unchangedReceipt | ReturnType<typeof rejectedReceipt>,
  replacement: boolean,
) {
  forbidReplayWork(f);
  if (replacement) {
    await f.repository.releaseFence("2026-09-05T12:00:04.000Z");
    await f.close();
  }
  const repository = replacement ? await activateReplayRepository(f) : f.repository;
  try {
    const before = await f.snapshot();
    expect(await repository.settle(text)).toEqual({ status: "settled", receipt });
    expect(await f.snapshot()).toEqual(before);
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
    expect(f.dependencies.now).not.toHaveBeenCalled();
    expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  } finally {
    await repository.close();
  }
}

export async function expectUnchangedDrain() {
  const f = await createSettlementFixture();
  const issued = settlementBarrier();
  const returned = settlementBarrier();
  const release = settlementBarrier();
  try {
    await prepareUnchanged(f);
    const before = await f.snapshot();
    f.observation.after = async (sql, result) => {
      if (sql.startsWith("UPDATE conformance_counter")) {
        issued.release();
        await release.promise;
      }
      return result;
    };
    registerCounter(f, (context) => {
      void writeCounter99(context);
      returned.release();
      return { outcome: "unchanged" };
    });
    const pending = f.repository.settle(unchangedText);
    await issued.promise;
    await returned.promise;
    const held = [...f.calls];
    await expect(f.repository.releaseFence("2026-09-05T12:00:04.000Z")).rejects.toThrow();
    expect(f.calls).toEqual(held);
    expect(
      f.calls.some((sql) =>
        /ROLLBACK TO|RELEASE|INSERT INTO|UPDATE project_state|commit|rollback|close/.test(sql),
      ),
    ).toBe(false);
    release.release();
    expect(await pending).toEqual({ status: "settled", receipt: unchangedReceipt });
    expectUnchangedRows(before, await f.snapshot());
  } finally {
    release.release();
    await f.close();
  }
}

export async function activateReplayRepository(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  projectId = settlementRequest.projectId,
) {
  const factory = createCanonicalCommandRepositoryFactory({
    ...f.dependencies,
    openClient: (file) => createWorkerLocalLibsqlClient(file, "generation"),
    sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
    createHandoffId: () => "88888888-8888-4888-8888-888888888502",
    createRecoveryRecordId: () => "99999999-9999-4999-8999-999999999502",
  });
  const activated = await factory.activate({
    canonicalDatabasePath: f.file,
    projectId,
    activationId: ProjectActivationIdSchema.parse(
      projectId === settlementRequest.projectId
        ? "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
        : "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    ),
    writerToken: WriterCapabilityTokenSchema.parse("2".repeat(64)),
    activatedAt: "2026-09-05T12:00:05.000Z",
  });
  if (activated.status !== "activated") throw activated.error;
  return activated.repository;
}

export function corruptReplayResult(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  target: "pointer" | "original" | "requested" | "count" | "events" | "rejections",
  changes: Record<string, string | number | null>,
  shape = "fields",
) {
  const fragments = {
    pointer: "FROM command_idempotency",
    original: "receipt_id=?",
    requested: "command_fingerprint=?",
    count: "COUNT(*) AS receiptCount",
    events: "FROM canonical_events",
    rejections: "FROM command_rejections",
  };
  f.observation.after = (sql, result) => {
    if (!sql.includes(fragments[target])) return result;
    if (["original", "requested"].includes(target) && !sql.includes("FROM command_receipts"))
      return result;
    return replayResultShape(result, changes, shape);
  };
}

function replayResultShape(
  result: LocalLibsqlResultSet,
  changes: Record<string, string | number | null>,
  shape: string,
): LocalLibsqlResultSet {
  if (shape === "absent") return { ...result, rows: [] };
  if (shape === "duplicate") return { ...result, rows: [...result.rows, ...result.rows] };
  if (shape === "duplicate alias")
    return {
      ...result,
      columns: [...result.columns, result.columns[0] ?? "duplicate"],
      rows: result.rows.map((row) => [...row, row[0] ?? null]),
    };
  if (shape === "row width") return { ...result, rows: result.rows.map((row) => [...row, null]) };
  if (shape === "extra alias")
    return {
      ...result,
      columns: [...result.columns, "private"],
      rows: result.rows.map((row) => [...row, "secret"]),
    };
  return alterFence(result, changes);
}

export async function expectCorruptedAppliedReplay(
  target: Parameters<typeof corruptReplayResult>[1],
  changes: Record<string, string | number | null>,
  shape?: string,
) {
  const f = await createSettlementFixture();
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    expectAppliedRows(await f.snapshot());
    corruptReplayResult(f, target, changes, shape);
    await expectBrokenReplay(f);
  } finally {
    await f.close();
  }
}

export function expectOtherProjectRows(
  before: Awaited<ReturnType<typeof settlementRows>>,
  after: Awaited<ReturnType<typeof settlementRows>>,
) {
  const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
  const otherRows = Object.fromEntries(
    Object.entries(after).map(([table, rows]) => [
      table,
      table === "foreign_keys" ? rows : rows.filter((row) => row[0] === other),
    ]),
  );
  expectAppliedRows(otherRows, 2, settlementT1, other);
  const changed = [
    "conformance_counter",
    "project_state",
    "command_receipts",
    "command_idempotency",
    "canonical_events",
  ];
  expect(after).toEqual({
    ...before,
    ...Object.fromEntries(
      changed.map((table) => [
        table,
        [...(before[table] ?? []).filter((row) => row[0] !== other), ...(otherRows[table] ?? [])],
      ]),
    ),
  });
}

export async function expectBrokenReplay(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  commandText = settlementText,
) {
  const before = await f.snapshot();
  forbidReplayWork(f);
  const error = await f.repository.settle(commandText).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(Error);
  expect(error instanceof Error && error.message.includes("not implemented")).toBe(false);
  expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
  expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
  expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  expect(f.dependencies.now).not.toHaveBeenCalled();
  expect(await f.snapshot()).toEqual(before);
}

export async function expectForbiddenUnchangedChild(target: "events" | "rejections") {
  const f = await createSettlementFixture();
  try {
    await prepareUnchanged(f);
    expect(await f.repository.settle(unchangedText)).toEqual({
      status: "settled",
      receipt: unchangedReceipt,
    });
    f.observation.after = (sql, result) =>
      sql.includes(`FROM ${target === "events" ? "canonical_events" : "command_rejections"}`)
        ? { ...result, rows: [result.columns.map(() => null)] }
        : result;
    await expectBrokenReplay(f, unchangedText);
  } finally {
    await f.close();
  }
}

export async function knownBodyFailure(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  expected?: Error,
) {
  const before = await f.snapshot();
  const error = await f.repository.settle(settlementText).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toEqual(new Error("Canonical command settlement is not implemented."));
  expect(error instanceof Error && error.message.includes("not implemented")).toBe(false);
  if (expected !== undefined) expect(error).toBe(expected);
  expect(await f.snapshot()).toEqual(before);
  return error;
}

export function settlementBarrier() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export function failSettlementSqlAt(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  stage: string,
  error: Error,
) {
  const fragments: Record<string, string> = {
    "state read": "FROM project_state",
    "pointer read": "FROM command_idempotency",
    "first event": "INSERT INTO canonical_events",
    "second event": "INSERT INTO canonical_events",
  };
  const fragment = fragments[stage] ?? stage;
  const target = stage === "second event" ? 2 : 1;
  let occurrence = 0;
  f.observation.after = (sql, result) => {
    if (sql.includes(fragment) && ++occurrence === target) throw error;
    return result;
  };
}

export function observeIssuedSqlFailure(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  fault: string,
  error: Error,
) {
  f.observation.synchronous = (sql) => {
    if (fault === "synchronous" && sql === "SELECT 42") throw error;
  };
  f.observation.after = (sql, result) => {
    if (sql === "SELECT 42") throw error;
    return result;
  };
}
