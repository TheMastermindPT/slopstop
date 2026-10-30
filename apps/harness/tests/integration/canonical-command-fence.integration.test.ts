import { expect, it } from "vitest";
import {
  alterFence,
  authorityPassed,
  createSettlementFixture,
  expectNoSettlementWork,
  settlementText,
} from "./canonical-command-fixture.js";
import {
  decodeFailure,
  expectLedgerFailure,
  type LedgerFailure,
  refused,
  shapeFailures,
} from "./canonical-ledger-failure.js";

const incoherentFence = refused("SETTLEMENT_FENCE_INCOHERENT");

function expectFenceFirst(f: Awaited<ReturnType<typeof createSettlementFixture>>): void {
  expect(f.calls.slice(0, 2)).toEqual([
    "begin:write",
    expect.stringContaining("FROM writer_fence"),
  ]);
}

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
  readonly [string, Record<string, string | number | null>, LedgerFailure]
> = [
  ["generation zero", { generation: 0 }, decodeFailure],
  ["generation fractional", { generation: 1.5 }, decodeFailure],
  ["generation unsafe", { generation: 9007199254740992 }, decodeFailure],
  ["digest malformed", { tokenDigest: "not-a-digest" }, decodeFailure],
  ["digest uppercase", { tokenDigest: "A".repeat(64) }, decodeFailure],
  ["Project malformed", { projectId: "invalid" }, decodeFailure],
  ["Project mismatched", { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, incoherentFence],
  ["generation Project missing", { generationProjectId: null }, decodeFailure],
  [
    "generation Project mismatched",
    { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
    incoherentFence,
  ],
  ["generation activation malformed", { generationActivationId: "invalid" }, decodeFailure],
  ["generation activation missing", { generationActivationId: null }, decodeFailure],
  ["joined generation missing", { generationNumber: null }, decodeFailure],
  ["joined generation mismatched", { generationNumber: 2 }, incoherentFence],
  ["joined digest missing", { generationDigest: null }, decodeFailure],
  ["joined digest mismatched", { generationDigest: "2".repeat(64) }, incoherentFence],
  ["activation time minute-only", { activatedAt: "2026-09-05T12:00Z" }, decodeFailure],
  ["acquired time missing", { generationAcquiredAt: null }, decodeFailure],
  ["acquired time impossible", { generationAcquiredAt: "2026-02-30T12:00:00Z" }, decodeFailure],
  ["active released fence", { releasedAt: "2026-09-05T12:00:02Z" }, incoherentFence],
  ["active released generation", { generationReleasedAt: "2026-09-05T12:00:02Z" }, incoherentFence],
  ["released missing times", { state: "released" }, incoherentFence],
  [
    "released missing generation time",
    { state: "released", releasedAt: "2026-09-05T12:00:02Z" },
    incoherentFence,
  ],
  ["state invalid", { state: "unknown" }, decodeFailure],
];

it.each(malformedFenceCases)(
  "fences settlement before mutations and distinguishes malformed authority: malformed %s",
  async (_name, changes, expected) => {
    const f = await createSettlementFixture();
    try {
      f.observation.after = (sql, result) =>
        sql.includes("FROM writer_fence") ? alterFence(result, changes) : result;
      const before = await f.snapshot();
      const error = await f.repository.settle(settlementText).then(
        () => undefined,
        (error: unknown) => error,
      );
      expectLedgerFailure(error, expected);
      expect(error).not.toBe(authorityPassed);
      expectFenceFirst(f);
      expectNoSettlementWork(f);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.close();
    }
  },
);

const observationFailures = {
  duplicates: shapeFailures.exactlyOne,
  "duplicate aliases": shapeFailures.aliases,
  "row width": shapeFailures.width,
} as const;

it.each(["duplicates", "duplicate aliases", "row width", "SQL exception"] as const)(
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
      expectLedgerFailure(
        error,
        shape === "SQL exception" ? { sentinel } : observationFailures[shape],
      );
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
        expectLedgerFailure(error, incoherentFence);
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
