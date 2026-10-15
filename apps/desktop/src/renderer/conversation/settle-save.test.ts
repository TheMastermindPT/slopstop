import {
  decodeStrict,
  type ProjectConversationSaveRequest,
  ProjectConversationSaveRequestSchema,
  projectConversationDiagnostics as rows,
} from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import type { ConversationMemory } from "./conversation-memory.js";
import type { SaveAnswer } from "./save-outcome.js";
import { settleSave } from "./settle-save.js";

const request: ProjectConversationSaveRequest = decodeStrict(ProjectConversationSaveRequestSchema, {
  projectId: "11111111-1111-4111-8111-111111111111",
  activationId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  saveId: "99999999-9999-4999-8999-000000000001",
  expectedRevision: 2,
  text: "Hello",
});

function memoryWith(outcome: ConversationMemory["outcome"]): ConversationMemory {
  return {
    text: "Hello",
    saveId: request.saveId,
    expectedRevision: 2,
    outcome,
    activationId: request.activationId,
  };
}

const newerActivation = decodeStrict(ProjectConversationSaveRequestSchema, {
  ...request,
  activationId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
}).activationId;

const unavailable: SaveAnswer = {
  status: "unavailable",
  request,
  diagnostic: rows.storageUnavailable,
};

describe("CNV-B32 G27: settling a save answer", () => {
  it("ignores a second answer for a save that has already answered", () => {
    const answered = memoryWith({ kind: "answered", answer: unavailable });
    expect(settleSave(answered, request, unavailable, false)).toBeUndefined();
  });

  it("marks a pending save from an older harness epoch as dropped, without a re-read or focus", () => {
    expect(settleSave(memoryWith({ kind: "pending" }), request, unavailable, true)).toEqual({
      memory: memoryWith({ kind: "dropped" }),
      refresh: false,
      focusComposer: false,
    });
  });

  it("leaves a dropped save as it is when another older-epoch answer arrives", () => {
    expect(settleSave(memoryWith({ kind: "dropped" }), request, unavailable, true)).toBeUndefined();
  });

  it("ignores an older activation's answer once Try again resent the save under a new one", () => {
    const resent = { ...memoryWith({ kind: "pending" }), activationId: newerActivation };
    expect(settleSave(resent, request, unavailable, false)).toBeUndefined();
  });

  it("accepts an older activation's late answer for a dropped save", () => {
    const dropped = { ...memoryWith({ kind: "dropped" }), activationId: newerActivation };
    expect(settleSave(dropped, request, unavailable, false)?.memory.outcome).toEqual({
      kind: "answered",
      answer: unavailable,
    });
  });

  it.each([
    ["conflict", { status: "conflict", request, currentRevision: 7 } as const, true],
    ["unavailable", unavailable, false],
  ])("reads the conversation again only after a conflict (%s)", (_key, answer, refresh) => {
    expect(settleSave(memoryWith({ kind: "pending" }), request, answer, false)?.refresh).toBe(
      refresh,
    );
  });
});
