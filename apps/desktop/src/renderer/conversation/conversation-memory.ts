import type { ProjectActivationId, ProjectId } from "@slopstop/protocol";
import { createContext, useContext } from "react";
import type { SaveOutcome } from "./save-outcome.js";

/**
 * What the window remembers for one Project across region remounts and Project switches (G13,
 * G27): the draft, its save identity, the revision the next save expects, the last save's outcome,
 * and the activation the region last loaded for.
 */
export type ConversationMemory = Readonly<{
  text: string;
  saveId: string | undefined;
  expectedRevision: number;
  outcome: SaveOutcome;
  activationId: ProjectActivationId | undefined;
}>;

const empty: ConversationMemory = {
  text: "",
  saveId: undefined,
  expectedRevision: 0,
  outcome: { kind: "none" },
  activationId: undefined,
};

/** The per-Project memory, owned by the Projects workspace and read with `useSyncExternalStore`. */
export function createConversationMemory() {
  const memories = new Map<ProjectId, ConversationMemory>();
  const listeners = new Set<() => void>();
  let epoch = 0;
  return {
    /** The harness epoch: a save sent in an older one is dropped when it answers. */
    epoch: () => epoch,
    newEpoch() {
      epoch += 1;
    },
    get: (projectId: ProjectId): ConversationMemory => memories.get(projectId) ?? empty,
    update(projectId: ProjectId, change: (memory: ConversationMemory) => ConversationMemory) {
      memories.set(projectId, change(memories.get(projectId) ?? empty));
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ConversationMemoryStore = ReturnType<typeof createConversationMemory>;

const MemoryContext = createContext<ConversationMemoryStore | null>(null);
export const ConversationMemoryProvider = MemoryContext.Provider;

/** The workspace's memory store; the region only renders inside the Projects workspace. */
export function useConversationMemoryStore(): ConversationMemoryStore {
  const store = useContext(MemoryContext);
  if (store === null) throw new Error("The Conversation region needs the Projects workspace.");
  return store;
}
