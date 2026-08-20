import { app, session, type WebContents } from "electron";

function contentSecurityPolicy(): string {
  const developmentConnections = app.isPackaged
    ? ""
    : " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*";

  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src 'self'${developmentConnections}`,
    "font-src 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");
}

export function configureSessionSecurity(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [contentSecurityPolicy()],
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
