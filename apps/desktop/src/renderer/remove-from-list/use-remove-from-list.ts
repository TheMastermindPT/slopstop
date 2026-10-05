import type { ProjectId, ProjectRegistrationResult } from "@slopstop/protocol";
import { useRef, useState } from "react";

export type RemovalTarget = Readonly<{ projectId: ProjectId; name: string }>;

export type RemovalFailure = Readonly<{
  tone: "warn" | "error";
  word: string;
  title: string;
  body: string;
  nothing?: string;
  retry: boolean;
  reference: string;
}>;

export type RemovalScreen =
  | Readonly<{ kind: "idle"; note?: string }>
  | Readonly<{ kind: "confirm"; target: RemovalTarget; busy: boolean }>
  | Readonly<{ kind: "failure"; target: RemovalTarget; failure: RemovalFailure }>;

export type RemovalHost = Readonly<{
  /** The visible Projects in list order, read before the list changes. */
  visibleOrder(): readonly ProjectId[];
  refresh(): Promise<void>;
  focusProject(projectId: ProjectId): void;
  focusRemove(projectId: ProjectId): void;
  focusAdd(): void;
  announce(message: string): void;
}>;

const damagedRegistry = new Set([
  "REGISTRY_CORRUPT",
  "REGISTRY_SCHEMA_UNKNOWN",
  "REGISTRY_SCHEMA_NEWER",
]);

/** Why a removal did not happen; busy and damaged registries stay distinct. */
function removalFailure(result: ProjectRegistrationResult, name: string): RemovalFailure {
  const code = "code" in result ? result.code : result.status;
  if (code === "REGISTRY_BUSY")
    return {
      tone: "warn",
      word: "Busy",
      title: `${name} wasn't removed`,
      body: "Another Ragnarok window is updating your Projects. Wait a moment, then try again.",
      nothing: "Your list was not changed.",
      retry: true,
      reference: code,
    };
  if (damagedRegistry.has(code))
    return {
      tone: "error",
      word: "Not removed",
      title: "Saved Projects can't be updated",
      body: `${name} is still in your list. The Project registry is damaged or was written by a newer Ragnarok, so nothing was removed, changed or reset.`,
      retry: false,
      reference: code,
    };
  return {
    tone: "error",
    word: "Not removed",
    title: `${name} wasn't removed`,
    body: "Ragnarok couldn't remove it from the list.",
    nothing: "Your list was not changed.",
    retry: false,
    reference: code,
  };
}

// After hiding, focus the next visible Project, else the previous one, else Add.
function neighbour(order: readonly ProjectId[], removed: ProjectId): ProjectId | undefined {
  const index = order.indexOf(removed);
  return order[index + 1] ?? order[index - 1];
}

/** Remove from list (option A): confirm in the workspace, then hide the Project. */
export function useRemoveFromList(host: RemovalHost) {
  const [screen, setScreen] = useState<RemovalScreen>({ kind: "idle" });
  const run = useRef(0);

  const ask = (target: RemovalTarget) => {
    run.current += 1;
    setScreen({ kind: "confirm", target, busy: false });
  };

  const back = (target: RemovalTarget) => {
    run.current += 1;
    setScreen({ kind: "idle" });
    host.focusRemove(target.projectId);
  };

  const succeed = async (target: RemovalTarget) => {
    const next = neighbour(host.visibleOrder(), target.projectId);
    const note = `${target.name} was removed from the list. Its data is still saved; adding its folder again brings it back.`;
    setScreen({ kind: "idle", note });
    host.announce(note);
    await host.refresh();
    if (next === undefined) host.focusAdd();
    else host.focusProject(next);
  };

  const remove = (target: RemovalTarget) => {
    const token = ++run.current;
    setScreen({ kind: "confirm", target, busy: true });
    void window.slopstop
      .registerProject({ step: "remove-from-list", projectId: target.projectId })
      .then((result) => {
        if (token !== run.current) return;
        if (result.status === "removed") {
          void succeed(target);
          return;
        }
        const failure = removalFailure(result, target.name);
        setScreen({ kind: "failure", target, failure });
        host.announce(`${failure.word}. ${failure.title}`);
      });
  };

  return { screen, ask, back, remove };
}
