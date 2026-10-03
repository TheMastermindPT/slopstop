import type {
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
  HarnessStatus,
  ProjectListResult,
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
  getHarnessStatus: "harness:get-status",
  harnessStatusChanged: "harness:status-changed",
  retryHarness: "harness:retry",
  queryWorkspace: "workspace:query",
  submitWorkspaceIntent: "workspace:submit-intent",
  workspaceNotification: "workspace:notification",
} as const;

export interface SlopStopApi {
  listProjects(): Promise<ProjectListResult>;
  activateProject(
    request: CanonicalProjectActivationRequest,
  ): Promise<CanonicalProjectActivationResult>;
  switchProject(request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult>;
  getHarnessStatus(): Promise<HarnessStatus>;
  retryHarness(): Promise<RetryHarnessResult>;
  subscribeHarnessStatus(listener: (status: HarnessStatus) => void): () => void;
  queryWorkspace(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submitWorkspaceIntent(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribeWorkspaceNotifications(
    listener: (notification: WorkspaceNotification) => void,
  ): () => void;
}
