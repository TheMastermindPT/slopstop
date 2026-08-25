import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/renderer/prototype",
  build: {
    outDir: path.resolve(".vite/renderer/prototype_window"),
  },
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
