import path from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { axeViolations, forcedTextColours, setZoom, sizeContent } from "./accessibility.js";
import { computedValue } from "./computed-style.js";
import { crashHarness } from "./crashed-harness.js";
import { expectNoHarnessRequestFailure, launchBuiltDesktop } from "./electron-launch.js";
import { temporaryRoot } from "./temporary-root.js";

const bannerSelector = "header:not(:is(article, aside, main, nav, section) header)";
const regionSelector = 'section[aria-label="Harness unavailable"]';

/** A refused retry's message, 160 characters long (PF-B40's). */
const retryFailure =
  "The harness could not be started again: the process ended before it answered the first request, so Ragnarok stopped trying. Check the local log, then try later.";

/** Runs `journey` on the built desktop at display scale 1 with the harness unavailable. */
async function withUnavailableHarness(
  journey: (application: ElectronApplication, page: Page) => Promise<void>,
  whileReady?: (page: Page) => Promise<void>,
) {
  const proof = await temporaryRoot("sh-strip-");
  const userData = path.join(proof, "user-data");
  const application = await launchBuiltDesktop(proof, userData, ["--force-device-scale-factor=1"]);
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await whileReady?.(page);
    await crashHarness(application, page);
    await expect(page.locator(regionSelector)).toBeVisible();
    await journey(application, page);
  } finally {
    await application.close();
  }
  await expectNoHarnessRequestFailure(userData);
}

/**
 * A refused retry, for real: the test swaps main's retry handler for one that refuses with
 * `retryFailure`, presses Retry, and waits for the strip's own alert. No product code changes.
 */
async function refuseRetry(application: ElectronApplication, page: Page) {
  await application.evaluate(({ ipcMain }, message) => {
    ipcMain.removeHandler("harness:retry");
    ipcMain.handle("harness:retry", () => ({
      ok: false,
      error: { code: "HARNESS_RETRY_UNAVAILABLE", message },
    }));
  }, retryFailure);
  await page.locator(regionSelector).getByRole("button", { name: "Retry harness" }).click();
  await expect(page.locator(regionSelector).getByRole("alert")).toHaveText(retryFailure);
}

/** The strip and its parts, the sidebar, the banner and the page, as boxes in CSS px. */
function stripBoxes(page: Page) {
  return page.evaluate(
    ({ banner, region }) => {
      // A missing element reads as NaN, which no comparison accepts.
      const box = (element: Element | null) => {
        const rect = element?.getBoundingClientRect();
        if (rect === undefined)
          return { left: Number.NaN, top: Number.NaN, right: Number.NaN, bottom: Number.NaN };
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      };
      const strip = document.querySelector(region) ?? document.createElement("section");
      const words = strip.querySelectorAll("p");
      return {
        banner: box(document.querySelector(banner)),
        sidebar: box(document.querySelector('aside[aria-label="Projects"]')),
        place: box(strip.parentElement),
        region: box(strip.isConnected ? strip : null),
        text: box(strip.querySelector("div")),
        word: box(words.item(0)),
        detail: box(words.item(1)),
        alert: box(strip.querySelector('[role="alert"]')),
        retry: box(strip.querySelector("button")),
        headers: document.querySelectorAll("header").length,
        viewport: { width: innerWidth, height: innerHeight },
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
      };
    },
    { banner: bannerSelector, region: regionSelector },
  );
}

/** How many of the strip's parts are cut: overflowing their box, or ending in an ellipsis. */
function cutParts(page: Page) {
  return page.locator(regionSelector).evaluate((strip) => {
    const parts = [...strip.querySelectorAll('p, [role="alert"], button')];
    const cut = (element: Element) =>
      element.scrollWidth > element.clientWidth ||
      element.scrollHeight > element.clientHeight ||
      getComputedStyle(element).textOverflow === "ellipsis";
    return parts.filter(cut).length;
  });
}

type StripBoxes = Awaited<ReturnType<typeof stripBoxes>>;
type Box = StripBoxes["region"];

const near = (actual: number, expected: number) => Math.abs(actual - expected) <= 1;
const encloses = (outer: Box, inner: Box) =>
  inner.left >= outer.left - 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.bottom <= outer.bottom + 0.5;

/** Whether every part of the strip in `parts` is whole inside the region and the viewport. */
function partsInView(boxes: StripBoxes, parts: readonly Box[]) {
  const viewport = { left: 0, top: 0, right: boxes.viewport.width, bottom: boxes.viewport.height };
  return parts.every((part) => encloses(boxes.region, part) && encloses(viewport, part));
}

/** The strip's gaps: to the banner above, to the sidebar on its left, to the window's right edge. */
const stripGaps = (boxes: StripBoxes) => ({
  top: boxes.region.top - boxes.banner.bottom,
  left: boxes.region.left - boxes.sidebar.right,
  right: boxes.viewport.width - boxes.region.right,
});

/** Where the strip sits and whether it fits, for every SH-B9 case. */
function stripFit(boxes: StripBoxes, withAlert: boolean) {
  const parts = [boxes.word, boxes.detail, boxes.retry, ...(withAlert ? [boxes.alert] : [])];
  const gaps = stripGaps(boxes);
  return {
    // Beside the sidebar and under the banner, at the strip's gap (SH-B23's).
    besideSidebar: near(gaps.left, gaps.right),
    underBanner: near(gaps.top, gaps.right),
    partsWhole: partsInView(boxes, parts),
    workInView: boxes.viewport.height - boxes.region.bottom >= 40,
    documentFits:
      boxes.document.width <= boxes.viewport.width &&
      boxes.document.height <= boxes.viewport.height,
    onlyTheBanner: boxes.headers === 1,
  };
}

const fits = {
  besideSidebar: true,
  underBanner: true,
  partsWhole: true,
  workInView: true,
  documentFits: true,
  onlyTheBanner: true,
};

/** Sets the whole window to its minimum, 640 by 480. */
async function setMinimumWindow(application: ElectronApplication, page: Page) {
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(640, 480);
  });
  await expect.poll(() => page.evaluate(() => innerWidth)).toBeLessThanOrEqual(640);
}

const fitRows = [
  { name: "minimum window with the retry alert", minimum: true, zoom: 1, alert: true, under: true },
  { name: "1280 by 800", minimum: false, zoom: 1, alert: false, under: false },
  { name: "minimum window", minimum: true, zoom: 1, alert: false, under: true },
  { name: "1280 by 800 at zoom 200%", minimum: false, zoom: 2, alert: false, under: true },
] as const;

for (const row of fitRows) {
  test(`SH-B9: fits the strip above the work: ${row.name}`, async () => {
    test.setTimeout(240_000);
    await withUnavailableHarness(async (application, page) => {
      if (row.minimum) await setMinimumWindow(application, page);
      else await sizeContent(application, page, 1280, 800);
      if (row.zoom !== 1)
        await setZoom(application, page, { factor: row.zoom, width: 1280, height: 800 });
      if (row.alert) await refuseRetry(application, page);
      const boxes = await stripBoxes(page);
      expect(stripFit(boxes, row.alert)).toEqual(fits);
      // Whole means uncut too: no part overflows or ends in an ellipsis.
      expect(await cutParts(page)).toBe(0);
      if (row.minimum) expect(near(boxes.place.right - boxes.place.left, 336)).toBe(true);
      // Narrow: the button under the text, level with it. Wide: beside the text, at the right.
      const layout = row.under
        ? {
            under: boxes.retry.top >= boxes.text.bottom,
            level: near(boxes.retry.left, boxes.word.left),
          }
        : {
            beside: boxes.retry.left >= boxes.text.right,
            atRight: boxes.region.right - boxes.retry.right <= 24,
          };
      expect(Object.values(layout)).toEqual([true, true]);
    });
  });
}

test("SH-B10: paints the unavailable strip, rings Retry and passes the accessibility checks", async () => {
  test.setTimeout(240_000);
  await withUnavailableHarness(async (application, page) => {
    await sizeContent(application, page, 1280, 800);
    const region = page.locator(regionSelector);
    const look = () =>
      region.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          radius: style.borderTopLeftRadius,
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          borderColor: style.borderTopColor,
        };
      });
    const painted = await look();
    expect([painted.background, painted.radius]).toEqual([
      await computedValue(page, "backgroundColor", "var(--blood-tint)"),
      "12px",
    ]);
    const retry = region.getByRole("button", { name: "Retry harness" });
    for (let press = 0; press < 60; press += 1) {
      if (await retry.evaluate((button) => button === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(retry).toBeFocused();
    expect(await retry.evaluate((button) => getComputedStyle(button).boxShadow)).toBe(
      await computedValue(page, "boxShadow", "var(--focus-ring)"),
    );
    expect(await axeViolations(page, { selector: regionSelector })).toEqual([]);
    await page.emulateMedia({ forcedColors: "active" });
    const forced = await look();
    expect([forced.borderWidth, forced.borderStyle, forced.borderColor]).toEqual([
      "1px",
      "solid",
      await computedValue(page, "borderTopColor", "CanvasText"),
    ]);
    const forcedText = await forcedTextColours(page, regionSelector);
    expect(forcedText.checked).toBeGreaterThan(0);
    expect(forcedText.failures).toEqual([]);
    expect(await axeViolations(page, { selector: regionSelector, forcedColors: true })).toEqual([]);
  });
});

/** The strip's gaps and corner radius, and whether it lies inside the window. */
async function stripFrame(page: Page) {
  const boxes = await stripBoxes(page);
  const gaps = stripGaps(boxes);
  const radius = await page
    .locator(regionSelector)
    .evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
  const window = { left: 0, top: 0, right: boxes.viewport.width, bottom: boxes.viewport.height };
  return {
    sameGap: near(gaps.top, gaps.right) && near(gaps.left, gaps.right),
    gapAboveZero: gaps.right > 0,
    radius,
    inWindow: encloses(window, boxes.region),
  };
}

const framed = { sameGap: true, gapAboveZero: true, radius: "12px", inWindow: true };

/** The strip's place above the centre: its height, while no strip is shown. */
const placeHeight = (page: Page) =>
  page.evaluate(() => document.querySelector("main > div")?.getBoundingClientRect().height);

test("SH-B23: keeps the rounded corners of the strip off the edges of the work area and the sidebar", async () => {
  test.setTimeout(240_000);
  let emptyPlace: number | undefined;
  await withUnavailableHarness(
    async (application, page) => {
      await sizeContent(application, page, 1280, 800);
      expect(await stripFrame(page)).toEqual(framed);
      await setMinimumWindow(application, page);
      expect(await stripFrame(page)).toEqual(framed);
    },
    async (page) => {
      emptyPlace = await placeHeight(page);
    },
  );
  // No strip shown: its place takes no room.
  expect(emptyPlace).toBe(0);
});

/** The strip's own margins and how far its bottom sits above the window's. */
async function stackedStrip(page: Page) {
  const margins = await page.locator(regionSelector).evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.marginTop, style.marginRight, style.marginLeft];
  });
  const boxes = await stripBoxes(page);
  return { margins, aboveFold: boxes.viewport.height - boxes.region.bottom };
}

test("SH-B23: drops the gap when the frame stacks: 640 by 480 at zoom 200% with the long alert", async () => {
  test.setTimeout(240_000);
  await withUnavailableHarness(async (application, page) => {
    await setMinimumWindow(application, page);
    await setZoom(application, page, { factor: 2, width: 640, height: 480 });
    await refuseRetry(application, page);
    const strip = await stackedStrip(page);
    expect({
      margins: strip.margins,
      // Pedro's accepted exception: the strip ends 6px above the fold.
      aboveFold: Math.abs(strip.aboveFold - 6) <= 1,
    }).toEqual({ margins: ["0px", "0px", "0px"], aboveFold: true });
  });
});
