import { readFile } from "node:fs/promises";
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

/** The static drag strip and the banners, measured in the page. */
function dragStrip(page: Page) {
  return page.evaluate((selector) => {
    const strip = document.getElementById("drag-strip");
    const box = strip?.getBoundingClientRect();
    return {
      banners: document.querySelectorAll(selector).length,
      strip:
        strip && box
          ? {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              appRegion: getComputedStyle(strip).getPropertyValue("app-region"),
              ariaHidden: strip.getAttribute("aria-hidden"),
              text: strip.textContent,
            }
          : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentSize: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
    };
  }, bannerSelector);
}

/** The strip against the viewport; `height` is the title-bar area's height in CSS px. */
async function stripAgainstViewport(page: Page, height: number) {
  const measured = await dragStrip(page);
  const { strip } = measured;
  return {
    banners: measured.banners,
    strip: strip && {
      atOrigin: strip.x === 0 && strip.y === 0,
      asWideAsWindow: within(strip.width, measured.viewport.width, 0.5),
      asHighAsArea: within(strip.height, height, 1),
      appRegion: strip.appRegion,
      ariaHidden: strip.ariaHidden,
      text: strip.text,
    },
    documentFits:
      measured.documentSize.width <= measured.viewport.width &&
      measured.documentSize.height <= measured.viewport.height,
  };
}

const strippedPage = {
  banners: 0,
  strip: {
    atOrigin: true,
    asWideAsWindow: true,
    asHighAsArea: true,
    appRegion: "drag",
    ariaHidden: "true",
    text: "",
  },
  documentFits: true,
};

test("keeps a drag strip when the React root is empty", async () => {
  test.setTimeout(150_000);
  const builtPage = await readFile(path.resolve(".vite/renderer/main_window/index.html"), "utf8");
  const body = builtPage.slice(builtPage.indexOf("<body"));
  const stripAt = body.indexOf('<div id="drag-strip"');
  const rootAt = body.indexOf('<div id="root"');
  expect({
    stripBeforeRoot: stripAt !== -1 && rootAt !== -1 && stripAt < rootAt,
    stripClosedBeforeRoot: stripAt !== -1 && body.slice(stripAt, rootAt).includes("</div>"),
  }).toEqual({ stripBeforeRoot: true, stripClosedBeforeRoot: true });
  await withTitleBarWindow(async (application, page) => {
    await sizeContent(application, page, 1280, 800);
    await page.evaluate(() => document.getElementById("root")?.replaceChildren());
    expect(await stripAgainstViewport(page, 44)).toEqual(strippedPage);
    await setZoom(application, page, { factor: 2, width: 1280, height: 800 });
    expect(await stripAgainstViewport(page, 22)).toEqual(strippedPage);
  });
});

/**
 * The ids of the harness processes, read from the main process: the utility processes whose
 * name is the `serviceName` the supervisor forks the harness with ("SlopStop Harness").
 */
const harnessPids = (application: ElectronApplication) =>
  application.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .filter((metric) => metric.type === "Utility" && metric.name === "SlopStop Harness")
      .map((metric) => metric.pid),
  );

/**
 * Ends the harness process from the main process, each time a new one runs, until the
 * supervisor gives up its automatic recovery and the old header offers "Retry harness".
 */
async function crashHarness(application: ElectronApplication, page: Page) {
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

/** The old header with Retry in it, measured in the page. */
function crashedHeader(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('[role="status"]')?.closest("header");
    if (header == null) return null;
    const sides = (element: Element | null) => {
      if (element === null) return null;
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    return {
      header: sides(header),
      status: sides(header.querySelector('[role="status"]')),
      retry: sides(header.querySelector("button")),
      contentFits: header.scrollHeight <= header.clientHeight,
      documentFits: document.documentElement.scrollHeight <= window.innerHeight,
    };
  });
}

/** The alert in the old header, its box and the styles that could clip or hide it. */
function headerAlert(page: Page) {
  return page.evaluate(() => {
    const alert = document
      .querySelector('[role="status"]')
      ?.closest("header")
      ?.querySelector('[role="alert"]');
    if (alert == null) return null;
    const { left, top, right, bottom } = alert.getBoundingClientRect();
    const style = getComputedStyle(alert);
    return {
      box: { left, top, right, bottom },
      text: alert.textContent,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      display: style.display,
    };
  });
}

type CrashedHeader = NonNullable<Awaited<ReturnType<typeof crashedHeader>>>;

/** The state of PF-B38: a crashed harness, at zoom 200% of 1280 by 800. */
async function arrangeCrashedShortHeader(application: ElectronApplication, page: Page) {
  await crashHarness(application, page);
  await sizeContent(application, page, 1280, 800);
  await setZoom(application, page, { factor: 2, width: 1280, height: 800 });
}

/** Whether `inner` lies wholly inside the old header's box. */
const insideHeader = (header: CrashedHeader, inner: Sides | null) =>
  header.header !== null && inner !== null && encloses(header.header, inner);

test("keeps Retry inside the short header", async () => {
  test.setTimeout(150_000);
  await withTitleBarWindow(async (application, page) => {
    await arrangeCrashedShortHeader(application, page);
    const header = await crashedHeader(page);
    expect(header).not.toBeNull();
    expect(
      header && {
        height: header.header !== null && within(header.header.bottom - header.header.top, 28, 1),
        retryInside: insideHeader(header, header.retry),
        statusInside: insideHeader(header, header.status),
        contentFits: header.contentFits,
      },
    ).toEqual({ height: true, retryInside: true, statusInside: true, contentFits: true });
  });
});

/** A failed retry's message, 160 characters long. */
const retryFailure =
  "The harness could not be started again: the process ended before it answered the first request, so Ragnarok stopped trying. Check the local log, then try later.";

test("keeps a wrapped retry alert inside the short header", async () => {
  test.setTimeout(150_000);
  expect(retryFailure).toHaveLength(160);
  await withTitleBarWindow(async (application, page) => {
    await arrangeCrashedShortHeader(application, page);
    // The markup `app.tsx` renders for a failed retry (PF-B40), placed by the test.
    await page.evaluate((message) => {
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.textContent = message;
      document.querySelector('[role="status"]')?.closest("header")?.append(alert);
    }, retryFailure);
    const header = await crashedHeader(page);
    const alert = await headerAlert(page);
    expect(alert).not.toBeNull();
    expect(
      header &&
        alert && {
          alertInside: insideHeader(header, alert.box),
          contentFits: header.contentFits,
          text: alert.text,
          overflow: alert.overflow,
          ellipsis: alert.textOverflow === "ellipsis",
          shown: alert.display !== "none",
          documentFits: header.documentFits,
        },
    ).toEqual({
      alertInside: true,
      contentFits: true,
      text: retryFailure,
      overflow: "visible",
      ellipsis: false,
      shown: true,
      documentFits: true,
    });
  });
});

/** The banner, the mark and the heading, measured in the page in CSS px. */
function brandSizes(page: Page) {
  return page.evaluate((selector) => {
    const banner = document.querySelector(selector);
    if (banner === null) return null;
    const mark = banner.querySelector("svg");
    if (mark === null) return null;
    const heading = banner.querySelector("h1");
    if (heading === null) return null;
    const sides = (element: Element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    return {
      banner: sides(banner),
      mark: sides(mark),
      heading: sides(heading),
      fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
    };
  }, bannerSelector);
}

type BrandSizes = NonNullable<Awaited<ReturnType<typeof brandSizes>>>;

/** Whether `inner` clears the banner's top and bottom by 18% of its height, and by 3.9px. */
const clearsBanner = (sizes: BrandSizes, inner: Sides) => {
  const height = sizes.banner.bottom - sizes.banner.top;
  const clearance = Math.max(0.18 * height, 3.9);
  return (
    inner.top - sizes.banner.top >= clearance && sizes.banner.bottom - inner.bottom >= clearance
  );
};

/** The mark and the heading against the banner and the title-bar area, at zoom `factor`. */
function brandProportion(sizes: BrandSizes, area: Area, factor: number) {
  const height = sizes.banner.bottom - sizes.banner.top;
  const ratio = (value: number, expected: number) => within(value / height, expected, 0.02);
  return {
    barOnScreen: within(height * factor, 44, 1),
    markHeight: ratio(sizes.mark.bottom - sizes.mark.top, 21 / 44),
    markWidth: ratio(sizes.mark.right - sizes.mark.left, 11 / 44),
    fontSize: ratio(sizes.fontSize, 16 / 44),
    markClear: clearsBanner(sizes, sizes.mark),
    headingClear: clearsBanner(sizes, sizes.heading),
    insideArea: liesInside(sizes.mark, area) && liesInside(sizes.heading, area),
  };
}

const inProportion = {
  barOnScreen: true,
  markHeight: true,
  markWidth: true,
  fontSize: true,
  markClear: true,
  headingClear: true,
  insideArea: true,
};

const proportionRows = [
  { name: "zoom 50%", factor: 0.5 },
  { name: "zoom 67%", factor: 0.67 },
  { name: "100%", factor: 1 },
  { name: "zoom 150%", factor: 1.5 },
  { name: "zoom 200%", factor: 2 },
] as const;

for (const row of proportionRows) {
  test(`keeps the mark and the wordmark in proportion to the bar: ${row.name}`, async () => {
    test.setTimeout(150_000);
    await withTitleBarWindow(async (application, page) => {
      await sizeContent(application, page, 1280, 800);
      if (row.factor !== 1) await setZoom(application, page, { ...row, width: 1280, height: 800 });
      const sizes = await brandSizes(page);
      expect(sizes).not.toBeNull();
      const area = await overlayArea(page);
      expect(sizes && brandProportion(sizes, area, row.factor)).toEqual(inProportion);
      // The reference: at 100% the mark is 11 by 21 and the wordmark 16px, as approved.
      if (row.factor === 1)
        expect(
          sizes && {
            markWidth: within(sizes.mark.right - sizes.mark.left, 11, 0.5),
            markHeight: within(sizes.mark.bottom - sizes.mark.top, 21, 0.5),
            fontSize: within(sizes.fontSize, 16, 0.5),
          },
        ).toEqual({ markWidth: true, markHeight: true, fontSize: true });
    });
  });
}

/** The banner, the brand's mark and heading, and the rune's computed stroke, in CSS px. */
function brandSpacing(page: Page) {
  return page.evaluate((selector) => {
    const banner = document.querySelector(selector);
    if (banner === null) return null;
    const mark = banner.querySelector("svg");
    if (mark === null) return null;
    const stroke = mark.querySelector("path");
    if (stroke === null) return null;
    const heading = banner.querySelector("h1");
    if (heading === null) return null;
    const strokeStyle = getComputedStyle(stroke);
    return {
      bannerHeight: banner.getBoundingClientRect().height,
      markLeft: mark.getBoundingClientRect().left,
      markRight: mark.getBoundingClientRect().right,
      headingLeft: heading.getBoundingClientRect().left,
      strokeWidth: Number.parseFloat(strokeStyle.strokeWidth),
      vectorEffect: strokeStyle.vectorEffect,
    };
  }, bannerSelector);
}

type BrandSpacing = NonNullable<Awaited<ReturnType<typeof brandSpacing>>>;

/** The brand's inset, gap and stroke against the banner's height `B`, as 16/44, 8/44 and 1.25/44. */
function spacingProportion(spacing: BrandSpacing, area: Area) {
  const height = spacing.bannerHeight;
  return {
    inset: within((spacing.markLeft - area.x) / height, 16 / 44, 0.02),
    gap: within((spacing.headingLeft - spacing.markRight) / height, 8 / 44, 0.02),
    stroke: within(spacing.strokeWidth / height, 1.25 / 44, 0.003),
    nonScalingStroke: spacing.vectorEffect === "non-scaling-stroke",
  };
}

for (const row of proportionRows) {
  test(`keeps the brand's spacing and stroke in proportion to the bar: ${row.name}`, async () => {
    test.setTimeout(150_000);
    await withTitleBarWindow(async (application, page) => {
      await sizeContent(application, page, 1280, 800);
      if (row.factor !== 1) await setZoom(application, page, { ...row, width: 1280, height: 800 });
      const spacing = await brandSpacing(page);
      expect(spacing).not.toBeNull();
      const area = await overlayArea(page);
      expect(spacing && spacingProportion(spacing, area)).toEqual({
        inset: true,
        gap: true,
        stroke: true,
        nonScalingStroke: true,
      });
      // The reference: at 100% the inset is 16px, the gap 8px and the stroke 1.25px, as approved.
      if (row.factor === 1)
        expect(
          spacing && {
            inset: within(spacing.markLeft - area.x, 16, 0.5),
            gap: within(spacing.headingLeft - spacing.markRight, 8, 0.5),
            stroke: within(spacing.strokeWidth, 1.25, 0.05),
          },
        ).toEqual({ inset: true, gap: true, stroke: true });
    });
  });
}
