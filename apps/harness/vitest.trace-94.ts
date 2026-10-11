import path from "node:path";

const integration = path.join(import.meta.dirname, "tests/integration");

/**
 * The #94 trace wiring for the integration projects: empty unless `SLOPSTOP_TRACE_94=1`, so the
 * resolved configuration is unchanged when tracing is off. `SLOPSTOP_TRACE_94_RUNNER=0` keeps the
 * setup file and drops the span runner.
 */
export const trace94TestOptions: Readonly<{ setupFiles?: string[]; runner?: string }> =
  process.env["SLOPSTOP_TRACE_94"] === "1"
    ? {
        setupFiles: [path.join(integration, "trace-94-setup.ts")],
        ...(process.env["SLOPSTOP_TRACE_94_RUNNER"] === "0"
          ? {}
          : { runner: path.join(integration, "trace-94-runner.ts") }),
      }
    : {};
