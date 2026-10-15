import type { ProjectConversationSaveRequest } from "@slopstop/protocol";
import type { ConversationMemory } from "./conversation-memory.js";
import { keepsSaveId, type SaveAnswer } from "./save-outcome.js";

/** The memory a save answer leaves, and what the window does next. */
export type Settled = Readonly<{
  memory: ConversationMemory;
  refresh: boolean;
  focusComposer: boolean;
}>;

/**
 * What one save answer does to a Project's memory (G27). It changes nothing unless the memory
 * still holds this `saveId` with the save pending, or dropped and not yet resent: a late answer
 * never overwrites newer state. An answer from an older harness epoch only marks a pending save as
 * dropped. `saved` clears the draft; a replay and a conflict read the conversation again.
 */
export function settleSave(
  memory: ConversationMemory,
  request: ProjectConversationSaveRequest,
  answer: SaveAnswer,
  staleEpoch: boolean,
): Settled | undefined {
  // A pending save waits only for its own activation's answer; a dropped one takes any late answer.
  const pending = memory.outcome.kind === "pending" && request.activationId === memory.activationId;
  const waiting = pending || memory.outcome.kind === "dropped";
  if (memory.saveId !== request.saveId || !waiting) return undefined;
  return staleEpoch ? settleStale(memory) : settleAnswer(memory, answer);
}

/** An answer from an older harness epoch only marks a pending save as dropped. */
function settleStale(memory: ConversationMemory): Settled | undefined {
  if (memory.outcome.kind !== "pending") return undefined;
  return {
    memory: { ...memory, outcome: { kind: "dropped" } },
    refresh: false,
    focusComposer: false,
  };
}

/** A current answer: `saved` clears the draft; the rest keep it, renewing the saveId where due. */
function settleAnswer(memory: ConversationMemory, answer: SaveAnswer): Settled {
  const outcome = { kind: "answered", answer } as const;
  if (answer.status === "saved") {
    const expectedRevision = answer.replayed ? memory.expectedRevision : answer.revision;
    return {
      memory: { ...memory, text: "", saveId: undefined, expectedRevision, outcome },
      refresh: answer.replayed,
      focusComposer: true,
    };
  }
  const saveId = keepsSaveId(answer) ? memory.saveId : undefined;
  return {
    memory: { ...memory, saveId, outcome },
    refresh: answer.status === "conflict",
    focusComposer: false,
  };
}
