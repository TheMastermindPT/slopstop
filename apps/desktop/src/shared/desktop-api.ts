import type { HarnessStatus, RetryHarnessResult } from "@slopstop/protocol";

export const desktopIpcChannels = {
  getHarnessStatus: "harness:get-status",
  harnessStatusChanged: "harness:status-changed",
  retryHarness: "harness:retry",
} as const;

export interface SlopStopApi {
  getHarnessStatus(): Promise<HarnessStatus>;
  retryHarness(): Promise<RetryHarnessResult>;
  subscribeHarnessStatus(listener: (status: HarnessStatus) => void): () => void;
}
