---
date: 2026-08-25T14:53:19+0100
author: Pedro Mesquita
commit: acf9c8b
branch: main
repository: slopstop
topic: "Workspace production boundary tracer bullet"
tags: [plan, workspace, protocol, harness, electron, conversation, frame, memory]
status: complete
parent: .rpiv/artifacts/research/2026-08-25_14-22-52_workspace-production-boundaries.md
phase_count: 5
unresolved_phase_count: 0
last_updated: 2026-08-25T21:25:52+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Record final mutation, CodeScene, local quality-gate, and unavailable Sonar evidence."
content_hash: dbcbb0ed89447851cd2ca6236ac27033672a54698ce09dc8e6a5f93ce5019cec
---

# Workspace Production Boundary Tracer Bullet Implementation Plan

## Overview

Build the first truthful production path for Conversation, Frame/Review/Context, and Memory-library capabilities without pretending their missing producers exist. Kernel-owned durable identities and protocol-owned Zod contracts cross a harness application seam, a validated `HarnessSession`, a main-process request bridge, and a three-operation preload interface; production returns explicit `unavailable` or `broken` states until owner adapters arrive.

The plan deliberately stops before final visual integration. Issue #45 remains the gate for changing the production renderer's accepted workspace presentation, while this tracer bullet proves the trust chain and public browser seam in packaged Electron.

## Requirements

- Preserve separate canonical, Execution, and Conversation graphs.
- Keep direct-response Context proposals and records owned by Conversation; keep Worker-attempt context under a separate Execution contract.
- Keep recoverable Review annotations and proposed diffs in non-canonical Frame draft history until an explicit typed command creates an Accepted revision.
- Expose only closed, schema-validated workspace query, intent, and notification unions across process boundaries.
- Keep `HarnessSupervisor` responsible for lifecycle and health rather than domain coordination.
- Distinguish `ready`, `unavailable`, and `broken`; never report a missing or failed producer as clean data.
- Use revisioned invalidation notifications rather than sending domain events or complete workspace snapshots to the renderer.
- Name but do not invent internal payloads for Execution, Evidence, repository/Git, Integration review, Board, and Verified Memory producers.
- Keep fixture imports and prototype state out of production contracts.
- Prove each behavior through public seams, including a packaged Electron boundary check.
- Defer final production-renderer presentation until issue #45 is accepted.

## Current State Analysis

The current protocol is a bootstrap-only handshake. The harness runtime validates that handshake, and the desktop supervisor owns process health, retry, timeout, and restart. Main and preload revalidate a narrow `HarnessStatus` contract before the renderer displays it. No production workspace producer, query, intent, projection, or notification exists.

The accepted prototype contains the required interactions, but all Conversation, Context, Review, Frame, Run, diff, and Memory effects are local fixture-backed React state. Those files remain interaction Evidence only.

### Key Discoveries

- `packages/kernel/src/index.ts:1` is empty, despite ADR 0002 assigning durable domain identities to kernel.
- `packages/protocol/src/protocol.ts:17-73` contains only handshake, ready, and failure message variants.
- `apps/harness/src/harness-runtime.ts:9-58` supplies a good transport seam but no application dispatch.
- `apps/desktop/src/main/harness-supervisor.ts:201-267` privately owns the utility-process port, so a separate session seam is required before product requests can cross it cleanly.
- `apps/desktop/src/shared/desktop-api.ts:3-13` and `apps/desktop/src/preload/preload.ts:5-25` establish the pattern for a small browser interface with repeated validation.
- `apps/desktop/src/renderer/app.tsx:68-89` can allow an older initial read to overwrite a newer subscription update; revisioned invalidation must prevent this pattern in the workspace bridge.
- `apps/desktop/tests/e2e/shell.test.ts:40-60` is the strongest current proof of the real Electron security boundary.
- `apps/desktop/src/renderer/prototype/prototype-app.tsx:1782-1816` is explicitly local state and must not become a producer contract.
- `CONTEXT.md:67-69` now fixes Frame draft history as the owner of pre-acceptance Review material.
- `CONTEXT.md:153-155` now fixes separate Conversation and Execution ownership for Context proposals and records.

## Desired End State

The renderer receives one narrow, browser-safe interface:

```ts
const result = await window.slopstop.queryWorkspace({
  query: "conversation.read",
  scope: { kind: "project", projectId },
  cursor: null,
});
```

Callers must handle truthful capability state rather than assuming data exists:

```ts
switch (result.status) {
  case "ready":
    renderProjection(result.projection);
    break;
  case "unavailable":
  case "broken":
    renderDiagnostic(result.diagnostic);
}
```

Live data uses revisioned invalidation, followed by a fresh scoped query:

```ts
return window.slopstop.subscribeWorkspaceNotifications((notification) => {
  workspaceStore.invalidate(notification.scope, notification.revision);
});
```

The production harness initially wires explicit unavailable owner ports. Tests inject ready, unavailable, and throwing ports through the same public harness application interface. Later producer programs replace those ports without changing Electron capabilities or moving ownership into the bridge.

## What We're NOT Doing

- No physical database schema, migrations, backup, restore, import, deletion, or retention behavior from issues #40/#41.
- No Project-writer persistence adapter, Windows named-pipe ACL/DACL implementation, or lease manager.
- No model-provider call, AgentRuntime, Worker, Run, Process job, or Execution producer.
- No repository reads, Git operations, Worker delta, Candidate delta, Integration, or source-attachment content producer.
- No Evidence producer, Evidence authority, Validator, Finding, or Integration-review payload.
- No Board or durable Attention-index implementation from issue #36.
- No Verified Memory storage or acceptance producer; only its minimum user-facing projection and missing-capability state cross this tracer bullet.
- No generic IPC invoke/send function exposed to the renderer.
- No domain-event reduction or canonical-state reconstruction in the renderer.
- No fixture imports, fixture fallback, or in-memory pseudo-production store.
- No final workspace UI or visual identity change before issue #45 acceptance.
- No arbitrary pagination limit, timeout, retention period, or payload-size default without measured Evidence.

## Decisions

### TDD Standard (standing)

Every behavior-changing phase MUST carry a `### Test Contract:` with at least one **Behavior** whose **Oracle** pins exact input -> expected-output values (the strongest checkable oracle; any weakening justified inline) and an **Expected red** reason. Non-behavioral phases/items carry explicit `TDD-exempt` markers with reasons. Recorded as a commitment so slice-verifier's commitments audit flags violations per slice.

### Domain Identity Ownership

Kernel owns opaque branded UUID identities and non-negative revision values. Protocol depends on kernel and owns the versioned Zod schemas that validate those values at process boundaries (`docs/adr/0002-project-canonical-state.md:17-20`, `packages/kernel/src/index.ts:1`, `packages/protocol/package.json:13-15`).

### Closed Three-Operation Browser Interface

The browser interface adds `queryWorkspace`, `submitWorkspaceIntent`, and `subscribeWorkspaceNotifications`. Each accepts or returns a closed discriminated union; none accepts raw channels, arbitrary method names, or unvalidated payloads (`apps/desktop/src/shared/desktop-api.ts:3-13`, `packages/protocol/src/protocol.ts:17-73`).

### Protocol Version 2

Activating workspace commands and events in Phase 2 changes the accepted process vocabulary, so both packaged sides move together from protocol version 1 to 2 only when the harness can dispatch every new command truthfully. Version 1 then fails explicitly as unsupported rather than being misreported as a malformed version-2 workspace message.

### Capability-Scoped Projections

Conversation, Frame/Review/Context, and Memory remain separate query variants and projection payloads. A single query operation reduces bridge surface area without creating a single state model or whole-workspace snapshot.

### Truthful Capability State

Every query result is `ready`, `unavailable`, or `broken`. Missing producer wiring yields `unavailable`; transport, schema, invocation, or producer failure yields `broken` with source-specific diagnostics. The implementation follows `.rpiv/decisions/degrade-distinguishes-broken.md` and never falls back to fixtures or empty success.

### Owner-Specific Context Records

Conversation owns direct-response Context proposals and records. Execution performs the provider effect and will separately own future Worker-attempt records under the same provenance invariant, without sharing one state contract (`CONTEXT.md:153-155`).

### Frame Draft History

Recoverable pre-acceptance understanding, plans, Review annotations, proposed diffs, and Traceable Mirror coverage belong to Frame draft history. Natural Decision checkpoints submit typed canonical commands; accepted history is superseded by new revisions, never rewritten (`CONTEXT.md:67-69`, `CONTEXT.md:102-104`).

### Revisioned Invalidation

Workspace notifications identify capability, scope, and non-negative projection revision. They do not carry whole projections or domain events. Consumers re-query and reject data older than the last observed revision, avoiding the initial-read/subscription race visible in `apps/desktop/src/renderer/app.tsx:68-89`.

### Harness Session Separation

A new `HarnessSession` owns validated message send/receive over the active process port. `HarnessSupervisor` composes it while retaining process lifecycle, health, timeout, retry, and recovery; workspace dispatch does not enter the supervisor (`apps/desktop/src/main/harness-supervisor.ts:103-267`).

### Truthful Tracer Bullet

The production process uses unavailable owner ports until real producer contracts and adapters exist. Tests may inject deterministic fakes through public ports, but production contains no in-memory pseudo-store and no fixture fallback.

### Visual Acceptance Gate

This plan exposes and proves the browser-safe interface without replacing the current production renderer. Final Conversation, Review, Context, and Memory presentation remains blocked on explicit #45 acceptance.

### Packaged Boundary Proof

The fused packaged executable cannot be attached to Playwright's Electron inspector without weakening `EnableNodeCliInspectArguments`. Interactive E2E therefore stays on built Electron, while the existing inspector-free package smoke runs one fixed, schema-backed renderer check and exits nonzero unless the real ASAR/preload/IPC/harness chain satisfies the exact boundary contract (`apps/desktop/forge.config.ts:45-53`, `apps/desktop/tests/e2e/package-smoke.mjs:21-51`).

## Phase 1: Workspace Protocol Foundation

### Overview

Establish kernel-owned identity primitives and protocol-owned workspace query, intent, result, projection, and invalidation schemas. Foundation phase; depends on nothing.

### Changes Required:

#### 1. `packages/kernel/src/workspace-identifiers.ts`

**File**: `packages/kernel/src/workspace-identifiers.ts`  
**Changes**: NEW — opaque workspace identities and non-negative projection revision guards.

```ts
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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
```

#### 2. `packages/kernel/src/index.ts`

**File**: `packages/kernel/src/index.ts`  
**Changes**: MODIFY — export the new domain identity interface.

```ts
export type {
  AcceptedRevisionId,
  ContextProposalId,
  ContextRecordId,
  ConversationBranchId,
  ConversationId,
  ConversationMessageId,
  DomainIdentity,
  FrameDraftId,
  FrameSectionId,
  MemoryProposalId,
  MemoryRevisionId,
  MemoryTopicId,
  ProjectId,
  ReviewAnnotationId,
  WaypointId,
  WorkspaceProjectionRevision,
} from "./workspace-identifiers.js";
export {
  isDomainIdentity,
  isWorkspaceProjectionRevision,
} from "./workspace-identifiers.js";
```

#### 3. `packages/protocol/package.json`

**File**: `packages/protocol/package.json`  
**Changes**: MODIFY — declare the kernel workspace dependency.

```json
"dependencies": {
  "@slopstop/kernel": "workspace:*",
  "zod": "catalog:"
}
```

#### 4. `pnpm-lock.yaml`

**File**: `pnpm-lock.yaml`  
**Changes**: MODIFY — record the generated protocol-to-kernel workspace dependency.

```yaml
packages/protocol:
  dependencies:
    '@slopstop/kernel':
      specifier: workspace:*
      version: link:../kernel
    zod:
      specifier: 'catalog:'
      version: 4.4.3
```

#### 5. `packages/protocol/src/workspace-protocol.ts`

**File**: `packages/protocol/src/workspace-protocol.ts`  
**Changes**: NEW — strict workspace query, intent, projection-state, result, and invalidation schemas.

```ts
import type {
  AcceptedRevisionId as KernelAcceptedRevisionId,
  ContextProposalId as KernelContextProposalId,
  ContextRecordId as KernelContextRecordId,
  ConversationBranchId as KernelConversationBranchId,
  ConversationId as KernelConversationId,
  ConversationMessageId as KernelConversationMessageId,
  DomainIdentity,
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
import {
  isDomainIdentity,
  isWorkspaceProjectionRevision,
} from "@slopstop/kernel";
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
      const visited = new Set<string>();
      let current: string | null = branch.id;
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

// A branch source message may sit outside the current cursor page; only its identity is validated.

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
    const annotationIds = new Set(
      projection.annotations.map((annotation) => annotation.id),
    );
    const decisionSections = new Set(
      projection.decisions.map((decision) => decision.sectionId),
    );
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

export const WorkspaceQueryResultSchema = z.union(
  [
    ConversationReadyQueryResultSchema,
    ContextRecordReadyQueryResultSchema,
    FrameReviewReadyQueryResultSchema,
    MemoryLibraryReadyQueryResultSchema,
    WorkspaceQueryUnavailableResultSchema,
    WorkspaceQueryBrokenResultSchema,
  ],
);
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
```

#### 6. `packages/protocol/src/index.ts`

**File**: `packages/protocol/src/index.ts`  
**Changes**: MODIFY — publish workspace contracts through declared package exports.

```ts
export type {
  AcceptedRevisionId,
  ContextProposalId,
  ContextRecordId,
  ContextRecordProjection,
  ConversationBranchId,
  ConversationId,
  ConversationMessageId,
  ConversationProjection,
  FrameDraftId,
  FrameReviewProjection,
  FrameSectionId,
  MemoryLibraryProjection,
  MemoryProposalId,
  MemoryRevisionId,
  MemoryTopicId,
  ProjectId,
  ReviewAnnotationId,
  WaypointId,
  WorkspaceCapability,
  WorkspaceDiagnostic,
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceProjection,
  WorkspaceProjectionRevision,
  WorkspaceQuery,
  WorkspaceQueryResult,
  WorkspaceScope,
} from "./workspace-protocol.js";
export {
  AcceptedRevisionIdSchema,
  ContextProposalIdSchema,
  ContextRecordIdSchema,
  ContextRecordProjectionSchema,
  ConversationBranchIdSchema,
  ConversationIdSchema,
  ConversationMessageIdSchema,
  ConversationProjectionSchema,
  FrameDraftIdSchema,
  FrameReviewProjectionSchema,
  FrameSectionIdSchema,
  MemoryLibraryProjectionSchema,
  MemoryProposalIdSchema,
  MemoryRevisionIdSchema,
  MemoryTopicIdSchema,
  ProjectIdSchema,
  ReviewAnnotationIdSchema,
  WaypointIdSchema,
  WorkspaceCapabilitySchema,
  WorkspaceDiagnosticSchema,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceProjectionRevisionSchema,
  WorkspaceProjectionSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
  WorkspaceScopeSchema,
} from "./workspace-protocol.js";

export type {
  DesktopMessage,
  HarnessFailureCode,
  HarnessMessage,
  HarnessStatus,
  MessageId,
  ProtocolParseResult,
  RetryHarnessResult,
} from "./protocol.js";
export {
  createFailureEvent,
  createHandshakeCommand,
  createReadyEvent,
  DesktopMessageSchema,
  HarnessBootstrapSchema,
  HarnessDiagnosticCodeSchema,
  HarnessFailureCodeSchema,
  HarnessMessageSchema,
  HarnessStatusSchema,
  MessageIdSchema,
  parseDesktopMessage,
  parseHarnessMessage,
  protocolVersion,
  RetryHarnessResultSchema,
  readMessageId,
} from "./protocol.js";
```

### Test Contract:

- **Behavior**: Domain UUID and projection-revision schemas accept only valid boundary values.
  - Test: `accepts branded identities and safe non-negative projection revisions` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: RFC UUID `018f47a3-4e3d-7d2b-9c41-7df4605c0a11` parses unchanged as `ProjectId`; revision `0` and `9007199254740991` parse unchanged; UUID `not-a-uuid`, revision `-1`, `0.5`, and `9007199254740992` each fail parsing.
  - Expected red: workspace identity and revision schemas do not exist before Phase 1.
- **Behavior**: Ready query results preserve query-to-projection pairing and strict object shape.
  - Test: `rejects a projection that does not match its query` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: using project `00000000-0000-4000-8000-000000000001`, each exact pair parses unchanged: Conversation project scope ↔ Conversation project scope, Context-record project/id ↔ Context-record project/id, Frame project ↔ Frame project, and Memory project ↔ Memory project; changing only the projection project to `00000000-0000-4000-8000-000000000099`, changing only the Context-record ID, replacing any projection family with another, or adding `fixture: true` to query/projection fails.
  - Expected red: no workspace query/result union exists before Phase 1.
- **Behavior**: Ready projections reject incoherent internal references and duplicate identities.
  - Test: `enforces projection identity and reference integrity` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: a Conversation projection with unique acyclic branches and messages referencing present branches parses even when a branch source message is outside the current cursor page; duplicate branch/message IDs, duplicate Context-proposal item IDs, absent parent, parent cycle, or message with absent branch each fail; Context-record included/excluded IDs must each be unique and disjoint; Frame sections/annotations must have unique IDs, each annotation/decision must reference a present section, and each section has at most one decision state; a Memory page rejects duplicate proposal IDs and duplicate verified `(topicId, revisionId)` pairs.
  - Expected red: strict object shape alone accepts duplicate and orphaned projection records.
- **Behavior**: Missing capability and failed producer remain distinguishable for every query family.
  - Test: `keeps unavailable distinct from broken` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: `conversation.read`, `context-record.read`, `frame-review.read`, and `memory-library.read` each parse unchanged under `status: "unavailable"` with code `WORKSPACE_CAPABILITY_UNAVAILABLE`, and under `status: "broken"` with `WORKSPACE_PRODUCER_FAILED` or `WORKSPACE_TRANSPORT_FAILED`; for every query, using either broken code under unavailable or `WORKSPACE_CAPABILITY_UNAVAILABLE` under broken fails; neither status accepts a `projection` field.
  - Expected red: the status union and stable diagnostic vocabulary do not exist before Phase 1.
- **Behavior**: Workspace intents are closed, stale-aware, and never imply a canonical result.
  - Test: `parses only declared workspace intents and forwarded transport results` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: with project `...0001`, Waypoint `...0002`, branch `...0003`, Context proposal `...0004`, Frame draft `...0005`, section `...0006`, messages `...0007/...0008`, and Memory proposal `...0009` as full valid UUIDs, all six exact variants parse unchanged at revision `7`: submit text `Review this answer.`, influence include `...0007`/exclude `...0008`, annotation selection `selected`/comment `Clarify this.`, decision accept, Frame accept, and Memory decision `accept`; unknown `run.start` and adding `accepted: true` to any variant fail; forwarded results for `conversation`, `frame`, and `memory` parse unchanged and expose no `applied`, `receipt`, or revision field.
  - Expected red: no workspace intent or submission-result contract exists before Phase 1.
- **Behavior**: Conversation influence selection cannot contain duplicate or contradictory message identities.
  - Test: `requires unique disjoint influence selections` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: included `[...0007]` and excluded `[...0008]` parse unchanged; included `[...0007, ...0007]`, excluded `[...0008, ...0008]`, and included/excluded both containing `...0007` each fail on the corresponding list path.
  - Expected red: a plain pair of arrays accepts duplicate and contradictory influence choices.
- **Behavior**: Projection invalidations accept zero/new revisions and reject unsafe ordering values.
  - Test: `validates revisioned workspace invalidations` -> `packages/protocol/src/workspace-protocol.test.ts`
  - Oracle: Conversation project and Waypoint notifications plus Frame/Memory project notifications parse unchanged at revisions `0` and `12`; Frame or Memory with Waypoint scope, revisions `-1`, `1.5`, and `9007199254740992`, and an extra `projection` field each fail.
  - Expected red: revisioned invalidation schema does not exist before Phase 1.

### Success Criteria:

#### Automated Verification:

- [x] Focused workspace and existing protocol tests pass: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts packages/protocol/src/protocol.test.ts`
- [x] Kernel type checking passes: `pnpm --filter @slopstop/kernel typecheck`
- [x] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`
- [x] The generated lockfile is synchronized: `pnpm install --lockfile-only`
- [x] Changed files pass Biome: `pnpm exec biome check packages/kernel/src packages/protocol/src packages/protocol/package.json`
- [x] Workspace dependency direction remains valid: `pnpm check:boundaries`

#### Manual Verification:

- [x] Public exports expose no fixture type, generic raw payload, or producer-internal state.
- [x] `protocolVersion` remains `1`, and the live Desktop/Harness message unions accept no workspace variant before Phase 2.
- [x] Ready projections are user-facing views only; no schema claims to be a persistence, Execution, Evidence, or Verified Memory producer record.

## Phase 2: Harness Capability Dispatch

### Overview

Activate protocol version 2 atomically with a harness application module that dispatches every new workspace command through owner-specific ports and explicit ready/unavailable/broken results. Depends on Phase 1.

### Changes Required:

#### 1. `packages/protocol/src/protocol.ts`

**File**: `packages/protocol/src/protocol.ts`  
**Changes**: MODIFY — activate protocol version 2 and add workspace command/result/notification envelopes and factories.

```ts
import type {
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "./workspace-protocol.js";
import {
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "./workspace-protocol.js";

export const protocolVersion = 2 as const;

const DesktopCommandMetadataSchema = {
  protocolVersion: z.literal(protocolVersion),
  messageType: z.literal("command"),
  messageId: MessageIdSchema,
  sentAt: TimestampSchema,
} as const;

const HandshakeCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("system.handshake"),
  payload: z.strictObject({ desktopVersion: z.string().min(1) }),
});
const WorkspaceQueryCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("workspace.query"),
  payload: WorkspaceQuerySchema,
});
const WorkspaceIntentCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("workspace.intent"),
  payload: WorkspaceIntentSchema,
});

export const DesktopMessageSchema = z.discriminatedUnion("command", [
  HandshakeCommandSchema,
  WorkspaceQueryCommandSchema,
  WorkspaceIntentCommandSchema,
]);

const WorkspaceQueryResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("workspace.query.result"),
  payload: WorkspaceQueryResultSchema,
});
const WorkspaceIntentResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("workspace.intent.result"),
  payload: WorkspaceIntentResultSchema,
});
const WorkspaceProjectionInvalidatedEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("workspace.projection.invalidated"),
  payload: WorkspaceNotificationSchema,
});

export const HarnessMessageSchema = z.discriminatedUnion("event", [
  ReadyEventSchema,
  FailureEventSchema,
  WorkspaceQueryResultEventSchema,
  WorkspaceIntentResultEventSchema,
  WorkspaceProjectionInvalidatedEventSchema,
]);

export function createWorkspaceQueryCommand(
  metadata: CommandMetadata,
  query: WorkspaceQuery,
): DesktopMessage {
  return DesktopMessageSchema.parse({
    protocolVersion,
    messageType: "command",
    ...metadata,
    command: "workspace.query",
    payload: query,
  });
}

export function createWorkspaceIntentCommand(
  metadata: CommandMetadata,
  intent: WorkspaceIntent,
): DesktopMessage {
  return DesktopMessageSchema.parse({
    protocolVersion,
    messageType: "command",
    ...metadata,
    command: "workspace.intent",
    payload: intent,
  });
}

export function createWorkspaceQueryResultEvent(
  metadata: EventMetadata,
  result: WorkspaceQueryResult,
): HarnessMessage {
  return HarnessMessageSchema.parse({
    protocolVersion,
    messageType: "event",
    ...metadata,
    event: "workspace.query.result",
    payload: result,
  });
}

export function createWorkspaceIntentResultEvent(
  metadata: EventMetadata,
  result: WorkspaceIntentResult,
): HarnessMessage {
  return HarnessMessageSchema.parse({
    protocolVersion,
    messageType: "event",
    ...metadata,
    event: "workspace.intent.result",
    payload: result,
  });
}

export function createWorkspaceProjectionInvalidatedEvent(
  metadata: EventMetadata,
  notification: WorkspaceNotification,
): HarnessMessage {
  return HarnessMessageSchema.parse({
    protocolVersion,
    messageType: "event",
    ...metadata,
    event: "workspace.projection.invalidated",
    payload: notification,
  });
}
```

#### 2. `packages/protocol/src/index.ts`

**File**: `packages/protocol/src/index.ts`  
**Changes**: MODIFY — publish the activated workspace envelope factories.

```ts
export {
  createWorkspaceIntentCommand,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryCommand,
  createWorkspaceQueryResultEvent,
} from "./protocol.js";
```

#### 3. `apps/harness/src/workspace-application.ts`

**File**: `apps/harness/src/workspace-application.ts`  
**Changes**: NEW — workspace query/intent dispatch behind separate Conversation, Frame, and Memory ports.

```ts
import type {
  WorkspaceCapability,
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "@slopstop/protocol";
import {
  WorkspaceIntentResultSchema,
  WorkspaceQueryResultSchema,
} from "@slopstop/protocol";

type ConversationQuery = Extract<
  WorkspaceQuery,
  { query: "conversation.read" | "context-record.read" }
>;
type FrameQuery = Extract<WorkspaceQuery, { query: "frame-review.read" }>;
type MemoryQuery = Extract<WorkspaceQuery, { query: "memory-library.read" }>;

type ConversationIntent = Extract<
  WorkspaceIntent,
  { intent: "conversation.message.submit" | "conversation.influence.select" }
>;
type FrameIntent = Extract<
  WorkspaceIntent,
  { intent: "frame-review.annotate" | "frame.decision.accept" | "frame.accept" }
>;
type MemoryIntent = Extract<WorkspaceIntent, { intent: "memory.proposal.review" }>;

export type WorkspacePortQueryOutcome =
  | Readonly<{ status: "ready"; projection: unknown }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export type WorkspacePortIntentOutcome =
  | Readonly<{ status: "forwarded" }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export type WorkspaceOwnerNotification<C extends WorkspaceCapability> = Readonly<
  Omit<WorkspaceNotification, "capability"> & { capability: C }
>;

export interface WorkspaceOwnerPort<
  C extends WorkspaceCapability,
  Q extends WorkspaceQuery,
  I extends WorkspaceIntent,
> {
  query(query: Q): Promise<WorkspacePortQueryOutcome>;
  submit(intent: I): Promise<WorkspacePortIntentOutcome>;
  subscribe(listener: (notification: WorkspaceOwnerNotification<C>) => void): () => void;
}

export type ConversationWorkspacePort = WorkspaceOwnerPort<
  "conversation",
  ConversationQuery,
  ConversationIntent
>;
export type FrameWorkspacePort = WorkspaceOwnerPort<"frame", FrameQuery, FrameIntent>;
export type MemoryWorkspacePort = WorkspaceOwnerPort<"memory", MemoryQuery, MemoryIntent>;

export interface WorkspaceApplication {
  query(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submit(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribe(listener: (notification: WorkspaceNotification) => void): () => void;
}

type WorkspaceApplicationOptions = Readonly<{
  conversation: ConversationWorkspacePort;
  frame: FrameWorkspacePort;
  memory: MemoryWorkspacePort;
}>;

const capabilityLabels: Readonly<Record<WorkspaceCapability, string>> = {
  conversation: "Conversation",
  frame: "Frame",
  memory: "Memory",
};

function readyQueryResult(
  query: WorkspaceQuery,
  projection: unknown,
): WorkspaceQueryResult | null {
  const parsed = WorkspaceQueryResultSchema.safeParse({
    status: "ready",
    query,
    projection,
  });
  return parsed.success ? parsed.data : null;
}

function unavailableQueryResult(
  query: WorkspaceQuery,
  capability: WorkspaceCapability,
  message: string,
): WorkspaceQueryResult {
  return WorkspaceQueryResultSchema.parse({
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: message || `${capabilityLabels[capability]} producer is unavailable.`,
    },
  });
}

function brokenQueryResult(
  query: WorkspaceQuery,
  capability: WorkspaceCapability,
  code: "WORKSPACE_PRODUCER_FAILED" | "WORKSPACE_PROJECTION_INVALID",
  message: string,
): WorkspaceQueryResult {
  return WorkspaceQueryResultSchema.parse({
    status: "broken",
    query,
    diagnostic: {
      code,
      message: message || `${capabilityLabels[capability]} producer failed.`,
    },
  });
}

async function queryOwner<Q extends WorkspaceQuery>(
  capability: WorkspaceCapability,
  port: Pick<WorkspaceOwnerPort<WorkspaceCapability, Q, WorkspaceIntent>, "query">,
  query: Q,
): Promise<WorkspaceQueryResult> {
  try {
    const outcome = await port.query(query);
    switch (outcome.status) {
      case "ready":
        return (
          readyQueryResult(query, outcome.projection) ??
          brokenQueryResult(
            query,
            capability,
            "WORKSPACE_PROJECTION_INVALID",
            `${capabilityLabels[capability]} producer returned an invalid projection.`,
          )
        );
      case "unavailable":
        return unavailableQueryResult(query, capability, outcome.message);
      case "broken":
        return brokenQueryResult(
          query,
          capability,
          "WORKSPACE_PRODUCER_FAILED",
          outcome.message,
        );
    }
  } catch {
    return brokenQueryResult(
      query,
      capability,
      "WORKSPACE_PRODUCER_FAILED",
      `${capabilityLabels[capability]} producer failed.`,
    );
  }
}

function intentResult(
  capability: WorkspaceCapability,
  outcome: WorkspacePortIntentOutcome,
): WorkspaceIntentResult {
  switch (outcome.status) {
    case "forwarded":
      return WorkspaceIntentResultSchema.parse({ status: "forwarded", capability });
    case "unavailable":
      return WorkspaceIntentResultSchema.parse({
        status: "unavailable",
        capability,
        diagnostic: {
          code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
          message: outcome.message || `${capabilityLabels[capability]} producer is unavailable.`,
        },
      });
    case "broken":
      return WorkspaceIntentResultSchema.parse({
        status: "broken",
        capability,
        diagnostic: {
          code: "WORKSPACE_PRODUCER_FAILED",
          message: outcome.message || `${capabilityLabels[capability]} producer failed.`,
        },
      });
  }
}

async function submitOwner<I extends WorkspaceIntent>(
  capability: WorkspaceCapability,
  port: Pick<WorkspaceOwnerPort<WorkspaceCapability, WorkspaceQuery, I>, "submit">,
  intent: I,
): Promise<WorkspaceIntentResult> {
  try {
    return intentResult(capability, await port.submit(intent));
  } catch {
    return intentResult(capability, {
      status: "broken",
      message: `${capabilityLabels[capability]} producer failed.`,
    });
  }
}

function unavailablePort<
  C extends WorkspaceCapability,
  Q extends WorkspaceQuery,
  I extends WorkspaceIntent,
>(capability: C): WorkspaceOwnerPort<C, Q, I> {
  const message = `${capabilityLabels[capability]} producer is unavailable.`;
  return {
    query: async () => ({ status: "unavailable", message }),
    submit: async () => ({ status: "unavailable", message }),
    subscribe: () => () => undefined,
  };
}

export function createWorkspaceApplication(
  options: WorkspaceApplicationOptions,
): WorkspaceApplication {
  return {
    query: (query) => {
      switch (query.query) {
        case "conversation.read":
        case "context-record.read":
          return queryOwner("conversation", options.conversation, query);
        case "frame-review.read":
          return queryOwner("frame", options.frame, query);
        case "memory-library.read":
          return queryOwner("memory", options.memory, query);
      }
    },
    submit: (intent) => {
      switch (intent.intent) {
        case "conversation.message.submit":
        case "conversation.influence.select":
          return submitOwner("conversation", options.conversation, intent);
        case "frame-review.annotate":
        case "frame.decision.accept":
        case "frame.accept":
          return submitOwner("frame", options.frame, intent);
        case "memory.proposal.review":
          return submitOwner("memory", options.memory, intent);
      }
    },
    subscribe: (listener) => {
      const stops = [
        options.conversation.subscribe(listener),
        options.frame.subscribe(listener),
        options.memory.subscribe(listener),
      ];
      return () => {
        for (const stop of stops) {
          stop();
        }
      };
    },
  };
}

export function createUnavailableWorkspaceApplication(): WorkspaceApplication {
  return createWorkspaceApplication({
    conversation: unavailablePort("conversation"),
    frame: unavailablePort("frame"),
    memory: unavailablePort("memory"),
  });
}
```

#### 4. `apps/harness/src/harness-runtime.ts`

**File**: `apps/harness/src/harness-runtime.ts`  
**Changes**: MODIFY — dispatch workspace messages without changing bootstrap failure behavior.

```ts
import {
  createFailureEvent,
  createReadyEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type HarnessFailureCode,
  parseDesktopMessage,
  readMessageId,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import type { WorkspaceApplication } from "./workspace-application.js";

type HarnessRuntimeOptions = Readonly<{
  transport: HarnessTransport;
  workspaceApplication: WorkspaceApplication;
  harnessVersion: string;
  createId: () => string;
  now: () => string;
}>;

export function startHarnessRuntime(options: HarnessRuntimeOptions): StopHarnessRuntime {
  let sequence = 0;

  const nextMetadata = (causationId: string | null) => {
    sequence += 1;
    return {
      messageId: options.createId(),
      sentAt: options.now(),
      sequence,
      causationId,
    };
  };

  const sendInternalFailure = (causationId: string | null) => {
    options.transport.send(
      createFailureEvent(nextMetadata(causationId), {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a workspace message.",
        retryable: false,
      }),
    );
  };

  const handleMessage = async (message: unknown): Promise<void> => {
    const parsed = parseDesktopMessage(message);
    const causationId = readMessageId(message);

    if (!parsed.ok) {
      options.transport.send(
        createFailureEvent(nextMetadata(causationId), {
          code: parsed.error.code,
          message: failureMessages[parsed.error.code],
          retryable: false,
        }),
      );
      return;
    }

    switch (parsed.value.command) {
      case "system.handshake":
        options.transport.send(
          createReadyEvent(nextMetadata(causationId), options.harnessVersion),
        );
        return;
      case "workspace.query":
        {
          const result = await options.workspaceApplication.query(parsed.value.payload);
          options.transport.send(
            createWorkspaceQueryResultEvent(nextMetadata(causationId), result),
          );
        }
        return;
      case "workspace.intent":
        {
          const result = await options.workspaceApplication.submit(parsed.value.payload);
          options.transport.send(
            createWorkspaceIntentResultEvent(nextMetadata(causationId), result),
          );
        }
    }
  };

  const stopMessages = options.transport.subscribe((message) => {
    void handleMessage(message).catch(() => {
      sendInternalFailure(readMessageId(message));
    });
  });
  const stopNotifications = options.workspaceApplication.subscribe((notification) => {
    try {
      const validated = WorkspaceNotificationSchema.parse(notification);
      options.transport.send(
        createWorkspaceProjectionInvalidatedEvent(nextMetadata(null), validated),
      );
    } catch {
      sendInternalFailure(null);
    }
  });

  return () => {
    stopMessages();
    stopNotifications();
  };
}
```

#### 5. `apps/harness/src/process-entry.ts`

**File**: `apps/harness/src/process-entry.ts`  
**Changes**: MODIFY — compose explicit unavailable production owner ports.

```ts
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";

const stopRuntime = startHarnessRuntime({
  transport: createTransport(port),
  workspaceApplication: createUnavailableWorkspaceApplication(),
  harnessVersion: "0.0.0",
  createId: randomUUID,
  now: () => new Date().toISOString(),
});
```

#### 6. `apps/harness/src/index.ts`

**File**: `apps/harness/src/index.ts`  
**Changes**: MODIFY — export the harness workspace application interface for adapter integration.

```ts
export type {
  ConversationWorkspacePort,
  FrameWorkspacePort,
  MemoryWorkspacePort,
  WorkspaceApplication,
  WorkspaceOwnerNotification,
  WorkspaceOwnerPort,
  WorkspacePortIntentOutcome,
  WorkspacePortQueryOutcome,
} from "./workspace-application.js";
export {
  createUnavailableWorkspaceApplication,
  createWorkspaceApplication,
} from "./workspace-application.js";
```

#### 7. `apps/desktop/src/main/harness-supervisor.ts`

**File**: `apps/desktop/src/main/harness-supervisor.ts`  
**Changes**: MODIFY — handle the expanded harness event union exhaustively without treating workspace traffic as handshake readiness.

```ts
#handleHarnessMessage(value: unknown): void {
  const parsed = parseHarnessMessage(value);
  if (!parsed.ok) {
    this.#restartBlocked = true;
    this.#setStatus({
      state: "crashed",
      attempt: this.#attempt,
      canRetry: true,
      diagnostic: {
        code: "HARNESS_PROTOCOL_ERROR",
        message: "Harness returned an invalid or incompatible protocol message.",
      },
    });
    this.#child?.kill();
    return;
  }

  switch (parsed.value.event) {
    case "system.failure":
      this.#restartBlocked = true;
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROTOCOL_ERROR",
          message: parsed.value.payload.message,
        },
      });
      this.#child?.kill();
      return;
    case "system.ready":
      if (this.#handshakeTimer !== undefined) {
        clearTimeout(this.#handshakeTimer);
        this.#handshakeTimer = undefined;
      }
      this.#setStatus({
        state: "ready",
        attempt: this.#attempt,
        harnessVersion: parsed.value.payload.harnessVersion,
      });
      return;
    case "workspace.intent.result":
    case "workspace.projection.invalidated":
    case "workspace.query.result":
      return;
  }
}
```

### Test Contract:

- **Behavior**: Protocol version 2 activates workspace envelopes only alongside truthful harness dispatch.
  - Test: `parses workspace commands and correlated result events under protocol version 2` -> `packages/protocol/src/protocol.test.ts`
  - Oracle: a created `workspace.query` command parses with `protocolVersion: 2`, the supplied message ID and exact query; its result event preserves the exact causation ID and result; changing either envelope to version `1` returns `PROTOCOL_VERSION_UNSUPPORTED`; unknown workspace command and event variants return `PROTOCOL_MESSAGE_INVALID`; the original handshake still returns `system.ready` under version 2.
  - Expected red: Phase 1 leaves the live protocol on version 1 with no workspace envelope variants.
- **Behavior**: Every missing production owner returns unavailable, never ready or empty data.
  - Test: `reports each unavailable owner through its exact query` -> `apps/harness/src/workspace-application.test.ts`
  - Oracle: Conversation and Context-record queries return `status: "unavailable"` with their exact input query and message `Conversation producer is unavailable.`; Frame returns the analogous Frame result; Memory returns the analogous Memory result; no result has a `projection` field.
  - Expected red: no workspace application or unavailable production ports exist before Phase 2.
- **Behavior**: A failed or invalid owner projection is broken and remains attributable to the exact query.
  - Test: `distinguishes thrown producers from invalid projections` -> `apps/harness/src/workspace-application.test.ts`
  - Oracle: a Conversation port rejection yields `WORKSPACE_PRODUCER_FAILED` and message `Conversation producer failed.`; a ready Memory outcome containing a Conversation projection yields `WORKSPACE_PROJECTION_INVALID` and message `Memory producer returned an invalid projection.`; neither result contains a projection.
  - Expected red: no application boundary catches owner failures or validates ready projections before Phase 2.
- **Behavior**: An intent without a producer fails non-durably and never becomes a canonical rejection.
  - Test: `returns unavailable for intents with no owner adapter` -> `apps/harness/src/workspace-application.test.ts`
  - Oracle: each Conversation, Frame, and Memory intent routed through the unavailable application returns its exact capability, status `unavailable`, code `WORKSPACE_CAPABILITY_UNAVAILABLE`, and owner-specific message; no result exposes `forwarded`, `applied`, `rejected`, `receipt`, or revision fields.
  - Expected red: no intent dispatch or explicit unavailable adapter exists before Phase 2.
- **Behavior**: A successful owner handoff reports forwarding only and never invents a canonical outcome.
  - Test: `maps forwarded owner intents to their exact capability` -> `apps/harness/src/workspace-application.test.ts`
  - Oracle: injected Conversation, Frame, and Memory ports returning `{ status: "forwarded" }` yield exactly `{ status: "forwarded", capability: "conversation" | "frame" | "memory" }` for their matching intents; none contains `applied`, `rejected`, `receipt`, or revision fields.
  - Expected red: no owner-intent forwarding application seam exists before Phase 2.
- **Behavior**: Each owner port can publish invalidations only for its own capability.
  - Test: `keeps owner notification capabilities separate` -> `apps/harness/src/workspace-application.test.ts`
  - Oracle: Conversation, Frame, and Memory subscription implementations can emit only notifications whose capability literal matches their port; `@ts-expect-error` assertions reject a Memory notification from a Conversation port and a Conversation notification from Frame/Memory ports, while valid owner notifications reach the application subscriber unchanged.
  - Expected red: an unparameterized owner subscription accepts every workspace capability.
- **Behavior**: Runtime output sequence follows event emission and workspace responses preserve causation.
  - Test: `dispatches workspace queries without false system ready` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: after handshake emits sequence `1`, a Memory query with message ID `...0003` emits only `workspace.query.result` at sequence `2`, causation ID `...0003`, and the exact unavailable result; no additional `system.ready` event is emitted.
  - Expected red: the current runtime answers every valid command with `system.ready`.
- **Behavior**: Concurrent owner calls allocate sequence numbers in actual emission order.
  - Test: `sequences concurrent workspace responses when they emit` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: query A arrives before query B but its deferred owner result resolves second; B emits first with sequence `1` and B's causation ID, then A emits with sequence `2` and A's causation ID; no sequence is reserved before an awaited owner result is ready.
  - Expected red: allocating metadata before each awaited owner call permits sequence `2` to emit before sequence `1`.
- **Behavior**: Invalid producer notifications fail visibly rather than disappearing.
  - Test: `turns an invalid workspace notification into harness failure` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: invoking the captured subscriber through `Reflect.apply` to model an untyped adapter with `{ capability: "memory", scope: { kind: "project", projectId }, revision: -1 }` is rejected before event metadata allocation and emits exactly one `system.failure` at sequence `1`, with code `HARNESS_INTERNAL_FAILURE`, causation ID `null`, retryable `false`, and message `Harness failed while handling a workspace message.`; no invalidation event is emitted.
  - Expected red: the runtime has no workspace notification subscription before Phase 2.
- **Behavior**: Workspace envelopes survive the real structured-clone transport.
  - Test: `round-trips an unavailable workspace query over structured clone` -> `apps/harness/tests/integration/harness-runtime.integration.test.ts`
  - Oracle: a protocol-v2 Memory query sent through `MessageChannel` resolves to the exact `workspace.query.result` envelope with the same query, causation ID, sequence `1`, and unavailable diagnostic; ports close without a second event.
  - Expected red: the integration runtime cannot parse or answer workspace envelopes before Phase 2.
- **Behavior**: Workspace events never mutate harness health or complete the startup handshake.
  - Test: `ignores workspace events for health while waiting for ready` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: after spawn, a valid `workspace.query.result` leaves status exactly `{ state: "starting", attempt: 1 }`, does not kill the child, and does not clear the handshake timeout; a following `system.ready` changes status to `{ state: "ready", attempt: 1, harnessVersion: "0.0.0" }`.
  - Expected red: expanding `HarnessMessage` makes the current non-failure branch assume every event has `harnessVersion`.

### Success Criteria:

#### Automated Verification:

- [x] Protocol and harness unit tests pass: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/workspace-application.test.ts apps/harness/src/harness-runtime.test.ts`
- [x] Structured-clone integration passes: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts`
- [x] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`
- [x] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [x] Desktop supervisor tests pass: `pnpm exec vitest run apps/desktop/src/main/harness-supervisor.test.ts`
- [x] Desktop type checking passes: `pnpm --filter @slopstop/desktop typecheck`
- [x] Changed files pass Biome: `pnpm exec biome check packages/protocol/src apps/harness/src apps/harness/tests/integration apps/desktop/src/main/harness-supervisor.ts apps/desktop/src/main/harness-supervisor.test.ts`
- [x] Architecture boundaries pass: `pnpm check:boundaries`

#### Manual Verification:

- [x] `protocolVersion` changes from 1 to 2 only in the shared protocol constant.
- [x] Every new live Desktop command has one non-`system.ready` harness dispatch branch.
- [x] Production process wiring uses unavailable ports and imports no prototype fixtures.
- [x] Owner ports expose projections and forwarding outcomes only; they do not claim persistence, Evidence, Execution, or canonical receipt ownership.

## Phase 3: Validated Harness Session

### Overview

Extract validated message transport from `HarnessSupervisor` into a reusable session while preserving lifecycle, health, retry, and recovery behavior. Depends on Phase 2.

### Changes Required:

#### 1. `apps/desktop/src/main/harness-session.ts`

**File**: `apps/desktop/src/main/harness-session.ts`  
**Changes**: NEW — attach/detach the active port, validate messages, send typed commands, and publish protocol failures.

```ts
import type { HarnessMessage } from "@slopstop/protocol";
import {
  DesktopMessageSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";

export interface HarnessMessagePort {
  close(): void;
  off(event: "message", listener: (event: Readonly<{ data: unknown }>) => void): this;
  on(event: "message", listener: (event: Readonly<{ data: unknown }>) => void): this;
  postMessage(message: unknown): void;
  start(): void;
}

export type HarnessSessionEvent =
  | Readonly<{ type: "message"; message: HarnessMessage }>
  | Readonly<{ type: "protocol-error" }>
  | Readonly<{ type: "disconnected" }>;

export type HarnessSessionSendResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code:
          | "HARNESS_SESSION_UNAVAILABLE"
          | "HARNESS_SESSION_MESSAGE_INVALID"
          | "HARNESS_SESSION_SEND_FAILED";
      }>;
    }>;

export interface HarnessSessionClient {
  send(message: unknown): HarnessSessionSendResult;
  subscribe(listener: (event: HarnessSessionEvent) => void): () => void;
}

export class HarnessSession implements HarnessSessionClient {
  readonly #listeners = new Set<(event: HarnessSessionEvent) => void>();
  #port: HarnessMessagePort | undefined;

  readonly #receive = (event: Readonly<{ data: unknown }>): void => {
    const parsed = parseHarnessMessage(event.data);
    if (!parsed.ok) {
      this.#emit({ type: "protocol-error" });
      return;
    }
    this.#emit({ type: "message", message: parsed.value });
  };

  attach(port: HarnessMessagePort): void {
    this.detach();
    this.#port = port;
    port.on("message", this.#receive);
    port.start();
  }

  detach(): void {
    const port = this.#port;
    if (port === undefined) {
      return;
    }
    this.#port = undefined;
    port.off("message", this.#receive);
    port.close();
    this.#emit({ type: "disconnected" });
  }

  send(message: unknown): HarnessSessionSendResult {
    const parsed = DesktopMessageSchema.safeParse(message);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: "HARNESS_SESSION_MESSAGE_INVALID" },
      };
    }
    if (this.#port === undefined) {
      return {
        ok: false,
        error: { code: "HARNESS_SESSION_UNAVAILABLE" },
      };
    }
    try {
      this.#port.postMessage(parsed.data);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: { code: "HARNESS_SESSION_SEND_FAILED" },
      };
    }
  }

  subscribe(listener: (event: HarnessSessionEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #emit(event: HarnessSessionEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
}
```

#### 2. `apps/desktop/src/main/harness-supervisor.ts`

**File**: `apps/desktop/src/main/harness-supervisor.ts`  
**Changes**: MODIFY — compose `HarnessSession` and retain only process lifecycle and health policy.

```ts
import {
  createHandshakeCommand,
  HarnessBootstrapSchema,
  type HarnessMessage,
  type HarnessStatus,
  HarnessStatusSchema,
  type RetryHarnessResult,
} from "@slopstop/protocol";
import {
  MessageChannelMain,
  type UtilityProcess,
  utilityProcess,
} from "electron";
import {
  HarnessSession,
  type HarnessSessionClient,
  type HarnessSessionEvent,
} from "./harness-session.js";

readonly #session = new HarnessSession();

constructor(entryPath: string, logger: Logger) {
  this.#entryPath = entryPath;
  this.#logger = logger;
  this.#session.subscribe((event) => {
    this.#handleSessionEvent(event);
  });
}

getSession(): HarnessSessionClient {
  return this.#session;
}

stop(): void {
  this.#stopping = true;
  this.#clearTimers();
  this.#session.detach();
  this.#child?.kill();
  this.#child = undefined;
  this.#setStatus({ state: "stopped" });
}

#handleSessionEvent(event: HarnessSessionEvent): void {
  switch (event.type) {
    case "disconnected":
      return;
    case "protocol-error":
      this.#restartBlocked = true;
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROTOCOL_ERROR",
          message: "Harness returned an invalid or incompatible protocol message.",
        },
      });
      this.#child?.kill();
      return;
    case "message":
      this.#handleHarnessMessage(event.message);
  }
}

#handleHarnessMessage(message: HarnessMessage): void {
  switch (message.event) {
    case "system.failure":
      this.#restartBlocked = true;
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROTOCOL_ERROR",
          message: message.payload.message,
        },
      });
      this.#child?.kill();
      return;
    case "system.ready":
      if (this.#handshakeTimer !== undefined) {
        clearTimeout(this.#handshakeTimer);
        this.#handshakeTimer = undefined;
      }
      this.#setStatus({
        state: "ready",
        attempt: this.#attempt,
        harnessVersion: message.payload.harnessVersion,
      });
      return;
    case "workspace.intent.result":
    case "workspace.projection.invalidated":
    case "workspace.query.result":
      return;
  }
}

#handleProcessExit(child: UtilityProcess, exitCode: number): void {
  if (this.#child !== child) {
    return;
  }

  this.#child = undefined;
  this.#session.detach();
  if (this.#handshakeTimer !== undefined) {
    clearTimeout(this.#handshakeTimer);
    this.#handshakeTimer = undefined;
  }

  if (this.#stopping || this.#restartBlocked) {
    return;
  }

  this.#logger.error({ exitCode, attempt: this.#attempt }, "Harness process exited.");
  reportHarnessCrash(exitCode);

  if (this.#attempt >= maxAutomaticAttempts) {
    this.#setStatus({
      state: "crashed",
      attempt: this.#attempt,
      canRetry: true,
      diagnostic: {
        code: "HARNESS_PROCESS_EXITED",
        message: `Harness exited with code ${exitCode}.`,
      },
    });
    return;
  }

  this.#setStatus({
    state: "degraded",
    attempt: this.#attempt,
    diagnostic: {
      code: "HARNESS_PROCESS_EXITED",
      message: `Harness exited with code ${exitCode}; automatic recovery is pending.`,
    },
  });
  const delay = restartBaseDelayMs * 2 ** Math.max(0, this.#attempt - 1);
  this.#restartTimer = setTimeout(() => {
    this.#restartTimer = undefined;
    this.#spawn();
  }, delay);
}

#spawn(): void {
  this.#attempt += 1;
  this.#setStatus({ state: "starting", attempt: this.#attempt });

  let child: UtilityProcess;
  try {
    child = utilityProcess.fork(this.#entryPath, [], {
      serviceName: "SlopStop Harness",
      stdio: "pipe",
    });
  } catch (error) {
    this.#logger.error({ error, attempt: this.#attempt }, "Harness process failed to start.");
    this.#setStatus({
      state: "crashed",
      attempt: this.#attempt,
      canRetry: true,
      diagnostic: {
        code: "HARNESS_START_FAILED",
        message: "Harness process could not be started.",
      },
    });
    return;
  }

  this.#child = child;
  child.stdout?.on("data", (chunk: Buffer) => {
    this.#logger.info({ output: chunk.toString("utf8").trimEnd() }, "Harness output.");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    this.#logger.error({ output: chunk.toString("utf8").trimEnd() }, "Harness error output.");
  });
  child.once("error", (type, location) => {
    this.#logger.error({ type, location }, "Harness process reported a fatal error.");
  });
  child.once("exit", (exitCode) => {
    this.#handleProcessExit(child, exitCode);
  });
  child.once("spawn", () => {
    const { port1, port2 } = new MessageChannelMain();
    this.#session.attach(port2);
    child.postMessage(HarnessBootstrapSchema.parse({ kind: "harness.connect" }), [port1]);
    const handshake = this.#session.send(
      createHandshakeCommand(
        {
          messageId: randomUUID(),
          sentAt: new Date().toISOString(),
        },
        "0.0.0",
      ),
    );
    if (!handshake.ok) {
      this.#restartBlocked = true;
      this.#logger.error(
        { attempt: this.#attempt, code: handshake.error.code },
        "Harness handshake could not be sent.",
      );
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_START_FAILED",
          message: "Harness handshake could not be sent.",
        },
      });
      child.kill();
      return;
    }
    this.#handshakeTimer = setTimeout(() => {
      this.#logger.error({ attempt: this.#attempt }, "Harness handshake timed out.");
      this.#setStatus({
        state: "degraded",
        attempt: this.#attempt,
        diagnostic: {
          code: "HARNESS_HANDSHAKE_TIMEOUT",
          message: "Harness did not complete its startup handshake in time.",
        },
      });
      child.kill();
    }, handshakeTimeoutMs);
  });
}
```

### Test Contract:

- **Behavior**: HarnessSession validates incoming messages once and never publishes malformed values as messages.
  - Test: `publishes validated messages and a distinct protocol error` -> `apps/desktop/src/main/harness-session.test.ts`
  - Oracle: a valid `system.ready` event produces exactly `{ type: "message", message: readyEvent }`; then `{ event: "not-valid" }` produces exactly `{ type: "protocol-error" }`; no malformed value appears in a message event.
  - Expected red: HarnessSession does not exist before Phase 3.
- **Behavior**: Attach, replacement, and detach leave one active port and signal disconnection exactly once.
  - Test: `owns one active message port` -> `apps/desktop/src/main/harness-session.test.ts`
  - Oracle: attaching port A calls A.start once; attaching B removes A's message listener, closes A once, emits one disconnected event, and starts B once; detach removes B's listener, closes B once, and emits a second disconnected event; a second detach emits nothing.
  - Expected red: port ownership is private ad hoc state in HarnessSupervisor before Phase 3.
- **Behavior**: Sending distinguishes invalid input, no active port, successful delivery, and transport failure.
  - Test: `returns exact send outcomes` -> `apps/desktop/src/main/harness-session.test.ts`
  - Oracle: invalid `{ command: "unknown" }` returns `HARNESS_SESSION_MESSAGE_INVALID` and posts nothing; a valid handshake before attach returns `HARNESS_SESSION_UNAVAILABLE`; after attach it returns `{ ok: true }` and posts the exact parsed handshake once; if `postMessage` throws, it returns `HARNESS_SESSION_SEND_FAILED`.
  - Expected red: no reusable validated send seam exists before Phase 3.
- **TDD-exempt regression**: Existing supervisor health, retry, recovery, timeout, output, and stop behavior intentionally remains unchanged; the pre-Phase-3 `apps/desktop/src/main/harness-supervisor.test.ts` suite is the oracle and must preserve its exact status, retry, backoff `250/500`, timeout `5000`, crash-reporting, output, startup-failure, and stop assertions while port ownership is extracted.
- **Behavior**: Valid workspace events remain observable to bridge subscribers but never mutate health.
  - Test: `publishes workspace messages without changing supervisor status` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: while status is `starting`, a valid `workspace.query.result` appears once as a session message event, leaves status exactly `{ state: "starting", attempt: 1 }`, and does not kill the child; a following ready event sets the exact ready status.
  - Expected red: before extraction, valid workspace events are consumed inside the supervisor and unavailable to a separate bridge.
- **Behavior**: Handshake send failure is visible and does not wait for timeout.
  - Test: `fails startup immediately when the session cannot send handshake` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: a port whose `postMessage` throws causes exact crashed status with code `HARNESS_START_FAILED`, message `Harness handshake could not be sent.`, attempt `1`, and `canRetry: true`; `child.kill` is called once and advancing `5000` ms emits no degraded timeout state.
  - Expected red: the current direct `postMessage` path has no explicit send-failure result.

### Success Criteria:

#### Automated Verification:

- [x] Session and supervisor tests pass: `pnpm exec vitest run apps/desktop/src/main/harness-session.test.ts apps/desktop/src/main/harness-supervisor.test.ts`
- [x] Desktop type checking passes: `pnpm --filter @slopstop/desktop typecheck`
- [x] Existing packaged-shell unit boundary remains green: `pnpm exec vitest run apps/desktop/src/renderer/app.test.tsx`
- [x] Changed files and authored tests pass Biome: `pnpm exec biome check apps/desktop/src/main/harness-session.ts apps/desktop/src/main/harness-session.test.ts apps/desktop/src/main/harness-supervisor.ts apps/desktop/src/main/harness-supervisor.test.ts`
- [x] Architecture boundaries pass: `pnpm check:boundaries`

#### Manual Verification:

- [x] HarnessSession contains no health, retry, backoff, timeout, workspace, or domain policy.
- [x] HarnessSupervisor contains no raw message parsing or direct active-port field.
- [x] Workspace events are available to a future bridge while only system events change supervisor health.
- [x] No raw Electron port or `ipcRenderer` capability is exposed outside main.

## Phase 4: Main-Process Workspace Bridge

### Overview

Correlate workspace requests over `HarnessSession`, forward revisioned invalidations, and register narrow desktop IPC handlers without adding domain ownership to Electron. Depends on Phase 3.

### Changes Required:

#### 1. `apps/desktop/src/main/workspace-bridge.ts`

**File**: `apps/desktop/src/main/workspace-bridge.ts`  
**Changes**: NEW — correlated query/intent requests, disconnect/protocol-failure cleanup, and invalidation publication.

```ts
import { isDeepStrictEqual } from "node:util";
import {
  createWorkspaceIntentCommand,
  createWorkspaceQueryCommand,
  type WorkspaceCapability,
  type WorkspaceIntent,
  type WorkspaceIntentResult,
  WorkspaceIntentResultSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQuery,
  type WorkspaceQueryResult,
  WorkspaceQueryResultSchema,
  type WorkspaceScope,
} from "@slopstop/protocol";
import type {
  HarnessSessionClient,
  HarnessSessionEvent,
  HarnessSessionSendResult,
} from "./harness-session.js";

type PendingQuery = Readonly<{
  kind: "query";
  query: WorkspaceQuery;
  resolve: (result: WorkspaceQueryResult) => void;
}>;

type PendingIntent = Readonly<{
  kind: "intent";
  capability: WorkspaceCapability;
  resolve: (result: WorkspaceIntentResult) => void;
}>;

type PendingRequest = PendingQuery | PendingIntent;

type WorkspaceBridgeOptions = Readonly<{
  session: HarnessSessionClient;
  createId: () => string;
  now: () => string;
}>;

function capabilityForIntent(intent: WorkspaceIntent): WorkspaceCapability {
  switch (intent.intent) {
    case "conversation.message.submit":
    case "conversation.influence.select":
      return "conversation";
    case "frame-review.annotate":
    case "frame.decision.accept":
    case "frame.accept":
      return "frame";
    case "memory.proposal.review":
      return "memory";
  }
}

function brokenQuery(
  query: WorkspaceQuery,
  message: string,
  code: "WORKSPACE_TRANSPORT_FAILED" | "WORKSPACE_PROJECTION_INVALID" =
    "WORKSPACE_TRANSPORT_FAILED",
): WorkspaceQueryResult {
  return WorkspaceQueryResultSchema.parse({
    status: "broken",
    query,
    diagnostic: { code, message },
  });
}

function brokenIntent(
  capability: WorkspaceCapability,
  message: string,
): WorkspaceIntentResult {
  return WorkspaceIntentResultSchema.parse({
    status: "broken",
    capability,
    diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message },
  });
}

function sendFailureMessage(result: Exclude<HarnessSessionSendResult, { ok: true }>): string {
  switch (result.error.code) {
    case "HARNESS_SESSION_UNAVAILABLE":
      return "Harness session is unavailable.";
    case "HARNESS_SESSION_MESSAGE_INVALID":
      return "Desktop created an invalid harness message.";
    case "HARNESS_SESSION_SEND_FAILED":
      return "Harness session send failed.";
  }
}

function revisionKey(capability: WorkspaceCapability, scope: WorkspaceScope): string {
  return scope.kind === "project"
    ? `${capability}:project:${scope.projectId}`
    : `${capability}:waypoint:${scope.projectId}:${scope.waypointId}`;
}

function queryRevisionKey(query: WorkspaceQuery): string {
  switch (query.query) {
    case "conversation.read":
      return revisionKey("conversation", query.scope);
    case "context-record.read":
      return revisionKey("conversation", { kind: "project", projectId: query.projectId });
    case "frame-review.read":
      return revisionKey("frame", { kind: "project", projectId: query.projectId });
    case "memory-library.read":
      return revisionKey("memory", { kind: "project", projectId: query.projectId });
  }
}

export interface WorkspaceBridgeClient {
  query(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submit(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribe(listener: (notification: WorkspaceNotification) => void): () => void;
  stop(): void;
}

export class WorkspaceBridge implements WorkspaceBridgeClient {
  readonly #createId: () => string;
  readonly #now: () => string;
  readonly #notificationListeners = new Set<
    (notification: WorkspaceNotification) => void
  >();
  readonly #projectionRevisions = new Map<string, number>();
  readonly #pending = new Map<string, PendingRequest>();
  readonly #session: HarnessSessionClient;
  readonly #stopSessionSubscription: () => void;
  #stopped = false;

  constructor(options: WorkspaceBridgeOptions) {
    this.#createId = options.createId;
    this.#now = options.now;
    this.#session = options.session;
    this.#stopSessionSubscription = this.#session.subscribe((event) => {
      this.#handleSessionEvent(event);
    });
  }

  query(query: WorkspaceQuery): Promise<WorkspaceQueryResult> {
    if (this.#stopped) {
      return Promise.resolve(brokenQuery(query, "Workspace bridge is stopped."));
    }

    let command;
    try {
      command = createWorkspaceQueryCommand(
        { messageId: this.#createId(), sentAt: this.#now() },
        query,
      );
    } catch {
      return Promise.resolve(
        brokenQuery(query, "Desktop created an invalid harness message."),
      );
    }

    return new Promise((resolve) => {
      if (this.#pending.has(command.messageId)) {
        resolve(brokenQuery(query, "Harness request identity collided."));
        return;
      }
      this.#pending.set(command.messageId, { kind: "query", query, resolve });
      const sent = this.#session.send(command);
      if (!sent.ok) {
        this.#pending.delete(command.messageId);
        resolve(brokenQuery(query, sendFailureMessage(sent)));
      }
    });
  }

  submit(intent: WorkspaceIntent): Promise<WorkspaceIntentResult> {
    const capability = capabilityForIntent(intent);
    if (this.#stopped) {
      return Promise.resolve(brokenIntent(capability, "Workspace bridge is stopped."));
    }

    let command;
    try {
      command = createWorkspaceIntentCommand(
        { messageId: this.#createId(), sentAt: this.#now() },
        intent,
      );
    } catch {
      return Promise.resolve(
        brokenIntent(capability, "Desktop created an invalid harness message."),
      );
    }

    return new Promise((resolve) => {
      if (this.#pending.has(command.messageId)) {
        resolve(brokenIntent(capability, "Harness request identity collided."));
        return;
      }
      this.#pending.set(command.messageId, { kind: "intent", capability, resolve });
      const sent = this.#session.send(command);
      if (!sent.ok) {
        this.#pending.delete(command.messageId);
        resolve(brokenIntent(capability, sendFailureMessage(sent)));
      }
    });
  }

  subscribe(listener: (notification: WorkspaceNotification) => void): () => void {
    this.#notificationListeners.add(listener);
    return () => {
      this.#notificationListeners.delete(listener);
    };
  }

  stop(): void {
    if (this.#stopped) {
      return;
    }
    this.#stopped = true;
    this.#stopSessionSubscription();
    this.#failAllPending("Workspace bridge is stopped.");
    this.#notificationListeners.clear();
  }

  #failAllPending(message: string): void {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const request of pending) {
      if (request.kind === "query") {
        request.resolve(brokenQuery(request.query, message));
      } else {
        request.resolve(brokenIntent(request.capability, message));
      }
    }
  }

  #failPending(request: PendingRequest, message: string): void {
    if (request.kind === "query") {
      request.resolve(brokenQuery(request.query, message));
    } else {
      request.resolve(brokenIntent(request.capability, message));
    }
  }

  #handleSessionEvent(event: HarnessSessionEvent): void {
    switch (event.type) {
      case "disconnected":
        this.#failAllPending("Harness session disconnected.");
        return;
      case "protocol-error":
        this.#failAllPending("Harness session received an invalid protocol message.");
        return;
      case "message":
        this.#handleHarnessMessage(event.message);
    }
  }

  #handleHarnessMessage(
    message: Extract<HarnessSessionEvent, { type: "message" }>["message"],
  ): void {
    switch (message.event) {
      case "system.failure":
        this.#failAllPending(message.payload.message);
        return;
      case "system.ready":
        return;
      case "workspace.projection.invalidated":
        this.#publishNotification(message.payload);
        return;
      case "workspace.query.result":
        this.#settleQuery(message.causationId, message.payload);
        return;
      case "workspace.intent.result":
        this.#settleIntent(message.causationId, message.payload);
    }
  }

  #publishNotification(notification: WorkspaceNotification): void {
    const parsed = WorkspaceNotificationSchema.parse(notification);
    const key = revisionKey(parsed.capability, parsed.scope);
    const previous = this.#projectionRevisions.get(key);
    if (previous !== undefined && parsed.revision <= previous) {
      return;
    }
    this.#projectionRevisions.set(key, parsed.revision);
    for (const listener of this.#notificationListeners) {
      listener(parsed);
    }
  }

  #settleQuery(causationId: string | null, result: WorkspaceQueryResult): void {
    const request = this.#takePending(causationId, "query");
    if (request?.kind !== "query") {
      return;
    }
    const parsed = WorkspaceQueryResultSchema.parse(result);
    if (!isDeepStrictEqual(parsed.query, request.query)) {
      request.resolve(
        brokenQuery(request.query, "Harness returned a mismatched workspace query."),
      );
      return;
    }
    if (parsed.status === "ready") {
      const key = queryRevisionKey(parsed.query);
      const previous = this.#projectionRevisions.get(key);
      if (previous !== undefined && parsed.projection.revision < previous) {
        request.resolve(
          brokenQuery(
            request.query,
            "Harness returned an older workspace projection.",
            "WORKSPACE_PROJECTION_INVALID",
          ),
        );
        return;
      }
      this.#projectionRevisions.set(key, parsed.projection.revision);
    }
    request.resolve(parsed);
  }

  #settleIntent(causationId: string | null, result: WorkspaceIntentResult): void {
    const request = this.#takePending(causationId, "intent");
    if (request?.kind !== "intent") {
      return;
    }
    const parsed = WorkspaceIntentResultSchema.parse(result);
    if (parsed.capability !== request.capability) {
      request.resolve(
        brokenIntent(
          request.capability,
          "Harness returned a mismatched workspace capability.",
        ),
      );
      return;
    }
    request.resolve(parsed);
  }

  #takePending(
    causationId: string | null,
    expectedKind: PendingRequest["kind"],
  ): PendingRequest | undefined {
    if (causationId === null) {
      this.#failAllPending("Harness returned an uncorrelated workspace response.");
      return undefined;
    }
    const request = this.#pending.get(causationId);
    if (request === undefined) {
      return undefined;
    }
    this.#pending.delete(causationId);
    if (request.kind !== expectedKind) {
      this.#failPending(request, "Harness returned a mismatched workspace response.");
      return undefined;
    }
    return request;
  }
}

export function createWorkspaceBridge(options: WorkspaceBridgeOptions): WorkspaceBridgeClient {
  return new WorkspaceBridge(options);
}
```

#### 2. `apps/desktop/src/shared/desktop-api.ts`

**File**: `apps/desktop/src/shared/desktop-api.ts`  
**Changes**: MODIFY — add explicit workspace IPC channel names without widening the browser interface yet.

```ts
export const desktopIpcChannels = {
  getHarnessStatus: "harness:get-status",
  harnessStatusChanged: "harness:status-changed",
  retryHarness: "harness:retry",
  queryWorkspace: "workspace:query",
  submitWorkspaceIntent: "workspace:submit-intent",
  workspaceNotification: "workspace:notification",
} as const;
```

#### 3. `apps/desktop/src/main/main.ts`

**File**: `apps/desktop/src/main/main.ts`  
**Changes**: MODIFY — compose the workspace bridge, register validated handlers, and broadcast validated invalidations.

```ts
import { randomUUID } from "node:crypto";
import {
  type HarnessStatus,
  HarnessStatusSchema,
  RetryHarnessResultSchema,
  type WorkspaceIntent,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  type WorkspaceQuery,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import {
  createWorkspaceBridge,
  type WorkspaceBridgeClient,
} from "./workspace-bridge.js";

let supervisor: HarnessSupervisor | undefined;
let workspaceBridge: WorkspaceBridgeClient | undefined;

function broadcastWorkspaceNotification(notification: WorkspaceNotification): void {
  const validated = WorkspaceNotificationSchema.parse(notification);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(desktopIpcChannels.workspaceNotification, validated);
    }
  }
}

function registerWorkspaceIpc(bridge: WorkspaceBridgeClient): void {
  ipcMain.handle(desktopIpcChannels.queryWorkspace, (_event, value: unknown) => {
    return bridge.query(WorkspaceQuerySchema.parse(value) satisfies WorkspaceQuery);
  });
  ipcMain.handle(desktopIpcChannels.submitWorkspaceIntent, (_event, value: unknown) => {
    return bridge.submit(WorkspaceIntentSchema.parse(value) satisfies WorkspaceIntent);
  });
}

supervisor = new HarnessSupervisor(harnessEntryPath(__dirname), logger);
workspaceBridge = createWorkspaceBridge({
  session: supervisor.getSession(),
  createId: randomUUID,
  now: () => new Date().toISOString(),
});
registerHarnessIpc(supervisor);
registerWorkspaceIpc(workspaceBridge);
supervisor.subscribe(broadcastHarnessStatus);
workspaceBridge.subscribe(broadcastWorkspaceNotification);

app.on("before-quit", () => {
  workspaceBridge?.stop();
  supervisor?.stop();
});
```

### Test Contract:

- **Behavior**: Query and intent responses settle only the request identified by causation ID, even out of order.
  - Test: `correlates out-of-order workspace responses` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: queries sent with IDs `...0001` and `...0002` remain pending; result for `...0002` resolves only query 2 with its exact payload, then result for `...0001` resolves only query 1; the session records exactly two commands and no result crosses promises.
  - Expected red: no main-process request correlation exists before Phase 4.
- **Behavior**: Every session send failure becomes a distinct broken transport result.
  - Test: `maps session send failures without blaming producers` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: unavailable, invalid-message, and send-failed session results yield `WORKSPACE_TRANSPORT_FAILED` with messages `Harness session is unavailable.`, `Desktop created an invalid harness message.`, and `Harness session send failed.` respectively; query results echo the exact query, intent results echo the exact capability, and none contain projection, forwarded, receipt, or canonical outcome fields.
  - Expected red: the bridge and transport-specific diagnostic do not exist before Phase 4.
- **Behavior**: Disconnect, protocol error, system failure, and stop fail every pending request exactly once.
  - Test: `fails all pending work on session loss` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: for two pending queries and one intent, each of the four failure paths resolves all three once with `WORKSPACE_TRANSPORT_FAILED` and its exact message; a later response or second stop causes no additional resolution.
  - Expected red: pending workspace requests and session lifecycle cleanup do not exist before Phase 4.
- **Behavior**: Uncorrelated or mismatched responses never settle the wrong request as success.
  - Test: `rejects invalid response correlation` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: a null-causation query result fails all pending requests with `Harness returned an uncorrelated workspace response.`; an intent result carrying a pending query ID fails only that query with `Harness returned a mismatched workspace response.`; query B carrying query A's causation ID fails A with `Harness returned a mismatched workspace query.`; a Memory result carrying a Conversation-intent causation ID fails it with `Harness returned a mismatched workspace capability.`; an unknown non-null causation ID changes nothing.
  - Expected red: no response-correlation invariant exists before Phase 4.
- **Behavior**: A generated request-ID collision cannot replace or settle the original pending request.
  - Test: `rejects a colliding pending request identity` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: when `createId` returns `...0001` for two connected queries, the second resolves immediately as `WORKSPACE_TRANSPORT_FAILED` with `Harness request identity collided.`, only the first command is sent, and a later response for `...0001` resolves only the first query.
  - Expected red: no pending request identity map or collision branch exists before Phase 4.
- **Behavior**: Invalidation delivery is monotonic per capability and scope.
  - Test: `publishes only increasing projection revisions per scope` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: Conversation/project revisions `4, 3, 4, 5` publish exactly `4, 5`; Conversation/Waypoint revision `1` and Memory/project revision `1` each publish independently; unsubscribed listeners receive nothing further.
  - Expected red: no main-process invalidation reducer exists before Phase 4.
- **Behavior**: An older ready query result cannot cross the bridge after a newer observed projection revision.
  - Test: `rejects stale ready query projections` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: after a Memory/project invalidation at revision `5`, a matching ready query projection at revision `4` resolves as broken with code `WORKSPACE_PROJECTION_INVALID`, message `Harness returned an older workspace projection.`, and no projection; revision `5` or `6` resolves ready, revision `6` becomes the next floor, and Conversation/Waypoint remains independent.
  - Expected red: notification and query revisions have no shared ordering reducer before Phase 4.
- **Behavior**: Main revalidates renderer input and broadcasts only validated notifications.
  - Test: `keeps workspace IPC handlers narrow and validated` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: exact valid query/intent values reach bridge methods unchanged; unknown variants and extra fields are rejected before bridge invocation; valid notification reaches each live BrowserWindow once; destroyed windows and invalid notifications receive nothing.
  - Expected red: workspace IPC channels and main wiring do not exist before Phase 4.
- **Behavior**: The tracer does not silently invent a request timeout.
  - Test: `keeps a connected pending request until response or lifecycle failure` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: advancing fake timers by `60_000` while the session remains connected neither resolves nor rejects the request; a following disconnect resolves it as broken; replacing unavailable owner ports is forbidden until a separate deadline policy is accepted.
  - Expected red: no request bridge exists before Phase 4.

### Success Criteria:

#### Automated Verification:

- [x] Workspace bridge tests pass: `pnpm exec vitest run apps/desktop/src/main/workspace-bridge.test.ts`
- [x] Session and supervisor regressions remain green: `pnpm exec vitest run apps/desktop/src/main/harness-session.test.ts apps/desktop/src/main/harness-supervisor.test.ts`
- [x] Desktop type checking passes: `pnpm --filter @slopstop/desktop typecheck`
- [x] Changed files and tests pass Biome: `pnpm exec biome check apps/desktop/src/main/workspace-bridge.ts apps/desktop/src/main/workspace-bridge.test.ts apps/desktop/src/shared/desktop-api.ts apps/desktop/src/main/main.ts`
- [x] Architecture boundaries pass: `pnpm check:boundaries`

#### Manual Verification:

- [x] WorkspaceBridge imports no Electron, renderer, prototype, persistence, provider, Git, Evidence, or runtime SDK.
- [x] Main contains only parsing, wiring, and broadcast code; it makes no owner or eligibility decision.
- [x] Pending requests are removed before their resolvers run, preventing re-entrant double settlement.
- [x] No timeout value or in-memory producer is introduced; the producer-replacement deadline gate is visible in Ordering Constraints and Developer Context.

## Phase 5: Renderer-Safe Workspace Bridge

### Overview

Expose the three validated workspace operations through preload and prove their behavior and isolation in packaged Electron without changing the accepted production workspace UI. Depends on Phase 4.

### Changes Required:

#### 1. `apps/desktop/src/shared/desktop-api.ts`

**File**: `apps/desktop/src/shared/desktop-api.ts`  
**Changes**: MODIFY — add the three validated workspace operations to the browser interface.

```ts
import type {
  HarnessStatus,
  RetryHarnessResult,
  WorkspaceIntent,
  WorkspaceIntentResult,
  WorkspaceNotification,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "@slopstop/protocol";

export const desktopIpcChannels = {
  getHarnessStatus: "harness:get-status",
  harnessStatusChanged: "harness:status-changed",
  retryHarness: "harness:retry",
  queryWorkspace: "workspace:query",
  submitWorkspaceIntent: "workspace:submit-intent",
  workspaceNotification: "workspace:notification",
} as const;

export interface SlopStopApi {
  getHarnessStatus(): Promise<HarnessStatus>;
  retryHarness(): Promise<RetryHarnessResult>;
  subscribeHarnessStatus(listener: (status: HarnessStatus) => void): () => void;
  queryWorkspace(query: WorkspaceQuery): Promise<WorkspaceQueryResult>;
  submitWorkspaceIntent(intent: WorkspaceIntent): Promise<WorkspaceIntentResult>;
  subscribeWorkspaceNotifications(
    listener: (notification: WorkspaceNotification) => void,
  ): () => void;
}
```

#### 2. `apps/desktop/src/preload/preload.ts`

**File**: `apps/desktop/src/preload/preload.ts`  
**Changes**: MODIFY — invoke, subscribe, unsubscribe, and revalidate every workspace value.

```ts
import {
  HarnessStatusSchema,
  RetryHarnessResultSchema,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { desktopIpcChannels, type SlopStopApi } from "../shared/desktop-api.js";

const api: SlopStopApi = {
  getHarnessStatus: async () => {
    return HarnessStatusSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.getHarnessStatus),
    );
  },
  retryHarness: async () => {
    return RetryHarnessResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.retryHarness),
    );
  },
  subscribeHarnessStatus: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(HarnessStatusSchema.parse(value));
    };
    ipcRenderer.on(desktopIpcChannels.harnessStatusChanged, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.harnessStatusChanged, receive);
    };
  },
  queryWorkspace: async (query: unknown) => {
    const validated = WorkspaceQuerySchema.parse(query);
    return WorkspaceQueryResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.queryWorkspace, validated),
    );
  },
  submitWorkspaceIntent: async (intent: unknown) => {
    const validated = WorkspaceIntentSchema.parse(intent);
    return WorkspaceIntentResultSchema.parse(
      await ipcRenderer.invoke(desktopIpcChannels.submitWorkspaceIntent, validated),
    );
  },
  subscribeWorkspaceNotifications: (listener) => {
    const receive = (_event: IpcRendererEvent, value: unknown) => {
      listener(WorkspaceNotificationSchema.parse(value));
    };
    ipcRenderer.on(desktopIpcChannels.workspaceNotification, receive);
    return () => {
      ipcRenderer.off(desktopIpcChannels.workspaceNotification, receive);
    };
  },
};

contextBridge.exposeInMainWorld("slopstop", api);
```

#### 3. `apps/desktop/src/renderer/window.d.ts`

**File**: `apps/desktop/src/renderer/window.d.ts`  
**Changes**: TDD-exempt VERIFY — retain the existing alias to `SlopStopApi`; duplicating the widened shape would create drift rather than behavior.

```ts
import type { SlopStopApi } from "../shared/desktop-api.js";

declare global {
  interface Window {
    readonly slopstop: SlopStopApi;
  }
}
```

#### 4. `apps/desktop/vitest.main.config.ts`

**File**: `apps/desktop/vitest.main.config.ts`  
**Changes**: MODIFY — include colocated preload tests in the existing Node/Electron-mock project.

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "desktop-main",
    environment: "node",
    include: ["src/main/**/*.test.ts", "src/preload/**/*.test.ts"],
  },
});
```

#### 5. `apps/desktop/src/renderer/app.test.tsx`

**File**: `apps/desktop/src/renderer/app.test.tsx`  
**Changes**: MODIFY — keep existing renderer fakes complete without inventing workspace fixtures or behavior.

```ts
const unusedWorkspaceApi = {
  queryWorkspace: async () => {
    throw new Error("queryWorkspace is not used by this test.");
  },
  submitWorkspaceIntent: async () => {
    throw new Error("submitWorkspaceIntent is not used by this test.");
  },
  subscribeWorkspaceNotifications: () => () => undefined,
} satisfies Pick<
  SlopStopApi,
  "queryWorkspace" | "submitWorkspaceIntent" | "subscribeWorkspaceNotifications"
>;

exposeApi({
  ...unusedWorkspaceApi,
  getHarnessStatus: async () => startingStatus,
  retryHarness: async () => ({ ok: true }),
  subscribeHarnessStatus: (listener) => {
    notify = listener;
    return () => {
      notify = undefined;
    };
  },
});
```

Spread the same strict unused stub into the second existing `exposeApi` object. Do not add a workspace UI branch or a fake workspace result.

#### 6. `apps/desktop/src/main/package-smoke-verifier.ts`

**File**: `apps/desktop/src/main/package-smoke-verifier.ts`  
**Changes**: NEW — fixed inspector-free renderer probe and exact result validation for the packaged boundary.

```ts
import { isDeepStrictEqual } from "node:util";
import {
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  WorkspaceQueryResultSchema,
  WorkspaceQuerySchema,
} from "@slopstop/protocol";

const smokeQuery = WorkspaceQuerySchema.parse({
  query: "memory-library.read",
  projectId: "00000000-0000-4000-8000-000000000001",
  cursor: null,
});
const smokeIntent = WorkspaceIntentSchema.parse({
  intent: "memory.proposal.review",
  projectId: "00000000-0000-4000-8000-000000000001",
  proposalId: "00000000-0000-4000-8000-000000000002",
  decision: "accept",
  expectedProjectionRevision: 0,
});
const expectedMethods = [
  "getHarnessStatus",
  "queryWorkspace",
  "retryHarness",
  "submitWorkspaceIntent",
  "subscribeHarnessStatus",
  "subscribeWorkspaceNotifications",
] as const;
const expectedQueryResult = WorkspaceQueryResultSchema.parse({
  status: "unavailable",
  query: smokeQuery,
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});
const expectedIntentResult = WorkspaceIntentResultSchema.parse({
  status: "unavailable",
  capability: "memory",
  diagnostic: {
    code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
    message: "Memory producer is unavailable.",
  },
});

export const packageSmokeRendererScript = `
(async () => {
  const query = ${JSON.stringify(smokeQuery)};
  const intent = ${JSON.stringify(smokeIntent)};
  return {
    processType: typeof globalThis.process,
    requireType: typeof globalThis.require,
    methods: Object.keys(window.slopstop).sort(),
    queryResult: await window.slopstop.queryWorkspace(query),
    intentResult: await window.slopstop.submitWorkspaceIntent(intent),
  };
})()
`;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePackageSmokeResult(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error("Packaged renderer smoke returned an invalid result.");
  }
  const queryResult = WorkspaceQueryResultSchema.parse(value["queryResult"]);
  const intentResult = WorkspaceIntentResultSchema.parse(value["intentResult"]);
  if (
    value["processType"] !== "undefined" ||
    value["requireType"] !== "undefined" ||
    !isDeepStrictEqual(value["methods"], expectedMethods) ||
    !isDeepStrictEqual(queryResult, expectedQueryResult) ||
    !isDeepStrictEqual(intentResult, expectedIntentResult)
  ) {
    throw new Error("Packaged renderer smoke did not satisfy the production boundary.");
  }
}
```

The script interpolates only JSON serialization of two module-owned values already parsed by strict protocol schemas. Environment, CLI, renderer, and user values never enter executable text.

#### 7. `apps/desktop/src/main/main.ts`

**File**: `apps/desktop/src/main/main.ts`  
**Changes**: MODIFY — replace ready-only package auto-quit with an ordering-safe fixed renderer boundary proof.

```ts
import {
  packageSmokeRendererScript,
  validatePackageSmokeResult,
} from "./package-smoke-verifier.js";

let packageSmokeState: "inactive" | "pending" | "passed" = "inactive";

const packageSmoke =
  !prototypeMode &&
  app.isPackaged &&
  process.env["SLOPSTOP_PACKAGE_SMOKE"] === "1";
if (packageSmoke) {
  packageSmokeState = "pending";
}
let smokeHarnessReady = false;
let smokeStarted = false;
let smokeWindow: BrowserWindow | undefined;

const runPackageSmokeIfReady = (): void => {
  if (!packageSmoke || !smokeHarnessReady || smokeWindow === undefined || smokeStarted) {
    return;
  }
  smokeStarted = true;
  void smokeWindow.webContents
    .executeJavaScript(packageSmokeRendererScript)
    .then((result: unknown) => {
      validatePackageSmokeResult(result);
      packageSmokeState = "passed";
      app.quit();
    })
    .catch(() => {
      workspaceBridge?.stop();
      supervisor?.stop();
      app.exit(1);
    });
};

if (packageSmoke) {
  const stopSmokeListener = supervisor.subscribe((status) => {
    if (status.state === "ready") {
      stopSmokeListener();
      smokeHarnessReady = true;
      runPackageSmokeIfReady();
    }
  });
}
supervisor.start();

const activeWindow = await createActiveWindow();
if (!prototypeMode) {
  smokeWindow = activeWindow;
  runPackageSmokeIfReady();
}

app.on("window-all-closed", () => {
  if (packageSmokeState === "pending") {
    workspaceBridge?.stop();
    supervisor?.stop();
    app.exit(1);
    return;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

`createActiveWindow` resolves only after `loadURL` or `loadFile`, so both preload and renderer are loaded before the check. Normal and prototype launches never execute the script.

#### 8. `apps/desktop/tests/e2e/shell.test.ts`

**File**: `apps/desktop/tests/e2e/shell.test.ts`  
**Changes**: MODIFY — retain the attachable built-Electron launcher, assert the exact expanded allowlist, and traverse query/intent through the real browser boundary.

```ts
import { WorkspaceIntentSchema, WorkspaceQuerySchema } from "@slopstop/protocol";

const query = WorkspaceQuerySchema.parse({
  query: "memory-library.read",
  projectId: "11111111-1111-4111-8111-111111111111",
  cursor: null,
});
const intent = WorkspaceIntentSchema.parse({
  intent: "memory.proposal.review",
  projectId: "11111111-1111-4111-8111-111111111111",
  proposalId: "22222222-2222-4222-8222-222222222222",
  decision: "accept",
  expectedProjectionRevision: 0,
});

const workspaceResults = await page.evaluate(
  async ({ query: queryInput, intent: intentInput }) => ({
    query: await window.slopstop.queryWorkspace(queryInput),
    intent: await window.slopstop.submitWorkspaceIntent(intentInput),
  }),
  { query, intent },
);

expect(workspaceResults).toEqual({
  query: {
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  },
  intent: {
    status: "unavailable",
    capability: "memory",
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  },
});
```

The normal-shell allowlist becomes exactly `getHarnessStatus`, `queryWorkspace`, `retryHarness`, `submitWorkspaceIntent`, `subscribeHarnessStatus`, and `subscribeWorkspaceNotifications`. Keep `developmentElectronExecutable`; package proof belongs to the inspector-free smoke path because fuses deny Playwright's inspector connection.

#### 9. `apps/harness/tests/integration/harness-runtime.integration.test.ts`

**File**: `apps/harness/tests/integration/harness-runtime.integration.test.ts`  
**Changes**: MODIFY — add intent-result and projection-invalidation structured-clone cases beside the locked query case.

Replace the existing protocol and harness import declarations with the merged imports below, retain the `MessageChannel`, Vitest, `transportFor`, and `nextMessage` declarations, then add the test inside the existing describe block.

```ts
import {
  createWorkspaceIntentCommand,
  protocolVersion,
  WorkspaceIntentResultSchema,
  WorkspaceIntentSchema,
  type WorkspaceNotification,
  WorkspaceNotificationSchema,
  WorkspaceQueryResultSchema,
} from "@slopstop/protocol";
import {
  type HarnessTransport,
  type WorkspaceApplication,
  startHarnessRuntime,
} from "../../src/index.js";

it("round-trips workspace intent and invalidation over structured clone", async () => {
  const { port1, port2 } = new MessageChannel();
  let notificationSubscriber:
    | ((notification: WorkspaceNotification) => void)
    | undefined;
  const workspaceApplication: WorkspaceApplication = {
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
      notificationSubscriber = listener;
      return () => {
        notificationSubscriber = undefined;
      };
    },
  };
  let generatedId = 2;
  const stop = startHarnessRuntime({
    transport: transportFor(port1),
    workspaceApplication,
    harnessVersion: "0.0.0",
    createId: () =>
      `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-08-14T12:00:01.000Z",
  });
  const intent = WorkspaceIntentSchema.parse({
    intent: "memory.proposal.review",
    projectId: "00000000-0000-4000-8000-000000000010",
    proposalId: "00000000-0000-4000-8000-000000000011",
    decision: "accept",
    expectedProjectionRevision: 0,
  });
  const intentResponse = nextMessage(port2);

  port2.postMessage(
    createWorkspaceIntentCommand(
      {
        messageId: "00000000-0000-4000-8000-000000000001",
        sentAt: "2026-08-14T12:00:00.000Z",
      },
      intent,
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
  notificationSubscriber(
    WorkspaceNotificationSchema.parse({
      capability: "memory",
      scope: {
        kind: "project",
        projectId: "00000000-0000-4000-8000-000000000010",
      },
      revision: 1,
    }),
  );

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

  stop();
  expect(notificationSubscriber).toBeUndefined();
  port1.close();
  port2.close();
});
```

### Test Contract:

- **Behavior**: Preload validates query and intent inputs before IPC and validates each result before renderer delivery.
  - Test: `validates workspace requests and results at preload` -> `apps/desktop/src/preload/preload.test.ts`
  - Oracle: a valid Memory query/intent invokes only its exact channel with the exact parsed value and returns the exact parsed unavailable result; an extra input property rejects before `ipcRenderer.invoke`; a malformed IPC result rejects and never returns to the caller as a typed result.
  - Expected red: the preload exposes no workspace operations before Phase 5.
- **Behavior**: Workspace notification subscription validates delivery and removes the exact Electron listener.
  - Test: `validates and unsubscribes workspace notifications` -> `apps/desktop/src/preload/preload.test.ts`
  - Oracle: subscription calls `ipcRenderer.on("workspace:notification", receive)` once; invoking receive with Memory/project revision `1` calls the listener once with the parsed notification; revision `-1` throws before listener invocation; unsubscribe calls `ipcRenderer.off` once with the same channel and receive function, and a second subscription owns a distinct function.
  - Expected red: no browser notification subscription exists before Phase 5.
- **Behavior**: The packaged renderer proof accepts only the exact production boundary result.
  - Test: `validates exact packaged renderer boundary results` -> `apps/desktop/src/main/package-smoke-verifier.test.ts`
  - Oracle: exact six-method/no-Node/unavailable query-and-intent results pass; a wrong method, Node exposure, ready/empty query, forwarded intent, or malformed shape each throws; the script contains only fixed parsed query/intent JSON and no environment interpolation.
  - Expected red: the current package smoke checks only harness readiness and contains no renderer boundary result validator.
- **Behavior**: Built Electron exposes exactly the six-method safe API and no Node globals.
  - Test: `shows a real harness connection behind the strict renderer boundary` -> `apps/desktop/tests/e2e/shell.test.ts`
  - Oracle: status reaches `Harness ready`; `process` and `require` are `undefined`; sorted keys equal exactly `getHarnessStatus, queryWorkspace, retryHarness, submitWorkspaceIntent, subscribeHarnessStatus, subscribeWorkspaceNotifications`.
  - Expected red: the preload exposes only the original three methods before Phase 5.
- **Behavior**: Query and intent cross the real renderer-to-harness chain without inventing producers.
  - Test: `returns truthful unavailable workspace results through Electron` -> `apps/desktop/tests/e2e/shell.test.ts`
  - Oracle: the exact Memory query returns status unavailable, echoes the exact query, code `WORKSPACE_CAPABILITY_UNAVAILABLE`, message `Memory producer is unavailable.`, and no projection; the exact Memory intent returns status unavailable, capability memory, the same code/message, and no forwarded, receipt, applied, rejected, or revision field.
  - Expected red: query and intent methods are absent from the preload before Phase 5.
- **TDD-exempt regression**: `round-trips workspace intent and invalidation over structured clone` in `apps/harness/tests/integration/harness-runtime.integration.test.ts` — intent dispatch and notification emission were implemented and TDD-covered in Phase 2; Phase 5 only adds structured-clone regression coverage. The test locks the exact unavailable intent-result envelope with matching causation, the exact invalidation envelope with null causation and the next sequence, subscriber cleanup on stop, and both MessagePorts closing.
- **Behavior**: The packaged executable proves the full fixed boundary without enabling an inspector.
  - Test: `pnpm package:smoke` -> `apps/desktop/tests/e2e/package-smoke.mjs`
  - Oracle: the package starts with existing fuses, waits for both harness-ready and renderer-loaded, runs the fixed six-method/no-Node/query/intent check, and exits `0` on the exact unavailable results; mismatch/rejection behavior is pinned by `validates exact packaged renderer boundary results` and the main catch branch exits nonzero.
  - Expected red: the current packaged smoke exits after harness readiness without inspecting the renderer or workspace path.
- **TDD-exempt regression**: The existing `opens the isolated supervision prototype at wide and narrow widths` test remains unchanged and must preserve all wide/narrow visual and interaction assertions, undefined `process`/`require`, and undefined `window.slopstop`; Phase 5 intentionally changes neither prototype window creation nor prototype source.

### Success Criteria:

#### Automated Verification:

- [x] Preload tests pass: `pnpm exec vitest run apps/desktop/src/preload/preload.test.ts`
- [x] Package verifier tests pass: `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts`
- [x] Existing renderer tests pass: `pnpm exec vitest run apps/desktop/src/renderer/app.test.tsx`
- [x] Structured-clone integration passes: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts`
- [x] Desktop type checking passes: `pnpm --filter @slopstop/desktop typecheck`
- [x] Changed files and tests pass Biome: `pnpm exec biome check apps/desktop/src/shared/desktop-api.ts apps/desktop/src/preload/preload.ts apps/desktop/src/preload/preload.test.ts apps/desktop/src/main/package-smoke-verifier.ts apps/desktop/src/main/package-smoke-verifier.test.ts apps/desktop/src/main/main.ts apps/desktop/src/renderer/app.test.tsx apps/desktop/vitest.main.config.ts apps/desktop/tests/e2e/shell.test.ts apps/desktop/tests/e2e/package-smoke.mjs apps/harness/tests/integration/harness-runtime.integration.test.ts`
- [x] Architecture boundaries pass: `pnpm check:boundaries`
- [x] Cross-platform harness bundle path regression passes: `pnpm exec vitest run apps/desktop/src/main/harness-supervisor.test.ts`
- [x] Built Electron E2E passes after packaging: `pnpm --filter @slopstop/desktop test:e2e`
- [x] Inspector-free packaged boundary smoke passes: `pnpm package:smoke`
- [x] The unmodified deep gate was run: `pnpm check:deep`; it stopped at pre-existing formatting failures in untracked `.impeccable/design.json` and `.rpiv/artifacts/research/2026-08-21_packaged-persistence-boundary-report.json`. The gate was not weakened and neither file was changed.

#### Manual Verification:

- [x] `window.d.ts` remains a type alias to `SlopStopApi`, not a duplicate interface shape.
- [x] Renderer production source and prototype source are unchanged.
- [x] Preload exposes only six named methods and no raw `ipcRenderer` or event object.
- [x] Query, intent, result, and notification values are parsed with protocol schemas at preload.
- [x] The fixed `executeJavaScript` probe accepts no external value, runs only under packaged smoke, and leaves Electron fuses unchanged.
- [x] A packaged-smoke window close before exact validation exits nonzero; only the explicit `passed` state may quit normally.
- [x] No source imports prototype fixtures or adds an in-memory producer.

## Ordering Constraints

- Phase 1 precedes every consumer because it creates identities and inactive workspace schemas without widening the live process vocabulary.
- Phase 2 activates protocol version 2 and the matching harness dispatch atomically, then precedes desktop work so every accepted workspace command has a truthful result before IPC exposes it.
- Phase 3 must preserve the existing harness-ready journey before Phase 4 can depend on the extracted session.
- Phase 4 establishes main-process correlation and IPC before Phase 5 exposes browser capabilities.
- No phase may import prototype fixtures or add a production-ready producer disguised as an in-memory fallback.
- Issue #45 must be accepted before a later renderer-presentation plan consumes these capabilities.
- Issue #41 must settle physical ownership before durable Conversation, Frame, or Memory adapters are planned.
- Issue #40 follows accepted physical storage and remains outside this tracer bullet.
- Issue #36 must settle Board indexing before Attention receives a durable production implementation.
- Execution, Evidence, repository/Git, Integration-review, and Verified Memory producer contracts each require their own accepted design before replacing the unavailable ports.

## Verification Notes

- Pin exact unavailable and broken outputs for each query family; empty collections are not substitutes.
- Pin protocol-version mismatch separately from structurally invalid workspace messages.
- Preserve `system.handshake`, `system.ready`, and `system.failure` behavior while extending message unions.
- Prove that an older query result or invalidation revision cannot replace newer state.
- Prove that an intent with no producer returns a non-durable capability failure and never a canonical rejection or receipt.
- Prove pending requests fail distinctly if the harness disconnects or returns an invalid message.
- Keep preload input as `unknown` until schema parsing succeeds.
- Assert the exact browser allowlist and absence of `process` and `require` in a real Electron launch.
- Run structured-clone integration proof for every new process envelope.
- Run package smoke because the foundation needed packaged sandbox follow-up work.
- Run cross-platform path assertions because the foundation needed a path-specific CI correction.
- Do not weaken the global gate to bypass the pre-existing malformed historical JSON artifact; report that blocker separately if it remains.

## Performance Considerations

- Queries are capability- and scope-specific; the bridge never transfers a whole workspace snapshot.
- Notifications carry only capability, scope, and revision, then trigger a fresh query.
- Conversation and Memory projection contracts expose opaque cursors so producers can paginate later without fixing an unevidenced page-size default now.
- The tracer bridge fails pending requests on disconnect and protocol failure. A real producer cannot replace an unavailable port until its program supplies an Evidence-backed request-deadline policy; this plan does not choose a timeout value.
- Invalidations may be coalesced only when the highest revision for each capability/scope is preserved.
- The renderer never reduces domain events, preventing unbounded local replay and duplicated state ownership.

## Migration Notes

No persisted schema or user data changes in this tracer bullet. The only dependency metadata migration is the generated `pnpm-lock.yaml` update for `@slopstop/protocol` depending on `@slopstop/kernel`. Durable adapter work must wait for issues #41 and #40 and carry its own forward migration, backup, restore, and rollback plan.

## Pattern References

- `packages/protocol/src/protocol.ts:137-195` — strict parse-result union and distinct incompatible/invalid errors.
- `packages/protocol/src/protocol.test.ts:24-113` — exact protocol boundary test style.
- `apps/harness/src/harness-runtime.ts:9-58` — transport-independent runtime seam.
- `apps/harness/src/harness-runtime.test.ts:16-97` — deterministic public-port behavior tests.
- `apps/harness/tests/integration/harness-runtime.integration.test.ts:6-58` — real structured-clone adapter proof.
- `apps/desktop/src/main/harness-supervisor.ts:103-199` — explicit lifecycle failure and recovery state.
- `apps/desktop/src/main/main.ts:18-32` — thin IPC wiring and repeated validation.
- `apps/desktop/src/preload/preload.ts:5-25` — browser boundary revalidation and unsubscribe pattern.
- `apps/desktop/src/renderer/app.test.tsx:19-74` — fake preload implementation at the public renderer seam.
- `apps/desktop/tests/e2e/shell.test.ts:40-60` — attachable built-Electron capability and isolation proof.
- `apps/desktop/tests/e2e/package-smoke.mjs:6-51` — cross-platform packaged executable and exit-code proof.

## Developer Context

**Q (`.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:543-547`, `apps/desktop/src/main/main.ts:68-132`): How should #47 treat unresolved visual acceptance in #45?**  
A: Design now, but block final production-renderer implementation until #45 is accepted.

**Q (`CONTEXT.md:153-155`, `apps/desktop/src/renderer/prototype/prototype-app.tsx:1952-1979`, `apps/harness/src/harness-runtime.ts:33-58`): Which graph owns the direct-response Context record?**  
A: Conversation owns the durable record; Execution only produces the provider result.

**Q (`CONTEXT.md:67-69`, `apps/desktop/src/renderer/prototype/prototype-app.tsx:1402-1492`): Which history owns recoverable Review annotations and proposed diffs before acceptance?**  
A: Frame draft history; accepted checkpoints create canonical Accepted revisions.

**Q (`CONTEXT.md:153-155`, `CONTEXT.md:57-59`): Does Worker context use the same contract as direct Conversation context?**  
A: Preserve the same provenance rule but use separate owner contracts for Conversation and Execution.

**Q (`apps/desktop/src/shared/desktop-api.ts:3-13`, `packages/protocol/src/protocol.ts:17-73`): Which interface should cross preload?**  
A: Three operations with closed unions: query, submit intent, and subscribe to notifications.

**Q (`apps/desktop/src/main/harness-supervisor.ts:201-267`): Where should typed process transport live?**  
A: Extract `HarnessSession`; keep lifecycle and health in `HarnessSupervisor`.

**Q (`apps/desktop/src/renderer/app.tsx:68-89`): What should live updates transport?**  
A: Revisioned invalidation; consumers re-query and reject older revisions.

**Q (`apps/harness/src/harness-runtime.ts:33-58`): What is the first executable delivery without producer contracts?**  
A: A truthful end-to-end tracer bullet using ready/unavailable/broken contracts and unavailable production ports.

**Q (`.rpiv/decisions/degrade-distinguishes-broken.md:18-24`, `CONTEXT.md:94-99`): Which risk anchors the first Test Contract?**  
A: Prove unavailable versus broken first; revision ordering, intent failure, and Electron isolation follow in later phases.

**Q (`apps/desktop/src/main/harness-supervisor.ts:20-22`): How should pending workspace requests expire before latency Evidence exists?**  
A: Fail them on disconnect or protocol failure; no real producer may replace an unavailable port until an Evidence-backed deadline policy is accepted.

**Q (`apps/desktop/src/main/harness-session.ts`, `.rpiv/decisions/degrade-distinguishes-broken.md:18-24`): How should session transport failure be classified?**  
A: Add `WORKSPACE_TRANSPORT_FAILED`; do not misreport it as a producer failure.

**Q (`apps/desktop/forge.config.ts:45-53`, `apps/desktop/tests/e2e/package-smoke.mjs:21-51`): How can the real packaged renderer boundary be proved without weakening Electron fuses?**  
A: Keep inspector-backed Playwright on built Electron and extend the existing packaged smoke with one fixed, schema-backed renderer check that exits nonzero on any mismatch.

## Plan History

- Phase 1: Workspace Protocol Foundation — revised after approval: added `WORKSPACE_TRANSPORT_FAILED`, query/projection identity matching, unique/disjoint selections, projection referential integrity, and capability/scope-compatible invalidations
- Phase 2: Harness Capability Dispatch — revised after approval: added exhaustive desktop health handling, capability-specific owner notifications, pre-sequence notification validation, and emission-order sequence allocation
- Phase 3: Validated Harness Session — approved as generated
- Phase 4: Main-Process Workspace Bridge — revised after approval: moved browser-interface widening to Phase 5, matched response content/capability, rejected request-ID collisions, and shared revision floors across invalidations and ready queries
- Phase 5: Renderer-Safe Workspace Bridge — revised after approval: separated attachable built-Electron E2E from fixed inspector-free package proof, completed all structured-clone envelopes, and prevented early package-smoke close from passing

## References

- `.rpiv/artifacts/research/2026-08-25_14-22-52_workspace-production-boundaries.md`
- `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md`
- `.rpiv/artifacts/solutions/2026-08-22_22-52-33_end-state-comprehension-strategies.md`
- `.rpiv/artifacts/research/2026-08-25_packaged-writer-lease-probe-report.json`
- `PRODUCT.md`
- `CONTEXT.md`
- `docs/adr/0001-repository-foundation.md`
- `docs/adr/0002-project-canonical-state.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`
- `.rpiv/decisions/shared-vocab-union.md`
- `https://github.com/TheMastermindPT/slopstop/issues/36`
- `https://github.com/TheMastermindPT/slopstop/issues/40`
- `https://github.com/TheMastermindPT/slopstop/issues/41`
- `https://github.com/TheMastermindPT/slopstop/issues/45`
- `https://github.com/TheMastermindPT/slopstop/issues/47`

## Follow-up: 2026-08-25T18:57:48+0100

- Revised the Phase 5 intent/invalidation structured-clone item to `TDD-exempt regression` after validation confirmed that Phase 2 already owned the production behavior.
- Retained the exact regression Oracle and test path; no production scope or implementation phase changed.

## TDD Evidence (implement)

### Phase 1: Workspace Protocol Foundation
- Behavior: Domain UUID and projection-revision schemas accept only valid boundary values. — Test: `accepts branded identities and safe non-negative projection revisions` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts` -> `ProjectIdSchema` was undefined because workspace identity schemas did not exist.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts` -> pass
- Behavior: Ready query results preserve query-to-projection pairing and strict object shape. — Test: `rejects a projection that does not match its query` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "rejects a projection that does not match its query"` -> `WorkspaceQueryResultSchema` was undefined because no workspace query/result union existed.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "rejects a projection that does not match its query"` -> pass
- Behavior: Ready projections reject incoherent internal references and duplicate identities. — Test: `enforces projection identity and reference integrity` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "enforces projection identity and reference integrity"` -> duplicate projection records parsed successfully.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "enforces projection identity and reference integrity"` -> pass
- Behavior: Missing capability and failed producer remain distinguishable for every query family. — Test: `keeps unavailable distinct from broken` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "keeps unavailable distinct from broken"` -> the ready-only query-result union rejected `unavailable`.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "keeps unavailable distinct from broken"` -> pass
- Behavior: Workspace intents are closed, stale-aware, and never imply a canonical result. — Test: `parses only declared workspace intents and forwarded transport results` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "parses only declared workspace intents and forwarded transport results"` -> `WorkspaceIntentSchema` was undefined.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "parses only declared workspace intents and forwarded transport results"` -> pass
- Behavior: Conversation influence selection cannot contain duplicate or contradictory message identities. — Test: `requires unique disjoint influence selections` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "requires unique disjoint influence selections"` -> duplicate influence selections parsed successfully.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "requires unique disjoint influence selections"` -> pass
- Behavior: Projection invalidations accept zero/new revisions and reject unsafe ordering values. — Test: `validates revisioned workspace invalidations` (`packages/protocol/src/workspace-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "validates revisioned workspace invalidations"` -> `WorkspaceNotificationSchema` was undefined.
  - Green: `pnpm exec vitest run packages/protocol/src/workspace-protocol.test.ts -t "validates revisioned workspace invalidations"` -> pass
- Test-lint: unavailable
- Mutation: unavailable
- Code Health: unavailable

### Phase 2: Harness Capability Dispatch
- Behavior: Protocol version 2 adds closed workspace command, result, and invalidation envelopes without weakening handshake parsing. — Test: `parses workspace query, intent, result, and invalidation envelopes` (`packages/protocol/src/protocol.test.ts`)
  - Red: the protocol exported only version-1 handshake/failure envelopes, so workspace variants and their factories were absent.
  - Green: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/workspace-application.test.ts apps/harness/src/harness-runtime.test.ts` -> pass (18 tests)
- Behavior: Owner-specific ports keep unavailable, broken, and forwarded outcomes truthful for all query and intent families. — Tests: `apps/harness/src/workspace-application.test.ts`
  - Red: `workspace-application.ts` did not exist, so no application seam could dispatch to Conversation, Frame, or Memory owners.
  - Green: the focused protocol/harness command above passes, including all five owner-dispatch behaviors.
- Behavior: Runtime dispatch never answers a workspace request with `system.ready`, allocates sequence numbers in emission order, and fails invalid producer notifications visibly. — Tests: `apps/harness/src/harness-runtime.test.ts`
  - Red: the handshake-only runtime rejected workspace messages; it had no owner dispatch or notification subscription.
  - Green: the focused protocol/harness command above passes, including unavailable dispatch, concurrent completion order, and invalid-notification failure.
- Behavior: Workspace envelopes survive the real structured-clone transport. — Test: `round-trips an unavailable workspace query over structured clone` (`apps/harness/tests/integration/harness-runtime.integration.test.ts`)
  - Red: the existing handshake round-trip exposed the shared-port startup race before workspace transport was added; this was the same transport defect exercised by the workspace test.
  - Green: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts` -> pass (2 tests)
- Behavior: Workspace events cannot change harness health or complete startup. — Test: `ignores workspace events for health while waiting for ready` (`apps/desktop/src/main/harness-supervisor.test.ts`)
  - Red: the supervisor's non-failure branch treated every valid harness event as `system.ready`.
  - Green: `pnpm exec vitest run apps/desktop/src/main/harness-supervisor.test.ts` -> pass (6 tests)
- Regression: the protocol still reports unknown discriminators with the established normalized `invalid_value` issue, and the unsupported-peer test now sends version 1 after the shared version moved to 2.
- Quality gates: protocol, harness, and desktop typechecks pass; Biome passes; `pnpm check:boundaries` passes; `pnpm install --lockfile-only --offline` reports the lockfile up to date.
- Test-lint: unavailable
- Mutation: not required by this phase's test contract
- Code Health: SonarQube snippet analysis of `apps/harness/src/harness-runtime.ts` returned 0 issues; CodeScene unavailable

### Phase 3: Validated Harness Session
- Behavior: Incoming harness values are validated once and malformed values become a distinct protocol error. — Test: `publishes validated messages and a distinct protocol error` (`apps/desktop/src/main/harness-session.test.ts`)
  - Red: `HarnessSession` and `harness-session.ts` did not exist.
  - Green: `pnpm exec vitest run apps/desktop/src/main/harness-session.test.ts apps/desktop/src/main/harness-supervisor.test.ts` -> pass (10 tests)
- Behavior: Replacement and detach leave exactly one active port and signal each real disconnection once. — Test: `owns one active message port` (`apps/desktop/src/main/harness-session.test.ts`)
  - Red: port ownership was private ad hoc state in `HarnessSupervisor`.
  - Green: the focused session/supervisor command above passes.
- Behavior: Sending distinguishes invalid input, no port, successful delivery, and transport failure. — Test: `returns exact send outcomes` (`apps/desktop/src/main/harness-session.test.ts`)
  - Red: no reusable validated send seam existed.
  - Green: the focused session/supervisor command above passes.
- Behavior: Workspace messages remain observable without changing health. — Test: `publishes workspace messages without changing supervisor status` (`apps/desktop/src/main/harness-supervisor.test.ts`)
  - Red: `HarnessSupervisor.getSession` did not exist and valid Workspace events were consumed privately.
  - Green: the focused session/supervisor command above passes.
- Behavior: Handshake send failure crashes startup immediately and creates no timeout. — Test: `fails startup immediately when the session cannot send handshake` (`apps/desktop/src/main/harness-supervisor.test.ts`)
  - Red: direct `postMessage` let the transport exception escape and had no explicit failure result.
  - Green: the focused session/supervisor command above passes.
- Regression: `pnpm exec vitest run apps/desktop/src/renderer/app.test.tsx` -> pass (2 tests); existing supervisor lifecycle, retry, backoff, timeout, logging, failure, and stop assertions remain green.
- Quality gates: desktop typecheck passes; Biome passes; `pnpm check:boundaries` passes.
- Test-lint: unavailable
- Mutation: not required by this phase's test contract
- Code Health: SonarQube snippet analysis of `apps/desktop/src/main/harness-session.ts` returned 0 issues; CodeScene unavailable

### Phase 4: Main-Process Workspace Bridge
- Behavior: Responses settle only the request named by `causationId`, including out-of-order completion. — Test: `correlates out-of-order workspace responses` (`apps/desktop/src/main/workspace-bridge.test.ts`)
  - Red: `workspace-bridge.ts` did not exist, so main had no pending-request map or correlation seam.
  - Green: `pnpm exec vitest run apps/desktop/src/main/workspace-bridge.test.ts` -> pass (14 tests)
- Behavior: Session send failures, lifecycle loss, malformed correlation, and request-ID collisions become explicit broken transport results without blaming an owner. — Tests: send/loss/correlation/collision cases in `apps/desktop/src/main/workspace-bridge.test.ts`
  - Red: there was no Workspace bridge or transport-specific diagnostic path.
  - Green: the focused Workspace bridge command above passes.
- Behavior: Invalidation and ready-query revisions share a monotonic floor per capability and scope. — Tests: `publishes only increasing projection revisions per scope` and `rejects stale ready query projections` (`apps/desktop/src/main/workspace-bridge.test.ts`)
  - Red: no main-process revision reducer existed.
  - Green: the focused Workspace bridge command above passes.
- Behavior: Connected requests remain pending until a response or lifecycle failure; no timeout is invented. — Test: `keeps a connected pending request until response or lifecycle failure` (`apps/desktop/src/main/workspace-bridge.test.ts`)
  - Red: no request bridge existed.
  - Green: the focused Workspace bridge command above passes after advancing fake time by 60 seconds.
- Behavior: Main validates renderer input and broadcasts only validated notifications to live windows. — Test: `keeps workspace IPC handlers narrow and validated` (`apps/desktop/src/main/workspace-bridge.test.ts`)
  - Red: `registerWorkspaceIpc`, `broadcastWorkspaceNotification`, and the three Workspace IPC channels did not exist.
  - Green: the focused Workspace bridge command above passes.
- Regression: `pnpm exec vitest run apps/desktop/src/main/harness-session.test.ts apps/desktop/src/main/harness-supervisor.test.ts` -> pass (10 tests).
- Quality gates: desktop typecheck passes; Biome passes; `pnpm check:boundaries` passes.
- Test-lint: unavailable
- Mutation: not required by this phase's test contract
- Code Health: SonarQube snippet analysis of `apps/desktop/src/main/workspace-bridge.ts` returned 0 issues; CodeScene unavailable

### Phase 5: Renderer-Safe Workspace Bridge
- Behavior: Preload validates Workspace query/intent input before IPC and validates each result before delivery. — Test: `validates workspace requests and results at preload` (`apps/desktop/src/preload/preload.test.ts`)
  - Red: `queryWorkspace` and `submitWorkspaceIntent` were absent from the exposed preload API.
  - Green: `pnpm exec vitest run apps/desktop/src/preload/preload.test.ts` -> pass (2 tests)
- Behavior: Notification subscriptions validate values and remove the exact Electron listener. — Test: `validates and unsubscribes workspace notifications` (`apps/desktop/src/preload/preload.test.ts`)
  - Red: `subscribeWorkspaceNotifications` was absent from the exposed preload API.
  - Green: the focused preload command above passes.
- Behavior: The packaged renderer verifier accepts only the exact six-method/no-Node/unavailable-result boundary. — Test: `validates exact packaged renderer boundary results` (`apps/desktop/src/main/package-smoke-verifier.test.ts`)
  - Red: `package-smoke-verifier.ts` did not exist and package smoke checked only harness readiness.
  - Green: `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts` -> pass (1 test)
- Behavior: Query, intent, and invalidation envelopes survive structured clone. — Test: `round-trips workspace intent and invalidation over structured clone` (`apps/harness/tests/integration/harness-runtime.integration.test.ts`)
  - Red: no additional implementation red was required because Phase 2 had already added the shared runtime path; Phase 5 added the missing transport regression proof.
  - Green: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts` -> pass (3 tests)
- Runtime proof: `pnpm --filter @slopstop/desktop test:e2e` -> pass (4 tests), including exact six-method exposure, no renderer Node globals, truthful unavailable query/intent results, minimum-window layout, and the unchanged prototype journey.
- Package proof: `pnpm package:smoke` -> pass; the fused executable waited for harness readiness and renderer load, validated the fixed renderer boundary without an inspector, and exited 0.
- Regression: renderer tests pass (2 tests); supervisor tests pass (7 tests); desktop typecheck, Biome, and `pnpm check:boundaries` pass.
- Deep gate: `pnpm check:deep` was run unchanged and stopped at the pre-existing formatting failures in untracked `.impeccable/design.json` and `.rpiv/artifacts/research/2026-08-21_packaged-persistence-boundary-report.json`; neither unrelated file was modified.
- Test-lint: unavailable
- Mutation: not required by this phase's test contract
- Code Health: SonarQube snippet analysis of `apps/desktop/src/main/package-smoke-verifier.ts` returned 0 issues; CodeScene unavailable

### Validation Follow-up: 2026-08-25T18:57:48+0100
- Evidence correction: Phase 2 test `parses workspace commands and correlated result events under protocol version 2` proves query command/result envelopes, version rejection, unknown variants, and handshake regression exactly as its Test Contract states; intent and invalidation transport are proved separately by harness integration.
- TDD-exempt regression: `round-trips workspace intent and invalidation over structured clone` — Phase 2 already implemented and TDD-covered intent dispatch and notification emission; the Phase 5 test adds transport regression coverage only, as recorded by the revised contract.
- Behavior: Packaged smoke accepts only the exact top-level production boundary result. — Test: `validates exact packaged renderer boundary results` (`apps/desktop/src/main/package-smoke-verifier.test.ts`)
  - Red: `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts` -> `{ ...exactResult, injected: true }` was accepted instead of throwing.
  - Green: `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts` -> pass
- Test-strengthening: `rejects stale ready query projections` now proves a Memory/project revision floor still accepts an independent Conversation/Waypoint ready projection at revision `1`.
  - Green: `pnpm exec vitest run apps/desktop/src/main/workspace-bridge.test.ts -t "rejects stale ready query projections"` -> pass
- Package proof: `pnpm package:smoke` -> pass after exact top-level key validation was added.
- Test-lint: unavailable
- Mutation: unavailable
- Code Health: SonarQube found `typescript:S2871` after the strict-key change; adding an explicit `localeCompare` comparator removed the issue, and the re-analysis returned 0 issues.
- Coverage follow-up: `normalizes ready and explicit owner outcomes` covers valid ready projections, explicit unavailable/broken fallbacks, and thrown intent forwarding; `pnpm test:coverage` now passes with 96.96% harness branch coverage and 81.3% overall branch coverage.
- Dead-code follow-up: removed the unused public export from the internal `WorkspaceBridge` class. `pnpm check:dead-code` now reports only pre-existing symbols under the untracked renderer prototype.
- Remaining deep-gate blockers are unrelated: formatting of untracked `.impeccable/design.json` and the packaged-persistence report, plus Knip findings confined to the untracked prototype. Lint, all package typechecks, 68 unit tests, coverage, integration, duplication, architecture, dependency boundaries, Electron E2E, and packaged smoke pass independently.

### Mutation Follow-up: 2026-08-25T20:04:53+0100
- Added StrykerJS 10 with the Vitest runner and a risk-scoped `pnpm test:mutation` gate over the ten Workspace boundary modules. Static initialization mutants are ignored; runtime predicates and refinements remain in scope.
- First full run: 1,416 mutants, score 68.29%, exposing actionable gaps in cleanup, correlation, multi-item identity integrity, owner outcomes, preload validation, exact backoff, and package-result validation.
- Red: `blocks automatic recovery for malformed and explicit protocol failures` retried before the killed child emitted `exit` and observed one orphaned handshake timer instead of zero.
- Green: `HarnessSupervisor.retry()` now clears timers, detaches the stale session, and releases the stale child before spawning; the focused supervisor suite, all 92 unit tests, coverage, Electron E2E, and packaged smoke pass.
- Final mutation gate: `pnpm test:mutation` passes at 89.01% across 1,427 mutants. Survivors in the refactored protocol, supervisor, and bridge modules were rechecked as equivalent control-flow mutations or non-contract diagnostic presentation; no newly killable contract mutation remains.

### Final Quality Follow-up: 2026-08-25T21:25:52+0100
- CodeScene installation verification passes all five checks. Every analyzable Workspace file changed by this plan was reviewed and refactored to Code Health 10.
- The repository-wide CodeScene gate remains red only for the separate renderer prototype and Writer Lease probe; those files are outside this plan and were not changed by the final quality pass.
- Final local gates pass: lint, typecheck, 92 unit tests, 3 process-boundary integration tests, 84.88% branch coverage, dependency boundaries, zero duplicate blocks, valid LikeC4 architecture, 4 packaged Electron journeys, packaged launch smoke, and the 89.01% mutation gate.
- SonarQube is not reported as clean after the final Code Health refactor. The connected MCP rejects both batch and single-file analysis, and project lookup returns no `slopstop` project; the failure is recorded as an external broken gate in the validation artifact.
