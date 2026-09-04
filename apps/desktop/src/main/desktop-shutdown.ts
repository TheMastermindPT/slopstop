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

  const stop = (): Promise<void> => {
    stopPromise ??= Promise.resolve().then(async () => {
      const failures: unknown[] = [];
      const attempt = (operation: () => void): void => {
        try {
          operation();
        } catch (error) {
          failures.push(error);
        }
      };

      attempt(options.stopProjectStorageBridge);
      attempt(options.stopWorkspaceBridge);
      try {
        await options.stopHarness();
      } catch (error) {
        failures.push(error);
      }
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
