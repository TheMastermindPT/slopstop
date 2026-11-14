import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectSwitchRequestSchema,
  ProjectConversationReadRequestSchema,
  ProjectConversationSaveRequestSchema,
  ProjectListRequestSchema,
  ProjectUpgradeRequestSchema,
} from "@slopstop/protocol";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { handleGatedIpc, type IpcGate } from "./ipc-gate.js";
import type { IpcSender } from "./ipc-sender.js";
import {
  readConversationFailure,
  saveConversationFailure,
} from "./project-conversation-failure.js";
import {
  type ProjectEntryBridge,
  projectActivationUnavailable,
  projectListClosing,
  projectSwitchUnavailable,
  unsent,
} from "./project-entry-bridge.js";
import { projectUpgradeFailure } from "./project-upgrade-failure.js";

/**
 * The Project handlers: each first admits only a call from SlopStop's own window (the sender
 * rule), then strictly decodes the renderer's value before the bridge sees it. Once the gate
 * closes, each answers its `unavailable` result without calling the bridge.
 */
export function registerProjectEntryIpc(
  projects: Pick<
    ProjectEntryBridge,
    | "list"
    | "activate"
    | "switchProject"
    | "upgrade"
    | "readConversation"
    | "saveConversationMessage"
  >,
  gate: IpcGate,
  sender: IpcSender,
): void {
  handleGatedIpc(
    desktopIpcChannels.listProjects,
    ProjectListRequestSchema,
    { gate, sender },
    {
      closing: () => projectListClosing,
      forward: () => projects.list(),
    },
  );
  handleGatedIpc(
    desktopIpcChannels.activateProject,
    CanonicalProjectActivationRequestSchema,
    { gate, sender },
    {
      closing: projectActivationUnavailable,
      forward: (request) => projects.activate(request),
    },
  );
  handleGatedIpc(
    desktopIpcChannels.switchProject,
    CanonicalProjectSwitchRequestSchema,
    { gate, sender },
    {
      closing: projectSwitchUnavailable,
      forward: (request) => projects.switchProject(request),
    },
  );
  handleGatedIpc(
    desktopIpcChannels.upgradeProject,
    ProjectUpgradeRequestSchema,
    { gate, sender },
    {
      closing: (request) => projectUpgradeFailure(request, unsent),
      forward: (request) => projects.upgrade(request),
    },
  );
  handleGatedIpc(
    desktopIpcChannels.readConversation,
    ProjectConversationReadRequestSchema,
    { gate, sender },
    {
      closing: (request) => readConversationFailure(request, unsent),
      forward: (request) => projects.readConversation(request),
    },
  );
  handleGatedIpc(
    desktopIpcChannels.saveConversationMessage,
    ProjectConversationSaveRequestSchema,
    { gate, sender },
    {
      closing: (request) => saveConversationFailure(request, unsent),
      forward: (request) => projects.saveConversationMessage(request),
    },
  );
}
