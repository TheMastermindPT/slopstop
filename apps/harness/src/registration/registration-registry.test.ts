import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import {
  advance,
  fakeClient,
  track,
} from "../../tests/integration/application-database-close-fixture.js";
import {
  type ApplicationDatabaseAuthority,
  ApplicationDatabaseCloseUnconfirmed,
  createApplicationDatabaseAuthority,
} from "../storage/application-database-authority.js";
import { createRegistrationRegistry } from "./registration-registry.js";
import { applicationDatabaseFor } from "./registry-database.js";

afterEach(() => {
  vi.useRealTimers();
});

const stoppedMessage = "Project Storage application database is stopped.";

/** Options under a temporary root that no row creates; constructing an authority uses no disk. */
function diskFreeOptions() {
  const base = path.join(os.tmpdir(), `slopstop-registration-registry-unit-${randomUUID()}`);
  const options = {
    applicationStorageRoot: path.join(base, "storage"),
    migrationResourcesRoot: path.join(base, "migrations"),
  };
  return { base, options };
}

/** Holds a write lease on the authority; the returned function releases it. */
async function holdLease(authority: ApplicationDatabaseAuthority) {
  const transaction = await authority.admitClient(fakeClient()).transaction("write");
  return () => transaction.close();
}

/** Checks a new write through the authority after one turn: admitted, or refused as stopped. */
async function expectWrite(authority: ApplicationDatabaseAuthority, admitted: boolean) {
  const admission = track(authority.admitClient(fakeClient()).transaction("write"));
  await advance(0);
  expect(admission).toMatchObject(
    admitted ? { state: "resolved" } : { state: "rejected", value: { message: stoppedMessage } },
  );
}

it.each([
  { name: "idle", leaseHeld: false },
  { name: "lease held", leaseHeld: true },
])("never stops an injected authority: $name", async ({ leaseHeld }) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { base, options } = diskFreeOptions();
  const injected = createApplicationDatabaseAuthority(options);
  const stop = vi.spyOn(injected, "stop");
  const injectedOptions = { ...options, applicationDatabase: injected };
  const release = leaseHeld ? await holdLease(injected) : undefined;
  const stopping = track(createRegistrationRegistry(injectedOptions).stop());
  await advance(0);
  expect(stopping.state).toBe("resolved");
  expect(stop).not.toHaveBeenCalled();
  await release?.();
  await expectWrite(injected, true);
  expect(applicationDatabaseFor(injectedOptions)).toBe(injected);
  expect(existsSync(base)).toBe(false);
});

type Options = ReturnType<typeof diskFreeOptions>["options"];

/** Checks that the registry stop rejects with the authority's unconfirmed close in its aggregate. */
async function expectUnconfirmedAggregate(
  stopping: ReturnType<typeof track>,
  authority: ApplicationDatabaseAuthority,
) {
  expect(stopping.state).toBe("rejected");
  expect(stopping.value).toBeInstanceOf(AggregateError);
  expect((stopping.value as AggregateError).message).toBe(
    "Registration registry did not stop cleanly.",
  );
  const unconfirmed = await authority.stop().catch((error: unknown) => error);
  expect(unconfirmed).toBeInstanceOf(ApplicationDatabaseCloseUnconfirmed);
  expect(unconfirmed).toMatchObject({ deadlineMs: 1_000 });
  const errors = (stopping.value as AggregateError).errors;
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBe(unconfirmed);
}

const standaloneStopRows: ReadonlyArray<{
  name: string;
  check: (options: Options) => Promise<void>;
}> = [
  {
    name: "idle",
    check: async (options) => {
      const authority = applicationDatabaseFor(options);
      const stopping = track(createRegistrationRegistry(options).stop());
      await advance(0);
      expect(stopping.state).toBe("resolved");
      await expectWrite(authority, false);
    },
  },
  {
    name: "lease held",
    check: async (options) => {
      const authority = applicationDatabaseFor(options);
      const release = await holdLease(authority);
      const stopping = track(createRegistrationRegistry(options).stop());
      await advance(999);
      expect(stopping.state).toBe("pending");
      await advance(1);
      await expectUnconfirmedAggregate(stopping, authority);
      const outcome = stopping.value;
      await release();
      await advance(0);
      expect(stopping).toMatchObject({ state: "rejected" });
      expect(stopping.value).toBe(outcome);
    },
  },
  {
    name: "no standalone authority",
    check: async (options) => {
      const stopping = track(createRegistrationRegistry(options).stop());
      await advance(0);
      expect(stopping.state).toBe("resolved");
      await expectWrite(applicationDatabaseFor(options), true);
    },
  },
];

it.each(standaloneStopRows)(
  "stops the standalone authority of its options: $name",
  async ({ check }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { base, options } = diskFreeOptions();
    await check(options);
    expect(existsSync(base)).toBe(false);
  },
);

/** Checks that the options now get a fresh authority, not `old`, and that it admits a write. */
async function expectFreshAuthority(options: Options, old: ApplicationDatabaseAuthority) {
  const fresh = applicationDatabaseFor(options);
  expect(fresh).not.toBe(old);
  await expectWrite(fresh, true);
}

const freshAuthorityRows: ReadonlyArray<{
  name: string;
  check: (options: Options, old: ApplicationDatabaseAuthority) => Promise<void>;
}> = [
  {
    name: "after a confirmed stop",
    check: async (options, old) => {
      const stopping = track(createRegistrationRegistry(options).stop());
      await advance(0);
      expect(stopping.state).toBe("resolved");
      await expectFreshAuthority(options, old);
    },
  },
  {
    name: "after an unconfirmed stop",
    check: async (options, old) => {
      const release = await holdLease(old);
      const stopping = track(createRegistrationRegistry(options).stop());
      await advance(1_000);
      expect(stopping.state).toBe("rejected");
      await expectFreshAuthority(options, old);
      await release();
    },
  },
  {
    name: "during the drain",
    check: async (options, old) => {
      const release = await holdLease(old);
      const stopping = track(createRegistrationRegistry(options).stop());
      await advance(500);
      expect(stopping.state).toBe("pending");
      expect(applicationDatabaseFor(options)).toBe(old);
      await expectWrite(old, false);
      await advance(500);
      await release();
    },
  },
];

it.each(freshAuthorityRows)(
  "gives the same options a fresh authority once the stop settles: $name",
  async ({ check }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { base, options } = diskFreeOptions();
    await check(options, applicationDatabaseFor(options));
    expect(existsSync(base)).toBe(false);
  },
);

it("refuses registry work after stop", async () => {
  const { base, options } = diskFreeOptions();
  // A wrong source may reach the disk; the root assertion below is the pin, this is cleanup.
  onTestFinished(() => rm(base, { recursive: true, force: true }));
  const registry = createRegistrationRegistry(options);
  await registry.stop();
  const refusal = await registry.hasUnsettled().catch((error: unknown) => error);
  expect(refusal).toBeInstanceOf(Error);
  expect((refusal as Error).message).toBe("Registration registry is stopped.");
  expect(existsSync(base)).toBe(false);
});

it("waits for an in-flight admission before the database", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { base, options } = diskFreeOptions();
  const authority = applicationDatabaseFor(options);
  const release = await holdLease(authority);
  const authorityStop = authority.stop().catch((error: unknown) => error);
  const registry = createRegistrationRegistry(options);
  const admission = registry.hasUnsettled().catch((error: unknown) => error);
  const stopping = track(registry.stop());
  const refusal = await admission;
  expect(refusal).toMatchObject({ message: stoppedMessage });
  await advance(999);
  expect(stopping.state).toBe("pending");
  await advance(1);
  expect(stopping.state).toBe("rejected");
  expect(stopping.value).toBeInstanceOf(AggregateError);
  expect((stopping.value as AggregateError).message).toBe(
    "Registration registry did not stop cleanly.",
  );
  const unconfirmed = await authorityStop;
  expect(unconfirmed).toBeInstanceOf(ApplicationDatabaseCloseUnconfirmed);
  expect(unconfirmed).toMatchObject({ deadlineMs: 1_000 });
  const errors = (stopping.value as AggregateError).errors;
  expect(errors).toHaveLength(2);
  expect(errors[0]).toBe(refusal);
  expect(errors[1]).toBe(unconfirmed);
  await release();
  expect(existsSync(base)).toBe(false);
});
