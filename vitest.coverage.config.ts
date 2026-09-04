import { defineConfig } from "vitest/config";
import { coverageConfig, unitTestProjects } from "./vitest.config.js";

export default defineConfig({
  test: {
    projects: [...unitTestProjects, "apps/harness/vitest.integration.config.ts"],
    coverage: coverageConfig,
  },
});
