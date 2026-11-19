import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineProject } from "vitest/config";

/**
 * Renderer test files that need jsdom; happy-dom runs the rest. Each entry names its reason.
 * `vitest.renderer-jsdom.config.ts` runs these files under jsdom.
 */
export const jsdomRendererFiles = [
  // Its banner selector `header:not(:is(article, aside, main, nav, section) header)`: happy-dom
  // 21 also matches a header nested inside a sectioning element, which jsdom and browsers do not.
  "src/renderer/app.test.tsx",
];

/** The renderer test project: React, the shared setup, one DOM environment. */
export function rendererProject(
  project: Readonly<{
    name: string;
    environment: "happy-dom" | "jsdom";
    include: string[];
    exclude?: string[];
  }>,
) {
  return defineProject({
    plugins: [react()],
    resolve: {
      alias: {
        react: path.resolve(import.meta.dirname, "../../node_modules/react"),
        "react-dom": path.resolve(import.meta.dirname, "../../node_modules/react-dom"),
      },
      dedupe: ["react", "react-dom"],
    },
    test: {
      name: project.name,
      environment: project.environment,
      include: project.include,
      exclude: [...configDefaults.exclude, ...(project.exclude ?? [])],
      setupFiles: ["src/renderer/test-setup.ts"],
    },
  });
}

export default rendererProject({
  name: "desktop-renderer",
  environment: "happy-dom",
  include: ["src/renderer/**/*.test.{ts,tsx}"],
  exclude: jsdomRendererFiles,
});
