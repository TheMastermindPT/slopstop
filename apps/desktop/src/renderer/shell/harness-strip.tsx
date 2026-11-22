import type { HarnessStatus } from "@slopstop/protocol";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RunaIcon, type RunaIconName } from "../icons/runa-icon.js";
import seixo from "../theme/seixo.module.css";
import { workHeadingId } from "./focus-headings.js";
import styles from "./harness-strip.module.css";

/** The harness state's words: the state word and its detail (`copyForStatus` in `app.tsx`). */
export type StatusCopy = Readonly<{ heading: string; detail: string }>;

/** Why a retry failed: the main process refused it, or the desktop process never answered. */
export type RetryFailure = Readonly<{
  code: "HARNESS_RETRY_UNAVAILABLE" | "DESKTOP_RETRY_FAILED";
  message: string;
}>;

type StripState = Exclude<HarnessStatus["state"], "ready">;

/** Each state's tone, read by the style sheet, and its icon. Stopped is not a fault. */
const looks: Readonly<
  Record<StripState, Readonly<{ tone: "busy" | "warn" | "fault" | "dim"; icon: RunaIconName }>>
> = {
  starting: { tone: "busy", icon: "loader-circle" },
  degraded: { tone: "warn", icon: "triangle-alert" },
  crashed: { tone: "fault", icon: "circle-x" },
  stopped: { tone: "dim", icon: "info" },
};

/** How long a fresh start waits before its strip shows. */
const startingDelayMs = 1000;

/** The one polite status, the same element in every state: the state word, then the detail. */
export function HarnessStatusLine({ copy }: Readonly<{ copy: StatusCopy }>) {
  return (
    <div role="status" aria-live="polite" className={styles["status"]}>
      <strong>{copy.heading}</strong>
      <span>{copy.detail}</span>
    </div>
  );
}

/**
 * Whether the strip shows. With no strip showing, starting shows one only after a second; any
 * other state that is not ready shows one at once; once shown, it stays until the harness is ready.
 */
export function useStripShown(state: HarnessStatus["state"]): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (state === "ready") {
      setHeld(false);
      return;
    }
    if (state !== "starting") {
      setHeld(true);
      return;
    }
    const timer = setTimeout(() => setHeld(true), startingDelayMs);
    return () => clearTimeout(timer);
  }, [state]);
  return state !== "ready" && (held || state !== "starting");
}

/** Moves focus to the work area's heading when the strip leaves while `button` has focus. */
function useFocusAfterLeaving(button: RefObject<HTMLButtonElement | null>) {
  useLayoutEffect(
    () => () => {
      if (button.current !== null && button.current === document.activeElement)
        document.getElementById(workHeadingId)?.focus();
    },
    [button],
  );
}

/**
 * The harness strip: the state above the work while the harness is not ready. A pressed Retry
 * stays, as "Retrying harness", until the harness has an outcome.
 */
export function HarnessStrip(
  props: Readonly<{
    status: Exclude<HarnessStatus, { state: "ready" }>;
    copy: StatusCopy;
    retrying: boolean;
    retryFailure: RetryFailure | null;
    onRetry: () => void;
  }>,
) {
  const button = useRef<HTMLButtonElement>(null);
  useFocusAfterLeaving(button);
  const look = looks[props.status.state];
  const unavailable = props.status.state === "crashed";
  const offered = props.retrying || (unavailable && props.status.canRetry);
  return (
    <section
      aria-label={props.copy.heading}
      data-tone={look.tone}
      className={`${seixo["seixo"]} ${styles["strip"]}`}
    >
      <RunaIcon name={look.icon} className={iconClass(look.icon)} />
      <div className={styles["text"]}>
        <p className={styles["word"]}>{props.copy.heading}</p>
        <p className={styles["detail"]}>{props.copy.detail}</p>
        {unavailable && props.retryFailure !== null ? (
          <p role="alert" className={styles["alert"]} data-code={props.retryFailure.code}>
            {props.retryFailure.message}
          </p>
        ) : null}
      </div>
      {offered ? (
        <button
          ref={button}
          type="button"
          className={styles["retry"]}
          aria-disabled={props.retrying ? "true" : undefined}
          onClick={() => {
            if (!props.retrying) props.onRetry();
          }}
        >
          <RunaIcon
            name={props.retrying ? "loader-circle" : "refresh-cw"}
            className={iconClass(props.retrying ? "loader-circle" : "refresh-cw")}
          />
          {props.retrying ? "Retrying harness" : "Retry harness"}
        </button>
      ) : null}
    </section>
  );
}

/** The loader turns (only when motion is allowed, in the style sheet); other icons do not. */
const iconClass = (icon: RunaIconName) =>
  icon === "loader-circle" ? `${styles["icon"]} ${styles["spin"]}` : styles["icon"];
