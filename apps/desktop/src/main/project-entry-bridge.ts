import { isDeepStrictEqual } from "node:util";
import {
  type CanonicalProjectActivationRequest,
  CanonicalProjectActivationRequestSchema,
  type CanonicalProjectActivationResult,
  CanonicalProjectActivationResultSchema,
  type CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchRequestSchema,
  type CanonicalProjectSwitchResult,
  CanonicalProjectSwitchResultSchema,
  createProjectActivateCommand,
  createProjectConversationReadCommand,
  createProjectConversationSaveCommand,
  createProjectListCommand,
  createProjectRegistrationCommand,
  createProjectSwitchCommand,
  createProjectUpgradeCommand,
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  ProjectConversationReadRequestSchema,
  ProjectConversationReadResultSchema,
  ProjectConversationSaveRequestSchema,
  ProjectConversationSaveResultSchema,
  ProjectListResultSchema,
  type ProjectRegistrationRequest,
  ProjectRegistrationRequestSchema,
  ProjectRegistrationResultSchema,
  ProjectUpgradeRequestSchema,
  ProjectUpgradeResultSchema,
  projectAvailabilityMessages,
} from "@slopstop/protocol";
import { Effect, type Schema } from "effect";
import {
  answerRequest,
  type Clock,
  decodeReply,
  type HarnessRequestCore,
  makeHarnessRequestCore,
  type ProjectRequestFault,
} from "./harness-request-core.js";
import type { HarnessSessionClient } from "./harness-session.js";
import {
  readConversationFailure,
  saveConversationFailure,
} from "./project-conversation-failure.js";
import { projectUpgradeFailure } from "./project-upgrade-failure.js";

// Activation and switch answer their coordinator-unavailable result for every fault.
function unavailable<Request, Result>(
  resultSchema: Schema.Decoder<Result>,
  status: string,
  retryable: boolean,
) {
  return (request: Request): Result =>
    decodeStrict(resultSchema, {
      status,
      request,
      diagnostic: {
        code: "PROJECT_COORDINATOR_UNAVAILABLE",
        message: projectAvailabilityMessages.connectionLost,
        retryable,
      },
    });
}

/** The activation result while the Project coordinator is unreachable. */
export const projectActivationUnavailable = unavailable<
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult
>(CanonicalProjectActivationResultSchema, "unavailable", true);

/** The switch result while the Project coordinator is unreachable. */
export const projectSwitchUnavailable = unavailable<
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult
>(CanonicalProjectSwitchResultSchema, "coordinator-unavailable", false);

/** The fault of a request made after the bridge stopped: it was never sent. */
export const unsent = { kind: "unsent" } as const;

/** The list answer while SlopStop closes (D11): at the IPC gate and for work in flight at stop. */
export const projectListClosing = {
  status: "unavailable",
  code: "PROJECT_LIST_UNAVAILABLE",
} as const;

/** The registration answer while SlopStop closes (D11). */
export const projectRegistrationClosing = {
  status: "unavailable",
  code: "PROJECT_REGISTRATION_UNAVAILABLE",
} as const;

/** The request helpers of one project-entry bridge, over its core and its stopped flag. */
function entryRequests(core: HarnessRequestCore, clock: Clock, isStopped: () => boolean) {
  const metadata = () => ({ messageId: clock.createId(), sentAt: clock.now() });
  function request<Result>(
    createCommand: () => DesktopMessage,
    event: HarnessMessage["event"],
    decode: (value: unknown) => Effect.Effect<Result, ProjectRequestFault>,
    broken: (fault: ProjectRequestFault) => Result,
  ): Promise<Result> {
    if (isStopped()) return Promise.resolve(broken(unsent));
    return answerRequest(
      core.request("project-entry", createCommand, event).pipe(Effect.flatMap(decode)),
      broken,
    );
  }
  // These results echo their request: a mismatched echo is a `desktop` fault.
  function echoing<Request, Result extends Readonly<{ request: Request }>>(
    operation: Readonly<{
      requestSchema: Schema.Decoder<Request>;
      resultSchema: Schema.Decoder<Result>;
      command(
        metadata: Readonly<{ messageId: string; sentAt: string }>,
        request: Request,
      ): DesktopMessage;
      event: HarnessMessage["event"];
      broken(request: Request, fault: ProjectRequestFault): Result;
    }>,
  ) {
    return (input: Request): Promise<Result> => {
      const inputRequest = decodeStrict(operation.requestSchema, input);
      return request(
        () => operation.command(metadata(), inputRequest),
        operation.event,
        (value) =>
          Effect.flatMap(decodeReply(operation.resultSchema, value), (result) =>
            isDeepStrictEqual(result.request, inputRequest)
              ? Effect.succeed(result)
              : Effect.fail({ kind: "desktop", reason: "mismatched-echo" } as const),
          ),
        (fault) => operation.broken(inputRequest, fault),
      );
    };
  }
  return { metadata, request, echoing };
}

/** The project-entry operations over one bridge's request helpers. */
function entryOperations({ metadata, request, echoing }: ReturnType<typeof entryRequests>) {
  return {
    list: () =>
      request(
        () => createProjectListCommand(metadata()),
        "project.list.result",
        (value) => decodeReply(ProjectListResultSchema, value),
        (fault) =>
          fault.kind === "stopped"
            ? projectListClosing
            : { status: "broken" as const, code: "PROJECT_LIST_TRANSPORT_FAILED" as const },
      ),
    register: (input: ProjectRegistrationRequest) => {
      const step = decodeStrict(ProjectRegistrationRequestSchema, input);
      return request(
        () => createProjectRegistrationCommand(metadata(), step),
        "project.registration.result",
        (value) => decodeReply(ProjectRegistrationResultSchema, value),
        (fault) =>
          fault.kind === "stopped"
            ? projectRegistrationClosing
            : {
                status: "broken" as const,
                code: "PROJECT_REGISTRATION_TRANSPORT_FAILED" as const,
              },
      );
    },
    activate: echoing({
      requestSchema: CanonicalProjectActivationRequestSchema,
      resultSchema: CanonicalProjectActivationResultSchema,
      command: createProjectActivateCommand,
      event: "project.activate.result",
      broken: projectActivationUnavailable,
    }),
    switchProject: echoing({
      requestSchema: CanonicalProjectSwitchRequestSchema,
      resultSchema: CanonicalProjectSwitchResultSchema,
      command: createProjectSwitchCommand,
      event: "project.switch.result",
      broken: projectSwitchUnavailable,
    }),
    upgrade: echoing({
      requestSchema: ProjectUpgradeRequestSchema,
      resultSchema: ProjectUpgradeResultSchema,
      command: createProjectUpgradeCommand,
      event: "project.upgrade.result",
      broken: projectUpgradeFailure,
    }),
    readConversation: echoing({
      requestSchema: ProjectConversationReadRequestSchema,
      resultSchema: ProjectConversationReadResultSchema,
      command: createProjectConversationReadCommand,
      event: "project.conversation.read.result",
      broken: readConversationFailure,
    }),
    saveConversationMessage: echoing({
      requestSchema: ProjectConversationSaveRequestSchema,
      resultSchema: ProjectConversationSaveResultSchema,
      command: createProjectConversationSaveCommand,
      event: "project.conversation.save.result",
      broken: saveConversationFailure,
    }),
  };
}

/**
 * The project-entry bridge over a request core. `afterStop` runs once, after the bridge's own
 * stop: the standalone bridge ends its private core there; a shared one leaves the core alone.
 */
export function projectEntryBridgeOver(
  core: HarnessRequestCore,
  clock: Clock,
  afterStop: () => void,
) {
  let stopped = false;
  return {
    ...entryOperations(entryRequests(core, clock, () => stopped)),
    stop: () => {
      if (stopped) return;
      stopped = true;
      // Settle first: an unsubscribe failure in `afterStop` surfaces only after.
      core.failBridge("project-entry", { kind: "stopped" });
      afterStop();
    },
  };
}
export type ProjectEntryBridge = ReturnType<typeof projectEntryBridgeOver>;

/** A standalone project-entry bridge, with its own core over `session`. */
export function createProjectEntryBridge(
  options: Readonly<{ session: HarnessSessionClient } & Clock>,
): ProjectEntryBridge {
  const core = makeHarnessRequestCore(options.session);
  return projectEntryBridgeOver(core, options, core.unsubscribe);
}
