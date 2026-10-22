import { randomUUID } from "node:crypto";
import {
  projectAvailabilityMessages,
  projectConversationDiagnostics,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
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

/**
 * Bridge fakes that answer each forwarded request with a result echoing it, registered behind a
 * gate that stays open or closed.
 */
function registeredWith(switchProject: Projects["switchProject"], accepting: boolean) {
  const projects = {
    list: vi.fn<Projects["list"]>(async () => listed),
    activate: vi.fn<Projects["activate"]>(async (request) => ({
      status: "not-registered",
      request,
    })),
    switchProject: vi.fn<Projects["switchProject"]>(switchProject),
    upgrade: vi.fn<Projects["upgrade"]>(async (request) => ({ status: "not-required", request })),
    readConversation: vi.fn<Projects["readConversation"]>(async (request) => ({
      status: "read",
      request,
      conversation: null,
    })),
    saveConversationMessage: vi.fn<Projects["saveConversationMessage"]>(async (request) => ({
      status: "conflict",
      request,
      currentRevision: 0,
    })),
  } satisfies Projects;
  registerProjectEntryIpc(projects, { accepting: () => accepting });
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

/** The open-gate fakes the existing rows use. */
function registered() {
  return registeredWith(
    async (request) => ({
      status: "coordinator-unavailable",
      request,
      diagnostic: connectionUnavailable,
    }),
    true,
  );
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

it("registers strict conversation IPC handlers", async () => {
  const { projects, handler } = registered();
  const activation = { projectId, activationId: randomUUID() };
  const read = { ...activation, after: null };
  const save = { ...activation, saveId: randomUUID(), expectedRevision: 0, text: "Hello" };

  await expect(handler(desktopIpcChannels.readConversation)(read)).resolves.toEqual({
    status: "read",
    request: read,
    conversation: null,
  });
  expect(projects.readConversation).toHaveBeenCalledExactlyOnceWith(read);
  expect(() => handler(desktopIpcChannels.readConversation)({ ...read, extra: true })).toThrow();
  expect(projects.readConversation).toHaveBeenCalledTimes(1);

  await expect(handler(desktopIpcChannels.saveConversationMessage)(save)).resolves.toEqual({
    status: "conflict",
    request: save,
    currentRevision: 0,
  });
  expect(projects.saveConversationMessage).toHaveBeenCalledExactlyOnceWith(save);
  expect(() =>
    handler(desktopIpcChannels.saveConversationMessage)({ ...save, extra: true }),
  ).toThrow();
  expect(projects.saveConversationMessage).toHaveBeenCalledTimes(1);
});

/** Gated fakes: each answers its open path, which differs from the gated envelope. */
function gated() {
  return registeredWith(
    async (request) => ({
      status: "target-result",
      request,
      target: { status: "not-registered", request: { projectId: request.to.projectId } },
    }),
    false,
  );
}

const activation = { projectId, activationId: randomUUID() };
const switchRequest = { from: activation, to: { projectId: randomUUID() } };
const readRequest = { ...activation, after: null };
const saveRequest = { ...activation, saveId: randomUUID(), expectedRevision: 0, text: "Hello" };
const coordinatorDiagnostic = (retryable: boolean) => ({
  code: "PROJECT_COORDINATOR_UNAVAILABLE",
  message: projectAvailabilityMessages.connectionLost,
  retryable,
});

const gatedRows = [
  {
    channel: "listProjects",
    fake: "list",
    value: {},
    envelope: { status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" },
  },
  {
    channel: "activateProject",
    fake: "activate",
    value: { projectId },
    envelope: {
      status: "unavailable",
      request: { projectId },
      diagnostic: coordinatorDiagnostic(true),
    },
  },
  {
    channel: "switchProject",
    fake: "switchProject",
    value: switchRequest,
    envelope: {
      status: "coordinator-unavailable",
      request: switchRequest,
      diagnostic: coordinatorDiagnostic(false),
    },
  },
  {
    channel: "upgradeProject",
    fake: "upgrade",
    value: { projectId },
    envelope: {
      status: "unavailable",
      request: { projectId },
      diagnostic: projectUpgradeDiagnostics.connectionLost,
    },
  },
  {
    channel: "readConversation",
    fake: "readConversation",
    value: readRequest,
    envelope: {
      status: "unavailable",
      request: readRequest,
      diagnostic: projectConversationDiagnostics.connectionLost,
    },
  },
  {
    channel: "saveConversationMessage",
    fake: "saveConversationMessage",
    value: saveRequest,
    envelope: {
      status: "unavailable",
      request: saveRequest,
      diagnostic: projectConversationDiagnostics.connectionLost,
    },
  },
] as const;

it.each(gatedRows)(
  "answers unavailable after the IPC gate closes: $channel",
  async ({ channel, fake, value, envelope }) => {
    const { projects, handler } = gated();
    const call = handler(desktopIpcChannels[channel]);
    await expect(call(value)).resolves.toEqual(envelope);
    expect(() => call({ ...value, extra: true })).toThrow();
    expect(projects[fake]).not.toHaveBeenCalled();
  },
);
