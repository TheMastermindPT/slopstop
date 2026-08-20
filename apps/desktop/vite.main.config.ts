import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];

export default defineConfig({
  build: {
    lib: {
      entry: "src/main/main.ts",
      fileName: () => "main.cjs",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["electron", "@sentry/electron", ...nodeBuiltins],
    },
  },
});
