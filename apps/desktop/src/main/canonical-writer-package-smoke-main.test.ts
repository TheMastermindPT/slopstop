import { createHash } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "./canonical-writer-package-smoke-test-peers.js";

const ports = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    whenReady: vi.fn(),
    // This process holds the single-instance lock.
    requestSingleInstanceLock: vi.fn(() => true),
    on: vi.fn(),
    exit: vi.fn(),
    quit: vi.fn(),
    setPath: vi.fn(),
    getPath: vi.fn(),
    setAppUserModelId: vi.fn(),
    setAppLogsPath: vi.fn(),
  },
  authorize: vi.fn(),
  runner: vi.fn(),
  log: vi.fn(),
  sentry: vi.fn(),
  security: vi.fn(),
  ipc: vi.fn(),
  window: vi.fn(
    class {
      once = vi.fn();
      loadFile = vi.fn().mockResolvedValue(undefined);
      webContents = { executeJavaScript: vi.fn().mockResolvedValue({}) };
    },
  ),
  storageSmoke: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  storageStop: vi.fn(),
  workspaceStop: vi.fn(),
  subscribe: vi.fn(),
  open: vi.fn(),
  lstat: vi.fn(),
  realpath: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  open: ports.open,
  lstat: ports.lstat,
  realpath: ports.realpath,
}));
vi.mock("electron", () => ({
  app: ports.app,
  ipcMain: { handle: ports.ipc },
  BrowserWindow: Object.assign(ports.window, { getAllWindows: () => [] }),
}));
vi.mock("./canonical-writer-package-smoke.js", () => ({
  runCanonicalWriterPackageSmoke: ports.runner,
}));
vi.mock("./package-smoke-authorization.js", async (original) => ({
  ...(await original<typeof import("./package-smoke-authorization.js")>()),
  applyPackageSmokeAuthorization: ports.authorize,
}));
vi.mock("./logger.js", () => ({ createMainLogger: ports.log }));
vi.mock("./crash-reporting.js", () => ({ initializeCrashReporting: ports.sentry }));
vi.mock("./security.js", () => ({
  configureSessionSecurity: ports.security,
  lockNavigation: vi.fn(),
}));
vi.mock("./project-storage-bootstrap.js", () => ({
  createProjectStorageHarnessBootstrap: () => bootstrap,
  projectStorageMigrationResourcesRoot: () => "C:/proof/migrations",
}));
vi.mock("./harness-supervisor.js", () => ({
  harnessEntryPath: () => "harness.cjs",
  HarnessSupervisor: class {
    start = ports.start;
    stop = ports.stop;
    subscribe = ports.subscribe;
    getSession() {
      return {};
    }
  },
}));
vi.mock("./project-storage-bridge.js", () => ({
  createProjectStorageBridge: () => ({ stop: ports.storageStop }),
}));
vi.mock("./project-entry-bridge.js", () => ({
  createProjectEntryBridge: () => ({
    list: vi.fn(),
    activate: vi.fn(),
    switchProject: vi.fn(),
    stop: vi.fn(),
  }),
}));
vi.mock("./workspace-bridge.js", () => ({
  createWorkspaceBridge: () => ({ stop: ports.workspaceStop, subscribe: vi.fn() }),
}));
vi.mock("./project-storage-package-smoke.js", () => ({
  runProjectStoragePackageSmoke: ports.storageSmoke,
  projectStoragePackageSmokeFailureStage: () => undefined,
}));
vi.mock("./package-smoke-verifier.js", async (original) => ({
  ...(await original<typeof import("./package-smoke-verifier.js")>()),
  validatePackageSmokeResult: vi.fn(),
}));

const terminal = "Package smoke writer processes terminal.\n";
const unconfirmed = "Package smoke writer process exit unconfirmed.\n";
const passed = "Package smoke writer proof passed.\n";
const failed = (stage: string) => `Package smoke proof failed at writer-${stage}.\n`;
const originalArgv = [...process.argv];
const originalElectron = Object.getOwnPropertyDescriptor(process.versions, "electron");
const runtimeRoot = path.resolve(path.parse(process.cwd()).root, "proof", "user");
const challengeFile = path.join(runtimeRoot, ".slopstop-runtime-challenge.json");
const witnessFile = path.join(runtimeRoot, ".slopstop-runtime-witness.json");
const nonce = "a".repeat(64);
const exeBytes = Buffer.from("actual main image bytes");
const runtimeFiles = new Map<string, { kind: "file" | "dir" | "link"; bytes: Buffer }>();
let publicationFault = "";
let releaseFileClose = () => {};
const fileOperations: string[] = [];
function configureRuntimeFiles() {
  runtimeFiles.clear();
  fileOperations.length = 0;
  publicationFault = "";
  Object.defineProperty(process.versions, "electron", { configurable: true, value: "43.4.0" });
  runtimeFiles.set(runtimeRoot, { kind: "dir", bytes: Buffer.alloc(0) });
  runtimeFiles.set(process.execPath, { kind: "file", bytes: exeBytes });
  runtimeFiles.set(challengeFile, {
    kind: "file",
    bytes: Buffer.from(JSON.stringify({ version: 1, nonce })),
  });
  ports.lstat.mockImplementation(async (file) => runtimeStat(file));
  ports.realpath.mockImplementation(async (file) => file);
  ports.open.mockImplementation(openRuntimeFile);
}
function runtimeEntry(file: string) {
  const result = runtimeFiles.get(file);
  if (!result) throw Object.assign(new Error("missing"), { code: "ENOENT" });
  return result;
}
function runtimeStat(file: string) {
  return {
    dev: 1,
    ino: 1,
    mtimeMs: 1,
    size: runtimeEntry(file).bytes.length,
    isFile: () => runtimeEntry(file).kind === "file",
    isDirectory: () => runtimeEntry(file).kind === "dir",
    isSymbolicLink: () => runtimeEntry(file).kind === "link",
  };
}
async function closeRuntimeFile(file: string) {
  if (file === witnessFile && publicationFault === "close")
    throw new Error("private close failure");
  if (file === witnessFile && publicationFault === "held")
    await new Promise<void>((resolve) => {
      releaseFileClose = resolve;
    });
  fileOperations.push(`closed:${file}`);
}
async function openRuntimeFile(file: string, flags: "r" | "wx") {
  if (flags === "wx") {
    if (runtimeFiles.has(file) || publicationFault === "race")
      throw Object.assign(new Error("private existing"), { code: "EEXIST" });
    runtimeFiles.set(file, { kind: "file", bytes: Buffer.alloc(0) });
  }
  const value = runtimeEntry(file);
  return {
    stat: async () => runtimeStat(file),
    read: async (buffer: Buffer, offset: number, length: number, position: number) => ({
      buffer,
      bytesRead: value.bytes.copy(buffer, offset, position, position + length),
    }),
    writeFile: async (text: string) => {
      value.bytes = Buffer.from(publicationFault === "write" ? "{" : text);
      if (publicationFault === "write") throw new Error("private write failure");
    },
    close: () => closeRuntimeFile(file),
  };
}
const challengeMutations: Record<string, (text: string) => string> = {
  duplicate: (text) => text.replace('"version":1', '"version":1,"version":1'),
  "escaped-duplicate": (text) => text.replace('"version":1', '"version":1,"vers\\u0069on":1'),
  extra: () => JSON.stringify({ version: 1, nonce, electronVersion: "43.4.0" }),
  missing: () => '{"version":1}',
  nonce: () => JSON.stringify({ version: 1, nonce: "A".repeat(64) }),
  version: () => JSON.stringify({ version: "1", nonce }),
  truncated: (text) => text.slice(0, -1),
  "256": (text) => text.padEnd(256, " "),
  "257": (text) => text.padEnd(257, " "),
};
function challengeFileFault(fault: string) {
  const original = JSON.stringify({ version: 1, nonce });
  const text = challengeMutations[fault]?.(original) ?? original;
  const kinds: Record<string, "file" | "link" | "dir"> = {
    symlink: "link",
    directory: "dir",
    "exe-symlink": "link",
    "exe-directory": "dir",
  };
  const challengeKind = fault.startsWith("exe-") ? "file" : (kinds[fault] ?? "file");
  runtimeFiles.set(challengeFile, { kind: challengeKind, bytes: Buffer.from(text) });
  if (fault === "utf8")
    runtimeFiles.set(challengeFile, { kind: "file", bytes: Buffer.from([255]) });
  if (fault === "absent") runtimeFiles.delete(challengeFile);
  if (fault === "witness-exists")
    runtimeFiles.set(witnessFile, { kind: "file", bytes: Buffer.from("{}") });
  if (fault.startsWith("exe-"))
    runtimeFiles.set(process.execPath, { kind: kinds[fault] ?? "file", bytes: exeBytes });
}
let writes: string[];
let callbacks: Array<() => void>;
let holdWrites: boolean;
let ready: () => void;
let statusListeners: Array<(status: unknown) => void>;
async function flush() {
  for (let index = 0; index < 200; index++) await Promise.resolve();
}
async function load() {
  await import("./main.js");
  await flush();
}
function event(name: string) {
  const listener = ports.app.on.mock.calls.find(([candidate]) => candidate === name)?.[1];
  if (typeof listener !== "function") throw new Error(`Missing app event: ${name}`);
  const value = { preventDefault: vi.fn() };
  listener(value);
  return value;
}
function noOrdinaryStartup() {
  for (const port of [
    ports.log,
    ports.sentry,
    ports.security,
    ports.ipc,
    ports.window,
    ports.start,
    ports.storageSmoke,
    ports.app.setAppLogsPath,
    ports.app.setAppUserModelId,
  ])
    expect(port).not.toHaveBeenCalled();
}
function rejectReportWrite(error: Error): void {
  vi.mocked(process.stderr.write).mockImplementationOnce((_chunk, encoding, callback) => {
    const complete = typeof encoding === "function" ? encoding : callback;
    complete?.(error);
    return false;
  });
}
function configureReportingException(mode: string): void {
  const secret = new Error("private root token SQL native-path");
  const throwSecret = () => {
    throw secret;
  };
  switch (mode) {
    case "ready":
      ports.app.whenReady.mockRejectedValue(secret);
      break;
    case "runner":
      ports.runner.mockRejectedValue(secret);
      break;
    case "write-callback":
      rejectReportWrite(secret);
      break;
    case "write-throw":
      vi.mocked(process.stderr.write).mockImplementationOnce(throwSecret);
      break;
    case "fallback-throw":
      ports.runner.mockRejectedValue(secret);
      vi.mocked(process.stderr.write).mockImplementation(throwSecret);
      break;
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  configureRuntimeFiles();
  writes = [];
  callbacks = [];
  statusListeners = [];
  holdWrites = false;
  ports.app.isPackaged = true;
  ports.app.whenReady.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
  );
  ports.app.getPath.mockReturnValue(runtimeRoot);
  ports.authorize.mockImplementation((input, setter) => {
    setter(runtimeRoot);
    return { root: runtimeRoot, scenario: input.scenario };
  });
  ports.runner.mockReset().mockResolvedValue({ status: "passed", cleanupSafe: true });
  ports.log.mockReturnValue({ info: vi.fn() });
  ports.stop.mockResolvedValue(undefined);
  ports.storageSmoke.mockResolvedValue(undefined);
  ports.subscribe.mockImplementation((listener) => {
    statusListeners.push(listener);
    return vi.fn();
  });
  ports.start.mockImplementation(() =>
    queueMicrotask(() => {
      for (const listener of statusListeners)
        listener({ state: "ready", attempt: 1, harnessVersion: "0.0.0" });
    }),
  );
  vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "1");
  vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_SCENARIO", "writer-proof");
  vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", undefined);
  vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "main_window");
  vi.stubGlobal("PROTOTYPE_WINDOW_VITE_DEV_SERVER_URL", undefined);
  vi.stubGlobal("PROTOTYPE_WINDOW_VITE_NAME", "prototype_window");
  vi.spyOn(process.stderr, "write").mockImplementation((chunk, encoding, callback) => {
    writes.push(String(chunk));
    const complete = typeof encoding === "function" ? encoding : callback;
    const finish = () => complete?.();
    if (holdWrites) callbacks.push(finish);
    else finish();
    return true;
  });
});
afterEach(() => {
  if (originalElectron) Object.defineProperty(process.versions, "electron", originalElectron);
  else Reflect.deleteProperty(process.versions, "electron");
  process.argv.splice(0, process.argv.length, ...originalArgv);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ordinary main characterization", () => {
  it.each(["bootstrap", "missing-runtime", "witnessed-staging"])(
    "retains %s shutdown",
    async (scenario) => {
      vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_SCENARIO", scenario);
      await load();
      ready();
      await flush();
      expect(writes).toEqual([]);
      expect(ports.window).toHaveBeenCalledOnce();
      expect(ports.storageSmoke).toHaveBeenCalledWith(expect.objectContaining({ scenario }));
      expect(ports.runner).not.toHaveBeenCalled();
      expect(ports.stop).toHaveBeenCalledOnce();
      expect(ports.app.exit).toHaveBeenCalledWith(0);
      expect(writes).toEqual([]);
    },
  );
  it.each(["unpackaged", "prototype", "ordinary"])("retains %s quit ownership", async (mode) => {
    if (mode === "unpackaged") ports.app.isPackaged = false;
    if (mode === "ordinary") vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "0");
    if (mode === "prototype") process.argv.push("--prototype");
    await load();
    ready();
    await flush();
    expect(ports.authorize).not.toHaveBeenCalled();
    expect(ports.runner).not.toHaveBeenCalled();
    const quit = event("before-quit");
    await flush();
    expect(quit.preventDefault).toHaveBeenCalledOnce();
    expect(ports.app.quit).toHaveBeenCalledOnce();
    expect(ports.app.exit).not.toHaveBeenCalled();
  });
});

describe("single-instance lock", () => {
  it("fails a package smoke that does not hold the lock, without arming its proof", async () => {
    ports.app.requestSingleInstanceLock.mockReturnValueOnce(false);
    await load();
    // The authorization moves userData first: the lock is taken for the smoke's own root.
    expect(ports.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      ports.app.requestSingleInstanceLock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(writes).toEqual(["Package smoke single-instance lock is held by another instance.\n"]);
    expect(ports.app.exit).toHaveBeenCalledWith(1);
    expect(ports.app.quit).not.toHaveBeenCalled();
    expect(ports.app.whenReady).not.toHaveBeenCalled();
    expect(ports.runner).not.toHaveBeenCalled();
  });

  it("quits an ordinary launch that does not hold the lock", async () => {
    vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "0");
    ports.app.requestSingleInstanceLock.mockReturnValueOnce(false);
    await load();
    expect(ports.authorize).not.toHaveBeenCalled();
    expect(ports.app.quit).toHaveBeenCalledOnce();
    expect(ports.app.exit).not.toHaveBeenCalled();
    expect(ports.app.whenReady).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});

describe("private main composition", () => {
  it("publishes observed runtime only after confirmed terminal cleanup", async () => {
    let finish = (_value: unknown) => {};
    ports.runner.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await load();
    ready();
    await flush();
    expect(runtimeFiles.has(witnessFile)).toBe(false);
    finish({ status: "passed", cleanupSafe: true });
    await flush();
    const bytes = runtimeFiles.get(witnessFile)?.bytes;
    expect(bytes).toBeDefined();
    expect(JSON.parse(bytes?.toString() ?? "null")).toEqual({
      version: 1,
      nonce,
      mainPid: process.pid,
      platform: process.platform,
      arch: process.arch,
      electronVersion: "43.4.0",
      executableSha256: createHash("sha256").update(exeBytes).digest("hex"),
    });
    expect(fileOperations).toContain(`closed:${witnessFile}`);
    expect(writes.join("")).toBe(terminal + passed);
  });
  it("closes the complete witness before reporting", async () => {
    publicationFault = "held";
    await load();
    ready();
    await flush();
    expect(writes).toEqual([]);
    expect(ports.app.exit).not.toHaveBeenCalled();
    releaseFileClose();
    await flush();
    expect(writes.join("")).toBe(terminal + passed);
  });
  it.each(["race", "write", "close"])(
    "refuses failed exclusive witness publication: %s",
    async (fault) => {
      publicationFault = fault;
      await load();
      ready();
      await flush();
      expect(ports.app.exit).toHaveBeenCalledWith(1);
      expect(writes.join("")).toBe(unconfirmed + failed("internal"));
    },
  );
  it.each([
    "absent",
    "duplicate",
    "escaped-duplicate",
    "extra",
    "missing",
    "nonce",
    "version",
    "utf8",
    "truncated",
    "257",
    "256",
    "symlink",
    "directory",
    "witness-exists",
    "exe-symlink",
    "exe-directory",
  ])("requires exact bounded private challenge: %s", async (fault) => {
    challengeFileFault(fault);
    await load();
    ready();
    await flush();
    expect(ports.app.exit).toHaveBeenCalledWith(fault === "256" ? 0 : 1);
    if (fault !== "256") expect(ports.runner).not.toHaveBeenCalled();
  });
  it("rejects host or caller version spoof instead of copying it", async () => {
    Object.defineProperty(process.versions, "electron", { configurable: true, value: "99.0.0" });
    vi.stubEnv("SLOPSTOP_ELECTRON_VERSION", "43.4.0");
    await load();
    ready();
    await flush();
    expect(ports.app.exit).toHaveBeenCalledWith(1);
    expect(runtimeFiles.has(witnessFile)).toBe(false);
  });
  it.each([
    "native-preflight",
    "spawn",
    "handshake",
    "unexpected-message",
    "inactive",
    "activate",
    "first-settlement",
    "contention",
    "read-only",
    "hard-kill",
    "takeover",
    "replay",
    "stale-activation",
    "next-settlement",
    "audit",
    "stale-initialize",
    "stale-release",
    "stale-attempt",
    "stale-finish",
    "clean-stop",
    "process-exit",
    "stdio-drain",
    "output-bound",
    "cancelled",
    "proof-deadline",
    "cleanup",
    "internal",
  ])("reports only fixed terminal and %s failure lines", async (stage) => {
    ports.runner.mockResolvedValue({
      status: "failed",
      stage,
      cleanupSafe: true,
      cleanupFailures: [{ processIndex: 0, stage: "cleanup" }],
    });
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await load();
    ready();
    await flush();
    expect(writes.join("")).toBe(`${terminal}${failed(stage)}`);
    expect(stdout).not.toHaveBeenCalled();
    expect(ports.app.exit).toHaveBeenCalledExactlyOnceWith(1);
  });
  it.each(["passed", "failed-safe", "failed-unconfirmed"])(
    "flushes exact %s terminal result before exit",
    async (mode) => {
      const result =
        mode === "passed"
          ? { status: "passed", cleanupSafe: true }
          : {
              status: "failed",
              stage: "transport",
              cleanupSafe: mode === "failed-safe",
              cleanupFailures: [{ processIndex: 0, stage: "cleanup" }],
            };
      ports.runner.mockResolvedValue(result);
      holdWrites = true;
      await load();
      expect(ports.runner).not.toHaveBeenCalled();
      noOrdinaryStartup();
      ready();
      await flush();
      noOrdinaryStartup();
      expect(ports.runner).toHaveBeenCalledOnce();
      expect(ports.authorize.mock.invocationCallOrder[0]).toBeLessThan(
        ports.app.whenReady.mock.invocationCallOrder[0] ?? 0,
      );
      expect(ports.app.whenReady.mock.invocationCallOrder[0]).toBeLessThan(
        ports.runner.mock.invocationCallOrder[0] ?? 0,
      );
      expect(ports.app.exit).not.toHaveBeenCalled();
      expect(writes.join("")).toBe(
        `${result.cleanupSafe ? terminal : unconfirmed}${mode === "passed" ? passed : failed("transport")}`,
      );
      expect(runtimeFiles.has(witnessFile)).toBe(result.cleanupSafe);
      for (const complete of callbacks) complete();
      await flush();
      expect(ports.app.exit).toHaveBeenCalledExactlyOnceWith(mode === "passed" ? 0 : 1);
      expect(ports.stop).not.toHaveBeenCalled();
    },
  );
  it.each(["before-ready", "response", "reporting"])("owns quit during %s", async (stage) => {
    let complete: (result: unknown) => void = () => undefined;
    ports.runner.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    holdWrites = true;
    await load();
    if (stage !== "before-ready") {
      ready();
      await flush();
    }
    if (stage === "reporting") {
      complete({ status: "passed", cleanupSafe: true });
      await flush();
    }
    const quit = event("before-quit");
    event("window-all-closed");
    await flush();
    expect(quit.preventDefault).toHaveBeenCalledOnce();
    expect(ports.app.exit).not.toHaveBeenCalled();
    expect(ports.stop).not.toHaveBeenCalled();
    expect(ports.app.quit).not.toHaveBeenCalled();
    if (stage === "before-ready") {
      ready();
      await flush();
    }
    expect(ports.runner.mock.calls[0]?.[0].signal.aborted).toBe(true);
    complete({ status: "failed", stage: "cancelled", cleanupSafe: true, cleanupFailures: [] });
    await flush();
    for (const callback of callbacks) callback();
    await flush();
    expect(ports.app.exit).toHaveBeenCalledOnce();
  });
  it.each(["ready", "runner", "write-callback", "write-throw", "fallback-throw"])(
    "uses unconfirmed fallback for %s exception",
    async (mode) => {
      configureReportingException(mode);
      await load();
      if (mode !== "ready") {
        ready();
        await flush();
      }
      expect(ports.app.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(writes.join("")).toBe(
        mode === "fallback-throw" ? "" : `${unconfirmed}${failed("internal")}`,
      );
      noOrdinaryStartup();
      expect(ports.stop).not.toHaveBeenCalled();
    },
  );
  it("refuses authorization before readiness and private admission", async () => {
    const { PackageSmokeAuthorizationError } = await import("./package-smoke-authorization.js");
    ports.authorize.mockImplementation(() => {
      throw new PackageSmokeAuthorizationError();
    });
    await load();
    expect(ports.app.whenReady).not.toHaveBeenCalled();
    expect(ports.runner).not.toHaveBeenCalled();
    expect(writes).toEqual(["Package smoke authorization failed.\n"]);
    expect(ports.app.exit).toHaveBeenCalledWith(1);
  });
});
