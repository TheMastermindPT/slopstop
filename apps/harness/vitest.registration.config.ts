import { defineConfig } from "vitest/config";
import { registrationIntegrationFiles } from "./vitest.registration-files.js";

// Registration cases spawn Git and harness children; under wide parallelism several cross 15 s.
// A later group order runs them after the other integration files, never alongside them.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "harness-registration",
    environment: "node",
    include: registrationIntegrationFiles,
    testTimeout: 15_000,
    maxWorkers: 2,
    sequence: { groupOrder: 1 },
  },
});
