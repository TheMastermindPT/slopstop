import { harnessFatalMessages } from "@slopstop/protocol";
import type { StopHarnessRuntime } from "./harness-runtime.js";
import { type HarnessFatalSink, reportHarnessFailure } from "./process-fatal-diagnostics.js";

type HarnessConnectionOptions<Prepared> = Readonly<{
  bootstrap: unknown;
  /** Checks the bootstrap message synchronously; it throws before any runtime exists. */
  prepare(bootstrap: unknown): Prepared;
  /** Starts the runtime; it rejects only after a failed start's bounded dispose settled. */
  launch(prepared: Prepared): Promise<StopHarnessRuntime>;
  attach(stop: StopHarnessRuntime): void;
  sink: HarnessFatalSink;
}>;

/** Starts the harness for one bootstrap message; a failed start is reported once, then exits. */
export async function connectHarnessProcess<Prepared>(
  options: HarnessConnectionOptions<Prepared>,
): Promise<void> {
  let prepared: Prepared;
  try {
    prepared = options.prepare(options.bootstrap);
  } catch (failure: unknown) {
    reportHarnessFailure(
      options.sink,
      "HARNESS_START_FAILED",
      harnessFatalMessages.invalidBootstrap,
      failure,
    );
    return;
  }
  let stop: StopHarnessRuntime;
  try {
    stop = await options.launch(prepared);
  } catch (failure: unknown) {
    reportHarnessFailure(
      options.sink,
      "HARNESS_RUNTIME_START_FAILED",
      harnessFatalMessages.runtimeStartFailed,
      failure,
    );
    return;
  }
  options.attach(stop);
}
