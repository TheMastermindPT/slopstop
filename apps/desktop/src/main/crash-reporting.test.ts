import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@sentry/electron/main", () => sentryMocks);

import { initializeCrashReporting, reportHarnessCrash } from "./crash-reporting.js";

type SanitizedEvent = {
  breadcrumbs?: unknown;
  contexts?: unknown;
  debug_meta?: {
    images?: Array<{
      type: "sourcemap" | "wasm";
      code_file: string;
      debug_file?: string;
      debug_id: string;
    }>;
  };
  exception?: {
    values?: Array<{
      value?: string;
      stacktrace?: {
        frames?: Array<{
          abs_path?: string;
          filename?: string;
          context_line?: string;
          post_context?: string[];
          pre_context?: string[];
          vars?: Record<string, unknown>;
        }>;
      };
    }>;
  };
  extra?: unknown;
  logentry?: unknown;
  message?: string;
  request?: unknown;
  server_name?: string;
  threads?: {
    values: Array<{
      stacktrace?: {
        frames?: Array<{
          abs_path?: string;
          filename?: string;
          context_line?: string;
          vars?: Record<string, unknown>;
        }>;
      };
    }>;
  };
  user?: unknown;
};

function enabledBeforeSend(): (event: SanitizedEvent) => SanitizedEvent {
  vi.stubEnv("SLOPSTOP_SENTRY_CONSENT", "1");
  vi.stubEnv("SLOPSTOP_SENTRY_DSN", "https://public@example.invalid/1");
  expect(initializeCrashReporting()).toBe(true);
  const options = sentryMocks.init.mock.calls[0]?.[0] as
    | { beforeSend(event: SanitizedEvent): SanitizedEvent }
    | undefined;
  if (options === undefined) throw new Error("Expected Sentry initialization options.");
  return options.beforeSend;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("crash reporting", () => {
  it("stays disabled without both explicit consent and a DSN", () => {
    vi.stubEnv("SLOPSTOP_SENTRY_DSN", "https://public@example.invalid/1");
    expect(initializeCrashReporting()).toBe(false);

    vi.stubEnv("SLOPSTOP_SENTRY_CONSENT", "1");
    vi.stubEnv("SLOPSTOP_SENTRY_DSN", "");
    expect(initializeCrashReporting()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("removes sensitive fields and full paths before sending", () => {
    const beforeSend = enabledBeforeSend();
    const event: SanitizedEvent = {
      breadcrumbs: [{}],
      contexts: {},
      extra: {},
      logentry: {},
      message: "private prompt",
      request: {},
      server_name: "private-machine",
      user: {},
      exception: {
        values: [
          {
            value: "private exception",
            stacktrace: {
              frames: [
                {
                  abs_path: "C:\\private\\workspace\\main.ts",
                  filename: "C:\\private\\workspace\\main.ts",
                  context_line: "secret",
                  post_context: ["secret"],
                  pre_context: ["secret"],
                  vars: { token: "secret" },
                },
                {},
              ],
            },
          },
        ],
      },
    };

    expect(beforeSend(event)).toEqual({
      message: "Redacted application error",
      exception: {
        values: [
          {
            value: "Redacted exception message",
            stacktrace: { frames: [{ filename: "main.ts" }, {}] },
          },
        ],
      },
    });
    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({ sendDefaultPii: false }),
    );
    expect(JSON.stringify(event)).not.toContain("abs_path");
  });

  it("removes full paths from threads and debug images", () => {
    const beforeSend = enabledBeforeSend();
    const event: SanitizedEvent = {
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: "C:\\private\\workspace\\bundle.js",
            debug_id: "public-source-map",
          },
          {
            type: "wasm",
            code_file: "C:\\private\\workspace\\module.wasm",
            debug_file: "C:\\private\\workspace\\module.debug.wasm",
            debug_id: "public-wasm",
          },
        ],
      },
      threads: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  abs_path: "C:\\private\\workspace\\worker.ts",
                  filename: "C:\\private\\workspace\\worker.ts",
                  context_line: "secret",
                  vars: { token: "secret" },
                },
              ],
            },
          },
        ],
      },
    };

    expect(beforeSend(event)).toEqual({
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: "bundle.js",
            debug_id: "public-source-map",
          },
          {
            type: "wasm",
            code_file: "module.wasm",
            debug_file: "module.debug.wasm",
            debug_id: "public-wasm",
          },
        ],
      },
      threads: {
        values: [{ stacktrace: { frames: [{ filename: "worker.ts" }] } }],
      },
    });
    expect(JSON.stringify(event)).not.toContain("C:\\private");
  });

  it("accepts sparse exception and thread structures", () => {
    const beforeSend = enabledBeforeSend();

    expect(beforeSend({})).toEqual({});
    expect(beforeSend({ exception: {} })).toEqual({ exception: {} });
    expect(beforeSend({ exception: { values: [{}] } })).toEqual({
      exception: { values: [{}] },
    });
    expect(beforeSend({ exception: { values: [{ stacktrace: {} }] } })).toEqual({
      exception: { values: [{ stacktrace: {} }] },
    });
    expect(beforeSend({ threads: { values: [{}] } })).toEqual({
      threads: { values: [{}] },
    });
  });

  it("reports only the harness exit code", () => {
    reportHarnessCrash(17);

    expect(sentryMocks.captureMessage).toHaveBeenCalledWith(
      "Harness utility process exited unexpectedly.",
      {
        level: "error",
        tags: { exitCode: "17" },
      },
    );
  });
});
