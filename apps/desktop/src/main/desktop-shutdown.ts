import { Effect, Result } from "effect";

type DesktopBeforeQuitEvent = Readonly<{ preventDefault(): void }>;

export type DesktopShutdownController = Readonly<{
  stop(): Promise<void>;
  beforeQuit(event: DesktopBeforeQuitEvent): void;
  requestExit(code: number): Promise<void>;
}>;

export function createDesktopShutdown(
  options: Readonly<{
    stopProjectStorageBridge(): void;
    stopWorkspaceBridge(): void;
    stopHarness(): Promise<void>;
    requestedExitCodeOnQuit?(): number | undefined;
    quit(): void;
    exit(code: number): void;
  }>,
): DesktopShutdownController {
  let stopPromise: Promise<void> | undefined;
  let terminalPromise: Promise<void> | undefined;
  let requestedExitCode: number | undefined;
  let allowQuit = false;

  // Runs once: bridges stop first, then the harness; every failure is kept and the
  // program itself never fails.
  const shutdown = Effect.gen(function* () {
    const failures: unknown[] = [];
    for (const stopBridge of [options.stopProjectStorageBridge, options.stopWorkspaceBridge]) {
      const stopped = yield* Effect.result(
        Effect.try({ try: stopBridge, catch: (error) => error }),
      );
      if (Result.isFailure(stopped)) failures.push(stopped.failure);
    }
    const harness = yield* Effect.result(
      Effect.tryPromise({ try: () => options.stopHarness(), catch: (error) => error }),
    );
    if (Result.isFailure(harness)) failures.push(harness.failure);
    return failures;
  });

  const stop = (): Promise<void> => {
    // Starts one microtask after the caller's turn, as the desktop shutdown contract expects.
    stopPromise ??= Promise.resolve()
      .then(() => Effect.runPromise(shutdown))
      .then((failures) => {
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) {
          throw new AggregateError(failures, "Desktop shutdown failed.");
        }
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
      () => options.exit(1),
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
      const exitCode = options.requestedExitCodeOnQuit?.();
      if (exitCode !== undefined) {
        requestedExitCode ??= exitCode;
      }
      event.preventDefault();
      void finish();
    },
    requestExit,
  };
}
