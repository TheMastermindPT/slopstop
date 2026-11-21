import { describe, expect, it, vi } from "vitest";
import { applicationMenuTemplate } from "./application-menu.js";

const noZoomOut = () => undefined;

describe("the application menu", () => {
  it("SH-B26: keeps zoom in and reset as Electron's roles and makes zoom out the app's, on Ctrl and minus", () => {
    const zoomOut = vi.fn();
    const template = applicationMenuTemplate({ packaged: true, platform: "win32" }, zoomOut);
    expect(template).toEqual([
      {
        label: "View",
        submenu: [
          { role: "zoomIn" },
          { label: "Zoom Out", accelerator: "CommandOrControl+-", click: zoomOut },
          { role: "resetZoom" },
        ],
      },
    ]);
  });

  it.each([
    { name: "development on win32", packaged: false, platform: "win32" },
    { name: "development on darwin", packaged: false, platform: "darwin" },
    { name: "development on linux", packaged: false, platform: "linux" },
    { name: "packaged on darwin", packaged: true, platform: "darwin" },
    { name: "packaged on linux", packaged: true, platform: "linux" },
  ] as const)("keeps the default menu: $name", ({ packaged, platform }) => {
    expect(applicationMenuTemplate({ packaged, platform }, noZoomOut)).toBeUndefined();
  });
});
