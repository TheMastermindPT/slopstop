import {
  HarnessStatusSchema,
  RetryHarnessResultSchema,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  off: vi.fn(),
  on: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: electronMocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: electronMocks.invoke,
    off: electronMocks.off,
    on: electronMocks.on,
  },
}));

await import("./preload.js");

type ExposedApi = Readonly<{
  getHarnessStatus(): Promise<unknown>;
  queryWorkspace(query: unknown): Promise<unknown>;
  retryHarness(): Promise<unknown>;
  submitWorkspaceIntent(intent: unknown): Promise<unknown>;
  subscribeHarnessStatus(listener: (status: unknown) => void): () => void;
  subscribeWorkspaceNotifications(listener: (notification: unknown) => void): () => void;
}>;

function exposedApi(): ExposedApi {
  const call = electronMocks.exposeInMainWorld.mock.calls[0];
  if (call?.[0] !== "slopstop") {
    throw new Error("Preload API was not exposed.");
  }
  return call[1] as ExposedApi;
}

const query = WorkspaceQuerySchema.parse({
  query: "memory-library.read",
  projectId: "00000000-0000-4000-8000-000000000001",
  cursor: null,
});
const intent = WorkspaceIntentSchema.parse({
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000001",
  proposalId: "00000000-0000-4000-8000-000000000002",
  decision: "accept",
  expectedProjectionRevision: 0,
});
const queryResult = WorkspaceQueryResultSchema.parse({
  status: "unavailable",
  query,
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});
const intentResult = WorkspaceIntentResultSchema.parse({
  status: "unavailable",
  capability: "memory",
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});

beforeEach(() => {
  electronMocks.invoke.mockReset();
  electronMocks.off.mockReset();
  electronMocks.on.mockReset();
});

describe("preload workspace API", () => {
  it("validates harness status methods and subscriptions", async () => {
    const status = HarnessStatusSchema.parse({
      state: "ready",
      attempt: 1,
      harnessVersion: "0.0.0",
    });
    const retry = RetryHarnessResultSchema.parse({ ok: true });
    electronMocks.invoke.mockImplementation((channel) => {
      if (channel === desktopIpcChannels.getHarnessStatus) {
        return Promise.resolve(status);
      }
      if (channel === desktopIpcChannels.retryHarness) {
        return Promise.resolve(retry);
      }
      throw new Error(`Unexpected channel: ${String(channel)}`);
    });
    const api = exposedApi();

    await expect(api.getHarnessStatus()).resolves.toEqual(status);
    await expect(api.retryHarness()).resolves.toEqual(retry);
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(1, desktopIpcChannels.getHarnessStatus);
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(2, desktopIpcChannels.retryHarness);

    const listener = vi.fn();
    const unsubscribe = api.subscribeHarnessStatus(listener);
    const receive = electronMocks.on.mock.calls[0]?.[1];
    expect(electronMocks.on).toHaveBeenCalledExactlyOnceWith(
      desktopIpcChannels.harnessStatusChanged,
      receive,
    );
    Reflect.apply(receive, undefined, [{}, status]);
    expect(listener).toHaveBeenCalledExactlyOnceWith(status);
    expect(() => Reflect.apply(receive, undefined, [{}, { state: "ready" }])).toThrow();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(electronMocks.off).toHaveBeenCalledExactlyOnceWith(
      desktopIpcChannels.harnessStatusChanged,
      receive,
    );
  });

  it("validates workspace requests and results at preload", async () => {
    electronMocks.invoke.mockImplementation((channel) => {
      if (channel === desktopIpcChannels.queryWorkspace) {
        return Promise.resolve(queryResult);
      }
      if (channel === desktopIpcChannels.submitWorkspaceIntent) {
        return Promise.resolve(intentResult);
      }
      throw new Error(`Unexpected channel: ${String(channel)}`);
    });
    const api = exposedApi();

    await expect(api.queryWorkspace(query)).resolves.toEqual(queryResult);
    await expect(api.submitWorkspaceIntent(intent)).resolves.toEqual(intentResult);
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      desktopIpcChannels.queryWorkspace,
      query,
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      desktopIpcChannels.submitWorkspaceIntent,
      intent,
    );

    await expect(api.queryWorkspace({ ...query, extra: true })).rejects.toThrow();
    await expect(api.submitWorkspaceIntent({ ...intent, extra: true })).rejects.toThrow();
    expect(electronMocks.invoke).toHaveBeenCalledTimes(2);

    electronMocks.invoke.mockResolvedValueOnce({ status: "ready", query });
    await expect(api.queryWorkspace(query)).rejects.toThrow();
  });

  it("validates and unsubscribes workspace notifications", () => {
    const api = exposedApi();
    const listener = vi.fn();
    const unsubscribe = api.subscribeWorkspaceNotifications(listener);
    const firstReceive = electronMocks.on.mock.calls[0]?.[1];
    const notification = WorkspaceNotificationSchema.parse({
      capability: "memory",
      scope: {
        kind: "project",
        projectId: "00000000-0000-4000-8000-000000000001",
      },
      revision: 1,
    });

    expect(electronMocks.on).toHaveBeenCalledExactlyOnceWith(
      desktopIpcChannels.workspaceNotification,
      firstReceive,
    );
    Reflect.apply(firstReceive, undefined, [{}, notification]);
    expect(listener).toHaveBeenCalledExactlyOnceWith(notification);
    expect(() =>
      Reflect.apply(firstReceive, undefined, [{}, { ...notification, revision: -1 }]),
    ).toThrow();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(electronMocks.off).toHaveBeenCalledExactlyOnceWith(
      desktopIpcChannels.workspaceNotification,
      firstReceive,
    );
    api.subscribeWorkspaceNotifications(vi.fn());
    expect(electronMocks.on.mock.calls[1]?.[1]).not.toBe(firstReceive);
  });
});
