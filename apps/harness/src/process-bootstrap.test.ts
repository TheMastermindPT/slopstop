import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createHandshakeCommand,
  createProjectRegistrationCommand,
  decodeStrict,
  HarnessRequestFailureLogLineSchema,
} from "@slopstop/protocol";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import {
  advance,
  fakeClient,
  track,
} from "../tests/integration/application-database-close-fixture.js";
import { silentHarnessLogger } from "../tests/integration/project-storage-runtime-fixture.js";
import { memoryLogDestination } from "../tests/integration/request-diagnostics-fixture.js";
import { UntypedRejection } from "./effect-rejection.js";
import { createHarnessLogger } from "./harness-logger.js";
import {
  ApplicationDatabase,
  HarnessRuntimeDisposeUnconfirmed,
  harnessServicesLayer,
  launchOnProcessRuntime,
  ProcessClock,
  startHarnessProcessRuntime,
} from "./process-bootstrap.js";
import { ApplicationDatabaseCloseUnconfirmed } from "./storage/application-database-authority.js";
import { systemUtcClock } from "./utc-clock.js";

afterEach(() => {
  vi.useRealTimers();
});

const stoppedMessage = "Project Storage application database is stopped.";

type Row = "never stopped, no work" | "never stopped, lease held" | "withheld" | "stopped";
type Authority = ApplicationDatabase["Service"];

/** Prepares the authority as the row names it; returns the stop promise of the `stopped` row. */
async function prepareRow(
  name: Row,
  authority: Authority,
  client: ReturnType<Authority["admitClient"]>,
) {
  if (name === "never stopped, lease held") await client.transaction("write");
  if (name === "withheld") authority.withhold();
  if (name !== "stopped") return undefined;
  const stopping = authority.stop();
  await stopping;
  return stopping;
}

/** Disposes the runtime and checks its settlement after `disposesAfter` ms. */
async function expectDisposal(
  runtime: { dispose(): Promise<void> },
  disposesAfter: number,
  rejects: boolean,
) {
  const disposing = track(runtime.dispose());
  if (disposesAfter > 0) {
    await advance(disposesAfter - 1);
    expect(disposing.state).toBe("pending");
  }
  await advance(disposesAfter > 0 ? 1 : 0);
  if (!rejects) {
    expect(disposing.state).toBe("resolved");
    return;
  }
  expect(disposing.state).toBe("rejected");
  expect(disposing.value).toBeInstanceOf(ApplicationDatabaseCloseUnconfirmed);
  expect(disposing.value).toMatchObject({
    _tag: "ApplicationDatabaseCloseUnconfirmed",
    deadlineMs: 1_000,
  });
}

it.each<{ name: Row; disposesAfter: number; rejects: boolean; admitsAfter: boolean }>([
  { name: "never stopped, no work", disposesAfter: 0, rejects: false, admitsAfter: false },
  { name: "never stopped, lease held", disposesAfter: 1_000, rejects: true, admitsAfter: false },
  { name: "withheld", disposesAfter: 0, rejects: false, admitsAfter: true },
  { name: "stopped", disposesAfter: 0, rejects: false, admitsAfter: false },
])(
  "runs the application database safety net when the process runtime is disposed: $name",
  async ({ name, disposesAfter, rejects, admitsAfter }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const base = path.join(os.tmpdir(), `slopstop-process-bootstrap-unit-${randomUUID()}`);
    const roots = {
      applicationStorageRoot: path.join(base, "storage"),
      migrationResourcesRoot: path.join(base, "migrations"),
    };
    const runtime = ManagedRuntime.make(harnessServicesLayer(roots, silentHarnessLogger));
    const authority = runtime.runSync(
      Effect.gen(function* () {
        return yield* ApplicationDatabase;
      }),
    );
    const client = authority.admitClient(fakeClient());
    const stopping = await prepareRow(name, authority, client);
    await expectDisposal(runtime, disposesAfter, rejects);
    if (stopping !== undefined) expect(authority.stop()).toBe(stopping);
    const admission = track(client.transaction("write"));
    await advance(0);
    expect(admission).toMatchObject(
      admitsAfter
        ? { state: "resolved" }
        : { state: "rejected", value: { message: stoppedMessage } },
    );
    expect(existsSync(base)).toBe(false);
  },
);

it("gives a process started without a clock the system clock", async () => {
  const base = path.join(os.tmpdir(), `slopstop-process-bootstrap-unit-${randomUUID()}`);
  const roots = {
    applicationStorageRoot: path.join(base, "storage"),
    migrationResourcesRoot: path.join(base, "migrations"),
  };
  const runtime = ManagedRuntime.make(harnessServicesLayer(roots, silentHarnessLogger));
  try {
    const clock = runtime.runSync(
      Effect.gen(function* () {
        return yield* ProcessClock;
      }),
    );
    expect(clock).toBe(systemUtcClock);
  } finally {
    await runtime.dispose();
  }
});

/** A test service whose Layer release is the row's controlled Effect. */
class Released extends Context.Service<Released, Readonly<{ ready: true }>>()(
  "slopstop/harness/test/Released",
) {}

function releasedLayer(release: Effect.Effect<void>) {
  return Layer.effect(
    Released,
    Effect.acquireRelease(Effect.succeed({ ready: true as const }), () => release),
  );
}

const programFailure = new Error("private program stop failure");
const disposeFailure = new Error("private dispose failure");

/**
 * Launches on a runtime built first, so its release runs at dispose. `program` is the harness
 * stop, which shares one promise across calls as `startHarnessRuntime`'s does.
 */
function launchProgram(
  release: Effect.Effect<void>,
  program: () => Promise<void>,
  disposeDeadlineMs?: number,
) {
  let stopping: Promise<void> | undefined;
  return launchOnProcessRuntime({
    layer: releasedLayer(release),
    start: (runtime) => {
      runtime.runSync(Released);
      return () => {
        stopping ??= program();
        return stopping;
      };
    },
    ...(disposeDeadlineMs === undefined ? {} : { disposeDeadlineMs }),
  });
}

function expectDisposeUnconfirmed(error: unknown, deadlineMs: number) {
  expect(error).toBeInstanceOf(HarnessRuntimeDisposeUnconfirmed);
  expect(error).toMatchObject({
    _tag: "HarnessRuntimeDisposeUnconfirmed",
    message: "Harness runtime dispose is unconfirmed.",
    deadlineMs,
  });
}

function expectAggregate(error: unknown, message: string, first: unknown) {
  expect(error).toBeInstanceOf(AggregateError);
  expect(error).toMatchObject({ message });
  const errors = (error as AggregateError).errors;
  expect(errors).toHaveLength(2);
  expect(errors[0]).toBe(first);
  return errors[1];
}

/** A release that records when it ran, optionally after `delay` ms. */
function recordedRelease(delay?: number) {
  const seen = { released: false };
  const mark = Effect.sync(() => {
    seen.released = true;
  });
  return {
    seen,
    release: delay === undefined ? mark : Effect.sleep(delay).pipe(Effect.andThen(mark)),
  };
}

type Settled = Readonly<{ state: string; value?: unknown }>;

type ShutdownRow = Readonly<{
  name: string;
  make: () => Readonly<{
    release: Effect.Effect<void>;
    program: () => Promise<void>;
    disposeDeadlineMs?: number;
    /** Checked just before the stop settles. */
    beforeSettle?: () => void;
    check: (settled: Settled) => void;
  }>;
  settlesAt: number;
}>;

const rejectsWith = (value: unknown) => (settled: Settled) => {
  expect(settled.state).toBe("rejected");
  expect(settled.value).toBe(value);
};

const shutdownRows: readonly ShutdownRow[] = [
  {
    name: "both fail",
    settlesAt: 0,
    make: () => ({
      release: Effect.die(disposeFailure),
      program: () => Promise.reject(programFailure),
      check: (settled) => {
        expect(settled.state).toBe("rejected");
        expect(settled.value).not.toBeInstanceOf(UntypedRejection);
        const second = expectAggregate(
          settled.value,
          "Harness process shutdown failed.",
          programFailure,
        );
        expect(second).toBe(disposeFailure);
      },
    }),
  },
  {
    name: "only the dispose fails",
    settlesAt: 0,
    make: () => ({
      release: Effect.die(disposeFailure),
      program: () => Promise.resolve(),
      check: rejectsWith(disposeFailure),
    }),
  },
  {
    name: "only the program fails",
    settlesAt: 0,
    make: () => ({
      release: Effect.void,
      program: () => Promise.reject(programFailure),
      check: rejectsWith(programFailure),
    }),
  },
  {
    name: "the dispose never ends, the program fails",
    settlesAt: 50,
    make: () => ({
      release: Effect.never,
      program: () => Promise.reject(programFailure),
      disposeDeadlineMs: 50,
      check: (settled) => {
        expect(settled.state).toBe("rejected");
        const second = expectAggregate(
          settled.value,
          "Harness process shutdown failed.",
          programFailure,
        );
        expectDisposeUnconfirmed(second, 50);
      },
    }),
  },
  {
    name: "both succeed",
    settlesAt: 0,
    make: () => ({
      release: Effect.void,
      program: () => Promise.resolve(),
      check: (settled) => expect(settled.state).toBe("resolved"),
    }),
  },
  {
    name: "waits for the program before the dispose",
    settlesAt: 100,
    make: () => {
      const { seen, release } = recordedRelease();
      return {
        release,
        program: () => new Promise<void>((resolve) => setTimeout(resolve, 100)),
        beforeSettle: () => expect(seen.released).toBe(false),
        check: (settled) => {
          expect(seen.released).toBe(true);
          expect(settled.state).toBe("resolved");
        },
      };
    },
  },
];

it.each(shutdownRows)("aggregates the program and the dispose: $name", async (row) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { release, program, disposeDeadlineMs, beforeSettle, check } = row.make();
  const stop = await launchProgram(release, program, disposeDeadlineMs);
  const first = stop();
  const stopping = track(first);
  if (row.settlesAt > 0) {
    await advance(row.settlesAt - 1);
    expect(stopping.state).toBe("pending");
    beforeSettle?.();
  }
  await advance(row.settlesAt > 0 ? 1 : 0);
  check(stopping);
  expect(stop()).toBe(first);
});

const startupFailure = new Error("private startup failure");

/** Launches a start that builds the runtime, then throws `startupFailure`. */
function launchFailedStartup(release: Effect.Effect<void>) {
  return launchOnProcessRuntime({
    layer: releasedLayer(release),
    start: (runtime) => {
      runtime.runSync(Released);
      throw startupFailure;
    },
  });
}

type StartupRow = Readonly<{
  name: string;
  settlesAt: number;
  make: () => Readonly<{
    release: Effect.Effect<void>;
    released?: () => boolean;
    check: (error: unknown) => void;
  }>;
}>;

const startupRows: readonly StartupRow[] = [
  {
    name: "the dispose dies with ApplicationDatabaseCloseUnconfirmed",
    settlesAt: 0,
    make: () => {
      const unconfirmed = new ApplicationDatabaseCloseUnconfirmed(1_000);
      return {
        release: Effect.die(unconfirmed),
        check: (error) => {
          expect(error).not.toBeInstanceOf(UntypedRejection);
          expect(expectAggregate(error, "Harness startup failed.", startupFailure)).toBe(
            unconfirmed,
          );
        },
      };
    },
  },
  {
    name: "the dispose takes 10 ms",
    settlesAt: 10,
    make: () => {
      const { seen, release } = recordedRelease(10);
      return {
        release,
        released: () => seen.released,
        check: (error) => expect(error).toBe(startupFailure),
      };
    },
  },
  {
    name: "the dispose never ends",
    settlesAt: 500,
    make: () => ({
      release: Effect.never,
      check: (error) =>
        expectDisposeUnconfirmed(
          expectAggregate(error, "Harness startup failed.", startupFailure),
          500,
        ),
    }),
  },
];

it.each(startupRows)("reports a startup failure after a bounded dispose: $name", async (row) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { release, released, check } = row.make();
  let releasedAtRejection: boolean | undefined;
  const launching = track(
    launchFailedStartup(release).catch((error: unknown) => {
      releasedAtRejection = released?.();
      throw error;
    }),
  );
  if (row.settlesAt > 0) {
    await advance(row.settlesAt - 1);
    expect(launching.state).toBe("pending");
  }
  await advance(row.settlesAt > 0 ? 1 : 0);
  expect(launching.state).toBe("rejected");
  check(launching.value);
  if (released !== undefined) expect(releasedAtRejection).toBe(true);
});

it("rejects a launch with the very value a start threw", async () => {
  const launching = launchOnProcessRuntime({
    layer: releasedLayer(Effect.void),
    start: (runtime) => {
      runtime.runSync(Released);
      throw "startup refused";
    },
  });
  await expect(launching).rejects.toBe("startup refused");
});

it("rejects a stop with the very value the program rejected with", async () => {
  const stop = await launchProgram(Effect.void, () => Promise.reject("program refused"));
  await expect(stop()).rejects.toBe("program refused");
});

it("routes the process runtime through its edges: unsubscribe throws", async () => {
  const base = path.join(os.tmpdir(), `slopstop-process-bootstrap-unit-${randomUUID()}`);
  const unsubscribeFailure = new Error("private unsubscribe failure");
  const sent: unknown[] = [];
  let listener: ((message: unknown) => void) | undefined;
  const stop = await startHarnessProcessRuntime({
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(path.join(base, "storage")).href,
      migrationResourcesRootUrl: pathToFileURL(path.join(base, "migrations")).href,
    },
    transport: {
      send: (message) => sent.push(message),
      subscribe: (received) => {
        listener = received;
        return () => {
          throw unsubscribeFailure;
        };
      },
    },
    logger: silentHarnessLogger,
  });
  await expect(stop()).rejects.toBe(unsubscribeFailure);
  const request = createProjectRegistrationCommand(
    { messageId: "00000000-0000-4000-8000-000000000051", sentAt: "2026-10-18T12:00:00.000Z" },
    { step: "prepare-git" },
  );
  listener?.(request);
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  expect(sent).toMatchObject([
    {
      event: "request.failure",
      causationId: request.messageId,
      payload: { code: "HARNESS_INTERNAL_FAILURE", retryable: false },
    },
  ]);
  expect(existsSync(base)).toBe(false);
});

it("routes the process runtime through its edges: a failed ready answer writes one request-failure line", async () => {
  const base = path.join(os.tmpdir(), `slopstop-process-bootstrap-unit-${randomUUID()}`);
  const destination = memoryLogDestination();
  const sent: unknown[] = [];
  let failedReady = false;
  let listener: ((message: unknown) => void) | undefined;
  const stop = await startHarnessProcessRuntime({
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(path.join(base, "storage")).href,
      migrationResourcesRootUrl: pathToFileURL(path.join(base, "migrations")).href,
    },
    transport: {
      send: (message) => {
        if (!failedReady && Reflect.get(Object(message), "event") === "system.ready") {
          failedReady = true;
          throw new Error("C:\\private\\ready transport failure");
        }
        sent.push(message);
      },
      subscribe: (received) => {
        listener = received;
        return () => undefined;
      },
    },
    logger: createHarnessLogger(destination.stream),
  });
  try {
    const handshake = createHandshakeCommand(
      { messageId: "00000000-0000-4000-8000-000000000061", sentAt: "2026-10-26T12:00:00.000Z" },
      "0.0.0",
    );
    listener?.(handshake);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent).toMatchObject([
      {
        event: "request.failure",
        causationId: handshake.messageId,
        payload: { code: "HARNESS_INTERNAL_FAILURE", retryable: false },
      },
    ]);
    const requestLines = destination.lines.filter((line) =>
      line.includes('"code":"HARNESS_REQUEST_FAILED"'),
    );
    expect(requestLines).toHaveLength(1);
    expect(
      decodeStrict(HarnessRequestFailureLogLineSchema, JSON.parse(requestLines[0] ?? "")),
    ).toMatchObject({
      boundary: "harness.message",
      answered: "HARNESS_INTERNAL_FAILURE",
      failures: [{ kind: "error" }],
      omittedFailures: 0,
    });
  } finally {
    await stop();
  }
  expect(existsSync(base)).toBe(false);
});
