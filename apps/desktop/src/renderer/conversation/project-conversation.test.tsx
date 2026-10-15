import {
  decodeStrict,
  type ProjectConversationReadRequest,
  ProjectConversationReadRequestSchema,
  type ProjectConversationReadResult,
  type ProjectConversationSaveResult,
  projectConversationDiagnostics,
} from "@slopstop/protocol";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  controls,
  gate,
  note,
  openProject,
  projectA,
  projectB,
  readAnswer,
  renderWindow,
  savedAnswer,
} from "./conversation-test-harness.js";
import { savedAtLabel } from "./saved-at.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CNV-B18 saves locally and shows Saved only after confirmation", () => {
  it("shows the exact note", async () => {
    const { user } = renderWindow({});
    const { region } = await openProject(user);
    expect(region.getByText(note, { exact: true })).toBeTruthy();
  });

  it.each([
    ["a read with revision 201", 201],
    ["a conversation that does not exist yet", 0],
  ])("sends the first save after %s with the loaded revision", async (_label, revision) => {
    const pending = gate<ProjectConversationSaveResult>();
    const { user, save } = renderWindow({
      read: async (request) =>
        revision === 0
          ? readAnswer(request)
          : readAnswer(request, { texts: ["Earlier"], revision }),
      save: () => pending.promise,
    });
    const view = await openProject(user);
    await user.type(view.composer(), "Hello");
    await user.click(view.save());
    expect(save).toHaveBeenCalledOnce();
    const request = save.mock.calls[0]?.[0];
    expect(request).toEqual({
      projectId: projectA,
      activationId: expect.any(String),
      saveId: expect.stringMatching(uuid),
      expectedRevision: revision,
      text: "Hello",
    });
  });

  it("keeps a pending save focusable, read-only and unrepeatable", async () => {
    const pending = gate<ProjectConversationSaveResult>();
    const { user, save } = renderWindow({ save: () => pending.promise });
    const view = await openProject(user);
    await user.type(view.composer(), "Hello");
    await user.click(view.save());
    expect(view.status().textContent).toContain("Saving…");
    expect(view.status().textContent).not.toContain("Saved");
    const button = view.save();
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.textContent).toBe("Saving…");
    expect((view.composer() as HTMLTextAreaElement).readOnly).toBe(true);
    // A pending save is read-only for a moment, but keeps its placeholder (ui-ux review 2).
    expect((view.composer() as HTMLTextAreaElement).placeholder).toBe("Write a message");
    view.composer().focus();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.click(button);
    view.composer().focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(save).toHaveBeenCalledOnce();
  });

  it("lists the saved message and carries the returned revision into the next save", async () => {
    const { user, save } = renderWindow({
      save: async (request) => savedAnswer(request, request.expectedRevision + 1),
    });
    const view = await openProject(user);
    await user.type(view.composer(), "First");
    await user.click(view.save());
    await waitFor(() => expect(view.status().textContent).toContain("Saved"));
    expect(view.messages().some((text) => text.includes("First"))).toBe(true);
    expect((view.composer() as HTMLTextAreaElement).value).toBe("");
    expect(document.activeElement).toBe(view.composer());
    await user.type(view.composer(), "Second");
    await user.click(view.save());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]?.[0].expectedRevision).toBe(1);
  });

  it("reads the conversation again after a replayed save", async () => {
    const { user, read } = renderWindow({
      save: async (request) => savedAnswer(request, 4, true),
    });
    const view = await openProject(user);
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    await user.type(view.composer(), "Again");
    await user.click(view.save());
    await waitFor(() => expect(view.status().textContent).toContain("Saved"));
    expect(read).toHaveBeenCalledTimes(2);
    expect((view.composer() as HTMLTextAreaElement).value).toBe("");
  });

  it("sends the composer value unchanged", async () => {
    const pending = gate<ProjectConversationSaveResult>();
    const { user, save } = renderWindow({ save: () => pending.promise });
    const view = await openProject(user);
    const text = "  leading\ttab\nsecond line  ";
    await act(async () => {
      await user.click(view.composer());
      await user.paste(text);
    });
    await user.click(view.save());
    expect(save.mock.calls[0]?.[0].text).toBe(text);
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

/** 201 messages over three pages of 120, 50 and 31, by the request's `after`. */
function pagedRead(
  request: ProjectConversationReadRequest,
): Promise<ProjectConversationReadResult> {
  const texts = (from: number, count: number) =>
    Array.from({ length: count }, (_value, index) => `m${from + index}`);
  if (request.after === null)
    return Promise.resolve(
      readAnswer(request, { texts: texts(1, 120), revision: 201, nextCursor: 120 }),
    );
  if (request.after === 120)
    return Promise.resolve(
      readAnswer(request, { texts: texts(121, 50), revision: 201, first: 121, nextCursor: 170 }),
    );
  return Promise.resolve(
    readAnswer(request, { texts: texts(171, 31), revision: 201, first: 171, nextCursor: null }),
  );
}

describe("CNV-B31 reloads all pages on every activation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows every page in cursor order after mount and after a new activation", async () => {
    const { user, read } = renderWindow({ read: pagedRead });
    const view = await openProject(user);
    await waitFor(() => expect(view.messages()).toHaveLength(201));
    expect(view.messages().map((text) => /m\d+/.exec(text)?.[0])).toEqual(
      Array.from({ length: 201 }, (_value, index) => `m${index + 1}`),
    );
    expect(read.mock.calls.map(([request]) => request.after)).toEqual([null, 120, 170]);
    await openProject(user, "repo-b");
    await openProject(user, "repo-a");
    await waitFor(() => expect(controls().messages()).toHaveLength(201));
    const reads = read.mock.calls.filter(([request]) => request.projectId === projectA);
    expect(reads.map(([request]) => request.after)).toEqual([null, 120, 170, null, 120, 170]);
  });

  it("describes Save by the loading line only after 300 ms, and saves nothing while loading", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = gate<ProjectConversationReadResult>();
    const { user, save } = renderWindow(
      { read: () => first.promise },
      { advanceTimers: vi.advanceTimersByTime },
    );
    const view = await openProject(user);
    await user.type(view.composer(), "Draft");
    const button = view.save();
    expect(view.status().textContent).not.toContain("Loading messages…");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-describedby")).toBeNull();
    view.composer().focus();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(view.status().textContent).toBe("Loading messages…");
    const described = button.getAttribute("aria-describedby");
    expect(described === null ? "" : document.getElementById(described)?.textContent).toBe(
      "Loading messages…",
    );
    await user.click(button);
    view.composer().focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(save).not.toHaveBeenCalled();
  });

  it("moves focus to the composer when an empty conversation opens", async () => {
    const { user } = renderWindow({});
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    expect(view.region.getByText("No messages yet", { exact: true })).toBeTruthy();
    expect(
      view.region.getByText("Messages you save stay on this computer.", { exact: true }),
    ).toBeTruthy();
  });

  it("leaves focus on Add existing repository after the add flow is cancelled during a load", async () => {
    const reads: Array<ReturnType<typeof gate<ProjectConversationReadResult>>> = [];
    const { user } = renderWindow({
      read: () => {
        const next = gate<ProjectConversationReadResult>();
        reads.push(next);
        return next.promise;
      },
    });
    await openProject(user);
    await user.click(screen.getByRole("button", { name: "Add existing repository" }));
    await screen.findByRole("heading", { name: "Do you trust this repository?" });
    await user.keyboard("{Escape}");
    const add = screen.getByRole("button", { name: "Add existing repository" });
    await waitFor(() => expect(document.activeElement).toBe(add));
    await act(async () => {
      for (const pending of reads)
        pending.open({ status: "read", request: readRequestFor(projectA), conversation: null });
    });
    expect(document.activeElement).toBe(add);
  });

  it("leaves focus on the Remove button after the removal view is cancelled", async () => {
    const { user } = renderWindow({});
    await openProject(user);
    const remove = screen.getByRole("button", { name: "Remove repo-b from list" });
    await user.click(remove);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("data-remove")).toBe(projectB));
    await act(async () => undefined);
    expect(document.activeElement?.getAttribute("data-remove")).toBe(projectB);
  });

  it("drops a read answered for an older activation", async () => {
    const reads = new Map<string, ReturnType<typeof gate<ProjectConversationReadResult>>>();
    const { user } = renderWindow({
      read: (request) => {
        const next = gate<ProjectConversationReadResult>();
        reads.set(request.projectId, next);
        return next.promise;
      },
    });
    await openProject(user);
    const oldRead = reads.get(projectA);
    await openProject(user, "repo-b");
    await act(async () => {
      reads
        .get(projectB)
        ?.open({ status: "read", request: readRequestFor(projectB), conversation: null });
      oldRead?.open(readAnswer(readRequestFor(projectA), { texts: ["From A"], revision: 1 }));
    });
    expect(controls().messages()).toEqual([]);
    expect(screen.getByRole("heading", { name: "Project repo-b" })).toBeTruthy();
  });

  it("keeps a pending save across a remount inside one activation and applies its result", async () => {
    const pending = gate<ProjectConversationSaveResult>();
    const { user } = renderWindow({ save: () => pending.promise });
    const view = await openProject(user);
    await user.type(view.composer(), "Kept");
    await user.click(view.save());
    await user.click(screen.getByRole("button", { name: "Add existing repository" }));
    await screen.findByRole("heading", { name: "Do you trust this repository?" });
    await user.keyboard("{Escape}");
    const add = screen.getByRole("button", { name: "Add existing repository" });
    await waitFor(() => expect(controls().status().textContent).toContain("Saving…"));
    expect((controls().composer() as HTMLTextAreaElement).readOnly).toBe(true);
    expect(document.activeElement).toBe(add);
    const request = vi.mocked(window.slopstop.saveConversationMessage).mock.calls[0]?.[0];
    if (request === undefined) throw new Error("No save was sent");
    await act(async () => {
      pending.open(savedAnswer(request, 1));
    });
    await waitFor(() =>
      expect(
        controls()
          .messages()
          .some((text) => text.includes("Kept")),
      ).toBe(true),
    );
    expect((controls().composer() as HTMLTextAreaElement).value).toBe("");
  });
});

/** A read request for a Project at the activation the test does not need to know. */
function readRequestFor(projectId: string): ProjectConversationReadRequest {
  const call = [...vi.mocked(window.slopstop.readConversation).mock.calls]
    .reverse()
    .find(([request]) => request.projectId === projectId);
  if (call === undefined) throw new Error(`No read for ${projectId}`);
  return call[0];
}

describe("CNV-B34 applies the shared text rules", () => {
  /** Opens repo-a, waits for its load, and sets the composer to an exact value. */
  async function withText(value: string) {
    const rendered = renderWindow({ save: () => gate<ProjectConversationSaveResult>().promise });
    const view = await openProject(rendered.user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    fireEvent.change(view.composer(), { target: { value } });
    return { ...rendered, view };
  }

  it.each([
    ["empty", ""],
    ["whitespace", " \t\r\n"],
    ["NBSP only", "\u00a0\u00a0"],
  ])(
    "keeps Save focusable but unavailable for %s text, with no description",
    async (_label, value) => {
      const { user, save, view } = await withText(value);
      const button = view.save();
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-describedby")).toBeNull();
      view.composer().focus();
      await user.tab();
      expect(document.activeElement).toBe(button);
      await user.click(button);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("allows a message of exactly 32 KiB", async () => {
    const { user, save, view } = await withText("é".repeat(16_384));
    expect(view.save().getAttribute("aria-disabled")).toBeNull();
    await user.click(view.save());
    expect(save).toHaveBeenCalledOnce();
  });

  it("explains a message one byte over 32 KiB and keeps its text", async () => {
    const tooLong = `${"é".repeat(16_384)}a`;
    const { user, save, view } = await withText(tooLong);
    const button = view.save();
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(view.status().textContent).toBe("This message is longer than 32 KiB.");
    const described = button.getAttribute("aria-describedby");
    expect(described === null ? "" : document.getElementById(described)?.textContent).toBe(
      "This message is longer than 32 KiB.",
    );
    expect(view.composer().getAttribute("aria-invalid")).toBe("true");
    view.composer().focus();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.click(button);
    expect(save).not.toHaveBeenCalled();
    expect((view.composer() as HTMLTextAreaElement).value).toBe(tooLong);
    fireEvent.change(view.composer(), { target: { value: tooLong.slice(0, -1) } });
    expect(view.status().textContent).not.toContain("32 KiB");
    expect(view.composer().getAttribute("aria-invalid")).toBeNull();
    expect(view.save().getAttribute("aria-disabled")).toBeNull();
  });
});

describe("CNV-B33 shows a read-only Project's messages with saving unavailable", () => {
  it("lists the messages, explains read-only and keeps Save focusable but unavailable", async () => {
    const { user, save } = renderWindow({
      read: async (request) => readAnswer(request, { texts: ["Earlier"], revision: 1 }),
      activate: async (request) => ({
        status: "active",
        request,
        access: "read-only",
        activationId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
        writerGeneration: null,
        diagnostic: {
          code: "WRITER_UNAVAILABLE",
          message: "Another session owns the writer.",
          retryable: true,
        },
      }),
    });
    const view = await openProject(user);
    await waitFor(() =>
      expect(view.messages().some((text) => text.includes("Earlier"))).toBe(true),
    );
    // A draft kept from before: only the read-only access makes Save unavailable here.
    fireEvent.change(view.composer(), { target: { value: "Draft" } });
    const button = view.save();
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const readOnlyLine = `Read only: ${projectConversationDiagnostics.readOnly.message}`;
    expect(view.region.getByText(note, { exact: true })).toBeTruthy();
    const line = view.region.getByText(readOnlyLine, { exact: true });
    for (const control of [button, view.composer()]) {
      const described = control.getAttribute("aria-describedby");
      expect(described === null ? null : document.getElementById(described)).toBe(line);
    }
    expect((view.composer() as HTMLTextAreaElement).readOnly).toBe(true);
    // Pedro's decision (ui-ux review 2): no placeholder; the Read only line explains.
    expect((view.composer() as HTMLTextAreaElement).placeholder).toBe("");
    view.composer().focus();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.click(button);
    view.composer().focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(save).not.toHaveBeenCalled();
  });
});

const loadTitle = "Could not load this conversation.";
const sampleRequest = decodeStrict(ProjectConversationReadRequestSchema, {
  projectId: projectA,
  activationId: projectA,
  after: null,
});
type ReadFailure = ProjectConversationReadResult | "rejected";
const rows = projectConversationDiagnostics;

/** Every non-`read` read answer, keyed by status and row, plus a rejected preload call. */
const readFailures: ReadonlyArray<
  readonly [string, (request: ProjectConversationReadRequest) => ReadFailure]
> = [
  ["inactive", (request) => ({ status: "inactive", request, diagnostic: rows.inactive })],
  [
    "project-mismatch",
    (request) => ({ status: "project-mismatch", request, diagnostic: rows.projectMismatch }),
  ],
  [
    "stale-activation",
    (request) => ({ status: "stale-activation", request, diagnostic: rows.staleActivation }),
  ],
  [
    "coordinator-unavailable",
    (request) => ({
      status: "coordinator-unavailable",
      request,
      diagnostic: rows.coordinatorUnavailable,
    }),
  ],
  [
    "unavailable storageUnavailable",
    (request) => ({ status: "unavailable", request, diagnostic: rows.storageUnavailable }),
  ],
  [
    "unavailable connectionLost",
    (request) => ({ status: "unavailable", request, diagnostic: rows.connectionLost }),
  ],
  [
    "broken storageBroken",
    (request) => ({ status: "broken", request, diagnostic: rows.storageBroken }),
  ],
  [
    "broken harnessInternalFailure",
    (request) => ({ status: "broken", request, diagnostic: rows.harnessInternalFailure }),
  ],
  [
    "broken protocolMessageInvalid",
    (request) => ({ status: "broken", request, diagnostic: rows.protocolMessageInvalid }),
  ],
  [
    "broken protocolVersionUnsupported",
    (request) => ({ status: "broken", request, diagnostic: rows.protocolVersionUnsupported }),
  ],
  ["preload call rejected", () => "rejected"],
];

/** A read that answers the failure on its first page, or on the second after a good first page. */
function failingRead(
  failure: (request: ProjectConversationReadRequest) => ReadFailure,
  page: 1 | 2,
) {
  return async (request: ProjectConversationReadRequest) => {
    if (page === 2 && request.after === null)
      return readAnswer(request, { texts: ["Page one"], revision: 2, nextCursor: 1 });
    const answer = failure(request);
    if (answer === "rejected") throw new Error("IPC failure");
    return answer;
  };
}

/** What a failed load's notice must show: its tone, its message and its code line, if any. */
function expectedNotice(sample: ReadFailure) {
  if (sample === "rejected")
    return {
      broken: false,
      message: "The desktop could not load this conversation.",
      code: undefined,
    };
  if (sample.status === "read") throw new Error("A read is not a failure");
  // §54: a stale activation shows the renderer's own detail, which names the step that recovers.
  if (sample.status === "stale-activation")
    return {
      broken: false,
      message: "This Project was reopened elsewhere. Restart Ragnarok to open it again.",
      code: undefined,
    };
  const broken = sample.status === "broken";
  return {
    broken,
    message: sample.diagnostic.message,
    code: broken ? `Code ${sample.diagnostic.code}` : undefined,
  };
}

type View = Awaited<ReturnType<typeof openProject>>;

/** The Broken tone is an alert with the code line; the Failure tone is announced by the slot. */
function expectNotice(view: View, notice: ReturnType<typeof expectedNotice>) {
  // §54 C7, C8: every failed-load notice carries its tone; only Broken is an alert.
  const tone = document
    .getElementById("conversation-load-title")
    ?.parentElement?.getAttribute("data-tone");
  expect(tone).toBe(notice.broken ? "broken" : "failure");
  const alert = view.region.queryByRole("alert");
  expect(alert !== null).toBe(notice.broken);
  const text = (alert ?? view.region.getByText(notice.message, { exact: true }).parentElement)
    ?.textContent;
  expect(text).toContain(loadTitle);
  expect(text).toContain(notice.message);
  expect(text?.includes("Code ")).toBe(notice.code !== undefined);
  if (notice.code !== undefined) expect(text).toContain(notice.code);
  if (!notice.broken) expect(view.status().textContent).toBe(loadTitle);
}

/** Reload has focus; with no action (a stale activation), the focusable title has it. */
function expectNoticeFocus(view: View, noAction: boolean) {
  const reload = view.region.queryByRole("button", { name: "Reload" });
  expect(reload === null).toBe(noAction);
  const focused = noAction ? document.getElementById("conversation-load-title") : reload;
  expect(document.activeElement).toBe(focused);
}

describe("CNV-B35 shows a failed load", () => {
  it.each(
    readFailures.flatMap(([key, failure]) => [1, 2].map((page) => [key, page, failure] as const)),
  )("when a read answers %s on page %i", async (key, page, failure) => {
    const { user, save } = renderWindow({ read: failingRead(failure, page as 1 | 2) });
    const view = await openProject(user);
    await waitFor(() =>
      expect(document.getElementById("conversation-load-title")?.textContent).toBe(loadTitle),
    );
    expect(view.messages()).toEqual([]);
    expect(view.region.queryByText("No messages yet")).toBeNull();
    expectNotice(view, expectedNotice(failure(sampleRequest)));
    await waitFor(() => expectNoticeFocus(view, key === "stale-activation"));
    fireEvent.change(view.composer(), { target: { value: "Draft" } });
    const button = view.save();
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const described = button.getAttribute("aria-describedby");
    // §54: Save's own visible reason replaces the notice title as its description.
    const reason = described === null ? null : document.getElementById(described);
    expect(reason?.textContent).toBe("Saving is off until the conversation loads.");
    expect(reason?.closest("[data-conversation-region]")).not.toBeNull();
    await user.click(button);
    expect(save).not.toHaveBeenCalled();
    expect((view.composer() as HTMLTextAreaElement).value).toBe("Draft");
  });

  it("keeps Reload focused, mounted and unavailable while it reads, then focuses the composer", async () => {
    const second = gate<ProjectConversationReadResult>();
    let calls = 0;
    const { user } = renderWindow({
      read: async (request) => {
        calls += 1;
        if (calls === 1)
          return { status: "unavailable", request, diagnostic: rows.storageUnavailable };
        return second.promise;
      },
    });
    const view = await openProject(user);
    const reload = await view.region.findByRole("button", { name: "Reload" });
    await waitFor(() => expect(document.activeElement).toBe(reload));
    await user.click(reload);
    expect(view.region.getByRole("button", { name: "Reload" })).toBe(reload);
    expect(reload.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(reload);
    await act(async () => {
      second.open(readAnswer(readRequestFor(projectA), { texts: ["Back"], revision: 1 }));
    });
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    expect(view.messages().some((text) => text.includes("Back"))).toBe(true);
  });
});

describe("CNV-B45 shows each message as written, with its saved time", () => {
  it("renders the saved time and the exact text, never markup", async () => {
    const text = "<b>x</b>\n  y";
    const { user } = renderWindow({
      read: async (request) => readAnswer(request, { texts: [text], revision: 1 }),
    });
    const view = await openProject(user);
    await waitFor(() => expect(view.messages()).toHaveLength(1));
    const item = view.region.getAllByRole("listitem")[0];
    const time = item?.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2026-10-11T12:00:00.000Z");
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(time?.textContent).toBe(savedAtLabel("2026-10-11T12:00:00.000Z", new Date(), zone));
    expect(item?.querySelector("b")).toBeNull();
    expect(item?.querySelector("p")?.textContent).toBe(text);
    expect(item?.textContent?.startsWith("You")).toBe(true);
  });
});

describe("CNV-B46 works by keyboard and announces politely", () => {
  /** Stubs the stream's scroll and the reduced-motion query, which jsdom lacks. */
  function stubScroll(reduced: boolean) {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reduced,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    return scrollTo;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves with Ctrl+Enter and adds a line with Enter or Shift+Enter", async () => {
    stubScroll(false);
    const { user, save } = renderWindow({ save: async (request) => savedAnswer(request, 1) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await user.type(view.composer(), "a{Enter}b{Shift>}{Enter}{/Shift}c");
    expect(save).not.toHaveBeenCalled();
    expect((view.composer() as HTMLTextAreaElement).value).toBe("a\nb\nc");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
  });

  it("saves from a focused Save with Enter and keeps focus on it while pending and after a fault", async () => {
    stubScroll(false);
    const pending = gate<ProjectConversationSaveResult>();
    const { user } = renderWindow({ save: () => pending.promise });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    await user.type(view.composer(), "Keyboard");
    await user.tab();
    expect(document.activeElement).toBe(view.save());
    await user.keyboard("{Enter}");
    expect(view.status().textContent).toContain("Saving…");
    expect(document.activeElement).toBe(view.save());
    const request = vi.mocked(window.slopstop.saveConversationMessage).mock.calls[0]?.[0];
    if (request === undefined) throw new Error("No save was sent");
    await act(async () => {
      pending.open({
        status: "unavailable",
        request,
        diagnostic: projectConversationDiagnostics.storageUnavailable,
      });
    });
    expect(document.activeElement).toBe(view.save());
  });

  it("announces only through the polite slot, with an icon and words for every line", async () => {
    stubScroll(false);
    const { user } = renderWindow({ save: async (request) => savedAnswer(request, 1) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    const slot = view.status();
    expect(slot.getAttribute("aria-live")).toBe("polite");
    expect(slot.hasAttribute("role")).toBe(false);
    const region = screen.getByRole("region", { name: "Project workspace" });
    expect(region.querySelectorAll('[role="status"]')).toHaveLength(0);
    const list = view.region.getByRole("list", { name: "Messages" });
    for (const element of [list, list.parentElement]) {
      expect(element?.hasAttribute("aria-live")).toBe(false);
      expect(["log", "status"]).not.toContain(element?.getAttribute("role"));
    }
    await user.type(view.composer(), "Words");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(slot.textContent).toContain("Saved"));
    expect(slot.querySelector("svg")).not.toBeNull();
  });

  it.each([
    [false, "smooth"],
    [true, "auto"],
  ] as const)(
    "scrolls to a new message after a save (reduced motion %s: %s)",
    async (reduced, behavior) => {
      const scrollTo = stubScroll(reduced);
      const { user } = renderWindow({ save: async (request) => savedAnswer(request, 1) });
      const view = await openProject(user);
      await waitFor(() => expect(document.activeElement).toBe(view.composer()));
      scrollTo.mockClear();
      await user.type(view.composer(), "Scroll");
      await user.keyboard("{Control>}{Enter}{/Control}");
      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
      expect(scrollTo.mock.calls.at(-1)?.[0]).toMatchObject({ behavior });
    },
  );
});
