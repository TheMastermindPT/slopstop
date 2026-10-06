import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "project-storage-mutation",
    environment: "node",
    include: [
      "packages/protocol/src/project-storage-protocol.test.ts",
      "apps/harness/src/process-fatal-diagnostics.test.ts",
      "apps/harness/src/storage/sqlite-schema-expression.test.ts",
      "apps/harness/src/storage/project-storage-node-adapters.test.ts",
      "apps/harness/tests/integration/project-storage-create.integration.test.ts",
      "apps/harness/src/storage/project-storage-upgrade-eligibility.test.ts",
      "apps/harness/src/storage/generated-migrations.test.ts",
      "apps/harness/src/storage/project-storage-manifest.test.ts",
    ],
  },
});
