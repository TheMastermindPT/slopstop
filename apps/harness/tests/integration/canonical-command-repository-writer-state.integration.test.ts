import { expect, it } from "vitest";
import type {
  InStatement,
  LocalLibsqlResultSet,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  activated,
  fixture,
  hash,
  projectId,
  sqlOf,
  times,
  transformTransactionResults,
} from "./canonical-command-repository-fixture.js";

it("validates and advances generation-2 Writer state", async () => {
  const f = await fixture();
  try {
    const first = await activated(f, 1);
    expect(await first.releaseFence(times[1])).toEqual({ status: "current" });
    await first.close();
    await (await activated(f, 2)).close();
    await (await activated(f, 3)).close();
    expect(
      f.rows(
        "SELECT writer_generation, token_digest, acquired_at, released_at FROM writer_generations ORDER BY writer_generation",
      ),
    ).toEqual([
      {
        writer_generation: 1,
        token_digest: hash("a".repeat(64)),
        acquired_at: times[0],
        released_at: times[1],
      },
      {
        writer_generation: 2,
        token_digest: hash("b".repeat(64)),
        acquired_at: times[1],
        released_at: times[2],
      },
      {
        writer_generation: 3,
        token_digest: hash("c".repeat(64)),
        acquired_at: times[2],
        released_at: null,
      },
    ]);
    expect(
      f.rows(
        "SELECT from_writer_generation, to_writer_generation, kind FROM writer_handoffs ORDER BY to_writer_generation",
      ),
    ).toEqual([
      { from_writer_generation: null, to_writer_generation: 1, kind: "initial" },
      { from_writer_generation: 1, to_writer_generation: 2, kind: "clean" },
      { from_writer_generation: 2, to_writer_generation: 3, kind: "recovery" },
    ]);
    expect(f.rows("SELECT * FROM writer_recovery_records")).toEqual([
      {
        project_id: projectId,
        recovery_record_id: "00000000-0000-4000-8000-000000000999",
        writer_generation: 2,
        reason: "abandoned-active-fence",
        command_id: null,
        command_fingerprint: null,
        observed_at: times[2],
        resolution: "generation-superseded",
        resolved_by_writer_generation: 3,
        resolved_at: times[2],
      },
    ]);
    expect(f.rows("SELECT writer_generation, state, released_at FROM writer_fence")).toEqual([
      { writer_generation: 3, state: "active", released_at: null },
    ]);
    for (const token of ["a", "b", "c"]) expect(f.snapshot()).not.toContain(token.repeat(64));
  } finally {
    await f.dispose();
  }
  await rejectPriorStates();
  await compareReleaseInstants();
}, 30_000);

const priorDrifts = [
  "UPDATE project_state SET last_writer_generation=0",
  "DELETE FROM writer_fence",
  "DELETE FROM writer_generations",
  "UPDATE writer_generations SET writer_generation=2; UPDATE writer_fence SET writer_generation=2; UPDATE project_state SET last_writer_generation=2",
  "UPDATE project_state SET last_writer_generation=2",
  "UPDATE writer_fence SET writer_generation=2",
  `UPDATE writer_fence SET token_digest='${"d".repeat(64)}'`,
  "UPDATE writer_fence SET token_digest='malformed'",
  `UPDATE writer_generations SET released_at='${times[1]}'`,
  `UPDATE writer_fence SET state='released', released_at='${times[1]}'`,
  "UPDATE writer_fence SET state='released', released_at='bad'; UPDATE writer_generations SET released_at='bad'",
  `UPDATE writer_fence SET state='released', released_at='${times[1]}'; UPDATE writer_generations SET released_at='${times[2]}'`,
];

async function rejectPriorStates(): Promise<void> {
  for (const sql of priorDrifts) {
    const f = await fixture();
    try {
      await (await activated(f, 1)).close();
      f.mutate(sql);
      const before = f.snapshot();
      expect(await f.owner.activate(f.input(2)), sql).toMatchObject({
        status: "broken",
        error: { code: "WRITER_FENCE_ACTIVATION_FAILED" },
      });
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.dispose();
    }
  }
}

async function compareReleaseInstants(): Promise<void> {
  for (const [left, right, accepted] of [
    ["2026-09-04T12:01:00.0001Z", "2026-09-04T12:01:00.0002Z", false],
    ["2026-09-04T12:01:00.0001Z", "2026-09-04T12:01:00.000100Z", true],
    ["2026-09-04T12:01:00Z", "2026-09-04T12:01:00.000Z", true],
    ["2026-09-04T12:01:00+00:00", "2026-09-04T12:01:00Z", false],
  ] as const) {
    const f = await fixture();
    try {
      await (await activated(f, 1)).close();
      f.mutate(
        `UPDATE writer_fence SET state='released', released_at='${left}'; UPDATE writer_generations SET released_at='${right}'`,
      );
      const before = f.snapshot();
      const result = await f.owner.activate(f.input(2));
      if (accepted) {
        expect(result.status).toBe("activated");
        expect(f.rows("SELECT kind FROM writer_handoffs WHERE to_writer_generation=2")).toEqual([
          { kind: "clean" },
        ]);
      } else {
        expect(result).toMatchObject({
          status: "broken",
          error: { code: "WRITER_FENCE_ACTIVATION_FAILED" },
        });
        expect(f.snapshot()).toBe(before);
      }
    } finally {
      await f.dispose();
    }
  }
}

it("verifies and releases only the current durable Writer fence", async () => {
  const f = await fixture();
  try {
    const repository = await activated(f, 1);
    expect(await repository.verifyFence()).toEqual({ status: "current" });
    for (const invalid of ["bad", "2026-09-04T12:01:00+00:00"])
      await expect(repository.releaseFence(invalid)).rejects.toMatchObject({
        code: "WRITER_FENCE_RELEASE_FAILED",
      });
    f.dependencies.sha256Text.mockResolvedValueOnce("bad");
    await expect(repository.verifyFence()).rejects.toMatchObject({
      code: "WRITER_FENCE_CHECK_FAILED",
    });
    expect(await repository.releaseFence(times[1])).toEqual({ status: "current" });
    expect(await repository.releaseFence(times[1])).toEqual({ status: "stale" });
    expect(await repository.verifyFence()).toEqual({ status: "stale" });
    expect(f.rows("SELECT released_at FROM writer_fence")).toEqual([{ released_at: times[1] }]);
    expect(f.rows("SELECT released_at FROM writer_generations")).toEqual([
      { released_at: times[1] },
    ]);
  } finally {
    await f.dispose();
  }
  await verifyStaleCases();
  await verifyBrokenQueries();
}, 30_000);

async function verifyStaleCases(): Promise<void> {
  for (const sql of [
    "UPDATE writer_fence SET project_id='00000000-0000-4000-8000-000000000020'",
    "UPDATE writer_fence SET writer_generation=2",
    `UPDATE writer_fence SET token_digest='${"d".repeat(64)}'`,
    `UPDATE writer_fence SET state='released', released_at='${times[1]}'`,
    `UPDATE writer_fence SET released_at='${times[1]}'`,
  ]) {
    const f = await fixture();
    try {
      const repository = await activated(f, 1);
      f.mutate(sql);
      const before = f.snapshot();
      expect(await repository.verifyFence()).toEqual({ status: "stale" });
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.dispose();
    }
  }
}

function corruptQuery(
  mode: string,
  statement: InStatement,
  result: LocalLibsqlResultSet,
): LocalLibsqlResultSet {
  const sql = sqlOf(statement);
  if (sql.includes("FROM writer_fence AS f")) {
    if (mode === "sql") throw new Error("SQL failure");
    if (mode === "duplicate") return { ...result, rows: [...result.rows, ...result.rows] };
  }
  const drift = new Map([
    ["fence-count", { prefix: "UPDATE writer_fence", count: 2 }],
    ["generation-count", { prefix: "UPDATE writer_generations", count: 0 }],
  ]).get(mode);
  if (drift !== undefined && sql.startsWith(drift.prefix))
    return { ...result, rowsAffected: drift.count };
  return result;
}

async function verifyBrokenQueries(): Promise<void> {
  for (const mode of ["sql", "duplicate", "fence-count", "generation-count"] as const) {
    const f = await fixture();
    const original = f.dependencies.openClient.getMockImplementation();
    if (original === undefined) throw new Error("Client factory missing.");
    let inject = false;
    const transform = (
      statement: InStatement,
      result: LocalLibsqlResultSet,
    ): LocalLibsqlResultSet => (inject ? corruptQuery(mode, statement, result) : result);
    f.dependencies.openClient.mockImplementation((file) => {
      const client = original(file);
      return {
        execute: async (statement, args) =>
          transform(statement, await client.execute(statement, args)),
        close: () => client.close(),
        transaction: async (mode) => {
          const tx = await client.transaction(mode);
          return transformTransactionResults(tx, transform);
        },
      };
    });
    try {
      const repository = await activated(f, 1);
      inject = true;
      const before = f.snapshot();
      if (mode === "sql" || mode === "duplicate")
        await expect(repository.verifyFence()).rejects.toMatchObject({
          code: "WRITER_FENCE_CHECK_FAILED",
        });
      else
        await expect(repository.releaseFence(times[1])).rejects.toMatchObject({
          code: "WRITER_FENCE_RELEASE_FAILED",
        });
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.dispose();
    }
  }
}
