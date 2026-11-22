import { createHash } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import {
  callbacks,
  challengeFileFault,
  chromePorts,
  configureReportingException,
  event,
  exeBytes,
  failed,
  faultPublication,
  fileOperations,
  flush,
  holdReportWrites,
  load,
  menuKeys,
  nonce,
  noOrdinaryStartup,
  onPlatform,
  passed,
  ports,
  type ReloadSignal,
  runtimeFiles,
  runtimeRoot,
  terminal,
  unconfirmed,
  useMainEntryFakes,
  witnessFile,
  writes,
} from "./canonical-writer-package-smoke-main-fakes.js";

let ready: () => void;
let releaseFileClose = () => {};
useMainEntryFakes({
  untilReady: () =>
    new Promise<void>((resolve) => {
      ready = resolve;
    }),
  untilCloseReleased: () =>
    new Promise<void>((resolve) => {
      releaseFileClose = resolve;
    }),
  loadMain: () => import("./main.js"),
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
    faultPublication("held");
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
      faultPublication(fault);
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
      holdReportWrites();
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
    holdReportWrites();
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
  it.each([
    { name: "packaged on win32", packaged: true, platform: "win32", sets: true },
    { name: "packaged on linux", packaged: true, platform: "linux", sets: false },
    { name: "development on win32", packaged: false, platform: "win32", sets: false },
  ] as const)("sets the application menu at start: $name", async ({ packaged, platform, sets }) => {
    ports.app.isPackaged = packaged;
    await onPlatform(platform, ordinaryLaunch);
    // The zoom keys are the app's where it has no menu (SH-B28): one listener, else none.
    expect(ports.window.mock.instances[0]?.webContents.listeners["before-input-event"].size).toBe(
      sets ? 1 : 0,
    );
    if (!sets) {
      expect(chromePorts.buildMenu).not.toHaveBeenCalled();
      expect(chromePorts.setMenu).not.toHaveBeenCalled();
      return;
    }
    // Packaged Windows has no menu (SH-B28): set to none, built from nothing.
    expect(chromePorts.buildMenu).not.toHaveBeenCalled();
    expect(chromePorts.setMenu).toHaveBeenCalledExactlyOnceWith(null);
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
    reloadSignals: ["loading", "token"] as readonly ReloadSignal[],
    devTools: false,
    storageFails: false,
    diagnostics: true,
    pressed: true,
    // One zoom key listener on packaged Windows; the zoom keys step 0.5, 0, -0.5, then reset.
    keyListeners: 1,
    zoomSets: [[0.5], [0], [-0.5], [0]] as number[][],
    exit: 0,
    writes: [] as string[],
  };
  // The proof judges reload and DevTools only after all six keys and the page's marker, so those
  // rows press all six.
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
    {
      ...smoke,
      name: "SH-B29 reload by a navigation alone",
      reloadActs: true,
      reloadSignals: ["navigation"] as const,
      exit: 1,
      writes: [failedAt.reload],
    },
    {
      ...smoke,
      name: "SH-B29 reload by a load alone",
      reloadActs: true,
      reloadSignals: ["loading"] as const,
      exit: 1,
      writes: [failedAt.reload],
    },
    {
      ...smoke,
      name: "SH-B29 reload by a new document, with no load event alone",
      reloadActs: true,
      reloadSignals: ["token"] as const,
      exit: 1,
      writes: [failedAt.reload],
    },
    { ...smoke, name: "DevTools opens", devTools: true, exit: 1, writes: [failedAt.devTools] },
    {
      ...smoke,
      name: "bootstrap on linux",
      platform: "linux" as NodeJS.Platform,
      pressed: false,
      keyListeners: 0,
      zoomSets: [],
    },
    {
      ...smoke,
      name: "missing-runtime on win32",
      scenario: "missing-runtime",
      pressed: false,
      zoomSets: [],
    },
    {
      ...smoke,
      name: "failed storage proof",
      storageFails: true,
      pressed: false,
      zoomSets: [],
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
      menuKeys.reloadSignals = row.reloadSignals;
      menuKeys.devToolsOpens = row.devTools;
      await onPlatform(row.platform, async () => {
        await load();
        ready();
        await flush();
      });
      const contents = ports.window.mock.instances[0]?.webContents;
      const inputs = contents?.sendInputEvent.mock.calls ?? [];
      expect(inputs.map(([input]) => input).filter(({ type }) => type === "keyDown")).toEqual(
        row.pressed ? sixKeys : [],
      );
      expect(contents?.listeners["before-input-event"].size ?? 0).toBe(row.keyListeners);
      expect(contents?.setZoomLevel.mock.calls).toEqual(row.zoomSets);
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
