import { type Duration, Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { expect, it } from "vitest";
import { renameWhenReleased } from "./project-storage-rename-retry.js";

function codedError(code: string, attempt: number): Error {
  return Object.assign(new Error(`${code} on attempt ${attempt}.`), { code });
}

/**
 * A rename Effect that answers `answer(attempt)` on each call: an error to fail with, or
 * `undefined` to succeed. It counts its calls and keeps every error it failed with.
 */
function fakeRename(answer: (attempt: number) => Error | undefined) {
  const errors: Error[] = [];
  let calls = 0;
  const rename = Effect.suspend(() => {
    calls += 1;
    const error = answer(calls);
    if (error === undefined) return Effect.void;
    errors.push(error);
    return Effect.fail(error);
  });
  return { rename, calls: () => calls, errors };
}

/** Runs a row's program under the test clock: no row sleeps for real. */
function underTestClock<A, E>(program: Effect.Effect<A, E>): Promise<A> {
  return Effect.runPromise(Effect.provide(program, TestClock.layer()));
}

it("retries a held rename until it is released", async () => {
  const fake = fakeRename((attempt) => {
    if (attempt === 1) return codedError("EPERM", attempt);
    if (attempt === 2) return codedError("EBUSY", attempt);
    return undefined;
  });
  await underTestClock(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(renameWhenReleased(fake.rename, "win32"));
      yield* TestClock.adjust("49 millis");
      expect(fake.calls()).toBe(1);
      yield* TestClock.adjust("1 millis");
      expect(fake.calls()).toBe(2);
      yield* TestClock.adjust("50 millis");
      expect(fake.calls()).toBe(3);
      expect(Exit.isSuccess(yield* Fiber.await(fiber))).toBe(true);
    }),
  );
});

/**
 * Runs the policy on `platform` to its failure, moving the test clock by `advance` first when
 * given, then a further 1000 ms. Answers the failure, the calls made by then, and the calls after
 * the further 1000 ms.
 */
function failureOf(
  fake: ReturnType<typeof fakeRename>,
  platform: NodeJS.Platform,
  advance?: Duration.Input,
) {
  return underTestClock(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Effect.flip(renameWhenReleased(fake.rename, platform)));
      if (advance !== undefined) yield* TestClock.adjust(advance);
      const failure = yield* Fiber.join(fiber);
      const calls = fake.calls();
      yield* TestClock.adjust("1000 millis");
      return { failure, calls, callsLater: fake.calls() };
    }),
  );
}

it("gives up after ten attempts with the last failure", async () => {
  const fake = fakeRename((attempt) => codedError("EACCES", attempt));
  const run = await failureOf(fake, "win32", "450 millis");
  expect(run.failure).toBe(fake.errors[9]);
  expect([run.calls, run.callsLater]).toEqual([10, 10]);
});

const otherFailureRows = [
  { name: "ENOENT", error: codedError("ENOENT", 1) },
  { name: "EEXIST", error: codedError("EEXIST", 1) },
  { name: "no code", error: new Error("no code") },
];

it.each(otherFailureRows)("does not retry another failure: $name", async ({ error }) => {
  const fake = fakeRename(() => error);
  const run = await failureOf(fake, "win32");
  expect(run.failure).toBe(error);
  expect([run.calls, run.callsLater]).toEqual([1, 1]);
});

it("stops at another failure after a held one", async () => {
  const fake = fakeRename((attempt) =>
    attempt === 1 ? codedError("EPERM", attempt) : codedError("ENOENT", attempt),
  );
  const run = await failureOf(fake, "win32", "50 millis");
  expect(run.failure).toBe(fake.errors[1]);
  expect(run.failure).toMatchObject({ code: "ENOENT" });
  expect(run.calls).toBe(2);
});

const otherPlatformRows = [{ platform: "linux" as const }, { platform: "darwin" as const }];

it.each(otherPlatformRows)("tries once on another platform: $platform", async ({ platform }) => {
  const fake = fakeRename((attempt) => codedError("EPERM", attempt));
  const run = await failureOf(fake, platform);
  expect(run.failure).toBe(fake.errors[0]);
  expect([run.calls, run.callsLater]).toEqual([1, 1]);
});
