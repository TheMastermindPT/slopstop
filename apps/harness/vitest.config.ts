import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "harness",
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
