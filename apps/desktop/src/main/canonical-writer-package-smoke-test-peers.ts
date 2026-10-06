import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { decodeStrict, HarnessBootstrapSchema } from "@slopstop/protocol";
import { type Mock, vi } from "vitest";

export const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const bootstrap = decodeStrict(HarnessBootstrapSchema, {
  kind: "harness.connect",
  applicationStorageRootUrl: "file:///C:/proof/user/storage",
  migrationResourcesRootUrl: "file:///C:/proof/migrations",
});
export class ScriptedPort extends EventEmitter {
  closed = false;
  start = vi.fn();
  send: (value: unknown) => unknown = () => undefined;
  postMessage(value: unknown): unknown {
    return this.send(value);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.emit("close");
  }
}
export class ScriptedChild extends EventEmitter {
  pid: number | undefined;
  stdout: PassThrough | null = new PassThrough();
  stderr: PassThrough | null = new PassThrough();
  port: ScriptedPort | undefined;
  transfer = vi.fn();
  kill = vi.fn();
  postMessage(value: unknown, ports: ScriptedPort[]): unknown {
    return this.transfer(value, ports);
  }
  finish(code = 0, stdout = true, stderr = true): void {
    this.emit("exit", code);
    if (stdout) this.stdout?.emit("end");
    if (stderr) this.stderr?.emit("end");
    this.pid = undefined;
  }
}
export function electronExitStreams(child: ScriptedChild): void {
  child.finish = (code = 0, stdout = true, stderr = true) => {
    const streams = [child.stdout, child.stderr];
    child.emit("exit", code);
    for (const stream of streams) stream?.removeAllListeners();
    child.pid = undefined;
    setTimeout(() => {
      if (stdout) streams[0]?.end();
      if (stderr) streams[1]?.end();
    }, 0);
  };
}
export function completedServiceStop(child: ScriptedChild, mode: string): void {
  child.kill.mockImplementation(() => {
    if (mode === "false-kill") return false;
    if (mode === "throw-kill") throw new Error("private utility kill failure");
    child.finish(0);
    return true;
  });
  if (mode !== "missing-witness") {
    child.stdout?.write(
      `${JSON.stringify({ level: 30, time: 1, service: "harness", msg: "Harness message port closed." })}\n`,
    );
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("Invalid scripted request");
  return value as Record<string, unknown>;
}
export function ready(command: Record<string, unknown>): Record<string, unknown> {
  return {
    protocolVersion: 6,
    messageType: "event",
    messageId: id(900),
    sentAt: "2026-09-05T12:00:01.000Z",
    causationId: command["messageId"],
    sequence: 1,
    event: "system.ready",
    payload: { harnessVersion: "0.0.0" },
  };
}
export const receipt = (sequence: 1 | 2) => ({
  receiptId: id(150 + sequence),
  projectId: id(101),
  commandId: id(130 + sequence),
  commandType: "conformance.writer.noop",
  commandVersion: 1,
  projectSequence: sequence,
  writerGeneration: sequence,
  settledAt: `2026-09-05T12:00:0${sequence}.000Z`,
  outcome: "rejected",
  events: [],
  rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
});
const native = () => ({
  packageName: "fs-native-extensions",
  packageVersion: "1.5.1",
  target: `${process.platform}-${process.arch}`,
  unpackedTargetBinding: true,
  fallbackLoaded: false,
});
export function activation(index: number, request: unknown) {
  if (index === 1)
    return {
      status: "active",
      request,
      access: "read-only",
      activationId: id(145),
      writerGeneration: null,
      diagnostic: {
        code: "WRITER_UNAVAILABLE",
        message: "Another SlopStop process holds Project write authority.",
        retryable: true,
      },
    };
  return {
    status: "active",
    request,
    access: "read-write",
    activationId: id(index === 5 ? 144 : index === 0 ? 141 : 142),
    writerGeneration: index === 0 ? 1 : 2,
  };
}
function deniedCommand(
  request: Record<string, unknown>,
  failure: Readonly<{ status: string; code: string; message: string }>,
) {
  const { status, code, message } = failure;
  return {
    status,
    projectId: request["projectId"],
    activationId: request["activationId"],
    commandId: record(request["command"])["commandId"],
    diagnostic: { code, message, retryable: status === "read-only" },
  };
}
function commandDenial(index: number, count: number, request: Record<string, unknown>) {
  if (count === 0 && index !== 1)
    return deniedCommand(request, {
      status: "inactive",
      code: "PROJECT_INACTIVE",
      message: "No Project is active for Typed commands.",
    });
  if (index === 1)
    return deniedCommand(request, {
      status: "read-only",
      code: "WRITER_UNAVAILABLE",
      message: "The active Project has no write authority.",
    });
  if (index === 2 && request["activationId"] === id(141))
    return deniedCommand(request, {
      status: "stale-activation",
      code: "PROJECT_ACTIVATION_STALE",
      message: "The command activation is stale.",
    });
  return undefined;
}
function commandResult(index: number, count: number, request: Record<string, unknown>) {
  const denial = commandDenial(index, count, request);
  if (denial !== undefined) return denial;
  return {
    status: "settled",
    projectId: id(101),
    activationId: request["activationId"],
    commandId: record(request["command"])["commandId"],
    receipt: receipt(record(request["command"])["commandId"] === id(132) ? 2 : 1),
  };
}
export function fixtureResult(request: Record<string, unknown>) {
  const base = {
    version: 1,
    kind: "writer-proof.result",
    proofId: request["proofId"],
    requestId: request["requestId"],
    step: request["step"],
    stepNumber: request["stepNumber"],
  };
  switch (request["step"]) {
    case "audit.initialize":
      return {
        ...base,
        projectId: id(101),
        audit: "exact-ledger-and-abandoned-recovery",
        lastProjectSequence: 2,
        lastWriterGeneration: 2,
        receipts: 2,
        rejections: 2,
        idempotency: 2,
        events: 0,
        generations: 2,
        handoffs: 2,
        abandonedRecoveryRecords: 1,
        uncertainRecoveryRecords: 0,
        fence: "released",
        native: native(),
      };
    case "stale.initialize":
      return {
        ...base,
        projectId: id(104),
        activationId: id(143),
        writerGeneration: 1,
        native: native(),
      };
    case "stale.release":
      return { ...base, testLeaseReleased: true, oldWriterRetained: true };
    case "stale.attempt":
      return {
        ...base,
        projectId: id(104),
        activationId: id(143),
        commandId: id(133),
        replacementActivationId: id(144),
        replacementWriterGeneration: 2,
        status: "stale-writer",
        code: "WRITER_FENCE_STALE",
        retryable: false,
        allCanonicalRowsUnchanged: true,
        registryCalls: 0,
        handlerCalls: 0,
        identityCalls: 0,
        settlementClockCalls: 0,
        writerClose: "stale-refused",
        operationalReleaseAuthorized: false,
      };
    case "stale.finish":
      return { ...base, teardown: "test-resources-only" };
    default:
      throw new Error("Unexpected fixture control");
  }
}
export function productionResponse(
  index: number,
  request: Record<string, unknown>,
  sequences: Map<number, number>,
  commands: Map<number, number>,
) {
  const kind = request["command"];
  const sequence = (sequences.get(index) ?? 0) + 1;
  sequences.set(index, sequence);
  return {
    ...ready(request),
    sequence,
    payload: productionPayload(index, request, commands),
    event: kind === "system.handshake" ? "system.ready" : `${kind}.result`,
  };
}
function productionPayload(
  index: number,
  request: Record<string, unknown>,
  commands: Map<number, number>,
): unknown {
  const kind = request["command"];
  if (kind === "project.activate") return activation(index, request["payload"]);
  if (kind === "project.switch")
    return {
      status: "target-result",
      request: request["payload"],
      target: activation(index, record(request["payload"])["to"]),
    };
  if (kind !== "project.command") return { harnessVersion: "0.0.0" };
  const count = commands.get(index) ?? 0;
  commands.set(index, count + 1);
  return commandResult(index, count, record(request["payload"]));
}
export function fixtureContradiction(
  variant: string,
  response: Record<string, unknown>,
  port: ScriptedPort,
): unknown {
  const patches: Record<string, Record<string, unknown>> = {
    proofId: { proofId: id(999) },
    requestId: { requestId: id(999) },
    stepNumber: { stepNumber: 4 },
    extra: { private: "private" },
    "native-target": {
      native: { ...native(), target: process.platform === "win32" ? "linux-x64" : "win32-x64" },
    },
    "old-epoch": { activationId: id(145) },
    "replacement-epoch": { replacementActivationId: id(145) },
  };
  if (variant === "duplicate") port.emit("message", { data: response });
  return { ...response, ...patches[variant] };
}

export const semanticContradictions = [
  [
    "inactive status",
    "0:project.command",
    2,
    {
      status: "read-only",
      diagnostic: {
        code: "WRITER_UNAVAILABLE",
        message: "The active Project has no write authority.",
        retryable: true,
      },
    },
  ],
  [
    "inactive diagnostic",
    "0:project.command",
    2,
    { diagnostic: { code: "PROJECT_INACTIVE", message: "wrong", retryable: false } },
  ],
  ["contender access", "1:project.activate", 2, activation(0, { projectId: id(101) })],
  [
    "contender message",
    "1:project.activate",
    2,
    { diagnostic: { code: "WRITER_UNAVAILABLE", message: "wrong", retryable: true } },
  ],
  [
    "denial message",
    "1:project.command",
    3,
    { diagnostic: { code: "WRITER_UNAVAILABLE", message: "wrong", retryable: true } },
  ],
  ["first generation", "0:project.command", 4, { receipt: { ...receipt(1), writerGeneration: 2 } }],
  ["first sequence", "0:project.command", 4, { receipt: { ...receipt(1), projectSequence: 2 } }],
  [
    "first outcome",
    "0:project.command",
    4,
    { receipt: { ...receipt(1), rejection: { code: "OTHER", retryable: false } } },
  ],
  [
    "replay time",
    "2:project.command",
    4,
    { receipt: { ...receipt(1), settledAt: "2026-09-05T12:00:02.000Z" } },
  ],
  [
    "replay generation",
    "2:project.command",
    4,
    { receipt: { ...receipt(1), writerGeneration: 2 } },
  ],
  [
    "stale diagnostic",
    "2:project.command",
    5,
    { diagnostic: { code: "PROJECT_ACTIVATION_STALE", message: "wrong", retryable: false } },
  ],
  [
    "next receipt identity",
    "2:project.command",
    6,
    { receipt: { ...receipt(2), receiptId: id(151) } },
  ],
  [
    "next receipt generation",
    "2:project.command",
    6,
    { receipt: { ...receipt(2), writerGeneration: 1 } },
  ],
] as const;

export function transportContradiction(
  mode: string,
  response: Record<string, unknown>,
  port: ScriptedPort,
  children: ScriptedChild[],
): unknown {
  switch (mode) {
    case "late-old-peer":
      children[0]?.port?.emit("message", { data: response });
      return undefined;
    case "child-disconnect":
      children[0]?.emit("disconnect");
      return undefined;
    case "late-after-timeout":
      setTimeout(() => port.emit("message", { data: response }), 10001);
      return undefined;
    case "cross-peer":
      return { ...response, causationId: id(999) };
    default:
      return failureEnvelope(mode, response);
  }
}
function failureEnvelope(mode: string, response: Record<string, unknown>): unknown {
  if (!mode.includes("failure")) return response;
  return {
    ...response,
    event: mode,
    causationId: mode === "system.failure" ? null : response["causationId"],
    payload: { code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed.", retryable: false },
  };
}
export function unsolicitedStart(
  channel: Mock<() => { port1: ScriptedPort; port2: ScriptedPort }>,
  reached: () => void,
): void {
  const original = channel.getMockImplementation();
  if (!original) throw new Error("No channel");
  channel.mockImplementation(() => {
    const pair = original();
    pair.port2.start.mockImplementation(() => {
      reached();
      pair.port2.emit("message", { data: ready({ messageId: id(1) }) });
    });
    return pair;
  });
}
export function fixtureTransferFault(
  child: ScriptedChild,
  mode: string,
  reached: () => void,
): void {
  child.transfer.mockImplementation(() => {
    reached();
    if (mode === "transfer-throw") throw new Error("private");
    if (mode === "transfer-false") return false;
    if (mode === "direct-parent") {
      child.emit("message", {});
      return undefined;
    }
    if (!child.port) throw new Error("No port");
    child.port.send = () => failFixtureSend(mode);
    return undefined;
  });
}
function failFixtureSend(mode: string): false {
  if (mode === "send-throw") throw new Error("private");
  return false;
}
export function installCleanupKillFailures(children: ScriptedChild[]): void {
  const kill = vi.mocked(process.kill).getMockImplementation();
  vi.mocked(process.kill).mockImplementation((pid, signal) => {
    if (pid === 800_000) {
      if (!kill) throw new Error("No kill");
      return kill(pid, signal);
    }
    setTimeout(() => children.find((child) => child.pid === pid)?.finish(1), 20);
    throw new Error("private");
  });
}
export function delayHolderEOF(children: ScriptedChild[], exited: () => void): void {
  const kill = vi.mocked(process.kill).getMockImplementation();
  vi.mocked(process.kill).mockImplementation((pid, signal) => {
    if (pid !== 800_000) {
      if (!kill) throw new Error("No kill");
      return kill(pid, signal);
    }
    exited();
    children[0]?.finish(1, false, false);
    setTimeout(() => endScriptedStreams(children[0]), 2999);
    return true;
  });
}
function endScriptedStreams(child: ScriptedChild | undefined): void {
  child?.stdout?.emit("end");
  child?.stderr?.emit("end");
}
export function beforeSpawnObservation(mode: string, child: ScriptedChild): void {
  if (mode === "exit-before-spawn") setTimeout(() => child.finish(1), 1);
  if (mode === "spawn-without-pid") setTimeout(() => child.emit("spawn"), 1);
}
export function failAllOwnedStreams(children: ScriptedChild[]): void {
  children[0]?.emit("message", {});
  for (const child of children) child.stdout?.emit("error", new Error("private"));
}

export const refusedTakeovers: Readonly<Record<string, unknown>> = {
  "not-registered": { status: "not-registered", request: { projectId: id(101) } },
  malformed: { status: "active", request: { projectId: id(101) } },
  "safe-mode": {
    status: "safe-mode",
    request: { projectId: id(101) },
    identity: {
      storageId: null,
      generationId: null,
      canonicalDatabaseLineageId: null,
      runtimeDatabaseLineageId: null,
    },
    canonicalHealth: {
      status: "missing",
      diagnostic: { code: "DATABASE_MISSING", message: "missing" },
    },
    runtimeHealth: { status: "healthy" },
  },
};
export function switchContradiction(
  input: Readonly<{ variant: string; response: Record<string, unknown> }>,
): unknown {
  const { variant, response } = input;
  const payload = record(response["payload"]);
  if (variant === "wrong-source")
    return {
      ...response,
      payload: {
        ...payload,
        request: {
          from: { projectId: id(101), activationId: id(999) },
          to: { projectId: id(101) },
        },
      },
    };
  if (variant === "stale-source")
    return {
      ...response,
      payload: {
        status: "stale-activation",
        request: payload["request"],
        diagnostic: {
          code: "PROJECT_ACTIVATION_STALE",
          message: "The switch activation is stale.",
          retryable: false,
        },
      },
    };
  return response;
}
