import { describe, expect, it } from "vitest";
import {
  createFailureEvent,
  createHandshakeCommand,
  createReadyEvent,
  MessageIdSchema,
  parseDesktopMessage,
  parseHarnessMessage,
  protocolVersion,
  readMessageId,
} from "./index.js";

const validHandshake = {
  protocolVersion,
  messageType: "command",
  messageId: "00000000-0000-4000-8000-000000000001",
  sentAt: "2026-08-14T12:00:00.000Z",
  command: "system.handshake",
  payload: {
    desktopVersion: "0.0.0",
  },
} as const;

describe("desktop protocol parsing", () => {
  it("accepts an exact versioned handshake", () => {
    expect(parseDesktopMessage(validHandshake)).toEqual({
      ok: true,
      value: validHandshake,
    });
  });

  it("distinguishes an unsupported protocol version from malformed input", () => {
    expect(
      parseDesktopMessage({
        ...validHandshake,
        protocolVersion: 2,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  });

  it("reports an unknown command as an invalid message", () => {
    expect(
      parseDesktopMessage({
        ...validHandshake,
        command: "system.unknown",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_value", path: "command" }],
      },
    });
  });

  it("creates canonical command and event envelopes", () => {
    const messageId = MessageIdSchema.parse("00000000-0000-4000-8000-000000000002");
    const metadata = {
      messageId,
      sentAt: "2026-08-14T12:00:01.000Z",
    };
    const eventMetadata = {
      ...metadata,
      sequence: 1,
      causationId: MessageIdSchema.parse(validHandshake.messageId),
    };

    expect(createHandshakeCommand(metadata, "0.0.0")).toMatchObject({
      command: "system.handshake",
      messageId,
    });
    expect(createReadyEvent(eventMetadata, "0.0.0")).toMatchObject({
      event: "system.ready",
      payload: { harnessVersion: "0.0.0" },
    });
    expect(
      createFailureEvent(eventMetadata, {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Startup failed.",
        retryable: false,
      }),
    ).toMatchObject({
      event: "system.failure",
      payload: { code: "HARNESS_INTERNAL_FAILURE" },
    });
  });

  it("reads valid IDs without treating missing or malformed IDs as absent success", () => {
    expect(readMessageId(validHandshake)).toBe(validHandshake.messageId);
    expect(readMessageId(null)).toBeNull();
    expect(readMessageId({})).toBeNull();
    expect(readMessageId({ messageId: "not-a-uuid" })).toBeNull();
  });

  it("distinguishes invalid harness events from unsupported versions", () => {
    expect(parseHarnessMessage({ protocolVersion, event: "unknown" })).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_MESSAGE_INVALID" },
    });
    expect(parseHarnessMessage({ protocolVersion: 2 })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  });
});
