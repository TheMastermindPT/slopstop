import type { ProjectId, ProjectRegistrationResult } from "@slopstop/protocol";

export type OutcomeAction =
  | "open"
  | "add-another"
  | "choose-another"
  | "back"
  | "show"
  | "retry-preparation"
  | "retry-confirm"
  | "retry-git"
  | "check-git"
  | "cancel";

type OutcomeTone = "success" | "neutral" | "warn" | "error";

export type Outcome = Readonly<{
  tone: OutcomeTone;
  word: string;
  title: string;
  body: readonly string[];
  nothing?: string;
  actions: readonly OutcomeAction[];
  reference?: string;
  projectId?: ProjectId;
  /** The Project the outcome refers to, for its Open and Show actions. */
  projectName?: string;
  /** Clears the remembered Git approval: the program changed or can't be started. */
  forgetsGit?: boolean;
}>;

const created = "Nothing was created.";
const leave: readonly OutcomeAction[] = ["choose-another", "back"];
const invalidFolder = new Set(["NOT_WORKING_TREE", "BARE_REPOSITORY", "REPOSITORY_INVALID"]);

type Coded = Extract<ProjectRegistrationResult, { code: string }>;
type FixedOutcome = Omit<Outcome, "reference" | "projectId">;

// Outcomes that only depend on the code; each carries the code as its reference.
const byCode: Readonly<Record<string, (name: string) => FixedOutcome>> = {
  REGISTRATION_INCOMPLETE: (name) => ({
    tone: "warn",
    word: "Needs recovery",
    title: `Adding ${name} was interrupted`,
    body: [
      "Ragnarok stopped before the Project was fully created. It appears in your list as “Registration incomplete”.",
      "Recovery is not available in this version, so this repository stays blocked for now. Nothing was deleted.",
    ],
    actions: ["show", "back"],
  }),
  REPOSITORY_NOT_FOUND: () => ({
    tone: "error",
    word: "Not added",
    title: "The selected folder can't be found",
    body: ["It may have been moved, renamed or deleted after you chose it."],
    nothing: created,
    actions: leave,
  }),
  REPOSITORY_INACCESSIBLE: () => ({
    tone: "error",
    word: "Not added",
    title: "Ragnarok can't open this folder",
    body: ["Windows denied access to it. Check the folder's permissions, then try again."],
    nothing: created,
    actions: ["retry-preparation", "choose-another"],
  }),
  GIT_QUERY_FAILED: () => ({
    tone: "error",
    word: "Not added",
    title: "Git couldn't read this folder as a repository",
    body: [
      "The folder may not be a Git repository, or Git may have refused its configuration. Git's own messages are not shown here.",
    ],
    nothing: created,
    actions: leave,
  }),
  IDENTITY_CAPABILITY_UNAVAILABLE: () => ({
    tone: "error",
    word: "Not supported",
    title: "Ragnarok can't identify this drive reliably",
    body: [
      "Projects need a local drive whose folders keep a stable identity. Network and virtual drives are not supported in this version.",
    ],
    nothing: created,
    actions: leave,
  }),
  REPOSITORY_IDENTITY_CHANGED: () => ({
    tone: "error",
    word: "Not added",
    title: "The folder changed since it was checked",
    body: ["Something went wrong while checking it."],
    nothing: created,
    actions: leave,
  }),
  GIT_CONFIRMATION_REQUIRED: () => ({
    tone: "warn",
    word: "Confirmation needed",
    title: "Confirm Git again",
    body: [
      "The Git program changed since you approved it, for example after an update. Ragnarok won't run it until you check it again.",
    ],
    nothing: created,
    actions: ["check-git", "cancel"],
    forgetsGit: true,
  }),
  GIT_UNAVAILABLE: () => ({
    tone: "error",
    word: "Git unavailable",
    title: "Git can't be started",
    body: ["Ragnarok couldn't find or start Git. Install Git for Windows, then try again."],
    nothing: "Nothing in the repository was read.",
    actions: ["retry-git", "cancel"],
    forgetsGit: true,
  }),
  REGISTRY_BUSY: () => ({
    tone: "warn",
    word: "Busy",
    title: "Projects are busy",
    body: ["Another Ragnarok window is updating your Projects. Wait a moment, then try again."],
    nothing: created,
    actions: ["retry-confirm", "cancel"],
  }),
};

const invalidFolderOutcome: FixedOutcome = {
  tone: "error",
  word: "Not added",
  title: "This folder can't be added as a Project",
  body: [
    "Choose the repository's working folder: the one that contains your checked-out files. A .git folder or a bare repository can't be added.",
  ],
  nothing: created,
  actions: leave,
};

const genericOutcome: FixedOutcome = {
  tone: "error",
  word: "Not added",
  title: "Ragnarok couldn't add this repository",
  body: ["Something went wrong while checking it."],
  nothing: created,
  actions: ["back"],
};

function codedOutcome(result: Coded, name: string): Outcome {
  const fixed = invalidFolder.has(result.code)
    ? invalidFolderOutcome
    : (byCode[result.code]?.(name) ?? genericOutcome);
  return { ...fixed, reference: result.code };
}

/** The outcome screen for a registration result that ends the flow. */
export function outcomeFor(result: ProjectRegistrationResult, name: string): Outcome {
  switch (result.status) {
    case "registered":
      return {
        tone: "success",
        word: "Added",
        title: `${result.name} was added`,
        body: ["It is now in your Projects list. Opening it checks access to its local storage."],
        actions: ["open", "add-another"],
        projectId: result.projectId,
        projectName: result.name,
      };
    case "already-registered":
      return {
        tone: "neutral",
        word: "Already registered",
        title: `${result.name} is already registered`,
        body: [
          `This folder already belongs to Project ${result.name}. No second Project was created.`,
        ],
        actions: ["open", "back"],
        projectId: result.projectId,
        projectName: result.name,
      };
    case "belongs-to-project":
      return {
        tone: "neutral",
        word: "Not added",
        title: "This worktree is part of a Project you already have",
        body: [
          `This worktree belongs to Project ${result.name}. Adding further worktrees is not supported yet.`,
        ],
        nothing: "Nothing was created or changed.",
        actions: ["show", "back"],
        projectId: result.projectId,
        projectName: result.name,
      };
    default:
      return "code" in result ? codedOutcome(result, name) : { ...genericOutcome };
  }
}
