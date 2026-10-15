import { conversationTextProblem } from "@slopstop/protocol";
import { type Dispatch, type SetStateAction, useEffect, useRef, useSyncExternalStore } from "react";
import { useConversationMemoryStore } from "./conversation-memory.js";
import type { SaveAnswer, SaveOutcome } from "./save-outcome.js";
import {
  type ConversationActivation,
  type ShownMessage,
  useConversationLoad,
} from "./use-conversation-load.js";
import { useConversationSave } from "./use-conversation-save.js";

export type { ConversationActivation, ShownMessage };

type Saved = Extract<SaveAnswer, { status: "saved" }>;

/** The list with a non-replayed saved row appended once. */
function withSavedRow(current: ShownMessage[], answer: Saved): ShownMessage[] {
  if (current.some((message) => message.id === answer.conversationMessageId)) return current;
  const row = {
    id: answer.conversationMessageId,
    cursor: answer.cursor,
    text: answer.request.text,
    savedAt: answer.savedAt,
  };
  return [...current, row];
}

/** The saved answer an outcome carries, when it is a new (not replayed) row. */
function newRow(outcome: SaveOutcome): Saved | undefined {
  if (outcome.kind !== "answered" || outcome.answer.status !== "saved") return undefined;
  return outcome.answer.replayed ? undefined : outcome.answer;
}

/** A save that answered while the region was remounted is listed when its outcome arrives. */
function useSavedRow(outcome: SaveOutcome, setMessages: Dispatch<SetStateAction<ShownMessage[]>>) {
  useEffect(() => {
    if (outcome.kind !== "answered" || outcome.answer.status !== "saved") return;
    const answer = outcome.answer;
    if (!answer.replayed) setMessages((current) => withSavedRow(current, answer));
  }, [outcome, setMessages]);
}

/**
 * Loading and saving one activation's conversation. The draft, save identity, revision and last
 * outcome live in the workspace's per-Project memory, so a remount inside one activation keeps a
 * pending save and its late result.
 */
export function useProjectConversation(activation: ConversationActivation) {
  const store = useConversationMemoryStore();
  const composer = useRef<HTMLTextAreaElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const noticeTitle = useRef<HTMLParagraphElement>(null);
  const memory = useSyncExternalStore(store.subscribe, () => store.get(activation.projectId));
  const loaded = useConversationLoad({ store, activation, composer, reloadButton, noticeTitle });
  useSavedRow(memory.outcome, loaded.setMessages);
  const saving = useConversationSave({
    store,
    activation,
    composer,
    saveButton,
    load: loaded.load,
    refresh: loaded.refresh,
  });
  // The new row shows in the same render as "Saved", so the stream scrolls in that frame.
  const row = newRow(memory.outcome);
  return {
    messages: row === undefined ? loaded.messages : withSavedRow(loaded.messages, row),
    load: loaded.load,
    loadingShown: loaded.loadingShown,
    text: memory.text,
    textProblem: conversationTextProblem(memory.text),
    setText: saving.setText,
    outcome: memory.outcome,
    /** Try again can resend only while the draft keeps its save identity (decisions log §54). */
    resendable: memory.saveId !== undefined,
    save: saving.save,
    tryAgain: saving.tryAgain,
    retry: loaded.retry,
    composer,
    saveButton,
    reloadButton,
    noticeTitle,
  };
}
