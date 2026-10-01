import path from "node:path";
import * as koffi from "koffi";
import type { ObserverFailureTrigger } from "../project-registration-observer.js";
import {
  type IdentityQueryChildPort,
  type IdentityQueryChildRequest,
  IdentityQueryKindSchema,
  identityQueryArguments,
} from "./identity-query-child.js";
import { type ObserverClock, systemObserverClock } from "./observer-clock.js";
import {
  REGISTRATION_CLEANUP_BUDGET_MS,
  REGISTRATION_STREAM_BYTE_LIMIT,
} from "./observer-limits.js";
import type {
  GitVersionChildPort,
  ObserverTerminalProof,
} from "./version-observation-execution.js";
import {
  createWindowsObserverApi,
  nativeInteger,
  readWindowsBuffer,
  requireWindowsSuccess,
  type WindowsObserverApi,
  WindowsObserverResources,
} from "./windows-observer-api.js";

type VersionChildRequest = Parameters<GitVersionChildPort["run"]>[0] | IdentityQueryChildRequest;
type Pipe = { reader: bigint; writer: bigint; bytes: Buffer[]; size: number; eof: boolean };

class ObserverLimitError extends Error {
  constructor(readonly occurredAt: number) {
    super("Windows observer limit exceeded.");
  }
}
class ObserverCancelledError extends Error {
  constructor(readonly occurredAt: number) {
    super("Windows observer cancelled.");
  }
}

function watchCancellation(signal: AbortSignal | undefined, clock: ObserverClock) {
  let occurredAt: number | undefined;
  const record = () => {
    occurredAt ??= clock.now();
  };
  signal?.addEventListener("abort", record, { once: true });
  if (signal?.aborted) record();
  return {
    occurredAt: () => occurredAt,
    dispose: () => signal?.removeEventListener("abort", record),
  };
}

type NativeVersionResult = Awaited<ReturnType<GitVersionChildPort["run"]>>;
type UnconfirmedCleanup = Extract<NativeVersionResult, { status: "cleanup-unconfirmed" }>;

function failureTrigger(error: unknown): ObserverFailureTrigger {
  if (error instanceof ObserverLimitError) return "OBSERVATION_LIMIT_EXCEEDED";
  if (error instanceof ObserverCancelledError) return "CANCELLED";
  return "INTERNAL_FAILURE";
}

async function closeResources(
  resources: WindowsObserverResources,
  trigger: ObserverFailureTrigger,
  startedAt: number | undefined,
  clock: ObserverClock,
): Promise<UnconfirmedCleanup | undefined> {
  try {
    resources.close();
    if (startedAt !== undefined && clock.now() >= startedAt + REGISTRATION_CLEANUP_BUDGET_MS) {
      return { status: "cleanup-unconfirmed", trigger };
    }
    return undefined;
  } catch {
    const deadline = (startedAt ?? clock.now()) + REGISTRATION_CLEANUP_BUDGET_MS;
    const remaining = deadline - clock.now();
    if (remaining > 0) await clock.wait(remaining);
    return { status: "cleanup-unconfirmed", trigger };
  }
}

async function beforeDeadline(work: Promise<void>, control: ObservationControl): Promise<void> {
  const { deadline, signal, clock } = control;
  let cancelTimer: (() => void) | undefined;
  let onAbort: () => void = () => undefined;
  try {
    await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        cancelTimer = clock.schedule(Math.max(0, deadline - clock.now()), () =>
          reject(observationInterruption(control) ?? new ObserverLimitError(deadline)),
        );
        onAbort = () => {
          const interruption = observationInterruption(control);
          if (interruption !== undefined) reject(interruption);
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) onAbort();
      }),
    ]);
    requireObservationActive(control);
  } finally {
    cancelTimer?.();
    signal?.removeEventListener("abort", onAbort);
  }
}

function inheritableSecurity(): Buffer {
  const security = Buffer.alloc(24);
  security.writeUInt32LE(24, 0);
  security.writeInt32LE(1, 16);
  return security;
}

function createPipe(resources: WindowsObserverResources): Pipe {
  const read: unknown[] = [null],
    write: unknown[] = [null];
  requireWindowsSuccess(
    resources.api,
    resources.api.createPipe(read, write, inheritableSecurity(), 0),
  );
  const reader = resources.ownHandle(read[0]);
  const writer = resources.ownHandle(write[0]);
  requireWindowsSuccess(resources.api, resources.api.setHandle(reader, 1, 0));
  return { reader, writer, bytes: [], size: 0, eof: false };
}

function availablePipeBytes(api: WindowsObserverApi, reader: bigint): number | null {
  const available: unknown[] = [0];
  if (nativeInteger(api.peekPipe(reader, null, 0, null, available, null)) === 0) {
    if (nativeInteger(api.lastError()) !== 109) throw new Error("Windows observer pipe failed.");
    return null;
  }
  return nativeInteger(available[0]);
}

function readPipe(api: WindowsObserverApi, pipe: Pipe, clock: ObserverClock, retain = true): void {
  if (pipe.eof) return;
  const size = availablePipeBytes(api, pipe.reader);
  if (size === null) {
    pipe.eof = true;
    return;
  }
  if (retain && pipe.size + size > REGISTRATION_STREAM_BYTE_LIMIT)
    throw new ObserverLimitError(clock.now());
  if (size === 0) return;
  const received = readWindowsBuffer(
    api,
    pipe.reader,
    Math.min(size, REGISTRATION_STREAM_BYTE_LIMIT),
  );
  pipe.size += received.byteLength;
  if (retain) pipe.bytes.push(received);
}

function activeProcesses(api: WindowsObserverApi, job: bigint): number {
  const accounting = Buffer.alloc(48);
  requireWindowsSuccess(api, api.queryJob(job, 1, accounting, accounting.length, null));
  return accounting.readUInt32LE(40);
}

function createJob(resources: WindowsObserverResources, jobName: string): bigint {
  const raw = resources.api.createJob(null, jobName);
  const code = nativeInteger(resources.api.lastError());
  if (code === 183) {
    requireWindowsSuccess(resources.api, resources.api.close(raw));
    throw new Error("Windows observer job identity already exists.");
  }
  const job = resources.ownHandle(raw);
  const limits = Buffer.alloc(144);
  limits.writeUInt32LE(0x2000, 16); // Kill on last close; neither breakaway flag is enabled.
  requireWindowsSuccess(resources.api, resources.api.setJob(job, 9, limits, limits.length));
  return job;
}

function startupAttributes(
  resources: WindowsObserverResources,
  job: bigint,
  handles: bigint[],
): unknown {
  const size: unknown[] = [0];
  resources.api.initializeAttributes(null, 2, 0, size);
  if (nativeInteger(resources.api.lastError()) !== 122)
    throw new Error("Windows observer attributes unavailable.");
  const capacity = Number(size[0]);
  if (!validAttributeCapacity(capacity)) throw new Error("Invalid native attribute size.");
  const list = resources.allocate("uint8_t", capacity);
  requireWindowsSuccess(resources.api, resources.api.initializeAttributes(list, 2, 0, size));
  resources.ownAttributes(list);
  const jobs = resources.allocate("void *", 1);
  koffi.encode(jobs, "void *", job);
  const inherited = resources.allocate("void *", handles.length);
  koffi.encode(inherited, "void *", handles, handles.length);
  requireWindowsSuccess(
    resources.api,
    resources.api.updateAttribute(list, 0, 0x2000d, jobs, 8, null, null),
  );
  requireWindowsSuccess(
    resources.api,
    resources.api.updateAttribute(list, 0, 0x20002, inherited, handles.length * 8, null, null),
  );
  return list;
}

function validAttributeCapacity(capacity: number): boolean {
  return Number.isSafeInteger(capacity) && capacity > 0 && capacity <= 65536;
}

function cleanEnvironment(api: WindowsObserverApi, directory: string, executable: string): Buffer {
  const buffer = Buffer.alloc(65536);
  const length = nativeInteger(api.windowsDirectory(buffer, 32768));
  if (length <= 0 || length >= 32768) throw new Error("Windows directory unavailable.");
  const system = buffer.subarray(0, length * 2).toString("utf16le");
  const environment: Readonly<Record<string, string>> = {
    SystemRoot: system,
    WINDIR: system,
    PATH: [path.win32.dirname(executable), path.win32.join(system, "System32"), system].join(";"),
    HOME: directory,
    USERPROFILE: directory,
    APPDATA: directory,
    LOCALAPPDATA: directory,
    TEMP: directory,
    TMP: directory,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: "NUL",
    GIT_CONFIG_GLOBAL: "NUL",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_ALLOW_PROTOCOL: "",
    GIT_PROTOCOL_FROM_USER: "0",
    LC_ALL: "C",
    LANG: "C",
  };
  const entries = Object.entries(environment).sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  );
  return Buffer.from(
    `${entries.map(([key, value]) => `${key}=${value}`).join("\0")}\0\0`,
    "utf16le",
  );
}

function createSuspendedChild(
  resources: WindowsObserverResources,
  job: bigint,
  input: bigint,
  pipes: readonly [Pipe, Pipe],
  request: VersionChildRequest,
  directory: string,
) {
  const list = startupAttributes(resources, job, [input, pipes[0].writer, pipes[1].writer]);
  // STARTUPINFOEXW and PROCESS_INFORMATION layouts are specifically win32-x64.
  const startup = Buffer.alloc(112),
    information = Buffer.alloc(24);
  startup.writeUInt32LE(112, 0);
  startup.writeUInt32LE(0x100, 60);
  koffi.encode(startup, 80, "void *", input);
  koffi.encode(startup, 88, "void *", pipes[0].writer);
  koffi.encode(startup, 96, "void *", pipes[1].writer);
  koffi.encode(startup, 104, "void *", list);
  const suffix = "query" in request ? identityQueryArguments(request.query).join(" ") : "--version";
  const command = Buffer.from(`"${request.executablePath}" ${suffix}\0`, "utf16le");
  const environment = cleanEnvironment(resources.api, directory, request.executablePath);
  requireWindowsSuccess(
    resources.api,
    resources.api.createProcess(
      request.executablePath,
      command,
      null,
      null,
      1,
      0x08080404,
      environment,
      "query" in request ? request.repositoryDirectory : directory,
      startup,
      information,
    ),
  );
  const processHandle = resources.ownHandle(koffi.decode(information, 0, "void *"));
  const threadHandle = resources.ownHandle(koffi.decode(information, 8, "void *"));
  const member: unknown[] = [0];
  requireWindowsSuccess(resources.api, resources.api.inJob(processHandle, job, member));
  if (nativeInteger(member[0]) !== 1) throw new Error("Child is not in its creation-time job.");
  const creation = Buffer.alloc(8);
  requireWindowsSuccess(
    resources.api,
    resources.api.processTimes(
      processHandle,
      creation,
      Buffer.alloc(8),
      Buffer.alloc(8),
      Buffer.alloc(8),
    ),
  );
  return {
    processHandle,
    threadHandle,
    processId: information.readUInt32LE(16),
    creationTime100ns: String(creation.readBigUInt64LE()),
  };
}

type OwnedCompletion = Readonly<{ processHandle: bigint; pipes: readonly [Pipe, Pipe] }>;
type OwnedWindowsChild = Readonly<{
  api: WindowsObserverApi;
  job: bigint;
  child: OwnedCompletion;
  clock: ObserverClock;
}>;
type ObservationControl = Readonly<{
  deadline: number;
  signal: AbortSignal | undefined;
  clock: ObserverClock;
  cancellation: ReturnType<typeof watchCancellation>;
}>;

function observationInterruption(control: ObservationControl) {
  const cancelledAt = control.cancellation.occurredAt();
  if (cancelledAt !== undefined && cancelledAt < control.deadline) {
    return new ObserverCancelledError(cancelledAt);
  }
  if (control.clock.now() >= control.deadline) return new ObserverLimitError(control.deadline);
  return undefined;
}

function requireObservationActive(control: ObservationControl): void {
  const interruption = observationInterruption(control);
  if (interruption !== undefined) throw interruption;
}

function completedExitCode(owned: OwnedWindowsChild): number | undefined {
  if (nativeInteger(owned.api.wait(owned.child.processHandle, 0)) !== 0) return undefined;
  if (activeProcesses(owned.api, owned.job) !== 0) return undefined;
  if (!owned.child.pipes.every((pipe) => pipe.eof)) return undefined;
  const code: unknown[] = [0];
  requireWindowsSuccess(owned.api, owned.api.exitCode(owned.child.processHandle, code));
  return nativeInteger(code[0]);
}

async function observeCompletion(
  owned: OwnedWindowsChild,
  control: ObservationControl,
): Promise<number> {
  for (;;) {
    requireObservationActive(control);
    for (const pipe of owned.child.pipes) readPipe(owned.api, pipe, owned.clock);
    const exitCode = completedExitCode(owned);
    requireObservationActive(control);
    if (exitCode !== undefined) return exitCode;
    await owned.clock.wait(10);
  }
}

function childAndTreeExited(
  input: Readonly<{
    api: WindowsObserverApi;
    job: bigint;
    processHandle: bigint;
  }>,
): boolean {
  const { api, job, processHandle } = input;
  const exited = nativeInteger(api.wait(processHandle, 0)) === 0;
  const treeEmpty = activeProcesses(api, job) === 0;
  return exited && treeEmpty;
}

function readTerminalProof(
  owned: OwnedWindowsChild,
  gone: boolean,
): ObserverTerminalProof | undefined {
  const { api, child, clock } = owned;
  for (const pipe of child.pipes) readPipe(api, pipe, clock, false);
  if (!gone || !child.pipes.every((pipe) => pipe.eof)) return undefined;
  const code: unknown[] = [0];
  requireWindowsSuccess(api, api.exitCode(child.processHandle, code));
  return {
    exitCode: nativeInteger(code[0]),
    stdoutClosed: true,
    stderrClosed: true,
    treeEmpty: true,
  };
}

function shouldForceCleanup(
  state: Readonly<{ elapsed: number; forced: boolean; gone: boolean }>,
): boolean {
  if (state.forced) return false;
  if (state.gone) return false;
  return state.elapsed >= 2000;
}

type CleanupState = { started: number; forced: boolean; processConfirmed: boolean };

function cleanupElapsed(owned: OwnedWindowsChild, state: CleanupState): number {
  const elapsed = owned.clock.now() - state.started;
  if (elapsed >= REGISTRATION_CLEANUP_BUDGET_MS)
    throw new Error("Windows observer cleanup is unconfirmed.");
  return elapsed;
}

function confirmCleanupProcess(
  owned: OwnedWindowsChild,
  state: CleanupState,
  elapsed: number,
): void {
  if (elapsed >= 4000) return;
  const gone = state.processConfirmed || observeCleanupProcess(owned);
  state.processConfirmed = gone && owned.clock.now() - state.started < 4000;
}

function forceCleanupIfDue(owned: OwnedWindowsChild, state: CleanupState): void {
  const elapsed = cleanupElapsed(owned, state);
  if (!shouldForceCleanup({ elapsed, forced: state.forced, gone: state.processConfirmed })) return;
  // This no-window owner has no supported graceful console signal.
  state.forced = true;
  requestForcedCleanup(owned.api, owned.job);
}

async function cleanupFailedChild(
  owned: OwnedWindowsChild,
  started: number,
): Promise<ObserverTerminalProof> {
  const state: CleanupState = { started, forced: false, processConfirmed: false };
  for (;;) {
    confirmCleanupProcess(owned, state, cleanupElapsed(owned, state));
    forceCleanupIfDue(owned, state);
    const terminal = observeCleanupTerminal(owned, state.processConfirmed);
    const observedAt = cleanupElapsed(owned, state);
    if (terminal !== undefined) return terminal;
    await owned.clock.wait(cleanupPollDelay(observedAt));
  }
}

function observeCleanupProcess(owned: OwnedWindowsChild): boolean {
  try {
    return childAndTreeExited({
      api: owned.api,
      job: owned.job,
      processHandle: owned.child.processHandle,
    });
  } catch {
    // A failed probe supplies no disappearance proof. Keep ownership and its original trigger.
    return false;
  }
}

function requestForcedCleanup(api: WindowsObserverApi, job: bigint): void {
  try {
    requireWindowsSuccess(api, api.terminateJob(job, 1));
  } catch {
    // A failed termination request is never confirmation; independent terminal facts remain required.
    return;
  }
}

function observeCleanupTerminal(owned: OwnedWindowsChild, gone: boolean) {
  try {
    return readTerminalProof(owned, gone);
  } catch {
    return undefined;
  }
}

function cleanupPollDelay(elapsed: number): number {
  const nextBoundary = [2000, 4000, REGISTRATION_CLEANUP_BUDGET_MS].find(
    (offset) => offset > elapsed,
  );
  return Math.min(10, (nextBoundary ?? REGISTRATION_CLEANUP_BUDGET_MS) - elapsed);
}

function validExecutablePath(value: string): boolean {
  return path.win32.isAbsolute(value) && !/["\r\n\0]/.test(value);
}

function validControlDirectory(value: string): boolean {
  return path.win32.isAbsolute(value) && !/[\r\n\0]/.test(value);
}

function versionOnlyArguments(argv: readonly string[]): boolean {
  return argv.length === 1 && argv[0] === "--version";
}

function validateVersionAdmission(directory: string, request: VersionChildRequest): void {
  const accepted = [
    validExecutablePath(request.executablePath),
    validControlDirectory(directory),
    "query" in request
      ? IdentityQueryKindSchema.safeParse(request.query).success &&
        validControlDirectory(request.repositoryDirectory)
      : versionOnlyArguments(request.argv),
  ];
  if (!accepted.every(Boolean)) {
    throw new Error("Invalid Windows version inspection admission.");
  }
}

async function settleFailedVersion(
  input: Readonly<{
    error: unknown;
    api: WindowsObserverApi;
    job: bigint | undefined;
    completion: OwnedCompletion | undefined;
    clock: ObserverClock;
    startedAt: number;
  }>,
) {
  const { error, api, job, completion, clock, startedAt } = input;
  if (job === undefined || completion === undefined) throw error;
  let terminal: ObserverTerminalProof;
  try {
    terminal = await cleanupFailedChild({ api, job, child: completion, clock }, startedAt);
  } catch {
    return {
      status: "cleanup-unconfirmed" as const,
      trigger: failureTrigger(error),
    };
  }
  if (error instanceof ObserverCancelledError) return { status: "cancelled" as const, terminal };
  if (error instanceof ObserverLimitError) {
    return { status: "failed" as const, code: "OBSERVATION_LIMIT_EXCEEDED" as const, terminal };
  }
  throw error;
}

async function runVersion(
  directory: string,
  request: VersionChildRequest,
  signal: AbortSignal | undefined,
  apiFactory: typeof createWindowsObserverApi,
  clock: ObserverClock,
) {
  validateVersionAdmission(directory, request);
  const api = apiFactory();
  const resources = new WindowsObserverResources(api);
  const cancellation = watchCancellation(signal, clock);
  let job: bigint | undefined;
  let completion: OwnedCompletion | undefined;
  let outcome: NativeVersionResult | undefined;
  let failure: unknown;
  let trigger: ObserverFailureTrigger = "INTERNAL_FAILURE";
  let startedAt: number | undefined;
  try {
    const jobName = `Local\\SlopStop.Registration.Observer.${request.observationId}`;
    job = createJob(resources, jobName);
    const pipes: readonly [Pipe, Pipe] = [createPipe(resources), createPipe(resources)];
    const input = resources.ownHandle(
      api.createFile("NUL", 0x80000000, 7, inheritableSecurity(), 3, 0, null),
    );
    const deadline = clock.now() + 2000;
    const child = createSuspendedChild(resources, job, input, pipes, request, directory);
    completion = { processHandle: child.processHandle, pipes };
    resources.closeHandle(input);
    for (const pipe of pipes) resources.closeHandle(pipe.writer);
    const session: unknown[] = [0];
    requireWindowsSuccess(api, api.processSession(child.processId, session));
    await beforeDeadline(
      request.onOwned({
        platform: "win32",
        processId: child.processId,
        creationTime100ns: child.creationTime100ns,
        jobName,
        sessionId: nativeInteger(session[0]),
      }),
      { deadline, signal, clock, cancellation },
    );
    if (nativeInteger(api.resume(child.threadHandle)) !== 1)
      throw new Error("Could not resume owned child.");
    const exitCode = await observeCompletion(
      { api, job, child: completion, clock },
      { deadline, signal, clock, cancellation },
    );
    outcome = {
      status: "exited" as const,
      exitCode,
      stdout: Buffer.concat(pipes[0].bytes),
      stderr: Buffer.concat(pipes[1].bytes),
    };
  } catch (error) {
    trigger = failureTrigger(error);
    startedAt =
      error instanceof ObserverLimitError || error instanceof ObserverCancelledError
        ? error.occurredAt
        : clock.now();
    try {
      outcome = await settleFailedVersion({ error, api, job, completion, clock, startedAt });
    } catch (error) {
      failure = error;
    }
  } finally {
    cancellation.dispose();
  }
  const closeFailure = await closeResources(resources, trigger, startedAt, clock);
  if (closeFailure !== undefined) return closeFailure;
  if (outcome !== undefined) return outcome;
  throw failure;
}

export function createWindowsVersionChild(
  controlDirectory: string,
  apiFactory = createWindowsObserverApi,
  clock: ObserverClock = systemObserverClock,
): GitVersionChildPort {
  return {
    run: async (request, signal) => {
      if ("query" in request)
        throw new Error("Version inspection cannot dispatch identity queries.");
      if (process.platform !== "win32" || process.arch !== "x64") {
        return { status: "unavailable", code: "GIT_UNAVAILABLE" };
      }
      return runVersion(controlDirectory, request, signal, apiFactory, clock);
    },
  };
}

export function createWindowsIdentityQueryChild(
  controlDirectory: string,
  apiFactory = createWindowsObserverApi,
  clock: ObserverClock = systemObserverClock,
): IdentityQueryChildPort {
  return {
    run: async (request, signal) => {
      if (!IdentityQueryKindSchema.safeParse(request.query).success)
        throw new Error("Unknown identity query.");
      if (process.platform !== "win32" || process.arch !== "x64") {
        return { status: "unavailable", code: "GIT_UNAVAILABLE" };
      }
      return runVersion(controlDirectory, request, signal, apiFactory, clock);
    },
  };
}
