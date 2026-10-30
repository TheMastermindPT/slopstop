import { defineProject } from "vitest/config";
import { errorEqualitySetup } from "./vitest.setup-files.js";

export default defineProject({
  test: {
    name: "harness",
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    setupFiles: [errorEqualitySetup],
  },
});
