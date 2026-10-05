import path from "node:path";
import {
  CanonicalProjectCommandRequestSchema,
  decodeStrict,
  ProjectStorageCreateRequestSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { expect } from "vitest";
import { snapshotCanonicalCommand } from "../../src/canonical-json.js";
import type { InStatement } from "../../src/storage/local-libsql-worker-client.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlResultSet,
  type LocalLibsqlTransaction,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  fixedCreationIds,
} from "./project-storage-runtime-fixture.js";

export const canonicalCommandProjectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const canonicalCommandAggregateId = "55555555-5555-4555-8555-555555555501";
export const settlementT0 = "2026-09-05T12:00:00.000Z";
export const settlementT1 = "2026-09-05T12:00:01.000Z";
export const settlementRequest = decodeStrict(CanonicalProjectCommandRequestSchema, {
  projectId: canonicalCommandProjectId,
  activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  command: {
    commandId: "44444444-4444-4444-8444-444444444501",
    type: "conformance.counter.set",
    version: 1,
    payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
  },
});
export const settlementText = snapshotCanonicalCommand(
  settlementRequest.projectId,
  settlementRequest.command,
);
export const authorityPassed = new Error(
  "Fixture reached registry after valid settlement authority.",
);
export const appliedReceipt = {
  receiptId: "66666666-6666-4666-8666-666666666501",
  projectId: canonicalCommandProjectId,
  commandId: "44444444-4444-4444-8444-444444444501",
  commandType: "conformance.counter.set",
  commandVersion: 1,
  outcome: "applied",
  projectSequence: 1,
  writerGeneration: 1,
  settledAt: settlementT1,
  events: [
    { eventId: "77777777-7777-4777-8777-777777777501", eventOrdinal: 0 },
    { eventId: "77777777-7777-4777-8777-777777777502", eventOrdinal: 1 },
  ],
} as const;

export type SettlementObservation = {
  clientClose?(): void | Promise<void>;
  rollback?(transaction: LocalLibsqlTransaction): void | Promise<void>;
  configure?(sql: string, result: LocalLibsqlResultSet): LocalLibsqlResultSet;
  closed?(transaction: LocalLibsqlTransaction): boolean;
  synchronous?(sql: string): void;
  before?(sql: string): void | Promise<void>;
  after?(
    sql: string,
    result: LocalLibsqlResultSet,
  ): LocalLibsqlResultSet | Promise<LocalLibsqlResultSet>;
  begin?(): void | Promise<void>;
  commit?(transaction: LocalLibsqlTransaction): void | Promise<void>;
  close?(transaction: LocalLibsqlTransaction): Promise<void>;
};

export function statementText(statement: InStatement): string {
  return typeof statement === "string" ? statement : statement.sql;
}

export function observedSettlementClient(
  client: LocalLibsqlClient,
  observation: SettlementObservation,
  calls: string[],
): LocalLibsqlClient {
  return {
    execute: async (statement, args) => {
      const result = await client.execute(statement, args);
      return observation.configure?.(statementText(statement), result) ?? result;
    },
    close: async () => {
      await observation.clientClose?.();
      await client.close();
    },
    transaction: async (mode) => {
      calls.push(`begin:${mode}`);
      await observation.begin?.();
      const tx = await client.transaction(mode);
      return {
        get closed() {
          return observation.closed?.(tx) ?? tx.closed;
        },
        execute: (statement, args) => {
          const sql = statementText(statement);
          observation.synchronous?.(sql);
          calls.push(sql);
          return (async () => {
            await observation.before?.(sql);
            const result = await tx.execute(statement, args);
            return observation.after === undefined ? result : observation.after(sql, result);
          })();
        },
        commit: async () => {
          calls.push("commit");
          await observation.commit?.(tx);
          await tx.commit();
        },
        rollback: () => rollbackObservedTransaction(tx, observation, calls),
        close: async () => {
          calls.push("close");
          if (observation.close === undefined) await tx.close();
          else await observation.close(tx);
        },
      };
    },
  };
}

async function rollbackObservedTransaction(
  tx: LocalLibsqlTransaction,
  observation: SettlementObservation,
  calls: string[],
) {
  calls.push("rollback");
  await observation.rollback?.(tx);
  await tx.rollback();
}

export async function settlementRows(file: string) {
  const client = createWorkerLocalLibsqlClient(file, "generation");
  try {
    const rows: Record<string, LocalLibsqlResultSet["rows"]> = {};
    for (const table of [
      "conformance_counter",
      "project_state",
      "command_receipts",
      "command_idempotency",
      "command_rejections",
      "canonical_events",
      "writer_fence",
      "writer_generations",
      "writer_handoffs",
      "writer_recovery_records",
    ]) {
      rows[table] = (await client.execute(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
    }
    rows["foreign_keys"] = (await client.execute("PRAGMA foreign_key_check")).rows;
    return rows;
  } finally {
    await client.close();
  }
}

export async function createCanonicalCommandDatabase(
  extended = true,
  projectId = canonicalCommandProjectId,
): Promise<string> {
  const root = await createTemporaryApplicationRoot();
  const request = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId,
    createRequestId: "44444444-4444-4444-8444-444444444500",
  });
  const storage = await createStorageRuntimeForRoot(root, {
    clockNow: () => "2026-09-05T12:00:00.000Z",
  });
  try {
    const created = parseHarnessMessage(await storage.create(request));
    if (!created.ok) throw new Error("Canonical fixture creation returned an invalid envelope.");
    expect(created.value).toMatchObject({
      event: "project.create.result",
      payload: { status: "created", request, mode: "read-write" },
    });
    const opened = parseHarnessMessage(await storage.open({ projectId: request.projectId }));
    if (!opened.ok) throw new Error("Canonical fixture opening returned an invalid envelope.");
    expect(opened.value).toMatchObject({
      event: "project.open.result",
      payload: { status: "opened", mode: "read-write" },
    });
  } finally {
    await storage.stop();
  }
  const file = path.join(
    root,
    "projects",
    request.projectId,
    fixedCreationIds.generationId,
    "slopstop.db",
  );
  const client = createWorkerLocalLibsqlClient(file, "generation");
  try {
    if (!extended) return file;
    await client.execute(`CREATE TABLE conformance_counter (
      project_id TEXT NOT NULL,
      counter_id TEXT NOT NULL,
      value INTEGER NOT NULL,
      entity_version INTEGER NOT NULL CHECK (entity_version BETWEEN 1 AND 9007199254740991),
      PRIMARY KEY (project_id, counter_id)
    ) STRICT`);
    await client.execute({
      sql: "INSERT INTO conformance_counter (project_id,counter_id,value,entity_version) VALUES (?,?,0,1)",
      args: [projectId, canonicalCommandAggregateId],
    });
  } finally {
    await client.close();
  }
  return file;
}
