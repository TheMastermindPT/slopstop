import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, it, vi } from "vitest";
import { withRegistrationDatabase } from "../../src/registration/registry-database.js";
import { registryFailure } from "../../src/registration/registry-failure.js";
import type { LocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  createGatedFirstClientAuthority,
  migrationResourcesRoot,
} from "./application-database-gated-fixture.js";

// Fault hooks at the filesystem seam: each runs before a directory listing or an lstat, or
// decides when a directory creation settles.
const listing = vi.hoisted(() => ({
  hook: undefined as undefined | ((directory: string) => Promise<void>),
}));
const looking = vi.hoisted(() => ({
  hook: undefined as undefined | ((target: string) => Promise<void>),
}));
const building = vi.hoisted(() => ({
  hook: undefined as
    | undefined
    | ((directory: string, made: Promise<string | undefined>) => Promise<string | undefined>),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const readdir = async (...args: Parameters<typeof actual.readdir>) => {
    await listing.hook?.(String(args[0]));
    return actual.readdir(...args);
  };
  const lstat = async (...args: Parameters<typeof actual.lstat>) => {
    await looking.hook?.(String(args[0]));
    return actual.lstat(...args);
  };
  // Not async: the caller awaits the hook's own promise, with no extra tick in between.
  const mkdir = (...args: Parameters<typeof actual.mkdir>) => {
    const made = actual.mkdir(...args);
    return building.hook === undefined ? made : building.hook(String(args[0]), made);
  };
  return {
    ...actual,
    readdir,
    lstat,
    mkdir,
    default: { ...actual, readdir, lstat, mkdir },
  };
});

afterEach(() => {
  listing.hook = undefined;
  looking.hook = undefined;
  building.hook = undefined;
});

function settledWithin(promise: Promise<unknown>, milliseconds: number) {
  return Promise.race([
    promise.then(
      () => "settled" as const,
      () => "settled" as const,
    ),
    delay(milliseconds).then(() => "pending" as const),
  ]);
}

async function untilPresent(target: string, attempts = 200): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (
      await lstat(target).then(
        () => true,
        () => false,
      )
    )
      return;
    await delay(10);
  }
  throw new Error(`${target} did not appear: the race was not reproduced.`);
}

function verdict(operation: Promise<unknown>) {
  return operation.then(
    (value) => ({ status: "opened", value }),
    (error: unknown) => registryFailure(error),
  );
}

it("opens the registry when the authority's own fresh creation lands between the missing check and the witness check", async () => {
  const {
    root,
    authority: applicationDatabase,
    firstOpen,
    release,
  } = await createGatedFirstClientAuthority("slopstop-registry-witness-race-");
  const options = { applicationStorageRoot: root, migrationResourcesRoot, applicationDatabase };
  const databasePath = path.join(root, "application.db");
  try {
    const startupListing = verdict(withRegistrationDatabase(options, async () => "listed"));
    await firstOpen;
    // Before the fix, the add's look at the root let the listing's creation land in its
    // window. The add now joins that creation and never lists the root, so the bounded
    // fallback below opens the gate; the hook stays to reproduce the race on the old code.
    listing.hook = async (directory) => {
      if (path.resolve(directory) !== path.resolve(root)) return;
      listing.hook = undefined;
      release();
      await untilPresent(databasePath);
    };
    const add = verdict(withRegistrationDatabase(options, async () => "added"));
    // Bounded fallback: once no listing of the root happens, the gate opens here instead.
    await settledWithin(add, 500);
    release();
    expect(await Promise.all([startupListing, add])).toEqual([
      { status: "opened", value: "listed" },
      { status: "opened", value: "added" },
    ]);
  } finally {
    release();
    await applicationDatabase.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

type GatedAuthority = Awaited<ReturnType<typeof createGatedFirstClientAuthority>>;

async function withGatedRegistry(
  prefix: string,
  run: (
    gated: GatedAuthority,
    options: Parameters<typeof withRegistrationDatabase>[0],
  ) => Promise<void>,
) {
  const gated = await createGatedFirstClientAuthority(prefix);
  const options = {
    applicationStorageRoot: gated.root,
    migrationResourcesRoot,
    applicationDatabase: gated.authority,
  };
  try {
    await run(gated, options);
  } finally {
    gated.release();
    await gated.authority.stop();
    await rm(gated.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

it("exempts the authority's own creation in flight from the witness rule when two callers decide in turn", async () => {
  await withGatedRegistry("slopstop-registry-same-tick-", async (gated, options) => {
    const databasePath = path.join(gated.root, "application.db");
    let rootListings = 0;
    // Only a second look at the root (the exemption skipped) lets the creation land in it.
    listing.hook = async (directory) => {
      if (path.resolve(directory) !== path.resolve(gated.root)) return;
      rootListings += 1;
      if (rootListings !== 2) return;
      gated.release();
      await untilPresent(databasePath);
    };
    // Both start in the same tick, before the first creation is registered to join.
    const startupListing = verdict(withRegistrationDatabase(options, async () => "listed"));
    const add = verdict(withRegistrationDatabase(options, async () => "added"));
    await gated.firstOpen;
    await settledWithin(add, 500);
    // The second caller decided while the first creation was in flight: it opened its own.
    expect(gated.opens()).toBe(2);
    gated.release();
    expect(await Promise.all([startupListing, add])).toEqual([
      { status: "opened", value: "listed" },
      { status: "opened", value: "added" },
    ]);
  });
});

it("answers broken, not a witness, when the root cannot be listed", async () => {
  await withGatedRegistry("slopstop-registry-unlistable-", async (gated, options) => {
    gated.release();
    listing.hook = async (directory) => {
      if (path.resolve(directory) !== path.resolve(gated.root)) return;
      throw Object.assign(new Error("Injected access denial."), { code: "EACCES" });
    };
    expect(await verdict(withRegistrationDatabase(options, async () => "opened"))).toEqual({
      status: "broken",
      code: "INTERNAL_FAILURE",
    });
    await expect(lstat(path.join(gated.root, "application.db"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

it("lets callers that join an in-flight 'absent' answer create or stay absent by their own policy", async () => {
  await withGatedRegistry("slopstop-registry-joined-absent-", async (gated) => {
    gated.release();
    const databasePath = gated.authority.applicationDatabasePath;
    let hold: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      hold = resolve;
    });
    let reachLook: () => void = () => undefined;
    const looked = new Promise<void>((resolve) => {
      reachLook = resolve;
    });
    looking.hook = async (target) => {
      if (path.resolve(target) !== path.resolve(databasePath)) return;
      looking.hook = undefined;
      reachLook();
      await held;
    };
    const absent = gated.authority.ensureCurrent({ createIfMissing: false });
    await looked;
    const creating = gated.authority.openCurrent({ createIfMissing: true });
    const openOnly = gated.authority.openCurrent({ createIfMissing: false });
    hold();
    const [state, created, opened] = await Promise.all([absent, creating, openOnly]);
    await created?.close();
    expect({ state, created: created !== undefined, opened }).toEqual({
      state: "absent",
      created: true,
      opened: undefined,
    });
  });
});

it("lets an existing-only registry operation wait for another caller's fresh creation, then open", async () => {
  await withGatedRegistry("slopstop-registry-existing-only-wait-", async (gated, options) => {
    const creating = verdict(withRegistrationDatabase(options, async () => "created"));
    await gated.firstOpen;
    const existing = verdict(
      withRegistrationDatabase(options, async () => "existing", "existing-only"),
    );
    const early = await settledWithin(existing, 200);
    gated.release();
    expect({ early, results: await Promise.all([creating, existing]) }).toEqual({
      early: "pending",
      results: [
        { status: "opened", value: "created" },
        { status: "opened", value: "existing" },
      ],
    });
  });
});

it("lets an open-only caller that decides between a creation and its registration wait for it", async () => {
  await withGatedRegistry("slopstop-registry-open-only-window-", async (gated) => {
    let openOnly: Promise<LocalLibsqlClient | undefined> | undefined;
    // The creator holds its decision while the open-only caller passes its join and queues.
    listing.hook = async (directory) => {
      if (path.resolve(directory) !== path.resolve(gated.root)) return;
      listing.hook = undefined;
      openOnly = gated.authority.openCurrent({ createIfMissing: false });
    };
    const creator = gated.authority.openCurrent({ createIfMissing: true });
    await gated.firstOpen;
    if (openOnly === undefined) throw new Error("The open-only caller did not start.");
    const early = await settledWithin(openOnly, 200);
    gated.release();
    const [created, opened] = await Promise.all([creator, openOnly]);
    await created?.close();
    await opened?.close();
    expect({ early, opened: opened !== undefined }).toEqual({ early: "pending", opened: true });
  });
});

const missingRoots = [
  { name: "an empty root", prepareRoot: async () => undefined },
  {
    name: "an absent root",
    prepareRoot: async (root: string) => rm(root, { recursive: true, force: true }),
  },
] as const;

it.for(missingRoots)(
  "never creates a database for an existing-only operation on $name",
  async (missing) => {
    await withGatedRegistry("slopstop-registry-existing-only-missing-", async (gated, options) => {
      gated.release();
      await missing.prepareRoot(gated.root);
      expect(
        await verdict(withRegistrationDatabase(options, async () => "opened", "existing-only")),
      ).toEqual({ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" });
      await expect(lstat(path.join(gated.root, "application.db"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(gated.opens()).toBe(0);
    });
  },
);

it("keeps the registry's fresh creation joinable when Storage starts in the tick it is registered", async () => {
  await withGatedRegistry("slopstop-registry-storage-same-tick-", async (gated, options) => {
    let storage: Promise<"absent" | "current"> | undefined;
    // The root's creation settles; the registry's creation registers in the next job, and
    // Storage checks for an initialization in this one.
    building.hook = (directory, made) => {
      if (path.resolve(directory) !== path.resolve(gated.root)) return made;
      building.hook = undefined;
      return new Promise((settle, fail) => {
        made.then((value) => {
          settle(value);
          storage = gated.authority.ensureCurrent({ createIfMissing: false });
        }, fail);
      });
    };
    const creating = verdict(withRegistrationDatabase(options, async () => "created"));
    await gated.firstOpen;
    if (storage === undefined) throw new Error("Storage did not start.");
    const state = await storage;
    const existing = verdict(
      withRegistrationDatabase(options, async () => "existing", "existing-only"),
    );
    const early = await settledWithin(existing, 200);
    gated.release();
    expect({ state, early, results: await Promise.all([creating, existing]) }).toEqual({
      state: "absent",
      early: "pending",
      results: [
        { status: "opened", value: "created" },
        { status: "opened", value: "existing" },
      ],
    });
  });
});

const invalidRegistries = [
  {
    name: "a directory",
    place: async (databasePath: string) => mkdir(databasePath),
  },
  {
    name: "a junction",
    place: async (databasePath: string) => {
      const target = `${databasePath}-target`;
      await mkdir(target);
      await symlink(target, databasePath, "junction");
    },
  },
] as const;
const registryModes = ["initialize-or-open", "existing-only"] as const;

it.for(invalidRegistries.flatMap((invalid) => registryModes.map((mode) => ({ ...invalid, mode }))))(
  "refuses $name in place of application.db as broken in $mode mode",
  async (invalid) => {
    await withGatedRegistry("slopstop-registry-invalid-entry-", async (gated, options) => {
      gated.release();
      await invalid.place(path.join(gated.root, "application.db"));
      expect(
        await verdict(withRegistrationDatabase(options, async () => "opened", invalid.mode)),
      ).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
      expect(gated.opens()).toBe(0);
    });
  },
);
