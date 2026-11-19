import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "kernel",
    environment: "node",
    pool: "threads",
    include: ["src/**/*.test.ts"],
  },
});
