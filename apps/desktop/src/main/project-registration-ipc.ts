import {
  decodeStrict,
  type ProjectRegistrationRequest,
  type ProjectRegistrationResult,
  type RegistrationCapability,
  RendererRegistrationRequestSchema,
  type RepositoryChoiceResult,
  RepositoryChoiceResultSchema,
} from "@slopstop/protocol";
import { BrowserWindow, dialog } from "electron";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { handleGatedIpc, handleIpc, type IpcGate } from "./ipc-gate.js";
import type { IpcSender } from "./ipc-sender.js";
import { projectRegistrationClosing } from "./project-entry-bridge.js";

type RegistrationBridge = Readonly<{
  register(request: ProjectRegistrationRequest): Promise<ProjectRegistrationResult>;
}>;

/** PC-S1 adds repositories on Windows only (B4); the platform is known before any dialog. */
function registrationCapability(platform: NodeJS.Platform): RegistrationCapability {
  return platform === "win32"
    ? { status: "available" }
    : { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
}

/**
 * Runs the main process's own folder dialog and records its result as the selection. The
 * directory sent to the harness is only ever this dialog's answer.
 */
async function chooseRepository(
  bridge: RegistrationBridge,
  gate: IpcGate,
  owner: BrowserWindow | undefined,
): Promise<RepositoryChoiceResult> {
  if (!gate.accepting()) return projectRegistrationClosing;
  const capability = registrationCapability(process.platform);
  if (capability.status !== "available") return capability;
  const options = { properties: ["openDirectory" as const] };
  const answer = await (owner === undefined
    ? dialog.showOpenDialog(options)
    : dialog.showOpenDialog(owner, options));
  // Shutdown may have started while the dialog was open, whatever the dialog answered.
  if (!gate.accepting()) return projectRegistrationClosing;
  const directory = answer.filePaths[0];
  if (answer.canceled || directory === undefined) return { status: "cancelled" };
  const selected = await bridge.register({ step: "select-repository", directory });
  return decodeStrict(
    RepositoryChoiceResultSchema,
    selected.status === "repository-selected" ? { ...selected, directory } : selected,
  );
}

export function registerProjectRegistrationIpc(
  bridge: RegistrationBridge,
  gate: IpcGate,
  sender: IpcSender,
): void {
  handleIpc(desktopIpcChannels.getRegistrationCapability, sender, () =>
    registrationCapability(process.platform),
  );
  handleIpc(desktopIpcChannels.chooseRepository, sender, (event) =>
    chooseRepository(bridge, gate, BrowserWindow.fromWebContents(event.sender) ?? undefined),
  );
  handleGatedIpc(
    desktopIpcChannels.registerProject,
    RendererRegistrationRequestSchema,
    { gate, sender },
    {
      closing: () => projectRegistrationClosing,
      forward: (request) => bridge.register(request),
    },
  );
}
