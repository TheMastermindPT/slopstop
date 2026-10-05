import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { createApplicationDatabaseAuthority } from "../../src/storage/application-database-authority.js";
import { ApplicationDatabaseFault } from "../../src/storage/application-database-migration.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";

const migrationResourcesRoot = path.resolve(import.meta.dirname, "../../drizzle");

async function withAuthority(
  run: (
    authority: ReturnType<typeof createApplicationDatabaseAuthority>,
    root: string,
  ) => Promise<void>,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-authority-unit-"));
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot,
  });
  try {
    await run(authority, root);
  } finally {
    await authority.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

function settledWithin(promise: Promise<unknown>, milliseconds: number) {
  return Promise.race([
    promise.then(() => "settled" as const),
    delay(milliseconds).then(() => "pending" as const),
  ]);
}

it("admits one application database write transaction until the worker confirms it closed", async () => {
  await withAuthority(async (authority) => {
    await expect(authority.ensureCurrent({ createIfMissing: true })).resolves.toBe("current");
    const first = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    const second = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    try {
      const held = await first.transaction("write");
      const waiting = second.transaction("write");
      expect(await settledWithin(waiting, 150)).toBe("pending");
      await held.commit();
      await held.close();
      const admitted = await waiting;
      await admitted.rollback();
      await admitted.close();
    } finally {
      await first.close();
      await second.close();
    }
  });
});

it("keeps a failed commit admitted until rollback and drains it before stopping", async () => {
  await withAuthority(async (authority) => {
    await authority.ensureCurrent({ createIfMissing: true });
    const client = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    const other = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    try {
      await client.execute("PRAGMA foreign_keys = ON");
      await client.execute("CREATE TABLE parent (id TEXT PRIMARY KEY)");
      await client.execute(
        "CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)",
      );
      const failing = await client.transaction("write");
      await failing.execute({
        sql: "INSERT INTO child (id, parent_id) VALUES (?, ?)",
        args: ["child", "missing-parent"],
      });
      await expect(failing.commit()).rejects.toThrow();
      expect(failing.closed).toBe(false);
      const waiting = other.transaction("write");
      expect(await settledWithin(waiting, 150)).toBe("pending");
      const stopping = authority.stop();
      expect(await settledWithin(stopping, 50)).toBe("pending");
      await failing.rollback();
      await failing.close();
      // Admission queued before stop is refused once it is granted; stop then completes.
      await expect(waiting).rejects.toThrow("Project Storage application database is stopped.");
      await expect(stopping).resolves.toBeUndefined();
      await expect(other.transaction("write")).rejects.toThrow(
        "Project Storage application database is stopped.",
      );
    } finally {
      await client.close();
      await other.close();
    }
  });
});

it("releases a client's admitted transaction once the worker confirms the client closed", async () => {
  await withAuthority(async (authority) => {
    await authority.ensureCurrent({ createIfMissing: true });
    const closing = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    const next = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    try {
      await closing.transaction("write");
      await closing.close();
      const admitted = next.transaction("write");
      expect(await settledWithin(admitted, 1_000)).toBe("settled");
      const transaction = await admitted;
      await transaction.rollback();
      await transaction.close();
      expect(await settledWithin(authority.stop(), 1_000)).toBe("settled");
    } finally {
      await next.close();
    }
  });
});

it("settles every stop request with the one drained shutdown", async () => {
  await withAuthority(async (authority) => {
    await authority.ensureCurrent({ createIfMissing: true });
    const client = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    try {
      const transaction = await client.transaction("write");
      const first = authority.stop();
      const second = authority.stop();
      await transaction.rollback();
      await transaction.close();
      expect(await settledWithin(Promise.all([first, second]), 1_000)).toBe("settled");
    } finally {
      await client.close();
    }
  });
});

it("drains an accepted initialization waiting before BEGIN before stop completes", async () => {
  await withAuthority(async (authority) => {
    await authority.ensureCurrent({ createIfMissing: true });
    const holder = authority.admitClient(
      createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
    );
    try {
      const held = await holder.transaction("write");
      let initializationSettled = false;
      const initialization = authority.ensureCurrent({ createIfMissing: true }).finally(() => {
        initializationSettled = true;
      });
      void initialization.catch(() => undefined);
      await delay(50);
      const stopping = authority.stop().then(() => initializationSettled);
      await held.rollback();
      await held.close();
      expect(await stopping).toBe(true);
      await expect(initialization).rejects.toThrow(
        "Project Storage application database is stopped.",
      );
    } finally {
      await holder.close();
    }
  });
});

it("lets a second initializer proceed while the first is still creating a fresh database", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-authority-fresh-"));
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reachOpen: () => void = () => undefined;
  const firstOpen = new Promise<void>((resolve) => {
    reachOpen = resolve;
  });
  let opens = 0;
  // The first client the authority opens is created only after the gate opens, holding the
  // first initializer between its missing-file policy and the file's creation.
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot,
    openClient: (databasePath) => {
      opens += 1;
      if (opens !== 1) return createWorkerLocalLibsqlClient(databasePath, "application");
      reachOpen();
      const real = gate.then(() => createWorkerLocalLibsqlClient(databasePath, "application"));
      return {
        execute: async (statement, args) => (await real).execute(statement, args),
        transaction: async (mode) => (await real).transaction(mode),
        close: async () => (await real).close(),
      };
    },
  });
  try {
    const registry = authority.openCurrent({ createIfMissing: true });
    await firstOpen;
    const storage = authority.ensureCurrent({ createIfMissing: true });
    release();
    const [opened, ensured] = await Promise.allSettled([registry, storage]);
    if (opened.status === "fulfilled") await opened.value?.close();
    expect({
      registry: opened.status,
      storage: ensured.status === "fulfilled" ? ensured.value : ensured.reason,
    }).toEqual({ registry: "fulfilled", storage: "current" });
  } finally {
    release();
    await authority.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

it("refuses to recreate an application database it already observed", async () => {
  await withAuthority(async (authority) => {
    await authority.ensureCurrent({ createIfMissing: true });
    await rm(authority.applicationDatabasePath, { maxRetries: 10, retryDelay: 50 });
    const refusal = authority.ensureCurrent({ createIfMissing: true });
    await expect(refusal).rejects.toBeInstanceOf(ApplicationDatabaseFault);
    await expect(refusal).rejects.toMatchObject({
      failure: { status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" },
    });
  });
});
