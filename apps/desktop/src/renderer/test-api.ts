import type { HarnessStatus } from "@slopstop/protocol";
import type { SlopStopApi } from "../shared/desktop-api.js";

/** Renderer tests drive the app through a fake preload API, never through Electron. */
export const readyStatus: Extract<HarnessStatus, { state: "ready" }> = {
  state: "ready",
  attempt: 1,
  harnessVersion: "0.0.0",
};

export function exposeApi(api: SlopStopApi): void {
  Object.defineProperty(window, "slopstop", {
    configurable: true,
    value: api,
  });
}

/** Preload methods a test does not exercise; each throws if it is called anyway. */
export const unusedWorkspaceApi = {
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

/** A ready harness with an empty list; tests override the methods they exercise. */
export function readyApi(overrides: Partial<SlopStopApi> = {}): SlopStopApi {
  return {
    ...unusedWorkspaceApi,
    getHarnessStatus: async () => readyStatus,
    retryHarness: async () => ({ ok: true }),
    subscribeHarnessStatus: () => () => {},
    ...overrides,
  };
}
