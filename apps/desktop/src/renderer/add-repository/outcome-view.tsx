import {
  CheckCircleIcon,
  ClockIcon,
  GitBranchIcon,
  InfoIcon,
  MinusCircleIcon,
  ShieldWarningIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import styles from "../projects-workspace.module.css";
import { type ScreenOf, StepHeading } from "./flow-screens.js";
import type { Outcome, OutcomeAction } from "./outcomes.js";

const labels: Readonly<Record<OutcomeAction, (outcome: Outcome, name: string) => string>> = {
  open: (outcome, name) => (outcome.word === "Added" ? "Open Project" : `Open ${name}`),
  show: (outcome, name) =>
    outcome.word === "Needs recovery" ? "Show it in the list" : `Show ${name}`,
  "add-another": () => "Add another repository",
  "choose-another": () => "Choose another folder",
  back: () => "Back to Projects",
  "check-git": () => "Check Git again",
  cancel: () => "Cancel",
  "retry-git": () => "Try again",
  "retry-preparation": () => "Try again",
  "retry-confirm": () => "Try again",
};

function OutcomeIcon({ outcome }: Readonly<{ outcome: Outcome }>) {
  const icons = {
    success: CheckCircleIcon,
    neutral: outcome.word === "Not added" ? GitBranchIcon : InfoIcon,
    warn:
      outcome.word === "Busy" ? ClockIcon : outcome.forgetsGit ? ShieldWarningIcon : WarningIcon,
    error: XCircleIcon,
  } as const;
  const Icon = icons[outcome.tone];
  return <Icon size={22} aria-hidden="true" />;
}

/** One outcome: status word, icon and colour together, what to do next, and its reference. */
export function OutcomeView(
  props: Readonly<{ screen: ScreenOf<"outcome">; onAction(action: OutcomeAction): void }>,
) {
  const { outcome } = props.screen;
  const subject = outcome.projectName ?? "";
  return (
    <div className={`${styles["step"]} ${styles[`tone-${outcome.tone}`] ?? ""}`}>
      <div className={styles["outcomeHead"]}>
        <OutcomeIcon outcome={outcome} />
        <span className={styles["statusWord"]}>{outcome.word}</span>
        <StepHeading focusKey={`outcome-${outcome.title}`}>{outcome.title}</StepHeading>
      </div>
      {outcome.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {outcome.nothing === undefined ? null : (
        <p className={styles["nothing"]}>
          <MinusCircleIcon size={16} aria-hidden="true" />
          {outcome.nothing}
        </p>
      )}
      <div className={styles["actions"]}>
        {outcome.actions.map((action) => (
          <button key={action} type="button" onClick={() => props.onAction(action)}>
            {labels[action](outcome, subject)}
          </button>
        ))}
      </div>
      {outcome.reference === undefined ? null : (
        <p className={styles["codeLine"]}>Reference: {outcome.reference}</p>
      )}
    </div>
  );
}
