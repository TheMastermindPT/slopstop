import os from "node:os";
import path from "node:path";
import { Cause, Effect, Exit, Scope } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import {
  advance,
  fakeClient,
  track,
} from "../../tests/integration/application-database-close-fixture.js";
import {
  ApplicationDatabaseCloseUnconfirmed,
  acquireApplicationDatabaseAuthority,
  createApplicationDatabaseAuthority,
} from "./application-database-authority.js";

afterEach(() => {
  vi.useRealTimers();
});

const unusedRoot = path.join(os.tmpdir(), "slopstop-application-authority-unit-unused");

/** An authority over a root it never touches: admission and stop use no disk. */
function diskFreeAuthority(closeDeadlineMs?: number) {
  return createApplicationDatabaseAuthority({
    applicationStorageRoot: unusedRoot,
    migrationResourcesRoot: unusedRoot,
    closeDeadlineMs,
  });
}

const closeMessage = "Project Storage application database close is unconfirmed.";

it.each([
  {
    name: "transaction left open",
    closeRejects: false,
    closeDeadlineMs: undefined,
    deadline: 1_000,
  },
  { name: "client close rejects", closeRejects: true, closeDeadlineMs: undefined, deadline: 1_000 },
  { name: "custom deadline 50 ms", closeRejects: false, closeDeadlineMs: 50, deadline: 50 },
])(
  "rejects an unconfirmed close at the deadline: $name",
  async ({ closeRejects, closeDeadlineMs, deadline }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const authority = diskFreeAuthority(closeDeadlineMs);
    const client = authority.admitClient(fakeClient(closeRejects));
    const transaction = await client.transaction("write");
    if (closeRejects) await expect(client.close()).rejects.toThrow("client close failed");
    const stopping = authority.stop();
    const seen = track(stopping);
    await advance(deadline - 1);
    expect(seen.state).toBe("pending");
    await advance(1);
    expect(seen.state).toBe("rejected");
    const unconfirmed = seen.value;
    expect(unconfirmed).toBeInstanceOf(ApplicationDatabaseCloseUnconfirmed);
    expect(unconfirmed).toMatchObject({
      _tag: "ApplicationDatabaseCloseUnconfirmed",
      message: closeMessage,
      deadlineMs: deadline,
    });
    await transaction.close();
    await advance(deadline);
    const again = authority.stop();
    expect(again).toBe(stopping);
    await expect(again).rejects.toBe(unconfirmed);
  },
);

const stoppedMessage = "Project Storage application database is stopped.";

it.each([
  { name: "no work" },
  { name: "drained at 500 ms" },
  { name: "after an unconfirmed stop" },
])(
  "confirms a close that drains before the deadline and keeps refusing work after stop: $name",
  async ({ name }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const authority = diskFreeAuthority();
    const client = authority.admitClient(fakeClient());
    if (name === "no work") {
      const seen = track(authority.stop());
      await advance(0);
      expect(seen.state).toBe("resolved");
      return;
    }
    const transaction = await client.transaction("write");
    const seen = track(authority.stop());
    if (name === "drained at 500 ms") {
      await advance(500);
      expect(seen.state).toBe("pending");
      await transaction.close();
      await advance(0);
      expect(seen.state).toBe("resolved");
      return;
    }
    await advance(1_000);
    expect(seen.state).toBe("rejected");
    // Observed after one turn, so an admission that waits instead of refusing shows as pending.
    const admission = track(client.transaction("write"));
    const initialization = track(authority.ensureCurrent({ createIfMissing: false }));
    await advance(0);
    expect(admission).toMatchObject({ state: "rejected", value: { message: stoppedMessage } });
    expect(initialization).toMatchObject({ state: "rejected", value: { message: stoppedMessage } });
  },
);

type NetRow =
  | "never stopped, no work"
  | "never stopped, lease held"
  | "stopped and confirmed"
  | "stopped, unconfirmed"
  | "withheld";

/** Prepares the authority as the row names it; returns what the row checks after the close. */
async function prepareNetRow(
  name: NetRow,
  authority: ReturnType<typeof createApplicationDatabaseAuthority>,
) {
  const client = authority.admitClient(fakeClient());
  if (name === "never stopped, lease held") await client.transaction("write");
  let stopping: Promise<void> | undefined;
  if (name === "stopped and confirmed") {
    stopping = authority.stop();
    await stopping;
  }
  if (name === "withheld") authority.withhold();
  if (name === "stopped, unconfirmed") {
    await client.transaction("write");
    stopping = authority.stop();
    const seen = track(stopping);
    await advance(1_000);
    expect(seen.state).toBe("rejected");
  }
  return { client, stopping };
}

/** Checks that the release died with the unconfirmed close and a late stop reports that error. */
async function expectDiedUnconfirmed(
  authority: ReturnType<typeof createApplicationDatabaseAuthority>,
  exit: Exit.Exit<void>,
) {
  expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
  expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(false);
  const defect = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
  expect(defect).toBeInstanceOf(ApplicationDatabaseCloseUnconfirmed);
  const late = track(authority.stop());
  await advance(0);
  expect(late.state).toBe("rejected");
  expect(late.value).toBe(defect);
}

it.each<{ name: NetRow; closesAfter: number; dies: boolean; admitsAfter: boolean }>([
  { name: "never stopped, no work", closesAfter: 0, dies: false, admitsAfter: false },
  { name: "never stopped, lease held", closesAfter: 1_000, dies: true, admitsAfter: false },
  { name: "stopped and confirmed", closesAfter: 0, dies: false, admitsAfter: false },
  { name: "stopped, unconfirmed", closesAfter: 0, dies: false, admitsAfter: false },
  { name: "withheld", closesAfter: 0, dies: false, admitsAfter: true },
])(
  "closes a never-stopped authority when its scope closes: $name",
  async ({ name, closesAfter, dies, admitsAfter }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const scope = Effect.runSync(Scope.make());
    const authority = Effect.runSync(
      Scope.provide(scope)(
        acquireApplicationDatabaseAuthority({
          applicationStorageRoot: unusedRoot,
          migrationResourcesRoot: unusedRoot,
        }),
      ),
    );
    const { client, stopping } = await prepareNetRow(name, authority);
    const closing = track(Effect.runPromise(Effect.exit(Scope.close(scope, Exit.void))));
    if (closesAfter > 0) {
      await advance(closesAfter - 1);
      expect(closing.state).toBe("pending");
      await advance(1);
    } else await advance(0);
    expect(closing.state).toBe("resolved");
    const exit = closing.value as Exit.Exit<void>;
    if (dies) await expectDiedUnconfirmed(authority, exit);
    else expect(exit).toEqual(Exit.void);
    if (stopping !== undefined) expect(authority.stop()).toBe(stopping);
    const admission = track(client.transaction("write"));
    await advance(0);
    if (admitsAfter) expect(admission.state).toBe("resolved");
    else expect(admission).toMatchObject({ state: "rejected", value: { message: stoppedMessage } });
  },
);
