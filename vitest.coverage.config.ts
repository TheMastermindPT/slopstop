import { defineConfig } from "vitest/config";
import { coverageConfig, unitTestProjects } from "./vitest.config.js";

export default defineConfig({
  test: {
    projects: [...unitTestProjects, "apps/harness/vitest.integration.config.ts"],
    coverage: coverageConfig,
    /**
     * V8 instrumentation makes the native registration and Storage suites CPU-bound; at the
     * default worker count (available parallelism minus one) they contend and cross their
     * unchanged timeouts. Half the cores keeps every test, timeout and threshold as is.
     */
    maxWorkers: "50%",
    /**
     * Forked workers under V8 coverage intermittently die with a native access violation
     * (0xC0000005) on Windows; worker threads have not shown it. A workaround, not a root cause.
     */
    pool: "threads",
  },
});
