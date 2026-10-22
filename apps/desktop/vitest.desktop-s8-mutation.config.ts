import { defineConfig } from "vitest/config";

// #123 s8 scoped mutation (normal lane): the supervisor's stop and output tests only.
export default defineConfig({
  test: {
    name: "desktop-s8-mutation",
    environment: "node",
    include: ["apps/desktop/src/main/harness-supervisor.test.ts"],
  },
});
