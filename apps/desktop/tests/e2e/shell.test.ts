import { createRequire } from "node:module";
import path from "node:path";
import { type ElectronApplication, _electron as electron, expect, test } from "@playwright/test";
import { decodeStrict, WorkspaceIntentSchema, WorkspaceQuerySchema } from "@slopstop/protocol";
import { desktopLogLength, expectNoHarnessRequestFailure } from "./electron-launch.js";

const query = decodeStrict(WorkspaceQuerySchema, {
  query: "memory-library.read",
  projectId: "11111111-1111-4111-8111-111111111111",
  cursor: null,
});
const intent = decodeStrict(WorkspaceIntentSchema, {
  intent: "memory.proposal.review",
  projectId: "11111111-1111-4111-8111-111111111111",
  proposalId: "22222222-2222-4222-8222-222222222222",
  decision: "accept",
  expectedProjectionRevision: 0,
});

function developmentElectronExecutable(): string {
  const require = createRequire(import.meta.url);
  const electronDirectory = path.join(
    path.dirname(require.resolve("electron/package.json")),
    "dist",
  );
  if (process.platform === "win32") {
    return path.join(electronDirectory, "electron.exe");
  }

  if (process.platform === "darwin") {
    return path.join(electronDirectory, "Electron.app", "Contents", "MacOS", "Electron");
  }

  return path.join(electronDirectory, "electron");
}

test.describe("built desktop shell", () => {
  let application: ElectronApplication | undefined;
  // This journey runs on the default userData, so only the log lines after its launch count.
  let userData = "";
  let fromLine = 0;

  test.beforeEach(async () => {
    application = await electron.launch({
      executablePath: developmentElectronExecutable(),
      args: [path.resolve(".vite/build/main.cjs")],
      env: {
        ...process.env,
        SLOPSTOP_E2E: "1",
      },
    });
    userData = await application.evaluate(({ app }) => app.getPath("userData"));
    fromLine = await desktopLogLength(userData);
  });

  test.afterEach(async () => {
    await application?.close();
    await expectNoHarnessRequestFailure(userData, fromLine);
  });

  test("shows a real harness connection behind the strict renderer boundary", async () => {
    if (application === undefined) {
      throw new Error("Electron application did not launch.");
    }
    const page = await application.firstWindow();

    await expect(page.getByRole("heading", { name: "Ragnarok", level: 1 })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Harness ready");
    const boundary = await page.evaluate(() => {
      return {
        processType: typeof globalThis.process,
        requireType: typeof globalThis.require,
        exposedApi: Object.keys(window.slopstop).sort(),
      };
    });

    expect(boundary).toEqual({
      processType: "undefined",
      requireType: "undefined",
      exposedApi: [
        "activateProject",
        "chooseRepository",
        "getHarnessStatus",
        "getRegistrationCapability",
        "listProjects",
        "queryWorkspace",
        "readConversation",
        "registerProject",
        "retryHarness",
        "saveConversationMessage",
        "submitWorkspaceIntent",
        "subscribeHarnessStatus",
        "subscribeWorkspaceNotifications",
        "switchProject",
        "upgradeProject",
      ],
    });
  });

  test("returns truthful unavailable workspace results through Electron", async () => {
    if (application === undefined) {
      throw new Error("Electron application did not launch.");
    }
    const page = await application.firstWindow();
    const workspaceResults = await page.evaluate(
      async ({ query: queryInput, intent: intentInput }) => ({
        query: await window.slopstop.queryWorkspace(queryInput),
        intent: await window.slopstop.submitWorkspaceIntent(intentInput),
      }),
      { query, intent },
    );

    expect(workspaceResults).toEqual({
      query: {
        status: "unavailable",
        query,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      },
      intent: {
        status: "unavailable",
        capability: "memory",
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      },
    });
  });

  test("keeps the shell visible within the minimum window", async () => {
    if (application === undefined) {
      throw new Error("Electron application did not launch.");
    }
    const page = await application.firstWindow();
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(640, 480);
    });

    await expect(page.getByRole("status")).toContainText("Harness ready");
    await expect(page.getByRole("status")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("complementary", { name: "Projects" })).toBeInViewport({
      ratio: 1,
    });
    const dimensions = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
    }));

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
  });
});
