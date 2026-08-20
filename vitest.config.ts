import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "apps/harness/vitest.config.ts",
      "apps/desktop/vitest.config.ts",
      "apps/desktop/vitest.main.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "apps/desktop/src/main/main.ts",
        "apps/desktop/src/preload/preload.ts",
        "apps/desktop/src/renderer/main.tsx",
        "apps/harness/src/process-entry.ts",
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
        "packages/{kernel,protocol}/src/**": {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "apps/harness/src/**": {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
});
