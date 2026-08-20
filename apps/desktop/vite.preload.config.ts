import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];

export default defineConfig({
  build: {
    lib: {
      entry: "src/preload/preload.ts",
      fileName: () => "preload.js",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["electron", ...nodeBuiltins],
    },
  },
});
