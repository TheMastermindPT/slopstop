import { randomUUID } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { isDeepStrictEqual } from "node:util";
import {
  type CanonicalCommandReceipt,
  type CanonicalProjectActivationResult,
  type CanonicalProjectCommandResult,
  createHandshakeCommand,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectSwitchCommand,
  type DesktopMessage,
  type HarnessBootstrap,
  HarnessBootstrapSchema,
  type HarnessMessage,
  HarnessMessageSchema,
  type ProjectActivationId,
  type ProjectId,
  type TypedCommand,
  WriterProofControlSchema,
  type WriterProofEvent,
  WriterProofEventSchema,
  WriterProofStartSchema,
  writerProofFirstCommand,
  writerProofInactiveActivationId,
  writerProofNextCommand,
  writerProofProjectId,
  writerProofStaleProjectId,
} from "@slopstop/protocol";
import {
  MessageChannelMain,
  type MessagePortMain,
  type UtilityProcess,
  utilityProcess,
} from "electron";
import {
  requireWriterProof,
  verifyPackagedWriterNative,
  WriterProofError,
  type WriterProofStage,
} from "./package-smoke-verifier.js";

const writerProofLimits = Object.freeze({
  proofMs: 90_000,
  stepMs: 10_000,
  takeoverMs: 15_000,
  takeoverDelayMs: 100,
  cleanStopMs: 5_000,
  cleanupMs: 10_000,
  drainMs: 3_000,
  outputBytesPerStream: 65_536,
  maxProcesses: 6,
  maxCleanupFailures: 24,
});
type WriterProofCleanupFailure = Readonly<{
  processIndex: number;
  stage: "cleanup" | "stdio-drain";
}>;
export type WriterProofOutcome =
  | Readonly<{ status: "passed"; cleanupSafe: true }>
  | Readonly<{
      status: "failed";
      stage: WriterProofStage;
      cleanupSafe: boolean;
      cleanupFailures: readonly WriterProofCleanupFailure[];
    }>;
type ProofInput = Readonly<{
  bootstrap: HarnessBootstrap;
  mainBundleDirectory: string;
  resourcesPath: string;
  signal: AbortSignal;
}>;
type Wait = Readonly<{
  deadline: number;
  stage: WriterProofStage;
  cleanup?: boolean;
  terminal?: boolean;
}>;
type StreamState = { ended: boolean; broken: boolean; bytes: number };
const metadata = () => ({ messageId: randomUUID(), sentAt: new Date().toISOString() });

class Proof {
  readonly owned: OwnedUtility[] = [];
  readonly changes = new Set<() => void>();
  readonly cleanupFailures: WriterProofCleanupFailure[] = [];
  readonly deadline = performance.now() + writerProofLimits.proofMs;
  first: WriterProofError | undefined;
  constructor(readonly input: ProofInput) {}
  notify(): void {
    for (const listener of this.changes) listener();
  }
  fail(stage: WriterProofStage): WriterProofError {
    if (this.first) return this.first;
    this.first = new WriterProofError(stage);
    this.notify();
    return this.first;
  }
  assert(deadline = this.deadline, stage: WriterProofStage = "proof-deadline"): void {
    if (this.first) throw this.first;
    if (this.input.signal.aborted) throw this.fail("cancelled");
    if (performance.now() >= Math.min(deadline, this.deadline)) throw this.fail(stage);
  }
  options(stage: WriterProofStage, maximum = this.deadline): Wait {
    return {
      stage,
      deadline: Math.min(maximum, this.deadline, performance.now() + writerProofLimits.stepMs),
    };
  }
  recordCleanup(processIndex: number, stage: WriterProofCleanupFailure["stage"]): void {
    // At most four catch sites per child; process admission is independently capped at six.
    this.cleanupFailures.push(Object.freeze({ processIndex, stage }));
    this.fail(stage);
  }
}

class OwnedUtility {
  readonly stdout: StreamState = { ended: false, broken: false, bytes: 0 };
  readonly stderr: StreamState = { ended: false, broken: false, bytes: 0 };
  readonly remove: Array<() => void> = [];
  readonly resumeStreams: Array<() => void> = [];
  spawned = false;
  terminal = false;
  expected: "none" | "clean" | "hard-kill" = "none";
  pid: number | undefined;
  exitCode: number | undefined;
  exitAt: number | undefined;
  sequence = 0;
  shutdownComplete = false;
  shutdownOutput = "";
  local: MessagePortMain | undefined;
  transferred: MessagePortMain | undefined;
  receiver: ((value: unknown) => void) | undefined;
  constructor(
    readonly child: UtilityProcess,
    readonly proof: Proof,
    readonly fixture: boolean,
  ) {}
  observe(): void {
    const spawn = () => {
      this.spawned = true;
      this.pid = this.child.pid;
      this.proof.notify();
    };
    const exit = (code: number) => {
      this.terminal = true;
      this.exitAt = performance.now();
      this.exitCode = code;
      this.checkExit(code);
      this.proof.notify();
      // Electron clears public stream listeners after delivering exit.
      queueMicrotask(() => {
        for (const resume of this.resumeStreams) resume();
      });
    };
    const error = () => {
      this.proof.fail("process-exit");
    };
    const message = () => {
      this.proof.fail("unexpected-message");
    };
    const disconnect = () => {
      if (this.expected === "none") this.proof.fail("transport");
    };
    this.child.once("spawn", spawn);
    this.child.once("exit", exit);
    const events: NodeJS.EventEmitter = this.child;
    this.child.on("error", error);
    this.child.on("message", message);
    events.on("disconnect", disconnect);
    this.remove.push(() => {
      this.child.off("spawn", spawn);
      this.child.off("exit", exit);
      this.child.off("error", error);
      this.child.off("message", message);
      events.off("disconnect", disconnect);
    });
    this.observeStream("stdout");
    this.observeStream("stderr");
  }
  checkExit(code: number): void {
    switch (this.expected) {
      case "none":
        this.proof.fail("process-exit");
        return;
      case "clean":
        if (code !== 0) this.proof.fail("clean-stop");
        return;
      case "hard-kill":
        if (!Number.isInteger(code) || code === 0) this.proof.fail("hard-kill");
    }
  }
  observeStream(name: "stdout" | "stderr"): void {
    const stream = this.child[name];
    const state = this[name];
    if (stream === null) {
      state.broken = true;
      this.proof.fail("stdio-drain");
      return;
    }
    const data = (chunk: unknown) => {
      const bytes = Buffer.isBuffer(chunk)
        ? chunk.byteLength
        : typeof chunk === "string"
          ? Buffer.byteLength(chunk)
          : 65_537;
      state.bytes = Math.min(65_537, state.bytes + bytes);
      if (state.bytes > writerProofLimits.outputBytesPerStream) this.proof.fail("output-bound");
      else if (name === "stdout") this.observeShutdownOutput(chunk);
    };
    const end = () => {
      state.ended = true;
      this.proof.notify();
    };
    const error = () => {
      state.broken = true;
      this.proof.fail("stdio-drain");
      this.proof.notify();
    };
    stream.on("data", data);
    stream.once("end", end);
    stream.on("error", error);
    this.resumeStreams.push(() => {
      if (state.ended) return;
      stream.off("data", data);
      stream.off("end", end);
      stream.off("error", error);
      stream.on("data", data);
      stream.once("end", end);
      stream.on("error", error);
    });
    this.remove.push(() => {
      stream.off("data", data);
      stream.off("end", end);
      stream.off("error", error);
    });
  }
  get drained(): boolean {
    return this.stdout.ended && this.stderr.ended && !this.stdout.broken && !this.stderr.broken;
  }
  observeShutdownOutput(chunk: unknown): void {
    if (this.fixture) return;
    this.shutdownOutput += String(chunk);
    const lines = this.shutdownOutput.split("\n");
    this.shutdownOutput = lines.pop() ?? "";
    for (const line of lines) {
      if (!isRuntimeShutdownWitness(line)) continue;
      if (this.expected !== "clean" || this.shutdownComplete) {
        this.proof.fail("clean-stop");
        return;
      }
      this.shutdownComplete = true;
      this.proof.notify();
    }
  }
  receive(value: unknown): void {
    if (!this.receiver) {
      this.proof.fail("unexpected-message");
      return;
    }
    try {
      this.receiver(value);
    } catch (error) {
      this.proof.fail(error instanceof WriterProofError ? error.stage : "unexpected-message");
    }
  }
  attach(): void {
    const { port1, port2 } = new MessageChannelMain();
    this.transferred = port1;
    this.local = port2;
    const message = (event: Readonly<{ data: unknown }>) => this.receive(event.data);
    const close = () => {
      if (this.expected === "none") this.proof.fail("transport");
    };
    const error = () => {
      this.proof.fail("transport");
    };
    port2.on("message", message);
    port2.on("close", close);
    const events: NodeJS.EventEmitter = port2;
    events.on("messageerror", error);
    events.on("error", error);
    this.remove.push(() => {
      port2.off("message", message);
      port2.off("close", close);
      events.off("messageerror", error);
      events.off("error", error);
    });
    port2.start();
  }
  checkWait(options: Wait): void {
    if (!options.cleanup) this.proof.assert(options.deadline, options.stage);
    requireWriterProof(performance.now() < options.deadline, options.stage);
    requireWriterProof(options.terminal === true || !this.terminal, "process-exit");
  }
  async wait(predicate: () => boolean, options: Wait): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        this.proof.changes.delete(check);
        if (error === undefined) resolve();
        else reject(error);
      };
      const check = () => {
        if (settled) return;
        try {
          this.checkWait(options);
          if (predicate()) finish();
          if (!settled) {
            clearTimeout(timer);
            timer = setTimeout(check, Math.max(1, Math.ceil(options.deadline - performance.now())));
          }
        } catch (error) {
          finish(error);
        }
      };
      this.proof.changes.add(check);
      check();
    });
    this.checkWait(options);
  }
  async exchange<T>(send: () => unknown, parse: (value: unknown) => T, options: Wait): Promise<T> {
    this.proof.assert(options.deadline, options.stage);
    requireWriterProof(!this.receiver && !this.terminal, "transport");
    const response: { value?: { data: T } } = {};
    this.receiver = (value) => {
      requireWriterProof(!response.value, "unexpected-message");
      response.value = { data: parse(value) };
      this.proof.notify();
    };
    try {
      this.proof.assert(options.deadline, options.stage);
      try {
        requireWriterProof(send() !== false, "transport");
      } catch {
        throw this.proof.fail("transport");
      }
      await this.wait(() => response.value !== undefined, options);
      requireWriterProof(response.value !== undefined, "transport");
      return response.value.data;
    } finally {
      this.receiver = undefined;
    }
  }
  hardKill(): void {
    requireWriterProof(
      !this.terminal &&
        this.pid !== undefined &&
        Number.isSafeInteger(this.pid) &&
        this.pid > 0 &&
        this.pid !== process.pid &&
        this.pid === this.child.pid,
      "hard-kill",
    );
    this.expected = "hard-kill";
    process.kill(this.pid, "SIGKILL");
  }
  close(): void {
    this.local?.close();
    this.transferred?.close();
  }
}

function isRuntimeShutdownWitness(line: string): boolean {
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== "object" || value === null) return false;
    const fields = { level: 30, service: "harness", msg: "Harness message port closed." };
    return (
      Object.keys(value).length === 4 &&
      Number.isSafeInteger(Reflect.get(value, "time")) &&
      Object.entries(fields).every(([key, expected]) => Reflect.get(value, key) === expected)
    );
  } catch {
    return false;
  }
}

function proofEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "NODE_PATH",
    "NODE_OPTIONS",
    "SLOPSTOP_PACKAGE_SMOKE_TOKEN",
    "SLOPSTOP_PACKAGE_SMOKE_USER_DATA",
    "SLOPSTOP_PACKAGE_SMOKE_SCENARIO",
    "SLOPSTOP_PACKAGE_SMOKE",
  ])
    delete env[key];
  env["SLOPSTOP_LOG_LEVEL"] = "info";
  return env;
}
function validateSpawnIdentity(owner: OwnedUtility): void {
  requireWriterProof(
    owner.pid !== undefined &&
      Number.isSafeInteger(owner.pid) &&
      owner.pid > 0 &&
      owner.pid !== process.pid &&
      owner.proof.owned.every((other) => other === owner || other.pid !== owner.pid),
    "spawn",
  );
}
async function spawn(
  proof: Proof,
  fixture = false,
  maximum = proof.deadline,
): Promise<OwnedUtility> {
  const options = proof.options("spawn", maximum);
  proof.assert(options.deadline, "spawn");
  requireWriterProof(proof.owned.length < writerProofLimits.maxProcesses, "spawn");
  const child = utilityProcess.fork(
    path.join(
      proof.input.mainBundleDirectory,
      fixture ? "writer-proof-fixture.cjs" : "harness.cjs",
    ),
    [],
    {
      stdio: "pipe",
      env: proofEnvironment(),
      serviceName: "SlopStop Writer Proof",
    },
  );
  const owner = new OwnedUtility(child, proof, fixture);
  proof.owned.push(owner);
  owner.observe();
  await owner.wait(() => owner.spawned, options);
  validateSpawnIdentity(owner);
  proof.assert(options.deadline, "spawn");
  try {
    owner.attach();
    proof.assert(options.deadline, "spawn");
    if (!fixture) {
      requireWriterProof(owner.transferred !== undefined, "transport");
      const sent: unknown = child.postMessage(HarnessBootstrapSchema.parse(proof.input.bootstrap), [
        owner.transferred,
      ]);
      requireWriterProof(sent !== false, "transport");
    }
  } catch {
    throw proof.fail("transport");
  }
  if (!fixture)
    await call(
      owner,
      createHandshakeCommand(metadata(), "0.0.0"),
      "system.ready",
      "handshake",
      maximum,
    );
  return owner;
}
async function call(
  owner: OwnedUtility,
  command: DesktopMessage,
  event: HarnessMessage["event"],
  stage: WriterProofStage,
  maximum = owner.proof.deadline,
): Promise<HarnessMessage> {
  return owner.exchange(
    () => {
      requireWriterProof(owner.local !== undefined, "transport");
      return owner.local.postMessage(command);
    },
    (raw) => {
      const result = HarnessMessageSchema.parse(raw);
      requireWriterProof(
        result.event === event &&
          result.causationId === command.messageId &&
          result.sequence === owner.sequence + 1,
        "unexpected-message",
      );
      owner.sequence = result.sequence;
      return result;
    },
    owner.proof.options(stage, maximum),
  );
}
async function cleanupOwner(owner: OwnedUtility, index: number, deadline: number): Promise<void> {
  const options: Wait = { cleanup: true, terminal: true, deadline, stage: "cleanup" };
  if (!owner.terminal) {
    try {
      if (!owner.spawned) await owner.wait(() => owner.spawned || owner.terminal, options);
      if (!owner.terminal) owner.hardKill();
    } catch {
      owner.proof.recordCleanup(index, "cleanup");
    }
    try {
      await owner.wait(() => owner.terminal, options);
    } catch {
      owner.proof.recordCleanup(index, "cleanup");
    }
  }
  if (!owner.terminal) return;
  try {
    await owner.wait(() => owner.drained, {
      ...options,
      deadline: Math.min(deadline, performance.now() + writerProofLimits.drainMs),
      stage: "stdio-drain",
    });
  } catch {
    owner.proof.recordCleanup(index, "stdio-drain");
  }
  if (!owner.drained) return;
  try {
    owner.close();
    for (const remove of owner.remove) remove();
  } catch {
    owner.proof.recordCleanup(index, "cleanup");
  }
}

async function stopClean(owner: OwnedUtility): Promise<void> {
  const options = owner.proof.options(
    "clean-stop",
    performance.now() + writerProofLimits.cleanStopMs,
  );
  owner.proof.assert(options.deadline, "clean-stop");
  requireWriterProof(!owner.terminal, "clean-stop");
  owner.expected = "clean";
  owner.close();
  await owner.wait(() => owner.terminal || owner.shutdownComplete, { ...options, terminal: true });
  if (!owner.terminal) stopCompletedService(owner, options);
  await owner.wait(() => owner.terminal, { ...options, terminal: true });
  await owner.wait(() => owner.drained, {
    ...options,
    deadline: Math.min(options.deadline, performance.now() + writerProofLimits.drainMs),
    terminal: true,
    stage: "stdio-drain",
  });
}
function stopCompletedService(owner: OwnedUtility, options: Wait): void {
  owner.proof.assert(options.deadline, "clean-stop");
  validateSpawnIdentity(owner);
  requireWriterProof(
    owner.pid === owner.child.pid && owner.shutdownComplete && !owner.fixture,
    "clean-stop",
  );
  try {
    requireWriterProof(owner.child.kill(), "clean-stop");
  } catch {
    throw owner.proof.fail("clean-stop");
  }
}
type Writable = Extract<CanonicalProjectActivationResult, { access: "read-write" }>;
async function activate(
  owner: OwnedUtility,
  projectId: ProjectId,
  maximum = owner.proof.deadline,
): Promise<CanonicalProjectActivationResult> {
  const event = await call(
    owner,
    createProjectActivateCommand(metadata(), { projectId }),
    "project.activate.result",
    "activate",
    maximum,
  );
  requireWriterProof(event.event === "project.activate.result", "activate");
  requireWriterProof(event.payload.request.projectId === projectId, "activate");
  return event.payload;
}
async function command(
  owner: OwnedUtility,
  activationId: ProjectActivationId,
  value: TypedCommand,
  wait: WriterProofStage | Readonly<{ stage: WriterProofStage; maximum: number }>,
): Promise<CanonicalProjectCommandResult> {
  const { stage, maximum } =
    typeof wait === "string" ? { stage: wait, maximum: owner.proof.deadline } : wait;
  const event = await call(
    owner,
    createProjectCommand(metadata(), {
      projectId: writerProofProjectId,
      activationId,
      command: value,
    }),
    "project.command.result",
    stage,
    maximum,
  );
  requireWriterProof(event.event === "project.command.result", stage);
  requireWriterProof(
    event.payload.projectId === writerProofProjectId &&
      event.payload.activationId === activationId &&
      event.payload.commandId === value.commandId,
    stage,
  );
  return event.payload;
}
function settled(
  result: CanonicalProjectCommandResult,
  stage: WriterProofStage,
): CanonicalCommandReceipt {
  requireWriterProof(result.status === "settled", stage);
  return result.receipt;
}
function writable(result: CanonicalProjectActivationResult, generation: 1 | 2): Writable {
  requireWriterProof(
    result.status === "active" &&
      result.access === "read-write" &&
      result.writerGeneration === generation,
    "activate",
  );
  return result;
}
function readOnly(
  result: CanonicalProjectActivationResult,
): asserts result is Extract<CanonicalProjectActivationResult, { access: "read-only" }> {
  requireWriterProof(
    result.status === "active" &&
      result.access === "read-only" &&
      result.writerGeneration === null &&
      result.diagnostic.code === "WRITER_UNAVAILABLE" &&
      result.diagnostic.retryable &&
      result.diagnostic.message === "Another SlopStop process holds Project write authority.",
    "contention",
  );
}
function denial(
  result: CanonicalProjectCommandResult,
  status: "inactive" | "read-only" | "stale-activation",
): void {
  const expected = {
    inactive: {
      code: "PROJECT_INACTIVE",
      message: "No Project is active for Typed commands.",
      retryable: false,
    },
    "read-only": {
      code: "WRITER_UNAVAILABLE",
      message: "The active Project has no write authority.",
      retryable: true,
    },
    "stale-activation": {
      code: "PROJECT_ACTIVATION_STALE",
      message: "The command activation is stale.",
      retryable: false,
    },
  };
  requireWriterProof(
    result.status === status && isDeepStrictEqual(result.diagnostic, expected[status]),
    status,
  );
}
function rejectedReceipt(
  receipt: CanonicalCommandReceipt,
  value: TypedCommand,
  sequence: 1 | 2,
): void {
  requireWriterProof(
    receipt.projectId === writerProofProjectId &&
      receipt.commandId === value.commandId &&
      receipt.commandType === value.type &&
      receipt.commandVersion === value.version &&
      receipt.projectSequence === sequence &&
      receipt.writerGeneration === sequence &&
      receipt.events.length === 0 &&
      receipt.outcome === "rejected" &&
      receipt.rejection.code === "COMMAND_TYPE_UNSUPPORTED" &&
      !receipt.rejection.retryable,
    sequence === 1 ? "first-settlement" : "next-settlement",
  );
}
async function crash(holder: OwnedUtility): Promise<number> {
  const options = holder.proof.options("hard-kill");
  holder.proof.assert(options.deadline, "hard-kill");
  holder.hardKill();
  await holder.wait(() => holder.terminal, { ...options, terminal: true });
  requireWriterProof(holder.exitAt !== undefined, "hard-kill");
  const deadline = Math.min(holder.proof.deadline, holder.exitAt + writerProofLimits.takeoverMs);
  await holder.wait(() => holder.drained, {
    deadline: Math.min(deadline, performance.now() + writerProofLimits.drainMs),
    stage: "stdio-drain",
    terminal: true,
  });
  return deadline;
}
async function takeover(owner: OwnedUtility, maximum: number): Promise<Writable> {
  let result = await activate(owner, writerProofProjectId, maximum);
  while (result.status === "active" && result.access === "read-only") {
    readOnly(result);
    const from = { projectId: writerProofProjectId, activationId: result.activationId };
    let elapsed = false;
    const timer = setTimeout(() => {
      elapsed = true;
      owner.proof.notify();
    }, writerProofLimits.takeoverDelayMs);
    try {
      await owner.wait(() => elapsed, owner.proof.options("takeover", maximum));
    } finally {
      clearTimeout(timer);
    }
    const event = await call(
      owner,
      createProjectSwitchCommand(metadata(), {
        from,
        to: { projectId: writerProofProjectId },
      }),
      "project.switch.result",
      "takeover",
      maximum,
    );
    requireWriterProof(
      event.event === "project.switch.result" && event.payload.status === "target-result",
      "takeover",
    );
    requireWriterProof(
      isDeepStrictEqual(event.payload.request, { from, to: { projectId: writerProofProjectId } }) &&
        event.payload.target.request.projectId === writerProofProjectId,
      "takeover",
    );
    result = event.payload.target;
  }
  return writable(result, 2);
}
type Fixture = Readonly<{ owner: OwnedUtility; proofId: string }>;
async function connectFixture(proof: Proof): Promise<Fixture> {
  const owner = await spawn(proof, true);
  proof.assert();
  const proofId = randomUUID();
  requireWriterProof(owner.transferred !== undefined, "transport");
  const start = WriterProofStartSchema.parse({
    version: 1,
    kind: "writer-proof.connect",
    proofId,
    bootstrap: proof.input.bootstrap,
  });
  const sent: unknown = owner.child.postMessage(start, [owner.transferred]);
  requireWriterProof(sent !== false, "transport");
  return { owner, proofId };
}
async function control(
  fixture: Fixture,
  value: Record<string, unknown>,
  stage: WriterProofStage,
): Promise<WriterProofEvent> {
  const request = WriterProofControlSchema.parse({
    version: 1,
    kind: "writer-proof.control",
    proofId: fixture.proofId,
    requestId: randomUUID(),
    ...value,
  });
  return fixture.owner.exchange(
    () => {
      requireWriterProof(fixture.owner.local !== undefined, "transport");
      return fixture.owner.local.postMessage(request);
    },
    (raw) => {
      const event = WriterProofEventSchema.parse(raw);
      requireWriterProof(
        event.proofId === request.proofId &&
          event.requestId === request.requestId &&
          event.step === request.step &&
          event.stepNumber === request.stepNumber,
        "unexpected-message",
      );
      if ("native" in event)
        requireWriterProof(
          event.native.target === `${process.platform}-${process.arch}`,
          "native-preflight",
        );
      return event;
    },
    fixture.owner.proof.options(stage),
  );
}
async function staleProof(proof: Proof): Promise<void> {
  const fixture = await connectFixture(proof);
  const initialized = await control(
    fixture,
    { step: "stale.initialize", stepNumber: 1 },
    "stale-initialize",
  );
  requireWriterProof(initialized.step === "stale.initialize", "stale-initialize");
  await control(fixture, { step: "stale.release", stepNumber: 2 }, "stale-release");
  const replacement = await spawn(proof);
  const active = writable(await activate(replacement, writerProofStaleProjectId), 2);
  requireWriterProof(
    active.activationId !== initialized.activationId && !fixture.owner.terminal,
    "stale-attempt",
  );
  const attempt = await control(
    fixture,
    {
      step: "stale.attempt",
      stepNumber: 3,
      replacementActivationId: active.activationId,
      replacementWriterGeneration: 2,
    },
    "stale-attempt",
  );
  requireWriterProof(
    attempt.step === "stale.attempt" &&
      attempt.activationId === initialized.activationId &&
      attempt.replacementActivationId === active.activationId &&
      !fixture.owner.terminal &&
      !replacement.terminal,
    "stale-attempt",
  );
  await control(fixture, { step: "stale.finish", stepNumber: 4 }, "stale-finish");
  await stopClean(fixture.owner);
  await stopClean(replacement);
}
async function startHolder(proof: Proof) {
  const holder = await spawn(proof);
  denial(
    await command(holder, writerProofInactiveActivationId, writerProofFirstCommand, "inactive"),
    "inactive",
  );
  const firstActivation = writable(await activate(holder, writerProofProjectId), 1);
  const first = settled(
    await command(
      holder,
      firstActivation.activationId,
      writerProofFirstCommand,
      "first-settlement",
    ),
    "first-settlement",
  );
  rejectedReceipt(first, writerProofFirstCommand, 1);
  return { holder, firstActivation, first };
}
async function sequence(proof: Proof): Promise<void> {
  const { holder, firstActivation, first } = await startHolder(proof);
  const contender = await spawn(proof);
  const contended = await activate(contender, writerProofProjectId);
  readOnly(contended);
  denial(
    await command(contender, contended.activationId, writerProofFirstCommand, "read-only"),
    "read-only",
  );
  await stopClean(contender);
  const maximum = await crash(holder);
  const replacement = await spawn(proof, false, maximum);
  denial(
    await command(replacement, firstActivation.activationId, writerProofFirstCommand, {
      stage: "inactive",
      maximum,
    }),
    "inactive",
  );
  const secondActivation = await takeover(replacement, maximum);
  requireWriterProof(secondActivation.activationId !== firstActivation.activationId, "takeover");
  const replay = settled(
    await command(replacement, secondActivation.activationId, writerProofFirstCommand, "replay"),
    "replay",
  );
  requireWriterProof(isDeepStrictEqual(first, replay), "replay");
  denial(
    await command(
      replacement,
      firstActivation.activationId,
      writerProofFirstCommand,
      "stale-activation",
    ),
    "stale-activation",
  );
  const second = settled(
    await command(
      replacement,
      secondActivation.activationId,
      writerProofNextCommand,
      "next-settlement",
    ),
    "next-settlement",
  );
  rejectedReceipt(second, writerProofNextCommand, 2);
  requireWriterProof(second.receiptId !== first.receiptId, "next-settlement");
  await stopClean(replacement);
  const audit = await connectFixture(proof);
  await control(
    audit,
    {
      step: "audit.initialize",
      stepNumber: 1,
      activationIds: [firstActivation.activationId, secondActivation.activationId],
      expectedReceipts: [first, second],
    },
    "audit",
  );
  await stopClean(audit.owner);
  await staleProof(proof);
  proof.assert();
}

export async function runCanonicalWriterPackageSmoke(
  input: ProofInput,
): Promise<WriterProofOutcome> {
  const proof = new Proof(input);
  const abort = () => {
    proof.fail("cancelled");
  };
  input.signal.addEventListener("abort", abort, { once: true });
  try {
    proof.assert();
    verifyPackagedWriterNative(input);
    await sequence(proof);
  } catch (error) {
    proof.fail(error instanceof WriterProofError ? error.stage : "internal");
  }
  const deadline = performance.now() + writerProofLimits.cleanupMs;
  await Promise.all(proof.owned.map((owner, index) => cleanupOwner(owner, index, deadline)));
  const cleanupSafe = proof.owned.every((owner) => owner.terminal && owner.drained);
  input.signal.removeEventListener("abort", abort);
  if (!cleanupSafe) proof.fail("cleanup");
  const first = proof.first;
  return first === undefined
    ? { status: "passed", cleanupSafe: true }
    : {
        status: "failed",
        stage: first.stage,
        cleanupSafe,
        cleanupFailures: Object.freeze([...proof.cleanupFailures]),
      };
}
