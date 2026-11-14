import { decodeStrict, WorkspaceNotificationSchema } from "@slopstop/protocol";
import { beforeEach, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import type { IpcSender } from "./ipc-sender.js";
import type { WorkspaceBridgeClient } from "./workspace-bridge.js";
import { broadcastWorkspaceNotification, registerWorkspaceIpc } from "./workspace-ipc.js";
import { id, memoryIntent, memoryQuery, unavailableQueryResult } from "./workspace-test-peers.js";

const mainMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  handle: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: mainMocks.getAllWindows },
  ipcMain: { handle: mainMocks.handle },
}));

/** A sender rule that admits every call, so these rows see only the gate. */
const admittingSender: IpcSender = { admit: () => undefined };

beforeEach(() => {
  mainMocks.getAllWindows.mockReset();
  mainMocks.handle.mockReset();
});

it("keeps workspace IPC handlers narrow and validated", async () => {
  const query = memoryQuery();
  const intent = memoryIntent();
  const bridge = {
    query: vi.fn().mockResolvedValue(unavailableQueryResult(query)),
    stop: vi.fn(),
    submit: vi.fn().mockResolvedValue({ status: "forwarded", capability: "memory" }),
    subscribe: vi.fn(),
  } satisfies WorkspaceBridgeClient;
  registerWorkspaceIpc(bridge, { accepting: () => true }, admittingSender);
  const handlers = new Map(
    mainMocks.handle.mock.calls.map(([channel, handler]) => [channel as string, handler]),
  );
  const queryHandler = handlers.get(desktopIpcChannels.queryWorkspace);
  const intentHandler = handlers.get(desktopIpcChannels.submitWorkspaceIntent);

  await expect(queryHandler?.({}, query)).resolves.toEqual(unavailableQueryResult(query));
  await expect(intentHandler?.({}, intent)).resolves.toEqual({
    status: "forwarded",
    capability: "memory",
  });
  expect(bridge.query).toHaveBeenCalledExactlyOnceWith(query);
  expect(bridge.submit).toHaveBeenCalledExactlyOnceWith(intent);
  expect(() => queryHandler?.({}, { ...query, extra: true })).toThrow();
  expect(() => queryHandler?.({}, { query: "unknown" })).toThrow();
  expect(() => intentHandler?.({}, { ...intent, extra: true })).toThrow();
  expect(() => intentHandler?.({}, { intent: "unknown" })).toThrow();
  expect(bridge.query).toHaveBeenCalledTimes(1);
  expect(bridge.submit).toHaveBeenCalledTimes(1);

  const liveSend = vi.fn();
  const destroyedSend = vi.fn();
  mainMocks.getAllWindows.mockReturnValue([
    { isDestroyed: () => false, webContents: { send: liveSend } },
    { isDestroyed: () => true, webContents: { send: destroyedSend } },
  ]);
  const notification = decodeStrict(WorkspaceNotificationSchema, {
    capability: "memory",
    scope: { kind: "project", projectId: id(10) },
    revision: 1,
  });

  broadcastWorkspaceNotification(notification);
  expect(liveSend).toHaveBeenCalledExactlyOnceWith(
    desktopIpcChannels.workspaceNotification,
    notification,
  );
  expect(destroyedSend).not.toHaveBeenCalled();
  expect(() =>
    Reflect.apply(broadcastWorkspaceNotification, undefined, [{ ...notification, revision: -1 }]),
  ).toThrow();
  expect(liveSend).toHaveBeenCalledTimes(1);
});

const closingMessage = "The workspace is unavailable while SlopStop closes.";

it.each([
  {
    channel: "queryWorkspace",
    value: memoryQuery(),
    envelope: {
      status: "unavailable",
      query: memoryQuery(),
      diagnostic: { code: "WORKSPACE_CAPABILITY_UNAVAILABLE", message: closingMessage },
    },
  },
  {
    channel: "submitWorkspaceIntent",
    value: memoryIntent(),
    envelope: {
      status: "unavailable",
      capability: "memory",
      diagnostic: { code: "WORKSPACE_CAPABILITY_UNAVAILABLE", message: closingMessage },
    },
  },
] as const)("answers workspace unavailable after the IPC gate closes: $channel", async (row) => {
  mainMocks.handle.mockReset();
  const bridge = {
    query: vi.fn().mockResolvedValue(unavailableQueryResult(memoryQuery())),
    stop: vi.fn(),
    submit: vi.fn().mockResolvedValue({ status: "forwarded", capability: "memory" }),
    subscribe: vi.fn(),
  } satisfies WorkspaceBridgeClient;
  registerWorkspaceIpc(bridge, { accepting: () => false }, admittingSender);
  const handler = new Map(
    mainMocks.handle.mock.calls.map(([name, registered]) => [name as string, registered]),
  ).get(desktopIpcChannels[row.channel]);

  await expect(handler?.({}, row.value)).resolves.toEqual(row.envelope);
  expect(() => handler?.({}, { ...row.value, extra: true })).toThrow();
  expect(bridge.query).not.toHaveBeenCalled();
  expect(bridge.submit).not.toHaveBeenCalled();
});

/** A sender rule that refuses every call, as the real rule refuses an unknown frame. */
const refusingSender: IpcSender = {
  admit: () => {
    throw new Error("IPC call refused: unknown sender.");
  },
};

it.each([
  { channel: "queryWorkspace", value: memoryQuery() },
  { channel: "submitWorkspaceIntent", value: memoryIntent() },
] as const)(
  "refuses every channel from an unadmitted sender: $channel",
  async ({ channel, value }) => {
    const bridge = {
      query: vi.fn().mockResolvedValue(unavailableQueryResult(memoryQuery())),
      stop: vi.fn(),
      submit: vi.fn().mockResolvedValue({ status: "forwarded", capability: "memory" }),
      subscribe: vi.fn(),
    } satisfies WorkspaceBridgeClient;
    registerWorkspaceIpc(bridge, { accepting: () => true }, refusingSender);
    const handler = new Map(
      mainMocks.handle.mock.calls.map(([name, registered]) => [name as string, registered]),
    ).get(desktopIpcChannels[channel]);

    await expect(async () => handler?.({}, value)).rejects.toThrow(
      /^IPC call refused: unknown sender\.$/,
    );
    expect(bridge.query).not.toHaveBeenCalled();
    expect(bridge.submit).not.toHaveBeenCalled();
  },
);
