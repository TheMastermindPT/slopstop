/** The lowest page zoom the app's own controls reach (Pedro: "limita a 80%"). */
export const zoomFloor = 0.8;

/** One zoom out, as Electron's `zoomOut` role takes it: half a zoom level, `1.2 ** -0.5`. */
const zoomOutStep = 1.2 ** -0.5;

/**
 * The zoom factor one zoom out leads to from `current`: the role's step down, never below the
 * floor. A page already under the floor comes back up to it.
 */
export function zoomedOut(current: number): number {
  return Math.max(current * zoomOutStep, zoomFloor);
}

/**
 * The zoom factor a page that opened at `saved` is set to: the floor when Chromium restored a
 * zoom under it (it keeps a page's zoom between launches), else `undefined`, nothing to set.
 */
export function savedZoomCorrection(saved: number): number | undefined {
  return saved < zoomFloor ? zoomFloor : undefined;
}

/** The two calls of a window's `webContents` the saved-zoom rule needs. */
export type ZoomedContents = Readonly<{
  getZoomFactor(): number;
  setZoomFactor(factor: number): void;
}>;

/** Once a page has loaded: a zoom saved from before the floor is brought up to it, once. */
export function liftSavedZoom(contents: ZoomedContents): void {
  const factor = savedZoomCorrection(contents.getZoomFactor());
  if (factor !== undefined) contents.setZoomFactor(factor);
}
