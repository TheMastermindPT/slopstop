import { Data, Effect, Schema } from "effect";
export const source = Promise.resolve(1);
export const planted = new Promise<number>((resolve) => resolve(1));
export const untyped = Effect.tryPromise({ try: () => source, catch: (cause) => cause });
// Effect waiver EW0: the canary's waived line; the gate's register does not scan the canary.
// @effect-diagnostics-next-line newPromise:off
export const waived = new Promise<number>((resolve) => resolve(2));
export const unbounded = Schema.Number;
class CanaryRefusal extends Data.TaggedError("CanaryRefusal") {}
const refusal = new CanaryRefusal();
export const refused = Effect.gen(function* () {
  yield* Effect.void;
  return yield* Effect.fail(refusal);
});
export class CanaryNativeError extends Error {}
