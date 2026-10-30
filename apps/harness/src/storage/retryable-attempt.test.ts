import { expect, it, vi } from "vitest";
import { UntypedRejection } from "../effect-rejection.js";
import { retryableAttempt } from "./retryable-attempt.js";

it("rejects with the very value the attempt rejected with", async () => {
  const attempt = retryableAttempt(() => Promise.reject("attempt refused"));
  await expect(attempt()).rejects.toBe("attempt refused");
});

it("rejects with the error a start threw, never its wrapper", async () => {
  const failure = new Error("start threw");
  const attempt = retryableAttempt(() => {
    throw failure;
  });
  const error = await attempt().catch((caught: unknown) => caught);
  expect(error).not.toBeInstanceOf(UntypedRejection);
  expect(error).toBe(failure);
});

it("starts again after a failed attempt", async () => {
  const start = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error("first attempt failed"))
    .mockResolvedValueOnce(undefined);
  const attempt = retryableAttempt(start);
  const first = attempt();
  await first.catch(() => undefined);
  const second = attempt();
  expect(second).not.toBe(first);
  await second;
  expect(start).toHaveBeenCalledTimes(2);
});

it("keeps a successful attempt as the answer", async () => {
  const start = vi.fn(async () => undefined);
  const attempt = retryableAttempt(start);
  const first = attempt();
  await first;
  expect(attempt()).toBe(first);
  expect(start).toHaveBeenCalledOnce();
});

it("gives a call made during the attempt the same promise", async () => {
  let inner: Promise<void> | undefined;
  const attempt = retryableAttempt(async () => {
    inner = attempt();
  });
  const outer = attempt();
  expect(inner).toBe(outer);
  await outer;
});
