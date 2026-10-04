import type { Plugin } from "vite";

// Forge marks a target built in its own `closeBundle`, which runs in parallel with other
// plugins' `closeBundle`. Staging in `writeBundle` completes before any `closeBundle` starts,
// because the build awaits every `writeBundle` before closing the bundle.
export function harnessRuntimeStagingPlugin(stage: () => Promise<void>): Plugin {
  return {
    name: "stage-harness-runtime",
    async writeBundle() {
      await stage();
    },
  };
}
