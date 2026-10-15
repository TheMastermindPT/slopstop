import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef } from "react";
import theme from "../theme/seixo.module.css";
import styles from "./conversation-parts.module.css";
import { savedAtLabel } from "./saved-at.js";
import type { ShownMessage } from "./use-project-conversation.js";

/** Whether the person asked for reduced motion; no smooth scrolling then (G26). */
function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Keeps the stream at its newest message: it opens there, and it moves to a new message after a
 * save, smoothly unless reduced motion is on.
 */
function useStreamEnd(count: number, loaded: boolean) {
  const stream = useRef<HTMLDivElement>(null);
  const shown = useRef<number | undefined>(undefined);
  // Before paint, so the frame that shows a new row already shows it in view.
  useLayoutEffect(() => {
    if (!loaded) return;
    const opening = shown.current === undefined;
    if (opening || count > (shown.current ?? 0)) {
      const behavior = opening || reducedMotion() ? "auto" : "smooth";
      stream.current?.scrollTo?.({ top: stream.current.scrollHeight, behavior });
    }
    shown.current = count;
  }, [count, loaded]);
  return stream;
}

/** The ordered stream of saved messages. It announces nothing on its own. */
export function MessageStream(props: Readonly<{ messages: ShownMessage[]; loaded: boolean }>) {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stream = useStreamEnd(props.messages.length, props.loaded);
  const empty = props.loaded && props.messages.length === 0;
  return (
    <div ref={stream} className={styles["stream"]} data-conversation-stream="">
      {empty ? (
        <div className={styles["empty"]}>
          <p className={styles["emptyTitle"]}>No messages yet</p>
          <p className={styles["emptyText"]}>Messages you save stay on this computer.</p>
        </div>
      ) : null}
      <ol className={styles["messages"]} aria-label="Messages">
        {props.messages.map((message) => (
          <li key={message.id} className={styles["message"]}>
            <div className={styles["meta"]}>
              <span className={styles["author"]}>You</span>
              <time className={styles["time"]} dateTime={message.savedAt}>
                {savedAtLabel(message.savedAt, now, timeZone)}
              </time>
            </div>
            <p className={styles["text"]}>{message.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The composer: a labelled field and the one Save button. Ctrl+Enter saves. */
export function Composer(
  props: Readonly<{
    text: string;
    pending: boolean;
    readOnly: boolean;
    unavailable: boolean;
    invalid: boolean;
    describedBy: string | undefined;
    /** Save's own visible reason, when it has one (decisions log §54). */
    reason: string | undefined;
    /** The field's hint; a read-only Project has none, its Read only line explains. */
    placeholder: string | undefined;
    composer: RefObject<HTMLTextAreaElement | null>;
    saveButton: RefObject<HTMLButtonElement | null>;
    onText(text: string): void;
    onSave(): void;
  }>,
) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      props.onSave();
    }
  };
  return (
    <div className={styles["composer"]}>
      <div className={`${theme["composerField"]} ${styles["field"]}`} data-conversation-field="">
        <textarea
          ref={props.composer}
          className={styles["textarea"]}
          aria-label="Message"
          placeholder={props.placeholder}
          value={props.text}
          readOnly={props.readOnly}
          aria-describedby={props.describedBy}
          aria-invalid={props.invalid ? "true" : undefined}
          onChange={(event) => props.onText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {/* Save sits in a bar inside the field, bottom right (ui-ux C2). */}
        <div className={styles["composerBar"]}>
          {props.reason === undefined ? null : (
            <p id="conversation-save-reason" className={styles["reason"]}>
              {props.reason}
            </p>
          )}
          <button
            ref={props.saveButton}
            type="button"
            className={`${theme["button"]} ${theme["primary"]} ${styles["save"]}`}
            aria-disabled={props.unavailable ? "true" : undefined}
            aria-describedby={props.describedBy}
            onClick={props.onSave}
          >
            {props.pending ? "Saving…" : "Save locally"}
          </button>
        </div>
      </div>
    </div>
  );
}
