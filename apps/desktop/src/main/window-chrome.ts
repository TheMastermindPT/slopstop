import { Context, Effect, Layer, type Scope } from "effect";

/** The height of the title bar, in CSS pixels at zoom 1. */
const titleBarHeight = 44;

/** The colours and height of the native caption buttons' strip. */
export type TitleBarOverlay = Readonly<{ color: string; symbolColor: string; height: number }>;

/** The two Windows system colours the native buttons take under high contrast. */
export type SystemColourName = "window" | "window-text";

/** The whole options object of the application window, as `BrowserWindow` receives it. */
export type ApplicationWindowOptions = Readonly<{
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  show: boolean;
  backgroundColor: string;
  titleBarStyle?: "hidden";
  titleBarOverlay?: TitleBarOverlay;
  webPreferences: Readonly<{
    contextIsolation: boolean;
    devTools: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    webSecurity: boolean;
    preload: string;
  }>;
}>;

/** What a caller asks of a new window. */
type WindowRequest = Readonly<{
  width: number;
  height: number;
  backgroundColor: string;
  preload: string;
}>;

/** The part of a window the chrome uses. */
export interface ChromeWindow {
  setTitleBarOverlay(overlay: TitleBarOverlay): void;
  isDestroyed(): boolean;
  once(event: "closed", listener: () => void): unknown;
}

/** The chrome's ports to the platform, the theme and the window constructor. */
export type WindowChromePorts<Window extends ChromeWindow> = Readonly<{
  platform: NodeJS.Platform;
  packaged: boolean;
  highContrast(): boolean;
  systemColour(name: SystemColourName): string;
  /** Subscribes to theme changes; answers its own unsubscribe. */
  onThemeUpdated(listener: () => void): () => void;
  createWindow(options: ApplicationWindowOptions): Window;
  reportUnreadableColour(name: SystemColourName): void;
}>;

/** The window chrome's one operation. */
export type WindowChromeService<Window extends ChromeWindow> = Readonly<{
  open(request: WindowRequest): Effect.Effect<Window>;
}>;

/** The theme's canvas with ink-muted symbols (DESIGN.md). */
const themeColours = { color: "#050606", symbolColor: "#9aa3ab" };
/** Readable under any high-contrast theme: the pair when a system colour is unreadable. */
const safeColours = { color: "#000000", symbolColor: "#ffffff" };

/**
 * A system colour `#RRGGBBAA` as an opaque lower-case `#rrggbb` (the alpha is dropped);
 * `undefined` for any other form.
 */
function opaqueSystemColour(value: string): string | undefined {
  const rgb = /^#([0-9a-fA-F]{6})[0-9a-fA-F]{2}$/.exec(value)?.[1];
  return rgb === undefined ? undefined : `#${rgb.toLowerCase()}`;
}

/** The overlay for a high-contrast state, and the system colours that could not be read. */
function overlayFor(
  state: Readonly<{ highContrast: boolean; colours: Readonly<Record<SystemColourName, string>> }>,
): Readonly<{ overlay: TitleBarOverlay; unreadable: readonly SystemColourName[] }> {
  if (!state.highContrast)
    return { overlay: { ...themeColours, height: titleBarHeight }, unreadable: [] };
  const color = opaqueSystemColour(state.colours.window);
  const symbolColor = opaqueSystemColour(state.colours["window-text"]);
  const unreadable = (["window", "window-text"] as const).filter(
    (name) => opaqueSystemColour(state.colours[name]) === undefined,
  );
  const colours =
    color === undefined || symbolColor === undefined ? safeColours : { color, symbolColor };
  return { overlay: { ...colours, height: titleBarHeight }, unreadable };
}

/**
 * The application window's options: on Windows the native title bar is hidden and the native
 * buttons take `overlay`; elsewhere the native frame stays.
 */
function applicationWindowOptions(
  request: WindowRequest,
  window: Readonly<{ platform: NodeJS.Platform; packaged: boolean; overlay: TitleBarOverlay }>,
): ApplicationWindowOptions {
  const options: ApplicationWindowOptions = {
    width: request.width,
    height: request.height,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: request.backgroundColor,
    webPreferences: {
      contextIsolation: true,
      devTools: !window.packaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: request.preload,
    },
  };
  return window.platform === "win32"
    ? { ...options, titleBarStyle: "hidden", titleBarOverlay: window.overlay }
    : options;
}

/**
 * The window chrome: it opens windows in the current theme and, on Windows, repaints the native
 * buttons of the windows it opened, and only those, when the theme changes. Its theme
 * subscription is released with the scope that built it.
 */
export function makeWindowChrome<Window extends ChromeWindow>(
  ports: WindowChromePorts<Window>,
): Effect.Effect<WindowChromeService<Window>, never, Scope.Scope> {
  return Effect.gen(function* () {
    const windows = new Set<Window>();
    const currentOverlay = () => {
      const highContrast = ports.highContrast();
      const { overlay, unreadable } = overlayFor({
        highContrast,
        colours: highContrast
          ? {
              window: ports.systemColour("window"),
              "window-text": ports.systemColour("window-text"),
            }
          : { window: "", "window-text": "" },
      });
      for (const name of unreadable) ports.reportUnreadableColour(name);
      return overlay;
    };
    const repaint = () => {
      const overlay = currentOverlay();
      for (const window of windows) if (!window.isDestroyed()) window.setTitleBarOverlay(overlay);
    };
    if (ports.platform === "win32") {
      yield* Effect.acquireRelease(
        Effect.sync(() => ports.onThemeUpdated(repaint)),
        (unsubscribe) =>
          Effect.sync(() => {
            unsubscribe();
            windows.clear();
          }),
      );
    }
    const open = (request: WindowRequest) =>
      Effect.sync(() => {
        const overlay =
          ports.platform === "win32"
            ? currentOverlay()
            : { ...themeColours, height: titleBarHeight };
        const window = ports.createWindow(
          applicationWindowOptions(request, {
            platform: ports.platform,
            packaged: ports.packaged,
            overlay,
          }),
        );
        if (ports.platform === "win32") {
          windows.add(window);
          window.once("closed", () => windows.delete(window));
        }
        return window;
      });
    return { open };
  });
}

/** The window chrome's service key for one window type. */
export function windowChromeService<Window extends ChromeWindow>() {
  return class WindowChrome extends Context.Service<WindowChrome, WindowChromeService<Window>>()(
    "slopstop/desktop/WindowChrome",
  ) {};
}

/** The window chrome's Layer: the service under `service`, built from `ports`. */
export function windowChromeLayer<Window extends ChromeWindow, Self>(
  service: Context.Key<Self, WindowChromeService<Window>>,
  ports: WindowChromePorts<Window>,
): Layer.Layer<Self> {
  return Layer.effect(service, makeWindowChrome(ports));
}
