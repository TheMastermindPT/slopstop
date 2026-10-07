import { isDeepStrictEqual } from "node:util";
import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  createProjectActivateCommand,
  createProjectListCommand,
  createProjectRegistrationCommand,
  createProjectSwitchCommand,
  createProjectUpgradeCommand,
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  ProjectListResultSchema,
  type ProjectRegistrationRequest,
  ProjectRegistrationRequestSchema,
  ProjectRegistrationResultSchema,
  ProjectUpgradeRequestSchema,
  ProjectUpgradeResultSchema,
  projectAvailabilityMessages,
} from "@slopstop/protocol";
import type { Schema } from "effect";
import { dispatchPendingHarnessEvent, requestHarness } from "./harness-pending-request.js";
import type { HarnessSessionClient } from "./harness-session.js";
import { type ProjectRequestFault, projectUpgradeFailure } from "./project-upgrade-failure.js";

type Pending = {
  event: HarnessMessage["event"];
  settle(value: unknown): void;
  fail(fault: ProjectRequestFault): void;
};
const transport = { kind: "transport" } as const;
const desktop = { kind: "desktop" } as const;
export function createProjectEntryBridge(options: {
  session: HarnessSessionClient;
  createId(): string;
  now(): string;
}) {
  const pending = new Map<string, Pending>();
  let stopped = false;
  const fail = (id: string, fault: ProjectRequestFault) => {
    const item = pending.get(id);
    pending.delete(id);
    item?.fail(fault);
  };
  const failAll = (fault: ProjectRequestFault) => {
    for (const id of [...pending.keys()]) fail(id, fault);
  };
  const unsubscribe = options.session.subscribe((event) =>
    dispatchPendingHarnessEvent(event, {
      failAll: (_message, failure) => failAll(failure),
      failRequest: (causationId, _message, failure) => fail(causationId, failure),
      message: (message) => {
        if (message.causationId === null) return;
        const item = pending.get(message.causationId);
        if (item === undefined) return;
        pending.delete(message.causationId);
        if (message.event !== item.event) item.fail(desktop);
        else item.settle(message.payload);
      },
    }),
  );
  const metadata = () => ({ messageId: options.createId(), sentAt: options.now() });
  function request<Result>(
    createCommand: () => DesktopMessage,
    event: HarnessMessage["event"],
    parse: (value: unknown) => Result,
    broken: (fault: ProjectRequestFault) => Result,
  ): Promise<Result> {
    if (stopped) return Promise.resolve(broken(transport));
    return requestHarness({
      pending,
      createCommand,
      broken: () => broken(desktop),
      createPending: (resolve) => ({
        event,
        settle: (value) => {
          try {
            resolve(parse(value));
          } catch {
            resolve(broken(desktop));
          }
        },
        fail: (fault) => resolve(broken(fault)),
      }),
      send: (command) => {
        const sent = options.session.send(command);
        if (!sent.ok) fail(command.messageId, { kind: "send", code: sent.error.code });
      },
    });
  }
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
  // These results echo their request: a mismatched echo is a fault, answered by `broken`.
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
      const broken = (fault: ProjectRequestFault) => operation.broken(inputRequest, fault);
      return request(
        () => operation.command(metadata(), inputRequest),
        operation.event,
        (value) => {
          const result = decodeStrict(operation.resultSchema, value);
          if (!isDeepStrictEqual(result.request, inputRequest))
            throw new Error("Mismatched Project response");
          return result;
        },
        broken,
      );
    };
  }
  return {
    list: () =>
      request(
        () => createProjectListCommand(metadata()),
        "project.list.result",
        (value) => decodeStrict(ProjectListResultSchema, value),
        () => ({ status: "broken" as const, code: "PROJECT_LIST_TRANSPORT_FAILED" as const }),
      ),
    register: (input: ProjectRegistrationRequest) => {
      const step = decodeStrict(ProjectRegistrationRequestSchema, input);
      return request(
        () => createProjectRegistrationCommand(metadata(), step),
        "project.registration.result",
        (value) => decodeStrict(ProjectRegistrationResultSchema, value),
        () => ({
          status: "broken" as const,
          code: "PROJECT_REGISTRATION_TRANSPORT_FAILED" as const,
        }),
      );
    },
    activate: echoing({
      requestSchema: CanonicalProjectActivationRequestSchema,
      resultSchema: CanonicalProjectActivationResultSchema,
      command: createProjectActivateCommand,
      event: "project.activate.result",
      broken: unavailable(CanonicalProjectActivationResultSchema, "unavailable", true),
    }),
    switchProject: echoing({
      requestSchema: CanonicalProjectSwitchRequestSchema,
      resultSchema: CanonicalProjectSwitchResultSchema,
      command: createProjectSwitchCommand,
      event: "project.switch.result",
      broken: unavailable(CanonicalProjectSwitchResultSchema, "coordinator-unavailable", false),
    }),
    upgrade: echoing({
      requestSchema: ProjectUpgradeRequestSchema,
      resultSchema: ProjectUpgradeResultSchema,
      command: createProjectUpgradeCommand,
      event: "project.upgrade.result",
      broken: projectUpgradeFailure,
    }),
    stop: () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      failAll(transport);
    },
  };
}
export type ProjectEntryBridge = ReturnType<typeof createProjectEntryBridge>;
