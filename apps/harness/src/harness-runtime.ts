import {
  createProjectActivateResultEvent,
  createProjectCloseResultEvent,
  createProjectCommandResultEvent,
  createProjectCreateResultEvent,
  createProjectListResultEvent,
  createProjectOpenResultEvent,
  createProjectRegistrationResultEvent,
  createProjectSwitchResultEvent,
  createProjectUpgradeResultEvent,
  createReadyEvent,
  createRequestFailureEvent,
  createSystemFailureEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type DesktopMessage,
  decodeStrict,
  type HarnessFailureCode,
  harnessFailureMessages,
  type MessageId,
  type ProjectListResult,
  parseDesktopMessage,
  readMessageId,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import { Deferred, Effect } from "effect";
import type { CanonicalProjectApplication } from "./canonical-project-application.js";
import type { ProjectStorageApplication } from "./project-storage-application.js";
import type { ProjectRegistrationFlow } from "./registration/project-registration-flow.js";
import type { WorkspaceApplication } from "./workspace-application.js";

export interface HarnessTransport {
  send(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export type StopHarnessRuntime = () => Promise<void>;

type HarnessRuntimeOptions = Readonly<{
  projectListing?: Readonly<{ list(): Promise<ProjectListResult>; stop(): Promise<void> }>;
  projectRegistration?: ProjectRegistrationFlow;
  // The harness's shared application database authority, stopped last when Storage stopped.
  applicationDatabase?: Readonly<{ stop(): Promise<void> }>;
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
  PROTOCOL_MESSAGE_INVALID: harnessFailureMessages.PROTOCOL_MESSAGE_INVALID,
  PROTOCOL_VERSION_UNSUPPORTED: harnessFailureMessages.PROTOCOL_VERSION_UNSUPPORTED,
};

function runtimeShutdownFailure(failures: readonly unknown[]): unknown {
  return failures.length === 1
    ? failures[0]
    : new AggregateError(failures, "Harness runtime shutdown failed.");
}

type StopFailures = readonly unknown[];

// Invokes a cleanup in the caller's turn (same-turn admission is part of the shutdown
// contract) and exposes its settlement as an Effect that never fails.
function startStop(stop: () => Promise<void> | undefined): Effect.Effect<StopFailures> {
  let started: Promise<void> | undefined;
  try {
    started = stop();
  } catch (error) {
    return Effect.succeed([error]);
  }
  return Effect.promise(() =>
    Promise.resolve(started).then(
      () => [],
      (error: unknown) => [error],
    ),
  );
}

// While a Project is held, Storage stops only after canonical release succeeds (a failed
// release may still hold it). While none is held, Storage stops together with the canonical
// application, so a running upgrade meets the owner stop instead of finishing first. The
// shared application database stops only after Storage stopped and the listing drained, so a
// withheld Storage keeps it alive.
type StorageStopOutcome = Readonly<{ withheld: boolean; failures: StopFailures }>;

/** Whether a Project is held; a query that throws counts as held and is reported. */
function heldProject(
  options: HarnessRuntimeOptions,
): Readonly<{ held: boolean; failures: StopFailures }> {
  try {
    return { held: options.canonicalProjectApplication.holdsProject?.() ?? true, failures: [] };
  } catch (error) {
    return { held: true, failures: [error] };
  }
}

/**
 * Stops the canonical application and Storage in the order the held Project allows. With no
 * Project held, Storage stops at once and its own result alone decides whether the shared
 * application database may stop; a canonical failure is still reported.
 */
function stopCanonicalThenStorage(
  options: HarnessRuntimeOptions,
): Effect.Effect<StorageStopOutcome> {
  const query = heldProject(options);
  const canonicalStop = startStop(() => options.canonicalProjectApplication.stop());
  const canonical = Effect.map(canonicalStop, (failures) => [...query.failures, ...failures]);
  const storage = Effect.map(
    Effect.suspend(() => startStop(() => options.projectStorageApplication.stop())),
    (failures) => ({ withheld: failures.length > 0, failures }),
  );
  if (query.held) {
    return Effect.flatMap(canonicalStop, (failures) =>
      failures.length > 0
        ? Effect.succeed({ withheld: true, failures: [...query.failures, ...failures] })
        : Effect.map(storage, (stopped) => ({
            withheld: stopped.withheld,
            failures: [...query.failures, ...stopped.failures],
          })),
    );
  }
  return Effect.map(
    Effect.all([canonical, storage], { concurrency: "unbounded" }),
    ([canonicalFailures, stopped]) => ({
      withheld: stopped.withheld,
      failures: [...canonicalFailures, ...stopped.failures],
    }),
  );
}

function shutdownAfterIntake(
  options: HarnessRuntimeOptions,
  intakeFailures: StopFailures,
): Effect.Effect<void, unknown> {
  const storage = stopCanonicalThenStorage(options);
  const listing = startStop(() => options.projectListing?.stop());
  return Effect.gen(function* () {
    const [storageOutcome, listingFailures] = yield* Effect.all([storage, listing], {
      concurrency: "unbounded",
    });
    const databaseFailures = storageOutcome.withheld
      ? []
      : yield* Effect.suspend(() => startStop(() => options.applicationDatabase?.stop()));
    const failures = [
      ...intakeFailures,
      ...storageOutcome.failures,
      ...listingFailures,
      ...databaseFailures,
    ];
    if (failures.length > 0) return yield* Effect.fail(runtimeShutdownFailure(failures));
  });
}

type CanonicalProjectMessage = Extract<
  DesktopMessage,
  { command: "project.activate" | "project.switch" | "project.command" | "project.upgrade" }
>;
type ProjectStorageMessage = Extract<
  DesktopMessage,
  { command: "project.open" | "project.create" | "project.close" }
>;
type WorkspaceMessage = Extract<
  DesktopMessage,
  { command: "workspace.query" | "workspace.intent" }
>;
type RegistryMessage = Extract<
  DesktopMessage,
  { command: "project.list" | "project.registration" }
>;
function isWorkspaceMessage(message: DesktopMessage): message is WorkspaceMessage {
  return message.command === "workspace.query" || message.command === "workspace.intent";
}
function isCanonicalProjectMessage(message: DesktopMessage): message is CanonicalProjectMessage {
  return (
    message.command === "project.activate" ||
    message.command === "project.switch" ||
    message.command === "project.command" ||
    message.command === "project.upgrade"
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
      message: harnessFailureMessages.HARNESS_INTERNAL_FAILURE,
      retryable: false,
    });
  };

  const handleCanonicalProjectMessage = async (message: CanonicalProjectMessage): Promise<void> => {
    if (message.command === "project.activate") {
      const result = await options.canonicalProjectApplication.activate(message.payload);
      options.transport.send(
        createProjectActivateResultEvent(nextMetadata(message.messageId), result),
      );
    } else if (message.command === "project.upgrade") {
      const result = await options.canonicalProjectApplication.upgrade(message.payload);
      options.transport.send(
        createProjectUpgradeResultEvent(nextMetadata(message.messageId), result),
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

  // The Project list and registration steps both answer from the registration registry.
  const handleRegistryMessage = async (message: RegistryMessage): Promise<void> => {
    if (message.command === "project.list") {
      const result =
        (await options.projectListing?.list()) ??
        ({ status: "unavailable", code: "PROJECT_LIST_UNAVAILABLE" } as const);
      options.transport.send(createProjectListResultEvent(nextMetadata(message.messageId), result));
      return;
    }
    const result =
      options.projectRegistration === undefined
        ? ({ status: "unavailable", code: "PROJECT_REGISTRATION_UNAVAILABLE" } as const)
        : await Effect.runPromise(options.projectRegistration.handle(message.payload));
    options.transport.send(
      createProjectRegistrationResultEvent(nextMetadata(message.messageId), result),
    );
  };

  const handleWorkspaceMessage = async (message: WorkspaceMessage): Promise<void> => {
    // Sequence numbers follow emission order, so metadata is taken after the answer settles.
    if (message.command === "workspace.query") {
      const result = await options.workspaceApplication.query(message.payload);
      options.transport.send(
        createWorkspaceQueryResultEvent(nextMetadata(message.messageId), result),
      );
      return;
    }
    const result = await options.workspaceApplication.submit(message.payload);
    options.transport.send(
      createWorkspaceIntentResultEvent(nextMetadata(message.messageId), result),
    );
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
    if (isWorkspaceMessage(parsed.value)) return handleWorkspaceMessage(parsed.value);
    if (parsed.value.command === "system.handshake") {
      options.transport.send(createReadyEvent(nextMetadata(causationId), options.harnessVersion));
      return;
    }
    return handleRegistryMessage(parsed.value);
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

  // One completion shared by every stop request, published before any cleanup callback
  // runs so a callback that re-enters stop receives the same promise.
  const completion = Deferred.makeUnsafe<void, unknown>();
  let stopPromise: Promise<void> | undefined;
  return () => {
    if (stopPromise !== undefined) {
      return stopPromise;
    }
    stopPromise = Effect.runPromise(Deferred.await(completion));
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
    Effect.runFork(
      Effect.exit(shutdownAfterIntake(options, intakeFailures)).pipe(
        Effect.flatMap((exit) => Deferred.done(completion, exit)),
      ),
    );
    return stopPromise;
  };
}
