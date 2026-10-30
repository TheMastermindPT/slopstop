import { defineConfig } from "vitest/config";
import { errorEqualitySetup } from "./vitest.setup-files.js";

export default defineConfig({
  test: {
    name: "stryker-ranges-mutation",
    environment: "node",
    setupFiles: [errorEqualitySetup],
    include: ["apps/harness/scripts/check-stryker-ranges.test.mjs"],
  },
});
