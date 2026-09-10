import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { InStatement } from "@libsql/client";
import { ProjectActivationIdSchema, ProjectIdSchema } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import * as repositories from "./canonical-command-repository.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlResultSet,
} from "./local-libsql-worker-client.js";

const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
const times = [
  "2026-09-04T12:00:00.000Z",
  "2026-09-04T12:01:00.000Z",
  "2026-09-04T12:02:00.000Z",
] as const;
const tables = [
  "project_state",
  "writer_generations",
  "writer_fence",
  "writer_handoffs",
  "writer_recovery_records",
  "command_receipts",
  "command_idempotency",
  "command_rejections",
  "canonical_events",
];
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function factory(dependencies: repositories.CanonicalCommandRepositoryFactoryDependencies) {
  const create = repositories.createCanonicalCommandRepositoryFactory;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Canonical repository factory is missing.");
  return create(dependencies);
}

function database<T>(file: string, action: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(file);
  try {
    return action(db);
  } finally {
    db.close();
  }
}

async function fixture() {
  const roots: LocalLibsqlClient[] = [];
  let nextId = 100;
  const dependencies = {
    openClient: vi.fn((file: string) => {
      const client = createWorkerLocalLibsqlClient(file, "generation");
      roots.push(client);
      return client;
    }),
    sha256Text: vi.fn(async (text: string) => hash(text)),
    createHandoffId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    createRecoveryRecordId: () => "00000000-0000-4000-8000-000000000999",
  };
  const owner = factory(dependencies);
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-durable-writer-"));
  const file = path.join(root, "slopstop.db");
  const migrations = await Promise.all(
    ["0000_fat_doctor_octopus.sql", "0001_canonical_project_writer.sql"].map((name) =>
      readFile(path.resolve(import.meta.dirname, "../../drizzle/canonical", name), "utf8"),
    ),
  );
  database(file, (db) => {
    for (const migration of migrations) db.exec(migration);
    db.prepare("INSERT INTO project_state VALUES (?, 0, 0, ?, ?)").run(
      projectId,
      times[0],
      times[0],
    );
  });
  const input = (generation: number) => ({
    canonicalDatabasePath: file,
    projectId,
    activationId: ProjectActivationIdSchema.parse(
      `00000000-0000-4000-8000-${String(generation + 10).padStart(12, "0")}`,
    ),
    writerToken: repositories.WriterCapabilityTokenSchema.parse(
      String.fromCharCode(96 + generation).repeat(64),
    ),
    activatedAt: times[Math.min(generation - 1, 2)] ?? times[0],
  });
  return {
    file,
    owner,
    dependencies,
    input,
    mutate: (sql: string) =>
      database(file, (db) => {
        db.exec("PRAGMA foreign_keys=OFF; PRAGMA ignore_check_constraints=ON;");
        db.exec(sql);
      }),
    rows: (sql: string) =>
      database(file, (db) =>
        db
          .prepare(sql)
          .all()
          .map((row) => ({ ...row })),
      ),
    snapshot: () =>
      database(file, (db) =>
        JSON.stringify(
          tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()),
        ),
      ),
    dispose: async () => {
      await Promise.all(roots.map((client) => client.close()));
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    },
  };
}

async function activated(f: Awaited<ReturnType<typeof fixture>>, generation: number) {
  const result = await f.owner.activate(f.input(generation));
  expect(result.status).toBe("activated");
  if (result.status !== "activated") throw result.error;
  expect(result.writerGeneration).toBe(generation);
  return result.repository;
}

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

const sqliteScalars = z.array(z.union([z.string(), z.number(), z.bigint(), z.null()]));

function memoryClient(db: DatabaseSync): LocalLibsqlClient {
  const execute: LocalLibsqlClient["execute"] = async (input, args) => {
    const statement = db.prepare(sqlOf(input));
    const bound = sqliteScalars.parse(
      typeof input === "string" ? (args ?? []) : (input.args ?? []),
    );
    const columns = statement.columns().map((column) => column.name);
    if (columns.length !== 0) {
      const rows = statement
        .all(...bound)
        .map((row) => sqliteScalars.parse(columns.map((column) => row[column])));
      return { columns, rows, rowsAffected: 0, lastInsertRowid: null };
    }
    const result = statement.run(...bound);
    if (typeof result.changes !== "number")
      throw new Error("Unexpected fixture change-count type.");
    return {
      columns,
      rows: [],
      rowsAffected: result.changes,
      lastInsertRowid: BigInt(result.lastInsertRowid),
    };
  };
  return {
    execute,
    close: async () => {
      if (db.isOpen) db.close();
    },
    transaction: async () => {
      db.exec("BEGIN IMMEDIATE");
      return {
        get closed() {
          return !db.isTransaction;
        },
        execute,
        commit: async () => {
          db.exec("COMMIT");
        },
        rollback: async () => {
          db.exec("ROLLBACK");
        },
        close: async () => {
          if (db.isTransaction) db.exec("ROLLBACK");
        },
      };
    },
  };
}

async function memoryFixture() {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of ["0000_fat_doctor_octopus.sql", "0001_canonical_project_writer.sql"]) {
      db.exec(
        await readFile(path.resolve(import.meta.dirname, "../../drizzle/canonical", name), "utf8"),
      );
    }
    db.prepare("INSERT INTO project_state VALUES (?, 0, 0, ?, ?)").run(
      projectId,
      times[0],
      times[0],
    );
    const client = memoryClient(db);
    const owner = factory({
      openClient: () => client,
      sha256Text: async (value) => hash(value),
      createHandoffId: () => "00000000-0000-4000-8000-000000000101",
      createRecoveryRecordId: () => "00000000-0000-4000-8000-000000000999",
    });
    const result = await owner.activate({
      canonicalDatabasePath: ":memory:",
      projectId,
      activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
      writerToken: repositories.WriterCapabilityTokenSchema.parse("a".repeat(64)),
      activatedAt: times[0],
    });
    expect(result.status).toBe("activated");
    if (result.status !== "activated") throw result.error;
    return {
      db,
      repository: result.repository,
      snapshot: () =>
        JSON.stringify(
          tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()),
        ),
    };
  } catch (error) {
    if (db.isOpen) db.close();
    throw error;
  }
}

it.each([
  { table: "writer_fence", column: "token_digest", value: "malformed" },
  { table: "writer_fence", column: "released_at", value: "not-a-time" },
  { table: "writer_generations", column: "token_digest", value: "malformed" },
  { table: "writer_generations", column: "released_at", value: "not-a-time" },
  { table: "writer_fence", column: "activated_at", value: "not-a-time" },
  { table: "writer_generations", column: "acquired_at", value: "not-a-time" },
])(
  "rejects malformed persisted Writer authority: $table / $column",
  async ({ table, column, value }) => {
    const f = await memoryFixture();
    try {
      expect(await f.repository.verifyFence()).toEqual({ status: "current" });
      f.db.exec("PRAGMA foreign_keys=OFF; PRAGMA ignore_check_constraints=ON;");
      f.db.prepare(`UPDATE ${table} SET ${column}=? WHERE project_id=?`).run(value, projectId);
      expect(f.db.prepare(`SELECT ${column} FROM ${table}`).get()).toEqual({ [column]: value });
      const before = f.snapshot();
      await expect(f.repository.verifyFence()).rejects.toMatchObject({
        code: "WRITER_FENCE_CHECK_FAILED",
      });
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.repository.close();
    }
  },
);

it("keeps a superseded well-formed Writer capability stale", async () => {
  const f = await fixture();
  try {
    const previous = await activated(f, 1);
    const current = await activated(f, 2);
    const before = f.snapshot();
    expect(await previous.verifyFence()).toEqual({ status: "stale" });
    expect(await current.verifyFence()).toEqual({ status: "current" });
    expect(await previous.releaseFence(times[2])).toEqual({ status: "stale" });
    expect(f.snapshot()).toBe(before);
  } finally {
    await f.dispose();
  }
});

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

function sqlOf(statement: InStatement): string {
  return typeof statement === "string" ? statement : statement.sql;
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
          return {
            get closed() {
              return tx.closed;
            },
            execute: async (statement, args) =>
              transform(statement, await tx.execute(statement, args)),
            commit: () => tx.commit(),
            rollback: () => tx.rollback(),
            close: () => tx.close(),
          };
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

it("retains a repository client when failed activation cleanup cannot close it", async () => {
  const f = await fixture();
  const original = f.dependencies.openClient.getMockImplementation();
  if (original === undefined) throw new Error("Client factory missing.");
  const client = createWorkerLocalLibsqlClient(f.file, "generation");
  const close = vi.fn(() => client.close()).mockRejectedValueOnce(new Error("close failed"));
  f.dependencies.openClient.mockReturnValue({
    execute: (statement, args) => client.execute(statement, args),
    transaction: (mode) => client.transaction(mode),
    close,
  });
  try {
    f.mutate("UPDATE project_state SET last_writer_generation=1");
    const before = f.snapshot();
    const result = await f.owner.activate(f.input(1));
    expect(result).toMatchObject({
      status: "broken",
      error: { code: "WRITER_REPOSITORY_CLOSE_FAILED" },
    });
    expect(close).toHaveBeenCalledTimes(1);
    if (result.status !== "broken" || result.cleanup === undefined)
      throw new Error("Failed client not retained.");
    await result.cleanup.close();
    expect(close).toHaveBeenCalledTimes(2);
    expect(f.snapshot()).toBe(before);
    f.dependencies.openClient.mockImplementation(original);
    expect(await f.owner.activate(f.input(1))).toMatchObject({
      status: "broken",
      error: { code: "WRITER_FENCE_ACTIVATION_FAILED" },
    });
  } finally {
    await client.close();
    await f.dispose();
  }
});
