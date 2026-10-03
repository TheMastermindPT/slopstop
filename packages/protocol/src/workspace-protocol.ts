import {
  DomainIdentityTextSchema,
  WorkspaceProjectionRevisionSchema as KernelWorkspaceProjectionRevisionSchema,
} from "@slopstop/kernel";
import { Schema } from "effect";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { NonEmptyTextSchema, wholeUnion } from "./schema-codec.js";

export { ProjectIdSchema };
export type ProjectId = typeof ProjectIdSchema.Type;
export const WaypointIdSchema = DomainIdentityTextSchema.pipe(Schema.brand("WaypointId"));
export type WaypointId = typeof WaypointIdSchema.Type;
export const ConversationIdSchema = DomainIdentityTextSchema.pipe(Schema.brand("ConversationId"));
export type ConversationId = typeof ConversationIdSchema.Type;
export const ConversationBranchIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("ConversationBranchId"),
);
export type ConversationBranchId = typeof ConversationBranchIdSchema.Type;
export const ConversationMessageIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("ConversationMessageId"),
);
export type ConversationMessageId = typeof ConversationMessageIdSchema.Type;
export const ContextProposalIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("ContextProposalId"),
);
export type ContextProposalId = typeof ContextProposalIdSchema.Type;
export const ContextRecordIdSchema = DomainIdentityTextSchema.pipe(Schema.brand("ContextRecordId"));
export type ContextRecordId = typeof ContextRecordIdSchema.Type;
export const FrameDraftIdSchema = DomainIdentityTextSchema.pipe(Schema.brand("FrameDraftId"));
export type FrameDraftId = typeof FrameDraftIdSchema.Type;
export const FrameSectionIdSchema = DomainIdentityTextSchema.pipe(Schema.brand("FrameSectionId"));
export type FrameSectionId = typeof FrameSectionIdSchema.Type;
export const ReviewAnnotationIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("ReviewAnnotationId"),
);
export type ReviewAnnotationId = typeof ReviewAnnotationIdSchema.Type;
export const AcceptedRevisionIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("AcceptedRevisionId"),
);
export type AcceptedRevisionId = typeof AcceptedRevisionIdSchema.Type;
export const MemoryTopicIdSchema = DomainIdentityTextSchema.pipe(Schema.brand("MemoryTopicId"));
export type MemoryTopicId = typeof MemoryTopicIdSchema.Type;
export const MemoryRevisionIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("MemoryRevisionId"),
);
export type MemoryRevisionId = typeof MemoryRevisionIdSchema.Type;
export const MemoryProposalIdSchema = DomainIdentityTextSchema.pipe(
  Schema.brand("MemoryProposalId"),
);
export type MemoryProposalId = typeof MemoryProposalIdSchema.Type;

export const WorkspaceProjectionRevisionSchema = KernelWorkspaceProjectionRevisionSchema;
export type WorkspaceProjectionRevision = typeof WorkspaceProjectionRevisionSchema.Type;

export const WorkspaceCapabilitySchema = Schema.Literals(["conversation", "frame", "memory"]);
export type WorkspaceCapability = typeof WorkspaceCapabilitySchema.Type;

export const WorkspaceScopeSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("project"), projectId: ProjectIdSchema }),
  Schema.Struct({
    kind: Schema.Literal("waypoint"),
    projectId: ProjectIdSchema,
    waypointId: WaypointIdSchema,
  }),
]);
export type WorkspaceScope = typeof WorkspaceScopeSchema.Type;

const OpaqueCursorSchema = NonEmptyTextSchema;

type Issue = Readonly<{ path: readonly PropertyKey[]; message: string }>;

// Reports every violated cross-member rule at its own path.
function invariants<T>(collect: (value: T) => readonly (Issue | false)[]) {
  return Schema.makeFilter((value: T) =>
    collect(value)
      .filter((issue): issue is Issue => issue !== false)
      .map((issue) => ({ path: issue.path, issue: issue.message })),
  );
}

const unique = (values: readonly unknown[]) => new Set(values).size === values.length;

const ConversationReadQuerySchema = Schema.Struct({
  query: Schema.Literal("conversation.read"),
  scope: WorkspaceScopeSchema,
  cursor: Schema.NullOr(OpaqueCursorSchema),
});
const ContextRecordReadQuerySchema = Schema.Struct({
  query: Schema.Literal("context-record.read"),
  projectId: ProjectIdSchema,
  contextRecordId: ContextRecordIdSchema,
});
const FrameReviewReadQuerySchema = Schema.Struct({
  query: Schema.Literal("frame-review.read"),
  projectId: ProjectIdSchema,
});
const MemoryLibraryReadQuerySchema = Schema.Struct({
  query: Schema.Literal("memory-library.read"),
  projectId: ProjectIdSchema,
  cursor: Schema.NullOr(OpaqueCursorSchema),
});

export const WorkspaceQuerySchema = Schema.Union([
  ConversationReadQuerySchema,
  ContextRecordReadQuerySchema,
  FrameReviewReadQuerySchema,
  MemoryLibraryReadQuerySchema,
]);
export type WorkspaceQuery = typeof WorkspaceQuerySchema.Type;

const ContextSourceSchema = Schema.Literals([
  "scope",
  "conversation",
  "accepted-revision",
  "verified-memory",
  "attachment",
]);
const ContextTrustSchema = Schema.Literals(["trusted", "untrusted", "mixed"]);
const contextItemFields = {
  itemId: NonEmptyTextSchema,
  source: ContextSourceSchema,
  label: NonEmptyTextSchema,
  trust: ContextTrustSchema,
};
const ContextProposalItemSchema = Schema.Struct({
  ...contextItemFields,
  included: Schema.Boolean,
  confirmation: Schema.Literals(["not-required", "required", "confirmed"]),
});
const ContextProposalSchema = Schema.Struct({
  id: ContextProposalIdSchema,
  items: Schema.Array(ContextProposalItemSchema),
}).check(
  invariants((proposal) => [
    !unique(proposal.items.map((item) => item.itemId)) && {
      path: ["items"],
      message: "Context proposal item identities must be unique.",
    },
  ]),
);

const ConversationBranchSchema = Schema.Struct({
  id: ConversationBranchIdSchema,
  parentBranchId: Schema.NullOr(ConversationBranchIdSchema),
  sourceMessageId: Schema.NullOr(ConversationMessageIdSchema),
});
const ConversationMessageSchema = Schema.Struct({
  id: ConversationMessageIdSchema,
  branchId: ConversationBranchIdSchema,
  author: Schema.Literals(["user", "model"]),
  body: NonEmptyTextSchema,
  contextRecordId: Schema.NullOr(ContextRecordIdSchema),
});

type ProjectedBranch = typeof ConversationBranchSchema.Type;

function branchIssues(branches: readonly ProjectedBranch[]): Issue[] {
  const branchIds = new Set(branches.map((branch) => branch.id));
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const issues: Issue[] = [];
  for (const branch of branches) {
    if (branch.parentBranchId !== null && !branchIds.has(branch.parentBranchId)) {
      issues.push({
        path: ["branches"],
        message: "Conversation branch parents must exist in the projection.",
      });
    }
    const visited = new Set<ConversationBranchId>();
    let current: ConversationBranchId | null = branch.id;
    while (current !== null) {
      if (visited.has(current)) {
        issues.push({
          path: ["branches"],
          message: "Conversation branch parents must be acyclic.",
        });
        break;
      }
      visited.add(current);
      current = byId.get(current)?.parentBranchId ?? null;
    }
  }
  return issues;
}

export const ConversationProjectionSchema = Schema.Struct({
  projection: Schema.Literal("conversation"),
  revision: WorkspaceProjectionRevisionSchema,
  scope: WorkspaceScopeSchema,
  conversationId: ConversationIdSchema,
  branches: Schema.Array(ConversationBranchSchema),
  messages: Schema.Struct({
    items: Schema.Array(ConversationMessageSchema),
    nextCursor: Schema.NullOr(OpaqueCursorSchema),
  }),
  contextProposal: Schema.NullOr(ContextProposalSchema),
}).check(
  invariants((projection) => {
    const branchIds = new Set(projection.branches.map((branch) => branch.id));
    return [
      !unique(projection.branches.map((branch) => branch.id)) && {
        path: ["branches"],
        message: "Conversation branch identities must be unique.",
      },
      !unique(projection.messages.items.map((message) => message.id)) && {
        path: ["messages", "items"],
        message: "Conversation message identities must be unique.",
      },
      ...branchIssues(projection.branches),
      ...projection.messages.items
        .filter((message) => !branchIds.has(message.branchId))
        .map(() => ({
          path: ["messages", "items"],
          message: "Conversation messages must reference a projected branch.",
        })),
    ];
  }),
);
export type ConversationProjection = typeof ConversationProjectionSchema.Type;

const ContextRecordItemSchema = Schema.Struct(contextItemFields);
export const ContextRecordProjectionSchema = Schema.Struct({
  projection: Schema.Literal("context-record"),
  revision: WorkspaceProjectionRevisionSchema,
  projectId: ProjectIdSchema,
  id: ContextRecordIdSchema,
  responseMessageId: ConversationMessageIdSchema,
  included: Schema.Array(ContextRecordItemSchema),
  excluded: Schema.Array(ContextRecordItemSchema),
  completeness: Schema.Literals(["complete", "truncated"]),
  technicalDetails: Schema.NullOr(NonEmptyTextSchema),
}).check(
  invariants((projection) => {
    const included = projection.included.map((item) => item.itemId);
    const excluded = new Set(projection.excluded.map((item) => item.itemId));
    return [
      !unique(included) && {
        path: ["included"],
        message: "Included Context item identities must be unique.",
      },
      excluded.size !== projection.excluded.length && {
        path: ["excluded"],
        message: "Excluded Context item identities must be unique.",
      },
      included.some((itemId) => excluded.has(itemId)) && {
        path: ["excluded"],
        message: "Included and excluded Context item identities must be disjoint.",
      },
    ];
  }),
);
export type ContextRecordProjection = typeof ContextRecordProjectionSchema.Type;

const FrameSectionSchema = Schema.Struct({
  id: FrameSectionIdSchema,
  kind: Schema.Literals([
    "summary",
    "user-story",
    "prediction",
    "future-walkthrough",
    "technical-plan",
    "proposed-diff",
    "traceable-mirror",
  ]),
  title: NonEmptyTextSchema,
  body: NonEmptyTextSchema,
});
const ReviewAnnotationSchema = Schema.Struct({
  id: ReviewAnnotationIdSchema,
  sectionId: FrameSectionIdSchema,
  selectedText: NonEmptyTextSchema,
  comment: NonEmptyTextSchema,
  state: Schema.Literals(["open", "resolved"]),
});
const FrameDecisionSchema = Schema.Union([
  Schema.Struct({
    sectionId: FrameSectionIdSchema,
    state: Schema.Literal("draft"),
  }),
  Schema.Struct({
    sectionId: FrameSectionIdSchema,
    state: Schema.Literal("accepted"),
    acceptedRevisionId: AcceptedRevisionIdSchema,
  }),
]);
export const FrameReviewProjectionSchema = Schema.Struct({
  projection: Schema.Literal("frame-review"),
  revision: WorkspaceProjectionRevisionSchema,
  projectId: ProjectIdSchema,
  draftId: FrameDraftIdSchema,
  sections: Schema.Array(FrameSectionSchema),
  annotations: Schema.Array(ReviewAnnotationSchema),
  decisions: Schema.Array(FrameDecisionSchema),
}).check(
  invariants((projection) => {
    const sectionIds = new Set(projection.sections.map((section) => section.id));
    return [
      sectionIds.size !== projection.sections.length && {
        path: ["sections"],
        message: "Frame section identities must be unique.",
      },
      !unique(projection.annotations.map((annotation) => annotation.id)) && {
        path: ["annotations"],
        message: "Review annotation identities must be unique.",
      },
      !unique(projection.decisions.map((decision) => decision.sectionId)) && {
        path: ["decisions"],
        message: "Frame sections may have only one decision state.",
      },
      projection.annotations.some((annotation) => !sectionIds.has(annotation.sectionId)) && {
        path: ["annotations"],
        message: "Review annotations must reference a projected Frame section.",
      },
      projection.decisions.some((decision) => !sectionIds.has(decision.sectionId)) && {
        path: ["decisions"],
        message: "Frame decisions must reference a projected Frame section.",
      },
    ];
  }),
);
export type FrameReviewProjection = typeof FrameReviewProjectionSchema.Type;

const MemoryProjectionItemSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("proposal"),
    id: MemoryProposalIdSchema,
    title: NonEmptyTextSchema,
    summary: NonEmptyTextSchema,
    provenance: NonEmptyTextSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("verified"),
    topicId: MemoryTopicIdSchema,
    revisionId: MemoryRevisionIdSchema,
    state: Schema.Literals(["accepted", "stale", "broken"]),
    title: NonEmptyTextSchema,
    summary: NonEmptyTextSchema,
    provenance: NonEmptyTextSchema,
  }),
]);
export const MemoryLibraryProjectionSchema = Schema.Struct({
  projection: Schema.Literal("memory-library"),
  revision: WorkspaceProjectionRevisionSchema,
  projectId: ProjectIdSchema,
  items: Schema.Array(MemoryProjectionItemSchema),
  nextCursor: Schema.NullOr(OpaqueCursorSchema),
}).check(
  invariants((projection) => [
    !unique(projection.items.flatMap((item) => (item.kind === "proposal" ? [item.id] : []))) && {
      path: ["items"],
      message: "Memory proposal identities must be unique within a page.",
    },
    !unique(
      projection.items.flatMap((item) =>
        item.kind === "verified" ? [`${item.topicId}:${item.revisionId}`] : [],
      ),
    ) && {
      path: ["items"],
      message: "Verified Memory revisions must be unique within a page.",
    },
  ]),
);
export type MemoryLibraryProjection = typeof MemoryLibraryProjectionSchema.Type;

export const WorkspaceProjectionSchema = Schema.Union([
  ConversationProjectionSchema,
  ContextRecordProjectionSchema,
  FrameReviewProjectionSchema,
  MemoryLibraryProjectionSchema,
]);
export type WorkspaceProjection = typeof WorkspaceProjectionSchema.Type;

const ConversationMessageSubmitIntentSchema = Schema.Struct({
  intent: Schema.Literal("conversation.message.submit"),
  scope: WorkspaceScopeSchema,
  branchId: ConversationBranchIdSchema,
  text: NonEmptyTextSchema,
  contextProposalId: ContextProposalIdSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const ConversationInfluenceSelectIntentSchema = Schema.Struct({
  intent: Schema.Literal("conversation.influence.select"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  includedMessageIds: Schema.Array(ConversationMessageIdSchema),
  excludedMessageIds: Schema.Array(ConversationMessageIdSchema),
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const FrameReviewAnnotateIntentSchema = Schema.Struct({
  intent: Schema.Literal("frame-review.annotate"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  sectionId: FrameSectionIdSchema,
  selectedText: NonEmptyTextSchema,
  comment: NonEmptyTextSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const FrameDecisionAcceptIntentSchema = Schema.Struct({
  intent: Schema.Literal("frame.decision.accept"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  sectionId: FrameSectionIdSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const FrameAcceptIntentSchema = Schema.Struct({
  intent: Schema.Literal("frame.accept"),
  projectId: ProjectIdSchema,
  frameDraftId: FrameDraftIdSchema,
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});
const MemoryProposalReviewIntentSchema = Schema.Struct({
  intent: Schema.Literal("memory.proposal.review"),
  projectId: ProjectIdSchema,
  proposalId: MemoryProposalIdSchema,
  decision: Schema.Literals(["accept", "reject"]),
  expectedProjectionRevision: WorkspaceProjectionRevisionSchema,
});

export const WorkspaceIntentSchema = Schema.Union([
  ConversationMessageSubmitIntentSchema,
  ConversationInfluenceSelectIntentSchema,
  FrameReviewAnnotateIntentSchema,
  FrameDecisionAcceptIntentSchema,
  FrameAcceptIntentSchema,
  MemoryProposalReviewIntentSchema,
]).check(
  invariants((intent) => {
    if (intent.intent !== "conversation.influence.select") return [];
    const excluded = new Set(intent.excludedMessageIds);
    return [
      !unique(intent.includedMessageIds) && {
        path: ["includedMessageIds"],
        message: "Included message identities must be unique.",
      },
      excluded.size !== intent.excludedMessageIds.length && {
        path: ["excludedMessageIds"],
        message: "Excluded message identities must be unique.",
      },
      intent.includedMessageIds.some((messageId) => excluded.has(messageId)) && {
        path: ["excludedMessageIds"],
        message: "Included and excluded message identities must be disjoint.",
      },
    ];
  }),
);
export type WorkspaceIntent = typeof WorkspaceIntentSchema.Type;

const workspaceFailureCodes = [
  "WORKSPACE_PRODUCER_FAILED",
  "WORKSPACE_PROJECTION_INVALID",
  "WORKSPACE_TRANSPORT_FAILED",
] as const;

export const WorkspaceDiagnosticSchema = Schema.Struct({
  code: Schema.Literals(["WORKSPACE_CAPABILITY_UNAVAILABLE", ...workspaceFailureCodes]),
  message: NonEmptyTextSchema,
});
export type WorkspaceDiagnostic = typeof WorkspaceDiagnosticSchema.Type;

const UnavailableDiagnosticSchema = Schema.Struct({
  code: Schema.Literal("WORKSPACE_CAPABILITY_UNAVAILABLE"),
  message: NonEmptyTextSchema,
});
const BrokenDiagnosticSchema = Schema.Struct({
  code: Schema.Literals(workspaceFailureCodes),
  message: NonEmptyTextSchema,
});

const WorkspaceQueryUnavailableResultSchema = Schema.Struct({
  status: Schema.Literal("unavailable"),
  query: WorkspaceQuerySchema,
  diagnostic: UnavailableDiagnosticSchema,
});
const WorkspaceQueryBrokenResultSchema = Schema.Struct({
  status: Schema.Literal("broken"),
  query: WorkspaceQuerySchema,
  diagnostic: BrokenDiagnosticSchema,
});
const WorkspaceIntentUnavailableResultSchema = Schema.Struct({
  status: Schema.Literal("unavailable"),
  capability: WorkspaceCapabilitySchema,
  diagnostic: UnavailableDiagnosticSchema,
});
const WorkspaceIntentBrokenResultSchema = Schema.Struct({
  status: Schema.Literal("broken"),
  capability: WorkspaceCapabilitySchema,
  diagnostic: BrokenDiagnosticSchema,
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

function projectionIdentity<T>(matches: (result: T) => boolean) {
  return Schema.makeFilter(
    (result: T) =>
      matches(result) || {
        path: ["projection"],
        issue: "Projection identity must match its query.",
      },
  );
}

const ConversationReadyQueryResultSchema = Schema.Struct({
  status: Schema.Literal("ready"),
  query: ConversationReadQuerySchema,
  projection: ConversationProjectionSchema,
}).check(
  projectionIdentity((result) => sameWorkspaceScope(result.query.scope, result.projection.scope)),
);
const ContextRecordReadyQueryResultSchema = Schema.Struct({
  status: Schema.Literal("ready"),
  query: ContextRecordReadQuerySchema,
  projection: ContextRecordProjectionSchema,
}).check(
  projectionIdentity(
    (result) =>
      result.query.projectId === result.projection.projectId &&
      result.query.contextRecordId === result.projection.id,
  ),
);
const FrameReviewReadyQueryResultSchema = Schema.Struct({
  status: Schema.Literal("ready"),
  query: FrameReviewReadQuerySchema,
  projection: FrameReviewProjectionSchema,
}).check(projectionIdentity((result) => result.query.projectId === result.projection.projectId));
const MemoryLibraryReadyQueryResultSchema = Schema.Struct({
  status: Schema.Literal("ready"),
  query: MemoryLibraryReadQuerySchema,
  projection: MemoryLibraryProjectionSchema,
}).check(projectionIdentity((result) => result.query.projectId === result.projection.projectId));

export const WorkspaceQueryResultSchema = wholeUnion([
  ConversationReadyQueryResultSchema,
  ContextRecordReadyQueryResultSchema,
  FrameReviewReadyQueryResultSchema,
  MemoryLibraryReadyQueryResultSchema,
  WorkspaceQueryUnavailableResultSchema,
  WorkspaceQueryBrokenResultSchema,
]);
export type WorkspaceQueryResult = typeof WorkspaceQueryResultSchema.Type;

export const WorkspaceIntentResultSchema = wholeUnion([
  Schema.Struct({
    status: Schema.Literal("forwarded"),
    capability: WorkspaceCapabilitySchema,
  }),
  WorkspaceIntentUnavailableResultSchema,
  WorkspaceIntentBrokenResultSchema,
]);
export type WorkspaceIntentResult = typeof WorkspaceIntentResultSchema.Type;

export const WorkspaceNotificationSchema = Schema.Struct({
  capability: WorkspaceCapabilitySchema,
  scope: WorkspaceScopeSchema,
  revision: WorkspaceProjectionRevisionSchema,
}).check(
  Schema.makeFilter(
    (notification) =>
      notification.scope.kind !== "waypoint" ||
      notification.capability === "conversation" || {
        path: ["scope"],
        issue: "Only Conversation supports Waypoint-scoped invalidation.",
      },
  ),
);
export type WorkspaceNotification = typeof WorkspaceNotificationSchema.Type;
