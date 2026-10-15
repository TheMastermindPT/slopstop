import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { decodeStrict, ProjectUpgradeRequestSchema } from "@slopstop/protocol";
import { recordSlotTexts, slotTexts } from "./conversation-window.js";
import { expectDesktopLog, launchBuiltDesktop } from "./electron-launch.js";
import { runHarnessSeed } from "./harness-seed.js";

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
    await recordSlotTexts(page, "ws-progress");
    await open.click();
    const workspace = page.getByRole("region", { name: "Project workspace" });
    await expect(
      workspace.getByRole("heading", { name: `Project without a repository ${short}` }),
    ).toBeVisible();
    await expect(workspace.getByText("Read-write", { exact: true })).toBeVisible();
    // The refreshed list no longer shows the Project in safe mode.
    await expect(open).not.toContainText("Safe mode");
    await expect
      .poll(async () => (await slotTexts(page, "ws-progress")).texts)
      .toEqual(["Opening Project…", "Updating Project…", ""]);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
  await expectDesktopLog(userData, 1);
});
