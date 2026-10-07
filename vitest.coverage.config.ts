import { defineConfig } from "vitest/config";
import { coverageConfig, unitTestProjects } from "./vitest.config.js";
import { integrationTestProjects } from "./vitest.integration.config.js";

/**
 * Half the workers by default: full parallelism makes the native suites cross their timeouts
 * under V8 coverage. Projects without their own `maxWorkers` take this root value; the
 * registration and long native projects keep their own lower limits and run in later group
 * orders, after the unit projects. Workers stay
 * forked: a native access violation (0xC0000005) seen under coverage killed one forked file, but
 * with threads it killed the whole run.
 */
export default defineConfig({
  test: {
    maxWorkers: "50%",
    projects: [...unitTestProjects, ...integrationTestProjects],
    coverage: coverageConfig,
  },
});
