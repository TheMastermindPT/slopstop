import type { StopHarnessRuntime } from "./harness-runtime.js";

type HarnessShutdownObserverOptions = Readonly<{
  stopRuntime: StopHarnessRuntime;
  succeeded(message: "Harness message port closed."): void;
  failed(message: "Harness shutdown failed."): void;
}>;

export function createHarnessPortCloseHandler(options: HarnessShutdownObserverOptions): () => void {
  let shutdownObservation: Promise<void> | undefined;
  return () => {
    if (shutdownObservation !== undefined) {
      return;
    }
    shutdownObservation = Promise.resolve()
      .then(() => options.stopRuntime())
      .then(
        () => options.succeeded("Harness message port closed."),
        () => options.failed("Harness shutdown failed."),
      );
  };
}
