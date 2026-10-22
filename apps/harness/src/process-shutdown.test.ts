import { expect, it, vi } from "vitest";
import { HarnessRuntimeDisposeUnconfirmed } from "./process-bootstrap.js";
import { createHarnessPortCloseHandler } from "./process-shutdown.js";

const P = "C:\\private\\project\\slopstop.db";

function shutdownFailure() {
  return new AggregateError(
    [new Error(P), new HarnessRuntimeDisposeUnconfirmed(500)],
    "Harness process shutdown failed.",
  );
}

function fakeSink() {
  return { fatal: vi.fn(), exit: vi.fn() };
}

it.each([
  { name: "rejects", stop: (failure: unknown) => () => Promise.reject(failure) },
  {
    name: "throws",
    stop: (failure: unknown) => () => {
      throw failure;
    },
  },
])("reports a failed shutdown with its summary, then exits: $name", async ({ stop }) => {
  const stopRuntime = vi.fn(stop(shutdownFailure()));
  const succeeded = vi.fn();
  const sink = fakeSink();
  const close = createHarnessPortCloseHandler({ stopRuntime, succeeded, sink });

  expect(() => {
    close();
    close();
  }).not.toThrow();

  await vi.waitFor(() => expect(sink.exit).toHaveBeenCalledOnce());
  expect(stopRuntime).toHaveBeenCalledOnce();
  expect(succeeded).not.toHaveBeenCalled();
  expect(sink.fatal.mock.calls).toEqual([
    [
      {
        code: "HARNESS_SHUTDOWN_FAILED",
        failures: [{ kind: "error" }, { tag: "HarnessRuntimeDisposeUnconfirmed" }],
        omittedFailures: 0,
      },
      "Harness shutdown failed.",
    ],
  ]);
  expect(sink.exit.mock.calls).toEqual([[1]]);
  expect(sink.fatal.mock.invocationCallOrder[0]).toBeLessThan(
    sink.exit.mock.invocationCallOrder[0] ?? 0,
  );
  const serialized = JSON.stringify(sink.fatal.mock.calls);
  expect(serialized).not.toContain("private");
  expect(serialized).not.toContain("is unconfirmed");
});

it("logs a clean shutdown without a fatal", async () => {
  const stopRuntime = vi.fn(() => Promise.resolve());
  const succeeded = vi.fn();
  const sink = fakeSink();
  const close = createHarnessPortCloseHandler({ stopRuntime, succeeded, sink });

  close();

  await vi.waitFor(() => expect(succeeded).toHaveBeenCalledOnce());
  expect(succeeded).toHaveBeenCalledWith("Harness message port closed.");
  expect(sink.fatal).not.toHaveBeenCalled();
  expect(sink.exit).not.toHaveBeenCalled();
});
