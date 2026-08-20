import {
  createFailureEvent,
  createReadyEvent,
  type HarnessFailureCode,
  parseDesktopMessage,
  readMessageId,
} from "@slopstop/protocol";

export interface HarnessTransport {
  send(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export type StopHarnessRuntime = () => void;

type HarnessRuntimeOptions = Readonly<{
  transport: HarnessTransport;
  harnessVersion: string;
  createId: () => string;
  now: () => string;
}>;

const failureMessages: Readonly<
  Record<
    Extract<HarnessFailureCode, "PROTOCOL_MESSAGE_INVALID" | "PROTOCOL_VERSION_UNSUPPORTED">,
    string
  >
> = {
  PROTOCOL_MESSAGE_INVALID: "Harness received an invalid protocol message.",
  PROTOCOL_VERSION_UNSUPPORTED: "Desktop and harness protocol versions are incompatible.",
};

export function startHarnessRuntime(options: HarnessRuntimeOptions): StopHarnessRuntime {
  let sequence = 0;

  return options.transport.subscribe((message) => {
    sequence += 1;
    const parsed = parseDesktopMessage(message);
    const metadata = {
      messageId: options.createId(),
      sentAt: options.now(),
      sequence,
      causationId: readMessageId(message),
    };

    if (!parsed.ok) {
      options.transport.send(
        createFailureEvent(metadata, {
          code: parsed.error.code,
          message: failureMessages[parsed.error.code],
          retryable: false,
        }),
      );
      return;
    }

    options.transport.send(createReadyEvent(metadata, options.harnessVersion));
  });
}
