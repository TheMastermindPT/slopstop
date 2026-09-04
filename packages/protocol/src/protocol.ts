import { z } from "zod";
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

export const protocolVersion = 3 as const;

export const MessageIdSchema = z.uuid().brand<"MessageId">();
export type MessageId = z.infer<typeof MessageIdSchema>;

const TimestampSchema = z.iso.datetime({ offset: true });
const SequenceSchema = z.number().int().nonnegative();

const EnvelopeProbeSchema = z
  .object({
    protocolVersion: z.number().int(),
  })
  .passthrough();

const DesktopCommandMetadataSchema = {
  protocolVersion: z.literal(protocolVersion),
  messageType: z.literal("command"),
  messageId: MessageIdSchema,
  sentAt: TimestampSchema,
} as const;

const HandshakeCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("system.handshake"),
  payload: z.strictObject({
    desktopVersion: z.string().min(1),
  }),
});
const ProjectOpenCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.open"),
  payload: ProjectStorageOpenRequestSchema,
});
const ProjectCreateCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.create"),
  payload: ProjectStorageCreateRequestSchema,
});
const ProjectCloseCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.close"),
  payload: ProjectStorageCloseRequestSchema,
});
const WorkspaceQueryCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("workspace.query"),
  payload: WorkspaceQuerySchema,
});
const WorkspaceIntentCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("workspace.intent"),
  payload: WorkspaceIntentSchema,
});

const plainLocalFileUrlPattern = /^file:\/\/\/(?![\\/])(?:(?!%2f|%5c)[^?#\\])*$/i;
const invalidPercentEscapePattern = /%(?![\da-f]{2})/i;
const LocalFileUrlSchema = z
  .string()
  .superRefine((value, context) => {
    const hasUnsafeCharacter = [...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x20 || codePoint === 0x7f;
    });
    if (
      !plainLocalFileUrlPattern.test(value) ||
      invalidPercentEscapePattern.test(value) ||
      hasUnsafeCharacter
    ) {
      context.addIssue({
        code: "custom",
        message: "Harness bootstrap roots must be plain local file URLs.",
      });
    }
  })
  .pipe(z.url());

export const HarnessBootstrapSchema = z.strictObject({
  kind: z.literal("harness.connect"),
  applicationStorageRootUrl: LocalFileUrlSchema,
  migrationResourcesRootUrl: LocalFileUrlSchema,
});
export type HarnessBootstrap = z.infer<typeof HarnessBootstrapSchema>;

const HarnessEventMetadataSchema = {
  protocolVersion: z.literal(protocolVersion),
  messageType: z.literal("event"),
  messageId: MessageIdSchema,
  sentAt: TimestampSchema,
  sequence: SequenceSchema,
  causationId: MessageIdSchema.nullable(),
} as const;

const ReadyEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("system.ready"),
  payload: z.strictObject({
    harnessVersion: z.string().min(1),
  }),
});

export const HarnessFailureCodeSchema = z.enum([
  "PROTOCOL_MESSAGE_INVALID",
  "PROTOCOL_VERSION_UNSUPPORTED",
  "HARNESS_INTERNAL_FAILURE",
]);
export type HarnessFailureCode = z.infer<typeof HarnessFailureCodeSchema>;

const FailureEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("system.failure"),
  payload: z.strictObject({
    code: HarnessFailureCodeSchema,
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
});

const ProjectOpenResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.open.result"),
  payload: ProjectStorageOpenResultSchema,
});
const ProjectCreateResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.create.result"),
  payload: ProjectStorageCreateResultSchema,
});
const ProjectCloseResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.close.result"),
  payload: ProjectStorageCloseResultSchema,
});

const WorkspaceQueryResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("workspace.query.result"),
  payload: WorkspaceQueryResultSchema,
});
const WorkspaceIntentResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("workspace.intent.result"),
  payload: WorkspaceIntentResultSchema,
});
const WorkspaceProjectionInvalidatedEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("workspace.projection.invalidated"),
  payload: WorkspaceNotificationSchema,
});

export const DesktopMessageSchema = z.discriminatedUnion("command", [
  HandshakeCommandSchema,
  ProjectOpenCommandSchema,
  ProjectCreateCommandSchema,
  ProjectCloseCommandSchema,
  WorkspaceQueryCommandSchema,
  WorkspaceIntentCommandSchema,
]);
export type DesktopMessage = z.infer<typeof DesktopMessageSchema>;

export const HarnessMessageSchema = z.discriminatedUnion("event", [
  ReadyEventSchema,
  FailureEventSchema,
  ProjectOpenResultEventSchema,
  ProjectCreateResultEventSchema,
  ProjectCloseResultEventSchema,
  WorkspaceQueryResultEventSchema,
  WorkspaceIntentResultEventSchema,
  WorkspaceProjectionInvalidatedEventSchema,
]);
export type HarnessMessage = z.infer<typeof HarnessMessageSchema>;

export const HarnessDiagnosticCodeSchema = z.enum([
  "HARNESS_HANDSHAKE_TIMEOUT",
  "HARNESS_SHUTDOWN_TIMEOUT",
  "HARNESS_PROCESS_EXITED",
  "HARNESS_PROTOCOL_ERROR",
  "HARNESS_START_FAILED",
  "DESKTOP_BRIDGE_FAILED",
]);

const HarnessDiagnosticSchema = z.strictObject({
  code: HarnessDiagnosticCodeSchema,
  message: z.string().min(1),
});

export const HarnessStatusSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("starting"),
    attempt: SequenceSchema,
  }),
  z.strictObject({
    state: z.literal("ready"),
    attempt: SequenceSchema,
    harnessVersion: z.string().min(1),
  }),
  z.strictObject({
    state: z.literal("degraded"),
    attempt: SequenceSchema,
    diagnostic: HarnessDiagnosticSchema,
  }),
  z.strictObject({
    state: z.literal("crashed"),
    attempt: SequenceSchema,
    canRetry: z.literal(true),
    diagnostic: HarnessDiagnosticSchema,
  }),
  z.strictObject({
    state: z.literal("stopped"),
  }),
]);
export type HarnessStatus = z.infer<typeof HarnessStatusSchema>;

export const RetryHarnessResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({
      code: z.literal("HARNESS_RETRY_UNAVAILABLE"),
      message: z.string().min(1),
    }),
  }),
]);
export type RetryHarnessResult = z.infer<typeof RetryHarnessResultSchema>;

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

function normalizeIssues(error: z.ZodError): ProtocolParseIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".") || "$";
    return {
      code:
        issue.code === "invalid_union" && (path === "command" || path === "event")
          ? "invalid_value"
          : issue.code,
      path,
    };
  });
}

function hasUnsupportedVersion(value: unknown): boolean {
  const probe = EnvelopeProbeSchema.safeParse(value);
  return probe.success && probe.data.protocolVersion !== protocolVersion;
}

function parseMessage<T>(schema: z.ZodType<T>, value: unknown): ProtocolParseResult<T> {
  if (hasUnsupportedVersion(value)) {
    return {
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    };
  }

  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return {
    ok: false,
    error: {
      code: "PROTOCOL_MESSAGE_INVALID",
      issues: normalizeIssues(parsed.error),
    },
  };
}

export function parseDesktopMessage(value: unknown): ProtocolParseResult<DesktopMessage> {
  return parseMessage(DesktopMessageSchema, value);
}

export function parseHarnessMessage(value: unknown): ProtocolParseResult<HarnessMessage> {
  return parseMessage(HarnessMessageSchema, value);
}

function createCommand(
  metadata: CommandMetadata,
  command: DesktopMessage["command"],
  payload: unknown,
): DesktopMessage {
  return DesktopMessageSchema.parse({
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
  return HarnessMessageSchema.parse({
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

  const parsed = MessageIdSchema.safeParse(value.messageId);
  return parsed.success ? parsed.data : null;
}

export function createReadyEvent(metadata: EventMetadata, harnessVersion: string): HarnessMessage {
  return createEvent(metadata, "system.ready", { harnessVersion });
}

export function createFailureEvent(
  metadata: EventMetadata,
  failure: Readonly<{
    code: HarnessFailureCode;
    message: string;
    retryable: boolean;
  }>,
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
