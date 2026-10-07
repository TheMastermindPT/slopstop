import type { ProjectId } from "@slopstop/protocol";
import { Data, Effect, Result } from "effect";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
} from "./project-storage-errors.js";
import { isBusyStorageError } from "./project-storage-node-errors.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";
import {
  ProjectStorageUpgradeBusyError,
  type UnfinishedUpgrade,
  type UpgradeAbandonedEvent,
} from "./project-storage-upgrade.js";

export type DiscardOutcome = "none" | "discarded" | "unproven";

type DiscardDependencies = Pick<ProjectStorageStoreDependencies, "upgrades" | "files">;

/** Proving that the leftovers belong to the unfinished upgrade failed. */
class DiscardProofFailed extends Data.TaggedError("DiscardProofFailed")<{
  readonly cause: unknown;
}> {}
/** Removing the upgrade's output directories failed. */
class DiscardRemovalFailed extends Data.TaggedError("DiscardRemovalFailed")<{
  readonly cause: unknown;
}> {}
/** Releasing the marker and the target row failed. */
class DiscardReleaseFailed extends Data.TaggedError("DiscardReleaseFailed")<{
  readonly cause: unknown;
}> {}

type DiscardStepError = DiscardProofFailed | DiscardRemovalFailed | DiscardReleaseFailed;

function discardProgram(
  upgrade: UnfinishedUpgrade,
  dependencies: DiscardDependencies,
): Effect.Effect<Exclude<DiscardOutcome, "none">, DiscardStepError> {
  return Effect.gen(function* () {
    const proof = yield* Effect.tryPromise({
      try: () => dependencies.upgrades.proveUnfinished(upgrade),
      catch: (cause) => new DiscardProofFailed({ cause }),
    });
    if (proof.status === "unproven") return "unproven" as const;
    yield* Effect.tryPromise({
      try: () =>
        dependencies.files.removeUpgradeOutput({
          projectId: upgrade.projectId,
          targetGenerationId: upgrade.targetGenerationId,
          activeGenerationId: upgrade.sourceGenerationId,
          retainedGenerationIds: proof.retainedGenerationIds,
        }),
      catch: (cause) => new DiscardRemovalFailed({ cause }),
    });
    yield* Effect.tryPromise({
      try: () => dependencies.upgrades.releaseUnfinished(upgrade),
      catch: (cause) => new DiscardReleaseFailed({ cause }),
    });
    return "discarded" as const;
  });
}

/** The error the caller answers with: busy, broken, or a client initialization failure as is. */
function failureError(cause: unknown, kind: "busy" | "broken"): Error {
  if (cause instanceof ProjectStorageApplicationClientInitializationError) return cause;
  if (kind === "busy") {
    return new ProjectStorageUpgradeBusyError({ cause });
  }
  return cause instanceof ProjectStorageBrokenError
    ? cause
    : new ProjectStorageBrokenError("Project Storage upgrade discard failed.", { cause });
}

/** Reports through the diagnostics port; a failing port never changes the discard's outcome. */
function reportSafely(report: () => void): void {
  try {
    report();
  } catch {
    // Diagnostics are best effort: the outcome the caller answers with stays the discard's own.
  }
}

/**
 * Discards a known unfinished upgrade: proves its leftovers, removes its output directories,
 * then releases its marker and target row. Unproven leftovers stay untouched; a busy discard
 * throws `ProjectStorageUpgradeBusyError`, a client initialization failure is rethrown as is,
 * and any other failure throws `ProjectStorageBrokenError`, each reported through the
 * diagnostics port first.
 */
export async function discardKnownUpgrade(
  upgrade: UnfinishedUpgrade,
  reason: UpgradeAbandonedEvent["reason"],
  dependencies: DiscardDependencies,
): Promise<Exclude<DiscardOutcome, "none">> {
  const { upgrades } = dependencies;
  const report = { projectId: upgrade.projectId, upgradeId: upgrade.upgradeId };
  const outcome = await Effect.runPromise(Effect.result(discardProgram(upgrade, dependencies)));
  if (Result.isSuccess(outcome)) {
    if (outcome.success === "discarded")
      reportSafely(() => upgrades.abandoned({ ...report, reason }));
    else reportSafely(() => upgrades.discardFailed({ ...report, cause: "unproven" }));
    return outcome.success;
  }
  const { cause } = outcome.failure;
  const kind = isBusyStorageError({ error: cause }) ? "busy" : "broken";
  reportSafely(() => upgrades.discardFailed({ ...report, cause: kind }));
  throw failureError(cause, kind);
}

/** Discards the Project's unfinished upgrade, if its registry holds one; see `discardKnownUpgrade`. */
export async function discardUnfinishedUpgrade(
  projectId: ProjectId,
  reason: UpgradeAbandonedEvent["reason"],
  dependencies: DiscardDependencies,
): Promise<DiscardOutcome> {
  const upgrade = await dependencies.upgrades.findUnfinished(projectId);
  if (upgrade === undefined) return "none";
  return discardKnownUpgrade(upgrade, reason, dependencies);
}
