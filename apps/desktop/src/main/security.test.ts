import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  app: { isPackaged: true },
  onHeadersReceived: vi.fn(),
  setPermissionCheckHandler: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
}));

vi.mock("electron", () => ({
  app: electronMocks.app,
  session: {
    defaultSession: {
      setPermissionCheckHandler: electronMocks.setPermissionCheckHandler,
      setPermissionRequestHandler: electronMocks.setPermissionRequestHandler,
      webRequest: {
        onHeadersReceived: electronMocks.onHeadersReceived,
      },
    },
  },
}));

import { configureSessionSecurity, lockNavigation } from "./security.js";

beforeEach(() => {
  electronMocks.app.isPackaged = true;
  vi.clearAllMocks();
});

describe("desktop security", () => {
  it("denies permissions and installs a production CSP", () => {
    configureSessionSecurity();

    const permissionCheck = electronMocks.setPermissionCheckHandler.mock.calls[0]?.[0];
    const permissionRequest = electronMocks.setPermissionRequestHandler.mock.calls[0]?.[0];
    const headersReceived = electronMocks.onHeadersReceived.mock.calls[0]?.[0];
    const permissionCallback = vi.fn();
    const responseCallback = vi.fn();

    expect(permissionCheck?.()).toBe(false);
    permissionRequest?.(undefined, "camera", permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);

    headersReceived?.({ responseHeaders: { Existing: ["value"] } }, responseCallback);
    expect(responseCallback).toHaveBeenCalledWith({
      responseHeaders: {
        Existing: ["value"],
        "Content-Security-Policy": [expect.not.stringContaining("localhost")],
      },
    });
  });

  it("permits development transport in CSP without granting browser permissions", () => {
    electronMocks.app.isPackaged = false;
    configureSessionSecurity();

    const headersReceived = electronMocks.onHeadersReceived.mock.calls[0]?.[0];
    const responseCallback = vi.fn();
    headersReceived?.({ responseHeaders: undefined }, responseCallback);

    expect(responseCallback).toHaveBeenCalledWith({
      responseHeaders: {
        "Content-Security-Policy": [expect.stringContaining("ws://127.0.0.1:*")],
      },
    });
  });

  it("allows only the configured renderer URL and denies new windows", () => {
    let navigate: ((event: { preventDefault(): void }, url: string) => void) | undefined;
    const contents = {
      on: vi.fn((_event, listener) => {
        navigate = listener;
      }),
      setWindowOpenHandler: vi.fn(),
    };
    const blockedEvent = { preventDefault: vi.fn() };
    const allowedEvent = { preventDefault: vi.fn() };

    lockNavigation(contents as never, "file:///app/index.html");
    navigate?.(allowedEvent, "file:///app/index.html");
    navigate?.(blockedEvent, "https://example.com");

    expect(allowedEvent.preventDefault).not.toHaveBeenCalled();
    expect(blockedEvent.preventDefault).toHaveBeenCalledOnce();
    expect(contents.setWindowOpenHandler.mock.calls[0]?.[0]()).toEqual({ action: "deny" });
  });
});
