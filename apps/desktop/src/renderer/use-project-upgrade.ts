import {
  type CanonicalProjectActivationResult,
  type ProjectId,
  type ProjectUpgradeResult,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { Match } from "effect";
import { useCallback, useState } from "react";

/** What the progress line says while a Project is opened or updated. */
export type Busy = "opening" | "updating" | undefined;

type FailedUpgrade = Extract<ProjectUpgradeResult, { diagnostic: unknown }>;
/** A failed update: the result the panel explains, kept until something clears it. */
export type UpgradeProblem = Readonly<{ projectId: ProjectId; result: FailedUpgrade }>;

export type UpgradeFlowHost = Readonly<{
  isCurrent(generation: number): boolean;
  setBusy(busy: Busy): void;
  present(result: CanonicalProjectActivationResult): void;
  refresh(): void;
  notRegistered(): void;
}>;

/**
 * An opened Project whose canonical database must be updated before it can be used, and that
 * the harness can update: a runtime database that is not healthy refuses the upgrade, so the
 * window shows the safe-mode reason instead of asking.
 */
export function needsUpgrade(result: CanonicalProjectActivationResult): boolean {
  return canonicalNeedsMigration(result) && result.runtimeHealth.status === "healthy";
}

/** A safe-mode Project whose canonical database still needs migration, whatever its runtime. */
function canonicalNeedsMigration(
  result: CanonicalProjectActivationResult,
): result is Extract<CanonicalProjectActivationResult, { status: "safe-mode" }> {
  return result.status === "safe-mode" && result.canonicalHealth.status === "migration-required";
}

/**
 * The update flow after an open answered `migration-required`: one upgrade request, then one
 * follow-up activation. A failure becomes the panel's problem; a rejected call propagates to the
 * caller's open guard, and a result whose epoch is stale is dropped.
 */
export function useProjectUpgrade(host: UpgradeFlowHost) {
  const [problem, setProblem] = useState<UpgradeProblem | null>(null);

  async function activateAfterUpgrade(projectId: ProjectId, generation: number) {
    const activation = await window.slopstop.activateProject({ projectId });
    if (!host.isCurrent(generation)) return;
    host.present(activation);
    if (canonicalNeedsMigration(activation)) {
      // The harness said the upgrade succeeded, but the Project still needs it (G5, U7).
      const diagnostic = projectUpgradeDiagnostics.storageBroken;
      setProblem({ projectId, result: { status: "broken", request: { projectId }, diagnostic } });
    } else if (activation.status === "active") {
      host.refresh();
    }
  }

  async function update(projectId: ProjectId, generation: number) {
    host.setBusy("updating");
    const result = await window.slopstop.upgradeProject({ projectId });
    if (!host.isCurrent(generation)) return;
    await Match.value(result).pipe(
      Match.discriminators("status")({
        upgraded: () => activateAfterUpgrade(projectId, generation),
        "not-required": () => activateAfterUpgrade(projectId, generation),
        "not-registered": async () => host.notRegistered(),
      }),
      Match.orElse(async (failed) => setProblem({ projectId, result: failed })),
    );
  }

  const clear = useCallback(() => setProblem(null), []);
  return { problem, update, clear };
}
