import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectSwitchRequestSchema,
  decodeStrict,
  ProjectListRequestSchema,
  ProjectUpgradeRequestSchema,
} from "@slopstop/protocol";
import { ipcMain } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import type { ProjectEntryBridge } from "./project-entry-bridge.js";

/** The Project handlers: each strictly decodes the renderer's value before the bridge sees it. */
export function registerProjectEntryIpc(
  projects: Pick<ProjectEntryBridge, "list" | "activate" | "switchProject" | "upgrade">,
): void {
  ipcMain.handle(desktopIpcChannels.listProjects, (_event, value: unknown) => {
    decodeStrict(ProjectListRequestSchema, value);
    return projects.list();
  });
  ipcMain.handle(desktopIpcChannels.activateProject, (_event, value: unknown) =>
    projects.activate(decodeStrict(CanonicalProjectActivationRequestSchema, value)),
  );
  ipcMain.handle(desktopIpcChannels.switchProject, (_event, value: unknown) =>
    projects.switchProject(decodeStrict(CanonicalProjectSwitchRequestSchema, value)),
  );
  ipcMain.handle(desktopIpcChannels.upgradeProject, (_event, value: unknown) =>
    projects.upgrade(decodeStrict(ProjectUpgradeRequestSchema, value)),
  );
}
