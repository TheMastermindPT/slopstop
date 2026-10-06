import {
  type ProjectUpgradeRequest,
  type ProjectUpgradeResult,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import type { ProjectStorageUpgradeOutcome } from "./storage/project-storage-upgrade.js";

const rows = projectUpgradeDiagnostics;
const refusals = {
  [rows.unsupported.code]: rows.unsupported,
  [rows.notEligible.code]: rows.notEligible,
} as const;
const failures = {
  [rows.backupInvalid.code]: rows.backupInvalid,
  [rows.verificationFailed.code]: rows.verificationFailed,
} as const;

/** The protocol result of a storage upgrade outcome, with each diagnostic's exact row. */
export function projectUpgradeResult(
  request: ProjectUpgradeRequest,
  outcome: ProjectStorageUpgradeOutcome,
): ProjectUpgradeResult {
  if (outcome.status !== "ready") {
    return outcome.status === "unavailable"
      ? { status: "unavailable", request, diagnostic: rows.storageUnavailable }
      : { status: "broken", request, diagnostic: rows.storageBroken };
  }
  const result = outcome.result;
  switch (result.status) {
    case "upgraded":
      return {
        status: "upgraded",
        request,
        sourceGenerationId: result.sourceGenerationId,
        generationId: result.generationId,
        upgradeId: result.upgradeId,
      };
    case "not-required":
    case "not-registered":
      return { status: result.status, request };
    case "refused":
      return { status: "refused", request, diagnostic: refusals[result.diagnostic.code] };
    case "failed":
      return { status: "failed", request, diagnostic: failures[result.diagnostic.code] };
  }
}

/** The answer to an upgrade the coordinator does not pass to storage. */
export function coordinatorUpgradeRefusal(
  request: ProjectUpgradeRequest,
  reason: "stopped" | "holding",
): ProjectUpgradeResult {
  return reason === "stopped"
    ? { status: "unavailable", request, diagnostic: rows.coordinatorStopped }
    : { status: "rejected", request, diagnostic: rows.alreadyActive };
}
