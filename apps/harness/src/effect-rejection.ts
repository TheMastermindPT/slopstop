import { Data } from "effect";

/**
 * A rejected or thrown value kept as a typed failure on an Effect's error channel. Where the
 * value leaves the Effect, `unwrapRejection` gives back the original value unchanged.
 *
 * Its twin is `apps/desktop/src/main/effect-rejection.ts`, an accepted `shared-vocab-union`
 * exception: apps never import each other, and the tag never crosses a process boundary.
 */
export class UntypedRejection extends Data.TaggedError("UntypedRejection")<{
  readonly cause: unknown;
}> {}

/** The `catch` of a pass-through `Effect.try` or `Effect.tryPromise`. */
export function untypedRejection(cause: unknown): UntypedRejection {
  return new UntypedRejection({ cause });
}

/** The original value of an `UntypedRejection`; any other value is returned as it is. */
export function unwrapRejection(failure: unknown): unknown {
  return failure instanceof UntypedRejection ? failure.cause : failure;
}
