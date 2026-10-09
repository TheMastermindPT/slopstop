import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { createApplicationDatabaseAuthority } from "../../src/storage/application-database-authority.js";
import { ApplicationDatabaseFault } from "../../src/storage/application-database-migration.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  createGatedFirstClientAuthority,
  migrationResourcesRoot,
} from "./application-database-gated-fixture.js";

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

it("lets a later initializer join a fresh database still being created instead of failing", async () => {
  const { root, authority, firstOpen, release } = await createGatedFirstClientAuthority(
    "slopstop-application-authority-fresh-",
  );
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

it("lets openCurrent join an initialization already in flight", async () => {
  const { root, authority, firstOpen, release, opens } = await createGatedFirstClientAuthority(
    "slopstop-application-authority-join-",
  );
  try {
    const first = authority.ensureCurrent({ createIfMissing: true });
    await firstOpen;
    const joined = authority.openCurrent({ createIfMissing: true });
    expect(await settledWithin(joined, 200)).toBe("pending");
    expect(opens()).toBe(1);
    release();
    expect(await first).toBe("current");
    const client = await joined;
    await client?.close();
    expect({ client: client !== undefined, opens: opens() }).toEqual({ client: true, opens: 2 });
  } finally {
    release();
    await authority.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

it("refuses a missing database under a witnessed root on the registry path only", async () => {
  await withAuthority(async (authority, root) => {
    const marker = path.join(root, "prior-state-witness");
    await writeFile(marker, "preserved bytes");
    const refusal = authority.openCurrent({ createIfMissing: true });
    await expect(refusal).rejects.toBeInstanceOf(ApplicationDatabaseFault);
    await expect(refusal).rejects.toMatchObject({
      failure: { status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" },
    });
    await expect(lstat(authority.applicationDatabasePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    // Storage keeps its own prior-state witness checks, so its path still initializes.
    await expect(authority.ensureCurrent({ createIfMissing: true })).resolves.toBe("current");
    expect(await readFile(marker, "utf8")).toBe("preserved bytes");
  });
});

type GatedAuthority = Awaited<ReturnType<typeof createGatedFirstClientAuthority>>;

async function withGatedAuthority(
  prefix: string,
  run: (gated: GatedAuthority) => Promise<void>,
  firstFailure?: Error,
) {
  const gated = await createGatedFirstClientAuthority(prefix, firstFailure);
  try {
    await run(gated);
  } finally {
    gated.release();
    await gated.authority.stop();
    await rm(gated.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

it("lets Storage's ensureCurrent join the registry's fresh creation instead of racing it", async () => {
  await withGatedAuthority("slopstop-application-authority-storage-join-", async (gated) => {
    const registry = gated.authority.openCurrent({ createIfMissing: true });
    await gated.firstOpen;
    const storage = gated.authority.ensureCurrent({ createIfMissing: true });
    expect(await settledWithin(storage, 200)).toBe("pending");
    gated.release();
    const client = await registry;
    await client?.close();
    expect({ storage: await storage, opens: gated.opens() }).toEqual({
      storage: "current",
      opens: 1,
    });
  });
});

it("lets two Storage initializers started in the same tick share one fresh creation", async () => {
  await withGatedAuthority("slopstop-application-authority-same-tick-", async (gated) => {
    const first = gated.authority.ensureCurrent({ createIfMissing: true });
    const second = gated.authority.ensureCurrent({ createIfMissing: true });
    await gated.firstOpen;
    gated.release();
    expect({ states: await Promise.all([first, second]), opens: gated.opens() }).toEqual({
      states: ["current", "current"],
      opens: 1,
    });
  });
});

const joiners = [
  {
    name: "Storage's ensureCurrent",
    join: (authority: GatedAuthority["authority"]) =>
      authority.ensureCurrent({ createIfMissing: true }),
  },
  {
    name: "the registry's openCurrent",
    join: (authority: GatedAuthority["authority"]) =>
      authority.openCurrent({ createIfMissing: true }),
  },
] as const;

it.for(joiners)(
  "passes the registry's failed fresh creation on to $name and removes its empty file",
  async (joiner) => {
    const failure = new Error("Injected fresh creation failure.");
    await withGatedAuthority(
      "slopstop-application-authority-failed-join-",
      async (gated) => {
        const creator = gated.authority.openCurrent({ createIfMissing: true });
        await gated.firstOpen;
        const joined = joiner.join(gated.authority);
        gated.release();
        const [created, joinedResult] = await Promise.allSettled([creator, joined]);
        expect(created).toEqual({ status: "rejected", reason: failure });
        expect(joinedResult).toEqual({ status: "rejected", reason: failure });
        expect(gated.opens()).toBe(1);
        await expect(lstat(gated.authority.applicationDatabasePath)).rejects.toMatchObject({
          code: "ENOENT",
        });
      },
      failure,
    );
  },
);

it("ends the fresh-creation exemption when that creation fails", async () => {
  const failure = new Error("Injected fresh creation failure.");
  await withGatedAuthority(
    "slopstop-application-authority-failed-exemption-",
    async (gated) => {
      gated.release();
      await expect(gated.authority.openCurrent({ createIfMissing: true })).rejects.toBe(failure);
      await writeFile(path.join(gated.root, "prior-state-witness"), "preserved bytes");
      const refusal = gated.authority.openCurrent({ createIfMissing: true });
      await expect(refusal).rejects.toMatchObject({
        failure: { status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" },
      });
      await expect(lstat(gated.authority.applicationDatabasePath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
    failure,
  );
});

it("lets an open-only openCurrent wait for a fresh creation in flight, then open it", async () => {
  await withGatedAuthority("slopstop-application-authority-open-only-", async (gated) => {
    const creator = gated.authority.openCurrent({ createIfMissing: true });
    await gated.firstOpen;
    const openOnly = gated.authority.openCurrent({ createIfMissing: false });
    expect(await settledWithin(openOnly, 200)).toBe("pending");
    gated.release();
    const clients = await Promise.all([creator, openOnly]);
    for (const client of clients) await client?.close();
    expect(clients.map((client) => client !== undefined)).toEqual([true, true]);
  });
});
