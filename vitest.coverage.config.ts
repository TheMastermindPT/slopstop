import { defineConfig } from "vitest/config";
import { coverageConfig, unitTestProjects } from "./vitest.config.js";

/**
 * The `test:coverage` script passes `--pool=threads --maxWorkers=50%`: file-based projects do not
 * inherit root `pool` or `maxWorkers`, and only the CLI flags reach them. Forked workers under V8
 * coverage intermittently die with a native access violation (0xC0000005) on Windows, and full
 * parallelism makes the native suites cross their timeouts. A workaround, not a root cause.
 */
export default defineConfig({
  test: {
    projects: [...unitTestProjects, "apps/harness/vitest.integration.config.ts"],
    coverage: coverageConfig,
  },
});
