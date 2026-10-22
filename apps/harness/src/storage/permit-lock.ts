import { Deferred, Effect } from "effect";

type Restore = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;

const acquire = Symbol("acquire");
const release = Symbol("release");

/**
 * A single-permit lock that serializes holders in strict arrival order.
 *
 * Release hands the permit to the head waiter in one synchronous step: it removes the waiter
 * from the queue and completes its `Deferred`, so a free permit is never exposed while a waiter
 * exists and a later arrival always queues behind it.
 */
class FairPermitLock {
  #held = false;
  readonly #waiters: Array<Deferred.Deferred<void>> = [];
  /** How many hand-offs are on the stack; a nested hand-off resumes its holder on a later task. */
  #handing = 0;

  /**
   * Takes the permit, waiting in arrival order. A holder handed the permit inside another
   * hand-off yields once before it runs, so a long queue of synchronous holders never nests.
   */
  [acquire](restore: Restore): Effect.Effect<void> {
    return Effect.suspend(() => {
      if (!this.#held) {
        this.#held = true;
        return Effect.void;
      }
      const waiter = Deferred.makeUnsafe<void>();
      this.#waiters.push(waiter);
      return restore(Deferred.await(waiter)).pipe(
        Effect.onInterrupt(() => Effect.sync(() => this.#abandon(waiter))),
        Effect.andThen(Effect.suspend(() => (this.#handing > 1 ? Effect.yieldNow : Effect.void))),
      );
    });
  }

  /** Frees the lock, or hands it to the head waiter, which resumes inline. */
  [release](): void {
    const next = this.#waiters.shift();
    if (next === undefined) {
      this.#held = false;
      return;
    }
    this.#handing += 1;
    try {
      Deferred.doneUnsafe(next, Effect.void);
    } finally {
      this.#handing -= 1;
    }
  }

  /** Leaves the queue; a waiter already handed the permit passes it on instead. */
  #abandon(waiter: Deferred.Deferred<void>): void {
    const index = this.#waiters.indexOf(waiter);
    if (index >= 0) this.#waiters.splice(index, 1);
    else this[release]();
  }
}

export type PermitLock = FairPermitLock;

export function createPermitLock(): PermitLock {
  return new FairPermitLock();
}

/** Runs an effect while holding the permit, which is released exactly once however it ends. */
export const withPermitEffect =
  (lock: PermitLock) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.andThen(
        lock[acquire](restore),
        restore(effect).pipe(Effect.ensuring(Effect.sync(() => lock[release]()))),
      ),
    );

/**
 * Runs a Promise operation while holding the permit; the permit is taken through Effect and
 * released exactly once when the operation settles, keeping its error identity. Temporary
 * Promise facade for callers that are not Effects yet (#123).
 */
export async function withPermit<Result>(
  lock: PermitLock,
  operation: () => Promise<Result>,
): Promise<Result> {
  await Effect.runPromise(Effect.uninterruptibleMask((restore) => lock[acquire](restore)));
  try {
    return await operation();
  } finally {
    lock[release]();
  }
}
