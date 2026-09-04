import { EventEmitter } from "node:events";
import path from "node:path";
import {
  createFailureEvent,
  createProjectCloseResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
  createReadyEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  HarnessBootstrapSchema,
  type HarnessStatus,
  MessageIdSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
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
const bootstrap = HarnessBootstrapSchema.parse({
  kind: "harness.connect",
  applicationStorageRootUrl: "file:///C:/Users/example/AppData/SlopStop/storage",
  migrationResourcesRootUrl: "file:///C:/app/harness-migrations",
});
const projectStorageProjectId = "00000000-0000-4000-8000-000000000101";
const projectStorageOpenRequest = ProjectStorageOpenRequestSchema.parse({
  projectId: projectStorageProjectId,
});
const projectStorageCreateRequest = ProjectStorageCreateRequestSchema.parse({
  projectId: projectStorageProjectId,
  createRequestId: "00000000-0000-4000-8000-000000000102",
});
const projectStorageCloseRequest = ProjectStorageCloseRequestSchema.parse({
  projectId: projectStorageProjectId,
});
const projectStorageUnavailable = {
  diagnostic: {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: "Project Storage owner is unavailable.",
  },
} as const;
const projectStorageResultEvents = [
  createProjectOpenResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000111",
      sentAt: "2026-08-31T12:00:00.000Z",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000121",
    },
    { status: "not-registered", request: projectStorageOpenRequest },
  ),
  createProjectCreateResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000112",
      sentAt: "2026-08-31T12:00:00.000Z",
      sequence: 2,
      causationId: "00000000-0000-4000-8000-000000000122",
    },
    {
      status: "unavailable",
      request: projectStorageCreateRequest,
      ...projectStorageUnavailable,
    },
  ),
  createProjectCloseResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000113",
      sentAt: "2026-08-31T12:00:00.000Z",
      sequence: 3,
      causationId: "00000000-0000-4000-8000-000000000123",
    },
    {
      status: "unavailable",
      request: projectStorageCloseRequest,
      ...projectStorageUnavailable,
    },
  ),
] as const;

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
  return new HarnessSupervisor("C:/app/harness.cjs", logger, bootstrap);
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
  it("records child process events as metadata only", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    supervisor.start();

    child.stdout?.emit("data", Buffer.from("private C:\\repo\\source.ts"));
    child.stderr?.emit("data", Buffer.from("secret-token"));
    child.stdout?.emit("data", Buffer.from("\u20ac"));
    child.emit("error", "private-error-type", "C:\\repo\\source.ts");

    expect(logger.info).toHaveBeenCalledWith(
      { attempt: 1, stream: "stdout", bytes: 25 },
      "Harness process output observed.",
    );
    expect(logger.error).toHaveBeenCalledWith(
      { attempt: 1, stream: "stderr", bytes: 12 },
      "Harness process output observed.",
    );
    expect(logger.error).toHaveBeenCalledWith(
      { attempt: 1, code: "HARNESS_PROCESS_ERROR" },
      "Harness process reported a fatal error.",
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      { attempt: 1, stream: "stdout", bytes: 3 },
      "Harness process output observed.",
    );
    expect(logger.error).toHaveBeenCalledTimes(2);
    const serializedLogs = JSON.stringify([
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]);
    expect(serializedLogs).not.toContain("private");
    expect(serializedLogs).not.toContain("private-error-type");
    expect(serializedLogs).not.toContain("source.ts");
    expect(serializedLogs).not.toContain("secret-token");
  });

  it("removes child process observers on stop and exit", () => {
    vi.useFakeTimers();
    const stoppedChild = new FakeChild();
    const stoppedSupervisor = supervisorWith([stoppedChild]);
    stoppedSupervisor.start();

    void stoppedSupervisor.stop();
    expect(stoppedChild.stdout?.listenerCount("data")).toBe(0);
    expect(stoppedChild.stderr?.listenerCount("data")).toBe(0);
    expect(stoppedChild.listenerCount("error")).toBe(1);
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.error).mockClear();
    stoppedChild.stdout?.emit("data", Buffer.from("private stale output"));
    stoppedChild.stderr?.emit("data", Buffer.from("secret-token"));
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    const exitedChild = new FakeChild();
    const exitedSupervisor = supervisorWith([exitedChild]);
    exitedSupervisor.start();
    expect(exitedChild.listenerCount("error")).toBe(1);
    exitedChild.emit("exit", 0);
    expect(exitedChild.stdout?.listenerCount("data")).toBe(0);
    expect(exitedChild.stderr?.listenerCount("data")).toBe(0);
    expect(exitedChild.listenerCount("error")).toBe(0);
    void exitedSupervisor.stop();
  });

  it("queues a protocol-failed child retry until confirmed exit", () => {
    vi.useFakeTimers();
    const staleChild = new FakeChild();
    const replacementChild = new FakeChild();
    const supervisor = supervisorWith([staleChild, replacementChild]);
    supervisor.start();
    staleChild.emit("spawn");
    channels[0]?.port2.emit("message", { data: { event: "not-valid" } });

    expect(supervisor.retry()).toEqual({ ok: true });
    expect(electronMocks.fork).toHaveBeenCalledOnce();
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.error).mockClear();
    staleChild.stdout?.emit("data", Buffer.from("private stale output"));
    staleChild.stderr?.emit("data", Buffer.from("secret-token"));

    expect(staleChild.stdout?.listenerCount("data")).toBe(0);
    expect(staleChild.stderr?.listenerCount("data")).toBe(0);
    expect(staleChild.listenerCount("error")).toBe(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(() => staleChild.emit("error", new Error("late private failure"))).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
    staleChild.emit("exit", 1);
    expect(staleChild.listenerCount("error")).toBe(0);
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
    void supervisor.stop();
  });

  it("sends the same validated trusted roots to initial and retried harnesses", () => {
    vi.useFakeTimers();
    const first = new FakeChild();
    const retry = new FakeChild();
    const supervisor = supervisorWith([first, retry]);

    supervisor.start();
    first.emit("spawn");
    expect(first.postMessage).toHaveBeenCalledWith(bootstrap, [channels[0]?.port1]);
    first.emit("exit", 1);
    vi.advanceTimersByTime(250);
    retry.emit("spawn");
    expect(retry.postMessage).toHaveBeenCalledWith(bootstrap, [channels[1]?.port1]);
    const logs = JSON.stringify([
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]);
    expect(logs).not.toContain(bootstrap.applicationStorageRootUrl);
    expect(logs).not.toContain(bootstrap.migrationResourcesRootUrl);
    void supervisor.stop();
  });

  it("forwards Project Storage results without changing supervisor status", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    const events: HarnessSessionEvent[] = [];
    supervisor.getSession().subscribe((event) => events.push(event));
    supervisor.start();
    child.emit("spawn");

    for (const message of projectStorageResultEvents) {
      channels[0]?.port2.emit("message", { data: message });
    }
    expect(events).toEqual(
      projectStorageResultEvents.map((message) => ({ type: "message", message })),
    );
    expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
    void supervisor.stop();
  });

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
    expect(supervisor.getStatus()).toMatchObject({ state: "crashed", canRetry: true });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(electronMocks.fork).toHaveBeenCalledOnce();
    expect(crashReportingMocks.reportHarnessCrash).not.toHaveBeenCalled();
  });

  it("connects once, accepts a ready handshake, and forwards output metadata", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);

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
    expect(child.postMessage).toHaveBeenCalledWith(bootstrap, [channel?.port1]);
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
    expect(logger.info).toHaveBeenCalledWith(
      { attempt: 1, stream: "stdout", bytes: 13 },
      "Harness process output observed.",
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      { attempt: 1, stream: "stderr", bytes: 15 },
      "Harness process output observed.",
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      { attempt: 1, code: "HARNESS_PROCESS_ERROR" },
      "Harness process reported a fatal error.",
    );
  });

  it("detaches once and stops cleanly after natural child exit", async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    const statuses: HarnessStatus[] = [];
    const unsubscribe = supervisor.subscribe((status) => statuses.push(status));
    supervisor.start();
    child.emit("spawn");
    const channel = channels[0];
    channel?.port2.emit("message", {
      data: createReadyEvent(eventMetadata, "0.0.0"),
    });

    const lifecycle: string[] = [];
    channel?.port2.close.mockImplementation(() => {
      lifecycle.push("detach");
    });
    unsubscribe();
    const firstStop = supervisor.stop();
    const repeatedStop = supervisor.stop();

    expect(repeatedStop).toBe(firstStop);
    expect(channel?.port2.close).toHaveBeenCalledOnce();
    expect(lifecycle).toEqual(["detach"]);
    expect(child.kill).not.toHaveBeenCalled();
    expect(supervisor.getStatus()).toEqual({
      state: "ready",
      attempt: 1,
      harnessVersion: "0.0.0",
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(child.kill).not.toHaveBeenCalled();

    lifecycle.push("exit");
    child.emit("exit", 0);
    await expect(firstStop).resolves.toBeUndefined();

    expect(lifecycle).toEqual(["detach", "exit"]);
    expect(child.kill).not.toHaveBeenCalled();
    expect(supervisor.getStatus()).toEqual({ state: "stopped" });
    expect(statuses.at(-1)).toEqual({ state: "ready", attempt: 1, harnessVersion: "0.0.0" });
  });

  it("kills after grace and rejects after the terminal exit deadline", async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const replacement = new FakeChild();
    const supervisor = supervisorWith([child, replacement]);
    supervisor.start();
    child.emit("spawn");

    const stop = supervisor.stop();
    let outcome: "pending" | "resolved" | Error = "pending";
    const observedStop = stop.then(
      () => {
        outcome = "resolved";
      },
      (error: unknown) => {
        outcome = error instanceof Error ? error : new Error("Unexpected shutdown failure.");
      },
    );
    await vi.advanceTimersByTimeAsync(4_999);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(child.kill).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(outcome).toBe("pending");
    supervisor.start();
    expect(supervisor.retry()).toEqual({
      ok: false,
      error: {
        code: "HARNESS_RETRY_UNAVAILABLE",
        message: "Harness retry is available only after automatic recovery stops.",
      },
    });
    expect(electronMocks.fork).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);
    await observedStop;
    expect(outcome).toEqual(new Error("Harness shutdown timed out."));
    expect(supervisor.getStatus()).toEqual({
      state: "degraded",
      attempt: 1,
      diagnostic: {
        code: "HARNESS_SHUTDOWN_TIMEOUT",
        message: "Harness shutdown timed out.",
      },
    });
    supervisor.start();
    expect(supervisor.retry()).toEqual({
      ok: false,
      error: {
        code: "HARNESS_RETRY_UNAVAILABLE",
        message: "Harness retry is available only after automatic recovery stops.",
      },
    });
    expect(electronMocks.fork).toHaveBeenCalledOnce();

    child.emit("exit", 0);
    expect(supervisor.getStatus()).toEqual({
      state: "degraded",
      attempt: 1,
      diagnostic: {
        code: "HARNESS_SHUTDOWN_TIMEOUT",
        message: "Harness shutdown timed out.",
      },
    });
    supervisor.start();
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    const replacementStop = supervisor.stop();
    replacement.emit("exit", 0);
    await replacementStop;
  });

  it("does not connect a child that spawns after shutdown starts", async () => {
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    supervisor.start();

    const stop = supervisor.stop();
    child.emit("spawn");

    expect(child.postMessage).not.toHaveBeenCalled();
    expect(channels).toHaveLength(0);
    expect(() => child.emit("error", new Error("late private failure"))).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
    child.emit("exit", 0);
    await stop;
    expect(child.listenerCount("error")).toBe(0);
  });

  it("does not retry a protocol-failed child while shutdown is active", async () => {
    const failedChild = new FakeChild();
    const replacementChild = new FakeChild();
    const supervisor = supervisorWith([failedChild, replacementChild]);
    supervisor.start();
    failedChild.emit("spawn");
    channels[0]?.port2.emit("message", { data: { event: "not-valid" } });
    expect(supervisor.getStatus()).toMatchObject({ state: "crashed", canRetry: true });

    const stop = supervisor.stop();
    expect(supervisor.retry()).toEqual({
      ok: false,
      error: {
        code: "HARNESS_RETRY_UNAVAILABLE",
        message: "Harness retry is available only after automatic recovery stops.",
      },
    });
    expect(electronMocks.fork).toHaveBeenCalledOnce();

    failedChild.emit("exit", 0);
    await stop;
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
    expect(electronMocks.fork).toHaveBeenCalledOnce();
    channels[0]?.port2.emit("message", {
      data: createReadyEvent(eventMetadata, "stale-harness"),
    });
    expect(supervisor.getStatus()).toMatchObject({ state: "crashed", attempt: 1 });
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
      canRetry: true,
      diagnostic: { message: "Harness rejected startup." },
    });
    expect(secondChild.kill).toHaveBeenCalledOnce();
    secondChild.emit("exit", 2);
    expect(supervisor.getStatus()).toMatchObject({ state: "crashed", canRetry: true });
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

    const handshakeStop = handshakeSupervisor.stop();
    expect(channels[0]?.port2.close).toHaveBeenCalledOnce();
    handshakeChild.emit("exit", 0);
    await handshakeStop;
    expect(vi.getTimerCount()).toBe(0);
    expect(electronMocks.fork).toHaveBeenCalledOnce();
    expect(handshakeSupervisor.getStatus()).toEqual({ state: "stopped" });

    const restartChild = new FakeChild();
    const restartSupervisor = supervisorWith([restartChild]);
    restartSupervisor.start();
    restartChild.emit("exit", 7);
    expect(vi.getTimerCount()).toBe(1);
    restartSupervisor.start();
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);

    await restartSupervisor.stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(250);
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    expect(restartSupervisor.getStatus()).toEqual({ state: "stopped" });
  });

  it("reports handshake timeout and restarts safely after completed stop", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeChild();
    const restartedChild = new FakeChild();
    const supervisor = supervisorWith([firstChild, restartedChild]);

    supervisor.start();
    firstChild.emit("spawn");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(firstChild.kill).toHaveBeenCalledOnce();
    expect(supervisor.getStatus()).toMatchObject({
      state: "degraded",
      diagnostic: { code: "HARNESS_HANDSHAKE_TIMEOUT" },
    });
    expect(logger.error).toHaveBeenCalledWith({ attempt: 1 }, "Harness handshake timed out.");

    const previousStop = supervisor.stop();
    supervisor.start();
    expect(electronMocks.fork).toHaveBeenCalledTimes(1);
    firstChild.emit("exit", 0);
    await previousStop;

    supervisor.start();
    restartedChild.emit("spawn");
    expect(electronMocks.fork).toHaveBeenCalledTimes(2);
    const laterStop = supervisor.stop();
    expect(laterStop).not.toBe(previousStop);
    expect(channels[1]?.port2.close).toHaveBeenCalledOnce();
    expect(restartedChild.kill).not.toHaveBeenCalled();
    expect(supervisor.getStatus()).not.toEqual({ state: "stopped" });

    restartedChild.emit("exit", 0);
    await laterStop;
    expect(restartedChild.kill).not.toHaveBeenCalled();
    expect(supervisor.getStatus()).toEqual({ state: "stopped" });
  });

  it("reports synchronous spawn failure as a distinct state", () => {
    const forkError = new Error("fork failed");
    const supervisor = supervisorWith([]);
    electronMocks.fork.mockImplementation(() => {
      throw forkError;
    });
    supervisor.start();

    expect(supervisor.getStatus()).toMatchObject({
      state: "crashed",
      diagnostic: { code: "HARNESS_START_FAILED" },
    });
    expect(logger.error).toHaveBeenCalledWith(
      { attempt: 1, code: "HARNESS_START_FAILED" },
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
