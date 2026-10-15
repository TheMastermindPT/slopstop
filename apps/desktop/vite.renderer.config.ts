import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { contentSecurityPolicyMetaPlugin } from "./src/shared/content-security-policy.js";

export default defineConfig({
  plugins: [react(), contentSecurityPolicyMetaPlugin()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: {
    // A font inlined as a data: URL would be blocked by `font-src 'self'`; keep every face a file.
    assetsInlineLimit: (filePath) => (/\.woff2?$/.test(filePath) ? false : undefined),
  },
});
