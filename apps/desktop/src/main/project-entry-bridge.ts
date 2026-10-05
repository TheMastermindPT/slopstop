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
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  ProjectListResultSchema,
  type ProjectRegistrationRequest,
  ProjectRegistrationRequestSchema,
  ProjectRegistrationResultSchema,
} from "@slopstop/protocol";
import type { Schema } from "effect";
import { dispatchPendingHarnessEvent, requestHarness } from "./harness-pending-request.js";
import type { HarnessSessionClient } from "./harness-session.js";

type Pending = { event: HarnessMessage["event"]; settle(value: unknown): void; fail(): void };
export function createProjectEntryBridge(options: {
  session: HarnessSessionClient;
  createId(): string;
  now(): string;
}) {
  const pending = new Map<string, Pending>();
  let stopped = false;
  const fail = (id: string) => {
    const item = pending.get(id);
    pending.delete(id);
    item?.fail();
  };
  const failAll = () => {
    for (const id of [...pending.keys()]) fail(id);
  };
  const unsubscribe = options.session.subscribe((event) =>
    dispatchPendingHarnessEvent(event, {
      failAll,
      failRequest: fail,
      message: (message) => {
        if (message.causationId === null) return;
        const item = pending.get(message.causationId);
        if (item === undefined) return;
        pending.delete(message.causationId);
        if (message.event !== item.event) item.fail();
        else item.settle(message.payload);
      },
    }),
  );
  const metadata = () => ({ messageId: options.createId(), sentAt: options.now() });
  function request<Result>(
    createCommand: () => DesktopMessage,
    event: HarnessMessage["event"],
    parse: (value: unknown) => Result,
    broken: () => Result,
  ): Promise<Result> {
    if (stopped) return Promise.resolve(broken());
    return requestHarness({
      pending,
      createCommand,
      broken,
      createPending: (resolve) => ({
        event,
        settle: (value) => {
          try {
            resolve(parse(value));
          } catch {
            resolve(broken());
          }
        },
        fail: () => resolve(broken()),
      }),
      send: (command) => {
        if (!options.session.send(command).ok) fail(command.messageId);
      },
    });
  }
  // Activation and switch results echo their request; a mismatched echo or a lost connection
  // answers the coordinator-unavailable result for that request.
  function echoing<Request, Result extends Readonly<{ request: Request }>>(
    operation: Readonly<{
      requestSchema: Schema.Decoder<Request>;
      resultSchema: Schema.Decoder<Result>;
      command(
        metadata: Readonly<{ messageId: string; sentAt: string }>,
        request: Request,
      ): DesktopMessage;
      event: HarnessMessage["event"];
      unavailable: Readonly<{ status: string; retryable: boolean }>;
    }>,
  ) {
    return (input: Request): Promise<Result> => {
      const inputRequest = decodeStrict(operation.requestSchema, input);
      const broken = () =>
        decodeStrict(operation.resultSchema, {
          status: operation.unavailable.status,
          request: inputRequest,
          diagnostic: {
            code: "PROJECT_COORDINATOR_UNAVAILABLE",
            message: "The Project connection is unavailable.",
            retryable: operation.unavailable.retryable,
          },
        });
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
      unavailable: { status: "unavailable", retryable: true },
    }),
    switchProject: echoing({
      requestSchema: CanonicalProjectSwitchRequestSchema,
      resultSchema: CanonicalProjectSwitchResultSchema,
      command: createProjectSwitchCommand,
      event: "project.switch.result",
      unavailable: { status: "coordinator-unavailable", retryable: false },
    }),
    stop: () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      failAll();
    },
  };
}
export type ProjectEntryBridge = ReturnType<typeof createProjectEntryBridge>;
