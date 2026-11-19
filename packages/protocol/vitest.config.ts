import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "protocol",
    environment: "node",
    pool: "threads",
    // Not isolated: it passed two runs in a row without isolation (test-speed item 3).
    isolate: false,
    include: ["src/**/*.test.ts"],
  },
});
