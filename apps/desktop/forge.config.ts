import { fileURLToPath } from "node:url";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const packagedMigrationResources = fileURLToPath(
  new URL("./.vite/build/harness-migrations", import.meta.url),
);
const stagedMigrationResources = /^\/\.vite\/build\/harness-migrations(?:\/|$)/;

function ignorePackagedFile(file: string): boolean {
  if (!file) {
    return false;
  }

  return !file.startsWith("/.vite") || stagedMigrationResources.test(file);
}

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "dev.slopstop.desktop",
    asar: true,
    executableName: "SlopStop",
    extraResource: [packagedMigrationResources],
    ignore: ignorePackagedFile,
  },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "src/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          entry: { harness: "../harness/src/process-entry.ts" },
          config: "vite.harness.config.ts",
          target: "main",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
        {
          name: "prototype_window",
          config: "vite.prototype.config.ts",
        },
      ],
      concurrent: 2,
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
