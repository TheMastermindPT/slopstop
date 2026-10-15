import { mkdtemp, readdir, readFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import {
  axeViolations,
  cspViolations,
  forcedTextColours,
  layoutFacts,
  recordCspViolations,
  setZoom,
  sizeContent,
  workspaceSelector,
} from "./accessibility.js";
import { launchBuiltDesktop } from "./electron-launch.js";
import { seedTwoProjects } from "./harness-seed.js";

/** The packaged main-window policy without `frame-ancestors`, which a `<meta>` ignores. */
const metaPolicy =
  "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'";
const bundledFaces = [
  '400 14px "Red Hat Text"',
  '500 13px "Red Hat Text"',
  '600 16px "Red Hat Text"',
  "400 16px Cinzel",
  '400 12.5px "Cascadia Code"',
];
const note = "No model is connected yet. Messages are saved on this computer.";
const renderer = path.resolve(".vite/renderer/main_window");
const regionSelector = "[data-conversation-region]";

async function launch(userData?: string) {
  const proof = await mkdtemp(path.join(tmpdir(), "opencode/s4a-foundation-"));
  const data = userData ?? path.join(proof, "user-data");
  // Scale 1, so computed border widths and screenshots do not depend on the display's scale.
  const application = await launchBuiltDesktop(proof, data, ["--force-device-scale-factor=1"]);
  const page = await application.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { proof, application, page, errors };
}

async function seededLaunch() {
  const proof = await mkdtemp(path.join(tmpdir(), "opencode/s4a-seed-"));
  const userData = path.join(proof, "user-data");
  const projects = await seedTwoProjects(userData);
  return { ...(await launch(userData)), userData, projects };
}

/** Loads each bundled face and returns how many faces each load resolved. */
function loadBundledFaces(page: Page) {
  return page.evaluate(
    (specs) =>
      Promise.all(
        specs.map(async (spec) => ({
          spec,
          faces: (await document.fonts.load(spec, "Aé€çő")).length,
        })),
      ),
    bundledFaces,
  );
}

async function openReadWrite(application: ElectronApplication, page: Page) {
  await sizeContent(application, page, 1280, 800);
  await page.getByRole("button", { name: "Open Project repository-a", exact: true }).click();
  await expect(page.getByText("Read-write", { exact: true })).toBeVisible();
}

test("loads the bundled fonts under the unchanged CSP", async () => {
  test.setTimeout(150_000);
  const { application, page, errors } = await launch();
  try {
    await recordCspViolations(page);
    const loads = await loadBundledFaces(page);
    expect(loads.filter((load) => load.faces === 0)).toEqual([]);
    const latinExtended = await page.evaluate(() => {
      const covers = (range: string) =>
        range.split(",").some((part) => {
          const [low, high] = part.trim().replace("U+", "").split("-");
          const start = Number.parseInt(low ?? "", 16);
          const end = high === undefined ? start : Number.parseInt(high, 16);
          return start <= 0x151 && 0x151 <= end;
        });
      return [...document.fonts].some(
        (face) =>
          face.family.replaceAll('"', "").replaceAll("'", "") === "Red Hat Text" &&
          face.weight === "400" &&
          face.status === "loaded" &&
          covers(face.unicodeRange),
      );
    });
    expect(latinExtended).toBe(true);
    const fontRequests = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => /\.woff2?($|\?)/.test(name)),
    );
    expect(fontRequests.filter((name) => !name.startsWith("file:"))).toEqual([]);
    expect(await cspViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

test("enforces the main-window CSP on the file:// renderer", async () => {
  test.setTimeout(150_000);
  const { application, page, errors } = await launch();
  try {
    await recordCspViolations(page);
    await page.evaluate(async () => {
      const probe = new FontFace("csp-probe", "url(data:font/woff2;base64,d09GMgABAAAAAA)");
      await probe.load().catch(() => undefined);
    });
    // Each policy in force (the header and the page's meta) reports the blocked probe once.
    await expect.poll(async () => (await cspViolations(page)).length).toBe(2);
    const loads = await loadBundledFaces(page);
    expect(loads.filter((load) => load.faces === 0)).toEqual([]);
    // Every violation is the data: probe's font-src report; the bundled faces add none.
    expect(
      (await cspViolations(page)).filter(
        (violation) =>
          violation.effectiveDirective !== "font-src" || violation.blockedURI !== "data",
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

test("writes the CSP meta into the built page", async () => {
  const html = await readFile(path.join(renderer, "index.html"), "utf8");
  const tags = [...html.matchAll(/<(meta|script|link)\b[^>]*>/g)].map((match) => match[0]);
  const charset = tags.findIndex((tag) => /charset=/i.test(tag));
  expect(charset).toBeGreaterThanOrEqual(0);
  expect(tags[charset + 1]).toBe(
    `<meta http-equiv="Content-Security-Policy" content="${metaPolicy}">`,
  );
  expect(tags.slice(0, charset + 1).filter((tag) => !tag.startsWith("<meta"))).toEqual([]);
  expect(html).not.toContain("localhost");
});

test("never inlines a font in the built styles", async () => {
  const assets = path.join(renderer, "assets");
  const styles = (await readdir(assets)).filter((name) => name.endsWith(".css"));
  for (const style of styles) {
    const css = await readFile(path.join(assets, style), "utf8");
    expect(css).not.toMatch(/data:(font|application\/font)/);
  }
});

type Style = Record<string, string>;

/** CSS properties the look rows read. */
const lookProperties = [
  "backgroundColor",
  "color",
  "fontFamily",
  "fontSize",
  "margin",
  "maxWidth",
  "padding",
];

/** Some computed properties of the first element a selector matches, or null when none does. */
function computedStyle(page: Page, selector: string, text?: string): Promise<Style | null> {
  return page.evaluate(
    ({ selector, text, properties }) => {
      const element = [...document.querySelectorAll(selector)].find(
        (candidate) => text === undefined || candidate.textContent?.trim() === text,
      );
      if (element === undefined) return null;
      const style = getComputedStyle(element);
      return Object.fromEntries(
        properties.map((property) => [
          property,
          style.getPropertyValue(
            property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          ),
        ]),
      );
    },
    { selector, text, properties: lookProperties },
  );
}

/** Whether the region fills the workspace section, and whether all its elements use border-box. */
function regionGeometry(page: Page) {
  return page.evaluate(
    ({ region, workspace }) => {
      const root = document.querySelector(region);
      const section = document.querySelector(workspace);
      if (root === null || section === null) return { fills: false, borderBox: false };
      return {
        fills:
          JSON.stringify(root.getBoundingClientRect()) ===
          JSON.stringify(section.getBoundingClientRect()),
        borderBox: [root, ...root.querySelectorAll("*")].every(
          (element) => getComputedStyle(element).boxSizing === "border-box",
        ),
      };
    },
    { region: regionSelector, workspace: workspaceSelector },
  );
}

const firstFamily = (style: Style | null) =>
  style?.["fontFamily"]?.split(",")[0]?.trim().replaceAll('"', "");

/** The computed facts of CNV-B51's look rows, read from the open region. */
async function regionLook(page: Page, projectId: string) {
  const heading = await computedStyle(page, "#ws-heading");
  const noteStyle = await computedStyle(page, `${regionSelector} *`, note);
  const code = await computedStyle(page, `${workspaceSelector} *`, projectId);
  const region = await computedStyle(page, regionSelector);
  const geometry = await regionGeometry(page);
  return {
    headingFont: firstFamily(heading),
    sectionPadding: (await computedStyle(page, workspaceSelector))?.["padding"],
    regionBackground: region?.["backgroundColor"],
    regionFillsSection: geometry.fills,
    noteColor: noteStyle?.["color"],
    noteMaxWidth: noteStyle?.["maxWidth"],
    headingMargin: heading?.["margin"],
    headingLegacySize: heading?.["fontSize"] === "22.4px",
    codeFont: firstFamily(code),
    codeSize: code?.["fontSize"],
    everyBorderBox: geometry.borderBox,
  };
}

test("gives the region frame its Seixo look", async () => {
  test.setTimeout(150_000);
  const { application, page, errors, projects } = await seededLaunch();
  try {
    await openReadWrite(application, page);
    const facts = await regionLook(page, projects[0].projectId);
    expect(facts).toEqual({
      headingFont: "Red Hat Text",
      sectionPadding: "0px",
      regionBackground: "rgb(5, 6, 6)",
      regionFillsSection: true,
      noteColor: "rgb(154, 163, 171)",
      noteMaxWidth: "none",
      headingMargin: "0px",
      headingLegacySize: false,
      codeFont: "Cascadia Code",
      codeSize: "12.5px",
      everyBorderBox: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

test("passes the accessibility harness on the region frame", async () => {
  test.setTimeout(150_000);
  const { application, page, errors, proof } = await seededLaunch();
  try {
    await openReadWrite(application, page);
    const noteText = page.getByText(note, { exact: true });
    await expect(noteText).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.emulateMedia({ forcedColors: "active" });
    expect(await axeViolations(page, { forcedColors: true })).toEqual([]);
    const forcedText = await forcedTextColours(page, regionSelector);
    expect(forcedText.checked).toBeGreaterThan(0);
    expect(forcedText.failures).toEqual([]);
    await expect(noteText).toBeVisible();
    await page.screenshot({ path: path.join(proof, "s4a-visual", "frame-forced-colours.png") });
    await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
    const motion = await page.evaluate((region) => {
      const root = document.querySelector(region);
      return {
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        animations: document
          .getAnimations()
          .map((animation) => ({
            animation,
            target: (animation.effect as KeyframeEffect | null)?.target,
          }))
          .filter(({ target }) => target instanceof Element && root?.contains(target))
          .map(({ animation, target }) => {
            const property = animation instanceof CSSTransition ? animation.transitionProperty : "";
            return `${animation.constructor.name} ${target?.tagName} ${property} ${animation.playState}`;
          }),
      };
    }, regionSelector);
    expect(motion).toEqual({ reduced: true, animations: [] });
    for (const factor of [0.5, 2]) {
      await setZoom(application, page, { factor, width: 1280, height: 800 });
      expect((await layoutFacts(page, regionSelector)).overflows).toBe(false);
      expect((await layoutFacts(page, `${regionSelector} >> text="${note}"`)).inViewport).toBe(
        true,
      );
    }
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

/** The old shell's computed values on `main` at `6a41350`, which S4a must keep. */
const legacyLook = {
  bodyBackground: "rgb(16, 20, 17)",
  bodyColor: "rgb(240, 242, 239)",
  bodyOverflow: "hidden",
  buttonFont: '"Segoe UI Variable", Aptos, "Segoe UI", sans-serif',
  buttonCursor: "pointer",
  buttonBorder: "1px solid rgba(205, 214, 209, 0.29)",
  buttonRadius: "5.6px",
  focusOutline: "rgb(158, 181, 140) solid 2px",
  focusOffset: "4px",
};

/**
 * Focuses the Projects sidebar's Refresh button after a key press, so Chromium treats the focus
 * as keyboard focus; the facts then assert that `:focus-visible` matches.
 */
async function keyboardFocusRefresh(page: Page) {
  await page.keyboard.press("Shift");
  await page.getByRole("button", { name: "Refresh", exact: true }).focus();
}

async function legacyFacts(page: Page) {
  const refresh = page.getByRole("button", { name: "Refresh", exact: true });
  const resting = await refresh.evaluate((button) => {
    const body = getComputedStyle(document.body);
    const style = getComputedStyle(button);
    return {
      bodyBackground: body.backgroundColor,
      bodyColor: body.color,
      bodyOverflow: body.overflow,
      buttonFont: style.fontFamily,
      buttonCursor: style.cursor,
      buttonBorder: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
      buttonRadius: style.borderTopLeftRadius,
    };
  });
  await keyboardFocusRefresh(page);
  const focused = await refresh.evaluate((button) => {
    const style = getComputedStyle(button);
    return {
      focusOutline: `${style.outlineColor} ${style.outlineStyle} ${style.outlineWidth}`,
      focusOffset: style.outlineOffset,
      focusVisible: button.matches(":focus-visible"),
    };
  });
  await refresh.blur();
  return { ...resting, ...focused };
}

function workspacePadding(page: Page) {
  return page.locator(workspaceSelector).evaluate((section) => getComputedStyle(section).padding);
}

test("keeps the old shell's look", async () => {
  test.setTimeout(150_000);
  const { application, page, errors, proof, userData, projects } = await seededLaunch();
  try {
    await sizeContent(application, page, 1280, 800);
    await expect(
      page.getByRole("button", { name: "Open Project repository-a", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    expect(await legacyFacts(page)).toEqual({ ...legacyLook, focusVisible: true });
    expect(await workspacePadding(page)).toBe("32px");
    const [first] = projects;
    await page.getByRole("button", { name: "Open Project repository-a", exact: true }).click();
    await expect(page.getByText("Read-write", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Project repository-b", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Project repository-b", exact: true }),
    ).toBeVisible();
    await rename(
      path.join(userData, "storage", "projects", first.projectId, first.generationId, "mastra.db"),
      path.join(proof, "held-runtime.db"),
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    const safeProject = page.getByRole("button", {
      name: "Open Project repository-a",
      exact: true,
    });
    await expect(safeProject).toContainText("Runtime missing");
    await safeProject.click();
    await expect(page.getByText("Writes unavailable", { exact: false })).toBeVisible();
    expect(await workspacePadding(page)).toBe("32px");
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

/** Opens the add flow on a chosen folder and cancels it, so the idle note sits above the region. */
async function cancelAnAdd(application: ElectronApplication, page: Page, folder: string) {
  await application.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] });
  }, folder);
  await page.getByRole("button", { name: "Add existing repository", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.locator(workspaceSelector).getByText("Cancelled. Nothing was run.", { exact: true }),
  ).toBeVisible();
}

/** The colours, borders and font where the idle-note strip meets the region. */
function noteStripSeam(page: Page) {
  return page.evaluate(
    ({ region, workspace }) => {
      const noteElement = [...document.querySelectorAll(`${workspace} [role="status"]`)].find(
        (element) => element.textContent?.includes("Cancelled."),
      );
      const strip = noteElement?.parentElement;
      const root = document.querySelector(region);
      if (!strip || !root) return null;
      const stripStyle = getComputedStyle(strip);
      const regionStyle = getComputedStyle(root);
      const shellFont = strip.parentElement ? getComputedStyle(strip.parentElement).fontFamily : "";
      // Re-review I1: the colour must follow the token, not merely match its value today.
      strip.style.setProperty("--canvas", "rgb(1, 2, 3)");
      const followsToken = getComputedStyle(strip).backgroundColor === "rgb(1, 2, 3)";
      strip.style.removeProperty("--canvas");
      return {
        stripFont: stripStyle.fontFamily === shellFont ? "the shell's" : stripStyle.fontFamily,
        followsToken,
        stripBackground: stripStyle.backgroundColor,
        regionBackground: regionStyle.backgroundColor,
        stripBorders: [
          stripStyle.borderTopWidth,
          stripStyle.borderRightWidth,
          stripStyle.borderBottomWidth,
          stripStyle.borderLeftWidth,
        ].join(" "),
        regionTopBorder: regionStyle.borderTopWidth,
      };
    },
    { region: regionSelector, workspace: workspaceSelector },
  );
}

test("captures the region frame for the visual review", async () => {
  test.setTimeout(150_000);
  const { application, page, errors, proof } = await seededLaunch();
  try {
    const shots = path.join(proof, "s4a-visual");
    await openReadWrite(application, page);
    await page.screenshot({ path: path.join(shots, "frame-1280x800.png") });
    await sizeContent(application, page, 853, 533);
    await page.screenshot({ path: path.join(shots, "frame-853x533.png") });
    await sizeContent(application, page, 1280, 800);
    await cancelAnAdd(application, page, proof);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    // ui-ux review: the strip shares the region's canvas, with no line between them.
    expect(await noteStripSeam(page)).toEqual({
      stripFont: "the shell's",
      followsToken: true,
      stripBackground: "rgb(5, 6, 6)",
      regionBackground: "rgb(5, 6, 6)",
      stripBorders: "0px 0px 0px 0px",
      regionTopBorder: "0px",
    });
    // The strip and the region share the workspace height: nothing below the region is pushed out.
    expect(
      await page
        .locator(workspaceSelector)
        .evaluate((section) => section.scrollHeight - section.clientHeight),
    ).toBe(0);
    await page.screenshot({ path: path.join(shots, "frame-note-strip-1280x800.png") });
    await sizeContent(application, page, 853, 533);
    await page.screenshot({ path: path.join(shots, "frame-note-strip-853x533.png") });
    expect(errors).toEqual([]);
    console.log(`S4a visual review screenshots: ${shots}`);
  } finally {
    await application.close();
  }
});
