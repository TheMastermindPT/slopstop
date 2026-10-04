import { Effect, Semaphore } from "effect";

// A single-permit Effect semaphore serializing Promise operations in arrival order.
export type PermitLock = Semaphore.Semaphore;

export function createPermitLock(): PermitLock {
  return Semaphore.makeUnsafe(1);
}

// Runs a Promise operation while holding the permit; the permit is taken through Effect
// and released exactly once when the operation settles, keeping its error identity.
export async function withPermit<Result>(
  lock: PermitLock,
  operation: () => Promise<Result>,
): Promise<Result> {
  await Effect.runPromise(Semaphore.take(lock, 1));
  try {
    return await operation();
  } finally {
    Effect.runSync(Semaphore.release(lock, 1));
  }
}
