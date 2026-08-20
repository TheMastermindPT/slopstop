import { z } from "zod";

export const protocolVersion = 1 as const;

export const MessageIdSchema = z.uuid().brand<"MessageId">();
export type MessageId = z.infer<typeof MessageIdSchema>;

const TimestampSchema = z.iso.datetime({ offset: true });
const SequenceSchema = z.number().int().nonnegative();

const EnvelopeProbeSchema = z
  .object({
    protocolVersion: z.number().int(),
  })
  .passthrough();

const DesktopEnvelopeSchema = z.strictObject({
  protocolVersion: z.literal(protocolVersion),
  messageType: z.literal("command"),
  messageId: MessageIdSchema,
  sentAt: TimestampSchema,
  command: z.literal("system.handshake"),
  payload: z.strictObject({
    desktopVersion: z.string().min(1),
  }),
});

export const HarnessBootstrapSchema = z.strictObject({
  kind: z.literal("harness.connect"),
});

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

export const DesktopMessageSchema = DesktopEnvelopeSchema;
export type DesktopMessage = z.infer<typeof DesktopMessageSchema>;

export const HarnessMessageSchema = z.discriminatedUnion("event", [
  ReadyEventSchema,
  FailureEventSchema,
]);
export type HarnessMessage = z.infer<typeof HarnessMessageSchema>;

export const HarnessDiagnosticCodeSchema = z.enum([
  "HARNESS_HANDSHAKE_TIMEOUT",
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
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map(String).join(".") || "$",
  }));
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

export function createHandshakeCommand(
  metadata: CommandMetadata,
  desktopVersion: string,
): DesktopMessage {
  return DesktopMessageSchema.parse({
    protocolVersion,
    messageType: "command",
    ...metadata,
    command: "system.handshake",
    payload: { desktopVersion },
  });
}

export function readMessageId(value: unknown): MessageId | null {
  if (typeof value !== "object" || value === null || !("messageId" in value)) {
    return null;
  }

  const parsed = MessageIdSchema.safeParse(value.messageId);
  return parsed.success ? parsed.data : null;
}

export function createReadyEvent(metadata: EventMetadata, harnessVersion: string): HarnessMessage {
  return HarnessMessageSchema.parse({
    protocolVersion,
    messageType: "event",
    ...metadata,
    event: "system.ready",
    payload: { harnessVersion },
  });
}

export function createFailureEvent(
  metadata: EventMetadata,
  failure: Readonly<{
    code: HarnessFailureCode;
    message: string;
    retryable: boolean;
  }>,
): HarnessMessage {
  return HarnessMessageSchema.parse({
    protocolVersion,
    messageType: "event",
    ...metadata,
    event: "system.failure",
    payload: failure,
  });
}
