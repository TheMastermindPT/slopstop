import { defineConfig } from "vitest/config";
import { errorEqualitySetup } from "./vitest.setup-files.js";

// The Canonical ledger readers and their refusal table (p3-s3). The ledger integration files
// drive real SQLite settlements, hence the integration timeout.
export default defineConfig({
  test: {
    name: "ledger-mutation",
    environment: "node",
    setupFiles: [errorEqualitySetup],
    testTimeout: 15_000,
    include: [
      "apps/harness/src/storage/canonical-ledger-refusal.test.ts",
      "apps/harness/tests/integration/canonical-command-repository.integration.test.ts",
      "apps/harness/tests/integration/canonical-command-repository-faults.integration.test.ts",
      "apps/harness/tests/integration/canonical-command-fence.integration.test.ts",
      "apps/harness/tests/integration/canonical-writer-reconciliation.integration.test.ts",
      "apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts",
      "apps/harness/tests/integration/canonical-project-settlement.integration.test.ts",
      "apps/harness/tests/integration/canonical-command-driver.integration.test.ts",
    ],
  },
});
