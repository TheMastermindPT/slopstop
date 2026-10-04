import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { decodeStrict, RegisteredProjectSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import { launchBuiltDesktop } from "./electron-launch.js";

test("lists and switches real saved Projects through the sandboxed Electron preload", async () => {
  test.setTimeout(150_000);
  const require = createRequire(import.meta.url);
  const proof = await mkdtemp(path.join(tmpdir(), "opencode/pc-ui-proof-"));
  const userData = path.join(proof, "user-data");
  const repo = path.resolve(import.meta.dirname, "../../../..");
  const vitest = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
  execFileSync(
    process.execPath,
    [
      vitest,
      "run",
      "--config",
      "apps/harness/vitest.integration.config.ts",
      "project-entry-ui-seed.integration.test.ts",
    ],
    {
      cwd: repo,
      env: { ...process.env, PC_UI_USER_DATA: userData },
      timeout: 120000,
      stdio: "pipe",
    },
  );
  const projects = decodeStrict(
    Schema.Array(RegisteredProjectSchema),
    JSON.parse(await readFile(path.join(userData, "fixture-projects.json"), "utf8")),
  );
  const first = projects[0];
  const second = projects[1];
  if (first === undefined || second === undefined) throw new Error("Seeded Projects missing");
  const application = await launchBuiltDesktop(proof, userData);
  try {
    expect(await application.evaluate(({ app }) => app.getPath("userData"))).toBe(userData);
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: `Open project ${first.projectId}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `Project ${first.projectId.slice(0, 8)}`, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Read-write", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: `Open project ${second.projectId}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `Project ${second.projectId.slice(0, 8)}`, exact: true }),
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
      name: `Open project ${first.projectId}`,
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
