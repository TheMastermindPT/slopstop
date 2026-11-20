import path from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { axeViolations, forcedTextColours, setZoom, sizeContent } from "./accessibility.js";
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
        mainHoldsOldHeader: main?.querySelector("header") != null,
        railOutsideMain: railElement !== null && main !== null && !main.contains(railElement),
        oldHeader: box(main?.querySelector("header") ?? null),
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
    mainHoldsOldHeader: boxes.mainHoldsOldHeader,
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
  mainHoldsOldHeader: true,
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
      // Q13's short-window row: the old header stays 28px.
      oldHeader28: near(boxes.oldHeader.bottom - boxes.oldHeader.top, 28),
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
      oldHeader28: true,
      noSidewaysScroll: true,
      sidebarAboveCentre: true,
      railColumn: true,
    });
  });
});

type Look = "backgroundColor" | "boxShadow" | "borderTopColor";

/** `value` as the page computes it for `property`, read from a probe element. */
function computedValue(page: Page, property: Look, value: string) {
  return page.evaluate(
    ({ property, value }) => {
      const probe = document.createElement("div");
      probe.style[property] = value;
      document.body.append(probe);
      const computed = getComputedStyle(probe)[property];
      probe.remove();
      return computed;
    },
    { property, value },
  );
}

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
