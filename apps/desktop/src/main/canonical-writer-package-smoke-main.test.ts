import { createHash } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { bootstrap } from "./canonical-writer-package-smoke-test-peers.js";

/** Whether Ctrl+R starts a load in the mocked window, as the default menu's reload would. */
const menuKeys = vi.hoisted(() => ({ reloadActs: false, devToolsOpens: false }));
/**
 * A mocked window's `webContents`. Its keys model the packaged zoom-only menu, for the bootstrap
 * smoke's keys proof on win32: a zoom key acts at once; reload and DevTools keys do nothing,
 * unless `menuKeys.reloadActs` lets Ctrl+R start a load.
 */
const mockContents = vi.hoisted(() => (id: number) => {
  const zoom = { level: 0 };
  const loadListeners = new Set<() => void>();
  const keyDown: Readonly<Record<string, () => void>> = {
    Plus: () => (zoom.level += 0.5),
    "-": () => (zoom.level -= 0.5),
    "0": () => (zoom.level = 0),
    R: () => {
      for (const listener of menuKeys.reloadActs ? loadListeners : []) listener();
    },
  };
  return {
    id,
    mainFrame: { processId: 100, routingId: id },
    executeJavaScript: vi.fn().mockResolvedValue({}),
    focus: vi.fn(),
    on: vi.fn((name: string, listener: () => void) => {
      if (name === "did-start-loading") loadListeners.add(listener);
    }),
    removeListener: vi.fn((_name: string, listener: () => void) => loadListeners.delete(listener)),
    getZoomLevel: vi.fn(() => zoom.level),
    getZoomFactor: vi.fn().mockReturnValue(1),
    setZoomFactor: vi.fn(),
    isDevToolsOpened: vi.fn(() => menuKeys.devToolsOpens),
    sendInputEvent: vi.fn((input: Readonly<{ type: string; keyCode: string }>) => {
      if (input.type === "keyDown") keyDown[input.keyCode]?.();
    }),
  };
});
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
      setTitleBarOverlay = vi.fn();
      isDestroyed = vi.fn(() => false);
      // While `loadHold` is set, every load stays pending (P4-B30).
      loadFile = vi.fn(() => ports.loadHold ?? Promise.resolve());
      focus = vi.fn();
      webContents = mockContents(++ports.webContentsCount);
    },
  ),
  webContentsCount: 0,
  loadHold: undefined as Promise<void> | undefined,
  fromWebContents: vi.fn(),
  showOpenDialog: vi.fn(),
  storageSmoke: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  storageStop: vi.fn(),
  workspaceStop: vi.fn(),
  entryStop: vi.fn(),
  entryList: vi.fn(),
  entryRegister: vi.fn(),
  entryActivate: vi.fn(),
  entrySwitch: vi.fn(),
  entryUpgrade: vi.fn(),
  entryRead: vi.fn(),
  entrySave: vi.fn(),
  workspaceQuery: vi.fn(),
  workspaceSubmit: vi.fn(),
  getStatus: vi.fn(),
  retry: vi.fn(),
  supervisorCreated: vi.fn(),
  runtimePorts: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  bootstrapArgs: vi.fn(),
  order: [] as string[],
  /** While set, the real runtime dispose waits for it (B1 main row). */
  disposeHold: undefined as Promise<void> | undefined,
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
/** The application menu, the native theme and the system colours main reads (pf-s2). */
const chromePorts = vi.hoisted(() => ({
  buildMenu: vi.fn((template: unknown) => ({ template })),
  setMenu: vi.fn(),
  themeOn: vi.fn(),
  themeRemove: vi.fn(),
  getColor: vi.fn((_name: string) => "#000000FF"),
  /** The native theme main reads; a row may switch high contrast on. */
  theme: { shouldUseHighContrastColors: false },
}));
vi.mock("electron", () => ({
  app: ports.app,
  ipcMain: { handle: ports.ipc },
  BrowserWindow: Object.assign(ports.window, {
    getAllWindows: () => [],
    fromWebContents: ports.fromWebContents,
  }),
  dialog: { showOpenDialog: ports.showOpenDialog },
  Menu: { buildFromTemplate: chromePorts.buildMenu, setApplicationMenu: chromePorts.setMenu },
  nativeTheme: {
    get shouldUseHighContrastColors() {
      return chromePorts.theme.shouldUseHighContrastColors;
    },
    on: chromePorts.themeOn,
    removeListener: chromePorts.themeRemove,
  },
  systemPreferences: { getColor: chromePorts.getColor },
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
  createProjectStorageHarnessBootstrap: (input: unknown) => {
    ports.order.push("createProjectStorageHarnessBootstrap");
    ports.bootstrapArgs(input);
    return bootstrap;
  },
  projectStorageMigrationResourcesRoot: () => "C:/proof/migrations",
}));
vi.mock("./harness-supervisor.js", () => ({
  harnessEntryPath: () => "harness.cjs",
  HarnessSupervisor: class {
    constructor(...args: unknown[]) {
      ports.supervisorCreated(...args);
    }
    start = ports.start;
    stop = ports.stop;
    subscribe = ports.subscribe;
    getStatus = ports.getStatus;
    retry = ports.retry;
    getSession() {
      return {};
    }
  },
}));
// The shared bridges (s7): the same port-backed bridges, and a no-op release, so the latched
// s6 stop ports are never called twice (S7-R11, S7-S4).
vi.mock("./harness-bridges.js", () => ({
  createHarnessBridges: () => ({
    projectEntry: {
      list: ports.entryList,
      register: ports.entryRegister,
      activate: ports.entryActivate,
      switchProject: ports.entrySwitch,
      upgrade: ports.entryUpgrade,
      readConversation: ports.entryRead,
      saveConversationMessage: ports.entrySave,
      stop: ports.entryStop,
    },
    projectStorage: { open: vi.fn(), create: vi.fn(), close: vi.fn(), stop: ports.storageStop },
    workspace: {
      stop: ports.workspaceStop,
      subscribe: vi.fn(),
      query: ports.workspaceQuery,
      submit: ports.workspaceSubmit,
    },
    release: vi.fn(),
  }),
}));
// The real runtime, with its dispose recorded in the shared order and held on demand.
vi.mock("./desktop-runtime.js", async (original) => {
  const actual = await original<typeof import("./desktop-runtime.js")>();
  return {
    ...actual,
    makeDesktopRuntime: (runtimePorts: Parameters<typeof actual.makeDesktopRuntime>[0]) => {
      ports.runtimePorts(runtimePorts);
      const runtime = actual.makeDesktopRuntime(runtimePorts);
      const dispose = runtime.dispose.bind(runtime);
      vi.spyOn(runtime, "dispose").mockImplementation(async () => {
        ports.order.push("dispose");
        await ports.disposeHold;
        return dispose();
      });
      return runtime;
    },
  };
});
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
/** Every window loads at once, and every open-path port answers unlike any gated envelope. */
function answerOpenPaths() {
  ports.loadHold = undefined;
  for (const bridge of [
    ports.entryList,
    ports.entryRegister,
    ports.entryActivate,
    ports.entrySwitch,
    ports.entryUpgrade,
    ports.entryRead,
    ports.entrySave,
    ports.workspaceQuery,
    ports.workspaceSubmit,
  ])
    bridge.mockResolvedValue({ status: "open-path" });
  ports.getStatus.mockReturnValue({ state: "ready", attempt: 1, harnessVersion: "0.0.0" });
  ports.retry.mockReturnValue({ ok: true });
  ports.fromWebContents.mockReturnValue(undefined);
  ports.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  menuKeys.reloadActs = false;
  menuKeys.devToolsOpens = false;
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
  ports.order.length = 0;
  ports.disposeHold = undefined;
  answerOpenPaths();
  ports.log.mockImplementation(() => {
    ports.order.push("createMainLogger");
    return { info: ports.logInfo, error: ports.logError, warn: ports.logWarn };
  });
  ports.app.setAppLogsPath.mockImplementation(() => {
    ports.order.push("setAppLogsPath");
  });
  ports.stop.mockImplementation(async () => {
    ports.order.push("harness");
  });
  // The bridge stops record their names, so the program's order is observable (S6-L4).
  for (const [stop, name] of [
    [ports.storageStop, "project-storage"],
    [ports.workspaceStop, "workspace"],
    [ports.entryStop, "project-entry"],
  ] as const)
    stop.mockImplementation(() => {
      ports.order.push(name);
    });
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
  it.each(["unpackaged", "ordinary"])("retains %s quit ownership", async (mode) => {
    if (mode === "unpackaged") ports.app.isPackaged = false;
    if (mode === "ordinary") vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "0");
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

/** An ordinary launch (not a package smoke) that reaches its window. */
async function ordinaryLaunch() {
  vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "0");
  await load();
  ready();
  await flush();
}

/** The handler main registered for a channel, called with an explicit event. */
function registeredHandler(channel: keyof typeof desktopIpcChannels) {
  const name = desktopIpcChannels[channel];
  const handler = ports.ipc.mock.calls.find((call) => call[0] === name)?.[1];
  if (typeof handler !== "function") throw new Error(`Missing IPC handler: ${name}`);
  return (event: unknown, value: unknown) => handler(event, value);
}

/**
 * An invoke event from the main frame of the window main created at `index`: an equal copy of
 * the frame, never the same object, as Electron does not promise one.
 */
function windowEvent(index: number) {
  const window = ports.window.mock.instances[index];
  if (window === undefined) throw new Error(`Missing window: ${index}`);
  return { sender: window.webContents, senderFrame: { ...window.webContents.mainFrame } };
}

/** The handler main registered for the row's channel, called as the renderer would. */
function ipcHandler(row: Readonly<{ channel: keyof typeof desktopIpcChannels }>) {
  const handler = registeredHandler(row.channel);
  return (value: unknown) => handler(windowEvent(0), value);
}

function noDesktopRuntime() {
  expect(ports.log).not.toHaveBeenCalled();
  expect(ports.supervisorCreated).not.toHaveBeenCalled();
}

describe("desktop runtime in main", () => {
  it("disposes the main runtime before quit", async () => {
    let release = () => {};
    ports.disposeHold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await ordinaryLaunch();
    event("before-quit");
    await flush();
    const shutdownSteps = new Set([
      "project-storage",
      "workspace",
      "project-entry",
      "harness",
      "dispose",
    ]);
    expect(ports.order.filter((step) => shutdownSteps.has(step))).toEqual([
      "project-storage",
      "workspace",
      "project-entry",
      "harness",
      "dispose",
    ]);
    expect(ports.app.quit).not.toHaveBeenCalled();
    release();
    await flush();
    expect(ports.order.filter((step) => step === "dispose")).toHaveLength(1);
    expect(ports.app.quit).toHaveBeenCalledOnce();
  });

  it("stops every bridge when the workspace stop throws", async () => {
    // Once: the latch calls it once, and a lasting throw would leak into later tests.
    const failure = new Error("private workspace stop failure");
    ports.workspaceStop.mockImplementationOnce(() => {
      throw failure;
    });
    await ordinaryLaunch();
    event("before-quit");
    await flush();
    expect(ports.entryStop).toHaveBeenCalledOnce();
    expect(ports.stop).toHaveBeenCalledOnce();
    expect(ports.app.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(ports.app.quit).not.toHaveBeenCalled();
    expect(ports.logError).toHaveBeenCalledExactlyOnceWith(
      { err: failure },
      "SlopStop shutdown failed.",
    );
  });

  const memoryQuery = {
    query: "memory-library.read",
    projectId: "00000000-0000-4000-8000-000000000010",
    cursor: null,
  };
  it.each([
    {
      channel: "listProjects",
      value: {},
      bridge: ports.entryList,
      envelope: { status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" },
    },
    {
      channel: "registerProject",
      value: { step: "prepare-git" },
      bridge: ports.entryRegister,
      envelope: { status: "unavailable", code: "PROJECT_REGISTRATION_UNAVAILABLE" },
    },
    {
      channel: "queryWorkspace",
      value: memoryQuery,
      bridge: ports.workspaceQuery,
      envelope: {
        status: "unavailable",
        query: memoryQuery,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "The workspace is unavailable while SlopStop closes.",
        },
      },
    },
  ] as const)("answers unavailable after quit starts: $channel", async (row) => {
    await ordinaryLaunch();
    const call = ipcHandler(row);
    event("before-quit");
    await expect(call(row.value)).resolves.toEqual(row.envelope);
    await flush();
    expect(ports.order).toContain("dispose");
    expect(ports.app.quit).toHaveBeenCalledOnce();
    await expect(call(row.value)).resolves.toEqual(row.envelope);
    expect(row.bridge).not.toHaveBeenCalled();
  });

  it.each([
    {
      path: "writer proof",
      async run() {
        await load();
        ready();
        await flush();
      },
    },
    {
      path: "package smoke without the lock",
      async run() {
        ports.app.requestSingleInstanceLock.mockReturnValueOnce(false);
        await load();
        await flush();
      },
    },
    {
      path: "ordinary launch without the lock",
      async run() {
        vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "0");
        ports.app.requestSingleInstanceLock.mockReturnValueOnce(false);
        await load();
        event("before-quit");
        await flush();
        expect(ports.app.quit).toHaveBeenCalledTimes(2);
        expect(ports.app.exit).not.toHaveBeenCalled();
      },
    },
    {
      path: "authorization refused",
      async run() {
        const { PackageSmokeAuthorizationError } = await import("./package-smoke-authorization.js");
        ports.authorize.mockImplementation(() => {
          throw new PackageSmokeAuthorizationError();
        });
        await load();
        await flush();
      },
    },
    {
      path: "before-quit before ready",
      async run() {
        vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE", "0");
        await load();
        event("before-quit");
        await flush();
        ready();
        await flush();
        expect(writes).toEqual([]);
      },
    },
  ])("builds no desktop runtime: $path", async ({ run }) => {
    await run();
    noDesktopRuntime();
  });

  it("logs the desktop start before building the owners", async () => {
    vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_SCENARIO", "bootstrap");
    await load();
    ready();
    await flush();
    // The first info line is the start log, emitted as soon as the logger exists.
    expect(ports.logInfo.mock.calls[0]?.[1]).toBe("SlopStop desktop starting.");
    expect(ports.logInfo.mock.invocationCallOrder[0]).toBeLessThan(
      ports.supervisorCreated.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ports.sentry).toHaveBeenCalledOnce();
    expect(ports.sentry.mock.invocationCallOrder[0]).toBeLessThan(
      ports.supervisorCreated.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("reads the desktop services after their paths are set", async () => {
    const logsPath = path.join(runtimeRoot, "logs");
    let logsSet = false;
    ports.app.setAppLogsPath.mockImplementation(() => {
      ports.order.push("setAppLogsPath");
      logsSet = true;
    });
    // userData is the root `setPath("userData", root)` set, or a sentinel before it.
    const userData = () =>
      ports.app.setPath.mock.calls.filter((call) => call[0] === "userData").at(-1)?.[1] ??
      "user-data-sentinel";
    ports.app.getPath.mockImplementation((name: string) => {
      if (name === "logs") return logsSet ? logsPath : "logs-sentinel";
      if (name === "userData") return userData();
      return runtimeRoot;
    });
    vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_SCENARIO", "bootstrap");
    await load();
    ready();
    await flush();
    expect(ports.log.mock.calls[0]?.[0]).toBe(logsPath);
    expect(ports.bootstrapArgs).toHaveBeenCalledWith(
      expect.objectContaining({ userDataRoot: runtimeRoot }),
    );
  });
});

const activation = {
  projectId: "00000000-0000-4000-8000-000000000020",
  activationId: "00000000-0000-4000-8000-000000000021",
};
/** Every invoke channel, with a valid value and the port its open path reaches. */
const invokeRows = [
  { channel: "listProjects", value: {}, port: ports.entryList },
  {
    channel: "activateProject",
    value: { projectId: activation.projectId },
    port: ports.entryActivate,
  },
  {
    channel: "switchProject",
    value: { from: activation, to: { projectId: "00000000-0000-4000-8000-000000000022" } },
    port: ports.entrySwitch,
  },
  {
    channel: "upgradeProject",
    value: { projectId: activation.projectId },
    port: ports.entryUpgrade,
  },
  { channel: "readConversation", value: { ...activation, after: null }, port: ports.entryRead },
  {
    channel: "saveConversationMessage",
    value: {
      ...activation,
      saveId: "00000000-0000-4000-8000-000000000023",
      expectedRevision: 0,
      text: "Hello",
    },
    port: ports.entrySave,
  },
  { channel: "getHarnessStatus", value: undefined, port: ports.getStatus },
  { channel: "retryHarness", value: undefined, port: ports.retry },
  {
    channel: "queryWorkspace",
    value: {
      query: "memory-library.read",
      projectId: "00000000-0000-4000-8000-000000000010",
      cursor: null,
    },
    port: ports.workspaceQuery,
  },
  {
    channel: "submitWorkspaceIntent",
    value: {
      intent: "memory.proposal.review",
      projectId: "00000000-0000-4000-8000-000000000010",
      proposalId: "00000000-0000-4000-8000-000000000030",
      decision: "accept",
      expectedProjectionRevision: 0,
    },
    port: ports.workspaceSubmit,
  },
  { channel: "getRegistrationCapability", value: undefined, port: undefined },
  { channel: "chooseRepository", value: undefined, port: ports.showOpenDialog },
  { channel: "registerProject", value: { step: "prepare-git" }, port: ports.entryRegister },
] as const;

/** A webContents main never created, sending from its own main frame. */
const foreignEvent = {
  sender: { id: 999_999, mainFrame: { processId: 1, routingId: 1 } },
  senderFrame: { processId: 1, routingId: 1 },
};

/** The renderer-to-main channels: every channel but the two main-to-renderer events. */
const invokeChannels = Object.values(desktopIpcChannels).filter(
  (channel) =>
    channel !== desktopIpcChannels.harnessStatusChanged &&
    channel !== desktopIpcChannels.workspaceNotification,
);

/** The channels in a fixed order, so two lists compare as sets of names. */
const sorted = (channels: readonly string[]) => [...channels].sort((a, b) => a.localeCompare(b));

describe("the window chrome in main", () => {
  /** Runs `run` with `process.platform` set to `platform`, and restores it after. */
  async function onPlatform(platform: NodeJS.Platform, run: () => Promise<void>) {
    const original = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { configurable: true, value: platform });
    try {
      await run();
    } finally {
      if (original) Object.defineProperty(process, "platform", original);
    }
  }

  it.each([
    { name: "packaged on win32", packaged: true, platform: "win32", sets: true },
    { name: "packaged on linux", packaged: true, platform: "linux", sets: false },
    { name: "development on win32", packaged: false, platform: "win32", sets: false },
  ] as const)("sets the application menu at start: $name", async ({ packaged, platform, sets }) => {
    ports.app.isPackaged = packaged;
    await onPlatform(platform, ordinaryLaunch);
    if (!sets) {
      expect(chromePorts.buildMenu).not.toHaveBeenCalled();
      expect(chromePorts.setMenu).not.toHaveBeenCalled();
      return;
    }
    expect(chromePorts.buildMenu).toHaveBeenCalledExactlyOnceWith([
      {
        label: "View",
        submenu: [
          { role: "zoomIn" },
          { label: "Zoom Out", accelerator: "CommandOrControl+-", click: expect.any(Function) },
          { role: "resetZoom" },
        ],
      },
    ]);
    expect(chromePorts.setMenu).toHaveBeenCalledExactlyOnceWith(
      chromePorts.buildMenu.mock.results[0]?.value,
    );
    expect(chromePorts.setMenu.mock.invocationCallOrder[0]).toBeLessThan(
      ports.window.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("creates the main window through the window chrome", async () => {
    await onPlatform("win32", ordinaryLaunch);
    expect(ports.window).toHaveBeenCalledExactlyOnceWith({
      width: 1120,
      height: 720,
      minWidth: 640,
      minHeight: 480,
      show: false,
      backgroundColor: "#101411",
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#050606", symbolColor: "#9aa3ab", height: 44 },
      webPreferences: {
        contextIsolation: true,
        devTools: false,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: expect.stringMatching(/preload\.js$/),
      },
    });
    const updated = chromePorts.themeOn.mock.calls.filter(([name]) => name === "updated");
    expect(updated).toHaveLength(1);
    event("before-quit");
    await flush();
    expect(ports.app.quit).toHaveBeenCalledOnce();
    expect(chromePorts.themeRemove.mock.calls).toEqual([["updated", updated[0]?.[1]]]);
  });

  describe("under high contrast", () => {
    beforeEach(() => {
      chromePorts.theme.shouldUseHighContrastColors = true;
    });
    afterEach(() => {
      chromePorts.theme.shouldUseHighContrastColors = false;
      chromePorts.getColor.mockImplementation(() => "#000000FF");
    });

    /** Answers `colours` for each system colour name main asks for. */
    const answerColours = (colours: Readonly<Record<string, string>>) =>
      chromePorts.getColor.mockImplementation((name: string) => colours[name] ?? "");
    /** Every argument any logger call received, as text. */
    const loggedText = () =>
      JSON.stringify(
        [ports.logInfo, ports.logError, ports.logWarn].flatMap((log) => log.mock.calls),
      );
    /** The repaint on a theme change: new colours, then the captured `updated` listener. */
    const repaintWith = (colours: Readonly<Record<string, string>>) => {
      answerColours(colours);
      chromePorts.themeOn.mock.calls.find(([name]) => name === "updated")?.[1]?.();
      return ports.window.mock.instances[0]?.setTitleBarOverlay.mock.calls;
    };

    it.each([
      {
        name: "readable",
        colours: { window: "#FFFFFFFF", "window-text": "#1A2B3CFF" },
        overlay: { color: "#ffffff", symbolColor: "#1a2b3c", height: 44 },
        warnings: [],
        repaint: [[{ color: "#ffffff", symbolColor: "#00ff00", height: 44 }]],
      },
      {
        name: "unreadable",
        colours: { window: "#FFFFFFFF", "window-text": "rgb(1, 2, 3)" },
        overlay: { color: "#000000", symbolColor: "#ffffff", height: 44 },
        warnings: [{ code: "DESKTOP_SYSTEM_COLOUR_UNREADABLE", colour: "window-text" }],
        repaint: undefined,
      },
    ])("follows high contrast at the entry: $name", async (row) => {
      answerColours(row.colours);
      await onPlatform("win32", ordinaryLaunch);
      expect(ports.window).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ titleBarOverlay: row.overlay }),
      );
      expect(new Set(chromePorts.getColor.mock.calls.map(([name]) => name))).toEqual(
        new Set(["window", "window-text"]),
      );
      expect(
        ports.logWarn.mock.calls
          .map(([fields]) => fields)
          .filter((fields) => fields?.code === "DESKTOP_SYSTEM_COLOUR_UNREADABLE"),
      ).toStrictEqual(row.warnings);
      // The unreadable row: the warning is the logger's only warning.
      if (row.warnings.length > 0) expect(ports.logWarn).toHaveBeenCalledOnce();
      expect(loggedText()).not.toContain("rgb(1, 2, 3)");
      if (row.repaint !== undefined)
        expect(repaintWith({ window: "#FFFFFFFF", "window-text": "#00FF00FF" })).toEqual(
          row.repaint,
        );
    });
  });

  const control = ["control"];
  const sixKeys = ["R", "I", "Plus", "-", "-", "0"].map((keyCode) => ({
    type: "keyDown",
    keyCode,
    modifiers: keyCode === "I" ? [...control, "shift"] : control,
  }));
  const failedAt = {
    reload: "Package smoke proof failed at menu-reload.\n",
    devTools: "Package smoke proof failed at menu-devtools.\n",
    storage: "Package smoke proof failed at storage.\n",
  };
  // A passing win32 bootstrap smoke with diagnostics on; each row changes what it names.
  const smoke = {
    platform: "win32" as NodeJS.Platform,
    scenario: "bootstrap",
    reloadActs: false,
    devTools: false,
    storageFails: false,
    diagnostics: true,
    pressed: true,
    exit: 0,
    writes: [] as string[],
  };
  // The proof checks reload and DevTools only after zoom answered, so those rows press all six.
  it.each([
    { ...smoke, name: "zoom only" },
    {
      ...smoke,
      name: "reload, diagnostics on",
      reloadActs: true,
      exit: 1,
      writes: [failedAt.reload],
    },
    { ...smoke, name: "reload, diagnostics off", reloadActs: true, diagnostics: false, exit: 1 },
    { ...smoke, name: "DevTools opens", devTools: true, exit: 1, writes: [failedAt.devTools] },
    { ...smoke, name: "bootstrap on linux", platform: "linux" as NodeJS.Platform, pressed: false },
    { ...smoke, name: "missing-runtime on win32", scenario: "missing-runtime", pressed: false },
    {
      ...smoke,
      name: "failed storage proof",
      storageFails: true,
      pressed: false,
      exit: 1,
      writes: [failedAt.storage],
    },
  ])(
    "presses the packaged menu's keys only in a passing win32 bootstrap smoke: $name",
    async (row) => {
      vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_SCENARIO", row.scenario);
      if (row.diagnostics) vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS", "1");
      if (row.storageFails) ports.storageSmoke.mockRejectedValueOnce(new Error("storage"));
      menuKeys.reloadActs = row.reloadActs;
      menuKeys.devToolsOpens = row.devTools;
      await onPlatform(row.platform, async () => {
        await load();
        ready();
        await flush();
      });
      const inputs = ports.window.mock.instances[0]?.webContents.sendInputEvent.mock.calls ?? [];
      expect(inputs.map(([input]) => input).filter(({ type }) => type === "keyDown")).toEqual(
        row.pressed ? sixKeys : [],
      );
      expect(ports.app.exit).toHaveBeenCalledExactlyOnceWith(row.exit);
      expect(writes).toEqual(row.writes);
    },
  );
});

describe("the IPC sender rule in main", () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  beforeEach(() => {
    // The folder dialog is offered on Windows only, so its row reaches the dialog there.
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
  });
  afterEach(() => {
    if (originalPlatform !== undefined)
      Object.defineProperty(process, "platform", originalPlatform);
  });

  it.each(invokeRows)(
    "refuses a call from a frame that is not the application window: $channel",
    async (row) => {
      await ordinaryLaunch();
      const handler = registeredHandler(row.channel);

      await expect(async () => handler(foreignEvent, row.value)).rejects.toThrow(
        /^IPC call refused: unknown sender\.$/,
      );
      if (row.port !== undefined) expect(row.port).not.toHaveBeenCalled();
      expect(ports.logWarn).toHaveBeenCalledExactlyOnceWith(
        { channel: desktopIpcChannels[row.channel] },
        "IPC call refused: unknown sender.",
      );
    },
  );

  it.each(invokeRows)(
    "admits the application window on every channel before its page finishes loading: $channel",
    async (row) => {
      ports.loadHold = new Promise<void>(() => undefined);
      await ordinaryLaunch();
      const answer = await registeredHandler(row.channel)(windowEvent(0), row.value);

      if (row.port !== undefined) expect(row.port).toHaveBeenCalledOnce();
      if (row.channel === "listProjects") expect(answer).toEqual({ status: "open-path" });
      expect(ports.logWarn).not.toHaveBeenCalled();
    },
  );

  it("registers every invoke channel, and only those, behind the sender rule", async () => {
    await ordinaryLaunch();
    const registered = ports.ipc.mock.calls.map(([channel]) => channel);

    expect(sorted(registered)).toEqual(sorted(invokeChannels));
    expect(sorted(invokeRows.map((row) => desktopIpcChannels[row.channel]))).toEqual(
      sorted(invokeChannels),
    );
    for (const [, handler] of ports.ipc.mock.calls) {
      await expect(async () => handler(foreignEvent, undefined)).rejects.toThrow(
        /^IPC call refused: unknown sender\.$/,
      );
    }
    expect(sorted(ports.logWarn.mock.calls.map(([fields]) => fields.channel))).toEqual(
      sorted(invokeChannels),
    );
  });

  it("admits a window reopened on activate", async () => {
    await ordinaryLaunch();
    event("activate");
    await flush();
    expect(ports.window).toHaveBeenCalledTimes(2);

    const answer = await registeredHandler("listProjects")(windowEvent(1), {});

    expect(answer).toEqual({ status: "open-path" });
  });
});

/**
 * The clock main gave a launch: the runtime's own `createId` and `now`, and a real clock, whose
 * time is RFC 3339 UTC between the reads around it and whose ids are distinct UUIDs.
 */
function expectRuntimeClock(clock: Readonly<{ createId(): string; now(): string }>) {
  const runtimePorts = ports.runtimePorts.mock.lastCall?.[0];
  expect(clock.createId).toBe(runtimePorts.createId);
  expect(clock.now).toBe(runtimePorts.now);
  const before = Date.now();
  const time = clock.now();
  const after = Date.now();
  expect(time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(Date.parse(time)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(time)).toBeLessThanOrEqual(after);
  const ids = [clock.createId(), clock.createId()];
  for (const id of ids)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(ids[0]).not.toBe(ids[1]);
}

describe("the desktop clock in main", () => {
  it("gives the supervisor the runtime clock", async () => {
    await ordinaryLaunch();
    expect(ports.supervisorCreated).toHaveBeenCalledOnce();
    expectRuntimeClock(ports.supervisorCreated.mock.calls[0]?.[3]);
  });

  it("gives the writer proof the runtime clock", async () => {
    await load();
    ready();
    await flush();
    expect(ports.runner).toHaveBeenCalledOnce();
    expectRuntimeClock(ports.runner.mock.calls[0]?.[0].clock);
  });
});
