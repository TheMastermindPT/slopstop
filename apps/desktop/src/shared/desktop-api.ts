import type {
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
  HarnessStatus,
  ProjectConversationReadRequest,
  ProjectConversationReadResult,
  ProjectConversationSaveRequest,
  ProjectConversationSaveResult,
  ProjectListResult,
  ProjectRegistrationResult,
  ProjectUpgradeRequest,
  ProjectUpgradeResult,
  RegistrationCapability,
  RendererRegistrationRequest,
  RepositoryChoiceResult,
  RetryHarnessResult,
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "@slopstop/protocol";

export const desktopIpcChannels = {
  listProjects: "projects:list",
  activateProject: "projects:activate",
  switchProject: "projects:switch",
  upgradeProject: "projects:upgrade",
  readConversation: "projects:conversation:read",
  saveConversationMessage: "projects:conversation:save",
  getHarnessStatus: "harness:get-status",
  harnessStatusChanged: "harness:status-changed",
  retryHarness: "harness:retry",
  queryWorkspace: "workspace:query",
  submitWorkspaceIntent: "workspace:submit-intent",
  workspaceNotification: "workspace:notification",
  getRegistrationCapability: "registration:capability",
  chooseRepository: "registration:choose-repository",
  registerProject: "registration:step",
} as const;

export interface SlopStopApi {
  listProjects(): Promise<ProjectListResult>;
  activateProject(
    request: CanonicalProjectActivationRequest,
  ): Promise<CanonicalProjectActivationResult>;
  switchProject(request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult>;
  upgradeProject(request: ProjectUpgradeRequest): Promise<ProjectUpgradeResult>;
  readConversation(request: ProjectConversationReadRequest): Promise<ProjectConversationReadResult>;
  saveConversationMessage(
    request: ProjectConversationSaveRequest,
  ): Promise<ProjectConversationSaveResult>;
  getRegistrationCapability(): Promise<RegistrationCapability>;
  /** Opens the main process's native folder dialog; the renderer never supplies a path. */
  chooseRepository(): Promise<RepositoryChoiceResult>;
  registerProject(request: RendererRegistrationRequest): Promise<ProjectRegistrationResult>;
  getHarnessStatus(): Promise<HarnessStatus>;
  retryHarness(): Promise<RetryHarnessResult>;
  subscribeHarnessStatus(listener: (status: HarnessStatus) => void): () => void;
  queryWorkspace(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submitWorkspaceIntent(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribeWorkspaceNotifications(
    listener: (notification: WorkspaceNotification) => void,
  ): () => void;
}
