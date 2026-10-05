import { defineConfig } from "vitest/config";

export const integrationTestProjects = [
  "apps/harness/vitest.integration.config.ts",
  "apps/harness/vitest.registration.config.ts",
  "apps/desktop/vitest.integration.config.ts",
];

export default defineConfig({
  test: {
    projects: integrationTestProjects,
  },
});
