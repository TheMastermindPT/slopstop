import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
  type LocalLibsqlTransaction,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  appliedReceipt,
  canonicalCommandAggregateId,
  canonicalCommandProjectId,
  createCanonicalCommandDatabase,
  expectAppliedRows,
  expectUnchangedRows,
  settlementRequest,
  settlementRows,
  settlementT0,
  settlementText,
  unchangedReceipt,
  unchangedText,
} from "./canonical-command-fixture.js";
import { createConformanceCounterCommand } from "./conformance-counter-command.js";

const selectCounter = {
  sql: "SELECT value,entity_version FROM conformance_counter WHERE project_id=? AND counter_id=?",
  args: [canonicalCommandProjectId, canonicalCommandAggregateId],
};

async function setCounter(transaction: LocalLibsqlTransaction, value: number): Promise<void> {
  const result = await transaction.execute({
    sql: "UPDATE conformance_counter SET value=?,entity_version=entity_version+1 WHERE project_id=? AND counter_id=?",
    args: [value, canonicalCommandProjectId, canonicalCommandAggregateId],
  });
  expect(result.rowsAffected).toBe(1);
  expect(transaction.closed).toBe(false);
}

async function configuredTransaction(client: LocalLibsqlClient): Promise<LocalLibsqlTransaction> {
  await client.execute("PRAGMA foreign_keys=ON");
  await client.execute("PRAGMA busy_timeout=5000");
  const transaction = await client.transaction("write");
  expect((await transaction.execute("PRAGMA foreign_keys")).rows).toEqual([[1]]);
  expect((await transaction.execute("PRAGMA busy_timeout")).rows).toEqual([[5000]]);
  return transaction;
}

it.each([
  { innerRollback: true, terminal: "commit", expected: [[3, 2]] },
  { innerRollback: false, terminal: "rollback", expected: [[0, 1]] },
  { innerRollback: false, terminal: "commit", expected: [[7, 2]] },
] as const)(
  "characterizes real worker savepoint rollback release and outer commit: $innerRollback / $terminal",
  async ({ innerRollback, terminal, expected }) => {
    const file = await createCanonicalCommandDatabase();
    const client = createWorkerLocalLibsqlClient(file, "generation");
    try {
      const transaction = await configuredTransaction(client);
      try {
        expect(transaction.closed).toBe(false);
        expect((await transaction.execute(selectCounter)).rows).toEqual([[0, 1]]);
        await transaction.execute("SAVEPOINT canonical_handler");
        expect(transaction.closed).toBe(false);
        await setCounter(transaction, 7);
        expect((await transaction.execute(selectCounter)).rows).toEqual([[7, 2]]);
        if (innerRollback) {
          await transaction.execute("ROLLBACK TO canonical_handler");
          expect(transaction.closed).toBe(false);
        }
        await transaction.execute("RELEASE canonical_handler");
        expect(transaction.closed).toBe(false);
        expect((await transaction.execute(selectCounter)).rows).toEqual(
          innerRollback ? [[0, 1]] : [[7, 2]],
        );
        await expect(transaction.execute("RELEASE missing_savepoint")).rejects.toThrow(
          "no such savepoint: missing_savepoint",
        );
        expect(transaction.closed).toBe(false);
        if (innerRollback) await setCounter(transaction, 3);
        await transaction[terminal]();
        expect(transaction.closed).toBe(true);
      } finally {
        await transaction.close();
      }
      const reader = createWorkerLocalLibsqlClient(file, "generation");
      try {
        expect((await reader.execute(selectCounter)).rows).toEqual(expected);
      } finally {
        await reader.close();
      }
    } finally {
      await client.close();
    }
  },
);

function writeConnectionProof(file: string) {
  const client = createWorkerLocalLibsqlClient(file, "generation");
  const transactions: LocalLibsqlTransaction[] = [];
  const closed: LocalLibsqlTransaction[] = [];
  const settings: unknown[] = [];
  const observed: LocalLibsqlClient = {
    execute: (statement, args) => client.execute(statement, args),
    close: () => client.close(),
    transaction: async (mode) => {
      expect(mode).toBe("write");
      expect(closed).toEqual(transactions);
      const transaction = await client.transaction(mode);
      transactions.push(transaction);
      settings.push({
        foreignKeys: (await transaction.execute("PRAGMA foreign_keys")).rows,
        busyTimeout: (await transaction.execute("PRAGMA busy_timeout")).rows,
      });
      return {
        get closed() {
          return transaction.closed;
        },
        execute: (statement, args) => transaction.execute(statement, args),
        commit: () => transaction.commit(),
        rollback: () => transaction.rollback(),
        close: async () => {
          await transaction.close();
          expect(transaction.closed).toBe(true);
          closed.push(transaction);
        },
      };
    },
  };
  return {
    observed,
    settings,
    poison: async (completed: number) => {
      expect(settings).toHaveLength(completed);
      expect(closed).toEqual(transactions);
      expect(transactions.every((transaction) => transaction.closed)).toBe(true);
      await client.execute("PRAGMA foreign_keys=OFF");
      await client.execute("PRAGMA busy_timeout=0");
      expect((await client.execute("PRAGMA foreign_keys")).rows).toEqual([[0]]);
      expect((await client.execute("PRAGMA busy_timeout")).rows).toEqual([[0]]);
    },
    expectClosed: () => {
      expect(closed).toHaveLength(5);
      expect(closed).toEqual(transactions);
      expect(transactions.every((transaction) => transaction.closed)).toBe(true);
    },
  };
}

it("configures every canonical write connection and retains unfinished ownership", async () => {
  const file = await createCanonicalCommandDatabase();
  const proof = writeConnectionProof(file);
  let receipt: typeof appliedReceipt | typeof unchangedReceipt = appliedReceipt;
  let event = 500;
  const factory = createCanonicalCommandRepositoryFactory({
    registry: createCanonicalCommandRegistry([createConformanceCounterCommand()]),
    openClient: () => proof.observed,
    sha256Text: async (value) => createHash("sha256").update(value).digest("hex"),
    createReceiptId: () => receipt.receiptId,
    createEventId: () => `77777777-7777-4777-8777-777777777${++event}`,
    now: () => receipt.settledAt,
    createHandoffId: () => "88888888-8888-4888-8888-888888888501",
    createRecoveryRecordId: () => "99999999-9999-4999-8999-999999999501",
  });
  try {
    await proof.poison(0);
    const activated = await factory.activate({
      canonicalDatabasePath: file,
      projectId: settlementRequest.projectId,
      activationId: settlementRequest.activationId,
      writerToken: WriterCapabilityTokenSchema.parse("1".repeat(64)),
      activatedAt: settlementT0,
    });
    expect(activated.status).toBe("activated");
    if (activated.status !== "activated") throw activated.error;
    const repository = activated.repository;
    await proof.poison(1);
    expect(await repository.settle(settlementText)).toEqual({ status: "settled", receipt });
    const applied = await settlementRows(file);
    expectAppliedRows(applied);
    await proof.poison(2);
    expect(await repository.settle(settlementText)).toEqual({ status: "settled", receipt });
    expect(await settlementRows(file)).toEqual(applied);
    receipt = unchangedReceipt;
    await proof.poison(3);
    expect(await repository.settle(unchangedText)).toEqual({ status: "settled", receipt });
    expectUnchangedRows(applied, await settlementRows(file));
    await proof.poison(4);
    expect(await repository.releaseFence("2026-09-05T12:00:04.000Z")).toEqual({
      status: "current",
    });
    proof.expectClosed();
    expect(proof.settings).toEqual(
      Array.from({ length: 5 }, () => ({ foreignKeys: [[1]], busyTimeout: [[5000]] })),
    );
    await repository.close();
  } finally {
    await proof.observed.close();
  }
});
