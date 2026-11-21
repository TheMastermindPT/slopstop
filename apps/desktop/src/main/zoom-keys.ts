import type { Input } from "electron";
import { ownsZoomKeys, type Start } from "./application-menu.js";
import { zoomedIn, zoomedOut } from "./zoom-floor.js";

type ZoomAction = "in" | "out" | "reset";

/** The fields of Electron's `Input` the mapping reads. */
type ZoomKeyInput = Readonly<Pick<Input, "type" | "key" | "code" | "control" | "shift" | "alt">>;

/** What a key types, when it names a zoom key: plus and `=` zoom in, minus out, 0 resets. */
const actionByKey: ReadonlyMap<string, ZoomAction> = new Map([
  ["+", "in"],
  ["=", "in"],
  ["-", "out"],
  ["0", "reset"],
]);

/** A key going down with Ctrl held and Alt not. */
const pressedWithCtrlOnly = (input: ZoomKeyInput) =>
  input.type === "keyDown" && input.control && !input.alt;

/** The key in the 0 key's place, without Shift. */
const isZeroKeyUnshifted = (input: ZoomKeyInput) => input.code === "Digit0" && !input.shift;

/**
 * The zoom a key press asks for, or `undefined` for any other key. Ctrl is held and Alt is not
 * (Ctrl and Alt is also AltGr). What the key types (`key`) decides, so the layout does not
 * matter; only when it names no zoom key does the 0 key's position (`code` `Digit0`, without
 * Shift) reset, for layouts where that key types something else.
 */
function zoomActionOf(input: ZoomKeyInput): ZoomAction | undefined {
  if (!pressedWithCtrlOnly(input)) return undefined;
  return actionByKey.get(input.key) ?? (isZeroKeyUnshifted(input) ? "reset" : undefined);
}

const levelAfter: Readonly<Record<ZoomAction, (level: number) => number>> = {
  in: zoomedIn,
  out: zoomedOut,
  reset: () => 0,
};

/** The calls of a window's `webContents` the zoom keys need. */
export type ZoomKeysContents = Readonly<{
  getZoomLevel(): number;
  setZoomLevel(level: number): void;
  on(
    event: "before-input-event",
    listener: (event: Readonly<{ preventDefault(): void }>, input: ZoomKeyInput) => void,
  ): unknown;
}>;

/**
 * On packaged Windows, the app answers the zoom keys before the page sees them: one listener on
 * the window, which sets the next zoom level and stops the key. Anywhere else it sets nothing,
 * and Electron's default menu keeps its keys.
 */
export function attachZoomKeys(start: Start, contents: ZoomKeysContents): void {
  if (!ownsZoomKeys(start)) return;
  contents.on("before-input-event", (event, input) => {
    const action = zoomActionOf(input);
    if (action === undefined) return;
    event.preventDefault();
    contents.setZoomLevel(levelAfter[action](contents.getZoomLevel()));
  });
}
