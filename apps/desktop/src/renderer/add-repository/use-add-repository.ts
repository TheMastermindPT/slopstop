import type {
  ProjectId,
  ProjectRegistrationResult,
  RendererRegistrationRequest,
} from "@slopstop/protocol";
import { useRef, useState } from "react";
import { type Outcome, type OutcomeAction, outcomeFor } from "./outcomes.js";

export type Selection = Readonly<{
  repositorySelectionId: string;
  directory: string;
  folder: string;
  /** The per-folder trust decision (D6), recorded when the user trusts this folder. */
  trustId: string;
}>;
type GitProgram = Readonly<{ selectionId: string; executablePath: string }>;
/** Git approval (D8): reusable across folders until the program changes or can't start. */
export type GitApproval = GitProgram &
  Readonly<{ observationId: string; consentId: string; version: string }>;
type Preparation = Extract<RendererRegistrationRequest, { step: "prepare" }>;
type Proposal = Extract<ProjectRegistrationResult, { status: "proposal-prepared" }>;

export type FlowScreen =
  | Readonly<{ kind: "idle"; note?: string }>
  | Readonly<{ kind: "trust"; selection: Selection; approval?: GitApproval }>
  | Readonly<{ kind: "git-version"; selection: Selection; git: GitProgram; busy: boolean }>
  | Readonly<{
      kind: "git-access";
      selection: Selection;
      git: GitProgram;
      observationId: string;
      version: string;
    }>
  | Readonly<{ kind: "preparing"; selection: Selection; approval: GitApproval }>
  | Readonly<{
      kind: "proposal";
      selection: Selection;
      preparation: Preparation;
      proposal: Proposal;
      busy: boolean;
    }>
  | Readonly<{
      kind: "outcome";
      outcome: Outcome;
      selection?: Selection;
      /** The proposal a busy confirmation retries. */
      confirming?: ProposalScreen;
    }>;

type ProposalScreen = Readonly<{
  kind: "proposal";
  selection: Selection;
  preparation: Preparation;
  proposal: Proposal;
  busy: boolean;
}>;

export type FlowHost = Readonly<{
  focusAdd(): void;
  registered(projectId: ProjectId): void;
  /** A removed Project came back to the list; the list must be read again. */
  restored(): void;
  open(projectId: ProjectId): void;
  show(projectId: ProjectId): void;
  announce(message: string): void;
}>;

const folderName = (directory: string) =>
  directory
    .split(/[\\/]/)
    .filter((segment) => segment.length > 0)
    .pop() ?? directory;

/** The add-repository flow: one screen at a time, each step a preload request. */
export function useAddRepository(host: FlowHost) {
  const [screen, setScreen] = useState<FlowScreen>({ kind: "idle" });
  const approval = useRef<GitApproval | undefined>(undefined);
  const run = useRef(0);
  const register = (request: RendererRegistrationRequest) =>
    window.slopstop.registerProject(request);

  // Each async step belongs to the run that started it; a cancelled run ignores late answers.
  const guarded =
    (token: number, next: (result: ProjectRegistrationResult) => void) =>
    (result: ProjectRegistrationResult) => {
      if (token === run.current) next(result);
    };

  const finish = (
    outcome: Outcome,
    rest: Omit<Extract<FlowScreen, { kind: "outcome" }>, "kind" | "outcome"> = {},
  ) => {
    if (outcome.forgetsGit) approval.current = undefined;
    setScreen({ kind: "outcome", outcome, ...rest });
    host.announce(`${outcome.word}. ${outcome.title}`);
  };

  const prepare = (selection: Selection, granted: GitApproval) => {
    const token = run.current;
    setScreen({ kind: "preparing", selection, approval: granted });
    const preparation: Preparation = {
      step: "prepare",
      preparationRequestId: crypto.randomUUID(),
      selectionId: granted.selectionId,
      observationId: granted.observationId,
      consentId: granted.consentId,
      repositorySelectionId: selection.repositorySelectionId,
      trustId: selection.trustId,
    };
    void register(preparation).then(
      guarded(token, (result) => {
        if (result.status === "restored-to-list") host.restored();
        if (result.status !== "proposal-prepared")
          return finish(outcomeFor(result, selection.folder), { selection });
        setScreen({ kind: "proposal", selection, preparation, proposal: result, busy: false });
        host.announce(`Ready to add ${result.name}.`);
      }),
    );
  };

  const prepareGit = (selection: Selection) => {
    const token = run.current;
    void register({ step: "prepare-git" }).then(
      guarded(token, (git) => {
        if (git.status !== "git-prepared")
          return finish(outcomeFor(git, selection.folder), { selection });
        setScreen({ kind: "git-version", selection, git, busy: false });
      }),
    );
  };

  const start = () => {
    run.current += 1;
    const token = run.current;
    void window.slopstop.chooseRepository().then((choice) => {
      if (token !== run.current) return;
      if (choice.status === "cancelled") {
        setScreen({ kind: "idle" });
        host.focusAdd();
        return;
      }
      if (choice.status !== "repository-selected") return finish(outcomeFor(choice, ""));
      const selection = {
        repositorySelectionId: choice.repositorySelectionId,
        directory: choice.directory,
        folder: folderName(choice.directory),
        trustId: crypto.randomUUID(),
      };
      setScreen(
        approval.current === undefined
          ? { kind: "trust", selection }
          : { kind: "trust", selection, approval: approval.current },
      );
    });
  };

  const trust = (selection: Selection) => {
    const token = run.current;
    void register({
      step: "decide-trust",
      repositorySelectionId: selection.repositorySelectionId,
      trustId: selection.trustId,
      decision: "accepted",
    }).then(
      guarded(token, (trusted) => {
        if (trusted.status !== "trust-recorded")
          return finish(outcomeFor(trusted, selection.folder), { selection });
        if (approval.current !== undefined) return prepare(selection, approval.current);
        prepareGit(selection);
      }),
    );
  };

  const runVersionCheck = (current: Extract<FlowScreen, { kind: "git-version" }>) => {
    const token = run.current;
    setScreen({ ...current, busy: true });
    void register({
      step: "decide-git-version",
      selectionId: current.git.selectionId,
      consentId: crypto.randomUUID(),
      decision: "accepted",
    }).then(
      guarded(token, (version) => {
        if (version.status !== "git-version-observed")
          return finish(outcomeFor(version, current.selection.folder), {
            selection: current.selection,
          });
        setScreen({
          kind: "git-access",
          selection: current.selection,
          git: current.git,
          observationId: version.observationId,
          version: version.version,
        });
      }),
    );
  };

  const allowQueries = (current: Extract<FlowScreen, { kind: "git-access" }>) => {
    const token = run.current;
    const granted: GitApproval = {
      ...current.git,
      observationId: current.observationId,
      consentId: crypto.randomUUID(),
      version: current.version,
    };
    void register({
      step: "decide-identity-queries",
      selectionId: granted.selectionId,
      observationId: granted.observationId,
      consentId: granted.consentId,
      decision: "accepted",
    }).then(
      guarded(token, (recorded) => {
        if (recorded.status !== "identity-queries-recorded")
          return finish(outcomeFor(recorded, current.selection.folder), {
            selection: current.selection,
          });
        approval.current = granted;
        prepare(current.selection, granted);
      }),
    );
  };

  const confirm = (current: Extract<FlowScreen, { kind: "proposal" }>) => {
    const token = run.current;
    setScreen({ ...current, busy: true });
    const { step: _step, ...preparation } = current.preparation;
    void register({
      step: "confirm",
      requestId: crypto.randomUUID(),
      ...preparation,
      proposalId: current.proposal.proposalId,
      proposalFingerprint: current.proposal.proposalFingerprint,
    }).then(
      guarded(token, (result) => {
        if (result.status === "registered") host.registered(result.projectId);
        finish(outcomeFor(result, current.proposal.name), {
          selection: current.selection,
          confirming: current,
        });
      }),
    );
  };

  const cancel = (note?: string) => {
    run.current += 1;
    setScreen(note === undefined ? { kind: "idle" } : { kind: "idle", note });
    if (note !== undefined) host.announce(note);
    host.focusAdd();
  };

  type OutcomeScreen = Extract<FlowScreen, { kind: "outcome" }>;
  // Leaves the outcome for the workspace, then hands the Project to the host.
  const toProject = (forward: (projectId: ProjectId) => void) => (current: OutcomeScreen) => {
    const { projectId } = current.outcome;
    if (projectId === undefined) return cancel();
    setScreen({ kind: "idle" });
    forward(projectId);
  };
  const withSelection = (next: (selection: Selection) => void) => (current: OutcomeScreen) =>
    current.selection === undefined ? cancel() : next(current.selection);
  const retryConfirm = (current: OutcomeScreen) =>
    current.confirming === undefined ? cancel() : confirm(current.confirming);
  const retryPreparation = withSelection((selection) =>
    approval.current === undefined ? prepareGit(selection) : prepare(selection, approval.current),
  );
  const actions: Record<OutcomeAction, (current: OutcomeScreen) => void> = {
    open: toProject(host.open),
    show: toProject(host.show),
    "add-another": start,
    "choose-another": start,
    back: () => cancel(),
    cancel: () => cancel("Cancelled. Nothing was created."),
    "retry-git": withSelection(prepareGit),
    "check-git": withSelection(prepareGit),
    "retry-preparation": retryPreparation,
    "retry-confirm": retryConfirm,
  };
  const act = (action: OutcomeAction, current: OutcomeScreen) => actions[action](current);

  return { screen, start, trust, runVersionCheck, allowQueries, confirm, cancel, act };
}
