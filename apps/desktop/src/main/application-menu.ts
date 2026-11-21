import type { MenuItemConstructorOptions } from "electron";

/**
 * The application menu's template: packaged Windows keeps only the zoom shortcuts; development
 * and every other platform keep Electron's default menu (`undefined`). Zoom in and reset are
 * Electron's roles; zoom out is the app's, on the role's key, so it can stop at the zoom floor.
 */
export function applicationMenuTemplate(
  start: Readonly<{ packaged: boolean; platform: NodeJS.Platform }>,
  zoomOut: () => void,
): MenuItemConstructorOptions[] | undefined {
  if (!start.packaged || start.platform !== "win32") return undefined;
  return [
    {
      label: "View",
      submenu: [
        { role: "zoomIn" },
        { label: "Zoom Out", accelerator: "CommandOrControl+-", click: zoomOut },
        { role: "resetZoom" },
      ],
    },
  ];
}
