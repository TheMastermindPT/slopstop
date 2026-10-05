import { MinusCircleIcon } from "@phosphor-icons/react";
import type { ProjectId } from "@slopstop/protocol";
import { AddRepositoryFlowView, flowRunning } from "./add-repository/flow-view.js";
import type { useAddRepository } from "./add-repository/use-add-repository.js";
import styles from "./projects-workspace.module.css";

export type View = {
  projectId: ProjectId;
  name: string;
  label: string;
  mode: "active" | "safe-mode" | "release-failed";
} | null;

/** The workspace region: the add-repository flow while it runs, otherwise the Project view. */
export function WorkspaceSection(
  props: Readonly<{
    flow: ReturnType<typeof useAddRepository>;
    view: View;
    error: string | null;
    busy: boolean;
  }>,
) {
  const { flow } = props;
  return (
    <section
      className={styles["workspace"]}
      aria-label="Project workspace"
      aria-busy={props.busy || flowRunning(flow.screen)}
    >
      {flow.screen.kind === "idle" ? (
        <WorkspaceView
          view={props.view}
          error={props.error}
          busy={props.busy}
          note={flow.screen.note}
        />
      ) : (
        <AddRepositoryFlowView flow={flow} />
      )}
    </section>
  );
}

/** The workspace outside the add flow: the opened Project, or a prompt to choose one. */
function WorkspaceView(
  props: Readonly<{ view: View; error: string | null; busy: boolean; note: string | undefined }>,
) {
  const { view } = props;
  return (
    <>
      {props.note === undefined ? null : (
        <p className={styles["cancelNote"]} role="status">
          <MinusCircleIcon size={16} aria-hidden="true" />
          {props.note}
        </p>
      )}
      {props.error ? (
        <p className={styles["error"]} role="alert">
          {props.error}
        </p>
      ) : null}
      {props.busy ? <p aria-live="polite">Opening Project…</p> : null}
      <h2 id="ws-heading" tabIndex={-1}>
        {view === null ? "No Project selected" : `Project ${view.name}`}
      </h2>
      {view === null ? (
        <p>
          Choose a saved Project to open it, or add an existing repository. Access is checked when
          you open a Project.
        </p>
      ) : (
        <>
          <code>{view.projectId}</code>
          <p className={styles["access"]}>{view.label}</p>
          <p>
            {view.mode === "active"
              ? "Project identity and local Storage are connected. Conversation and repository registration controls are not available in this view yet."
              : "Writes unavailable. Storage needs attention before this Project can be used."}
          </p>
        </>
      )}
    </>
  );
}
