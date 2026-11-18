---
date: 2026-11-15T15:14:31+0000
author: Pedro Mesquita
commit: e6b6a76
branch: main
repository: slopstop
topic: "#146 the staging-to-active rename gives up at once on a transient Windows EPERM/EACCES/EBUSY"
tags: [design, project-storage, rename, retry, effect, schedule, windows, issue-146]
lane: normal
lane_reasons: ["no upstream lane", "lane.mjs --paths over the ten paths of Q3 (a): files: 6 > 5", "product code on the path that makes a generation active"]
status: in-review
last_updated: 2026-11-17T19:30:00+0000
last_updated_by: Pedro Mesquita
last_updated_note: "Amended contract (Q8 (a), S146-B11, scoped mutation proof, #150) approved by Pedro at 768bb19e (approval entry appended). Earlier: approved at 95ad8a4b."
content_hash: 28a0dc6dcd0b617e4ba6ac8c0c62acf5f764b9ba2b03f54e8b5557d2661fba76
---

# Design: #146 a bounded wait for Windows to release a just-written staging folder

Lane: **normal** (Q6 (a), Pedro). `lane.mjs --paths` over the ten paths answers `normal` ("files: 6 > 5"); over the seven paths without the mutation config it answers `fast`. Normal is proposed either way: this is product code on the step that makes a Storage generation active, and it is the harness's first `Schedule` and first `TestClock`.

## Intent

- **Outcome:** an install or an upgrade does not fail because Windows held a just-written staging folder for a moment. A hold that lasts still ends in today's retryable `unavailable` answer.
- **Scope:** the one `rename` call inside `renameAtomic`, the owner of the "held file" codes, and their rows.
- **Non-goals:**
  - no change to the `files.renameAtomic` port, to its two callers, or to any outcome, message or protocol value;
  - no retry of any other file or database step;
  - no change to the precondition checks around the rename;
  - no logging of retries (Q7);
  - the provisional numbers are not measured here (#122).
- **Constraints:**
  - Effect rules for touched harness code: an Effect program for waiting and retries, typed failures, `TestClock` for time rows, `runPromise` only in the Promise facade;
  - shared-vocab-union: the code set `EPERM`, `EACCES`, `EBUSY` has one owner;
  - a number without a measurement is marked provisional with its source (#122).

## Architecture

### What is on main (read at `e6b6a76`; re-read at `7a194c3` on 2026-11-16, every fact and line reference below holds)

- **`renameAtomic`** (`apps/harness/src/storage/project-storage-file-adapter.ts:157-174`, async, not exported): resolves both paths, checks the shape (`.staging-<id>` to `<id>`, same parent), checks that parent and source are directories and that the destination does not exist, calls `rename` once (`:167`), then checks the destination is a directory. Any failure goes through `normalizeStorageError` (`:169-173`).
- **The port:** `files.renameAtomic(source, destination): Promise<void>` (`project-storage-store.ts:242`), built by `createProjectStorageFileAdapter` (`project-storage-file-adapter.ts:268`, `:293`).
- **Callers:** creation (`project-storage-store.ts:402`, inside `runWhileRunning`, which checks the owner is running before and after) and the upgrade seal (`project-storage-upgrade-pipeline.ts:273`, inside a `step` that does the same).
- **Classification** (`project-storage-node-errors.ts`): `unavailableExactCodes` is `EACCES`, `EPERM`, `EBUSY` (`:31`, not exported). `storageFailureFor` turns such an error into `ProjectStorageUnavailableError("Project Storage authority is unavailable.")` (`:80-89`).
- **What the caller and the user get today:** creation answers `status: "unavailable"` with that message; the upgrade answers `status: "unavailable"`, `reason: "unavailable"` (`project-storage-upgrade-pipeline.ts:481-483`) and discards its staged output. Nothing is corrupted; the user must try again.
- **The test helper** `apps/harness/tests/integration/rename-when-released.ts`: 10 attempts, 50 ms apart, on the same three codes (its own copy, `:13`), with an injected `rename` and `delay`. Used at `project-storage-upgrade-directories.integration.test.ts:262` and `project-storage-upgrade-recovery.integration.test.ts:300`.
- **Is the tests' case-only rename the same path? No.** Those two tests rename a `.staging-<id>` folder to another spelling with Node's `rename`, as test setup. `renameAtomic` would refuse that shape. So the product retry does not cover them, and the helper stays.
- **Effect in this area:** no `Schedule`, `Effect.retry` or `TestClock` exists in `apps/harness` yet. Promise facades over Effect programs exist (`runProjectStorageUpgrade`, `project-storage-upgrade-pipeline.ts`), and `effect-rejection.ts` carries a rejected value as a typed `UntypedRejection`.
- **Mutation:** `project-storage-file-adapter.ts` is in no Stryker config. `project-storage-node-errors.ts` is a whole file in `stryker.project-storage.config.json` and `stryker.conversation.config.json`, with `project-storage-node-errors.test.ts` in both mutation Vitest configs. No line range and no anchor names any file of this slice.

### Options

| | 1. Bounded retry inside `renameAtomic` | 2. Single attempt, caller retries |
|---|---|---|
| A short hold (scanner, indexer) | passes, at most 450 ms later | install or upgrade fails; the user repeats it |
| A lasting hold | `unavailable`, as today, 450 ms later | `unavailable`, as today, at once |
| Code | one small Effect program, one predicate, rows | a comment |
| Risk | a wrong predicate could retry a real fault; a stop waits up to the bound | the 2026-10-30 failure can reach a user |

**Recommendation: option 1.** The tests already needed it for the same Windows behavior, and a failed upgrade is discarded and redone from the start, which costs the user far more than half a second.

### Option 1, the shape

- **One owner for the codes.** `project-storage-node-errors.ts` exports `isHeldFileError(error)`: true for exactly `EPERM`, `EACCES`, `EBUSY`. `isUnavailableStorageError` keeps its answers and uses the same set.
- **The policy, a new module** `apps/harness/src/storage/project-storage-rename-retry.ts`: `renameWhenReleased(rename, platform)` takes the rename as an Effect and returns an Effect that:
  - on `win32`, retries it while `isHeldFileError` holds for the failure, at most 9 retries (10 attempts), 50 ms apart: `Effect.retry` with `times`, `while` and a `Schedule.spaced` schedule (Effect 4 retrying guide, read through Context7 on 2026-11-15);
  - on any other platform, or for any other failure, runs it once;
  - fails with the last attempt's failure, unchanged.
- **The adapter.** `renameAtomic` becomes an Effect program (exported for its rows as `renameAtomicProgram`, with the `rename` as a port) whose `rename` step goes through `renameWhenReleased`. The precondition checks run once, before the first attempt; the destination check runs once, after success. The port stays a Promise: the facade runs the program with `Effect.runPromise` and rejects with exactly what it rejects with today.
- **Failures stay typed inside the program** (the existing `UntypedRejection`); nothing is thrown inside it; an interruption is not turned into a storage error.

### The numbers (provisional, #122)

10 attempts, 50 ms apart: at most 450 ms of waiting. They are the test helper's numbers (commit `8990120`, 2026-10-30), the only ones with any record. Nobody has measured how long a scanner holds a new folder; 20 idle runs never reproduced the hold. So they are provisional, and the contract says so in the code comment and here. A measured value replaces them under #122.

### Windows only

On POSIX, `EPERM` and `EACCES` mean a lasting permission problem, so a retry only delays the answer. The platform is a parameter, so the rows run on every CI job.

### Interruption and stop

- The retry's waits are Effect sleeps, so an interrupted program stops waiting at once.
- The port has no signal, and both callers reach it through a Promise. So an owner stop that arrives during the wait is seen only when the port returns: at most 450 ms later. Both callers already re-check the owner after the call.
- A rename that succeeds after a stop began is possible today too (one attempt in flight); the retry widens that window to the bound. The callers' existing recovery of a renamed-but-not-activated generation is unchanged.
- Passing a signal through the port would close this, at the cost of the port, both callers and their fakes. Not proposed here; named in Deferred Work.

### What gets slower, as Pedro was told

- A true permission error on Windows (a lasting `EPERM` or `EACCES`) now takes up to 450 ms to surface, where it surfaced at once.
- A stop that arrives during the wait is seen only when the wait ends.

### After the bound

The tenth failure reaches `normalizeStorageError` as today: `ProjectStorageUnavailableError`, "Project Storage authority is unavailable.". The source folder is still in place and the destination does not exist. Creation and upgrade answer exactly as they do now.

## Decisions

- **Q1 (decided (a), Pedro, 2026-11-15): option 1 or 2?** (a) option 1, bounded retry in the adapter; (b) option 2, single attempt, documented. **Recommendation: (a).**
- **Q2 (decided (a), Pedro, 2026-11-15): the bound.** (a) 10 attempts, 50 ms apart, fixed (at most 450 ms), provisional under #122; (b) a growing delay up to about 1 s; (c) wait for a measurement first. **Recommendation: (a)**: there is no measurement to justify another shape, and (c) cannot be produced on demand.
- **Q3 (decided (a), Pedro, 2026-11-15): mutation.** (a) add the new policy module to `stryker.project-storage.config.json` (whole file) with its test in the mutation Vitest config; the repository row of `check-stryker-ranges.test.mjs` goes from 17 to 18 whole files; one mutation run on the final candidate; (b) no config change, the bindings stand in. **Recommendation: (a)**: a bound and a predicate are what mutation is good at, and the predicate's owner is already mutated there.
- **Q4 (decided (a), Pedro, 2026-11-15): Windows only?** (a) yes; (b) every platform. **Recommendation: (a).**
- **Q5 (decided (a), Pedro, 2026-11-15): the test helper's copy of the three codes.** (a) `rename-when-released.ts` takes `isHeldFileError` from the owner and keeps its own numbers and loop; (b) leave the helper as it is and name the copy. **Recommendation: (a)**: shared-vocab-union, one line.
- **Q6 (decided (a), Pedro, 2026-11-15): lane.** (a) normal; (b) rigorous. **Recommendation: (a)**: no schema, protocol, migration or outcome changes; rigorous would add an intent review for one retried call.
- **Q7 (decided (a), Pedro, 2026-11-15): record retries?** (a) not now: the file adapter has no logger; (b) add a diagnostics line per retried rename, as a later slice, which would also give #122 its data. **Recommendation: (a) now, (b) kept in Deferred Work.**
- **Q8 (decided (a), Pedro, 2026-11-17, amendment): the two survivors on the adapter's new lines.** (a) one row on the real `renameAtomic` facade, the slice's integration file joins the mutation Vitest config, and the mutation proof of this slice is scoped to what the slice changed; the full-suite command is replaced. This amends Q3 (a): the config entries of Q3 stay, the run changes. The adapter's old lines are out of scope, tracked in #150.
- **Rejected:** retrying inside the two callers (two copies of the policy); retrying the whole `renameAtomic` (it would re-run checks that cannot have changed under the owner's lock); a hand-written loop with `setTimeout` (against the Effect rules).

## Next Slice

### Slice i146-s1-rename-retry (on Q1-Q7 (a); base re-pinned at `7a194c3` on 2026-11-16; not executable until Pedro approves this contract)

- **`slice_id`:** `i146-s1-rename-retry`.
- **Lane:** normal (Q6 (a)).
- **Base:** `7a194c3` (main, after #145 was integrated; code head `dd01315`). Re-pinned on 2026-11-16. Between `e6b6a76` and `7a194c3` none of the ten paths changed. `apps/harness/scripts/check-stryker-ranges.mjs`, which the tenth path imports, now starts its entry block through `gate-entry.mjs` (#145); under Vitest it still answers as an import, and the repository row that this slice edits (`check-stryker-ranges.test.mjs:455`) is unchanged.
- **Deliverable:** as "Option 1, the shape" above, plus Q5 (a) and Q3 (a).
- **Affected paths (ten):**
  - `apps/harness/src/storage/project-storage-node-errors.ts`;
  - `apps/harness/src/storage/project-storage-node-errors.test.ts`;
  - `apps/harness/src/storage/project-storage-rename-retry.ts` (new);
  - `apps/harness/src/storage/project-storage-rename-retry.test.ts` (new);
  - `apps/harness/src/storage/project-storage-file-adapter.ts`;
  - `apps/harness/tests/integration/project-storage-rename-retry.integration.test.ts` (new; matched by the existing `tests/integration/**/*.test.ts` include; amendment: it also holds S146-B11);
  - `apps/harness/tests/integration/rename-when-released.ts` (Q5 (a));
  - `stryker.project-storage.config.json` (Q3 (a));
  - `apps/harness/vitest.project-storage-mutation.config.ts` (Q3 (a); amendment: its `include` also names the slice's integration file);
  - `apps/harness/scripts/check-stryker-ranges.test.mjs` (Q3 (a): the repository row, 17 to 18 whole files).
- **Not touched:** the port type, `project-storage-store.ts`, `project-storage-upgrade-pipeline.ts`, the protocol, the desktop, `stryker-range-anchors.json` (no range is added or moved), `stryker.conversation.config.json`.
- **Stryker:** `project-storage-node-errors.ts` stays a whole file in both configs; its new predicate is mutated there and killed by S146-B1. The new module is one whole-file entry: no anchor. `check:mutation-ranges` on the candidate is the authority.
- **Amendment (2026-11-17, Q8 (a)):** no new path; the ten stand. `project-storage-file-adapter.ts` source does not change in the amendment, and it does not join `stryker.project-storage.config.json` (its range is named on the command line only, so `check-stryker-ranges.test.mjs` keeps `28` ranges and `18` whole files, and `stryker-range-anchors.json` stays untouched).
- **Full-integration exposure:**
  - **Harness integration:** every creation and upgrade row goes through the real adapter and `renameAtomic` (`project-storage-create`, `project-storage-lifecycle`, the `project-storage-upgrade-*` files, the registration flows). On Windows they now retry a real hold instead of failing, which is the point; no row expects an immediate `unavailable` from a real rename.
  - **Windows real-file rows:** the new integration file creates fresh folders and renames them. Its rows inject the rename, so a real transient `EPERM` there would be retried by the code under test, not by the helper.
  - **e2e and smoke:** creation and upgrade journeys use the same path; no per-slice run.
- **Dependencies:** none.

## Test Contracts

#### Test Contract: i146-s1-rename-retry

Public seams: `isHeldFileError`; `renameWhenReleased` with an injected rename Effect and platform, under `TestClock`; `renameAtomicProgram` with an injected `rename` over real temporary folders, under `TestClock`; the adapter's files port, `createProjectStorageFileAdapter(...).renameAtomic`, over real temporary folders with Node's own rename (S146-B11).

Time rows fork the program, then advance the test clock; no row sleeps for real. An injected rename counts its calls and answers a coded error (`Object.assign(new Error(...), { code })`) or succeeds.

- **Behavior S146-B1: the three held-file codes have one owner.**
  - Test: `knows a held file by its code: $name` in `apps/harness/src/storage/project-storage-node-errors.test.ts`, one row per value.
  - Oracle: `isHeldFileError` is true for errors coded `EPERM`, `EACCES` and `EBUSY`, and false for `ENOENT`, `EEXIST`, `SQLITE_BUSY`, an error with no code, and `undefined`.
  - Expected red: the export does not exist, so the file fails to load.
- **Behavior S146-B2: a held rename is tried again until Windows releases it.**
  - Test: `retries a held rename until it is released` in `apps/harness/src/storage/project-storage-rename-retry.test.ts`.
  - Oracle: on `win32`, with a rename that fails `EPERM`, then `EBUSY`, then succeeds: after 49 ms of test time the rename was called once; after 50 ms twice; after 100 ms three times, and the program has succeeded.
  - Expected red: the module does not exist.
- **Behavior S146-B3: the bound holds.**
  - Test: `gives up after ten attempts with the last failure` in `apps/harness/src/storage/project-storage-rename-retry.test.ts`.
  - Oracle: on `win32`, with a rename that always fails `EACCES` with a new error each time: after 450 ms of test time the program has failed with the tenth error itself (identity), the rename was called exactly ten times, and a further 1000 ms adds no call.
  - Expected red: the module does not exist.
- **Behavior S146-B4: another failure is not retried.**
  - Test: `does not retry another failure: $name` and `stops at another failure after a held one` -> `apps/harness/src/storage/project-storage-rename-retry.test.ts`
  - Oracle: the first title has three rows, `ENOENT`, `EEXIST` and an error with no code: on `win32` the program fails with that error itself after one call, with no test time advanced, and advancing 1000 ms adds no call. The second title: a held failure followed by `ENOENT` stops at the second call with the `ENOENT` error.
  - Expected red: the module does not exist.
- **Behavior S146-B5: no retry off Windows.**
  - Test: `tries once on another platform: $platform` in `apps/harness/src/storage/project-storage-rename-retry.test.ts`, rows `linux` and `darwin`.
  - Oracle: with a rename that always fails `EPERM`, the program fails with the first error after one call; advancing 1000 ms adds no call.
  - Expected red: the module does not exist.
- **Behavior S146-B6: the adapter's rename waits out a short hold and makes the generation active.**
  - Test: `makes the generation active after a short hold` in `apps/harness/tests/integration/project-storage-rename-retry.integration.test.ts`.
  - Oracle: with a real `.staging-<id>` folder and a rename that fails `EPERM` once and then calls Node's `rename`, on `win32`: after 50 ms of test time the program has succeeded, `<id>` is a directory, `.staging-<id>` no longer exists, and the rename was called twice.
  - Expected red: `renameAtomicProgram` is not exported, so the file fails to load.
- **Behavior S146-B7: a lasting hold still answers unavailable, and nothing moved.**
  - Test: `answers unavailable after a lasting hold` in `apps/harness/tests/integration/project-storage-rename-retry.integration.test.ts`.
  - Oracle: with a rename that always fails `EBUSY`, on `win32`: after 450 ms of test time the program has failed; the failure, as the facade would reject it, is a `ProjectStorageUnavailableError` with message "Project Storage authority is unavailable."; the rename was called ten times; `.staging-<id>` is still a directory and `<id>` does not exist.
  - Expected red: `renameAtomicProgram` is not exported.
- **Behavior S146-B8: the precondition checks still run once and still refuse.**
  - Test: `refuses an existing target without renaming` in `apps/harness/tests/integration/project-storage-rename-retry.integration.test.ts`.
  - Oracle: with `<id>` already present, the program fails with a `ProjectStorageBrokenError`, "Project Storage activation target already exists.", and the injected rename was never called.
  - Expected red: `renameAtomicProgram` is not exported.
- **Behavior S146-B9: the test helper keeps its behavior on the owner's predicate.**
  - Test: `apps/harness/tests/integration/rename-when-released.test.ts`, unchanged.
  - Oracle: its existing rows, word for word.
  - Expected red: none — pin.
- **Behavior S146-B10: creation and upgrade keep their answers through the real adapter.**
  - Test: `apps/harness/tests/integration/project-storage-create.integration.test.ts` and `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`, unchanged.
  - Oracle: their existing rows, word for word.
  - Expected red: none — pin.
- **Behavior S146-B11: the real port rejects with the storage failure, and renames nothing.**
  - Test: `rejects an existing target through the real adapter` in `apps/harness/tests/integration/project-storage-rename-retry.integration.test.ts`.
  - Oracle: with a real `.staging-<id>` directory and `<id>` already a directory in a fresh temporary root, `createProjectStorageFileAdapter({ applicationStorageRoot: <root> }).renameAtomic(<.staging-<id>>, <id>)` rejects; the rejection is a `ProjectStorageBrokenError` with message "Project Storage activation target already exists."; afterwards `.staging-<id>` is still a directory and `<id>` is still a directory. Nothing is injected: the facade, Node's rename and `process.platform` are the real ones.
  - Expected red: none — pin
  - Why a pin, said openly: the port already rejected an existing target this way before the slice (the old `renameAtomic` at the base), and the candidate's facade does too. A red cannot be observed honestly. What the row adds is proved by bindings 8 and 9, which the implementer runs first, before counting the row as green.

**Bindings that bite (each on the candidate, each restored after):**
1. Retry 10 times instead of 9. S146-B3 fails (eleven calls).
2. Drop the `while` predicate. S146-B4 fails (a second call for `ENOENT`).
3. Drop the platform test. S146-B5 fails.
4. Space the retries 5 ms apart. S146-B2 fails at the 49 ms reading.
5. In `isHeldFileError`, add `ENOENT`. S146-B1 fails.
6. In the adapter, call `rename` without `renameWhenReleased`. S146-B6 fails.
8. (Amendment.) In the `renameAtomic` facade, drop the `throw` of the failure. S146-B11 fails: the promise resolves. This is the scoped run's survivor at `:221`.
9. (Amendment.) In `renameAtomicProgram`, make the `Effect.mapError` function answer `undefined`. S146-B11 fails: the rejection is not a `ProjectStorageBrokenError`. This is the survivor at `:208`. (S146-B8 fails too.)
7. **Not killed, named openly:** in the adapter, moving the destination-absent check inside the retried step changes no row's result (the lock keeps the target absent between attempts). It is the same behavior under the owner's lock, so no row is written for it and none is claimed.

**Order (red first):** S146-B1 row, then the predicate (green); the S146-B2 to B5 rows (red), then the policy module (green); the S146-B6 to B8 rows (red), then the adapter (green); the helper's one-line change (S146-B9 green); the mutation config entries and the count in `check-stryker-ranges.test.mjs`. Amendment, after all of that: the S146-B11 row with bindings 8 and 9 (each fails the row, each restored), then the integration file's line in the mutation Vitest config `include`.

**Structural checks (on the candidate):**
- `rg -n "EPERM|EACCES|EBUSY" apps/harness/src/storage apps/harness/tests/integration/rename-when-released.ts --glob 'project-storage-*.ts' --glob 'rename-when-released.ts' --glob '!*.test.ts'`: `project-storage-node-errors.ts` only. (The search is limited to the Project Storage files on purpose: `canonical-writer-lease.ts:114` and `repository-physical-observation.ts:46-47` name some of these codes for other decisions and are not copies of this set.)
- `rg -n "setTimeout|new Promise" apps/harness/src/storage/project-storage-rename-retry.ts apps/harness/src/storage/project-storage-file-adapter.ts`: no hit.
- `rg -n "Effect\.runPromise" apps/harness/src/storage/project-storage-file-adapter.ts`: the `renameAtomic` facade only.

**Runs:**
- Red-green: the three touched test files alone.
- **Need the coordinator's GO (CPU rule):** `pnpm check`; the mutation run, once, on the final candidate (Q3 (a), as amended by Q8 (a), below); the final `check:deep` before push.
- **Mutation proof, scoped (Q8 (a), Pedro, 2026-11-17).** It replaces the full-suite command `pnpm test:mutation:project-storage:harness`, by user decision: the full run did not finish in 1 h 38 min and was stopped with no result.
  - Command: `pnpm exec stryker run stryker.project-storage.config.json --mutate apps/harness/src/storage/project-storage-rename-retry.ts,apps/harness/src/storage/project-storage-node-errors.ts,apps/harness/src/storage/project-storage-file-adapter.ts:167-222`. Same config, same thresholds (break 80), same concurrency; no config file is edited for the scope.
  - Scope: `project-storage-rename-retry.ts` and `project-storage-node-errors.ts` whole, and lines 167-222 of `project-storage-file-adapter.ts`, which is the range the slice changed (`requireRenamePreconditions` to the `renameAtomic` facade). If the adapter's lines move before the run, the implementer re-reads the range from the diff and names the one used.
  - Must hold: exit 0; no survivor at the facade's `throw` (`:221`) and none at the `Effect.mapError` function (`:208`); every mutant of `project-storage-rename-retry.ts` killed.
  - Predicted to survive, named openly and not claimed: four message strings in the adapter's range (`:170`, `:171`, `:205`, and `:211`), because no row fails a rename for a missing parent, a missing source, a wrong target type or an unknown error. The first three are old text the slice moved; the fourth is the old fallback message. In `project-storage-node-errors.ts`: `:38` (equivalent: neither string is a held code) and two on old lines (`:7`, `:11`). Predicted score from the earlier scoped report: about 108 of 115.
  - Out of scope: every line of `project-storage-file-adapter.ts` outside 167-222 (it was never in this config's mutate list; the scoped run of 2026-11-17 measured it whole at 57%). Tracked in #150.
- CodeScene 10 on the new and touched source and test files.

**Manual acceptance:** none. The real hold cannot be produced on demand; the rows prove the policy with an injected rename, and that is stated, not hidden.

## Deferred Work

- **A log line for each retried rename** (Q7; linked to #122). Not built now: the file adapter has no logger. The cost, as Pedro was told: without it the provisional 10 attempts and 50 ms can never be measured, because nothing records that a retry happened or how many it took. Trigger: the #122 measurement work, or a logger reaching the file adapter.
- **Measure the hold and replace the provisional numbers** (#122). Trigger: the log line above, or a reference Windows machine under load.
- **A signal through the `renameAtomic` port**, so a stop ends the wait at once. Trigger: the file adapter or its callers move to Effect.
- **The rest of the file adapter as Effect programs.** Trigger: a slice that changes them.
- **Mutation proof of the file adapter's old lines** (#150). The adapter is not in `stryker.project-storage.config.json`; the one whole-file measurement (2026-11-17) left 82 survivors and no-coverage mutants outside the slice's range. Trigger: #150.
- **The full `test:mutation:project-storage:harness` run takes longer than 1 h 38 min on this machine.** Not sized further here. Trigger: #150, or the next slice that needs that run.
- **The same hold on other steps** (`removeUpgradeOutput`, directory creation). No failure recorded. Trigger: a first report.

## Verification Notes

- A failed `rename` did nothing, so trying it again is safe; the checks around it are not repeated because the owner's lock keeps other writers out.
- The rows inject the rename; no row proves that Windows releases a folder within 450 ms. That claim is not made.
- `TestClock` comes from `effect/testing` (`TestClock.layer()`, `TestClock.adjust`); the program under test is forked (`Effect.forkChild`) before the clock is moved. The repository has no `@effect/vitest`; rows run through `Effect.runPromise` in plain Vitest tests.
- S146-B7 reads the failure "as the facade would reject it": the row applies the same unwrapping the facade uses, so the oracle is the caller-visible error.
- Mutation run cost for `stryker.project-storage.config.json` is not known to the designer; the coordinator sizes it before the GO. (2026-11-17: the full run was stopped at 1 h 38 min with no result; the scoped run took 32 min 30 s.)
- S146-B6 to B8 inject the rename into `renameAtomicProgram`, so before the amendment nothing made the real `renameAtomic` facade fail. S146-B11 does, through the adapter's public files port, with nothing injected. It uses the one failure that real disk gives on demand on every platform: a target that already exists.
- The mutation Vitest config did not run the slice's integration file, so mutants on the adapter's new lines were judged without S146-B6 to B8. With the file in the `include`, they count.
- The titles of rows written with `it.each` are pinned as written, placeholders included (`: $name`, `: $platform`), so the slice preflight finds them (the #145 lesson). The implementer keeps those exact titles.
- The product policy and the test helper are both named `renameWhenReleased`, in different folders, with different signatures. Kept: the helper is not renamed (Q5 (a) changes one line of it).

## Developer Context

- **2026-11-15: draft written (coordinator instruction; Pedro chose #145 and #146).**
  - Read at `e6b6a76`: `project-storage-file-adapter.ts`, `project-storage-node-errors.ts`, the two callers, the pipeline's `step` and outcome mapping, `rename-when-released.ts` and its test and call sites, `effect-rejection.ts`, the Stryker and mutation Vitest configs that name these files, `check-stryker-ranges.test.mjs:442-455`, issue #146.
  - Effect 4 documentation read through Context7 (`/websites/effect_website_v4`): `Effect.retry` options `times`, `while`, `schedule`; `Schedule.spaced`; `TestClock.layer` and `TestClock.adjust` with a forked program.
  - No test was run.
  - **Approach check:** rejected a retry in the callers, a retry of the whole `renameAtomic`, and a hand-written loop.
  - Q1-Q7 are open.
- **2026-11-15: Q1-Q7 decided, all (a); contract fixed (Pedro, answered to the coordinator through AskUserQuestion; relayed by the coordinator, who validated `231d16db` and read `renameAtomic` and the code set).**
  - **Q1 (a):** option 1, the bounded retry. **Q2 (a):** 10 attempts, 50 ms spaced, provisional under #122. **Q3 (a):** the policy module joins `stryker.project-storage.config.json`. **Q4 (a):** Windows only. **Q5 (a):** the test helper takes `isHeldFileError` from the owner and keeps its numbers. **Q6 (a):** normal lane. **Q7 (a):** no retry diagnostics now.
  - **Told to Pedro by the coordinator:** a true permission error now takes up to 450 ms to surface; a stop during the wait is seen only at its end; without the retry log line the provisional numbers can never be measured.
  - **Changed in the contract:** the questions are marked decided; the base is re-pinned at build authorization (the slice is built after #145 is integrated); the retry log line is in Deferred Work, linked to #122, with its reason; a short section states what gets slower. The ten paths, the behaviors and the bindings are unchanged.
  - **Approval:** not yet given; it is Pedro's, later.
- **2026-11-16: base re-pinned to `7a194c3` and the contract re-checked (coordinator instruction, after #145 was accepted and integrated locally).**
  - **Re-read at `7a194c3`:** `renameAtomic` (`project-storage-file-adapter.ts:157-174`, the `rename` at `:167`, the facade at `:293`), the port (`project-storage-store.ts:242`), both callers (`:402`, `project-storage-upgrade-pipeline.ts:273`), the code set (`project-storage-node-errors.ts:31`), the test helper and its test, both mutation configs, `check-stryker-ranges.test.mjs:455` (`ranges: 28, wholeFiles: 17`), the script `test:mutation:project-storage:harness`.
  - **Changed since `e6b6a76`:** none of the ten paths. `git diff e6b6a76 7a194c3` over the storage folder, the integration folder and the configs shows only #145 files (`check-stryker-ranges.mjs`, the new `gate-entry-alias.integration.test.mjs`, one line of `vitest.integration.config.ts`).
  - **Effect API checked against the installed package (effect 4.0.0):** `Effect.retry`, `Effect.forkChild` and `Schedule.spaced` are functions; `effect/testing` exports `TestClock` with `layer` and `adjust`.
  - **Lane:** `lane.mjs --paths` over the ten paths still answers `normal` (`files: 6 > 5`). Q6 (a) stands.
  - **Corrected in the contract:**
    - three Test lines now name the `it.each` titles as written: S146-B1 (`: $name`), S146-B4 (`: $name`, and its fourth case under its own title), S146-B5 (`: $platform`). No behavior or oracle changed; the S146-B4 oracle says which title holds which case;
    - the first structural check was wrong as written (designer): a search of all of `apps/harness/src` also finds `canonical-writer-lease.ts:114` and `repository-physical-observation.ts:46-47`, which name some of these codes for other decisions. It is now limited to the Project Storage files;
    - one line range (`storageFailureFor`, `:80-89`).
  - **Unchanged:** the ten paths, the ten behaviors, the seven bindings, the numbers (10 attempts, 50 ms, Windows only), the mutation entry, the Deferred retry log line (#122). Pedro's answers Q1-Q7 stand.
  - **Approval:** not yet given. No question for Pedro arose from the re-check.
- **2026-11-16: contract approved (Pedro, answered to the coordinator through AskUserQuestion; relayed and confirmed by the coordinator, who validated the hash).**
  - **Approved:** the contract of slice `i146-s1-rename-retry` at `content_hash` `95ad8a4b3419f3ca6c3317ec5e8490a3d7674bd9b468486490210278b8c2ba0d`. Approved copy: `.rpiv/evidence/2026-11-15_15-14-31_staging-rename-retry-146/approved-95ad8a4b.md`.
  - **Lane:** normal (Q6 (a)), as `lane.mjs` answers. The label is recorded over the ten paths.
  - **Workspace:** branch `fix/staging-rename-retry-146` in the main checkout, no worktree. A named deviation from the normal lane's linked worktree, as in #145.
  - **Told to Pedro by the coordinator:** `canonical-writer-lease.ts` and `repository-physical-observation.ts`, which test `EBUSY` and `EACCES` / `EPERM` for other decisions, stay separate owners.
  - The slice heading's words "not executable until Pedro approves this contract" are met by this entry; the heading is left as approved.
- **2026-11-17: contract amended after the scoped mutation run (Q8 (a), Pedro, answered to the coordinator; relayed by the coordinator). The approval at `95ad8a4b` does not cover this text.**
  - **Facts (evidence folder: `i146-s1-tdd.md`, `mutation-project-storage-scoped-summary.txt`, `mutation-project-storage-scoped.json`):** the full mutation run broke once (Windows process creation, `0xC0000142`) and was stopped the second time at 1 h 38 min, no result. A scoped run over the three changed source files ended at 68.83, under break 80, pulled down by the adapter mutated whole (57.14%). On the slice's new lines two survivors matter: `:221` (the facade may swallow every failure) and `:208` (the failure mapping). No test made the real facade fail, and the slice's integration file was not in the mutation Vitest config.
  - **Added:** behavior S146-B11 (a pin, with its reason), bindings 8 and 9, one step in the order, the scoped mutation proof in place of the full-suite command, two Deferred Work items (#150), Q8 in Decisions.
  - **Read for this:** the candidate's `project-storage-file-adapter.ts:154-222` and `:315-342`, the base's `renameAtomic` (`git show HEAD`), the slice's integration file, `vitest.project-storage-mutation.config.ts`, the scoped report (24 mutants in lines 167-222: 13 killed, 7 survived, 4 not covered).
  - **Different from the instruction, for the coordinator and Pedro:** the row was asked as red-first. It cannot be: the port rejected an existing target the same way before the slice. It is written as a pin, and bindings 8 and 9 are its proof. Four message-string mutants in the range are predicted to survive and are named, not hidden; closing them would take more rows (missing parent, missing source, wrong target type, unknown rename error) and is not part of the minimum asked.
  - **Unchanged:** the ten paths, S146-B1 to B10, bindings 1 to 7, the numbers, the lane (normal), the workspace, Q1-Q7.
  - **Invalidated:** the approval at `95ad8a4b` for the amended parts. The TDD evidence already recorded for S146-B1 to B10 stands as it is. Not executable until Pedro approves the new hash.
  - No test or gate was run by the designer; no code was touched.
- **2026-11-17: amended contract approved (Pedro, answered to the coordinator through AskUserQuestion; relayed and confirmed by the coordinator, who saved the approved copy).**
  - **Approved:** the amended contract of slice `i146-s1-rename-retry` at `content_hash` `768bb19e841a01663a0d9fcbc54fdf657c0e58c4739e1c8889940e88624f5efd`, as is. Approved copy: `.rpiv/evidence/2026-11-15_15-14-31_staging-rename-retry-146/approved-768bb19e.md`. It replaces `approved-95ad8a4b.md` as the copy later checks compare against.
  - **Decided with it:** the four message strings in the adapter's range (`:170`, `:171`, `:205`, `:211`) stay predicted survivors; no rows are added for them. S146-B11 stays a pin, proved by bindings 8 and 9.
  - **Unchanged:** lane (normal), workspace (branch `fix/staging-rename-retry-146` in the main checkout), the ten paths.
- **2026-11-18: slice `i146-s1-rename-retry` accepted (Pedro, answered to the coordinator through AskUserQuestion).**
  - **Candidate:** commit `7245fab` on `fix/staging-rename-retry-146`, base `3af9507`, the ten contract paths.
  - **Proof on the candidate:** scoped mutation 93.91 (exit 0; no survivor at `:208` or `:221`; the four named message strings survive), `pnpm check`, `check:duplicates`, `check:dead-code` exit 0, CodeScene 10, committed tree unit 92 and integration 4 passed, slice-preflight clean.
  - **Review, one round:** slice-verifier, artifact-code-reviewer and artifact-coverage-reviewer all passed with no defect. One coverage concern, grounded by the coordinator: no row observes the platform that reaches the retry through the real adapter (`project-storage-file-adapter.ts:219`, `:200`). Suggestions: an interruption row, `failureOf` failing by timeout, eager `path.resolve`. Record: `.rpiv/evidence/2026-11-15_15-14-31_staging-rename-retry-146/i146-s1-candidate-review-2026-11-18.md`.
  - **Decision:** accepted as is; the concern and the suggestions are tracked in #151, not fixed in this slice.
  - **Accepted notes:** the reds surfaced as per-row `is not a function`, not "fails to load"; binding 9 also failed S146-B7 (not predicted); the full mutation command was replaced by the scoped one (see the amendment).


## References

- GitHub issues #146, #122, #150 (`TheMastermindPT/slopstop`).
- `apps/harness/src/storage/project-storage-file-adapter.ts`, `project-storage-node-errors.ts`, `project-storage-store.ts`, `project-storage-upgrade-pipeline.ts`.
- `apps/harness/tests/integration/rename-when-released.ts` and its test.
- `stryker.project-storage.config.json`, `apps/harness/vitest.project-storage-mutation.config.ts`, `apps/harness/scripts/check-stryker-ranges.test.mjs`.
- Effect 4 documentation: Retrying; `Schedule`; `TestClock` (effect.website/docs/v4).
- `.rpiv/decisions/shared-vocab-union.md`.
