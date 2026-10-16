import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "project-storage-mutation",
    environment: "node",
    // registration-bootstrap-guards spawns Git and harness children; its usual limit (decisions log §75).
    testTimeout: 15_000,
    include: [
      "packages/protocol/src/project-storage-protocol.test.ts",
      "apps/harness/src/process-fatal-diagnostics.test.ts",
      "apps/harness/src/storage/sqlite-schema-expression.test.ts",
      "apps/harness/src/storage/project-storage-node-adapters.test.ts",
      "apps/harness/tests/integration/project-storage-create.integration.test.ts",
      "apps/harness/src/storage/project-storage-upgrade-eligibility.test.ts",
      "apps/harness/src/storage/generated-migrations.test.ts",
      "apps/harness/src/storage/project-storage-manifest.test.ts",
      "apps/harness/src/storage/project-storage-store.test.ts",
      "apps/harness/tests/integration/project-storage-chained-upgrade.integration.test.ts",
      "apps/harness/tests/integration/project-storage-conversation-schema.integration.test.ts",
      "apps/harness/tests/integration/registration-project-upgrade.integration.test.ts",
      "apps/harness/tests/integration/registration-bootstrap-guards.integration.test.ts",
      "apps/harness/src/storage/application-database-migration.test.ts",
      "apps/harness/src/storage/project-storage-locks.test.ts",
      "apps/harness/src/storage/project-storage-locks-service.test.ts",
      "apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts",
      "apps/harness/tests/integration/registry-witness-race.integration.test.ts",
      "apps/harness/tests/integration/project-storage-node-adapters.integration.test.ts",
    ],
  },
});
