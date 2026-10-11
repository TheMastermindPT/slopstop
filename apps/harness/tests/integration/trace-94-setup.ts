import { monitorEventLoopDelay } from "node:perf_hooks";
import { beforeEach } from "vitest";
import { abortTest94, enterTest94, finishTest94 } from "./trace-94.js";

/** Main-thread event-loop delay of this fork; it cannot see inside the SQLite worker threads. */
const delay = monitorEventLoopDelay({ resolution: 10 });
delay.enable();

function eventLoop() {
  const ms = (nanoseconds: number) => nanoseconds / 1e6;
  return {
    minMs: ms(delay.min),
    meanMs: ms(delay.mean),
    p50Ms: ms(delay.percentile(50)),
    p99Ms: ms(delay.percentile(99)),
    maxMs: ms(delay.max),
  };
}

/** Runs a trace action without ever failing the test it observes. */
function quietly(action: () => void): void {
  try {
    action();
  } catch (error) {
    process.stderr.write(`#94 trace error: ${String(error)}\n`);
  }
}

function reasonOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

beforeEach(({ task, signal, onTestFinished }) => {
  quietly(() => {
    enterTest94({ id: task.id, name: task.fullName, file: task.file.name });
    delay.reset();
  });
  // Vitest aborts the signal at the timeout, before afterEach, while the body still runs.
  signal.addEventListener(
    "abort",
    () => {
      const outcome = reasonOf(signal.reason);
      quietly(() => abortTest94({ test: task.id, outcome, extra: { eventLoop: eventLoop() } }));
    },
    { once: true },
  );
  onTestFinished(({ task: finished }) => {
    const outcome = finished.result?.state ?? "unknown";
    quietly(() => finishTest94({ test: finished.id, outcome, extra: { eventLoop: eventLoop() } }));
  });
});
