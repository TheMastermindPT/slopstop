import type { DesktopMessage } from "@slopstop/protocol";

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
