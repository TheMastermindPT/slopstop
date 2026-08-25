import { createRequire } from "node:module";
import path from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { WorkspaceIntentSchema, WorkspaceQuerySchema } from "@slopstop/protocol";

const query = WorkspaceQuerySchema.parse({
  query: "memory-library.read",
  projectId: "11111111-1111-4111-8111-111111111111",
  cursor: null,
});
const intent = WorkspaceIntentSchema.parse({
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

function collectRendererErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function capturePrototype(page: Page, directory: string, name: string): Promise<void> {
  if (process.env["SLOPSTOP_CAPTURE_PROTOTYPE"] === "1") {
    await page.screenshot({
      path: path.join(directory, name),
      fullPage: false,
    });
  }
}

test.describe("built desktop shell", () => {
  let application: ElectronApplication | undefined;

  test.beforeEach(async () => {
    application = await electron.launch({
      executablePath: developmentElectronExecutable(),
      args: [path.resolve(".vite/build/main.cjs")],
      env: {
        ...process.env,
        SLOPSTOP_E2E: "1",
      },
    });
  });

  test.afterEach(async () => {
    await application?.close();
  });

  test("shows a real harness connection behind the strict renderer boundary", async () => {
    if (application === undefined) {
      throw new Error("Electron application did not launch.");
    }
    const page = await application.firstWindow();

    await expect(page.getByRole("heading", { name: "SlopStop" })).toBeVisible();
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
        "getHarnessStatus",
        "queryWorkspace",
        "retryHarness",
        "submitWorkspaceIntent",
        "subscribeHarnessStatus",
        "subscribeWorkspaceNotifications",
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
    await expect(page.locator("footer")).toBeInViewport({ ratio: 1 });
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

test("opens the isolated supervision prototype at wide and narrow widths", async () => {
  const application = await electron.launch({
    executablePath: developmentElectronExecutable(),
    args: [path.resolve(".vite/build/main.cjs"), "--prototype"],
  });

  try {
    const page = await application.firstWindow();
    const rendererErrors = collectRendererErrors(page);

    await expect(page.getByRole("heading", { name: "Relationship map" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Attention" })).toBeVisible();

    const workspaceTabs = page.getByRole("tablist", { name: "Open workspace surfaces" });
    await workspaceTabs.getByRole("tab", { name: "Conversation" }).click();
    await expect(page.getByRole("heading", { name: "Frame the product" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Context workbench" })).toHaveCount(0);
    const captureDirectory = path.resolve("../..", ".impeccable", "review");
    await capturePrototype(page, captureDirectory, "conversation-wide.png");
    await page.getByRole("button", { name: "Review Frame" }).click();
    await expect(page.getByRole("heading", { name: "Review the Frame" })).toBeVisible();
    await capturePrototype(page, captureDirectory, "review-wide.png");
    await page.getByRole("button", { name: "Return to Conversation" }).click();
    await page.getByRole("button", { name: "Open Project menu" }).click();
    await page.getByRole("menuitem", { name: /Memory library/i }).click();
    await expect(page.getByRole("heading", { name: "Project Memory" })).toBeVisible();
    await capturePrototype(page, captureDirectory, "memory-wide.png");
    await page.getByRole("button", { name: "Return to Conversation" }).click();
    await workspaceTabs.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByRole("heading", { name: "Relationship map" })).toBeVisible();

    const boundary = await page.evaluate(() => ({
      processType: typeof globalThis.process,
      requireType: typeof globalThis.require,
      preloadApiType: typeof window.slopstop,
    }));
    expect(boundary).toEqual({
      processType: "undefined",
      requireType: "undefined",
      preloadApiType: "undefined",
    });

    await capturePrototype(page, captureDirectory, "map-wide.png");

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
    });
    await workspaceTabs.getByRole("tab", { name: "Conversation" }).click();
    await expect(page.getByRole("heading", { name: "Frame the product" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: innerHeight,
      viewportWidth: innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight);

    await capturePrototype(page, captureDirectory, "conversation-narrow.png");

    await workspaceTabs.getByRole("tab", { name: "Map" }).click();
    await expect(page.getByRole("complementary", { name: "Context workbench" })).toBeInViewport({
      ratio: 1,
    });

    expect(rendererErrors).toEqual([]);
  } finally {
    await application.close();
  }
});
