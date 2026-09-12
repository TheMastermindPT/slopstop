import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCanonicalWriterPackageSmoke } from "./canonical-writer-package-smoke.js";
import {
  activation,
  beforeSpawnObservation,
  bootstrap,
  completedServiceStop,
  delayHolderEOF,
  electronExitStreams,
  failAllOwnedStreams,
  fixtureContradiction,
  fixtureResult,
  fixtureTransferFault,
  id,
  installCleanupKillFailures,
  productionResponse,
  ready,
  receipt,
  record,
  refusedTakeovers,
  ScriptedChild,
  ScriptedPort,
  semanticContradictions,
  switchContradiction,
  transportContradiction,
  unsolicitedStart,
} from "./canonical-writer-package-smoke-test-peers.js";

const electron = vi.hoisted(() => ({ fork: vi.fn(), channel: vi.fn(), native: vi.fn() }));
vi.mock("electron", () => ({
  utilityProcess: { fork: electron.fork },
  MessageChannelMain: class {
    port1: ScriptedPort;
    port2: ScriptedPort;
    constructor() {
      const ports: { port1: ScriptedPort; port2: ScriptedPort } = electron.channel();
      this.port1 = ports.port1;
      this.port2 = ports.port2;
    }
  },
}));
vi.mock("./package-smoke-verifier.js", async (original) => ({
  ...(await original<typeof import("./package-smoke-verifier.js")>()),
  verifyPackagedWriterNative: electron.native,
}));

let children: ScriptedChild[];
let abort: AbortController;
let sent: unknown[];
let configure: (child: ScriptedChild, index: number) => void;
let reply: (port: ScriptedPort, command: Record<string, unknown>) => void;
let timeline: string[];
let spawnDelay: number | undefined;
let closeChild: (child: ScriptedChild) => void;
function run() {
  return runCanonicalWriterPackageSmoke({
    bootstrap,
    mainBundleDirectory: "C:/proof/resources/app.asar/.vite/build",
    resourcesPath: "C:/proof/resources",
    signal: abort.signal,
  });
}
async function settle() {
  const result = run();
  await vi.runAllTimersAsync();
  return result;
}
async function undrainedStream(input: Readonly<{ name: "stdout" | "stderr"; mode: string }>) {
  const { name, mode } = input;
  configure = (child) => {
    if (mode === "null") child[name] = null;
  };
  reply = (port, command) => {
    if (mode === "error") children[0]?.[name]?.emit("error", new Error("private"));
    port.emit("message", { data: { ...ready(command), causationId: id(999) } });
  };
  vi.mocked(process.kill).mockImplementation(() => {
    children[0]?.finish(
      1,
      name !== "stdout" || mode !== "missing",
      name !== "stderr" || mode !== "missing",
    );
    return true;
  });
  return settle();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  vi.setSystemTime(0);
  children = [];
  sent = [];
  timeline = [];
  abort = new AbortController();
  spawnDelay = 0;
  closeChild = (child) => {
    if (child.pid !== undefined) child.finish();
  };
  configure = () => undefined;
  reply = (port, command) => port.emit("message", { data: ready(command) });
  electron.native.mockReset();
  electron.fork.mockReset();
  electron.channel.mockReset();
  electron.fork.mockImplementation(() => {
    const child = new ScriptedChild();
    const index = children.length;
    children.push(child);
    timeline.push(`fork:${index}`);
    configure(child, index);
    if (spawnDelay !== undefined)
      setTimeout(() => {
        child.pid = 800_000 + index;
        child.emit("spawn");
      }, spawnDelay);
    return child;
  });
  electron.channel.mockImplementation(() => {
    const child = children.at(-1);
    if (!child) throw new Error("No child");
    const port1 = new ScriptedPort();
    const port2 = new ScriptedPort();
    child.port = port2;
    port2.send = (value) => {
      sent.push(value);
      return reply(port2, record(value));
    };
    port2.on("close", () => {
      timeline.push(`close:${children.indexOf(child)}`);
      closeChild(child);
    });
    return { port1, port2 };
  });
  vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
    expect(signal).toBe("SIGKILL");
    expect(pid).not.toBe(process.pid);
    const child = children.find((candidate) => candidate.pid === pid);
    if (!child) throw new Error("Unknown scripted PID");
    timeline.push(`kill:${children.indexOf(child)}`);
    child.finish(1);
    return true;
  });
});

type Intercept = (
  label: string,
  response: Record<string, unknown>,
  port: ScriptedPort,
  request: Record<string, unknown>,
) => unknown;
function fullSequence(intercept: Intercept = (_label, response) => response, deferred = false) {
  const sequences = new Map<number, number>();
  const commands = new Map<number, number>();
  const reached: string[] = [];
  reply = (port, request) => {
    const index = children.findIndex((child) => child.port === port);
    const kind = String(request["command"] ?? request["step"]);
    const label = `${index}:${kind}`;
    reached.push(label);
    timeline.push(label);
    const response = request["step"]
      ? fixtureResult(request)
      : productionResponse(index, request, sequences, commands);
    const value = intercept(label, response, port, request);
    if (value !== undefined) {
      const deliver = () => port.emit("message", { data: value });
      if (deferred) setTimeout(deliver, 2);
      else deliver();
    }
  };
  return reached;
}
it.each(["stream-reset", "service-stop", "false-kill", "throw-kill", "missing-witness"])(
  "observes real Electron lifecycle behavior: %s",
  async (mode) => {
    fullSequence();
    configure = electronExitStreams;
    closeChild = (child) => {
      if (mode !== "stream-reset" && [1, 2, 5].includes(children.indexOf(child)))
        completedServiceStop(child, mode);
      else child.finish();
    };
    const result = await settle();
    if (["stream-reset", "service-stop"].includes(mode)) {
      expect(result).toEqual({ status: "passed", cleanupSafe: true });
    } else {
      expect(result).toMatchObject({ status: "failed", stage: "clean-stop", cleanupSafe: true });
    }
    if (mode === "missing-witness") expect(children[1]?.kill).not.toHaveBeenCalled();
  },
);
function changeHolderIdentity(variant: string): void {
  const holder = children[0];
  if (!holder) throw new Error("Missing holder");
  const replacements: Record<string, number | undefined> = {
    changed: 999_999,
    self: process.pid,
    absent: undefined,
  };
  if (variant in replacements) holder.pid = replacements[variant];
}
function scriptCrash(variant: string): void {
  const normalKill = vi.mocked(process.kill).getMockImplementation();
  vi.mocked(process.kill).mockImplementation((pid, signal) => {
    if (pid !== 800_000) {
      if (!normalKill) throw new Error("Missing kill mock");
      return normalKill(pid, signal);
    }
    return finishCrash(variant);
  });
}
function finishCrash(variant: string): true {
  if (variant === "throw") throw new Error("private");
  if (variant === "no-exit") return true;
  children[0]?.finish(variant === "zero-exit" ? 0 : 1, variant !== "missing-eof");
  return true;
}
function injectTransportFault(mode: string, port: ScriptedPort, response: unknown): unknown {
  const child = children[0];
  if (!child) throw new Error("No child");
  const actions: Record<string, () => unknown> = {
    duplicate: () => port.emit("message", { data: response }),
    "parent-message": () => child.emit("message", {}),
    disconnect: () => port.emit("close"),
    "port-error": () => port.emit("messageerror", new Error("private")),
    "child-error": () => child.emit("error", "FatalError", "private", "private"),
    throw: () => {
      throw new Error("private");
    },
    false: () => false,
  };
  return actions[mode]?.();
}
function transferFault(mode: string, child: ScriptedChild): void {
  if (mode === "transfer")
    child.transfer.mockImplementation(() => {
      throw new Error("private");
    });
  if (mode === "transfer-false") child.transfer.mockReturnValue(false);
}
function setupFault(mode: string): void {
  const channel = electron.channel.getMockImplementation();
  if (!channel) throw new Error("No channel");
  electron.channel.mockImplementation(() => {
    if (mode === "channel") throw new Error("private");
    const ports: { port1: ScriptedPort; port2: ScriptedPort } = channel();
    if (mode === "start")
      ports.port2.start.mockImplementation(() => {
        throw new Error("private");
      });
    return ports;
  });
  configure = (child) => transferFault(mode, child);
}
function takeoverContradiction(variant: string, response: Record<string, unknown>) {
  if (refusedTakeovers[variant] !== undefined)
    return { ...response, payload: refusedTakeovers[variant] };
  const request = { projectId: id(101) };
  const payload = activation(1, request);
  if (variant === "wrong-contention")
    return {
      ...response,
      payload: {
        ...payload,
        diagnostic: { code: "WRITER_UNAVAILABLE", retryable: true, message: "wrong" },
      },
    };
  if (variant === "broken")
    return {
      ...response,
      payload: {
        status: "broken",
        request,
        diagnostic: { code: "WRITER_FENCE_STALE", retryable: false, message: "broken" },
      },
    };
  if (variant === "unavailable")
    return {
      ...response,
      payload: {
        status: "unavailable",
        request,
        diagnostic: {
          code: "PROJECT_STORAGE_UNAVAILABLE",
          retryable: true,
          message: "unavailable",
        },
      },
    };
  if (variant === "abort-retry") setTimeout(() => abort.abort(), 50);
  return { ...response, payload };
}

describe("scripted full sequence", () => {
  it.each(semanticContradictions)(
    "rejects %s without proceeding after that observation",
    async (_name, target, sequence, patch) => {
      let reached = false;
      let requestsAtFailure = 0;
      fullSequence((label, response) => {
        if (label !== target || response["sequence"] !== sequence) return response;
        reached = true;
        requestsAtFailure = sent.length;
        return { ...response, payload: { ...record(response["payload"]), ...record(patch) } };
      });
      const result = await settle();
      expect(reached).toBe(true);
      expect(result.status).toBe("failed");
      expect(sent).toHaveLength(requestsAtFailure);
    },
  );
  it("permits only source-qualified same-Project takeover after 100ms", async () => {
    let first = true;
    let contendedAt = 0;
    let switchedAt = 0;
    fullSequence((label, response, _port, request) => {
      if (label === "2:project.activate" && first) {
        first = false;
        contendedAt = Date.now();
        return { ...response, payload: activation(1, { projectId: id(101) }) };
      }
      if (label === "2:project.switch") {
        switchedAt = Date.now();
        expect(request["payload"]).toEqual({
          from: { projectId: id(101), activationId: id(145) },
          to: { projectId: id(101) },
        });
      }
      return response;
    });
    expect(await settle()).toEqual({ status: "passed", cleanupSafe: true });
    expect(switchedAt - contendedAt).toBe(100);
  });
  it.each([
    "wrong-contention",
    "broken",
    "unavailable",
    "wrong-source",
    "stale-source",
    "abort-retry",
    "safe-mode",
    "not-registered",
    "malformed",
  ])("does not retry %s", async (variant) => {
    let reached = false;
    fullSequence((label, response) => {
      if (label === "2:project.activate") {
        reached = true;
        return takeoverContradiction(variant, response);
      }
      if (label === "2:project.switch") return switchContradiction({ variant, response });
      return response;
    });
    const result = await settle();
    expect(reached).toBe(true);
    expect(result.status).toBe("failed");
    expect(
      sent.map(record).filter((request) => request["command"] === "project.switch"),
    ).toHaveLength(["wrong-source", "stale-source"].includes(variant) ? 1 : 0);
  });
  it.each(["throw", "changed", "self", "absent", "zero-exit", "no-exit", "missing-eof"])(
    "rejects hard crash %s",
    async (variant) => {
      let crashReached = false;
      fullSequence((label, response) => {
        if (label === "1:project.command") {
          crashReached = true;
          changeHolderIdentity(variant);
        }
        return response;
      });
      scriptCrash(variant);
      const result = await settle();
      expect(crashReached).toBe(true);
      expect(result.status).toBe("failed");
      expect(children).toHaveLength(2);
    },
  );
  it("fails an active wait when another owned process fails", async () => {
    let reached = false;
    fullSequence((label, response) => {
      if (label !== "1:system.handshake") return response;
      reached = true;
      children[0]?.emit("error", "FatalError", "private", "private");
      return undefined;
    });
    const result = await settle();
    expect(reached).toBe(true);
    expect(result).toMatchObject({ status: "failed", stage: "process-exit", cleanupSafe: true });
    expect(process.kill).toHaveBeenCalledTimes(2);
    expect(children).toHaveLength(2);
  });
  it("attempts other cleanup while one child has not exited", async () => {
    fullSequence((label, response) => {
      if (label === "1:system.handshake") {
        children[0]?.emit("error", "FatalError");
        return undefined;
      }
      return response;
    });
    const attempts: number[] = [];
    vi.mocked(process.kill).mockImplementation((pid) => {
      attempts.push(pid);
      if (pid === 800_001) children[1]?.finish(1);
      return true;
    });
    const pending = run();
    await vi.advanceTimersByTimeAsync(10);
    expect(attempts).toEqual([800_000, 800_001]);
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ status: "failed", cleanupSafe: false });
  });
  it.each([false, true])(
    "completes all six independent peers with deferred=%s",
    async (deferred) => {
      const reached = fullSequence(undefined, deferred);
      const result = await settle();
      expect(result).toEqual({ status: "passed", cleanupSafe: true });
      expect(reached).toEqual([
        "0:system.handshake",
        "0:project.command",
        "0:project.activate",
        "0:project.command",
        "1:system.handshake",
        "1:project.activate",
        "1:project.command",
        "2:system.handshake",
        "2:project.command",
        "2:project.activate",
        "2:project.command",
        "2:project.command",
        "2:project.command",
        "3:audit.initialize",
        "4:stale.initialize",
        "4:stale.release",
        "5:system.handshake",
        "5:project.activate",
        "4:stale.attempt",
        "4:stale.finish",
      ]);
      expect(children).toHaveLength(6);
      expect(electron.native.mock.invocationCallOrder[0]).toBeLessThan(
        electron.fork.mock.invocationCallOrder[0] ?? 0,
      );
      expect(process.kill).toHaveBeenCalledExactlyOnceWith(800_000, "SIGKILL");
      expect(timeline.indexOf("close:1")).toBeLessThan(timeline.indexOf("kill:0"));
      expect(timeline.indexOf("kill:0")).toBeLessThan(timeline.indexOf("fork:2"));
      expect(timeline.indexOf("kill:0")).toBeLessThan(timeline.indexOf("close:0"));
      expect(children.every((child) => child.kill.mock.calls.length === 0)).toBe(true);
      const audit = sent.map(record).find((value) => value["step"] === "audit.initialize");
      expect(audit).toMatchObject({
        activationIds: [id(141), id(142)],
        expectedReceipts: [receipt(1), receipt(2)],
      });
    },
  );
  it.each([
    ["0:project.command", "projectId", id(104)],
    ["0:project.command", "activationId", id(144)],
    ["0:project.command", "commandId", id(133)],
    ["0:project.activate", "request", { projectId: id(104) }],
    ["0:project.activate", "writerGeneration", 2],
    ["2:project.activate", "activationId", id(141)],
    ["2:project.activate", "writerGeneration", 1],
    ["5:project.activate", "activationId", id(143)],
    ["5:project.activate", "request", { projectId: id(101) }],
  ])("rejects actual result %s %s", async (label, key, value) => {
    let observed = false;
    fullSequence((current, response) => {
      if (current !== label) return response;
      observed = true;
      return { ...response, payload: { ...record(response["payload"]), [key]: value } };
    });
    const result = await settle();
    expect(observed).toBe(true);
    expect(result.status).toBe("failed");
    expect(timeline.at(-1)).not.toBe("4:stale.finish");
  });
  it.each([
    "proofId",
    "requestId",
    "stepNumber",
    "extra",
    "native-target",
    "old-epoch",
    "replacement-epoch",
    "duplicate",
  ])("rejects fixture %s through the actual public control", async (variant) => {
    const label = variant.includes("epoch") ? "4:stale.attempt" : "4:stale.initialize";
    let observed = false;
    fullSequence((current, response, port) => {
      if (current !== label) return response;
      observed = true;
      return fixtureContradiction(variant, response, port);
    });
    const result = await settle();
    expect(observed).toBe(true);
    expect(result.status).toBe("failed");
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("transport admission", () => {
  it.each([
    "unsolicited-start",
    "late-old-peer",
    "cross-peer",
    "child-disconnect",
    "late-after-timeout",
    "request.failure",
    "system.failure",
  ])("rejects %s on a public observation", async (mode) => {
    let reached = false;
    fullSequence((label, response, port) => {
      const target = mode === "late-old-peer" ? "1:system.handshake" : "0:system.handshake";
      if (label !== target) return response;
      reached = true;
      return transportContradiction(mode, response, port, children);
    });
    if (mode === "unsolicited-start") {
      unsolicitedStart(electron.channel, () => {
        reached = true;
      });
    }
    const result = await settle();
    expect(reached).toBe(true);
    expect(result.status).toBe("failed");
    expect(children.length).toBeLessThanOrEqual(2);
  });
  it.each([3, 4])(
    "rejects fixture %s setup/send failures and retains its handle",
    async (index) => {
      for (const mode of [
        "transfer-throw",
        "transfer-false",
        "send-throw",
        "send-false",
        "direct-parent",
      ]) {
        fullSequence();
        let reached = false;
        configure = (child, ordinal) => {
          if (ordinal !== index) return;
          fixtureTransferFault(child, mode, () => {
            reached = true;
          });
        };
        const result = await settle();
        expect(reached).toBe(true);
        expect(result).toMatchObject({ status: "failed", cleanupSafe: true });
        expect(children).toHaveLength(index + 1);
        children.length = 0;
        sent.length = 0;
      }
    },
  );
  it.each([
    "audit.initialize",
    "stale.initialize",
    "stale.release",
    "stale.attempt",
    "stale.finish",
  ])("rejects wrong proof, request, step and late duplicate for %s", async (step) => {
    for (const key of ["proofId", "requestId", "step", "stepNumber", "duplicate"]) {
      let reached = false;
      fullSequence((label, response, port) => {
        if (!label.endsWith(`:${step}`)) return response;
        reached = true;
        if (key === "duplicate") {
          queueMicrotask(() => port.emit("message", { data: response }));
          return response;
        }
        const value = key === "stepNumber" ? 99 : key === "step" ? "stale.unknown" : id(999);
        return { ...response, [key]: value };
      });
      const result = await settle();
      expect(reached).toBe(true);
      expect(result.status).toBe("failed");
      children.length = 0;
      sent.length = 0;
    }
  });
  it.each([
    ["causation", { causationId: id(901) }],
    ["zero sequence", { sequence: 0 }],
    ["skipped sequence", { sequence: 2 }],
    ["protocol", { protocolVersion: 3 }],
    ["event", { event: "system.unknown" }],
    ["request failure", { event: "request.failure", payload: { code: "BROKEN" } }],
    ["system failure", { event: "system.failure", causationId: null, payload: { code: "BROKEN" } }],
  ])("rejects contradictory %s before another request", async (_name, patch) => {
    reply = (port, command) => port.emit("message", { data: { ...ready(command), ...patch } });
    const outcome = await settle();
    expect(children).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(process.kill).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: "failed", cleanupSafe: true });
  });
  it.each([
    "duplicate",
    "parent-message",
    "disconnect",
    "port-error",
    "child-error",
    "throw",
    "false",
  ])("rejects %s during an otherwise matching exchange", async (mode) => {
    reply = (port, command) => {
      port.emit("message", { data: ready(command) });
      return injectTransportFault(mode, port, ready(command));
    };
    const outcome = await settle();
    expect(children).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(outcome).toMatchObject({ status: "failed", cleanupSafe: true });
  });
  it.each(["channel", "start", "transfer", "transfer-false"])(
    "retains the handle on %s failure",
    async (mode) => {
      setupFault(mode);
      expect(await settle()).toMatchObject({ status: "failed", cleanupSafe: true });
      expect(children).toHaveLength(1);
      expect(process.kill).toHaveBeenCalledTimes(1);
    },
  );
  it("does not fork after native preflight failure", async () => {
    electron.native.mockImplementation(() => {
      throw new Error("private");
    });
    expect(await settle()).toMatchObject({ status: "failed" });
    expect(children).toHaveLength(0);
  });
  it("does not fork after abort before entry", async () => {
    abort.abort();
    expect(await settle()).toEqual({
      status: "failed",
      stage: "cancelled",
      cleanupSafe: true,
      cleanupFailures: [],
    });
    expect(children).toHaveLength(0);
  });
});

describe("owned bounds", () => {
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, process.pid])(
    "refuses invalid recorded spawn PID %s before port admission",
    async (pid) => {
      fullSequence();
      configure = (child) => {
        child.once("spawn", () => {
          child.pid = pid;
        });
      };
      const result = await settle();
      expect(result.status).toBe("failed");
      expect(sent).toHaveLength(0);
      expect(children).toHaveLength(1);
      expect(process.kill).not.toHaveBeenCalled();
    },
  );
  it("refuses a replacement reusing the recorded holder PID", async () => {
    fullSequence();
    configure = (child, index) => {
      if (index === 2)
        child.once("spawn", () => {
          child.pid = 800_000;
        });
    };
    expect((await settle()).status).toBe("failed");
    expect(children).toHaveLength(3);
    expect(
      sent.map(record).filter((request) => request["command"] === "system.handshake"),
    ).toHaveLength(2);
  });
  it.each(["stdout", "stderr"] as const)(
    "keeps %s error permanent even when EOF subsequently arrives",
    async (name) => {
      fullSequence((label, response) => {
        if (label === "0:system.handshake")
          children[0]?.[name]?.emit("error", new Error("private"));
        return response;
      });
      expect(await settle()).toMatchObject({
        status: "failed",
        stage: "stdio-drain",
        cleanupSafe: false,
      });
      expect(children[0]?.[name]?.listenerCount("error")).toBeGreaterThan(0);
    },
  );
  it("retains bounded frozen secondary metadata for all six handles", async () => {
    fullSequence((label, response) => {
      if (label !== "5:project.activate") return response;
      failAllOwnedStreams(children);
      return undefined;
    });
    installCleanupKillFailures(children);
    const result = await settle();
    expect(children).toHaveLength(6);
    expect(result).toMatchObject({
      status: "failed",
      stage: "unexpected-message",
      cleanupSafe: false,
    });
    if (result.status !== "failed") throw new Error("Expected failure");
    expect(result.cleanupFailures).toHaveLength(8);
    expect(result.cleanupFailures.length).toBeLessThanOrEqual(24);
    expect(Object.isFrozen(result.cleanupFailures)).toBe(true);
    expect(result.cleanupFailures.every(Object.isFrozen)).toBe(true);
    for (let processIndex = 0; processIndex < 6; processIndex++) {
      expect(result.cleanupFailures.filter((entry) => entry.processIndex === processIndex)).toEqual(
        [
          ...(processIndex >= 4 ? [{ processIndex, stage: "cleanup" }] : []),
          { processIndex, stage: "stdio-drain" },
        ],
      );
    }
  });
  it("does not detach unconfirmed errors after a cleanup port-close exception", async () => {
    fullSequence((label, response) => {
      if (label === "5:project.activate") {
        const holder = children[0];
        if (!holder?.port) throw new Error("No holder");
        holder.port.close = () => {
          throw new Error("private");
        };
      }
      return response;
    });
    expect(await settle()).toEqual({
      status: "failed",
      stage: "cleanup",
      cleanupSafe: true,
      cleanupFailures: [{ processIndex: 0, stage: "cleanup" }],
    });
    expect(children[0]?.listenerCount("error")).toBeGreaterThan(0);
  });
  it.each([9999, 10000, 10001])("bounds spawn completion at %sms", async (delay) => {
    fullSequence();
    spawnDelay = delay;
    const result = await settle();
    expect(result.status).toBe(delay < 10000 ? "passed" : "failed");
    expect(children).toHaveLength(delay < 10000 ? 6 : 1);
    if (delay >= 10000) {
      expect(sent).toHaveLength(0);
      expect(process.kill).toHaveBeenCalledOnce();
    }
  });
  it.each([9999, 10000, 10001])("bounds actual handshake response at %sms", async (delay) => {
    fullSequence((label, response, port) => {
      if (label !== "0:system.handshake") return response;
      setTimeout(() => port.emit("message", { data: response }), delay);
      return undefined;
    });
    const result = await settle();
    expect(result.status).toBe(delay < 10000 ? "passed" : "failed");
    if (delay >= 10000) {
      expect(sent).toHaveLength(1);
      expect(children).toHaveLength(1);
    }
  });
  it.each([89999, 90000, 90001])("bounds whole proof at monotonic %sms", async (now) => {
    fullSequence((label, response) => {
      vi.setSystemTime(label === "4:stale.finish" ? now : Date.now() + 4500);
      return response;
    });
    expect((await settle()).status).toBe(now < 90000 ? "passed" : "failed");
  });
  it.each([14999, 15000, 15001])(
    "includes EOF, replacement spawn and acquisition in takeover %sms",
    async (elapsed) => {
      let exitedAt = 0;
      let acquiredAt = 0;
      configure = (_child, index) => {
        spawnDelay = index === 2 ? 9999 : 0;
      };
      delayHolderEOF(children, () => {
        exitedAt = Date.now();
      });
      fullSequence((label, response, port) => {
        if (label !== "2:project.activate") return response;
        expect(Date.now() - exitedAt).toBeGreaterThanOrEqual(12998);
        setTimeout(
          () => {
            acquiredAt = Date.now();
            port.emit("message", { data: response });
          },
          exitedAt + elapsed - Date.now(),
        );
        return undefined;
      });
      expect((await settle()).status).toBe(elapsed < 15000 ? "passed" : "failed");
      expect(acquiredAt - exitedAt).toBe(elapsed);
    },
  );
  it.each([4999, 5000, 5001])("bounds clean exit at %sms", async (delay) => {
    fullSequence();
    closeChild = (child) => {
      if (child === children[1]) setTimeout(() => child.finish(), delay);
      else if (child.pid !== undefined) child.finish();
    };
    expect((await settle()).status).toBe(delay < 5000 ? "passed" : "failed");
    expect(children).toHaveLength(delay < 5000 ? 6 : 2);
  });
  it.each([2999, 3000, 3001])("bounds independently observed EOF at %sms", async (delay) => {
    fullSequence();
    closeChild = (child) => {
      if (child !== children[1]) {
        if (child.pid !== undefined) child.finish();
        return;
      }
      child.finish(0, false, false);
      setTimeout(() => {
        child.stdout?.emit("end");
        child.stderr?.emit("end");
      }, delay);
    };
    expect((await settle()).status).toBe(delay < 3000 ? "passed" : "failed");
  });
  it.each([9999, 10000, 10001])(
    "bounds cleanup exit independently of kill at %sms",
    async (delay) => {
      reply = (port) => {
        port.emit("messageerror");
      };
      vi.mocked(process.kill).mockImplementation(() => {
        setTimeout(() => children[0]?.finish(1), delay);
        return true;
      });
      const result = await settle();
      expect(result.status).toBe("failed");
      if (result.status !== "failed") throw new Error("Expected failure");
      expect(result.stage).toBe("transport");
      expect(result.cleanupFailures.length === 0).toBe(delay < 10000);
      if (delay > 10000) expect(result.cleanupSafe).toBe(false);
    },
  );
  it.each(["text", "binary", "multibyte"])("counts exact output boundary for %s", async (kind) => {
    for (const bytes of [65536, 65537]) {
      const start = children.length;
      fullSequence((label, response) => {
        if (label === `${start}:system.handshake`) {
          const chunk =
            kind === "binary"
              ? Buffer.alloc(bytes)
              : kind === "text"
                ? "x".repeat(bytes)
                : `${"é".repeat(32768)}${bytes === 65537 ? "x" : ""}`;
          children[start]?.stderr?.emit("data", chunk);
        }
        return response;
      });
      const result = await settle();
      expect(result.status).toBe(bytes === 65536 ? "passed" : "failed");
      children.length = 0;
      sent.length = 0;
    }
  });
  it.each([
    "spawn",
    "clean-stop",
    "audit.initialize",
    "stale.initialize",
    "stale.release",
    "stale.attempt",
    "stale.finish",
  ])("retains children after abort during %s", async (at) => {
    let reached = false;
    fullSequence((label, response) => {
      if (label.endsWith(`:${at}`)) {
        reached = true;
        abort.abort();
        return undefined;
      }
      return response;
    });
    if (at === "spawn") {
      spawnDelay = 50;
      setTimeout(() => {
        reached = true;
        abort.abort();
      }, 10);
    }
    if (at === "clean-stop")
      closeChild = () => {
        reached = true;
        abort.abort();
      };
    const result = await settle();
    expect(reached).toBe(true);
    expect(result).toEqual({
      status: "failed",
      stage: "cancelled",
      cleanupSafe: true,
      cleanupFailures: [],
    });
    expect(process.kill).toHaveBeenCalled();
  });
  it.each(["fork-throw", "never-spawn", "exit-before-spawn", "spawn-without-pid"])(
    "retains exact ownership for %s",
    async (mode) => {
      if (mode === "fork-throw")
        electron.fork.mockImplementation(() => {
          throw new Error("private");
        });
      else {
        spawnDelay = undefined;
        configure = (child) => beforeSpawnObservation(mode, child);
      }
      const result = await settle();
      expect(result.status).toBe("failed");
      expect(result.cleanupSafe).toBe(mode === "fork-throw" || mode === "exit-before-spawn");
      expect(children).toHaveLength(mode === "fork-throw" ? 0 : 1);
      if (!result.cleanupSafe) expect(children[0]?.listenerCount("error")).toBeGreaterThan(0);
    },
  );
  it.each(["stdout", "stderr"] as const)("counts UTF-8 bytes in %s", async (name) => {
    reply = (port, command) => {
      children[0]?.[name]?.emit("data", `${"é".repeat(32768)}x`);
      port.emit("message", { data: ready(command) });
    };
    expect(await settle()).toMatchObject({ status: "failed", stage: "output-bound" });
  });
  it.each(["null", "error", "missing"])("does not drain %s stdout", async (mode) => {
    expect(await undrainedStream({ name: "stdout", mode })).toMatchObject({
      status: "failed",
      cleanupSafe: false,
    });
  });
  it.each(["null", "error", "missing"])("does not drain %s stderr", async (mode) => {
    expect(await undrainedStream({ name: "stderr", mode })).toMatchObject({
      status: "failed",
      cleanupSafe: false,
    });
  });
  it("fails absent response and performs actual owned cleanup", async () => {
    reply = () => undefined;
    const result = await settle();
    expect(process.kill).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "failed", stage: "handshake", cleanupSafe: true });
  });
  it("settles silent response and EOF waits despite fractional timer truncation", async () => {
    let fraction = 0;
    vi.mocked(performance.now).mockImplementation(() => {
      fraction += 0.001;
      return Date.now() + fraction;
    });
    reply = () => undefined;
    vi.mocked(process.kill).mockImplementation(() => {
      children[0]?.finish(1, false, false);
      return true;
    });
    let settled = false;
    const pending = run().then((outcome) => {
      settled = true;
      return outcome;
    });
    // Fake timers truncate fractional delays to integer milliseconds, as Node does.
    await vi.advanceTimersByTimeAsync(9999);
    expect(sent).toHaveLength(1);
    expect(settled).toBe(false);
    expect(process.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3002);
    expect(settled).toBe(true);
    expect(await pending).toEqual({
      status: "failed",
      stage: "handshake",
      cleanupSafe: false,
      cleanupFailures: [{ processIndex: 0, stage: "stdio-drain" }],
    });
    expect(process.kill).toHaveBeenCalledExactlyOnceWith(800_000, "SIGKILL");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts a held response and observes cleanup despite abort", async () => {
    reply = () => {
      abort.abort();
    };
    expect(await settle()).toEqual({
      status: "failed",
      stage: "cancelled",
      cleanupSafe: true,
      cleanupFailures: [],
    });
    expect(process.kill).toHaveBeenCalledTimes(1);
  });
  it("preserves the exact secondary cleanup oracle", async () => {
    reply = (port) => {
      port.emit("messageerror", new Error("private"));
    };
    vi.mocked(process.kill).mockImplementation(() => {
      setTimeout(() => children[0]?.finish(1, false), 20);
      throw new Error("private kill");
    });
    const result = await settle();
    expect(result).toEqual({
      status: "failed",
      stage: "transport",
      cleanupSafe: false,
      cleanupFailures: [
        { processIndex: 0, stage: "cleanup" },
        { processIndex: 0, stage: "stdio-drain" },
      ],
    });
    if (result.status !== "failed") throw new Error("Expected failure");
    expect(Object.isFrozen(result.cleanupFailures)).toBe(true);
    expect(result.cleanupFailures.every(Object.isFrozen)).toBe(true);
    expect(children[0]?.listenerCount("error")).toBeGreaterThan(0);
  });
  it("retains an unconfirmed child and never treats kill return as exit", async () => {
    reply = (port) => {
      port.emit("messageerror");
    };
    vi.mocked(process.kill).mockReturnValue(true);
    expect(await settle()).toMatchObject({ status: "failed", cleanupSafe: false });
    expect(children[0]?.listenerCount("error")).toBeGreaterThan(0);
  });
});
