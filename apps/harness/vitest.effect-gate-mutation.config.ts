import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "effect-gate-mutation",
    environment: "node",
    // The repository row runs the real canary and four packages, about 8 s alone.
    testTimeout: 15_000,
    include: ["apps/harness/scripts/check-effect-diagnostics.test.mjs"],
  },
});
