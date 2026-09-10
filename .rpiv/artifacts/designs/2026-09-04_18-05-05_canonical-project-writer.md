---
date: 2026-09-04T18:05:05+0100
author: Pedro Mesquita
commit: 59fb35b
branch: main
repository: slopstop
topic: canonical-project-writer
tags: [design, project-writer, canonical-storage, typed-command, fencing, protocol]
status: in-review
parent: .rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md
last_updated: 2026-09-07T19:24:49+0100
last_updated_by: OpenCode
last_updated_note: "User chose Apply all for S5 intent F1-F3; appended dependency, temporal-authority and real-facade corrections pending fresh intent review and exact-contract approval."
content_hash: 66361e4867e8d1c9991b939af796067f6fdc941b120631fa6b5c3a01ef55aecc
---

# Design: Canonical Project Writer

## Summary

Build a harness-owned active-Project coordinator and retained canonical Writer that combine a cooperative operating-system lease with a durable generation/token fence. Typed commands settle through one short libSQL transaction that atomically verifies authority, allocates canonical order, mutates state, and persists receipts, rejections, and events; protocol failures become request-scoped unless the harness process itself is broken.

## Requirements

- A harness session starts with no active Project and never infers one after restart.
- The harness coordinator is the sole authority for selecting and switching the active Project.
- At most one cooperative SlopStop process holds write authority for a Project.
- A second process may activate the Project read-only and receives a stable `writer-unavailable` diagnostic for Typed commands.
- Each writable activation receives a durable Writer generation and secret capability token.
- Every canonical write transaction verifies the active generation and token before any sequence allocation or mutation.
- Switching blocks new Project commands, drains the current bounded transaction, releases the old Writer, and only then acquires the next Writer.
- Failed release retains the old ownership handle and prevents acquisition of the next Project.
- Each first command settlement is durable as `applied`, `unchanged`, or `rejected` and receives one Project sequence.
- Applied settlements may append ordered Canonical events; unchanged and rejected settlements append none.
- An exact Command-ID retry returns the original receipt without allocating another sequence or event.
- Reusing a Command ID with a different fingerprint produces a durable, repeatable `IDEMPOTENCY_CONFLICT` rejection and no domain mutation.
- A commit-phase uncertainty quarantines the Writer until explicit Project reactivation.
- Retrying the same Command ID after reactivation reconciles against durable settlement rather than replaying blindly.
- Correlated unexpected request failures emit `request.failure` with required causation.
- `system.failure` remains uncorrelated and reserved for process-global recovery.
- Existing canonical schema generation 1 reports `migration-required`; this feature provides no in-place or staged migration.
- The first Typed-command handler is a test-only conformance fixture; Board behavior remains deferred.
- Native lease loading, contention, stale fencing, and crash release are proven in packaged Windows and Linux processes.

## Current State Analysis

Project Storage can create, inspect, retain, and close multiple Project sessions, but it has no session-scoped active-Project owner, cross-process Writer lease, durable fence, canonical command settlement, or event ordering. The protocol currently overloads `system.failure` for both correlated handler failures and process-global failure, while Desktop treats every such event as a harness crash.

### Key Discoveries

- `apps/harness/src/storage/project-storage-store.ts:486-638` deliberately retains a session map and closes only a prior session for the same Project; a coordinator above this owner must enforce one active Project.
- `apps/harness/src/storage/serial-lock.ts:1-21` is the local serialization pattern for lifecycle transitions, but it is not a cross-process lease.
- `apps/harness/src/storage/project-storage-transaction.ts:18-90` attempts rollback and close around short write transactions, but combines body and commit errors. Neither its rejection nor a later rollback attempt proves that a rejected commit did not land.
- `apps/harness/src/storage/canonical-schema.ts:6-35` contains only schema metadata and storage identity; no Writer, sequence, receipt, rejection, or event authority exists.
- `apps/harness/src/storage/project-storage-database-specs.ts:357-368` verifies an exact generation-1 canonical schema allowlist, so schema declarations, generated migration metadata, and verifier specs must move together.
- `apps/harness/src/storage/project-storage-node-adapters.ts:1053-1116` probes opening authority without migrating and already classifies known-older schemas separately.
- `apps/harness/src/harness-runtime.ts:63-85` emits `system.failure` for request-handler failures even when causation is known.
- `apps/desktop/src/main/harness-supervisor.ts:176-206` converts every `system.failure` into process-global recovery.
- `apps/desktop/src/main/project-storage-bridge.ts:144-239` and `apps/desktop/src/main/workspace-bridge.ts:215-308` own pending maps and provide the existing causation-routing pattern.
- `apps/desktop/forge.config.ts:3-31` already enables ASAR and automatic native unpacking; `apps/desktop/vite.harness.config.ts:108-146` owns runtime dependency staging and externalization.

## Scope

### Building

- Request-scoped protocol failure and corrected Desktop routing.
- Canonical schema generation 2 for Writer authority and command settlement.
- Session-scoped active-Project state with explicit activation epochs.
- Held one-byte native lease on a dedicated Project companion file.
- Durable Writer generation/token activation and stale-Writer rejection.
- Atomic Typed-command settlement with idempotency, receipts, rejections, sequences, and Canonical events.
- Switching, release-failure retention, quarantine, and explicit reactivation.
- Test-only conformance command registration through the harness transport seam.
- Native dependency installation, staging, unpacking, and packaged cross-process proof.
- S7 private authorized utility-process proof, separate inert packaged harness fixture, strict smoke-only transport, exact durable audit, and bounded retained cleanup diagnostics; no additional product-domain feature.

### Not Building

- Board commands, Board projections, or other production domain handlers.
- Automatic restoration of the previously active Project after restart.
- Migration, backup, rollback, or data transformation for canonical generation-1 Projects.
- Renderer UI for choosing or displaying the active Project.
- General request deadlines or cancellation policy for long-running non-Project work.
- Enforcement against non-cooperative external SQLite tools.
- Network-share, cloud-synchronized, or removable-filesystem support for canonical Project storage.
- A process-long SQLite transaction or a PID/timestamp lockfile.
- S7 adds no production test command, renderer API, default-harness fixture registration, supervisor restart policy, sandbox/fuse exception, or new package-isolation topology.

## Decisions

### TDD Standard (standing)
Every behavior-changing slice MUST carry a `#### Test Contract:` with at least one **Behavior** whose **Oracle** pins exact input -> expected-output values (the strongest checkable oracle; any weakening justified inline) and an **Expected red** reason. Non-behavioral slices/items carry explicit `TDD-exempt` markers with reasons. Recorded as a commitment so slice-verifier's commitments audit flags violations per slice.

### Harness coordinator owns active-Project state

The harness composition root creates one coordinator for the process session. The coordinator owns the active activation record and serializes activation, switching, recovery, and shutdown; neither Desktop nor `ProjectStorageStore` infers active ownership. Repeated activation while any ownership remains returns `PROJECT_ALREADY_ACTIVE` before invoking Storage, lease, repository, identity, or token dependencies.

### Activation is separate from storage opening

`project.open` remains a storage inspection/lifecycle capability. `project.activate` is a separate protocol command because it changes command admission, retained Writer ownership, and activation epoch.

### Every activation has an epoch

Each successful read-write or read-only activation returns a branded `activationId`. Every project-scoped Typed command must present that ID; stale, inactive, or switching activations are rejected before command-specific work.

### Writer authority uses two layers

An exclusive `fs-native-extensions` lock on byte range `[0, 1)` of the Project-root `.slopstop-writer.lock` companion file prevents cooperative peers from holding the Writer concurrently. The lease file remains outside immutable Storage generations and their manifests, checksums, snapshots, and exports. A durable generation and token digest in the canonical database fence every protected transaction and reject stale in-memory Writers.

### Lease errors are not contention

`tryLock()` returning `false`, or `tryLock()` throwing `EBUSY` on `win32`, maps to read-only `writer-unavailable`. Linux `EBUSY` and every other opening, locking, unlocking, or closing error remain distinct broken diagnostics and never degrade to read-only contention.

### Read-only means no write capability

In #90, a contending process may retain active Project identity and storage health but installs no Writer or canonical write repository. It can report active read-only status, while every Typed command is rejected with `WRITER_UNAVAILABLE`; adding read models is deferred.

### Switching is a closed admission barrier

The coordinator stops admitting new Project commands before waiting for the one currently admitted bounded settlement. It retires and releases A before attempting B. A release failure retains A in `release-failed` and never attempts B. Failed closes retain exact ownership for retry; a later close resumes from the failed stage without repeating completed release stages.

Slice 4 implements this barrier for the existing set of admitted fence-check completion promises, including their rejection-settlement wrappers. It closes admission synchronously when activation, switch, or stop is queued, not when the awaited `SerialLock` callback eventually starts. It adds no command transaction or serial settlement policy; those remain Slice 5.

### Switch source is revalidated in FIFO order

Feature-local, approved switching contract: each request names the source Project and its exact `activationId`, plus a destination activation request. The existing FIFO lifecycle lock revalidates that source at execution time. Two queued A-to-B then A-to-C requests cannot release B on the second request's stale authority. A-to-A explicitly releases and reacquires A with a fresh epoch. A retained release failure preserves the actual previous activation ID; failed acquisition cleanup has `activationId: null` and cannot be switched out of by inventing an epoch. Only explicit source-qualified calls may retry a retained active epoch; null-epoch cleanup uses the existing explicit stop retry.

### Released source is never rolled back

Feature-local, approved switching contract: after every A release stage succeeds, the coordinator is inactive before attempting B. The result is `target-result` with the exact B activation outcome, not a falsely successful `switched` label. B failure never restores A. A release failure retains no pending destination and never schedules automatic cleanup or acquisition; a later valid explicit switch may name a different destination. `WRITER_FENCE_STALE` remains non-retryable as a diagnostic and never authorizes forced release; even an explicit matching retry must pass the existing owner's fence check. Operational close failures are retryable only through a later explicit lifecycle request.

Common release retains its owned snapshot until admitted work settles and timestamp evaluation succeeds. An unexpected clock exception before release work leaves ownership recoverable and propagates to the locked runtime failure boundary. Failed acquisition cleanup retains a null-epoch snapshot before evaluating its timestamp and shares one cleanup attempt within that activation, preventing the outer exception path from silently retrying it.

### Every first settlement receives one Project sequence

Applied, unchanged, ordinary rejected, and first-seen idempotency-conflict settlements each receive one unique Project sequence. Applied events share the settlement sequence and use an event ordinal; exact retries allocate nothing.

### Command decisions are registered and bounded

The Writer accepts only registered command type/version pairs whose payload schemas parse at the trust boundary. A handler may use only the transaction-scoped canonical repository and returns a settlement decision; filesystem, process, provider, and network I/O are outside this callback.

### Commit uncertainty quarantines the Writer

Known begin/body failures roll back normally. Any error while awaiting `commit()` is conservatively treated as uncertain: the Writer closes admission and remains quarantined until explicit reactivation creates a new generation. Same-ID retry then reads the durable receipt to determine whether the prior commit landed.

This is the feature's recovery target. Slice 6 owns phase classification and recovery records; Slice 5 implements the separately approved stricter minimum of blocking on every unexpected settlement error. Known begin/body rollback proof requires successful cleanup, not merely a rejected helper promise.

### Failure scope is explicit in protocol

Expected domain and storage outcomes remain discriminated result envelopes. Unexpected failures with a parsed request ID become `request.failure` and settle only that request. `system.failure` requires null causation and triggers process-global recovery.

### Canonical generation 1 remains immutable

The existing migration and snapshot remain historical. A new ordered migration advances fresh Project creation to generation 2, while opening a persisted generation-1 Project reports `migration-required` without applying the successor.

### Package proof uses real processes

Unit mocks cannot establish native lock or crash-release behavior. Packaged smoke launches independent Electron processes, observes one lock holder, force-terminates it, and verifies bounded takeover plus unpacked native loading on each supported target.

### Slice 5 durable admission rejection

Approved additional behavior, not code approval: after envelope parsing and active Writer authority, a first unregistered type/version or invalid registered payload settles durably as `COMMAND_TYPE_UNSUPPORTED` or `COMMAND_PAYLOAD_INVALID`. It consumes one sequence and binds CommandId. Corrected content requires a new CommandId; an exact retry still returns the original rejection after registry changes. Malformed envelopes, missing authority, and unexpected exceptions never become durable rejections. This extends the earlier registered-command decision rather than interpreting unsupported input as malformed transport.

### Slice 5 fingerprint version 1

One harness canonical JSON owner hashes the protocol-parsed ProjectId, CommandId, command type/version, and raw JSON payload, with `fingerprintVersion: 1` in the hashed object. Sort object keys recursively by JavaScript code-unit order, including integer-looking keys; preserve array order and exact string contents. JSON serialization owns numbers, including `-0` becoming `0`. Only finite, acyclic JSON data is accepted. Preserve own `__proto__` data without ordinary-object assignment. Activation, Writer generation/token, and clocks are excluded. Snapshot to canonical text synchronously before any asynchronous work; schema defaults/transforms and handler mutation never change that text. The raw type/version contract owns fingerprint meaning. Do not reuse Project Storage's insertion-order create-request fingerprint.

### Slice 5 bounded admission and fail-closed safety

Approved additional behavior, not code approval: one in-flight settlement per Writer, no backlog. Exact canonical-text duplicates join the same promise; every different text immediately receives non-durable `command-busy/COMMAND_IN_PROGRESS/retryable:true`. Any unexpected settlement failure blocks that Writer and is rethrown to the locked generic `request.failure` boundary. Later commands receive `writer-unavailable/WRITER_UNAVAILABLE/retryable:false` until explicit reactivation creates a new Writer. Stale fence and sequence exhaustion are normal non-durable outcomes, not exceptions. Closing shuts admission synchronously, drains success or failure, then uses the existing retryable fence/repository/lease stages. An unfinished transaction never permits release.

The existing shared transaction helper is unchanged in Slice 5. This coarse blocking rule covers begin, body, commit, and transaction-close errors without inferring rollback from commit rejection. Detailed commit-phase classification, quarantine/recovery records, and uncertain-outcome reconciliation remain Slice 6; no Slice 6 symbol is required here.

### Slice 5 trusted handler boundary

Harness-authored definitions are registered by exact type/version, with duplicate registration rejected at construction and an explicitly empty production registry. A generic factory captures a payload schema and matching typed handler in a closure before safely erasing the payload type. Handlers receive Project identity, parsed payload, and a revocable execute-only transaction facade. They cannot receive terminal methods, client, fence token, clock, or identity generators through that interface. This is a trusted SQL authoring contract, not a plugin sandbox: handlers must not issue transaction-control SQL, mutate Writer/settlement tables, retain capabilities, or perform provider/filesystem/process/network work.

Run each handler under one SAVEPOINT inside the fenced outer write transaction. Drain every already-issued SQL promise and revoke execute on completion, including when the handler catches or neglects SQL failure. Roll back handler writes for unchanged/rejected, release the savepoint, then persist the receipt. Malformed decisions, reserved rejection-code spoofing, and SQL/handler exceptions fail the whole transaction. Rejection details are exactly schema-versioned safe `{version:1}` metadata and its canonical SHA-256, never parser errors, raw payload, or private messages.

### Slice 5 ledger authority and protocol extension

Check the Project/generation/token fence inside `transaction('write')` before any domain or settlement mutation. Read original idempotency authority before registry lookup, validate its receipt binding and the requested receipt's full structural ledger, and fail broken on missing referenced rows, orphan receipts, malformed cardinality, or mismatched hashes. The original raw command is not stored: validation proves stored binding and submitted-fingerprint equality, not reconstruction of historical raw content. A first conflict writes a rejected receipt at its own sequence without changing the original pointer. All first settlements use one positive safe sequence; exact retries use none, including at `9007199254740991`.

The new strict `settled` result keeps flat Project/activation/Command correlation and adds only an immutable metadata receipt. Replay retains the original generation/time inside the receipt under the current outer activation. Existing inactive/mismatch/stale/read-only/fence schemas remain; `settlement-unavailable` stays as the explicit historical Slice 3/4 schema baseline but is no longer returned by healthy Slice 5 execution. Slice 5's Test Contract lists assertion migrations separately; approved Slices 1-4 contracts and history below remain verbatim.

### Slice 6 primary transaction phase is evidence, not rollback inference

Feature-local contract: preserve the legacy `withWriteTransaction` signature, thrown identities, cleanup attempts, and exact aggregation messages/order. One private outcome engine also supports a harness-internal classified runner. Begin/body failure before calling commit is `not-attempted`; an exception from calling or awaiting commit is `uncertain`, even for synchronous pre-delegate throws, later successful rollback, or a true closed flag. Acknowledged commit followed by close failure is `acknowledged`, not uncertain; success requires close acknowledgement. Secondary cleanup errors never change the primary stage/classification. Internal errors and classifications are not protocol payloads.

### Slice 6 explicit journaling and approved crash gap

Feature-local, separately user-approved contract: the failing settlement only retains its canonical admitted CommandId/fingerprint in memory and rethrows the same classified-runner error to the existing generic request.failure boundary. S5 continues to block every unexpected failure. No marker identity/time or journal transaction is created on that request, and no automatic command or journal retry is scheduled. A later explicit switch/stop (or direct repository-owner cleanup) must acknowledge the old transaction close, then durably acknowledge one exact unresolved marker before fence/repository/native-lease/Storage release. Preparation failure retains the descriptor; SQL/acknowledgement failure retains the successfully prepared full record and the same native lease for a later explicit attempt. `observedAt` is captured for that explicit recording transition, never invented as the failing commit's time; retries preserve the first successfully prepared record verbatim.

Abrupt process death before that durable marker is an approved information gap. The surviving active fence establishes only abandonment, not a lost CommandId or receipt outcome. A later explicit same-ID/content command uses normal durable receipt lookup. Nothing restores the active Project after startup. This Writer recovery record is not the product's write-ahead Effect Recovery journal and does not weaken its separate contracts.

### Slice 6 activation reconciles atomically without executing commands

Feature-local contract: under a newly acquired native lease, validate prior generation/fence and applicable recovery authority, check the exact CommandId/fingerprint ledger at the prior generation/sequence waterline, and atomically advance generation, release an active predecessor, resolve its existing marker, write the recovery handoff, and replace the fence. A released predecessor with an unresolved marker still requires a recovery handoff. Reuse the one per-generation recovery row; never insert an abandoned row for a marked generation. A genuine requested-receipt absence is distinct from corrupt pointer/receipt/recovery evidence. Resolution performs no handler, registry, domain, receipt, event, or sequence work. A later explicit retry may create a first settlement or conflict, but never rewrites historical receipt-absent resolution. Control-plane activation/release COMMIT failure remains the existing fail-closed lifecycle limit, not a new universal automatic-repair protocol.

### Slice 7 private process ownership and proof-only limits

The authorized `writer-proof` branch runs after app readiness and before ordinary supervisor/window, log/Sentry, or IPC startup. Its private main owner launches independent OS utility processes directly, with real `harness.cjs`, HarnessSession, MessageChannelMain, trusted bootstrap, existing Project commands, and the empty production registry. No automatic supervisor restart occurs during proof. The original bootstrap creates healthy Project 101 in one fresh authorized root; the Writer scenario follows it without recreating Storage or restoring an active Project implicitly.

Hard kill uses the recorded still-matching UtilityProcess.pid with `process.kill(pid,"SIGKILL")`, never graceful UtilityProcess.kill or main termination as proof. Actual exit and separate stdio EOF are both required for every owned child. The exit callback records monotonic time, and takeover's 15000ms limit starts there, including drain, replacement startup, inactive probe, and explicit acquisition. Only exact read-only contention permits the proof's source-qualified A-to-A retry after a configured 100ms wait. The proof budgets are not production retry policies or an OS release SLA.

One immutable first-fault selection immediately fails every normal wait and closes subsequent boundary admission. Normal drains inherit signal and enclosing step/proof/takeover deadlines; cleanup waits ignore fault/abort only to retain and terminate/observe owned children. Limits are proof90000ms, step/spawn10000ms, clean exit5000ms, failure cleanup10000ms plus EOF3000ms, 65536 bytes per child stream, and six retained process slots. Four one-shot cleanup catches per process retain at most24 frozen safe `{processIndex,stage}` entries, stage `cleanup` or `stdio-drain`, on failed runner outcomes only. They neither replace nor rebroadcast the first fault. Main ignores these local diagnostics; actual exit plus EOF alone determines cleanupSafe.

### Slice 7 separate inert fixture and strict transport

The separately approved test-only harness entry emits `writer-proof-fixture.cjs` alongside `harness.cjs` through one Forge/Vite multi-entry build and one unchanged S3 staging pass. Only the authorized private runner launches it. Production process-bootstrap never imports it or registers a test handler. Fixture bytes may exist in the archive but remain inert outside that branch; no security fuse changes. Protocol owns strict independently versioned start/control/result schemas and explicit exports, separate from product v4 command unions. Only the existing trusted bootstrap carries root URLs; controls/results carry no tokens, full paths, SQL, raw rows, or exception data. Correlation, exact step ordering, and completed teardown are necessary; early exit zero without the exact result is not success.

A separate read-only fixture audits all canonical rows and captured receipts for Project 101 after actual crash/takeover. Generic abandoned evidence keeps null command/fingerprint and generation-superseded resolution; it never invents an uncertainty marker or lost-command attribution. Project 104 supplies the distinct live stale proof: the fixture retains a real directly constructed old Writer/repository while deliberately releasing its test-owned native lease, and a separate production harness/coordinator acquires generation2. Direct old Writer.settle must prove stale fencing before registry/handler/identity/settlement-clock work and leave all rows unchanged. Stale Writer.close remains refused; test teardown closes only its direct retained resources and already-released test lease, never claiming successful production release. No test-domain schema table is added. The complete uncertain-marker matrix remains with S5/S6 source integration.

### Slice 7 exact native origin and cleanup reporting

Require the exact published fs-native-extensions@1.5.1 executing-target `.node` file under app.asar.unpacked, its published SHA-256, exact virtual package name/version/JS origin, and actual main/fixture native-load witnesses. Wrong native targets are not delegated, and no successful fallback load is accepted. Preserve the existing sibling same-volume rename-based isolation: it moves the package outside the workspace directory without losing Linux chrome-sandbox root ownership/mode already set by CI. Do not copy, add root workarounds, or weaken sandboxing.

External writer success requires exit0, stdout exactly empty, and stderr exactly the complete terminal line then pass line. Safe failed cleanup permits only exit1, empty stdout, and exactly terminal plus one fixed failure line whose stage is a bounded lowercase single-hyphen-separated token from the sole runtime stage owner. A lone/truncated/extra/reversed line, unconfirmed exit, output overflow, or timeout never grants cleanup. The outer writer limit is120000ms plus existing5000ms terminal fallback; timeout immediately revokes cleanup even if a best-effort main kill later yields close. Main close is not process-tree proof, so unknown descendants preserve the root and relocated package. The ordinary scenarios and shutdown path retain their behavior.

## Architecture

### packages/kernel/src/project-storage-identifiers.ts:1-80 - MODIFY
Add branded activation, Writer generation, Command, receipt, event, and non-negative Project-sequence values shared without framework dependencies.

S5 delta (approved): add only the two durable identity brands; the approved numeric guards are unchanged.

```ts
import type { DomainIdentity } from "./workspace-identifiers.js";

export type StorageId = DomainIdentity<"StorageId">;
export type StorageGenerationId = DomainIdentity<"StorageGenerationId">;
export type CanonicalDatabaseLineageId = DomainIdentity<"CanonicalDatabaseLineageId">;
export type RuntimeDatabaseLineageId = DomainIdentity<"RuntimeDatabaseLineageId">;
export type ProjectStorageCreateRequestId = DomainIdentity<"ProjectStorageCreateRequestId">;
export type ProjectActivationId = DomainIdentity<"ProjectActivationId">;
export type CommandId = DomainIdentity<"CommandId">;
export type CommandReceiptId = DomainIdentity<"CommandReceiptId">;
export type CanonicalEventId = DomainIdentity<"CanonicalEventId">;

declare const writerGenerationBrand: unique symbol;
export type WriterGeneration = number & {
  readonly [writerGenerationBrand]: "WriterGeneration";
};

declare const projectSequenceBrand: unique symbol;
export type ProjectSequence = number & {
  readonly [projectSequenceBrand]: "ProjectSequence";
};

declare const canonicalEventOrdinalBrand: unique symbol;
export type CanonicalEventOrdinal = number & {
  readonly [canonicalEventOrdinalBrand]: "CanonicalEventOrdinal";
};

export function isWriterGeneration(value: number): value is WriterGeneration {
  return Number.isSafeInteger(value) && value > 0;
}

export function isProjectSequence(value: number): value is ProjectSequence {
  return Number.isSafeInteger(value) && value > 0;
}

export function isCanonicalEventOrdinal(value: number): value is CanonicalEventOrdinal {
  return Number.isSafeInteger(value) && value >= 0;
}
```

### packages/kernel/src/index.ts:1-20 - MODIFY
Export the new canonical Project identity vocabulary through the declared package surface.

S5 delta (approved): export CommandReceiptId and CanonicalEventId from the same declared surface.

```ts
export type {
  CanonicalDatabaseLineageId,
  CanonicalEventId,
  CanonicalEventOrdinal,
  CommandId,
  CommandReceiptId,
  ProjectActivationId,
  ProjectSequence,
  ProjectStorageCreateRequestId,
  RuntimeDatabaseLineageId,
  StorageGenerationId,
  StorageId,
  WriterGeneration,
} from "./project-storage-identifiers.js";
export {
  isCanonicalEventOrdinal,
  isProjectSequence,
  isWriterGeneration,
} from "./project-storage-identifiers.js";
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

### packages/protocol/src/canonical-project-protocol.ts - NEW

S5 delta (approved): preserve the merged activation/switch definitions, add finite JSON preservation, branded receipt/event/order schemas and safe settlement outcomes. The custom JSON validator is needed because pinned Zod 4.4.3's `z.json()` record parser skips `__proto__`. It validates without normalization or alias-changing output; the Writer owns the synchronous snapshot. No new transport version is introduced.

```ts
import type {
  CanonicalEventId as KernelCanonicalEventId,
  CanonicalEventOrdinal as KernelCanonicalEventOrdinal,
  CommandId as KernelCommandId,
  CommandReceiptId as KernelCommandReceiptId,
  ProjectActivationId as KernelProjectActivationId,
  ProjectSequence as KernelProjectSequence,
  WriterGeneration as KernelWriterGeneration,
} from "@slopstop/kernel";
import { isCanonicalEventOrdinal, isProjectSequence, isWriterGeneration } from "@slopstop/kernel";
import { z } from "zod";
import {
  domainIdentitySchema,
  lowercaseDomainIdentitySchema,
  ProjectIdSchema,
} from "./domain-identity-schema.js";
import {
  CanonicalDatabaseLineageIdSchema,
  ProjectDatabaseHealthSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./project-storage-protocol.js";

export const ProjectActivationIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelProjectActivationId>(),
);
export type ProjectActivationId = z.infer<typeof ProjectActivationIdSchema>;

export const CommandIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCommandId>(),
);
export type CommandId = z.infer<typeof CommandIdSchema>;

export const WriterGenerationSchema = z.custom<KernelWriterGeneration>(
  (value) => typeof value === "number" && isWriterGeneration(value),
  { message: "Writer generation must be a positive safe integer." },
);
export type WriterGeneration = z.infer<typeof WriterGenerationSchema>;

const safePositiveIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const CommandReceiptIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCommandReceiptId>(),
);
export type CommandReceiptId = z.infer<typeof CommandReceiptIdSchema>;
export const CanonicalEventIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCanonicalEventId>(),
);
export type CanonicalEventId = z.infer<typeof CanonicalEventIdSchema>;
export const ProjectSequenceSchema = z.custom<KernelProjectSequence>(
  (value) => typeof value === "number" && isProjectSequence(value),
);
export type ProjectSequence = z.infer<typeof ProjectSequenceSchema>;
export const CanonicalEventOrdinalSchema = z.custom<KernelCanonicalEventOrdinal>(
  (value) => typeof value === "number" && isCanonicalEventOrdinal(value),
);
export type CanonicalEventOrdinal = z.infer<typeof CanonicalEventOrdinalSchema>;
export const CanonicalSettlementTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => /T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value), {
    message: "Settlement time must include seconds and use UTC Z notation.",
  });

function isFiniteJson(value: unknown, ancestors: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) return false;
  ancestors.add(value);
  try {
    for (const key of keys) {
      if (array && key === "length") continue;
      if (typeof key !== "string") return false;
      if (array && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return false;
      const child: unknown = descriptor.value;
      if (!isFiniteJson(child, ancestors)) return false;
    }
    return true;
  } finally {
    ancestors.delete(value);
  }
}

export const CanonicalJsonValueSchema = z.custom<z.infer<ReturnType<typeof z.json>>>(
  (value) => isFiniteJson(value, new Set()),
  { message: "Value must be finite JSON data." },
);
export type CanonicalJsonValue = z.infer<typeof CanonicalJsonValueSchema>;

export const SystemCommandRejectionCodeSchema = z.enum([
  "IDEMPOTENCY_CONFLICT",
  "COMMAND_TYPE_UNSUPPORTED",
  "COMMAND_PAYLOAD_INVALID",
]);
export const CommandRejectionCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/u);
export const CommandRejectionSchema = z.strictObject({
  code: CommandRejectionCodeSchema,
  retryable: z.boolean(),
}).refine(
  (value) => !SystemCommandRejectionCodeSchema.safeParse(value.code).success || !value.retryable,
  { message: "System command rejections are not retryable." },
).readonly();
export type CommandRejection = z.infer<typeof CommandRejectionSchema>;

export const CommandReceiptMetadataSchema = z.strictObject({
  receiptId: CommandReceiptIdSchema,
  projectId: ProjectIdSchema,
  commandId: CommandIdSchema,
  commandType: z.string().min(1).refine((value) => value === value.trim()),
  commandVersion: safePositiveIntegerSchema,
  projectSequence: ProjectSequenceSchema,
  writerGeneration: WriterGenerationSchema,
  settledAt: CanonicalSettlementTimeSchema,
});
const eventReferenceSchema = z.strictObject({
  eventId: CanonicalEventIdSchema,
  eventOrdinal: CanonicalEventOrdinalSchema,
}).readonly();
const eventReferencesSchema = z.array(eventReferenceSchema).refine(
  (events) => new Set(events.map((event) => event.eventId)).size === events.length &&
    events.every((event, index) => event.eventOrdinal === index),
  { message: "Event references must be unique and in contiguous ordinal order." },
).readonly();
export const CanonicalCommandReceiptSchema = z.discriminatedUnion("outcome", [
  CommandReceiptMetadataSchema.extend({
    outcome: z.literal("applied"),
    events: eventReferencesSchema,
  }),
  CommandReceiptMetadataSchema.extend({
    outcome: z.literal("unchanged"),
    events: z.tuple([]).readonly(),
  }),
  CommandReceiptMetadataSchema.extend({
    outcome: z.literal("rejected"),
    events: z.tuple([]).readonly(),
    rejection: CommandRejectionSchema,
  }),
]).readonly();
export type CanonicalCommandReceipt = z.infer<typeof CanonicalCommandReceiptSchema>;

const canonicalDiagnosticSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});

export const CanonicalProjectActivationDiagnosticCodeSchema = z.enum([
  "PROJECT_ALREADY_ACTIVE",
  "PROJECT_COORDINATOR_UNAVAILABLE",
  "PROJECT_STORAGE_UNAVAILABLE",
  "PROJECT_STORAGE_BROKEN",
  "PROJECT_STORAGE_RELEASE_FAILED",
  "WRITER_LEASE_OPEN_FAILED",
  "WRITER_LEASE_LOCK_FAILED",
  "WRITER_LEASE_UNLOCK_FAILED",
  "WRITER_LEASE_CLOSE_FAILED",
  "WRITER_FENCE_ACTIVATION_FAILED",
  "WRITER_FENCE_STALE",
  "WRITER_FENCE_RELEASE_FAILED",
  "WRITER_REPOSITORY_CLOSE_FAILED",
]);
export type CanonicalProjectActivationDiagnosticCode = z.infer<
  typeof CanonicalProjectActivationDiagnosticCodeSchema
>;

const activationDiagnosticSchema = canonicalDiagnosticSchema.extend({
  code: CanonicalProjectActivationDiagnosticCodeSchema,
});

export const CanonicalProjectActivationRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
});
export type CanonicalProjectActivationRequest = z.infer<
  typeof CanonicalProjectActivationRequestSchema
>;

const activationResultBase = {
  request: CanonicalProjectActivationRequestSchema,
} as const;

const readWriteActivationSchema = z.strictObject({
  status: z.literal("active"),
  ...activationResultBase,
  access: z.literal("read-write"),
  activationId: ProjectActivationIdSchema,
  writerGeneration: WriterGenerationSchema,
});

const readOnlyActivationSchema = z.strictObject({
  status: z.literal("active"),
  ...activationResultBase,
  access: z.literal("read-only"),
  activationId: ProjectActivationIdSchema,
  writerGeneration: z.null(),
  diagnostic: canonicalDiagnosticSchema.extend({
    code: z.literal("WRITER_UNAVAILABLE"),
    retryable: z.literal(true),
  }),
});

const safeModeActivationSchema = z.strictObject({
  status: z.literal("safe-mode"),
  ...activationResultBase,
  identity: z.strictObject({
    storageId: StorageIdSchema.nullable(),
    generationId: StorageGenerationIdSchema.nullable(),
    canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.nullable(),
    runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.nullable(),
  }),
  canonicalHealth: ProjectDatabaseHealthSchema,
  runtimeHealth: ProjectDatabaseHealthSchema,
});

const notRegisteredActivationSchema = z.strictObject({
  status: z.literal("not-registered"),
  ...activationResultBase,
});

function activationFailureSchema<
  const Status extends "rejected" | "unavailable" | "broken",
  const Codes extends readonly [
    CanonicalProjectActivationDiagnosticCode,
    ...CanonicalProjectActivationDiagnosticCode[],
  ],
>(status: Status, codes: Codes) {
  return z.strictObject({
    status: z.literal(status),
    ...activationResultBase,
    diagnostic: activationDiagnosticSchema.extend({ code: z.enum(codes) }),
  });
}

export const CanonicalProjectActivationResultSchema = z.union([
  z.discriminatedUnion("access", [readWriteActivationSchema, readOnlyActivationSchema]),
  safeModeActivationSchema,
  notRegisteredActivationSchema,
  activationFailureSchema("rejected", ["PROJECT_ALREADY_ACTIVE"]),
  activationFailureSchema("unavailable", [
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "PROJECT_STORAGE_UNAVAILABLE",
  ]),
  activationFailureSchema("broken", [
    "PROJECT_STORAGE_BROKEN",
    "PROJECT_STORAGE_RELEASE_FAILED",
    "WRITER_LEASE_OPEN_FAILED",
    "WRITER_LEASE_LOCK_FAILED",
    "WRITER_LEASE_UNLOCK_FAILED",
    "WRITER_LEASE_CLOSE_FAILED",
    "WRITER_FENCE_ACTIVATION_FAILED",
    "WRITER_FENCE_STALE",
    "WRITER_FENCE_RELEASE_FAILED",
    "WRITER_REPOSITORY_CLOSE_FAILED",
  ]),
]);
export type CanonicalProjectActivationResult = z.infer<
  typeof CanonicalProjectActivationResultSchema
>;

export const TypedCommandSchema = z.strictObject({
  commandId: CommandIdSchema,
  type: z.string().trim().min(1),
  version: safePositiveIntegerSchema,
  payload: CanonicalJsonValueSchema,
});
export type TypedCommand = z.infer<typeof TypedCommandSchema>;

export const CanonicalProjectCommandRequestSchema = z.strictObject({
  projectId: ProjectIdSchema,
  activationId: ProjectActivationIdSchema,
  command: TypedCommandSchema,
});
export type CanonicalProjectCommandRequest = z.infer<typeof CanonicalProjectCommandRequestSchema>;

export const CanonicalProjectCommandDiagnosticCodeSchema = z.enum([
  "PROJECT_INACTIVE",
  "PROJECT_NOT_ACTIVE",
  "PROJECT_ACTIVATION_STALE",
  "WRITER_UNAVAILABLE",
  "WRITER_FENCE_STALE",
  "WRITER_FENCE_CHECK_FAILED",
  "COMMAND_SETTLEMENT_UNAVAILABLE",
  "COMMAND_IN_PROGRESS",
  "PROJECT_SEQUENCE_EXHAUSTED",
  "PROJECT_COORDINATOR_UNAVAILABLE",
]);
export type CanonicalProjectCommandDiagnosticCode = z.infer<
  typeof CanonicalProjectCommandDiagnosticCodeSchema
>;

const commandResultBase = {
  projectId: ProjectIdSchema,
  activationId: ProjectActivationIdSchema,
  commandId: CommandIdSchema,
} as const;

function commandOutcomeSchema<
  const Status extends
    | "inactive"
    | "project-mismatch"
    | "stale-activation"
    | "read-only"
    | "stale-writer"
    | "settlement-unavailable"
    | "command-busy"
    | "writer-unavailable"
    | "sequence-exhausted"
    | "coordinator-unavailable"
    | "broken",
  const Code extends CanonicalProjectCommandDiagnosticCode,
>(status: Status, code: Code, retryable: boolean) {
  return z.strictObject({
    status: z.literal(status),
    ...commandResultBase,
    diagnostic: canonicalDiagnosticSchema.extend({
      code: z.literal(code),
      retryable: z.literal(retryable),
    }),
  });
}

export const CanonicalProjectCommandResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("settled"),
    ...commandResultBase,
    receipt: CanonicalCommandReceiptSchema,
  }),
  commandOutcomeSchema("command-busy", "COMMAND_IN_PROGRESS", true),
  commandOutcomeSchema("writer-unavailable", "WRITER_UNAVAILABLE", false),
  commandOutcomeSchema("sequence-exhausted", "PROJECT_SEQUENCE_EXHAUSTED", false),
  commandOutcomeSchema("inactive", "PROJECT_INACTIVE", false),
  commandOutcomeSchema("project-mismatch", "PROJECT_NOT_ACTIVE", false),
  commandOutcomeSchema("stale-activation", "PROJECT_ACTIVATION_STALE", false),
  commandOutcomeSchema("read-only", "WRITER_UNAVAILABLE", true),
  commandOutcomeSchema("stale-writer", "WRITER_FENCE_STALE", false),
  commandOutcomeSchema(
    "settlement-unavailable",
    "COMMAND_SETTLEMENT_UNAVAILABLE",
    false,
  ),
  commandOutcomeSchema(
    "coordinator-unavailable",
    "PROJECT_COORDINATOR_UNAVAILABLE",
    false,
  ),
  commandOutcomeSchema("broken", "WRITER_FENCE_CHECK_FAILED", false),
]).refine(
  (result) => result.status !== "settled" ||
    (result.receipt.projectId === result.projectId && result.receipt.commandId === result.commandId),
  { path: ["receipt"], message: "Receipt must match command result correlation." },
);
export type CanonicalProjectCommandResult = z.infer<typeof CanonicalProjectCommandResultSchema>;

export const CanonicalProjectSwitchRequestSchema = z.strictObject({
  from: z.strictObject({
    projectId: ProjectIdSchema,
    activationId: ProjectActivationIdSchema,
  }),
  to: CanonicalProjectActivationRequestSchema,
});
export type CanonicalProjectSwitchRequest = z.infer<typeof CanonicalProjectSwitchRequestSchema>;

function switchOutcomeSchema<
  const Status extends
    | "inactive"
    | "project-mismatch"
    | "stale-activation"
    | "coordinator-unavailable",
  const Code extends CanonicalProjectCommandDiagnosticCode,
>(status: Status, code: Code) {
  return z.strictObject({
    status: z.literal(status),
    request: CanonicalProjectSwitchRequestSchema,
    diagnostic: canonicalDiagnosticSchema.extend({
      code: z.literal(code),
      retryable: z.literal(false),
    }),
  });
}

const switchReleaseDiagnosticSchema = z.union([
  activationDiagnosticSchema.extend({
    code: CanonicalProjectActivationDiagnosticCodeSchema.extract(["WRITER_FENCE_STALE"]),
    retryable: z.literal(false),
  }),
  activationDiagnosticSchema.extend({
    code: CanonicalProjectActivationDiagnosticCodeSchema.extract([
      "WRITER_FENCE_RELEASE_FAILED",
      "WRITER_REPOSITORY_CLOSE_FAILED",
      "WRITER_LEASE_OPEN_FAILED",
      "WRITER_LEASE_LOCK_FAILED",
      "WRITER_LEASE_UNLOCK_FAILED",
      "WRITER_LEASE_CLOSE_FAILED",
      "PROJECT_STORAGE_RELEASE_FAILED",
    ]),
    retryable: z.literal(true),
  }),
]);

export const CanonicalProjectSwitchResultSchema = z
  .discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("target-result"),
      request: CanonicalProjectSwitchRequestSchema,
      target: CanonicalProjectActivationResultSchema,
    }),
    switchOutcomeSchema("inactive", "PROJECT_INACTIVE"),
    switchOutcomeSchema("project-mismatch", "PROJECT_NOT_ACTIVE"),
    switchOutcomeSchema("stale-activation", "PROJECT_ACTIVATION_STALE"),
    switchOutcomeSchema("coordinator-unavailable", "PROJECT_COORDINATOR_UNAVAILABLE"),
    z.strictObject({
      status: z.literal("release-failed"),
      request: CanonicalProjectSwitchRequestSchema,
      diagnostic: switchReleaseDiagnosticSchema,
    }),
  ])
  .refine(
    (result) =>
      result.status !== "target-result" ||
      result.target.request.projectId === result.request.to.projectId,
    {
      path: ["target", "request", "projectId"],
      message: "Switch target Project must match the requested destination.",
    },
  );
export type CanonicalProjectSwitchResult = z.infer<typeof CanonicalProjectSwitchResultSchema>;
```

### packages/protocol/src/canonical-writer-smoke-protocol.ts - NEW
Own the separate strict smoke transport, fixed fixture identities, and native metadata. Product Desktop/Harness message unions are unchanged. Exactly one start with one transferred port is accepted; peers additionally enforce proofId, fresh requestId, step number/order, one pending control, and exact result correlation.

```ts
import { z } from "zod";
import {
  CanonicalCommandReceiptSchema,
  CommandIdSchema,
  ProjectActivationIdSchema,
  TypedCommandSchema,
} from "./canonical-project-protocol.js";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { HarnessBootstrapSchema, MessageIdSchema } from "./protocol.js";
import { ProjectStorageCreateRequestIdSchema } from "./project-storage-protocol.js";

export const writerProofProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000101");
export const writerProofStaleProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000104");
export const writerProofStaleCreateRequestId = ProjectStorageCreateRequestIdSchema.parse(
  "00000000-0000-4000-8000-000000000114",
);
export const writerProofInactiveActivationId = ProjectActivationIdSchema.parse(
  "00000000-0000-4000-8000-000000000121",
);
export const writerProofFirstCommand = Object.freeze(TypedCommandSchema.parse({
  commandId: "00000000-0000-4000-8000-000000000131",
  type: "conformance.writer.noop",
  version: 1,
  payload: Object.freeze({}),
}));
export const writerProofNextCommand = Object.freeze(TypedCommandSchema.parse({
  ...writerProofFirstCommand,
  commandId: "00000000-0000-4000-8000-000000000132",
}));
export const writerProofStaleCommand = Object.freeze(TypedCommandSchema.parse({
  ...writerProofFirstCommand,
  commandId: "00000000-0000-4000-8000-000000000133",
}));

export const WriterProofNativeTargetSchema = z.enum([
  "win32-x64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64",
]);
export const writerProofNativePackageVersion = "1.5.1" as const;
export const writerProofNativeBindingFilename = "fs-native-extensions.node" as const;
export const WriterProofNativeMetadataSchema = z.strictObject({
  packageName: z.literal("fs-native-extensions"),
  packageVersion: z.literal(writerProofNativePackageVersion),
  target: WriterProofNativeTargetSchema,
  unpackedTargetBinding: z.literal(true),
  fallbackLoaded: z.literal(false),
});

export const WriterProofStartSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("writer-proof.connect"),
  proofId: MessageIdSchema,
  bootstrap: HarnessBootstrapSchema,
});
export type WriterProofStart = z.infer<typeof WriterProofStartSchema>;

const correlation = {
  version: z.literal(1),
  proofId: MessageIdSchema,
  requestId: MessageIdSchema,
  stepNumber: z.number().int().min(1).max(4),
} as const;

function expectedReceipt(commandId: z.infer<typeof CommandIdSchema>, sequence: 1 | 2) {
  return CanonicalCommandReceiptSchema.refine((receipt) =>
    receipt.projectId === writerProofProjectId && receipt.commandId === commandId &&
    receipt.commandType === writerProofFirstCommand.type && receipt.commandVersion === 1 &&
    receipt.projectSequence === sequence && receipt.writerGeneration === sequence &&
    receipt.outcome === "rejected" && receipt.rejection.code === "COMMAND_TYPE_UNSUPPORTED" &&
    receipt.rejection.retryable === false && receipt.events.length === 0,
  );
}

export const WriterProofControlSchema = z.discriminatedUnion("step", [
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.control"),
    step: z.literal("stale.initialize"), stepNumber: z.literal(1),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.control"),
    step: z.literal("stale.release"), stepNumber: z.literal(2),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.control"),
    step: z.literal("stale.attempt"), stepNumber: z.literal(3),
    replacementActivationId: ProjectActivationIdSchema,
    replacementWriterGeneration: z.literal(2),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.control"),
    step: z.literal("stale.finish"), stepNumber: z.literal(4),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.control"),
    step: z.literal("audit.initialize"), stepNumber: z.literal(1),
    activationIds: z.tuple([ProjectActivationIdSchema, ProjectActivationIdSchema])
      .refine(([first, second]) => first !== second),
    expectedReceipts: z.tuple([
      expectedReceipt(writerProofFirstCommand.commandId, 1),
      expectedReceipt(writerProofNextCommand.commandId, 2),
    ]).refine(([first, second]) => first.receiptId !== second.receiptId),
  }),
]);
export type WriterProofControl = z.infer<typeof WriterProofControlSchema>;

export const WriterProofEventSchema = z.discriminatedUnion("step", [
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.result"),
    step: z.literal("stale.initialize"), stepNumber: z.literal(1),
    projectId: z.literal(writerProofStaleProjectId),
    activationId: ProjectActivationIdSchema, writerGeneration: z.literal(1),
    native: WriterProofNativeMetadataSchema,
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.result"),
    step: z.literal("stale.release"), stepNumber: z.literal(2),
    testLeaseReleased: z.literal(true), oldWriterRetained: z.literal(true),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.result"),
    step: z.literal("stale.attempt"), stepNumber: z.literal(3),
    projectId: z.literal(writerProofStaleProjectId),
    activationId: ProjectActivationIdSchema,
    commandId: z.literal(writerProofStaleCommand.commandId),
    replacementActivationId: ProjectActivationIdSchema,
    replacementWriterGeneration: z.literal(2),
    status: z.literal("stale-writer"), code: z.literal("WRITER_FENCE_STALE"),
    retryable: z.literal(false),
    allCanonicalRowsUnchanged: z.literal(true),
    registryCalls: z.literal(0), handlerCalls: z.literal(0),
    identityCalls: z.literal(0), settlementClockCalls: z.literal(0),
    writerClose: z.literal("stale-refused"),
    operationalReleaseAuthorized: z.literal(false),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.result"),
    step: z.literal("stale.finish"), stepNumber: z.literal(4),
    teardown: z.literal("test-resources-only"),
  }),
  z.strictObject({
    ...correlation, kind: z.literal("writer-proof.result"),
    step: z.literal("audit.initialize"), stepNumber: z.literal(1),
    projectId: z.literal(writerProofProjectId),
    audit: z.literal("exact-ledger-and-abandoned-recovery"),
    lastProjectSequence: z.literal(2), lastWriterGeneration: z.literal(2),
    receipts: z.literal(2), rejections: z.literal(2), idempotency: z.literal(2),
    events: z.literal(0), generations: z.literal(2), handoffs: z.literal(2),
    abandonedRecoveryRecords: z.literal(1), uncertainRecoveryRecords: z.literal(0),
    fence: z.literal("released"),
    native: WriterProofNativeMetadataSchema,
  }),
]);
export type WriterProofEvent = z.infer<typeof WriterProofEventSchema>;
```

### packages/protocol/src/domain-identity-schema.ts:1-12 - MODIFY

```ts
export function lowercaseDomainIdentitySchema<T extends DomainIdentity<string>>(
  schema: z.ZodType<T>,
  message = "Identity must use lowercase UUID text.",
) {
  return schema.refine((value) => value === value.toLowerCase(), {
    message,
  });
}

export const ProjectIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelProjectId>(),
  "Project identity must use lowercase UUID text.",
);
```

### packages/protocol/src/project-storage-protocol.ts:9-34 - MODIFY

```ts
import {
  domainIdentitySchema,
  lowercaseDomainIdentitySchema,
  ProjectIdSchema,
} from "./domain-identity-schema.js";

export const StorageIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelStorageId>(),
);
export const StorageGenerationIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelStorageGenerationId>(),
);
export const CanonicalDatabaseLineageIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelCanonicalDatabaseLineageId>(),
);
export const RuntimeDatabaseLineageIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelRuntimeDatabaseLineageId>(),
);
export const ProjectStorageCreateRequestIdSchema = lowercaseDomainIdentitySchema(
  domainIdentitySchema<KernelProjectStorageCreateRequestId>(),
);
```

### packages/protocol/src/protocol.ts:1-250,439-532 - MODIFY
Add canonical Project commands/events, require causation for `request.failure`, and require null causation for `system.failure`.

```ts
import type {
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectCommandRequest,
  CanonicalProjectCommandResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
} from "./canonical-project-protocol.js";
import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
} from "./canonical-project-protocol.js";

export const protocolVersion = 4 as const;

export const HarnessFailureCodeSchema = z.enum([
  "PROTOCOL_MESSAGE_INVALID",
  "PROTOCOL_VERSION_UNSUPPORTED",
  "HARNESS_INTERNAL_FAILURE",
]);
export type HarnessFailureCode = z.infer<typeof HarnessFailureCodeSchema>;

const HarnessFailurePayloadSchema = z.strictObject({
  code: HarnessFailureCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
});

type HarnessFailure = Readonly<z.infer<typeof HarnessFailurePayloadSchema>>;

const RequestFailureEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  causationId: MessageIdSchema,
  event: z.literal("request.failure"),
  payload: HarnessFailurePayloadSchema,
});

const SystemFailureEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  causationId: z.null(),
  event: z.literal("system.failure"),
  payload: HarnessFailurePayloadSchema,
});

const ProjectActivateCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.activate"),
  payload: CanonicalProjectActivationRequestSchema,
});
const ProjectCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.command"),
  payload: CanonicalProjectCommandRequestSchema,
});
const ProjectSwitchCommandSchema = z.strictObject({
  ...DesktopCommandMetadataSchema,
  command: z.literal("project.switch"),
  payload: CanonicalProjectSwitchRequestSchema,
});

const ProjectActivateResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.activate.result"),
  payload: CanonicalProjectActivationResultSchema,
});
const ProjectCommandResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.command.result"),
  payload: CanonicalProjectCommandResultSchema,
});
const ProjectSwitchResultEventSchema = z.strictObject({
  ...HarnessEventMetadataSchema,
  event: z.literal("project.switch.result"),
  payload: CanonicalProjectSwitchResultSchema,
});

export const DesktopMessageSchema = z.discriminatedUnion("command", [
  HandshakeCommandSchema,
  ProjectOpenCommandSchema,
  ProjectCreateCommandSchema,
  ProjectCloseCommandSchema,
  ProjectActivateCommandSchema,
  ProjectCommandSchema,
  ProjectSwitchCommandSchema,
  WorkspaceQueryCommandSchema,
  WorkspaceIntentCommandSchema,
]);
export type DesktopMessage = z.infer<typeof DesktopMessageSchema>;

export const HarnessMessageSchema = z.discriminatedUnion("event", [
  ReadyEventSchema,
  RequestFailureEventSchema,
  SystemFailureEventSchema,
  ProjectOpenResultEventSchema,
  ProjectCreateResultEventSchema,
  ProjectCloseResultEventSchema,
  ProjectActivateResultEventSchema,
  ProjectCommandResultEventSchema,
  ProjectSwitchResultEventSchema,
  WorkspaceQueryResultEventSchema,
  WorkspaceIntentResultEventSchema,
  WorkspaceProjectionInvalidatedEventSchema,
]);
export type HarnessMessage = z.infer<typeof HarnessMessageSchema>;

export function createRequestFailureEvent(
  metadata: Omit<EventMetadata, "causationId"> & Readonly<{ causationId: MessageId }>,
  failure: HarnessFailure,
): HarnessMessage {
  return createEvent(metadata, "request.failure", failure);
}

export function createSystemFailureEvent(
  metadata: Omit<EventMetadata, "causationId"> & Readonly<{ causationId: null }>,
  failure: HarnessFailure,
): HarnessMessage {
  return createEvent(metadata, "system.failure", failure);
}

export function createProjectActivateCommand(
  metadata: CommandMetadata,
  request: CanonicalProjectActivationRequest,
): DesktopMessage {
  return createCommand(metadata, "project.activate", request);
}

export function createProjectCommand(
  metadata: CommandMetadata,
  request: CanonicalProjectCommandRequest,
): DesktopMessage {
  return createCommand(metadata, "project.command", request);
}

export function createProjectActivateResultEvent(
  metadata: EventMetadata,
  result: CanonicalProjectActivationResult,
): HarnessMessage {
  return createEvent(metadata, "project.activate.result", result);
}

export function createProjectCommandResultEvent(
  metadata: EventMetadata,
  result: CanonicalProjectCommandResult,
): HarnessMessage {
  return createEvent(metadata, "project.command.result", result);
}

export function createProjectSwitchCommand(
  metadata: CommandMetadata,
  request: CanonicalProjectSwitchRequest,
): DesktopMessage {
  return createCommand(metadata, "project.switch", request);
}

export function createProjectSwitchResultEvent(
  metadata: EventMetadata,
  result: CanonicalProjectSwitchResult,
): HarnessMessage {
  return createEvent(metadata, "project.switch.result", result);
}
```

### packages/protocol/src/index.ts:1-102 - MODIFY
Export canonical Project protocol schemas and inferred types.

S5 delta (approved): export the new receipt, JSON, rejection, identity, and order schemas/types; retain all activation, switch, and failure exports.

S7 delta (approved): merge explicit smoke transport/schema/constant exports into the same declared surface without changing any prior export.

```ts
export type {
  WriterProofControl,
  WriterProofEvent,
  WriterProofStart,
} from "./canonical-writer-smoke-protocol.js";
export {
  WriterProofControlSchema,
  WriterProofEventSchema,
  WriterProofNativeMetadataSchema,
  WriterProofNativeTargetSchema,
  WriterProofStartSchema,
  writerProofFirstCommand,
  writerProofInactiveActivationId,
  writerProofNativeBindingFilename,
  writerProofNativePackageVersion,
  writerProofNextCommand,
  writerProofProjectId,
  writerProofStaleCommand,
  writerProofStaleCreateRequestId,
  writerProofStaleProjectId,
} from "./canonical-writer-smoke-protocol.js";
export type {
  CanonicalCommandReceipt,
  CanonicalEventId,
  CanonicalEventOrdinal,
  CanonicalJsonValue,
  CanonicalProjectActivationDiagnosticCode,
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectCommandDiagnosticCode,
  CanonicalProjectCommandRequest,
  CanonicalProjectCommandResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
  CommandId,
  CommandReceiptId,
  CommandRejection,
  ProjectActivationId,
  ProjectSequence,
  TypedCommand,
  WriterGeneration,
} from "./canonical-project-protocol.js";
export {
  CanonicalCommandReceiptSchema,
  CanonicalEventIdSchema,
  CanonicalEventOrdinalSchema,
  CanonicalJsonValueSchema,
  CanonicalSettlementTimeSchema,
  CommandReceiptIdSchema,
  CommandReceiptMetadataSchema,
  CommandRejectionCodeSchema,
  CommandRejectionSchema,
  ProjectSequenceSchema,
  SystemCommandRejectionCodeSchema,
  CanonicalProjectActivationDiagnosticCodeSchema,
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandDiagnosticCodeSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  CommandIdSchema,
  ProjectActivationIdSchema,
  TypedCommandSchema,
  WriterGenerationSchema,
} from "./canonical-project-protocol.js";

export {
  createRequestFailureEvent,
  createSystemFailureEvent,
  createHandshakeCommand,
  createProjectActivateCommand,
  createProjectActivateResultEvent,
  createProjectCloseCommand,
  createProjectCloseResultEvent,
  createProjectCreateCommand,
  createProjectCreateResultEvent,
  createProjectCommand,
  createProjectCommandResultEvent,
  createProjectOpenCommand,
  createProjectOpenResultEvent,
  createProjectSwitchCommand,
  createProjectSwitchResultEvent,
  createReadyEvent,
  createWorkspaceIntentCommand,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryCommand,
  createWorkspaceQueryResultEvent,
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

### apps/harness/src/project-storage-application.ts:15-56 - MODIFY

```ts
export type ProjectStorageOwnerOutcome =
  | Readonly<{ status: "ready"; result: unknown }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export type ProjectStorageActivationSession =
  | Readonly<{
      mode: "read-write";
      result: Extract<ProjectStorageOpenResult, { status: "opened" }>;
      canonicalDatabasePath: string;
      writerLeasePath: string;
      close(): Promise<void>;
    }>
  | Readonly<{
      mode: "safe-mode";
      result: Extract<ProjectStorageOpenResult, { status: "safe-mode" }>;
      close(): Promise<void>;
    }>;

export type ProjectStorageActivationOutcome =
  | Readonly<{ status: "ready"; session: ProjectStorageActivationSession }>
  | Readonly<{
      status: "not-registered";
      result: Extract<ProjectStorageOpenResult, { status: "not-registered" }>;
    }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "broken"; message: string }>;

export interface ProjectStorageActivationPort {
  acquireActivation(request: ProjectStorageOpenRequest): Promise<ProjectStorageActivationOutcome>;
}

export interface ProjectStorageOwnerPort {
  open(request: ProjectStorageOpenRequest): Promise<ProjectStorageOwnerOutcome>;
  create(request: ProjectStorageCreateRequest): Promise<ProjectStorageOwnerOutcome>;
  close(request: ProjectStorageCloseRequest): Promise<ProjectStorageOwnerOutcome>;
  stop(): Promise<void>;
}

export interface ProjectStorageOwner
  extends ProjectStorageOwnerPort,
    ProjectStorageActivationPort {}
```

### apps/harness/src/storage/project-storage-opening.ts:141-157,394-413 - MODIFY

```ts
export type RetainedProjectStorageSession = Readonly<{
  mode: "read-write" | "safe-mode";
  close(): Promise<void>;
}>;

export type ClassifiedProjectStorageOpening =
  | Readonly<{
      result: Extract<ProjectStorageOpenResult, { status: "not-registered" }>;
    }>
  | Readonly<{
      result: Extract<ProjectStorageOpenResult, { status: "opened" }>;
      session: RetainedProjectStorageSession & Readonly<{ mode: "read-write" }>;
    }>
  | Readonly<{
      result: Extract<ProjectStorageOpenResult, { status: "safe-mode" }>;
      session: RetainedProjectStorageSession & Readonly<{ mode: "safe-mode" }>;
    }>;

type OpeningDatabaseClient = Readonly<{ close(): Promise<void> }>;
export type OpeningDatabaseClients = Readonly<{
  canonical: OpeningDatabaseClient | undefined;
  runtime: OpeningDatabaseClient | undefined;
}>;

export function createOpeningRelease(openedClients: OpeningDatabaseClients) {
  let canonicalClosed = false;
  let runtimeClosed = false;
  let releaseAttempt: Promise<void> | undefined;

  return (): Promise<void> => {
    if (releaseAttempt !== undefined) return releaseAttempt;
    const attempt = (async () => {
      const errors: unknown[] = [];
      if (!canonicalClosed && openedClients.canonical !== undefined) {
        try {
          await openedClients.canonical.close();
          canonicalClosed = true;
        } catch (error) {
          errors.push(error);
        }
      }
      if (!runtimeClosed && openedClients.runtime !== undefined) {
        try {
          await openedClients.runtime.close();
          runtimeClosed = true;
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) {
        throw new AggregateError(errors, "Project Storage database release failed.");
      }
    })();
    releaseAttempt = attempt;
    void attempt.catch(() => {
      if (releaseAttempt === attempt) releaseAttempt = undefined;
    });
    return attempt;
  };
}
```

### apps/harness/src/storage/local-libsql-worker-client.ts:467-521 - MODIFY

```ts
class WorkerLocalLibsqlClient implements LocalLibsqlClient {
  readonly #broker: LocalLibsqlWorkerBroker;
  readonly #clientId: Promise<number>;
  #closing = false;
  #closeAttempt: Promise<void> | undefined;

  constructor(databasePath: string, pool: LocalLibsqlWorkerPool) {
    this.#broker = getSharedBroker(pool);
    this.#clientId = this.#broker.request(
      { operation: "open-client", url: pathToFileURL(databasePath).href },
      clientIdSchema,
    );
  }

  execute(statement: InStatement, args?: InArgs): Promise<LocalLibsqlResultSet> {
    return this.request(
      {
        operation: "execute",
        transactionId: null,
        statement: normalizeStatement(statement, args),
      },
      resultSetSchema,
    );
  }

  async transaction(mode: "write"): Promise<LocalLibsqlTransaction> {
    const transactionId = await this.request({ operation: "begin", mode }, transactionIdSchema);
    return new WorkerLocalLibsqlTransaction(this, transactionId);
  }

  executeInTransaction(
    transactionId: number,
    statement: InStatement,
  ): Promise<LocalLibsqlResultSet> {
    return this.request({ operation: "execute", transactionId, statement }, resultSetSchema);
  }

  async request<Result>(request: ClientWorkerRequest, schema: z.ZodType<Result>): Promise<Result> {
    if (this.#closing) throw new Error("Local libSQL client is closed.");
    const clientId = await this.#clientId;
    return this.#broker.request({ ...request, clientId }, schema);
  }

  close(): Promise<void> {
    if (this.#closeAttempt !== undefined) return this.#closeAttempt;
    this.#closing = true;
    const attempt = this.closeClient();
    this.#closeAttempt = attempt;
    void attempt.catch(() => {
      if (this.#closeAttempt === attempt) this.#closeAttempt = undefined;
    });
    return attempt;
  }

  private async closeClient(): Promise<void> {
    const clientId = await this.#clientId;
    await this.#broker.request({ operation: "close-client", clientId }, nullResultSchema);
  }
}
```

### apps/harness/src/active-project-coordinator.ts - NEW
Own the session-scoped activation state machine, admission barrier, switching, recovery, and shutdown.

Slice 4 extends the single Slice 3 implementation in place: the acquisition callback becomes `activateWithinLifecycle`, shared scheduling closes admission before enqueue, and common release composes the unchanged Writer/Storage owners. Existing activation acquisition order, expected results, failure diagnostics, and stop sharing/retry contracts stay fixed. The necessary exception-safety extension retains ownership before cleanup timestamp evaluation and prevents a second cleanup attempt within one failed activation. A release-failed state's epoch is actual prior active authority or null, never a newly allocated but unsuccessful activation ID.

S5 delta (approved): after the unchanged synchronous admission/source checks, submit to `writer.settle`. Immediate busy/unavailable results add no completion to the set; accepted work and same-key joiners retain the existing success/failure completion wrapper. Narrow diagnostic helpers to non-settled results. Lifecycle/source-qualified switch code is otherwise unchanged.

```ts
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchResultSchema,
  type CanonicalProjectActivationDiagnosticCode,
  type CanonicalProjectActivationRequest,
  type CanonicalProjectActivationResult,
  type CanonicalProjectCommandRequest,
  type CanonicalProjectCommandResult,
  type CanonicalProjectSwitchRequest,
  type CanonicalProjectSwitchResult,
  type ProjectActivationId,
  type ProjectId,
} from "@slopstop/protocol";
import type {
  ProjectStorageActivationPort,
  ProjectStorageActivationSession,
} from "./project-storage-application.js";
import {
  createCanonicalProjectWriter,
  type CanonicalProjectWriter,
  type CanonicalProjectWriterReleaseFailureCode,
} from "./canonical-project-writer.js";
import type {
  CanonicalCommandRepositoryFactory,
  WriterCapabilityToken,
} from "./storage/canonical-command-repository.js";
import type {
  CanonicalWriterLease,
  CanonicalWriterLeaseCleanup,
  CanonicalWriterLeaseFactory,
  CanonicalWriterLeaseFailureCode,
} from "./storage/canonical-writer-lease.js";
import { SerialLock } from "./storage/serial-lock.js";

export interface ActiveProjectCoordinator {
  activate(request: CanonicalProjectActivationRequest): Promise<CanonicalProjectActivationResult>;
  switchProject(request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult>;
  execute(request: CanonicalProjectCommandRequest): Promise<CanonicalProjectCommandResult>;
  stop(): Promise<void>;
}

export type ActiveProjectCoordinatorDependencies = Readonly<{
  storage: ProjectStorageActivationPort;
  leases: CanonicalWriterLeaseFactory;
  repositories: CanonicalCommandRepositoryFactory;
  createActivationId(): ProjectActivationId;
  createWriterToken(): WriterCapabilityToken;
  now(): string;
}>;

type StorageOwnership = Readonly<{
  stage: "storage";
  session: ProjectStorageActivationSession;
}>;

type LeaseOwnership = Readonly<{
  stage: "lease";
  lease: CanonicalWriterLease;
  session: ProjectStorageActivationSession;
}>;

type LeaseFileCleanupOwnership = Readonly<{
  stage: "lease-file-cleanup";
  cleanup: CanonicalWriterLeaseCleanup;
  session: ProjectStorageActivationSession;
}>;

type RepositoryCleanupOwnership = Readonly<{
  stage: "repository-cleanup";
  cleanup: Readonly<{ close(): Promise<void> }>;
  lease: CanonicalWriterLease;
  session: ProjectStorageActivationSession;
}>;

type WriterOwnership = Readonly<{
  stage: "writer";
  writer: CanonicalProjectWriter;
  session: ProjectStorageActivationSession;
}>;

type ActivationOwnership =
  | StorageOwnership
  | LeaseFileCleanupOwnership
  | LeaseOwnership
  | RepositoryCleanupOwnership
  | WriterOwnership;

type ActiveReadOnlyState = Readonly<{
  status: "active";
  access: "read-only";
  projectId: ProjectId;
  activationId: ProjectActivationId;
  ownership: StorageOwnership;
}>;

type ActiveReadWriteState = Readonly<{
  status: "active";
  access: "read-write";
  projectId: ProjectId;
  activationId: ProjectActivationId;
  writer: CanonicalProjectWriter;
  ownership: WriterOwnership;
  admittedCommands: Set<Promise<void>>;
}>;

type CoordinatorState =
  | Readonly<{ status: "inactive" }>
  | Readonly<{ status: "activating"; projectId: ProjectId }>
  | ActiveReadOnlyState
  | ActiveReadWriteState
  | Readonly<{ status: "releasing"; projectId: ProjectId }>
  | Readonly<{
      status: "release-failed";
      projectId: ProjectId;
      activationId: ProjectActivationId | null;
      ownership: ActivationOwnership;
    }>
  | Readonly<{ status: "stopped" }>;

type OwnedCoordinatorState =
  | ActiveReadOnlyState
  | ActiveReadWriteState
  | Extract<CoordinatorState, { status: "release-failed" }>;

type ReleaseFailureCode =
  | CanonicalProjectWriterReleaseFailureCode
  | CanonicalWriterLeaseFailureCode
  | "WRITER_REPOSITORY_CLOSE_FAILED"
  | "PROJECT_STORAGE_RELEASE_FAILED";

type ReleaseResult =
  | Readonly<{ status: "released" }>
  | Readonly<{
      status: "failed";
      code: ReleaseFailureCode;
      ownership: ActivationOwnership;
    }>;

function propertyCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  if (!("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function writerReleaseCode(error: unknown): CanonicalProjectWriterReleaseFailureCode {
  const code = propertyCode(error);
  switch (code) {
    case "WRITER_FENCE_STALE":
    case "WRITER_FENCE_RELEASE_FAILED":
    case "WRITER_REPOSITORY_CLOSE_FAILED":
    case "WRITER_LEASE_OPEN_FAILED":
    case "WRITER_LEASE_LOCK_FAILED":
    case "WRITER_LEASE_UNLOCK_FAILED":
    case "WRITER_LEASE_CLOSE_FAILED":
      return code;
    default:
      return "WRITER_FENCE_RELEASE_FAILED";
  }
}

function leaseReleaseCode(error: unknown): CanonicalWriterLeaseFailureCode {
  const code = propertyCode(error);
  return code === "WRITER_LEASE_UNLOCK_FAILED" || code === "WRITER_LEASE_CLOSE_FAILED"
    ? code
    : "WRITER_LEASE_CLOSE_FAILED";
}

function activationReleaseCode(code: ReleaseFailureCode): CanonicalProjectActivationDiagnosticCode {
  switch (code) {
    case "PROJECT_STORAGE_RELEASE_FAILED":
    case "WRITER_FENCE_STALE":
    case "WRITER_FENCE_RELEASE_FAILED":
    case "WRITER_REPOSITORY_CLOSE_FAILED":
    case "WRITER_LEASE_OPEN_FAILED":
    case "WRITER_LEASE_LOCK_FAILED":
    case "WRITER_LEASE_UNLOCK_FAILED":
    case "WRITER_LEASE_CLOSE_FAILED":
      return code;
    default:
      return "PROJECT_STORAGE_RELEASE_FAILED";
  }
}

async function releaseOwnership(
  ownership: ActivationOwnership,
  releasedAt: string,
): Promise<ReleaseResult> {
  let remaining = ownership;
  if (remaining.stage === "writer") {
    try {
      await remaining.writer.close(releasedAt);
    } catch (error) {
      return { status: "failed", code: writerReleaseCode(error), ownership: remaining };
    }
    remaining = { stage: "storage", session: remaining.session };
  }
  if (remaining.stage === "repository-cleanup") {
    try {
      await remaining.cleanup.close();
    } catch {
      return {
        status: "failed",
        code: "WRITER_REPOSITORY_CLOSE_FAILED",
        ownership: remaining,
      };
    }
    remaining = { stage: "lease", lease: remaining.lease, session: remaining.session };
  }
  if (remaining.stage === "lease-file-cleanup") {
    try {
      await remaining.cleanup.close();
    } catch {
      return {
        status: "failed",
        code: "WRITER_LEASE_CLOSE_FAILED",
        ownership: remaining,
      };
    }
    remaining = { stage: "storage", session: remaining.session };
  }
  if (remaining.stage === "lease") {
    try {
      await remaining.lease.release();
    } catch (error) {
      return { status: "failed", code: leaseReleaseCode(error), ownership: remaining };
    }
    remaining = { stage: "storage", session: remaining.session };
  }
  try {
    await remaining.session.close();
    return { status: "released" };
  } catch {
    return {
      status: "failed",
      code: "PROJECT_STORAGE_RELEASE_FAILED",
      ownership: remaining,
    };
  }
}

function activationFailure(
  request: CanonicalProjectActivationRequest,
  status: "rejected" | "unavailable" | "broken",
  code: CanonicalProjectActivationDiagnosticCode,
  message: string,
  retryable = false,
): CanonicalProjectActivationResult {
  return CanonicalProjectActivationResultSchema.parse({
    status,
    request,
    diagnostic: { code, message, retryable },
  });
}

function commandCorrelation(request: CanonicalProjectCommandRequest) {
  return {
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
  };
}

function commandFailure(
  request: CanonicalProjectCommandRequest,
  status: Exclude<CanonicalProjectCommandResult, { status: "settled" }>["status"],
  code: Exclude<CanonicalProjectCommandResult, { status: "settled" }>["diagnostic"]["code"],
  message: string,
  retryable = false,
): CanonicalProjectCommandResult {
  return CanonicalProjectCommandResultSchema.parse({
    status,
    ...commandCorrelation(request),
    diagnostic: { code, message, retryable },
  });
}

type CommandAdmission =
  | Readonly<{ status: "admitted"; state: ActiveReadWriteState }>
  | Readonly<{ status: "rejected"; result: CanonicalProjectCommandResult }>;

function admitCommand(
  state: CoordinatorState,
  request: CanonicalProjectCommandRequest,
): CommandAdmission {
  if (
    state.status === "activating" ||
    state.status === "releasing" ||
    state.status === "release-failed" ||
    state.status === "stopped"
  ) {
    return {
      status: "rejected",
      result: commandFailure(
        request,
        "coordinator-unavailable",
        "PROJECT_COORDINATOR_UNAVAILABLE",
        "Canonical Project coordination is unavailable.",
      ),
    };
  }
  if (state.status === "inactive") {
    return {
      status: "rejected",
      result: commandFailure(
        request,
        "inactive",
        "PROJECT_INACTIVE",
        "No Project is active for Typed commands.",
      ),
    };
  }
  if (state.projectId !== request.projectId) {
    return {
      status: "rejected",
      result: commandFailure(
        request,
        "project-mismatch",
        "PROJECT_NOT_ACTIVE",
        "The command Project is not active.",
      ),
    };
  }
  if (state.activationId !== request.activationId) {
    return {
      status: "rejected",
      result: commandFailure(
        request,
        "stale-activation",
        "PROJECT_ACTIVATION_STALE",
        "The command activation is stale.",
      ),
    };
  }
  if (state.access === "read-only") {
    return {
      status: "rejected",
      result: commandFailure(
        request,
        "read-only",
        "WRITER_UNAVAILABLE",
        "The active Project has no write authority.",
        true,
      ),
    };
  }
  return { status: "admitted", state };
}

export function createActiveProjectCoordinator(
  dependencies: ActiveProjectCoordinatorDependencies,
): ActiveProjectCoordinator {
  const lifecycle = new SerialLock();
  let state: CoordinatorState = { status: "inactive" };
  let stopAttempt: Promise<void> | undefined;
  let pendingLifecycleOperations = 0;

  const scheduleLifecycle = async <Result>(operation: () => Promise<Result>): Promise<Result> => {
    pendingLifecycleOperations += 1;
    try {
      return await lifecycle.run(operation);
    } finally {
      pendingLifecycleOperations -= 1;
    }
  };

  const retainReleaseFailure = (
    projectId: ProjectId,
    result: Extract<ReleaseResult, { status: "failed" }>,
  ): CanonicalProjectActivationResult => {
    state = {
      status: "release-failed",
      projectId,
      activationId: null,
      ownership: result.ownership,
    };
    return activationFailure(
      { projectId },
      "broken",
      activationReleaseCode(result.code),
      "Project activation resources could not be released.",
    );
  };

  const releaseOwnedState = async (ownedState: OwnedCoordinatorState): Promise<ReleaseResult> => {
    const { projectId, activationId, ownership } = ownedState;
    state = ownedState;
    if (ownedState.status === "active" && ownedState.access === "read-write") {
      await Promise.all([...ownedState.admittedCommands]);
    }
    // Keep the owned snapshot if the clock throws before release starts.
    const releasedAt = dependencies.now();
    state = { status: "releasing", projectId };
    const release = await releaseOwnership(ownership, releasedAt);
    if (release.status === "failed") {
      state = {
        status: "release-failed",
        projectId,
        activationId,
        ownership: release.ownership,
      };
    } else {
      state = { status: "inactive" };
    }
    return release;
  };

  const completeStop = async (): Promise<void> => {
    if (state.status === "stopped") return;
    if (state.status === "inactive") {
      state = { status: "stopped" };
      return;
    }
    if (state.status === "activating" || state.status === "releasing") {
      throw new Error("Canonical Project lifecycle state is inconsistent.");
    }
    const release = await releaseOwnedState(state);
    if (release.status === "failed") {
      throw new Error("Canonical Project activation release failed.");
    }
    state = { status: "stopped" };
  };

  const stop = (): Promise<void> => {
    if (stopAttempt !== undefined) return stopAttempt;
    const attempt = scheduleLifecycle(completeStop);
    stopAttempt = attempt;
    void attempt.catch(() => {
      if (stopAttempt === attempt) stopAttempt = undefined;
    });
    return attempt;
  };

  const activateWithinLifecycle = async (
    request: CanonicalProjectActivationRequest,
  ): Promise<CanonicalProjectActivationResult> => {
    if (state.status === "stopped") {
      return activationFailure(
        request,
        "unavailable",
        "PROJECT_COORDINATOR_UNAVAILABLE",
        "Canonical Project coordination is unavailable.",
      );
    }
    if (state.status !== "inactive") {
      return activationFailure(
        request,
        "rejected",
        "PROJECT_ALREADY_ACTIVE",
        "A Project activation already owns this harness session.",
      );
    }
    state = { status: "activating", projectId: request.projectId };
    let ownership: ActivationOwnership | undefined;
    let cleanupAttempt: Promise<ReleaseResult> | undefined;
    const releaseAcquisitionOnce = (): Promise<ReleaseResult> => {
      if (cleanupAttempt !== undefined) return cleanupAttempt;
      if (ownership === undefined) {
        state = { status: "inactive" };
        return Promise.resolve({ status: "released" });
      }
      cleanupAttempt = releaseOwnedState({
        status: "release-failed",
        projectId: request.projectId,
        activationId: null,
        ownership,
      });
      return cleanupAttempt;
    };
    const releaseAfterFailedActivation = async (
      primaryCode: CanonicalProjectActivationDiagnosticCode,
      primaryMessage: string,
    ): Promise<CanonicalProjectActivationResult> => {
      const release = await releaseAcquisitionOnce();
      if (release.status === "failed") return retainReleaseFailure(request.projectId, release);
      return activationFailure(request, "broken", primaryCode, primaryMessage);
    };
    try {
      const storage = await dependencies.storage.acquireActivation(request);
      if (storage.status === "unavailable") {
        state = { status: "inactive" };
        return activationFailure(
          request,
          "unavailable",
          "PROJECT_STORAGE_UNAVAILABLE",
          "Project Storage is unavailable.",
          true,
        );
      }
      if (storage.status === "broken") {
        state = { status: "inactive" };
        return activationFailure(
          request,
          "broken",
          "PROJECT_STORAGE_BROKEN",
          "Project Storage activation failed.",
        );
      }
      if (storage.status === "not-registered") {
        state = { status: "inactive" };
        return { status: "not-registered", request };
      }

      ownership = { stage: "storage", session: storage.session };
      if (storage.session.mode === "safe-mode") {
        const release = await releaseAcquisitionOnce();
        if (release.status === "failed") return retainReleaseFailure(request.projectId, release);
        state = { status: "inactive" };
        return {
          status: "safe-mode",
          request,
          identity: storage.session.result.identity,
          canonicalHealth: storage.session.result.canonicalHealth,
          runtimeHealth: storage.session.result.runtimeHealth,
        };
      }

      const activationId = dependencies.createActivationId();
      const leaseAcquisition = await dependencies.leases.acquire(storage.session.writerLeasePath);
      if (leaseAcquisition.status === "contended") {
        state = {
          status: "active",
          access: "read-only",
          projectId: request.projectId,
          activationId,
          ownership,
        };
        return {
          status: "active",
          request,
          access: "read-only",
          activationId,
          writerGeneration: null,
          diagnostic: {
            code: "WRITER_UNAVAILABLE",
            message: "Another SlopStop process holds Project write authority.",
            retryable: true,
          },
        };
      }
      if (leaseAcquisition.status === "broken") {
        if (leaseAcquisition.cleanup !== undefined) {
          ownership = {
            stage: "lease-file-cleanup",
            cleanup: leaseAcquisition.cleanup,
            session: storage.session,
          };
          state = {
            status: "release-failed",
            projectId: request.projectId,
            activationId: null,
            ownership,
          };
          return activationFailure(
            request,
            "broken",
            "WRITER_LEASE_CLOSE_FAILED",
            "Project activation resources could not be released.",
          );
        }
        return releaseAfterFailedActivation(
          leaseAcquisition.error.code,
          leaseAcquisition.error.message,
        );
      }

      ownership = {
        stage: "lease",
        lease: leaseAcquisition.lease,
        session: storage.session,
      };
      const repositoryActivation = await dependencies.repositories.activate({
        canonicalDatabasePath: storage.session.canonicalDatabasePath,
        projectId: request.projectId,
        activationId,
        writerToken: dependencies.createWriterToken(),
        activatedAt: dependencies.now(),
      });
      if (repositoryActivation.status === "broken") {
        if (repositoryActivation.cleanup !== undefined) {
          ownership = {
            stage: "repository-cleanup",
            cleanup: repositoryActivation.cleanup,
            lease: leaseAcquisition.lease,
            session: storage.session,
          };
          state = {
            status: "release-failed",
            projectId: request.projectId,
            activationId: null,
            ownership,
          };
          return activationFailure(
            request,
            "broken",
            "WRITER_REPOSITORY_CLOSE_FAILED",
            "Project activation resources could not be released.",
          );
        }
        return releaseAfterFailedActivation(
          "WRITER_FENCE_ACTIVATION_FAILED",
          repositoryActivation.error.message,
        );
      }
      const writer = createCanonicalProjectWriter({
        projectId: request.projectId,
        activationId,
        writerGeneration: repositoryActivation.writerGeneration,
        repository: repositoryActivation.repository,
        lease: leaseAcquisition.lease,
      });
      const writerOwnership = {
        stage: "writer",
        writer,
        session: storage.session,
      } satisfies WriterOwnership;
      state = {
        status: "active",
        access: "read-write",
        projectId: request.projectId,
        activationId,
        writer,
        ownership: writerOwnership,
        admittedCommands: new Set(),
      };
      return {
        status: "active",
        request,
        access: "read-write",
        activationId,
        writerGeneration: writer.writerGeneration,
      };
    } catch (error) {
      const release = await releaseAcquisitionOnce();
      if (release.status === "failed") return retainReleaseFailure(request.projectId, release);
      throw error;
    }
  };

  const switchFailure = (
    request: CanonicalProjectSwitchRequest,
    status: Exclude<CanonicalProjectSwitchResult["status"], "target-result">,
    code: Exclude<CanonicalProjectSwitchResult, { status: "target-result" }>["diagnostic"]["code"],
    message: string,
    retryable = false,
  ): CanonicalProjectSwitchResult =>
    CanonicalProjectSwitchResultSchema.parse({
      status,
      request,
      diagnostic: { code, message, retryable },
    });

  return {
    activate: (request) => scheduleLifecycle(() => activateWithinLifecycle(request)),
    switchProject: (request) =>
      scheduleLifecycle(async () => {
        const source = state;
        if (
          source.status === "stopped" ||
          source.status === "activating" ||
          source.status === "releasing" ||
          (source.status === "release-failed" && source.activationId === null)
        ) {
          return switchFailure(
            request,
            "coordinator-unavailable",
            "PROJECT_COORDINATOR_UNAVAILABLE",
            "Canonical Project coordination is unavailable.",
          );
        }
        if (source.status === "inactive") {
          return switchFailure(
            request,
            "inactive",
            "PROJECT_INACTIVE",
            "No Project is active for switching.",
          );
        }
        if (source.projectId !== request.from.projectId) {
          return switchFailure(
            request,
            "project-mismatch",
            "PROJECT_NOT_ACTIVE",
            "The switch source Project is not active.",
          );
        }
        if (source.activationId !== request.from.activationId) {
          return switchFailure(
            request,
            "stale-activation",
            "PROJECT_ACTIVATION_STALE",
            "The switch source activation is stale.",
          );
        }
        const release = await releaseOwnedState(source);
        if (release.status === "failed") {
          return switchFailure(
            request,
            "release-failed",
            release.code,
            "Project activation resources could not be released.",
            release.code !== "WRITER_FENCE_STALE",
          );
        }
        const target = await activateWithinLifecycle(request.to);
        return CanonicalProjectSwitchResultSchema.parse({ status: "target-result", request, target });
      }),
    execute: async (request) => {
      if (pendingLifecycleOperations > 0) {
        return commandFailure(
          request,
          "coordinator-unavailable",
          "PROJECT_COORDINATOR_UNAVAILABLE",
          "Canonical Project coordination is unavailable.",
        );
      }
      const admission = admitCommand(state, request);
      if (admission.status === "rejected") return admission.result;
      const observed = admission.state;

      const submission = observed.writer.settle(request.command);
      if (submission.status === "completed") return submission.result;
      const operation = submission.result;
      const settlement = operation.then(
        () => undefined,
        () => undefined,
      );
      observed.admittedCommands.add(settlement);
      try {
        return await operation;
      } finally {
        await settlement;
        observed.admittedCommands.delete(settlement);
      }
    },
    stop,
  };
}
```

### apps/harness/src/canonical-project-application.ts - NEW
Map protocol requests to coordinator outcomes; command registration belongs to the harness registry composed by bootstrap.

Slice 4 adds the required switch method and validates the full original source/destination correlation. Activation/command mapping, sanitized invalid-result errors, owner exception propagation, and stop delegation remain the locked Slice 3 behavior.

S5 delta (approved): validate successful receipt Project/Command/type/version against the original submitted request as well as flat outer correlation. Never compare receipt generation/time to the current activation: replay preserves the original values.

```ts
import type {
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectCommandRequest,
  CanonicalProjectCommandResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
} from "@slopstop/protocol";
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchResultSchema,
} from "@slopstop/protocol";
import type { ActiveProjectCoordinator } from "./active-project-coordinator.js";

export interface CanonicalProjectApplication {
  activate(request: CanonicalProjectActivationRequest): Promise<CanonicalProjectActivationResult>;
  switchProject(request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult>;
  execute(request: CanonicalProjectCommandRequest): Promise<CanonicalProjectCommandResult>;
  stop(): Promise<void>;
}

export class CanonicalProjectApplicationError extends Error {
  override readonly name = "CanonicalProjectApplicationError";

  constructor() {
    super("Canonical Project application returned an invalid result.");
  }
}

function activationMatches(
  result: CanonicalProjectActivationResult,
  request: CanonicalProjectActivationRequest,
): boolean {
  return result.request.projectId === request.projectId;
}

function commandMatches(
  result: CanonicalProjectCommandResult,
  request: CanonicalProjectCommandRequest,
): boolean {
  return (
    result.projectId === request.projectId &&
    result.activationId === request.activationId &&
    result.commandId === request.command.commandId &&
    (result.status !== "settled" || (
      result.receipt.projectId === request.projectId &&
      result.receipt.commandId === request.command.commandId &&
      result.receipt.commandType === request.command.type &&
      result.receipt.commandVersion === request.command.version
    ))
  );
}

export function createCanonicalProjectApplication(
  coordinator: ActiveProjectCoordinator,
): CanonicalProjectApplication {
  return {
    activate: async (request) => {
      const parsed = CanonicalProjectActivationResultSchema.safeParse(
        await coordinator.activate(request),
      );
      if (!parsed.success || !activationMatches(parsed.data, request)) {
        throw new CanonicalProjectApplicationError();
      }
      return parsed.data;
    },
    switchProject: async (request) => {
      const parsed = CanonicalProjectSwitchResultSchema.safeParse(
        await coordinator.switchProject(request),
      );
      if (
        !parsed.success ||
        parsed.data.request.from.projectId !== request.from.projectId ||
        parsed.data.request.from.activationId !== request.from.activationId ||
        parsed.data.request.to.projectId !== request.to.projectId
      ) {
        throw new CanonicalProjectApplicationError();
      }
      return parsed.data;
    },
    execute: async (request) => {
      const expected = { ...request, command: { ...request.command } };
      const parsed = CanonicalProjectCommandResultSchema.safeParse(
        await coordinator.execute(request),
      );
      if (!parsed.success || !commandMatches(parsed.data, expected)) {
        throw new CanonicalProjectApplicationError();
      }
      return parsed.data;
    },
    stop: () => coordinator.stop(),
  };
}
```

### apps/harness/src/canonical-project-writer.ts - NEW
Retain one lease/fence capability, gate bounded settlements, drain, quarantine, retire, and close.

S5 delta (approved): add synchronous admission with one canonical-text slot, exact joins, no queue, fail-closed settlement errors, and drain-before-close sharing. Keep `verifyFence` as the approved direct diagnostic seam, but execution no longer calls it; settlement verifies authority inside its write transaction. Existing staged release codes/retries remain intact.

```ts
import {
  CanonicalProjectCommandResultSchema,
  type CanonicalProjectCommandResult,
  type ProjectActivationId,
  type ProjectId,
  type TypedCommand,
  type WriterGeneration,
} from "@slopstop/protocol";
import { snapshotCanonicalCommand } from "./canonical-json.js";
import type {
  CanonicalCommandRepository,
  WriterFenceCheck,
} from "./storage/canonical-command-repository.js";
import type {
  CanonicalWriterLease,
  CanonicalWriterLeaseError,
} from "./storage/canonical-writer-lease.js";

type CanonicalProjectWriterFenceStatus =
  | Readonly<{ status: "current" }>
  | Readonly<{ status: "stale" }>
  | Readonly<{ status: "broken"; code: "WRITER_FENCE_CHECK_FAILED" }>;

export type CanonicalProjectWriterReleaseFailureCode =
  | "WRITER_FENCE_STALE"
  | "WRITER_FENCE_RELEASE_FAILED"
  | "WRITER_REPOSITORY_CLOSE_FAILED"
  | CanonicalWriterLeaseError["code"];

class CanonicalProjectWriterReleaseError extends Error {
  override readonly name = "CanonicalProjectWriterReleaseError";

  constructor(
    readonly code: CanonicalProjectWriterReleaseFailureCode,
    options?: ErrorOptions,
  ) {
    super("Canonical Project Writer release failed.", options);
  }
}

export interface CanonicalProjectWriter {
  readonly projectId: ProjectId;
  readonly activationId: ProjectActivationId;
  readonly writerGeneration: WriterGeneration;
  verifyFence(): Promise<CanonicalProjectWriterFenceStatus>;
  settle(command: TypedCommand): CanonicalProjectWriterSubmission;
  close(releasedAt: string): Promise<void>;
}

export type CanonicalProjectWriterSubmission =
  | Readonly<{ status: "completed"; result: CanonicalProjectCommandResult }>
  | Readonly<{ status: "pending"; result: Promise<CanonicalProjectCommandResult> }>;

function leaseFailureCode(error: unknown): CanonicalWriterLeaseError["code"] | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = error.code;
  if (
    code === "WRITER_LEASE_OPEN_FAILED" ||
    code === "WRITER_LEASE_LOCK_FAILED" ||
    code === "WRITER_LEASE_UNLOCK_FAILED" ||
    code === "WRITER_LEASE_CLOSE_FAILED"
  ) {
    return code;
  }
  return undefined;
}

export function createCanonicalProjectWriter(input: {
  projectId: ProjectId;
  activationId: ProjectActivationId;
  writerGeneration: WriterGeneration;
  repository: CanonicalCommandRepository;
  lease: CanonicalWriterLease;
}): CanonicalProjectWriter {
  let releaseStage: "fence" | "repository" | "lease" | "closed" = "fence";
  let admissionClosed = false;
  let failed = false;
  let inFlight: Readonly<{ key: string; result: Promise<CanonicalProjectCommandResult> }> | undefined;
  let closeAttempt: Promise<void> | undefined;

  const failure = (
    commandId: TypedCommand["commandId"],
    status: "command-busy" | "writer-unavailable" | "stale-writer" | "sequence-exhausted",
  ): CanonicalProjectCommandResult => {
    const diagnostics = {
      "command-busy": { code: "COMMAND_IN_PROGRESS", message: "Another command is in progress.", retryable: true },
      "writer-unavailable": { code: "WRITER_UNAVAILABLE", message: "The Writer requires explicit reactivation.", retryable: false },
      "stale-writer": { code: "WRITER_FENCE_STALE", message: "The active Writer fence is stale.", retryable: false },
      "sequence-exhausted": { code: "PROJECT_SEQUENCE_EXHAUSTED", message: "The Project sequence is exhausted.", retryable: false },
    } as const;
    return CanonicalProjectCommandResultSchema.parse({
      status,
      projectId: input.projectId,
      activationId: input.activationId,
      commandId,
      diagnostic: diagnostics[status],
    });
  };

  const settle = (command: TypedCommand): CanonicalProjectWriterSubmission => {
    const commandId = command.commandId;
    if (admissionClosed || failed) {
      return { status: "completed", result: failure(commandId, "writer-unavailable") };
    }
    let key: string;
    try {
      key = snapshotCanonicalCommand(input.projectId, command);
    } catch (error) {
      failed = true;
      throw error;
    }
    if (inFlight !== undefined) {
      return inFlight.key === key
        ? { status: "pending", result: inFlight.result }
        : { status: "completed", result: failure(commandId, "command-busy") };
    }
    // Reserve before the repository can begin, even for a synchronous throw.
    const result = Promise.resolve().then(async (): Promise<CanonicalProjectCommandResult> => {
      const outcome = await input.repository.settle(key);
      if (outcome.status !== "settled") return failure(commandId, outcome.status);
      return CanonicalProjectCommandResultSchema.parse({
        status: "settled",
        projectId: input.projectId,
        activationId: input.activationId,
        commandId,
        receipt: outcome.receipt,
      });
    }).catch((error: unknown) => {
      failed = true;
      throw error;
    });
    const slot = { key, result };
    inFlight = slot;
    const clear = (): void => {
      if (inFlight === slot) inFlight = undefined;
    };
    void result.then(clear, clear);
    return { status: "pending", result };
  };

  const releaseFence = async (releasedAt: string): Promise<void> => {
    if (releaseStage !== "fence") return;
    let fence: WriterFenceCheck;
    try {
      fence = await input.repository.releaseFence(releasedAt);
    } catch (error) {
      throw new CanonicalProjectWriterReleaseError("WRITER_FENCE_RELEASE_FAILED", {
        cause: error,
      });
    }
    if (fence.status === "stale") {
      throw new CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE");
    }
    releaseStage = "repository";
  };

  const closeRepository = async (): Promise<void> => {
    if (releaseStage !== "repository") return;
    try {
      await input.repository.close();
    } catch (error) {
      throw new CanonicalProjectWriterReleaseError("WRITER_REPOSITORY_CLOSE_FAILED", {
        cause: error,
      });
    }
    releaseStage = "lease";
  };

  const releaseLease = async (): Promise<void> => {
    if (releaseStage !== "lease") return;
    try {
      await input.lease.release();
    } catch (error) {
      throw new CanonicalProjectWriterReleaseError(
        leaseFailureCode(error) ?? "WRITER_LEASE_CLOSE_FAILED",
        { cause: error },
      );
    }
    releaseStage = "closed";
  };

  return {
    projectId: input.projectId,
    activationId: input.activationId,
    writerGeneration: input.writerGeneration,
    settle,
    verifyFence: async () => {
      try {
        return await input.repository.verifyFence();
      } catch {
        return { status: "broken", code: "WRITER_FENCE_CHECK_FAILED" };
      }
    },
    close: (releasedAt) => {
      admissionClosed = true;
      if (closeAttempt !== undefined) return closeAttempt;
      const pending = inFlight?.result;
      const attempt = (async () => {
        // This observes completion only; the original rejection still reaches its request.
        if (pending !== undefined) await pending.then(() => undefined, () => undefined);
        if (releaseStage === "closed") return;
        await releaseFence(releasedAt);
        await closeRepository();
        await releaseLease();
      })();
      closeAttempt = attempt;
      void attempt.catch(() => {
        if (closeAttempt === attempt) closeAttempt = undefined;
      });
      return attempt;
    },
  };
}
```

### apps/harness/src/canonical-json.ts - NEW
S5 delta (approved): sole canonical JSON serializer/hash owner for commands, events, and safe rejection details. Object text is emitted directly, so sorted integer-like keys cannot be reordered by object enumeration and `__proto__` is never assigned to an object.

```ts
import { createHash } from "node:crypto";
import {
  CanonicalJsonValueSchema,
  ProjectIdSchema,
  TypedCommandSchema,
  type CanonicalJsonValue,
  type ProjectId,
  type TypedCommand,
} from "@slopstop/protocol";
import { z } from "zod";

export const CanonicalSha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
export const CanonicalStoredIdentitySchema = z.uuid().refine((value) => value === value.toLowerCase());

function renderJson(value: CanonicalJsonValue): string {
  if (value === null || typeof value !== "object") {
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error("Canonical JSON value is invalid.");
    return text;
  }
  if (Array.isArray(value)) return `[${value.map(renderJson).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${renderJson(child)}`).join(",")}}`;
}

export function canonicalJsonText(value: unknown): string {
  return renderJson(CanonicalJsonValueSchema.parse(value));
}

export function parseCanonicalJson(text: string): CanonicalJsonValue {
  const value: unknown = JSON.parse(text);
  return CanonicalJsonValueSchema.parse(value);
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonText(value), "utf8").digest("hex");
}

const commandSnapshotSchema = TypedCommandSchema.extend({
  projectId: ProjectIdSchema,
  fingerprintVersion: z.literal(1),
}).readonly();
export type CanonicalCommandSnapshot = z.infer<typeof commandSnapshotSchema>;

export function snapshotCanonicalCommand(projectId: ProjectId, command: TypedCommand): string {
  return canonicalJsonText(commandSnapshotSchema.parse({ ...command, projectId, fingerprintVersion: 1 }));
}

export function readCanonicalCommandSnapshot(text: string): CanonicalCommandSnapshot {
  const snapshot = commandSnapshotSchema.parse(parseCanonicalJson(text));
  if (canonicalJsonText(snapshot) !== text) throw new Error("Command snapshot is not canonical.");
  return snapshot;
}
```

### apps/harness/src/canonical-command-registry.ts - NEW
S5 delta (approved): exact registration and safe typed closure erasure. No production definition is installed here. Result schemas validate handlers at runtime; SQL lifetime and savepoint ownership remain in the settlement transaction module.

```ts
import { isDomainIdentity } from "@slopstop/kernel";
import {
  CanonicalJsonValueSchema,
  CommandRejectionSchema,
  TypedCommandSchema,
  type CanonicalJsonValue,
  type CommandRejection,
  type ProjectId,
  type TypedCommand,
} from "@slopstop/protocol";
import { z } from "zod";
import { CanonicalStoredIdentitySchema, canonicalJsonText, parseCanonicalJson } from "./canonical-json.js";
import type { LocalLibsqlTransaction } from "./storage/local-libsql-worker-client.js";

export type CanonicalCommandTransaction = Readonly<Pick<LocalLibsqlTransaction, "execute">>;
const positiveVersionSchema = TypedCommandSchema.shape.version;
const nonblankTextSchema = z.string().refine((value) => value.trim().length > 0);
export const CanonicalEventInputSchema = z.strictObject({
  aggregateType: nonblankTextSchema,
  aggregateId: CanonicalStoredIdentitySchema.refine(isDomainIdentity),
  aggregateVersion: positiveVersionSchema,
  eventType: nonblankTextSchema,
  eventVersion: positiveVersionSchema,
  payload: CanonicalJsonValueSchema,
});
export type CanonicalEventInput = z.infer<typeof CanonicalEventInputSchema>;
export const CanonicalCommandDecisionSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("applied"), events: z.array(CanonicalEventInputSchema) }),
  z.strictObject({ outcome: z.literal("unchanged") }),
  z.strictObject({ outcome: z.literal("rejected"), rejection: CommandRejectionSchema }),
]);
export type CanonicalCommandDecision = z.infer<typeof CanonicalCommandDecisionSchema>;

export type PreparedCanonicalCommand =
  | Readonly<{ status: "rejected"; rejection: CommandRejection }>
  | Readonly<{
      status: "ready";
      run(context: Readonly<{ projectId: ProjectId; transaction: CanonicalCommandTransaction }>):
        CanonicalCommandDecision | Promise<CanonicalCommandDecision>;
    }>;

export type RegisteredCanonicalCommand = Readonly<{
  type: string;
  version: number;
  prepare(payload: CanonicalJsonValue): PreparedCanonicalCommand;
}>;

const registrationKeySchema = TypedCommandSchema.pick({ type: true, version: true });

export function defineCanonicalCommand<Payload>(input: Readonly<{
  type: string;
  version: number;
  payloadSchema: z.ZodType<Payload>;
  handle: (context: Readonly<{
    projectId: ProjectId;
    payload: NoInfer<Payload>;
    transaction: CanonicalCommandTransaction;
  }>) => CanonicalCommandDecision | Promise<CanonicalCommandDecision>;
}>): RegisteredCanonicalCommand {
  const { type, version } = registrationKeySchema.parse({ type: input.type, version: input.version });
  if (type !== input.type) throw new Error("Command registration type is not canonical.");
  const { payloadSchema, handle } = input;
  return Object.freeze({
    type,
    version,
    prepare: (payload: CanonicalJsonValue): PreparedCanonicalCommand => {
      const parsed = payloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { status: "rejected", rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false } };
      }
      return { status: "ready", run: (context) => handle({ ...context, payload: parsed.data }) };
    },
  });
}

export interface CanonicalCommandRegistry {
  prepare(command: TypedCommand): PreparedCanonicalCommand;
}

export function createCanonicalCommandRegistry(
  definitions: readonly RegisteredCanonicalCommand[],
): CanonicalCommandRegistry {
  const types = new Map<string, Map<number, RegisteredCanonicalCommand["prepare"]>>();
  for (const definition of definitions) {
    const { type, version } = registrationKeySchema.parse({ type: definition.type, version: definition.version });
    if (type !== definition.type) throw new Error("Command registration type is not canonical.");
    let versions = types.get(type);
    if (versions === undefined) {
      versions = new Map();
      types.set(type, versions);
    }
    if (versions.has(version)) throw new Error("Duplicate canonical command registration.");
    versions.set(version, definition.prepare);
  }
  return Object.freeze({
    prepare: (command: TypedCommand): PreparedCanonicalCommand => {
      const prepare = types.get(command.type)?.get(command.version);
      if (prepare === undefined) {
        return { status: "rejected", rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false } };
      }
      // A schema transform may mutate its input; it never receives the submitted snapshot.
      return prepare(parseCanonicalJson(canonicalJsonText(command.payload)));
    },
  });
}
```

### apps/harness/src/storage/canonical-writer-lease.ts - NEW
Acquire and retain the dedicated one-byte OS lock, distinguishing contention from operational failure.

```ts
import { open, type FileHandle } from "node:fs/promises";
import { tryLock, unlock } from "fs-native-extensions";

export type CanonicalWriterLeaseFailureCode =
  | "WRITER_LEASE_OPEN_FAILED"
  | "WRITER_LEASE_LOCK_FAILED"
  | "WRITER_LEASE_UNLOCK_FAILED"
  | "WRITER_LEASE_CLOSE_FAILED";

const failureMessages = {
  WRITER_LEASE_OPEN_FAILED: "Writer lease file could not be opened.",
  WRITER_LEASE_LOCK_FAILED: "Writer lease could not be acquired.",
  WRITER_LEASE_UNLOCK_FAILED: "Writer lease could not be unlocked.",
  WRITER_LEASE_CLOSE_FAILED: "Writer lease file could not be closed.",
} as const satisfies Readonly<Record<CanonicalWriterLeaseFailureCode, string>>;

export class CanonicalWriterLeaseError extends Error {
  override readonly name = "CanonicalWriterLeaseError";

  constructor(
    readonly code: CanonicalWriterLeaseFailureCode,
    options?: ErrorOptions,
  ) {
    super(failureMessages[code], options);
  }
}

export interface CanonicalWriterLease {
  release(): Promise<void>;
}

export interface CanonicalWriterLeaseCleanup {
  close(): Promise<void>;
}

export type CanonicalWriterLeaseAcquisition =
  | Readonly<{ status: "acquired"; lease: CanonicalWriterLease }>
  | Readonly<{ status: "contended" }>
  | Readonly<{
      status: "broken";
      error: CanonicalWriterLeaseError;
      cleanup?: CanonicalWriterLeaseCleanup;
    }>;

type LeaseFile = Pick<FileHandle, "fd" | "close">;

export type CanonicalWriterLeaseDependencies = Readonly<{
  platform: NodeJS.Platform;
  openLeaseFile(path: string): Promise<LeaseFile>;
  tryLock(fileDescriptor: number, offset: number, length: number): boolean;
  unlock(fileDescriptor: number, offset: number, length: number): void;
}>;

export interface CanonicalWriterLeaseFactory {
  acquire(path: string): Promise<CanonicalWriterLeaseAcquisition>;
}

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  if (!("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isContentionError(error: unknown, platform: NodeJS.Platform): boolean {
  return platform === "win32" && errorCode(error) === "EBUSY";
}

function retainedUnacquiredFile(file: LeaseFile): CanonicalWriterLeaseCleanup {
  let closed = false;
  let closeAttempt: Promise<void> | undefined;
  return {
    close: () => {
      if (closed) return Promise.resolve();
      if (closeAttempt !== undefined) return closeAttempt;
      const attempt = file.close().then(() => {
        closed = true;
      });
      closeAttempt = attempt;
      void attempt.catch(() => {
        if (closeAttempt === attempt) closeAttempt = undefined;
      });
      return attempt;
    },
  };
}

async function closeUnacquired(
  file: LeaseFile,
  priorError?: CanonicalWriterLeaseError,
): Promise<CanonicalWriterLeaseAcquisition> {
  const cleanup = retainedUnacquiredFile(file);
  try {
    await cleanup.close();
  } catch (error) {
    return {
      status: "broken",
      error: new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED", {
        cause:
          priorError === undefined
            ? error
            : new AggregateError([priorError, error], "Writer lease acquisition and close failed."),
      }),
      cleanup,
    };
  }
  return priorError === undefined
    ? { status: "contended" }
    : { status: "broken", error: priorError };
}

function retainedLease(
  file: LeaseFile,
  dependencies: CanonicalWriterLeaseDependencies,
): CanonicalWriterLease {
  let state: "locked" | "unlocked" | "closed" = "locked";
  let releaseAttempt: Promise<void> | undefined;

  const releaseStages = async (): Promise<void> => {
    if (state === "locked") {
      try {
        dependencies.unlock(file.fd, 0, 1);
      } catch (error) {
        throw new CanonicalWriterLeaseError("WRITER_LEASE_UNLOCK_FAILED", { cause: error });
      }
      state = "unlocked";
    }
    try {
      await file.close();
    } catch (error) {
      throw new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED", { cause: error });
    }
    state = "closed";
  };

  return {
    release: () => {
      if (state === "closed") return Promise.resolve();
      if (releaseAttempt !== undefined) return releaseAttempt;
      const attempt = releaseStages();
      releaseAttempt = attempt;
      void attempt.catch(() => {
        if (releaseAttempt === attempt) releaseAttempt = undefined;
      });
      return attempt;
    },
  };
}

export function createCanonicalWriterLeaseFactory(
  dependencies: CanonicalWriterLeaseDependencies,
): CanonicalWriterLeaseFactory {
  return {
    acquire: async (path) => {
      let file: LeaseFile;
      try {
        file = await dependencies.openLeaseFile(path);
      } catch (error) {
        return {
          status: "broken",
          error: new CanonicalWriterLeaseError("WRITER_LEASE_OPEN_FAILED", { cause: error }),
        };
      }

      let granted: boolean;
      try {
        granted = dependencies.tryLock(file.fd, 0, 1);
      } catch (error) {
        if (isContentionError(error, dependencies.platform)) return closeUnacquired(file);
        return closeUnacquired(
          file,
          new CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED", { cause: error }),
        );
      }
      if (!granted) return closeUnacquired(file);
      return { status: "acquired", lease: retainedLease(file, dependencies) };
    },
  };
}

export function createNodeCanonicalWriterLeaseFactory(): CanonicalWriterLeaseFactory {
  return createCanonicalWriterLeaseFactory({
    platform: process.platform,
    openLeaseFile: (path) => open(path, "a+", 0o600),
    tryLock,
    unlock,
  });
}
```

### apps/harness/src/storage/canonical-command-repository.ts - NEW
Activate durable Writer generations and atomically settle fenced Typed commands in short libSQL transactions.

S3 ownership clarification (2026-09-05): before-every-begin foreign-key enablement/verification and busy_timeout=5000 configuration in the rendered wrapper belong to S3 activation and release. The rendered configuration is correct; its prior S5-only attribution was ambiguous. S3 proves settings inside the first activation and second release transactions using the real worker client. S5 still owns additional settlement and unfinished-transaction machinery.

S5 delta (approved): require settlement registry/IDs/clock in the factory, delegate each settlement to the transaction body below, and propagate its unexpected failures unchanged. Share existing row/digest/time/identity validation owners instead of copying them. Preserve S3 connection configuration before every write transaction: pinned local libSQL detaches its connection on `transaction()`, so initial PRAGMAs alone cannot configure later connections. Retain a transaction whose close failed and require a successful explicit close retry before fence release or client close; a rejected settlement promise alone is not proof that the transaction is finished. Existing activation, abandoned-fence handoff, direct verifyFence, release stages, and diagnostics remain the approved baseline. No recovery-record behavior is added.

S6 delta (approved): retain only an uncertain admitted CommandId/fingerprint on settlement failure; journal it on explicit release/close after `finishPendingTransaction`, preserving one successfully prepared record through failures. Reconcile before activation writes, under the same transaction, and resolve the existing row only after inserting its resolver generation. Ordinary fence verification and sanitized lifecycle boundaries stay unchanged. This merged block supersedes only the S5 no-recovery execution assertions enumerated in the S6 migration table; the preceding S5 description is historical.

```ts
import type { ProjectActivationId, ProjectId, WriterGeneration } from "@slopstop/protocol";
import { CanonicalSettlementTimeSchema, WriterGenerationSchema } from "@slopstop/protocol";
import { z } from "zod";
import { CanonicalSha256Schema, CanonicalStoredIdentitySchema, hashCanonicalJson, readCanonicalCommandSnapshot } from "../canonical-json.js";
import { assertRowsAffected, exactlyOne, resultObjects } from "./canonical-command-ledger.js";
import {
  readCanonicalWriterFence,
  settleCanonicalCommand,
  type CanonicalCommandSettlementResult,
  type CanonicalSettlementDependencies,
} from "./canonical-command-settlement.js";
import type {
  LocalLibsqlClient,
  LocalLibsqlTransaction,
} from "./local-libsql-worker-client.js";
import { runClassifiedWriteTransaction, withWriteTransaction } from "./project-storage-transaction.js";
import {
  inspectWriterRecovery,
  persistUncertainWriterRecovery,
  prepareUncertainWriterRecovery,
  recordAbandonedFence,
  resolveWriterRecovery,
  type UncertainCanonicalCommand,
  type UnresolvedWriterRecovery,
} from "./canonical-writer-recovery.js";

export type CanonicalCommandRepositoryFailureCode =
  | "WRITER_FENCE_ACTIVATION_FAILED"
  | "WRITER_FENCE_CHECK_FAILED"
  | "WRITER_FENCE_RELEASE_FAILED"
  | "WRITER_REPOSITORY_CLOSE_FAILED";

const failureMessages = {
  WRITER_FENCE_ACTIVATION_FAILED: "Canonical Writer fence activation failed.",
  WRITER_FENCE_CHECK_FAILED: "Canonical Writer fence verification failed.",
  WRITER_FENCE_RELEASE_FAILED: "Canonical Writer fence release failed.",
  WRITER_REPOSITORY_CLOSE_FAILED: "Canonical Writer repository close failed.",
} as const satisfies Readonly<Record<CanonicalCommandRepositoryFailureCode, string>>;

export class CanonicalCommandRepositoryError extends Error {
  override readonly name = "CanonicalCommandRepositoryError";

  constructor(
    readonly code: CanonicalCommandRepositoryFailureCode,
    options?: ErrorOptions,
  ) {
    super(failureMessages[code], options);
  }
}

const sha256TextSchema = CanonicalSha256Schema;
export const WriterCapabilityTokenSchema = sha256TextSchema.brand<"WriterCapabilityToken">();
export type WriterCapabilityToken = z.infer<typeof WriterCapabilityTokenSchema>;

export type WriterFenceCheck = Readonly<{ status: "current" }> | Readonly<{ status: "stale" }>;

export interface CanonicalCommandRepository {
  readonly projectId: ProjectId;
  readonly writerGeneration: WriterGeneration;
  verifyFence(): Promise<WriterFenceCheck>;
  settle(commandText: string): Promise<CanonicalCommandSettlementResult>;
  releaseFence(releasedAt: string): Promise<WriterFenceCheck>;
  close(): Promise<void>;
}

type CanonicalCommandRepositoryActivation = Readonly<{
  status: "activated";
  repository: CanonicalCommandRepository;
  writerGeneration: WriterGeneration;
}>;

export type CanonicalCommandRepositoryActivationResult =
  | CanonicalCommandRepositoryActivation
  | Readonly<{
      status: "broken";
      error: CanonicalCommandRepositoryError;
      cleanup?: Readonly<{ close(): Promise<void> }>;
    }>;

export type CanonicalCommandRepositoryFactoryDependencies = CanonicalSettlementDependencies & Readonly<{
  openClient(databasePath: string): LocalLibsqlClient;
  sha256Text(value: string): Promise<string>;
  createHandoffId(): string;
  createRecoveryRecordId(): string;
}>;

export interface CanonicalCommandRepositoryFactory {
  activate(input: {
    canonicalDatabasePath: string;
    projectId: ProjectId;
    activationId: ProjectActivationId;
    writerToken: WriterCapabilityToken;
    activatedAt: string;
  }): Promise<CanonicalCommandRepositoryActivationResult>;
}

const priorWriterStateRowSchema = z.strictObject({
  lastWriterGeneration: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  writerGenerationCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  maximumWriterGeneration: WriterGenerationSchema.nullable(),
  fenceWriterGeneration: WriterGenerationSchema.nullable(),
  fenceTokenDigest: z.string().nullable(),
  fenceState: z.enum(["active", "released"]).nullable(),
  fenceReleasedAt: z.string().nullable(),
  generationWriterGeneration: WriterGenerationSchema.nullable(),
  generationTokenDigest: z.string().nullable(),
  generationReleasedAt: z.string().nullable(),
});

const sha256Schema = sha256TextSchema;
const utcInstantSchema = CanonicalSettlementTimeSchema;
const identitySchema = CanonicalStoredIdentitySchema;

type CanonicalRepositoryClient = LocalLibsqlClient & Readonly<{
  finishPendingTransaction(): Promise<void>;
}>;
type OwnedCanonicalTransaction = {
  transaction: LocalLibsqlTransaction;
  closeFailed: boolean;
  closeAttempt: Promise<void> | undefined;
};

function configuredCanonicalClient(client: LocalLibsqlClient): CanonicalRepositoryClient {
  let owned: OwnedCanonicalTransaction | undefined;
  let beginning = false;
  const closeTransaction = (entry: OwnedCanonicalTransaction): Promise<void> => {
    if (entry.closeAttempt !== undefined) return entry.closeAttempt;
    const attempt = Promise.resolve().then(async () => {
      await entry.transaction.close();
      if (!entry.transaction.closed) throw new Error("Canonical transaction did not close.");
      if (owned === entry) owned = undefined;
    });
    entry.closeAttempt = attempt;
    void attempt.catch(() => {
      entry.closeFailed = true;
      if (entry.closeAttempt === attempt) entry.closeAttempt = undefined;
    });
    return attempt;
  };
  const finishPendingTransaction = async (): Promise<void> => {
    if (beginning) throw new Error("Canonical transaction is still beginning.");
    if (owned === undefined) return;
    if (owned.closeAttempt !== undefined) return owned.closeAttempt;
    if (!owned.closeFailed) throw new Error("Canonical transaction is still in flight.");
    await closeTransaction(owned);
  };
  return {
    execute: (statement, args) => client.execute(statement, args),
    transaction: async (mode): Promise<LocalLibsqlTransaction> => {
      if (beginning || owned !== undefined) throw new Error("Canonical transaction ownership is unfinished.");
      beginning = true;
      try {
        await client.execute("PRAGMA foreign_keys = ON");
        await client.execute("PRAGMA busy_timeout = 5000");
        const rows = z.strictObject({ foreign_keys: z.literal(1) }).array()
          .parse(resultObjects(await client.execute("PRAGMA foreign_keys")));
        exactlyOne(rows, "Canonical foreign-key enforcement is unavailable.");
        const transaction = await client.transaction(mode);
        const entry: OwnedCanonicalTransaction = { transaction, closeFailed: false, closeAttempt: undefined };
        owned = entry;
        return {
          get closed() { return transaction.closed; },
          execute: (statement, args) => transaction.execute(statement, args),
          commit: () => transaction.commit(),
          rollback: () => transaction.rollback(),
          close: () => closeTransaction(entry),
        };
      } finally {
        beginning = false;
      }
    },
    finishPendingTransaction,
    close: async () => {
      await finishPendingTransaction();
      await client.close();
    },
  };
}

type PriorWriterFence = Readonly<{
  writerGeneration: WriterGeneration;
  state: "active" | "released";
  tokenDigest: string;
  releasedAt: string | null;
}>;

function sameUtcInstant(left: string, right: string): boolean {
  const parts = (value: string) => {
    const [seconds, fraction = ""] = utcInstantSchema.parse(value).slice(0, -1).split(".");
    return [seconds, fraction.replace(/0+$/u, "")] as const;
  };
  const [leftSeconds, leftFraction] = parts(left);
  const [rightSeconds, rightFraction] = parts(right);
  return leftSeconds === rightSeconds && leftFraction === rightFraction;
}

function releasesAreValid(row: z.infer<typeof priorWriterStateRowSchema>): boolean {
  if (row.fenceState === "active") {
    return row.fenceReleasedAt === null && row.generationReleasedAt === null;
  }
  if (
    row.fenceState !== "released" ||
    row.fenceReleasedAt === null ||
    row.generationReleasedAt === null
  ) {
    return false;
  }
  const fenceReleasedAt = utcInstantSchema.parse(row.fenceReleasedAt);
  const generationReleasedAt = utcInstantSchema.parse(row.generationReleasedAt);
  return sameUtcInstant(fenceReleasedAt, generationReleasedAt);
}

async function readPriorWriterFence(
  transaction: LocalLibsqlTransaction,
  projectId: ProjectId,
): Promise<PriorWriterFence | undefined> {
  const result = await transaction.execute({
    sql: `SELECT
      project_state.last_writer_generation AS lastWriterGeneration,
      writer_generation_summary.writerGenerationCount AS writerGenerationCount,
      writer_generation_summary.maximumWriterGeneration AS maximumWriterGeneration,
      writer_fence.writer_generation AS fenceWriterGeneration,
      writer_fence.token_digest AS fenceTokenDigest,
      writer_fence.state AS fenceState,
      writer_fence.released_at AS fenceReleasedAt,
      writer_generations.writer_generation AS generationWriterGeneration,
      writer_generations.token_digest AS generationTokenDigest,
      writer_generations.released_at AS generationReleasedAt
    FROM project_state
    CROSS JOIN (
      SELECT
        COUNT(*) AS writerGenerationCount,
        MAX(writer_generation) AS maximumWriterGeneration
      FROM writer_generations
      WHERE project_id = ?
    ) AS writer_generation_summary
    LEFT JOIN writer_fence
      ON writer_fence.project_id = project_state.project_id
    LEFT JOIN writer_generations
      ON writer_generations.project_id = project_state.project_id
      AND writer_generations.writer_generation = project_state.last_writer_generation
    WHERE project_state.project_id = ?`,
    args: [projectId, projectId],
  });
  const row = exactlyOne(
    priorWriterStateRowSchema.array().parse(resultObjects(result)),
    "Canonical Project Writer state must contain exactly one row.",
  );
  const fence = await readCanonicalWriterFence({ transaction, projectId });
  if (row.lastWriterGeneration === 0) {
    const hasPriorWriterState = [
      row.writerGenerationCount === 0 ? null : row.writerGenerationCount,
      row.maximumWriterGeneration,
      row.fenceWriterGeneration,
      row.fenceTokenDigest,
      row.fenceState,
      row.fenceReleasedAt,
      row.generationWriterGeneration,
      row.generationTokenDigest,
      row.generationReleasedAt,
    ].some((value) => value !== null);
    if (hasPriorWriterState || fence !== undefined) {
      throw new Error("Initial Canonical Project Writer state is inconsistent.");
    }
    return undefined;
  }

  const writerGeneration = WriterGenerationSchema.parse(row.lastWriterGeneration);
  const fenceTokenDigest = sha256Schema.parse(row.fenceTokenDigest);
  const generationTokenDigest = sha256Schema.parse(row.generationTokenDigest);
  if (
    fence === undefined ||
    fence.writerGeneration !== writerGeneration ||
    fence.tokenDigest !== fenceTokenDigest ||
    fence.state !== row.fenceState ||
    fence.releasedAt !== row.fenceReleasedAt ||
    row.writerGenerationCount !== writerGeneration ||
    row.maximumWriterGeneration !== writerGeneration ||
    row.fenceWriterGeneration !== writerGeneration ||
    row.generationWriterGeneration !== writerGeneration ||
    fenceTokenDigest !== generationTokenDigest ||
    row.fenceState === null ||
    !releasesAreValid(row)
  ) {
    throw new Error("Prior Canonical Project Writer state is inconsistent.");
  }
  return { writerGeneration, state: row.fenceState, tokenDigest: fenceTokenDigest, releasedAt: row.fenceReleasedAt };
}

async function insertHandoff(input: {
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  fromWriterGeneration: WriterGeneration | null;
  toWriterGeneration: WriterGeneration;
  kind: "initial" | "clean" | "recovery";
  recordedAt: string;
  createHandoffId(): string;
}): Promise<void> {
  const result = await input.transaction.execute({
    sql: `INSERT INTO writer_handoffs
      (project_id, handoff_id, from_writer_generation, to_writer_generation, kind, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      input.projectId,
      identitySchema.parse(input.createHandoffId()),
      input.fromWriterGeneration,
      input.toWriterGeneration,
      input.kind,
      input.recordedAt,
    ],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Writer handoff was not inserted once.");
}

async function releaseAbandonedGeneration(input: {
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  abandonedGeneration: WriterGeneration;
  tokenDigest: string;
  releasedAt: string;
}): Promise<void> {
  const result = await input.transaction.execute({
    sql: `UPDATE writer_generations SET released_at = ?
      WHERE project_id = ? AND writer_generation = ? AND token_digest = ? AND released_at IS NULL`,
    args: [input.releasedAt, input.projectId, input.abandonedGeneration, input.tokenDigest],
  });
  assertRowsAffected(
    result.rowsAffected,
    "Abandoned Canonical Writer generation was not released once.",
  );
}

async function insertWriterGeneration(input: {
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  writerGeneration: WriterGeneration;
  activationId: ProjectActivationId;
  tokenDigest: string;
  activatedAt: string;
}): Promise<void> {
  const result = await input.transaction.execute({
    sql: `INSERT INTO writer_generations
      (project_id, writer_generation, activation_id, token_digest, acquired_at, released_at)
      VALUES (?, ?, ?, ?, ?, NULL)`,
    args: [
      input.projectId,
      input.writerGeneration,
      input.activationId,
      input.tokenDigest,
      input.activatedAt,
    ],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Writer generation was not inserted once.");
}

function handoffKind(previousFence: PriorWriterFence | undefined): "initial" | "clean" | "recovery" {
  if (previousFence === undefined) return "initial";
  return previousFence.state === "active" ? "recovery" : "clean";
}

async function activateFence(input: {
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  activationId: ProjectActivationId;
  tokenDigest: string;
  activatedAt: string;
  createHandoffId(): string;
  createRecoveryRecordId(): string;
}): Promise<WriterGeneration> {
  const previousFence = await readPriorWriterFence(input.transaction, input.projectId);
  const lastWriterGeneration = previousFence?.writerGeneration ?? 0;
  const recovery = await inspectWriterRecovery({
    transaction: input.transaction, projectId: input.projectId, lastWriterGeneration,
  });
  const writerGeneration = WriterGenerationSchema.parse(lastWriterGeneration + 1);
  const stateUpdate = await input.transaction.execute({
    sql: `UPDATE project_state
      SET last_writer_generation = ?, updated_at = ?
      WHERE project_id = ? AND last_writer_generation = ?`,
    args: [writerGeneration, input.activatedAt, input.projectId, lastWriterGeneration],
  });
  assertRowsAffected(
    stateUpdate.rowsAffected,
    "Canonical Writer generation was not advanced once.",
  );
  await insertWriterGeneration({
    transaction: input.transaction,
    projectId: input.projectId,
    writerGeneration,
    activationId: input.activationId,
    tokenDigest: input.tokenDigest,
    activatedAt: input.activatedAt,
  });
  if (previousFence?.state === "active") {
    await releaseAbandonedGeneration({
      transaction: input.transaction,
      projectId: input.projectId,
      abandonedGeneration: previousFence.writerGeneration,
      tokenDigest: previousFence.tokenDigest,
      releasedAt: input.activatedAt,
    });
  }
  if (recovery !== undefined) {
    await resolveWriterRecovery({
      transaction: input.transaction, recovery,
      resolvingGeneration: writerGeneration, resolvedAt: input.activatedAt,
    });
  } else if (previousFence?.state === "active") {
    await recordAbandonedFence({
      transaction: input.transaction,
      projectId: input.projectId,
      abandonedGeneration: previousFence.writerGeneration,
      resolvingGeneration: writerGeneration,
      observedAt: input.activatedAt,
      createRecoveryRecordId: input.createRecoveryRecordId,
    });
  }
  await insertHandoff({
    transaction: input.transaction,
    projectId: input.projectId,
    fromWriterGeneration: previousFence?.writerGeneration ?? null,
    toWriterGeneration: writerGeneration,
    kind: recovery === undefined ? handoffKind(previousFence) : "recovery",
    recordedAt: input.activatedAt,
    createHandoffId: input.createHandoffId,
  });
  const fence = previousFence === undefined
    ? await input.transaction.execute({
        sql: `INSERT INTO writer_fence
          (project_id, writer_generation, token_digest, state, activated_at, released_at)
          VALUES (?, ?, ?, 'active', ?, NULL)`,
        args: [input.projectId, writerGeneration, input.tokenDigest, input.activatedAt],
      })
    : await input.transaction.execute({
        sql: `UPDATE writer_fence SET writer_generation = ?, token_digest = ?,
          state = 'active', activated_at = ?, released_at = NULL
          WHERE project_id = ? AND writer_generation = ? AND token_digest = ?
            AND state = ? AND released_at IS ?`,
        args: [writerGeneration, input.tokenDigest, input.activatedAt, input.projectId,
          previousFence.writerGeneration, previousFence.tokenDigest,
          previousFence.state, previousFence.releasedAt],
      });
  assertRowsAffected(fence.rowsAffected, "Canonical Writer fence was not activated once.");
  return writerGeneration;
}

type RetainedWriterUncertainty =
  | Readonly<{ status: "unprepared"; command: UncertainCanonicalCommand }>
  | Readonly<{ status: "prepared"; record: UnresolvedWriterRecovery }>
  | Readonly<{ status: "recorded"; record: UnresolvedWriterRecovery }>;

class LocalCanonicalCommandRepository implements CanonicalCommandRepository {
  private uncertainty: RetainedWriterUncertainty | undefined;

  constructor(
    readonly projectId: ProjectId,
    readonly writerGeneration: WriterGeneration,
    private readonly writerToken: WriterCapabilityToken,
    private readonly client: CanonicalRepositoryClient,
    private readonly sha256Text: (value: string) => Promise<string>,
    private readonly settlement: CanonicalSettlementDependencies & Readonly<{ createRecoveryRecordId(): string }>,
  ) {}

  async settle(commandText: string): Promise<CanonicalCommandSettlementResult> {
    if (this.uncertainty !== undefined) throw new Error("Canonical Writer requires uncertainty recovery.");
    const command = readCanonicalCommandSnapshot(commandText);
    if (command.projectId !== this.projectId) throw new Error("Settlement Project does not match its repository.");
    const tokenDigest = sha256Schema.parse(await this.sha256Text(this.writerToken));
    const fingerprint = hashCanonicalJson(command);
    if (this.uncertainty !== undefined) throw new Error("Canonical Writer requires uncertainty recovery.");
    const outcome = await runClassifiedWriteTransaction(this.client, (transaction) => settleCanonicalCommand({
      transaction,
      projectId: this.projectId,
      writerGeneration: this.writerGeneration,
      tokenDigest,
      command,
      fingerprint,
      dependencies: this.settlement,
    }));
    if (outcome.status === "failed") {
      if (outcome.commit === "uncertain") {
        this.uncertainty = {
          status: "unprepared",
          command: Object.freeze({ commandId: command.commandId, commandFingerprint: fingerprint }),
        };
      }
      throw outcome.error;
    }
    return outcome.result;
  }

  private async recordUncertainty(tokenDigest: string): Promise<boolean> {
    const retained = this.uncertainty;
    if (retained === undefined || retained.status === "recorded") return true;
    const record = retained.status === "prepared" ? retained.record : prepareUncertainWriterRecovery({
      projectId: this.projectId,
      writerGeneration: this.writerGeneration,
      command: retained.command,
      createRecoveryRecordId: this.settlement.createRecoveryRecordId,
      now: this.settlement.now,
    });
    this.uncertainty = { status: "prepared", record };
    const recorded = await withWriteTransaction(this.client, (transaction) =>
      persistUncertainWriterRecovery({ transaction, record, tokenDigest }));
    if (recorded) this.uncertainty = { status: "recorded", record };
    return recorded;
  }

  async verifyFence(): Promise<WriterFenceCheck> {
    try {
      const tokenDigest = sha256Schema.parse(await this.sha256Text(this.writerToken));
      const result = await this.client.execute({
        sql: `SELECT COUNT(*) AS fenceCount
          FROM writer_fence
          INNER JOIN writer_generations
            ON writer_generations.project_id = writer_fence.project_id
            AND writer_generations.writer_generation = writer_fence.writer_generation
            AND writer_generations.token_digest = writer_fence.token_digest
          WHERE writer_fence.project_id = ? AND writer_fence.writer_generation = ?
            AND writer_fence.token_digest = ? AND writer_fence.state = 'active'
            AND writer_fence.released_at IS NULL
            AND writer_generations.released_at IS NULL`,
        args: [this.projectId, this.writerGeneration, tokenDigest],
      });
      const rows = z
        .strictObject({ fenceCount: z.number().int().nonnegative() })
        .array()
        .parse(resultObjects(result));
      const { fenceCount } = exactlyOne(rows, "Canonical Writer fence count is invalid.");
      if (fenceCount > 1) {
        throw new Error("Canonical Writer fence count is invalid.");
      }
      return fenceCount === 1 ? { status: "current" } : { status: "stale" };
    } catch (error) {
      throw new CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED", { cause: error });
    }
  }

  async releaseFence(releasedAt: string): Promise<WriterFenceCheck> {
    try {
      await this.client.finishPendingTransaction();
      const validatedReleasedAt = utcInstantSchema.parse(releasedAt);
      const tokenDigest = sha256Schema.parse(await this.sha256Text(this.writerToken));
      if (!await this.recordUncertainty(tokenDigest)) return { status: "stale" };
      return await withWriteTransaction(this.client, async (transaction) => {
        const fence = await transaction.execute({
          sql: `UPDATE writer_fence SET state = 'released', released_at = ?
            WHERE project_id = ? AND writer_generation = ?
              AND token_digest = ? AND state = 'active' AND released_at IS NULL`,
          args: [validatedReleasedAt, this.projectId, this.writerGeneration, tokenDigest],
        });
        if (fence.rowsAffected === 0) return { status: "stale" };
        assertRowsAffected(fence.rowsAffected, "Canonical Writer fence was not released once.");
        const generation = await transaction.execute({
          sql: `UPDATE writer_generations SET released_at = ?
            WHERE project_id = ? AND writer_generation = ?
              AND token_digest = ? AND released_at IS NULL`,
          args: [validatedReleasedAt, this.projectId, this.writerGeneration, tokenDigest],
        });
        assertRowsAffected(
          generation.rowsAffected,
          "Canonical Writer generation was not released once.",
        );
        return { status: "current" };
      });
    } catch (error) {
      throw new CanonicalCommandRepositoryError("WRITER_FENCE_RELEASE_FAILED", { cause: error });
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.finishPendingTransaction();
      if (this.uncertainty !== undefined && this.uncertainty.status !== "recorded") {
        const tokenDigest = sha256Schema.parse(await this.sha256Text(this.writerToken));
        if (!await this.recordUncertainty(tokenDigest)) {
          throw new Error("Canonical Writer uncertainty cannot be recorded under stale authority.");
        }
      }
      await this.client.close();
    } catch (error) {
      throw new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED", { cause: error });
    }
  }
}

export function createCanonicalCommandRepositoryFactory(
  dependencies: CanonicalCommandRepositoryFactoryDependencies,
): CanonicalCommandRepositoryFactory {
  return {
    activate: async (input) => {
      let client: CanonicalRepositoryClient | undefined;
      try {
        client = configuredCanonicalClient(dependencies.openClient(input.canonicalDatabasePath));
        const tokenDigest = sha256Schema.parse(await dependencies.sha256Text(input.writerToken));
        const activatedAt = utcInstantSchema.parse(input.activatedAt);
        const writerGeneration = await withWriteTransaction(client, (transaction) =>
          activateFence({
            transaction,
            projectId: input.projectId,
            activationId: input.activationId,
            tokenDigest,
            activatedAt,
            createHandoffId: dependencies.createHandoffId,
            createRecoveryRecordId: dependencies.createRecoveryRecordId,
          }),
        );
        return {
          status: "activated",
          writerGeneration,
          repository: new LocalCanonicalCommandRepository(
            input.projectId,
            writerGeneration,
            input.writerToken,
            client,
            dependencies.sha256Text,
            dependencies,
          ),
        };
      } catch (error) {
        let cause = error;
        let cleanup: Readonly<{ close(): Promise<void> }> | undefined;
        if (client !== undefined) {
          try {
            await client.close();
          } catch (closeError) {
            cause = new AggregateError(
              [error, closeError],
              "Canonical Writer activation and repository close failed.",
            );
            const unclosedClient = client;
            cleanup = { close: () => unclosedClient.close() };
          }
        }
        return {
          status: "broken",
          error: new CanonicalCommandRepositoryError(
            cleanup === undefined
              ? "WRITER_FENCE_ACTIVATION_FAILED"
              : "WRITER_REPOSITORY_CLOSE_FAILED",
            { cause },
          ),
          ...(cleanup === undefined ? {} : { cleanup }),
        };
      }
    },
  };
}
```

### apps/harness/src/storage/canonical-command-ledger.ts - NEW
S5 delta (approved): read and validate original/requested settlement authority, then write exact generation-2 receipt, original pointer, rejection, and ordered event rows. All SQL explicitly selects the locked columns. The row helpers moved from the projected repository preserve prior behavior and additionally reject duplicate aliases and row-width drift; they are not a second JSON serializer.

S6 delta (approved): extract the checked CommandId/fingerprint lookup core without weakening original/requested receipt validation. Ordinary settlement additionally compares submitted type/version in its existing wrapper. Recovery supplies only stored CommandId/fingerprint and a prior-generation LedgerContext; it cannot reconstruct a command payload. The extraction is pre/post Green characterization, not new Red.

```ts
import {
  CanonicalCommandReceiptSchema,
  CanonicalEventIdSchema,
  CanonicalEventOrdinalSchema,
  CanonicalSettlementTimeSchema,
  CommandIdSchema,
  CommandReceiptIdSchema,
  CommandReceiptMetadataSchema,
  CommandRejectionCodeSchema,
  ProjectIdSchema,
  ProjectSequenceSchema,
  WriterGenerationSchema,
  type CanonicalCommandReceipt,
  type CommandId,
  type CommandReceiptId,
  type ProjectId,
  type WriterGeneration,
} from "@slopstop/protocol";
import { z } from "zod";
import { CanonicalEventInputSchema, type CanonicalCommandDecision } from "../canonical-command-registry.js";
import {
  CanonicalSha256Schema,
  canonicalJsonText,
  hashCanonicalJson,
  parseCanonicalJson,
  type CanonicalCommandSnapshot,
} from "../canonical-json.js";
import type { LocalLibsqlResultSet, LocalLibsqlTransaction } from "./local-libsql-worker-client.js";

export function resultObjects(result: LocalLibsqlResultSet): unknown[] {
  if (new Set(result.columns).size !== result.columns.length) throw new Error("Canonical SQL aliases are not unique.");
  return result.rows.map((row) => {
    if (row.length !== result.columns.length) throw new Error("Canonical SQL row width is invalid.");
    return Object.fromEntries(result.columns.map((column, index) => [column, row[index]]));
  });
}

export function exactlyOne<Output>(rows: readonly Output[], message: string): Output {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) throw new Error(message);
  return row;
}

export function assertRowsAffected(rowsAffected: number, message: string): void {
  if (rowsAffected !== 1) throw new Error(message);
}

const receiptRowSchema = CommandReceiptMetadataSchema.extend({
  commandFingerprint: CanonicalSha256Schema,
  outcome: z.enum(["applied", "unchanged", "rejected"]),
  authorityProjectId: ProjectIdSchema.nullable(),
  authorityWriterGeneration: WriterGenerationSchema.nullable(),
});
const pointerSchema = z.strictObject({
  projectId: ProjectIdSchema,
  commandId: CommandIdSchema,
  originalCommandFingerprint: CanonicalSha256Schema,
  originalReceiptId: CommandReceiptIdSchema,
  createdAt: CanonicalSettlementTimeSchema,
});
const rejectionRowSchema = z.strictObject({
  projectId: ProjectIdSchema,
  receiptId: CommandReceiptIdSchema,
  receiptOutcome: z.literal("rejected"),
  projectSequence: ProjectSequenceSchema,
  rejectionCode: CommandRejectionCodeSchema,
  retryable: z.union([z.literal(0), z.literal(1)]),
  detailsJson: z.string(),
  detailsHash: CanonicalSha256Schema,
});
const eventRowSchema = CanonicalEventInputSchema.omit({ payload: true }).extend({
  projectId: ProjectIdSchema,
  eventId: CanonicalEventIdSchema,
  receiptId: CommandReceiptIdSchema,
  receiptOutcome: z.literal("applied"),
  projectSequence: ProjectSequenceSchema,
  eventOrdinal: CanonicalEventOrdinalSchema,
  payloadJson: z.string(),
  payloadHash: CanonicalSha256Schema,
  occurredAt: CanonicalSettlementTimeSchema,
});
const rejectionDetailsSchema = z.strictObject({ version: z.literal(1) });

function verifyJson(text: string, digest: string): unknown {
  const value = parseCanonicalJson(text);
  if (canonicalJsonText(value) !== text || hashCanonicalJson(value) !== digest) {
    throw new Error("Canonical settlement JSON integrity failed.");
  }
  return value;
}

type LedgerContext = Readonly<{
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  writerGeneration: WriterGeneration;
  lastProjectSequence: number;
}>;

async function readReceipt(
  context: LedgerContext,
  receiptId: CommandReceiptId,
): Promise<Readonly<{ receipt: CanonicalCommandReceipt; fingerprint: string }>> {
  const result = await context.transaction.execute({
    sql: `SELECT r.project_id AS projectId, r.receipt_id AS receiptId,
      r.command_id AS commandId, r.command_type AS commandType,
      r.command_version AS commandVersion, r.command_fingerprint AS commandFingerprint,
      r.outcome AS outcome, r.project_sequence AS projectSequence,
      r.writer_generation AS writerGeneration, r.settled_at AS settledAt,
      g.project_id AS authorityProjectId, g.writer_generation AS authorityWriterGeneration
      FROM command_receipts AS r LEFT JOIN writer_generations AS g
        ON g.project_id = r.project_id AND g.writer_generation = r.writer_generation
      WHERE r.project_id = ? AND r.receipt_id = ?`,
    args: [context.projectId, receiptId],
  });
  const row = exactlyOne(receiptRowSchema.array().parse(resultObjects(result)), "Canonical receipt is missing or duplicated.");
  if (row.projectId !== context.projectId || row.receiptId !== receiptId ||
      row.authorityProjectId !== row.projectId || row.authorityWriterGeneration !== row.writerGeneration ||
      row.writerGeneration > context.writerGeneration || row.projectSequence > context.lastProjectSequence) {
    throw new Error("Canonical receipt authority is inconsistent.");
  }
  const rejections = rejectionRowSchema.array().parse(resultObjects(await context.transaction.execute({
    sql: `SELECT project_id AS projectId, receipt_id AS receiptId,
      receipt_outcome AS receiptOutcome, project_sequence AS projectSequence,
      rejection_code AS rejectionCode, retryable, details_json AS detailsJson, details_hash AS detailsHash
      FROM command_rejections WHERE project_id = ? AND receipt_id = ?`,
    args: [context.projectId, receiptId],
  })));
  const events = eventRowSchema.array().parse(resultObjects(await context.transaction.execute({
    sql: `SELECT project_id AS projectId, event_id AS eventId, receipt_id AS receiptId,
      receipt_outcome AS receiptOutcome, project_sequence AS projectSequence, event_ordinal AS eventOrdinal,
      aggregate_type AS aggregateType, aggregate_id AS aggregateId, aggregate_version AS aggregateVersion,
      event_type AS eventType, event_version AS eventVersion, payload_json AS payloadJson,
      payload_hash AS payloadHash, occurred_at AS occurredAt
      FROM canonical_events WHERE project_id = ? AND receipt_id = ? ORDER BY event_ordinal`,
    args: [context.projectId, receiptId],
  })));
  for (const [index, event] of events.entries()) {
    if (event.projectId !== row.projectId || event.receiptId !== receiptId ||
        event.projectSequence !== row.projectSequence || event.eventOrdinal !== index ||
        event.occurredAt !== row.settledAt) throw new Error("Canonical event binding is inconsistent.");
    verifyJson(event.payloadJson, event.payloadHash);
  }
  if ((row.outcome !== "applied" && events.length !== 0) ||
      (row.outcome !== "rejected" && rejections.length !== 0)) {
    throw new Error("Canonical receipt children contradict its outcome.");
  }
  const metadata = CommandReceiptMetadataSchema.parse({
    projectId: row.projectId, receiptId: row.receiptId, commandId: row.commandId,
    commandType: row.commandType, commandVersion: row.commandVersion,
    projectSequence: row.projectSequence, writerGeneration: row.writerGeneration, settledAt: row.settledAt,
  });
  const references = events.map((event) => ({ eventId: event.eventId, eventOrdinal: event.eventOrdinal }));
  if (row.outcome === "rejected") {
    const rejection = exactlyOne(rejections, "Canonical rejection is missing or duplicated.");
    if (rejection.projectId !== row.projectId || rejection.receiptId !== receiptId ||
        rejection.projectSequence !== row.projectSequence) throw new Error("Canonical rejection binding is inconsistent.");
    rejectionDetailsSchema.parse(verifyJson(rejection.detailsJson, rejection.detailsHash));
    return {
      fingerprint: row.commandFingerprint,
      receipt: CanonicalCommandReceiptSchema.parse({
        ...metadata, outcome: "rejected", events: [],
        rejection: { code: rejection.rejectionCode, retryable: rejection.retryable === 1 },
      }),
    };
  }
  return {
    fingerprint: row.commandFingerprint,
    receipt: CanonicalCommandReceiptSchema.parse({ ...metadata, outcome: row.outcome, events: references }),
  };
}

export type CanonicalSettlementLookup =
  | Readonly<{ status: "new" }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "replay"; receipt: CanonicalCommandReceipt }>;

export async function lookupCanonicalSettlement(
  context: LedgerContext,
  command: CanonicalCommandSnapshot,
  fingerprint: string,
): Promise<CanonicalSettlementLookup> {
  const result = await lookupCanonicalSettlementByFingerprint(context, command.commandId, fingerprint);
  if (result.status === "replay" &&
      (result.receipt.commandType !== command.type || result.receipt.commandVersion !== command.version)) {
    throw new Error("Canonical requested receipt does not match the submitted command.");
  }
  return result;
}

export async function lookupCanonicalSettlementByFingerprint(
  context: LedgerContext,
  commandId: CommandId,
  fingerprint: string,
): Promise<CanonicalSettlementLookup> {
  CommandIdSchema.parse(commandId);
  CanonicalSha256Schema.parse(fingerprint);
  const pointers = pointerSchema.array().parse(resultObjects(await context.transaction.execute({
    sql: `SELECT project_id AS projectId, command_id AS commandId,
      original_command_fingerprint AS originalCommandFingerprint,
      original_receipt_id AS originalReceiptId, created_at AS createdAt
      FROM command_idempotency WHERE project_id = ? AND command_id = ?`,
    args: [context.projectId, commandId],
  })));
  if (pointers.length === 0) {
    const { receiptCount } = exactlyOne(z.strictObject({
      receiptCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }).array().parse(resultObjects(await context.transaction.execute({
      sql: "SELECT COUNT(*) AS receiptCount FROM command_receipts WHERE project_id = ? AND command_id = ?",
      args: [context.projectId, commandId],
    }))), "Canonical receipt count is invalid.");
    if (receiptCount !== 0) throw new Error("Canonical receipts have no original idempotency pointer.");
    return { status: "new" };
  }
  const pointer = exactlyOne(pointers, "Canonical original pointer is duplicated.");
  if (pointer.projectId !== context.projectId || pointer.commandId !== commandId) {
    throw new Error("Canonical original pointer identity is inconsistent.");
  }
  const original = await readReceipt(context, pointer.originalReceiptId);
  if (original.receipt.commandId !== commandId || original.fingerprint !== pointer.originalCommandFingerprint ||
      original.receipt.settledAt !== pointer.createdAt ||
      (original.receipt.outcome === "rejected" && original.receipt.rejection.code === "IDEMPOTENCY_CONFLICT")) {
    throw new Error("Canonical original receipt binding is inconsistent.");
  }
  const matches = z.strictObject({ receiptId: CommandReceiptIdSchema }).array().parse(resultObjects(
    await context.transaction.execute({
      sql: "SELECT receipt_id AS receiptId FROM command_receipts WHERE project_id = ? AND command_id = ? AND command_fingerprint = ?",
      args: [context.projectId, commandId, fingerprint],
    }),
  ));
  if (matches.length === 0 && fingerprint !== pointer.originalCommandFingerprint) return { status: "conflict" };
  const match = exactlyOne(matches, "Canonical requested fingerprint receipt is missing or duplicated.");
  let requested = original;
  if (fingerprint === pointer.originalCommandFingerprint) {
    if (match.receiptId !== original.receipt.receiptId) throw new Error("Canonical original fingerprint points to another receipt.");
  } else {
    requested = await readReceipt(context, match.receiptId);
    if (requested.receipt.outcome !== "rejected" || requested.receipt.rejection.code !== "IDEMPOTENCY_CONFLICT" ||
        requested.receipt.rejection.retryable || requested.receipt.receiptId === original.receipt.receiptId ||
        requested.receipt.projectSequence <= original.receipt.projectSequence ||
        requested.receipt.writerGeneration < original.receipt.writerGeneration) {
      throw new Error("Canonical conflicting receipt binding is inconsistent.");
    }
  }
  if (requested.fingerprint !== fingerprint || requested.receipt.commandId !== commandId) {
    throw new Error("Canonical requested receipt does not match the submitted command.");
  }
  return { status: "replay", receipt: requested.receipt };
}

export async function persistCanonicalSettlement(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  command: CanonicalCommandSnapshot;
  fingerprint: string;
  lastProjectSequence: number;
  writerGeneration: WriterGeneration;
  decision: CanonicalCommandDecision;
  original: boolean;
  createReceiptId(): string;
  createEventId(): string;
  now(): string;
}>): Promise<CanonicalCommandReceipt> {
  const { transaction, command, decision } = input;
  const projectSequence = ProjectSequenceSchema.parse(input.lastProjectSequence + 1);
  const settledAt = CanonicalSettlementTimeSchema.parse(input.now());
  const receiptId = CommandReceiptIdSchema.parse(input.createReceiptId());
  const events = decision.outcome === "applied" ? decision.events.map((event, index) => ({
    ...event,
    eventId: CanonicalEventIdSchema.parse(input.createEventId()),
    eventOrdinal: CanonicalEventOrdinalSchema.parse(index),
    payloadJson: canonicalJsonText(event.payload),
    payloadHash: hashCanonicalJson(event.payload),
  })) : [];
  const receipt = CanonicalCommandReceiptSchema.parse({
    projectId: command.projectId, receiptId, commandId: command.commandId,
    commandType: command.type, commandVersion: command.version, projectSequence,
    writerGeneration: input.writerGeneration, settledAt, outcome: decision.outcome,
    events: events.map((event) => ({ eventId: event.eventId, eventOrdinal: event.eventOrdinal })),
    ...(decision.outcome === "rejected" ? { rejection: decision.rejection } : {}),
  });
  const state = await transaction.execute({
    sql: `UPDATE project_state SET last_project_sequence = ?, updated_at = ?
      WHERE project_id = ? AND last_project_sequence = ? AND last_writer_generation = ?`,
    args: [projectSequence, settledAt, command.projectId, input.lastProjectSequence, input.writerGeneration],
  });
  assertRowsAffected(state.rowsAffected, "Canonical Project sequence was not advanced once.");
  const inserted = await transaction.execute({
    sql: `INSERT INTO command_receipts (project_id, receipt_id, command_id, command_type,
      command_version, command_fingerprint, outcome, project_sequence, writer_generation, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [command.projectId, receiptId, command.commandId, command.type, command.version,
      input.fingerprint, decision.outcome, projectSequence, input.writerGeneration, settledAt],
  });
  assertRowsAffected(inserted.rowsAffected, "Canonical receipt was not inserted once.");
  if (input.original) {
    const pointer = await transaction.execute({
      sql: `INSERT INTO command_idempotency (project_id, command_id, original_command_fingerprint,
        original_receipt_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [command.projectId, command.commandId, input.fingerprint, receiptId, settledAt],
    });
    assertRowsAffected(pointer.rowsAffected, "Canonical original pointer was not inserted once.");
  }
  if (receipt.outcome === "rejected") {
    const details = rejectionDetailsSchema.parse({ version: 1 });
    const rejection = await transaction.execute({
      sql: `INSERT INTO command_rejections (project_id, receipt_id, receipt_outcome, project_sequence,
        rejection_code, retryable, details_json, details_hash) VALUES (?, ?, 'rejected', ?, ?, ?, ?, ?)`,
      args: [command.projectId, receiptId, projectSequence, receipt.rejection.code,
        receipt.rejection.retryable ? 1 : 0, canonicalJsonText(details), hashCanonicalJson(details)],
    });
    assertRowsAffected(rejection.rowsAffected, "Canonical rejection was not inserted once.");
  }
  for (const event of events) {
    const insertedEvent = await transaction.execute({
      sql: `INSERT INTO canonical_events (project_id, event_id, receipt_id, receipt_outcome,
        project_sequence, event_ordinal, aggregate_type, aggregate_id, aggregate_version,
        event_type, event_version, payload_json, payload_hash, occurred_at)
        VALUES (?, ?, ?, 'applied', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [command.projectId, event.eventId, receiptId, projectSequence, event.eventOrdinal,
        event.aggregateType, event.aggregateId, event.aggregateVersion, event.eventType,
        event.eventVersion, event.payloadJson, event.payloadHash, settledAt],
    });
    assertRowsAffected(insertedEvent.rowsAffected, "Canonical event was not inserted once.");
  }
  return receipt;
}
```

### apps/harness/src/storage/canonical-command-settlement.ts - NEW
S5 delta (approved): fence, sequence bound, replay, registered decision, revocable SAVEPOINT scope, and ledger persistence in one outer transaction. A missing fence is stale; malformed/duplicated rows or broken stored relationships are errors, not absence. Well-formed authority belonging to another generation/token or released authority is stale. No catch here classifies commit outcome.

S6 delta (approved): share the existing authority predicate and checked sequence read internally with recovery. Repository computes the admitted fingerprint once using the S5 canonical hash owner and passes that exact value into this body; normal settlement/replay creates no recovery metadata. These exports are internal imports, not package/protocol APIs.

```ts
import {
  CanonicalSettlementTimeSchema,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  SystemCommandRejectionCodeSchema,
  WriterGenerationSchema,
  type CanonicalCommandReceipt,
  type ProjectId,
  type WriterGeneration,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  CanonicalCommandDecisionSchema,
  type CanonicalCommandDecision,
  type CanonicalCommandRegistry,
  type CanonicalCommandTransaction,
  type PreparedCanonicalCommand,
} from "../canonical-command-registry.js";
import {
  CanonicalSha256Schema,
  canonicalJsonText,
  parseCanonicalJson,
  type CanonicalCommandSnapshot,
} from "../canonical-json.js";
import { exactlyOne, lookupCanonicalSettlement, persistCanonicalSettlement, resultObjects } from "./canonical-command-ledger.js";
import type { LocalLibsqlResultSet, LocalLibsqlTransaction } from "./local-libsql-worker-client.js";

export type CanonicalSettlementDependencies = Readonly<{
  registry: CanonicalCommandRegistry;
  createReceiptId(): string;
  createEventId(): string;
  now(): string;
}>;
export type CanonicalCommandSettlementResult =
  | Readonly<{ status: "settled"; receipt: CanonicalCommandReceipt }>
  | Readonly<{ status: "stale-writer" }>
  | Readonly<{ status: "sequence-exhausted" }>;

const fenceRowSchema = z.strictObject({
  projectId: ProjectIdSchema,
  writerGeneration: WriterGenerationSchema,
  tokenDigest: CanonicalSha256Schema,
  state: z.enum(["active", "released"]),
  activatedAt: CanonicalSettlementTimeSchema,
  releasedAt: CanonicalSettlementTimeSchema.nullable(),
  generationProjectId: ProjectIdSchema.nullable(),
  generationNumber: WriterGenerationSchema.nullable(),
  generationActivationId: ProjectActivationIdSchema.nullable(),
  generationTokenDigest: CanonicalSha256Schema.nullable(),
  acquiredAt: CanonicalSettlementTimeSchema.nullable(),
  generationReleasedAt: CanonicalSettlementTimeSchema.nullable(),
});

export async function readCanonicalWriterFence(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
}>): Promise<z.infer<typeof fenceRowSchema> | undefined> {
  const rows = fenceRowSchema.array().parse(resultObjects(await input.transaction.execute({
    sql: `SELECT f.project_id AS projectId, f.writer_generation AS writerGeneration,
      f.token_digest AS tokenDigest, f.state AS state, f.activated_at AS activatedAt, f.released_at AS releasedAt,
      g.project_id AS generationProjectId, g.writer_generation AS generationNumber,
      g.activation_id AS generationActivationId, g.token_digest AS generationTokenDigest,
      g.acquired_at AS acquiredAt, g.released_at AS generationReleasedAt
      FROM writer_fence AS f LEFT JOIN writer_generations AS g
        ON g.project_id = f.project_id AND g.writer_generation = f.writer_generation
      WHERE f.project_id = ?`,
    args: [input.projectId],
  })));
  if (rows.length === 0) return undefined;
  const row = exactlyOne(rows, "Canonical settlement fence is duplicated.");
  if (row.projectId !== input.projectId || row.generationProjectId !== row.projectId ||
      row.generationNumber !== row.writerGeneration || row.generationTokenDigest !== row.tokenDigest ||
      row.generationActivationId === null || row.acquiredAt === null ||
      Date.parse(row.activatedAt) !== Date.parse(row.acquiredAt)) {
    throw new Error("Canonical settlement fence binding is inconsistent.");
  }
  if (row.state === "active") {
    if (row.releasedAt !== null || row.generationReleasedAt !== null) {
      throw new Error("Canonical active fence release shape is inconsistent.");
    }
  } else {
    if (row.releasedAt === null || row.generationReleasedAt === null ||
        Date.parse(row.releasedAt) !== Date.parse(row.generationReleasedAt)) {
      throw new Error("Canonical released fence shape is inconsistent.");
    }
  }
  return row;
}

export async function hasSettlementAuthority(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  writerGeneration: WriterGeneration;
  tokenDigest: string;
}>): Promise<boolean> {
  const row = await readCanonicalWriterFence(input);
  return row !== undefined && row.state === "active" &&
    row.writerGeneration === input.writerGeneration && row.tokenDigest === input.tokenDigest;
}

async function runScopedHandler(
  transaction: LocalLibsqlTransaction,
  projectId: ProjectId,
  prepared: Extract<PreparedCanonicalCommand, { status: "ready" }>,
): Promise<CanonicalCommandDecision> {
  await transaction.execute("SAVEPOINT canonical_handler");
  let open = true;
  const pending: Promise<void>[] = [];
  const failures: unknown[] = [];
  const facade: CanonicalCommandTransaction = Object.freeze({
    execute: (statement, args): Promise<LocalLibsqlResultSet> => {
      if (!open) throw new Error("Canonical command transaction capability is revoked.");
      let operation: Promise<LocalLibsqlResultSet>;
      try {
        operation = transaction.execute(structuredClone(statement), args === undefined ? undefined : structuredClone(args));
      } catch (error) {
        operation = Promise.reject(error);
      }
      pending.push(operation.then(() => undefined, (error: unknown) => { failures.push(error); }));
      return operation;
    },
  } satisfies CanonicalCommandTransaction);
  let decision: CanonicalCommandDecision | undefined;
  try {
    const returned = prepared.run({ projectId, transaction: facade });
    const result = returned instanceof Promise ? await returned : returned;
    // Snapshot output before any later callback can mutate its events or payloads.
    decision = CanonicalCommandDecisionSchema.parse(parseCanonicalJson(canonicalJsonText(result)));
    if (decision.outcome === "rejected" && SystemCommandRejectionCodeSchema.safeParse(decision.rejection.code).success) {
      throw new Error("Canonical handler used a reserved rejection code.");
    }
  } catch (error) {
    failures.push(error);
  } finally {
    open = false;
    await Promise.all(pending);
  }
  if (failures.length > 0) {
    if (failures.length === 1) throw failures[0];
    throw new AggregateError(failures, "Canonical handler or issued SQL failed.");
  }
  if (decision === undefined) throw new Error("Canonical handler returned no decision.");
  if (decision.outcome !== "applied") await transaction.execute("ROLLBACK TO SAVEPOINT canonical_handler");
  await transaction.execute("RELEASE SAVEPOINT canonical_handler");
  return decision;
}

export async function readSettlementSequence(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  writerGeneration: WriterGeneration;
}>): Promise<number> {
  const state = exactlyOne(z.strictObject({
    projectId: ProjectIdSchema,
    lastProjectSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    lastWriterGeneration: WriterGenerationSchema,
    createdAt: CanonicalSettlementTimeSchema,
    updatedAt: CanonicalSettlementTimeSchema,
  }).array().parse(resultObjects(await input.transaction.execute({
    sql: `SELECT project_id AS projectId, last_project_sequence AS lastProjectSequence,
      last_writer_generation AS lastWriterGeneration, created_at AS createdAt, updated_at AS updatedAt
      FROM project_state WHERE project_id = ?`,
    args: [input.projectId],
  }))), "Canonical Project state is missing or duplicated.");
  if (state.projectId !== input.projectId || state.lastWriterGeneration !== input.writerGeneration) {
    throw new Error("Canonical Project state disagrees with Writer authority.");
  }
  return state.lastProjectSequence;
}

export async function settleCanonicalCommand(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  writerGeneration: WriterGeneration;
  tokenDigest: string;
  command: CanonicalCommandSnapshot;
  fingerprint: string;
  dependencies: CanonicalSettlementDependencies;
}>): Promise<CanonicalCommandSettlementResult> {
  if (!await hasSettlementAuthority(input)) return { status: "stale-writer" };
  const lastProjectSequence = await readSettlementSequence(input);
  const fingerprint = CanonicalSha256Schema.parse(input.fingerprint);
  const prior = await lookupCanonicalSettlement({
    transaction: input.transaction, projectId: input.projectId,
    writerGeneration: input.writerGeneration, lastProjectSequence,
  }, input.command, fingerprint);
  if (prior.status === "replay") return { status: "settled", receipt: prior.receipt };
  if (lastProjectSequence === Number.MAX_SAFE_INTEGER) return { status: "sequence-exhausted" };
  let decision: CanonicalCommandDecision;
  if (prior.status === "conflict") {
    decision = { outcome: "rejected", rejection: { code: "IDEMPOTENCY_CONFLICT", retryable: false } };
  } else {
    const prepared = input.dependencies.registry.prepare(input.command);
    decision = prepared.status === "rejected"
      ? { outcome: "rejected", rejection: prepared.rejection }
      : await runScopedHandler(input.transaction, input.projectId, prepared);
  }
  const receipt = await persistCanonicalSettlement({
    transaction: input.transaction, command: input.command, fingerprint,
    lastProjectSequence, writerGeneration: input.writerGeneration,
    decision, original: prior.status === "new",
    createReceiptId: input.dependencies.createReceiptId,
    createEventId: input.dependencies.createEventId,
    now: input.dependencies.now,
  });
  return { status: "settled", receipt };
}
```

### apps/harness/src/storage/canonical-writer-recovery.ts - NEW
S6 delta (approved): sole recovery-record validation, explicit recording, and activation-resolution owner. It owns neither transactions nor the native lease; repository lifecycle keeps both owned. Queries include only applicable/current, unresolved/partially resolved, or future authority for this Project. All inner diagnostics remain private causes of the existing repository lifecycle errors. The existing S3 abandoned-record insert moves here; its SQL meaning stays generation-superseded with null command fields.

```ts
import { isDomainIdentity } from "@slopstop/kernel";
import {
  CanonicalSettlementTimeSchema,
  CommandIdSchema,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  WriterGenerationSchema,
  type ProjectId,
  type WriterGeneration,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  CanonicalSha256Schema,
  CanonicalStoredIdentitySchema,
  canonicalJsonText,
} from "../canonical-json.js";
import {
  assertRowsAffected,
  exactlyOne,
  lookupCanonicalSettlementByFingerprint,
  resultObjects,
} from "./canonical-command-ledger.js";
import { hasSettlementAuthority, readSettlementSequence } from "./canonical-command-settlement.js";
import type { LocalLibsqlTransaction } from "./local-libsql-worker-client.js";

const recoveryRecordIdSchema = CanonicalStoredIdentitySchema.refine(isDomainIdentity);
const uncertainCommandSchema = z.strictObject({
  commandId: CommandIdSchema,
  commandFingerprint: CanonicalSha256Schema,
}).readonly();
export type UncertainCanonicalCommand = z.infer<typeof uncertainCommandSchema>;

const recoveryColumnsSchema = z.strictObject({
  projectId: ProjectIdSchema,
  recoveryRecordId: recoveryRecordIdSchema,
  writerGeneration: WriterGenerationSchema,
  reason: z.enum(["commit-uncertain", "abandoned-active-fence"]),
  commandId: CommandIdSchema.nullable(),
  commandFingerprint: CanonicalSha256Schema.nullable(),
  observedAt: CanonicalSettlementTimeSchema,
  resolution: z.enum(["receipt-found", "receipt-absent", "generation-superseded"]).nullable(),
  resolvedByWriterGeneration: WriterGenerationSchema.nullable(),
  resolvedAt: CanonicalSettlementTimeSchema.nullable(),
});
const uncertainRecoverySchema = recoveryColumnsSchema.extend({
  reason: z.literal("commit-uncertain"),
  commandId: CommandIdSchema,
  commandFingerprint: CanonicalSha256Schema,
});
const unresolvedRecoverySchema = uncertainRecoverySchema.extend({
  resolution: z.null(),
  resolvedByWriterGeneration: z.null(),
  resolvedAt: z.null(),
}).readonly();
export type UnresolvedWriterRecovery = z.infer<typeof unresolvedRecoverySchema>;

const recoveryRecordSchema = z.union([
  unresolvedRecoverySchema,
  uncertainRecoverySchema.extend({
    resolution: z.enum(["receipt-found", "receipt-absent"]),
    resolvedByWriterGeneration: WriterGenerationSchema,
    resolvedAt: CanonicalSettlementTimeSchema,
  }).readonly(),
  recoveryColumnsSchema.extend({
    reason: z.literal("abandoned-active-fence"),
    commandId: z.null(),
    commandFingerprint: z.null(),
    resolution: z.literal("generation-superseded"),
    resolvedByWriterGeneration: WriterGenerationSchema,
    resolvedAt: CanonicalSettlementTimeSchema,
  }).readonly(),
]);
const recoveryAuthorityRowSchema = recoveryColumnsSchema.extend({
  sourceProjectId: ProjectIdSchema.nullable(),
  sourceWriterGeneration: WriterGenerationSchema.nullable(),
  sourceActivationId: ProjectActivationIdSchema.nullable(),
  sourceTokenDigest: CanonicalSha256Schema.nullable(),
  sourceAcquiredAt: CanonicalSettlementTimeSchema.nullable(),
  sourceReleasedAt: CanonicalSettlementTimeSchema.nullable(),
  resolverProjectId: ProjectIdSchema.nullable(),
  resolverWriterGeneration: WriterGenerationSchema.nullable(),
  resolverAcquiredAt: CanonicalSettlementTimeSchema.nullable(),
});

export function prepareUncertainWriterRecovery(input: Readonly<{
  projectId: ProjectId;
  writerGeneration: WriterGeneration;
  command: UncertainCanonicalCommand;
  createRecoveryRecordId(): string;
  now(): string;
}>): UnresolvedWriterRecovery {
  const command = uncertainCommandSchema.parse(input.command);
  const recoveryRecordId = recoveryRecordIdSchema.parse(input.createRecoveryRecordId());
  const observedAt = CanonicalSettlementTimeSchema.parse(input.now());
  return unresolvedRecoverySchema.parse({
    projectId: input.projectId,
    writerGeneration: input.writerGeneration,
    recoveryRecordId,
    reason: "commit-uncertain",
    commandId: command.commandId,
    commandFingerprint: command.commandFingerprint,
    observedAt,
    resolution: null,
    resolvedByWriterGeneration: null,
    resolvedAt: null,
  });
}

async function readPendingWriterRecovery(
  transaction: LocalLibsqlTransaction,
  projectId: ProjectId,
  lastWriterGeneration: number,
): Promise<UnresolvedWriterRecovery | undefined> {
  const rows = recoveryAuthorityRowSchema.array().parse(resultObjects(await transaction.execute({
    sql: `SELECT r.project_id AS projectId, r.recovery_record_id AS recoveryRecordId,
      r.writer_generation AS writerGeneration, r.reason, r.command_id AS commandId,
      r.command_fingerprint AS commandFingerprint, r.observed_at AS observedAt,
      r.resolution, r.resolved_by_writer_generation AS resolvedByWriterGeneration, r.resolved_at AS resolvedAt,
      g.project_id AS sourceProjectId, g.writer_generation AS sourceWriterGeneration,
      g.activation_id AS sourceActivationId, g.token_digest AS sourceTokenDigest,
      g.acquired_at AS sourceAcquiredAt, g.released_at AS sourceReleasedAt,
      resolver.project_id AS resolverProjectId, resolver.writer_generation AS resolverWriterGeneration,
      resolver.acquired_at AS resolverAcquiredAt
      FROM writer_recovery_records AS r
      LEFT JOIN writer_generations AS g
        ON g.project_id = r.project_id AND g.writer_generation = r.writer_generation
      LEFT JOIN writer_generations AS resolver
        ON resolver.project_id = r.project_id AND resolver.writer_generation = r.resolved_by_writer_generation
      WHERE r.project_id = ? AND (
        r.writer_generation >= ? OR r.resolution IS NULL OR r.resolved_by_writer_generation IS NULL
        OR r.resolved_at IS NULL OR r.resolved_by_writer_generation > ?)
      ORDER BY r.writer_generation, r.recovery_record_id`,
    args: [projectId, lastWriterGeneration, lastWriterGeneration],
  })));
  if (rows.length === 0) return undefined;
  const row = exactlyOne(rows, "Canonical Writer recovery authority is duplicated or out of order.");
  const {
    sourceProjectId, sourceWriterGeneration, sourceActivationId, sourceTokenDigest,
    sourceAcquiredAt, sourceReleasedAt, resolverProjectId, resolverWriterGeneration,
    resolverAcquiredAt, ...columns
  } = row;
  const record = recoveryRecordSchema.parse(columns);
  if (record.projectId !== projectId || sourceProjectId !== projectId ||
      sourceWriterGeneration !== record.writerGeneration || sourceActivationId === null ||
      sourceTokenDigest === null || sourceAcquiredAt === null) {
    throw new Error("Canonical Writer recovery generation binding is inconsistent.");
  }
  if (record.resolution !== null) {
    if (resolverProjectId !== projectId || resolverWriterGeneration !== record.resolvedByWriterGeneration ||
        record.resolvedByWriterGeneration <= record.writerGeneration ||
        record.resolvedByWriterGeneration > lastWriterGeneration || resolverAcquiredAt === null ||
        record.resolvedAt !== resolverAcquiredAt || sourceReleasedAt === null) {
      throw new Error("Canonical Writer recovery resolver binding is inconsistent.");
    }
    throw new Error("Canonical Writer recovery was resolved at an impossible predecessor.");
  }
  if (lastWriterGeneration === 0 || record.writerGeneration !== lastWriterGeneration ||
      resolverProjectId !== null || resolverWriterGeneration !== null || resolverAcquiredAt !== null) {
    throw new Error("Canonical Writer unresolved recovery is not the current predecessor.");
  }
  return record;
}

export async function persistUncertainWriterRecovery(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  record: UnresolvedWriterRecovery;
  tokenDigest: string;
}>): Promise<boolean> {
  const record = unresolvedRecoverySchema.parse(input.record);
  const authority = {
    transaction: input.transaction,
    projectId: record.projectId,
    writerGeneration: record.writerGeneration,
    tokenDigest: input.tokenDigest,
  };
  if (!await hasSettlementAuthority(authority)) return false;
  await readSettlementSequence(authority);
  const existing = await readPendingWriterRecovery(input.transaction, record.projectId, record.writerGeneration);
  if (existing !== undefined) {
    if (canonicalJsonText(existing) !== canonicalJsonText(record)) {
      throw new Error("Canonical Writer recovery does not match the retained prepared record.");
    }
    return true;
  }
  const result = await input.transaction.execute({
    sql: `INSERT INTO writer_recovery_records
      (project_id, recovery_record_id, writer_generation, reason, command_id,
        command_fingerprint, observed_at, resolution, resolved_by_writer_generation, resolved_at)
      VALUES (?, ?, ?, 'commit-uncertain', ?, ?, ?, NULL, NULL, NULL)`,
    args: [record.projectId, record.recoveryRecordId, record.writerGeneration,
      record.commandId, record.commandFingerprint, record.observedAt],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Writer uncertainty was not inserted once.");
  return true;
}

type WriterRecoveryResolution = Readonly<{
  record: UnresolvedWriterRecovery;
  resolution: "receipt-found" | "receipt-absent";
}>;

export async function inspectWriterRecovery(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  lastWriterGeneration: number;
}>): Promise<WriterRecoveryResolution | undefined> {
  const record = await readPendingWriterRecovery(input.transaction, input.projectId, input.lastWriterGeneration);
  if (record === undefined) return undefined;
  const lastProjectSequence = await readSettlementSequence({
    transaction: input.transaction, projectId: input.projectId, writerGeneration: record.writerGeneration,
  });
  const lookup = await lookupCanonicalSettlementByFingerprint({
    transaction: input.transaction, projectId: input.projectId,
    writerGeneration: record.writerGeneration, lastProjectSequence,
  }, record.commandId, record.commandFingerprint);
  return { record, resolution: lookup.status === "replay" ? "receipt-found" : "receipt-absent" };
}

export async function resolveWriterRecovery(input: Readonly<{
  transaction: LocalLibsqlTransaction;
  recovery: WriterRecoveryResolution;
  resolvingGeneration: WriterGeneration;
  resolvedAt: string;
}>): Promise<void> {
  const { record, resolution } = input.recovery;
  const resolvedAt = CanonicalSettlementTimeSchema.parse(input.resolvedAt);
  if (input.resolvingGeneration !== record.writerGeneration + 1) {
    throw new Error("Canonical Writer recovery resolver is not the next generation.");
  }
  const result = await input.transaction.execute({
    sql: `UPDATE writer_recovery_records
      SET resolution = ?, resolved_by_writer_generation = ?, resolved_at = ?
      WHERE project_id = ? AND recovery_record_id = ? AND writer_generation = ?
        AND reason = 'commit-uncertain' AND command_id = ? AND command_fingerprint = ? AND observed_at = ?
        AND resolution IS NULL AND resolved_by_writer_generation IS NULL AND resolved_at IS NULL
        AND EXISTS (SELECT 1 FROM writer_generations AS g INNER JOIN project_state AS s
          ON s.project_id = g.project_id AND s.last_writer_generation = g.writer_generation
          WHERE g.project_id = ? AND g.writer_generation = ? AND g.acquired_at = ? AND g.released_at IS NULL)
        AND EXISTS (SELECT 1 FROM writer_generations AS old
          WHERE old.project_id = ? AND old.writer_generation = ? AND old.released_at IS NOT NULL)`,
    args: [resolution, input.resolvingGeneration, resolvedAt,
      record.projectId, record.recoveryRecordId, record.writerGeneration,
      record.commandId, record.commandFingerprint, record.observedAt,
      record.projectId, input.resolvingGeneration, resolvedAt, record.projectId, record.writerGeneration],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Writer uncertainty was not resolved once.");
}

export async function recordAbandonedFence(input: {
  transaction: LocalLibsqlTransaction;
  projectId: ProjectId;
  abandonedGeneration: WriterGeneration;
  resolvingGeneration: WriterGeneration;
  observedAt: string;
  createRecoveryRecordId(): string;
}): Promise<void> {
  const result = await input.transaction.execute({
    sql: `INSERT INTO writer_recovery_records
      (project_id, recovery_record_id, writer_generation, reason, command_id,
        command_fingerprint, observed_at, resolution, resolved_by_writer_generation, resolved_at)
      VALUES (?, ?, ?, 'abandoned-active-fence', NULL, NULL, ?,
        'generation-superseded', ?, ?)`,
    args: [input.projectId, recoveryRecordIdSchema.parse(input.createRecoveryRecordId()),
      input.abandonedGeneration, input.observedAt, input.resolvingGeneration, input.observedAt],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Writer recovery was not inserted once.");
}
```

### apps/harness/src/types/fs-native-extensions.d.ts - NEW
Provide the narrow strict TypeScript declaration used by the native lease adapter.

```ts
declare module "fs-native-extensions" {
  export type LockOptions = Readonly<{ shared?: boolean }>;

  export function tryLock(
    fileDescriptor: number,
    offset?: number,
    length?: number,
    options?: LockOptions,
  ): boolean;

  export function unlock(fileDescriptor: number, offset?: number, length?: number): void;
}
```

### apps/harness/src/storage/canonical-schema.ts:1-566 - MODIFY
Declare canonical generation-2 Writer, sequence, idempotency, receipt, rejection, event, handoff, and recovery tables and constraints.

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
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { createSchemaMetadataColumns } from "./schema-metadata-columns.js";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

function nonemptyTextCheck(column: AnySQLiteColumn) {
  return sql`length(trim(${column})) > 0`;
}

function sha256Check(column: AnySQLiteColumn) {
  return sql`
    length(${column}) = 64
    and ${column} = lower(${column})
    and ${column} not glob '*[^0-9a-f]*'
  `;
}

function nonnegativeSafeIntegerCheck(column: AnySQLiteColumn) {
  return sql`
    typeof(${column}) = 'integer'
    and ${column} >= 0
    and ${column} <= 9007199254740991
  `;
}

function positiveSafeIntegerCheck(column: AnySQLiteColumn) {
  return sql`
    typeof(${column}) = 'integer'
    and ${column} > 0
    and ${column} <= 9007199254740991
  `;
}

export const canonicalSchemaMetadata = sqliteTable(
  "schema_metadata",
  createSchemaMetadataColumns(),
  (table) => [
    check("canonical_metadata_key", sql`${table.metadataKey} = 'canonical'`),
    check("canonical_metadata_kind", sql`${table.databaseKind} = 'canonical'`),
    check("canonical_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("canonical_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check("canonical_migration_nonempty", nonemptyTextCheck(table.lastMigrationId)),
  ],
);

export const canonicalProjectState = sqliteTable(
  "project_state",
  {
    projectId: text("project_id").primaryKey(),
    lastProjectSequence: integer("last_project_sequence").notNull(),
    lastWriterGeneration: integer("last_writer_generation").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("project_state_project_uuid", domainIdentityCheck(table.projectId)),
    check(
      "project_state_sequence_nonnegative_safe",
      nonnegativeSafeIntegerCheck(table.lastProjectSequence),
    ),
    check(
      "project_state_writer_generation_nonnegative_safe",
      nonnegativeSafeIntegerCheck(table.lastWriterGeneration),
    ),
  ],
);

export const canonicalStorageIdentity = sqliteTable(
  "storage_identity",
  {
    identityKey: text("identity_key").notNull(),
    projectId: text("project_id").notNull(),
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    canonicalDatabaseLineageId: text("canonical_database_lineage_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "canonical_storage_identity_pk",
      columns: [table.projectId, table.identityKey],
    }),
    foreignKey({
      name: "canonical_storage_identity_project_fk",
      columns: [table.projectId],
      foreignColumns: [canonicalProjectState.projectId],
    }).onDelete("restrict"),
    check("canonical_identity_singleton", sql`${table.identityKey} = 'storage'`),
    check("canonical_identity_project_uuid", domainIdentityCheck(table.projectId)),
    check("canonical_identity_storage_uuid", domainIdentityCheck(table.storageId)),
    check("canonical_identity_generation_uuid", domainIdentityCheck(table.generationId)),
    check("canonical_identity_lineage_uuid", domainIdentityCheck(table.canonicalDatabaseLineageId)),
  ],
);

export const writerGenerations = sqliteTable(
  "writer_generations",
  {
    projectId: text("project_id").notNull(),
    writerGeneration: integer("writer_generation").notNull(),
    activationId: text("activation_id").notNull(),
    tokenDigest: text("token_digest").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    releasedAt: text("released_at"),
  },
  (table) => [
    primaryKey({
      name: "writer_generations_pk",
      columns: [table.projectId, table.writerGeneration],
    }),
    foreignKey({
      name: "writer_generations_project_fk",
      columns: [table.projectId],
      foreignColumns: [canonicalProjectState.projectId],
    }).onDelete("restrict"),
    uniqueIndex("writer_generations_activation_uq").on(table.projectId, table.activationId),
    uniqueIndex("writer_generations_fence_uq").on(
      table.projectId,
      table.writerGeneration,
      table.tokenDigest,
    ),
    check(
      "writer_generations_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
    check("writer_generations_activation_uuid", domainIdentityCheck(table.activationId)),
    check("writer_generations_token_sha256", sha256Check(table.tokenDigest)),
  ],
);

export const writerFence = sqliteTable(
  "writer_fence",
  {
    projectId: text("project_id").primaryKey(),
    writerGeneration: integer("writer_generation").notNull(),
    tokenDigest: text("token_digest").notNull(),
    state: text("state", { enum: ["active", "released"] }).notNull(),
    activatedAt: text("activated_at").notNull(),
    releasedAt: text("released_at"),
  },
  (table) => [
    foreignKey({
      name: "writer_fence_generation_fk",
      columns: [table.projectId, table.writerGeneration, table.tokenDigest],
      foreignColumns: [
        writerGenerations.projectId,
        writerGenerations.writerGeneration,
        writerGenerations.tokenDigest,
      ],
    }).onDelete("restrict"),
    check(
      "writer_fence_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
    check("writer_fence_token_sha256", sha256Check(table.tokenDigest)),
    check("writer_fence_state", sql`${table.state} in ('active', 'released')`),
    check(
      "writer_fence_release_shape",
      sql`
        (${table.state} = 'active' and ${table.releasedAt} is null)
        or (${table.state} = 'released' and ${table.releasedAt} is not null)
      `,
    ),
  ],
);

export const writerHandoffs = sqliteTable(
  "writer_handoffs",
  {
    projectId: text("project_id").notNull(),
    handoffId: text("handoff_id").notNull(),
    fromWriterGeneration: integer("from_writer_generation"),
    toWriterGeneration: integer("to_writer_generation").notNull(),
    kind: text("kind", { enum: ["initial", "clean", "recovery"] }).notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "writer_handoffs_pk",
      columns: [table.projectId, table.handoffId],
    }),
    foreignKey({
      name: "writer_handoffs_from_generation_fk",
      columns: [table.projectId, table.fromWriterGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    foreignKey({
      name: "writer_handoffs_to_generation_fk",
      columns: [table.projectId, table.toWriterGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    uniqueIndex("writer_handoffs_to_generation_uq").on(
      table.projectId,
      table.toWriterGeneration,
    ),
    index("writer_handoffs_from_generation_idx").on(
      table.projectId,
      table.fromWriterGeneration,
    ),
    check("writer_handoffs_id_uuid", domainIdentityCheck(table.handoffId)),
    check(
      "writer_handoffs_from_generation_positive_safe",
      sql`${table.fromWriterGeneration} is null or (${positiveSafeIntegerCheck(table.fromWriterGeneration)})`,
    ),
    check(
      "writer_handoffs_to_generation_positive_safe",
      positiveSafeIntegerCheck(table.toWriterGeneration),
    ),
    check("writer_handoffs_kind", sql`${table.kind} in ('initial', 'clean', 'recovery')`),
    check(
      "writer_handoffs_predecessor_shape",
      sql`
        (${table.kind} = 'initial' and ${table.fromWriterGeneration} is null)
        or (${table.kind} in ('clean', 'recovery') and ${table.fromWriterGeneration} is not null)
      `,
    ),
    check(
      "writer_handoffs_generation_order",
      sql`${table.fromWriterGeneration} is null or ${table.toWriterGeneration} > ${table.fromWriterGeneration}`,
    ),
  ],
);

export const writerRecoveryRecords = sqliteTable(
  "writer_recovery_records",
  {
    projectId: text("project_id").notNull(),
    recoveryRecordId: text("recovery_record_id").notNull(),
    writerGeneration: integer("writer_generation").notNull(),
    reason: text("reason", {
      enum: ["commit-uncertain", "abandoned-active-fence"],
    }).notNull(),
    commandId: text("command_id"),
    commandFingerprint: text("command_fingerprint"),
    observedAt: text("observed_at").notNull(),
    resolution: text("resolution", {
      enum: ["receipt-found", "receipt-absent", "generation-superseded"],
    }),
    resolvedByWriterGeneration: integer("resolved_by_writer_generation"),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    primaryKey({
      name: "writer_recovery_records_pk",
      columns: [table.projectId, table.recoveryRecordId],
    }),
    foreignKey({
      name: "writer_recovery_records_generation_fk",
      columns: [table.projectId, table.writerGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    foreignKey({
      name: "writer_recovery_records_resolver_fk",
      columns: [table.projectId, table.resolvedByWriterGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    uniqueIndex("writer_recovery_records_generation_uq").on(
      table.projectId,
      table.writerGeneration,
    ),
    uniqueIndex("writer_recovery_records_unresolved_uq")
      .on(table.projectId)
      .where(sql`${table.resolution} is null`),
    index("writer_recovery_records_command_idx").on(table.projectId, table.commandId),
    check("writer_recovery_records_id_uuid", domainIdentityCheck(table.recoveryRecordId)),
    check(
      "writer_recovery_records_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
    check(
      "writer_recovery_records_reason",
      sql`${table.reason} in ('commit-uncertain', 'abandoned-active-fence')`,
    ),
    check(
      "writer_recovery_records_command_uuid",
      sql`${table.commandId} is null or (${domainIdentityCheck(table.commandId)})`,
    ),
    check(
      "writer_recovery_records_fingerprint_sha256",
      sql`${table.commandFingerprint} is null or (${sha256Check(table.commandFingerprint)})`,
    ),
    check(
      "writer_recovery_records_command_shape",
      sql`
        (
          ${table.reason} = 'commit-uncertain'
          and ${table.commandId} is not null
          and ${table.commandFingerprint} is not null
        )
        or (
          ${table.reason} = 'abandoned-active-fence'
          and ${table.commandId} is null
          and ${table.commandFingerprint} is null
        )
      `,
    ),
    check(
      "writer_recovery_records_resolution",
      sql`
        ${table.resolution} is null
        or (
          ${table.reason} = 'commit-uncertain'
          and ${table.resolution} in ('receipt-found', 'receipt-absent')
        )
        or (
          ${table.reason} = 'abandoned-active-fence'
          and ${table.resolution} = 'generation-superseded'
        )
      `,
    ),
    check(
      "writer_recovery_records_resolution_shape",
      sql`
        (
          ${table.resolution} is null
          and ${table.resolvedByWriterGeneration} is null
          and ${table.resolvedAt} is null
        )
        or (
          ${table.resolution} is not null
          and ${table.resolvedByWriterGeneration} is not null
          and ${table.resolvedAt} is not null
        )
      `,
    ),
    check(
      "writer_recovery_records_resolver_order",
      sql`
        ${table.resolvedByWriterGeneration} is null
        or (
          ${positiveSafeIntegerCheck(table.resolvedByWriterGeneration)}
          and ${table.resolvedByWriterGeneration} > ${table.writerGeneration}
        )
      `,
    ),
  ],
);

export const commandReceipts = sqliteTable(
  "command_receipts",
  {
    projectId: text("project_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    commandId: text("command_id").notNull(),
    commandType: text("command_type").notNull(),
    commandVersion: integer("command_version").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    outcome: text("outcome", { enum: ["applied", "unchanged", "rejected"] }).notNull(),
    projectSequence: integer("project_sequence").notNull(),
    writerGeneration: integer("writer_generation").notNull(),
    settledAt: text("settled_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "command_receipts_pk",
      columns: [table.projectId, table.receiptId],
    }),
    foreignKey({
      name: "command_receipts_writer_generation_fk",
      columns: [table.projectId, table.writerGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    uniqueIndex("command_receipts_command_fingerprint_uq").on(
      table.projectId,
      table.commandId,
      table.commandFingerprint,
    ),
    uniqueIndex("command_receipts_project_sequence_uq").on(
      table.projectId,
      table.projectSequence,
    ),
    uniqueIndex("command_receipts_idempotency_binding_uq").on(
      table.projectId,
      table.receiptId,
      table.commandId,
      table.commandFingerprint,
    ),
    uniqueIndex("command_receipts_settlement_binding_uq").on(
      table.projectId,
      table.receiptId,
      table.outcome,
      table.projectSequence,
    ),
    check("command_receipts_id_uuid", domainIdentityCheck(table.receiptId)),
    check("command_receipts_command_uuid", domainIdentityCheck(table.commandId)),
    check("command_receipts_type_nonempty", nonemptyTextCheck(table.commandType)),
    check(
      "command_receipts_version_positive_safe",
      positiveSafeIntegerCheck(table.commandVersion),
    ),
    check("command_receipts_fingerprint_sha256", sha256Check(table.commandFingerprint)),
    check(
      "command_receipts_outcome",
      sql`${table.outcome} in ('applied', 'unchanged', 'rejected')`,
    ),
    check(
      "command_receipts_sequence_positive_safe",
      positiveSafeIntegerCheck(table.projectSequence),
    ),
    check(
      "command_receipts_writer_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
  ],
);

export const commandIdempotency = sqliteTable(
  "command_idempotency",
  {
    projectId: text("project_id").notNull(),
    commandId: text("command_id").notNull(),
    originalCommandFingerprint: text("original_command_fingerprint").notNull(),
    originalReceiptId: text("original_receipt_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "command_idempotency_pk",
      columns: [table.projectId, table.commandId],
    }),
    foreignKey({
      name: "command_idempotency_receipt_fk",
      columns: [
        table.projectId,
        table.originalReceiptId,
        table.commandId,
        table.originalCommandFingerprint,
      ],
      foreignColumns: [
        commandReceipts.projectId,
        commandReceipts.receiptId,
        commandReceipts.commandId,
        commandReceipts.commandFingerprint,
      ],
    }).onDelete("restrict"),
    uniqueIndex("command_idempotency_receipt_uq").on(
      table.projectId,
      table.originalReceiptId,
    ),
    check("command_idempotency_command_uuid", domainIdentityCheck(table.commandId)),
    check(
      "command_idempotency_fingerprint_sha256",
      sha256Check(table.originalCommandFingerprint),
    ),
  ],
);

export const commandRejections = sqliteTable(
  "command_rejections",
  {
    projectId: text("project_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    receiptOutcome: text("receipt_outcome", { enum: ["rejected"] }).notNull(),
    projectSequence: integer("project_sequence").notNull(),
    rejectionCode: text("rejection_code").notNull(),
    retryable: integer("retryable", { mode: "boolean" }).notNull(),
    detailsJson: text("details_json").notNull(),
    detailsHash: text("details_hash").notNull(),
  },
  (table) => [
    primaryKey({
      name: "command_rejections_pk",
      columns: [table.projectId, table.receiptId],
    }),
    foreignKey({
      name: "command_rejections_receipt_fk",
      columns: [table.projectId, table.receiptId, table.receiptOutcome, table.projectSequence],
      foreignColumns: [
        commandReceipts.projectId,
        commandReceipts.receiptId,
        commandReceipts.outcome,
        commandReceipts.projectSequence,
      ],
    }).onDelete("restrict"),
    check("command_rejections_outcome", sql`${table.receiptOutcome} = 'rejected'`),
    check(
      "command_rejections_sequence_positive_safe",
      positiveSafeIntegerCheck(table.projectSequence),
    ),
    check("command_rejections_code_nonempty", nonemptyTextCheck(table.rejectionCode)),
    check("command_rejections_retryable_boolean", sql`${table.retryable} in (0, 1)`),
    check("command_rejections_details_nonempty", nonemptyTextCheck(table.detailsJson)),
    check("command_rejections_details_sha256", sha256Check(table.detailsHash)),
  ],
);

export const canonicalEvents = sqliteTable(
  "canonical_events",
  {
    projectId: text("project_id").notNull(),
    eventId: text("event_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    receiptOutcome: text("receipt_outcome", { enum: ["applied"] }).notNull(),
    projectSequence: integer("project_sequence").notNull(),
    eventOrdinal: integer("event_ordinal").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    aggregateVersion: integer("aggregate_version").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    payloadJson: text("payload_json").notNull(),
    payloadHash: text("payload_hash").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "canonical_events_pk",
      columns: [table.projectId, table.eventId],
    }),
    foreignKey({
      name: "canonical_events_receipt_fk",
      columns: [table.projectId, table.receiptId, table.receiptOutcome, table.projectSequence],
      foreignColumns: [
        commandReceipts.projectId,
        commandReceipts.receiptId,
        commandReceipts.outcome,
        commandReceipts.projectSequence,
      ],
    }).onDelete("restrict"),
    uniqueIndex("canonical_events_sequence_ordinal_uq").on(
      table.projectId,
      table.projectSequence,
      table.eventOrdinal,
    ),
    index("canonical_events_receipt_idx").on(table.projectId, table.receiptId),
    index("canonical_events_aggregate_idx").on(
      table.projectId,
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion,
    ),
    check("canonical_events_id_uuid", domainIdentityCheck(table.eventId)),
    check("canonical_events_outcome", sql`${table.receiptOutcome} = 'applied'`),
    check(
      "canonical_events_sequence_positive_safe",
      positiveSafeIntegerCheck(table.projectSequence),
    ),
    check(
      "canonical_events_ordinal_nonnegative_safe",
      nonnegativeSafeIntegerCheck(table.eventOrdinal),
    ),
    check("canonical_events_aggregate_type_nonempty", nonemptyTextCheck(table.aggregateType)),
    check("canonical_events_aggregate_id_uuid", domainIdentityCheck(table.aggregateId)),
    check(
      "canonical_events_aggregate_version_positive_safe",
      positiveSafeIntegerCheck(table.aggregateVersion),
    ),
    check("canonical_events_type_nonempty", nonemptyTextCheck(table.eventType)),
    check(
      "canonical_events_version_positive_safe",
      positiveSafeIntegerCheck(table.eventVersion),
    ),
    check("canonical_events_payload_nonempty", nonemptyTextCheck(table.payloadJson)),
    check("canonical_events_payload_sha256", sha256Check(table.payloadHash)),
  ],
);
```

### apps/harness/src/storage/project-storage-database-specs.ts - MODIFY
Advance the canonical exact-schema verifier to generation 2 and enumerate every new table, index, check, and foreign key.

```ts
import type { StorageDatabaseKind } from "./generated-migrations.js";

type MigrationResourceKind = "application" | "canonical" | "runtime";

export type ColumnSpec = Readonly<{
  table: string;
  cid: number;
  name: string;
  type: string;
  notNull: 0 | 1;
  defaultValue: string | null;
  primaryKey: number;
  hidden: number;
}>;

export type NamedCheckSpec = Readonly<{
  table: string;
  name: string;
  expression: string;
}>;

export type NamedIndexSpec = Readonly<{
  table: string;
  name: string;
  unique: boolean;
  partial: boolean;
  columns: readonly string[];
  predicate: string | null;
}>;

export type ForeignKeySpec = Readonly<{
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
  columns: readonly ColumnSpec[];
  checks: readonly NamedCheckSpec[];
  indexes: readonly NamedIndexSpec[];
  foreignKeys: readonly ForeignKeySpec[];
}>;

type ColumnDefinition = readonly [
  name: string,
  type: "integer" | "text",
  notNull: 0 | 1,
  primaryKey: number,
  defaultValue?: string | null,
  hidden?: number,
];

function tableColumns(table: string, definitions: readonly ColumnDefinition[]): readonly ColumnSpec[] {
  return definitions.map(
    ([name, type, notNull, primaryKey, defaultValue = null, hidden = 0], cid) => ({
      table,
      cid,
      name,
      type: type.toUpperCase(),
      notNull,
      defaultValue,
      primaryKey,
      hidden,
    }),
  );
}

function column(table: string, name: string): string {
  return `"${table}"."${name}"`;
}

function namedCheck(table: string, name: string, expression: string): NamedCheckSpec {
  return { table, name, expression };
}

function identityExpression(table: string, columnName: string): string {
  const value = column(table, columnName);
  return `
    length(${value}) = 36
    and ${value} = lower(${value})
    and substr(${value}, 1, 8) not glob '*[^0-9a-f]*'
    and substr(${value}, 9, 1) = '-'
    and substr(${value}, 10, 4) not glob '*[^0-9a-f]*'
    and substr(${value}, 14, 1) = '-'
    and substr(${value}, 15, 1) glob '[1-8]'
    and substr(${value}, 16, 3) not glob '*[^0-9a-f]*'
    and substr(${value}, 19, 1) = '-'
    and substr(${value}, 20, 1) glob '[89ab]'
    and substr(${value}, 21, 3) not glob '*[^0-9a-f]*'
    and substr(${value}, 24, 1) = '-'
    and substr(${value}, 25, 12) not glob '*[^0-9a-f]*'
  `;
}

function identityCheck(table: string, name: string, columnName: string): NamedCheckSpec {
  return namedCheck(table, name, identityExpression(table, columnName));
}

function nonemptyTextExpression(table: string, columnName: string): string {
  return `length(trim(${column(table, columnName)})) > 0`;
}

function sha256Expression(table: string, columnName: string): string {
  const value = column(table, columnName);
  return `
    length(${value}) = 64
    and ${value} = lower(${value})
    and ${value} not glob '*[^0-9a-f]*'
  `;
}

function nonnegativeSafeIntegerExpression(table: string, columnName: string): string {
  const value = column(table, columnName);
  return `
    typeof(${value}) = 'integer'
    and ${value} >= 0
    and ${value} <= 9007199254740991
  `;
}

function positiveSafeIntegerExpression(table: string, columnName: string): string {
  const value = column(table, columnName);
  return `
    typeof(${value}) = 'integer'
    and ${value} > 0
    and ${value} <= 9007199254740991
  `;
}

const schemaMetadataColumnDefinitions = [
  ["metadata_key", "text", 1, 1],
  ["database_kind", "text", 1, 0],
  ["format_version", "integer", 1, 0],
  ["schema_version", "integer", 1, 0],
  ["last_migration_id", "text", 1, 0],
] as const satisfies readonly ColumnDefinition[];

const applicationColumns: readonly ColumnSpec[] = [
  ...tableColumns("schema_metadata", schemaMetadataColumnDefinitions),
  ...tableColumns("storage_locations", [
    ["storage_id", "text", 1, 1],
    ["location_id", "text", 1, 2],
    ["normalized_path", "text", 1, 0],
    ["location_state", "text", 1, 0],
    ["observed_at", "text", 1, 0],
  ]),
  ...tableColumns("storage_generations", [
    ["storage_id", "text", 1, 1],
    ["generation_id", "text", 1, 2],
    ["project_id", "text", 1, 0],
    ["location_id", "text", 1, 0],
    ["canonical_lineage_id", "text", 1, 0],
    ["runtime_lineage_id", "text", 1, 0],
    ["create_request_id", "text", 1, 0],
    ["create_request_fingerprint", "text", 1, 0],
    ["generation_directory_name", "text", 1, 0],
    ["creation_state", "text", 1, 0],
    ["created_at", "text", 1, 0],
    ["activated_at", "text", 0, 0],
  ]),
  ...tableColumns("storage_registrations", [
    ["storage_id", "text", 1, 1],
    ["project_id", "text", 1, 0],
    ["active_generation_id", "text", 0, 0],
    ["active_location_id", "text", 0, 0],
    ["created_at", "text", 1, 0],
    ["activated_at", "text", 0, 0],
  ]),
];

const canonicalColumns: readonly ColumnSpec[] = [
  ...tableColumns("schema_metadata", schemaMetadataColumnDefinitions),
  ...tableColumns("project_state", [
    ["project_id", "text", 1, 1],
    ["last_project_sequence", "integer", 1, 0],
    ["last_writer_generation", "integer", 1, 0],
    ["created_at", "text", 1, 0],
    ["updated_at", "text", 1, 0],
  ]),
  ...tableColumns("storage_identity", [
    ["identity_key", "text", 1, 2],
    ["project_id", "text", 1, 1],
    ["storage_id", "text", 1, 0],
    ["generation_id", "text", 1, 0],
    ["canonical_database_lineage_id", "text", 1, 0],
    ["created_at", "text", 1, 0],
  ]),
  ...tableColumns("writer_generations", [
    ["project_id", "text", 1, 1],
    ["writer_generation", "integer", 1, 2],
    ["activation_id", "text", 1, 0],
    ["token_digest", "text", 1, 0],
    ["acquired_at", "text", 1, 0],
    ["released_at", "text", 0, 0],
  ]),
  ...tableColumns("writer_fence", [
    ["project_id", "text", 1, 1],
    ["writer_generation", "integer", 1, 0],
    ["token_digest", "text", 1, 0],
    ["state", "text", 1, 0],
    ["activated_at", "text", 1, 0],
    ["released_at", "text", 0, 0],
  ]),
  ...tableColumns("writer_handoffs", [
    ["project_id", "text", 1, 1],
    ["handoff_id", "text", 1, 2],
    ["from_writer_generation", "integer", 0, 0],
    ["to_writer_generation", "integer", 1, 0],
    ["kind", "text", 1, 0],
    ["recorded_at", "text", 1, 0],
  ]),
  ...tableColumns("writer_recovery_records", [
    ["project_id", "text", 1, 1],
    ["recovery_record_id", "text", 1, 2],
    ["writer_generation", "integer", 1, 0],
    ["reason", "text", 1, 0],
    ["command_id", "text", 0, 0],
    ["command_fingerprint", "text", 0, 0],
    ["observed_at", "text", 1, 0],
    ["resolution", "text", 0, 0],
    ["resolved_by_writer_generation", "integer", 0, 0],
    ["resolved_at", "text", 0, 0],
  ]),
  ...tableColumns("command_receipts", [
    ["project_id", "text", 1, 1],
    ["receipt_id", "text", 1, 2],
    ["command_id", "text", 1, 0],
    ["command_type", "text", 1, 0],
    ["command_version", "integer", 1, 0],
    ["command_fingerprint", "text", 1, 0],
    ["outcome", "text", 1, 0],
    ["project_sequence", "integer", 1, 0],
    ["writer_generation", "integer", 1, 0],
    ["settled_at", "text", 1, 0],
  ]),
  ...tableColumns("command_idempotency", [
    ["project_id", "text", 1, 1],
    ["command_id", "text", 1, 2],
    ["original_command_fingerprint", "text", 1, 0],
    ["original_receipt_id", "text", 1, 0],
    ["created_at", "text", 1, 0],
  ]),
  ...tableColumns("command_rejections", [
    ["project_id", "text", 1, 1],
    ["receipt_id", "text", 1, 2],
    ["receipt_outcome", "text", 1, 0],
    ["project_sequence", "integer", 1, 0],
    ["rejection_code", "text", 1, 0],
    ["retryable", "integer", 1, 0],
    ["details_json", "text", 1, 0],
    ["details_hash", "text", 1, 0],
  ]),
  ...tableColumns("canonical_events", [
    ["project_id", "text", 1, 1],
    ["event_id", "text", 1, 2],
    ["receipt_id", "text", 1, 0],
    ["receipt_outcome", "text", 1, 0],
    ["project_sequence", "integer", 1, 0],
    ["event_ordinal", "integer", 1, 0],
    ["aggregate_type", "text", 1, 0],
    ["aggregate_id", "text", 1, 0],
    ["aggregate_version", "integer", 1, 0],
    ["event_type", "text", 1, 0],
    ["event_version", "integer", 1, 0],
    ["payload_json", "text", 1, 0],
    ["payload_hash", "text", 1, 0],
    ["occurred_at", "text", 1, 0],
  ]),
];

const runtimeColumns: readonly ColumnSpec[] = [
  ...tableColumns("slopstop_runtime_schema_metadata", schemaMetadataColumnDefinitions),
  ...tableColumns("slopstop_runtime_storage_identity", [
    ["identity_key", "text", 1, 1],
    ["project_id", "text", 1, 0],
    ["storage_id", "text", 1, 0],
    ["generation_id", "text", 1, 0],
    ["runtime_database_lineage_id", "text", 1, 0],
    ["created_at", "text", 1, 0],
  ]),
];

const applicationChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "schema_metadata",
    "application_metadata_key",
    `${column("schema_metadata", "metadata_key")} = 'application'`,
  ),
  namedCheck(
    "schema_metadata",
    "application_metadata_kind",
    `${column("schema_metadata", "database_kind")} = 'application'`,
  ),
  namedCheck(
    "schema_metadata",
    "application_format_nonnegative",
    `${column("schema_metadata", "format_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "application_schema_nonnegative",
    `${column("schema_metadata", "schema_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "application_migration_nonempty",
    `length(trim(${column("schema_metadata", "last_migration_id")})) > 0`,
  ),
  identityCheck("storage_locations", "storage_locations_storage_id_uuid", "storage_id"),
  identityCheck("storage_locations", "storage_locations_location_id_uuid", "location_id"),
  namedCheck(
    "storage_locations",
    "storage_locations_state",
    `${column("storage_locations", "location_state")} in ('staging', 'committed')`,
  ),
  identityCheck("storage_generations", "storage_generations_storage_id_uuid", "storage_id"),
  identityCheck("storage_generations", "storage_generations_generation_id_uuid", "generation_id"),
  identityCheck("storage_generations", "storage_generations_project_id_uuid", "project_id"),
  identityCheck("storage_generations", "storage_generations_location_id_uuid", "location_id"),
  identityCheck(
    "storage_generations",
    "storage_generations_canonical_lineage_uuid",
    "canonical_lineage_id",
  ),
  identityCheck(
    "storage_generations",
    "storage_generations_runtime_lineage_uuid",
    "runtime_lineage_id",
  ),
  identityCheck(
    "storage_generations",
    "storage_generations_create_request_uuid",
    "create_request_id",
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_fingerprint_sha256",
    `
      length(${column("storage_generations", "create_request_fingerprint")}) = 64
      and ${column("storage_generations", "create_request_fingerprint")} = lower(${column("storage_generations", "create_request_fingerprint")})
      and ${column("storage_generations", "create_request_fingerprint")} not glob '*[^0-9a-f]*'
    `,
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_directory_identity",
    `${column("storage_generations", "generation_directory_name")} = ${column("storage_generations", "generation_id")}`,
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_activation_time",
    `
      (${column("storage_generations", "creation_state")} = 'active' and ${column("storage_generations", "activated_at")} is not null)
      or (${column("storage_generations", "creation_state")} = 'staging' and ${column("storage_generations", "activated_at")} is null)
    `,
  ),
  identityCheck("storage_registrations", "storage_registrations_storage_id_uuid", "storage_id"),
  identityCheck("storage_registrations", "storage_registrations_project_id_uuid", "project_id"),
  namedCheck(
    "storage_registrations",
    "storage_registrations_active_pair",
    `
      (
        ${column("storage_registrations", "active_generation_id")} is null
        and ${column("storage_registrations", "active_location_id")} is null
        and ${column("storage_registrations", "activated_at")} is null
      )
      or (
        ${column("storage_registrations", "active_generation_id")} is not null
        and ${column("storage_registrations", "active_location_id")} is not null
        and ${column("storage_registrations", "activated_at")} is not null
      )
    `,
  ),
];

const canonicalChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "schema_metadata",
    "canonical_metadata_key",
    `${column("schema_metadata", "metadata_key")} = 'canonical'`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_metadata_kind",
    `${column("schema_metadata", "database_kind")} = 'canonical'`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_format_nonnegative",
    `${column("schema_metadata", "format_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_schema_nonnegative",
    `${column("schema_metadata", "schema_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_migration_nonempty",
    nonemptyTextExpression("schema_metadata", "last_migration_id"),
  ),
  identityCheck("project_state", "project_state_project_uuid", "project_id"),
  namedCheck(
    "project_state",
    "project_state_sequence_nonnegative_safe",
    nonnegativeSafeIntegerExpression("project_state", "last_project_sequence"),
  ),
  namedCheck(
    "project_state",
    "project_state_writer_generation_nonnegative_safe",
    nonnegativeSafeIntegerExpression("project_state", "last_writer_generation"),
  ),
  namedCheck(
    "storage_identity",
    "canonical_identity_singleton",
    `${column("storage_identity", "identity_key")} = 'storage'`,
  ),
  identityCheck("storage_identity", "canonical_identity_project_uuid", "project_id"),
  identityCheck("storage_identity", "canonical_identity_storage_uuid", "storage_id"),
  identityCheck("storage_identity", "canonical_identity_generation_uuid", "generation_id"),
  identityCheck(
    "storage_identity",
    "canonical_identity_lineage_uuid",
    "canonical_database_lineage_id",
  ),
  namedCheck(
    "writer_generations",
    "writer_generations_generation_positive_safe",
    positiveSafeIntegerExpression("writer_generations", "writer_generation"),
  ),
  identityCheck("writer_generations", "writer_generations_activation_uuid", "activation_id"),
  namedCheck(
    "writer_generations",
    "writer_generations_token_sha256",
    sha256Expression("writer_generations", "token_digest"),
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_generation_positive_safe",
    positiveSafeIntegerExpression("writer_fence", "writer_generation"),
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_token_sha256",
    sha256Expression("writer_fence", "token_digest"),
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_state",
    `${column("writer_fence", "state")} in ('active', 'released')`,
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_release_shape",
    `
        (${column("writer_fence", "state")} = 'active' and ${column("writer_fence", "released_at")} is null)
        or (${column("writer_fence", "state")} = 'released' and ${column("writer_fence", "released_at")} is not null)
      `,
  ),
  identityCheck("writer_handoffs", "writer_handoffs_id_uuid", "handoff_id"),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_from_generation_positive_safe",
    `${column("writer_handoffs", "from_writer_generation")} is null or (${positiveSafeIntegerExpression("writer_handoffs", "from_writer_generation")})`,
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_to_generation_positive_safe",
    positiveSafeIntegerExpression("writer_handoffs", "to_writer_generation"),
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_kind",
    `${column("writer_handoffs", "kind")} in ('initial', 'clean', 'recovery')`,
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_predecessor_shape",
    `
        (${column("writer_handoffs", "kind")} = 'initial' and ${column("writer_handoffs", "from_writer_generation")} is null)
        or (${column("writer_handoffs", "kind")} in ('clean', 'recovery') and ${column("writer_handoffs", "from_writer_generation")} is not null)
      `,
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_generation_order",
    `${column("writer_handoffs", "from_writer_generation")} is null or ${column("writer_handoffs", "to_writer_generation")} > ${column("writer_handoffs", "from_writer_generation")}`,
  ),
  identityCheck(
    "writer_recovery_records",
    "writer_recovery_records_id_uuid",
    "recovery_record_id",
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_generation_positive_safe",
    positiveSafeIntegerExpression("writer_recovery_records", "writer_generation"),
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_reason",
    `${column("writer_recovery_records", "reason")} in ('commit-uncertain', 'abandoned-active-fence')`,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_command_uuid",
    `${column("writer_recovery_records", "command_id")} is null or (${identityExpression("writer_recovery_records", "command_id")})`,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_fingerprint_sha256",
    `${column("writer_recovery_records", "command_fingerprint")} is null or (${sha256Expression("writer_recovery_records", "command_fingerprint")})`,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_command_shape",
    `
        (
          ${column("writer_recovery_records", "reason")} = 'commit-uncertain'
          and ${column("writer_recovery_records", "command_id")} is not null
          and ${column("writer_recovery_records", "command_fingerprint")} is not null
        )
        or (
          ${column("writer_recovery_records", "reason")} = 'abandoned-active-fence'
          and ${column("writer_recovery_records", "command_id")} is null
          and ${column("writer_recovery_records", "command_fingerprint")} is null
        )
      `,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_resolution",
    `
        ${column("writer_recovery_records", "resolution")} is null
        or (
          ${column("writer_recovery_records", "reason")} = 'commit-uncertain'
          and ${column("writer_recovery_records", "resolution")} in ('receipt-found', 'receipt-absent')
        )
        or (
          ${column("writer_recovery_records", "reason")} = 'abandoned-active-fence'
          and ${column("writer_recovery_records", "resolution")} = 'generation-superseded'
        )
      `,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_resolution_shape",
    `
        (
          ${column("writer_recovery_records", "resolution")} is null
          and ${column("writer_recovery_records", "resolved_by_writer_generation")} is null
          and ${column("writer_recovery_records", "resolved_at")} is null
        )
        or (
          ${column("writer_recovery_records", "resolution")} is not null
          and ${column("writer_recovery_records", "resolved_by_writer_generation")} is not null
          and ${column("writer_recovery_records", "resolved_at")} is not null
        )
      `,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_resolver_order",
    `
        ${column("writer_recovery_records", "resolved_by_writer_generation")} is null
        or (
          ${positiveSafeIntegerExpression("writer_recovery_records", "resolved_by_writer_generation")}
          and ${column("writer_recovery_records", "resolved_by_writer_generation")} > ${column("writer_recovery_records", "writer_generation")}
        )
      `,
  ),
  identityCheck("command_receipts", "command_receipts_id_uuid", "receipt_id"),
  identityCheck("command_receipts", "command_receipts_command_uuid", "command_id"),
  namedCheck(
    "command_receipts",
    "command_receipts_type_nonempty",
    nonemptyTextExpression("command_receipts", "command_type"),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_version_positive_safe",
    positiveSafeIntegerExpression("command_receipts", "command_version"),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_fingerprint_sha256",
    sha256Expression("command_receipts", "command_fingerprint"),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_outcome",
    `${column("command_receipts", "outcome")} in ('applied', 'unchanged', 'rejected')`,
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_sequence_positive_safe",
    positiveSafeIntegerExpression("command_receipts", "project_sequence"),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_writer_generation_positive_safe",
    positiveSafeIntegerExpression("command_receipts", "writer_generation"),
  ),
  identityCheck("command_idempotency", "command_idempotency_command_uuid", "command_id"),
  namedCheck(
    "command_idempotency",
    "command_idempotency_fingerprint_sha256",
    sha256Expression("command_idempotency", "original_command_fingerprint"),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_outcome",
    `${column("command_rejections", "receipt_outcome")} = 'rejected'`,
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_sequence_positive_safe",
    positiveSafeIntegerExpression("command_rejections", "project_sequence"),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_code_nonempty",
    nonemptyTextExpression("command_rejections", "rejection_code"),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_retryable_boolean",
    `${column("command_rejections", "retryable")} in (0, 1)`,
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_details_nonempty",
    nonemptyTextExpression("command_rejections", "details_json"),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_details_sha256",
    sha256Expression("command_rejections", "details_hash"),
  ),
  identityCheck("canonical_events", "canonical_events_id_uuid", "event_id"),
  namedCheck(
    "canonical_events",
    "canonical_events_outcome",
    `${column("canonical_events", "receipt_outcome")} = 'applied'`,
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_sequence_positive_safe",
    positiveSafeIntegerExpression("canonical_events", "project_sequence"),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_ordinal_nonnegative_safe",
    nonnegativeSafeIntegerExpression("canonical_events", "event_ordinal"),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_aggregate_type_nonempty",
    nonemptyTextExpression("canonical_events", "aggregate_type"),
  ),
  identityCheck("canonical_events", "canonical_events_aggregate_id_uuid", "aggregate_id"),
  namedCheck(
    "canonical_events",
    "canonical_events_aggregate_version_positive_safe",
    positiveSafeIntegerExpression("canonical_events", "aggregate_version"),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_type_nonempty",
    nonemptyTextExpression("canonical_events", "event_type"),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_version_positive_safe",
    positiveSafeIntegerExpression("canonical_events", "event_version"),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_payload_nonempty",
    nonemptyTextExpression("canonical_events", "payload_json"),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_payload_sha256",
    sha256Expression("canonical_events", "payload_hash"),
  ),
];

const runtimeChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_metadata_key",
    `${column("slopstop_runtime_schema_metadata", "metadata_key")} = 'slopstop-runtime-adapter'`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_metadata_kind",
    `${column("slopstop_runtime_schema_metadata", "database_kind")} = 'runtime-adapter'`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_format_nonnegative",
    `${column("slopstop_runtime_schema_metadata", "format_version")} >= 0`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_schema_nonnegative",
    `${column("slopstop_runtime_schema_metadata", "schema_version")} >= 0`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_migration_nonempty",
    `length(trim(${column("slopstop_runtime_schema_metadata", "last_migration_id")})) > 0`,
  ),
  namedCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_singleton",
    `${column("slopstop_runtime_storage_identity", "identity_key")} = 'storage'`,
  ),
  identityCheck("slopstop_runtime_storage_identity", "runtime_identity_project_uuid", "project_id"),
  identityCheck("slopstop_runtime_storage_identity", "runtime_identity_storage_uuid", "storage_id"),
  identityCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_generation_uuid",
    "generation_id",
  ),
  identityCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_lineage_uuid",
    "runtime_database_lineage_id",
  ),
];

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
    columns: applicationColumns,
    checks: applicationChecks,
    indexes: [
      {
        table: "storage_locations",
        name: "storage_locations_normalized_path_uq",
        unique: true,
        partial: false,
        columns: ["normalized_path"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_create_request_uq",
        unique: true,
        partial: false,
        columns: ["create_request_id"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_directory_uq",
        unique: true,
        partial: false,
        columns: ["storage_id", "generation_directory_name"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_one_active_uq",
        unique: true,
        partial: true,
        columns: ["storage_id"],
        predicate: `${column("storage_generations", "creation_state")} = 'active'`,
      },
      {
        table: "storage_generations",
        name: "storage_generations_project_idx",
        unique: false,
        partial: false,
        columns: ["project_id"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_state_idx",
        unique: false,
        partial: false,
        columns: ["storage_id", "creation_state"],
        predicate: null,
      },
      {
        table: "storage_registrations",
        name: "storage_registrations_project_uq",
        unique: true,
        partial: false,
        columns: ["project_id"],
        predicate: null,
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
    schemaVersion: 2,
    tables: [
      "canonical_events",
      "command_idempotency",
      "command_receipts",
      "command_rejections",
      "project_state",
      "schema_metadata",
      "storage_identity",
      "writer_fence",
      "writer_generations",
      "writer_handoffs",
      "writer_recovery_records",
    ],
    columns: canonicalColumns,
    checks: canonicalChecks,
    indexes: [
      {
        table: "canonical_events",
        name: "canonical_events_sequence_ordinal_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "project_sequence", "event_ordinal"],
        predicate: null,
      },
      {
        table: "canonical_events",
        name: "canonical_events_receipt_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "receipt_id"],
        predicate: null,
      },
      {
        table: "canonical_events",
        name: "canonical_events_aggregate_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "aggregate_type", "aggregate_id", "aggregate_version"],
        predicate: null,
      },
      {
        table: "command_idempotency",
        name: "command_idempotency_receipt_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "original_receipt_id"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_command_fingerprint_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "command_id", "command_fingerprint"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_project_sequence_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "project_sequence"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_idempotency_binding_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "receipt_id", "command_id", "command_fingerprint"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_settlement_binding_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "receipt_id", "outcome", "project_sequence"],
        predicate: null,
      },
      {
        table: "writer_generations",
        name: "writer_generations_activation_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "activation_id"],
        predicate: null,
      },
      {
        table: "writer_generations",
        name: "writer_generations_fence_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "writer_generation", "token_digest"],
        predicate: null,
      },
      {
        table: "writer_handoffs",
        name: "writer_handoffs_to_generation_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "to_writer_generation"],
        predicate: null,
      },
      {
        table: "writer_handoffs",
        name: "writer_handoffs_from_generation_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "from_writer_generation"],
        predicate: null,
      },
      {
        table: "writer_recovery_records",
        name: "writer_recovery_records_generation_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "writer_generation"],
        predicate: null,
      },
      {
        table: "writer_recovery_records",
        name: "writer_recovery_records_unresolved_uq",
        unique: true,
        partial: true,
        columns: ["project_id"],
        predicate: `${column("writer_recovery_records", "resolution")} is null`,
      },
      {
        table: "writer_recovery_records",
        name: "writer_recovery_records_command_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "command_id"],
        predicate: null,
      },
    ],
    foreignKeys: [
      {
        table: "canonical_events",
        columns: ["project_id", "receipt_id", "receipt_outcome", "project_sequence"],
        referencedTable: "command_receipts",
        referencedColumns: ["project_id", "receipt_id", "outcome", "project_sequence"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "command_idempotency",
        columns: [
          "project_id",
          "original_receipt_id",
          "command_id",
          "original_command_fingerprint",
        ],
        referencedTable: "command_receipts",
        referencedColumns: ["project_id", "receipt_id", "command_id", "command_fingerprint"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "command_receipts",
        columns: ["project_id", "writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "command_rejections",
        columns: ["project_id", "receipt_id", "receipt_outcome", "project_sequence"],
        referencedTable: "command_receipts",
        referencedColumns: ["project_id", "receipt_id", "outcome", "project_sequence"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "storage_identity",
        columns: ["project_id"],
        referencedTable: "project_state",
        referencedColumns: ["project_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_fence",
        columns: ["project_id", "writer_generation", "token_digest"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation", "token_digest"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_generations",
        columns: ["project_id"],
        referencedTable: "project_state",
        referencedColumns: ["project_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_handoffs",
        columns: ["project_id", "from_writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_handoffs",
        columns: ["project_id", "to_writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_recovery_records",
        columns: ["project_id", "writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_recovery_records",
        columns: ["project_id", "resolved_by_writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  },
  runtime: {
    resourceKind: "runtime",
    databaseKind: "runtime-adapter",
    metadataTable: "slopstop_runtime_schema_metadata",
    metadataKey: "slopstop-runtime-adapter",
    formatVersion: 1,
    schemaVersion: 1,
    tables: ["slopstop_runtime_schema_metadata", "slopstop_runtime_storage_identity"],
    columns: runtimeColumns,
    checks: runtimeChecks,
    indexes: [],
    foreignKeys: [],
  },
} as const satisfies Record<MigrationResourceKind, DatabaseSpec>;
```

### apps/harness/src/storage/database-schema-verifier.ts - MODIFY
Verify exact ordered column definitions in addition to the existing table, CHECK, named-index, foreign-key, and forbidden-object authority.

```ts
import type { InArgs, InStatement } from "@libsql/client";
import { z } from "zod";
import type {
  ColumnSpec,
  DatabaseSpec,
  ForeignKeySpec,
  NamedCheckSpec,
  NamedIndexSpec,
} from "./project-storage-database-specs.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { canonicalizeSqliteSchemaExpression } from "./sqlite-schema-expression.js";
import {
  isUnquotedSqliteKeyword,
  readBalancedSqliteExpression,
  scanSqliteSchemaTokens,
} from "./sqlite-schema-scanner.js";

type SchemaResultSet = Readonly<{
  columns: readonly string[];
  rows: readonly ArrayLike<unknown>[];
  rowsAffected: number;
}>;

type SchemaExecutor = Readonly<{
  execute(statement: InStatement | string, args?: InArgs): Promise<SchemaResultSet>;
}>;

type MutableIndex = {
  table: string;
  name: string;
  unique: boolean;
  partial: boolean;
  columns: Array<string | null>;
  predicate: string | null;
};

type ObservedForeignKey = Readonly<{
  table: string;
  columns: readonly string[];
  referencedTable: string;
  referencedColumns: readonly string[];
  onUpdate: string;
  onDelete: string;
  match: string;
}>;

type MutableForeignKey = {
  table: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onUpdate: string;
  onDelete: string;
  match: string;
};

const sqlIntegerSchema = z
  .union([z.number().int(), z.bigint()])
  .transform((value) => Number(value))
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const sqlBooleanIntegerSchema = sqlIntegerSchema.refine((value) => value === 0 || value === 1);
const tableNameRowSchema = z.strictObject({ name: z.string().min(1) });
const tableSqlRowSchema = z.strictObject({
  tableName: z.string().min(1),
  sql: z.string().min(1),
});
const columnMetadataRowSchema = z.strictObject({
  cid: sqlIntegerSchema,
  name: z.string().min(1),
  type: z.string(),
  notNull: sqlBooleanIntegerSchema,
  defaultValue: z.string().nullable(),
  primaryKey: sqlIntegerSchema,
  hidden: sqlIntegerSchema,
});
const indexMetadataRowSchema = z.strictObject({
  name: z.string().min(1),
  isUnique: sqlBooleanIntegerSchema,
  partial: sqlBooleanIntegerSchema,
  sequence: sqlIntegerSchema,
  columnName: z.string().nullable(),
  indexSql: z.string().min(1),
});
const foreignKeyMetadataRowSchema = z.strictObject({
  id: sqlIntegerSchema,
  sequence: sqlIntegerSchema,
  referencedTable: z.string().min(1),
  columnName: z.string().min(1),
  referencedColumn: z.string().min(1),
  onUpdate: z.string().min(1),
  onDelete: z.string().min(1),
  match: z.string().min(1),
});

function resultObjects(result: SchemaResultSet): unknown[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}

function equalStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export async function tableNames(client: SchemaExecutor): Promise<readonly string[]> {
  const result = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return tableNameRowSchema
    .array()
    .parse(resultObjects(result))
    .map((row) => row.name);
}

async function requireNoForbiddenSchemaObjects(client: SchemaExecutor): Promise<void> {
  const result = await client.execute(
    "SELECT name FROM sqlite_schema WHERE type IN ('trigger', 'view') ORDER BY type, name",
  );
  if (tableNameRowSchema.array().parse(resultObjects(result)).length > 0) {
    throw new ProjectStorageBrokenError("Database contains a forbidden schema object.");
  }
}

function requireExactObjectKeys(
  actual: readonly string[],
  expected: readonly string[],
  missingMessage: string,
  unexpectedMessage: string,
): void {
  const counts = (keys: readonly string[]): ReadonlyMap<string, number> => {
    const result = new Map<string, number>();
    for (const key of keys) result.set(key, (result.get(key) ?? 0) + 1);
    return result;
  };
  const actualCounts = counts(actual);
  const expectedCounts = counts(expected);
  if (expected.some((key) => (actualCounts.get(key) ?? 0) < (expectedCounts.get(key) ?? 0))) {
    throw new ProjectStorageBrokenError(missingMessage);
  }
  if (actual.some((key) => (actualCounts.get(key) ?? 0) > (expectedCounts.get(key) ?? 0))) {
    throw new ProjectStorageBrokenError(unexpectedMessage);
  }
}

function invalidExpression(): never {
  throw new ProjectStorageBrokenError("Database schema expression is invalid.");
}

function unexpectedCheck(): never {
  throw new ProjectStorageBrokenError("Database contains an unexpected CHECK constraint.");
}

function requireConstraintPrefix(input: {
  constraint: ReturnType<typeof scanSqliteSchemaTokens>[number] | undefined;
  depth: number;
}): void {
  if (input.constraint === undefined) unexpectedCheck();
  if (!isUnquotedSqliteKeyword({ token: input.constraint, keyword: "constraint" })) {
    unexpectedCheck();
  }
}

function requireCheckName(input: {
  name: ReturnType<typeof scanSqliteSchemaTokens>[number] | undefined;
  depth: number;
}): asserts input is {
  name: ReturnType<typeof scanSqliteSchemaTokens>[number];
  depth: number;
} {
  if (input.name?.kind !== "identifier") return unexpectedCheck();
  if (input.name.depth !== input.depth) return unexpectedCheck();
}

function requireCheckOpening(input: {
  opening: ReturnType<typeof scanSqliteSchemaTokens>[number] | undefined;
  depth: number;
}): asserts input is {
  opening: ReturnType<typeof scanSqliteSchemaTokens>[number];
  depth: number;
} {
  if (input.opening?.kind !== "punctuation") return unexpectedCheck();
  if (input.opening.value !== "(") return unexpectedCheck();
  if (input.opening.depth !== input.depth) return unexpectedCheck();
}

function namedCheckAt(input: {
  definition: z.infer<typeof tableSqlRowSchema>;
  tokens: ReturnType<typeof scanSqliteSchemaTokens>;
  index: number;
}): Readonly<{ check: NamedCheckSpec; end: number }> | undefined {
  const token = input.tokens[input.index];
  if (token === undefined || !isUnquotedSqliteKeyword({ token, keyword: "check" })) {
    return undefined;
  }
  const constraint = input.tokens[input.index - 2];
  const name = input.tokens[input.index - 1];
  const opening = input.tokens[input.index + 1];
  requireConstraintPrefix({ constraint, depth: token.depth });
  const named = { name, depth: token.depth };
  requireCheckName(named);
  const opened = { opening, depth: token.depth };
  requireCheckOpening(opened);
  const extracted = readBalancedSqliteExpression({
    source: input.definition.sql,
    bodyStart: opened.opening.end,
  });
  return {
    check: {
      table: input.definition.tableName,
      name: named.name.value,
      expression: extracted.expression,
    },
    end: extracted.end,
  };
}

function tokenIndexAtOrAfter(input: {
  tokens: ReturnType<typeof scanSqliteSchemaTokens>;
  start: number;
  position: number;
}): number {
  let index = input.start;
  while (true) {
    const token = input.tokens[index];
    if (token === undefined || token.start >= input.position) return index;
    index += 1;
  }
}

function checksFromDefinition(definition: z.infer<typeof tableSqlRowSchema>): NamedCheckSpec[] {
  const checks: NamedCheckSpec[] = [];
  const tokens = scanSqliteSchemaTokens({ source: definition.sql });
  let index = 0;
  while (index < tokens.length) {
    const namedCheck = namedCheckAt({ definition, tokens, index });
    if (namedCheck === undefined) {
      index += 1;
      continue;
    }
    checks.push(namedCheck.check);
    index = tokenIndexAtOrAfter({ tokens, start: index + 1, position: namedCheck.end });
  }
  return checks;
}

async function readNamedChecks(client: SchemaExecutor): Promise<readonly NamedCheckSpec[]> {
  const result = await client.execute(
    "SELECT name AS tableName, sql FROM sqlite_schema " +
      "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return tableSqlRowSchema
    .array()
    .parse(resultObjects(result))
    .flatMap((definition) => checksFromDefinition(definition));
}

async function readDeclaredTableDefinitions(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly z.infer<typeof tableSqlRowSchema>[]> {
  const definitions = await Promise.all(
    tables.map(async (table) => {
      const result = await client.execute({
        sql: "SELECT name AS tableName, sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
        args: [table],
      });
      return tableSqlRowSchema.array().parse(resultObjects(result));
    }),
  );
  return definitions.flat();
}

async function requireNoForbiddenSchemaObjectsForTables(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<void> {
  for (const table of tables) {
    const result = await client.execute({
      sql: "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ? COLLATE NOCASE ORDER BY name",
      args: [table],
    });
    if (tableNameRowSchema.array().parse(resultObjects(result)).length > 0) {
      throw new ProjectStorageBrokenError("Database contains a forbidden schema object.");
    }
  }
}

async function readColumns(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly ColumnSpec[]> {
  const columns: ColumnSpec[] = [];
  for (const table of tables) {
    const rows = columnMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
           sql: `SELECT cid, name, type, "notnull" AS "notNull",
            dflt_value AS defaultValue, pk AS primaryKey, hidden
            FROM pragma_table_xinfo(?) ORDER BY cid`,
          args: [table],
        }),
      ),
    );
    columns.push(...rows.map((row) => ({ table, ...row })));
  }
  return columns;
}

function topLevelWhere(source: string): number | undefined {
  return scanSqliteSchemaTokens({ source }).find(
    (token) => token.depth === 0 && isUnquotedSqliteKeyword({ token, keyword: "where" }),
  )?.end;
}

function indexPredicate(indexSql: string, partial: boolean): string | null {
  const predicateStart = topLevelWhere(indexSql);
  if (!partial) {
    if (predicateStart !== undefined) return invalidExpression();
    return null;
  }
  if (predicateStart === undefined) return invalidExpression();
  const predicate = indexSql.slice(predicateStart).trim();
  if (predicate.length === 0) return invalidExpression();
  canonicalizeSqliteSchemaExpression(predicate);
  return predicate;
}

async function readIndexes(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly MutableIndex[]> {
  const indexes: MutableIndex[] = [];
  for (const table of tables) {
    const rows = indexMetadataRowSchema.array().parse(
      resultObjects(
        await client.execute({
          sql: `SELECT il.name AS name, il."unique" AS isUnique,
            il.partial AS partial, ii.seqno AS sequence, ii.name AS columnName,
            schema_object.sql AS indexSql
            FROM pragma_index_list(?) AS il
            JOIN pragma_index_xinfo(il.name) AS ii ON ii."key" = 1
            JOIN sqlite_schema AS schema_object
              ON schema_object.type = 'index'
              AND schema_object.name = il.name
              AND schema_object.tbl_name = ?
            WHERE il.origin = 'c' ORDER BY il.name, ii.seqno`,
          args: [table, table],
        }),
      ),
    );
    for (const row of rows) {
      const partial = row.partial === 1;
      const predicate = indexPredicate(row.indexSql, partial);
      const current = indexes.at(-1);
      if (current !== undefined && current.table === table && current.name === row.name) {
        if (
          current.unique !== (row.isUnique === 1) ||
          current.partial !== partial ||
          current.predicate !== predicate
        ) {
          throw new ProjectStorageBrokenError("Database named index metadata is inconsistent.");
        }
        current.columns.push(row.columnName);
      } else {
        indexes.push({
          table,
          name: row.name,
          unique: row.isUnique === 1,
          partial,
          columns: [row.columnName],
          predicate,
        });
      }
    }
  }
  return indexes;
}

async function readForeignKeys(
  client: SchemaExecutor,
  tables: readonly string[],
): Promise<readonly ObservedForeignKey[]> {
  const foreignKeys: MutableForeignKey[] = [];
  for (const table of tables) {
    const rows = foreignKeyMetadataRowSchema.array().parse(
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
    for (const row of rows) {
      const current = foreignKeys.at(-1);
      if (current !== undefined && previousId === row.id) {
        current.columns.push(row.columnName);
        current.referencedColumns.push(row.referencedColumn);
      } else {
        foreignKeys.push({
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
  return foreignKeys;
}

function expressionIdentity(expression: string): string {
  return JSON.stringify(canonicalizeSqliteSchemaExpression(expression));
}

function columnKey(columnSpec: ColumnSpec): string {
  return JSON.stringify([
    columnSpec.table,
    columnSpec.cid,
    columnSpec.name,
    columnSpec.type,
    columnSpec.notNull,
    columnSpec.defaultValue,
    columnSpec.primaryKey,
    columnSpec.hidden,
  ]);
}

function checkKey(check: NamedCheckSpec): string {
  return JSON.stringify([check.table, check.name, expressionIdentity(check.expression)]);
}

function indexKey(indexSpec: NamedIndexSpec | MutableIndex): string {
  return JSON.stringify([
    indexSpec.table,
    indexSpec.name,
    indexSpec.unique,
    indexSpec.partial,
    indexSpec.columns,
    indexSpec.predicate === null ? null : expressionIdentity(indexSpec.predicate),
  ]);
}

function foreignKeyKey(foreignKey: ForeignKeySpec | ObservedForeignKey): string {
  return JSON.stringify([
    foreignKey.table,
    foreignKey.columns,
    foreignKey.referencedTable,
    foreignKey.referencedColumns,
    foreignKey.onUpdate,
    foreignKey.onDelete,
    foreignKey.match,
  ]);
}

async function verifyDeclaredSchemaObjects(
  client: SchemaExecutor,
  spec: DatabaseSpec,
): Promise<void> {
  await requireNoForbiddenSchemaObjects(client);
  const actualTables = [...(await tableNames(client))].sort((left, right) =>
    left.localeCompare(right),
  );
  const expectedTables = [...spec.tables].sort((left, right) => left.localeCompare(right));
  if (!equalStrings(actualTables, expectedTables)) {
    throw new ProjectStorageBrokenError("Database contains an unexpected table set.");
  }
  const [columns, checks, indexes, foreignKeys] = await Promise.all([
    readColumns(client, spec.tables),
    readNamedChecks(client),
    readIndexes(client, spec.tables),
    readForeignKeys(client, spec.tables),
  ]);
  requireExpectedSchemaObjects({ columns, checks, indexes, foreignKeys, spec });
}

function requireExpectedSchemaObjects(input: {
  columns: readonly ColumnSpec[];
  checks: readonly NamedCheckSpec[];
  indexes: readonly MutableIndex[];
  foreignKeys: readonly ObservedForeignKey[];
  spec: DatabaseSpec;
}): void {
  requireExactObjectKeys(
    input.columns.map(columnKey),
    input.spec.columns.map(columnKey),
    "Database required column definition is missing.",
    "Database contains an unexpected column definition.",
  );
  requireExactObjectKeys(
    input.checks.map(checkKey),
    input.spec.checks.map(checkKey),
    "Database required CHECK constraint is missing.",
    "Database contains an unexpected CHECK constraint.",
  );
  requireExactObjectKeys(
    input.indexes.map(indexKey),
    input.spec.indexes.map(indexKey),
    "Database required named index is missing.",
    "Database contains an unexpected named index.",
  );
  requireExactObjectKeys(
    input.foreignKeys.map(foreignKeyKey),
    input.spec.foreignKeys.map(foreignKeyKey),
    "Database required foreign key is missing.",
    "Database contains an unexpected foreign key.",
  );
}

async function verifyOwnedSchemaObjects(client: SchemaExecutor, spec: DatabaseSpec): Promise<void> {
  await requireNoForbiddenSchemaObjectsForTables(client, spec.tables);
  const definitions = await readDeclaredTableDefinitions(client, spec.tables);
  const actualTables = definitions.map((definition) => definition.tableName).sort();
  const expectedTables = [...spec.tables].sort((left, right) => left.localeCompare(right));
  if (!equalStrings(actualTables, expectedTables)) {
    throw new ProjectStorageBrokenError("Database required table is missing.");
  }
  const [columns, indexes, foreignKeys] = await Promise.all([
    readColumns(client, spec.tables),
    readIndexes(client, spec.tables),
    readForeignKeys(client, spec.tables),
  ]);
  requireExpectedSchemaObjects({
    columns,
    checks: definitions.flatMap((definition) => checksFromDefinition(definition)),
    indexes,
    foreignKeys,
    spec,
  });
}

async function requireVerifiedSchemaObjects(verify: () => Promise<void>): Promise<void> {
  try {
    await verify();
  } catch (error) {
    if (error instanceof ProjectStorageBrokenError) throw error;
    throw new ProjectStorageBrokenError("Database schema authority is invalid.", { cause: error });
  }
}

export async function requireDeclaredSchemaObjects(
  client: SchemaExecutor,
  spec: DatabaseSpec,
): Promise<void> {
  return requireVerifiedSchemaObjects(() => verifyDeclaredSchemaObjects(client, spec));
}

export async function requireOwnedSchemaObjects(
  client: SchemaExecutor,
  spec: DatabaseSpec,
): Promise<void> {
  return requireVerifiedSchemaObjects(() => verifyOwnedSchemaObjects(client, spec));
}
```

### apps/harness/src/storage/generated-migration-resources.ts - MODIFY

Authorize only the approved canonical format-1/schema-2 migration pair, without a general rebuild parser or temporary-table namespace exemption. Preserve existing path, file, journal, resource, SQL, forbidden-object, implicit-ledger, and unknown-table checks and their diagnostic precedence. Reserve only the exact `__new_storage_identity` CREATE as a pending canonical candidate; it grants no authority before the complete validation below.

For canonical schema 2 or any reserved rebuild candidate, require exactly the ordered IDs `0000_fat_doctor_octopus` and `0001_canonical_project_writer`, canonical database/resource kind, metadata table/key, and format 1/schema 2. The predecessor raw-source SHA-256 must be `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`. Hash `JSON.stringify(statements)` using the loader's existing breakpoint split, trim, and empty-fragment removal; the complete successor vector must hash to `e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14`. This vector contains exactly 30 statements; its last six are foreign-keys OFF, temporary CREATE, exact six-column INSERT/SELECT, original DROP, temporary RENAME, and foreign-keys ON. The pin comes from this reviewed proposal, never from supplied resource metadata or regenerated current source.

Only after validation, omit the consumed temporary CREATE from the created-table set and retain exact equality with the final `spec.tables`. Never add the temporary name to the final schema. Fail malformed, missing, reordered, interleaved, duplicate, drop-only, rename-only, changed-definition/copy/target, or extra-use variants with `ProjectStorageBrokenError("Generated canonical storage identity rebuild is invalid.")`. Existing unknown-table, trigger/view, and implicit-ledger failures retain their original errors. No SQL is executed by the loader. Generation-1 and other database checks remain intact; future legitimate changes to this closed migration require explicit review of the pin.

### apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql - NEW

Freeze the complete generated successor SQL from the immediately following Architecture fence as independent loader-test input. Its normalized statement-vector hash is the pin above. It is not a production migration resource and must not be updated automatically from changed production code. The loader contract uses it before shared schema implementation; production SQL, journal, and snapshot are generated only after the shared schema behavior is Red.

### apps/harness/drizzle/canonical/0001_canonical_project_writer.sql - NEW
Apply the generated canonical Writer and settlement schema while preserving migration 0000 unchanged.

```sql
CREATE TABLE `canonical_events` (
	`project_id` text NOT NULL,
	`event_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`receipt_outcome` text NOT NULL,
	`project_sequence` integer NOT NULL,
	`event_ordinal` integer NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`aggregate_version` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_version` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `event_id`),
	FOREIGN KEY (`project_id`,`receipt_id`,`receipt_outcome`,`project_sequence`) REFERENCES `command_receipts`(`project_id`,`receipt_id`,`outcome`,`project_sequence`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "canonical_events_id_uuid" CHECK(
    length("canonical_events"."event_id") = 36
    and "canonical_events"."event_id" = lower("canonical_events"."event_id")
    and substr("canonical_events"."event_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 9, 1) = '-'
    and substr("canonical_events"."event_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 14, 1) = '-'
    and substr("canonical_events"."event_id", 15, 1) glob '[1-8]'
    and substr("canonical_events"."event_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 19, 1) = '-'
    and substr("canonical_events"."event_id", 20, 1) glob '[89ab]'
    and substr("canonical_events"."event_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."event_id", 24, 1) = '-'
    and substr("canonical_events"."event_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_events_outcome" CHECK("canonical_events"."receipt_outcome" = 'applied'),
	CONSTRAINT "canonical_events_sequence_positive_safe" CHECK(
    typeof("canonical_events"."project_sequence") = 'integer'
    and "canonical_events"."project_sequence" > 0
    and "canonical_events"."project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_ordinal_nonnegative_safe" CHECK(
    typeof("canonical_events"."event_ordinal") = 'integer'
    and "canonical_events"."event_ordinal" >= 0
    and "canonical_events"."event_ordinal" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_aggregate_type_nonempty" CHECK(length(trim("canonical_events"."aggregate_type")) > 0),
	CONSTRAINT "canonical_events_aggregate_id_uuid" CHECK(
    length("canonical_events"."aggregate_id") = 36
    and "canonical_events"."aggregate_id" = lower("canonical_events"."aggregate_id")
    and substr("canonical_events"."aggregate_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 9, 1) = '-'
    and substr("canonical_events"."aggregate_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 14, 1) = '-'
    and substr("canonical_events"."aggregate_id", 15, 1) glob '[1-8]'
    and substr("canonical_events"."aggregate_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 19, 1) = '-'
    and substr("canonical_events"."aggregate_id", 20, 1) glob '[89ab]'
    and substr("canonical_events"."aggregate_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("canonical_events"."aggregate_id", 24, 1) = '-'
    and substr("canonical_events"."aggregate_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_events_aggregate_version_positive_safe" CHECK(
    typeof("canonical_events"."aggregate_version") = 'integer'
    and "canonical_events"."aggregate_version" > 0
    and "canonical_events"."aggregate_version" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_type_nonempty" CHECK(length(trim("canonical_events"."event_type")) > 0),
	CONSTRAINT "canonical_events_version_positive_safe" CHECK(
    typeof("canonical_events"."event_version") = 'integer'
    and "canonical_events"."event_version" > 0
    and "canonical_events"."event_version" <= 9007199254740991
  ),
	CONSTRAINT "canonical_events_payload_nonempty" CHECK(length(trim("canonical_events"."payload_json")) > 0),
	CONSTRAINT "canonical_events_payload_sha256" CHECK(
    length("canonical_events"."payload_hash") = 64
    and "canonical_events"."payload_hash" = lower("canonical_events"."payload_hash")
    and "canonical_events"."payload_hash" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_events_sequence_ordinal_uq` ON `canonical_events` (`project_id`,`project_sequence`,`event_ordinal`);--> statement-breakpoint
CREATE INDEX `canonical_events_receipt_idx` ON `canonical_events` (`project_id`,`receipt_id`);--> statement-breakpoint
CREATE INDEX `canonical_events_aggregate_idx` ON `canonical_events` (`project_id`,`aggregate_type`,`aggregate_id`,`aggregate_version`);--> statement-breakpoint
CREATE TABLE `project_state` (
	`project_id` text PRIMARY KEY NOT NULL,
	`last_project_sequence` integer NOT NULL,
	`last_writer_generation` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "project_state_project_uuid" CHECK(
    length("project_state"."project_id") = 36
    and "project_state"."project_id" = lower("project_state"."project_id")
    and substr("project_state"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 9, 1) = '-'
    and substr("project_state"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 14, 1) = '-'
    and substr("project_state"."project_id", 15, 1) glob '[1-8]'
    and substr("project_state"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 19, 1) = '-'
    and substr("project_state"."project_id", 20, 1) glob '[89ab]'
    and substr("project_state"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("project_state"."project_id", 24, 1) = '-'
    and substr("project_state"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "project_state_sequence_nonnegative_safe" CHECK(
    typeof("project_state"."last_project_sequence") = 'integer'
    and "project_state"."last_project_sequence" >= 0
    and "project_state"."last_project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "project_state_writer_generation_nonnegative_safe" CHECK(
    typeof("project_state"."last_writer_generation") = 'integer'
    and "project_state"."last_writer_generation" >= 0
    and "project_state"."last_writer_generation" <= 9007199254740991
  )
);
--> statement-breakpoint
CREATE TABLE `command_idempotency` (
	`project_id` text NOT NULL,
	`command_id` text NOT NULL,
	`original_command_fingerprint` text NOT NULL,
	`original_receipt_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `command_id`),
	FOREIGN KEY (`project_id`,`original_receipt_id`,`command_id`,`original_command_fingerprint`) REFERENCES `command_receipts`(`project_id`,`receipt_id`,`command_id`,`command_fingerprint`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "command_idempotency_command_uuid" CHECK(
    length("command_idempotency"."command_id") = 36
    and "command_idempotency"."command_id" = lower("command_idempotency"."command_id")
    and substr("command_idempotency"."command_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 9, 1) = '-'
    and substr("command_idempotency"."command_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 14, 1) = '-'
    and substr("command_idempotency"."command_id", 15, 1) glob '[1-8]'
    and substr("command_idempotency"."command_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 19, 1) = '-'
    and substr("command_idempotency"."command_id", 20, 1) glob '[89ab]'
    and substr("command_idempotency"."command_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("command_idempotency"."command_id", 24, 1) = '-'
    and substr("command_idempotency"."command_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_idempotency_fingerprint_sha256" CHECK(
    length("command_idempotency"."original_command_fingerprint") = 64
    and "command_idempotency"."original_command_fingerprint" = lower("command_idempotency"."original_command_fingerprint")
    and "command_idempotency"."original_command_fingerprint" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `command_idempotency_receipt_uq` ON `command_idempotency` (`project_id`,`original_receipt_id`);--> statement-breakpoint
CREATE TABLE `command_receipts` (
	`project_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`command_id` text NOT NULL,
	`command_type` text NOT NULL,
	`command_version` integer NOT NULL,
	`command_fingerprint` text NOT NULL,
	`outcome` text NOT NULL,
	`project_sequence` integer NOT NULL,
	`writer_generation` integer NOT NULL,
	`settled_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `receipt_id`),
	FOREIGN KEY (`project_id`,`writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "command_receipts_id_uuid" CHECK(
    length("command_receipts"."receipt_id") = 36
    and "command_receipts"."receipt_id" = lower("command_receipts"."receipt_id")
    and substr("command_receipts"."receipt_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 9, 1) = '-'
    and substr("command_receipts"."receipt_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 14, 1) = '-'
    and substr("command_receipts"."receipt_id", 15, 1) glob '[1-8]'
    and substr("command_receipts"."receipt_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 19, 1) = '-'
    and substr("command_receipts"."receipt_id", 20, 1) glob '[89ab]'
    and substr("command_receipts"."receipt_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."receipt_id", 24, 1) = '-'
    and substr("command_receipts"."receipt_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_receipts_command_uuid" CHECK(
    length("command_receipts"."command_id") = 36
    and "command_receipts"."command_id" = lower("command_receipts"."command_id")
    and substr("command_receipts"."command_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 9, 1) = '-'
    and substr("command_receipts"."command_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 14, 1) = '-'
    and substr("command_receipts"."command_id", 15, 1) glob '[1-8]'
    and substr("command_receipts"."command_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 19, 1) = '-'
    and substr("command_receipts"."command_id", 20, 1) glob '[89ab]'
    and substr("command_receipts"."command_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("command_receipts"."command_id", 24, 1) = '-'
    and substr("command_receipts"."command_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_receipts_type_nonempty" CHECK(length(trim("command_receipts"."command_type")) > 0),
	CONSTRAINT "command_receipts_version_positive_safe" CHECK(
    typeof("command_receipts"."command_version") = 'integer'
    and "command_receipts"."command_version" > 0
    and "command_receipts"."command_version" <= 9007199254740991
  ),
	CONSTRAINT "command_receipts_fingerprint_sha256" CHECK(
    length("command_receipts"."command_fingerprint") = 64
    and "command_receipts"."command_fingerprint" = lower("command_receipts"."command_fingerprint")
    and "command_receipts"."command_fingerprint" not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "command_receipts_outcome" CHECK("command_receipts"."outcome" in ('applied', 'unchanged', 'rejected')),
	CONSTRAINT "command_receipts_sequence_positive_safe" CHECK(
    typeof("command_receipts"."project_sequence") = 'integer'
    and "command_receipts"."project_sequence" > 0
    and "command_receipts"."project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "command_receipts_writer_generation_positive_safe" CHECK(
    typeof("command_receipts"."writer_generation") = 'integer'
    and "command_receipts"."writer_generation" > 0
    and "command_receipts"."writer_generation" <= 9007199254740991
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_command_fingerprint_uq` ON `command_receipts` (`project_id`,`command_id`,`command_fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_project_sequence_uq` ON `command_receipts` (`project_id`,`project_sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_idempotency_binding_uq` ON `command_receipts` (`project_id`,`receipt_id`,`command_id`,`command_fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `command_receipts_settlement_binding_uq` ON `command_receipts` (`project_id`,`receipt_id`,`outcome`,`project_sequence`);--> statement-breakpoint
CREATE TABLE `command_rejections` (
	`project_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`receipt_outcome` text NOT NULL,
	`project_sequence` integer NOT NULL,
	`rejection_code` text NOT NULL,
	`retryable` integer NOT NULL,
	`details_json` text NOT NULL,
	`details_hash` text NOT NULL,
	PRIMARY KEY(`project_id`, `receipt_id`),
	FOREIGN KEY (`project_id`,`receipt_id`,`receipt_outcome`,`project_sequence`) REFERENCES `command_receipts`(`project_id`,`receipt_id`,`outcome`,`project_sequence`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "command_rejections_outcome" CHECK("command_rejections"."receipt_outcome" = 'rejected'),
	CONSTRAINT "command_rejections_sequence_positive_safe" CHECK(
    typeof("command_rejections"."project_sequence") = 'integer'
    and "command_rejections"."project_sequence" > 0
    and "command_rejections"."project_sequence" <= 9007199254740991
  ),
	CONSTRAINT "command_rejections_code_nonempty" CHECK(length(trim("command_rejections"."rejection_code")) > 0),
	CONSTRAINT "command_rejections_retryable_boolean" CHECK("command_rejections"."retryable" in (0, 1)),
	CONSTRAINT "command_rejections_details_nonempty" CHECK(length(trim("command_rejections"."details_json")) > 0),
	CONSTRAINT "command_rejections_details_sha256" CHECK(
    length("command_rejections"."details_hash") = 64
    and "command_rejections"."details_hash" = lower("command_rejections"."details_hash")
    and "command_rejections"."details_hash" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE TABLE `writer_fence` (
	`project_id` text PRIMARY KEY NOT NULL,
	`writer_generation` integer NOT NULL,
	`token_digest` text NOT NULL,
	`state` text NOT NULL,
	`activated_at` text NOT NULL,
	`released_at` text,
	FOREIGN KEY (`project_id`,`writer_generation`,`token_digest`) REFERENCES `writer_generations`(`project_id`,`writer_generation`,`token_digest`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_fence_generation_positive_safe" CHECK(
    typeof("writer_fence"."writer_generation") = 'integer'
    and "writer_fence"."writer_generation" > 0
    and "writer_fence"."writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_fence_token_sha256" CHECK(
    length("writer_fence"."token_digest") = 64
    and "writer_fence"."token_digest" = lower("writer_fence"."token_digest")
    and "writer_fence"."token_digest" not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_fence_state" CHECK("writer_fence"."state" in ('active', 'released')),
	CONSTRAINT "writer_fence_release_shape" CHECK(
        ("writer_fence"."state" = 'active' and "writer_fence"."released_at" is null)
        or ("writer_fence"."state" = 'released' and "writer_fence"."released_at" is not null)
      )
);
--> statement-breakpoint
CREATE TABLE `writer_generations` (
	`project_id` text NOT NULL,
	`writer_generation` integer NOT NULL,
	`activation_id` text NOT NULL,
	`token_digest` text NOT NULL,
	`acquired_at` text NOT NULL,
	`released_at` text,
	PRIMARY KEY(`project_id`, `writer_generation`),
	FOREIGN KEY (`project_id`) REFERENCES `project_state`(`project_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_generations_generation_positive_safe" CHECK(
    typeof("writer_generations"."writer_generation") = 'integer'
    and "writer_generations"."writer_generation" > 0
    and "writer_generations"."writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_generations_activation_uuid" CHECK(
    length("writer_generations"."activation_id") = 36
    and "writer_generations"."activation_id" = lower("writer_generations"."activation_id")
    and substr("writer_generations"."activation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 9, 1) = '-'
    and substr("writer_generations"."activation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 14, 1) = '-'
    and substr("writer_generations"."activation_id", 15, 1) glob '[1-8]'
    and substr("writer_generations"."activation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 19, 1) = '-'
    and substr("writer_generations"."activation_id", 20, 1) glob '[89ab]'
    and substr("writer_generations"."activation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_generations"."activation_id", 24, 1) = '-'
    and substr("writer_generations"."activation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_generations_token_sha256" CHECK(
    length("writer_generations"."token_digest") = 64
    and "writer_generations"."token_digest" = lower("writer_generations"."token_digest")
    and "writer_generations"."token_digest" not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writer_generations_activation_uq` ON `writer_generations` (`project_id`,`activation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `writer_generations_fence_uq` ON `writer_generations` (`project_id`,`writer_generation`,`token_digest`);--> statement-breakpoint
CREATE TABLE `writer_handoffs` (
	`project_id` text NOT NULL,
	`handoff_id` text NOT NULL,
	`from_writer_generation` integer,
	`to_writer_generation` integer NOT NULL,
	`kind` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `handoff_id`),
	FOREIGN KEY (`project_id`,`from_writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`,`to_writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_handoffs_id_uuid" CHECK(
    length("writer_handoffs"."handoff_id") = 36
    and "writer_handoffs"."handoff_id" = lower("writer_handoffs"."handoff_id")
    and substr("writer_handoffs"."handoff_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 9, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 14, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 15, 1) glob '[1-8]'
    and substr("writer_handoffs"."handoff_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 19, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 20, 1) glob '[89ab]'
    and substr("writer_handoffs"."handoff_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_handoffs"."handoff_id", 24, 1) = '-'
    and substr("writer_handoffs"."handoff_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_handoffs_from_generation_positive_safe" CHECK("writer_handoffs"."from_writer_generation" is null or (
    typeof("writer_handoffs"."from_writer_generation") = 'integer'
    and "writer_handoffs"."from_writer_generation" > 0
    and "writer_handoffs"."from_writer_generation" <= 9007199254740991
  )),
	CONSTRAINT "writer_handoffs_to_generation_positive_safe" CHECK(
    typeof("writer_handoffs"."to_writer_generation") = 'integer'
    and "writer_handoffs"."to_writer_generation" > 0
    and "writer_handoffs"."to_writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_handoffs_kind" CHECK("writer_handoffs"."kind" in ('initial', 'clean', 'recovery')),
	CONSTRAINT "writer_handoffs_predecessor_shape" CHECK(
        ("writer_handoffs"."kind" = 'initial' and "writer_handoffs"."from_writer_generation" is null)
        or ("writer_handoffs"."kind" in ('clean', 'recovery') and "writer_handoffs"."from_writer_generation" is not null)
      ),
	CONSTRAINT "writer_handoffs_generation_order" CHECK("writer_handoffs"."from_writer_generation" is null or "writer_handoffs"."to_writer_generation" > "writer_handoffs"."from_writer_generation")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writer_handoffs_to_generation_uq` ON `writer_handoffs` (`project_id`,`to_writer_generation`);--> statement-breakpoint
CREATE INDEX `writer_handoffs_from_generation_idx` ON `writer_handoffs` (`project_id`,`from_writer_generation`);--> statement-breakpoint
CREATE TABLE `writer_recovery_records` (
	`project_id` text NOT NULL,
	`recovery_record_id` text NOT NULL,
	`writer_generation` integer NOT NULL,
	`reason` text NOT NULL,
	`command_id` text,
	`command_fingerprint` text,
	`observed_at` text NOT NULL,
	`resolution` text,
	`resolved_by_writer_generation` integer,
	`resolved_at` text,
	PRIMARY KEY(`project_id`, `recovery_record_id`),
	FOREIGN KEY (`project_id`,`writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`,`resolved_by_writer_generation`) REFERENCES `writer_generations`(`project_id`,`writer_generation`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "writer_recovery_records_id_uuid" CHECK(
    length("writer_recovery_records"."recovery_record_id") = 36
    and "writer_recovery_records"."recovery_record_id" = lower("writer_recovery_records"."recovery_record_id")
    and substr("writer_recovery_records"."recovery_record_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 9, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 14, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 15, 1) glob '[1-8]'
    and substr("writer_recovery_records"."recovery_record_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 19, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 20, 1) glob '[89ab]'
    and substr("writer_recovery_records"."recovery_record_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."recovery_record_id", 24, 1) = '-'
    and substr("writer_recovery_records"."recovery_record_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "writer_recovery_records_generation_positive_safe" CHECK(
    typeof("writer_recovery_records"."writer_generation") = 'integer'
    and "writer_recovery_records"."writer_generation" > 0
    and "writer_recovery_records"."writer_generation" <= 9007199254740991
  ),
	CONSTRAINT "writer_recovery_records_reason" CHECK("writer_recovery_records"."reason" in ('commit-uncertain', 'abandoned-active-fence')),
	CONSTRAINT "writer_recovery_records_command_uuid" CHECK("writer_recovery_records"."command_id" is null or (
    length("writer_recovery_records"."command_id") = 36
    and "writer_recovery_records"."command_id" = lower("writer_recovery_records"."command_id")
    and substr("writer_recovery_records"."command_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 9, 1) = '-'
    and substr("writer_recovery_records"."command_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 14, 1) = '-'
    and substr("writer_recovery_records"."command_id", 15, 1) glob '[1-8]'
    and substr("writer_recovery_records"."command_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 19, 1) = '-'
    and substr("writer_recovery_records"."command_id", 20, 1) glob '[89ab]'
    and substr("writer_recovery_records"."command_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("writer_recovery_records"."command_id", 24, 1) = '-'
    and substr("writer_recovery_records"."command_id", 25, 12) not glob '*[^0-9a-f]*'
  )),
	CONSTRAINT "writer_recovery_records_fingerprint_sha256" CHECK("writer_recovery_records"."command_fingerprint" is null or (
    length("writer_recovery_records"."command_fingerprint") = 64
    and "writer_recovery_records"."command_fingerprint" = lower("writer_recovery_records"."command_fingerprint")
    and "writer_recovery_records"."command_fingerprint" not glob '*[^0-9a-f]*'
  )),
	CONSTRAINT "writer_recovery_records_command_shape" CHECK(
        (
          "writer_recovery_records"."reason" = 'commit-uncertain'
          and "writer_recovery_records"."command_id" is not null
          and "writer_recovery_records"."command_fingerprint" is not null
        )
        or (
          "writer_recovery_records"."reason" = 'abandoned-active-fence'
          and "writer_recovery_records"."command_id" is null
          and "writer_recovery_records"."command_fingerprint" is null
        )
      ),
	CONSTRAINT "writer_recovery_records_resolution" CHECK(
        "writer_recovery_records"."resolution" is null
        or (
          "writer_recovery_records"."reason" = 'commit-uncertain'
          and "writer_recovery_records"."resolution" in ('receipt-found', 'receipt-absent')
        )
        or (
          "writer_recovery_records"."reason" = 'abandoned-active-fence'
          and "writer_recovery_records"."resolution" = 'generation-superseded'
        )
      ),
	CONSTRAINT "writer_recovery_records_resolution_shape" CHECK(
        (
          "writer_recovery_records"."resolution" is null
          and "writer_recovery_records"."resolved_by_writer_generation" is null
          and "writer_recovery_records"."resolved_at" is null
        )
        or (
          "writer_recovery_records"."resolution" is not null
          and "writer_recovery_records"."resolved_by_writer_generation" is not null
          and "writer_recovery_records"."resolved_at" is not null
        )
      ),
	CONSTRAINT "writer_recovery_records_resolver_order" CHECK(
        "writer_recovery_records"."resolved_by_writer_generation" is null
        or (
          
    typeof("writer_recovery_records"."resolved_by_writer_generation") = 'integer'
    and "writer_recovery_records"."resolved_by_writer_generation" > 0
    and "writer_recovery_records"."resolved_by_writer_generation" <= 9007199254740991
  
          and "writer_recovery_records"."resolved_by_writer_generation" > "writer_recovery_records"."writer_generation"
        )
      )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `writer_recovery_records_generation_uq` ON `writer_recovery_records` (`project_id`,`writer_generation`);--> statement-breakpoint
CREATE UNIQUE INDEX `writer_recovery_records_unresolved_uq` ON `writer_recovery_records` (`project_id`) WHERE "writer_recovery_records"."resolution" is null;--> statement-breakpoint
CREATE INDEX `writer_recovery_records_command_idx` ON `writer_recovery_records` (`project_id`,`command_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_storage_identity` (
	`identity_key` text NOT NULL,
	`project_id` text NOT NULL,
	`storage_id` text NOT NULL,
	`generation_id` text NOT NULL,
	`canonical_database_lineage_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `identity_key`),
	FOREIGN KEY (`project_id`) REFERENCES `project_state`(`project_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "canonical_identity_singleton" CHECK("__new_storage_identity"."identity_key" = 'storage'),
	CONSTRAINT "canonical_identity_project_uuid" CHECK(
    length("__new_storage_identity"."project_id") = 36
    and "__new_storage_identity"."project_id" = lower("__new_storage_identity"."project_id")
    and substr("__new_storage_identity"."project_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 9, 1) = '-'
    and substr("__new_storage_identity"."project_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 14, 1) = '-'
    and substr("__new_storage_identity"."project_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."project_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 19, 1) = '-'
    and substr("__new_storage_identity"."project_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."project_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."project_id", 24, 1) = '-'
    and substr("__new_storage_identity"."project_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_storage_uuid" CHECK(
    length("__new_storage_identity"."storage_id") = 36
    and "__new_storage_identity"."storage_id" = lower("__new_storage_identity"."storage_id")
    and substr("__new_storage_identity"."storage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 9, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 14, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."storage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 19, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."storage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."storage_id", 24, 1) = '-'
    and substr("__new_storage_identity"."storage_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_generation_uuid" CHECK(
    length("__new_storage_identity"."generation_id") = 36
    and "__new_storage_identity"."generation_id" = lower("__new_storage_identity"."generation_id")
    and substr("__new_storage_identity"."generation_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 9, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 14, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."generation_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 19, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."generation_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."generation_id", 24, 1) = '-'
    and substr("__new_storage_identity"."generation_id", 25, 12) not glob '*[^0-9a-f]*'
  ),
	CONSTRAINT "canonical_identity_lineage_uuid" CHECK(
    length("__new_storage_identity"."canonical_database_lineage_id") = 36
    and "__new_storage_identity"."canonical_database_lineage_id" = lower("__new_storage_identity"."canonical_database_lineage_id")
    and substr("__new_storage_identity"."canonical_database_lineage_id", 1, 8) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 9, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 10, 4) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 14, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 15, 1) glob '[1-8]'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 16, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 19, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 20, 1) glob '[89ab]'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 21, 3) not glob '*[^0-9a-f]*'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 24, 1) = '-'
    and substr("__new_storage_identity"."canonical_database_lineage_id", 25, 12) not glob '*[^0-9a-f]*'
  )
);
--> statement-breakpoint
INSERT INTO `__new_storage_identity`("identity_key", "project_id", "storage_id", "generation_id", "canonical_database_lineage_id", "created_at") SELECT "identity_key", "project_id", "storage_id", "generation_id", "canonical_database_lineage_id", "created_at" FROM `storage_identity`;--> statement-breakpoint
DROP TABLE `storage_identity`;--> statement-breakpoint
ALTER TABLE `__new_storage_identity` RENAME TO `storage_identity`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
```

### apps/harness/drizzle/canonical/meta/_journal.json:1-20 - MODIFY
Register the ordered canonical generation-2 migration.

```json
{
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "6",
      "when": 1788404225621,
      "tag": "0000_fat_doctor_octopus",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "6",
      "when": 1788545464395,
      "tag": "0001_canonical_project_writer",
      "breakpoints": true
    }
  ]
}
```

### apps/harness/drizzle/canonical/meta/0001_snapshot.json - NEW
Record Drizzle's generated canonical generation-2 schema snapshot.

```json
{
  "version": "6",
  "dialect": "sqlite",
  "id": "e1b60bea-e851-42ea-9112-dfb15f0431f1",
  "prevId": "eac61728-4dd5-4367-a639-9992bf1ef5cf",
  "tables": {
    "canonical_events": {
      "name": "canonical_events",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "event_id": {
          "name": "event_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "receipt_id": {
          "name": "receipt_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "receipt_outcome": {
          "name": "receipt_outcome",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "project_sequence": {
          "name": "project_sequence",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "event_ordinal": {
          "name": "event_ordinal",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "aggregate_type": {
          "name": "aggregate_type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "aggregate_id": {
          "name": "aggregate_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "aggregate_version": {
          "name": "aggregate_version",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "event_type": {
          "name": "event_type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "event_version": {
          "name": "event_version",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "payload_json": {
          "name": "payload_json",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "payload_hash": {
          "name": "payload_hash",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "occurred_at": {
          "name": "occurred_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {
        "canonical_events_sequence_ordinal_uq": {
          "name": "canonical_events_sequence_ordinal_uq",
          "columns": [
            "project_id",
            "project_sequence",
            "event_ordinal"
          ],
          "isUnique": true
        },
        "canonical_events_receipt_idx": {
          "name": "canonical_events_receipt_idx",
          "columns": [
            "project_id",
            "receipt_id"
          ],
          "isUnique": false
        },
        "canonical_events_aggregate_idx": {
          "name": "canonical_events_aggregate_idx",
          "columns": [
            "project_id",
            "aggregate_type",
            "aggregate_id",
            "aggregate_version"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {
        "canonical_events_receipt_fk": {
          "name": "canonical_events_receipt_fk",
          "tableFrom": "canonical_events",
          "tableTo": "command_receipts",
          "columnsFrom": [
            "project_id",
            "receipt_id",
            "receipt_outcome",
            "project_sequence"
          ],
          "columnsTo": [
            "project_id",
            "receipt_id",
            "outcome",
            "project_sequence"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "canonical_events_pk": {
          "columns": [
            "project_id",
            "event_id"
          ],
          "name": "canonical_events_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "canonical_events_id_uuid": {
          "name": "canonical_events_id_uuid",
          "value": "\n    length(\"canonical_events\".\"event_id\") = 36\n    and \"canonical_events\".\"event_id\" = lower(\"canonical_events\".\"event_id\")\n    and substr(\"canonical_events\".\"event_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"event_id\", 9, 1) = '-'\n    and substr(\"canonical_events\".\"event_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"event_id\", 14, 1) = '-'\n    and substr(\"canonical_events\".\"event_id\", 15, 1) glob '[1-8]'\n    and substr(\"canonical_events\".\"event_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"event_id\", 19, 1) = '-'\n    and substr(\"canonical_events\".\"event_id\", 20, 1) glob '[89ab]'\n    and substr(\"canonical_events\".\"event_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"event_id\", 24, 1) = '-'\n    and substr(\"canonical_events\".\"event_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "canonical_events_outcome": {
          "name": "canonical_events_outcome",
          "value": "\"canonical_events\".\"receipt_outcome\" = 'applied'"
        },
        "canonical_events_sequence_positive_safe": {
          "name": "canonical_events_sequence_positive_safe",
          "value": "\n    typeof(\"canonical_events\".\"project_sequence\") = 'integer'\n    and \"canonical_events\".\"project_sequence\" > 0\n    and \"canonical_events\".\"project_sequence\" <= 9007199254740991\n  "
        },
        "canonical_events_ordinal_nonnegative_safe": {
          "name": "canonical_events_ordinal_nonnegative_safe",
          "value": "\n    typeof(\"canonical_events\".\"event_ordinal\") = 'integer'\n    and \"canonical_events\".\"event_ordinal\" >= 0\n    and \"canonical_events\".\"event_ordinal\" <= 9007199254740991\n  "
        },
        "canonical_events_aggregate_type_nonempty": {
          "name": "canonical_events_aggregate_type_nonempty",
          "value": "length(trim(\"canonical_events\".\"aggregate_type\")) > 0"
        },
        "canonical_events_aggregate_id_uuid": {
          "name": "canonical_events_aggregate_id_uuid",
          "value": "\n    length(\"canonical_events\".\"aggregate_id\") = 36\n    and \"canonical_events\".\"aggregate_id\" = lower(\"canonical_events\".\"aggregate_id\")\n    and substr(\"canonical_events\".\"aggregate_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"aggregate_id\", 9, 1) = '-'\n    and substr(\"canonical_events\".\"aggregate_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"aggregate_id\", 14, 1) = '-'\n    and substr(\"canonical_events\".\"aggregate_id\", 15, 1) glob '[1-8]'\n    and substr(\"canonical_events\".\"aggregate_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"aggregate_id\", 19, 1) = '-'\n    and substr(\"canonical_events\".\"aggregate_id\", 20, 1) glob '[89ab]'\n    and substr(\"canonical_events\".\"aggregate_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"canonical_events\".\"aggregate_id\", 24, 1) = '-'\n    and substr(\"canonical_events\".\"aggregate_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "canonical_events_aggregate_version_positive_safe": {
          "name": "canonical_events_aggregate_version_positive_safe",
          "value": "\n    typeof(\"canonical_events\".\"aggregate_version\") = 'integer'\n    and \"canonical_events\".\"aggregate_version\" > 0\n    and \"canonical_events\".\"aggregate_version\" <= 9007199254740991\n  "
        },
        "canonical_events_type_nonempty": {
          "name": "canonical_events_type_nonempty",
          "value": "length(trim(\"canonical_events\".\"event_type\")) > 0"
        },
        "canonical_events_version_positive_safe": {
          "name": "canonical_events_version_positive_safe",
          "value": "\n    typeof(\"canonical_events\".\"event_version\") = 'integer'\n    and \"canonical_events\".\"event_version\" > 0\n    and \"canonical_events\".\"event_version\" <= 9007199254740991\n  "
        },
        "canonical_events_payload_nonempty": {
          "name": "canonical_events_payload_nonempty",
          "value": "length(trim(\"canonical_events\".\"payload_json\")) > 0"
        },
        "canonical_events_payload_sha256": {
          "name": "canonical_events_payload_sha256",
          "value": "\n    length(\"canonical_events\".\"payload_hash\") = 64\n    and \"canonical_events\".\"payload_hash\" = lower(\"canonical_events\".\"payload_hash\")\n    and \"canonical_events\".\"payload_hash\" not glob '*[^0-9a-f]*'\n  "
        }
      }
    },
    "project_state": {
      "name": "project_state",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "last_project_sequence": {
          "name": "last_project_sequence",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "last_writer_generation": {
          "name": "last_writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "created_at": {
          "name": "created_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "updated_at": {
          "name": "updated_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "project_state_project_uuid": {
          "name": "project_state_project_uuid",
          "value": "\n    length(\"project_state\".\"project_id\") = 36\n    and \"project_state\".\"project_id\" = lower(\"project_state\".\"project_id\")\n    and substr(\"project_state\".\"project_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"project_state\".\"project_id\", 9, 1) = '-'\n    and substr(\"project_state\".\"project_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"project_state\".\"project_id\", 14, 1) = '-'\n    and substr(\"project_state\".\"project_id\", 15, 1) glob '[1-8]'\n    and substr(\"project_state\".\"project_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"project_state\".\"project_id\", 19, 1) = '-'\n    and substr(\"project_state\".\"project_id\", 20, 1) glob '[89ab]'\n    and substr(\"project_state\".\"project_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"project_state\".\"project_id\", 24, 1) = '-'\n    and substr(\"project_state\".\"project_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "project_state_sequence_nonnegative_safe": {
          "name": "project_state_sequence_nonnegative_safe",
          "value": "\n    typeof(\"project_state\".\"last_project_sequence\") = 'integer'\n    and \"project_state\".\"last_project_sequence\" >= 0\n    and \"project_state\".\"last_project_sequence\" <= 9007199254740991\n  "
        },
        "project_state_writer_generation_nonnegative_safe": {
          "name": "project_state_writer_generation_nonnegative_safe",
          "value": "\n    typeof(\"project_state\".\"last_writer_generation\") = 'integer'\n    and \"project_state\".\"last_writer_generation\" >= 0\n    and \"project_state\".\"last_writer_generation\" <= 9007199254740991\n  "
        }
      }
    },
    "schema_metadata": {
      "name": "schema_metadata",
      "columns": {
        "metadata_key": {
          "name": "metadata_key",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "database_kind": {
          "name": "database_kind",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "format_version": {
          "name": "format_version",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "schema_version": {
          "name": "schema_version",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "last_migration_id": {
          "name": "last_migration_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {},
      "foreignKeys": {},
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "canonical_metadata_key": {
          "name": "canonical_metadata_key",
          "value": "\"schema_metadata\".\"metadata_key\" = 'canonical'"
        },
        "canonical_metadata_kind": {
          "name": "canonical_metadata_kind",
          "value": "\"schema_metadata\".\"database_kind\" = 'canonical'"
        },
        "canonical_format_nonnegative": {
          "name": "canonical_format_nonnegative",
          "value": "\"schema_metadata\".\"format_version\" >= 0"
        },
        "canonical_schema_nonnegative": {
          "name": "canonical_schema_nonnegative",
          "value": "\"schema_metadata\".\"schema_version\" >= 0"
        },
        "canonical_migration_nonempty": {
          "name": "canonical_migration_nonempty",
          "value": "length(trim(\"schema_metadata\".\"last_migration_id\")) > 0"
        }
      }
    },
    "storage_identity": {
      "name": "storage_identity",
      "columns": {
        "identity_key": {
          "name": "identity_key",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "storage_id": {
          "name": "storage_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "generation_id": {
          "name": "generation_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "canonical_database_lineage_id": {
          "name": "canonical_database_lineage_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "created_at": {
          "name": "created_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {},
      "foreignKeys": {
        "canonical_storage_identity_project_fk": {
          "name": "canonical_storage_identity_project_fk",
          "tableFrom": "storage_identity",
          "tableTo": "project_state",
          "columnsFrom": [
            "project_id"
          ],
          "columnsTo": [
            "project_id"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "canonical_storage_identity_pk": {
          "columns": [
            "project_id",
            "identity_key"
          ],
          "name": "canonical_storage_identity_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "canonical_identity_singleton": {
          "name": "canonical_identity_singleton",
          "value": "\"storage_identity\".\"identity_key\" = 'storage'"
        },
        "canonical_identity_project_uuid": {
          "name": "canonical_identity_project_uuid",
          "value": "\n    length(\"storage_identity\".\"project_id\") = 36\n    and \"storage_identity\".\"project_id\" = lower(\"storage_identity\".\"project_id\")\n    and substr(\"storage_identity\".\"project_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"project_id\", 9, 1) = '-'\n    and substr(\"storage_identity\".\"project_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"project_id\", 14, 1) = '-'\n    and substr(\"storage_identity\".\"project_id\", 15, 1) glob '[1-8]'\n    and substr(\"storage_identity\".\"project_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"project_id\", 19, 1) = '-'\n    and substr(\"storage_identity\".\"project_id\", 20, 1) glob '[89ab]'\n    and substr(\"storage_identity\".\"project_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"project_id\", 24, 1) = '-'\n    and substr(\"storage_identity\".\"project_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "canonical_identity_storage_uuid": {
          "name": "canonical_identity_storage_uuid",
          "value": "\n    length(\"storage_identity\".\"storage_id\") = 36\n    and \"storage_identity\".\"storage_id\" = lower(\"storage_identity\".\"storage_id\")\n    and substr(\"storage_identity\".\"storage_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"storage_id\", 9, 1) = '-'\n    and substr(\"storage_identity\".\"storage_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"storage_id\", 14, 1) = '-'\n    and substr(\"storage_identity\".\"storage_id\", 15, 1) glob '[1-8]'\n    and substr(\"storage_identity\".\"storage_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"storage_id\", 19, 1) = '-'\n    and substr(\"storage_identity\".\"storage_id\", 20, 1) glob '[89ab]'\n    and substr(\"storage_identity\".\"storage_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"storage_id\", 24, 1) = '-'\n    and substr(\"storage_identity\".\"storage_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "canonical_identity_generation_uuid": {
          "name": "canonical_identity_generation_uuid",
          "value": "\n    length(\"storage_identity\".\"generation_id\") = 36\n    and \"storage_identity\".\"generation_id\" = lower(\"storage_identity\".\"generation_id\")\n    and substr(\"storage_identity\".\"generation_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"generation_id\", 9, 1) = '-'\n    and substr(\"storage_identity\".\"generation_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"generation_id\", 14, 1) = '-'\n    and substr(\"storage_identity\".\"generation_id\", 15, 1) glob '[1-8]'\n    and substr(\"storage_identity\".\"generation_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"generation_id\", 19, 1) = '-'\n    and substr(\"storage_identity\".\"generation_id\", 20, 1) glob '[89ab]'\n    and substr(\"storage_identity\".\"generation_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"generation_id\", 24, 1) = '-'\n    and substr(\"storage_identity\".\"generation_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "canonical_identity_lineage_uuid": {
          "name": "canonical_identity_lineage_uuid",
          "value": "\n    length(\"storage_identity\".\"canonical_database_lineage_id\") = 36\n    and \"storage_identity\".\"canonical_database_lineage_id\" = lower(\"storage_identity\".\"canonical_database_lineage_id\")\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 9, 1) = '-'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 14, 1) = '-'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 15, 1) glob '[1-8]'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 19, 1) = '-'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 20, 1) glob '[89ab]'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 24, 1) = '-'\n    and substr(\"storage_identity\".\"canonical_database_lineage_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        }
      }
    },
    "command_idempotency": {
      "name": "command_idempotency",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "command_id": {
          "name": "command_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "original_command_fingerprint": {
          "name": "original_command_fingerprint",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "original_receipt_id": {
          "name": "original_receipt_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "created_at": {
          "name": "created_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {
        "command_idempotency_receipt_uq": {
          "name": "command_idempotency_receipt_uq",
          "columns": [
            "project_id",
            "original_receipt_id"
          ],
          "isUnique": true
        }
      },
      "foreignKeys": {
        "command_idempotency_receipt_fk": {
          "name": "command_idempotency_receipt_fk",
          "tableFrom": "command_idempotency",
          "tableTo": "command_receipts",
          "columnsFrom": [
            "project_id",
            "original_receipt_id",
            "command_id",
            "original_command_fingerprint"
          ],
          "columnsTo": [
            "project_id",
            "receipt_id",
            "command_id",
            "command_fingerprint"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "command_idempotency_pk": {
          "columns": [
            "project_id",
            "command_id"
          ],
          "name": "command_idempotency_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "command_idempotency_command_uuid": {
          "name": "command_idempotency_command_uuid",
          "value": "\n    length(\"command_idempotency\".\"command_id\") = 36\n    and \"command_idempotency\".\"command_id\" = lower(\"command_idempotency\".\"command_id\")\n    and substr(\"command_idempotency\".\"command_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"command_idempotency\".\"command_id\", 9, 1) = '-'\n    and substr(\"command_idempotency\".\"command_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"command_idempotency\".\"command_id\", 14, 1) = '-'\n    and substr(\"command_idempotency\".\"command_id\", 15, 1) glob '[1-8]'\n    and substr(\"command_idempotency\".\"command_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"command_idempotency\".\"command_id\", 19, 1) = '-'\n    and substr(\"command_idempotency\".\"command_id\", 20, 1) glob '[89ab]'\n    and substr(\"command_idempotency\".\"command_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"command_idempotency\".\"command_id\", 24, 1) = '-'\n    and substr(\"command_idempotency\".\"command_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "command_idempotency_fingerprint_sha256": {
          "name": "command_idempotency_fingerprint_sha256",
          "value": "\n    length(\"command_idempotency\".\"original_command_fingerprint\") = 64\n    and \"command_idempotency\".\"original_command_fingerprint\" = lower(\"command_idempotency\".\"original_command_fingerprint\")\n    and \"command_idempotency\".\"original_command_fingerprint\" not glob '*[^0-9a-f]*'\n  "
        }
      }
    },
    "command_receipts": {
      "name": "command_receipts",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "receipt_id": {
          "name": "receipt_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "command_id": {
          "name": "command_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "command_type": {
          "name": "command_type",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "command_version": {
          "name": "command_version",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "command_fingerprint": {
          "name": "command_fingerprint",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "outcome": {
          "name": "outcome",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "project_sequence": {
          "name": "project_sequence",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "writer_generation": {
          "name": "writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "settled_at": {
          "name": "settled_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {
        "command_receipts_command_fingerprint_uq": {
          "name": "command_receipts_command_fingerprint_uq",
          "columns": [
            "project_id",
            "command_id",
            "command_fingerprint"
          ],
          "isUnique": true
        },
        "command_receipts_project_sequence_uq": {
          "name": "command_receipts_project_sequence_uq",
          "columns": [
            "project_id",
            "project_sequence"
          ],
          "isUnique": true
        },
        "command_receipts_idempotency_binding_uq": {
          "name": "command_receipts_idempotency_binding_uq",
          "columns": [
            "project_id",
            "receipt_id",
            "command_id",
            "command_fingerprint"
          ],
          "isUnique": true
        },
        "command_receipts_settlement_binding_uq": {
          "name": "command_receipts_settlement_binding_uq",
          "columns": [
            "project_id",
            "receipt_id",
            "outcome",
            "project_sequence"
          ],
          "isUnique": true
        }
      },
      "foreignKeys": {
        "command_receipts_writer_generation_fk": {
          "name": "command_receipts_writer_generation_fk",
          "tableFrom": "command_receipts",
          "tableTo": "writer_generations",
          "columnsFrom": [
            "project_id",
            "writer_generation"
          ],
          "columnsTo": [
            "project_id",
            "writer_generation"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "command_receipts_pk": {
          "columns": [
            "project_id",
            "receipt_id"
          ],
          "name": "command_receipts_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "command_receipts_id_uuid": {
          "name": "command_receipts_id_uuid",
          "value": "\n    length(\"command_receipts\".\"receipt_id\") = 36\n    and \"command_receipts\".\"receipt_id\" = lower(\"command_receipts\".\"receipt_id\")\n    and substr(\"command_receipts\".\"receipt_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"receipt_id\", 9, 1) = '-'\n    and substr(\"command_receipts\".\"receipt_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"receipt_id\", 14, 1) = '-'\n    and substr(\"command_receipts\".\"receipt_id\", 15, 1) glob '[1-8]'\n    and substr(\"command_receipts\".\"receipt_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"receipt_id\", 19, 1) = '-'\n    and substr(\"command_receipts\".\"receipt_id\", 20, 1) glob '[89ab]'\n    and substr(\"command_receipts\".\"receipt_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"receipt_id\", 24, 1) = '-'\n    and substr(\"command_receipts\".\"receipt_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "command_receipts_command_uuid": {
          "name": "command_receipts_command_uuid",
          "value": "\n    length(\"command_receipts\".\"command_id\") = 36\n    and \"command_receipts\".\"command_id\" = lower(\"command_receipts\".\"command_id\")\n    and substr(\"command_receipts\".\"command_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"command_id\", 9, 1) = '-'\n    and substr(\"command_receipts\".\"command_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"command_id\", 14, 1) = '-'\n    and substr(\"command_receipts\".\"command_id\", 15, 1) glob '[1-8]'\n    and substr(\"command_receipts\".\"command_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"command_id\", 19, 1) = '-'\n    and substr(\"command_receipts\".\"command_id\", 20, 1) glob '[89ab]'\n    and substr(\"command_receipts\".\"command_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"command_receipts\".\"command_id\", 24, 1) = '-'\n    and substr(\"command_receipts\".\"command_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "command_receipts_type_nonempty": {
          "name": "command_receipts_type_nonempty",
          "value": "length(trim(\"command_receipts\".\"command_type\")) > 0"
        },
        "command_receipts_version_positive_safe": {
          "name": "command_receipts_version_positive_safe",
          "value": "\n    typeof(\"command_receipts\".\"command_version\") = 'integer'\n    and \"command_receipts\".\"command_version\" > 0\n    and \"command_receipts\".\"command_version\" <= 9007199254740991\n  "
        },
        "command_receipts_fingerprint_sha256": {
          "name": "command_receipts_fingerprint_sha256",
          "value": "\n    length(\"command_receipts\".\"command_fingerprint\") = 64\n    and \"command_receipts\".\"command_fingerprint\" = lower(\"command_receipts\".\"command_fingerprint\")\n    and \"command_receipts\".\"command_fingerprint\" not glob '*[^0-9a-f]*'\n  "
        },
        "command_receipts_outcome": {
          "name": "command_receipts_outcome",
          "value": "\"command_receipts\".\"outcome\" in ('applied', 'unchanged', 'rejected')"
        },
        "command_receipts_sequence_positive_safe": {
          "name": "command_receipts_sequence_positive_safe",
          "value": "\n    typeof(\"command_receipts\".\"project_sequence\") = 'integer'\n    and \"command_receipts\".\"project_sequence\" > 0\n    and \"command_receipts\".\"project_sequence\" <= 9007199254740991\n  "
        },
        "command_receipts_writer_generation_positive_safe": {
          "name": "command_receipts_writer_generation_positive_safe",
          "value": "\n    typeof(\"command_receipts\".\"writer_generation\") = 'integer'\n    and \"command_receipts\".\"writer_generation\" > 0\n    and \"command_receipts\".\"writer_generation\" <= 9007199254740991\n  "
        }
      }
    },
    "command_rejections": {
      "name": "command_rejections",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "receipt_id": {
          "name": "receipt_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "receipt_outcome": {
          "name": "receipt_outcome",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "project_sequence": {
          "name": "project_sequence",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "rejection_code": {
          "name": "rejection_code",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "retryable": {
          "name": "retryable",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "details_json": {
          "name": "details_json",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "details_hash": {
          "name": "details_hash",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {},
      "foreignKeys": {
        "command_rejections_receipt_fk": {
          "name": "command_rejections_receipt_fk",
          "tableFrom": "command_rejections",
          "tableTo": "command_receipts",
          "columnsFrom": [
            "project_id",
            "receipt_id",
            "receipt_outcome",
            "project_sequence"
          ],
          "columnsTo": [
            "project_id",
            "receipt_id",
            "outcome",
            "project_sequence"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "command_rejections_pk": {
          "columns": [
            "project_id",
            "receipt_id"
          ],
          "name": "command_rejections_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "command_rejections_outcome": {
          "name": "command_rejections_outcome",
          "value": "\"command_rejections\".\"receipt_outcome\" = 'rejected'"
        },
        "command_rejections_sequence_positive_safe": {
          "name": "command_rejections_sequence_positive_safe",
          "value": "\n    typeof(\"command_rejections\".\"project_sequence\") = 'integer'\n    and \"command_rejections\".\"project_sequence\" > 0\n    and \"command_rejections\".\"project_sequence\" <= 9007199254740991\n  "
        },
        "command_rejections_code_nonempty": {
          "name": "command_rejections_code_nonempty",
          "value": "length(trim(\"command_rejections\".\"rejection_code\")) > 0"
        },
        "command_rejections_retryable_boolean": {
          "name": "command_rejections_retryable_boolean",
          "value": "\"command_rejections\".\"retryable\" in (0, 1)"
        },
        "command_rejections_details_nonempty": {
          "name": "command_rejections_details_nonempty",
          "value": "length(trim(\"command_rejections\".\"details_json\")) > 0"
        },
        "command_rejections_details_sha256": {
          "name": "command_rejections_details_sha256",
          "value": "\n    length(\"command_rejections\".\"details_hash\") = 64\n    and \"command_rejections\".\"details_hash\" = lower(\"command_rejections\".\"details_hash\")\n    and \"command_rejections\".\"details_hash\" not glob '*[^0-9a-f]*'\n  "
        }
      }
    },
    "writer_fence": {
      "name": "writer_fence",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": true,
          "notNull": true,
          "autoincrement": false
        },
        "writer_generation": {
          "name": "writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "token_digest": {
          "name": "token_digest",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "state": {
          "name": "state",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "activated_at": {
          "name": "activated_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "released_at": {
          "name": "released_at",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        }
      },
      "indexes": {},
      "foreignKeys": {
        "writer_fence_generation_fk": {
          "name": "writer_fence_generation_fk",
          "tableFrom": "writer_fence",
          "tableTo": "writer_generations",
          "columnsFrom": [
            "project_id",
            "writer_generation",
            "token_digest"
          ],
          "columnsTo": [
            "project_id",
            "writer_generation",
            "token_digest"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {},
      "uniqueConstraints": {},
      "checkConstraints": {
        "writer_fence_generation_positive_safe": {
          "name": "writer_fence_generation_positive_safe",
          "value": "\n    typeof(\"writer_fence\".\"writer_generation\") = 'integer'\n    and \"writer_fence\".\"writer_generation\" > 0\n    and \"writer_fence\".\"writer_generation\" <= 9007199254740991\n  "
        },
        "writer_fence_token_sha256": {
          "name": "writer_fence_token_sha256",
          "value": "\n    length(\"writer_fence\".\"token_digest\") = 64\n    and \"writer_fence\".\"token_digest\" = lower(\"writer_fence\".\"token_digest\")\n    and \"writer_fence\".\"token_digest\" not glob '*[^0-9a-f]*'\n  "
        },
        "writer_fence_state": {
          "name": "writer_fence_state",
          "value": "\"writer_fence\".\"state\" in ('active', 'released')"
        },
        "writer_fence_release_shape": {
          "name": "writer_fence_release_shape",
          "value": "\n        (\"writer_fence\".\"state\" = 'active' and \"writer_fence\".\"released_at\" is null)\n        or (\"writer_fence\".\"state\" = 'released' and \"writer_fence\".\"released_at\" is not null)\n      "
        }
      }
    },
    "writer_generations": {
      "name": "writer_generations",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "writer_generation": {
          "name": "writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "activation_id": {
          "name": "activation_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "token_digest": {
          "name": "token_digest",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "acquired_at": {
          "name": "acquired_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "released_at": {
          "name": "released_at",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        }
      },
      "indexes": {
        "writer_generations_activation_uq": {
          "name": "writer_generations_activation_uq",
          "columns": [
            "project_id",
            "activation_id"
          ],
          "isUnique": true
        },
        "writer_generations_fence_uq": {
          "name": "writer_generations_fence_uq",
          "columns": [
            "project_id",
            "writer_generation",
            "token_digest"
          ],
          "isUnique": true
        }
      },
      "foreignKeys": {
        "writer_generations_project_fk": {
          "name": "writer_generations_project_fk",
          "tableFrom": "writer_generations",
          "tableTo": "project_state",
          "columnsFrom": [
            "project_id"
          ],
          "columnsTo": [
            "project_id"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "writer_generations_pk": {
          "columns": [
            "project_id",
            "writer_generation"
          ],
          "name": "writer_generations_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "writer_generations_generation_positive_safe": {
          "name": "writer_generations_generation_positive_safe",
          "value": "\n    typeof(\"writer_generations\".\"writer_generation\") = 'integer'\n    and \"writer_generations\".\"writer_generation\" > 0\n    and \"writer_generations\".\"writer_generation\" <= 9007199254740991\n  "
        },
        "writer_generations_activation_uuid": {
          "name": "writer_generations_activation_uuid",
          "value": "\n    length(\"writer_generations\".\"activation_id\") = 36\n    and \"writer_generations\".\"activation_id\" = lower(\"writer_generations\".\"activation_id\")\n    and substr(\"writer_generations\".\"activation_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"writer_generations\".\"activation_id\", 9, 1) = '-'\n    and substr(\"writer_generations\".\"activation_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"writer_generations\".\"activation_id\", 14, 1) = '-'\n    and substr(\"writer_generations\".\"activation_id\", 15, 1) glob '[1-8]'\n    and substr(\"writer_generations\".\"activation_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_generations\".\"activation_id\", 19, 1) = '-'\n    and substr(\"writer_generations\".\"activation_id\", 20, 1) glob '[89ab]'\n    and substr(\"writer_generations\".\"activation_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_generations\".\"activation_id\", 24, 1) = '-'\n    and substr(\"writer_generations\".\"activation_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "writer_generations_token_sha256": {
          "name": "writer_generations_token_sha256",
          "value": "\n    length(\"writer_generations\".\"token_digest\") = 64\n    and \"writer_generations\".\"token_digest\" = lower(\"writer_generations\".\"token_digest\")\n    and \"writer_generations\".\"token_digest\" not glob '*[^0-9a-f]*'\n  "
        }
      }
    },
    "writer_handoffs": {
      "name": "writer_handoffs",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "handoff_id": {
          "name": "handoff_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "from_writer_generation": {
          "name": "from_writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "to_writer_generation": {
          "name": "to_writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "kind": {
          "name": "kind",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "recorded_at": {
          "name": "recorded_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        }
      },
      "indexes": {
        "writer_handoffs_to_generation_uq": {
          "name": "writer_handoffs_to_generation_uq",
          "columns": [
            "project_id",
            "to_writer_generation"
          ],
          "isUnique": true
        },
        "writer_handoffs_from_generation_idx": {
          "name": "writer_handoffs_from_generation_idx",
          "columns": [
            "project_id",
            "from_writer_generation"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {
        "writer_handoffs_from_generation_fk": {
          "name": "writer_handoffs_from_generation_fk",
          "tableFrom": "writer_handoffs",
          "tableTo": "writer_generations",
          "columnsFrom": [
            "project_id",
            "from_writer_generation"
          ],
          "columnsTo": [
            "project_id",
            "writer_generation"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        },
        "writer_handoffs_to_generation_fk": {
          "name": "writer_handoffs_to_generation_fk",
          "tableFrom": "writer_handoffs",
          "tableTo": "writer_generations",
          "columnsFrom": [
            "project_id",
            "to_writer_generation"
          ],
          "columnsTo": [
            "project_id",
            "writer_generation"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "writer_handoffs_pk": {
          "columns": [
            "project_id",
            "handoff_id"
          ],
          "name": "writer_handoffs_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "writer_handoffs_id_uuid": {
          "name": "writer_handoffs_id_uuid",
          "value": "\n    length(\"writer_handoffs\".\"handoff_id\") = 36\n    and \"writer_handoffs\".\"handoff_id\" = lower(\"writer_handoffs\".\"handoff_id\")\n    and substr(\"writer_handoffs\".\"handoff_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"writer_handoffs\".\"handoff_id\", 9, 1) = '-'\n    and substr(\"writer_handoffs\".\"handoff_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"writer_handoffs\".\"handoff_id\", 14, 1) = '-'\n    and substr(\"writer_handoffs\".\"handoff_id\", 15, 1) glob '[1-8]'\n    and substr(\"writer_handoffs\".\"handoff_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_handoffs\".\"handoff_id\", 19, 1) = '-'\n    and substr(\"writer_handoffs\".\"handoff_id\", 20, 1) glob '[89ab]'\n    and substr(\"writer_handoffs\".\"handoff_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_handoffs\".\"handoff_id\", 24, 1) = '-'\n    and substr(\"writer_handoffs\".\"handoff_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "writer_handoffs_from_generation_positive_safe": {
          "name": "writer_handoffs_from_generation_positive_safe",
          "value": "\"writer_handoffs\".\"from_writer_generation\" is null or (\n    typeof(\"writer_handoffs\".\"from_writer_generation\") = 'integer'\n    and \"writer_handoffs\".\"from_writer_generation\" > 0\n    and \"writer_handoffs\".\"from_writer_generation\" <= 9007199254740991\n  )"
        },
        "writer_handoffs_to_generation_positive_safe": {
          "name": "writer_handoffs_to_generation_positive_safe",
          "value": "\n    typeof(\"writer_handoffs\".\"to_writer_generation\") = 'integer'\n    and \"writer_handoffs\".\"to_writer_generation\" > 0\n    and \"writer_handoffs\".\"to_writer_generation\" <= 9007199254740991\n  "
        },
        "writer_handoffs_kind": {
          "name": "writer_handoffs_kind",
          "value": "\"writer_handoffs\".\"kind\" in ('initial', 'clean', 'recovery')"
        },
        "writer_handoffs_predecessor_shape": {
          "name": "writer_handoffs_predecessor_shape",
          "value": "\n        (\"writer_handoffs\".\"kind\" = 'initial' and \"writer_handoffs\".\"from_writer_generation\" is null)\n        or (\"writer_handoffs\".\"kind\" in ('clean', 'recovery') and \"writer_handoffs\".\"from_writer_generation\" is not null)\n      "
        },
        "writer_handoffs_generation_order": {
          "name": "writer_handoffs_generation_order",
          "value": "\"writer_handoffs\".\"from_writer_generation\" is null or \"writer_handoffs\".\"to_writer_generation\" > \"writer_handoffs\".\"from_writer_generation\""
        }
      }
    },
    "writer_recovery_records": {
      "name": "writer_recovery_records",
      "columns": {
        "project_id": {
          "name": "project_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "recovery_record_id": {
          "name": "recovery_record_id",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "writer_generation": {
          "name": "writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "reason": {
          "name": "reason",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "command_id": {
          "name": "command_id",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "command_fingerprint": {
          "name": "command_fingerprint",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "observed_at": {
          "name": "observed_at",
          "type": "text",
          "primaryKey": false,
          "notNull": true,
          "autoincrement": false
        },
        "resolution": {
          "name": "resolution",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "resolved_by_writer_generation": {
          "name": "resolved_by_writer_generation",
          "type": "integer",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        },
        "resolved_at": {
          "name": "resolved_at",
          "type": "text",
          "primaryKey": false,
          "notNull": false,
          "autoincrement": false
        }
      },
      "indexes": {
        "writer_recovery_records_generation_uq": {
          "name": "writer_recovery_records_generation_uq",
          "columns": [
            "project_id",
            "writer_generation"
          ],
          "isUnique": true
        },
        "writer_recovery_records_unresolved_uq": {
          "name": "writer_recovery_records_unresolved_uq",
          "columns": [
            "project_id"
          ],
          "isUnique": true,
          "where": "\"writer_recovery_records\".\"resolution\" is null"
        },
        "writer_recovery_records_command_idx": {
          "name": "writer_recovery_records_command_idx",
          "columns": [
            "project_id",
            "command_id"
          ],
          "isUnique": false
        }
      },
      "foreignKeys": {
        "writer_recovery_records_generation_fk": {
          "name": "writer_recovery_records_generation_fk",
          "tableFrom": "writer_recovery_records",
          "tableTo": "writer_generations",
          "columnsFrom": [
            "project_id",
            "writer_generation"
          ],
          "columnsTo": [
            "project_id",
            "writer_generation"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        },
        "writer_recovery_records_resolver_fk": {
          "name": "writer_recovery_records_resolver_fk",
          "tableFrom": "writer_recovery_records",
          "tableTo": "writer_generations",
          "columnsFrom": [
            "project_id",
            "resolved_by_writer_generation"
          ],
          "columnsTo": [
            "project_id",
            "writer_generation"
          ],
          "onDelete": "restrict",
          "onUpdate": "no action"
        }
      },
      "compositePrimaryKeys": {
        "writer_recovery_records_pk": {
          "columns": [
            "project_id",
            "recovery_record_id"
          ],
          "name": "writer_recovery_records_pk"
        }
      },
      "uniqueConstraints": {},
      "checkConstraints": {
        "writer_recovery_records_id_uuid": {
          "name": "writer_recovery_records_id_uuid",
          "value": "\n    length(\"writer_recovery_records\".\"recovery_record_id\") = 36\n    and \"writer_recovery_records\".\"recovery_record_id\" = lower(\"writer_recovery_records\".\"recovery_record_id\")\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 9, 1) = '-'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 14, 1) = '-'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 15, 1) glob '[1-8]'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 19, 1) = '-'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 20, 1) glob '[89ab]'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 24, 1) = '-'\n    and substr(\"writer_recovery_records\".\"recovery_record_id\", 25, 12) not glob '*[^0-9a-f]*'\n  "
        },
        "writer_recovery_records_generation_positive_safe": {
          "name": "writer_recovery_records_generation_positive_safe",
          "value": "\n    typeof(\"writer_recovery_records\".\"writer_generation\") = 'integer'\n    and \"writer_recovery_records\".\"writer_generation\" > 0\n    and \"writer_recovery_records\".\"writer_generation\" <= 9007199254740991\n  "
        },
        "writer_recovery_records_reason": {
          "name": "writer_recovery_records_reason",
          "value": "\"writer_recovery_records\".\"reason\" in ('commit-uncertain', 'abandoned-active-fence')"
        },
        "writer_recovery_records_command_uuid": {
          "name": "writer_recovery_records_command_uuid",
          "value": "\"writer_recovery_records\".\"command_id\" is null or (\n    length(\"writer_recovery_records\".\"command_id\") = 36\n    and \"writer_recovery_records\".\"command_id\" = lower(\"writer_recovery_records\".\"command_id\")\n    and substr(\"writer_recovery_records\".\"command_id\", 1, 8) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"command_id\", 9, 1) = '-'\n    and substr(\"writer_recovery_records\".\"command_id\", 10, 4) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"command_id\", 14, 1) = '-'\n    and substr(\"writer_recovery_records\".\"command_id\", 15, 1) glob '[1-8]'\n    and substr(\"writer_recovery_records\".\"command_id\", 16, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"command_id\", 19, 1) = '-'\n    and substr(\"writer_recovery_records\".\"command_id\", 20, 1) glob '[89ab]'\n    and substr(\"writer_recovery_records\".\"command_id\", 21, 3) not glob '*[^0-9a-f]*'\n    and substr(\"writer_recovery_records\".\"command_id\", 24, 1) = '-'\n    and substr(\"writer_recovery_records\".\"command_id\", 25, 12) not glob '*[^0-9a-f]*'\n  )"
        },
        "writer_recovery_records_fingerprint_sha256": {
          "name": "writer_recovery_records_fingerprint_sha256",
          "value": "\"writer_recovery_records\".\"command_fingerprint\" is null or (\n    length(\"writer_recovery_records\".\"command_fingerprint\") = 64\n    and \"writer_recovery_records\".\"command_fingerprint\" = lower(\"writer_recovery_records\".\"command_fingerprint\")\n    and \"writer_recovery_records\".\"command_fingerprint\" not glob '*[^0-9a-f]*'\n  )"
        },
        "writer_recovery_records_command_shape": {
          "name": "writer_recovery_records_command_shape",
          "value": "\n        (\n          \"writer_recovery_records\".\"reason\" = 'commit-uncertain'\n          and \"writer_recovery_records\".\"command_id\" is not null\n          and \"writer_recovery_records\".\"command_fingerprint\" is not null\n        )\n        or (\n          \"writer_recovery_records\".\"reason\" = 'abandoned-active-fence'\n          and \"writer_recovery_records\".\"command_id\" is null\n          and \"writer_recovery_records\".\"command_fingerprint\" is null\n        )\n      "
        },
        "writer_recovery_records_resolution": {
          "name": "writer_recovery_records_resolution",
          "value": "\n        \"writer_recovery_records\".\"resolution\" is null\n        or (\n          \"writer_recovery_records\".\"reason\" = 'commit-uncertain'\n          and \"writer_recovery_records\".\"resolution\" in ('receipt-found', 'receipt-absent')\n        )\n        or (\n          \"writer_recovery_records\".\"reason\" = 'abandoned-active-fence'\n          and \"writer_recovery_records\".\"resolution\" = 'generation-superseded'\n        )\n      "
        },
        "writer_recovery_records_resolution_shape": {
          "name": "writer_recovery_records_resolution_shape",
          "value": "\n        (\n          \"writer_recovery_records\".\"resolution\" is null\n          and \"writer_recovery_records\".\"resolved_by_writer_generation\" is null\n          and \"writer_recovery_records\".\"resolved_at\" is null\n        )\n        or (\n          \"writer_recovery_records\".\"resolution\" is not null\n          and \"writer_recovery_records\".\"resolved_by_writer_generation\" is not null\n          and \"writer_recovery_records\".\"resolved_at\" is not null\n        )\n      "
        },
        "writer_recovery_records_resolver_order": {
          "name": "writer_recovery_records_resolver_order",
          "value": "\n        \"writer_recovery_records\".\"resolved_by_writer_generation\" is null\n        or (\n          \n    typeof(\"writer_recovery_records\".\"resolved_by_writer_generation\") = 'integer'\n    and \"writer_recovery_records\".\"resolved_by_writer_generation\" > 0\n    and \"writer_recovery_records\".\"resolved_by_writer_generation\" <= 9007199254740991\n  \n          and \"writer_recovery_records\".\"resolved_by_writer_generation\" > \"writer_recovery_records\".\"writer_generation\"\n        )\n      "
        }
      }
    }
  },
  "views": {},
  "enums": {},
  "_meta": {
    "schemas": {},
    "tables": {},
    "columns": {}
  },
  "internal": {
    "indexes": {}
  }
}
```

### apps/harness/src/storage/project-storage-manifest.ts:11-15 - MODIFY
Declare the canonical Writer companion filename as a controlled Project artifact.

```ts
export const projectStorageManifestFilename = "manifest.json";
export const canonicalDatabaseFilename = "slopstop.db";
export const runtimeDatabaseFilename = "mastra.db";
export const canonicalWriterLeaseFilename = ".slopstop-writer.lock";
```

### apps/harness/src/storage/project-storage-filesystem-authority.ts:6-71,120-136 - MODIFY
Recognize the Writer companion file without confusing it with unknown or recoverable database artifacts.

```ts
import {
  canonicalDatabaseFilename,
  canonicalWriterLeaseFilename,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
} from "./project-storage-manifest.js";

export const witnessOrder = [
  "registration-record",
  "location-record",
  "generation-record",
  "project-root",
  "repository-marker",
  "writer-lease",
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
  [canonicalWriterLeaseFilename, "writer-lease"],
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

const projectRootOnlyWitnessKinds = new Set<PriorStateWitnessKind>([
  "repository-marker",
  "writer-lease",
]);

function generationFileWitnessKind(input: {
  entry: Dirent;
  deferManifestTypeValidation: boolean;
}): PriorStateWitnessKind {
  const kind = reservedFileWitnesses.get(input.entry.name);
  if (defersManifestTypeValidation(kind, input.deferManifestTypeValidation)) return kind;
  const plainFile = [!input.entry.isSymbolicLink(), input.entry.isFile()].every(Boolean);
  if (!plainFile) {
    throw new ProjectStorageBrokenError("Project Storage generation witness type is invalid.");
  }
  if (kind === undefined) {
    throw new ProjectStorageBrokenError("Project Storage generation contains an unknown witness.");
  }
  if (projectRootOnlyWitnessKinds.has(kind)) {
    throw new ProjectStorageBrokenError("Project Storage generation contains an unknown witness.");
  }
  return kind;
}
```

### apps/harness/src/storage/project-storage-node-adapters.ts - MODIFY
Preserve Slice 3's Writer lease path while inserting canonical Project state after migration and before the referencing Storage identity.

```ts
import {
  canonicalDatabaseFilename,
  canonicalWriterLeaseFilename,
  type ProjectStorageManifestV1,
  parseProjectStorageManifest,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
} from "./project-storage-manifest.js";

async function insertCanonicalProjectState(
  client: LocalClient,
  creation: AllocatedCreation,
): Promise<void> {
  const result = await client.execute({
    sql: `INSERT INTO project_state
      (project_id, last_project_sequence, last_writer_generation, created_at, updated_at)
      VALUES (?, 0, 0, ?, ?)`,
    args: [creation.projectId, creation.createdAt, creation.createdAt],
  });
  assertRowsAffected(result.rowsAffected, "Canonical Project state was not inserted exactly once.");
}

async function buildDatabase(
  databasePath: string,
  spec: typeof databaseSpecs.canonical | typeof databaseSpecs.runtime,
  creation: AllocatedCreation,
  loadMigrations: (spec: DatabaseSpec) => Promise<readonly GeneratedMigration[]>,
): Promise<ClosedDatabaseBuild> {
  try {
    await requirePlainDirectory(
      path.dirname(databasePath),
      "Database creation directory is unavailable.",
    );
    if ((await lstatIfPresent(databasePath)) !== undefined) {
      throw new ProjectStorageBrokenError("Database creation target already exists.");
    }
    const client = createLocalClient(databasePath, "generation");
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
      if (spec.databaseKind === "canonical") {
        await insertCanonicalProjectState(client, creation);
      }
      await insertDatabaseIdentity(client, spec, creation);
      await requireDeclaredSchemaObjects(client, spec);
      const metadata = await requireCurrentMetadata(client, spec, migrations);
      if (!(await databaseIdentityMatches(client, spec, creation))) {
        throw new ProjectStorageBrokenError("Database identity does not agree.");
      }
      await requireDatabaseIntegrity(client);
      return {
        state: "closed",
        formatVersion: metadata.formatVersion,
        schemaVersion: metadata.schemaVersion,
        lastMigrationId: metadata.lastMigrationId,
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    normalizeStorageError(error, "Database creation failed.");
  }
}

const paths: ProjectStorageStoreDependencies["paths"] = {
  forCreation: (projectId, generationId) => {
    const projectRoot = projectRootFor(projectId);
    const generationPaths = (root: string): ProjectStorageGenerationPaths => ({
      root,
      canonicalDatabase: path.join(root, canonicalDatabaseFilename),
      runtimeDatabase: path.join(root, runtimeDatabaseFilename),
      manifest: path.join(root, projectStorageManifestFilename),
    });
    return {
      projectRoot,
      writerLease: path.join(projectRoot, canonicalWriterLeaseFilename),
      staging: generationPaths(path.join(projectRoot, `.staging-${generationId}`)),
      active: generationPaths(path.join(projectRoot, generationId)),
    };
  },
};
```

### apps/harness/src/storage/project-storage-store.ts:15-20,38-57,104-109,122-175,489-745 - MODIFY
Expose the internal active-session material required by the coordinator and retain failed close ownership instead of deleting it before release succeeds.

```ts
import type {
  ProjectStorageActivationOutcome,
  ProjectStorageActivationSession,
  ProjectStorageOwner,
  ProjectStorageOwnerOutcome,
} from "../project-storage-application.js";

export type PriorStateWitnessKind =
  | "registration-record"
  | "location-record"
  | "generation-record"
  | "project-root"
  | "repository-marker"
  | "writer-lease"
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

type ProjectStoragePaths = Readonly<{
  projectRoot: string;
  writerLease: string;
  staging: ProjectStorageGenerationPaths;
  active: ProjectStorageGenerationPaths;
}>;

type AdmittedProjectStorageSession = Readonly<{
  admissionOrder: number;
  session: RetainedProjectStorageSession;
}>;

type AdmittedProjectStorageActivationSession = Readonly<{
  admissionOrder: number;
  session: ProjectStorageActivationSession;
}>;

type AdmittedProjectStorageOperation = Readonly<{
  admissionOrder: number;
  settlement: Promise<void>;
  failure(): Readonly<{ error: unknown }> | undefined;
}>;

async function collectSessionShutdownErrors(input: {
  sessions: readonly Readonly<{ admissionOrder: number; close(): Promise<void> }>[];
}): Promise<unknown[]> {
  const errors: unknown[] = [];
  const sessions = [...input.sessions].sort(
    (left, right) => left.admissionOrder - right.admissionOrder,
  );
  for (const session of sessions) {
    try {
      await session.close();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

export function createProjectStorageOwner(
  dependencies: ProjectStorageStoreDependencies,
): ProjectStorageOwner {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  let nextSessionAdmissionOrder = 0;
  let nextOperationAdmissionOrder = 0;
  const sessions = new Map<ProjectId, AdmittedProjectStorageSession>();
  const activationSessions = new Set<AdmittedProjectStorageActivationSession>();
  const admittedOperations = new Set<AdmittedProjectStorageOperation>();
  const ownerStoppedError = new ProjectStorageUnavailableError("Project Storage owner is stopped.");

  const lifecycle: ProjectStorageLifecycle = {
    assertRunning: () => {
      if (stopped) {
        throw ownerStoppedError;
      }
    },
  };

  const stoppedOutcome = () => ({
    status: "unavailable" as const,
    message: ownerStoppedError.message,
  });

  const closeSession = async (projectId: ProjectId): Promise<void> => {
    const admittedSession = sessions.get(projectId);
    await admittedSession?.session.close();
    if (sessions.get(projectId) === admittedSession) sessions.delete(projectId);
  };

  const retainActivationSession = (
    admissionOrder: number,
    session: ProjectStorageActivationSession,
  ): ProjectStorageActivationSession => {
    let retained: AdmittedProjectStorageActivationSession;
    let closed = false;
    const close = async (): Promise<void> => {
      if (closed) return;
      await session.close();
      closed = true;
      activationSessions.delete(retained);
    };
    const retainedSession = { ...session, close } satisfies ProjectStorageActivationSession;
    retained = { admissionOrder, session: retainedSession };
    activationSessions.add(retained);
    return retainedSession;
  };

  const operate = async (
    operation: () => Promise<
      ProjectStorageOpenResult | ProjectStorageCreateResult | ProjectStorageCloseResult
    >,
  ): Promise<ProjectStorageOwnerOutcome> => {
    try {
      const result = await operation();
      lifecycle.assertRunning();
      return { status: "ready", result };
    } catch (error) {
      if (error instanceof ProjectStorageApplicationClientInitializationError) {
        throw error;
      }
      if (error instanceof ProjectStorageUnavailableError) {
        return { status: "unavailable", message: error.message };
      }
      if (error instanceof ProjectStorageBrokenError) {
        return { status: "broken", message: error.message };
      }
      throw error;
    }
  };

  const trackAdmittedOperation = <Result>(operation: () => Promise<Result>): Promise<Result> => {
    const admissionOrder = nextOperationAdmissionOrder;
    nextOperationAdmissionOrder += 1;
    const pendingOperation = operation();
    let failure: Readonly<{ error: unknown }> | undefined;
    const settlement = pendingOperation.then(
      () => undefined,
      (error: unknown) => {
        if (error !== ownerStoppedError) {
          failure = { error };
        }
      },
    );
    const admittedOperation = {
      admissionOrder,
      settlement,
      failure: () => failure,
    } satisfies AdmittedProjectStorageOperation;
    admittedOperations.add(admittedOperation);
    void settlement.then(() => admittedOperations.delete(admittedOperation));
    return pendingOperation;
  };

  const activationFailure = (error: unknown): ProjectStorageActivationOutcome => {
    if (error instanceof ProjectStorageUnavailableError) {
      return { status: "unavailable", message: error.message };
    }
    if (error instanceof ProjectStorageBrokenError) {
      return { status: "broken", message: error.message };
    }
    throw error;
  };

  return {
    create: async (request) => {
      if (stopped) {
        return stoppedOutcome();
      }
      return operate(() =>
        trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            const result = await createProjectStorage(request, dependencies, lifecycle);
            lifecycle.assertRunning();
            return result;
          }),
        ),
      );
    },
    open: async (request: ProjectStorageOpenRequest) => {
      if (stopped) return stoppedOutcome();
      const admissionOrder = nextSessionAdmissionOrder;
      nextSessionAdmissionOrder += 1;
      return operate(() =>
        trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            await closeSession(request.projectId);
            lifecycle.assertRunning();
            const classified = classifyProjectStorageOpening(
              request,
              await dependencies.opening.inspect(request.projectId),
            );
            if (!("session" in classified)) {
              lifecycle.assertRunning();
              return classified.result;
            }
            if (stopped) {
              try {
                await classified.session.close();
              } catch (error) {
                throw new ProjectStorageBrokenError("Project Storage opening release failed.", {
                  cause: error,
                });
              }
            }
            lifecycle.assertRunning();
            sessions.set(request.projectId, { admissionOrder, session: classified.session });
            return classified.result;
          }),
        ),
      );
    },
    close: async (request: ProjectStorageCloseRequest) => {
      if (stopped) return stoppedOutcome();
      return operate(() =>
        trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            await closeSession(request.projectId);
            return { status: "closed", request };
          }),
        ),
      );
    },
    acquireActivation: async (request) => {
      if (stopped) return stoppedOutcome();
      const admissionOrder = nextSessionAdmissionOrder;
      nextSessionAdmissionOrder += 1;
      try {
        return await trackAdmittedOperation(() =>
          dependencies.locks.forProject(request.projectId, async () => {
            lifecycle.assertRunning();
            const classified = classifyProjectStorageOpening(
              request,
              await dependencies.opening.inspect(request.projectId),
            );
            if (!("session" in classified)) {
              lifecycle.assertRunning();
              return { status: "not-registered", result: classified.result };
            }
            if (stopped) {
              try {
                await classified.session.close();
              } catch (error) {
                throw new ProjectStorageBrokenError("Project Storage opening release failed.", {
                  cause: error,
                });
              }
            }
            lifecycle.assertRunning();
            let session: ProjectStorageActivationSession;
            if (classified.result.status === "opened") {
              const creationPaths = dependencies.paths.forCreation(
                request.projectId,
                classified.result.identity.generationId,
              );
              session = {
                mode: "read-write",
                result: classified.result,
                canonicalDatabasePath: creationPaths.active.canonicalDatabase,
                writerLeasePath: creationPaths.writerLease,
                close: classified.session.close,
              };
            } else {
              session = {
                mode: "safe-mode",
                result: classified.result,
                close: classified.session.close,
              };
            }
            return {
              status: "ready",
              session: retainActivationSession(admissionOrder, session),
            };
          }),
        );
      } catch (error) {
        return activationFailure(error);
      }
    },
    stop: () => {
      if (stopPromise !== undefined) {
        return stopPromise;
      }
      stopped = true;
      stopPromise = (async () => {
        const shutdownErrors = await collectOperationShutdownErrors(admittedOperations);
        shutdownErrors.push(
          ...(await collectSessionShutdownErrors({
            sessions: [
              ...[...sessions.entries()].map(([projectId, admitted]) => ({
                admissionOrder: admitted.admissionOrder,
                close: () => closeSession(projectId),
              })),
              ...[...activationSessions].map((admitted) => ({
                admissionOrder: admitted.admissionOrder,
                close: admitted.session.close,
              })),
            ],
          })),
        );
        try {
          await dependencies.locks.afterCreateDrain(() => dependencies.registry.stop());
        } catch (error) {
          shutdownErrors.push(error);
        }
        const uniqueShutdownErrors = [...new Set(shutdownErrors)];
        if (uniqueShutdownErrors.length > 0) {
          throw new AggregateError(uniqueShutdownErrors, "Project Storage shutdown failed.");
        }
      })();
      return stopPromise;
    },
  };
}
```

### apps/harness/src/storage/project-storage-transaction.ts:1-90 - MODIFY
Preserve rollback/close diagnostics while classifying commit-phase uncertainty for Writer quarantine.

S6 delta (approved): complete merged helper. `rollbackAfterFailure` and `appendCloseFailure` retain their live diagnostics. The private engine separates body and commit catch scopes; the additional runner exposes evidence internally, while every existing Storage caller still unwraps exactly the same result/error through `withWriteTransaction`. No new public protocol/export-barrel type is needed.

```ts
import { ProjectStorageBrokenError } from "./project-storage-errors.js";

type WriteTransaction = Readonly<{
  closed: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void> | void;
}>;

type WriteTransactionClient<Transaction extends WriteTransaction> = Readonly<{
  transaction(mode: "write"): Promise<Transaction>;
}>;

type WriteTransactionFailure = Readonly<{
  status: "failed";
  error: unknown;
  primaryError: unknown;
}> & (
  | Readonly<{ stage: "begin" | "body"; commit: "not-attempted" }>
  | Readonly<{ stage: "commit"; commit: "uncertain" }>
  | Readonly<{ stage: "close"; commit: "acknowledged" }>
);

export type ClassifiedWriteTransactionOutcome<Result> =
  | Readonly<{ status: "succeeded"; stage: "closed"; commit: "acknowledged"; result: Result }>
  | WriteTransactionFailure;

type TransactionOutcome<Result> =
  | Readonly<{ status: "succeeded"; result: Result }>
  | WriteTransactionFailure;

async function rollbackAfterFailure(
  transaction: WriteTransaction,
  operationError: unknown,
): Promise<never> {
  if (transaction.closed) throw operationError;
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
  throw operationError;
}

async function failedTransaction(
  transaction: WriteTransaction,
  primaryError: unknown,
  phase: Readonly<{ stage: "body"; commit: "not-attempted" }> |
    Readonly<{ stage: "commit"; commit: "uncertain" }>,
): Promise<WriteTransactionFailure> {
  try {
    return await rollbackAfterFailure(transaction, primaryError);
  } catch (error) {
    return { status: "failed", ...phase, primaryError, error };
  }
}

async function executeTransaction<Transaction extends WriteTransaction, Result>(
  transaction: Transaction,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<TransactionOutcome<Result>> {
  let result: Result;
  try {
    result = await operation(transaction);
  } catch (primaryError) {
    return failedTransaction(transaction, primaryError, { stage: "body", commit: "not-attempted" });
  }
  try {
    await transaction.commit();
  } catch (primaryError) {
    return failedTransaction(transaction, primaryError, { stage: "commit", commit: "uncertain" });
  }
  return { status: "succeeded", result };
}

function appendCloseFailure(failure: unknown, closeError: unknown): unknown {
  if (!(failure instanceof ProjectStorageBrokenError)) {
    return new AggregateError(
      [failure, closeError],
      "Project Storage transaction and close both failed.",
    );
  }
  if (!(failure.cause instanceof AggregateError)) {
    return new ProjectStorageBrokenError(failure.message, {
      cause: new AggregateError(
        [failure, closeError],
        "Project Storage transaction and close both failed.",
      ),
    });
  }
  return new ProjectStorageBrokenError(failure.message, {
    cause: new AggregateError(
      [...failure.cause.errors, closeError],
      "Project Storage transaction, rollback, and close all failed.",
    ),
  });
}

export async function runClassifiedWriteTransaction<Transaction extends WriteTransaction, Result>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<ClassifiedWriteTransactionOutcome<Result>> {
  let transaction: Transaction;
  try {
    transaction = await client.transaction("write");
  } catch (error) {
    return { status: "failed", stage: "begin", commit: "not-attempted", primaryError: error, error };
  }
  const outcome = await executeTransaction(transaction, operation);
  try {
    await transaction.close();
  } catch (closeError) {
    if (outcome.status === "failed") {
      return { ...outcome, error: appendCloseFailure(outcome.error, closeError) };
    }
    return { status: "failed", stage: "close", commit: "acknowledged", primaryError: closeError, error: closeError };
  }
  if (outcome.status === "failed") return outcome;
  return { status: "succeeded", stage: "closed", commit: "acknowledged", result: outcome.result };
}

export async function withWriteTransaction<Transaction extends WriteTransaction, Result>(
  client: WriteTransactionClient<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
): Promise<Result> {
  const outcome = await runClassifiedWriteTransaction(client, operation);
  if (outcome.status === "failed") throw outcome.error;
  return outcome.result;
}
```

### apps/harness/src/harness-runtime.ts:1-40,58-257 - MODIFY
Dispatch canonical Project requests and route unexpected failures according to request versus process scope.

```ts
import {
  createProjectActivateResultEvent,
  createProjectCloseResultEvent,
  createProjectCommandResultEvent,
  createProjectCreateResultEvent,
  createProjectOpenResultEvent,
  createProjectSwitchResultEvent,
  createReadyEvent,
  createRequestFailureEvent,
  createSystemFailureEvent,
  createWorkspaceIntentResultEvent,
  createWorkspaceProjectionInvalidatedEvent,
  createWorkspaceQueryResultEvent,
  type DesktopMessage,
  type HarnessFailureCode,
  type MessageId,
  MessageIdSchema,
  parseDesktopMessage,
  readMessageId,
  WorkspaceNotificationSchema,
} from "@slopstop/protocol";
import type { CanonicalProjectApplication } from "./canonical-project-application.js";
import type { ProjectStorageApplication } from "./project-storage-application.js";
import type { WorkspaceApplication } from "./workspace-application.js";

type HarnessRuntimeOptions = Readonly<{
  transport: HarnessTransport;
  canonicalProjectApplication: CanonicalProjectApplication;
  projectStorageApplication: ProjectStorageApplication;
  workspaceApplication: WorkspaceApplication;
  harnessVersion: string;
  createId: () => string;
  now: () => string;
}>;

type CanonicalProjectMessage = Extract<
  DesktopMessage,
  { command: "project.activate" | "project.switch" | "project.command" }
>;
type ProjectStorageMessage = Extract<
  DesktopMessage,
  { command: "project.open" | "project.create" | "project.close" }
>;

function isCanonicalProjectMessage(message: DesktopMessage): message is CanonicalProjectMessage {
  return (
    message.command === "project.activate" ||
    message.command === "project.switch" ||
    message.command === "project.command"
  );
}

function isProjectStorageMessage(message: DesktopMessage): message is ProjectStorageMessage {
  return (
    message.command === "project.open" ||
    message.command === "project.create" ||
    message.command === "project.close"
  );
}

export function startHarnessRuntime(options: HarnessRuntimeOptions): StopHarnessRuntime {
  let sequence = 0;

  const nextMetadata = <CausationId extends MessageId | null>(causationId: CausationId) => {
    sequence += 1;
    return {
      messageId: MessageIdSchema.parse(options.createId()),
      sentAt: options.now(),
      sequence,
      causationId,
    };
  };

  const sendFailure = (
    causationId: MessageId | null,
    failure: Readonly<{
      code: HarnessFailureCode;
      message: string;
      retryable: boolean;
    }>,
  ): void => {
    options.transport.send(
      causationId === null
        ? createSystemFailureEvent(nextMetadata(null), failure)
        : createRequestFailureEvent(nextMetadata(causationId), failure),
    );
  };

  const sendInternalFailure = (causationId: MessageId | null): void => {
    sendFailure(causationId, {
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    });
  };

  const handleCanonicalProjectMessage = async (message: CanonicalProjectMessage): Promise<void> => {
    switch (message.command) {
      case "project.activate": {
        const result = await options.canonicalProjectApplication.activate(message.payload);
        options.transport.send(
          createProjectActivateResultEvent(nextMetadata(message.messageId), result),
        );
        return;
      }
      case "project.command": {
        const result = await options.canonicalProjectApplication.execute(message.payload);
        options.transport.send(
          createProjectCommandResultEvent(nextMetadata(message.messageId), result),
        );
        return;
      }
      case "project.switch": {
        const result = await options.canonicalProjectApplication.switchProject(message.payload);
        options.transport.send(
          createProjectSwitchResultEvent(nextMetadata(message.messageId), result),
        );
      }
    }
  };

  const handleProjectStorageMessage = async (message: ProjectStorageMessage): Promise<void> => {
    switch (message.command) {
      case "project.open": {
        const result = await options.projectStorageApplication.open(message.payload);
        options.transport.send(
          createProjectOpenResultEvent(nextMetadata(message.messageId), result),
        );
        return;
      }
      case "project.create": {
        const result = await options.projectStorageApplication.create(message.payload);
        options.transport.send(
          createProjectCreateResultEvent(nextMetadata(message.messageId), result),
        );
        return;
      }
      case "project.close": {
        const result = await options.projectStorageApplication.close(message.payload);
        options.transport.send(
          createProjectCloseResultEvent(nextMetadata(message.messageId), result),
        );
      }
    }
  };

  const handleMessage = async (message: unknown): Promise<void> => {
    const parsed = parseDesktopMessage(message);
    const causationId = readMessageId(message);

    if (!parsed.ok) {
      sendFailure(causationId, {
        code: parsed.error.code,
        message: failureMessages[parsed.error.code],
        retryable: false,
      });
      return;
    }
    if (isCanonicalProjectMessage(parsed.value)) {
      await handleCanonicalProjectMessage(parsed.value);
      return;
    }
    if (isProjectStorageMessage(parsed.value)) {
      await handleProjectStorageMessage(parsed.value);
      return;
    }

    switch (parsed.value.command) {
      case "system.handshake":
        options.transport.send(createReadyEvent(nextMetadata(causationId), options.harnessVersion));
        return;
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

  let stopPromise: Promise<void> | undefined;
  return () => {
    if (stopPromise !== undefined) {
      return stopPromise;
    }
    const failures: unknown[] = [];
    const settlement = {
      resolve: (): void => undefined,
      reject: (_reason: unknown): void => undefined,
    };
    stopPromise = new Promise<void>((resolve, reject) => {
      settlement.resolve = resolve;
      settlement.reject = reject;
    });
    try {
      stopMessages();
    } catch (error) {
      failures.push(error);
    }
    try {
      stopNotifications();
    } catch (error) {
      failures.push(error);
    }
    void (async () => {
      try {
        await options.canonicalProjectApplication.stop();
      } catch (error) {
        failures.push(error);
        settlement.reject(runtimeShutdownFailure(failures));
        return;
      }
      try {
        await options.projectStorageApplication.stop();
      } catch (error) {
        failures.push(error);
      }
      if (failures.length === 0) {
        settlement.resolve();
      } else {
        settlement.reject(runtimeShutdownFailure(failures));
      }
    })();
    return stopPromise;
  };
}
```

### apps/harness/src/process-bootstrap.ts:1-19,65-111 - MODIFY
Compose the native lease, canonical repository, Writer factory, active coordinator, and application at the harness process boundary.

S5 delta (approved): compose the explicitly empty production registry and receipt/event identity plus settlement clock dependencies. Tests inject conformance definitions through the harness seam instead; no conformance module is imported by this production composition.

```ts
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessBootstrapSchema, ProjectActivationIdSchema } from "@slopstop/protocol";
import { createActiveProjectCoordinator } from "./active-project-coordinator.js";
import { createCanonicalProjectApplication } from "./canonical-project-application.js";
import { createCanonicalCommandRegistry } from "./canonical-command-registry.js";
import {
  type HarnessTransport,
  type StopHarnessRuntime,
  startHarnessRuntime,
} from "./harness-runtime.js";
import { createProjectStorageApplication } from "./project-storage-application.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "./storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "./storage/canonical-writer-lease.js";
import { createWorkerLocalLibsqlClient } from "./storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "./storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "./storage/project-storage-store.js";
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";

export function startHarnessProcessRuntime(
  input: Readonly<{
    bootstrap: unknown;
    transport: HarnessTransport;
  }>,
): StopHarnessRuntime {
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
  const now = () => new Date().toISOString();
  const canonicalProjectCoordinator = createActiveProjectCoordinator({
    storage: projectStorageOwner,
    leases: createNodeCanonicalWriterLeaseFactory(),
    repositories: createCanonicalCommandRepositoryFactory({
      openClient: (databasePath) => createWorkerLocalLibsqlClient(databasePath, "generation"),
      sha256Text: async (value) => createHash("sha256").update(value).digest("hex"),
      createHandoffId: randomUUID,
      createRecoveryRecordId: randomUUID,
      registry: createCanonicalCommandRegistry([]),
      createReceiptId: randomUUID,
      createEventId: randomUUID,
      now,
    }),
    createActivationId: () => ProjectActivationIdSchema.parse(randomUUID()),
    createWriterToken: () =>
      WriterCapabilityTokenSchema.parse(randomBytes(32).toString("hex")),
    now,
  });

  return startHarnessRuntime({
    transport: input.transport,
    canonicalProjectApplication: createCanonicalProjectApplication(canonicalProjectCoordinator),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: createProjectStorageApplication(projectStorageOwner),
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now,
  });
}
```

### apps/harness/src/index.ts:1-22 - MODIFY
Expose the harness public composition/testing seams without leaking Node adapters across package boundaries.

S5 delta (approved): add only the registry factory and its typed handler seam to the existing harness export block. Keep repository/token/lease adapters private to harness and retain all existing Workspace exports outside this MODIFY excerpt. Runtime and its required switch method need no new Slice 5 code: the extended result schema is sufficient.

```ts
export type {
  CanonicalCommandDecision,
  CanonicalCommandRegistry,
  CanonicalCommandTransaction,
  CanonicalEventInput,
  RegisteredCanonicalCommand,
} from "./canonical-command-registry.js";
export { createCanonicalCommandRegistry, defineCanonicalCommand } from "./canonical-command-registry.js";
export type {
  ActiveProjectCoordinator,
  ActiveProjectCoordinatorDependencies,
} from "./active-project-coordinator.js";
export { createActiveProjectCoordinator } from "./active-project-coordinator.js";
export type { CanonicalProjectApplication } from "./canonical-project-application.js";
export { createCanonicalProjectApplication } from "./canonical-project-application.js";
export type { HarnessTransport, StopHarnessRuntime } from "./harness-runtime.js";
export { startHarnessRuntime } from "./harness-runtime.js";
export type {
  ProjectStorageApplication,
  ProjectStorageActivationOutcome,
  ProjectStorageActivationPort,
  ProjectStorageActivationSession,
  ProjectStorageOwner,
  ProjectStorageOwnerOutcome,
  ProjectStorageOwnerPort,
} from "./project-storage-application.js";
export {
  createProjectStorageApplication,
  createUnavailableProjectStorageApplication,
} from "./project-storage-application.js";
```

### apps/harness/package.json:18-26 - MODIFY
Add the pinned native lease dependency.

```json
"dependencies": {
  "@libsql/client": "catalog:",
  "@slopstop/protocol": "workspace:*",
  "drizzle-orm": "catalog:",
  "fs-native-extensions": "catalog:",
  "libsql": "catalog:",
  "pino": "catalog:",
  "zod": "catalog:"
}
```

### apps/desktop/src/main/harness-supervisor.ts:170-210 - MODIFY
Treat only valid uncorrelated `system.failure` as process-global recovery and leave correlated request failure to bridges.

```ts
const statusNeutralEvents: ReadonlySet<HarnessMessage["event"]> = new Set([
  "request.failure",
  "project.open.result",
  "project.create.result",
  "project.close.result",
  "workspace.intent.result",
  "workspace.projection.invalidated",
  "workspace.query.result",
]);
```

### apps/desktop/src/main/project-storage-bridge.ts:140-240 - MODIFY
Settle only a causally matching pending Project request on `request.failure`.

```ts
case "request.failure":
  this.#failRequest(message.causationId, message.payload.message);
  return;
case "system.failure":
  this.#failAll(message.payload.message);
  return;

#failRequest(causationId: string, message: string): void {
  const pending = this.#pending.get(causationId);
  if (pending === undefined) return;
  this.#pending.delete(causationId);
  this.#fail(pending, message);
}
```

### apps/desktop/src/main/workspace-bridge.ts:210-310 - MODIFY
Settle only a causally matching pending Workspace request on `request.failure`.

```ts
case "request.failure":
  this.#failRequest(message.causationId, message.payload.message);
  return;
case "system.failure":
  this.#failAllPending(message.payload.message);
  return;

#failRequest(causationId: string, message: string): void {
  const request = this.#pending.get(causationId);
  if (request === undefined) return;
  this.#pending.delete(causationId);
  this.#failPending(request, message);
}
```

### apps/desktop/src/main/canonical-writer-package-smoke.ts - NEW
Own the private packaged proof's independent utilities, exact exchanges, first fault, absolute deadlines, and retained bounded cleanup metadata. Production and fixture ports both observe actual remote closure. Normal waits fail together; cleanup ignores fault/abort while preserving every child until exit and EOF.

```ts
import { randomUUID } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { isDeepStrictEqual } from "node:util";
import {
  createHandshakeCommand,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectSwitchCommand,
  HarnessBootstrapSchema,
  HarnessMessageSchema,
  WriterProofControlSchema,
  WriterProofEventSchema,
  WriterProofStartSchema,
  writerProofFirstCommand,
  writerProofInactiveActivationId,
  writerProofNextCommand,
  writerProofProjectId,
  writerProofStaleProjectId,
  type CanonicalCommandReceipt,
  type CanonicalProjectActivationResult,
  type DesktopMessage,
  type HarnessBootstrap,
  type HarnessMessage,
  type ProjectActivationId,
  type ProjectId,
  type TypedCommand,
  type WriterProofControl,
  type WriterProofEvent,
} from "@slopstop/protocol";
import { MessageChannelMain, utilityProcess, type MessagePortMain, type UtilityProcess } from "electron";
import { HarnessSession } from "./harness-session.js";
import {
  WriterProofError,
  requireWriterProof,
  verifyPackagedWriterNative,
  type WriterProofStage,
} from "./package-smoke-verifier.js";

export const writerProofLimits = Object.freeze({
  proofMs: 90_000,
  stepMs: 10_000,
  takeoverMs: 15_000,
  takeoverDelayMs: 100,
  cleanStopMs: 5_000,
  cleanupMs: 10_000,
  drainMs: 3_000,
  outputBytesPerStream: 65_536,
  maxProcesses: 6,
  maxCleanupFailures: 24,
});

type ProofWaitOptions = Readonly<{
  mode: "proof";
  deadline: number;
  stage: WriterProofStage;
  allowTerminal?: boolean;
  signal: AbortSignal;
}>;
type WaitOptions = ProofWaitOptions | Readonly<{
  mode: "cleanup";
  deadline: number;
  stage: WriterProofStage;
  allowTerminal?: boolean;
}>;

class ProofFault {
  readonly listeners = new Set<(error: WriterProofError) => void>();
  first: WriterProofError | undefined;

  record(stage: WriterProofStage): WriterProofError {
    if (this.first !== undefined) return this.first;
    const error = new WriterProofError(stage);
    this.first = error;
    for (const listener of this.listeners) listener(error);
    return error;
  }

  assertAdmission(deadline: number, stage: WriterProofStage, signal: AbortSignal): void {
    if (this.first !== undefined) throw this.first;
    if (signal.aborted) throw this.record("cancelled");
    if (performance.now() >= deadline) throw this.record(stage);
  }
}

class OwnedUtility {
  readonly changes = new Set<() => void>();
  readonly session = new HarnessSession();
  readonly output = { stdout: { ended: false, bytes: 0 }, stderr: { ended: false, bytes: 0 } };
  readonly observationCleanup: Array<() => void> = [];
  receiver: ((value: unknown) => void) | undefined;
  localPort: MessagePortMain | undefined;
  transferredPort: MessagePortMain | undefined;
  spawned = false;
  terminal = false;
  expectedExit: "none" | "clean" | "hard-kill" = "none";
  exitCode: number | undefined;
  exitObservedAt: number | undefined;
  pid: number | undefined;
  sequence = 0;

  constructor(readonly child: UtilityProcess, readonly proofFault: ProofFault) {}

  notify(): void {
    for (const listener of this.changes) listener();
  }

  fail(stage: WriterProofStage): void {
    this.proofFault.record(stage);
  }

  receive(value: unknown): void {
    const receive = this.receiver;
    if (receive === undefined) {
      this.fail("unexpected-message");
      return;
    }
    try {
      receive(value);
    } catch (error) {
      this.fail(error instanceof WriterProofError ? error.stage : "unexpected-message");
    }
  }

  observe(): void {
    const onExit = (code: number): void => {
      this.exitObservedAt = performance.now();
      this.terminal = true;
      this.exitCode = code;
      if (this.expectedExit === "none") this.fail("process-exit");
      else if (this.expectedExit === "clean" && code !== 0) this.fail("clean-stop");
      else if (this.expectedExit === "hard-kill" && code === 0) this.fail("hard-kill");
      this.notify();
    };
    const onError = (): void => this.fail("process-exit");
    const onParentMessage = (): void => this.fail("unexpected-message");
    const onSpawn = (): void => {
      this.spawned = true;
      this.pid = this.child.pid;
      this.notify();
    };
    this.child.once("exit", onExit);
    this.child.on("error", onError);
    this.child.on("message", onParentMessage);
    this.child.once("spawn", onSpawn);
    this.observationCleanup.push(() => {
      this.child.off("exit", onExit);
      this.child.off("error", onError);
      this.child.off("message", onParentMessage);
      this.child.off("spawn", onSpawn);
    });
    // Capture streams now: Electron nulls child.stdout/stderr after exit.
    for (const name of ["stdout", "stderr"] as const) {
      const stream = this.child[name];
      if (stream === null) {
        this.fail("stdio-drain");
        continue;
      }
      const state = this.output[name];
      const onData = (chunk: unknown): void => {
        const bytes = Buffer.isBuffer(chunk) ? chunk.byteLength :
          typeof chunk === "string" ? Buffer.byteLength(chunk) : writerProofLimits.outputBytesPerStream + 1;
        state.bytes = Math.min(state.bytes + bytes, writerProofLimits.outputBytesPerStream + 1);
        if (state.bytes > writerProofLimits.outputBytesPerStream) this.fail("output-bound");
      };
      const onEnd = (): void => { state.ended = true; this.notify(); };
      const onStreamError = (): void => this.fail("stdio-drain");
      stream.on("data", onData);
      stream.once("end", onEnd);
      stream.on("error", onStreamError);
      this.observationCleanup.push(() => {
        stream.off("data", onData);
        stream.off("end", onEnd);
        stream.off("error", onStreamError);
      });
    }
  }

  async waitUntil(predicate: () => boolean, options: WaitOptions): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const finish = (error?: WriterProofError): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        this.changes.delete(check);
        this.proofFault.listeners.delete(onProofFault);
        if (options.mode === "proof") options.signal.removeEventListener("abort", check);
        if (error === undefined) resolve();
        else reject(error);
      };
      // This callback does not record a fault, so broadcasting cannot recurse.
      const onProofFault = (error: WriterProofError): void => finish(error);
      const failWait = (stage: WriterProofStage): void => {
        if (settled) return;
        const error = options.mode === "cleanup"
          ? new WriterProofError(stage)
          : this.proofFault.record(stage);
        finish(error);
      };
      const check = (): void => {
        if (settled) return;
        if (options.mode === "proof") {
          if (this.proofFault.first !== undefined) return finish(this.proofFault.first);
          if (options.signal.aborted) return failWait("cancelled");
        }
        if (!options.allowTerminal && this.terminal) return failWait("process-exit");
        if (performance.now() >= options.deadline) return failWait(options.stage);
        if (predicate()) finish();
      };
      this.changes.add(check);
      if (options.mode === "proof") {
        this.proofFault.listeners.add(onProofFault);
        options.signal.addEventListener("abort", check, { once: true });
      }
      if (!settled) {
        timer = setTimeout(() => failWait(options.stage), Math.max(1, options.deadline - performance.now()));
        check();
      }
    });
    if (options.mode === "proof") {
      this.proofFault.assertAdmission(options.deadline, options.stage, options.signal);
      if (!options.allowTerminal && this.terminal) throw this.proofFault.record("process-exit");
    }
  }

  async exchange<Result>(
    send: () => void,
    parse: (value: unknown) => Result,
    options: ProofWaitOptions,
  ): Promise<Result> {
    this.proofFault.assertAdmission(options.deadline, options.stage, options.signal);
    if (this.receiver !== undefined || this.terminal) throw this.proofFault.record("transport");
    const response: { received?: Readonly<{ value: Result }> } = {};
    this.receiver = (value) => {
      requireWriterProof(response.received === undefined, "unexpected-message");
      response.received = { value: parse(value) };
      this.notify();
    };
    try {
      this.proofFault.assertAdmission(options.deadline, options.stage, options.signal);
      send();
      await this.waitUntil(() => response.received !== undefined, options);
      this.proofFault.assertAdmission(options.deadline, options.stage, options.signal);
      requireWriterProof(response.received !== undefined, "transport");
      return response.received.value;
    } catch (error) {
      throw this.proofFault.record(error instanceof WriterProofError ? error.stage : "transport");
    } finally {
      this.receiver = undefined;
    }
  }

  closePorts(): void {
    this.session.detach();
    this.localPort?.close();
    this.transferredPort?.close();
  }

  hardKill(): void {
    requireWriterProof(!this.terminal && this.pid !== undefined && this.pid !== process.pid &&
      this.child.pid === this.pid, "hard-kill");
    this.expectedExit = "hard-kill";
    process.kill(this.pid, "SIGKILL");
  }

  get drained(): boolean {
    return this.output.stdout.ended && this.output.stderr.ended;
  }

  disposeTerminalObservation(): void {
    requireWriterProof(this.terminal && this.drained, "cleanup");
    this.closePorts();
    for (const cleanup of this.observationCleanup) cleanup();
    this.observationCleanup.length = 0;
  }
}

type WritableActivation = Extract<CanonicalProjectActivationResult, { access: "read-write" }>;

export type WriterProofCleanupFailure = Readonly<{
  processIndex: number;
  stage: "cleanup" | "stdio-drain";
}>;

export type WriterProofOutcome =
  | Readonly<{ status: "passed"; cleanupSafe: true }>
  | Readonly<{
      status: "failed";
      stage: WriterProofStage;
      cleanupSafe: boolean;
      cleanupFailures: readonly WriterProofCleanupFailure[];
    }>;

export async function runCanonicalWriterPackageSmoke(input: Readonly<{
  bootstrap: HarnessBootstrap;
  mainBundleDirectory: string;
  resourcesPath: string;
  signal: AbortSignal;
}>): Promise<WriterProofOutcome> {
  const owned: OwnedUtility[] = [];
  const proofFault = new ProofFault();
  const cleanupFailures: WriterProofCleanupFailure[] = [];
  const recordCleanupFailure = (processIndex: number, stage: WriterProofCleanupFailure["stage"]): void => {
    if (cleanupFailures.length < writerProofLimits.maxCleanupFailures) {
      cleanupFailures.push(Object.freeze({ processIndex, stage }));
    }
    // A first cleanup failure still fails the proof; secondary ones never rebroadcast.
    if (proofFault.first === undefined) proofFault.record(stage);
  };
  const deadline = performance.now() + writerProofLimits.proofMs;
  let cleanupSafe = false;
  const onAbort = (): void => { proofFault.record("cancelled"); };
  input.signal.addEventListener("abort", onAbort, { once: true });

  const options = (stage: WriterProofStage, maximum = deadline): ProofWaitOptions => ({
    mode: "proof",
    stage,
    deadline: Math.min(maximum, deadline, performance.now() + writerProofLimits.stepMs),
    signal: input.signal,
  });
  const checkAdmission = (maximum = deadline, stage: WriterProofStage = "proof-deadline"): void => {
    proofFault.assertAdmission(Math.min(deadline, maximum), stage, input.signal);
  };
  const requireProof: (condition: boolean, stage: WriterProofStage) => asserts condition = (condition, stage) => {
    if (!condition) throw proofFault.record(stage);
  };
  const metadata = () => ({ messageId: randomUUID(), sentAt: new Date().toISOString() });

  const spawn = async (fixture: boolean, maximum = deadline): Promise<OwnedUtility> => {
    const spawnOptions = options("spawn", maximum);
    checkAdmission(spawnOptions.deadline, "spawn");
    const env = { ...process.env };
    delete env["NODE_PATH"];
    delete env["NODE_OPTIONS"];
    delete env["SLOPSTOP_PACKAGE_SMOKE_TOKEN"];
    delete env["SLOPSTOP_PACKAGE_SMOKE_USER_DATA"];
    delete env["SLOPSTOP_PACKAGE_SMOKE_SCENARIO"];
    delete env["SLOPSTOP_PACKAGE_SMOKE"];
    env["SLOPSTOP_LOG_LEVEL"] = "info";
    checkAdmission(spawnOptions.deadline, "spawn");
    requireProof(owned.length < writerProofLimits.maxProcesses, "spawn");
    const child = utilityProcess.fork(path.join(input.mainBundleDirectory,
      fixture ? "writer-proof-fixture.cjs" : "harness.cjs"), [], {
      serviceName: fixture ? "SlopStop Writer Proof Fixture" : "SlopStop Writer Proof Harness",
      stdio: "pipe", env,
    });
    const processOwner = new OwnedUtility(child, proofFault);
    owned.push(processOwner);
    processOwner.observe();
    await processOwner.waitUntil(() => processOwner.spawned, spawnOptions);
    checkAdmission(spawnOptions.deadline, "spawn");
    requireProof(processOwner.pid !== undefined, "spawn");
    const { port1, port2 } = new MessageChannelMain();
    processOwner.transferredPort = port1;
    processOwner.localPort = port2;
    const close = (): void => {
      if (processOwner.expectedExit === "none") processOwner.fail("transport");
    };
    port2.on("close", close);
    processOwner.observationCleanup.push(() => port2.off("close", close));
    if (fixture) {
      const receive = (event: Readonly<{ data: unknown }>): void => processOwner.receive(event.data);
      port2.on("message", receive);
      processOwner.observationCleanup.push(() => {
        port2.off("message", receive);
      });
      checkAdmission(spawnOptions.deadline, "spawn");
      port2.start();
    } else {
      const unsubscribe = processOwner.session.subscribe((event) => {
        if (event.type === "message") processOwner.receive(event.message);
        else if (event.type === "protocol-error" || processOwner.expectedExit === "none") {
          processOwner.fail("transport");
        }
      });
      processOwner.observationCleanup.push(unsubscribe);
      checkAdmission(spawnOptions.deadline, "spawn");
      processOwner.session.attach(port2);
      const bootstrap = HarnessBootstrapSchema.parse(input.bootstrap);
      checkAdmission(spawnOptions.deadline, "spawn");
      child.postMessage(bootstrap, [port1]);
      await call(processOwner, createHandshakeCommand(metadata(), "0.0.0"), "system.ready", "handshake", maximum);
    }
    checkAdmission(maximum, "spawn");
    return processOwner;
  };

  const call = async (
    owner: OwnedUtility,
    command: DesktopMessage,
    event: HarnessMessage["event"],
    stage: WriterProofStage,
    maximum = deadline,
  ): Promise<HarnessMessage> => {
    checkAdmission(maximum, stage);
    return owner.exchange(() => {
      checkAdmission(maximum, stage);
      requireProof(owner.session.send(command).ok, "transport");
    }, (value) => {
      const result = HarnessMessageSchema.parse(value);
      requireProof(result.event === event && result.causationId === command.messageId &&
        result.sequence === owner.sequence + 1, "unexpected-message");
      owner.sequence = result.sequence;
      return result;
    }, options(stage, maximum));
  };

  const activate = async (owner: OwnedUtility, projectId: ProjectId, maximum = deadline) => {
    const result = await call(owner, createProjectActivateCommand(metadata(), { projectId }),
      "project.activate.result", "activate", maximum);
    requireProof(result.event === "project.activate.result" && result.payload.request.projectId === projectId,
      "activate");
    return result.payload;
  };
  const writable = (result: CanonicalProjectActivationResult, generation: 1 | 2): WritableActivation => {
    requireProof(result.status === "active" && result.access === "read-write" &&
      result.writerGeneration === generation, "activate");
    return result;
  };
  const command = async (owner: OwnedUtility, activationId: ProjectActivationId, value: TypedCommand,
    stage: WriterProofStage, maximum = deadline) => {
    const message = await call(owner, createProjectCommand(metadata(), {
      projectId: writerProofProjectId, activationId, command: value,
    }), "project.command.result", stage, maximum);
    requireProof(message.event === "project.command.result" &&
      message.payload.projectId === writerProofProjectId && message.payload.activationId === activationId &&
      message.payload.commandId === value.commandId, stage);
    return message.payload;
  };
  const rejectedReceipt = (receipt: CanonicalCommandReceipt, value: TypedCommand, sequence: 1 | 2): void => {
    requireProof(receipt.projectId === writerProofProjectId && receipt.commandId === value.commandId &&
      receipt.commandType === value.type && receipt.commandVersion === value.version &&
      receipt.projectSequence === sequence && receipt.writerGeneration === sequence &&
      receipt.outcome === "rejected" && receipt.rejection.code === "COMMAND_TYPE_UNSUPPORTED" &&
      receipt.rejection.retryable === false && receipt.events.length === 0,
      sequence === 1 ? "first-settlement" : "next-settlement");
  };

  const drain = async (owner: OwnedUtility, enclosing: ProofWaitOptions): Promise<void> => {
    checkAdmission(enclosing.deadline, enclosing.stage);
    await owner.waitUntil(() => owner.drained, {
      ...enclosing,
      deadline: Math.min(deadline, enclosing.deadline, performance.now() + writerProofLimits.drainMs),
      stage: "stdio-drain", allowTerminal: true,
    });
    checkAdmission(enclosing.deadline, enclosing.stage);
  };
  const stopClean = async (owner: OwnedUtility, maximum = deadline): Promise<void> => {
    const stopOptions = options("clean-stop", maximum);
    checkAdmission(stopOptions.deadline, "clean-stop");
    requireProof(!owner.terminal, "clean-stop");
    owner.expectedExit = "clean";
    checkAdmission(stopOptions.deadline, "clean-stop");
    owner.closePorts();
    await owner.waitUntil(() => owner.terminal, {
      ...stopOptions, allowTerminal: true,
      deadline: Math.min(stopOptions.deadline, performance.now() + writerProofLimits.cleanStopMs),
    });
    checkAdmission(stopOptions.deadline, "clean-stop");
    requireProof(owner.exitCode === 0, "clean-stop");
    await drain(owner, stopOptions);
  };

  const connectFixture = async (): Promise<Readonly<{ owner: OwnedUtility; proofId: string }>> => {
    const owner = await spawn(true);
    checkAdmission();
    const proofId = randomUUID();
    const port = owner.transferredPort;
    requireProof(port !== undefined, "transport");
    const start = WriterProofStartSchema.parse({
      version: 1, kind: "writer-proof.connect", proofId, bootstrap: input.bootstrap,
    });
    checkAdmission();
    owner.child.postMessage(start, [port]);
    return { owner, proofId };
  };
  const control = async (fixture: Readonly<{ owner: OwnedUtility; proofId: string }>,
    value: unknown, stage: WriterProofStage): Promise<WriterProofEvent> => {
    checkAdmission();
    const request: WriterProofControl = WriterProofControlSchema.parse(value);
    requireProof(request.proofId === fixture.proofId, "transport");
    return fixture.owner.exchange(() => {
      const port = fixture.owner.localPort;
      requireProof(port !== undefined, "transport");
      checkAdmission();
      port.postMessage(request);
    }, (raw) => {
      const event = WriterProofEventSchema.parse(raw);
      requireProof(event.proofId === fixture.proofId && event.requestId === request.requestId &&
        event.step === request.step && event.stepNumber === request.stepNumber, "unexpected-message");
      if ("native" in event) {
        requireProof(event.native.target === `${process.platform}-${process.arch}`, "native-preflight");
      }
      return event;
    }, options(stage));
  };
  const controlMetadata = (proofId: string) => ({
    version: 1, kind: "writer-proof.control", proofId, requestId: randomUUID(),
  });

  try {
    checkAdmission();
    verifyPackagedWriterNative(input);
    const holder = await spawn(false);
    const inactive = await command(holder, writerProofInactiveActivationId, writerProofFirstCommand, "inactive");
    requireProof(inactive.status === "inactive" && inactive.diagnostic.code === "PROJECT_INACTIVE" &&
      inactive.diagnostic.message === "No Project is active for Typed commands." &&
      !inactive.diagnostic.retryable, "inactive");
    const firstActivation = writable(await activate(holder, writerProofProjectId), 1);
    const first = await command(holder, firstActivation.activationId, writerProofFirstCommand, "first-settlement");
    requireProof(first.status === "settled", "first-settlement");
    rejectedReceipt(first.receipt, writerProofFirstCommand, 1);

    const contender = await spawn(false);
    const readOnly = await activate(contender, writerProofProjectId);
    requireProof(readOnly.status === "active" && readOnly.access === "read-only" &&
      readOnly.writerGeneration === null && readOnly.diagnostic.code === "WRITER_UNAVAILABLE" &&
      readOnly.diagnostic.message === "Another SlopStop process holds Project write authority." &&
      readOnly.diagnostic.retryable, "contention");
    const denied = await command(contender, readOnly.activationId, writerProofFirstCommand, "read-only");
    requireProof(denied.status === "read-only" && denied.diagnostic.code === "WRITER_UNAVAILABLE" &&
      denied.diagnostic.message === "The active Project has no write authority." &&
      denied.diagnostic.retryable, "read-only");
    await stopClean(contender);

    const killOptions = options("hard-kill");
    checkAdmission(killOptions.deadline, "hard-kill");
    holder.hardKill();
    await holder.waitUntil(() => holder.terminal, { ...killOptions, allowTerminal: true });
    checkAdmission(killOptions.deadline, "hard-kill");
    requireProof(holder.exitCode !== undefined && holder.exitCode !== 0 &&
      holder.exitObservedAt !== undefined, "hard-kill");
    const takeoverDeadline = Math.min(deadline, holder.exitObservedAt + writerProofLimits.takeoverMs);
    await drain(holder, { ...killOptions, deadline: Math.min(killOptions.deadline, takeoverDeadline) });

    const replacement = await spawn(false, takeoverDeadline);
    const freshInactive = await command(replacement, firstActivation.activationId, writerProofFirstCommand,
      "inactive", takeoverDeadline);
    requireProof(freshInactive.status === "inactive" && freshInactive.diagnostic.code === "PROJECT_INACTIVE" &&
      freshInactive.diagnostic.message === "No Project is active for Typed commands." &&
      !freshInactive.diagnostic.retryable, "inactive");
    let takeover = await activate(replacement, writerProofProjectId, takeoverDeadline);
    while (takeover.status === "active" && takeover.access === "read-only") {
      // Explicit proof-only A-to-A requests. Production never retries activation automatically.
      requireProof(takeover.writerGeneration === null && takeover.diagnostic.code === "WRITER_UNAVAILABLE" &&
        takeover.diagnostic.message === "Another SlopStop process holds Project write authority." &&
        takeover.diagnostic.retryable, "takeover");
      const retryAt = performance.now() + writerProofLimits.takeoverDelayMs;
      requireProof(retryAt < takeoverDeadline, "takeover");
      const delay = { elapsed: false };
      const wake = setTimeout(() => {
        delay.elapsed = true;
        replacement.notify();
      }, writerProofLimits.takeoverDelayMs);
      try {
        await replacement.waitUntil(() => delay.elapsed, options("takeover", takeoverDeadline));
      } finally {
        clearTimeout(wake);
      }
      checkAdmission(takeoverDeadline, "takeover");
      const switched = await call(replacement, createProjectSwitchCommand(metadata(), {
        from: { projectId: writerProofProjectId, activationId: takeover.activationId },
        to: { projectId: writerProofProjectId },
      }), "project.switch.result", "takeover", takeoverDeadline);
      requireProof(switched.event === "project.switch.result" &&
        switched.payload.request.from.projectId === writerProofProjectId &&
        switched.payload.request.from.activationId === takeover.activationId &&
        switched.payload.request.to.projectId === writerProofProjectId &&
        switched.payload.status === "target-result", "takeover");
      takeover = switched.payload.target;
    }
    const secondActivation = writable(takeover, 2);
    requireProof(secondActivation.activationId !== firstActivation.activationId, "takeover");
    const replay = await command(replacement, secondActivation.activationId, writerProofFirstCommand, "replay");
    requireProof(replay.status === "settled" && isDeepStrictEqual(replay.receipt, first.receipt), "replay");
    const stale = await command(replacement, firstActivation.activationId, writerProofFirstCommand, "stale-activation");
    requireProof(stale.status === "stale-activation" && stale.diagnostic.code === "PROJECT_ACTIVATION_STALE" &&
      stale.diagnostic.message === "The command activation is stale." &&
      !stale.diagnostic.retryable, "stale-activation");
    const next = await command(replacement, secondActivation.activationId, writerProofNextCommand, "next-settlement");
    requireProof(next.status === "settled", "next-settlement");
    rejectedReceipt(next.receipt, writerProofNextCommand, 2);
    requireProof(next.receipt.receiptId !== first.receipt.receiptId, "next-settlement");
    await stopClean(replacement);

    const auditFixture = await connectFixture();
    await control(auditFixture, {
      ...controlMetadata(auditFixture.proofId), step: "audit.initialize", stepNumber: 1,
      activationIds: [firstActivation.activationId, secondActivation.activationId],
      expectedReceipts: [first.receipt, next.receipt],
    }, "audit");
    await stopClean(auditFixture.owner);

    const staleFixture = await connectFixture();
    const initialized = await control(staleFixture, {
      ...controlMetadata(staleFixture.proofId), step: "stale.initialize", stepNumber: 1,
    }, "stale-initialize");
    requireProof(initialized.step === "stale.initialize", "stale-initialize");
    await control(staleFixture, {
      ...controlMetadata(staleFixture.proofId), step: "stale.release", stepNumber: 2,
    }, "stale-release");
    const liveReplacement = await spawn(false);
    const liveActivation = writable(await activate(liveReplacement, writerProofStaleProjectId), 2);
    requireProof(liveActivation.activationId !== initialized.activationId && !staleFixture.owner.terminal,
      "stale-attempt");
    const attempt = await control(staleFixture, {
      ...controlMetadata(staleFixture.proofId), step: "stale.attempt", stepNumber: 3,
      replacementActivationId: liveActivation.activationId, replacementWriterGeneration: 2,
    }, "stale-attempt");
    requireProof(attempt.step === "stale.attempt" && attempt.activationId === initialized.activationId &&
      attempt.replacementActivationId === liveActivation.activationId &&
      !staleFixture.owner.terminal && !liveReplacement.terminal, "stale-attempt");
    await control(staleFixture, {
      ...controlMetadata(staleFixture.proofId), step: "stale.finish", stepNumber: 4,
    }, "stale-finish");
    await stopClean(staleFixture.owner);
    await stopClean(liveReplacement);
    checkAdmission();
  } catch (error) {
    proofFault.record(error instanceof WriterProofError ? error.stage : "internal");
  } finally {
    // Cleanup waits ignore proof failures/abort, not ownership. Never forget an unreaped child.
    const cleanupDeadline = performance.now() + writerProofLimits.cleanupMs;
    await Promise.all(owned.map(async (owner, processIndex) => {
      if (!owner.terminal) {
        try {
          if (!owner.spawned) {
            await owner.waitUntil(() => owner.spawned || owner.terminal, {
              mode: "cleanup", deadline: cleanupDeadline, stage: "cleanup", allowTerminal: true,
            });
          }
          if (!owner.terminal) owner.hardKill();
        } catch {
          recordCleanupFailure(processIndex, "cleanup");
        }
        try {
          await owner.waitUntil(() => owner.terminal, {
            mode: "cleanup", deadline: cleanupDeadline, stage: "cleanup", allowTerminal: true,
          });
        } catch {
          recordCleanupFailure(processIndex, "cleanup");
        }
      }
      if (owner.terminal) {
        try {
          await owner.waitUntil(() => owner.drained, {
            mode: "cleanup", deadline: performance.now() + writerProofLimits.drainMs,
            stage: "stdio-drain", allowTerminal: true,
          });
        } catch {
          recordCleanupFailure(processIndex, "stdio-drain");
        }
      }
    }));
    cleanupSafe = owned.every((owner) => owner.terminal && owner.drained);
    for (const [processIndex, owner] of owned.entries()) {
      if (!owner.terminal || !owner.drained) continue;
      try { owner.disposeTerminalObservation(); } catch { recordCleanupFailure(processIndex, "cleanup"); }
    }
    if (!cleanupSafe) proofFault.record("cleanup");
    input.signal.removeEventListener("abort", onAbort);
  }
  const failure = proofFault.first;
  return failure === undefined
    ? { status: "passed", cleanupSafe: true }
    : {
        status: "failed", stage: failure.stage, cleanupSafe,
        cleanupFailures: Object.freeze([...cleanupFailures]),
      };
}
```

### apps/desktop/src/main/project-storage-package-smoke.ts:1-100 - MODIFY
Drive packaged activation, contention, crash release, and stale-fence proof through authorized temporary Project storage.

Replace the protocol import and remove only the old healthyProjectId declaration. The alias has exactly the previous parsed UUID value; characterize bootstrap create/open identity before and after the move. Replace the scenario union/parser/dispatch below, preserving the bridge import, ordinary scenario bodies, other IDs, and diagnostic helpers. The private runner owns writer-proof execution; accidental ordinary dispatch rejects explicitly.

```ts
import {
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  writerProofProjectId as healthyProjectId,
} from "@slopstop/protocol";

export type ProjectStoragePackageSmokeScenario =
  | "bootstrap"
  | "writer-proof"
  | "missing-runtime"
  | "witnessed-staging";

export function parseProjectStoragePackageSmokeScenario(
  value: unknown,
): ProjectStoragePackageSmokeScenario {
  switch (value) {
    case "bootstrap":
    case "writer-proof":
    case "missing-runtime":
    case "witnessed-staging":
      return value;
    default:
      throw new Error("Invalid packaged Project Storage scenario.");
  }
}

export async function runProjectStoragePackageSmoke(
  input: Readonly<{
    bridge: ProjectStorageBridgeClient;
    scenario: ProjectStoragePackageSmokeScenario;
  }>,
): Promise<void> {
  switch (input.scenario) {
    case "bootstrap":
      await runBootstrapScenario(input.bridge);
      return;
    case "writer-proof":
      throw new Error("Writer proof requires the private process owner.");
    case "missing-runtime":
      await runMissingRuntimeScenario(input.bridge);
      return;
    case "witnessed-staging":
      await runWitnessedStagingScenario(input.bridge);
  }
}
```

### apps/desktop/src/main/package-smoke-verifier.ts:1-160 - MODIFY
Report stable, path-safe proof stages for native Writer scenarios.

Add these imports/declarations to the existing module, preserving its renderer verification and isRecord helper. Native preflight loads only the lease package, never libSQL or harness source. It permits only the exact ASAR virtual or corresponding physical unpacked target, restores the synchronous dlopen observer in finally, and exposes no private cause. The fixture independently validates the same native origin before importing native-dependent modules.

```ts
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  WriterProofNativeTargetSchema,
  writerProofNativeBindingFilename,
  writerProofNativePackageVersion,
} from "@slopstop/protocol";

export const writerProofPassedMessage = "Package smoke writer proof passed.";
export const writerProofTerminalMessage = "Package smoke writer processes terminal.";
export const writerProofUnconfirmedMessage = "Package smoke writer process exit unconfirmed.";

export type WriterProofStage =
  | "native-preflight" | "spawn" | "handshake" | "transport" | "unexpected-message"
  | "inactive" | "activate" | "first-settlement" | "contention" | "read-only"
  | "hard-kill" | "takeover" | "replay" | "stale-activation" | "next-settlement"
  | "audit" | "stale-initialize" | "stale-release" | "stale-attempt" | "stale-finish"
  | "clean-stop" | "process-exit" | "stdio-drain" | "output-bound" | "cancelled"
  | "proof-deadline" | "cleanup" | "internal";

export class WriterProofError extends Error {
  override readonly name = "WriterProofError";
  constructor(readonly stage: WriterProofStage) {
    super("Packaged Writer proof failed.");
  }
}

export function requireWriterProof(condition: boolean, stage: WriterProofStage): asserts condition {
  if (!condition) throw new WriterProofError(stage);
}

export function verifyPackagedWriterNative(input: Readonly<{
  resourcesPath: string;
  mainBundleDirectory: string;
}>): void {
  try {
    const target = WriterProofNativeTargetSchema.parse(`${process.platform}-${process.arch}`);
    const relativePackage = path.join(".vite", "build", "node_modules", "fs-native-extensions");
    const virtualRoot = path.join(input.resourcesPath, "app.asar", relativePackage);
    const unpackedRoot = path.join(input.resourcesPath, "app.asar.unpacked", relativePackage);
    const binarySuffix = path.join("prebuilds", target, writerProofNativeBindingFilename);
    const virtualBinding = path.join(virtualRoot, binarySuffix);
    const unpackedBinding = path.join(unpackedRoot, binarySuffix);
    const entry = lstatSync(unpackedBinding);
    requireWriterProof(entry.isFile() && !entry.isSymbolicLink() && entry.size > 0, "native-preflight");
    requireWriterProof(realpathSync.native(unpackedBinding) === unpackedBinding, "native-preflight");
    const manifest: unknown = JSON.parse(readFileSync(path.join(virtualRoot, "package.json"), "utf8"));
    requireWriterProof(isRecord(manifest) && manifest["name"] === "fs-native-extensions" &&
      manifest["version"] === writerProofNativePackageVersion, "native-preflight");
    const requireFromHarness = createRequire(path.join(input.mainBundleDirectory, "harness.cjs"));
    requireWriterProof(requireFromHarness.resolve("fs-native-extensions") === path.join(virtualRoot, "index.js"),
      "native-preflight");
    const originalDlopen = process.dlopen;
    let loads = 0;
    process.dlopen = (module, filename, flags) => {
      requireWriterProof(filename === virtualBinding || filename === unpackedBinding, "native-preflight");
      loads += 1;
      return originalDlopen.call(process, module, filename, flags);
    };
    try {
      const native: unknown = requireFromHarness("fs-native-extensions");
      requireWriterProof(loads === 1 && isRecord(native) &&
        typeof native["tryLock"] === "function" && typeof native["unlock"] === "function", "native-preflight");
    } finally {
      process.dlopen = originalDlopen;
    }
  } catch {
    throw new WriterProofError("native-preflight");
  }
}
```

### apps/desktop/src/main/main.ts:1-310 - MODIFY
Compose the packaged canonical Project proof without exposing its private inputs to the renderer.

These are scoped MODIFY sections, not a replacement full main implementation. Add imports/helper/state; replace only bootstrap's app.whenReady line with the early private branch; replace the two quit/window handlers; insert the exceptional guard at the start of startBootstrap's catch. Preserve all other ordinary startup and reporting code. The branch precedes normal logging/Sentry, supervisor, window/security/session, and IPC registration. Main ignores cleanupFailures and emits only the original stage and fixed terminal/pass metadata.

```ts
import { runCanonicalWriterPackageSmoke } from "./canonical-writer-package-smoke.js";
import {
  writerProofPassedMessage,
  writerProofTerminalMessage,
  writerProofUnconfirmedMessage,
} from "./package-smoke-verifier.js";

let writerProofAbort: AbortController | undefined;

async function runPrivateWriterProof(authorization: PackageSmokeAuthorization): Promise<void> {
  const controller = new AbortController();
  writerProofAbort = controller;
  const result = await runCanonicalWriterPackageSmoke({
    bootstrap: createProjectStorageHarnessBootstrap({
      userDataRoot: authorization.root,
      migrationResourcesRoot: projectStorageMigrationResourcesRoot({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        mainBundleDirectory: __dirname,
      }),
    }),
    mainBundleDirectory: __dirname,
    resourcesPath: process.resourcesPath,
    signal: controller.signal,
  });
  const lines: string[] = [result.cleanupSafe ? writerProofTerminalMessage : writerProofUnconfirmedMessage];
  if (result.status === "passed") {
    packageSmokeState = "passed";
    lines.push(writerProofPassedMessage);
  } else {
    lines.push(`Package smoke proof failed at writer-${result.stage}.`);
  }
  // Flush fixed metadata before app.exit; a missing/truncated line makes outer cleanup conservative.
  await new Promise<void>((resolve, reject) => {
    process.stderr.write(`${lines.join("\n")}\n`, (error) => {
      if (error) reject(new Error("Writer proof terminal reporting failed."));
      else resolve();
    });
  });
  app.exit(result.status === "passed" ? 0 : 1);
}

// In bootstrap: replace the existing app.whenReady line with this section.
  await app.whenReady();
  if (packageSmokeAuthorization?.scenario === "writer-proof") {
    packageSmokeTask = runPrivateWriterProof(packageSmokeAuthorization);
    await packageSmokeTask;
    return;
  }

// Replace the existing main-level quit/window handlers.
app.on("before-quit", (event) => {
  if (writerProofAbort !== undefined) {
    event.preventDefault();
    writerProofAbort.abort();
    return;
  }
  desktopShutdown.beforeQuit(event);
});

app.on("window-all-closed", () => {
  if (writerProofAbort !== undefined) return;
  if (packageSmokeState === "pending") {
    if (packageSmokeTask === undefined) {
      packageSmokeTask = desktopShutdown.requestExit(1);
    }
    return;
  }
  if (process.platform !== "darwin") app.quit();
});

// In startBootstrap's catch: insert before the ordinary sanitized startup report.
      if (writerProofAbort !== undefined) {
        process.stderr.write(`${writerProofUnconfirmedMessage}\n`, () => app.exit(1));
        return;
      }
```

### apps/desktop/vite.harness.config.ts:88-151 - MODIFY
Externalize and stage `fs-native-extensions` and its exact runtime dependency closure.

S7 preserves the full S3 collectRuntimePackages/stageHarnessRuntime behavior, adds the second entry to the one existing build, and uses distinct stable entry filenames. Shared chunks may contain common production modules, but test entry side effects must remain reachable only from writer-proof-fixture.cjs. Verify the built graph; do not add a competing staging build or production fixture import.

```ts
async function collectRuntimePackages(): Promise<ReadonlyMap<string, string>> {
  const packages = new Map<string, string>();
  const collect = async (packageName: string, fromRoot: string): Promise<void> => {
    const packageRoot = await resolveInstalledPackageRoot(packageName, fromRoot);
    const current = packages.get(packageName);
    if (current !== undefined) {
      if (current !== packageRoot) {
        throw new Error(`Conflicting staged versions found for ${packageName}.`);
      }
      return;
    }
    const manifest = await readPackageManifest(path.join(packageRoot, "package.json"));
    if (manifest === undefined) {
      throw new Error(`Could not read package manifest for ${packageName}.`);
    }
    packages.set(packageName, packageRoot);
    await Promise.all(manifest.dependencies.map((dependency) => collect(dependency, packageRoot)));
  };

  await Promise.all(
    ["@libsql/client", "fs-native-extensions", "libsql", "zod"].map((packageName) =>
      collect(packageName, harnessRoot),
    ),
  );
  const libsqlRoot = packages.get("libsql");
  if (libsqlRoot === undefined) {
    throw new Error("libsql was not included in the staged runtime.");
  }
  await Promise.all(targetBindingPackages().map((packageName) => collect(packageName, libsqlRoot)));
  return packages;
}

export default defineConfig({
  plugins: [stageHarnessRuntime()],
  build: {
    lib: {
      entry: {
        harness: "../harness/src/process-entry.ts",
        "writer-proof-fixture": "../harness/tests/integration/canonical-writer-package-smoke-entry.ts",
      },
      fileName: (_format, entryName) => `${entryName}.cjs`,
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [...nodeBuiltins, "fs-native-extensions", "libsql"],
      output: { chunkFileNames: "harness-chunks/[name]-[hash].cjs" },
    },
  },
});
```

### apps/desktop/forge.config.ts:45-49 - MODIFY
Replace only the existing harness object in VitePlugin.build; keep its entry contract aligned with Vite while preserving all packager resources, auto-unpack, concurrency, renderer entries, and fuses.

```ts
        {
          entry: {
            harness: "../harness/src/process-entry.ts",
            "writer-proof-fixture": "../harness/tests/integration/canonical-writer-package-smoke-entry.ts",
          },
          config: "vite.harness.config.ts",
          target: "main",
        },
```

### apps/desktop/tests/e2e/package-smoke.mjs:1-650 - MODIFY
Inspect unpacked native resources and orchestrate independent packaged-process contention and crash scenarios.

This existing executable proof-tooling target is the approved exception to the no-test-source Architecture rule. Add only realpath/createHash to the corresponding existing imports and add constants/output classifier below. Replace assertPackagedNativeBindings, launchPackagedApp, and inspectHealthyGeneration; insert the marked writer assertion into launchScenario before its existing proofFailure parsing; replace only runPackageSmoke's bootstrap-through-runtime-removal section and the final summary; add the fixed preservation notice in the final catch. Keep the authorization matrix, migration/libSQL checks, ordinary scenarios, and all remaining finally guards.

Keep isolatePackagedOutput entirely unchanged. Its same-volume sibling rename preserves the Linux chrome-sandbox root ownership/mode set by CI before launch, and its existing cleanupSafe guard withholds restore/removal. Do not add cp, a second restore topology, root workaround, or sandbox exception. Native version/hash/origin checks remain mandatory under that isolation.

The exact success grammar is empty stdout, terminal+LF+pass+LF, exit0. Safe failure cleanup is empty stdout, terminal+LF+fixed writer-stage failure+LF, exit1. Stage is 1-32 ASCII lowercase letters/hyphens in nonempty letter groups separated by single hyphens. Full-match equality rejects extra final newlines as well as prefixes/suffixes, reversed/missing lines, whitespace output, carriage returns, paths, and private text. This lexical black-box expectation does not duplicate runtime stage membership. Timeout revokes cleanup immediately even if main subsequently closes; a main kill is not descendant-process proof.

```js
import { realpath } from "node:fs/promises";
import { createHash } from "node:crypto";

const writerSmokeTimeoutMs = 120_000;
const writerProofPassedOutput = "Package smoke writer proof passed.\n";
const writerProofTerminalOutput = "Package smoke writer processes terminal.\n";
const writerBindingSha256 = Object.freeze({
  "win32-x64": "3T+OsdU0QfFRVRyEoSEceVJLHqt0/4Ork+aAN/OZe6Q=",
  "linux-x64": "E2V9t86S+CPugGbMckTzpHU0Bwf8Bl/U9azu67+omMM=",
  "linux-arm64": "iV3Q3KCUOEVPKLuiULyvo+ack3/pfqRrG2IS3DqBMVw=",
  "darwin-x64": "lz5LKt3zCQG5VcdWJqwVPTo3zrz6YhN1vNSQ8ZmITI4=",
  "darwin-arm64": "HpO3TlVrfRdn1X+rsZfZ0d9WQUU5ZxcFNyePcu1G8Bg=",
});

function inspectWriterProofOutput(code, stdout, stderr) {
  if (stdout !== "") return "unconfirmed";
  if (code === 0 && stderr === writerProofTerminalOutput + writerProofPassedOutput) return "passed";
  if (code !== 1 || !stderr.startsWith(writerProofTerminalOutput)) return "unconfirmed";
  const failureLine = stderr.slice(writerProofTerminalOutput.length);
  const failure = /^Package smoke proof failed at writer-([a-z]+(?:-[a-z]+)*)\.\n$/u.exec(failureLine);
  return failure !== null && failure[0] === failureLine && failure[1].length <= 32
    ? "failed-terminal"
    : "unconfirmed";
}

async function assertPackagedNativeBindings(resources) {
  const nativeRoot = path.join(resources, "app.asar.unpacked");
  const bindings = await collectNodeBindings(nativeRoot);
  for (const targetPrefix of targetBindingPrefixes()) {
    const found = bindings.some((binding) => {
      const packagedPath = path.relative(nativeRoot, binding).split(path.sep).join("/");
      return packagedPath.startsWith(`.vite/build/node_modules/@libsql/${targetPrefix}`);
    });
    if (!found) throw new Error("Packaged SlopStop is missing the target libSQL native binding.");
  }
  const target = `${process.platform}-${process.arch}`;
  const expectedHash = writerBindingSha256[target];
  if (expectedHash === undefined) throw new Error("Packaged SlopStop has no approved Writer native target.");
  const leaseBinding = path.join(nativeRoot, ".vite", "build", "node_modules", "fs-native-extensions",
    "prebuilds", target, "fs-native-extensions.node");
  const entry = await lstat(leaseBinding);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size === 0 ||
      await realpath(leaseBinding) !== leaseBinding || !bindings.includes(leaseBinding)) {
    throw new Error("Packaged SlopStop is missing the exact target Writer native binding.");
  }
  if (createHash("sha256").update(await readFile(leaseBinding)).digest("base64") !== expectedHash) {
    throw new Error("Packaged SlopStop Writer binding is not the pinned prebuild.");
  }
}

async function launchPackagedApp({ root, token, scenario }) {
  return new Promise((resolve) => {
    const executable = packagedExecutable();
    const env = { ...process.env, SLOPSTOP_PACKAGE_SMOKE: "1" };
    if (process.env["CI"] === "true") env.SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS = "1";
    else delete env.SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS;
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    for (const [key, value] of [
      ["SLOPSTOP_PACKAGE_SMOKE_SCENARIO", scenario],
      ["SLOPSTOP_PACKAGE_SMOKE_TOKEN", token],
      ["SLOPSTOP_PACKAGE_SMOKE_USER_DATA", root],
    ]) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    const duration = scenario === "writer-proof" ? writerSmokeTimeoutMs : smokeTimeoutMs;
    let child;
    let standardOutput = "";
    let stdoutOverflow = false;
    let errorOutput = "";
    let stderrOverflow = false;
    let spawnFailed = false;
    let timedOut = false;
    let settled = false;
    let timeout;
    let terminalTimeout;
    const settle = (code, closed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(terminalTimeout);
      const writerTerminal = scenario !== "writer-proof" || (
        inspectWriterProofOutput(code, standardOutput, errorOutput) !== "unconfirmed" &&
        !stdoutOverflow && !stderrOverflow && !spawnFailed && !timedOut && closed
      );
      if (!closed || timedOut || !writerTerminal) cleanupSafe = false;
      resolve({ code, closed, spawnFailed, timedOut, stdout: standardOutput,
        stderr: errorOutput, stdoutOverflow, stderrOverflow });
    };
    try {
      child = spawn(executable, [], {
        cwd: path.dirname(executable), env, stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      spawnFailed = true;
      settle(null, false);
      return;
    }
    child.on("error", () => { spawnFailed = true; });
    child.stdout.on("error", () => { spawnFailed = true; cleanupSafe = false; });
    child.stderr.on("error", () => { spawnFailed = true; cleanupSafe = false; });
    child.stdout.on("data", (chunk) => {
      const combined = `${standardOutput}${String(chunk)}`;
      stdoutOverflow ||= combined.length > maxStderrCharacters;
      standardOutput = combined.slice(0, maxStderrCharacters);
    });
    child.stderr.on("data", (chunk) => {
      const combined = `${errorOutput}${String(chunk)}`;
      stderrOverflow ||= combined.length > maxStderrCharacters;
      errorOutput = combined.slice(0, maxStderrCharacters);
    });
    child.once("close", (code) => settle(code, true));
    timeout = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      cleanupSafe = false;
      try { child.kill("SIGKILL"); } catch { spawnFailed = true; }
    }, duration);
    terminalTimeout = setTimeout(() => {
      if (settled) return;
      cleanupSafe = false;
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      settle(null, false);
    }, duration + terminalCloseTimeoutMs);
  });
}

// In launchScenario: insert after the awaited launch, before existing proofFailure parsing.
  if (scenario === "writer-proof") {
    const output = inspectWriterProofOutput(launch.code, launch.stdout, launch.stderr);
    const unsafe = !launch.closed || launch.timedOut || launch.spawnFailed ||
      launch.stdoutOverflow || launch.stderrOverflow || output === "unconfirmed";
    if (unsafe) cleanupSafe = false;
    if (unsafe || output !== "passed") {
      activeSmokeStage = "writer-proof incomplete or failed";
      throw new Error("Packaged SlopStop Writer proof did not complete.");
    }
  }

async function inspectHealthyGeneration(root) {
  const projectRoot = path.join(root, "storage", "projects", healthyProjectId);
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const companions = entries.filter((entry) => entry.name === ".slopstop-writer.lock");
  if (companions.length > 1 || companions.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    throw new Error("Packaged SlopStop Writer companion is not a plain file.");
  }
  const generations = entries.filter((entry) => entry.name !== ".slopstop-writer.lock");
  if (!isPlainGenerationEntry(generations)) {
    throw new Error("Packaged SlopStop did not create one plain active generation.");
  }
  const entry = generations[0];
  const generationRoot = path.join(projectRoot, entry.name);
  const generationEntry = await lstat(generationRoot);
  if (!generationEntry.isDirectory() || generationEntry.isSymbolicLink()) {
    throw new Error("Packaged SlopStop generation is not a plain directory.");
  }
  const manifest = JSON.parse(await readFile(path.join(generationRoot, "manifest.json"), "utf8"));
  if (!generationManifestAgrees(manifest, entry.name)) {
    throw new Error("Packaged SlopStop generation manifest does not agree.");
  }
  return generationRoot;
}

// In runPackageSmoke: replace bootstrap through removeClosedRuntimeDatabase only.
      activeSmokeStage = "bootstrap scenario";
      await launchScenario(root, token, "bootstrap");
      const generationRoot = await inspectHealthyGeneration(root);
      activeSmokeStage = "writer-proof scenario";
      await launchScenario(root, token, "writer-proof");
      const afterWriterGeneration = await inspectHealthyGeneration(root);
      if (afterWriterGeneration !== generationRoot) {
        throw new Error("Packaged SlopStop Writer proof replaced the Storage generation.");
      }
      const companion = await lstat(path.join(path.dirname(generationRoot), ".slopstop-writer.lock"));
      if (!companion.isFile() || companion.isSymbolicLink()) {
        throw new Error("Packaged SlopStop Writer proof did not retain its companion witness.");
      }
      await removeClosedRuntimeDatabase(generationRoot);

// Replace the final successful summary literal.
  process.stdout.write("Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.\n");

// In the final catch: add the fixed preservation notice without changing failure handling.
  if (!cleanupSafe) {
    process.stderr.write("Package smoke cleanup withheld; isolated roots and package retained.\n");
  }
```

### pnpm-workspace.yaml:14-68 - MODIFY
Pin the native lease package in the workspace catalog and permit its required install build when applicable.

```yaml
overrides:
  "@electron/node-gyp": 10.2.0-electron.1
  bare-module-resolve: 1.12.5

catalog:
  fs-native-extensions: 1.5.1

minimumReleaseAgeExclude:
  - bare-module-resolve@1.12.5
```

### pnpm-lock.yaml:7-141,269-294,2468-2485,3172-3174,4479-4481,5130-5131,7431-7440,8131-8136,9277-9281,9916 - MODIFY
Record the exact native lease dependency graph and integrity metadata.

```yaml
catalogs:
  default:
    fs-native-extensions:
      specifier: 1.5.1
      version: 1.5.1

overrides:
  '@electron/node-gyp': 10.2.0-electron.1
  bare-module-resolve: 1.12.5

importers:
  apps/harness:
    dependencies:
      fs-native-extensions:
        specifier: 'catalog:'
        version: 1.5.1

packages:
  bare-addon-resolve@1.10.1:
    resolution: {integrity: sha512-F/SD2du8keuYSb4xipnGz5j2E6yhNdHA8ZVxtHae6h2uOrpBIjjbhXvjzKZbr5XUOzqBzh/i8GVFycj2DlFQIA==}
    peerDependencies:
      bare-url: '*'
    peerDependenciesMeta:
      bare-url:
        optional: true

  bare-module-resolve@1.12.5:
    resolution: {integrity: sha512-VOncxVvVk8SQVw9vhcBnoTJD/74aR5DgdRPCm0gQ7uB5MsWpBJnoCeJrwEHKiz09O83ndf3NTjsz3LEuFxAq5A==}
    peerDependencies:
      bare-url: '*'
    peerDependenciesMeta:
      bare-url:
        optional: true

  bare-semver@1.1.0:
    resolution: {integrity: sha512-1Hw5qJ7hXdVt3uPUqjeFTuxyvBUJauvz5A1I2jk8gzjZMHp04n//6nV9MDbG9CMw78JHY2lGV0w6s//LrASm2w==}

  fs-native-extensions@1.5.1:
    resolution: {integrity: sha512-abjiHKkYdcH5M9ikBEJb0MKb/fEpPtZx/yfLHzTptvUAoiFayX0tIe0BTLBU4SAoRyjZLzA0dP1Rn2p0+QRyVg==}

  require-addon@1.2.0:
    resolution: {integrity: sha512-VNPDZlYgIYQwWp9jMTzljx+k0ZtatKlcvOhktZ/anNPI3dQ9NXk7cq2U4iJ1wd9IrytRnYhyEocFWbkdPb+MYA==}
    engines: {bare: '>=1.10.0'}

  which-runtime@1.4.0:
    resolution: {integrity: sha512-0ugbP4CJW4e2D20jvEcC4973dCgIaHI4Rw1PT+26U9zEve7FyYdWAIwUnoeOYvoCfn+wXHoHTKb1KhkYlb60Pw==}

snapshots:
  bare-addon-resolve@1.10.1:
    dependencies:
      bare-module-resolve: 1.12.5
      bare-semver: 1.1.0

  bare-module-resolve@1.12.5:
    dependencies:
      bare-semver: 1.1.0

  bare-semver@1.1.0: {}

  fs-native-extensions@1.5.1:
    dependencies:
      require-addon: 1.2.0
      which-runtime: 1.4.0
    transitivePeerDependencies:
      - bare-url

  require-addon@1.2.0:
    dependencies:
      bare-addon-resolve: 1.10.1
    transitivePeerDependencies:
      - bare-url

  which-runtime@1.4.0: {}
```

## Slices

### Slice 1: Correlated Request Failure

**Files**: `packages/protocol/src/protocol.ts`, `packages/protocol/src/index.ts`, `apps/harness/src/harness-runtime.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/project-storage-bridge.ts`, `apps/desktop/src/main/workspace-bridge.ts`

#### Test Contract:

- **Behavior**: Protocol version 4 distinguishes causally scoped request failure from process-global system failure.
  - Test: `parses only correctly scoped failure events at protocol version 4` -> `packages/protocol/src/protocol.test.ts`
  - Oracle: `request.failure` with `protocolVersion: 4`, `messageType: "event"`, message ID `00000000-0000-4000-8000-000000000101`, `sentAt: "2026-09-04T12:00:00.000Z"`, sequence `7`, causation ID `00000000-0000-4000-8000-000000000102`, and payload `{ code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false }` parses to that exact object; replacing causation with `null` fails at `causationId`; the identical `system.failure` object with `causationId: null` parses, while replacing null with `00000000-0000-4000-8000-000000000102` fails at `causationId`; the same request envelope with `protocolVersion: 3` returns exactly `{ ok: false, error: { code: "PROTOCOL_VERSION_UNSUPPORTED", issues: [{ code: "unsupported_value", path: "protocolVersion" }] } }`.
  - Expected red: after the preceding supervisor and runtime behaviors, the intermediate union admits `request.failure` at version 4 but still accepts correlated `system.failure`. The assertion rejecting non-null system causation fails; finish the strict system scope without changing the already-proven request scope.
- **Behavior**: The harness scopes a rejected request handler to the recoverable request ID over a real MessagePort without exposing the exception.
  - Test: `round-trips a request handler failure without escalating the process` -> `apps/harness/tests/integration/harness-runtime.integration.test.ts`
  - Oracle: in a fresh runtime whose Project open rejects with `new Error("sensitive failure")`, command ID `00000000-0000-4000-8000-000000000201` yields exactly `{ protocolVersion: 4, messageType: "event", messageId: "00000000-0000-4000-8000-000000000002", sentAt: "2026-08-14T12:00:01.000Z", sequence: 1, causationId: "00000000-0000-4000-8000-000000000201", event: "request.failure", payload: { code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false } }`; serialized output does not contain `sensitive failure`.
  - Expected red: the current runtime emits correlated `system.failure` for a rejected handler.
- **Behavior**: Parse failures are request-scoped only when the incoming identity is valid, while identity-less input and invalid notifications remain process-global.
  - Test: `chooses failure scope from recoverable causation` -> `apps/harness/src/harness-runtime.test.ts`
  - Oracle: each case uses a fresh runtime with generated event ID `00000000-0000-4000-8000-000000000002`, `sentAt: "2026-08-14T12:00:01.000Z"`, and sequence `1`; malformed command `{ protocolVersion: 4, messageType: "command", messageId: "00000000-0000-4000-8000-000000000202", sentAt: "2026-08-14T12:00:00.000Z", command: "unknown", payload: {} }` emits `request.failure` caused by `00000000-0000-4000-8000-000000000202` with `{ code: "PROTOCOL_MESSAGE_INVALID", message: "Harness received an invalid protocol message.", retryable: false }`; `{ invalid: true }` emits the same envelope as `system.failure` with null causation; invalid notification `{ capability: "memory" }` emits `system.failure` with null causation and `{ code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false }`.
  - Expected red: the malformed command with a recoverable request ID still emits correlated `system.failure` instead of `request.failure`. Handler exceptions are already request-scoped from the preceding behavior; identity-less input and invalid notifications retain their existing process-global behavior as regression assertions.
- **Behavior**: A Desktop bridge settles only the request named by `request.failure` and leaves unrelated pending Project Storage work available for its normal terminal result.
  - Test: `request failure settles only its correlated Project Storage operation` -> `apps/desktop/src/main/project-storage-bridge.test.ts`
  - Oracle: with create command `00000000-0000-4000-8000-000000000301` for `{ projectId: "00000000-0000-4000-8000-000000000010", createRequestId: "00000000-0000-4000-8000-000000000011" }` and open command `00000000-0000-4000-8000-000000000302` for `{ projectId: "00000000-0000-4000-8000-000000000010" }` pending, `request.failure` caused by `00000000-0000-4000-8000-000000000301` resolves create exactly to `{ status: "broken", request: { projectId: "00000000-0000-4000-8000-000000000010", createRequestId: "00000000-0000-4000-8000-000000000011" }, diagnostic: { code: "PROJECT_STORAGE_TRANSPORT_FAILED", message: "Harness failed while handling a message." } }`; open remains pending through one microtask, then matching `project.open.result` resolves it exactly to `{ status: "not-registered", request: { projectId: "00000000-0000-4000-8000-000000000010" } }`.
  - Expected red: the current bridge ignores a valid but unhandled `request.failure`, leaving the correlated create operation pending instead of resolving its exact broken result. Observe that missing settlement through a bounded microtask probe, not a test timeout; the unrelated open operation must remain pending until its own result.
- **Behavior**: Workspace request failure is isolated by causation across query and intent operations.
  - Test: `request failure settles only its correlated Workspace request` -> `apps/desktop/src/main/workspace-bridge.test.ts`
  - Oracle: with memory query command `00000000-0000-4000-8000-000000000401` for `{ query: "memory-library.read", projectId: "00000000-0000-4000-8000-000000000010", cursor: null }` and memory intent command `00000000-0000-4000-8000-000000000402` for `{ intent: "memory.proposal.review", projectId: "00000000-0000-4000-8000-000000000010", proposalId: "00000000-0000-4000-8000-000000000030", decision: "accept", expectedProjectionRevision: 0 }` pending, `request.failure` caused by `00000000-0000-4000-8000-000000000401` resolves the query exactly to `{ status: "broken", query: { query: "memory-library.read", projectId: "00000000-0000-4000-8000-000000000010", cursor: null }, diagnostic: { code: "WORKSPACE_TRANSPORT_FAILED", message: "Harness failed while handling a message." } }`; the intent remains pending through one microtask, then its matching result resolves exactly to `{ status: "forwarded", capability: "memory" }`.
  - Expected red: the current Workspace bridge ignores a valid but unhandled `request.failure`, leaving the correlated query pending instead of resolving its exact broken result. Observe that missing settlement through a bounded microtask probe, not a test timeout; the unrelated intent must remain pending until its own result.
- **Behavior**: Request failure is status-neutral while system failure remains the sole failure event that crashes and quarantines a running harness.
  - Test: `keeps request failure status-neutral and reserves recovery for system failure` -> `apps/desktop/src/main/harness-supervisor.test.ts`
  - Oracle: from `{ state: "ready", attempt: 1, harnessVersion: "0.0.0" }`, request failure caused by `00000000-0000-4000-8000-000000000501` leaves that exact status and child kill count `0`; a subsequent null-caused system failure with message `Harness failed while handling a message.` changes status exactly to `{ state: "crashed", attempt: 1, canRetry: true, diagnostic: { code: "HARNESS_PROTOCOL_ERROR", message: "Harness failed while handling a message." } }` and child kill count `1`.
  - Expected red: before any Slice 1 protocol change, the session rejects raw `request.failure` input as a protocol error and the supervisor crashes and kills the child. Once admitted by the schema, the existing supervisor switch already leaves that event status-neutral; prove schema admission and make its neutral-event classification explicit in this same behavior.

#### Execution Order (2026-09-05 revision):

Execute the six behaviors above in order **6 -> 2 -> 3 -> 1 -> 4 -> 5**, completing Red, minimal Green, and review/refactor for each before beginning the next. Their named tests and exact Oracle values are unchanged.

1. Prove the supervisor behavior using raw port input at the current protocol version. Admit `request.failure` and explicitly classify it as status-neutral, without yet rejecting correlated legacy system failures.
2. Prove rejected-handler failure over the real MessagePort, then advance to version 4 and route unexpected request-handler failures through the request factory. Preserve null-caused internal failures and the still-unmigrated parse-failure path.
3. Prove malformed command causation, then route parse failures by recoverable request identity while retaining null-caused system failures.
4. Prove the full version-4 protocol matrix, whose remaining Red is acceptance of correlated `system.failure`. Enforce null-only system causation, replace the ambiguous factory, and migrate remaining global-failure fixtures to the explicitly scoped factory. No compatibility alias remains when this behavior is complete.
5. Prove and implement Project Storage failure isolation by causation.
6. Prove and implement Workspace failure isolation by causation.

The intermediate permissive system schema and old factory are uncommitted implementation steps, not a shipped compatibility contract. Do not fabricate Red for already-preserved assertions, batch multiple behavior Reds before implementation, or count import/schema-construction errors or timeouts as a required Red. Run the real-port test with `--config apps/harness/vitest.integration.config.ts` in addition to the original focused command so the root suite's integration exclusion cannot hide it.

#### Automated Verification:

- [x] Focused protocol and routing tests pass: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.test.ts`
- [x] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`
- [x] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [x] Desktop type checking passes: `pnpm --filter @slopstop/desktop typecheck`
- [x] The replaced ambiguous factory has no remaining source or test references: `rg "createFailureEvent" packages/protocol/src apps/harness/src apps/desktop/src/main` returns no matches.

#### Manual Verification:

- [x] Review all failure payloads and confirm no thrown exception text, local path, source text, or other private input crosses the process boundary.

### Slice 2: Canonical Generation 2

**Files**: `packages/kernel/src/project-storage-identifiers.ts`, `packages/kernel/src/index.ts`, `apps/harness/src/storage/canonical-schema.ts`, `apps/harness/src/storage/project-storage-database-specs.ts`, `apps/harness/src/storage/database-schema-verifier.ts`, `apps/harness/src/storage/generated-migration-resources.ts`, `apps/harness/src/storage/project-storage-node-adapters.ts`, `apps/harness/drizzle/canonical/0001_canonical_project_writer.sql`, `apps/harness/drizzle/canonical/meta/_journal.json`, `apps/harness/drizzle/canonical/meta/0001_snapshot.json`, `packages/kernel/src/project-storage-identifiers.test.ts`, `apps/harness/src/storage/project-storage-node-adapters.test.ts`, `apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql`, `apps/harness/tests/integration/project-storage-schema-cases.ts`, `apps/harness/tests/integration/project-storage-create.integration.test.ts`, `apps/harness/tests/integration/project-storage-open.integration.test.ts`

#### Test Contract:

- **Behavior**: Canonical numeric brands accept only their exact JavaScript safe-integer domains.
  - Test: `accepts only safe canonical ordering values` -> `packages/kernel/src/project-storage-identifiers.test.ts`
  - Oracle: `isWriterGeneration` and `isProjectSequence` return `true` for `1` and `9007199254740991`, and `false` for `-1`, `0`, `0.5`, `NaN`, `Infinity`, and `9007199254740992`; `isCanonicalEventOrdinal` returns `true` for `0` and `9007199254740991`, and `false` for `-1`, `0.5`, `NaN`, `Infinity`, and `9007199254740992`.
  - Expected red: no canonical Writer, Project-sequence, or event-ordinal brands or guards exist.
  - Callable-export prerequisite: import the existing identifier module as a namespace, read each named guard into `unknown`, assert it is a function, narrow with `typeof`, then exercise every exact numeric assertion above. Missing guards fail the callable-export assertion; import/compile errors, arbitrary casts, production stubs, and fallback implementations are not Red proof.
- **Behavior**: Exact-schema verification rejects column drift, including metadata SQLite otherwise exposes only through `pragma_table_xinfo`.
  - Test: `rejects canonical column-definition drift` -> `apps/harness/src/storage/project-storage-node-adapters.test.ts`
  - Oracle: against a local `DatabaseSpec.columns` inventory, changing one expected column's order, name, declared type, nullability, default expression, primary-key position, or hidden/generated value rejects with `ProjectStorageBrokenError("Database required column definition is missing.")`; retaining all expected definitions and adding one extra column rejects with `ProjectStorageBrokenError("Database contains an unexpected column definition.")`; the unchanged inventory resolves successfully.
  - Expected red: `DatabaseSpec` has no ordered column inventory and the verifier does not read `pragma_table_xinfo(?)`.
  - Use actual `TEXT`/`INTEGER` metadata values, including in unchanged fixtures. The inventory builder uppercases its own closed lowercase declaration vocabulary; observed types are compared verbatim. Quote the `notNull` alias. Keep all production schema resources at generation 1 during this behavior.
- **Behavior**: The migration loader authorizes only the pinned canonical storage-identity rebuild and rejects every unsupported variant before returning executable statements.
  - Test: `authorizes only the pinned canonical storage-identity rebuild` -> `apps/harness/src/storage/project-storage-node-adapters.test.ts`
  - Oracle: the unchanged generation-1 resource fixture returns its original migration and statements; immutable production `0000` plus the frozen successor under the exact canonical format-1/schema-2 spec and ordered journal returns the exact two original migration records with 2 and 30 statements. Every statement, including the terminal six-statement rebuild, remains unchanged. The vector pin is `e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14`, and the predecessor pin is `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`.
  - Oracle: wrong successor tag or lineage; changed predecessor bytes; absent CREATE, INSERT, DROP, RENAME, or either PRAGMA; reordered/interleaved statements; drop-only/rename-only substitutes; changed CREATE column/check/FK, copy columns/source, or rename target; duplicate rebuild/temporary CREATE; and extra temporary-name use/recreation each reject with `ProjectStorageBrokenError("Generated canonical storage identity rebuild is invalid.")`. Application/runtime scope, `__new_other`, and any other unknown created table retain `Generated migration creates an unknown table.`; trigger/view and implicit ledger retain `Generated migration creates a forbidden object.` and `Generated migration uses a forbidden implicit ledger.` respectively. Existing resource/journal failure diagnostics remain unchanged. No temporary table is allowed in the final inventory.
  - Expected red: the otherwise valid frozen successor fails with `Generated migration creates an unknown table.` because the current loader cannot authorize its consumed temporary CREATE. Use explicit local specs for small generation-1 guard fixtures rather than inheriting the changing production inventory.
- **Behavior**: One shared canonical schema change installs exact generation 2, enforces its trust-spine constraints, and preserves immutable generation-1 opening as migration-required.
  - The following three named tests and complete original Oracles are one behavior because the same schema/resource change satisfies them together. Author and run all three before any shared schema implementation; no separate later Red is claimed for already-covered constraints or compatibility.
  - Test: `creates the exact canonical generation-2 schema` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: a fresh create with Project ID `00000000-0000-4000-8000-000000000010` produces metadata `{ metadata_key: "canonical", database_kind: "canonical", format_version: 1, schema_version: 2, last_migration_id: "0001_canonical_project_writer" }`; `project_state` contains exactly `{ project_id: "00000000-0000-4000-8000-000000000010", last_project_sequence: 0, last_writer_generation: 0, created_at: "2026-09-04T12:00:00.000Z", updated_at: "2026-09-04T12:00:00.000Z" }`; `storage_identity` then contains the fixture's exact Project-scoped identity row; table names are exactly `canonical_events`, `command_idempotency`, `command_receipts`, `command_rejections`, `project_state`, `schema_metadata`, `storage_identity`, `writer_fence`, `writer_generations`, `writer_handoffs`, and `writer_recovery_records`; the exact-schema verifier accepts all declared columns, named checks, 15 indexes, and 11 foreign keys; `PRAGMA foreign_key_check` returns `[]` and `PRAGMA integrity_check` returns `ok`.
  - Expected red: fresh creation currently installs canonical schema generation 1 with only `schema_metadata` and `storage_identity`; assert metadata before querying absent tables.
  - Test: `enforces canonical generation-2 trust-spine constraints` -> `apps/harness/tests/integration/project-storage-create.integration.test.ts`
  - Oracle: isolated savepoint cases reject an invalid Project UUID, malformed SHA-256 token/fingerprint, orphan Writer generation, fence-generation/token mismatch, invalid fence state/release shape, invalid handoff predecessor shape, recovery reason/command mismatch, non-increasing resolver generation, duplicate Project sequence, idempotency/receipt mismatch, rejection attached to a non-rejected receipt, event attached to a non-applied receipt, and duplicate event ordinal; setting `project_state.last_project_sequence` to `0.5`, inserting Writer generation `1.5`, and inserting aggregate version `1.5` also reject because persisted safe integers require SQLite storage class `integer`; after each case the exact pre-case row counts for every affected table are unchanged.
  - Expected red: none of the generation-2 tables or trust-spine constraints exist; assert the required table inventory before preparing savepoint cases so missing-table errors cannot count as successful constraint rejection.
  - Test: `reports generation 1 as migration-required without mutation` -> `apps/harness/tests/integration/project-storage-open.integration.test.ts`
  - Oracle: opening the checked-in generation-1 fixture returns canonical health exactly `{ status: "migration-required", diagnostic: { code: "DATABASE_MIGRATION_REQUIRED", message: "Database migration is required." } }`; SHA-256 values for its canonical database, `schema_metadata` row serialization, manifest, and `0000_fat_doctor_octopus.sql` remain identical before and after; migration `0000_fat_doctor_octopus.sql` remains byte-identical with SHA-256 `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`.
  - Expected red: generation 1 is the current canonical target and opens as healthy.
  - Historical fixture definition: materialize the checked-in generation-1 fixture from immutable `0000` SQL with explicit original metadata `{ metadata_key: "canonical", database_kind: "canonical", format_version: 1, schema_version: 1, last_migration_id: "0000_fat_doctor_octopus" }`, exact fixture Storage identity, and matching generation-1 manifest. Reuse the existing registry/runtime fixture only for its identity/location setup; reconstruct the canonical database from historical SQL, never merely relabel generation 2. Complete all fixture construction before taking database, metadata-serialization, manifest, and migration hashes. Opening and closing must preserve them all.
- **TDD-exempt**: `0001_canonical_project_writer.sql`, `_journal.json`, and `0001_snapshot.json` are deterministic Drizzle outputs reviewed as one generated change after the schema behavior is red; no handwritten behavior belongs in them.
- **TDD-exempt**: `packages/kernel/src/index.ts` only exports the identifier vocabulary already proved by the kernel behavior test.

#### Execution Order (2026-09-05 revision):

1. Numeric callable-export/domain behavior: Red -> Green -> separate review/refactor.
2. Column-definition drift with generation-1 resources: Red -> Green -> separate review/refactor, including updated local column inventories and real SQLite metadata syntax.
3. Closed loader authorization using the frozen test-only successor: Red -> Green -> separate review/refactor; no production schema generation yet.
4. The one shared schema behavior, with all three named tests: observe generation-1 metadata, missing required table inventory, and healthy historical opening as Red before changing schema/spec/creation wiring; generate production `0001` only afterward; Green -> separate review/refactor.

The frozen SQL is independent test input. It is not an exemption to implement production schema before Red. Preserve all generated generation-1 SQL/snapshot bytes, every exact Oracle, S1 implementation/evidence, and future slices.

#### Automated Verification:

- [x] Numeric boundary tests pass: `pnpm exec vitest run packages/kernel/src/project-storage-identifiers.test.ts`
- [x] Focused schema tests pass: `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts`
- [x] The real integration files pass with explicit discovery: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts`
- [x] Loader and generator tooling regressions pass: `pnpm exec vitest run apps/harness/src/storage/generated-migrations.test.ts apps/harness/scripts/check-generated-migrations.test.mjs`
- [x] Kernel type checking passes: `pnpm --filter @slopstop/kernel typecheck`
- [x] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [x] Migration metadata is current: `pnpm --filter @slopstop/harness db:generate:check`
- [x] Historical migration bytes remain unchanged: `node -e "const fs=require('node:fs');const crypto=require('node:crypto');const p='apps/harness/drizzle/canonical/0000_fat_doctor_octopus.sql';console.log(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'))"` prints exactly `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`.

#### Manual Verification:

- [x] Review the generated migration, journal, and snapshot together; confirm migration `0000` is untouched, `storage_identity` is rebuilt without losing its Project identity, `project_state` contains only the required initial row, every other new trust-spine table is empty after fresh creation, and `project_state` is inserted before `storage_identity`.
- [x] Confirm every persisted ordering/generation/version check asserts SQLite storage class `integer` as well as its safe-integer bounds.
- [x] Review closed loader authorization, frozen fixture provenance/vector pin, actual uppercase column metadata, and the historical fixture's complete before/after no-mutation window. Confirm no temporary final table, broad exemption, or production migration of generation 1 was introduced. Generation-1 snapshot SHA-256 remains `5e26d686143d3687a458752eaa08b22ed18454094fa24b5556b2bbd0c6d34523`.

### Slice 3: Exclusive Activation

**Files**: `packages/protocol/src/canonical-project-protocol.ts`, `packages/protocol/src/canonical-project-protocol.test.ts`, `packages/protocol/src/domain-identity-schema.ts`, `packages/protocol/src/project-storage-protocol.ts`, `packages/protocol/src/project-storage-protocol.test.ts`, `packages/protocol/src/protocol.ts`, `packages/protocol/src/protocol.test.ts`, `packages/protocol/src/index.ts`, `apps/harness/src/project-storage-application.ts`, `apps/harness/src/storage/project-storage-opening.ts`, `apps/harness/src/storage/project-storage-opening.test.ts`, `apps/harness/src/storage/project-storage-manifest.ts`, `apps/harness/src/storage/project-storage-filesystem-authority.ts`, `apps/harness/src/storage/project-storage-filesystem-authority.test.ts`, `apps/harness/src/storage/project-storage-node-adapters.ts`, `apps/harness/src/storage/project-storage-node-adapters.test.ts`, `apps/harness/src/storage/project-storage-store.ts`, `apps/harness/src/storage/project-storage-store.test.ts`, `apps/harness/src/storage/local-libsql-worker-client.ts`, `apps/harness/src/storage/local-libsql-worker-client.test.ts`, `apps/harness/src/storage/canonical-writer-lease.ts`, `apps/harness/src/storage/canonical-writer-lease.test.ts`, `apps/harness/tests/integration/canonical-writer-lease.integration.test.ts`, `apps/harness/src/types/fs-native-extensions.d.ts`, `apps/harness/src/storage/canonical-command-repository.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`, `apps/harness/src/canonical-project-writer.ts`, `apps/harness/src/canonical-project-writer.test.ts`, `apps/harness/src/active-project-coordinator.ts`, `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/src/canonical-project-application.ts`, `apps/harness/src/canonical-project-application.test.ts`, `apps/harness/src/harness-runtime.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/src/process-bootstrap.ts`, `apps/harness/src/index.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`, `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`, `apps/harness/tests/integration/project-storage-create-fixture.ts`, `apps/harness/package.json`, `apps/desktop/vite.harness.config.ts`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`

#### Test Contract:

- **Behavior**: Protocol v4 accepts only strict, correlated activation and Typed-command envelopes and returns payload-free activation/admission outcomes.
  - **Test**: `parses canonical Project activation and command protocol branches` -> `packages/protocol/src/canonical-project-protocol.test.ts`, `packages/protocol/src/protocol.test.ts`
  - **Oracle**: `project.activate` for Project `00000000-0000-4000-8000-000000000010` round-trips exactly with its protocol-v4 command metadata; a read-write result contains only `{ status: "active", request, access: "read-write", activationId: "00000000-0000-4000-8000-000000000011", writerGeneration: 1 }`; a read-only result contains only the same correlation plus `{ access: "read-only", activationId: "00000000-0000-4000-8000-000000000011", writerGeneration: null, diagnostic: { code: "WRITER_UNAVAILABLE", message: "Another SlopStop process holds Project write authority.", retryable: true } }`; Typed-command version `0`, blank type, uppercase or malformed Project/activation/Command IDs, non-JSON payload, extra keys, read-only with a non-null generation or `retryable: false`, and Writer generations `0`, `0.5`, or `9007199254740992` fail parsing at the exact offending field; none of the activation or command result branches accept `writerToken`, `tokenDigest`, `canonicalDatabasePath`, or `writerLeasePath`.
  - **Expected red**: canonical activation/command schemas, messages, and factories do not exist before this slice.

- **TDD-exempt**: extracting `lowercaseDomainIdentitySchema` is a behavior-preserving refactor of protocol identity schemas. Before the move, extend the existing `validates Project Storage identities` characterization in `packages/protocol/src/project-storage-protocol.test.ts` to pin its existing diagnostics: uppercase Project IDs report `Project identity must use lowercase UUID text.`, and uppercase Storage, Storage-generation, canonical-lineage, runtime-lineage, and create-request IDs report `Identity must use lowercase UUID text.`. The lowercase, uppercase, zero, malformed, and diagnostic assertions must pass before extraction and remain unchanged and passing afterward; no new Red is claimed. Source review of `packages/protocol/src` must find exactly one lowercase identity-refinement declaration and no surviving sibling `lowercaseIdentitySchema` helper. The harness repository's unbranded persisted-UUID validation remains a separate storage-boundary schema, not a protocol identity schema.

- **Behavior**: Project Storage database release shares one in-flight attempt, retries only failed lower-level closes, and becomes idempotent after success.
  - **Test**: `retries only unfinished opening database closes` -> `apps/harness/src/storage/project-storage-opening.test.ts`, `apps/harness/src/storage/project-storage-node-adapters.test.ts`
  - **Oracle**: two concurrent release calls are the same promise; canonical close succeeds once while runtime close fails once, so the first attempt rejects with exactly one ordered runtime error; the next release retries runtime only and succeeds; later release calls resolve without repeating either client close; when both first closes fail, the `AggregateError` preserves canonical then runtime order.
  - **Expected red**: `createOpeningRelease` permanently caches a rejected promise and cannot retry unfinished database clients.

- **Behavior**: A worker-backed libSQL client shares concurrent close, rejects new work after close starts, and permits close retry after rejection.
  - **Test**: `retries a rejected worker client close without reopening the client` -> `apps/harness/src/storage/local-libsql-worker-client.test.ts`
  - **Oracle**: concurrent close calls issue one `close-client` request and share its promise; after that request rejects, execute and transaction still reject `Local libSQL client is closed.` while the next close issues one retry; after success, every later close returns the completed attempt without issuing another worker request.
  - **Expected red**: `WorkerLocalLibsqlClient` permanently caches the first rejected close promise.

- **Behavior**: Project Storage exposes a separately retained activation session and deletes ordinary and activation ownership only after successful close.
  - **Test**: `retains Project Storage sessions until close succeeds` -> `apps/harness/src/storage/project-storage-store.test.ts`, `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`, `apps/harness/tests/integration/project-storage-create-fixture.ts`
  - **Oracle**: healthy activation for Project `00000000-0000-4000-8000-000000000010` returns `{ status: "ready", session: { mode: "read-write", canonicalDatabasePath: "active/slopstop.db", writerLeasePath: "project/.slopstop-writer.lock" } }`; a first close rejection retains the same ordinary or activation entry, owner shutdown retries it, and the underlying release call count becomes `2`; successful entries are deleted and never closed again; ordinary open sessions and activation sessions are tracked independently, so `project.open` remains inspection rather than activation; the shared integration fixture supplies the now-required `CanonicalProjectApplication` dependency with `activate` and `execute` methods that reject if invoked and a `stop` method that resolves, and Project Storage-only journeys never invoke those canonical methods.
  - **Expected red**: Project Storage has no activation port or canonical/lease path result, and rejected lower-level close attempts cannot complete on retry.

- **Behavior**: The Writer companion is a controlled Project-root plain-file witness and never a generation artifact.
  - **Test**: `classifies the canonical Writer lease only at the Project root` -> `apps/harness/src/storage/project-storage-filesystem-authority.test.ts`
  - **Oracle**: a plain Project-root `.slopstop-writer.lock` records exactly `writer-lease`, does not set `hasRootDatabaseWitness`, and does not enter a generation manifest, checksum, snapshot, or export; the same name as a symlink, directory, or generation-directory entry throws the existing stable invalid-witness diagnostic; an otherwise clean unregistered root containing the lease file is not reported as clean absence.
  - **Expected red**: the companion filename is unknown to the filesystem authority and no `writer-lease` witness kind exists.

- **Behavior**: The native factory holds exclusive byte range `[0,1)` against a real cooperative peer process and permits takeover only after release.
  - **Test**: `holds one native byte-range lease across independent descriptors` -> `apps/harness/tests/integration/canonical-writer-lease.integration.test.ts`
  - **Oracle**: on both Windows and Linux, a separate Node child process opens the same plain `.slopstop-writer.lock`, acquires `[0,1)`, and sends `locked`; while that child remains alive, the harness factory returns exactly `{ status: "contended" }`; after an IPC release request makes the child unlock, close, send `released`, and exit `0`, the harness factory returns `acquired`; the test uses the installed native module and no mocked lock function, and does not force-terminate the child or claim crash-release proof.
  - **Expected red**: no native Writer lease factory or native integration proof exists before this slice.

- **Behavior**: Only native denial and Windows `EBUSY` classify as contention; every operational or cleanup failure remains broken.
  - **Test**: `classifies every injected native lease acquisition branch` -> `apps/harness/src/storage/canonical-writer-lease.test.ts`
  - **Oracle**: `tryLock() === false` on Linux and thrown `{ code: "EBUSY" }` on Windows return exactly `{ status: "contended" }` after one successful close; Linux `EBUSY` and every other lock exception return `broken/WRITER_LEASE_LOCK_FAILED`; open rejection returns `broken/WRITER_LEASE_OPEN_FAILED`; a close rejection after denial or lock failure returns `broken/WRITER_LEASE_CLOSE_FAILED` with a retained cleanup handle, preserves both causes through `AggregateError` when both lock and close fail, and never returns contention; a concurrent cleanup call shares the in-flight close, a later cleanup call retries only close, and success makes further cleanup calls no-ops; all lock calls use offset `0` and length `1`.
  - **Expected red**: contention and native failures have no distinct result vocabulary before this slice.

- **Behavior**: Lease release retains retry state and never closes a still-locked handle after unlock failure.
  - **Test**: `resumes native lease release from the failed stage` -> `apps/harness/src/storage/canonical-writer-lease.test.ts`
  - **Oracle**: two concurrent release calls are the same promise and perform one unlock and one close; first unlock failure rejects with `WRITER_LEASE_UNLOCK_FAILED` and close count `0`; retry performs a second unlock and one close; first close failure after successful unlock rejects with `WRITER_LEASE_CLOSE_FAILED`, and retry performs no second unlock but performs a second close; a successful third release is a no-op.
  - **Expected red**: no retained native release state exists before this slice.

- **Behavior**: Durable Writer activation accepts only coherent prior state and records initial, clean, and recovery handoffs atomically.
  - **Test**: `validates and advances generation-2 Writer state` -> `apps/harness/src/storage/canonical-command-repository.test.ts`
  - **Oracle**: `last_writer_generation = 0` is accepted only with no fence and zero generation rows; a positive last generation is accepted only when the generation-row count and maximum generation both equal it and exactly one matching fence/generation pair exists; active state requires both release values null, while released state requires two valid RFC 3339 UTC values denoting the same instant; orphaned, gapped, absent, lagging, mismatched, malformed, or release-inconsistent state rejects as `WRITER_FENCE_ACTIVATION_FAILED` without advancing any row. Three valid activations receive generations `1`, `2`, and `3` with handoffs `initial`, `clean`, and `recovery`; recovery updates abandoned generation `2` from null to `2026-09-04T12:02:00.000Z` exactly once before inserting its resolved `abandoned-active-fence` row and replacing the fence; only SHA-256 digests of branded 64-lowercase-hex tokens are persisted.
  - **Expected red**: Slice 2 provides the tables but no prior-state validation, activation transaction, capability type, or recovery transition.

- **Behavior**: Fence verification and release require the exact Project, generation, token digest, active state, and unreleased shape.
  - **Test**: `verifies and releases only the current durable Writer fence` -> `apps/harness/src/storage/canonical-command-repository.test.ts`
  - **Oracle**: the exact capability returns `{ status: "current" }`; changing Project, generation, token, state, or `released_at` returns `{ status: "stale" }`; current release at `2026-09-04T12:01:00.000Z` updates exactly one `writer_fence` and matching `writer_generations` row to that instant in one transaction; a second release returns `{ status: "stale" }`; malformed time, malformed digest, SQL error, duplicate result row, or row-count drift raises `WRITER_FENCE_CHECK_FAILED` or `WRITER_FENCE_RELEASE_FAILED` and never reports broken state as stale or clean.
  - **Expected red**: no durable fence activation, verification, or release behavior exists before this slice.

- **Behavior**: The coordinator starts inactive, rejects activation while any ownership remains, and exposes stopped state as coordinator-unavailable.
  - **Test**: `owns one activation for the complete harness session` -> `apps/harness/src/active-project-coordinator.test.ts`
  - **Oracle**: an initial command returns `inactive/PROJECT_INACTIVE`; healthy activation returns exactly `{ status: "active", request: { projectId: "00000000-0000-4000-8000-000000000010" }, access: "read-write", activationId: "00000000-0000-4000-8000-000000000011", writerGeneration: 1 }`; another activation while active or `release-failed` returns `rejected/PROJECT_ALREADY_ACTIVE/retryable:false` before Storage, lease, repository, activation-ID, or token dependencies run again; after successful stop, activation returns `unavailable/PROJECT_COORDINATOR_UNAVAILABLE/retryable:false` and command admission returns `coordinator-unavailable/PROJECT_COORDINATOR_UNAVAILABLE/retryable:false`.
  - **Expected red**: there is no session-scoped active-Project authority or stopped activation outcome before this slice.

- **Behavior**: Storage unavailable, broken, not-registered, and safe-mode branches never create an activation identity or attempt Writer acquisition.
  - **Test**: `maps non-writable Project Storage activation branches without acquiring a Writer` -> `apps/harness/src/active-project-coordinator.test.ts`
  - **Oracle**: Storage unavailable maps to `unavailable/PROJECT_STORAGE_UNAVAILABLE/retryable:true`; broken maps to `broken/PROJECT_STORAGE_BROKEN/retryable:false`; not registered maps exactly to `{ status: "not-registered", request }`; safe mode returns exact Storage identity and health after one successful Storage close, leaves the coordinator inactive, and causes a following command to return `inactive/PROJECT_INACTIVE`; activation-ID, token, lease, and repository call counts remain `0` in all four branches.
  - **Expected red**: activation-specific Storage outcomes and coordinator mapping do not exist before this slice.

- **Behavior**: Native contention alone retains a fresh read-only activation without a token, repository, or Writer.
  - **Test**: `retains a read-only activation on native contention without creating a repository` -> `apps/harness/src/active-project-coordinator.test.ts`
  - **Oracle**: contention returns exactly `{ status: "active", request, access: "read-only", activationId: "00000000-0000-4000-8000-000000000011", writerGeneration: null, diagnostic: { code: "WRITER_UNAVAILABLE", message: "Another SlopStop process holds Project write authority.", retryable: true } }`; a matching command returns `read-only/WRITER_UNAVAILABLE/retryable:true`; repository activation and token creation remain at `0`; stop closes only Storage.
  - **Expected red**: contention cannot become a retained read-only activation before this slice.

- **Behavior**: Typed-command admission is ordered coordinator availability, inactive, Project, activation, access, then durable fence, with settlement deferred.
  - **Test**: `admits Typed commands in Project, activation, access, then fence order` -> `apps/harness/src/active-project-coordinator.test.ts`
  - **Oracle**: stopped, activating, releasing, or release-failed state returns `coordinator-unavailable/PROJECT_COORDINATOR_UNAVAILABLE`; inactive returns `inactive/PROJECT_INACTIVE`; wrong Project returns `project-mismatch/PROJECT_NOT_ACTIVE`; matching Project with activation `00000000-0000-4000-8000-000000000021` returns `stale-activation/PROJECT_ACTIVATION_STALE`; read-only returns `read-only/WRITER_UNAVAILABLE`; none invokes fence verification; matching writable identity with a stale fence returns `stale-writer/WRITER_FENCE_STALE`; broken verification returns `broken/WRITER_FENCE_CHECK_FAILED`; current verification returns `settlement-unavailable/COMMAND_SETTLEMENT_UNAVAILABLE`; every result repeats exactly the request Project, activation, and Command IDs and exposes no payload.
  - **Expected red**: no Typed-command admission path exists before this slice.

- **Behavior**: Failed activation and shutdown release durable fence, repository, native lease, then Storage while retaining the exact failed stage and diagnostic.
  - **Test**: `retains failed release ownership and resumes cleanup on stop retry` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/src/canonical-project-writer.test.ts`
  - **Oracle**: successful writable stop records `["fence", "repository", "lease", "storage"]`; fence stale and fence release failures surface exactly `WRITER_FENCE_STALE` and `WRITER_FENCE_RELEASE_FAILED`; repository, unlock, native close, and Storage failures preserve their exact codes; an acquisition-time unacquired-file close failure immediately retains `lease-file-cleanup`, performs no repository or Storage close, and returns `WRITER_LEASE_CLOSE_FAILED`; while any failed stage remains, another activation returns `PROJECT_ALREADY_ACTIVE` without Storage acquisition; a later stop retries the retained lease-file cleanup or Writer lease stage, then Storage, without repeating completed work; no later stage runs before the failed stage succeeds.
  - **Expected red**: no retained staged Writer release, exact release diagnostic, or release-failed coordinator state exists before this slice.

- **Behavior**: Failed repository activation never retries a failed client close during that activation and retains it ahead of lease and Storage cleanup.
  - **Test**: `retains a repository client when failed activation cleanup cannot close it` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`
  - **Oracle**: if activation fails and its first client close succeeds, cleanup continues through lease and Storage and returns `broken/WRITER_FENCE_ACTIVATION_FAILED`; if that close fails, activation immediately returns `broken/WRITER_REPOSITORY_CLOSE_FAILED` with message `Project activation resources could not be released.`, client close count stays `1`, lease and Storage counts stay `0`, and another activation returns `PROJECT_ALREADY_ACTIVE`; later `stop()` retries repository cleanup once, then lease and Storage, producing `["repository-cleanup", "lease", "storage"]` and total client close count `2`.
  - **Expected red**: failed activation currently retries repository cleanup in the same activation and can hide the close failure behind `WRITER_FENCE_ACTIVATION_FAILED`.

- **Behavior**: The canonical application validates result schema and correlation but leaves exception classification to the locked runtime boundary.
  - **Test**: `validates canonical owner results without swallowing owner failures` -> `apps/harness/src/canonical-project-application.test.ts`
  - **Oracle**: valid correlated activation and command results return unchanged; an invalid shape or mismatched Project, activation, or Command ID rejects with `CanonicalProjectApplicationError` and exact message `Canonical Project application returned an invalid result.` without attaching the invalid value; a coordinator exception containing `C:\\private\\project\\slopstop.db` or `secret command payload` is rethrown unchanged; application stop delegates exactly once.
  - **Expected red**: no canonical Project application validation boundary exists before this slice.

- **Behavior**: The runtime emits correlated request failure for canonical exceptions, round-trips valid results, and closes canonical ownership before Project Storage.
  - **Test**: `round-trips canonical activation and contains canonical request failures` -> `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`, `apps/harness/src/harness-runtime.test.ts`
  - **Oracle**: activation command `00000000-0000-4000-8000-000000000101` emits sequence `1`, event ID `00000000-0000-4000-8000-000000000901`, matching causation, and the exact read-only payload including `writerGeneration: null`; command `00000000-0000-4000-8000-000000000102` emits sequence `2` and exact `read-only/WRITER_UNAVAILABLE` correlation; either canonical application rejection emits only correlated `request.failure/HARNESS_INTERNAL_FAILURE` with the locked generic message, never `system.failure` and never private cause text; runtime stop calls canonical stop before Project Storage stop and does not call Project Storage stop when canonical release rejects.
  - **Expected red**: the runtime has no canonical application dependency or activation/command dispatch.

- **TDD-exempt**: `apps/harness/src/types/fs-native-extensions.d.ts` only narrows the installed native API exercised through the real lease integration test.
- **TDD-exempt**: `packages/protocol/src/index.ts` and `apps/harness/src/index.ts` only expose behavior proved through protocol and MessagePort seams; the private Writer capability is deliberately absent from both public barrels.
- **TDD-exempt**: `apps/harness/package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` are dependency declarations and generated resolution state verified by frozen installation and direct installed-package inspection.
- **TDD-exempt**: `apps/desktop/vite.harness.config.ts` extends the existing resource-staging build hook; its externalization and copied output are verified directly after the harness build rather than through a unit mock of Vite.

#### Approved Execution Amendments (2026-09-05):

All 18 original Behavior/Test/Oracle blocks above remain verbatim. Their original Expected-red wording is historical where the execution mapping below supersedes it. No import/compilation error, missing native dependency, timeout, or already-green regression counts as Red. A guarded callable-public-capability assertion in a successfully loaded module may establish missing capability; its complete exact behavior assertions remain mandatory.

Execution has ten explicit cycles: B1 -> B3 -> B2 -> B5 -> B4 -> B6-B8 (native resource lifecycle) -> B9-B10 (durable authority) -> B11-B16 (coordinator lifecycle) -> B17 -> B18. Each individual behavior or declared group gets Red, minimal Green, and a separate review/refactor gate before the next cycle. Author and run every assigned check before shared implementation; report which checks were Red and which were preexisting Green, never independent later Reds for shared behavior already implemented.

- Identity characterization/extraction precedes B1 and remains TDD-exempt. Preserve every existing accepted identity and the distinct Project/Storage diagnostic messages before and after the one-owner extraction.
- B2 tracks acknowledged closes, initially false for both slots, not absence at factory creation. Populate slots only before release starts; set completion only after the live client closes successfully. Characterize constructing release before filling runtime then canonical slots: order is canonical/runtime, each closes once. This already passes current source and protects against the projected late-slot defect, not a fabricated Red. The original rejected-promise retry oracle supplies B2 Red.
- B1 leaf diagnostics use exported raw canonical schemas' safeParse results, including nested union issues. Assert exact leaf path/code; extra keys use unrecognized_keys with exact containing-object path and key list. Envelope-wrapper tests preserve S1 normalization, including invalid_union at payload for an invalid activation payload union; do not change normalizeIssues or weaken leaf checks to success:false.
- B9 supplements exact instant equality: released values 2026-09-04T12:01:00.0001Z and 2026-09-04T12:01:00.0002Z reject with WRITER_FENCE_ACTIVATION_FAILED and unchanged rows; .0001Z versus .000100Z, and no fraction versus .000Z, are equal and permit clean activation. Reuse the existing seconds-bearing UTC-Z validator unchanged: numeric offsets, including +00:00, remain invalid. Compare whole seconds and trailing-zero-normalized fractional strings without Date.parse, numeric conversion, or millisecond restriction.
- The durable group explicitly includes B16's repository-only cleanup checks before factory implementation. B16 coordinator retention/order checks run in the coordinator group; the repository checks then remain regressions. B16's original claim that current activation retries cleanup is false for the pre-S3 tree: that factory/coordinator did not exist. The execution Red is missing repository cleanup capability before the durable group and missing coordinator retention before the coordinator group, never deliberately introducing the erroneous retry.
- S3 owns before-every-begin foreign_keys=ON, busy_timeout=5000 and foreign-key verification. Add supplemental test `configures every canonical activation and release transaction` in the already-inventoried `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`. Through real worker-client/repository activation and release, set the connection to FK0/busy0 before each begin and observe FK1/busy5000 inside both actual transactions. Delegate all SQL/terminal work; never synthesize PRAGMA responses. No additional file or S5 driver implementation is required.
- B4's required canonical runtime-fixture dependency wiring completes with B18. All direct runtime fixture sites receive required activate/execute methods rejecting if invoked and resolving stop; no optional dependency, production fallback, or S4 switch method is permitted.

| Existing fixture assertion | Approved S3 execution migration |
| --- | --- |
| Lifecycle failed admitted close: release called once | release called twice after shutdown retries retained ownership; exact close failure, registry count1 and aggregate [releaseFailure] for the repeated same error object remain |
| Runtime immediate [stopMessages, stopNotifications, projectStorageApplication.stop] | immediate [stopMessages, stopNotifications, canonicalProjectApplication.stop], Storage count0; after awaiting settlement append projectStorageApplication.stop |
| Runtime Storage rejection | same shutdownFailure identity and shared stop promise; construct the rejected Storage promise only when that stop is invoked |
| Runtime synchronous cleanup failure aggregate | after awaiting rejection preserve [intakeFailure, storageFailure], ordered canonical-before-Storage stop and every single-call count |
| Canonical stop rejection | Storage count remains0 even after awaiting rejection |
| generationPaths fixture | add writerLease: project/.slopstop-writer.lock; preserve every existing generation path |

These are migrations from passing current tests, not claims those tests are broken before S3. All S1/S2 evidence and original S3 oracles are preserved.

#### Automated Verification:

- [x] Focused protocol and harness unit tests pass: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/project-storage-protocol.test.ts packages/protocol/src/protocol.test.ts apps/harness/src/storage/project-storage-opening.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/project-storage-store.test.ts apps/harness/src/storage/local-libsql-worker-client.test.ts apps/harness/src/storage/project-storage-filesystem-authority.test.ts apps/harness/src/storage/canonical-writer-lease.test.ts apps/harness/src/storage/canonical-command-repository.test.ts apps/harness/src/canonical-project-writer.test.ts apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-application.test.ts apps/harness/src/harness-runtime.test.ts`
- [x] Focused source-level integration tests pass: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`
- [x] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`
- [x] Harness type checking passes: `pnpm --filter @slopstop/harness typecheck`
- [x] Desktop type checking passes: `pnpm --filter @slopstop/desktop typecheck`
- [x] Frozen native dependency resolution succeeds: `pnpm install --frozen-lockfile`
- [x] The installed package is exactly version `1.5.1`, contains a non-empty prebuild directory for the executing platform/architecture, and loads its native API: `pnpm --filter @slopstop/harness exec node -e "const fs=require('node:fs'),path=require('node:path');const entry=require.resolve('fs-native-extensions');let root=path.dirname(entry);while(!fs.existsSync(path.join(root,'package.json'))){const parent=path.dirname(root);if(parent===root)throw new Error('package root not found');root=parent}const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(manifest.version!=='1.5.1')throw new Error('unexpected fs-native-extensions version');const target=process.platform+'-'+process.arch;const prebuild=path.join(root,'prebuilds',target);if(!fs.statSync(prebuild).isDirectory()||fs.readdirSync(prebuild).length===0)throw new Error('current target prebuild missing');const native=require('fs-native-extensions');if(typeof native.tryLock!=='function'||typeof native.unlock!=='function')throw new Error('native lock API missing');console.log(JSON.stringify({version:manifest.version,target,prebuild:path.relative(root,prebuild)}))"`
- [x] Architecture constraints pass: `pnpm check:architecture`
- [x] Desktop harness build and dependency staging complete: `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts`
- [x] Built output contains `harness.cjs`, exact `fs-native-extensions@1.5.1`, and the current target prebuild. Run the following from the repository root in Bash: an isolated child must load the staged native API without resolving any non-builtin module outside its own physical tree and exit `0`; only after child exit may the parent remove the temporary tree, so Windows never deletes a still-loaded native image.

```sh
node --no-global-search-paths <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function verifyStagedNativeApi() {
  const fs = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const buildRoot = fs.realpathSync(process.cwd());
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    const resolved = resolve.call(this, request, parent, isMain, options);
    if (!Module.isBuiltin(request)) {
      const relative = path.relative(buildRoot, fs.realpathSync(resolved));
      if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
        throw new Error('module resolved outside staged tree: ' + request);
      }
    }
    return resolved;
  };
  const native = require(path.join(buildRoot, 'node_modules', 'fs-native-extensions'));
  if (typeof native.tryLock !== 'function' || typeof native.unlock !== 'function') {
    throw new Error('staged native lock API missing');
  }
}

const source = path.resolve('apps/desktop/.vite/build');
if (!fs.statSync(path.join(source, 'harness.cjs')).isFile()) {
  throw new Error('harness build missing');
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'slopstop-harness-stage-'));
try {
  const build = path.join(temporary, 'build');
  fs.cpSync(source, build, { recursive: true });
  const root = path.join(build, 'node_modules', 'fs-native-extensions');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest.version !== '1.5.1') throw new Error('staged version mismatch');
  const prebuild = path.join(root, 'prebuilds', process.platform + '-' + process.arch);
  if (!fs.statSync(prebuild).isDirectory() || fs.readdirSync(prebuild).length === 0) {
    throw new Error('staged target prebuild missing');
  }
  const child = spawnSync(
    process.execPath,
    ['--no-global-search-paths', '-e', '(' + verifyStagedNativeApi.toString() + ')()'],
    {
      cwd: build,
      env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' },
      stdio: 'inherit',
      timeout: 30000,
      killSignal: 'SIGKILL',
    },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error('isolated staged native load failed');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
NODE
```

- [x] Windows source proof executes `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts` with actual win32-x64 Node and installed native module.
- [x] Linux source proof executes the identical test under actual linux-x64 Node, locally in the approved isolated WSL workspace or in authorized CI.
- [x] The real first/second transaction configuration test passes with FK1/busy5000 in both transactions.
- [x] Linux harness build and isolated staged native child loading pass, independently of Windows output.
- [x] Static inspection confirms both existing CI jobs discover the native integration test. Historical criterion required both CI jobs to execute it; the approved local-or-CI alternative supersedes that execution-location requirement without claiming CI ran.

Approved platform preparation: exact Linux Node24.19.0 and pnpm11.5.1 archives, checked against published integrity, may be downloaded under one owned child of C:/Users/pedro/AppData/Local/Temp/opencode. One explicitly approved /var/tmp/slopstop-s3-* Linux directory owns the separate source copy, Linux-only dependencies/store/cache, fixtures and staged copies. Use the Linux filesystem rather than the v9fs Windows mount for proof data. Hash the exact current source/config/test/migration copy, including intended uncommitted files; exclude Git metadata, secrets, Windows dependencies and existing outputs. Use temporary HOME/XDG/PNPM paths and normal frozen install with lifecycle scripts, not global installation or weaker gates. Observe actual platform, native origin and child exit before owned cleanup. No distro/global configuration, commits, push, CI dispatch or merge is authorized. The parent owns the separate Linux agent and actual Linux validation; the Windows implementer must leave those criteria unchecked until real evidence is supplied. S7 package/crash/takeover proof remains deferred.

#### Manual Verification:

- [x] Confirm only `ActiveProjectCoordinator` owns active Project identity, activation epoch, Writer, release-failed ownership, and admitted command drain state.
- [x] Confirm `project.open` remains inspection-only and ordinary Storage sessions are never reused as activation sessions.
- [x] Confirm read-write and native-contention read-only activation each obtain a fresh `ProjectActivationId`, while safe-mode and not-registered outcomes obtain none.
- [x] Confirm the Project Storage identity characterization, including the distinct existing Project/Storage diagnostic messages, passed before and after extraction. Within `packages/protocol/src`, `domain-identity-schema.ts` owns the only lowercase identity refinement, and Project Storage plus canonical activation schemas import that owner without narrowing the accepted identity set.
- [x] Confirm `.slopstop-writer.lock` is a Project-root plain-file witness excluded from generation manifests, activation baselines, checksums, snapshots, and exports.
- [x] Confirm native authority holds `[0,1)`, false and Windows `EBUSY` are the only contention cases, and Linux `EBUSY` remains broken.
- [x] Confirm `WriterCapabilityToken` is exactly 64 lowercase hexadecimal characters, remains inside harness modules, and only its SHA-256 digest is persisted.
- [x] Confirm initial, clean, and recovered durable states meet the joined fence/generation invariants and recovery releases the abandoned generation before recording resolution and replacing the fence.
- [x] Confirm failed lower-level closes remain owned, concurrent callers share one attempt, later calls retry only unfinished stages, and completed stages never repeat.
- [x] Confirm durable activation occurs only after native lease acquisition and cleanup proceeds repository, lease, then Storage.
- [x] Confirm command admission checks coordinator availability, inactive state, Project, activation, read-only access, and durable fence in that order before returning `COMMAND_SETTLEMENT_UNAVAILABLE`.
- [x] Confirm application validation throws only its sanitized internal error for invalid results, while the locked runtime converts every correlated exception into generic `request.failure` and reserves null-causation `system.failure` for process-global failure.
- [x] Inspect `apps/desktop/.vite/build` after the harness build and confirm the externalized native dependency resolves only from its staged `node_modules` tree.
- [x] Confirm Slice 3 claims only source-level cooperative peer-process contention; packaged multiprocess loading, forced termination, crash release, bounded takeover, and stale-process proof remain Slice 7.
- [x] Review every activation and command result and confirm no exception text, source text, prompt, environment value, secret, full local path, database path, lease path, token, or digest crosses the process boundary.

### Slice 4: Safe Project Switching

**Status**: Approved and locked after independent review and the separate code/contract checkpoint recorded under Developer Context. This approval does not authorize product implementation.

**Files**: `packages/protocol/src/canonical-project-protocol.ts`, `packages/protocol/src/protocol.ts`, `packages/protocol/src/index.ts`, `apps/harness/src/active-project-coordinator.ts`, `apps/harness/src/canonical-project-application.ts`, `apps/harness/src/harness-runtime.ts`, `packages/protocol/src/canonical-project-protocol.test.ts`, `packages/protocol/src/protocol.test.ts`, `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/src/canonical-project-application.test.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`, `apps/harness/tests/integration/project-storage-create-fixture.ts`, `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

All listed files are MODIFY relative to locked Slice 3 except `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`, which is NEW. Six production files change; all other listed files are tests or fixtures.

Previously introduced dependencies, not Slice 4 modifications: `canonical-project-writer.ts` retains durable fence/repository/lease close stages; `storage/project-storage-store.ts` owns separate activation and ordinary sessions; `storage/project-storage-opening.ts` and `storage/canonical-writer-lease.ts` retain lower-level close stages; `storage/serial-lock.ts` supplies FIFO scheduling. `process-bootstrap.ts` needs no change because its existing factory composes the extended application. Kernel, Desktop production code, Storage internals, native packaging, and settlement transactions are outside this slice.

The live direct-call inventory is `harness-runtime.test.ts:124,239,301,349,449,519,555,599`, `harness-runtime.integration.test.ts:78`, `project-storage-create-fixture.ts:155`, `project-storage-lifecycle.integration.test.ts:365,452`, and the real composition at `process-bootstrap.ts:83`. The two canonical unit files and activation integration file are introduced by the locked Slice 3 design, not yet present in live source. No additional live direct fixture was found. Update every canonical application/coordinator literal in that inventory with the required method; no optional method, fallback application, or compatibility branch is permitted.

#### Test Contract:

All aliases below denote complete exact values, not partial-match shapes. Use exact result equality and explicit resource observations at the public coordinator/application/transport seams; do not assert private state fields or replace the real coordinator with a switching mock. Each behavior-changing test first fails against the implemented Slice 3 baseline, then receives minimal Slice 4 implementation, Green, and a separate review/refactor gate. The current repository is earlier than Slice 3, so missing Slice 3 implementation is not Slice 4 Red evidence.

Construct valid typed fixtures first; adversarial result tests may alter them with `Reflect.set` or `Reflect.deleteProperty` instead of using unsafe type assertions. Use no explicit `any`, non-null assertions, or double casts. Coordinator lifecycle clocks and the runtime event clock are independently controlled, so a release-clock exception does not also disable the locked failure-event metadata factory.

**Pinned inputs and results**:

| Name | Exact value |
| --- | --- |
| A | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| B | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2` |
| C | `cccccccc-cccc-4ccc-8ccc-ccccccccccc3` |
| A old epoch | `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| A new epoch | `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2` |
| B epoch | `ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2` |
| C epoch | `eccccccc-cccc-4ccc-8ccc-ccccccccccc3` |
| Initial activation time T0 | `2026-09-05T12:00:00.000Z` |
| First source release time T1 | `2026-09-05T12:00:01.000Z` |
| First target activation time T2 | `2026-09-05T12:00:02.000Z` |
| Explicit retry release time T3 | `2026-09-05T12:00:03.000Z` |
| Runtime event time T4 | `2026-09-05T12:00:04.000Z` |
| Target activation after explicit retry T5 | `2026-09-05T12:00:05.000Z` |
| S_AB | `{ from: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }, to: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" } }` |
| S_AC | `{ from: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }, to: { projectId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3" } }` |
| S_AA | `{ from: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }, to: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" } }` |
| D_A | `{ projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", command: { commandId: "44444444-4444-4444-8444-444444444401", type: "conformance.counter.set", version: 1, payload: { value: 7 } } }` |
| D_B | `{ projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", activationId: "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", command: { commandId: "44444444-4444-4444-8444-444444444402", type: "conformance.counter.set", version: 1, payload: { value: 7 } } }` |
| D_A_new | `{ projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", command: { commandId: "44444444-4444-4444-8444-444444444403", type: "conformance.counter.set", version: 1, payload: { value: 7 } } }` |
| B_RW | `{ status: "active", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, access: "read-write", activationId: "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", writerGeneration: 1 }` |
| B_RO | `{ status: "active", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, access: "read-only", activationId: "ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", writerGeneration: null, diagnostic: { code: "WRITER_UNAVAILABLE", message: "Another SlopStop process holds Project write authority.", retryable: true } }` |
| B_SAFE | `{ status: "safe-mode", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, identity: { storageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1", generationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2", canonicalDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3", runtimeDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc4" }, canonicalHealth: { status: "migration-required", diagnostic: { code: "DATABASE_MIGRATION_REQUIRED", message: "Database migration is required." } }, runtimeHealth: { status: "healthy" } }` |
| Internal failure payload | `{ code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false }` |

For command result equality, remove `command` from the named input and add `commandId` equal to its `command.commandId`, plus exactly the status/diagnostic in the following table. No result includes command type, version, or payload. These locked Slice 3 outcomes are reused as switching observations, not redesigned.

| Command status | Exact diagnostic |
| --- | --- |
| `coordinator-unavailable` | `{ code: "PROJECT_COORDINATOR_UNAVAILABLE", message: "Canonical Project coordination is unavailable.", retryable: false }` |
| `inactive` | `{ code: "PROJECT_INACTIVE", message: "No Project is active for Typed commands.", retryable: false }` |
| `project-mismatch` | `{ code: "PROJECT_NOT_ACTIVE", message: "The command Project is not active.", retryable: false }` |
| `stale-activation` | `{ code: "PROJECT_ACTIVATION_STALE", message: "The command activation is stale.", retryable: false }` |
| `read-only` | `{ code: "WRITER_UNAVAILABLE", message: "The active Project has no write authority.", retryable: true }` |
| `stale-writer` | `{ code: "WRITER_FENCE_STALE", message: "The active Writer fence is stale.", retryable: false }` |
| `broken` | `{ code: "WRITER_FENCE_CHECK_FAILED", message: "The active Writer fence could not be verified.", retryable: false }` |
| `settlement-unavailable` | `{ code: "COMMAND_SETTLEMENT_UNAVAILABLE", message: "Typed-command settlement is not available in this release slice.", retryable: false }` |

- **Behavior**: Switch request parsing is strict at every boundary and reuses the lowercase Project/activation identity owners.

**Test**: `parses only strict source-qualified switch requests` -> `packages/protocol/src/canonical-project-protocol.test.ts`, `packages/protocol/src/protocol.test.ts`.

**Oracle**: S_AB and S_AA parse to exactly themselves. Adding `extra: true` independently at the request root, `from`, or `to` fails. Removing `from`, `from.projectId`, `from.activationId`, or `to.projectId` fails. Independently replace each identity with `not-a-uuid`, `00000000-0000-0000-0000-000000000000`, and its uppercase form: every case fails; uppercase Project fields retain `Project identity must use lowercase UUID text.`, uppercase activation retains `Identity must use lowercase UUID text.`. `to.activationId` is an extra key, not an authority claim. Each malformed payload in a valid `project.switch` v4 envelope returns `ok: false` with `PROTOCOL_MESSAGE_INVALID`; no dependency is invoked.

**Expected red**: Slice 3 has no switch request schema or `project.switch` transport member. Lowercase identity validation itself already works and receives no new Red claim.

- **Behavior**: Every strict switch result keeps the original switch request and distinguishes a target attempt from successful activation.

**Test**: `validates switch result branches and destination correlation` -> `packages/protocol/src/canonical-project-protocol.test.ts`.

**Oracle**: `{ status: "target-result", request: S_AB, target: B_RW }`, the B_RO and B_SAFE replacements, and each target failure in the target table below parse exactly. For S_AB, `inactive` accepts only `PROJECT_INACTIVE`, `project-mismatch` only `PROJECT_NOT_ACTIVE`, `stale-activation` only `PROJECT_ACTIVATION_STALE`, and `coordinator-unavailable` only `PROJECT_COORDINATOR_UNAVAILABLE`, all with `retryable: false` and the exact messages in the precondition table below. `release-failed` accepts the eight codes in the release matrix below with message `Project activation resources could not be released.` and the pinned retryability. Flip each boolean, pair each status with a different branch's code, use unknown code `WRITER_UNKNOWN`, use status `switched`, omit `request`, or add `target` to a failure: every case fails. Change only `target.request.projectId` to A or C: failure contains the exact issue path `target.request.projectId` and message `Switch target Project must match the requested destination.`. Extra fields at result, request, nested target, and diagnostic fail. Inject `writerToken`, `tokenDigest`, `canonicalDatabasePath`, `writerLeasePath`, `error`, or `cause` independently at each result/diagnostic boundary: parsing fails; no branch strips and silently accepts those fields.

**Expected red**: Slice 3 has no switch result union or outer-to-target correlation refinement. Existing activation result variants remain unchanged.

- **Behavior**: Named factories and package exports round-trip the new messages without changing protocol version or failure scope.

**Test**: `round-trips exported protocol v4 switch factories` -> `packages/protocol/src/protocol.test.ts`.

**Oracle**: `createProjectSwitchCommand` with message ID `11111111-1111-4111-8111-111111111402`, sentAt T0, and S_AB returns exactly `{ protocolVersion: 4, messageType: "command", messageId: "11111111-1111-4111-8111-111111111402", sentAt: "2026-09-05T12:00:00.000Z", command: "project.switch", payload: S_AB }`. `createProjectSwitchResultEvent` returns exactly `{ protocolVersion: 4, messageType: "event", messageId: "99999999-9999-4999-8999-999999999402", sentAt: "2026-09-05T12:00:04.000Z", sequence: 2, causationId: "11111111-1111-4111-8111-111111111402", event: "project.switch.result", payload: { status: "target-result", request: S_AB, target: B_RW } }`. Both public parse functions return `{ ok: true, value: originalEnvelope }`; extra envelope keys fail, and replacing version with `3` returns exactly `{ ok: false, error: { code: "PROTOCOL_VERSION_UNSUPPORTED", issues: [{ code: "unsupported_value", path: "protocolVersion" }] } }`. Import both factories, both schemas, and both inferred types from the protocol package surface. Existing request/system failure assertions remain unchanged.

**Expected red**: the factories, exports, and union members are absent before Slice 4, so the new round-trip fails; protocol v4 and its failure semantics are already Slice 1 behavior.

- **Behavior**: Source eligibility is checked in FIFO execution order before cleanup, acquisition, clock, or identity dependencies.

**Test**: `rejects ineligible switch sources before touching dependencies` -> `apps/harness/src/active-project-coordinator.test.ts`.

**Oracle**: the following cases return exactly `{ status, request: S_AB, diagnostic: { code, message, retryable: false } }`. Reset observations after setup; each case has zero new calls to Storage acquisition/close, lease acquisition/release, repository activation/verification/close/releaseFence, activation-ID creation, token creation, and clock. Active-source rejections leave the original activation executable; null-epoch cleanup rejections remain unavailable.

| State at S_AB's turn | Status | Code | Message |
| --- | --- | --- | --- |
| Fresh inactive | `inactive` | `PROJECT_INACTIVE` | `No Project is active for switching.` |
| Successful stop already completed | `coordinator-unavailable` | `PROJECT_COORDINATOR_UNAVAILABLE` | `Canonical Project coordination is unavailable.` |
| B active at B epoch | `project-mismatch` | `PROJECT_NOT_ACTIVE` | `The switch source Project is not active.` |
| A active at A new epoch | `stale-activation` | `PROJECT_ACTIVATION_STALE` | `The switch source activation is stale.` |
| A failed acquisition cleanup with no successful activation | `coordinator-unavailable` | `PROJECT_COORDINATOR_UNAVAILABLE` | `Canonical Project coordination is unavailable.` |

The null-epoch case is created by real acquisition failure with retained cleanup, not by reaching into coordinator state; repeat using both the allocated A old epoch and A new epoch in `from`, and neither permits cleanup. Wrong Project takes precedence over wrong epoch when both differ.

**Expected red**: Slice 3 has no source-qualified switch or execution-time source rejection. Its existing activation/command preconditions are baseline setup, not new behavior.

- **Behavior**: Queue admission closes synchronously, including before the first microtask, for every lifecycle request and reopens only after the entire queue drains.

**Test**: `closes command admission in the same turn as lifecycle enqueue` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/src/harness-runtime.test.ts`.

**Oracle**: with A active, invoke `switchProject(S_AB)` then `execute(D_A)` in the same call stack with no intervening await, promise callback, timer, or microtask. D_A resolves to its exact `coordinator-unavailable` result; A verification count remains `0`. Repeat while a target Storage acquisition is held and while A release is held: every new D_A and D_B is unavailable with original command correlation, never queued for later execution. Repeat the same-turn check with `activate({ projectId: B })` while A is active and with `stop()`: both close admission immediately; the repeated activation later returns exactly `rejected/PROJECT_ALREADY_ACTIVE/retryable:false` with message `A Project activation already owns this harness session.` and restores D_A admission after that rejected lifecycle call drains. After a successful S_AB and no pending lifecycle request, D_B returns `settlement-unavailable` and D_A `project-mismatch`. Initial activation queued while inactive also rejects same-turn D_A as unavailable rather than inactive.

**Expected red**: switch is absent, and Slice 3's direct `lifecycle.run` leaves an admission gap before its callback begins. This is new queue-time behavior, not a claimed Red for the existing in-callback barrier.

- **Behavior**: Switching drains every already-admitted fence check, including failed checks, before releasing any A resource.

**Test**: `waits for all admitted fence checks before switching ownership` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: admit D_A and a second A command with Command ID `44444444-4444-4444-8444-444444444404` while two public repository `verifyFence` promises are held. Queue S_AB; both existing operations remain live, a third command is unavailable, and the release/acquisition observation log remains `[]`. Settle only one check and flush its completion: S_AB remains pending and release log stays `[]`. Settle the second: source release may begin only then. Run the matrix with repository results `{ status: "current" }`, `{ status: "stale" }`, a synchronous thrown `Error("private broken fence")`, and an asynchronously rejected `Error("private rejected fence")`; the admitted command returns respectively `settlement-unavailable`, `stale-writer`, `broken`, and `broken` with the exact command table diagnostics. Configure releaseFence independently to return current, so each matrix case can finish with `{ status: "target-result", request: S_AB, target: B_RW }`. No command rejection is converted into a clean fence result, and no private cause crosses transport.

The real Slice 3 Writer normalizes repository throws/rejections into `broken`; it cannot emit a rejected `verifyFence()` promise through that public port. Preserve and review both arms of the coordinator's non-rejecting settlement wrapper without inventing a test-only Writer factory or claiming an unreachable rejection escape. These tests prove actual rejection normalization plus drain through the real Writer, not a mocked internal collaborator.

**Expected red**: Slice 3 cannot switch while admitted operations are in flight. The existing stop drain and Writer normalization are characterization dependencies, not new Red claims.

- **Behavior**: A release completes all owner stages before any target resource, identity, or token acquisition begins.

**Test**: `releases A completely before acquiring B` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: with A writable at generation `1`, successful S_AB produces the ordered public-port log `["A.fence@2026-09-05T12:00:01.000Z", "A.repository.close", "A.lease.unlock", "A.lease.close", "A.storage.close", "B.storage.acquire", "B.activation-id", "B.lease.acquire", "B.token", "B.repository.activate@2026-09-05T12:00:02.000Z"]` and exactly `{ status: "target-result", request: S_AB, target: B_RW }`. Hold each awaitable A stage (fence, repository close, lease-file close, Storage close) in a separate case; until it succeeds, B Storage/lease/ID/token/repository counts are all `0` and S_AB is pending. Native unlock is synchronous: observe it exactly once before lease-file close, rather than inventing a deferred unlock API. Hold B Storage after A closes: D_A is unavailable while activation is in flight, and no A reacquisition occurs. Use the real retained Writer; where unlock/close detail is observed, use the existing real lease factory with controllable public descriptor/lock functions, not private release-stage fields. This proves composition, not native crash behavior.

**Expected red**: no switch composition invokes A release followed by B activation before Slice 4.

- **Behavior**: Switching never closes ordinary project.open sessions, including ordinary A or B sessions.

**Test**: `switches activation ownership without closing ordinary Storage sessions` -> `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`, `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`.

**Oracle**: open ordinary A and B sessions through the real Storage application, then activate A and send S_AB through real MessagePorts. The switch returns the exact B_RW target result; A activation close count is `1`, ordinary A and B close counts are `0`, and B activation remains open. An explicit ordinary `project.close` for A returns exactly `{ status: "closed", request: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" } }`, makes only ordinary A close count `1`, and leaves D_B executable with `settlement-unavailable`. Later runtime stop closes B activation before the Storage owner closes ordinary B. Do not replace the Storage owner in this independence case; use its existing controllable opening/registry ports.

**Expected red**: separate Storage sessions already exist in Slice 3, but no public switch journey preserves them while moving active ownership.

- **Behavior**: Each A release failure retains the exact stage and epoch, emits only its owned diagnostic, and waits for a valid explicit retry.

**Test**: `retains the source epoch and resumes only unfinished switch release stages` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: each matrix row starts with fresh writable A, sends S_AB, fails only the named stage, and returns exactly `{ status: "release-failed", request: S_AB, diagnostic: { code, message: "Project activation resources could not be released.", retryable } }`. All B Storage/lease/ID/token/repository counts stay `0`; D_A is coordinator-unavailable. Let the loop settle without another lifecycle call: no cleanup or acquisition retries occur. A matching S_AB retry at T3 repeats only the listed unfinished operations; after they succeed B is acquired exactly once at T5, returns B_RW, and D_B is executable. Completed fence release keeps T1; a fence that failed initially succeeds at T3. The original failure response remains correlated to S_AB even when the next explicit destination changes.

| Injected code | retryable | Successful stages before failure | First operations on explicit valid retry |
| --- | --- | --- | --- |
| `WRITER_FENCE_RELEASE_FAILED` | `true` | none | fence at T3, repository, unlock, lease close, Storage |
| `WRITER_FENCE_STALE` | `false` | none | fence recheck at T3; if still stale, no repository/lease/Storage work |
| `WRITER_REPOSITORY_CLOSE_FAILED` | `true` | fence at T1 | repository close, unlock, lease close, Storage |
| `WRITER_LEASE_UNLOCK_FAILED` | `true` | fence at T1, repository | unlock, lease close, Storage |
| `WRITER_LEASE_CLOSE_FAILED` | `true` | fence at T1, repository, unlock | lease close only, then Storage |
| `PROJECT_STORAGE_RELEASE_FAILED` | `true` | fence at T1, repository, unlock, lease close | Storage only |
| `WRITER_LEASE_OPEN_FAILED` | `true` | fence at T1, repository | retained public lease release, then Storage |
| `WRITER_LEASE_LOCK_FAILED` | `true` | fence at T1, repository | retained public lease release, then Storage |

Open/lock rows exercise diagnostic forwarding allowed by the existing public lease/Writer error type, not a claim that the real retained native release opens or locks again. The real unlock/close rows use the retained lease owner to prove no repeated successful unlock. For stale release, a repeated stale owner result returns the same non-retryable failure; only a later explicit call with a current owner result can continue, never a forced release. For Storage failure, use the existing opening-release owner with canonical close success/runtime close failure, then the reverse: the first switch reports `PROJECT_STORAGE_RELEASE_FAILED`; the explicit retry closes only the failed database client, total failed-client count `2` and successful-client count `1`, with no Writer/lease stage repeated. A second failure at the same stage stays retained and B acquisition remains `0`.

**Expected red**: retained lower-level close retries already work in Slice 3, but no switch result preserves the source epoch or routes a later source-qualified switch through those retained stages.

- **Behavior**: Wrong-source or wrong-epoch retries never clean up retained A, and the coordinator retains no destination for later automatic acquisition.

**Test**: `requires exact retained source authority for an explicit switch retry` -> `apps/harness/src/active-project-coordinator.test.ts`.

**Oracle**: after S_AB fails A repository close once, a retry with `from.projectId: C` returns `project-mismatch/PROJECT_NOT_ACTIVE`, and a retry with A/new epoch returns `stale-activation/PROJECT_ACTIVATION_STALE`, using the precondition messages and `retryable:false`; each response repeats that full submitted request. Neither calls clock, cleanup, or target dependencies, and A repository close count remains `1`. A valid S_AC then retries A repository close once, finishes A release, acquires only C, and returns exactly `{ status: "target-result", request: S_AC, target: { status: "active", request: { projectId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3" }, access: "read-write", activationId: "eccccccc-cccc-4ccc-8ccc-ccccccccccc3", writerGeneration: 1 } }`. Total A repository close count is `2`, C acquisition count is `1`, and B acquisition count remains `0` after all pending work drains. An explicit successful stop instead of S_AC releases A only and acquires neither B nor C.

**Expected red**: Slice 3 has neither source-qualified retry validation nor switching to a freshly requested destination after retained failure.

- **Behavior**: A-to-A is complete reactivation, never a same-Project no-op.

**Test**: `reactivates the same Project with a new activation epoch` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: S_AA from writable A at old epoch/generation `1` releases A in the full release order before reacquiring its same Storage and lease. It returns exactly `{ status: "target-result", request: S_AA, target: { status: "active", request: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }, access: "read-write", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", writerGeneration: 2 } }`. D_A returns `stale-activation` with zero new fence checks; D_A_new returns `settlement-unavailable` with one current-fence check. A repeated old-epoch S_AA returns `stale-activation` without cleanup; it cannot release the new A epoch.

**Expected red**: Slice 3 only rejects repeated activation as already active and cannot perform explicit source-qualified reactivation.

- **Behavior**: Read-only A releases only its activation Storage session before attempting the target.

**Test**: `switches from read-only A without inventing Writer ownership` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: activate A by native contention at its old epoch and reset observations. S_AB records `["A.storage.close", "B.storage.acquire", "B.activation-id", "B.lease.acquire", "B.token", "B.repository.activate@2026-09-05T12:00:02.000Z"]`, returns the exact B_RW target result, and never invokes A fence, repository, token, or lease release. If A Storage close fails once, return release-failed/PROJECT_STORAGE_RELEASE_FAILED with `retryable:true` and S_AB; a wrong A epoch cannot retry; a matching retry closes A Storage once more then acquires B once. Repeat A-to-A with target contention: target is active read-only at A new epoch with null generation and the exact WRITER_UNAVAILABLE activation diagnostic; old-epoch D_A rejects stale before access is checked.

**Expected red**: no switch can transfer a contended read-only activation or preserve its epoch across release failure before Slice 4.

- **Behavior**: Every expected B activation outcome is nested as target-result after A is gone, with no restoration of A.

**Test**: `returns the exact target activation outcome without rolling back released A` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: each independent S_AB case releases A successfully then returns exactly `{ status: "target-result", request: S_AB, target }` from this table. No case reacquires A. B_RW admits D_B as settlement-unavailable; B_RO admits it as read-only and creates one B ID but zero B tokens/repositories. Safe-mode closes B's diagnostic session once, and safe-mode/not-registered/unavailable/broken Storage outcomes create zero B IDs/tokens/leases/repositories; D_A and D_B then return inactive. No non-active target result exposes an activation ID, including a failed acquisition that internally allocated one.

| B outcome | Exact target |
| --- | --- |
| Healthy Writer | B_RW |
| Lease contended | B_RO |
| Storage safe mode | B_SAFE |
| Not registered | `{ status: "not-registered", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" } }` |
| Storage unavailable | `{ status: "unavailable", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE", message: "Project Storage is unavailable.", retryable: true } }` |
| Storage broken | `{ status: "broken", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "PROJECT_STORAGE_BROKEN", message: "Project Storage activation failed.", retryable: false } }` |
| Lease open failed, cleanup succeeds | `{ status: "broken", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "WRITER_LEASE_OPEN_FAILED", message: "Writer lease file could not be opened.", retryable: false } }` |
| Lease lock failed, cleanup succeeds | `{ status: "broken", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "WRITER_LEASE_LOCK_FAILED", message: "Writer lease could not be acquired.", retryable: false } }` |
| Repository activation broken, cleanup succeeds | `{ status: "broken", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "WRITER_FENCE_ACTIVATION_FAILED", message: "Writer fence could not be activated.", retryable: false } }` |

The repository-failure case supplies the exact public owner message `Writer fence could not be activated.`. For protocol/application contract coverage, also validate nested `{ status: "unavailable", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "PROJECT_COORDINATOR_UNAVAILABLE", message: "Canonical Project coordination is unavailable.", retryable: false } }` and `{ status: "rejected", request: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, diagnostic: { code: "PROJECT_ALREADY_ACTIVE", message: "A Project activation already owns this harness session.", retryable: false } }`. The real coordinator cannot produce those two target branches after its own successful A release and immediate inner activation; do not invent runtime state mutation to force them.

**Expected red**: Slice 3 already owns these activation outcomes, but no switch result nests them with destination correlation or establishes that A stays released after target failure.

- **Behavior**: Failed B acquisition cleanup retains only B resources with no successful epoch and blocks every later acquisition until explicit stop cleanup succeeds.

**Test**: `fences failed target cleanup without inventing an activation epoch` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: after successful A release, independently inject B unacquired-file close failure, failed repository-activation client close, lease-unlock/close failure during failed acquisition cleanup, and safe-mode Storage close failure. S_AB returns target-result with B request and respectively `broken/WRITER_LEASE_CLOSE_FAILED`, `broken/WRITER_REPOSITORY_CLOSE_FAILED`, `broken/WRITER_LEASE_UNLOCK_FAILED` or `broken/WRITER_LEASE_CLOSE_FAILED`, and `broken/PROJECT_STORAGE_RELEASE_FAILED`; every diagnostic has message `Project activation resources could not be released.` and the locked activation `retryable:false`. B cleanup count remains exactly `1` for the failed lower-level stage when the result arrives; no same-activation retry occurs. D_A and D_B are coordinator-unavailable. S_AB and a B-to-C switch presenting the allocated B epoch both return coordinator-unavailable with their own full requests and no cleanup. `activate({ projectId: C })` retains the locked rejected/PROJECT_ALREADY_ACTIVE result and acquires nothing. An explicit stop retries only B's retained unfinished stages and becomes stopped; it never reacquires A or continues to B/C acquisition. A failed stop can be retried using existing stop sharing semantics. Safe-mode allocates no ID; repository/lease failures may have allocated B epoch internally, but neither result nor retry authority exposes it.

**Expected red**: the new B target path and null-epoch switch rejection do not exist. Acquisition cleanup stages/diagnostics themselves remain Slice 3 behavior and must not be assigned fabricated Red.

- **Behavior**: Unexpected B failures reach request.failure, preserve recoverable ownership, and never restore A.

**Test**: `contains unexpected target exceptions without restoring the source` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: after A closes, B Storage acquisition rejecting `Error("C:\\private\\project\\slopstop.db secret-token secret-digest")` rejects the coordinator/application call with that same error; runtime returns only the exact Internal failure payload for the switch causation. With no B ownership, a following D_A or D_B is inactive. Repeat at B activation-ID allocation, lease acquisition throw, token creation, repository activation throw, and activation timestamp throw with successful cleanup: release only the B resources actually obtained, in Storage-only or lease-then-Storage order, leave inactive, and propagate the original error. Each case acquires A exactly once overall. If an operational B cleanup close fails instead, preserve Slice 3's nested broken target result and null-epoch retained ownership as the previous behavior specifies, rather than overwriting that expected cleanup diagnostic with the primary exception. If the cleanup clock itself throws, propagate that clock error, retain B ownership with null epoch, and perform no repeated same-activation cleanup.

**Expected red**: the switch target exception path is absent. Locked exception classification is reused unchanged; only the ownership-preserving cleanup-clock extension adds behavior to failed activation cleanup.

- **Behavior**: Clock exceptions before release cannot lose A ownership, strand releasing state, or trigger a hidden retry.

**Test**: `preserves owned resources when the release clock throws` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: with A active, have the release clock throw the same `Error("private release clock")` once after a held admitted D_A settles. S_AB rejects with that exact error, the A release log is `[]`, all B dependency counts are `0`, and after the lifecycle queue drains D_A remains executable with settlement-unavailable under its unchanged old epoch. A later explicit S_AB with T1 succeeds, releasing each A stage exactly once. Repeat with explicit stop: concurrent stop callers share one rejected promise, nothing closes before D_A settles, and a later stop with T1 succeeds and becomes stopped. Repeat after a prior A repository close failure: clock throw leaves the exact retained old epoch and repository stage; wrong source/epoch still cannot clean it, and a valid retry closes only repository/lease/Storage. For a B safe-mode session, make its first cleanup clock throw and the next clock value available: the same switch must not consume the next value or close the session automatically; a B-to-C switch with B epoch is unavailable, and only later stop uses the next timestamp to close B once.

**Expected red**: Slice 3 stop replaces active ownership with releasing before calling the clock; failed-activation cleanup can also throw before ownership is retained. Those newly specified exceptional paths, not normal Slice 3 stop/release behavior, supply genuine Red.

- **Behavior**: Queued switches revalidate source authority at their own turn and cannot release the previous switch's target.

**Test**: `revalidates queued switch sources against the preceding lifecycle result` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: queue S_AB then S_AC while A release is held. Release A: first returns target-result/B_RW; second returns exactly `{ status: "project-mismatch", request: S_AC, diagnostic: { code: "PROJECT_NOT_ACTIVE", message: "The switch source Project is not active.", retryable: false } }`. A closes once, B activates once, B close count is `0`, and every C dependency count is `0`; after both settle D_B is executable. Queue S_AA then S_AC instead: first creates A new epoch, second returns stale-activation with the exact source-stale diagnostic and does not release new A. Queue S_AB ending in not-registered then S_AC: second returns inactive and never acquires C. If first S_AB ends in retained A operational release failure, the separately queued source-matching S_AC is an explicit valid request and may retry its unfinished stages, then acquire C once; this is not an automatic retry of S_AB or retention of B as destination.

**Expected red**: no FIFO source-qualified switch validation exists before Slice 4; checking only at enqueue would fail these post-predecessor oracles.

- **Behavior**: Stop and activation requests share the same FIFO queue as switches with no intervening command admission or overlapping resource owners.

**Test**: `orders stop and activation behind switching without reopening admission` -> `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: queue S_AB, then two stop calls while A release is held. Stop callers receive the same promise. S_AB completes target-result/B_RW; the one stop releases B in fence/repository/lease/Storage order before resolving, and later commands are coordinator-unavailable. Probe D_B when B repository activation returns but before B stop completes: it is unavailable, not admitted. Queue stop before S_AB instead: stop releases A and S_AB returns coordinator-unavailable with no B dependencies. Queue `activate({ projectId: C })` after successful S_AB: activation returns the exact locked rejected/PROJECT_ALREADY_ACTIVE result with C request, C dependency counts `0`, and B remains active. Queue that activation after S_AB's not-registered target instead: C activates once at C epoch/generation `1` only after A release and B's non-active result, with no resource overlap. Queue a rejected wrong-source switch followed by valid work: the rejected operation releases its lifecycle slot and never strands the admission counter. After stop release failure, matching source-qualified switching can retry the retained active epoch; a subsequent explicit stop remains a fresh attempt and releases its result.

**Expected red**: switching is absent and the synchronous queue-wide barrier is missing. Existing successful stop idempotence and concurrent stop promise sharing are characterization, not fresh Red.

- **Behavior**: The canonical application validates every switch correlation and sanitizes invalid results without swallowing owner exceptions.

**Test**: `validates complete switch correlation and preserves owner exceptions` -> `apps/harness/src/canonical-project-application.test.ts`, `apps/harness/src/harness-runtime.test.ts`.

**Oracle**: each valid result table branch for S_AB returns exactly unchanged data. Independently alter result.request.from.projectId to C, from.activationId to A new epoch, request.to.projectId to C, or target.request.projectId to A: the call rejects with `CanonicalProjectApplicationError`, name `CanonicalProjectApplicationError`, message `Canonical Project application returned an invalid result.`, no attached raw value/cause. Also alter both outer destination and nested target to C, so the schema alone passes: application correlation still rejects it. Repeat outer request mismatches for every non-target branch, not just success; extra private fields and a flipped diagnostic retryability also reject. Runtime maps these sanitized errors to the exact Internal failure payload, never a switch result or system.failure. A public coordinator switch stub throwing the sentinel private exception instead causes the application to reject with the identical sentinel object; runtime alone replaces it with the generic failure payload.

**Expected red**: the required switch method and its full request/result validation are absent before Slice 4. Existing activation/command validators and runtime catch are preserved.

- **Behavior**: The complete switch journey crosses a real MessagePort and preserves exact v4 event order and causation.

**Test**: `round-trips safe switching through real runtime application coordinator and Writer` -> `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`.

**Oracle**: use real MessageChannel ports, runtime, canonical application, coordinator, and Writer with controllable public Storage/repository/lease ports; no native crash, production command handler, or fake switching application. Hold operations through explicit deferred public promises, not sleeps. With event time T4 and generated event IDs in order `99999999-9999-4999-8999-999999999401`, `99999999-9999-4999-8999-999999999402`, `99999999-9999-4999-8999-999999999403`, `99999999-9999-4999-8999-999999999404`, send and await each command: activate A caused by `11111111-1111-4111-8111-111111111401`; S_AB caused by `11111111-1111-4111-8111-111111111402`; D_A caused by `11111111-1111-4111-8111-111111111403`; D_B caused by `11111111-1111-4111-8111-111111111404`. Exactly four events arrive, with sequences `1,2,3,4`, respective same causation IDs, protocolVersion `4`, messageType `event`, sentAt T4, and events `project.activate.result`, `project.switch.result`, `project.command.result`, `project.command.result`. Payloads are respectively `{ status: "active", request: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }, access: "read-write", activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", writerGeneration: 1 }`, `{ status: "target-result", request: S_AB, target: B_RW }`, D_A's exact project-mismatch result, and D_B's exact settlement-unavailable result. Parse and exact-compare the full received envelopes, not only factory-produced expected values. Finally await runtime stop before closing both ports; B releases before Storage shutdown.

**Expected red**: Slice 3 parses project.switch as invalid and cannot emit the second exact event or transfer active command admission to B.

- **Behavior**: Switch request failure isolates its causation while unrelated work remains live and completes normally.

**Test**: `isolates switch request failure from an unrelated pending Storage request` -> `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`, `apps/harness/src/harness-runtime.test.ts`.

**Oracle**: in a fresh real-port runtime, activate A using request `11111111-1111-4111-8111-111111111401`, producing event `99999999-9999-4999-8999-999999999401`, sequence `1`. Hold ordinary `project.open` for C under request `11111111-1111-4111-8111-111111111405`; send S_AB under request `11111111-1111-4111-8111-111111111402` with B acquisition throwing the private sentinel after successful A release. Exactly the next event is `{ protocolVersion: 4, messageType: "event", messageId: "99999999-9999-4999-8999-999999999402", sentAt: "2026-09-05T12:00:04.000Z", sequence: 2, causationId: "11111111-1111-4111-8111-111111111402", event: "request.failure", payload: { code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false } }`. C remains pending through a controlled checkpoint and has no failure event. Resolve its owner result to not-registered: event `99999999-9999-4999-8999-999999999403`, sequence `3`, causation `11111111-1111-4111-8111-111111111405`, event `project.open.result`, same v4/type/T4 metadata, payload exactly `{ status: "not-registered", request: { projectId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3" } }`. No system.failure, stop, A restoration, leaked path, `secret-token`, or `secret-digest` appears. Send a subsequent D_A: event `99999999-9999-4999-8999-999999999404`, sequence `4`, causation `11111111-1111-4111-8111-111111111403`, payload D_A inactive, proving runtime remains live. Repeat the failure-isolation pattern with an invalid canonical application switch result; it has the same sanitized failure, not owner-provided data.

**Expected red**: Slice 3 lacks switch dispatch and would emit protocol-invalid rather than the exact switch-handler internal failure. Existing request-failure isolation remains locked behavior exercised by the new request kind.

- **TDD-exempt**: the required `switchProject` member added to existing coordinator/application test doubles is a compile-time fixture migration, not new product behavior. In every canonical stub used only by activation, command, Workspace, or Storage journeys, supply a required async method that throws `Error("Unexpected canonical Project switch in this fixture.")`; retain existing activate/execute behavior and stop behavior. Existing journeys must remain Green, including every direct runtime literal listed under Files and the Slice 3 activation integration fixture. No test code belongs in Architecture; implementation authors these stubs and behavior tests after approval.

- **TDD-exempt**: named schema/type/factory re-exports are wiring proved by the switch parse/transport tests and consumer typechecks. Extraction of `activateWithinLifecycle` must first retain Slice 3 activation and stop characterizations unchanged, then pass them again after composition; no synthetic Red for that behavior-preserving extraction. The timestamp exception safety and queue-time admission additions have separate real Red contracts above.

#### Automated Verification:

- [ ] Focused unit tests pass after recorded Red/Green and separate review/refactor: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/protocol.test.ts apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-application.test.ts apps/harness/src/harness-runtime.test.ts`.
- [ ] The new real-MessagePort switch journey and affected existing integration fixtures pass under the harness integration config: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-project-switch.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`. The create/open/lifecycle journeys exercise the shared create fixture; it is not a standalone test file.
- [ ] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`.
- [ ] Harness type checking passes, including all required-method fixture updates: `pnpm --filter @slopstop/harness typecheck`.
- [ ] Desktop type checking passes as a consumer of the extended v4 message unions: `pnpm --filter @slopstop/desktop typecheck`.
- [ ] Architecture constraints pass: `pnpm check:architecture`.
- [ ] Review the single merged Architecture fence per touched production file for complete named imports/exports and zero duplicate switch definitions; protocol remains exactly `4`, and the locked request.failure catch and system.failure causation rule are unchanged.

Kernel typecheck is not a Slice 4 gate because no kernel source/type/export changes. Do not run full/deep, package, build/native-staging, install, migration generation, mutation, crash-proof, or Slice 5-7 commands for this slice. Existing integration bodies outside the switch scope are regression evidence, not modifications or fabricated new Red.

#### Manual Verification:

- [ ] Observe same-turn switch then command at the public coordinator seam: the command is unavailable before any microtask can start the lifecycle callback.
- [ ] Observe a held admitted fence check through real runtime/Writer composition: no A release or B acquisition begins until every admitted check settles, including failed checks.
- [ ] Observe each public release-failure response, submit a wrong-source and wrong-epoch retry, then a valid retry: only the valid request resumes unfinished stages and activates its own destination once.
- [ ] Observe A-to-A return a fresh epoch and an old-epoch command reject stale without reaching fence verification.
- [ ] Observe read-only A close only its activation session, and ordinary A/B project.open sessions survive the switch until independently closed.
- [ ] Observe each B non-active result remain nested under target-result with B correlation and no automatic A restoration; failed B cleanup blocks switching/acquisition without exposing an epoch.
- [ ] Observe release-clock failure leave ownership recoverable through a later valid switch or stop without hidden cleanup retry or premature Storage shutdown.
- [ ] Observe queued A-to-B then A-to-C leave B active and C untouched; observe queued stop release the first switch's result with no intervening command admission.
- [ ] Inspect full MessagePort events for exact v4 sequence/causation, request-failure isolation, stable allowlisted diagnostics, and absence of raw errors, paths, tokens, digests, or command payloads.
- [ ] Confirm Slices 1-3 contracts/history remain locked; Slice 4 remains pending until independent review and its separate developer checkpoint; Slices 5-7 are not implemented by this design.

### Slice 5: Atomic Typed Settlement

**Status**: Approved and locked with the reviewed code, Test Contract, and verification criteria at the separate checkpoint recorded under Developer Context. The three additional behavioral decisions are approved separately under Developer Context. Slice 5 is not implemented; runtime proof remains pending, and this approval does not authorize product implementation. This document is projected implementation, not live source or execution proof. Slices 1-4 remain approved historical contracts; Slices 6-7 remain unimplemented.

**Files**:

- MODIFY relative to projected Slice 4: `packages/kernel/src/project-storage-identifiers.ts`, `packages/kernel/src/index.ts`, `packages/protocol/src/canonical-project-protocol.ts`, `packages/protocol/src/index.ts`, `apps/harness/src/active-project-coordinator.ts`, `apps/harness/src/canonical-project-application.ts`, `apps/harness/src/canonical-project-writer.ts`, `apps/harness/src/storage/canonical-command-repository.ts`, `apps/harness/src/process-bootstrap.ts`, `apps/harness/src/index.ts`.
- NEW production modules: `apps/harness/src/canonical-json.ts`, `apps/harness/src/canonical-command-registry.ts`, `apps/harness/src/storage/canonical-command-ledger.ts`, `apps/harness/src/storage/canonical-command-settlement.ts`.
- MODIFY projected tests/fixtures: `packages/protocol/src/canonical-project-protocol.test.ts`, `packages/protocol/src/protocol.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`, `apps/harness/src/canonical-project-writer.test.ts`, `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/src/canonical-project-application.test.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`.
- MODIFY bootstrap integration consumer: `apps/harness/tests/integration/process-bootstrap.integration.test.ts`.
- NEW tests/fixtures, authored only during implementation: `apps/harness/src/canonical-json.test.ts`, `apps/harness/src/canonical-command-registry.test.ts`, `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`, `apps/harness/tests/integration/canonical-command-fixture.ts`, `apps/harness/tests/integration/conformance-counter-command.ts`.

Unchanged production dependencies: `harness-runtime.ts` already forwards the extended result and catches correlated exceptions; `protocol.ts` already owns the v4 `project.command` envelope; `storage/local-libsql-worker-client.ts` already forwards arbitrary SQL and terminal calls; `storage/project-storage-transaction.ts` remains the shared helper, not an S5 edit. No canonical schema, migration, snapshot, verifier spec, Desktop production, dependency manifest, or build configuration changes belong to Slice 5. Source-level integration configuration already includes the new `tests/integration/**/*.test.ts` files.

Direct caller audit: projected repository factory calls in `process-bootstrap.ts`, repository unit tests, and canonical activation/switch integration fixtures must supply required `registry`, `createReceiptId`, `createEventId`, and `now`. Projected repository literals in Writer/coordinator tests must provide required `settle`; no optional/backcompat fallback is allowed. Lifecycle-only literals use an explicitly throwing unexpected-settlement method; healthy canonical journeys use the real worker repository and fixture-owned generation-2 database, not canned receipts. Any command-result diagnostic helper in those fixtures must narrow away `status: settled` before indexing `diagnostic`.

The required application/coordinator `switchProject` method remains present at all projected Slice 4 callers. Live direct runtime callers remain those inventoried in Slice 4 (`harness-runtime.test.ts`, `harness-runtime.integration.test.ts`, `project-storage-create-fixture.ts`, `project-storage-lifecycle.integration.test.ts`, and bootstrap), plus projected canonical fixtures. The shared create/lifecycle Storage-only fixtures need no S5 method or behavior change: their canonical methods continue to throw if unexpectedly called, and their consuming create/open/lifecycle journeys are regression gates below. Do not add a fake settled result to those stubs.

#### Test Contract:

Every new behavior test is written against the implemented approved Slices 1-4 baseline, observed Red for the stated behavior, minimally implemented, observed Green, then separately reviewed/refactored. Current live absence of the projected foundation is not Slice 5 Red. Tests inspect public repository outcomes and independently queried actual SQLite rows, or real MessagePort/runtime/application/coordinator/Writer outcomes; no private-state introspection or raw-source-text tests. Adversarial row/handler/result fixtures use valid typed fixtures plus `Reflect.set`/`Reflect.deleteProperty` or public SQL-result decorators, not `any`, double casts, or non-null assertions.

**Fixture authority**:

The fixture first creates a real generation-2 Project using the approved migrations and verifies the production schema before adding any test table. It then closes the ordinary creation session and adds its own `conformance_counter` table with Project-scoped `(project_id,counter_id)` primary key, integer `value`, and positive safe integer `entity_version`. Insert exactly `(A, aggregate, 0, 1)`. This table is test-owned and is never inserted into `canonical-schema.ts`, migration SQL, or exact-schema verifier specs. Canonical Project sequence is never used as the domain counter.

Repeated activation of that prepared database uses a fixture-owned `ProjectStorageActivationPort` selecting the same already-prepared canonical file and returning a new retained session with the pinned healthy Storage identity. This port does not invoke or impersonate the production exact-schema opener on a database containing the extra table. Lease dependencies may be controllable public ports; the runtime, application, coordinator, Writer, repository factory, worker client, actual libSQL transactions, and durable ledger are real. The production-empty-registry case additionally uses an unextended production database with the real Storage owner/opener, so both forms of composition are proven without weakening the opener. Temporary roots, SQL fault decorators, held promises, test definitions, and counter DDL belong only to the two NEW fixture modules listed in Files and are closed before fixture teardown.

`conformance.counter.set` version `1` is registered only by `conformance-counter-command.ts`, using `defineCanonicalCommand`. Its payload contract has required integer `value` in `[0,10]`, optional `meta` with required numeric `a` and `b`, and optional string-array `tags`; objects are strict. Normal execution reads the fixture counter: equal value returns unchanged; a different value updates that counter once and increments its entity_version once, returning the two ordered events below. Separate fixture-owned handler variants deliberately write then return unchanged/rejected, throw, return malformed output, or hold completion. They exercise the generic seam, not product handlers or new domain tables. No test definition may be imported by `src/process-bootstrap.ts` or its production import closure.

**Pinned values**:

| Name | Exact value |
| --- | --- |
| A | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| B | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2` |
| Old A epoch | `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| New A epoch | `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2` |
| B epoch | `ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2` |
| Counter aggregate | `55555555-5555-4555-8555-555555555501` |
| C1, C2, C3 | `44444444-4444-4444-8444-444444444501`, `44444444-4444-4444-8444-444444444502`, `44444444-4444-4444-8444-444444444503` |
| C4, C5, C6 | `44444444-4444-4444-8444-444444444504`, `44444444-4444-4444-8444-444444444505`, `44444444-4444-4444-8444-444444444506` |
| R1, R2, R3 | `66666666-6666-4666-8666-666666666501`, `66666666-6666-4666-8666-666666666502`, `66666666-6666-4666-8666-666666666503` |
| R4, R5, R6 | `66666666-6666-4666-8666-666666666504`, `66666666-6666-4666-8666-666666666505`, `66666666-6666-4666-8666-666666666506` |
| E1, E2 | `77777777-7777-4777-8777-777777777501`, `77777777-7777-4777-8777-777777777502` |
| Creation/activation T0 | `2026-09-05T12:00:00.000Z` |
| Settlement T1 | `2026-09-05T12:00:01.000Z` |
| Settlement T2 | `2026-09-05T12:00:02.000Z` |
| Settlement T3 | `2026-09-05T12:00:03.000Z` |
| Release T4 | `2026-09-05T12:00:04.000Z` |
| Reactivation T5 | `2026-09-05T12:00:05.000Z` |
| Later/runtime time T6 | `2026-09-05T12:00:06.000Z` |
| First token | `1111111111111111111111111111111111111111111111111111111111111111` |
| Second token | `2222222222222222222222222222222222222222222222222222222222222222` |
| Safe rejection details text | `{"version":1}` |

Fixture aliases denote complete exact values; all expected results use full equality, not partial matches. `H(text)` below means an independent `node:crypto` SHA-256 over the specified literal UTF-8 text. Never feed a production serializer result to this oracle and never call `hashCanonicalJson` to compute expected values. The token digest oracle hashes the raw token text, not a JSON string.

`D1` is exactly `{ projectId: A, activationId: old A epoch, command: { commandId: C1, type: "conformance.counter.set", version: 1, payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x","y"] } } }`. Its literal canonical fingerprint input is `{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}`. Call its independently computed digest F1.

`Applied1` is exactly `{ receiptId: R1, projectId: A, commandId: C1, commandType: "conformance.counter.set", commandVersion: 1, outcome: "applied", projectSequence: 1, writerGeneration: 1, settledAt: T1, events: [{ eventId: E1, eventOrdinal: 0 }, { eventId: E2, eventOrdinal: 1 }] }`. `Settled(D,R)` means exactly `{ status: "settled", projectId: D.projectId, activationId: D.activationId, commandId: D.command.commandId, receipt: R }`, with no diagnostic or additional keys. For rejection/unchanged expectations below, replace the explicitly named metadata in Applied1, set `events: []`, and add `rejection` only for rejected. `Failure(D,status)` means the same flat correlation and exactly the diagnostic in this table, with no receipt:

| Status | Exact diagnostic |
| --- | --- |
| `command-busy` | `{ code: "COMMAND_IN_PROGRESS", message: "Another command is in progress.", retryable: true }` |
| `writer-unavailable` | `{ code: "WRITER_UNAVAILABLE", message: "The Writer requires explicit reactivation.", retryable: false }` |
| `sequence-exhausted` | `{ code: "PROJECT_SEQUENCE_EXHAUSTED", message: "The Project sequence is exhausted.", retryable: false }` |
| `stale-writer` | `{ code: "WRITER_FENCE_STALE", message: "The active Writer fence is stale.", retryable: false }` |

All other non-durable statuses/messages retain the exact approved Slice 4 table. Unexpected failures over transport have exactly `{ code: "HARNESS_INTERNAL_FAILURE", message: "Harness failed while handling a message.", retryable: false }` in a request.failure event, not a rejection receipt.

- **Behavior**: The pinned worker driver supports nested rollback without ending the outer transaction, and preserves applied inner writes only when the outer transaction commits.

**Test**: `characterizes real worker savepoint rollback release and outer commit` -> `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`.

**Oracle**: use `createWorkerLocalLibsqlClient` with the actual pinned `@libsql/client@0.17.4`/`libsql@0.5.29`, not node:sqlite in place of the worker. On the prepared fixture, explicitly configure that test connection, begin a write transaction, SAVEPOINT, set counter from `(0,1)` to `(7,2)`, ROLLBACK TO, and RELEASE. Read `(0,1)` through that still-open transaction, then update to `(3,2)` outside the savepoint and commit; a new client reads `(3,2)`. A fresh independent case uses SAVEPOINT, updates to `(7,2)`, RELEASE, then outer rollback; a new client reads `(0,1)`. A third uses RELEASE then outer commit and reads `(7,2)`. Throughout inner operations, transaction.closed is false; only successful terminal calls make it true. Characterize a missing savepoint name as an error, never a silently successful release. This preflight imports no S5 production symbol and makes no assertion about the new per-transaction repository configuration; that separate Red behavior is specified below.

**Expected red**: none for the driver's existing raw SQL support. This is a mandatory preexisting Green characterization/preflight, with no fabricated Red and no claim that it ran here. The new per-transaction connection configuration has its own behavior Red below. If SAVEPOINT/ROLLBACK TO/RELEASE fails through the actual worker client, stop and revise the design; never remove rollback-of-handler semantics or defer this compatibility proof to Slice 6. The existing local-libsql-worker-client.test.ts deferred-FK commit case remains a narrow preexisting characterization, not general proof that commit rejection implies rollback.

- **Behavior**: Fingerprint version 1 has exact canonical byte semantics independent of object insertion order and handler payload parsing.

**Test**: `canonicalizes submitted command content without changing its meaning` -> `apps/harness/src/canonical-json.test.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: D1 snapshots to the exact literal above and its persisted command_fingerprint equals F1. Deep reordering root payload keys and meta's keys produces the identical text/F1 and exact Applied1 replay. Replacing tags with `["y","x"]`, value with `8`, type with `conformance.counter.other`, or version with `2` yields four different canonical literals, each matching the independently hashed literal for that replacement and not F1. For the same CommandId each is conflict, even if its new registration is absent. Another Project changes the fingerprint. Changing only outer epoch, token, Writer generation, or clocks changes no fingerprint; the new epoch must still pass admission first. A registration whose payload schema supplies default tags `[]` or transforms `value` does not make raw `{value:7}` and `{value:7,tags:[]}` equivalent: same C1 yields one original then one conflict. Identity properties in TypedCommand remain governed by the already-parsed protocol contract, including its existing type trim.

**Expected red**: no canonical command fingerprint owner or durable retry lookup exists in Slice 4; the insertion-order Storage fingerprint cannot satisfy this oracle.

- **Behavior**: Canonical JSON preserves own proto-like keys, code-unit key order, Unicode and whitespace, arrays, and JSON number semantics while rejecting non-finite/non-JSON input.

**Test**: `preserves finite JSON edge values without prototype assignment` -> `apps/harness/src/canonical-json.test.ts`, `packages/protocol/src/canonical-project-protocol.test.ts`.

**Oracle**: a value parsed from literal `{"__proto__":{"x":1},"10":10,"2":2,"text":"  e\u0301  ","n":-0}` survives TypedCommandSchema with the own `__proto__` property intact, no inherited `x`, and canonical text exactly `{"10":10,"2":2,"__proto__":{"x":1},"n":0,"text":"  e\u0301  "}` where the escape in the expectation denotes the actual combining code point, not six backslash characters. H hashes that exact UTF-8 string. Composed `\u00e9` and decomposed `e\u0301`, leading/trailing spaces, different array order, and string `"0"` versus number `0` remain distinct; `-0` and `0` are identical. Keys U+1F600 and U+E000 sort in that order by their UTF-16 code units, not locale order. Nested NaN, positive/negative Infinity, undefined, bigint, function, symbol, sparse arrays, extra array properties, accessors, non-enumerable/symbol object properties, Date, and cyclic data fail parsing or serialization without durable writes. Null, booleans, empty arrays/objects, empty strings, finite fractional numbers, and shared but acyclic object references are accepted. Test an invalid value under an own `__proto__` key too: it must not disappear and parse successfully. Nonfinite top-level and nested payloads in a valid v4 envelope produce locked protocol-invalid request.failure before any Writer call.

**Expected red**: the projected z.json parser drops `__proto__`; no command canonicalizer preserves these bytes or rejects every excluded direct-call value. Primitive JSON acceptance already provided by Zod is characterization, not new Red.

- **Behavior**: Synchronous command snapshotting prevents caller, schema, and handler mutation from changing the accepted fingerprint or receipt binding.

**Test**: `freezes submission meaning before asynchronous repository work` -> `apps/harness/src/canonical-json.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: call application.execute(D1), then in the same stack mutate the original command's value to `8`, meta.a to `99`, commandId to C2, type to `conformance.counter.other`, and version to `2` while the real worker transaction is held before its handler. Release: result is exactly Settled(original D1,Applied1), database command identity/type/version/F1 stay original, and counter is `(7,2)`. A fixture schema transform or handler mutating its parsed payload to `9` cannot alter F1 or stored command metadata; inspect its deliberate domain outcome separately rather than assuming mutable handler payload is frozen. A handler returning event payload `{value:7}` then mutating that retained output at a held post-handler checkpoint still persists `{"value":7}` and its independent H. Exact original retry returns Applied1; mutated submitted content is a conflict under C1 or a new command under C2, according to its actual identity.

**Expected red**: no snapshot, handler output copy, or immutable receipt exists before Slice 5.

- **Behavior**: Registration binds schema output to its handler safely and rejects duplicate exact keys at construction.

**Test**: `binds typed payload definitions and rejects duplicate registrations` -> `apps/harness/src/canonical-command-registry.test.ts`.

**Oracle**: register counter version `1` and `2`: each exact version selects its own typed handler; a second version-1 definition throws `Duplicate canonical command registration.` immediately. Blank/trim-changing type and versions `0`, `0.5`, or `9007199254740992` reject construction. Source type probes compile a numeric/transformed schema with matching narrowed handler payload; an intentionally invalid `.toUpperCase()` on numeric payload and an explicitly string-annotated handler paired with a numeric schema are rejected by TypeScript with expected-error annotations. Payload inference comes from the schema alone (`NoInfer` at the function-property handler), not a widened union inferred from an incompatible callback. The transaction type permits only execute; access to commit, rollback, close, client, or token is rejected at typecheck. At runtime its own public keys are exactly `["execute"]`; captured handler context contains exactly ProjectId, payload, transaction. Unknown type/version produces fixed unsupported rejection preparation, invalid schema payload fixed invalid-payload preparation, with zero handler calls and no parser-error details. A throwing schema refinement is an unexpected error, not a payload-invalid rejection.

**Expected red**: the generic factory, duplicate-key guard, and narrowed handler seam do not exist. No raw-source-string assertion counts as type or runtime capability proof.

- **Behavior**: First applied settlement commits one domain mutation, one receipt/original pointer, one sequence, and precisely ordered/hash-bound events atomically.

**Test**: `persists applied counter state receipt original pointer and ordered events atomically` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: fresh A at sequence `0`/generation `1`, D1 and IDs R1/E1/E2 at T1 yield exactly Applied1 from the repository and Settled(D1,Applied1) through real ports. Read counter exactly `(A,aggregate,7,2)` and project_state exactly `(A,1,1,T0,T1)`. command_receipts has exactly `(A,R1,C1,"conformance.counter.set",1,F1,"applied",1,1,T1)` in locked column order. command_idempotency has exactly `(A,C1,F1,R1,T1)`. command_rejections is empty. canonical_events has exactly two rows: `(A,E1,R1,"applied",1,0,"conformance.counter",aggregate,2,"conformance.counter.changed",1,"{\"previous\":0,\"value\":7}",H('{"previous":0,"value":7}'),T1)` and `(A,E2,R1,"applied",1,1,"conformance.counter",aggregate,2,"conformance.counter.checked",1,"{\"value\":7}",H('{"value":7}'),T1)`. Foreign-key check is empty. No second sequence or activation/generation/recovery mutation occurs during settlement. A separate applied handler returning zero events is valid, persists its receipt and domain change, and yields `events: []`; applied does not falsely require at least one event.

**Expected red**: Slice 4 verifies a fence and returns settlement-unavailable without changing any domain or settlement row.

- **Behavior**: Unchanged rolls back even a handler's completed writes while durably binding a fresh CommandId at its own sequence.

**Test**: `rolls back unchanged handler writes and persists only settlement` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: after Applied1, C2 with value `7` at T2 returns R2, outcome unchanged, sequence `2`, generation `1`, time T2, events `[]`, and no rejection property. Independently use a handler that first writes `(99,3)` then returns unchanged: counter remains `(7,2)` after commit. project_state becomes `(A,2,1,T0,T2)`, receipt/original-pointer counts become `2/2`, rejection count remains `0`, and existing E1/E2 rows are byte/value-identical with no new events. New C2 fingerprint is H of the explicit literal containing C2 and its raw payload, not the handler's intermediate value. Exact retry returns that same R2 without rerunning the handler.

**Expected red**: no SAVEPOINT rollback or durable unchanged receipt exists before Slice 5.

- **Behavior**: Rejected rolls back handler writes and stores only stable safe rejection metadata with a fresh sequence.

**Test**: `rolls back rejected handler writes and hashes safe rejection metadata` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: after Applied1 and unchanged R2, C3/value `9` at T3 uses a fixture that writes `(99,3)` then rejects with `{code:"TEST_COUNTER_REJECTED",retryable:false}`. Receipt is R3/sequence `3`/generation `1`/T3, outcome rejected, events `[]`, and exactly that rejection. Counter stays `(7,2)`, receipt/pointer counts become `3/3`, E1/E2 unchanged, and command_rejections is exactly `(A,R3,"rejected",3,"TEST_COUNTER_REJECTED",0,"{\"version\":1}",H('{"version":1}'))`. Repeat isolated with handler retryable `true` and a safe distinct code: persisted boolean is integer `1` and receipt retryable true, not automatic reexecution. Extra events on rejected/unchanged, extra message/details keys, blank/lowercase/over-64-character code, and each reserved system code from a handler are malformed/unexpected, not durable rejection.

**Expected red**: Slice 4 has neither handler decision semantics nor durable safe rejection rows; returning a decision alone cannot satisfy domain rollback.

- **Behavior**: Unsupported type/version and schema-invalid payload settle durably only after envelope and Writer admission.

**Test**: `durably rejects unsupported definitions and invalid handler payloads` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: in independent fresh fixtures, C1 with unknown type `conformance.counter.missing`, counter version `2` absent from the registry, and counter version `1` payload `{value:"7"}` produce R1 at sequence `1`, original generation `1`, T1, no events, with respectively `COMMAND_TYPE_UNSUPPORTED`, `COMMAND_TYPE_UNSUPPORTED`, and `COMMAND_PAYLOAD_INVALID`, all retryable false. Each writes one receipt, one original pointer, one `{version:1}` hashed rejection row and leaves counter `(0,1)`. Corrected payload using the same C1 creates R2/sequence `2`/IDEMPOTENCY_CONFLICT, not an applied command; the correction under C2 can apply. An exact retry after installing/removing the definition still returns original R1 before registration/schema work. Malformed envelopes (missing commandId, version 0, invalid JSON), inactive, wrong Project, stale epoch, read-only, and switching requests allocate no durable receipt/sequence and never invoke registry or handler.

**Expected red**: a current writable fence always returns the non-durable settlement stub before Slice 5.

- **Behavior**: Durable exact retry returns immutable original metadata without generating identities, timestamps, events, or domain changes.

**Test**: `replays exact receipts across repository and activation replacement` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: after Applied1, close/release at T4, explicitly reactivate A at new epoch/T5 using second token and a new real repository. Generation becomes `2`; exact D1 content with new outer epoch returns Settled(new-epoch D1,Applied1), preserving receipt generation `1`, time T1, R1/E1/E2, F1, sequence `1`. Replace the registry with an empty one and make all settlement ID/clock factories throw if invoked: retry still succeeds. Counter `(7,2)`, all four settlement-table rows/counts, last_project_sequence `1`, and post-reactivation updated_at T5 remain unchanged by retry. Repeat for unchanged R2 and rejected R3, proving their exact outcome children and original pointer replay as well. Old epoch D1 is stale-activation before repository entry, not a durable replay.

**Expected red**: no durable receipt read, idempotency precedence, or settled result exists in Slice 4.

- **Behavior**: First conflicting content creates one repeatable rejected receipt per distinct fingerprint and never overwrites the original pointer.

**Test**: `persists distinct conflicts without changing original command authority` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: after Applied1, C1/value `8` at T2 creates R2/sequence `2` with rejected IDEMPOTENCY_CONFLICT/retryable false, raw requested type/version, no events, and one rejection row with H('{"version":1}'). command_idempotency remains exactly `(A,C1,F1,R1,T1)`; counter `(7,2)` and E1/E2 unchanged. Exact value-8 retry returns the same R2 and does not allocate. In order, C1/reversed tags at T3, C1/type `conformance.counter.other` at T4, and C1/version `2` at T5 produce R3/3, R4/4, R5/5 with their own literal-oracle fingerprints and requested type/version; handler count remains the original one. New repository/activation with no definitions replays original and every prior conflict exactly. A sixth different payload is one new conflict, not replacement or reuse of R2. Receipt sequences are `[1,2,3,4,5]`; pointer count is `1`, rejection count `4`, event count `2`.

**Expected red**: no durable fingerprint conflict family or original pointer preservation exists before Slice 5.

- **Behavior**: One Writer reserves admission synchronously, joins same-key callers, and immediately refuses different content without a backlog.

**Test**: `joins exact simultaneous commands and rejects distinct work as busy` -> `apps/harness/src/canonical-project-writer.test.ts`, `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: in one call stack submit D1, deep-key-reordered D1, C1/value `8`, and C2/value `7` before allowing the first real transaction to start/finish. The first two Writer submissions are pending with the identical result promise; the latter two are completed with their exact Failure(command,command-busy). After reset of activation observations there is exactly one new write transaction and one handler invocation. Busy responses arrive while D1 is still held, no new ID/clock is consumed for them, and no busy fingerprint or CommandId is persisted. Release D1: both accepted callers receive exact Settled(D1,Applied1), no second transaction; no previously busy command starts afterward. An explicit resend of C1/value8 after completion creates its conflict at sequence `2`. A same CommandId alone does not join different content, and a different CommandId does not join identical payload. No timers or sleeps define ordering; use held public promises.

**Expected red**: Slice 4 admits independent fence checks, has no canonical slot, and cannot join exact work or produce command-busy.

- **Behavior**: Every first outcome allocates one gap-free sequence, exact replay allocates none, and exhaustion is a distinct non-durable boundary.

**Test**: `allocates one safe Project sequence per first settlement and replays at the bound` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: applied, unchanged, handler rejected, and first conflict on one fixture yield ordered sequences `[1,2,3,4]` and exactly four receipts; interleaved exact retries and busy/stale results add no gaps. Isolated bound fixture explicitly seeds last_project_sequence to `9007199254740990` as boundary setup, not a domain counter or a claim of historical receipt count. D1 creates R1 at `9007199254740991`; exact retry at MAX returns unchanged metadata even with unavailable ID/clock factories and an empty registry. A new C2 and a first conflicting C1/value8 return exactly sequence-exhausted, invoke no handler/registry/IDs/clock, and change no row. If a prior conflict is already persisted before setting the bound, retrying it still succeeds. Inject raw lastProjectSequence values `-1`, `0.5`, `9007199254740992`, string `"1"`, null, duplicate or absent state rows: each is unexpected failure, never sequence-exhausted. Inject conditional sequence UPDATE rowsAffected `0` or `2` after actual SQL in separate rolled-back transactions: failure restores every pre-call domain and ledger row.

**Expected red**: no sequence allocation, max-bound result, or durable replay exists in Slice 4.

- **Behavior**: Fence authority is checked inside the same write transaction before any domain or settlement mutation, and broken observations never degrade to stale.

**Test**: `fences settlement before mutations and distinguishes malformed authority` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`.

**Oracle**: using a valid repository for A/generation1, change the well-formed durable fence to another generation/token, release it coherently, or return zero fence rows: settlement is exactly `{status:"stale-writer"}`, Writer result is Failure(D1,stale-writer), and handler/registry/ID/clock calls are zero; project sequence/counter/settlement tables are unchanged. The observable SQL sequence begins transaction('write'), then the fence SELECT, then state/idempotency; no domain statement precedes the fence. Direct repository snapshot naming B throws before its transaction rather than operating A with B identity. Duplicated fence rows, malformed generation/digest/time/ID, missing joined generation, inconsistent stored token binding/release shape, duplicate aliases/row-width drift, or thrown SQL raise unexpected failure and block the Writer, never `{status:"stale-writer"}`. Legacy direct `verifyFence()` continues to use its locked current/stale/broken diagnostic contract; these stronger transactional observations are the explicit S5 settlement seam.

**Expected red**: the approved Writer only performs an out-of-transaction verification; no protected settlement transaction exists.

- **Behavior**: Original pointer corruption is never interpreted as a new command or repaired by handler reexecution.

**Test**: `fails closed on broken original idempotency authority` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`.

**Oracle**: after Applied1, independent corruption fixtures delete the original pointer while preserving the receipt, alter original_receipt_id to absent R6, alter original fingerprint to another valid digest, alter pointer Project/Command/time, duplicate a returned pointer, or return malformed count/receipt aliases. Both exact D1 and first differing C1/value8 fail internally with zero handler calls and no new durable rows; especially, orphan receipt plus no pointer is not treated as first submission. An absent pointer with exact receiptCount `0` is the only new-command branch. A referenced receipt with wrong Project/Command/receipt ID/fingerprint, invalid UUID/type/version/outcome/time/sequence, sequence above current last, missing Writer generation, or generation above current authority also fails. A valid original of another command type is not compared to the conflicting request's type; it is validated for its own stored shape and pointer binding, then the requested conflict is handled correctly. No oracle claims original raw payload reconstruction.

**Expected red**: Slice 4 does not inspect durable idempotency or validate stored receipt authority.

- **Behavior**: Requested replay validates all event and rejection structure/hash/source bindings and never silently accepts ledger drift.

**Test**: `rejects corrupted replay children and conflicting receipts` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`.

**Oracle**: isolate mutations to Applied1's event receipt/project/outcome/sequence binding, malformed event UUID, ordinal gap/duplicate/reordered returned rows, malformed aggregate ID, blank aggregate/event type, nonpositive/fractional/unsafe aggregate/event version, occurredAt differing from settlement, malformed JSON, noncanonical JSON, and payload hash shape or content. Each lookup raises unexpected failure without handler invocation or any write. At an unchanged/rejected receipt, any event row fails; at applied/unchanged, any rejection row fails. For rejected, missing/duplicate rejection, wrong receipt/project/outcome/sequence, integer retryable outside `0/1`, unknown detail version/extra private detail key, details hash mismatch, reserved code with retryable true, or unsafe code fails. Even a correct hash of noncanonical event text or structurally wrong details does not make it valid. Requested receipt fingerprint/type/version drift fails. A prior conflicting receipt that is applied/unchanged, has a non-conflict rejection code, uses original's ID, or has sequence not greater than original fails, never reruns. Valid E1/E2 hashes are H of the literal payloads; mutating only stored digest to 64 valid but wrong hex characters fails. Faults SQLite constraints prevent are supplied through a decorator of the real worker's SELECT results; permissible persisted faults use explicit fixture-only SQL with constraints intentionally disabled only during corruption setup. No production schema constraint is relaxed. This does not claim detection of a coordinated valid rewrite, a missing contiguous event suffix when no event count is stored, or generic aggregate existence without a family-owned foreign key.

**Expected red**: no ledger replay validation or canonical hash verification exists before Slice 5. Tests do not demand detection of a valid-but-changed historical raw command whose full content is not stored.

- **Behavior**: Known begin/body failures roll back every affected row and never emit a durable success or rejection.

**Test**: `rolls back known settlement body faults at every mutation stage` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: capture exact rows in counter, project_state, command_receipts, command_idempotency, command_rejections, canonical_events, writer_fence, and writer_generations. Independently fail before BEGIN, the fence read, state read, pointer read, SAVEPOINT, after the actual handler UPDATE, ROLLBACK TO, RELEASE, after sequence UPDATE, receipt INSERT, original pointer INSERT, rejection INSERT, first event INSERT, and second event INSERT. For known body faults with successful rollback/close, a fresh independent reader sees the exact pre-call row values/counts, not merely unchanged sequence. Force rowsAffected `0/2` for each asserted UPDATE/INSERT in isolation: same rollback oracle. Invalid new receipt/event ID (uppercase, nil UUID, malformed) or non-UTC/invalid settlement time also aborts without durable settlement, including when the handler already wrote. At runtime each is generic request.failure with original causation; subsequent settlement in that Writer is writer-unavailable. Do not apply this no-row-change oracle to commit/timeout/close-after-commit failure.

**Expected red**: there is no atomic multi-table settlement body or Writer fail-closed flag before Slice 5.

- **Behavior**: Handler errors and malformed results abort the outer transaction, while execute capability is revoked and all previously issued SQL is drained.

**Test**: `revokes handler capabilities and observes swallowed or unawaited SQL failure` -> `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: fixture writes counter then throws `Error("private handler payload")`, returns undefined/unknown outcome, malformed event payload/UUID/nonpositive version, or rejected/unchanged with events: known-body rollback restores exact pre-call rows and generic request.failure exposes no private error. In separate cases issue failing SQL and catch it, issue failing SQL without awaiting, throw synchronously from an SQL decorator, or fail SQL-argument cloning: even if handler returns applied or unchanged, transaction fails and no durable receipt is emitted. Attach failure observation without converting rejection to a successful SQL result. Hold an already-issued successful UPDATE while the handler returns unchanged: no ROLLBACK TO, ledger write, commit, fence release, or lease release occurs before that SQL settles; afterward rollback removes its write. Retained facade execute called after handler completion throws exactly `Canonical command transaction capability is revoked.` synchronously, issues zero SQL, and remains revoked after success, rejection, failure, and later Writer reuse. A handler-returned event object mutated later cannot change already-snapshotted output. These tests prove lifetime control for trusted handlers, not that TypeScript blocks malicious transaction-control SQL.

**Expected red**: no execute-only revocation, issued-SQL drain, or savepoint rollback exists before Slice 5.

- **Behavior**: Unexpected settlement errors block only that Writer, preserve request failure isolation, and require explicit reactivation.

**Test**: `blocks a Writer after settlement error without guessing commit outcome` -> `apps/harness/src/canonical-project-writer.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: a synchronous repository throw and an asynchronous settlement rejection are rethrown as the identical sentinel at the Writer/application seam; all joined same-key callers observe that same failure, each transport request receives its own generic request.failure, and no system.failure occurs. Subsequent exact and distinct requests return their exact Failure(command,writer-unavailable), with zero new repository/registry/hash/ID/clock work. Independently inject commit rejection before sending COMMIT, delegate a real successful COMMIT then throw, simulate a lost/timeout commit acknowledgement with a controlled rejected decorator promise, and fail transaction close after successful COMMIT. All cases assert only generic failure, blocking, and retained-resource ordering, not absence of a receipt or rollback. The after-real-commit fixture may independently observe committed rows, demonstrating why rollback cannot be inferred. S5 creates no commit-uncertain recovery record and no phase classifier. After explicit same-Project switch/reactivation with successful release, a new Writer can receive requests again; detailed uncertain reconciliation/recovery-record proof is owned by Slice 6, not smuggled into this test.

**Expected red**: Slice 4 has no settlement error path, Writer blocking, or new unavailable branch.

- **Behavior**: Closing shuts admission immediately, drains accepted work even on failure, and retains failed transaction cleanup before existing release stages.

**Test**: `drains settlement before retryable Writer release and retains failed transaction close` -> `apps/harness/src/canonical-project-writer.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: hold D1 and its same-key join, then call Writer.close(T4) twice in one stack: both close calls share one promise, later settle returns writer-unavailable immediately, and fence/repository/lease close log stays `[]` while transaction work remains held. Resolve or reject settlement; only after the entire helper's commit/rollback/close promise settles may release stages run. If transaction.close rejects and its underlying closed flag remains false, explicit release first retries that same transaction close; while this retry is held or fails, no fence retirement, repository close, or lease release occurs. After a successful close acknowledgement with closed true, proceed in exact fence, repository, lease order. A falsely successful close with closed false remains failure/retained. Direct release attempted while the body is still in flight refuses instead of closing that transaction. Later close retries only unfinished stages; a completed fence/repository/lease stage never repeats. Original settlement failure remains observable and is not reclassified as success just because cleanup succeeds. Failed cleanup of an activation transaction is retained ahead of lease/Storage exactly as the prior acquisition contract requires.

**Expected red**: Slice 4 Writer close does not synchronously close settlement admission or drain its own slot, and its repository does not retain a failed transaction close before retirement.

- **Behavior**: Every repository write transaction uses verified connection settings even after libSQL detaches the previous connection.

**Test**: `configures every canonical write connection and retains unfinished ownership` -> `apps/harness/src/storage/canonical-command-repository.test.ts`, `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`.

**Oracle**: activation, first settlement, exact retry, next settlement, and fence release each use transaction('write') on a connection with foreign_keys `1` and busy_timeout `5000`. A public client decorator returning foreign_keys `0`, malformed or duplicate pragma rows, duplicate column aliases, or throwing during configuration causes failure before BEGIN/domain SQL. Activation still returns its locked broken activation result; settlement throws and blocks Writer. A second direct repository transaction while its predecessor is beginning or unfinished raises an ownership error rather than opening another. Successful transaction close releases the owned handle exactly once; failed close retains it for explicit cleanup rather than silently proceeding on a new connection.

**Expected red**: projected Slice 3 configures only the initial connection and has no retained transaction-close owner; subsequent connection configuration and failure distinction are new S5 behavior. Existing real-driver savepoint support is characterized Green separately.

- **Behavior**: Switching drains one accepted settlement and all exact joiners, has no busy backlog, and keeps the source-qualified FIFO barrier.

**Test**: `switches only after the admitted settlement and joins complete` -> `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`, `apps/harness/src/active-project-coordinator.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: with A active, hold D1's real handler/issued SQL; admit its exact duplicate and refuse C2 as busy. Queue the approved A-to-B switch, then another A command in the same stack: it is coordinator-unavailable before serialization/hash/registry/fence. Source release and B acquisition logs remain empty until D1's full transaction, including close, completes; both accepted calls get their own correlated Applied1 result, busy C2 never starts later. Release order remains fence at T4, repository, lease, Storage, then B acquisition; queued A-to-C is project-mismatch after B activates and never releases B. A-to-A creates the new epoch; an old-epoch exact retry is stale-activation with zero repository work, while the identical command under new epoch replays original receipt metadata. A rejected settlement promise is drained through the existing completion-set rejection arm and remains a request.failure; cleanup cannot swallow the failure or release unfinished work. If close cleanup fails, retain old source epoch/release stage and follow only a later valid explicit switch/stop retry. Busy adds no promise to the coordinator completion set and no work to drain.

**Expected red**: Slice 4 only drains multiple independent fence checks and returns its stub; it cannot prove atomic settlement, same-key joining, or no busy backlog. Its FIFO source and queue-time barriers are regression dependencies, not new Red claims.

- **Behavior**: Schema and application validation enforce immutable, private, mutually exclusive receipts with exact request correlation.

**Test**: `validates settled receipts and new non-durable result branches` -> `packages/protocol/src/canonical-project-protocol.test.ts`, `packages/protocol/src/protocol.test.ts`, `apps/harness/src/canonical-project-application.test.ts`.

**Oracle**: Applied1, the exact unchanged/rejected variants, and Settled(D1,Applied1) parse with full equality. New busy/unavailable/exhausted cases accept only their pinned code/retryable combination; flipping retryability or adding receipt fails. Receipt uppercase/nil/malformed identities, sequence `0`, fractions or values above MAX, Writer generation `0`, non-UTC time, zero/negative versions, duplicate/out-of-order/noncontiguous event references, events on unchanged/rejected, rejection on applied/unchanged, missing rejection, and extra fields at result/receipt/rejection/event-reference fail. Inject raw payload, event payload, command fingerprint, token, digest, path, cause, or exception details at each relevant boundary: fail strictly, never strip and accept. Parsed receipt, event list/references, and rejection are frozen. Alter receipt Project/Command while leaving outer correlation unchanged: schema fails. Alter receipt type/version, or coherently alter both receipt and outer correlation away from the original request: application throws exactly CanonicalProjectApplicationError with its locked generic message and no invalid value attached. A new outer epoch with old receipt generation/time is valid; no artificial matching-current-generation rule is added. Diagnostic helpers narrow to the non-settled union. Legacy inactive/mismatch/stale/read-only/broken and settlement-unavailable schema tests remain valid as historical protocol branches.

**Expected red**: no receipt schema or settled/busy/unavailable/exhausted branches exist, and the application only checks flat request correlation before Slice 5.

- **Behavior**: Settlement instants require complete RFC 3339 UTC syntax at input, storage replay, and protocol output.

**Test**: `requires seconds in settlement clocks and persisted receipt instants` -> `packages/protocol/src/canonical-project-protocol.test.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: `2026-09-05T12:00:00Z`, `2026-09-05T12:00:00.123Z`, and `2026-09-05T12:00:00.123456Z` parse unchanged and can be persisted/replayed as the exact same settlement instant text. `2026-09-05T12:00Z`, `2026-09-05T12:00:00+00:00`, `2026-09-05T12:00:00`, and `2026-02-30T12:00:00Z` fail receipt parsing. Independently use each invalid string as the settlement clock after a real handler UPDATE: known-body rollback preserves every pre-call domain/ledger row and the Writer becomes unavailable after the generic request failure. In replay fixtures, return minute-only text simultaneously in receipt settledAt, original-pointer createdAt, and event occurredAt, so string-equality checks alone would agree: timestamp validation still fails, invokes no handler, and writes no row. Valid second/fractional UTC precision is never normalized or truncated on replay.

**Expected red**: Slice 4 has no settlement-clock or receipt-replay boundary; new Slice 5 time validation must reject minute-only values rather than inheriting a library's optional-seconds default. Existing activation timestamp behavior is not reopened by this test.

- **Behavior**: Event aggregate identity validation matches the locked canonical SQL UUID constraint, including during replay.

**Test**: `rejects nil and max aggregate identities in handler events and replay rows` -> `apps/harness/src/canonical-command-registry.test.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: aggregate ID `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` is valid. NIL `00000000-0000-0000-0000-000000000000` and MAX `ffffffff-ffff-ffff-ffff-ffffffffffff` each fail CanonicalEventInputSchema. A handler that first mutates the counter and then returns either invalid aggregate ID fails unexpectedly and rolls back every domain/ledger row. After valid Applied1, independently decorate only an event SELECT's aggregateId with NIL or MAX while keeping its payload hash, timestamp, ordinal, and receipt/source binding unchanged: replay fails internally, invokes no handler, and allocates nothing. Lowercase enforcement remains in the stored-identity schema, and version/variant validation reuses the kernel isDomainIdentity predicate rather than copying its regex. This is the new event aggregate boundary, not a claimed behavior-preserving change to prior repository identity validators.

**Expected red**: Slice 4 has no handler-event or event-replay validation; Slice 5 must enforce the prior SQL domain-identity restriction instead of treating every value accepted by z.uuid as a valid canonical aggregate ID.

- **Behavior**: The real transport/application/Writer/repository pipeline persists and replays typed settlement with exact causation and independent transport order.

**Test**: `round-trips durable settlement and replay over real MessagePorts` -> `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: real MessageChannel ports, runtime/application/coordinator/Writer/worker repository, fixture Storage selection, and test registry; await each response before the next step. At fixed runtime T6, send activation A, D1, the approved A-to-A switch, then same D1 with new epoch, under request IDs `11111111-1111-4111-8111-111111111501`, `11111111-1111-4111-8111-111111111502`, `11111111-1111-4111-8111-111111111503`, `11111111-1111-4111-8111-111111111504`. Events have exactly protocolVersion `4`, messageType `event`, sequences `[1,2,3,4]`, respective generated message IDs `99999999-9999-4999-8999-999999999501`, `99999999-9999-4999-8999-999999999502`, `99999999-9999-4999-8999-999999999503`, `99999999-9999-4999-8999-999999999504`, sentAt T6, and matching request causation. Event names are project.activate.result, project.command.result, project.switch.result, project.command.result. Payloads are exact old-epoch/generation1 activation, Settled(D1,Applied1), target-result for the full source-qualified A-to-A request containing new-epoch/generation2 activation, and Settled(new-epoch D1,Applied1). Last two command receipts are identical while outer epochs differ; both are proven against independently read real DB rows, not receipt-only mocks. Runtime sequences change independently of durable Project sequence, which remains `1`. Stop and close every owner before closing ports/removing the fixture.

**Expected red**: the Slice 4 real-port writable command returns settlement-unavailable and persists no receipt.

- **Behavior**: The production registry is explicitly empty and unknown commands durably reject through real runtime composition without test handlers.

**Test**: `durably rejects commands with the production empty registry` -> `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`.

**Oracle**: use an actual fresh production generation-2 database with no fixture counter table, actual Storage owner/opener, real MessagePorts/runtime/application/coordinator/Writer/repository, and createCanonicalCommandRegistry([]) as bootstrap does. Activate A and submit D1: result is exactly R1/sequence1/T1/generation1 rejected COMMAND_TYPE_UNSUPPORTED/retryable false with empty events. Durable receipt/original pointer/rejection counts are `1/1/1`; events `0`. Retry returns the same receipt. Production imports reach neither fixture module nor `conformance.counter.set` registration; this is a manual dependency review plus existing architecture gate, not a raw-source test or package/build claim. The test registry is a harness test seam, not a production fallback or optional registration feature.

**Expected red**: the production writable path has only the verify-and-stub result before Slice 5.

- **Behavior**: Unexpected command failure remains causation-scoped while unrelated requests stay live.

**Test**: `isolates settlement failure from unrelated pending requests` -> `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`.

**Oracle**: after activation event sequence1, hold ordinary project.open(B) caused by `11111111-1111-4111-8111-111111111505`, and fail D1 caused by `11111111-1111-4111-8111-111111111502` with private error text containing a path, payload, and token. The next event is exactly v4 request.failure, sequence2, generated ID `99999999-9999-4999-8999-999999999502`, T6, D1 causation, and the fixed internal payload. B remains pending through a controlled checkpoint. Resolve it not-registered: sequence3/ID `99999999-9999-4999-8999-999999999503`, B request causation, project.open.result, payload exactly `{status:"not-registered",request:{projectId:B}}`. Later D1 gets writer-unavailable, not another transaction or system.failure. No error cause, filesystem path, token, digest, or raw payload appears in any transmitted value. Repeat with invalid settled result at the application boundary to prove generic sanitization rather than trusting a result-shaped object.

**Expected red**: Slice 4 has no settlement failure or blocked-Writer observation; locked runtime failure isolation itself is a retained characterization.

- **Behavior**: Production process bootstrap supplies the empty registry and every required settlement dependency through the real transport boundary.

**Test**: `settles an unsupported command through the bootstrap-composed empty registry` -> `apps/harness/tests/integration/process-bootstrap.integration.test.ts`.

**Oracle**: call the real startHarnessProcessRuntime with valid temporary Storage/migration bootstrap roots and real MessagePorts; do not substitute a hand-built canonical application, registry, repository, clock, or identity generator. Create and activate Project A using the public commands and send D1 with the actual returned activationId, under request `11111111-1111-4111-8111-111111111502`. The correlated project.command.result is settled with Project A, Command C1, that activationId, and a receipt for conformance.counter.set/version1, outcome rejected, Project sequence1, Writer generation1, events[], and exactly `{code:"COMMAND_TYPE_UNSUPPORTED",retryable:false}`. Only generated receiptId and settledAt are nondeterministic in this production-composition proof: require a lowercase non-NIL/non-MAX domain UUID and a valid second-bearing UTC instant, then independently read the real SQLite rows and require those exact returned values. The receipt/original-pointer/rejection counts are exactly 1/1/1, event count0, last_project_sequence1, stored fingerprint F1, and details_json exactly `{"version":1}` with its independent literal hash. Repeat the same command with new transport request `11111111-1111-4111-8111-111111111504`: it returns the identical receipt, with the new causation and the next runtime sequence, and changes no ledger row. Await the actual bootstrap stop before removing roots or ports. This proves the real factory wiring, not merely an equivalent manually assembled empty-registry fixture.

**Expected red**: the approved Slice 4 bootstrap-composed Writer returns settlement-unavailable for the admitted writable command and has no settlement dependencies or durable rejection; no missing-foundation import or setup failure counts as this Red.

**Explicit S3/S4 assertion migrations (not changes to their historical contracts)**:

| Approved baseline oracle/fixture | Slice 5 implementation assertion |
| --- | --- |
| S3 healthy command and S4 D_A/D_B/D_A_new return settlement-unavailable | Healthy registered fixture now uses real counter DB and returns exact settled metadata plus row proof. Empty production registry returns durable unsupported. Keep schema-only settlement-unavailable tests as historical compatibility of the v4 result union, not healthy execution. |
| S3/S4 command execution invokes verifyFence; injected verification failure produces broken | Execution uses repository.settle and its in-transaction fence. Valid mismatch remains stale-writer; malformed/SQL/transaction failure produces request.failure and blocks Writer. Keep direct verifyFence tests and its legacy broken schema unchanged. |
| S4 held D_A plus different CommandId produce two admitted fence checks | Hold one real settlement, join its exact canonical duplicate, and observe distinct CommandId/content as immediate busy. Switch drains only accepted operation and joins; no busy backlog. |
| S4 successful target/ordinary-session/clock-retry/A-to-A journeys use stub result to prove executable | Preserve their exact lifecycle/source/resource/epoch assertions, replacing only the writable command observation with real registered settlement or durable unsupported as declared by that fixture. A-to-A exact retry uses old receipt generation/time with current outer epoch. |
| S4 failed fence promises normalized by verifyFence cannot reach coordinator rejection wrapper | S5 settlement promises can reject. Exercise the existing rejection completion arm through real Writer errors and still preserve request.failure, resource drain, and explicit close retry. |
| Repository factory/literal fixture lacks S5 members | Supply required registry/identity/clock and settle members. Lifecycle-only unexpected-settlement stubs throw; healthy canonical fixtures never return canned settled data to preserve old tests. Transaction fakes reflect actual closed state after terminal/close acknowledgement and return exact configured PRAGMA results. |
| All command results indexed for diagnostic | Narrow by status or `Exclude<...,{status:"settled"}>`; inspect receipt only in settled branch. Required switchProject stays required everywhere. |

- **TDD-exempt**: kernel brand declarations and named re-exports are type-only/wiring; protocol brand boundary tests and all affected consumer typechecks prove their usage. Existing ProjectSequence/CanonicalEventOrdinal guards remain unchanged and receive no artificial Red.
- **TDD-exempt**: moving identical digest/time/stored-identity validators and row helper behavior to their S5 owners is refactoring. Characterize approved activation/direct-fence/release results first and after the move. New duplicate-alias, width, and connection/cleanup checks have independent Red above. The canonical JSON serializer is new behavior, not a rename of the Storage fingerprint helper.
- **TDD-exempt**: fixture migrations retain required switch and unrelated Storage/Workspace semantics; no raw-source tests or new smoke tests merely for coverage. The real-driver savepoint characterization may be Green before all S5 production changes and is never reported as Red.

#### Automated Verification:

- [ ] Mandatory real-driver SAVEPOINT characterization/preflight passes first: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-command-driver.integration.test.ts -t "characterizes real worker savepoint rollback release and outer commit"`. Record preexisting Green honestly; failure stops implementation for design revision. Author this characterization before adding the file's later S5 configuration behavior so missing S5 imports cannot masquerade as driver failure.
- [ ] Focused protocol/JSON/registry Red-Green contracts pass, followed by separate review/refactor: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/protocol.test.ts apps/harness/src/canonical-json.test.ts apps/harness/src/canonical-command-registry.test.ts`.
- [ ] Focused repository/Writer/coordinator/application regression and failure tests pass: `pnpm exec vitest run apps/harness/src/storage/canonical-command-repository.test.ts apps/harness/src/canonical-project-writer.test.ts apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-application.test.ts apps/harness/src/harness-runtime.test.ts apps/harness/src/storage/local-libsql-worker-client.test.ts`.
- [ ] Real repository/transport settlement, production bootstrap, and migrated activation/switch proof pass: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-command-driver.integration.test.ts apps/harness/tests/integration/canonical-command-repository.integration.test.ts apps/harness/tests/integration/canonical-project-settlement.integration.test.ts apps/harness/tests/integration/process-bootstrap.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/canonical-project-switch.integration.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts`.
- [ ] Unchanged direct Storage fixture consumers remain Green: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`. The shared create fixture is exercised by consumers, not executed as a standalone test.
- [ ] Kernel type checking passes: `pnpm --filter @slopstop/kernel typecheck`.
- [ ] Protocol type checking passes: `pnpm --filter @slopstop/protocol typecheck`.
- [ ] Harness type checking passes including fixture migrations and generic-handler type probes: `pnpm --filter @slopstop/harness typecheck`.
- [ ] Desktop consumer type checking passes with the extended discriminated result union: `pnpm --filter @slopstop/desktop typecheck`.
- [ ] Existing architecture constraints pass: `pnpm check:architecture`.

These are planned implementation gates, all unchecked. Use one named test/file for each actual red-green loop, not the entire list at every step. No full/deep/package/build/install/migration-generation/mutation/native-crash or future Slice 6 check is part of this slice. No such command was run during this document-only work.

#### Manual Verification:

- [ ] Review the sole S5-delta-marked Architecture block for each touched production file, full named imports/exports, declared package boundaries, strict result narrowing, and all exact SQL columns/aliases against the unchanged generation-2 declarations and foreign/unique/check constraints.
- [ ] Confirm canonical JSON sorting does not build an ordinary object via assignment, preserves own proto-like keys, and fingerprints only the version-1 submitted meaning; expected test digests use independently hashed literal text.
- [ ] Confirm raw parsed command text is captured synchronously after source/epoch/access/barrier checks and before repository work; registry transforms and handler/output mutation cannot redefine it.
- [ ] Observe one accepted held settlement, its exact join, and distinct busy response. Verify one real transaction, one handler invocation, no queued work, and correct same-epoch correlation for each transport request.
- [ ] Observe applied, write-then-unchanged, write-then-rejected, unsupported, invalid-payload, exact-retry, and first-conflict outcomes against actual SQLite rows, including event order/hash and fixed safe rejection details.
- [ ] Confirm ledger lookup validates original binding before registry work, rejects missing-pointer corruption and malformed prior children, and never claims historical raw command reconstruction.
- [ ] Confirm exhausted new commands perform no handler/ID/clock/write work while exact original/conflict retries still return their immutable receipts at MAX_SAFE_INTEGER.
- [ ] Observe every known begin/body mutation fault restore pre-call rows; for commit/timeout/close-after-commit failures assert only generic request.failure, blocked Writer, and retained resource ordering, with no inferred rollback or recovery-record claim.
- [ ] Observe revoked facade denial and complete issued-SQL drain, including swallowed/unawaited failure; confirm trusted handler policy prohibits transaction-control and Writer/settlement-table SQL without claiming a SQL sandbox.
- [ ] Observe close failure retain its exact transaction until explicit successful cleanup; no fence retirement, repository close, or lease release may precede that acknowledgement. A hung underlying transaction keeps lifecycle work held, not released by a timer.
- [ ] Observe source-qualified switching retain every approved FIFO/source/epoch/release-failure rule while using real settlements instead of verify-only stub oracles. Busy contributes no drain backlog; stale queued retries never affect a new activation.
- [ ] Confirm conformance counter/table/definitions remain test-owned, production registry is explicitly empty, and the unchanged exact-schema production opener is never claimed to accept the test table. No build or package absence proof is claimed in S5; review the production import closure and run the architecture gate only.
- [ ] Observe the real startHarnessProcessRuntime consumer settle and replay an unsupported command with durable rows matching its actual generated receipt/time; no test substitution supplies a missing registry or settlement factory dependency.
- [ ] Confirm required switchProject and all direct runtime caller contracts compose without optional fallbacks or future Slice 6 symbols; runtime/request.failure and protocol version 4 remain unchanged.
- [ ] Confirm all approved Slices 1-4 Test Contracts, verification sections, and history are preserved verbatim. Slice 5 requires the separate code/contract approval recorded below before implementation; Slices 6-7 remain unimplemented.

### Slice 6: Uncertain Commit Recovery

**Status**: Approved and locked after independent static verification and the separate user code/Test Contract/criteria checkpoint recorded under Developer Context. The new behavioral contract was approved separately with exact answer `Aprovar contrato (Recommended)`. All implementation/runtime gates remain unchecked; this design approval does not authorize product implementation or waive mandatory proof.

**Files**:

- MODIFY production relative to projected Slice 5: `apps/harness/src/storage/project-storage-transaction.ts`, `apps/harness/src/storage/canonical-command-repository.ts`, `apps/harness/src/storage/canonical-command-ledger.ts`, `apps/harness/src/storage/canonical-command-settlement.ts`.
- NEW production owner: `apps/harness/src/storage/canonical-writer-recovery.ts`.
- NEW tests, authored only during implementation: `apps/harness/src/storage/project-storage-transaction.test.ts`, `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.
- MODIFY projected tests/fixtures: `apps/harness/src/storage/canonical-command-repository.test.ts`, `apps/harness/src/canonical-project-writer.test.ts`, `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`, `apps/harness/tests/integration/canonical-project-switch.integration.test.ts`, `apps/harness/tests/integration/canonical-command-fixture.ts`.
- Existing regression consumers, not production modifications: `apps/harness/src/storage/project-storage-node-adapters.test.ts`, `apps/harness/src/storage/local-libsql-worker-client.test.ts`, and the S5 production-bootstrap integration test.

Unchanged production dependencies: `canonical-project-writer.ts` owns one-flight/join/busy, blocks every unexpected settlement error, drains queued cleanup, and wraps fence/repository failures; `active-project-coordinator.ts` owns the existing source-qualified FIFO lifecycle and retained epoch; `canonical-project-application.ts` and `harness-runtime.ts` own unchanged validation and generic correlated request.failure. No speculative Writer quarantine API, coordinator recovery API, new transport/protocol type, optional bootstrap bypass, or app modification is needed. `process-bootstrap.ts` already passes createRecoveryRecordId and now in the required factory dependencies, so it stays unchanged; its existing real-composition test is a regression, not a newly authored S6 wiring test. The actual empty-registry restart case below belongs to the recovery integration journey. Add a bootstrap-specific new test only if later independent review demonstrates a real wiring change and the inventory is explicitly revised.

Direct caller compatibility: live `project-storage-node-adapters.ts:249-265,1518-1545,1565-1589` keep the exact withWriteTransaction signature and need no edits. Live direct helper tests at `project-storage-node-adapters.test.ts:519-662` and real deferred-FK COMMIT at `local-libsql-worker-client.test.ts:13-38` retain their existing outputs. The projected repository is the sole production caller of settleCanonicalCommand; it now passes the fingerprint it computes with the same S5 owner. Existing settlement authority and sequence reads are extracted into internal exports, never duplicated fence SQL. Recovery imports those owners and the checked ledger; none imports repository or Writer, avoiding a cycle. Every new write goes through the existing configured client and owned-close wrapper. SQL/schema/migration/spec/snapshot/kernel/protocol/lockfile/package files remain unchanged.

Fixture requirements: extend the projected `canonical-command-fixture.ts` with public decorators of the real worker client's transaction/SQL/commit/close and deterministic fault checkpoints, and reuse `conformance-counter-command.ts` unchanged. The new recovery integration test uses actual generation-2 SQLite and the S5 fixture-owned counter/Storage-selection port; never claim that production exact-schema opening accepts its extra table. Use an independent reader after acknowledged close or known body rollback. No canned receipt, private field access, raw-source assertion, timer-based ownership release, or actual forced termination supplies S6 proof. All fixture/test names occur only here and in contracts, not as new Architecture or File Map test entries. Recording uses the existing repository `now` dependency, not a new optional recording-clock API: pin its call sequence so the failing first settlement may consume T1 for its receipt, but cannot consume the later Tj recording value until explicit cleanup. Recovery metadata counters distinguish that phase, not an invented separate production dependency.

#### Test Contract:

All aliases below expand to complete exact values. Reuse S5's pinned A/B, epochs, aggregate, C1-C6, R1-R6, E1/E2, D1, Applied1, F1, independent H(literal), and T0-T6 definitions without changing their historical contracts. Each genuinely new behavior must have an observed runtime-assertion Expected Red against the implemented approved Slice 5 baseline, minimal Green, then a separate review/refactor gate. Missing S3-S5 source, setup failure, missing fixture, or an unimportable new runner is not behavior Red. Pure lookup/authority/helper extraction first preserves preexisting Green and then passes the same characterizations after extraction. Design authoring itself is documentation-only; none of these future checks has run.

**Additional pinned values**:

| Name | Exact value |
| --- | --- |
| Recovery record M1 | `88888888-8888-4888-8888-888888888601` |
| Recovery record M2 | `88888888-8888-4888-8888-888888888602` |
| Initial/recovery handoff H1/H2 | `88888888-8888-4888-9888-888888888601`, `88888888-8888-4888-9888-888888888602` |
| Third A epoch | `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3` |
| Explicit recording Tj | `2026-09-05T12:00:04.250Z` |
| Later recording retry Tj2 | `2026-09-05T12:00:04.750Z` |
| Third activation T7 | `2026-09-05T12:00:07.000Z` |
| Runtime clock Tr | `2026-09-05T12:01:00.000Z` |

`Unresolved1` is the exact locked-column row `(A,M1,1,"commit-uncertain",C1,F1,Tj,null,null,null)`. `Resolved1(found)` and `Resolved1(absent)` replace only its final three columns with respectively `("receipt-found",2,T5)` and `("receipt-absent",2,T5)`. `AbsentRetry1` is Applied1 with receiptId R2, writerGeneration 2, settledAt T6, and event IDs `77777777-7777-4777-8777-777777777603`/`77777777-7777-4777-8777-777777777604` at ordinals 0/1; Project sequence stays 1. R1/E1/E2/T1 were already consumed inside the failed before-delegate COMMIT transaction and are not reused. Reset each fault case to its own real fixture rather than assigning one final state to incompatible histories.

Exact release boundary: repository release failure is CanonicalCommandRepositoryError with code `WRITER_FENCE_RELEASE_FAILED`, message `Canonical Writer fence release failed.`, and private cause; direct repository close failure uses `WRITER_REPOSITORY_CLOSE_FAILED`, message `Canonical Writer repository close failed.`. Writer translates those to its existing stage code and message `Canonical Project Writer release failed.`. Source-qualified switch returns exactly `{status:"release-failed",request:S_AA,diagnostic:{code:"WRITER_FENCE_RELEASE_FAILED",message:"Project activation resources could not be released.",retryable:true}}` for a marker/old-close failure at the fence stage. Wrong current authority returns WRITER_FENCE_STALE/retryable false, not a forced release. Activation corruption with successful cleanup returns exactly `{status:"broken",request:{projectId:A},diagnostic:{code:"WRITER_FENCE_ACTIVATION_FAILED",message:"Canonical Writer fence activation failed.",retryable:false}}`; inside a switch this is its target-result.target. Failed acquisition cleanup instead retains the existing WRITER_REPOSITORY_CLOSE_FAILED/Project activation resources message/null-epoch outcome. Stop rejects through its existing owned failure boundary; there is no invented stop transport envelope.

- **Behavior**: The classified runner preserves primary evidence across every terminal and cleanup branch while legacy callers retain exact results and failures.

**Test**: `classifies primary write transaction phases without changing legacy failure identity` -> `apps/harness/src/storage/project-storage-transaction.test.ts`; retained direct-call regressions -> `apps/harness/src/storage/project-storage-node-adapters.test.ts:519-662` and `apps/harness/src/storage/local-libsql-worker-client.test.ts:13-38`.

**Oracle**: distinct sentinel Error objects B (begin), P (body or commit), R (rollback), C (close); successful result literal `"completed"`. Begin synchronous throw/asynchronous rejection gives failed/begin/not-attempted with primaryError and error identical to B, zero operation/commit/rollback/close calls. Body synchronous throw/asynchronous rejection gives failed/body/not-attempted, primaryError P, zero commit calls, then the legacy rollback and close attempts. A call to commit that throws synchronously before delegation, rejects before actual SQL, delegates a real successful commit then throws, or loses/times out its acknowledgement gives failed/commit/uncertain, primaryError P. Run each body/commit case with closed false and rollback success, closed true and skipped rollback, rollback failure, close success, synchronous/asynchronous close failure, and both rollback/close failure. Successful/skipped rollback leaves error exactly P; it never promotes uncertain to rolled-back. Acknowledged commit then failed close is failed/close/acknowledged with primaryError/error exactly C and no rollback; successful commit and close gives exactly succeeded/closed/acknowledged/result completed. Hold close acknowledgement and verify neither runner nor legacy wrapper resolves success early.

**Oracle, exact legacy diagnostics**: rollback failure wraps P/R in ProjectStorageBrokenError(`Project Storage transaction rollback failed.`), whose AggregateError cause has ordered `[P,R]` and message `Project Storage transaction and rollback both failed.`. Ordinary P plus close failure is AggregateError(`[P,C]`, `Project Storage transaction and close both failed.`). Both secondary failures retain the same ProjectStorageBrokenError message and cause AggregateError(`[P,R,C]`, `Project Storage transaction, rollback, and close all failed.`). Also pin appendCloseFailure's existing branches where P itself is ProjectStorageBrokenError with no aggregate cause, and with a preexisting aggregate cause `[B,R]`: the former preserves P.message with aggregate `[P,C]`/transaction-and-close message; the latter preserves P.message with aggregate `[B,R,C]`/transaction-rollback-close message. Do not wrap/normalize these into new errors for legacy callers. Repeat each operation through both public helper exports using the same sentinel identities. In the Storage application regression the exact public result stays broken/PROJECT_STORAGE_OWNER_FAILED with message `Project Storage transaction rollback failed.` and no private path or aggregate messages. Direct Storage production callers need no signature change.

**Expected Red**: S5 has only combined body/commit failure evidence and cannot produce the phase matrix; assert incorrect/missing phase evidence after the new export is mechanically wired to the characterized outcome engine, not a module-resolution failure. Legacy error/return characterizations themselves are pre/post Green, not new Red. Separate body and commit catch scopes must make a rejected body impossible to classify as a commit request.

- **Behavior**: A real failed deferred-FK COMMIT remains conservatively uncertain even though the driver allows successful rollback.

**Test**: `classifies a real deferred foreign key commit failure as uncertain` -> `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`.

**Oracle**: repeat the live worker test's actual parent/child DEFERRABLE INITIALLY DEFERRED fixture through the classified runner. The real child insertion succeeds; actual commit rejects while closed false; rollback and close succeed; final child rows are `[]`. Outcome is failed/commit/uncertain with the original commit error as primaryError and error, not not-attempted/rolled-back. This exact driver's independently observed empty result is not promoted into a rule about every failed commit. Preserve the existing direct worker test unchanged.

**Expected Red**: the S5 helper exposes no commit-phase outcome, so the new phase assertion fails; the raw driver rollback capability is a preexisting Green characterization.

- **Behavior**: An uncertain settlement blocks its Writer and repository without journaling or allocating recovery metadata on the failing request.

**Test**: `retains uncertain command identity without writing on the failing request` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`, `apps/harness/src/canonical-project-writer.test.ts`.

**Oracle**: on real schema-generation-2 A at Writer generation1/sequence0/counter(0,1), submit D1 plus its exact simultaneous canonical duplicate. Before-delegate COMMIT throw with successful rollback/close leaves counter(0,1), sequence0, receipts/pointers/rejections/events counts `0/0/0/0`. After-real-COMMIT throw leaves exact Applied1, sequence1, counter(7,2), pointers1/rejections0/events2. Both return the identical private error at the Writer/application seam, or identical legacy aggregate if secondary cleanup fails; every transport request gets its own generic correlated request.failure, never a command result or system.failure. No recovery row exists and marker ID/recording-clock counts are zero. The two joined requests use one settlement transaction and produce one descriptor, proven later by one exact Unresolved1, not private-state inspection. Subsequent D1 and C2 requests return their exact S5 Failure(...,writer-unavailable) with zero new repository transaction/registry/hash/identity/time work. Direct repository.settle with original, distinct, or malformed text rejects `Canonical Writer requires uncertainty recovery.` before parsing/hash/transaction work; it cannot clear the retained descriptor. Begin/body errors and acknowledged-commit/close failure still block the Writer but their later successful explicit release creates no commit-uncertain row. No successful normal settlement or replay allocates a recovery ID or recording time.

**Expected Red**: S5 blocks the Writer but retains no uncertain descriptor and does not prevent direct repository reuse after completed cleanup; its explicit release leaves recovery rows empty. Blocking/join/busy and generic failure identity remain Green regression assertions; newly retained evidence/direct denial and later marker observation supply actual Red.

- **Behavior**: Explicit cleanup must acknowledge the old transaction close before preparing a marker or releasing any authority.

**Test**: `journals only on explicit cleanup after acknowledged transaction close` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`, `apps/harness/src/storage/canonical-command-repository.test.ts`.

**Oracle**: after uncertain D1, queue S_AA or explicit owner stop; its log is exactly old-transaction close acknowledgement (when retry is needed), marker preparation, fenced marker transaction/commit/close acknowledgement, fence release transaction, repository close, native lease release, activation Storage close. Only then may a switch acquire its target. Delay or reject the old close, or return close success with closed false: no marker factory/time, marker SQL, fence release, repository-client/native lease/Storage close occurs; failure uses the exact release boundary above and retains A/old epoch. A later valid explicit call retries that same close once; upon success prepares M1/Tj and writes exact Unresolved1 before continuing. If the old close was already acknowledged on the failing request, no redundant old transaction close is required. An unsettled/hung transaction remains owned forever until actual acknowledgement, not a timer or a merely true closed flag. Direct repository.close follows the same old-close/marker prerequisite and cannot silently discard unrecorded uncertainty; marker failure maps to its existing repository-close error. Observing a successful rollback/close alone never clears uncertainty. Record-clock/ID evaluation occurs only in this explicit cleanup, separately from the coordinator's existing release clock.

**Expected Red**: S5's successful explicit cleanup skips marker preparation/persistence and may advance to native release with zero recovery rows. Existing retained-close behavior is a regression baseline; no fake Red from a missing configured client or fixture is accepted.

- **Behavior**: Marker preparation is validated once as a complete record and a preparation failure cannot release ownership.

**Test**: `retains uncertainty across invalid recovery identities and recording clocks` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: independently throw from createRecoveryRecordId/now or return uppercase M1, malformed UUID, NIL `00000000-0000-0000-0000-000000000000`, MAX `ffffffff-ffff-ffff-ffff-ffffffffffff`, minute-only `2026-09-05T12:00Z`, offset `2026-09-05T12:00:04+00:00`, zone-less `2026-09-05T12:00:04`, or impossible `2026-02-30T12:00:04Z`. Each explicit release/close fails at its existing boundary, writes no marker, does no fence/native release, and retains the original C1/F1. A later explicit call with valid M1/Tj prepares one complete exact record and proceeds. Successful preparation is retained before entering SQL; subsequent SQL/ack failures cannot consume M2/Tj2, switch identity, overwrite observedAt, or replace command/fingerprint. If preparation itself never fully validates, a later call may prepare anew; no partially validated record is treated as durable. Valid seconds/fractional-seconds UTC strings are stored exactly, without normalization. Invalid identity can fail before clock invocation; no normal command or replay consumes either marker factory.

**Expected Red**: S5 never prepares this record, so injected marker ID/time failures do not block explicit release and no exact marker can be observed.

- **Behavior**: Recording is idempotent across a landed marker COMMIT whose acknowledgement is lost, with no automatic retry.

**Test**: `recognizes the exact prepared recovery row after recording acknowledgement loss` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: first explicit release prepares M1/Tj, performs real INSERT Unresolved1 and real COMMIT, then its commit decorator throws. The call fails with WRITER_FENCE_RELEASE_FAILED, keeps the same native lease, issues zero fence release, and performs no next marker attempt after a controlled idle checkpoint. Next explicit release first finishes any unacknowledged old marker transaction close, then checks actual current token/generation and real SELECT rows. It accepts byte/value-identical Unresolved1, issues zero second INSERT, acknowledges that transaction and only then retires the fence. Marker factory/time counts stay one successful preparation; table count stays1, M1/Tj unchanged. Repeat marker SQL/body failure with rollback/close success: row count0 until the next explicit call inserts exactly M1/Tj, not M2/Tj2. Repeat known marker-body rollback failure plus close failure: preserve ordered private causes under the same broken boundary, ownership and prepared record; no automatic retry, no recursive commit-uncertainty descriptor for the recording transaction itself. Hold marker COMMIT or close acknowledgement: fence/native release remain zero. Once recording is acknowledged, a subsequent repository/lease/Storage release-stage retry performs no repeated journal transaction. Direct settle remains blocked even after recorded state.

**Expected Red**: S5 performs no marker write/check and releases without this acknowledgement barrier. The new code must fail these exact row/order/identity assertions before the recording protocol is implemented; canned SELECT receipts or synthetic COMMIT success cannot supply Green.

- **Behavior**: Marker admission rejects conflicting, malformed, duplicate, future, or dangling recovery authority instead of overwriting it.

**Test**: `refuses mismatched durable uncertainty without changing record identity` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: before explicit recording, independently substitute existing applicable M2 rather than M1, B rather than A, G2 rather than G1, abandoned-active-fence rather than commit-uncertain, C2 rather than C1, another valid fingerprint, Tj2 rather than Tj, or any non-null resolution tuple. Also supply two current-generation rows, an older unresolved row, a future row, missing joined generation, malformed source identity/token/time, partial resolution fields, or alias/width drift. Each returns the exact release/close failure boundary with no overwrite, second insertion, fence/native release, or hidden reclassification to abandoned. A genuine absent set is the sole insert branch; exact matching unresolved row is the sole already-recorded branch. Wrong token or a well-formed stale/released fence does not permit a marker write: release returns stale, Writer maps to WRITER_FENCE_STALE/retryable false, while direct close remains broken and retained. Broken joined authority is a failure, not stale/absence. SQL constraints remain enabled in production; feasible corruptions are inserted in isolated test setup, and impossible shapes/duplicates are public SELECT decorators over real SQL results, not private state mutation.

**Expected Red**: S5 never inspects recovery authority on explicit release and would ignore these rows and retire the fence. Existing stale release diagnostics are retained characterizations.

- **Behavior**: Explicit activation resolves either exact receipt outcome atomically without executing the uncertain command.

**Test**: `resolves found and absent uncertainty during same Project activation without command execution` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: after the two real settlement variants and acknowledged explicit release at T4 with Unresolved1 observed at Tj, reactivate A at new epoch/T5/second token. For landed settlement, row becomes exactly Resolved1(found); otherwise exactly Resolved1(absent). Both advance last_writer_generation to2 and updated_at toT5, insert generation2 with new epoch/second-token H/T5/null, handoff exactly `(A,H2,1,2,"recovery",T5)`, and active fence `(A,2,H(second token),"active",T5,null)`. Generation1's acquired_at T0 and released_at T4 stay unchanged. Counter/sequence/receipt/events remain respectively `(7,2)/1/Applied1/E1,E2` or `(0,1)/0/none/none`; no registry/handler/receipt-ID/event-ID/settlement-time callback runs, and no new recovery ID is allocated. Activation uses only its preexisting activation/token/handoff/activation-clock allocations. The lookup's generation upper bound remains1, never freshly advanced2. Activation itself returns only the existing active result, not an invented recovery receipt payload.

**Oracle, active predecessor**: use fixture SQL to prepare the equivalent abandoned database state with Unresolved1 and an active generation1/fence (do not claim a real crash). Under a new lease, release generation1 at T5, resolve M1 in place, and replace the fence; total recovery row count remains1 and no abandoned record ID is consumed. With no marker and active predecessor, preserve exactly `(A,M1,1,"abandoned-active-fence",null,null,T5,"generation-superseded",2,T5)` and the existing recovery handoff, regardless of whether some ledger receipt exists. No lookup can infer a missing CommandId or label it receipt-absent. With no marker and cleanly released predecessor, preserve clean handoff and no recovery row. Initial generation0 requires no applicable recovery rows and uses only the initial handoff.

**Expected Red**: S5 activation ignores released-fence uncertainty and chooses clean handoff, or attempts an additional abandoned row for active marked generation, violating the existing unique per-generation constraint. It neither resolves the marker nor proves requested-receipt absence. Initial/clean/unmarked-abandonment results themselves are pre/post Green.

- **Behavior**: Reconciliation uses checked receipt authority for exactly the stored fingerprint, including rejection, unchanged, conflict, and older-generation replay.

**Test**: `reconciles every durable receipt family without reconstructing command payload` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`.

**Oracle**: after Applied1 at G1, make value8 under C1 uncertain at commit, with exact fingerprint H of the S5 D1 literal changed only from value7 to8, and preallocated R2/T2. If actual COMMIT landed, the requested validated R2/sequence2/rejected IDEMPOTENCY_CONFLICT/false/events[] yields receipt-found; original pointer stays `(A,C1,F1,R1,T1)`, counter(7,2), E1/E2 unchanged. If COMMIT never ran, validate original R1 and the coherent missing value8 receipt, then resolve receipt-absent for value8 only; preserve original pointer. Later explicit value8 retry creates R3/sequence2/generation2/T6 rejected IDEMPOTENCY_CONFLICT exactly once, with no handler call or domain mutation. An exact retry of existing R2 returns R2 before registry even when registry is empty. Repeat independently for uncertain first unsupported rejection R1/sequence1/generation1/T1 and uncertain first write-then-unchanged R1 with no children: landed commits resolve found, nonlanded commits absent, and handler writes stay rolled back according to S5.

**Oracle, older receipt**: Applied1 settled in G1, cleanly reactivate G2 at new epoch/T5, then make its exact replay COMMIT uncertain. The marker is `(A,M2,2,"commit-uncertain",C1,F1,T6,null,null,null)`; explicit activation G3 at third epoch/T7 resolves it to receipt-found with resolver3/T7. Applied1 remains generation1/T1 and counter(7,2)/sequence1, no new settlement IDs/events. No equality-to-current-G2 rule may reject its older valid receipt. Lookup never reconstructs raw payload/type/version from fingerprint and never calls Storage createRequestId inspection.

**Expected Red**: S5 does not resolve recovery rows for any receipt family. Checked core extraction and ordinary wrapper type/version/hash/binding checks are pre/post Green; new activation-resolution observations supply Red.

- **Behavior**: Recovery resolution is historical, explicit retry is separate, and startup or switching to another Project never executes or restores the lost command.

**Test**: `keeps recovery history stable across explicit retry Project switching and restart` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: after Resolved1(absent), wait without any command: counter(0,1), sequence0, no receipt or event. Explicit D1 at new epoch/T6 yields exactly AbsentRetry1, counter(7,2), sequence1, one original pointer and two new events; another exact retry returns it unchanged. Resolved1(absent) remains exactly identical forever, not upgraded to found. After Resolved1(found), user retry with empty registry returns original Applied1 and no new metadata/domain mutation. A-to-B after uncertain A first records/releases A but does not resolve its marker in B; B generation1 starts with no A recovery/ledger changes. Later B-to-A resolves A's G1 marker under A/G2 only. Fresh real coordinator/runtime over the persisted Project starts inactive with zero activation dependency work; D1 is inactive/PROJECT_INACTIVE until an explicit activation. An abrupt-death-before-marker database fixture with active fence and either zero receipts or landed Applied1 yields only the generic abandoned record on activation. A later same-ID/content retry independently returns the original receipt if present, otherwise performs the first settlement; no record invents the unrecorded command. These fixtures simulate durable states, not packaged crash proof.

**Oracle, production composition**: use the actual unextended generation-2 Storage and real createCanonicalCommandRegistry([]) production definition, not a conformance registration. First unsupported C1 receipt is durably rejected once; an explicit stop followed by fresh runtime/coordinator/real repository starts inactive, and explicit activation plus exact user retry returns the prior rejected receipt at its original generation/time. Source-level fault decorators can additionally make the repository COMMIT uncertain before that release. This is an actual empty-registry composition journey, not a newly invented bootstrap injection API. Keep S5's existing actual startHarnessProcessRuntime test as a regression; if any production-generated metadata is used, independently query the DB and compare its exact returned identity/time rather than pretending those values are pinned.

**Expected Red**: S5 cannot resolve/preserve this new historical record or enforce journal-before-A-release. No automatic restoration/retry and ordinary empty-registry replay are existing Green contracts, not new Red claims.

- **Behavior**: Corrupt ledger or recovery evidence makes activation broken, never absent, and exposes no new epoch.

**Test**: `rejects corrupt uncertainty evidence without advancing activation` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: independently corrupt original pointer Project/Command/fingerprint/receipt/time, delete pointer leaving receipts, remove referenced original/requested receipt, corrupt requested command binding or stored fingerprint, original/conflicting receipt family/order, rejection cardinality/details digest, event binding/ordinal/payload digest, receipt UUID/time/sequence/generation or joined generation. Include all S5 replay-child malformed cases, valid-but-wrong hashes, sequence above last_project_sequence, and receipt generation2 while the marker/prior authority is generation1; using new G2 as lookup bound must not hide that fault. Inject marker malformed UUID (including NIL/MAX/uppercase), time (minute-only/offset/impossible), reason/command/resolution shape, duplicate current rows, foreign Project, future rows/resolver, older unresolved rows, missing source/resolver generation, and a resolved record at the still-current predecessor with resolver <=G, >G, or missing join. All return the exact broken activation boundary above with no active epoch, no registry/handler/sequence/receipt/event mutation, and no automatic source restoration. Proper released G with unresolved commit marker is valid; an unresolved abandoned-active-fence shape is broken, not missing. Rows outside the selected historical scope are not claimed to receive a full-history audit. Corruption unsupported by SQL constraints is supplied via public SELECT decorators; raw private state mutation is not proof.

**Expected Red**: S5 ignores recovery rows and can activate over a released predecessor containing invalid unresolved authority; active marked predecessor may fail only through duplicate insertion rather than validated resolution. Tests pin the exact intended branch and zero new handler/write work, not an unrelated FK/setup error. Ledger validators themselves retain pre/post Green.

- **Behavior**: Every activation write is atomic and conditional drift rolls back the entire recovery handoff.

**Test**: `rolls back recovery activation at every generation resolution and fence checkpoint` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`.

**Oracle**: capture all exact pre-activation rows in project_state, writer_generations, writer_fence, writer_handoffs, writer_recovery_records, and all domain/ledger tables. Inject a known body throw after real last-generation UPDATE, new-generation INSERT, active old-generation release, recovery-resolution UPDATE, handoff INSERT, and fence replacement, independently; also return rowsAffected0 or2 for each conditional write. With acknowledged rollback/close, a new independent reader sees every captured row unchanged, including null resolution and original timestamps. Conditional fence UPDATE matches prior generation/token/state/releasedAt; a same-transaction changed or deleted predecessor cannot be silently overwritten or recreated. Initial activation uses plain INSERT, so an unexpected existing fence is also broken. Duplicate per-generation marker and duplicate unresolved marker in one Project are rejected by the unchanged exact unique constraints; no second abandoned row is attempted for a marked generation. Repeat released-predecessor branch: no UPDATE touches its existing releasedAt. Commit/close failure after activation or fence release uses existing fail-closed outcomes only; do not apply the known-body rollback oracle, add automatic lifecycle repair, or pretend a stale released fence is current.

**Expected Red**: S5 has no conditional recovery-resolution update or marked recovery handoff, and its unconditional fence replacement cannot reject the new predecessor-drift assertion. Existing body rollback and generation rowcount checks are characterizations; no control-plane COMMIT result is misreported as proven rollback.

- **Behavior**: Real MessagePort recovery preserves generic request failure isolation, exact causation, explicit activation, and once-only domain mutation.

**Test**: `round-trips uncertain settlement explicit reactivation and user retry over real ports` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`, with existing regression journeys in `canonical-project-settlement.integration.test.ts` and `canonical-project-switch.integration.test.ts`.

**Oracle**: actual MessageChannel/runtime/application/coordinator/Writer/repository/worker/SQLite, fixed Tr, and exact S5 D1. Send the following requests, await each listed response in order, and hold ordinary Storage B until row5. Every envelope has protocolVersion4, messageType event, sentAt `2026-09-05T12:01:00.000Z`, the specified full UUID, sequence, and exact causation. Use both actual before-delegate and after-real-COMMIT throw decorators. No fake receipt or optional production registry is permitted.

| Sequence | Event ID | Causation | Event / exact payload |
| --- | --- | --- | --- |
| 1 | `99999999-9999-4999-8999-999999999601` | `11111111-1111-4111-8111-111111111601` | project.activate.result / `{status:"active",request:{projectId:A},access:"read-write",activationId:old A epoch,writerGeneration:1}` |
| 2 | `99999999-9999-4999-8999-999999999602` | `11111111-1111-4111-8111-111111111602` | request.failure / `{code:"HARNESS_INTERNAL_FAILURE",message:"Harness failed while handling a message.",retryable:false}` for D1, while project.open(B) under the row5 causation remains pending |
| 3 | `99999999-9999-4999-8999-999999999603` | `11111111-1111-4111-8111-111111111603` | project.command.result / exact Failure(D1,writer-unavailable), no new transaction |
| 4 | `99999999-9999-4999-8999-999999999604` | `11111111-1111-4111-8111-111111111604` | project.switch.result / `{status:"target-result",request:S_AA,target:{status:"active",request:{projectId:A},access:"read-write",activationId:new A epoch,writerGeneration:2}}`; M1 now exactly Resolved1(found/absent), no user command has run during activation |
| 5 | `99999999-9999-4999-8999-999999999605` | `11111111-1111-4111-8111-111111111605` | project.open.result / `{status:"not-registered",request:{projectId:B}}` after explicitly resolving held unrelated Storage work |
| 6 | `99999999-9999-4999-8999-999999999606` | `11111111-1111-4111-8111-111111111606` | project.command.result / exact Settled(new-epoch D1,Applied1) for found, or Settled(new-epoch D1,AbsentRetry1) for absent |
| 7 | `99999999-9999-4999-8999-999999999607` | `11111111-1111-4111-8111-111111111607` | project.command.result / identical receipt to row6, same current outer correlation, fresh transport causation only |

At row2 no marker exists; at row4 the marker is resolved and receipt/counter still reflect the observed prior outcome; after rows6/7 counter is exactly(7,2), last_project_sequence1, receipt/pointer counts1/1, events2. Runtime sequences1-7 are not Project sequence. Verify every full receipt, event/detail hash and generation/time against an independent DB reader. Joined-failure variant uses two full request IDs and two independently correlated generic failure envelopes with consecutive event sequence, one actual uncertainty descriptor/marker, and no second counter change. Serialize all wire messages and prove absence of private sentinel text, path, source/payload, token, protected digest, and raw causes. Await explicit owner cleanup before closing ports/fixture; a failed runtime shutdown is not silently retried inside the runtime's already-existing cached stop promise.

**Expected Red**: the S5 real pipeline can fail and reactivate but cannot produce row4's exact reconciled record/recovery handoff; it currently skips the marker barrier. Unrelated-request isolation, required switch semantics, once-only ordinary replay, and event sequencing remain Green dependencies rather than invented new failures.

- **Behavior**: Activation validates the complete predecessor fence and generation binding before repairing or superseding any authority.

**Test**: `rejects invalid predecessor activation timestamps before recovery writes` -> `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`, `apps/harness/tests/integration/canonical-project-activation.integration.test.ts`.

**Oracle**: start with the released-generation1/Unresolved1 fixture, where fence activated_at and generation acquired_at both equal `2026-09-05T12:00:00.000Z`. Independently set fence activated_at to `not-a-time`, to minute-only `2026-09-05T12:00Z`, or leave that fence unchanged and set generation acquired_at to valid but conflicting `2026-09-05T12:00:01.000Z`. Each activation returns the existing broken/WRITER_FENCE_ACTIVATION_FAILED boundary without exposing a new epoch. An independent reader sees all pre-activation rows unchanged, including the original unresolved marker and its source generation; no generation UPDATE, resolver INSERT, recovery resolution, handoff, fence replacement, or command work occurs. Repeat for active marked predecessors and unmarked active/released predecessors: the shared structural reader must validate timestamp syntax, source activation identity, generation/token binding, and release shape before the old fence can be replaced. A missing full-reader fence after a nonempty prior-state projection is broken, never a valid released predecessor. Existing healthy initial, clean, abandoned, and marked recovery cases still pass unchanged.

**Expected Red**: Slice 5's activation predecessor query checks counts, generation/token and release shape but does not validate activated_at or bind it to acquired_at. Its settlement-only full validator cannot protect activation until Slice 6 shares that reader.

- **Behavior**: Asynchronous preprocessing cannot let a direct repository request bypass newly retained quarantine or overwrite the original uncertain command.

**Test**: `rechecks repository quarantine after a suspended token hash` -> `apps/harness/src/storage/canonical-command-repository.test.ts`, `apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.

**Oracle**: after activating A/generation1, submit C2 directly to the public repository and hold its token-hash promise. Submit C1 separately; allow its hash and real transaction to reach either before-delegate or after-real-COMMIT rejection and complete cleanup, retaining C1/F1 uncertainty. Capture transaction/handler/ledger observations, then resolve C2's held hash. C2 rejects with exactly `Canonical Writer requires uncertainty recovery.` before another transaction or handler begins, changes no row, and does not replace C1/F1. A later explicit release records exactly the original Unresolved1 CommandId/fingerprint and one marker, never C2's identity. This exercises the direct repository contract deliberately; normal Writer single-flight behavior remains a separate unchanged defense. There is no await between the post-hash quarantine check and transaction admission.

**Expected Red**: Slice 5 has no retained uncertainty check; a single pre-await check in Slice 6 would also allow the held request to start SQL after C1 quarantines the repository.

**Explicit S6 assertion migrations (historical Slices 1-5 remain unchanged)**:

| Historical baseline | S6 execution assertion |
| --- | --- |
| S5 creates no recovery row for settlement failure or subsequent release | Failing request still creates none. Only commit-uncertain failure retains C1/fingerprint and records one marker during later explicit release/close. Begin/body and acknowledged-commit-close failure never create a commit marker. |
| S5 cleanup log proceeds old-close then fence/repository/lease/Storage | For retained uncertainty only, insert validated preparation and acknowledged marker transaction between old-close and fence. Completed journal stage is not repeated. All healthy release and sequence/busy/barrier behavior stays fixed. |
| S3/S5 cleanly released predecessor always selects clean handoff | Released predecessor with unresolved commit marker resolves that same row and selects recovery; unmarked clean case remains clean. |
| S3 active predecessor always inserts an abandoned recovery row | An existing commit marker is resolved in place, never duplicated/reclassified. Without marker, retain the exact generic abandoned-active-fence/generation-superseded/null-command oracle. |
| S5 tests only coarse blocked outcome after commit/close errors | Preserve first generic failure and joins; additionally distinguish internal commit evidence and journal timing. Acknowledged commit plus close failure remains blocked without uncertainty record. |
| S5 lookup consumes complete submitted snapshot | Settlement wrapper still verifies requested type/version. Reusable checked core needs only CommandId/fingerprint, with prior G/last sequence bounds for recovery. Pre/post Green for ordinary ledger behavior; no fabricated raw payload. |
| S5 fingerprint computed inside settlement body | Same S5 snapshot/hash owner now computes it once in repository before the classified runner and passes the identical value to settlement. No new marker ID/time; already-blocked Writer requests do no hash work. |
| Projected SQL/transaction test doubles omit the new recovery SELECT or comparison arguments | Supply required real row/decorator responses and conditional fence arguments. Missing fixture support is setup, not Red; never relax schema, return canned receipts, or make recovery methods optional. |

- **TDD-exempt**: extracting checked lookup, sharing unchanged authority/sequence validation, moving abandoned-record insertion to its owning module, and reusing the legacy engine are refactors. Before/after Green pin exact public output/error identities and SQL meaning. The new phase distinctions, marker boundary, direct uncertain-repository denial, conditional activation resolution, and stronger fence replacement each have real behavior Red above. All recovery-record IDs use existing domain predicate plus lowercase validation; no kernel/protocol additions are required.
- **TDD-exempt**: unchanged Writer/coordinator/application/runtime/bootstrap/Storage wiring and fixture support are regression dependencies, not new behavior or optional bypasses. No test source is authored in this design.

#### Automated Verification:

- [ ] Establish implemented approved Slice 5 baseline and its mandatory pinned-driver SAVEPOINT/connection Green preflight first; missing foundation is never S6 Expected Red. The S5 runtime warning remains mandatory and unexecuted here.
- [ ] Record pre/post Green legacy/helper/lookup/authority characterizations, then actual behavior Red/Green and separate review/refactor for each new S6 vertical behavior. No setup/import error or unexecuted assertion counts as Red.
- [ ] Focused classifier and repository unit checks pass: `pnpm exec vitest run apps/harness/src/storage/project-storage-transaction.test.ts apps/harness/src/storage/canonical-command-repository.test.ts apps/harness/src/canonical-project-writer.test.ts`.
- [ ] Exact legacy Storage helper and real worker-client regressions pass unchanged: `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/local-libsql-worker-client.test.ts`.
- [ ] Real worker driver/settlement/recovery tests pass: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-command-driver.integration.test.ts apps/harness/tests/integration/canonical-command-repository.integration.test.ts apps/harness/tests/integration/canonical-writer-recovery.integration.test.ts`.
- [ ] Affected real transport/lifecycle and unchanged bootstrap regression pass: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-project-settlement.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/canonical-project-switch.integration.test.ts apps/harness/tests/integration/process-bootstrap.integration.test.ts`.
- [ ] Harness type checking passes, including the newly required internal fingerprint argument and typed SQL decorators: `pnpm --filter @slopstop/harness typecheck`.
- [ ] Architecture model validation passes: `pnpm check:architecture`.
- [ ] Source package/import boundary validation passes: `pnpm check:boundaries`.

These are future focused gates, all unchecked. Use one named behavior/file for each Red/Green step rather than rerunning all commands in each loop. Kernel/protocol/Desktop types and package surfaces do not change, so no additional typecheck there is prescribed solely for S6. Full/deep/build/package/mutation/native-crash checks remain S7 or separately authorized risk-based work. No shell, test, build, installation, or command listed here was run in this design turn.

#### Manual Verification:

- [ ] Independently review the five production file blocks as one merged projection, one heading/fence per file, no duplicate definitions, no new test-source Architecture/File Map entries, and no circular import or raw protocol error.
- [ ] Verify exact legacy error identities, message spelling, cause ordering, rollback/close attempts, and unchanged three live Storage helper callers; ensure body failures cannot enter the commit catch scope.
- [ ] Observe both real settlement COMMIT variants: first generic correlated failure, zero automatic journal/metadata/retry, direct uncertain-repository denial, exact join, and all later Writer requests unavailable with no new work.
- [ ] Observe old-close acknowledgement before marker preparation/SQL; marker real-COMMIT/ack-loss plus explicit retry must recognize the same row while retaining the native lease. No timer or closed flag alone earns release.
- [ ] Observe preparation invalid/throw, marker body/rollback/close failures, malformed existing row, and stale token; confirm exact existing failure boundaries and no second record identity or hidden retry.
- [ ] Verify current/unresolved/future row selection, every joined generation/receipt binding, prior-G/last-sequence lookup waterline, and receipt-found/absent distinction for original, rejection, unchanged, conflict, and old-generation replay.
- [ ] Observe active marked and released marked predecessor reconciliation in one transaction, G+1 inserted before resolver FK, conditional rowcounts1, unchanged released timestamps, no duplicate abandoned row, and independent-reader rollback after each known body fault.
- [ ] Confirm activation has zero handler/registry/domain/sequence/receipt/event work; explicit retry remains a separate user request and never rewrites historical absence. A-to-B must not resolve A in B; startup remains inactive.
- [ ] Review exact MessagePort envelope/UUID/time/sequence/causation and DB comparisons, production empty-registry composition, and qualified nondeterministic metadata. No private digest/source/payload/token/path/cause appears on wire.
- [ ] Compare historical Slices 1-5 Files/Test Contracts/criteria/history and S7 skeletons against the pre-edit artifact during independent verification. S6 migration assertions are explicit; no baseline bytewise certification is claimed in this turn.
- [ ] Keep abrupt pre-marker death as the approved information gap; source fixtures are not packaged termination evidence. Activation/fence-release COMMIT uncertainty remains existing fail-closed behavior with no universal automatic repair or forced lease release.
- [ ] Retain S5's mandatory unexecuted SAVEPOINT/connection research warning, independent S6 review, and separate developer code approval before any implementation. All execution gates remain unchecked.

### Slice 7: Packaged Cross-Process Proof

**Files**: `packages/protocol/src/canonical-writer-smoke-protocol.ts` (NEW), `packages/protocol/src/index.ts` (MODIFY), `packages/protocol/src/canonical-writer-smoke-protocol.test.ts` (NEW test), `apps/desktop/src/main/project-storage-package-smoke.ts` (MODIFY), `apps/desktop/src/main/project-storage-package-smoke.test.ts` (MODIFY test), `apps/desktop/src/main/package-smoke-authorization.test.ts` (MODIFY characterization/test), `apps/desktop/src/main/package-smoke-verifier.ts` (MODIFY), `apps/desktop/src/main/package-smoke-verifier.test.ts` (MODIFY test), `apps/desktop/src/main/canonical-writer-package-smoke.ts` (NEW), `apps/desktop/src/main/canonical-writer-package-smoke.test.ts` (NEW test), `apps/desktop/src/main/main.ts` (MODIFY), `apps/desktop/forge.config.ts` (MODIFY), `apps/desktop/vite.harness.config.ts` (MODIFY), `apps/desktop/tests/e2e/package-smoke.mjs` (MODIFY executable proof tooling), `apps/desktop/src/main/package-smoke-launcher.test.ts` (NEW test of executable proof tooling), `apps/harness/tests/integration/canonical-writer-package-smoke-entry.ts` (NEW test fixture), `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts` (NEW test).

**Dependencies and limits**: final projected Slices 1-6, including native staging, source-qualified switching, strict settlement, and S6 recovery. No production registry entry, coordinator/repository/Writer change, schema migration, renderer/preload capability, supervisor kill method, default harness entry replacement, or security-fuse change. A distinct inert `writer-proof-fixture.cjs` is packaged alongside `harness.cjs`, but only the already-authorized private smoke branch launches it. This is not a claim that test bytes are absent from the packaged archive. Its source is a test fixture authored by implement from this Test Contract, not prewritten test source in Architecture. The existing `package-smoke.mjs` remains the already-decomposed executable proof-tooling Architecture target.

**Public seams**: scenario parsing/authorization and `runCanonicalWriterPackageSmoke` through scripted Electron process/MessagePort ports for focused negative cases; real `harness.cjs` and the separate fixture over real Electron utility-process ports for actual Windows/Linux proof; the executable `package-smoke.mjs` for external pass/cleanup gates. Never test private `OwnedUtility` fields or methods. Scripted peers test the runner's discrimination, correlation, deadlines, and ownership only; they cannot prove SQLite atomicity, real native loading, crash release, or durable stale fencing. The fixture uses the real approved harness factories and worker-backed libSQL adapter, not receipt mocks or patched private Writer fields.

#### Test Contract:

##### Fixed Inputs And Nondeterminism

- `P = 00000000-0000-4000-8000-000000000101`; `Q = 00000000-0000-4000-8000-000000000104`; Q create request `00000000-0000-4000-8000-000000000114`.
- `I = 00000000-0000-4000-8000-000000000121` is only the pre-activation probe epoch. `C1 = 00000000-0000-4000-8000-000000000131`, `C2 = 00000000-0000-4000-8000-000000000132`, `C3 = 00000000-0000-4000-8000-000000000133`. All commands use type `conformance.writer.noop`, version `1`, payload `{}`.
- Scripted observations use `A1 = 00000000-0000-4000-8000-000000000141`, `A2 = 00000000-0000-4000-8000-000000000142`, `AQ1 = 00000000-0000-4000-8000-000000000143`, `AQ2 = 00000000-0000-4000-8000-000000000144`, and contention epoch `AC = 00000000-0000-4000-8000-000000000145`.
- `R1 = 00000000-0000-4000-8000-000000000151`, `R2 = 00000000-0000-4000-8000-000000000152`; `T1 = 2026-09-05T12:00:01.000Z`, `T2 = 2026-09-05T12:00:02.000Z`. Receipt 1 is exactly `{receiptId:R1,projectId:P,commandId:C1,commandType:"conformance.writer.noop",commandVersion:1,projectSequence:1,writerGeneration:1,settledAt:T1,outcome:"rejected",events:[],rejection:{code:"COMMAND_TYPE_UNSUPPORTED",retryable:false}}`. Receipt 2 changes only receiptId to R2, commandId to C2, both sequence/generation to `2`, and settledAt to T2.
- Fixture correlation uses `proofId = 00000000-0000-4000-8000-000000000161` and fresh request IDs `00000000-0000-4000-8000-000000000171` through `00000000-0000-4000-8000-000000000174`. A separate audit process uses proof `00000000-0000-4000-8000-000000000162` and request `00000000-0000-4000-8000-000000000175`.
- Production UUIDs, times, physical temporary roots, and PIDs are genuinely nondeterministic. Capture each once from its validated public result or actual process spawn, then assert exact equality and all documented cross-row bindings wherever reused; assert the specified UUID/UTC schemas and unequal epochs/receipt identities. Do not replace exact sequence, outcome, row, byte, count, or correlation oracles with shape-only matches. Scripted peer tests fix the values above. Real process tests do not replace native/random dependencies with mocks merely to force these example values.

##### S7.1 Authorized Scenario And Private Composition

**Behavior**: Writer proof is admitted only through the existing packaged/non-prototype, token-and-marker-authorized smoke boundary and never enters ordinary renderer/Storage smoke dispatch.

**Test**: `admits writer proof only through authorized private package composition` -> `apps/desktop/src/main/project-storage-package-smoke.test.ts`, `apps/desktop/src/main/package-smoke-authorization.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: parser accepts exactly `bootstrap`, `writer-proof`, `missing-runtime`, `witnessed-staging`; `undefined`, empty, whitespace-padded, wrong-case, and unknown strings reject. Valid existing root plus the exact existing `{version:1,token}` marker yields `{root,scenario:"writer-proof"}` and one `setUserDataRoot(root)` after validation. Invalid/missing/relative root, symlink root/marker, nonregular marker, malformed JSON, missing/wrong/malformed token, extra marker fields, and wrong marker version yield only `PackageSmokeAuthorizationError("Package smoke authorization failed.")`, zero userData setter calls, no new Storage or proof child. Retain the complete existing executable authorization matrix and add writer-proof variants. `runProjectStoragePackageSmoke({bridge,scenario:"writer-proof"})` rejects exactly `Writer proof requires the private process owner.` and performs no ordinary Storage request. Real packaged writer-proof starts only after authorization and app readiness, before normal supervisor, BrowserWindow, log/Sentry initialization, security/session registration, and renderer IPC. Ordinary runs retain the exact six preload methods, strict sandbox/security settings, ordinary supervisor, and unavailable Workspace result; a non-packaged or prototype invocation cannot enter private proof.

**Expected red**: the S6 parser rejects `writer-proof`, and the packaged program lacks the private scenario and its completion witnesses. Invalid authorization and ordinary renderer isolation are retained Green characterization, not fabricated Red.

##### S7.2 Separate Strict Fixture Transport

**Behavior**: Smoke start, controls, and results form a closed independently versioned boundary, not new product commands or a loosely typed test escape hatch.

**Test**: `parses only exact Writer proof envelopes and fixture metadata` -> `packages/protocol/src/canonical-writer-smoke-protocol.test.ts`.

**Oracle**: exact start `{version:1,kind:"writer-proof.connect",proofId,bootstrap}` with valid existing HarnessBootstrap roots round-trips unchanged. Stale controls are exactly initialize/1, release/2, attempt/3 with AQ2/generation2, finish/4; audit/1 carries `[A1,A2]` and the exact R1/R2 receipts. Each result has the same proofId/requestId/step/stepNumber and precisely the corresponding Architecture-defined fields. Initialize returns Q/AQ1/generation1 plus exact native package `fs-native-extensions`, version `1.5.1`, executing target, `unpackedTargetBinding:true`, `fallbackLoaded:false`. Release returns only correlation plus `testLeaseReleased:true,oldWriterRetained:true`. Attempt returns Q/AQ1/C3/AQ2/generation2, `status:"stale-writer",code:"WRITER_FENCE_STALE",retryable:false,allCanonicalRowsUnchanged:true`, all four work counts `0`, `writerClose:"stale-refused",operationalReleaseAuthorized:false`. Finish returns `teardown:"test-resources-only"`. Audit returns P, `audit:"exact-ledger-and-abandoned-recovery"`, sequence/generation `2`, receipt/rejection/idempotency/generation/handoff counts `2`, events `0`, abandoned recovery `1`, uncertain recovery `0`, `fence:"released"`, and exact native metadata. Wrong kind/version/step number, absent/extra fields, NIL/MAX/malformed message identity per existing MessageIdSchema, malformed or uppercase Project/activation/Command identity, generation other than2, reordered receipts, repeated receipt IDs/epochs, wrong Project/command/type/version/outcome/sequence/original generation, native version/target mismatch, `fallbackLoaded:true`, `unpackedTargetBinding:false`, nonzero no-work counts, weakened teardown labels, or path/token/fingerprint/cause/SQL/raw-row fields reject. Do not demand lowercase MessageId if the existing nondurable MessageIdSchema does not. Product Desktop/Harness message unions continue to reject these fixture-only message kinds.

**Expected red**: the new closed smoke boundary is absent before S7. The first executable feature Red is the existing parser/packaged-run seam in S7.1; import, type, missing-file, or absent-native setup errors are not substitutes for that behavioral Red. Add schema negatives before their validation implementation, then prove each rejects the actual contradictory value.

##### S7.3 Native Origin, Not Directory Presence

**Behavior**: A packaged run proves the exact pinned executing-target native binary exists unpacked and actually supplies the API, without accepting resolver fallback.

**Test**: `requires the exact unpacked Writer native load` -> `apps/desktop/src/main/package-smoke-verifier.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`, `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`.

**Oracle**: verify actual `resources/app.asar.unpacked/.vite/build/node_modules/fs-native-extensions/prebuilds/<target>/fs-native-extensions.node` is a nonempty nonsymlink regular file, resolves to its canonical physical path, and has the executing target's exact published v1.5.1 SHA-256 from the Architecture preflight. Virtual package name/version are exactly `fs-native-extensions`/`1.5.1`; JS entry resolves to that package's `index.js`; exactly one successful native load is delegated from its exact ASAR virtual or corresponding unpacked binary spelling; both tryLock and unlock are functions. The fixture independently observes the same origin before dynamically importing native-dependent production modules. Missing/empty/other-target/renamed/symlink/corrupted/rebuilt binding, wrong version/name, alternate JS entry, zero cached-load observations, wrong native path, and missing API fail as `WriterProofError` with stage `native-preflight`, generic message and no private cause. Restore the dlopen observer on both success and exception. A resolver that catches a rejected bad candidate and loads the legitimate pinned candidate is not a successful fallback load; the bad native file must never be delegated. Mutate only disposable packaged copies, never installed dependencies or the sole package output. Require real Windows and Linux execution; directory scans or unit mocks do not satisfy native compatibility.

**Expected red**: S6 external package preflight inspects libSQL bindings only and has no native-loader witness. S3 source/native staging proof remains separate mandatory evidence, not newly claimed Red or package proof.

##### S7.4 Ownership And Exact Request Correlation

**Behavior**: Each independently spawned harness/fixture is owned before any subsequent setup can fail, and only its exact pending result advances the proof.

**Test**: `owns every proof child and rejects contradictory transport results` -> `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`, `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`.

**Oracle**: execute the exported runner through scripted Electron/public MessagePort peers, not its private class. Every forked child is retained through observed exit and stream EOF. For production ports, each handshake/command response has protocol4, the exact expected event and request causation, and prior sequence+1 starting at1; use distinct process sequence counters. Wrong causation, event, sequence, protocol, payload/request Project/epoch/Command correlation, request.failure/system.failure, unsolicited/duplicate/late result, direct parent-channel message, disconnect/protocol error, thrown or false send, and port setup/transfer/start failure produce failed, never passed. No later proof process or request starts after the failure. Immediate reply during public send and deferred reply both work; a second reply cannot resolve another request. Fixture controls additionally preserve proofId/requestId/step/number; cross-proof, wrong-step, duplicate reply, changed old/new activation, or native-target mismatch fail. Observe exact correlated events before clearing the wait, remove only that request's receiver in finally, retain process-level listeners until terminal cleanup. A failure in a different already-owned process also fails the overall proof rather than disappearing behind a healthy pending peer.

**Expected red**: S6 has no private process owner, smoke exchange correlation, or fixture-control runner. The first feature Red remains S7.1; as each runner behavior is introduced, its public scripted-peer cases fail for the missing outcome before that behavior is implemented. Missing imported fixtures do not count as transport-failure proof.

##### S7.5 Real Contention And Durable First Settlement

**Behavior**: One production packaged harness obtains authority and settles once; a simultaneous independent production harness activates read-only and cannot settle.

**Test**: `proves packaged production Writer contention without a registered test command` -> `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: start from original bootstrap's healthy generation2 P with sequence0/generation0, unchanged Storage identity. Holder probe `(P,I,C1)` returns exactly `inactive/PROJECT_INACTIVE/retryable:false`, message `No Project is active for Typed commands.` and exact P/I/C1 correlation. Activation returns read-write/P/A1/generation1. C1 returns a settled result whose receipt is exactly R1 from the fixed-input definition, using independently captured real R1/A1/T1. While holder remains alive, contender has a distinct non-main PID and returns active/read-only/P/AC, generation null, exact `WRITER_UNAVAILABLE` diagnostic message `Another SlopStop process holds Project write authority.`, retryable true. Its C1 result is exactly read-only/P/AC/C1 with `WRITER_UNAVAILABLE`, message `The active Project has no write authority.`, retryable true, no receipt. Contender closes its port, exits0 and drains before holder termination. Later independent audit proves only the one original settlement occurred before takeover. Production bootstrap still uses the empty registry; no fixture handler is inserted to make C1 succeed as applied.

**Expected red**: the S6 package smoke neither activates a Writer nor starts a simultaneous contender; the new required writer-proof completion event/line is absent. Run actual package proof with these new expectations before accepting S7's implementation Green.

##### S7.6 Actual Holder Crash And Bounded Explicit Takeover

**Behavior**: The proof force-terminates the actual native holder without first releasing its resources, and grants takeover only after observed termination and real acquisition.

**Test**: `kills the actual packaged Writer and proves bounded takeover` -> `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: after contender terminates, issue exactly `process.kill(recordedHolderPid,"SIGKILL")` while child.pid still matches the recorded spawned PID, holder is not terminal, and PID differs from main. No holder port close, coordinator stop, Writer close, unlock, fence release, or graceful UtilityProcess.kill precedes the crash. Require actual utility exit with nonzero exit code and independently stream EOF; kill return alone or main close alone is insufficient. Replacement is another real process, starts inactive, and only then receives explicit activation. The takeover window is at most15000ms from observed holder exit, includes holder stream drain, replacement spawn/handshake, inactive probe, and acquisition. Only valid read-only contention permits another explicit same-Project switch using the just-returned source epoch after100ms; broken/unavailable/safe-mode/stale source/malformed result are immediate proof failures, never retried. Success is exactly P/new A2/read-write/generation2 with A2 != A1. Timeout, absent/changed/self PID, kill throw, exit0, or no exit fail and never manufacture acquired authority. The budget is a test limit, not a promised OS release SLA or a new production retry policy.

**Expected red**: the old runner kills only its outer Electron main on timeout and has no actual-holder crash/takeover proof. Detailed pure OS latency remains measured at implementation on each target, not inferred from docs.

##### S7.7 Restart And Retry Preserve Original Receipt

**Behavior**: Explicit reactivation reconciles exact retry through durable authority and rejects old activation while keeping process event order separate from Project sequence.

**Test**: `replays the original receipt after packaged crash and rejects the old epoch` -> `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: replacement pre-activation `(P,A1,C1)` is inactive, not automatic restoration. Under A2/generation2, identical C1 returns the entire original R1 receipt byte/value-equivalently including its generation1/time/identity; no new sequence or event is allocated. Submitting `(P,A1,C1)` after A2 activates gives exactly stale-activation/P/A1/C1 with `PROJECT_ACTIVATION_STALE`, `The command activation is stale.`, retryable false, no receipt. C2 under A2 yields the exact R2 metadata at sequence2/generation2, different receipt ID, unsupported/nonretryable rejection, events[]. Clean replacement shutdown precedes audit. Distinct runtime transport sequences do not imply more than two durable settlements. Old-epoch denial is explicitly not the separate stale-Writer fence proof.

**Expected red**: S6 has no packaged restart/replay/old-epoch sequence. These product behaviors are already proved by source tests; the S7 new failing requirement is their execution through the packaged process composition, not a manufactured regression in already-correct source behavior.

##### S7.8 Independent Durable Audit

**Behavior**: A separate read-only harness fixture proves exact committed ledger/recovery authority after the production crash scenario without allocating another Writer or inventing lost-command attribution.

**Test**: `audits exact packaged receipts and generic abandoned recovery` -> `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: fixture audit opens existing P through real Storage authority and its own worker-backed SQLite read connection, never calls activate/settle/registry. Require project_state last sequence2/last generation2, one original storage_identity, schema_metadata canonical/schema2/migration0001. Exactly two receipts match captured R1/R2 with independently recomputed canonical fingerprints for fixed P/C1/C2/type/version/payload, two unchanged original idempotency pointers, two nonretryable COMMAND_TYPE_UNSUPPORTED rejection rows with canonical safe `{version:1}` details/hash, and zero events. Exactly two Writer generations bind A1/A2 to generation1/2 and coherent private digests/UTC times. Handoffs are initial null->1 and recovery1->2. Exactly one recovery row has reason abandoned-active-fence, generation1, null commandId/fingerprint, resolution generation-superseded, resolvedByGeneration2, and observed/resolved times exactly generation2 acquired_at. Generation1 released_at equals generation2 acquired_at; generation2 and fence are released with the same terminal release instant; fence retains its exact generation2 digest/acquisition binding. No uncertain-commit marker or receipt-found/receipt-absent conclusion is invented. Verify all known canonical tables, exact columns/relational children/hashes and no extras/orphans, foreign-key check[], integrity check ok; compare row snapshots before/after audit to prove zero mutation. Corrupt any claimed row binding/count/hash/time/identity/recovery field and the fixture exits nonzero without an audit-success result. A count-only hardcoded result is not an implementation of this fixture contract.

**Expected red**: no packaged independent audit fixture exists. Implement authors the fixture as test code before the runner relies on its result, first proves seeded correct/corrupt audit cases through the fixture's public protocol, and records actual corruption failures; no test passes by merely echoing supplied receipt objects.

##### S7.9 Live Stale Writer With Real Replacement

**Behavior**: A still-living old Writer cannot mutate canonical state after a different packaged process acquires a newer durable fence, even when a test deliberately releases the old native lease.

**Test**: `rejects a live stale packaged Writer before any settlement work` -> `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: fixture alone creates Q with create request114 through real Storage owner, obtains real activation session/native lease/repository generation1, constructs the real Writer at AQ1 and retains exact repository/lease/Storage handles separately for test teardown. Only test registry defines strict-empty `conformance.writer.noop` returning unchanged; record counters at the public registry/handler/ID/time dependency seams, reset after activation, and use C3 for the later attempt. No extra domain table or production registration. `stale.initialize/1` is acknowledged only after real native load and generation1 acquisition. `stale.release/2` directly releases the real test-owned native lease, retains the Writer/repository and active durable generation1 unchanged, and acknowledges only after unlock AND close. Separate production harness activates Q at AQ2/generation2 while fixture PID remains alive. Under `stale.attempt/3`, independent read first verifies coherent real Q/AQ2/generation2 active authority; snapshot all canonical tables, then call the retained old Writer.settle(C3) directly, not coordinator stale-epoch rejection and not a mocked fence. Await actual settlement result exactly Q/AQ1/C3 with stale-writer/WRITER_FENCE_STALE, message `The active Writer fence is stale.`, retryable false. All canonical rows, Project sequence0, receipts/rejections/idempotency/events0 remain identical; registry/handler/receipt-or-event-ID/settlement-clock counts remain0. Both fixture and replacement processes remain alive until result. Calling old Writer.close with a valid fixed UTC release instant rejects WRITER_FENCE_STALE, performs no successful fence retirement, and leaves replacement authority unchanged; include this check in the before/after row comparison. Only then emit exact attempt evidence. This is a deliberately non-cooperative TEST intervention, not a new product release mode, defect simulation claim about actual users, or dead-process write attempt.

**Expected red**: no S6 packaged process can retain and drive a stale Writer through the independent test fixture. Existing source stale-fence tests stay valid and are rerun without fabricated Red; S7's packaged case must be absent/failing until the fixture and private runner are wired. A deliberately disabled fence may be used only as an explicit test-of-proof negative control, never as chronological product Red evidence.

##### S7.10 Fixture Temporal Validation And Teardown

**Behavior**: Fixture success requires exact ordered controls and proven test-owned teardown; abrupt or invalid control cannot masquerade as completed proof.

**Test**: `rejects invalid fixture transitions and waits for exact teardown` -> `apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`.

**Oracle**: accept exactly one start with one transferred port and validated nonoverlapping trusted local bootstrap roots. No port, extra port, invalid start, repeated start, unknown control, release before initialize, attempt before release, finish before attempt, duplicate step/request, changed proofId, wrong mode, repeated audit, or control after final step emits success; exit nonzero with fixed safe diagnostic, after best-effort owned cleanup. Queue serial controls: do not process a second step while its predecessor is still pending; reject pipelined/out-of-order input rather than retaining a hidden backlog. In the successful stale path, finish closes only the direct repository and already-released test lease/retained Storage owner, leaving generation2 owned by the separate process; it never retries old Writer.close as if stale authority permits release. Emit stale.finish only after exact direct cleanup succeeds. In audit mode, emit audit success only after all reads and owned clients/Storage close. Keep the result port open until parent closes it, then exit0 only following the completed final step and cleanup. Early parent close at every preceding held stage, SQL/lease/client/Storage failure, invalid result construction, or private exception containing root/token/payload text cannot send a success event or clean exit. Test teardown failures are still failures; do not convert them into operational release success. S7 test code may close its deliberately retained direct resources but may not modify locked production ownership behavior.

**Expected red**: no fixture temporal/teardown owner exists. Write protocol-driving fixture tests before its implementation; hold public native/SQL/resource completions, not private fields, for the controlled negative cases. Real package runs remain required for actual handles.

##### S7.11 Deadlines, Output, Abort And Cleanup

**Behavior**: Bounded proof failure closes further admission while retaining every possibly living child and never reports a late cleanup as successful proof.

**Test**: `bounds proof work and preserves unconfirmed child ownership` -> `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`.

**Oracle**: fix monotonic time and public scripted peers. Limits are proof90000ms, step/spawn10000ms, takeover15000ms, explicit retry spacing100ms, clean stop5000ms, failure cleanup10000ms, stream EOF3000ms, output65536 bytes per stream. At each deadline, just-before completion may pass that wait, at/after deadline fails; timers alone with no matching event never pass. Exactly65536 UTF-8 bytes in a stream are accepted,65537 fails output-bound; binary byte counts and multibyte text count bytes, not characters, with no raw output forwarded. A null stream, stream error, or missing EOF is not a clean drain. A successful send followed by no response fails within its step; delayed callbacks after failure cannot send another command or start another process. Abort before entry, during spawn/response/retry delay/clean stop produces failed, never passed, and cleanup ignores abort only to observe/terminate retained children. Every nonterminal spawned child gets an actual-PID hard-kill attempt during failed cleanup, with no self/stale PID reuse. An unspawned returned process handle is retained until spawn or exit; a throwing fork with no returned handle cannot create a fictional owned process. Successful terminal cleanup after any primary failure yields failed/cleanupSafe:true; missing any utility exit or stream EOF yields failed/cleanupSafe:false. Preserve the first primary proof failure while retaining secondary cleanup diagnostics internally. Held cleanup of one child cannot prevent attempting cleanup of others. Unconfirmed children keep listeners; do not detach errors or forget identity to make an empty set pass.

**Expected red**: no S6 runner enforces these Writer-proof-specific bounds and ownership states. Scripted observations provide deterministic negative proof; the real Windows/Linux executable separately establishes that the selected limits are achievable, without changing them silently on failure.

**Secondary cleanup oracle**: the failed runner outcome additionally contains frozen `cleanupFailures` with at most24 frozen entries, each only `{processIndex,stage}`; stage is `cleanup` or `stdio-drain`, and the six-process run assigns indexes in creation order without exporting PIDs or paths. With process0's primary transport failure, a throwing cleanup kill, later observed nonzero exit within the cleanup deadline, and missing stdout EOF, return exactly `{status:"failed",stage:"transport",cleanupSafe:false,cleanupFailures:[{processIndex:0,stage:"cleanup"},{processIndex:0,stage:"stdio-drain"}]}`. A failed proof with fully successful cleanup has an empty array and cleanupSafe true. Multiple children clean concurrently, so cross-process entry arrival order is nondeterministic; compare each process's exact ordered metadata and total multiset without claiming a scheduler order. Record every actual caught cleanup failure within the structural six-process/four-catch bound; the cap must not hide extra process creation. This metadata remains local to the returned runner result; main emits only the fixed primary-stage/terminal lines.

##### S7.12 Main Quit And Terminal Reporting

**Behavior**: Private proof owns quit cleanup and emits fixed separate terminal/pass evidence, never a clean app exit while private children may still be alive.

**Test**: `keeps private Writer proof ownership through quit and failure reporting` -> `apps/desktop/src/main/canonical-writer-package-smoke.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: while private proof runs, before-quit is prevented and aborts its admission; ordinary desktopShutdown cannot claim its children are absent. window-all-closed does not complete private proof. Successful runner emits exactly `Package smoke writer processes terminal.\nPackage smoke writer proof passed.\n`, flushes fixed stderr lines before app.exit(0), and exposes no stdout, token, bootstrap URL, full path, cause, SQL, native-path string, or captured child text. Known failure with all children terminal emits terminal line plus exactly one fixed stage failure and exits1, no pass line. Unconfirmed cleanup emits `Package smoke writer process exit unconfirmed.\n` plus fixed failure and exits1; reporting/startup exception follows unconfirmed fallback, not ordinary successful shutdown. Truncated/failed report writes cannot produce the pass/terminal pair externally. Ordinary non-private quit and successful old smoke scenarios retain their existing shutdown behavior.

**Expected red**: main has no private-owned quit branch or Writer terminal/pass evidence before S7. Existing ordinary quit behavior is characterization, not a fake new behavior Red.

##### S7.13 External Runner Cannot Manufacture Pass Or Cleanup

**Behavior**: The executable launcher separately validates proof completion and safe filesystem cleanup, including early-zero exit and potentially orphaned utilities.

**Test**: `requires exact Writer proof completion before cleanup` -> `apps/desktop/src/main/package-smoke-launcher.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: exercise the executable entry with scripted process and filesystem adapters through its imported platform ports, never call unexported helper functions. Exactly one complete pass line plus one complete terminal line, exit0, closed outer process, no timeout/error/overflow/private-output/stdout is the Writer success case. Missing/truncated/duplicate lines, pass-only, unconfirmed+terminal, failure+pass, exit0 before proof, nonzero exit, spawn failure, or output overflow fail. Terminal-only with a valid closed nonzero failure may authorize cleanup, never pass. Missing/unconfirmed terminal evidence sets cleanupSafe false; no root removal or isolated-package restore/removal follows. Outer writer launch is120000ms with5000ms terminal fallback; ordinary duration remains30000ms. Timeout revokes cleanup immediately even if main later closes, because its utility descendants may survive. Best-effort main SIGKILL is not process-tree proof. Missing close resolves only as failed/unclosed at the terminal limit with cleanup withheld. Subsequent success cannot restore revoked cleanup authority. Safe fixed failure/preservation messages contain no temporary root or token. Keep original authorization and old-scenario failures nonzero.

**Expected red**: the existing external runner accepts only old scenarios, has no required Writer witness, and can treat main close after timeout as cleanup permission. Add executable-level failure cases before changing those branches.

##### S7.14 Package Isolation, Resources And Storage Witness

**Behavior**: Full package proof runs without workspace dependency fallback, stages both entries exactly once, and preserves the original Storage generation while recognizing only the approved lock companion.

**Test**: `runs isolated Writer proof without replacing Storage or relaxing resource checks` -> `apps/desktop/src/main/package-smoke-launcher.test.ts`, `apps/desktop/tests/e2e/package-smoke.mjs`.

**Oracle**: one harness build emits distinct harness.cjs and writer-proof-fixture.cjs plus required shared chunks and one exact dependency closure; both Forge and Vite name the same inputs, no entry overwrites the other, no competing staging pass deletes output. Default harness graph has no fixture entry execution or handler registration. Packaged files retain ASAR integrity, restrictive fuses, migrations and existing libSQL targets. Preserve the existing same-volume rename-based package isolation outside the workspace directory, including Linux chrome-sandbox ownership/mode set by CI; do not replace it with a copying path that drops root ownership. Launch only from the isolated location with NODE_PATH/NODE_OPTIONS removed. With safe completed proof, restore the exact original package by rename and remove its temporary container; after unconfirmed child exit perform neither restore nor removal. Original bootstrap -> Writer proof -> missing-runtime -> witnessed-staging remain sequential on one authorized root; save generationRoot before Writer proof and require it identical after. P root has exactly its one generation directory and one plain `.slopstop-writer.lock`; no other extra entry, symlink/directory companion, changed manifest identity, or second generation is accepted. Companion remains outside generation manifest/checksum members. Only after all Writer processes and outer app terminate may the runner remove mastra.db for the existing missing-runtime oracle or perform witness mutations. The final stdout summary is exactly `Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.\n` only if every retained scenario passes.

**Expected red**: existing package layout emits only harness.cjs, native preflight lacks Writer origin proof, one-generation inspection rejects the approved lock companion, and executable smoke has no Writer stage. S3 dependency/staging implementation already exists in the projected baseline; preserve and characterize it rather than redoing it as an invented S7 Red.

- **TDD-exempt**: additive protocol exports and the Forge/Vite multi-entry build declarations are wiring, verified by typechecking, explicit built import-graph inspection and real package execution; no unit mock of a bundler substitutes for those gates.
- **TDD-exempt**: the separate fixture is test infrastructure, authored by implement from S7.8-S7.10 at test time. Its intentionally broken lease-lifetime simulation is not product behavior and must never be imported by production process-bootstrap or presented as production Red evidence.
- **TDD-exempt**: preserving Slices1-6 source behaviors, old authorization, ordinary renderer isolation, original Storage scenarios, and prior native-staging contracts requires characterization and regression proof, not fabricated failures. Existing runtime/driver gates remain mandatory.
- **TDD-exempt**: the ordinary smoke module imports the shared protocol-owned Project101 value under its existing local name. First prove its prior bootstrap create/open identity is exactly `00000000-0000-4000-8000-000000000101` with a passing characterization, then rerun unchanged after the move; this creates one collaborating runtime identity owner, not a new Project behavior. Independent black-box test literals remain separate expected values.

#### Automated Verification:

- [ ] First observe the existing public scenario/packaged-run failure before implementing S7 dispatch. Record focused Red -> minimal Green -> a separate review/refactor gate for each behavior change; no missing fixture/native dependency/type-error setup failure is counted as behavioral Red. Retained prior behavior has explicitly separate Green characterization.
- [ ] Focused protocol, authorization, native-preflight, runner, and executable-tool tests pass: `pnpm exec vitest run packages/protocol/src/canonical-writer-smoke-protocol.test.ts apps/desktop/src/main/project-storage-package-smoke.test.ts apps/desktop/src/main/package-smoke-authorization.test.ts apps/desktop/src/main/package-smoke-verifier.test.ts apps/desktop/src/main/canonical-writer-package-smoke.test.ts apps/desktop/src/main/package-smoke-launcher.test.ts`. The executable-tool test lives under the existing desktop-main Vitest include, not Playwright's tests/e2e discovery directory; prove it actually ran, not merely that the multi-file command exited0.
- [ ] Fixture control, exact independent audit, stale-Writer/no-work, and resource-failure integration cases pass: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-package-smoke.integration.test.ts`
- [ ] Protocol typecheck passes: `pnpm --filter @slopstop/protocol typecheck`
- [ ] Harness and newly authored fixture typecheck pass: `pnpm --filter @slopstop/harness typecheck`
- [ ] Desktop/main/Forge/Vite typecheck passes: `pnpm --filter @slopstop/desktop typecheck`
- [ ] Build the one multi-entry harness and inspect both entries/shared chunks/native closure: `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts`. Confirm production graph does not execute the fixture and staging occurs once; no source cross-app import or weakened fuse is introduced.
- [ ] Existing migration authority remains unchanged and current: `pnpm --filter @slopstop/harness db:generate:check`
- [ ] Source import boundaries pass: `pnpm check:boundaries`
- [ ] Architecture model passes separately: `pnpm check:architecture`
- [ ] Terminal fast gate passes: `pnpm check`
- [ ] Real packaged renderer, Storage, native-origin, production contention/crash/replay/audit, and live stale-fence proof pass on Windows x64 and Linux x64 using `pnpm package:smoke`. Record each actual OS/architecture/Electron/native version and evidence independently; Linux result is not inferred from Windows. The same mandatory proof must pass before claiming any additional target supported. No mocked/seed-only stale proof or source-only crash test satisfies this gate.
- [ ] Terminal deep gate passes against the completed build: `pnpm check:deep`. Preserve every existing unit/coverage/integration/Knip/jscpd/model/Electron-journey/package obligation; do not disable failures to accommodate the new fixture or runner.
- [ ] Rerun and retain all S5 pinned-driver SAVEPOINT/connection and S6 classified transaction/recovery/transport/boundary proof before final feature completion. Package success does not waive their warnings or turn unexecuted mandatory gates into passed evidence. Run mutation only if explicitly requested.

#### Manual Verification:

- [ ] Inspect Windows and Linux packaged outputs and recorded real process observations: actual holder and replacement PIDs differ from each other and main; force kill precedes observed exit, takeover stays within its explicit budget, old-epoch rejection and live stale-Writer rejection are separately named proofs.
- [ ] Inspect the fixture implementation and real database audit evidence: actual projected harness owners/worker SQL are used, all claimed rows/hashes/bindings are independently checked, deliberately released lease is test-only, stale Writer close remains refused, and no test handler/domain table leaks into the production registry/schema.
- [ ] Inspect the built default and fixture entry graphs plus ASAR/unpacked package: fixture is inert outside the authorized smoke path, native API loads from the exact pinned target, no fallback/workspace dependency succeeds, and normal runtime/security/renderer boundaries remain unchanged.
- [ ] Inspect failure and early-quit evidence including unconfirmed termination: no private root/token/payload/SQL/native-path/exception text is printed, no successful cleanup is claimed without terminal ownership, and preserved-root failures remain visibly failed rather than silently discarded.
- [ ] Confirm every historical Slice1-6 contract/checkpoint remains unchanged, S7 records its separate user-approved fixture decision and code checkpoint, and all package/runtime evidence remains unchecked until implementation actually executes it. This design is not implementation authorization.

## Desired End State

The harness starts inactive and activates a Project explicitly:

```ts
const activation = await canonicalProjectClient.activate({ projectId });

if (activation.status === "active" && activation.access === "read-write") {
  console.info(activation.activationId, activation.writerGeneration);
}

if (activation.status === "active" && activation.access === "read-only") {
  console.info(activation.diagnostic.code); // WRITER_UNAVAILABLE
}
```

A registered Typed command presents the activation epoch and durable Command ID:

```ts
const settlement = await canonicalProjectClient.execute({
  projectId,
  activationId: activation.activationId,
  command: {
    commandId,
    type: "conformance.counter.set",
    version: 1,
    payload: { value: 7 },
  },
});

if (settlement.status === "settled") {
  console.info(settlement.receipt.outcome, settlement.receipt.projectSequence);
}
```

An exact retry returns the same receipt, while a stale activation never enters the command-specific transaction:

The exact retry preserves receiptId, Project sequence, original Writer generation, settlement time, and event references. An old activation receives the existing non-durable `stale-activation/PROJECT_ACTIVATION_STALE` result, not a durable rejected receipt. Concrete executable oracles belong only to Slice 5's Test Contract. The conformance command above is available only when the test fixture installs its definition; production's explicit empty registry durably rejects it as unsupported.

## File Map

```text
packages/kernel/src/project-storage-identifiers.ts                 # MODIFY - canonical Project identity vocabulary
packages/kernel/src/index.ts                                       # MODIFY - kernel exports
packages/protocol/src/canonical-project-protocol.ts                 # NEW - activation, source-qualified switch, and Typed-command schemas
packages/protocol/src/canonical-writer-smoke-protocol.ts            # NEW - separate strict packaged proof transport and fixed metadata
packages/protocol/src/domain-identity-schema.ts                     # MODIFY - lowercase durable identity schema helper
packages/protocol/src/project-storage-protocol.ts                   # MODIFY - reuse lowercase identity schemas
packages/protocol/src/protocol.ts                                   # MODIFY - transport unions and failure scope
packages/protocol/src/index.ts                                      # MODIFY - protocol exports
apps/harness/src/active-project-coordinator.ts                      # NEW - active-Project state machine
apps/harness/src/canonical-project-application.ts                   # NEW - protocol/application and receipt correlation validation
apps/harness/src/canonical-project-writer.ts                        # NEW - retained Writer lifecycle and admission
apps/harness/src/canonical-json.ts                                  # NEW - S5 canonical JSON text, snapshot, and SHA-256 owner
apps/harness/src/canonical-command-registry.ts                      # NEW - S5 exact typed registration and validated handler outcomes
apps/harness/src/project-storage-application.ts                     # MODIFY - activation ownership port
apps/harness/src/storage/canonical-writer-lease.ts                  # NEW - native byte-range lease
apps/harness/src/storage/canonical-command-repository.ts            # NEW - S3/S5 owner; S6 extends settlement evidence, explicit journal, atomic activation
apps/harness/src/storage/canonical-command-ledger.ts                # NEW - S5 ledger; S6 extracts checked CommandId/fingerprint lookup core
apps/harness/src/storage/canonical-command-settlement.ts            # NEW - S5 settlement; S6 shares authority/sequence validation and admitted fingerprint
apps/harness/src/storage/canonical-writer-recovery.ts               # NEW - S6 exact recovery record validation, persistence, and reconciliation
apps/harness/src/types/fs-native-extensions.d.ts                    # NEW - strict native dependency declarations
apps/harness/src/storage/canonical-schema.ts                        # MODIFY - canonical generation-2 schema
apps/harness/src/storage/project-storage-database-specs.ts          # MODIFY - exact generation-2 verifier specification
apps/harness/src/storage/database-schema-verifier.ts                # MODIFY - exact ordered-column verification
apps/harness/src/storage/generated-migration-resources.ts           # MODIFY - S2 closed reviewed storage-identity rebuild authorization
apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql # NEW - frozen independent loader-test input, not production resources
apps/harness/drizzle/canonical/0001_canonical_project_writer.sql    # NEW - generated migration
apps/harness/drizzle/canonical/meta/_journal.json                   # MODIFY - generated migration journal
apps/harness/drizzle/canonical/meta/0001_snapshot.json              # NEW - generated schema snapshot
apps/harness/src/storage/project-storage-manifest.ts                # MODIFY - Writer companion filename
apps/harness/src/storage/project-storage-filesystem-authority.ts    # MODIFY - companion artifact classification
apps/harness/src/storage/project-storage-node-adapters.ts           # MODIFY - Project state creation and Project-root lease path
apps/harness/src/storage/project-storage-opening.ts                 # MODIFY - retryable staged database release
apps/harness/src/storage/project-storage-store.ts                   # MODIFY - coordinator session seam and failed-close retention
apps/harness/src/storage/project-storage-transaction.ts             # MODIFY - S6 classified runner with unchanged legacy wrapper/error semantics
apps/harness/src/storage/local-libsql-worker-client.ts              # MODIFY - retryable worker-client close
apps/harness/src/harness-runtime.ts                                 # MODIFY - canonical dispatch and request failure
apps/harness/src/process-bootstrap.ts                               # MODIFY - harness composition
apps/harness/src/index.ts                                           # MODIFY - public harness seams
apps/harness/package.json                                           # MODIFY - native lease dependency
apps/desktop/src/main/harness-supervisor.ts                         # MODIFY - process-global failure only
apps/desktop/src/main/project-storage-bridge.ts                     # MODIFY - correlated failure settlement
apps/desktop/src/main/workspace-bridge.ts                           # MODIFY - correlated failure settlement
apps/desktop/src/main/canonical-writer-package-smoke.ts             # NEW - private utility proof owner and bounded cleanup diagnostics
apps/desktop/src/main/project-storage-package-smoke.ts              # MODIFY - packaged Writer proof
apps/desktop/src/main/package-smoke-verifier.ts                     # MODIFY - stable proof stages
apps/desktop/src/main/main.ts                                       # MODIFY - package-smoke composition
apps/desktop/vite.harness.config.ts                                 # MODIFY - native staging and externalization
apps/desktop/forge.config.ts                                       # MODIFY - matching smoke fixture build input with unchanged security
apps/desktop/tests/e2e/package-smoke.mjs                            # MODIFY - cross-process native proof
pnpm-workspace.yaml                                                 # MODIFY - catalog and native build allowlist
pnpm-lock.yaml                                                      # MODIFY - exact dependency graph
```

## Ordering Constraints

- Correlated failure routing lands first so later activation and command failures cannot restart the harness or reject unrelated requests.
- Canonical generation 2 lands before any Writer activation attempts to persist a fence.
- Exclusive activation lands before switching because switching composes two activation lifecycles around an admission barrier.
- Switching and activation epochs land before Typed commands so stale commands cannot enter the first settlement implementation.
- Atomic settlement lands before uncertainty recovery because recovery reconciles the durable receipt written by settlement.
- S6 first characterizes legacy cleanup and checked lookup/authority behavior Green, then extends the shared owners with real Red/Green recovery behavior and a separate review/refactor gate. Recording must finish old transaction close before preparing/writing the marker; activation must read the prior ledger before advancing generation and insert G+1 before resolving its predecessor's row.
- Packaged proof is terminal because it requires the final protocol, lifecycle, persistence, native dependency, and recovery behavior.
- Within each slice, tests are written and observed failing before implementation; slices execute sequentially.
- Generated migration SQL, journal, and snapshot are produced together and reviewed as one schema change.
- S7 first preserves the shared Project101 value and original authorization/isolation behavior by characterization. Its separately versioned fixture schemas and test-owned protocol implementation precede reliance on fixture success; the one multi-entry build preserves S3 staging and the original CI sandbox metadata.
- S7 runtime order is original bootstrap, production inactive/activation/settlement, simultaneous read-only contender and clean stop, actual holder kill/exit/EOF, bounded explicit replacement/inactive/takeover/replay/old-epoch denial/sequence2 and clean stop, independent read-only audit, separate Project104 live stale Writer proof and test-only teardown. Only all owned exit/EOF observations plus the exact external terminal report permit later missing-runtime mutation, staging witness, root removal, or package restoration.

## Verification Notes

- Prove a correlated handler exception emits `request.failure` with the original request ID and leaves another pending request untouched.
- Prove any `system.failure` with non-null causation is rejected as a protocol violation; valid `system.failure` has null causation and triggers one recovery.
- Run the canonical schema generator check and exact schema verifier after adding every table, index, check, and foreign key.
- Open an actual generation-1 canonical fixture against generation-2 resources and byte-compare it before/after the `migration-required` result.
- Prove source-level contention on Windows and Linux with a separate Node peer process holding the same real descriptor range; `tryLock(fd, 0, 1)` returning `false` and Windows `EBUSY` map to `WRITER_UNAVAILABLE`, while Linux `EBUSY` and injected open/lock/unlock/close errors map to distinct broken results.
- Prove close failure retains the old session/lease and that no acquisition of the requested next Project occurs.
- Slice 4: prove same-turn enqueue closes admission before `SerialLock` awaits; queued source checks run against their execution-time Project/epoch, and queued stop cannot create a command-admission gap.
- Slice 4: prove the complete already-admitted fence-check set settles before release, and review retention of both completion-wrapper arms; real Writer port rejections normalize to broken, not an invented escaping rejection or a clean fence.
- Slice 4: prove A-to-A creates a fresh epoch; A release failures retain the old epoch/stage for explicit validated retry, whereas B failed-acquisition cleanup has no successful epoch and requires stop cleanup.
- Slice 4: prove successful A release precedes every B dependency, every expected target outcome retains B correlation under target-result, and no target failure restores A or stores a destination for later automatic acquisition.
- Slice 4: inject clock throws before active-source release, retained-source retry, and failed-target cleanup; ownership remains recoverable, no state is stranded in releasing, and no same-activation cleanup retry consumes the next clock value.
- Slice 4: rerun the named focused unit/integration and affected consumer typecheck gates only; leave native crash, package, mutation, and settlement proof to their owning slices.
- Prove stale activation rejection occurs before handler invocation and before any write transaction begins.
- Prove fence mismatch inside a transaction affects zero domain, sequence, receipt, rejection, and event rows.
- Prove applied, unchanged, rejected, conflict, exact-retry, and concurrent same-ID branches with exact row values and sequence deltas.
- Prove only applied settlements append events and event ordinals preserve emitted order under one settlement sequence.
- Inject known begin/body failures after state mutation but before receipt/event completion and, with successful rollback/close, prove every involved table unchanged. This is not an oracle for commit or close-after-commit failure.
- Slice 5: for commit/timeout/close-after-commit failure prove generic request.failure, Writer blocking, and retained resource ordering only. Slice 6 owns the later commit-phase classification/recovery-record proof and explicit reactivation reconciliation; a failed commit acknowledgement never proves absence.
- In Slice 3, inspect the exact installed `fs-native-extensions@1.5.1` package and executing-target prebuild; do not infer support only from its repository build matrix.
- Assert native binaries are shipped under `resources/app.asar.unpacked` and import successfully from packaged Electron main.
- In Slice 7, launch independent packaged processes for native loading, contention, force-termination crash release, bounded takeover, and stale-process proof on Windows and Linux.
- Run the smallest affected Vitest and workspace typecheck commands after each slice; run `pnpm check`, `pnpm check:deep`, and `pnpm package:smoke` on the terminal slice.
- Do not run mutation tests unless explicitly requested.

### Slice 5 pending proof and limits

- Scope is projected Slices 1-4 plus the S5 deltas in the single existing fence per touched production file. No live production implementation or test was written. The four new production modules have one Architecture entry and one File Map entry each. Slice 5 test/fixture code remains ungenerated and appears only in its Files/Test Contract; previously reserved Slice 6/7 content is preserved without implementation or cleanup outside this slice's scope.
- Pinned source inspection: `pnpm-workspace.yaml` declares `@libsql/client 0.17.4`, `libsql 0.5.29`, and `zod 4.4.3`. `storage/local-libsql-worker-client.ts:248-265,317-355` forwards transaction SQL and terminal calls; the installed libSQL client detaches a connection after transaction begin. Configure each write connection, verify foreign_keys, and characterize raw savepoint SQL through the actual worker before relying on it.
- Primary sources used: [libSQL sqlite3 implementation](https://github.com/tursodatabase/libsql-client-ts/blob/main/packages/libsql-client/src/sqlite3.ts) and [SQLite savepoints](https://www.sqlite.org/lang_savepoint.html). They ground the expected SAVEPOINT/ROLLBACK TO/RELEASE behavior, not an executed pinned-library compatibility claim. The supplied documentation provenance says `ctx7` could not run in the documentation subagent because it had no shell. This session also ran no CLI, per the document-only instruction; no quota failure, login requirement, runtime success, or newly dispatched subagent is claimed.
- Installed Zod source `src/v4/classic/schemas.ts:2653-2658` composes z.json using records, and `src/v4/core/schemas.ts:2954-2958` skips `__proto__`. S5 therefore explicitly changes only TypedCommand's JSON validation to preserve all finite own data keys; protocol/transport shape and type/version trim remain the baseline. Characterize exact preservation and reject invalid values inside proto-like keys rather than hashing a silently reduced object.
- Canonical fingerprint/JSON validation is not protection against hostile external SQLite writers. The locked schema stores no original raw command, receipt-level event count/hash, or generic aggregate identity table. S5 validates stored shape, actual relational bindings, requested fingerprint/type/version, contiguous observed event order, and payload/detail hashes; it cannot authenticate a coordinated valid rewrite or prove a missing contiguous suffix. Do not add schema fields or pretend reconstruction solves that limitation.
- `withWriteTransaction` combines begin/body/commit/close failure handling and remains untouched. Coarse blocking covers all unexpected settlements. The repository's small retained-close wrapper is required for S5 release safety when the helper returns a close error; it retries actual transaction close only on explicit release/close and never infers whether commit landed.
- Required new runtime proof uses real MessagePorts, application, coordinator, Writer, repository, worker client, and SQLite rows. The fixture-owned Storage port is explicit because production opening rejects extra test tables; the empty-registry production case uses the unextended real Storage path. Receipt-only mocks cannot establish atomicity.
- The exact S3/S4 assertion migration table in Slice 5 is the only new execution-oracle authority; historical contracts below are untouched. Preserve required switchProject and all source-qualified switching rules. No new harness-runtime/protocol transport code is necessary just to carry the new result schema.
- Outstanding factual gate: actual pinned-driver savepoint/connection characterization and all implementation tests/typechecks/architecture checks remain unexecuted. A failure requires revision, not removal of rollback semantics. Independent static review is recorded under Developer Context; separate code approval is recorded below. There is no finalized/stamped design claim.

### Slice 6 pending proof and limits

- Scope is five proposed production files: four in-place extensions and one new recovery owner. File Map NEW/MODIFY labels describe the whole feature relative to live source; Slice 6 Files labels describe its delta relative to projected S5. Writer/coordinator/application/runtime/bootstrap/protocol/schema/Storage production blocks receive no S6 code changes. Existing S5 no-recovery prose is historical; the S6 assertion migration table explicitly defines the new execution expectations.
- Static ground truth read for this draft includes PRODUCT/CONTEXT, all feature Decisions, ADR 0006, both standing decisions, projected S1-S5 contracts and relevant merged code/schema, live transaction helper and its exact direct Storage callers/tests, kernel identity predicate, and worker SQL/terminal/close paths. The generation-2 schema/spec/migration already contain `writer_recovery_records_generation_uq`, `writer_recovery_records_unresolved_uq`, and both composite generation/resolver foreign keys. S6 adds no schema or speculative migration.
- Legacy helper gate: compare both runner exports across primary/secondary errors and exact identity/order/message against live `project-storage-transaction.ts:18-90`, direct application tests at `project-storage-node-adapters.test.ts:519-662`, and actual worker deferred-FK COMMIT at `local-libsql-worker-client.test.ts:13-38`. The live Storage callers at `project-storage-node-adapters.ts:249-265,1518-1545,1565-1589` must remain unchanged. A successful later rollback is not evidence that commit was never requested.
- Recovery-record proof must decorate real worker SQL/COMMIT and independently read committed rows. The worker's `finishTransaction` removes its transaction only after terminal acknowledgement at `local-libsql-worker-client.ts:213-217`; close tolerates an already-removed transaction at `219-227`, and the client flips its closed flag only after successful terminal response at `350-353`. These source observations ground the design but do not establish runtime compatibility or blanket broker/network fault recovery.
- Marker preparation evaluates its ID and clock only after explicit cleanup acknowledges the old close. The captured observedAt belongs to the first successfully prepared explicit recording attempt and is reused through SQL/ack retries; it is neither a reconstructed failing-commit time nor a measurement of SQLite fsync/ack latency. The existing coordinator release timestamp is captured before cleanup and may precede observedAt; S6 does not rewrite that historical clock contract. Fully failed preparation retains only CommandId/fingerprint and may prepare again on a later explicit request.
- Ordinary lookup keeps submitted type/version checks. Recovery has no raw payload/type/version, uses only the exact persisted CommandId/fingerprint, and bounds receipt generation by prior G rather than new G+1. It validates original pointer plus original/requested ledger children/hashes; absence with a different original fingerprint means only that requested fingerprint is absent. Resolved absence remains historical after future user retry. The S5 limitation against coordinated valid rewrites or detecting an omitted contiguous event suffix remains unchanged.
- Recovery SELECT validates applicable/current, unresolved/partial, and future rows for the selected Project, not all historical records or other Projects. A foreign row returned by a SELECT decorator is broken; an unrelated Project's valid marker is not grounds to block this Project. Duplicate applicable or older-unresolved authority cannot be hidden by LIMIT1, overwrite, or an abandoned-record fallback. All successful writes require rowsAffected1, and known body failures must be independently rollback-proven.
- No new lifecycle/public API is necessary. Source-qualified switch and coordinator/Writer stop retries use the already-owned stages; direct repository close refuses to discard unrecorded uncertainty. The existing runtime stop promise is cached even after failure, so do not claim repeated calls to that runtime wrapper issue fresh retries; S6's explicit retry proof uses the existing coordinator/Writer/repository owner seams or valid switches. No speculative transport stop command or optional bootstrap bypass is added.
- Approved safe limits: process death before durable marker loses in-memory command attribution, so active prior fence is only generic abandoned evidence. A hung transaction stays owned. Fence-release/activation COMMIT failures retain their existing fail-closed lifecycle limitations, including stale-released-fence refusal. Successful marker acknowledgement is not authority to force native release past another failed stage. Source-level abandoned database fixtures do not prove real forced termination; packaged Windows/Linux crash/takeover remains S7.
- Outstanding research/execution gates: S5 pinned-driver SAVEPOINT/connection characterization remains mandatory and unexecuted; S6 real settlement/recording COMMIT-ack decorators, deferred-FK classification, atomic recovery integration, exact transport composition, harness typecheck, architecture-model/source-boundary checks, and separate review/refactor remain unchecked. Runtime incompatibility requires design revision, never weaker rollback/ownership/absence rules. No new user-choice ambiguity is identified; independent static review and the separate S6 code/Test Contract/criteria approval are recorded under Developer Context. This design approval does not authorize product implementation or waive these gates.

### Slice 7 pending proof and limits

- S7 uses independent packaged Electron utility processes under a single private authorized main owner. They are actual independent OS processes; ordinary supervisor automatic recovery is deliberately not part of the crash-proof driver. Killing main or calling Electron UtilityProcess.kill is not the hard-kill proof.
- Retain the existing CI split on Ubuntu: portable deep checks under xvfb, root-owned mode4755 chrome-sandbox setup, then `pnpm package:launch-smoke` under xvfb against that same built package. Existing Windows CI runs fast/integration/packaged Electron journeys then package launch. `pnpm package:smoke` is the one-command build/proof seam where the machine's sandbox prerequisites are satisfied; never disable sandbox or copy away its verified owner/mode to force Linux success.
- Focused harness fixture integration imports a test-only fixture function accepting its validated start and real MessagePort-like transport, drives it over Node MessageChannel with explicit terminal callbacks, and uses real harness factories/SQLite. The same fixture entry's thin Electron parent-port adapter uses that function in the actual package. Importing it in a Node integration test must not exit the test host. It remains a test file, not a production factory or source adapter. The 15000ms harness integration default applies to focused cases; full native packaged journeys use the explicit executable proof budgets instead.
- The new private fixture protocol is separate from the v4 product command union and validates every value. Its inert entry is included in the archive; only the authorized smoke path launches it. S7 expands its Files inventory for this user-approved proof seam without altering the seven-slice order or reopening Slices1-6.
- Native documentation research distinguishes published source and actual prebuild behavior. The v1.5.1 shared C layer normalizes native EACCES/EAGAIN/EBUSY into denial before the JS false return; the locked Windows-EBUSY defensive classification and Linux injected-error contracts remain unchanged. Do not claim Windows must actually throw EBUSY. Real installed and packaged behavior must be observed.
- Context-mode tools were not available to these research agents, and active shell restrictions prevented ctx7 lookup; primary versioned Electron/native/OS/Forge sources and published prebuild metadata were used instead. There was no quota result or login requirement. Research is not native/runtime execution evidence.
- Existing source research is historical relative to HEAD59fb35b: live Project Storage packaging/authorization/native libSQL staging already exist and are the S7 base. Do not reintroduce superseded Project Storage implementation-authority issues into this later slice. Current S5/S6 factual execution warnings remain mandatory.
- This slice intentionally does not reproduce the entire uncertain-commit marker matrix in packaging. It proves real crash loss of in-memory attribution through generic abandoned-fence records, durable exact receipt replay, and live stale fencing. S6 source/real-worker tests separately own marked uncertainty and lost-commit-ack classification.
- Static grounding includes AGENTS/PRODUCT/CONTEXT, both standing decisions, ADR0001/0005/0006, complete live packaging/authorization/main/session/supervisor/bootstrap/shutdown files, projected S1-S6 coordinator/Writer/repository/settlement/recovery/runtime blocks, the complete approved S7 Architecture and contract, and CI sandbox preparation. Installed Electron declarations distinguish actual utility exit, spawn-only PID, graceful UtilityProcess.kill, and post-exit null stdio handles. Capture streams before exit and separately observe EOF; the expected nonzero hard-kill exit still requires real Windows/Linux proof.
- Installed Forge preserves an explicitly supplied build.lib in the pinned implementation; both Forge and Vite input maps remain aligned regardless. Preserve the complete S3 runtime dependency collector and one staging pass. Distinct harness.cjs/fixture names and .cjs shared chunks require actual built import-graph inspection proving fixture side effects are absent from the default harness graph. The worker's module resolver anchors to process.argv[1], then searches parent node_modules; package-local staged resolution and no workspace fallback must be observed, not inferred from source alone.
- Native metadata establishes the published v1.5.1 target filename/hash, not local runtime compatibility. Main and fixture must witness actual exact native origin. Auto-unpack selects .node files rather than entire packages, so package JSON/JS origin is checked through virtual ASAR while binary existence/hash is checked physically under app.asar.unpacked. Targets win32-x64/linux-x64 require independent real proof; listed Darwin/Linux-arm64 targets are not validation claims. No published linux-arm Node prebuild is assumed. Missing dependency/setup is a broken gate, not behavioral Red.
- Every normal wait and side-effect boundary uses the same first-fault latch and bounded admission. Cancellation before entry prevents native preflight mutation. Remote production port closure is observed directly rather than inferred from HarnessSession. Cleanup mode is separately bounded and ignores fault/abort only while keeping ownership. Retain up to24 frozen cleanup entries over six zero-based process indices, with no raw error/PID/path/token; capture separate setup/kill, terminal-wait, drain, and disposal catches. Entries cannot change the first fault, external output, or actual exit/EOF-based cleanupSafe.
- Exact external output grammar remains independently validated: success has empty stdout and only terminal then pass lines; safe failed cleanup has only terminal and one fixed bounded lowercase/hyphen stage line. Extra/malformed/partial output, unconfirmed exit, or timeout withholds root and package restoration. The unmodified sibling rename preserves CI sandbox metadata; same-volume and permission/owner assumptions remain runtime gates, not reasons for a copy or sandbox workaround.
- All compiler, native driver, SAVEPOINT/connection, S6 recovery, real process, package, boundary, model, focused test, and deep validation gates remain unchecked. Static Slice7 approval does not authorize product implementation, certify bytewise earlier-slice preservation, or waive any runtime warning. A failed load/exit/EOF/driver/sandbox check requires diagnosis and revision, never weaker proof.

## Performance Considerations

- The OS lock is acquired once per writable activation, not once per command.
- Writer transactions use `BEGIN IMMEDIATE`, contain no filesystem/network/provider/process work, and remain bounded to fence check, state access, sequence allocation, and settlement writes.
- Canonical idempotency and receipt lookup use Project-scoped unique indexes to avoid table scans.
- One Project sequence is allocated per first settlement; multiple applied events use an ordinal instead of additional sequence-allocation transactions.
- Switching waits only for the currently admitted short settlement, not for long-running Run or provider work.
- S6 adds no marker transaction to healthy settlement/replay or the failing request. Only explicit cleanup of retained uncertainty adds its fenced recording transaction before the existing release transaction. Activation reads the selected Project's applicable/unresolved/future recovery authority and at most the required original/requested receipt families; no full-history reconstruction is performed or benchmark claimed.
- Local libSQL busy timeout must be explicit and bounded so unexpected non-cooperative writers fail visibly rather than hanging indefinitely.
- S7 proof is private and bounded, not a production scheduling change: at most six utility processes are retained, each stdio stream stores only a saturated byte counter capped at65537 rather than raw logs, and failed cleanup retains at most24 safe metadata entries. Normal admission has a90000ms proof ceiling and10000ms step ceiling; takeover is15000ms from the observed exit timestamp, with100ms explicit contention retry spacing. Clean exit is5000ms, cleanup terminal observation10000ms plus3000ms EOF, and the outer writer launcher120000ms plus5000ms terminal fallback. No measured latency or capacity claim is made.
- Independent audit and live stale proof perform only their fixed small test workloads; they add no production domain table, ongoing scanner, background retry, or automatic supervisor-recovery loop. One multi-entry build stages the native dependency closure once.

## Migration Notes

Canonical generation 1 is a historical, valid schema and its checked-in migration/snapshot are never edited. Generation 2 is appended as a new migration and becomes the target only for fresh Project creation. Opening an existing generation-1 Project remains read-only inspection and returns `DATABASE_MIGRATION_REQUIRED`; no backup, schema mutation, or manifest rewrite occurs. Rollback during development removes only newly created generation-2 test Projects and code; there is no down-migration for persisted user data because #90 never upgrades it.

## Pattern References

- `apps/harness/src/storage/serial-lock.ts:1-21` - serialize coordinator lifecycle transitions with release in `finally`.
- `apps/harness/src/storage/project-storage-store.ts:243-300,455-483` - fingerprint, inspect replay/conflict, and fail closed before allocation or mutation.
- `apps/harness/src/storage/project-storage-transaction.ts:18-90` - preserve rollback and close failures around a bounded write transaction.
- `apps/harness/src/project-storage-application.ts:15-31,144-163` - keep owner behavior behind a narrow application mapper at the process boundary.
- `apps/harness/src/process-bootstrap.ts:75-90` - compose Node and persistence adapters once in the harness bootstrap.
- `apps/desktop/src/main/project-storage-bridge.ts:144-239` - correlate terminal events to bridge-owned pending requests.
- `apps/harness/tests/integration/harness-runtime.integration.test.ts:134-301` - prove runtime behavior through a real MessagePort transport seam.
- `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts:520-553` - existing retained-session behavior that the new coordinator must bound rather than silently alter.
- `apps/desktop/tests/e2e/package-smoke.mjs:108-650` - inspect unpacked native resources and drive packaged process proof.

## Developer Context

### Inherited decisions

- The active Project is session-scoped and must be explicitly selected after restart.
- The coordinator holds one Writer for the active period rather than reacquiring it per command.
- Switching blocks admission, drains the current short transaction, releases A, then acquires B.
- A second process activates read-only with `writer-unavailable` and cannot submit Typed commands.
- Correlated request failure is separate from process-global `system.failure`.
- The lease is a held native byte-range lock on a dedicated companion file, paired with a durable generation/token.
- Exact retry returns the original receipt; conflicting reuse is durably rejected; stale Writers write nothing.
- Commit uncertainty quarantines the Writer and requires explicit reactivation.
- The first handler is test-only conformance behavior and Board remains deferred.
- Writer authority tests precede settlement tests.
- Existing generation-1 Projects report `migration-required` with no migration in this feature.

### Design checkpoints

**Question:** Does this design direction match the intended Project Writer boundary and failure/settlement behavior?

**Answer:** You might want to spawn subagents explaining the choices and your ideia, and discuss these choices and decisions to see if there are any weakspots ore better solutions etc. Afterwards explain to me what we will building ands why etc

**Question:** Should this strengthened design become the basis for the exact vertical-slice decomposition?

**Answer:** Approve (Recommended)

**Question:** 7 slices for Canonical Project Writer. Slice 1 fixes correlated failures; Slices 2-3 establish schema and exclusive activation; Slices 4-6 add switching, settlement, and recovery; Slice 7 proves packaged cross-process behavior. Approve decomposition?

**Answer:** Approve (Recommended)

**Question:** Approve Canonical Generation 2 as the locked persistence foundation for the remaining Writer slices?

**Answer:** Approve Slice 2 (Recommended)

### Slice 2 artifact repair

The approved Slice 2 Test Contract remained present while its Architecture fences were empty. The available evidence established incomplete artifact integration, not deletion of Slice 2. The user authorized filling those fences without implementing product behavior.

**Question:** Should I reopen only Slice 2's empty production architecture fences, restore the already-approved generation-2 implementation from `.rpiv/tmp-slice2`, and reverify Slices 2-3 before the Slice 3 checkpoint?

**Answer:** Restore Slice 2 (Recommended)

The schema, migration, journal, and snapshot were incorporated from `.rpiv/tmp-slice2`. Missing kernel, exact-schema verifier, and creation-wiring blocks were reconstructed against the approved contract. Verification wording was corrected to retain the required initial `project_state` row and use the existing `db:generate:check` script. Slice 2's approval and behavioral oracles remain in force.

### Slice 3 verification checkpoint

Independent design review `ses_f90de4c0fffedz5HX3rf3iNl4k` concluded with `Decisions: OK`, `Cross-slice: OK`, and `Research: OK` after the final corrections. This is a review of the proposed code and contracts, not execution evidence for product tests, typechecks, builds, native loading, or Windows/Linux integration. Automated implementation checks remain unchecked. Local write hooks reported `Node executable unavailable`; their checks were skipped, not passed.

The final corrections preserve the existing Project/Storage identity diagnostics through one protocol helper, characterize the refactor before and after without a fabricated Red, and isolate staged native loading in a child that exits before Windows cleanup. The review itself grants no approval; developer approval is recorded below. Slices 4-7 and product implementation are not authorized by this review.

**Checkpoint:** Approve and lock the Slice 3/7 Exclusive Activation design after the Slice 2 artifact repair and all three independent review outcomes returned OK. End this checkpoint with Slice 4 as the next design work; no product implementation is authorized.

**Answer:** Aprovar Slice 3 (Recommended)

### Slice 4 switching contract approval

**Approved contract:** The switch request names the source Project plus source activationId and the destination Project; revalidate those values at execution time in FIFO lifecycle order. A-to-A is explicit reactivation yielding a new activationId. After successful A release, B failure never auto-restores A. Failure releasing A retains the exact resource stage and source epoch, permits only a subsequent explicit valid retry, and never acquires B automatically.

**Answer:** Aprovar contrato (Recommended)

This records the user's exact additional contract approval, not approval of the pending Slice 4 code, Test Contract, or verification criteria. No new discovery or decomposition checkpoint was opened. The existing seven-slice order and Slices 1-3 approvals remain locked. Grounding: `apps/harness/src/storage/serial-lock.ts:4-14` waits before invoking its FIFO callback; the existing Architecture blocks for `active-project-coordinator.ts`, `canonical-project-writer.ts`, and `project-storage-store.ts` retain the relevant ownership and close stages; `docs/adr/0006-physical-persistence-layout.md:60-67,100-105` separates durable Writer authority from operational activation lifetime.

### Slice 4 design-only self-audit

Only this artifact was edited with apply_patch. Six existing production Architecture fences were extended in place; no new production heading or test Architecture/File Map entry was added. Slice 4's inventory excludes unchanged Writer/Storage internals and bootstrap, includes protocol wiring plus all live direct runtime fixture sites, and treats Slice 3-introduced canonical fixtures as the baseline. Slices 1-3 Test Contracts, verification criteria, and history entries are preserved verbatim; Slices 5-7 entries remain untouched. The shared coordinator extension adds queue-time admission and exception-safe composition without changing settled activation outcomes or introducing command settlement.

Self-review checks: source validation occurs inside the FIFO callback; no public activate call occurs while holding its lock; failed release retains Project/actual epoch and only unfinished ownership; null-epoch cleanup cannot be switched out of; all target dependencies follow complete A release; target correlation is schema-checked and original source/destination correlation is application-checked; stop shares one attempt and permits explicit retry after rejection; clock evaluation precedes releasing state; no target is retained for auto-acquisition or rollback. No unresolved switching contract ambiguity is identified. The rejection-settlement limitation of the real Writer is stated explicitly in the Test Contract rather than hidden by a private mock seam.

This is a static self-audit, not independent slice-verifier approval or execution proof. Product tests, typechecks, architecture commands, builds, and native checks were not executed. Available write hooks reported `Node executable unavailable` and skipped validation/duplication checks; those hooks did not pass. A read-only Git whitespace check against this untracked artifact reported two pre-existing whitespace-only lines inside the untouched, locked Slice 2 migration SQL fence; they were not changed to manufacture a clean check. Final Git status retained the same two untracked artifact paths observed initially; the unrelated handoff was not edited. The subsequent independent review is recorded below.

### Slice 4 independent verification

Read-only slice-verifier review `ses_f90b21114ffe84DSQX7f7gOXa4` reported no concrete violation and concluded `Decisions: OK`, `Cross-slice: OK`, and `Research: OK`. It checked the six merged code blocks, complete Test Contract, direct caller inventory, and atomic criteria against the approved projected Slices 1-3 baseline. No test, typecheck, build, installation, or native command was executed; implementation proof remains outstanding.

| Changed file | Review surface |
| --- | --- |
| `packages/protocol/src/canonical-project-protocol.ts` | Strict source-qualified switch request and result union; nested target result cannot claim successful activation after failure. |
| `packages/protocol/src/protocol.ts` | `createProjectSwitchCommand` and `createProjectSwitchResultEvent`; additive v4 variants preserve locked failure scope. |
| `packages/protocol/src/index.ts` | Explicit public schemas, inferred types, and factory exports. |
| `apps/harness/src/active-project-coordinator.ts` | `switchProject(request): Promise<CanonicalProjectSwitchResult>`; synchronous admission barrier, FIFO source revalidation, drain, staged release, and inner target activation without recursive locking. |
| `apps/harness/src/canonical-project-application.ts` | Required switch method; full source/destination correlation and sanitized invalid-result handling. |
| `apps/harness/src/harness-runtime.ts` | Correlated switch dispatch, result forwarding, and unchanged request-scoped exception containment. |

The full Slice 4 Test Contract and its Automated/Manual Verification sections are the approval surface. Writer/Storage internals remain unchanged dependencies. Switching never automatically restores A or retries B; stale requests cannot release a newer activation. The separate developer approval below locks Slice 4; Slices 5-7 remain pending.

**Checkpoint:** Approve the proposed code, Test Contract, and criteria for Slice 4/7 Safe Project Switching after all three independent review outcomes returned OK. This covers source Project/activationId, immediate admission closure, draining before A release, explicit retry, and no automatic A restoration. End this checkpoint with Slice 5 as the next design work, without authorizing product implementation.

**Answer:** Aprovar Slice 4 (Recommended)

### Slice 5 additional user decisions

The user approved the following additional behavioral choices in this session, independently from code approval.

**Decision:** The first syntactically valid command with an unregistered type/version or invalid handler payload receives a durable rejected receipt, consumes one sequence, and binds CommandId. Corrected content requires a new CommandId. Malformed envelopes, missing authority, and unexpected exceptions remain outside durable settlement.

**Answer:** Rejeição durável (Recommended)

**Decision:** One settlement in flight per Writer, no backlog. Exact simultaneous canonical-content retries join the same result; other commands receive non-durable busy and can resend explicitly.

**Answer:** Um settlement (Recommended)

**Decision:** Any unexpected settlement/transaction failure reaches the locked request.failure boundary and blocks further settlements in this Writer until explicit reactivation. Never infer rollback from rejected commit. Detailed commit-uncertainty classification and recovery records stay in Slice 6.

**Answer:** Bloquear Writer (Recommended)

Grounding: the approved generation-2 `command_receipts`, `command_idempotency`, `command_rejections`, and `canonical_events` declarations above; ADR 0006's Commands And Canonical Events contract; the approved coordinator/Writer staged ownership and source-qualified switching blocks. These choices authorize writing this pending S5 design only. They do not approve its code, Test Contract, criteria, product implementation, or any later slice.

### Slice 5 design-only self-audit

Only `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` was edited, using apply_patch. No product, test, configuration, temporary, or other artifact file was edited. Git status was inspected; no product test, typecheck, build, install, architecture command, commit, or migration generator was run. Automatic write hooks reported `Node executable unavailable` and skipped their checks; skipped is not passed. Static reading used the active document, PRODUCT, CONTEXT, ADR 0006, both standing decisions, live worker/helper/config/fixture patterns, installed library sources, and the cited primary sources. This self-audit is distinct from the subsequent independent reviews recorded below; no byte-for-byte prior-artifact preservation certification is claimed.

Static review: ten existing production fences carry explicit pending S5 deltas and four small production modules were added once each. SQL reads and writes use the locked generation-2 columns and Project-scoped binding/order constraints; no schema or migration fence was changed. The shared transaction helper remains an empty S6 placeholder here and unchanged live. Snapshot identity excludes operational authority, durable lookup precedes registry work, original/conflict replay allocates nothing, all first durable outcomes allocate once, handler effects are savepoint-bound, issued SQL is drained/revoked, and transaction-close failure cannot advance to lease release without acknowledged cleanup. The new successful result is schema-defined, immutable at receipt boundaries, correlation-checked, and contains no raw payload, token, digest, path, or exception data.

Approved Slices 1-4 Files/Test Contracts/verification sections/history entries were not targeted by any edit and remain the historical baseline. Their deliberate healthy-stub oracles are superseded only for S5 execution by the explicit migration table, not silently rewritten. At the self-audit, Slice 5 was pending; the later approval is recorded below. Slices 6-7 remain unimplemented. No unresolved user-choice ambiguity is identified. Pinned-driver SAVEPOINT/connection behavior, type correctness, and automated tests remain execution proof obligations, not claimed successes. The schema's bounded integrity limitations are explicit in Verification Notes.

### Slice 5 independent verification

Read-only slice-verifier review `ses_f8f8ab041ffeF4rv0Fx7mS7JRq` found no outstanding concrete blocker after correcting required seconds in settlement instants, rejecting NIL/MAX aggregate identities with the existing kernel predicate, and adding the real bootstrap integration oracle. Complementary caller review `ses_f8f80f4bbffeHRQrlpfI2V2YHL` confirmed that the bootstrap inventory, gate, and factory-wiring coverage omission is resolved, with no remaining integration finding.

- Decisions: OK
- Cross-slice: OK
- Research: WARNING: mandatory pinned-driver SAVEPOINT/connection compatibility and implementation validation remain unexecuted.

This supports approval of the proposed design, not implementation completion. The mandatory real-worker characterization must run before implementation relies on savepoint rollback; failure requires design revision and cannot be waived by this checkpoint. No reviewer executed tests, typechecks, builds, installations, or native checks. Their static scope and the available complementary caller audit do not certify bytewise historical preservation.

| Changed file | Review surface |
| --- | --- |
| `packages/kernel/src/project-storage-identifiers.ts` | Add durable receipt/event identity brands; preserve existing ordering guards. |
| `packages/kernel/src/index.ts` | Declare those identity exports. |
| `packages/protocol/src/canonical-project-protocol.ts` | Finite JSON, strict immutable receipts, settled/busy/blocked/exhausted outcomes, seconds-bearing UTC timestamps. |
| `packages/protocol/src/index.ts` | Export the new schemas and inferred types. |
| `apps/harness/src/canonical-json.ts` | Canonical text snapshots and deterministic hashes, excluding activation and Writer secrets. |
| `apps/harness/src/canonical-command-registry.ts` | Typed registered handlers, payload validation, closed decision variants and safe rejection codes. |
| `apps/harness/src/storage/canonical-command-repository.ts` | Own configured transactions and retained cleanup; expose settlement under Writer authority. |
| `apps/harness/src/storage/canonical-command-ledger.ts` | Validate/replay original and conflict receipts; persist one sequence, receipt and outcome-specific children. |
| `apps/harness/src/storage/canonical-command-settlement.ts` | Fence before mutation, savepoint-bound handler execution, revocable SQL capability, then atomic ledger writes. |
| `apps/harness/src/canonical-project-writer.ts` | One in-flight slot, exact joins, no busy backlog, failure blocking and drain-before-close. |
| `apps/harness/src/active-project-coordinator.ts` | Preserve Project/epoch/barrier checks and track only accepted settlement completions. |
| `apps/harness/src/canonical-project-application.ts` | Validate settled receipt/request correlation while preserving exception scope. |
| `apps/harness/src/process-bootstrap.ts` | Explicit empty production registry and complete settlement dependency composition. |
| `apps/harness/src/index.ts` | Declare the testable registry seam without exporting the private Writer token. |

The full Slice 5 Test Contract, prior-slice assertion migration table, and Automated/Manual Verification sections are the approval surface. No schema migration or production domain handler is introduced. Detailed commit uncertainty remains Slice 6, and packaged cross-process proof remains Slice 7.

**Checkpoint:** The final question asked whether to approve and lock Slice 5's reviewed code, Test Contract, and verification criteria and end this checkpoint, with Slice 6 next. It explicitly presented Decisions OK, Cross-slice OK, and Research WARNING for mandatory, unexecuted pinned-driver SAVEPOINT/connection compatibility and implementation validation. If that gate fails, the design must be revised, not the gate weakened.

**Answer:** Aprovar Slice 5 (Recommended)

This records design approval only: it does not waive the research runtime gate or authorize product implementation. This checkpoint is ended; Slice 6 is next and has not been started.

### Slice 6 new contract approval

**Approved contract:** After uncertain commit, block the Writer and retain the canonical admitted CommandId/fingerprint in memory. On an EXPLICIT switch/stop, do not release the native lease until an uncertainty record is durably recorded. The next explicit activation reconciles receipt-found or receipt-absent WITHOUT executing a command. If the process dies before the record is written, the prior active fence is abandoned evidence only; do not invent the lost command or outcome. A later explicit same-ID/content retry uses durable receipt lookup. No automatic journal or command retry on the failing request, and no restoration of the active Project after restart.

**Answer:** Aprovar contrato (Recommended)

This records the user's earlier behavioral approval, separately from the S5 approvals and from S6 code approval. It authorized the then-pending design draft only; subsequent independent static verification and the separate user code/Test Contract/criteria approval are recorded below. No additional checkpoint answer is inferred. Grounding: projected S5 Writer admission and staged close, repository configured-client/finishPendingTransaction ownership, checked ledger and generation-2 recovery constraints, live helper/worker terminal semantics, and ADR 0006 Commands And Canonical Events plus Runtime Handoff And Writer Recovery.

### Slice 6 design-only self-audit

In this turn I used read-only file/skill inspection and apply_patch targeting only `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md`. I issued no shell commands, tests, installs, builds, commits, or subagent dispatches, and created/edited no product, test, temporary, configuration, or other artifact file. Automatic apply_patch hooks reported `Node executable unavailable` and skipped their validation/duplication/Impeccable checks; skipped is not passed. These statements describe my own actions only, not tools available to or actions performed by another/parent session.

The draft, pending at this self-audit and subsequently approved below, fills the existing transaction-helper placeholder, extends repository/ledger/settlement in their sole existing code fences, adds one recovery owner, adds three feature-local Decisions, and fills S6 Files/Test Contract/unchecked criteria. File Map and Verification Notes are synchronized; speculative S6 Writer/coordinator/application modifications are removed from its inventory and recorded as unchanged dependencies. Bootstrap remains unchanged because its projected required factory dependencies already provide ID/time. No S6 test source fence or new test Architecture/File Map entry is created. The S7 skeletons and historical S1-S5 Files/Test Contracts/criteria/history were not targets of these patches; no byte-for-byte preservation certification is claimed without an independent baseline comparison.

Static self-review checked separate body/commit catch scopes, unchanged cleanup diagnostics, no recovery metadata allocation on settlement/replay, retained exact preparation, old-close-before-marker and marker-ack-before-release, configured token/generation authority, no recursive recording, checked original/requested ledger reuse, G-before-G+1 lookup, resolver FK order and conditional rowcounts, marked-active/released handoff, no command work during activation, and stable historical absence. This is not independent verification, TypeScript compilation, SQL execution, or proof that the Test Contract passed. The exact legacy regressions and real-worker recovery proof remain gates; S5 SAVEPOINT/connection warning is not waived. No unresolved product-choice ambiguity is identified. S6 code approval was pending at this self-audit; the subsequent independent static verification and separate user approval are recorded below. All execution gates remain unchecked; S7 is not filled or approved here.

### Slice 6 independent verification

Read-only slice-verifier review `ses_f8f0822d4ffeMPPAJbhGmOy2Wq` found two concrete gaps, both resolved before the code checkpoint: activation now shares the full predecessor fence/generation validator, and repository settlement rechecks quarantine after asynchronous token hashing immediately before transaction admission. Exact adversarial contracts cover malformed/conflicting predecessor times and a suspended direct request attempting to resume after another command becomes uncertain. The validation criteria now distinguish `check:architecture` for the model from `check:boundaries` for source imports.

- Decisions: OK
- Cross-slice: OK
- Research: WARNING: mandatory pinned-driver SAVEPOINT/connection characterization and S6 runtime, test, typecheck, and boundary-validation proof remain unexecuted.

The reviewer found no new concrete issue in the corrected paths or contracts. This is static design verification, not compiler, database, runtime, crash, or bytewise historical-preservation evidence. The existing execution gates remain unchecked and mandatory; a failed driver or recovery proof requires revision, not a weakened oracle.

| Changed file | Review surface |
| --- | --- |
| `apps/harness/src/storage/project-storage-transaction.ts` | Add `runClassifiedWriteTransaction` while preserving the existing wrapper's result, error identity and aggregation behavior for Storage callers. |
| `apps/harness/src/storage/canonical-command-repository.ts` | Retain uncertain command attribution, block direct reuse, require durable recording before explicit cleanup, and compose recovery into generation activation. |
| `apps/harness/src/storage/canonical-command-ledger.ts` | Share checked CommandId/fingerprint lookup without inventing raw historical payloads or weakening ordinary submitted-type/version checks. |
| `apps/harness/src/storage/canonical-command-settlement.ts` | Share full fence/generation validation and sequence reading with recovery; preserve settlement authority and mutation ordering. |
| `apps/harness/src/storage/canonical-writer-recovery.ts` | Validate and record one exact unresolved marker, recognize acknowledged/lost-ack retries, and resolve that same row atomically under the next generation without executing commands. |

The complete Slice 6 Test Contract, explicit assertion migration table, and Automated/Manual Verification sections are the code-approval surface. The approved pre-marker crash gap remains explicit. Writer/coordinator/application/runtime/bootstrap/protocol behavior outside these composed internal paths is unchanged; packaged forced-termination proof remains Slice 7.

**Checkpoint:** The final question asked whether to approve and lock Slice 6's reviewed code, Test Contract, and verification criteria, covering classified transaction failures, explicit durable uncertainty-before-release, and atomic receipt reconciliation without executing commands. It explicitly presented Decisions OK, Cross-slice OK, and Research WARNING for mandatory, unexecuted driver/runtime and boundary-validation proof, together with the approved pre-marker crash gap: abandoned-fence evidence only, with no invented command outcome. The user's choice locks the design only; no product implementation is authorized, mandatory runtime/driver/boundary checks are not waived, and all implementation/execution gates remain unchecked. This checkpoint ends with Slice 7 as the next design work; Slice 7 is not started and the global design remains in-progress.

**Answer:** Aprovar Slice 6 (Recommended)

### Slice 7 additional proof-seam decision

**Question:** The design requires packaged crash-release and stale-fence proof (design:42,10726), while the production harness deliberately has an empty command registry (design:9268). Should Slice 7 add a separate smoke-only harness fixture/build entry so we can retain an old Writer, deliberately supersede its authority in an isolated test, and prove it writes nothing? Normal packaged-app scenarios would separately prove contention, forced holder termination, and takeover. No production test command or renderer API would be added.

**Answer:** Smoke fixture (Recommended)

This authorizes the additional fixture/build/protocol design seam, not the generated code, Test Contract, runtime execution, or product implementation. A separate Slice7 code/contract/criteria checkpoint follows independent verification. No earlier checkpoint answer is inferred.

The quoted design line numbers belong to the original question before S7 integration. The approved seam preserves all locked S1-S6 source behavior. The fixture is test-owned, separate and inert in the package, with no default harness registration or renderer API.

### Slice 7 independent verification and approval

Independent slice-verifier session `ses_f8ebd9669ffeq3huz70LZ2u4gd` identified seven initial gaps that were corrected before approval: shared first-fault propagation and post-await boundary admission; enclosing drain/signal and exit-timestamp takeover deadlines; exact diagnostic messages; exact external success/safe-failure output grammar; one collaborating runtime Project101 identity owner with prior-value characterization; corrected test inventory/discovery path and public fixture-testing seam; and direct production MessagePort remote-close observation. The subsequent R1 finding was corrected by retaining bounded frozen secondary cleanup metadata in failed runner outcomes without replacing/rebroadcasting the first fault or changing actual exit/EOF-based cleanup authority.

The main-agent sandbox review also removed the proposed copy-based isolation before approval. The original same-volume sibling rename and CI's root-owned mode4755 chrome-sandbox preparation remain unchanged; no sandbox weakening or new root/sudo workaround was accepted. Final static review reported no remaining concrete finding:

- Decisions: OK
- Cross-slice: OK
- Research: WARNING: all compiler, pinned-driver/SAVEPOINT/connection, runtime, typecheck, native, and Windows/Linux package proof remain mandatory and unexecuted.

This is static design verification only, not code execution, test completion, native signal/EOF proof, benchmark, or bytewise historical-preservation certification. The complete S7 Test Contract and Automated/Manual Verification criteria above remain unchecked implementation obligations. The independent native/full-row audit is not satisfied by a scripted success response; the live stale proof is separate from stale-activation rejection and keeps stale Writer.close refused.

**Question:** Approve and lock Slice 7/7: Packaged Cross-Process Proof, including the reviewed code, full Test Contract, and verification criteria in the two linked candidates? It covers nine code/tooling files plus fixtures/tests, independent packaged utility processes, a separate live stale-Writer fixture, exact durable audit, and retained cleanup ownership. Static Decisions/Cross-slice checks are OK; all compiler, driver, runtime, and Windows/Linux proof remain mandatory and unexecuted. Approval finalizes the design only, not product implementation.

**Answer:** Approve (Recommended)

The separately approved code, complete contract, and criteria are incorporated into this canonical design under Step6.4. S7 is approved and locked; no product implementation is authorized and no gate is waived. The document remains `status: in-progress` because final completeness/lint/stamp handling is pending, separately from the user's design approval. No validation command, build, test, lint, or stamp was run during integration; automatic write hooks reported Node executable unavailable and skipped their checks rather than passing them.

Integration self-review used read-only file inspection and text searches, not executable validation. The document has49 distinct file Architecture headings, including the nine S7 code/tooling targets; the two new source files and Forge each occur once in Architecture and File Map. No empty fence, duplicated default Vite config, copied tool-output truncation marker, temporary-candidate path, or candidate handoff scaffold was found. The merged protocol index preserves its earlier exports, and Vite retains the full approved S3 collector. S7 contains all14 Behavior/Test/Oracle/Expected-red sections, the complete secondary cleanup oracle and TDD exemptions,14 unchecked Automated criteria, and5 unchecked Manual criteria. MODIFY excerpts remain explicitly scoped, with one coherent fence per file rather than a fictitious full main/tooling implementation. Edits did not target S1-S6 Files, Test Contracts, criteria, Decisions, or history; no byte-for-byte preservation certification is claimed without an actual baseline comparison. Final artifact completeness/lint/stamp and implementation proof remain pending.

## Design History

- Slice 1: Correlated Request Failure - approved as generated; added the protocol index export to the slice and expanded every Test Contract UUID after verifier review
- Slice 2: Canonical Generation 2 - approved after adding integer storage-class constraints, exact column-definition verification, the complete affected-file contract, and migration/no-mutation proof
- Slice 3: Exclusive Activation - approved and locked after restoring the Slice 2 Architecture foundation and resolving independent review findings; code, Test Contract, and verification criteria approved, with implementation proof still pending
- Slice 4: Safe Project Switching - approved and locked after source-qualified FIFO switching, immediate admission closure, retained-epoch release retries, target-failure isolation, and independent Decisions/Cross-slice/Research review; implementation proof remains pending
- Slice 5: Atomic Typed Settlement - approved and locked after static Decisions/Cross-slice OK and the separate code/Test Contract/verification-criteria checkpoint; Research WARNING for mandatory unexecuted pinned-driver SAVEPOINT/connection compatibility and implementation proof retained
- Slice 6: Uncertain Commit Recovery - approved and locked after classified transaction failures, explicit durable uncertainty-before-release, atomic receipt reconciliation, independent Decisions/Cross-slice OK, and the separate user code/Test Contract/criteria checkpoint; Research warning remains for mandatory unexecuted driver/runtime/boundary proof; explicit journaling/crash-gap contract separately approved; no product implementation authorized or gate waived
- Slice 7: Packaged Cross-Process Proof - approved and locked after independent static verification, corrected proof ownership/output/deadlines/test seams, bounded secondary cleanup metadata, preserved rename-based sandbox isolation, and the separate code/Test Contract/criteria checkpoint; Research WARNING and all implementation/runtime gates remain mandatory and unexecuted; final document completeness/lint pending

## References

- `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md`
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`
- `.rpiv/decisions/shared-vocab-union.md`
- `docs/adr/0004-canonical-board-index.md`
- `docs/adr/0006-physical-persistence-layout.md`
- `PRODUCT.md`
- `CONTEXT.md`
- [GitHub issue #90](https://github.com/TheMastermindPT/slopstop/issues/90)
- [fs-native-extensions](https://github.com/holepunchto/fs-native-extensions)
- [Microsoft LockFileEx](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex)
- [Linux fcntl locking](https://man7.org/linux/man-pages/man2/fcntl_locking.2.html)
- [libSQL TypeScript transactions](https://tursodatabase.github.io/libsql-client-ts/interfaces/Transaction.html)
- [libSQL local sqlite3 transaction implementation](https://github.com/tursodatabase/libsql-client-ts/blob/main/packages/libsql-client/src/sqlite3.ts)
- [SQLite savepoints](https://www.sqlite.org/lang_savepoint.html)
- [SQLite transactions](https://www.sqlite.org/lang_transaction.html)
- [Electron Forge Auto Unpack Natives](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [Electron ASAR archives](https://www.electronjs.org/docs/latest/tutorial/asar-archives)
- [Electron v43.4.0 UtilityProcess API](https://github.com/electron/electron/blob/v43.4.0/docs/api/utility-process.md)
- [Electron v43.4.0 ASAR archives](https://github.com/electron/electron/blob/v43.4.0/docs/tutorial/asar-archives.md)
- [fs-native-extensions v1.5.1 package metadata](https://github.com/holepunchto/fs-native-extensions/blob/v1.5.1/package.json)
- [fs-native-extensions v1.5.1 binding loader](https://github.com/holepunchto/fs-native-extensions/blob/v1.5.1/binding.js)
- [fs-native-extensions v1.5.1 JavaScript API](https://github.com/holepunchto/fs-native-extensions/blob/v1.5.1/index.js)
- [fs-native-extensions v1.5.1 shared C lock handling](https://github.com/holepunchto/fs-native-extensions/blob/v1.5.1/src/shared.c)
- [fs-native-extensions v1.5.1 native build definition](https://github.com/holepunchto/fs-native-extensions/blob/v1.5.1/CMakeLists.txt)
- [Published fs-native-extensions v1.5.1 prebuild metadata and SHA-256 values](https://unpkg.com/fs-native-extensions@1.5.1/?meta)
- [Microsoft UnlockFileEx and lock lifetime](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-unlockfileex)
- [Linux process exit and descriptor lifetime](https://man7.org/linux/man-pages/man2/_exit.2.html)

## Follow-up: 2026-09-05T16:24:18+0100

- User authorized executing this design's seven slices directly on `feat/canonical-project-writer`, then approved the narrow Slice 1 sequencing correction through `rpiv-revise`.
- Corrected execution order to 6 -> 2 -> 3 -> 1 -> 4 -> 5 and aligned Expected Red descriptions with the live parser, runtime, and bridge paths. All six exact Oracles, named tests, final architecture, and Slices 2-7 remain unchanged.
- Grounding: `apps/desktop/src/main/harness-session.ts:38-45` validates events before delivery; `apps/desktop/src/main/harness-supervisor.ts:176-207` has no default recovery branch for valid unhandled events; `packages/protocol/src/protocol.ts:348-359,423-432` validates factory output; `apps/desktop/src/main/workspace-bridge.ts:215-233` ignores valid unhandled request failure.
- The preflight pause recorded below remains historical evidence, not a runtime failure or implementation result. The original design content hash predates this authorized revision and the implement evidence; it is not a checksum of the revised execution artifact.

## Follow-up: 2026-09-05T17:33:04+0100

- The user selected Update plan and explicitly approved Proceed with the closed-whitelist S2 proposal and implementation of only Slice 2. S1's separate independent review is complete with no actionable findings. Preserve all S1 work and the initial untracked handoff; no commit or merge is authorized.
- The original five named tests and complete Oracle values are preserved above. Their prior standalone creation, constraints, and legacy-opening behavior labels are now one shared schema behavior, not three fabricated serial Reds. Numeric and column behavior remain separate; the loader receives its own serial contract.
- Added the loader and frozen test-only generated successor to the S2 inventory, Architecture, and File Map. The reviewed successor contains 30 statements with one contiguous terminal six-statement rebuild. Its existing-normalizer vector hash is `e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14`; the immutable predecessor raw hash is `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`. No current regeneration may silently redefine either pin.
- Corrected the quoted `notNull` SQL alias and expected built-in metadata types to actual `TEXT`/`INTEGER`. Read-only Node SQLite and libSQL probes established the prior syntax/type mismatch. The historical fixture is explicitly built from original SQL and original metadata/identity/manifest before its immutability window.
- Approved execution order is numeric -> column -> loader -> shared schema, with Red/Green and a separate review/refactor gate at every step. The three shared schema tests must all run before shared production changes. Root test discovery excludes integration, so explicit integration and existing generator-tooling commands are now listed.
- This revision leaves S3-S7 content and prior TDD Evidence unchanged. Cumulative Architecture still includes later-slice deltas; S2 does not implement the Writer lease path or explicitly S5-only receipt/event identity exports. The original design content hash is historical, not a checksum of this revised execution artifact.

## Follow-up: 2026-09-05T19:37:31+0100

- The user approved Update plan and explicit Proceed for the complete S3 proposal, then authorized only S3 implementation. Parent reports S2 independent review passed with 152 tests, typechecks and no findings. This does not claim S3 independent review or Linux execution.
- Preserve the pre-S3 artifact at Git blob b2ac8f41db74abc7e8a7cf3bd4a832d696c34c1a for exact original Oracle/history comparison. Added explicit execution groups, B16 provenance correction, late-slot characterization, precise UTC equality, before-begin configuration ownership/proof, raw-schema diagnostic surface, exact fixture migrations and local platform alternative. Original 18 Test/Oracle blocks and all prior implementation evidence are unchanged.
- Only common S3-owned Architecture release/time defects and transaction ownership annotations change. No S4 switching, S5 settlement/registry, S6 uncertainty module, S7 fixture, schema/migration mutation or future Code Health claim is authorized. Windows execution and evidence belong to this implementer; Linux preparation/proof belong to the parent and separate agent.
- Frontmatter records this approved revision. The old content_hash is historical and intentionally not restamped while implementation/evidence remain pending.

## Follow-up: 2026-09-07T11:29:26+0100

- The user approved Update plan and explicit Proceed for this precise S4 revision and only S4 implementation in the current `C:/Users/pedro/Documents/GitHub/slopstop` working tree on `feat/canonical-project-writer`. Direct design execution is authorized; no plan-directory mismatch or new worktree is required. S3 is now fully accepted after independent F1/F2 correction/re-review and final Windows/Linux 141-unit/29-integration, build and isolated-native proof. Preserve the corrected S3 Storage/repository source and retained Linux evidence; no S4 Linux proof is required.
- The pre-S4 artifact is Git blob `a076068ab6cae674d5ee14463502c9b0bdfaa7cb`. All 21 S4 names and complete Oracle blocks remain verbatim, as do S1-S3 evidence and S5-S7 contracts/history. This append supplies the approved execution interpretation, not a new architecture or replacement oracle. The historical `content_hash` is not restamped while execution/evidence are pending. Existing design approval remains recorded; S4 candidate proof and independent implementation review remain required.

### Approved S4 Execution Notes

- Execute exactly four groups, in order: protocol (B1-B3), coordinator (B4-B18), application (B19), runtime (B20-B21 plus the runtime portions of B5/B19). These labels refer to the 21 existing S4 behaviors in document order and preserve their identities. Each group gets observed Red, minimal Green, and a separate review/refactor gate before the next group. Author and run every assigned complete oracle check before that group's shared source implementation. Record individual Red versus already-Green results honestly; these are four approved shared-implementation groups, not 21 independent serial Reds.
- Missing imports, compilation errors, setup failures and timeouts are not Red. Raw protocol envelopes and existing activate/stop same-turn admission and release-clock behavior can expose genuine runtime assertion failures. A guarded absent public-method assertion in a successfully loaded module may establish missing capability, but never replaces the complete exact oracle. Existing lower-level cleanup, failed-acquisition cleanup-clock retention, single cleanup attempt, real Writer verification normalization and stop sharing remain honest already-Green regressions where applicable. Never deliberately introduce a regression to manufacture Red.
- Permit only these three constant diagnostic migrations and corresponding exact-string expectation migrations in existing S3 tests: `Canonical Writer fence verification failed.` -> `The active Writer fence could not be verified.`; `Canonical command settlement is not available.` -> `Typed-command settlement is not available in this release slice.`; `Canonical Writer fence activation failed.` -> `Writer fence could not be activated.`. Apply the S4 coordinator-owned result wording without changing unchanged repository/Writer owners or forwarding raw owner error messages. All other S3 assertions and outcomes remain unchanged.
- B2/B19 flipped-boolean rejection applies to the new switch-owned specified diagnostic branches and the already-fixed read-only activation literal. Other nested activation failure booleans keep the existing S3 activation union's acceptance of both values. Do not silently tighten that nested union or reinterpret exact coordinator-produced target outcomes as a universal nested-schema boolean constraint.
- B6's true synchronous-throw case throws immediately from the public repository verification call while another already-admitted check remains held. The separate two-held-promise matrix proves asynchronous current/stale success and rejection drainage. A throw after awaiting a deferred promise is asynchronous rejection and cannot be labelled synchronous-throw proof. Use the real Writer; do not invent a private rejecting Writer factory or replace its normalization.
- Required `switchProject` fixture-method migrations are compile-time wiring in the existing nine S4 test/fixture files, not new product behavior. Unused canonical stubs throw `Error("Unexpected canonical Project switch in this fixture.")`; preserve their activate/execute/stop behavior. No optional method, compatibility branch or fallback application is permitted. Existing real coordinator instances receive the real method rather than a switching mock.
- Production scope remains the six S4 files listed above: canonical protocol, protocol envelopes/factories, protocol exports, coordinator, canonical application and runtime. Reuse the inner activation path without recursively acquiring the FIFO lock. Close command admission synchronously at lifecycle enqueue; count every pending FIFO operation and release its count in finally, including rejections. Revalidate source Project/epoch inside the lock, retain actual active versus null failed-acquisition epochs, fully release A before B, and treat A-to-A as fresh activation. No B outcome restores A. Release-clock failure retains the original owned state, including executable active A; preserve the existing single failed-acquisition cleanup attempt. Existing lower-level staged owners and runtime cached-stop policy remain unchanged.
- Keep S3 `verifyFence` and `COMMAND_SETTLEMENT_UNAVAILABLE`; do not copy cumulative S5 settle/registry/busy/JSON or S6 recovery code. S1 generic request-failure containment stays fixed. No new package/dependency, install, build/native/package proof, migration generation, global deep/mutation gate, commit, staging, push or merge is authorized. Use the locked five-unit-file, six-explicit-integration-file, three-typecheck and architecture scope; appropriate bounded lint, boundaries and regressions remain permitted. Code Health baseline precedes source writes; final authored analyzable files require at least 9.0 and no new smells, targeting 10. Unsupported export-only files remain not assessed. Independent S4 implementation review remains with the parent.

## Follow-up: 2026-09-07T14:27:53+0100

### S4 Transport-Dependent Oracle Scheduling

- The user approved this narrowly scoped execution-order correction after current-source preflight. It supersedes only the behavior-to-group allocation in the 2026-09-07T11:29:26+0100 follow-up. No behavior, public seam, exact input, expected output, named test, privacy rule, source inventory, verification command, or final S4 acceptance obligation changes.
- Group S4-G1 remains protocol B1-B3. Its observed Red/Green and self-review evidence under contract identity `37f0fdf9932ae241c0bf21dec1d39ec53d980995fbc8829a83c8d356ded40458` stays historical and valid for those unchanged behaviors; it is not independent S4 review or human candidate acceptance.
- Group S4-G2 is coordinator B4-B7, B9-B14, and B16-B18, with B5's coordinator portion. Group S4-G3 is application B19's application portion. Group S4-G4 is B8, B15, B20-B21, and the runtime portions of B5/B19. B8 and B15 move in full from the previous coordinator group to S4-G4; their public coordinator/application observations run there as part of the complete original oracles. B5/B19 retain their previously approved seam-specific allocation. Every named behavior and every original Oracle clause is accounted for exactly once as new proof or honestly recorded already-Green regression within its assigned group/portion.
- Each group still authors and runs all its assigned complete oracles or explicitly assigned seam portions before its shared behavior implementation, records genuine Expected Red rather than setup/import/timeout failure, implements minimally to Green, then enters separate review/refactor before the next group. A later group's already-Green lower-layer observation receives no fabricated Red. No source is implemented early solely to make a preceding group's transport test pass.
- Grounding: B8 explicitly requires `project.switch` over real MessagePorts and runtime shutdown; B15 requires both original coordinator/application exception identity and runtime-only sanitized failure. Current runtime `harness-runtime.ts:57-67,143-172` accepts the new protocol envelope but has no switch dispatch, so it emits no event. `canonical-project-application.ts:13-17,40-53` still has no switch method. Coordinator-only implementation cannot satisfy those full transport oracles. This is a static dependency finding, not an observed behavioral Red.
- Accepted S1-S3 and their original integration target remain unchanged. The current S4 protocol candidate was frozen before this revision at `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s4-protocol-20260907/manifest.json`, SHA-256 `b6f2e01c6643325cad14197feef404f61e1de0af0c9bc17f6212894426d9b74a`, with full patch SHA-256 `ca8a1f84f62df6ca81c89b227e7517e785f82eccf7aea203e81a72a42b73cf5c`. New contract identity and independent intent review are recorded in the linked execution evidence. Prior intent review of the changed scheduling is superseded; renewed intent review and exact-contract approval are required before S4-G2. No S4 candidate acceptance has occurred.
- S5-S7 remain deferred. The known future S6 diagnostic and Expected Red preflight questions do not widen S4. No code, fixture, dependency, runtime retry policy, native proof, migration, staging, commit, push, merge, or global configuration change is part of this revision.

## Follow-up: 2026-09-07T18:31:14+0100

### S5 Revision Authority And Preservation

- The user authorized document-only S5 contract reconciliation, followed by independent intent review and exact-contract human approval before any S5 source or test authoring/execution. This follow-up is proposed intent, not implementation approval, observed Red/Green, candidate acceptance, or integration consent. The current workspace remains `C:/Users/pedro/Documents/GitHub/slopstop`, branch `feat/canonical-project-writer`; original target is `main` at `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`.
- Accepted S4 is the uncommitted snapshot manifest `49bb455e50145cc0bf06206dfef843e830849138bca1be3634a71c9ec27604ce`, not HEAD. Its frozen raw design SHA-256 is separately `7d42003d238dd994188137d47f0e5ba2123de482a3fc54c8de85349486a23508`. The current design deliberately differs only by this document revision; neither accepted pin is replaced. External acceptance remains at `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s4-review-20260907.md`, heading `Human Acceptance: 2026-09-07T18:11:02+0100`.
- This append supersedes only conflicting S5 execution scheduling, baseline-relative Expected Red claims, and the narrow fixture inventory interpretation below. Every original S1-S7 section, exact S5 Oracle and named test/location, pinned value, exclusion, prior follow-up and evidence remains verbatim. No S6/S7 behavior is reopened. Historical S5 design approvals do not approve this correction: renewed independent intent reviews and human approval of the new bound S5 contract are pending.
- Original S5 section SHA-256 before revision is `f62fa2b8cb281aefbb00e54ebcce69499e41a89079ef7cd9a2fb6fcadfd2739b`; Decisions is `07d84892f9ba33f34c550a6c0256d17435376c3bbe690e0053616b28f8f63883`. Both raw and normalized-LF hashes agree and must remain unchanged. The append-only S5 evidence record linked below owns the new contract binding recipe, measured identity and review status; frontmatter and evidence are excluded from that contract identity.

### S5 Stable Behavior And Seam Map

There are exactly 29 original Behavior blocks. Assign `S5.B1` through `S5.B29` in their original document order; suffixes identify scenario/public-seam checks, not new behaviors or replacement oracles. Preserve the exact named family and its original test locations; append seam/scenario labels where a family needs multiple runnable cases. `J` = canonical JSON, `P` = protocol parse/envelope, `G` = registry, `R` = public repository (unit and real-worker integration remain distinct), `W` = Writer, `C` = coordinator, `A` = application, `T` = real MessagePort pipeline, `D` = worker driver, `B` = actual bootstrap. Additional composed portions use the already-listed settlement/runtime integration files, not new test files or private seams.

| Stable ID | Exact Original Named Test | Public Checks |
| --- | --- | --- |
| S5.B1 | `characterizes real worker savepoint rollback release and outer commit` | D |
| S5.B2 | `canonicalizes submitted command content without changing its meaning` | J bytes/hash; R persistence, replay and conflict |
| S5.B3 | `preserves finite JSON edge values without prototype assignment` | J direct values; P preservation and envelope rejection |
| S5.B4 | `freezes submission meaning before asynchronous repository work` | J snapshot; A same-stack request capture through real composition; R output-copy persistence through composition |
| S5.B5 | `binds typed payload definitions and rejects duplicate registrations` | G construction, schema-only inference/type probes, preparation and runtime capability |
| S5.B6 | `persists applied counter state receipt original pointer and ordered events atomically` | R exact receipt/rows; T correlated result/rows |
| S5.B7 | `rolls back unchanged handler writes and persists only settlement` | R |
| S5.B8 | `rolls back rejected handler writes and hashes safe rejection metadata` | R decision validation, rollback and rejection rows |
| S5.B9 | `durably rejects unsupported definitions and invalid handler payloads` | R durable decisions/retry precedence; P/C admission; T composition |
| S5.B10 | `replays exact receipts across repository and activation replacement` | R replacement/replay; C epoch admission; T reactivation |
| S5.B11 | `persists distinct conflicts without changing original command authority` | R |
| S5.B12 | `joins exact simultaneous commands and rejects distinct work as busy` | W promise identity/slot; C completion tracking; T one transaction/handler and no backlog |
| S5.B13 | `allocates one safe Project sequence per first settlement and replays at the bound` | R sequence/bound/corruption; W/C busy/stale exclusions in composition |
| S5.B14 | `fences settlement before mutations and distinguishes malformed authority` | R transactional fence/direct-call rejection; W stale mapping/blocking |
| S5.B15 | `fails closed on broken original idempotency authority` | R unit/decorated-result and actual-row proof |
| S5.B16 | `rejects corrupted replay children and conflicting receipts` | R unit/decorated-result and actual-row proof |
| S5.B17 | `rolls back known settlement body faults at every mutation stage` | R exact rollback; W blocking; T causation-scoped failure |
| S5.B18 | `revokes handler capabilities and observes swallowed or unawaited SQL failure` | R revocation/drain/output copy/rollback; T privacy/resource order |
| S5.B19 | `blocks a Writer after settlement error without guessing commit outcome` | W sentinel/blocking; A propagation; T joined failures and uncertain commit observations |
| S5.B20 | `drains settlement before retryable Writer release and retains failed transaction close` | R retained transaction; W closing/drain/retry; T full release order |
| S5.B21 | `configures every canonical write connection and retains unfinished ownership` | R configuration/ownership; D detached connections; W failure consequence |
| S5.B22 | `switches only after the admitted settlement and joins complete` | C FIFO/barrier/drain; T real switching and explicit retry |
| S5.B23 | `validates settled receipts and new non-durable result branches` | P receipt/result/envelope; A original-request binding |
| S5.B24 | `requires seconds in settlement clocks and persisted receipt instants` | P time; R input-clock/rollback/replay; W/T failure consequence |
| S5.B25 | `rejects nil and max aggregate identities in handler events and replay rows` | G event input; R post-write failure and replay |
| S5.B26 | `round-trips durable settlement and replay over real MessagePorts` | T exact four-event journey |
| S5.B27 | `durably rejects commands with the production empty registry` | T manually composed real production Storage and empty registry |
| S5.B28 | `isolates settlement failure from unrelated pending requests` | A invalid-result variant; T settlement failure and runtime isolation |
| S5.B29 | `settles an unsupported command through the bootstrap-composed empty registry` | B real bootstrap dependencies, transport and actual rows |

### S5 Baseline And Fixture Correction

- Accepted `storage/canonical-command-repository.ts:120-135,335-353,394-416` already configures each write transaction through `configuredClient`, setting foreign keys/busy timeout and verifying foreign keys before BEGIN. B21's initial-connection-only Expected Red premise is superseded. Existing configuration, valid/failing observations already rejected, direct `verifyFence`, lifecycle barriers, and runtime failure isolation are characterization where already supported, not fabricated new Reds. B21 still requires every exact settlement/retry/release connection oracle, duplicate-alias/row-width rejection, concurrent ownership and retained-close proof; identify and observe the missing behavior at its actual seam before changing it.
- Add `apps/harness/tests/integration/project-storage-create-fixture.ts` and `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts` to the S5 MODIFY test/fixture inventory. The shared file contains canonical switch repositories/journeys as well as Storage-only helpers (`switchProjectPorts`/`switchFixture` at lines 560/624); the lifecycle file's `switches activation ownership without closing ordinary Storage sessions` at line 985 consumes them and asserts the obsolete healthy command result/verification call. This is a narrow canonical-only migration, not permission to rewrite unrelated Storage tests.
- Keep Storage-only activate/execute/switch throwing stubs, required `switchProject`, Workspace behavior, real Storage owner and independently retained ordinary versus activation sessions unchanged in meaning. Preserve exact lifecycle/source/epoch/release ordering and independent close counts. Replace only canonical healthy command/fence-check observations with declared real registered settlement or durable unsupported and independent row proof. Ordinary `project.open`/`project.close` must not close the activation session, and switching must not close ordinary sessions. Do not substitute canned healthy receipts or a shared fake session to make those journeys pass.
- Adapt canonical shared consumers to the two already-declared new fixture modules; new counter DDL, definitions, settlement holds and SQL decorators remain there. Verify real generation-2 schema before extending the fixture database; afterward use its explicit Storage activation port, never the production exact-schema opener on an extended database. B27/B29 keep unextended production databases and the real Storage owner/opener. Lifecycle-only repository literals receive required explicitly throwing unexpected-settlement methods; settled diagnostics are narrowed. No optional/backcompat fallback or production test registration is permitted.

### S5 Bounded Execution Order

These are ordered scheduling envelopes, not shared implementation batches or new slices. After exact-contract approval, B1 remains the first executable driver-only gate with its unchanged command and stop-on-failure rule; author it without any S5 production import. Thereafter execute one runnable bounded scenario (or one coherent parameterized scenario) Red -> minimal Green -> separate review/refactor per loop. The complete original Oracle paragraphs remain the sole exact expectations, including all adverse variants; the table only assigns their portions and prerequisites.

| Order | Envelope | Checks And Prerequisites |
| --- | --- | --- |
| G0 | Driver/baseline | B1.D first; existing configuration/fence/lifecycle/runtime characterizations. Prepared production schema precedes fixture extension. |
| G1 | Submitted JSON | B3.P/J, B2.J, B4.J; separate parser preservation from direct serializer/snapshot checks. |
| G2 | Receipt contract | B23.P, B24.P; only necessary type/export scaffolding, no repository settlement prerequisite. |
| G3 | Registry | B5.G, B25.G; type probes and runtime capability/preparation remain distinct checks. |
| G4 | Transaction ownership | B21.R, B20.R activation/release ownership portions; existing configuration is preserved. Settlement portions follow their enabling path. |
| G5 | First applied | B14.R then B6.R including zero events; attach B17 mutation-stage faults, B24.R input clocks, B25.R handler events and B4/B18 output-copy checks before their respective enabling changes. |
| G6 | Original applied replay | B10.R applied, B2.R reordering, B15.R original authority, B16.R applied children, B24.R replay time, B25.R replay IDs; valid lookup and each validation family use separate loops. |
| G7 | Unchanged | B7.R, B10.R unchanged, B16.R unchanged children; B18 held issued-SQL drain and B17 savepoint rollback/release faults accompany the relevant savepoint changes. |
| G8 | Rejected | B8.R, B10.R rejected, B16.R rejection children and B17 rejection-insert faults; retain both retryability values and every malformed decision case. |
| G9 | Conflicts | B11.R, B2.R changed-content/default/transform distinctions, B16.R conflict validation; original pointer and replacement/replay are retained. |
| G10 | Durable admission rejection | B9.R; conflict support already exists for corrected same-ID input, and original replay precedes definition/schema changes. |
| G11 | Bounds/remaining faults | B13.R; complete B17/B18 cases not yet exercised. Already-enabled safeguards use their earlier exact causal proof, not later absence-based Reds. |
| G12 | Writer | Forwarding/B14.W, then B12.W, B19.W, B20.W in separate loops; B17.W/B21.W consequences accompany the relevant change. |
| G13 | Application | B23.A, B4.A and B19.A; adversarial typed public-port results prove validation/propagation, never replace real healthy journey proof. |
| G14 | Coordinator/composition | B6.T, B9.P/C/T, B10.C/T, B12.C/T, B13 composed exclusions, B22.C/T, B26.T, B27.T; separate routing, join/busy tracking and lifecycle drainage loops. Migrate canonical activation/switch/ordinary-session consumers here. |
| G15 | Failure composition | Complete B4 composed mutation, B17.T, B18.T, B19.T, B20.T, B21 settlement configuration/consequence, B24.W/T and B28.A/T checks using their earlier enabling-change proof where applicable. |
| G16 | Bootstrap | B29.B real factory/transport/rows; its first behavioral observation must precede any earlier bootstrap wiring that can satisfy it, not wait for this final-composition envelope. |
| G17 | Final scope | Every existing S5 automated/manual gate plus the narrow fixture delta; no global/deep/build/package/install/mutation/native-crash or S6/S7 expansion. |

- Before a change can satisfy multiple necessary shared-behavior checks, author and observe those runnable checks individually at their public seams before that enabling change; do not gather the entire slice into one all-tests Red/implementation batch. Move only prerequisite-ready observations earlier. Attach each Red to its exact scenario, seam, pre-change identity and enabling change. No repository stage may demand absent application/runtime settlement to reach Green.
- Later composition checks still run every original assertion at their own real seam. They may link exact earlier lower-seam causal Red/Green proof for the same behavior plus current composed Green, never claim the lower seam alone proves runtime wiring, invent a later absent-feature Red, or waive new behavior. Any genuinely new composition behavior gets its own observed Red before implementation. If unexpectedly Green with no earlier relevant Red, stop and reconcile the proof/contract before proceeding; never deliberately regress production or call missing evidence exempt.
- Use minimal compilable public-interface scaffolding only when needed to reach behavioral Red: contract-valid unsatisfied typed results where available, otherwise an explicit unimplemented throw. Missing imports, type/setup failures, timeouts and private-state/raw-source assertions are not behavioral Red. Type-only brands/exports and required dependency/member wiring with no behavior are separately recorded wiring work, not settlement proof. Actual bootstrap registry/factory/clock/ID routing may enable B29: observe its real unsupported-settlement oracle before that change, even if signatures force wiring earlier. No fake healthy receipt, widened temporary result union, optional dependency or test-handler bootstrap fallback is allowed.
- Preserve all exact B29 constraints, including real `startHarnessProcessRuntime`, no substituted application/registry/repository/clock/identity generators, only its explicitly allowed generated receipt/time values, actual returned activation, fingerprint/row/retry/causation proof and awaited stop. B27 is not a substitute. Keep all B17/B19 distinctions between known-body rollback and commit/timeout/close-after-commit uncertainty, every validation/corruption exclusion, all B1 compatibility limits and every separate repository/Writer/application/runtime check unchanged.
- Existing Automated Verification and Manual Verification remain binding and unchecked here. The lifecycle integration file already belongs to the final Storage regression command; retain the command while classifying only its canonical consumer as migrated rather than claiming the entire file unchanged. No original oracle is displaced by a scheduling summary. Complete Architecture and File Map are bound as cumulative projections, not live source or permission to implement later-slice deltas. Current source and this narrowly scoped execution correction govern baseline attribution; broader projection conflicts require reconciliation, not silent implementation.

## Follow-up: 2026-09-07T19:24:49+0100

### S5 Applied Intent Corrections

- The user explicitly chose `Apply all` for F1, F2 and F3 in the separate S5 evidence's `Plan Review (S5 Execution Correction)`. This authorizes this document-only correction, not the resulting contract hash, dependency reconciliation, source/tests, or implementation. Required fresh independent intent reviews and human exact-contract approval remain pending; the document stays `in-review`. No reviewer is dispatched by this author.
- Preserve the complete original S1-S7 sections/oracles, earlier follow-up `2026-09-07T18:31:14+0100`, failed intent review and v1 packet verbatim. This append supersedes only the three conflicting provisions below, including their cumulative Architecture/File Map projections; all other boundaries, exact expectations, evidence obligations, B1 driver gate, B29 pre-wiring observation and bounded red-green/review loops remain binding. Accepted S4 snapshot/design and original main target remain unchanged.

### F1: Declared Kernel Dependency Prerequisite

- Extend the future S5 MODIFY inventory to `apps/harness/package.json` and `pnpm-lock.yaml` solely to declare the harness dependency `@slopstop/kernel` as `workspace:*` and reconcile that workspace link/importer. This narrowly supersedes the original S5 manifest/install exclusions and the prior follow-up's corresponding exclusions. It permits reuse of the existing kernel `isDomainIdentity` through its declared package export; no copied identity regex, deep import or protocol re-export workaround.
- Only after exact revised-contract approval and applicable build authorization, permit bounded pnpm install/link reconciliation for this existing workspace dependency. No version upgrades, external dependency additions, unrelated lockfile/importer changes, persistent package-manager configuration, or incidental native/build/package work is authorized. Inspect and stop/reconcile any resolution beyond that bounded delta rather than accepting broad lock churn. No manifest, lock or installed dependency changes happen during this document revision.
- B1 remains the first executable behavior gate, driver-only and using the already-pinned installed driver, with its unchanged stop-on-failure rule. The dependency prerequisite follows successful B1 and must finish before G3 registry/kernel-import work. Record it separately as dependency/type wiring, not behavioral Red/Green; missing package resolution is never B5/B25 Red. This does not authorize early bootstrap behavior: B29's exact observation still precedes any wiring that could satisfy it.

### F2: Full-Precision Settlement Fence Authority

- Supersede only the projected `Date.parse` equality at `readCanonicalWriterFence` (original Architecture lines 3923-3936). Compare validated complete UTC instants at full supplied fractional precision, normalizing only equivalent trailing fractional zeros (including omitted versus all-zero fraction), with no millisecond conversion, truncation or rounding. Reuse one shared owner carrying the accepted `normalizedUtc` semantics from `storage/canonical-command-repository.ts:109-117`; preserve S3 activation/direct-fence/release semantics and characterize them before/after any behavior-preserving extraction. Do not change prior validators or normalize stored/replayed receipt text.
- Extend S5.B14.R in its existing repository unit and real repository integration locations with the following independent binding cases before the enabling settlement-authority validation change in G5. For acquired/activated comparisons, test both active and released fence rows; for released/released comparisons, use coherent released rows with otherwise matching acquired/activated data. Keep Project/generation/token/shape valid and vary only the named pair, through real persisted rows where legal or the approved public SELECT-result decorator.

| Pair Values (Complete UTC Text) | AcquiredAt Versus ActivatedAt | ReleasedAt Versus GenerationReleasedAt |
| --- | --- | --- |
| `2026-09-05T12:00:00.123456Z` versus `2026-09-05T12:00:00.123457Z` | Unexpected failure for active or released authority, never current or stale | Unexpected failure, never stale |
| `2026-09-05T12:00:00.123456Z` versus `2026-09-05T12:00:00.1234560Z` | Equivalent binding; normal authority outcome | Equivalent binding; normal released-stale outcome |
| `2026-09-05T12:00:00Z` versus `2026-09-05T12:00:00.000Z` | Equivalent binding; normal authority outcome | Equivalent binding; normal released-stale outcome |

- Each differing-instant case fails unexpectedly before registry, handler, receipt/event ID or settlement-clock work, and preserves exact pre-call domain, state and ledger rows; no mutation is allowed. Retain the B14 Writer blocking and generic runtime failure consequences through their separately scheduled seams. Equivalent pairs preserve normal active/current settlement, well-formed authority-mismatch stale, and coherent released-stale behavior rather than making all authority fail. Keep the original B14 zero-row and every malformed-authority oracle unchanged. The new settlement comparison needs its own relevant Red before implementation; existing S3 precision support is characterization, not a fabricated Red. Any unexpectedly Green case without relevant earlier causal proof triggers the existing stop/reconcile rule.

### F3: Production Facade Proof At First Settlement

- Decompose only S5.B5's runtime own-key/context portion as `S5.B5.R` in G5, before creation of the real settlement-owned handler facade, alongside the first real handler settlement. Add `apps/harness/tests/integration/canonical-command-repository.integration.test.ts` as a permitted test location for that same original named family. Retain the registry test location and all B5.G inference, function-property NoInfer/type-capability, construction/duplicate-key, selection and preparation checks in G3 unchanged.
- Through the real worker repository and fixture-registered handler, capture the actual public handler argument and its actual transaction facade: facade own keys are exactly `["execute"]`; context has exactly `projectId`, `payload`, `transaction`, with no additional string/symbol keys, correct Project identity and schema-produced payload, and the same observed facade. Preserve the original absence of terminal/client/token capabilities and all type probes. No fixture-supplied pretend facade or registry-only execution can satisfy this runtime proof. It inspects the public handler argument, not private repository state.
- Author and observe this bounded B5.R case before the enabling real-facade change, using minimal unsatisfied typed scaffolding only if needed for a loaded behavioral Red. Its first settled result/independent rows must retain B6's real settlement proof. G3 never demands absent repository settlement to reach Green; later B18 revocation/drain checks remain separate, with relevant shared checks observed before their enabling changes. This seam correction changes no original B5 key/context oracle and creates no all-tests implementation batch.

- Contract binding v2 retains the prior packet's first 20 bindings in order, with only binding 6's end heading changed to this exact follow-up heading so its prior `32a8ede271c02690185ac25c6ce0e13b327899acf97cab17a1795fb9cfa235de` bytes/hash remain unchanged; append this correction section as binding 21, ending immediately before `## TDD Evidence (implement)`. All other bound sections/files remain identical. New measured contract/raw-document identities and triage dispositions belong in append-only S5 evidence. Failed prior review is preserved, not relabelled passing; fresh exact-input review and human approval are still required before any dependency/source/test execution.

## TDD Evidence (implement)

- S5 document reconciliation and pending intent-review/approval bindings: [separate append-only S5 evidence](../evidence/2026-09-07_canonical-project-writer-s5.md). No S5 behavioral execution is claimed.

### Phase 1: Correlated Request Failure

- Execution status (2026-09-05): paused during preflight under the explicit instruction to stop when sequential Expected Red is impossible. Direct design execution was authorized, but no contract revision or fabricated Red was authorized. No production or test file was edited; no Slice 1 criterion is checked off.
- Behavior 6 ordering mismatch: `apps/desktop/src/main/harness-session.ts:38-45` forwards every event accepted by `parseHarnessMessage`. `apps/desktop/src/main/harness-supervisor.ts:176-207` handles only `system.failure` and `system.ready` after its neutral-event guard, with no default failure branch. Once Behavior 1 admits `request.failure`, that event already falls through without changing status or killing the child. The subsequent null-caused system failure already follows the exact crash/quarantine path. Thus Behavior 1 intrinsically satisfies Behavior 6's oracle before its required Red; adding `request.failure` to the neutral set would be explicit documentation of existing behavior, not the change that makes this test pass.
- Behavior 2 ordering mismatch: `packages/protocol/src/protocol.ts:348-359,423-432` constructs existing failures through `HarnessMessageSchema.parse`. Behavior 1 requires correlated `system.failure` to fail validation. With the permitted temporary import alias to `createSystemFailureEvent`, the unchanged runtime call at `apps/harness/src/harness-runtime.ts:63-70,120-123` would throw during failure construction instead of emitting the correlated `system.failure` required by Behavior 2's Expected Red. Aliasing to `createRequestFailureEvent` instead would implement the requested routing before its Red. Neither an import failure, a schema-construction exception, a timeout, nor an already-green test counts as the specified Red.
- Behavior execution: no exact contract test was authored or executed. Red: not run. Green: not run. The blockers above are static control-flow findings, not claimed runtime test results.
- Runner probe: `pnpm exec vitest --version` exited successfully with `vitest/4.1.10 win32-x64 node-v24.19.0`. No shell workaround or repository configuration change was needed for this probe; test execution has not yet been verified.
- Command discovery adaptation: the root `vitest.config.ts` selects unit-test projects and does not select the integration config. In addition to the exact focused command in Slice 1, real MessagePort proof requires `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts`. Neither command was run during this paused preflight.
- Test-lint discovery: no `sgconfig.yml`/`sgconfig.yaml` or package script matching test-theater/test-lint was found; test-lint unavailable. Ordinary Biome lint was not run because no source or test files changed.
- Mutation discovery: no plan-scoped mutation command was found. Root `test:mutation` and the existing Project Storage-specific commands are not a Slice 1 plan-scoped runner; mutation was not run.
- Code Health: parent-supplied pre-change scores remain protocol/runtime/supervisor/both bridges 10; index is export-only and not assessable. Baseline/authentication were not repeated. No changed source requires a post-change review yet.
- Separate review/refactor, focused tests, all three typechecks, old-factory removal, and payload privacy review: pending. No completion, passing validation, or red-to-green proof is claimed.
- Resume requires the parent/user to reconcile the sequential contract conflicts explicitly. The six Test Contracts, existing design status/hash/history, all other slices, and the initially untracked handoff artifact were preserved. No commit, merge, or staging operation was performed.
- Artifact-write hooks reported `Node executable unavailable` and skipped `validate-on-write.mjs`, `fence-duplication-check.mjs`, and Impeccable. This is a hook-runner diagnostic, not passing artifact validation; the successful native Vitest version probe does not repair or validate those hooks.

#### Resumed Execution: 2026-09-05

The user approved the revision and explicitly instructed Proceed. This appended record completes Slice 1 in the approved order 6 -> 2 -> 3 -> 1 -> 4 -> 5; the preceding preflight entries remain historical. Each exact contract test was written, run Red for its revised expected reason, minimally implemented, run Green, then separately reviewed before the next behavior. No Red was batched with another behavior and no timeout/import error was counted as Red.

Baseline execution before source changes: `pnpm exec vitest run apps/desktop/src/main/harness-supervisor.test.ts` -> 1 file passed, 19 tests passed. The earlier successful version command remains `pnpm exec vitest --version` -> `vitest/4.1.10 win32-x64 node-v24.19.0`. Commands ran through the available Bash tool from the repository root using native Windows tooling, without a wrapper, shim repair, dependency installation, or configuration change.

#### Behavior 6: Supervisor Failure Scope

- Test: `keeps request failure status-neutral and reserves recovery for system failure` in `apps/desktop/src/main/harness-supervisor.test.ts`.
- Red: `pnpm exec vitest run apps/desktop/src/main/harness-supervisor.test.ts -t "keeps request failure status-neutral and reserves recovery for system failure"` -> 1 failed, 19 skipped. Raw request event input reached the actual session parser. Expected ready status; received `{ state: "crashed", attempt: 1, canRetry: true, diagnostic: { code: "HARNESS_PROTOCOL_ERROR", message: "Harness returned an invalid or incompatible protocol message." } }`.
- Green: `pnpm exec vitest run apps/desktop/src/main/harness-supervisor.test.ts -t "keeps request failure status-neutral and reserves recovery for system failure"` -> 1 passed, 19 skipped. Request event admission and explicit status-neutral classification landed under version 3; the system schema and old factory remained permissive for subsequent Reds. The exact ready/crashed objects and kill counts 0/1 pass.
- Separate review/refactor: reviewed session admission versus supervisor lifecycle; no further edit needed. `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/desktop/src/main/harness-supervisor.test.ts` -> 2 files passed, 33 tests passed.

#### Behavior 2: Real MessagePort Handler Failure

- Test: `round-trips a request handler failure without escalating the process` in `apps/harness/tests/integration/harness-runtime.integration.test.ts`.
- Red: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts -t "round-trips a request handler failure without escalating the process"` -> 1 failed, 4 skipped. Received the exact envelope's IDs, time, sequence, causation, and sanitized payload, but with `event: "system.failure"` and `protocolVersion: 3` instead of `request.failure` and 4.
- Green: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts -t "round-trips a request handler failure without escalating the process"` -> 1 passed, 4 skipped. Version 4 and conditional unexpected-handler failure routing landed; the parse-failure path was left unchanged. The full literal envelope and absence of `sensitive failure` pass over a real Node MessageChannel; both ports close in finally.
- Separate review/refactor: reviewed handler/null-causation selection and fixture cleanup; migrated only obsolete version assertions and existing handler-failure classifications. `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.test.ts apps/desktop/src/main/harness-supervisor.test.ts` -> 3 files passed, 45 tests passed. `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts` -> 1 file passed, 5 tests passed.

#### Behavior 3: Recoverable Parse Causation

- Test: `chooses failure scope from recoverable causation` in `apps/harness/src/harness-runtime.test.ts`.
- Red: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "chooses failure scope from recoverable causation"` -> 1 failed, 12 skipped. For request ID `00000000-0000-4000-8000-000000000202`, the received event was `system.failure` instead of `request.failure`; the version-4 metadata and `PROTOCOL_MESSAGE_INVALID` payload matched.
- Green: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "chooses failure scope from recoverable causation"` -> 1 passed, 12 skipped. Parse failures now use the shared causal selection. All three exact inputs use fresh runtimes and assert the full output envelope: malformed command, `{ invalid: true }`, and invalid notification `{ capability: "memory" }`. The latter two are preserved system-scope regression assertions, not fabricated additional Reds.
- Separate review/refactor: reviewed fresh sequence/ID allocation and notification validation; retained the existing unsupported-peer test with request classification. `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts` -> 1 file passed, 13 tests passed. `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts` -> 1 file passed, 5 tests passed. Final test-fixture Code Health refactoring is recorded below.

#### Behavior 1: Strict Version-4 Failure Matrix

- Test: `parses only correctly scoped failure events at protocol version 4` in `packages/protocol/src/protocol.test.ts`.
- Red: `pnpm exec vitest run packages/protocol/src/protocol.test.ts -t "parses only correctly scoped failure events at protocol version 4"` -> 1 failed, 13 skipped. Correlated `system.failure` with causation `00000000-0000-4000-8000-000000000102` returned `{ ok: true, value: ... }` instead of the required `PROTOCOL_MESSAGE_INVALID` error at `causationId`.
- Green: `pnpm exec vitest run packages/protocol/src/protocol.test.ts -t "parses only correctly scoped failure events at protocol version 4"` -> 1 passed, 13 skipped. Enforced null-only system causation, renamed the system schema, replaced the ambiguous factory with the explicit system factory, and migrated remaining global-failure fixtures. Both factories have narrow causation types; no compatibility alias remains. The full request/system matrix and exact version-3 unsupported envelope pass.
- Separate review/refactor: reviewed factory/schema correspondence and retained global-failure behavior. The original six-path focused command below -> 5 files passed, 80 tests passed at this stage; the explicit integration command -> 1 file passed, 5 tests passed. Dedicated searches found no old factory reference in any of the three required source trees.

#### Behavior 4: Project Storage Isolation

- Test: `request failure settles only its correlated Project Storage operation` in `apps/desktop/src/main/project-storage-bridge.test.ts`.
- Red: `pnpm exec vitest run apps/desktop/src/main/project-storage-bridge.test.ts -t "request failure settles only its correlated Project Storage operation"` -> 1 failed, 11 skipped. After one microtask, received `"pending"` rather than the exact broken create result. The test failed at the observable result assertion, not by timeout.
- Green: `pnpm exec vitest run apps/desktop/src/main/project-storage-bridge.test.ts -t "request failure settles only its correlated Project Storage operation"` -> 1 passed, 11 skipped. Only causation `00000000-0000-4000-8000-000000000301` is removed and failed; open `00000000-0000-4000-8000-000000000302` remains pending through the microtask, then resolves to the exact not-registered result.
- Separate review/refactor: reviewed delete-before-settlement and unknown-ID no-op behavior. The existing global system-failure message stays `Harness reported a failure.` to preserve the real privacy/redaction test, rather than applying the final-projection excerpt's unrelated global-message change. `pnpm exec vitest run apps/desktop/src/main/project-storage-bridge.test.ts` -> 1 file passed, 12 tests passed.

#### Behavior 5: Workspace Isolation

- Test: `request failure settles only its correlated Workspace request` in `apps/desktop/src/main/workspace-bridge.test.ts`.
- Red: `pnpm exec vitest run apps/desktop/src/main/workspace-bridge.test.ts -t "request failure settles only its correlated Workspace request"` -> 1 failed, 22 skipped. After one microtask, received `"pending"` rather than the exact broken Memory query result. No timeout was used as the Red oracle.
- Green: `pnpm exec vitest run apps/desktop/src/main/workspace-bridge.test.ts -t "request failure settles only its correlated Workspace request"` -> 1 passed, 22 skipped. Query `00000000-0000-4000-8000-000000000401` fails with the exact transport diagnostic; intent `00000000-0000-4000-8000-000000000402` remains pending through the microtask and subsequently resolves exactly to `{ status: "forwarded", capability: "memory" }`.
- Separate review/refactor: reviewed query/intent discriminant handling, identity removal, and unchanged global failure handling. Combined final tests below passed before and after the final fixture-only review/refactor.

#### Final Review And Code Health

- Separate source/test self-review completed after all six Green cycles. All exact Oracles were retained, factory output still validates through the protocol schema, and no later canonical Project command, storage, activation, or writer symbol was introduced. No independent-agent review is claimed.
- Detailed post-change CodeScene reviews returned score 10.0 and an empty review for `packages/protocol/src/protocol.ts`, `apps/harness/src/harness-runtime.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/project-storage-bridge.ts`, and `apps/desktop/src/main/workspace-bridge.ts`. Each remains 10 -> 10 against the parent-supplied baseline. `packages/protocol/src/index.ts` remains export-only/not assessed; its exports are checked by tests and TypeScript.
- The first repository-wide Code Health safeguard failed on the newly written Behavior 3 test only: Large Method (83 lines, threshold 70) and Bumpy Road Ahead (2 nested conditional blocks). Moved the literal case data out of the test body and replaced the nested missing-subscriber check with an explicit throwing fallback callback. No production behavior or Oracle changed.
- Refactor verification: `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts` -> 13 tests passed; detailed CodeScene review of that test file -> score 10.0, empty review. The final `codescene_pre_commit_code_health_safeguard` returned `quality_gates: "passed"`, `status: "no-issues-found"`, `checked-file-count: 12`, `code-health-eligible-file-count: 12`, and `results: []`. No rule or threshold was disabled.
- Payload privacy review passed: runtime failures contain only closed codes, fixed public messages, retryability, and validated message identity. Caught exception text is not used in outgoing payloads. Existing private-path rejection tests and the new real-port `sensitive failure` assertion pass. Desktop request failures forward that sanitized message; existing global redaction remains unchanged.

#### Final Automated Verification

- Exact focused command: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.test.ts` -> 5 files passed, 82 tests passed on the final formatted tree.
- Required command-discovery adaptation: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts` -> 1 file passed, 5 tests passed on the final formatted tree. The root config omits integration discovery despite the integration path in the original command; this additional execution proves the real MessagePort file. Total final focused proof: 87 passing tests in 6 files.
- `pnpm --filter @slopstop/protocol typecheck` -> passed (`tsc --noEmit -p tsconfig.json`).
- `pnpm --filter @slopstop/harness typecheck` -> passed (`tsc --noEmit -p tsconfig.json`).
- `pnpm --filter @slopstop/desktop typecheck` -> passed (`tsc --noEmit -p tsconfig.json`).
- `rg "createFailureEvent" packages/protocol/src apps/harness/src apps/desktop/src/main` -> no matches; independent dedicated searches also found none.
- `pnpm exec biome lint packages/protocol/src/protocol.ts packages/protocol/src/index.ts packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.ts apps/harness/src/harness-runtime.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/desktop/src/main/harness-supervisor.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.ts apps/desktop/src/main/workspace-bridge.test.ts` -> checked 12 files, no fixes applied.
- Formatting: `pnpm exec biome format --write packages/protocol/src/protocol.ts packages/protocol/src/index.ts packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.ts apps/harness/src/harness-runtime.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/desktop/src/main/harness-supervisor.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.ts apps/desktop/src/main/workspace-bridge.test.ts` -> formatted 12 files, fixed the two migrated factory-call fixtures.
- Final format/lint/import check: `pnpm exec biome check packages/protocol/src/protocol.ts packages/protocol/src/index.ts packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.ts apps/harness/src/harness-runtime.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/desktop/src/main/harness-supervisor.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.ts apps/desktop/src/main/workspace-bridge.test.ts` -> checked 12 files, no fixes applied.
- `git diff --check` -> passed with no output.
- Test-theater lint: unavailable. Repeated discovery found no `sgconfig.yml`/`sgconfig.yaml` or test-theater/test-lint package script. Ordinary Biome checks above passed; absence of a dedicated pack is not reported as a pack passing.
- Mutation: no plan-scoped command was found. Root `test:mutation` and the existing Project Storage mutation scripts remain explicit risk-only options and were not run automatically. No mutation coverage or survivor result is claimed.
- Tool diagnostics: artifact-write hooks continued to report Node unavailable and skipped their checks. Some apply_patch responses also contained IDE parse/redeclaration diagnostics inconsistent with the native final Vitest, TypeScript, and Biome results. No repository tool/configuration was modified to bypass either diagnostic; artifact hook validation and design stamp reconciliation remain for the parent, not claimed as passing here.

#### Changed Files And Completion

- Production: `packages/protocol/src/protocol.ts`, `packages/protocol/src/index.ts`, `apps/harness/src/harness-runtime.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/project-storage-bridge.ts`, `apps/desktop/src/main/workspace-bridge.ts`.
- Tests: `packages/protocol/src/protocol.test.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/tests/integration/harness-runtime.integration.test.ts`, `apps/desktop/src/main/harness-supervisor.test.ts`, `apps/desktop/src/main/project-storage-bridge.test.ts`, `apps/desktop/src/main/workspace-bridge.test.ts`.
- Evidence: this supplied design only, with append-only implementation evidence and the five satisfied Slice 1 automated criteria plus its satisfied manual privacy criterion checked off. No contract, frontmatter, Follow-up, prior preflight entry, or other slice was edited by implement.
- Slice 1 implementation complete: 6 serial Red -> Green behaviors, separate review/refactor completed, 87 final focused tests passing, all requested typechecks passing, and final Code Health safeguard passing. No later slice was implemented. No commit, merge, staging, dependency, or configuration operation was performed. Initially untracked user artifacts remain preserved and untracked.

### Phase 2: Canonical Generation 2

#### Authority And Baseline

- The user approved the 2026-09-05T17:33:04+0100 revision and explicitly authorized implementation of only S2 on `feat/canonical-project-writer`. The parent reported S1's independent review complete with no actionable findings. S1 source and prior evidence were preserved; S2's separate reviews below are self-reviews plus CodeScene, not a claim of independent-agent review.
- Four serial behavior cycles executed: numeric -> column -> loader -> one shared schema behavior with three named tests. All five original test names and exact Oracles remain, plus the new loader test. Generated production resources were not written until the shared schema Red was observed.
- Preflight read all existing S2 source/test files, complete contract/criteria, relevant Architecture, PRODUCT, CONTEXT, standing decisions, AGENTS, and ADR 0006. CodeScene configuration contained no token/on-prem/account-pin override; OAuth verification passed 5/5, including CLI/API connectivity. Existing S2 adapter/tooling baseline was 44 tests; creation/opening baseline was 103 tests; both typechecks passed. These baseline runs were not Red proof.

#### Numeric Behavior

- Test: `accepts only safe canonical ordering values` in `packages/kernel/src/project-storage-identifiers.test.ts`.
- Red: `pnpm exec vitest run packages/kernel/src/project-storage-identifiers.test.ts` -> 1 failed. Exact diagnostic: `isWriterGeneration: expected 'undefined' to be 'function'`. The existing module loaded successfully; namespace lookup was assigned to `unknown`, with callable-export assertion and `typeof` narrowing before the complete exact boundary vectors. No import/compile error, cast, or fallback guard was counted.
- Green: the same command -> 1 passed after implementing the three positive/nonnegative safe-integer guards and their brands.
- Separate review/refactor: checked zero versus positive authority, MAX_SAFE_INTEGER, fractions, NaN/Infinity, and unsafe integers. No numeric implementation refactor was needed. `pnpm exec vitest run packages/kernel/src/project-storage-identifiers.test.ts packages/kernel/src/workspace-identifiers.test.ts` -> 2 passed; `pnpm --filter @slopstop/kernel typecheck` -> passed. Detailed identifier review returned 10.0, no findings. S2's type-only `ProjectActivationId` and `CommandId` vocabulary is exported for S3; explicitly S5-only receipt/event identities remain deferred.

#### Column Behavior

- Test: `rejects canonical column-definition drift` in `apps/harness/src/storage/project-storage-node-adapters.test.ts`.
- Red: `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts -t "rejects canonical column-definition drift"` -> 1 failed, 42 skipped. Exact diagnostic: `promise resolved "undefined" instead of rejecting`. The local expected inventory was present, but current verification ignored altered column metadata.
- Green: the same command -> 1 passed, 42 skipped. Added required ordered ColumnSpec inventories, quoted `"notNull"` alias, exact uppercase observed type comparison, and all original missing/extra-definition diagnostics. Hidden values 1, 2, and 3 are exercised independently. Generation-1 production resources remained unchanged during this cycle.
- Separate review/refactor: updated existing local parent/child column inventories rather than masking errors with the production inventory; preserved runtime-owned versus Mastra-private table scope. Formatted only scoped authored files. `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts --reporter=dot` -> 43 passed. `TEMP="C:/Users/pedro/AppData/Local/Temp/opencode" TMP="C:/Users/pedro/AppData/Local/Temp/opencode" pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts --reporter=dot` -> 103 passed. Verifier/spec detailed reviews both returned 10.0, no findings; harness typecheck passed.

#### Loader Behavior

- Test: `authorizes only the pinned canonical storage-identity rebuild` in `apps/harness/src/storage/project-storage-node-adapters.test.ts`.
- Frozen `tests/fixtures/canonical-project-writer-generation-2.sql` was written with apply_patch from the approved generated proposal, not from changing production source. Read-only comparison proved its complete normalized vector equals the design fence and hashes to `e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14` before loader implementation.
- Red: `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts -t "authorizes only the pinned canonical storage-identity rebuild"` -> 1 failed, 43 skipped. The valid fixture rejected instead of resolving, caused by `ProjectStorageBrokenError: Generated migration creates an unknown table.`
- Green: the same command -> 1 passed, 43 skipped. Exact original 2/30 statement records survive unchanged. The test exercises the complete approved positive/negative matrix, including each missing block statement, altered SQL, wrong authority, drop-only/rename-only, duplicate/extra temporary use, unknown tables, forbidden objects, and implicit ledger. No candidate escapes before both lineage/vector pins and final inventory checks pass.
- Separate review/refactor: retained original guard diagnostic precedence, explicit local generation-1 guard specs, and no temporary final-table allowance. CodeScene initially reported `requireCanonicalRebuild` Complex Method, CC 9, score 9.68. Replaced optional-access/compound missing-input checks with explicit narrowed prerequisites; detailed review became 10.0 with no findings. `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/generated-migrations.test.ts apps/harness/scripts/check-generated-migrations.test.mjs --reporter=dot` -> 46 passed. Later scoped Biome rejected three `return invalid()` statements in a void function; explicit `() => never` typing preserved narrowing without returning a value. Final native typecheck, lint, tests, and detailed review pass.

#### Shared Schema Behavior

- Tests: `creates the exact canonical generation-2 schema`, `enforces canonical generation-2 trust-spine constraints`, and `reports generation 1 as migration-required without mutation` in the two named integration files.
- Red command: `TEMP="C:/Users/pedro/AppData/Local/Temp/opencode" TMP="C:/Users/pedro/AppData/Local/Temp/opencode" pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts -t "creates the exact canonical generation-2 schema|enforces canonical generation-2 trust-spine constraints|reports generation 1 as migration-required without mutation"` -> 3 failed, 102 skipped across 2 files, before any shared schema/spec/creation edit.
- Creation Red: received `schema_version: 1` and `last_migration_id: "0000_fat_doctor_octopus"`, expected 2 and `0001_canonical_project_writer`.
- Constraint Red: received only `["schema_metadata", "storage_identity"]`, expected the exact eleven-table inventory. The assertion ran before preparing SQL cases; missing-table errors were not accepted as constraint rejection.
- Historical opening Red: received `opened/read-write` with canonical `{ status: "healthy" }`, expected safe mode with the exact `DATABASE_MIGRATION_REQUIRED` health. The fixture physically reconstructs canonical storage from original `0000`, inserts explicit original metadata and exact identity, and updates its matching manifest only during arrangement. All four immutability hashes are captured afterward.
- Implementation: added the approved schema and independently declared verifier inventory; creation inserts exactly one zero-counter Project row after migrations and before Storage identity. Generated resources using `pnpm --filter @slopstop/harness exec drizzle-kit generate --config drizzle.canonical.config.ts --name canonical_project_writer` only after the three Reds. The actual generator returned 11 tables and produced `0001`, journal, and snapshot. Read-only comparison proved all 30 generated statements exactly match the frozen approved vector and its fixed hash.
- Green: the identical Red command -> 3 passed, 102 skipped. Fresh metadata/state/identity/counts match exactly; all 22 isolated constraint cases reject with the expected CHECK/FK/UNIQUE error class and unchanged exact eleven-table row counts before rollback and after savepoint cleanup; old-generation database, metadata serialization, manifest, and migration hashes remain unchanged across opening/closing.
- Separate review/refactor: generation-1 SQL/snapshot stayed immutable; generated rebuild copies all six identity fields and no new trust-spine table is populated except Project state. Reviewed SQLite integer storage-class plus safe bounds for Writer generations, Project sequences, event ordinals, command/event/aggregate versions and nullable resolver/predecessor generations. Original metadata constraints remain the pinned legacy metadata contract. No in-place migration, Writer activation, lease path, or S3 behavior was added.
- Review found String Heavy Function Arguments/Primitive Obsession in the expanded verifier spec (10 -> 9.38), Primitive Obsession in constraint fixture builders (10 -> 9.68), and Large Method/file-size findings in the create test (10 -> 8.95). Converted ambiguous string/number tuples to named column/fixture inputs; moved the unchanged exact fresh-schema assertions into the existing schema-cases helper. No new source file, assertion weakening, SQL/pin change, or threshold change was needed. Spec reviews progressed 9.38 -> 9.68 -> 10.0; fixture and create-test reviews finished 10.0 with no findings. Reran all three shared tests after each refactor; final result 3 passed, 102 skipped.

#### Final Verification And Code Health

- `pnpm exec vitest run packages/kernel/src/project-storage-identifiers.test.ts` -> 1 passed on the final exported vocabulary.
- `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts` -> 44 passed in the one discovered unit file. Root discovery does not execute the integration paths.
- `TEMP="C:/Users/pedro/AppData/Local/Temp/opencode" TMP="C:/Users/pedro/AppData/Local/Temp/opencode" pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts --reporter=dot` -> 105 passed in 2 files on the final formatted schema/refactor tree.
- `pnpm exec vitest run apps/harness/src/storage/generated-migrations.test.ts apps/harness/scripts/check-generated-migrations.test.mjs` -> 2 passed. There is no separate tools Vitest project; the generator regression is in the harness project.
- Final S2 focused proof is 152 distinct tests in 6 files: 1 numeric, 44 adapter, 2 tooling, and 105 integration tests. The combined root command with these paths and `--reporter=dot` also passed 47 unit/tooling tests in 4 files.
- `pnpm --filter @slopstop/kernel typecheck` and `pnpm --filter @slopstop/harness typecheck` -> passed, repeated after final identity exports.
- `pnpm --filter @slopstop/harness db:generate:check` -> passed. All three generators reported no schema changes; the before/after full migration-tree hash comparison found no changes. No generated output was manually edited.
- `node -e "const fs=require('node:fs');const crypto=require('node:crypto');const p='apps/harness/drizzle/canonical/0000_fat_doctor_octopus.sql';console.log(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'))"` -> exactly `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`. Original snapshot SHA-256 is still `5e26d686143d3687a458752eaa08b22ed18454094fa24b5556b2bbd0c6d34523`.
- Manual generated-resource review and read-only metadata assertions confirmed journal indices/tags 0/0000 and 1/0001, unchanged first journal entry, successor snapshot prevId equal to original snapshot id, 11 tables, 81 columns, 62 checks, 15 named indexes, and 11 foreign keys. Fresh integrity and empty-table assertions pass. No temporary table survives.
- `pnpm exec biome check packages/kernel/src/project-storage-identifiers.ts packages/kernel/src/index.ts packages/kernel/src/project-storage-identifiers.test.ts apps/harness/src/storage/canonical-schema.ts apps/harness/src/storage/project-storage-database-specs.ts apps/harness/src/storage/database-schema-verifier.ts apps/harness/src/storage/generated-migration-resources.ts apps/harness/src/storage/project-storage-node-adapters.ts apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/tests/integration/project-storage-schema-cases.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts` -> checked 12 files, no fixes applied. Scoped formatting/import organization preceded this final check; generated SQL/JSON and S1 files were excluded from formatting.
- S1 regressions: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.test.ts --reporter=dot` -> 82 passed; `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/harness-runtime.integration.test.ts --reporter=dot` -> 5 passed. Total S1 regression proof remains 87.
- Detailed final source reviews: identifier module and canonical-schema were not assessed before change (null/declarative baseline), and now each scores 10.0 with no findings. Verifier, database specs, migration loader, and node adapters each finish 10.0 against pre-change 10.0, with no remaining new smell. `packages/kernel/src/index.ts` remains export-only/not assessed (`score: null`); compiler and seam tests are compensating evidence, not a fabricated numeric score. All five authored test/helper modules finish 10.0; the new identifier test has no prior file baseline.
- Repository `codescene_pre_commit_code_health_safeguard` -> `quality_gates: passed`, `status: no-issues-found`, `checked-file-count: 24`, `code-health-eligible-file-count: 24`, `total-modified-file-count: 30`, `results: []`. No configuration/rule/threshold was weakened. `git diff --check` passed.
- Test-theater lint: unavailable; no dedicated script or sgconfig exists. Ordinary scoped Biome passed. Mutation: no S2 plan-scoped runner; global/risk-specific mutation, deep gates, packaging, and later-slice gates were not run indiscriminately. No mutation score or cross-platform/package proof is claimed.
- Diagnostic retained: one intermediate three-test refactor run reported `[vitest-pool]: Worker forks emitted error` / `Worker exited unexpectedly`, with only 1 of 3 tests completed. It was not counted as Green. The identical command immediately passed all 3 without source/configuration/environment changes, and subsequent full 105-test integration proof passed. Treat recurrence as a runner/native-worker investigation, not a reason to weaken assertions.
- Artifact-write hooks reported `Node executable unavailable` and skipped their validation/duplication checks. Native Vitest/TypeScript/Biome and explicit metadata proofs above passed; hook validation and content-hash restamping are not claimed. The revision frontmatter retains its approved timestamp; prior S1 TDD Evidence is unchanged.

#### Completion And S3 Handoff

- S2 complete: 4 serial behavior cycles, 6 named contract tests, 2 exemption groups (three generated production resources and export-only barrel), separate review/refactor gates, 152 focused passing tests plus 87 S1 regressions, all eight S2 automated criteria and three manual criteria satisfied.
- Exactly 17 files were created/modified for this turn: the 16 entries in S2's Files inventory plus this design/revision/evidence artifact. Breakdown: 7 production TypeScript files, 5 test/helper TypeScript files, 1 frozen SQL test fixture, 3 generated migration/metadata files, and 1 design artifact. The pre-existing 12 S1 changes and original untracked handoff are outside this count and preserved. Handoff Git blob remains `8a985b52cbaed1ac9b826e1ffe94843727d5f048`; no commit, merge, staging, or branch change was performed.
- S3 may consume ProjectActivationId, CommandId, WriterGeneration, ProjectSequence, CanonicalEventOrdinal, the three guards, and canonical generation-2 tables after the parent's S2 review. No activation schema, native lease, coordinator, Writer repository, release retry, protocol command, or future-slice implementation was introduced. Existing generation-1 Projects intentionally remain migration-required; there is no migration feature.
- Preserve the closed successor statement pin and frozen test fixture. S3 adds no schema change; any future legitimate change to this migration's executable vector requires explicit contract review rather than updating the pin from arbitrary current code. Read cumulative Architecture carefully: only S3-owned deltas are next; S5-only receipt/event identity exports remain deferred.

### Phase 3: Exclusive Activation

#### Revision And Baseline

- Approved revision applied with timestamp 2026-09-05T19:37:31+0100. Read-only comparison with Git blob b2ac8f41db74abc7e8a7cf3bd4a832d696c34c1a verified all 18 original named Test/Oracle pairs and the complete preexisting S1/S2 TDD Evidence were unchanged before this append. Artifact hooks reported Node unavailable and skipped; no stamp is claimed.
- Existing pre-change Windows baseline: 109 unit tests in seven files, 23 integration tests in two files, protocol/harness/desktop typechecks and git diff --check passed. CodeScene get_config and OAuth verification passed once (5/5); all 13 analyzable S3 production baselines scored10. Absent source has no numeric baseline; declarations/export-only files are not assessed. These are baseline results, not S3 Green.
- Parent owns separate Linux preparation/execution and independent S3 review. No Linux, CI, package-crash, whole-S3 completion, commit, staging, push or merge claim is made here.

#### Identity Characterization (Exempt)

- Extended `validates Project Storage identities` with exact existing Project versus other-identity diagnostic messages. `pnpm exec vitest run packages/protocol/src/project-storage-protocol.test.ts -t "validates Project Storage identities" --reporter=dot` passed1, skipped4 before extraction. Moved lowercase refinement to domain-identity-schema.ts and retained all schema/type exports. Full same file passed5 afterward. No Red claimed.

#### B1: Protocol

- Authored both named tests before canonical schemas/wiring. `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/protocol.test.ts -t "parses canonical Project activation and command protocol branches" --reporter=dot`: Red2, skipped14. Existing namespace loaded; missing schema failed `expected undefined to be an instance of ZodType`; raw activation returned PROTOCOL_MESSAGE_INVALID at command instead of exact accepted envelope. No missing import counted.
- Added only S3 activation/command schemas, inferred vocabulary, explicit exports and v4 factories/unions. Identical command Green2, skipped14. Exact malformed fields use raw nested schema issues; envelope union normalization remains at payload. No switch, settlement, registry or future JSON-fingerprint schema added.
- Separate review: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/project-storage-protocol.test.ts packages/protocol/src/protocol.test.ts --reporter=dot` passed21 in3 files; protocol typecheck passed. New canonical protocol source and test detailed CodeScene reviews scored10 with no findings.

#### B3: Worker Client Close

- `pnpm exec vitest run apps/harness/src/storage/local-libsql-worker-client.test.ts -t "retries a rejected worker client close without reopening the client" --reporter=dot`: Red1, skipped4. Retry reused the rejected close promise (`Local libSQL client is unavailable.`) instead of resolving. The real worker rejected a first close request targeting a deliberately nonexistent positive client ID; the actual retained client remained open. No fabricated worker success response was used.
- Minimal implementation clears only a rejected close attempt while keeping closing=true. Identical command Green1, skipped4; full promise identity, two request counts, execute/transaction denial and completed-close reuse assertions pass.
- Separate review found the test's unconditional successful-worker termination polluted later shared-broker tests (three timed-out regressions, not Green). Cleanup now terminates only when the test cannot close its retained client; normal successful cleanup uses close alone. Extracted a message guard to remove Complex Conditional (9.53 ->10). Full file passed5; source and test detailed CodeScene reviews both10, no findings.

#### B2: Opening Release

- Moved release construction ahead of late slot population in `releases canonical then runtime regardless of probe completion order`. Its focused adapter command passed1, skipped43 before implementation: honest existing Green characterization.
- `pnpm exec vitest run apps/harness/src/storage/project-storage-opening.test.ts -t "retries only unfinished opening database closes" --reporter=dot`: Red1, skipped4. Retry returned the cached AggregateError instead of resolving. Added acknowledged-close flags initially false and rejection-cache clearing. Identical command Green1, skipped4, including late slots, canonical count1/runtime count2, shared promise and ordered dual errors.
- Separate review extracted closeOpeningClients to remove Complex Method (9.68 ->10), preserving the exact flags/ordering. `pnpm exec vitest run apps/harness/src/storage/project-storage-opening.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts --reporter=dot` passed49 before and after refactor. Opening source/test detailed CodeScene reviews10.

#### B5: Root Lease Witness

- `pnpm exec vitest run apps/harness/src/storage/project-storage-filesystem-authority.test.ts --reporter=dot`: Red1, plain root lease rejected as `Project Storage root contains an unknown witness.` Added the controlled filename and root-only witness vocabulary; identical command Green1.
- Exact full scan is project-root plus writer-lease, no root-database witness/generation; clean unregistered absence remains recovery-required. Directory, symbolic-link and generation-entry cases retain their exact existing diagnostics. The companion is not added to generation file/baseline/manifest fields; snapshot/export APIs are not invented for this slice.
- Separate review used a root-only-kind Set to eliminate Complex Method (9.68 ->10). Witness and manifest tests passed2; final witness rerun passed1, source detailed review10.

#### B4: Retained Storage Sessions

- Both `retains Project Storage sessions until close succeeds` tests were authored first. Unit focused command and explicit integration focused command each failed1: expected release count2, received1 after close failure and shutdown. No compilation/import failure counted.
- Added required internal activation session/port, separate activation ownership, canonical/lease paths, delete-after-success close, and shutdown over both admission-ordered session sets. Identical focused commands each passed1. Applied approved existing lifecycle assertion migration from one release to two; repeated same error identity remains one aggregate member. Required runtime fixture wiring remains assigned to B18.
- Separate review narrowed the classified opening union, adapted its existing test with an explicit session guard, reused the operation result type, extracted activation failure classification, and simplified the now-typed session test helper. Source/test Code Health improved 9.68/9.09 ->10 with no findings. Unit store+opening passed32; full lifecycle integration passed19; harness typecheck passed; final store-only rerun passed27.

#### B6-B8: Native Resource Lifecycle

- Exempt dependency setup: added exact fs-native-extensions1.5.1 catalog/importer and approved bare-module-resolve1.12.5 override/exclusion. `pnpm install --lockfile-only` passed supply-chain validation and added only62 lockfile lines. Frozen installs encountered EPERM renames on fs-native-extensions, require-addon and bare-addon-resolve, including one copy-method attempt; these were setup failures, never Red. A subsequent `pnpm install --frozen-lockfile --package-import-method=copy` completed with normal Electron postinstall and Husky prepare; final plain `pnpm install --frozen-lockfile` passed unchanged. No allowBuilds exception added.
- Direct installed inspection loaded tryLock/unlock using Node24.19.0 on win32-x64, exact package1.5.1 and its135680-byte target .node. Its actual scripts contain no install lifecycle hook. No Linux claim.
- Staged only type declarations/erased factory signatures in the new loadable module. Both named unit tests and the real-peer integration test were fully authored before runtime factory implementation. Unit command `pnpm exec vitest run apps/harness/src/storage/canonical-writer-lease.test.ts --reporter=dot` Red2; explicit integration command `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts --reporter=dot` Red1. Each reached its guarded absent callable assertion; dependency loading was already verified, no missing import counted.
- Implemented held byte0/length1 lease, false/Windows-EBUSY-only contention, distinct open/lock/unlock/close errors, retained failed unacquired cleanup, and shared stage-aware release retries. Identical commands Green2/Green1. Real child sent locked; parent observed contended while child lived; explicit child unlock/close/released/exit0 preceded acquired takeover. No hard-kill/crash-release proof claimed.
- Separate review moved test cause checks and release expectations to focused helpers/data, eliminating Complex Method (test9.41 ->10). Rerun passed2; lease source, unit test, integration test detailed CodeScene reviews10, no findings; harness typecheck passed.

#### B9-B10: Durable Authority And B16 Repository Checks

- Staged only erased repository interfaces/token-schema/factory declarations. Before runtime implementation, `pnpm exec vitest run apps/harness/src/storage/canonical-command-repository.test.ts --reporter=dot` failed3 at guarded missing factory assertions; explicit activation integration command failed1 at the same public prerequisite. The three unit names are B9, B10 and B16 repository cleanup; the integration name is the approved first/second transaction configuration supplement. No schema/import/setup failure counted as Red.
- Added S3-only repository implementation using the existing shared transaction helper and real worker-backed libSQL. No schema change, settlement/registry, classified runner or future recovery module. Generic abandoned-active-fence evidence remains internal to this repository. Identical commands passed3 and1; harness typecheck passed.
- Durable tests independently query SQLite rows: generations1/2/3, exact initial/clean/recovery handoffs, abandoned generation2 released at2026-09-04T12:02:00.000Z, exact resolved generic record with null command/fingerprint and resolver3, current fence3, and token digests rather than tokens. Corrupt predecessor fixtures cover zero-with-prior-state, absent/gapped/lagging/mismatched state, malformed digest/time and inconsistent releases, with unchanged full writer/settlement snapshots after refusal.
- Fractional witnesses reject .0001Z versus .0002Z without row advance, accept .0001Z versus .000100Z and absent fraction versus .000Z as clean, and reject +00:00. Fence tests retain current/stale distinctions, exact release timestamps, malformed inputs/hash, duplicate/failed query handling and transaction rollback after affected-row drift.
- B16 repository cleanup observes one failed close retained for explicit cleanup, then total close count2 and unchanged rows. A fresh client separately proves activation-failed with successful cleanup; these checks will remain regressions in the coordinator group, not fresh Reds.
- Real configuration proof poisons FK/busy to0 before activation and again before release, then reads inside both actual transactions: exactly `[{foreignKeys:[[1]],busyTimeout:[[5000]]},{foreignKeys:[[1]],busyTimeout:[[5000]]}]`. Normal real SQL and terminal calls are delegated, not fabricated.
- Separate review removed a Complex Conditional in prior-state emptiness (9.68 ->10) and isolated test query-fault transformation to remove Bumpy Road/Complex Method (9.43 ->9.68 ->10). Final full repository rerun passed3 in9.16s; source/test/configuration-integration detailed CodeScene reviews10, no findings. The30s unit allowance covers the complete serial real-file corruption matrix, not a production timeout or a Red oracle.

#### B11-B16: Coordinator Lifecycle

- Authored all six named coordinator tests, the named Writer release test and supplemental stale/native-close test before runtime factories. `pnpm exec vitest run apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-writer.test.ts --reporter=dot`: Red8 at guarded missing callable factory assertions in successfully loaded declaration-only modules. B16 repository checks had already passed in the explicitly assigned durable group and were not claimed Red again.
- Implemented S3 activation only: inactive/stopped checks, separate Storage ownership, read-only contention, generation-bearing Writer, exact admission order, admitted fence-check completion tracking, shared stop, staged release and retained failed cleanup. No project.switch, queue-time S4 barrier, command settlement, registry or automatic activation restoration. Identical command Green8; harness typecheck passed.
- Exact tests cover inactive/current/stopped ownership, zero Writer dependencies on non-writable Storage, fresh read-only epoch with no token/repository, availability/Project/epoch/access/fence admission, every retained release stage, stale fence refusal, native unlock/close codes, and B16 one cleanup attempt followed by explicit retry with total client-close count2. Normal stop order is fence/repository/lease/storage; acquisition-time failed file cleanup retains ownership without an immediate extra close.
- Separate review split acquisition steps and admission rejection into focused private functions while retaining one coordinator state owner. Source progressed8.8 ->9.09 ->10, eliminating Bumpy Road, Complex Method and Overall Code Complexity. Writer-test expectations became literal case data (9.68 ->10). Exact reruns passed8, then coordinator-only6; all four source/test detailed reviews10. Later formatting exposed one81-line coordinator fixture; extracted its unchanged opened-result data, reran6 and returned the test to10.

#### B17: Canonical Application Boundary

- `pnpm exec vitest run apps/harness/src/canonical-project-application.test.ts --reporter=dot`: Red1 at guarded missing application factory. Implemented strict result validation/correlation and sanitized CanonicalProjectApplicationError; coordinator exceptions remain unchanged and stop delegates directly. Identical command Green1, including exact invalid-result name/message, no cause/value attachment, mismatched Project/activation/Command IDs and original private owner-error identity.
- Separate review consolidated schema/correlation checks in validatedResult, eliminating Complex Method (9.68 ->10). Exact rerun passed1; source/test detailed reviews10; harness typecheck passed.

#### B18: Runtime And Production Composition

- Before runtime wiring, `pnpm exec vitest run apps/harness/src/harness-runtime.test.ts -t "round-trips canonical activation|awaits canonical release" --reporter=dot` failed2: activation output was [] instead of the full readonly event, and immediate shutdown called storage instead of canonical. The explicit integration command over harness-runtime.integration.test.ts and canonical-project-activation.integration.test.ts with `-t "round-trips canonical activation|composes exclusive activation" --reporter=dot` failed3: no application-port dispatch, no initial production admission result, and missing exact readonly event. Receipt barriers/snapshots exposed the missing dispatch; no timeout or import error counted.
- Added required canonical application dependency, activate/command dispatch, canonical-before-Storage shutdown with failed-canonical short circuit, and real bootstrap composition of Storage/coordinator/native lease/repository/token/epoch factories. Applied every existing fixture's required inert canonical dependency and the approved post-await shutdown expectation/error-identity migrations. Barrels expose only approved public seams; private token/repository/lease APIs remain absent.
- Identical focused commands passed2 and3. Real-port tests assert event901/sequence1/activation101 and sequence2/command102 with exact read-only payloads, then exact request-scoped generic failures for both private exceptions. The real activation fixture uses real Storage opening, native contention, coordinator and application; the independent native peer-process proof remains B6. Production bootstrap additionally proves startup inactive, create without implicit activation, explicit writable generation1 and fenced COMMAND_SETTLEMENT_UNAVAILABLE. No domain handler or future settlement result is installed.
- Separate review preserved S1 normalization and exact failure identities, then formatted/organized only the40 scoped TypeScript files. Runtime source/test, bootstrap and transport integration detailed reviews10. Formatting exposed a108-line production-bootstrap test; extracted its transport fixture without changing assertions. Configuration/activation/production integration rerun passed3 and its detailed review returned10. Full focused Windows suites passed132 unit tests and29 integration tests before and after final review.

#### Final Windows Verification

The following are Windows results only; Linux criteria remain independently unchecked.

- Final unit command: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/project-storage-protocol.test.ts packages/protocol/src/protocol.test.ts apps/harness/src/storage/project-storage-opening.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/project-storage-store.test.ts apps/harness/src/storage/local-libsql-worker-client.test.ts apps/harness/src/storage/project-storage-filesystem-authority.test.ts apps/harness/src/storage/canonical-writer-lease.test.ts apps/harness/src/storage/canonical-command-repository.test.ts apps/harness/src/canonical-project-writer.test.ts apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-application.test.ts apps/harness/src/harness-runtime.test.ts --reporter=dot` ->132 passed in14 files.
- Final integration command: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts --reporter=dot` ->29 passed in4 files. Source Windows proof totals161 distinct tests in18 files; reruns are not additional tests.
- `pnpm --filter @slopstop/protocol typecheck`, `pnpm --filter @slopstop/harness typecheck`, and `pnpm --filter @slopstop/desktop typecheck` all passed on the final source/test/configuration tree.
- `pnpm check:architecture` -> valid:true, zero errors in3 files. `pnpm check:boundaries` -> no violations,194 modules/456 dependencies. These are separate model and source-boundary proofs.
- S1 regressions: `pnpm exec vitest run packages/protocol/src/protocol.test.ts apps/harness/src/harness-runtime.test.ts apps/desktop/src/main/harness-supervisor.test.ts apps/desktop/src/main/project-storage-bridge.test.ts apps/desktop/src/main/workspace-bridge.test.ts --reporter=dot` ->85 passed. Its original real-port cases also pass within the final6-test harness-runtime integration file.
- S2/production bootstrap regressions: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts apps/harness/tests/integration/project-storage-open.integration.test.ts apps/harness/tests/integration/process-bootstrap.integration.test.ts --reporter=dot` ->108 passed (105 create/open plus3 original bootstrap checks). Numeric and generator-tooling command `pnpm exec vitest run packages/kernel/src/project-storage-identifiers.test.ts apps/harness/src/storage/generated-migrations.test.ts apps/harness/scripts/check-generated-migrations.test.mjs --reporter=dot` ->3 passed. The44 adapter tests also pass in final S3 unit scope. No migration generator was run.

#### Native Staging And Tooling Adaptation

- Exempt Vite change adds fs-native-extensions to the existing runtime-closure collector and external list, retaining the single harness entry and existing staging hook. The first prescribed standalone build exposed an actual output-layout mismatch: Vite emitted dist/harness.cjs while the hook staged dependencies into .vite/build. It was not counted as a coherent staged-tree proof.
- Corrected this S3-owned build configuration with outDir:.vite/build and emptyOutDir:false, preserving sibling Forge outputs. This is an implementation adaptation to the existing S3 output criterion, not a new package topology or S7 entry. Future slices must preserve this working base rather than overwrite it with a cumulative excerpt lacking the explicit standalone output settings.
- `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts` then passed, emitting fresh .vite/build/harness.cjs (312.84kB) and the exact native runtime closure. The unchanged worker resolver produces EMPTY_IMPORT_META for its CJS fallback; the warning was not suppressed. Actual process-entry resolution uses process.argv[1]; packaged Electron proof remains S7, not implied by this build.
- Exact installed-package inspection command from the S3 criterion passed with version1.5.1, win32-x64 and prebuilds/win32-x64. Normal frozen installation passed after the recorded transient EPERM failures; no build allowlist, supply-chain rule or dependency version was weakened.
- Isolated Windows staging verifier ran via `pnpm exec node --no-global-search-paths -e` with the documented physical-tree resolver guard, a fresh owned slopstop-s3-windows-stage-* copy under the approved Windows temp root, cleared NODE_PATH/NODE_OPTIONS, and a separate Node child. It required harness.cjs, exact package1.5.1 and the executing target .node. Result: childExit0, empty stdout/stderr, isolated:true, binding SHA-256 dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4. Parent deletion occurred only after confirmed child exit; an unconfirmed exit would retain the tree. This is native source/staging proof, not ASAR/package/crash proof.

#### Final Review, Preservation And Handoff

- All19 analyzable S3 production files and19 authored test/helper files received detailed final CodeScene review and scored10 with no findings. The13 existing production baselines remain10 ->10; six new production modules have no pre-change numeric baseline. Both export-only barrels, native declaration and dependency declarations are explicitly not assessed numerically.
- Repository CodeScene safeguard passed: quality_gates:passed, status:no-issues-found, checked-file-count57, code-health-eligible-file-count57, total-modified-file-count66, results:[]. No rule/threshold change. This automated gate and self-review are not the parent's independent S3 review.
- Scoped Biome check/format/import organization passed on all40 TypeScript files and the Vite configuration; subsequent final checks apply no fixes. Test-theater/test-lint and a plan-scoped mutation runner are unavailable by discovery. No global mutation, deep gate, package smoke or later-slice implementation was run.
- Preservation comparison against pre-revision design blob b2ac8f41db74abc7e8a7cf3bd4a832d696c34c1a confirms all18 original named Test/Oracle pairs verbatim, exact S1/S2 and S4-S7 slice contracts/criteria, and the complete prior TDD Evidence as an unchanged prefix. Migration0000 and snapshot0000 retain their recorded hashes; both production0001 and frozen loader fixture retain statement-vector hash e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14. No schema/migration2 change.
- All44 S3 inventory paths now exist and were authored/modified in scope, plus this design revision/evidence artifact. No extra product source/test file was introduced outside that inventory. The new production modules are canonical-project-protocol.ts, canonical-writer-lease.ts, canonical-command-repository.ts, canonical-project-writer.ts, active-project-coordinator.ts and canonical-project-application.ts. S1/S2-only files and the original handoff remain preserved; shared files changed only for S3 and the approved fixture migrations.
- Source inspection finds one lowercase protocol refinement and no old sibling helper; no project.switch, canonical-command-registry, canonical-command-settlement, canonical-writer-recovery or writer-proof-fixture reference was introduced into harness source. Result schemas and application/runtime tests exclude private data; only repository-internal causes retain exceptions. Project-root lease stays outside generation manifests/baselines. git diff --check passed.
- Windows implementation is ready for parent review, not whole-S3 completion. Exactly two automated criteria remain unchecked: actual Linux native source proof, and Linux build/isolated staged native loading. Parent also owns independent S3 review before progression. This Windows implementer did not set up, use, or edit the separate Linux agent's resources. No commit, staging, push, merge or content-hash stamp was performed.
- Final post-append checks: `pnpm exec biome check apps/harness/src apps/harness/tests packages/protocol/src apps/desktop/vite.harness.config.ts` checked85 files with no fixes; git diff --check and git diff --cached --quiet passed. Original handoff Git blob remains8a985b52cbaed1ac9b826e1ffe94843727d5f048. Final preservation/inventory query reports18 unchanged original Oracle pairs, unchanged historical evidence prefix,19 analyzable production files,19 test/helper files,44 inventory paths and exactly the two pending Linux criteria.

#### Independent Review Fixes: F1 And F2

- The independent S3 reviewer identified two verified P2 defects despite the first candidate's passing tests and Code Health. The parent reports that first candidate also passed Linux132 unit/29 integration tests, build and isolated native loading with288 source hashes stable. Those Linux results are historical for the first candidate; the fixes below require a new Linux snapshot/run and do not check off either pending Linux criterion. No contract revision is needed or made: retained failed ownership and malformed persisted-authority diagnostics were already required.
- Changed-source baseline is the previously recorded10.0 for project-storage-store.ts and canonical-command-repository.ts. Git/worktree inspection confirmed the existing S3 implementation before these edits. Fixes execute serially, F1 Red/Green/review before F2 Red/Green/review; no S4+ implementation, schema/migration or dependency change.

F1: late activation ownership during shutdown

- Added public-owner regression `retains a late activation release across shutdown (%i failures)` for one and two close failures. It starts acquireActivation for Project010, suspends opening.inspect after entry, starts explicit owner.stop, then supplies healthy selected-current evidence. The test observes the original acquisition error identity, both concurrent stop calls sharing the same promise, ordered shutdown errors and registry close count1.
- Red: `pnpm exec vitest run apps/harness/src/storage/project-storage-store.test.ts -t "retains a late activation release across shutdown" --reporter=dot` ->2 failed,27 skipped; both expected release count2 but received1. This proves the lost retained handle, not an import/timeout failure.
- Minimal fix retains the activation session before attempting stop-race cleanup. The existing explicit shutdown sweep can therefore retry its unfinished release. If resources still remain after a rejected stop, only the cached attempt is cleared; no retry is dispatched automatically. A later explicit stop retries retained sessions, while acknowledged registry shutdown is not repeated. When no resources remain, the original rejected stop remains cached, preserving its historical error. Admission stays stopped throughout.
- Green: identical focused command ->2 passed,27 skipped. One initial failure causes release count2 with original acquisition error and shutdown aggregate [originalFailure]. Two failures preserve [originalFailure, shutdownReleaseFailure], leave ownership retained, and a later explicit stop succeeds at release count3; registry stop stays1 and successful stages do not repeat.
- Separate review: store/opening unit files passed34; existing lifecycle integration passed19; harness typecheck passed. Extracted closeRegistry to eliminate a new Complex Method (9.68 ->10.0) without changing release semantics. Final store-only rerun passed29; both F1 source/test detailed CodeScene reviews10.0. Ordinary-session regression assertions remain intact.

F2: validate persisted Writer fields before capability matching

- Added six real in-memory SQLite fixtures behind the existing LocalLibsqlClient port. Each executes the unchanged generation-2 SQL and real repository generation1 activation before corruption. Fixture-only foreign-key/check suppression permits the deliberately invalid write, and a direct SELECT confirms the exact injected value before verification. SQL statements, transactions and row results are real SQLite operations, not fabricated fence counts; existing worker-backed tests remain the driver proof.
- Cases independently corrupt writer_fence.token_digest and writer_generations.token_digest to malformed; writer_fence.released_at, writer_generations.released_at, writer_fence.activated_at and writer_generations.acquired_at to not-a-time. Added a separate well-formed generation1-to-generation2 supersession characterization, including refusal of the historical capability's release without mutation.
- Red: `pnpm exec vitest run apps/harness/src/storage/canonical-command-repository.test.ts -t "rejects malformed persisted Writer authority|keeps a superseded well-formed Writer capability stale" --reporter=dot` ->6 failed,1 passed,3 skipped. Both digest and released_at corruptions returned stale instead of rejecting; activated_at/acquired_at corruptions returned current. The historical-capability characterization was already Green. Parameterized display labels were corrected before this named Red run; no failed corruption write or SQL-constraint exception counted as Red.
- Minimal fix shares readFenceRows with activation, selects the Project's fence and generation counterpart without capability/digest/state/release filtering, and validates stored digest/time fields through existing strict schemas. Only after validation does verifyFence compare generation, token and unreleased active shape. Malformed values and duplicate rows raise WRITER_FENCE_CHECK_FAILED; missing/well-formed nonmatching authority remains stale. Verification performs no mutation or permissive coercion; releaseFence behavior and malformed supplied-hash/time guards remain unchanged.
- The existing SQL-failure/duplicate-row decorator now identifies the actual fence SELECT rather than the removed fenceCount alias. Its original error and rollback oracles are unchanged.
- Green: identical focused command ->7 passed,3 skipped; every corrupt fixture's complete Writer/settlement row snapshot remains unchanged. Full repository file passed10, activation/configuration integration passed3 and harness typecheck passed. Separate review plus scoped formatting left both F2 source/test detailed CodeScene reviews10.0, with no findings.

Post-fix Windows recertification

- Full S3 unit command: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/project-storage-protocol.test.ts packages/protocol/src/protocol.test.ts apps/harness/src/storage/project-storage-opening.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/project-storage-store.test.ts apps/harness/src/storage/local-libsql-worker-client.test.ts apps/harness/src/storage/project-storage-filesystem-authority.test.ts apps/harness/src/storage/canonical-writer-lease.test.ts apps/harness/src/storage/canonical-command-repository.test.ts apps/harness/src/canonical-project-writer.test.ts apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-application.test.ts apps/harness/src/harness-runtime.test.ts --reporter=dot` ->141 passed in14 files.
- Full S3 integration command: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts --reporter=dot` ->29 passed in4 files, including real Windows native contention/release and both real transaction configuration reads.
- Protocol, harness and desktop typecheck commands all passed. pnpm check:boundaries reported no violations (194 modules/450 dependencies); pnpm check:architecture reported valid:true with zero errors. Scoped read-only Biome checked4 files with no fixes; git diff --check and git diff --cached --quiet passed.
- All four changed source/test files received detailed post-format CodeScene reviews10.0. Repository safeguard passed again:57 eligible/checked files,66 total modified files including prior work, no-issues-found, results:[]. No rules, thresholds or tests were weakened.
- Rebuilt the final Windows candidate with `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts`: fresh .vite/build/harness.cjs,312.95kB. The unchanged EMPTY_IMPORT_META warning remains documented, not suppressed.
- Reran the separate-child Windows staged-native verifier with physical-tree resolution enforcement and confirmed child exit before owned temporary-tree deletion. Exact package1.5.1, win32-x64, childExit0, empty stdout/stderr, isolated:true. Copied harness SHA-256 equals the fresh build:490efa741c66a7df1e2b2ff70ba25696596d6b9ca92e851c687ea3f601f2c7b8. Native binding SHA-256 remains dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4; unchanged native bytes alone do not recertify an older source candidate.
- Preservation checks confirm18 original Test/Oracle pairs, unchanged prior S1/S2 evidence prefix and migration pins. This review-fix pass changes exactly project-storage-store.ts, project-storage-store.test.ts, canonical-command-repository.ts, canonical-command-repository.test.ts, and this append-only evidence artifact. It does not revise contracts, generate migrations, install dependencies, touch Linux-agent resources, commit, stage, push or merge.
- Handoff: F1/F2 are corrected and Windows proof is current. Parent re-review and a fresh Linux resnapshot/run against this final tree remain required before S3 acceptance. Both Linux criteria stay unchecked; no whole-S3 completion is claimed.

#### Final S3 Linux Proof And Independent Review Acceptance

- Publication authorized by the parent on 2026-09-07 after independent re-review confirmed F1/F2 fixed, with no remaining or new actionable findings. The parent reports a separate independent Windows rerun of44 unit tests and22 integration tests passing. Those parent-reported focused counts are distinct from the implementer's full post-fix Windows141-unit/29-integration recertification above and from the directly observed Linux results below; this Linux agent does not claim to have executed that independent Windows rerun.
- The first Linux candidate passed132 unit tests in14 files and29 integration tests in4 files before F1/F2 correction. Its source snapshot, actual logs, report, seal and manifest remain historical at `/var/tmp/slopstop-s3-igyrrwdx/source` and `/var/tmp/slopstop-s3-igyrrwdx/s3-proof`; manifest SHA256 `48f74b69a1778ef6d4d98b3dbc9104b83d2ce2139b37cf75fb00e5a63cf64ede`. Neither that first pass nor unchanged native bytes substitutes for corrected-source proof. The original F1/F2 Red/Green counterproof records above remain unchanged; no additional Red run is invented here.
- Corrected Windows working-tree inputs were freshly enumerated and copied to `/var/tmp/slopstop-s3-igyrrwdx/source-corrected`, retaining intended uncommitted/new files, root configuration and migrations while excluding Git metadata, secrets, Windows dependencies, outputs, caches and logs. Exactly288 regular inputs (5,610,763 bytes) were copied. Relative-path/SHA256 inventory: `/var/tmp/slopstop-s3-igyrrwdx/s3-corrected-proof/source-sha256.txt`; structured manifest: `/var/tmp/slopstop-s3-igyrrwdx/s3-corrected-proof/source-manifest.json`, SHA256 `c838b0076b529cf4f133bd0ddff742035e3e8c56135a1022f1c77c90ad7423d0`. Base commit remains `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`. The actual historical-to-corrected delta was exactly the four F1/F2 source/test files and this design's evidence, recorded with before/after hashes in `correction-provenance.json`.
- Every copied input matched both Windows and Linux after snapshotting, before and after each proof command, and at final verification. Final `manifest-check-final-report.json` observed288 unchanged inputs, no problems, at `2026-09-07T02:37:44.094376+00:00`. Historical Linux input hashes and the historical evidence seal were also verified without overwriting them. This authorized publication subsequently changes only this design's two checkbox states and appended evidence; the sealed proof-time manifest and copied design remain immutable historical inputs, not a false claim that the newly appended document still has its proof-time hash.
- Actual runtime: Ubuntu WSL linux-x64, non-root UID1000, glibc2.43, Node24.19.0 and pnpm11.5.1. Source, store, lock/database fixtures and temporary staged copies were on physical Linux ext4, never the Windows v9fs mount. The retained `/var/tmp/slopstop-s3-igyrrwdx/run.sh` supplied Linux-only PATH and isolated HOME/XDG/PNPM/cache/TMP paths. Prepared Node is `tools/node-v24.19.0-linux-x64/bin/node` beneath that root; pnpm is `pnpm-home/pnpm`. The project-managed Node at `source-corrected/node_modules/node/bin/node` reported the same Linux version/architecture and matched the official prepared executable byte-for-byte.
- Official tool provenance remains in the owned root's `evidence/` and `downloads/`: `https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz` matched the official SHASUMS256 manifest with archive SHA256 `14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647`; Node executable SHA256 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`. The active official `https://registry.npmjs.org/pnpm/-/pnpm-11.5.1.tgz` matched exact-version registry SHA512 SRI `sha512-k/e1dCLqcGglcjW0wW62B2LraOHcI3IxmcxzkEPqm+LEFDJ0o5nYxt76KxF2Im2cocS2NILWIAwaj7qnjB0UhQ==` and has archive SHA256 `de7a5c1bed8301805183a87997fe1720cd5caefb57be838535a4bfc4a1596959`. The verified official native pnpm archive is retained unused because its binary lacked an execute bit; the official JavaScript CLI avoided a permissions workaround. These are official checksum/SRI checks, not independently verified signatures or attestations.
- Fresh corrected-workspace `pnpm install --frozen-lockfile` passed with normal lifecycles, adding919 packages and reusing885 payloads from the isolated Linux store without copying the old source's dependency tree. Root install-electron and husky lifecycles completed. Husky's `.git can't be found` diagnostic was retained because Git metadata was deliberately excluded; no fake repository, lifecycle-disable variable or repository `--ignore-scripts` flag was used. Cached dependency build results may be reused by unchanged pnpm policy; no claim that every cached dependency script reran. No compiler/system installation was needed or attempted.
- Exact final Linux unit command: `pnpm exec vitest run packages/protocol/src/canonical-project-protocol.test.ts packages/protocol/src/project-storage-protocol.test.ts packages/protocol/src/protocol.test.ts apps/harness/src/storage/project-storage-opening.test.ts apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/project-storage-store.test.ts apps/harness/src/storage/local-libsql-worker-client.test.ts apps/harness/src/storage/project-storage-filesystem-authority.test.ts apps/harness/src/storage/canonical-writer-lease.test.ts apps/harness/src/storage/canonical-command-repository.test.ts apps/harness/src/canonical-project-writer.test.ts apps/harness/src/active-project-coordinator.test.ts apps/harness/src/canonical-project-application.test.ts apps/harness/src/harness-runtime.test.ts` ->141 passed in14 files, exit0, empty stderr. The corrected store file passed29 cases and repository file10 cases, including the new F1/F2 regressions.
- Exact final Linux integration command: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts apps/harness/tests/integration/canonical-project-activation.integration.test.ts apps/harness/tests/integration/harness-runtime.integration.test.ts apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts` ->29 passed in4 files, exit0, empty stderr. This includes the real first/second transaction configuration reads. The separately required `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-writer-lease.integration.test.ts` also passed1 test/1 file under actual Linux Node and native binding; that case repeats one of the29 and is not another unique test.
- The exact installed-package metadata/API command in the S3 automated criterion passed against the corrected copy: version1.5.1, targetlinux-x64, `prebuilds/linux-x64`, and both tryLock/unlock functions. A separate actual dlopen observation loaded exactly `source-corrected/node_modules/fs-native-extensions/prebuilds/linux-x64/fs-native-extensions.node`, a37,096-byte regular nonsymlink file, SHA256 `13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3`. Fresh official `fs-native-extensions@1.5.1` registry/tarball downloads matched the frozen lockfile's SHA512 SRI and that loaded prebuild's bytes; official archive SHA256 `862ed3f381e7694fbb08eb0dcc5ff4b5e28c014de60c7482454c57ab4202f494`. Actual origin and integrity observations are in `native-binding.json` and `native-release-integrity.json` under the corrected evidence directory.
- `pnpm --filter @slopstop/desktop exec vite build --config vite.harness.config.ts` passed against corrected Linux source. Fresh Linux harness SHA256 is `53ce5e17cafeb164fb175d091f2b9bb428543e7e76480d4c72a1f26842588c7a` (244,620 bytes). The current Windows harness independently matched the parent-supplied SHA256 `490efa741c66a7df1e2b2ff70ba25696596d6b9ca92e851c687ea3f601f2c7b8` before and after Linux proof. These are different bundles: no cross-platform byte identity or semantic-equivalence claim is made. `final-build-hashes.json` and `bundle-comparison.diff` retain the distinction. Vite's existing EMPTY_IMPORT_META warning at local-libsql-worker-client.ts:46:45 was not suppressed or fixed; build exit remained0.
- `/bin/bash --noprofile --norc /var/tmp/slopstop-s3-igyrrwdx/s3-corrected-proof/exact-staged-native.sh` executed the unchanged S3 design snippet extracted afresh from the corrected design. Relative paths and os.tmpdir resolved into the approved Linux workspace/root; the child used `--no-global-search-paths`, cleared NODE_PATH/NODE_OPTIONS and rejected non-builtin resolution outside its own physical staged tree. Result: exit0, exactly empty stdout/stderr. Supplemental `node --no-global-search-paths /var/tmp/slopstop-s3-igyrrwdx/s3-corrected-proof/strict-staged-native-proof.cjs` used the identical design child function and explicitly required childExit0, null signal/error, stdoutBytes0 and stderrBytes0 before owned cleanup. `strict-staged-child.json` records those checks and the staged binding's matching SHA256. No loaded or unconfirmed child resource was deleted.
- Corrected report: `/var/tmp/slopstop-s3-igyrrwdx/s3-corrected-proof/REPORT.md`, SHA256 `f826f4b96bc5bec8b202f03a17f0bfc44e2cf32c66a054a03d22ecb26a558eb6`; accompanying `evidence-seal.json`, `COMMANDS.md`, `command-summary.json`, per-command argv/environment/process/exit records, raw streams and manifest checks retain exact provenance. All ten proof commands exited0 without timeout or remaining owned process-group members. No selected test failed or was reported skipped.
- Static inspection of both checked-in CI job chains confirms discovery of canonical-writer-lease.integration.test.ts through test:integration; neither CI job was dispatched or observed executing. Local Windows/Linux proof satisfies the approved location alternative, not a fabricated CI pass. The final Linux work remains source/native-staging proof, not S7 packaged Electron/ASAR/crash/takeover/sandbox proof; no Electron application was launched.
- Parent-confirmed independent review acceptance and corrected Windows/Linux source proof now complete the required S3 checkpoint. Only the two previously pending Linux automated criteria were changed to checked; all existing checked criteria, contracts, frontmatter and prior proof/history are preserved, with no content-hash stamp. This records no S4 execution, S7/package proof, integration/merge or progression authorization. The owned Linux root, both snapshots, dependency trees, downloads, manifests and evidence remain retained for the parent's later resource decision; this publication performs no cleanup, source/config/test edit, commit, staging, push or merge.

### Phase 4: Safe Project Switching

#### Approved Revision And Pre-Implementation Baseline

- The user supplied and approved revision timestamp `2026-09-07T11:29:26+0100`, author OpenCode, and the four execution groups recorded above. Before edits, `git hash-object .rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` returned exactly `a076068ab6cae674d5ee14463502c9b0bdfaa7cb`, matching the approved preservation input. This revision changes only frontmatter update metadata, the new Follow-up before TDD Evidence, and this appended Phase 4 evidence; no original behavior, Oracle, historical proof or later-slice contract is edited.
- Read `docs/agents/codescene.md`; CodeScene get_config confirmed access_token, onprem_url and account_id unset. Existing OAuth verification passed 5/5 (repository, authentication, CLI connectivity, API connectivity, runtime); no login or configuration mutation occurred. Detailed pre-write reviews of `apps/harness/src/active-project-coordinator.ts`, `apps/harness/src/canonical-project-application.ts`, `apps/harness/src/harness-runtime.ts`, `packages/protocol/src/canonical-project-protocol.ts` and `packages/protocol/src/protocol.ts` each returned score10.0 with no findings. The export-only `packages/protocol/src/index.ts` is not assessed numerically.
- Execution is blocked before protocol tests or implementation: this session exposes no context-mode execution tools, while its active command policy restricts Bash to Git/filesystem navigation and prohibits using it to run Vitest/validators. No substitute tool or policy bypass was used. This is an unavailable execution capability, not an observed Expected Red, a failing product test, or a new behavioral-contract mismatch. No S4 test, production source or fixture has been edited; none of the four groups has started Red/Green. Test-quality lint, mutation discovery, document-validator execution and final verification remain pending, not passed or asserted absent.
- Resume the approved protocol group when a policy-permitted execution tool is available. Retain the S3 F1/F2 fixes and original history, do not repeat a Red already observed by a later session, and leave every S4 implementation criterion and independent-review checkpoint pending until supported by actual evidence. No content-hash stamp or Linux-resource access was performed.
- The document write hooks reported `Node executable unavailable` and skipped validate-on-write, fence-duplication-check and Impeccable. These skipped hooks are not successful document validation; this observation does not establish that project-managed Node itself is absent.

#### Resumed S4 Execution: 2026-09-07

- The user confirmed resuming only S4 in the existing working tree, then explicitly approved preserving the artifact snapshot, formatting the historical SQLite result as inline code, recording contract hashes, and refreshing the artifact hash after validation. This is document maintenance, not a behavioral revision or retrospective proof.
- The original artifact and complete accepted S3 working-tree predecessor are preserved in `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s4-predecessor-20260907/`. Manifest SHA-256: `20c024277de00955268ed9a5f58b7c4b18783ae76607d9d1d1e86e6e2d2aeed4`; complete binary-capable patch SHA-256: `5919f33ebfb96dfe154eec4e89a515507d9c3e4be737ee757e4558ca568b847a`. All 289 included paths were verified unchanged during capture. Base commit remains `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`; no staging or commit occurred.
- Before that formatting-only edit, comparison with preserved Git blob `a076068ab6cae674d5ee14463502c9b0bdfaa7cb` confirmed unchanged S4 contract, Decisions, and prior S1-S3 evidence. S4 section SHA-256: `c7c8287262809d886c637d5d5ff227a5291b1eb2980134a76d01640a86a9fcf8`; Decisions SHA-256: `07d84892f9ba33f34c550a6c0256d17435376c3bbe690e0053616b28f8f63883`; previous evidence section SHA-256: `196f73326cfccac2bed11f833a03ee6741a4d331b3e0e553375fcbdcaa517305`. These hashes use UTF-8 with LF line endings and include the trailing section separator. The original artifact Git blob was `4f8188bf0243979c370ea34d1ebe78184d9a7f21`; its historical frontmatter hash was `fcf82f98398b662641e84a32f0f3e4346b8c8e7f0fa0e509029999684f7afab1`.
- Detailed new execution evidence is recorded separately in [S4 execution evidence](../evidence/2026-09-07_canonical-project-writer-s4.md). The historical inline evidence remains in place. No S4 criterion is satisfied merely by this resume record.
