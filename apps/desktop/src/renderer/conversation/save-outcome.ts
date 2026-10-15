import {
  type ProjectConversationSaveResult,
  projectConversationDiagnostics,
} from "@slopstop/protocol";

/** A save's answer: the harness result, or a preload call that rejected (IPC failure or decode). */
export type SaveAnswer = ProjectConversationSaveResult | Readonly<{ status: "rejected-call" }>;

/**
 * A Project's last save, as its per-Project memory keeps it: nothing yet, a save in flight, a
 * result lost to an older activation or harness epoch, or the last answer.
 */
export type SaveOutcome =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "pending" }>
  | Readonly<{ kind: "dropped" }>
  | Readonly<{ kind: "answered"; answer: SaveAnswer }>;

/** One status line: its tone, its words, an optional code line, and whether Try again shows. */
export type StatusLine = Readonly<{
  tone: "plain" | "failure" | "unknown" | "broken" | "saved";
  title: string;
  message?: string;
  code?: string;
  tryAgain: boolean;
}>;

const notConfirmed: StatusLine = {
  tone: "unknown",
  title: "Not confirmed.",
  message: projectConversationDiagnostics.saveUnconfirmed.message,
  tryAgain: true,
};

/** The not-confirmed reason where Try again is not offered (decisions log §58, deep review I3). */
const notConfirmedWithoutTryAgain = "The save could not be confirmed.";

/**
 * What a stale activation tells the person, for a load and a save alike: only an app restart
 * recovers (decisions log §54, §56). The harness message stays for Diagnostics and logs.
 */
export const staleActivationDetail =
  "This Project was reopened elsewhere. Restart Ragnarok to open it again.";

/** Outcomes after which the next press mints a new `saveId` (G27); every other one keeps it. */
export function keepsSaveId(answer: SaveAnswer): boolean {
  return answer.status !== "saved" && answer.status !== "conflict" && answer.status !== "rejected";
}

/** The status line an answer shows (G24 copy); Try again only where resending can succeed. */
function answerLine(answer: SaveAnswer): StatusLine {
  switch (answer.status) {
    case "saved":
      return { tone: "saved", title: "Saved", tryAgain: false };
    case "conflict":
      return {
        tone: "plain",
        title: "The conversation changed and was reloaded. Save again to add your message.",
        tryAgain: false,
      };
    case "rejected-call":
      // A desktop call that did not complete is a failure, not a defect report (decisions log §54).
      return {
        tone: "failure",
        title: "Not saved.",
        message: "The desktop could not complete this save.",
        tryAgain: false,
      };
    case "uncertain":
      return { ...notConfirmed, message: answer.diagnostic.message };
    case "broken":
      return {
        tone: "broken",
        title: "Not saved.",
        message: answer.diagnostic.message,
        code: answer.diagnostic.code,
        tryAgain: false,
      };
    default:
      return {
        tone: "failure",
        title: "Not saved.",
        message:
          answer.status === "stale-activation" ? staleActivationDetail : answer.diagnostic.message,
        tryAgain: answer.status !== "stale-activation" && answer.diagnostic.retryable,
      };
  }
}

/** The line a kept outcome shows; nothing for no save, and "Saving…" belongs to the slot. */
export function outcomeLine(outcome: SaveOutcome, withoutTryAgain = false): StatusLine | undefined {
  const line = keptLine(outcome);
  // Where Try again is not offered (read-only, or an edited draft), "not confirmed" does not ask
  // for it (decisions log §58, deep review I3).
  return withoutTryAgain && line?.tone === "unknown"
    ? { ...line, message: notConfirmedWithoutTryAgain }
    : line;
}

function keptLine(outcome: SaveOutcome): StatusLine | undefined {
  if (outcome.kind === "answered") return answerLine(outcome.answer);
  if (outcome.kind === "dropped") return notConfirmed;
  return undefined;
}

/**
 * What a Project's kept outcome becomes when its region loads under a new activation (G27): an old
 * pending save and a dropped one may have committed, so they show as not confirmed; `uncertain`
 * and both `unavailable` rows keep their line; everything tied to the old activation is cleared.
 */
export function outcomeOnReturn(outcome: SaveOutcome): SaveOutcome {
  if (outcome.kind === "pending" || outcome.kind === "dropped") return { kind: "dropped" };
  if (outcome.kind !== "answered") return outcome;
  const status = outcome.answer.status;
  return status === "uncertain" || status === "unavailable" ? outcome : { kind: "none" };
}

type SlotState = Readonly<{
  loadFailure?: string | undefined;
  overLimit?: boolean;
  saving?: boolean;
  loading?: boolean;
  kept?: StatusLine | undefined;
}>;

/**
 * The one status slot's line, highest first (G26): the failure-tone load title, the over-limit
 * line, "Saving…", "Loading messages…", then the kept outcome line (which includes "Saved").
 */
export function statusSlot(state: SlotState): StatusLine | undefined {
  if (state.loadFailure !== undefined)
    return { tone: "failure", title: state.loadFailure, tryAgain: false };
  if (state.overLimit)
    return { tone: "failure", title: "This message is longer than 32 KiB.", tryAgain: false };
  if (state.saving) return { tone: "plain", title: "Saving…", tryAgain: false };
  if (state.loading) return { tone: "plain", title: "Loading messages…", tryAgain: false };
  return state.kept;
}
