import { EventEmitter } from "node:events";
import path from "node:path";
import {
  createProjectCloseResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
  createReadyEvent,
  createSystemFailureEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  decodeStrict,
  HarnessBootstrapSchema,
  type HarnessStatus,
  HarnessUpgradeLogLineSchema,
  MessageIdSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
  protocolVersion,
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
  warn: vi.fn(),
} as unknown as Logger;

const eventMetadata = {
  messageId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000002"),
  sentAt: "2026-08-14T12:00:01.000Z",
  sequence: 1,
  causationId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000001"),
};
const bootstrap = decodeStrict(HarnessBootstrapSchema, {
  kind: "harness.connect",
  applicationStorageRootUrl: "file:///C:/Users/example/AppData/SlopStop/storage",
  migrationResourcesRootUrl: "file:///C:/app/harness-migrations",
});
const projectStorageProjectId = "00000000-0000-4000-8000-000000000101";
const projectStorageOpenRequest = decodeStrict(ProjectStorageOpenRequestSchema, {
  projectId: projectStorageProjectId,
});
const projectStorageCreateRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: projectStorageProjectId,
  createRequestId: "00000000-0000-4000-8000-000000000102",
});
const projectStorageCloseRequest = decodeStrict(ProjectStorageCloseRequestSchema, {
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
  vi.mocked(logger.warn).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HarnessSupervisor", () => {
  it("keeps request failure status-neutral and reserves recovery for system failure", () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    supervisor.start();
    child.emit("spawn");
    const channel = channels[0];
    if (channel === undefined) throw new Error("Harness channel was not created.");
    channel.port2.emit("message", { data: createReadyEvent(eventMetadata, "0.0.0") });
    expect(supervisor.getStatus()).toEqual({
      state: "ready",
      attempt: 1,
      harnessVersion: "0.0.0",
    });

    const failure = {
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000003",
      sentAt: "2026-08-14T12:00:02.000Z",
      sequence: 2,
      causationId: "00000000-0000-4000-8000-000000000501",
      event: "request.failure",
      payload: {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a message.",
        retryable: false,
      },
    };
    channel.port2.emit("message", { data: failure });
    expect(supervisor.getStatus()).toEqual({
      state: "ready",
      attempt: 1,
      harnessVersion: "0.0.0",
    });
    expect(child.kill).toHaveBeenCalledTimes(0);

    channel.port2.emit("message", {
      data: {
        ...failure,
        messageId: "00000000-0000-4000-8000-000000000004",
        sequence: 3,
        causationId: null,
        event: "system.failure",
      },
    });
    expect(supervisor.getStatus()).toEqual({
      state: "crashed",
      attempt: 1,
      canRetry: true,
      diagnostic: {
        code: "HARNESS_PROTOCOL_ERROR",
        message: "Harness failed while handling a message.",
      },
    });
    expect(child.kill).toHaveBeenCalledTimes(1);
    child.emit("exit", 1);
  });

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

  it("removes child process observers on stop, the forwarder once stdout ends", () => {
    vi.useFakeTimers();
    const stoppedChild = new FakeChild();
    const stoppedSupervisor = supervisorWith([stoppedChild]);
    stoppedSupervisor.start();

    void stoppedSupervisor.stop();
    // Only the upgrade-line forwarder stays on stdout until its stdout ends.
    expect(stoppedChild.stdout?.listenerCount("data")).toBe(1);
    expect(stoppedChild.stderr?.listenerCount("data")).toBe(0);
    expect(stoppedChild.listenerCount("error")).toBe(1);
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.error).mockClear();
    stoppedChild.stdout?.emit("data", Buffer.from("private stale output"));
    stoppedChild.stderr?.emit("data", Buffer.from("secret-token"));
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    stoppedChild.emit("exit", 0);
    stoppedChild.stdout?.emit("end");
    expect(stoppedChild.stdout?.listenerCount("data")).toBe(0);
  });

  it("removes child process observers on exit, the forwarder once stdout ends", () => {
    const exitedChild = new FakeChild();
    const exitedSupervisor = supervisorWith([exitedChild]);
    exitedSupervisor.start();
    expect(exitedChild.listenerCount("error")).toBe(1);
    exitedChild.emit("exit", 0);
    expect(exitedChild.stdout?.listenerCount("data")).toBe(1);
    exitedChild.stdout?.emit("end");
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
    const query = decodeStrict(WorkspaceQuerySchema, {
      query: "memory-library.read",
      projectId: "00000000-0000-4000-8000-000000000010",
      cursor: null,
    });
    const result = decodeStrict(WorkspaceQueryResultSchema, {
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
        messageId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000003"),
      },
      decodeStrict(WorkspaceIntentResultSchema, { status: "forwarded", capability: "memory" }),
    );
    const invalidationEvent = createWorkspaceProjectionInvalidatedEvent(
      {
        ...eventMetadata,
        messageId: decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000004"),
      },
      decodeStrict(WorkspaceNotificationSchema, {
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
      data: createSystemFailureEvent(
        { ...eventMetadata, causationId: null },
        {
          code: "HARNESS_INTERNAL_FAILURE",
          message: "Harness rejected startup.",
          retryable: false,
        },
      ),
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

describe("harness upgrade log lines", () => {
  const time = Date.UTC(2026, 9, 6, 12, 0, 0);
  const harnessTime = new Date(time).toISOString();
  const ids = {
    projectId: "00000000-0000-4000-8000-000000000010",
    upgradeId: "00000000-0000-4000-8000-0000000000a1",
  };
  const abandoned = (reason: string) => ({
    level: 30,
    time,
    service: "harness",
    event: "project-storage.upgrade.abandoned",
    ...ids,
    reason,
  });
  const discardFailed = (cause: string) => ({
    level: 40,
    time,
    service: "harness",
    event: "project-storage.upgrade.discard-failed",
    ...ids,
    cause,
  });
  const valid = [
    abandoned("failed"),
    abandoned("interrupted"),
    discardFailed("busy"),
    discardFailed("broken"),
    discardFailed("unproven"),
  ].map((line) => decodeStrict(HarnessUpgradeLogLineSchema, line));
  const json = (value: unknown) => JSON.stringify(value);
  const exactly16KiB = "x".repeat(16 * 1024);
  const overlong = "y".repeat(20 * 1024);
  const lines = [
    ...valid.map(json),
    json({ ...abandoned("failed"), extra: true }),
    json({ ...abandoned("failed"), projectId: "not-a-uuid" }),
    json(abandoned("restarted")),
    json({ level: 30, time, service: "harness", event: "other.event" }),
    "not json",
    exactly16KiB,
    overlong,
    json(abandoned("failed")),
  ];
  const text = `${lines.join("\n")}\n{"partial":`;

  const observation = "Harness process output observed.";
  /** The stream cut into 1000-byte chunks, none ending on a newline. */
  function chunksOf(value: string): Buffer[] {
    const bytes = Buffer.from(value);
    return Array.from({ length: Math.ceil(bytes.byteLength / 1000) }, (_, index) =>
      bytes.subarray(index * 1000, (index + 1) * 1000),
    );
  }
  /** Every desktop log call, in order, as `[level, object, message]`. */
  function recordLogCalls(): unknown[][] {
    const recorded: unknown[][] = [];
    for (const level of ["info", "warn", "error"] as const) {
      vi.mocked(logger[level]).mockImplementation((object: unknown, message?: unknown) => {
        recorded.push([level, object, message]);
      });
    }
    return recorded;
  }
  const forwarded = (line: Readonly<Record<string, unknown>>) => [
    line["level"] === 30 ? "info" : "warn",
    {
      source: "harness",
      event: line["event"],
      ...ids,
      ...("reason" in line ? { reason: line["reason"] } : { cause: line["cause"] }),
      harnessTime,
    },
    "Harness upgrade event.",
  ];
  const invalid = (event: string) => [
    "warn",
    { code: "HARNESS_LOG_LINE_INVALID", attempt: 1, event },
    "Harness upgrade log line rejected.",
  ];

  it("forwards only harness upgrade log lines", () => {
    const recorded = recordLogCalls();
    const child = new FakeChild();
    supervisorWith([child]).start();
    const chunks = chunksOf(text);
    expect(chunks.every((chunk) => !chunk.toString().endsWith("\n"))).toBe(true);
    for (const chunk of chunks) child.stdout?.emit("data", chunk);
    child.stdout?.emit("end");
    child.emit("exit", 0);

    expect(recorded.filter((entry) => entry[2] === observation)).toEqual(
      chunks.map((chunk) => [
        "info",
        { attempt: 1, stream: "stdout", bytes: chunk.byteLength },
        observation,
      ]),
    );
    expect(recorded.filter((entry) => entry[2] !== observation)).toEqual([
      ...valid.map(forwarded),
      invalid("project-storage.upgrade.abandoned"),
      invalid("project-storage.upgrade.abandoned"),
      invalid("project-storage.upgrade.abandoned"),
      ["warn", { code: "HARNESS_LOG_LINE_TOO_LONG", attempt: 1 }, "Harness output line dropped."],
      forwarded(abandoned("failed")),
      [
        "warn",
        { code: "HARNESS_LOG_LINE_INCOMPLETE", attempt: 1 },
        "Harness output line incomplete.",
      ],
      ["error", { exitCode: 0, attempt: 1 }, "Harness process exited."],
    ]);
  });

  it("forwards upgrade lines written during shutdown until stdout ends", () => {
    vi.useFakeTimers();
    const recorded = recordLogCalls();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    supervisor.start();
    void supervisor.stop();
    child.stdout?.emit(
      "data",
      Buffer.from(`${json(abandoned("interrupted"))}
`),
    );
    child.stderr?.emit("data", Buffer.from("secret-token"));
    child.emit("exit", 0);
    child.stdout?.emit("end");
    child.stdout?.emit(
      "data",
      Buffer.from(`${json(abandoned("failed"))}
`),
    );

    expect(recorded.filter((entry) => entry[2] !== "Harness process exited.")).toEqual([
      forwarded(abandoned("interrupted")),
    ]);
    expect(child.stdout?.listenerCount("data")).toBe(0);
  });

  it("forwards an upgrade line that arrives after exit until stdout ends", () => {
    const recorded = recordLogCalls();
    const child = new FakeChild();
    supervisorWith([child]).start();
    child.emit("exit", 0);
    child.stdout?.emit(
      "data",
      Buffer.from(`${json(abandoned("interrupted"))}
`),
    );
    child.stdout?.emit("end");
    child.stdout?.emit(
      "data",
      Buffer.from(`${json(abandoned("failed"))}
`),
    );

    expect(recorded.filter((entry) => entry[2] === "Harness upgrade event.")).toEqual([
      forwarded(abandoned("interrupted")),
    ]);
    expect(child.stdout?.listenerCount("data")).toBe(0);
  });

  it("stops forwarding when a stopping child never exits", async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const supervisor = supervisorWith([child]);
    supervisor.start();
    const stopped = supervisor.stop().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await stopped).toEqual(new Error("Harness shutdown timed out."));
    expect(child.stdout?.listenerCount("data")).toBe(0);
  });

  it.for(["end", "close"] as const)(
    "keeps stderr logging and the error listener when stdout %s arrives before exit",
    (event) => {
      const recorded = recordLogCalls();
      const child = new FakeChild();
      supervisorWith([child]).start();
      child.stdout?.emit(event);
      expect(child.stdout?.listenerCount("data")).toBe(0);
      expect(child.listenerCount("error")).toBe(1);
      child.stderr?.emit("data", Buffer.from("err"));
      expect(() => child.emit("error", new Error("late failure"))).not.toThrow();
      child.stdout?.emit(
        "data",
        Buffer.from(`${json(abandoned("failed"))}
`),
      );
      expect(recorded.filter((entry) => entry[2] !== "Harness process exited.")).toEqual([
        ["error", { attempt: 1, stream: "stderr", bytes: 3 }, observation],
        [
          "error",
          { attempt: 1, code: "HARNESS_PROCESS_ERROR" },
          "Harness process reported a fatal error.",
        ],
      ]);
    },
  );

  it("rejects an upgrade line whose time is no date", () => {
    const recorded = recordLogCalls();
    const child = new FakeChild();
    supervisorWith([child]).start();
    const line = json({ ...abandoned("failed"), time: 9_000_000_000_000_000 });
    expect(() =>
      child.stdout?.emit(
        "data",
        Buffer.from(`${line}
`),
      ),
    ).not.toThrow();
    expect(recorded.filter((entry) => entry[2] !== observation)).toEqual([
      invalid("project-storage.upgrade.abandoned"),
    ]);
  });
});
