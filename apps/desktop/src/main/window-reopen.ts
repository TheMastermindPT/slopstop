import { Effect } from "effect";
import type { Logger } from "pino";

/** What the reopen rule reads from the app: its open windows, a window factory and the logger. */
export type WindowReopenPorts = Readonly<{
  windowCount: () => number;
  create: () => Promise<unknown>;
  logger: Pick<Logger, "error">;
}>;

/**
 * On `activate`, opens a window when none is open. A failed creation logs one error with a
 * code only; the app stays up, so the next `activate` tries again.
 */
export function reopenWindowWhenNoneIsOpen(ports: WindowReopenPorts): Effect.Effect<void> {
  return Effect.suspend(() => {
    if (ports.windowCount() > 0) return Effect.void;
    return Effect.tryPromise(() => ports.create()).pipe(
      Effect.asVoid,
      Effect.catch(() =>
        Effect.sync(() =>
          ports.logger.error({ code: "DESKTOP_WINDOW_CREATE_FAILED" }, "Window creation failed."),
        ),
      ),
    );
  });
}
