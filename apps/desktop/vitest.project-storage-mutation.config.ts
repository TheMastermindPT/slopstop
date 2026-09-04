import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "project-storage-desktop-mutation",
    environment: "node",
    include: [
      "apps/desktop/src/main/harness-supervisor.test.ts",
      "apps/desktop/src/main/bounded-log-destination.test.ts",
      "apps/desktop/src/main/logger.test.ts",
      "apps/desktop/src/main/crash-reporting.test.ts",
      "apps/desktop/src/main/desktop-shutdown.test.ts",
    ],
  },
});
