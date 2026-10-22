import { Data, Effect, Result } from "effect";
import { untypedRejection } from "./effect-rejection.js";

/** How long shutdown waits for the main runtime's dispose before it exits 1. */
const DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS = 1_000;

/** The main runtime's dispose did not settle within its deadline. */
class DesktopRuntimeDisposeUnconfirmed extends Data.TaggedError(
  "DesktopRuntimeDisposeUnconfirmed",
)<{ readonly deadlineMs: number }> {}

type DesktopBeforeQuitEvent = Readonly<{ preventDefault(): void }>;

export type DesktopShutdownController = Readonly<{
  stop(): Promise<void>;
  beforeQuit(event: DesktopBeforeQuitEvent): void;
  requestExit(code: number): Promise<void>;
  accepting(): boolean;
}>;

export function createDesktopShutdown(
  options: Readonly<{
    stopProjectStorageBridge(): void;
    stopWorkspaceBridge(): void;
    stopProjectEntryBridge(): void;
    stopHarness(): Promise<void>;
    dispose(): Promise<void>;
    /** Called once with the stop's failure, before the nonzero exit. */
    reportFailure(error: unknown): void;
    requestedExitCodeOnQuit?(): number | undefined;
    quit(): void;
    exit(code: number): void;
  }>,
): DesktopShutdownController {
  let stopPromise: Promise<void> | undefined;
  let terminalPromise: Promise<void> | undefined;
  let requestedExitCode: number | undefined;
  let allowQuit = false;
  // Closes in the turn shutdown starts and never opens again.
  let accepting = true;

  // The runtime's dispose, bounded: a miss is kept as its own failure.
  const disposeRuntime = Effect.tryPromise({
    try: () => options.dispose(),
    catch: untypedRejection,
  }).pipe(
    Effect.timeoutOrElse({
      duration: DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS,
      orElse: () =>
        Effect.fail(
          untypedRejection(
            new DesktopRuntimeDisposeUnconfirmed({
              deadlineMs: DESKTOP_RUNTIME_DISPOSE_DEADLINE_MS,
            }),
          ),
        ),
    }),
  );

  // Runs once: bridges stop first, then the harness, then the runtime's dispose; every failure
  // is kept in order and the program itself never fails.
  const shutdown = Effect.gen(function* () {
    const failures: unknown[] = [];
    const bridgeStops = [
      options.stopProjectStorageBridge,
      options.stopWorkspaceBridge,
      options.stopProjectEntryBridge,
    ];
    for (const stopBridge of bridgeStops) {
      const stopped = yield* Effect.result(
        Effect.try({ try: stopBridge, catch: untypedRejection }),
      );
      if (Result.isFailure(stopped)) failures.push(stopped.failure.cause);
    }
    const harness = yield* Effect.result(
      Effect.tryPromise({ try: () => options.stopHarness(), catch: untypedRejection }),
    );
    if (Result.isFailure(harness)) failures.push(harness.failure.cause);
    const disposed = yield* Effect.result(disposeRuntime);
    if (Result.isFailure(disposed)) failures.push(disposed.failure.cause);
    return failures;
  });

  const stop = (): Promise<void> => {
    accepting = false;
    // Starts one microtask after the caller's turn, as the desktop shutdown contract expects.
    stopPromise ??= Promise.resolve()
      .then(() => Effect.runPromise(shutdown))
      .then((failures) => {
        if (failures.length > 1) throw new AggregateError(failures, "Desktop shutdown failed.");
        if (failures.length === 1) throw failures[0];
      });
    return stopPromise;
  };

  const finish = (): Promise<void> => {
    terminalPromise ??= stop().then(
      () => {
        if (requestedExitCode !== undefined) {
          options.exit(requestedExitCode);
          return;
        }
        allowQuit = true;
        options.quit();
      },
      (error: unknown) => {
        // A report that throws never skips the exit. A failing reporter has no further
        // channel, and exit(1) already marks the failure (S6-L1 (a), §135).
        try {
          options.reportFailure(error);
        } catch {
        } finally {
          options.exit(1);
        }
      },
    );
    return terminalPromise;
  };

  const requestExit = (code: number): Promise<void> => {
    requestedExitCode ??= code;
    return finish();
  };

  return {
    stop,
    beforeQuit(event) {
      if (allowQuit) return;
      requestedExitCode ??= options.requestedExitCodeOnQuit?.();
      event.preventDefault();
      void finish();
    },
    requestExit,
    accepting: () => accepting,
  };
}
