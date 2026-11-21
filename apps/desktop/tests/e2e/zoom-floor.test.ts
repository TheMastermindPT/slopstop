import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { expectDesktopLog, launchBuiltDesktop } from "./electron-launch.js";
import { temporaryRoot } from "./temporary-root.js";

/** Chromium's zoom level for a factor: `log(factor) / log(1.2)`. */
const levelOf = (factor: number) => Math.log(factor) / Math.log(1.2);

/** `value`'s own fields, or none when it is not an object. */
const fields = (value: unknown): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(Object(value)));

/**
 * The page zoom levels the profile under `userData` keeps between launches (Chromium's
 * `Preferences`, `partition.per_host_zoom_levels`: per partition, per page, a level or an
 * object holding `zoom_level`).
 */
async function savedZoomLevels(userData: string): Promise<number[]> {
  const preferences = JSON.parse(await readFile(path.join(userData, "Preferences"), "utf8"));
  const partitions = Object.values(
    fields(fields(fields(preferences)["partition"])["per_host_zoom_levels"]),
  );
  return partitions
    .flatMap((pages) => Object.values(fields(pages)))
    .map((saved) => (typeof saved === "number" ? saved : Number(fields(saved)["zoom_level"])));
}

/** The window's zoom factor. */
const zoomFactor = (application: ElectronApplication) =>
  application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor(),
  );

/** Launches the built desktop on `userData` and waits for its page. */
async function launch(proof: string, userData: string) {
  const application = await launchBuiltDesktop(proof, userData);
  await (await application.firstWindow()).waitForLoadState("load");
  return application;
}

test("SH-B27: brings a zoom saved under 80% up to 80% on the next launch, and it stays", async () => {
  test.setTimeout(180_000);
  const proof = await temporaryRoot("sh-zoom-floor-");
  const userData = path.join(proof, "user-data");
  await mkdir(userData);

  const first = await launch(proof, userData);
  await first.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(0.5);
  });
  await expect.poll(() => zoomFactor(first)).toBeCloseTo(0.5, 6);
  await first.close();
  expect(await savedZoomLevels(userData)).toEqual([expect.closeTo(levelOf(0.5), 2)]);

  const second = await launch(proof, userData);
  await expect.poll(() => zoomFactor(second)).toBeCloseTo(0.8, 6);
  await second.close();
  expect(await savedZoomLevels(userData)).toEqual([expect.closeTo(levelOf(0.8), 3)]);

  const third = await launch(proof, userData);
  await expect.poll(() => zoomFactor(third)).toBeCloseTo(0.8, 6);
  await third.close();
  await expectDesktopLog(userData, 3);
});
