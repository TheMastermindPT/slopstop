import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  type HarnessStatus,
  HarnessStatusSchema,
  RetryHarnessResultSchema,
} from "@slopstop/protocol";
import { app, BrowserWindow, ipcMain } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { initializeCrashReporting } from "./crash-reporting.js";
import { HarnessSupervisor, harnessEntryPath } from "./harness-supervisor.js";
import { createMainLogger } from "./logger.js";
import { configureSessionSecurity, lockNavigation } from "./security.js";

let supervisor: HarnessSupervisor | undefined;

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

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: "#101411",
    webPreferences: {
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL !== undefined) {
    lockNavigation(window.webContents, MAIN_WINDOW_VITE_DEV_SERVER_URL);
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    lockNavigation(window.webContents, pathToFileURL(rendererPath).href);
    await window.loadFile(rendererPath);
  }

  return window;
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  app.setAppUserModelId("dev.slopstop.desktop");
  app.setAppLogsPath();

  const logger = createMainLogger(app.getPath("logs"), app.isPackaged);
  logger.info({ crashReporting: initializeCrashReporting() }, "SlopStop desktop starting.");

  configureSessionSecurity();
  supervisor = new HarnessSupervisor(harnessEntryPath(__dirname), logger);
  registerHarnessIpc(supervisor);
  supervisor.subscribe(broadcastHarnessStatus);
  if (process.env["SLOPSTOP_PACKAGE_SMOKE"] === "1") {
    const stopSmokeListener = supervisor.subscribe((status) => {
      if (status.state === "ready") {
        stopSmokeListener();
        setTimeout(() => {
          app.quit();
        }, 100);
      }
    });
  }
  supervisor.start();

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
}

app.on("before-quit", () => {
  supervisor?.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`SlopStop failed to start: ${String(error)}\n`);
  app.exit(1);
});
