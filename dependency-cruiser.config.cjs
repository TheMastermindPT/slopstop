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
        path: "^(@mastra/|@libsql/client$|drizzle-orm$)",
      },
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
