import { defineConfig } from "vitest/config";
import { errorEqualitySetup } from "./vitest.setup-files.js";

export default defineConfig({
  test: {
    name: "effect-gate-mutation",
    environment: "node",
    setupFiles: [errorEqualitySetup],
    // The repository row runs the real canary and four packages, about 8 s alone.
    testTimeout: 15_000,
    include: ["apps/harness/scripts/check-effect-diagnostics.test.mjs"],
  },
});
