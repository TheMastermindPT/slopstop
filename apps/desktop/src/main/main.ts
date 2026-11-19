import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  decodeStrict,
  type HarnessStatus,
  HarnessStatusSchema,
  RetryHarnessResultSchema,
} from "@slopstop/protocol";
import { Effect } from "effect";
import { app, BrowserWindow, Menu, nativeTheme, systemPreferences } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { applicationMenuTemplate } from "./application-menu.js";
import { runCanonicalWriterPackageSmoke } from "./canonical-writer-package-smoke.js";
import { initializeCrashReporting } from "./crash-reporting.js";
import {
  builtDesktopServices,
  type DesktopServices,
  type DesktopSupervisor,
  makeDesktopRuntime,
  readDesktopServices,
} from "./desktop-runtime.js";
import { createDesktopShutdown } from "./desktop-shutdown.js";
import { createHarnessBridges } from "./harness-bridges.js";
import type { Clock } from "./harness-request-core.js";
import { HarnessSupervisor, harnessEntryPath } from "./harness-supervisor.js";
import { handleIpc } from "./ipc-gate.js";
import { createIpcSender, type IpcSender } from "./ipc-sender.js";
import { createMainLogger } from "./logger.js";
import { type MenuKeysProofStage, menuKeysProof } from "./menu-keys-package-smoke.js";
import {
  applyPackageSmokeAuthorization,
  type PackageSmokeAuthorization,
  PackageSmokeAuthorizationError,
  packageSmokeAuthorizationFailureMessage,
} from "./package-smoke-authorization.js";
import { prepareMainRuntimeWitness } from "./package-smoke-runtime.js";
import {
  packageSmokeRendererScript,
  validatePackageSmokeResult,
} from "./package-smoke-verifier.js";
import { registerProjectEntryIpc } from "./project-entry-ipc.js";
import { registerProjectRegistrationIpc } from "./project-registration-ipc.js";
import {
  createProjectStorageHarnessBootstrap,
  projectStorageMigrationResourcesRoot,
} from "./project-storage-bootstrap.js";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";
import {
  projectStoragePackageSmokeFailureStage,
  runProjectStoragePackageSmoke,
} from "./project-storage-package-smoke.js";
import { runRegistrationPackageSmoke } from "./registration-package-smoke.js";
import { configureSessionSecurity, lockNavigation } from "./security.js";
import type { WindowChromeService } from "./window-chrome.js";
import { reopenWindowWhenNoneIsOpen } from "./window-reopen.js";
import { broadcastWorkspaceNotification, registerWorkspaceIpc } from "./workspace-ipc.js";
import { writeWriterProofReport } from "./writer-proof-report.js";

/** The main logger, which logs the start and crash reporting before any other owner exists. */
function startMainLogger() {
  const logger = createMainLogger(app.getPath("logs"), app.isPackaged);
  logger.info({ crashReporting: initializeCrashReporting() }, "SlopStop desktop starting.");
  return logger;
}

/** The desktop's one clock: the runtime, the supervisor and the writer proof read it. */
const desktopClock: Clock = { createId: randomUUID, now: () => new Date().toISOString() };

// Built lazily: the first read of its services, in `bootstrap()`, builds the owners.
const runtime = makeDesktopRuntime({
  createLogger: () => startMainLogger(),
  harnessEntryPath: () => harnessEntryPath(__dirname),
  harnessBootstrap: () =>
    createProjectStorageHarnessBootstrap({
      userDataRoot: app.getPath("userData"),
      migrationResourcesRoot: projectStorageMigrationResourcesRoot({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        mainBundleDirectory: __dirname,
      }),
    }),
  createId: desktopClock.createId,
  now: desktopClock.now,
  createSupervisor: (logger, entryPath, bootstrap, clock) =>
    new HarnessSupervisor(entryPath, logger, bootstrap, clock),
  createHarnessBridges,
  windowChromePorts: (logger) => ({
    platform: process.platform,
    packaged: app.isPackaged,
    highContrast: () => nativeTheme.shouldUseHighContrastColors,
    systemColour: (name) => systemPreferences.getColor(name),
    onThemeUpdated: (listener) => {
      nativeTheme.on("updated", listener);
      return () => nativeTheme.removeListener("updated", listener);
    },
    createWindow: (options) => new BrowserWindow(options),
    // The colour's name only, never its value.
    reportUnreadableColour: (name) =>
      logger.warn(
        { code: "DESKTOP_SYSTEM_COLOUR_UNREADABLE", colour: name },
        "System colour unreadable.",
      ),
  }),
});
let packageSmokeState: "inactive" | "pending" | "passed" = "inactive";
// The services as the shutdown program first found them: undefined if never built. Dispose
// clears the runtime's cache, so the failure report reads this snapshot.
let shutdownServices: DesktopServices | undefined;
const servicesAtShutdown = () => (shutdownServices ??= builtDesktopServices(runtime));
// The stops read the services only if they were built; before that they stop nothing.
const desktopShutdown = createDesktopShutdown({
  stopProjectStorageBridge: () => servicesAtShutdown()?.projectStorage.stop(),
  stopWorkspaceBridge: () => servicesAtShutdown()?.workspace.stop(),
  stopProjectEntryBridge: () => servicesAtShutdown()?.projectEntry.stop(),
  stopHarness: () => servicesAtShutdown()?.harness.stop() ?? Promise.resolve(),
  dispose: () => runtime.dispose(),
  reportFailure: (error) =>
    servicesAtShutdown()?.logger.error({ err: error }, "SlopStop shutdown failed."),
  requestedExitCodeOnQuit: () => (packageSmokeState === "pending" ? 1 : undefined),
  quit: () => app.quit(),
  exit: (code) => app.exit(code),
});
const packageSmoke = app.isPackaged && process.env["SLOPSTOP_PACKAGE_SMOKE"] === "1";
let packageSmokeAuthorization: PackageSmokeAuthorization | undefined;
let packageSmokeTask: Promise<void> | undefined;
let smokeHarnessReady = false;
let smokeWindow: BrowserWindow | undefined;
let writerProofAbort: AbortController | undefined;
const writerProofTerminalMessage = "Package smoke writer processes terminal.";
const writerProofUnconfirmedMessage = "Package smoke writer process exit unconfirmed.";
const packageSmokeLockHeldMessage =
  "Package smoke single-instance lock is held by another instance.";

function reportUnconfirmedWriterProof(): void {
  const text = `${writerProofUnconfirmedMessage}\nPackage smoke proof failed at writer-internal.\n`;
  try {
    process.stderr.write(text, () => app.exit(1));
  } catch {
    app.exit(1);
  }
}

async function runPrivateWriterProof(
  authorization: PackageSmokeAuthorization,
  controller: AbortController,
): Promise<void> {
  const publishRuntime = await prepareMainRuntimeWitness({ root: authorization.root });
  const result = await runCanonicalWriterPackageSmoke({
    bootstrap: createProjectStorageHarnessBootstrap({
      userDataRoot: authorization.root,
      migrationResourcesRoot: projectStorageMigrationResourcesRoot({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        mainBundleDirectory: __dirname,
      }),
    }),
    mainBundleDirectory: __dirname,
    resourcesPath: process.resourcesPath,
    signal: controller.signal,
    clock: desktopClock,
  });
  if (result.cleanupSafe) await publishRuntime();
  const terminal = result.cleanupSafe ? writerProofTerminalMessage : writerProofUnconfirmedMessage;
  const completion =
    result.status === "passed"
      ? "Package smoke writer proof passed."
      : `Package smoke proof failed at writer-${result.stage}.`;
  await Effect.runPromise(writeWriterProofReport(`${terminal}\n${completion}\n`));
  if (result.status === "passed") packageSmokeState = "passed";
  app.exit(result.status === "passed" ? 0 : 1);
}

function readyPackageSmokeContext():
  | Readonly<{
      authorization: PackageSmokeAuthorization;
      bridge: ProjectStorageBridgeClient;
      window: BrowserWindow;
    }>
  | undefined {
  const bridge = builtDesktopServices(runtime)?.projectStorage.owner;
  const authorization = packageSmokeAuthorization;
  const window = smokeWindow;
  if (!packageSmoke) {
    return undefined;
  }
  if (!smokeHarnessReady) {
    return undefined;
  }
  if (packageSmokeTask !== undefined) {
    return undefined;
  }
  if (bridge === undefined) {
    return undefined;
  }
  if (authorization === undefined) {
    return undefined;
  }
  if (window === undefined) {
    return undefined;
  }
  return { authorization, bridge, window };
}

// The registration scenario proves add-and-list; the others prove Project Storage.
function scenarioProof(context: NonNullable<ReturnType<typeof readyPackageSmokeContext>>) {
  const entries = builtDesktopServices(runtime)?.projectEntry.owner;
  if (context.authorization.scenario !== "registration")
    return runProjectStoragePackageSmoke({
      bridge: context.bridge,
      scenario: context.authorization.scenario,
    });
  if (entries === undefined) return Promise.reject(new Error("Project entry bridge missing."));
  return runRegistrationPackageSmoke({
    root: context.authorization.root,
    register: entries.register,
    runInRenderer: (script) => context.window.webContents.executeJavaScript(script),
  });
}

const runPackageSmokeIfReady = (): void => {
  const context = readyPackageSmokeContext();
  if (context === undefined) {
    return;
  }
  packageSmokeTask = (async () => {
    try {
      const rendererProof = context.window.webContents
        .executeJavaScript(packageSmokeRendererScript)
        .then((result: unknown) => validatePackageSmokeResult(result));
      const storageProof = scenarioProof(context);
      const proofResults = await Promise.allSettled([rendererProof, storageProof]);
      if (proofResults.some((result) => result.status === "rejected")) {
        reportPackageSmokeFailure(proofResults);
        await desktopShutdown.requestExit(1);
        return;
      }
      const menuKeysStage = await proveMenuKeys(context);
      if (menuKeysStage !== undefined) {
        reportPackageSmokeStage(menuKeysStage);
        await desktopShutdown.requestExit(1);
        return;
      }
      packageSmokeState = "passed";
      await desktopShutdown.requestExit(0);
    } catch {
      await desktopShutdown.requestExit(1);
    }
  })();
};

/**
 * On Windows the bootstrap smoke also proves the packaged menu's keys (zoom acts; reload and
 * DevTools do not) in the smoke's window. Answers the failed stage, or nothing when it passed or
 * does not apply (Q9: other platforms keep the default menu).
 */
function proveMenuKeys(
  context: NonNullable<ReturnType<typeof readyPackageSmokeContext>>,
): Promise<MenuKeysProofStage | undefined> {
  if (process.platform !== "win32" || context.authorization.scenario !== "bootstrap")
    return Promise.resolve(undefined);
  const contents = context.window.webContents;
  const proof = Effect.gen(function* () {
    const loads = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const counter = { started: 0 };
        const listener = () => {
          counter.started += 1;
        };
        contents.on("did-start-loading", listener);
        return { counter, listener };
      }),
      ({ listener }) => Effect.sync(() => contents.removeListener("did-start-loading", listener)),
    );
    yield* menuKeysProof({
      sendKey: (key) =>
        Effect.sync(() => {
          context.window.focus();
          contents.focus();
          const modifiers = [...key.modifiers];
          contents.sendInputEvent({ type: "keyDown", keyCode: key.keyCode, modifiers });
          contents.sendInputEvent({ type: "keyUp", keyCode: key.keyCode, modifiers });
        }),
      zoomLevel: () => Effect.sync(() => contents.getZoomLevel()),
      loadsStarted: () => Effect.sync(() => loads.counter.started),
      devToolsOpen: () => Effect.sync(() => contents.isDevToolsOpened()),
    });
  });
  return Effect.runPromise(
    Effect.scoped(proof).pipe(
      Effect.match({ onSuccess: () => undefined, onFailure: (error) => error.stage }),
    ),
  );
}

/** With diagnostics on, names the stage a package smoke proof failed at. */
function reportPackageSmokeStage(stage: string): void {
  if (process.env["SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS"] !== "1") return;
  process.stderr.write(`Package smoke proof failed at ${stage}.\n`);
}

function reportPackageSmokeFailure(results: readonly PromiseSettledResult<unknown>[]): void {
  if (process.env["SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS"] !== "1") return;
  const [rendererResult, storageResult] = results;
  const storageStage =
    storageResult?.status === "rejected"
      ? projectStoragePackageSmokeFailureStage(storageResult.reason)
      : undefined;
  const failureStage =
    rendererResult?.status === "rejected"
      ? storageStage === undefined
        ? "renderer"
        : `renderer-and-storage-${storageStage}`
      : storageStage === undefined
        ? "storage"
        : `storage-${storageStage}`;
  reportPackageSmokeStage(failureStage);
}

function broadcastHarnessStatus(status: HarnessStatus): void {
  const validated = decodeStrict(HarnessStatusSchema, status);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(desktopIpcChannels.harnessStatusChanged, validated);
    }
  }
}

function registerHarnessIpc(harnessSupervisor: DesktopSupervisor, sender: IpcSender): void {
  handleIpc(desktopIpcChannels.getHarnessStatus, sender, () => harnessSupervisor.getStatus());
  handleIpc(desktopIpcChannels.retryHarness, sender, () => {
    return decodeStrict(RetryHarnessResultSchema, harnessSupervisor.retry());
  });
}

/** The IPC sender rule `bootstrap()` builds: every window it creates is tracked by it. */
type IpcSenderRule = ReturnType<typeof createIpcSender>;

type WindowOptions = Readonly<{
  width: number;
  height: number;
  backgroundColor: string;
  devServerUrl: string | undefined;
  viteName: string;
  preload: string;
}>;

async function createApplicationWindow(
  options: WindowOptions,
  sender: IpcSenderRule,
  chrome: WindowChromeService<BrowserWindow>,
): Promise<BrowserWindow> {
  const window = runtime.runSync(
    chrome.open({
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor,
      preload: options.preload,
    }),
  );
  // Tracked before the page loads: the renderer calls IPC while it is still loading.
  sender.track(window);

  window.once("ready-to-show", () => {
    window.show();
  });

  if (options.devServerUrl !== undefined) {
    lockNavigation(window.webContents, options.devServerUrl);
    await window.loadURL(options.devServerUrl);
  } else {
    const rendererPath = path.join(__dirname, `../renderer/${options.viteName}/index.html`);
    lockNavigation(window.webContents, pathToFileURL(rendererPath).href);
    await window.loadFile(rendererPath);
  }

  return window;
}

function createActiveWindow(
  sender: IpcSenderRule,
  chrome: WindowChromeService<BrowserWindow>,
): Promise<BrowserWindow> {
  const options: WindowOptions = {
    width: 1120,
    height: 720,
    backgroundColor: "#101411",
    devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    viteName: MAIN_WINDOW_VITE_NAME,
    preload: path.join(__dirname, "preload.js"),
  };
  return createApplicationWindow(options, sender, chrome);
}

/** In package-smoke mode, checks its authorization and moves `userData` to its root. */
function authorizePackageSmoke() {
  if (!packageSmoke) return undefined;
  return applyPackageSmokeAuthorization(
    {
      root: process.env["SLOPSTOP_PACKAGE_SMOKE_USER_DATA"],
      token: process.env["SLOPSTOP_PACKAGE_SMOKE_TOKEN"],
      scenario: process.env["SLOPSTOP_PACKAGE_SMOKE_SCENARIO"],
    },
    (root) => app.setPath("userData", root),
  );
}

/** Records an authorized package smoke as pending; a writer proof also gets its abort. */
function armPackageSmoke(authorization: NonNullable<ReturnType<typeof authorizePackageSmoke>>) {
  packageSmokeAuthorization = authorization;
  packageSmokeState = "pending";
  if (authorization.scenario === "writer-proof") writerProofAbort = new AbortController();
}

/**
 * One instance per userData: a second launch quits before any window, logger, harness or
 * package-smoke state, so nothing holds its quit back.
 */
function holdsSingleInstanceLock(authorization: ReturnType<typeof authorizePackageSmoke>): boolean {
  if (app.requestSingleInstanceLock()) return true;
  if (authorization === undefined) app.quit();
  else refuseSecondPackageSmoke();
  return false;
}

/** A package smoke that finds its root locked fails visibly instead of passing as quit. */
function refuseSecondPackageSmoke(): void {
  try {
    process.stderr.write(`${packageSmokeLockHeldMessage}\n`, () => app.exit(1));
  } catch {
    app.exit(1);
  }
}

/** Restores and focuses this instance's window when a second launch hands over to it. */
function focusExistingWindow(): void {
  const window = BrowserWindow.getAllWindows()[0];
  if (window === undefined) return;
  if (window.isMinimized()) window.restore();
  window.focus();
}

/** Before the first window: packaged Windows keeps only the zoom shortcuts. */
function setStartMenu(): void {
  const template = applicationMenuTemplate({
    packaged: app.isPackaged,
    platform: process.platform,
  });
  if (template !== undefined) Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function bootstrap(): Promise<void> {
  // The package-smoke userData is set first: the single-instance lock belongs to it.
  const authorization = authorizePackageSmoke();
  if (!holdsSingleInstanceLock(authorization)) return;
  if (authorization !== undefined) armPackageSmoke(authorization);
  app.on("second-instance", focusExistingWindow);
  await app.whenReady();
  if (packageSmokeAuthorization?.scenario === "writer-proof" && writerProofAbort !== undefined) {
    packageSmokeTask = runPrivateWriterProof(packageSmokeAuthorization, writerProofAbort);
    await packageSmokeTask;
    return;
  }
  // A quit that came before readiness already disposed the unbuilt runtime: start nothing.
  if (!desktopShutdown.accepting()) return;
  app.setAppUserModelId("dev.slopstop.desktop");
  app.setAppLogsPath();

  configureSessionSecurity();
  setStartMenu();

  // The one read of the services builds every owner, after the logs and userData paths are set.
  const { logger, harness, projectEntry, workspace, windowChrome } =
    runtime.runSync(readDesktopServices);

  const supervisor = harness.owner;
  const sender = createIpcSender({ logger });
  const createWindow = () => createActiveWindow(sender, windowChrome);
  registerProjectEntryIpc(projectEntry.owner, desktopShutdown, sender);
  registerHarnessIpc(supervisor, sender);
  registerProjectRegistrationIpc(projectEntry.owner, desktopShutdown, sender);
  registerWorkspaceIpc(workspace.owner, desktopShutdown, sender);
  supervisor.subscribe(broadcastHarnessStatus);
  workspace.owner.subscribe(broadcastWorkspaceNotification);
  if (packageSmoke) awaitSmokeHarnessReady(supervisor);
  supervisor.start();

  smokeWindow = await createWindow();
  runPackageSmokeIfReady();

  const reopen = reopenWindowWhenNoneIsOpen({
    windowCount: () => BrowserWindow.getAllWindows().length,
    create: createWindow,
    logger,
  });
  app.on("activate", () => void Effect.runPromise(reopen));
}

/** In package-smoke mode, runs the proof once the harness first reports ready. */
function awaitSmokeHarnessReady(supervisor: DesktopSupervisor): void {
  const stopSmokeListener = supervisor.subscribe((status) => {
    if (status.state !== "ready") return;
    stopSmokeListener();
    smokeHarnessReady = true;
    runPackageSmokeIfReady();
  });
}

app.on("before-quit", (event) => {
  if (writerProofAbort !== undefined) {
    event.preventDefault();
    writerProofAbort.abort();
    return;
  }
  desktopShutdown.beforeQuit(event);
});

app.on("window-all-closed", () => {
  if (writerProofAbort !== undefined) return;
  if (packageSmokeState === "pending") {
    if (packageSmokeTask === undefined) {
      packageSmokeTask = desktopShutdown.requestExit(1);
    }
    return;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let bootstrapTask: Promise<void> | undefined;

function startBootstrap(): void {
  if (bootstrapTask !== undefined) {
    return;
  }
  bootstrapTask = (async () => {
    try {
      await bootstrap();
    } catch (error: unknown) {
      if (writerProofAbort !== undefined) {
        reportUnconfirmedWriterProof();
        return;
      }
      process.stderr.write(
        `${
          error instanceof PackageSmokeAuthorizationError
            ? packageSmokeAuthorizationFailureMessage
            : "SlopStop failed to start."
        }\n`,
      );
      await desktopShutdown.requestExit(1);
    }
  })();
}

startBootstrap();
