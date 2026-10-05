import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CommandIdSchema,
  decodeStrict,
  ProjectActivationIdSchema,
  ProjectIdSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
import { expect, it, vi } from "vitest";
import {
  activated,
  factory,
  fixture,
  hash,
  lifecycleSettlementDependencies,
  projectId,
  sqlOf,
  tables,
  times,
  transformTransactionResults,
} from "../../tests/integration/canonical-command-repository-fixture.js";
import { snapshotCanonicalCommand } from "../canonical-json.js";
import * as repositories from "./canonical-command-repository.js";
import type { InStatement } from "./local-libsql-worker-client.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlResultSet,
  type LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";

const sqliteScalars = Schema.Array(
  Schema.Union([Schema.String, Schema.Number, Schema.BigInt, Schema.Null]),
);

function memoryClient(db: DatabaseSync): LocalLibsqlClient {
  const execute: LocalLibsqlClient["execute"] = async (input, args) => {
    const statement = db.prepare(sqlOf(input));
    const bound = decodeStrict(
      sqliteScalars,
      typeof input === "string" ? (args ?? []) : (input.args ?? []),
    );
    const columns = statement.columns().map((column) => column.name);
    if (columns.length !== 0) {
      const rows = statement.all(...bound).map((row) =>
        decodeStrict(
          sqliteScalars,
          columns.map((column) => row[column]),
        ),
      );
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
      ...lifecycleSettlementDependencies,
      createRecoveryRecordId: () => "00000000-0000-4000-8000-000000000999",
    });
    const result = await owner.activate({
      canonicalDatabasePath: ":memory:",
      projectId,
      activationId: decodeStrict(ProjectActivationIdSchema, "00000000-0000-4000-8000-000000000011"),
      writerToken: decodeStrict(repositories.WriterCapabilityTokenSchema, "a".repeat(64)),
      activatedAt: times[0],
    });
    expect(result.status).toBe("activated");
    if (result.status !== "activated") throw result.error;
    return {
      db,
      client,
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

function seedRejectedMemoryReceipt(db: DatabaseSync) {
  const commandId = seedAppliedMemoryReceipt(db);
  db.exec("DELETE FROM canonical_events");
  db.exec("UPDATE command_receipts SET outcome='rejected'");
  db.prepare("INSERT INTO command_rejections VALUES (?,?,?,?,?,?,?,?)").run(
    projectId,
    "66666666-6666-4666-8666-666666666501",
    "rejected",
    1,
    "TEST_COUNTER_REJECTED",
    0,
    '{"version":1}',
    hash('{"version":1}'),
  );
  return commandId;
}

function transformMemoryResults(
  client: LocalLibsqlClient,
  transform: (statement: InStatement, result: LocalLibsqlResultSet) => LocalLibsqlResultSet,
): void {
  const transaction = client.transaction.bind(client);
  vi.spyOn(client, "transaction").mockImplementation(async (mode) => {
    const tx = await transaction(mode);
    const execute = tx.execute.bind(tx);
    vi.spyOn(tx, "execute").mockImplementation(async (statement, args) =>
      transform(statement, await execute(statement, args)),
    );
    return tx;
  });
}

function corruptMemoryColumn(
  client: LocalLibsqlClient,
  query: string,
  field: string,
  value: string | number | null,
): void {
  transformMemoryResults(client, (statement, result) => {
    if (!sqlOf(statement).includes(query)) return result;
    return {
      ...result,
      rows: result.rows.map((row) =>
        result.columns.map((column, index) => (column === field ? value : (row[index] ?? null))),
      ),
    };
  });
}

function replayCounterCommand(commandId: ReturnType<typeof seedAppliedMemoryReceipt>) {
  return snapshotCanonicalCommand(projectId, {
    commandId,
    type: "conformance.counter.set",
    version: 1,
    payload: { value: 7 },
  });
}

function expectGenuineReplayFailure(error: unknown): void {
  expect(error).toBeInstanceOf(Error);
  expect(error instanceof Error && error.message.includes("not implemented")).toBe(false);
  expect(error).not.toEqual(new Error("Unexpected lifecycle settlement dependency."));
}

it.each([
  { field: "projectSequence", value: 2 },
  { field: "retryable", value: 2 },
  { field: "detailsText", value: '{"version":2}' },
  { field: "detailsHash", value: "a".repeat(64) },
  { field: "receiptId", value: "66666666-6666-4666-8666-666666666502" },
])(
  "rejects corrupted replay children and conflicting receipts: G8 unit $field",
  async ({ field, value }) => {
    const f = await memoryFixture();
    try {
      const commandId = seedRejectedMemoryReceipt(f.db);
      corruptMemoryColumn(f.client, "FROM command_rejections", field, value);
      const before = f.snapshot();
      const text = replayCounterCommand(commandId);
      const error = await f.repository.settle(text).catch((error: unknown) => error);
      expectGenuineReplayFailure(error);
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.repository.close();
    }
  },
);

function seedAppliedMemoryReceipt(db: DatabaseSync) {
  const commandId = decodeStrict(CommandIdSchema, "44444444-4444-4444-8444-444444444501");
  const receiptId = "66666666-6666-4666-8666-666666666501";
  const fingerprint = hash(
    '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":7},"projectId":"00000000-0000-4000-8000-000000000010","type":"conformance.counter.set","version":1}',
  );
  db.prepare(
    "UPDATE project_state SET last_project_sequence=1, updated_at=? WHERE project_id=?",
  ).run(times[1], projectId);
  db.prepare("INSERT INTO command_receipts VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    projectId,
    receiptId,
    commandId,
    "conformance.counter.set",
    1,
    fingerprint,
    "applied",
    1,
    1,
    times[1],
  );
  db.prepare("INSERT INTO command_idempotency VALUES (?,?,?,?,?)").run(
    projectId,
    commandId,
    fingerprint,
    receiptId,
    times[1],
  );
  db.prepare("INSERT INTO canonical_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    projectId,
    "77777777-7777-4777-8777-777777777501",
    receiptId,
    "applied",
    1,
    0,
    "conformance.counter",
    "55555555-5555-4555-8555-555555555501",
    2,
    "conformance.counter.changed",
    1,
    '{"value":7}',
    hash('{"value":7}'),
    times[1],
  );
  return commandId;
}

it.each(["events", "rejections"])(
  "rejects corrupted replay children and conflicting receipts: G7 unit unchanged %s",
  async (child) => {
    const f = await memoryFixture();
    try {
      const commandId = seedAppliedMemoryReceipt(f.db);
      transformMemoryResults(f.client, (statement, result) => {
        if (sqlOf(statement).includes("FROM command_receipts"))
          return {
            ...result,
            rows: result.rows.map((row) =>
              result.columns.map((column, i) =>
                column === "outcome" ? "unchanged" : (row[i] ?? null),
              ),
            ),
          };
        if (child === "rejections" && sqlOf(statement).includes("FROM command_rejections"))
          return { ...result, rows: [result.columns.map(() => null)] };
        return result;
      });
      const before = f.snapshot();
      const text = snapshotCanonicalCommand(projectId, {
        commandId,
        type: "conformance.counter.set",
        version: 1,
        payload: { value: 7 },
      });
      await expect(f.repository.settle(text)).rejects.toThrow(/children/);
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.repository.close();
    }
  },
);

it.each([
  { query: "COUNT(*) AS receiptCount", field: "receiptCount", value: "1" },
  { query: "FROM command_idempotency", field: "fingerprint", value: "bad" },
  { query: "FROM command_receipts", field: "generationNumber", value: null },
  {
    query: "FROM canonical_events",
    field: "aggregateId",
    value: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  },
  { query: "FROM canonical_events", field: "aggregateVersion", value: 0.5 },
  { query: "FROM canonical_events", field: "receiptOutcome", value: "unchanged" },
  { query: "FROM canonical_events", field: "projectSequence", value: 2 },
  { query: "FROM canonical_events", field: "occurredAt", value: "2026-09-04T12:01Z" },
])(
  "fails closed on broken original idempotency authority: G6 unit $query $field",
  async ({ query, field, value }) => {
    const f = await memoryFixture();
    try {
      const commandId = seedAppliedMemoryReceipt(f.db);
      corruptMemoryColumn(f.client, query, field, value);
      const before = f.snapshot();
      const text = replayCounterCommand(commandId);
      const error = await f.repository.settle(text).then(
        () => undefined,
        (error: unknown) => error,
      );
      expectGenuineReplayFailure(error);
      expect(f.snapshot()).toBe(before);
    } finally {
      await f.repository.close();
    }
  },
);

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

it("fences settlement before mutations and distinguishes malformed authority: wrong Project before transaction", async () => {
  const f = await fixture();
  try {
    const repository = await activated(f, 1);
    const client = f.dependencies.openClient.mock.results[0]?.value;
    if (client === undefined) throw new Error("Fixture client was not opened.");
    const begin = vi.spyOn(client, "transaction");
    const before = f.snapshot();
    const text = snapshotCanonicalCommand(
      decodeStrict(ProjectIdSchema, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"),
      {
        commandId: decodeStrict(CommandIdSchema, "44444444-4444-4444-8444-444444444501"),
        type: "conformance.counter.set",
        version: 1,
        payload: { value: 7 },
      },
    );
    await expect(repository.settle(text)).rejects.toThrow(
      "Settlement Project does not match its repository.",
    );
    expect(begin).not.toHaveBeenCalled();
    expect(f.snapshot()).toBe(before);
  } finally {
    await f.dispose();
  }
});

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

function decorateClient(
  f: Awaited<ReturnType<typeof fixture>>,
  decorate: (client: LocalLibsqlClient) => LocalLibsqlClient,
): void {
  const open = f.dependencies.openClient.getMockImplementation();
  if (open === undefined) throw new Error("Client factory missing.");
  f.dependencies.openClient.mockImplementation((file) => decorate(open(file)));
}

const ownershipStages = ["configuration", "begin", "body", "commit", "rollback", "close"] as const;

const rowShapeCases = [
  { action: "activation", query: "PRAGMA foreign_keys" },
  { action: "release", query: "PRAGMA foreign_keys" },
  { action: "activation", query: "SELECT last_writer_generation" },
  { action: "activation", query: "SELECT f.writer_generation" },
  { action: "verify", query: "SELECT f.writer_generation" },
].flatMap((entry) => ["duplicate-alias", "extra-cell"].map((fault) => ({ ...entry, fault })));

const configurationFaults = [
  { name: "disabled", columns: ["foreign_keys"], rows: [[0]] },
  { name: "text", columns: ["foreign_keys"], rows: [["1"]] },
  { name: "null", columns: ["foreign_keys"], rows: [[null]] },
  { name: "missing-row", columns: ["foreign_keys"], rows: [] },
  { name: "duplicate-row", columns: ["foreign_keys"], rows: [[1], [1]] },
  { name: "wrong-alias", columns: ["wrong"], rows: [[1]] },
  { name: "short-row", columns: ["foreign_keys"], rows: [[]] },
  { name: "set-foreign-keys", columns: [], rows: [] },
  { name: "set-timeout", columns: [], rows: [] },
  { name: "read-foreign-keys", columns: [], rows: [] },
  { name: "begin", columns: [], rows: [] },
];

async function expectNextActivationBroken(
  f: Awaited<ReturnType<typeof fixture>>,
  repository: Awaited<ReturnType<typeof activated>>,
): Promise<void> {
  await repository.close();
  expect(await f.owner.activate(f.input(2))).toMatchObject({
    status: "broken",
    error: { code: "WRITER_FENCE_ACTIVATION_FAILED" },
  });
}

function configurationFaultExecute(
  client: LocalLibsqlClient,
  fault: Pick<LocalLibsqlResultSet, "columns" | "rows"> & { name: string },
  injecting: () => boolean,
): LocalLibsqlClient["execute"] {
  return async (statement, args) => {
    const sql = sqlOf(statement);
    const failureSql = new Map([
      ["set-foreign-keys", "PRAGMA foreign_keys = ON"],
      ["set-timeout", "PRAGMA busy_timeout = 5000"],
      ["read-foreign-keys", "PRAGMA foreign_keys"],
    ]).get(fault.name);
    if (injecting() && sql === failureSql) throw new Error("configuration failed");
    const result = await client.execute(statement, args);
    return injecting() && sql === "PRAGMA foreign_keys" && fault.name !== "begin"
      ? { ...result, columns: fault.columns, rows: fault.rows }
      : result;
  };
}

it.each(
  configurationFaults.flatMap((fault) =>
    ["activation", "release"].map((action) => ({ ...fault, action })),
  ),
)(
  "S5 G4 characterizes configuration failure $name during $action",
  async ({ name, columns, rows, action }) => {
    const f = await fixture();
    let inject = false;
    let begins = 0;
    decorateClient(f, (client) => ({
      execute: configurationFaultExecute(client, { name, columns, rows }, () => inject),
      close: () => client.close(),
      transaction: async (mode) => {
        begins++;
        if (inject && name === "begin") throw new Error("begin failed");
        return client.transaction(mode);
      },
    }));
    try {
      const repository = await activated(f, 1);
      const before = f.snapshot();
      inject = true;
      if (action === "activation") {
        await expectNextActivationBroken(f, repository);
      } else {
        await expect(repository.releaseFence(times[1])).rejects.toMatchObject({
          code: "WRITER_FENCE_RELEASE_FAILED",
        });
      }
      expect(begins).toBe(name === "begin" ? 2 : 1);
      expect(f.snapshot()).toBe(before);
      inject = false;
      if (action === "activation") await (await activated(f, 2)).close();
      else expect(await repository.releaseFence(times[1])).toEqual({ status: "current" });
    } finally {
      await f.dispose();
    }
  },
);

it.each(rowShapeCases)(
  "S5 G4 rejects $fault in $query during $action",
  async ({ action, query, fault }) => {
    const f = await fixture();
    let inject = false;
    let begins = 0;
    const transform = (
      statement: InStatement,
      result: LocalLibsqlResultSet,
    ): LocalLibsqlResultSet => {
      const sql = sqlOf(statement);
      const matches = query === "PRAGMA foreign_keys" ? sql === query : sql.startsWith(query);
      if (!inject || !matches) return result;
      const column = result.columns[0];
      if (column === undefined) throw new Error("Expected a real result column.");
      return {
        ...result,
        columns: fault === "duplicate-alias" ? [...result.columns, column] : result.columns,
        rows: result.rows.map((row) => [...row, row[0] ?? null]),
      };
    };
    decorateClient(f, (client) => ({
      execute: async (statement, args) =>
        transform(statement, await client.execute(statement, args)),
      close: () => client.close(),
      transaction: async (mode) => {
        begins++;
        const tx = await client.transaction(mode);
        return transformTransactionResults(tx, transform);
      },
    }));
    try {
      const repository = await activated(f, 1);
      const before = f.snapshot();
      inject = true;
      if (action === "activation") {
        await expectNextActivationBroken(f, repository);
      } else if (action === "release") {
        await expect(repository.releaseFence(times[1])).rejects.toMatchObject({
          code: "WRITER_FENCE_RELEASE_FAILED",
        });
      } else {
        await expect(repository.verifyFence()).rejects.toMatchObject({
          code: "WRITER_FENCE_CHECK_FAILED",
        });
      }
      expect(f.snapshot()).toBe(before);
      if (query === "PRAGMA foreign_keys") expect(begins).toBe(1);
    } finally {
      await f.dispose();
    }
  },
);

function signal() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const retainedCloseCases = ["activation", "release", "repository-close"].flatMap((action) =>
  ["reject-open", "reject-closed", "false-success", "retry-false-success"].flatMap((fault) =>
    ["commit", "body-failure"].map((terminal) => ({ action, fault, terminal })),
  ),
);

it.each(retainedCloseCases)(
  "S5 G4 retains $fault after $terminal for $action",
  async ({ action, fault, terminal }) => {
    const f = await fixture();
    const entered = signal();
    const resume = signal();
    const log: string[] = [];
    let armed = action === "activation";
    let attempts = 0;
    let transactionId = 0;
    const closeFailure = new Error("close acknowledgement failed");
    const closeAttempt = async () => {
      attempts++;
      if (attempts === 2) {
        entered.resolve();
        await resume.promise;
      }
      if (attempts === 1 && fault === "false-success") return false;
      if (attempts === 2 && fault === "retry-false-success") return false;
      if (attempts <= 2) throw closeFailure;
      return true;
    };
    const closeTransaction = async (tx: LocalLibsqlTransaction, id: number, affected: boolean) => {
      log.push(`tx-close:${id}`);
      if (affected && !(await closeAttempt())) return false;
      await tx.close();
      if (affected) armed = false;
      return true;
    };
    decorateClient(f, (client) => ({
      execute: (statement, args) => client.execute(statement, args),
      close: async () => {
        log.push("client-close");
        if (attempts === 1) entered.resolve();
        await client.close();
      },
      transaction: async (mode) => {
        if (attempts === 1) {
          log.push("unexpected-begin");
          entered.resolve();
          throw new Error("New transaction preceded retained cleanup.");
        }
        const id = ++transactionId;
        log.push(`begin:${id}`);
        const tx = await client.transaction(mode);
        const affected = armed;
        let acknowledged = !affected;
        return {
          get closed() {
            return acknowledged || fault === "reject-closed" ? tx.closed : false;
          },
          execute: async (statement, args) => {
            log.push(`sql:${id}`);
            const result = await tx.execute(statement, args);
            if (affected && terminal === "body-failure") throw new Error("original body failed");
            return result;
          },
          commit: () => tx.commit(),
          rollback: () => tx.rollback(),
          close: async () => {
            acknowledged = await closeTransaction(tx, id, affected);
          },
        };
      },
    }));
    let pending: Promise<unknown> | undefined;
    try {
      let cleanup: () => Promise<unknown>;
      let originalFailure: unknown;
      if (action === "activation") {
        const result = await f.owner.activate(f.input(1));
        expect(result).toMatchObject({
          status: "broken",
          error: { code: "WRITER_REPOSITORY_CLOSE_FAILED" },
        });
        if (result.status !== "broken" || result.cleanup === undefined)
          throw new Error("Transaction cleanup not retained.");
        const retained = result.cleanup;
        originalFailure = result.error;
        cleanup = () => retained.close();
      } else {
        const repository = await activated(f, 1);
        armed = true;
        log.length = 0;
        originalFailure = await repository.releaseFence(times[1]).catch((error: unknown) => error);
        expect(originalFailure).toMatchObject({
          code: "WRITER_FENCE_RELEASE_FAILED",
        });
        cleanup =
          action === "release" ? () => repository.releaseFence(times[2]) : () => repository.close();
      }
      const id = transactionId;
      expect(attempts).toBe(1);
      expect(log).not.toContain("client-close");
      const before = [...log];
      const beforeRows = f.snapshot();
      pending = cleanup().catch((error: unknown) => error);
      await entered.promise;
      expect(log).toEqual([...before, `tx-close:${id}`]);
      await expect(cleanup()).rejects.toBeInstanceOf(Error);
      expect(log).toEqual([...before, `tx-close:${id}`]);
      resume.resolve();
      expect(await pending).toBeInstanceOf(Error);
      expect(log).toEqual([...before, `tx-close:${id}`]);
      expect(f.snapshot()).toBe(beforeRows);
      await cleanup();
      expect(log.slice(before.length, before.length + 2)).toEqual([
        `tx-close:${id}`,
        `tx-close:${id}`,
      ]);
      expect(attempts).toBe(3);
      if (terminal === "body-failure") {
        expect(originalFailure).toMatchObject({
          cause: {
            errors: expect.arrayContaining([
              expect.objectContaining({ message: "original body failed" }),
            ]),
          },
        });
      }
      if (action !== "release") {
        expect(log.at(-1)).toBe("client-close");
        await cleanup();
        expect(log.filter((entry) => entry === "client-close")).toHaveLength(1);
      }
    } finally {
      resume.resolve();
      await pending;
      await f.dispose();
    }
  },
);

it.each(
  ownershipStages.flatMap((stage) => [
    { stage, action: "release" as const },
    { stage, action: "close" as const },
  ]),
)("S5 G4 refuses $action while a transaction is in $stage", async ({ stage, action }) => {
  const f = await fixture();
  const entered = signal();
  const resume = signal();
  let armed = false;
  let held = false;
  const log: string[] = [];
  const hold = async (at: string) => {
    log.push(at);
    if (!armed || at !== stage) return;
    armed = false;
    held = true;
    entered.resolve();
    await resume.promise;
    held = false;
  };
  decorateClient(f, (client) => ({
    execute: async (statement, args) => {
      await hold("configuration");
      return client.execute(statement, args);
    },
    close: async () => {
      log.push("client-close");
      if (held) throw new Error("Client close reached an in-flight transaction.");
      await client.close();
    },
    transaction: async (mode) => {
      if (held) throw new Error("Second begin reached the client.");
      await hold("begin");
      const tx = await client.transaction(mode);
      return {
        get closed() {
          return tx.closed;
        },
        execute: async (statement, args) => {
          await hold("body");
          if (stage === "rollback" && armed) throw new Error("body failed");
          return tx.execute(statement, args);
        },
        commit: async () => {
          await hold("commit");
          await tx.commit();
        },
        rollback: async () => {
          await hold("rollback");
          await tx.rollback();
        },
        close: async () => {
          await hold("close");
          await tx.close();
        },
      };
    },
  }));
  let first: Promise<unknown> | undefined;
  try {
    const repository = await activated(f, 1);
    log.length = 0;
    armed = true;
    first = repository.releaseFence(times[1]).catch((error: unknown) => error);
    await entered.promise;
    const before = [...log];
    const second = action === "release" ? repository.releaseFence(times[2]) : repository.close();
    await expect(second).rejects.toMatchObject({
      code: action === "release" ? "WRITER_FENCE_RELEASE_FAILED" : "WRITER_REPOSITORY_CLOSE_FAILED",
      cause: { message: "Canonical Writer transaction is already owned." },
    });
    expect(log).toEqual(before);
    resume.resolve();
    const outcome = await first;
    if (stage === "rollback")
      expect(outcome).toMatchObject({ code: "WRITER_FENCE_RELEASE_FAILED" });
    else expect(outcome).toEqual({ status: "current" });
    expect(log.filter((entry) => entry === "close")).toHaveLength(1);
    expect(await repository.releaseFence(times[2])).toEqual({
      status: stage === "rollback" ? "current" : "stale",
    });
    await repository.close();
  } finally {
    resume.resolve();
    await first;
    await f.dispose();
  }
});
