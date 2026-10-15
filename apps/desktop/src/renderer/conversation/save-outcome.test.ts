import {
  decodeStrict,
  ProjectConversationSaveResultSchema,
  projectConversationDiagnostics as rows,
} from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import {
  keepsSaveId,
  outcomeLine,
  outcomeOnReturn,
  type SaveAnswer,
  statusSlot,
} from "./save-outcome.js";

const request = {
  projectId: "00000000-0000-4000-8000-000000000010",
  activationId: "00000000-0000-4000-8000-000000000011",
  saveId: "00000000-0000-4000-8000-000000000012",
  expectedRevision: 0,
  text: "Hello",
};
const failed = (status: string, diagnostic: object): SaveAnswer =>
  decodeStrict(ProjectConversationSaveResultSchema, { status, request, diagnostic });

const saved: SaveAnswer = decodeStrict(ProjectConversationSaveResultSchema, {
  status: "saved",
  request,
  conversationMessageId: "00000000-0000-4000-8000-000000000013",
  cursor: 1,
  revision: 1,
  savedAt: "2026-10-11T12:00:00.000Z",
  replayed: false,
});
const conflict: SaveAnswer = decodeStrict(ProjectConversationSaveResultSchema, {
  status: "conflict",
  request,
  currentRevision: 2,
});
const rejectedCall: SaveAnswer = { status: "rejected-call" };

/** Every save answer the window can meet, keyed by status and row (two codes are shared). */
const answers: ReadonlyArray<readonly [string, SaveAnswer]> = [
  ["saved", saved],
  ["conflict", conflict],
  ["rejected", failed("rejected", rows.saveIdReused)],
  ["uncertain", failed("uncertain", rows.saveUnconfirmed)],
  ["read-only", failed("read-only", rows.readOnly)],
  ["writer-unavailable", failed("writer-unavailable", rows.writerUnavailable)],
  ["stale-writer", failed("stale-writer", rows.staleWriter)],
  ["inactive", failed("inactive", rows.inactive)],
  ["project-mismatch", failed("project-mismatch", rows.projectMismatch)],
  ["stale-activation", failed("stale-activation", rows.staleActivation)],
  ["coordinator-unavailable", failed("coordinator-unavailable", rows.coordinatorUnavailable)],
  ["unavailable storageUnavailable", failed("unavailable", rows.storageUnavailable)],
  ["unavailable connectionLost", failed("unavailable", rows.connectionLost)],
  ["broken storageBroken", failed("broken", rows.storageBroken)],
  ["broken harnessInternalFailure", failed("broken", rows.harnessInternalFailure)],
  ["rejected call", rejectedCall],
];
const tryAgainRows = new Set([
  "uncertain",
  "read-only",
  "unavailable storageUnavailable",
  "unavailable connectionLost",
]);
const newSaveIdRows = new Set(["saved", "conflict", "rejected"]);
const keptOnReturn = new Set([
  "uncertain",
  "unavailable storageUnavailable",
  "unavailable connectionLost",
]);

describe("the save outcome rules", () => {
  it.each(answers)("keeps or renews the saveId after %s", (key, answer) => {
    expect(keepsSaveId(answer)).toBe(!newSaveIdRows.has(key));
  });

  it.each(answers)("offers Try again after %s only for retryable outcomes", (key, answer) => {
    expect(outcomeLine({ kind: "answered", answer })?.tryAgain ?? false).toBe(
      tryAgainRows.has(key),
    );
  });

  it.each(answers.filter(([key]) => key !== "saved" && key !== "conflict"))(
    "words %s with its reason and tone",
    (key, answer) => {
      const line = outcomeLine({ kind: "answered", answer });
      if (key === "uncertain")
        expect(line).toMatchObject({ tone: "unknown", title: "Not confirmed." });
      else if (key.startsWith("broken"))
        expect(line).toMatchObject({
          tone: "broken",
          title: "Not saved.",
          code: expect.any(String),
        });
      else if (key === "rejected call")
        expect(line).toEqual({
          tone: "failure",
          title: "Not saved.",
          message: "The desktop could not complete this save.",
          tryAgain: false,
        });
      else expect(line).toMatchObject({ tone: "failure", title: "Not saved." });
      // Decisions log §56 (T14): a stale activation shows the renderer's own recovery copy.
      const message =
        key === "stale-activation"
          ? "This Project was reopened elsewhere. Restart Ragnarok to open it again."
          : "diagnostic" in answer
            ? answer.diagnostic.message
            : undefined;
      if (message !== undefined) expect(line?.message).toBe(message);
    },
  );

  it("words saved, conflict and a dropped save", () => {
    expect(outcomeLine({ kind: "answered", answer: saved })).toEqual({
      tone: "saved",
      title: "Saved",
      tryAgain: false,
    });
    expect(outcomeLine({ kind: "answered", answer: conflict })).toEqual({
      tone: "plain",
      title: "The conversation changed and was reloaded. Save again to add your message.",
      tryAgain: false,
    });
    expect(outcomeLine({ kind: "dropped" })).toEqual({
      tone: "unknown",
      title: "Not confirmed.",
      message: rows.saveUnconfirmed.message,
      tryAgain: true,
    });
  });

  it.each(answers)(
    "decides what %s shows when the Project loads under a new activation",
    (key, answer) => {
      const line = outcomeLine(outcomeOnReturn({ kind: "answered", answer }));
      expect(line?.tryAgain ?? false).toBe(keptOnReturn.has(key));
      if (!keptOnReturn.has(key)) expect(line).toBeUndefined();
    },
  );

  it("shows an old pending save and a dropped save as not confirmed on return", () => {
    for (const outcome of [{ kind: "pending" }, { kind: "dropped" }] as const)
      expect(outcomeLine(outcomeOnReturn(outcome))).toEqual(outcomeLine({ kind: "dropped" }));
  });
});

describe("the status slot precedence", () => {
  const kept = { tone: "failure", title: "Not saved.", message: "Reason", tryAgain: true } as const;
  it.each([
    [
      { loadFailure: "Could not load this conversation.", overLimit: true, saving: true },
      "Could not load this conversation.",
    ],
    [{ overLimit: true, saving: true, loading: true }, "This message is longer than 32 KiB."],
    [{ saving: true, loading: true, kept }, "Saving…"],
    [{ loading: true, kept }, "Loading messages…"],
    [{ kept }, "Not saved."],
    [{}, undefined],
  ])("shows the highest line first: %o", (state, title) => {
    expect(statusSlot(state)?.title).toBe(title);
  });
});
