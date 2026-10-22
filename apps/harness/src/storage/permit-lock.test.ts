import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { expect, it } from "vitest";
import { createPermitLock, type PermitLock, withPermitEffect } from "./permit-lock.js";

/** A holder that records its start, then runs its body while holding the lock. */
function holder(
  lock: PermitLock,
  starts: string[],
  name: string,
  body: Effect.Effect<void> = Effect.void,
) {
  return withPermitEffect(lock)(
    Effect.suspend(() => {
      starts.push(name);
      return body;
    }),
  );
}

/** True when a fresh caller takes the lock within the calling turn. */
function startsInSameTurn(lock: PermitLock): boolean {
  let started = false;
  Effect.runFork(withPermitEffect(lock)(Effect.sync(() => (started = true))));
  return started;
}

/** True when a gated holder hands the permit to its waiter before the gate's opener returns. */
function handsOffInline(lock: PermitLock): boolean {
  let ran = false;
  const gate = Deferred.makeUnsafe<void>();
  Effect.runFork(withPermitEffect(lock)(Deferred.await(gate)));
  Effect.runFork(withPermitEffect(lock)(Effect.sync(() => (ran = true))));
  Deferred.doneUnsafe(gate, Effect.void);
  return ran;
}

it("passes the permit in arrival order and skips an interrupted waiter", async () => {
  const lock = createPermitLock();
  const starts: string[] = [];
  const gate = Deferred.makeUnsafe<void>();
  const a = Effect.runPromise(holder(lock, starts, "A", Deferred.await(gate)));
  const b = Effect.runFork(holder(lock, starts, "B"));
  const c = Effect.runFork(holder(lock, starts, "C"));
  const d = Effect.runFork(holder(lock, starts, "D"));
  await Effect.runPromise(Fiber.interrupt(c));
  // Interrupting a queued waiter grants nobody while A holds.
  expect(starts).toEqual(["A"]);
  let e: Fiber.Fiber<void> | undefined;
  const released = a.then(() => {
    e = Effect.runFork(holder(lock, starts, "E"));
  });
  Deferred.doneUnsafe(gate, Effect.void);
  await released;
  if (e === undefined) throw new Error("E was not started");
  await Effect.runPromise(Fiber.joinAll([b, d, e]));
  expect(starts).toEqual(["A", "B", "D", "E"]);
  expect(Exit.hasInterrupts(await Effect.runPromise(Fiber.await(c)))).toBe(true);
  expect(startsInSameTurn(lock)).toBe(true);
});

it.each([
  ["head", ["B", "C"], ["A", "C"]],
  ["only", ["B"], ["A"]],
])("gives up the place of an interrupted %s waiter", async (_row, queued, expected) => {
  const lock = createPermitLock();
  const starts: string[] = [];
  const gate = Deferred.makeUnsafe<void>();
  const a = Effect.runFork(holder(lock, starts, "A", Deferred.await(gate)));
  const [interrupted, ...others] = queued.map((name) => Effect.runFork(holder(lock, starts, name)));
  if (interrupted === undefined) throw new Error("no queued waiter");
  await Effect.runPromise(Fiber.interrupt(interrupted));
  Deferred.doneUnsafe(gate, Effect.void);
  await Effect.runPromise(Fiber.joinAll([a, ...others]));
  expect(starts).toEqual(expected);
  expect(startsInSameTurn(lock)).toBe(true);
});

/** Counts holders whose body is running and records the highest count seen. */
function holderCounter() {
  const counter = { running: 0, peak: 0 };
  const track = <A, E>(events: string[], name: string, body: Effect.Effect<A, E>) =>
    Effect.suspend(() => {
      counter.running += 1;
      counter.peak = Math.max(counter.peak, counter.running);
      events.push(`${name} start`);
      return body;
    }).pipe(
      Effect.onExit(() =>
        Effect.sync(() => {
          counter.running -= 1;
          events.push(`${name} end`);
        }),
      ),
    );
  return { counter, track };
}

const failure = new Error("holder failed");
const defect = new Error("holder died");
const holderEndings: ReadonlyArray<
  readonly [
    string,
    Effect.Effect<string, Error>,
    "open" | "interrupt",
    (exit: Exit.Exit<string, Error>) => void,
  ]
> = [
  [
    "succeeds",
    Effect.succeed("kept"),
    "open",
    (exit) => expect(exit).toEqual(Exit.succeed("kept")),
  ],
  [
    "fails",
    Effect.fail(failure),
    "open",
    (exit) => {
      expect(Exit.hasFails(exit)).toBe(true);
      expect(Option.getOrUndefined(Exit.findErrorOption(exit))).toBe(failure);
    },
  ],
  [
    "dies",
    Effect.die(defect),
    "open",
    (exit) => {
      expect(Exit.hasDies(exit)).toBe(true);
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(defect);
    },
  ],
  [
    "is interrupted while holding",
    Effect.never,
    "interrupt",
    (exit) => {
      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
    },
  ],
];

it.each(holderEndings)(
  "leaves the lock free after a holder %s",
  async (_row, ending, end, check) => {
    const lock = createPermitLock();
    const events: string[] = [];
    const { counter, track } = holderCounter();
    const gate = Deferred.makeUnsafe<void>();
    const held = Effect.runFork(
      withPermitEffect(lock)(track(events, "H", Effect.andThen(Deferred.await(gate), ending))),
    );
    const waiting = Effect.runFork(withPermitEffect(lock)(track(events, "W", Effect.void)));
    expect(events).toEqual(["H start"]);
    if (end === "open") Deferred.doneUnsafe(gate, Effect.void);
    else await Effect.runPromise(Fiber.interrupt(held));
    check(await Effect.runPromise(Fiber.await(held)));
    await Effect.runPromise(Fiber.join(waiting));
    expect(events).toEqual(["H start", "H end", "W start", "W end"]);
    expect(counter.peak).toBe(1);
    expect(startsInSameTurn(lock)).toBe(true);
  },
);

it("queues a non-awaited re-entrant caller behind its holder", async () => {
  const lock = createPermitLock();
  const events: string[] = [];
  const { counter, track } = holderCounter();
  const gate = Deferred.makeUnsafe<void>();
  const first = Effect.runFork(withPermitEffect(lock)(Deferred.await(gate)));
  const held = Effect.runFork(
    withPermitEffect(lock)(
      track(
        events,
        "H",
        Effect.forkDetach(
          Effect.andThen(
            Effect.sync(() => events.push("R requested")),
            withPermitEffect(lock)(track(events, "R", Effect.void)),
          ),
          { startImmediately: true },
        ),
      ),
    ),
  );
  Deferred.doneUnsafe(gate, Effect.void);
  await Effect.runPromise(Fiber.join(first));
  const reentrant = await Effect.runPromise(Fiber.join(held));
  expect(await Effect.runPromise(Fiber.await(reentrant))).toEqual(Exit.succeed(undefined));
  expect(events).toEqual(["H start", "R requested", "H end", "R start", "R end"]);
  expect(counter.peak).toBe(1);
});

it("hands the permit through a long queue of synchronous holders", async () => {
  const lock = createPermitLock();
  const order: number[] = [];
  const gate = Deferred.makeUnsafe<void>();
  const first = Effect.runFork(withPermitEffect(lock)(Deferred.await(gate)));
  const indexes = Array.from({ length: 10_000 }, (_, index) => index);
  const waiters = indexes.map((index) =>
    Effect.runFork(
      withPermitEffect(lock)(
        Effect.sync(() => {
          order.push(index);
          return index;
        }),
      ),
    ),
  );
  Deferred.doneUnsafe(gate, Effect.void);
  // The first hand-off runs inline; only a nested one yields.
  expect(order).toEqual([0]);
  await Effect.runPromise(Fiber.join(first));
  const exits = await Effect.runPromise(
    Effect.forEach(waiters, Fiber.await).pipe(Effect.timeout("2 seconds")),
  );
  expect(exits).toEqual(indexes.map((index) => Exit.succeed(index)));
  expect(order).toEqual(indexes);
  // Once the queue has drained, a later hand-off on the same lock runs inline again.
  expect(handsOffInline(lock)).toBe(true);
  expect(startsInSameTurn(lock)).toBe(true);
});
