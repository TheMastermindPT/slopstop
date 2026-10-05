import type { ProjectId, ProjectListResult, RegistrationCapability } from "@slopstop/protocol";
import { useEffect, useState } from "react";
import type { FlowHost } from "./add-repository/use-add-repository.js";
import { projectName } from "./projects-list.js";

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

/** The add flow's host: focus targets in the document plus the workspace's own actions. */
export function workspaceFlowHost(
  actions: Pick<FlowHost, "registered" | "open" | "announce">,
): FlowHost {
  return {
    ...actions,
    focusAdd: () => document.getElementById("add-repository")?.focus(),
    show: (projectId: ProjectId) =>
      document.querySelector<HTMLButtonElement>(`[data-project="${projectId}"]`)?.focus(),
  };
}
