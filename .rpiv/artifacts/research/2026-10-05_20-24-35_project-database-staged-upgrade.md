---
date: 2026-10-05T20:24:35+0100
author: Pedro Mesquita
commit: c3efbd1
branch: main
repository: slopstop
topic: "Automatic staged upgrade of an existing Project database (Conversation C1-0)"
tags: [research, codebase, storage, migration, registry, manifest, protocol, renderer, c1-0]
status: complete
last_updated: 2026-10-05T20:24:35+0100
last_updated_by: Pedro Mesquita
content_hash: fab466e46fd043e9a49e1e88f648bd2463fea5c42ac2848a6883f3f13fed41f8
---

# Research: Automatic staged upgrade of an existing Project database (Conversation C1-0)

## Research Question
Ground `.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md` in the codebase: a harness-side upgrade that, when an older Project (canonical `slopstop.db` schema 3) is opened under a build whose canonical schema is 4, backs it up, builds and verifies a new Storage generation, and switches to it atomically, coordinated by one durable upgrade marker in the installation registry.

## Summary
Nothing supports an upgrade path today. A v3 Project is detected cleanly as `safe-mode` with canonical health `migration-required`, after every identity, integrity and foreign-key check has passed, and its probe handles are released immediately. The staged-creation pipeline is partly reusable (staging path, exclusive manifest write, size/SHA-256 baselines, `verifySealed`, `renameAtomic`), but registry staging, directory creation, database building, the manifest schema and registry activation all assume a brand-new Storage. Five structural blockers must change:
- the migration runner refuses a stored version different from the target;
- the canonical rebuild pin accepts only schema 2 and 3;
- the manifest pins `initial-create`, sequence 0 and waterline 0;
- the registry has no prior-generation state and writes the registration pointer once;
- opening requires exactly one generation row and directory, and treats any other root entry as broken.

A new generation must rewrite each database's identity row (generation id, created-at) and the canonical `schema_metadata`. Every other canonical table can be compared for identical content, and the user decided verification is "identical except identity". Activation is one request with one reply, so the user chose a two-step automatic flow: activate answers safe-mode `migration-required`, then the renderer automatically issues a separate upgrade request while showing "Updating Project…", then activates again.

## Detailed Findings

### Detection and the activation path
- `acquireActivation` runs inside the in-process `locks.forProject` (`apps/harness/src/storage/project-storage-store.ts:595-641`, lock at :602), classifying `opening.inspect` output (:604-607).
- `inspectOpening` (`apps/harness/src/storage/project-storage-node-adapters.ts:1424-1486`) allocates `openedClients` and `createOpeningRelease` (:1425-1426), runs `confirmHealthyOpening` twice with a fresh scan (:1065-1077), inspects the manifest (:1454-1465) and probes both databases in parallel (:1145-1177, `Promise.allSettled` :1152).
- `inspectHealthyOpeningDatabase` opens a `"generation"` worker client per database (:1091, :1097); metadata must equal the manifest's recorded heads or the result is broken (`apps/harness/src/storage/project-storage-opening.ts:239-244,265-274`; node-adapters :1109-1111).
- `knownMigrationCompatibility` marks a non-last packaged `lastMigrationId` as `known-older` (opening.ts:198-205); `completeOpeningDatabaseProbe` skips declared-schema checks unless current (node-adapters :1128-1143).
- `classifyProjectDatabaseProbe` returns `migration-required` / `DATABASE_MIGRATION_REQUIRED` only after identity, newer/unknown, FK, integrity and domain checks (opening.ts:348-353,374-389); `classifyProjectStorageOpening` returns safe-mode with `session.close = evidence.release` (:485-495).
- The coordinator's `acquireProject` returns safe-mode immediately through `closeThen`, which releases storage (`apps/harness/src/active-project-coordinator.ts:433-439,441-463`). No writer lease exists yet; it is taken only in `acquireWritable` (:397), and a contended lease yields read-only (:398-404).
- Existing proof of detection: `apps/harness/tests/integration/project-storage-open.integration.test.ts:143-174` (seeded through `project-storage-historical-fixture.ts:38-87`).

### Handles and Windows
- Probe clients stay open until `session.close()`; `closeOpeningClients` closes canonical then runtime and aggregates failures (opening.ts:397-425); the coordinator records a release failure as `PROJECT_STORAGE_RELEASE_FAILED` (coordinator :257,538-541).
- Creation opens and closes a client in `buildDatabase` (node-adapters :511,538-540) and in `verifyOwnedDatabase` (:554,583-584), so no generation handle is open at `renameAtomic`.
- Worker: `DatabaseSync(path,{timeout:0})` (`apps/harness/src/storage/local-libsql-worker-client.ts:213`), explicit close (:238-241,386-395), serialized queue per pool (:429-447,609-629). There is no backup operation; the request union, schema and handler are at :98-101, :315-345, :419-427.
- EPERM/EBUSY/EACCES normalize to unavailable (`apps/harness/src/storage/project-storage-node-errors.ts:21`).

### Staged-creation pipeline: reusable versus create-only
- `AllocatedCreation` mints every identity (store :79-89, filled :315-325). An upgrade keeps `projectId`, `storageId` and both lineage ids (ADR 0006 :17; ADR 0005 :21) and needs a new `generationId`, a new `createRequestId` (globally unique, `apps/harness/src/storage/application-schema.ts:83`) and a new `createdAt`.
- Create-only today:
  - `registry.declareStaging` (node-adapters :1565-1620; `inspectCreateRows` :952-973 refuses an existing registration :1189-1201; `insertStagingRows` :1208-1258);
  - `files.createDirectoryExclusive` (non-recursive project-root mkdir, `apps/harness/src/storage/project-storage-file-adapter.ts:58-89`, :76);
  - `buildDatabase` (refuses an existing file :508-510; inserts project state and identity :483-494,386-438);
  - the manifest writer (store :379-421);
  - `registry.activate` / `activateRows` (node-adapters :1621-1660, :1260-1303).
- Generic and reusable: `paths.forCreation` (node-adapters :1341-1355), `files.writeFileExclusive` (file-adapter :91-110), size and `sha256File` (store :366-375), `verifySealedGeneration` given an upgraded `creation` (node-adapters :630-661), `renameAtomic` (`.staging-<id>` to `<id>` sibling, refuses an existing target, file-adapter :132-163), and the validators `requireDeclaredSchemaObjects`, `requireCurrentMetadata` (:363-384), `databaseIdentityMatches` (:440-481) and `requireDatabaseIntegrity`.

### Migrations
- `applyGeneratedMigrations` (`apps/harness/src/storage/generated-migrations.ts:90-102`) → `pendingMigrations` (:49-74) throws "Current migration authority has inconsistent versions." when the stored format/schema version differs from the plan (:67-72); metadata is written by `applyBatch` in one write transaction (node-adapters :234-277, SQL :223-232).
- `requireAuthorizedSql` (`apps/harness/src/storage/generated-migration-resources.ts:300-344`) requires created tables to equal `spec.tables` (:329-331,341-343) and calls `requireCanonicalRebuild` (:252-298) when a `__new_storage_identity` candidate exists or the schema is 2 or 3; it accepts only schema 2 with 2 migrations or schema 3 with exactly 3, with pinned ids and hashes (:267-297).
- Canonical spec: format 1, schema 3, 13 tables (`apps/harness/src/storage/project-storage-database-specs.ts:1514-1535`). No previous canonical spec exists; all `previous*DatabaseSpec` exports are application specs (:847,1254,1345,1386,1457,1501).
- Drizzle: `apps/harness/drizzle/canonical/0000_fat_doctor_octopus.sql`, `0001_canonical_project_writer.sql`, `0002_initial_repository_binding.sql`, `meta/_journal.json`; config `apps/harness/drizzle.canonical.config.ts:1-7`; scripts `apps/harness/package.json:11-15`; drift check `scripts/check-generated-migrations.mjs:84-95`; golden hash `scripts/check-golden-sql.mjs:8-17`; packaged by `apps/desktop/vite.harness.config.ts:10-11,134` into `harness-migrations` (`apps/harness/src/process-bootstrap.ts:96`).
- In-place precedent: `migrateApplicationDatabase` (`apps/harness/src/storage/application-database-migration.ts:264-297`) validates a known previous head against its spec (`firstRequiredApplicationMigration` :166-190, `knownPreviousHeads` :193-221), applies `migrations.slice(first)`, upserts the head, re-verifies schema and integrity before commit; versions stay 1/1 and it bypasses `applyGeneratedMigrations`.

### Identity rows and "identical content"
- `insertDatabaseIdentity` writes `project_id, storage_id, generation_id, <lineage>, created_at` into `storage_identity` (slopstop.db) and `slopstop_runtime_storage_identity` (mastra.db) (node-adapters :386-438); `databaseIdentityMatches` checks five fields at build, sealed verification and opening against the registry row (:440-481, :578, :1113-1117).
- `manifestIdentityMatches` requires seven equal fields including `provenance.createRequestId` and `createdAt` (`apps/harness/src/storage/project-storage-opening-manifest.ts:41-54,94-108`).
- Rows that must change in a new generation: both identity rows (`generation_id`, `created_at`) and canonical `schema_metadata`. Content-comparable: the other 11 canonical tables (`canonical_events`, `command_idempotency`, `command_receipts`, `command_rejections`, `project_state`, `repository_bindings`, `project_workspaces`, `writer_fence`, `writer_generations`, `writer_handoffs`, `writer_recovery_records`) and `slopstop_runtime_schema_metadata` when the runtime spec is unchanged. `writer_*` generations are Project Writer integers, not Storage generations (database-specs :139,160).

### Manifest
- `ProjectStorageManifestV1Schema` pins `provenance.kind: "initial-create"`, null `sourceGenerationId`/`storageOperationId`, null `mastraMigrationHead`, and `projectSequence`/`runtimeWaterline` literal 0 (`apps/harness/src/storage/project-storage-manifest.ts:32-66`); strict decode on parse and serialize (:69-77).
- Consumers: the writer (store :379-421); `verifySealedGeneration` with `requireActivationBaseline` size and SHA-256 (node-adapters :596-661); opening `inspectOpeningManifest` (version above 1 = unsupported-newer, parse failure = corrupt, mismatch = identity-conflict; opening-manifest.ts:76-108); `settledOpeningProbes` (node-adapters :1145-1177); filesystem witnesses classify `manifest.json` without parsing (`apps/harness/src/storage/project-storage-filesystem-authority.ts:145-174`).
- The SHA-256 is checked only before and after the rename and inside registry activation (store :429,444; node-adapters :1630), never on opening; it is an activation baseline (ADR 0006 :120). ADR 0006 :119 and ADR 0005 :18,20 require a migrated manifest to carry source generation, operation identity, Project sequence and runtime waterline.

### Registry
- `storage_generations` has NOT NULL `create_request_id` / `create_request_fingerprint` (database-specs :102-118), a UUID check, a fingerprint format check, directory = generation id, and `creation_state` limited to `active` with `activated_at`, or `staging` without it (:404-430); runtime decode agrees (`apps/harness/src/storage/project-storage-node-schemas.ts:84`). A partial unique index allows one active row per storage (:883-889).
- `activateRows` sets the registration pointer only when it is null and requires exactly one affected row per step (node-adapters :1260-1303); `requireApplicationRelationships` requires every active generation to be the registered one (application-database-migration.ts:112-131). Cap: 256 generations per Project (node-adapters :150, :713-718).
- No column, table or state exists for a prior generation, an upgrade or a backup. Adding a registry table follows the 0006 example: Drizzle schema (`apps/harness/src/storage/application-schema.ts:407-411`), SQL and snapshot/journal (`apps/harness/drizzle/application/0006_registration_list_visibility.sql`, `meta/_journal.json:47-53`), spec composition (database-specs :1501-1513), head constant and `knownPreviousHeads` (application-database-migration.ts:17,59,217-220), and an upgrade integration test (`apps/harness/tests/integration/registration-visibility-upgrade.integration.test.ts:23-63`).

### Opening with extra generations or backups
- Order in `selectHealthyOpening` (node-adapters :1007-1062):
  1. `inspectRegisteredRecovery` returns recovery-required on a null pointer, a staging row or filesystem staging (opening.ts:44-77).
  2. `exactlyOne(generations)` throws broken on more than one row (:1035, :203-209).
  3. `filesystemAgrees` requires exactly one ordinary generation directory equal to the active one (:1036-1046), otherwise recovery-required.
- Filesystem scan: at most 256 root entries; reserved names (`snapshots`, `storage-operations`, `storage-operation.journal`) are recorded as witness kinds; any other non-UUID entry or plain file is broken; generation directories hold at most 16 known files (filesystem-authority :43-62,75-80,126-143,152-174,219-271,311-332). A registered Project's healthy selection ignores reserved kinds (node-adapters :1027,1037-1039).
- Classification today:
  - a prior generation directory is recovery-required;
  - a prior generation row cannot be represented, and if present gives broken;
  - a backup file or non-UUID directory at the root is broken;
  - a backup inside a generation directory is broken.

### Protocol and renderer
- `protocolVersion = 5` (`packages/protocol/src/protocol.ts:66`). `project.activate` / `project.activate.result` (:247-251,278-282). `CanonicalProjectActivationResultSchema` variants: active read-write, active read-only `WRITER_UNAVAILABLE`, safe-mode with healths and no diagnostic, not-registered, rejected/unavailable/broken with `{code,message,retryable}` (`packages/protocol/src/canonical-project-protocol.ts:141-156,168-252`). Health vocabulary includes `migration-required` / `DATABASE_MIGRATION_REQUIRED` (`packages/protocol/src/project-storage-protocol.ts:24-69`).
- The coordinator drops store messages for non-ready storage: `PROJECT_STORAGE_UNAVAILABLE` (retryable) and `PROJECT_STORAGE_BROKEN` (not retryable) (coordinator :274-296).
- The desktop bridge echoes and decodes one result; an extra correlated event with another name fails the request (`apps/desktop/src/main/project-entry-bridge.ts:39-52,83-119,140-146`); IPC `projects:activate` (`apps/desktop/src/main/main.ts:367-368`); preload single invoke (`apps/desktop/src/preload/preload.ts:29-36`).
- Renderer: `open()` sets `busy` (`apps/desktop/src/renderer/projects-workspace.tsx:137-164`), `WorkspaceView` shows "Opening Project…" (`apps/desktop/src/renderer/workspace-view.tsx:69-74`); `present()` maps safe mode to `safeModeLabel` without the diagnostic code (projects-workspace.tsx:80-104; `projects-list.tsx:21-32`).
- Existing error pattern: "Try again" plus "Reference: <code>" (`apps/desktop/src/renderer/remove-from-list/removal-view.tsx:77-86`; `outcome-view.tsx:24-26,70-72`). The renderer copy is English.

### Failure injection and interruption
- `CreationCheckpoint` (store :60-77) and the `failures.checkpoint` port (:229-231; no-op default node-adapters :1319-1323); test override throws at `failAt` (`apps/harness/tests/integration/project-storage-runtime-fixture.ts:139-144`).
- Current "interruption" tests throw, stop, snapshot state and retry; they never kill a process (`apps/harness/tests/integration/project-storage-create.integration.test.ts:1308-1461`); recovery residue is seeded by hand (`project-storage-open-recovery.integration.test.ts:221-275`).

## Code References
- `apps/harness/src/storage/project-storage-store.ts:60-89` — creation checkpoints and `AllocatedCreation`
- `apps/harness/src/storage/project-storage-store.ts:181-237` — `ProjectStorageStoreDependencies` ports
- `apps/harness/src/storage/project-storage-store.ts:308-459` — `createFreshGeneration`
- `apps/harness/src/storage/project-storage-store.ts:574-641` — `retainActivation`, `acquireActivation`
- `apps/harness/src/storage/project-storage-node-adapters.ts:386-481` — identity insert and match
- `apps/harness/src/storage/project-storage-node-adapters.ts:496-661` — `buildDatabase`, `verifyOwnedDatabase`, `verifySealedGeneration`
- `apps/harness/src/storage/project-storage-node-adapters.ts:1007-1177` — opening selection and probes
- `apps/harness/src/storage/project-storage-node-adapters.ts:1208-1303` — staging rows and `activateRows`
- `apps/harness/src/storage/project-storage-node-adapters.ts:1424-1486` — `inspectOpening`
- `apps/harness/src/storage/project-storage-opening.ts:44-77,198-275,348-389,397-496` — recovery, compatibility, classification, release
- `apps/harness/src/storage/project-storage-manifest.ts:32-77` — manifest schema
- `apps/harness/src/storage/project-storage-opening-manifest.ts:41-108` — manifest identity at opening
- `apps/harness/src/storage/project-storage-filesystem-authority.ts:43-352` — witness scan
- `apps/harness/src/storage/generated-migrations.ts:49-102` — migration plan and version guard
- `apps/harness/src/storage/generated-migration-resources.ts:252-392` — authorized SQL and rebuild pin
- `apps/harness/src/storage/project-storage-database-specs.ts:102-118,404-430,883-889,1501-1535` — registry columns, checks, specs
- `apps/harness/src/storage/application-database-migration.ts:58-59,112-131,166-297` — heads, relationships, in-place migration
- `apps/harness/src/storage/local-libsql-worker-client.ts:98-101,213-270,315-447` — worker requests and close
- `apps/harness/src/active-project-coordinator.ts:274-296,391-463` — activation results and lease
- `apps/harness/src/storage/project-storage-file-adapter.ts:58-163` — directory creation and atomic rename
- `packages/protocol/src/protocol.ts:66,247-282` — protocol version and activation messages
- `packages/protocol/src/canonical-project-protocol.ts:141-252` — activation result schema
- `apps/desktop/src/main/project-entry-bridge.ts:39-146` — activation bridge
- `apps/desktop/src/renderer/projects-workspace.tsx:80-164` — open and present

## Integration Points

### Inbound References
- `apps/harness/src/active-project-coordinator.ts:441-463` — `acquireProject` calls `storage.acquireActivation` and returns the safe-mode result
- `apps/harness/src/active-project-coordinator.ts:620-635` — `switchProject` releases the source then activates the target (fresh inspection)
- `apps/desktop/src/renderer/projects-workspace.tsx:137-150` — renderer `open()` issues `activateProject`

### Outbound Dependencies
- `apps/harness/src/storage/local-libsql-worker-client.ts:213` — `node:sqlite` `DatabaseSync` per database
- `apps/harness/drizzle/canonical/meta/_journal.json` — packaged canonical migrations
- `apps/harness/src/storage/application-schema.ts:74-114` — registry tables and constraints

### Infrastructure Wiring
- `apps/harness/src/storage/project-storage-node-adapters.ts:1311-1323,1682-1692,1705-1719` — migration cache, opening/witness wiring, failure port, project locks
- `apps/harness/src/process-bootstrap.ts:96` — packaged migration root
- `apps/desktop/vite.harness.config.ts:10-11,134` — copies `apps/harness/drizzle` into the package
- `apps/desktop/src/main/main.ts:367-368` — IPC handler for activation

## Architecture Insights
- Detection is already safe and precise: `migration-required` is reached only after identity and integrity checks, so it is a trustworthy trigger for an upgrade request.
- Opening never re-hashes; the manifest's SHA-256 is an activation baseline. An upgraded generation therefore needs a fresh baseline only for its own activation.
- The registry is designed around "one active generation per storage" (partial unique index), which already allows several generations per storage; what is missing is a non-active, non-staging state and a repointing activation.
- Opening's strict filesystem scan is the main reason a kept prior generation and a backup are currently fatal; ADR 0005 :24 nevertheless wants these witnesses to force explicit results rather than initialization, so the scan must learn them, not ignore them.
- The application-database migration is the closest pattern for "known previous head + verify before commit", but it is in place; the canonical upgrade is staged.

## Precedents & Lessons
5 similar past changes analyzed.

### Precedent: canonical generation two and the pinned storage_identity rebuild
**Commit(s)**: `37e3f83` — "feat(storage): add canonical generation two" (2026-09-10)
**Blast radius**: 17 files across 4 layers
  drizzle/canonical — 0001 migration, snapshot, journal
  harness/storage — canonical schema, verifier, rebuild authorization, specs, node adapters
  tests/integration — create, open, schema fixtures
  kernel — storage identifiers

**Follow-up fixes**:
- `cefc503` — "run the canonical storage-identity rebuild case as an integration test" (2026-10-05) — 34 temporary migration trees timed out under Windows load

**Lessons from docs**:
- .rpiv/artifacts/handoffs/2026-09-07_11-52-38_for-the-next-agent-to-continue-the-implementation.md — rebuilds are authorized only for the exact reviewed statement vector

**Takeaway**: any new migration that touches the rebuild pin needs explicit pinned authorization, and real-migration tests belong in integration.

### Precedent: application database authority and upgrades
**Commit(s)**: `daee118` — "chore(effect): checkpoint schema migration, unit 2a and application.db authority" (2026-10-03)
**Blast radius**: 169 files across storage, opening, manifest, node adapters

**Follow-up fixes**:
- `18d9761` — "stop a fresh application database from counting as observed" (2026-10-03) — a half-created file read as valid state
- `32c52fa` — "verify the application schema before commit and recover clean starts" (2026-10-03) — verification moved inside the transaction; tests switched to real historical heads

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-03_effect-migration-authority.md — authority over migrations

**Takeaway**: verify before commit, never treat a half-created artifact as valid, test from real historical heads.

### Precedent: application migration 0006 registration_list_visibility
**Commit(s)**: `52b5bc2` — "feat(registration): remove a Project from the saved list and bring it back" (2026-10-05)
**Blast radius**: 25 files across drizzle/application, storage, registration, protocol, desktop fake

**Follow-up fixes**:
- none in storage; four integration tests needed head-pin edits

**Takeaway**: every new migration moves the head pin and touches the tests that assert it.

### Precedent: Project Storage opening, staged create and exclusive activation
**Commit(s)**: `97b4767` — "feat(storage): implement project storage opening" (2026-09-04); `9bbad73` — "feat(writer): enforce exclusive project activation" (2026-09-10); `77f7667` — "feat(writer): reconcile uncertain command commits" (2026-09-10)
**Blast radius**: 126 + 46 files across store, opening, manifest, filesystem authority, node adapters, protocol

**Follow-up fixes**:
- `f4e83c8` — "register an admitted Storage operation only after it starts" (2026-10-03) — a sync throw left stop hanging

**Takeaway**: a new step inside activation or the store lifecycle must settle on sync throws and interruption.

### Precedent: database worker on node:sqlite
**Commit(s)**: `9be86e4` — "fix(storage): run the local database worker on node:sqlite" (2026-10-05)
**Blast radius**: worker client and storage tests

**Follow-up fixes**:
- `04a4568`, `6a5759f` — supporting changes in the same series

**Lessons from docs**:
- .rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md — root cause of the libsql crash and file locks

**Takeaway**: on Windows every connection must be closed before a rename or delete.

### Composite Lessons
- Close every database handle before any copy, rename or delete on Windows (`9be86e4`); put backup, staging and rename tests in `tests/integration/` from the start (`cefc503`).
- Give the upgrade marker, staging output and backup distinct absent/partial/corrupt diagnostics; a partial output must never look like a valid generation (`18d9761`, `32c52fa`).
- Verify schema and content before the switch, and test from real pinned historical heads (`32c52fa`).
- The migration guard allows only reviewed SQL; the rebuild pin must be extended deliberately (`37e3f83`).
- Lifecycle steps have hung shutdown before; the upgrade must settle on sync throws and interruption (`f4e83c8`).
- Expect head-pin churn across create, open, recovery and registration fixtures (`52b5bc2`).
- One owner per upgrade marker; racing activations must not both upgrade (`18d9761`).

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md` — FRD for this work
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` — Conversation decisions, section 4 option A
- `.rpiv/artifacts/handoffs/2026-10-05_conversation-c1-local-save-brief.md` — Conversation C1 brief
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md` — Project Storage opening design
- `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md` — opening health research
- `.rpiv/artifacts/evidence/2026-10-03_effect-migration-authority.md` — migration authority evidence
- `.rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md` — worker crash and test reclassification
- `.rpiv/artifacts/handoffs/2026-09-07_11-52-38_for-the-next-agent-to-continue-the-implementation.md` — rebuild authorization handoff

## Developer Context
**Q (discover: Who the upgrade serves): What problem must option A solve, for whom, and how do you know it went well?**
A: "Eu, a usar a app" — open an old Project after an update and keep working as if nothing happened.

**Q (discover: Unacceptable outcomes): What would be unacceptable at that moment?**
A: losing data, waiting long, having to do something, failing silently.

**Q (discover: Runs automatically): ADR 0005 already allows a data-preserving upgrade to run without asking. Keep it?**
A: keep — runs on its own.

**Q (discover: Nothing deleted automatically): Keep the current version, the prior version and the pre-upgrade backup until the user deletes them?**
A: keep — nothing is deleted.

**Q (discover: Show progress): Keep a bare busy state during the upgrade?**
A: change — show progress text.

**Q (discover: How much of ADR 0005 to build now): Full journal, reduced A with a single marker, or in-place?**
A: reduced A — "é importante salientar que depois teremos que completar".

**Q (discover: On failure): If the upgrade fails, what happens to the Project?**
A: open read-only with a message, reference code and a retry action.

**Q (discover: On interruption): If the app closes mid-upgrade?**
A: restart automatically; confirm a completed switch; never fall back silently.

**Q (discover: What verification proves): What must verification prove before switching?**
A: identical old data, complete new schema, integrity.

**Q (discover: Time target): Under 2 s for a normal Project?**
A: 2 s now as a tolerant target; aim below 1 s eventually.

**Q (`apps/harness/src/storage/project-storage-node-adapters.ts:386-438`): A new generation must rewrite each database's identity row and the canonical schema_metadata. How does verification treat them?**
A: identical except identity — the 11 other canonical tables (and the unchanged runtime metadata) must be identical; identity rows keep project, storage and lineage, with only generation id and created-at changing, verified separately. This corrects FRD FR4(a) and the "mastra.db copied unchanged" non-goal.

**Q (`packages/protocol/src/protocol.ts:247-282`, `apps/desktop/src/main/project-entry-bridge.ts:48`): How does the window learn to show the progress text?**
A: two automatic steps — activate answers safe-mode `migration-required`; the renderer, without asking, shows the progress text, sends a dedicated upgrade request, then activates again. "Try again" re-issues the upgrade request.

**Q (`apps/desktop/src/renderer/remove-from-list/removal-view.tsx:77-86`): Which language for the upgrade texts?**
A: English, like the rest: "Updating Project…", "This Project could not be updated. Your data is intact.", "Try again", "Reference: <code>".

**Q (`apps/harness/tests/integration/project-storage-create.integration.test.ts:1423-1461`): How is interruption proven?**
A: injected errors at every step plus one real process kill during the generation switch.

## Related Research
- `.rpiv/artifacts/research/2026-08-31_16-13-56_project-storage-opening-health.md`

## Open Questions
- None deferred by the user.
