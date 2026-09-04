import { describe, expect, it, vi } from "vitest";

import { createDesktopShutdown } from "./desktop-shutdown.js";

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
