# ADR 0006: Physical Persistence Layout

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

The accepted Project identity, command settlement, profile, onboarding, status, Board, writer, runtime-handoff, and Storage-lifecycle contracts need one physical layout before implementation can be designed. The canonical database must remain directly queryable without event replay, Mastra must retain private ownership of runtime persistence, and the installation registry must locate and operate Storage without becoming Project truth. SQLite cannot provide a transaction across the canonical and runtime databases, so identities, manifests, migration metadata, handoffs, and recovery evidence must make every cross-database outcome explicit.

## Decisions

### Files And Authority

- Keep `application.db` under Electron `userData`. It owns installation-scoped mutable profile state, Diagnostic consent, credential references, the reconstructible Storage registry, Storage-operation journals, and deletion tombstones. It contains no canonical Project content or credential values.
- Store each Project Storage generation as `manifest.json`, `slopstop.db`, and `mastra.db`. `slopstop.db` is the directly queryable authority for Project state. `mastra.db` is runtime-private except for the adapter-owned handoff namespace.
- Use independent opaque `ProjectId`, `StorageId`, and `StorageGenerationId` values. Moving a Storage preserves `StorageId`; migration, restore, import, or runtime reset activates a new `StorageGenerationId` without changing `ProjectId`.
- Let the registry's active-generation pointer select the local files to open, but require it to agree with the manifest and the `storage_identity` row in `slopstop.db`. Registry state is reconstructible location data, not an alternative source of Project truth.

### SQLite Representation

- Store branded UUIDs as lowercase `TEXT`, RFC 3339 UTC instants as `TEXT`, non-negative sequences and versions as `INTEGER` with checks, and booleans as `INTEGER` constrained to `0` or `1`. Validate complete UUID and timestamp syntax with the versioned Zod boundary schemas before persistence.
- Include `project_id` in every canonical primary, unique, and foreign key. A reference to another canonical entity uses a composite `(project_id, entity_id)` key so cross-Project references cannot be represented.
- Keep identity, status, relationship, filter, and ordering fields relational. Permit versioned JSON only for immutable variable provider, tool, or external payload details. Do not index JSON.
- Enable and verify foreign keys for every connection. Use `RESTRICT` or `NO ACTION` for canonical identities and history. Use `CASCADE` only for aggregate-private child rows that have no independent identity or history.

### Aggregate And Revision Shape

- Give each revisioned aggregate a current table and an immutable revision table. Current rows use `(project_id, aggregate_id)` as their primary key and hold `entity_version`, `current_revision_id`, archive state, and only the fields required for direct current-state queries.
- Key revisions by `(project_id, aggregate_id, revision_id)` and make `(project_id, aggregate_id, revision_number)` unique. Record acceptance sequence, accepting actor, command receipt, entity version, and the optional superseded revision.
- Use deferred composite foreign keys between a current row and its current revision, between a revision and its aggregate identity, and from `supersedes_revision_id` to a revision of the same aggregate. This permits atomic creation of an identity and its first revision without exposing an incomplete row.
- Enforce the expected current `entity_version`, strictly increasing revision number, and valid supersession head in the kernel transaction. Restoring old content accepts a new revision derived from that content; it never rewinds a current pointer to rewrite history.
- Store ordered revision content in private child tables with a non-negative `position` unique within the revision. Give independently addressable child elements opaque IDs unique within that revision.

### Physical Table Families

`slopstop.db` owns these trust-spine families:

| Owner | Tables |
| --- | --- |
| Identity | `project_state`, `storage_identity`, `repository_bindings`, `workspaces` |
| Writer | `writer_fence`, `writer_generations`, `writer_handoffs`, `writer_recovery_records` |
| Map | `features`, `feature_revisions`, `waypoints`, `waypoint_revisions`, `waypoint_relationships`, `waypoint_relationship_revisions`, `worker_task_promotions` |
| Contracts | current and revision tables for Behavior, Test, and Completion contracts plus their private ordered child tables |
| Settlement | `command_idempotency`, `command_receipts`, `command_rejections`, `canonical_events` |
| Status | `project_status_transitions`, `project_status_transition_conditions`, `waypoint_status_transitions`, `waypoint_status_transition_conditions` |
| Onboarding | `onboarding_sources`, `onboarding_observations`, `onboarding_decisions`, `onboarding_decision_dependencies`, `onboarding_decision_reuses`, `onboarding_readiness` |
| Profiles | `project_profiles`, `project_profile_revisions`, and revision children for provider overrides, tool decisions, exact Capability-version decisions, and restrictions |
| Board | `board_admission_policy_versions`, `board_entries`, `board_message_sources`, `board_execution_sources`, `board_supersessions`, `board_read_positions` |
| Durable workspace | `conversations`, `conversation_branches`, `conversation_messages`, `conversation_context_records`, `frame_drafts` |
| Execution invocation context | `invocation_context_records`, `invocation_context_sources`, `invocation_context_transformations`, `invocation_context_retrievals`, `invocation_context_recent_turn_slices`, `invocation_context_compactions`, `invocation_context_artifacts` |
| Runtime handoff | `runtime_handoffs`, `runtime_handoff_attempts`, `runtime_acknowledgements`, `runtime_outcomes` |
| Migration metadata | `schema_metadata` |

- Keep Identity-owned `workspaces` for the application Workspace protocol used by Conversation, Frame, and Memory projections. It is not an Execution checkout or Run workspace. ADR 0008 owns the separate `run_workspaces` physical family; no foreign key may use one identity in place of the other.
- Keep conversation and Frame-draft rows durable in `slopstop.db`, but outside canonical command sequence, revision, and event authority until an explicit accepted command turns a proposal into canonical state.
- Do not create empty tables for program behavior still owned by Execution, Evidence, Memory, Language, or Frame. ADR 0009 defines the Execution invocation-context family, but its migration still lands only with its first behavior. Other migrations add owner-specific entities and status-transition tables later while following this key and revision contract. Exact Capability catalogue acceptance, Project enablement, and future Run policy epochs remain distinct owner records; a Project-profile child stores an exact accepted Capability-version reference rather than collapsing those gates.

### Commands And Canonical Events

- Key `command_idempotency` by `(project_id, command_id)`. It records the normalized original fingerprint and original receipt. Key receipts by `(project_id, receipt_id)`, make `(project_id, command_id, command_fingerprint)` unique, and make each first durable result's `(project_id, project_sequence)` unique.
- Return the original receipt for an exact retry without allocating a new sequence. A reused command ID with a different fingerprint creates one durable `IDEMPOTENCY_CONFLICT` rejection receipt per distinct conflicting fingerprint.
- Persist applied, unchanged, and rejected settlements. Give rejected receipts one structured `command_rejections` row. Unexpected command failures remain non-durable failures and cannot masquerade as rejections.
- Insert Canonical events only for applied receipts. Key events by `(project_id, event_id)`, make `(project_id, project_sequence, event_ordinal)` unique, and bind every event to its receipt, aggregate identity, aggregate version, event type/version, immutable payload, and payload hash. All events from one applied receipt share its Project sequence.
- Fence settlement against the current `writer_fence` generation. Stamp the receipt with that durable Writer generation; revisions, transitions, and events trace their authority through the receipt. The operating-system lease remains the only permission to acquire Writer authority.

### Status Storage

- Keep current status columns on the aggregate that owns them. Persist append-only transitions in owner-specific tables with real composite foreign keys, never in one polymorphic status table.
- Record status family and version, axis, prior and next state, cause code, command receipt, actor, Project sequence, and entity version. Store ordered, de-duplicated condition codes in private transition-condition rows.
- Use Project transition rows for Project lifecycle and onboarding readiness, and Waypoint transition rows for Waypoint status. Registry location and persistence transitions remain installation-owned in `application.db`. Future Run, Worker, Control-request, Process-job, Finding, and Integration owners add equivalent tables with their own entity foreign keys.
- Keep Action availability as a derived live projection. It is never accepted or persisted as a status decision.

### Map Constraints

- Make every current Waypoint belong to exactly one current Feature. Store Feature membership in the accepted Waypoint revision so moving a Waypoint requires a new accepted revision. Permit Project-local relationships across Features.
- Treat each Waypoint relationship as a revisioned aggregate. Denormalize its current type and endpoints into the current row for map queries, while the accepted revision remains the content authority.
- Reject self-relations. Store `related-to` endpoints in lowercase UUID order so one canonical row represents the symmetric pair. Make active `(project_id, relationship_type, source_waypoint_id, target_waypoint_id)` unique.
- Keep `blocks` and `derived-from` directed. Validate `blocks` acyclicity in the single-Writer kernel transaction and repeat that validation during open, migration, restore, and import. Do not duplicate graph traversal in a SQL trigger. No accepted contract currently requires `derived-from` to be acyclic.
- Record promotion of a Worker task to a new independently framed Waypoint in `worker_task_promotions`. A Worker task is provenance, not a false endpoint in the Waypoint relationship graph.

### Onboarding And Profiles

- Persist immutable, versioned onboarding source, observation, and decision identities. Bind decision dependencies to semantic fingerprints and record explicit reuse links so a changed dependency stales only affected decisions. Keep current readiness directly queryable and preserve its transition history.
- Keep the Application profile as mutable singleton state with optimistic versioning in `application.db`, accompanied by append-only `application_profile_audit_events`. It has no immutable accepted-revision chain.
- Keep Project profiles as revisioned canonical aggregates. Normalize provider overrides, tool decisions, exact Capability-version decisions, and restrictions into revision child rows. Derive effective policy from the accepted Project profile plus separately owned live ceilings, revocations, and future Run policy epochs; do not persist a flattened effective-policy authority.

### Board And Durable Workspace

- Give each `board_entries` row an opaque identity, one unique Project-wide Board position, one Waypoint, source kind, source and acceptance times, admission-policy version, Project-feed eligibility, and attribution metadata. Source content remains outside Board.
- Require exactly one private source row in either `board_message_sources` or `board_execution_sources`. Make each stable source reference unique within the Project so idempotent admission cannot create duplicate entries. Validate the required one-of-two child shape in the admission transaction and during integrity checks.
- Represent correction links in `board_supersessions`. Make the replacing entry unique and the replaced entry unique so a chain cannot branch; the command also requires the expected current head.
- Key read positions by Project and exact scope, allowing one Project-feed position and one position per Waypoint. A read position can only advance to a confirmed contiguous Board position.
- Give conversations Project or Waypoint scope, acyclic branches, immutable messages, and cursor order. Keep Conversation-owned immutable Context records linked to exact response messages and separate from mutable Frame drafts. None of these rows gains canonical authority through storage location alone.
- Keep Execution-owned Invocation context records in their own table family. They target an exact Waypoint parent or Worker candidate and never reuse `conversation_context_records`, `ContextRecordId`, or the Conversation projection's required `responseMessageId`.

### Runtime Handoff And Writer Recovery

- Store immutable canonical requests in `runtime_handoffs`, append-only delivery attempts in `runtime_handoff_attempts`, and distinct acknowledgements and outcomes in their own tables. Bind them to the exact runtime database lineage and Storage generation.
- Reserve the adapter-owned `slopstop_runtime_inbox`, `slopstop_run_reservations`, and `slopstop_runtime_results` tables inside `mastra.db`. Do not add foreign keys across databases or inspect Mastra-private tables as canonical state.
- Make handoff request identity and hash unique on both sides. At-least-once delivery may repeat an attempt, while inbox identity and stable Run reservation make processing idempotent. Reconcile uncertain acknowledgement or outcome from durable evidence instead of replaying or guessing.
- Keep Writer generations, directed handoffs, and recovery checks durable. Keep access sessions and heartbeat samples as replaceable operational projections; they are not canonical history. A heartbeat never grants Writer authority.

### Installation Registry And Diagnostics

`application.db` contains `application_state`, `application_profile_audit_events`, `diagnostic_consent_state`, `diagnostic_consent_decisions`, `diagnostic_delivery_outcomes`, `credential_references`, `storage_registrations`, `storage_locations`, `storage_generations`, `storage_operations`, `storage_operation_steps`, `storage_tombstones`, and `schema_metadata`.

- Key registration by `storage_id`, bind it to one `project_id`, and point it to the active `generation_id` and location. Keep observed locations and generations separately so move and recovery evidence are not overwritten. Use one partial unique active-generation index per Storage and reject an already registered Project identity during import.
- Keep normalized machine-local paths only in `storage_locations`; exclude them from Project persistence, manifests, portable exports, and transmitted diagnostics. Credential references contain operating-system secret identifiers, never secret values.
- Journal Storage operations and their idempotent owned steps outside every generation they may alter. Keep deletion tombstones until destructive cleanup is proven complete.
- Store versioned Diagnostic-consent decisions and current consent separately. Delivery outcomes contain only destination, disclosure version, allowlisted result or error, and local correlation. They contain no event payload, prompt, source, model output, secret, environment value, or full path and are never replay queues.

### Manifests, Migrations, And Opening Proof

- Validate `manifest.json` with a versioned schema. Record Project, Storage, Storage-generation, snapshot when applicable, canonical and runtime database-lineage identities, source generation, database kinds and schema or migration heads, relative filenames, producing application version, UTC creation time, operation identity, Project sequence, runtime waterline, and checksum metadata. Exclude absolute paths, credentials, and Project content.
- Treat size and SHA-256 as exact proof for sealed staged generations and snapshots. If an activated database later changes, retain the checksum only as an explicitly labelled activation baseline; never present it as a hash of current live content.
- Use packaged, generated Drizzle migrations as the executable migration ledger for schemas owned by SlopStop. Keep `schema_metadata` directly readable before normal ORM access with database kind, format version, schema version, and last migration identity. Do not use schema push or `PRAGMA user_version` as authority.
- Let the Mastra adapter migrate only its prefixed handoff tables and let Mastra own its private schema. Record both runtime migration heads in the manifest without making either one canonical Project state.
- Compose migrations from ordered trust-spine, onboarding, map-and-contract, Board-and-conversation, and runtime-handoff modules. A migration cannot depend on an optional future owner or remove shared history when a module is retired.
- Open a Storage only after checking manifest compatibility, cross-file identities, migration metadata, foreign-key integrity, domain invariants including the `blocks` graph, and registry agreement. A genuine failure enters the exact read-only safe-mode state; it never degrades to an empty or clean Project.

### Required Indexes

- Use primary and unique indexes for all identities, aggregate revision numbers, current revision references, command idempotency keys, Project sequences, event ordinals, Board positions, source references, supersession links, ordered child positions, and runtime request hashes.
- Index current Features by Project and archive state; current Waypoints by Project, Feature, status, and archive state; and current relationships by source, target, type, and active state. Use a partial unique index for active normalized relationship endpoints.
- Index status transitions by owner and descending Project sequence; receipts and events by Project sequence; Board entries by Project position and Waypoint plus position; read positions by exact scope; conversations by scope, branch, and cursor; onboarding records by source, semantic dependency fingerprint, decision, reuse, and readiness; and registry records by Project, Storage, generation, normalized location, and operation state.
- Add no full-text or speculative JSON indexes in this decision. Full-text search needs separate volume, ranking, privacy, and migration requirements.

## Consequences

- Current Project state, accepted history, command settlement, Board order, and recovery evidence can be queried directly without replaying Canonical events or joining Mastra-private data.
- Composite keys, deferred revision links, normalized relationship endpoints, family-owned transition tables, and owner-scoped indexes make invalid cross-Project or polymorphic references difficult to represent, at the cost of more tables and explicit migrations.
- The registry may be rebuilt without redefining Project truth, while operation journals and tombstones continue to prevent dangerous fresh initialization.
- Cross-database handoff and activation remain more complex than a shared database, but retries, uncertainty, runtime reset, and recovery preserve their real meaning instead of simulating atomicity.
- This decision defines layout and constraints only. Numeric limits, program-specific payload schemas, full-text search, and owner behavior for Execution, Evidence, Memory, Language, and Frame remain with measured evidence and their own designs.
