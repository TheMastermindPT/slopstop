import { expect } from "vitest";

type Tester = Parameters<typeof expect.addEqualityTesters>[0][number];
type Same = (left: unknown, right: unknown) => boolean;

/** A cause counts when either side defines one. */
const sameCause = (a: Error, b: Error, same: Same): boolean =>
  (a.cause === undefined && b.cause === undefined) || same(a.cause, b.cause);

/** An aggregate's inner errors, compared when both sides are aggregates. */
const sameInnerErrors = (a: Error, b: Error, same: Same): boolean =>
  !(a instanceof AggregateError && b instanceof AggregateError) || same(a.errors, b.errors);

/**
 * Two errors are equal when they share a prototype, a name, a message, a cause and their own
 * enumerable fields. Vitest checks iterables before its own error rule, and Effect errors are
 * iterable, so without this tester two Effect errors with different messages compare equal.
 */
const errorEquality: Tester = function (a, b, customTesters) {
  if (!(a instanceof Error) || !(b instanceof Error)) return undefined;
  const same: Same = (left, right) => this.equals(left, right, customTesters);
  return (
    Object.getPrototypeOf(a) === Object.getPrototypeOf(b) &&
    a.name === b.name &&
    a.message === b.message &&
    sameCause(a, b, same) &&
    sameInnerErrors(a, b, same) &&
    same({ ...a }, { ...b })
  );
};

expect.addEqualityTesters([errorEquality]);
