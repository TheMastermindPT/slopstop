import { randomUUID } from "node:crypto";
import type { ProjectRegistrationResult } from "@slopstop/protocol";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { desktopIpcChannels } from "../shared/desktop-api.js";
import { registerProjectRegistrationIpc } from "./project-registration-ipc.js";

type DialogAnswer = Readonly<{ canceled: boolean; filePaths: string[] }>;

const electronMocks = vi.hoisted(() => ({
  handle: vi.fn(),
  showOpenDialog: vi.fn<(...args: unknown[]) => Promise<DialogAnswer>>(),
}));
vi.mock("electron", () => ({
  ipcMain: { handle: electronMocks.handle },
  dialog: { showOpenDialog: electronMocks.showOpenDialog },
  BrowserWindow: { fromWebContents: () => undefined },
}));

const selectionId = randomUUID();
const unavailable = { status: "unavailable", code: "PROJECT_REGISTRATION_UNAVAILABLE" } as const;
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

function pinPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { configurable: true, value: platform });
}

/** Registers the handlers over a gate the row controls and a fake with an open-path answer. */
function registered(open: boolean) {
  let accepting = open;
  const register = vi.fn(
    async (): Promise<ProjectRegistrationResult> => ({
      status: "repository-selected",
      repositorySelectionId: selectionId,
    }),
  );
  registerProjectRegistrationIpc({ register }, { accepting: () => accepting });
  const handlers = new Map(
    electronMocks.handle.mock.calls.map(([channel, handler]) => [channel as string, handler]),
  );
  const handler = (channel: string) => {
    const found = handlers.get(channel);
    if (found === undefined) throw new Error(`No handler for ${channel}`);
    return (value?: unknown) => found({ sender: {} }, value);
  };
  return {
    register,
    handler,
    close: () => {
      accepting = false;
    },
  };
}

/** The gate is open on entry and closes while the dialog is pending; then the dialog answers. */
async function closeWhileDialogOpen(dialogAnswer: DialogAnswer): Promise<void> {
  let answer: (value: DialogAnswer) => void = () => undefined;
  electronMocks.showOpenDialog.mockImplementation(
    () =>
      new Promise<DialogAnswer>((resolve) => {
        answer = resolve;
      }),
  );
  const { register, handler, close } = registered(true);
  const choice = handler(desktopIpcChannels.chooseRepository)();
  await vi.waitFor(() => expect(electronMocks.showOpenDialog).toHaveBeenCalledOnce());
  close();
  answer(dialogAnswer);
  await expect(choice).resolves.toEqual(unavailable);
  expect(register).not.toHaveBeenCalled();
}

beforeEach(() => {
  electronMocks.handle.mockReset();
  electronMocks.showOpenDialog.mockReset();
  electronMocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["C:/repo"] });
  pinPlatform("win32");
});

afterEach(() => {
  if (originalPlatform !== undefined) Object.defineProperty(process, "platform", originalPlatform);
});

it.each([
  {
    channel: "registerProject",
    async run() {
      const { register, handler } = registered(false);
      const call = handler(desktopIpcChannels.registerProject);
      await expect(call({ step: "prepare-git" })).resolves.toEqual(unavailable);
      expect(() => call({ step: "prepare-git", extra: true })).toThrow();
      expect(register).not.toHaveBeenCalled();
    },
  },
  {
    channel: "chooseRepository",
    async run() {
      const { register, handler } = registered(false);
      await expect(handler(desktopIpcChannels.chooseRepository)()).resolves.toEqual(unavailable);
      expect(electronMocks.showOpenDialog).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
    },
  },
  {
    channel: "chooseRepository off Windows",
    async run() {
      pinPlatform("linux");
      const { register, handler } = registered(false);
      await expect(handler(desktopIpcChannels.chooseRepository)()).resolves.toEqual(unavailable);
      expect(electronMocks.showOpenDialog).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
    },
  },
  {
    channel: "chooseRepository while the dialog is open",
    run: () => closeWhileDialogOpen({ canceled: false, filePaths: ["C:/repo"] }),
  },
  {
    channel: "chooseRepository cancelled while closing",
    run: () => closeWhileDialogOpen({ canceled: true, filePaths: [] }),
  },
  {
    channel: "getRegistrationCapability",
    async run() {
      const { handler } = registered(false);
      expect(await handler(desktopIpcChannels.getRegistrationCapability)()).toEqual({
        status: "available",
      });
    },
  },
])("answers registration unavailable after the IPC gate closes: $channel", async ({ run }) => {
  await run();
});

it.each([
  {
    channel: "registerProject",
    async run() {
      const { register, handler } = registered(true);
      await expect(
        handler(desktopIpcChannels.registerProject)({ step: "prepare-git" }),
      ).resolves.toEqual({
        status: "repository-selected",
        repositorySelectionId: selectionId,
      });
      expect(register).toHaveBeenCalledExactlyOnceWith({ step: "prepare-git" });
    },
  },
  {
    channel: "chooseRepository",
    async run() {
      const { register, handler } = registered(true);
      await expect(handler(desktopIpcChannels.chooseRepository)()).resolves.toEqual({
        status: "repository-selected",
        repositorySelectionId: selectionId,
        directory: "C:/repo",
      });
      expect(register).toHaveBeenCalledExactlyOnceWith({
        step: "select-repository",
        directory: "C:/repo",
      });
    },
  },
])("forwards registration while the IPC gate is open: $channel", async ({ run }) => {
  await run();
});
