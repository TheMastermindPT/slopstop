import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  runClassifiedWriteTransaction,
  withWriteTransaction,
} from "../../src/storage/project-storage-transaction.js";

it.each(["classified", "legacy"] as const)(
  "retains uncertain evidence after a real commit loses its acknowledgement: %s",
  async (runner) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-s6-ack-"));
    const file = path.join(root, "transaction.db");
    const client = createWorkerLocalLibsqlClient(file, "generation");
    const primary = new Error("P");
    try {
      await client.execute("CREATE TABLE committed (id INTEGER PRIMARY KEY)");
      const transaction = await client.transaction("write");
      const calls: string[] = [];
      const decorated = {
        get closed() {
          return transaction.closed;
        },
        async commit() {
          await transaction.commit();
          expect(transaction.closed).toBe(true);
          calls.push("commit acknowledged by driver");
          throw primary;
        },
        async rollback() {
          calls.push("rollback");
          await transaction.rollback();
        },
        async close() {
          await transaction.close();
          calls.push("close acknowledged");
        },
      };
      const port = { transaction: async () => decorated };
      const operation = async () => {
        await transaction.execute("INSERT INTO committed DEFAULT VALUES");
        return "completed";
      };
      if (runner === "legacy") {
        await expect(withWriteTransaction(port, operation)).rejects.toBe(primary);
      } else {
        const outcome = await runClassifiedWriteTransaction(port, operation);
        expect(outcome).toEqual({
          status: "failed",
          stage: "commit",
          commit: "uncertain",
          primaryError: primary,
          error: primary,
        });
        if (outcome.status !== "failed") throw new Error("Expected uncertainty");
        expect(outcome.primaryError).toBe(primary);
        expect(outcome.error).toBe(primary);
      }
      expect(calls).toEqual(["commit acknowledged by driver", "close acknowledged"]);
      const reader = createWorkerLocalLibsqlClient(file, "generation");
      try {
        expect((await reader.execute("SELECT id FROM committed ORDER BY id")).rows).toEqual([[1]]);
      } finally {
        await reader.close();
      }
    } finally {
      await client.close();
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  },
);
