import {
  decodeStrict,
  type HarnessStatus,
  type ProjectConversationReadRequest,
  type ProjectConversationReadResult,
  ProjectConversationReadResultSchema,
  type ProjectConversationSaveRequest,
  type ProjectConversationSaveResult,
  ProjectConversationSaveResultSchema,
  projectConversationDiagnostics as rows,
} from "@slopstop/protocol";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readyStatus } from "../test-api.js";
import {
  controls,
  gate,
  openProject,
  projectA,
  readAnswer,
  renderWindow,
  savedAnswer,
} from "./conversation-test-harness.js";

type SaveAnswer = ProjectConversationSaveResult | "rejected";
type Row = readonly [string, (request: ProjectConversationSaveRequest) => SaveAnswer];

const failed =
  (status: string, diagnostic: object) =>
  (request: ProjectConversationSaveRequest): SaveAnswer =>
    decodeStrict(ProjectConversationSaveResultSchema, { status, request, diagnostic });

/** Every save answer except `saved`, keyed by status and row (two codes are shared). */
const saveRows: ReadonlyArray<Row> = [
  ["conflict", (request) => ({ status: "conflict", request, currentRevision: 7 })],
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
  ["broken protocolMessageInvalid", failed("broken", rows.protocolMessageInvalid)],
  ["broken protocolVersionUnsupported", failed("broken", rows.protocolVersionUnsupported)],
  ["preload call rejected", () => "rejected"],
];
const tryAgainRows = new Set([
  "uncertain",
  "read-only",
  "unavailable storageUnavailable",
  "unavailable connectionLost",
]);
const newSaveIdRows = new Set(["conflict", "rejected"]);

/** A scripted save that answers each press in turn; the last answer repeats. */
function scriptedSaves(
  answers: ReadonlyArray<
    (request: ProjectConversationSaveRequest) => SaveAnswer | Promise<SaveAnswer>
  >,
) {
  let next = 0;
  return async (request: ProjectConversationSaveRequest) => {
    const answer = await answers[Math.min(next, answers.length - 1)]?.(request);
    next += 1;
    if (answer === "rejected" || answer === undefined) throw new Error("IPC failure");
    return answer;
  };
}

async function typeAndSave(text: string) {
  const view = controls();
  fireEvent.change(view.composer(), { target: { value: text } });
  fireEvent.click(view.save());
  await waitFor(() => expect(view.status().textContent).not.toContain("Saving…"));
}

/** The first item, or a named failure when the call it stands for was never made. */
function firstOf<T>(items: ReadonlyArray<T>, missing: string): T {
  const first = items[0];
  if (first === undefined) throw new Error(missing);
  return first;
}

/** The first save the window sent; a save that was never sent fails by name. */
const firstSave = () => firstOf(sentSaves(), "No save was sent");

const sentSaves = () =>
  vi.mocked(window.slopstop.saveConversationMessage).mock.calls.map(([request]) => request);

const conflictLine = "The conversation changed and was reloaded. Save again to add your message.";

/** Where an answer's words appear (the alert or the status slot) and which words they are. */
function expectedSaveLine(sample: SaveAnswer) {
  if (sample === "rejected")
    return {
      alert: false,
      words: ["Not saved.", "The desktop could not complete this save."],
      code: false,
    };
  if (sample.status === "conflict") return { alert: false, words: [conflictLine], code: false };
  if (sample.status === "saved") throw new Error("A saved answer is not a fault");
  const title = sample.status === "uncertain" ? "Not confirmed." : "Not saved.";
  const broken = sample.status === "broken";
  const code = broken ? [`Code ${sample.diagnostic.code}`] : [];
  // Decisions log §56 (T14): a stale activation names the step that recovers, as the load notice does.
  const message =
    sample.status === "stale-activation"
      ? "This Project was reopened elsewhere. Restart Ragnarok to open it again."
      : sample.diagnostic.message;
  return { alert: broken, words: [title, message, ...code], code: broken };
}

function expectSaveLine(
  view: ReturnType<typeof controls>,
  line: ReturnType<typeof expectedSaveLine>,
) {
  const alert = view.region.queryByRole("alert");
  expect(alert !== null).toBe(line.alert);
  const text = (line.alert ? alert : view.status())?.textContent ?? "";
  for (const word of line.words) expect(text).toContain(word);
  expect(text.includes("Code ")).toBe(line.code);
}

describe("CNV-B32 keeps the text when a save answers", () => {
  it.each(saveRows)("%s", async (key, answer) => {
    const { user } = renderWindow({ save: scriptedSaves([answer]) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    const text = "  Keep me\nexactly ";
    await typeAndSave(text);
    expect((view.composer() as HTMLTextAreaElement).value).toBe(text);
    expectSaveLine(view, expectedSaveLine(answer(firstSave())));
    const tryAgain = view.region.queryByRole("button", { name: "Try again" });
    expect(tryAgain !== null).toBe(tryAgainRows.has(key));
  });

  it.each(saveRows.filter(([key]) => tryAgainRows.has(key)))(
    "resends the same save from Try again after %s and moves focus to Save",
    async (_key, answer) => {
      const pending = gate<ProjectConversationSaveResult>();
      const { user } = renderWindow({ save: scriptedSaves([answer, () => pending.promise]) });
      const view = await openProject(user);
      await waitFor(() => expect(document.activeElement).toBe(view.composer()));
      await typeAndSave("Again");
      await user.click(view.region.getByRole("button", { name: "Try again" }));
      const [first, second] = sentSaves();
      expect(second).toEqual(first);
      expect(document.activeElement).toBe(view.save());
      expect(view.save().textContent).toBe("Saving…");
    },
  );

  it.each(saveRows)("keeps or renews the saveId after %s", async (key, answer) => {
    const { user } = renderWindow({ save: scriptedSaves([answer, answer]) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Same text");
    fireEvent.click(view.save());
    await waitFor(() => expect(sentSaves()).toHaveLength(2));
    const [first, second] = sentSaves();
    expect(second?.saveId === first?.saveId).toBe(!newSaveIdRows.has(key));
  });

  it("mints a new saveId after the text is edited", async () => {
    const { user } = renderWindow({
      save: scriptedSaves([failed("unavailable", rows.storageUnavailable)]),
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("First");
    await typeAndSave("Edited");
    const [first, second] = sentSaves();
    expect(second?.saveId).not.toBe(first?.saveId);
    expect(second?.text).toBe("Edited");
  });

  it("uses the re-read revision after a conflict, and that press saves", async () => {
    let reads = 0;
    const { user } = renderWindow({
      read: async (request) => {
        reads += 1;
        return readAnswer(request, { texts: ["Other"], revision: reads === 1 ? 1 : 2 });
      },
      save: scriptedSaves([
        (request) => ({ status: "conflict", request, currentRevision: 2 }),
        (request) => savedAnswer(request, 3),
      ]),
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Mine");
    await waitFor(() => expect(reads).toBe(2));
    await typeAndSave("Mine");
    expect(sentSaves()[1]?.expectedRevision).toBe(2);
    expect(view.status().textContent).toContain("Saved");
  });

  it("sends a new saveId with the old revision when the text is edited after uncertain", async () => {
    const { user } = renderWindow({
      save: scriptedSaves([
        failed("uncertain", rows.saveUnconfirmed),
        (request) => ({ status: "conflict", request, currentRevision: 1 }),
      ]),
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Original");
    await typeAndSave("Original, edited");
    const [first, second] = sentSaves();
    expect(second?.saveId).not.toBe(first?.saveId);
    expect(second?.expectedRevision).toBe(first?.expectedRevision);
    expect((view.composer() as HTMLTextAreaElement).value).toBe("Original, edited");
  });
});

/** Opens A, types, and starts a save that the test answers later. */
async function pendingSaveInA(read?: Parameters<typeof renderWindow>[0]["read"]) {
  const answer = gate<ProjectConversationSaveResult>();
  const rendered = renderWindow({
    ...(read === undefined ? {} : { read }),
    save: scriptedSaves([() => answer.promise, (request) => savedAnswer(request, 9)]),
  });
  const view = await openProject(rendered.user);
  await waitFor(() => expect(document.activeElement).toBe(view.composer()));
  fireEvent.change(view.composer(), { target: { value: "From A" } });
  fireEvent.click(view.save());
  await waitFor(() => expect(view.status().textContent).toContain("Saving…"));
  return { ...rendered, answer, request: firstSave };
}

describe("CNV-B32 drain order and per-Project memory", () => {
  it("lists a save that answered saved before the switch, on return", async () => {
    let committed = false;
    // The harness lists the message once it has committed it, as a real read would.
    const { user, answer, request } = await pendingSaveInA(async (read) =>
      committed ? readAnswer(read, { texts: ["From A"], revision: 1 }) : readAnswer(read),
    );
    committed = true;
    await act(async () => {
      answer.open(savedAnswer(request(), 1));
    });
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    await waitFor(() =>
      expect(
        controls()
          .messages()
          .some((text) => text.includes("From A")),
      ).toBe(true),
    );
    expect((controls().composer() as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps an unavailable answer with Try again on return, resending the same saveId", async () => {
    const { user, answer, request } = await pendingSaveInA();
    await act(async () => {
      answer.open({
        status: "unavailable",
        request: request(),
        diagnostic: rows.storageUnavailable,
      });
    });
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    await waitFor(() =>
      expect(controls().status().textContent).toContain(rows.storageUnavailable.message),
    );
    await user.click(controls().region.getByRole("button", { name: "Try again" }));
    const [first, second] = sentSaves();
    expect(second?.saveId).toBe(first?.saveId);
    expect(second?.activationId).not.toBe(first?.activationId);
  });

  it("drops the Try again wording with the button once an uncertain draft is edited", async () => {
    const { user } = renderWindow({
      save: scriptedSaves([failed("uncertain", rows.saveUnconfirmed)]),
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Unsure");
    expect(view.region.getByRole("button", { name: "Try again" })).toBeTruthy();
    fireEvent.change(view.composer(), { target: { value: "Unsure, edited" } });
    // Deep review I3/Q17: the line follows the button; no Try again, no Try again wording.
    expect(view.region.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(view.status().textContent).toBe("Not confirmed. The save could not be confirmed.");
  });

  it("drops the Try again wording when a kept uncertain save returns to a broken load", async () => {
    let readsOfA = 0;
    const { user } = renderWindow({
      save: scriptedSaves([failed("uncertain", rows.saveUnconfirmed)]),
      read: async (request) => {
        if (request.projectId !== projectA) return readAnswer(request);
        readsOfA += 1;
        if (readsOfA === 1) return readAnswer(request);
        return decodeStrict(ProjectConversationReadResultSchema, {
          status: "broken",
          request,
          diagnostic: rows.storageBroken,
        });
      },
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Unsure");
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    await waitFor(() => expect(document.getElementById("conversation-load-title")).not.toBeNull());
    // Re-review Q1: the concealed row is still announced, so it must not offer a hidden button.
    expect(controls().region.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(controls().status().textContent).toBe("Not confirmed. The save could not be confirmed.");
  });

  it("hides Try again once the draft is edited after a kept failure, and saves the edit anew", async () => {
    const { user } = renderWindow({
      save: scriptedSaves([
        failed("unavailable", rows.storageUnavailable),
        (request) => savedAnswer(request, 1),
      ]),
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Original");
    expect(view.region.getByRole("button", { name: "Try again" })).toBeTruthy();
    fireEvent.change(view.composer(), { target: { value: "Original, edited" } });
    // Pedro's decision (decisions log §54): the failure line may stay, Try again goes.
    expect(view.region.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(view.status().textContent).toContain(rows.storageUnavailable.message);
    fireEvent.click(view.save());
    await waitFor(() => expect(view.status().textContent).toContain("Saved"));
    const [first, second] = sentSaves();
    expect(second?.saveId).not.toBe(first?.saveId);
    expect(second?.text).toBe("Original, edited");
  });

  it.each([
    ["replayed", true],
    ["not replayed", false],
  ] as const)(
    "applies a saved %s answer to Try again after the return, clearing the composer",
    async (_key, replayed) => {
      const { user, read } = renderWindow({
        save: scriptedSaves([
          failed("unavailable", rows.storageUnavailable),
          (request) => savedAnswer(request, 3, replayed),
        ]),
      });
      const view = await openProject(user);
      await waitFor(() => expect(document.activeElement).toBe(view.composer()));
      await typeAndSave("Kept");
      await openProject(user, "repo-b");
      await openProject(user, "repo-a");
      const reads = read.mock.calls.length;
      await user.click(await controls().region.findByRole("button", { name: "Try again" }));
      await waitFor(() => expect(controls().status().textContent).toContain("Saved"));
      expect((controls().composer() as HTMLTextAreaElement).value).toBe("");
      if (replayed) await waitFor(() => expect(read.mock.calls.length).toBe(reads + 1));
      else
        expect(
          controls()
            .messages()
            .filter((row) => row.includes("Kept")),
        ).toHaveLength(1);
    },
  );

  it.each([
    [
      "unavailable",
      failed("unavailable", rows.storageUnavailable),
      `Not saved. ${rows.storageUnavailable.message}`,
    ],
    [
      "uncertain",
      failed("uncertain", rows.saveUnconfirmed),
      "Not confirmed. The save could not be confirmed.",
    ],
  ] as const)(
    "offers no Try again when the Project returns read-only with a kept %s answer",
    async (_key, answer, line) => {
      const { user, view } = await openReadOnlyOnReturn(answer);
      await typeAndSave("Kept");
      expect(view.region.getByRole("button", { name: "Try again" })).toBeTruthy();
      await returnReadOnly(user);
      expect(controls().region.queryByRole("button", { name: "Try again" })).toBeNull();
      // Final targeted run, mutant 234: only the not-confirmed line changes under read-only.
      expect(controls().status().textContent).toBe(line);
    },
  );

  it.each([
    ["uncertain", failed("uncertain", rows.saveUnconfirmed)],
    ["dropped", () => gate<ProjectConversationSaveResult>().promise],
  ] as const)(
    "says only that a %s save could not be confirmed when the Project returns read-only",
    async (_key, answer) => {
      const { user, view } = await openReadOnlyOnReturn(answer);
      fireEvent.change(view.composer(), { target: { value: "Kept" } });
      fireEvent.click(view.save());
      await returnReadOnly(user);
      // Decisions log §58 (F7): no Try again here, so the line does not ask for one.
      await waitFor(() => expect(controls().status().textContent).toContain("Not confirmed."));
      expect(controls().status().textContent).toBe(
        "Not confirmed. The save could not be confirmed.",
      );
    },
  );

  it("keeps Try again unavailable and sends nothing while the return read is pending", async () => {
    const returnRead = gate<ProjectConversationReadResult>();
    let readsOfA = 0;
    const { user, answer, request } = await pendingSaveInA(async (read) => {
      if (read.projectId !== projectA) return readAnswer(read);
      readsOfA += 1;
      return readsOfA === 1 ? readAnswer(read) : returnRead.promise;
    });
    await act(async () => {
      answer.open({
        status: "unavailable",
        request: request(),
        diagnostic: rows.storageUnavailable,
      });
    });
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    const tryAgain = await controls().region.findByRole("button", { name: "Try again" });
    expect(tryAgain.getAttribute("aria-disabled")).toBe("true");
    await user.click(tryAgain);
    expect(sentSaves()).toHaveLength(1);
  });

  it.each([
    ["writer-unavailable", rows.writerUnavailable],
    ["read-only", rows.readOnly],
  ] as const)(
    "clears a %s answer on return and keeps the text and saveId",
    async (status, diagnostic) => {
      const { user, answer, request } = await pendingSaveInA();
      await act(async () => {
        answer.open(
          decodeStrict(ProjectConversationSaveResultSchema, {
            status,
            request: request(),
            diagnostic,
          }),
        );
      });
      await openProject(user, "repo-b");
      await openProject(user, "repo-a");
      await waitFor(() =>
        expect((controls().composer() as HTMLTextAreaElement).value).toBe("From A"),
      );
      expect(controls().status().textContent).toBe("");
      fireEvent.click(controls().save());
      await waitFor(() => expect(sentSaves()).toHaveLength(2));
      expect(sentSaves()[1]?.saveId).toBe(sentSaves()[0]?.saveId);
    },
  );

  it("shows a save still pending on return as not confirmed, then applies its late result", async () => {
    const { user, answer, request } = await pendingSaveInA();
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    await waitFor(() => expect(controls().status().textContent).toContain("Not confirmed."));
    expect((controls().composer() as HTMLTextAreaElement).readOnly).toBe(false);
    expect(controls().region.getByRole("button", { name: "Try again" })).toBeTruthy();
    await act(async () => {
      answer.open(savedAnswer(request(), 1));
    });
    await waitFor(() => expect((controls().composer() as HTMLTextAreaElement).value).toBe(""));
  });

  it("ignores a late result when a newer save exists", async () => {
    const { user, answer, request } = await pendingSaveInA();
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    await waitFor(() => expect(controls().status().textContent).toContain("Not confirmed."));
    fireEvent.change(controls().composer(), { target: { value: "Newer" } });
    await act(async () => {
      answer.open(savedAnswer(request(), 1));
    });
    expect((controls().composer() as HTMLTextAreaElement).value).toBe("Newer");
  });

  it("keeps each Project's draft and saveId to itself", async () => {
    const { user, answer, request } = await pendingSaveInA();
    await openProject(user, "repo-b");
    expect((controls().composer() as HTMLTextAreaElement).value).toBe("");
    await act(async () => {
      answer.open({ status: "uncertain", request: request(), diagnostic: rows.saveUnconfirmed });
    });
    await waitFor(() => expect(document.activeElement).toBe(controls().composer()));
    await typeAndSave("From B");
    expect(sentSaves()[1]?.saveId).not.toBe(sentSaves()[0]?.saveId);
    await openProject(user, "repo-a");
    await waitFor(() =>
      expect((controls().composer() as HTMLTextAreaElement).value).toBe("From A"),
    );
    expect(controls().status().textContent).toContain("Not confirmed.");
    expect(controls().region.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("CNV-B31/B32 drop late results from an older harness epoch", () => {
  /** Renders with a harness status listener the test can drive. */
  function withHarness(handlers: Parameters<typeof renderWindow>[0]) {
    let notify: (status: HarnessStatus) => void = () => undefined;
    const rendered = renderWindow({
      ...handlers,
      subscribeHarnessStatus: (listener) => {
        notify = listener;
        return () => undefined;
      },
    });
    return { ...rendered, restart: () => act(async () => notify({ ...readyStatus, attempt: 2 })) };
  }

  it("drops a read pending across a harness restart", async () => {
    const reads: Array<ReturnType<typeof gate<ReturnType<typeof readAnswer>>>> = [];
    const requests: ProjectConversationReadRequest[] = [];
    const { user, restart } = withHarness({
      read: (request) => {
        const next = gate<ReturnType<typeof readAnswer>>();
        reads.push(next);
        requests.push(request);
        return next.promise;
      },
    });
    await openProject(user);
    await restart();
    await openProject(user);
    await act(async () => {
      reads[0]?.open(
        readAnswer(firstOf(requests, "No read was sent"), {
          texts: ["Stale"],
          revision: 1,
        }),
      );
    });
    expect(controls().messages()).toEqual([]);
  });

  it("drops a save pending across a harness restart and offers Try again with the same saveId", async () => {
    const answer = gate<ProjectConversationSaveResult>();
    const { user, restart } = withHarness({
      save: scriptedSaves([() => answer.promise, (request) => savedAnswer(request, 2)]),
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    fireEvent.change(view.composer(), { target: { value: "Across" } });
    fireEvent.click(view.save());
    await restart();
    await act(async () => {
      answer.open(savedAnswer(firstSave(), 1));
    });
    await openProject(user);
    await waitFor(() =>
      expect(controls().status().textContent).toContain(rows.saveUnconfirmed.message),
    );
    expect(controls().status().textContent).toContain("Not confirmed.");
    expect((controls().composer() as HTMLTextAreaElement).value).toBe("Across");
    expect((controls().composer() as HTMLTextAreaElement).readOnly).toBe(false);
    expect(controls().status().textContent).not.toContain("Saved");
    await user.click(controls().region.getByRole("button", { name: "Try again" }));
    expect(sentSaves()[1]?.saveId).toBe(sentSaves()[0]?.saveId);
  });
});

/** Path data of the staves the status row may carry (Runa v2). */
const staves = {
  check: "M4.5 12L9.5 17L19.5 7",
  "circle-x": "M12 2.5L21.5 12L12 21.5L2.5 12ZM9 9L15 15M15 9L9 15",
  "circle-help": "M12 2.5L21.5 12L12 21.5L2.5 12ZM8.5 9L12 6.5L15.5 9V10.5L12 13V14M12 17V17.5",
} as const;

/** The status row: its tone, its stave, and whether Try again sits at its end. */
function statusRow() {
  const slot = controls().status();
  const row = slot.parentElement;
  return {
    tone: row?.getAttribute("data-tone") ?? null,
    stave: slot.querySelector("svg path")?.getAttribute("d") ?? null,
    tryAgainInRow: row?.querySelector("button")?.textContent?.includes("Try again") === true,
  };
}

describe("ui-ux review 1 C5, C6, C7, C9: the status row's tones (decisions log §54)", () => {
  it.each([
    [
      "uncertain",
      {
        answer: failed("uncertain", rows.saveUnconfirmed),
        tone: "unknown",
        stave: staves["circle-help"],
        tryAgainInRow: true,
      },
    ],
    [
      "unavailable",
      {
        answer: failed("unavailable", rows.storageUnavailable),
        tone: "failure",
        stave: staves["circle-x"],
        tryAgainInRow: true,
      },
    ],
    [
      "inactive",
      {
        answer: failed("inactive", rows.inactive),
        tone: "failure",
        stave: staves["circle-x"],
        tryAgainInRow: false,
      },
    ],
    [
      "preload call rejected",
      {
        answer: () => "rejected" as const,
        tone: "failure",
        stave: staves["circle-x"],
        tryAgainInRow: false,
      },
    ],
  ] as const)("shows %s in its tone with its stave", async (_key, row) => {
    const { user } = renderWindow({ save: scriptedSaves([row.answer]) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Toned");
    expect(statusRow()).toEqual({
      tone: row.tone,
      stave: row.stave,
      tryAgainInRow: row.tryAgainInRow,
    });
  });

  it("shows Saved with the check stave and the over-limit line in the failure tone", async () => {
    const { user } = renderWindow({ save: async (request) => savedAnswer(request, 1) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await typeAndSave("Done");
    await waitFor(() => expect(controls().status().textContent).toContain("Saved"));
    expect(statusRow()).toEqual({ tone: "saved", stave: staves.check, tryAgainInRow: false });
    fireEvent.change(view.composer(), { target: { value: `${"é".repeat(16_384)}a` } });
    expect(statusRow()).toEqual({
      tone: "failure",
      stave: staves["circle-x"],
      tryAgainInRow: false,
    });
  });
});

let activationCount = 0;
/** An activation answer for this request, read-write or read-only. */
function activationFor(request: { projectId: string }, readOnly: boolean) {
  activationCount += 1;
  return {
    status: "active",
    request,
    access: readOnly ? "read-only" : "read-write",
    activationId: `cccccccc-cccc-4ccc-8ccc-${String(activationCount).padStart(12, "0")}`,
    writerGeneration: readOnly ? null : 1,
    ...(readOnly
      ? {
          diagnostic: {
            code: "WRITER_UNAVAILABLE",
            message: "Another session owns the writer.",
            retryable: true,
          },
        }
      : {}),
  };
}
const readOnlyActivation = (request: { projectId: string }) => activationFor(request, true);
const readWriteActivation = (request: { projectId: string }) => activationFor(request, false);

/** Opens repo-a read-write with scripted saves; every later activation of repo-a is read-only. */
async function openReadOnlyOnReturn(
  answer: (request: ProjectConversationSaveRequest) => SaveAnswer | Promise<SaveAnswer>,
) {
  let activationsOfA = 0;
  const { user } = renderWindow({
    save: scriptedSaves([answer]),
    activate: async (request) => {
      if (request.projectId !== projectA) return readWriteActivation(request);
      activationsOfA += 1;
      return activationsOfA > 1 ? readOnlyActivation(request) : readWriteActivation(request);
    },
  });
  const view = await openProject(user);
  await waitFor(() => expect(document.activeElement).toBe(view.composer()));
  return { user, view };
}

/** Switches to repo-b and back, and waits for repo-a's read-only line. */
async function returnReadOnly(user: Awaited<ReturnType<typeof openReadOnlyOnReturn>>["user"]) {
  await openProject(user, "repo-b");
  await openProject(user, "repo-a");
  await waitFor(() =>
    expect(controls().region.getByText(`Read only: ${rows.readOnly.message}`)).toBeTruthy(),
  );
}
