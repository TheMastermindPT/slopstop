import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchResultSchema,
  decodeStrict,
  type HarnessStatus,
  ProjectListResultSchema,
  ProjectRegistrationResultSchema,
  type RetryHarnessResult,
} from "@slopstop/protocol";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { registrationApi } from "./add-repository/registration-fake.js";
import { App } from "./app.js";
import { exposeApi, readyApi, readyStatus, unusedWorkspaceApi } from "./test-api.js";

const startingStatus: HarnessStatus = {
  state: "starting",
  attempt: 1,
};

/** One registered, present Project whose Storage state the test chooses. */
function registeredProjectList(id: string, storage: unknown) {
  return decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: [
      {
        registration: "registered",
        projectId: id,
        name: `repo-${id.slice(0, 8)}`,
        repositoryBindingId: id,
        workspaceId: id,
        access: "not-assessed",
        repositoryLocation: { status: "present" },
        storage,
      },
    ],
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

it.each([
  { name: "cancelled", press: "Cancel", focus: "Remove repo-11111111 from list" },
  {
    name: "ended with no Project left",
    press: "Remove from list",
    focus: "Add existing repository",
  },
])(
  "SH-B13: hands focus back to the Projects list when the removal is $name from Attention",
  async (row) => {
    const id = "11111111-1111-4111-8111-111111111111";
    let removed = false;
    exposeApi(
      readyApi({
        listProjects: async () =>
          removed
            ? { status: "listed", projects: [], hiddenCount: 0 }
            : registeredProjectList(id, { status: "healthy", storageId: id, generationId: id }),
        registerProject: async () => {
          removed = true;
          return decodeStrict(ProjectRegistrationResultSchema, {
            status: "removed",
            projectId: id,
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
