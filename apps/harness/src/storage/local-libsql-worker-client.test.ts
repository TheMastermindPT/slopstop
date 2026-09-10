import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import { expect, it, vi } from "vitest";
import { createWorkerLocalLibsqlClient } from "./local-libsql-worker-client.js";

const execFileAsync = promisify(execFile);

function isClientCloseRequest(message: unknown): message is object {
  if (typeof message !== "object" || message === null) return false;
  if (!("operation" in message)) return false;
  return message.operation === "close-client";
}

it("retries a rejected worker client close without reopening the client", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-close-retry-"));
  const client = createWorkerLocalLibsqlClient(path.join(root, "retry.db"), "generation");
  await client.execute("SELECT 1");
  const original = Worker.prototype.postMessage;
  let worker: Worker | undefined;
  let closeRequests = 0;
  const posting = vi.spyOn(Worker.prototype, "postMessage").mockImplementation(function (
    this: Worker,
    message: unknown,
  ) {
    if (isClientCloseRequest(message)) {
      worker = this;
      closeRequests += 1;
      if (closeRequests === 1) {
        Reflect.apply(original, this, [{ ...message, clientId: 2147483647 }]);
        return;
      }
    }
    Reflect.apply(original, this, [message]);
  });
  try {
    const first = client.close();
    expect(client.close()).toBe(first);
    await expect(first).rejects.toThrow("Local libSQL client is unavailable.");
    expect(closeRequests).toBe(1);
    await expect(client.execute("SELECT 1")).rejects.toThrow("Local libSQL client is closed.");
    await expect(client.transaction("write")).rejects.toThrow("Local libSQL client is closed.");
    const retry = client.close();
    await expect(retry).resolves.toBeUndefined();
    expect(closeRequests).toBe(2);
    expect(client.close()).toBe(retry);
    expect(closeRequests).toBe(2);
  } finally {
    posting.mockRestore();
    const [cleanup] = await Promise.allSettled([client.close()]);
    if (cleanup?.status === "rejected") await worker?.terminate();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

it("keeps a failed real commit open for rollback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-libsql-transaction-"));
  const client = createWorkerLocalLibsqlClient(path.join(root, "transaction.db"), "generation");
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("CREATE TABLE parent (id TEXT PRIMARY KEY)");
    await client.execute(`CREATE TABLE child (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED
    )`);
    const transaction = await client.transaction("write");
    await transaction.execute({
      sql: "INSERT INTO child (id, parent_id) VALUES (?, ?)",
      args: ["child", "missing-parent"],
    });

    await expect(transaction.commit()).rejects.toThrow();
    expect(transaction.closed).toBe(false);
    await expect(transaction.rollback()).resolves.toBeUndefined();
    expect(transaction.closed).toBe(true);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

it("releases a request that cannot be posted to the worker", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-libsql-post-message-"));
  const client = createWorkerLocalLibsqlClient(path.join(root, "post-message.db"), "generation");
  const unref = vi.spyOn(Worker.prototype, "unref");
  try {
    const uncloneableStatement = { sql: "SELECT 1", args: [() => undefined] };
    await client.execute("SELECT 1");
    unref.mockClear();

    await expect(Reflect.apply(client.execute, client, [uncloneableStatement])).rejects.toThrow();
    expect(unref).toHaveBeenCalledOnce();
    await expect(client.execute("SELECT 1")).resolves.toMatchObject({ rows: [[1]] });
  } finally {
    unref.mockRestore();
    await client.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

it("does not keep a child process alive after an uncloneable request", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-libsql-child-exit-"));
  const moduleUrl = pathToFileURL(
    path.join(import.meta.dirname, "local-libsql-worker-client.ts"),
  ).href;
  const source = `
    void (async () => {
      const { createWorkerLocalLibsqlClient } = await import(${JSON.stringify(moduleUrl)});
      const client = createWorkerLocalLibsqlClient(
        ${JSON.stringify(path.join(root, "child-exit.db"))},
        "generation",
      );
      const statement = { sql: "SELECT 1", args: [() => undefined] };
      let rejected = false;
      try {
        await Reflect.apply(client.execute, client, [statement]);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error("Expected the uncloneable request to fail.");
      await client.close();
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  `;
  try {
    await expect(
      execFileAsync(process.execPath, ["--experimental-transform-types", "--eval", source], {
        cwd: root,
        timeout: 5_000,
      }),
    ).resolves.toBeDefined();
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

it("terminates a fatally invalid worker before replacing its native client", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-libsql-fatal-"));
  const actualTerminate = Worker.prototype.terminate;
  const terminations: Promise<number>[] = [];
  const terminate = vi.spyOn(Worker.prototype, "terminate").mockImplementation(function (
    this: Worker,
  ) {
    const termination = Reflect.apply(actualTerminate, this, []);
    terminations.push(termination);
    return termination;
  });
  let replacement: ReturnType<typeof createWorkerLocalLibsqlClient> | undefined;
  try {
    const failed = createWorkerLocalLibsqlClient(path.join(root, "fatal.db"), "application");
    await expect(failed.execute("SELECT 1")).resolves.toMatchObject({ rows: [[1]] });

    await expect(failed.execute("")).rejects.toThrow();
    await vi.waitFor(() => expect(terminate).toHaveBeenCalledOnce());
    await expect(terminations[0]).resolves.toBeTypeOf("number");

    replacement = createWorkerLocalLibsqlClient(path.join(root, "fatal.db"), "application");
    await expect(replacement.execute("SELECT 1")).resolves.toMatchObject({ rows: [[1]] });
  } finally {
    terminate.mockRestore();
    await replacement?.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
