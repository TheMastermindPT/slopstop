import { defineConfig } from "vitest/config";
import { jsdomRendererFiles, rendererReact } from "./vitest.config.js";

/**
 * The Shell's scoped mutation run (`stryker.shell.config.json`): the tests of the Shell's renderer
 * files and of the main-process files sh-s6 changed. Stryker runs from the repository's root, so
 * every path here is written from it; the jsdom list comes from its owner in `vitest.config.ts`.
 * Every project keeps Vitest's default per-file isolation.
 */
const desktop = (file: string) => `apps/desktop/${file}`;
const setupFiles = [desktop("src/renderer/test-setup.ts")];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "shell-mutation-main",
          environment: "node",
          include: [
            "zoom-floor.test.ts",
            "zoom-keys.test.ts",
            "menu-keys-package-smoke.test.ts",
            "application-menu.test.ts",
            "canonical-writer-package-smoke-main.test.ts",
          ].map((file) => desktop(`src/main/${file}`)),
        },
      },
      {
        ...rendererReact,
        test: {
          name: "shell-mutation-renderer",
          environment: "happy-dom",
          include: [
            "title-bar.test.tsx",
            "rail.test.tsx",
            "harness-strip.test.tsx",
            "attention-sidebar.test.tsx",
            "focus-headings.test.ts",
          ].map((file) => desktop(`src/renderer/shell/${file}`)),
          setupFiles,
        },
      },
      {
        ...rendererReact,
        test: {
          name: "shell-mutation-renderer-jsdom",
          environment: "jsdom",
          include: jsdomRendererFiles.map(desktop),
          setupFiles,
        },
      },
    ],
  },
});
