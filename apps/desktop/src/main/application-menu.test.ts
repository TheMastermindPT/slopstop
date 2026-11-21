import { describe, expect, it } from "vitest";
import { applicationMenu } from "./application-menu.js";

describe("the application menu", () => {
  it("SH-B28: has no menu on packaged Windows", () => {
    expect(applicationMenu({ packaged: true, platform: "win32" })).toBeNull();
  });

  it.each([
    { name: "development on win32", packaged: false, platform: "win32" },
    { name: "development on darwin", packaged: false, platform: "darwin" },
    { name: "development on linux", packaged: false, platform: "linux" },
    { name: "packaged on darwin", packaged: true, platform: "darwin" },
    { name: "packaged on linux", packaged: true, platform: "linux" },
  ] as const)("keeps the default menu: $name", ({ packaged, platform }) => {
    expect(applicationMenu({ packaged, platform })).toBeUndefined();
  });
});
