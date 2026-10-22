import { defineConfig } from "vitest/config";

// #123 s6 scoped mutation (rigorous lane, D13): the s6 seams' tests only.
export default defineConfig({
  test: {
    name: "desktop-s6-mutation",
    environment: "node",
    include: [
      "apps/desktop/src/main/desktop-shutdown.test.ts",
      "apps/desktop/src/main/desktop-runtime.test.ts",
      "apps/desktop/src/main/project-entry-ipc.test.ts",
      "apps/desktop/src/main/project-registration-ipc.test.ts",
      "apps/desktop/src/main/workspace-bridge.test.ts",
      "apps/desktop/src/main/canonical-writer-package-smoke.test.ts",
      "apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts",
    ],
  },
});
