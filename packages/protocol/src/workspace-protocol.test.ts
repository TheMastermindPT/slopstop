import { describe, expect, it } from "vitest";
import {
  ProjectIdSchema,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceProjectionRevisionSchema,
  WorkspaceQueryResultSchema,
} from "./index.js";

const ids = {
  project: "00000000-0000-4000-8000-000000000001",
  waypoint: "00000000-0000-4000-8000-000000000002",
  branch: "00000000-0000-4000-8000-000000000003",
  contextProposal: "00000000-0000-4000-8000-000000000004",
  frameDraft: "00000000-0000-4000-8000-000000000005",
  section: "00000000-0000-4000-8000-000000000006",
  message: "00000000-0000-4000-8000-000000000007",
  otherMessage: "00000000-0000-4000-8000-000000000008",
  memoryProposal: "00000000-0000-4000-8000-000000000009",
  conversation: "00000000-0000-4000-8000-000000000010",
  contextRecord: "00000000-0000-4000-8000-000000000011",
  annotation: "00000000-0000-4000-8000-000000000012",
  acceptedRevision: "00000000-0000-4000-8000-000000000013",
  memoryTopic: "00000000-0000-4000-8000-000000000014",
  memoryRevision: "00000000-0000-4000-8000-000000000015",
  otherBranch: "00000000-0000-4000-8000-000000000016",
  otherProject: "00000000-0000-4000-8000-000000000099",
} as const;

function conversationQuery(projectId: string = ids.project) {
  return {
    query: "conversation.read",
    scope: { kind: "project", projectId },
    cursor: null,
  } as const;
}

function conversationProjection(projectId: string = ids.project) {
  return {
    projection: "conversation",
    revision: 1,
    scope: { kind: "project", projectId },
    conversationId: ids.conversation,
    branches: [
      {
        id: ids.branch,
        parentBranchId: null,
        sourceMessageId: null,
      },
    ],
    messages: {
      items: [
        {
          id: ids.message,
          branchId: ids.branch,
          author: "user",
          body: "Review this answer.",
          contextRecordId: null,
        },
      ],
      nextCursor: null,
    },
    contextProposal: null,
  } as const;
}

function contextRecordQuery(contextRecordId: string = ids.contextRecord) {
  return {
    query: "context-record.read",
    projectId: ids.project,
    contextRecordId,
  } as const;
}

function contextRecordProjection(
  projectId: string = ids.project,
  contextRecordId: string = ids.contextRecord,
) {
  return {
    projection: "context-record",
    revision: 1,
    projectId,
    id: contextRecordId,
    responseMessageId: ids.message,
    included: [],
    excluded: [],
    completeness: "complete",
    technicalDetails: null,
  } as const;
}

function frameQuery() {
  return { query: "frame-review.read", projectId: ids.project } as const;
}

function frameProjection(projectId: string = ids.project) {
  return {
    projection: "frame-review",
    revision: 1,
    projectId,
    draftId: ids.frameDraft,
    sections: [],
    annotations: [],
    decisions: [],
  } as const;
}

function memoryQuery() {
  return {
    query: "memory-library.read",
    projectId: ids.project,
    cursor: null,
  } as const;
}

function memoryProjection(projectId: string = ids.project) {
  return {
    projection: "memory-library",
    revision: 1,
    projectId,
    items: [],
    nextCursor: null,
  } as const;
}

function validConversationProjection() {
  return {
    ...conversationProjection(),
    branches: [
      {
        id: ids.branch,
        parentBranchId: null,
        sourceMessageId: null,
      },
      {
        id: ids.otherBranch,
        parentBranchId: ids.branch,
        sourceMessageId: ids.otherMessage,
      },
    ],
    messages: {
      items: [
        {
          id: ids.message,
          branchId: ids.branch,
          author: "user",
          body: "Review this answer.",
          contextRecordId: null,
        },
      ],
      nextCursor: null,
    },
    contextProposal: {
      id: ids.contextProposal,
      items: [
        {
          itemId: "scope:item",
          source: "scope",
          label: "Project scope",
          included: true,
          trust: "trusted",
          confirmation: "not-required",
        },
      ],
    },
  } as const;
}

const workspaceIntents = [
  {
    intent: "conversation.message.submit",
    scope: {
      kind: "waypoint",
      projectId: ids.project,
      waypointId: ids.waypoint,
    },
    branchId: ids.branch,
    text: "Review this answer.",
    contextProposalId: ids.contextProposal,
    expectedProjectionRevision: 7,
  },
  {
    intent: "conversation.influence.select",
    projectId: ids.project,
    frameDraftId: ids.frameDraft,
    includedMessageIds: [ids.message],
    excludedMessageIds: [ids.otherMessage],
    expectedProjectionRevision: 7,
  },
  {
    intent: "frame-review.annotate",
    projectId: ids.project,
    frameDraftId: ids.frameDraft,
    sectionId: ids.section,
    selectedText: "selected",
    comment: "Clarify this.",
    expectedProjectionRevision: 7,
  },
  {
    intent: "frame.decision.accept",
    projectId: ids.project,
    frameDraftId: ids.frameDraft,
    sectionId: ids.section,
    expectedProjectionRevision: 7,
  },
  {
    intent: "frame.accept",
    projectId: ids.project,
    frameDraftId: ids.frameDraft,
    expectedProjectionRevision: 7,
  },
  {
    intent: "memory.proposal.review",
    projectId: ids.project,
    proposalId: ids.memoryProposal,
    decision: "accept",
    expectedProjectionRevision: 7,
  },
] as const;

describe("workspace protocol", () => {
  it("accepts branded identities and safe non-negative projection revisions", () => {
    const projectId = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";

    expect(ProjectIdSchema.parse(projectId)).toBe(projectId);
    expect(WorkspaceProjectionRevisionSchema.parse(0)).toBe(0);
    expect(WorkspaceProjectionRevisionSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );

    expect(ProjectIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(WorkspaceProjectionRevisionSchema.safeParse(-1).success).toBe(false);
    expect(WorkspaceProjectionRevisionSchema.safeParse(0.5).success).toBe(false);
    expect(WorkspaceProjectionRevisionSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(
      false,
    );
  });

  it("rejects a projection that does not match its query", () => {
    const exactPairs = [
      { query: conversationQuery(), projection: conversationProjection() },
      { query: contextRecordQuery(), projection: contextRecordProjection() },
      { query: frameQuery(), projection: frameProjection() },
      { query: memoryQuery(), projection: memoryProjection() },
    ];

    for (const pair of exactPairs) {
      const result = { status: "ready", ...pair } as const;
      expect(WorkspaceQueryResultSchema.parse(result)).toEqual(result);
    }
  });

  it("rejects mismatched query and projection identities", () => {
    const mismatchedIdentities = [
      {
        status: "ready",
        query: conversationQuery(),
        projection: conversationProjection(ids.otherProject),
      },
      {
        status: "ready",
        query: contextRecordQuery(),
        projection: contextRecordProjection(ids.otherProject),
      },
      {
        status: "ready",
        query: contextRecordQuery(),
        projection: contextRecordProjection(ids.project, ids.otherMessage),
      },
      {
        status: "ready",
        query: frameQuery(),
        projection: frameProjection(ids.otherProject),
      },
      {
        status: "ready",
        query: memoryQuery(),
        projection: memoryProjection(ids.otherProject),
      },
    ];
    for (const result of mismatchedIdentities) {
      expect(WorkspaceQueryResultSchema.safeParse(result).success).toBe(false);
    }
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: conversationQuery(),
        projection: {
          ...conversationProjection(),
          scope: {
            kind: "waypoint",
            projectId: ids.project,
            waypointId: ids.waypoint,
          },
        },
      }).success,
    ).toBe(false);

    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: conversationQuery(),
        projection: memoryProjection(),
      }).success,
    ).toBe(false);
  });

  it("keeps waypoint query pairs exact and strict", () => {
    const waypointQuery = {
      ...conversationQuery(),
      scope: { kind: "waypoint" as const, projectId: ids.project, waypointId: ids.waypoint },
    };
    const waypointProjection = {
      ...conversationProjection(),
      scope: waypointQuery.scope,
    };
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: waypointQuery,
        projection: waypointProjection,
      }).success,
    ).toBe(true);
    for (const scope of [
      { ...waypointQuery.scope, projectId: ids.otherProject },
      { ...waypointQuery.scope, waypointId: ids.otherProject },
    ]) {
      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "ready",
          query: waypointQuery,
          projection: { ...waypointProjection, scope },
        }).success,
      ).toBe(false);
    }
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: { ...memoryQuery(), fixture: true },
        projection: memoryProjection(),
      }).success,
    ).toBe(false);
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: memoryQuery(),
        projection: { ...memoryProjection(), fixture: true },
      }).success,
    ).toBe(false);
  });

  it("accepts valid conversation identities and references", () => {
    const validConversation = validConversationProjection();
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: conversationQuery(),
        projection: validConversation,
      }).success,
    ).toBe(true);
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: conversationQuery(),
        projection: {
          ...validConversation,
          messages: {
            ...validConversation.messages,
            items: [
              validConversation.messages.items[0],
              {
                ...validConversation.messages.items[0],
                id: ids.otherMessage,
                branchId: ids.otherBranch,
              },
            ],
          },
          contextProposal: {
            ...validConversation.contextProposal,
            items: [
              validConversation.contextProposal.items[0],
              {
                ...validConversation.contextProposal.items[0],
                itemId: "conversation:item",
              },
            ],
          },
        },
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate and orphaned conversation references", () => {
    const validConversation = validConversationProjection();
    const invalidConversations = [
      {
        ...validConversation,
        branches: [validConversation.branches[0], validConversation.branches[0]],
      },
      {
        ...validConversation,
        messages: {
          ...validConversation.messages,
          items: [validConversation.messages.items[0], validConversation.messages.items[0]],
        },
      },
      {
        ...validConversation,
        contextProposal: {
          ...validConversation.contextProposal,
          items: [
            validConversation.contextProposal.items[0],
            validConversation.contextProposal.items[0],
          ],
        },
      },
      {
        ...validConversation,
        branches: [
          validConversation.branches[0],
          { ...validConversation.branches[1], parentBranchId: ids.contextRecord },
        ],
      },
      {
        ...validConversation,
        branches: [
          { ...validConversation.branches[0], parentBranchId: ids.otherBranch },
          validConversation.branches[1],
        ],
      },
      {
        ...validConversation,
        messages: {
          ...validConversation.messages,
          items: [{ ...validConversation.messages.items[0], branchId: ids.contextRecord }],
        },
      },
    ];
    for (const projection of invalidConversations) {
      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "ready",
          query: conversationQuery(),
          projection,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces context-record item identity integrity", () => {
    const contextItem = {
      itemId: "context:item",
      source: "scope",
      label: "Project scope",
      trust: "trusted",
    } as const;
    const invalidContextRecords = [
      { ...contextRecordProjection(), included: [contextItem, contextItem] },
      { ...contextRecordProjection(), excluded: [contextItem, contextItem] },
      {
        ...contextRecordProjection(),
        included: [contextItem],
        excluded: [contextItem],
      },
    ];
    for (const projection of invalidContextRecords) {
      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "ready",
          query: contextRecordQuery(),
          projection,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces frame section reference integrity", () => {
    const frameSection = {
      id: ids.section,
      kind: "summary",
      title: "Summary",
      body: "Expected product behavior.",
    } as const;
    const annotation = {
      id: ids.annotation,
      sectionId: ids.section,
      selectedText: "product behavior",
      comment: "Clarify this.",
      state: "open",
    } as const;
    const decision = { sectionId: ids.section, state: "draft" } as const;
    const validFrame = {
      ...frameProjection(),
      sections: [frameSection],
      annotations: [annotation],
      decisions: [decision],
    };
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: frameQuery(),
        projection: validFrame,
      }).success,
    ).toBe(true);
    const otherSection = {
      ...frameSection,
      id: "00000000-0000-4000-8000-000000000017",
      title: "Technical plan",
    } as const;
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: frameQuery(),
        projection: {
          ...validFrame,
          sections: [frameSection, otherSection],
          annotations: [
            annotation,
            {
              ...annotation,
              id: "00000000-0000-4000-8000-000000000018",
              sectionId: otherSection.id,
            },
          ],
          decisions: [decision, { sectionId: otherSection.id, state: "draft" }],
        },
      }).success,
    ).toBe(true);
    const invalidFrames = [
      { ...validFrame, sections: [frameSection, frameSection] },
      { ...validFrame, annotations: [annotation, annotation] },
      { ...validFrame, annotations: [{ ...annotation, sectionId: ids.contextRecord }] },
      { ...validFrame, decisions: [{ ...decision, sectionId: ids.contextRecord }] },
      { ...validFrame, decisions: [decision, decision] },
    ];
    for (const projection of invalidFrames) {
      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "ready",
          query: frameQuery(),
          projection,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces memory item identity integrity", () => {
    const proposal = {
      kind: "proposal",
      id: ids.memoryProposal,
      title: "Candidate memory",
      summary: "A candidate claim.",
      provenance: "Conversation response.",
    } as const;
    const verified = {
      kind: "verified",
      topicId: ids.memoryTopic,
      revisionId: ids.memoryRevision,
      state: "accepted",
      title: "Verified memory",
      summary: "An accepted claim.",
      provenance: "Accepted evidence.",
    } as const;
    for (const items of [
      [proposal, proposal],
      [verified, verified],
    ]) {
      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "ready",
          query: memoryQuery(),
          projection: { ...memoryProjection(), items },
        }).success,
      ).toBe(false);
    }
    expect(
      WorkspaceQueryResultSchema.safeParse({
        status: "ready",
        query: memoryQuery(),
        projection: {
          ...memoryProjection(),
          items: [
            proposal,
            { ...proposal, id: "00000000-0000-4000-8000-000000000017" },
            verified,
            {
              ...verified,
              revisionId: "00000000-0000-4000-8000-000000000018",
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it("keeps unavailable distinct from broken", () => {
    const queries = [
      conversationQuery(),
      contextRecordQuery(),
      frameQuery(),
      memoryQuery(),
    ] as const;

    for (const query of queries) {
      const unavailable = {
        status: "unavailable",
        query,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: "Producer is unavailable.",
        },
      } as const;
      expect(WorkspaceQueryResultSchema.parse(unavailable)).toEqual(unavailable);

      for (const code of ["WORKSPACE_PRODUCER_FAILED", "WORKSPACE_TRANSPORT_FAILED"] as const) {
        const broken = {
          status: "broken",
          query,
          diagnostic: { code, message: "Workspace request failed." },
        } as const;
        expect(WorkspaceQueryResultSchema.parse(broken)).toEqual(broken);
        expect(
          WorkspaceQueryResultSchema.safeParse({
            ...unavailable,
            diagnostic: { ...unavailable.diagnostic, code },
          }).success,
        ).toBe(false);
      }

      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "broken",
          query,
          diagnostic: unavailable.diagnostic,
        }).success,
      ).toBe(false);
      expect(
        WorkspaceQueryResultSchema.safeParse({
          ...unavailable,
          projection: memoryProjection(),
        }).success,
      ).toBe(false);
      expect(
        WorkspaceQueryResultSchema.safeParse({
          status: "broken",
          query,
          diagnostic: {
            code: "WORKSPACE_PRODUCER_FAILED",
            message: "Producer failed.",
          },
          projection: memoryProjection(),
        }).success,
      ).toBe(false);
    }
  });

  it("parses only declared workspace intents and forwarded transport results", () => {
    for (const intent of workspaceIntents) {
      expect(WorkspaceIntentSchema.parse(intent)).toEqual(intent);
      expect(WorkspaceIntentSchema.safeParse({ ...intent, accepted: true }).success).toBe(false);
    }
    expect(
      WorkspaceIntentSchema.safeParse({
        intent: "run.start",
        projectId: ids.project,
        expectedProjectionRevision: 7,
      }).success,
    ).toBe(false);

    for (const capability of ["conversation", "frame", "memory"] as const) {
      const forwarded = { status: "forwarded", capability } as const;
      expect(WorkspaceIntentResultSchema.parse(forwarded)).toEqual(forwarded);
      for (const extra of ["applied", "receipt", "revision"] as const) {
        expect(WorkspaceIntentResultSchema.safeParse({ ...forwarded, [extra]: true }).success).toBe(
          false,
        );
      }
    }
  });

  it("requires unique disjoint influence selections", () => {
    const selection = {
      intent: "conversation.influence.select",
      projectId: ids.project,
      frameDraftId: ids.frameDraft,
      includedMessageIds: [ids.message],
      excludedMessageIds: [ids.otherMessage],
      expectedProjectionRevision: 7,
    } as const;
    expect(WorkspaceIntentSchema.parse(selection)).toEqual(selection);

    const invalidSelections = [
      {
        value: {
          ...selection,
          includedMessageIds: [ids.message, ids.message],
        },
        path: "includedMessageIds",
      },
      {
        value: {
          ...selection,
          excludedMessageIds: [ids.otherMessage, ids.otherMessage],
        },
        path: "excludedMessageIds",
      },
      {
        value: {
          ...selection,
          excludedMessageIds: [ids.message],
        },
        path: "excludedMessageIds",
      },
      {
        value: {
          ...selection,
          includedMessageIds: [ids.message, ids.otherMessage],
          excludedMessageIds: [ids.otherMessage],
        },
        path: "excludedMessageIds",
      },
    ] as const;

    for (const invalid of invalidSelections) {
      const parsed = WorkspaceIntentSchema.safeParse(invalid.value);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map((issue) => issue.path.join("."))).toContain(invalid.path);
      }
    }
  });

  it("validates revisioned workspace invalidations", () => {
    const notifications = [
      {
        capability: "conversation",
        scope: { kind: "project", projectId: ids.project },
        revision: 0,
      },
      {
        capability: "conversation",
        scope: {
          kind: "waypoint",
          projectId: ids.project,
          waypointId: ids.waypoint,
        },
        revision: 12,
      },
      {
        capability: "frame",
        scope: { kind: "project", projectId: ids.project },
        revision: 12,
      },
      {
        capability: "memory",
        scope: { kind: "project", projectId: ids.project },
        revision: 0,
      },
    ] as const;
    for (const notification of notifications) {
      expect(WorkspaceNotificationSchema.parse(notification)).toEqual(notification);
    }

    for (const capability of ["frame", "memory"] as const) {
      expect(
        WorkspaceNotificationSchema.safeParse({
          capability,
          scope: {
            kind: "waypoint",
            projectId: ids.project,
            waypointId: ids.waypoint,
          },
          revision: 12,
        }).success,
      ).toBe(false);
    }
    for (const revision of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        WorkspaceNotificationSchema.safeParse({
          capability: "conversation",
          scope: { kind: "project", projectId: ids.project },
          revision,
        }).success,
      ).toBe(false);
    }
    expect(
      WorkspaceNotificationSchema.safeParse({
        capability: "memory",
        scope: { kind: "project", projectId: ids.project },
        revision: 12,
        projection: memoryProjection(),
      }).success,
    ).toBe(false);
  });
});
