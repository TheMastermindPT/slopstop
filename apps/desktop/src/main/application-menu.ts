import type { MenuItemConstructorOptions } from "electron";

/**
 * The application menu's template: packaged Windows keeps only the zoom shortcuts; development
 * and every other platform keep Electron's default menu (`undefined`).
 */
export function applicationMenuTemplate(
  start: Readonly<{ packaged: boolean; platform: NodeJS.Platform }>,
): MenuItemConstructorOptions[] | undefined {
  if (!start.packaged || start.platform !== "win32") return undefined;
  return [
    { label: "View", submenu: [{ role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }] },
  ];
}
