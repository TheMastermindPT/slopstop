import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "./local-libsql-worker-client.js";

const roots: string[] = [];
const clients: LocalLibsqlClient[] = [];

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map((client) => client.close()));
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

async function newRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-sqlite-parity-"));
  roots.push(root);
  return root;
}

function open(file: string) {
  const client = createWorkerLocalLibsqlClient(file, "generation");
  clients.push(client);
  return client;
}

it("reports SQLite failures with the base code and the code-prefixed message", async () => {
  const client = open(path.join(await newRoot(), "errors.db"));
  await client.execute("CREATE TABLE t (n INTEGER UNIQUE)");
  await client.execute({ sql: "INSERT INTO t (n) VALUES (?)", args: [5] });

  await expect(
    client.execute({ sql: "INSERT INTO t (n) VALUES (?)", args: [5] }),
  ).rejects.toMatchObject({
    name: "LibsqlError",
    code: "SQLITE_CONSTRAINT",
    message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: t.n",
  });
  await expect(client.execute("SELEC 1")).rejects.toMatchObject({
    name: "LibsqlError",
    code: "SQLITE_ERROR",
    message: 'SQLITE_ERROR: near "SELEC": syntax error',
  });
});

it("reports a write lock held by another connection as SQLITE_BUSY", async () => {
  const file = path.join(await newRoot(), "busy.db");
  const holder = open(file);
  const contender = open(file);
  await holder.execute("CREATE TABLE t (n INTEGER)");
  const held = await holder.transaction("write");
  try {
    await expect(contender.transaction("write")).rejects.toMatchObject({
      name: "LibsqlError",
      code: "SQLITE_BUSY",
    });
  } finally {
    await held.rollback();
  }
});

it("converts argument and result values like the libSQL client", async () => {
  const client = open(path.join(await newRoot(), "values.db"));
  await client.execute("CREATE TABLE v (flag INTEGER, at INTEGER, bytes BLOB, big INTEGER, empty)");
  const at = new Date("2026-10-05T12:00:00.000Z");

  const inserted = await client.execute({
    sql: "INSERT INTO v (flag, at, bytes, big, empty) VALUES (?, ?, ?, ?, ?)",
    args: [true, at, new Uint8Array([1, 2, 3]).buffer, 9007199254740991n, null],
  });
  expect(inserted).toEqual({ columns: [], rows: [], rowsAffected: 1, lastInsertRowid: 1n });

  const selected = await client.execute({
    sql: "SELECT flag, at, bytes, big, empty FROM v WHERE flag = :flag",
    args: { ":flag": 1 },
  });
  expect(selected.columns).toEqual(["flag", "at", "bytes", "big", "empty"]);
  expect(selected.rowsAffected).toBe(0);
  expect(selected.lastInsertRowid).toBeNull();
  const [row] = selected.rows;
  expect(row?.slice(0, 2)).toEqual([1, at.valueOf()]);
  expect(row?.[2]).toBeInstanceOf(ArrayBuffer);
  expect([...new Uint8Array(row?.[2] as ArrayBuffer)]).toEqual([1, 2, 3]);
  expect(row?.slice(3)).toEqual([9007199254740991, null]);

  await expect(client.execute("SELECT 9007199254740993")).rejects.toMatchObject({
    name: "RangeError",
    message: "Received integer which cannot be safely represented as a JavaScript number",
  });
});

it("runs a write transaction on its own connection and closes it when it ends", async () => {
  const root = await newRoot();
  const client = open(path.join(root, "detach.db"));
  await client.execute("CREATE TABLE t (n INTEGER)");
  await client.execute("PRAGMA busy_timeout = 0");

  const transaction = await client.transaction("write");
  await transaction.execute("INSERT INTO t (n) VALUES (1)");
  await expect(client.execute("SELECT count(*) FROM t")).resolves.toMatchObject({ rows: [[0]] });
  await transaction.commit();
  expect(transaction.closed).toBe(true);
  await expect(client.execute("SELECT count(*) FROM t")).resolves.toMatchObject({ rows: [[1]] });

  const open_ = await client.transaction("write");
  await open_.execute("INSERT INTO t (n) VALUES (2)");
  await client.close();
  await expect(rename(root, `${root}-moved`)).resolves.toBeUndefined();
  await rename(`${root}-moved`, root);
});

it("opens a file that is not a database and fails on the first query", async () => {
  const root = await newRoot();
  const file = path.join(root, "not-a-database.db");
  await writeFile(file, "plain text, not a SQLite database file ".repeat(64));
  const client = open(file);

  await expect(client.execute("SELECT name FROM sqlite_master")).rejects.toMatchObject({
    name: "LibsqlError",
    code: "SQLITE_NOTADB",
    message: "SQLITE_NOTADB: file is not a database",
  });
  await expect(client.close()).resolves.toBeUndefined();
});

it("releases every file of a closed client at once, without waiting for collection", async () => {
  const root = await newRoot();
  for (let index = 0; index < 5; index += 1) {
    const directory = path.join(root, `generation-${index}`);
    await mkdir(directory);
    const client = open(path.join(directory, "slopstop.db"));
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("CREATE TABLE t (n INTEGER)");
    const transaction = await client.transaction("write");
    await transaction.execute("INSERT INTO t (n) VALUES (1)");
    await transaction.commit();
    await client.close();
    await expect(rename(directory, `${directory}-released`)).resolves.toBeUndefined();
  }
});
