import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopShutdown } from "./desktop-shutdown.js";

/** The ports the B5 characterizations do not observe: they record nothing. */
const quietPorts = {
  stopProjectEntryBridge: () => {},
  dispose: () => Promise.resolve(),
  reportFailure: () => {},
};

function deferred(): Readonly<{ promise: Promise<void>; resolve(): void }> {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve() {
      if (resolvePromise === undefined) throw new Error("Deferred promise was not initialized.");
      resolvePromise();
    },
  };
}

describe("desktop shutdown", () => {
  it("retains ordered shutdown and allows only the post-stop quit re-entry", async () => {
    const harnessStop = deferred();
    const order: string[] = [];
    const quit = vi.fn();
    const exit = vi.fn();
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: () => order.push("project-storage"),
      stopWorkspaceBridge: () => order.push("workspace"),
      ...quietPorts,
      stopHarness: () => {
        order.push("harness");
        return harnessStop.promise;
      },
      quit,
      exit,
    });
    const firstEvent = { preventDefault: vi.fn() };
    const repeatedEvent = { preventDefault: vi.fn() };

    shutdown.beforeQuit(firstEvent);
    shutdown.beforeQuit(repeatedEvent);
    const retainedStop = shutdown.stop();
    expect(shutdown.stop()).toBe(retainedStop);
    await Promise.resolve();
    expect(order).toEqual(["project-storage", "workspace", "harness"]);
    expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
    expect(repeatedEvent.preventDefault).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();

    harnessStop.resolve();
    await retainedStop;
    expect(quit).toHaveBeenCalledOnce();
    const reentryEvent = { preventDefault: vi.fn() };
    shutdown.beforeQuit(reentryEvent);
    expect(reentryEvent.preventDefault).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("retains package exit until the same shutdown chain settles", async () => {
    const order: string[] = [];
    const exit = vi.fn();
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: () => order.push("project-storage"),
      stopWorkspaceBridge: () => order.push("workspace"),
      ...quietPorts,
      stopHarness: async () => {
        order.push("harness");
      },
      quit: vi.fn(),
      exit,
    });

    const firstExit = shutdown.requestExit(7);
    expect(shutdown.requestExit(9)).toBe(firstExit);
    await firstExit;
    expect(order).toEqual(["project-storage", "workspace", "harness"]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("maps a pending package smoke quit to one nonzero exit", async () => {
    const quit = vi.fn();
    const exit = vi.fn();
    const options = {
      stopProjectStorageBridge: vi.fn(),
      stopWorkspaceBridge: vi.fn(),
      ...quietPorts,
      stopHarness: async () => undefined,
      requestedExitCodeOnQuit: () => 1,
      quit,
      exit,
    };
    const shutdown = createDesktopShutdown(options);
    const event = { preventDefault: vi.fn() };

    shutdown.beforeQuit(event);
    await shutdown.stop();

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("attempts every cleanup and preserves failures in order", async () => {
    const projectStorageFailure = new Error("private Project Storage shutdown failure");
    const workspaceFailure = new Error("private Workspace shutdown failure");
    const harnessFailure = new Error("private harness shutdown failure");
    const order: string[] = [];
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: () => {
        order.push("project-storage");
        throw projectStorageFailure;
      },
      stopWorkspaceBridge: () => {
        order.push("workspace");
        throw workspaceFailure;
      },
      ...quietPorts,
      stopHarness: async () => {
        order.push("harness");
        throw harnessFailure;
      },
      quit: vi.fn(),
      exit: vi.fn(),
    });

    const failure = await shutdown.stop().catch((error: unknown) => error);

    expect(order).toEqual(["project-storage", "workspace", "harness"]);
    expect(failure).toBeInstanceOf(AggregateError);
    if (!(failure instanceof AggregateError)) {
      throw new Error("Expected aggregate Desktop shutdown failure.");
    }
    expect(failure).toMatchObject({ message: "Desktop shutdown failed." });
    expect(failure.errors).toEqual([projectStorageFailure, workspaceFailure, harnessFailure]);
  });

  it("falls back exactly once when quit shutdown fails", async () => {
    const shutdownFailure = new Error("private harness shutdown failure");
    const quit = vi.fn();
    const exit = vi.fn();
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: vi.fn(),
      stopWorkspaceBridge: vi.fn(),
      ...quietPorts,
      stopHarness: async () => {
        throw shutdownFailure;
      },
      quit,
      exit,
    });
    const firstEvent = { preventDefault: vi.fn() };
    const repeatedEvent = { preventDefault: vi.fn() };

    shutdown.beforeQuit(firstEvent);
    shutdown.beforeQuit(repeatedEvent);
    await expect(shutdown.stop()).rejects.toBe(shutdownFailure);
    await Promise.resolve();

    expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
    expect(repeatedEvent.preventDefault).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("maps a failed retained package shutdown to one nonzero exit", async () => {
    const exit = vi.fn();
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: vi.fn(),
      stopWorkspaceBridge: vi.fn(),
      ...quietPorts,
      stopHarness: async () => {
        throw new Error("private harness shutdown failure");
      },
      quit: vi.fn(),
      exit,
    });

    const exitPromise = shutdown.requestExit(0);
    expect(shutdown.requestExit(7)).toBe(exitPromise);
    await exitPromise;

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("lets an explicit exit supersede a pending quit without duplicating terminal action", async () => {
    const harnessStop = deferred();
    const quit = vi.fn();
    const exit = vi.fn();
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: vi.fn(),
      stopWorkspaceBridge: vi.fn(),
      ...quietPorts,
      stopHarness: () => harnessStop.promise,
      quit,
      exit,
    });

    shutdown.beforeQuit({ preventDefault: vi.fn() });
    const exitPromise = shutdown.requestExit(7);
    harnessStop.resolve();
    await exitPromise;

    expect(quit).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("uses one nonzero fallback when quit and explicit exit share a failed stop", async () => {
    const quit = vi.fn();
    const exit = vi.fn();
    const shutdown = createDesktopShutdown({
      stopProjectStorageBridge: vi.fn(),
      stopWorkspaceBridge: vi.fn(),
      ...quietPorts,
      stopHarness: async () => {
        throw new Error("private harness shutdown failure");
      },
      quit,
      exit,
    });

    shutdown.beforeQuit({ preventDefault: vi.fn() });
    await shutdown.requestExit(7);

    expect(quit).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});

type ShutdownOptions = Parameters<typeof createDesktopShutdown>[0];

/**
 * A controller whose callbacks record into `order`; the entry stop records nothing (B1). `create`
 * lets a row use a freshly imported module, so a mutant in its module-level code is live in it.
 */
function recording(
  order: string[] = [],
  overrides: Partial<ShutdownOptions> = {},
  create: typeof createDesktopShutdown = createDesktopShutdown,
) {
  const quit = vi.fn(() => {
    order.push("quit");
  });
  const exit = vi.fn((code: number) => {
    order.push(`exit:${code}`);
  });
  const shutdown = create({
    stopProjectStorageBridge: () => {
      order.push("project-storage");
    },
    stopWorkspaceBridge: () => {
      order.push("workspace");
    },
    stopProjectEntryBridge: () => {},
    stopHarness: async () => {
      order.push("harness");
    },
    dispose: async () => {
      order.push("dispose");
    },
    reportFailure: () => {},
    quit,
    exit,
    ...overrides,
  });
  return { order, quit, exit, shutdown };
}

const harnessFailure = new Error("private harness shutdown failure");
const disposeFailure = new Error("private runtime dispose failure");
const bridgeOrder = ["project-storage", "workspace"];

function failingHarness(order: string[]) {
  return async () => {
    order.push("harness");
    throw harnessFailure;
  };
}

function neverDisposing(order: string[]) {
  return () => {
    order.push("dispose");
    return new Promise<void>(() => undefined);
  };
}

/** The stop's rejection, or "resolved". */
function settledFailure(promise: Promise<void>): Promise<unknown> {
  return promise.then(
    () => "resolved",
    (error: unknown) => error,
  );
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

describe("bounded runtime dispose", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const rows: ReadonlyArray<Readonly<{ name: string; run(): Promise<void> }>> = [
    {
      name: "quit",
      async run() {
        const harnessStop = deferred();
        const order: string[] = [];
        const { shutdown } = recording(order, {
          stopHarness: () => {
            order.push("harness");
            return harnessStop.promise;
          },
        });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await flushMicrotasks();
        expect(order).not.toContain("dispose");
        harnessStop.resolve();
        await shutdown.stop();
        await flushMicrotasks();
        expect(order).toEqual([...bridgeOrder, "harness", "dispose", "quit"]);
      },
    },
    {
      name: "requested exit",
      async run() {
        const { order, shutdown } = recording();
        await shutdown.requestExit(0);
        expect(order).toEqual([...bridgeOrder, "harness", "dispose", "exit:0"]);
      },
    },
    {
      name: "failed harness stop",
      async run() {
        const order: string[] = [];
        const { shutdown } = recording(order, { stopHarness: failingHarness(order) });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await expect(shutdown.stop()).rejects.toBe(harnessFailure);
        await flushMicrotasks();
        expect(order).toEqual([...bridgeOrder, "harness", "dispose", "exit:1"]);
      },
    },
    {
      name: "dispose rejects",
      async run() {
        const order: string[] = [];
        const { quit, shutdown } = recording(order, {
          dispose: async () => {
            order.push("dispose");
            throw disposeFailure;
          },
        });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await expect(shutdown.stop()).rejects.toBe(disposeFailure);
        await flushMicrotasks();
        expect(order).toEqual([...bridgeOrder, "harness", "dispose", "exit:1"]);
        expect(quit).not.toHaveBeenCalled();
      },
    },
    {
      name: "harness and dispose both fail",
      async run() {
        const order: string[] = [];
        const { exit, shutdown } = recording(order, {
          stopHarness: failingHarness(order),
          dispose: async () => {
            throw disposeFailure;
          },
        });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        const failure = await settledFailure(shutdown.stop());
        expect(failure).toBeInstanceOf(AggregateError);
        expect(failure).toMatchObject({ errors: [harnessFailure, disposeFailure] });
        await flushMicrotasks();
        expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      },
    },
    {
      name: "harness fails and dispose never settles",
      async run() {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const order: string[] = [];
        const { exit, shutdown } = recording(order, {
          stopHarness: failingHarness(order),
          dispose: neverDisposing(order),
        });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        const failure = settledFailure(shutdown.stop());
        await vi.advanceTimersByTimeAsync(999);
        expect(exit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(exit).toHaveBeenCalledExactlyOnceWith(1);
        const settled = await failure;
        expect(settled).toBeInstanceOf(AggregateError);
        expect(settled).toMatchObject({
          errors: [harnessFailure, { _tag: "DesktopRuntimeDisposeUnconfirmed", deadlineMs: 1000 }],
        });
      },
    },
    {
      name: "dispose never settles",
      async run() {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const order: string[] = [];
        // A fresh import: the error class is defined at module load (S6 mutation, :9 tag).
        vi.resetModules();
        const fresh = await import("./desktop-shutdown.js");
        const { exit, quit, shutdown } = recording(
          order,
          { dispose: neverDisposing(order) },
          fresh.createDesktopShutdown,
        );
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        const failure = settledFailure(shutdown.stop());
        await vi.advanceTimersByTimeAsync(999);
        expect(exit).not.toHaveBeenCalled();
        expect(quit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(exit).toHaveBeenCalledExactlyOnceWith(1);
        expect(quit).not.toHaveBeenCalled();
        expect(await failure).toMatchObject({
          _tag: "DesktopRuntimeDisposeUnconfirmed",
          deadlineMs: 1000,
        });
      },
    },
    {
      name: "reports a failure once before exit",
      async run() {
        const order: string[] = [];
        const reportFailure = vi.fn((_error: unknown) => {
          order.push("report");
        });
        const { shutdown } = recording(order, {
          stopHarness: failingHarness(order),
          reportFailure,
        });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await settledFailure(shutdown.stop());
        await flushMicrotasks();
        expect(reportFailure).toHaveBeenCalledExactlyOnceWith(harnessFailure);
        expect(order.slice(-2)).toEqual(["report", "exit:1"]);
      },
    },
    {
      name: "reports an unconfirmed dispose",
      async run() {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const order: string[] = [];
        const reportFailure = vi.fn((_error: unknown) => {
          order.push("report");
        });
        const { shutdown } = recording(order, { dispose: neverDisposing(order), reportFailure });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await vi.advanceTimersByTimeAsync(999);
        expect(reportFailure).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(reportFailure).toHaveBeenCalledOnce();
        expect(reportFailure.mock.calls[0]?.[0]).toMatchObject({
          _tag: "DesktopRuntimeDisposeUnconfirmed",
          deadlineMs: 1000,
        });
        expect(order.slice(-2)).toEqual(["report", "exit:1"]);
      },
    },
    {
      name: "a throwing report still exits 1",
      async run() {
        const order: string[] = [];
        const { exit, quit, shutdown } = recording(order, {
          stopHarness: failingHarness(order),
          reportFailure: () => {
            throw new Error("private report failure");
          },
        });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await settledFailure(shutdown.stop());
        await flushMicrotasks();
        expect(exit).toHaveBeenCalledExactlyOnceWith(1);
        expect(quit).not.toHaveBeenCalled();
      },
    },
    {
      name: "reports nothing on a clean quit",
      async run() {
        const reportFailure = vi.fn();
        const { quit, shutdown } = recording([], { reportFailure });
        shutdown.beforeQuit({ preventDefault: vi.fn() });
        await shutdown.stop();
        await flushMicrotasks();
        expect(quit).toHaveBeenCalledOnce();
        expect(reportFailure).not.toHaveBeenCalled();
      },
    },
  ];

  it.each(rows)("disposes the runtime before the terminal action: $name", async ({ run }) => {
    await run();
  });
});

describe("bridge stop isolation", () => {
  const thrown = new Error("private bridge stop failure");
  const rows = [
    { name: "project storage throws", throwing: "project-storage" },
    { name: "workspace throws", throwing: "workspace" },
    { name: "project entry throws", throwing: "project-entry" },
  ] as const;

  it.each(rows)("keeps stopping after a bridge stop throws: $name", async ({ throwing }) => {
    const order: string[] = [];
    const stopBridge = (name: string) => () => {
      order.push(name);
      if (name === throwing) throw thrown;
    };
    const { shutdown } = recording(order, {
      stopProjectStorageBridge: stopBridge("project-storage"),
      stopWorkspaceBridge: stopBridge("workspace"),
      stopProjectEntryBridge: stopBridge("project-entry"),
    });
    shutdown.beforeQuit({ preventDefault: vi.fn() });
    await expect(shutdown.stop()).rejects.toBe(thrown);
    await flushMicrotasks();
    expect(order).toEqual([
      "project-storage",
      "workspace",
      "project-entry",
      "harness",
      "dispose",
      "exit:1",
    ]);
  });
});

describe("IPC gate", () => {
  type Controller = ReturnType<typeof recording>["shutdown"];
  const rows: ReadonlyArray<
    Readonly<{
      name: string;
      start(shutdown: Controller): void;
      finish(shutdown: Controller): Promise<void>;
    }>
  > = [
    {
      name: "beforeQuit then quit",
      start: (shutdown) => shutdown.beforeQuit({ preventDefault: vi.fn() }),
      async finish(shutdown) {
        await shutdown.stop();
        await flushMicrotasks();
        shutdown.beforeQuit({ preventDefault: vi.fn() });
      },
    },
    {
      name: "requestExit",
      start: (shutdown) => {
        void shutdown.requestExit(0);
      },
      finish: (shutdown) => shutdown.requestExit(0),
    },
    {
      name: "stop alone",
      start: (shutdown) => {
        void shutdown.stop();
      },
      finish: (shutdown) => shutdown.stop(),
    },
  ];

  it.each(rows)("closes the IPC gate in the turn shutdown starts: $name", async (row) => {
    const { shutdown } = recording();
    expect(shutdown.accepting()).toBe(true);
    row.start(shutdown);
    expect(shutdown.accepting()).toBe(false);
    await row.finish(shutdown);
    expect(shutdown.accepting()).toBe(false);
  });
});
