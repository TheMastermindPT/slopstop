import { conversationTextProblem, type ProjectConversationSaveRequest } from "@slopstop/protocol";
import type { RefObject } from "react";
import type { ConversationMemory, ConversationMemoryStore } from "./conversation-memory.js";
import type { SaveAnswer, SaveOutcome } from "./save-outcome.js";
import { settleSave } from "./settle-save.js";
import type { ConversationActivation, Load } from "./use-conversation-load.js";

/**
 * Whether a press can send: a read-write activation, loaded, no save in flight, and text the
 * protocol accepts (G10, G11).
 */
function canSend(load: Load, memory: ConversationMemory, readOnly: boolean): boolean {
  const idle = memory.outcome.kind !== "pending";
  const writable = !readOnly && load.kind === "loaded";
  return writable && idle && conversationTextProblem(memory.text) === undefined;
}

/**
 * Whether Try again can resend: a read-write activation, loaded, nothing in flight, and a kept
 * save identity (G10, G27).
 */
function canResend(load: Load, memory: ConversationMemory, readOnly: boolean): boolean {
  const idle = memory.outcome.kind !== "pending";
  return !readOnly && load.kind === "loaded" && idle && memory.saveId !== undefined;
}

/** The outcome a new input leaves: "Saved" ends there, other lines stay. */
function afterInput(outcome: SaveOutcome): SaveOutcome {
  const saved = outcome.kind === "answered" && outcome.answer.status === "saved";
  return saved ? { kind: "none" } : outcome;
}

type SaveScope = Readonly<{
  store: ConversationMemoryStore;
  activation: ConversationActivation;
  composer: RefObject<HTMLTextAreaElement | null>;
  saveButton: RefObject<HTMLButtonElement | null>;
  load: Load;
  refresh(): Promise<unknown>;
}>;

/**
 * Saving into the per-Project memory (G27). A press sends the draft with its kept or a new
 * `saveId`; Try again resends the same `saveId` and text under the current activation; each answer
 * is settled by `settleSave`, so a late or stale answer never overwrites newer state.
 */
export function useConversationSave(scope: SaveScope) {
  const { store, activation, load } = scope;
  const { projectId, activationId } = activation;

  const send = async (request: ProjectConversationSaveRequest) => {
    const epoch = store.epoch();
    store.update(projectId, (memo) => ({
      ...memo,
      saveId: request.saveId,
      outcome: { kind: "pending" },
    }));
    const answer = await window.slopstop
      .saveConversationMessage(request)
      .catch((): SaveAnswer => ({ status: "rejected-call" }));
    const settled = settleSave(store.get(projectId), request, answer, store.epoch() !== epoch);
    if (settled === undefined) return;
    store.update(projectId, () => settled.memory);
    if (settled.focusComposer) scope.composer.current?.focus();
    if (settled.refresh) void scope.refresh();
  };

  const requestFrom = (
    memory: ConversationMemory,
    saveId: string,
  ): ProjectConversationSaveRequest => ({
    projectId,
    activationId,
    saveId,
    expectedRevision: memory.expectedRevision,
    text: memory.text,
  });

  const save = async () => {
    const memory = store.get(projectId);
    if (!canSend(load, memory, activation.readOnly)) return;
    await send(requestFrom(memory, memory.saveId ?? crypto.randomUUID()));
  };

  const tryAgain = async () => {
    const memory = store.get(projectId);
    if (!canResend(load, memory, activation.readOnly) || memory.saveId === undefined) return;
    const sent = send(requestFrom(memory, memory.saveId));
    scope.saveButton.current?.focus();
    await sent;
  };

  /**
   * Editing the draft ends its save identity; the next press mints a new one (G27). "Saved" shows
   * until the next input; a failure line stays as information (decisions log §54).
   */
  const setText = (text: string) =>
    store.update(projectId, (memo) =>
      memo.text === text || memo.outcome.kind === "pending"
        ? memo
        : { ...memo, text, saveId: undefined, outcome: afterInput(memo.outcome) },
    );

  return { save, tryAgain, setText };
}
