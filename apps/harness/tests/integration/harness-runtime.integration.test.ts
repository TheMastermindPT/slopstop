import { setImmediate as nextTurn } from "node:timers/promises";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
  createProjectActivateCommand,
  createProjectCloseCommand,
  createProjectCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
  protocolVersion,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import {
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type ProjectStorageApplication,
  startHarnessRuntime,
  type WorkspaceApplication,
} from "../../src/index.js";

function transportFor(port: MessagePort): HarnessTransport {
  return {
    send(message) {
      port.postMessage(message);
    },
    subscribe(listener) {
      port.on("message", listener);
      return () => port.off("message", listener);
    },
  };
}

function nextMessage(port: MessagePort): Promise<unknown> {
  return new Promise((resolve) => {
    port.once("message", resolve);
  });
}

function workspaceApplicationWithNotifications(
  setSubscriber: (subscriber: ((notification: WorkspaceNotification) => void) | undefined) => void,
): WorkspaceApplication {
  return {
    query: async (query) =>
      WorkspaceQueryResultSchema.parse({
        status: "unavailable",
        query,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      }),
    submit: async () =>
      WorkspaceIntentResultSchema.parse({
        status: "unavailable",
        capability: "memory",
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      }),
    subscribe(listener) {
      setSubscriber(listener);
      return () => setSubscriber(undefined);
    },
  };
}

function startRuntimeFixture(
  workspaceApplication: WorkspaceApplication,
  projectStorageApplication: ProjectStorageApplication = createUnavailableProjectStorageApplication(),
) {
  const { port1, port2 } = new MessageChannel();
  let generatedId = 2;
  const stop = startHarnessRuntime({
    canonicalProjectApplication: {
      activate: async () => {
        throw new Error("Canonical activation is unused by this fixture.");
      },
      execute: async () => {
        throw new Error("Canonical command is unused by this fixture.");
      },
      stop: async () => undefined,
    },
    transport: transportFor(port1),
    projectStorageApplication,
    workspaceApplication,
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-08-14T12:00:01.000Z",
  });
  return { port1, port2, stop };
}

function projectStorageCommandCases() {
  const projectId = "00000000-0000-4000-8000-000000000010";
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId: "00000000-0000-4000-8000-000000000011",
  });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });
  const metadata = (suffix: string) => ({
    messageId: `00000000-0000-4000-8000-${suffix}`,
    sentAt: "2026-08-14T12:00:00.000Z",
  });
  return [
    {
      command: createProjectOpenCommand(metadata("000000000100"), openRequest),
      event: "project.open.result",
    },
    {
      command: createProjectCreateCommand(metadata("000000000101"), createRequest),
      event: "project.create.result",
    },
    {
      command: createProjectCloseCommand(metadata("000000000102"), closeRequest),
      event: "project.close.result",
    },
  ] as const;
}

const memoryIntent = WorkspaceIntentSchema.parse({
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000010",
  proposalId: "00000000-0000-4000-8000-000000000011",
  decision: "accept",
  expectedProjectionRevision: 0,
});

const memoryNotification = WorkspaceNotificationSchema.parse({
  capability: "memory",
  scope: {
    kind: "project",
    projectId: "00000000-0000-4000-8000-000000000010",
  },
  revision: 1,
});

describe("harness message channel integration", () => {
  it("round-trips canonical activation and contains canonical request failures", async () => {
    const f = canonicalChannelFixture();
    try {
      await f.exchange("activate", "project.activate.result", f.activationResult);
      await f.exchange("execute", "project.command.result", f.commandResult);
      f.fail();
      const failure = {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a message.",
        retryable: false,
      };
      await f.exchange("activate", "request.failure", failure);
      await f.exchange("execute", "request.failure", failure);
    } finally {
      await f.stop();
    }
  });
  it("round-trips a request handler failure without escalating the process", async () => {
    const { port1, port2, stop } = startRuntimeFixture(createUnavailableWorkspaceApplication(), {
      ...createUnavailableProjectStorageApplication(),
      open: async () => {
        throw new Error("sensitive failure");
      },
    });
    try {
      const response = nextMessage(port2);
      port2.postMessage(
        createProjectOpenCommand(
          {
            messageId: "00000000-0000-4000-8000-000000000201",
            sentAt: "2026-08-14T12:00:00.000Z",
          },
          ProjectStorageOpenRequestSchema.parse({
            projectId: "00000000-0000-4000-8000-000000000010",
          }),
        ),
      );
      const result = await response;
      expect(result).toEqual({
        protocolVersion: 4,
        messageType: "event",
        messageId: "00000000-0000-4000-8000-000000000002",
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: 1,
        causationId: "00000000-0000-4000-8000-000000000201",
        event: "request.failure",
        payload: {
          code: "HARNESS_INTERNAL_FAILURE",
          message: "Harness failed while handling a message.",
          retryable: false,
        },
      });
      expect(JSON.stringify(result)).not.toContain("sensitive failure");
    } finally {
      await stop();
      port1.close();
      port2.close();
    }
  });

  it("round-trips an unavailable workspace query over structured clone", async () => {
    const { port1, port2, stop } = startRuntimeFixture(createUnavailableWorkspaceApplication());
    const query = WorkspaceQuerySchema.parse({
      query: "memory-library.read",
      projectId: "00000000-0000-4000-8000-000000000010",
      cursor: null,
    });
    const response = nextMessage(port2);

    port2.postMessage(
      createWorkspaceQueryCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000001",
          sentAt: "2026-08-14T12:00:00.000Z",
        },
        query,
      ),
    );

    await expect(response).resolves.toEqual({
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000001",
      event: "workspace.query.result",
      payload: {
        status: "unavailable",
        query,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      },
    });

    await stop();
    port1.close();
    port2.close();
  });

  it("round-trips workspace intent and invalidation over structured clone", async () => {
    let notificationSubscriber: ((notification: WorkspaceNotification) => void) | undefined;
    const workspaceApplication = workspaceApplicationWithNotifications((subscriber) => {
      notificationSubscriber = subscriber;
    });
    const { port1, port2, stop } = startRuntimeFixture(workspaceApplication);
    const intentResponse = nextMessage(port2);

    port2.postMessage(
      createWorkspaceIntentCommand(
        {
          messageId: "00000000-0000-4000-8000-000000000001",
          sentAt: "2026-08-14T12:00:00.000Z",
        },
        memoryIntent,
      ),
    );

    await expect(intentResponse).resolves.toEqual({
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000001",
      event: "workspace.intent.result",
      payload: {
        status: "unavailable",
        capability: "memory",
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Memory producer is unavailable.",
        },
      },
    });

    if (notificationSubscriber === undefined) {
      throw new Error("Workspace notification subscriber was not registered.");
    }
    const invalidationResponse = nextMessage(port2);
    notificationSubscriber(memoryNotification);

    await expect(invalidationResponse).resolves.toEqual({
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000003",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 2,
      causationId: null,
      event: "workspace.projection.invalidated",
      payload: {
        capability: "memory",
        scope: {
          kind: "project",
          projectId: "00000000-0000-4000-8000-000000000010",
        },
        revision: 1,
      },
    });

    await stop();
    expect(notificationSubscriber).toBeUndefined();
    port1.close();
    port2.close();
  });

  it("round-trips the versioned startup handshake over structured clone", async () => {
    const { port1, port2, stop } = startRuntimeFixture(createUnavailableWorkspaceApplication());
    const response = nextMessage(port2);

    port2.postMessage({
      protocolVersion,
      messageType: "command",
      messageId: "00000000-0000-4000-8000-000000000001",
      sentAt: "2026-08-14T12:00:00.000Z",
      command: "system.handshake",
      payload: { desktopVersion: "0.0.0" },
    });

    await expect(response).resolves.toEqual({
      protocolVersion,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000001",
      event: "system.ready",
      payload: { harnessVersion: "0.0.0" },
    });

    await stop();
    port1.close();
    port2.close();
  });

  it("round-trips all unavailable Project Storage commands over structured clone", async () => {
    const { port1, port2, stop } = startRuntimeFixture(createUnavailableWorkspaceApplication());
    const cases = projectStorageCommandCases();

    for (const [index, { command, event }] of cases.entries()) {
      const response = nextMessage(port2);
      port2.postMessage(command);
      await expect(response).resolves.toEqual({
        protocolVersion: 4,
        messageType: "event",
        messageId: `00000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
        sentAt: "2026-08-14T12:00:01.000Z",
        sequence: index + 1,
        causationId: command.messageId,
        event,
        payload: {
          status: "unavailable",
          request: command.payload,
          diagnostic: {
            code: "PROJECT_STORAGE_UNAVAILABLE",
            message: "Project Storage owner is unavailable.",
          },
        },
      });
    }

    await stop();
    port1.close();
    port2.close();
  });
});

function canonicalChannelFixture() {
  const { port1, port2 } = new MessageChannel();
  const sent: unknown[] = [];
  let received = (): void => undefined;
  const transport: HarnessTransport = {
    send: (message) => {
      sent.push(message);
      port1.postMessage(message);
    },
    subscribe: (listener) => {
      const observe = (message: unknown) => {
        listener(message);
        received();
      };
      port1.on("message", observe);
      return () => port1.off("message", observe);
    },
  };
  const request = CanonicalProjectCommandRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000010",
    activationId: "00000000-0000-4000-8000-000000000011",
    command: {
      commandId: "00000000-0000-4000-8000-000000000012",
      type: "fixture.noop",
      version: 1,
      payload: {},
    },
  });
  const activationResult = CanonicalProjectActivationResultSchema.parse({
    status: "active",
    request: { projectId: request.projectId },
    access: "read-only",
    activationId: request.activationId,
    writerGeneration: null,
    diagnostic: {
      code: "WRITER_UNAVAILABLE",
      message: "Another SlopStop process holds Project write authority.",
      retryable: true,
    },
  });
  const commandResult = CanonicalProjectCommandResultSchema.parse({
    status: "read-only",
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    diagnostic: {
      code: "WRITER_UNAVAILABLE",
      message: "The active Project has no write authority.",
      retryable: true,
    },
  });
  let fail = false;
  let sequence = 900;
  const canonicalProjectApplication = {
    activate: async () => {
      if (fail) throw new Error("C:\\private\\project\\slopstop.db");
      return activationResult;
    },
    execute: async () => {
      if (fail) throw new Error("secret command payload");
      return commandResult;
    },
    stop: async () => undefined,
  };
  const sentAt = "2026-09-04T12:00:00.000Z";
  const options = {
    transport,
    canonicalProjectApplication,
    projectStorageApplication: createUnavailableProjectStorageApplication(),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    now: () => sentAt,
  };
  const stop = startHarnessRuntime(options);
  const messages = {
    activate: createProjectActivateCommand(
      { messageId: "00000000-0000-4000-8000-000000000101", sentAt },
      { projectId: request.projectId },
    ),
    execute: createProjectCommand(
      { messageId: "00000000-0000-4000-8000-000000000102", sentAt },
      request,
    ),
  };
  let number = 0;
  return {
    activationResult,
    commandResult,
    fail: () => {
      fail = true;
    },
    exchange: async (method: keyof typeof messages, event: string, payload: unknown) => {
      const message = messages[method];
      const delivered = new Promise<void>((resolve) => {
        received = resolve;
      });
      const response = nextMessage(port2);
      port2.postMessage(message);
      await delivered;
      await nextTurn();
      number += 1;
      const expected = {
        protocolVersion: 4,
        messageType: "event",
        messageId: `00000000-0000-4000-8000-${String(900 + number).padStart(12, "0")}`,
        sentAt,
        sequence: number,
        causationId: message.messageId,
        event,
        payload,
      };
      expect(sent[number - 1]).toEqual(expected);
      expect(await response).toEqual(expected);
    },
    stop: async () => {
      try {
        await stop();
      } finally {
        port1.close();
        port2.close();
      }
    },
  };
}
