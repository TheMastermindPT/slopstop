# C1-0 S1 TDD Evidence (append-only)

- Slice: `c1-0-s1-staged-upgrade-engine`
- Contract: `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`, `content_hash` `12dfee1e3a6a1e65d1c6bf604fefd0239a47fcd8571e79da5d2fc13c54403a1b` (validator OK at start)
- Build authorization: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` section 5
- Workspace: branch `feat/c1-0-s1-staged-upgrade-engine` from `main` `a5e19a6`, in the main working tree (user choice; no linked worktree). Unrelated untracked `.playwright-mcp/` left untouched.
- Working directory for vitest commands: `apps/harness`.

## Process notes

- CodeScene baseline per touched file was not captured before the first edit (design Verification Notes asked for it). Compensation: `pre_commit_code_health_safeguard` reports deltas against `HEAD` for each touched file; every touched file is measured after the change.

## Group 1 — pure modules (UPG-B8, UPG-B14, UPG-B16)

### UPG-B8 `classifies pending statements by additive kind`

- Test: `apps/harness/src/storage/project-storage-upgrade-eligibility.test.ts`
- Scaffold: `classifyUpgradeStatements` stub answering `{ status: "eligible" }` for every list.
- Red: `pnpm exec vitest run src/storage/project-storage-upgrade-eligibility.test.ts` → 1 failed; 15 soft assertion failures: each of the 13 unsupported lists (`expected { status: 'eligible' } to deeply equal { status: 'unsupported' }`), the empty list (`... to deeply equal { status: 'empty' }`), and the unterminated quote (`expected function to throw an error, but it didn't`). Matches Expected red.
- Implementation: `sqlite-schema-scanner.ts` emits a `;` punctuation token; `project-storage-upgrade-eligibility.ts` splits statements on depth-independent `;` tokens and accepts only `CREATE TABLE <name> (` / `CREATE [UNIQUE] INDEX <name> ON` with no `__new_` name and no unquoted `IF`.
- Green: same command plus `src/storage/sqlite-schema-expression.test.ts` → 2 files, 4 tests passed.
- Note: the test uses `expect.soft` so every case reports in one red run.

### UPG-B14 `plans a version-moving upgrade and refuses incompatible authority`

- Test: `apps/harness/src/storage/generated-migrations.test.ts`
- Scaffold: `planUpgradeMigrations` returning the migrations after the stored id.
- Red: `pnpm exec vitest run src/storage/generated-migrations.test.ts` → 1 failed | 1 passed; all 7 refusal cases failed (no throw). Matches Expected red.
- Green: same command → 2 passed. Messages are the three from Pipeline step 1.

### UPG-B16 `parses and serializes version-2 upgrade manifests strictly`

- Test: `apps/harness/src/storage/project-storage-manifest.test.ts`
- Red: `pnpm exec vitest run src/storage/project-storage-manifest.test.ts` → 1 failed | 1 passed; `SchemaError: Expected 1` on the valid version-2 manifest. Matches Expected red.
- Green: same command → 2 passed. Schema is a union of strict v1 and v2; v2 requires `staged-upgrade` provenance with `storageOperationId === createRequestId`.
- Difference from design: the design says the existing "rejects non-v1 shapes" case "is replaced by UPG-B16". It was kept unchanged (name and assertions), because every assertion in it remains true (its `manifestVersion: 2` input keeps `initial-create` provenance and stays rejected). No oracle was weakened.
- Type ripple: `ProjectStorageManifestV1` type uses in `project-storage-node-adapters.ts`, `project-storage-opening-manifest.ts`, `project-storage-opening.ts` and `tests/integration/project-storage-open.integration.test.ts` renamed to the union `ProjectStorageManifest` (type-only). Opening still blocks version ≥ 2 as `unsupported-newer` until UPG-B3.

### Group 1 gates (before commit)

- `pnpm check` (repo root) → exit 0; 57 files, 2317 tests passed; no dependency violations.
- `pnpm check:duplicates` → 0 clones. `pnpm check:dead-code` (knip) → no findings.
- CodeScene `pre_commit_code_health_safeguard` first run → failed (scanner cc 11→12; `planUpgradeMigrations` complex method/conditional; manifest duplicate struct shapes). Refactored (punctuation and identifier scanning extracted; compatibility check extracted; v2 reuses v1 `fields.canonical`/`fields.runtime`). Second run → passed (scanner improved). Scores: `sqlite-schema-scanner.ts` 10, `generated-migrations.ts` 10, `project-storage-manifest.ts` 10, `project-storage-upgrade-eligibility.ts` 10.

## Group 2 — UPG-B1 (pipeline, registry 0007, opening)

### UPG-B1 `upgrades a generation-two Project and opens it read-write with identical data`

- Test: `apps/harness/tests/integration/project-storage-upgrade.integration.test.ts`; fixtures `tests/integration/project-storage-upgrade-fixture.ts` (fixture command `fixture.record-note`, real writer composition, generation-two seed) and `createUpgradeStorageOwner` in `tests/integration/project-storage-runtime-fixture.ts`.
- Command (repository root; the integration config resolves some fixtures from the root, e.g. `canonical-writer-package-smoke` uses `path.resolve("apps/harness/drizzle")`): `pnpm exec vitest run --config vitest.integration.config.ts apps/harness/tests/integration/project-storage-upgrade.integration.test.ts`.
- Scaffold: owner `upgrade` answering `{ status: "ready", result: { status: "not-required", request } }`; registry 0007 `storage_upgrades` already added (head pins moved to `0007_storage_upgrades`, `storage_upgrades` appended to the registration table list; integration 52 files green at that point).
- Red: 1 failed — `expected { status: 'ready', result: { …(2) } } to deeply equal { status: 'ready', result: { …(5) } }`, received `status: "not-required"`. Matches Expected red. The generation-two fixture completed (its schema equals the 0000 + golden generation-2 reference; activation safe-mode canonical `migration-required`, runtime `healthy`).
- Implementation: `project-storage-upgrade.ts` (types, step port), `project-storage-upgrade-pipeline.ts` (Effect program; each step fails with its own tagged error — `UpgradeInspectionFailed`, `UpgradePlanFailed`, `UpgradeDeclarationFailed`, `UpgradeStagingFailed`, `UpgradeMigrationFailed`, `UpgradeSealFailed`, `UpgradeSwitchFailed`, `UpgradeCheckpointFailed` — converted to the owner outcome once in `runProjectStorageUpgrade`), `project-storage-upgrade-node-adapter.ts` (plan, declare, stage by `VACUUM INTO`, migrate and re-identify, switch), `project-storage-generation-manifest.ts` (manifest and baselines shared with create), worker read-only open option, opening createdAt rule and exact directory set.
- First run after implementation failed with `broken` "Project Storage upgrade declaration failed." (cause `UNIQUE constraint failed: storage_generations.storage_id, storage_generations.generation_directory_name`): fixture defect — a fresh owner allocated the creation generation id for the upgrade target. Fixed in the fixture (target id while `upgrade` runs). Oracle unchanged.
- Green: same command → 1 passed. Full integration (root) → 51 passed, 1 skipped (1919 tests); registration config → 18 files, 220 tests passed.
- **Read-only `VACUUM INTO`: settled — it works from a `readOnly` `node:sqlite` connection; the read-only path is used (no read-write fallback).**
- Differences from design, recorded:
  - `VACUUM INTO` runs as an ordinary `execute("VACUUM INTO ?", [target])` on the read-only client; no dedicated worker `vacuum-into` request was added (the read-only option was).
  - B1 still writes a version-1 manifest (with `createRequestId = U`); version 2 arrives with UPG-B3 as its Expected red states.
  - `files.createDirectoryInProject` exists as a recursive-`mkdir` stub, which UPG-B13 replaces (its Expected red names exactly this stub).
  - The writer composition, fixture command and generation-two seed live in a new `tests/integration/project-storage-upgrade-fixture.ts` instead of `project-storage-historical-fixture.ts`.
  - Design's "typed dependency fakes" also needed `upgrades` and `files.createDirectoryInProject` in `project-storage-store.test.ts`.

### Group 2 gates (before commit)

- `pnpm check` → see commit gate run below; knip clean after un-exporting unused symbols; jscpd 0 clones; `pnpm db:generate:check` → no schema changes.
- CodeScene safeguard first run failed (store `createFreshGeneration` large method, store-test fake large method, `readSourceGeneration` complex conditional, fixture string-heavy arguments, test large method); refactored; second run passed. Scores: pipeline, node adapter, generation manifest, store, worker client, database specs, fixture, test → 10. `project-storage-node-adapters.ts` 8.41, verdict `stable` (pre-existing; only its line count grew 1098 → 1104). Gap to 10 on that file is reported, not fixed in this slice.

## Group 3 — UPG-B5, UPG-B4

### UPG-B5 `answers not-required or not-registered without changing anything`

- Red (`-t "not-required or not-registered"`, repository root): 1 failed; the unregistered case received `status: "not-required"` instead of `not-registered`; the current-Project case passed as a guard (snapshot equal, released, read-write on S). Matches Expected red.
- Implementation: an opening with no retained session answers `not-registered`.
- Green: upgrade test file → 2 passed.

### UPG-B4 `refuses ineligible Projects without changing anything`

- Red (`-t "refuses ineligible"`): (a) generation-one → `broken` "Project Storage upgrade migration failed." after declaring and staging (it proceeded into the pipeline, as expected), activation then `recovery-required`; (b) corrupt manifest → `not-required` (as expected); **(c) generation-two canonical + corrupt runtime → `broken` "Project Storage upgrade staging failed.", not `not-required` as the design predicted**: B1's minimal eligibility checked only canonical `migration-required`, so (c) entered the pipeline. Recorded as observed; not forced.
- First red run stopped after (a) at a hard activation assertion; that assertion was made `expect.soft` so every case reports in one run (oracle unchanged).
- Implementation: eligibility = safe-mode with canonical `migration-required` and runtime `healthy`, otherwise the exact `refused PROJECT_UPGRADE_NOT_ELIGIBLE`; the plan classifies the pending canonical statements (`unsupported` → exact `refused PROJECT_UPGRADE_UNSUPPORTED`; `empty` → `ProjectStorageBrokenError`).
- Green: upgrade test file → 3 passed.

### Group 3 gates (before commit)

- `pnpm check` exit 0; jscpd 0 clones; knip clean; CodeScene safeguard first run failed (string-heavy arguments in the upgrade fixture and test), parameters converted to objects, second run passed with no findings.

## Group 4 — UPG-B2, UPG-B3

### UPG-B2 `declares first, keeps the prior generation byte-identical, a verified backup and an exact registry record`

- Scaffold: strict `ProjectStorageBackupManifestV1` schema with `parseProjectStorageBackupManifest` / `serializeProjectStorageBackupManifest` (the test decodes through it), no backup step yet.
- Red (`-t "declares first"`): 1 failed — `ENOENT ... scandir '...\snapshots\00000000-0000-4000-8000-0000000000a1'`; the declared-first observation, the byte-identical source and the release check passed before it. Matches Expected red.
- Implementation: `copyBackup` (create `snapshots/<U>/`, `VACUUM INTO` both source databases from read-only clients), checkpoint `after-backup-copied`, `sealBackup` (backup manifest written exclusively from the backup files' sizes and SHA-256, the source manifest's heads and lineages, `project_state.last_project_sequence` of the backup and the source's runtime waterline), checkpoint `after-backup-verified`. New tagged error `UpgradeBackupFailed`. The read-back verification is UPG-B15's.
- Green: upgrade test file → 4 passed.

### UPG-B3 `records upgrade provenance and reopens healthy with retained generations`

- Red (`-t "records upgrade provenance"`): 1 failed — T's manifest received `manifestVersion: 1`, `projectSequence: 0`, provenance `initial-create` with null source and operation. Matches Expected red.
- Implementation: `serializeGenerationManifest` takes a provenance (`initial-create` → v1; `staged-upgrade` → v2 with `storageOperationId = createRequestId`); migrate returns the staged `last_project_sequence` and the source's runtime waterline; opening decodes versions 1 and 2, `≥ 3` → `unsupported-newer`.
- Mechanical follow-up named by the design: `project-storage-open.integration.test.ts` "unsupported-newer" seed moves from `{"manifestVersion":2}` to `{"manifestVersion":3}` (it failed after the change, as the design anticipated).
- Green: upgrade + open test files → 50 passed.
- Full integration (root) after B3 → 51 passed, 1 skipped (1923 tests; 616 s wall time on the host).

### Group 4 gates (before commit)

- CodeScene safeguard first run failed (`upgradeProgram` 72 lines); split into `backupSource` and `buildTarget`; second run passed (only the pre-existing `project-storage-node-adapters.ts` line count, verdict `stable`, 1104 → 1105).
- After the split: upgrade + open + create files → 111 passed; `pnpm check` exit 0; jscpd 0 clones; knip clean.

## Group 5 — UPG-B10, UPG-B9

### UPG-B10 `bounds manifest versions and provenance at opening`

- Placed in `project-storage-upgrade.integration.test.ts` (the version-3 case already lives in `project-storage-open.integration.test.ts` since B3).
- Red (`-t "bounds manifest"`): exactly the three predicted cases answered read-write — `sourceGenerationId` only, version-1 manifest on T, version-2 manifest on a never-upgraded Project. Guards on arrival: T manifest `generationId`, `createRequestId` (+ `storageOperationId`), `createdAt` → `identity-conflict`; version 2 without `sourceGenerationId` → `corrupt`. Matches Expected red.
- Implementation: opening carries the completed upgrade (now also its `target_generation_id`) into `inspectOpeningManifest`; a manifest is version 2 exactly when a completed upgrade targets the generation, and then names its source and `upgrade_id`; otherwise version 1. Disagreement → `identity-conflict`.
- Green: upgrade + open + registered-project-selection → 60 passed. Duration 4.6 s against the 15 s per-test timeout (`projectStorageIntegrationTimeout`, unchanged).

### UPG-B9 `keeps unavailable and broken outcomes for upgrade`

- `seedContradictoryActiveLocation` moved from `project-storage-open.integration.test.ts` into `project-storage-open-fixture.ts` (shared, unchanged body).
- Red (`-t "keeps unavailable and broken"`): both locked cases (S `slopstop.db`, S `mastra.db` under `PRAGMA locking_mode = EXCLUSIVE` + `BEGIN EXCLUSIVE` from another connection) answered the exact `refused PROJECT_UPGRADE_NOT_ELIGIBLE`; stopped-owner and contradictory-registry cases passed as guards. Matches Expected red.
- Implementation: any `unavailable` database health at inspection raises `ProjectStorageUnavailableError("Project Storage is busy; the upgrade can be retried.")`, carried by `UpgradeInspectionFailed` and converted to `unavailable` at the boundary.
- Green: upgrade test file → 7 passed (B9 2.2 s).

### Group 5 gates (before commit)

- `pnpm check` exit 0; jscpd 0 clones; knip clean; CodeScene safeguard passed (only the pre-existing node-adapters line count, `stable`, 1105 → 1107); open + open-recovery + registered-selection re-run green.

## Group 6 — UPG-B7, UPG-B15

### UPG-B7 `fails verification without switching when the staged copy differs`

- One test per staged-copy change through `it.for(stagedCopyFaults)`, named `fails verification without switching when the staged copy differs: <case>` (difference from the design's single test name, so each case keeps the unchanged 15 s per-test timeout). Faults live in `tests/integration/project-storage-upgrade-faults.ts`, applied with foreign keys off at `after-staged-migration`.
- Red (`-t "fails verification"`): (a) deleted event and (e) changed event value → `upgraded`; (b) dropped table → `broken` "Database contains an unexpected table set."; (c) runtime head → `broken` "Database metadata authority is not current."; (d) storage identity and (g) runtime lineage → `broken` "Database identity does not agree."; (f) orphan workspace → `broken` "Database foreign-key integrity validation failed."; (h) page-2 bytes → `broken` "Project Storage sealed generation verification failed.". Matches Expected red.
- Implementation: `project-storage-upgrade-verification.ts` `verifyStagedCopies` (packaged schema, `integrity_check` + `foreign_key_check`, row count and digest over all columns of all rows in total order for every source table other than the identity row and canonical `schema_metadata`, identity re-identified with S's project, storage and lineage ids); any mismatch, `ProjectStorageBrokenError` or corrupt-class error → `mismatch` → exact `failed PROJECT_UPGRADE_VERIFICATION_FAILED`; checkpoint `after-staged-verified`; tagged error `UpgradeVerificationFailed`.
- Green: 8 cases pass with the leftover-state oracle (S active and byte-identical, marker `in-progress`, T `staging`, `.staging-T/` and `snapshots/U/` released, activation safe-mode `recovery-required` on S, authority restart `current`, second upgrade refused NOT_ELIGIBLE).

### UPG-B15 `fails before staging when the backup does not verify`

- Same `it.for` form for (a)–(d); (e) busy is its own test with the same name prefix.
- **Red differed from the design for (a)–(c) and (e)** (recorded, not forced): (a) zeroed canonical, (b) zeroed runtime, (c) page-2 bytes → `broken` "Project Storage upgrade backup failed." (B2's `sealBackup` already reads the backup's `project_state` and sizes, so an unreadable copy fails there, never `upgraded`); (d) another Project's intact copy → `upgraded` (as predicted); (e) locked backup → `unavailable` "Project Storage authority is unavailable." (generic busy mapping), not `upgraded`.
- Implementation: `verifyBackupCopies` reads each closed backup back (integrity and keys, identity row and schema head equal to S's); corrupt-class or mismatch → `invalid` → exact `failed PROJECT_UPGRADE_BACKUP_INVALID` before any staging directory; busy-class → `ProjectStorageUnavailableError("Project Storage is busy; the upgrade can be retried.")`.
- Green: upgrade test file → 20 passed.

### Group 6 gates (before commit)

- `pnpm check` exit 0; jscpd 0 clones; knip clean after un-exporting two fault helpers; CodeScene safeguard passed with no findings; new files scored 10 (`project-storage-upgrade-verification.ts`, `project-storage-upgrade-faults.ts`, upgrade test, pipeline, node adapter).

## Group 7 — UPG-B17 `rolls back declare and switch transactions on failure`

- Red (`-t "rolls back"`): all three cases answered `upgraded` (no `during-upgrade-*` checkpoint fired, no source guard); registry snapshots and the `snapshots/` absence assertions failed accordingly. Matches Expected red.
- Implementation: checkpoint `during-upgrade-declare` between the marker and the staging-row inserts and `during-upgrade-switch` after the registration is repointed, both inside their transactions (the adapters' normalization turns the injected failure into `broken` "Project Storage upgrade declaration failed." / "Project Storage upgrade switch failed." and the transaction rolls back); the switch first requires S's `storage_generations` row to equal the declared copy, else `ProjectStorageBrokenError("Project Storage upgrade source changed before the switch.")`.
- Green: upgrade test file → 21 passed.
- Gates: CodeScene first run flagged the B17 test (73 lines); the guard hook was extracted (`changeSourceCreatedAt`); second run passed. `pnpm check` exit 0, jscpd 0 clones, knip clean.

## Group 8 — UPG-B11 `replays, validates the registry and bounds directories after an upgrade`

- File `apps/harness/tests/integration/registration-storage-upgrades.integration.test.ts` (registration project; run with `pnpm exec vitest run --config vitest.registration.config.ts` from `apps/harness`). Split into parts named `<design name>: <part>` (replay and idempotency; one `it.for` case per corrupt-registry seed; createdAt and upgrade authority; exact directories) so each keeps the unchanged 15 s timeout.
- Red: replay of the original create → `blocked` (predicted). **Also observed, beyond the predicted red:** the conflicting `{ other projectId, original createRequestId }` answered `broken` instead of `blocked PROJECT_STORAGE_IDEMPOTENCY_CONFLICT`, and the five registry seeds (completed target unknown; source re-inserted as staging; second completed row; in-progress target unknown; in-progress source not active) restarted as `current` instead of `REGISTRY_CORRUPT`. Guards on arrival: changed `source_created_at` → activation and replay `broken`; second completed row without restart → activation `broken`; extra UUID directory and removed retained directory → safe-mode `recovery-required`.
- Implementation: `inspectCreateRows` resolves a create request id that matches no generation against a completed upgrade's `source_create_request_id` (same project and fingerprint → `active-replay` with the current identity after `requireActiveCreateAuthority`; other project → `idempotency-conflict`); `requireApplicationRelationships` gains the upgrade rule at heads that hold `storage_upgrades` (in-progress: source active and present, target staging; completed: target active, source absent; at most one completed per storage).
- Green: 8 passed; registration config 228 passed; upgrade + authority + create files 91 passed.
- Gates: jscpd first found one clone (`createUpgradedProject` in two test files) → moved to the upgrade fixture; lint flagged an `await` on a sync fault → removed; `pnpm check` exit 0; knip clean; CodeScene safeguard passed (node-adapters `stable`, line count 1108 → ~1150, score 8.41 unchanged; replay identity extracted into `activeReplay` to share with the existing path).

## Group 9 — UPG-B12 `upgrades an exact 0006 registry with a created Project to 0007`

- Not part of commit b5d7a15 (`git show b5d7a15:<file>` has no such test); written after it.
- Red (`-t "exact 0006"`, registration config): authority restart → `{ status: "broken", code: "REGISTRY_SCHEMA_UNKNOWN" }` instead of `current`. Matches Expected red (`knownPreviousHeads` lacks 0006).
- Implementation: `knownPreviousHeads` gains `0006_registration_list_visibility` with `previousVisibilityDatabaseSpec` and first required migration 7.
- Green: registration config → 229 passed; authority + authority-cases + open files → 54 passed.
- Gates: `pnpm check` exit 0, jscpd 0 clones, knip clean, CodeScene safeguard passed with no findings.

## Group 10 — UPG-B13 `creates upgrade directories only beneath an existing Project root`

- Test: `apps/harness/tests/integration/project-storage-upgrade-directories.integration.test.ts` through `createProjectStorageFileAdapter`.
- Red: the recursive-`mkdir` stub (in place since B1) created both valid directories and every refused one — "promise resolved 'undefined' instead of rejecting" for each refusal, the tree grew from 4 to 12 entries, a directory appeared outside `applicationStorageRoot`, the missing Project root was created, and the existing target was accepted. Matches Expected red.
- Implementation: `upgradeDirectoryProjectRoot` beside `assertStagingPath` (exactly `.staging-<uuid>` or `snapshots/<uuid>` under `<applicationStorageRoot>/projects/<ProjectId>/`); `createDirectoryInProject` requires the Project root to exist as a plain directory, refuses an existing target, creates `snapshots/` once, then `mkdir` without recursion; every refusal is `ProjectStorageBrokenError("Project Storage upgrade directory is invalid.")`.
- Green: directories + upgrade + filesystem-authority files → 23 passed.
- Gates: `pnpm check` exit 0, jscpd 0 clones, knip clean, CodeScene safeguard passed, new test file 10.

## Mutation gate

- Scope extended per design (additive only, thresholds unchanged): `stryker.project-storage.config.json` `mutate` += `project-storage-upgrade-eligibility.ts`, `generated-migrations.ts`, `project-storage-manifest.ts`; `apps/harness/vitest.project-storage-mutation.config.ts` `include` += their three unit tests.
- Command (repository root): `pnpm test:mutation:project-storage:harness` → exit 0, 2684 mutants, 14 min 13 s, **final mutation score 86.52** (break 80, low 80, high 90).
- Per file (killed+timeout over killed+timeout+survived+no-coverage): `generated-migrations.ts` 91.67 (8 survived); `project-storage-upgrade-eligibility.ts` 85.86 (13 survived, 1 no coverage); `project-storage-manifest.ts` 72.22 (2 survived, 3 no coverage — the backup-manifest parse/serialize functions are proven only by the upgrade integration tests, which are outside this mutation project); `database-schema-verifier.ts` 78.53, `sqlite-schema-expression.ts` 94.19, `project-storage-protocol.ts` 100, `process-fatal-diagnostics.ts` 100 (pre-existing scope); `project-storage-database-specs.ts` all ignored (static). Survivors are reported, not chased in this slice.

## Final verification (at 621de96, before this evidence-only commit)

- `pnpm check` (root) → exit 0; 57 unit files, 2317 tests; no dependency violations (391 modules).
- `pnpm test:integration` (root; harness and registration projects) → exit 0; 53 files passed, 1 skipped; 1949 tests passed, 4 skipped; 470 s.
- `pnpm check:duplicates` → 0 clones. `pnpm check:dead-code` (knip) → no findings. `pnpm db:generate:check` (apps/harness) → no schema changes.
- `pnpm test:mutation:project-storage:harness` → 86.52 (see Mutation gate).
- CodeScene `analyze_change_set` against `a5e19a6` → quality gates passed; 41 files checked; `sqlite-schema-scanner.ts` improved; `project-storage-node-adapters.ts` `stable` (score 8.41 before and after, lines 1098 → 1149). All new and other touched files score 10.
- Manual: none for S1.

## S1 deviations from the design (consolidated)

1. CodeScene baseline per file not captured before the first edit; deltas against `HEAD` used instead.
2. Manifest test "rejects non-v1 shapes" kept unchanged rather than replaced (all its assertions still hold).
3. `VACUUM INTO` runs through `execute("VACUUM INTO ?")` on a read-only client; no dedicated worker `vacuum-into` request (read-only open option added). Read-only `VACUUM INTO` works; no fallback used.
4. Fixture code (writer composition, `fixture.record-note`, generation-two seed, snapshot/release helpers) lives in new `project-storage-upgrade-fixture.ts` and `project-storage-upgrade-faults.ts`, not in `project-storage-historical-fixture.ts`; `seedContradictoryActiveLocation` moved into `project-storage-open-fixture.ts`.
5. B1 wrote a version-1 manifest until B3, and `createDirectoryInProject` was a recursive-`mkdir` stub until B13, as their Expected reds require.
6. Observed reds that differed from the design: B4(c) answered `broken` (staging failed), not `not-required`; B15(a)–(c) answered `broken` (B2's `sealBackup` already read the backup) and B15(e) answered `unavailable` with the generic message, not `upgraded`; B11 additionally showed the conflicting create as `broken` and the five relationship seeds as `current`. All recorded, none forced.
7. Some tests are split one case per test (`it.for` or named parts, `<design name>: <case>`) — B7, B15, B11 — so each keeps the unchanged 15 s timeout. Some assertions use `expect.soft` so one red run reports every case; no oracle was weakened.
8. The integration suite must run from the repository root (a pre-existing smoke test resolves `apps/harness/drizzle` relative to the working directory).
9. `inspectUpgradedCreate` (create replay after an upgrade) lives in `project-storage-node-adapters.ts` because it needs that file's private registry helpers: about +50 lines; the file's pre-existing 8.41 score is unchanged and is left to a user decision.
10. Mutation survivors in the new scope (eligibility 13, generated-migrations 8, manifest 2 survived + 3 no coverage) are reported, not chased.

## Review round 1 fixes (findings `s1-review-round-1.md` on cf56a87)

Commands: integration files from the repository root with `pnpm exec vitest run --config vitest.integration.config.ts <file>`; registration file from `apps/harness` with `--config vitest.registration.config.ts`; unit files from `apps/harness`.

- **F1 (B15(d) identity read-back).** The case is now "a backup with another identity": at `after-backup-copied` the backup's `storage_identity.storage_id` and `canonical_database_lineage_id` change; the schema head stays S's. (A first attempt that also changed `project_id` was rejected by `foreign_key_check`, not by the identity comparison — `storage_identity.project_id` references `project_state` — so `project_id` is left unchanged.) Probe: with `identityAndHead` comparing only the identity row count, the case answered `upgraded` (red, `r1-f1-probe`); restored → exact `failed PROJECT_UPGRADE_BACKUP_INVALID` with the leftover-state oracle (green).
- **F2 (busy staged copy).** New test `keeps unavailable and broken outcomes for upgrade: a busy staged copy` (exclusive lock on staged `slopstop.db` at `after-staged-migration`). Red: `failed PROJECT_UPGRADE_VERIFICATION_FAILED`. Fix: busy-class errors, directly or as a wrapped `cause`, raise `ProjectStorageUnavailableError("Project Storage is busy; the upgrade can be retried.")`. Green: exact busy outcome plus the leftover-state oracle.
- **F3 (broken source).** New tests `... a broken source while verifying the backup` / `... while verifying the staged copy` (S's `slopstop.db` zeroed at `after-backup-copied` / `after-staged-migration`). Red: both `failed`. Fix: source-side evidence is read before and outside the copy classification; a busy source is busy, any other source failure is `ProjectStorageBrokenError("Project Storage upgrade source verification failed.")`. Green: `broken` with that message, registration still on S.
- **F4 (BLOB fingerprint).** New `tests/integration/project-storage-upgrade-verification.integration.test.ts` `fingerprints rows that differ only in a BLOB value` (real SQLite files through the exported `tableFingerprints`). Red: identical fingerprints for `X'010203'` and `X'010204'`. Fix: BLOB values are encoded as `["blob", hex]` before hashing. Green. (A pipeline-level BLOB case is not reachable: every canonical text column carries CHECK constraints that `integrity_check` enforces, so a seeded BLOB fails integrity first.)
- **F5 (error normalization).** Only `declare` and `switchActive` normalize unknown errors to `broken`; `plan`, backup, stage, migrate and verification steps keep their errors for the owner's mapping (a `ProjectStorage*` error maps, anything else is rethrown). New test `... an unexpected step error is rethrown` (a pre-created `repository_bindings` table makes the staged migration fail with a raw SQLite error). Red: `broken` "Project Storage upgrade migration failed."; green: `upgrade` rejects with "already exists". No design oracle changed (every existing case still passes).
- **S1.** `planUpgradeMigrations` refuses when the packaged migration count differs from the packaged schema version. Red (unit): "expected function to throw an error, but it didn't"; green.
- **S2.** The staged canonical `schema_metadata` row must equal the packaged head of the plan. New staged fault "a changed canonical head". Red: `broken` "Database metadata authority is not current."; green: exact `failed PROJECT_UPGRADE_VERIFICATION_FAILED`.
- **S3.** `after-generation-rename` now goes through the pipeline `checkpoint()` helper between the seal step and a separate renamed-generation verification step (refactor; no observable change, all tests green).
- **S4.** `inspectUpgradedCreate` checks the upgraded Project's active create authority before answering `idempotency-conflict`. Red (registration): "conflict after changed createdAt" answered `ready … idempotency-conflict`; green: `broken`. Net line change in the waived file: −1.
- **S5.** B13 asserts `rejects.toBeInstanceOf(ProjectStorageBrokenError)` and the message for every refusal (passes on arrival).
- **S6.** B15(e) asserts the leftover state (`expectFailedUpgradeState`, no staging) after the busy backup (passes on arrival).
- **S7.** One `withDatabase` helper, exported from `local-libsql-worker-client.ts`, used by the node adapter and the verification module.
- **S8.** Backup-manifest unit test `parses and serializes pre-upgrade backup manifests strictly` (round trip and eight rejections); mutation re-run below.
- **S9.** Manifest test renamed to `serializes the exact initial manifest and rejects invalid version-1 shapes` (assertions unchanged).
- **S10.** Correction to Group 2: `pnpm check` was run before the B1 commit and exited 0 (2317 tests); "see commit gate run below" referred to that run.
- **Deviation 9 note.** The CodeScene waiver for `project-storage-node-adapters.ts` at 8.41 is recorded in `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` section 6 (follow-up split after C1).
- Gates before commit: upgrade 26 passed, verification 1, directories 1, registration-storage-upgrades 9, storage unit 243; `pnpm check` exit 0; jscpd 0 clones; knip clean; CodeScene safeguard passed (node-adapters `stable`, 1149 → 1148 lines); touched files 10.

## Round 1 final verification (at 385abb9; the next commit adds evidence and the design stamp only)

- `pnpm test:mutation:project-storage:harness` → exit 0, **86.99** (break 80, unchanged); `project-storage-manifest.ts` 72.22 → 88.89 (no uncovered mutants left), `generated-migrations.ts` 92.31, eligibility 85.86.
- `pnpm test:integration` (root) → exit 0; 54 files passed, 1 skipped; 1955 tests passed, 4 skipped; 405 s.
- `pnpm check` exit 0; `pnpm check:duplicates` 0 clones; knip clean; `pnpm db:generate:check` no schema changes; CodeScene safeguard passed (touched files 10; node-adapters waived at 8.41).
- Design `TDD Evidence (implement)` section added; `validate-artifact --finalizing --stamp` → content hash `ed78b8c649415c006fbf1e7516be26e62eafcb6add04d599ae67d85699c1aa6d` (prior `12dfee1e…`, normative sections unchanged).

## Review round 2 fixes (findings `s1-review-round-2.md` on 40b3a2a; user decision: no third round)

- **R1 (busy outside verification).** New test `keeps unavailable and broken outcomes for upgrade: a busy source while copying` (exclusive lock on S's `slopstop.db` at `after-upgrade-declared`, so the backup `VACUUM INTO` meets `SQLITE_BUSY`). Red: `upgrade` rejected with `LibsqlError: SQLITE_BUSY: database is locked` (rethrown since F5). Fix: one busy predicate, `isBusyStorageError` in `project-storage-node-errors.ts` (unavailable-class codes, `ProjectStorageUnavailableError`, or either as a `cause`), used by the verification module and by `stepFailureOutcome`, which now maps a raw busy error from any step to `unavailable` with `projectStorageUpgradeBusyMessage`; every other unknown error is still rethrown (the F5 test stays green). Green: exact busy outcome, no staging output, leftover-state oracle.
- **R2 (backup without identity/metadata table).** New backup fault "a backup without its identity table" (`DROP TABLE storage_identity` on the backup at `after-backup-copied`). Red: `upgrade` rejected with `LibsqlError: SQLITE_ERROR: no such table: storage_identity`. Fix: a non-busy failure reading identity or head from the backup is a mismatch → exact `failed PROJECT_UPGRADE_BACKUP_INVALID` (busy still busy; source-side reads unchanged). Green with the leftover-state oracle.
- **Small.** Busy conversions now carry `{ cause }`; broken-source cases also assert the leftover state (passes on arrival); backup-manifest rejections assert `SchemaError`; the S4 case pins `{ status: "broken", message: "Active create request authority is inconsistent." }`.
- **S1 deviation 11 (addition to the consolidated list).** UPG-B15(d)'s fixture differs from the design's "intact copy of another Project's canonical database": it changes the backup's `storage_id` and `canonical_database_lineage_id` in place at S's head and keeps `project_id`, because `storage_identity.project_id` references `project_state` and a changed `project_id` is caught by `foreign_key_check` instead of the identity comparison (see Review round 1, F1).
- Gates before commit: upgrade + verification files 29 passed; registration-storage-upgrades 9; node-errors + manifest unit 23; `pnpm check` exit 0; jscpd 0 clones; knip clean; CodeScene safeguard passed with no findings; touched files 10.

## Round 2 final verification (at ae98ccc; the next commit adds evidence only)

- `pnpm test:mutation:project-storage:harness` → **86.99** (break 80, unchanged), 2692 mutants, 13 min 59 s.
- `pnpm test:integration` (root) → exit 0; 54 files passed, 1 skipped; 1957 tests passed, 4 skipped; 473 s.
- `pnpm check` exit 0; `pnpm check:duplicates` 0 clones; knip clean; `pnpm db:generate:check` no schema changes; CodeScene safeguard passed, touched files 10 (node-adapters waived, unchanged in this round).
