import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { Deferred, Effect, Fiber } from "effect";
import { expect, expectTypeOf, it } from "vitest";
import { ProjectStorageLocks } from "./project-storage-locks.js";

const projectA = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-0000000000a1");
const projectB = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-0000000000b2");

type Locks = ProjectStorageLocks["Service"];
type Run = (locks: Locks, effect: Effect.Effect<string>) => Effect.Effect<string>;

const runCreate: Run = (locks, effect) => locks.forCreate(effect);
const runForProjectA: Run = (locks, effect) => locks.forProject(projectA, effect);
const runForProjectB: Run = (locks, effect) => locks.forProject(projectB, effect);

/** Runs a program against one fresh service built by its Layer. */
function withLocks<A, E>(program: (locks: Locks) => Effect.Effect<A, E>) {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* program(yield* ProjectStorageLocks);
    }).pipe(Effect.provide(ProjectStorageLocks.layer)),
  );
}

/** Lets every forked fiber run until it waits. */
const settle = Effect.gen(function* () {
  for (let round = 0; round < 20; round += 1) yield* Effect.yieldNow;
});

/** An effect that records its start, waits on its gate (if any), then records its end. */
function recorded(events: string[], name: string, gate?: Deferred.Deferred<void>) {
  return Effect.gen(function* () {
    events.push(`${name} start`);
    if (gate !== undefined) yield* Deferred.await(gate);
    events.push(`${name} end`);
    return name;
  });
}

it.each([
  ["create effects", runCreate],
  ["one Project's effects", runForProjectA],
])("runs %s one at a time, in arrival order", async (_name, run) => {
  const events: string[] = [];
  const result = await withLocks((locks) =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      const one = yield* Effect.forkChild(run(locks, recorded(events, "one", gate)));
      const two = yield* Effect.forkChild(run(locks, recorded(events, "two")));
      yield* settle;
      expect(events).toEqual(["one start"]);
      yield* Deferred.succeed(gate, undefined);
      return [yield* Fiber.join(one), yield* Fiber.join(two)];
    }),
  );
  expect(result).toEqual(["one", "two"]);
  expect(events).toEqual(["one start", "one end", "two start", "two end"]);
});

it.each([
  ["create", runCreate],
  ["Project", runForProjectA],
])("hands a released %s permit to the waiting fiber before a later fiber", async (_name, run) => {
  const starts: string[] = [];
  const started = (name: string) => Effect.sync(() => starts.push(name)).pipe(Effect.as(name));
  const result = await withLocks((locks) =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      const held = yield* Effect.forkChild(
        run(locks, Effect.andThen(started("held"), Deferred.await(gate)).pipe(Effect.as("held"))),
      );
      const waiting = yield* Effect.forkChild(run(locks, started("waiting")));
      yield* settle;
      yield* Deferred.succeed(gate, undefined);
      yield* Fiber.join(held);
      const late = yield* Effect.forkChild(run(locks, started("late")), {
        startImmediately: true,
      });
      return [yield* Fiber.join(waiting), yield* Fiber.join(late)];
    }),
  );
  expect(result).toEqual(["waiting", "late"]);
  expect(starts).toEqual(["held", "waiting", "late"]);
});

it("keeps a third same-Project effect waiting while the second still holds the permit", async () => {
  const events: string[] = [];
  await withLocks((locks) =>
    Effect.gen(function* () {
      const firstGate = yield* Deferred.make<void>();
      const secondGate = yield* Deferred.make<void>();
      const one = yield* Effect.forkChild(
        runForProjectA(locks, recorded(events, "one", firstGate)),
      );
      const two = yield* Effect.forkChild(
        runForProjectA(locks, recorded(events, "two", secondGate)),
      );
      yield* settle;
      yield* Deferred.succeed(firstGate, undefined);
      yield* Fiber.join(one);
      yield* settle;
      const three = yield* Effect.forkChild(runForProjectA(locks, recorded(events, "three")));
      yield* settle;
      expect(events).toEqual(["one start", "one end", "two start"]);
      yield* Deferred.succeed(secondGate, undefined);
      yield* Fiber.joinAll([two, three]);
    }),
  );
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
  const events: string[] = [];
  await withLocks((locks) =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      const fibers = [
        yield* Effect.forkChild(locks.forCreate(recorded(events, "held create", gate))),
        yield* Effect.forkChild(locks.forCreate(recorded(events, "waiting create"))),
        yield* Effect.forkChild(locks.afterCreateDrain(Effect.sync(() => events.push("drain")))),
        yield* Effect.forkChild(locks.forCreate(recorded(events, "later create"))),
      ];
      yield* settle;
      expect(events).toEqual(["held create start"]);
      yield* Deferred.succeed(gate, undefined);
      yield* Fiber.joinAll(fibers);
    }),
  );
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
  ["a different Project's effect alongside a held Project effect", runForProjectA, runForProjectB],
  ["a Project effect alongside a held create", runCreate, runForProjectA],
])("runs %s", async (_name, runHeld, runOther) => {
  const events: string[] = [];
  await withLocks((locks) =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      const held = yield* Effect.forkChild(runHeld(locks, recorded(events, "held", gate)));
      yield* settle;
      expect(yield* runOther(locks, recorded(events, "other"))).toBe("other");
      expect(events).toEqual(["held start", "other start", "other end"]);
      yield* Deferred.succeed(gate, undefined);
      yield* Fiber.join(held);
    }),
  );
});

it("shares no permit between two service values", async () => {
  const events: string[] = [];
  await Effect.runPromise(
    Effect.gen(function* () {
      const first = yield* ProjectStorageLocks.make;
      const second = yield* ProjectStorageLocks.make;
      const gate = yield* Deferred.make<void>();
      const held = [
        yield* Effect.forkChild(first.forCreate(recorded(events, "first", gate))),
        yield* Effect.forkChild(
          first.forProject(projectA, recorded(events, "first project", gate)),
        ),
      ];
      yield* settle;
      expect(yield* second.forCreate(recorded(events, "second"))).toBe("second");
      expect(yield* second.forProject(projectA, recorded(events, "second project"))).toBe(
        "second project",
      );
      yield* Deferred.succeed(gate, undefined);
      yield* Fiber.joinAll(held);
    }),
  );
});

it("fails with the effect's own error and releases the permit", async () => {
  const failure = new Error("effect failed");
  const failing = Effect.fail(failure);
  await withLocks((locks) =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(locks.forCreate(failing))).toBe(failure);
      expect(yield* locks.forCreate(Effect.succeed("next create"))).toBe("next create");
      expect(yield* Effect.flip(locks.afterCreateDrain(failing))).toBe(failure);
      expect(yield* locks.forCreate(Effect.succeed("after drain"))).toBe("after drain");
      expect(yield* Effect.flip(locks.forProject(projectA, failing))).toBe(failure);
      expect(yield* locks.forProject(projectA, Effect.succeed("next project"))).toBe(
        "next project",
      );
    }),
  );
});

it("exposes only the three lock operations", () => {
  expectTypeOf<keyof Locks>().toEqualTypeOf<"forCreate" | "afterCreateDrain" | "forProject">();
});
