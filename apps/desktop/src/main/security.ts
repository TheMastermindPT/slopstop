import { app, session, type WebContents } from "electron";
import { contentSecurityPolicy } from "../shared/content-security-policy.js";

export function configureSessionSecurity(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          contentSecurityPolicy({
            window: "main",
            delivery: "header",
            development: !app.isPackaged,
          }),
        ],
      },
    });
  });
}

export function lockNavigation(contents: WebContents, allowedUrl: string): void {
  contents.on("will-navigate", (event, navigationUrl) => {
    if (navigationUrl !== allowedUrl) {
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
}
