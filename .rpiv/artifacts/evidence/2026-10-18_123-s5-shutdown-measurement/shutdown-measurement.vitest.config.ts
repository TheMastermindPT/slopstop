// Runs only the #123 s5 shutdown measurement tool; see shutdown-measurement.test.ts.
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "s5-shutdown-measurement",
    environment: "node",
    include: ["shutdown-measurement.test.ts"],
    fileParallelism: false,
  },
});
