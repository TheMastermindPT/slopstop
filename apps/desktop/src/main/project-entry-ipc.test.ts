import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { registerProjectEntryIpc } from "./project-entry-ipc.js";

const electronMocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: electronMocks.handle } }));

type Projects = Parameters<typeof registerProjectEntryIpc>[0];

const projectId = randomUUID();
const listed = { status: "listed", projects: [], hiddenCount: 0 } as const;
const connectionUnavailable = {
  code: "PROJECT_COORDINATOR_UNAVAILABLE",
  message: "The Project connection is unavailable.",
  retryable: false,
} as const;

/** Bridge fakes that answer each forwarded request with a result echoing it. */
function registered() {
  const projects = {
    list: vi.fn<Projects["list"]>(async () => listed),
    activate: vi.fn<Projects["activate"]>(async (request) => ({
      status: "not-registered",
      request,
    })),
    switchProject: vi.fn<Projects["switchProject"]>(async (request) => ({
      status: "coordinator-unavailable",
      request,
      diagnostic: connectionUnavailable,
    })),
    upgrade: vi.fn<Projects["upgrade"]>(async (request) => ({ status: "not-required", request })),
  } satisfies Projects;
  registerProjectEntryIpc(projects);
  const handlers = new Map(
    electronMocks.handle.mock.calls.map(([channel, handler]) => [channel as string, handler]),
  );
  const handler = (channel: string) => {
    const found = handlers.get(channel);
    if (found === undefined) throw new Error(`No handler for ${channel}`);
    return (value: unknown) => found({}, value);
  };
  return { projects, handler };
}

beforeEach(() => {
  electronMocks.handle.mockReset();
});

it("registers strict Project IPC handlers: upgrade", async () => {
  const { projects, handler } = registered();
  const upgrade = handler(desktopIpcChannels.upgradeProject);
  await expect(upgrade({ projectId })).resolves.toEqual({
    status: "not-required",
    request: { projectId },
  });
  expect(projects.upgrade).toHaveBeenCalledExactlyOnceWith({ projectId });
  expect(() => upgrade({ projectId, extra: true })).toThrow();
  expect(() => upgrade({})).toThrow();
  expect(projects.upgrade).toHaveBeenCalledTimes(1);
});

it("registers strict Project IPC handlers: list, activate and switch as before", async () => {
  const { projects, handler } = registered();
  const switchRequest = {
    from: { projectId: randomUUID(), activationId: randomUUID() },
    to: { projectId },
  };

  await expect(handler(desktopIpcChannels.listProjects)({})).resolves.toEqual(listed);
  expect(projects.list).toHaveBeenCalledExactlyOnceWith();
  expect(() => handler(desktopIpcChannels.listProjects)({ extra: true })).toThrow();

  await expect(handler(desktopIpcChannels.activateProject)({ projectId })).resolves.toEqual({
    status: "not-registered",
    request: { projectId },
  });
  expect(projects.activate).toHaveBeenCalledExactlyOnceWith({ projectId });
  expect(() => handler(desktopIpcChannels.activateProject)({ projectId, extra: true })).toThrow();

  await expect(handler(desktopIpcChannels.switchProject)(switchRequest)).resolves.toEqual({
    status: "coordinator-unavailable",
    request: switchRequest,
    diagnostic: connectionUnavailable,
  });
  expect(projects.switchProject).toHaveBeenCalledExactlyOnceWith(switchRequest);
  expect(() =>
    handler(desktopIpcChannels.switchProject)({ ...switchRequest, extra: true }),
  ).toThrow();

  expect(projects.list).toHaveBeenCalledTimes(1);
  expect(projects.activate).toHaveBeenCalledTimes(1);
  expect(projects.switchProject).toHaveBeenCalledTimes(1);
});
