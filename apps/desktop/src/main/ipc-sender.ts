import type { Logger } from "pino";

/** The one text of a refused IPC call: its rejection and its log line. */
const ipcSenderRefusedMessage = "IPC call refused: unknown sender.";

type FrameId = Readonly<{ processId: number; routingId: number }>;

/** A window the rule tracks: its contents' id, read once, and its `closed` event. */
type TrackedWindow = Readonly<{
  webContents: Readonly<{ id: number }>;
  once(event: "closed", listener: () => void): unknown;
}>;

/** The parts of an IPC invoke event the rule reads. */
export type IpcSenderEvent = Readonly<{
  sender: Readonly<{ id: number; mainFrame: FrameId }>;
  senderFrame: FrameId | null;
}>;

/** The admit side of the rule, which every IPC handler checks first. */
export type IpcSender = Readonly<{ admit(channel: string, event: IpcSenderEvent): void }>;

function sameFrame(frame: FrameId, mainFrame: FrameId): boolean {
  return frame.processId === mainFrame.processId && frame.routingId === mainFrame.routingId;
}

/**
 * The IPC sender rule: a call is admitted only from the current main frame of a window SlopStop
 * created and tracked. Every refusal logs its channel only and throws one fixed error.
 */
export function createIpcSender(options: Readonly<{ logger: Pick<Logger, "warn"> }>) {
  const tracked = new Set<number>();
  function refuse(channel: string): never {
    options.logger.warn({ channel }, ipcSenderRefusedMessage);
    throw new Error(ipcSenderRefusedMessage);
  }
  return {
    track(window: TrackedWindow): void {
      const id = window.webContents.id;
      tracked.add(id);
      window.once("closed", () => {
        tracked.delete(id);
      });
    },
    admit(channel: string, event: IpcSenderEvent): void {
      const frame = event.senderFrame;
      if (frame === null) refuse(channel);
      if (!tracked.has(event.sender.id)) refuse(channel);
      if (!sameFrame(frame, event.sender.mainFrame)) refuse(channel);
    },
  };
}
