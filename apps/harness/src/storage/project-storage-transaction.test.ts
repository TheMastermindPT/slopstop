import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkerLocalLibsqlClient } from "./local-libsql-worker-client.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  runClassifiedWriteTransaction,
  withWriteTransaction,
} from "./project-storage-transaction.js";

type FailureMode = "none" | "sync" | "async";
type Scenario = Readonly<{
  stage: "begin" | "body" | "commit" | "close" | "closed";
  delivery: "sync" | "async";
  closed: boolean;
  rollback: boolean;
  close: FailureMode;
}>;

function fail(mode: FailureMode, error: Error): Promise<void> {
  if (mode === "sync") throw error;
  if (mode === "async") return Promise.reject(error);
  return Promise.resolve();
}

function fixture(scenario: Scenario, primary = new Error("P")) {
  const beginError = new Error("B");
  const rollbackError = new Error("R");
  const closeError = new Error("C");
  const calls: string[] = [];
  const transaction = {
    closed: scenario.closed,
    commit() {
      calls.push("commit");
      return fail(scenario.stage === "commit" ? scenario.delivery : "none", primary);
    },
    rollback() {
      calls.push("rollback");
      return fail(scenario.rollback ? "async" : "none", rollbackError);
    },
    close() {
      calls.push("close");
      return fail(scenario.close, closeError);
    },
  };
  const client = {
    transaction(mode: "write") {
      calls.push(mode);
      if (scenario.stage === "begin") {
        return fail(scenario.delivery, beginError).then(() => transaction);
      }
      return Promise.resolve(transaction);
    },
  };
  function operation(received: typeof transaction) {
    expect(received).toBe(transaction);
    calls.push("body");
    return fail(scenario.stage === "body" ? scenario.delivery : "none", primary).then(
      () => "completed",
    );
  }
  return { client, operation, calls, primary, beginError, rollbackError, closeError };
}

type Fixture = ReturnType<typeof fixture>;

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function expectAggregate(error: unknown, errors: unknown[], message: string) {
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error("Missing aggregate");
  expect(error.message).toBe(message);
  expect(error.errors).toHaveLength(errors.length);
  errors.forEach((item, index) => {
    expect(error.errors[index]).toBe(item);
  });
}

function expectSecondary(error: unknown, f: Fixture, scenario: Scenario) {
  const rollbackFailed = !scenario.closed && scenario.rollback;
  if (rollbackFailed) {
    expect(error).toBeInstanceOf(ProjectStorageBrokenError);
    if (!(error instanceof ProjectStorageBrokenError)) throw new Error("Missing storage error");
    expect(error.message).toBe("Project Storage transaction rollback failed.");
    const errors = [f.primary, f.rollbackError];
    if (scenario.close !== "none") errors.push(f.closeError);
    expectAggregate(
      error.cause,
      errors,
      scenario.close === "none"
        ? "Project Storage transaction and rollback both failed."
        : "Project Storage transaction, rollback, and close all failed.",
    );
    return;
  }
  if (scenario.close === "none") {
    expect(error).toBe(f.primary);
    return;
  }
  expectAggregate(
    error,
    [f.primary, f.closeError],
    "Project Storage transaction and close both failed.",
  );
}

function expectFailure(error: unknown, f: Fixture, scenario: Scenario) {
  if (scenario.stage === "begin") {
    expect(error).toBe(f.beginError);
    return;
  }
  if (scenario.stage === "close") {
    expect(error).toBe(f.closeError);
    return;
  }
  expectSecondary(error, f, scenario);
}

function expectedCalls(scenario: Scenario) {
  if (scenario.stage === "begin") return ["write"];
  const calls = ["write", "body"];
  if (scenario.stage !== "body") calls.push("commit");
  if (["body", "commit"].includes(scenario.stage) && !scenario.closed) calls.push("rollback");
  return [...calls, "close"];
}

const failures: Scenario[] = [];
for (const stage of ["body", "commit"] as const) {
  for (const delivery of ["sync", "async"] as const) {
    for (const closed of [false, true]) {
      for (const rollback of [false, true]) {
        for (const close of ["none", "sync", "async"] as const) {
          failures.push({ stage, delivery, closed, rollback, close });
        }
      }
    }
  }
}
for (const delivery of ["sync", "async"] as const) {
  failures.push({ stage: "begin", delivery, closed: false, rollback: false, close: "none" });
  failures.push({ stage: "close", delivery, closed: false, rollback: false, close: delivery });
}
const success: Scenario = {
  stage: "closed",
  delivery: "async",
  closed: false,
  rollback: false,
  close: "none",
};

describe.each(["legacy", "classified"] as const)("%s characterization", (runner) => {
  const run: typeof withWriteTransaction = async (client, operation) => {
    if (runner === "legacy") return withWriteTransaction(client, operation);
    const outcome = await runClassifiedWriteTransaction(client, operation);
    if (outcome.status === "failed") throw outcome.error;
    return outcome.result;
  };
  it.each(failures)(
    "preserves $stage $delivery closed=$closed rollback=$rollback close=$close",
    async (scenario) => {
      const f = fixture(scenario);
      const error = await run(f.client, f.operation).catch((error: unknown) => error);
      expectFailure(error, f, scenario);
      expect(f.calls).toEqual(expectedCalls(scenario));
    },
  );

  it("preserves the successful result", async () => {
    const f = fixture(success);
    expect(await run(f.client, f.operation)).toBe("completed");
    expect(f.calls).toEqual(["write", "body", "commit", "close"]);
  });

  it.each([false, true])("preserves existing storage error aggregate=%s", async (aggregate) => {
    const b = new Error("B");
    const r = new Error("R");
    const primary = new ProjectStorageBrokenError("existing failure", {
      cause: aggregate ? new AggregateError([b, r], "existing aggregate") : b,
    });
    const f = fixture({ ...success, stage: "body", close: "sync" }, primary);
    const error = await run(f.client, f.operation).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ProjectStorageBrokenError);
    if (!(error instanceof ProjectStorageBrokenError)) throw new Error("Missing storage error");
    expect(error.message).toBe(primary.message);
    expectAggregate(
      error.cause,
      aggregate ? [b, r, f.closeError] : [primary, f.closeError],
      aggregate
        ? "Project Storage transaction, rollback, and close all failed."
        : "Project Storage transaction and close both failed.",
    );
  });

  it("waits for close acknowledgement", async () => {
    const entered = deferred();
    const close = deferred();
    const f = fixture(success);
    const transaction = await f.client.transaction("write");
    transaction.close = () => {
      entered.resolve();
      return close.promise;
    };
    let settled = false;
    const result = run({ transaction: async () => transaction }, f.operation);
    void result.then(() => {
      settled = true;
    });
    await entered.promise;
    await Promise.resolve();
    expect(settled).toBe(false);
    close.resolve();
    expect(await result).toBe("completed");
  });
});

describe("phase evidence", () => {
  it.each(failures)(
    "classifies primary write transaction phases without changing legacy failure identity: $stage $delivery closed=$closed rollback=$rollback close=$close",
    async (scenario) => {
      const f = fixture(scenario);
      const outcome = await runClassifiedWriteTransaction(f.client, f.operation);
      expect(outcome.status).toBe("failed");
      if (outcome.status !== "failed") throw new Error("Expected failure");
      expectFailure(outcome.error, f, scenario);
      expect(f.calls).toEqual(expectedCalls(scenario));
      const primary = {
        begin: f.beginError,
        body: f.primary,
        commit: f.primary,
        close: f.closeError,
        closed: f.primary,
      }[scenario.stage];
      const commit = {
        begin: "not-attempted",
        body: "not-attempted",
        commit: "uncertain",
        close: "acknowledged",
        closed: "acknowledged",
      }[scenario.stage];
      expect(outcome).toEqual({
        status: "failed",
        stage: scenario.stage,
        commit,
        primaryError: primary,
        error: outcome.error,
      });
      expect(outcome.primaryError).toBe(primary);
      f.calls.length = 0;
      const legacyError = await withWriteTransaction(f.client, f.operation).catch(
        (error: unknown) => error,
      );
      expectFailure(legacyError, f, scenario);
      expect(f.calls).toEqual(expectedCalls(scenario));
    },
  );

  it("acknowledges success only after commit and close", async () => {
    const f = fixture(success);
    expect(await runClassifiedWriteTransaction(f.client, f.operation)).toEqual({
      status: "succeeded",
      stage: "closed",
      commit: "acknowledged",
      result: "completed",
    });
  });
});

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
