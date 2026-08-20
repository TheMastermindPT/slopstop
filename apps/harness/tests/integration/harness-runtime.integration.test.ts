import { MessageChannel, type MessagePort } from "node:worker_threads";
import { protocolVersion } from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import { type HarnessTransport, startHarnessRuntime } from "../../src/index.js";

function transportFor(port: MessagePort): HarnessTransport {
  return {
    send(message) {
      port.postMessage(message);
    },
    subscribe(listener) {
      port.on("message", listener);
      return () => port.off("message", listener);
    },
  };
}

function nextMessage(port: MessagePort): Promise<unknown> {
  return new Promise((resolve) => {
    port.once("message", resolve);
  });
}

describe("harness message channel integration", () => {
  it("round-trips the versioned startup handshake over structured clone", async () => {
    const { port1, port2 } = new MessageChannel();
    const stop = startHarnessRuntime({
      transport: transportFor(port1),
      harnessVersion: "0.0.0",
      createId: () => "00000000-0000-4000-8000-000000000002",
      now: () => "2026-08-14T12:00:01.000Z",
    });
    const response = nextMessage(port2);

    port2.postMessage({
      protocolVersion,
      messageType: "command",
      messageId: "00000000-0000-4000-8000-000000000001",
      sentAt: "2026-08-14T12:00:00.000Z",
      command: "system.handshake",
      payload: { desktopVersion: "0.0.0" },
    });

    await expect(response).resolves.toEqual({
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000001",
      event: "system.ready",
      payload: { harnessVersion: "0.0.0" },
    });

    stop();
    port1.close();
    port2.close();
  });
});
