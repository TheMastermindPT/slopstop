---
date: 2026-10-05T20:37:14+0100
author: Pedro Mesquita
commit: 2d52eeb
branch: main
repository: slopstop
topic: "Automatic staged upgrade of an existing Project database (Conversation C1-0)"
tags: [design, storage, migration, registry, manifest, opening, c1-0, adr-0005]
status: ready
parent: .rpiv/artifacts/research/2026-10-05_20-24-35_project-database-staged-upgrade.md
last_updated: 2026-10-06T00:50:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Round-4 findings applied (.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-intent-review-4.md). No further review round by the user rule of at most two rounds per slice; this revision is unreviewed."
content_hash: ed78b8c649415c006fbf1e7516be26e62eafcb6add04d599ae67d85699c1aa6d
---

# Design: Automatic staged upgrade of an existing Project database (C1-0)

## Intent

Opening a Project whose canonical database is a known older schema with a packaged, additive forward path upgrades it automatically: back it up, build and verify a new Storage generation from copies, and switch to it in one registry transaction. The user keeps working "como se nada fosse". Authoritative requirements are the FRD (`.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md`, content hash `d45f5d9c6f63fdfd7cca2e00d6197299522aa2568bae31e3a1c0155165b21105`) as corrected by the research Developer Context (`.rpiv/artifacts/research/2026-10-05_20-24-35_project-database-staged-upgrade.md`, content hash `fab466e46fd043e9a49e1e88f648bd2463fea5c42ac2848a6883f3f13fed41f8`): verification is "identical except identity", and `mastra.db` is copied and re-identified.

Scope: the whole C1-0 outcome as a roadmap, with S1 (the storage-level engine for a single upgrade of a Project) as the only executable slice. Registered-Project receipts and chained upgrades are a C1 gate (Deferred Work), because the first real path producing them is v3 → v4.

Non-goals (inherited, not reopened): the full ADR 0005 Storage-operation journal and Effect intent records (mandatory follow-up); non-additive migrations; downgrade, restore, backup management and automatic deletion; migrating `mastra.db` contents; the Conversation tables (C1).

Constraints: ADR 0005 (`docs/adr/0005-storage-lifecycle-and-recovery.md`) staged forward migration, verified pre-migration backup, retention, prior-state witnesses never initialize; ADR 0006 generation identity and manifest/registry agreement; standing decision `degrade-distinguishes-broken`; AGENTS.md architecture (all in `apps/harness`), Effect conventions, real-I/O tests in `tests/integration/`.

## Architecture

### Ownership and seam

```ts
interface ProjectStorageUpgradePort {
  upgrade(request: ProjectStorageUpgradeRequest): Promise<ProjectStorageUpgradeOutcome>;
}
```

`createProjectStorageOwner` (`apps/harness/src/storage/project-storage-store.ts:500`) returns `ProjectStorageOwner & ProjectStorageUpgradePort`; `ProjectStorageOwner` (`apps/harness/src/project-storage-application.ts:46-55`) is unchanged. `ProjectStorageUpgradeRequest` is `{ projectId }`. The outcome follows the owner shape (`project-storage-store.ts:536-552`): `{ status: "ready", result }`, `{ status: "unavailable", message }` or `{ status: "broken", message }`. Exact `result` objects (S3 lifts them into a protocol schema):

| result | exact shape |
|---|---|
| upgraded | `{ status: "upgraded", request, sourceGenerationId, generationId, upgradeId }` |
| not required | `{ status: "not-required", request }` |
| not registered | `{ status: "not-registered", request }` |
| refused, not additive | `{ status: "refused", request, diagnostic: { code: "PROJECT_UPGRADE_UNSUPPORTED", message: "This Project needs a database change that cannot run automatically." } }` |
| refused, not eligible | `{ status: "refused", request, diagnostic: { code: "PROJECT_UPGRADE_NOT_ELIGIBLE", message: "This Project's storage cannot be upgraded in its current state." } }` |
| failed, backup | `{ status: "failed", request, diagnostic: { code: "PROJECT_UPGRADE_BACKUP_INVALID", message: "The pre-upgrade backup failed its integrity check." } }` |
| failed, verification | `{ status: "failed", request, diagnostic: { code: "PROJECT_UPGRADE_VERIFICATION_FAILED", message: "The upgraded copy did not match the original data." } }` |

`refused NOT_ELIGIBLE` means opening is safe mode for a reason other than canonical `migration-required` with runtime `healthy`, and no database health is `unavailable`. Any `unavailable` health at inspection → `{ status: "unavailable", message: "Project Storage is busy; the upgrade can be retried." }`; a stopped owner keeps `"Project Storage owner is stopped."` (busy, D12). Registry or filesystem authority faults raise `ProjectStorageBrokenError` → `broken`; the switch guard's message is `"Project Storage upgrade source changed before the switch."`. Registry adapter steps (declare, switch) normalize unknown errors to `ProjectStorageBrokenError` exactly as the existing staging declaration does (`project-storage-node-adapters.ts:1617-1619`); other exceptions keep the existing store mapping (rethrown, `project-storage-store.ts:492-498,545-551`). None is ever reported as `refused`, `not-required` or `failed`. Per-step codes for the remaining checkpoints belong to S2.

The store runs `upgrade` under `locks.forProject` with `trackAdmittedOperation`, like `acquireActivation` (:595-641); inside the lock it re-inspects opening, applies eligibility, and releases every probe handle on every path before answering or copying. New pipeline code is written as Effect programs over the database worker.

### Pipeline (one owner, ordered steps)

1. **Eligibility.**
   - *Plan* (`generated-migrations.ts`, new `planUpgradeMigrations`): canonical schema version *n* corresponds to the packaged migration at index *n − 1* (0000 → 1, 0001 → 2, 0002 → 3). Stored authority must have the packaged kind and exactly the packaged format version (no format migration exists), a known `lastMigrationId`, and `schemaVersion` equal to that migration's index + 1. Kind or format mismatch, or a stored schema newer than packaged → `Database migration authority is incompatible.`; unknown id → `Database migration authority is unknown.`; schema/id disagreement → `Current migration authority has inconsistent versions.` (all `ProjectStorageBrokenError` → `broken`). Pending = migrations after the stored one. The ordinary `pendingMigrations` guard is unchanged (`generated-migrations.test.ts:74-103`).
   - *Classifier* (pure, `apps/harness/src/storage/project-storage-upgrade-eligibility.ts`) returns `{ status: "eligible" } | { status: "unsupported" } | { status: "empty" }`. `sqlite-schema-scanner.ts` gains a `;` punctuation token (today skipped at :121) so each statement is checked separately; comments are ignored; a trailing `;` is allowed. Each statement must start exactly `CREATE TABLE <name> (` or `CREATE [UNIQUE] INDEX <name> ON` (case-insensitive) and name no `__new_*` object; `TEMP`/`TEMPORARY`, `IF NOT EXISTS`, `AS SELECT`, views, triggers and virtual tables are unsupported. A scanner `invalidSchema()` throw stays `ProjectStorageBrokenError` (`broken`). `unsupported` → `refused PROJECT_UPGRADE_UNSUPPORTED`, with no write.
2. **Declare**: one registry transaction inserts the `storage_upgrades` row (`in-progress`, all source columns copied from S's `storage_generations` row) and T's `staging` row (S's `location_id`); checkpoint `during-upgrade-declare` between the two inserts; checkpoint `after-upgrade-declared` after commit. Nothing on disk is touched before this commit (FR2). From here until the switch, opening answers `recovery-required` through the existing staging-row rule (`project-storage-opening.ts:59-76`).
3. **Backup**: create `snapshots/<upgradeId>/` (file adapter below); `VACUUM INTO` both source databases from source clients opened read-only; close; checkpoint `after-backup-copied`; open each backup, run `PRAGMA integrity_check`, and read back its identity row and schema metadata, which must equal S's; close. A non-`ok` integrity result, a corrupt-class open error (`isCorruptStorageError`: `SQLITE_CORRUPT`, `SQLITE_NOTADB`, `project-storage-node-errors.ts:16-19`) or an identity/heads mismatch → `failed PROJECT_UPGRADE_BACKUP_INVALID`, before any staging directory exists; busy-class errors (`:21-30`) stay `unavailable`. Then compute sizes and SHA-256 and write the backup manifest exclusively from those values.
4. **Stage**: create `.staging-<generationId>/`; `VACUUM INTO` each source database into it.
5. **Migrate and re-identify**: one write transaction per staged database applies the pending migrations, writes the target `schema_metadata` head, sets the identity row's `generation_id = T` and `created_at = T.createdAt`; commit and close both; checkpoint `after-staged-migration` fires once after both are closed.
6. **Verify** (closed staged files, before sealing): declared schema equals the packaged spec; `integrity_check` = `ok` and `foreign_key_check` empty; every source table other than the identity row and `schema_metadata` has identical rows (count and a content fingerprint over all columns of all rows in a total order); each identity row keeps project, storage and lineage ids of S; runtime `slopstop_runtime_schema_metadata` identical. A mismatch → `failed PROJECT_UPGRADE_VERIFICATION_FAILED`; S stays active.
7. **Seal**: sizes and SHA-256 baselines; manifest version 2 written exclusively; `verifySealed` on staging; `renameAtomic` to `<generationId>/` (`project-storage-file-adapter.ts:132-163`); `verifySealed` again on the renamed directory, as creation does (`project-storage-store.ts:443`).
8. **Switch**: checkpoint `before-upgrade-switch`; one application-database transaction: check S's `storage_generations` row still equals the copy in `storage_upgrades` (mismatch → `ProjectStorageBrokenError` → `broken`, transaction rolled back); set `storage_registrations.active_generation_id = T`, `activated_at = T.activatedAt` (`active_location_id` unchanged); checkpoint `during-upgrade-switch`; delete S's row from `storage_generations`; set T `active` with `activated_at`; set the upgrade `completed`, `completed_at = T.activatedAt`. The FK `ON DELETE RESTRICT` (`application-schema.ts:137-141`) and the one-active partial index (`:88-90`) permit this order.

`ProjectStorageUpgradeCheckpoint` (`during-upgrade-declare`, `after-upgrade-declared`, `after-backup-copied`, `after-backup-verified`, `after-staged-copy`, `after-staged-migration`, `after-staged-verified`, `after-generation-rename`, `before-upgrade-switch`, `during-upgrade-switch`, `after-upgrade-switch`) is reported through the existing `failures.checkpoint` port, widened to both unions.

Assumption settled at the first green run of UPG-B1 (the first read-only `VACUUM INTO`): `VACUUM INTO` succeeds from a `readOnly` `node:sqlite` connection. If not, the source is opened read-write inside the project lock and never written; UPG-B2's byte-identity oracle is unchanged.

### Identity and timestamps of T

- `T.generationId` from `ids.generationId()`; `upgradeId` from a new `ids.upgradeId()` (`project-storage-store.ts:183-189`).
- `T.createRequestId = upgradeId`; `T.createRequestFingerprint = sha256(projectStorageCreateRequestFingerprintInput({ projectId, createRequestId: upgradeId }))`, so the canonical fingerprint check (`project-storage-node-adapters.ts:853-865`) holds unchanged.
- The upgrade reads the clock exactly twice: `started_at` at step 2 (= `T.createdAt`, identity rows, manifest `createdAt`, backup manifest `createdAt`) and `T.activatedAt` at step 8.
- `requireActiveCreateAuthority` (`:839-850`): `registration.createdAt` is compared with the active generation's `created_at` when the storage has no completed upgrade, and with `source_created_at` of its single completed upgrade otherwise; `registration.activatedAt === generation.activatedAt` stays. More than one completed upgrade per storage is `broken` until the C1 gate.

### Data shapes

**Registry (application migration `0007`, additive only).**

```text
storage_upgrades(
  upgrade_id PK uuid, storage_id, project_id, location_id,
  source_generation_id, target_generation_id,
  source_canonical_lineage_id, source_runtime_lineage_id,
  source_create_request_id, source_create_request_fingerprint,
  source_created_at, source_activated_at,
  state ('in-progress' | 'completed'), started_at, completed_at (null iff in-progress)
)
unique partial index: one 'in-progress' row per storage_id
unique indexes: source_generation_id; source_create_request_id
```

Follows the 0006 precedent (`application-schema.ts:407-411`, `drizzle/application/0006_registration_list_visibility.sql`, `meta/_journal.json`, spec composition, head constant and `knownPreviousHeads`, `application-database-migration.ts:17,59,193-221`).

**Relationship rule** (`requireApplicationRelationships`, `application-database-migration.ts:112-131`), applied only at heads that include `0007` (older heads at `:184-188` lack the table):
- `in-progress`: source is the storage's active generation and present in `storage_generations`; target is a `staging` row of the same storage.
- `completed`: target is the storage's active generation; source absent from `storage_generations`.
- at most one `completed` row per storage (C1 gate relaxes this for chains).
Violation → `REGISTRY_CORRUPT`.

**Create replay** (`inspectCreateRows`, `project-storage-node-adapters.ts:952-972`): a `createRequestId` matching no generation row but matching `source_create_request_id` of a completed upgrade is resolved against that row: same project and fingerprint → `active-replay` with the current active identity after `requireActiveCreateAuthority`; another project → `idempotency-conflict` (`PROJECT_STORAGE_IDEMPOTENCY_CONFLICT`).

**Not changed in S1:** the registration receipt lookup (`registration-confirmation-store.ts:266-272`) and the generation cap (`project-storage-node-adapters.ts:150,711-717`).

**Generation manifest version 2** (`project-storage-manifest.ts`). Version 1 is unchanged (`initial-create`, zero sequence and waterline). Version 2 requires provenance `{ kind: "staged-upgrade", createRequestId, sourceGenerationId, storageOperationId }` with `storageOperationId === createRequestId`, `projectSequence` and `runtimeWaterline` non-negative integers; version 2 with `initial-create` is rejected. Values: `createRequestId = storageOperationId = upgradeId`, `projectSequence = project_state.last_project_sequence` of S, `runtimeWaterline` = S's manifest value (no runtime waterline source exists; v1 records 0).

**Backup manifest.** Strict `ProjectStorageBackupManifestV1`, reusing the generation manifest's `canonical` and `runtime` sub-shapes (`project-storage-manifest.ts:43-61`) unchanged; no paths or credentials (ADR 0005:18):

```text
{ manifestVersion: 1, kind: "pre-upgrade-backup", backupId, projectId, storageId,
  sourceGenerationId, canonical: <generation canonical shape>, runtime: <generation runtime shape>,
  projectSequence, runtimeWaterline, producingApplicationVersion, createdAt }
```

Values: `backupId = upgradeId`, `createdAt = started_at`, `activationBaseline` sizes and SHA-256 of the backup files, heads and lineages of S.

**Worker.** `local-libsql-worker-client.ts` gains a read-only open option and a `vacuum-into` request; explicit close before any rename stays mandatory.

**File adapter.** `createDirectoryInProject(path)` in `project-storage-file-adapter.ts`, with a path validator beside `assertStagingPath` (`project-storage-filesystem-authority.ts:339-352`): the path must lie under `<applicationStorageRoot>/projects/<ProjectId>/`, that Project root must already exist (never created), and the path must be exactly `.staging-<uuid>` or `snapshots/<uuid>` beneath it (`snapshots/` created once if absent); an existing target is refused. Every refusal throws `ProjectStorageBrokenError("Project Storage upgrade directory is invalid.")` and creates nothing. `createDirectoryExclusive` keeps its creation-only behavior.

### Opening changes (complete list)

1. Ordinary generation directories must equal `{active} ∪ {source_generation_id of the storage's completed upgrade}`; an extra UUID directory or a missing retained source directory → `recovery-required`.
2. Registration `createdAt` comparison as in "Identity and timestamps of T".
3. Manifest versions 1 and 2 decode strictly (malformed → `corrupt`); ≥ 3 → `unsupported-newer`.
4. Manifest/registry agreement (ADR 0006:18,119), in addition to the unchanged `manifestIdentityMatches` (`project-storage-opening-manifest.ts:41-54`): the active generation's manifest is version 2 exactly when a completed upgrade targets it, and then its `sourceGenerationId` and `storageOperationId` equal that row's `source_generation_id` and `upgrade_id`; otherwise version 1. Disagreement → `identity-conflict`.

`snapshots/` stays a reserved witness without descent (`project-storage-filesystem-authority.ts:193-204`). The `in-progress` marker rule is S2.

### Data flow

```text
acquireActivation -> safe-mode migration-required          (unchanged)
upgrade(projectId)
  lock -> inspect -> plan + classify -> declare (marker + staging row, one txn)
  -> backup (read-only VACUUM INTO, integrity, manifest) -> stage copies
  -> migrate + re-identify (txn per db) -> close -> verify closed files
  -> seal (baselines, manifest v2, verifySealed, rename, verifySealed)
  -> switch (one application.db txn) -> upgraded
acquireActivation -> read-write on T
```

## Decisions

- **D1 First proof uses the real v2 → v3 path** (`0002_initial_repository_binding.sql` is two `CREATE TABLE`).
- **D2 Registry is additive.** `storage_upgrades` records the superseded generation; create replay, the relationship rule and opening read it in S1. Registration receipts and chained upgrades are a C1 gate proven by a real v3 → v4 upgrade of a registered Project (user decision, round 2). Rejected: rebuilding `storage_generations`.
- **D3 Eligibility is statement-level additivity plus mandatory verification**, after a plan that enforces the schema-version ↔ migration-id correspondence. v1 is refused.
- **D4 Database-native copies** with `VACUUM INTO` from read-only clients; the backup is integrity-checked before staging (ADR 0005:19-20).
- **D5 Declare and switch are each one application-database transaction**; the switch repoints the registration, removes S's generation row and completes the marker.
- **D6 Manifest version 2 for upgraded generations**, cross-checked with the registry; version 3 and above are `unsupported-newer`.
- **D7 Seams**: the owner from `createProjectStorageOwner` (as `project-storage-create.integration.test.ts:1032` drives it); `createProjectStorageFileAdapter` for directory refusals; pure modules for plan, classifier and manifest schema; the transport seam belongs to S3.
- **D8 T's identity**: canonical fingerprint over `upgradeId`, `createdAt = started_at`, one relaxed opening comparison against the single completed upgrade's `source_created_at`.
- **D9 Replay after an upgrade** answers `active-replay` with the current active identity.
- **D10 Scope split**: the `in-progress` marker opening rule, per-step failure codes for the remaining checkpoints, racing upgrades and sync-throw/stop settlement are S2.
- **D11 Verification runs on closed staged files.**
- **D12 Busy stays distinct**: any `unavailable` database health at inspection → `unavailable`, never `refused`.
- Inherited, not reopened: runs automatically; nothing deleted; reduced ADR 0005 form; "identical except identity"; two-step renderer flow; English copy; read-only failure with "Try again"; interruption proof by injected errors plus one real kill; 2 s tolerant target.

## Next Slice

- **slice_id**: `c1-0-s1-staged-upgrade-engine`
- **Behaviors**: `UPG-B1`–`UPG-B5`, `UPG-B7`–`UPG-B17` (`UPG-B6` is S2). Order: B8, B14, B16, B1, B5, B4, B2, B3, B10, B9, B7, B15, B17, B11, B12, B13. Each Expected red below is stated against the state left by the behaviors before it in this order; a case marked "guard" is expected green on arrival and pins a boundary.
- **Deliverable**: `upgrade` runs the full pipeline for an eligible Project and refuses, fails or reports busy/broken visibly otherwise; the upgraded Project opens read-write, replays its create request and passes registry relationship checks.
- **Affected source** (`apps/harness/src/storage/` unless stated): `project-storage-store.ts`, `project-storage-node-adapters.ts`, `project-storage-node-schemas.ts`, `project-storage-opening.ts`, `project-storage-manifest.ts`, `project-storage-opening-manifest.ts`, `project-storage-file-adapter.ts`, `project-storage-filesystem-authority.ts`, `generated-migrations.ts`, new `project-storage-upgrade-eligibility.ts`, `local-libsql-worker-client.ts`, `application-schema.ts`, `application-database-migration.ts`, `project-storage-database-specs.ts`; `apps/harness/drizzle/application/0007_*.sql` and `meta/`; `sqlite-schema-scanner.ts` (`;` token); `stryker.project-storage.config.json` (`mutate` += eligibility module, `generated-migrations.ts`, `project-storage-manifest.ts`) and `apps/harness/vitest.project-storage-mutation.config.ts` (`include` += eligibility, manifest and generated-migrations unit tests).
- **Affected tests**: new `tests/integration/project-storage-upgrade.integration.test.ts`, `tests/integration/project-storage-upgrade-directories.integration.test.ts`, `tests/integration/registration-storage-upgrades.integration.test.ts`, `src/storage/project-storage-upgrade-eligibility.test.ts`; additions to `src/storage/generated-migrations.test.ts` and `src/storage/project-storage-manifest.test.ts` (the "rejects non-v1 shapes" case at :152 is replaced by UPG-B16); `tests/integration/project-storage-runtime-fixture.ts` (opt-in sequenced ids, upgrade clock, `upgradeId`, widened `failAt`/`onCheckpoint`, a factory returning the raw owner, the test-only fixture command); `tests/integration/project-storage-historical-fixture.ts` (generation-two seed); `tests/integration/project-storage-open.integration.test.ts:491-497` (→ version 3); typed dependency fakes `src/storage/project-storage-store.test.ts:100-115,135,148-169,176`, `tests/integration/project-storage-lifecycle.integration.test.ts:287`, `tests/integration/project-storage-create.integration.test.ts:1037`; head and table pins `application-database-authority.integration.test.ts:180`, `project-registration.integration.test.ts:654`, `registration-identity-query.integration.test.ts:110`, `registration-schema-fixture.ts:117,144-167` (asserted at `project-storage-create.integration.test.ts:233`), `project-storage-open.integration.test.ts:804,858`, `project-storage-open-recovery.integration.test.ts:53`, `registration-visibility-upgrade.integration.test.ts` (all paths under `apps/harness/`).
- **Dependencies**: repository state at `2d52eeb`.

## Test Contracts

**Seam.** Owner behaviors drive the raw owner from `createProjectStorageOwner` over `createNodeProjectStorageDependencies` (`project-storage-node-adapters.ts:1724`) on a real temporary `applicationStorageRoot` with the checked-in migration root, built by a new opt-in runtime-fixture factory (existing defaults unchanged): generation ids `…014` (create) then `…024` (upgrade); `upgradeId` `…0a1`; creation clock fixed at `2026-08-31T12:00:00.000Z`; upgrade clock `t2 = 2026-10-05T10:00:00.000Z` then `t8 = 2026-10-05T10:00:01.000Z`; `applicationVersion "0.0.0"`; `failAt`/`onCheckpoint` over both checkpoint unions. S = `…014`, T = `…024`, U = `…0a1`. Each case starts from a fresh fixture. Integration runs on the Windows development host.

**Fixture command.** A test-only canonical command definition `fixture.record-note`, registered through `createCanonicalCommandRegistry` the way `tests/integration/conformance-counter-command.ts` registers its command, whose handler writes no table and returns `{ outcome: "applied", events: [one event] }`, and whose payload validator rejects an empty note.

**Generation-two fixture.** Create a Project through the real `create` with no initial repository binding; activate read-write with the fixture command registry; submit `fixture.record-note` once applied and once rejected (`project_state.last_project_sequence` = 2); close; activate read-write a second time (writer generation 2 exists) and close. Then every comparable canonical table (`canonical_events`, `command_idempotency`, `command_receipts`, `command_rejections`, `project_state`, `writer_fence`, `writer_generations`, `writer_handoffs`, `writer_recovery_records`) still empty receives one row inserted directly that is resolved and consistent with the real writer state — for `writer_recovery_records`: `writer_generation` 1, resolved by writer generation 2, satisfying the CHECK and FK of the golden schema (`tests/fixtures/canonical-project-writer-generation-2.sql:365,442-451`). A third real read-write activation and one applied command prove the writer still runs (sequence becomes 3). Close. Assert `repository_bindings` and `project_workspaces` are empty, drop them, set `schema_metadata` to `(canonical, canonical, 1, 2, '0001_canonical_project_writer')`, recompute manifest heads and baseline as `seedGenerationOneCanonical` does. The fixture asserts: ordered `sqlite_schema (type, name, tbl_name, sql)` equals that of a reference database built by executing `drizzle/canonical/0000_fat_doctor_octopus.sql` then the pinned golden `tests/fixtures/canonical-project-writer-generation-2.sql` (`scripts/check-golden-sql.mjs:14`); every comparable canonical table has ≥ 1 row; `last_project_sequence` = 3; activation answers safe-mode canonical `migration-required`, runtime `healthy`.

**Snapshot** ("nothing changes"): every directory and file path under `projects/` with each file's SHA-256, plus every row of every registry table. **Released** ("handles released"): the Project's generation directory can be renamed away and back.

- **Behavior UPG-B1**: An eligible older Project is upgraded and then opens and writes read-write with identical data.
  - Test: `upgrades a generation-two Project and opens it read-write with identical data` → `project-storage-upgrade.integration.test.ts`
  - Oracle: `upgrade` → `{ status: "ready", result: { status: "upgraded", request, sourceGenerationId: S, generationId: T, upgradeId: U } }`. `acquireActivation` → `ready`, `mode: "read-write"`, `identity.generationId = T`. T's `slopstop.db`: `schema_metadata` = `(canonical, canonical, 1, 3, '0002_initial_repository_binding')`; `repository_bindings`, `project_workspaces` exist and are empty; every other table of S equals S's rows (`SELECT *` ordered by all columns); `storage_identity` equals S's with `generation_id = T`, `created_at = t2`. T's `mastra.db`: every table equals S's except the identity row (`generation_id = T`, `created_at = t2`). Both: `integrity_check` = `ok`, `foreign_key_check` empty. One applied `fixture.record-note` on T → `last_project_sequence` = 4.
  - Expected red: an `upgrade` scaffold answering `not-required` fails the first assertion.
- **Behavior UPG-B2**: The marker precedes any disk change; the prior generation and a verified backup survive; the registry records the switch exactly.
  - Test: `declares first, keeps the prior generation byte-identical, a verified backup and an exact registry record` → `project-storage-upgrade.integration.test.ts`
  - Oracle: at `after-upgrade-declared` (observed through `onCheckpoint`): one `storage_upgrades` row `in-progress` (source S, target T, `completed_at` null), T's `staging` row present, `snapshots/U/` and `.staging-T/` absent. After the upgrade: S's three files unchanged (SHA-256) and S released. `snapshots/U/` holds exactly `slopstop.db`, `mastra.db`, `manifest.json`; both `integrity_check` = `ok` and equal S's rows; the backup manifest decodes strictly to `{ kind: "pre-upgrade-backup", backupId: U, projectId, storageId, canonical and runtime lineage ids of S, sourceGenerationId: S, canonical head (1, 2, '0001_canonical_project_writer'), S's runtime head, projectSequence: 3, runtimeWaterline: 0, sizes and SHA-256 equal to the files, producingApplicationVersion: "0.0.0", createdAt: t2 }`. Registry: `storage_registrations` = `{ active_generation_id: T, active_location_id: <S location>, created_at: 2026-08-31T12:00:00.000Z, activated_at: t8 }`; `storage_generations` = exactly T (`active`, `created_at t2`, `activated_at t8`, `create_request_id U`, canonical fingerprint over U, S's location); `storage_upgrades` = exactly one row whose source columns equal S's pre-upgrade row and `{ upgrade_id U, target T, state completed, started_at t2, completed_at t8 }`.
  - Expected red: after UPG-B1 is green without a backup step, `snapshots/U/` is absent.
- **Behavior UPG-B3**: The upgraded manifest records provenance, and the Project keeps opening healthy with its retained generation.
  - Test: `records upgrade provenance and reopens healthy with retained generations` → `project-storage-upgrade.integration.test.ts`
  - Oracle: T's manifest decodes as version 2 with `provenance = { kind: "staged-upgrade", createRequestId: U, sourceGenerationId: S, storageOperationId: U }`, `projectSequence 3`, `runtimeWaterline 0`, `createdAt t2`, canonical head schema 3. After closing the first session, two further `acquireActivation` calls each answer read-write on T.
  - Expected red: after UPG-B1/B4/B2, T's manifest is still version-1 shaped (opening accepts it as today), so the provenance assertion fails. B3 introduces the version-2 write and opening's acceptance of version 2.
- **Behavior UPG-B4**: A Project that is not automatically upgradable is refused with an exact result, and nothing changes.
  - Test: `refuses ineligible Projects without changing anything` → `project-storage-upgrade.integration.test.ts`
  - Oracle (snapshot equal, handles released, in each case): (a) generation-one Project (`seedGenerationOneCanonical`) → the exact `refused PROJECT_UPGRADE_UNSUPPORTED` result, activation still safe-mode `migration-required`; (b) corrupt-manifest Project (existing fixture) → the exact `refused PROJECT_UPGRADE_NOT_ELIGIBLE` result; (c) generation-two canonical with the corrupt-runtime seed (`project-storage-open.integration.test.ts:359`) → the exact `refused PROJECT_UPGRADE_NOT_ELIGIBLE` result.
  - Expected red: right after UPG-B1 no `refused` result exists, so no case returns its exact refused result ((a) proceeds into the pipeline; (b) and (c) are not `migration-required` and answer `not-required`); the classifier and the eligibility rule are wired here.
- **Behavior UPG-B5**: A current or unknown Project needs no upgrade, and nothing is created.
  - Test: `answers not-required or not-registered without changing anything` → `project-storage-upgrade.integration.test.ts`
  - Oracle: fresh schema-3 Project → `{ status: "not-required", request }`, snapshot equal, handles released, activation read-write on the same generation; unregistered `projectId` → `{ status: "not-registered", request }`, `projects/<projectId>/` absent, registry rows unchanged.
  - Expected red: right after UPG-B1 the unregistered case answers `not-required` (anything not `migration-required` is treated as current); the current-Project case is a guard.
- **Behavior UPG-B7**: A staged copy that does not prove its content, schema, integrity or identity never switches, and leaves an exact state.
  - Test: `fails verification without switching when the staged copy differs` → `project-storage-upgrade.integration.test.ts`
  - Oracle: at `after-staged-migration` the hook applies one change to the closed staged files: (a) delete one `canonical_events` row; (b) `DROP TABLE repository_bindings`; (c) set staged `mastra.db` `slopstop_runtime_schema_metadata.last_migration_id` to another string; (d) set staged `storage_identity.storage_id` to another UUID; (e) update one `canonical_events` column value (same row count); (f) with foreign keys off, insert a `project_workspaces` row referring to no binding; (g) set staged `mastra.db` `slopstop_runtime_storage_identity.runtime_database_lineage_id` to another UUID; (h) in staged `slopstop.db`, write 16 bytes of `0xFF` at file offset `pageSize + 8` (page 2, after its b-tree header byte; `pageSize` read from the database header), leaving the file header intact. Each → the exact `failed PROJECT_UPGRADE_VERIFICATION_FAILED` result. Then: `active_generation_id = S`; S's files unchanged; `storage_upgrades` = one row `in-progress` (source S, target T, `completed_at` null); T's row `staging`; `.staging-T/` and `snapshots/U/` exist and are released (renamed away and back); `acquireActivation` → safe-mode, both healths `recovery-required` / `DATABASE_RECOVERY_REQUIRED`, `identity.generationId = S`; application-database authority restart → no `REGISTRY_CORRUPT`; a second `upgrade` → the exact `refused PROJECT_UPGRADE_NOT_ELIGIBLE` result (S2 replaces this with recovery).
  - Expected red: without step 6, (a) and (e) answer `upgraded`; (b), (c), (d), (f), (g), (h) answer `broken` from `verifySealed` (`project-storage-node-adapters.ts:558,578-582`).
- **Behavior UPG-B8**: Eligibility is decided per statement.
  - Test: `classifies pending statements by additive kind` → `src/storage/project-storage-upgrade-eligibility.test.ts` (inline statements only)
  - Oracle: `{ status: "eligible" }` for `[CREATE TABLE a (x), CREATE UNIQUE INDEX i ON a(x)]`, `[CREATE INDEX j ON a(y)]`, `[create index k on a(z)]`, `[CREATE TABLE a (x);]`. `{ status: "unsupported" }` for `[ALTER TABLE a ADD b]`, `[-- note\nALTER TABLE a ADD b]`, `[INSERT INTO a VALUES (1)]`, `[DROP TABLE a]`, `[CREATE TABLE a (x); DROP TABLE b]`, `[CREATE VIEW v AS SELECT 1]`, `[CREATE TRIGGER t AFTER INSERT ON a BEGIN SELECT 1; END]`, `[CREATE VIRTUAL TABLE f USING fts5(x)]`, `[CREATE TEMP TABLE a (x)]`, `[CREATE TABLE IF NOT EXISTS a (x)]`, `[CREATE TABLE b AS SELECT * FROM a]`, `[CREATE TABLE __new_a (x)]`, `[CREATE INDEX __new_i ON a(x)]`. `{ status: "empty" }` for `[]`. `[CREATE TABLE "a (x)]` (unterminated quote) throws `ProjectStorageBrokenError`. (Real `0001`/`0002` are proven through UPG-B4(a) and UPG-B1.)
  - Expected red: a stub answering `{ status: "eligible" }` for every list fails each unsupported, empty and throwing case.
- **Behavior UPG-B9**: Busy and broken stay distinct for `upgrade`.
  - Test: `keeps unavailable and broken outcomes for upgrade` → `project-storage-upgrade.integration.test.ts`
  - Oracle (snapshot equal in each): stopped owner → `{ status: "unavailable", message: "Project Storage owner is stopped." }` (guard); generation-two Project with S's `slopstop.db` held under an exclusive lock by another connection → `{ status: "unavailable", message: "Project Storage is busy; the upgrade can be retried." }`, and after the lock is released S's directory is released (renamed away and back); the same with S's `mastra.db` locked → the same result and release; registry with a contradictory active location (fixture of `project-storage-open.integration.test.ts:510-529`) → `{ status: "broken", message: "Project Storage authority is internally inconsistent." }` (guard), S's directory released.
  - Expected red: after UPG-B4 the two locked cases answer the exact `refused PROJECT_UPGRADE_NOT_ELIGIBLE` result (an `unavailable` health is not yet distinguished); the stopped-owner and broken-registry cases are guards through the existing `operate` mapping.
- **Behavior UPG-B10**: Manifest versions and registry agreement at opening.
  - Test: `bounds manifest versions and provenance at opening` → `project-storage-open.integration.test.ts` (the case at :491-497 moves to version 3) and `project-storage-upgrade.integration.test.ts`
  - Oracle: `manifestVersion: 3` → safe-mode `unsupported-newer` (guard); a version-2 manifest without `provenance.sourceGenerationId` → `corrupt` (guard after UPG-B3/B16); on an upgraded fixture, T's manifest rewritten (with matching baseline) to disagree in exactly one of `generationId`, `provenance.createRequestId`, `createdAt` → `identity-conflict` (guards via `manifestIdentityMatches`), or in `provenance.sourceGenerationId` only → `identity-conflict` (`storageOperationId` cannot differ alone: UPG-B16 requires it to equal `createRequestId`); T's manifest replaced by a version-1 manifest whose project, storage, generation, lineage ids, `provenance.createRequestId` (U) and `createdAt` (t2) all equal T's row → `identity-conflict`; on a never-upgraded Project, its manifest replaced by a version-2 manifest whose identity fields all equal its generation row → `identity-conflict`.
  - Expected red: after UPG-B3, the wrong-`sourceGenerationId` case, the version-1-on-T case and the version-2-on-never-upgraded case each answer read-write (no registry agreement rule yet); the cases marked guard pass on arrival.
- **Behavior UPG-B11**: An upgraded Project keeps create idempotency, registry relationships, `createdAt` authority and exact directory authority.
  - Test: `replays, validates the registry and bounds directories after an upgrade` → `registration-storage-upgrades.integration.test.ts`
  - Oracle, after UPG-B1's upgrade: replaying the original `create` request → `created` with identity generation T; `{ projectId: <another UUID>, createRequestId: <original> }` → `blocked`, `PROJECT_STORAGE_IDEMPOTENCY_CONFLICT`; authority restart → no `REGISTRY_CORRUPT`. Each on a fresh upgraded fixture, then authority restart → `REGISTRY_CORRUPT`: the completed row's `target_generation_id` set to an unknown UUID; S's row re-inserted into `storage_generations` as `staging` with `activated_at` null; a second completed row with target T and a source UUID absent from `storage_generations`. On UPG-B7(a)'s leftover state, authority restart → `REGISTRY_CORRUPT` when the `in-progress` row's target is set to an unknown UUID, and separately when its source is set to a non-active UUID. `storage_upgrades.source_created_at` changed → activation `broken` and replay of the original `create` → `broken`. A second completed row (target T, absent source) inserted without restarting the authority → activation `broken`. An extra UUID directory under the Project root → activation safe-mode `recovery-required`; S's retained directory removed → activation safe-mode `recovery-required`.
  - Expected red: replay answers `blocked` (`project-storage-store.ts:303-304`).
- **Behavior UPG-B12**: An existing installation's registry upgrades in place to `0007`.
  - Test: `upgrades an exact 0006 registry with a created Project to 0007` → `registration-storage-upgrades.integration.test.ts`
  - Oracle: a created Project on the current build, then `storage_upgrades` dropped and the application head set to `0006_registration_list_visibility`; authority start → head `0007_*`; every pre-existing registry row unchanged; `storage_upgrades` exists and is empty; the Project opens read-write.
  - Expected red: `knownPreviousHeads` lacks 0006 → start fails.
- **Behavior UPG-B13**: Upgrade directories are created only inside an existing Project, never over existing output.
  - Test: `creates upgrade directories only beneath an existing Project root` → `project-storage-upgrade-directories.integration.test.ts`, through `createProjectStorageFileAdapter`
  - Oracle: existing root, `.staging-<uuid>` → created; `snapshots/<uuid>` → created (`snapshots/` created once). Refused with `ProjectStorageBrokenError("Project Storage upgrade directory is invalid.")` and nothing created: missing Project root (root still absent); `backup`; `.staging-x`; `snapshots/x`; `<uuid>`; `snapshots/<uuid>/<uuid>`; `.staging-<uuid>` directly under `projects/`; `.staging-<uuid>` under an existing directory outside `applicationStorageRoot`; an existing target (contents unchanged).
  - Expected red: a stub creating any directory recursively passes the first two and fails every refusal.
- **Behavior UPG-B14**: The version-moving plan enforces the schema-version ↔ migration-id rule.
  - Test: `plans a version-moving upgrade and refuses incompatible authority` → `src/storage/generated-migrations.test.ts` (inline migrations)
  - Oracle, against a three-migration plan (format 1, schema 3, ids `m0`, `m1`, `m2`): stored `(canonical, 1, 2, m1)` → pending `[m2]`; `(canonical, 1, 3, m2)` → empty; `(canonical, 1, 4, m2)` → incompatible; `(application, 1, 2, m1)` → incompatible; `(canonical, 2, 2, m1)` → incompatible; `(canonical, 0, 2, m1)` → incompatible; `(canonical, 1, 2, unknown)` → unknown; `(canonical, 1, 3, m1)` → inconsistent; `(canonical, 1, 1, m2)` → inconsistent. Messages as in Pipeline step 1.
  - Expected red: a stub returning the migrations after the stored id fails every refusal.
- **Behavior UPG-B15**: An unverified backup stops the upgrade before any staging output exists, leaving an exact state.
  - Test: `fails before staging when the backup does not verify` → `project-storage-upgrade.integration.test.ts`
  - Oracle: at `after-backup-copied` the hook (a) overwrites `snapshots/U/slopstop.db` with 4096 zero bytes; (b) overwrites `snapshots/U/mastra.db` with 4096 zero bytes; (c) writes 16 bytes of `0xFF` at file offset `pageSize + 8` of `snapshots/U/slopstop.db` (file header intact, the file still opens); (d) replaces `snapshots/U/slopstop.db` with an intact `VACUUM INTO` copy of another Project's canonical database. Each → the exact `failed PROJECT_UPGRADE_BACKUP_INVALID` result; no `.staging-*`; `active_generation_id = S`; S's files unchanged; `storage_upgrades` one row `in-progress`; T's row `staging`; `snapshots/U/` present and released; `acquireActivation` → safe-mode `recovery-required` on S; authority restart → no `REGISTRY_CORRUPT`. (e) the hook holds an exclusive lock on `snapshots/U/slopstop.db` → `{ status: "unavailable", message: "Project Storage is busy; the upgrade can be retried." }`, not `failed`.
  - Expected red: without the read-back check, (a)–(d) answer `upgraded` (staging copies from S, not from the backup); (e) answers `upgraded`.
- **Behavior UPG-B16**: The manifest schema accepts exactly version 1 and the upgrade form of version 2.
  - Test: `parses and serializes version-2 upgrade manifests strictly` → `src/storage/project-storage-manifest.test.ts`
  - Oracle: a version-2 upgrade manifest round-trips through serialize/parse byte-identically; rejected: version 2 with `initial-create`; version 2 with `storageOperationId ≠ createRequestId`; version 2 missing `sourceGenerationId`; version 2 with negative `projectSequence`; version 1 with nonzero `projectSequence`; version 3.
  - Expected red: the current schema rejects every version-2 input, including the valid one.
- **Behavior UPG-B17**: Declare and switch are all-or-nothing.
  - Test: `rolls back declare and switch transactions on failure` → `project-storage-upgrade.integration.test.ts`
  - Oracle: `failAt: during-upgrade-declare` → `{ status: "broken", message: "Project Storage upgrade declaration failed." }` (registry adapter normalization); registry snapshot equal to before; no `snapshots/`. `failAt: during-upgrade-switch` (after the registration is repointed) → `{ status: "broken", message: "Project Storage upgrade switch failed." }`; registry rows equal to the state at `before-upgrade-switch` (S active, marker `in-progress`, T `staging`); `<T>/` present. A `before-upgrade-switch` hook that changes S's `storage_generations.created_at` → `{ status: "broken", message: "Project Storage upgrade source changed before the switch." }`, registration still on S, marker `in-progress`.
  - Expected red: after UPG-B2 neither `during-upgrade-*` checkpoint fires and the switch has no source guard, so all three cases answer `upgraded`.

TDD-exempt: none.

### Success Criteria

Automated (from `apps/harness` unless stated; Windows host):
- `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/project-storage-upgrade.integration.test.ts tests/integration/project-storage-upgrade-directories.integration.test.ts tests/integration/project-storage-open.integration.test.ts`
- `pnpm exec vitest run --config vitest.registration.config.ts`
- `pnpm exec vitest run src/storage/project-storage-upgrade-eligibility.test.ts src/storage/generated-migrations.test.ts src/storage/project-storage-manifest.test.ts`
- `pnpm db:generate:check`
- Repository root: `pnpm check`; `pnpm test:integration`; `pnpm check:duplicates` (0 clones); `pnpm test:mutation:project-storage:harness`; CodeScene 10 on touched files.

Manual: none for S1.

## Deferred Work

- **S2 `c1-0-s2-upgrade-failure-and-recovery`** — `UPG-B6` (an unfinished upgrade never opens silently; revisit its "marker without staging row" case, which S1's relationship rule reports as `REGISTRY_CORRUPT` and S1's atomic declare cannot produce); per-step failure codes for every remaining checkpoint; automatic recovery on the next `upgrade` when a marker is `in-progress` (discard proven staging output — `.staging-<id>`, an unregistered renamed `<id>`, the in-progress backup — then restart), replacing UPG-B7's and UPG-B15's second-call `refused`; "Try again" repeats the whole upgrade; racing `upgrade` calls; synchronous throw and owner stop settle; one real process kill during the switch. Trigger: S1 accepted. Open question: whether recovery also runs when `acquireActivation` meets an `in-progress` marker.
- **S3 `c1-0-s3-upgrade-request-and-window`** — coordinator `upgrade` with quiescence, protocol `project.upgrade` / result with `protocolVersion` 6, bridge and preload, renderer two-step flow with "Updating Project…", failure view, Electron E2E, timing test under 2 s. Trigger: S2 accepted. Open question: timing-test stability under Windows load (`cefc503`).
- **S4 documentation** — ADR 0005 amendment (temporary single-marker form); ADR 0006 manifest version 2 and `storage_upgrades`; GitHub issue for the full journal after user authorization.
- **C1 gate (before canonical `0003` ships)** — proven by a real v3 → v4 upgrade of a Project registered through the real flow: registration receipt lookup through `storage_upgrades` (`registration-confirmation-store.ts:266-272`) and its consumers (re-add → `already-registered`, listing, list visibility, Project selection); chained upgrades (relationship rule with several completed rows, `createdAt` against the earliest completed upgrade by `started_at`, directory union over all completed sources, manifest/registry agreement for the latest); generation-cap semantics with retained generations; canonical rebuild authorization for schema 4 (`generated-migration-resources.ts:267-288,335-340`).

## Verification Notes

- Risks: Windows handle release (`9be86e4`, proven by "released" in UPG-B2/B4/B5); real-I/O tests in integration (`cefc503`); head-pin churn (`52b5bc2`, list above); lifecycle settlement (`f4e83c8`, S2).
- Unverified assumption: `VACUUM INTO` from a read-only connection (fallback in Pipeline; settled at UPG-B1 green).
- Source anchors verified at `2d52eeb`: `generated-migrations.ts:54-72`; `generated-migration-resources.ts:252-344`; `project-storage-store.ts:249-262,443,492-498,536-552`; `project-storage-node-adapters.ts:558,578-582,839-865,952-972,1035-1046`; `project-storage-opening-manifest.ts:41-54,85`; `application-database-migration.ts:112-131,184-188`; `application-schema.ts:67-69,88-90,137-141`; `project-storage-file-adapter.ts:58-80`; `project-storage-filesystem-authority.ts:193-204,339-352`; `process-bootstrap.ts:272` (empty production command registry).
- Review evidence: `.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-intent-review-1.md`, `-2.md`, `-3.md`, `-4.md`.
- Baseline: capture the CodeScene score of each touched file before the first edit.

## Developer Context

Inherited from the FRD and research Developer Context (not re-asked): automatic, nothing deleted, progress text, reduced A, read-only on failure with retry, automatic interruption recovery, verification content, 2 s target, identical-except-identity, two-step renderer flow, English copy, interruption proof.

Asked in this design (2026-10-05):

- **Q (`apps/harness/drizzle/canonical/0002_initial_repository_binding.sql`): With which real upgrade is the first slice proven?** A: real v2 → v3 → D1.
- **Q (`apps/harness/src/storage/application-schema.ts:67`): How is the prior generation recorded?** A: new additive table → D2.
- **Q (`apps/harness/drizzle/canonical/0001_canonical_project_writer.sql:459-533`): Which upgrades run on their own?** A: additive statements only, verification on top → D3.
- **Q: Accept the S1–S4 split and UPG-B1…B6?** A: accepted (round 0); invalidated by round 1.
- **Q (round 1, `registration-confirmation-store.ts:266`, `project-storage-node-adapters.ts:958`): D2 breaks receipts and replay — keep the table or rebuild?** A: keep the table and teach the lookups → D2, D9.
- **Q (round 1): S1 grew; how to arrange it?** A: move the marker rule and related failure work to S2 → D10.
- **Q (round 2, `registration-storage-bootstrap.ts:108`, `initial-repository-binding.ts:20`): Where are registered-Project receipts and chained upgrades proven?** A: in C1, with a real v3 → v4 upgrade, as a gate before `0003` ships → D2, C1 gate.
- Round 3 required no decision: contract precision only.
- **Q (round 4): How to continue?** A: fix and run round 5 — then superseded by the user's rule "maximo de 2 rndas por slice" (2026-10-06). Round 4's findings were applied without a further review round; remaining review status and the user's gate decision are recorded below.

### Review gate status

Four intent rounds ran (evidence `-1.md` … `-4.md`), all failed; round 4's coverage review was **unavailable** (auto-mode permission classifier). Round-4 findings were applied to this revision (red order and per-case reds, fixture insertion order, classifier return union and `;` splitting, backup read-back and busy mapping, exact backup-manifest keys and messages, released checks, swap-case identity, mutation scope, test-file locations). This revision has **no independent review**. By the user's two-round cap no further round runs.

**User gate decision (2026-10-06):** accept S1 intent with recorded residual risk, as an explicit override of the intent-review gate (no clean review: rounds 1–4 failed; round 4 coverage unavailable; final revision unreviewed). Residual risks: unreviewed round-4 fixes; unverified read-only `VACUUM INTO` (fallback defined); some Expected red predictions may differ when tests are written and are then recorded as observed, never forced. Mitigation: candidate-mode independent review of the real S1 source. This decision does not authorize a build, workspace or branch.

Intent accepted by the user with recorded residual risk (see Review gate status). Build authorization, workspace and branch remain separate decisions.

## References

- `.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md` (FRD)
- `.rpiv/artifacts/research/2026-10-05_20-24-35_project-database-staged-upgrade.md` (parent research)
- `.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-intent-review-1.md`, `-2.md`, `-3.md`, `-4.md`
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` section 4
- `.rpiv/artifacts/handoffs/2026-10-05_conversation-c1-local-save-brief.md`
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md`
- `docs/adr/0005-storage-lifecycle-and-recovery.md`, `docs/adr/0006-physical-persistence-layout.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`

## TDD Evidence (implement)

- Slice `c1-0-s1-staged-upgrade-engine`, branch `feat/c1-0-s1-staged-upgrade-engine` from `a5e19a6`: per-behaviour red/green, gates, deviations and review-round fixes in `.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-tdd-evidence.md` (append-only). Prior content hash of this design: `12dfee1e3a6a1e65d1c6bf604fefd0239a47fcd8571e79da5d2fc13c54403a1b`.
