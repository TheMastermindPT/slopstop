import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(import.meta.dirname, "../../node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "../../node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    name: "desktop-renderer",
    environment: "jsdom",
    include: ["src/renderer/**/*.test.{ts,tsx}"],
    setupFiles: ["src/renderer/test-setup.ts"],
  },
});
