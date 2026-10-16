import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "desktop-main",
    environment: "node",
    include: [
      "src/main/**/*.test.ts",
      "src/preload/**/*.test.ts",
      "src/shared/**/*.test.ts",
      "build/**/*.test.ts",
      // The packaged-smoke load-order guard lives with the smoke; Playwright skips this file.
      "tests/e2e/package-smoke-load-order.test.mjs",
    ],
  },
});
