import { Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import { decodeStrict } from "./schema-codec.js";

function isDecoder(value: unknown): value is Schema.Decoder<unknown> {
  return Schema.isSchema(value);
}

import type { CanonicalProjectSwitchRequest, CanonicalProjectSwitchResult } from "./index.js";
import * as protocol from "./index.js";
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
    decodeStrict(HarnessStatusSchema, {
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
    decodeStrict(HarnessBootstrapSchema, {
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
      decodeWithIssues(HarnessBootstrapSchema, {
        kind: "harness.connect",
        applicationStorageRootUrl: "file:///C:/storage",
        migrationResourcesRootUrl: "file:///C:/migrations",
        ...invalid,
      }).success,
    ).toBe(false);
  }
  expect(decodeWithIssues(HarnessBootstrapSchema, { kind: "harness.connect" }).success).toBe(false);
  expect(
    decodeWithIssues(HarnessBootstrapSchema, {
      kind: "harness.disconnect",
      applicationStorageRootUrl: "file:///C:/storage",
      migrationResourcesRootUrl: "file:///C:/migrations",
    }).success,
  ).toBe(false);
  expect(
    decodeWithIssues(HarnessBootstrapSchema, {
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
  const query = decodeStrict(WorkspaceQuerySchema, {
    query: "memory-library.read",
    projectId: "00000000-0000-4000-8000-000000000010",
    cursor: null,
  });
  const result = decodeStrict(WorkspaceQueryResultSchema, {
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
  const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
  const createRequestId = decodeStrict(
    ProjectStorageCreateRequestIdSchema,
    "00000000-0000-4000-8000-000000000011",
  );
  const openRequest = decodeStrict(ProjectStorageOpenRequestSchema, { projectId });
  const createRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId,
    createRequestId,
  });
  const closeRequest = decodeStrict(ProjectStorageCloseRequestSchema, { projectId });
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
  const resultMetadata = (sequence: number, causationId: string) => ({
    messageId: `00000000-0000-4000-8000-00000000003${sequence}`,
    sentAt,
    sequence,
    causationId,
  });
  return [
    {
      command: open,
      commandName: "project.open",
      event: createProjectOpenResultEvent(resultMetadata(1, open.messageId), {
        status: "unavailable",
        request: openRequest,
        ...storageUnavailable,
      }),
      eventName: "project.open.result",
    },
    {
      command: create,
      commandName: "project.create",
      event: createProjectCreateResultEvent(resultMetadata(2, create.messageId), {
        status: "unavailable",
        request: createRequest,
        ...storageUnavailable,
      }),
      eventName: "project.create.result",
    },
    {
      command: close,
      commandName: "project.close",
      event: createProjectCloseResultEvent(resultMetadata(3, close.messageId), {
        status: "unavailable",
        request: closeRequest,
        ...storageUnavailable,
      }),
      eventName: "project.close.result",
    },
  ] as const;
}

describe("desktop protocol parsing", () => {
  it("parses canonical Project activation and command protocol branches", () => {
    const request = { projectId: "00000000-0000-4000-8000-000000000010" };
    const activation = { ...validHandshake, command: "project.activate", payload: request };
    expect(parseDesktopMessage(activation)).toEqual({ ok: true, value: activation });
    const result = {
      protocolVersion: 7,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: validHandshake.sentAt,
      sequence: 1,
      causationId: validHandshake.messageId,
      event: "project.activate.result",
      payload: {
        status: "active",
        request,
        access: "read-only",
        activationId: "00000000-0000-4000-8000-000000000011",
        writerGeneration: null,
        diagnostic: {
          code: "WRITER_UNAVAILABLE",
          message: "Another SlopStop process holds Project write authority.",
          retryable: true,
        },
      },
    };
    expect(parseHarnessMessage(result)).toEqual({ ok: true, value: result });
    expect(
      parseHarnessMessage({ ...result, payload: { ...result.payload, writerGeneration: 1 } }),
    ).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_MESSAGE_INVALID",
        issues: [{ code: "invalid_union", path: "payload" }],
      },
    });
  });
  it("parses only correctly scoped failure events at protocol version 7", () => {
    const requestFailure = {
      protocolVersion: 7,
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
    expect(parseHarnessMessage({ ...requestFailure, protocolVersion: 4 })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  });

  it("parses workspace commands and correlated result events under protocol version 7", () => {
    const { command, event, query, result } = workspaceExchange();

    expect(protocolVersion).toBe(7);
    expect(parseDesktopMessage(command)).toEqual({ ok: true, value: command });
    expect(command).toMatchObject({
      protocolVersion: 7,
      messageId: "00000000-0000-4000-8000-000000000001",
      payload: query,
    });
    expect(parseHarnessMessage(event)).toEqual({ ok: true, value: event });
    expect(event).toMatchObject({
      protocolVersion: 7,
      causationId: command.messageId,
      payload: result,
    });
  });

  it("round-trips Project Storage envelopes under protocol version 7", () => {
    expect(protocolVersion).toBe(7);
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
    const intent = decodeStrict(WorkspaceIntentSchema, {
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
    const result = decodeStrict(WorkspaceIntentResultSchema, {
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
    const notification = decodeStrict(WorkspaceNotificationSchema, {
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
    const messageId = decodeStrict(MessageIdSchema, "00000000-0000-4000-8000-000000000002");
    const metadata = {
      messageId,
      sentAt: "2026-08-14T12:00:01.000Z",
    };
    const eventMetadata = {
      ...metadata,
      sequence: 1,
      causationId: decodeStrict(MessageIdSchema, validHandshake.messageId),
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

describe("S5 G2 receipt envelopes", () => {
  const receipt = {
    receiptId: "66666666-6666-4666-8666-666666666501",
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    commandId: "44444444-4444-4444-8444-444444444501",
    commandType: "conformance.counter.set",
    commandVersion: 1,
    outcome: "applied",
    projectSequence: 1,
    writerGeneration: 1,
    settledAt: "2026-09-05T12:00:01.000Z",
    events: [
      { eventId: "77777777-7777-4777-8777-777777777501", eventOrdinal: 0 },
      { eventId: "77777777-7777-4777-8777-777777777502", eventOrdinal: 1 },
    ],
  };
  const payload = {
    status: "settled",
    projectId: receipt.projectId,
    activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    commandId: receipt.commandId,
    receipt,
  };
  const envelope = {
    protocolVersion: 7,
    messageType: "event",
    messageId: "99999999-9999-4999-8999-999999999501",
    sentAt: "2026-09-05T12:00:06.000Z",
    sequence: 1,
    causationId: "11111111-1111-4111-8111-111111111501",
    event: "project.command.result",
    payload,
  };
  it("validates settled receipts and new non-durable result branches: v4 envelope", () => {
    expect(parseHarnessMessage(envelope)).toEqual({ ok: true, value: envelope });
  });
  it.each([
    {
      ...envelope,
      payload: {
        ...payload,
        receipt: { ...receipt, projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
      },
    },
    {
      ...envelope,
      payload: {
        ...payload,
        receipt: { ...receipt, commandId: "44444444-4444-4444-8444-444444444502" },
      },
    },
    { ...envelope, payload: { ...payload, receipt: { ...receipt, payload: { private: true } } } },
    {
      ...envelope,
      payload: {
        ...payload,
        diagnostic: { code: "PRIVATE", message: "private", retryable: false },
      },
    },
  ])(
    "validates settled receipts and new non-durable result branches: invalid envelope %#",
    (invalid) => {
      const parsed = parseHarnessMessage(invalid);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) throw new Error("Invalid receipt envelope was accepted.");
      expect(parsed.error.code).toBe("PROTOCOL_MESSAGE_INVALID");
    },
  );
});

const switchRequest = {
  from: {
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  },
  to: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
};
const switchCommandEnvelope = {
  protocolVersion: 7,
  messageType: "command",
  messageId: "11111111-1111-4111-8111-111111111402",
  sentAt: "2026-09-05T12:00:00.000Z",
  command: "project.switch",
  payload: switchRequest,
};
const switchResult = {
  status: "target-result",
  request: switchRequest,
  target: {
    status: "active",
    request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
    access: "read-write",
    activationId: "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    writerGeneration: 1,
  },
};
const switchEventEnvelope = {
  protocolVersion: 7,
  messageType: "event",
  messageId: "99999999-9999-4999-8999-999999999402",
  sentAt: "2026-09-05T12:00:04.000Z",
  sequence: 2,
  causationId: switchCommandEnvelope.messageId,
  event: "project.switch.result",
  payload: switchResult,
};

describe.each([
  { name: "A to B", payload: switchRequest },
  {
    name: "A to A",
    payload: { ...switchRequest, to: { projectId: switchRequest.from.projectId } },
  },
])("switch transport $name", ({ payload }) => {
  it("parses only strict source-qualified switch requests", () => {
    const envelope = { ...switchCommandEnvelope, payload };
    expect(parseDesktopMessage(envelope)).toEqual({ ok: true, value: envelope });
  });
});

const malformedSwitchPayloads = [
  { ...switchRequest, extra: true },
  { ...switchRequest, from: { ...switchRequest.from, extra: true } },
  { ...switchRequest, to: { ...switchRequest.to, extra: true } },
  { ...switchRequest, to: { ...switchRequest.to, activationId: switchRequest.from.activationId } },
  { to: switchRequest.to },
  { ...switchRequest, from: { activationId: switchRequest.from.activationId } },
  { ...switchRequest, from: { projectId: switchRequest.from.projectId } },
  { ...switchRequest, to: {} },
  ...(
    [
      { parent: "from", key: "projectId", value: switchRequest.from.projectId },
      { parent: "from", key: "activationId", value: switchRequest.from.activationId },
      { parent: "to", key: "projectId", value: switchRequest.to.projectId },
    ] as const
  ).flatMap(({ parent, key, value }) =>
    ["not-a-uuid", "00000000-0000-0000-0000-000000000000", value.toUpperCase()].map((invalid) => ({
      ...switchRequest,
      [parent]: { ...switchRequest[parent], [key]: invalid },
    })),
  ),
];

describe.each(malformedSwitchPayloads.map((payload, index) => ({ payload, index })))(
  "malformed switch transport $index",
  ({ payload }) => {
    it("parses only strict source-qualified switch requests", () => {
      const parsed = parseDesktopMessage({ ...switchCommandEnvelope, payload });
      expect(parsed.ok).toBe(false);
      if (parsed.ok) throw new Error("Malformed switch transport was accepted.");
      expect(parsed.error.code).toBe("PROTOCOL_MESSAGE_INVALID");
    });
  },
);

describe.each([
  {
    factoryName: "createProjectSwitchCommand",
    schemaName: "CanonicalProjectSwitchRequestSchema",
    metadata: { messageId: switchCommandEnvelope.messageId, sentAt: switchCommandEnvelope.sentAt },
    payload: switchRequest,
    envelope: switchCommandEnvelope,
    parse: parseDesktopMessage,
  },
  {
    factoryName: "createProjectSwitchResultEvent",
    schemaName: "CanonicalProjectSwitchResultSchema",
    metadata: {
      messageId: switchEventEnvelope.messageId,
      sentAt: switchEventEnvelope.sentAt,
      sequence: 2,
      causationId: switchCommandEnvelope.messageId,
    },
    payload: switchResult,
    envelope: switchEventEnvelope,
    parse: parseHarnessMessage,
  },
])(
  "public switch factory $factoryName",
  ({ factoryName, schemaName, metadata, payload, envelope, parse }) => {
    it("round-trips exported protocol v4 switch factories", () => {
      const factory: unknown = Reflect.get(protocol, factoryName);
      expect(typeof factory).toBe("function");
      if (typeof factory !== "function") throw new Error("Expected a public switch factory.");
      const schema: unknown = Reflect.get(protocol, schemaName);
      expect(Schema.isSchema(schema)).toBe(true);
      if (!isDecoder(schema)) throw new Error("Expected a public switch schema.");
      expect(decodeStrict(schema, payload)).toEqual(payload);
      const actual: unknown = factory(metadata, decodeStrict(schema, payload));
      expect(actual).toEqual(envelope);
      expect(parse(actual)).toEqual({ ok: true, value: envelope });
      expect(parse({ ...envelope, extra: true })).toEqual({
        ok: false,
        error: {
          code: "PROTOCOL_MESSAGE_INVALID",
          issues: [{ code: "unrecognized_keys", path: "$" }],
        },
      });
      expect(parse({ ...envelope, protocolVersion: 3 })).toEqual({
        ok: false,
        error: {
          code: "PROTOCOL_VERSION_UNSUPPORTED",
          issues: [{ code: "unsupported_value", path: "protocolVersion" }],
        },
      });
      expectTypeOf<CanonicalProjectSwitchRequest>().toEqualTypeOf<
        typeof protocol.CanonicalProjectSwitchRequestSchema.Type
      >();
      expectTypeOf<CanonicalProjectSwitchResult>().toEqualTypeOf<
        typeof protocol.CanonicalProjectSwitchResultSchema.Type
      >();
      expectTypeOf<
        Parameters<typeof protocol.createProjectSwitchCommand>[1]
      >().toEqualTypeOf<CanonicalProjectSwitchRequest>();
      expectTypeOf<
        Parameters<typeof protocol.createProjectSwitchResultEvent>[1]
      >().toEqualTypeOf<CanonicalProjectSwitchResult>();
    });
  },
);

it("round-trips exported protocol v4 switch factories", () => {
  expect(parseHarnessMessage(switchEventEnvelope)).toEqual({
    ok: true,
    value: switchEventEnvelope,
  });
});

describe("project.upgrade", () => {
  /** The design's result table (S3a design, "Protocol (version 6)"), copied by hand. */
  const designTable = [
    [
      "unsupported",
      "refused",
      "PROJECT_UPGRADE_UNSUPPORTED",
      "This Project needs a database change that cannot run automatically.",
      false,
    ],
    [
      "notEligible",
      "refused",
      "PROJECT_UPGRADE_NOT_ELIGIBLE",
      "This Project's storage cannot be upgraded in its current state.",
      false,
    ],
    [
      "backupInvalid",
      "failed",
      "PROJECT_UPGRADE_BACKUP_INVALID",
      "The pre-upgrade backup failed its integrity check.",
      true,
    ],
    [
      "verificationFailed",
      "failed",
      "PROJECT_UPGRADE_VERIFICATION_FAILED",
      "The upgraded copy did not match the original data.",
      true,
    ],
    [
      "alreadyActive",
      "rejected",
      "PROJECT_ALREADY_ACTIVE",
      "Close the active Project before upgrading.",
      false,
    ],
    [
      "storageUnavailable",
      "unavailable",
      "PROJECT_STORAGE_UNAVAILABLE",
      "Project Storage is unavailable.",
      true,
    ],
    [
      "coordinatorStopped",
      "unavailable",
      "PROJECT_COORDINATOR_UNAVAILABLE",
      "Canonical Project coordination is unavailable.",
      false,
    ],
    [
      "connectionLost",
      "unavailable",
      "PROJECT_COORDINATOR_UNAVAILABLE",
      "The Project connection is unavailable.",
      true,
    ],
    ["storageBroken", "broken", "PROJECT_STORAGE_BROKEN", "Project Storage upgrade failed.", false],
    [
      "harnessInternalFailure",
      "broken",
      "HARNESS_INTERNAL_FAILURE",
      "Harness failed while handling a message.",
      false,
    ],
    [
      "protocolMessageInvalid",
      "broken",
      "PROTOCOL_MESSAGE_INVALID",
      "Harness received an invalid protocol message.",
      false,
    ],
    [
      "protocolVersionUnsupported",
      "broken",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "Desktop and harness protocol versions are incompatible.",
      false,
    ],
    // Added in C1-0 S5 (deep review I3): the busy text that a retry can clear.
    [
      "storageBusy",
      "unavailable",
      "PROJECT_STORAGE_UNAVAILABLE",
      "Project Storage is busy; the upgrade can be retried.",
      true,
    ],
  ] as const;
  const designEntries = designTable.map(
    ([key, , code, message, retryable]) => [key, { code, message, retryable }] as const,
  );
  const designRows = designEntries.map(([, row]) => row);
  /** The design row at `index` of the table above. */
  function designRow(index: number) {
    const row = designRows[index];
    if (row === undefined) throw new Error("The design table has no such row.");
    return row;
  }
  const request = { projectId: "00000000-0000-4000-8000-000000000010" };
  const commandMetadata = {
    messageId: "00000000-0000-4000-8000-000000000101",
    sentAt: "2026-10-06T12:00:00.000Z",
  };
  const eventMetadata = {
    messageId: "00000000-0000-4000-8000-000000000102",
    sentAt: "2026-10-06T12:00:01.000Z",
    sequence: 1,
    causationId: commandMetadata.messageId,
  };
  const results = [
    {
      status: "upgraded",
      request,
      sourceGenerationId: "00000000-0000-4000-8000-000000000014",
      generationId: "00000000-0000-4000-8000-000000000024",
      upgradeId: "00000000-0000-4000-8000-0000000000a1",
    },
    { status: "not-required", request },
    { status: "not-registered", request },
    ...designTable.map(([, status, code, message, retryable]) => ({
      status,
      request,
      diagnostic: { code, message, retryable },
    })),
  ];

  function resultEvent(payload: unknown) {
    return {
      protocolVersion,
      messageType: "event",
      ...eventMetadata,
      event: "project.upgrade.result",
      payload,
    };
  }

  it("encodes and decodes the upgrade request and result strictly", () => {
    expect(Object.entries(protocol.projectUpgradeDiagnostics)).toEqual(designEntries);
    const command = protocol.createProjectUpgradeCommand(
      commandMetadata,
      decodeStrict(protocol.ProjectUpgradeRequestSchema, request),
    );
    expect(command).toEqual({
      protocolVersion: 7,
      messageType: "command",
      ...commandMetadata,
      command: "project.upgrade",
      payload: request,
    });
    expect(parseDesktopMessage(command)).toEqual({ ok: true, value: command });
    expect(results).toHaveLength(16);
    for (const result of results) {
      const event = protocol.createProjectUpgradeResultEvent(
        eventMetadata,
        decodeStrict(protocol.ProjectUpgradeResultSchema, result),
      );
      expect(event).toEqual(resultEvent(result));
      expect(parseHarnessMessage(event)).toEqual({ ok: true, value: event });
    }

    const invalid = [
      { status: "failed", request, diagnostic: { ...designRow(2), retryable: false } },
      { status: "refused", request, diagnostic: designRow(2) },
      { status: "broken", request, diagnostic: designRow(4) },
      { status: "unavailable", request, diagnostic: { ...designRow(7), retryable: false } },
      { status: "unavailable", request, diagnostic: { ...designRow(5), message: "x" } },
      { status: "broken", request, diagnostic: { ...designRow(9), message: "x" } },
      { status: "not-required", request, extra: true },
      { status: "not-required", request: { ...request, extra: true } },
      { status: "rejected", request, diagnostic: { ...designRow(4), extra: true } },
      { status: "upgraded", request, generationId: "00000000-0000-4000-8000-000000000024" },
    ];
    for (const result of invalid) {
      expect(parseHarnessMessage(resultEvent(result))).toMatchObject({
        ok: false,
        error: { code: "PROTOCOL_MESSAGE_INVALID" },
      });
    }
    expect(parseDesktopMessage({ ...command, payload: { ...request, extra: 1 } })).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_MESSAGE_INVALID" },
    });
    expect(protocolVersion).toBe(7);
    expect(parseDesktopMessage({ ...command, protocolVersion: 5 })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  });
});
