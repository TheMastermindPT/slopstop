/**
 * The app's zoom rules, in Chromium's zoom levels: a level is `log(factor) / log(1.2)`, so 100% is
 * level 0, and one zoom step is half a level, as Electron's zoom roles step. A level read back
 * from Chromium can be a hair off the one that was set, so steps and the floor are judged within
 * {@link tolerance}, never by exact equality.
 */
const levelOf = (factor: number) => Math.log(factor) / Math.log(1.2);

/** The lowest level the app's own controls reach: 80% (Pedro: "limita a 80%"). */
export const zoomFloorLevel = levelOf(0.8);

/** The highest level zoom in reaches: 500%. */
export const zoomTopLevel = levelOf(5);

const step = 0.5;
const tolerance = 1e-9;

/** One zoom out from `level`: half a level down, never below the floor. */
export function zoomedOut(level: number): number {
  return Math.max(level - step, zoomFloorLevel);
}

/**
 * One zoom in from `level`: the next step above, so a page between two steps lands on a step and
 * as many zoom ins as zoom outs bring it back to 100%. Never above the top.
 */
export function zoomedIn(level: number): number {
  return Math.min((Math.floor(level / step + tolerance) + 1) * step, zoomTopLevel);
}

/**
 * The level a page that opened at `saved` is set to: the floor when Chromium restored a zoom
 * under it (it keeps a page's zoom between launches), else `undefined`, nothing to set.
 */
export function savedZoomCorrection(saved: number): number | undefined {
  return saved < zoomFloorLevel - tolerance ? zoomFloorLevel : undefined;
}

/** The two calls of a window's `webContents` the saved-zoom rule needs. */
export type ZoomedContents = Readonly<{
  getZoomLevel(): number;
  setZoomLevel(level: number): void;
}>;

/** Once a page has loaded: a zoom saved from before the floor is brought up to it, once. */
export function liftSavedZoom(contents: ZoomedContents): void {
  const level = savedZoomCorrection(contents.getZoomLevel());
  if (level !== undefined) contents.setZoomLevel(level);
}
