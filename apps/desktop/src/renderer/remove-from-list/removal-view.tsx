import {
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { BusyLine, StepActions, StepHeading, useEscape } from "../add-repository/flow-screens.js";
import styles from "../projects-workspace.module.css";
import type { RemovalScreen, useRemoveFromList } from "./use-remove-from-list.js";

type Removal = ReturnType<typeof useRemoveFromList>;

const effects = [
  [MinusCircleIcon, "It disappears from your Projects list."],
  [CheckCircleIcon, "Its Ragnarok data stays saved on this computer."],
  [CheckCircleIcon, "The repository and its files are not changed."],
  [
    InfoIcon,
    "Adding the same folder again brings this Project back: the same Project, not a copy.",
  ],
] as const;

function Confirmation({
  screen,
  removal,
}: Readonly<{ screen: Extract<RemovalScreen, { kind: "confirm" }>; removal: Removal }>) {
  const cancel = () => removal.back(screen.target);
  useEscape(!screen.busy, cancel);
  return (
    <div className={styles["step"]}>
      <p className={styles["flowTitle"]}>Remove from list</p>
      <StepHeading focusKey={`remove-${screen.target.projectId}-${screen.busy}`}>
        Remove {screen.target.name} from the list?
      </StepHeading>
      <ul className={styles["queries"]}>
        {effects.map(([Icon, line]) => (
          <li key={line}>
            <Icon size={16} aria-hidden="true" /> {line}
          </li>
        ))}
      </ul>
      {screen.busy ? <BusyLine>Removing from the list…</BusyLine> : null}
      <StepActions
        primary="Remove from list"
        busy={screen.busy}
        onPrimary={() => removal.remove(screen.target)}
        onCancel={cancel}
      />
    </div>
  );
}

function Failure({
  screen,
  removal,
}: Readonly<{ screen: Extract<RemovalScreen, { kind: "failure" }>; removal: Removal }>) {
  const { failure, target } = screen;
  const back = () => removal.back(target);
  useEscape(true, back);
  const Icon = failure.tone === "warn" ? ClockIcon : XCircleIcon;
  return (
    <div className={`${styles["step"]} ${styles[`tone-${failure.tone}`] ?? ""}`}>
      <div className={styles["outcomeHead"]}>
        <Icon size={22} aria-hidden="true" />
        <span className={styles["statusWord"]}>{failure.word}</span>
        <StepHeading focusKey={`removal-${failure.title}`}>{failure.title}</StepHeading>
      </div>
      <p>{failure.body}</p>
      {failure.nothing === undefined ? null : (
        <p className={styles["nothing"]}>
          <MinusCircleIcon size={16} aria-hidden="true" />
          {failure.nothing}
        </p>
      )}
      <div className={styles["actions"]}>
        {failure.retry ? (
          <button type="button" onClick={() => removal.remove(target)}>
            Try again
          </button>
        ) : null}
        <button type="button" onClick={back}>
          {failure.retry ? "Cancel" : "Back to Projects"}
        </button>
      </div>
      <p className={styles["codeLine"]}>Reference: {failure.reference}</p>
    </div>
  );
}

/** The removal confirmation or its failure, shown in the workspace. */
export function RemovalView({ removal }: Readonly<{ removal: Removal }>) {
  const { screen } = removal;
  if (screen.kind === "confirm") return <Confirmation screen={screen} removal={removal} />;
  if (screen.kind === "failure") return <Failure screen={screen} removal={removal} />;
  return null;
}
