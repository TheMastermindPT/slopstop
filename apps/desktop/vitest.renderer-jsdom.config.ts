import { jsdomRendererFiles, rendererProject } from "./vitest.config.js";

/** The renderer test files that need jsdom (the list and reasons live in `vitest.config.ts`). */
export default rendererProject({
  name: "desktop-renderer-jsdom",
  environment: "jsdom",
  include: jsdomRendererFiles,
});
