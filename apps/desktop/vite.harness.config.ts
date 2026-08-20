import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];

export default defineConfig({
  build: {
    lib: {
      entry: { harness: "../harness/src/process-entry.ts" },
      fileName: () => "harness.cjs",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: nodeBuiltins,
    },
  },
});
