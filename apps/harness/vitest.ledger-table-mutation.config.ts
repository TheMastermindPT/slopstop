import { defineConfig } from "vitest/config";
import { errorEqualitySetup } from "./vitest.setup-files.js";

// The refusal table's static values, mutated with ignoreStatic off (Pedro, p3-s3 V3).
export default defineConfig({
  test: {
    name: "ledger-table-mutation",
    environment: "node",
    setupFiles: [errorEqualitySetup],
    include: ["apps/harness/src/storage/canonical-ledger-refusal.test.ts"],
  },
});
