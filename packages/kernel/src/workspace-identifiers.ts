import type { Brand } from "effect";
import { Schema } from "effect";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type DomainIdentity<Name extends string> = string & Brand.Brand<Name>;

// Brand each identity at its owner, for example `.pipe(Schema.brand("ProjectId"))`.
export const DomainIdentityTextSchema = Schema.String.check(
  Schema.isPattern(UUID_PATTERN, { expected: "UUID text" }),
);

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

export const WorkspaceProjectionRevisionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("WorkspaceProjectionRevision"));
export type WorkspaceProjectionRevision = typeof WorkspaceProjectionRevisionSchema.Type;

const isDomainIdentityText = Schema.is(DomainIdentityTextSchema);

export function isDomainIdentity(value: unknown): value is DomainIdentity<string> {
  return isDomainIdentityText(value);
}

export const isWorkspaceProjectionRevision = Schema.is(WorkspaceProjectionRevisionSchema);
