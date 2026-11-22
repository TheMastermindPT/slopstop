import { useEffect } from "react";
import { attentionHeadingId, projectsHeadingId, workHeadingId } from "./focus-headings.js";

/** The banner landmark: a `header` outside every sectioning element and `main`. */
const bannerSelector = "header:not(:is(article, aside, main, nav, section) header)";

/** One focus zone: where it is in the page, and the one place F6 puts focus in it. */
type Zone = Readonly<{ container: () => Element | null; target: () => HTMLElement | null }>;

const element = (selector: string) => () => document.querySelector<HTMLElement>(selector);

/**
 * The window's zones in F6 order (the approved accessibility board, Q16 and Q17): the bar while it
 * holds the name button, the rail, the current sidebar, the work area and the message box while a
 * conversation shows one. Each has one fixed target; a zone without its target does not exist.
 */
const zones: readonly Zone[] = [
  { container: element(bannerSelector), target: element(`${bannerSelector} button`) },
  {
    container: element('nav[aria-label="Activity"]'),
    target: element('nav[aria-label="Activity"] button[aria-pressed="true"]'),
  },
  {
    container: () =>
      document.querySelector('aside[aria-label="Projects"], aside[aria-label="Attention"]'),
    target: element(`#${projectsHeadingId}, #${attentionHeadingId}`),
  },
  // The work area is the frame's <main>: it also holds the harness strip.
  { container: element("main"), target: element(`#${workHeadingId}`) },
  // The message box is the conversation's field: the text field and its Save button.
  {
    container: element("[data-conversation-field]"),
    target: element('textarea[aria-label="Message"]'),
  },
];

/** Whether `container` holds `active`; neither is missing. */
const holds = (container: Element | null, active: Element | null): container is Element =>
  active !== null && container?.contains(active) === true;

/**
 * The index, among `present`, of the zone that holds `active`: the innermost container that holds
 * it, by containment (the sidebar and the message box sit inside the work area's <main>). `-1` when
 * no zone holds it.
 */
function zoneOf(present: readonly Zone[], active: Element | null): number {
  let found = -1;
  let innermost: Element | null = null;
  present.forEach((zone, index) => {
    const container = zone.container();
    if (!holds(container, active)) return;
    if (innermost === null || innermost.contains(container)) {
      innermost = container;
      found = index;
    }
  });
  return found;
}

/** The zone F6 (or Shift+F6, `back`) moves to from the zone at `from`, wrapping at the ends. */
function nextIndex(from: number, count: number, back: boolean): number {
  if (from === -1) return back ? count - 1 : 0;
  return (from + (back ? count - 1 : 1)) % count;
}

/** Moves focus to the next zone that exists on F6, and back on Shift+F6. Focus is all it changes. */
function moveZone(event: KeyboardEvent): void {
  if (event.key !== "F6") return;
  const present = zones.filter((zone) => zone.target() !== null);
  if (present.length === 0) return;
  event.preventDefault();
  const to = nextIndex(zoneOf(present, document.activeElement), present.length, event.shiftKey);
  present[to]?.target()?.focus();
}

/** F6 and Shift+F6 between the window's zones, for as long as the shell is mounted. */
export function useZoneKeys(): void {
  useEffect(() => {
    document.addEventListener("keydown", moveZone);
    return () => document.removeEventListener("keydown", moveZone);
  }, []);
}
