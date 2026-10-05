import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "desktop-integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 15_000,
    maxWorkers: "50%",
    sequence: { groupOrder: 0 },
  },
});
