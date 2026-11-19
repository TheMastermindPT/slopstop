import { readFileSync } from "node:fs";
import path from "node:path";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  type ApplicationWindowOptions,
  type SystemColourName,
  type TitleBarOverlay,
  type WindowChromePorts,
  windowChromeLayer,
  windowChromeService,
} from "./window-chrome.js";

/**
 * A window the fake `createWindow` makes: it records its repaints, keeps its listeners by event
 * name, runs only those of the event it emits, and can die.
 */
function fakeWindow() {
  const listeners = new Map<string, (() => void)[]>();
  let destroyed = false;
  const window = {
    setTitleBarOverlay: vi.fn((_overlay: TitleBarOverlay) => undefined),
    isDestroyed: () => destroyed,
    once: vi.fn((event: string, listener: () => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    }),
  };
  const emit = (event: string) => {
    const due = listeners.get(event) ?? [];
    listeners.delete(event);
    for (const listener of due) listener();
  };
  return {
    window,
    emit,
    close: () => emit("closed"),
    destroy: () => {
      destroyed = true;
    },
  };
}
type FakeWindow = ReturnType<typeof fakeWindow>["window"];

type Setting = Readonly<{
  platform: NodeJS.Platform;
  packaged?: boolean;
  highContrast?: boolean;
  colours?: Readonly<Record<SystemColourName, string>>;
}>;

/** Fake ports over a high-contrast switch, system colours and a captured theme listener. */
function chromePorts(setting: Setting) {
  const state = { highContrast: setting.highContrast ?? false };
  const colours = setting.colours ?? { window: "#FFFFFFFF", "window-text": "#000000FF" };
  const listeners: (() => void)[] = [];
  const unsubscribe = vi.fn();
  const made: ReturnType<typeof fakeWindow>[] = [];
  const ports = {
    platform: setting.platform,
    packaged: setting.packaged ?? false,
    highContrast: vi.fn(() => state.highContrast),
    systemColour: vi.fn((name: SystemColourName) => colours[name]),
    onThemeUpdated: vi.fn((listener: () => void) => {
      listeners.push(listener);
      return unsubscribe;
    }),
    createWindow: vi.fn((_options: ApplicationWindowOptions) => {
      const fake = fakeWindow();
      made.push(fake);
      return fake.window;
    }),
    reportUnreadableColour: vi.fn((_name: SystemColourName) => undefined),
  } satisfies WindowChromePorts<FakeWindow>;
  const fire = () => {
    for (const listener of listeners) listener();
  };
  return { ports, state, fire, unsubscribe, made };
}

/** The window the fake constructor made at `index`; a row that expects it fails without it. */
function madeAt(made: readonly ReturnType<typeof fakeWindow>[], index: number) {
  const fake = made[index];
  if (fake === undefined) throw new Error(`No window was made at ${index}.`);
  return fake;
}

const FakeWindowChrome = windowChromeService<FakeWindow>();

/** Builds the service from its Layer in a scope the row closes when it wants. */
function buildChrome(ports: WindowChromePorts<FakeWindow>) {
  const scope = Effect.runSync(Scope.make());
  const context = Effect.runSync(
    Layer.buildWithScope(windowChromeLayer(FakeWindowChrome, ports), scope),
  );
  const chrome = Context.get(context, FakeWindowChrome);
  return {
    open: (request: Parameters<typeof chrome.open>[0] = mainWindowRequest) =>
      Effect.runSync(chrome.open(request)),
    close: () => Effect.runSync(Scope.close(scope, Exit.void)),
  };
}

const mainWindowRequest = {
  width: 1120,
  height: 720,
  backgroundColor: "#101411",
  preload: "P",
};

const securePreferences = {
  contextIsolation: true,
  devTools: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  preload: "P",
};

const themeOverlay = { color: "#050606", symbolColor: "#9aa3ab", height: 44 };

/** PF-B11's whole options object. */
const windowsOptions = {
  width: 1120,
  height: 720,
  minWidth: 640,
  minHeight: 480,
  show: false,
  backgroundColor: "#101411",
  titleBarStyle: "hidden",
  titleBarOverlay: themeOverlay,
  webPreferences: securePreferences,
};

const { titleBarStyle: _style, titleBarOverlay: _overlay, ...nativeFrameOptions } = windowsOptions;

const designColours = readFileSync(
  path.resolve(import.meta.dirname, "../../../../DESIGN.md"),
  "utf8",
);

/** One entry of DESIGN.md's `colors` block. */
function designColour(name: "canvas" | "ink-muted"): string {
  const block = /^colors:\r?\n((?: {2}.*\r?\n)*)/m.exec(designColours)?.[1] ?? "";
  return new RegExp(`^ {2}"?${name}"?: "([^"]*)"`, "m").exec(block)?.[1] ?? "";
}

/** WCAG 2.1 contrast ratio of two `#rrggbb` colours. */
function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
      const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [light = 0, dark = 0] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Under high contrast on Windows with `colours`, the window opens with the safe pair and
 * `unreadable` is reported once; a repaint gives the same pair and the same report once more.
 */
function expectSafeFallback(
  colours: Readonly<Record<SystemColourName, string>>,
  unreadable: SystemColourName,
) {
  const { ports, fire, made } = chromePorts({ platform: "win32", highContrast: true, colours });
  const chrome = buildChrome(ports);
  chrome.open();
  const safeOverlay = { color: "#000000", symbolColor: "#ffffff", height: 44 };
  expect(ports.createWindow.mock.calls[0]?.[0].titleBarOverlay).toEqual(safeOverlay);
  expect(ports.reportUnreadableColour.mock.calls).toEqual([[unreadable]]);
  fire();
  expect(madeAt(made, 0).window.setTitleBarOverlay.mock.calls).toEqual([[safeOverlay]]);
  expect(ports.reportUnreadableColour.mock.calls).toEqual([[unreadable], [unreadable]]);
  chrome.close();
}

describe("the window chrome", () => {
  it("opens the Windows window without a native title bar, in the theme's colours", () => {
    const { ports, made } = chromePorts({ platform: "win32" });
    const chrome = buildChrome(ports);
    const window = chrome.open();
    expect(ports.createWindow).toHaveBeenCalledTimes(1);
    expect(ports.createWindow).toHaveBeenCalledWith(windowsOptions);
    expect(window).toBe(made[0]?.window);
    expect(ports.systemColour).not.toHaveBeenCalled();
    chrome.close();
  });

  it("takes the native buttons' colours from DESIGN.md", () => {
    const { ports } = chromePorts({ platform: "win32" });
    const chrome = buildChrome(ports);
    chrome.open();
    const overlay = ports.createWindow.mock.calls[0]?.[0].titleBarOverlay;
    expect(overlay?.color.toLowerCase()).toBe(designColour("canvas").toLowerCase());
    expect(overlay?.symbolColor.toLowerCase()).toBe(designColour("ink-muted").toLowerCase());
    expect(contrastRatio(overlay?.symbolColor ?? "", overlay?.color ?? "")).toBeGreaterThanOrEqual(
      4.5,
    );
    chrome.close();
  });

  it.each([
    { platform: "linux", highContrast: false },
    { platform: "linux", highContrast: true },
    { platform: "darwin", highContrast: false },
    { platform: "darwin", highContrast: true },
  ] as const)(
    "keeps the native frame on another platform: $platform",
    ({ platform, highContrast }) => {
      const { ports } = chromePorts({ platform, highContrast });
      const chrome = buildChrome(ports);
      chrome.open();
      expect(ports.createWindow).toHaveBeenCalledWith(nativeFrameOptions);
      expect(ports.systemColour).not.toHaveBeenCalled();
      expect(ports.onThemeUpdated).not.toHaveBeenCalled();
      chrome.close();
    },
  );

  it("opens with the system colours when high contrast is already on", () => {
    const { ports } = chromePorts({
      platform: "win32",
      highContrast: true,
      colours: { window: "#FFFFFFFF", "window-text": "#1A2B3CFF" },
    });
    const chrome = buildChrome(ports);
    chrome.open();
    expect(ports.createWindow.mock.calls[0]?.[0].titleBarOverlay).toEqual({
      color: "#ffffff",
      symbolColor: "#1a2b3c",
      height: 44,
    });
    expect(ports.systemColour.mock.calls.map(([name]) => name).sort()).toEqual([
      "window",
      "window-text",
    ]);
    expect(ports.reportUnreadableColour).not.toHaveBeenCalled();
    chrome.close();
  });

  it.each([
    { name: "packaged", packaged: true, platform: "win32" },
    { name: "packaged", packaged: true, platform: "linux" },
    { name: "development", packaged: false, platform: "win32" },
    { name: "development", packaged: false, platform: "linux" },
  ] as const)("keeps the window's security settings: $name", ({ packaged, platform }) => {
    const { ports } = chromePorts({ platform, packaged });
    const chrome = buildChrome(ports);
    chrome.open();
    const expected = platform === "win32" ? windowsOptions : nativeFrameOptions;
    expect(ports.createWindow.mock.calls[0]?.[0]).toEqual({
      ...expected,
      webPreferences: { ...securePreferences, devTools: !packaged },
    });
    chrome.close();
  });

  it("repaints the windows it opened when high contrast changes", () => {
    const { ports, state, fire, made } = chromePorts({
      platform: "win32",
      colours: { window: "#FFFFFFFF", "window-text": "#1A2B3CFF" },
    });
    const chrome = buildChrome(ports);
    expect(ports.onThemeUpdated).toHaveBeenCalledTimes(1);
    chrome.open();
    const first = madeAt(made, 0);
    state.highContrast = true;
    fire();
    const systemOverlay = { color: "#ffffff", symbolColor: "#1a2b3c", height: 44 };
    expect(first.window.setTitleBarOverlay.mock.calls).toEqual([[systemOverlay]]);
    chrome.open();
    expect(ports.onThemeUpdated).toHaveBeenCalledTimes(1);
    const second = madeAt(made, 1);
    const repaints = () =>
      [first, second].map((fake) => fake.window.setTitleBarOverlay.mock.calls.length);
    state.highContrast = false;
    fire();
    expect(first.window.setTitleBarOverlay.mock.calls).toEqual([[systemOverlay], [themeOverlay]]);
    expect(second.window.setTitleBarOverlay.mock.calls).toEqual([[themeOverlay]]);
    first.close();
    fire();
    expect(repaints()).toEqual([2, 2]);
    second.destroy();
    fire();
    expect(repaints()).toEqual([2, 2]);
    chrome.close();
  });

  it("releases the theme listener when its scope ends", () => {
    const { ports, state, fire, unsubscribe, made } = chromePorts({ platform: "win32" });
    const chrome = buildChrome(ports);
    chrome.open();
    chrome.close();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    state.highContrast = true;
    fire();
    expect(made[0]?.window.setTitleBarOverlay).not.toHaveBeenCalled();
  });

  it.each([
    { name: "empty", window: "" },
    { name: "six digits", window: "#FFFFFF" },
    { name: "a colour name", window: "white" },
    { name: "nine digits", window: "#FFFFFFFF0" },
  ] as const)(
    "falls back to black and white when a system colour is unreadable: $name",
    ({ window }) => {
      expectSafeFallback({ window, "window-text": "#000000FF" }, "window");
    },
  );

  it("falls back to black and white when only the text colour is unreadable", () => {
    expectSafeFallback({ window: "#FFFFFFFF", "window-text": "#1A2B3C" }, "window-text");
  });

  it("forgets a window on its closed event only", () => {
    const { ports, fire, made } = chromePorts({ platform: "win32" });
    const chrome = buildChrome(ports);
    chrome.open();
    const first = madeAt(made, 0);
    expect(first.window.once).toHaveBeenCalledTimes(1);
    expect(first.window.once.mock.calls[0]?.[0]).toBe("closed");
    first.emit("close");
    fire();
    expect(first.window.setTitleBarOverlay).toHaveBeenCalledTimes(1);
    first.emit("closed");
    fire();
    expect(first.window.setTitleBarOverlay).toHaveBeenCalledTimes(1);
    chrome.close();
  });
});
