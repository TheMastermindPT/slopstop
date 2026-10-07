import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { decodeStrict, ProjectUpgradeRequestSchema } from "@slopstop/protocol";
import { launchBuiltDesktop } from "./electron-launch.js";
import { runHarnessSeed } from "./harness-seed.js";

const startingMessage = "SlopStop desktop starting.";

test("updates an older Project in the window", async () => {
  test.setTimeout(150_000);
  const proof = await mkdtemp(path.join(tmpdir(), "slopstop-upgrade-"));
  const userData = path.join(proof, "user-data");
  await mkdir(userData);
  runHarnessSeed("project-upgrade-ui-seed.integration.test.ts", "PC_UPGRADE_USER_DATA", userData);
  const { projectId } = decodeStrict(
    ProjectUpgradeRequestSchema,
    JSON.parse(await readFile(path.join(userData, "fixture-upgrade-project.json"), "utf8")),
  );
  const short = projectId.slice(0, 8);
  const application = await launchBuiltDesktop(proof, userData);
  try {
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const open = page.getByRole("button", {
      name: `Open Project without a repository ${short}`,
      exact: true,
    });
    await expect(open).toBeEnabled();
    // Record each change of the progress line in order, collapsing repeats.
    await page.evaluate(() => {
      const target = document.getElementById("ws-progress");
      if (target === null) throw new Error("#ws-progress is not mounted");
      const seen: string[] = [];
      Reflect.set(window, "progressSeen", seen);
      new MutationObserver(() => {
        const text = target.textContent ?? "";
        if (seen.at(-1) !== text) seen.push(text);
      }).observe(target, { childList: true, characterData: true, subtree: true });
    });
    await open.click();
    const workspace = page.getByRole("region", { name: "Project workspace" });
    await expect(
      workspace.getByRole("heading", { name: `Project without a repository ${short}` }),
    ).toBeVisible();
    await expect(workspace.getByText("Read-write", { exact: true })).toBeVisible();
    // The refreshed list no longer shows the Project in safe mode.
    await expect(open).not.toContainText("Safe mode");
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "progressSeen")))
      .toEqual(["Opening Project…", "Updating Project…", ""]);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
  const log = await readFile(path.join(userData, "logs", "slopstop.jsonl"), "utf8");
  const lines = log.split("\n").filter((line) => line.trim() !== "");
  expect(
    lines.filter((line) => Reflect.get(JSON.parse(line) as object, "msg") === startingMessage),
  ).toHaveLength(1);
  expect(log).not.toContain("HARNESS_LOG_LINE_");
});
