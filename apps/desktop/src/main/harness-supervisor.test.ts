import { EventEmitter } from "node:events";
import {
  createFailureEvent,
  createReadyEvent,
  type HarnessStatus,
  MessageIdSchema,
} from "@slopstop/protocol";
import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  createChannel: vi.fn(),
  fork: vi.fn(),
  MessageChannelMain: vi.fn(),
}));

const crashReportingMocks = vi.hoisted(() => ({
  reportHarnessCrash: vi.fn(),
}));

vi.mock("electron", () => ({
  MessageChannelMain: electronMocks.MessageChannelMain,
  utilityProcess: {
    fork: electronMocks.fork,
  },
}));

vi.mock("./crash-reporting.js", () => crashReportingMocks);

import { HarnessSupervisor, harnessEntryPath } from "./harness-supervisor.js";

class FakePort extends EventEmitter {
  readonly close = vi.fn();
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
}

class FakeChild extends EventEmitter {
  readonly kill = vi.fn();
  readonly postMessage = vi.fn();
  readonly stderr = new EventEmitter();
  readonly stdout = new EventEmitter();
}

type FakeChannel = Readonly<{
  port1: FakePort;
  port2: FakePort;
}>;

const logger = {
  error: vi.fn(),
  info: vi.fn(),
} as unknown as Logger;

const eventMetadata = {
  messageId: MessageIdSchema.parse("00000000-0000-4000-8000-000000000002"),
  sentAt: "2026-08-14T12:00:01.000Z",
  sequence: 1,
  causationId: MessageIdSchema.parse("00000000-0000-4000-8000-000000000001"),
};

let channels: FakeChannel[];

function createChannel(): FakeChannel {
  const channel = {
    port1: new FakePort(),
    port2: new FakePort(),
  };
  channels.push(channel);
  return channel;
}

function supervisorWith(children: FakeChild[]): HarnessSupervisor {
  electronMocks.fork.mockImplementation(() => {
    const child = children.shift();
    if (child === undefined) {
      throw new Error("Test did not provide a child process.");
    }
    return child;
  });
  return new HarnessSupervisor("C:/app/harness.cjs", logger);
}

beforeEach(() => {
  channels = [];
  electronMocks.MessageChannelMain.mockImplementation(electronMocks.createChannel);
  electronMocks.createChannel.mockImplementation(createChannel);
  electronMocks.fork.mockReset();
  crashReportingMocks.reportHarnessCrash.mockReset();
  vi.mocked(logger.error).mockReset();
  vi.mocked(logger.info).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HarnessSupervisor", () => {
  it("connects once, accepts a ready handshake, forwards output, and stops cleanly", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    const statuses: HarnessStatus[] = [];
    const unsubscribe = supervisor.subscribe((status) => statuses.push(status));

    expect(supervisor.retry()).toEqual({
      ok: false,
      error: {
        code: "HARNESS_RETRY_UNAVAILABLE",
        message: "Harness retry is available only after automatic recovery stops.",
      },
    });

    supervisor.start();
    supervisor.start();
    child.emit("spawn");

    const channel = channels[0];
    expect(channel).toBeDefined();
    expect(child.postMessage).toHaveBeenCalledWith({ kind: "harness.connect" }, [channel?.port1]);
    expect(channel?.port2.start).toHaveBeenCalledOnce();
    expect(channel?.port2.postMessage).toHaveBeenCalledOnce();

    child.stdout.emit("data", Buffer.from("ready output\n"));
    child.stderr.emit("data", Buffer.from("warning output\n"));
    child.emit("error", "crashed", "native-module");
    channel?.port2.emit("message", {
      data: createReadyEvent(eventMetadata, "0.0.0"),
    });

    expect(supervisor.getStatus()).toEqual({
      state: "ready",
      attempt: 1,
      harnessVersion: "0.0.0",
    });
    expect(logger.info).toHaveBeenCalledWith({ output: "ready output" }, "Harness output.");
    expect(logger.error).toHaveBeenCalledTimes(2);

    unsubscribe();
    supervisor.stop();

    expect(child.kill).toHaveBeenCalledOnce();
    expect(channel?.port2.close).toHaveBeenCalledOnce();
    expect(statuses.at(-1)).toEqual({ state: "ready", attempt: 1, harnessVersion: "0.0.0" });
    expect(supervisor.getStatus()).toEqual({ state: "stopped" });
  });

  it("blocks automatic recovery for malformed and explicit protocol failures", () => {
    const firstChild = new FakeChild();
    const secondChild = new FakeChild();
    const supervisor = supervisorWith([firstChild, secondChild]);

    supervisor.start();
    firstChild.emit("spawn");
    channels[0]?.port2.emit("message", { data: { event: "not-valid" } });

    expect(supervisor.getStatus()).toMatchObject({
      state: "crashed",
      diagnostic: { code: "HARNESS_PROTOCOL_ERROR" },
    });
    expect(firstChild.kill).toHaveBeenCalledOnce();
    firstChild.emit("exit", 1);
    expect(crashReportingMocks.reportHarnessCrash).not.toHaveBeenCalled();

    expect(supervisor.retry()).toEqual({ ok: true });
    secondChild.emit("spawn");
    channels[1]?.port2.emit("message", {
      data: createFailureEvent(eventMetadata, {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness rejected startup.",
        retryable: false,
      }),
    });

    expect(supervisor.getStatus()).toMatchObject({
      state: "crashed",
      attempt: 1,
      diagnostic: { message: "Harness rejected startup." },
    });
    expect(secondChild.kill).toHaveBeenCalledOnce();
  });

  it("uses bounded backoff before exposing explicit retry", async () => {
    vi.useFakeTimers();
    const children = [new FakeChild(), new FakeChild(), new FakeChild(), new FakeChild()];
    const supervisor = supervisorWith([...children]);

    supervisor.start();
    children[0]?.emit("exit", 7);
    expect(supervisor.getStatus()).toMatchObject({ state: "degraded", attempt: 1 });

    await vi.advanceTimersByTimeAsync(250);
    children[1]?.emit("exit", 8);
    expect(supervisor.getStatus()).toMatchObject({ state: "degraded", attempt: 2 });

    await vi.advanceTimersByTimeAsync(500);
    children[2]?.emit("exit", 9);
    expect(supervisor.getStatus()).toEqual({
      state: "crashed",
      attempt: 3,
      canRetry: true,
      diagnostic: {
        code: "HARNESS_PROCESS_EXITED",
        message: "Harness exited with code 9.",
      },
    });
    expect(crashReportingMocks.reportHarnessCrash).toHaveBeenCalledTimes(3);

    expect(supervisor.retry()).toEqual({ ok: true });
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
  });

  it("reports handshake timeout and synchronous spawn failure as distinct states", async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);

    supervisor.start();
    child.emit("spawn");
    await vi.advanceTimersByTimeAsync(5_000);

    expect(supervisor.getStatus()).toMatchObject({
      state: "degraded",
      diagnostic: { code: "HARNESS_HANDSHAKE_TIMEOUT" },
    });
    expect(child.kill).toHaveBeenCalledOnce();

    supervisor.stop();
    electronMocks.fork.mockImplementation(() => {
      throw new Error("fork failed");
    });
    supervisor.start();

    expect(supervisor.getStatus()).toMatchObject({
      state: "crashed",
      diagnostic: { code: "HARNESS_START_FAILED" },
    });
  });

  it("resolves the colocated harness bundle", () => {
    expect(harnessEntryPath("C:/app/build")).toBe("C:\\app\\build\\harness.cjs");
  });
});
