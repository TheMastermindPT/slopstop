import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchResultSchema,
  decodeStrict,
  type HarnessStatus,
  ProjectListResultSchema,
  ProjectRegistrationResultSchema,
  type RetryHarnessResult,
} from "@slopstop/protocol";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SlopStopApi } from "../shared/desktop-api.js";
import { projectId, registrationApi } from "./add-repository/registration-fake.js";
import { App } from "./app.js";
import { exposeApi, readyApi, readyStatus, unusedWorkspaceApi } from "./test-api.js";

const startingStatus: HarnessStatus = {
  state: "starting",
  attempt: 1,
};

/** One registered, present Project, as the list carries it, with the Storage state given. */
const registeredEntry = (id: string, storage: unknown) => ({
  registration: "registered",
  projectId: id,
  name: `repo-${id.slice(0, 8)}`,
  repositoryBindingId: id,
  workspaceId: id,
  access: "not-assessed",
  repositoryLocation: { status: "present" },
  storage,
});

/** One registered, present Project whose Storage state the test chooses. */
function registeredProjectList(id: string, storage: unknown) {
  return decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: [registeredEntry(id, storage)],
    hiddenCount: 0,
  });
}

describe("desktop shell", () => {
  it.each([
    { canonical: "healthy", runtime: "corrupt" },
    { canonical: "healthy", runtime: "missing" },
    { canonical: "corrupt", runtime: "missing" },
  ] as const)(
    "shows actual safe-mode health $canonical / $runtime without writable or connected claims",
    async ({ canonical, runtime }) => {
      const id = "11111111-1111-4111-8111-111111111111";
      const health = (status: "healthy" | "corrupt" | "missing") =>
        status === "healthy"
          ? { status }
          : {
              status,
              diagnostic: {
                code: `DATABASE_${status.toUpperCase()}`,
                message: `Database ${status}`,
              },
            };
      exposeApi({
        ...unusedWorkspaceApi,
        getHarnessStatus: async () => readyStatus,
        retryHarness: async () => ({ ok: true }),
        subscribeHarnessStatus: () => () => {},
        listProjects: async () =>
          registeredProjectList(id, {
            status: "safe-mode",
            storageId: id,
            generationId: id,
            canonical,
            runtime,
          }),
        activateProject: async (request) =>
          decodeStrict(CanonicalProjectActivationResultSchema, {
            status: "safe-mode",
            request,
            identity: {
              storageId: id,
              generationId: id,
              canonicalDatabaseLineageId: id,
              runtimeDatabaseLineageId: id,
            },
            canonicalHealth: health(canonical),
            runtimeHealth: health(runtime),
          }),
      });
      render(<App />);
      const open = await screen.findByRole("button", {
        name: `Open Project repo-${id.slice(0, 8)}`,
      });
      expect(open.textContent).toContain(`Runtime ${runtime}`);
      if (canonical !== "healthy") expect(open.textContent).toContain(`Canonical ${canonical}`);
      await userEvent.setup().click(open);
      const workspace = within(screen.getByRole("region", { name: "Project workspace" }));
      expect((await workspace.findByText(/Safe mode/)).textContent).toContain(`Runtime ${runtime}`);
      if (canonical !== "healthy")
        expect(workspace.getByText(/Safe mode/).textContent).toContain(`Canonical ${canonical}`);
      expect(workspace.queryByText("Read-write")).toBeNull();
      expect(workspace.queryByText(/are connected/)).toBeNull();
      expect(workspace.getByText(/Writes unavailable/)).toBeTruthy();
      expect(screen.queryByText("Safe mode · healthy")).toBeNull();
    },
  );

  it.each(["list", "activation"] as const)(
    "ignores an old %s reply after the harness epoch changes",
    async (deferred) => {
      const oldId = "11111111-1111-4111-8111-111111111111";
      const newId = "22222222-2222-4222-8222-222222222222";
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let notify: (status: HarnessStatus) => void = () => {};
      let listing = 0;
      exposeApi({
        ...unusedWorkspaceApi,
        getHarnessStatus: async () => readyStatus,
        retryHarness: async () => ({ ok: true }),
        subscribeHarnessStatus: (listener) => {
          notify = listener;
          return () => {};
        },
        listProjects: async () => {
          const projectId = ++listing === 1 ? oldId : newId;
          if (projectId === oldId && deferred === "list") await gate;
          return decodeStrict(ProjectListResultSchema, {
            status: "listed",
            projects: [
              {
                registration: "registered",
                projectId,
                name: `repo-${projectId.slice(0, 8)}`,
                repositoryBindingId: projectId,
                workspaceId: projectId,
                access: "not-assessed",
                repositoryLocation: { status: "present" },
                storage: { status: "healthy", storageId: projectId, generationId: projectId },
              },
            ],
            hiddenCount: 0,
          });
        },
        activateProject: async (request) => {
          if (request.projectId === oldId) await gate;
          return decodeStrict(CanonicalProjectActivationResultSchema, {
            status: "active",
            request,
            access: "read-write",
            activationId: request.projectId,
            writerGeneration: 1,
          });
        },
      });
      render(<App />);
      const user = userEvent.setup();
      if (deferred === "activation")
        await user.click(
          await screen.findByRole("button", { name: `Open Project repo-${oldId.slice(0, 8)}` }),
        );
      else await screen.findByText("Loading saved Projects…");
      await act(async () => {
        notify({ ...readyStatus, attempt: 2 });
      });
      await user.click(
        await screen.findByRole("button", { name: `Open Project repo-${newId.slice(0, 8)}` }),
      );
      await screen.findByRole("heading", { name: "Project repo-22222222" });
      await act(async () => {
        release();
      });
      expect(
        screen.queryByRole("button", { name: `Open Project repo-${oldId.slice(0, 8)}` }),
      ).toBeNull();
      expect(screen.getByRole("heading", { name: "Project repo-22222222" })).toBeTruthy();
      expect(screen.getByText("Read-write")).toBeTruthy();
    },
  );

  it("shows a broken registry as an error rather than an empty installation", async () => {
    exposeApi({
      ...unusedWorkspaceApi,
      getHarnessStatus: async () => readyStatus,
      retryHarness: async () => ({ ok: true }),
      subscribeHarnessStatus: () => () => {},
      listProjects: async () => ({ status: "broken", code: "PROJECT_LIST_TRANSPORT_FAILED" }),
    });
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toContain("Projects could not be read");
    expect(screen.queryByText(/No saved Projects yet/)).toBeNull();
  });
  it("keeps the current Project when switching is refused before release", async () => {
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    exposeApi({
      ...unusedWorkspaceApi,
      getHarnessStatus: async () => readyStatus,
      retryHarness: async () => ({ ok: true }),
      subscribeHarnessStatus: () => () => {},
      listProjects: async () =>
        decodeStrict(ProjectListResultSchema, {
          status: "listed",
          projects: [first, second].map((projectId) => ({
            registration: "registered",
            projectId,
            name: `repo-${projectId.slice(0, 8)}`,
            repositoryBindingId: projectId,
            workspaceId: projectId,
            access: "not-assessed",
            repositoryLocation: { status: "present" },
            storage: { status: "healthy", storageId: projectId, generationId: projectId },
          })),
          hiddenCount: 0,
        }),
      activateProject: async (request) =>
        decodeStrict(CanonicalProjectActivationResultSchema, {
          status: "active",
          request,
          access: "read-write",
          activationId: first,
          writerGeneration: 1,
        }),
      switchProject: async (request) =>
        decodeStrict(CanonicalProjectSwitchResultSchema, {
          status: "target-result",
          sourceReleased: false,
          request,
          target: {
            status: "unavailable",
            request: request.to,
            diagnostic: {
              code: "PROJECT_STORAGE_UNAVAILABLE",
              message: "Target unavailable",
              retryable: true,
            },
          },
        }),
    });
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: `Open Project repo-${first.slice(0, 8)}` }),
    );
    await user.click(
      screen.getByRole("button", { name: `Open Project repo-${second.slice(0, 8)}` }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain("Target unavailable");
    expect(screen.getByRole("heading", { name: "Project repo-11111111" })).toBeTruthy();
    expect(screen.getByText("Read-write")).toBeTruthy();
  });
  it("shows real bridge Projects and waits for activation before presenting read-only access", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    exposeApi({
      ...unusedWorkspaceApi,
      getHarnessStatus: async () => readyStatus,
      retryHarness: async () => ({ ok: true }),
      subscribeHarnessStatus: () => () => {},
      listProjects: async () =>
        registeredProjectList(id, { status: "healthy", storageId: id, generationId: id }),
      activateProject: async (request) => {
        await gate;
        return decodeStrict(CanonicalProjectActivationResultSchema, {
          status: "active",
          request,
          access: "read-only",
          activationId: id,
          writerGeneration: null,
          diagnostic: {
            code: "WRITER_UNAVAILABLE",
            message: "Another session owns the writer.",
            retryable: true,
          },
        });
      },
    });
    render(<App />);
    const open = await screen.findByRole("button", { name: `Open Project repo-${id.slice(0, 8)}` });
    await userEvent.setup().click(open);
    expect(screen.getByRole("heading", { name: "No Project selected" })).toBeTruthy();
    await act(async () => {
      release();
    });
    expect(await screen.findByText("Read-only")).toBeTruthy();
  });
  it("projects harness status updates from the preload API", async () => {
    let notify: ((status: HarnessStatus) => void) | undefined;
    exposeApi({
      ...unusedWorkspaceApi,
      getHarnessStatus: async () => startingStatus,
      retryHarness: async () => ({ ok: true }),
      subscribeHarnessStatus: (listener) => {
        notify = listener;
        return () => {
          notify = undefined;
        };
      },
    });

    render(<App />);

    expect((await screen.findByRole("status")).textContent).toContain("Harness starting");

    act(() => {
      notify?.(readyStatus);
    });

    expect(screen.getByRole("status").textContent).toContain("Harness ready");
    expect(screen.queryByRole("button", { name: "Retry harness" })).toBeNull();
  });

  /** A harness that exhausted automatic recovery, retried through `retryHarness`. */
  function exposeCrashedHarness(retryHarness: () => Promise<RetryHarnessResult>) {
    exposeApi({
      ...unusedWorkspaceApi,
      getHarnessStatus: async () => ({
        state: "crashed",
        attempt: 3,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROCESS_EXITED",
          message: "Harness exited with code 1.",
        },
      }),
      retryHarness,
      subscribeHarnessStatus: () => () => undefined,
    });
  }

  it("offers an explicit retry after the harness exhausts automatic recovery", async () => {
    const retryHarness = vi.fn(async () => ({ ok: true as const }));
    exposeCrashedHarness(retryHarness);

    render(<App />);

    const retry = await screen.findByRole("button", { name: "Retry harness" });
    await userEvent.setup().click(retry);

    expect(retryHarness).toHaveBeenCalledOnce();
  });

  it("shows the whole retry failure as an alert", async () => {
    const message =
      "The harness could not be started again: the process ended before it answered the first request, so Ragnarok stopped trying. Check the local log, then try later.";
    expect(message).toHaveLength(160);
    exposeCrashedHarness(async () => ({
      ok: false,
      error: { code: "HARNESS_RETRY_UNAVAILABLE", message },
    }));

    render(<App />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Retry harness" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((alert) => [alert.tagName, alert.textContent])).toEqual([["P", message]]);
  });
});

/** The text an element holds directly, not in its descendants. */
function ownText(element: Element): string {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();
}

it("keeps one level-1 heading, in the title bar", async () => {
  exposeApi(readyApi());
  const { container } = render(<App />);
  await screen.findByText("Harness ready");
  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings.map((heading) => heading.textContent)).toEqual(["Ragnarok"]);
  screen.getByRole("heading", { level: 1, name: "Ragnarok" });
  // The banner landmark by the HTML-AAM rule: Testing Library gives every header the role.
  const banners = container.querySelectorAll(
    "header:not(:is(article, aside, main, nav, section) header)",
  );
  expect(banners).toHaveLength(1);
  const banner = banners[0];
  expect(banner?.contains(headings[0] ?? null)).toBe(true);
  const outside = [...container.querySelectorAll("*")].filter(
    (element) => !banner?.contains(element) && ownText(element) === "Ragnarok",
  );
  expect(outside.map((element) => element.tagName)).toEqual([]);
});

it("SH-B3: swaps the one sidebar between Projects and Attention", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const listProjects = vi.fn(async () =>
    registeredProjectList(id, { status: "healthy", storageId: id, generationId: id }),
  );
  exposeApi(readyApi({ listProjects }));
  render(<App />);
  const row = `Open Project repo-${id.slice(0, 8)}`;
  const projects = screen.getByRole("complementary", { name: "Projects" });
  expect(await within(projects).findByRole("button", { name: row })).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "Attention" })).toBeNull();
  const rail = within(screen.getByRole("navigation", { name: "Activity" }));
  const user = userEvent.setup();
  await user.click(rail.getByRole("button", { name: "Attention" }));
  const attention = within(screen.getByRole("complementary", { name: "Attention" }));
  expect(attention.getByText("Attention has no sources yet.")).toBeTruthy();
  expect(document.activeElement).toBe(attention.getByRole("heading", { name: "Attention" }));
  expect(rail.getByRole("button", { name: "Attention" }).getAttribute("aria-pressed")).toBe("true");
  expect(rail.getByRole("button", { name: "Projects" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("button", { name: row })).toBeNull();
  await user.click(rail.getByRole("button", { name: "Projects" }));
  expect(screen.getByRole("button", { name: row })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Projects" }));
  expect(listProjects).toHaveBeenCalledOnce();
});

/** Presses a rail item and answers the rail, for the rows that leave a flow from Attention. */
async function pressRail(user: ReturnType<typeof userEvent.setup>, name: string) {
  const rail = within(screen.getByRole("navigation", { name: "Activity" }));
  await user.click(rail.getByRole("button", { name }));
  return rail;
}

it.each(["Escape", "Cancel"] as const)(
  "SH-B13: hands focus back to Add when the add flow closes from Attention: %s",
  async (close) => {
    exposeApi(registrationApi().api);
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add existing repository" }));
    await screen.findByRole("heading", { level: 2, name: "Do you trust this repository?" });
    const rail = await pressRail(user, "Attention");
    if (close === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(rail.getByRole("button", { name: "Projects" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add existing repository" }),
    );
  },
);

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

it.each([
  { name: "cancelled", listed: [first], press: "Cancel", focus: "Remove repo-11111111 from list" },
  {
    name: "ended with no Project left",
    listed: [first],
    press: "Remove from list",
    focus: "Add existing repository",
  },
  {
    name: "ended with a next Project",
    listed: [first, second],
    press: "Remove from list",
    focus: "Open Project repo-22222222",
  },
])(
  "SH-B13: hands focus back to the Projects list when the removal is $name from Attention",
  async (row) => {
    let removed = false;
    const listed = () => (removed ? row.listed.slice(1) : row.listed);
    exposeApi(
      readyApi({
        listProjects: async () =>
          decodeStrict(ProjectListResultSchema, {
            status: "listed",
            projects: listed().map((id) =>
              registeredEntry(id, { status: "healthy", storageId: id, generationId: id }),
            ),
            hiddenCount: 0,
          }),
        registerProject: async () => {
          removed = true;
          return decodeStrict(ProjectRegistrationResultSchema, {
            status: "removed",
            projectId: first,
          });
        },
      }),
    );
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Remove repo-11111111 from list" }));
    await screen.findByRole("heading", { level: 2, name: "Remove repo-11111111 from the list?" });
    const rail = await pressRail(user, "Attention");
    await user.click(screen.getByRole("button", { name: row.press }));
    await screen.findByRole("button", { name: row.focus });
    expect(rail.getByRole("button", { name: "Projects" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: row.focus }));
  },
);

it("SH-B13: hands focus back to the Project's row when the add flow shows it from Attention", async () => {
  const healthy = { status: "healthy", storageId: projectId, generationId: projectId };
  exposeApi(
    registrationApi(
      { prepare: { status: "belongs-to-project", projectId, name: "chess" } },
      undefined,
      { listProjects: async () => registeredProjectList(projectId, healthy) },
    ).api,
  );
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Add existing repository" }));
  await user.click(await screen.findByRole("button", { name: "Trust and continue" }));
  await user.click(await screen.findByRole("button", { name: "Run version check" }));
  await user.click(await screen.findByRole("button", { name: "Allow 6 queries" }));
  await screen.findByRole("heading", {
    level: 2,
    name: "This worktree is part of a Project you already have",
  });
  const rail = await pressRail(user, "Attention");
  await user.click(screen.getByRole("button", { name: "Show chess" }));
  const row = `Open Project repo-${projectId.slice(0, 8)}`;
  expect(rail.getByRole("button", { name: "Projects" }).getAttribute("aria-pressed")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: row }));
});

const unavailable: HarnessStatus = {
  state: "crashed",
  attempt: 3,
  canRetry: true,
  diagnostic: { code: "HARNESS_PROCESS_EXITED", message: "Harness exited with code 1." },
};
const recovering: HarnessStatus = {
  state: "degraded",
  attempt: 2,
  diagnostic: { code: "HARNESS_PROCESS_EXITED", message: "Harness exited; restarting it." },
};
const starting: HarnessStatus = { state: "starting", attempt: 4 };

/** A harness whose status the test drives; answers `notify` (inside `act`) and the retry spy. */
function drivenHarness(
  initial: HarnessStatus,
  retryHarness: () => Promise<RetryHarnessResult> = async () => ({ ok: true }),
) {
  let listener: ((status: HarnessStatus) => void) | undefined;
  const retry = vi.fn(retryHarness);
  exposeApi(
    readyApi({
      getHarnessStatus: async () => initial,
      retryHarness: retry,
      subscribeHarnessStatus: (next) => {
        listener = next;
        return () => undefined;
      },
    }),
  );
  const notify = (status: HarnessStatus) => act(() => listener?.(status));
  return { notify, retry };
}

const strip = (name: string) => screen.queryByRole("region", { name });

describe("the harness strip in the window", () => {
  it.each([
    {
      name: "unavailable",
      status: unavailable,
      word: "Harness unavailable",
      detail: "Harness exited with code 1.",
      tone: "fault",
      retry: true,
    },
    {
      name: "recovering",
      status: recovering,
      word: "Harness recovering",
      detail: "Harness exited; restarting it.",
      tone: "warn",
      retry: false,
    },
    {
      name: "stopped",
      status: { state: "stopped" } as const,
      word: "Harness stopped",
      detail: "The utility process is not running.",
      tone: "dim",
      retry: false,
    },
  ])(
    "SH-B6: says the state in one status and shows a strip only when not ready: $name",
    async (row) => {
      const harness = drivenHarness(row.status);
      render(<App />);
      const region = await screen.findByRole("region", { name: row.word });
      const status = screen.getByRole("status");
      // The one polite status: the state word in its own element, then the detail.
      expect([...status.children].map((child) => [child.tagName, child.textContent])).toEqual([
        ["STRONG", row.word],
        ["SPAN", row.detail],
      ]);
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(region.hasAttribute("aria-live")).toBe(false);
      expect(region.getAttribute("data-tone")).toBe(row.tone);
      expect(within(region).getByText(row.word)).toBeTruthy();
      const retry = within(region).queryByRole("button", { name: "Retry harness" });
      expect(retry !== null).toBe(row.retry);
      if (retry !== null) {
        await userEvent.setup().click(retry);
        expect(harness.retry).toHaveBeenCalledOnce();
      }
      harness.notify(readyStatus);
      expect(screen.getByRole("status")).toBe(status);
      expect(status.textContent).toContain("Harness ready");
      expect(strip(row.word)).toBeNull();
      expect(screen.queryByRole("region", { name: "Harness starting" })).toBeNull();
      expect(screen.queryByRole("button", { name: /harness/ })).toBeNull();
    },
  );

  describe("SH-B7: the starting strip", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Renders the app on fake timers and lets the first status arrive. */
    async function renderOnFakeTimers(initial: HarnessStatus) {
      vi.useFakeTimers();
      const harness = drivenHarness(initial);
      render(<App />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      return harness;
    }

    it("SH-B7: waits one second before a fresh start shows its strip", async () => {
      await renderOnFakeTimers(starting);
      expect(screen.getByRole("status").textContent).toContain("Harness starting");
      act(() => vi.advanceTimersByTime(999));
      expect(strip("Harness starting")).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(strip("Harness starting")?.getAttribute("data-tone")).toBe("busy");
    });

    it("SH-B7: shows no strip for a start that is ready within the second", async () => {
      const harness = await renderOnFakeTimers(starting);
      act(() => vi.advanceTimersByTime(500));
      expect(screen.queryAllByRole("region", { name: /^Harness/ })).toEqual([]);
      harness.notify(readyStatus);
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryAllByRole("region", { name: /^Harness/ })).toEqual([]);
    });

    it.each([
      { name: "unavailable", from: unavailable },
      { name: "recovering", from: recovering },
    ])("SH-B7: turns a showing strip into the starting one at once: $name", async (row) => {
      const harness = await renderOnFakeTimers(row.from);
      expect(screen.queryAllByRole("region", { name: /^Harness/ })).toHaveLength(1);
      harness.notify(starting);
      expect(strip("Harness starting")?.getAttribute("data-tone")).toBe("busy");
    });
  });
});

describe("SH-B8: a retry keeps its strip, its button and the focus until the outcome", () => {
  /** An unavailable harness with Retry pressed; answers the driven harness and the button. */
  async function pressRetry(retryHarness?: () => Promise<RetryHarnessResult>) {
    const harness = drivenHarness(unavailable, retryHarness);
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Retry harness" }));
    return { ...harness, user };
  }

  it("SH-B8: keeps Retry focused through starting and hands focus to the work when ready", async () => {
    const { notify, retry, user } = await pressRetry();
    const retrying = screen.getByRole("button", { name: "Retrying harness" });
    expect(retrying.getAttribute("aria-disabled")).toBe("true");
    // Not `disabled`: a disabled button would drop the focus.
    expect(retrying.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(retrying);
    await user.click(retrying);
    expect(retry).toHaveBeenCalledOnce();
    notify(starting);
    expect(strip("Harness starting")).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retrying harness" }));
    notify(readyStatus);
    expect(screen.queryAllByRole("region", { name: /^Harness/ })).toEqual([]);
    expect(document.activeElement).toBe(document.getElementById("ws-heading"));
  });

  it("SH-B8: offers Retry again, still focused, when the harness is unavailable again", async () => {
    const { notify } = await pressRetry();
    notify(starting);
    notify(unavailable);
    const again = screen.getByRole("button", { name: "Retry harness" });
    expect(document.activeElement).toBe(again);
    expect(strip("Harness unavailable")).not.toBeNull();
  });

  it.each(["Retry pressed again", "the state leaving unavailable"] as const)(
    "SH-B8: keeps a refused retry's message inside the strip until %s",
    async (clear) => {
      const message = "The harness could not be started again.";
      let calls = 0;
      // The first retry is refused; a second one waits for its outcome.
      const { notify, user } = await pressRetry(() =>
        calls++ === 0
          ? Promise.resolve({ ok: false, error: { code: "HARNESS_RETRY_UNAVAILABLE", message } })
          : new Promise<RetryHarnessResult>(() => undefined),
      );
      const region = screen.getByRole("region", { name: "Harness unavailable" });
      const alerts = await screen.findAllByRole("alert");
      expect(alerts.map((alert) => [region.contains(alert), alert.textContent])).toEqual([
        [true, message],
      ]);
      const again = screen.getByRole("button", { name: "Retry harness" });
      expect(document.activeElement).toBe(again);
      if (clear === "Retry pressed again") await user.click(again);
      else notify(starting);
      expect(screen.queryAllByRole("alert")).toEqual([]);
      // The message is gone, not hidden: the next unavailable state shows none.
      notify(starting);
      notify(unavailable);
      expect(screen.queryAllByRole("alert")).toEqual([]);
    },
  );

  it("SH-B8: keeps Retrying harness focused while the harness recovers, until it is unavailable again", async () => {
    const { notify } = await pressRetry();
    for (const status of [starting, recovering, starting]) {
      notify(status);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retrying harness" }));
    }
    notify(unavailable);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retry harness" }));
  });

  it("SH-B8: says so when a retry cannot reach the desktop process", async () => {
    await pressRetry(() => Promise.reject(new Error("The bridge is gone.")));
    const region = screen.getByRole("region", { name: "Harness unavailable" });
    const alert = await within(region).findByRole("alert");
    expect([alert.textContent, alert.getAttribute("data-code")]).toEqual([
      "Retry could not reach the desktop process.",
      "DESKTOP_RETRY_FAILED",
    ]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retry harness" }));
  });

  it("SH-B8: leaves focus where the user moved it after pressing Retry", async () => {
    const { notify } = await pressRetry();
    const attention = within(screen.getByRole("navigation", { name: "Activity" })).getByRole(
      "button",
      { name: "Attention" },
    );
    attention.focus();
    notify(starting);
    notify(readyStatus);
    expect(document.activeElement).toBe(attention);
  });

  it("SH-B8: leaves focus on the rail while the strip comes, changes and goes", async () => {
    const { notify } = drivenHarness(readyStatus);
    render(<App />);
    const attention = within(screen.getByRole("navigation", { name: "Activity" })).getByRole(
      "button",
      { name: "Attention" },
    );
    attention.focus();
    notify(unavailable);
    expect(strip("Harness unavailable")).not.toBeNull();
    notify(starting);
    notify(readyStatus);
    expect(document.activeElement).toBe(attention);
  });
});

const alphaId = "11111111-1111-4111-8111-111111111111";
const betaId = "22222222-2222-4222-8222-222222222222";

/** The list of two healthy Projects, "alpha" and "beta". */
const alphaBeta = () =>
  decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: [
      { ...registeredEntry(alphaId, healthyStorage(alphaId)), name: "alpha" },
      { ...registeredEntry(betaId, healthyStorage(betaId)), name: "beta" },
    ],
    hiddenCount: 0,
  });

function healthyStorage(id: string) {
  return { status: "healthy", storageId: id, generationId: id };
}

/** Opens Projects read-write, as the harness would; answers its activation result. */
const activeResult = (request: { projectId: string }) =>
  decodeStrict(CanonicalProjectActivationResultSchema, {
    status: "active",
    request,
    access: "read-write",
    activationId: request.projectId,
    writerGeneration: 1,
  });

/** Opens Projects in safe mode, the runtime database missing; answers its activation result. */
const safeModeResult = (request: { projectId: string }) =>
  decodeStrict(CanonicalProjectActivationResultSchema, {
    status: "safe-mode",
    request,
    identity: {
      storageId: request.projectId,
      generationId: request.projectId,
      canonicalDatabaseLineageId: request.projectId,
      runtimeDatabaseLineageId: request.projectId,
    },
    canonicalHealth: { status: "healthy" },
    runtimeHealth: {
      status: "missing",
      diagnostic: { code: "DATABASE_MISSING", message: "Database missing" },
    },
  });

/** The app over "alpha" and "beta", with `overrides`; answers the list spy and a user. */
function renderAlphaBeta(overrides: Partial<SlopStopApi> = {}) {
  const listProjects = vi.fn(async () => alphaBeta());
  exposeApi(
    readyApi({
      listProjects,
      activateProject: async (request) => activeResult(request),
      ...overrides,
    }),
  );
  render(<App />);
  return { listProjects, user: userEvent.setup() };
}

/**
 * The bar: the banner landmark by the HTML-AAM rule (Testing Library gives every `header` the
 * banner role, and the work area has its own).
 */
const bar = () => {
  const banner = document.querySelector(
    "header:not(:is(article, aside, main, nav, section) header)",
  );
  if (!(banner instanceof HTMLElement)) throw new Error("No banner");
  return banner;
};

/** The buttons in the bar. */
const barButtons = () => within(bar()).queryAllByRole("button");

async function openProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: `Open Project ${name}` }));
  await screen.findByRole("heading", { name: `Project ${name}` });
}

describe("SH-B16: the bar names the open Project", () => {
  it("SH-B16: names the open Project in one button, and holds none before", async () => {
    const { user } = renderAlphaBeta();
    await screen.findByRole("button", { name: "Open Project alpha" });
    expect(barButtons()).toEqual([]);
    await openProject(user, "alpha");
    const banner = bar();
    expect(
      barButtons().map((button) => [button.textContent, button.getAttribute("aria-label")]),
    ).toEqual([["alpha", "Project alpha"]]);
    expect(within(banner).getByRole("button", { name: "Project alpha" })).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent),
    ).toEqual(["Ragnarok"]);
    expect(banner.textContent).toBe("Ragnarokalpha");
    // Nothing else repository-derived: no title, link or image, and the button's own attributes.
    expect(banner.querySelectorAll("[title], a, img")).toHaveLength(0);
    expect(barButtons().map((button) => button.getAttributeNames().sort())).toEqual([
      ["aria-label", "class", "type"],
    ]);
  });

  it("SH-B16: follows a switch to another Project", async () => {
    const { user } = renderAlphaBeta({
      switchProject: async (request) =>
        decodeStrict(CanonicalProjectSwitchResultSchema, {
          status: "target-result",
          sourceReleased: true,
          request,
          target: activeResult(request.to),
        }),
    });
    await openProject(user, "alpha");
    await user.click(screen.getByRole("button", { name: "Open Project beta" }));
    await screen.findByRole("heading", { name: "Project beta" });
    expect(barButtons().map((button) => button.textContent)).toEqual(["beta"]);
  });

  it("SH-B16: keeps the name, and none of the failure's words, when a switch fails to release", async () => {
    const message = "Project activation resources could not be released.";
    const { user } = renderAlphaBeta({
      switchProject: async (request) =>
        decodeStrict(CanonicalProjectSwitchResultSchema, {
          status: "release-failed",
          request,
          diagnostic: { code: "PROJECT_STORAGE_RELEASE_FAILED", message, retryable: true },
        }),
    });
    await openProject(user, "alpha");
    await user.click(screen.getByRole("button", { name: "Open Project beta" }));
    await screen.findByText(message);
    expect(barButtons().map((button) => button.textContent)).toEqual(["alpha"]);
    expect(bar().textContent).toBe("Ragnarokalpha");
  });

  it("SH-B16: names a Project in safe mode, without its state's words", async () => {
    const { user } = renderAlphaBeta({
      activateProject: async (request) => safeModeResult(request),
    });
    await user.click(await screen.findByRole("button", { name: "Open Project alpha" }));
    await screen.findByText(/Safe mode/, { selector: "p" });
    expect(bar().textContent).toBe("Ragnarokalpha");
  });

  it("SH-B16: holds no control once the harness leaves ready", async () => {
    let notify: ((status: HarnessStatus) => void) | undefined;
    const { user } = renderAlphaBeta({
      subscribeHarnessStatus: (listener) => {
        notify = listener;
        return () => undefined;
      },
    });
    await openProject(user, "alpha");
    expect(barButtons().map((button) => button.textContent)).toEqual(["alpha"]);
    act(() => notify?.(unavailable));
    expect(barButtons()).toEqual([]);
  });

  it.each(["the add flow starts", "a removal is asked for another Project"] as const)(
    "SH-B16: keeps the open Project's name while %s",
    async (flow) => {
      const { user } = renderAlphaBeta({
        chooseRepository: registrationApi().api.chooseRepository,
      });
      await openProject(user, "alpha");
      if (flow === "the add flow starts") {
        await user.click(screen.getByRole("button", { name: "Add existing repository" }));
        await screen.findByRole("heading", { level: 2, name: "Do you trust this repository?" });
      } else {
        await user.click(screen.getByRole("button", { name: "Remove beta from list" }));
        await screen.findByRole("heading", { level: 2, name: "Remove beta from the list?" });
      }
      expect(barButtons().map((button) => button.textContent)).toEqual(["alpha"]);
    },
  );
});

it("SH-B16: closes the view and clears the bar when the Project in view is removed", async () => {
  let removed = false;
  const { user } = renderAlphaBeta({
    listProjects: async () =>
      decodeStrict(ProjectListResultSchema, {
        status: "listed",
        projects: [
          ...(removed
            ? []
            : [{ ...registeredEntry(alphaId, healthyStorage(alphaId)), name: "alpha" }]),
          { ...registeredEntry(betaId, healthyStorage(betaId)), name: "beta" },
        ],
        hiddenCount: 0,
      }),
    activateProject: async (request) => safeModeResult(request),
    registerProject: async () => {
      removed = true;
      return decodeStrict(ProjectRegistrationResultSchema, {
        status: "removed",
        projectId: alphaId,
      });
    },
  });
  await user.click(await screen.findByRole("button", { name: "Open Project alpha" }));
  await screen.findByRole("heading", { name: "Project alpha" });
  expect(barButtons().map((button) => button.textContent)).toEqual(["alpha"]);
  await user.click(screen.getByRole("button", { name: "Remove alpha from list" }));
  await user.click(await screen.findByRole("button", { name: "Remove from list" }));
  await screen.findByText(/alpha was removed from the list/, { selector: "p[role=status]" });
  expect(barButtons()).toEqual([]);
  expect(screen.queryByRole("heading", { name: "Project alpha" })).toBeNull();
});

describe("SH-B18: the name shows the Projects sidebar", () => {
  it.each([
    { name: "a click from Attention", fromAttention: true, press: "click" },
    { name: "Space from Attention", fromAttention: true, press: "space" },
    { name: "Enter with Projects already current", fromAttention: false, press: "enter" },
  ] as const)("SH-B18: shows Projects and focuses its heading: $name", async (row) => {
    const { listProjects, user } = renderAlphaBeta();
    await openProject(user, "alpha");
    // The opened conversation focuses its composer once it has loaded; let that happen first.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message" })),
    );
    const rail = within(screen.getByRole("navigation", { name: "Activity" }));
    if (row.fromAttention) await user.click(rail.getByRole("button", { name: "Attention" }));
    const name = within(bar()).getByRole("button", { name: "Project alpha" });
    if (row.press === "click") await user.click(name);
    else {
      name.focus();
      await user.keyboard(row.press === "space" ? " " : "{Enter}");
    }
    expect(rail.getByRole("button", { name: "Projects" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Open Project alpha" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Projects" }));
    expect(listProjects).toHaveBeenCalledOnce();
  });
});
