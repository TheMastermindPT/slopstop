import { build } from "vite";

// Same Node entry resolution that Forge's main/preload targets supply.
const resolve = { conditions: ["node"], mainFields: ["module", "jsnext:main", "jsnext"] };

// Build the existing Electron targets without running a packaging/deep gate.
await build({
  resolve,
  configFile: "vite.main.config.ts",
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: "undefined",
    MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
    PROTOTYPE_WINDOW_VITE_DEV_SERVER_URL: "undefined",
    PROTOTYPE_WINDOW_VITE_NAME: JSON.stringify("prototype_window"),
  },
  build: { outDir: ".vite/build", emptyOutDir: false },
});
await build({
  resolve,
  configFile: "vite.preload.config.ts",
  build: { outDir: ".vite/build", emptyOutDir: false },
});
await build({ resolve, configFile: "vite.harness.config.ts" });
await build({
  configFile: "vite.renderer.config.ts",
  base: "./",
  build: { outDir: ".vite/renderer/main_window", emptyOutDir: true },
});
