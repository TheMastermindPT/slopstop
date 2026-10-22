import { defineConfig } from "vitest/config";

// #123 s7 scoped mutation (rigorous lane, D13): the s7 seams' tests only.
export default defineConfig({
  test: {
    name: "desktop-s7-mutation",
    environment: "node",
    include: [
      "apps/desktop/src/main/harness-request-core.test.ts",
      "apps/desktop/src/main/harness-bridges.test.ts",
      "apps/desktop/src/main/project-entry-bridge.test.ts",
      "apps/desktop/src/main/project-storage-bridge.test.ts",
      "apps/desktop/src/main/workspace-bridge.test.ts",
      "apps/desktop/src/main/harness-session.test.ts",
      "apps/desktop/src/main/harness-supervisor.test.ts",
      "apps/desktop/src/main/desktop-runtime.test.ts",
      "apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts",
      "apps/desktop/src/main/project-entry-ipc.test.ts",
      "apps/desktop/src/main/project-registration-ipc.test.ts",
    ],
  },
});
