import { createHash } from "node:crypto";
import { ProjectIdSchema } from "@slopstop/protocol";
import { assert, expect, it } from "vitest";
import {
  type CanonicalCommandDecision,
  type CanonicalCommandTransaction,
  createCanonicalCommandRegistry,
} from "../../src/canonical-command-registry.js";
import { snapshotCanonicalCommand } from "../../src/canonical-json.js";
import {
  activateReplayRepository,
  alterFence,
  appliedReceipt,
  authorityPassed,
  corruptReplayResult,
  createSettlementFixture,
  expectAdmissionRejection,
  expectAppliedRows,
  expectBrokenReplay,
  expectConflictHistory,
  expectCorruptedAppliedReplay,
  expectCorruptedConflict,
  expectCorruptedRejectedReplay,
  expectFirstConflict,
  expectFirstRejected,
  expectForbiddenUnchangedChild,
  expectMalformedSequenceState,
  expectOriginalChildrenBeforeConflict,
  expectOtherProjectRows,
  expectPersistedRejectionCorruption,
  expectRawConflictDistinction,
  expectReceiptReplay,
  expectRejectedEventExclusion,
  expectRejectedOutputRetention,
  expectRejectedReplay,
  expectRejectionInsertFault,
  expectSequenceBound,
  expectUnchangedDrain,
  expectUnchangedRows,
  failSettlementSqlAt,
  forbidReplayWork,
  interleavedSequenceCases,
  knownBodyFailure,
  observeIssuedSqlFailure,
  prepareUnchanged,
  registerCounter,
  settlementBarrier,
  settlementRequest,
  settlementText,
  unchangedReceipt,
  unchangedText,
} from "./canonical-command-fixture.js";
import {
  admissionCases,
  applyCounter,
  conflictCases,
  createConformanceCounterCommand,
  expectInterleavedRows,
  issuedSqlFailureHandler,
  malformedDecision,
  malformedHandlerDecisions,
  rejectCounterNine,
  writeUnchanged,
} from "./conformance-counter-command.js";

it("allocates one safe Project sequence per first settlement and replays at the bound: G11 interleaved four outcomes", async () => {
  const f = await createSettlementFixture();
  const cases = interleavedSequenceCases;
  try {
    for (const [index, entry] of cases.entries()) {
      registerCounter(f, rejectCounterNine);
      f.dependencies.createReceiptId.mockReturnValue(entry.receipt.receiptId);
      f.dependencies.now.mockReturnValue(entry.receipt.settledAt);
      expect(await f.repository.settle(entry.text)).toEqual({
        status: "settled",
        receipt: entry.receipt,
      });
      const before = await f.snapshot();
      forbidReplayWork(f);
      for (const retry of cases.slice(0, index + 1))
        expect(await f.repository.settle(retry.text)).toEqual({
          status: "settled",
          receipt: retry.receipt,
        });
      expect(await f.snapshot()).toEqual(before);
      expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
    }
    expectInterleavedRows(await f.snapshot());
  } finally {
    await f.close();
  }
});

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "allocates one safe Project sequence per first settlement and replays at the bound: G11 MAX prior conflict %s new conflict %s",
  expectSequenceBound,
);
it.each([-1, 0.5, 9007199254740992, "1", null, "duplicate", "missing"])(
  "allocates one safe Project sequence per first settlement and replays at the bound: G11 malformed state %s",
  expectMalformedSequenceState,
);

it.each(admissionCases)(
  "durably rejects unsupported definitions and invalid handler payloads: G10 $code $type v$version",
  expectAdmissionRejection,
);

it.each(conflictCases)(
  "persists distinct conflicts without changing original command authority: G9 first $type v$version $literal",
  expectFirstConflict,
);

it(
  "persists distinct conflicts without changing original command authority: G9 replay complete history",
  expectConflictHistory,
);
it.each([
  { outcome: "applied" },
  { outcome: "unchanged" },
  { receiptId: "66666666-6666-4666-8666-666666666501" },
  { projectSequence: 1 },
  { projectSequence: 3 },
  { fingerprint: "a".repeat(64) },
  { commandType: "conformance.counter.other" },
  { commandVersion: 2 },
  { commandId: "44444444-4444-4444-8444-444444444502" },
  { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  { writerGeneration: 2, generationNumber: 2 },
  { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  { generationNumber: 2 },
])(
  "rejects corrupted replay children and conflicting receipts: G9 conflict requested %j",
  (changes) => expectCorruptedConflict("requested", changes),
);
it.each(["TEST_COUNTER_REJECTED", "COMMAND_TYPE_UNSUPPORTED", "COMMAND_PAYLOAD_INVALID"])(
  "rejects corrupted replay children and conflicting receipts: G9 conflict code %s",
  (code) => expectCorruptedConflict("rejections", { code }),
);

it.each(["default", "transform"] as const)(
  "canonicalizes submitted command content without changing its meaning: G9 raw %s",
  expectRawConflictDistinction,
);
it.each(["events", "rejections"] as const)(
  "rejects corrupted replay children and conflicting receipts: G9 original children before first conflict %s",
  expectOriginalChildrenBeforeConflict,
);

it.each([false, true])(
  "rolls back rejected handler writes and hashes safe rejection metadata: G8 first %s",
  expectFirstRejected,
);
it(
  "rejects corrupted replay children and conflicting receipts: G8 rejected events",
  expectRejectedEventExclusion,
);
it.each(["hash", "details"] as const)(
  "rejects corrupted replay children and conflicting receipts: G8 persisted %s",
  expectPersistedRejectionCorruption,
);
it(
  "revokes handler capabilities and observes swallowed or unawaited SQL failure: G8 retained rejection",
  expectRejectedOutputRetention,
);
it.each(["throw", 0, 2] as const)(
  "rolls back known settlement body faults at every mutation stage: G8 rejection INSERT %s",
  expectRejectionInsertFault,
);

it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  "replays exact receipts across repository and activation replacement: G8 retryable %s replacement %s",
  expectRejectedReplay,
);
it.each(["absent", "duplicate", "duplicate alias", "row width", "extra alias"])(
  "rejects corrupted replay children and conflicting receipts: G8 rejection shape %s",
  (shape) => expectCorruptedRejectedReplay({}, shape),
);
it.each([
  { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  { receiptId: "66666666-6666-4666-8666-666666666502" },
  { receiptOutcome: "applied" },
  { projectSequence: 2 },
  { retryable: -1 },
  { retryable: 2 },
  { retryable: 0.5 },
  { retryable: "0" },
  { retryable: null },
  { code: "" },
  { code: "lowercase" },
  { code: "A".repeat(65) },
  { code: "COMMAND_TYPE_UNSUPPORTED", retryable: 1 },
  { code: "COMMAND_PAYLOAD_INVALID", retryable: 1 },
  { code: "IDEMPOTENCY_CONFLICT", retryable: 1 },
])(
  "rejects corrupted replay children and conflicting receipts: G8 rejection fields %j",
  (changes) => expectCorruptedRejectedReplay(changes),
);
it.each([
  ["malformed", "{"],
  ["version", '{"version":2}'],
  ["private", '{"private":"secret","version":1}'],
  ["array", "[1]"],
  ["empty", "{}"],
  ["null", "null"],
  ["whitespace", '{ "version":1}'],
  ["duplicate key", '{"version":1,"version":1}'],
])(
  "rejects corrupted replay children and conflicting receipts: G8 rejection details %s",
  (_name, text) =>
    expectCorruptedRejectedReplay({
      detailsText: text,
      detailsHash: createHash("sha256").update(text).digest("hex"),
    }),
);
it.each(["a".repeat(64), "short", "A".repeat(64)])(
  "rejects corrupted replay children and conflicting receipts: G8 rejection hash %s",
  (detailsHash) => expectCorruptedRejectedReplay({ detailsHash }),
);

it.each(["equal", "writes"])(
  "rolls back unchanged handler writes and persists only settlement: G7 %s",
  async (scenario) => {
    const f = await createSettlementFixture();
    try {
      await prepareUnchanged(f);
      const before = await f.snapshot();
      registerCounter(f, scenario === "writes" ? writeUnchanged : applyCounter);
      expect(await f.repository.settle(unchangedText)).toEqual({
        status: "settled",
        receipt: unchangedReceipt,
      });
      expectUnchangedRows(before, await f.snapshot());
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      const rollback = f.calls.indexOf("ROLLBACK TO canonical_command_handler");
      expect(rollback).toBeGreaterThan(f.calls.indexOf("SAVEPOINT canonical_command_handler"));
      expect(f.calls.indexOf("RELEASE canonical_command_handler")).toBeGreaterThan(rollback);
    } finally {
      await f.close();
    }
  },
);

it.each(["ROLLBACK TO", "RELEASE"])(
  "rolls back known settlement body faults at every mutation stage: G7 %s",
  async (stage) => {
    const f = await createSettlementFixture();
    try {
      await prepareUnchanged(f);
      const before = await f.snapshot();
      registerCounter(f, writeUnchanged);
      const fault = new Error(`G7 ${stage} fault`);
      failSettlementSqlAt(f, stage, fault);
      await expect(f.repository.settle(unchangedText)).rejects.toBe(fault);
      expect(await f.snapshot()).toEqual(before);
      expect(f.calls.slice(-2)).toEqual(["rollback", "close"]);
    } finally {
      await f.close();
    }
  },
);

it(
  "revokes handler capabilities and observes swallowed or unawaited SQL failure: G7 successful UPDATE drain",
  expectUnchangedDrain,
);

it.each(["same repository", "replacement"])(
  "replays exact receipts across repository and activation replacement: G7 %s",
  async (scenario) => {
    const f = await createSettlementFixture();
    try {
      await prepareUnchanged(f);
      const applied = await f.snapshot();
      expect(await f.repository.settle(unchangedText)).toEqual({
        status: "settled",
        receipt: unchangedReceipt,
      });
      expectUnchangedRows(applied, await f.snapshot());
      await expectReceiptReplay(f, unchangedText, unchangedReceipt, scenario === "replacement");
    } finally {
      await f.close();
    }
  },
);

it.each(["events", "rejections"] as const)(
  "rejects corrupted replay children and conflicting receipts: G7 unchanged %s",
  expectForbiddenUnchangedChild,
);

it.each(["original", "reordered", "zero events"])(
  "replays exact receipts across repository and activation replacement: G6 lookup %s",
  async (scenario) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f, async (context) => {
        const decision = await applyCounter(context);
        return scenario === "zero events" ? { outcome: "applied", events: [] } : decision;
      });
      const expected = {
        ...appliedReceipt,
        events: scenario === "zero events" ? [] : appliedReceipt.events,
      };
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: expected,
      });
      expectAppliedRows(await f.snapshot(), expected.events.length);
      const before = await f.snapshot();
      forbidReplayWork(f);
      const command =
        scenario === "reordered"
          ? snapshotCanonicalCommand(settlementRequest.projectId, {
              ...settlementRequest.command,
              payload: { tags: ["x", "y"], meta: { a: 1, b: 2 }, value: 7 },
            })
          : settlementText;
      const result = await f.repository.settle(command);
      expect(result).toEqual({ status: "settled", receipt: expected });
      assert(result.status === "settled");
      expect(Object.isFrozen(result.receipt)).toBe(true);
      expect(Object.isFrozen(result.receipt.events)).toBe(true);
      for (const event of result.receipt.events) expect(Object.isFrozen(event)).toBe(true);
      expectNoSettlementWork(f);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);

function expectNoSettlementWork(f: Awaited<ReturnType<typeof createSettlementFixture>>): void {
  expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
  expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
  expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  expect(f.dependencies.now).not.toHaveBeenCalled();
}

function expectFenceFirst(f: Awaited<ReturnType<typeof createSettlementFixture>>): void {
  expect(f.calls.slice(0, 2)).toEqual([
    "begin:write",
    expect.stringContaining("FROM writer_fence"),
  ]);
}

const originalAuthorityCases: ReadonlyArray<
  readonly [
    string,
    "pointer" | "original" | "count",
    Record<string, string | number | null>,
    string?,
  ]
> = [
  ["orphan receipt", "pointer", {}, "absent"],
  ["duplicate pointer", "pointer", {}, "duplicate"],
  ["pointer alias", "pointer", {}, "duplicate alias"],
  ["pointer width", "pointer", {}, "row width"],
  ["pointer extra", "pointer", {}, "extra alias"],
  ["absent original", "original", {}, "absent"],
  ["duplicate original", "original", {}, "duplicate"],
  ["original alias", "original", {}, "duplicate alias"],
  ["original width", "original", {}, "row width"],
  ["original extra", "original", {}, "extra alias"],
  ["pointer absent receipt ID", "pointer", { receiptId: "66666666-6666-4666-8666-666666666506" }],
  ["pointer fingerprint mismatch", "pointer", { fingerprint: "a".repeat(64) }],
  ["pointer fingerprint malformed", "pointer", { fingerprint: "bad" }],
  ["pointer Project", "pointer", { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }],
  ["pointer command", "pointer", { commandId: "44444444-4444-4444-8444-444444444502" }],
  ["pointer time", "pointer", { createdAt: "2026-09-05T12:00:02.000Z" }],
  ["pointer time malformed", "pointer", { createdAt: "2026-09-05T12:00Z" }],
  ["receipt Project", "original", { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }],
  ["receipt command", "original", { commandId: "44444444-4444-4444-8444-444444444502" }],
  ["receipt identity", "original", { receiptId: "66666666-6666-4666-8666-666666666506" }],
  ["receipt fingerprint", "original", { fingerprint: "a".repeat(64) }],
  ["receipt fingerprint malformed", "original", { fingerprint: "bad" }],
  ["receipt sequence above current", "original", { projectSequence: 2 }],
  ["receipt generation above current", "original", { writerGeneration: 2, generationNumber: 2 }],
  ["receipt missing generation", "original", { generationNumber: null }],
  ["receipt wrong generation", "original", { generationNumber: 2 }],
  [
    "receipt generation other Project",
    "original",
    { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  ],
  ...[null, "1", -1, 0.5, 9007199254740992, 0].map(
    (value) => [`count ${value}`, "count", { receiptCount: value }] as const,
  ),
  ["count absent", "count", {}, "absent"],
  ["count duplicate", "count", {}, "duplicate"],
  ["count alias", "count", {}, "duplicate alias"],
  ["count width", "count", {}, "row width"],
];

it.each(
  originalAuthorityCases.map(([name, target, changes, shape]) => ({
    name,
    target,
    changes,
    shape,
  })),
)(
  "fails closed on broken original idempotency authority: G6 binding $name",
  async ({ target, changes, shape }) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: appliedReceipt,
      });
      corruptReplayResult(f, target, changes, shape);
      await expectBrokenReplay(f);
      await expectBrokenReplay(
        f,
        snapshotCanonicalCommand(settlementRequest.projectId, {
          ...settlementRequest.command,
          payload: { value: 8 },
        }),
      );
    } finally {
      await f.close();
    }
  },
);

const replayChildCases: ReadonlyArray<readonly [string, Record<string, string | number | null>]> = [
  ["Project binding", { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }],
  ["receipt binding", { receiptId: "66666666-6666-4666-8666-666666666506" }],
  ["outcome binding", { receiptOutcome: "unchanged" }],
  ["sequence binding", { projectSequence: 2 }],
  ["time binding", { occurredAt: "2026-09-05T12:00:01.000001Z" }],
  ["time minute-only", { occurredAt: "2026-09-05T12:00Z" }],
  ["aggregate malformed", { aggregateId: "invalid" }],
  ["aggregate uppercase", { aggregateId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1" }],
  ["aggregate nil", { aggregateId: "00000000-0000-0000-0000-000000000000" }],
  ["aggregate max", { aggregateId: "ffffffff-ffff-ffff-ffff-ffffffffffff" }],
  ["aggregate blank type", { aggregateType: " " }],
  ["event blank type", { eventType: " " }],
  ...[0, -1, 0.5, 9007199254740992].flatMap((value) => [
    [`aggregate version ${value}`, { aggregateVersion: value }] as const,
    [`event version ${value}`, { eventVersion: value }] as const,
  ]),
];

it.each(replayChildCases)(
  "rejects corrupted replay children and conflicting receipts: G6 child %s",
  async (_name, changes) => expectCorruptedAppliedReplay("events", changes),
);

it("rejects corrupted replay children and conflicting receipts: G6 applied rejection child", async () => {
  const f = await createSettlementFixture();
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    f.observation.after = (sql, result) =>
      sql.includes("FROM command_rejections")
        ? { ...result, columns: ["receiptId"], rows: [[appliedReceipt.receiptId]] }
        : result;
    await expectBrokenReplay(f);
  } finally {
    await f.close();
  }
});

it.each([
  {
    name: "malformed JSON",
    payloadText: "{",
    payloadHash: createHash("sha256").update("{").digest("hex"),
  },
  {
    name: "noncanonical correct hash",
    payloadText: '{ "value":7}',
    payloadHash: createHash("sha256").update('{ "value":7}').digest("hex"),
  },
  {
    name: "reordered correct hash",
    payloadText: '{"value":7,"previous":0}',
    payloadHash: createHash("sha256").update('{"value":7,"previous":0}').digest("hex"),
  },
  {
    name: "duplicate key correct hash",
    payloadText: '{"value":7,"value":7}',
    payloadHash: createHash("sha256").update('{"value":7,"value":7}').digest("hex"),
  },
  {
    name: "nonfinite JSON",
    payloadText: '{"value":1e999}',
    payloadHash: createHash("sha256").update('{"value":1e999}').digest("hex"),
  },
  { name: "wrong digest", payloadHash: "a".repeat(64) },
  { name: "short digest", payloadHash: "abcd" },
  { name: "uppercase digest", payloadHash: "A".repeat(64) },
  { name: "changed payload only", payloadText: '{"value":8}' },
])(
  "rejects corrupted replay children and conflicting receipts: G6 JSON $name",
  async ({ name: _name, ...changes }) => expectCorruptedAppliedReplay("events", changes),
);

it("rejects corrupted replay children and conflicting receipts: G6 JSON persisted digest", async () => {
  const f = await createSettlementFixture();
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    await f.raw.execute({
      sql: "UPDATE canonical_events SET payload_hash=? WHERE project_id=? AND event_id=?",
      args: ["a".repeat(64), settlementRequest.projectId, appliedReceipt.events[0].eventId],
    });
    await expectBrokenReplay(f);
  } finally {
    await f.close();
  }
});

it.each(["throwing", "empty"])(
  "replays exact receipts across repository and activation replacement: G6 replacement %s",
  async (registryKind) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: appliedReceipt,
      });
      expectAppliedRows(await f.snapshot());
      expect(await f.repository.releaseFence("2026-09-05T12:00:04.000Z")).toEqual({
        status: "current",
      });
      await f.repository.close();
      forbidReplayWork(f);
      if (registryKind === "empty") {
        const registry = createCanonicalCommandRegistry([]);
        f.dependencies.registry.prepare.mockImplementation((command) => registry.prepare(command));
      }
      const repository = await activateReplayRepository(f);
      try {
        expect(repository.writerGeneration).toBe(2);
        const before = await f.snapshot();
        expect(before["project_state"]).toEqual([
          [
            settlementRequest.projectId,
            1,
            2,
            "2026-09-05T12:00:00.000Z",
            "2026-09-05T12:00:05.000Z",
          ],
        ]);
        const result = await repository.settle(settlementText);
        expect(result).toEqual({ status: "settled", receipt: appliedReceipt });
        expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
        expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
        expect(f.dependencies.createEventId).not.toHaveBeenCalled();
        expect(f.dependencies.now).not.toHaveBeenCalled();
        expect(await f.snapshot()).toEqual(before);
      } finally {
        await repository.close();
      }
    } finally {
      await f.close();
    }
  },
);

it.each(["2026-09-05T12:00:00Z", "2026-09-05T12:00:00.123Z", "2026-09-05T12:00:00.123456Z"])(
  "requires seconds in settlement clocks and persisted receipt instants: G6 retained %s",
  async (time) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      f.dependencies.now.mockReturnValue(time);
      const expected = { status: "settled", receipt: { ...appliedReceipt, settledAt: time } };
      expect(await f.repository.settle(settlementText)).toEqual(expected);
      expectAppliedRows(await f.snapshot(), 2, time);
      const before = await f.snapshot();
      forbidReplayWork(f);
      expect(await f.repository.settle(settlementText)).toEqual(expected);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);

it("fails closed on broken original idempotency authority: G6 persisted orphan precedes differing request", async () => {
  const f = await createSettlementFixture();
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    await f.raw.execute({
      sql: "DELETE FROM command_idempotency WHERE project_id=? AND command_id=?",
      args: [settlementRequest.projectId, appliedReceipt.commandId],
    });
    await expectBrokenReplay(f);
    await expectBrokenReplay(
      f,
      snapshotCanonicalCommand(settlementRequest.projectId, {
        ...settlementRequest.command,
        payload: { value: 8 },
      }),
    );
  } finally {
    await f.close();
  }
});

it("fails closed on broken original idempotency authority: G6 stored type precedes G9 conflict", () =>
  expectFirstConflict(conflictCases[2]));

it("canonicalizes submitted command content without changing its meaning: G6 other Project cannot alias original", async () => {
  const f = await createSettlementFixture();
  const other = ProjectIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2");
  const aggregate = "55555555-5555-4555-8555-555555555501";
  const t0 = "2026-09-05T12:00:00.000Z";
  try {
    registerCounter(f);
    expect(await f.repository.settle(settlementText)).toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    expectAppliedRows(await f.snapshot());
    await f.raw.execute({
      sql: "INSERT INTO project_state VALUES (?,0,0,?,?)",
      args: [other, t0, t0],
    });
    await f.raw.execute({
      sql: "INSERT INTO conformance_counter VALUES (?,?,0,1)",
      args: [other, aggregate],
    });
    const repository = await activateReplayRepository(f, other);
    try {
      const before = await f.snapshot();
      f.dependencies.createEventId
        .mockReturnValueOnce(appliedReceipt.events[0].eventId)
        .mockReturnValueOnce(appliedReceipt.events[1].eventId);
      expect(
        await repository.settle(snapshotCanonicalCommand(other, settlementRequest.command)),
      ).toEqual({ status: "settled", receipt: { ...appliedReceipt, projectId: other } });
      expectOtherProjectRows(before, await f.snapshot());
      const settled = await f.snapshot();
      forbidReplayWork(f);
      expect(
        await repository.settle(snapshotCanonicalCommand(other, settlementRequest.command)),
      ).toEqual({ status: "settled", receipt: { ...appliedReceipt, projectId: other } });
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: appliedReceipt,
      });
      expect(await f.snapshot()).toEqual(settled);
    } finally {
      await repository.close();
    }
  } finally {
    await f.close();
  }
});

it.each([
  ["fingerprint", { fingerprint: "a".repeat(64) }],
  ["type", { commandType: "conformance.counter.other" }],
  ["version", { commandVersion: 2 }],
  ["identity", { receiptId: "66666666-6666-4666-8666-666666666506" }],
  ["Project", { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }],
  ["command", { commandId: "44444444-4444-4444-8444-444444444502" }],
] as const)(
  "rejects corrupted replay children and conflicting receipts: G6 requested %s",
  async (_name, changes) => expectCorruptedAppliedReplay("requested", changes),
);

const replayMetadataCases: ReadonlyArray<
  readonly [string, Record<string, string | number | null>]
> = [
  ["receipt malformed", { receiptId: "invalid" }],
  ["receipt nil", { receiptId: "00000000-0000-0000-0000-000000000000" }],
  ["receipt uppercase", { receiptId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1" }],
  ["Project malformed", { projectId: "invalid" }],
  ["command malformed", { commandId: "invalid" }],
  ["type blank", { commandType: " " }],
  ["type trimmed", { commandType: " conformance.counter.set" }],
  ["version zero", { commandVersion: 0 }],
  ["version fraction", { commandVersion: 1.5 }],
  ["version unsafe", { commandVersion: 9007199254740992 }],
  ["sequence zero", { projectSequence: 0 }],
  ["sequence fraction", { projectSequence: 1.5 }],
  ["sequence unsafe", { projectSequence: 9007199254740992 }],
  ["generation zero", { writerGeneration: 0 }],
  ["generation fraction", { writerGeneration: 1.5 }],
  ["generation unsafe", { writerGeneration: 9007199254740992 }],
  ["outcome invalid", { outcome: "invalid" }],
  ["time minute-only", { settledAt: "2026-09-05T12:00Z" }],
  ["time minute-only matching children", { settledAt: "2026-09-05T12:00Z" }],
  ["time offset", { settledAt: "2026-09-05T12:00:00+00:00" }],
  ["time local", { settledAt: "2026-09-05T12:00:00" }],
  ["time impossible", { settledAt: "2026-02-30T12:00:00Z" }],
];

it.each(replayMetadataCases)(
  "fails closed on broken original idempotency authority: G6 metadata %s",
  async (name, changes) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: appliedReceipt,
      });
      f.observation.after = (sql, result) => {
        if (name === "time minute-only matching children")
          return alterFence(result, {
            settledAt: "2026-09-05T12:00Z",
            createdAt: "2026-09-05T12:00Z",
            occurredAt: "2026-09-05T12:00Z",
          });
        return sql.includes("FROM command_receipts") && !sql.includes("COUNT(*)")
          ? alterFence(result, changes)
          : result;
      };
      await expectBrokenReplay(f);
      await expectBrokenReplay(
        f,
        snapshotCanonicalCommand(settlementRequest.projectId, {
          ...settlementRequest.command,
          payload: { value: 8 },
        }),
      );
    } finally {
      await f.close();
    }
  },
);

it.each(["absent", "duplicate", "duplicate alias", "row width", "extra alias"])(
  "rejects corrupted replay children and conflicting receipts: G6 requested shape %s",
  async (shape) => expectCorruptedAppliedReplay("requested", {}, shape),
);

it.each(["duplicate", "duplicate alias", "row width", "extra alias"])(
  "rejects corrupted replay children and conflicting receipts: G6 event shape %s",
  async (shape) => expectCorruptedAppliedReplay("events", {}, shape),
);

it.each([
  "malformed ID",
  "nil ID",
  "uppercase ID",
  "ordinal gap",
  "ordinal duplicate",
  "reordered",
  "duplicate ID",
])(
  "rejects corrupted replay children and conflicting receipts: G6 references %s",
  async (scenario) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: appliedReceipt,
      });
      f.observation.after = (sql, result) => {
        if (!sql.includes("FROM canonical_events")) return result;
        if (scenario === "reordered") return { ...result, rows: [...result.rows].reverse() };
        const changes = scenario.startsWith("ordinal")
          ? { eventOrdinal: scenario === "ordinal gap" ? 2 : 0 }
          : {
              eventId:
                scenario === "nil ID"
                  ? "00000000-0000-0000-0000-000000000000"
                  : scenario === "uppercase ID"
                    ? "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1"
                    : scenario === "duplicate ID"
                      ? appliedReceipt.events[0].eventId
                      : "invalid",
            };
        return alterFence(result, changes);
      };
      await expectBrokenReplay(f);
    } finally {
      await f.close();
    }
  },
);

it.each(["missing", "released", "different-token"] as const)(
  "fences settlement before mutations and distinguishes malformed authority: stale %s",
  async (scenario) => {
    const f = await createSettlementFixture();
    try {
      if (scenario === "released") await f.repository.releaseFence("2026-09-05T12:00:02Z");
      f.observation.after = (sql, result) => {
        if (!sql.includes("FROM writer_fence")) return result;
        if (scenario === "missing") return { ...result, rows: [] };
        return scenario === "different-token"
          ? alterFence(result, {
              tokenDigest: "2".repeat(64),
              generationDigest: "2".repeat(64),
            })
          : result;
      };
      const before = await f.snapshot();
      f.calls.length = 0;
      await expect(f.repository.settle(settlementText)).resolves.toEqual({
        status: "stale-writer",
      });
      expect(f.calls[0]).toBe("begin:write");
      expectFenceFirst(f);
      expectNoSettlementWork(f);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);

const malformedFenceCases: ReadonlyArray<
  readonly [string, Record<string, string | number | null>]
> = [
  ["generation zero", { generation: 0 }],
  ["generation fractional", { generation: 1.5 }],
  ["generation unsafe", { generation: 9007199254740992 }],
  ["digest malformed", { tokenDigest: "not-a-digest" }],
  ["digest uppercase", { tokenDigest: "A".repeat(64) }],
  ["Project malformed", { projectId: "invalid" }],
  ["Project mismatched", { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }],
  ["generation Project missing", { generationProjectId: null }],
  [
    "generation Project mismatched",
    { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  ],
  ["generation activation malformed", { generationActivationId: "invalid" }],
  ["generation activation missing", { generationActivationId: null }],
  ["joined generation missing", { generationNumber: null }],
  ["joined generation mismatched", { generationNumber: 2 }],
  ["joined digest missing", { generationDigest: null }],
  ["joined digest mismatched", { generationDigest: "2".repeat(64) }],
  ["activation time minute-only", { activatedAt: "2026-09-05T12:00Z" }],
  ["acquired time missing", { generationAcquiredAt: null }],
  ["acquired time impossible", { generationAcquiredAt: "2026-02-30T12:00:00Z" }],
  ["active released fence", { releasedAt: "2026-09-05T12:00:02Z" }],
  ["active released generation", { generationReleasedAt: "2026-09-05T12:00:02Z" }],
  ["released missing times", { state: "released" }],
  ["released missing generation time", { state: "released", releasedAt: "2026-09-05T12:00:02Z" }],
  ["state invalid", { state: "unknown" }],
];

it.each(malformedFenceCases)(
  "fences settlement before mutations and distinguishes malformed authority: malformed %s",
  async (_name, changes) => {
    const f = await createSettlementFixture();
    try {
      f.observation.after = (sql, result) =>
        sql.includes("FROM writer_fence") ? alterFence(result, changes) : result;
      const before = await f.snapshot();
      const error = await f.repository.settle(settlementText).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBe(authorityPassed);
      expectFenceFirst(f);
      expectNoSettlementWork(f);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);

it.each(["duplicates", "duplicate aliases", "row width", "SQL exception"])(
  "fences settlement before mutations and distinguishes malformed authority: observation %s",
  async (shape) => {
    const f = await createSettlementFixture();
    const sentinel = new Error("private fence SQL failure");
    try {
      f.observation.after = (sql, result) => {
        if (!sql.includes("FROM writer_fence")) return result;
        if (shape === "SQL exception") throw sentinel;
        if (shape === "duplicates") return { ...result, rows: [...result.rows, ...result.rows] };
        if (shape === "duplicate aliases")
          return { ...result, columns: result.columns.map(() => "generation") };
        return { ...result, rows: result.rows.map((row) => [...row, null]) };
      };
      const before = await f.snapshot();
      const error = await f.repository.settle(settlementText).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(error).toBeInstanceOf(Error);
      if (shape === "SQL exception") expect(error).toBe(sentinel);
      expectFenceFirst(f);
      expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);

const fractionalPairs = [
  ["microsecond difference", "2026-09-05T12:00:00.123456Z", "2026-09-05T12:00:00.123457Z", false],
  ["trailing fractional zero", "2026-09-05T12:00:00.123456Z", "2026-09-05T12:00:00.1234560Z", true],
  ["omitted zero fraction", "2026-09-05T12:00:00Z", "2026-09-05T12:00:00.000Z", true],
] as const;
const authorityTimeCases = fractionalPairs.flatMap(([name, left, right, equal]) =>
  (["active acquired", "released acquired", "released release"] as const).map((pair) => ({
    name,
    left,
    right,
    equal,
    pair,
  })),
);

async function expectRetainedTransactionCleanup(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
): Promise<void> {
  const calls = [...f.calls];
  await expect(f.repository.settle(settlementText)).rejects.toThrow(
    "Canonical Writer transaction is already owned.",
  );
  expect(f.calls).toEqual(calls);
  delete f.observation.close;
  await f.repository.close();
  expect(f.calls).toEqual([...calls, "close"]);
}

it("fences settlement before mutations and distinguishes malformed authority: retained close requires explicit lifecycle cleanup", async () => {
  const f = await createSettlementFixture();
  const closeFailure = new Error("retained transaction close failure");
  try {
    f.observation.after = (sql, result) =>
      sql.includes("FROM writer_fence") ? { ...result, rows: [] } : result;
    f.observation.close = async () => {
      throw closeFailure;
    };
    await expect(f.repository.settle(settlementText)).rejects.toBe(closeFailure);
    await expectRetainedTransactionCleanup(f);
  } finally {
    delete f.observation.close;
    await f.close();
  }
});

// These composed variants reuse the earlier B14/F2, B6, B17 and B18 causal Reds.
it.each(["2026-09-05T12:00:00Z", "2026-09-05T12:00:00.123Z", "2026-09-05T12:00:00.123456Z"])(
  "requires seconds in settlement clocks and persisted receipt instants: preserves valid input %s",
  async (time) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      f.dependencies.now.mockReturnValue(time);
      await expect(f.repository.settle(settlementText)).resolves.toEqual({
        status: "settled",
        receipt: { ...appliedReceipt, settledAt: time },
      });
      expectAppliedRows(await f.snapshot(), 2, time);
    } finally {
      await f.close();
    }
  },
);

it.each(
  [
    ["2026-09-05T12:00:00.123456Z", "2026-09-05T12:00:00.1234560Z"],
    ["2026-09-05T12:00:00Z", "2026-09-05T12:00:00.000Z"],
  ].flatMap(([left, right]) => [false, true].map((stale) => ({ left, right, stale }))),
)(
  "fences settlement before mutations and distinguishes malformed authority: F2 composed $left stale=$stale",
  async ({ left, right, stale }) => {
    const f = await createSettlementFixture();
    try {
      assert(left !== undefined && right !== undefined);
      registerCounter(f);
      f.observation.after = (sql, result) =>
        sql.includes("FROM writer_fence")
          ? alterFence(result, {
              activatedAt: left,
              generationAcquiredAt: right,
              ...(stale ? { tokenDigest: "2".repeat(64), generationDigest: "2".repeat(64) } : {}),
            })
          : result;
      const before = await f.snapshot();
      if (stale) {
        await expect(f.repository.settle(settlementText)).resolves.toEqual({
          status: "stale-writer",
        });
        expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
        expect(await f.snapshot()).toEqual(before);
      } else {
        await expect(f.repository.settle(settlementText)).resolves.toEqual({
          status: "settled",
          receipt: appliedReceipt,
        });
        expectAppliedRows(await f.snapshot());
      }
    } finally {
      await f.close();
    }
  },
);

it("fences settlement before mutations and distinguishes malformed authority: coherent persisted replacement generation", async () => {
  const f = await createSettlementFixture();
  try {
    await f.raw.execute({
      sql: "INSERT INTO writer_generations (project_id,writer_generation,activation_id,token_digest,acquired_at,released_at) VALUES (?,2,?,?,?,NULL)",
      args: [
        settlementRequest.projectId,
        "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        "2".repeat(64),
        "2026-09-05T12:00:02Z",
      ],
    });
    await f.raw.execute(
      "UPDATE writer_fence SET writer_generation=2,token_digest='" +
        "2".repeat(64) +
        "',activated_at='2026-09-05T12:00:02Z'",
    );
    await f.raw.execute("UPDATE project_state SET last_writer_generation=2");
    const before = await f.snapshot();
    await expect(f.repository.settle(settlementText)).resolves.toEqual({ status: "stale-writer" });
    expect(await f.snapshot()).toEqual(before);
    expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
    expect(await f.repository.verifyFence()).toEqual({ status: "stale" });
  } finally {
    await f.close();
  }
});

async function expectMalformedHandlerRollback(
  f: Awaited<ReturnType<typeof createSettlementFixture>>,
  invalid: (typeof malformedHandlerDecisions)[number][1],
): Promise<void> {
  registerCounter(f, async (context) => malformedDecision(invalid(await applyCounter(context))));
  await knownBodyFailure(f);
  expect(f.calls.some((sql) => sql.startsWith("UPDATE conformance_counter"))).toBe(true);
}

it.each(
  malformedHandlerDecisions.filter(
    ([name]) => name === "nil aggregate" || name === "max aggregate",
  ),
)(
  "rejects nil and max aggregate identities in handler events and replay rows: handler %s",
  async (_name, invalid) => {
    const f = await createSettlementFixture();
    try {
      await expectMalformedHandlerRollback(f, invalid);
    } finally {
      await f.close();
    }
  },
);

it.each([0, 2])(
  "rolls back known settlement body faults at every mutation stage: second event affected rows %i",
  async (rowsAffected) => {
    const f = await createSettlementFixture();
    let event = 0;
    try {
      registerCounter(f);
      f.observation.after = (sql, result) => {
        if (sql.startsWith("INSERT INTO canonical_events") && ++event === 2)
          return { ...result, rowsAffected };
        return result;
      };
      await knownBodyFailure(f);
      expect(event).toBe(2);
    } finally {
      await f.close();
    }
  },
);

it.each(["begin", "clock", "receipt", "event"] as const)(
  "rolls back known settlement body faults at every mutation stage: dependency exception %s",
  async (stage) => {
    const f = await createSettlementFixture();
    const sentinel = new Error(`private ${stage} failure`);
    try {
      registerCounter(f);
      const fail = () => {
        throw sentinel;
      };
      if (stage === "begin") f.observation.begin = fail;
      if (stage === "clock") f.dependencies.now.mockImplementation(fail);
      if (stage === "receipt") f.dependencies.createReceiptId.mockImplementation(fail);
      if (stage === "event") f.dependencies.createEventId.mockImplementation(fail);
      await knownBodyFailure(f, sentinel);
    } finally {
      await f.close();
    }
  },
);

it.each(["handler throw", "malformed output", "SQL rejection"])(
  "revokes handler capabilities and observes swallowed or unawaited SQL failure: remains revoked after %s and reuse",
  async (failure) => {
    const f = await createSettlementFixture();
    const retained: { transaction?: CanonicalCommandTransaction } = {};
    try {
      registerCounter(f, async (context) => {
        retained.transaction = context.transaction;
        const decision = await applyCounter(context);
        if (failure === "handler throw") throw new Error("private handler error");
        if (failure === "SQL rejection")
          await context.transaction.execute("SELECT * FROM conformance_missing_table");
        return malformedDecision({ ...decision, private: "invalid output" });
      });
      await knownBodyFailure(f);
      assert(retained.transaction !== undefined);
      const before = [...f.calls];
      expect(() => retained.transaction?.execute("SELECT 99")).toThrow(
        "Canonical command transaction capability is revoked.",
      );
      expect(f.calls).toEqual(before);
      registerCounter(f);
      await expect(f.repository.settle(settlementText)).resolves.toEqual({
        status: "settled",
        receipt: appliedReceipt,
      });
      const after = [...f.calls];
      expect(() => retained.transaction?.execute("SELECT 99")).toThrow(
        "Canonical command transaction capability is revoked.",
      );
      expect(f.calls).toEqual(after);
    } finally {
      await f.close();
    }
  },
);

it("drains settlement before retryable Writer release and retains failed transaction close: committed applied rows are not rollback proof", async () => {
  const f = await createSettlementFixture();
  const sentinel = new Error("private close after actual commit");
  try {
    registerCounter(f);
    f.observation.close = async (tx) => {
      expect(tx.closed).toBe(true);
      throw sentinel;
    };
    await expect(f.repository.settle(settlementText)).rejects.toBe(sentinel);
    expectAppliedRows(await f.snapshot());
    expect(f.calls).not.toContain("rollback");
    await expectRetainedTransactionCleanup(f);
  } finally {
    delete f.observation.close;
    await f.close();
  }
});

it.each(malformedHandlerDecisions)(
  "revokes handler capabilities and observes swallowed or unawaited SQL failure: malformed %s",
  async (_name, invalid) => {
    const f = await createSettlementFixture();
    try {
      await expectMalformedHandlerRollback(f, invalid);
    } finally {
      await f.close();
    }
  },
);

it.each([
  "2026-09-05T12:00Z",
  "2026-09-05T12:00:00+00:00",
  "2026-09-05T12:00:00",
  "2026-02-30T12:00:00Z",
])(
  "requires seconds in settlement clocks and persisted receipt instants: invalid input %s",
  async (time) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      f.dependencies.now.mockReturnValue(time);
      await knownBodyFailure(f);
      expect(f.calls.some((sql) => sql.startsWith("UPDATE conformance_counter"))).toBe(true);
    } finally {
      await f.close();
    }
  },
);

it.each(
  (["receipt", "event"] as const).flatMap((identity) =>
    ["AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1", "00000000-0000-0000-0000-000000000000", "invalid"].map(
      (value) => ({ identity, value }),
    ),
  ),
)(
  "rolls back known settlement body faults at every mutation stage: invalid $identity identity $value",
  async ({ identity, value }) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      if (identity === "receipt") f.dependencies.createReceiptId.mockReturnValue(value);
      else f.dependencies.createEventId.mockReturnValue(value);
      await knownBodyFailure(f);
      expect(f.calls.some((sql) => sql.startsWith("UPDATE conformance_counter"))).toBe(true);
    } finally {
      await f.close();
    }
  },
);

const mutationStages = [
  "state read",
  "pointer read",
  "SAVEPOINT",
  "UPDATE conformance_counter",
  "RELEASE",
  "UPDATE project_state",
  "INSERT INTO command_receipts",
  "INSERT INTO command_idempotency",
  "first event",
  "second event",
] as const;
it.each(mutationStages)(
  "rolls back known settlement body faults at every mutation stage: SQL %s",
  async (stage) => {
    const f = await createSettlementFixture();
    const sentinel = new Error(`private SQL ${stage}`);
    try {
      registerCounter(f);
      failSettlementSqlAt(f, stage, sentinel);
      await knownBodyFailure(f, sentinel);
    } finally {
      await f.close();
    }
  },
);

it.each(
  [
    "UPDATE conformance_counter",
    "UPDATE project_state",
    "INSERT INTO command_receipts",
    "INSERT INTO command_idempotency",
    "INSERT INTO canonical_events",
  ].flatMap((stage) => [0, 2].map((rowsAffected) => ({ stage, rowsAffected }))),
)(
  "rolls back known settlement body faults at every mutation stage: affected rows $stage $rowsAffected",
  async ({ stage, rowsAffected }) => {
    const f = await createSettlementFixture();
    try {
      registerCounter(f);
      f.observation.after = (sql, result) =>
        sql.startsWith(stage) ? { ...result, rowsAffected } : result;
      await knownBodyFailure(f);
      expect(f.calls.some((sql) => sql.startsWith(stage))).toBe(true);
    } finally {
      await f.close();
    }
  },
);

it.each(
  (["applied", "unchanged"] as const).flatMap((outcome) =>
    ["swallowed", "unawaited", "synchronous", "clone"].map((fault) => ({ outcome, fault })),
  ),
)(
  "revokes handler capabilities and observes swallowed or unawaited SQL failure: issued $outcome $fault",
  async ({ outcome, fault }) => {
    const f = await createSettlementFixture();
    const sentinel = new Error("private issued SQL failure");
    try {
      observeIssuedSqlFailure(f, fault, sentinel);
      registerCounter(f, issuedSqlFailureHandler(outcome, fault));
      await knownBodyFailure(f, fault === "clone" ? undefined : sentinel);
      expect(f.calls.some((sql) => sql.startsWith("UPDATE conformance_counter"))).toBe(true);
    } finally {
      await f.close();
    }
  },
);

it("revokes handler capabilities and observes swallowed or unawaited SQL failure: handler exception identity", async () => {
  const f = await createSettlementFixture();
  const sentinel = new Error("private handler payload");
  try {
    registerCounter(f, async (context) => {
      await applyCounter(context);
      throw sentinel;
    });
    await knownBodyFailure(f, sentinel);
  } finally {
    await f.close();
  }
});

it("freezes submission meaning before asynchronous repository work: handler output copy and capability revocation", async () => {
  const f = await createSettlementFixture();
  const reached = settlementBarrier();
  const resume = settlementBarrier();
  const retained: {
    decision?: CanonicalCommandDecision;
    transaction?: CanonicalCommandTransaction;
  } = {};
  let pending: Promise<unknown> = Promise.resolve();
  try {
    registerCounter(f, async (context) => {
      retained.transaction = context.transaction;
      retained.decision = await applyCounter(context);
      return retained.decision;
    });
    f.observation.before = async (sql) => {
      if (sql.startsWith("RELEASE")) {
        reached.release();
        await resume.promise;
      }
    };
    pending = f.repository.settle(settlementText);
    await Promise.race([reached.promise, pending.catch(() => undefined)]);
    assert(retained.decision?.outcome === "applied");
    assert(retained.transaction !== undefined);
    const event = retained.decision.events[0];
    assert(event !== undefined);
    assert(event.payload !== null);
    assert(typeof event.payload === "object");
    Reflect.set(event.payload, "value", 99);
    const calls = [...f.calls];
    expect(() => retained.transaction?.execute("SELECT 99")).toThrow(
      "Canonical command transaction capability is revoked.",
    );
    expect(f.calls).toEqual(calls);
    resume.release();
    await expect(pending).resolves.toEqual({ status: "settled", receipt: appliedReceipt });
    expectAppliedRows(await f.snapshot());
    expect(() => retained.transaction?.execute("SELECT 99")).toThrow(
      "Canonical command transaction capability is revoked.",
    );
  } finally {
    resume.release();
    await pending.catch(() => undefined);
    await f.close();
  }
});

it("revokes handler capabilities and observes swallowed or unawaited SQL failure: drains held successful SQL before settlement", async () => {
  const f = await createSettlementFixture();
  const reached = settlementBarrier();
  const returned = settlementBarrier();
  const resume = settlementBarrier();
  let pending: Promise<unknown> = Promise.resolve();
  try {
    const heldSql = "UPDATE conformance_counter SET value=value";
    f.observation.before = async (sql) => {
      if (sql === heldSql) {
        reached.release();
        await resume.promise;
      }
    };
    registerCounter(f, async (context) => {
      const decision = await applyCounter(context);
      void context.transaction.execute(heldSql);
      returned.release();
      return decision;
    });
    pending = f.repository.settle(settlementText);
    await Promise.race([reached.promise, pending.catch(() => undefined)]);
    expect(f.calls).toContain(heldSql);
    await returned.promise;
    await Promise.resolve();
    expect(
      f.calls.some(
        (sql) =>
          sql.startsWith("RELEASE") ||
          sql.startsWith("INSERT INTO command_receipts") ||
          sql === "commit",
      ),
    ).toBe(false);
    resume.release();
    await expect(pending).resolves.toEqual({ status: "settled", receipt: appliedReceipt });
    expectAppliedRows(await f.snapshot());
  } finally {
    resume.release();
    await pending.catch(() => undefined);
    await f.close();
  }
});

it.each([2, 0])(
  "persists applied counter state receipt original pointer and ordered events atomically: %i events",
  async (eventCount) => {
    const f = await createSettlementFixture();
    try {
      const registry = createCanonicalCommandRegistry([
        createConformanceCounterCommand(async (context) => {
          const decision = await applyCounter(context);
          if (decision.outcome === "applied") decision.events.length = eventCount;
          return decision;
        }),
      ]);
      f.dependencies.registry.prepare.mockImplementation((command) => registry.prepare(command));
      const before = await f.snapshot();
      await expect(f.repository.settle(settlementText)).resolves.toEqual({
        status: "settled",
        receipt: { ...appliedReceipt, events: appliedReceipt.events.slice(0, eventCount) },
      });
      const rows = await f.snapshot();
      expectAppliedRows(rows, eventCount);
      for (const table of [
        "writer_fence",
        "writer_generations",
        "writer_handoffs",
        "writer_recovery_records",
      ]) {
        expect(rows[table]).toEqual(before[table]);
      }
      expect(f.dependencies.createReceiptId).toHaveBeenCalledTimes(1);
      expect(f.dependencies.createEventId).toHaveBeenCalledTimes(eventCount);
      expect(f.dependencies.now).toHaveBeenCalledTimes(1);
    } finally {
      await f.close();
    }
  },
);

it("binds typed payload definitions and rejects duplicate registrations: actual settlement handler facade", async () => {
  const f = await createSettlementFixture();
  const observed: unknown[] = [];
  try {
    const registry = createCanonicalCommandRegistry([
      createConformanceCounterCommand(
        async (context) => {
          observed.push({
            contextKeys: Reflect.ownKeys(context).sort(),
            facadeKeys: Reflect.ownKeys(context.transaction),
            projectId: context.projectId,
            payload: context.payload,
          });
          return applyCounter(context);
        },
        (payload) => ({ ...payload, tags: ["schema-produced"] }),
      ),
    ]);
    f.dependencies.registry.prepare.mockImplementation((command) => registry.prepare(command));
    await expect(f.repository.settle(settlementText)).resolves.toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    expect(observed).toEqual([
      {
        contextKeys: ["payload", "projectId", "transaction"],
        facadeKeys: ["execute"],
        projectId: settlementRequest.projectId,
        payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["schema-produced"] },
      },
    ]);
    expectAppliedRows(await f.snapshot());
  } finally {
    await f.close();
  }
});

it("freezes submission meaning before asynchronous repository work: handler payload mutation preserves submitted fingerprint", async () => {
  const f = await createSettlementFixture();
  try {
    registerCounter(f, (context) => {
      context.payload.value = 9;
      return applyCounter(context);
    });
    await expect(f.repository.settle(settlementText)).resolves.toEqual({
      status: "settled",
      receipt: appliedReceipt,
    });
    const rows = await f.snapshot();
    expect(rows["conformance_counter"]).toEqual([
      [settlementRequest.projectId, "55555555-5555-4555-8555-555555555501", 9, 2],
    ]);
    expect(rows["command_receipts"]).toEqual([
      [
        settlementRequest.projectId,
        appliedReceipt.receiptId,
        appliedReceipt.commandId,
        "conformance.counter.set",
        1,
        "ae143cd32d42934cab407968d9a667fc6ce7221c32915f96c6fb4d5efd6ade7b",
        "applied",
        1,
        1,
        appliedReceipt.settledAt,
      ],
    ]);
    expect(rows["canonical_events"]?.map((row) => row.slice(11, 13))).toEqual([
      [
        '{"previous":0,"value":9}',
        "0f95d0663ce2682659c9c2e8220580c5ea0fd74e7eb149f879cbf9fee43ecd34",
      ],
      ['{"value":9}', "df787b58efd0eb82dc394572aed28362f30f8f8e302a23738e19ee54312f6e5c"],
    ]);
  } finally {
    await f.close();
  }
});

it.each(authorityTimeCases)(
  "fences settlement before mutations and distinguishes malformed authority: F2 $pair $name",
  async ({ left, right, equal, pair }) => {
    const f = await createSettlementFixture();
    try {
      if (pair !== "active acquired") await f.repository.releaseFence("2026-09-05T12:00:02Z");
      const changes =
        pair === "released release"
          ? { releasedAt: left, generationReleasedAt: right }
          : { activatedAt: left, generationAcquiredAt: right };
      f.observation.after = (sql, result) =>
        sql.includes("FROM writer_fence") ? alterFence(result, changes) : result;
      const before = await f.snapshot();
      f.calls.length = 0;
      if (equal && pair !== "active acquired") {
        await expect(f.repository.settle(settlementText)).resolves.toEqual({
          status: "stale-writer",
        });
      } else if (equal) {
        await expect(f.repository.settle(settlementText)).rejects.toBe(authorityPassed);
      } else {
        const error = await f.repository.settle(settlementText).then(
          () => undefined,
          (error: unknown) => error,
        );
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBe(authorityPassed);
        expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
      }
      expect(f.calls.slice(0, 2)).toEqual([
        "begin:write",
        expect.stringContaining("FROM writer_fence"),
      ]);
      expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);
