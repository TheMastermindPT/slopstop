import { defineConfig } from "vitest/config";
import { registrationIntegrationFiles } from "./vitest.registration-files.js";
import { errorEqualitySetup } from "./vitest.setup-files.js";
import { trace94TestOptions } from "./vitest.trace-94.js";

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
    ...trace94TestOptions,
    setupFiles: [errorEqualitySetup, ...(trace94TestOptions.setupFiles ?? [])],
  },
});
