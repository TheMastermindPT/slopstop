import type { DesktopMessage } from "@slopstop/protocol";
import type { HarnessSessionEvent } from "./harness-session.js";

export function dispatchPendingHarnessEvent(
  event: HarnessSessionEvent,
  handlers: Readonly<{
    failAll(message: string): void;
    failRequest(causationId: string, message: string): void;
    message(message: Extract<HarnessSessionEvent, { type: "message" }>["message"]): void;
  }>,
): void {
  switch (event.type) {
    case "disconnected":
      handlers.failAll("Harness session disconnected.");
      return;
    case "protocol-error":
      handlers.failAll("Harness session received an invalid protocol message.");
      return;
    case "message":
      if (event.message.event === "request.failure") {
        handlers.failRequest(event.message.causationId, event.message.payload.message);
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
