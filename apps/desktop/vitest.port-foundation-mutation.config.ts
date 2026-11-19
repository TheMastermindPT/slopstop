import { defineConfig } from "vitest/config";

// Port Foundation pf-s2 scoped mutation (rigorous lane): the window chrome and menu tests only.
export default defineConfig({
  test: {
    name: "port-foundation-mutation",
    environment: "node",
    include: [
      "apps/desktop/src/main/window-chrome.test.ts",
      "apps/desktop/src/main/application-menu.test.ts",
    ],
  },
});
