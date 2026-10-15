import path from "node:path";
import { type ElectronApplication, expect, type Locator, type Page } from "@playwright/test";
import { axeViolations, forcedTextColours } from "./accessibility.js";

/** The Conversation region's root and its scrolling stream. */
export const regionSelector = "[data-conversation-region]";
export const streamSelector = "[data-conversation-stream]";
/** The composer's field: the element that carries the focus-within ring around the textarea. */
export const fieldSelector = "[data-conversation-field]";

/** The window's Conversation controls, by the speech table's names. */
export function conversation(page: Page) {
  const region = page.locator(regionSelector);
  return {
    region,
    composer: region.getByRole("textbox", { name: "Message" }),
    save: region.getByRole("button", { name: "Save locally" }),
    status: page.locator("#conversation-status"),
    messages: region.getByRole("list", { name: "Messages" }),
    stream: page.locator(streamSelector),
    field: page.locator(fieldSelector),
  };
}

/**
 * The left edge of each part of the Conversation column that is on screen (ui-ux review 2 D1):
 * the heading, the context lines' icons, the empty state, the message plates, the notice and
 * the composer field.
 */
export function columnEdges(page: Page) {
  return page.locator(regionSelector).evaluate((region) => {
    const parts = {
      heading: "#ws-heading",
      context: ":scope > p > svg",
      empty: "[data-conversation-stream] > div",
      plate: "[data-conversation-stream] li",
      notice: "#conversation-load-title",
      field: "[data-conversation-field]",
    };
    const edges: Record<string, number[]> = {};
    for (const [name, selector] of Object.entries(parts)) {
      const found = [...region.querySelectorAll(selector)].map((element) => {
        const box = (name === "notice" ? element.parentElement : element)?.getBoundingClientRect();
        return Math.round(box?.left ?? Number.NaN);
      });
      if (found.length > 0) edges[name] = [...new Set(found)];
    }
    return edges;
  });
}

/** Every part of the column starts at the same left edge (ui-ux review 2 D1). */
export async function expectOneLeftEdge(page: Page) {
  const edges = await columnEdges(page);
  const field = edges["field"]?.[0];
  expect(field).toBeDefined();
  expect(edges).toEqual(Object.fromEntries(Object.keys(edges).map((name) => [name, [field]])));
}

/**
 * While a load notice is on screen, the status slot keeps its text and its polite live region,
 * but its row is visually hidden (ui-ux review 2 D2).
 */
export async function expectSlotHiddenButAnnounced(page: Page, text: string) {
  const status = page.locator("#conversation-status");
  await expect(status).toHaveText(text);
  await expect(status).toHaveAttribute("aria-live", "polite");
  const row = await status.evaluate((slot) => {
    const box = slot.parentElement?.getBoundingClientRect();
    return { width: box?.width, height: box?.height };
  });
  expect(row).toEqual({ width: 1, height: 1 });
}

/** How far the composer field's bottom sits above the window's bottom edge (ui-ux review 3). */
export function fieldGapToWindowEdge(page: Page) {
  return page
    .locator(fieldSelector)
    .evaluate((field) => Math.round(window.innerHeight - field.getBoundingClientRect().bottom));
}

type ShadowLayer = { colour: number[]; spread: number };

/** Splits a list on the commas that are not inside parentheses. */
function topLevelList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    depth += character === "(" ? 1 : character === ")" ? -1 : 0;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  return value.trim() === "none" ? [] : [...parts, current.trim()];
}

/** The colour channels and the spread of each computed `box-shadow` layer. */
/**
 * The 0-255 channels (and alpha, if any) of a computed colour. Chromium serializes `rgb(from …)`
 * as `color(srgb r g b / a)` with 0-1 channels.
 */
function channels(colour: string): number[] {
  const srgb = /color\(srgb ([^)]*)\)/.exec(colour)?.[1];
  if (srgb !== undefined) {
    const [red, green, blue, alpha] = srgb
      .split(/[\s/]+/)
      .filter(Boolean)
      .map(Number);
    const rgb = [red, green, blue].map((channel) => Math.round((channel ?? 0) * 255));
    return alpha === undefined ? rgb : [...rgb, alpha];
  }
  return (/rgba?\(([^)]*)\)/.exec(colour)?.[1] ?? "")
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
}

const colourFunction = /(?:rgba?|color)\([^)]*\)/;

export function shadowLayers(boxShadow: string): ShadowLayer[] {
  return topLevelList(boxShadow).map((layer) => {
    const lengths = layer.replace(colourFunction, "").trim().split(/\s+/);
    return {
      colour: channels(colourFunction.exec(layer)?.[0] ?? ""),
      spread: Number.parseFloat(lengths[3] ?? "0"),
    };
  });
}

/**
 * The computed focus facts of an element, read while it has focus, once its transitions (the 120 ms
 * control transitions) have finished.
 */
export async function focusFacts(locator: Locator) {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focused: element === document.activeElement,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      boxShadow: style.boxShadow,
      borderWidth: style.borderTopWidth,
      fontFamily: style.fontFamily.split(",")[0]?.trim().replaceAll('"', ""),
      backgroundColor: style.backgroundColor,
    };
  });
}

/**
 * The region passes axe in normal and forced colours (decisions log §48: the forced run disables
 * colour contrast and checks the forced text colour instead), and a screenshot of each mode is saved.
 */
export async function expectAccessibleState(page: Page, shots: string, name: string) {
  expect(await axeViolations(page)).toEqual([]);
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  await page.emulateMedia({ forcedColors: "active" });
  expect(await axeViolations(page, { forcedColors: true })).toEqual([]);
  const forcedText = await forcedTextColours(page, regionSelector);
  expect(forcedText.checked).toBeGreaterThan(0);
  expect(forcedText.failures).toEqual([]);
  await page.screenshot({ path: path.join(shots, `${name}-forced.png`) });
  await page.emulateMedia({ forcedColors: "none" });
}

/** The stream is scrolled to its end. */
export function streamAtEnd(page: Page) {
  return page
    .locator(streamSelector)
    .evaluate((stream) => stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 1);
}

/** Every region control's computed transition durations. */
export function regionTransitionDurations(page: Page) {
  return page
    .locator(regionSelector)
    .evaluate((region) =>
      [...region.querySelectorAll("button, textarea, a, [tabindex]")].map(
        (control) => getComputedStyle(control).transitionDuration,
      ),
    );
}

/**
 * Waits in the page for "Saved" in the status slot, then one animation frame, and reports whether
 * the stream is at its end and whether it moved again in the next frame.
 */
export function scrollAfterSaved(page: Page) {
  return page.evaluate(
    ({ stream: streamSelectorInPage }) =>
      new Promise<{ atEnd: boolean; movedAfter: boolean }>((resolve) => {
        const status = document.querySelector("#conversation-status");
        const stream = document.querySelector(streamSelectorInPage);
        if (status === null || stream === null) {
          resolve({ atEnd: false, movedAfter: true });
          return;
        }
        const observer = new MutationObserver(() => {
          if (!status.textContent?.includes("Saved")) return;
          observer.disconnect();
          requestAnimationFrame(() => {
            const top = stream.scrollTop;
            const atEnd = stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 1;
            requestAnimationFrame(() => resolve({ atEnd, movedAfter: stream.scrollTop !== top }));
          });
        });
        observer.observe(status, { childList: true, characterData: true, subtree: true });
      }),
    { stream: streamSelector },
  );
}

type Replacement = Readonly<{ channel: string; answers: ReadonlyArray<unknown> }>;

/**
 * Replaces conversation IPC handlers in the main process. Each handler echoes the renderer's
 * request into its next scripted answer; an answer `"throw"` makes the handler throw, which the
 * preload turns into a rejected call, and `"hang"` never answers, so a read stays in flight. The
 * last answer repeats.
 */
export function replaceHandlers(application: ElectronApplication, replacements: Replacement[]) {
  return application.evaluate(({ ipcMain }, scripted) => {
    for (const { channel, answers } of scripted) {
      let next = 0;
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, (_event, request: unknown) => {
        const answer = answers[Math.min(next, answers.length - 1)];
        next += 1;
        if (answer === "throw") throw new Error("Replaced handler failure");
        if (answer === "hang") return new Promise<never>(() => undefined);
        return { ...(answer as object), request };
      });
    }
  }, replacements);
}
