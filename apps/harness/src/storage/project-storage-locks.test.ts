import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { Deferred, Effect } from "effect";
import { expect, it } from "vitest";
import { createNodeProjectStorageDependencies } from "./project-storage-node-adapters.js";

const projectA = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-0000000000a1");
const projectB = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-0000000000b2");

/** The locks of a fresh Storage adapter; nothing touches disk until an operation does. */
function freshLocks() {
  return createNodeProjectStorageDependencies({
    applicationStorageRoot: "project-storage-locks-unused",
    migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
    applicationVersion: "0.0.0",
  }).locks;
}

/** A gate an operation waits on until the test opens it. */
function gate() {
  const deferred = Effect.runSync(Deferred.make<void>());
  return {
    wait: () => Effect.runPromise(Deferred.await(deferred)),
    open: () => Effect.runSync(Deferred.succeed(deferred, undefined)),
  };
}

/** Lets every queued permit hand-off and continuation run. */
async function settle() {
  for (let round = 0; round < 20; round += 1) await setImmediate();
}

/** An operation that records its start, waits on its gate (if any), then records its end. */
function recorded(events: string[], name: string, held?: ReturnType<typeof gate>) {
  return async () => {
    events.push(`${name} start`);
    if (held !== undefined) await held.wait();
    events.push(`${name} end`);
    return name;
  };
}

type Locks = ReturnType<typeof freshLocks>;
type Run = (locks: Locks, operation: () => Promise<string>) => Promise<string>;

const runCreate: Run = (locks, operation) => locks.forCreate(operation);
const runForProjectA: Run = (locks, operation) => locks.forProject(projectA, operation);
const runForProjectB: Run = (locks, operation) => locks.forProject(projectB, operation);

it.each([
  ["create operations", runCreate],
  ["one Project's operations", runForProjectA],
])("runs %s one at a time, in arrival order", async (_name, run) => {
  const locks = freshLocks();
  const events: string[] = [];
  const first = gate();
  const done = Promise.all([
    run(locks, recorded(events, "one", first)),
    run(locks, recorded(events, "two")),
  ]);
  await settle();
  expect(events).toEqual(["one start"]);
  first.open();
  expect(await done).toEqual(["one", "two"]);
  expect(events).toEqual(["one start", "one end", "two start", "two end"]);
});

it.each([
  ["create", runCreate],
  ["Project", runForProjectA],
])(
  "hands a released %s permit to the waiting caller before a later arrival",
  async (_name, run) => {
    const locks = freshLocks();
    const events: string[] = [];
    const held = gate();
    const first = run(locks, recorded(events, "held", held));
    const waiting = run(locks, recorded(events, "waiting"));
    const late = first.then(() => run(locks, recorded(events, "late")));
    await settle();
    held.open();
    await Promise.all([first, waiting, late]);
    expect(events).toEqual([
      "held start",
      "held end",
      "waiting start",
      "waiting end",
      "late start",
      "late end",
    ]);
  },
);

type Start = (locks: Locks, operation: () => Promise<void>) => Promise<void>;

it.each<[string, Start]>([
  ["create", (locks, operation) => locks.forCreate(operation)],
  ["drain", (locks, operation) => locks.afterCreateDrain(operation)],
  ["Project", (locks, operation) => locks.forProject(projectA, operation)],
])("starts a free %s operation only after the caller's synchronous code", async (_name, run) => {
  const locks = freshLocks();
  const events: string[] = [];
  const done = run(locks, async () => {
    events.push("op");
  });
  events.push("sync");
  for (let tick = 1; tick <= 4; tick += 1) {
    await Promise.resolve();
    events.push(`tick${tick}`);
  }
  await done;
  expect(events.join(",")).toBe("sync,tick1,op,tick2,tick3,tick4");
});

it("keeps a third same-Project caller waiting while the second still holds the permit", async () => {
  const locks = freshLocks();
  const events: string[] = [];
  const firstGate = gate();
  const secondGate = gate();
  const first = runForProjectA(locks, recorded(events, "one", firstGate));
  const second = runForProjectA(locks, recorded(events, "two", secondGate));
  await settle();
  firstGate.open();
  await first;
  await settle();
  const third = runForProjectA(locks, recorded(events, "three"));
  await settle();
  expect(events).toEqual(["one start", "one end", "two start"]);
  secondGate.open();
  await Promise.all([second, third]);
  expect(events).toEqual([
    "one start",
    "one end",
    "two start",
    "two end",
    "three start",
    "three end",
  ]);
});

it("drains every held and waiting create before the drain, and a later create waits for it", async () => {
  const locks = freshLocks();
  const events: string[] = [];
  const held = gate();
  const done = Promise.all([
    locks.forCreate(recorded(events, "held create", held)),
    locks.forCreate(recorded(events, "waiting create")),
    locks.afterCreateDrain(async () => {
      events.push("drain");
    }),
    locks.forCreate(recorded(events, "later create")),
  ]);
  await settle();
  expect(events).toEqual(["held create start"]);
  held.open();
  await done;
  expect(events).toEqual([
    "held create start",
    "held create end",
    "waiting create start",
    "waiting create end",
    "drain",
    "later create start",
    "later create end",
  ]);
});

it.each([
  [
    "a different Project's operation alongside a held Project operation",
    runForProjectA,
    runForProjectB,
  ],
  ["a Project operation alongside a held create", runCreate, runForProjectA],
])("runs %s", async (_name, runHeld, runOther) => {
  const locks = freshLocks();
  const events: string[] = [];
  const held = gate();
  const heldOperation = runHeld(locks, recorded(events, "held", held));
  await settle();
  expect(await runOther(locks, recorded(events, "other"))).toBe("other");
  expect(events).toEqual(["held start", "other start", "other end"]);
  held.open();
  await heldOperation;
});

it("shares no permit between two Storage adapters", async () => {
  const first = freshLocks();
  const second = freshLocks();
  const events: string[] = [];
  const held = gate();
  const create = first.forCreate(recorded(events, "first", held));
  const project = first.forProject(projectA, recorded(events, "first project", held));
  await settle();
  expect(await second.forCreate(recorded(events, "second"))).toBe("second");
  expect(await second.forProject(projectA, recorded(events, "second project"))).toBe(
    "second project",
  );
  held.open();
  await Promise.all([create, project]);
});

it("rejects with the operation's own error and releases the permit", async () => {
  const locks = freshLocks();
  const failure = new Error("operation failed");
  const failing = async () => {
    throw failure;
  };
  await expect(locks.forCreate(failing)).rejects.toBe(failure);
  expect(await locks.forCreate(async () => "next create")).toBe("next create");
  await expect(locks.afterCreateDrain(failing)).rejects.toBe(failure);
  expect(await locks.forCreate(async () => "after drain")).toBe("after drain");
  await expect(locks.forProject(projectA, failing)).rejects.toBe(failure);
  expect(await locks.forProject(projectA, async () => "next project")).toBe("next project");
});
