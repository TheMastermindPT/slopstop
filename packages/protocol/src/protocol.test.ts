import { describe, expect, it } from "vitest";
import {
  createFailureEvent,
  createHandshakeCommand,
  createReadyEvent,
  createWorkspaceIntentCommand,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryCommand,
  createWorkspaceQueryResultEvent,
  MessageIdSchema,
  parseDesktopMessage,
  parseHarnessMessage,
  protocolVersion,
  readMessageId,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
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

function workspaceExchange() {
  const query = WorkspaceQuerySchema.parse({
    query: "memory-library.read",
    projectId: "00000000-0000-4000-8000-000000000010",
    cursor: null,
  });
  const result = WorkspaceQueryResultSchema.parse({
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  });
  const command = createWorkspaceQueryCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000001",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    query,
  );
  const event = createWorkspaceQueryResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId: command.messageId,
    },
    result,
  );
  return { command, event, query, result };
}

describe("desktop protocol parsing", () => {
  it("parses workspace commands and correlated result events under protocol version 2", () => {
    const { command, event, query, result } = workspaceExchange();

    expect(protocolVersion).toBe(2);
    expect(parseDesktopMessage(command)).toEqual({ ok: true, value: command });
    expect(command).toMatchObject({
      protocolVersion: 2,
      messageId: "00000000-0000-4000-8000-000000000001",
      payload: query,
    });
    expect(parseHarnessMessage(event)).toEqual({ ok: true, value: event });
    expect(event).toMatchObject({
      protocolVersion: 2,
      causationId: command.messageId,
      payload: result,
    });
  });

  it("rejects incompatible and unknown workspace envelopes", () => {
    const { command, event } = workspaceExchange();

    expect(parseDesktopMessage({ ...command, protocolVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_VERSION_UNSUPPORTED" },
    });
    expect(parseHarnessMessage({ ...event, protocolVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_VERSION_UNSUPPORTED" },
    });
    expect(parseDesktopMessage({ ...command, command: "workspace.unknown" })).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_MESSAGE_INVALID" },
    });
    expect(parseHarnessMessage({ ...event, event: "workspace.unknown" })).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_MESSAGE_INVALID" },
    });
  });

  it("preserves the versioned system handshake", () => {
    const handshake = createHandshakeCommand(
      {
        messageId: "00000000-0000-4000-8000-000000000003",
        sentAt: "2026-08-14T12:00:02.000Z",
      },
      "0.0.0",
    );
    const ready = createReadyEvent(
      {
        messageId: "00000000-0000-4000-8000-000000000004",
        sentAt: "2026-08-14T12:00:03.000Z",
        sequence: 2,
        causationId: handshake.messageId,
      },
      "0.0.0",
    );
    expect(parseHarnessMessage(ready)).toEqual({ ok: true, value: ready });
  });

  it("accepts an exact versioned handshake", () => {
    expect(parseDesktopMessage(validHandshake)).toEqual({
      ok: true,
      value: validHandshake,
    });
  });

  it("creates exact intent and invalidation envelopes", () => {
    const intent = WorkspaceIntentSchema.parse({
      intent: "memory.proposal.review",
      projectId: "00000000-0000-4000-8000-000000000010",
      proposalId: "00000000-0000-4000-8000-000000000011",
      decision: "accept",
      expectedProjectionRevision: 0,
    });
    const command = createWorkspaceIntentCommand(
      {
        messageId: "00000000-0000-4000-8000-000000000001",
        sentAt: "2026-08-14T12:00:00.000Z",
      },
      intent,
    );
    const result = WorkspaceIntentResultSchema.parse({
      status: "forwarded",
      capability: "memory",
    });
    const resultEvent = createWorkspaceIntentResultEvent(
      {
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: command.messageId,
      },
      result,
    );
    const notification = WorkspaceNotificationSchema.parse({
      capability: "memory",
      scope: {
        kind: "project",
        projectId: "00000000-0000-4000-8000-000000000010",
      },
      revision: 1,
    });
    const notificationEvent = createWorkspaceProjectionInvalidatedEvent(
      {
        messageId: "00000000-0000-4000-8000-000000000003",
        sentAt: "2026-08-14T12:00:02.000Z",
        sequence: 2,
        causationId: null,
      },
      notification,
    );

    expect(command).toMatchObject({ command: "workspace.intent", payload: intent });
    expect(resultEvent).toMatchObject({
      event: "workspace.intent.result",
      causationId: command.messageId,
      payload: result,
    });
    expect(notificationEvent).toMatchObject({
      event: "workspace.projection.invalidated",
      causationId: null,
      payload: notification,
    });
  });

  it("distinguishes an unsupported protocol version from malformed input", () => {
    expect(
      parseDesktopMessage({
        ...validHandshake,
        protocolVersion: 1,
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
    expect(parseDesktopMessage(null)).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_type", path: "$" }],
      },
    });

    expect(
      parseDesktopMessage({
        ...validHandshake,
        payload: { desktopVersion: 1 },
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_type", path: "payload.desktopVersion" }],
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
    expect(readMessageId("not-an-envelope")).toBeNull();
    expect(readMessageId(42)).toBeNull();
    expect(readMessageId({})).toBeNull();
    expect(readMessageId({ messageId: "not-a-uuid" })).toBeNull();
  });

  it("distinguishes invalid harness events from unsupported versions", () => {
    expect(parseHarnessMessage({ protocolVersion, event: "unknown" })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_value", path: "event" }],
      },
    });
    expect(parseHarnessMessage({ protocolVersion: 1 })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  });
});
