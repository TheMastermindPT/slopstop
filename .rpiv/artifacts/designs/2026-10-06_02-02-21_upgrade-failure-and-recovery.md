---
date: 2026-10-06T02:02:21+0100
author: Pedro Mesquita
commit: ad823a0
branch: main
repository: slopstop
topic: "C1-0 S2: upgrade failure cleanup and interrupted-upgrade recovery"
tags: [design, storage, migration, recovery, c1-0, s2, adr-0005]
status: ready
parent: .rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md
last_updated: 2026-10-07T20:12:32+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Follow-ups appended: C1-0 S5 deep-review fixes and review round 2 (U6)."
content_hash: eef852da83fe39d7a0412a4a3103d94ae284076db21e65d377476b5eaac5a5f1
---

# Design: C1-0 S2 — upgrade failure cleanup and interrupted-upgrade recovery

Lane: normal (`lane.mjs --paths`, 2026-10-06: files 9 > 5). Intent review was run anyway at the user's request; at most two rounds.

## Intent

S1 (`ad823a0`) upgrades an eligible Project, but every failure after the registry declaration leaves an in-progress marker, a staging row and staging output behind, and the Project stays `recovery-required`. S2 makes the Project come back on its own: a failed upgrade cleans up before it answers, an interrupted upgrade is cleaned up at the next opening, and in both cases the Project returns to read-only `migration-required`, so "Try again" (S3) simply runs a new upgrade. Nothing that is not proven to belong to the unfinished upgrade is ever deleted, and backups are never deleted.

Authoritative requirements: the parent design (`.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`, content hash `ed78b8c649415c006fbf1e7516be26e62eafcb6add04d599ae67d85699c1aa6d`), its Deferred Work entry "S2", and FRD (`.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md`, content hash `d45f5d9c6f63fdfd7cca2e00d6197299522aa2568bae31e3a1c0155165b21105`) FR7, FR8, FR9 and the interruption acceptance criterion. S1 as built: `.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-tdd-evidence.md` (11 deviations; observed reds).

Scope: the harness storage owner (`apps/harness`) and the ADR 0005 amendment text (`docs/adr/0005-storage-lifecycle-and-recovery.md:45-46`). Non-goals: protocol, coordinator, renderer, "Updating Project…", timing test and the single-instance lock (S3); the C1 gate; registry schema changes; deleting backups; new per-step failure codes.

Constraints: ADR 0005 (resume only from evidence; proven staging output may be discarded before activation; unknown partial output stays quarantined); `degrade-distinguishes-broken`; D12 busy stays distinct; conversation-decisions section 6 (CodeScene waiver for `project-storage-node-adapters.ts` at 8.41 — S2 adds only the wiring listed below there; squash merge); two review rounds per slice at most.

## Architecture

### Facts S2 builds on (verified at `ad823a0`)

- `runProjectStorageUpgrade` (`apps/harness/src/storage/project-storage-upgrade-pipeline.ts:373-386`) runs typed steps; `stepFailureOutcome` (:357-370) maps `ProjectStorageUnavailableError` and any busy-class error (`isBusyStorageError`, `project-storage-node-errors.ts:49-58`) to `unavailable`, `ProjectStorageBrokenError` to `broken`, and rethrows the rest. Only `declare` and `switchActive` normalize unknown errors to `broken`. Every `step` calls `lifecycle.assertRunning()` before and after its work (:90-104); a stopped owner surfaces as `ProjectStorageUnavailableError("Project Storage owner is stopped.")`.
- After a failure following declaration, S1 leaves: marker `in-progress`, T `staging`, `.staging-T/` and/or `<T>/`, `snapshots/U/`; activation `recovery-required`; a second `upgrade` refused `NOT_ELIGIBLE`. S1 tests pin this through `expectFailedUpgradeState` (definition `tests/integration/project-storage-upgrade.integration.test.ts:732`, six uses at :797, :837, :877, :896, :928, :944), the switch-rollback and source-changed cases (:1010-1056), and `createFailedUpgradeProject` in `tests/integration/registration-storage-upgrades.integration.test.ts:29-46` (used by the two in-progress relationship seeds at :86-95).
- `storage_upgrades` (`apps/harness/drizzle/application/0007_storage_upgrades.sql`) has no foreign keys, unique indexes on `source_generation_id` and `source_create_request_id`, and one `in-progress` row per storage.
- Opening's witness scan throws `ProjectStorageBrokenError` for an unknown file inside a generation directory (`project-storage-filesystem-authority.ts:137-138`); it does not report "unproven".
- The upgrade fixture (`tests/integration/project-storage-runtime-fixture.ts:270-338`, `createUpgradeStorageOwner`) returns constant T `…024` and U `…0a1` and a clock that answers only the two upgrade instants inside `upgrade`; it registers vitest hooks at module load, so a child process cannot import it.
- Kill-process precedent: `tests/integration/registration-owner-recovery-fixture.ts:43-98` with peer `registration-observer-peer.mjs` (own dependency construction, `--experimental-transform-types`, IPC checkpoint message, `child.kill()` of its own child), in the low-parallelism registration project.
- No single-instance lock exists under `apps/` (`requestSingleInstanceLock` absent).
- Storage code has no logger; Pino is at process entry (`apps/harness/src/process-entry.ts`).

### Ownership

New module `apps/harness/src/storage/project-storage-upgrade-recovery.ts` owns "discard an unfinished upgrade" (`discardUnfinishedUpgrade(projectId, reason)` → `none | discarded | unproven`, or throws `ProjectStorageUnavailableError` / `ProjectStorageBrokenError`). It is used in two places:

1. **After a failed upgrade** (pipeline, reason `failed`): any failure after a successful declaration and before the switch commits — `failed`, `unavailable`, `broken` or a rethrown error — runs the discard before the owner answers, **except** when the owner is stopping (lifecycle no longer running): then no discard runs and the state waits for the next opening. The original outcome is always the answer. If the discard does not complete (busy, broken or unproven), the diagnostics port receives `discardFailed` with that class and the remaining state is handled at the next opening.
2. **At opening** (reason `interrupted`): `acquireActivation` and `upgrade` (on entry), under the existing project lock and before `opening.inspect`. `none`/`discarded` → classification proceeds (now `migration-required` after a discard); `unproven` → classification proceeds unchanged (whatever opening answers today: `recovery-required`, or `broken` for an unknown witness); busy after an `in-progress` marker was read → the activation/upgrade answers `{ status: "unavailable", message: "Project Storage is busy; the upgrade can be retried." }` (a busy registry read before any marker is known is left to the opening's own classification, so Projects without an upgrade keep today's messages); broken → `{ status: "broken", message }` with the discard's message; `ProjectStorageApplicationClientInitializationError` is rethrown unchanged, as `stepFailureOutcome` and `operate()` do. With no `application.db` the discard answers `none` without opening a client, through a new `existingApplicationClient()` member of the upgrade adapter context (`project-storage-node-adapters.ts:1711`) that returns `undefined` when the file is absent (activation results for unregistered roots stay unchanged). Store `open()` is unchanged.

A failure after the switch commits (`after-upgrade-switch`) is not discarded.

### Discard (ordered, idempotent)

Input: the storage's `in-progress` `storage_upgrades` row (source S, target T, upgrade U).

1. **Prove** (read-only; a busy read → busy; any other read failure → broken): the registration's active generation is S; S's `storage_generations` row equals the marker's source columns (same comparison as the switch guard, `project-storage-upgrade-node-adapter.ts:465-470`); T's row is `staging` with S's location; every generation-shaped entry under the Project root other than S and completed sources is `.staging-T/` or `<T>/`; each of those is a plain directory (no link or junction) holding only known generation files. Any failed condition → `unproven`; nothing is deleted.
2. **Remove output**: `removeUpgradeOutput({ projectId, targetGenerationId, activeGenerationId })` (file adapter) deletes `.staging-T/` then `<T>/` when present. It accepts only those two names for that T under `<applicationStorageRoot>/projects/<ProjectId>/`, refuses `T === activeGenerationId`, refuses links/junctions and anything else with `ProjectStorageBrokenError("Project Storage upgrade output is invalid.")`, and converts busy-class errors to `ProjectStorageUnavailableError("Project Storage is busy; the upgrade can be retried.", { cause })`.
3. **Release registry**: one application-database transaction deletes T's `staging` row and the `in-progress` marker row, guarded (`state = 'in-progress'`, T `staging`, registration on S); a guard miss → `ProjectStorageBrokenError("Project Storage upgrade release does not agree.")`.
4. **Report**: `upgrades.abandoned({ projectId, upgradeId, reason })`.

Directories before registry rows, so a crash between steps repeats an idempotent discard. `snapshots/U/` is never touched.

### Diagnostics port

`ProjectStorageStoreDependencies.upgrades` gains `abandoned({ projectId, upgradeId, reason: "failed" | "interrupted" })` and `discardFailed({ projectId, upgradeId, cause: "busy" | "broken" | "unproven" })`. Defaults are no-ops. `NodeProjectStorageOptions` gains one optional field `upgradeDiagnostics?: Pick<ProjectStorageStoreDependencies["upgrades"], "abandoned" | "discardFailed">`, passed through in `project-storage-node-adapters.ts` (the only changes there are this pass-through and `existingApplicationClient()`; new SQL lives in `project-storage-upgrade-node-adapter.ts`). S3 wires them to Pino at the process boundary. Events carry ids and a class only.

### Implementation style

As S1: async functions over the promise-based worker wrapped in `Effect.tryPromise`, orchestration and typed errors in Effect.

### ADR 0005 amendment (in this slice)

`docs/adr/0005-storage-lifecycle-and-recovery.md:45` is replaced to say: a failed upgrade answers its S1 outcome after discarding its proven staging output and its marker and target row (unless the owner is stopping); an unfinished upgrade's proven output is discarded at the next opening or upgrade; unproven leftovers stay quarantined; the pre-upgrade backup of every attempt is kept; a second running instance is excluded by the single-instance lock required before S3 wires the upgrade. Line 46 (retention) is reworded: only the proven output of an unfinished upgrade (`.staging-<target>/`, `<target>/`) and its marker and target registry rows are discarded automatically; the source generation, the prior generation and every pre-upgrade backup, including those of abandoned attempts, are kept.

### Data flow

```text
upgrade(projectId)
  lock -> discard(interrupted) -> inspect -> plan -> declare
  -> backup -> stage -> migrate -> verify -> seal -> switch
  failure before switch commit, owner running -> discard(failed) -> original outcome
acquireActivation(projectId)
  lock -> discard(interrupted) -> inspect -> classify
crash or stop -> next acquireActivation/upgrade discards proven leftovers
```

## Decisions

- **E1 Recovery at opening** (user): `acquireActivation` and `upgrade` discard proven leftovers before classifying.
- **E2 A failed upgrade cleans up before answering** (user), except while the owner is stopping. Explicitly reopens these S1 oracles: `expectFailedUpgradeState` and its six uses; the second-call `refused NOT_ELIGIBLE`; the switch-rollback case (registry equals the before-switch state, `<T>/` present; `project-storage-upgrade.integration.test.ts:1010-1034`); the source-changed case (marker `in-progress`, :1036-1056); `createFailedUpgradeProject` (`registration-storage-upgrades.integration.test.ts:29-46`), which now seeds the in-progress state through an owner stop (UPG-B23).
- **E3 Abandoned attempts**: delete marker and T's row, keep `snapshots/U/`, report through the diagnostics port (user). No migration `0008`.
- **E4 No new per-step failure codes** (user). Supersedes the parent's D10 item.
- **E5 Proof before deletion** includes S's row equality with the marker copy, plain directories, and an adapter that itself refuses anything but T's two names.
- **E6 Effect style kept.**
- **E7 `UPG-B6` reframed**: unproven leftovers never open and are never deleted.
- **E8 ADR 0005 amended in S2** (user), so `main` never contradicts the code.
- **E9 Single instance** (user): S3 must add an Electron single-instance lock before wiring `upgrade`; until then no production caller of `upgrade` exists, so discard-at-opening cannot meet a live upgrade from another process.
- **E10 Discard classes**: busy → `unavailable`, other read/remove/release failures → `broken`, failed proof → `unproven`; each reported distinctly (`degrade-distinguishes-broken`).
- **E11 Synchronous-throw settlement** (parent D10 item) needs no separate behavior: every step and checkpoint runs inside an async `Effect.tryPromise` body (`project-storage-upgrade-pipeline.ts:90-104`), so a synchronous throw is the same rejection UPG-B18(a) proves; retired here, not deferred.

## Next Slice

- **slice_id**: `c1-0-s2-upgrade-failure-and-recovery`
- **Behaviors**: `UPG-B6`, `UPG-B18`–`UPG-B23`. Order: B21 (adapter), B23, B18, B19, B20, B6, B21 (owner), B22. B23 introduces discard at opening (E1); B18 introduces discard after failure (E2).
- **Deliverable**: a failed upgrade leaves the Project read-only `migration-required` with its prior state and backup; an interrupted upgrade (including a real process kill and an owner stop) is discarded at the next opening without user input; unproven leftovers stay quarantined; busy and broken discards stay distinct; ADR 0005 matches.
- **Affected source**: `apps/harness/src/storage/` — new `project-storage-upgrade-recovery.ts`; `project-storage-upgrade-pipeline.ts`; `project-storage-upgrade-node-adapter.ts`; `project-storage-upgrade.ts`; `project-storage-store.ts`; `project-storage-file-adapter.ts`; `project-storage-filesystem-authority.ts`; `project-storage-node-adapters.ts` (option pass-through only). `docs/adr/0005-storage-lifecycle-and-recovery.md:45-46`.
- **Affected tests** (`apps/harness/tests/integration/` unless stated): `src/storage/project-storage-store.test.ts` (UPG-B21 owner-level broken and client-initialization cases with typed fakes); `project-storage-runtime-fixture.ts` (`createUpgradeStorageOwner` gains `attempt` ids — T `…024`/U `…0a1` for attempt 1, T2 `…034`/U2 `…0a2` for attempt 2 — and a recording `upgradeDiagnostics`; the clock wrapper also covers `acquireActivation`, which reads no clock); `project-storage-upgrade.integration.test.ts` (reopened oracles per E2); `project-storage-upgrade-faults.ts`; `registration-storage-upgrades.integration.test.ts` (`createFailedUpgradeProject` via owner stop); new `project-storage-upgrade-recovery.integration.test.ts`; new `registration-storage-upgrade-kill.integration.test.ts` (registration project, low parallelism) with peer `project-storage-upgrade-peer.mjs` (own dependency construction, like `registration-observer-peer.mjs`); `project-storage-upgrade-directories.integration.test.ts`; typed fakes of `ProjectStorageStoreDependencies` (`src/storage/project-storage-store.test.ts`, `project-storage-lifecycle.integration.test.ts`, `project-storage-create.integration.test.ts`).
- **Dependencies**: `ad823a0`.

## Test Contracts

**Seam.** The raw owner from `createUpgradeStorageOwner(root, { attempt, failAt, onCheckpoint, diagnostics })`: `attempt` is a constructor option (default 1) that each `upgrade` call advances; attempt 1 allocates T `…024`/U `…0a1`, attempt 2 allocates T2 `…034`/U2 `…0a2`; `failAt` and `onCheckpoint` apply to attempt 1 only (FRD "one-time failure"); a test process resuming after a kill constructs its owner with `attempt: 2`. A fresh generation-two fixture per case; adapter cases through `createProjectStorageFileAdapter`. Windows host. "Held handle" always means a `node:sqlite` `DatabaseSync` connection opened on the file with no transaction (it blocks removal on Windows and does not make reads busy).

**Discarded state** (`expectDiscardedUpgrade`): no `storage_upgrades` row; no `storage_generations` row for T; registration on S, S `active`; S's files byte-identical; no `.staging-*` and no `<T>/`; `snapshots/U/` exactly as when the failure happened (absent if the backup never started); S and `snapshots/U/` released; `acquireActivation` → safe-mode, canonical `migration-required` / `DATABASE_MIGRATION_REQUIRED`, runtime `healthy`, `identity.generationId = S`; authority restart → `current`.

- **Behavior UPG-B18**: Every failure before the switch commits cleans up before answering, and "Try again" upgrades.
  - Test: `discards a failed upgrade before answering and upgrades on retry` → `project-storage-upgrade.integration.test.ts` (one case per row)
  - Oracle, per row, the S1 outcome then the discard: (a) `failAt` each of `after-upgrade-declared`, `after-backup-copied`, `after-backup-verified`, `after-staged-copy`, `after-staged-migration`, `after-staged-verified`, `after-generation-rename`, `before-upgrade-switch` → `upgrade` rejects with the injected error; (b) `failAt: during-upgrade-switch` → `{ status: "broken", message: "Project Storage upgrade switch failed." }`; (c) the source-changed hook at `before-upgrade-switch` → `{ status: "broken", message: "Project Storage upgrade source changed before the switch." }`; (d) every S1 backup fault → exact `failed PROJECT_UPGRADE_BACKUP_INVALID`; (e) every S1 staged-copy fault → exact `failed PROJECT_UPGRADE_VERIFICATION_FAILED`; (f) busy source while copying and busy backup (S1 `upgradeUnderLock`: the lock is released in `finally` after `upgrade` returns; the discard touches neither S nor `snapshots/U/`, so it completes while the lock is held) → `{ status: "unavailable", message: "Project Storage is busy; the upgrade can be retried." }`, the discarded state checked after the release. Rows (a), (b), (d), (e), (f) → the discarded state and exactly one `abandoned({ projectId, upgradeId: U, reason: "failed" })`; then `upgrade` → `upgraded` with T2/U2, `acquireActivation` → read-write on T2, `snapshots/U/` (if present) and `snapshots/U2/` remain. Row (c): S's row no longer equals the marker copy, so the discard is `unproven` → `discardFailed({ …, cause: "unproven" })`, no `abandoned`, marker `in-progress`, activation safe-mode `recovery-required`. (g) The two S1 broken-source cases (S's `slopstop.db` zeroed): outcome `broken` "Project Storage upgrade source verification failed."; the discard reads S's registry row only, so it completes: no marker, no T row, no staging output, one `abandoned`; activation → safe-mode, canonical `corrupt` / `DATABASE_CORRUPT`, runtime `healthy`, `identity.generationId = S` (a different observation is a contract change, not a re-pin). (h) The S1 busy staged copy (exclusive lock held until `upgrade` returns) → `unavailable`; the discard meets the held file → `discardFailed({ …, cause: "busy" })`, no `abandoned`, marker `in-progress`; after release, `acquireActivation` → the discarded state with `abandoned({ …, reason: "interrupted" })` (discard at opening already exists from UPG-B23).
  - Expected red: after UPG-B23 the pipeline does not discard: marker, T's row and output remain, the retry answers `refused NOT_ELIGIBLE` (or, for rows where UPG-B23's opening discard runs first, no `abandoned(reason: "failed")` is emitted); row (h)'s post-release activation is a guard.
- **Behavior UPG-B19**: A failure after the switch commits keeps the upgrade.
  - Test: `keeps a committed switch when a later step fails` → `project-storage-upgrade.integration.test.ts`
  - Oracle: `failAt: after-upgrade-switch` → rejects with the injected error; registration on T, marker `completed`, no diagnostics calls; `acquireActivation` → read-write on T.
  - Expected red: guard (green on arrival); pins that the discard never runs after commit.
- **Behavior UPG-B23**: Owner stop during an upgrade settles and leaves the state for the next opening.
  - Test: `settles on owner stop and recovers at the next opening` → `project-storage-upgrade.integration.test.ts`
  - Oracle: the `after-staged-copy` hook starts `owner.stop()` without awaiting it and stores the promise; `upgrade` → `{ status: "unavailable", message: "Project Storage owner is stopped." }`; the stored `stop()` promise resolves; no diagnostics calls; marker `in-progress`, T `staging`, `.staging-T/` present. A new owner's `acquireActivation` → discarded-state activation and `abandoned({ …, reason: "interrupted" })`.
  - Expected red: at `ad823a0` the new owner's activation answers `recovery-required` (B23 is the first owner behavior and introduces E1).
- **Behavior UPG-B20**: A real process kill recovers without user input.
  - Test: `discards an upgrade interrupted by a process kill` → `registration-storage-upgrade-kill.integration.test.ts`
  - Oracle: the peer runs `upgrade` and is killed after it reports reaching (a) `after-backup-copied`, (b) `after-generation-rename`, (c) `during-upgrade-switch` (inside the switch transaction). For each, in the test process: `acquireActivation` → discarded-state activation with `snapshots/U/` present and `abandoned({ …, reason: "interrupted" })`; then `upgrade` → `upgraded` (T2, U2); activation read-write on T2. (d) As (b), but the first call is `upgrade` → `upgraded` (T2, U2) with the same `abandoned` event.
  - Expected red: guard after B23 for (a)–(c) activation (green on arrival); (d) is red until `upgrade` discards on entry (answers `refused NOT_ELIGIBLE`). Durations recorded.
- **Behavior UPG-B6**: Unproven leftovers never open and are never deleted.
  - Test: `keeps unproven upgrade leftovers quarantined` → `project-storage-upgrade-recovery.integration.test.ts`
  - Oracle, from the stopped state of UPG-B23 (snapshot of paths, file SHA-256 and registry rows equal before and after each call; `discardFailed({ …, cause: "unproven" })`; no `abandoned`): (a) an extra file `note.txt` inside `.staging-T/` → `acquireActivation` and `upgrade` → `{ status: "broken", message: "Project Storage generation contains an unknown witness." }`; (b) an extra UUID directory (not T) under the Project root → `acquireActivation` → safe-mode `recovery-required` on S, `upgrade` → `refused PROJECT_UPGRADE_NOT_ELIGIBLE`; (c) a second `storage_locations` row for the same storage with a distinct `normalized_path`, and T's row pointed at it → same as (b); (d) `.staging-T` replaced by a junction to a directory outside the Project root → `acquireActivation` and `upgrade` → `{ status: "broken", message: "Project Storage witness must not be a symbolic link." }` (`project-storage-filesystem-authority.ts:267`), and the junction target's contents unchanged.
  - Expected red: for (a)–(c), a discard without proof deletes the output and the marker, so activation answers `migration-required`; (d) is a guard (the UPG-B21 adapter already refuses links).
- **Behavior UPG-B21**: Discard removes only the marker's own output, and busy and broken discards stay distinct.
  - Test: `removes only proven upgrade output` → `project-storage-upgrade-directories.integration.test.ts` (adapter) and `project-storage-upgrade-recovery.integration.test.ts` (owner)
  - Oracle (adapter, `removeUpgradeOutput({ projectId, targetGenerationId: T, activeGenerationId })`): with `.staging-T/` and `<T>/` present → both removed, and the siblings `<S>/`, `<other uuid>/`, `.staging-<other uuid>/`, `snapshots/` and their files stay byte-identical. Refused with `ProjectStorageBrokenError("Project Storage upgrade output is invalid.")` and nothing removed: `activeGenerationId === T`; a junction at `.staging-T` or at `<T>` (junction target unchanged); a plain file at `<T>`; a missing Project root; a Project root that is a junction. A held handle inside `<T>/` → `ProjectStorageUnavailableError("Project Storage is busy; the upgrade can be retried.")`. (Owner, integration) From the stopped state of UPG-B23 with a held handle on `.staging-T/slopstop.db`: `acquireActivation` → `{ status: "unavailable", message: "Project Storage is busy; the upgrade can be retried." }`, `discardFailed({ …, cause: "busy" })`, marker kept; after release → discarded-state activation. (Owner, unit, `src/storage/project-storage-store.test.ts` typed fakes) with an `in-progress` marker and a fake `removeUpgradeOutput` that throws `ProjectStorageBrokenError("Project Storage upgrade output is invalid.")`: `acquireActivation` → `{ status: "broken", message: "Project Storage upgrade output is invalid." }`; `upgrade` → the same `broken` outcome; a pipeline failure (`failAt: after-staged-copy`) → `upgrade` rejects with the injected error and `discardFailed({ …, cause: "broken" })`; a fake application client that throws `ProjectStorageApplicationClientInitializationError` → `acquireActivation` and `upgrade` reject with it unchanged.
  - Expected red: (adapter) a recursive-remove stub removes the refused paths; (owner integration) the busy case answers `broken` or rejects with a raw `EBUSY`; (owner unit) the broken cases answer `recovery-required`-shaped results or reject.
- **Behavior UPG-B22**: Racing upgrades upgrade once.
  - Test: `upgrades once when two calls race` → `project-storage-upgrade.integration.test.ts`
  - Oracle: two `upgrade` calls started together on one owner → one `upgraded`, one `not-required`; one `storage_upgrades` row (`completed`); no diagnostics calls.
  - Expected red: guard (the project lock serializes); pins that discard-on-entry never discards a running upgrade in the same process.

TDD-exempt: the ADR 0005 text edit — documentation of behavior proven by UPG-B18/B20/B23.

### Success Criteria

Automated (Windows host):
- Repository root: `pnpm exec vitest run --config vitest.integration.config.ts apps/harness/tests/integration/project-storage-upgrade.integration.test.ts apps/harness/tests/integration/project-storage-upgrade-recovery.integration.test.ts apps/harness/tests/integration/project-storage-upgrade-directories.integration.test.ts`
- `apps/harness`: `pnpm exec vitest run --config vitest.registration.config.ts` (includes the kill test and `registration-storage-upgrades`)
- Repository root: `pnpm check`; `pnpm test:integration`; `pnpm check:duplicates` (0 clones); knip; `pnpm test:mutation:project-storage:harness` (thresholds unchanged); CodeScene 10 on touched files except the waived `project-storage-node-adapters.ts` (no score regression).

Manual: none.

## Deferred Work

- **S3** — precondition (E9): Electron single-instance lock before wiring `upgrade`; wires `upgrades.abandoned` / `discardFailed` to Pino; maps a rethrown upgrade error to the internal-failure envelope with a reference code (E4); everything listed in the parent's S3 entry.
- **S4** — remaining documentation (ADR 0006 manifest version 2 and `storage_upgrades`; GitHub issue for the full journal after user authorization). The ADR 0005 S2 amendment is done in S2 (E8).
- **Store `open()`** keeps answering `recovery-required` for an unfinished upgrade; revisit only if another caller needs recovery.
- **Accumulating backups** of abandoned attempts are kept; pruning needs a user decision and measured evidence.
- **Cross-process liveness proof** of a marker (owner process identity, migration `0008`) — not needed while E9 holds; trigger: any second writer of the same `userData`.
- **C1 gate** — unchanged.

## Verification Notes

- Risks: Windows handle release before removal (`9be86e4`; UPG-B21); kill-test flakiness (`cefc503`; the kill file runs in the low-parallelism registration project with unchanged per-test timeouts); lifecycle settlement (`f4e83c8`; UPG-B23).
- Reds are predictions; S1 showed several differ (evidence deviations 6, 11) — record as observed, never force. UPG-B18(g) pins canonical `corrupt` as the agreed oracle.
- Source anchors at `ad823a0`: listed under "Facts S2 builds on".
- Review evidence: `.rpiv/artifacts/evidence/2026-10-06_c1-0-s2-intent-review-1.md`, `-2.md`.

## Developer Context

Request: coordinator handoff (agent collaboration, pasted by the user on 2026-10-06) after S1 was squash-merged as `ad823a0`.

Asked in this design (2026-10-06, user):

- **Q (parent design S2 open question): Where does automatic cleanup after an interruption run?** A: at opening (and on `upgrade` entry) → E1.
- **Q (FRD FR7; S1 `expectFailedUpgradeState`): What happens right after a non-interrupted failure?** A: clean up before answering → E2.
- **Q (`0007_storage_upgrades.sql` unique `source_generation_id`): What is kept of an abandoned attempt?** A: keep the backup, delete the marker, log → E3.
- **Q (parent D10): Keep per-step failure codes?** A: no → E4.
- **Q (round 1, `docs/adr/0005-storage-lifecycle-and-recovery.md:45-46`): When is ADR 0005 updated?** A: in S2 → E8.
- **Q (round 1, no `requestSingleInstanceLock` under `apps/`): How is a second app instance kept from discarding a live upgrade?** A: single-instance lock in S3, before wiring `upgrade` → E9.

### Review gate status

Two intent rounds ran (evidence `-1.md`, `-2.md`), both failed. The coverage reviewer was unavailable in both rounds and the slice-verifier in round 2 (auto-mode permission classifier). Round-2 findings were applied without a third round (user rule). The final revision has no independent review.

**User gate decision (2026-10-06):** accept S2 intent with recorded residual risk, as an explicit override of the intent-review gate (rounds 1–2 failed; coverage reviewer unavailable in both, slice-verifier unavailable in round 2; final revision unreviewed). Residual risks: unreviewed round-2 fixes; Expected red predictions may differ and are then recorded as observed, never forced. Mitigation: candidate-mode independent review of the real S2 source. This decision does not authorize a build, workspace or branch.

Intent accepted by the user with recorded residual risk. Build authorization, branch and worktree remain separate decisions.

## References

- `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md` (parent)
- `.rpiv/artifacts/discover/2026-10-05_20-11-21_project-database-staged-upgrade.md` (FRD)
- `.rpiv/artifacts/evidence/2026-10-05_c1-0-s1-tdd-evidence.md`
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` sections 5 and 6
- `.rpiv/artifacts/evidence/2026-10-06_c1-0-s2-intent-review-1.md`
- `docs/adr/0005-storage-lifecycle-and-recovery.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`

## TDD Evidence (implement)

- Slice `c1-0-s2-upgrade-failure-and-recovery`, branch `feat/c1-0-s2-upgrade-recovery` from `a2af495`: per-behaviour red/green with working-tree digests, gates and deviations in `.rpiv/artifacts/evidence/2026-10-06_c1-0-s2-tdd-evidence.md` (append-only). Prior content hash of this design: `e33924cffd1a1830d140030cb9df2d6f4f572cb5fe81f1820298f6d52cc252e5`.

## Follow-up

- **S4 done (2026-10-07).** The ADR 0005 amendment (temporary single-marker form) and ADR 0006 manifest version 2 and `storage_upgrades` were already delivered in S1 (`.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §5, Adjustment 1). The remaining upgrade documentation (ADR 0005 amendment precision: eligibility, who starts an upgrade, runtime copy not migrated, internal-failure mapping, discard at the next activation or upgrade, single-instance lock, discard diagnostics; ADR 0006 backup manifest; `CONTEXT.md` terms) is in the S4 docs commit on branch `feat/c1-0-s4-upgrade-docs`. The full Storage-operation journal stays a follow-up: [Replace the temporary storage_upgrades marker with the full Storage-operation journal and its Effect records (#92)](https://github.com/TheMastermindPT/slopstop/issues/92).
- **S5 deep-review fixes (2026-10-07)**, branch `feat/c1-0-s5-deep-review-fixes`, from `.rpiv/artifacts/reviews/2026-10-07_16-47-49_2a19d40-e1c0a99-c1-0-staged-upgrade.md`: UPG-B23's owner stop is now reachable from a harness quit. While no Project is held, the runtime stops Storage together with the canonical application, and a running upgrade then answers `unavailable` and leaves its output for the next activation or upgrade. An owner stop after the switch commits answers `upgraded`. A busy registry during the unfinished-marker lookup answers busy instead of "no unfinished upgrade" (degrade-distinguishes-broken). A marker of another Project is a corrupt registry.
- **S5 review round 2 (2026-10-07, user decision U6):** a busy unfinished-marker lookup answers retryable `unavailable` with no discard-failed line (no upgrade id is known yet); any other failed marker query answers `broken` ("Project Storage upgrade marker could not be read."). Busy upgrade outcomes carry a `busy` discriminant instead of being recognized by their text. An owner stop at the post-switch checkpoint also answers `upgraded`.
