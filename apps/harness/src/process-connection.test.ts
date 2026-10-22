import { expect, it, vi } from "vitest";
import type { StopHarnessRuntime } from "./harness-runtime.js";
import { HarnessRuntimeDisposeUnconfirmed } from "./process-bootstrap.js";
import { connectHarnessProcess } from "./process-connection.js";
import { ApplicationDatabaseCloseUnconfirmed } from "./storage/application-database-authority.js";

const P = "C:\\private\\project\\slopstop.db";
const bootstrap = { bootstrap: "message" };
const prepared = { roots: "checked" };

function fakeSink() {
  return { fatal: vi.fn(), exit: vi.fn() };
}

function expectFatalThenExit(sink: ReturnType<typeof fakeSink>) {
  expect(sink.exit.mock.calls).toEqual([[1]]);
  expect(sink.fatal.mock.invocationCallOrder[0]).toBeLessThan(
    sink.exit.mock.invocationCallOrder[0] ?? 0,
  );
  const serialized = JSON.stringify(sink.fatal.mock.calls);
  expect(serialized).not.toContain("private");
  expect(serialized).not.toContain("is unconfirmed");
  expect(serialized).not.toContain("Harness startup failed");
}

it("reports a startup failure with its code and summary: invalid bootstrap", async () => {
  const prepare = vi.fn((): typeof prepared => {
    throw new Error(P);
  });
  const launch = vi.fn();
  const attach = vi.fn();
  const sink = fakeSink();

  await expect(
    connectHarnessProcess({ bootstrap, prepare, launch, attach, sink }),
  ).resolves.toBeUndefined();

  expect(prepare).toHaveBeenCalledWith(bootstrap);
  expect(launch).not.toHaveBeenCalled();
  expect(attach).not.toHaveBeenCalled();
  expect(sink.fatal.mock.calls).toEqual([
    [
      { code: "HARNESS_START_FAILED", failures: [{ kind: "error" }], omittedFailures: 0 },
      "Harness received an invalid bootstrap message.",
    ],
  ]);
  expectFatalThenExit(sink);
});

it.each([
  {
    name: "runtime start and dispose fail",
    failure: () =>
      new AggregateError(
        [new Error(P), new HarnessRuntimeDisposeUnconfirmed(500)],
        "Harness startup failed.",
      ),
    failures: [{ kind: "error" }, { tag: "HarnessRuntimeDisposeUnconfirmed" }],
  },
  {
    name: "runtime start fails alone",
    failure: () => new ApplicationDatabaseCloseUnconfirmed(1000),
    failures: [{ tag: "ApplicationDatabaseCloseUnconfirmed" }],
  },
])("reports a startup failure with its code and summary: $name", async ({ failure, failures }) => {
  const prepare = vi.fn(() => prepared);
  const launch = vi.fn((_prepared: typeof prepared) => Promise.reject(failure()));
  const attach = vi.fn();
  const sink = fakeSink();

  await expect(
    connectHarnessProcess({ bootstrap, prepare, launch, attach, sink }),
  ).resolves.toBeUndefined();

  expect(launch).toHaveBeenCalledOnce();
  expect(launch.mock.calls[0]?.[0]).toBe(prepared);
  expect(attach).not.toHaveBeenCalled();
  expect(sink.fatal.mock.calls).toEqual([
    [
      { code: "HARNESS_RUNTIME_START_FAILED", failures, omittedFailures: 0 },
      "Harness runtime failed to start.",
    ],
  ]);
  expectFatalThenExit(sink);
});

it("reports a runtime start failure only after the launch settled", async () => {
  let rejectLaunch: (reason: unknown) => void = () => undefined;
  const launch = vi.fn(
    () =>
      new Promise<StopHarnessRuntime>((_resolve, reject) => {
        rejectLaunch = reject;
      }),
  );
  const sink = fakeSink();

  const connection = connectHarnessProcess({
    bootstrap,
    prepare: () => prepared,
    launch,
    attach: vi.fn(),
    sink,
  });
  await new Promise(setImmediate);

  expect(launch).toHaveBeenCalledOnce();
  expect(sink.fatal).not.toHaveBeenCalled();
  expect(sink.exit).not.toHaveBeenCalled();

  rejectLaunch(new Error(P));
  await connection;

  expect(sink.fatal).toHaveBeenCalledOnce();
  expectFatalThenExit(sink);
});

it("attaches the stop of a good start", async () => {
  const stop: StopHarnessRuntime = () => Promise.resolve();
  let launched = false;
  const launch = vi.fn(async () => {
    await Promise.resolve();
    launched = true;
    return stop;
  });
  const attach = vi.fn((_stop: StopHarnessRuntime) => {
    expect(launched).toBe(true);
  });
  const sink = fakeSink();

  await connectHarnessProcess({ bootstrap, prepare: () => prepared, launch, attach, sink });

  expect(attach).toHaveBeenCalledOnce();
  expect(attach.mock.calls[0]?.[0]).toBe(stop);
  expect(sink.fatal).not.toHaveBeenCalled();
  expect(sink.exit).not.toHaveBeenCalled();
});
