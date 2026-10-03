import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  HarnessStatusSchema,
  ProjectListResultSchema,
  RetryHarnessResultSchema,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { desktopIpcChannels, type SlopStopApi } from "../shared/desktop-api.js";

const api: SlopStopApi = {
  listProjects: async () =>
    ProjectListResultSchema.parse(await ipcRenderer.invoke(desktopIpcChannels.listProjects, {})),
  activateProject: async (request) =>
    CanonicalProjectActivationResultSchema.parse(
      await ipcRenderer.invoke(
        desktopIpcChannels.activateProject,
        CanonicalProjectActivationRequestSchema.parse(request),
      ),
    ),
  switchProject: async (request) =>
    CanonicalProjectSwitchResultSchema.parse(
      await ipcRenderer.invoke(
        desktopIpcChannels.switchProject,
        CanonicalProjectSwitchRequestSchema.parse(request),
      ),
    ),
  getHarnessStatus: async () => {
    return HarnessStatusSchema.parse(await ipcRenderer.invoke(desktopIpcChannels.getHarnessStatus));
  },
  retryHarness: async () => {
    return RetryHarnessResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.retryHarness),
    );
  },
  subscribeHarnessStatus: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(HarnessStatusSchema.parse(value));
    };
    ipcRenderer.on(desktopIpcChannels.harnessStatusChanged, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.harnessStatusChanged, receive);
    };
  },
  queryWorkspace: async (query: unknown) => {
    const validated = WorkspaceQuerySchema.parse(query);
    return WorkspaceQueryResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.queryWorkspace, validated),
    );
  },
  submitWorkspaceIntent: async (intent: unknown) => {
    const validated = WorkspaceIntentSchema.parse(intent);
    return WorkspaceIntentResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.submitWorkspaceIntent, validated),
    );
  },
  subscribeWorkspaceNotifications: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(WorkspaceNotificationSchema.parse(value));
    };
    ipcRenderer.on(desktopIpcChannels.workspaceNotification, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.workspaceNotification, receive);
    };
  },
};

contextBridge.exposeInMainWorld("slopstop", api);
