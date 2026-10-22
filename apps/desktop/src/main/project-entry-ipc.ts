import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectSwitchRequestSchema,
  decodeStrict,
  ProjectConversationReadRequestSchema,
  ProjectConversationSaveRequestSchema,
  ProjectListRequestSchema,
  ProjectUpgradeRequestSchema,
} from "@slopstop/protocol";
import { ipcMain } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
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
 * The Project handlers: each strictly decodes the renderer's value before the bridge sees it.
 * Once the gate closes, each answers its `unavailable` result without calling the bridge.
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
  gate: Readonly<{ accepting(): boolean }>,
): void {
  ipcMain.handle(desktopIpcChannels.listProjects, (_event, value: unknown) => {
    decodeStrict(ProjectListRequestSchema, value);
    if (!gate.accepting()) return Promise.resolve(projectListClosing);
    return projects.list();
  });
  ipcMain.handle(desktopIpcChannels.activateProject, (_event, value: unknown) => {
    const request = decodeStrict(CanonicalProjectActivationRequestSchema, value);
    if (!gate.accepting()) return Promise.resolve(projectActivationUnavailable(request));
    return projects.activate(request);
  });
  ipcMain.handle(desktopIpcChannels.switchProject, (_event, value: unknown) => {
    const request = decodeStrict(CanonicalProjectSwitchRequestSchema, value);
    if (!gate.accepting()) return Promise.resolve(projectSwitchUnavailable(request));
    return projects.switchProject(request);
  });
  ipcMain.handle(desktopIpcChannels.upgradeProject, (_event, value: unknown) => {
    const request = decodeStrict(ProjectUpgradeRequestSchema, value);
    if (!gate.accepting()) return Promise.resolve(projectUpgradeFailure(request, unsent));
    return projects.upgrade(request);
  });
  ipcMain.handle(desktopIpcChannels.readConversation, (_event, value: unknown) => {
    const request = decodeStrict(ProjectConversationReadRequestSchema, value);
    if (!gate.accepting()) return Promise.resolve(readConversationFailure(request, unsent));
    return projects.readConversation(request);
  });
  ipcMain.handle(desktopIpcChannels.saveConversationMessage, (_event, value: unknown) => {
    const request = decodeStrict(ProjectConversationSaveRequestSchema, value);
    if (!gate.accepting()) return Promise.resolve(saveConversationFailure(request, unsent));
    return projects.saveConversationMessage(request);
  });
}
