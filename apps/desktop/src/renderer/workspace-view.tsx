import { MinusCircleIcon } from "@phosphor-icons/react";
import type { ProjectId } from "@slopstop/protocol";
import { AddRepositoryFlowView, flowRunning } from "./add-repository/flow-view.js";
import type { FlowScreen, useAddRepository } from "./add-repository/use-add-repository.js";
import styles from "./projects-workspace.module.css";
import { RemovalView } from "./remove-from-list/removal-view.js";
import type { RemovalScreen, useRemoveFromList } from "./remove-from-list/use-remove-from-list.js";

export type View = {
  projectId: ProjectId;
  name: string;
  label: string;
  mode: "active" | "safe-mode" | "release-failed";
} | null;

const removalRunning = (screen: RemovalScreen) => screen.kind === "confirm" && screen.busy;

// The latest note of what just happened: a removal, or what a cancelled add ran.
function idleNote(flow: FlowScreen, removal: RemovalScreen): string | undefined {
  const fromRemoval = removal.kind === "idle" ? removal.note : undefined;
  return fromRemoval ?? (flow.kind === "idle" ? flow.note : undefined);
}

/** The workspace region: the add-repository flow while it runs, otherwise the Project view. */
export function WorkspaceSection(
  props: Readonly<{
    flow: ReturnType<typeof useAddRepository>;
    removal: ReturnType<typeof useRemoveFromList>;
    view: View;
    error: string | null;
    busy: boolean;
  }>,
) {
  const { flow, removal } = props;
  const removing = removal.screen.kind !== "idle";
  return (
    <section
      className={styles["workspace"]}
      aria-label="Project workspace"
      aria-busy={props.busy || flowRunning(flow.screen) || removalRunning(removal.screen)}
    >
      {flow.screen.kind !== "idle" ? <AddRepositoryFlowView flow={flow} /> : null}
      {flow.screen.kind === "idle" && removing ? <RemovalView removal={removal} /> : null}
      {flow.screen.kind === "idle" && !removing ? (
        <WorkspaceView
          view={props.view}
          error={props.error}
          busy={props.busy}
          note={idleNote(flow.screen, removal.screen)}
        />
      ) : null}
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
