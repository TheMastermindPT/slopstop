# C1-0 S2 TDD Evidence (append-only)

- Slice: `c1-0-s2-upgrade-failure-and-recovery`; lane `normal` (design `Lane:` line).
- Contract: `.rpiv/artifacts/designs/2026-10-06_02-02-21_upgrade-failure-and-recovery.md`, `content_hash` `e33924cffd1a1830d140030cb9df2d6f4f572cb5fe81f1820298f6d52cc252e5` (validator OK at start).
- Build authorization: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` section 7 (commit `a2af495`).
- Workspace: branch `feat/c1-0-s2-upgrade-recovery` from `main` `a2af495`, in the main working tree as the user chose through the coordinator (the normal lane's default is a linked worktree; recorded as the user's workspace choice). Integration target `main`. Unrelated untracked `.playwright-mcp/` left untouched.
- Commit policy (shared Lanes rule): one slice commit once green; intermediate red/green states are logged here with the parent commit and a digest of the complete working-tree patch.

## CodeScene baseline (before the first edit, at a2af495)

`project-storage-upgrade-pipeline.ts` 10; `project-storage-upgrade-node-adapter.ts` 10; `project-storage-upgrade.ts` not scorable (types only); `project-storage-store.ts` 10; `project-storage-file-adapter.ts` 10; `project-storage-filesystem-authority.ts` 10; `project-storage-node-adapters.ts` 8.41 (waived); `project-storage-store.test.ts` 10; `project-storage-upgrade.integration.test.ts` 10; `project-storage-runtime-fixture.ts` 10; `project-storage-upgrade-faults.ts` 10; `registration-storage-upgrades.integration.test.ts` 10; `project-storage-upgrade-directories.integration.test.ts` 10; `project-storage-lifecycle.integration.test.ts` 10; `project-storage-create.integration.test.ts` 10.

## Patch digest method

`git diff HEAD --binary` followed by every untracked file (sorted, `.playwright-mcp/` excluded) as `UNTRACKED <path>` plus its contents, hashed with SHA-256 (first 16 hex). Parent commit for every S2 state until the slice commit: `a2af495`.

## UPG-B21 (adapter) `removes only proven upgrade output: adapter` / `: adapter, held handle`

- Test: `apps/harness/tests/integration/project-storage-upgrade-directories.integration.test.ts` through `createProjectStorageFileAdapter`. (Split into two tests sharing the design's name prefix; the held-handle case is its own test.)
- Scaffold: `files.removeUpgradeOutput` as the design's recursive-remove stub (`rm -r --force` of both names).
- Red (repository root, `pnpm exec vitest run --config vitest.integration.config.ts apps/harness/tests/integration/project-storage-upgrade-directories.integration.test.ts`): 2 failed | 1 passed. Every refusal "promise resolved 'undefined' instead of rejecting" and its tree shrank (active target, junction at `.staging-T` and at `<T>`, plain file at `<T>`, missing Project root, Project-root junction); the held handle rejected with raw `EBUSY: resource busy or locked`, not `ProjectStorageUnavailableError`. Matches Expected red. The red state's patch digest was not captured (the digest helper was written after this red); its output is the logged run.
- Implementation: `removeUpgradeOutput` validates first (target ≠ active, target a generation id, Project root a plain directory under `<applicationStorageRoot>/projects/<ProjectId>/`, each present output name a plain directory), then removes `.staging-T/` and `<T>/`; refusals `ProjectStorageBrokenError("Project Storage upgrade output is invalid.")`; busy-class errors → `ProjectStorageUnavailableError(projectStorageUpgradeBusyMessage, { cause })`.
- Green: same command → 3 passed. State digest `ec0636ab0c5ac52a` (parent `a2af495`).
- Files touched: `apps/harness/src/storage/project-storage-file-adapter.ts`, `project-storage-store.ts` (`UpgradeOutput`, `files.removeUpgradeOutput`), `project-storage-store.test.ts` (typed fake), `tests/integration/project-storage-upgrade-directories.integration.test.ts`.

## UPG-B23 `settles on owner stop and recovers at the next opening`

- Test: `apps/harness/tests/integration/project-storage-upgrade.integration.test.ts`; helpers in new `tests/integration/project-storage-upgrade-recovery-fixture.ts` (`expectDiscardedUpgrade`, `expectMigrationRequiredOnSource`, `abandonedEvent`, `entriesOf`, `sourceFileHashes`, `registryRows`).
- Scaffold (interface only, no discard): `createUpgradeStorageOwner` gains `attempt` (attempt 1 T `…024`/U `…0a1`, attempt 2 T2 `…034`/U2 `…0a2`; `failAt`/`onCheckpoint` apply to attempt 1 only) and recorded `diagnostics`; `NodeProjectStorageOptions.upgradeDiagnostics` and the `abandoned`/`discardFailed` port members with no-op defaults.
- Red (`-t "settles on owner stop"`, root, digest `fd29dac603df0fcc`): 1 failed — the stop part passed (`unavailable` "Project Storage owner is stopped.", the stored `stop()` resolved, no diagnostics, marker `in-progress`, T `staging`, `.staging-T/` present); the new owner's activation answered safe-mode `recovery-required` on both databases instead of canonical `migration-required`. Matches Expected red.
- Implementation: new `project-storage-upgrade-recovery.ts` (`discardUnfinishedUpgrade`, Effect program with tagged `DiscardProofFailed`/`DiscardRemovalFailed`/`DiscardReleaseFailed`; busy → `ProjectStorageUnavailableError(busy)`, other → broken, `ProjectStorageApplicationClientInitializationError` rethrown; diagnostics `abandoned` / `discardFailed`); adapter steps `findUnfinished` (an unreadable registry answers none, left to opening), `proveUnfinished` (registration on S, S equal to the marker copy, T staging at the marker's location, then `upgradeOutputIsProven` in `project-storage-filesystem-authority.ts`), `releaseUnfinished` (guarded delete of T's row and the marker in one transaction); `existingApplicationClient` in the adapter context; `acquireActivation` and `upgrade` (new first pipeline step, tag `UpgradeRecoveryFailed`) discard before inspecting.
- Green: same command → 1 passed. State digest `192f85b3c163c0a4`.
- Expected collateral: 14 S1 tests now fail — every staged-copy (9) and backup (5) fault case, whose S1 oracle expects `recovery-required` and a second-call `refused NOT_ELIGIBLE` after a failure. These are the oracles E2 reopens; UPG-B18 rewrites them. `registration-storage-upgrades` still 9/9.
- Files touched: `apps/harness/src/storage/project-storage-upgrade-recovery.ts` (new), `project-storage-upgrade.ts`, `project-storage-upgrade-node-adapter.ts`, `project-storage-upgrade-pipeline.ts`, `project-storage-store.ts`, `project-storage-store.test.ts`, `project-storage-filesystem-authority.ts`, `project-storage-node-adapters.ts` (option pass-through and `existingApplicationClient` only), `tests/integration/project-storage-runtime-fixture.ts`, `project-storage-upgrade-recovery-fixture.ts` (new), `project-storage-upgrade.integration.test.ts`.

## UPG-B18 `discards a failed upgrade before answering and upgrades on retry`

- Test file: new `apps/harness/tests/integration/project-storage-upgrade-failure.integration.test.ts` (deviation: the design names `project-storage-upgrade.integration.test.ts`; the rows went to a new file to keep that file under the size CodeScene penalizes). One test per row, named `<design name>: <row>`: (a) 8 injected checkpoints, (b) failure during the switch, (d) 6 backup faults, (e) 10 staged-copy faults, (f) busy source while copying and busy backup, (c) source changed before the switch, (g) 2 broken sources, (h) busy staged copy — 29 tests.
- Reopened S1 oracles (E2) removed from `project-storage-upgrade.integration.test.ts` and replaced by these rows: the staged-copy and backup fault `it.for` tests, the busy backup / busy staged copy / busy source / broken source tests, `expectFailedUpgradeState`, `expectRecoveryRequiredOnSource`, `upgradeUnderLock`, and the switch and source-changed parts of `rolls back declare and switch transactions on failure` (now `…: declaration`, its declaration part unchanged). The removed text is kept in the session scratchpad for the reviewer (`removed-s1-failure-tests.txt`). `createFailedUpgradeProject` (registration) now seeds the in-progress state through an owner stop (`stopDuringUpgrade`, moved to the recovery fixture).
- Red (root, `pnpm exec vitest run --config vitest.integration.config.ts apps/harness/tests/integration/project-storage-upgrade-failure.integration.test.ts`, digest `2cc89e1fcf7e23f3`): 29 failed. Every discarding row: "expected [] to deeply equal [ { kind: 'abandoned', … } ]" (no discard ran, no `abandoned(reason: "failed")`); rows (c) and (h): "expected [] to deeply equal [ { kind: 'discardFailed', … } ]". Matches Expected red. Row (h)'s post-release activation (a guard per the design) was not reached in red because the diagnostics assertion fails first.
- Implementation: `project-storage-upgrade-pipeline.ts` runs every step from `after-upgrade-declared` to the committed switch in `runDeclaredUpgrade`; any failure or `failed` result there runs `discardUnfinishedUpgrade(projectId, "failed")` before answering, unless the owner is stopping; the original outcome is always the answer; `after-upgrade-switch` runs only after a committed switch.
- Green: same command → 29 passed. `project-storage-upgrade.integration.test.ts` 10 passed; directories, verification, open 59 passed with it; `registration-storage-upgrades` 9 passed (after the `createFailedUpgradeProject` change; before it, the two in-progress relationship seeds failed with 'current', as E2 anticipated). Storage unit 243 passed.
- Row (g) observed as designed: canonical `corrupt` / `DATABASE_CORRUPT`, runtime `healthy`, identity S.

## Unreadable registry before a marker is known (coordinator request)

- `findUnfinished` answers none for any registry it cannot read before a marker is known, so opening classifies it with its own diagnostic. Proof that this does not swallow broken: new `project-storage-upgrade-recovery.integration.test.ts` `keeps a registry whose upgrade marker cannot be read broken at opening` (a current Project whose `storage_upgrades` is replaced by a table with another column, so the marker read fails non-busy): `acquireActivation` and `upgrade` both answer `broken`, no diagnostics. Green on arrival (guard). Recorded as an S2 deviation: the design names only "a busy registry read before any marker" as left to opening; S2 leaves every unreadable registry before a marker to opening, and this test pins that broken stays broken.
- State digest after B18 and this guard: `491ff36872e6b372` (parent `a2af495`).
- Files touched in this group: `apps/harness/src/storage/project-storage-upgrade-pipeline.ts`; `tests/integration/project-storage-upgrade-failure.integration.test.ts` (new), `project-storage-upgrade.integration.test.ts`, `project-storage-upgrade-recovery-fixture.ts`, `registration-storage-upgrades.integration.test.ts`, `project-storage-upgrade-recovery.integration.test.ts` (new); evidence file.

## UPG-B19 `keeps a committed switch when a later step fails`

- Test: `project-storage-upgrade-failure.integration.test.ts`. Green on arrival (guard, as designed): `failAt: after-upgrade-switch` rejects with the injected error; registration on T, marker `completed`, activation read-write on T, no diagnostics.

## UPG-B20 `discards an upgrade interrupted by a process kill`

- Test: new `apps/harness/tests/integration/registration-storage-upgrade-kill.integration.test.ts` (registration project, low parallelism, unchanged 15 s timeout) with peer `project-storage-upgrade-peer.mjs` (own dependency construction with the fixture's attempt-1 ids, `--experimental-transform-types`, IPC checkpoint message, `child.kill()` of its own child). One test per kill point: (a) `after-backup-copied`, (b) `after-generation-rename`, (c) `during-upgrade-switch` (inside the switch transaction), (d) as (b) recovered by `upgrade` first.
- Command (`apps/harness`): `pnpm exec vitest run --config vitest.registration.config.ts tests/integration/registration-storage-upgrade-kill.integration.test.ts` → 4 passed on the first and only run (no retry). Durations: (a) test 4159 ms (peer to checkpoint 2365 ms, recovery 506 ms); (b) 2732 ms (1509 / 479); (c) 2405 ms (1333 / 446); (d) 2256 ms (1288 / 369).
- Observed red differs from the design: (a)–(c) are guards (as predicted); **(d) was also green on arrival**, not `refused NOT_ELIGIBLE`, because the `upgrade`-entry discard was already introduced with UPG-B23 (the design orders B23 first and lists the entry discard under E1). Recorded, not forced.
- State digest: `59c517931808658b` (parent `a2af495`).
- Files touched in this group: `tests/integration/project-storage-upgrade-failure.integration.test.ts` (B19), `tests/integration/registration-storage-upgrade-kill.integration.test.ts` (new), `tests/integration/project-storage-upgrade-peer.mjs` (new); evidence.

## UPG-B6 `keeps unproven upgrade leftovers quarantined`

- Test: `project-storage-upgrade-recovery.integration.test.ts`, one test per case from the stopped state of UPG-B23: (a) `note.txt` inside `.staging-T/`, (b) an extra UUID directory, (c) a second `storage_locations` row with T's row pointed at it, (d) `.staging-T` replaced by a junction. Each asserts the snapshot (every path with digest, never following links, plus every registry row) is equal after `acquireActivation` and after `upgrade`, two `discardFailed(unproven)` events, no `abandoned`, and for (d) the junction target unchanged.
- Observed: **green on arrival for all four** (differs from the predicted red for (a)–(c)), because the proof before deletion (`proveUnfinished` + `upgradeOutputIsProven`) was built with UPG-B23, ahead of this behaviour. Recorded as a deviation (proof implemented one behaviour early).
- Red shown by probe (as for S1 F1): with `proveUnfinished` forced to `"proven"` (`s2-b6-probe`), (a)–(c) failed as the design predicts — activation answered `migration-required`, the output and marker were deleted (snapshot shrank), and `upgrade` answered `upgraded`; (d) also failed under the probe, but on the message only: `broken` "Project Storage upgrade output is invalid." from the adapter's own junction refusal instead of opening's "Project Storage witness must not be a symbolic link." (nothing deleted). Probe reverted (adapter restored from a byte copy); same file → 5 passed.
- State digest: `b20abf9321786fd3` (parent `a2af495`).
- Files touched in this group: `tests/integration/project-storage-upgrade-recovery.integration.test.ts`; evidence.

## UPG-B21 (owner) `removes only proven upgrade output: owner, …`

- Integration (`project-storage-upgrade-recovery.integration.test.ts` `…: owner, held handle`): from UPG-B23's stopped state, a `DatabaseSync` handle on `.staging-T/slopstop.db` → `acquireActivation` answers `unavailable` "Project Storage is busy; the upgrade can be retried.", `discardFailed(busy)`, marker kept; after release → discarded state with `abandoned(interrupted)`. **Green on arrival** (the busy mapping came with B21 adapter and B23), not the predicted red; recorded.
- Unit (`src/storage/project-storage-store.test.ts`, typed fakes): `…: owner, broken discard` — with an in-progress marker and `removeUpgradeOutput` throwing `ProjectStorageBrokenError("Project Storage upgrade output is invalid.")`, `acquireActivation` and `upgrade` answer that `broken`; a pipeline failure at `after-staged-copy` rejects with the injected error and reports `discardFailed(broken)`. **Green on arrival**, recorded. `…: owner, client initialization failure` — **red** (`apps/harness`, `pnpm exec vitest run src/storage/project-storage-store.test.ts -t "owner,"`): `acquireActivation` "promise resolved `{ status: 'broken', message: 'Project Storage application client initialization failed.' }` instead of rejecting". Fix: `activationFailure` rethrows `ProjectStorageApplicationClientInitializationError` before the broken mapping, and the adapter's `findUnfinished` rethrows it instead of answering none. Green: storage unit 245 passed.

## UPG-B22 `upgrades once when two calls race`

- `project-storage-upgrade-failure.integration.test.ts`: two `upgrade` calls on one owner (the second through the raw owner, which reads no clock or id when not required) → `upgraded` and `not-required`, one completed marker, no diagnostics. Green on arrival (guard, as designed).

## ADR 0005 (TDD-exempt, documentation)

- `docs/adr/0005-storage-lifecycle-and-recovery.md` S1 amendment, the failure bullet and the retention bullet replaced as the design's "ADR 0005 amendment (in this slice)" states (discard after failure unless stopping, discard at next opening or upgrade, proof conditions, unproven quarantined, backups kept, single-instance lock precondition; only the unfinished upgrade's output and marker/target rows are discarded automatically).

## Refactor and gates before the slice commit

- jscpd first found 3 clones in the new tests (retry check, read-write activation check, `createCurrentProject`) → moved into `project-storage-upgrade-recovery-fixture.ts` (`expectReadWriteOn`, `expectRetryUpgrades`, `createCurrentProject`); knip flagged `expectNoCorruptRegistry` (now unused, removed) and two exported types (un-exported). Then: `pnpm check` exit 0 (2320 unit tests); jscpd 0 clones; knip clean; CodeScene safeguard passed; scores 10 for every touched and new file (`project-storage-upgrade-recovery.ts`, node adapter, pipeline, file adapter, filesystem authority, store, store test, failure/recovery/kill/directories/upgrade tests, recovery fixture, runtime fixture); `project-storage-node-adapters.ts` 8.41 (waived, unchanged; lines 1148 → 1150 for the option pass-through and `existingApplicationClient`).
- State digest at the gates: `c6e14ed360ca4c86` (parent `a2af495`).

## Final verification (before the slice commit)

- `pnpm test:integration` (root; harness and registration projects, kill test included) → exit 0; 57 files passed, 1 skipped; 1982 tests passed, 4 skipped; 579 s. No kill-test flake.
- `pnpm test:mutation:project-storage:harness` → **86.99** (break 80, unchanged), 15 min 1 s.
- `pnpm db:generate:check` (`apps/harness`) → no schema changes.
- `pnpm check` exit 0; jscpd 0 clones; knip clean; CodeScene as recorded above.

## S2 deviations from the design (consolidated)

1. Workspace: the main working tree on the feature branch (user choice through the coordinator), not the normal lane's linked worktree.
2. UPG-B21 adapter red-state digest not captured (helper written after that red).
3. B18 rows live in new `project-storage-upgrade-failure.integration.test.ts` (and B19, B22 there too), not in `project-storage-upgrade.integration.test.ts`; the E2-reopened S1 tests were removed from the latter (text kept for review).
4. `findUnfinished` answers none for any registry it cannot read before a marker is known (the design names busy only); a guard test pins that broken still answers broken; `ProjectStorageApplicationClientInitializationError` is rethrown.
5. Reds that differed (recorded, not forced): B20(d) green on arrival (entry discard came with B23); B6 green on arrival (proof built with B23), red shown by probe, with (d) under the probe failing on the adapter's message; B21 owner integration and broken unit cases green on arrival, only the initialization case red.
6. Tests split one case per test with `<design name>: <case>` names (B18, B20, B6, B21) to keep the unchanged 15 s timeout.
7. Shared test helpers consolidated into `project-storage-upgrade-recovery-fixture.ts` (jscpd).

## Review round 1 of 2 (candidate `4293b2c`): fixes

The findings come from the coordinator's code and coverage reviewers and from the slice-verifier. Each behaviour change was shown red before its fix. Logs are in the session scratchpad as `ev/s2r1-*.txt`. A probe is a temporary source edit; each one was restored to the saved fixed copy, byte for byte, and checked with `git diff --no-index`.

### D1: case-variant output names (data safety)

- Red first: `keeps unproven upgrade leftovers quarantined: 'a case-variant staging prefix'` in the recovery suite. The proof skipped a `.Staging-<T>/` directory. Removal then reached it through the case-insensitive `lstat` and deleted it. Log `s2r1-d-red.txt`: 2 failed (with D2) | 1 passed.
- The reported upper-case `<T>` name did not reproduce. `StorageGenerationIdSchema` accepts upper case, so the proof already answered unproven for it. It stays as a guard case that was green on arrival.
- Fix in the proof: `upgradeOutputIsProven` lower-cases each entry name before the generation-shape test. A shaped name that does not match exactly answers unproven.
- Fix in removal: `removeUpgradeOutput` refuses any present output whose exact spelling is not in `readdir(projectRoot)`.
- Adapter red: the new directories cases (`case-variant staging name`, `retained target`) ran against the `4293b2c` file adapter. Result: 1 failed | 2 passed (`s2r1-d-adapter-probe.txt`). They pass with the fix.
- Red-state digests for the D pair: `047c57e261dc7ac2`, `6b3be05b7f2b4efa`.

### D2: target equal to a retained generation (data safety)

- Red first: `keeps unproven upgrade leftovers quarantined: a target equal to the retained generation`. The test corrupts the registry: an in-progress marker and staging row reuse the completed upgrade's source id. Before the fix, the retained prior generation was deleted (`s2r1-d-red.txt`).
- Fix in the proof: `proveUnfinished` answers `UnfinishedProof`, either `{ status: "proven", retainedGenerationIds }` or `{ status: "unproven" }`. A retained target is unproven.
- Fix in removal: `UpgradeOutput` carries `retainedGenerationIds`, and the adapter refuses a retained target.
- Green: recovery plus directories, 12 passed (`s2r1-d-green.txt`).

### C1: B18 backup oracle (blocker)

- The oracle now captures the `snapshots/U/` entries at each row's failing checkpoint, after that row's fault (`capturingBackup` and a per-row `failingAt`). It also asserts that the checkpoint was reached.
- For a busy source, the copy fails after its last checkpoint, so the oracle asserts that the backup exists.
- Probe: the file adapter's removal also deletes `snapshots/` (probe digest `38125148f60b63e7`).
  - New oracle: 25 failed | 6 passed. All 23 discarded rows and both busy rows are red (`ENOENT scandir snapshots/U`, or backup undefined). Log `s2r1-c1-red-new.txt`.
  - The `4293b2c` oracle under the same probe: 2 failed | 29 passed. Only `a busy backup` and `a busy staged copy` failed (`s2r1-c1-probe-old.txt`). This confirms the old oracle was tautological.
- Green: 31/31 (`s2r1-c1-green.txt`).

### C2: `findUnfinished` too wide, and the failure-time registry read

- Adapter, in the new `project-storage-upgrade-steps.integration.test.ts`: `finds an unfinished upgrade only from a readable marker: a marker that does not decode / two in-progress markers`.
  - Both now reject with `ProjectStorageBrokenError("Project Storage upgrade marker is invalid.")`. Only the table check and the SELECT may still degrade to none.
  - Red, with only `findUnfinished` reverted to `4293b2c` (diff digest `3e367d0b4995c10d`): 2 failed, "promise resolved undefined instead of rejecting" (`s2r1-c2a-red.txt`).
  - Green: 13/13 together with the recovery suite (`s2r1-c2a-green.txt`).
  - Observation: dropping the unique indexes makes client acquisition fail schema verification, which degrades and leaves the opening to classify it. So the two-marker case uses a second `storage_id` and keeps the indexes.
- Failure time, unit test in `project-storage-store.test.ts`: `reports a discard after a failed upgrade: owner, unreadable registry`.
  - The pipeline now discards the declared marker it already knows (`discardKnownUpgrade`) and no longer calls `findUnfinished` at that point. A registry read failure inside the proof is therefore reported as `discardFailed(broken|busy)`.
  - Red against the `4293b2c` pipeline and recovery: `expected [] to deeply equal [discardFailed broken]`.

### C3: client initialization failure in the failure-time discard

- Unit test: `reports a discard after a failed upgrade: owner, client initialization failure`.
- Red: `expected []`. The error was rethrown before the report, then swallowed.
- Fix: every step failure is reported before it is thrown. A client initialization failure is rethrown unchanged after its report. The original outcome stays the answer.
- Reds for C2 (failure time), C3 and the isolation item together: 3 failed | 32 passed (`s2r1-c23-red.txt`; final test form in `s2r1-c23-red-final.txt`). Green: 35/35 (`s2r1-c23-green.txt`).

### C4: release guard

- Adapter test: `releases an unfinished upgrade only while the registry agrees`. With the registration moved off S, the release rejects with `ProjectStorageBrokenError("Project Storage upgrade release does not agree.")`. The marker and the T `staging` row are unchanged.
- This is existing behaviour, so a probe shows the red. The probe (digest `13fa7b7122495872`) makes the guard `if (false)` and also removes the `findUnfinished` initialization rethrow, which the cheap adapter item covers.
- Result under the probe: 2 failed | 2 passed (`s2r1-c4-probe.txt`). After restoring: 4/4.

### C5: S1 checks for row (g)

- Both `a broken source …` rows now also assert that the backup is released and that `restartApplicationAuthority` answers `current`. The canonical `corrupt` oracle is kept.
- Green (`s2r1-c5-green.txt`).

### C6: upgrade-entry discard

- Probe: the pipeline's entry discard is replaced by `"none"` (digest `327035ee2fc31969`). The kill file gives 1 failed | 3 passed (`s2r1-c6-probe.txt`).
- B20(d), `after the generation is renamed, recovered by upgrade`, answered `refused` with `PROJECT_UPGRADE_NOT_ELIGIBLE` instead of `upgraded`. The code was read through a temporary console probe in `expectRetryUpgrades`, which was also restored.
- Restored byte-identical.

### C7: evidence identity

- The final runs below were made on the working tree that becomes the round-1 commit. The coordinator report binds that tree through the commit's patch digest.
- Residual risk: the B21 owner red/green and the B6 probe (deviation 2) have no red-state digests, and they cannot be captured afterwards.
- B18 counts corrected: 23 discarded rows (8 injected checkpoints, 1 switch failure, 5 backup faults, 9 staged-copy faults) and 2 busy rows.

### C8: mutation scope

- `project-storage-upgrade-recovery.ts` was added to `mutate` in `stryker.project-storage.config.json`.
- `project-storage-store.test.ts` was added to `vitest.project-storage-mutation.config.ts`.
- Thresholds are unchanged: high 90, low 80, break 80.

### Cheap items

- Diagnostics port isolation: `reportSafely` wraps each report. The unit test `keeps the discard outcome when its diagnostics port throws: owner` was red before the fix (`Error: Diagnostics sink failed.`).
- The deviation-4 guard test now pins `{ status: "broken", message: "Database required column definition is missing." }` on both calls. The message was taken from a placeholder run.
- Row (c) now also asserts that the T `staging` row is kept, the registration stays on S, `<T>/` is kept, and the identity at opening is S.
- Adapter: when client initialization throws, `findUnfinished` rejects with `ProjectStorageApplicationClientInitializationError`. The C4 probe shows this red.
- Stale stacked TSDoc lines removed (`sourceMatchesMarker`; `registration-storage-upgrades.integration.test.ts`).
- The ADR 0005 proof sentence now covers no retained target, any letter case, completed sources, and exact spelling.
- Design note, append-only (the design body is not rewritten): the verification command at design line 151 does not list `project-storage-upgrade-failure.integration.test.ts`. That file is one of the slice's suites (deviation 3), and the new `project-storage-upgrade-steps.integration.test.ts` joins them.
- CodeScene flagged a Large Method in `removes only proven upgrade output: adapter` (9.55). It was split into a second test, `… adapter, retained or case-variant target`, and the score is back to 10.

### Round-1 final verification (working tree of the round-1 fix commit)

- `pnpm check` (root) exit 0; 2323 unit tests passed.
- `pnpm test:integration` (root; harness and registration projects, kill test included) exit 0; 58 files passed, 1 skipped; 1990 tests passed, 4 skipped; 388 s. No kill-test flake.
- `pnpm test:mutation:project-storage:harness` **84.97** (break 80, unchanged; was 86.99 before the recovery module joined the scope); 11 min 5 s. Recovery module alone: 31 killed, 17 survived, 9 no coverage, 3 ignored (its integration-only paths are not in the mutation run).
- `pnpm check:duplicates` 0 clones; knip clean; format and lint clean; `pnpm db:generate:check` no schema changes.
- CodeScene: 10 for every touched file (recovery, node adapter, pipeline, file adapter, filesystem authority, store, store test, failure/recovery/steps/directories/registration-upgrades tests, recovery fixture); `project-storage-upgrade.ts` not scorable (types only, as at baseline); `project-storage-node-adapters.ts` 8.41, not touched in round 1.

## Review round 2 (final, candidate `0ac994e`): test fixes

User decision, relayed by the coordinator: fix the tests now. There is no third review round; the coordinator verifies, then squash merges. Logs are in the session scratchpad as `ev/s2r2-*.txt`. Probes were restored afterwards and checked with `cmp` or `git diff --quiet HEAD`.

### Correction to the round-1 D1 entry

- The round-1 D1 entry says that `StorageGenerationIdSchema` accepts upper case. That is wrong: the schema is `LowercaseDomainIdentityTextSchema` and requires lower case.
- The round-1 upper-case case only passed for another reason. Its target `…000000000024` has no letters, so `toUpperCase()` produced the exact `<T>/`, and the case was unproven only because of the extra `note.txt`.
- That entry stays as history and is superseded by T1 below.

### T1: letter-case variants with a lettered target

- Owner seam (`project-storage-upgrade-recovery.integration.test.ts`): the interrupted upgrade now uses target `00000000-0000-4000-8000-0000000000fa`, through a new `targetGenerationId` option of the runtime fixture, passed by `stopDuringUpgrade`. The staged copy is renamed to one of three variants:
  - `<T upper>`;
  - `.staging-<T upper>`;
  - `.Staging-<T>`.
- Each variant holds only generation files, so letter case is the only reason to refuse.
- Adapter seam (`project-storage-upgrade-directories.integration.test.ts`): `targetId` is now `…0000000000fa`, and the same three variants are refused one by one.
- Red, with `project-storage-file-adapter.ts` and `project-storage-filesystem-authority.ts` at `4293b2c` (probe digest `95f6389c715ede2e`): 4 failed, which is all 3 owner variants plus the adapter test.
  - Owner variants: the variant directory was deleted (`files` 11 entries instead of 14).
  - Adapter: each `case-variant name …` lost its entries (9 instead of 13), and `promise resolved "undefined" instead of rejecting`. The retained-target case in the same adapter test is also red under that probe.
  - Log: `s2r2-t1-red.txt`.
- Green: 14/14 (`s2r2-t1-green.txt`).

### T2: busy staged-copy backup oracle

- The test now captures the backup with `capturingBackup` at `after-staged-migration`, asserts that it is defined, and passes it to `expectDiscardedUpgrade`.
- Probe: the file adapter deletes `snapshots/` before it removes any output (digest `b578a54a866352c9`).
  - New oracle: red, `ENOENT scandir …/snapshots/U` (`s2r2-t2-red.txt`).
  - The `0ac994e` oracle under the same probe: green (`s2r2-t2-probe-old.txt`). This confirms the old oracle was tautological.
- Green (`s2r2-t2-green.txt`).

### Small items

- **Registry proof:** the agreement query now also requires `u.target_generation_id = ? AND u.source_generation_id = ?` for the passed marker.
  - New adapter test: `proves an unfinished upgrade only for its own marker`. The staged copy is renamed to the passed (other) target, so the filesystem agrees and only the registry can refuse it.
  - Red against the `0ac994e` query: `expected { status: 'proven', … } to deeply equal { status: 'unproven' }` (`s2r2-proof-red.txt`).
  - The passed-source case is green either way, because the filesystem proof already refuses it.
  - Green: 5/5 (`s2r2-proof-green.txt`).
- **`findUnfinished` TSDoc:** now documents the `ProjectStorageBrokenError("Project Storage upgrade marker is invalid.")` rejection.
- **Dead counter:** the `reads > 1` counter in `reports a discard after a failed upgrade: owner, unreadable registry` is replaced by `vi.fn` with the assertion `findUnfinished` called exactly once (the entry read only).
- **Run binding:** the digest of the final runs is `git diff 0ac994e -- apps docs stryker.project-storage.config.json | sha256sum`, first 16 hex characters. It was taken after `git add -N apps`, so new files are included. The round-2 commit is checked against the same command, with `HEAD` in place of the working tree.

### Round-2 final verification (run digest `efd8a9ed63be02e6`)

- Touched suites (failure, recovery, directories, steps, upgrade): 60 passed.
- `pnpm check` (root): exit 0; 2323 unit tests passed.
- `pnpm test:integration` (root; harness and registration projects, kill test included): exit 0; 58 files passed, 1 skipped; 1992 tests passed, 4 skipped. No kill-test flake.
- `pnpm check:duplicates`: 0 clones. knip: clean. CodeScene pre-commit safeguard: passed, and every touched file scores 10.
- Mutation was not re-run. The only source changes are the agreement query in `project-storage-upgrade-node-adapter.ts`, which is outside the mutation scope, and a TSDoc comment.
