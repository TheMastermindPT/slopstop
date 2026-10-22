import { setImmediate as nextTurn } from "node:timers/promises";
import { vi } from "vitest";
import type {
  LocalLibsqlClient,
  LocalLibsqlTransaction,
} from "../../src/storage/local-libsql-worker-client.js";

const notUsed = () => Promise.reject(new Error("Not used by the close tests."));

/**
 * A client whose one transaction stays open until the test closes it. Its own close rejects
 * when `closeRejects`, which keeps the lease, and otherwise releases it.
 */
export function fakeClient(closeRejects = false) {
  let closed = false;
  const transaction: LocalLibsqlTransaction = {
    get closed() {
      return closed;
    },
    execute: notUsed,
    commit: notUsed,
    rollback: notUsed,
    close: async () => {
      closed = true;
    },
  };
  const client: LocalLibsqlClient = {
    execute: notUsed,
    transaction: async () => transaction,
    close: () =>
      closeRejects ? Promise.reject(new Error("client close failed")) : Promise.resolve(),
  };
  return client;
}

/** Settlement of a promise as observed so far. */
export function track(promise: Promise<unknown>) {
  const seen: { state: "pending" | "resolved" | "rejected"; value?: unknown } = {
    state: "pending",
  };
  promise.then(
    (value) => Object.assign(seen, { state: "resolved", value }),
    (value) => Object.assign(seen, { state: "rejected", value }),
  );
  return seen;
}

/** Advances the faked timers, then lets every settled promise run its callbacks. */
export async function advance(milliseconds: number) {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await nextTurn();
}
