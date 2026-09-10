import { describe, expect, it } from "vitest";
import {
  createHandshakeCommand,
  createProjectCloseCommand,
  createProjectCloseResultEvent,
  createProjectCreateCommand,
  createProjectCreateResultEvent,
  createProjectOpenCommand,
  createProjectOpenResultEvent,
  createReadyEvent,
  createSystemFailureEvent,
  createWorkspaceIntentCommand,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryCommand,
  createWorkspaceQueryResultEvent,
  HarnessBootstrapSchema,
  HarnessStatusSchema,
  MessageIdSchema,
  ProjectIdSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
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

it("accepts the terminal harness shutdown diagnostic", () => {
  expect(
    HarnessStatusSchema.parse({
      state: "degraded",
      attempt: 1,
      diagnostic: {
        code: "HARNESS_SHUTDOWN_TIMEOUT",
        message: "Harness shutdown timed out.",
      },
    }),
  ).toBeDefined();
});

it("accepts only plain local file URLs as trusted harness roots", () => {
  expect(
    HarnessBootstrapSchema.parse({
      kind: "harness.connect",
      applicationStorageRootUrl: "file:///C:/Users/example/AppData/SlopStop/storage",
      migrationResourcesRootUrl: "file:///C:/Program%20Files/SlopStop/harness-migrations",
    }),
  ).toBeDefined();

  for (const invalid of [
    { applicationStorageRootUrl: "https://example.invalid/storage" },
    { applicationStorageRootUrl: "file://server/share/storage" },
    { applicationStorageRootUrl: "file:////server/share/storage" },
    { applicationStorageRootUrl: "file:///\\\\server/share/storage" },
    { applicationStorageRootUrl: "file:///%5C%5Cserver/share/storage" },
    { applicationStorageRootUrl: "file:///C:%2Fstorage" },
    { applicationStorageRootUrl: "file:///C:/%" },
    { applicationStorageRootUrl: "file:///C:/%2" },
    { applicationStorageRootUrl: "file:///C:/%GG" },
    { applicationStorageRootUrl: "file:///\t/server/share/storage" },
    { applicationStorageRootUrl: "file:///C:/stor\nage" },
    { applicationStorageRootUrl: " file:///C:/storage" },
    { applicationStorageRootUrl: "file:///C:/storage\n" },
    { applicationStorageRootUrl: "file://user:password@localhost/storage" },
    { migrationResourcesRootUrl: "file:///C:/migrations?version=1" },
    { applicationStorageRootUrl: "file:///C:/storage#fragment" },
    { migrationResourcesRootUrl: "not-a-url" },
  ]) {
    expect(
      HarnessBootstrapSchema.safeParse({
        kind: "harness.connect",
        applicationStorageRootUrl: "file:///C:/storage",
        migrationResourcesRootUrl: "file:///C:/migrations",
        ...invalid,
      }).success,
    ).toBe(false);
  }
  expect(HarnessBootstrapSchema.safeParse({ kind: "harness.connect" }).success).toBe(false);
  expect(
    HarnessBootstrapSchema.safeParse({
      kind: "harness.disconnect",
      applicationStorageRootUrl: "file:///C:/storage",
      migrationResourcesRootUrl: "file:///C:/migrations",
    }).success,
  ).toBe(false);
  expect(
    HarnessBootstrapSchema.safeParse({
      kind: "harness.connect",
      applicationStorageRootUrl: "file:///C:/storage",
      migrationResourcesRootUrl: "file:///C:/migrations",
      unexpected: true,
    }).success,
  ).toBe(false);
});

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
const storageUnavailable = {
  diagnostic: {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: "Project Storage owner is unavailable.",
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

function projectStorageExchanges() {
  const sentAt = "2026-08-14T12:00:00.000Z";
  const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
  const createRequestId = ProjectStorageCreateRequestIdSchema.parse(
    "00000000-0000-4000-8000-000000000011",
  );
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({ projectId, createRequestId });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });
  const open = createProjectOpenCommand(
    { messageId: "00000000-0000-4000-8000-000000000021", sentAt },
    openRequest,
  );
  const create = createProjectCreateCommand(
    { messageId: "00000000-0000-4000-8000-000000000022", sentAt },
    createRequest,
  );
  const close = createProjectCloseCommand(
    { messageId: "00000000-0000-4000-8000-000000000023", sentAt },
    closeRequest,
  );
  return [
    {
      command: open,
      commandName: "project.open",
      event: createProjectOpenResultEvent(
        {
          messageId: "00000000-0000-4000-8000-000000000031",
          sentAt,
          sequence: 1,
          causationId: open.messageId,
        },
        { status: "unavailable", request: openRequest, ...storageUnavailable },
      ),
      eventName: "project.open.result",
    },
    {
      command: create,
      commandName: "project.create",
      event: createProjectCreateResultEvent(
        {
          messageId: "00000000-0000-4000-8000-000000000032",
          sentAt,
          sequence: 2,
          causationId: create.messageId,
        },
        { status: "unavailable", request: createRequest, ...storageUnavailable },
      ),
      eventName: "project.create.result",
    },
    {
      command: close,
      commandName: "project.close",
      event: createProjectCloseResultEvent(
        {
          messageId: "00000000-0000-4000-8000-000000000033",
          sentAt,
          sequence: 3,
          causationId: close.messageId,
        },
        { status: "unavailable", request: closeRequest, ...storageUnavailable },
      ),
      eventName: "project.close.result",
    },
  ] as const;
}

describe("desktop protocol parsing", () => {
  it("parses only correctly scoped failure events at protocol version 4", () => {
    const requestFailure = {
      protocolVersion: 4,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000101",
      sentAt: "2026-09-04T12:00:00.000Z",
      sequence: 7,
      causationId: "00000000-0000-4000-8000-000000000102",
      event: "request.failure",
      payload: {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a message.",
        retryable: false,
      },
    };
    expect(parseHarnessMessage(requestFailure)).toEqual({ ok: true, value: requestFailure });
    expect(parseHarnessMessage({ ...requestFailure, causationId: null })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_type", path: "causationId" }],
      },
    });
    const systemFailure = { ...requestFailure, event: "system.failure", causationId: null };
    expect(parseHarnessMessage(systemFailure)).toEqual({ ok: true, value: systemFailure });
    expect(
      parseHarnessMessage({
        ...systemFailure,
        causationId: "00000000-0000-4000-8000-000000000102",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_type", path: "causationId" }],
      },
    });
    expect(parseHarnessMessage({ ...requestFailure, protocolVersion: 3 })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  });

  it("parses workspace commands and correlated result events under protocol version 4", () => {
    const { command, event, query, result } = workspaceExchange();

    expect(protocolVersion).toBe(4);
    expect(parseDesktopMessage(command)).toEqual({ ok: true, value: command });
    expect(command).toMatchObject({
      protocolVersion: 4,
      messageId: "00000000-0000-4000-8000-000000000001",
      payload: query,
    });
    expect(parseHarnessMessage(event)).toEqual({ ok: true, value: event });
    expect(event).toMatchObject({
      protocolVersion: 4,
      causationId: command.messageId,
      payload: result,
    });
  });

  it("round-trips Project Storage envelopes under protocol version 4", () => {
    expect(protocolVersion).toBe(4);
    for (const { command, commandName, event, eventName } of projectStorageExchanges()) {
      expect(parseDesktopMessage(command)).toEqual({ ok: true, value: command });
      expect(parseHarnessMessage(event)).toEqual({ ok: true, value: event });
      expect(command.command).toBe(commandName);
      expect(event).toMatchObject({
        event: eventName,
        causationId: command.messageId,
        payload: { request: command.payload },
      });
      expect(parseDesktopMessage({ ...command, protocolVersion: 2 })).toEqual({
        ok: false,
        error: {
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          issues: [{ code: "unsupported_value", path: "protocolVersion" }],
        },
      });
    }
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
      createSystemFailureEvent(
        { ...eventMetadata, causationId: null },
        {
          code: "HARNESS_INTERNAL_FAILURE",
          message: "Startup failed.",
          retryable: false,
        },
      ),
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
