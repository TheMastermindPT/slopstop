/** Where the app runs: packaged or in development, and on which platform. */
export type Start = Readonly<{ packaged: boolean; platform: NodeJS.Platform }>;

/**
 * Whether the app handles the zoom keys itself and has no menu: on packaged Windows only (Q24).
 * The one owner of that test, for the menu and for the keys.
 */
export function ownsZoomKeys(start: Start): boolean {
  return start.packaged && start.platform === "win32";
}

/**
 * The application menu to set before the first window: none (`null`) on packaged Windows, where
 * the title bar is the app's own and the app handles the zoom keys (Pedro: "Sem menu"); `undefined`
 * elsewhere, which leaves Electron's default menu alone.
 */
export function applicationMenu(start: Start): null | undefined {
  return ownsZoomKeys(start) ? null : undefined;
}
