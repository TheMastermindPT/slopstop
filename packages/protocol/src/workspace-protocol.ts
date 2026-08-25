import type {
  DomainIdentity,
  AcceptedRevisionId as KernelAcceptedRevisionId,
  ContextProposalId as KernelContextProposalId,
  ContextRecordId as KernelContextRecordId,
  ConversationBranchId as KernelConversationBranchId,
  ConversationId as KernelConversationId,
  ConversationMessageId as KernelConversationMessageId,
  FrameDraftId as KernelFrameDraftId,
  FrameSectionId as KernelFrameSectionId,
  MemoryProposalId as KernelMemoryProposalId,
  MemoryRevisionId as KernelMemoryRevisionId,
  MemoryTopicId as KernelMemoryTopicId,
  ProjectId as KernelProjectId,
  ReviewAnnotationId as KernelReviewAnnotationId,
  WaypointId as KernelWaypointId,
  WorkspaceProjectionRevision as KernelWorkspaceProjectionRevision,
} from "@slopstop/kernel";
import { isDomainIdentity, isWorkspaceProjectionRevision } from "@slopstop/kernel";
import { z } from "zod";

function domainIdentitySchema<T extends DomainIdentity<string>>() {
  return z.custom<T>((value) => isDomainIdentity(value));
}

export const ProjectIdSchema = domainIdentitySchema<KernelProjectId>();
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export const WaypointIdSchema = domainIdentitySchema<KernelWaypointId>();
export type WaypointId = z.infer<typeof WaypointIdSchema>;
export const ConversationIdSchema = domainIdentitySchema<KernelConversationId>();
export type ConversationId = z.infer<typeof ConversationIdSchema>;
export const ConversationBranchIdSchema = domainIdentitySchema<KernelConversationBranchId>();
export type ConversationBranchId = z.infer<typeof ConversationBranchIdSchema>;
export const ConversationMessageIdSchema = domainIdentitySchema<KernelConversationMessageId>();
export type ConversationMessageId = z.infer<typeof ConversationMessageIdSchema>;
export const ContextProposalIdSchema = domainIdentitySchema<KernelContextProposalId>();
export type ContextProposalId = z.infer<typeof ContextProposalIdSchema>;
export const ContextRecordIdSchema = domainIdentitySchema<KernelContextRecordId>();
export type ContextRecordId = z.infer<typeof ContextRecordIdSchema>;
export const FrameDraftIdSchema = domainIdentitySchema<KernelFrameDraftId>();
export type FrameDraftId = z.infer<typeof FrameDraftIdSchema>;
export const FrameSectionIdSchema = domainIdentitySchema<KernelFrameSectionId>();
export type FrameSectionId = z.infer<typeof FrameSectionIdSchema>;
export const ReviewAnnotationIdSchema = domainIdentitySchema<KernelReviewAnnotationId>();
export type ReviewAnnotationId = z.infer<typeof ReviewAnnotationIdSchema>;
export const AcceptedRevisionIdSchema = domainIdentitySchema<KernelAcceptedRevisionId>();
export type AcceptedRevisionId = z.infer<typeof AcceptedRevisionIdSchema>;
export const MemoryTopicIdSchema = domainIdentitySchema<KernelMemoryTopicId>();
export type MemoryTopicId = z.infer<typeof MemoryTopicIdSchema>;
export const MemoryRevisionIdSchema = domainIdentitySchema<KernelMemoryRevisionId>();
export type MemoryRevisionId = z.infer<typeof MemoryRevisionIdSchema>;
export const MemoryProposalIdSchema = domainIdentitySchema<KernelMemoryProposalId>();
export type MemoryProposalId = z.infer<typeof MemoryProposalIdSchema>;

export const WorkspaceProjectionRevisionSchema = z.custom<KernelWorkspaceProjectionRevision>(
  (value) => isWorkspaceProjectionRevision(value),
);
export type WorkspaceProjectionRevision = z.infer<typeof WorkspaceProjectionRevisionSchema>;

export const WorkspaceCapabilitySchema = z.enum(["conversation", "frame", "memory"]);
export type WorkspaceCapability = z.infer<typeof WorkspaceCapabilitySchema>;

export const WorkspaceScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("project"), projectId: ProjectIdSchema }),
  z.strictObject({
    kind: z.literal("waypoint"),
    projectId: ProjectIdSchema,
    waypointId: WaypointIdSchema,
  }),
]);
export type WorkspaceScope = z.infer<typeof WorkspaceScopeSchema>;

const OpaqueCursorSchema = z.string().min(1);

const ConversationReadQuerySchema = z.strictObject({
  query: z.literal("conversation.read"),
  scope: WorkspaceScopeSchema,
  cursor: OpaqueCursorSchema.nullable(),
});
const ContextRecordReadQuerySchema = z.strictObject({
  query: z.literal("context-record.read"),
  projectId: ProjectIdSchema,
  contextRecordId: ContextRecordIdSchema,
});
const FrameReviewReadQuerySchema = z.strictObject({
  query: z.literal("frame-review.read"),
  projectId: ProjectIdSchema,
});
const MemoryLibraryReadQuerySchema = z.strictObject({
  query: z.literal("memory-library.read"),
  projectId: ProjectIdSchema,
  cursor: OpaqueCursorSchema.nullable(),
});

export const WorkspaceQuerySchema = z.discriminatedUnion("query", [
  ConversationReadQuerySchema,
  ContextRecordReadQuerySchema,
  FrameReviewReadQuerySchema,
  MemoryLibraryReadQuerySchema,
]);
export type WorkspaceQuery = z.infer<typeof WorkspaceQuerySchema>;

const ContextSourceSchema = z.enum([
  "scope",
  "conversation",
  "accepted-revision",
  "verified-memory",
  "attachment",
]);
const ContextTrustSchema = z.enum(["trusted", "untrusted", "mixed"]);
const ContextProposalItemSchema = z.strictObject({
  itemId: z.string().min(1),
  source: ContextSourceSchema,
  label: z.string().min(1),
  included: z.boolean(),
  trust: ContextTrustSchema,
  confirmation: z.enum(["not-required", "required", "confirmed"]),
});
const ContextProposalSchema = z
  .strictObject({
    id: ContextProposalIdSchema,
    items: z.array(ContextProposalItemSchema),
  })
  .superRefine((proposal, context) => {
    const itemIds = new Set(proposal.items.map((item) => item.itemId));
    if (itemIds.size !== proposal.items.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Context proposal item identities must be unique.",
      });
    }
  });

const ConversationBranchSchema = z.strictObject({
  id: ConversationBranchIdSchema,
  parentBranchId: ConversationBranchIdSchema.nullable(),
  sourceMessageId: ConversationMessageIdSchema.nullable(),
});
const ConversationMessageSchema = z.strictObject({
  id: ConversationMessageIdSchema,
  branchId: ConversationBranchIdSchema,
  author: z.enum(["user", "model"]),
  body: z.string().min(1),
  contextRecordId: ContextRecordIdSchema.nullable(),
});
export const ConversationProjectionSchema = z
  .strictObject({
    projection: z.literal("conversation"),
    revision: WorkspaceProjectionRevisionSchema,
    scope: WorkspaceScopeSchema,
    conversationId: ConversationIdSchema,
    branches: z.array(ConversationBranchSchema),
    messages: z.strictObject({
      items: z.array(ConversationMessageSchema),
      nextCursor: OpaqueCursorSchema.nullable(),
    }),
    contextProposal: ContextProposalSchema.nullable(),
  })
  .superRefine((projection, context) => {
    const branchIds = new Set(projection.branches.map((branch) => branch.id));
    const messageIds = new Set(projection.messages.items.map((message) => message.id));
    if (branchIds.size !== projection.branches.length) {
      context.addIssue({
        code: "custom",
        path: ["branches"],
        message: "Conversation branch identities must be unique.",
      });
    }
    if (messageIds.size !== projection.messages.items.length) {
      context.addIssue({
        code: "custom",
        path: ["messages", "items"],
        message: "Conversation message identities must be unique.",
      });
    }
    const branches = new Map(projection.branches.map((branch) => [branch.id, branch]));
    for (const branch of projection.branches) {
      if (branch.parentBranchId !== null && !branchIds.has(branch.parentBranchId)) {
        context.addIssue({
          code: "custom",
          path: ["branches"],
          message: "Conversation branch parents must exist in the projection.",
        });
      }
      const visited = new Set<ConversationBranchId>();
      let current: ConversationBranchId | null = branch.id;
      while (current !== null) {
        if (visited.has(current)) {
          context.addIssue({
            code: "custom",
            path: ["branches"],
            message: "Conversation branch parents must be acyclic.",
          });
          break;
        }
        visited.add(current);
        current = branches.get(current)?.parentBranchId ?? null;
      }
    }
    for (const message of projection.messages.items) {
      if (!branchIds.has(message.branchId)) {
        context.addIssue({
          code: "custom",
          path: ["messages", "items"],
          message: "Conversation messages must reference a projected branch.",
        });
      }
    }
  });
export type ConversationProjection = z.infer<typeof ConversationProjectionSchema>;

const ContextRecordItemSchema = ContextProposalItemSchema.omit({
  included: true,
  confirmation: true,
});
export const ContextRecordProjectionSchema = z
  .strictObject({
    projection: z.literal("context-record"),
    revision: WorkspaceProjectionRevisionSchema,
    projectId: ProjectIdSchema,
    id: ContextRecordIdSchema,
    responseMessageId: ConversationMessageIdSchema,
    included: z.array(ContextRecordItemSchema),
    excluded: z.array(ContextRecordItemSchema),
    completeness: z.enum(["complete", "truncated"]),
    technicalDetails: z.string().min(1).nullable(),
  })
  .superRefine((projection, context) => {
    const included = new Set(projection.included.map((item) => item.itemId));
    const excluded = new Set(projection.excluded.map((item) => item.itemId));
    if (included.size !== projection.included.length) {
      context.addIssue({
        code: "custom",
        path: ["included"],
        message: "Included Context item identities must be unique.",
      });
    }
    if (excluded.size !== projection.excluded.length) {
      context.addIssue({
        code: "custom",
        path: ["excluded"],
        message: "Excluded Context item identities must be unique.",
      });
    }
    if ([...included].some((itemId) => excluded.has(itemId))) {
      context.addIssue({
        code: "custom",
        path: ["excluded"],
        message: "Included and excluded Context item identities must be disjoint.",
      });
    }
  });
export type ContextRecordProjection = z.infer<typeof ContextRecordProjectionSchema>;

const FrameSectionSchema = z.strictObject({
  id: FrameSectionIdSchema,
  kind: z.enum([
    "summary",
    "user-story",
    "prediction",
    "future-walkthrough",
    "technical-plan",
    "proposed-diff",
    "traceable-mirror",
  ]),
  title: z.string().min(1),
  body: z.string().min(1),
});
const ReviewAnnotationSchema = z.strictObject({
  id: ReviewAnnotationIdSchema,
  sectionId: FrameSectionIdSchema,
  selectedText: z.string().min(1),
  comment: z.string().min(1),
  state: z.enum(["open", "resolved"]),
});
const FrameDecisionSchema = z.discriminatedUnion("state", [
  z.strictObject({
    sectionId: FrameSectionIdSchema,
    state: z.literal("draft"),
  }),
  z.strictObject({
    sectionId: FrameSectionIdSchema,
    state: z.literal("accepted"),
    acceptedRevisionId: AcceptedRevisionIdSchema,
  }),
]);
export const FrameReviewProjectionSchema = z
  .strictObject({
    projection: z.literal("frame-review"),
    revision: WorkspaceProjectionRevisionSchema,
    projectId: ProjectIdSchema,
    draftId: FrameDraftIdSchema,
    sections: z.array(FrameSectionSchema),
    annotations: z.array(ReviewAnnotationSchema),
    decisions: z.array(FrameDecisionSchema),
  })
  .superRefine((projection, context) => {
    const sectionIds = new Set(projection.sections.map((section) => section.id));
    const annotationIds = new Set(projection.annotations.map((annotation) => annotation.id));
    const decisionSections = new Set(projection.decisions.map((decision) => decision.sectionId));
    if (sectionIds.size !== projection.sections.length) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Frame section identities must be unique.",
      });
    }
    if (annotationIds.size !== projection.annotations.length) {
      context.addIssue({
        code: "custom",
        path: ["annotations"],
        message: "Review annotation identities must be unique.",
      });
    }
    if (decisionSections.size !== projection.decisions.length) {
      context.addIssue({
        code: "custom",
        path: ["decisions"],
        message: "Frame sections may have only one decision state.",
      });
    }
    if (projection.annotations.some((annotation) => !sectionIds.has(annotation.sectionId))) {
      context.addIssue({
        code: "custom",
        path: ["annotations"],
        message: "Review annotations must reference a projected Frame section.",
      });
    }
    if (projection.decisions.some((decision) => !sectionIds.has(decision.sectionId))) {
      context.addIssue({
        code: "custom",
        path: ["decisions"],
        message: "Frame decisions must reference a projected Frame section.",
      });
    }
  });
export type FrameReviewProjection = z.infer<typeof FrameReviewProjectionSchema>;

const MemoryProjectionItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("proposal"),
    id: MemoryProposalIdSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    provenance: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal("verified"),
    topicId: MemoryTopicIdSchema,
    revisionId: MemoryRevisionIdSchema,
    state: z.enum(["accepted", "stale", "broken"]),
    title: z.string().min(1),
    summary: z.string().min(1),
    provenance: z.string().min(1),
  }),
]);
export const MemoryLibraryProjectionSchema = z
  .strictObject({
    projection: z.literal("memory-library"),
    revision: WorkspaceProjectionRevisionSchema,
    projectId: ProjectIdSchema,
    items: z.array(MemoryProjectionItemSchema),
    nextCursor: OpaqueCursorSchema.nullable(),
  })
  .superRefine((projection, context) => {
    const proposalIds = projection.items
      .filter((item) => item.kind === "proposal")
      .map((item) => item.id);
    const verifiedRevisions = projection.items
      .filter((item) => item.kind === "verified")
      .map((item) => `${item.topicId}:${item.revisionId}`);
    if (new Set(proposalIds).size !== proposalIds.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Memory proposal identities must be unique within a page.",
      });
    }
    if (new Set(verifiedRevisions).size !== verifiedRevisions.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Verified Memory revisions must be unique within a page.",
      });
    }
  });
export type MemoryLibraryProjection = z.infer<typeof MemoryLibraryProjectionSchema>;

export const WorkspaceProjectionSchema = z.discriminatedUnion("projection", [
  ConversationProjectionSchema,
  ContextRecordProjectionSchema,
  FrameReviewProjectionSchema,
  MemoryLibraryProjectionSchema,
]);
export type WorkspaceProjection = z.infer<typeof WorkspaceProjectionSchema>;

const ConversationMessageSubmitIntentSchema = z.strictObject({
  intent: z.literal("conversation.message.submit"),
  scope: WorkspaceScopeSchema,
  branchId: ConversationBranchIdSchema,
  text: z.string().min(1),
  contextProposalId: ContextProposalIdSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const ConversationInfluenceSelectIntentSchema = z.strictObject({
  intent: z.literal("conversation.influence.select"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  includedMessageIds: z.array(ConversationMessageIdSchema),
  excludedMessageIds: z.array(ConversationMessageIdSchema),
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const FrameReviewAnnotateIntentSchema = z.strictObject({
  intent: z.literal("frame-review.annotate"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  sectionId: FrameSectionIdSchema,
  selectedText: z.string().min(1),
  comment: z.string().min(1),
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const FrameDecisionAcceptIntentSchema = z.strictObject({
  intent: z.literal("frame.decision.accept"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  sectionId: FrameSectionIdSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const FrameAcceptIntentSchema = z.strictObject({
  intent: z.literal("frame.accept"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const MemoryProposalReviewIntentSchema = z.strictObject({
  intent: z.literal("memory.proposal.review"),
  projectId: ProjectIdSchema,
  proposalId: MemoryProposalIdSchema,
  decision: z.enum(["accept", "reject"]),
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});

const WorkspaceIntentVariantsSchema = z.discriminatedUnion("intent", [
  ConversationMessageSubmitIntentSchema,
  ConversationInfluenceSelectIntentSchema,
  FrameReviewAnnotateIntentSchema,
  FrameDecisionAcceptIntentSchema,
  FrameAcceptIntentSchema,
  MemoryProposalReviewIntentSchema,
]);
export const WorkspaceIntentSchema = WorkspaceIntentVariantsSchema.superRefine(
  (intent, context) => {
    if (intent.intent !== "conversation.influence.select") {
      return;
    }
    const included = new Set(intent.includedMessageIds);
    const excluded = new Set(intent.excludedMessageIds);
    if (included.size !== intent.includedMessageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["includedMessageIds"],
        message: "Included message identities must be unique.",
      });
    }
    if (excluded.size !== intent.excludedMessageIds.length) {
      context.addIssue({
        code: "custom",
        path: ["excludedMessageIds"],
        message: "Excluded message identities must be unique.",
      });
    }
    if ([...included].some((messageId) => excluded.has(messageId))) {
      context.addIssue({
        code: "custom",
        path: ["excludedMessageIds"],
        message: "Included and excluded message identities must be disjoint.",
      });
    }
  },
);
export type WorkspaceIntent = z.infer<typeof WorkspaceIntentSchema>;

export const WorkspaceDiagnosticSchema = z.strictObject({
  code: z.enum([
    "WORKSPACE_CAPABILITY_UNAVAILABLE",
    "WORKSPACE_PRODUCER_FAILED",
    "WORKSPACE_PROJECTION_INVALID",
    "WORKSPACE_TRANSPORT_FAILED",
  ]),
  message: z.string().min(1),
});
export type WorkspaceDiagnostic = z.infer<typeof WorkspaceDiagnosticSchema>;

const WorkspaceQueryUnavailableResultSchema = z.strictObject({
  status: z.literal("unavailable"),
  query: WorkspaceQuerySchema,
  diagnostic: WorkspaceDiagnosticSchema.extend({
    code: z.literal("WORKSPACE_CAPABILITY_UNAVAILABLE"),
  }),
});
const WorkspaceQueryBrokenResultSchema = z.strictObject({
  status: z.literal("broken"),
  query: WorkspaceQuerySchema,
  diagnostic: WorkspaceDiagnosticSchema.extend({
    code: z.enum([
      "WORKSPACE_PRODUCER_FAILED",
      "WORKSPACE_PROJECTION_INVALID",
      "WORKSPACE_TRANSPORT_FAILED",
    ]),
  }),
});
const WorkspaceIntentUnavailableResultSchema = z.strictObject({
  status: z.literal("unavailable"),
  capability: WorkspaceCapabilitySchema,
  diagnostic: WorkspaceDiagnosticSchema.extend({
    code: z.literal("WORKSPACE_CAPABILITY_UNAVAILABLE"),
  }),
});
const WorkspaceIntentBrokenResultSchema = z.strictObject({
  status: z.literal("broken"),
  capability: WorkspaceCapabilitySchema,
  diagnostic: WorkspaceDiagnosticSchema.extend({
    code: z.enum([
      "WORKSPACE_PRODUCER_FAILED",
      "WORKSPACE_PROJECTION_INVALID",
      "WORKSPACE_TRANSPORT_FAILED",
    ]),
  }),
});

function sameWorkspaceScope(left: WorkspaceScope, right: WorkspaceScope): boolean {
  if (left.kind === "project") {
    return right.kind === "project" && left.projectId === right.projectId;
  }
  return (
    right.kind === "waypoint" &&
    left.projectId === right.projectId &&
    left.waypointId === right.waypointId
  );
}

const projectionIdentityIssue = {
  code: "custom" as const,
  path: ["projection"],
  message: "Projection identity must match its query.",
};

const ConversationReadyQueryResultSchema = z
  .strictObject({
    status: z.literal("ready"),
    query: ConversationReadQuerySchema,
    projection: ConversationProjectionSchema,
  })
  .superRefine((result, context) => {
    if (!sameWorkspaceScope(result.query.scope, result.projection.scope)) {
      context.addIssue(projectionIdentityIssue);
    }
  });
const ContextRecordReadyQueryResultSchema = z
  .strictObject({
    status: z.literal("ready"),
    query: ContextRecordReadQuerySchema,
    projection: ContextRecordProjectionSchema,
  })
  .superRefine((result, context) => {
    if (
      result.query.projectId !== result.projection.projectId ||
      result.query.contextRecordId !== result.projection.id
    ) {
      context.addIssue(projectionIdentityIssue);
    }
  });
const FrameReviewReadyQueryResultSchema = z
  .strictObject({
    status: z.literal("ready"),
    query: FrameReviewReadQuerySchema,
    projection: FrameReviewProjectionSchema,
  })
  .superRefine((result, context) => {
    if (result.query.projectId !== result.projection.projectId) {
      context.addIssue(projectionIdentityIssue);
    }
  });
const MemoryLibraryReadyQueryResultSchema = z
  .strictObject({
    status: z.literal("ready"),
    query: MemoryLibraryReadQuerySchema,
    projection: MemoryLibraryProjectionSchema,
  })
  .superRefine((result, context) => {
    if (result.query.projectId !== result.projection.projectId) {
      context.addIssue(projectionIdentityIssue);
    }
  });

export const WorkspaceQueryResultSchema = z.union([
  ConversationReadyQueryResultSchema,
  ContextRecordReadyQueryResultSchema,
  FrameReviewReadyQueryResultSchema,
  MemoryLibraryReadyQueryResultSchema,
  WorkspaceQueryUnavailableResultSchema,
  WorkspaceQueryBrokenResultSchema,
]);
export type WorkspaceQueryResult = z.infer<typeof WorkspaceQueryResultSchema>;

export const WorkspaceIntentResultSchema = z.union([
  z.strictObject({
    status: z.literal("forwarded"),
    capability: WorkspaceCapabilitySchema,
  }),
  WorkspaceIntentUnavailableResultSchema,
  WorkspaceIntentBrokenResultSchema,
]);
export type WorkspaceIntentResult = z.infer<typeof WorkspaceIntentResultSchema>;

export const WorkspaceNotificationSchema = z
  .strictObject({
    capability: WorkspaceCapabilitySchema,
    scope: WorkspaceScopeSchema,
    revision: WorkspaceProjectionRevisionSchema,
  })
  .superRefine((notification, context) => {
    if (notification.scope.kind === "waypoint" && notification.capability !== "conversation") {
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message: "Only Conversation supports Waypoint-scoped invalidation.",
      });
    }
  });
export type WorkspaceNotification = z.infer<typeof WorkspaceNotificationSchema>;
