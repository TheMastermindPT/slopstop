import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "harness-integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
