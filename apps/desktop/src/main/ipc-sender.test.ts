import { expect, it, vi } from "vitest";
import { createIpcSender } from "./ipc-sender.js";

type Frame = { processId: number; routingId: number; url: string; origin: string };
type Contents = { id: number; mainFrame: Frame };

const channel = "test:channel";
const refused = /^IPC call refused: unknown sender\.$/;

/** A frame of the packaged page: every fake frame carries a URL (a local path) and an origin. */
function frame(processId: number, routingId: number): Frame {
  return {
    processId,
    routingId,
    url: "file:///C:/Users/someone/app/index.html",
    origin: "file://",
  };
}

/** A logger spy with every pino level. */
function spyLogger() {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

/**
 * A window whose `webContents` throws once it is closed, as a destroyed Electron window does.
 * Closing it fires only the listeners registered under the `closed` event name.
 */
function fakeWindow(id: number) {
  const contents: Contents = { id, mainFrame: frame(7, 1) };
  const listeners: Array<Readonly<{ event: string; listener: () => void }>> = [];
  let destroyed = false;
  const window = {
    get webContents() {
      if (destroyed) throw new Error("Object has been destroyed");
      return contents;
    },
    once(event: "closed", listener: () => void) {
      listeners.push({ event, listener });
      return window;
    },
    close() {
      destroyed = true;
      for (const entry of listeners) if (entry.event === "closed") entry.listener();
    },
  };
  return { window, contents };
}

/** An event from `senderFrame`, by default an equal copy of the main frame, never the same object. */
function eventFrom(contents: Contents, senderFrame: Frame | null = { ...contents.mainFrame }) {
  return { sender: contents, senderFrame };
}

/** A rule over a spy logger with one tracked window. */
function trackedSender() {
  const logger = spyLogger();
  const sender = createIpcSender({ logger });
  const tracked = fakeWindow(1);
  sender.track(tracked.window);
  return { logger, sender, tracked };
}

function expectOneRefusalLog(logger: ReturnType<typeof spyLogger>) {
  expect(logger.warn.mock.calls).toStrictEqual([
    [{ channel }, "IPC call refused: unknown sender."],
  ]);
  for (const level of ["trace", "debug", "info", "error", "fatal"] as const) {
    expect(logger[level]).not.toHaveBeenCalled();
  }
}

it("admits the main frame of a tracked window", () => {
  const { logger, sender, tracked } = trackedSender();

  expect(() => sender.admit(channel, eventFrom(tracked.contents))).not.toThrow();
  for (const level of Object.values(logger)) expect(level).not.toHaveBeenCalled();
});

it("refuses a call with no sender frame", () => {
  const { logger, sender, tracked } = trackedSender();

  expect(() => sender.admit(channel, eventFrom(tracked.contents, null))).toThrow(refused);
  expectOneRefusalLog(logger);
});

it("refuses a subframe of a tracked window", () => {
  const { logger, sender, tracked } = trackedSender();
  const subframe = frame(7, 2);

  expect(() => sender.admit(channel, eventFrom(tracked.contents, subframe))).toThrow(refused);
  expectOneRefusalLog(logger);
});

it("refuses a frame from another process with the main frame's routing id", () => {
  const { logger, sender, tracked } = trackedSender();
  const otherProcess = frame(8, 1);

  expect(() => sender.admit(channel, eventFrom(tracked.contents, otherProcess))).toThrow(refused);
  expectOneRefusalLog(logger);
});

it("refuses a window it never tracked", () => {
  const { logger, sender } = trackedSender();
  const untracked = fakeWindow(2);

  expect(() => sender.admit(channel, eventFrom(untracked.contents))).toThrow(refused);
  expectOneRefusalLog(logger);
});

it("refuses a tracked window after it closed, without reading it", () => {
  const { logger, sender, tracked } = trackedSender();

  expect(() => tracked.window.close()).not.toThrow();
  expect(() => sender.admit(channel, eventFrom(tracked.contents))).toThrow(refused);
  expectOneRefusalLog(logger);
});

it("admits the new main frame after it is replaced", () => {
  const { logger, sender, tracked } = trackedSender();
  const oldFrame = { ...tracked.contents.mainFrame };
  tracked.contents.mainFrame = frame(9, 4);

  expect(() => sender.admit(channel, eventFrom(tracked.contents))).not.toThrow();
  expect(() => sender.admit(channel, eventFrom(tracked.contents, oldFrame))).toThrow(refused);
  expectOneRefusalLog(logger);
});

it("logs only the channel of a refused call", () => {
  const { logger, sender } = trackedSender();
  const untracked = fakeWindow(2);
  expect(() => sender.admit(channel, eventFrom(untracked.contents))).toThrow(refused);
  expect(logger.warn).toHaveBeenCalledOnce();
  expect(logger.warn.mock.calls[0]?.[0]).toStrictEqual({ channel });
});

it("forgets only the window that closed", () => {
  const { logger, sender, tracked } = trackedSender();
  const other = fakeWindow(2);
  sender.track(other.window);

  tracked.window.close();

  expect(() => sender.admit(channel, eventFrom(other.contents))).not.toThrow();
  expect(() => sender.admit(channel, eventFrom(tracked.contents))).toThrow(refused);
  expectOneRefusalLog(logger);
});
