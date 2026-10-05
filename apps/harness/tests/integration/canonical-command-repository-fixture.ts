import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, ProjectActivationIdSchema, ProjectIdSchema } from "@slopstop/protocol";
import { expect, vi } from "vitest";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import * as repositories from "../../src/storage/canonical-command-repository.js";
import type { InStatement } from "../../src/storage/local-libsql-worker-client.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlResultSet,
  type LocalLibsqlTransaction,
} from "../../src/storage/local-libsql-worker-client.js";

export const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
export const times = [
  "2026-09-04T12:00:00.000Z",
  "2026-09-04T12:01:00.000Z",
  "2026-09-04T12:02:00.000Z",
] as const;
export const tables = [
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
export const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const unexpectedSettlementValue = (): never => {
  throw new Error("Unexpected lifecycle settlement dependency.");
};
export const lifecycleSettlementDependencies = {
  registry: createCanonicalCommandRegistry([]),
  createReceiptId: unexpectedSettlementValue,
  createEventId: unexpectedSettlementValue,
  now: unexpectedSettlementValue,
};

export function factory(dependencies: repositories.CanonicalCommandRepositoryFactoryDependencies) {
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

// Applies the canonical migrations and the Project state row the writer expects.
async function seedCanonicalDatabase(file: string) {
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
}

export async function fixture() {
  const roots: LocalLibsqlClient[] = [];
  let nextId = 100;
  const dependencies = {
    ...lifecycleSettlementDependencies,
    openClient: vi.fn((file: string) => {
      const client = createWorkerLocalLibsqlClient(file, "generation");
      roots.push(client);
      return client;
    }),
    sha256Text: vi.fn(async (text: string) => hash(text)),
    createHandoffId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    createRecoveryRecordId: () => "00000000-0000-4000-8000-000000000999",
  };
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-durable-writer-"));
  const file = path.join(root, "slopstop.db");
  await seedCanonicalDatabase(file);
  const input = (generation: number) => ({
    canonicalDatabasePath: file,
    projectId,
    activationId: decodeStrict(
      ProjectActivationIdSchema,
      `00000000-0000-4000-8000-${String(generation + 10).padStart(12, "0")}`,
    ),
    writerToken: decodeStrict(
      repositories.WriterCapabilityTokenSchema,
      String.fromCharCode(96 + generation).repeat(64),
    ),
    activatedAt: times[Math.min(generation - 1, 2)] ?? times[0],
  });
  return {
    file,
    owner: factory(dependencies),
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

export async function activated(f: Awaited<ReturnType<typeof fixture>>, generation: number) {
  const result = await f.owner.activate(f.input(generation));
  expect(result.status).toBe("activated");
  if (result.status !== "activated") throw result.error;
  expect(result.writerGeneration).toBe(generation);
  return result.repository;
}

export function sqlOf(statement: InStatement): string {
  return typeof statement === "string" ? statement : statement.sql;
}

export function transformTransactionResults(
  tx: LocalLibsqlTransaction,
  transform: (statement: InStatement, result: LocalLibsqlResultSet) => LocalLibsqlResultSet,
): LocalLibsqlTransaction {
  return {
    get closed() {
      return tx.closed;
    },
    execute: async (statement, args) => transform(statement, await tx.execute(statement, args)),
    commit: () => tx.commit(),
    rollback: () => tx.rollback(),
    close: () => tx.close(),
  };
}
