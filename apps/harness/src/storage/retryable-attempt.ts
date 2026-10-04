import { Deferred, Effect } from "effect";

// One in-flight attempt shared by every caller. A successful attempt stays the answer; a
// failed one is forgotten so the next call retries. The shared promise is published
// before the attempt starts, so a caller re-entering during it receives the same promise.
export function retryableAttempt(start: () => Promise<void>): () => Promise<void> {
  let current: Promise<void> | undefined;
  return () => {
    if (current !== undefined) return current;
    const completion = Deferred.makeUnsafe<void, unknown>();
    const attempt = Effect.runPromise(Deferred.await(completion));
    current = attempt;
    let started: Promise<void>;
    try {
      started = start();
    } catch (error) {
      started = Promise.reject(error);
    }
    started.then(
      () => {
        Deferred.doneUnsafe(completion, Effect.void);
      },
      (error: unknown) => {
        if (current === attempt) current = undefined;
        Deferred.doneUnsafe(completion, Effect.fail(error));
      },
    );
    return attempt;
  };
}
