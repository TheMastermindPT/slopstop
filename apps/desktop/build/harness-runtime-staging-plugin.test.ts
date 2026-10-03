import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build, type Plugin } from "vite";
import { afterEach, expect, it } from "vitest";
import { harnessRuntimeStagingPlugin } from "./harness-runtime-staging-plugin.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// Mirrors @electron-forge/plugin-vite: the target counts as built in its own `closeBundle`.
function forgeBuildDone(events: string[]): Plugin {
  return {
    name: "forge-build-done-probe",
    closeBundle() {
      events.push("build-done");
    },
  };
}

async function settleEventLoop(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve));
}

it("completes runtime staging before the build can be reported done", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "slopstop-staging-order-"));
  roots.push(root);
  await writeFile(path.join(root, "entry.js"), "export const value = 1;\n");
  const events: string[] = [];
  let releaseStage = (): void => undefined;
  let markStageStarted = (): void => undefined;
  const stageStarted = new Promise<void>((resolve) => {
    markStageStarted = resolve;
  });
  const stage = async (): Promise<void> => {
    events.push("stage-start");
    markStageStarted();
    await new Promise<void>((resolve) => {
      releaseStage = resolve;
    });
    events.push("stage-end");
  };

  const building = build({
    configFile: false,
    logLevel: "silent",
    root,
    plugins: [forgeBuildDone(events), harnessRuntimeStagingPlugin(stage)],
    build: {
      outDir: path.join(root, "out"),
      emptyOutDir: true,
      lib: { entry: path.join(root, "entry.js"), formats: ["cjs"], fileName: () => "entry.cjs" },
    },
  });

  await stageStarted;
  await settleEventLoop();
  expect(events).toEqual(["stage-start"]);

  releaseStage();
  await building;
  expect(events).toEqual(["stage-start", "stage-end", "build-done"]);
});
