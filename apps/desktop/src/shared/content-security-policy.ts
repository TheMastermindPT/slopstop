/**
 * The one owner of each window's Content Security Policy. It has no Electron import, so the main
 * process (the response header) and the renderer's Vite build (the `<meta>` in the page) share it.
 */
export type ContentSecurityPolicyOptions = {
  readonly window: "main";
  /** A `<meta>` ignores `frame-ancestors`, and the page never carries the development origins. */
  readonly delivery: "header" | "meta";
  readonly development: boolean;
};

export function contentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const header = options.delivery === "header";
  const connections =
    header && options.development
      ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
      : "";
  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src 'self'${connections}`,
    "font-src 'self'",
    ...(header ? ["frame-ancestors 'none'"] : []),
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");
}

/**
 * Writes the main window's `<meta>` policy as the first element after `<meta charset>`, before any
 * script or stylesheet. The renderer is loaded from `file://`, where a response header may not apply.
 */
export function addContentSecurityPolicyMeta(html: string): string {
  const charset = /<meta\s+charset=[^>]*>/i.exec(html);
  if (charset === null) throw new Error("index.html has no <meta charset>");
  const policy = contentSecurityPolicy({ window: "main", delivery: "meta", development: false });
  const end = charset.index + charset[0].length;
  return `${html.slice(0, end)}\n    <meta http-equiv="Content-Security-Policy" content="${policy}">${html.slice(end)}`;
}

/**
 * The renderer build's Vite plugin for the page `<meta>`. It runs in the build only: the
 * development server keeps the header, whose connect sources include the localhost origins.
 */
export function contentSecurityPolicyMetaPlugin() {
  return {
    name: "slopstop-content-security-policy",
    apply: "build" as const,
    transformIndexHtml: addContentSecurityPolicyMeta,
  };
}
