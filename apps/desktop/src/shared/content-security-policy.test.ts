import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addContentSecurityPolicyMeta,
  contentSecurityPolicy,
  contentSecurityPolicyMetaPlugin,
} from "./content-security-policy.js";

/** The packaged main-window header, `security.ts:8-18` at `6a41350`. */
const packagedHeader =
  "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'";
const developmentHeader = packagedHeader.replace(
  "connect-src 'self'",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
);
const metaPolicy = packagedHeader.replace(" frame-ancestors 'none';", "");

describe("contentSecurityPolicy", () => {
  it.each([
    [{ window: "main", delivery: "header", development: false }, packagedHeader],
    [{ window: "main", delivery: "header", development: true }, developmentHeader],
    [{ window: "main", delivery: "meta", development: false }, metaPolicy],
    [{ window: "main", delivery: "meta", development: true }, metaPolicy],
  ] as const)("builds the %o policy exactly", (options, expected) => {
    const policy = contentSecurityPolicy(options);
    expect(policy).toBe(expected);
    expect(policy).not.toContain("wasm-unsafe-eval");
  });

  it("keeps localhost out of every meta policy", () => {
    for (const development of [false, true]) {
      expect(
        contentSecurityPolicy({ window: "main", delivery: "meta", development }),
      ).not.toContain("localhost");
    }
  });
});

describe("addContentSecurityPolicyMeta", () => {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../index.html"), "utf8");

  it("writes the meta policy as the first element after <meta charset>", () => {
    const tags = [
      ...addContentSecurityPolicyMeta(source).matchAll(/<(meta|script|link)\b[^>]*>/g),
    ].map((match) => match[0]);
    const charset = tags.findIndex((tag) => /charset=/i.test(tag));
    expect(charset).toBe(0);
    expect(tags[1]).toBe(`<meta http-equiv="Content-Security-Policy" content="${metaPolicy}">`);
  });

  it("changes nothing else in the page", () => {
    const meta = `
    <meta http-equiv="Content-Security-Policy" content="${metaPolicy}">`;
    const output = addContentSecurityPolicyMeta(source);
    expect(output.split(meta)).toHaveLength(2);
    expect(output.replace(meta, "")).toBe(source);
  });

  it("finds a charset meta written with extra spaces", () => {
    expect(addContentSecurityPolicyMeta('<head><meta  charset="UTF-8"></head>')).toBe(
      `<head><meta  charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${metaPolicy}"></head>`,
    );
  });

  it("refuses a page without <meta charset>", () => {
    expect(() => addContentSecurityPolicyMeta("<html><head></head></html>")).toThrow(
      "index.html has no <meta charset>",
    );
  });
});

describe("contentSecurityPolicyMetaPlugin", () => {
  it("writes the meta in the build only, so the development server keeps its header", () => {
    const plugin = contentSecurityPolicyMetaPlugin();
    expect(plugin.apply).toBe("build");
    expect(plugin.transformIndexHtml).toBe(addContentSecurityPolicyMeta);
  });
});
