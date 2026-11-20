import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Port Foundation scoped mutation (rigorous lane): the tests of the logic pf-s2 changed. Every
// project keeps Vitest's default per-file isolation, whatever the unit projects use.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "port-foundation-mutation-main",
          environment: "node",
          include: [
            "apps/desktop/src/main/window-chrome.test.ts",
            "apps/desktop/src/main/application-menu.test.ts",
            "apps/desktop/src/main/menu-keys-package-smoke.test.ts",
            "apps/desktop/src/main/desktop-runtime.test.ts",
            "apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            react: path.resolve(import.meta.dirname, "../../node_modules/react"),
            "react-dom": path.resolve(import.meta.dirname, "../../node_modules/react-dom"),
          },
          dedupe: ["react", "react-dom"],
        },
        test: {
          name: "port-foundation-mutation-renderer",
          environment: "happy-dom",
          include: ["apps/desktop/src/renderer/shell/title-bar.test.tsx"],
          setupFiles: ["apps/desktop/src/renderer/test-setup.ts"],
        },
      },
    ],
  },
});
