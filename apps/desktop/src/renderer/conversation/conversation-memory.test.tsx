import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createConversationMemory, useConversationMemoryStore } from "./conversation-memory.js";

const projectId = decodeStrict(ProjectIdSchema, "11111111-1111-4111-8111-111111111111");

describe("CNV-B32 G13: the per-Project memory store", () => {
  it("stops telling a listener about changes once it unsubscribes", () => {
    const store = createConversationMemory();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update(projectId, (memory) => ({ ...memory, text: "One" }));
    unsubscribe();
    store.update(projectId, (memory) => ({ ...memory, text: "Two" }));
    expect(listener).toHaveBeenCalledOnce();
    expect(store.get(projectId).text).toBe("Two");
  });

  it("refuses a Conversation region outside the Projects workspace", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useConversationMemoryStore())).toThrow(
      "The Conversation region needs the Projects workspace.",
    );
    quiet.mockRestore();
  });
});
