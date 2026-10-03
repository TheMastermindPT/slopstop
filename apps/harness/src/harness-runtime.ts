import {
  createProjectActivateResultEvent,
  createProjectCloseResultEvent,
  createProjectCommandResultEvent,
  createProjectCreateResultEvent,
  createProjectListResultEvent,
  createProjectOpenResultEvent,
  createProjectSwitchResultEvent,
  createReadyEvent,
  createRequestFailureEvent,
  createSystemFailureEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type DesktopMessage,
  decodeStrict,
  type HarnessFailureCode,
  type MessageId,
  type ProjectListResult,
  parseDesktopMessage,
  readMessageId,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import type { CanonicalProjectApplication } from "./canonical-project-application.js";
import type { ProjectStorageApplication } from "./project-storage-application.js";
import type { WorkspaceApplication } from "./workspace-application.js";

export interface HarnessTransport {
  send(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export type StopHarnessRuntime = () => Promise<void>;

type HarnessRuntimeOptions = Readonly<{
  projectListing?: Readonly<{ list(): Promise<ProjectListResult>; stop(): Promise<void> }>;
  transport: HarnessTransport;
  canonicalProjectApplication: CanonicalProjectApplication;
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

function attemptStop(stop: () => Promise<void> | undefined): Promise<unknown[]> {
  try {
    return Promise.resolve(stop()).then(
      () => [],
      (error: unknown) => [error],
    );
  } catch (error) {
    return Promise.resolve([error]);
  }
}

type CanonicalProjectMessage = Extract<
  DesktopMessage,
  { command: "project.activate" | "project.switch" | "project.command" }
>;
type ProjectStorageMessage = Extract<
  DesktopMessage,
  { command: "project.open" | "project.create" | "project.close" }
>;
function isCanonicalProjectMessage(message: DesktopMessage): message is CanonicalProjectMessage {
  return (
    message.command === "project.activate" ||
    message.command === "project.switch" ||
    message.command === "project.command"
  );
}
function isProjectStorageMessage(message: DesktopMessage): message is ProjectStorageMessage {
  return ["project.open", "project.create", "project.close"].includes(message.command);
}

export function startHarnessRuntime(options: HarnessRuntimeOptions): StopHarnessRuntime {
  let sequence = 0;

  const nextMetadata = <CausationId extends MessageId | null>(causationId: CausationId) => {
    sequence += 1;
    return {
      messageId: options.createId(),
      sentAt: options.now(),
      sequence,
      causationId,
    };
  };

  const sendFailure = (
    causationId: MessageId | null,
    failure: Readonly<{ code: HarnessFailureCode; message: string; retryable: boolean }>,
  ): void => {
    options.transport.send(
      causationId === null
        ? createSystemFailureEvent(nextMetadata(null), failure)
        : createRequestFailureEvent(nextMetadata(causationId), failure),
    );
  };

  const sendInternalFailure = (causationId: MessageId | null): void => {
    sendFailure(causationId, {
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    });
  };

  const handleCanonicalProjectMessage = async (message: CanonicalProjectMessage): Promise<void> => {
    if (message.command === "project.activate") {
      const result = await options.canonicalProjectApplication.activate(message.payload);
      options.transport.send(
        createProjectActivateResultEvent(nextMetadata(message.messageId), result),
      );
    } else if (message.command === "project.switch") {
      const result = await options.canonicalProjectApplication.switchProject(message.payload);
      options.transport.send(
        createProjectSwitchResultEvent(nextMetadata(message.messageId), result),
      );
    } else {
      const result = await options.canonicalProjectApplication.execute(message.payload);
      options.transport.send(
        createProjectCommandResultEvent(nextMetadata(message.messageId), result),
      );
    }
  };

  const handleProjectStorageMessage = async (message: ProjectStorageMessage): Promise<void> => {
    switch (message.command) {
      case "project.open": {
        const result = await options.projectStorageApplication.open(message.payload);
        options.transport.send(
          createProjectOpenResultEvent(nextMetadata(message.messageId), result),
        );
        return;
      }
      case "project.create": {
        const result = await options.projectStorageApplication.create(message.payload);
        options.transport.send(
          createProjectCreateResultEvent(nextMetadata(message.messageId), result),
        );
        return;
      }
      case "project.close": {
        const result = await options.projectStorageApplication.close(message.payload);
        options.transport.send(
          createProjectCloseResultEvent(nextMetadata(message.messageId), result),
        );
      }
    }
  };

  const handleMessage = async (message: unknown): Promise<void> => {
    const parsed = parseDesktopMessage(message);
    const causationId = readMessageId(message);

    if (!parsed.ok) {
      sendFailure(causationId, {
        code: parsed.error.code,
        message: failureMessages[parsed.error.code],
        retryable: false,
      });
      return;
    }

    if (isCanonicalProjectMessage(parsed.value)) return handleCanonicalProjectMessage(parsed.value);
    if (isProjectStorageMessage(parsed.value)) return handleProjectStorageMessage(parsed.value);
    switch (parsed.value.command) {
      case "project.list": {
        const result =
          (await options.projectListing?.list()) ??
          ({ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" } as const);
        options.transport.send(createProjectListResultEvent(nextMetadata(causationId), result));
        return;
      }
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
      const validated = decodeStrict(WorkspaceNotificationSchema, notification);
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
    // Publish the shared promise before any cleanup callback can re-enter stop.
    let settle: (completion: Promise<void>) => void = () => undefined;
    stopPromise = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const intakeFailures: unknown[] = [];
    try {
      stopMessages();
    } catch (error) {
      intakeFailures.push(error);
    }
    try {
      stopNotifications();
    } catch (error) {
      intakeFailures.push(error);
    }
    const canonical = attemptStop(() => options.canonicalProjectApplication.stop());
    // Project listing owns a private Storage owner, so it drains independently of canonical.
    const listing = attemptStop(() => options.projectListing?.stop());
    // A failed canonical release may still hold the shared Storage owner: withhold its stop.
    const storage = canonical.then((failures) =>
      failures.length > 0 ? failures : attemptStop(() => options.projectStorageApplication.stop()),
    );
    settle(
      Promise.all([storage, listing]).then(([storageFailures, listingFailures]) => {
        const failures = [...intakeFailures, ...storageFailures, ...listingFailures];
        if (failures.length > 0) throw runtimeShutdownFailure(failures);
      }),
    );
    return stopPromise;
  };
}
