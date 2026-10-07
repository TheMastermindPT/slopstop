import { configDefaults, defineConfig } from "vitest/config";
import { nativeLongIntegrationFiles } from "./vitest.native-long-files.js";
import { registrationIntegrationFiles } from "./vitest.registration-files.js";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "harness-integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    exclude: [
      ...configDefaults.exclude,
      ...registrationIntegrationFiles,
      ...nativeLongIntegrationFiles,
    ],
    testTimeout: 15_000,
    maxWorkers: "50%",
    sequence: { groupOrder: 0 },
  },
});
