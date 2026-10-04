import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchResultSchema,
  decodeStrict,
  type HarnessStatus,
  ProjectListResultSchema,
} from "@slopstop/protocol";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SlopStopApi } from "../shared/desktop-api.js";
import { App } from "./app.js";

const startingStatus: HarnessStatus = {
  state: "starting",
  attempt: 1,
};

const readyStatus: HarnessStatus = {
  state: "ready",
  attempt: 1,
  harnessVersion: "0.0.0",
};

function exposeApi(api: SlopStopApi): void {
  Object.defineProperty(window, "slopstop", {
    configurable: true,
    value: api,
  });
}

/** One registered, present Project whose Storage state the test chooses. */
function registeredProjectList(id: string, storage: unknown) {
  return decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: [
      {
        registration: "registered",
        projectId: id,
        name: "chess",
        repositoryBindingId: id,
        workspaceId: id,
        access: "not-assessed",
        repositoryLocation: { status: "present" },
        storage,
      },
    ],
  });
}

const unusedWorkspaceApi = {
  listProjects: async () => ({ status: "listed" as const, projects: [] }),
  getRegistrationCapability: async () => ({ status: "available" as const }),
  chooseRepository: async () => {
    throw new Error("chooseRepository is not used by this test.");
  },
  registerProject: async () => {
    throw new Error("registerProject is not used by this test.");
  },
  activateProject: async () => {
    throw new Error("Activation unused");
  },
  switchProject: async () => {
    throw new Error("Switch unused");
  },
  queryWorkspace: async () => {
    throw new Error("queryWorkspace is not used by this test.");
  },
  submitWorkspaceIntent: async () => {
    throw new Error("submitWorkspaceIntent is not used by this test.");
  },
  subscribeWorkspaceNotifications: () => () => undefined,
} satisfies Pick<
  SlopStopApi,
  | "queryWorkspace"
  | "submitWorkspaceIntent"
  | "subscribeWorkspaceNotifications"
  | "listProjects"
  | "activateProject"
  | "switchProject"
  | "getRegistrationCapability"
  | "chooseRepository"
  | "registerProject"
>;

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
      const open = await screen.findByRole("button", { name: `Open project ${id}` });
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
                name: "chess",
                repositoryBindingId: projectId,
                workspaceId: projectId,
                access: "not-assessed",
                repositoryLocation: { status: "present" },
                storage: { status: "healthy", storageId: projectId, generationId: projectId },
              },
            ],
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
        await user.click(await screen.findByRole("button", { name: `Open project ${oldId}` }));
      else await screen.findByText("Loading saved Projects…");
      await act(async () => {
        notify({ ...readyStatus, attempt: 2 });
      });
      await user.click(await screen.findByRole("button", { name: `Open project ${newId}` }));
      await screen.findByRole("heading", { name: "Project 22222222" });
      await act(async () => {
        release();
      });
      expect(screen.queryByRole("button", { name: `Open project ${oldId}` })).toBeNull();
      expect(screen.getByRole("heading", { name: "Project 22222222" })).toBeTruthy();
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
            name: "chess",
            repositoryBindingId: projectId,
            workspaceId: projectId,
            access: "not-assessed",
            repositoryLocation: { status: "present" },
            storage: { status: "healthy", storageId: projectId, generationId: projectId },
          })),
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
    await user.click(await screen.findByRole("button", { name: `Open project ${first}` }));
    await user.click(screen.getByRole("button", { name: `Open project ${second}` }));
    expect((await screen.findByRole("alert")).textContent).toContain("Target unavailable");
    expect(screen.getByRole("heading", { name: "Project 11111111" })).toBeTruthy();
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
    const open = await screen.findByRole("button", { name: `Open project ${id}` });
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

  it("offers an explicit retry after the harness exhausts automatic recovery", async () => {
    const retryHarness = vi.fn(async () => ({ ok: true as const }));
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

    render(<App />);

    const retry = await screen.findByRole("button", { name: "Retry harness" });
    await userEvent.setup().click(retry);

    expect(retryHarness).toHaveBeenCalledOnce();
  });
});
