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
  decodeStrict,
  harnessFailureRows,
  ProjectConversationReadRequestSchema,
  ProjectConversationReadResultSchema,
  ProjectConversationSaveRequestSchema,
  ProjectConversationSaveResultSchema,
  ProjectListRequestSchema,
  ProjectListResultSchema,
  ProjectRegistrationRequestSchema,
  ProjectRegistrationResultSchema,
  ProjectUpgradeRequestSchema,
  ProjectUpgradeResultSchema,
  projectAvailabilityMessages,
} from "@slopstop/protocol";
import type { Schema } from "effect";
import {
  type BridgeHandle,
  type BridgeOperation,
  bridgeRequest,
  type Clock,
  type HarnessRequestCore,
  type ProjectRequestFault,
} from "./harness-request-core.js";
import {
  readConversationFailure,
  saveConversationFailure,
} from "./project-conversation-failure.js";
import { projectUpgradeFailure } from "./project-upgrade-failure.js";
import { faultMeaning } from "./request-fault-meaning.js";

// The coordinator-unavailable answer: at the closed IPC gate, and for a request that was not sent
// or was sent and then lost.
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

/**
 * The activation or switch answer for a request that got no decoded reply. Only a request not
 * sent, or sent and then lost, gets the operation's unavailable answer; a harness failure keeps its
 * row, and every other fault is an invalid protocol message.
 */
function entryFailure<Request, Result>(unavailableAnswer: (request: Request) => Result) {
  return (request: Request, fault: ProjectRequestFault) => {
    const meaning = faultMeaning(fault);
    if (meaning.meaning === "not-sent" || meaning.meaning === "sent-then-lost")
      return unavailableAnswer(request);
    const code = meaning.meaning === "harness" ? meaning.code : "PROTOCOL_MESSAGE_INVALID";
    return { status: "broken" as const, request, diagnostic: harnessFailureRows[code] };
  };
}

const projectActivationFailure = entryFailure(projectActivationUnavailable);
const projectSwitchFailure = entryFailure(projectSwitchUnavailable);

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

type CommandMetadata = () => Readonly<{ messageId: string; sentAt: string }>;

/** Turns an operation into its client call over one bridge's core and handle. */
function runner(core: HarnessRequestCore, bridge: BridgeHandle) {
  return <Request, Result>(operation: BridgeOperation<Request, Result>) =>
    (input: Request): Promise<Result> =>
      bridgeRequest(core, bridge, operation, input);
}

/** List and registration: no echo, and work in flight at stop answers the closing result. */
function catalogOperations(
  core: HarnessRequestCore,
  bridge: BridgeHandle,
  metadata: CommandMetadata,
) {
  const run = runner(core, bridge);
  return {
    list: () =>
      bridgeRequest(
        core,
        bridge,
        {
          requestSchema: ProjectListRequestSchema,
          command: () => createProjectListCommand(metadata()),
          event: "project.list.result",
          resultSchema: ProjectListResultSchema,
          broken: (_request, fault) =>
            fault.kind === "stopped"
              ? projectListClosing
              : { status: "broken" as const, code: "PROJECT_LIST_TRANSPORT_FAILED" as const },
        },
        {},
      ),
    register: run({
      requestSchema: ProjectRegistrationRequestSchema,
      command: (request) => createProjectRegistrationCommand(metadata(), request),
      event: "project.registration.result",
      resultSchema: ProjectRegistrationResultSchema,
      broken: (_request, fault) =>
        fault.kind === "stopped"
          ? projectRegistrationClosing
          : { status: "broken" as const, code: "PROJECT_REGISTRATION_TRANSPORT_FAILED" as const },
    }),
  };
}

/** The project-entry operations over one bridge's core, handle and clock. */
function entryOperations(core: HarnessRequestCore, bridge: BridgeHandle, clock: Clock) {
  const metadata = () => ({ messageId: clock.createId(), sentAt: clock.now() });
  const run = runner(core, bridge);
  return {
    ...catalogOperations(core, bridge, metadata),
    activate: run({
      requestSchema: CanonicalProjectActivationRequestSchema,
      command: (request) => createProjectActivateCommand(metadata(), request),
      event: "project.activate.result",
      resultSchema: CanonicalProjectActivationResultSchema,
      echo: { reply: (result) => result.request },
      broken: projectActivationFailure,
    }),
    switchProject: run({
      requestSchema: CanonicalProjectSwitchRequestSchema,
      command: (request) => createProjectSwitchCommand(metadata(), request),
      event: "project.switch.result",
      resultSchema: CanonicalProjectSwitchResultSchema,
      echo: { reply: (result) => result.request },
      broken: projectSwitchFailure,
    }),
    upgrade: run({
      requestSchema: ProjectUpgradeRequestSchema,
      command: (request) => createProjectUpgradeCommand(metadata(), request),
      event: "project.upgrade.result",
      resultSchema: ProjectUpgradeResultSchema,
      echo: { reply: (result) => result.request },
      broken: projectUpgradeFailure,
    }),
    readConversation: run({
      requestSchema: ProjectConversationReadRequestSchema,
      command: (request) => createProjectConversationReadCommand(metadata(), request),
      event: "project.conversation.read.result",
      resultSchema: ProjectConversationReadResultSchema,
      echo: { reply: (result) => result.request },
      broken: readConversationFailure,
    }),
    saveConversationMessage: run({
      requestSchema: ProjectConversationSaveRequestSchema,
      command: (request) => createProjectConversationSaveCommand(metadata(), request),
      event: "project.conversation.save.result",
      resultSchema: ProjectConversationSaveResultSchema,
      echo: { reply: (result) => result.request },
      broken: saveConversationFailure,
    }),
  };
}

/** The project-entry bridge over a request core. */
export function projectEntryBridgeOver(core: HarnessRequestCore, clock: Clock) {
  let stopped = false;
  return {
    ...entryOperations(core, { tag: "project-entry", isStopped: () => stopped }, clock),
    stop: () => {
      stopped = true;
      core.failBridge("project-entry", { kind: "stopped" });
    },
  };
}
export type ProjectEntryBridge = ReturnType<typeof projectEntryBridgeOver>;
