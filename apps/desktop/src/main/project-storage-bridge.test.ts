import {
  createFailureEvent,
  createProjectCloseResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
  type DesktopMessage,
  DesktopMessageSchema,
  MessageIdSchema,
  ProjectStorageCloseRequestSchema,
  type ProjectStorageCloseResult,
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateRequestSchema,
  type ProjectStorageCreateResult,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenRequestSchema,
  type ProjectStorageOpenResult,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import type {
  HarnessSessionClient,
  HarnessSessionEvent,
  HarnessSessionSendResult,
} from "./harness-session.js";
import { createProjectStorageBridge } from "./project-storage-bridge.js";

function messageId(value: number): string {
  return MessageIdSchema.parse(`00000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
}

const projectId = messageId(10);
const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
const createRequest = ProjectStorageCreateRequestSchema.parse({
  projectId,
  createRequestId: messageId(11),
});
const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });
const otherOpenRequest = ProjectStorageOpenRequestSchema.parse({ projectId: messageId(16) });
const notRegisteredResult = ProjectStorageOpenResultSchema.parse({
  status: "not-registered",
  request: openRequest,
});
const createdResult = ProjectStorageCreateResultSchema.parse({
  status: "created",
  request: createRequest,
  mode: "read-write",
  identity: {
    storageId: messageId(12),
    generationId: messageId(13),
    canonicalDatabaseLineageId: messageId(14),
    runtimeDatabaseLineageId: messageId(15),
  },
});
const closedResult = ProjectStorageCloseResultSchema.parse({
  status: "closed",
  request: closeRequest,
});

function transportBrokenOpenResult(message: string): ProjectStorageOpenResult {
  return ProjectStorageOpenResultSchema.parse({
    status: "broken",
    request: openRequest,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

function transportBrokenCreateResult(message: string): ProjectStorageCreateResult {
  return ProjectStorageCreateResultSchema.parse({
    status: "broken",
    request: createRequest,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

function transportBrokenCloseResult(message: string): ProjectStorageCloseResult {
  return ProjectStorageCloseResultSchema.parse({
    status: "broken",
    request: closeRequest,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

function systemFailureEvent(message: string) {
  return createFailureEvent(
    {
      messageId: messageId(901),
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 2,
      causationId: null,
    },
    { code: "HARNESS_INTERNAL_FAILURE", message, retryable: false },
  );
}

type ProjectResult =
  | Readonly<{ kind: "open"; result: ProjectStorageOpenResult }>
  | Readonly<{ kind: "create"; result: ProjectStorageCreateResult }>
  | Readonly<{ kind: "close"; result: ProjectStorageCloseResult }>;

class FakeHarnessSession implements HarnessSessionClient {
  readonly sent: DesktopMessage[] = [];
  readonly #listeners = new Set<(event: HarnessSessionEvent) => void>();
  readonly sendResult: HarnessSessionSendResult;
  sendError: unknown;
  readonly unsubscribeError: unknown;
  unsubscribeCalls = 0;

  constructor(
    options: Readonly<{
      sendResult?: HarnessSessionSendResult;
      sendError?: unknown;
      unsubscribeError?: unknown;
    }> = {},
  ) {
    this.sendResult = options.sendResult ?? { ok: true };
    this.sendError = options.sendError;
    this.unsubscribeError = options.unsubscribeError;
  }

  get pendingListenerCount(): number {
    return this.#listeners.size;
  }

  emit(event: HarnessSessionEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  emitProjectResult(causationId: string | null, event: ProjectResult): void {
    const metadata = {
      messageId: messageId(900),
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId,
    };
    const message = (() => {
      switch (event.kind) {
        case "open":
          return createProjectOpenResultEvent(metadata, event.result);
        case "create":
          return createProjectCreateResultEvent(metadata, event.result);
        case "close":
          return createProjectCloseResultEvent(metadata, event.result);
      }
    })();
    this.emit({ type: "message", message });
  }

  send(message: unknown): HarnessSessionSendResult {
    if (this.sendError !== undefined) throw this.sendError;
    if (this.sendResult.ok) this.sent.push(DesktopMessageSchema.parse(message));
    return this.sendResult;
  }

  subscribe(listener: (event: HarnessSessionEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.unsubscribeCalls += 1;
      this.#listeners.delete(listener);
      if (this.unsubscribeError !== undefined) throw this.unsubscribeError;
    };
  }
}

function bridgeWith(session: FakeHarnessSession, ids = [messageId(1), messageId(2), messageId(3)]) {
  let index = 0;
  return createProjectStorageBridge({
    session,
    createId: () => ids[index++] ?? messageId(999),
    now: () => "2026-08-14T12:00:00.000Z",
  });
}

it("correlates out-of-order open, create, and close results", async () => {
  const session = new FakeHarnessSession();
  const bridge = bridgeWith(session, [messageId(1), messageId(2), messageId(3)]);
  const open = bridge.open(openRequest);
  const create = bridge.create(createRequest);
  const close = bridge.close(closeRequest);

  session.emitProjectResult(messageId(3), { kind: "close", result: closedResult });
  session.emitProjectResult(messageId(1), { kind: "open", result: notRegisteredResult });
  session.emitProjectResult(messageId(2), { kind: "create", result: createdResult });

  await expect(open).resolves.toEqual(notRegisteredResult);
  await expect(create).resolves.toEqual(createdResult);
  await expect(close).resolves.toEqual(closedResult);
  expect(session.sent.map(({ command }) => command)).toEqual([
    "project.open",
    "project.create",
    "project.close",
  ]);
});

it.each([
  ["HARNESS_SESSION_UNAVAILABLE", "Harness session is unavailable."],
  ["HARNESS_SESSION_MESSAGE_INVALID", "Desktop created an invalid harness message."],
  ["HARNESS_SESSION_SEND_FAILED", "Harness session send failed."],
] as const)("maps %s to a Storage transport failure", async (code, message) => {
  const session = new FakeHarnessSession({ sendResult: { ok: false, error: { code } } });
  const bridge = bridgeWith(session);

  await expect(bridge.open(openRequest)).resolves.toEqual(transportBrokenOpenResult(message));
  expect(session.pendingListenerCount).toBe(1);
});

it("maps a thrown send failure and releases the request identity", async () => {
  const session = new FakeHarnessSession({ sendError: new Error("private send failure") });
  const bridge = bridgeWith(session, [messageId(1), messageId(1)]);

  await expect(bridge.open(openRequest)).resolves.toEqual(
    transportBrokenOpenResult("Harness session send failed."),
  );
  session.sendError = undefined;
  const retried = bridge.open(openRequest);
  session.emitProjectResult(messageId(1), { kind: "open", result: notRegisteredResult });
  await expect(retried).resolves.toEqual(notRegisteredResult);
});

it("correlates against the validated command payload instead of caller mutation", async () => {
  const session = new FakeHarnessSession();
  const bridge = bridgeWith(session, [messageId(1)]);
  const mutableRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const pending = bridge.open(mutableRequest);

  mutableRequest.projectId = otherOpenRequest.projectId;
  session.emitProjectResult(messageId(1), { kind: "open", result: notRegisteredResult });

  await expect(pending).resolves.toEqual(notRegisteredResult);
});

it("settles pending operations even when session unsubscribe throws", async () => {
  const session = new FakeHarnessSession({ unsubscribeError: new Error("unsubscribe failed") });
  const bridge = bridgeWith(session, [messageId(1)]);
  const pending = bridge.create(createRequest);

  expect(() => bridge.stop()).toThrow("unsubscribe failed");
  await expect(pending).resolves.toEqual(
    transportBrokenCreateResult("Project Storage bridge is stopped."),
  );
  expect(() => bridge.stop()).not.toThrow();
  expect(session.unsubscribeCalls).toBe(1);
});

it("rejects mismatched, uncorrelated, disconnected, and stopped requests", async () => {
  const mismatchSession = new FakeHarnessSession();
  const mismatchBridge = bridgeWith(mismatchSession, [messageId(1)]);
  const mismatch = mismatchBridge.open(openRequest);
  mismatchSession.emitProjectResult(messageId(1), {
    kind: "open",
    result: ProjectStorageOpenResultSchema.parse({
      ...notRegisteredResult,
      request: otherOpenRequest,
    }),
  });
  await expect(mismatch).resolves.toEqual(
    transportBrokenOpenResult("Harness returned a mismatched Project Storage request."),
  );

  const kindSession = new FakeHarnessSession();
  const kindBridge = bridgeWith(kindSession, [messageId(20)]);
  const wrongKind = kindBridge.open(openRequest);
  kindSession.emitProjectResult(messageId(20), { kind: "create", result: createdResult });
  await expect(wrongKind).resolves.toEqual(
    transportBrokenOpenResult("Harness returned a mismatched Project Storage response."),
  );

  const pendingSession = new FakeHarnessSession();
  const pendingBridge = bridgeWith(pendingSession, [messageId(2), messageId(3)]);
  const uncorrelated = pendingBridge.create(createRequest);
  pendingSession.emitProjectResult(null, { kind: "create", result: createdResult });
  await expect(uncorrelated).resolves.toEqual(
    transportBrokenCreateResult("Harness returned an uncorrelated Project Storage response."),
  );
  const disconnected = pendingBridge.close(closeRequest);
  pendingSession.emit({ type: "disconnected" });
  await expect(disconnected).resolves.toEqual(
    transportBrokenCloseResult("Harness session disconnected."),
  );

  pendingBridge.stop();
  pendingBridge.stop();
  await expect(pendingBridge.open(openRequest)).resolves.toEqual(
    transportBrokenOpenResult("Project Storage bridge is stopped."),
  );
  expect(pendingSession.unsubscribeCalls).toBe(1);
});

it.each([
  [{ type: "protocol-error" }, "Harness session received an invalid protocol message."],
  [
    { type: "message", message: systemFailureEvent("sensitive raw failure") },
    "Harness reported a failure.",
  ],
] as const)("fails pending operations once for $type", async (event, message) => {
  const session = new FakeHarnessSession();
  const bridge = bridgeWith(session, [messageId(30)]);
  const pending = bridge.create(createRequest);

  session.emit(event);

  await expect(pending).resolves.toEqual(transportBrokenCreateResult(message));
  expect(JSON.stringify(await pending)).not.toContain("sensitive raw failure");
});

it("rejects invalid local metadata and identity collision without losing the original", async () => {
  const invalidSession = new FakeHarnessSession();
  const invalidBridge = bridgeWith(invalidSession, ["not-a-message-id"]);
  await expect(invalidBridge.open(openRequest)).resolves.toEqual(
    transportBrokenOpenResult("Desktop created an invalid harness message."),
  );
  expect(invalidSession.sent).toEqual([]);

  const collisionSession = new FakeHarnessSession();
  const collisionBridge = bridgeWith(collisionSession, [messageId(40), messageId(40)]);
  const original = collisionBridge.open(openRequest);
  await expect(collisionBridge.close(closeRequest)).resolves.toEqual(
    transportBrokenCloseResult("Harness request identity collided."),
  );
  collisionSession.emitProjectResult(messageId(40), { kind: "open", result: notRegisteredResult });
  await expect(original).resolves.toEqual(notRegisteredResult);
});
