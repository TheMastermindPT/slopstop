---
date: 2026-08-31T16:13:56+0100
author: Pedro Mesquita
commit: f4685df
branch: design/ticket-86-project-storage
repository: slopstop
topic: "Project Storage opening and health classification"
tags: [research, codebase, storage, persistence, protocol, electron]
status: complete
last_updated: 2026-08-31T16:13:56+0100
last_updated_by: Pedro Mesquita
content_hash: 341bff830751eaa300ecf35399b328b12d53623bcc83786c8651bd4e302dbc91
---

# Research: Project Storage Opening and Health Classification

## Research Question

What is the smallest durable Project Storage slice that can open or create one generation, classify canonical and runtime persistence health truthfully, preserve prior-state witnesses, and prove the behavior through the existing harness and packaged Electron boundary without implementing later Storage operations or domain owners?

## Summary

SlopStop has a proven Workspace transport boundary but no Project Storage implementation. The kernel owns only Workspace-facing Project identity, the protocol carries only Workspace projection commands, the harness composes unavailable Conversation, Frame, and Memory owners, and no package currently contains a libSQL client, Drizzle schema, migration ledger, manifest parser, registry, or persistence-health classifier (`packages/kernel/src/workspace-identifiers.ts:6-36`, `packages/protocol/src/protocol.ts:38-124`, `apps/harness/src/process-entry.ts:76-82`).

The first Storage slice requires a separate harness-owned application port and a separate top-level protocol family. `project.open(ProjectId)` resolves the installation-local registry and active generation without accepting renderer paths; `project.create` is a distinct mutating command that can initialize defaults only after proving there is no prior-state witness. A Project with no registration or witness returns `not-registered`, while expected-but-absent persistence remains `missing`. Per-database health stays independent from top-level transport and application-infrastructure failures.

Normal opening requires a valid registry selection, a compatible versioned manifest, agreement among registry, manifest, and canonical `storage_identity`, readable schema metadata, enabled and checked foreign keys, SQLite integrity, migration compatibility, and applicable domain invariants. Either database being non-healthy forces read-only Storage safe mode. Active-generation checksums remain labelled activation baselines; live databases are validated through metadata, identities, SQLite checks, and domain invariants rather than compared byte-for-byte with immutable activation hashes.

The first consumer should be a new main-process Project-opening bridge over the existing harness session. It should not extend `WorkspaceApplication`, `WorkspaceBridge`, preload, or renderer APIs. Packaged proof should exercise healthy opening, canonical-readable/runtime-unhealthy safe mode, legitimate `not-registered`, and a prior-state witness that must never degrade to fresh initialization.

## Detailed Findings

### Current Implementation Baseline

- `packages/kernel` currently owns a generic branded `DomainIdentity`, `ProjectId`, Workspace-scoped identities, and projection revisions only (`packages/kernel/src/workspace-identifiers.ts:6-36`).
- `packages/protocol` exposes Zod schemas for Workspace scopes, queries, intents, projections, and process envelopes; it has no Project-opening command or persistence-health result (`packages/protocol/src/workspace-protocol.ts:22-101`, `packages/protocol/src/protocol.ts:38-124`).
- `WorkspaceApplication` is closed over Conversation, Frame, and Memory owner ports (`apps/harness/src/workspace-application.ts:42-76`, `apps/harness/src/workspace-application.ts:194-220`).
- Production harness composition installs unavailable ports for all three Workspace owners (`apps/harness/src/workspace-application.ts:250-255`, `apps/harness/src/process-entry.ts:76-82`).
- `startHarnessRuntime()` parses, correlates, and dispatches only handshake and Workspace commands; it owns transport behavior rather than persistence truth (`apps/harness/src/harness-runtime.ts:39-112`).
- `WorkspaceBridge` correlates Workspace queries and intents and applies projection-revision rules that do not apply to Storage health (`apps/desktop/src/main/workspace-bridge.ts:23-35`, `apps/desktop/src/main/workspace-bridge.ts:135-181`, `apps/desktop/src/main/workspace-bridge.ts:254-293`).
- The packaged smoke currently proves the narrow renderer API and truthful unavailable Workspace outcomes, not persistence (`apps/desktop/src/main/package-smoke-verifier.ts:21-65`, `apps/desktop/src/main/package-smoke-verifier.ts:111-120`).
- No production source contains a Project Storage adapter, application registry, Drizzle schema, generated SQL migration, manifest schema, or the Storage/database-lineage identities required by ADR 0006.

### Identity And Authority Boundaries

- `ProjectId` remains kernel-owned because it identifies canonical Project state independently of storage location and generation (`packages/kernel/src/workspace-identifiers.ts:6-10`, `CONTEXT.md:13-19`).
- `StorageId`, `StorageGenerationId`, canonical database lineage, and runtime database lineage belong to the harness/application Storage subsystem until a concrete process-boundary value requires a protocol schema. They are not Workspace projection identities (`docs/adr/0006-physical-persistence-layout.md:15-18`).
- The installation registry selects a Storage and active generation but owns no canonical Project truth (`docs/adr/0006-physical-persistence-layout.md:15-18`, `CONTEXT.md:13`).
- `slopstop.db` is the directly queryable canonical authority. `mastra.db` is runtime-private except for SlopStop's adapter-owned handoff and metadata namespace (`docs/adr/0006-physical-persistence-layout.md:16`, `docs/adr/0006-physical-persistence-layout.md:102-104`).
- Electron main may provide the trusted application storage root derived from `userData`, supervise the utility process, and correlate opening requests. It must not classify persistence or select generations independently (`apps/desktop/src/main/main.ts:177-196`, `apps/desktop/src/main/main.ts:119-126`).

### Opening Protocol And Outcome Model

- Storage opening needs a new top-level command/result family beside `workspace.query`; adding a Storage capability to Workspace would conflate persistence state with presentation projection state (`packages/protocol/src/protocol.ts:45-54`, `packages/protocol/src/workspace-protocol.ts:75-101`).
- `project.open(ProjectId)` is a read/classify request. The harness resolves the registry, location, and active generation from installation-owned state. The caller does not pass an arbitrary filesystem path or choose a generation.
- `project.create` is a distinct mutating command. It may create the registry and first generation only after a complete witness inspection proves expected absence (`docs/adr/0005-storage-lifecycle-and-recovery.md:24`).
- `not-registered` is an opening outcome for a Project with neither registration nor prior-state witness. It carries no fabricated database health and permits a separate create proposal.
- `missing` means persistence was expected because at least one witness exists but a required database, manifest, generation, or registry target is absent (`PRODUCT.md:84`, `CONTEXT.md:18-22`).
- Canonical and runtime database health use the independent vocabulary `healthy`, `migration-required`, `recovery-required`, `missing`, `corrupt`, `identity-conflict`, `unsupported-newer`, `unavailable`, and `broken` (`CONTEXT.md:18`).
- Either database being non-healthy forces read-only Storage safe mode; only diagnosis and later explicit recovery operations are eligible (`CONTEXT.md:21`, `docs/adr/0005-storage-lifecycle-and-recovery.md:23`).
- Application infrastructure failures remain outside per-database health. Inaccessible storage infrastructure is `unavailable`; malformed or internally inconsistent application-owned state, unexpected classifier failure, or an untrustworthy result is `broken`. Neither can degrade to `not-registered`, `missing`, or healthy (`.rpiv/decisions/degrade-distinguishes-broken.md:18-24`).
- Migration execution remains outside this slice. `migration-required` therefore opens in safe mode and preserves the evidence required by a later explicit migration operation (`docs/adr/0005-storage-lifecycle-and-recovery.md:20-24`).

### Physical Opening And Validation Chain

1. Open installation-owned `application.db`, validate its schema metadata, and read registry, location, generation, journal, and tombstone witnesses (`docs/adr/0006-physical-persistence-layout.md:15`, `docs/adr/0006-physical-persistence-layout.md:107-114`).
2. Resolve exactly one active generation for the selected Storage. The active pointer chooses what to inspect but does not override manifest or canonical identity (`docs/adr/0006-physical-persistence-layout.md:18`, `docs/adr/0006-physical-persistence-layout.md:111-112`).
3. Require the generation triplet `manifest.json`, `slopstop.db`, and `mastra.db` (`docs/adr/0006-physical-persistence-layout.md:15-16`).
4. Parse the manifest using a versioned schema and reject unsupported-newer versions without downgrade. Validate Project, Storage, generation, database-lineage, schema-head, relative-filename, provenance, waterline, and activation-checksum fields (`docs/adr/0006-physical-persistence-layout.md:119-124`).
5. Read each database's SlopStop-owned metadata before normal ORM access. Do not use `PRAGMA user_version` or schema push as release migration authority (`docs/adr/0006-physical-persistence-layout.md:121-122`).
6. Prove agreement among the registry selection, manifest identities, canonical `storage_identity`, database kind, database lineage, and schema metadata (`docs/adr/0006-physical-persistence-layout.md:18`, `docs/adr/0006-physical-persistence-layout.md:124`).
7. Enable foreign-key enforcement per connection and verify it explicitly. Run foreign-key integrity separately from SQLite integrity because `integrity_check` does not detect foreign-key violations (`docs/adr/0006-physical-persistence-layout.md:25`, `docs/adr/0006-physical-persistence-layout.md:124`).
8. Validate applicable domain invariants, including the acyclic `blocks` graph when those tables exist (`docs/adr/0006-physical-persistence-layout.md:81`, `docs/adr/0006-physical-persistence-layout.md:124`).
9. Preserve later owner-specific opening checks as conditional checks introduced with their first exercised behavior. Empty future program tables must not be created merely to satisfy an ADR catalogue (`docs/adr/0006-physical-persistence-layout.md:56-58`, `docs/adr/0006-physical-persistence-layout.md:125`).
10. Return normal writable eligibility only when registry agreement and both database health values are healthy.

### Prior-State Witnesses And Non-Destructive Opening

- The complete witness set includes registry records, repository markers, manifests, generation directories, database files, WAL/SHM sidecars, local snapshots, deletion tombstones, and unfinished Storage-operation journals (`docs/adr/0005-storage-lifecycle-and-recovery.md:24`, `CONTEXT.md:22`).
- Any witness blocks fresh initialization and requires an explicit `missing`, `corrupt`, `identity-conflict`, or `recovery-required` classification (`PRODUCT.md:84`).
- `application.db` remains outside Project generations and is the surviving source for expected identity, generation, location, operation, and tombstone evidence when a generation is missing or unreadable (`docs/adr/0006-physical-persistence-layout.md:15`, `docs/adr/0006-physical-persistence-layout.md:109-114`).
- Sidecar presence is evidence to inspect, not proof of corruption. SQLite may legitimately retain WAL, SHM, or rollback-journal state after an unclean close.
- Opening is non-destructive. It may not select an older generation automatically, erase uncertain output, reconstruct a registry, run a migration, reset runtime storage, or remove witnesses (`docs/adr/0005-storage-lifecycle-and-recovery.md:22-26`).
- The active and immediately prior generations must remain intact for later recovery behavior even though this slice does not implement that recovery (`docs/adr/0005-storage-lifecycle-and-recovery.md:26`).
- Active-generation manifest hashes remain activation baselines after live database mutation (`docs/adr/0006-physical-persistence-layout.md:119-120`). Live opening therefore uses schema metadata, identities, SQLite checks, and domain invariants rather than byte equality with those baselines.

### Persistence Driver And Migration Constraints

- Current primary documentation supports `@libsql/client` with `drizzle-orm/libsql` for production Drizzle integration and `drizzle-orm/libsql/migrator` for programmatic generated SQL migrations.
- `@tursodatabase/database` is recommended by Turso for new embedded applications but its Drizzle integration is currently beta, so it is not the lower-risk first production choice.
- Generated SQL migrations must be packaged as runtime-readable resources; the packaged application cannot depend on Drizzle Kit CLI execution.
- SQLite foreign-key enforcement is connection-local and must be enabled outside a transaction, read back, and checked with `foreign_key_check` separately from `integrity_check`.
- Read-only SQLite URI mode exists, but current `@libsql/client` documentation does not guarantee URI `mode=ro` forwarding. The exact packaged version needs a probe before read-only URI behavior can be treated as a safety boundary.
- WAL state spans the database and sidecars. A main database file alone is not a complete snapshot or reliable witness classification.
- Cross-database crash atomicity must not be assumed. SQLite multi-file atomic commit does not provide the required guarantee under WAL, matching the ADR prohibition on pretending one transaction covers `application.db`, `slopstop.db`, and `mastra.db`.

Primary documentation:

- https://docs.turso.tech/sdk/ts/reference
- https://orm.drizzle.team/docs/sqlite/get-started-sqlite
- https://orm.drizzle.team/docs/sqlite/migrations
- https://www.electronjs.org/docs/latest/api/utility-process
- https://sqlite.org/foreignkeys.html
- https://sqlite.org/pragma.html
- https://sqlite.org/uri.html
- https://www2.sqlite.org/wal.html
- https://sqlite.org/lang_attach.html

### First Consumer And Packaged Proof

- The first desktop consumer should be a new Project-opening bridge over `HarnessSessionClient`, not an extension of `WorkspaceBridge` (`apps/desktop/src/main/workspace-bridge.ts:109-181`).
- The bridge correlates protocol messages and translates session loss to transport failure while forwarding validated Storage classifications without owning them.
- The trusted application storage root may enter harness bootstrap from Electron main. Project selection happens later through `project.open(ProjectId)`, so startup readiness does not imply an opened Project (`apps/harness/src/process-entry.ts:68-82`).
- Renderer and preload should not expose Project Storage opening until a concrete renderer feature requires it; the existing six-method package-smoke assertion remains a useful regression boundary (`apps/desktop/src/preload/preload.ts:13-54`, `apps/desktop/src/main/package-smoke-verifier.ts:21-65`).
- Packaged proof should use real temporary `userData` storage and the built harness artifact to exercise four outcomes: healthy open, canonical-readable/runtime-unhealthy safe mode, `not-registered`, and a broken or recovery-required prior-state witness.
- The prior-state case is the essential false-clean regression: the package must prove that malformed/inconsistent existing state does not trigger `project.create` or return `not-registered`.

## Code References

- `packages/kernel/src/workspace-identifiers.ts:6-36` - Existing framework-independent identity and revision primitives.
- `packages/protocol/src/workspace-protocol.ts:22-101` - Existing ProjectId Zod schema and Workspace-only query boundary.
- `packages/protocol/src/workspace-protocol.ts:495-632` - Workspace result and notification unions that must not absorb Storage health.
- `packages/protocol/src/protocol.ts:38-124` - Top-level process command/event envelopes and correlation pattern.
- `packages/protocol/src/protocol.ts:283-352` - Existing message constructor pattern.
- `apps/harness/src/workspace-application.ts:28-36` - Existing owner outcome precedent.
- `apps/harness/src/workspace-application.ts:78-148` - Ready-result revalidation and unavailable/broken translation.
- `apps/harness/src/workspace-application.ts:194-255` - Workspace routing and production unavailable composition.
- `apps/harness/src/harness-runtime.ts:39-112` - Harness process dispatch and unexpected-failure boundary.
- `apps/harness/src/process-entry.ts:44-100` - Production utility-process bootstrap and composition point.
- `apps/desktop/src/main/workspace-bridge.ts:109-181` - Existing main-process request/correlation precedent.
- `apps/desktop/src/main/workspace-bridge.ts:254-293` - Workspace-specific revision logic not applicable to Storage.
- `apps/desktop/src/main/main.ts:119-126` - Electron renderer isolation settings.
- `apps/desktop/src/main/main.ts:177-203` - Supervisor/bridge composition and packaged-smoke orchestration.
- `apps/desktop/src/preload/preload.ts:13-54` - Current narrow renderer API.
- `apps/desktop/src/main/package-smoke-verifier.ts:21-65` - Existing packaged renderer assertions.
- `apps/desktop/src/main/package-smoke-verifier.ts:111-120` - Package-smoke result validation.
- `apps/desktop/package.json:10-13` - Current packaging and smoke scripts.
- `docs/adr/0005-storage-lifecycle-and-recovery.md:20-26` - Migration, safe-mode, witness, and retained-generation rules.
- `docs/adr/0006-physical-persistence-layout.md:13-25` - Physical ownership, identities, and foreign-key rules.
- `docs/adr/0006-physical-persistence-layout.md:107-125` - Registry tables, manifest, metadata, migration, and opening integrity contracts.
- `PRODUCT.md:82-84` - Product-level storage ownership and false-clean prohibition.
- `CONTEXT.md:13-22` - Registry, database lineage, generation, health, safe-mode, and witness vocabulary.
- `.rpiv/decisions/degrade-distinguishes-broken.md:18-24` - Binding failure-versus-absence rule.

## Integration Points

### Inbound References

- `apps/desktop/src/main/main.ts:177-196` - Main process constructs harness supervision and request bridges.
- `apps/harness/src/process-entry.ts:68-82` - Utility-process bootstrap receives trusted configuration and constructs the harness application.
- `packages/protocol/src/protocol.ts:38-124` - Every desktop-to-harness request and response crosses the versioned envelope.

### Outbound Dependencies

- `application.db` - Installation-owned registry, location, generation, schema, journal, and tombstone evidence under Electron `userData`.
- `manifest.json` - Versioned cross-file identity and activation-baseline record.
- `slopstop.db` - Canonical Project identity, storage identity, schema metadata, and later canonical state.
- `mastra.db` - Runtime database lineage and SlopStop-owned adapter metadata without inspection authority over Mastra-private schema.
- SQLite/libSQL - Connection, integrity, foreign-key, WAL, and read-only behavior that must be verified against the packaged runtime.
- Drizzle generated migrations - Forward-only schema artifacts shipped with the application.

### Infrastructure Wiring

- `apps/harness/src/process-entry.ts:44-100` - Composition root for the Storage opener and trusted application-storage root.
- `apps/harness/src/harness-runtime.ts:62-96` - Dispatch point for new Project create/open commands and internal-failure conversion.
- `apps/desktop/src/main/main.ts:177-203` - Main-process bridge composition and packaged proof trigger.
- `apps/desktop/tests/e2e/package-smoke.mjs:21-28` - Packaged launch environment and fixture orchestration precedent.
- `apps/desktop/package.json:10-13` - Packaging command boundary.

## Architecture Insights

- Project identity, installation registry, physical Storage, canonical state, runtime persistence, Workspace projections, and transport failures are separate authority axes. A single generic status or owner would erase required recovery information.
- The existing Workspace tracer bullet is a transport and testing template, not the place to add Storage behavior. A sibling port/bridge keeps Workspace projection revisions and capability errors from leaking into persistence contracts.
- `project.open` is an observation/classification boundary; `project.create` is an effectful state transition. Combining them would make a read request capable of destroying the strongest prior-state invariant.
- `not-registered` is necessary because absence before creation is neither healthy persistence nor expected persistence that has gone missing.
- Opening must be conservative and non-destructive. Registry reconstruction and migration are recovery operations, not convenient fallbacks inside classification.
- Owner-specific tables and invariants land with first behavior, so the first generation can be structurally real without pre-creating Execution, Evidence, Memory, or Integration schemas.
- Packaged proof is part of the architecture because `userData`, native database code, migration resources, ASAR, utility-process loading, sandbox configuration, and Windows paths cannot be established by unit tests alone.

## Precedents & Lessons

Four relevant change families were analyzed.

### Precedent: Workspace Production Boundary

**Commit(s)**: `c3ac1e8` - "feat(workspace): establish production boundary tracer bullet" (2026-08-25)

**Blast radius**: 38 files across kernel, protocol, harness, Electron main, preload, renderer, integration tests, and package smoke.

**Follow-up fixes**:

- Mutation review found that retry before prior utility-process exit could leave stale timer/session/child state. The final implementation clears and detaches prior lifecycle resources before spawning a replacement (`.rpiv/artifacts/validation/2026-08-25_20-05-32_workspace-production-boundary-tracer-bullet.md:38-43`).

**Lessons from docs**:

- `.rpiv/artifacts/plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md` - Existing production boundary and vertical proof plan.
- `.rpiv/artifacts/validation/2026-08-25_20-05-32_workspace-production-boundary-tracer-bullet.md` - Completed boundary validation and retry-race lesson.

**Takeaway**: Keep owner results, protocol validation, transport failures, lifecycle cleanup, renderer isolation, and packaged proof as separate but connected phases.

### Precedent: Initial Electron And Harness Foundation

**Commit(s)**: `1789aad` - "feat: establish the SlopStop foundation" (2026-08-20)

**Blast radius**: 99 files across protocol, harness, Electron main/preload/renderer, diagnostics, packaging, and E2E.

**Follow-up fixes**:

- `1b0a875` - "fix(ci): make path assertions cross-platform" (2026-08-20).
- `cb4a683` - "fix(ci): configure packaged Electron sandbox" (2026-08-20).

**Takeaway**: Windows paths, packaged sandboxing, and the built utility-process artifact require direct proof rather than portable-unit-test inference.

### Precedent: Storage Decision Authority

**Commit(s)**: `4ddd542` - "docs(storage): define lifecycle and recovery semantics" (2026-08-26); `171aeb8` - "docs(persistence): define physical storage layout" (2026-08-26)

**Blast radius**: decision and vocabulary documents only; no production persistence source.

**Follow-up fixes**:

- `1ee96e3` - "docs(persistence): preserve packaged boundary evidence" (2026-08-31) clarified proof lineage without adding an adapter.

**Takeaway**: ADR acceptance fixes constraints but does not prove a registry, migration, database, or opener exists.

### Composite Lessons

- Model every boundary as a closed union and re-parse untrusted results before changing authority.
- Prove false-clean and stale-lifecycle behavior, not only healthy creation/opening.
- Ship generated migrations as package resources and probe their actual packaged location.
- Treat sidecars and operation journals as witnesses whose uncertainty blocks creation.
- Never claim atomicity across installation, canonical, and runtime databases.

## Historical Context (from `.rpiv/artifacts/`)

- `.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md` - Runtime constraints and program ordering evidence.
- `.rpiv/artifacts/research/2026-08-25_14-22-52_workspace-production-boundaries.md` - Workspace process-boundary research.
- `.rpiv/artifacts/plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md` - Implemented Workspace boundary plan.
- `.rpiv/artifacts/validation/2026-08-25_20-05-32_workspace-production-boundary-tracer-bullet.md` - Workspace boundary validation.

## Developer Context

**Q (`apps/harness/src/process-entry.ts:68-82`, `docs/adr/0006-physical-persistence-layout.md:15-18`): What contract opens the initial Project?**

A: Bootstrap carries only the trusted application-storage root. A separate `project.open(ProjectId)` command makes the harness resolve Storage and active generation through the registry.

**Q (`docs/adr/0005-storage-lifecycle-and-recovery.md:24`, `packages/protocol/src/protocol.ts:45-53`): How is the first generation created?**

A: Creation uses a separate `project.create` mutating command. `project.open` never initializes defaults.

**Q (`docs/adr/0006-physical-persistence-layout.md:119-120`): How are active-generation checksums interpreted?**

A: They remain labelled activation baselines. Live opening validates metadata, identities, SQLite integrity, and domain invariants without comparing mutable database bytes to activation hashes.

**Q (`CONTEXT.md:18-21`, `apps/harness/src/workspace-application.ts:28-36`): What represents a Project with no registration or witness?**

A: The opening result is `not-registered`, distinct from expected persistence that is `missing` and from an unavailable capability or infrastructure.

## Related Research

- `.rpiv/artifacts/research/2026-08-25_14-22-52_workspace-production-boundaries.md`
- `.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md`

## Open Questions

- The exact packaged `@libsql/client` version must prove whether SQLite URI `mode=ro` is forwarded before read-only URI behavior can become a safety boundary.
- The design must define the minimum SlopStop-owned runtime metadata needed to classify `mastra.db` without inspecting or claiming Mastra-private schema authority (`docs/adr/0006-physical-persistence-layout.md:121-122`).
- Active-Project selection and renderer initiation are outside this slice; no current source establishes whether a later application session automatically reopens a previously selected Project.
