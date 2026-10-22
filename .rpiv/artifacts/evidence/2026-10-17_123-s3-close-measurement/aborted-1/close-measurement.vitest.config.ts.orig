// Runs only the #123 s3 close measurement tool; see close-measurement.test.ts.
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "s3-close-measurement",
    environment: "node",
    include: ["close-measurement.test.ts"],
    fileParallelism: false,
  },
});
