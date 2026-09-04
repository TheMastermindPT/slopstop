import {
  createFailureEvent,
  createProjectCloseResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
  createReadyEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type HarnessFailureCode,
  parseDesktopMessage,
  readMessageId,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import type { ProjectStorageApplication } from "./project-storage-application.js";
import type { WorkspaceApplication } from "./workspace-application.js";

export interface HarnessTransport {
  send(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export type StopHarnessRuntime = () => Promise<void>;

type HarnessRuntimeOptions = Readonly<{
  transport: HarnessTransport;
  projectStorageApplication: ProjectStorageApplication;
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

function runtimeShutdownFailure(failures: readonly unknown[]): unknown {
  return failures.length === 1
    ? failures[0]
    : new AggregateError(failures, "Harness runtime shutdown failed.");
}

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
        message: "Harness failed while handling a message.",
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
      case "project.open": {
        const result = await options.projectStorageApplication.open(parsed.value.payload);
        options.transport.send(createProjectOpenResultEvent(nextMetadata(causationId), result));
        return;
      }
      case "project.create": {
        const result = await options.projectStorageApplication.create(parsed.value.payload);
        options.transport.send(createProjectCreateResultEvent(nextMetadata(causationId), result));
        return;
      }
      case "project.close": {
        const result = await options.projectStorageApplication.close(parsed.value.payload);
        options.transport.send(createProjectCloseResultEvent(nextMetadata(causationId), result));
        return;
      }
      case "workspace.query": {
        const result = await options.workspaceApplication.query(parsed.value.payload);
        options.transport.send(createWorkspaceQueryResultEvent(nextMetadata(causationId), result));
        return;
      }
      case "workspace.intent": {
        const result = await options.workspaceApplication.submit(parsed.value.payload);
        options.transport.send(createWorkspaceIntentResultEvent(nextMetadata(causationId), result));
        return;
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

  let stopPromise: Promise<void> | undefined;
  return () => {
    if (stopPromise !== undefined) {
      return stopPromise;
    }
    const failures: unknown[] = [];
    const settlement = {
      resolve: (): void => undefined,
      reject: (_reason: unknown): void => undefined,
    };
    stopPromise = new Promise<void>((resolve, reject) => {
      settlement.resolve = resolve;
      settlement.reject = reject;
    });
    try {
      stopMessages();
    } catch (error) {
      failures.push(error);
    }
    try {
      stopNotifications();
    } catch (error) {
      failures.push(error);
    }
    let storageStop: Promise<void> | undefined;
    try {
      storageStop = options.projectStorageApplication.stop();
    } catch (error) {
      failures.push(error);
    }
    void Promise.resolve(storageStop).then(
      () => {
        if (failures.length === 0) {
          settlement.resolve();
          return;
        }
        settlement.reject(runtimeShutdownFailure(failures));
      },
      (error: unknown) => {
        failures.push(error);
        settlement.reject(runtimeShutdownFailure(failures));
      },
    );
    return stopPromise;
  };
}
