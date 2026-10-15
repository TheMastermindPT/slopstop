import { projectConversationDiagnostics } from "@slopstop/protocol";
import { RunaIcon } from "../icons/runa-icon.js";
import theme from "../theme/seixo.module.css";
import { Composer, MessageStream } from "./conversation-parts.js";
import styles from "./conversation-region.module.css";
import { isBrokenLoad, LoadNotice, loadFailureTitle } from "./load-notice.js";
import { outcomeLine, type StatusLine, statusSlot } from "./save-outcome.js";
import { OutcomeAlert, StatusSlot, TryAgain } from "./status-row.js";
import { type ConversationActivation, useProjectConversation } from "./use-project-conversation.js";

/** The note the region shows while no model exists (decisions §4). */
const noModelNote = "No model is connected yet. Messages are saved on this computer.";

type Conversation = ReturnType<typeof useProjectConversation>;

/**
 * What the composer and the status slot show: Save is unavailable while loading, pending,
 * read-only or with text the protocol refuses, and is described by the visible reason (G26).
 */
function composerState(conversation: Conversation, readOnly: boolean) {
  const pending = conversation.outcome.kind === "pending";
  const overLimit = conversation.textProblem === "too-large";
  // One condition decides Try again and its wording (deep review I3, re-review Q1): a read-write
  // draft that still keeps its save identity, outside a failed load that conceals the button.
  const resendable = !readOnly && conversation.resendable && conversation.load.kind !== "failed";
  const kept = outcomeLine(conversation.outcome, !resendable);
  return {
    pending,
    kept,
    tryAgain: !pending && resendable && kept?.tryAgain === true,
    overLimit,
    line: slotLine(conversation, kept),
    readOnly: pending || readOnly,
    unavailable: saveUnavailable(conversation, readOnly),
    describedBy: describedBy(
      conversation.load.kind === "failed",
      readOnly,
      overLimit || conversation.loadingShown,
    ),
  };
}

/** The status slot's line for the region's current state (G26 precedence). */
function slotLine(conversation: Conversation, kept: StatusLine | undefined) {
  const load = conversation.load;
  const failureTone = load.kind === "failed" && !isBrokenLoad(load.failure);
  return statusSlot({
    loadFailure: failureTone ? loadFailureTitle : undefined,
    overLimit: conversation.textProblem === "too-large",
    saving: conversation.outcome.kind === "pending",
    loading: conversation.loadingShown,
    kept,
  });
}

/** Save is unavailable while loading or failed, pending, read-only, or for refused text. */
function saveUnavailable(conversation: Conversation, readOnly: boolean): boolean {
  const pending = conversation.outcome.kind === "pending";
  const textRefused = conversation.textProblem !== undefined;
  return pending || conversation.load.kind !== "loaded" || readOnly || textRefused;
}

/** The composer's hint; a read-only Project has none (Pedro's decision, ui-ux review 2). */
const writeHint = "Write a message";

/** Save's reason while the conversation has not loaded (decisions log §54). */
const notLoadedReason = "Saving is off until the conversation loads.";

/** The visible reason that describes an unavailable Save, highest first. */
function describedBy(failed: boolean, readOnly: boolean, statusDescribes: boolean) {
  if (failed) return "conversation-save-reason";
  if (readOnly) return "conversation-read-only";
  return statusDescribes ? "conversation-status" : undefined;
}

/** The read-only reason under the note; Save and the field are described by this line alone. */
function ReadOnlyLine() {
  return (
    <p id="conversation-read-only" className={styles["context"]}>
      <RunaIcon name="lock" />
      {`Read only: ${projectConversationDiagnostics.readOnly.message}`}
    </p>
  );
}

/** The active Project's Conversation region, in the Seixo look. */
export function ConversationRegion(
  props: Readonly<{ name: string; access: string; activation: ConversationActivation }>,
) {
  const conversation = useProjectConversation(props.activation);
  const state = composerState(conversation, props.activation.readOnly);
  return (
    <div className={`${theme["seixo"]} ${styles["region"]}`} data-conversation-region="">
      <header className={styles["regionHeader"]}>
        <h2 id="ws-heading" className={styles["heading"]} tabIndex={-1}>
          {`Project ${props.name}`}
        </h2>
        <span className={styles["accessWord"]}>{props.access}</span>
        <code className={styles["projectId"]}>{props.activation.projectId}</code>
      </header>
      <p className={styles["context"]}>
        <RunaIcon name="info" />
        {noModelNote}
      </p>
      {props.activation.readOnly ? <ReadOnlyLine /> : null}
      <div className={styles["body"]}>
        {conversation.load.kind === "failed" ? (
          <LoadNotice
            failure={conversation.load.failure}
            reloading={conversation.load.reloading}
            reloadButton={conversation.reloadButton}
            title={conversation.noticeTitle}
            onReload={() => void conversation.retry()}
          />
        ) : (
          <MessageStream
            messages={conversation.messages}
            loaded={conversation.load.kind === "loaded"}
          />
        )}
      </div>
      <Composer
        text={conversation.text}
        pending={state.pending}
        readOnly={state.readOnly}
        unavailable={state.unavailable}
        invalid={state.overLimit}
        describedBy={state.describedBy}
        reason={conversation.load.kind === "failed" ? notLoadedReason : undefined}
        placeholder={props.activation.readOnly ? undefined : writeHint}
        composer={conversation.composer}
        saveButton={conversation.saveButton}
        onText={conversation.setText}
        onSave={() => void conversation.save()}
      />
      <OutcomeAlert line={state.kept} />
      <StatusSlot
        line={state.line}
        concealed={conversation.load.kind === "failed"}
        tryAgain={
          state.tryAgain ? (
            <TryAgain
              unavailable={conversation.load.kind !== "loaded"}
              onTryAgain={() => void conversation.tryAgain()}
            />
          ) : null
        }
      />
    </div>
  );
}
