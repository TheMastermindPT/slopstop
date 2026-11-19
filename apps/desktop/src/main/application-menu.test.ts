import { describe, expect, it } from "vitest";
import { applicationMenuTemplate } from "./application-menu.js";

describe("the application menu", () => {
  it("keeps only the zoom shortcuts on packaged Windows", () => {
    expect(applicationMenuTemplate({ packaged: true, platform: "win32" })).toEqual([
      { label: "View", submenu: [{ role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }] },
    ]);
  });

  it.each([
    { name: "development on win32", packaged: false, platform: "win32" },
    { name: "development on darwin", packaged: false, platform: "darwin" },
    { name: "development on linux", packaged: false, platform: "linux" },
    { name: "packaged on darwin", packaged: true, platform: "darwin" },
    { name: "packaged on linux", packaged: true, platform: "linux" },
  ] as const)("keeps the default menu: $name", ({ packaged, platform }) => {
    expect(applicationMenuTemplate({ packaged, platform })).toBeUndefined();
  });
});
