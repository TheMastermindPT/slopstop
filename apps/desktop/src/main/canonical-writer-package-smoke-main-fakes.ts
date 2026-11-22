/**
 * The fakes behind the main entry's tests: Electron, the file system and main's own owners,
 * mocked, with the state each row reads. Not a test file; each test file calls
 * `useMainEntryFakes()` once, with the promises its waits answer (a test file makes them).
 */
import path from "node:path";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { bootstrap } from "./canonical-writer-package-smoke-test-peers.js";

/** The signals of a reload, each of which the keys proof reads on its own. */
export type ReloadSignal = "loading" | "navigation" | "token";
/**
 * Whether Ctrl+R reloads the mocked window, as the default menu's reload would, and which signals
 * that reload gives: a full reload starts a load and makes a new document, without the token.
 */
export const menuKeys = {
  reloadActs: false,
  reloadSignals: ["loading", "token"] as readonly ReloadSignal[],
  devToolsOpens: false,
  /** The console line the page writes when Ctrl+Shift+I comes back up. */
  pageLine: "slopstop-menu-keys-marker",
  /** Which of the proof's two scripts the page fails to run, if any. */
  pageFails: "none" as "none" | "arming" | "token",
};
/** The mocked window's behaviour before any row changes it. */
const menuKeysAtStart = { ...menuKeys };
type KeyListener = (
  event: { preventDefault(): void; message?: string | undefined },
  input: Readonly<object>,
) => void;
/** The listeners the app set on one window's `webContents`, by event. */
type ContentsListeners = Readonly<
  Record<
    "did-start-loading" | "did-start-navigation" | "before-input-event" | "console-message",
    Set<KeyListener>
  >
>;
/** A key sent with `sendInputEvent`. */
type SentKey = Readonly<{ type: string; keyCode: string; modifiers?: readonly string[] }>;
/** The page's document: it keeps the token the proof's script sets. */
type PageDocument = { token?: string | undefined };

// What each sent key code types and which key it is, as a US keyboard gives them.
const keyFields: Readonly<Record<string, readonly [string, string]>> = {
  Plus: ["+", "Equal"],
  "-": ["-", "Minus"],
  "0": ["0", "Digit0"],
  R: ["r", "KeyR"],
  I: ["I", "KeyI"],
};

function emit(listeners: ContentsListeners, name: keyof ContentsListeners, message?: string) {
  for (const listener of listeners[name]) listener({ preventDefault: vi.fn(), message }, {});
}

/** What the page does with a key no app listener stopped, by key. */
const pageKeys: Readonly<
  Record<string, (listeners: ContentsListeners, page: PageDocument) => void>
> = {
  "keyDown R": (listeners, page) => {
    if (!menuKeys.reloadActs) return;
    const signals = menuKeys.reloadSignals;
    if (signals.includes("token")) page.token = undefined;
    if (signals.includes("loading")) emit(listeners, "did-start-loading");
    if (signals.includes("navigation")) emit(listeners, "did-start-navigation");
  },
  "keyUp I": (listeners) => emit(listeners, "console-message", menuKeys.pageLine),
};

/** A script the proof runs in the page. */
type PageScript = string;
/** The page running one of the proof's scripts: it sets or reads the token, or fails to run. */
async function runScript(page: PageDocument, script: PageScript) {
  const set = /slopstopMenuKeysToken = "([^"]+)"/u.exec(script);
  const read = script === "document.slopstopMenuKeysToken";
  if (menuKeys.pageFails === (set ? "arming" : read && "token"))
    throw new Error("Script failed to run");
  if (set) page.token = set[1];
  return read ? page.token : {};
}

/** A key sent: first to the app's `before-input-event` listeners, then, unless stopped, the page. */
function sendKey(listeners: ContentsListeners, page: PageDocument, input: SentKey) {
  const [key, code] = keyFields[input.keyCode] ?? [input.keyCode, input.keyCode];
  const modifiers = input.modifiers ?? [];
  const event = { stopped: false, preventDefault: () => (event.stopped = true) };
  for (const listener of listeners["before-input-event"])
    listener(event, {
      type: input.type,
      key,
      code,
      control: modifiers.includes("control"),
      shift: modifiers.includes("shift"),
      alt: false,
      meta: false,
    });
  if (!event.stopped) pageKeys[`${input.type} ${input.keyCode}`]?.(listeners, page);
}

/** How many windows' `webContents` the fakes made, so each has its own id. */
let contentsMade = 0;
/**
 * A mocked window's `webContents`, for the bootstrap smoke's keys proof on win32. A key sent goes
 * first to the `before-input-event` listeners the app set, as Electron's `Input`; a key none of
 * them stops goes on to the page. The page starts a load on Ctrl+R only when `menuKeys.reloadActs`
 * lets it, as the default menu's reload would, and writes the proof's marker to its console when
 * Ctrl+Shift+I comes back up. The page's document keeps the token the proof's script sets, and a
 * reload makes a new document without it.
 */
const mockContents = () => {
  const id = ++contentsMade;
  const zoom = { level: 0 };
  const page: PageDocument = {};
  const listeners: ContentsListeners = {
    "did-start-loading": new Set<KeyListener>(),
    "did-start-navigation": new Set<KeyListener>(),
    "before-input-event": new Set<KeyListener>(),
    "console-message": new Set<KeyListener>(),
  };
  return {
    id,
    /** The listeners the app set, by event. */
    listeners,
    mainFrame: { processId: 100, routingId: id },
    executeJavaScript: vi.fn((script: PageScript) => runScript(page, script)),
    focus: vi.fn(),
    on: vi.fn((name: string, listener: KeyListener) => {
      if (name in listeners) listeners[name as keyof ContentsListeners].add(listener);
    }),
    removeListener: vi.fn((name: string, listener: KeyListener) =>
      listeners[name as keyof ContentsListeners]?.delete(listener),
    ),
    getZoomLevel: vi.fn(() => zoom.level),
    setZoomLevel: vi.fn((level: number) => (zoom.level = level)),
    isDevToolsOpened: vi.fn(() => menuKeys.devToolsOpens),
    sendInputEvent: vi.fn((input: SentKey) => sendKey(listeners, page, input)),
  };
};
export const ports = {
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
      webContents = mockContents();
    },
  ),
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
};
vi.mock("node:fs/promises", () => ({
  open: ports.open,
  lstat: ports.lstat,
  realpath: ports.realpath,
}));
/** The application menu, the native theme and the system colours main reads (pf-s2). */
export const chromePorts = {
  buildMenu: vi.fn((template: unknown) => ({ template })),
  setMenu: vi.fn(),
  themeOn: vi.fn(),
  themeRemove: vi.fn(),
  getColor: vi.fn((_name: string) => "#000000FF"),
  /** The native theme main reads; a row may switch high contrast on. */
  theme: { shouldUseHighContrastColors: false },
};
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

export const terminal = "Package smoke writer processes terminal.\n";
export const unconfirmed = "Package smoke writer process exit unconfirmed.\n";
export const passed = "Package smoke writer proof passed.\n";
export const failed = (stage: string) => `Package smoke proof failed at writer-${stage}.\n`;
const originalArgv = [...process.argv];
const originalElectron = Object.getOwnPropertyDescriptor(process.versions, "electron");
export const runtimeRoot = path.resolve(path.parse(process.cwd()).root, "proof", "user");
const challengeFile = path.join(runtimeRoot, ".slopstop-runtime-challenge.json");
export const witnessFile = path.join(runtimeRoot, ".slopstop-runtime-witness.json");
export const nonce = "a".repeat(64);
export const exeBytes = Buffer.from("actual main image bytes");
export const runtimeFiles = new Map<string, { kind: "file" | "dir" | "link"; bytes: Buffer }>();
let publicationFault = "";
export const fileOperations: string[] = [];
/** A path in the fake file system. */
type FakePath = string;
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
function runtimeEntry(file: FakePath) {
  const result = runtimeFiles.get(file);
  if (!result) throw Object.assign(new Error("missing"), { code: "ENOENT" });
  return result;
}
function runtimeStat(file: FakePath) {
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
async function closeRuntimeFile(file: FakePath) {
  if (file === witnessFile && publicationFault === "close")
    throw new Error("private close failure");
  if (file === witnessFile && publicationFault === "held") await waits.untilCloseReleased();
  fileOperations.push(`closed:${file}`);
}
async function openRuntimeFile(file: FakePath, flags: "r" | "wx") {
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
export function challengeFileFault(fault: string) {
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
export let writes: string[];
export let callbacks: Array<() => void>;
let holdWrites: boolean;
let statusListeners: Array<(status: unknown) => void>;
export async function flush(): Promise<void> {
  for (let index = 0; index < 200; index++) await Promise.resolve();
}
/** Loads the real main entry, through the test's own import, then lets it settle. */
export async function load(): Promise<void> {
  await waits.loadMain();
  await flush();
}
export function event(name: string) {
  const listener = ports.app.on.mock.calls.find(([candidate]) => candidate === name)?.[1];
  if (typeof listener !== "function") throw new Error(`Missing app event: ${name}`);
  const value = { preventDefault: vi.fn() };
  listener(value);
  return value;
}
export function noOrdinaryStartup() {
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
export function configureReportingException(mode: string): void {
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
/** Each row starts from a fresh module graph, fresh fakes and a passing smoke. */
/** The promises the fakes' waits answer; the test settles them. */
export type MainEntryWaits = Readonly<{
  /** What `app.whenReady()` answers, each time. */
  untilReady: () => Promise<void>;
  /** What a held witness close waits for. */
  untilCloseReleased: () => Promise<void>;
  /** Imports `./main.js` from the test file, the one place the boundary rule lets import it. */
  loadMain: () => Promise<unknown>;
}>;
let waits: MainEntryWaits;
export function useMainEntryFakes(rowWaits: MainEntryWaits): void {
  waits = rowWaits;
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.assign(menuKeys, menuKeysAtStart);
    configureRuntimeFiles();
    writes = [];
    callbacks = [];
    statusListeners = [];
    holdWrites = false;
    ports.app.isPackaged = true;
    ports.app.whenReady.mockImplementation(waits.untilReady);
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
    vi.useRealTimers();
  });
}

/** Holds every report write until its callback is run. */
export function holdReportWrites(): void {
  holdWrites = true;
}

/** Makes the witness publication fail, race or wait in the way `fault` names. */
export function faultPublication(fault: string): void {
  publicationFault = fault;
}

/** Runs `run` with `process.platform` set to `platform`, and restores it after. */
export async function onPlatform(
  platform: NodeJS.Platform,
  run: () => Promise<void>,
): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { configurable: true, value: platform });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(process, "platform", original);
  }
}
