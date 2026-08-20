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
  exception?: {
    values?: Array<{
      value?: string;
      stacktrace?: {
        frames?: Array<{
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
  user?: unknown;
};

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
    vi.stubEnv("SLOPSTOP_SENTRY_CONSENT", "1");
    vi.stubEnv("SLOPSTOP_SENTRY_DSN", "https://public@example.invalid/1");

    expect(initializeCrashReporting()).toBe(true);
    const options = sentryMocks.init.mock.calls[0]?.[0] as
      | { beforeSend(event: SanitizedEvent): SanitizedEvent }
      | undefined;
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

    expect(options?.beforeSend(event)).toEqual({
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
