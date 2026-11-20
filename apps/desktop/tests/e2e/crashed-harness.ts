import { type ElectronApplication, expect, type Page } from "@playwright/test";

/**
 * The ids of the harness processes, read from the main process: the utility processes whose
 * name is the `serviceName` the supervisor forks the harness with ("SlopStop Harness").
 */
export const harnessPids = (application: ElectronApplication) =>
  application.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .filter((metric) => metric.type === "Utility" && metric.name === "SlopStop Harness")
      .map((metric) => metric.pid),
  );

/**
 * Ends the harness process from the main process, each time a new one runs, until the
 * supervisor gives up its automatic recovery and the harness strip offers "Retry harness".
 */
export async function crashHarness(application: ElectronApplication, page: Page) {
  const retry = page.getByRole("button", { name: "Retry harness" });
  let ended: number | null = null;
  const newHarnessRuns = async () => {
    const pids = await harnessPids(application);
    return pids.length > 0 && !pids.includes(ended ?? -1);
  };
  for (let attempt = 0; attempt < 6 && !(await retry.isVisible()); attempt += 1) {
    await expect
      .poll(async () => (await retry.isVisible()) || (await newHarnessRuns()), {
        timeout: 30_000,
      })
      .toBe(true);
    if (await retry.isVisible()) break;
    const pids = await harnessPids(application);
    // Exactly one process is the harness; it is the one this step ends.
    expect(pids).toHaveLength(1);
    const pid = pids[0] ?? -1;
    await application.evaluate((_electron, target) => process.kill(target), pid);
    ended = pid;
  }
  await expect(retry).toBeVisible({ timeout: 30_000 });
}
