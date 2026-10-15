import type { ReactNode } from "react";
import { RunaIcon } from "../icons/runa-icon.js";
import theme from "../theme/seixo.module.css";
import styles from "./conversation-parts.module.css";
import type { StatusLine } from "./save-outcome.js";

const toneIcon = { failure: "circle-x", unknown: "circle-help", saved: "check" } as const;

/**
 * The status row under the composer: the one polite status slot, without `role="status"` (G26),
 * and Try again at its end. A Broken-tone line is not announced here: it is its own alert.
 * While a load notice is on screen the row is concealed: still announced, visually hidden, and
 * without Try again, because Reload is that state's action (ui-ux review 2 D2).
 */
export function StatusSlot(
  props: Readonly<{ line: StatusLine | undefined; tryAgain: ReactNode; concealed: boolean }>,
) {
  const line = props.line?.tone === "broken" ? undefined : props.line;
  return (
    <div
      className={`${styles["statusRow"]} ${theme["toneEdge"]}`}
      data-tone={line?.tone ?? "none"}
      data-concealed={props.concealed ? "true" : undefined}
    >
      <p id="conversation-status" className={styles["status"]} aria-live="polite">
        {line === undefined ? null : <SlotLine line={line} />}
      </p>
      {props.concealed ? null : props.tryAgain}
    </div>
  );
}

/** The slot's tone icon, bold title and reason. */
function SlotLine(props: Readonly<{ line: StatusLine }>) {
  const { line } = props;
  const icon = toneIcon[line.tone as keyof typeof toneIcon];
  return (
    <>
      {icon === undefined ? null : <RunaIcon name={icon} className={styles["toneIcon"]} />}
      <strong className={styles["statusTitle"]}>{line.title}</strong>
      {line.message === undefined ? null : ` ${line.message}`}
    </>
  );
}

/** A Broken-tone save outcome: blood outline, triangle-alert, the code line, `role="alert"`. */
export function OutcomeAlert(props: Readonly<{ line: StatusLine | undefined }>) {
  const { line } = props;
  if (line?.tone !== "broken") return null;
  return (
    <div className={`${theme["failure"]} ${styles["notice"]}`} role="alert">
      <RunaIcon name="triangle-alert" />
      <p className={styles["noticeTitle"]}>{line.title}</p>
      <p className={styles["noticeText"]}>{line.message}</p>
      {line.code === undefined ? null : (
        <p className={styles["noticeCode"]}>{`Code ${line.code}`}</p>
      )}
    </div>
  );
}

/** Try again: resends the same save; unavailable while a read is in progress. */
export function TryAgain(props: Readonly<{ unavailable: boolean; onTryAgain(): void }>) {
  return (
    <button
      type="button"
      className={`${theme["button"]} ${theme["ghostSm"]} ${styles["tryAgain"]}`}
      aria-disabled={props.unavailable ? "true" : undefined}
      onClick={props.onTryAgain}
    >
      <RunaIcon name="rotate-ccw" />
      Try again
    </button>
  );
}
