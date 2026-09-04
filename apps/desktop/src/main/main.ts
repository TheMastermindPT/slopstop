import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  type HarnessStatus,
  HarnessStatusSchema,
  RetryHarnessResultSchema,
  type WorkspaceIntent,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQuery,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { app, BrowserWindow, ipcMain } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { initializeCrashReporting } from "./crash-reporting.js";
import { createDesktopShutdown } from "./desktop-shutdown.js";
import { HarnessSupervisor, harnessEntryPath } from "./harness-supervisor.js";
import { createMainLogger } from "./logger.js";
import {
  applyPackageSmokeAuthorization,
  type PackageSmokeAuthorization,
  PackageSmokeAuthorizationError,
  packageSmokeAuthorizationFailureMessage,
} from "./package-smoke-authorization.js";
import {
  packageSmokeRendererScript,
  validatePackageSmokeResult,
} from "./package-smoke-verifier.js";
import {
  createProjectStorageHarnessBootstrap,
  projectStorageMigrationResourcesRoot,
} from "./project-storage-bootstrap.js";
import {
  createProjectStorageBridge,
  type ProjectStorageBridgeClient,
} from "./project-storage-bridge.js";
import {
  projectStoragePackageSmokeFailureStage,
  runProjectStoragePackageSmoke,
} from "./project-storage-package-smoke.js";
import { configureSessionSecurity, lockNavigation } from "./security.js";
import { createWorkspaceBridge, type WorkspaceBridgeClient } from "./workspace-bridge.js";

let supervisor: HarnessSupervisor | undefined;
let projectStorageBridge: ProjectStorageBridgeClient | undefined;
let workspaceBridge: WorkspaceBridgeClient | undefined;
let packageSmokeState: "inactive" | "pending" | "passed" = "inactive";
const desktopShutdown = createDesktopShutdown({
  stopProjectStorageBridge: () => projectStorageBridge?.stop(),
  stopWorkspaceBridge: () => workspaceBridge?.stop(),
  stopHarness: () => supervisor?.stop() ?? Promise.resolve(),
  requestedExitCodeOnQuit: () => (packageSmokeState === "pending" ? 1 : undefined),
  quit: () => app.quit(),
  exit: (code) => app.exit(code),
});
const prototypeMode = process.argv.includes("--prototype");
const packageSmoke =
  !prototypeMode && app.isPackaged && process.env["SLOPSTOP_PACKAGE_SMOKE"] === "1";
let packageSmokeAuthorization: PackageSmokeAuthorization | undefined;
let packageSmokeTask: Promise<void> | undefined;
let smokeHarnessReady = false;
let smokeWindow: BrowserWindow | undefined;

function readyPackageSmokeContext():
  | Readonly<{
      authorization: PackageSmokeAuthorization;
      bridge: ProjectStorageBridgeClient;
      window: BrowserWindow;
    }>
  | undefined {
  const bridge = projectStorageBridge;
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
      const storageProof = runProjectStoragePackageSmoke({
        bridge: context.bridge,
        scenario: context.authorization.scenario,
      });
      const proofResults = await Promise.allSettled([rendererProof, storageProof]);
      if (proofResults.some((result) => result.status === "rejected")) {
        if (process.env["SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS"] === "1") {
          const [rendererResult, storageResult] = proofResults;
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
          process.stderr.write(`Package smoke proof failed at ${failureStage}.\n`);
        }
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

function broadcastHarnessStatus(status: HarnessStatus): void {
  const validated = HarnessStatusSchema.parse(status);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(desktopIpcChannels.harnessStatusChanged, validated);
    }
  }
}

function registerHarnessIpc(harnessSupervisor: HarnessSupervisor): void {
  ipcMain.handle(desktopIpcChannels.getHarnessStatus, () => harnessSupervisor.getStatus());
  ipcMain.handle(desktopIpcChannels.retryHarness, () => {
    return RetryHarnessResultSchema.parse(harnessSupervisor.retry());
  });
}

export function broadcastWorkspaceNotification(notification: WorkspaceNotification): void {
  const validated = WorkspaceNotificationSchema.parse(notification);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(desktopIpcChannels.workspaceNotification, validated);
    }
  }
}

export function registerWorkspaceIpc(bridge: WorkspaceBridgeClient): void {
  ipcMain.handle(desktopIpcChannels.queryWorkspace, (_event, value: unknown) => {
    return bridge.query(WorkspaceQuerySchema.parse(value) satisfies WorkspaceQuery);
  });
  ipcMain.handle(desktopIpcChannels.submitWorkspaceIntent, (_event, value: unknown) => {
    return bridge.submit(WorkspaceIntentSchema.parse(value) satisfies WorkspaceIntent);
  });
}

type WindowOptions = Readonly<{
  width: number;
  height: number;
  backgroundColor: string;
  devServerUrl: string | undefined;
  viteName: string;
  preload: string | undefined;
}>;

async function createApplicationWindow(options: WindowOptions): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: options.width,
    height: options.height,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: options.backgroundColor,
    webPreferences: {
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      ...(options.preload === undefined ? {} : { preload: options.preload }),
    },
  });

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

function createActiveWindow(): Promise<BrowserWindow> {
  const options: WindowOptions = prototypeMode
    ? {
        width: 1440,
        height: 900,
        backgroundColor: "#050711",
        devServerUrl: PROTOTYPE_WINDOW_VITE_DEV_SERVER_URL,
        viteName: PROTOTYPE_WINDOW_VITE_NAME,
        preload: undefined,
      }
    : {
        width: 1120,
        height: 720,
        backgroundColor: "#101411",
        devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
        viteName: MAIN_WINDOW_VITE_NAME,
        preload: path.join(__dirname, "preload.js"),
      };
  return createApplicationWindow(options);
}

async function bootstrap(): Promise<void> {
  if (packageSmoke) {
    const authorization = applyPackageSmokeAuthorization(
      {
        root: process.env["SLOPSTOP_PACKAGE_SMOKE_USER_DATA"],
        token: process.env["SLOPSTOP_PACKAGE_SMOKE_TOKEN"],
        scenario: process.env["SLOPSTOP_PACKAGE_SMOKE_SCENARIO"],
      },
      (root) => app.setPath("userData", root),
    );
    packageSmokeAuthorization = authorization;
    packageSmokeState = "pending";
  }
  await app.whenReady();
  app.setAppUserModelId("dev.slopstop.desktop");
  app.setAppLogsPath();

  configureSessionSecurity();

  if (!prototypeMode) {
    const logger = createMainLogger(app.getPath("logs"), app.isPackaged);
    logger.info({ crashReporting: initializeCrashReporting() }, "SlopStop desktop starting.");

    const migrationResourcesRoot = projectStorageMigrationResourcesRoot({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      mainBundleDirectory: __dirname,
    });
    const harnessBootstrap = createProjectStorageHarnessBootstrap({
      userDataRoot: app.getPath("userData"),
      migrationResourcesRoot,
    });
    supervisor = new HarnessSupervisor(harnessEntryPath(__dirname), logger, harnessBootstrap);
    const harnessSession = supervisor.getSession();
    projectStorageBridge = createProjectStorageBridge({
      session: harnessSession,
      createId: randomUUID,
      now: () => new Date().toISOString(),
    });
    workspaceBridge = createWorkspaceBridge({
      session: harnessSession,
      createId: randomUUID,
      now: () => new Date().toISOString(),
    });
    registerHarnessIpc(supervisor);
    registerWorkspaceIpc(workspaceBridge);
    supervisor.subscribe(broadcastHarnessStatus);
    workspaceBridge.subscribe(broadcastWorkspaceNotification);
    if (packageSmoke) {
      const stopSmokeListener = supervisor.subscribe((status) => {
        if (status.state === "ready") {
          stopSmokeListener();
          smokeHarnessReady = true;
          runPackageSmokeIfReady();
        }
      });
    }
    supervisor.start();
  }

  const activeWindow = await createActiveWindow();
  if (!prototypeMode) {
    smokeWindow = activeWindow;
    runPackageSmokeIfReady();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createActiveWindow();
    }
  });
}

app.on("before-quit", (event) => {
  desktopShutdown.beforeQuit(event);
});

app.on("window-all-closed", () => {
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
