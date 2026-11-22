module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-app-to-app-imports",
      severity: "error",
      from: { path: "^apps/desktop/" },
      to: { path: "^apps/harness/" },
    },
    {
      name: "no-harness-to-desktop-imports",
      severity: "error",
      from: { path: "^apps/harness/" },
      to: { path: "^apps/desktop/" },
    },
    {
      name: "desktop-does-not-import-kernel",
      severity: "error",
      from: { path: "^apps/desktop/" },
      to: { path: "^packages/kernel/" },
    },
    {
      name: "kernel-has-no-workspace-dependencies",
      severity: "error",
      from: { path: "^packages/kernel/" },
      to: { path: "^(apps/|packages/protocol/)" },
    },
    {
      name: "protocol-does-not-import-apps",
      severity: "error",
      from: { path: "^packages/protocol/" },
      to: { path: "^apps/" },
    },
    {
      name: "electron-is-desktop-only",
      severity: "error",
      from: { pathNot: "^apps/desktop/" },
      to: {
        dependencyTypes: ["npm"],
        path: "^(electron$|@electron/|@electron-forge/)",
      },
    },
    {
      name: "agent-and-storage-frameworks-are-harness-only",
      severity: "error",
      from: { pathNot: "^apps/harness/" },
      to: {
        dependencyTypes: ["npm"],
        path: "^(@mastra/|drizzle-orm$)",
      },
    },
    {
      // Q4 (a): the Electron entry only wires; nothing imports it. The smoke wiring test and the
      // keys proof's page test are the exceptions, because they load the real entry to prove what
      // main.ts itself registers.
      name: "no-import-of-electron-entry",
      severity: "error",
      from: {
        pathNot: [
          "^apps/desktop/src/main/canonical-writer-package-smoke-main\\.test\\.ts$",
          "^apps/desktop/src/main/menu-keys-proof-page-main\\.test\\.ts$",
        ],
      },
      to: { path: "^apps/desktop/src/main/main\\.ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(coverage|dist|node_modules|out|playwright-report|test-results)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      conditionNames: ["types", "import", "default"],
      exportsFields: ["exports"],
    },
  },
};
