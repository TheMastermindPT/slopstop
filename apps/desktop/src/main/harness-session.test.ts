import { EventEmitter } from "node:events";
import { createHandshakeCommand, createReadyEvent, MessageIdSchema } from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import { HarnessSession, type HarnessSessionEvent } from "./harness-session.js";

class FakePort extends EventEmitter {
  readonly close = vi.fn();
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
}

const commandMetadata = {
  messageId: MessageIdSchema.parse("00000000-0000-4000-8000-000000000001"),
  sentAt: "2026-08-14T12:00:00.000Z",
};

const eventMetadata = {
  messageId: MessageIdSchema.parse("00000000-0000-4000-8000-000000000002"),
  sentAt: "2026-08-14T12:00:01.000Z",
  sequence: 1,
  causationId: commandMetadata.messageId,
};

describe("HarnessSession", () => {
  it("publishes validated messages and a distinct protocol error", () => {
    const session = new HarnessSession();
    const port = new FakePort();
    const events: HarnessSessionEvent[] = [];
    const unsubscribe = session.subscribe((event) => events.push(event));
    session.attach(port);
    const ready = createReadyEvent(eventMetadata, "0.0.0");

    port.emit("message", { data: ready });
    port.emit("message", { data: { event: "not-valid" } });

    expect(events).toEqual([{ type: "message", message: ready }, { type: "protocol-error" }]);
    unsubscribe();
    port.emit("message", { data: ready });
    expect(events).toHaveLength(2);
  });

  it("owns one active message port", () => {
    const session = new HarnessSession();
    const portA = new FakePort();
    const portB = new FakePort();
    const events: HarnessSessionEvent[] = [];
    session.subscribe((event) => events.push(event));

    session.attach(portA);
    session.attach(portB);

    expect(portA.start).toHaveBeenCalledOnce();
    expect(portA.listenerCount("message")).toBe(0);
    expect(portA.close).toHaveBeenCalledOnce();
    expect(portB.start).toHaveBeenCalledOnce();
    expect(events).toEqual([{ type: "disconnected" }]);

    session.detach();
    session.detach();

    expect(portB.listenerCount("message")).toBe(0);
    expect(portB.close).toHaveBeenCalledOnce();
    expect(events).toEqual([{ type: "disconnected" }, { type: "disconnected" }]);
  });

  it("returns exact send outcomes", () => {
    const session = new HarnessSession();
    const port = new FakePort();
    const handshake = createHandshakeCommand(commandMetadata, "0.0.0");

    expect(session.send({ command: "unknown" })).toEqual({
      ok: false,
      error: { code: "HARNESS_SESSION_MESSAGE_INVALID" },
    });
    expect(session.send(handshake)).toEqual({
      ok: false,
      error: { code: "HARNESS_SESSION_UNAVAILABLE" },
    });
    expect(port.postMessage).not.toHaveBeenCalled();

    session.attach(port);
    expect(session.send(handshake)).toEqual({ ok: true });
    expect(port.postMessage).toHaveBeenCalledExactlyOnceWith(handshake);

    port.postMessage.mockImplementation(() => {
      throw new Error("send failed");
    });
    expect(session.send(handshake)).toEqual({
      ok: false,
      error: { code: "HARNESS_SESSION_SEND_FAILED" },
    });
  });
});
