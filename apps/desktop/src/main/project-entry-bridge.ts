import { isDeepStrictEqual } from "node:util";
import {
  type CanonicalProjectActivationRequest,
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  type CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  createProjectActivateCommand,
  createProjectListCommand,
  createProjectSwitchCommand,
  type DesktopMessage,
  decodeStrict,
  type HarnessMessage,
  ProjectListResultSchema,
} from "@slopstop/protocol";
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
  return {
    list: () =>
      request(
        () => createProjectListCommand(metadata()),
        "project.list.result",
        (value) => decodeStrict(ProjectListResultSchema, value),
        () => ({ status: "broken" as const, code: "PROJECT_LIST_TRANSPORT_FAILED" as const }),
      ),
    activate: (input: CanonicalProjectActivationRequest) => {
      const inputRequest = decodeStrict(CanonicalProjectActivationRequestSchema, input);
      const broken = () =>
        decodeStrict(CanonicalProjectActivationResultSchema, {
          status: "unavailable",
          request: inputRequest,
          diagnostic: {
            code: "PROJECT_COORDINATOR_UNAVAILABLE",
            message: "The Project connection is unavailable.",
            retryable: true,
          },
        });
      return request(
        () => createProjectActivateCommand(metadata(), inputRequest),
        "project.activate.result",
        (value) => {
          const result = decodeStrict(CanonicalProjectActivationResultSchema, value);
          if (!isDeepStrictEqual(result.request, inputRequest))
            throw new Error("Mismatched activation");
          return result;
        },
        broken,
      );
    },
    switchProject: (input: CanonicalProjectSwitchRequest) => {
      const inputRequest = decodeStrict(CanonicalProjectSwitchRequestSchema, input);
      const broken = () =>
        decodeStrict(CanonicalProjectSwitchResultSchema, {
          status: "coordinator-unavailable",
          request: inputRequest,
          diagnostic: {
            code: "PROJECT_COORDINATOR_UNAVAILABLE",
            message: "The Project connection is unavailable.",
            retryable: false,
          },
        });
      return request(
        () => createProjectSwitchCommand(metadata(), inputRequest),
        "project.switch.result",
        (value) => {
          const result = decodeStrict(CanonicalProjectSwitchResultSchema, value);
          if (!isDeepStrictEqual(result.request, inputRequest))
            throw new Error("Mismatched switch");
          return result;
        },
        broken,
      );
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      failAll();
    },
  };
}
export type ProjectEntryBridge = ReturnType<typeof createProjectEntryBridge>;
