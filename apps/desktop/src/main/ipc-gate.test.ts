import { Schema } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { handleGatedIpc, handleIpc } from "./ipc-gate.js";
import type { IpcSender, IpcSenderEvent } from "./ipc-sender.js";

type Handler = (event: unknown, value: unknown) => unknown;

const ipcMocks = vi.hoisted(() => ({
  handle: vi.fn<(channel: string, handler: Handler) => void>(),
}));

vi.mock("electron", () => ({ ipcMain: { handle: ipcMocks.handle } }));

const RequestSchema = Schema.Struct({ name: Schema.String });
type Request = typeof RequestSchema.Type;
const request: Request = { name: "first" };

/** A sender rule that admits every call, so these rows see only the gate. */
const admittingSender: IpcSender = { admit: () => undefined };

beforeEach(() => {
  ipcMocks.handle.mockReset();
});

/** Registers one gated handler over spies and returns them with the registered handler. */
function register(accepting: () => boolean) {
  const gate = { accepting: vi.fn(accepting) };
  const closing = vi.fn((value: Request) => ({ status: "closing", value }));
  const forward = vi.fn((value: Request) => Promise.resolve({ status: "forwarded", value }));
  handleGatedIpc(
    "test:channel",
    RequestSchema,
    { gate, sender: admittingSender },
    { closing, forward },
  );
  const handler: Handler = (event, value) => ipcMocks.handle.mock.calls[0]?.[1](event, value);
  return { gate, closing, forward, handler };
}

it("registers one handler on its channel", () => {
  register(() => true);

  expect(ipcMocks.handle).toHaveBeenCalledOnce();
  expect(ipcMocks.handle.mock.calls[0]?.[0]).toBe("test:channel");
});

it("forwards the decoded request while the gate is open", async () => {
  const { closing, forward, handler } = register(() => true);

  const answer = handler({}, request);

  expect(answer).toBe(forward.mock.results[0]?.value);
  await expect(answer).resolves.toEqual({ status: "forwarded", value: request });
  expect(forward).toHaveBeenCalledExactlyOnceWith(request);
  expect(closing).not.toHaveBeenCalled();
});

it("answers the closing result once the gate closes", async () => {
  const { closing, forward, handler } = register(() => false);

  await expect(handler({}, request)).resolves.toEqual({ status: "closing", value: request });
  expect(closing).toHaveBeenCalledExactlyOnceWith(request);
  expect(forward).not.toHaveBeenCalled();
});

it.each([
  { gate: "open", open: true },
  { gate: "closed", open: false },
])("rejects an invalid value before reading the gate: $gate", ({ open }) => {
  const { gate, closing, forward, handler } = register(() => open);

  expect(() => handler({}, { ...request, extra: true })).toThrow();
  expect(gate.accepting).not.toHaveBeenCalled();
  expect(closing).not.toHaveBeenCalled();
  expect(forward).not.toHaveBeenCalled();
});

it("reads the gate on every call", async () => {
  let open = true;
  const { gate, closing, forward, handler } = register(() => open);

  await handler({}, request);
  open = false;
  await handler({}, request);

  expect(gate.accepting).toHaveBeenCalledTimes(2);
  expect(forward).toHaveBeenCalledOnce();
  expect(closing).toHaveBeenCalledOnce();
});

it.each([
  { helper: "handleGatedIpc with a valid value", value: request, plain: false },
  {
    helper: "handleGatedIpc with an invalid value",
    value: { ...request, extra: true },
    plain: false,
  },
  { helper: "handleIpc", value: undefined, plain: true },
])("refuses an unadmitted call before decoding or gating: $helper", ({ value, plain }) => {
  const sender = {
    admit: vi.fn<(channel: string, event: IpcSenderEvent) => void>(() => {
      throw new Error("IPC call refused: unknown sender.");
    }),
  };
  const gate = { accepting: vi.fn(() => true) };
  const closing = vi.fn((answer: Request) => answer);
  const forward = vi.fn((answer: Request) => Promise.resolve(answer));
  const plainHandler = vi.fn();
  if (plain) handleIpc("test:channel", sender, plainHandler);
  else handleGatedIpc("test:channel", RequestSchema, { gate, sender }, { closing, forward });
  const event = { sender: { id: 1 } };

  expect(() => ipcMocks.handle.mock.calls[0]?.[1](event, value)).toThrow(
    /^IPC call refused: unknown sender\.$/,
  );
  expect(sender.admit).toHaveBeenCalledOnce();
  expect(sender.admit.mock.calls[0]?.[0]).toBe("test:channel");
  expect(sender.admit.mock.calls[0]?.[1]).toBe(event);
  for (const spy of [gate.accepting, closing, forward, plainHandler])
    expect(spy).not.toHaveBeenCalled();
});
