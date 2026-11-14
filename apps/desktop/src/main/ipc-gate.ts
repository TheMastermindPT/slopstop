import { decodeStrict } from "@slopstop/protocol";
import { type IpcMainInvokeEvent, ipcMain } from "electron";
import type { IpcSender } from "./ipc-sender.js";

/** The IPC gate: open until shutdown starts. */
export type IpcGate = Readonly<{ accepting(): boolean }>;

/** The shutdown gate and the sender rule a gated handler checks. */
export type IpcGuard = Readonly<{ gate: IpcGate; sender: IpcSender }>;

type RequestSchema = Parameters<typeof decodeStrict>[0];

/** What a gated handler answers once the gate closes, and where it forwards while it is open. */
type GatedAnswers<Request, Result> = Readonly<{
  closing(request: Request): Result;
  forward(request: Request): Promise<Result>;
}>;

/**
 * Registers one gated handler. Each call checks its sender first, then strictly decodes the
 * renderer's value, so an invalid value throws before the gate is read; once the gate closes it
 * answers the closing result without forwarding.
 */
export function handleGatedIpc<Schema extends RequestSchema, Result>(
  channel: string,
  schema: Schema,
  guard: IpcGuard,
  answers: GatedAnswers<Schema["Type"], Result>,
): void {
  ipcMain.handle(channel, (event, value: unknown) => {
    guard.sender.admit(channel, event);
    const request = decodeStrict(schema, value);
    if (!guard.gate.accepting()) return Promise.resolve(answers.closing(request));
    return answers.forward(request);
  });
}

/** Registers one handler that has no gate; each call checks its sender first. */
export function handleIpc(
  channel: string,
  sender: IpcSender,
  handler: (event: IpcMainInvokeEvent) => unknown,
): void {
  ipcMain.handle(channel, (event) => {
    sender.admit(channel, event);
    return handler(event);
  });
}
