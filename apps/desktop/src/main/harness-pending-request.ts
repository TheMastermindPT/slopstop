import type { DesktopMessage, HarnessFailureCode } from "@slopstop/protocol";
import type { HarnessSessionEvent } from "./harness-session.js";

/** Why a pending request failed: a lost connection, an invalid message, or a harness code. */
export type PendingFailure =
  | Readonly<{ kind: "transport" }>
  | Readonly<{ kind: "protocol" }>
  | Readonly<{ kind: "harness"; code: HarnessFailureCode }>;

export function dispatchPendingHarnessEvent(
  event: HarnessSessionEvent,
  handlers: Readonly<{
    failAll(message: string, failure: PendingFailure): void;
    failRequest(causationId: string, message: string, failure: PendingFailure): void;
    message(message: Extract<HarnessSessionEvent, { type: "message" }>["message"]): void;
  }>,
): void {
  switch (event.type) {
    case "disconnected":
      handlers.failAll("Harness session disconnected.", { kind: "transport" });
      return;
    case "protocol-error":
      handlers.failAll("Harness session received an invalid protocol message.", {
        kind: "protocol",
      });
      return;
    case "message":
      if (event.message.event === "request.failure") {
        const { code, message } = event.message.payload;
        handlers.failRequest(event.message.causationId, message, { kind: "harness", code });
        return;
      }
      handlers.message(event.message);
  }
}

function tryCreateHarnessCommand(createCommand: () => DesktopMessage): DesktopMessage | undefined {
  try {
    return createCommand();
  } catch {
    return undefined;
  }
}

function registerPendingHarnessRequest<Pending>(
  pending: Map<string, Pending>,
  messageId: string,
  request: Pending,
): boolean {
  if (pending.has(messageId)) return false;
  pending.set(messageId, request);
  return true;
}

export function requestHarness<Result, Pending>(
  input: Readonly<{
    pending: Map<string, Pending>;
    createCommand: () => DesktopMessage;
    createPending(resolve: (result: Result) => void): Pending;
    broken(message: string): Result;
    send(command: DesktopMessage, resolve: (result: Result) => void): void;
  }>,
): Promise<Result> {
  const command = tryCreateHarnessCommand(input.createCommand);
  if (command === undefined) {
    return Promise.resolve(input.broken("Desktop created an invalid harness message."));
  }
  return new Promise((resolve) => {
    if (
      !registerPendingHarnessRequest(input.pending, command.messageId, input.createPending(resolve))
    ) {
      resolve(input.broken("Harness request identity collided."));
      return;
    }
    input.send(command, resolve);
  });
}
