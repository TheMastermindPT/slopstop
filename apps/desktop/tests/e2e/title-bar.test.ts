import path from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { axeViolations, forcedTextColours, setZoom, sizeContent } from "./accessibility.js";
import { expectNoHarnessRequestFailure, launchBuiltDesktop } from "./electron-launch.js";
import { temporaryRoot } from "./temporary-root.js";

/** The banner landmark: a `header` outside every sectioning element and `main`. */
const bannerSelector = "header:not(:is(article, aside, main, nav, section) header)";
/** The height of the native caption buttons, and their width, in screen pixels at scale 1. */
const nativeStrip = { height: 44, width: 137 };

/** Starts the built desktop at display scale 1 and waits until the first page has rendered. */
async function openTitleBarWindow() {
  const proof = await temporaryRoot("pf-title-bar-");
  const userData = path.join(proof, "user-data");
  const application = await launchBuiltDesktop(proof, userData, ["--force-device-scale-factor=1"]);
  const page = await application.firstWindow();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  return { application, page, userData };
}

/** Runs one journey on a fresh window and closes it, then checks the desktop log. */
async function withTitleBarWindow(
  journey: (application: ElectronApplication, page: Page) => Promise<void>,
) {
  const { application, page, userData } = await openTitleBarWindow();
  try {
    await journey(application, page);
  } finally {
    await application.close();
  }
  await expectNoHarnessRequestFailure(userData);
}

/** The title-bar area the page reads; all zero and not visible when there is no overlay. */
type Area = { visible: boolean; x: number; y: number; width: number; height: number };
const noArea: Area = { visible: false, x: 0, y: 0, width: 0, height: 0 };

/**
 * The Window Controls Overlay as the page reads it. TypeScript's DOM library has no
 * `windowControlsOverlay`, so it is read by name and its shape is checked before use.
 */
async function overlayArea(page: Page): Promise<Area> {
  const area = await page.evaluate(() => {
    const overlay: unknown = Reflect.get(navigator, "windowControlsOverlay");
    if (typeof overlay !== "object" || overlay === null) return null;
    const visible: unknown = Reflect.get(overlay, "visible");
    const areaOf: unknown = Reflect.get(overlay, "getTitlebarAreaRect");
    if (typeof visible !== "boolean" || typeof areaOf !== "function") return null;
    const rect: unknown = Reflect.apply(areaOf, overlay, []);
    if (!(rect instanceof DOMRect)) return null;
    return { visible, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  return area ?? noArea;
}

/** The banner, its heading, its mark and the old shell, measured in the page. */
function barLayout(page: Page) {
  return page.evaluate((selector) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const documentSize = {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    };
    const banner = document.querySelector(selector);
    if (banner === null)
      return { banner: null, heading: null, mark: null, shellTop: null, viewport, documentSize };
    const box = banner.getBoundingClientRect();
    const style = getComputedStyle(banner);
    const heading = banner.querySelector("h1");
    const mark = banner.querySelector("svg");
    const sides = (element: Element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    return {
      banner: {
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        contentRight:
          box.right -
          Number.parseFloat(style.paddingRight) -
          Number.parseFloat(style.borderRightWidth),
        background: style.backgroundColor,
        appRegion: style.getPropertyValue("app-region"),
      },
      heading: heading && {
        box: sides(heading),
        fontFamily: getComputedStyle(heading).fontFamily,
        color: getComputedStyle(heading).color,
      },
      mark: mark && {
        stroke: getComputedStyle(mark).stroke,
        width: mark.getBoundingClientRect().width,
        height: mark.getBoundingClientRect().height,
      },
      shellTop: document.querySelector("main")?.getBoundingClientRect().top ?? null,
      viewport,
      documentSize,
    };
  }, bannerSelector);
}

type Layout = Awaited<ReturnType<typeof barLayout>>;
type Sides = { left: number; top: number; right: number; bottom: number };

const within = (actual: number, expected: number, tolerance: number) =>
  Math.abs(actual - expected) <= tolerance;

const documentFits = (layout: Layout) =>
  layout.documentSize.width <= layout.viewport.width &&
  layout.documentSize.height <= layout.viewport.height;

const liesInside = (sides: Sides, area: Area) =>
  sides.left >= area.x &&
  sides.top >= area.y &&
  sides.right <= area.x + area.width &&
  sides.bottom <= area.y + area.height;

/** How the banner sits against the title-bar area; `null` when there is no banner. */
function barAgainstArea(layout: Layout, area: Area) {
  const { banner, heading } = layout;
  if (banner === null) return null;
  return {
    asHighAsArea: within(banner.box.height, area.height, 1),
    contentEndsAtArea: within(banner.contentRight, area.x + area.width, 1),
    headingInsideArea: heading !== null && liesInside(heading.box, area),
    shellStartsUnderBar: within(layout.shellTop ?? -1, banner.box.y + banner.box.height, 0.5),
  };
}

/** The first family of a computed `font-family`, unquoted. */
const firstFamily = (fontFamily: string) => fontFamily.split(",")[0]?.replaceAll('"', "").trim();

/** The banner's box and look; `null` when there is no banner. */
function barLook(layout: Layout) {
  const { banner, heading } = layout;
  if (banner === null) return null;
  return {
    box: banner.box,
    background: banner.background,
    appRegion: banner.appRegion,
    heading: heading && { firstFamily: firstFamily(heading.fontFamily), color: heading.color },
    mark: layout.mark,
  };
}

const placedBar = {
  asHighAsArea: true,
  contentEndsAtArea: true,
  headingInsideArea: true,
  shellStartsUnderBar: true,
};

test("puts the native buttons inside the rune title bar", async () => {
  test.setTimeout(150_000);
  await withTitleBarWindow(async (application, page) => {
    await sizeContent(application, page, 1280, 800);
    const area = await overlayArea(page);
    const layout = await barLayout(page);
    expect({
      overlay: { visible: area.visible, x: area.x, y: area.y, height: area.height },
      buttonsReserved: within(layout.viewport.width - area.width, nativeStrip.width, 1),
      placement: barAgainstArea(layout, area),
      look: barLook(layout),
      documentFits: documentFits(layout),
      title: await page.title(),
      windowTitle: await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.getTitle(),
      ),
    }).toEqual({
      overlay: { visible: true, x: 0, y: 0, height: nativeStrip.height },
      buttonsReserved: true,
      placement: placedBar,
      look: {
        box: { x: 0, y: 0, width: layout.viewport.width, height: nativeStrip.height },
        background: "rgb(5, 6, 6)",
        appRegion: "drag",
        heading: { firstFamily: "Cinzel", color: "rgb(236, 239, 241)" },
        mark: { stroke: "rgb(156, 201, 224)", width: 11, height: 21 },
      },
      documentFits: true,
      title: "Ragnarok",
      windowTitle: "Ragnarok",
    });
  });
});

const clearanceRows = [
  { name: "640 by 480", width: 640, height: 480, factor: 1 },
  { name: "zoom 50%", width: 1280, height: 800, factor: 0.5 },
  { name: "zoom 200%", width: 1280, height: 800, factor: 2 },
] as const;

for (const row of clearanceRows) {
  test(`keeps the bar clear of the native buttons: ${row.name}`, async () => {
    test.setTimeout(150_000);
    await withTitleBarWindow(async (application, page) => {
      await sizeContent(application, page, row.width, row.height);
      if (row.factor !== 1) await setZoom(application, page, row);
      const area = await overlayArea(page);
      const layout = await barLayout(page);
      const stripWidth = layout.viewport.width - area.x - area.width;
      expect({
        stripHeightOnScreen: within(area.height * row.factor, nativeStrip.height, 1),
        stripWidthOnScreen: within(stripWidth * row.factor, nativeStrip.width, 1),
        placement: barAgainstArea(layout, area),
        documentFits: documentFits(layout),
      }).toEqual({
        stripHeightOnScreen: true,
        stripWidthOnScreen: true,
        placement: placedBar,
        documentFits: true,
      });
    });
  });
}

/** Whether the focused element is inside the banner. */
const focusInBanner = (page: Page) =>
  page.evaluate((selector) => document.activeElement?.closest(selector) != null, bannerSelector);

test("passes the accessibility harness on the title bar", async () => {
  test.setTimeout(150_000);
  await withTitleBarWindow(async (_application, page) => {
    const tabStops: boolean[] = [];
    for (let press = 0; press < 20; press += 1) {
      await page.keyboard.press("Tab");
      tabStops.push(await focusInBanner(page));
    }
    await page.emulateMedia({ forcedColors: "active" });
    const forcedText = await forcedTextColours(page, bannerSelector);
    expect(forcedText.checked).toBeGreaterThan(0);
    expect(forcedText.failures).toEqual([]);
    expect(await axeViolations(page, { selector: bannerSelector, forcedColors: true })).toEqual([]);
    await page.emulateMedia({ forcedColors: "none" });
    expect(await axeViolations(page, { selector: bannerSelector })).toEqual([]);
    expect(tabStops.filter((inBanner) => inBanner)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  });
});

/** Waits in the main process for the window's next navigation attempt and answers its URL. */
async function nextNavigationAttempt(
  application: ElectronApplication,
  attempt: () => Promise<void>,
) {
  await application.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    Reflect.set(
      globalThis,
      "titleBarNavigation",
      new Promise<string>((resolve) =>
        contents?.once("will-navigate", (_event, url) => resolve(url)),
      ),
    );
  });
  await attempt();
  return application.evaluate(async () =>
    String(await Reflect.get(globalThis, "titleBarNavigation")),
  );
}

test("keeps the real window locked down", async () => {
  test.setTimeout(150_000);
  await withTitleBarWindow(async (application, page) => {
    const pageUrl = page.url();
    expect(
      await page.evaluate(() => ({ process: typeof process, require: typeof require })),
    ).toEqual({ process: "undefined", require: "undefined" });
    expect(await page.evaluate(() => window.open("https://example.invalid/"))).toBeNull();
    expect(
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
    ).toBe(1);
    const attempted = await nextNavigationAttempt(application, () =>
      page.evaluate(() => {
        window.location.href = "https://example.invalid/";
      }),
    );
    expect(attempted).toBe("https://example.invalid/");
    expect(page.url()).toBe(pageUrl);
    expect(pageUrl).toMatch(/\/index\.html$/);
    expect(
      await application.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return {
          minimumSize: window?.getMinimumSize(),
          backgroundColor: window?.getBackgroundColor().toLowerCase(),
        };
      }),
    ).toEqual({ minimumSize: [640, 480], backgroundColor: "#101411" });
    // Read through the main process: the page's own frame still waits for the refused navigation.
    const afterRefusal: unknown = await application.evaluate(
      ({ BrowserWindow }, selector) =>
        BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(`(() => {
          const banners = [...document.querySelectorAll(${JSON.stringify(selector)})];
          const box = banners[0]?.getBoundingClientRect();
          return {
            banners: banners.length,
            heading: banners[0]?.querySelector("h1")?.textContent ?? null,
            visible: banners[0]?.checkVisibility() ?? false,
            sized: box !== undefined && box.width > 0 && box.height > 0,
            href: location.href,
          };
        })()`),
      bannerSelector,
    );
    expect(afterRefusal).toEqual({
      banners: 1,
      heading: "Ragnarok",
      visible: true,
      sized: true,
      href: expect.stringMatching(/\/index\.html$/),
    });
  });
});

/** The old shell's header, the `header` that holds the harness status, measured in the page. */
function oldHeader(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('[role="status"]')?.closest("header");
    const status = header?.querySelector('[role="status"]');
    if (header == null || status == null) return null;
    const sides = (element: Element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    return { viewportHeight: window.innerHeight, header: sides(header), status: sides(status) };
  });
}

type OldHeader = NonNullable<Awaited<ReturnType<typeof oldHeader>>>;

const encloses = (outer: Sides, inner: Sides) =>
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  inner.right <= outer.right &&
  inner.bottom <= outer.bottom;

/** The header's height, snapped to `expected` when it lies within 1px of it. */
const headerHeight = (header: OldHeader, expected: number) => {
  const height = header.header.bottom - header.header.top;
  return within(height, expected, 1) ? expected : height;
};

/** Sets the whole window to the minimum size, as `shell.test.ts` does, and waits for the page. */
async function setMinimumWindow(application: ElectronApplication, page: Page) {
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(640, 480);
  });
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThanOrEqual(640);
}

/** The full-height rows: the header keeps its 56px, and the viewport stays above 420. */
const tallRow = (header: OldHeader) => ({
  tall: header.viewportHeight > 420,
  height: headerHeight(header, 56),
});

const shortWindowRows = [
  {
    name: "1280 by 800",
    arrange: (application: ElectronApplication, page: Page) =>
      sizeContent(application, page, 1280, 800),
    measure: (header: OldHeader) => ({ viewport: header.viewportHeight, ...tallRow(header) }),
    expected: { viewport: 800, tall: true, height: 56 },
  },
  {
    name: "minimum window",
    arrange: setMinimumWindow,
    measure: tallRow,
    expected: { tall: true, height: 56 },
  },
  {
    name: "zoom 200%",
    arrange: async (application: ElectronApplication, page: Page) => {
      await sizeContent(application, page, 1280, 800);
      await setZoom(application, page, { factor: 2, width: 1280, height: 800 });
    },
    measure: (header: OldHeader) => ({
      viewport: header.viewportHeight,
      height: headerHeight(header, 28),
      bottomAtMost51: header.header.bottom <= 51,
      statusInside: encloses(header.header, header.status),
    }),
    expected: { viewport: 400, height: 28, bottomAtMost51: true, statusInside: true },
  },
] as const;

for (const row of shortWindowRows) {
  test(`shrinks the old header only in a short window: ${row.name}`, async () => {
    test.setTimeout(150_000);
    await withTitleBarWindow(async (application, page) => {
      await row.arrange(application, page);
      const header = await oldHeader(page);
      expect(header).not.toBeNull();
      expect(header && row.measure(header)).toEqual(row.expected);
    });
  });
}
