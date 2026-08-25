import { EventEmitter } from "node:events";
import path from "node:path";
import {
  createFailureEvent,
  createReadyEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type HarnessStatus,
  MessageIdSchema,
  WorkspaceIntentResultSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
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

import type { HarnessSessionEvent } from "./harness-session.js";
import { HarnessSupervisor, harnessEntryPath } from "./harness-supervisor.js";

class FakePort extends EventEmitter {
  readonly close = vi.fn();
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
}

class FakeChild extends EventEmitter {
  readonly kill = vi.fn();
  readonly postMessage = vi.fn();
  readonly stderr: EventEmitter | undefined;
  readonly stdout: EventEmitter | undefined;

  constructor(withOutput = true) {
    super();
    this.stderr = withOutput ? new EventEmitter() : undefined;
    this.stdout = withOutput ? new EventEmitter() : undefined;
  }
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
let failPortPost: boolean;

function createChannel(): FakeChannel {
  const channel = {
    port1: new FakePort(),
    port2: new FakePort(),
  };
  if (failPortPost) {
    channel.port2.postMessage.mockImplementation(() => {
      throw new Error("send failed");
    });
  }
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
  failPortPost = false;
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
  it("publishes workspace messages without changing supervisor status", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    const sessionEvents: HarnessSessionEvent[] = [];
    supervisor.getSession().subscribe((event) => sessionEvents.push(event));
    supervisor.start();
    child.emit("spawn");
    const query = WorkspaceQuerySchema.parse({
      query: "memory-library.read",
      projectId: "00000000-0000-4000-8000-000000000010",
      cursor: null,
    });
    const result = WorkspaceQueryResultSchema.parse({
      status: "unavailable",
      query,
      diagnostic: {
        code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
        message: "Memory producer is unavailable.",
      },
    });

    const workspaceEvent = createWorkspaceQueryResultEvent(eventMetadata, result);
    const intentEvent = createWorkspaceIntentResultEvent(
      {
        ...eventMetadata,
        messageId: MessageIdSchema.parse("00000000-0000-4000-8000-000000000003"),
      },
      WorkspaceIntentResultSchema.parse({ status: "forwarded", capability: "memory" }),
    );
    const invalidationEvent = createWorkspaceProjectionInvalidatedEvent(
      {
        ...eventMetadata,
        messageId: MessageIdSchema.parse("00000000-0000-4000-8000-000000000004"),
      },
      WorkspaceNotificationSchema.parse({
        capability: "memory",
        scope: {
          kind: "project",
          projectId: "00000000-0000-4000-8000-000000000010",
        },
        revision: 1,
      }),
    );
    for (const event of [workspaceEvent, intentEvent, invalidationEvent]) {
      channels[0]?.port2.emit("message", { data: event });
    }

    expect(sessionEvents).toEqual(
      [workspaceEvent, intentEvent, invalidationEvent].map((message) => ({
        type: "message",
        message,
      })),
    );
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
    expect(child.kill).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    channels[0]?.port2.emit("message", {
      data: createReadyEvent(eventMetadata, "0.0.0"),
    });
    expect(supervisor.getStatus()).toEqual({
      state: "ready",
      attempt: 1,
      harnessVersion: "0.0.0",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails startup immediately when the session cannot send handshake", async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    failPortPost = true;
    const supervisor = supervisorWith([child]);

    supervisor.start();
    child.emit("spawn");

    expect(supervisor.getStatus()).toEqual({
      state: "crashed",
      attempt: 1,
      canRetry: true,
      diagnostic: {
        code: "HARNESS_START_FAILED",
        message: "Harness handshake could not be sent.",
      },
    });
    expect(child.kill).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      { attempt: 1, code: "HARNESS_SESSION_SEND_FAILED" },
      "Harness handshake could not be sent.",
    );
    child.emit("exit", 1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(electronMocks.fork).toHaveBeenCalledOnce();
    expect(crashReportingMocks.reportHarnessCrash).not.toHaveBeenCalled();
  });

  it("connects once, accepts a ready handshake, forwards output, and stops cleanly", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    const statuses: HarnessStatus[] = [];
    const unsubscribe = supervisor.subscribe((status) => statuses.push(status));

    expect(supervisor.getStatus()).toEqual({ state: "stopped" });
    expect(supervisor.retry()).toEqual({
      ok: false,
      error: {
        code: "HARNESS_RETRY_UNAVAILABLE",
        message: "Harness retry is available only after automatic recovery stops.",
      },
    });

    supervisor.start();
    supervisor.start();
    expect(electronMocks.fork).toHaveBeenCalledExactlyOnceWith("C:/app/harness.cjs", [], {
      serviceName: "SlopStop Harness",
      stdio: "pipe",
    });
    child.emit("spawn");

    const channel = channels[0];
    expect(channel).toBeDefined();
    expect(child.postMessage).toHaveBeenCalledWith({ kind: "harness.connect" }, [channel?.port1]);
    expect(channel?.port2.start).toHaveBeenCalledOnce();
    expect(channel?.port2.postMessage).toHaveBeenCalledOnce();

    child.stdout?.emit("data", Buffer.from("ready output\n"));
    child.stderr?.emit("data", Buffer.from("warning output\n"));
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
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      { output: "warning output" },
      "Harness error output.",
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      { type: "crashed", location: "native-module" },
      "Harness process reported a fatal error.",
    );

    unsubscribe();
    supervisor.stop();

    expect(child.kill).toHaveBeenCalledOnce();
    expect(channel?.port2.close).toHaveBeenCalledOnce();
    expect(statuses.at(-1)).toEqual({ state: "ready", attempt: 1, harnessVersion: "0.0.0" });
    expect(supervisor.getStatus()).toEqual({ state: "stopped" });
  });

  it("blocks automatic recovery for malformed and explicit protocol failures", () => {
    vi.useFakeTimers();
    const firstChild = new FakeChild();
    const secondChild = new FakeChild();
    const thirdChild = new FakeChild();
    const supervisor = supervisorWith([firstChild, secondChild, thirdChild]);

    supervisor.start();
    firstChild.emit("spawn");
    channels[0]?.port2.emit("message", { data: { event: "not-valid" } });

    expect(supervisor.getStatus()).toMatchObject({
      state: "crashed",
      diagnostic: { code: "HARNESS_PROTOCOL_ERROR" },
    });
    expect(firstChild.kill).toHaveBeenCalledOnce();

    expect(supervisor.retry()).toEqual({ ok: true });
    channels[0]?.port2.emit("message", {
      data: createReadyEvent(eventMetadata, "stale-harness"),
    });
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
    firstChild.emit("exit", 1);
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
    expect(crashReportingMocks.reportHarnessCrash).not.toHaveBeenCalled();
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
    secondChild.emit("exit", 2);
    expect(crashReportingMocks.reportHarnessCrash).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    expect(supervisor.retry()).toEqual({ ok: true });
    thirdChild.emit("spawn");
    thirdChild.emit("exit", 3);
    expect(supervisor.getStatus()).toMatchObject({ state: "degraded", attempt: 1 });
    expect(crashReportingMocks.reportHarnessCrash).toHaveBeenCalledExactlyOnceWith(3);
  });

  it("uses bounded backoff before exposing explicit retry", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeChild();
    const secondChild = new FakeChild();
    const thirdChild = new FakeChild();
    const retryChild = new FakeChild();
    const supervisor = supervisorWith([firstChild, secondChild, thirdChild, retryChild]);

    supervisor.start();
    firstChild.emit("spawn");
    firstChild.emit("exit", 7);
    expect(supervisor.getStatus()).toMatchObject({ state: "degraded", attempt: 1 });
    expect(logger.error).toHaveBeenCalledWith(
      { exitCode: 7, attempt: 1 },
      "Harness process exited.",
    );
    expect(channels[0]?.port2.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(249);
    expect(electronMocks.fork).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    secondChild.emit("spawn");
    firstChild.emit("exit", 70);
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 2 });
    expect(crashReportingMocks.reportHarnessCrash).toHaveBeenCalledTimes(1);
    secondChild.emit("exit", 8);
    expect(supervisor.getStatus()).toMatchObject({ state: "degraded", attempt: 2 });
    expect(channels[1]?.port2.close).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(499);
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(electronMocks.fork).toHaveBeenCalledTimes(3);
    thirdChild.emit("exit", 9);
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

  it("cancels pending handshake and restart timers when stopped", async () => {
    vi.useFakeTimers();
    const handshakeChild = new FakeChild();
    const handshakeSupervisor = supervisorWith([handshakeChild]);
    handshakeSupervisor.start();
    handshakeChild.emit("spawn");
    expect(vi.getTimerCount()).toBe(1);

    handshakeSupervisor.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(channels[0]?.port2.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(electronMocks.fork).toHaveBeenCalledOnce();
    expect(handshakeSupervisor.getStatus()).toEqual({ state: "stopped" });

    const restartChild = new FakeChild();
    const restartSupervisor = supervisorWith([restartChild]);
    restartSupervisor.start();
    restartChild.emit("exit", 7);
    expect(vi.getTimerCount()).toBe(1);
    restartSupervisor.start();
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);

    restartSupervisor.stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(250);
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    expect(restartSupervisor.getStatus()).toEqual({ state: "stopped" });
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
    expect(logger.error).toHaveBeenCalledWith({ attempt: 1 }, "Harness handshake timed out.");

    supervisor.stop();
    const forkError = new Error("fork failed");
    electronMocks.fork.mockImplementation(() => {
      throw forkError;
    });
    supervisor.start();

    expect(supervisor.getStatus()).toMatchObject({
      state: "crashed",
      diagnostic: { code: "HARNESS_START_FAILED" },
    });
    expect(logger.error).toHaveBeenCalledWith(
      { error: forkError, attempt: 2 },
      "Harness process failed to start.",
    );
  });

  it("starts when child output streams are unavailable", () => {
    const child = new FakeChild(false);
    const supervisor = supervisorWith([child]);

    expect(() => supervisor.start()).not.toThrow();
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
  });

  it("resolves the colocated harness bundle", () => {
    expect(harnessEntryPath("C:/app/build")).toBe(path.join("C:/app/build", "harness.cjs"));
  });
});
