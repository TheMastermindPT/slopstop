import {
  createFailureEvent,
  createReadyEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type HarnessFailureCode,
  parseDesktopMessage,
  readMessageId,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import type { WorkspaceApplication } from "./workspace-application.js";

export interface HarnessTransport {
  send(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export type StopHarnessRuntime = () => void;

type HarnessRuntimeOptions = Readonly<{
  transport: HarnessTransport;
  workspaceApplication: WorkspaceApplication;
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

  const nextMetadata = (causationId: string | null) => {
    sequence += 1;
    return {
      messageId: options.createId(),
      sentAt: options.now(),
      sequence,
      causationId,
    };
  };

  const sendInternalFailure = (causationId: string | null) => {
    options.transport.send(
      createFailureEvent(nextMetadata(causationId), {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a workspace message.",
        retryable: false,
      }),
    );
  };

  const handleMessage = async (message: unknown): Promise<void> => {
    const parsed = parseDesktopMessage(message);
    const causationId = readMessageId(message);

    if (!parsed.ok) {
      options.transport.send(
        createFailureEvent(nextMetadata(causationId), {
          code: parsed.error.code,
          message: failureMessages[parsed.error.code],
          retryable: false,
        }),
      );
      return;
    }

    switch (parsed.value.command) {
      case "system.handshake":
        options.transport.send(createReadyEvent(nextMetadata(causationId), options.harnessVersion));
        return;
      case "workspace.query": {
        const result = await options.workspaceApplication.query(parsed.value.payload);
        options.transport.send(createWorkspaceQueryResultEvent(nextMetadata(causationId), result));
        return;
      }
      case "workspace.intent": {
        const result = await options.workspaceApplication.submit(parsed.value.payload);
        options.transport.send(createWorkspaceIntentResultEvent(nextMetadata(causationId), result));
      }
    }
  };

  const stopMessages = options.transport.subscribe((message) => {
    void handleMessage(message).catch(() => {
      sendInternalFailure(readMessageId(message));
    });
  });
  const stopNotifications = options.workspaceApplication.subscribe((notification) => {
    try {
      const validated = WorkspaceNotificationSchema.parse(notification);
      options.transport.send(
        createWorkspaceProjectionInvalidatedEvent(nextMetadata(null), validated),
      );
    } catch {
      sendInternalFailure(null);
    }
  });

  return () => {
    stopMessages();
    stopNotifications();
  };
}
