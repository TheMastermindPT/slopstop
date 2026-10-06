import { Result, Schema } from "effect";
import {
  type CanonicalProjectActivationRequest,
  CanonicalProjectActivationRequestSchema,
  type CanonicalProjectActivationResult,
  CanonicalProjectActivationResultSchema,
  type CanonicalProjectCommandRequest,
  CanonicalProjectCommandRequestSchema,
  type CanonicalProjectCommandResult,
  CanonicalProjectCommandResultSchema,
  type CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchRequestSchema,
  type CanonicalProjectSwitchResult,
  CanonicalProjectSwitchResultSchema,
} from "./canonical-project-protocol.js";
import {
  type HarnessFailureCode,
  HarnessFailureCodeSchema,
  harnessFailureMessages,
} from "./harness-failure-protocol.js";
import {
  ProjectListRequestSchema,
  type ProjectListResult,
  ProjectListResultSchema,
} from "./project-list-protocol.js";
import {
  type ProjectRegistrationRequest,
  ProjectRegistrationRequestSchema,
  type ProjectRegistrationResult,
  ProjectRegistrationResultSchema,
} from "./project-registration-flow-protocol.js";
import type {
  ProjectStorageCloseRequest,
  ProjectStorageCloseResult,
  ProjectStorageCreateRequest,
  ProjectStorageCreateResult,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "./project-storage-protocol.js";
import {
  ProjectStorageCloseRequestSchema,
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenRequestSchema,
  ProjectStorageOpenResultSchema,
} from "./project-storage-protocol.js";
import {
  type ProjectUpgradeRequest,
  ProjectUpgradeRequestSchema,
  type ProjectUpgradeResult,
  ProjectUpgradeResultSchema,
} from "./project-upgrade-protocol.js";
import {
  dateTimeTextSchema,
  decodeStrict,
  decodeStrictResult,
  NonEmptyTextSchema,
  summarizeSchemaError,
  UuidTextSchema,
} from "./schema-codec.js";
import type {
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "./workspace-protocol.js";
import {
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "./workspace-protocol.js";

export const protocolVersion = 6 as const;

export const MessageIdSchema = UuidTextSchema.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageIdSchema.Type;

const TimestampSchema = dateTimeTextSchema({ offset: true });
const SequenceSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

// Reads only the version; every other key is intentionally ignored by this probe.
const EnvelopeProbeSchema = Schema.Struct({ protocolVersion: Schema.Number.check(Schema.isInt()) });

const DesktopCommandMetadataSchema = {
  protocolVersion: Schema.Literal(protocolVersion),
  messageType: Schema.Literal("command"),
  messageId: MessageIdSchema,
  sentAt: TimestampSchema,
} as const;

const HandshakeCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("system.handshake"),
  payload: Schema.Struct({ desktopVersion: NonEmptyTextSchema }),
});
const ProjectOpenCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("project.open"),
  payload: ProjectStorageOpenRequestSchema,
});
const ProjectCreateCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("project.create"),
  payload: ProjectStorageCreateRequestSchema,
});
const ProjectCloseCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("project.close"),
  payload: ProjectStorageCloseRequestSchema,
});
const WorkspaceQueryCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("workspace.query"),
  payload: WorkspaceQuerySchema,
});
const ProjectRegistrationCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("project.registration"),
  payload: ProjectRegistrationRequestSchema,
});
const WorkspaceIntentCommandSchema = Schema.Struct({
  ...DesktopCommandMetadataSchema,
  command: Schema.Literal("workspace.intent"),
  payload: WorkspaceIntentSchema,
});

const plainLocalFileUrlPattern = /^file:\/\/\/(?![\\/])(?:(?!%2f|%5c)[^?#\\])*$/i;
const invalidPercentEscapePattern = /%(?![\da-f]{2})/i;
// Protocol code runs in Node and the renderer; both provide WHATWG URL, but this package
// targets plain ES2022, so the global is read defensively and fails closed.
const whatwgUrl: unknown = Reflect.get(globalThis, "URL");
function canParseUrl(value: string): boolean {
  if (typeof whatwgUrl !== "function" || !("canParse" in whatwgUrl)) return false;
  const canParse: unknown = whatwgUrl.canParse;
  return typeof canParse === "function" && Reflect.apply(canParse, whatwgUrl, [value]) === true;
}
function isPlainLocalFileUrl(value: string): boolean {
  const hasUnsafeCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || codePoint === 0x7f;
  });
  return (
    plainLocalFileUrlPattern.test(value) &&
    !invalidPercentEscapePattern.test(value) &&
    !hasUnsafeCharacter &&
    canParseUrl(value)
  );
}
const LocalFileUrlSchema = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      isPlainLocalFileUrl(value) || "Harness bootstrap roots must be plain local file URLs.",
  ),
);

export const HarnessBootstrapSchema = Schema.Struct({
  kind: Schema.Literal("harness.connect"),
  applicationStorageRootUrl: LocalFileUrlSchema,
  migrationResourcesRootUrl: LocalFileUrlSchema,
});
export type HarnessBootstrap = typeof HarnessBootstrapSchema.Type;

const HarnessEventMetadataSchema = {
  protocolVersion: Schema.Literal(protocolVersion),
  messageType: Schema.Literal("event"),
  messageId: MessageIdSchema,
  sentAt: TimestampSchema,
  sequence: SequenceSchema,
  causationId: Schema.NullOr(MessageIdSchema),
} as const;

const ReadyEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("system.ready"),
  payload: Schema.Struct({ harnessVersion: NonEmptyTextSchema }),
});

export { type HarnessFailureCode, HarnessFailureCodeSchema, harnessFailureMessages };

const HarnessFailurePayloadSchema = Schema.Struct({
  code: HarnessFailureCodeSchema,
  message: NonEmptyTextSchema,
  retryable: Schema.Boolean,
});
type HarnessFailure = typeof HarnessFailurePayloadSchema.Type;

const RequestFailureEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  causationId: MessageIdSchema,
  event: Schema.Literal("request.failure"),
  payload: HarnessFailurePayloadSchema,
});

const SystemFailureEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  causationId: Schema.Null,
  event: Schema.Literal("system.failure"),
  payload: HarnessFailurePayloadSchema,
});

const ProjectOpenResultEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("project.open.result"),
  payload: ProjectStorageOpenResultSchema,
});
const ProjectCreateResultEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("project.create.result"),
  payload: ProjectStorageCreateResultSchema,
});
const ProjectCloseResultEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("project.close.result"),
  payload: ProjectStorageCloseResultSchema,
});

const WorkspaceQueryResultEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("workspace.query.result"),
  payload: WorkspaceQueryResultSchema,
});
const WorkspaceIntentResultEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("workspace.intent.result"),
  payload: WorkspaceIntentResultSchema,
});
const ProjectRegistrationResultEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("project.registration.result"),
  payload: ProjectRegistrationResultSchema,
});
const WorkspaceProjectionInvalidatedEventSchema = Schema.Struct({
  ...HarnessEventMetadataSchema,
  event: Schema.Literal("workspace.projection.invalidated"),
  payload: WorkspaceNotificationSchema,
});

export const DesktopMessageSchema = Schema.Union([
  Schema.Struct({
    ...DesktopCommandMetadataSchema,
    command: Schema.Literal("project.list"),
    payload: ProjectListRequestSchema,
  }),
  Schema.Struct({
    ...DesktopCommandMetadataSchema,
    command: Schema.Literal("project.switch"),
    payload: CanonicalProjectSwitchRequestSchema,
  }),
  Schema.Struct({
    ...DesktopCommandMetadataSchema,
    command: Schema.Literal("project.activate"),
    payload: CanonicalProjectActivationRequestSchema,
  }),
  Schema.Struct({
    ...DesktopCommandMetadataSchema,
    command: Schema.Literal("project.command"),
    payload: CanonicalProjectCommandRequestSchema,
  }),
  Schema.Struct({
    ...DesktopCommandMetadataSchema,
    command: Schema.Literal("project.upgrade"),
    payload: ProjectUpgradeRequestSchema,
  }),
  HandshakeCommandSchema,
  ProjectOpenCommandSchema,
  ProjectCreateCommandSchema,
  ProjectCloseCommandSchema,
  WorkspaceQueryCommandSchema,
  WorkspaceIntentCommandSchema,
  ProjectRegistrationCommandSchema,
]);
export type DesktopMessage = typeof DesktopMessageSchema.Type;

export const HarnessMessageSchema = Schema.Union([
  Schema.Struct({
    ...HarnessEventMetadataSchema,
    event: Schema.Literal("project.list.result"),
    payload: ProjectListResultSchema,
  }),
  Schema.Struct({
    ...HarnessEventMetadataSchema,
    event: Schema.Literal("project.switch.result"),
    payload: CanonicalProjectSwitchResultSchema,
  }),
  Schema.Struct({
    ...HarnessEventMetadataSchema,
    event: Schema.Literal("project.activate.result"),
    payload: CanonicalProjectActivationResultSchema,
  }),
  Schema.Struct({
    ...HarnessEventMetadataSchema,
    event: Schema.Literal("project.command.result"),
    payload: CanonicalProjectCommandResultSchema,
  }),
  Schema.Struct({
    ...HarnessEventMetadataSchema,
    event: Schema.Literal("project.upgrade.result"),
    payload: ProjectUpgradeResultSchema,
  }),
  ReadyEventSchema,
  RequestFailureEventSchema,
  SystemFailureEventSchema,
  ProjectOpenResultEventSchema,
  ProjectCreateResultEventSchema,
  ProjectCloseResultEventSchema,
  WorkspaceQueryResultEventSchema,
  WorkspaceIntentResultEventSchema,
  WorkspaceProjectionInvalidatedEventSchema,
  ProjectRegistrationResultEventSchema,
]);
export type HarnessMessage = typeof HarnessMessageSchema.Type;

export const HarnessDiagnosticCodeSchema = Schema.Literals([
  "HARNESS_HANDSHAKE_TIMEOUT",
  "HARNESS_SHUTDOWN_TIMEOUT",
  "HARNESS_PROCESS_EXITED",
  "HARNESS_PROTOCOL_ERROR",
  "HARNESS_START_FAILED",
  "DESKTOP_BRIDGE_FAILED",
]);

const HarnessDiagnosticSchema = Schema.Struct({
  code: HarnessDiagnosticCodeSchema,
  message: NonEmptyTextSchema,
});

export const HarnessStatusSchema = Schema.Union([
  Schema.Struct({
    state: Schema.Literal("starting"),
    attempt: SequenceSchema,
  }),
  Schema.Struct({
    state: Schema.Literal("ready"),
    attempt: SequenceSchema,
    harnessVersion: NonEmptyTextSchema,
  }),
  Schema.Struct({
    state: Schema.Literal("degraded"),
    attempt: SequenceSchema,
    diagnostic: HarnessDiagnosticSchema,
  }),
  Schema.Struct({
    state: Schema.Literal("crashed"),
    attempt: SequenceSchema,
    canRetry: Schema.Literal(true),
    diagnostic: HarnessDiagnosticSchema,
  }),
  Schema.Struct({
    state: Schema.Literal("stopped"),
  }),
]);
export type HarnessStatus = typeof HarnessStatusSchema.Type;

export const RetryHarnessResultSchema = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true) }),
  Schema.Struct({
    ok: Schema.Literal(false),
    error: Schema.Struct({
      code: Schema.Literal("HARNESS_RETRY_UNAVAILABLE"),
      message: NonEmptyTextSchema,
    }),
  }),
]);
export type RetryHarnessResult = typeof RetryHarnessResultSchema.Type;

type ProtocolParseIssue = Readonly<{
  code: string;
  path: string;
}>;

type ProtocolParseError = Readonly<{
  code: "PROTOCOL_MESSAGE_INVALID" | "PROTOCOL_VERSION_UNSUPPORTED";
  issues: readonly ProtocolParseIssue[];
}>;

export type ProtocolParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: ProtocolParseError }>;

type EventMetadata = Readonly<{
  messageId: string;
  sentAt: string;
  sequence: number;
  causationId: string | null;
}>;

type CommandMetadata = Readonly<{
  messageId: string;
  sentAt: string;
}>;

type Discriminator = "command" | "event";

function normalizeIssues(
  error: Schema.SchemaError,
  discriminator: Discriminator,
  value: unknown,
): ProtocolParseIssue[] {
  return summarizeSchemaError(error).map((issue) => {
    if (issue.code === "invalid_union" && issue.path.length === 0) {
      // A non-object envelope is a type failure; an unmatched one names no known message.
      if (!isObjectRecord(value)) return { code: "invalid_type", path: "$" };
      if (discriminator in value) return { code: "invalid_value", path: discriminator };
    }
    return { code: issue.code, path: issue.path.map(String).join(".") || "$" };
  });
}

function isObjectRecord(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnsupportedVersion(value: unknown): boolean {
  const probe = Schema.decodeUnknownResult(EnvelopeProbeSchema)(value);
  return Result.isSuccess(probe) && probe.success.protocolVersion !== protocolVersion;
}

function parseMessage<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  discriminator: Discriminator,
  value: unknown,
): ProtocolParseResult<S["Type"]> {
  if (hasUnsupportedVersion(value)) {
    return {
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    };
  }

  const parsed = decodeStrictResult(schema, value);
  if (Result.isSuccess(parsed)) {
    return { ok: true, value: parsed.success };
  }

  return {
    ok: false,
    error: {
      code: "PROTOCOL_MESSAGE_INVALID",
      issues: normalizeIssues(parsed.failure, discriminator, value),
    },
  };
}

export function parseDesktopMessage(value: unknown): ProtocolParseResult<DesktopMessage> {
  return parseMessage(DesktopMessageSchema, "command", value);
}

export function parseHarnessMessage(value: unknown): ProtocolParseResult<HarnessMessage> {
  return parseMessage(HarnessMessageSchema, "event", value);
}

function createCommand(
  metadata: CommandMetadata,
  command: DesktopMessage["command"],
  payload: unknown,
): DesktopMessage {
  return decodeStrict(DesktopMessageSchema, {
    protocolVersion,
    messageType: "command",
    ...metadata,
    command,
    payload,
  });
}

function createEvent(
  metadata: EventMetadata,
  event: HarnessMessage["event"],
  payload: unknown,
): HarnessMessage {
  return decodeStrict(HarnessMessageSchema, {
    protocolVersion,
    messageType: "event",
    ...metadata,
    event,
    payload,
  });
}

export function createHandshakeCommand(
  metadata: CommandMetadata,
  desktopVersion: string,
): DesktopMessage {
  return createCommand(metadata, "system.handshake", { desktopVersion });
}

export function createProjectActivateCommand(
  metadata: CommandMetadata,
  request: CanonicalProjectActivationRequest,
): DesktopMessage {
  return createCommand(metadata, "project.activate", request);
}
export function createProjectCommand(
  metadata: CommandMetadata,
  request: CanonicalProjectCommandRequest,
): DesktopMessage {
  return createCommand(metadata, "project.command", request);
}
export function createProjectActivateResultEvent(
  metadata: EventMetadata,
  result: CanonicalProjectActivationResult,
): HarnessMessage {
  return createEvent(metadata, "project.activate.result", result);
}
export function createProjectCommandResultEvent(
  metadata: EventMetadata,
  result: CanonicalProjectCommandResult,
): HarnessMessage {
  return createEvent(metadata, "project.command.result", result);
}

export function createProjectUpgradeCommand(
  metadata: CommandMetadata,
  request: ProjectUpgradeRequest,
): DesktopMessage {
  return createCommand(metadata, "project.upgrade", request);
}

export function createProjectUpgradeResultEvent(
  metadata: EventMetadata,
  result: ProjectUpgradeResult,
): HarnessMessage {
  return createEvent(metadata, "project.upgrade.result", result);
}

export function createProjectSwitchCommand(
  metadata: CommandMetadata,
  request: CanonicalProjectSwitchRequest,
): DesktopMessage {
  return createCommand(metadata, "project.switch", request);
}

export function createProjectSwitchResultEvent(
  metadata: EventMetadata,
  result: CanonicalProjectSwitchResult,
): HarnessMessage {
  return createEvent(metadata, "project.switch.result", result);
}

export function createProjectOpenCommand(
  metadata: CommandMetadata,
  request: ProjectStorageOpenRequest,
): DesktopMessage {
  return createCommand(metadata, "project.open", request);
}

export function createProjectCreateCommand(
  metadata: CommandMetadata,
  request: ProjectStorageCreateRequest,
): DesktopMessage {
  return createCommand(metadata, "project.create", request);
}

export function createProjectCloseCommand(
  metadata: CommandMetadata,
  request: ProjectStorageCloseRequest,
): DesktopMessage {
  return createCommand(metadata, "project.close", request);
}

export function createWorkspaceQueryCommand(
  metadata: CommandMetadata,
  query: WorkspaceQuery,
): DesktopMessage {
  return createCommand(metadata, "workspace.query", query);
}

export function createWorkspaceIntentCommand(
  metadata: CommandMetadata,
  intent: WorkspaceIntent,
): DesktopMessage {
  return createCommand(metadata, "workspace.intent", intent);
}

export function createProjectRegistrationCommand(
  metadata: CommandMetadata,
  request: ProjectRegistrationRequest,
): DesktopMessage {
  return createCommand(metadata, "project.registration", request);
}

export function createProjectRegistrationResultEvent(
  metadata: EventMetadata,
  result: ProjectRegistrationResult,
): HarnessMessage {
  return createEvent(metadata, "project.registration.result", result);
}

export function readMessageId(value: unknown): MessageId | null {
  if (typeof value !== "object") {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (!("messageId" in value)) {
    return null;
  }

  const parsed = decodeStrictResult(MessageIdSchema, value.messageId);
  return Result.isSuccess(parsed) ? parsed.success : null;
}

export function createReadyEvent(metadata: EventMetadata, harnessVersion: string): HarnessMessage {
  return createEvent(metadata, "system.ready", { harnessVersion });
}

export function createRequestFailureEvent(
  metadata: Omit<EventMetadata, "causationId"> & Readonly<{ causationId: MessageId }>,
  failure: HarnessFailure,
): HarnessMessage {
  return createEvent(metadata, "request.failure", failure);
}

export function createSystemFailureEvent(
  metadata: Omit<EventMetadata, "causationId"> & Readonly<{ causationId: null }>,
  failure: HarnessFailure,
): HarnessMessage {
  return createEvent(metadata, "system.failure", failure);
}

export function createProjectOpenResultEvent(
  metadata: EventMetadata,
  result: ProjectStorageOpenResult,
): HarnessMessage {
  return createEvent(metadata, "project.open.result", result);
}

export function createProjectCreateResultEvent(
  metadata: EventMetadata,
  result: ProjectStorageCreateResult,
): HarnessMessage {
  return createEvent(metadata, "project.create.result", result);
}

export function createProjectCloseResultEvent(
  metadata: EventMetadata,
  result: ProjectStorageCloseResult,
): HarnessMessage {
  return createEvent(metadata, "project.close.result", result);
}

export function createWorkspaceQueryResultEvent(
  metadata: EventMetadata,
  result: WorkspaceQueryResult,
): HarnessMessage {
  return createEvent(metadata, "workspace.query.result", result);
}

export function createWorkspaceIntentResultEvent(
  metadata: EventMetadata,
  result: WorkspaceIntentResult,
): HarnessMessage {
  return createEvent(metadata, "workspace.intent.result", result);
}

export function createWorkspaceProjectionInvalidatedEvent(
  metadata: EventMetadata,
  notification: WorkspaceNotification,
): HarnessMessage {
  return createEvent(metadata, "workspace.projection.invalidated", notification);
}

export function createProjectListCommand(metadata: CommandMetadata): DesktopMessage {
  return createCommand(metadata, "project.list", {});
}
export function createProjectListResultEvent(
  metadata: EventMetadata,
  result: ProjectListResult,
): HarnessMessage {
  return createEvent(metadata, "project.list.result", result);
}
