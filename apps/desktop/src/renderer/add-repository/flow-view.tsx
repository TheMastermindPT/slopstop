import styles from "../projects-workspace.module.css";
import {
  BusyLine,
  QueryList,
  type ScreenOf,
  StepActions,
  StepFrame,
  StepHeading,
  Target,
  Warning,
} from "./flow-screens.js";
import { OutcomeView } from "./outcome-view.js";
import type { useAddRepository } from "./use-add-repository.js";

type Flow = ReturnType<typeof useAddRepository>;
const gitLabel = (version: string) => `Git ${version}`;

function TrustScreen({ screen, flow }: Readonly<{ screen: ScreenOf<"trust">; flow: Flow }>) {
  const cancel = () => flow.cancel("Cancelled. Nothing was run.");
  return (
    <StepFrame current={1} cancellable onCancel={cancel}>
      <StepHeading focusKey="trust">Do you trust this repository?</StepHeading>
      <p>Confirm this before Ragnarok runs anything on it.</p>
      <Target
        label="Selected folder"
        name={screen.selection.folder}
        path={screen.selection.directory}
        kind="folder"
      />
      <p>
        To identify the repository, Git reads its administration folder (<code>.git</code>) and its
        local configuration. That configuration can include other files, even ones outside this
        folder.
      </p>
      <Warning title="This version doesn't protect against a hostile Git configuration">
        An include in that configuration can make Windows connect to a network location, such as a
        shared drive. Only continue if you trust where this repository came from.
      </Warning>
      <p>
        {screen.approval === undefined
          ? "Trusting runs nothing by itself. Next, you'll approve the Git program."
          : `Trusting runs nothing by itself. Next, Ragnarok identifies the repository with the Git program you already approved (${gitLabel(screen.approval.version)}).`}
      </p>
      <StepActions
        primary="Trust and continue"
        busy={false}
        onPrimary={() => flow.trust(screen.selection)}
        onCancel={cancel}
      />
      <p className={styles["footnote"]}>
        This decision applies only to this folder. Choosing another folder asks again.
      </p>
    </StepFrame>
  );
}

function GitVersionScreen({
  screen,
  flow,
}: Readonly<{ screen: ScreenOf<"git-version">; flow: Flow }>) {
  const cancel = () => flow.cancel("Cancelled. Git was not run.");
  return (
    <StepFrame current={2} cancellable={!screen.busy} onCancel={cancel}>
      <StepHeading focusKey={`git-version-${screen.busy}`}>Check the Git program</StepHeading>
      <p>Ragnarok will run this Git program once, only to read its version.</p>
      <Target label="Git program" name="git.exe" path={screen.git.executablePath} kind="program" />
      <p>
        Command: <code>git --version</code>
      </p>
      <p>
        It runs outside the repository, so nothing in <strong>{screen.selection.folder}</strong> is
        read yet.
      </p>
      {screen.busy ? <BusyLine>Checking the Git version…</BusyLine> : null}
      <StepActions
        primary="Run version check"
        busy={screen.busy}
        onPrimary={() => flow.runVersionCheck(screen)}
        onCancel={cancel}
      />
    </StepFrame>
  );
}

function GitAccessScreen({
  screen,
  flow,
}: Readonly<{ screen: ScreenOf<"git-access">; flow: Flow }>) {
  const cancel = () =>
    flow.cancel("Cancelled. Git only read its own version; no repository query was run.");
  return (
    <StepFrame current={3} cancellable onCancel={cancel}>
      <StepHeading focusKey="git-access">
        Allow Git to identify {screen.selection.folder}?
      </StepHeading>
      <p>
        Ragnarok needs six read-only Git queries to recognise this repository and to check whether
        it already belongs to a Project.
      </p>
      <dl className={styles["facts"]}>
        <dt>Git program</dt>
        <dd>
          <code>{screen.git.executablePath}</code>
        </dd>
        <dt>Observed version</dt>
        <dd>
          <code>git version {screen.version}</code>
        </dd>
        <dt>Runs in</dt>
        <dd>{screen.selection.folder}</dd>
      </dl>
      <QueryList />
      <p>
        These queries only read. Ragnarok does not ask Git to change files, run hooks or contact
        remotes. The configuration warning you accepted still applies.
      </p>
      <StepActions
        primary="Allow 6 queries"
        busy={false}
        onPrimary={() => flow.allowQueries(screen)}
        onCancel={cancel}
      />
      <p className={styles["footnote"]}>
        This approval covers this Git program and version. If either changes, Ragnarok asks again.
      </p>
    </StepFrame>
  );
}

function PreparingScreen({ screen }: Readonly<{ screen: ScreenOf<"preparing"> }>) {
  return (
    <StepFrame current={4} cancellable={false} onCancel={() => undefined}>
      <StepHeading focusKey="preparing">Identifying {screen.selection.folder}…</StepHeading>
      <BusyLine>Running the six read-only queries…</BusyLine>
      <QueryList />
      <StepActions
        primary="Confirm registration"
        busy
        onPrimary={() => undefined}
        onCancel={() => undefined}
      />
    </StepFrame>
  );
}

function ProposalScreen({ screen, flow }: Readonly<{ screen: ScreenOf<"proposal">; flow: Flow }>) {
  const cancel = () => flow.cancel("Cancelled. Nothing was created.");
  const { proposal } = screen;
  return (
    <StepFrame current={4} cancellable={!screen.busy} onCancel={cancel}>
      <StepHeading focusKey={`proposal-${screen.busy}`}>Ready to add {proposal.name}</StepHeading>
      <p>Check the details, then confirm.</p>
      <dl className={styles["facts"]}>
        <dt>Project name</dt>
        <dd>
          {proposal.name} <span>from the folder name</span>
        </dd>
        <dt>Repository folder</dt>
        <dd>
          <code>{proposal.repositoryDirectory}</code>
        </dd>
        <dt>Working tree</dt>
        <dd>Main working tree</dd>
        <dt>Git</dt>
        <dd>{proposal.gitVersion}</dd>
      </dl>
      <div className={styles["info"]}>
        <strong>What confirming does</strong>
        <p>
          Ragnarok creates a Project and its storage on this computer. Your repository is not
          changed.
        </p>
      </div>
      <p>Just before creating the Project, Ragnarok checks the folder and Git again.</p>
      {screen.busy ? <BusyLine>Checking again and creating the Project…</BusyLine> : null}
      <StepActions
        primary="Confirm registration"
        busy={screen.busy}
        onPrimary={() => flow.confirm(screen)}
        onCancel={cancel}
      />
    </StepFrame>
  );
}

/** Whether a step is running and the workspace is busy. */
export function flowRunning(screen: Flow["screen"]): boolean {
  if (screen.kind === "preparing") return true;
  return (screen.kind === "git-version" || screen.kind === "proposal") && screen.busy;
}

/** The current add-repository step, or nothing while the flow is idle. */
export function AddRepositoryFlowView({ flow }: Readonly<{ flow: Flow }>) {
  const { screen } = flow;
  switch (screen.kind) {
    case "idle":
      return null;
    case "trust":
      return <TrustScreen screen={screen} flow={flow} />;
    case "git-version":
      return <GitVersionScreen screen={screen} flow={flow} />;
    case "git-access":
      return <GitAccessScreen screen={screen} flow={flow} />;
    case "preparing":
      return <PreparingScreen screen={screen} />;
    case "proposal":
      return <ProposalScreen screen={screen} flow={flow} />;
    case "outcome":
      return <OutcomeView screen={screen} onAction={(action) => flow.act(action, screen)} />;
  }
}
