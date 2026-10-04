import { defineConfig } from "vitest/config";
import { coverageConfig, unitTestProjects } from "./vitest.config.js";

/**
 * The `test:coverage` script passes `--maxWorkers=50%`: file-based projects do not inherit root
 * `maxWorkers`, and only the CLI flag reaches them. Full parallelism makes the native suites cross
 * their timeouts under V8 coverage. Workers stay forked: a native access violation (0xC0000005)
 * seen under coverage kills one forked file, but with threads it kills the whole run.
 */
export default defineConfig({
  test: {
    projects: [...unitTestProjects, "apps/harness/vitest.integration.config.ts"],
    coverage: coverageConfig,
  },
});
