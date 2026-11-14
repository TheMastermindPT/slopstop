import {
  decodeStrict,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { BrowserWindow } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { handleGatedIpc, type IpcGate } from "./ipc-gate.js";
import type { IpcSender } from "./ipc-sender.js";
import {
  capabilityForIntent,
  type WorkspaceBridgeClient,
  workspaceIntentClosing,
  workspaceQueryClosing,
} from "./workspace-bridge.js";

export function broadcastWorkspaceNotification(notification: WorkspaceNotification): void {
  const validated = decodeStrict(WorkspaceNotificationSchema, notification);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(desktopIpcChannels.workspaceNotification, validated);
    }
  }
}

/**
 * The workspace handlers: each first admits only a call from SlopStop's own window (the sender
 * rule), then strictly decodes the renderer's value before the bridge sees it. Once the gate
 * closes, each answers its closing envelope without calling the bridge.
 */
export function registerWorkspaceIpc(
  bridge: WorkspaceBridgeClient,
  gate: IpcGate,
  sender: IpcSender,
): void {
  handleGatedIpc(
    desktopIpcChannels.queryWorkspace,
    WorkspaceQuerySchema,
    { gate, sender },
    {
      closing: workspaceQueryClosing,
      forward: (query) => bridge.query(query),
    },
  );
  handleGatedIpc(
    desktopIpcChannels.submitWorkspaceIntent,
    WorkspaceIntentSchema,
    { gate, sender },
    {
      closing: (intent) => workspaceIntentClosing(capabilityForIntent(intent)),
      forward: (intent) => bridge.submit(intent),
    },
  );
}
