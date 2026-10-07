import { defineConfig } from "vitest/config";
import { nativeLongIntegrationFiles } from "./vitest.native-long-files.js";

// These files run for minutes and drive SQLite workers and harness children; overlapping them
// with every other file stalled unrelated cases past 15 s. The last group order runs them after
// the unit, integration and registration projects, two at a time.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "harness-native-long",
    environment: "node",
    include: nativeLongIntegrationFiles,
    testTimeout: 15_000,
    maxWorkers: 2,
    sequence: { groupOrder: 2 },
  },
});
