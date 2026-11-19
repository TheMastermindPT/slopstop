import { defineProject } from "vitest/config";
import { errorEqualitySetup } from "./vitest.setup-files.js";

export default defineProject({
  test: {
    name: "harness",
    environment: "node",
    pool: "threads",
    // Not isolated: it passed two runs in a row without isolation (test-speed item 3).
    isolate: false,
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    setupFiles: [errorEqualitySetup],
  },
});
