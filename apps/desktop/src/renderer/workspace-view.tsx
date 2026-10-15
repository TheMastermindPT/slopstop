import { MinusCircleIcon } from "@phosphor-icons/react";
import type { ProjectActivationId, ProjectId } from "@slopstop/protocol";
import type { ReactNode } from "react";
import { AddRepositoryFlowView, flowRunning } from "./add-repository/flow-view.js";
import type { FlowScreen, useAddRepository } from "./add-repository/use-add-repository.js";
import { ConversationRegion } from "./conversation/conversation-region.js";
import styles from "./projects-workspace.module.css";
import { RemovalView } from "./remove-from-list/removal-view.js";
import type { RemovalScreen, useRemoveFromList } from "./remove-from-list/use-remove-from-list.js";
import theme from "./theme/seixo.module.css";
import { UpgradeProblem } from "./upgrade-problem.js";
import type { UpgradeProblem as Problem } from "./use-project-upgrade.js";

export type View = {
  projectId: ProjectId;
  name: string;
  label: string;
  mode: "active" | "safe-mode" | "release-failed";
  /** The current activation and its access, present only for an active Project. */
  activationId?: ProjectActivationId;
  readOnly?: boolean;
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
    problem: Problem | null;
    onRetry(projectId: ProjectId): void;
  }>,
) {
  const { flow, removal } = props;
  const removing = removal.screen.kind !== "idle";
  const idle = flow.screen.kind === "idle" && !removing;
  const regionShown = idle && props.view?.mode === "active";
  return (
    <section
      className={
        regionShown ? `${styles["workspace"]} ${styles["regionShown"]}` : styles["workspace"]
      }
      aria-label="Project workspace"
      aria-busy={props.busy || flowRunning(flow.screen) || removalRunning(removal.screen)}
    >
      {flow.screen.kind !== "idle" ? <AddRepositoryFlowView flow={flow} /> : null}
      {flow.screen.kind === "idle" && removing ? <RemovalView removal={removal} /> : null}
      {idle ? (
        <WorkspaceView
          view={props.view}
          error={props.error}
          note={idleNote(flow.screen, removal.screen)}
          problem={props.problem}
          onRetry={props.onRetry}
        />
      ) : null}
    </section>
  );
}

/** The workspace outside the add flow: the opened Project, or a prompt to choose one. */
function WorkspaceView(
  props: Readonly<{
    view: View;
    error: string | null;
    note: string | undefined;
    problem: Problem | null;
    onRetry(projectId: ProjectId): void;
  }>,
) {
  const { view, problem } = props;
  const upgradeProblem =
    problem === null ? null : (
      <UpgradeProblem
        key={problem.result.diagnostic.code}
        problem={problem}
        onRetry={() => props.onRetry(problem.projectId)}
      />
    );
  if (view?.mode === "active") {
    return (
      <ActiveWorkspace
        view={view}
        note={props.note}
        error={props.error}
        upgradeProblem={upgradeProblem}
      />
    );
  }
  return (
    <>
      <WorkspaceNotes note={props.note} error={props.error} />
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
          <p>Writes unavailable. Storage needs attention before this Project can be used.</p>
          {upgradeProblem}
        </>
      )}
    </>
  );
}

/**
 * An active Project: the Conversation region, with the note, the error and any upgrade problem in
 * a strip above it.
 */
function ActiveWorkspace(
  props: Readonly<{
    view: NonNullable<View>;
    note: string | undefined;
    error: string | null;
    upgradeProblem: ReactNode;
  }>,
) {
  const { view } = props;
  const notes = props.note !== undefined || props.error || props.upgradeProblem !== null;
  return (
    <>
      {notes ? (
        <div className={`${theme["seixoTokens"]} ${styles["noteStrip"]}`}>
          <WorkspaceNotes note={props.note} error={props.error} />
          {props.upgradeProblem}
        </div>
      ) : null}
      {view.activationId === undefined ? null : (
        <ConversationRegion
          key={view.activationId}
          name={view.name}
          access={view.label}
          activation={{
            projectId: view.projectId,
            activationId: view.activationId,
            readOnly: view.readOnly === true,
          }}
        />
      )}
    </>
  );
}

/** The latest note of what just happened, and the selection error, in their current markup. */
function WorkspaceNotes(props: Readonly<{ note: string | undefined; error: string | null }>) {
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
    </>
  );
}
