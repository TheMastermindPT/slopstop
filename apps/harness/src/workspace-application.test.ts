import {
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import {
  type ConversationWorkspacePort,
  createUnavailableWorkspaceApplication,
  createWorkspaceApplication,
  type FrameWorkspacePort,
  type MemoryWorkspacePort,
  type WorkspaceOwnerNotification,
} from "./workspace-application.js";

const ids = {
  project: "00000000-0000-4000-8000-000000000001",
  contextRecord: "00000000-0000-4000-8000-000000000002",
} as const;

const queries = [
  WorkspaceQuerySchema.parse({
    query: "conversation.read",
    scope: { kind: "project", projectId: ids.project },
    cursor: null,
  }),
  WorkspaceQuerySchema.parse({
    query: "context-record.read",
    projectId: ids.project,
    contextRecordId: ids.contextRecord,
  }),
  WorkspaceQuerySchema.parse({
    query: "frame-review.read",
    projectId: ids.project,
  }),
  WorkspaceQuerySchema.parse({
    query: "memory-library.read",
    projectId: ids.project,
    cursor: null,
  }),
] as const;

const intents = [
  WorkspaceIntentSchema.parse({
    intent: "conversation.message.submit",
    scope: { kind: "project", projectId: ids.project },
    branchId: "00000000-0000-4000-8000-000000000003",
    text: "Review this answer.",
    contextProposalId: "00000000-0000-4000-8000-000000000004",
    expectedProjectionRevision: 0,
  }),
  WorkspaceIntentSchema.parse({
    intent: "conversation.influence.select",
    projectId: ids.project,
    frameDraftId: "00000000-0000-4000-8000-000000000005",
    includedMessageIds: ["00000000-0000-4000-8000-000000000006"],
    excludedMessageIds: [],
    expectedProjectionRevision: 0,
  }),
  WorkspaceIntentSchema.parse({
    intent: "frame-review.annotate",
    projectId: ids.project,
    frameDraftId: "00000000-0000-4000-8000-000000000005",
    sectionId: "00000000-0000-4000-8000-000000000007",
    selectedText: "selected",
    comment: "Clarify this.",
    expectedProjectionRevision: 0,
  }),
  WorkspaceIntentSchema.parse({
    intent: "frame.decision.accept",
    projectId: ids.project,
    frameDraftId: "00000000-0000-4000-8000-000000000005",
    sectionId: "00000000-0000-4000-8000-000000000007",
    expectedProjectionRevision: 0,
  }),
  WorkspaceIntentSchema.parse({
    intent: "frame.accept",
    projectId: ids.project,
    frameDraftId: "00000000-0000-4000-8000-000000000005",
    expectedProjectionRevision: 0,
  }),
  WorkspaceIntentSchema.parse({
    intent: "memory.proposal.review",
    projectId: ids.project,
    proposalId: "00000000-0000-4000-8000-000000000008",
    decision: "accept",
    expectedProjectionRevision: 0,
  }),
] as const;

function outcomeApplication() {
  return createWorkspaceApplication({
    conversation: {
      query: async () => ({
        status: "ready" as const,
        projection: {
          projection: "conversation",
          revision: 0,
          scope: { kind: "project", projectId: ids.project },
          conversationId: "00000000-0000-4000-8000-000000000003",
          branches: [],
          messages: { items: [], nextCursor: null },
          contextProposal: null,
        },
      }),
      submit: async () => {
        throw new Error("forwarding failed");
      },
      subscribe: () => () => undefined,
    },
    frame: {
      query: async () => ({ status: "unavailable" as const, message: "" }),
      submit: async (intent) => ({
        status: "broken" as const,
        message:
          intent.intent === "frame-review.annotate" ? "Frame owner rejected annotation." : "",
      }),
      subscribe: () => () => undefined,
    },
    memory: {
      query: async () => ({ status: "broken" as const, message: "" }),
      submit: async () => ({ status: "unavailable" as const, message: "" }),
      subscribe: () => () => undefined,
    },
  });
}

function ownerNotification<C extends "conversation" | "frame" | "memory">(
  capability: C,
  revision: number,
): WorkspaceOwnerNotification<C> {
  const parsed = WorkspaceNotificationSchema.parse({
    capability,
    scope: { kind: "project", projectId: ids.project },
    revision,
  });
  return { ...parsed, capability };
}

describe("workspace application", () => {
  it("reports each unavailable owner through its exact query", async () => {
    const application = createUnavailableWorkspaceApplication();
    const expectedOwners = ["Conversation", "Conversation", "Frame", "Memory"] as const;

    for (const [index, query] of queries.entries()) {
      const result = await application.query(query);
      expect(result).toEqual({
        status: "unavailable",
        query,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: `${expectedOwners[index]} producer is unavailable.`,
        },
      });
      expect(result).not.toHaveProperty("projection");
    }
  });

  it("distinguishes thrown producers from invalid projections", async () => {
    const application = createWorkspaceApplication({
      conversation: {
        query: async () => {
          throw new Error("provider failed");
        },
        submit: async () => ({ status: "forwarded" as const }),
        subscribe: () => () => undefined,
      },
      frame: {
        query: async () => ({ status: "unavailable" as const, message: "unavailable" }),
        submit: async () => ({ status: "forwarded" as const }),
        subscribe: () => () => undefined,
      },
      memory: {
        query: async () => ({
          status: "ready" as const,
          projection: {
            projection: "conversation",
            revision: 1,
            scope: { kind: "project", projectId: ids.project },
            conversationId: "00000000-0000-4000-8000-000000000003",
            branches: [],
            messages: { items: [], nextCursor: null },
            contextProposal: null,
          },
        }),
        submit: async () => ({ status: "forwarded" as const }),
        subscribe: () => () => undefined,
      },
    });

    const failed = await application.query(queries[0]);
    expect(failed).toEqual({
      status: "broken",
      query: queries[0],
      diagnostic: {
        code: "WORKSPACE_PRODUCER_FAILED",
        message: "Conversation producer failed.",
      },
    });
    expect(failed).not.toHaveProperty("projection");

    const invalid = await application.query(queries[3]);
    expect(invalid).toEqual({
      status: "broken",
      query: queries[3],
      diagnostic: {
        code: "WORKSPACE_PROJECTION_INVALID",
        message: "Memory producer returned an invalid projection.",
      },
    });
    expect(invalid).not.toHaveProperty("projection");
  });

  it("normalizes ready and explicit query outcomes", async () => {
    const application = outcomeApplication();

    await expect(application.query(queries[0])).resolves.toMatchObject({
      status: "ready",
      query: queries[0],
      projection: { projection: "conversation", revision: 0 },
    });
    await expect(application.query(queries[2])).resolves.toEqual({
      status: "unavailable",
      query: queries[2],
      diagnostic: {
        code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
        message: "Frame producer is unavailable.",
      },
    });
    await expect(application.query(queries[3])).resolves.toEqual({
      status: "broken",
      query: queries[3],
      diagnostic: {
        code: "WORKSPACE_PRODUCER_FAILED",
        message: "Memory producer failed.",
      },
    });
  });

  it("normalizes explicit intent outcomes", async () => {
    const application = outcomeApplication();

    await expect(application.submit(intents[0])).resolves.toEqual({
      status: "broken",
      capability: "conversation",
      diagnostic: {
        code: "WORKSPACE_PRODUCER_FAILED",
        message: "Conversation producer failed.",
      },
    });
    await expect(application.submit(intents[2])).resolves.toEqual({
      status: "broken",
      capability: "frame",
      diagnostic: {
        code: "WORKSPACE_PRODUCER_FAILED",
        message: "Frame owner rejected annotation.",
      },
    });
    await expect(application.submit(intents[3])).resolves.toEqual({
      status: "broken",
      capability: "frame",
      diagnostic: {
        code: "WORKSPACE_PRODUCER_FAILED",
        message: "Frame producer failed.",
      },
    });
    await expect(application.submit(intents[5])).resolves.toEqual({
      status: "unavailable",
      capability: "memory",
      diagnostic: {
        code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
        message: "Memory producer is unavailable.",
      },
    });
  });

  it("returns unavailable for intents with no owner adapter", async () => {
    const application = createUnavailableWorkspaceApplication();
    const expected = [
      ["conversation", "Conversation"],
      ["conversation", "Conversation"],
      ["frame", "Frame"],
      ["frame", "Frame"],
      ["frame", "Frame"],
      ["memory", "Memory"],
    ] as const;

    for (const [index, intent] of intents.entries()) {
      const result = await application.submit(intent);
      expect(result).toEqual({
        status: "unavailable",
        capability: expected[index]?.[0],
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: `${expected[index]?.[1]} producer is unavailable.`,
        },
      });
      for (const field of ["forwarded", "applied", "rejected", "receipt", "revision"] as const) {
        expect(result).not.toHaveProperty(field);
      }
    }
  });

  it("maps forwarded owner intents to their exact capability", async () => {
    const forwardedPort = {
      query: async () => ({ status: "unavailable" as const, message: "unavailable" }),
      submit: async () => ({ status: "forwarded" as const }),
      subscribe: () => () => undefined,
    };
    const application = createWorkspaceApplication({
      conversation: forwardedPort,
      frame: forwardedPort,
      memory: forwardedPort,
    });

    const cases = [
      [intents[0], "conversation"],
      [intents[2], "frame"],
      [intents[5], "memory"],
    ] as const;
    for (const [intent, capability] of cases) {
      const result = await application.submit(intent);
      expect(result).toEqual({ status: "forwarded", capability });
      for (const field of ["applied", "rejected", "receipt", "revision"] as const) {
        expect(result).not.toHaveProperty(field);
      }
    }
  });

  it("keeps owner notification capabilities separate", () => {
    let conversationListener: Parameters<ConversationWorkspacePort["subscribe"]>[0] | undefined;
    let frameListener: Parameters<FrameWorkspacePort["subscribe"]>[0] | undefined;
    let memoryListener: Parameters<MemoryWorkspacePort["subscribe"]>[0] | undefined;
    const basePort = {
      query: async () => ({ status: "unavailable" as const, message: "unavailable" }),
      submit: async () => ({ status: "forwarded" as const }),
    };
    const conversation: ConversationWorkspacePort = {
      ...basePort,
      subscribe(listener) {
        conversationListener = listener;
        return () => {
          conversationListener = undefined;
        };
      },
    };
    const frame: FrameWorkspacePort = {
      ...basePort,
      subscribe(listener) {
        frameListener = listener;
        return () => {
          frameListener = undefined;
        };
      },
    };
    const memory: MemoryWorkspacePort = {
      ...basePort,
      subscribe(listener) {
        memoryListener = listener;
        return () => {
          memoryListener = undefined;
        };
      },
    };
    const application = createWorkspaceApplication({ conversation, frame, memory });
    const received: unknown[] = [];
    const stop = application.subscribe((notification) => received.push(notification));
    const notifications = [
      ownerNotification("conversation", 1),
      ownerNotification("frame", 2),
      ownerNotification("memory", 3),
    ] as const;

    conversationListener?.(notifications[0]);
    frameListener?.(notifications[1]);
    memoryListener?.(notifications[2]);
    expect(received).toEqual(notifications);

    const assertOwnerNotificationTypes = () => {
      // @ts-expect-error Conversation ports cannot publish Memory notifications.
      conversationListener?.(notifications[2]);
      // @ts-expect-error Frame ports cannot publish Conversation notifications.
      frameListener?.(notifications[0]);
      // @ts-expect-error Memory ports cannot publish Conversation notifications.
      memoryListener?.(notifications[0]);
    };
    expect(assertOwnerNotificationTypes).toBeTypeOf("function");

    stop();
    expect(conversationListener).toBeUndefined();
    expect(frameListener).toBeUndefined();
    expect(memoryListener).toBeUndefined();
  });
});
