import { protocolVersion } from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import { type HarnessTransport, type StopHarnessRuntime, startHarnessRuntime } from "./index.js";

const handshake = {
  protocolVersion,
  messageType: "command",
  messageId: "00000000-0000-4000-8000-000000000001",
  sentAt: "2026-08-14T12:00:00.000Z",
  command: "system.handshake",
  payload: {
    desktopVersion: "0.0.0",
  },
} as const;

class TestTransport implements HarnessTransport {
  readonly sent: unknown[] = [];
  #listener: ((message: unknown) => void) | undefined;

  emit(message: unknown): void {
    this.#listener?.(message);
  }

  send(message: unknown): void {
    this.sent.push(message);
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = undefined;
    };
  }
}

function startRuntime(transport: TestTransport): StopHarnessRuntime {
  return startHarnessRuntime({
    transport,
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });
}

describe("harness runtime transport", () => {
  it("answers a valid handshake with an exact sequenced ready event", () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    transport.emit(handshake);

    expect(transport.sent).toEqual([
      {
        protocolVersion,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: handshake.messageId,
        event: "system.ready",
        payload: {
          harnessVersion: "0.0.0",
        },
      },
    ]);

    stop();
  });

  it("reports an unsupported peer as a failure rather than ready or absent", () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    transport.emit({
      ...handshake,
      protocolVersion: 2,
    });

    expect(transport.sent).toEqual([
      {
        protocolVersion,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: handshake.messageId,
        event: "system.failure",
        payload: {
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          message: "Desktop and harness protocol versions are incompatible.",
          retryable: false,
        },
      },
    ]);

    stop();
  });

  it("stops receiving messages after disposal", () => {
    const transport = new TestTransport();
    const stop = startRuntime(transport);

    stop();
    transport.emit(handshake);

    expect(transport.sent).toEqual([]);
  });
});
