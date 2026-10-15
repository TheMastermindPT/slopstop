import type { ProjectConversationReadResult } from "@slopstop/protocol";
import type { RefObject } from "react";
import { RunaIcon } from "../icons/runa-icon.js";
import theme from "../theme/seixo.module.css";
import styles from "./conversation-parts.module.css";
import { staleActivationDetail } from "./save-outcome.js";

/** A load that did not read: a harness answer other than `read`, or a rejected preload call. */
export type LoadFailure =
  | Exclude<ProjectConversationReadResult, { status: "read" }>
  | Readonly<{ status: "rejected-call" }>;

export const loadFailureTitle = "Could not load this conversation.";

/**
 * Whether a failed load shows in the Broken tone (assertive) rather than the Failure tone. A
 * rejected desktop call is the Failure tone (decisions log §54).
 */
export function isBrokenLoad(failure: LoadFailure): boolean {
  return failure.status === "broken";
}

/** A stale activation cannot be re-read: the notice offers no action (decisions log §45). */
export function canReload(failure: LoadFailure): boolean {
  return failure.status !== "stale-activation";
}

/**
 * The detail under the notice title. A rejected desktop call and a stale activation get the
 * renderer's own words (decisions log §54): only restarting recovers from a stale activation, so the
 * harness message ("Reload the conversation.") stays for Diagnostics and logs.
 */
function noticeDetail(failure: LoadFailure): string {
  if (failure.status === "rejected-call") return "The desktop could not load this conversation.";
  if (failure.status === "stale-activation") return staleActivationDetail;
  return failure.diagnostic.message;
}

/**
 * The notice that replaces the stream after a failed load (G24): the Failure tone (circle-x,
 * announced politely through the status slot) or the Broken tone (blood outline, triangle-alert,
 * the code, `role="alert"`). Reload stays mounted and unavailable while it reads.
 */
export function LoadNotice(
  props: Readonly<{
    failure: LoadFailure;
    reloading: boolean;
    reloadButton: RefObject<HTMLButtonElement | null>;
    title: RefObject<HTMLParagraphElement | null>;
    onReload(): void;
  }>,
) {
  const { failure } = props;
  const broken = isBrokenLoad(failure);
  const message = noticeDetail(failure);
  const code = failure.status === "broken" ? failure.diagnostic.code : undefined;
  return (
    <div
      className={`${broken ? theme["failure"] : theme["notice"]} ${styles["notice"]}`}
      data-tone={broken ? "broken" : "failure"}
      role={broken ? "alert" : undefined}
    >
      <RunaIcon name={broken ? "triangle-alert" : "circle-x"} />
      <p
        id="conversation-load-title"
        ref={props.title}
        className={styles["noticeTitle"]}
        tabIndex={-1}
      >
        {loadFailureTitle}
      </p>
      <p className={styles["noticeText"]}>{message}</p>
      {code === undefined ? null : <p className={styles["noticeCode"]}>{`Code ${code}`}</p>}
      {canReload(failure) ? (
        <button
          ref={props.reloadButton}
          type="button"
          className={`${theme["button"]} ${theme["ghostSm"]} ${styles["action"]}`}
          aria-disabled={props.reloading ? "true" : undefined}
          onClick={props.onReload}
        >
          <RunaIcon name="rotate-ccw" />
          Reload
        </button>
      ) : null}
    </div>
  );
}
