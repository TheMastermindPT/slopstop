import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { reopenWindowWhenNoneIsOpen } from "./window-reopen.js";

function ports(windowCount: number, create: () => Promise<unknown>) {
  return { windowCount: () => windowCount, create: vi.fn(create), logger: { error: vi.fn() } };
}

it("logs a failed window reopen", async () => {
  const app = ports(0, () => Promise.reject(new Error("C:\\private\\window")));
  await Effect.runPromise(reopenWindowWhenNoneIsOpen(app));
  expect(app.create).toHaveBeenCalledOnce();
  expect(app.logger.error).toHaveBeenCalledExactlyOnceWith(
    { code: "DESKTOP_WINDOW_CREATE_FAILED" },
    "Window creation failed.",
  );
});

it("opens no window while one exists", async () => {
  const app = ports(1, () => Promise.resolve({}));
  await Effect.runPromise(reopenWindowWhenNoneIsOpen(app));
  expect(app.create).not.toHaveBeenCalled();
  expect(app.logger.error).not.toHaveBeenCalled();
});

it("opens a window when none exists", async () => {
  const app = ports(0, () => Promise.resolve({}));
  await Effect.runPromise(reopenWindowWhenNoneIsOpen(app));
  expect(app.create).toHaveBeenCalledOnce();
  expect(app.logger.error).not.toHaveBeenCalled();
});
