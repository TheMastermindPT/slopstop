---
date: 2026-08-31T21:44:55+0100
author: Pedro Mesquita
commit: f4685df
branch: design/ticket-86-project-storage
repository: slopstop
topic: "Project Storage Opening And Health Classification"
tags: [plan, storage, persistence, protocol, harness, electron]
status: ready
parent: .rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md
last_updated: 2026-09-02T22:48:10+0100
last_updated_by: OpenCode
last_updated_note: "Finalize the prospective recovery matrix, owning-phase Reds, bounded process/privacy proof, and Phase 6 admission gate."
content_hash: a62b70902edf3426ebf015dd57287bf3ff781e9a60a8da982c3f3e27aa1f6ef5
---

# Project Storage Opening And Health Classification Implementation Plan

## Overview

This plan implements the finalized Project Storage boundary adjacent to Workspace. Versioned `project.open`, `project.create`, and `project.close` commands cross the existing desktop-to-harness session; a harness-owned persistence adapter manages independent Project sessions, staged idempotent first-generation creation, explicit canonical/runtime health, and fail-closed prior-state witnesses.

The first persistent schemas contain only Storage behavior exercised by this plan. Electron main supplies trusted `userData` and migration-resource roots without adding a renderer or preload API, and real target-platform package scenarios prove native libSQL and migration-resource closure.

Create authority hashes the complete versioned request before registry inspection, validates the persisted fingerprint on replay, and treats an orphan registry location at the deterministic normalized Project path as a witness. Typed database specifications enumerate exact token-normalized CHECK expressions, named-index columns and predicates, and full foreign-key metadata in addition to the exact eight tables; real SQLite metadata validation rejects omitted, extra, malformed, or same-name altered objects with stable path-free diagnostics and never creates an implicit ledger. Shutdown closes admission immediately, drains every admitted open/create/close operation, retains late opening-release failures for the original shared stop Promise, then releases retained sessions in admission order and registry authority; database clients always release canonical before runtime regardless of concurrent probe completion order.

Opening treats an active registration pointer that contradicts the selected active generation/location row as broken application authority, never recovery-required, and checks application integrity before returning any registry status. One memoized application-client initialization Promise is shared across concurrent Projects; only the current Promise clears the slot, failure closes one candidate and permits retry, and stop closes the one retained successful client after operation drain. Desktop shutdown is an observed async chain from bridge stop through natural harness exit, a five-second graceful deadline, kill, and a five-second terminal deadline. Missing terminal exit rejects shutdown with `HARNESS_SHUTDOWN_TIMEOUT`, exits Desktop nonzero, and fences duplicate retry; only confirmed exit reports stopped. Packaged proof runs a complete negative authorization matrix before any valid Storage scenario, uses fixed `relative-smoke-root` rather than cross-drive-sensitive `path.relative`, explicitly removes omitted values from inherited child environments, and keeps any symlink marker target outside the authorized root.

Write transactions preserve a failed operation or commit followed by failed rollback as an ordered internal cause while exposing only the path-free `Project Storage transaction rollback failed.` diagnostic. Handshake timeout remains supervisor `degraded`; only synchronous spawn failure is asserted as `crashed`. Harness fatal values and child process output are metadata-only. Desktop JSONL records are at most 8 KiB, runtime rotation keeps one 5 MiB active file plus one 5 MiB archive, and Sentry removes `frame.abs_path` while retaining its disabled-by-default environment gate.

The six design slices remain six sequential phases. A no-code Recovery Admission Gate first locks all clause dispositions and C51-C54 Test Contracts. Each failing test is then authored and observed as the first action in its owning phase: C51 in Phase 1, C52-C54 in Phase 3, harness fatal privacy in Phase 2, and Desktop shutdown/log/Sentry remediation in Phase 5. Each Green is followed by a separate review/refactor gate. Phase 6 is terminal and cannot begin until the complete Phase 1-5 recovery admission gate passes.

## Desired End State

Electron main can open, create, and close Storage without exposing paths or persistence APIs to the renderer:

```ts
const missing = await projectStorageBridge.open({ projectId });
// { status: "not-registered", request: { projectId } }

const created = await projectStorageBridge.create({ projectId, createRequestId });
// {
//   status: "created",
//   request: { projectId, createRequestId },
//   mode: "read-write",
//   identity: {
//     storageId,
//     generationId,
//     canonicalDatabaseLineageId,
//     runtimeDatabaseLineageId,
//   },
// }

const opened = await projectStorageBridge.open({ projectId });
// {
//   status: "opened",
//   request: { projectId },
//   mode: "read-write",
//   identity: {
//     storageId,
//     generationId,
//     canonicalDatabaseLineageId,
//     runtimeDatabaseLineageId,
//   },
//   canonicalHealth: { status: "healthy" },
//   runtimeHealth: { status: "healthy" },
// }

await projectStorageBridge.close({ projectId });
```

A witnessed failure remains explicit and non-destructive:

```ts
const result = await projectStorageBridge.open({ projectId });
// {
//   status: "safe-mode",
//   request: { projectId },
//   mode: "safe-mode",
//   identity: {
//     storageId,
//     generationId,
//     canonicalDatabaseLineageId,
//     runtimeDatabaseLineageId,
//   },
//   canonicalHealth: { status: "healthy" },
//   runtimeHealth: {
//     status: "corrupt",
//     diagnostic: { code: "DATABASE_CORRUPT", message },
//   },
// }
```

## What We're NOT Doing

- Backup, export, migration of existing data, restore, import, rollback, runtime reset, deletion, retention, or registry reconstruction.
- Canonical writer leases, Typed-command settlement, Board, Conversation, Frame, Memory, Run/Worker Execution, Evidence, Finding, Candidate, or Integration behavior.
- Application active-Project selection or automatic reopen policy.
- Renderer, preload, or public IPC methods for Project Storage.
- Multiple simultaneous active Projects in the UI; multiple harness sessions do not change the single active-Project product rule.
- Mastra-private schema inspection or migration.
- A claimed database-level read-only security boundary unsupported by the selected libSQL client.
- Cross-database transaction or automatic cleanup of uncertain staged output.

## Recovery Execution Contract (2026-09-02)

### Authority And Worktree

- The current dirty Phase 1-5 source is non-authoritative reference only. Do not reset, clean, overwrite, copy wholesale, or use its Green state as chronological Red proof.
- After this design/plan is accepted and issue 87 is unblocked, create an isolated worktree/branch from clean commit `f4685df`. Bring only accepted artifacts and the single current slice's public tests into it.
- The Test Contracts below are locked before Phase 1. A future phase's failing test is not added early where it would keep earlier phases uncompilable; it is added and observed immediately before that behavior's implementation in its owning phase.
- Historical `## TDD Evidence (implement)` remains append-only provenance. It cannot satisfy prospective authorization. New isolated Red/Green/review evidence is appended separately with worktree/commit identity.
- Every Phase 1-5 behavior has the clause-level disposition recorded below. `genuine isolated redo` requires a newly observed failure before production behavior. `behavior-preserving pre-existing Green` permits no invented Red and no production delta, but still requires rerunning the named test. Any `broken/unrecoverable` result blocks final validation.
- Every retained or revised automated and manual Success Criterion is unchecked and must be rerun, or individually replaced by accepted equivalent proof, in the isolated worktree.

### Recovery Phase Ownership

- Phase 1: C51 exhaustive blocked-reason/diagnostic mapping.
- Phase 2: metadata-only uncaught-exception and unhandled-rejection process handling.
- Phase 3: C52 token-normalized CHECK equality, C53 exact partial-index predicates, C54 same-name altered CHECK/index/foreign-key matrix, repaired generated-migration reproducibility, and the focused harness mutation run.
- Phase 4: no new production scope; complete its full prospective redo and all seven manual checks.
- Phase 5: metadata-only child output, bounded post-kill terminal shutdown, 8 KiB valid JSON records, runtime 5 MiB plus one 5 MiB archive, Sentry `frame.abs_path` removal, and the focused Desktop mutation run.
- Phase 6 admission: all prior clause dispositions, Success Criteria, review/refactor gates, migration reproducibility, and both mutation runs are accepted before packaging work starts.

### Pino Constraint

Pino's official API permits custom writable destinations and a synchronous `hooks.streamWrite` transformation that must return valid stringified JSON. Its help recommends external `logrotate`, and asynchronous destinations require explicit flushing. Because packaged SlopStop must enforce the same bound on Windows without host tooling, Phase 5 uses a synchronous in-process rotating destination. Records over 8 KiB are replaced with a small valid JSON `LOG_RECORD_TRUNCATED` diagnostic rather than byte-truncated.

### Clause-Level Prospective Dispositions

Every row names one existing Phase 1-5 Test Contract behavior. The new C51-C54, process-fatal, shutdown-terminal, logging, and Sentry behaviors are separately marked genuine isolated redo in their owning amended Test Contracts.

| Phase | Test Contract behavior | Prospective disposition |
|---|---|---|
| 1 | strict Storage identities | genuine isolated redo |
| 1 | mutually exclusive open results | genuine isolated redo |
| 1 | health-bound diagnostics | genuine isolated redo |
| 1 | strict create/close branches | genuine isolated redo |
| 2 | protocol-v3 Storage round-trip | genuine isolated redo |
| 2 | truthful no-store unavailability | genuine isolated redo |
| 2 | distinct owner failure classes | genuine isolated redo |
| 2 | one correlated runtime result | genuine isolated redo |
| 2 | neutral unexpected-failure diagnostic | genuine isolated redo |
| 2 | structured-clone Storage envelopes | genuine isolated redo |
| 2 | observable idempotent runtime stop | genuine isolated redo |
| 2 | awaited retained cleanup | genuine isolated redo |
| 2 | port-close rejection handling | genuine isolated redo |
| 3 | strict deterministic manifest v1 | genuine isolated redo |
| 3 | sealed initial generation | genuine isolated redo |
| 3 | exact initial database schema | genuine isolated redo |
| 3 | exact SQL UUID segments | genuine isolated redo |
| 3 | exact database metadata | genuine isolated redo |
| 3 | generated-resource guards | genuine isolated redo |
| 3 | pending migration suffix | genuine isolated redo |
| 3 | transaction/rollback dual failure | genuine isolated redo |
| 3 | malformed application authority | genuine isolated redo |
| 3 | all prior-state witnesses | genuine isolated redo |
| 3 | orphan registry-location witness | genuine isolated redo |
| 3 | filesystem witness before initialization | genuine isolated redo |
| 3 | inspection failure versus absence | genuine isolated redo |
| 3 | fingerprint before registry decision | genuine isolated redo |
| 3 | replay/conflict/registration precedence | genuine isolated redo |
| 3 | replay fingerprint mismatch | genuine isolated redo |
| 3 | installation-wide create serialization | genuine isolated redo |
| 3 | durable authority before witnesses | genuine isolated redo |
| 3 | incomplete replay remains witness | genuine isolated redo |
| 3 | checkpoint-safe creation failure | genuine isolated redo |
| 3 | no-session lifecycle | genuine isolated redo |
| 4 | healthy opening ignores mutable hashes | genuine isolated redo |
| 4 | database-health classification | genuine isolated redo |
| 4 | corruption precedence | genuine isolated redo |
| 4 | corrupt versus broken probes | genuine isolated redo |
| 4 | non-initializing absence/witness opening | genuine isolated redo |
| 4 | shared orphan-location classification | genuine isolated redo |
| 4 | top-level application failures | genuine isolated redo |
| 4 | application integrity precedence | genuine isolated redo |
| 4 | contradictory active authority | genuine isolated redo |
| 4 | exclusive selected generation | genuine isolated redo |
| 4 | selective reopen/close/stop release | genuine isolated redo |
| 4 | shutdown by admission order | genuine isolated redo |
| 4 | deterministic aggregate shutdown | genuine isolated redo |
| 4 | deferred-close drain | genuine isolated redo |
| 4 | create-boundary shutdown fencing | genuine isolated redo |
| 4 | registry failure after create drain | genuine isolated redo |
| 4 | canonical-then-runtime release | genuine isolated redo |
| 4 | failed client acquisition cleanup | genuine isolated redo |
| 4 | shared application-client initialization | genuine isolated redo |
| 4 | stop wins late-candidate race | genuine isolated redo |
| 4 | late-release failure ownership | genuine isolated redo |
| 5 | strict trusted-root URLs | genuine isolated redo |
| 5 | derived Storage/migration roots | genuine isolated redo |
| 5 | staged generated migrations | genuine isolated redo |
| 5 | out-of-order bridge correlation | genuine isolated redo |
| 5 | stable bridge transport failures | genuine isolated redo |
| 5 | bootstrap on spawn and retry | genuine isolated redo |
| 5 | Storage traffic leaves supervisor state unchanged | behavior-preserving pre-existing Green; rerun only; no production delta |
| 5 | bounded asynchronous supervisor stop | genuine isolated redo |
| 5 | restart after completed stop | genuine isolated redo |
| 5 | shared ordered desktop shutdown | genuine isolated redo |
| 5 | persistent production composition | genuine isolated redo |
| 5 | overlapping-root rejection | genuine isolated redo |

## Phase 1: Project Storage Identities And Protocol

### Overview

Establish framework-independent Storage identities, one shared protocol identity-schema owner, and strict Project Storage request, result, health, and diagnostic schemas without activating top-level process commands.

### Changes Required:

#### 1. Framework-Independent Storage Identities
**File**: `packages/kernel/src/project-storage-identifiers.ts`
**Changes**: Add branded identities for Storage, generation, canonical/runtime database lineages, and durable Project Storage create requests.

```ts
import type { DomainIdentity } from "./workspace-identifiers.js";

export type StorageId = DomainIdentity<"StorageId">;
export type StorageGenerationId = DomainIdentity<"StorageGenerationId">;
export type CanonicalDatabaseLineageId = DomainIdentity<"CanonicalDatabaseLineageId">;
export type RuntimeDatabaseLineageId = DomainIdentity<"RuntimeDatabaseLineageId">;
export type ProjectStorageCreateRequestId = DomainIdentity<"ProjectStorageCreateRequestId">;
```

#### 2. Kernel Public Identity Exports
**File**: `packages/kernel/src/index.ts`
**Changes**: Export the new Project Storage identity types from the kernel public seam.

```ts
export type {
  CanonicalDatabaseLineageId,
  ProjectStorageCreateRequestId,
  RuntimeDatabaseLineageId,
  StorageGenerationId,
  StorageId,
} from "./project-storage-identifiers.js";
```

#### 3. Shared Domain Identity Schema Owner
**File**: `packages/protocol/src/domain-identity-schema.ts`
**Changes**: Move generic domain identity parsing and lowercase `ProjectId` validation into one package-internal owner.

```ts
import type { DomainIdentity, ProjectId as KernelProjectId } from "@slopstop/kernel";
import { isDomainIdentity } from "@slopstop/kernel";
import { z } from "zod";

export function domainIdentitySchema<T extends DomainIdentity<string>>() {
  return z.custom<T>((value) => isDomainIdentity(value));
}

export const ProjectIdSchema = domainIdentitySchema<KernelProjectId>().refine(
  (value) => value === value.toLowerCase(),
  "Project identity must use lowercase UUID text.",
);
```

#### 4. Workspace Identity Consumer
**File**: `packages/protocol/src/workspace-protocol.ts`
**Changes**: Consume the shared identity schema owner while preserving the existing `ProjectIdSchema` public export and Workspace behavior.

```ts
import type {
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
  ReviewAnnotationId as KernelReviewAnnotationId,
  WaypointId as KernelWaypointId,
  WorkspaceProjectionRevision as KernelWorkspaceProjectionRevision,
} from "@slopstop/kernel";
import { isWorkspaceProjectionRevision } from "@slopstop/kernel";
import { z } from "zod";
import { domainIdentitySchema, ProjectIdSchema } from "./domain-identity-schema.js";

export { ProjectIdSchema };
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
```

#### 5. Project Storage Protocol
**File**: `packages/protocol/src/project-storage-protocol.ts`
**Changes**: Add strict Project Storage request, result, health, identity, and diagnostic schemas with mutually exclusive open/create/close outcomes.

```ts
import type {
  CanonicalDatabaseLineageId as KernelCanonicalDatabaseLineageId,
  ProjectStorageCreateRequestId as KernelProjectStorageCreateRequestId,
  RuntimeDatabaseLineageId as KernelRuntimeDatabaseLineageId,
  StorageGenerationId as KernelStorageGenerationId,
  StorageId as KernelStorageId,
} from "@slopstop/kernel";
import { z } from "zod";
import {
  domainIdentitySchema,
  ProjectIdSchema,
} from "./domain-identity-schema.js";

function lowercaseIdentitySchema<T extends string>(schema: z.ZodType<T>) {
  return schema.refine((value) => value === value.toLowerCase(), {
    message: "Identity must use lowercase UUID text.",
  });
}

export const StorageIdSchema = lowercaseIdentitySchema(
  domainIdentitySchema<KernelStorageId>(),
);
export type StorageId = z.infer<typeof StorageIdSchema>;
export const StorageGenerationIdSchema = lowercaseIdentitySchema(
  domainIdentitySchema<KernelStorageGenerationId>(),
);
export type StorageGenerationId = z.infer<typeof StorageGenerationIdSchema>;
export const CanonicalDatabaseLineageIdSchema = lowercaseIdentitySchema(
  domainIdentitySchema<KernelCanonicalDatabaseLineageId>(),
);
export type CanonicalDatabaseLineageId = z.infer<typeof CanonicalDatabaseLineageIdSchema>;
export const RuntimeDatabaseLineageIdSchema = lowercaseIdentitySchema(
  domainIdentitySchema<KernelRuntimeDatabaseLineageId>(),
);
export type RuntimeDatabaseLineageId = z.infer<typeof RuntimeDatabaseLineageIdSchema>;
export const ProjectStorageCreateRequestIdSchema = lowercaseIdentitySchema(
  domainIdentitySchema<KernelProjectStorageCreateRequestId>(),
);
export type ProjectStorageCreateRequestId = z.infer<
  typeof ProjectStorageCreateRequestIdSchema
>;

export const PersistenceHealthSchema = z.enum([
  "healthy",
  "migration-required",
  "recovery-required",
  "missing",
  "corrupt",
  "identity-conflict",
  "unsupported-newer",
  "unavailable",
  "broken",
]);
export type PersistenceHealth = z.infer<typeof PersistenceHealthSchema>;

const DatabaseHealthDiagnosticSchema = z.strictObject({
  code: z.enum([
    "DATABASE_MIGRATION_REQUIRED",
    "DATABASE_RECOVERY_REQUIRED",
    "DATABASE_MISSING",
    "DATABASE_CORRUPT",
    "DATABASE_IDENTITY_CONFLICT",
    "DATABASE_UNSUPPORTED_NEWER",
    "DATABASE_UNAVAILABLE",
    "DATABASE_BROKEN",
  ]),
  message: z.string().min(1),
});

function unhealthyHealthSchema<
  const Status extends Exclude<PersistenceHealth, "healthy">,
  const Code extends z.infer<typeof DatabaseHealthDiagnosticSchema>["code"],
>(status: Status, code: Code) {
  return z.strictObject({
    status: z.literal(status),
    diagnostic: DatabaseHealthDiagnosticSchema.extend({ code: z.literal(code) }),
  });
}

export const ProjectDatabaseHealthSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("healthy") }),
  unhealthyHealthSchema("migration-required", "DATABASE_MIGRATION_REQUIRED"),
  unhealthyHealthSchema("recovery-required", "DATABASE_RECOVERY_REQUIRED"),
  unhealthyHealthSchema("missing", "DATABASE_MISSING"),
  unhealthyHealthSchema("corrupt", "DATABASE_CORRUPT"),
  unhealthyHealthSchema("identity-conflict", "DATABASE_IDENTITY_CONFLICT"),
  unhealthyHealthSchema("unsupported-newer", "DATABASE_UNSUPPORTED_NEWER"),
  unhealthyHealthSchema("unavailable", "DATABASE_UNAVAILABLE"),
  unhealthyHealthSchema("broken", "DATABASE_BROKEN"),
]);
export type ProjectDatabaseHealth = z.infer<typeof ProjectDatabaseHealthSchema>;

export const ProjectStorageDiagnosticCodeSchema = z.enum([
  "PROJECT_STORAGE_UNAVAILABLE",
  "PROJECT_STORAGE_OWNER_FAILED",
  "PROJECT_STORAGE_RESULT_INVALID",
  "PROJECT_STORAGE_TRANSPORT_FAILED",
  "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
  "PROJECT_STORAGE_ALREADY_REGISTERED",
  "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT",
]);
export type ProjectStorageDiagnosticCode = z.infer<
  typeof ProjectStorageDiagnosticCodeSchema
>;
export const ProjectStorageDiagnosticSchema = z.strictObject({
  code: ProjectStorageDiagnosticCodeSchema,
  message: z.string().min(1),
});
export type ProjectStorageDiagnostic = z.infer<typeof ProjectStorageDiagnosticSchema>;

export const ProjectStorageOpenRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
});
export type ProjectStorageOpenRequest = z.infer<typeof ProjectStorageOpenRequestSchema>;
export const ProjectStorageCreateRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
});
export type ProjectStorageCreateRequest = z.infer<typeof ProjectStorageCreateRequestSchema>;
export const ProjectStorageCloseRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
});
export type ProjectStorageCloseRequest = z.infer<typeof ProjectStorageCloseRequestSchema>;

const OpenedStorageIdentitySchema = z.strictObject({
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
});
export type OpenedStorageIdentity = z.infer<typeof OpenedStorageIdentitySchema>;

const OpenedResultSchema = z.strictObject({
  status: z.literal("opened"),
  request: ProjectStorageOpenRequestSchema,
  mode: z.literal("read-write"),
  identity: OpenedStorageIdentitySchema,
  canonicalHealth: z.strictObject({ status: z.literal("healthy") }),
  runtimeHealth: z.strictObject({ status: z.literal("healthy") }),
});
const SafeModeResultSchema = z.strictObject({
  status: z.literal("safe-mode"),
  request: ProjectStorageOpenRequestSchema,
  mode: z.literal("safe-mode"),
  identity: z.strictObject({
    storageId: StorageIdSchema.nullable(),
    generationId: StorageGenerationIdSchema.nullable(),
    canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.nullable(),
    runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.nullable(),
  }),
  canonicalHealth: ProjectDatabaseHealthSchema,
  runtimeHealth: ProjectDatabaseHealthSchema,
});
const NotRegisteredResultSchema = z.strictObject({
  status: z.literal("not-registered"),
  request: ProjectStorageOpenRequestSchema,
});
const OpenUnavailableResultSchema = z.strictObject({
  status: z.literal("unavailable"),
  request: ProjectStorageOpenRequestSchema,
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.literal("PROJECT_STORAGE_UNAVAILABLE"),
  }),
});
const OpenBrokenResultSchema = z.strictObject({
  status: z.literal("broken"),
  request: ProjectStorageOpenRequestSchema,
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.enum([
      "PROJECT_STORAGE_OWNER_FAILED",
      "PROJECT_STORAGE_RESULT_INVALID",
      "PROJECT_STORAGE_TRANSPORT_FAILED",
    ]),
  }),
});
export const ProjectStorageOpenResultSchema = z
  .discriminatedUnion("status", [
    OpenedResultSchema,
    SafeModeResultSchema,
    NotRegisteredResultSchema,
    OpenUnavailableResultSchema,
    OpenBrokenResultSchema,
  ])
  .superRefine((value, context) => {
    if (
      value.status === "safe-mode" &&
      value.canonicalHealth.status === "healthy" &&
      value.runtimeHealth.status === "healthy"
    ) {
      context.addIssue({
        code: "custom",
        message: "Safe mode requires at least one non-healthy database.",
        path: ["mode"],
      });
    }
  });
export type ProjectStorageOpenResult = z.infer<typeof ProjectStorageOpenResultSchema>;

const CreatedResultSchema = z.strictObject({
  status: z.literal("created"),
  request: ProjectStorageCreateRequestSchema,
  mode: z.literal("read-write"),
  identity: OpenedStorageIdentitySchema,
});
const PriorStateWitnessResultSchema = z.strictObject({
  status: z.literal("blocked"),
  request: ProjectStorageCreateRequestSchema,
  reason: z.literal("prior-state-witness"),
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.literal("PROJECT_STORAGE_PRIOR_STATE_WITNESS"),
  }),
});
const AlreadyRegisteredResultSchema = z.strictObject({
  status: z.literal("blocked"),
  request: ProjectStorageCreateRequestSchema,
  reason: z.literal("already-registered"),
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.literal("PROJECT_STORAGE_ALREADY_REGISTERED"),
  }),
});
const IdempotencyConflictResultSchema = z.strictObject({
  status: z.literal("blocked"),
  request: ProjectStorageCreateRequestSchema,
  reason: z.literal("idempotency-conflict"),
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.literal("PROJECT_STORAGE_IDEMPOTENCY_CONFLICT"),
  }),
});
const CreateUnavailableResultSchema = z.strictObject({
  status: z.literal("unavailable"),
  request: ProjectStorageCreateRequestSchema,
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.literal("PROJECT_STORAGE_UNAVAILABLE"),
  }),
});
const CreateBrokenResultSchema = z.strictObject({
  status: z.literal("broken"),
  request: ProjectStorageCreateRequestSchema,
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.enum([
      "PROJECT_STORAGE_OWNER_FAILED",
      "PROJECT_STORAGE_RESULT_INVALID",
      "PROJECT_STORAGE_TRANSPORT_FAILED",
    ]),
  }),
});
export const ProjectStorageCreateResultSchema = z.union([
  CreatedResultSchema,
  PriorStateWitnessResultSchema,
  AlreadyRegisteredResultSchema,
  IdempotencyConflictResultSchema,
  CreateUnavailableResultSchema,
  CreateBrokenResultSchema,
]);
export type ProjectStorageCreateResult = z.infer<
  typeof ProjectStorageCreateResultSchema
>;

const ClosedResultSchema = z.strictObject({
  status: z.literal("closed"),
  request: ProjectStorageCloseRequestSchema,
});
const CloseUnavailableResultSchema = z.strictObject({
  status: z.literal("unavailable"),
  request: ProjectStorageCloseRequestSchema,
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.literal("PROJECT_STORAGE_UNAVAILABLE"),
  }),
});
const CloseBrokenResultSchema = z.strictObject({
  status: z.literal("broken"),
  request: ProjectStorageCloseRequestSchema,
  diagnostic: ProjectStorageDiagnosticSchema.extend({
    code: z.enum([
      "PROJECT_STORAGE_OWNER_FAILED",
      "PROJECT_STORAGE_RESULT_INVALID",
      "PROJECT_STORAGE_TRANSPORT_FAILED",
    ]),
  }),
});
export const ProjectStorageCloseResultSchema = z.discriminatedUnion("status", [
  ClosedResultSchema,
  CloseUnavailableResultSchema,
  CloseBrokenResultSchema,
]);
export type ProjectStorageCloseResult = z.infer<typeof ProjectStorageCloseResultSchema>;
```

#### 6. Project Storage Protocol Contract Tests
**File**: `packages/protocol/src/project-storage-protocol.test.ts`
**Changes**: Prove lowercase identities, strict result branches, exact health diagnostics, and create/close result constraints.

```ts
import { describe, expect, it } from "vitest";
import {
  ProjectIdSchema,
  ProjectDatabaseHealthSchema,
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenResultSchema,
  StorageIdSchema,
} from "./index.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const createRequestId = "00000000-0000-4000-8000-000000000011";
const identity = {
  storageId: "00000000-0000-4000-8000-000000000012",
  generationId: "00000000-0000-4000-8000-000000000013",
  canonicalDatabaseLineageId: "00000000-0000-4000-8000-000000000014",
  runtimeDatabaseLineageId: "00000000-0000-4000-8000-000000000015",
} as const;
const unhealthyHealthCases = [
  ["migration-required", "DATABASE_MIGRATION_REQUIRED"],
  ["recovery-required", "DATABASE_RECOVERY_REQUIRED"],
  ["missing", "DATABASE_MISSING"],
  ["corrupt", "DATABASE_CORRUPT"],
  ["identity-conflict", "DATABASE_IDENTITY_CONFLICT"],
  ["unsupported-newer", "DATABASE_UNSUPPORTED_NEWER"],
  ["unavailable", "DATABASE_UNAVAILABLE"],
  ["broken", "DATABASE_BROKEN"],
] as const;

describe("Project Storage protocol", () => {
  it("validates Project Storage identities", () => {
    const validStorageId = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";
    const validProjectId = "018f47a3-4e3d-4d2b-9c41-7df4605c0a11";
    expect(StorageIdSchema.safeParse(validStorageId).success).toBe(true);
    expect(StorageIdSchema.safeParse(validStorageId.toUpperCase()).success).toBe(false);
    expect(ProjectIdSchema.safeParse(validProjectId).success).toBe(true);
    expect(ProjectIdSchema.safeParse(validProjectId.toUpperCase()).success).toBe(false);
    expect(StorageIdSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(
      false,
    );
    expect(StorageIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(ProjectIdSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(
      false,
    );
    expect(ProjectIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects contradictory Project Storage open results", () => {
    const opened = {
      status: "opened",
      request: { projectId },
      mode: "read-write",
      identity,
      canonicalHealth: { status: "healthy" },
      runtimeHealth: { status: "healthy" },
    } as const;
    expect(ProjectStorageOpenResultSchema.safeParse(opened).success).toBe(true);
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        ...opened,
        runtimeHealth: {
          status: "corrupt",
          diagnostic: { code: "DATABASE_CORRUPT", message: "corrupt" },
        },
      }).success,
    ).toBe(false);
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        ...opened,
        status: "safe-mode",
        mode: "safe-mode",
        runtimeHealth: {
          status: "corrupt",
          diagnostic: { code: "DATABASE_CORRUPT", message: "corrupt" },
        },
      }).success,
    ).toBe(true);
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        ...opened,
        status: "safe-mode",
        mode: "safe-mode",
      }).success,
    ).toBe(false);
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        status: "not-registered",
        request: { projectId },
        identity,
      }).success,
    ).toBe(false);
    expect(
      ProjectStorageOpenResultSchema.safeParse({ ...opened, storagePath: "private" }).success,
    ).toBe(false);
  });

  it("binds health diagnostics to exact statuses", () => {
    for (const [status, code] of unhealthyHealthCases) {
      const health = { status, diagnostic: { code, message: status } };
      const contradictoryCode =
        code === "DATABASE_CORRUPT" ? "DATABASE_MISSING" : "DATABASE_CORRUPT";
      expect(ProjectDatabaseHealthSchema.safeParse(health).success).toBe(true);
      expect(
        ProjectDatabaseHealthSchema.safeParse({
          ...health,
          diagnostic: { code: contradictoryCode, message: status },
        }).success,
      ).toBe(false);
    }
  });

  it("validates create and close result branches", () => {
    const request = { projectId, createRequestId } as const;
    expect(
      ProjectStorageCreateResultSchema.safeParse({
        status: "created",
        request,
        mode: "read-write",
        identity,
      }).success,
    ).toBe(true);
    const blocked = {
      status: "blocked",
      request,
      reason: "prior-state-witness",
      diagnostic: {
        code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
        message: "witnessed",
      },
    } as const;
    expect(ProjectStorageCreateResultSchema.safeParse(blocked).success).toBe(true);
    expect(
      ProjectStorageCreateResultSchema.safeParse({
        ...blocked,
        diagnostic: { code: "PROJECT_STORAGE_ALREADY_REGISTERED", message: "witnessed" },
      }).success,
    ).toBe(false);
    expect(
      ProjectStorageCreateResultSchema.safeParse({ ...blocked, identity }).success,
    ).toBe(false);
    expect(
      ProjectStorageCloseResultSchema.safeParse({
        status: "closed",
        request: { projectId },
      }).success,
    ).toBe(true);
    expect(
      ProjectStorageCloseResultSchema.safeParse({
        status: "closed",
        request: { projectId },
        wasOpen: false,
      }).success,
    ).toBe(false);
  });
});
```

#### 7. Protocol Public Storage Exports
**File**: `packages/protocol/src/index.ts`
**Changes**: Export Project Storage protocol types and schemas without exposing persistence implementation details.

```ts
export type {
  CanonicalDatabaseLineageId,
  OpenedStorageIdentity,
  PersistenceHealth,
  ProjectDatabaseHealth,
  ProjectStorageCloseRequest,
  ProjectStorageCloseResult,
  ProjectStorageCreateRequest,
  ProjectStorageCreateRequestId,
  ProjectStorageCreateResult,
  ProjectStorageDiagnostic,
  ProjectStorageDiagnosticCode,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
  RuntimeDatabaseLineageId,
  StorageGenerationId,
  StorageId,
} from "./project-storage-protocol.js";
export {
  CanonicalDatabaseLineageIdSchema,
  PersistenceHealthSchema,
  ProjectDatabaseHealthSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageDiagnosticCodeSchema,
  ProjectStorageDiagnosticSchema,
  ProjectStorageOpenRequestSchema,
  ProjectStorageOpenResultSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";
```

#### Recovery Amendment: C51 Exhaustive Blocked Authority
**Files**: `packages/protocol/src/project-storage-protocol.ts`, `packages/protocol/src/project-storage-protocol.test.ts`
**Changes**: Make the three blocked create branches one exhaustive reason/diagnostic authority matrix. The first Phase 1 edit adds the complete public test and records its clean-baseline failure before adding the schema implementation. No later phase may define or reinterpret this mapping.

### Test Contract:

- **Behavior**: Every blocked create reason accepts exactly its one authoritative diagnostic code and rejects both alternatives.
  - Test: `binds every blocked create reason to exactly one diagnostic` -> `packages/protocol/src/project-storage-protocol.test.ts`
  - Oracle: `prior-state-witness -> PROJECT_STORAGE_PRIOR_STATE_WITNESS`, `already-registered -> PROJECT_STORAGE_ALREADY_REGISTERED`, and `idempotency-conflict -> PROJECT_STORAGE_IDEMPOTENCY_CONFLICT` each parse with the exact echoed request; all six cross-paired reason/code combinations return `success === false`, and every branch rejects extra success identity fields.
  - Expected red: clean baseline `f4685df` has no Project Storage create-result schema or blocked-reason branches.
- **Behavior**: Project and Storage identity schemas accept lowercase RFC 4122 UUID text and reject malformed, nil-version, and uppercase identities at the protocol boundary.
  - Test: `validates Project Storage identities` -> `packages/protocol/src/project-storage-protocol.test.ts`
  - Oracle: `StorageIdSchema.safeParse("018f47a3-4e3d-7d2b-9c41-7df4605c0a11").success === true` and lowercase `ProjectIdSchema` succeeds; uppercase Project/Storage identities, `"00000000-0000-0000-0000-000000000000"`, and `"not-a-uuid"` each return `success === false`.
  - Expected red: the Storage identity types and schemas do not exist.
- **Behavior**: Open results represent healthy, safe-mode, legitimate absence, unavailable, and broken as mutually exclusive strict branches.
  - Test: `rejects contradictory Project Storage open results` -> `packages/protocol/src/project-storage-protocol.test.ts`
  - Oracle: a concrete `opened` result with both health values `healthy` parses; the same result with runtime `corrupt` fails; a `safe-mode` result with runtime `corrupt` plus `DATABASE_CORRUPT` parses; safe mode with both health values `healthy` fails; `not-registered` carrying `identity` fails; any branch carrying `storagePath` fails.
  - Expected red: no open-result union exists.
- **Behavior**: Database health diagnostics cannot contradict their health status.
  - Test: `binds health diagnostics to exact statuses` -> `packages/protocol/src/project-storage-protocol.test.ts`
  - Oracle: `{status:"missing", diagnostic:{code:"DATABASE_MISSING", message:"missing"}}` parses and the same value with code `DATABASE_CORRUPT` fails.
  - Expected red: no typed health/diagnostic mapping exists.
- **Behavior**: Create results preserve the durable create request and exact blocked reason without admitting success fields on failure.
  - Test: `validates create and close result branches` -> `packages/protocol/src/project-storage-protocol.test.ts`
  - Oracle: a concrete `created` result echoes `projectId` and `createRequestId` and parses; `blocked/prior-state-witness` with `PROJECT_STORAGE_PRIOR_STATE_WITNESS` parses; changing its code to `PROJECT_STORAGE_ALREADY_REGISTERED` fails; adding `identity` to blocked fails; `{status:"closed", request:{projectId}}` parses and rejects `wasOpen`.
  - Expected red: create/close schemas do not exist.

### Success Criteria:

#### Automated Verification:

- [ ] Every Test Contract behavior's exact Expected red, including C51, is observed and recorded from its named public-seam test before implementation begins.
- [ ] Project Storage and unchanged Workspace schemas pass: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts packages/protocol/src/workspace-protocol.test.ts`
- [ ] Kernel type checking passes: `pnpm --filter @slopstop/kernel typecheck`
- [ ] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`
- [ ] Package dependency boundaries remain valid: `pnpm check:boundaries`
- [ ] A separate Phase 1 review/refactor gate records no unresolved blocker before Phase 2.

#### Manual Verification:

- [ ] Inspect public exports and confirm no filesystem path, libSQL type, Workspace capability, or projection revision appears in the Project Storage surface.
- [ ] Inspect every result branch and confirm it echoes its request for later process correlation.

---

## Phase 2: Harness Application Port And Dispatch

### Overview

Advance the process protocol to version 3, add the validated harness Project Storage application boundary, dispatch all three commands, and retain truthful unavailable production composition until persistence lands.

### Changes Required:

#### 1. Protocol V3 Project Storage Envelopes
**File**: `packages/protocol/src/protocol.ts`
**Changes**: Advance protocol version to 3 and add Project Storage command/result envelopes, unions, and correlated factories.

```ts
import type {
  ProjectStorageCloseRequest,
  ProjectStorageCloseResult,
  ProjectStorageCreateRequest,
  ProjectStorageCreateResult,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "./project-storage-protocol.js";
import {
  ProjectStorageCloseRequestSchema,
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenRequestSchema,
  ProjectStorageOpenResultSchema,
} from "./project-storage-protocol.js";

export const protocolVersion = 3 as const;

const ProjectOpenCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.open"),
  payload: ProjectStorageOpenRequestSchema,
});
const ProjectCreateCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.create"),
  payload: ProjectStorageCreateRequestSchema,
});
const ProjectCloseCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.close"),
  payload: ProjectStorageCloseRequestSchema,
});

const ProjectOpenResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.open.result"),
  payload: ProjectStorageOpenResultSchema,
});
const ProjectCreateResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.create.result"),
  payload: ProjectStorageCreateResultSchema,
});
const ProjectCloseResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.close.result"),
  payload: ProjectStorageCloseResultSchema,
});

export const DesktopMessageSchema = z.discriminatedUnion("command", [
  HandshakeCommandSchema,
  ProjectOpenCommandSchema,
  ProjectCreateCommandSchema,
  ProjectCloseCommandSchema,
  WorkspaceQueryCommandSchema,
  WorkspaceIntentCommandSchema,
]);

export const HarnessMessageSchema = z.discriminatedUnion("event", [
  ReadyEventSchema,
  FailureEventSchema,
  ProjectOpenResultEventSchema,
  ProjectCreateResultEventSchema,
  ProjectCloseResultEventSchema,
  WorkspaceQueryResultEventSchema,
  WorkspaceIntentResultEventSchema,
  WorkspaceProjectionInvalidatedEventSchema,
]);

export function createProjectOpenCommand(
  metadata: CommandMetadata,
  request: ProjectStorageOpenRequest,
): DesktopMessage {
  return createCommand(metadata, "project.open", request);
}

export function createProjectCreateCommand(
  metadata: CommandMetadata,
  request: ProjectStorageCreateRequest,
): DesktopMessage {
  return createCommand(metadata, "project.create", request);
}

export function createProjectCloseCommand(
  metadata: CommandMetadata,
  request: ProjectStorageCloseRequest,
): DesktopMessage {
  return createCommand(metadata, "project.close", request);
}

export function createProjectOpenResultEvent(
  metadata: EventMetadata,
  result: ProjectStorageOpenResult,
): HarnessMessage {
  return createEvent(metadata, "project.open.result", result);
}

export function createProjectCreateResultEvent(
  metadata: EventMetadata,
  result: ProjectStorageCreateResult,
): HarnessMessage {
  return createEvent(metadata, "project.create.result", result);
}

export function createProjectCloseResultEvent(
  metadata: EventMetadata,
  result: ProjectStorageCloseResult,
): HarnessMessage {
  return createEvent(metadata, "project.close.result", result);
}
```

#### 2. Protocol V3 Round-Trip Tests
**File**: `packages/protocol/src/protocol.test.ts`
**Changes**: Update existing literal protocol expectations to version 3 and add Project Storage envelope round-trip and v2 rejection coverage.

The existing Workspace round-trip test is renamed to protocol version 3 and its three literal version expectations change from `2` to `3`; incompatible-version cases remain unchanged.

```ts
import {
  createProjectCloseCommand,
  createProjectCloseResultEvent,
  createProjectCreateCommand,
  createProjectCreateResultEvent,
  createProjectOpenCommand,
  createProjectOpenResultEvent,
  ProjectIdSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "./index.js";

it("round-trips Project Storage envelopes under protocol version 3", () => {
  const sentAt = "2026-08-14T12:00:00.000Z";
  const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
  const createRequestId = ProjectStorageCreateRequestIdSchema.parse(
    "00000000-0000-4000-8000-000000000011",
  );
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId,
  });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });

  const open = createProjectOpenCommand(
    { messageId: "00000000-0000-4000-8000-000000000021", sentAt },
    openRequest,
  );
  const create = createProjectCreateCommand(
    { messageId: "00000000-0000-4000-8000-000000000022", sentAt },
    createRequest,
  );
  const close = createProjectCloseCommand(
    { messageId: "00000000-0000-4000-8000-000000000023", sentAt },
    closeRequest,
  );
  const unavailable = {
    diagnostic: {
      code: "PROJECT_STORAGE_UNAVAILABLE",
      message: "Project Storage owner is unavailable.",
    },
  } as const;
  const openEvent = createProjectOpenResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000031",
      sentAt,
      sequence: 1,
      causationId: open.messageId,
    },
    { status: "unavailable", request: openRequest, ...unavailable },
  );
  const createEvent = createProjectCreateResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000032",
      sentAt,
      sequence: 2,
      causationId: create.messageId,
    },
    { status: "unavailable", request: createRequest, ...unavailable },
  );
  const closeEvent = createProjectCloseResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000033",
      sentAt,
      sequence: 3,
      causationId: close.messageId,
    },
    { status: "unavailable", request: closeRequest, ...unavailable },
  );

  expect(protocolVersion).toBe(3);
  for (const [command, event, commandName, eventName] of [
    [open, openEvent, "project.open", "project.open.result"],
    [create, createEvent, "project.create", "project.create.result"],
    [close, closeEvent, "project.close", "project.close.result"],
  ] as const) {
    expect(parseDesktopMessage(command)).toEqual({ ok: true, value: command });
    expect(parseHarnessMessage(event)).toEqual({ ok: true, value: event });
    expect(command.command).toBe(commandName);
    expect(event).toMatchObject({
      event: eventName,
      causationId: command.messageId,
      payload: { request: command.payload },
    });
    expect(parseDesktopMessage({ ...command, protocolVersion: 2 })).toEqual({
      ok: false,
      error: {
        code: "PROTOCOL_VERSION_UNSUPPORTED",
        issues: [{ code: "unsupported_value", path: "protocolVersion" }],
      },
    });
  }
});
```

#### 3. Protocol Command Factory Exports
**File**: `packages/protocol/src/index.ts`
**Changes**: Export the Project Storage command and result-event factories introduced by protocol v3.

```ts
export {
  createProjectCloseCommand,
  createProjectCloseResultEvent,
  createProjectCreateCommand,
  createProjectCreateResultEvent,
  createProjectOpenCommand,
  createProjectOpenResultEvent,
} from "./protocol.js";
```

#### 4. Harness Project Storage Application Boundary
**File**: `apps/harness/src/project-storage-application.ts`
**Changes**: Add the owner port, owner-output revalidation, unavailable/broken translation, and truthful no-store application.

```ts
import type {
  ProjectStorageCloseRequest,
  ProjectStorageCloseResult,
  ProjectStorageCreateRequest,
  ProjectStorageCreateResult,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "@slopstop/protocol";
import {
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";

export type ProjectStorageOwnerOutcome =
  | Readonly<{ status: "ready"; result: unknown }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export interface ProjectStorageOwnerPort {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOwnerOutcome>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageOwnerOutcome>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageOwnerOutcome>;
  stop(): Promise<void>;
}

export interface ProjectStorageApplication {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult>;
  stop(): Promise<void>;
}

type ResultSchema<Result> = Readonly<{
  safeParse(value: unknown):
    | Readonly<{ success: true; data: Result }>
    | Readonly<{ success: false }>;
}>;

type BrokenResultFactory<Request, Result> = (
  request: Request,
  code: "PROJECT_STORAGE_OWNER_FAILED" | "PROJECT_STORAGE_RESULT_INVALID",
  message: string,
) => Result;

function messageOr(message: string, fallback: string): string {
  return message.trim().length > 0 ? message : fallback;
}

function mapOwnerOutcome<Request, Result>(
  outcome: ProjectStorageOwnerOutcome,
  request: Request,
  schema: ResultSchema<Result>,
  requestMatches: (result: Result, request: Request) => boolean,
  unavailable: (request: Request, message: string) => Result,
  broken: BrokenResultFactory<Request, Result>,
): Result {
  switch (outcome.status) {
    case "ready": {
      const parsed = schema.safeParse(outcome.result);
      return parsed.success && requestMatches(parsed.data, request)
        ? parsed.data
        : broken(
            request,
            "PROJECT_STORAGE_RESULT_INVALID",
            "Project Storage owner returned an invalid result.",
          );
    }
    case "unavailable":
      return unavailable(
        request,
        messageOr(outcome.message, "Project Storage owner is unavailable."),
      );
    case "broken":
      return broken(
        request,
        "PROJECT_STORAGE_OWNER_FAILED",
        messageOr(outcome.message, "Project Storage owner failed."),
      );
  }
}

async function invokeOwner<Request, Result>(
  operation: (request: Request) => Promise<ProjectStorageOwnerOutcome>,
  request: Request,
  schema: ResultSchema<Result>,
  requestMatches: (result: Result, request: Request) => boolean,
  unavailable: (request: Request, message: string) => Result,
  broken: BrokenResultFactory<Request, Result>,
): Promise<Result> {
  try {
    return mapOwnerOutcome(
      await operation(request),
      request,
      schema,
      requestMatches,
      unavailable,
      broken,
    );
  } catch {
    return broken(request, "PROJECT_STORAGE_OWNER_FAILED", "Project Storage owner failed.");
  }
}

function unavailableOpen(
  request: ProjectStorageOpenRequest,
  message: string,
): ProjectStorageOpenResult {
  return ProjectStorageOpenResultSchema.parse({
    status: "unavailable",
    request,
    diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE", message },
  });
}

function brokenOpen(
  request: ProjectStorageOpenRequest,
  code: "PROJECT_STORAGE_OWNER_FAILED" | "PROJECT_STORAGE_RESULT_INVALID",
  message: string,
): ProjectStorageOpenResult {
  return ProjectStorageOpenResultSchema.parse({
    status: "broken",
    request,
    diagnostic: { code, message },
  });
}

function unavailableCreate(
  request: ProjectStorageCreateRequest,
  message: string,
): ProjectStorageCreateResult {
  return ProjectStorageCreateResultSchema.parse({
    status: "unavailable",
    request,
    diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE", message },
  });
}

function brokenCreate(
  request: ProjectStorageCreateRequest,
  code: "PROJECT_STORAGE_OWNER_FAILED" | "PROJECT_STORAGE_RESULT_INVALID",
  message: string,
): ProjectStorageCreateResult {
  return ProjectStorageCreateResultSchema.parse({
    status: "broken",
    request,
    diagnostic: { code, message },
  });
}

function unavailableClose(
  request: ProjectStorageCloseRequest,
  message: string,
): ProjectStorageCloseResult {
  return ProjectStorageCloseResultSchema.parse({
    status: "unavailable",
    request,
    diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE", message },
  });
}

function brokenClose(
  request: ProjectStorageCloseRequest,
  code: "PROJECT_STORAGE_OWNER_FAILED" | "PROJECT_STORAGE_RESULT_INVALID",
  message: string,
): ProjectStorageCloseResult {
  return ProjectStorageCloseResultSchema.parse({
    status: "broken",
    request,
    diagnostic: { code, message },
  });
}

export function createProjectStorageApplication(
  owner: ProjectStorageOwnerPort,
): ProjectStorageApplication {
  return {
    open: (request) =>
      invokeOwner(
        (value) => owner.open(value),
        request,
        ProjectStorageOpenResultSchema,
        (result, expected) => result.request.projectId === expected.projectId,
        unavailableOpen,
        brokenOpen,
      ),
    create: (request) =>
      invokeOwner(
        (value) => owner.create(value),
        request,
        ProjectStorageCreateResultSchema,
        (result, expected) =>
          result.request.projectId === expected.projectId &&
          result.request.createRequestId === expected.createRequestId,
        unavailableCreate,
        brokenCreate,
      ),
    close: (request) =>
      invokeOwner(
        (value) => owner.close(value),
        request,
        ProjectStorageCloseResultSchema,
        (result, expected) => result.request.projectId === expected.projectId,
        unavailableClose,
        brokenClose,
      ),
    stop: () => owner.stop(),
  };
}

export function createUnavailableProjectStorageApplication(): ProjectStorageApplication {
  const message = "Project Storage owner is unavailable.";
  const owner: ProjectStorageOwnerPort = {
    open: async () => ({ status: "unavailable", message }),
    create: async () => ({ status: "unavailable", message }),
    close: async () => ({ status: "unavailable", message }),
    stop: () => Promise.resolve(),
  };
  return createProjectStorageApplication(owner);
}
```

#### 5. Harness Application Boundary Tests
**File**: `apps/harness/src/project-storage-application.test.ts`
**Changes**: Prove unavailable, invalid/mismatched, failed, and shutdown behavior at the public application seam.

```ts
import type { ProjectStorageOwnerPort } from "./project-storage-application.js";
import {
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  createProjectStorageApplication,
  createUnavailableProjectStorageApplication,
} from "./project-storage-application.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const anotherProjectId = "00000000-0000-4000-8000-000000000020";
const createRequestId = "00000000-0000-4000-8000-000000000011";
const anotherCreateRequestId = "00000000-0000-4000-8000-000000000021";

function createOwner(
  overrides: Partial<ProjectStorageOwnerPort> = {},
): ProjectStorageOwnerPort {
  const unavailable = async () => ({
    status: "unavailable" as const,
    message: "Project Storage owner is unavailable.",
  });
  return {
    open: unavailable,
    create: unavailable,
    close: unavailable,
    stop: () => Promise.resolve(),
    ...overrides,
  };
}

it("keeps unavailable, invalid, and failed owner outcomes distinct", async () => {
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const unavailable = createUnavailableProjectStorageApplication();
  await expect(unavailable.open(openRequest)).resolves.toEqual({
    status: "unavailable",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_UNAVAILABLE",
      message: "Project Storage owner is unavailable.",
    },
  });

  const unavailableMessageOwner = createOwner({
    open: async () => ({ status: "unavailable", message: "Storage temporarily offline." }),
  });
  await expect(
    createProjectStorageApplication(unavailableMessageOwner).open(openRequest),
  ).resolves.toMatchObject({
    status: "unavailable",
    diagnostic: { message: "Storage temporarily offline." },
  });
  const blankUnavailableOwner = createOwner({
    open: async () => ({ status: "unavailable", message: "   " }),
  });
  await expect(
    createProjectStorageApplication(blankUnavailableOwner).open(openRequest),
  ).resolves.toMatchObject({
    status: "unavailable",
    diagnostic: { message: "Project Storage owner is unavailable." },
  });

  const invalidOwner = createOwner({
    open: async () => ({
      status: "ready",
      result: { status: "not-registered", request: { projectId: anotherProjectId } },
    }),
  });
  await expect(createProjectStorageApplication(invalidOwner).open(openRequest)).resolves.toEqual({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_RESULT_INVALID",
      message: "Project Storage owner returned an invalid result.",
    },
  });

  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId,
  });
  const mismatchedCreateOwner = createOwner({
    create: async () => ({
      status: "ready",
      result: {
        status: "unavailable",
        request: { projectId, createRequestId: anotherCreateRequestId },
        diagnostic: {
          code: "PROJECT_STORAGE_UNAVAILABLE",
          message: "Project Storage owner is unavailable.",
        },
      },
    }),
  });
  await expect(
    createProjectStorageApplication(mismatchedCreateOwner).create(createRequest),
  ).resolves.toMatchObject({
    status: "broken",
    request: createRequest,
    diagnostic: { code: "PROJECT_STORAGE_RESULT_INVALID" },
  });

  const malformedOwner = createOwner({
    open: async () => ({ status: "ready", result: null }),
  });
  await expect(createProjectStorageApplication(malformedOwner).open(openRequest)).resolves.toMatchObject({
    status: "broken",
    request: openRequest,
    diagnostic: { code: "PROJECT_STORAGE_RESULT_INVALID" },
  });

  const failedOwner = createOwner({
    open: async () => {
      throw new Error("private owner failure");
    },
  });
  await expect(createProjectStorageApplication(failedOwner).open(openRequest)).resolves.toEqual({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_OWNER_FAILED",
      message: "Project Storage owner failed.",
    },
  });

  const brokenOwner = createOwner({
    open: async () => ({ status: "broken", message: "Owner reported failure." }),
  });
  await expect(createProjectStorageApplication(brokenOwner).open(openRequest)).resolves.toMatchObject({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_OWNER_FAILED",
      message: "Owner reported failure.",
    },
  });
});

it("echoes every unavailable request and delegates stop", async () => {
  const stop = vi.fn(async () => undefined);
  const application = createProjectStorageApplication(createOwner({ stop }));
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId,
  });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });

  const [openResult, createResult, closeResult] = await Promise.all([
    application.open(openRequest),
    application.create(createRequest),
    application.close(closeRequest),
  ]);
  const diagnostic = {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: "Project Storage owner is unavailable.",
  } as const;
  expect(openResult).toEqual({ status: "unavailable", request: openRequest, diagnostic });
  expect(createResult).toEqual({
    status: "unavailable",
    request: createRequest,
    diagnostic,
  });
  expect(closeResult).toEqual({ status: "unavailable", request: closeRequest, diagnostic });

  await application.stop();
  expect(stop).toHaveBeenCalledOnce();
});
```

#### 6. Harness Runtime Dispatch
**File**: `apps/harness/src/harness-runtime.ts`
**Changes**: Inject Project Storage application ownership, dispatch open/create/close, emit correlated events, and stop Storage after inbound and Workspace subscriptions.

```ts
import {
  createProjectCloseResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
} from "@slopstop/protocol";
import type { ProjectStorageApplication } from "./project-storage-application.js";

export type StopHarnessRuntime = () => Promise<void>;

type HarnessRuntimeOptions = Readonly<{
  transport: HarnessTransport;
  workspaceApplication: WorkspaceApplication;
  projectStorageApplication: ProjectStorageApplication;
  harnessVersion: string;
  createId: () => string;
  now: () => string;
}>;

const sendInternalFailure = (causationId: string | null) => {
  options.transport.send(
    createFailureEvent(nextMetadata(causationId), {
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    }),
  );
};

switch (parsed.value.command) {
  case "system.handshake":
    options.transport.send(
      createReadyEvent(nextMetadata(causationId), options.harnessVersion),
    );
    return;
  case "project.open": {
    const result = await options.projectStorageApplication.open(parsed.value.payload);
    options.transport.send(createProjectOpenResultEvent(nextMetadata(causationId), result));
    return;
  }
  case "project.create": {
    const result = await options.projectStorageApplication.create(parsed.value.payload);
    options.transport.send(createProjectCreateResultEvent(nextMetadata(causationId), result));
    return;
  }
  case "project.close": {
    const result = await options.projectStorageApplication.close(parsed.value.payload);
    options.transport.send(createProjectCloseResultEvent(nextMetadata(causationId), result));
    return;
  }
  case "workspace.query": {
    const result = await options.workspaceApplication.query(parsed.value.payload);
    options.transport.send(createWorkspaceQueryResultEvent(nextMetadata(causationId), result));
    return;
  }
  case "workspace.intent": {
    const result = await options.workspaceApplication.submit(parsed.value.payload);
    options.transport.send(createWorkspaceIntentResultEvent(nextMetadata(causationId), result));
    return;
  }
}

let stopPromise: Promise<void> | undefined;
return () => {
  if (stopPromise !== undefined) {
    return stopPromise;
  }
  stopMessages();
  stopNotifications();
  stopPromise = options.projectStorageApplication.stop();
  return stopPromise;
};
```

#### 7. Harness Runtime Unit Tests
**File**: `apps/harness/src/harness-runtime.test.ts`
**Changes**: Update runtime fixtures, prove sequential Project Storage dispatch, emit the named rejected-open neutral failure test, and prove exact shutdown order.

Every existing `startHarnessRuntime()` construction adds `projectStorageApplication: createUnavailableProjectStorageApplication()`. The shared `startRuntime()` fixture uses the same application before adding these behavior tests.

The `StopHarnessRuntime` return type becomes asynchronous in this phase, so all eight retained live cleanup calls are explicit awaited operations. Apply this exact declaration/cleanup delta; the first four tests are already async, and the final four declarations change from synchronous to async:

| Retained test | Required declaration | Required cleanup |
|---|---|---|
| `dispatches workspace queries without false system ready` | `async () =>` | `await stop();` |
| `sequences concurrent workspace responses when they emit` | `async () =>` | `await stop();` |
| `dispatches intents and valid notifications through the runtime` | `async () =>` | `await stop();` before asserting subscriber removal |
| `turns an unexpected application rejection into correlated harness failure` | `async () =>` | `await stop();` |
| `turns an invalid workspace notification into harness failure` | `async () =>` | `await stop();` before asserting subscriber removal |
| `answers a valid handshake with an exact sequenced ready event` | `async () =>` | `await stop();` |
| `reports an unsupported peer as a failure rather than ready or absent` | `async () =>` | `await stop();` |
| `stops receiving messages after disposal` | `async () =>` | `await stop();` before `transport.emit(handshake)` |

No retained `stop();` call remains in `harness-runtime.test.ts` after this delta.

```ts
import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import {
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type ProjectStorageApplication,
  type StopHarnessRuntime,
  startHarnessRuntime,
  type WorkspaceApplication,
} from "./index.js";

it("dispatches Project Storage commands sequentially with exact unavailable results", async () => {
  const transport = new TestTransport();
  const stop = startRuntime(transport);
  const projectId = "00000000-0000-4000-8000-000000000010";
  const createRequestId = "00000000-0000-4000-8000-000000000011";
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId,
  });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });
  const openCommand = createProjectOpenCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000100",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    openRequest,
  );
  const createCommand = createProjectCreateCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000101",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    createRequest,
  );
  const closeCommand = createProjectCloseCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000102",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    closeRequest,
  );

  transport.emit(openCommand);
  await vi.waitFor(() => expect(transport.sent).toHaveLength(1));
  transport.emit(createCommand);
  await vi.waitFor(() => expect(transport.sent).toHaveLength(2));
  transport.emit(closeCommand);
  await vi.waitFor(() => expect(transport.sent).toHaveLength(3));

  expect(transport.sent).toMatchObject([
    {
      protocolVersion: 3,
      sequence: 1,
      causationId: openCommand.messageId,
      event: "project.open.result",
      payload: {
        status: "unavailable",
        request: openRequest,
        diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
      },
    },
    {
      protocolVersion: 3,
      sequence: 2,
      causationId: createCommand.messageId,
      event: "project.create.result",
      payload: {
        status: "unavailable",
        request: createRequest,
        diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
      },
    },
    {
      protocolVersion: 3,
      sequence: 3,
      causationId: closeCommand.messageId,
      event: "project.close.result",
      payload: {
        status: "unavailable",
        request: closeRequest,
        diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
      },
    },
  ]);

  await stop();
});

it("reports a neutral internal failure when Project dispatch throws", async () => {
  const transport = new TestTransport();
  const thrownMessage = "C:\\private\\project\\slopstop.db";
  const projectStorageApplication: ProjectStorageApplication = {
    open: async () => {
      throw new Error(thrownMessage);
    },
    create: async () => {
      throw new Error("Create is not used by this test.");
    },
    close: async () => {
      throw new Error("Close is not used by this test.");
    },
    stop: async () => undefined,
  };
  const stop = startHarnessRuntime({
    transport,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication,
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });
  const request = ProjectStorageOpenRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000010",
  });
  const command = createProjectOpenCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000001",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    request,
  );

  transport.emit(command);
  await vi.waitFor(() => expect(transport.sent).toHaveLength(1));

  expect(transport.sent).toEqual([
    {
      protocolVersion: 3,
      messageType: "event",
      messageId: "00000000-0000-4000-8000-000000000002",
      sentAt: "2026-08-14T12:00:01.000Z",
      sequence: 1,
      causationId: command.messageId,
      event: "system.failure",
      payload: {
        code: "HARNESS_INTERNAL_FAILURE",
        message: "Harness failed while handling a message.",
        retryable: false,
      },
    },
  ]);
  const serialized = JSON.stringify(transport.sent);
  expect(serialized.toLowerCase()).not.toContain("workspace");
  expect(serialized).not.toContain(thrownMessage);
  await stop();
});

it("stops intake before exposing one observable Project Storage stop promise", async () => {
  const calls: string[] = [];
  const stopMessages = vi.fn(() => calls.push("stopMessages"));
  const stopNotifications = vi.fn(() => calls.push("stopNotifications"));
  const shutdownFailure = new Error("private shutdown failure");
  const projectStorageStop = Promise.reject(shutdownFailure);
  const stopProjectStorage = vi.fn(() => {
    calls.push("projectStorageApplication.stop");
    return projectStorageStop;
  });
  const transport: HarnessTransport = {
    send: () => undefined,
    subscribe: () => stopMessages,
  };
  const workspaceApplication: WorkspaceApplication = {
    query: async () => {
      throw new Error("Queries are not used by this test.");
    },
    submit: async () => {
      throw new Error("Intents are not used by this test.");
    },
    subscribe: () => stopNotifications,
  };
  const projectStorageApplication: ProjectStorageApplication = {
    open: async () => {
      throw new Error("Open is not used by this test.");
    },
    create: async () => {
      throw new Error("Create is not used by this test.");
    },
    close: async () => {
      throw new Error("Close is not used by this test.");
    },
    stop: stopProjectStorage,
  };
  const stop = startHarnessRuntime({
    transport,
    workspaceApplication,
    projectStorageApplication,
    harnessVersion: "0.0.0",
    createId: () => "00000000-0000-4000-8000-000000000002",
    now: () => "2026-08-14T12:00:01.000Z",
  });

  const firstStop = stop();
  const repeatedStop = stop();

  expect(calls).toEqual([
    "stopMessages",
    "stopNotifications",
    "projectStorageApplication.stop",
  ]);
  expect(stopMessages).toHaveBeenCalledOnce();
  expect(stopNotifications).toHaveBeenCalledOnce();
  expect(stopProjectStorage).toHaveBeenCalledOnce();
  expect(repeatedStop).toBe(firstStop);
  await expect(firstStop).rejects.toBe(shutdownFailure);
});
```

#### 8. Observable Process Shutdown Boundary
**Files**: `apps/harness/src/process-shutdown.ts`, `apps/harness/src/process-shutdown.test.ts`, `apps/harness/src/process-entry.ts`
**Changes**: Observe the async runtime stop once on port close, preserve the existing generic success log, and terminate nonzero with only the generic shutdown diagnostic on rejection.

```ts
// process-shutdown.ts
import type { StopHarnessRuntime } from "./harness-runtime.js";

type HarnessShutdownObserverOptions = Readonly<{
  stopRuntime: StopHarnessRuntime;
  succeeded(message: "Harness message port closed."): void;
  failed(message: "Harness shutdown failed."): void;
}>;

export function createHarnessPortCloseHandler(
  options: HarnessShutdownObserverOptions,
): () => void {
  let shutdownObservation: Promise<void> | undefined;
  return () => {
    if (shutdownObservation !== undefined) {
      return;
    }
    shutdownObservation = options.stopRuntime().then(
      () => options.succeeded("Harness message port closed."),
      () => options.failed("Harness shutdown failed."),
    );
  };
}
```

```ts
// process-shutdown.test.ts
import { expect, it, vi } from "vitest";
import { createHarnessPortCloseHandler } from "./process-shutdown.js";

it("observes one runtime shutdown rejection without forwarding its cause", async () => {
  const privateFailure = new Error("C:\\private\\project\\slopstop.db");
  const stopRuntime = vi.fn(() => Promise.reject(privateFailure));
  const succeeded = vi.fn();
  const failed = vi.fn();
  const close = createHarnessPortCloseHandler({ stopRuntime, succeeded, failed });

  close();
  close();

  await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
  expect(stopRuntime).toHaveBeenCalledOnce();
  expect(succeeded).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledWith("Harness shutdown failed.");
  expect(JSON.stringify(failed.mock.calls)).not.toContain(privateFailure.message);
});
```

#### 9. Structured-Clone Runtime Integration
**File**: `apps/harness/tests/integration/harness-runtime.integration.test.ts`
**Changes**: Update the runtime fixture and prove all unavailable Project Storage commands across a real `MessageChannel` seam.

The existing `startRuntimeFixture()` adds `projectStorageApplication: createUnavailableProjectStorageApplication()` beside its injected Workspace application, then adds the structured-clone scenario below.

All three retained integration tests are already async. Replace each bare cleanup call with `await stop();` before either message port is closed: `round-trips an unavailable workspace query over structured clone`, `round-trips workspace intent and invalidation over structured clone`, and `round-trips the versioned startup handshake over structured clone`. The new Project Storage round-trip coverage below also awaits stop. No `stop();` call remains in this file, and no runtime-stop Promise floats past `port1.close()` or `port2.close()`.

```ts
import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { createUnavailableProjectStorageApplication } from "../../src/index.js";

it("round-trips all unavailable Project Storage commands over structured clone", async () => {
  const { port1, port2, stop } = startRuntimeFixture(
    createUnavailableWorkspaceApplication(),
  );
  const projectId = "00000000-0000-4000-8000-000000000010";
  const createRequestId = "00000000-0000-4000-8000-000000000011";
  const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId });
  const createRequest = ProjectStorageCreateRequestSchema.parse({
    projectId,
    createRequestId,
  });
  const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId });
  const openCommand = createProjectOpenCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000100",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    openRequest,
  );
  const createCommand = createProjectCreateCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000101",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    createRequest,
  );
  const closeCommand = createProjectCloseCommand(
    {
      messageId: "00000000-0000-4000-8000-000000000102",
      sentAt: "2026-08-14T12:00:00.000Z",
    },
    closeRequest,
  );

  const openResponse = nextMessage(port2);
  port2.postMessage(openCommand);
  await expect(openResponse).resolves.toEqual({
    protocolVersion: 3,
    messageType: "event",
    messageId: "00000000-0000-4000-8000-000000000002",
    sentAt: "2026-08-14T12:00:01.000Z",
    sequence: 1,
    causationId: openCommand.messageId,
    event: "project.open.result",
    payload: {
      status: "unavailable",
      request: openRequest,
      diagnostic: {
        code: "PROJECT_STORAGE_UNAVAILABLE",
        message: "Project Storage owner is unavailable.",
      },
    },
  });

  const createResponse = nextMessage(port2);
  port2.postMessage(createCommand);
  await expect(createResponse).resolves.toEqual({
    protocolVersion: 3,
    messageType: "event",
    messageId: "00000000-0000-4000-8000-000000000003",
    sentAt: "2026-08-14T12:00:01.000Z",
    sequence: 2,
    causationId: createCommand.messageId,
    event: "project.create.result",
    payload: {
      status: "unavailable",
      request: createRequest,
      diagnostic: {
        code: "PROJECT_STORAGE_UNAVAILABLE",
        message: "Project Storage owner is unavailable.",
      },
    },
  });

  const closeResponse = nextMessage(port2);
  port2.postMessage(closeCommand);
  await expect(closeResponse).resolves.toEqual({
    protocolVersion: 3,
    messageType: "event",
    messageId: "00000000-0000-4000-8000-000000000004",
    sentAt: "2026-08-14T12:00:01.000Z",
    sequence: 3,
    causationId: closeCommand.messageId,
    event: "project.close.result",
    payload: {
      status: "unavailable",
      request: closeRequest,
      diagnostic: {
        code: "PROJECT_STORAGE_UNAVAILABLE",
        message: "Project Storage owner is unavailable.",
      },
    },
  });

  await stop();
  port1.close();
  port2.close();
});
```

#### 10. Truthful Unavailable Process Composition
**File**: `apps/harness/src/process-entry.ts`
**Changes**: Supply the no-store Project Storage application to the runtime while keeping bootstrap path-free and persistence absent in this phase.

#### 11. Harness Public Application Exports
**File**: `apps/harness/src/index.ts`
**Changes**: Export the Project Storage application seam, owner types, and unavailable composition factory.

```ts
export type { HarnessTransport, StopHarnessRuntime } from "./harness-runtime.js";
export { startHarnessRuntime } from "./harness-runtime.js";
export type {
  ProjectStorageApplication,
  ProjectStorageOwnerOutcome,
  ProjectStorageOwnerPort,
} from "./project-storage-application.js";
export {
  createProjectStorageApplication,
  createUnavailableProjectStorageApplication,
} from "./project-storage-application.js";
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

#### Recovery Amendment: Metadata-Only Harness Fatal Boundary
**Files**: `apps/harness/src/process-fatal-diagnostics.ts`, `apps/harness/src/process-fatal-diagnostics.test.ts`, `apps/harness/src/process-entry.ts`
**Changes**: Add one injected process-fatal boundary used by both `uncaughtException` and `unhandledRejection`. It classifies only `error | string | number | boolean | bigint | symbol | function | object | null | undefined`, logs that controlled kind plus a stable code/message, and exits `1`. It never passes the caught value, message, stack, object fields, source text, path, or environment value to Pino.

### Test Contract:

- **Behavior**: Harness uncaught exceptions and unhandled rejections emit only stable bounded metadata before nonzero exit.
  - Test: `reports process fatal values as metadata only` -> `apps/harness/src/process-fatal-diagnostics.test.ts`
  - Oracle: an `Error("private C:\\repo\\source.ts")` invokes fatal logging exactly with `{code:"HARNESS_UNCAUGHT_EXCEPTION", valueKind:"error"}` and `Harness encountered an uncaught exception.`; `{token:"secret"}` invokes exactly `{code:"HARNESS_UNHANDLED_REJECTION", valueKind:"object"}` and `Harness encountered an unhandled rejection.`; each invokes injected exit with `1`, and serialized logger calls contain neither `private`, `source.ts`, `token`, nor `secret`.
  - Expected red: current process entry passes raw `error` and `reason` values to Pino and has no metadata-only fatal boundary.
- **Behavior**: Protocol v3 round-trips each Project Storage command and its correlated result while rejecting protocol v2.
  - Test: `round-trips Project Storage envelopes under protocol version 3` -> `packages/protocol/src/protocol.test.ts`
  - Oracle: factories emit `project.open`, `project.create`, and `project.close` commands with `protocolVersion === 3`; the corresponding result events parse, carry `causationId === command.messageId`, and echo `event.payload.request === command.payload`; parsing each command after replacing its version with `2` returns `PROTOCOL_VERSION_UNSUPPORTED` at `protocolVersion`.
  - Expected red: protocol v2 has no Project Storage envelope variants or factories.
- **Behavior**: The no-store application reports every operation as unavailable and never invents `not-registered`.
  - Test: `echoes every unavailable request and delegates stop` -> `apps/harness/src/project-storage-application.test.ts`
  - Oracle: open, create, and close each resolve to `{status:"unavailable", request:<exact input>, diagnostic:{code:"PROJECT_STORAGE_UNAVAILABLE", message:"Project Storage owner is unavailable."}}`; none resolves to `not-registered`.
  - Expected red: no Project Storage application boundary or truthful no-store owner exists.
- **Behavior**: Owner absence, malformed/mismatched owner output, and owner failure remain distinct at the application boundary.
  - Test: `keeps unavailable, invalid, and failed owner outcomes distinct` -> `apps/harness/src/project-storage-application.test.ts`
  - Oracle: explicit unavailable preserves a non-blank owner message or uses the exact fallback; a schema-valid result echoing another `projectId`, a create result echoing another `createRequestId`, or malformed output becomes `broken/PROJECT_STORAGE_RESULT_INVALID` with the invoked request; explicit broken or a thrown owner call becomes `broken/PROJECT_STORAGE_OWNER_FAILED` and never leaks the thrown message.
  - Expected red: owner output currently has no Storage-specific revalidation boundary.
- **Behavior**: Every valid Project Storage command receives exactly one correlated result event from the harness runtime.
  - Test: `dispatches Project Storage commands sequentially with exact unavailable results` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: sequential open/create/close commands produce event names `project.open.result`, `project.create.result`, and `project.close.result`, sequences `1`, `2`, and `3`, each with `causationId` equal to its command `messageId`, exact request echoing, and `PROJECT_STORAGE_UNAVAILABLE` from the composed no-store application.
  - Expected red: the runtime switch has no Project Storage branches and cannot accept protocol v3 messages.
- **Behavior**: Unexpected command failures use one domain-neutral process diagnostic.
  - Test: `reports a neutral internal failure when Project dispatch throws` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: when `project.open` throws, the runtime emits exactly one correlated `system.failure` with `HARNESS_INTERNAL_FAILURE`, `retryable:false`, and message `Harness failed while handling a message.`; the diagnostic contains neither `Workspace` nor the thrown message.
  - Expected red: the existing internal failure diagnostic says it was handling a Workspace message.
- **Behavior**: Project Storage envelopes survive the real structured-clone transport seam.
  - Test: `round-trips all unavailable Project Storage commands over structured clone` -> `apps/harness/tests/integration/harness-runtime.integration.test.ts`
  - Oracle: posting each concrete command through `MessageChannel` resolves to its concrete v3 result event with exact `causationId`, request echo, unavailable status, and diagnostic code; no response contains a filesystem path.
  - Expected red: the integration runtime has no Project Storage application or dispatch.
- **Behavior**: Runtime shutdown detaches intake once and returns one observable Project Storage stop Promise.
  - Test: `stops intake before exposing one observable Project Storage stop promise` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: two calls to the returned stop function return the same Promise; calls occur in exact order `stopMessages`, `stopNotifications`, `projectStorageApplication.stop`, each once; rejection from Project Storage is the rejection observed by the caller.
  - Expected red: runtime shutdown has no Project Storage lifecycle hook.
- **Behavior**: Every retained runtime-test cleanup observes the asynchronous stop before teardown continues.
  - Tests: all eight retained tests in `apps/harness/src/harness-runtime.test.ts`; all three retained tests plus the new Project Storage round-trip in `apps/harness/tests/integration/harness-runtime.integration.test.ts`
  - Oracle: every live cleanup is `await stop();`; the four formerly synchronous unit tests are async; each integration cleanup awaits stop before `port1.close()` and `port2.close()`; neither file contains a bare `stop();` call.
  - Expected red: changing `StopHarnessRuntime` from `() => void` to `() => Promise<void>` leaves eleven retained bare calls and four synchronous unit test declarations.
- **Behavior**: Port-close shutdown observes rejection once and forwards only the generic process diagnostic.
  - Test: `observes one runtime shutdown rejection without forwarding its cause` -> `apps/harness/src/process-shutdown.test.ts`
  - Oracle: two close notifications invoke runtime stop once; success logging is absent; failure receives exactly `Harness shutdown failed.` with no error argument, caught text, or path.
  - Expected red: process entry invokes synchronous stop and logs success without observing cleanup failure.

### Success Criteria:

#### Automated Verification:

- [ ] Every Test Contract behavior's exact Expected red, including process fatal privacy, is observed and recorded from its named public-seam test before implementation begins.
- [ ] Protocol and harness unit tests pass: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/project-storage-application.test.ts apps/harness/src/harness-runtime.test.ts apps/harness/src/process-shutdown.test.ts apps/harness/src/process-fatal-diagnostics.test.ts`
- [ ] Structured-clone integration passes: `pnpm exec vitest run apps/harness/tests/integration/harness-runtime.integration.test.ts`
- [ ] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`
- [ ] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [ ] Static cleanup audit finds no retained floating runtime stop: searching `apps/harness/src/harness-runtime.test.ts` and `apps/harness/tests/integration/harness-runtime.integration.test.ts` finds no bare `stop();`, and all integration port closes follow `await stop();`.
- [ ] Package dependency boundaries remain valid: `pnpm check:boundaries`
- [ ] A separate Phase 2 review/refactor gate records no unresolved blocker before Phase 3.

#### Manual Verification:

- [ ] Inspect the exhaustive runtime switch and confirm every accepted v3 command has one result event path and uses transport `messageId`, not `createRequestId`, for `causationId`.
- [ ] Inspect production composition and confirm bootstrap remains path-free and no registry, filesystem, libSQL, or Drizzle behavior has entered this slice.
- [ ] Confirm `not-registered` appears only in a validated ready owner result and never in no-store/unavailable conversion.
- [ ] Confirm runtime and process shutdown expose one retained Promise, detach intake once, and convert shutdown rejection only at process entry with the generic path-free message.
- [ ] Confirm uncaught exceptions and unhandled rejections expose only stable code/value-kind metadata and never raw values, messages, stacks, source, environment data, or paths.

---

## Phase 3: Staged Creation And Witness Guard

### Overview

Introduce the minimal generated schemas, explicit migration authority, manifest boundary, deterministic witness namespace, durable staged creation, exact create replay, and crash-safe refusal to clean up uncertain output.

### Changes Required:

#### 1. Shared SQLite Identity Constraints
**File**: `apps/harness/src/storage/storage-schema-constraints.ts`
**Changes**: Add the shared lowercase RFC 4122 identity check used by all three Drizzle schemas.

```ts
import { sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export function domainIdentityCheck(column: AnySQLiteColumn) {
  return sql`
    length(${column}) = 36
    and ${column} = lower(${column})
    and substr(${column}, 1, 8) not glob '*[^0-9a-f]*'
    and substr(${column}, 9, 1) = '-'
    and substr(${column}, 10, 4) not glob '*[^0-9a-f]*'
    and substr(${column}, 14, 1) = '-'
    and substr(${column}, 15, 1) glob '[1-8]'
    and substr(${column}, 16, 3) not glob '*[^0-9a-f]*'
    and substr(${column}, 19, 1) = '-'
    and substr(${column}, 20, 1) glob '[89ab]'
    and substr(${column}, 21, 3) not glob '*[^0-9a-f]*'
    and substr(${column}, 24, 1) = '-'
    and substr(${column}, 25, 12) not glob '*[^0-9a-f]*'
  `;
}
```

#### 2. Application Registry Schema
**File**: `apps/harness/src/storage/application-schema.ts`
**Changes**: Define only application schema metadata, Storage registrations, locations, and generations with activation consistency constraints.

```ts
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

export const applicationSchemaMetadata = sqliteTable(
  "schema_metadata",
  {
    metadataKey: text("metadata_key").primaryKey(),
    databaseKind: text("database_kind").notNull(),
    formatVersion: integer("format_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    lastMigrationId: text("last_migration_id").notNull(),
  },
  (table) => [
    check("application_metadata_key", sql`${table.metadataKey} = 'application'`),
    check("application_metadata_kind", sql`${table.databaseKind} = 'application'`),
    check("application_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("application_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check(
      "application_migration_nonempty",
      sql`length(trim(${table.lastMigrationId})) > 0`,
    ),
  ],
);

export const storageLocations = sqliteTable(
  "storage_locations",
  {
    storageId: text("storage_id").notNull(),
    locationId: text("location_id").notNull(),
    normalizedPath: text("normalized_path").notNull(),
    locationState: text("location_state", {
      enum: ["staging", "committed"],
    }).notNull(),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_locations_pk",
      columns: [table.storageId, table.locationId],
    }),
    uniqueIndex("storage_locations_normalized_path_uq").on(table.normalizedPath),
    check("storage_locations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_locations_location_id_uuid", domainIdentityCheck(table.locationId)),
    check(
      "storage_locations_state",
      sql`${table.locationState} in ('staging', 'committed')`,
    ),
  ],
);

export const storageGenerations = sqliteTable(
  "storage_generations",
  {
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    projectId: text("project_id").notNull(),
    locationId: text("location_id").notNull(),
    canonicalLineageId: text("canonical_lineage_id").notNull(),
    runtimeLineageId: text("runtime_lineage_id").notNull(),
    createRequestId: text("create_request_id").notNull(),
    createRequestFingerprint: text("create_request_fingerprint").notNull(),
    generationDirectoryName: text("generation_directory_name").notNull(),
    creationState: text("creation_state", {
      enum: ["staging", "active"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
  },
  (table) => [
    primaryKey({
      name: "storage_generations_pk",
      columns: [table.storageId, table.generationId],
    }),
    foreignKey({
      name: "storage_generations_location_fk",
      columns: [table.storageId, table.locationId],
      foreignColumns: [storageLocations.storageId, storageLocations.locationId],
    }).onDelete("restrict"),
    uniqueIndex("storage_generations_create_request_uq").on(table.createRequestId),
    uniqueIndex("storage_generations_directory_uq").on(
      table.storageId,
      table.generationDirectoryName,
    ),
    uniqueIndex("storage_generations_one_active_uq")
      .on(table.storageId)
      .where(sql`${table.creationState} = 'active'`),
    index("storage_generations_project_idx").on(table.projectId),
    index("storage_generations_state_idx").on(table.storageId, table.creationState),
    check("storage_generations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check(
      "storage_generations_generation_id_uuid",
      domainIdentityCheck(table.generationId),
    ),
    check("storage_generations_project_id_uuid", domainIdentityCheck(table.projectId)),
    check("storage_generations_location_id_uuid", domainIdentityCheck(table.locationId)),
    check(
      "storage_generations_canonical_lineage_uuid",
      domainIdentityCheck(table.canonicalLineageId),
    ),
    check(
      "storage_generations_runtime_lineage_uuid",
      domainIdentityCheck(table.runtimeLineageId),
    ),
    check(
      "storage_generations_create_request_uuid",
      domainIdentityCheck(table.createRequestId),
    ),
    check(
      "storage_generations_fingerprint_sha256",
      sql`
        length(${table.createRequestFingerprint}) = 64
        and ${table.createRequestFingerprint} = lower(${table.createRequestFingerprint})
        and ${table.createRequestFingerprint} not glob '*[^0-9a-f]*'
      `,
    ),
    check(
      "storage_generations_directory_identity",
      sql`${table.generationDirectoryName} = ${table.generationId}`,
    ),
    check(
      "storage_generations_activation_time",
      sql`
        (${table.creationState} = 'active' and ${table.activatedAt} is not null)
        or (${table.creationState} = 'staging' and ${table.activatedAt} is null)
      `,
    ),
  ],
);

export const storageRegistrations = sqliteTable(
  "storage_registrations",
  {
    storageId: text("storage_id").primaryKey(),
    projectId: text("project_id").notNull(),
    activeGenerationId: text("active_generation_id"),
    activeLocationId: text("active_location_id"),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
  },
  (table) => [
    uniqueIndex("storage_registrations_project_uq").on(table.projectId),
    foreignKey({
      name: "storage_registrations_active_generation_fk",
      columns: [table.storageId, table.activeGenerationId],
      foreignColumns: [storageGenerations.storageId, storageGenerations.generationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "storage_registrations_active_location_fk",
      columns: [table.storageId, table.activeLocationId],
      foreignColumns: [storageLocations.storageId, storageLocations.locationId],
    }).onDelete("restrict"),
    check("storage_registrations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_registrations_project_id_uuid", domainIdentityCheck(table.projectId)),
    check(
      "storage_registrations_active_pair",
      sql`
        (
          ${table.activeGenerationId} is null
          and ${table.activeLocationId} is null
          and ${table.activatedAt} is null
        )
        or (
          ${table.activeGenerationId} is not null
          and ${table.activeLocationId} is not null
          and ${table.activatedAt} is not null
        )
      `,
    ),
  ],
);
```

#### 3. Canonical Storage Schema
**File**: `apps/harness/src/storage/canonical-schema.ts`
**Changes**: Define only canonical schema metadata and the canonical Storage identity singleton.

```ts
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

export const canonicalSchemaMetadata = sqliteTable(
  "schema_metadata",
  {
    metadataKey: text("metadata_key").primaryKey(),
    databaseKind: text("database_kind").notNull(),
    formatVersion: integer("format_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    lastMigrationId: text("last_migration_id").notNull(),
  },
  (table) => [
    check("canonical_metadata_key", sql`${table.metadataKey} = 'canonical'`),
    check("canonical_metadata_kind", sql`${table.databaseKind} = 'canonical'`),
    check("canonical_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("canonical_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check(
      "canonical_migration_nonempty",
      sql`length(trim(${table.lastMigrationId})) > 0`,
    ),
  ],
);

export const canonicalStorageIdentity = sqliteTable(
  "storage_identity",
  {
    identityKey: text("identity_key").primaryKey(),
    projectId: text("project_id").notNull(),
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    canonicalDatabaseLineageId: text("canonical_database_lineage_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("canonical_identity_singleton", sql`${table.identityKey} = 'storage'`),
    check("canonical_identity_project_uuid", domainIdentityCheck(table.projectId)),
    check("canonical_identity_storage_uuid", domainIdentityCheck(table.storageId)),
    check(
      "canonical_identity_generation_uuid",
      domainIdentityCheck(table.generationId),
    ),
    check(
      "canonical_identity_lineage_uuid",
      domainIdentityCheck(table.canonicalDatabaseLineageId),
    ),
  ],
);
```

#### 4. Runtime Adapter Storage Schema
**File**: `apps/harness/src/storage/runtime-schema.ts`
**Changes**: Define only adapter-prefixed runtime schema metadata and runtime Storage identity.

```ts
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

export const runtimeSchemaMetadata = sqliteTable(
  "slopstop_runtime_schema_metadata",
  {
    metadataKey: text("metadata_key").primaryKey(),
    databaseKind: text("database_kind").notNull(),
    formatVersion: integer("format_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    lastMigrationId: text("last_migration_id").notNull(),
  },
  (table) => [
    check(
      "runtime_metadata_key",
      sql`${table.metadataKey} = 'slopstop-runtime-adapter'`,
    ),
    check(
      "runtime_metadata_kind",
      sql`${table.databaseKind} = 'runtime-adapter'`,
    ),
    check("runtime_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("runtime_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check(
      "runtime_migration_nonempty",
      sql`length(trim(${table.lastMigrationId})) > 0`,
    ),
  ],
);

export const runtimeStorageIdentity = sqliteTable(
  "slopstop_runtime_storage_identity",
  {
    identityKey: text("identity_key").primaryKey(),
    projectId: text("project_id").notNull(),
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    runtimeDatabaseLineageId: text("runtime_database_lineage_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("runtime_identity_singleton", sql`${table.identityKey} = 'storage'`),
    check("runtime_identity_project_uuid", domainIdentityCheck(table.projectId)),
    check("runtime_identity_storage_uuid", domainIdentityCheck(table.storageId)),
    check("runtime_identity_generation_uuid", domainIdentityCheck(table.generationId)),
    check(
      "runtime_identity_lineage_uuid",
      domainIdentityCheck(table.runtimeDatabaseLineageId),
    ),
  ],
);
```

#### 5. Expected Persistence Errors
**File**: `apps/harness/src/storage/project-storage-errors.ts`
**Changes**: Add distinct unavailable and broken error classes for expected persistence failures.

```ts
export class ProjectStorageUnavailableError extends Error {
  override readonly name = "ProjectStorageUnavailableError";
}

export class ProjectStorageBrokenError extends Error {
  override readonly name = "ProjectStorageBrokenError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
```

#### 6. Generated Migration Authority
**File**: `apps/harness/src/storage/generated-migrations.ts`
**Changes**: Apply ordered generated SQL through explicit metadata authority without creating Drizzle's implicit migration ledger.

```ts
import { ProjectStorageBrokenError } from "./project-storage-errors.js";

export type StorageDatabaseKind = "application" | "canonical" | "runtime-adapter";

export type GeneratedMigration = Readonly<{
  migrationId: string;
  statements: readonly string[];
}>;

export type MigrationAuthority =
  | Readonly<{ status: "fresh" }>
  | Readonly<{
      status: "existing";
      databaseKind: StorageDatabaseKind;
      formatVersion: number;
      schemaVersion: number;
      lastMigrationId: string;
    }>;

export interface GeneratedMigrationTarget {
  inspectAuthority(): Promise<MigrationAuthority>;
  applyBatch(input: Readonly<{
    migrations: readonly GeneratedMigration[];
    databaseKind: StorageDatabaseKind;
    formatVersion: number;
    schemaVersion: number;
    lastMigrationId: string;
  }>): Promise<void>;
}

export async function applyGeneratedMigrations(input: Readonly<{
  target: GeneratedMigrationTarget;
  expectedKind: StorageDatabaseKind;
  expectedFormatVersion: number;
  expectedSchemaVersion: number;
  migrations: readonly GeneratedMigration[];
}>): Promise<void> {
  const authority = await input.target.inspectAuthority();
  const lastMigration = input.migrations.at(-1);
  if (lastMigration === undefined) {
    throw new ProjectStorageBrokenError("No generated migration is available.");
  }
  if (authority.status === "fresh") {
    await input.target.applyBatch({
      migrations: input.migrations,
      databaseKind: input.expectedKind,
      formatVersion: input.expectedFormatVersion,
      schemaVersion: input.expectedSchemaVersion,
      lastMigrationId: lastMigration.migrationId,
    });
    return;
  }
  if (
    authority.databaseKind !== input.expectedKind ||
    authority.formatVersion > input.expectedFormatVersion ||
    authority.schemaVersion > input.expectedSchemaVersion
  ) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
  const currentIndex = input.migrations.findIndex(
    (migration) => migration.migrationId === authority.lastMigrationId,
  );
  if (currentIndex < 0) {
    throw new ProjectStorageBrokenError("Database migration authority is unknown.");
  }
  const pending = input.migrations.slice(currentIndex + 1);
  if (pending.length === 0) {
    if (
      authority.formatVersion !== input.expectedFormatVersion ||
      authority.schemaVersion !== input.expectedSchemaVersion
    ) {
      throw new ProjectStorageBrokenError("Current migration authority has inconsistent versions.");
    }
    return;
  }
  await input.target.applyBatch({
    migrations: pending,
    databaseKind: input.expectedKind,
    formatVersion: input.expectedFormatVersion,
    schemaVersion: input.expectedSchemaVersion,
    lastMigrationId: lastMigration.migrationId,
  });
}
```

`GeneratedMigrationTarget.inspectAuthority()` owns the fresh-state proof: no `schema_metadata` and no domain table. Existing-state parsing requires exactly one strict metadata row. `applyBatch()` executes all supplied SQL statements and the metadata insert/update in one write transaction. Resource discovery separately validates Drizzle's journal, basenames, ordering, symlink policy, and statement breakpoints before constructing `GeneratedMigration[]`.

#### 7. Migration Authority Tests
**File**: `apps/harness/src/storage/generated-migrations.test.ts`
**Changes**: Prove fresh/current/pending migration behavior and rejection of unknown or incompatible authority.

```ts
it("applies only known pending migrations and rejects inconsistent authority", async () => {
  const migrations = migrationFixture("0000_initial", "0001_next");
  const fresh = migrationTargetFixture({ status: "fresh" });
  const current = migrationTargetFixture(existingAuthority("0001_next"));
  const pending = migrationTargetFixture(existingAuthority("0000_initial"));

  await applyGeneratedMigrations(migrationInput(fresh, migrations));
  await applyGeneratedMigrations(migrationInput(current, migrations));
  await applyGeneratedMigrations(migrationInput(pending, migrations));

  expect(fresh.appliedBatches()).toEqual([
    expectedMigrationBatch(migrations, "0001_next"),
  ]);
  expect(current.appliedBatches()).toEqual([]);
  expect(pending.appliedBatches()).toEqual([
    expectedMigrationBatch(migrations.slice(1), "0001_next"),
  ]);

  for (const authority of [
    existingAuthority("unknown"),
    existingAuthority("0001_next", { databaseKind: "canonical" }),
    existingAuthority("0001_next", { formatVersion: 0 }),
    existingAuthority("0001_next", { formatVersion: 2 }),
    existingAuthority("0001_next", { schemaVersion: 0 }),
    existingAuthority("0001_next", { schemaVersion: 2 }),
  ]) {
    const invalid = migrationTargetFixture(authority);
    await expect(applyGeneratedMigrations(migrationInput(invalid, migrations))).rejects.toThrow(
      ProjectStorageBrokenError,
    );
    expect(invalid.appliedBatches()).toEqual([]);
  }
  await expect(
    applyGeneratedMigrations(migrationInput(migrationTargetFixture({ status: "fresh" }), [])),
  ).rejects.toThrow(ProjectStorageBrokenError);
});
```

#### 8. Versioned Project Storage Manifest
**File**: `apps/harness/src/storage/project-storage-manifest.ts`
**Changes**: Add strict manifest v1 parsing and deterministic serialization for the exact first-generation vocabulary.

```ts
import {
  CanonicalDatabaseLineageIdSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { z } from "zod";

export const projectStorageManifestFilename = "manifest.json";
export const canonicalDatabaseFilename = "slopstop.db";
export const runtimeDatabaseFilename = "mastra.db";

const safeNonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const utcInstantSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "UTC instant must end in Z.");
const activationBaselineSchema = z.strictObject({
  algorithm: z.literal("sha256"),
  sizeBytes: safeNonnegativeIntegerSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
});

export const ProjectStorageManifestV1Schema = z.strictObject({
  manifestVersion: z.literal(1),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  provenance: z.strictObject({
    kind: z.literal("initial-create"),
    createRequestId: ProjectStorageCreateRequestIdSchema,
    sourceGenerationId: z.null(),
    storageOperationId: z.null(),
  }),
  canonical: z.strictObject({
    kind: z.literal("canonical"),
    databaseLineageId: CanonicalDatabaseLineageIdSchema,
    filename: z.literal(canonicalDatabaseFilename),
    formatVersion: safeNonnegativeIntegerSchema,
    schemaVersion: safeNonnegativeIntegerSchema,
    lastMigrationId: z.string().trim().min(1),
    activationBaseline: activationBaselineSchema,
  }),
  runtime: z.strictObject({
    kind: z.literal("runtime"),
    databaseLineageId: RuntimeDatabaseLineageIdSchema,
    filename: z.literal(runtimeDatabaseFilename),
    adapterFormatVersion: safeNonnegativeIntegerSchema,
    adapterSchemaVersion: safeNonnegativeIntegerSchema,
    adapterLastMigrationId: z.string().trim().min(1),
    mastraMigrationHead: z.null(),
    activationBaseline: activationBaselineSchema,
  }),
  projectSequence: z.literal(0),
  runtimeWaterline: z.literal(0),
  producingApplicationVersion: z.string().trim().min(1),
  createdAt: utcInstantSchema,
});
export type ProjectStorageManifestV1 = z.infer<
  typeof ProjectStorageManifestV1Schema
>;

export function parseProjectStorageManifest(source: string): ProjectStorageManifestV1 {
  const json: unknown = JSON.parse(source);
  return ProjectStorageManifestV1Schema.parse(json);
}

export function serializeProjectStorageManifest(input: unknown): string {
  const manifest = ProjectStorageManifestV1Schema.parse(input);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
```

#### 9. Manifest Contract Tests
**File**: `apps/harness/src/storage/project-storage-manifest.test.ts`
**Changes**: Prove deterministic serialization, strict first-generation values, identity validation, safe relative filenames, and path exclusion.

```ts
it("serializes the exact initial manifest and rejects non-v1 shapes", () => {
  const serialized = serializeProjectStorageManifest(validInitialManifest);
  expect(serialized).toBe(`${JSON.stringify(validInitialManifest, null, 2)}\n`);
  expect(parseProjectStorageManifest(serialized)).toEqual(validInitialManifest);
  expect(serialized).not.toContain(applicationStorageRoot);

  for (const invalid of [
    { ...validInitialManifest, manifestVersion: 2 },
    { ...validInitialManifest, projectSequence: 1 },
    { ...validInitialManifest, runtimeWaterline: 1 },
    { ...validInitialManifest, createdAt: "2026-08-31T12:00:00+01:00" },
    { ...validInitialManifest, unexpected: true },
    { ...validInitialManifest, storageId: validInitialManifest.storageId.toUpperCase() },
    { ...validInitialManifest, storageId: "00000000-0000-0000-0000-000000000000" },
    {
      ...validInitialManifest,
      provenance: { ...validInitialManifest.provenance, sourceGenerationId: "unexpected" },
    },
    {
      ...validInitialManifest,
      canonical: { ...validInitialManifest.canonical, filename: "../slopstop.db" },
    },
    {
      ...validInitialManifest,
      canonical: {
        ...validInitialManifest.canonical,
        activationBaseline: {
          ...validInitialManifest.canonical.activationBaseline,
          sizeBytes: -1,
        },
      },
    },
    {
      ...validInitialManifest,
      runtime: {
        ...validInitialManifest.runtime,
        mastraMigrationHead: "unexpected",
        activationBaseline: {
          algorithm: "sha256",
          sizeBytes: Number.MAX_SAFE_INTEGER + 1,
          sha256: "NOT-A-SHA256",
        },
      },
    },
  ]) {
    expect(() => serializeProjectStorageManifest(invalid)).toThrow();
  }
});
```

#### 10. Staged Project Storage Store
**File**: `apps/harness/src/storage/project-storage-store.ts`
**Changes**: Add witness kinds, staged creation checkpoints, durable request precedence, exact replay, installation-wide creation serialization, and the transitional no-opening lifecycle.

```ts
import type {
  CanonicalDatabaseLineageId,
  OpenedStorageIdentity,
  ProjectId,
  ProjectStorageCreateRequest,
  ProjectStorageCreateResult,
  RuntimeDatabaseLineageId,
  StorageGenerationId,
  StorageId,
} from "@slopstop/protocol";
import type {
  ProjectStorageOwnerOutcome,
  ProjectStorageOwnerPort,
} from "../project-storage-application.js";
import {
  canonicalDatabaseFilename,
  runtimeDatabaseFilename,
  serializeProjectStorageManifest,
} from "./project-storage-manifest.js";
import {
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";

export type PriorStateWitnessKind =
  | "registration-record"
  | "location-record"
  | "generation-record"
  | "project-root"
  | "repository-marker"
  | "manifest"
  | "generation-directory"
  | "canonical-database"
  | "runtime-database"
  | "canonical-wal"
  | "canonical-shm"
  | "canonical-rollback-journal"
  | "runtime-wal"
  | "runtime-shm"
  | "runtime-rollback-journal"
  | "local-snapshot"
  | "deletion-tombstone"
  | "unfinished-storage-operation";

export type CreationCheckpoint =
  | "before-staging-transaction"
  | "during-staging-transaction"
  | "after-staging-transaction"
  | "after-staging-directory"
  | "after-canonical-database"
  | "after-runtime-database"
  | "after-databases-closed"
  | "after-baselines-computed"
  | "after-manifest-written"
  | "after-staging-verified"
  | "before-generation-rename"
  | "after-generation-rename"
  | "after-renamed-verification"
  | "before-activation-transaction"
  | "during-activation-transaction"
  | "after-activation-transaction"
  | "before-created-result";

type AllocatedCreation = Readonly<{
  projectId: ProjectId;
  storageId: StorageId;
  locationId: string;
  generationId: StorageGenerationId;
  canonicalDatabaseLineageId: CanonicalDatabaseLineageId;
  runtimeDatabaseLineageId: RuntimeDatabaseLineageId;
  createRequestId: ProjectStorageCreateRequest["createRequestId"];
  createRequestFingerprint: string;
  createdAt: string;
}>;

type CreateInspection =
  | Readonly<{ status: "fresh" }>
  | Readonly<{ status: "active-replay"; identity: OpenedStorageIdentity }>
  | Readonly<{ status: "incomplete-request" }>
  | Readonly<{ status: "idempotency-conflict" }>
  | Readonly<{ status: "already-registered" }>;

type ProjectStorageGenerationPaths = Readonly<{
  root: string;
  canonicalDatabase: string;
  runtimeDatabase: string;
  manifest: string;
}>;

type ProjectStoragePaths = Readonly<{
  projectRoot: string;
  staging: ProjectStorageGenerationPaths;
  active: ProjectStorageGenerationPaths;
}>;

type ClosedDatabaseBuild = Readonly<{
  state: "closed";
  formatVersion: number;
  schemaVersion: number;
  lastMigrationId: string;
}>;

type ProjectStorageLifecycle = Readonly<{
  assertRunning(): void;
}>;

export interface ProjectStorageStoreDependencies {
  readonly applicationVersion: string;
  readonly ids: Readonly<{
    storageId(): StorageId;
    locationId(): string;
    generationId(): StorageGenerationId;
    canonicalLineageId(): CanonicalDatabaseLineageId;
    runtimeLineageId(): RuntimeDatabaseLineageId;
  }>;
  readonly clock: Readonly<{ now(): string }>;
  readonly hashes: Readonly<{
    sha256Text(value: string): Promise<string>;
    sha256File(path: string): Promise<string>;
  }>;
  readonly paths: Readonly<{
    forCreation(projectId: ProjectId, generationId: StorageGenerationId): ProjectStoragePaths;
  }>;
  readonly registry: Readonly<{
    inspectCreate(
      request: ProjectStorageCreateRequest,
      createRequestFingerprint: string,
    ): Promise<CreateInspection>;
    declareStaging(creation: AllocatedCreation, paths: ProjectStoragePaths): Promise<CreateInspection>;
    activate(creation: AllocatedCreation, paths: ProjectStoragePaths): Promise<void>;
    stop(): void;
  }>;
  readonly witnesses: Readonly<{
    inspect(projectId: ProjectId): Promise<readonly PriorStateWitnessKind[]>;
  }>;
  readonly files: Readonly<{
    createDirectoryExclusive(path: string): Promise<void>;
    writeFileExclusive(path: string, contents: string): Promise<void>;
    readFile(path: string): Promise<string>;
    size(path: string): Promise<number>;
    renameAtomic(source: string, destination: string): Promise<void>;
  }>;
  readonly databases: Readonly<{
    createCanonical(path: string, creation: AllocatedCreation): Promise<ClosedDatabaseBuild>;
    createRuntime(path: string, creation: AllocatedCreation): Promise<ClosedDatabaseBuild>;
    verifySealed(
      paths: ProjectStorageGenerationPaths,
      creation: AllocatedCreation,
    ): Promise<void>;
  }>;
  readonly failures: Readonly<{
    checkpoint(point: CreationCheckpoint): Promise<void>;
  }>;
  readonly locks: Readonly<{
    forCreate<Result>(operation: () => Promise<Result>): Promise<Result>;
    afterCreateDrain(operation: () => void): Promise<void>;
    forProject<Result>(projectId: ProjectId, operation: () => Promise<Result>): Promise<Result>;
  }>;
}

async function runWhileRunning<Result>(
  lifecycle: ProjectStorageLifecycle,
  operation: () => Promise<Result>,
): Promise<Result> {
  lifecycle.assertRunning();
  const result = await operation();
  lifecycle.assertRunning();
  return result;
}

function blockedResult(
  request: ProjectStorageCreateRequest,
  reason: "prior-state-witness" | "already-registered" | "idempotency-conflict",
): ProjectStorageCreateResult {
  switch (reason) {
    case "prior-state-witness":
      return {
        status: "blocked",
        request,
        reason,
        diagnostic: {
          code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
          message: "Prior Project Storage state requires recovery.",
        },
      };
    case "already-registered":
      return {
        status: "blocked",
        request,
        reason,
        diagnostic: {
          code: "PROJECT_STORAGE_ALREADY_REGISTERED",
          message: "Project Storage is already registered.",
        },
      };
    case "idempotency-conflict":
      return {
        status: "blocked",
        request,
        reason,
        diagnostic: {
          code: "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT",
          message: "The create request identity is already bound to another request.",
        },
      };
  }
}

function inspectionResult(
  request: ProjectStorageCreateRequest,
  inspection: Exclude<CreateInspection, { status: "fresh" }>,
): ProjectStorageCreateResult {
  switch (inspection.status) {
    case "active-replay":
      return {
        status: "created",
        request,
        mode: "read-write",
        identity: inspection.identity,
      };
    case "incomplete-request":
      return blockedResult(request, "prior-state-witness");
    case "idempotency-conflict":
      return blockedResult(request, "idempotency-conflict");
    case "already-registered":
      return blockedResult(request, "already-registered");
  }
}

async function createFreshGeneration(
  request: ProjectStorageCreateRequest,
  fingerprint: string,
  dependencies: ProjectStorageStoreDependencies,
  lifecycle: ProjectStorageLifecycle,
): Promise<ProjectStorageCreateResult> {
  lifecycle.assertRunning();
  const creation: AllocatedCreation = {
    projectId: request.projectId,
    storageId: dependencies.ids.storageId(),
    locationId: dependencies.ids.locationId(),
    generationId: dependencies.ids.generationId(),
    canonicalDatabaseLineageId: dependencies.ids.canonicalLineageId(),
    runtimeDatabaseLineageId: dependencies.ids.runtimeLineageId(),
    createRequestId: request.createRequestId,
    createRequestFingerprint: fingerprint,
    createdAt: dependencies.clock.now(),
  };
  const identity: OpenedStorageIdentity = {
    storageId: creation.storageId,
    generationId: creation.generationId,
    canonicalDatabaseLineageId: creation.canonicalDatabaseLineageId,
    runtimeDatabaseLineageId: creation.runtimeDatabaseLineageId,
  };
  const paths = dependencies.paths.forCreation(request.projectId, creation.generationId);

  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("before-staging-transaction"),
  );
  const declaration = await runWhileRunning(lifecycle, () =>
    dependencies.registry.declareStaging(creation, paths),
  );
  if (declaration.status !== "fresh") {
    return inspectionResult(request, declaration);
  }
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-staging-transaction"),
  );

  await runWhileRunning(lifecycle, () =>
    dependencies.files.createDirectoryExclusive(paths.staging.root),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-staging-directory"),
  );
  const canonical = await runWhileRunning(lifecycle, () =>
    dependencies.databases.createCanonical(paths.staging.canonicalDatabase, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-canonical-database"),
  );
  const runtime = await runWhileRunning(lifecycle, () =>
    dependencies.databases.createRuntime(paths.staging.runtimeDatabase, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-runtime-database"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-databases-closed"),
  );

  const [canonicalSize, canonicalHash, runtimeSize, runtimeHash] = await runWhileRunning(
    lifecycle,
    () =>
      Promise.all([
        dependencies.files.size(paths.staging.canonicalDatabase),
        dependencies.hashes.sha256File(paths.staging.canonicalDatabase),
        dependencies.files.size(paths.staging.runtimeDatabase),
        dependencies.hashes.sha256File(paths.staging.runtimeDatabase),
      ]),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-baselines-computed"),
  );
  const manifest = serializeProjectStorageManifest({
    manifestVersion: 1,
    projectId: request.projectId,
    storageId: creation.storageId,
    generationId: creation.generationId,
    provenance: {
      kind: "initial-create",
      createRequestId: request.createRequestId,
      sourceGenerationId: null,
      storageOperationId: null,
    },
    canonical: {
      kind: "canonical",
      databaseLineageId: creation.canonicalDatabaseLineageId,
      filename: canonicalDatabaseFilename,
      formatVersion: canonical.formatVersion,
      schemaVersion: canonical.schemaVersion,
      lastMigrationId: canonical.lastMigrationId,
      activationBaseline: {
        algorithm: "sha256",
        sizeBytes: canonicalSize,
        sha256: canonicalHash,
      },
    },
    runtime: {
      kind: "runtime",
      databaseLineageId: creation.runtimeDatabaseLineageId,
      filename: runtimeDatabaseFilename,
      adapterFormatVersion: runtime.formatVersion,
      adapterSchemaVersion: runtime.schemaVersion,
      adapterLastMigrationId: runtime.lastMigrationId,
      mastraMigrationHead: null,
      activationBaseline: {
        algorithm: "sha256",
        sizeBytes: runtimeSize,
        sha256: runtimeHash,
      },
    },
    projectSequence: 0,
    runtimeWaterline: 0,
    producingApplicationVersion: dependencies.applicationVersion,
    createdAt: creation.createdAt,
  });
  await runWhileRunning(lifecycle, () =>
    dependencies.files.writeFileExclusive(paths.staging.manifest, manifest),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-manifest-written"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.databases.verifySealed(paths.staging, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-staging-verified"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("before-generation-rename"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.files.renameAtomic(paths.staging.root, paths.active.root),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-generation-rename"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.databases.verifySealed(paths.active, creation),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-renamed-verification"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("before-activation-transaction"),
  );
  await runWhileRunning(lifecycle, () => dependencies.registry.activate(creation, paths));
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("after-activation-transaction"),
  );
  await runWhileRunning(lifecycle, () =>
    dependencies.failures.checkpoint("before-created-result"),
  );

  return { status: "created", request, mode: "read-write", identity };
}

async function createProjectStorage(
  request: ProjectStorageCreateRequest,
  dependencies: ProjectStorageStoreDependencies,
  lifecycle: ProjectStorageLifecycle,
): Promise<ProjectStorageCreateResult> {
  return dependencies.locks.forCreate(async () => {
    const fingerprint = await runWhileRunning(lifecycle, () =>
      dependencies.hashes.sha256Text(
        JSON.stringify({
          version: 1,
          projectId: request.projectId,
          createRequestId: request.createRequestId,
        }),
      ),
    );
    const inspection = await runWhileRunning(lifecycle, () =>
      dependencies.registry.inspectCreate(request, fingerprint),
    );
    if (inspection.status !== "fresh") {
      return inspectionResult(request, inspection);
    }
    const witnesses = await runWhileRunning(lifecycle, () =>
      dependencies.witnesses.inspect(request.projectId),
    );
    if (witnesses.length > 0) {
      return blockedResult(request, "prior-state-witness");
    }
    const result = await createFreshGeneration(request, fingerprint, dependencies, lifecycle);
    lifecycle.assertRunning();
    return result;
  });
}

export function createProjectStorageOwner(
  dependencies: ProjectStorageStoreDependencies,
): ProjectStorageOwnerPort {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;

  const lifecycle: ProjectStorageLifecycle = {
    assertRunning: () => {
      if (stopped) {
        throw new ProjectStorageUnavailableError("Project Storage owner is stopped.");
      }
    },
  };

  const stoppedOutcome = (): ProjectStorageOwnerOutcome => ({
    status: "unavailable",
    message: "Project Storage owner is stopped.",
  });

  const operate = async (
    operation: () => Promise<ProjectStorageCreateResult>,
  ): Promise<ProjectStorageOwnerOutcome> => {
    try {
      const result = await operation();
      lifecycle.assertRunning();
      return { status: "ready", result };
    } catch (error) {
      if (error instanceof ProjectStorageUnavailableError) {
        return { status: "unavailable", message: error.message };
      }
      if (error instanceof ProjectStorageBrokenError) {
        return { status: "broken", message: error.message };
      }
      throw error;
    }
  };

  return {
    create: async (request) => {
      if (stopped) {
        return stoppedOutcome();
      }
      return operate(() =>
        dependencies.locks.forProject(request.projectId, async () => {
          lifecycle.assertRunning();
          const result = await createProjectStorage(request, dependencies, lifecycle);
          lifecycle.assertRunning();
          return result;
        }),
      );
    },
    open: async () =>
      stopped
        ? stoppedOutcome()
        : { status: "unavailable", message: "Project Storage opening is not available." },
    close: async (request) =>
      stopped
        ? stoppedOutcome()
        : { status: "ready", result: { status: "closed", request } },
    stop: () => {
      if (stopPromise !== undefined) {
        return stopPromise;
      }
      stopped = true;
      stopPromise = (async () => {
        const shutdownErrors: unknown[] = [];
        try {
          await dependencies.locks.afterCreateDrain(() => {
            dependencies.registry.stop();
          });
        } catch (error) {
          shutdownErrors.push(error);
        }
        if (shutdownErrors.length > 0) {
          throw new AggregateError(shutdownErrors, "Project Storage shutdown failed.");
        }
      })();
      return stopPromise;
    },
  };
}
```

The Phase 3 owner wraps this creation path with the design's unavailable/broken error mapping, reports opening as unavailable with `Project Storage opening is not available.`, keeps close idempotent without retaining a session, and returns one retained stop Promise that closes admission immediately, awaits the create lock drain, and stops the application registry once. Phase 4 replaces only that transitional opening/session subset and preserves the async create-lifecycle fence.

#### 11. Creation And Witness Store Tests
**File**: `apps/harness/src/storage/project-storage-store.test.ts`
**Changes**: Prove witness refusal, precedence, replay, conflict, installation-wide serialization, incomplete replay, and transitional close/stop behavior.

The fixture's registry fake adopts `inspectCreate(request, createRequestFingerprint)`, records the exact fingerprint argument, and otherwise preserves its inspection/error behavior. Its hash fake exposes the deterministic expected fingerprint for `{version:1, projectId, createRequestId}` so the following authority test proves hashing occurs before inspection without changing any creation fixture field.

```ts
it("passes the exact request fingerprint to the first registry inspection", async () => {
  const fixture = createProjectStorageStoreFixture();
  const result = await createProjectStorageOwner(fixture.dependencies).create(fixture.request);

  expect(result).toEqual({ status: "ready", result: fixture.expectedCreatedResult });
  expect(fixture.inspectedCreateFingerprints()).toEqual([
    fixture.expectedCreateRequestFingerprint,
  ]);
  expect(fixture.events.slice(0, 2)).toEqual([
    `hash:${JSON.stringify({
      version: 1,
      projectId: fixture.request.projectId,
      createRequestId: fixture.request.createRequestId,
    })}`,
    `inspect:${fixture.expectedCreateRequestFingerprint}`,
  ]);
});

it("creates once, replays exactly, and rejects conflicting reuse without mutation", async () => {
  const fixture = createProjectStorageStoreFixture();
  const owner = createProjectStorageOwner(fixture.dependencies);
  const first = await owner.create(fixture.request);
  const mutationsAfterFirst = fixture.mutations.snapshot();
  const replay = await owner.create(fixture.request);
  const conflict = await owner.create({
    projectId: fixture.otherProjectId,
    createRequestId: fixture.request.createRequestId,
  });
  const registered = await owner.create({
    projectId: fixture.request.projectId,
    createRequestId: fixture.otherCreateRequestId,
  });

  expect(first).toEqual({ status: "ready", result: fixture.expectedCreatedResult });
  expect(replay).toEqual(first);
  expect(conflict).toMatchObject({
    status: "ready",
    result: {
      status: "blocked",
      reason: "idempotency-conflict",
      diagnostic: { code: "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT" },
    },
  });
  expect(registered).toMatchObject({
    status: "ready",
    result: {
      status: "blocked",
      reason: "already-registered",
      diagnostic: { code: "PROJECT_STORAGE_ALREADY_REGISTERED" },
    },
  });
  expect(fixture.mutations.snapshot()).toEqual(mutationsAfterFirst);
});

it.each(allPriorStateWitnessKinds)("blocks the %s witness without allocating", async (kind) => {
  const fixture = createProjectStorageStoreFixture({ witnesses: [kind] });
  const result = await createProjectStorageOwner(fixture.dependencies).create(fixture.request);

  expect(result).toMatchObject({
    status: "ready",
    result: {
      status: "blocked",
      request: fixture.request,
      reason: "prior-state-witness",
      diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
    },
  });
  expect(fixture.mutations.snapshot()).toEqual(fixture.emptyMutationSnapshot);
});

it("serializes installation-wide create decisions before allocation", async () => {
  const fixture = createProjectStorageStoreFixture();
  const owner = createProjectStorageOwner(fixture.dependencies);
  const results = await Promise.all([
    owner.create(fixture.request),
    owner.create({
      projectId: fixture.otherProjectId,
      createRequestId: fixture.request.createRequestId,
    }),
  ]);

  expect(results).toMatchObject([
    { status: "ready", result: { status: "created" } },
    {
      status: "ready",
      result: { status: "blocked", reason: "idempotency-conflict" },
    },
  ]);
  expect(fixture.idAllocationCount()).toBe(5);
});

it("applies request and registration precedence before witness inspection", async () => {
  const conflict = createProjectStorageStoreFixture({
    inspection: "idempotency-conflict",
    witnesses: ["project-root"],
  });
  const registered = createProjectStorageStoreFixture({
    inspection: "already-registered",
    witnesses: ["project-root"],
  });

  await expect(
    createProjectStorageOwner(conflict.dependencies).create(conflict.request),
  ).resolves.toMatchObject({
    status: "ready",
    result: { status: "blocked", reason: "idempotency-conflict" },
  });
  await expect(
    createProjectStorageOwner(registered.dependencies).create(registered.request),
  ).resolves.toMatchObject({
    status: "ready",
    result: { status: "blocked", reason: "already-registered" },
  });
  expect(conflict.witnessInspectionCount()).toBe(0);
  expect(registered.witnessInspectionCount()).toBe(0);
});

it("keeps unavailable and broken witness inspection distinct from absence", async () => {
  const unavailable = createProjectStorageStoreFixture({
    witnessError: new ProjectStorageUnavailableError("Project Storage is unavailable."),
  });
  const broken = createProjectStorageStoreFixture({
    inspectionError: new ProjectStorageBrokenError("Project Storage registry is inconsistent."),
  });

  await expect(
    createProjectStorageOwner(unavailable.dependencies).create(unavailable.request),
  ).resolves.toEqual({
    status: "unavailable",
    message: "Project Storage is unavailable.",
  });
  await expect(
    createProjectStorageOwner(broken.dependencies).create(broken.request),
  ).resolves.toEqual({
    status: "broken",
    message: "Project Storage registry is inconsistent.",
  });
  expect(unavailable.mutations.snapshot()).toEqual(unavailable.emptyMutationSnapshot);
  expect(broken.mutations.snapshot()).toEqual(broken.emptyMutationSnapshot);
});

it("blocks an incomplete exact request without cleanup or reallocation", async () => {
  const fixture = createProjectStorageStoreFixture({ inspection: "incomplete-request" });
  const result = await createProjectStorageOwner(fixture.dependencies).create(fixture.request);

  expect(result).toEqual({
    status: "ready",
    result: {
      status: "blocked",
      request: fixture.request,
      reason: "prior-state-witness",
      diagnostic: {
        code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
        message: "Prior Project Storage state requires recovery.",
      },
    },
  });
  expect(fixture.mutations.snapshot()).toEqual(fixture.emptyMutationSnapshot);
});
```

#### 12. Node Persistence Adapters
**File**: `apps/harness/src/storage/project-storage-node-adapters.ts`
**Changes**: Implement registry, libSQL, Drizzle, migration-resource, filesystem, hashing, witness, path, create/drain lock, and failure-injection ports for creation without cleanup or copy fallback.

`createNodeProjectStorageDependencies()` is the production implementation of the internal ports above. Registry inspection first uses `lstat`: an absent `application.db` is observed without opening or creating it, while existing inaccessible or malformed authority crosses the locked application boundary as unavailable/broken. Only `declareStaging`, after the complete witness guard, may initialize or migrate `application.db` before Transaction A. The adapter uses `pathToFileURL(databasePath).href` for every explicitly created local libSQL client, loads only sorted generated `.sql` resources below the trusted migration root, applies statements without creating a Drizzle migration ledger, enables and reads back `PRAGMA foreign_keys = 1`, and closes every creation/verification client before returning. Every staging and activation row is parsed through the strict persisted-record schemas below before SQL execution. Registry transactions invoke the `during-staging-transaction` and `during-activation-transaction` checkpoints between writes so rollback is proven. Its filesystem adapter exposes no remove/copy fallback: exclusive writes and same-filesystem `rename()` either succeed atomically or leave witnesses for recovery.

```ts
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile as readNodeFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
  CanonicalDatabaseLineageIdSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
  type ProjectId,
  type ProjectStorageCreateRequest,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  applyGeneratedMigrations,
  type GeneratedMigration,
  type GeneratedMigrationTarget,
  type MigrationAuthority,
  type StorageDatabaseKind,
} from "./generated-migrations.js";
import {
  canonicalDatabaseFilename,
  parseProjectStorageManifest,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
  type ProjectStorageManifestV1,
} from "./project-storage-manifest.js";
import {
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import type {
  PriorStateWitnessKind,
  ProjectStorageStoreDependencies,
} from "./project-storage-store.js";

type LocalClient = ReturnType<typeof createClient>;
type LocalTransaction = Awaited<ReturnType<LocalClient["transaction"]>>;
type AllocatedCreation = Parameters<
  ProjectStorageStoreDependencies["registry"]["declareStaging"]
>[0];
type ProjectStorageGenerationPaths = Parameters<
  ProjectStorageStoreDependencies["databases"]["verifySealed"]
>[0];
type CreateInspection = Awaited<
  ReturnType<ProjectStorageStoreDependencies["registry"]["inspectCreate"]>
>;
type ClosedDatabaseBuild = Awaited<
  ReturnType<ProjectStorageStoreDependencies["databases"]["createCanonical"]>
>;

type MigrationResourceKind = "application" | "canonical" | "runtime";
type NamedCheckSpec = Readonly<{ table: string; name: string }>;
type NamedIndexSpec = Readonly<{
  table: string;
  name: string;
  unique: boolean;
  partial: boolean;
  columns: readonly string[];
}>;
type ForeignKeySpec = Readonly<{
  table: string;
  columns: readonly string[];
  referencedTable: string;
  referencedColumns: readonly string[];
  onUpdate: "NO ACTION" | "RESTRICT";
  onDelete: "NO ACTION" | "RESTRICT";
  match: "NONE";
}>;
export type DatabaseSpec = Readonly<{
  resourceKind: MigrationResourceKind;
  databaseKind: StorageDatabaseKind;
  metadataTable: "schema_metadata" | "slopstop_runtime_schema_metadata";
  metadataKey: "application" | "canonical" | "slopstop-runtime-adapter";
  formatVersion: number;
  schemaVersion: number;
  tables: readonly string[];
  checks: readonly NamedCheckSpec[];
  indexes: readonly NamedIndexSpec[];
  foreignKeys: readonly ForeignKeySpec[];
}>;

export const databaseSpecs = {
  application: {
    resourceKind: "application",
    databaseKind: "application",
    metadataTable: "schema_metadata",
    metadataKey: "application",
    formatVersion: 1,
    schemaVersion: 1,
    tables: [
      "schema_metadata",
      "storage_generations",
      "storage_locations",
      "storage_registrations",
    ],
    checks: [
      { table: "schema_metadata", name: "application_metadata_key" },
      { table: "schema_metadata", name: "application_metadata_kind" },
      { table: "schema_metadata", name: "application_format_nonnegative" },
      { table: "schema_metadata", name: "application_schema_nonnegative" },
      { table: "schema_metadata", name: "application_migration_nonempty" },
      { table: "storage_locations", name: "storage_locations_storage_id_uuid" },
      { table: "storage_locations", name: "storage_locations_location_id_uuid" },
      { table: "storage_locations", name: "storage_locations_state" },
      { table: "storage_generations", name: "storage_generations_storage_id_uuid" },
      { table: "storage_generations", name: "storage_generations_generation_id_uuid" },
      { table: "storage_generations", name: "storage_generations_project_id_uuid" },
      { table: "storage_generations", name: "storage_generations_location_id_uuid" },
      { table: "storage_generations", name: "storage_generations_canonical_lineage_uuid" },
      { table: "storage_generations", name: "storage_generations_runtime_lineage_uuid" },
      { table: "storage_generations", name: "storage_generations_create_request_uuid" },
      { table: "storage_generations", name: "storage_generations_fingerprint_sha256" },
      { table: "storage_generations", name: "storage_generations_directory_identity" },
      { table: "storage_generations", name: "storage_generations_activation_time" },
      { table: "storage_registrations", name: "storage_registrations_storage_id_uuid" },
      { table: "storage_registrations", name: "storage_registrations_project_id_uuid" },
      { table: "storage_registrations", name: "storage_registrations_active_pair" },
    ],
    indexes: [
      {
        table: "storage_locations",
        name: "storage_locations_normalized_path_uq",
        unique: true,
        partial: false,
        columns: ["normalized_path"],
      },
      {
        table: "storage_generations",
        name: "storage_generations_create_request_uq",
        unique: true,
        partial: false,
        columns: ["create_request_id"],
      },
      {
        table: "storage_generations",
        name: "storage_generations_directory_uq",
        unique: true,
        partial: false,
        columns: ["storage_id", "generation_directory_name"],
      },
      {
        table: "storage_generations",
        name: "storage_generations_one_active_uq",
        unique: true,
        partial: true,
        columns: ["storage_id"],
      },
      {
        table: "storage_generations",
        name: "storage_generations_project_idx",
        unique: false,
        partial: false,
        columns: ["project_id"],
      },
      {
        table: "storage_generations",
        name: "storage_generations_state_idx",
        unique: false,
        partial: false,
        columns: ["storage_id", "creation_state"],
      },
      {
        table: "storage_registrations",
        name: "storage_registrations_project_uq",
        unique: true,
        partial: false,
        columns: ["project_id"],
      },
    ],
    foreignKeys: [
      {
        table: "storage_generations",
        columns: ["storage_id", "location_id"],
        referencedTable: "storage_locations",
        referencedColumns: ["storage_id", "location_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "storage_registrations",
        columns: ["storage_id", "active_generation_id"],
        referencedTable: "storage_generations",
        referencedColumns: ["storage_id", "generation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "storage_registrations",
        columns: ["storage_id", "active_location_id"],
        referencedTable: "storage_locations",
        referencedColumns: ["storage_id", "location_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  },
  canonical: {
    resourceKind: "canonical",
    databaseKind: "canonical",
    metadataTable: "schema_metadata",
    metadataKey: "canonical",
    formatVersion: 1,
    schemaVersion: 1,
    tables: ["schema_metadata", "storage_identity"],
    checks: [
      { table: "schema_metadata", name: "canonical_metadata_key" },
      { table: "schema_metadata", name: "canonical_metadata_kind" },
      { table: "schema_metadata", name: "canonical_format_nonnegative" },
      { table: "schema_metadata", name: "canonical_schema_nonnegative" },
      { table: "schema_metadata", name: "canonical_migration_nonempty" },
      { table: "storage_identity", name: "canonical_identity_singleton" },
      { table: "storage_identity", name: "canonical_identity_project_uuid" },
      { table: "storage_identity", name: "canonical_identity_storage_uuid" },
      { table: "storage_identity", name: "canonical_identity_generation_uuid" },
      { table: "storage_identity", name: "canonical_identity_lineage_uuid" },
    ],
    indexes: [],
    foreignKeys: [],
  },
  runtime: {
    resourceKind: "runtime",
    databaseKind: "runtime-adapter",
    metadataTable: "slopstop_runtime_schema_metadata",
    metadataKey: "slopstop-runtime-adapter",
    formatVersion: 1,
    schemaVersion: 1,
    tables: [
      "slopstop_runtime_schema_metadata",
      "slopstop_runtime_storage_identity",
    ],
    checks: [
      { table: "slopstop_runtime_schema_metadata", name: "runtime_metadata_key" },
      { table: "slopstop_runtime_schema_metadata", name: "runtime_metadata_kind" },
      { table: "slopstop_runtime_schema_metadata", name: "runtime_format_nonnegative" },
      { table: "slopstop_runtime_schema_metadata", name: "runtime_schema_nonnegative" },
      { table: "slopstop_runtime_schema_metadata", name: "runtime_migration_nonempty" },
      { table: "slopstop_runtime_storage_identity", name: "runtime_identity_singleton" },
      { table: "slopstop_runtime_storage_identity", name: "runtime_identity_project_uuid" },
      { table: "slopstop_runtime_storage_identity", name: "runtime_identity_storage_uuid" },
      { table: "slopstop_runtime_storage_identity", name: "runtime_identity_generation_uuid" },
      { table: "slopstop_runtime_storage_identity", name: "runtime_identity_lineage_uuid" },
    ],
    indexes: [],
    foreignKeys: [],
  },
} as const satisfies Record<MigrationResourceKind, DatabaseSpec>;

const sqlIntegerSchema = z
  .union([z.number().int(), z.bigint()])
  .transform((value) => Number(value))
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));

const utcInstantSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "UTC instant must end in Z.");
const privateLocationIdSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase(), "Identity must use lowercase UUID text.");
const stagingDeclarationSchema = z.strictObject({
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
  createRequestFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  createdAt: utcInstantSchema,
  observedAt: utcInstantSchema,
  normalizedPath: z.string().min(1),
  generationDirectoryName: StorageGenerationIdSchema,
  locationState: z.literal("staging"),
  creationState: z.literal("staging"),
});
const activationSchema = z.strictObject({
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  generationId: StorageGenerationIdSchema,
  activatedAt: utcInstantSchema,
});

const metadataRowSchema = z.strictObject({
  metadataKey: z.string().trim().min(1),
  databaseKind: z.enum(["application", "canonical", "runtime-adapter"]),
  formatVersion: sqlIntegerSchema,
  schemaVersion: sqlIntegerSchema,
  lastMigrationId: z.string().trim().min(1),
});
type MetadataRow = z.infer<typeof metadataRowSchema>;

const generationRowSchema = z.strictObject({
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  projectId: ProjectIdSchema,
  locationId: privateLocationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createRequestId: ProjectStorageCreateRequestIdSchema,
  createRequestFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  generationDirectoryName: StorageGenerationIdSchema,
  creationState: z.enum(["staging", "active"]),
  createdAt: utcInstantSchema,
  activatedAt: utcInstantSchema.nullable(),
});
type GenerationRow = z.infer<typeof generationRowSchema>;

const registrationRowSchema = z.strictObject({
  storageId: StorageIdSchema,
  projectId: ProjectIdSchema,
  activeGenerationId: StorageGenerationIdSchema.nullable(),
  activeLocationId: privateLocationIdSchema.nullable(),
  createdAt: utcInstantSchema,
  activatedAt: utcInstantSchema.nullable(),
});
type RegistrationRow = z.infer<typeof registrationRowSchema>;

const locationRowSchema = z.strictObject({
  storageId: StorageIdSchema,
  locationId: privateLocationIdSchema,
  normalizedPath: z.string().min(1),
  locationState: z.enum(["staging", "committed"]),
  observedAt: utcInstantSchema,
});
type LocationRow = z.infer<typeof locationRowSchema>;

const canonicalIdentityRowSchema = z.strictObject({
  identityKey: z.literal("storage"),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema,
  createdAt: utcInstantSchema,
});

const runtimeIdentityRowSchema = z.strictObject({
  identityKey: z.literal("storage"),
  projectId: ProjectIdSchema,
  storageId: StorageIdSchema,
  generationId: StorageGenerationIdSchema,
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema,
  createdAt: utcInstantSchema,
});

const drizzleJournalSchema = z.strictObject({
  version: z.string().trim().min(1),
  dialect: z.literal("sqlite"),
  entries: z.array(
    z.strictObject({
      idx: z.number().int().nonnegative(),
      version: z.string().trim().min(1),
      when: z.number().int().nonnegative(),
      tag: z.string().regex(/^[0-9]{4}_[a-z0-9_]+$/u),
      breakpoints: z.boolean(),
    }),
  ),
});

const tableNameRowSchema = z.strictObject({ name: z.string().trim().min(1) });

const witnessOrder = [
  "registration-record",
  "location-record",
  "generation-record",
  "project-root",
  "repository-marker",
  "manifest",
  "generation-directory",
  "canonical-database",
  "runtime-database",
  "canonical-wal",
  "canonical-shm",
  "canonical-rollback-journal",
  "runtime-wal",
  "runtime-shm",
  "runtime-rollback-journal",
  "local-snapshot",
  "deletion-tombstone",
  "unfinished-storage-operation",
] as const satisfies readonly PriorStateWitnessKind[];

const reservedFileWitnesses = new Map<string, PriorStateWitnessKind>([
  [".slopstop-repository", "repository-marker"],
  [projectStorageManifestFilename, "manifest"],
  [canonicalDatabaseFilename, "canonical-database"],
  [`${canonicalDatabaseFilename}-wal`, "canonical-wal"],
  [`${canonicalDatabaseFilename}-shm`, "canonical-shm"],
  [`${canonicalDatabaseFilename}-journal`, "canonical-rollback-journal"],
  [runtimeDatabaseFilename, "runtime-database"],
  [`${runtimeDatabaseFilename}-wal`, "runtime-wal"],
  [`${runtimeDatabaseFilename}-shm`, "runtime-shm"],
  [`${runtimeDatabaseFilename}-journal`, "runtime-rollback-journal"],
  ["deletion.tombstone", "deletion-tombstone"],
  ["storage-operation.journal", "unfinished-storage-operation"],
]);

const rootDatabaseWitnessKinds = new Set<PriorStateWitnessKind>([
  "canonical-database",
  "runtime-database",
  "canonical-wal",
  "canonical-shm",
  "canonical-rollback-journal",
  "runtime-wal",
  "runtime-shm",
  "runtime-rollback-journal",
]);

const maximumProjectDirectoryEntries = 256;
const maximumGenerationDirectoryEntries = 16;

export type NodeProjectStorageOptions = Readonly<{
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
  applicationVersion: string;
  ids?: ProjectStorageStoreDependencies["ids"];
  clock?: ProjectStorageStoreDependencies["clock"];
  failures?: ProjectStorageStoreDependencies["failures"];
  initializeApplicationClient?: (client: LocalClient) => Promise<void>;
}>;

class SerialLock {
  #tail: Promise<void> = Promise.resolve();

  async run<Result>(operation: () => Promise<Result>): Promise<Result> {
    const previous = this.#tail;
    let release: () => void = () => undefined;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  runAfterPending(operation: () => void): Promise<void> {
    return this.run(async () => {
      operation();
    });
  }
}

function createLocalClient(databasePath: string): LocalClient {
  return createClient({ url: pathToFileURL(databasePath).href });
}

const applicationClientInitializationFailureMessage =
  "Project Storage application client initialization failed.";

export async function initializeRetainedApplicationClient<
  Client extends Readonly<{ close(): void }>,
>(
  client: Client,
  retain: (client: Client | undefined) => void,
  initialize: (client: Client) => Promise<void>,
): Promise<Client> {
  retain(client);
  try {
    await initialize(client);
    return client;
  } catch (initializationFailure) {
    retain(undefined);
    try {
      client.close();
    } catch (closeFailure) {
      throw new AggregateError(
        [initializationFailure, closeFailure],
        applicationClientInitializationFailureMessage,
      );
    }
    throw initializationFailure;
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  try {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

function isMissingError(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function isUnavailableError(error: unknown): boolean {
  const code = errorCode(error);
  return code === "EACCES" || code === "EPERM" || code === "EBUSY";
}

function normalizeApplicationError(error: unknown, message: string): never {
  if (
    error instanceof AggregateError &&
    error.message === applicationClientInitializationFailureMessage
  ) {
    throw error;
  }
  if (
    error instanceof ProjectStorageBrokenError ||
    error instanceof ProjectStorageUnavailableError
  ) {
    throw error;
  }
  if (isUnavailableError(error)) {
    throw new ProjectStorageUnavailableError("Project Storage application authority is unavailable.");
  }
  throw new ProjectStorageBrokenError(message);
}

async function lstatIfPresent(targetPath: string) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (isMissingError(error)) {
      return undefined;
    }
    throw error;
  }
}

async function requirePlainDirectory(directoryPath: string, message: string): Promise<void> {
  const entry = await lstatIfPresent(directoryPath);
  if (entry === undefined || entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new ProjectStorageBrokenError(message);
  }
}

async function requirePlainFile(filePath: string, message: string): Promise<void> {
  const entry = await lstatIfPresent(filePath);
  if (entry === undefined || entry.isSymbolicLink() || !entry.isFile()) {
    throw new ProjectStorageBrokenError(message);
  }
}

function rowObject(
  columns: readonly string[],
  row: ReadonlyArray<unknown>,
): Record<string, unknown> {
  return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
}

function resultObjects(result: Awaited<ReturnType<LocalClient["execute"]>>): unknown[] {
  return result.rows.map((row) => rowObject(result.columns, row));
}

function exactlyOne<Output>(rows: readonly Output[], message: string): Output {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw new ProjectStorageBrokenError(message);
  }
  return row;
}

function equalStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

async function tableNames(client: LocalClient | LocalTransaction): Promise<readonly string[]> {
  const result = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return tableNameRowSchema
    .array()
    .parse(resultObjects(result))
    .map((row) => row.name);
}

async function metadataRows(
  client: LocalClient | LocalTransaction,
  spec: DatabaseSpec,
): Promise<readonly MetadataRow[]> {
  const result = await client.execute(
    `SELECT metadata_key AS metadataKey, database_kind AS databaseKind,
      format_version AS formatVersion, schema_version AS schemaVersion,
      last_migration_id AS lastMigrationId FROM ${spec.metadataTable}`,
  );
  return metadataRowSchema.array().parse(resultObjects(result));
}

type WriteTransaction = Readonly<{
  closed: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): void;
}>;

type WriteTransactionClient<Transaction extends WriteTransaction> = Readonly<{
  transaction(mode: "write"): Promise<Transaction>;
}>;

export async function withWriteTransaction<
  Transaction extends WriteTransaction,
  Result,
>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<Result> {
  const transaction = await client.transaction("write");
  try {
    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (operationError) {
    if (!transaction.closed) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        throw new ProjectStorageBrokenError("Project Storage transaction rollback failed.", {
          cause: new AggregateError(
            [operationError, rollbackError],
            "Project Storage transaction and rollback both failed.",
          ),
        });
      }
    }
    throw operationError;
  } finally {
    transaction.close();
  }
}

function migrationMetadataSql(spec: DatabaseSpec): string {
  return `INSERT INTO ${spec.metadataTable}
    (metadata_key, database_kind, format_version, schema_version, last_migration_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(metadata_key) DO UPDATE SET
      database_kind = excluded.database_kind,
      format_version = excluded.format_version,
      schema_version = excluded.schema_version,
      last_migration_id = excluded.last_migration_id`;
}

function createMigrationTarget(
  client: LocalClient,
  spec: DatabaseSpec,
): GeneratedMigrationTarget {
  return {
    inspectAuthority: async (): Promise<MigrationAuthority> => {
      const names = await tableNames(client);
      if (!names.includes(spec.metadataTable)) {
        if (names.length === 0) {
          return { status: "fresh" };
        }
        throw new ProjectStorageBrokenError("Database metadata authority is missing.");
      }
      const metadata = exactlyOne(
        await metadataRows(client, spec),
        "Database metadata authority must contain exactly one row.",
      );
      if (metadata.metadataKey !== spec.metadataKey) {
        throw new ProjectStorageBrokenError("Database metadata singleton key is invalid.");
      }
      return {
        status: "existing",
        databaseKind: metadata.databaseKind,
        formatVersion: metadata.formatVersion,
        schemaVersion: metadata.schemaVersion,
        lastMigrationId: metadata.lastMigrationId,
      };
    },
    applyBatch: async (input) => {
      await withWriteTransaction(client, async (transaction) => {
        for (const migration of input.migrations) {
          for (const statement of migration.statements) {
            await transaction.execute(statement);
          }
        }
        await transaction.execute({
          sql: migrationMetadataSql(spec),
          args: [
            spec.metadataKey,
            input.databaseKind,
            input.formatVersion,
            input.schemaVersion,
            input.lastMigrationId,
          ],
        });
      });
    },
  };
}

function validateMigrationSql(spec: DatabaseSpec, sources: readonly string[]): void {
  const createdTables = new Set<string>();
  const createTablePattern = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?[`"\[]?([a-z_][a-z0-9_]*)/giu;
  for (const source of sources) {
    if (/__drizzle_migrations/iu.test(source)) {
      throw new ProjectStorageBrokenError("Generated migration uses a forbidden implicit ledger.");
    }
    if (/\bcreate\s+(?:trigger|view)\b/iu.test(source)) {
      throw new ProjectStorageBrokenError("Generated migration creates a forbidden object.");
    }
    for (const match of source.matchAll(createTablePattern)) {
      const table = match[1];
      if (table === undefined || !spec.tables.includes(table)) {
        throw new ProjectStorageBrokenError("Generated migration creates an unknown table.");
      }
      createdTables.add(table);
    }
  }
  const actual = [...createdTables].sort((left, right) => left.localeCompare(right));
  const expected = [...spec.tables].sort((left, right) => left.localeCompare(right));
  if (!equalStrings(actual, expected)) {
    throw new ProjectStorageBrokenError("Generated migration table authority is incomplete.");
  }
}

function splitMigrationStatements(source: string): readonly string[] {
  const statements = source
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  if (statements.length === 0) {
    throw new ProjectStorageBrokenError("Generated migration contains no statements.");
  }
  return statements;
}

export async function loadGeneratedMigrations(
  migrationResourcesRoot: string,
  spec: DatabaseSpec,
): Promise<readonly GeneratedMigration[]> {
  const kindRoot = path.resolve(migrationResourcesRoot, spec.resourceKind);
  const relativeRoot = path.relative(migrationResourcesRoot, kindRoot);
  if (relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
    throw new ProjectStorageBrokenError("Generated migration root escaped trusted resources.");
  }
  await requirePlainDirectory(kindRoot, "Generated migration directory is unavailable.");
  const metadataRoot = path.join(kindRoot, "meta");
  await requirePlainDirectory(metadataRoot, "Generated migration metadata is unavailable.");
  const journalPath = path.join(metadataRoot, "_journal.json");
  await requirePlainFile(journalPath, "Generated migration journal is unavailable.");
  let journal: z.infer<typeof drizzleJournalSchema>;
  try {
    journal = drizzleJournalSchema.parse(
      JSON.parse(await readNodeFile(journalPath, "utf8")),
    );
  } catch {
    throw new ProjectStorageBrokenError("Generated migration journal is invalid.");
  }
  const tags = new Set<string>();
  let previousWhen = -1;
  for (const [index, entry] of journal.entries.entries()) {
    if (
      entry.idx !== index ||
      entry.when < previousWhen ||
      tags.has(entry.tag)
    ) {
      throw new ProjectStorageBrokenError("Generated migration journal ordering is invalid.");
    }
    previousWhen = entry.when;
    tags.add(entry.tag);
  }
  if (journal.entries.length === 0) {
    throw new ProjectStorageBrokenError("Generated migration journal is empty.");
  }

  const expectedSqlNames = journal.entries.map((entry) => `${entry.tag}.sql`);
  const rootEntries = await readdir(kindRoot, { withFileTypes: true });
  const actualNames = rootEntries
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const expectedNames = ["meta", ...expectedSqlNames].sort((left, right) =>
    left.localeCompare(right),
  );
  if (!equalStrings(actualNames, expectedNames)) {
    throw new ProjectStorageBrokenError("Generated migration resources disagree with the journal.");
  }
  for (const entry of rootEntries) {
    if (
      entry.isSymbolicLink() ||
      (entry.name === "meta" ? !entry.isDirectory() : !entry.isFile())
    ) {
      throw new ProjectStorageBrokenError("Generated migration resource type is invalid.");
    }
  }

  const sources: string[] = [];
  const migrations: GeneratedMigration[] = [];
  for (const entry of journal.entries) {
    const sqlPath = path.join(kindRoot, `${entry.tag}.sql`);
    const source = await readNodeFile(sqlPath, "utf8");
    if (source.trim().length === 0) {
      throw new ProjectStorageBrokenError("Generated migration SQL is empty.");
    }
    sources.push(source);
    migrations.push({
      migrationId: entry.tag,
      statements: splitMigrationStatements(source),
    });
  }
  validateMigrationSql(spec, sources);
  return migrations;
}

function assertKnownAuthority(
  authority: MigrationAuthority,
  migrations: readonly GeneratedMigration[],
  spec: DatabaseSpec,
): void {
  if (authority.status === "fresh") {
    throw new ProjectStorageBrokenError("Existing database has no migration authority.");
  }
  const migrationIndex = migrations.findIndex(
    (migration) => migration.migrationId === authority.lastMigrationId,
  );
  if (
    authority.databaseKind !== spec.databaseKind ||
    authority.formatVersion > spec.formatVersion ||
    authority.schemaVersion > spec.schemaVersion ||
    migrationIndex < 0
  ) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
}

function integerScalar(result: Awaited<ReturnType<LocalClient["execute"]>>): number | undefined {
  const row = result.rows[0];
  if (result.rows.length !== 1 || row === undefined || row.length !== 1) {
    return undefined;
  }
  const parsed = sqlIntegerSchema.safeParse(row[0]);
  return parsed.success ? parsed.data : undefined;
}

async function requireForeignKeys(client: LocalClient): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  const enabled = integerScalar(await client.execute("PRAGMA foreign_keys"));
  if (enabled !== 1) {
    throw new ProjectStorageBrokenError("Database foreign-key enforcement is unavailable.");
  }
}

async function requireDatabaseIntegrity(client: LocalClient): Promise<void> {
  const foreignKeyRows = await client.execute("PRAGMA foreign_key_check");
  if (foreignKeyRows.rows.length !== 0) {
    throw new ProjectStorageBrokenError("Database foreign-key integrity validation failed.");
  }
  const integrity = await client.execute("PRAGMA integrity_check");
  const row = integrity.rows[0];
  if (
    integrity.rows.length !== 1 ||
    row === undefined ||
    row.length !== 1 ||
    row[0] !== "ok"
  ) {
    throw new ProjectStorageBrokenError("Database integrity validation failed.");
  }
}

async function requireCurrentMetadata(
  client: LocalClient,
  spec: DatabaseSpec,
  migrations: readonly GeneratedMigration[],
): Promise<MetadataRow> {
  const metadata = exactlyOne(
    await metadataRows(client, spec),
    "Database metadata authority must contain exactly one row.",
  );
  const lastMigration = migrations.at(-1);
  if (
    lastMigration === undefined ||
    metadata.metadataKey !== spec.metadataKey ||
    metadata.databaseKind !== spec.databaseKind ||
    metadata.formatVersion !== spec.formatVersion ||
    metadata.schemaVersion !== spec.schemaVersion ||
    metadata.lastMigrationId !== lastMigration.migrationId
  ) {
    throw new ProjectStorageBrokenError("Database metadata authority is not current.");
  }
  return metadata;
}

async function requireExactTables(client: LocalClient, spec: DatabaseSpec): Promise<void> {
  const actual = [...(await tableNames(client))].sort((left, right) => left.localeCompare(right));
  const expected = [...spec.tables].sort((left, right) => left.localeCompare(right));
  if (!equalStrings(actual, expected)) {
    throw new ProjectStorageBrokenError("Database contains an unexpected table set.");
  }
}

const tableSqlRowSchema = z.strictObject({
  tableName: z.string(),
  sql: z.string(),
});
const indexMetadataRowSchema = z.strictObject({
  name: z.string(),
  isUnique: sqlIntegerSchema.refine((value) => value === 0 || value === 1),
  partial: sqlIntegerSchema.refine((value) => value === 0 || value === 1),
  sequence: sqlIntegerSchema,
  columnName: z.string(),
});
const foreignKeyMetadataRowSchema = z.strictObject({
  id: sqlIntegerSchema,
  sequence: sqlIntegerSchema,
  referencedTable: z.string(),
  columnName: z.string(),
  referencedColumn: z.string(),
  onUpdate: z.enum(["NO ACTION", "RESTRICT"]),
  onDelete: z.enum(["NO ACTION", "RESTRICT"]),
  match: z.literal("NONE"),
});

function requireExactObjectKeys(
  actual: readonly string[],
  expected: readonly string[],
  missingMessage: string,
  unexpectedMessage: string,
): void {
  const count = (keys: readonly string[]): ReadonlyMap<string, number> => {
    const counts = new Map<string, number>();
    for (const key of keys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const actualCounts = count(actual);
  const expectedCounts = count(expected);
  if (
    expected.some(
      (key) => (actualCounts.get(key) ?? 0) < (expectedCounts.get(key) ?? 0),
    )
  ) {
    throw new ProjectStorageBrokenError(missingMessage);
  }
  if (
    actual.some(
      (key) => (actualCounts.get(key) ?? 0) > (expectedCounts.get(key) ?? 0),
    )
  ) {
    throw new ProjectStorageBrokenError(unexpectedMessage);
  }
}

function checkKey(check: NamedCheckSpec): string {
  return `${check.table}\u0000${check.name}`;
}

function indexKey(indexSpec: NamedIndexSpec): string {
  return [
    indexSpec.table,
    indexSpec.name,
    String(indexSpec.unique),
    String(indexSpec.partial),
    ...indexSpec.columns,
  ].join("\u0000");
}

function foreignKeyKey(foreignKey: ForeignKeySpec): string {
  return [
    foreignKey.table,
    ...foreignKey.columns,
    "->",
    foreignKey.referencedTable,
    ...foreignKey.referencedColumns,
    foreignKey.onUpdate,
    foreignKey.onDelete,
    foreignKey.match,
  ].join("\u0000");
}

export async function requireDeclaredSchemaObjects(
  client: LocalClient,
  spec: DatabaseSpec,
): Promise<void> {
  const tableDefinitions = tableSqlRowSchema.array().parse(
    resultObjects(
      await client.execute(
        "SELECT name AS tableName, sql FROM sqlite_schema " +
          "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      ),
    ),
  );
  const checkPattern = /\bconstraint\s+["`\[]?([a-z_][a-z0-9_]*)["`\]]?\s+check\s*\(/giu;
  const actualChecks: NamedCheckSpec[] = [];
  for (const definition of tableDefinitions) {
    for (const match of definition.sql.matchAll(checkPattern)) {
      const name = match[1];
      if (name !== undefined) {
        actualChecks.push({ table: definition.tableName, name });
      }
    }
  }
  requireExactObjectKeys(
    actualChecks.map(checkKey),
    spec.checks.map(checkKey),
    "Database required CHECK constraint is missing.",
    "Database contains an unexpected CHECK constraint.",
  );

  const actualIndexes: Array<{
    table: string;
    name: string;
    unique: boolean;
    partial: boolean;
    columns: string[];
  }> = [];
  const actualForeignKeys: Array<{
    table: string;
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
    onUpdate: "NO ACTION" | "RESTRICT";
    onDelete: "NO ACTION" | "RESTRICT";
    match: "NONE";
  }> = [];
  for (const table of spec.tables) {
    const indexRows = indexMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
          sql: `SELECT il.name AS name, il."unique" AS isUnique,
            il.partial AS partial, ii.seqno AS sequence, ii.name AS columnName
            FROM pragma_index_list(?) AS il
            JOIN pragma_index_info(il.name) AS ii
            WHERE il.origin = 'c' ORDER BY il.name, ii.seqno`,
          args: [table],
        }),
      ),
    );
    for (const row of indexRows) {
      const current = actualIndexes.at(-1);
      if (current !== undefined && current.table === table && current.name === row.name) {
        current.columns.push(row.columnName);
      } else {
        actualIndexes.push({
          table,
          name: row.name,
          unique: row.isUnique === 1,
          partial: row.partial === 1,
          columns: [row.columnName],
        });
      }
    }

    const foreignKeyRows = foreignKeyMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
          sql: `SELECT id, seq AS sequence, "table" AS referencedTable,
            "from" AS columnName, "to" AS referencedColumn,
            on_update AS onUpdate, on_delete AS onDelete, match
            FROM pragma_foreign_key_list(?) ORDER BY id, seq`,
          args: [table],
        }),
      ),
    );
    let previousId: number | undefined;
    for (const row of foreignKeyRows) {
      const current = actualForeignKeys.at(-1);
      if (current !== undefined && previousId === row.id) {
        current.columns.push(row.columnName);
        current.referencedColumns.push(row.referencedColumn);
      } else {
        actualForeignKeys.push({
          table,
          columns: [row.columnName],
          referencedTable: row.referencedTable,
          referencedColumns: [row.referencedColumn],
          onUpdate: row.onUpdate,
          onDelete: row.onDelete,
          match: row.match,
        });
      }
      previousId = row.id;
    }
  }
  requireExactObjectKeys(
    actualIndexes.map(indexKey),
    spec.indexes.map(indexKey),
    "Database required named index is missing.",
    "Database contains an unexpected named index.",
  );
  requireExactObjectKeys(
    actualForeignKeys.map(foreignKeyKey),
    spec.foreignKeys.map(foreignKeyKey),
    "Database required foreign key is missing.",
    "Database contains an unexpected foreign key.",
  );
}

async function insertDatabaseIdentity(
  client: LocalClient,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
): Promise<void> {
  if (spec.databaseKind === "canonical") {
    const row = canonicalIdentityRowSchema.parse({
      identityKey: "storage",
      projectId: creation.projectId,
      storageId: creation.storageId,
      generationId: creation.generationId,
      canonicalDatabaseLineageId: creation.canonicalDatabaseLineageId,
      createdAt: creation.createdAt,
    });
    await client.execute({
      sql: `INSERT INTO storage_identity
        (identity_key, project_id, storage_id, generation_id,
          canonical_database_lineage_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        row.identityKey,
        row.projectId,
        row.storageId,
        row.generationId,
        row.canonicalDatabaseLineageId,
        row.createdAt,
      ],
    });
    return;
  }
  const row = runtimeIdentityRowSchema.parse({
    identityKey: "storage",
    projectId: creation.projectId,
    storageId: creation.storageId,
    generationId: creation.generationId,
    runtimeDatabaseLineageId: creation.runtimeDatabaseLineageId,
    createdAt: creation.createdAt,
  });
  await client.execute({
    sql: `INSERT INTO slopstop_runtime_storage_identity
      (identity_key, project_id, storage_id, generation_id,
        runtime_database_lineage_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      row.identityKey,
      row.projectId,
      row.storageId,
      row.generationId,
      row.runtimeDatabaseLineageId,
      row.createdAt,
    ],
  });
}

async function requireDatabaseIdentity(
  client: LocalClient,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
): Promise<void> {
  if (spec.databaseKind === "canonical") {
    const result = await client.execute(
      `SELECT identity_key AS identityKey, project_id AS projectId,
        storage_id AS storageId, generation_id AS generationId,
        canonical_database_lineage_id AS canonicalDatabaseLineageId,
        created_at AS createdAt FROM storage_identity`,
    );
    const row = exactlyOne(
      canonicalIdentityRowSchema.array().parse(resultObjects(result)),
      "Canonical Storage identity must contain exactly one row.",
    );
    if (
      row.projectId !== creation.projectId ||
      row.storageId !== creation.storageId ||
      row.generationId !== creation.generationId ||
      row.canonicalDatabaseLineageId !== creation.canonicalDatabaseLineageId ||
      row.createdAt !== creation.createdAt
    ) {
      throw new ProjectStorageBrokenError("Canonical Storage identity does not agree.");
    }
    return;
  }
  const result = await client.execute(
    `SELECT identity_key AS identityKey, project_id AS projectId,
      storage_id AS storageId, generation_id AS generationId,
      runtime_database_lineage_id AS runtimeDatabaseLineageId,
      created_at AS createdAt FROM slopstop_runtime_storage_identity`,
  );
  const row = exactlyOne(
    runtimeIdentityRowSchema.array().parse(resultObjects(result)),
    "Runtime Storage identity must contain exactly one row.",
  );
  if (
    row.projectId !== creation.projectId ||
    row.storageId !== creation.storageId ||
    row.generationId !== creation.generationId ||
    row.runtimeDatabaseLineageId !== creation.runtimeDatabaseLineageId ||
    row.createdAt !== creation.createdAt
  ) {
    throw new ProjectStorageBrokenError("Runtime Storage identity does not agree.");
  }
}

async function buildDatabase(
  databasePath: string,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<ClosedDatabaseBuild> {
  if ((await lstatIfPresent(databasePath)) !== undefined) {
    throw new ProjectStorageBrokenError("Database creation target already exists.");
  }
  const client = createLocalClient(databasePath);
  try {
    await requireForeignKeys(client);
    const migrations = await loadMigrations(spec);
    await applyGeneratedMigrations({
      target: createMigrationTarget(client, spec),
      expectedKind: spec.databaseKind,
      expectedFormatVersion: spec.formatVersion,
      expectedSchemaVersion: spec.schemaVersion,
      migrations,
    });
    await insertDatabaseIdentity(client, spec, creation);
    await requireExactTables(client, spec);
    await requireDeclaredSchemaObjects(client, spec);
    const metadata = await requireCurrentMetadata(client, spec, migrations);
    await requireDatabaseIdentity(client, spec, creation);
    await requireDatabaseIntegrity(client);
    return {
      state: "closed",
      formatVersion: metadata.formatVersion,
      schemaVersion: metadata.schemaVersion,
      lastMigrationId: metadata.lastMigrationId,
    };
  } finally {
    client.close();
  }
}

function assertManifestIdentity(
  manifest: ProjectStorageManifestV1,
  creation: AllocatedCreation,
): void {
  if (
    manifest.projectId !== creation.projectId ||
    manifest.storageId !== creation.storageId ||
    manifest.generationId !== creation.generationId ||
    manifest.provenance.createRequestId !== creation.createRequestId ||
    manifest.canonical.databaseLineageId !== creation.canonicalDatabaseLineageId ||
    manifest.runtime.databaseLineageId !== creation.runtimeDatabaseLineageId ||
    manifest.createdAt !== creation.createdAt
  ) {
    throw new ProjectStorageBrokenError("Project Storage manifest identity does not agree.");
  }
}

async function verifyOwnedDatabase(
  databasePath: string,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
  manifest: ProjectStorageManifestV1,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<void> {
  await requirePlainFile(databasePath, "Sealed database is unavailable.");
  const client = createLocalClient(databasePath);
  try {
    await requireForeignKeys(client);
    const migrations = await loadMigrations(spec);
    const metadata = await requireCurrentMetadata(client, spec, migrations);
    const expectedMetadata =
      spec.databaseKind === "canonical"
        ? {
            formatVersion: manifest.canonical.formatVersion,
            schemaVersion: manifest.canonical.schemaVersion,
            lastMigrationId: manifest.canonical.lastMigrationId,
          }
        : {
            formatVersion: manifest.runtime.adapterFormatVersion,
            schemaVersion: manifest.runtime.adapterSchemaVersion,
            lastMigrationId: manifest.runtime.adapterLastMigrationId,
          };
    if (
      metadata.formatVersion !== expectedMetadata.formatVersion ||
      metadata.schemaVersion !== expectedMetadata.schemaVersion ||
      metadata.lastMigrationId !== expectedMetadata.lastMigrationId
    ) {
      throw new ProjectStorageBrokenError("Database metadata disagrees with the manifest.");
    }
    await requireDatabaseIdentity(client, spec, creation);
    await requireExactTables(client, spec);
    await requireDeclaredSchemaObjects(client, spec);
    await requireDatabaseIntegrity(client);
  } finally {
    client.close();
  }
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256").update(await readNodeFile(filePath)).digest("hex");
}

async function verifySealedGeneration(
  paths: ProjectStorageGenerationPaths,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<void> {
  await requirePlainFile(paths.manifest, "Project Storage manifest is unavailable.");
  const manifest = parseProjectStorageManifest(await readNodeFile(paths.manifest, "utf8"));
  assertManifestIdentity(manifest, creation);
  await verifyOwnedDatabase(
    paths.canonicalDatabase,
    databaseSpecs.canonical,
    creation,
    manifest,
    loadMigrations,
  );
  await verifyOwnedDatabase(
    paths.runtimeDatabase,
    databaseSpecs.runtime,
    creation,
    manifest,
    loadMigrations,
  );
  const [canonicalEntry, runtimeEntry, canonicalHash, runtimeHash] = await Promise.all([
    lstat(paths.canonicalDatabase),
    lstat(paths.runtimeDatabase),
    sha256File(paths.canonicalDatabase),
    sha256File(paths.runtimeDatabase),
  ]);
  if (
    canonicalEntry.size !== manifest.canonical.activationBaseline.sizeBytes ||
    canonicalHash !== manifest.canonical.activationBaseline.sha256 ||
    runtimeEntry.size !== manifest.runtime.activationBaseline.sizeBytes ||
    runtimeHash !== manifest.runtime.activationBaseline.sha256
  ) {
    throw new ProjectStorageBrokenError("Sealed database activation baseline does not agree.");
  }
}

async function generationRowsByRequest(
  client: LocalClient | LocalTransaction,
  createRequestId: ProjectStorageCreateRequest["createRequestId"],
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, generation_id AS generationId,
      project_id AS projectId, location_id AS locationId,
      canonical_lineage_id AS canonicalDatabaseLineageId,
      runtime_lineage_id AS runtimeDatabaseLineageId,
      create_request_id AS createRequestId,
      create_request_fingerprint AS createRequestFingerprint,
      generation_directory_name AS generationDirectoryName,
      creation_state AS creationState, created_at AS createdAt,
      activated_at AS activatedAt
      FROM storage_generations WHERE create_request_id = ?`,
    args: [createRequestId],
  });
  return generationRowSchema.array().parse(resultObjects(result));
}

async function registrationRowsByProject(
  client: LocalClient | LocalTransaction,
  projectId: ProjectId,
): Promise<readonly RegistrationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, project_id AS projectId,
      active_generation_id AS activeGenerationId,
      active_location_id AS activeLocationId,
      created_at AS createdAt, activated_at AS activatedAt
      FROM storage_registrations WHERE project_id = ?`,
    args: [projectId],
  });
  return registrationRowSchema.array().parse(resultObjects(result));
}

async function locationRowsByStorage(
  client: LocalClient | LocalTransaction,
  storageId: GenerationRow["storageId"],
  locationId: GenerationRow["locationId"],
): Promise<readonly LocationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, location_id AS locationId,
      normalized_path AS normalizedPath, location_state AS locationState,
      observed_at AS observedAt FROM storage_locations
      WHERE storage_id = ? AND location_id = ?`,
    args: [storageId, locationId],
  });
  return locationRowSchema.array().parse(resultObjects(result));
}

async function locationRowsByNormalizedPath(
  client: LocalClient | LocalTransaction,
  normalizedProjectRoot: string,
): Promise<readonly LocationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, location_id AS locationId,
      normalized_path AS normalizedPath, location_state AS locationState,
      observed_at AS observedAt FROM storage_locations
      WHERE normalized_path = ?`,
    args: [normalizedProjectRoot],
  });
  return locationRowSchema.array().parse(resultObjects(result));
}

async function inspectCreateRows(
  client: LocalClient | LocalTransaction,
  request: ProjectStorageCreateRequest,
  createRequestFingerprint: string,
  expectedProjectRoot: string,
): Promise<CreateInspection> {
  const requestRows = await generationRowsByRequest(client, request.createRequestId);
  if (requestRows.length > 1) {
    throw new ProjectStorageBrokenError("Create request authority is not unique.");
  }
  const generation = requestRows[0];
  if (generation !== undefined) {
    if (generation.projectId !== request.projectId) {
      return { status: "idempotency-conflict" };
    }
    if (generation.createRequestFingerprint !== createRequestFingerprint) {
      throw new ProjectStorageBrokenError("Create request fingerprint does not agree.");
    }
    if (generation.creationState === "staging") {
      return { status: "incomplete-request" };
    }
    const registration = exactlyOne(
      await registrationRowsByProject(client, request.projectId),
      "Active create request has no unique registration.",
    );
    const location = exactlyOne(
      await locationRowsByStorage(client, generation.storageId, generation.locationId),
      "Active create request has no unique location.",
    );
    if (
      registration.storageId !== generation.storageId ||
      registration.activeGenerationId !== generation.generationId ||
      registration.activeLocationId !== generation.locationId ||
      registration.activatedAt === null ||
      location.locationState !== "committed" ||
      path.resolve(location.normalizedPath) !== expectedProjectRoot ||
      generation.generationDirectoryName !== generation.generationId ||
      generation.activatedAt === null
    ) {
      throw new ProjectStorageBrokenError("Active create request authority is inconsistent.");
    }
    return {
      status: "active-replay",
      identity: {
        storageId: generation.storageId,
        generationId: generation.generationId,
        canonicalDatabaseLineageId: generation.canonicalDatabaseLineageId,
        runtimeDatabaseLineageId: generation.runtimeDatabaseLineageId,
      },
    };
  }
  const registrations = await registrationRowsByProject(client, request.projectId);
  if (registrations.length > 1) {
    throw new ProjectStorageBrokenError("Project registration authority is not unique.");
  }
  return registrations.length === 1 ? { status: "already-registered" } : { status: "fresh" };
}

function assertRowsAffected(rowsAffected: number, message: string): void {
  if (rowsAffected !== 1) {
    throw new ProjectStorageBrokenError(message);
  }
}

async function insertStagingRows(
  transaction: LocalTransaction,
  declaration: z.infer<typeof stagingDeclarationSchema>,
): Promise<void> {
  const location = await transaction.execute({
    sql: `INSERT INTO storage_locations
      (storage_id, location_id, normalized_path, location_state, observed_at)
      VALUES (?, ?, ?, ?, ?)`,
    args: [
      declaration.storageId,
      declaration.locationId,
      declaration.normalizedPath,
      declaration.locationState,
      declaration.observedAt,
    ],
  });
  assertRowsAffected(location.rowsAffected, "Staging location was not inserted exactly once.");
  const generation = await transaction.execute({
    sql: `INSERT INTO storage_generations
      (storage_id, generation_id, project_id, location_id,
        canonical_lineage_id, runtime_lineage_id, create_request_id,
        create_request_fingerprint, generation_directory_name,
        creation_state, created_at, activated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    args: [
      declaration.storageId,
      declaration.generationId,
      declaration.projectId,
      declaration.locationId,
      declaration.canonicalDatabaseLineageId,
      declaration.runtimeDatabaseLineageId,
      declaration.createRequestId,
      declaration.createRequestFingerprint,
      declaration.generationDirectoryName,
      declaration.creationState,
      declaration.createdAt,
    ],
  });
  assertRowsAffected(generation.rowsAffected, "Staging generation was not inserted exactly once.");
  const registration = await transaction.execute({
    sql: `INSERT INTO storage_registrations
      (storage_id, project_id, active_generation_id, active_location_id,
        created_at, activated_at)
      VALUES (?, ?, NULL, NULL, ?, NULL)`,
    args: [declaration.storageId, declaration.projectId, declaration.createdAt],
  });
  assertRowsAffected(
    registration.rowsAffected,
    "Staging registration was not inserted exactly once.",
  );
}

async function activateRows(
  transaction: LocalTransaction,
  activation: z.infer<typeof activationSchema>,
  failures: ProjectStorageStoreDependencies["failures"],
): Promise<void> {
  const generation = await transaction.execute({
    sql: `UPDATE storage_generations SET creation_state = 'active', activated_at = ?
      WHERE storage_id = ? AND generation_id = ? AND project_id = ?
        AND location_id = ? AND creation_state = 'staging' AND activated_at IS NULL`,
    args: [
      activation.activatedAt,
      activation.storageId,
      activation.generationId,
      activation.projectId,
      activation.locationId,
    ],
  });
  assertRowsAffected(generation.rowsAffected, "Staging generation was not activated exactly once.");
  const location = await transaction.execute({
    sql: `UPDATE storage_locations SET location_state = 'committed'
      WHERE storage_id = ? AND location_id = ? AND location_state = 'staging'`,
    args: [activation.storageId, activation.locationId],
  });
  assertRowsAffected(location.rowsAffected, "Staging location was not committed exactly once.");
  const registration = await transaction.execute({
    sql: `UPDATE storage_registrations
      SET active_generation_id = ?, active_location_id = ?, activated_at = ?
      WHERE storage_id = ? AND project_id = ?
        AND active_generation_id IS NULL AND active_location_id IS NULL
        AND activated_at IS NULL`,
    args: [
      activation.generationId,
      activation.locationId,
      activation.activatedAt,
      activation.storageId,
      activation.projectId,
    ],
  });
  assertRowsAffected(
    registration.rowsAffected,
    "Staging registration was not activated exactly once.",
  );
  await failures.checkpoint("during-activation-transaction");
}

type FilesystemWitnessScan = Readonly<{
  kinds: readonly PriorStateWitnessKind[];
  hasStagingGeneration: boolean;
  ordinaryGenerationIds: readonly StorageGenerationId[];
  hasRootDatabaseWitness: boolean;
}>;

async function inspectGenerationDirectory(
  directoryPath: string,
  kinds: Set<PriorStateWitnessKind>,
): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  if (entries.length > maximumGenerationDirectoryEntries) {
    throw new ProjectStorageBrokenError("Project Storage generation witness set is unbounded.");
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new ProjectStorageBrokenError("Project Storage generation witness type is invalid.");
    }
    const kind = reservedFileWitnesses.get(entry.name);
    if (kind === undefined || kind === "repository-marker") {
      throw new ProjectStorageBrokenError("Project Storage generation contains an unknown witness.");
    }
    kinds.add(kind);
  }
}

async function inspectFilesystemWitnesses(projectRoot: string): Promise<FilesystemWitnessScan> {
  const root = await lstatIfPresent(projectRoot);
  if (root === undefined) {
    return {
      kinds: [],
      hasStagingGeneration: false,
      ordinaryGenerationIds: [],
      hasRootDatabaseWitness: false,
    };
  }
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new ProjectStorageBrokenError("Project Storage root witness type is invalid.");
  }
  const kinds = new Set<PriorStateWitnessKind>(["project-root"]);
  let hasStagingGeneration = false;
  const ordinaryGenerationIds: StorageGenerationId[] = [];
  let hasRootDatabaseWitness = false;
  const entries = await readdir(projectRoot, { withFileTypes: true });
  if (entries.length > maximumProjectDirectoryEntries) {
    throw new ProjectStorageBrokenError("Project Storage witness set is unbounded.");
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new ProjectStorageBrokenError("Project Storage witness must not be a symbolic link.");
    }
    const directKind = reservedFileWitnesses.get(entry.name);
    if (directKind !== undefined) {
      if (!entry.isFile()) {
        throw new ProjectStorageBrokenError("Project Storage file witness type is invalid.");
      }
      kinds.add(directKind);
      hasRootDatabaseWitness ||= rootDatabaseWitnessKinds.has(directKind);
      continue;
    }
    if (entry.name === "snapshots" || entry.name === "storage-operations") {
      if (!entry.isDirectory()) {
        throw new ProjectStorageBrokenError("Project Storage directory witness type is invalid.");
      }
      kinds.add(entry.name === "snapshots" ? "local-snapshot" : "unfinished-storage-operation");
      continue;
    }
    const generationText = entry.name.startsWith(".staging-")
      ? entry.name.slice(".staging-".length)
      : entry.name;
    const generationId = StorageGenerationIdSchema.safeParse(generationText);
    if (!generationId.success || !entry.isDirectory()) {
      throw new ProjectStorageBrokenError("Project Storage root contains an unknown witness.");
    }
    if (entry.name.startsWith(".staging-")) {
      hasStagingGeneration = true;
    } else {
      ordinaryGenerationIds.push(generationId.data);
    }
    kinds.add("generation-directory");
    await inspectGenerationDirectory(path.join(projectRoot, entry.name), kinds);
  }
  return {
    kinds: witnessOrder.filter((kind) => kinds.has(kind)),
    hasStagingGeneration,
    ordinaryGenerationIds: ordinaryGenerationIds.sort((left, right) =>
      left.localeCompare(right),
    ),
    hasRootDatabaseWitness,
  };
}

function createNodeAdapters(options: NodeProjectStorageOptions): ProjectStorageStoreDependencies {
  const applicationStorageRoot = path.resolve(options.applicationStorageRoot);
  const migrationResourcesRoot = path.resolve(options.migrationResourcesRoot);
  const applicationDatabasePath = path.join(applicationStorageRoot, "application.db");
  const projectRootFor = (projectId: ProjectId): string =>
    path.join(applicationStorageRoot, "projects", ProjectIdSchema.parse(projectId));
  const migrationCache = new Map<MigrationResourceKind, Promise<readonly GeneratedMigration[]>>();
  const loadMigrations = (spec: DatabaseSpec): Promise<readonly GeneratedMigration[]> => {
    const existing = migrationCache.get(spec.resourceKind);
    if (existing !== undefined) {
      return existing;
    }
    const loaded = loadGeneratedMigrations(migrationResourcesRoot, spec);
    migrationCache.set(spec.resourceKind, loaded);
    return loaded;
  };
  const failures =
    options.failures ??
    ({ checkpoint: async () => undefined } satisfies ProjectStorageStoreDependencies["failures"]);
  const ids =
    options.ids ??
    ({
      storageId: () => StorageIdSchema.parse(randomUUID()),
      locationId: () => privateLocationIdSchema.parse(randomUUID()),
      generationId: () => StorageGenerationIdSchema.parse(randomUUID()),
      canonicalLineageId: () => CanonicalDatabaseLineageIdSchema.parse(randomUUID()),
      runtimeLineageId: () => RuntimeDatabaseLineageIdSchema.parse(randomUUID()),
    } satisfies ProjectStorageStoreDependencies["ids"]);
  const clock =
    options.clock ??
    ({ now: () => utcInstantSchema.parse(new Date().toISOString()) } satisfies ProjectStorageStoreDependencies["clock"]);
  const createLock = new SerialLock();
  const projectLocks = new Map<ProjectId, SerialLock>();
  const paths: ProjectStorageStoreDependencies["paths"] = {
    forCreation: (projectId, generationId) => {
      const projectRoot = projectRootFor(projectId);
      const activeRoot = path.join(projectRoot, StorageGenerationIdSchema.parse(generationId));
      const stagingRoot = path.join(projectRoot, `.staging-${generationId}`);
      const generationPaths = (root: string): ProjectStorageGenerationPaths => ({
        root,
        canonicalDatabase: path.join(root, canonicalDatabaseFilename),
        runtimeDatabase: path.join(root, runtimeDatabaseFilename),
        manifest: path.join(root, projectStorageManifestFilename),
      });
      return {
        projectRoot,
        staging: generationPaths(stagingRoot),
        active: generationPaths(activeRoot),
      };
    },
  };

  const initializeApplicationClient =
    options.initializeApplicationClient ?? requireForeignKeys;

  let applicationClient: LocalClient | undefined;
  let applicationClientInitialization: Promise<LocalClient | undefined> | undefined;
  let registryStopped = false;

  const acquireApplicationClient = async (
    createIfMissing: boolean,
  ): Promise<LocalClient | undefined> => {
    if (registryStopped) {
      throw new ProjectStorageUnavailableError("Project Storage registry is stopped.");
    }
    if (applicationClient !== undefined) {
      return applicationClient;
    }
    const currentInitialization = applicationClientInitialization;
    if (currentInitialization !== undefined) {
      return currentInitialization;
    }

    const initialization = (async (): Promise<LocalClient | undefined> => {
      const entry = await lstatIfPresent(applicationDatabasePath);
      if (entry === undefined) {
        if (!createIfMissing) {
          return undefined;
        }
        await mkdir(applicationStorageRoot, { recursive: true });
        await requirePlainDirectory(
          applicationStorageRoot,
          "Project Storage application root type is invalid.",
        );
      } else if (entry.isSymbolicLink() || !entry.isFile()) {
        throw new ProjectStorageBrokenError(
          "Project Storage application authority type is invalid.",
        );
      }
      return initializeRetainedApplicationClient(
        createLocalClient(applicationDatabasePath),
        (retained) => {
          applicationClient = retained;
        },
        initializeApplicationClient,
      );
    })();
    applicationClientInitialization = initialization;
    try {
      return await initialization;
    } finally {
      if (applicationClientInitialization === initialization) {
        applicationClientInitialization = undefined;
      }
    }
  };

  const existingApplicationClient = async (): Promise<LocalClient | undefined> => {
    try {
      return await acquireApplicationClient(false);
    } catch (error) {
      normalizeApplicationError(error, "Project Storage application authority is invalid.");
    }
  };

  const mutableApplicationClient = async (): Promise<LocalClient> => {
    const existing = await existingApplicationClient();
    if (existing !== undefined) {
      return existing;
    }
    try {
      const created = await acquireApplicationClient(true);
      if (created === undefined) {
        throw new ProjectStorageBrokenError(
          "Project Storage application authority was not created.",
        );
      }
      return created;
    } catch (error) {
      normalizeApplicationError(error, "Project Storage application authority cannot be created.");
    }
  };

  const requireApplicationAuthority = async (client: LocalClient): Promise<void> => {
    const migrations = await loadMigrations(databaseSpecs.application);
    const authority = await createMigrationTarget(
      client,
      databaseSpecs.application,
    ).inspectAuthority();
    assertKnownAuthority(authority, migrations, databaseSpecs.application);
    await requireExactTables(client, databaseSpecs.application);
    await requireDeclaredSchemaObjects(client, databaseSpecs.application);
    await requireDatabaseIntegrity(client);
  };

  const inspectCreate = async (
    request: ProjectStorageCreateRequest,
    createRequestFingerprint: string,
  ): Promise<CreateInspection> => {
    try {
      const client = await existingApplicationClient();
      if (client === undefined) {
        return { status: "fresh" };
      }
      await requireApplicationAuthority(client);
      return await inspectCreateRows(
        client,
        request,
        createRequestFingerprint,
        projectRootFor(request.projectId),
      );
    } catch (error) {
      normalizeApplicationError(error, "Project Storage create authority is invalid.");
    }
  };

  const registryWitnesses = async (
    projectId: ProjectId,
    normalizedProjectRoot: string,
  ): Promise<readonly PriorStateWitnessKind[]> => {
    const client = await existingApplicationClient();
    if (client === undefined) {
      return [];
    }
    await requireApplicationAuthority(client);
    const registrations = await registrationRowsByProject(client, projectId);
    const generationsResult = await client.execute({
      sql: `SELECT storage_id AS storageId, generation_id AS generationId,
        project_id AS projectId, location_id AS locationId,
        canonical_lineage_id AS canonicalDatabaseLineageId,
        runtime_lineage_id AS runtimeDatabaseLineageId,
        create_request_id AS createRequestId,
        create_request_fingerprint AS createRequestFingerprint,
        generation_directory_name AS generationDirectoryName,
        creation_state AS creationState, created_at AS createdAt,
        activated_at AS activatedAt FROM storage_generations WHERE project_id = ?`,
      args: [projectId],
    });
    const generations = generationRowSchema.array().parse(resultObjects(generationsResult));
    const directLocations = await locationRowsByNormalizedPath(client, normalizedProjectRoot);
    let hasGenerationLinkedLocation = false;
    for (const generation of generations) {
      const locations = await locationRowsByStorage(
        client,
        generation.storageId,
        generation.locationId,
      );
      hasGenerationLinkedLocation ||= locations.length > 0;
    }
    const kinds = new Set<PriorStateWitnessKind>();
    if (registrations.length > 0) kinds.add("registration-record");
    if (directLocations.length > 0 || hasGenerationLinkedLocation) {
      kinds.add("location-record");
    }
    if (generations.length > 0) kinds.add("generation-record");
    return witnessOrder.filter((kind) => kinds.has(kind));
  };

  const databases: ProjectStorageStoreDependencies["databases"] = {
    createCanonical: (databasePath, creation) =>
      buildDatabase(databasePath, databaseSpecs.canonical, creation, loadMigrations),
    createRuntime: (databasePath, creation) =>
      buildDatabase(databasePath, databaseSpecs.runtime, creation, loadMigrations),
    verifySealed: (generationPaths, creation) =>
      verifySealedGeneration(generationPaths, creation, loadMigrations),
  };

  const registry: ProjectStorageStoreDependencies["registry"] = {
    inspectCreate,
    declareStaging: async (creation, creationPaths) => {
      const declaration = stagingDeclarationSchema.parse({
        ...creation,
        observedAt: clock.now(),
        normalizedPath: path.resolve(creationPaths.projectRoot),
        generationDirectoryName: creation.generationId,
        locationState: "staging",
        creationState: "staging",
      });
      try {
        const client = await mutableApplicationClient();
        const migrations = await loadMigrations(databaseSpecs.application);
        await applyGeneratedMigrations({
          target: createMigrationTarget(client, databaseSpecs.application),
          expectedKind: databaseSpecs.application.databaseKind,
          expectedFormatVersion: databaseSpecs.application.formatVersion,
          expectedSchemaVersion: databaseSpecs.application.schemaVersion,
          migrations,
        });
        await requireExactTables(client, databaseSpecs.application);
        await requireDeclaredSchemaObjects(client, databaseSpecs.application);
        await requireCurrentMetadata(client, databaseSpecs.application, migrations);
        await requireDatabaseIntegrity(client);
        const current = await inspectCreateRows(
          client,
          {
            projectId: creation.projectId,
            createRequestId: creation.createRequestId,
          },
          creation.createRequestFingerprint,
          projectRootFor(creation.projectId),
        );
        if (current.status !== "fresh") {
          return current;
        }
        await withWriteTransaction(client, async (transaction) => {
          await insertStagingRows(transaction, declaration);
          await failures.checkpoint("during-staging-transaction");
          const rows = await generationRowsByRequest(transaction, creation.createRequestId);
          const row = exactlyOne(rows, "Staging generation was not persisted exactly once.");
          if (
            row.storageId !== creation.storageId ||
            row.generationId !== creation.generationId ||
            row.creationState !== "staging" ||
            row.activatedAt !== null
          ) {
            throw new ProjectStorageBrokenError("Staging generation authority does not agree.");
          }
        });
        return { status: "fresh" };
      } catch (error) {
        normalizeApplicationError(error, "Project Storage staging declaration failed.");
      }
    },
    activate: async (creation, creationPaths) => {
      const activation = activationSchema.parse({
        projectId: creation.projectId,
        storageId: creation.storageId,
        locationId: creation.locationId,
        generationId: creation.generationId,
        activatedAt: clock.now(),
      });
      try {
        await databases.verifySealed(creationPaths.active, creation);
        const client = await existingApplicationClient();
        if (client === undefined) {
          throw new ProjectStorageBrokenError("Project Storage application authority is missing.");
        }
        await requireApplicationAuthority(client);
        await withWriteTransaction(client, async (transaction) => {
          await activateRows(transaction, activation, failures);
          const replay = await inspectCreateRows(
            transaction,
            {
              projectId: creation.projectId,
              createRequestId: creation.createRequestId,
            },
            creation.createRequestFingerprint,
            projectRootFor(creation.projectId),
          );
          if (
            replay.status !== "active-replay" ||
            replay.identity.storageId !== creation.storageId ||
            replay.identity.generationId !== creation.generationId
          ) {
            throw new ProjectStorageBrokenError("Activated Project Storage authority does not agree.");
          }
        });
      } catch (error) {
        normalizeApplicationError(error, "Project Storage activation failed.");
      }
    },
    stop: () => {
      if (!registryStopped) {
        registryStopped = true;
        const retainedApplicationClient = applicationClient;
        applicationClient = undefined;
        retainedApplicationClient?.close();
      }
    },
  };

  return {
    applicationVersion: options.applicationVersion,
    ids,
    clock,
    hashes: {
      sha256Text: async (value) => createHash("sha256").update(value).digest("hex"),
      sha256File,
    },
    paths,
    registry,
    witnesses: {
      inspect: async (projectId) => {
        try {
          const [registryKinds, filesystem] = await Promise.all([
            registryWitnesses(projectId, path.resolve(projectRootFor(projectId))),
            inspectFilesystemWitnesses(projectRootFor(projectId)),
          ]);
          const kinds = new Set<PriorStateWitnessKind>([
            ...registryKinds,
            ...filesystem.kinds,
          ]);
          return witnessOrder.filter((kind) => kinds.has(kind));
        } catch (error) {
          normalizeApplicationError(error, "Project Storage witness authority is invalid.");
        }
      },
    },
    files: {
      createDirectoryExclusive: async (directoryPath) => {
        const projectRoot = path.dirname(directoryPath);
        const projectsRoot = path.dirname(projectRoot);
        if (
          path.dirname(projectsRoot) !== applicationStorageRoot ||
          !path.basename(directoryPath).startsWith(".staging-")
        ) {
          throw new ProjectStorageBrokenError("Project Storage staging path is invalid.");
        }
        await mkdir(applicationStorageRoot, { recursive: true });
        await requirePlainDirectory(
          applicationStorageRoot,
          "Project Storage application root type is invalid.",
        );
        const projectsEntry = await lstatIfPresent(projectsRoot);
        if (projectsEntry === undefined) {
          await mkdir(projectsRoot);
        } else if (projectsEntry.isSymbolicLink() || !projectsEntry.isDirectory()) {
          throw new ProjectStorageBrokenError("Project Storage projects root type is invalid.");
        }
        await mkdir(projectRoot);
        await mkdir(directoryPath);
      },
      writeFileExclusive: async (filePath, contents) => {
        await writeFile(filePath, contents, { encoding: "utf8", flag: "wx" });
      },
      readFile: (filePath) => readNodeFile(filePath, "utf8"),
      size: async (filePath) => {
        const entry = await lstat(filePath);
        if (entry.isSymbolicLink() || !entry.isFile()) {
          throw new ProjectStorageBrokenError("Project Storage file type is invalid.");
        }
        return entry.size;
      },
      renameAtomic: async (source, destination) => {
        if (path.dirname(source) !== path.dirname(destination)) {
          throw new ProjectStorageBrokenError("Project Storage rename must stay on one filesystem.");
        }
        if ((await lstatIfPresent(destination)) !== undefined) {
          throw new ProjectStorageBrokenError("Project Storage activation target already exists.");
        }
        await rename(source, destination);
      },
    },
    databases,
    failures,
    locks: {
      forCreate: (operation) => createLock.run(operation),
      afterCreateDrain: (operation) => createLock.runAfterPending(operation),
      forProject: (projectId, operation) => {
        let lock = projectLocks.get(projectId);
        if (lock === undefined) {
          lock = new SerialLock();
          projectLocks.set(projectId, lock);
        }
        return lock.run(operation);
      },
    },
  };
}

export function createNodeProjectStorageDependencies(
  options: NodeProjectStorageOptions,
): ProjectStorageStoreDependencies {
  return createNodeAdapters(options);
}
```

The fence is the complete Phase 3 file; no adapter body is deferred to a later phase:

- The Node migration target validates Drizzle Kit `meta/_journal.json`, loads each referenced SQL file by basename from the trusted kind directory, and rejects missing, extra, duplicate, traversal, symlink, empty, or out-of-order resources. Its authority inspection and transactional batch implement the `generated-migrations.ts` contract; it splits only on Drizzle's statement breakpoint and never calls the Drizzle runtime migrator.
- `requireForeignKeys` executes `PRAGMA foreign_keys = ON`, parses the single returned value, and throws `ProjectStorageBrokenError` unless it is exactly `1`.
- `createNodeAdapters` returns every `ProjectStorageStoreDependencies` member available in Phase 3. Its registry lstat-inspects authority without creating an absent database; `declareStaging` alone initializes or migrates after witness absence and retains the installation client until stop. It parses persisted staging values before Transaction A, inserts location/generation/registration, invokes the during-transaction checkpoint, and commits all three or none. Activation parses its persisted values, re-verifies the renamed triplet, updates generation/location/registration, invokes its checkpoint, re-queries the joined rows, and requires `active/committed` plus exact pointers before commit.
- The witness inspector queries relevant request/Project rows, then uses `lstat` on only the deterministic Project root and reserved child names. `ENOENT` means absent; access denial becomes `ProjectStorageUnavailableError`; malformed rows, symlinks, unexpected node types, or inconsistent authority become `ProjectStorageBrokenError`. It never follows links or traverses outside the Project namespace.
- Database builders apply the canonical/runtime generated SQL, insert strict metadata and identity rows, read back foreign keys, run `foreign_key_check` and exact `integrity_check`, close the client in `finally`, and resolve only after close. Sealed verification reopens the named files, validates identities/metadata/manifest, closes, and rechecks sizes and hashes.
- Paths normalize to `<applicationStorageRoot>/projects/<lowercase ProjectId>`; staging is `.staging-<GenerationId>` and active is `<GenerationId>`. The filesystem adapter uses exclusive directory/file creation and same-filesystem rename and intentionally exposes no remove, copy, retry, or resume operation.
- Unit fixture helpers named in the test fences are implemented in their named test files; integration fixture helpers pass the Node dependencies through `createProjectStorageOwner` into `createProjectStorageApplication`, then compose `startHarnessRuntime` with a `MessageChannel`. No fixture symbol is supplied by a later phase.

#### 12a. Transaction Rollback Failure Contract
**File**: `apps/harness/src/storage/project-storage-node-adapters.test.ts`
**Changes**: Create the adapter unit file with the exact operation/commit plus rollback failure contract below. Phase 4 extends this same file without replacing this test.

```ts
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProjectStorageCreateRequestSchema } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import type { ProjectStorageOwnerPort } from "../project-storage-application.js";
import { createProjectStorageApplication } from "../project-storage-application.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  databaseSpecs,
  loadGeneratedMigrations,
  withWriteTransaction,
  type DatabaseSpec,
} from "./project-storage-node-adapters.js";

type MigrationGuardFixture = Readonly<{
  root: string;
  kindRoot: string;
  metadataRoot: string;
  journalPath: string;
  sqlPath: string;
  writeJournal(entries: readonly Record<string, unknown>[]): Promise<void>;
}>;

const initialJournalEntry = {
  idx: 0,
  version: "7",
  when: 1,
  tag: "0000_initial",
  breakpoints: true,
};
const validCanonicalMigrationSql = `CREATE TABLE schema_metadata (metadata_key TEXT);
--> statement-breakpoint
CREATE TABLE storage_identity (identity_key TEXT);`;

async function createMigrationGuardFixture(): Promise<MigrationGuardFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-migration-guard-"));
  const kindRoot = path.join(root, "canonical");
  const metadataRoot = path.join(kindRoot, "meta");
  const journalPath = path.join(metadataRoot, "_journal.json");
  const sqlPath = path.join(kindRoot, "0000_initial.sql");
  await mkdir(metadataRoot, { recursive: true });
  const writeJournal = async (entries: readonly Record<string, unknown>[]): Promise<void> => {
    await writeFile(
      journalPath,
      JSON.stringify({ version: "7", dialect: "sqlite", entries }),
    );
  };
  await writeJournal([initialJournalEntry]);
  await writeFile(sqlPath, validCanonicalMigrationSql);
  return { root, kindRoot, metadataRoot, journalPath, sqlPath, writeJournal };
}

type MigrationGuardCase = Readonly<{
  name: string;
  expectedMessage: string;
  arrange(fixture: MigrationGuardFixture): Promise<DatabaseSpec>;
}>;

const migrationGuardCases: readonly MigrationGuardCase[] = [
  {
    name: "escaped trusted root",
    expectedMessage: "Generated migration root escaped trusted resources.",
    arrange: async () => {
      const spec = structuredClone(databaseSpecs.canonical);
      Reflect.set(spec, "resourceKind", "../escaped");
      return spec;
    },
  },
  {
    name: "missing kind directory",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.kindRoot, { recursive: true });
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-directory kind resource",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.kindRoot, { recursive: true });
      await writeFile(fixture.kindRoot, "not a directory");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink kind directory",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "kind-target");
      await rm(fixture.kindRoot, { recursive: true });
      await mkdir(target);
      await symlink(target, fixture.kindRoot, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing metadata directory",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.metadataRoot, { recursive: true });
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-directory metadata resource",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.metadataRoot, { recursive: true });
      await writeFile(fixture.metadataRoot, "not a directory");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink metadata directory",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "metadata-target");
      await rm(fixture.metadataRoot, { recursive: true });
      await mkdir(target);
      await symlink(target, fixture.metadataRoot, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing journal",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.journalPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-file journal resource",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.journalPath);
      await mkdir(fixture.journalPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink journal resource",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "journal-target");
      await rm(fixture.journalPath);
      await mkdir(target);
      await symlink(target, fixture.journalPath, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "malformed journal",
    expectedMessage: "Generated migration journal is invalid.",
    arrange: async (fixture) => {
      await writeFile(fixture.journalPath, "{not-json");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "invalid journal shape",
    expectedMessage: "Generated migration journal is invalid.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.journalPath,
        JSON.stringify({ version: "7", dialect: "postgresql", entries: [] }),
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-contiguous journal index",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      await fixture.writeJournal([{ ...initialJournalEntry, idx: 1 }]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "decreasing journal time",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      const second = { ...initialJournalEntry, idx: 1, when: 0, tag: "0001_next" };
      await fixture.writeJournal([initialJournalEntry, second]);
      await writeFile(path.join(fixture.kindRoot, "0001_next.sql"), validCanonicalMigrationSql);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "duplicate journal tag",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      await fixture.writeJournal([
        initialJournalEntry,
        { ...initialJournalEntry, idx: 1, when: 2 },
      ]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "empty journal",
    expectedMessage: "Generated migration journal is empty.",
    arrange: async (fixture) => {
      await fixture.writeJournal([]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing journal resource",
    expectedMessage: "Generated migration resources disagree with the journal.",
    arrange: async (fixture) => {
      await rm(fixture.sqlPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "extra journal resource",
    expectedMessage: "Generated migration resources disagree with the journal.",
    arrange: async (fixture) => {
      await writeFile(path.join(fixture.kindRoot, "extra.sql"), validCanonicalMigrationSql);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "wrong SQL resource type",
    expectedMessage: "Generated migration resource type is invalid.",
    arrange: async (fixture) => {
      await rm(fixture.sqlPath);
      await mkdir(fixture.sqlPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink SQL resource",
    expectedMessage: "Generated migration resource type is invalid.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "sql-target");
      await rm(fixture.sqlPath);
      await mkdir(target);
      await symlink(target, fixture.sqlPath, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "empty SQL",
    expectedMessage: "Generated migration SQL is empty.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "SQL without statements",
    expectedMessage: "Generated migration contains no statements.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "--> statement-breakpoint");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "implicit ledger",
    expectedMessage: "Generated migration uses a forbidden implicit ledger.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "CREATE TABLE __drizzle_migrations (id INTEGER);");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "trigger",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, `${validCanonicalMigrationSql}\nCREATE TRIGGER forbidden AFTER INSERT ON storage_identity BEGIN SELECT 1; END;`);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "view",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, `${validCanonicalMigrationSql}\nCREATE VIEW forbidden AS SELECT 1;`);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "unknown table",
    expectedMessage: "Generated migration creates an unknown table.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, `${validCanonicalMigrationSql}\nCREATE TABLE future_owner (id TEXT);`);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "incomplete table authority",
    expectedMessage: "Generated migration table authority is incomplete.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "CREATE TABLE schema_metadata (metadata_key TEXT);");
      return databaseSpecs.canonical;
    },
  },
];

it.each(migrationGuardCases)(
  "rejects generated migration guard: $name",
  async ({ arrange, expectedMessage }) => {
    const fixture = await createMigrationGuardFixture();
    try {
      const spec = await arrange(fixture);
      const failure = await loadGeneratedMigrations(fixture.root, spec).then(
        () => "resolved",
        (error: unknown) => error,
      );
      expect(failure).toMatchObject({
        name: "ProjectStorageBrokenError",
        message: expectedMessage,
      });
      expect(String(failure)).not.toContain(fixture.root);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
);

it.each(["operation", "commit"])(
  "preserves %s and rollback failures internally while exposing one generic failure",
  async (failurePoint) => {
    const privateRoot = "C:\\private\\project-storage";
    const operationError = new Error(`${privateRoot}: primary transaction failure`);
    const rollbackError = new Error(`${privateRoot}: rollback failure`);
    const calls: string[] = [];
    let closed = false;
    const transaction = {
      get closed(): boolean {
        return closed;
      },
      commit: vi.fn(async () => {
        calls.push("commit");
        if (failurePoint === "commit") {
          throw operationError;
        }
        closed = true;
      }),
      rollback: vi.fn(async () => {
        calls.push("rollback");
        throw rollbackError;
      }),
      close: vi.fn(() => {
        calls.push("close");
        closed = true;
      }),
    };
    const client = {
      transaction: vi.fn(async (mode: "write") => {
        expect(mode).toBe("write");
        return transaction;
      }),
    };
    let internalFailure: ProjectStorageBrokenError | undefined;
    const owner: ProjectStorageOwnerPort = {
      open: async () => ({ status: "unavailable", message: "Unused test operation." }),
      create: async () => {
        try {
          await withWriteTransaction(client, async () => {
            calls.push("operation");
            if (failurePoint === "operation") {
              throw operationError;
            }
            return "completed";
          });
          return { status: "broken", message: "Transaction unexpectedly succeeded." };
        } catch (error) {
          if (!(error instanceof ProjectStorageBrokenError)) {
            throw error;
          }
          internalFailure = error;
          return { status: "broken", message: error.message };
        }
      },
      close: async () => ({ status: "unavailable", message: "Unused test operation." }),
      stop: () => Promise.resolve(),
    };
    const request = ProjectStorageCreateRequestSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000010",
      createRequestId: "00000000-0000-4000-8000-000000000011",
    });

    const result = await createProjectStorageApplication(owner).create(request);

    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(transaction.close).toHaveBeenCalledOnce();
    expect(transaction.closed).toBe(true);
    expect(calls).toEqual(
      failurePoint === "operation"
        ? ["operation", "rollback", "close"]
        : ["operation", "commit", "rollback", "close"],
    );
    expect(internalFailure).toBeInstanceOf(ProjectStorageBrokenError);
    if (internalFailure === undefined) {
      throw new Error("Expected a Project Storage rollback failure.");
    }
    expect(internalFailure.message).toBe("Project Storage transaction rollback failed.");
    expect(internalFailure.cause).toBeInstanceOf(AggregateError);
    if (!(internalFailure.cause instanceof AggregateError)) {
      throw new Error("Expected an aggregate transaction failure cause.");
    }
    expect(internalFailure.cause.message).toBe(
      "Project Storage transaction and rollback both failed.",
    );
    expect(internalFailure.cause.errors).toEqual([operationError, rollbackError]);
    expect(internalFailure.cause.errors).toContain(operationError);
    expect(internalFailure.cause.errors).toContain(rollbackError);
    expect(result).toEqual({
      status: "broken",
      request,
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage transaction rollback failed.",
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateRoot);
    expect(JSON.stringify(result)).not.toContain(operationError.message);
    expect(JSON.stringify(result)).not.toContain(rollbackError.message);
    expect(JSON.stringify(result)).not.toContain(
      "Project Storage transaction and rollback both failed.",
    );
  },
);
```

#### 13. Real Creation And Crash Integration
**File**: `apps/harness/tests/integration/project-storage-create.integration.test.ts`
**Changes**: Prove sealed creation, exact eight-table and declared-object schema, malformed authority refusal, filesystem witness refusal, and every staged creation crash checkpoint with real libSQL.

```ts
import {
  databaseSpecs,
  requireDeclaredSchemaObjects,
  type DatabaseSpec,
} from "../../src/storage/project-storage-node-adapters.js";

async function seedOrphanLocationAtProjectRoot(
  root: string,
  projectId: ProjectStorageCreateRequest["projectId"],
): Promise<void> {
  const client = createClient({ url: pathToFileURL(path.join(root, "application.db")).href });
  try {
    await client.execute({
      sql: `INSERT INTO storage_locations
        (storage_id, location_id, normalized_path, location_state, observed_at)
        VALUES (?, ?, ?, 'staging', ?)`,
      args: [
        "00000000-0000-4000-8000-000000000061",
        "00000000-0000-4000-8000-000000000062",
        path.resolve(root, "projects", projectId),
        "2026-08-31T12:00:00.000Z",
      ],
    });
  } finally {
    client.close();
  }
}

async function replaceStoredCreateRequestFingerprint(
  root: string,
  createRequestId: ProjectStorageCreateRequest["createRequestId"],
  fingerprint: string,
): Promise<void> {
  const client = createClient({ url: pathToFileURL(path.join(root, "application.db")).href });
  try {
    const result = await client.execute({
      sql: `UPDATE storage_generations SET create_request_fingerprint = ?
        WHERE create_request_id = ?`,
      args: [fingerprint, createRequestId],
    });
    expect(result.rowsAffected).toBe(1);
  } finally {
    client.close();
  }
}

it("blocks an orphan location at the deterministic Project path before allocation", async () => {
  const root = await createTemporaryApplicationRoot();
  const initializer = await createStorageRuntimeForRoot(root);
  const initializerRequest = ProjectStorageCreateRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000050",
    createRequestId: "00000000-0000-4000-8000-000000000051",
  });
  await expect(initializer.create(initializerRequest)).resolves.toMatchObject({
    payload: { status: "created" },
  });
  await initializer.stop();
  await seedOrphanLocationAtProjectRoot(root, createRequest.projectId);
  const before = await inspectApplicationStorageRoot(root);
  let allocationCount = 0;
  const forbiddenAllocation = (): never => {
    allocationCount += 1;
    throw new Error("Identity allocation must not run for a witnessed Project.");
  };
  const owner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: root,
      migrationResourcesRoot: checkedInMigrationRoot,
      applicationVersion: "0.0.0",
      ids: {
        storageId: forbiddenAllocation,
        locationId: forbiddenAllocation,
        generationId: forbiddenAllocation,
        canonicalLineageId: forbiddenAllocation,
        runtimeLineageId: forbiddenAllocation,
      },
    }),
  );

  const result = await owner.create(createRequest);
  await owner.stop();

  expect(result).toMatchObject({
    status: "ready",
    result: {
      status: "blocked",
      reason: "prior-state-witness",
      diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
    },
  });
  expect(allocationCount).toBe(0);
  expect(await inspectApplicationStorageRoot(root)).toEqual(before);
  expect(JSON.stringify(result)).not.toContain(root);
});

it("treats an active replay fingerprint mismatch as broken authority", async () => {
  const root = await createTemporaryApplicationRoot();
  const firstRuntime = await createStorageRuntimeForRoot(root, { ids: fixedCreationIds });
  await expect(firstRuntime.create(createRequest)).resolves.toMatchObject({
    payload: { status: "created" },
  });
  await firstRuntime.stop();
  await replaceStoredCreateRequestFingerprint(root, createRequest.createRequestId, "0".repeat(64));
  const before = await inspectDurableProjectStorageState(root);
  const restarted = await createStorageRuntimeForRoot(root);

  const result = await restarted.create(createRequest);
  await restarted.stop();

  expect(result).toMatchObject({
    event: "project.create.result",
    payload: {
      status: "broken",
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Create request fingerprint does not agree.",
      },
    },
  });
  expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  expect(JSON.stringify(result)).not.toContain(root);
});

it.each(creationCrashCases)(
  "preserves witnesses and refuses cleanup after $checkpoint",
  async ({ checkpoint, expectedStateBeforeRetry, expectedStateAfterRetry, retryEvent }) => {
    const root = await createTemporaryApplicationRoot();
    const firstRuntime = await createStorageRuntimeForRoot(root, { failAt: checkpoint });
    await expect(firstRuntime.create(createRequest)).resolves.toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: { code: "PROJECT_STORAGE_OWNER_FAILED" },
      },
    });
    await firstRuntime.stop();
    const durableState = await inspectDurableProjectStorageState(root);
    expect(durableState).toEqual(expectedStateBeforeRetry);

    const restarted = await createStorageRuntimeForRoot(root);
    const retry = await restarted.create(createRequest);
    expect(retry).toMatchObject(retryEvent);
    await restarted.stop();
    expect(await inspectDurableProjectStorageState(root)).toEqual(expectedStateAfterRetry);
  },
);

it("creates a sealed initial generation under the deterministic Project namespace", async () => {
  const root = await createTemporaryApplicationRoot();
  const runtime = await createStorageRuntimeForRoot(root, { ids: fixedCreationIds });
  const response = await runtime.create(createRequest);
  await runtime.stop();
  const state = await inspectDurableProjectStorageState(root);

  expect(response).toMatchObject({
    event: "project.create.result",
    payload: expectedCreatedResult,
  });
  expect(state.activeGenerationDirectory).toBe(
    path.join(root, "projects", createRequest.projectId, fixedCreationIds.generationId),
  );
  expect(state.stagingDirectories).toEqual([]);
  expect(state.registryIdentity).toEqual({
    projectId: createRequest.projectId,
    ...expectedCreatedResult.identity,
  });
  expect(state.manifestIdentity).toEqual(state.registryIdentity);
  expect(state.canonicalIdentity).toEqual({
    projectId: createRequest.projectId,
    storageId: fixedCreationIds.storageId,
    generationId: fixedCreationIds.generationId,
    canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
  });
  expect(state.runtimeIdentity).toEqual({
    projectId: createRequest.projectId,
    storageId: fixedCreationIds.storageId,
    generationId: fixedCreationIds.generationId,
    runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
  });
  expect(state.manifestBaselines).toEqual(await hashActiveDatabaseFiles(state));
  expect(JSON.stringify(state.manifest)).not.toContain(root);
  expect(JSON.stringify(response)).not.toContain(root);
});

it("creates exactly eight domain tables with valid SQLite integrity", async () => {
  const root = await createTemporaryApplicationRoot();
  const runtime = await createStorageRuntimeForRoot(root);
  await expect(runtime.create(createRequest)).resolves.toMatchObject({
    event: "project.create.result",
    payload: { status: "created", mode: "read-write" },
  });
  await runtime.stop();

  await expect(readTableNames(root, "application.db")).resolves.toEqual([
    "schema_metadata",
    "storage_generations",
    "storage_locations",
    "storage_registrations",
  ]);
  await expect(readTableNames(root, "slopstop.db")).resolves.toEqual([
    "schema_metadata",
    "storage_identity",
  ]);
  await expect(readTableNames(root, "mastra.db")).resolves.toEqual([
    "slopstop_runtime_schema_metadata",
    "slopstop_runtime_storage_identity",
  ]);
  await expect(readDatabaseChecks(root)).resolves.toEqual({
    application: { foreignKeys: 1, violations: [], integrity: ["ok"] },
    canonical: { foreignKeys: 1, violations: [], integrity: ["ok"] },
    runtime: { foreignKeys: 1, violations: [], integrity: ["ok"] },
  });
});

it("enforces exact lowercase UUID segments in the real application schema", async () => {
  const root = await createTemporaryApplicationRoot();
  const runtime = await createStorageRuntimeForRoot(root);
  await runtime.create(createRequest);
  await runtime.stop();
  const client = createClient({ url: pathToFileURL(path.join(root, "application.db")).href });
  const accepted = [
    "00000000-0000-1000-8000-000000000001",
    "00000000-0000-2000-9000-000000000002",
    "00000000-0000-3000-a000-000000000003",
    "00000000-0000-4000-b000-000000000004",
    "00000000-0000-5000-8000-000000000005",
    "00000000-0000-6000-9000-000000000006",
    "00000000-0000-7000-a000-000000000007",
    "00000000-0000-8000-b000-000000000008",
  ];
  const rejected = [
    "0000000--0000-1000-8000-000000000001",
    "00000000-000--1000-8000-000000000001",
    "00000000-0000-1-00-8000-000000000001",
    "00000000-0000-1000-8-00-000000000001",
    "00000000-0000-1000-8000-00000000000-",
    "00000000-0000-0000-8000-000000000001",
    "00000000-0000-1000-7000-000000000001",
    "00000000-0000-1000-8000-00000000000A",
  ];
  const locationId = "00000000-0000-4000-8000-000000000099";
  const insertLocation = (storageId: string, normalizedPath: string) =>
    client.execute({
      sql: `INSERT INTO storage_locations
        (storage_id, location_id, normalized_path, location_state, observed_at)
        VALUES (?, ?, ?, 'staging', '2026-08-31T12:00:00.000Z')`,
      args: [storageId, locationId, normalizedPath],
    });
  try {
    for (const [index, identity] of accepted.entries()) {
      const normalizedPath = `identity-accepted-${index}`;
      await expect(insertLocation(identity, normalizedPath)).resolves.toMatchObject({
        rowsAffected: 1,
      });
      await client.execute({
        sql: "DELETE FROM storage_locations WHERE normalized_path = ?",
        args: [normalizedPath],
      });
    }
    for (const [index, identity] of rejected.entries()) {
      await expect(insertLocation(identity, `identity-rejected-${index}`)).rejects.toBeDefined();
    }
  } finally {
    client.close();
  }
});

const schemaObjectOmissionCases = [
  {
    name: "CHECK constraint",
    expectedMessage: "Database required CHECK constraint is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      checks: [{ table: "child", name: "child_parent_nonempty" }],
      indexes: [],
      foreignKeys: [],
    } satisfies DatabaseSpec,
  },
  {
    name: "named index",
    expectedMessage: "Database required named index is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      checks: [],
      indexes: [
        {
          table: "child",
          name: "child_parent_idx",
          unique: false,
          partial: false,
          columns: ["parent_id"],
        },
      ],
      foreignKeys: [],
    } satisfies DatabaseSpec,
  },
  {
    name: "foreign key",
    expectedMessage: "Database required foreign key is missing.",
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      checks: [],
      indexes: [],
      foreignKeys: [
        {
          table: "child",
          columns: ["parent_id"],
          referencedTable: "parent",
          referencedColumns: ["id"],
          onUpdate: "NO ACTION",
          onDelete: "NO ACTION",
          match: "NONE",
        },
      ],
    } satisfies DatabaseSpec,
  },
];

it.each(schemaObjectOmissionCases)(
  "rejects one omitted $name through real SQLite metadata",
  async ({ spec, expectedMessage }) => {
    const root = await createTemporaryApplicationRoot();
    const databasePath = path.join(root, "schema-object-probe.db");
    const client = createClient({ url: pathToFileURL(databasePath).href });
    try {
      await client.execute("CREATE TABLE parent (id TEXT PRIMARY KEY)");
      await client.execute("CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT)");
      const failure = await requireDeclaredSchemaObjects(client, spec).then(
        () => "resolved",
        (error: unknown) => error,
      );
      expect(failure).toMatchObject({
        name: "ProjectStorageBrokenError",
        message: expectedMessage,
      });
      expect(String(failure)).not.toContain(root);
      expect(String(failure)).not.toContain(databasePath);
    } finally {
      client.close();
    }
  },
);

const schemaObjectUnexpectedCases = [
  {
    name: "CHECK constraint",
    expectedMessage: "Database contains an unexpected CHECK constraint.",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      `CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT,
        CONSTRAINT child_parent_nonempty CHECK (length(parent_id) > 0))`,
    ],
  },
  {
    name: "named index",
    expectedMessage: "Database contains an unexpected named index.",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      "CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT)",
      "CREATE INDEX child_parent_idx ON child(parent_id)",
    ],
  },
  {
    name: "foreign key",
    expectedMessage: "Database contains an unexpected foreign key.",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      `CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT,
        CONSTRAINT child_parent_fk FOREIGN KEY (parent_id) REFERENCES parent(id))`,
    ],
  },
];

it.each(schemaObjectUnexpectedCases)(
  "rejects one unexpected $name through real SQLite metadata",
  async ({ statements, expectedMessage }) => {
    const root = await createTemporaryApplicationRoot();
    const databasePath = path.join(root, "schema-object-probe.db");
    const client = createClient({ url: pathToFileURL(databasePath).href });
    const spec = {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      checks: [],
      indexes: [],
      foreignKeys: [],
    } satisfies DatabaseSpec;
    try {
      for (const statement of statements) {
        await client.execute(statement);
      }
      const failure = await requireDeclaredSchemaObjects(client, spec).then(
        () => "resolved",
        (error: unknown) => error,
      );
      expect(failure).toMatchObject({
        name: "ProjectStorageBrokenError",
        message: expectedMessage,
      });
      expect(String(failure)).not.toContain(root);
      expect(String(failure)).not.toContain(databasePath);
    } finally {
      client.close();
    }
  },
);

it.each(malformedApplicationAuthorityCases)(
  "rejects malformed application migration authority: $name",
  async ({ seed }) => {
    const root = await createTemporaryApplicationRoot();
    await seed(root);
    const runtime = await createStorageRuntimeForRoot(root);

    await expect(runtime.create(createRequest)).resolves.toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: { code: "PROJECT_STORAGE_OWNER_FAILED" },
      },
    });
    await runtime.stop();
    expect(await inspectProjectMutationCount(root)).toBe(0);
  },
);

it("blocks a filesystem witness before initializing application.db", async () => {
  const root = await createTemporaryApplicationRoot();
  await seedReservedProjectWitness(root, createRequest.projectId, "canonical-wal");
  const before = await inspectProjectNamespace(root, createRequest.projectId);
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.create(createRequest)).resolves.toMatchObject({
    event: "project.create.result",
    payload: {
      status: "blocked",
      reason: "prior-state-witness",
      diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
    },
  });
  await runtime.stop();
  expect(await pathExists(path.join(root, "application.db"))).toBe(false);
  expect(await inspectProjectNamespace(root, createRequest.projectId)).toEqual(before);
});
```

#### 14. Application Migration Generation Config
**File**: `apps/harness/drizzle.application.config.ts`
**Changes**: Configure checked-in SQLite migrations for the application registry schema.

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/application-schema.ts",
  out: "./drizzle/application",
});
```

#### 15. Canonical Migration Generation Config
**File**: `apps/harness/drizzle.canonical.config.ts`
**Changes**: Configure checked-in SQLite migrations for the canonical Storage schema.

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/canonical-schema.ts",
  out: "./drizzle/canonical",
});
```

#### 16. Runtime Migration Generation Config
**File**: `apps/harness/drizzle.runtime.config.ts`
**Changes**: Configure checked-in SQLite migrations for the runtime adapter Storage schema.

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/runtime-schema.ts",
  out: "./drizzle/runtime",
});
```

#### 17. Generated Migration Resources
**File**: `apps/harness/drizzle/**`
**Changes**: Generate and commit SQL, journals, and snapshots for exactly the eight initial domain tables with no implicit ledger, trigger, view, or future-owner table.

Implementation runs all three checked-in configs and commits each generated SQL file plus `meta/_journal.json` and snapshots. The application output must create only `schema_metadata`, `storage_locations`, `storage_generations`, and `storage_registrations`; canonical only `schema_metadata` and `storage_identity`; runtime only `slopstop_runtime_schema_metadata` and `slopstop_runtime_storage_identity`. Generated SQL is rejected if it omits a declared check/index/foreign key or creates `__drizzle_migrations`, an owner table, a trigger, or a view.

#### 18. Harness Persistence Dependencies And Scripts
**File**: `apps/harness/package.json`
**Changes**: Add `@libsql/client`, Drizzle, Zod, Drizzle Kit, and reproducible generation scripts; raw `libsql` remains deferred to Phase 6.

Merge these entries into the existing scripts and dependency objects; existing package metadata and commands remain unchanged.

```json
{
  "scripts": {
    "db:generate:application": "drizzle-kit generate --config drizzle.application.config.ts",
    "db:generate:canonical": "drizzle-kit generate --config drizzle.canonical.config.ts",
    "db:generate:runtime": "drizzle-kit generate --config drizzle.runtime.config.ts",
    "db:generate": "pnpm db:generate:application && pnpm db:generate:canonical && pnpm db:generate:runtime",
    "db:generate:check": "pnpm db:generate && git diff --exit-code -- drizzle"
  },
  "dependencies": {
    "@libsql/client": "catalog:",
    "drizzle-orm": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "drizzle-kit": "catalog:"
  }
}
```

#### 19. Persistence Dependency Catalog Pins
**File**: `pnpm-workspace.yaml`
**Changes**: Pin the selected `@libsql/client`, `drizzle-kit`, and `drizzle-orm` versions.

```yaml
catalog:
  "@libsql/client": 0.17.4
  drizzle-kit: 0.31.10
  drizzle-orm: 0.45.2
```

#### 20. Resolved Persistence Dependency Graph
**File**: `pnpm-lock.yaml`
**Changes**: Regenerate the lockfile from exact catalog pins and retain the native libSQL runtime closure for later packaging.

Regenerate the lockfile from the exact catalog pins. Review that `@libsql/client@0.17.4` resolves its native `libsql` runtime closure, while `drizzle-orm@0.45.2` and `drizzle-kit@0.31.10` remain harness-owned; target packaging of that native closure remains Phase 6.

#### Recovery Amendment: C52-C54 Exact Schema Definitions
**Files**: `apps/harness/src/storage/sqlite-schema-expression.ts`, `apps/harness/src/storage/sqlite-schema-expression.test.ts`, `apps/harness/src/storage/project-storage-database-specs.ts`, `apps/harness/src/storage/database-schema-verifier.ts`, `apps/harness/tests/integration/project-storage-create.integration.test.ts`
**Changes**: Add one conservative tokenizer/canonicalizer for SQLite CHECK expressions and partial-index predicates. Discard whitespace/comments, normalize recognized keyword case and equivalent identifier quoting, and preserve literal text, operators, punctuation, parentheses, and token order. Reject malformed/unsupported SQL. Add exact expression/predicate fields to schema specs, extract balanced CHECK bodies and index `WHERE` clauses from `sqlite_schema`, and compare canonical token streams with no name-only fallback. Add same-name altered CHECK, partial-index predicate, and full foreign-key metadata cases.

#### Recovery Amendment: Reproducible Generated Tree
**Files**: `apps/harness/scripts/check-generated-migrations.mjs`, `apps/harness/scripts/check-generated-migrations.test.mjs`, `apps/harness/package.json`
**Changes**: Replace the Git-diff implementation of `db:generate:check`. Snapshot every relative path and SHA-256 byte digest below `apps/harness/drizzle`, run `pnpm db:generate`, snapshot again, and fail unless the two manifests are identical. This detects added, removed, renamed, changed, staged, unstaged, and untracked generated files without requiring a clean implementation worktree.

#### Recovery Amendment: Harness Mutation Proof
**Files**: `stryker.project-storage.config.json`, `apps/harness/vitest.project-storage-mutation.config.ts`, `package.json`
**Changes**: Give the harness mutation runner repository-root test paths and mutate exactly `packages/protocol/src/project-storage-protocol.ts`, `apps/harness/src/process-fatal-diagnostics.ts`, `apps/harness/src/storage/sqlite-schema-expression.ts`, `apps/harness/src/storage/project-storage-database-specs.ts`, and `apps/harness/src/storage/database-schema-verifier.ts`. Include the corresponding protocol/fatal/token tests plus Node-adapter and creation integration tests. Keep `concurrency:4`, `incremental:false`, and `thresholds.high/low/break = 90/80/80`. Add root command `test:mutation:project-storage:harness = pnpm exec stryker run stryker.project-storage.config.json`.

### Test Contract:

- **Behavior**: SQLite schema-expression equality ignores only insignificant token spelling and rejects semantic or malformed changes.
  - Test: `compares SQLite expressions by conservative token identity` -> `apps/harness/src/storage/sqlite-schema-expression.test.ts`
  - Oracle: `status = 'active' AND "project_id" IS NOT NULL` has the same canonical tokens after whitespace/comment changes, recognized-keyword case changes, and equivalent backtick-quoted `project_id`; replacing `'active'` with `'staging'`, `AND` with `OR`, changing/removing parentheses, or changing an operator yields different tokens; unterminated string/comment/quoted-identifier input throws exact path-free `Database schema expression is invalid.`.
  - Expected red: clean baseline has no schema-expression parser or comparison owner.
- **Behavior**: Same-name altered CHECK expressions, partial-index predicates, and foreign-key definitions fail exact real SQLite authority.
  - Test: `rejects one same-name altered $name through real SQLite metadata` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: preserving the expected object name while changing one CHECK literal/operator returns `Database required CHECK constraint is missing.`; changing `storage_generations_one_active_uq` from `WHERE creation_state = 'active'` to `WHERE creation_state = 'staging'` returns `Database required named index is missing.`; changing one foreign-key source/target/action while preserving table identity returns `Database required foreign key is missing.`. Every failure is path-free and leaves Project allocation/mutation at zero. A formatting-only CHECK/predicate rewrite remains accepted.
  - Expected red: the current verifier keys CHECKs by table/name and indexes by table/name/unique/partial/columns, so same-name expression/predicate changes pass; full foreign-key comparison lacks this mutation case.
- **Behavior**: Generated migration reproducibility compares the complete tree before and after generation independently of Git staging state.
  - Test: `detects every generated migration tree change` -> `apps/harness/scripts/check-generated-migrations.test.mjs`
  - Oracle: an unchanged temporary tree passes; generator cases that change bytes, add a file, remove a file, or rename a file each fail with exactly `Generated migrations changed after regeneration.`; the production command exits zero only when the complete before/after `apps/harness/drizzle` manifests are identical.
  - Expected red: `git diff --exit-code -- drizzle` ignores staged and untracked generated differences and has no before/after tree authority.
- **Behavior**: Manifest v1 serializes deterministically and accepts only the exact first-generation vocabulary.
  - Test: `serializes the exact initial manifest and rejects non-v1 shapes` -> `apps/harness/src/storage/project-storage-manifest.test.ts`
  - Oracle: serializing the fixed manifest equals its complete two-space JSON representation plus one final newline; parsing returns the same strict value; filenames are exactly `slopstop.db` and `mastra.db`; source generation, Storage operation, and Mastra migration head are `null`; project sequence and runtime waterline are `0`; the serialized string contains no application root. Version `2`, extra fields, uppercase/nil identities, non-UTC time, negative/unsafe sizes, malformed hashes, path separators, non-null provenance, or nonzero sequence/waterline each throws.
  - Expected red: no manifest parser, serializer, or v1 schema exists.
- **Behavior**: Clean creation seals one generation with mutually agreeing persisted identities and activation baselines.
  - Test: `creates a sealed initial generation under the deterministic Project namespace` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: a fixed `project.create` command yields `project.create.result` with `created/read-write`; `application.db` active rows, `manifest.json`, canonical identity, runtime identity, and event payload contain the same fixed Project/Storage/generation/lineage IDs; the final directory is `<root>/projects/<ProjectId>/<GenerationId>`; no staging directory remains; both clients are closed; manifest sizes and SHA-256 values equal independently read final database bytes; no path occurs in the manifest or result.
  - Expected red: no persistent creator, schema, migrations, databases, or manifest exists.
- **Behavior**: Initial migrations create exactly the eight allowed domain tables and valid SQLite databases without an implicit Drizzle ledger.
  - Test: `creates exactly eight domain tables with valid SQLite integrity` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: sorted table names equal application `[schema_metadata, storage_generations, storage_locations, storage_registrations]`, canonical `[schema_metadata, storage_identity]`, and runtime `[slopstop_runtime_schema_metadata, slopstop_runtime_storage_identity]`; `__drizzle_migrations` and every later-owner table are absent; each connection reads `PRAGMA foreign_keys` as `1`, `foreign_key_check` as `[]`, and `integrity_check` as exactly `["ok"]`.
  - Expected red: no generated migrations or libSQL adapter exists.
- **Behavior**: Real schema identity checks require exact lowercase hexadecimal UUID segments at the four fixed hyphens.
  - Test: `enforces exact lowercase UUID segments in the real application schema` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: the real application schema accepts versions `1` through `8` with variants `8`, `9`, `a`, and `b` represented by the eight fixed lowercase identities, then deletes each accepted row. It rejects a replacement hyphen in each of the five hexadecimal segments, version `0`, variant `7`, and uppercase `A`; every rejected insert affects no row.
  - Expected red: the whole-value GLOB permits a hyphen anywhere inside its allowed character class, so malformed segment boundaries can satisfy the database CHECK.
- **Behavior**: Every database requires the exact declared named CHECK, named-index, and foreign-key metadata, including absence of extras.
  - Tests: `rejects one omitted $name through real SQLite metadata`; `rejects one unexpected $name through real SQLite metadata` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: omitting one declared CHECK, named index, or foreign key from real SQLite metadata throws respectively `Database required CHECK constraint is missing.`, `Database required named index is missing.`, or `Database required foreign key is missing.`. Adding one undeclared object throws respectively `Database contains an unexpected CHECK constraint.`, `Database contains an unexpected named index.`, or `Database contains an unexpected foreign key.`; no diagnostic contains the root or database path.
  - Expected red: schema verification compares table names only and cannot detect missing, changed, duplicated, or additional constraints and indexes.
- **Behavior**: Generated migration resource guards fail closed with one exact path-free diagnostic per rejected authority branch.
  - Test: `rejects generated migration guard: $name` -> `apps/harness/src/storage/project-storage-node-adapters.test.ts`
  - Oracle: escaped root, missing or non-plain kind/metadata/journal resources, malformed JSON, invalid Zod journal shape, non-contiguous/decreasing/duplicate order, empty journal, missing/extra/wrong-type/empty SQL, no statements, implicit ledger, trigger, view, unknown table, and incomplete table authority each reject with the exact `ProjectStorageBrokenError` message declared by its table row and no fixture root.
  - Expected red: the loader is private and the guard branches have no executable matrix; malformed JSON/Zod input is not pinned to one stable path-free journal diagnostic.
- **Behavior**: Migration authority applies exactly the known pending suffix and rejects inconsistent existing state.
  - Test: `applies only known pending migrations and rejects inconsistent authority` -> `apps/harness/src/storage/generated-migrations.test.ts`
  - Oracle: fresh authority batches migrations `[0000_initial, 0001_next]` and records `0001_next`; current `0001_next` performs no batch only when format/schema versions exactly equal the expected tuple; current `0000_initial` batches only `[0001_next]`; unknown migration ID, wrong database kind, current format version `0` or `2`, current schema version `0` or `2`, or an empty journal throws `ProjectStorageBrokenError` and performs no batch.
  - Expected red: no restart-safe migration authority owner exists.
- **Behavior**: A failed write operation or commit followed by failed rollback retains both internal failures without leaking either through the public boundary.
  - Test: `preserves %s and rollback failures internally while exposing one generic failure` -> `apps/harness/src/storage/project-storage-node-adapters.test.ts`
  - Oracle: both `operation` and `commit` cases attempt rollback once and close once in `finally`; the thrown `ProjectStorageBrokenError` has exact public message `Project Storage transaction rollback failed.` and an `AggregateError` cause with exact message `Project Storage transaction and rollback both failed.` whose errors are the same `[operationError, rollbackError]` references in that order. The public create result is exactly `broken/PROJECT_STORAGE_OWNER_FAILED/Project Storage transaction rollback failed.` and contains neither private path, caught error text, nor aggregate-cause message.
  - Expected red: rollback failure replaces the original operation/commit failure, supplies no cause, and leaves deterministic dual-failure ownership unproved.
- **Behavior**: Malformed application migration authority fails before Project mutation.
  - Test: `rejects malformed application migration authority: $name` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: missing metadata amid domain tables, duplicate metadata in a malformed schema, unknown migration ID, wrong database kind, and newer format/schema cases each emit `project.create.result` with `broken/PROJECT_STORAGE_OWNER_FAILED`; no Project registry row, namespace, ID allocation, database, or manifest is created.
  - Expected red: no strict application migration authority inspection exists.
- **Behavior**: Every recognized prior-state witness independently prevents allocation and mutation.
  - Test: `blocks the %s witness without allocating` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: each of the eighteen `PriorStateWitnessKind` values produces `ready/blocked/prior-state-witness/PROJECT_STORAGE_PRIOR_STATE_WITNESS` echoing the request; ID allocator calls, registry writes, directory writes, database creation, manifest writes, rename, and cleanup remain exactly zero.
  - Expected red: no bounded witness inspector or fail-closed create guard exists.
- **Behavior**: An orphan registry location at the deterministic Project path is a witness without a generation join.
  - Test: `blocks an orphan location at the deterministic Project path before allocation` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: with valid application authority containing one `storage_locations` row whose `normalized_path` equals `<root>/projects/<ProjectId>` and no generation row for it, create returns `blocked/prior-state-witness/PROJECT_STORAGE_PRIOR_STATE_WITNESS`; all five identity allocators remain at zero, the application/Project snapshot is unchanged, and the result contains no root path.
  - Expected red: `registryWitnesses` discovers locations only by iterating generation rows, so an orphan location is missed.
- **Behavior**: A real filesystem witness blocks before absent application authority is initialized.
  - Test: `blocks a filesystem witness before initializing application.db` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: a canonical WAL witness below the deterministic Project namespace yields correlated `blocked/prior-state-witness`; `application.db` remains absent and the namespace is byte-for-byte unchanged.
  - Expected red: no production adapter proves non-creating inspection before Transaction A.
- **Behavior**: Inspection failure or malformed application authority never becomes clean absence or creation.
  - Test: `keeps unavailable and broken witness inspection distinct from absence` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: inaccessible `application.db` or Project root yields owner `unavailable`; malformed registry rows or disagreement between active state/pointers yields owner `broken`; neither path returns `ready/not-registered`, `ready/created`, or performs any write.
  - Expected red: no persistence error classifier exists.
- **Behavior**: Complete create-request fingerprinting precedes the first registry decision.
  - Test: `passes the exact request fingerprint to the first registry inspection` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: the first two fixture events are the SHA-256 input for exact JSON `{version:1, projectId, createRequestId}` followed by registry inspection with that exact digest; creation returns the expected ready/created result.
  - Expected red: hashing runs after registry and witness inspection, hashes only `{version, projectId}`, and `inspectCreate` accepts no fingerprint.
- **Behavior**: Completed create replay is fingerprint-authoritative while conflicting reuse and an existing Project registration remain mutation-free blocks.
  - Test: `creates once, replays exactly, and rejects conflicting reuse without mutation` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: the complete request fingerprint is computed before the first registry inspection and passed to every inspection/recheck; an exact active replay requires the stored fingerprint and returns the original identity fields without another ID/file/database/transaction call; the same `createRequestId` with another Project returns `blocked/idempotency-conflict`; another request for the registered Project returns `blocked/already-registered`; request-ID precedence wins over witnesses and registration precedence wins over unrelated filesystem witnesses.
  - Expected red: no durable create identity or precedence implementation exists.
- **Behavior**: A same-request stored fingerprint mismatch is broken authority, never replay, conflict, or registration state.
  - Test: `treats an active replay fingerprint mismatch as broken authority` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: after replacing the active generation fingerprint with a different valid lowercase SHA-256, the same create request returns `broken/PROJECT_STORAGE_OWNER_FAILED` with exact message `Create request fingerprint does not agree.`; durable state is unchanged after the request and the result contains no root path.
  - Expected red: active replay ignores `create_request_fingerprint` after parsing it.
- **Behavior**: Installation-wide create decisions serialize before identity allocation.
  - Test: `serializes installation-wide create decisions before allocation` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: concurrent requests sharing one `createRequestId` but using different Projects yield exactly one `created` and one `blocked/idempotency-conflict`; only the winning creation allocates its four new public identities plus one private location identity, and only one staging declaration occurs.
  - Expected red: no installation-wide creation lock exists.
- **Behavior**: Durable request and registration authority precede filesystem witness classification.
  - Test: `applies request and registration precedence before witness inspection` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: an existing conflicting `createRequestId` returns `idempotency-conflict` without invoking witness inspection; an existing Project registration under another request returns `already-registered` without invoking witness inspection; filesystem witnesses cannot replace either result with generic `prior-state-witness`.
  - Expected red: no ordered create-decision classifier exists.
- **Behavior**: Incomplete exact replay remains a recovery witness and is never resumed or replaced.
  - Test: `blocks an incomplete exact request without cleanup or reallocation` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: `staging` state for the same request returns `blocked/prior-state-witness`; allocator, migration, rename, activation, delete, and retry/resume counts remain zero.
  - Expected red: no durable staging state exists.
- **Behavior**: Failures at every creation checkpoint leave the exact durable prefix and restart safely.
  - Test: `preserves witnesses and refuses cleanup after $checkpoint` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: an injected owner failure first emits correlated `project.create.result` with `broken/PROJECT_STORAGE_OWNER_FAILED`; before Transaction A and a rolled-back Transaction A leave no Project witness and permit fresh create; every committed checkpoint from after Transaction A through pre-activation yields its exact rows/files and a restarted `project.create.result` with `blocked/prior-state-witness`; Transaction B rollback leaves the complete final directory with null active pointers and `staging`; after activation commit and before response, restart exactly emits the original `created`; no case deletes, resumes, copies, or allocates replacement output.
  - Expected red: no failure-injectable staged creation state machine exists.

| Checkpoint | Durable state before restart | Retry event |
|---|---|---|
| `before-staging-transaction` | no Project rows or namespace | `project.create.result/created` |
| `during-staging-transaction` | Transaction A rolled back; no Project rows or namespace | `project.create.result/created` |
| `after-staging-transaction` | staging location/generation/registration; no namespace | `project.create.result/blocked/prior-state-witness` |
| `after-staging-directory` | staging rows plus empty `.staging-<GenerationId>` | `project.create.result/blocked/prior-state-witness` |
| `after-canonical-database` | staging rows plus canonical bytes/sidecars | `project.create.result/blocked/prior-state-witness` |
| `after-runtime-database` | staging rows plus both database files/sidecars | `project.create.result/blocked/prior-state-witness` |
| `after-databases-closed` | both databases retained with no open clients | `project.create.result/blocked/prior-state-witness` |
| `after-baselines-computed` | databases retained; no manifest | `project.create.result/blocked/prior-state-witness` |
| `after-manifest-written` | staged triplet including manifest | `project.create.result/blocked/prior-state-witness` |
| `after-staging-verified` | verified staged triplet | `project.create.result/blocked/prior-state-witness` |
| `before-generation-rename` | verified staged triplet | `project.create.result/blocked/prior-state-witness` |
| `after-generation-rename` | final generation directory; staging rows and null active pointers | `project.create.result/blocked/prior-state-witness` |
| `after-renamed-verification` | verified final generation; staging rows and null active pointers | `project.create.result/blocked/prior-state-witness` |
| `before-activation-transaction` | verified final generation; staging rows and null active pointers | `project.create.result/blocked/prior-state-witness` |
| `during-activation-transaction` | Transaction B rolled back; final generation, staging state, null active pointers | `project.create.result/blocked/prior-state-witness` |
| `after-activation-transaction` | active/committed rows and agreeing pointers | `project.create.result/created` with original IDs |
| `before-created-result` | active/committed rows and agreeing pointers | `project.create.result/created` with original IDs |

- **Behavior**: Slice 3 lifecycle exposes no open session but preserves idempotent close and stop.
  - Test: `keeps opening unavailable and closes the no-session owner idempotently` -> `apps/harness/src/storage/project-storage-store.test.ts`
  - Oracle: before stop, `open` returns owner unavailable with `Project Storage opening is not available.` and two closes each return `ready/closed` echoing the request; two stops return the same Promise, await the create drain, close the application registry exactly once, and resolve; every operation after the first stop call returns owner unavailable with `Project Storage owner is stopped.`.
  - Expected red: no persistent owner implementation exists.

### Success Criteria:

#### Automated Verification:

- [ ] Every Test Contract behavior's exact Expected red, including C52-C54 and generated-tree reproducibility, is observed and recorded from its named public-seam test before implementation begins.
- [ ] Migration, manifest, schema-expression, transaction, store, and reproducibility unit contracts pass: `pnpm exec vitest run apps/harness/src/storage/generated-migrations.test.ts apps/harness/src/storage/project-storage-manifest.test.ts apps/harness/src/storage/sqlite-schema-expression.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/project-storage-store.test.ts apps/harness/scripts/check-generated-migrations.test.mjs`
- [ ] Real libSQL creation and same-name schema mutation matrix pass: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts`
- [ ] Generated migrations are reproducible under the complete before/after tree check: `pnpm --filter @slopstop/harness db:generate:check`
- [ ] Focused harness mutation proof passes at or above the configured 80 break threshold with no `NoCoverage` mutant: `pnpm test:mutation:project-storage:harness`
- [ ] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [ ] Package dependency boundaries remain valid: `pnpm check:boundaries`
- [ ] Architecture model remains valid: `pnpm check:architecture`
- [ ] A separate Phase 3 review/refactor gate records no unresolved blocker before Phase 4.

#### Manual Verification:

- [ ] Inspect all three generated migration directories and confirm exactly eight domain tables, the declared exact CHECK expressions/index predicates/foreign keys, and no `__drizzle_migrations` or future-owner table.
- [ ] Inspect the schema tokenizer and confirm it performs no algebraic rewriting, constant folding, commutative reordering, literal rewriting, or name-only fallback.
- [ ] Inspect the Node adapter and confirm all local database URLs use `pathToFileURL`, generated SQL is loaded only below the trusted migration root, and no remove/copy fallback exists.
- [ ] Inspect every creation error path and confirm it retains rows/files as witnesses, emits no full path in diagnostics, and never reports clean absence.
- [ ] Confirm the complete request fingerprint is lifecycle-fenced before first registry inspection, every recheck receives the same value, replay compares stored authority exactly, and direct normalized-path location lookup does not depend on a generation join.

---

## Phase 4: Opening Health And Session Lifecycle

### Overview

Extend the creation store with non-mutating existing-generation opening, independent canonical/runtime health classification, adapter-enforced safe mode, multiple retained Project sessions, idempotent close, and shutdown race handling.

### Changes Required:

#### 1. Pure Opening Health Classifier
**File**: `apps/harness/src/storage/project-storage-opening.ts`
**Changes**: Classify database probes, manifest/registry evidence, normal opening, and safe mode while retaining only opaque release handles.

```ts
import type {
  OpenedStorageIdentity,
  ProjectDatabaseHealth,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "@slopstop/protocol";

type NullableStorageIdentity = Readonly<{
  storageId: OpenedStorageIdentity["storageId"] | null;
  generationId: OpenedStorageIdentity["generationId"] | null;
  canonicalDatabaseLineageId: OpenedStorageIdentity["canonicalDatabaseLineageId"] | null;
  runtimeDatabaseLineageId: OpenedStorageIdentity["runtimeDatabaseLineageId"] | null;
}>;

type UnhealthyStatus = Exclude<ProjectDatabaseHealth["status"], "healthy">;
type DatabaseCompatibility = "current" | "known-older" | "newer" | "unknown";

export type ProjectDatabaseProbe =
  | Readonly<{ status: "missing" | "unavailable" | "corrupt" | "broken" }>
  | Readonly<{
      status: "present";
      identityMatches: boolean;
      format: DatabaseCompatibility;
      migration: DatabaseCompatibility;
      foreignKeysEnabled: boolean;
      foreignKeyViolationCount: number;
      integrityRows: readonly string[];
      domainInvariantsValid: boolean;
    }>;

type ManifestBlockingStatus = Extract<
  UnhealthyStatus,
  "missing" | "corrupt" | "identity-conflict" | "unsupported-newer" | "unavailable" | "broken"
>;

export type ProjectStorageOpenEvidence =
  | Readonly<{ status: "not-registered" }>
  | Readonly<{
      status: "recovery-required";
      identity: NullableStorageIdentity;
      release(): void;
    }>
  | Readonly<{
      status: "selected-blocked";
      identity: OpenedStorageIdentity;
      manifestStatus: ManifestBlockingStatus;
      release(): void;
    }>
  | Readonly<{
      status: "selected-current";
      identity: OpenedStorageIdentity;
      canonical: ProjectDatabaseProbe;
      runtime: ProjectDatabaseProbe;
      release(): void;
    }>;

export type RetainedProjectStorageSession = Readonly<{
  mode: "read-write" | "safe-mode";
  close(): void;
}>;

export type ClassifiedProjectStorageOpening = Readonly<{
  result: ProjectStorageOpenResult;
  session?: RetainedProjectStorageSession;
}>;

const unhealthyHealth = {
  "migration-required": { status: "migration-required", diagnostic: { code: "DATABASE_MIGRATION_REQUIRED", message: "Database migration is required." } },
  "recovery-required": { status: "recovery-required", diagnostic: { code: "DATABASE_RECOVERY_REQUIRED", message: "Database recovery is required." } },
  missing: { status: "missing", diagnostic: { code: "DATABASE_MISSING", message: "Expected database state is missing." } },
  corrupt: { status: "corrupt", diagnostic: { code: "DATABASE_CORRUPT", message: "Database integrity validation failed." } },
  "identity-conflict": { status: "identity-conflict", diagnostic: { code: "DATABASE_IDENTITY_CONFLICT", message: "Database identity does not agree." } },
  "unsupported-newer": { status: "unsupported-newer", diagnostic: { code: "DATABASE_UNSUPPORTED_NEWER", message: "Database version is newer than supported." } },
  unavailable: { status: "unavailable", diagnostic: { code: "DATABASE_UNAVAILABLE", message: "Database could not be inspected." } },
  broken: { status: "broken", diagnostic: { code: "DATABASE_BROKEN", message: "Database authority is internally inconsistent." } },
} as const satisfies Record<UnhealthyStatus, ProjectDatabaseHealth>;

function unhealthy(status: UnhealthyStatus): ProjectDatabaseHealth {
  return unhealthyHealth[status];
}

export function classifyProjectDatabaseProbe(
  probe: ProjectDatabaseProbe,
): ProjectDatabaseHealth {
  if (probe.status !== "present") {
    return unhealthy(probe.status);
  }
  if (!probe.identityMatches) {
    return unhealthy("identity-conflict");
  }
  if (probe.format === "newer" || probe.migration === "newer") {
    return unhealthy("unsupported-newer");
  }
  if (probe.format === "unknown" || probe.migration === "unknown") {
    return unhealthy("broken");
  }
  if (!probe.foreignKeysEnabled) {
    return unhealthy("broken");
  }
  if (
    probe.foreignKeyViolationCount > 0 ||
    probe.integrityRows.length !== 1 ||
    probe.integrityRows[0] !== "ok" ||
    !probe.domainInvariantsValid
  ) {
    return unhealthy("corrupt");
  }
  if (probe.format === "known-older" || probe.migration === "known-older") {
    return unhealthy("migration-required");
  }
  return { status: "healthy" };
}

function safeModeResult(
  request: ProjectStorageOpenRequest,
  identity: NullableStorageIdentity,
  canonicalHealth: ProjectDatabaseHealth,
  runtimeHealth: ProjectDatabaseHealth,
): ProjectStorageOpenResult {
  return {
    status: "safe-mode",
    request,
    mode: "safe-mode",
    identity,
    canonicalHealth,
    runtimeHealth,
  };
}

export function classifyProjectStorageOpening(
  request: ProjectStorageOpenRequest,
  evidence: ProjectStorageOpenEvidence,
): ClassifiedProjectStorageOpening {
  if (evidence.status === "not-registered") {
    return { result: { status: "not-registered", request } };
  }

  if (evidence.status === "recovery-required") {
    const health = unhealthy("recovery-required");
    return {
      result: safeModeResult(request, evidence.identity, health, health),
      session: { mode: "safe-mode", close: evidence.release },
    };
  }

  if (evidence.status === "selected-blocked") {
    const health = unhealthy(evidence.manifestStatus);
    return {
      result: safeModeResult(request, evidence.identity, health, health),
      session: { mode: "safe-mode", close: evidence.release },
    };
  }

  const canonicalHealth = classifyProjectDatabaseProbe(evidence.canonical);
  const runtimeHealth = classifyProjectDatabaseProbe(evidence.runtime);
  if (canonicalHealth.status === "healthy" && runtimeHealth.status === "healthy") {
    return {
      result: {
        status: "opened",
        request,
        mode: "read-write",
        identity: evidence.identity,
        canonicalHealth,
        runtimeHealth,
      },
      session: { mode: "read-write", close: evidence.release },
    };
  }
  return {
    result: safeModeResult(request, evidence.identity, canonicalHealth, runtimeHealth),
    session: { mode: "safe-mode", close: evidence.release },
  };
}
```

#### 2. Opening Classifier Contract
**File**: `apps/harness/src/storage/project-storage-opening.test.ts`
**Changes**: Pin the exact stable distinction between corrupt and broken probe outcomes.

```ts
import { describe, expect, it } from "vitest";
import { classifyProjectDatabaseProbe } from "./project-storage-opening.js";

describe("Project database probe classification", () => {
  it("keeps corrupt and broken probe outcomes distinct", () => {
    expect(classifyProjectDatabaseProbe({ status: "corrupt" })).toEqual({
      status: "corrupt",
      diagnostic: {
        code: "DATABASE_CORRUPT",
        message: "Database integrity validation failed.",
      },
    });
    expect(classifyProjectDatabaseProbe({ status: "broken" })).toEqual({
      status: "broken",
      diagnostic: {
        code: "DATABASE_BROKEN",
        message: "Database authority is internally inconsistent.",
      },
    });
  });
});
```

#### 3. Opening And Session Store Extension
**File**: `apps/harness/src/storage/project-storage-store.ts`
**Changes**: Replace the transitional unavailable opener with per-Project retained sessions, reopen replacement, idempotent close, admitted-operation tracking, late-open release failure retention, lifecycle-fenced creation, create-lock-drained registry shutdown, and stop-all lifecycle behavior.

```ts
import type {
  ProjectStorageCloseRequest,
  ProjectStorageOpenRequest,
  ProjectStorageOpenResult,
} from "@slopstop/protocol";
import {
  classifyProjectStorageOpening,
  type ProjectStorageOpenEvidence,
  type RetainedProjectStorageSession,
} from "./project-storage-opening.js";

export interface ProjectStorageStoreDependencies {
  readonly opening: Readonly<{
    inspect(projectId: ProjectId): Promise<ProjectStorageOpenEvidence>;
  }>;
}

export function createProjectStorageOwner(
  dependencies: ProjectStorageStoreDependencies,
): ProjectStorageOwnerPort {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  const sessions = new Map<
    ProjectId,
    Readonly<{
      session: RetainedProjectStorageSession;
      admissionSequence: number;
    }>
  >();
  const admittedOperations = new Map<number, Promise<void>>();
  const lateReleaseFailures: Array<Readonly<{ sequence: number; error: unknown }>> = [];
  let nextOperationSequence = 0;

  const lifecycle: ProjectStorageLifecycle = {
    assertRunning: () => {
      if (stopped) {
        throw new ProjectStorageUnavailableError("Project Storage owner is stopped.");
      }
    },
  };

  const stoppedOutcome = (): ProjectStorageOwnerOutcome => ({
    status: "unavailable",
    message: "Project Storage owner is stopped.",
  });

  const closeSession = (projectId: ProjectId): void => {
    const retained = sessions.get(projectId);
    sessions.delete(projectId);
    retained?.session.close();
  };

  const operate = async (
    operation: () => Promise<ProjectStorageOpenResult | ProjectStorageCreateResult | Readonly<{
      status: "closed";
      request: ProjectStorageCloseRequest;
    }>>,
  ): Promise<ProjectStorageOwnerOutcome> => {
    try {
      const result = await operation();
      lifecycle.assertRunning();
      return { status: "ready", result };
    } catch (error) {
      if (error instanceof ProjectStorageUnavailableError) {
        return { status: "unavailable", message: error.message };
      }
      if (error instanceof ProjectStorageBrokenError) {
        return { status: "broken", message: error.message };
      }
      throw error;
    }
  };

  const admit = (
    operation: (sequence: number) => Promise<ProjectStorageOwnerOutcome>,
  ): Promise<ProjectStorageOwnerOutcome> => {
    const sequence = nextOperationSequence;
    nextOperationSequence += 1;
    const tracked = (async () => {
      try {
        return await operation(sequence);
      } finally {
        admittedOperations.delete(sequence);
      }
    })();
    admittedOperations.set(
      sequence,
      tracked.then(
        () => undefined,
        () => undefined,
      ),
    );
    return tracked;
  };

  return {
    create: (request): Promise<ProjectStorageOwnerOutcome> => {
      if (stopped) {
        return Promise.resolve(stoppedOutcome());
      }
      return admit(() =>
        operate(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            const result = await createProjectStorage(request, dependencies, lifecycle);
            lifecycle.assertRunning();
            return result;
          }),
        ),
      );
    },
    open: (request: ProjectStorageOpenRequest): Promise<ProjectStorageOwnerOutcome> => {
      if (stopped) {
        return Promise.resolve(stoppedOutcome());
      }
      return admit((sequence) =>
        operate(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            closeSession(request.projectId);
            lifecycle.assertRunning();
            const classified = classifyProjectStorageOpening(
              request,
              await dependencies.opening.inspect(request.projectId),
            );
            if (stopped) {
              try {
                classified.session?.close();
              } catch (error) {
                lateReleaseFailures.push({ sequence, error });
                throw new ProjectStorageBrokenError("Project Storage opening release failed.");
              }
              throw new ProjectStorageUnavailableError("Project Storage owner is stopped.");
            }
            if (classified.session !== undefined) {
              sessions.set(request.projectId, {
                session: classified.session,
                admissionSequence: sequence,
              });
            }
            return classified.result;
          }),
        ),
      );
    },
    close: (request): Promise<ProjectStorageOwnerOutcome> => {
      if (stopped) {
        return Promise.resolve(stoppedOutcome());
      }
      return admit(() =>
        operate(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            closeSession(request.projectId);
            return { status: "closed", request } as const;
          }),
        ),
      );
    },
    stop: () => {
      if (stopPromise !== undefined) {
        return stopPromise;
      }
      stopped = true;
      stopPromise = (async () => {
        const operations = [...admittedOperations.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, settled]) => settled);
        await Promise.all(operations);
        const shutdownErrors = lateReleaseFailures
          .sort((left, right) => left.sequence - right.sequence)
          .map(({ error }) => error);
        const retainedProjects = [...sessions.entries()]
          .sort(
            ([, left], [, right]) => left.admissionSequence - right.admissionSequence,
          )
          .map(([projectId]) => projectId);
        for (const projectId of retainedProjects) {
          try {
            closeSession(projectId);
          } catch (error) {
            shutdownErrors.push(error);
          }
        }
        try {
          await dependencies.locks.afterCreateDrain(() => {
            dependencies.registry.stop();
          });
        } catch (error) {
          shutdownErrors.push(error);
        }
        if (shutdownErrors.length > 0) {
          throw new AggregateError(shutdownErrors, "Project Storage shutdown failed.");
        }
      })();
      return stopPromise;
    },
  };
}
```

#### 4. Store Regression Adjustment
**File**: `apps/harness/src/storage/project-storage-store.test.ts`
**Changes**: Remove the transitional no-opening test, retain every creation fixture field/assertion, and supply the newly mandatory opening dependency.

Phase 4 removes Phase 3's transitional `keeps opening unavailable and closes the no-session owner idempotently` test when real opening replaces that temporary behavior. The final merged `createProjectStorageStoreFixture` retains every Phase 3 option, fake, counter, returned field, and creation assertion. Its existing `dependencies` literal receives this required default member so the fixture compiles after opening becomes mandatory:

```ts
import type { ProjectStorageOpenEvidence } from "./project-storage-opening.js";

opening: {
  inspect: async (): Promise<ProjectStorageOpenEvidence> => ({ status: "not-registered" }),
},
```

Merge the type-only import into the existing import block exactly as shown. It is consumed by the fixture annotation; retain all existing imports still used by the Phase 3 creation assertions and introduce no value import for this type. New opening and lifecycle behavior is proved through the transport-port integration tests below rather than private owner calls.

#### 5. Node Opening And Probe Adapters
**File**: `apps/harness/src/storage/project-storage-node-adapters.ts`
**Changes**: Add non-creating registry opening, bounded witness inspection, manifest/identity checks, independent database probes, and exact unavailable/broken normalization without migration or repair.

The opening inspector never initializes or migrates. It validates application metadata and exact active registration/location/generation agreement, then consumes the Phase 3 scan's normalized ordinary-generation IDs and root-database witness flag. It computes the deterministic normalized Project root with `path.resolve(projectRootFor(projectId))` and reuses Phase 3's strict `locationRowsByNormalizedPath` query before returning clean absence. No registration and no prior witness returns `not-registered`; a matching orphan location row with no registration, generation, or filesystem artifact returns recovery evidence, while any incomplete row, null or disagreeing active pointer, staging generation, extra ordinary generation, root-level database/sidecar witness, reserved filesystem witness without a complete active selection, tombstone, or unfinished operation returns recovery evidence or throws broken for malformed authority. This path performs no mutation and exposes no path.

A selected generation is resolved only below its normalized Project root. The inspector parses the manifest version before the strict v1 body, proves registry/manifest identities, and then opens canonical and runtime clients independently. Each probe validates only SlopStop-owned metadata and identity rows, database kind/lineage, known migration authority, foreign-key enablement/readback, `foreign_key_check`, exact `integrity_check`, and currently applicable owner invariants. It never compares live bytes with activation baselines, inspects Mastra-private tables, chooses another generation, repairs, migrates, deletes, or writes.

Client/file errors are normalized before classification: `ENOENT` is missing, access failure is per-database unavailable, only `SQLITE_CORRUPT` or `SQLITE_NOTADB` is corrupt, identity disagreement is identity-conflict, known older authority is migration-required, newer authority is unsupported-newer, and every other unexpected probe exception or unknown/contradictory metadata is broken. Application-database access or malformed registry authority instead throws the top-level unavailable/broken errors. Every classified attempt receives one idempotent `release` closure that attempts every opened client once and aggregates close failures without exposing paths.

Add the opening evidence types to the existing imports:

```ts
import type {
  ProjectDatabaseProbe,
  ProjectStorageOpenEvidence,
} from "./project-storage-opening.js";
```

Replace the existing availability classifier so application and Project database access failures use the same explicit Node/SQLite vocabulary:

```ts
function isUnavailableError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === undefined) {
    return false;
  }
  if (code === "EACCES" || code === "EPERM" || code === "EBUSY") {
    return true;
  }
  return [
    "SQLITE_AUTH",
    "SQLITE_BUSY",
    "SQLITE_CANTOPEN",
    "SQLITE_IOERR",
    "SQLITE_LOCKED",
    "SQLITE_PERM",
    "SQLITE_READONLY",
  ].some((base) => code === base || code.startsWith(`${base}_`));
}

function isCorruptDatabaseError(error: unknown): boolean {
  const code = errorCode(error);
  return code === "SQLITE_CORRUPT" || code === "SQLITE_NOTADB";
}
```

Add these aliases and the manifest-version boundary immediately after `runtimeIdentityRowSchema`:

```ts
type PresentDatabaseProbe = Extract<ProjectDatabaseProbe, { status: "present" }>;
type DatabaseCompatibility = PresentDatabaseProbe["format"];
type SelectedOpeningIdentity = Extract<
  ProjectStorageOpenEvidence,
  { status: "selected-current" }
>["identity"];
type RecoveryOpeningIdentity = Extract<
  ProjectStorageOpenEvidence,
  { status: "recovery-required" }
>["identity"];
type ManifestBlockingStatus = Extract<
  ProjectStorageOpenEvidence,
  { status: "selected-blocked" }
>["manifestStatus"];
type OpeningDatabaseSpec =
  | typeof databaseSpecs.canonical
  | typeof databaseSpecs.runtime;
type OpeningSelection = Readonly<{
  identity: SelectedOpeningIdentity;
  generation: GenerationRow;
  paths: ProjectStorageGenerationPaths;
}>;
type RegistryOpeningInspection =
  | Readonly<{ status: "not-registered" }>
  | Readonly<{ status: "recovery-required"; identity: RecoveryOpeningIdentity }>
  | Readonly<{ status: "selected"; selection: OpeningSelection }>;
type OpeningManifestInspection =
  | Readonly<{ status: "blocked"; manifestStatus: ManifestBlockingStatus }>
  | Readonly<{ status: "current"; manifest: ProjectStorageManifestV1 }>;

const manifestVersionSchema = z
  .object({ manifestVersion: z.number().int().nonnegative() })
  .passthrough();
```

Add the following helpers after `inspectFilesystemWitnesses` and before `createNodeAdapters`:

```ts
async function generationRowsByProject(
  client: LocalClient | LocalTransaction,
  projectId: ProjectId,
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, generation_id AS generationId,
      project_id AS projectId, location_id AS locationId,
      canonical_lineage_id AS canonicalDatabaseLineageId,
      runtime_lineage_id AS runtimeDatabaseLineageId,
      create_request_id AS createRequestId,
      create_request_fingerprint AS createRequestFingerprint,
      generation_directory_name AS generationDirectoryName,
      creation_state AS creationState, created_at AS createdAt,
      activated_at AS activatedAt
      FROM storage_generations WHERE project_id = ?`,
    args: [projectId],
  });
  return generationRowSchema.array().parse(resultObjects(result));
}

async function generationRowsByIdentity(
  client: LocalClient | LocalTransaction,
  storageId: RegistrationRow["storageId"],
  generationId: NonNullable<RegistrationRow["activeGenerationId"]>,
): Promise<readonly GenerationRow[]> {
  const result = await client.execute({
    sql: `SELECT storage_id AS storageId, generation_id AS generationId,
      project_id AS projectId, location_id AS locationId,
      canonical_lineage_id AS canonicalDatabaseLineageId,
      runtime_lineage_id AS runtimeDatabaseLineageId,
      create_request_id AS createRequestId,
      create_request_fingerprint AS createRequestFingerprint,
      generation_directory_name AS generationDirectoryName,
      creation_state AS creationState, created_at AS createdAt,
      activated_at AS activatedAt FROM storage_generations
      WHERE storage_id = ? AND generation_id = ?`,
    args: [storageId, generationId],
  });
  return generationRowSchema.array().parse(resultObjects(result));
}

function stringScalarRows(
  result: Awaited<ReturnType<LocalClient["execute"]>>,
): readonly string[] | undefined {
  const values: string[] = [];
  for (const row of result.rows) {
    const value = row[0];
    if (row.length !== 1 || typeof value !== "string") {
      return undefined;
    }
    values.push(value);
  }
  return values;
}

async function requireApplicationOpeningAuthority(
  client: LocalClient,
  migrations: readonly GeneratedMigration[],
): Promise<void> {
  await requireCurrentMetadata(client, databaseSpecs.application, migrations);
  await requireExactTables(client, databaseSpecs.application);
}

async function requireApplicationIntegrity(client: LocalClient): Promise<void> {
  const integrityRows = stringScalarRows(await client.execute("PRAGMA integrity_check"));
  if (
    integrityRows === undefined ||
    integrityRows.length !== 1 ||
    integrityRows[0] !== "ok"
  ) {
    throw new ProjectStorageBrokenError("Project Storage application authority is corrupt.");
  }
  const result = await client.execute("PRAGMA foreign_key_check");
  if (result.rows.length !== 0) {
    throw new ProjectStorageBrokenError(
      "Project Storage application authority has foreign-key violations.",
    );
  }
}

function recoveryOpeningIdentity(
  registration: RegistrationRow | undefined,
  generation: GenerationRow | undefined,
): RecoveryOpeningIdentity {
  return {
    storageId: registration?.storageId ?? generation?.storageId ?? null,
    generationId: registration?.activeGenerationId ?? generation?.generationId ?? null,
    canonicalDatabaseLineageId: generation?.canonicalDatabaseLineageId ?? null,
    runtimeDatabaseLineageId: generation?.runtimeDatabaseLineageId ?? null,
  };
}

async function inspectRegistryOpening(
  client: LocalClient,
  projectId: ProjectId,
  normalizedProjectRoot: string,
  filesystem: FilesystemWitnessScan,
  paths: ProjectStorageStoreDependencies["paths"],
): Promise<RegistryOpeningInspection> {
  const registrations = await registrationRowsByProject(client, projectId);
  if (registrations.length > 1) {
    throw new ProjectStorageBrokenError("Project registration authority is not unique.");
  }
  const generations = await generationRowsByProject(client, projectId);
  const locationsAtProjectRoot = await locationRowsByNormalizedPath(
    client,
    normalizedProjectRoot,
  );
  const registration = registrations[0];

  if (registration === undefined) {
    if (
      generations.length === 0 &&
      locationsAtProjectRoot.length === 0 &&
      filesystem.kinds.length === 0
    ) {
      return { status: "not-registered" };
    }
    const soleGeneration = generations.length === 1 ? generations[0] : undefined;
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity(undefined, soleGeneration),
    };
  }

  const matchingGeneration = generations.find(
    (generation) =>
      generation.storageId === registration.storageId &&
      generation.generationId === registration.activeGenerationId,
  );
  const activeGenerations = generations.filter(
    (generation) =>
      generation.storageId === registration.storageId &&
      generation.creationState === "active",
  );
  if (activeGenerations.length > 1) {
    throw new ProjectStorageBrokenError("Active generation authority is not unique.");
  }
  const selectedActiveGeneration = activeGenerations[0];
  if (
    selectedActiveGeneration !== undefined &&
    registration.activeGenerationId !== null &&
    registration.activeLocationId !== null &&
    (registration.activeGenerationId !== selectedActiveGeneration.generationId ||
      registration.activeLocationId !== selectedActiveGeneration.locationId)
  ) {
    throw new ProjectStorageBrokenError(
      "Project Storage authority is internally inconsistent.",
    );
  }
  if (
    registration.activeGenerationId === null ||
    registration.activeLocationId === null ||
    registration.activatedAt === null ||
    generations.length === 0 ||
    generations.some((generation) => generation.creationState === "staging") ||
    filesystem.hasStagingGeneration ||
    filesystem.ordinaryGenerationIds.length !== 1 ||
    filesystem.ordinaryGenerationIds[0] !== registration.activeGenerationId ||
    filesystem.hasRootDatabaseWitness ||
    filesystem.kinds.includes("deletion-tombstone") ||
    filesystem.kinds.includes("unfinished-storage-operation")
  ) {
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity(registration, matchingGeneration),
    };
  }
  if (generations.some((generation) => generation.storageId !== registration.storageId)) {
    throw new ProjectStorageBrokenError("Project generation authority contradicts registration.");
  }

  const selectedRows = await generationRowsByIdentity(
    client,
    registration.storageId,
    registration.activeGenerationId,
  );
  if (selectedRows.length === 0) {
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity(registration, matchingGeneration),
    };
  }
  const generation = exactlyOne(
    selectedRows,
    "Active generation authority is not unique.",
  );
  if (generation.projectId !== projectId) {
    throw new ProjectStorageBrokenError("Active generation belongs to another Project.");
  }
  if (
    generation.creationState !== "active" ||
    generation.activatedAt === null ||
    registration.activeLocationId !== generation.locationId
  ) {
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity(registration, generation),
    };
  }

  const locations = await locationRowsByStorage(
    client,
    generation.storageId,
    generation.locationId,
  );
  if (locations.length === 0) {
    return {
      status: "recovery-required",
      identity: recoveryOpeningIdentity(registration, generation),
    };
  }
  const location = exactlyOne(locations, "Active location authority is not unique.");
  if (location.locationState !== "committed") {
    throw new ProjectStorageBrokenError(
      "Project Storage authority is internally inconsistent.",
    );
  }
  if (
    !path.isAbsolute(location.normalizedPath) ||
    path.resolve(location.normalizedPath) !== normalizedProjectRoot ||
    generation.generationDirectoryName !== generation.generationId ||
    registration.createdAt !== generation.createdAt ||
    registration.activatedAt !== generation.activatedAt
  ) {
    throw new ProjectStorageBrokenError("Active Project Storage authority does not agree.");
  }

  const generationPaths = paths.forCreation(projectId, generation.generationId).active;
  if (
    path.dirname(generationPaths.root) !== normalizedProjectRoot ||
    path.basename(generationPaths.root) !== generation.generationDirectoryName
  ) {
    throw new ProjectStorageBrokenError("Active generation path escaped its Project root.");
  }
  return {
    status: "selected",
    selection: {
      identity: {
        storageId: generation.storageId,
        generationId: generation.generationId,
        canonicalDatabaseLineageId: generation.canonicalDatabaseLineageId,
        runtimeDatabaseLineageId: generation.runtimeDatabaseLineageId,
      },
      generation,
      paths: generationPaths,
    },
  };
}

function manifestIdentityMatches(
  manifest: ProjectStorageManifestV1,
  projectId: ProjectId,
  selection: OpeningSelection,
): boolean {
  return (
    manifest.projectId === projectId &&
    manifest.storageId === selection.identity.storageId &&
    manifest.generationId === selection.identity.generationId &&
    manifest.provenance.createRequestId === selection.generation.createRequestId &&
    manifest.canonical.databaseLineageId ===
      selection.identity.canonicalDatabaseLineageId &&
    manifest.runtime.databaseLineageId === selection.identity.runtimeDatabaseLineageId &&
    manifest.createdAt === selection.generation.createdAt
  );
}

async function inspectOpeningManifest(
  manifestPath: string,
  projectId: ProjectId,
  selection: OpeningSelection,
): Promise<OpeningManifestInspection> {
  let entry;
  try {
    entry = await lstatIfPresent(manifestPath);
  } catch (error) {
    return {
      status: "blocked",
      manifestStatus: isUnavailableError(error) ? "unavailable" : "corrupt",
    };
  }
  if (entry === undefined) {
    return { status: "blocked", manifestStatus: "missing" };
  }
  if (entry.isSymbolicLink() || !entry.isFile()) {
    return { status: "blocked", manifestStatus: "broken" };
  }

  let source: string;
  try {
    source = await readNodeFile(manifestPath, "utf8");
  } catch (error) {
    if (isMissingError(error)) {
      return { status: "blocked", manifestStatus: "missing" };
    }
    return {
      status: "blocked",
      manifestStatus: isUnavailableError(error) ? "unavailable" : "corrupt",
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    return { status: "blocked", manifestStatus: "corrupt" };
  }
  const version = manifestVersionSchema.safeParse(json);
  if (!version.success) {
    return { status: "blocked", manifestStatus: "corrupt" };
  }
  if (version.data.manifestVersion > 1) {
    return { status: "blocked", manifestStatus: "unsupported-newer" };
  }
  if (version.data.manifestVersion !== 1) {
    return { status: "blocked", manifestStatus: "corrupt" };
  }

  let manifest: ProjectStorageManifestV1;
  try {
    manifest = parseProjectStorageManifest(source);
  } catch {
    return { status: "blocked", manifestStatus: "corrupt" };
  }
  if (!manifestIdentityMatches(manifest, projectId, selection)) {
    return { status: "blocked", manifestStatus: "identity-conflict" };
  }
  return { status: "current", manifest };
}

function compareDatabaseVersion(actual: number, current: number): DatabaseCompatibility {
  if (actual === current) {
    return "current";
  }
  return actual < current ? "known-older" : "newer";
}

function combineDatabaseVersions(
  format: DatabaseCompatibility,
  schema: DatabaseCompatibility,
): DatabaseCompatibility {
  if (format === schema) {
    return format;
  }
  if (format === "current") {
    return schema;
  }
  if (schema === "current") {
    return format;
  }
  return "unknown";
}

function migrationCompatibility(
  migrationId: string,
  migrations: readonly GeneratedMigration[],
): DatabaseCompatibility {
  const index = migrations.findIndex((migration) => migration.migrationId === migrationId);
  if (index < 0) {
    return "unknown";
  }
  return index === migrations.length - 1 ? "current" : "known-older";
}

function metadataCompatibility(
  metadata: MetadataRow | undefined,
  spec: OpeningDatabaseSpec,
  migrations: readonly GeneratedMigration[],
): Readonly<{ format: DatabaseCompatibility; migration: DatabaseCompatibility }> {
  if (
    metadata === undefined ||
    metadata.metadataKey !== spec.metadataKey ||
    metadata.databaseKind !== spec.databaseKind
  ) {
    return { format: "unknown", migration: "unknown" };
  }
  let format = combineDatabaseVersions(
    compareDatabaseVersion(metadata.formatVersion, spec.formatVersion),
    compareDatabaseVersion(metadata.schemaVersion, spec.schemaVersion),
  );
  let migration = migrationCompatibility(metadata.lastMigrationId, migrations);
  if (
    (format === "known-older" && migration === "current") ||
    (format === "newer" && migration === "known-older")
  ) {
    format = "unknown";
    migration = "unknown";
  }
  return { format, migration };
}

async function inspectDatabaseIdentity(
  client: LocalClient,
  spec: OpeningDatabaseSpec,
  projectId: ProjectId,
  selection: OpeningSelection,
): Promise<Readonly<{ valid: boolean; matches: boolean }>> {
  if (spec.databaseKind === "canonical") {
    const result = await client.execute(
      `SELECT identity_key AS identityKey, project_id AS projectId,
        storage_id AS storageId, generation_id AS generationId,
        canonical_database_lineage_id AS canonicalDatabaseLineageId,
        created_at AS createdAt FROM storage_identity`,
    );
    const parsed = canonicalIdentityRowSchema.array().safeParse(resultObjects(result));
    const row = parsed.success && parsed.data.length === 1 ? parsed.data[0] : undefined;
    return {
      valid: row !== undefined,
      matches:
        row !== undefined &&
        row.projectId === projectId &&
        row.storageId === selection.identity.storageId &&
        row.generationId === selection.identity.generationId &&
        row.canonicalDatabaseLineageId ===
          selection.identity.canonicalDatabaseLineageId &&
        row.createdAt === selection.generation.createdAt,
    };
  }
  const result = await client.execute(
    `SELECT identity_key AS identityKey, project_id AS projectId,
      storage_id AS storageId, generation_id AS generationId,
      runtime_database_lineage_id AS runtimeDatabaseLineageId,
      created_at AS createdAt FROM slopstop_runtime_storage_identity`,
  );
  const parsed = runtimeIdentityRowSchema.array().safeParse(resultObjects(result));
  const row = parsed.success && parsed.data.length === 1 ? parsed.data[0] : undefined;
  return {
    valid: row !== undefined,
    matches:
      row !== undefined &&
      row.projectId === projectId &&
      row.storageId === selection.identity.storageId &&
      row.generationId === selection.identity.generationId &&
      row.runtimeDatabaseLineageId === selection.identity.runtimeDatabaseLineageId &&
      row.createdAt === selection.generation.createdAt,
  };
}

type OpeningClientSlot = "canonical" | "runtime";
type MutableOpeningClients = {
  canonical: LocalClient | undefined;
  runtime: LocalClient | undefined;
};

async function probeProjectDatabase(
  databasePath: string,
  spec: OpeningDatabaseSpec,
  projectId: ProjectId,
  selection: OpeningSelection,
  migrations: readonly GeneratedMigration[],
  clientSlot: OpeningClientSlot,
  openedClients: MutableOpeningClients,
): Promise<ProjectDatabaseProbe> {
  try {
    const entry = await lstatIfPresent(databasePath);
    if (entry === undefined) {
      return { status: "missing" };
    }
    if (entry.isSymbolicLink() || !entry.isFile()) {
      return { status: "corrupt" };
    }
    const client = createLocalClient(databasePath);
    if (openedClients[clientSlot] !== undefined) {
      client.close();
      throw new ProjectStorageBrokenError("Project Storage opening client slot is occupied.");
    }
    openedClients[clientSlot] = client;
    if ((await lstatIfPresent(databasePath)) === undefined) {
      return { status: "missing" };
    }

    await client.execute("PRAGMA foreign_keys = ON");
    const foreignKeysEnabled = integerScalar(await client.execute("PRAGMA foreign_keys")) === 1;
    const metadataResult = await client.execute(
      `SELECT metadata_key AS metadataKey, database_kind AS databaseKind,
        format_version AS formatVersion, schema_version AS schemaVersion,
        last_migration_id AS lastMigrationId FROM ${spec.metadataTable}`,
    );
    const parsedMetadata = metadataRowSchema.array().safeParse(resultObjects(metadataResult));
    const metadata =
      parsedMetadata.success && parsedMetadata.data.length === 1
        ? parsedMetadata.data[0]
        : undefined;
    const compatibility = metadataCompatibility(metadata, spec, migrations);
    const identity = await inspectDatabaseIdentity(client, spec, projectId, selection);
    const foreignKeyViolationCount = (
      await client.execute("PRAGMA foreign_key_check")
    ).rows.length;
    const integrityRows =
      stringScalarRows(await client.execute("PRAGMA integrity_check")) ?? [];
    return {
      status: "present",
      identityMatches: identity.matches,
      format: compatibility.format,
      migration: compatibility.migration,
      foreignKeysEnabled,
      foreignKeyViolationCount,
      integrityRows,
      domainInvariantsValid:
        identity.valid &&
        metadata !== undefined &&
        metadata.metadataKey === spec.metadataKey &&
        metadata.databaseKind === spec.databaseKind,
    };
  } catch (error) {
    if (isMissingError(error)) {
      return { status: "missing" };
    }
    if (isUnavailableError(error)) {
      return { status: "unavailable" };
    }
    if (isCorruptDatabaseError(error)) {
      return { status: "corrupt" };
    }
    return { status: "broken" };
  }
}

export type OpeningDatabaseClient = Readonly<{ close(): void }>;
export type OpeningDatabaseClients = Readonly<{
  canonical: OpeningDatabaseClient | undefined;
  runtime: OpeningDatabaseClient | undefined;
}>;

export function createOpeningRelease(
  openedClients: OpeningDatabaseClients,
): () => void {
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const releaseErrors: unknown[] = [];
    for (const client of [openedClients.canonical, openedClients.runtime]) {
      if (client === undefined) {
        continue;
      }
      try {
        client.close();
      } catch (error) {
        releaseErrors.push(error);
      }
    }
    if (releaseErrors.length > 0) {
      throw new AggregateError(
        releaseErrors,
        "Project Storage database release failed.",
      );
    }
  };
}
```

Inside `createNodeAdapters`, after `paths` is defined and after the existing application-client helpers, add this exact inspector:

```ts
  const inspectOpening = async (projectId: ProjectId): Promise<ProjectStorageOpenEvidence> => {
    const openedClients: MutableOpeningClients = {
      canonical: undefined,
      runtime: undefined,
    };
    const release = createOpeningRelease(openedClients);
    try {
      const normalizedProjectRoot = path.resolve(projectRootFor(projectId));
      const [client, filesystem] = await Promise.all([
        existingApplicationClient(),
        inspectFilesystemWitnesses(normalizedProjectRoot),
      ]);
      if (client === undefined) {
        return filesystem.kinds.length === 0
          ? { status: "not-registered" }
          : {
              status: "recovery-required",
              identity: recoveryOpeningIdentity(undefined, undefined),
              release,
            };
      }

      const applicationMigrations = await loadMigrations(databaseSpecs.application);
      await requireApplicationOpeningAuthority(client, applicationMigrations);
      await requireApplicationIntegrity(client);
      const registryInspection = await inspectRegistryOpening(
        client,
        projectId,
        normalizedProjectRoot,
        filesystem,
        paths,
      );
      if (registryInspection.status === "not-registered") {
        return registryInspection;
      }
      if (registryInspection.status === "recovery-required") {
        return { ...registryInspection, release };
      }

      const manifestInspection = await inspectOpeningManifest(
        registryInspection.selection.paths.manifest,
        projectId,
        registryInspection.selection,
      );
      if (manifestInspection.status === "blocked") {
        return {
          status: "selected-blocked",
          identity: registryInspection.selection.identity,
          manifestStatus: manifestInspection.manifestStatus,
          release,
        };
      }

      const [canonicalMigrations, runtimeMigrations] = await Promise.all([
        loadMigrations(databaseSpecs.canonical),
        loadMigrations(databaseSpecs.runtime),
      ]);
      const [canonical, runtime] = await Promise.all([
        probeProjectDatabase(
          registryInspection.selection.paths.canonicalDatabase,
          databaseSpecs.canonical,
          projectId,
          registryInspection.selection,
          canonicalMigrations,
          "canonical",
          openedClients,
        ),
        probeProjectDatabase(
          registryInspection.selection.paths.runtimeDatabase,
          databaseSpecs.runtime,
          projectId,
          registryInspection.selection,
          runtimeMigrations,
          "runtime",
          openedClients,
        ),
      ]);
      return {
        status: "selected-current",
        identity: registryInspection.selection.identity,
        canonical,
        runtime,
        release,
      };
    } catch (error) {
      try {
        release();
      } catch {
        throw new ProjectStorageBrokenError("Project Storage opening release failed.");
      }
      normalizeApplicationError(error, "Project Storage opening authority is invalid.");
    }
  };
```

Add the exact `opening` member to the object returned by `createNodeAdapters`, immediately after `registry`:

```ts
    opening: {
      inspect: inspectOpening,
    },
```

#### 6. Transaction And Aggregate Database Release Contracts
**File**: `apps/harness/src/storage/project-storage-node-adapters.test.ts`
**Changes**: Preserve Phase 3's transaction rollback test, then prove fixed-slot release is canonical-then-runtime regardless of probe completion order, every opened client is closed once, and every close failure is preserved deterministically.

```ts
import { ProjectStorageCreateRequestSchema } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import type { ProjectStorageOwnerPort } from "../project-storage-application.js";
import { createProjectStorageApplication } from "../project-storage-application.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  createOpeningRelease,
  initializeRetainedApplicationClient,
  withWriteTransaction,
} from "./project-storage-node-adapters.js";

it.each(["existing", "mutable"])(
  "retains then closes a failing %s application client exactly once",
  async () => {
    const initializationFailure = new Error("foreign key initialization failed");
    const close = vi.fn();
    const client = { close };
    const retained: Array<typeof client | undefined> = [];

    await expect(
      initializeRetainedApplicationClient(
        client,
        (value) => retained.push(value),
        async (initializing) => {
          expect(retained).toEqual([initializing]);
          throw initializationFailure;
        },
      ),
    ).rejects.toBe(initializationFailure);

    expect(retained).toEqual([client, undefined]);
    expect(close).toHaveBeenCalledOnce();
  },
);

it("preserves application initialization and close failures in order", async () => {
  const initializationFailure = new Error("foreign key initialization failed");
  const closeFailure = new Error("application close failed");
  const close = vi.fn(() => {
    throw closeFailure;
  });
  let failure: unknown;

  try {
    await initializeRetainedApplicationClient(
      { close },
      () => undefined,
      async () => {
        throw initializationFailure;
      },
    );
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error("Expected application initialization to fail with AggregateError.");
  }
  expect(failure.message).toBe("Project Storage application client initialization failed.");
  expect(failure.errors).toEqual([initializationFailure, closeFailure]);
  expect(close).toHaveBeenCalledOnce();
});

it("releases canonical then runtime regardless of probe completion order", () => {
  const canonicalFailure = new Error("canonical close failed");
  const runtimeFailure = new Error("runtime close failed");
  const calls: string[] = [];
  const canonicalClose = vi.fn(() => {
    calls.push("canonical");
    throw canonicalFailure;
  });
  const runtimeClose = vi.fn(() => {
    calls.push("runtime");
    throw runtimeFailure;
  });
  const release = createOpeningRelease({
    runtime: { close: runtimeClose },
    canonical: { close: canonicalClose },
  });

  let failure: unknown;
  try {
    release();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error("Expected database release to fail with AggregateError.");
  }
  expect(failure.message).toBe("Project Storage database release failed.");
  expect(failure.errors).toEqual([canonicalFailure, runtimeFailure]);
  expect(calls).toEqual(["canonical", "runtime"]);
  expect(canonicalClose).toHaveBeenCalledOnce();
  expect(runtimeClose).toHaveBeenCalledOnce();
  expect(() => release()).not.toThrow();
  expect(canonicalClose).toHaveBeenCalledOnce();
  expect(runtimeClose).toHaveBeenCalledOnce();
});
```

#### 7. Real Opening Health Integration
**File**: `apps/harness/tests/integration/project-storage-open.integration.test.ts`
**Changes**: Prove healthy mutable opening, all health families, strict corrupt/broken probe mapping, clean absence, exact active-witness matching, shared application-client initialization/failure retry across Projects, and top-level application failures with real libSQL.

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import {
  createNodeProjectStorageDependencies,
} from "../../src/storage/project-storage-node-adapters.js";

it("opens a healthy created generation without comparing mutable bytes to baselines", async () => {
  const root = await createHealthyProjectStorageFixture();
  await mutateCanonicalDomainRowsWithoutChangingIdentity(root);
  const before = await inspectDurableProjectStorageState(root);
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "opened",
      mode: "read-write",
      canonicalHealth: { status: "healthy" },
      runtimeHealth: { status: "healthy" },
    },
  });
  await runtime.close(closeRequest);
  await runtime.stop();
  expect(await inspectDurableProjectStorageState(root)).toEqual(before);
});

it.each(openingHealthCases)(
  "classifies $name independently without mutation",
  async ({ seed, expectedCanonical, expectedRuntime }) => {
    const root = await createHealthyProjectStorageFixture();
    await seed(root);
    const before = await inspectDurableProjectStorageState(root);
    const runtime = await createStorageRuntimeForRoot(root);

    await expect(runtime.open(openRequest)).resolves.toMatchObject({
      event: "project.open.result",
      payload: {
        status: "safe-mode",
        mode: "safe-mode",
        canonicalHealth: expectedCanonical,
        runtimeHealth: expectedRuntime,
      },
    });
    await runtime.stop();
    expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  },
);

it("observes clean absence without creating application.db", async () => {
  const root = await createTemporaryApplicationRoot();
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "not-registered", request: openRequest },
  });
  await runtime.stop();
  expect(await pathExists(path.join(root, "application.db"))).toBe(false);
});

it("uses one orphan location witness consistently for create and open", async () => {
  const root = await createTemporaryApplicationRoot();
  const initializer = await createStorageRuntimeForRoot(root);
  const initializerRequest = ProjectStorageCreateRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000050",
    createRequestId: "00000000-0000-4000-8000-000000000051",
  });
  await expect(initializer.create(initializerRequest)).resolves.toMatchObject({
    payload: { status: "created" },
  });
  await initializer.stop();

  const orphanCreateRequest = ProjectStorageCreateRequestSchema.parse({
    projectId: openRequest.projectId,
    createRequestId: "00000000-0000-4000-8000-000000000052",
  });
  const client = createClient({
    url: pathToFileURL(path.join(root, "application.db")).href,
  });
  try {
    await client.execute({
      sql: `INSERT INTO storage_locations
        (storage_id, location_id, normalized_path, location_state, observed_at)
        VALUES (?, ?, ?, 'staging', ?)`,
      args: [
        "00000000-0000-4000-8000-000000000061",
        "00000000-0000-4000-8000-000000000062",
        path.resolve(root, "projects", openRequest.projectId),
        "2026-08-31T12:00:00.000Z",
      ],
    });
  } finally {
    client.close();
  }
  const before = await inspectApplicationStorageRoot(root);
  const runtime = await createStorageRuntimeForRoot(root);

  const createResult = await runtime.create(orphanCreateRequest);
  const openResult = await runtime.open(openRequest);
  await runtime.stop();

  expect(createResult).toMatchObject({
    event: "project.create.result",
    payload: {
      status: "blocked",
      reason: "prior-state-witness",
      diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
    },
  });
  expect(openResult).toMatchObject({
    event: "project.open.result",
    payload: {
      status: "safe-mode",
      canonicalHealth: {
        status: "recovery-required",
        diagnostic: {
          code: "DATABASE_RECOVERY_REQUIRED",
          message: "Database recovery is required.",
        },
      },
      runtimeHealth: {
        status: "recovery-required",
        diagnostic: {
          code: "DATABASE_RECOVERY_REQUIRED",
          message: "Database recovery is required.",
        },
      },
    },
  });
  expect(await inspectApplicationStorageRoot(root)).toEqual(before);
  expect(JSON.stringify([createResult, openResult])).not.toContain(root);
});

it("classifies a filesystem-only witness as recovery-required without initializing", async () => {
  const root = await createTemporaryApplicationRoot();
  await seedReservedProjectWitness(root, openRequest.projectId, "canonical-wal");
  const before = await inspectProjectNamespace(root, openRequest.projectId);
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "safe-mode",
      canonicalHealth: { status: "recovery-required" },
      runtimeHealth: { status: "recovery-required" },
    },
  });
  await runtime.stop();
  expect(await pathExists(path.join(root, "application.db"))).toBe(false);
  expect(await inspectProjectNamespace(root, openRequest.projectId)).toEqual(before);
});

it.each(applicationOpeningFailureCases)(
  "keeps application authority $name distinct from absence",
  async ({ seed, expectedStatus, expectedCode }) => {
    const root = await createTemporaryApplicationRoot();
    await seed(root);
    const before = await inspectApplicationStorageRoot(root);
    const runtime = await createStorageRuntimeForRoot(root);

    await expect(runtime.open(openRequest)).resolves.toMatchObject({
      event: "project.open.result",
      payload: {
        status: expectedStatus,
        diagnostic: { code: expectedCode },
      },
    });
    await runtime.stop();
    expect(await inspectApplicationStorageRoot(root)).toEqual(before);
  },
);

it("checks application integrity before returning Project recovery evidence", async () => {
  const root = await createHealthyProjectStorageFixture();
  const applicationClient = createClient({
    url: pathToFileURL(path.join(root, "application.db")).href,
  });
  try {
    await applicationClient.execute("PRAGMA foreign_keys = OFF");
    await applicationClient.execute({
      sql: `DELETE FROM storage_locations
        WHERE storage_id = (
          SELECT storage_id FROM storage_registrations WHERE project_id = ?
        ) AND location_id = (
          SELECT active_location_id FROM storage_registrations WHERE project_id = ?
        )`,
      args: [openRequest.projectId, openRequest.projectId],
    });
    const violations = await applicationClient.execute("PRAGMA foreign_key_check");
    expect(violations.rows.length).toBeGreaterThan(0);
  } finally {
    applicationClient.close();
  }
  const before = await inspectApplicationStorageRoot(root);
  const runtime = await createStorageRuntimeForRoot(root);

  const result = await runtime.open(openRequest);
  await runtime.stop();

  expect(result).toMatchObject({
    event: "project.open.result",
    payload: {
      status: "broken",
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage application authority has foreign-key violations.",
      },
    },
  });
  expect(await inspectApplicationStorageRoot(root)).toEqual(before);
  expect(JSON.stringify(result)).not.toContain(root);
});

it("treats contradictory active location authority as broken without mutation", async () => {
  const root = await createHealthyProjectStorageFixture();
  const applicationClient = createClient({
    url: pathToFileURL(path.join(root, "application.db")).href,
  });
  const contradictoryLocationId = "00000000-0000-4000-8000-000000000098";
  try {
    await applicationClient.execute({
      sql: `INSERT INTO storage_locations
        (storage_id, location_id, normalized_path, location_state, observed_at)
        SELECT storage_id, ?, ?, 'staging', ?
        FROM storage_registrations WHERE project_id = ?`,
      args: [
        contradictoryLocationId,
        path.resolve(root, "contradictory-location"),
        "2026-08-31T12:00:00.000Z",
        openRequest.projectId,
      ],
    });
    await applicationClient.execute({
      sql: `UPDATE storage_registrations
        SET active_location_id = ? WHERE project_id = ?`,
      args: [contradictoryLocationId, openRequest.projectId],
    });
  } finally {
    applicationClient.close();
  }
  const before = await inspectDurableProjectStorageState(root);
  const runtime = await createStorageRuntimeForRoot(root);

  const result = await runtime.open(openRequest);
  await runtime.stop();

  expect(result).toMatchObject({
    event: "project.open.result",
    payload: {
      status: "broken",
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage authority is internally inconsistent.",
      },
    },
  });
  expect(await inspectDurableProjectStorageState(root)).toEqual(before);
  expect(JSON.stringify(result)).not.toContain(root);
  expect(JSON.stringify(result)).not.toContain(path.resolve(root, "contradictory-location"));
});

it.each(["existing", "mutable"] as const)(
  "normalizes %s application initialization failure at the owner boundary",
  async (kind) => {
    const root =
      kind === "existing"
        ? await createHealthyProjectStorageFixture()
        : await createTemporaryApplicationRoot();
    const caughtText = `${root}: foreign key initialization failed`;
    const before = await inspectApplicationStorageRoot(root);
    const runtime = await createStorageRuntimeForRoot(root, {
      initializeApplicationClient: async () => {
        throw new Error(caughtText);
      },
    });

    const result =
      kind === "existing"
        ? await runtime.open(openRequest)
        : await runtime.create(createRequest);
    await runtime.stop();

    expect(result.payload).toMatchObject({
      status: "broken",
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage owner failed.",
      },
    });
    expect(await inspectApplicationStorageRoot(root)).toEqual(before);
    expect(JSON.stringify(result)).not.toContain(root);
    expect(JSON.stringify(result)).not.toContain(caughtText);
  },
);

it("shares one deferred application-client initialization across Projects", async () => {
  const root = await createHealthyProjectStorageFixture();
  const otherRequest = ProjectStorageOpenRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000099",
  });
  let initializationCount = 0;
  let applicationCloseCount: (() => number) | undefined;
  let resolveStarted: (() => void) | undefined;
  let releaseInitialization: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseInitialization = resolve;
  });
  const dependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
    initializeApplicationClient: async (client) => {
      initializationCount += 1;
      const close = vi.spyOn(client, "close");
      applicationCloseCount = () => close.mock.calls.length;
      const markStarted = resolveStarted;
      if (markStarted === undefined) {
        throw new Error("Application initialization start resolver is unavailable.");
      }
      markStarted();
      await released;
      await client.execute("PRAGMA foreign_keys = ON");
    },
  });

  const selectedPromise = dependencies.opening.inspect(openRequest.projectId);
  const absentPromise = dependencies.opening.inspect(otherRequest.projectId);
  await started;
  await Promise.resolve();
  expect(initializationCount).toBe(1);
  const release = releaseInitialization;
  if (release === undefined) {
    throw new Error("Application initialization release resolver is unavailable.");
  }
  release();
  const [selected, absent] = await Promise.all([selectedPromise, absentPromise]);
  expect(selected.status).toBe("selected-current");
  expect(absent).toEqual({ status: "not-registered" });
  if (selected.status !== "selected-current") {
    throw new Error("Expected current Project Storage selection.");
  }
  selected.release();
  const observeApplicationClose = applicationCloseCount;
  if (observeApplicationClose === undefined) {
    throw new Error("Application client close observation is unavailable.");
  }
  expect(observeApplicationClose()).toBe(0);
  dependencies.registry.stop();
  expect(initializationCount).toBe(1);
  expect(observeApplicationClose()).toBe(1);
});

it("clears only the failed shared initialization and retries once", async () => {
  const root = await createHealthyProjectStorageFixture();
  const otherRequest = ProjectStorageOpenRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000099",
  });
  const initializationFailure = new Error(`${root}: first initialization failed`);
  let initializationCount = 0;
  const applicationCloseCounts: Array<() => number> = [];
  const dependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
    initializeApplicationClient: async (client) => {
      initializationCount += 1;
      const close = vi.spyOn(client, "close");
      applicationCloseCounts.push(() => close.mock.calls.length);
      if (initializationCount === 1) {
        await Promise.resolve();
        throw initializationFailure;
      }
      await client.execute("PRAGMA foreign_keys = ON");
    },
  });

  const failed = await Promise.all(
    [
      dependencies.opening.inspect(openRequest.projectId),
      dependencies.opening.inspect(otherRequest.projectId),
    ].map(async (operation) => {
      try {
        await operation;
        return { status: "resolved" as const };
      } catch (error) {
        return { status: "rejected" as const, error };
      }
    }),
  );
  expect(initializationCount).toBe(1);
  expect(failed.map((result) => result.status)).toEqual(["rejected", "rejected"]);
  for (const result of failed) {
    if (result.status !== "rejected") {
      throw new Error("Expected shared application initialization to reject.");
    }
    expect(result.error).toMatchObject({
      name: "ProjectStorageBrokenError",
      message: "Project Storage application authority is invalid.",
    });
    expect(String(result.error)).not.toContain(root);
    expect(String(result.error)).not.toContain(initializationFailure.message);
  }
  const failedCloseCount = applicationCloseCounts[0];
  if (failedCloseCount === undefined) {
    throw new Error("Failed application client close observation is unavailable.");
  }
  expect(failedCloseCount()).toBe(1);

  const retried = await dependencies.opening.inspect(openRequest.projectId);
  expect(initializationCount).toBe(2);
  expect(retried.status).toBe("selected-current");
  if (retried.status !== "selected-current") {
    throw new Error("Expected successful application initialization retry.");
  }
  retried.release();
  const retainedCloseCount = applicationCloseCounts[1];
  if (retainedCloseCount === undefined) {
    throw new Error("Retained application client close observation is unavailable.");
  }
  expect(retainedCloseCount()).toBe(0);
  dependencies.registry.stop();
  expect(failedCloseCount()).toBe(1);
  expect(retainedCloseCount()).toBe(1);
});

it("reports corrupt when a known-older database also fails integrity", async () => {
  const root = await createHealthyProjectStorageFixture();
  await seedKnownOlderCanonicalAuthority(root);
  await seedCanonicalIntegrityFailure(root);
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "safe-mode",
      canonicalHealth: {
        status: "corrupt",
        diagnostic: { code: "DATABASE_CORRUPT" },
      },
      runtimeHealth: { status: "healthy" },
    },
  });
  await runtime.stop();
});

it("maps recognized SQLite not-a-database failure only to corrupt", async () => {
  const root = await createHealthyProjectStorageFixture();
  const state = await inspectDurableProjectStorageState(root);
  await writeFile(
    path.join(state.activeGenerationDirectory, "slopstop.db"),
    "not a sqlite database",
  );
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "safe-mode",
      canonicalHealth: {
        status: "corrupt",
        diagnostic: {
          code: "DATABASE_CORRUPT",
          message: "Database integrity validation failed.",
        },
      },
      runtimeHealth: { status: "healthy" },
    },
  });
  await runtime.stop();
});

it("maps an unexpected probe SQL failure to the stable broken diagnostic", async () => {
  const root = await createHealthyProjectStorageFixture();
  const state = await inspectDurableProjectStorageState(root);
  const canonicalPath = path.join(state.activeGenerationDirectory, "slopstop.db");
  const client = createClient({ url: pathToFileURL(canonicalPath).href });
  try {
    await client.execute("DROP TABLE schema_metadata");
  } finally {
    client.close();
  }
  const runtime = await createStorageRuntimeForRoot(root);

  const result = await runtime.open(openRequest);
  expect(result).toMatchObject({
    event: "project.open.result",
    payload: {
      status: "safe-mode",
      canonicalHealth: {
        status: "broken",
        diagnostic: {
          code: "DATABASE_BROKEN",
          message: "Database authority is internally inconsistent.",
        },
      },
      runtimeHealth: { status: "healthy" },
    },
  });
  expect(JSON.stringify(result)).not.toContain(canonicalPath);
  await runtime.stop();
});

it("requires recovery when an orphan generation accompanies the active generation", async () => {
  const root = await createHealthyProjectStorageFixture();
  const state = await inspectDurableProjectStorageState(root);
  const projectRoot = path.dirname(state.activeGenerationDirectory);
  await mkdir(path.join(projectRoot, "00000000-0000-4000-8000-000000000099"));
  const before = await inspectProjectNamespace(root, openRequest.projectId);
  const runtime = await createStorageRuntimeForRoot(root);

  await expect(runtime.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "safe-mode",
      canonicalHealth: { status: "recovery-required" },
      runtimeHealth: { status: "recovery-required" },
    },
  });
  await runtime.stop();
  expect(await inspectProjectNamespace(root, openRequest.projectId)).toEqual(before);
});

it.each(["slopstop.db", "mastra.db-wal"] as const)(
  "requires recovery for root-level %s witness beside the active generation",
  async (filename) => {
    const root = await createHealthyProjectStorageFixture();
    const state = await inspectDurableProjectStorageState(root);
    const projectRoot = path.dirname(state.activeGenerationDirectory);
    await writeFile(path.join(projectRoot, filename), "witness", { flag: "wx" });
    const before = await inspectProjectNamespace(root, openRequest.projectId);
    const runtime = await createStorageRuntimeForRoot(root);

    await expect(runtime.open(openRequest)).resolves.toMatchObject({
      event: "project.open.result",
      payload: {
        status: "safe-mode",
        canonicalHealth: { status: "recovery-required" },
        runtimeHealth: { status: "recovery-required" },
      },
    });
    await runtime.stop();
    expect(await inspectProjectNamespace(root, openRequest.projectId)).toEqual(before);
  },
);
```

#### 8. Structured-Clone Session Lifecycle Integration
**File**: `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
**Changes**: Prove independent Project sessions, reopen/close/async-stop release counts, admission-ordered release under reverse open completion, all-admitted-operation drain for open/create/close representatives, stop-versus-create boundary fencing, shared shutdown rejection, and both successful and failed stop-versus-late-opening races over the transport/application seams.

Extend the existing fixture with `deferNextProjectOperation()`. It wraps exactly the next `locks.forProject` callback, resolves `started` before waiting, and exposes an idempotent `release()` that lets the callback run exactly once. Type its `openings` queue entries as `readonly [ProjectId, ProjectStorageOpenEvidence | Promise<ProjectStorageOpenEvidence>]`; the `opening.inspect` fake shifts one entry, checks the requested Project identity, and returns `await evidence` so independently admitted Projects can complete in reverse order. Implement resolvers with explicit undefined checks; do not use a non-null assertion or cast. Every existing fixture field and lifecycle test remains unchanged.

```ts
import { expect, it, vi } from "vitest";

it("reopens one Project without closing another and releases every session once", async () => {
  const fixture = createStorageTransportFixture({
    openings: [
      [projectA, healthyOpeningEvidence(releaseA1)],
      [projectB, safeModeOpeningEvidence(releaseB)],
      [projectA, healthyOpeningEvidence(releaseA2)],
    ],
  });

  await expect(fixture.open(projectA)).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "opened" },
  });
  await expect(fixture.open(projectB)).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "safe-mode" },
  });
  await fixture.open(projectA);
  expect(releaseA1).toHaveBeenCalledOnce();
  expect(releaseA2).not.toHaveBeenCalled();
  expect(releaseB).not.toHaveBeenCalled();

  await fixture.close(projectA);
  await fixture.close(projectA);
  expect(releaseA2).toHaveBeenCalledOnce();
  expect(releaseB).not.toHaveBeenCalled();
  const firstStop = fixture.stop();
  const repeatedStop = fixture.stop();
  expect(repeatedStop).toBe(firstStop);
  await firstStop;
  expect(releaseB).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("releases retained sessions by admission after opens complete in reverse", async () => {
  const pendingA = deferredOpeningEvidence();
  const pendingB = deferredOpeningEvidence();
  const releaseOrder: string[] = [];
  const releaseA = vi.fn(() => releaseOrder.push("A"));
  const releaseB = vi.fn(() => releaseOrder.push("B"));
  const fixture = createStorageTransportFixture({
    openings: [
      [projectA, pendingA.promise],
      [projectB, pendingB.promise],
    ],
  });

  const openingA = fixture.open(projectA);
  await pendingA.started;
  const openingB = fixture.open(projectB);
  await pendingB.started;
  pendingB.resolve(healthyOpeningEvidence(releaseB));
  await expect(openingB).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "opened" },
  });
  pendingA.resolve(healthyOpeningEvidence(releaseA));
  await expect(openingA).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "opened" },
  });

  await fixture.stop();
  expect(releaseOrder).toEqual(["A", "B"]);
  expect(releaseA).toHaveBeenCalledOnce();
  expect(releaseB).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("reports every session and registry failure through one shared stop promise", async () => {
  const sessionFailure = new Error("session release failed");
  const registryFailure = new Error("registry close failed");
  const releaseA = vi.fn(() => {
    throw sessionFailure;
  });
  const releaseB = vi.fn();
  const fixture = createStorageTransportFixture({
    openings: [
      [projectA, healthyOpeningEvidence(releaseA)],
      [projectB, healthyOpeningEvidence(releaseB)],
    ],
    registryStopError: registryFailure,
  });
  await fixture.open(projectA);
  await fixture.open(projectB);

  const firstStop = fixture.stop();
  const repeatedStop = fixture.stop();
  expect(repeatedStop).toBe(firstStop);
  let failure: unknown;
  try {
    await firstStop;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error("Expected Project Storage shutdown to fail with AggregateError.");
  }
  expect(failure.message).toBe("Project Storage shutdown failed.");
  expect(failure.errors).toEqual([sessionFailure, registryFailure]);
  expect(releaseA).toHaveBeenCalledOnce();
  expect(releaseB).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("drains an already-admitted deferred close before registry shutdown", async () => {
  const releaseSession = vi.fn();
  const fixture = createStorageTransportFixture({
    openings: [[projectA, healthyOpeningEvidence(releaseSession)]],
  });
  await fixture.open(projectA);
  const pendingClose = fixture.deferNextProjectOperation();
  const closeResponse = fixture.close(projectA);
  await pendingClose.started;

  let closeSettlements = 0;
  const observedClose = closeResponse.then((result) => {
    closeSettlements += 1;
    return result;
  });
  let stopSettled = false;
  const stopPromise = fixture.stop();
  const repeatedStop = fixture.stop();
  const observedStop = stopPromise.then(() => {
    stopSettled = true;
  });
  await Promise.resolve();

  expect(repeatedStop).toBe(stopPromise);
  expect(closeSettlements).toBe(0);
  expect(stopSettled).toBe(false);
  expect(releaseSession).not.toHaveBeenCalled();
  expect(fixture.registryStop).not.toHaveBeenCalled();

  pendingClose.release();
  await expect(observedClose).resolves.toMatchObject({
    event: "project.close.result",
    payload: {
      status: "unavailable",
      request: { projectId: projectA },
      diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
    },
  });
  expect(closeSettlements).toBe(1);
  await observedStop;

  expect(releaseSession).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
  expect(stopSettled).toBe(true);
});

it("releases a late opening candidate when stop wins the race", async () => {
  const pending = deferredOpeningEvidence();
  const fixture = createStorageTransportFixture({ openingPromise: pending.promise });
  const response = fixture.open(projectA);
  await pending.started;

  const stopPromise = fixture.stop();
  pending.resolve(healthyOpeningEvidence(pending.release));

  await expect(response).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "unavailable",
      diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
    },
  });
  await stopPromise;
  expect(pending.release).toHaveBeenCalledOnce();
});

it("drains a pending open and aggregates its late release failure before registry stop", async () => {
  const lateReleaseFailure = new Error("late opening release failed");
  const release = vi.fn(() => {
    throw lateReleaseFailure;
  });
  const pending = deferredOpeningEvidence();
  const fixture = createStorageTransportFixture({ openingPromise: pending.promise });
  const response = fixture.open(projectA);
  await pending.started;

  const stopPromise = fixture.stop();
  let stopSettled = false;
  const observedStop = stopPromise.then(
    () => {
      stopSettled = true;
      return { status: "resolved" as const };
    },
    (error: unknown) => {
      stopSettled = true;
      return { status: "rejected" as const, error };
    },
  );
  await Promise.resolve();
  expect(stopSettled).toBe(false);
  expect(fixture.registryStop).not.toHaveBeenCalled();

  pending.resolve(healthyOpeningEvidence(release));
  await expect(response).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "broken",
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage opening release failed.",
      },
    },
  });
  const stopResult = await observedStop;
  expect(stopResult.status).toBe("rejected");
  if (stopResult.status !== "rejected") {
    throw new Error("Expected Project Storage shutdown to reject.");
  }
  expect(stopResult.error).toBeInstanceOf(AggregateError);
  if (!(stopResult.error instanceof AggregateError)) {
    throw new Error("Expected Project Storage shutdown to fail with AggregateError.");
  }
  expect(stopResult.error.message).toBe("Project Storage shutdown failed.");
  expect(stopResult.error.errors).toEqual([lateReleaseFailure]);
  expect(release).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});
```

### Test Contract:

- **Behavior**: Healthy opening validates live authority without treating activation baselines as immutable live hashes.
  - Test: `opens a healthy created generation without comparing mutable bytes to baselines` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: after a valid canonical domain mutation changes database bytes but preserves metadata, identities, FK integrity, SQLite integrity, and invariants, a real structured-clone `project.open` returns opened/read-write with both health values healthy; close and stop leave all durable state unchanged.
  - Expected red: no existing-generation opener or retained clients exist.
- **Behavior**: Real opening fixtures classify every database-health family without mutation.
  - Test: `classifies $name independently without mutation` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: the exact case table covers canonical known-older/migration-required, incomplete generation/recovery-required for both, deleted canonical/missing, malformed canonical/corrupt, changed canonical lineage/identity-conflict, newer canonical metadata/unsupported-newer, an injected canonical open-access failure/unavailable, unknown canonical migration/broken, and corrupt runtime with healthy canonical; every result is safe-mode with matching diagnostic code and the post-open registry/files equal the pre-open snapshot.
  - Expected red: Node adapters implement creation verification only.
- **Behavior**: Corruption takes precedence over otherwise valid migration eligibility.
  - Test: `reports corrupt when a known-older database also fails integrity` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: a canonical database with known-older authority and a failing integrity result emits safe-mode with canonical corrupt/DATABASE_CORRUPT and runtime healthy, never migration-required.
  - Expected red: no opening-health precedence exists.
- **Behavior**: Only recognized SQLite corruption codes map to corrupt; unexpected probe failures remain broken.
  - Tests: `keeps corrupt and broken probe outcomes distinct` -> `apps/harness/src/storage/project-storage-opening.test.ts`; `maps recognized SQLite not-a-database failure only to corrupt`; `maps an unexpected probe SQL failure to the stable broken diagnostic` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: the pure classifier pins exact corrupt/DATABASE_CORRUPT and broken/DATABASE_BROKEN diagnostics; invalid SQLite bytes map through `SQLITE_NOTADB` to corrupt, while a real unexpected SQL failure maps to broken without leaking the database path.
  - Expected red: the probe catch maps every non-access exception to corrupt and the classifier has no broken probe branch.
- **Behavior**: Opening absence and filesystem-only witnesses never initialize application authority.
  - Tests: `observes clean absence without creating application.db`; `classifies a filesystem-only witness as recovery-required without initializing` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: an empty root returns not-registered and leaves `application.db` absent; a reserved canonical WAL witness with no registry returns safe-mode/recovery-required for both databases, preserves the exact namespace, and also leaves `application.db` absent.
  - Expected red: Slice 3 registry inspection is create-oriented and no open path exists.
- **Behavior**: Create and open classify the same orphan normalized-path location row as one recovery witness.
  - Test: `uses one orphan location witness consistently for create and open` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: after valid application authority is initialized for another Project, one real `storage_locations` row at `path.resolve(root, "projects", openRequest.projectId)` with no target registration, generation, or filesystem artifact makes create return `blocked/prior-state-witness/PROJECT_STORAGE_PRIOR_STATE_WITNESS` and open return safe-mode with canonical and runtime exactly `recovery-required/DATABASE_RECOVERY_REQUIRED/Database recovery is required.`; the application/Project snapshot is unchanged and neither result contains `root`.
  - Expected red: create's direct `normalized_path` query sees the orphan row, but opening checks only target registration, generation, and filesystem evidence and incorrectly returns `not-registered`.
- **Behavior**: Application infrastructure failures remain top-level and never degrade to Project absence.
  - Test: `keeps application authority $name distinct from absence` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: inaccessible existing `application.db` returns unavailable/PROJECT_STORAGE_UNAVAILABLE; malformed metadata, malformed rows, or disagreeing active pointers return broken/PROJECT_STORAGE_OWNER_FAILED; no branch returns not-registered or a per-database status, mutates authority, or includes a full path.
  - Expected red: no application-registry opening classification exists.
- **Behavior**: Application integrity is authoritative before any Project registry status can return.
  - Test: `checks application integrity before returning Project recovery evidence` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: after a real healthy generation is changed with foreign keys disabled so its active location is missing, `PRAGMA foreign_key_check` reports at least one application-authority violation while the selected Project also has recovery evidence. `project.open` returns exactly top-level `broken/PROJECT_STORAGE_OWNER_FAILED/Project Storage application authority has foreign-key violations.`, never safe-mode/recovery-required or not-registered; the complete application root is unchanged by open and the result contains no root.
  - Expected red: opening runs application integrity only for selected and not-registered registry outcomes, so the recovery-required branch returns before authority corruption is checked.
- **Behavior**: Contradictory active registration, generation, and location authority is broken rather than recovery-required.
  - Test: `treats contradictory active location authority as broken without mutation` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: after real libSQL authority is created, redirecting the registration's non-null active location pointer to a second staging location while the active generation retains its original location returns exactly `broken/PROJECT_STORAGE_OWNER_FAILED/Project Storage authority is internally inconsistent.`; the complete durable snapshot is unchanged and the result contains neither the application root nor either location path.
  - Expected red: the opening inspector treats active pointer disagreement as incomplete witness evidence and returns recovery-required.
- **Behavior**: Opening requires the exact selected generation as the only ordinary generation and rejects root-level database witnesses.
  - Tests: `requires recovery when an orphan generation accompanies the active generation`; `requires recovery for root-level %s witness beside the active generation` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: one extra valid generation directory, a root-level canonical database, and a root-level runtime sidecar each return safe-mode/recovery-required for both databases, preserve the exact namespace, and never open the registered generation read-write.
  - Expected red: the opening inspector checks staging and reserved witness kinds but accepts extra ordinary generations and root-level database witnesses beside a valid active selection.
- **Behavior**: Reopen, close, and stop release only the intended retained sessions exactly once.
  - Test: `reopens one Project without closing another and releases every session once` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: concrete open/close commands cross `MessageChannel`; opening A and B retains both; reopening A closes only A1 and retains A2; closing A twice closes A2 once and leaves B open; stopping twice closes B once and stops the registry once.
  - Expected red: Slice 3 retains no Project session map.
- **Behavior**: Shutdown releases retained Project sessions by open admission order, not reverse completion or Map insertion order.
  - Test: `releases retained sessions by admission after opens complete in reverse` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: Project A is admitted first and Project B second; B resolves and is retained before A. Stop still calls releases exactly in `[A, B]` order, calls each once, then stops the registry once.
  - Expected red: retained sessions are plain Map values inserted on open completion, so reverse completion produces shutdown order `[B, A]`.
- **Behavior**: Async shutdown drains every admitted operation, attempts every independent release, and shares one deterministic rejection.
  - Tests: `reports every session and registry failure through one shared stop promise`; `drains a pending open and aggregates its late release failure before registry stop`; `stops create after $boundary without crossing the next durable boundary`; `drains an already-admitted deferred close before registry shutdown` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: every `open`, `create`, and `close` admitted before stop is tracked by admission sequence and settles before remaining sessions or registry are closed; representative coverage is explicit for a deferred open, every durable create boundary, and a deferred close. With two retained sessions where A throws on close and B succeeds, plus a registry stop that throws, repeated stop calls return one Promise; awaiting it proves A, B, and registry each ran once and rejects with one `AggregateError` whose message is `Project Storage shutdown failed.` and whose ordered errors are the session failure followed by the registry failure; operations submitted after stopped return unavailable and are not tracked.
  - Expected red: shutdown does not track all admitted operation families, cannot await the complete operation drain, and hands delayed failures to a later same-owner call.
- **Behavior**: Stop waits for an already-admitted deferred close without deadlocking or closing registry authority early.
  - Test: `drains an already-admitted deferred close before registry shutdown` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: after Project A opens, its close is admitted and held at the Project-operation seam; calling the retained async stop twice returns the same Promise, leaves both close and stop pending, leaves the session unreleased, and keeps registry stop at zero. Releasing the seam makes the close settle exactly once as correlated `unavailable/PROJECT_STORAGE_UNAVAILABLE`, then releases the retained session once, stops the registry once, and resolves the original stop Promise without deadlock. Session release succeeds in this test to isolate drain ordering, so no shutdown aggregate is expected.
  - Expected red: stop does not await admitted closes and can stop the registry while the deferred close still owns the Project-operation seam.
- **Behavior**: Stop fences every representative in-flight create boundary and drains registry shutdown after the installation-wide lock.
  - Test: `stops create after $boundary without crossing the next durable boundary` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: each case sends a concrete `project.create` through `MessageChannel`, blocks the named dependency after it starts, calls `stop()` without awaiting it, proves the stop Promise is pending and registry stop is still zero, and proves immediate create/open/close calls through the same `ProjectStorageApplication` return unavailable without entering a lock, inspection, or session mutation. Releasing the dependency yields correlated `unavailable/PROJECT_STORAGE_UNAVAILABLE`; awaiting the same stop Promise then proves registry stop occurs exactly once only after the create lock exits. Every later-boundary mutation counter remains zero after stop. A fresh owner retry sees `blocked/prior-state-witness` with the same request for every pre-activation case, while the activation case returns the original active replay with the same four public identities; no case cleans, resumes, copies, or allocates replacement output.

| Held create await | Permitted atomic completion | First forbidden boundary | Retry-visible witness/result |
|---|---|---|---|
| `declareStaging` | staging rows commit | Project namespace creation | staging rows; `blocked/prior-state-witness` |
| `createCanonical` | canonical database build closes | runtime database build | canonical bytes plus staging rows; `blocked/prior-state-witness` |
| `createRuntime` | runtime database build closes | baseline size/hash | both database files plus staging rows; `blocked/prior-state-witness` |
| baseline size/hash | all four observations finish | manifest write | both closed databases plus staging rows; `blocked/prior-state-witness` |
| manifest write | exclusive write finishes | staged verification | staged triplet; `blocked/prior-state-witness` |
| staged `verifySealed` | verification finishes | generation rename | verified staged triplet; `blocked/prior-state-witness` |
| generation rename | atomic rename finishes | renamed verification | final directory with staging rows/null active pointers; `blocked/prior-state-witness` |
| active `verifySealed` | verification finishes | activation transaction | verified final directory with staging rows/null active pointers; `blocked/prior-state-witness` |
| `activate` | activation transaction commits | created result | active/committed rows and agreeing pointers; exact `created` replay |

  - Expected red: creation currently checks lifecycle only before entering its Project lock and registry stop can close `application.db` while create still owns the installation lock.
- **Behavior**: Registry-close failure after create-lock drain rejects the original retained stop Promise.
  - Test: `rejects the retained stop promise when registry shutdown fails after create drain` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: with create paused in `declareStaging` and registry stop configured to throw, `stop()` closes admission immediately and returns a pending Promise; after declaration commits, create returns unavailable/PROJECT_STORAGE_UNAVAILABLE, registry stop runs once after the create lock exits, and the original plus repeated stop call are the same Promise rejecting with one `AggregateError` whose message is `Project Storage shutdown failed.` and whose sole error is the registry failure.
  - Expected red: shutdown cannot be observed as one awaitable operation and delayed registry failure is stored for a later same-owner call.
- **Behavior**: Opening release uses fixed client slots and attempts canonical then runtime once.
  - Test: `releases canonical then runtime regardless of probe completion order` -> `apps/harness/src/storage/project-storage-node-adapters.test.ts`
  - Oracle: even when the release fixture is initialized runtime-first, two throwing clients are called exactly in `[canonical, runtime]` order; the first release throws one `AggregateError` with exact message `Project Storage database release failed.` and errors `[canonicalFailure, runtimeFailure]`; a repeated release is a no-op and retries neither client.
  - Expected red: recursive `finally` cleanup reaches every client but exposes only one thrown close failure instead of aggregating all failures.
- **Behavior**: Both application-client acquisition paths retain before initialization and close a failed candidate exactly once.
  - Tests: `retains then closes a failing %s application client exactly once`; `preserves application initialization and close failures in order` -> `apps/harness/src/storage/project-storage-node-adapters.test.ts`; `normalizes %s application initialization failure at the owner boundary` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: existing and mutable acquisition each publish the candidate before the injected foreign-key initializer runs, clear retention and close once when initialization fails, and rethrow that original failure when close succeeds. If close also throws, one path-free `AggregateError` has exact message `Project Storage application client initialization failed.` and ordered errors `[initializationFailure, closeFailure]`; the public owner result is exactly `broken/PROJECT_STORAGE_OWNER_FAILED/Project Storage owner failed.` with no caught text or path.
  - Expected red: both helpers retain only after `requireForeignKeys`, so initialization failure leaks an unclosed client and dual failure cannot preserve deterministic ownership.
- **Behavior**: Concurrent Projects share one application-client initialization, while failure clears only that attempt and leaves retry ownership exact.
  - Tests: `shares one deferred application-client initialization across Projects`; `clears only the failed shared initialization and retries once` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: concurrent inspections for two Project IDs reach one deferred initializer and retain one client; neither selected-session release nor operation completion closes it, while registry stop closes it once. When that shared initializer fails, both calls reject with path-free `Project Storage application authority is invalid.`, the single failed candidate closes once, a later inspection runs initializer attempt `2`, and registry stop closes only that successful retained candidate once without retrying the failed close.
  - Expected red: concurrent Project inspections can initialize separate application clients, and a failed initializer has no identity-checked Promise slot that safely permits one later retry.
- **Behavior**: A candidate completing after stop cannot resurrect a session.
  - Test: `releases a late opening candidate when stop wins the race` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: a concrete open command crosses `MessageChannel`; stop while inspection is pending makes its correlated result unavailable/PROJECT_STORAGE_UNAVAILABLE, invokes the late candidate release exactly once, and retains no session.
  - Expected red: no opening lifecycle race exists yet.
- **Behavior**: A late opening release failure belongs to the original operation and the original stop Promise.
  - Test: `drains a pending open and aggregates its late release failure before registry stop` -> `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
  - Oracle: after a concrete open is admitted and inspection blocks, stop remains pending and registry stop remains zero; resolving inspection with a candidate whose release throws returns `broken/PROJECT_STORAGE_OWNER_FAILED` with exact message `Project Storage opening release failed.`, then the retained stop rejects with `AggregateError("Project Storage shutdown failed.")` whose errors equal `[lateReleaseFailure]`; release and registry stop each run once and no path is exposed.
  - Expected red: stop does not await admitted opens or retain a late candidate-release failure in its shutdown collection.

### Success Criteria:

#### Automated Verification:

- [ ] Every Test Contract behavior's exact Expected red is observed and recorded from its named public-seam test before implementation begins.
- [ ] Real libSQL opening matrix passes through structured clone: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-open.integration.test.ts`
- [ ] Session lifecycle passes through structured clone: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
- [ ] Pure opening and aggregate-release contracts pass: `pnpm exec vitest run apps/harness/src/storage/project-storage-opening.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts`
- [ ] Store creation/witness unit regressions remain green after removing the transitional no-opening test: `pnpm exec vitest run apps/harness/src/storage/project-storage-store.test.ts`
- [ ] Creation regressions remain green: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts`
- [ ] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [ ] Package dependency boundaries remain valid: `pnpm check:boundaries`
- [ ] Architecture model remains valid: `pnpm check:architecture`
- [ ] A separate Phase 4 review/refactor gate records no unresolved blocker before Phase 5.

#### Manual Verification:

- [ ] Inspect the opening chain and confirm it resolves only the registered active generation, never follows symlinks, selects an older generation, creates an absent `application.db`, migrates, repairs, deletes, or compares mutable database bytes with activation baselines.
- [ ] Inspect the runtime probe and confirm it reads only SlopStop-owned adapter metadata/identity plus SQLite FK/integrity facts, never Mastra-private schema.
- [ ] Confirm only `SQLITE_CORRUPT` and `SQLITE_NOTADB` map to corrupt, while every unexpected probe failure maps to the stable broken diagnostic without caught text or paths.
- [ ] Inspect the store surface and confirm safe-mode retains only opaque release handles and exposes no mutation method or libSQL/Drizzle client.
- [ ] Confirm every admitted open/create/close settles before final cleanup; every open/reopen/close/stop path releases each successfully opened client once; canonical release precedes runtime release; late-release, retained-session, and registry failures are attempted-all and ordered; async stop settles only after operation/create drain and registry close; and no Project operation closes another Project's session.
- [ ] Confirm the selected active generation has exactly one matching ordinary directory and no root-level database/sidecar witness before manifest or database probing begins.
- [ ] Confirm application opening authority and integrity checks complete before `inspectRegistryOpening` can return selected, recovery-required, or not-registered, so authority unavailable/broken/corrupt always wins without mutation or path disclosure.

---

## Phase 5: Electron Main Bridge And Trusted Bootstrap

### Overview

Add strict trusted bootstrap roots, stage checked-in generated migrations for development before real persistent harness process composition, add the Electron main Project Storage bridge and supervisor forwarding, and retain idempotent bridge/supervisor shutdown without renderer exposure.

### Changes Required:

#### 1. Trusted Bootstrap Protocol
**File**: `packages/protocol/src/protocol.ts`
**Changes**: Extend bootstrap with strict plain local file URLs for application Storage and migration resources.

```ts
const LocalFileUrlSchema = z.url().superRefine((value, context) => {
  const url = new URL(value);
  if (
    url.protocol !== "file:" ||
    url.hostname !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    context.addIssue({
      code: "custom",
      message: "Harness bootstrap roots must be plain local file URLs.",
    });
  }
});

export const HarnessBootstrapSchema = z.strictObject({
  kind: z.literal("harness.connect"),
  applicationStorageRootUrl: LocalFileUrlSchema,
  migrationResourcesRootUrl: LocalFileUrlSchema,
});
export type HarnessBootstrap = z.infer<typeof HarnessBootstrapSchema>;
```

#### 2. Trusted Bootstrap Protocol Tests
**File**: `packages/protocol/src/protocol.test.ts`
**Changes**: Prove acceptance of plain local file URLs and rejection of network, query, fragment, malformed, missing, and extra bootstrap values.

Merge `HarnessBootstrapSchema` into the existing retained `./index.js` value import from Phase 2. The actionable delta is only the added specifier below; do not add a duplicate import block or leave a second/unused binding:

```ts
import {
  createProjectCloseCommand,
  createProjectCloseResultEvent,
  createProjectCreateCommand,
  createProjectCreateResultEvent,
  createProjectOpenCommand,
  createProjectOpenResultEvent,
  HarnessBootstrapSchema,
  ProjectIdSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "./index.js";
```

```ts
it("accepts only plain local file URLs as trusted harness roots", () => {
  expect(
    HarnessBootstrapSchema.parse({
      kind: "harness.connect",
      applicationStorageRootUrl: "file:///C:/Users/example/AppData/SlopStop/storage",
      migrationResourcesRootUrl: "file:///C:/Program%20Files/SlopStop/harness-migrations",
    }),
  ).toBeDefined();

  for (const invalid of [
    { applicationStorageRootUrl: "https://example.invalid/storage" },
    { applicationStorageRootUrl: "file://server/share/storage" },
    { migrationResourcesRootUrl: "file:///C:/migrations?version=1" },
    { applicationStorageRootUrl: "file:///C:/storage#fragment" },
    { migrationResourcesRootUrl: "not-a-url" },
  ]) {
    expect(
      HarnessBootstrapSchema.safeParse({
        kind: "harness.connect",
        applicationStorageRootUrl: "file:///C:/storage",
        migrationResourcesRootUrl: "file:///C:/migrations",
        ...invalid,
      }).success,
    ).toBe(false);
  }
  expect(HarnessBootstrapSchema.safeParse({ kind: "harness.connect" }).success).toBe(false);
  expect(
    HarnessBootstrapSchema.safeParse({
      kind: "harness.connect",
      applicationStorageRootUrl: "file:///C:/storage",
      migrationResourcesRootUrl: "file:///C:/migrations",
      unexpected: true,
    }).success,
  ).toBe(false);
});
```

#### 3. Bootstrap Protocol Exports
**File**: `packages/protocol/src/index.ts`
**Changes**: Export the validated harness bootstrap schema and inferred type.

```ts
export { HarnessBootstrapSchema } from "./protocol.js";
export type { HarnessBootstrap } from "./protocol.js";
```

#### 3a. Development Migration Resource Staging
**File**: `apps/desktop/vite.harness.config.ts`
**Changes**: Before persistent Desktop composition is run, extend the existing harness Vite build with one staging plugin that removes stale migration output and copies the checked-in generated resources byte-for-byte to the development bootstrap root. Do not externalize or stage native dependencies in Phase 5.

```ts
import { cp, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];
const migrationSource = fileURLToPath(new URL("../harness/drizzle", import.meta.url));
const migrationOutput = fileURLToPath(
  new URL("./.vite/build/harness-migrations", import.meta.url),
);

function stageHarnessRuntime(): Plugin {
  return {
    name: "stage-harness-runtime",
    async closeBundle() {
      await rm(migrationOutput, { recursive: true, force: true });
      await cp(migrationSource, migrationOutput, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [stageHarnessRuntime()],
  build: {
    lib: {
      entry: { harness: "../harness/src/process-entry.ts" },
      fileName: () => "harness.cjs",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: nodeBuiltins,
    },
  },
});
```

The copy preserves every checked-in SQL/journal relative path and byte. Phase 5 does not generate or apply migrations, externalize `libsql`, create `.vite/build/node_modules`, or stage a native package. This delta lands before §4 process composition and before §16 runs the development bootstrap whose `mainBundleDirectory` resolves to `.vite/build`.

#### 4. Harness Process Composition
**File**: `apps/harness/src/process-bootstrap.ts`
**Changes**: Parse trusted roots, convert file URLs, reject overlapping roots, compose Node persistence dependencies and the real Project Storage owner, and start the runtime.

```ts
import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessBootstrapSchema } from "@slopstop/protocol";
import type { HarnessTransport, StopHarnessRuntime } from "./harness-runtime.js";
import { startHarnessRuntime } from "./harness-runtime.js";
import { createProjectStorageApplication } from "./project-storage-application.js";
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";
import { createNodeProjectStorageDependencies } from "./storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "./storage/project-storage-store.js";

function physicalRoot(root: string): string {
  const missingSegments: string[] = [];
  let cursor = root;
  for (;;) {
    try {
      const entry = lstatSync(cursor);
      if (entry.isSymbolicLink()) {
        throw new Error("Harness bootstrap root must not be a symbolic link.");
      }
      return path.join(realpathSync.native(cursor), ...missingSegments.reverse());
    } catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        throw new Error("Harness bootstrap root has no existing ancestor.");
      }
      missingSegments.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

function trustedRoot(value: string): string {
  const root = path.resolve(fileURLToPath(value));
  if (!path.isAbsolute(root)) {
    throw new Error("Harness bootstrap root must resolve absolutely.");
  }
  return physicalRoot(root);
}

function rootsOverlap(first: string, second: string): boolean {
  const relative = path.relative(first, second);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function startHarnessProcessRuntime(input: Readonly<{
  bootstrap: unknown;
  transport: HarnessTransport;
}>): StopHarnessRuntime {
  const bootstrap = HarnessBootstrapSchema.parse(input.bootstrap);
  const applicationStorageRoot = trustedRoot(bootstrap.applicationStorageRootUrl);
  const migrationResourcesRoot = trustedRoot(bootstrap.migrationResourcesRootUrl);
  if (
    rootsOverlap(applicationStorageRoot, migrationResourcesRoot) ||
    rootsOverlap(migrationResourcesRoot, applicationStorageRoot)
  ) {
    throw new Error("Harness bootstrap roots must not overlap.");
  }
  const projectStorageOwner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot,
      migrationResourcesRoot,
      applicationVersion: "0.0.0",
    }),
  );

  return startHarnessRuntime({
    transport: input.transport,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: createProjectStorageApplication(projectStorageOwner),
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now: () => new Date().toISOString(),
  });
}
```

#### 5. Utility-Process Entry Composition
**File**: `apps/harness/src/process-entry.ts`
**Changes**: Delegate validated production composition to `startHarnessProcessRuntime`; on message-port close, observe the complete retained shutdown Promise and convert rejection to one generic log plus non-zero process exit without exposing internal paths.

```ts
import { startHarnessProcessRuntime } from "./process-bootstrap.js";
import type { StopHarnessRuntime } from "./harness-runtime.js";
import { createHarnessPortCloseHandler } from "./process-shutdown.js";

function failShutdown(message: "Harness shutdown failed."): never {
  logger.fatal({ code: "HARNESS_SHUTDOWN_FAILED" }, message);
  process.exit(1);
}

parentPort.once("message", (event) => {
  const port = event.ports[0];
  if (port === undefined) {
    failStartup("Harness received an invalid bootstrap message.");
  }
  let stopRuntime: StopHarnessRuntime;
  try {
    stopRuntime = startHarnessProcessRuntime({
      bootstrap: event.data,
      transport: createTransport(port),
    });
  } catch {
    failStartup("Harness received an invalid bootstrap message.");
  }

  port.on(
    "close",
    createHarnessPortCloseHandler({
      stopRuntime,
      succeeded: (message) => logger.info(message),
      failed: failShutdown,
    }),
  );
  port.start();
  logger.info("Harness message port connected.");
});
```

#### 6. Process Bootstrap Integration
**File**: `apps/harness/tests/integration/process-bootstrap.integration.test.ts`
**Changes**: Prove not-registered/create/open/close and awaited runtime shutdown through validated roots, and reject overlapping roots before persistence mutation.

```ts
it("composes persistent Project Storage from validated trusted roots", async () => {
  const applicationStorageRoot = await createTemporaryApplicationRoot();
  const session = createProcessTransportFixture();
  const stop = startHarnessProcessRuntime({
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(applicationStorageRoot).href,
      migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
    },
    transport: session.transport,
  });

  await session.handshake();
  await expect(session.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "not-registered", request: openRequest },
  });
  await expect(session.create(createRequest)).resolves.toMatchObject({
    event: "project.create.result",
    payload: { status: "created", request: createRequest, mode: "read-write" },
  });
  await expect(session.open(openRequest)).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "opened",
      request: openRequest,
      mode: "read-write",
      canonicalHealth: { status: "healthy" },
      runtimeHealth: { status: "healthy" },
    },
  });
  await expect(session.close(closeRequest)).resolves.toMatchObject({
    event: "project.close.result",
    payload: { status: "closed", request: closeRequest },
  });
  await stop();
  expect(JSON.stringify(session.received)).not.toContain(applicationStorageRoot);
});

it("rejects overlapping bootstrap roots before starting the runtime", async () => {
  const root = await createTemporaryApplicationRoot();
  expect(() =>
    startHarnessProcessRuntime({
      bootstrap: {
        kind: "harness.connect",
        applicationStorageRootUrl: pathToFileURL(root).href,
        migrationResourcesRootUrl: pathToFileURL(path.join(root, "migrations")).href,
      },
      transport: createProcessTransportFixture().transport,
    }),
  ).toThrow("Harness bootstrap roots must not overlap.");
  expect(await pathExists(path.join(root, "application.db"))).toBe(false);
});
```

#### 7. Shared Harness Send-Failure Vocabulary
**File**: `apps/desktop/src/main/harness-send-failure.ts`
**Changes**: Extract the exact existing harness-session send failure messages for reuse by both bridges.

```ts
import type { HarnessSessionSendResult } from "./harness-session.js";

export function harnessSendFailureMessage(
  result: Exclude<HarnessSessionSendResult, { ok: true }>,
): string {
  switch (result.error.code) {
    case "HARNESS_SESSION_UNAVAILABLE":
      return "Harness session is unavailable.";
    case "HARNESS_SESSION_MESSAGE_INVALID":
      return "Desktop created an invalid harness message.";
    case "HARNESS_SESSION_SEND_FAILED":
      return "Harness session send failed.";
  }
}
```

#### 8. Workspace Bridge Shared Failure Consumer
**File**: `apps/desktop/src/main/workspace-bridge.ts`
**Changes**: Replace the private send-failure mapping with the shared sibling owner without changing behavior or public surface.

The existing bridge imports `harnessSendFailureMessage` from the shared sibling owner and deletes its private `sendFailureMessage` copy. Its behavior and public surface remain unchanged, and the existing exact-message tests stay green.

#### 9. Workspace Bridge Regression Tests
**File**: `apps/desktop/src/main/workspace-bridge.test.ts`
**Changes**: Keep existing exact-message and Workspace bridge behavior green after the shared vocabulary extraction.

#### 10. Electron Main Project Storage Bridge
**File**: `apps/desktop/src/main/project-storage-bridge.ts`
**Changes**: Correlate open/create/close through `HarnessSessionClient`, revalidate echoed requests, and convert local/session/protocol failures to stable Storage transport failures.

```ts
import { isDeepStrictEqual } from "node:util";
import {
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  type DesktopMessage,
  type ProjectStorageCloseRequest,
  type ProjectStorageCloseResult,
  ProjectStorageCloseResultSchema,
  type ProjectStorageCreateRequest,
  type ProjectStorageCreateResult,
  ProjectStorageCreateResultSchema,
  type ProjectStorageOpenRequest,
  type ProjectStorageOpenResult,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { harnessSendFailureMessage } from "./harness-send-failure.js";
import type {
  HarnessSessionClient,
  HarnessSessionEvent,
} from "./harness-session.js";

type PendingOpen = Readonly<{
  kind: "open";
  request: ProjectStorageOpenRequest;
  resolve(result: ProjectStorageOpenResult): void;
}>;
type PendingCreate = Readonly<{
  kind: "create";
  request: ProjectStorageCreateRequest;
  resolve(result: ProjectStorageCreateResult): void;
}>;
type PendingClose = Readonly<{
  kind: "close";
  request: ProjectStorageCloseRequest;
  resolve(result: ProjectStorageCloseResult): void;
}>;
type PendingOperation = PendingOpen | PendingCreate | PendingClose;

type ProjectStorageBridgeOptions = Readonly<{
  session: HarnessSessionClient;
  createId(): string;
  now(): string;
}>;

function brokenOpen(
  request: ProjectStorageOpenRequest,
  message: string,
): ProjectStorageOpenResult {
  return ProjectStorageOpenResultSchema.parse({
    status: "broken",
    request,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

function brokenCreate(
  request: ProjectStorageCreateRequest,
  message: string,
): ProjectStorageCreateResult {
  return ProjectStorageCreateResultSchema.parse({
    status: "broken",
    request,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

function brokenClose(
  request: ProjectStorageCloseRequest,
  message: string,
): ProjectStorageCloseResult {
  return ProjectStorageCloseResultSchema.parse({
    status: "broken",
    request,
    diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message },
  });
}

export interface ProjectStorageBridgeClient {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult>;
  stop(): void;
}

class ProjectStorageBridge implements ProjectStorageBridgeClient {
  readonly #createId: () => string;
  readonly #now: () => string;
  readonly #pending = new Map<string, PendingOperation>();
  readonly #session: HarnessSessionClient;
  readonly #stopSessionSubscription: () => void;
  #stopped = false;

  constructor(options: ProjectStorageBridgeOptions) {
    this.#createId = options.createId;
    this.#now = options.now;
    this.#session = options.session;
    this.#stopSessionSubscription = this.#session.subscribe((event) => {
      this.#handleSessionEvent(event);
    });
  }

  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOpenResult> {
    return this.#request(
      () => createProjectOpenCommand(this.#metadata(), request),
      (resolve) => ({ kind: "open", request, resolve }),
      (message) => brokenOpen(request, message),
    );
  }

  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageCreateResult> {
    return this.#request(
      () => createProjectCreateCommand(this.#metadata(), request),
      (resolve) => ({ kind: "create", request, resolve }),
      (message) => brokenCreate(request, message),
    );
  }

  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageCloseResult> {
    return this.#request(
      () => createProjectCloseCommand(this.#metadata(), request),
      (resolve) => ({ kind: "close", request, resolve }),
      (message) => brokenClose(request, message),
    );
  }

  stop(): void {
    if (this.#stopped) {
      return;
    }
    this.#stopped = true;
    this.#stopSessionSubscription();
    this.#failAll("Project Storage bridge is stopped.");
  }

  #metadata(): Readonly<{ messageId: string; sentAt: string }> {
    return { messageId: this.#createId(), sentAt: this.#now() };
  }

  #request<Result>(
    createCommand: () => DesktopMessage,
    createPending: (resolve: (result: Result) => void) => PendingOperation,
    broken: (message: string) => Result,
  ): Promise<Result> {
    if (this.#stopped) {
      return Promise.resolve(broken("Project Storage bridge is stopped."));
    }
    let command: DesktopMessage;
    try {
      command = createCommand();
    } catch {
      return Promise.resolve(broken("Desktop created an invalid harness message."));
    }
    return new Promise((resolve) => {
      if (this.#pending.has(command.messageId)) {
        resolve(broken("Harness request identity collided."));
        return;
      }
      this.#pending.set(command.messageId, createPending(resolve));
      const sent = this.#session.send(command);
      if (!sent.ok) {
        this.#pending.delete(command.messageId);
        resolve(broken(harnessSendFailureMessage(sent)));
      }
    });
  }

  #handleSessionEvent(event: HarnessSessionEvent): void {
    switch (event.type) {
      case "disconnected":
        this.#failAll("Harness session disconnected.");
        return;
      case "protocol-error":
        this.#failAll("Harness session received an invalid protocol message.");
        return;
      case "message":
        this.#handleHarnessMessage(event.message);
    }
  }

  #handleHarnessMessage(message: Extract<HarnessSessionEvent, { type: "message" }>["message"]): void {
    switch (message.event) {
      case "system.failure":
        this.#failAll("Harness reported a failure.");
        return;
      case "project.open.result":
        this.#settleOpen(message.causationId, message.payload);
        return;
      case "project.create.result":
        this.#settleCreate(message.causationId, message.payload);
        return;
      case "project.close.result":
        this.#settleClose(message.causationId, message.payload);
        return;
      case "system.ready":
      case "workspace.intent.result":
      case "workspace.projection.invalidated":
      case "workspace.query.result":
        return;
    }
  }

  #settleOpen(causationId: string | null, value: unknown): void {
    const pending = this.#take(causationId, "open");
    if (pending?.kind !== "open") return;
    const result = ProjectStorageOpenResultSchema.parse(value);
    pending.resolve(
      isDeepStrictEqual(result.request, pending.request)
        ? result
        : brokenOpen(pending.request, "Harness returned a mismatched Project Storage request."),
    );
  }

  #settleCreate(causationId: string | null, value: unknown): void {
    const pending = this.#take(causationId, "create");
    if (pending?.kind !== "create") return;
    const result = ProjectStorageCreateResultSchema.parse(value);
    pending.resolve(
      isDeepStrictEqual(result.request, pending.request)
        ? result
        : brokenCreate(pending.request, "Harness returned a mismatched Project Storage request."),
    );
  }

  #settleClose(causationId: string | null, value: unknown): void {
    const pending = this.#take(causationId, "close");
    if (pending?.kind !== "close") return;
    const result = ProjectStorageCloseResultSchema.parse(value);
    pending.resolve(
      isDeepStrictEqual(result.request, pending.request)
        ? result
        : brokenClose(pending.request, "Harness returned a mismatched Project Storage request."),
    );
  }

  #take(
    causationId: string | null,
    expected: PendingOperation["kind"],
  ): PendingOperation | undefined {
    if (causationId === null) {
      this.#failAll("Harness returned an uncorrelated Project Storage response.");
      return undefined;
    }
    const pending = this.#pending.get(causationId);
    if (pending === undefined) {
      return undefined;
    }
    this.#pending.delete(causationId);
    if (pending.kind !== expected) {
      this.#fail(pending, "Harness returned a mismatched Project Storage response.");
      return undefined;
    }
    return pending;
  }

  #failAll(message: string): void {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const operation of pending) {
      this.#fail(operation, message);
    }
  }

  #fail(operation: PendingOperation, message: string): void {
    switch (operation.kind) {
      case "open":
        operation.resolve(brokenOpen(operation.request, message));
        return;
      case "create":
        operation.resolve(brokenCreate(operation.request, message));
        return;
      case "close":
        operation.resolve(brokenClose(operation.request, message));
    }
  }
}

export function createProjectStorageBridge(
  options: ProjectStorageBridgeOptions,
): ProjectStorageBridgeClient {
  return new ProjectStorageBridge(options);
}
```

#### 11. Project Storage Bridge Tests
**File**: `apps/desktop/src/main/project-storage-bridge.test.ts`
**Changes**: Prove out-of-order correlation, all send failures, mismatches, uncorrelated responses, disconnect, protocol/system failure, invalid metadata, ID collision, and idempotent stop.

```ts
it("correlates out-of-order open, create, and close results", async () => {
  const session = new FakeHarnessSession();
  const bridge = bridgeWith(session, [messageId(1), messageId(2), messageId(3)]);
  const open = bridge.open(openRequest);
  const create = bridge.create(createRequest);
  const close = bridge.close(closeRequest);

  session.emitProjectResult(messageId(3), closedResult);
  session.emitProjectResult(messageId(1), notRegisteredResult);
  session.emitProjectResult(messageId(2), createdResult);

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

  await expect(bridge.open(openRequest)).resolves.toEqual(
    transportBrokenOpenResult(message),
  );
  expect(session.pendingListenerCount).toBe(1);
});

it("rejects mismatched, uncorrelated, disconnected, and stopped requests", async () => {
  const mismatchSession = new FakeHarnessSession();
  const mismatchBridge = bridgeWith(mismatchSession, [messageId(1)]);
  const mismatch = mismatchBridge.open(openRequest);
  mismatchSession.emitProjectResult(messageId(1), {
    ...notRegisteredResult,
    request: otherOpenRequest,
  });
  await expect(mismatch).resolves.toEqual(
    transportBrokenOpenResult("Harness returned a mismatched Project Storage request."),
  );

  const kindSession = new FakeHarnessSession();
  const kindBridge = bridgeWith(kindSession, [messageId(20)]);
  const wrongKind = kindBridge.open(openRequest);
  kindSession.emitProjectResult(messageId(20), createdResult);
  await expect(wrongKind).resolves.toEqual(
    transportBrokenOpenResult("Harness returned a mismatched Project Storage response."),
  );

  const pendingSession = new FakeHarnessSession();
  const pendingBridge = bridgeWith(pendingSession, [messageId(2), messageId(3)]);
  const uncorrelated = pendingBridge.create(createRequest);
  pendingSession.emitProjectResult(null, createdResult);
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
  [{ type: "message", message: systemFailureEvent("sensitive raw failure") }, "Harness reported a failure."],
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
  collisionSession.emitProjectResult(messageId(40), notRegisteredResult);
  await expect(original).resolves.toEqual(notRegisteredResult);
});
```

#### 12. Trusted Root Derivation
**File**: `apps/desktop/src/main/project-storage-bootstrap.ts`
**Changes**: Derive development/package migration roots and convert private `userData` Storage plus migration roots to validated file URLs.

```ts
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  type HarnessBootstrap,
  HarnessBootstrapSchema,
} from "@slopstop/protocol";

export function projectStorageMigrationResourcesRoot(input: Readonly<{
  isPackaged: boolean;
  resourcesPath: string;
  mainBundleDirectory: string;
}>): string {
  return input.isPackaged
    ? path.join(input.resourcesPath, "harness-migrations")
    : path.join(input.mainBundleDirectory, "harness-migrations");
}

export function createProjectStorageHarnessBootstrap(input: Readonly<{
  userDataRoot: string;
  migrationResourcesRoot: string;
}>): HarnessBootstrap {
  return HarnessBootstrapSchema.parse({
    kind: "harness.connect",
    applicationStorageRootUrl: pathToFileURL(
      path.join(input.userDataRoot, "storage"),
    ).href,
    migrationResourcesRootUrl: pathToFileURL(input.migrationResourcesRoot).href,
  });
}
```

#### 13. Trusted Root Derivation Tests
**File**: `apps/desktop/src/main/project-storage-bootstrap.test.ts`
**Changes**: Prove private Storage and exact development/package migration-resource roots without hand-built URLs.

```ts
it("derives private Storage and development/package migration roots", () => {
  const developmentMigrations = projectStorageMigrationResourcesRoot({
    isPackaged: false,
    resourcesPath: "C:/installed/resources",
    mainBundleDirectory: "C:/repo/.vite/build",
  });
  const packagedMigrations = projectStorageMigrationResourcesRoot({
    isPackaged: true,
    resourcesPath: "C:/installed/resources",
    mainBundleDirectory: "C:/repo/.vite/build",
  });

  expect(developmentMigrations).toBe(path.join("C:/repo/.vite/build", "harness-migrations"));
  expect(packagedMigrations).toBe(path.join("C:/installed/resources", "harness-migrations"));
  expect(
    createProjectStorageHarnessBootstrap({
      userDataRoot: "C:/Users/example/AppData/SlopStop",
      migrationResourcesRoot: packagedMigrations,
    }),
  ).toEqual({
    kind: "harness.connect",
    applicationStorageRootUrl: pathToFileURL(
      path.join("C:/Users/example/AppData/SlopStop", "storage"),
    ).href,
    migrationResourcesRootUrl: pathToFileURL(packagedMigrations).href,
  });
});
```

#### 14. Harness Supervisor Bootstrap Forwarding
**File**: `apps/desktop/src/main/harness-supervisor.ts`
**Changes**: Store one parsed bootstrap, send it to every child before handshake, and forward Project Storage results without changing supervisor state.

```ts
import {
  type HarnessBootstrap,
  HarnessBootstrapSchema,
} from "@slopstop/protocol";

const harnessShutdownGraceMs = 5_000;

export class HarnessSupervisor {
  readonly #bootstrap: HarnessBootstrap;
  #stopPromise: Promise<void> | undefined;

  constructor(entryPath: string, logger: Logger, bootstrap: HarnessBootstrap) {
    this.#entryPath = entryPath;
    this.#logger = logger;
    this.#bootstrap = HarnessBootstrapSchema.parse(bootstrap);
    this.#session.subscribe((event) => {
      this.#handleSessionEvent(event);
    });
  }

  start(): void {
    if (
      this.#child !== undefined ||
      this.#restartTimer !== undefined ||
      this.#stopping
    ) {
      return;
    }
    this.#stopPromise = undefined;
    this.#spawn();
  }

  stop(): Promise<void> {
    if (this.#stopPromise !== undefined) {
      return this.#stopPromise;
    }
    this.#stopping = true;
    this.#session.detach();
    this.#clearTimers();
    const child = this.#child;
    if (child === undefined) {
      this.#setStatus({ state: "stopped" });
      this.#stopping = false;
      this.#stopPromise = Promise.resolve();
      return this.#stopPromise;
    }
    this.#stopPromise = this.#stopChild(child);
    return this.#stopPromise;
  }

  #stopChild(child: UtilityProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      let killTimer: NodeJS.Timeout | undefined;
      const finish = (): void => {
        if (killTimer !== undefined) {
          clearTimeout(killTimer);
        }
        if (this.#child === child) {
          this.#child = undefined;
        }
        this.#setStatus({ state: "stopped" });
        this.#stopping = false;
        resolve();
      };
      child.once("exit", finish);
      killTimer = setTimeout(() => {
        child.kill();
      }, harnessShutdownGraceMs);
    });
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
      case "project.open.result":
      case "project.create.result":
      case "project.close.result":
      case "workspace.intent.result":
      case "workspace.projection.invalidated":
      case "workspace.query.result":
        return;
    }
  }

  #connectChild(child: UtilityProcess): void {
    const { port1, port2 } = new MessageChannelMain();
    this.#session.attach(port2);
    child.postMessage(this.#bootstrap, [port1]);
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
  }
}
```

This is a focused merge into the two existing methods, not a replacement of their surrounding behavior. In `#connectChild`, replace only the minimal parsed bootstrap value passed to the first `child.postMessage` with `this.#bootstrap`; retain port transfer, handshake send, send-failure blocking/logging/status/kill handling, and handshake timeout setup exactly as emitted above. In `#handleHarnessMessage`, merge the three Project Storage result cases into the existing switch after retaining the complete `system.ready` timeout/lifecycle branch and `system.failure` diagnostic/recovery/kill branch. The shared session continues to forward validated Workspace and Project result events before these health-ignored cases return; the existing `#handleSessionEvent` protocol-error behavior and exhaustiveness remain unchanged.

#### 15. Harness Supervisor Tests
**File**: `apps/desktop/src/main/harness-supervisor.test.ts`
**Changes**: Update the existing helper's sole direct supervisor construction for the required parsed bootstrap, preserve every existing behavior including ready/failure/protocol transitions, update the retained live stop test for awaited natural exit, split the combined timeout/spawn-failure test so its restart portion proves a completed-stop restart while focused synchronous spawn-failure coverage remains, and prove immutable bootstrap reuse, path-free logs, and Storage result forwarding without lifecycle ownership.

The live test file contains exactly one direct `new HarnessSupervisor(...)` construction, inside `supervisorWith`. Preserve the existing entry-path and logger dependencies, every existing test body, and every current protocol import; merge the schema value import, shared parsed fixture, and third constructor argument below. No non-null assertion or cast is introduced.

```ts
import {
  createProjectCloseResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
  HarnessBootstrapSchema,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";

const bootstrap = HarnessBootstrapSchema.parse({
  kind: "harness.connect",
  applicationStorageRootUrl: "file:///C:/Users/example/AppData/SlopStop/storage",
  migrationResourcesRootUrl: "file:///C:/app/harness-migrations",
});

const projectStorageProjectId = "00000000-0000-4000-8000-000000000101";
const projectStorageOpenRequest = ProjectStorageOpenRequestSchema.parse({
  projectId: projectStorageProjectId,
});
const projectStorageCreateRequest = ProjectStorageCreateRequestSchema.parse({
  projectId: projectStorageProjectId,
  createRequestId: "00000000-0000-4000-8000-000000000102",
});
const projectStorageCloseRequest = ProjectStorageCloseRequestSchema.parse({
  projectId: projectStorageProjectId,
});
const projectStorageUnavailable = {
  diagnostic: {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: "Project Storage owner is unavailable.",
  },
} as const;
const projectStorageResultEvents = [
  createProjectOpenResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000111",
      sentAt: "2026-08-31T12:00:00.000Z",
      sequence: 1,
      causationId: "00000000-0000-4000-8000-000000000121",
    },
    { status: "not-registered", request: projectStorageOpenRequest },
  ),
  createProjectCreateResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000112",
      sentAt: "2026-08-31T12:00:00.000Z",
      sequence: 2,
      causationId: "00000000-0000-4000-8000-000000000122",
    },
    {
      status: "unavailable",
      request: projectStorageCreateRequest,
      ...projectStorageUnavailable,
    },
  ),
  createProjectCloseResultEvent(
    {
      messageId: "00000000-0000-4000-8000-000000000113",
      sentAt: "2026-08-31T12:00:00.000Z",
      sequence: 3,
      causationId: "00000000-0000-4000-8000-000000000123",
    },
    {
      status: "unavailable",
      request: projectStorageCloseRequest,
      ...projectStorageUnavailable,
    },
  ),
] as const;

function supervisorWith(children: FakeChild[]): HarnessSupervisor {
  electronMocks.fork.mockImplementation(() => {
    const child = children.shift();
    if (child === undefined) {
      throw new Error("Test did not provide a child process.");
    }
    return child;
  });
  return new HarnessSupervisor("C:/app/harness.cjs", logger, bootstrap);
}

it("sends the same validated trusted roots to initial and retried harnesses", () => {
  vi.useFakeTimers();
  const first = new FakeChild();
  const retry = new FakeChild();
  const supervisor = supervisorWith([first, retry]);

  supervisor.start();
  first.emit("spawn");
  expect(first.postMessage).toHaveBeenCalledWith(bootstrap, [channels[0]?.port1]);
  first.emit("exit", 1);
  vi.advanceTimersByTime(250);
  retry.emit("spawn");
  expect(retry.postMessage).toHaveBeenCalledWith(bootstrap, [channels[1]?.port1]);
  const logs = JSON.stringify([
    ...vi.mocked(logger.info).mock.calls,
    ...vi.mocked(logger.error).mock.calls,
  ]);
  expect(logs).not.toContain(bootstrap.applicationStorageRootUrl);
  expect(logs).not.toContain(bootstrap.migrationResourcesRootUrl);
});

```

Update the retained live `connects once, accepts a ready handshake, forwards output, and stops cleanly` declaration to `async` and replace only its shutdown tail with the following assertions. Do not add a parallel natural-exit test:

```ts
  const lifecycle: string[] = [];
  channel?.port2.close.mockImplementation(() => {
    lifecycle.push("detach");
  });
  unsubscribe();
  const firstStop = supervisor.stop();
  const repeatedStop = supervisor.stop();

  expect(repeatedStop).toBe(firstStop);
  expect(channel?.port2.close).toHaveBeenCalledOnce();
  expect(lifecycle).toEqual(["detach"]);
  expect(child.kill).not.toHaveBeenCalled();
  expect(supervisor.getStatus()).toEqual({
    state: "ready",
    attempt: 1,
    harnessVersion: "0.0.0",
  });
  await vi.advanceTimersByTimeAsync(4_999);
  expect(child.kill).not.toHaveBeenCalled();

  lifecycle.push("exit");
  child.emit("exit", 0);
  await expect(firstStop).resolves.toBeUndefined();

  expect(lifecycle).toEqual(["detach", "exit"]);
  expect(child.kill).not.toHaveBeenCalled();
  expect(supervisor.getStatus()).toEqual({ state: "stopped" });
```

```ts

it("kills only after the shutdown grace period and still awaits exit", async () => {
  vi.useFakeTimers();
  const child = new FakeChild();
  const supervisor = supervisorWith([child]);
  supervisor.start();
  child.emit("spawn");

  const stop = supervisor.stop();
  await vi.advanceTimersByTimeAsync(4_999);
  expect(child.kill).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(child.kill).toHaveBeenCalledOnce();
  const detachOrder = channels[0]?.port2.close.mock.invocationCallOrder[0];
  const killOrder = child.kill.mock.invocationCallOrder[0];
  if (detachOrder === undefined || killOrder === undefined) {
    throw new Error("Expected detach and kill invocation order.");
  }
  expect(detachOrder).toBeLessThan(killOrder);
  let settled = false;
  const settlement = stop.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);

  child.emit("exit", 0);
  await expect(settlement).resolves.toBeUndefined();
  expect(settled).toBe(true);
});
```

Replace the retained restart portion of `reports handshake timeout and synchronous spawn failure as distinct states` with the completed-stop restart test below, and keep synchronous spawn failure coverage in the following focused test. Separately convert both stop calls in `cancels pending handshake and restart timers when stopped` to natural-exit awaited cleanup without changing its timer assertions:

```ts
it("reports handshake timeout and restarts safely after completed stop", async () => {
  vi.useFakeTimers();
  const firstChild = new FakeChild();
  const restartedChild = new FakeChild();
  const supervisor = supervisorWith([firstChild, restartedChild]);
  supervisor.start();
  firstChild.emit("spawn");
  await vi.advanceTimersByTimeAsync(5_000);
  expect(firstChild.kill).toHaveBeenCalledOnce();
  expect(supervisor.getStatus()).toMatchObject({
    state: "degraded",
    diagnostic: { code: "HARNESS_HANDSHAKE_TIMEOUT" },
  });
  expect(logger.error).toHaveBeenCalledWith({ attempt: 1 }, "Harness handshake timed out.");

  const previousStop = supervisor.stop();
  supervisor.start();
  expect(electronMocks.fork).toHaveBeenCalledTimes(1);
  firstChild.emit("exit", 0);
  await previousStop;

  supervisor.start();
  restartedChild.emit("spawn");
  expect(electronMocks.fork).toHaveBeenCalledTimes(2);
  const laterStop = supervisor.stop();
  expect(laterStop).not.toBe(previousStop);
  expect(channels[1]?.port2.close).toHaveBeenCalledOnce();
  expect(restartedChild.kill).not.toHaveBeenCalled();
  expect(supervisor.getStatus()).not.toEqual({ state: "stopped" });

  restartedChild.emit("exit", 0);
  await laterStop;
  expect(restartedChild.kill).not.toHaveBeenCalled();
  expect(supervisor.getStatus()).toEqual({ state: "stopped" });
});

it("reports synchronous spawn failure as a distinct state", () => {
  const forkError = new Error("fork failed");
  const supervisor = supervisorWith([]);
  electronMocks.fork.mockImplementation(() => {
    throw forkError;
  });

  supervisor.start();

  expect(supervisor.getStatus()).toMatchObject({
    state: "crashed",
    diagnostic: { code: "HARNESS_START_FAILED" },
  });
  expect(logger.error).toHaveBeenCalledWith(
    { error: forkError, attempt: 1 },
    "Harness process failed to start.",
  );
});
```

```ts

it("forwards Project Storage results without changing supervisor status", () => {
  const child = new FakeChild();
  const supervisor = supervisorWith([child]);
  const events: HarnessSessionEvent[] = [];
  supervisor.getSession().subscribe((event) => events.push(event));
  supervisor.start();
  child.emit("spawn");

  for (const message of projectStorageResultEvents) {
    channels[0]?.port2.emit("message", { data: message });
  }
  expect(events).toEqual(
    projectStorageResultEvents.map((message) => ({ type: "message", message })),
  );
  expect(supervisor.getStatus()).toEqual({ state: "starting", attempt: 1 });
});
```

Keep the retained `connects once, accepts a ready handshake, forwards output, and stops cleanly` assertions that a ready event clears the timeout and enters `ready`. Keep the retained `blocks automatic recovery for malformed and explicit protocol failures` assertions that explicit `system.failure` preserves the existing diagnostic/recovery-blocking child kill and malformed input preserves the distinct protocol-error path. The Project-result test supplements those tests; it does not replace or weaken either lifecycle regression.

#### 16. Retained Desktop Shutdown And Main Composition
**Files**: `apps/desktop/src/main/desktop-shutdown.ts`, `apps/desktop/src/main/desktop-shutdown.test.ts`, `apps/desktop/src/main/main.ts`
**Changes**: Derive trusted roots, construct supervisor and Project Storage bridge, and route normal quit plus every package-smoke/startup exit through one retained asynchronous shutdown chain. It stops Project Storage bridge, Workspace bridge, then awaits supervisor exit; repeated `before-quit` events are prevented while pending, and only the controller's post-stop `app.quit()` re-entry proceeds.

```ts
// desktop-shutdown.ts
export type DesktopBeforeQuitEvent = Readonly<{ preventDefault(): void }>;

export type DesktopShutdownController = Readonly<{
  stop(): Promise<void>;
  beforeQuit(event: DesktopBeforeQuitEvent): void;
  requestExit(code: number): Promise<void>;
}>;

export function createDesktopShutdown(options: Readonly<{
  stopProjectStorageBridge(): void;
  stopWorkspaceBridge(): void;
  stopHarness(): Promise<void>;
  quit(): void;
  exit(code: number): void;
}>): DesktopShutdownController {
  let stopPromise: Promise<void> | undefined;
  let exitPromise: Promise<void> | undefined;
  let quitPromise: Promise<void> | undefined;
  let allowQuit = false;

  const stop = (): Promise<void> => {
    if (stopPromise === undefined) {
      stopPromise = Promise.resolve().then(async () => {
        options.stopProjectStorageBridge();
        options.stopWorkspaceBridge();
        await options.stopHarness();
      });
    }
    return stopPromise;
  };

  const requestExit = (code: number): Promise<void> => {
    if (exitPromise === undefined) {
      exitPromise = stop().then(
        () => options.exit(code),
        () => options.exit(1),
      );
    }
    return exitPromise;
  };

  return {
    stop,
    beforeQuit: (event) => {
      if (allowQuit) {
        return;
      }
      event.preventDefault();
      if (quitPromise === undefined) {
        quitPromise = stop().then(
          () => {
            allowQuit = true;
            options.quit();
          },
          () => options.exit(1),
        );
      }
    },
    requestExit,
  };
}
```

```ts
// desktop-shutdown.test.ts
it("retains ordered shutdown and allows only the post-stop quit re-entry", async () => {
  const harnessStop = deferred<void>();
  const order: string[] = [];
  const quit = vi.fn();
  const exit = vi.fn();
  const shutdown = createDesktopShutdown({
    stopProjectStorageBridge: () => order.push("project-storage"),
    stopWorkspaceBridge: () => order.push("workspace"),
    stopHarness: () => {
      order.push("harness");
      return harnessStop.promise;
    },
    quit,
    exit,
  });
  const firstEvent = { preventDefault: vi.fn() };
  const repeatedEvent = { preventDefault: vi.fn() };

  shutdown.beforeQuit(firstEvent);
  shutdown.beforeQuit(repeatedEvent);
  const retainedStop = shutdown.stop();
  expect(shutdown.stop()).toBe(retainedStop);
  await Promise.resolve();
  expect(order).toEqual(["project-storage", "workspace", "harness"]);
  expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
  expect(repeatedEvent.preventDefault).toHaveBeenCalledOnce();
  expect(quit).not.toHaveBeenCalled();

  harnessStop.resolve();
  await retainedStop;
  expect(quit).toHaveBeenCalledOnce();
  const reentryEvent = { preventDefault: vi.fn() };
  shutdown.beforeQuit(reentryEvent);
  expect(reentryEvent.preventDefault).not.toHaveBeenCalled();
  expect(exit).not.toHaveBeenCalled();
});

it("retains package exit until the same shutdown chain settles", async () => {
  const order: string[] = [];
  const exit = vi.fn();
  const shutdown = createDesktopShutdown({
    stopProjectStorageBridge: () => order.push("project-storage"),
    stopWorkspaceBridge: () => order.push("workspace"),
    stopHarness: async () => {
      order.push("harness");
    },
    quit: vi.fn(),
    exit,
  });

  const firstExit = shutdown.requestExit(7);
  expect(shutdown.requestExit(9)).toBe(firstExit);
  await firstExit;
  expect(order).toEqual(["project-storage", "workspace", "harness"]);
  expect(exit).toHaveBeenCalledExactlyOnceWith(7);
});

it("falls back exactly once when quit shutdown fails", async () => {
  const shutdownFailure = new Error("private harness shutdown failure");
  const quit = vi.fn();
  const exit = vi.fn();
  const shutdown = createDesktopShutdown({
    stopProjectStorageBridge: vi.fn(),
    stopWorkspaceBridge: vi.fn(),
    stopHarness: async () => {
      throw shutdownFailure;
    },
    quit,
    exit,
  });
  const firstEvent = { preventDefault: vi.fn() };
  const repeatedEvent = { preventDefault: vi.fn() };

  shutdown.beforeQuit(firstEvent);
  shutdown.beforeQuit(repeatedEvent);
  await expect(shutdown.stop()).rejects.toBe(shutdownFailure);
  await Promise.resolve();

  expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
  expect(repeatedEvent.preventDefault).toHaveBeenCalledOnce();
  expect(quit).not.toHaveBeenCalled();
  expect(exit).toHaveBeenCalledExactlyOnceWith(1);
});

it("maps a failed retained package shutdown to one nonzero exit", async () => {
  const exit = vi.fn();
  const shutdown = createDesktopShutdown({
    stopProjectStorageBridge: vi.fn(),
    stopWorkspaceBridge: vi.fn(),
    stopHarness: async () => {
      throw new Error("private harness shutdown failure");
    },
    quit: vi.fn(),
    exit,
  });

  const exitPromise = shutdown.requestExit(0);
  expect(shutdown.requestExit(7)).toBe(exitPromise);
  await exitPromise;

  expect(exit).toHaveBeenCalledExactlyOnceWith(1);
});
```

```ts
// main.ts
import { createProjectStorageBridge, type ProjectStorageBridgeClient } from "./project-storage-bridge.js";
import { createDesktopShutdown } from "./desktop-shutdown.js";
import {
  createProjectStorageHarnessBootstrap,
  projectStorageMigrationResourcesRoot,
} from "./project-storage-bootstrap.js";

let projectStorageBridge: ProjectStorageBridgeClient | undefined;
const desktopShutdown = createDesktopShutdown({
  stopProjectStorageBridge: () => projectStorageBridge?.stop(),
  stopWorkspaceBridge: () => workspaceBridge?.stop(),
  stopHarness: () => supervisor?.stop() ?? Promise.resolve(),
  quit: () => app.quit(),
  exit: (code) => app.exit(code),
});

async function bootstrap(): Promise<void> {
  if (!prototypeMode) {
    const logger = createMainLogger(app.getPath("logs"), app.isPackaged);
    const migrationResourcesRoot = projectStorageMigrationResourcesRoot({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      mainBundleDirectory: __dirname,
    });
    const harnessBootstrap = createProjectStorageHarnessBootstrap({
      userDataRoot: app.getPath("userData"),
      migrationResourcesRoot,
    });
    supervisor = new HarnessSupervisor(
      harnessEntryPath(__dirname),
      logger,
      harnessBootstrap,
    );
    projectStorageBridge = createProjectStorageBridge({
      session: supervisor.getSession(),
      createId: randomUUID,
      now: () => new Date().toISOString(),
    });
    workspaceBridge = createWorkspaceBridge({
      session: supervisor.getSession(),
      createId: randomUUID,
      now: () => new Date().toISOString(),
    });
  }
}

app.on("before-quit", (event) => {
  desktopShutdown.beforeQuit(event);
});

let bootstrapTask: Promise<void> | undefined;

function startBootstrap(): void {
  if (bootstrapTask !== undefined) {
    return;
  }
  bootstrapTask = (async () => {
    try {
      await bootstrap();
    } catch {
      process.stderr.write("SlopStop failed to start.\n");
      await desktopShutdown.requestExit(1);
    }
  })();
}

startBootstrap();
```

#### Recovery Amendment: Bounded Supervisor Terminal
**Files**: `packages/protocol/src/protocol.ts`, `packages/protocol/src/protocol.test.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/harness-supervisor.test.ts`, `apps/desktop/src/main/desktop-shutdown.test.ts`
**Changes**: Add `HARNESS_SHUTDOWN_TIMEOUT`. Preserve the five-second graceful timer, kill once, then retain at most one five-second terminal timer. If `exit` is still absent, detach session and output listeners, keep the child quarantined behind a no-start/no-retry fence until any late exit, set `degraded/HARNESS_SHUTDOWN_TIMEOUT`, and reject the retained stop Promise with exact message `Harness shutdown timed out.`. A late exit only clears quarantine. Desktop shutdown maps the rejection to one `exit(1)`.

#### Recovery Amendment: Metadata-Only Child Observation
**Files**: `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/harness-supervisor.test.ts`
**Changes**: Replace raw stdout/stderr text and error location logging. Data events log only controlled `attempt`, `stream: "stdout" | "stderr"`, and original byte count. Process error events log only `attempt` and stable `code: "HARNESS_PROCESS_ERROR"`. Stop/exit removes every output/error listener once.

#### Recovery Amendment: Runtime-Bounded Desktop Logs
**Files**: `apps/desktop/src/main/bounded-log-destination.ts`, `apps/desktop/src/main/bounded-log-destination.test.ts`, `apps/desktop/src/main/logger.ts`, `apps/desktop/src/main/logger.test.ts`
**Changes**: Supply Pino a synchronous custom destination that rotates before a write would make `slopstop.jsonl` exceed `5 * 1024 * 1024` bytes, replaces `slopstop.jsonl.1`, and permits no further archive. Add synchronous `hooks.streamWrite`: records at or below `8 * 1024` UTF-8 bytes pass unchanged; larger records become valid JSON with only controlled Pino level/time/service values, `code:"LOG_RECORD_TRUNCATED"`, original byte count, and `msg:"Log record exceeded the local limit."`. The fallback itself must fit the same bound. Existing redaction remains enabled.

#### Recovery Amendment: Complete Sentry Frame Sanitization
**Files**: `apps/desktop/src/main/crash-reporting.ts`, `apps/desktop/src/main/crash-reporting.test.ts`
**Changes**: Explicitly delete `frame.abs_path` in `beforeSend` and extend the existing path/sensitive-field test. Preserve the exact environment consent plus non-empty DSN gate from issue 3; do not add product-facing consent in this plan.

#### Recovery Amendment: Desktop Mutation Proof
**Files**: `stryker.project-storage-desktop.config.json`, `apps/desktop/vitest.project-storage-mutation.config.ts`, `package.json`
**Changes**: Mutate exactly `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/bounded-log-destination.ts`, `apps/desktop/src/main/logger.ts`, and `apps/desktop/src/main/crash-reporting.ts`. Include their four focused test files plus `desktop-shutdown.test.ts`. Keep `concurrency:4`, `incremental:false`, and `thresholds.high/low/break = 90/80/80`. Add root command `test:mutation:project-storage:desktop = pnpm exec stryker run stryker.project-storage-desktop.config.json`.

### Test Contract:

- **Behavior**: Supervisor process observation records bounded metadata and never child text or error location.
  - Test: `records child process events as metadata only` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: stdout bytes for `private C:\\repo\\source.ts` log exactly `{attempt:1, stream:"stdout", bytes:25}` with `Harness process output observed.`; stderr bytes for `secret-token` log the same controlled keys with `stream:"stderr"`; fatal callback location `C:\\repo\\source.ts` logs exactly `{attempt:1, code:"HARNESS_PROCESS_ERROR"}`. Serialized calls contain neither `private`, `source.ts`, nor `secret-token`; stop and exit remove observation listeners once.
  - Expected red: current supervisor converts stdout/stderr chunks to raw UTF-8 text and logs fatal error location.
- **Behavior**: Desktop JSONL output is valid record-by-record and remains within the 5 MiB active plus one 5 MiB archive runtime bound.
  - Tests: `replaces an oversized record with bounded valid JSON`; `rotates before runtime retention exceeds ten MiB` -> `apps/desktop/src/main/bounded-log-destination.test.ts`, `apps/desktop/src/main/logger.test.ts`
  - Oracle: a serialized record of `8 * 1024` UTF-8 bytes passes; the next larger record parses as JSON containing `code:"LOG_RECORD_TRUNCATED"`, the original byte count, and exact message `Log record exceeded the local limit.`, contains none of its original dynamic text, and is at most `8 * 1024` bytes including newline. Repeated writes during one logger lifetime leave only `slopstop.jsonl` and `slopstop.jsonl.1`, each at most `5 * 1024 * 1024` bytes, with every complete line valid JSON.
  - Expected red: current logger rotates only once at startup, has no record-size bound, and allows active plus archive growth beyond the selected limits.
- **Behavior**: Sentry removes both portable filename context and absolute frame paths before send.
  - Test: `removes sensitive fields and full paths before sending` -> `apps/desktop/src/main/crash-reporting.test.ts`
  - Oracle: an input frame containing `filename:"C:\\private\\workspace\\main.ts"`, `abs_path:"C:\\private\\workspace\\main.ts"`, context, and vars returns only `filename:"main.ts"`; serialized output contains neither `abs_path`, `C:\\private`, `workspace`, source context, nor vars. Initialization still returns false unless consent is `1` and DSN is non-empty.
  - Expected red: current sanitizer reduces `filename` but leaves `frame.abs_path` untouched.
- **Behavior**: Harness bootstrap accepts only strict plain local file URLs for both trusted roots.
  - Test: `accepts only plain local file URLs as trusted harness roots` -> `packages/protocol/src/protocol.test.ts`
  - Oracle: concrete Windows file URLs for application Storage and migration resources parse; HTTP, query-bearing, fragment-bearing, malformed, missing, or extra bootstrap fields fail.
  - Expected red: bootstrap currently carries only `kind`.
- **Behavior**: Main derives one private Storage root and the exact development/package migration-resource roots without hand-built URLs.
  - Test: `derives private Storage and development/package migration roots` -> `apps/desktop/src/main/project-storage-bootstrap.test.ts`
  - Oracle: application Storage is `<userData>/storage`; development resources are `<mainBundleDirectory>/harness-migrations`; packaged resources are `<resourcesPath>/harness-migrations`; every wire value equals `pathToFileURL(...).href` and passes `HarnessBootstrapSchema`.
  - Expected red: no trusted Project Storage bootstrap owner exists in Electron main.
- **Behavior**: Development harness builds stage checked-in generated migrations before persistent Desktop composition can start.
  - Test: Phase 5 harness Vite build -> `apps/desktop/vite.harness.config.ts`
  - Oracle: `closeBundle` removes stale `.vite/build/harness-migrations` content and recursively copies `apps/harness/drizzle` to that exact development bootstrap root with identical relative paths and bytes; no native package, `.node` file, or staged `node_modules` tree is introduced in Phase 5.
  - Expected red: the current harness Vite build emits only `harness.cjs`, so the development bootstrap root does not exist.
- **Behavior**: The Project Storage bridge correlates all operation families independently of response order.
  - Test: `correlates out-of-order open, create, and close results` -> `apps/desktop/src/main/project-storage-bridge.test.ts`
  - Oracle: concurrent open/create/close send exact command names; reverse-order correlated events settle only their matching promises with exact validated results and echoed requests.
  - Expected red: no main-process Storage bridge exists.
- **Behavior**: Bridge-local, send, correlation, protocol, session, and stop failures become stable Storage transport failures.
  - Tests: `maps %s to a Storage transport failure`; `rejects mismatched, uncorrelated, disconnected, and stopped requests` -> `apps/desktop/src/main/project-storage-bridge.test.ts`
  - Oracle: all three session send codes map to their existing shared messages; mismatched request, mismatched event kind, null causation, protocol error, disconnect, explicit system failure, local command failure, identity collision, and stop settle affected pending requests once as broken/PROJECT_STORAGE_TRANSPORT_FAILED without forwarding raw error text or paths; stop unsubscribes once and sends nothing later.
  - Expected red: no Storage-specific pending request owner or transport failure mapping exists.
- **Behavior**: Every spawn and retry receives the same validated bootstrap before handshake.
  - Test: `sends the same validated trusted roots to initial and retried harnesses` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: initial and retry child `postMessage` calls receive the exact parsed bootstrap and their own transferred port; the handshake follows attachment; neither logger call receives either root.
  - Expected red: the supervisor posts only `{kind:"harness.connect"}`.
- **Behavior**: Project Storage result traffic does not own supervisor readiness or recovery state.
  - Tests: `forwards Project Storage results without changing supervisor status`; retained `connects once, accepts a ready handshake, forwards output, and stops cleanly`; retained `blocks automatic recovery for malformed and explicit protocol failures` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: open/create/close result events are published through the shared session exactly and leave supervisor status `starting`; `system.ready` still clears the handshake timeout and enters `ready`, `system.failure` still blocks recovery, preserves its diagnostic transition, and kills the child, and protocol errors retain their distinct existing failure path.
  - Expected red: the supervisor switch does not recognize Project Storage result events.
- **Behavior**: Supervisor shutdown detaches transport first, retains one Promise, and has bounded graceful and post-kill terminal waits.
  - Tests: retained live `connects once, accepts a ready handshake, forwards output, and stops cleanly`; `kills after grace and rejects after the terminal exit deadline` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: the retained live stop test awaits one shared Promise, observes session detach before natural child `exit`, sees no kill through 4,999 ms, and reaches stopped only after confirmed exit. For a non-exiting child, 5,000 ms causes exactly one kill; the Promise remains pending through 9,999 ms; at 10,000 ms it rejects with `Harness shutdown timed out.`, status is exactly `degraded` with `HARNESS_SHUTDOWN_TIMEOUT`, start/retry spawn nothing, and Desktop shutdown calls `exit(1)` once. A later child exit clears quarantine but does not resolve, reclassify, or restart the settled shutdown.
  - Expected red: current stop waits forever after calling `child.kill()` when the child never emits `exit`.
- **Behavior**: A supervisor can restart only after awaited shutdown completes, and the next stop controls the replacement child.
  - Tests: updated `reports handshake timeout and restarts safely after completed stop`; focused preservation test `reports synchronous spawn failure as a distinct state` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: handshake timeout preserves the exact `degraded` state with diagnostic code `HARNESS_HANDSHAKE_TIMEOUT`, while synchronous spawn failure remains `crashed` with `HARNESS_START_FAILED`. Start during pending stop spawns nothing; after awaiting the previous stop, start creates and attaches a new child. Its later stop returns a different Promise from the completed stop, detaches the replacement session, leaves the replacement child un-killed before timeout, remains non-stopped until that child exits, and resolves stopped only after the replacement exit.
  - Expected red: retaining `#stopPromise` permanently makes a later stop return the completed stale Promise instead of controlling the restarted child.
- **Behavior**: Desktop quit and package/startup exit share one retained ordered asynchronous shutdown.
  - Tests: `retains ordered shutdown and allows only the post-stop quit re-entry`; `retains package exit until the same shutdown chain settles`; `falls back exactly once when quit shutdown fails`; `maps a failed retained package shutdown to one nonzero exit` -> `apps/desktop/src/main/desktop-shutdown.test.ts`
  - Oracle: Project Storage bridge stop precedes Workspace bridge stop and awaited supervisor stop; repeated stops and exits return their original Promise. The first and repeated `before-quit` events are prevented while shutdown is pending, successful settlement calls `app.quit()` once, and its single re-entry is not prevented. Any harness-stop rejection calls only `app.exit(1)` once; package success/failure and startup failure await `requestExit`, and main retains every launched task without a floating Promise.
  - Expected red: main stops the supervisor synchronously and quit/package paths can exit while the utility process or database handles remain live.
- **Behavior**: Phase 5 production composition replaces the Phase 2 unavailable owner with the trusted persistent owner through the harness transport seam.
  - Test: `composes persistent Project Storage from validated trusted roots` -> `apps/harness/tests/integration/process-bootstrap.integration.test.ts`
  - Oracle: after handshake, a concrete open for the target Project returns not-registered, then exact `project.create`, `project.open`, and `project.close` commands over the process transport return respectively created/read-write with the create request, opened/read-write with the open request and healthy canonical/runtime authority, and closed with the close request using a temporary application root plus checked-in migrations. No response contains the root, and awaited stop releases runtime resources.
  - Expected red: under the Phase 2 production composition, the same concrete Project commands are owned by `createUnavailableProjectStorageApplication()` and return `PROJECT_STORAGE_UNAVAILABLE` rather than created/opened/closed.
- **Behavior**: Bootstrap rejects overlapping authority/resource roots before runtime or persistence mutation.
  - Tests: `rejects overlapping bootstrap roots before starting the runtime`; `rejects roots that overlap through a filesystem alias` -> `apps/harness/tests/integration/process-bootstrap.integration.test.ts`
  - Oracle: a migration root nested below the application root throws the generic overlap error before a runtime starts and leaves `application.db` absent; an application or migration root reached through a symlink/junction alias is canonicalized to the same physical tree and fails identically before mutation.
  - Expected red: no semantic trusted-root validation or production Storage composition exists.

### Success Criteria:

#### Automated Verification:

- [ ] Every Test Contract behavior's exact Expected red is observed and recorded from its named public-seam test before implementation begins.
- [ ] Bootstrap protocol contract, including shutdown-timeout diagnostic, passes: `pnpm exec vitest run packages/protocol/src/protocol.test.ts`
- [ ] Checked-in migrations remain reproducible before staging: `pnpm --filter @slopstop/harness db:generate:check`
- [ ] Development harness build creates the exact migration bootstrap root before Desktop composition: `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts`
- [ ] Main bridge, root derivation, supervisor, retained shutdown, bounded logs, Sentry sanitization, and unchanged Workspace bridge pass: `pnpm exec vitest run apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/project-storage-bootstrap.test.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/desktop-shutdown.test.ts apps/desktop/src/main/bounded-log-destination.test.ts apps/desktop/src/main/logger.test.ts apps/desktop/src/main/crash-reporting.test.ts apps/desktop/src/main/workspace-bridge.test.ts`
- [ ] Production composition passes through the transport port: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/process-bootstrap.integration.test.ts`
- [ ] Existing renderer API lock remains exact: `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts`
- [ ] Focused Desktop mutation proof passes at or above the configured 80 break threshold with no `NoCoverage` mutant: `pnpm test:mutation:project-storage:desktop`
- [ ] Protocol, harness, and desktop type checking passes: `pnpm --filter @slopstop/protocol typecheck && pnpm --filter @slopstop/harness typecheck && pnpm --filter @slopstop/desktop typecheck`
- [ ] Package dependency boundaries remain valid: `pnpm check:boundaries`
- [ ] Architecture model remains valid: `pnpm check:architecture`
- [ ] A separate Phase 5 review/refactor gate records no unresolved blocker before Phase 6 admission.

#### Manual Verification:

- [ ] Inspect preload, shared desktop API, and IPC registration and confirm Project Storage has no renderer method, channel, handler, or Node/Electron exposure.
- [ ] Inspect every logger and diagnostic path and confirm bootstrap roots, full paths, migration SQL, database contents, caught error text, harness stdout/stderr text, and process error locations never enter logs or protocol results.
- [ ] Confirm every serialized Desktop JSONL record is valid and at most 8 KiB, runtime retention contains only one at-most-5-MiB active file plus one at-most-5-MiB archive, and rotation works during one process lifetime on Windows.
- [ ] Confirm Sentry remains disabled without both environment consent and DSN and every outgoing frame omits `abs_path`, source context, vars, and full paths.
- [ ] Confirm the supervisor stores one immutable parsed bootstrap, reuses it across automatic/manual retry, transfers a fresh port each spawn, and sends handshake only after session attachment.
- [ ] Confirm `start()` is a no-op while shutdown is pending or terminal exit is unconfirmed, clears the retained stop lifecycle only after confirmed completed shutdown, and a later stop awaits the replacement child rather than returning the previous Promise.
- [ ] Confirm process entry has one validated composition path, converts URLs with `fileURLToPath`, rejects overlapping roots, does not initialize Storage before a create command, and reuses the generic async stop-rejection boundary already owned and tested in Phase 2.
- [ ] Compare `apps/harness/drizzle` with `.vite/build/harness-migrations` recursively and confirm identical relative paths and bytes, with no Phase 5 native dependency staging or `.vite/build/node_modules` tree.
- [ ] Confirm every quit/package-smoke failure path stops Project Storage bridge, Workspace bridge, and then the supervisor idempotently; terminal shutdown timeout exits nonzero and never claims stopped.

---

## Phase 6: Native Packaging And Packaged Storage Proof

### Overview

Extend Phase 5's harness build staging with the target-specific native libSQL runtime, package the already staged generated migrations, authorize one fresh package-smoke `userData` root with an unpredictable token and exclusive marker, and make each target-platform scenario exit depend jointly on renderer isolation and its bridge-only Project Storage proof. The external E2E fixture alone prepares missing-runtime and staging-witness bytes after prior children close.

**Admission gate before any Phase 6 test or production edit**: the complete Phase 1-5 clause matrix has no broken/unrecoverable entry; every retained/revised automated and manual Success Criterion is accepted; each phase has its separate review/refactor record; `pnpm --filter @slopstop/harness db:generate:check`, `pnpm test:mutation:project-storage:harness`, `pnpm test:mutation:project-storage:desktop`, `pnpm check`, `pnpm test:integration`, and `pnpm check:architecture` pass in the isolated worktree. Failure leaves Phase 6 blocked.

### Changes Required:

#### 1. Harness Native Loader Dependency
**File**: `apps/harness/package.json`
**Changes**: Add direct raw `libsql` ownership for stable harness-relative packaging resolution without changing production imports.

```json
{
  "dependencies": {
    "libsql": "catalog:"
  }
}
```

The direct raw-loader dependency belongs to the harness alongside `@libsql/client`. Besides making the native runtime relationship explicit and exactly pinned, it gives packaging configuration a stable harness-relative resolution root without changing any production import.

#### 2. Packaged Project Storage Scenario Oracle
**File**: `apps/desktop/src/main/project-storage-package-smoke.ts`
**Changes**: Export a strict parser for exactly three scenarios and exercise legitimate absence, healthy create/open/close, missing-runtime safe mode, and witnessed recovery refusal only through the main bridge. Accept no persistence path and import no filesystem API.

```ts
import {
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
} from "@slopstop/protocol";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";

const healthyProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000101");
const absentProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000102");
const witnessProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000103");
const healthyCreateRequestId = ProjectStorageCreateRequestIdSchema.parse(
  "00000000-0000-4000-8000-000000000111",
);
const witnessCreateRequestId = ProjectStorageCreateRequestIdSchema.parse(
  "00000000-0000-4000-8000-000000000112",
);

export type ProjectStoragePackageSmokeScenario =
  | "bootstrap"
  | "missing-runtime"
  | "witnessed-staging";

export function parseProjectStoragePackageSmokeScenario(
  value: unknown,
): ProjectStoragePackageSmokeScenario {
  switch (value) {
    case "bootstrap":
    case "missing-runtime":
    case "witnessed-staging":
      return value;
    default:
      throw new Error("Invalid packaged Project Storage scenario.");
  }
}

function requireSmoke(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error("Packaged Project Storage smoke failed.");
  }
}

export async function runProjectStoragePackageSmoke(input: Readonly<{
  bridge: ProjectStorageBridgeClient;
  scenario: ProjectStoragePackageSmokeScenario;
}>): Promise<void> {
  switch (input.scenario) {
    case "bootstrap": {
      const absent = await input.bridge.open({ projectId: absentProjectId });
      requireSmoke(absent.status === "not-registered");
      const created = await input.bridge.create({
        projectId: healthyProjectId,
        createRequestId: healthyCreateRequestId,
      });
      requireSmoke(created.status === "created");
      const healthy = await input.bridge.open({ projectId: healthyProjectId });
      requireSmoke(
        healthy.status === "opened" &&
          healthy.canonicalHealth.status === "healthy" &&
          healthy.runtimeHealth.status === "healthy",
      );
      const closed = await input.bridge.close({ projectId: healthyProjectId });
      requireSmoke(closed.status === "closed");
      return;
    }
    case "missing-runtime": {
      const safeMode = await input.bridge.open({ projectId: healthyProjectId });
      requireSmoke(
        safeMode.status === "safe-mode" &&
          safeMode.canonicalHealth.status === "healthy" &&
          safeMode.runtimeHealth.status === "missing",
      );
      const closed = await input.bridge.close({ projectId: healthyProjectId });
      requireSmoke(closed.status === "closed");
      return;
    }
    case "witnessed-staging": {
      const witnessOpen = await input.bridge.open({ projectId: witnessProjectId });
      requireSmoke(
        witnessOpen.status === "safe-mode" &&
          witnessOpen.canonicalHealth.status === "recovery-required" &&
          witnessOpen.runtimeHealth.status === "recovery-required",
      );
      const closed = await input.bridge.close({ projectId: witnessProjectId });
      requireSmoke(closed.status === "closed");
      const witnessCreate = await input.bridge.create({
        projectId: witnessProjectId,
        createRequestId: witnessCreateRequestId,
      });
      requireSmoke(
        witnessCreate.status === "blocked" &&
          witnessCreate.reason === "prior-state-witness",
      );
    }
  }
}
```

This module is a bridge-only oracle. It never creates, deletes, repairs, or stages persistence; the Harness remains the only production persistence owner, while the external E2E fixture prepares deliberate filesystem states between closed packaged runs.

#### 3. Isolated Joint Package-Smoke Composition
**Files**: `apps/desktop/src/main/package-smoke-authorization.ts`, `apps/desktop/src/main/package-smoke-authorization.test.ts`, `apps/desktop/src/main/main.ts`
**Changes**: Synchronously validate a token-bound exclusive marker before readiness, logs, root derivation, or `app.setPath`, prove the validation/setPath call order through a unit seam, then require renderer and the selected bridge-only Project Storage scenario together before the retained desktop shutdown and exit.

```ts
// package-smoke-authorization.ts
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  parseProjectStoragePackageSmokeScenario,
  type ProjectStoragePackageSmokeScenario,
} from "./project-storage-package-smoke.js";

const packageSmokeMarkerFilename = ".slopstop-package-smoke.json";
const packageSmokeTokenPattern = /^[0-9a-f]{64}$/u;
export const packageSmokeAuthorizationFailureMessage =
  "Package smoke authorization failed.";

export class PackageSmokeAuthorizationError extends Error {
  override readonly name = "PackageSmokeAuthorizationError";

  constructor() {
    super(packageSmokeAuthorizationFailureMessage);
  }
}

export type PackageSmokeAuthorization = Readonly<{
  root: string;
  scenario: ProjectStoragePackageSmokeScenario;
}>;

export function applyPackageSmokeAuthorization(
  input: Readonly<{
    root: string | undefined;
    token: string | undefined;
    scenario: string | undefined;
  }>,
  setUserDataRoot: (root: string) => void,
): PackageSmokeAuthorization {
  try {
    const { root, token } = input;
    const scenario = parseProjectStoragePackageSmokeScenario(input.scenario);
    if (
      root === undefined ||
      !path.isAbsolute(root) ||
      token === undefined ||
      !packageSmokeTokenPattern.test(token)
    ) {
      throw new PackageSmokeAuthorizationError();
    }

    const rootEntry = lstatSync(root);
    if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
      throw new PackageSmokeAuthorizationError();
    }
    const markerPath = path.resolve(root, packageSmokeMarkerFilename);
    const markerRelative = path.relative(root, markerPath);
    if (
      markerRelative === "" ||
      markerRelative === ".." ||
      markerRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(markerRelative)
    ) {
      throw new PackageSmokeAuthorizationError();
    }
    const markerEntry = lstatSync(markerPath);
    if (!markerEntry.isFile() || markerEntry.isSymbolicLink()) {
      throw new PackageSmokeAuthorizationError();
    }
    const marker: unknown = JSON.parse(readFileSync(markerPath, "utf8"));
    if (
      typeof marker !== "object" ||
      marker === null ||
      Array.isArray(marker) ||
      Object.keys(marker).length !== 2 ||
      !("version" in marker) ||
      marker.version !== 1 ||
      !("token" in marker) ||
      marker.token !== token
    ) {
      throw new PackageSmokeAuthorizationError();
    }
    if (scenario === "bootstrap") {
      const entries = readdirSync(root);
      if (entries.length !== 1 || entries[0] !== packageSmokeMarkerFilename) {
        throw new PackageSmokeAuthorizationError();
      }
    }
    setUserDataRoot(root);
    return { root, scenario };
  } catch {
    throw new PackageSmokeAuthorizationError();
  }
}
```

```ts
// package-smoke-authorization.test.ts
it("rejects the terminal bootstrap guard before setting userData", async () => {
  const root = await createAuthorizedSmokeRoot();
  await writeFile(path.join(root, "unexpected"), "witness", { flag: "wx" });
  const setUserDataRoot = vi.fn();

  expect(() =>
    applyPackageSmokeAuthorization(
      { root, token: authorizationToken, scenario: "bootstrap" },
      setUserDataRoot,
    ),
  ).toThrowError(new PackageSmokeAuthorizationError());
  expect(setUserDataRoot).not.toHaveBeenCalled();
  expect(await pathExists(path.join(root, "storage"))).toBe(false);
});

it("sets userData exactly once after successful authorization", async () => {
  const root = await createAuthorizedSmokeRoot();
  const setUserDataRoot = vi.fn();

  expect(
    applyPackageSmokeAuthorization(
      { root, token: authorizationToken, scenario: "bootstrap" },
      setUserDataRoot,
    ),
  ).toEqual({ root, scenario: "bootstrap" });
  expect(setUserDataRoot).toHaveBeenCalledExactlyOnceWith(root);
});
```

The Phase 6 `main.ts` delta retains Phase 5's `desktopShutdown` composition and `before-quit` handler. Replace the prior package-smoke state/readiness helper, `window-all-closed` handler, and block from `let bootstrapTask` through `startBootstrap()` with the package-aware retained definitions below; these are replacements, not second declarations.

```ts
// main.ts
import {
  applyPackageSmokeAuthorization,
  PackageSmokeAuthorizationError,
  packageSmokeAuthorizationFailureMessage,
  type PackageSmokeAuthorization,
} from "./package-smoke-authorization.js";
import { runProjectStoragePackageSmoke } from "./project-storage-package-smoke.js";

const packageSmoke =
  !prototypeMode && app.isPackaged && process.env["SLOPSTOP_PACKAGE_SMOKE"] === "1";
let packageSmokeState: "inactive" | "pending" | "passed" = "inactive";
let packageSmokeAuthorization: PackageSmokeAuthorization | undefined;
let packageSmokeTask: Promise<void> | undefined;

const runPackageSmokeIfReady = (): void => {
  const bridge = projectStorageBridge;
  const authorization = packageSmokeAuthorization;
  const window = smokeWindow;
  if (
    !packageSmoke ||
    !smokeHarnessReady ||
    window === undefined ||
    packageSmokeTask !== undefined ||
    bridge === undefined ||
    authorization === undefined
  ) {
    return;
  }
  packageSmokeTask = (async () => {
    try {
      const rendererProof = window.webContents
        .executeJavaScript(packageSmokeRendererScript)
        .then((result: unknown) => validatePackageSmokeResult(result));
      const storageProof = runProjectStoragePackageSmoke({
        bridge,
        scenario: authorization.scenario,
      });
      const proofResults = await Promise.allSettled([rendererProof, storageProof]);
      if (proofResults.some((result) => result.status === "rejected")) {
        await desktopShutdown.requestExit(1);
        return;
      }
      packageSmokeState = "passed";
      await desktopShutdown.requestExit(0);
    } catch {
      await desktopShutdown.requestExit(1);
    }
  })();
};

app.on("window-all-closed", () => {
  if (packageSmokeState === "pending") {
    if (packageSmokeTask === undefined) {
      packageSmokeTask = desktopShutdown.requestExit(1);
    }
    return;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let bootstrapTask: Promise<void> | undefined;

function startBootstrap(): void {
  if (bootstrapTask !== undefined) {
    return;
  }
  bootstrapTask = (async () => {
    try {
      await bootstrap();
    } catch (error: unknown) {
      process.stderr.write(
        `${error instanceof PackageSmokeAuthorizationError
          ? packageSmokeAuthorizationFailureMessage
          : "SlopStop failed to start."}\n`,
      );
      await desktopShutdown.requestExit(1);
    }
  })();
}

startBootstrap();
```

Insert the following block as the first statement of the retained `bootstrap()`, before `await app.whenReady()`, logger creation, or Storage-root derivation:

```ts
if (packageSmoke) {
  const authorization = applyPackageSmokeAuthorization(
    {
      root: process.env["SLOPSTOP_PACKAGE_SMOKE_USER_DATA"],
      token: process.env["SLOPSTOP_PACKAGE_SMOKE_TOKEN"],
      scenario: process.env["SLOPSTOP_PACKAGE_SMOKE_SCENARIO"],
    },
    (root) => app.setPath("userData", root),
  );
  packageSmokeAuthorization = authorization;
  packageSmokeState = "pending";
}
```

Authorization requires an absolute non-symlink directory, a 256-bit lowercase-hex token, and a regular non-symlink marker directly inside that root whose strict JSON shape is exactly `{version:1, token}`. The first `bootstrap` scenario additionally requires the marker to be the root's only entry. The applicator invokes `app.setPath("userData", root)` only after all synchronous checks pass. Any validation failure prints exactly `Package smoke authorization failed.`, exposes no caught details/root/token, and awaits the retained desktop shutdown before nonzero exit. The marker authorizes smoke mutation only, is never product data, and is removed with the temporary root.

#### 4. Forge Native And Migration Packaging
**File**: `apps/desktop/forge.config.ts`
**Changes**: Preserve ASAR/fuses, auto-unpack native binaries, copy migration resources once, and exclude their staging source from the normal app copy.

```ts
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { fileURLToPath } from "node:url";

const packagedMigrationResources = fileURLToPath(
  new URL("./.vite/build/harness-migrations", import.meta.url),
);

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "dev.slopstop.desktop",
    asar: true,
    executableName: "SlopStop",
    extraResource: [packagedMigrationResources],
    ignore: /[/\\]\.vite[/\\]build[/\\]harness-migrations(?:[/\\]|$)/,
  },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        { entry: "src/main/main.ts", config: "vite.main.config.ts", target: "main" },
        { entry: "src/preload/preload.ts", config: "vite.preload.config.ts", target: "preload" },
        {
          entry: { harness: "../harness/src/process-entry.ts" },
          config: "vite.harness.config.ts",
          target: "main",
        },
      ],
      renderer: [
        { name: "main_window", config: "vite.renderer.config.ts" },
        { name: "prototype_window", config: "vite.prototype.config.ts" },
      ],
      concurrent: 2,
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
```

The auto-unpack plugin has no behavior options; with existing `asar: true` it extends the ASAR unpack glob for every `.node` file. `extraResource` copies the staged `harness-migrations` directory directly under `process.resourcesPath`, matching Phase 5's packaged bootstrap root. The absolute-path `ignore` regex excludes the staging source from the normal app copy, preventing a second copy inside `app.asar`; Electron Packager still copies the same explicit `extraResource`.

#### 5. Harness Build Runtime Staging
**File**: `apps/desktop/vite.harness.config.ts`
**Changes**: Extend Phase 5's existing single `stageHarnessRuntime()` plugin: retain its one byte-for-byte generated-migration copy, externalize only raw `libsql`, and add target-specific transitive native closure staging from the harness dependency graph. Do not introduce a second plugin or a second migration copy.

```ts
import { cp, readFile, rm } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];
const harnessRequire = createRequire(new URL("../harness/package.json", import.meta.url));
const migrationSource = fileURLToPath(new URL("../harness/drizzle", import.meta.url));
const migrationOutput = fileURLToPath(
  new URL("./.vite/build/harness-migrations", import.meta.url),
);
const nativeModulesOutput = fileURLToPath(
  new URL("./.vite/build/node_modules", import.meta.url),
);

function targetBindingPackages(): readonly string[] {
  const target = `${process.platform}-${process.arch}`;
  switch (target) {
    case "darwin-arm64":
      return ["@libsql/darwin-arm64"];
    case "darwin-x64":
      return ["@libsql/darwin-x64"];
    case "win32-x64":
      return ["@libsql/win32-x64-msvc"];
    case "linux-arm":
      return ["@libsql/linux-arm-gnueabihf", "@libsql/linux-arm-musleabihf"];
    case "linux-arm64":
      return ["@libsql/linux-arm64-gnu", "@libsql/linux-arm64-musl"];
    case "linux-x64":
      return ["@libsql/linux-x64-gnu", "@libsql/linux-x64-musl"];
    default:
      throw new Error(`Unsupported libSQL package target: ${target}`);
  }
}

async function resolvePackageRoot(
  packageName: string,
  resolveEntry: (name: string) => string,
): Promise<string> {
  let current = path.dirname(resolveEntry(packageName));
  for (;;) {
    const manifestPath = path.join(current, "package.json");
    try {
      const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
      if (
        typeof manifest === "object" &&
        manifest !== null &&
        "name" in manifest &&
        manifest.name === packageName
      ) {
        return current;
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not resolve package root for ${packageName}.`);
    }
    current = parent;
  }
}

function stageHarnessRuntime(): Plugin {
  return {
    name: "stage-harness-runtime",
    async closeBundle() {
      await rm(migrationOutput, { recursive: true, force: true });
      await rm(nativeModulesOutput, { recursive: true, force: true });
      await cp(migrationSource, migrationOutput, { recursive: true });
      const libsqlRoot = await resolvePackageRoot(
        "libsql",
        (name) => harnessRequire.resolve(name),
      );
      const libsqlRequire = createRequire(path.join(libsqlRoot, "package.json"));
      const transitivePackages = [
        "@neon-rs/load",
        "detect-libc",
        ...targetBindingPackages(),
      ];
      const runtimePackages = [
        { packageName: "libsql", source: libsqlRoot },
        ...(await Promise.all(
          transitivePackages.map(async (packageName) => ({
            packageName,
            source: await resolvePackageRoot(
              packageName,
              (name) => libsqlRequire.resolve(name),
            ),
          })),
        )),
      ];
      for (const { packageName, source } of runtimePackages) {
        const destination = path.join(nativeModulesOutput, ...packageName.split("/"));
        await cp(source, destination, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [stageHarnessRuntime()],
  build: {
    lib: {
      entry: { harness: "../harness/src/process-entry.ts" },
      fileName: () => "harness.cjs",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [...nodeBuiltins, "libsql"],
    },
  },
});
```

The resulting config above contains one `stageHarnessRuntime()` plugin. Its migration removal/copy is retained unchanged from Phase 5 and executes once; Phase 6 adds only native-output cleanup/resolution/copy behavior around it. `@libsql/client` and Drizzle remain bundled harness-owned JavaScript. The raw `libsql` loader stays external. Native staging resolves only the direct harness-owned `libsql` dependency from the harness package, then discovers `@neon-rs/load`, `detect-libc`, and target bindings through `libsql`'s own declared dependency graph. The copied closure sits beside `harness.cjs` under `.vite/build/node_modules`, where ordinary Node resolution finds it at runtime. Linux packages retain both installed libc variants and the runtime loader selects the compatible one. Build/package never generates or applies a migration.

#### 6. Target-Platform Package Smoke
**File**: `apps/desktop/tests/e2e/package-smoke.mjs`
**Changes**: Preflight migration journals and unpacked native bindings; run the bounded invalid authorization matrix before valid Storage; then create one token-bound exclusive marker and run bootstrap, missing-runtime, and witnessed-staging children in order on the same root. Prepare persistence states externally only after child close, verify application storage, and clean up each root in `finally`.

```js
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const smokeTimeoutMs = 30_000;
const maxStderrCharacters = 4_000;
const markerFilename = ".slopstop-package-smoke.json";
const authorizationFailureOutput = "Package smoke authorization failed.\n";
const invalidRelativeSmokeRoot = "relative-smoke-root";
const healthyProjectId = "00000000-0000-4000-8000-000000000101";
const witnessProjectId = "00000000-0000-4000-8000-000000000103";
const witnessGenerationId = "00000000-0000-4000-8000-000000000113";
const generationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function packagedOutputDirectory() {
  return path.resolve("out", `SlopStop-${process.platform}-${process.arch}`);
}

function packagedExecutable() {
  const output = packagedOutputDirectory();
  if (process.platform === "win32") {
    return path.join(output, "SlopStop.exe");
  }
  if (process.platform === "darwin") {
    return path.join(output, "SlopStop.app", "Contents", "MacOS", "SlopStop");
  }
  return path.join(output, "SlopStop");
}

function packagedResourcesDirectory() {
  const output = packagedOutputDirectory();
  return process.platform === "darwin"
    ? path.join(output, "SlopStop.app", "Contents", "Resources")
    : path.join(output, "resources");
}

async function collectNodeBindings(directory) {
  const bindings = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      bindings.push(...(await collectNodeBindings(candidate)));
    } else if (entry.isFile() && entry.name.endsWith(".node")) {
      bindings.push(candidate);
    }
  }
  return bindings;
}

async function assertPackagedStorageResources() {
  const resources = packagedResourcesDirectory();
  const migrations = path.join(resources, "harness-migrations");
  for (const kind of ["application", "canonical", "runtime"]) {
    const kindRoot = path.join(migrations, kind);
    const entries = await readdir(kindRoot);
    if (!entries.some((entry) => entry.endsWith(".sql"))) {
      throw new Error("Packaged SlopStop is missing generated migration SQL.");
    }
    const journal = JSON.parse(
      await readFile(path.join(kindRoot, "meta", "_journal.json"), "utf8"),
    );
    if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
      throw new Error("Packaged SlopStop has an invalid migration journal.");
    }
  }

  const nativeRoot = path.join(resources, "app.asar.unpacked");
  const targetPrefix = `${process.platform}-${process.arch}`;
  const bindings = await collectNodeBindings(nativeRoot);
  if (
    !bindings.some(
      (binding) => binding.includes("@libsql") && binding.includes(targetPrefix),
    )
  ) {
    throw new Error("Packaged SlopStop is missing the target libSQL native binding.");
  }
}

async function launchPackagedApp({ root, token, scenario }) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      SLOPSTOP_PACKAGE_SMOKE: "1",
    };
    for (const [key, value] of [
      ["SLOPSTOP_PACKAGE_SMOKE_SCENARIO", scenario],
      ["SLOPSTOP_PACKAGE_SMOKE_TOKEN", token],
      ["SLOPSTOP_PACKAGE_SMOKE_USER_DATA", root],
    ]) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
    const child = spawn(packagedExecutable(), [], {
      env,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errorOutput = "";
    let stderrOverflow = false;
    let spawnFailed = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, smokeTimeoutMs);
    child.stderr.on("data", (chunk) => {
      const combined = `${errorOutput}${String(chunk)}`;
      stderrOverflow ||= combined.length > maxStderrCharacters;
      errorOutput = combined.slice(0, maxStderrCharacters);
    });
    child.once("error", () => {
      spawnFailed = true;
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolve({
        code,
        closed: true,
        spawnFailed,
        stderr: errorOutput,
        stderrOverflow,
        timedOut,
      });
    });
  });
}

async function launchScenario(root, token, scenario) {
  const launch = await launchPackagedApp({ root, token, scenario });
  if (launch.spawnFailed) {
    throw new Error(`Packaged SlopStop ${scenario} scenario failed to launch.`);
  }
  if (launch.timedOut) {
    throw new Error(`Packaged SlopStop ${scenario} scenario timed out.`);
  }
  if (launch.code !== 0) {
    throw new Error(
      `Packaged SlopStop ${scenario} scenario exited nonzero${
        launch.stderr.length > 0 ? " with bounded stderr." : "."
      }`,
    );
  }
}

function errorCode(error) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  try {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function createAuthorizedSmokeRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-package-smoke-"));
  const token = randomBytes(32).toString("hex");
  await writeFile(
    path.join(root, markerFilename),
    JSON.stringify({ version: 1, token }),
    { flag: "wx" },
  );
  return { root, token };
}

const invalidAuthorizationCases = [
  {
    name: "invalid scenario",
    launch: ({ root, token }) => ({ root, token, scenario: "invalid" }),
  },
  {
    name: "missing scenario",
    launch: ({ root, token }) => ({ root, token, scenario: undefined }),
  },
  {
    name: "missing root",
    launch: ({ token }) => ({ root: undefined, token, scenario: "bootstrap" }),
  },
  {
    name: "missing token",
    launch: ({ root }) => ({ root, token: undefined, scenario: "bootstrap" }),
  },
  {
    name: "malformed token",
    launch: ({ root }) => ({ root, token: "not-a-token", scenario: "bootstrap" }),
  },
  {
    name: "malformed marker JSON",
    prepare: async ({ root }) =>
      writeFile(path.join(root, markerFilename), "{not-json"),
  },
  {
    name: "wrong marker version",
    prepare: async ({ root, token }) =>
      writeFile(path.join(root, markerFilename), JSON.stringify({ version: 2, token })),
  },
  {
    name: "extra marker field",
    prepare: async ({ root, token }) =>
      writeFile(
        path.join(root, markerFilename),
        JSON.stringify({ version: 1, token, extra: true }),
      ),
  },
  {
    name: "token mismatch",
    launch: ({ root, token }) => ({
      root,
      token: `${token[0] === "0" ? "1" : "0"}${token.slice(1)}`,
      scenario: "bootstrap",
    }),
  },
  {
    name: "missing marker",
    prepare: async ({ root }) => unlink(path.join(root, markerFilename)),
  },
  {
    name: "relative root",
    launch: ({ token }) => ({
      root: invalidRelativeSmokeRoot,
      token,
      scenario: "bootstrap",
    }),
  },
  {
    name: "non-marker-only bootstrap root",
    prepare: async ({ root }) => {
      await writeFile(path.join(root, "unexpected"), "witness", { flag: "wx" });
    },
  },
  {
    name: "non-regular marker",
    prepare: async ({ root }) => {
      const markerPath = path.join(root, markerFilename);
      await unlink(markerPath);
      await mkdir(markerPath);
    },
  },
];

async function runInvalidAuthorizationCase(testCase) {
  const fixture = await createAuthorizedSmokeRoot();
  try {
    await testCase.prepare?.(fixture);
    const beforeEntries = [...(await readdir(fixture.root))].sort();
    const input = testCase.launch?.(fixture) ?? {
      root: fixture.root,
      token: fixture.token,
      scenario: "bootstrap",
    };
    const launch = await launchPackagedApp(input);
    const secrets = [fixture.root, fixture.token, input.root, input.token].filter(
      (value) => typeof value === "string",
    );

    if (
      !launch.closed ||
      launch.spawnFailed ||
      launch.stderrOverflow ||
      launch.timedOut ||
      typeof launch.code !== "number" ||
      launch.code === 0 ||
      launch.stderr !== authorizationFailureOutput ||
      secrets.some((secret) => launch.stderr.includes(secret)) ||
      (await pathExists(path.join(fixture.root, "storage"))) ||
      JSON.stringify([...(await readdir(fixture.root))].sort()) !==
        JSON.stringify(beforeEntries)
    ) {
      throw new Error(`Invalid package-smoke authorization case failed: ${testCase.name}.`);
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

async function runSymlinkAuthorizationCaseIfSupported() {
  const fixture = await createAuthorizedSmokeRoot();
  const externalTargetRoot = await mkdtemp(
    path.join(os.tmpdir(), "slopstop-package-smoke-marker-target-"),
  );
  try {
    const markerPath = path.join(fixture.root, markerFilename);
    const targetPath = path.join(externalTargetRoot, "marker-target.json");
    await unlink(markerPath);
    await writeFile(
      targetPath,
      JSON.stringify({ version: 1, token: fixture.token }),
      { flag: "wx" },
    );
    try {
      await symlink(targetPath, markerPath, "file");
    } catch (error) {
      if (["EACCES", "EPERM", "ENOSYS"].includes(errorCode(error))) {
        return;
      }
      throw error;
    }
    const beforeEntries = [...(await readdir(fixture.root))].sort();
    const launch = await launchPackagedApp({
      root: fixture.root,
      token: fixture.token,
      scenario: "bootstrap",
    });
    if (
      !launch.closed ||
      launch.spawnFailed ||
      launch.stderrOverflow ||
      launch.timedOut ||
      typeof launch.code !== "number" ||
      launch.code === 0 ||
      launch.stderr !== authorizationFailureOutput ||
      launch.stderr.includes(fixture.root) ||
      launch.stderr.includes(fixture.token) ||
      (await pathExists(path.join(fixture.root, "storage"))) ||
      JSON.stringify([...(await readdir(fixture.root))].sort()) !==
        JSON.stringify(beforeEntries)
    ) {
      throw new Error("Invalid package-smoke authorization case failed: symlink marker.");
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(externalTargetRoot, { recursive: true, force: true });
  }
}

async function runInvalidAuthorizationMatrix() {
  for (const testCase of invalidAuthorizationCases) {
    await runInvalidAuthorizationCase(testCase);
  }
  await runSymlinkAuthorizationCaseIfSupported();
}

async function inspectHealthyGeneration(root) {
  const projectRoot = path.join(root, "storage", "projects", healthyProjectId);
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const entry = entries[0];
  if (
    entries.length !== 1 ||
    entry === undefined ||
    !entry.isDirectory() ||
    entry.isSymbolicLink() ||
    !generationIdPattern.test(entry.name)
  ) {
    throw new Error("Packaged SlopStop did not create one plain active generation.");
  }
  const generationRoot = path.join(projectRoot, entry.name);
  const generationEntry = await lstat(generationRoot);
  if (!generationEntry.isDirectory() || generationEntry.isSymbolicLink()) {
    throw new Error("Packaged SlopStop generation is not a plain directory.");
  }
  const manifest = JSON.parse(
    await readFile(path.join(generationRoot, "manifest.json"), "utf8"),
  );
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest) ||
    manifest.projectId !== healthyProjectId ||
    manifest.generationId !== entry.name
  ) {
    throw new Error("Packaged SlopStop generation manifest does not agree.");
  }
  return generationRoot;
}

async function removeClosedRuntimeDatabase(generationRoot) {
  const runtimeDatabase = path.join(generationRoot, "mastra.db");
  const runtimeEntry = await lstat(runtimeDatabase);
  if (!runtimeEntry.isFile() || runtimeEntry.isSymbolicLink()) {
    throw new Error("Packaged SlopStop runtime database is not a plain file.");
  }
  await unlink(runtimeDatabase);
}

async function createStagingWitness(root) {
  const witnessProjectRoot = path.join(
    root,
    "storage",
    "projects",
    witnessProjectId,
  );
  const stagingRoot = path.join(
    witnessProjectRoot,
    `.staging-${witnessGenerationId}`,
  );
  await mkdir(witnessProjectRoot);
  await mkdir(stagingRoot);
  await writeFile(path.join(stagingRoot, "mastra.db-wal"), "", { flag: "wx" });
}

async function assertApplicationDatabase(root) {
  const applicationDatabase = await lstat(path.join(root, "storage", "application.db"));
  if (!applicationDatabase.isFile() || applicationDatabase.isSymbolicLink()) {
    throw new Error("Packaged SlopStop did not use isolated application storage.");
  }
}

async function runPackageSmoke() {
  await assertPackagedStorageResources();
  await runInvalidAuthorizationMatrix();
  const { root, token } = await createAuthorizedSmokeRoot();

  try {
    await launchScenario(root, token, "bootstrap");
    const generationRoot = await inspectHealthyGeneration(root);
    await removeClosedRuntimeDatabase(generationRoot);
    await launchScenario(root, token, "missing-runtime");
    await createStagingWitness(root);
    await launchScenario(root, token, "witnessed-staging");
    await assertApplicationDatabase(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

try {
  await runPackageSmoke();
  process.stdout.write(
    "Packaged SlopStop validated renderer isolation and Project Storage.\n",
  );
} catch {
  process.stderr.write("Packaged SlopStop smoke failed.\n");
  process.exitCode = 1;
}
```

Before any valid Storage scenario, the fixture launches one bounded invalid authorization child for each parser/guard branch: invalid scenario, missing scenario, missing root, missing token, malformed token, malformed marker JSON, wrong marker version, extra marker field, token mismatch, missing marker, relative root, non-marker-only bootstrap root, non-regular marker, and supported marker symlink. The launcher assigns only present smoke values and explicitly deletes omitted scenario/root/token keys from each inherited environment. Every invalid child must reach `close`, exit nonzero with stderr exactly `Package smoke authorization failed.`, expose neither prepared nor launched root/token, leave `storage` absent, and preserve the prepared root entries before cleanup. The symlink target lives in a separate temporary directory outside the authorized root, the root contains only its symlink marker, both fixtures are cleaned after close, and only unsupported symlink creation skips that case. The one valid-matrix marker is smoke authorization, not product state. The fixture passes root, token, and scenario on every valid launch, captures at most 4,000 stderr characters without printing them, and converts every raw failure to a generic message. `launchScenario` resolves only from child `close`, including timeout-kill paths, so runtime deletion, staging-witness creation, external symlink-target cleanup, and final recursive cleanup cannot race open Windows database handles.

#### 7. Desktop Native-Unpack Plugin Dependency
**File**: `apps/desktop/package.json`
**Changes**: Add only the optionless Forge auto-unpack-natives plugin; Desktop does not own libSQL runtime packages.

```json
{
  "devDependencies": {
    "@electron-forge/plugin-auto-unpack-natives": "catalog:"
  }
}
```

Desktop adds only the Forge packaging plugin. It neither imports nor declares any libSQL runtime package; the staged closure remains owned and resolved through the harness package.

#### 8. Packaging Dependency Catalog Pins
**File**: `pnpm-workspace.yaml`
**Changes**: Pin the Forge native-unpack plugin and raw `libsql` versions.

```yaml
catalog:
  "@electron-forge/plugin-auto-unpack-natives": 7.11.2
  libsql: 0.5.29
```

#### 9. Resolved Packaging Dependency Graph
**File**: `pnpm-lock.yaml`
**Changes**: Regenerate the lockfile for the direct harness native loader and Desktop packaging plugin additions.

Regenerate the lockfile from the Phase 6 catalog additions and review the target-specific `libsql` closure without moving native runtime ownership into Desktop.

### Test Contract:

- **Behavior**: The packaged application contains directly readable generated migrations for all three databases and the current target's unpacked libSQL native binding.
  - Test: `package preflight rejects missing Storage resources` -> `apps/desktop/tests/e2e/package-smoke.mjs`
  - Oracle: beneath the packaged `resources` directory, `harness-migrations/{application,canonical,runtime}` each contains SQL plus a non-empty `meta/_journal.json`; recursive inspection of `app.asar.unpacked` finds a `.node` path containing both `@libsql` and `${process.platform}-${process.arch}` before the executable starts.
  - Expected red: Phase 5 stages development migrations under `.vite/build`, but the current package does not yet copy that staged tree to packaged resources or stage/unpack the harness-owned external `libsql` loader/native binding closure.
- **Behavior**: Three strict bridge-only packaged scenarios open legitimate absence, create and reopen healthy Storage, degrade only a missing runtime database to safe mode, and refuse a witnessed incomplete generation without Desktop preparing persistence state.
  - Test: `packaged Project Storage scenario matrix exits cleanly` -> `apps/desktop/src/main/project-storage-package-smoke.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`
  - Oracle: the parser accepts exactly `bootstrap`, `missing-runtime`, and `witnessed-staging`; each child awaits both renderer and Storage proof outcomes, exits `0` only when both fulfill, and requests nonzero exit only after both settle when either rejects. `bootstrap` observes the absent fixed Project as `not-registered`, creates the healthy fixed Project, opens it healthy/healthy, and closes it. After that child closes, the E2E fixture requires exactly one plain active generation and unlinks only its `mastra.db`; `missing-runtime` opens that existing Project safe-mode with canonical healthy/runtime missing and closes it. After that child closes, the fixture exclusively creates the exact fixed `.staging-<GenerationId>/mastra.db-wal`; `witnessed-staging` opens the witness Project safe-mode with recovery-required/recovery-required, closes it, and receives blocked/prior-state-witness from create. The bridge oracle has no `node:fs` import or path input.
  - Expected red: the current packaged smoke proves only renderer isolation and main has no package-smoke Project Storage scenario.
- **Behavior**: Package proof mutates only a marker-authorized fresh root and cleans its temporary state even when launch or an assertion fails.
  - Test: `packaged Project Storage scenario matrix exits cleanly` -> `apps/desktop/tests/e2e/package-smoke.mjs`
  - Oracle: the launcher creates one absolute `mkdtemp` root and a cryptographically random 256-bit token, writes the regular non-symlink marker `.slopstop-package-smoke.json` exclusively with strict `{version:1, token}`, and passes root, token, and scenario on every launch. Before readiness, logs, root derivation, or `app.setPath`, main synchronously requires an absolute non-symlink root, a well-formed token, a marker directly inside the root with exactly the matching shape, and for `bootstrap` only that marker in the root. Any failure uses the generic nonzero startup path without root/token output. The same root is reused in order for all three closed children; `<root>/storage/application.db` is then a plain file. Child stderr remains bounded and unprinted; timeout kills but still waits for `close`; `finally` recursively removes the marker and root only after all children have closed.
  - Expected red: the current launcher supplies only an absolute root, with no unpredictable token, exclusive ownership marker, first-launch freshness proof, or multi-launch fixture.
- **Behavior**: Packaged authorization rejects every invalid root/token/marker shape before any valid scenario or Storage effect.
  - Test: `packaged Project Storage scenario matrix exits cleanly` -> `apps/desktop/tests/e2e/package-smoke.mjs`
  - Oracle: before the valid matrix, bounded children cover invalid scenario, missing scenario, missing root, missing token, malformed token, malformed marker JSON, wrong marker version, extra marker field, token mismatch, missing marker, relative root, non-marker-only bootstrap root, non-regular marker, and supported marker symlink. The relative-root child passes exactly the fixed literal `relative-smoke-root`; it never calls `path.relative(process.cwd(), root)`, so the oracle remains relative even when the fixture and working directory are on different Windows drives. Omitted scenario/root/token keys are explicitly deleted from the inherited environment. Every child reaches `close` before cleanup, exits with a nonzero numeric code, writes stderr exactly `Package smoke authorization failed.\n`, includes neither prepared nor launched root/token, leaves `<root>/storage` absent, and preserves the prepared root entries. The symlink target is outside the authorized root, whose only entry is the symlink marker, and both roots are cleaned after close; the case skips only when symlink creation is unsupported. The bridge oracle remains filesystem-free, and `rejects the terminal bootstrap guard before setting userData` proves even the final extra-entry guard runs before `app.setPath("userData", root)` while the successful companion test pins one call after validation.
  - Expected red: the package smoke runs only authorized happy-path scenarios, so installed startup order, generic failure output, and mutation refusal are unproved.

### Success Criteria:

#### Automated Verification:

- [ ] Every Test Contract behavior's exact Expected red is observed and recorded from its named public-seam test before implementation begins.
- [ ] Existing renderer boundary lock remains exact: `pnpm exec vitest run apps/desktop/src/main/package-smoke-verifier.test.ts`
- [ ] Generated migrations remain reproducible before staging: `pnpm --filter @slopstop/harness db:generate:check`
- [ ] Focused harness mutation proof remains green: `pnpm test:mutation:project-storage:harness`
- [ ] Focused Desktop mutation proof remains green: `pnpm test:mutation:project-storage:desktop`
- [ ] Desktop packaging code type checks: `pnpm --filter @slopstop/desktop typecheck`
- [ ] Fast repository gate passes: `pnpm check`
- [ ] Real harness/process persistence integration passes: `pnpm test:integration`
- [ ] Architecture boundaries remain valid: `pnpm check:architecture`
- [ ] Target package contains native/resources and passes both public-seam proofs: `pnpm package:smoke`
- [ ] A separate Phase 6 review/refactor gate records no unresolved blocker.
- [ ] Deep repository gate passes: `pnpm check:deep`
- [ ] Final plan audit passes: `/rpiv:validate .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`

#### Manual Verification:

- [ ] Inspect the package and confirm SQL/journals exist only under `resources/harness-migrations`, while target `.node` files exist under `resources/app.asar.unpacked`; no migration or native binding is loaded from the source repository or development hoist.
- [ ] Confirm Forge preserves `asar: true`, keeps the fuses plugin terminal, and uses the optionless auto-unpack plugin before the Vite plugin.
- [ ] Confirm `libsql` is a direct harness dependency, Desktop declares only its packaging plugin, and all Storage imports and behavior remain in the harness.
- [ ] Confirm package-smoke runs every scenario/root/token/marker parser and guard branch before the valid matrix; omitted environment keys are deleted, the absolute non-symlink root, 256-bit token, regular non-symlink exact marker, and marker-only first-launch root are validated synchronously before `app.whenReady()`, logs, Storage derivation, or `app.setPath`; each invalid child closes before cleanup, emits only the exact generic failure, exposes neither prepared nor launched root/token, and leaves Storage absent.
- [ ] Confirm `project-storage-package-smoke.ts` is bridge-only, accepts only the three strict scenarios, imports no `node:fs`, accepts no persistence path, and never creates, deletes, repairs, or stages persistence bytes.
- [ ] Confirm the E2E fixture waits for each child `close` before unlinking only the healthy generation's `mastra.db`, exclusively writing the fixed staging witness, removing an external symlink marker target, or recursively removing a root; the symlink target is never inside the authorized root and child stderr is bounded and never echoed.
- [ ] Confirm success waits for renderer and Storage proofs together, while every package-smoke failure and normal quit stops Project Storage bridge, Workspace bridge, and supervisor idempotently.
- [ ] Confirm preload, renderer bundle, IPC channel vocabulary, and the exact six-method renderer API remain unchanged.

## Testing Strategy

Each behavior-changing phase follows the repository's strict red-green sequence through the public seam named by its locked Test Contract. Implement transcribes the exact Oracle into a failing test, observes the stated Expected red, lands the minimum implementation, runs the focused Green test, and completes a separate review/refactor gate before advancing. Every retained/revised automated and manual Success Criterion is rerun in the isolated worktree. Broader integration, mutation, architecture, package, deep, and final validation gates remain concentrated in the later phases and terminal package proof.

### Automated:

- Observe a failing public-seam test before every behavior implementation; preserve the exact expected-red reason.
- Protocol strict objects must reject extra fields, mismatched result/request identities, and invalid health combinations.
- `not-registered` must be impossible when any registry, directory, manifest, database, sidecar, tombstone, snapshot, marker, or unfinished journal witness is present.
- Exact `createRequestId` replay must return the original IDs; conflicting reuse must not allocate or write.
- Crash points before and after generation rename and registry activation must leave explicit `recovery-required` witnesses.
- `PRAGMA foreign_keys` must read back as `1`; `foreign_key_check` must be empty; `integrity_check` must be exactly one `ok` row.
- Generated migration resources must be present and directly readable in development and package layouts.
- A safe-mode session must expose no write operation through the application/store API.
- Closing one Project must not close another retained Project session; async stop must close all, drain creation, and surface aggregate cleanup failure through one retained Promise.
- Existing Workspace package smoke must continue to report the same exact six preload methods and unavailable Workspace results.
- Package proof must run against the target-platform native binary, not a development hoist.
- Package-smoke persistence preparation belongs only to the external E2E fixture after child close; Electron main and its bridge oracle never receive persistence paths or mutate witness bytes.
- Package-smoke mutation requires the same unpredictable token and exclusive strict marker across one marker-only bootstrap root and both subsequent scenarios; root/token values never enter output.
- Windows path behavior must use `pathToFileURL` and normalized filesystem operations rather than hand-built file URLs.
- Run `pnpm --filter @slopstop/harness db:generate:check`, `pnpm test:mutation:project-storage:harness`, `pnpm test:mutation:project-storage:desktop`, `pnpm check`, `pnpm test:integration`, `pnpm check:architecture`, `pnpm package:smoke`, and `pnpm check:deep` on the terminal slice, then run `/rpiv:validate .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`.

### Manual Testing Steps:

1. Inspect every phase against its unchanged Manual Verification checklist before proceeding.
2. Confirm no renderer/preload API, arbitrary persistence-path input, hidden migration, cleanup fallback, or false-clean degradation enters any phase.
3. Inspect the packaged target layout, marker authorization, external fixture mutations, and complete same-root package scenario matrix only after unit, structured-clone, and process integration proof is green.

## Performance Considerations

- Opening performs full SQLite integrity and foreign-key checks because the accepted contract prioritizes truth over startup latency. Optimization requires measured evidence and cannot weaken the initial proof.
- Keep libSQL clients per opened Project session rather than per request, and close them deterministically.
- Keep `application.db` transactions short. Initial activation uses separate short transactions around physical staging and never holds a SQLite write lock while creating Project files.
- Use bounded directory inspection scoped to known application Storage roots; never crawl arbitrary repositories or drives.
- Avoid interactive libSQL write transactions until exact-version probes prove foreign-key enforcement on replacement connections; use short write batches for known statements.

## Migration Notes

- This is the first persistence behavior; there is no shipped SlopStop database to migrate.
- Three independent generated migration ledgers initialize application, canonical, and runtime-adapter schemas.
- Fresh creation applies only initial migrations. Opening an older supported schema reports `migration-required`; it does not execute migration in this slice.
- Opening a newer schema reports `unsupported-newer`; it never downgrades.
- Generated migration SQL and journals are committed and packaged. Schema push and `PRAGMA user_version` are not authority.
- The dependency lockfile and generated migrations are implementation outputs; their generated content is reviewed but not handwritten in this design.

## Developer Context

## References

- Design: `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md`
- Research: `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md`
- Recovery research: `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md`
- GitHub ticket #86: `https://github.com/TheMastermindPT/slopstop/issues/86`
- GitHub ticket #87: `https://github.com/TheMastermindPT/slopstop/issues/87`
- Pino destination and hook API: `https://github.com/pinojs/pino/blob/HEAD/docs/api.md`
- Pino log-rotation guidance: `https://github.com/pinojs/pino/blob/HEAD/docs/help.md#log-rotation`
- Pino transport and flush guidance: `https://github.com/pinojs/pino/blob/HEAD/docs/transports.md`

## Follow-up: 2026-09-02T22:48:10+0100

- Recovered implementation authority prospectively from clean baseline `f4685df`; the current dirty Phase 1-5 source and the append-only TDD Evidence below remain historical context and cannot satisfy any new Red, Green, review/refactor, or Success Criterion.
- Locked every Test Contract before Phase 1 while deferring each future failing test to the first action in its owning phase so earlier phases remain independently compilable. C51 is owned by Phase 1; C52-C54 are owned by Phase 3.
- Added one clause-level disposition for every existing Phase 1-5 behavior. Project Storage result forwarding is the sole behavior-preserving pre-existing Green and receives rerun-only proof; every other genuine behavior is redone in the isolated worktree.
- Added phase-owned harness fatal privacy, Desktop child-output privacy, bounded terminal shutdown, bounded JSONL records/retention, Sentry `abs_path` removal, complete migration-tree reproducibility, separate harness/Desktop mutation gates, and main-process-to-harness packaged Storage proof.
- Kept every retained or revised Phase 1-5 automated and manual criterion unchecked. Phase 6 remains blocked until all prospective Phase 1-5 proof and terminal commands pass.

## Plan Review (Step 4)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 5._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 3 §10 (`project-storage-store.ts`) | &lt;n/a&gt; | blocker | actionability | The fence ends after private `createProjectStorage` and never defines or exports `createProjectStorageOwner`, although Phase 3 tests and Phases 4–5 import that symbol. | Add the complete Phase 3 `createProjectStorageOwner` implementation and named export to this fence. | applied: added the transitional create/open/close/stop owner with expected failure mapping |
| code | Phase 3 §10 (`project-storage-store.ts`) | `tsconfig.base.json:18` | blocker | code-quality | `projectStorageManifestFilename` is imported but never referenced, so strict `noUnusedLocals` type checking fails. | Remove the unused import or use the constant in the store's path construction. | applied: removed the unused import from the source design and Phase 3 fence |
| code | Phase 3 §12 (`project-storage-node-adapters.ts`) | &lt;n/a&gt; | blocker | actionability | `createNodeProjectStorageDependencies` calls `createNodeAdapters`, but that function is neither defined in the fence nor supplied by an earlier phase or live module. | Include the complete same-file `createNodeAdapters` definition in Phase 3 §12. | applied: completed the Phase 3 creation adapter, Phase 4 opening extension, and merged design fence |
| code | Phase 4 §2 (`project-storage-store.ts`) | &lt;n/a&gt; | blocker | actionability | The replacement `createProjectStorageOwner` returns only `open`, `close`, and `stop`, omitting the required `create` method and deleting Phase 3 creation behavior. | Preserve the Phase 3 `create` implementation while replacing only opening and lifecycle behavior. | applied: retained the Phase 3 create path in the Phase 4 owner replacement |
| code | Phase 1 §6 (`project-storage-protocol.test.ts`) | &lt;n/a&gt; | concern | test-contract | The identity behavior promises malformed and nil rejection for both Project and Storage identities, but the test applies malformed and nil cases only to `StorageIdSchema`. | Add malformed and nil assertions for `ProjectIdSchema` with exact `success === false` results. | applied: added nil and malformed ProjectId assertions in design and Phase 1 |
| code | Phase 1 §6 (`project-storage-protocol.test.ts`) | &lt;n/a&gt; | concern | test-contract | The protocol introduces eight unhealthy status-to-diagnostic mappings, but the test verifies only the `missing` mapping. | Table-test every unhealthy status against its exact diagnostic code and at least one contradictory code. | applied: covered all eight status/code pairs and a contradictory code for each |
| code | Phase 2 §6 (`harness-runtime.ts`) | `apps/harness/src/harness-runtime.ts:56` | concern | codebase-fit | Project command exceptions still emit the Workspace-specific message `Harness failed while handling a workspace message.` | Replace it with a command-neutral harness failure message and pin it in a Project dispatch failure test. | applied: replaced the internal-failure text with a message-neutral value and added a dispatch contract |
| code | Phase 3 §6 (`generated-migrations.ts`) | &lt;n/a&gt; | concern | code-quality | A known latest `lastMigrationId` with a lower or contradictory format/schema version can be accepted as current. | Validate the version tuple against the authority expected for each migration ID before accepting current state. | applied: require exact current versions and test lower as well as newer contradictions |
| code | Phase 4 §2 (`project-storage-store.ts`) | &lt;n/a&gt; | concern | code-quality | `stop()` catches and discards every session `close()` failure, making failed resource release invisible. | Attempt all releases, retain failures, stop the registry, then surface an aggregate shutdown failure. | applied: aggregate release/registry failures only after attempting every cleanup |
| code | Phase 4 §3 (`project-storage-store.ts`) | &lt;n/a&gt; | concern | code-quality | `stop()` does not coordinate with an in-flight Phase 3 `create`, allowing creation to continue against a stopped registry. | Serialize stop against the installation-wide create lock and recheck `stopped` before post-await creation mutation. | applied: lifecycle-fenced every create await and returned one retained async stop Promise that closes admission immediately, drains the create lock, and surfaces registry failure to the original caller |
| code | Phase 5 §4 (`process-bootstrap.ts`) | &lt;n/a&gt; | concern | code-quality | `rootsOverlap` compares only lexical paths, so symlinked roots can resolve to the same physical tree while passing validation. | Resolve or reject symlink components for both roots before the overlap check. | applied: canonicalize the nearest existing ancestor and test physical overlap before composition |
| code | Phase 6 §2 (`project-storage-package-smoke.ts`) | `AGENTS.md:15` | concern | codebase-fit | Desktop main deletes `mastra.db` and creates persistence witnesses even though persistence behavior belongs to the Harness. | Move destructive smoke-state preparation behind a harness-owned package-smoke seam or an external E2E fixture. | applied: made the oracle bridge-only and moved persistence preparation to the external E2E fixture after child close |
| code | Phase 6 §3 (`main.ts`) | &lt;n/a&gt; | concern | code-quality | Any absolute smoke `userData` root can activate a scenario that deletes a runtime database, including an existing profile. | Require a freshly created empty smoke root with a dedicated marker before enabling the destructive scenario. | applied: require a random token, exclusive strict marker, and marker-only bootstrap root before `setPath` |
| coverage | `## Verification Notes §1` | &lt;n/a&gt; | concern | verification-coverage | The requirement to observe each stated public-seam expected-red is not represented in a phase Success Criteria bullet. | Add a Phase 1 Automated Verification bullet requiring recorded observation of each public-seam test's stated Expected red before implementation. | applied: added the stronger recorded Expected-red gate to every phase's Automated Verification criteria |
| code | Phase 2 §6, Phase 4 §3, Phase 5 §5 (`harness-runtime.ts`, `project-storage-store.ts`, `process-entry.ts`) | &lt;n/a&gt; | blocker | code-quality | C11: Shutdown is synchronous even though registry cleanup may wait for an in-flight create, so the original caller cannot observe completion or failure and delayed failure is handed to a later same-owner call. | Make owner/application/runtime stop return one retained Promise, drain all cleanup before settlement, preserve ordered aggregate failures, and observe rejection once at process entry. | applied: synchronized all stop signatures and fences, retained one Promise at owner and runtime, added attempt-all aggregate cleanup, removed same-owner failure handoff, and added generic process-boundary observation with exact `Harness shutdown failed.` contract |
| code | Phase 4 §1/§2/§5 (`project-storage-opening.ts`, `project-storage-node-adapters.ts`) | &lt;n/a&gt; | blocker | correctness | C12: The probe maps every non-access exception to corrupt, hiding unexpected SQL and adapter failures as data corruption. | Add an explicit broken probe outcome, recognize only `SQLITE_CORRUPT` and `SQLITE_NOTADB` as corrupt, and pin both branches with pure and real-libSQL tests. | applied: added broken to the probe union/classifier, strict unknown-safe SQLite code access, exact recognized-code mapping, stable broken diagnostics, and no-path-leak integration proof |
| code | Phase 3 §12, Phase 4 §3/§5 (`project-storage-node-adapters.ts`) | &lt;n/a&gt; | blocker | correctness | C13: A valid selected generation can open read-write while an extra ordinary generation or root-level database/sidecar witness remains in the same Project namespace. | Retain normalized ordinary generation IDs and root database witness presence during scanning, then require exactly the selected generation and no root witness before opening. | applied: extended the filesystem scan and opening predicate and added preserved-state recovery-required tests for an orphan generation, root canonical database, and root runtime sidecar |
| code | Phase 4 §5/§6 (`project-storage-node-adapters.ts`) | &lt;n/a&gt; | blocker | code-quality | C14: Recursive `finally` release attempts every client but only one close exception escapes, losing other cleanup failures. | Attempt every opened client once, preserve failures in deterministic order, and throw an exact aggregate release error while keeping repeated release idempotent. | applied: replaced recursive cleanup with attempt-all aggregation and added exact `Project Storage database release failed.` ordering/idempotency proof |
| code | Phase 2 §7/§9 (`harness-runtime.test.ts`, `harness-runtime.integration.test.ts`) | `apps/harness/src/harness-runtime.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts` | blocker | actionability | C15: `StopHarnessRuntime` becomes asynchronous, but eleven retained test cleanups remain bare `stop();` calls and four affected unit tests remain synchronous, leaving rejected shutdown Promises unobserved and allowing integration ports to close first. | Enumerate every retained call-site delta, make the four unit declarations async, and await stop before assertions or port closure. | applied: added the exact eight-unit/three-integration conversion inventory, required all eleven calls to use `await stop();`, and added a static no-bare-stop success criterion |
| code | Phase 3 §10/§12 (`project-storage-store.ts`, `project-storage-node-adapters.ts`) | &lt;n/a&gt; | blocker | correctness | C16: The create fingerprint is computed only after the first registry decision, omits `createRequestId`, and is not supplied to registry inspection, so replay authority cannot validate the complete request it claims to identify. | Compute the versioned fingerprint of `{version, projectId, createRequestId}` before inspection, lifecycle-fence that await, and pass the value through the interface and every inspection/recheck. | applied: moved complete-request hashing before first inspection, changed the registry signature, synchronized staging/activation rechecks, and added an exact hash-before-inspect unit oracle |
| code | Phase 4 §4 (`project-storage-store.test.ts`) | &lt;n/a&gt; | blocker | compilability | C17: Phase 4 makes `opening.inspect` mandatory but the retained Phase 3 store fixture's dependency literal is not updated, so the required creation regression suite cannot type-check independently. | State the complete merged fixture delta and provide a typed non-registered opening default while removing only the transitional no-opening test. | applied: preserved every Phase 3 fixture field and added the exact typed `opening.inspect` default in the Phase 4 regression adjustment |
| code | Phase 3 §12 (`project-storage-node-adapters.ts`) | &lt;n/a&gt; | concern | correctness | C18: Active replay parses `create_request_fingerprint` but never compares it with the recomputed request fingerprint, permitting tampered or disagreeing authority to replay as created. | Compare the stored and recomputed fingerprints before staging/active classification and fail with one stable path-free broken-authority diagnostic. | applied: added exact fingerprint equality enforcement and a real-libSQL tampering test for `Create request fingerprint does not agree.` with preserved state |
| code | Phase 3 §12/§13 (`project-storage-node-adapters.ts`, `project-storage-create.integration.test.ts`) | &lt;n/a&gt; | concern | correctness | C19: Registry witness discovery reaches `storage_locations` only through generation rows, so an orphan location at the deterministic Project path is treated as clean and creation may proceed. | Query `storage_locations.normalized_path` directly for the normalized deterministic Project root, union it with generation-linked locations, and prove allocation/mutation remain zero. | applied: added direct normalized-path witness lookup, deduplicated the witness kind, and added preserved-state real-libSQL orphan-location coverage |
| code | Phase 4 §3/§8 (`project-storage-store.ts`, `project-storage-lifecycle.integration.test.ts`) | &lt;n/a&gt; | concern | lifecycle | C20: Stop drains only the create lock; an admitted open or close can outlive registry shutdown, and a late candidate-release failure cannot reach the original stop Promise. | Track every admitted open/create/close by sequence, wait them before session/registry cleanup, retain late-release failures in deterministic order, and prove the public transport result and shared stop rejection. | applied: added all-operation admission tracking, late-release failure retention, post-stop fast refusal, and a pending-open transport test that pins registry ordering and aggregate failure ownership |
| code | Phase 4 §5/§6 (`project-storage-node-adapters.ts`) | &lt;n/a&gt; | concern | determinism | C21: Concurrent canonical/runtime probes push clients into one completion-ordered array, so release and aggregate error order vary with probe timing rather than database role. | Store clients in fixed canonical/runtime slots and release in canonical-then-runtime order regardless of completion/insertion order. | applied: replaced the array with typed fixed slots and added a runtime-first fixture proving canonical-then-runtime calls, errors, and idempotency |
| code | Phase 4 §4 (`project-storage-store.test.ts`) | &lt;n/a&gt; | blocker | compilability | C22: The merged fixture annotates `ProjectStorageOpenEvidence` but does not import the type, so Phase 4's required retained creation regression suite cannot type-check independently. | Add the exact type-only import from `./project-storage-opening.js` and preserve every still-used Phase 3 test import. | applied: added the exact type-only import beside the mandatory opening default and explicitly retained all used creation-test imports |
| code | Phase 5 §15 (`harness-supervisor.test.ts`) | `apps/desktop/src/main/harness-supervisor.test.ts:94-103` | blocker | actionability | C23: The new required parsed bootstrap constructor argument is not applied to the existing live `supervisorWith` helper, leaving every retained supervisor test uncompilable. | Define one shared `HarnessBootstrapSchema.parse(...)` fixture, pass it as the third argument at every direct construction, and preserve the existing entry-path/logger dependencies and all tests without non-null assertions or casts. | applied: inventoried the sole live direct construction, updated `supervisorWith` with the shared validated bootstrap, and preserved every existing test body and dependency |
| code | Phase 4 §5/§7 (`project-storage-node-adapters.ts`, `project-storage-open.integration.test.ts`) | &lt;n/a&gt; | concern | correctness | C24: Opening can return `not-registered` when create already sees an orphan `storage_locations` row at the deterministic normalized Project root as a prior-state witness. | Reuse the strict direct `normalized_path` query before opening absence and prove one real orphan row blocks create and yields path-free recovery-required opening without mutation. | applied: opening now uses the same normalized-root lookup and a real-libSQL consistency test pins create blocked plus canonical/runtime recovery-required with unchanged state |
| code | Phase 4 §8 (`project-storage-lifecycle.integration.test.ts`) | &lt;n/a&gt; | concern | lifecycle | C25: The shutdown contract claims admitted close operations are drained, but only open/create representatives are held pending through stop. | Add a public lifecycle test that defers an admitted close at the Project-operation seam, proves stop and registry remain pending, then releases successfully and proves one close settlement before registry shutdown and stop completion. | applied: added the successful deferred-close test, retained-stop identity check, exact once-only release/registry assertions, and an oracle explicitly covering open/create/close representatives |
| code | Phase 4 §5/§7 (`project-storage-node-adapters.ts`, `project-storage-open.integration.test.ts`) | &lt;n/a&gt; | blocker | correctness | C26: Contradictory non-null active registration, generation, and location pointers can fall through to recovery-required even though all rows claim active authority. | Route active pointer/state disagreement through the existing broken application-authority path and pin the exact public diagnostic with real-libSQL no-mutation proof. | applied: active registration/generation/location disagreement throws stable internal inconsistency, real libSQL returns exactly broken/PROJECT_STORAGE_OWNER_FAILED/Project Storage authority is internally inconsistent., and the durable snapshot remains unchanged |
| code | Phase 5 §2 (`protocol.test.ts`) | &lt;n/a&gt; | blocker | compilability | C27: The trusted-bootstrap test uses `HarnessBootstrapSchema` without adding it to the retained `./index.js` value import. | Merge the schema into the existing import block without introducing a duplicate or unused binding. | applied: added `HarnessBootstrapSchema` to the retained Phase 5 protocol-test import in both final artifacts |
| code | Phase 5 §15 (`harness-supervisor.test.ts`) | &lt;n/a&gt; | blocker | actionability | C28: The supervisor forwarding test iterates `projectStorageResultEvents` without defining validated concrete events. | Import the three result-event factories and request schemas, then define unique valid open/create/close events before the test. | applied: added parsed requests plus unique factory-built open/create/close result events before the forwarding test and reused that concrete array as the exact oracle |
| code | Phase 3 §12, Phase 4 §6/§7 (`project-storage-node-adapters.ts`, adapter/open tests) | &lt;n/a&gt; | concern | resource-lifecycle | C29: Existing and mutable application-client helpers retain only after `requireForeignKeys`, so initialization failure can leak a client and dual initialization/close failure loses deterministic ownership. | Retain before initialization, clear and close exactly once on failure, preserve original then close error in a path-free ordered `AggregateError`, and normalize only at the stable public owner boundary. | applied: both helpers use one retained-client initializer; unit tests pin retain/clear/close order and ordered dual failure, while real existing/mutable paths return the exact generic broken owner diagnostic without caught text or paths |
| code | Phase 5 §14-§16, Phase 6 §3 (`harness-supervisor.ts`, desktop shutdown/main/package smoke) | &lt;n/a&gt; | concern | lifecycle | C30: Supervisor stop and Electron quit/package callers do not jointly await natural child exit, allowing utility-process/database handles to outlive desktop shutdown and leaving Promise chains floating. | Make supervisor stop one retained Promise, detach first, cancel retries, wait bounded natural exit, kill only on timeout and still await exit; route quit/startup/package outcomes through one retained desktop shutdown with exact fallback/idempotence tests. | applied: synchronized supervisor tests and callers, added natural/timeout/actual-exit proof, retained ordered desktop shutdown with one allowed quit re-entry and nonzero fallback, and made package/startup tasks retain and await `requestExit` without floating Promises |
| coverage | Phase 6 §3/§6 (`package-smoke-authorization.ts`, `package-smoke.mjs`) | &lt;n/a&gt; | concern | verification-coverage | C31: Packaged proof exercises only authorized launches, so invalid installed authorization order, generic output, mutation refusal, and Windows-safe child cleanup are unproved. | Run bounded relative-root, malformed-token, missing-marker, mismatched-token, symlink/non-regular-marker, and extra-entry cases before the valid matrix; require nonzero exact generic output, no root/token, no Storage effects, and child close before cleanup. | applied: added the full pre-valid negative matrix with optional supported symlink case, exact stderr/nonzero/no-leak/no-storage assertions, close-owned cleanup, and retained the filesystem-free bridge oracle plus validation-before-setPath unit proof |
| code | Phase 4 §6/§7 (`project-storage-node-adapters.test.ts`, `project-storage-open.integration.test.ts`) | &lt;n/a&gt; | concern | test-contract | C32: The adapter unit's ordered application-client initialization `AggregateError` and the public opening result's generic `Project Storage owner failed.` diagnostic appear to require one shared message. | Replace one message so the internal and public assertions agree. | dismissed: the ordered initialization aggregate is the correct internal adapter diagnostic, while `Project Storage owner failed.` is the separate correct public application-boundary diagnostic; no implementation change is required |
| code | Phase 5 §15 (`harness-supervisor.test.ts`) | `apps/desktop/src/main/harness-supervisor.test.ts:220-281` | blocker | actionability | C33: The plan adds a separate natural-exit stop test but leaves the retained live stop test synchronous with immediate-kill/stopped assertions. | Update the retained live test itself to await stop, emit natural exit, and pin detach/exit/kill/status ordering. | applied: changed the retained live test to async, replaced its shutdown tail with one retained awaited stop, proved session detach before natural exit, no kill through 4,999 ms, and stopped status only after exit; kept the timeout-fallback test separate |
| code | Phase 5 §14/§15 (`harness-supervisor.ts`, `harness-supervisor.test.ts`) | `apps/desktop/src/main/harness-supervisor.ts:76-92` | blocker | lifecycle | C34: A completed supervisor stop retains `#stopPromise`, so start followed by a later stop can return the stale completed Promise and leave the replacement child uncontrolled. | Admit restart only after stop completion, reset the retained stop lifecycle at that boundary, and update the existing restart test to prove the new child owns a distinct later stop. | applied: start is blocked while `#stopping`, completed stop clears pending state, the next valid start clears only the completed `#stopPromise`, and the updated timeout/restart test proves pending restart refusal plus a distinct later stop that detaches and awaits the replacement child's exit while preserving synchronous spawn-failure coverage separately |
| code | Phase 2 §7 (`harness-runtime.test.ts`) | `apps/harness/src/harness-runtime.test.ts:295-338` | blocker | actionability | C35: The Phase 2 Test Contract names a rejected `project.open` neutral-failure test, but the emitted test fence contains only unavailable dispatch and shutdown tests. | Emit the exact named Project rejection test with concrete owner, command, imports, fixture delta, correlation, neutral diagnostic, and no caught-text leak. | applied: added the named rejected-open unit test with merged strict imports, concrete parsed request/command and rejecting owner, exact correlated `HARNESS_INTERNAL_FAILURE/retryable:false/Harness failed while handling a message.` event, no Workspace or thrown path text, and awaited cleanup |
| code | Phase 4 §5/§7 (`project-storage-node-adapters.ts`, `project-storage-open.integration.test.ts`) | &lt;n/a&gt; | blocker | correctness | C36: `requireApplicationIntegrity` runs after registry inspection and is skipped by `recovery-required`, allowing Project recovery evidence to outrank corrupt application authority. | Run application integrity before every registry status branch and add a real ordering case combining application corruption with Project recovery evidence. | applied: moved integrity ahead of registry inspection and added a real foreign-key-violation plus missing-active-location case that returns exact top-level broken authority, never recovery/absence, with unchanged state and no path leak |
| coverage | Phase 2 §8 and Phase 5 Test Contract (`process-shutdown.test.ts`, `process-bootstrap.integration.test.ts`) | &lt;n/a&gt; | blocker | test-contract | C37: Phase 5 re-owns the Phase 2 generic shutdown-rejection test with an impossible new Expected red instead of proving the composition change introduced in Phase 5. | Keep generic process-boundary rejection in Phase 2 and replace the Phase 5 behavior with one concrete persistent-owner transport composition test whose red is the Phase 2 unavailable owner. | applied: removed Phase 5 shutdown-rejection behavior and duplicate verification ownership, retained it in Phase 2, and strengthened the uniquely named process-bootstrap integration to pin not-registered then exact create/open/close persistent results against the Phase 2 unavailable-owner red |
| coverage | Phase 6 §6 (`package-smoke.mjs`) | &lt;n/a&gt; | concern | verification-coverage | C38: The negative package matrix misses parser and marker-shape branches and can accidentally inherit omitted smoke values by assigning `undefined` into the child environment. | Cover every scenario/root/token/marker branch and explicitly delete omitted environment keys while retaining bounded close-owned no-effect assertions. | applied: expanded the actionable table to invalid/missing scenario, missing/relative root, missing/malformed token, malformed JSON, wrong version, extra marker field, token mismatch, missing marker, non-marker-only root, non-regular marker, and supported symlink; omitted keys are deleted and every closed child pins exact generic nonzero/no-leak/no-storage behavior |
| code | Phase 6 §6 (`package-smoke.mjs`) | &lt;n/a&gt; | concern | test-contract | C39: The symlink marker target is created inside the authorized root, so the root has an extra entry and can fail the marker-only guard without proving symlink rejection. | Create the target outside the authorized root, leave only the symlink marker inside, and clean the external target after child close with skip limited to unsupported symlink creation. | applied: moved the target to a separate temporary fixture, preserved a marker-only authorized root, waits for child close before cleaning both fixtures, and retains only unsupported-platform symlink creation as the skip path |
| code | Phase 5 §15 (`harness-supervisor.test.ts`) | `apps/desktop/src/main/harness-supervisor.test.ts:415-445` | blocker | correctness | C40: The replacement restart test expects handshake timeout to change supervisor state to `crashed`, contradicting the preserved exact `degraded` timeout state. | Expect `degraded` with `HARNESS_HANDSHAKE_TIMEOUT`; retain synchronous spawn failure as the focused `crashed/HARNESS_START_FAILED` case. | applied: changed only the handshake-timeout state to `degraded`, retained its diagnostic code, kept synchronous spawn failure `crashed`, and synchronized the Phase 5 oracle in both artifacts |
| code | Phase 3 §5/§12/§12a (`project-storage-errors.ts`, `project-storage-node-adapters.ts`, adapter test) | &lt;n/a&gt; | concern | error-preservation | C41: If an operation or commit fails and rollback also fails, `withWriteTransaction` replaces the primary failure with a cause-less rollback error. | Preserve `[operationError, rollbackError]` in an `AggregateError("Project Storage transaction and rollback both failed.")` used only as the cause of path-free `ProjectStorageBrokenError("Project Storage transaction rollback failed.")`; prove rollback, finally-close, order, identity, and generic public normalization. | applied: added the strict cause-forwarding error constructor, deterministic dual-failure aggregate cause, operation/commit parameterized adapter test, exact finally-close assertions, and path-free public result that excludes both caught failures and the internal aggregate message |
| code | Phase 3 §2/§13 (`storage-schema-constraints.ts`, creation integration) | &lt;n/a&gt; | concern | correctness | C42: The UUID CHECK's whole-value GLOB allows hyphens inside hexadecimal segments, so malformed boundary placement can satisfy database authority even though protocol identities reject it. | Validate each fixed UUID segment independently, retain versions 1-8 and variants 8/9/a/b, and prove the real schema accepts every supported class while rejecting replacement hyphens and uppercase text. | applied: replaced the permissive whole-value GLOB with exact segment/position checks and added real SQLite accepted/rejected identity coverage with fixed lowercase values |
| code | Phase 3 §12/§13 (`project-storage-node-adapters.ts`, creation integration) | &lt;n/a&gt; | concern | correctness | C43: Database verification checks only table names, so missing or extra named CHECK constraints, named indexes, and foreign keys can pass as current authority. | Declare exact object metadata per database, inspect `sqlite_schema` and SQLite pragma metadata, reject missing and unexpected objects with stable diagnostics, and run the verifier at every creation/opening authority seam. | applied: added typed exact schema-object specs, multiplicity-aware CHECK/index/foreign-key comparison, wired all creation/sealed/application/opening paths, and added real omission plus unexpected-object tests for all three families |
| code | Phase 4 §5/§7 (`project-storage-node-adapters.ts`, opening integration) | &lt;n/a&gt; | concern | resource-lifecycle | C44: Concurrent Projects can race application-client initialization, and a failed attempt can clear or leak ownership without a retry-safe identity check. | Share one memoized initialization Promise, let only that Promise clear its slot, close a failed candidate once, retain a successful candidate until registry stop, and prove concurrent sharing plus failure/retry close counts. | applied: introduced one identity-checked initialization slot, retained successful ownership through registry stop, and added deferred cross-Project sharing plus failed-candidate/retry tests with exact close counts and path-free diagnostics |
| coverage | Phase 3 §12a/Test Contract (`project-storage-node-adapters.test.ts`) | &lt;n/a&gt; | concern | test-contract | C45: Generated migration guards are private prose without an executable exact-message matrix, and malformed JSON/Zod journal input is not normalized to one stable diagnostic. | Export the loader for adapter testing and table-test every reachable authority guard with real temporary resources, exact path-free messages, and normalized malformed journal failures. | applied: exported `loadGeneratedMigrations`, normalized JSON/Zod failures, removed redundant post-directory checks, and added fixtures for root/type/journal/order/resource/SQL/object/table guards with exact diagnostics |
| code | Phase 4 §3/§8 (`project-storage-store.ts`, lifecycle integration) | &lt;n/a&gt; | concern | determinism | C46: Sessions are inserted into the retained Map when opening completes, so shutdown release order follows completion/Map order rather than operation admission order. | Store the open admission sequence beside each retained session, sort before shutdown release, and prove first-admitted A releases before second-admitted B when B completes first. | applied: retained `{session, admissionSequence}`, preserved current-session close semantics, sorted shutdown release by admission, and added the reverse-completion transport test with exact `[A, B]` release order |
| coverage | Phase 6 §6/Test Contract (`package-smoke.mjs`) | &lt;n/a&gt; | concern | portability | C47: Deriving the relative-root negative input with `path.relative(process.cwd(), root)` can return an absolute path across Windows drives and accidentally authorize the supposedly invalid case. | Pass one fixed relative literal and pin that value and cross-drive rationale in the executable matrix and Test Contract oracle. | applied: introduced exact `relative-smoke-root`, removed the cross-drive-sensitive derivation, and synchronized Design/Plan narrative plus oracle wording that forbids `path.relative` for this case |
| code | Phase 5 §3a/§4/§16 (`vite.harness.config.ts`, process/Desktop composition) | &lt;n/a&gt; | blocker | actionability | C48: Development bootstrap points at `.vite/build/harness-migrations`, but migration staging first appears in Phase 6, so Phase 5 persistent Desktop composition cannot run independently. | Stage checked-in migrations byte-for-byte in Phase 5, then extend that one plugin with native/package behavior in Phase 6. | applied: moved development migration staging to Phase 5 before composition and made Phase 6 extend the same plugin without duplicate migration staging |
| code | Phase 5 §14 (`harness-supervisor.ts`) | `apps/desktop/src/main/harness-supervisor.ts:260-303` | blocker | correctness | C49: The supervisor delta replaces `#connectChild` with only port attachment and bootstrap posting, deleting handshake send, send-failure handling, timeout setup, and their lifecycle transitions. | Replace only the bootstrap payload while retaining the complete existing method after it. | applied: emitted the complete method with parsed trusted bootstrap plus unchanged handshake, failure, timeout, logging, status, kill, and port-transfer behavior |
| code | Phase 5 §14/§15 (`harness-supervisor.ts`, supervisor tests) | `apps/desktop/src/main/harness-supervisor.ts:112-142` | blocker | correctness | C50: The supervisor delta replaces `#handleHarnessMessage` with no-op cases, deleting ready timeout clearing, failure recovery handling, and established Workspace/protocol continuity. | Merge Project result cases into the existing exhaustive switch and retain ready/failure/protocol behavior with regression proof. | applied: restored complete ready/failure branches, merged Project results beside forwarded health-ignored Workspace results, retained protocol handling, and kept ready/failure tests explicit |
| code | Phase 1/Phase 3 protocol mappings | &lt;n/a&gt; | concern | correctness | C51: Blocked-reason protocol mappings may drift or accept contradictory diagnostics without a complete authority matrix. | Add exhaustive mapping proof before implementation. | applied prospectively: the contract is locked before Phase 1; the failing public-seam matrix is Phase 1's first action and its minimal implementation precedes Phase 1 Green; current working-tree Green is explicitly unaccepted |
| code | Phase 3 schema authority | &lt;n/a&gt; | concern | correctness | C52: Named CHECK discovery may verify presence without proving the exact CHECK expression remains authoritative. | Compare normalized authoritative CHECK expressions and mutation cases. | applied prospectively: Phase 3 owns exact token-normalized CHECK comparison, malformed-definition rejection, focused Red/Green, and review/refactor proof |
| code | Phase 3 schema authority | &lt;n/a&gt; | concern | correctness | C53: Partial indexes may retain expected names and columns while a changed `WHERE` predicate silently weakens authority. | Verify each authoritative partial-index predicate exactly. | applied prospectively: Phase 3 owns exact token-normalized partial-index predicate comparison with no name-only fallback and focused Red/Green proof |
| coverage | Phase 3 schema mutation tests | &lt;n/a&gt; | concern | verification-coverage | C54: Missing/unexpected-object tests do not prove rejection when an expected schema object keeps the same name but its definition is mutated. | Add same-name altered CHECK/index/foreign-key mutation cases. | applied prospectively: Phase 3 owns the real-libSQL same-name altered CHECK, partial-index predicate, and full foreign-key-definition matrix before Green |

## TDD Evidence (implement)

### Phase 1: Project Storage Identities And Protocol
- Behavior: Project and Storage identity schemas accept lowercase RFC 4122 UUID text and reject malformed, nil-version, and uppercase identities at the protocol boundary. — Test: `validates Project Storage identities` (`packages/protocol/src/project-storage-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "validates Project Storage identities"` -> `StorageIdSchema` was absent, so the public schema call failed while reading `safeParse`.
  - Green: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "validates Project Storage identities"` -> pass.
- Behavior: Open results represent healthy, safe-mode, legitimate absence, unavailable, and broken as mutually exclusive strict branches. — Test: `rejects contradictory Project Storage open results` (`packages/protocol/src/project-storage-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "rejects contradictory Project Storage open results"` -> `ProjectStorageOpenResultSchema` was absent, so the public schema call failed while reading `safeParse`.
  - Green: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "rejects contradictory Project Storage open results"` -> pass.
- Behavior: Database health diagnostics cannot contradict their health status. — Test: `binds health diagnostics to exact statuses` (`packages/protocol/src/project-storage-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "binds health diagnostics to exact statuses"` -> the first valid non-corrupt status/code pair parsed as false instead of true because the complete typed mapping did not exist.
  - Green: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "binds health diagnostics to exact statuses"` -> pass.
- Behavior: Create results preserve the durable create request and exact blocked reason without admitting success fields on failure. — Test: `validates create and close result branches` (`packages/protocol/src/project-storage-protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "validates create and close result branches"` -> `ProjectStorageCreateResultSchema` was absent, so the public schema call failed while reading `safeParse`.
  - Green: `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "validates create and close result branches"` -> pass with C51's three valid blocked mappings and all six contradictory mappings rejected.
- Test-lint: unavailable; the repository exposes no test-theater script or ast-grep rule pack.
- Mutation: unavailable; the repository exposes no plan-scoped mutation command, and repository policy keeps the generic mutation gate explicit and risk-based.
- Code Health: `packages/protocol/src/workspace-protocol.ts` remained 10; new `packages/protocol/src/domain-identity-schema.ts` scored 10; new `packages/protocol/src/project-storage-protocol.ts` improved 9.38 -> extracted shared `ProjectStorageBrokenDiagnosticSchema` -> 10 with the duplication smell eliminated; type-only and barrel files were not assessable. The pre-commit safeguard passed with 7 eligible files and no issues.

### Phase 2: Harness Application Port And Dispatch
- Behavior: Protocol v3 round-trips each Project Storage command and its correlated result while rejecting protocol v2. — Test: `round-trips Project Storage envelopes under protocol version 3` (`packages/protocol/src/protocol.test.ts`)
  - Red: `pnpm exec vitest run packages/protocol/src/protocol.test.ts -t "round-trips Project Storage envelopes under protocol version 3"` -> `createProjectOpenCommand` was absent, so the public factory call failed.
  - Green: `pnpm exec vitest run packages/protocol/src/protocol.test.ts -t "round-trips Project Storage envelopes under protocol version 3"` -> pass.
- Behavior: The no-store application reports every operation as unavailable and never invents `not-registered`. — Test: `echoes every unavailable request and delegates stop` (`apps/harness/src/project-storage-application.test.ts`)
  - Red: `pnpm exec vitest run apps/harness/src/project-storage-application.test.ts -t "echoes every unavailable request and delegates stop"` -> `createProjectStorageApplication` was absent, so no Project Storage application boundary could be constructed.
  - Green: `pnpm exec vitest run apps/harness/src/project-storage-application.test.ts -t "echoes every unavailable request and delegates stop"` -> pass.
- Behavior: Owner absence, malformed/mismatched owner output, and owner failure remain distinct at the application boundary. — Test: `keeps unavailable, invalid, and failed owner outcomes distinct` (`apps/harness/src/project-storage-application.test.ts`)
  - Red: `pnpm exec vitest run apps/harness/src/project-storage-application.test.ts -t "keeps unavailable, invalid, and failed owner outcomes distinct"` -> a blank unavailable message remained `"   "` instead of the exact fallback, proving the Storage-specific revalidation boundary was incomplete.
  - Green: `pnpm exec vitest run apps/harness/src/project-storage-application.test.ts -t "keeps unavailable, invalid, and failed owner outcomes distinct"` -> pass.
- Behavior: Every valid Project Storage command receives exactly one correlated result event from the harness runtime. — Test: `dispatches Project Storage commands sequentially with exact unavailable results` (`apps/harness/src/harness-runtime.test.ts`)
  - Red: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "dispatches Project Storage commands sequentially with exact unavailable results"` -> the runtime emitted zero events after `project.open` because the Project Storage switch branches did not exist.
  - Green: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "dispatches Project Storage commands sequentially with exact unavailable results"` -> pass.
- Behavior: Unexpected command failures use one domain-neutral process diagnostic. — Test: `reports a neutral internal failure when Project dispatch throws` (`apps/harness/src/harness-runtime.test.ts`)
  - Red: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "reports a neutral internal failure when Project dispatch throws"` -> the emitted message was `Harness failed while handling a workspace message.` instead of the exact neutral diagnostic.
  - Green: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "reports a neutral internal failure when Project dispatch throws"` -> pass.
- Behavior: Project Storage envelopes survive the real structured-clone transport seam. — Test: `round-trips all unavailable Project Storage commands over structured clone` (`apps/harness/tests/integration/harness-runtime.integration.test.ts`)
  - Red: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts -t "round-trips all unavailable Project Storage commands over structured clone"` -> `project.open` produced correlated `system.failure/HARNESS_INTERNAL_FAILURE` because the integration runtime had no Project Storage application.
  - Green: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts -t "round-trips all unavailable Project Storage commands over structured clone"` -> pass. The harness integration config was required because the root Vitest projects exclude integration tests; this execution adaptation was approved through the Phase 2 mismatch flow.
- Behavior: Runtime shutdown detaches intake once and returns one observable Project Storage stop Promise. — Test: `stops intake before exposing one observable Project Storage stop promise` (`apps/harness/src/harness-runtime.test.ts`)
  - Red: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "stops intake before exposing one observable Project Storage stop promise"` -> repeated stop calls detached both subscriptions twice and never invoked `projectStorageApplication.stop`.
  - Green: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "stops intake before exposing one observable Project Storage stop promise"` -> pass.
- Behavior: Every retained runtime-test cleanup observes the asynchronous stop before teardown continues. — Tests: all retained runtime unit and structured-clone integration tests
  - Red: exact-file static audit for bare `stop();` calls -> 10 unit and 4 integration cleanups floated the new stop Promise.
  - Green: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts` -> 11 tests pass; `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts` -> 4 tests pass; exact-file static audit -> no bare `stop();` calls, with every port close after `await stop();`.
- Behavior: Port-close shutdown observes rejection once and forwards only the generic process diagnostic. — Test: `observes one runtime shutdown rejection without forwarding its cause` (`apps/harness/src/process-shutdown.test.ts`)
  - Red: `pnpm exec vitest run apps/harness/src/process-shutdown.test.ts -t "observes one runtime shutdown rejection without forwarding its cause"` -> `createHarnessPortCloseHandler` was absent, so no retained shutdown observer could be constructed.
  - Green: `pnpm exec vitest run apps/harness/src/process-shutdown.test.ts -t "observes one runtime shutdown rejection without forwarding its cause"` -> pass.
- Test-lint: unavailable; the repository exposes no test-theater script or ast-grep rule pack.
- Mutation: unavailable; the repository exposes no plan-scoped mutation command, and repository policy keeps the generic mutation gate explicit and risk-based.
- Code Health: `packages/protocol/src/protocol.ts`, `apps/harness/src/harness-runtime.ts`, and `apps/harness/src/process-entry.ts` remained 10; new `apps/harness/src/process-shutdown.ts` scored 10; new `apps/harness/src/project-storage-application.ts` improved 9.09 -> grouped outcome mapping arguments, eliminating Excess Number of Function Arguments -> 9.38 -> extracted generic unavailable-result parsing, eliminating Code Duplication -> 10. Barrel files were not assessable.

### Phase 3: Staged Creation And Witness Guard
- Behavior: Manifest v1 owns one deterministic, strict first-generation representation. - Test: `serializes the exact initial manifest and rejects non-v1 shapes` (`apps/harness/src/storage/project-storage-manifest.test.ts`)
  - Red: the named public schema/serialization seam did not exist, so the fixed manifest could not parse or serialize.
  - Green: `pnpm exec vitest run apps/harness/src/storage/project-storage-manifest.test.ts` -> pass.
- Behavior: Generated migration authority applies only a known pending suffix and every generated-resource guard fails closed. - Tests: `applies only known pending migrations and rejects inconsistent authority`; `rejects generated migration guard: $name`
  - Red: migration ownership and the executable resource-guard matrix were absent; malformed resources were not normalized to stable path-free failures.
  - Green: the complete storage unit command -> pass, including all migration authority and resource-guard cases.
- Behavior: Transaction rollback preserves ordered operation/commit and rollback failures without leaking them publicly. - Test: `preserves %s and rollback failures internally while exposing one generic failure`
  - Red: rollback failure replaced the primary failure and had no ordered aggregate cause.
  - Green: both operation and commit cases pass with exact internal cause order and generic public output.
- Behavior: Clean creation produces exactly eight valid domain tables, one sealed generation, agreeing persisted identities/baselines, and strict lowercase UUID authority. - Tests: `creates a sealed initial generation under the deterministic Project namespace`; `creates exactly eight domain tables with valid SQLite integrity`; `enforces exact lowercase UUID segments in the real application schema`
  - Red: no persistent creator, generated migrations, database triplet, manifest, or segment-exact UUID checks existed; the prior whole-value GLOB admitted malformed boundaries.
  - Green: the complete real-libSQL creation suite -> pass.
- Behavior: Exact CHECK/index/foreign-key metadata and application migration authority fail closed without Project mutation. - Tests: `rejects one omitted $name through real SQLite metadata`; `rejects one unexpected $name through real SQLite metadata`; `rejects malformed application migration authority: $name`
  - Red: verification compared table names only and malformed application authority had no strict non-mutating inspection path.
  - Green: all omission, unexpected-object, and malformed-authority matrices pass with stable path-free diagnostics.
- Behavior: Every registry/filesystem witness, including an orphan deterministic-path location, blocks before allocation or absent-authority initialization. - Tests: `blocks the %s witness without allocating`; `blocks an orphan location at the deterministic Project path before allocation`; `blocks a filesystem witness before initializing application.db`
  - Red: no bounded witness guard existed, location discovery depended on generation joins, and filesystem inspection did not prove non-creating behavior.
  - Green: all witness kinds and both real authority cases pass with zero forbidden mutation.
- Behavior: Inspection failures, complete fingerprints, replay/conflict precedence, installation serialization, and incomplete requests remain mutually distinct. - Tests: `keeps unavailable and broken witness inspection distinct from absence`; `passes the exact request fingerprint to the first registry inspection`; `creates once, replays exactly, and rejects conflicting reuse without mutation`; `treats an active replay fingerprint mismatch as broken authority`; `serializes installation-wide create decisions before allocation`; `applies request and registration precedence before witness inspection`; `blocks an incomplete exact request without cleanup or reallocation`
  - Red: persistence classification, complete fingerprint ownership, durable replay precedence, installation locking, and incomplete-request handling were absent or ordered incorrectly.
  - Green: all named store and real-libSQL replay tests pass with exact no-mutation outcomes.
- Behavior: Transaction A and B recheck authoritative state, sealed databases verify lineage, and activation commits only exact final authority.
  - Red: `rechecks create authority inside the staging transaction` expected `blocked/idempotency-conflict` but received `broken/PROJECT_STORAGE_OWNER_FAILED`; `rejects activation when staging authority changed before the transaction`, `rejects activation when final authority does not exactly agree`, and `rejects a sealed database whose lineage disagrees with creation authority` each expected `broken` but received `created`.
  - Green: each focused real-libSQL command passes; Transaction A returns non-fresh authority before inserts, Transaction B requires three single-row state transitions plus exact in-transaction re-read, and sealed identity compares database lineage and creation time.
- Behavior: Every creation checkpoint retains its exact durable prefix and restart outcome.
  - Red: no failure-injectable staged creation state machine existed.
  - Green: `preserves witnesses and refuses cleanup after $checkpoint` -> 17/17 pass with exact registry rows and exact staging/active directory entries before and after retry.
- Behavior: Stop closes admission immediately, drains admitted create work before registry closure, and starts no mutation after the next lifecycle boundary.
  - Red: `drains an admitted create before closing the registry` expected stop to remain pending but it settled; the create lock was nested behind the Project lock. The focused run failed at `expect(stopSettled).toBe(false)` with `true`.
  - Green: `drains an admitted create before closing the registry` and `retains an admitted staging commit and prevents later mutation during stop` pass. An atomic staging transaction already entered before stop may commit as an intentional durable witness; create then returns unavailable, no later filesystem/database/activation mutation begins, and registry stop runs once after lock release.
- Verification: storage unit contracts 58/58 pass; real-libSQL creation contracts 39/39 pass; `pnpm check` passes with 161 unit tests; migration generation, boundaries, harness typecheck, and architecture validation pass.
- Test-lint: unavailable; the repository exposes no test-theater script or ast-grep rule pack.
- Mutation: unavailable for this phase; `stryker.config.json` has a generic mutation gate but its explicit `mutate` list contains no Phase 3 storage source, so running it would not assess this implementation.
- Code Health: every changed Phase 3 file scored 10.0 after splitting exact activation checks into focused authority predicates. The repository-wide pre-commit safeguard remains failed only by four pre-existing oversized Phase 1/2 test methods (`harness-runtime.test.ts`, `protocol.test.ts`, `harness-runtime.integration.test.ts`, and `project-storage-application.test.ts`); no Phase 3 file is degraded.
- Review: independent claim verification confirmed lifecycle drain/witness semantics, exact activation authority, Transaction A recheck, database lineage verification, and exact crash-prefix preservation; its initial overbroad post-stop concern was dismissed after the atomic staging-witness contract was pinned by test.

### Phase 4: Opening Health And Session Lifecycle
- Behavior: Clean absence, filesystem-only recovery, exact active-generation selection, manifest admission, and independent canonical/runtime health classification are non-mutating and cross the real structured-clone seam.
  - Green: opening integration passes 30/30, covering known-older, recovery witnesses, missing/invalid/corrupt databases, identity conflict, unsupported newer, unavailable, unexpected SQL failure, corruption precedence, application-authority failures, and all reachable manifest outcomes.
- Behavior: Sessions retain only opaque read-write/safe-mode release handles and deterministically release on reopen, close, stop, reverse completion, and late stop races.
  - Green: lifecycle integration passes 7/7, including admitted create/close drain, late opening release, ordered aggregate shutdown failure, and cross-Project isolation.
- Behavior: Existing and mutable application-client acquisition share one retryable initialization, retain before initialization, close failed candidates once, remove only a newly created failed authority, and preserve path-free public diagnostics.
  - Green: focused adapter and opening tests pass, including absent/single-client release success, canonical-before-runtime aggregate release, and already-closed transaction failure preservation.
- Verification: focused storage unit contracts pass 85/85 after the opening-module extraction; Project Storage creation/opening/lifecycle integration contracts pass 76/76; `pnpm check` passes with 190 unit tests; harness typecheck, dependency boundaries, and architecture validation pass.
- Mutation: added `stryker.project-storage.config.json` and `apps/harness/vitest.project-storage-mutation.config.ts` because repeated CLI `--mutate` flags selected only the last file and the default Vitest config omitted integration tests. The final risk-based classifier run passed at 100.00% with 103/103 mutants detected and no survivors or uncovered mutants. The complete pre-extraction target exceeded a 20-minute execution budget, and the store-only target reached 89% execution before the same timeout; neither timed-out run produced a valid score, so whole-storage mutation remains explicitly unassessed rather than reported clean.
- Code Health: `project-storage-node-adapters.ts` improved from 5.7 to 10.0 by extracting application-client ownership, registry/manifest opening, and database opening probes. Every changed Phase 4 source and test file now scores 10.0. CodeScene installation passes 5/5. The working-tree safeguard remains failed only by the four previously recorded oversized Phase 1/2 test methods; no Phase 4 file is degraded.

### Phase 5: Electron Main Bridge And Trusted Bootstrap
- Behavior: Harness bootstrap accepts only strict plain local file URLs for both trusted roots. - Test: `accepts only plain local file URLs as trusted harness roots` (`packages/protocol/src/protocol.test.ts`)
  - Red: the strict protocol test rejected the trusted-root fields as unrecognized because bootstrap carried only `kind`.
  - Green: `pnpm exec vitest run packages/protocol/src/protocol.test.ts -t "accepts only plain local file URLs as trusted harness roots"` -> pass.
- Behavior: Main derives private Storage and exact development/package migration roots. - Test: `derives private Storage and development/package migration roots` (`apps/desktop/src/main/project-storage-bootstrap.test.ts`)
  - Red: the named Project Storage bootstrap module did not exist, so the derivation seam could not be imported.
  - Green: the focused bootstrap derivation test -> pass with schema-validated `pathToFileURL(...).href` values.
- Behavior: Development harness builds stage checked-in generated migrations before persistent composition starts. - Test: Phase 5 harness Vite build.
  - Red: the pre-change build emitted only `harness.cjs`; `.vite/build/harness-migrations` was absent.
  - Green: `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts` -> pass; recursive `git diff --no-index` against `apps/harness/drizzle` produced no differences, and no native binary or staged `node_modules` tree exists. The build retains the CJS `EMPTY_IMPORT_META` warning from the bundled local database process client; Phase 5 intentionally does not externalize or stage native dependencies.
- Behavior: The Project Storage bridge correlates open/create/close independently of response order. - Test: `correlates out-of-order open, create, and close results` (`apps/desktop/src/main/project-storage-bridge.test.ts`)
  - Red: the initial absent-module failure was not accepted as behavioral evidence. After the approved follow-plan mismatch adaptation added only a minimal public seam, the test received `broken/PROJECT_STORAGE_TRANSPORT_FAILED` instead of the expected `not-registered` result.
  - Green: the focused correlation test -> pass with reverse-order exact results and command names.
- Behavior: Bridge-local, send, correlation, protocol, session, and stop failures become stable Storage transport failures. - Tests: Project Storage bridge failure matrix.
  - Red: `maps HARNESS_SESSION_UNAVAILABLE to a Storage transport failure` received `Project Storage bridge could not send the request.` instead of `Harness session is unavailable.`
  - Green: all 8 Project Storage bridge tests pass, including every send code, request/event mismatch, null causation, protocol/system failure, disconnect, invalid metadata, ID collision, and idempotent stop.
- Behavior: Every spawn and retry receives the same validated bootstrap before handshake. - Test: `sends the same validated trusted roots to initial and retried harnesses` (`apps/desktop/src/main/harness-supervisor.test.ts`)
  - Red: the supervisor attempted to parse and post only `{kind:"harness.connect"}`, producing missing-field errors for both trusted roots.
  - Green: the complete supervisor suite passes 13/13 with exact immutable bootstrap reuse and path-free logs.
- Behavior: Project Storage result traffic does not own supervisor readiness or recovery state.
  - Expected-red exception: the public behavior was already green because `HarnessSession` published every validated message before supervisor handling and the old switch fall-through left status unchanged. The approved follow-plan decision kept the public oracle and recorded the pre-existing-green result rather than adding an implementation-detail assertion.
  - Green: `forwards Project Storage results without changing supervisor status` and the retained ready/failure/protocol tests pass; explicit Project result cases now keep protocol-union handling visible.
- Behavior: Supervisor shutdown retains one Promise, detaches first, prefers bounded natural exit, and can restart only after completed stop.
  - Evidence exception: the updated shutdown/restart tests were not executed before implementation, so their exact red output was not captured and the all-red criterion remains unchecked.
  - Green: retained natural-exit, 5,000 ms kill fallback, timer cancellation, completed-stop restart, and synchronous spawn-failure tests pass.
- Behavior: Desktop quit and package/startup exit share one retained ordered asynchronous shutdown. - Tests: `apps/desktop/src/main/desktop-shutdown.test.ts`
  - Red: repeated `stop()` calls returned different already-resolved Promises and no shutdown action ran.
  - Green: all 4 shutdown-controller tests pass with Project Storage -> Workspace -> harness order, one quit re-entry, retained package exit, and one nonzero fallback.
- Behavior: Production composition replaces the unavailable owner with trusted persistent Project Storage. - Test: `composes persistent Project Storage from validated trusted roots` (`apps/harness/tests/integration/process-bootstrap.integration.test.ts`)
  - Red: concrete `project.open` returned `unavailable` instead of `not-registered` under the minimal process seam.
  - Green: process-bootstrap integration passes 3/3 with not-registered/create/open/close, awaited stop, nested-root rejection, alias rejection, no root in responses, and no pre-rejection persistence mutation.
- Behavior: Bootstrap rejects overlapping authority/resource roots before runtime or persistence mutation.
  - Evidence exception: the overlap tests were authored before persistent composition but their exact red output was not separately captured before implementation; the all-red criterion remains unchecked.
  - Green: both lexical and filesystem-alias overlap tests pass before `application.db` mutation.
- Verification: `pnpm check` passes with 208 unit tests; protocol, migration generation, staged Vite build, 48 focused Desktop tests, 3 process-bootstrap integration tests, renderer API lock, all three package typechecks, dependency boundaries, and architecture validation pass.
- Test-lint: Biome format and lint pass through `pnpm check`; the repository exposes no separate test-theater script or ast-grep rule pack.
- Mutation: not run; repository policy keeps mutation explicit and risk-based, and Phase 5 defines no plan-scoped mutation command.
- Code Health: all reviewed changed Phase 5 production TypeScript files score 10.0. `process-bootstrap.ts`, `project-storage-bridge.ts`, and `harness-supervisor.ts` improved to 10 after focused complexity/duplication refactors; the two Phase 5 test findings also improved to 10. The pre-commit safeguard now reports only the four previously recorded oversized Phase 1/2 tests and no Phase 5 degradation; `vite.harness.config.ts` is not assessable.
