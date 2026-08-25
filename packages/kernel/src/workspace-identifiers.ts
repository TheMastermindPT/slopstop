const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

declare const domainIdentityBrand: unique symbol;
declare const projectionRevisionBrand: unique symbol;

export type DomainIdentity<Name extends string> = string & {
  readonly [domainIdentityBrand]: Name;
};

export type ProjectId = DomainIdentity<"ProjectId">;
export type WaypointId = DomainIdentity<"WaypointId">;
export type ConversationId = DomainIdentity<"ConversationId">;
export type ConversationBranchId = DomainIdentity<"ConversationBranchId">;
export type ConversationMessageId = DomainIdentity<"ConversationMessageId">;
export type ContextProposalId = DomainIdentity<"ContextProposalId">;
export type ContextRecordId = DomainIdentity<"ContextRecordId">;
export type FrameDraftId = DomainIdentity<"FrameDraftId">;
export type FrameSectionId = DomainIdentity<"FrameSectionId">;
export type ReviewAnnotationId = DomainIdentity<"ReviewAnnotationId">;
export type AcceptedRevisionId = DomainIdentity<"AcceptedRevisionId">;
export type MemoryTopicId = DomainIdentity<"MemoryTopicId">;
export type MemoryRevisionId = DomainIdentity<"MemoryRevisionId">;
export type MemoryProposalId = DomainIdentity<"MemoryProposalId">;

export type WorkspaceProjectionRevision = number & {
  readonly [projectionRevisionBrand]: "WorkspaceProjectionRevision";
};

export function isDomainIdentity(value: unknown): value is DomainIdentity<string> {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isWorkspaceProjectionRevision(
  value: unknown,
): value is WorkspaceProjectionRevision {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
