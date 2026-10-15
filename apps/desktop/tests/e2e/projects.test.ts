import { mkdtemp, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchBuiltDesktop } from "./electron-launch.js";
import { seedTwoProjects } from "./harness-seed.js";

test("lists and switches real saved Projects through the sandboxed Electron preload", async () => {
  test.setTimeout(150_000);
  const proof = await mkdtemp(path.join(tmpdir(), "opencode/pc-ui-proof-"));
  const userData = path.join(proof, "user-data");
  const [first] = await seedTwoProjects(userData);
  const application = await launchBuiltDesktop(proof, userData);
  try {
    expect(await application.evaluate(({ app }) => app.getPath("userData"))).toBe(userData);
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Project repository-a", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Project repository-a", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Read-write", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Project repository-b", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Project repository-b", exact: true }),
    ).toBeVisible();
    // A is released after switching to B. Remove only its disposable runtime database.
    const runtimeDatabase = path.join(
      userData,
      "storage",
      "projects",
      first.projectId,
      first.generationId,
      "mastra.db",
    );
    await rename(runtimeDatabase, path.join(proof, "held-runtime.db"));
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    const safeProject = page.getByRole("button", {
      name: "Open Project repository-a",
      exact: true,
    });
    await expect(safeProject).toContainText("Runtime missing");
    await safeProject.click();
    const workspace = page.getByRole("region", { name: "Project workspace" });
    await expect(workspace.getByText("Safe mode · Runtime missing", { exact: true })).toBeVisible();
    await expect(workspace).toContainText("Writes unavailable");
    await expect(workspace).not.toContainText("Read-write");
    await expect(workspace).not.toContainText("are connected");
    expect(
      await page.evaluate(() => ({
        node: typeof globalThis.process,
        require: typeof globalThis.require,
      })),
    ).toEqual({ node: "undefined", require: "undefined" });
    await page.screenshot({ path: path.join(proof, "projects-wide.png"), fullPage: false });
    await writeFile(
      path.join(proof, "projects-accessibility.txt"),
      await page.locator("main").ariaSnapshot(),
    );
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(640, 480),
    );
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: path.join(proof, "projects-narrow.png"), fullPage: false });
    expect(errors).toEqual([]);
    console.log(`Project entry Electron proof: ${proof}`);
  } finally {
    await application.close();
  }
});
