import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  decodeStrict,
  HarnessStatusSchema,
  ProjectListResultSchema,
  ProjectRegistrationResultSchema,
  ProjectUpgradeRequestSchema,
  ProjectUpgradeResultSchema,
  RegistrationCapabilitySchema,
  RendererRegistrationRequestSchema,
  RepositoryChoiceResultSchema,
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
    decodeStrict(
      ProjectListResultSchema,
      await ipcRenderer.invoke(desktopIpcChannels.listProjects, {}),
    ),
  activateProject: async (request) =>
    decodeStrict(
      CanonicalProjectActivationResultSchema,
      await ipcRenderer.invoke(
        desktopIpcChannels.activateProject,
        decodeStrict(CanonicalProjectActivationRequestSchema, request),
      ),
    ),
  switchProject: async (request) =>
    decodeStrict(
      CanonicalProjectSwitchResultSchema,
      await ipcRenderer.invoke(
        desktopIpcChannels.switchProject,
        decodeStrict(CanonicalProjectSwitchRequestSchema, request),
      ),
    ),
  upgradeProject: async (request) =>
    decodeStrict(
      ProjectUpgradeResultSchema,
      await ipcRenderer.invoke(
        desktopIpcChannels.upgradeProject,
        decodeStrict(ProjectUpgradeRequestSchema, request),
      ),
    ),
  getRegistrationCapability: async () =>
    decodeStrict(
      RegistrationCapabilitySchema,
      await ipcRenderer.invoke(desktopIpcChannels.getRegistrationCapability),
    ),
  chooseRepository: async () =>
    decodeStrict(
      RepositoryChoiceResultSchema,
      await ipcRenderer.invoke(desktopIpcChannels.chooseRepository),
    ),
  registerProject: async (request) =>
    decodeStrict(
      ProjectRegistrationResultSchema,
      await ipcRenderer.invoke(
        desktopIpcChannels.registerProject,
        decodeStrict(RendererRegistrationRequestSchema, request),
      ),
    ),
  getHarnessStatus: async () => {
    return decodeStrict(
      HarnessStatusSchema,
      await ipcRenderer.invoke(desktopIpcChannels.getHarnessStatus),
    );
  },
  retryHarness: async () => {
    return decodeStrict(
      RetryHarnessResultSchema,
      await ipcRenderer.invoke(desktopIpcChannels.retryHarness),
    );
  },
  subscribeHarnessStatus: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(decodeStrict(HarnessStatusSchema, value));
    };
    ipcRenderer.on(desktopIpcChannels.harnessStatusChanged, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.harnessStatusChanged, receive);
    };
  },
  queryWorkspace: async (query: unknown) => {
    const validated = decodeStrict(WorkspaceQuerySchema, query);
    return decodeStrict(
      WorkspaceQueryResultSchema,
      await ipcRenderer.invoke(desktopIpcChannels.queryWorkspace, validated),
    );
  },
  submitWorkspaceIntent: async (intent: unknown) => {
    const validated = decodeStrict(WorkspaceIntentSchema, intent);
    return decodeStrict(
      WorkspaceIntentResultSchema,
      await ipcRenderer.invoke(desktopIpcChannels.submitWorkspaceIntent, validated),
    );
  },
  subscribeWorkspaceNotifications: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(decodeStrict(WorkspaceNotificationSchema, value));
    };
    ipcRenderer.on(desktopIpcChannels.workspaceNotification, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.workspaceNotification, receive);
    };
  },
};

contextBridge.exposeInMainWorld("slopstop", api);
