declare module "@electron-forge/plugin-auto-unpack-natives" {
  import type {
    ForgeMultiHookMap,
    IForgePlugin,
    ResolvedForgeConfig,
  } from "@electron-forge/shared-types";

  type AutoUnpackNativesPluginConfig = Record<string, never>;

  export class AutoUnpackNativesPlugin implements IForgePlugin {
    readonly __isElectronForgePlugin: true;
    readonly name: "auto-unpack-natives";
    constructor(config: AutoUnpackNativesPluginConfig);
    init(directory: string, forgeConfig: ResolvedForgeConfig): void;
    getHooks(): ForgeMultiHookMap;
  }
}
