import { MessageChannel, type MessagePort } from "node:worker_threads";
import {
  createProjectCloseCommand,
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

function startRuntimeFixture(workspaceApplication: WorkspaceApplication) {
  const { port1, port2 } = new MessageChannel();
  let generatedId = 2;
  const stop = startHarnessRuntime({
    transport: transportFor(port1),
    projectStorageApplication: createUnavailableProjectStorageApplication(),
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
        protocolVersion: 3,
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
