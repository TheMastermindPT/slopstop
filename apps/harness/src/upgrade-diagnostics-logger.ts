import { harnessUpgradeLogEvents } from "@slopstop/protocol";
import type { ProjectStorageUpgradeDiagnostics } from "./storage/project-storage-upgrade.js";

/** The two log levels upgrade diagnostics use; each call takes one structured object. */
export type UpgradeEventLogger = Readonly<{
  info(object: Readonly<Record<string, unknown>>): void;
  warn(object: Readonly<Record<string, unknown>>): void;
}>;

/**
 * Writes upgrade diagnostics as structured log objects: ids and a class only, never a path,
 * a message argument or any other value.
 */
export function createUpgradeDiagnosticsLogger(
  logger: UpgradeEventLogger,
): ProjectStorageUpgradeDiagnostics {
  return {
    abandoned: ({ projectId, upgradeId, reason }) =>
      logger.info({ event: harnessUpgradeLogEvents.abandoned, projectId, upgradeId, reason }),
    discardFailed: ({ projectId, upgradeId, cause }) =>
      logger.warn({ event: harnessUpgradeLogEvents.discardFailed, projectId, upgradeId, cause }),
  };
}
