import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import type { IdentityQueryChildPort } from "../../src/registration/identity-query-child.js";
import * as journalModule from "../../src/registration/identity-query-journal.js";
import { createRepositoryIdentityQueryOwner } from "../../src/registration/repository-identity-query-owner.js";
import type { LocalLibsqlTransaction } from "../../src/storage/local-libsql-worker-client.js";
import * as databaseModule from "../../src/storage/local-libsql-worker-client.js";
import { switchDeferred } from "./project-storage-runtime-fixture.js";
import {
  consentRegistryOptions,
  createRepositoryTrustScenario,
} from "./registration-consent-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it.each([
  [9000, false, { status: "cancelled" }],
  [10000, false, { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" }],
  [
    9000,
    true,
    { status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED", trigger: "CANCELLED" },
  ],
] as const)(
  "preserves cancellation instant %i with cleanup-unconfirmed=%s",
  async (cancelAt, unconfirmed, expected) => {
    const scenario = await scenarioForLifecycle();
    const controller = new AbortController();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const child: IdentityQueryChildPort = {
      run: async (request, signal) => {
        await completedChild(() => {
          now = cancelAt;
          controller.abort();
          now = 11000;
        }).run(request, signal);
        if (unconfirmed) return { status: "cleanup-unconfirmed", trigger: "CANCELLED" };
        return {
          status: "cancelled",
          terminal: { exitCode: 1, stdoutClosed: true, stderrClosed: true, treeEmpty: true },
        };
      },
    };
    const owner = createRepositoryIdentityQueryOwner(
      scenario.registry,
      consentRegistryOptions(scenario.root),
      scenario.root,
      child,
    );
    try {
      expect(await owner.inspectInsideWorkTree(scenario.admission, controller.signal)).toEqual(
        expected,
      );
      expect(storedResult(scenario.root)).toEqual([
        { result_json: unconfirmed ? null : JSON.stringify(expected) },
      ]);
    } finally {
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);

async function scenarioForLifecycle() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-query-lifecycle-"));
  roots.push(root);
  const scenario = await createRepositoryTrustScenario(root);
  expect(
    await scenario.registry.decideRepositoryTrust({ ...scenario.trust, decision: "accepted" }),
  ).toEqual({ status: "recorded" });
  return { root, ...scenario };
}

function storedResult(root: string) {
  const database = new DatabaseSync(path.join(root, "installation/application.db"), {
    readOnly: true,
  });
  try {
    return database.prepare("SELECT result_json FROM registration_identity_query_attempts").all();
  } finally {
    database.close();
  }
}

function holdSettlement(afterCommit: boolean) {
  const entered = switchDeferred<void>();
  const release = switchDeferred<void>();
  const original = databaseModule.createWorkerLocalLibsqlClient;
  let held = false;
  const pause = async () => {
    if (held) return;
    held = true;
    entered.resolve();
    await release.promise;
  };
  vi.spyOn(databaseModule, "createWorkerLocalLibsqlClient").mockImplementation((...args) => {
    const client = original(...args);
    return {
      execute: (statement, values) => client.execute(statement, values),
      close: () => client.close(),
      transaction: async (mode) => {
        const transaction = await client.transaction(mode);
        let settlement = false;
        const wrapped: LocalLibsqlTransaction = {
          get closed() {
            return transaction.closed;
          },
          execute: async (statement, values) => {
            const result = await transaction.execute(statement, values);
            const sql = typeof statement === "string" ? statement : statement.sql;
            if (sql.includes("AND result_json IS ?")) {
              settlement = true;
              if (!afterCommit) await pause();
            }
            return result;
          },
          commit: async () => {
            await transaction.commit();
            if (settlement && afterCommit) await pause();
          },
          rollback: () => transaction.rollback(),
          close: () => transaction.close(),
        };
        return wrapped;
      },
    };
  });
  return { entered, release };
}

it.each(["update-close", "update-deadline", "committed-close", "committed-deadline"])(
  "rechecks settlement/publication while preserving committed history: %s",
  async (window) => {
    const scenario = await scenarioForLifecycle();
    const committed = window.startsWith("committed");
    const gate = holdSettlement(committed);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const owner = createRepositoryIdentityQueryOwner(
      scenario.registry,
      consentRegistryOptions(scenario.root),
      scenario.root,
      completedChild(),
    );
    const work = owner.inspectInsideWorkTree(scenario.admission);
    try {
      await gate.entered.promise;
      const success = { status: "query-observed", insideWorkTree: true };
      if (committed)
        expect(storedResult(scenario.root)).toEqual([{ result_json: JSON.stringify(success) }]);
      const deadline = window.endsWith("deadline");
      const closing = deadline ? undefined : owner.close();
      if (deadline) now = 10000;
      gate.release.resolve();
      const expected = deadline
        ? { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" }
        : { status: "cancelled" };
      expect(await work).toEqual(expected);
      expect(storedResult(scenario.root)).toEqual([
        { result_json: JSON.stringify(committed ? success : expected) },
      ]);
      if (closing !== undefined) expect(await closing).toEqual({ status: "closed" });
    } finally {
      gate.release.resolve();
      await work;
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);

// Controlled completed-child proof; these tests exercise real persistence and owner timing, not native execution.
function completedChild(afterOwned: () => void = () => undefined): IdentityQueryChildPort {
  return {
    run: async (request) => {
      await request.onOwned({
        platform: "win32",
        processId: 1234,
        creationTime100ns: "134000000000000000",
        jobName: `Local\\SlopStop.Registration.Observer.${request.observationId}`,
      });
      afterOwned();
      return {
        status: "exited",
        exitCode: 0,
        stdout: new TextEncoder().encode("true\n"),
        stderr: new Uint8Array(),
      };
    },
  };
}

it.each(["close", "deadline"] as const)(
  "does not settle late success when %s wins before final settlement",
  async (cause) => {
    const scenario = await scenarioForLifecycle();
    const entered = switchDeferred<void>();
    const release = switchDeferred<void>();
    const original = journalModule.createIdentityQueryJournal;
    vi.spyOn(journalModule, "createIdentityQueryJournal").mockImplementation((options) => {
      const journal = original(options);
      return {
        ...journal,
        settle: async (...args) => {
          entered.resolve();
          await release.promise;
          return journal.settle(...args);
        },
      };
    });
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const owner = createRepositoryIdentityQueryOwner(
      scenario.registry,
      consentRegistryOptions(scenario.root),
      scenario.root,
      completedChild(),
    );
    const work = owner.inspectInsideWorkTree(scenario.admission);
    try {
      await entered.promise;
      const closing = cause === "close" ? owner.close() : undefined;
      if (cause === "deadline") now = 10000;
      release.resolve();
      const expected =
        cause === "close"
          ? { status: "cancelled" }
          : { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" };
      expect(await work).toEqual(expected);
      expect(storedResult(scenario.root)).toEqual([{ result_json: JSON.stringify(expected) }]);
      if (closing !== undefined) expect(await closing).toEqual({ status: "closed" });
    } finally {
      release.resolve();
      await work;
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);
