import { describe, expect, it, vi } from "vitest";
import {
  flush,
  load,
  menuKeys,
  onPlatform,
  ports,
  useMainEntryFakes,
  writes,
} from "./canonical-writer-package-smoke-main-fakes.js";

let ready: () => void;
useMainEntryFakes({
  untilReady: () =>
    new Promise<void>((resolve) => {
      ready = resolve;
    }),
  // No row here holds the witness close.
  untilCloseReleased: async () => undefined,
  loadMain: () => import("./main.js"),
});

describe("the menu keys proof's page in main", () => {
  const unseen = "Package smoke proof failed at menu-keys-unseen.\n";
  // A win32 bootstrap smoke with diagnostics on, whose page writes the marker; each row changes
  // what it names. The six keys step the zoom 0.5, 0, -0.5, then reset it.
  const marked = {
    pageLine: "slopstop-menu-keys-marker",
    pageFails: "none" as "none" | "arming" | "token",
    keysPressed: 6,
    zoomSets: [[0.5], [0], [-0.5], [0]] as number[][],
    exit: 0,
    writes: [] as string[],
  };
  const failing = { ...marked, exit: 1, writes: [unseen] };

  it.each([
    { ...marked, name: "a page that writes the marker" },
    { ...failing, name: "a page writing another line", pageLine: "another line" },
    { ...failing, name: "a page that cannot answer the token read", pageFails: "token" as const },
    {
      ...failing,
      name: "a failed arming",
      pageFails: "arming" as const,
      keysPressed: 0,
      zoomSets: [],
    },
  ])("SH-B29: ends the proof and drops its listeners for $name", async (row) => {
    vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_SCENARIO", "bootstrap");
    vi.stubEnv("SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS", "1");
    menuKeys.pageLine = row.pageLine;
    menuKeys.pageFails = row.pageFails;
    // On fake timers, so a proof that waits out its 5 s for the marker ends within the row.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await onPlatform("win32", async () => {
      await load();
      ready();
      await flush();
      await vi.advanceTimersByTimeAsync(6000);
    });
    const contents = ports.window.mock.instances[0]?.webContents;
    expect(
      contents && {
        keysPressed: contents.sendInputEvent.mock.calls.filter(
          ([input]) => input.type === "keyDown",
        ).length,
        zoomSets: contents.setZoomLevel.mock.calls,
        proofListeners: [
          contents.listeners["console-message"].size,
          contents.listeners["did-start-loading"].size,
          contents.listeners["did-start-navigation"].size,
        ],
      },
    ).toEqual({ keysPressed: row.keysPressed, zoomSets: row.zoomSets, proofListeners: [0, 0, 0] });
    expect(ports.app.exit).toHaveBeenCalledExactlyOnceWith(row.exit);
    expect(writes).toEqual(row.writes);
  });
});
