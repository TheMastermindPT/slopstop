import AxeBuilder from "@axe-core/playwright";
import { type ElectronApplication, expect, type Page } from "@playwright/test";

/** The WCAG rule tags every S4 accessibility scan uses. */
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** The selector of the workspace section that S4 scans. */
export const workspaceSelector = 'section[aria-label="Project workspace"]';

type CspViolation = { effectiveDirective: string; blockedURI: string };

declare global {
  interface Window {
    slopstopCspViolations?: CspViolation[];
  }
}

/**
 * Records every `securitypolicyviolation` from the first script on, then reloads the window so
 * the listener is in place before the renderer runs, and checks that it is present.
 */
export async function recordCspViolations(page: Page): Promise<void> {
  // A reload while the main process still awaits its first `loadFile` aborts that load and the
  // desktop exits ("SlopStop failed to start"), so wait until the first page has rendered.
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.context().addInitScript(() => {
    const violations: CspViolation[] = [];
    window.slopstopCspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push({
        effectiveDirective: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
  await page.reload();
  expect(await page.evaluate(() => Array.isArray(window.slopstopCspViolations))).toBe(true);
}

/** The violations recorded since {@link recordCspViolations}. */
export function cspViolations(page: Page): Promise<CspViolation[]> {
  return page.evaluate(() => window.slopstopCspViolations ?? []);
}

/** Sets the window's content size and checks the page sees exactly that viewport. */
export async function sizeContent(
  application: ElectronApplication,
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  await application.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height);
    },
    { width, height },
  );
  await expect
    .poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
    .toEqual({ width, height });
}

/**
 * Sets the zoom factor of the window's `webContents` and waits until the page's viewport shows it:
 * the content size divided by the factor, in CSS pixels.
 */
export async function setZoom(
  application: ElectronApplication,
  page: Page,
  zoom: Readonly<{ factor: number; width: number; height: number }>,
): Promise<void> {
  await application.evaluate(({ BrowserWindow }, factor) => {
    BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(factor);
  }, zoom.factor);
  await expect
    .poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
    .toEqual({
      width: Math.round(zoom.width / zoom.factor),
      height: Math.round(zoom.height / zoom.factor),
    });
}

/**
 * Runs axe with the S4 WCAG tags, limited to one selector, and returns the violations. Legacy mode
 * runs axe inside the page itself: the default mode opens a second page, which Electron refuses
 * (`Target.createTarget: Not supported`). `bypassCSP` is never used.
 *
 * Under emulated forced colours, Chromium forces `color` and backgrounds but keeps the unforced
 * `-webkit-text-fill-color`, which axe reads, so its contrast rule measures colours that are not
 * painted. That run disables `color-contrast` and {@link forcedTextColours} checks the text instead
 * (Pedro, decisions log §48).
 */
export async function axeViolations(
  page: Page,
  options: Readonly<{ selector?: string; forcedColors?: boolean }> = {},
) {
  const builder = new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags(wcagTags)
    .include(options.selector ?? workspaceSelector);
  const result = await (options.forcedColors
    ? builder.disableRules(["color-contrast"])
    : builder
  ).analyze();
  return result.violations.map((violation) => ({
    id: violation.id,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

/**
 * Under forced colours, how many text elements a selector holds, and those whose computed colour is
 * not the forced text colour (the body's) or that opt out of forced colours. The pass is a
 * non-empty set with no failures.
 */
export function forcedTextColours(page: Page, selector: string) {
  return page.evaluate((scope) => {
    const forcedText = getComputedStyle(document.body).color;
    const root = document.querySelector(scope);
    const texts = (root === null ? [] : [root, ...root.querySelectorAll("*")])
      .filter((element) =>
        [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        ),
      )
      .map((element) => ({ element, style: getComputedStyle(element) }));
    return {
      checked: texts.length,
      failures: texts
        .filter(({ style }) => style.color !== forcedText || style.forcedColorAdjust !== "auto")
        .map(
          ({ element, style }) => `${element.tagName} ${style.color} ${style.forcedColorAdjust}`,
        ),
    };
  }, selector);
}

/** Whether an element overflows horizontally, and whether it lies wholly inside the viewport. */
export function layoutFacts(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      overflows: element.scrollWidth > element.clientWidth,
      inViewport:
        box.left >= 0 &&
        box.top >= 0 &&
        box.right <= window.innerWidth &&
        box.bottom <= window.innerHeight,
    };
  });
}
