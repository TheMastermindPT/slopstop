import path from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { axeViolations, forcedTextColours, setZoom, sizeContent } from "./accessibility.js";
import { computedValue } from "./computed-style.js";
import { expectNoHarnessRequestFailure, launchBuiltDesktop } from "./electron-launch.js";
import { seedTwoProjects } from "./harness-seed.js";
import { temporaryRoot } from "./temporary-root.js";

/** The banner landmark: a `header` outside every sectioning element and `main`. */
const bannerSelector = "header:not(:is(article, aside, main, nav, section) header)";
const railSelector = 'nav[aria-label="Activity"]';

/** Runs `journey` on the built desktop at display scale 1, then checks the desktop log. */
async function inShellWindow(
  journey: (application: ElectronApplication, page: Page) => Promise<void>,
  seed?: (userData: string) => Promise<unknown>,
) {
  const proof = await temporaryRoot("sh-frame-");
  const userData = path.join(proof, "user-data");
  await seed?.(userData);
  const application = await launchBuiltDesktop(proof, userData, ["--force-device-scale-factor=1"]);
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await journey(application, page);
  } finally {
    await application.close();
  }
  await expectNoHarnessRequestFailure(userData);
}

/** The banner, the rail, `<main>`, the Projects sidebar and the centre, as boxes in CSS px. */
function frameBoxes(page: Page) {
  return page.evaluate(
    ({ banner, rail }) => {
      // A missing element reads as NaN, which no comparison below accepts.
      const box = (element: Element | null) => {
        if (element === null)
          return { left: Number.NaN, top: Number.NaN, right: Number.NaN, bottom: Number.NaN };
        const { left, top, right, bottom } = element.getBoundingClientRect();
        return { left, top, right, bottom };
      };
      const main = document.querySelector("main");
      const railElement = document.querySelector(rail);
      return {
        banner: box(document.querySelector(banner)),
        rail: box(document.querySelector(rail)),
        main: box(main),
        railOutsideMain: railElement !== null && main !== null && !main.contains(railElement),
        sidebar: box(document.querySelector('aside[aria-label="Projects"]')),
        centre: box(document.querySelector('[aria-label="Project workspace"]')),
        viewport: { width: innerWidth, height: innerHeight },
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
      };
    },
    { banner: bannerSelector, rail: railSelector },
  );
}

type Boxes = Awaited<ReturnType<typeof frameBoxes>>;
type Box = Boxes["rail"];

const near = (actual: number, expected: number) => Math.abs(actual - expected) <= 1;
const width = (box: Box) => box.right - box.left;

/** Where the rail, `<main>`, the sidebar and the centre sit against the banner and the viewport. */
function frameLayout(boxes: Boxes) {
  const { banner, rail, main, sidebar, centre, viewport } = boxes;
  return {
    railAtLeftEdge: near(rail.left, 0),
    railUnderBanner: near(rail.top, banner.bottom),
    railToBottom: near(rail.bottom, viewport.height),
    mainUnderBanner: near(main.top, banner.bottom),
    railOutsideMain: boxes.railOutsideMain,
    sidebarAfterRail: near(sidebar.left, rail.right),
    centreAfterSidebar: near(centre.left, sidebar.right),
    centreToRightEdge: near(centre.right, viewport.width),
    documentFits:
      boxes.document.width <= viewport.width && boxes.document.height <= viewport.height,
  };
}

const placed = {
  railAtLeftEdge: true,
  railUnderBanner: true,
  railToBottom: true,
  mainUnderBanner: true,
  railOutsideMain: true,
  sidebarAfterRail: true,
  centreAfterSidebar: true,
  centreToRightEdge: true,
  documentFits: true,
};

const frameRows = [
  { name: "1280 by 800", size: { width: 1280, height: 800 }, rail: 72, sidebar: 272, labels: true },
  {
    name: "1279 by 800",
    size: { width: 1279, height: 800 },
    rail: 56,
    sidebar: 248,
    labels: false,
  },
  { name: "minimum window", size: undefined, rail: 56, sidebar: 248, labels: false },
] as const;

/** Sizes the window for `row`: its content size, or the whole window at the minimum 640 by 480. */
async function sizeFor(
  application: ElectronApplication,
  page: Page,
  row: (typeof frameRows)[number],
) {
  if (row.size !== undefined)
    return sizeContent(application, page, row.size.width, row.size.height);
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(640, 480);
  });
  await expect.poll(() => page.evaluate(() => innerWidth)).toBeLessThanOrEqual(640);
}

for (const row of frameRows) {
  test(`SH-B4: lays out the rail, the sidebar and the centre: ${row.name}`, async () => {
    test.setTimeout(150_000);
    await inShellWindow(async (application, page) => {
      const rail = page.getByRole("navigation", { name: "Activity" });
      await expect(rail).toBeVisible();
      await sizeFor(application, page, row);
      const boxes = await frameBoxes(page);
      expect(frameLayout(boxes)).toEqual(placed);
      expect({ rail: width(boxes.rail), sidebar: width(boxes.sidebar) }).toEqual({
        rail: row.rail,
        sidebar: row.sidebar,
      });
      for (const name of ["Projects", "Attention"]) {
        await expect(rail.getByRole("button", { name, exact: true })).toBeVisible();
        const label = rail.getByText(name, { exact: true });
        await (row.labels ? expect(label).toBeVisible() : expect(label).toBeHidden());
      }
    });
  });
}

/** The rail's two buttons, top to bottom, as boxes in CSS px. */
function railButtonBoxes(page: Page) {
  return page
    .getByRole("navigation", { name: "Activity" })
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const { top, bottom } = button.getBoundingClientRect();
        return { top, bottom };
      }),
    );
}

test("SH-B4: lays out the rail, the sidebar and the centre: 640 by 480 at zoom 200%", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (application, page) => {
    await expect(page.getByRole("navigation", { name: "Activity" })).toBeVisible();
    await sizeContent(application, page, 640, 480);
    await setZoom(application, page, { factor: 2, width: 640, height: 480 });
    const boxes = await frameBoxes(page);
    const [projects, attention] = await railButtonBoxes(page);
    expect({
      railOutsideMain: boxes.railOutsideMain,
      mainUnderBanner: near(boxes.main.top, boxes.banner.bottom),
      sidebarBesideRail: near(boxes.sidebar.left, boxes.rail.right),
      sidebarToRightEdge: near(boxes.sidebar.right, boxes.viewport.width),
      noSidewaysScroll: boxes.document.width <= boxes.viewport.width,
      sidebarAboveCentre: boxes.sidebar.bottom <= boxes.centre.top,
      railColumn:
        near(boxes.rail.left, 0) &&
        projects !== undefined &&
        attention !== undefined &&
        attention.top >= projects.bottom,
    }).toEqual({
      railOutsideMain: true,
      mainUnderBanner: true,
      sidebarBesideRail: true,
      sidebarToRightEdge: true,
      noSidewaysScroll: true,
      sidebarAboveCentre: true,
      railColumn: true,
    });
  });
});

/** The computed look of one rail button. */
function railButtonLook(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Activity" })
    .getByRole("button", { name, exact: true })
    .evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        background: style.backgroundColor,
        radius: style.borderTopLeftRadius,
        shadow: style.boxShadow,
        borderStyle: style.borderTopStyle,
        borderColor: style.borderTopColor,
      };
    });
}

/** The Projects rail button's computed transition duration. */
function railTransition(page: Page) {
  return page
    .getByRole("navigation", { name: "Activity" })
    .getByRole("button", { name: "Projects", exact: true })
    .evaluate((button) => getComputedStyle(button).transitionDuration);
}

/** Presses Tab until the rail button `name` has keyboard focus. */
async function tabTo(page: Page, name: string) {
  const button = page
    .getByRole("navigation", { name: "Activity" })
    .getByRole("button", { name, exact: true });
  for (let press = 0; press < 40; press += 1) {
    if (await button.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(button).toBeFocused();
}

test("SH-B5: gives the current rail item the forged look, the ring under focus and a forced-colour border", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (application, page) => {
    await expect(page.getByRole("navigation", { name: "Activity" })).toBeVisible();
    await sizeContent(application, page, 1280, 800);
    const forged = await computedValue(page, "backgroundColor", "var(--forged)");
    const rowLift = await computedValue(page, "boxShadow", "var(--shadow-row-lift)");
    const ring = await computedValue(page, "boxShadow", "var(--focus-ring)");
    const ringAndLift = await computedValue(
      page,
      "boxShadow",
      "var(--focus-ring), var(--shadow-row-lift)",
    );
    const projects = await railButtonLook(page, "Projects");
    expect([projects.background, projects.radius, projects.shadow]).toEqual([
      forged,
      "12px",
      rowLift,
    ]);
    expect((await railButtonLook(page, "Attention")).background).not.toBe(forged);
    await tabTo(page, "Attention");
    expect((await railButtonLook(page, "Attention")).shadow).toBe(ring);
    await tabTo(page, "Projects");
    expect((await railButtonLook(page, "Projects")).shadow).toBe(ringAndLift);
    expect(await axeViolations(page, { selector: railSelector })).toEqual([]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await railTransition(page)).toBe("0s");
    await page.emulateMedia({ reducedMotion: "no-preference", forcedColors: "active" });
    const highlight = await computedValue(page, "borderTopColor", "Highlight");
    const marked = await railButtonLook(page, "Projects");
    expect([marked.borderStyle, marked.borderColor]).toEqual(["solid", highlight]);
    expect((await railButtonLook(page, "Attention")).borderStyle).toBe("none");
    const forcedText = await forcedTextColours(page, railSelector);
    expect(forcedText.checked).toBeGreaterThan(0);
    expect(forcedText.failures).toEqual([]);
    expect(await axeViolations(page, { selector: railSelector, forcedColors: true })).toEqual([]);
  });
});

test("SH-B13: hands focus to the next Project after a removal confirmed from Attention", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (_application, page) => {
    const rail = page.getByRole("navigation", { name: "Activity" });
    await page.getByRole("button", { name: "Remove repository-a from list", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Remove repository-a from the list?" }),
    ).toBeVisible();
    await rail.getByRole("button", { name: "Attention", exact: true }).click();
    await page.getByRole("button", { name: "Remove from list", exact: true }).click();
    const next = page.getByRole("button", { name: "Open Project repository-b", exact: true });
    await expect(next).toBeFocused();
    await expect(rail.getByRole("button", { name: "Projects", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }, seedTwoProjects);
});

test("SH-B20: moves focus to the next zone with F6 in the real window", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (application, page) => {
    await sizeContent(application, page, 1280, 800);
    const projects = page
      .getByRole("navigation", { name: "Activity" })
      .getByRole("button", { name: "Projects", exact: true });
    await projects.focus();
    await page.keyboard.press("F6");
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeFocused();
  });
});

const skipSelector = "#skip-to-attention";

/**
 * The skip button's box, its look, the bar's box, where the native buttons begin (the bar's
 * content edge), the brand's inset, and the banner's `no-drag` elements.
 */
function skipLayout(page: Page) {
  return page.evaluate(
    ({ banner, skip }) => {
      const bar = document.querySelector(banner);
      if (bar === null) return null;
      const button = document.querySelector(skip);
      if (button === null) return null;
      const mark = bar.querySelector("svg");
      if (mark === null) return null;
      const rect = (element: Element) => {
        const { left, top, right, bottom } = element.getBoundingClientRect();
        return { left, top, right, bottom };
      };
      const style = getComputedStyle(button);
      const barBox = rect(bar);
      return {
        skip: rect(button),
        shadow: style.boxShadow,
        appRegion: style.getPropertyValue("app-region"),
        outline: [style.outlineStyle, style.outlineColor],
        bar: barBox,
        nativeStart: barBox.right - Number.parseFloat(getComputedStyle(bar).paddingRight),
        inset: mark.getBoundingClientRect().left - barBox.left,
        noDrag: [...bar.querySelectorAll("*")]
          .filter(
            (element) => getComputedStyle(element).getPropertyValue("app-region") === "no-drag",
          )
          .map((element) => element.tagName),
        viewport: { width: innerWidth, height: innerHeight },
      };
    },
    { banner: bannerSelector, skip: skipSelector },
  );
}

type SkipLayout = NonNullable<Awaited<ReturnType<typeof skipLayout>>>;

/** Whether the skip button is unseen: its box lies above the window or has no area. */
const unseen = (layout: SkipLayout) =>
  layout.skip.bottom <= 0 || layout.skip.right - layout.skip.left <= 0;

/** Opens `repository-a` from the seeded list and moves focus back to the page's start. */
async function openAndRestart(page: Page) {
  await page.getByRole("button", { name: "Open Project repository-a", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project repository-a", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/**
 * Reaches the skip button with Tab, then proves it is the page's first stop: Tab goes on to the
 * name button (repository-a is open); Shift+Tab from the skip button lands on the page's last
 * tabbable stop, and Tab from there returns to the skip button, which keeps keyboard focus.
 */
async function tabToSkipAsFirstStop(page: Page) {
  const skip = page.locator(skipSelector);
  for (let press = 0; press < 60; press += 1) {
    if (await skip.evaluate((button) => button === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(skip).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.locator(bannerSelector).getByRole("button", { name: "Project repository-a", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(skip).toBeFocused();
  // An Electron window has no browser UI around the page, so focus wraps inside it: from the
  // first stop, Shift+Tab goes to the page's last stop, found here on its own, in document order.
  const stops = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll<HTMLElement>(
        "a[href], button, input, select, textarea, [tabindex]",
      ),
    ];
    const tabbable = candidates.filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(":disabled") &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    );
    const last = tabbable.at(-1);
    if (last !== undefined) last.setAttribute("data-last-stop", "");
    return {
      positive: candidates.filter((element) => element.tabIndex > 0).length,
      found: last !== undefined,
    };
  });
  expect(stops).toEqual({ positive: 0, found: true });
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("[data-last-stop]")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await page.evaluate(() =>
    document.querySelector("[data-last-stop]")?.removeAttribute("data-last-stop"),
  );
}

test("SH-B22: shows the skip button over the bar only under focus, ringed: 1280 by 800", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (application, page) => {
    await sizeContent(application, page, 1280, 800);
    await openAndRestart(page);
    const before = await skipLayout(page);
    expect(before !== null && [unseen(before), before.noDrag]).toEqual([true, ["BUTTON"]]);
    await tabToSkipAsFirstStop(page);
    const focused = await skipLayout(page);
    expect(
      focused && {
        inBar: focused.skip.top >= 0 && focused.skip.bottom <= 44,
        leftOfNativeButtons: focused.skip.right <= focused.nativeStart,
        ring: focused.shadow === (await computedValue(page, "boxShadow", "var(--focus-ring)")),
        appRegion: focused.appRegion,
        barUnchanged: JSON.stringify(focused.bar) === JSON.stringify(before?.bar),
        insetUnchanged: focused.inset === before?.inset,
        noDrag: focused.noDrag,
      },
    ).toEqual({
      inBar: true,
      leftOfNativeButtons: true,
      ring: true,
      appRegion: "no-drag",
      barUnchanged: true,
      insetUnchanged: true,
      noDrag: ["BUTTON"],
    });
    expect(await axeViolations(page, { selector: skipSelector })).toEqual([]);
    await page.keyboard.press("Enter");
    await expect(
      page
        .getByRole("navigation", { name: "Activity" })
        .getByRole("button", { name: "Attention", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Attention", exact: true })).toBeFocused();
    const after = await skipLayout(page);
    expect(after !== null && unseen(after)).toBe(true);
  }, seedTwoProjects);
});

test("SH-B22: keeps the focused skip button in the window, clear of the native buttons: minimum window", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (application, page) => {
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(640, 480);
    });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBeLessThanOrEqual(640);
    await openAndRestart(page);
    await tabToSkipAsFirstStop(page);
    const focused = await skipLayout(page);
    expect(
      focused && {
        inWindow:
          focused.skip.left >= 0 &&
          focused.skip.top >= 0 &&
          focused.skip.right <= focused.viewport.width &&
          focused.skip.bottom <= focused.viewport.height,
        clearOfNativeButtons: focused.skip.right <= focused.nativeStart,
      },
    ).toEqual({ inWindow: true, clearOfNativeButtons: true });
  }, seedTwoProjects);
});

test("SH-B22: marks the focused skip button under forced colours", async () => {
  test.setTimeout(150_000);
  await inShellWindow(async (application, page) => {
    await sizeContent(application, page, 1280, 800);
    await openAndRestart(page);
    await page.emulateMedia({ forcedColors: "active" });
    await tabToSkipAsFirstStop(page);
    const focused = await skipLayout(page);
    expect(focused && [focused.outline[0], focused.outline[1] !== "rgba(0, 0, 0, 0)"]).toEqual([
      "solid",
      true,
    ]);
    const forcedText = await forcedTextColours(page, skipSelector);
    expect(forcedText.checked).toBeGreaterThan(0);
    expect(forcedText.failures).toEqual([]);
    expect(await axeViolations(page, { selector: skipSelector, forcedColors: true })).toEqual([]);
  }, seedTwoProjects);
});
