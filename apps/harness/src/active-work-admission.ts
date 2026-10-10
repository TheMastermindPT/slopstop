import type { ProjectActivationId, ProjectId } from "@slopstop/protocol";

/** Why active work is refused before it reaches the writer. */
export type ActiveWorkRefusal =
  | "coordinator-unavailable"
  | "inactive"
  | "project-mismatch"
  | "stale-activation"
  | "read-only";

/** What admits work: commands and saves need write access, reads do not. */
export type ActiveWorkKind = "command" | "save" | "read";

/** The coordinator state admission reads: its lifecycle and, when active, the activation. */
export type AdmissionView<Activation> = Readonly<{
  pendingLifecycle: number;
  state:
    | Readonly<{ status: "active"; activation: Activation }>
    | Readonly<{ status: "inactive" | "activating" | "stopped" | "releasing" | "release-failed" }>;
}>;

type AdmittableActivation = Readonly<{
  projectId: ProjectId;
  activationId: ProjectActivationId;
  access: "read-write" | "read-only";
}>;

export type ActiveWorkAdmission<Activation> =
  | Readonly<{ status: "admitted"; activation: Activation }>
  | Readonly<{ status: "refused"; refusal: ActiveWorkRefusal }>;

/**
 * The synchronous admission checks shared by commands, saves and reads, in one refusal order:
 * a pending lifecycle, no active Project, another Project, a stale activation, then read-only
 * access for commands and saves.
 */
export function admitActiveWork<Activation extends AdmittableActivation>(
  view: AdmissionView<Activation>,
  request: Readonly<{ projectId: ProjectId; activationId: ProjectActivationId }>,
  kind: ActiveWorkKind,
): ActiveWorkAdmission<Activation> {
  const refused = (refusal: ActiveWorkRefusal) => ({ status: "refused", refusal }) as const;
  if (view.pendingLifecycle > 0) return refused("coordinator-unavailable");
  if (view.state.status === "inactive") return refused("inactive");
  if (view.state.status !== "active") return refused("coordinator-unavailable");
  const activation = view.state.activation;
  if (activation.projectId !== request.projectId) return refused("project-mismatch");
  if (activation.activationId !== request.activationId) return refused("stale-activation");
  if (kind !== "read" && activation.access === "read-only") return refused("read-only");
  return { status: "admitted", activation };
}
