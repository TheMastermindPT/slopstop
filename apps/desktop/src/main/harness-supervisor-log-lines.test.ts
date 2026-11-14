import { createReadyEvent, decodeStrict, HarnessUpgradeLogLineSchema } from "@slopstop/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  channels,
  eventMetadata,
  expectShutdownTimeout,
  FakeChild,
  logger,
  resetSupervisorDoubles,
  supervisorWith,
} from "./harness-supervisor-test-peers.js";

const electronMocks = vi.hoisted(() => ({
  createChannel: vi.fn(),
  fork: vi.fn(),
  MessageChannelMain: vi.fn(),
}));
vi.mock("electron", () => ({
  MessageChannelMain: electronMocks.MessageChannelMain,
  utilityProcess: { fork: electronMocks.fork },
}));
vi.mock("./crash-reporting.js", () => ({ reportHarnessCrash: vi.fn() }));

beforeEach(() => {
  resetSupervisorDoubles(electronMocks);
});

afterEach(() => {
  vi.useRealTimers();
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

  it("forwards harness upgrade log lines and drops other output lines", () => {
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
    const outcome = await stopped;
    expectShutdownTimeout(outcome);
    expect(child.stdout?.listenerCount("data")).toBe(0);
  });

  /** A started, ready child whose stop is watched through a settled flag, under fake time. */
  function stoppingReadyChild(child = new FakeChild()) {
    vi.useFakeTimers();
    const supervisor = supervisorWith([child]);
    supervisor.start();
    child.emit("spawn");
    channels[0]?.port2.emit("message", { data: createReadyEvent(eventMetadata, "0.0.0") });
    const outcome: { settled: boolean; error?: unknown } = { settled: false };
    void supervisor.stop().then(
      () => Object.assign(outcome, { settled: true }),
      (error: unknown) => Object.assign(outcome, { settled: true, error }),
    );
    return { child, supervisor, outcome };
  }
  const upgradeLine = () => Buffer.from(`${json(abandoned("interrupted"))}\n`);
  const upgradeEvents = (recorded: unknown[][]) =>
    recorded.filter((entry) => entry[2] === "Harness upgrade event.");

  it.each([{ event: "end" }, { event: "close" }] as const)(
    "waits after exit until stdout $event before the stop resolves",
    async ({ event }) => {
      const recorded = recordLogCalls();
      const { child, supervisor, outcome } = stoppingReadyChild();
      child.emit("exit", 0);
      await vi.advanceTimersByTimeAsync(500);
      expect(outcome.settled).toBe(false);
      expect(supervisor.getStatus()).not.toEqual({ state: "stopped" });
      supervisor.start();
      expect(electronMocks.fork).toHaveBeenCalledOnce();
      child.stdout?.emit("data", upgradeLine());
      expect(upgradeEvents(recorded)).toEqual([forwarded(abandoned("interrupted"))]);
      child.stdout?.emit(event);
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome).toEqual({ settled: true });
      expect(supervisor.getStatus()).toEqual({ state: "stopped" });
      expect(child.stdout?.listenerCount("data")).toBe(0);
    },
  );

  it("resolves the stop at the drain bound when stdout never ends", async () => {
    const recorded = recordLogCalls();
    const { child, supervisor, outcome } = stoppingReadyChild();
    child.emit("exit", 0);
    await vi.advanceTimersByTimeAsync(999);
    expect(outcome.settled).toBe(false);
    expect(child.stdout?.listenerCount("data")).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toEqual({ settled: true });
    expect(supervisor.getStatus()).toEqual({ state: "stopped" });
    expect(child.stdout?.listenerCount("data")).toBe(0);
    child.stdout?.emit("data", upgradeLine());
    expect(upgradeEvents(recorded)).toEqual([]);
  });

  it.each([{ case: "absent" }, { case: "already ended" }, { case: "already closed" }] as const)(
    "resolves at exit when stdout is $case",
    async ({ case: stdout }) => {
      const { child, supervisor, outcome } = stoppingReadyChild(new FakeChild(stdout !== "absent"));
      if (stdout === "already ended") child.stdout?.emit("end");
      if (stdout === "already closed") child.stdout?.emit("close");
      child.emit("exit", 0);
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome).toEqual({ settled: true });
      expect(supervisor.getStatus()).toEqual({ state: "stopped" });
    },
  );

  it.each([{ event: "end" }, { event: "close" }] as const)(
    "removes every stdout listener when stdout $event arrives",
    ({ event }) => {
      const child = new FakeChild();
      supervisorWith([child]).start();
      child.stdout?.emit(event);
      expect(child.stdout?.eventNames()).toEqual([]);
    },
  );

  it("bounds the worst-case quit at the kill grace plus the drain", async () => {
    const { child, outcome } = stoppingReadyChild();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(child.kill).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(4_999);
    child.emit("exit", 0);
    await vi.advanceTimersByTimeAsync(999);
    expect(outcome.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toEqual({ settled: true });
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
