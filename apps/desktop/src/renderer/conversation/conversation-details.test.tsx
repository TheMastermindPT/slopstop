import {
  decodeStrict,
  type ProjectConversationReadResult,
  ProjectConversationReadResultSchema,
  type ProjectConversationSaveRequest,
  type ProjectConversationSaveResult,
  ProjectConversationSaveResultSchema,
  projectConversationDiagnostics as rows,
} from "@slopstop/protocol";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  controls,
  gate,
  openProject,
  readAnswer,
  renderWindow,
  savedAnswer,
} from "./conversation-test-harness.js";

/** A `saved` answer with its own message id, so two saves list two rows. */
function savedAs(request: ProjectConversationSaveRequest, index: number) {
  return decodeStrict(ProjectConversationSaveResultSchema, {
    status: "saved",
    request,
    conversationMessageId: `66666666-6666-4666-8666-${String(index).padStart(12, "0")}`,
    cursor: index,
    revision: index,
    savedAt: "2026-10-11T12:00:00.000Z",
    replayed: false,
  });
}

/** Opens repo-a and saves one draft that the harness answers with this failure. */
async function saveAnswering(status: string, diagnostic: object) {
  const { user } = renderWindow({
    save: async (request) =>
      decodeStrict(ProjectConversationSaveResultSchema, { status, request, diagnostic }),
  });
  const view = await openProject(user);
  await waitFor(() => expect(document.activeElement).toBe(view.composer()));
  fireEvent.change(view.composer(), { target: { value: "Draft" } });
  fireEvent.click(view.save());
  return view;
}

/** How many listed rows hold this text. */
const rowsWith = (text: string) =>
  controls()
    .messages()
    .filter((row) => row.includes(text)).length;

/** The path of the stave drawn in the failed-load notice. */
const noticeStave = () =>
  document
    .getElementById("conversation-load-title")
    ?.parentElement?.querySelector("svg path")
    ?.getAttribute("d");

describe("CNV-B46 saves only with Ctrl+Enter", () => {
  it("does not save on Ctrl with any other key", async () => {
    const { user, save } = renderWindow({ save: async (request) => savedAnswer(request, 1) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    fireEvent.change(view.composer(), { target: { value: "Draft" } });
    await user.keyboard("{Control>}a{/Control}");
    expect(save).not.toHaveBeenCalled();
  });
});

describe("CNV-B31 shows the empty state only for a loaded, empty conversation", () => {
  it("hides it while loading and once messages are listed", async () => {
    const pending = gate<ProjectConversationReadResult>();
    const { user, read } = renderWindow({ read: () => pending.promise });
    const view = await openProject(user);
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(view.region.queryByText("No messages yet")).toBeNull();
    const request = read.mock.calls[0]?.[0];
    if (request === undefined) throw new Error("No read was sent");
    await act(async () => {
      pending.open(readAnswer(request, { texts: ["Earlier"], revision: 1 }));
    });
    await waitFor(() => expect(rowsWith("Earlier")).toBe(1));
    expect(view.region.queryByText("No messages yet")).toBeNull();
  });
});

describe("CNV-B18 shows Saved until the next input", () => {
  it("clears Saved as soon as the draft changes", async () => {
    const { user } = renderWindow({ save: async (request) => savedAnswer(request, 1) });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    fireEvent.change(view.composer(), { target: { value: "Done" } });
    fireEvent.click(view.save());
    await waitFor(() => expect(view.status().textContent).toBe("Saved"));
    fireEvent.change(view.composer(), { target: { value: "N" } });
    expect(view.status().textContent).toBe("");
  });
});

describe("CNV-B18 lists each saved message once", () => {
  it("keeps the earlier saved row while the next save is pending, then lists both", async () => {
    const second = gate<ProjectConversationSaveResult>();
    let presses = 0;
    const { user, save } = renderWindow({
      save: async (request) => {
        presses += 1;
        return presses === 1 ? savedAs(request, 1) : second.promise;
      },
    });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    fireEvent.change(view.composer(), { target: { value: "First" } });
    fireEvent.click(view.save());
    await waitFor(() => expect(view.status().textContent).toContain("Saved"));
    expect(rowsWith("First")).toBe(1);
    fireEvent.change(view.composer(), { target: { value: "Second" } });
    fireEvent.click(view.save());
    await waitFor(() => expect(view.status().textContent).toContain("Saving…"));
    expect(rowsWith("First")).toBe(1);
    const request = save.mock.calls[1]?.[0];
    if (request === undefined) throw new Error("No second save was sent");
    await act(async () => {
      second.open(savedAs(request, 2));
    });
    await waitFor(() => expect(rowsWith("Second")).toBe(1));
    expect(rowsWith("First")).toBe(1);
  });
});

describe("CNV-B32 G26: the status slot's lines", () => {
  it("leaves a Broken save outcome out of the polite slot", async () => {
    const view = await saveAnswering("broken", rows.storageBroken);
    await waitFor(() => expect(view.region.getByRole("alert").textContent).toContain("Code "));
    expect(view.status().textContent).toBe("");
  });

  it("shows Saving… without a stave", async () => {
    const pending = gate<ProjectConversationSaveResult>();
    const { user } = renderWindow({ save: () => pending.promise });
    const view = await openProject(user);
    await waitFor(() => expect(document.activeElement).toBe(view.composer()));
    fireEvent.change(view.composer(), { target: { value: "Pending" } });
    fireEvent.click(view.save());
    await waitFor(() => expect(view.status().textContent).toBe("Saving…"));
    expect(view.status().querySelector("svg")).toBeNull();
  });
});

describe("CNV-B35 the failed-load notice's stave and title", () => {
  it.each([
    ["broken", rows.storageBroken, "M12 3L22 20H2ZM12 9V13.5M12 17V17.5"],
    ["unavailable", rows.storageUnavailable, "M12 2.5L21.5 12L12 21.5L2.5 12ZM9 9L15 15M15 9L9 15"],
  ] as const)("draws the %s notice's stave", async (status, diagnostic, stave) => {
    const { user } = renderWindow({
      read: async (request) =>
        decodeStrict(ProjectConversationReadResultSchema, { status, request, diagnostic }),
    });
    await openProject(user);
    await waitFor(() => expect(noticeStave()).toBe(stave));
  });

  it("keeps the notice title out of the Tab order", async () => {
    const { user } = renderWindow({
      read: async (request) => ({
        status: "unavailable",
        request,
        diagnostic: rows.storageUnavailable,
      }),
    });
    await openProject(user);
    await waitFor(() => expect(document.getElementById("conversation-load-title")).not.toBeNull());
    expect(document.getElementById("conversation-load-title")?.tabIndex).toBe(-1);
  });
});

describe("The Projects workspace around the Conversation region", () => {
  it("hides the Conversation region while the add flow is open", async () => {
    const { user } = renderWindow({});
    await openProject(user);
    await user.click(screen.getByRole("button", { name: "Add existing repository" }));
    await screen.findByRole("heading", { name: "Do you trust this repository?" });
    expect(screen.queryByRole("textbox", { name: "Message" })).toBeNull();
  });

  it("shows the latest note above an active Project's Conversation", async () => {
    const { user } = renderWindow({});
    await openProject(user);
    await user.click(screen.getByRole("button", { name: "Add existing repository" }));
    await screen.findByRole("heading", { name: "Do you trust this repository?" });
    await user.keyboard("{Escape}");
    const workspace = screen.getByRole("region", { name: "Project workspace" });
    await waitFor(() =>
      expect(workspace.querySelector('[role="status"]')?.textContent).toContain("Cancelled."),
    );
    expect(controls().composer()).toBeTruthy();
  });
});

/** A read that fails once with Storage unavailable, then waits on the returned gate. */
function failingThenGated() {
  const second = gate<ProjectConversationReadResult>();
  let calls = 0;
  const read = async (
    request: Parameters<NonNullable<Parameters<typeof renderWindow>[0]["read"]>>[0],
  ) => {
    calls += 1;
    if (calls === 1)
      return decodeStrict(ProjectConversationReadResultSchema, {
        status: "unavailable",
        request,
        diagnostic: rows.storageUnavailable,
      });
    return second.promise;
  };
  return { read, second };
}

describe("CNV-B31 G26: a load moves focus only from the page or the control that started it", () => {
  it("leaves focus where the person moved it during the first load", async () => {
    const pending = gate<ProjectConversationReadResult>();
    const { user, read } = renderWindow({ read: () => pending.promise });
    await openProject(user);
    await waitFor(() => expect(read).toHaveBeenCalled());
    const elsewhere = screen.getByRole("button", { name: "Add existing repository" });
    elsewhere.focus();
    const request = read.mock.calls[0]?.[0];
    if (request === undefined) throw new Error("No read was sent");
    await act(async () => {
      pending.open(readAnswer(request));
    });
    await waitFor(() => expect(controls().region.getByText("No messages yet")).toBeTruthy());
    expect(document.activeElement).toBe(elsewhere);
  });

  it("leaves focus where the person moved it while Reload reads", async () => {
    const { read, second } = failingThenGated();
    const { user, read: calls } = renderWindow({ read });
    const view = await openProject(user);
    const reload = await view.region.findByRole("button", { name: "Reload" });
    await waitFor(() => expect(document.activeElement).toBe(reload));
    await user.click(reload);
    const elsewhere = screen.getByRole("button", { name: "Add existing repository" });
    elsewhere.focus();
    const request = calls.mock.calls[1]?.[0];
    if (request === undefined) throw new Error("No second read was sent");
    await act(async () => {
      second.open(readAnswer(request));
    });
    await waitFor(() => expect(view.region.getByText("No messages yet")).toBeTruthy());
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe("CNV-B35 Reload while it already reads", () => {
  it("sends no second read when Reload is pressed again", async () => {
    const { read } = failingThenGated();
    const { user, read: calls } = renderWindow({ read });
    const view = await openProject(user);
    const reload = await view.region.findByRole("button", { name: "Reload" });
    await user.click(reload);
    await waitFor(() => expect(calls).toHaveBeenCalledTimes(2));
    await user.click(reload);
    expect(calls).toHaveBeenCalledTimes(2);
  });
});

describe("CNV-B32 G26: Try again and Save's reason when the conversation is loaded", () => {
  it("offers an actionable Try again without aria-disabled", async () => {
    const view = await saveAnswering("unavailable", rows.storageUnavailable);
    const tryAgain = await view.region.findByRole("button", { name: "Try again" });
    expect(tryAgain.hasAttribute("aria-disabled")).toBe(false);
  });

  it("has no not-loaded reason once the conversation loads", async () => {
    const { user } = renderWindow({});
    const view = await openProject(user);
    await waitFor(() => expect(view.region.getByText("No messages yet")).toBeTruthy());
    expect(view.region.queryByText("Saving is off until the conversation loads.")).toBeNull();
    expect(document.getElementById("conversation-save-reason")).toBeNull();
  });
});

describe("CNV-B31 the loading line and the heading after a fast load", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("never shows the loading line once a load has finished inside 300 ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderWindow({}, { advanceTimers: vi.advanceTimersByTime });
    const view = await openProject(user);
    await waitFor(() => expect(view.region.getByText("No messages yet")).toBeTruthy());
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(view.status().textContent).not.toContain("Loading messages…");
  });

  it("keeps the Project heading focusable by the window but out of the Tab order", async () => {
    const { user } = renderWindow({});
    await openProject(user);
    expect(screen.getByRole("heading", { name: "Project repo-a" }).tabIndex).toBe(-1);
  });
});
