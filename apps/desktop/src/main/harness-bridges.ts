import { type Clock, makeHarnessRequestCore } from "./harness-request-core.js";
import type { HarnessSessionClient } from "./harness-session.js";
import { type ProjectEntryBridge, projectEntryBridgeOver } from "./project-entry-bridge.js";
import {
  type ProjectStorageBridgeClient,
  projectStorageBridgeOver,
} from "./project-storage-bridge.js";
import { type WorkspaceBridgeClient, workspaceBridgeOver } from "./workspace-bridge.js";

export type HarnessBridgesInput = Readonly<{ session: HarnessSessionClient }> & Clock;

/** The three bridges over one session, and the release that ends them. */
export type HarnessBridges = Readonly<{
  projectEntry: ProjectEntryBridge;
  projectStorage: ProjectStorageBridgeClient;
  workspace: WorkspaceBridgeClient;
  release(): void;
}>;

/**
 * The three bridges over one shared request core, so the session has one subscription. A bridge's
 * own stop settles only its requests and leaves the core alone; `release()` stops the bridges
 * still running and then ends the core.
 */
export function createHarnessBridges(input: HarnessBridgesInput): HarnessBridges {
  // The core subscribes first; a failed subscribe leaves nothing behind.
  const core = makeHarnessRequestCore(input.session);
  const keepCore = () => {};
  const projectEntry = projectEntryBridgeOver(core, input, keepCore);
  const projectStorage = projectStorageBridgeOver(core, input, keepCore);
  const workspace = workspaceBridgeOver(core, input, keepCore);
  let released = false;
  return {
    projectEntry,
    projectStorage,
    workspace,
    release: () => {
      if (released) return;
      released = true;
      // Every step runs, each isolated; the first failure surfaces after all of them.
      const failures: unknown[] = [];
      for (const bridge of [projectStorage, workspace, projectEntry]) {
        try {
          bridge.stop();
        } catch (error) {
          failures.push(error);
        }
      }
      try {
        core.unsubscribe();
      } catch (error) {
        failures.push(error);
      } finally {
        core.failAll({ kind: "transport" });
      }
      if (failures.length > 0) throw failures[0];
    },
  };
}
