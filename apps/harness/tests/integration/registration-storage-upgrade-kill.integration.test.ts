import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generationPaths } from "./project-storage-open-fixture.js";
import {
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  pathExists,
  projectStorageIntegrationTimeout,
} from "./project-storage-runtime-fixture.js";
import { upgradePaths } from "./project-storage-upgrade-faults.js";
import { createGenerationTwoProject } from "./project-storage-upgrade-fixture.js";
import {
  abandonedEvent,
  entriesOf,
  expectDiscardedUpgrade,
  expectMigrationRequiredOnSource,
  expectRetryUpgrades,
  sourceFileHashes,
} from "./project-storage-upgrade-recovery-fixture.js";

type ProjectRoot = Readonly<{ root: string }>;

/** Runs `upgrade` in a peer process and kills it once it reports reaching `checkpoint`. */
async function killUpgradeAt({ root }: ProjectRoot, checkpoint: string): Promise<number> {
  const started = Date.now();
  const child = spawn(
    process.execPath,
    [
      "--experimental-transform-types",
      fileURLToPath(new URL("./project-storage-upgrade-peer.mjs", import.meta.url)),
      root,
      path.resolve(import.meta.dirname, "../../drizzle"),
      checkpoint,
    ],
    { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true },
  );
  let diagnostic = "";
  child.stderr?.on("data", (data: Buffer) => {
    diagnostic += data.toString();
  });
  const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
  try {
    const message = await new Promise<unknown>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => reject(new Error(`Upgrade peer exited early: ${diagnostic}`)));
      child.once("message", resolve);
    });
    expect(message).toEqual({ kind: "checkpoint", point: checkpoint });
  } finally {
    // This ChildProcess was created here; never select an arbitrary PID or image.
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  }
  return Date.now() - started;
}

const killPoints = [
  { name: "after the backup is copied", checkpoint: "after-backup-copied", firstCall: "open" },
  {
    name: "after the generation is renamed",
    checkpoint: "after-generation-rename",
    firstCall: "open",
  },
  { name: "inside the switch transaction", checkpoint: "during-upgrade-switch", firstCall: "open" },
  {
    name: "after the generation is renamed, recovered by upgrade",
    checkpoint: "after-generation-rename",
    firstCall: "upgrade",
  },
] as const;

it.for(killPoints)(
  "discards an upgrade interrupted by a process kill: $name",
  { timeout: projectStorageIntegrationTimeout },
  async (point) => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    const sourceHashes = await sourceFileHashes({ root });
    const killedAfterMs = await killUpgradeAt({ root }, point.checkpoint);
    const backup = await entriesOf({ directory: upgradePaths({ root }).backup });
    const fixture = createUpgradeStorageOwner(root, { attempt: 2 });
    const recoveryStarted = Date.now();
    try {
      if (point.firstCall === "open") {
        await expectMigrationRequiredOnSource(fixture.owner);
        expect(fixture.diagnostics).toEqual([abandonedEvent("interrupted")]);
        await expectDiscardedUpgrade({ root }, { sourceHashes, backup });
      }
      await expectRetryUpgrades(fixture);
      expect(fixture.diagnostics).toEqual([abandonedEvent("interrupted")]);
      await expect(pathExists(upgradePaths({ root }).backup)).resolves.toBe(true);
      await expect(pathExists(generationPaths(root).generation)).resolves.toBe(true);
    } finally {
      await fixture.owner.stop();
    }
    console.info(
      `kill at ${point.checkpoint}: peer ${killedAfterMs} ms, recovery ${Date.now() - recoveryStarted} ms`,
    );
  },
);
