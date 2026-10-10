import { defineConfig } from "vitest/config";

// The Conversation store, the writer's slot queue and the shared busy predicate (R2-C13). The
// busy and uncertain-commit files wait on real SQLite locks, hence the native-long timeout.
export default defineConfig({
  test: {
    name: "conversation-mutation",
    environment: "node",
    testTimeout: 15_000,
    include: [
      "apps/harness/src/storage/sqlite-busy.test.ts",
      "apps/harness/src/canonical-project-writer.test.ts",
      "apps/harness/tests/integration/conversation-store.integration.test.ts",
      "apps/harness/tests/integration/conversation-writer-serialization.integration.test.ts",
      "apps/harness/tests/integration/conversation-store-busy.integration.test.ts",
      "apps/harness/tests/integration/conversation-uncertain-commit.integration.test.ts",
    ],
  },
});
