import type { ProjectId, ProjectListResult, RegistrationCapability } from "@slopstop/protocol";
import { useEffect, useState } from "react";
import type { FlowHost } from "./add-repository/use-add-repository.js";
import { projectName } from "./projects-list.js";
import type { RemovalHost } from "./remove-from-list/use-remove-from-list.js";

/** Keeps each listed Project's name so the opened view can show it. */
export function rememberNames(names: Map<ProjectId, string>, result: ProjectListResult) {
  if (result.status !== "listed") return;
  for (const project of result.projects) names.set(project.projectId, projectName(project));
}

/** Whether this platform can add repositories, read once per harness connection. */
export function useRegistrationCapability(ready: boolean, attempt: number) {
  const [capability, setCapability] = useState<RegistrationCapability>({ status: "available" });
  useEffect(() => {
    if (!ready) return;
    let current = true;
    void window.slopstop.getRegistrationCapability().then(
      (value) => current && setCapability(value),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [ready, attempt]);
  return capability;
}

/** Makes the Projects sidebar current, so the controls a flow hands focus back to are there. */
type ShowProjects = Readonly<{ showProjects: () => void }>;

/** Focuses the first element matching `selector`, after making the Projects sidebar current. */
const focusInProjects = (actions: ShowProjects, selector: string) => {
  actions.showProjects();
  document.querySelector<HTMLElement>(selector)?.focus();
};

/** The removal's host: focus targets in the document plus the workspace's list. */
export function workspaceRemovalHost(
  actions: Pick<RemovalHost, "visibleOrder" | "refresh" | "announce"> & ShowProjects,
): RemovalHost {
  const { showProjects: _, ...rest } = actions;
  return {
    ...rest,
    focusAdd: () => focusInProjects(actions, "#add-repository"),
    focusProject: (projectId: ProjectId) =>
      focusInProjects(actions, `[data-project="${projectId}"]`),
    focusRemove: (projectId: ProjectId) => focusInProjects(actions, `[data-remove="${projectId}"]`),
  };
}

/** The add flow's host: focus targets in the document plus the workspace's own actions. */
export function workspaceFlowHost(
  actions: Pick<FlowHost, "registered" | "restored" | "open" | "announce"> & ShowProjects,
): FlowHost {
  const { showProjects: _, ...rest } = actions;
  return {
    ...rest,
    focusAdd: () => focusInProjects(actions, "#add-repository"),
    show: (projectId: ProjectId) => focusInProjects(actions, `[data-project="${projectId}"]`),
  };
}
