# ADR 0002: Project Canonical State

- Status: Accepted
- Date: 2026-08-21
- Decision owners: Pedro Mesquita

## Context

SlopStop needs durable Project truth that survives restarts, supports revision review and recovery, remains readable when the AI runtime is unavailable, and cannot be silently overwritten by stale application instances or untrusted repository discoveries. Full event sourcing would make recovery depend on replaying every historical event, while snapshot-only storage would lose the provenance required for audit, handoff, and restoration.

## Decisions

- Persist a hybrid model: directly queryable Canonical state, immutable Accepted revisions for versioned content, and append-only Canonical events. One transaction updates current state, creates revisions, records events, advances the Project sequence, and stores idempotent command outcomes.
- Let each domain own transition legality. Canonical persistence validates authority, schema, expected entity versions, writer generation, and idempotency before committing a Typed transition.
- Store one `slopstop.db` and one separately owned `mastra.db` under application data for each stable Project ID. `slopstop.db` is authoritative for product state; `mastra.db` stores only Mastra runtime state. Cross-database work uses idempotent outbox handoffs and recovery rather than simulated shared transactions.
- Give each Project one writer protected by an operating-system lock and a monotonically increasing writer generation. Other instances are read-only observers with explicit freshness. A crashed writer can be replaced only after lock release, and the replacement enters recovery before normal commands resume.
- Separate durable identities by role: `InstallationId` names one local installation, `ProjectId` one logical Project, `RepositoryBindingId` one confirmed Git common directory, `WorkspaceId` one checkout or worktree, `CanonicalDatabaseId` and `RuntimeDatabaseId` their independent database lineages, `StorageGenerationId` one physical activation, and `SnapshotId` one sealed backup or export. These are opaque typed random IDs; Project sequence orders canonical results and is never an identity source.
- Treat repository paths as installation-local locations rather than identity. A common-directory marker claims the Project and Repository binding, each worktree marker claims its Workspace, and versioned Git fingerprints validate or propose those claims without becoming identity themselves. The reconstructible installation registry locates bindings, paths, and active storage generations but owns no canonical Project history.
- Permit one active Repository binding per Project in v1. Restart and relocation preserve all applicable identities, worktrees receive distinct Workspace identities under the shared binding, and a new clone creates a distinct Project by default. Explicit import preserves the Project and database lineage identities while creating destination-local binding, workspace, and storage-generation identities; concurrent active copies and history merging are unsupported.
- Require the live storage manifest to declare Project, database, role, schema, and generation identities, and require its canonical claims to agree with `slopstop.db` before opening the Project. A missing or corrupt `mastra.db` leaves canonical state readable in recovery mode; resetting runtime persistence creates a new Runtime database identity and Storage generation. Manifest repair preserves Project and Canonical database identities but creates a new generation.
- Treat repository markers and storage manifests as untrusted local claims. Validate their schema, identifiers, Git evidence, and sealed checksums; block mismatches, duplicate bindings, unsupported newer schemas, indeterminate ownership, and broken evidence instead of creating fresh state. Fresh defaults are allowed only when no prior-state witness exists. Absolute paths and credential references remain installation-local and never enter sealed exports.
- Keep discovered configuration and Capabilities untrusted. Use separate acceptance, Project enablement, and Run authorization gates. Effective runtime policy is always the most restrictive intersection of the live Application safety ceiling, accepted Project profile, and Run authorization.
- Restore versioned content by accepting a new revision derived from an older revision, never by rewinding history. Archive accepted records rather than deleting them.
- Back up both databases only from a quiescent Project. Migrate and restore in staged copies, verify both before activation, preserve the prior copy, reject newer schemas, and never reinterpret missing or broken state as a fresh Project.

## Consequences

- Current Project state remains fast to query while revisions and transitions stay auditable.
- Runtime SDK changes cannot redefine canonical product truth.
- Multi-instance use, migration, restore, and crash recovery require explicit coordination and more fault-injection tests.
- Repository discovery may propose configuration and Capabilities, but only a user decision can create trust or grant execution authority.
- Application data must be exported to a portable Project backup for reinstall or machine transfer; raw credentials are never included.
