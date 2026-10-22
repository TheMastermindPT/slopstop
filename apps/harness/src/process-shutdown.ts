import type { StopHarnessRuntime } from "./harness-runtime.js";
import { type HarnessFatalSink, reportHarnessFailure } from "./process-fatal-diagnostics.js";

type HarnessShutdownObserverOptions = Readonly<{
  stopRuntime: StopHarnessRuntime;
  succeeded(message: "Harness message port closed."): void;
  sink: HarnessFatalSink;
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
        (failure: unknown) =>
          reportHarnessFailure(
            options.sink,
            "HARNESS_SHUTDOWN_FAILED",
            "Harness shutdown failed.",
            failure,
          ),
      );
  };
}
