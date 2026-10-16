import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // A Vitest unit test of the packaged-smoke load-order guard (vitest.main.config.ts).
  testIgnore: ["package-smoke-load-order.test.mjs"],
  fullyParallel: false,
  workers: 1,
  timeout: 20_000,
  expect: {
    timeout: 8_000,
  },
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    trace: "retain-on-failure",
  },
});
