---
date: 2026-11-14T16:36:18+0000
author: Pedro Mesquita
commit: fe4d32d
branch: main
repository: slopstop
topic: "#148 Effect gate test rows time out at 5000ms when the unit run saturates the CPU"
tags: [design, effect-gate, vitest, test-reclassification, timeouts, issue-148]
lane: fast
lane_reasons: ["no upstream lane", "lane.mjs --paths: within fast limits"]
status: in-review
last_updated: 2026-11-15T05:00:00+0000
last_updated_by: Pedro Mesquita
last_updated_note: "TDD Evidence appended for i148-s1 (proofs 1-7, M3). Earlier: two corrections; contract approved by Pedro at 9a8c8e9b; M1 and M2 recorded; Q1-Q5 decided; draft."
content_hash: 5ce61b17e64bafdf8d1c6e18e3a9f3b622f10f0aea8a68dadf6de07a3d74e1b3
---

# Design: #148 Effect gate test rows that time out under the unit run's load

Lane: **fast** (Q4 (a)). `lane.mjs --paths` over the four planned paths answers `fast` ("within fast limits"; slices, lines and hub signal unknown). No upstream artifact carries a lane. This brief exists because the coordinator asked for the options to be weighed before the slice; the fast lane itself asks Pedro once.

## Intent

- **Outcome:** `pnpm check` no longer fails on `apps/harness/scripts/check-effect-diagnostics.test.mjs` when nothing is wrong, and no test assertion is lost or loosened.
- **Scope:** the tests of that one file, the Vitest project they run in, and the mutation Vitest config that names the file.
- **Non-goals:**
  - no change to `check-effect-diagnostics.mjs` (the gate script) or to `pnpm check:effect`;
  - no change to any assertion, test title or fixture content;
  - #139 (mutation survivors in the gate script) is not handled here;
  - the other script tests that spawn a process (`check-golden-sql.test.mjs`, `check-stryker-ranges.test.mjs`) are not moved (Deferred Work).
- **Constraints:**
  - a gate is not weakened to make it pass (`AGENTS.md`, Commands);
  - a time budget comes from a recorded measurement (#122), never from a guess;
  - tests that use a real process belong to the integration project (the test reclassification rule, Pedro, 2026-10-05; recorded in `.rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md`).

## Architecture

### What the file holds (read at `fe4d32d`)

`vitest list` on the file gives **70 tests**. They are in the `harness` unit project (`apps/harness/vitest.config.ts:8`, `scripts/**/*.test.mjs`), which sets no `testTimeout`, so each test has Vitest's default 5000ms unless it names its own.

Twelve tests call the checker with no injected `spawn` on a project list or the canary, or spawn the CLI. They can reach the real `effect-tsgo` compiler or a child Node process:

| Test (title in the file) | Line | Rows | Real work per row | Budget today |
|---|---|---|---|---|
| `fails on a planted Effect error: $name` | `:112` | 3 | 2 compiler runs: one through `checkEffectDiagnostics`, one through a child `node check-effect-diagnostics.mjs .` | 5000ms |
| `fails on a file that resolves no Effect v4` | `:130` | 1 | 1 compiler run | 5000ms |
| `refuses a gated package that declares its own plugins: $name` | `:179` | 3 | 1 child Node process (the CLI); the refusal comes before any compiler run | 5000ms |
| `checks a commented gated package without plugins and blocks its violation` | `:192` | 1 | 1 compiler run | 5000ms |
| `refuses a gated package whose tsconfig cannot be read` | `:201` | 1 | none today (refused before the compiler); real checker, no fake seam | 5000ms |
| `runs the canary before any package: real canary` | `:760` | 1 | 1 compiler run on the repository canary | 5000ms |
| `runs the canary before any package: plugin removed, real compiler` | `:767` | 1 | 1 compiler run on a copied canary | 5000ms |
| `passes on the repository` | `:900` | 1 | canary and four packages | 30000ms (Pedro, 2026-10-23, measured: 7.6 s alone, 12.6-13.4 s on CI) |

The other **58 tests** inject a fake `spawn` (`fakeSpawn`, `:423`), or call the checker with `projects: []` and no canary (the waiver rows), or read one JSON file. They start no process.

Every compiler run is a `spawnSync`, so a row cannot be interrupted: Vitest reports the timeout after the row ends, and the reported time is the row's real time (5576ms, 7272ms).

### Why it fails

The unit run starts 124 files across all cores. In the 2026-11-13 failure the whole run took 40.41 s and this file 26.1 s of it, with CPU at 82-100% from the unit run alone. A row with two compiler runs then crosses 5000ms. The 5000ms was never chosen for these rows: it is Vitest's default. The one row whose time was measured (`:900`) already has its own bound.

The rows' time alone and under the unit run is now measured (M1 and M2 below): alone they are far below 5000ms, and the unit run's load multiplies them.

### Where the file is named

| Place | What it does | Effect of moving tests |
|---|---|---|
| `apps/harness/vitest.config.ts:8` | unit project include `scripts/**/*.test.mjs` | none; the unit file stays |
| `apps/harness/vitest.integration.config.ts:11` | integration include `tests/integration/**/*.test.ts`, `testTimeout: 15_000`, `maxWorkers: "50%"` | a moved `.mjs` file needs an include entry |
| `apps/harness/vitest.effect-gate-mutation.config.ts:11` | the mutation run's test set: this one file, `testTimeout: 15_000` | **must name the new file too**, or the mutation run silently loses 12 tests |
| `stryker.effect-gate.config.json` | mutates the whole `check-effect-diagnostics.mjs`, no line range | none |
| `stryker-range-anchors.json`, `check:mutation-ranges` | read only `mutate` line ranges in root Stryker configs | none: no range names the test or the script, and the checker does not read Vitest includes |
| `vitest.coverage.config.ts` | unit and integration projects together, `maxWorkers: "50%"` | the 12 rows keep running in `test:coverage` (CI Windows job) either way |
| #139 | survivors in the gate script; says "real canary" and "passes on the repository" fail inside the Stryker sandbox | unchanged, as long as the mutation config keeps all 70 tests |

### Options

| | (a) Move the 12 real rows to the integration project | (b) Explicit measured budget, rows stay | (c) Own unit project, run after the others |
|---|---|---|---|
| What changes | new `tests/integration/…test.mjs` with the 12 rows; two config includes | one timeout per row group in the test file | new Vitest project with `sequence.groupOrder: 1`, added to `unitTestProjects` |
| Budget | the integration project's existing 15000ms; `:900` keeps 30000ms | new numbers from M1/M2 | 5000ms may still be thin: two compiler runs per row |
| Follows the reclassification rule | yes | no (real processes stay in the unit run) | no |
| `pnpm check` | loses the 12 rows; gets shorter (the file was 26 s of a 40 s run) | unchanged content, same length | unchanged content, longer (the project runs after the rest) |
| Where the 12 rows still run | `test:integration` (`check:deep`, POSIX CI), `test:coverage` (Windows CI) | everywhere as today | everywhere as today |
| Main risk | contention inside the integration run (measured by M3); a missed mutation include | the unit run keeps a 26 s file with real processes; the number must be re-measured when the load changes | a new project shape in the unit run; still needs a measured budget |

**Recommendation: (a).** It is the standing rule for exactly this case, it changes no number by hand, and it shortens the fast gate.

**Why (a) is not a weakening:**
- No assertion, title or fixture changes; the 70 test names are the same multiset before and after.
- A test timeout is a guard against a hang, not something the product promises. No requirement says these rows finish in 5000ms; that value is a default nobody chose for them.
- `pnpm check` keeps its real-compiler proof: `pnpm check:effect` runs the real canary and the four packages before the unit tests, on every run.
- The 12 rows still run before every push (`check:deep`) and on both CI jobs.
- What `pnpm check` does lose: a fault in the gate script that only the real rows catch (for example, a planted error reported as clean) is found at `check:deep` instead of at `pnpm check`. That is the honest cost, and it is the same trade the rule already made for the other real-process tests.

### Measurements

None is run by the designer. Each needs the coordinator's GO under the CPU rule (readings in their own call first; no game open). M1 and M2 were run on 2026-11-14 and 2026-11-15 (results below); M3 belongs to the candidate.

| | What | Command shape | Runs | Records |
|---|---|---|---|---|
| **M1** | the file alone | `pnpm exec vitest run --project harness apps/harness/scripts/check-effect-diagnostics.test.mjs --reporter=json --outputFile=<evidence>/m1-<n>.json` | 10 | per-test duration: median and max for each of the 12 rows |
| **M2** | the file under the full unit run | `pnpm exec vitest run --reporter=json --outputFile=<evidence>/m2-<n>.json`, with the 5 s CPU sampler used for `p4-final-check-deep-2` | 10 | the same, plus the CPU samples and the file's share of the run |
| **M3** | the moved rows under the full integration run (candidate only; it cannot be run before the move) | `pnpm test:integration` with the JSON reporter | 3 | max duration of each moved row |

- **Why 10:** the flake is rare (three sightings), so ten runs will probably not reproduce it. The runs size the usual spread; the three recorded failures (7272ms is the worst) count as data points with them. About 12 minutes of machine time for M1 and M2.
- **What M1 and M2 decide:** if the rows alone are far below 5000ms and only cross it under load, the cause is contention and (a) stands. If a row alone is already near 5000ms, the default was simply too small for it, which also supports an explicit bound; the brief is then revised before approval.
- **What M3 decides (Q5):** see the decision rule in the contract.

### M1 and M2 results (main `fe4d32d`; implementer's runs, read by the designer from `m1-m2-summary.txt`)

All 20 runs exited 0 with 0 failed tests (70 per M1 run, 3991 per M2 run). No sample shows a game or a foreign test suite. M1: CPU average 28.2%, max 51%, at least 7.4 GB free. M2: CPU average 66.2%, max 100%, at least 5.4 GB free.

| Row | M1 alone: median / max (ms) | M2 under the unit run: median / max (ms) |
|---|---|---|
| planted `clean` | 939 / 984 | 2697 / 3452 |
| planted `newPromise` | 967 / 1011 | 2598 / 3136 |
| planted `unknownInEffectCatch` | 933 / 1282 | 2436 / 3191 |
| no Effect v4 (`:130`) | 385 / 435 | 1101 / 1394 |
| plugins `a rule turned off` | 341 / 610 | 834 / 965 |
| plugins `an empty list` | 199 / 249 | 451 / 570 |
| plugins `commented JSONC with a trailing comma` | 200 / 247 | 441 / 758 |
| commented gated package (`:192`) | 438 / 480 | 1152 / 1491 |
| unreadable tsconfig (`:201`) | 7 / 10 | 9 / 12 |
| real canary (`:760`) | 454 / 538 | 620 / 1021 |
| canary, plugin removed (`:767`) | 437 / 498 | 511 / 561 |
| `passes on the repository` (`:900`, 30000ms) | 8976 / 15620 | 9162 / 11960 |

- **File total:** M1 median 14517ms (14071 to 21599); M2 median 22977ms (18883 to 23572), in a unit run of median 38.6 s (run 1 took 107 s, cold).
- **The cause is contention, so (a) stands.** Alone, the slowest 5000ms row takes about 1 s (max 1282ms). The unit run multiplies the planted rows by about 2.8 (median) and up to 3.7 (max 3452ms). No row crossed 5000ms in these 20 runs: the flake was not reproduced, as expected. The recorded failures (5576ms and 7272ms) are 6 to 8 times the time alone, so the load sometimes gets about twice as bad as anything M2 saw.
- **What 15000ms means for these rows:** about 15 times the planted rows' time alone, and twice the worst time ever recorded (7272ms). The 7500ms rule of Q5 (a) sits just above that worst recorded time.
- **The fast gate:** under the unit run the 12 rows add up to about 22 s of the file's 23 s (medians), 9 s of it `passes on the repository`. The 58 remaining tests take about 1 s.
- **`passes on the repository` (Q2 unchanged):** its two maxima are the first run of each series (cold start): 15620ms alone, 11960ms under load; warm runs are 8.5 to 10.3 s. 15620ms is 52% of its 30000ms bound, and the 2026-10-23 CI measurement was 12.6 to 13.4 s. Load barely moves this row (median 9162 against 8976). This does not change Q2 (a): the bound is Pedro's measured number and the slice does not edit it. It is a note, with one consequence: M3 records this row's time in each run and the report states it, so a cold start under the integration run's load is seen, not assumed. Q5 still excludes the row.
- **Evidence:** `.rpiv/evidence/2026-11-14_16-36-18_effect-gate-test-timeouts-148/` (`m1-m2-summary.txt`, `m1-runs.tsv`, `m2-runs.tsv`, `m1-samples.csv`, the per-run JSON files; local, git-ignored).

## Decisions

- **Q1 (decided (a), Pedro, 2026-11-14): which fix?** (a) move the 12 real rows to the integration project; (b) keep them and give them a measured budget; (c) own unit project after the others. **Recommendation: (a).**
- **Q2 (decided (a), Pedro, 2026-11-14): the 30000ms bound of `passes on the repository`.** (a) it moves with the row, unchanged (it is Pedro's measured number); (b) drop it and rely on a re-measurement. **Recommendation: (a).**
- **Q3 (decided (a), Pedro, 2026-11-14): proof without a red test.** A rare timeout cannot be made red on demand. (a) accept the move as TDD-exempt, proven by the name multiset, the unchanged test bodies, the mutation test set and one sabotage that makes a moved row fail; (b) require a load-injection run that reproduces the timeout first. **Recommendation: (a)**: (b) would be a second flaky thing, and it proves nothing about lost tests, which is the real risk of a move.
- **Q4 (decided (a), Pedro, 2026-11-14): lane.** (a) fast, as `lane.mjs` answers: one approval, the coordinator checks the mechanical proofs; (b) normal, adding one independent candidate review. **Recommendation: (a).**
- **Q5 (decided (a), Pedro, 2026-11-14): rule for accepting 15000ms after the move.** (a) accept when the slowest moved row in each of the three M3 runs (other than `passes on the repository`) is at most 7500ms, half the budget; above that, stop and return to Pedro with the numbers; (b) accept any M3 run that passes. **Recommendation: (a).**
- **Rejected:** raising the unit project's `testTimeout` (it would loosen 3900 unrelated tests); retrying failed tests (`retry` hides a real hang).

## Next Slice

### Slice i148-s1-effect-gate-real-rows (on Q1 (a); fixed on M1 and M2; not executable until Pedro approves this contract)

- **`slice_id`:** `i148-s1-effect-gate-real-rows`.
- **Lane:** fast (Q4).
- **Base:** `fe4d32d` (main).
- **Deliverable:**
  - A new file `apps/harness/tests/integration/effect-gate-real-compiler.integration.test.mjs` holds the 12 tests of the table above, with the fixtures only they use (`linkEffect`, `plantedProject`, `plantedRows`, `gatedPackage` and its helpers, `canaryWithoutPlugin`, the cleanup `afterEach`). Test bodies and titles are moved text; only the import path of the checker and the two path constants (`repository`, `checker`) change.
  - `apps/harness/scripts/check-effect-diagnostics.test.mjs` keeps the other 58 tests and starts no process and no compiler.
  - `apps/harness/vitest.integration.config.ts` includes the new file by its exact path (no `.mjs` glob, so no other `.mjs` file under `tests/integration` becomes a test). It runs in the `harness-integration` project (15000ms, `maxWorkers: "50%"`).
  - `apps/harness/vitest.effect-gate-mutation.config.ts` includes both files.
  - **No shared module.** Read at `fe4d32d`, the two sets share only four small things, and the new file states its own copy of each (about ten lines in all, none an assertion):
    - `repository` (`:19`, one line);
    - `roots` and the `afterEach` that removes them (`:21`, `:24-28`). The `links` half of that cleanup (`:22`, `:26`) is used only by the moved rows and leaves the unit file;
    - `fakeRoot` (`:433-437`, five lines): the moved rows use it once, inside `canaryWithoutPlugin` (`:744`);
    - `canaryFolder` (`:713`, one path string): the moved rows use it in `canaryWithoutPlugin`; the remaining rows in `canaryOutput` and the `plugin removed` recorded row (`:735`, `:821`).
  - **Used only by the moved rows (they move, no copy stays):** `links`, `linkEffect`, `plantedProject`, `plantedRows`, `baseConfig`, `ruleOff`, `gatedConfig`, `gatedPackage`, `declared`, `overridingRows`, `canaryWithoutPlugin`, `checker`, and the imports only they need (`spawnSync`, `cpSync`, `symlinkSync`, `realpathSync`, `unlinkSync`).
  - **Everything else stays** in the unit file with the 58 tests (`expectNamedCause`, the waiver fixtures, `registerPath`, the recorded runs, `fakeSpawn`, the canary fakes).
  - The move is recorded in `.rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md`, with M1-M3.
- **Affected paths:**
  - `apps/harness/scripts/check-effect-diagnostics.test.mjs`;
  - `apps/harness/tests/integration/effect-gate-real-compiler.integration.test.mjs` (new);
  - `apps/harness/vitest.integration.config.ts`;
  - `apps/harness/vitest.effect-gate-mutation.config.ts`.
- **Not touched:** `check-effect-diagnostics.mjs`, every Stryker config, `stryker-range-anchors.json`, `package.json`, CI.
- **Full-integration exposure:** the new file runs in `test:integration` and in `test:coverage`; it is the slice's whole point, measured by M3. Windows temporary folders: the rows create and remove fresh folders, as they do today; no new real-file pattern.
- **Dependencies:** none.

## Test Contracts

#### Test Contract: i148-s1-effect-gate-real-rows

Public seam: `checkEffectDiagnostics` and the `check-effect-diagnostics.mjs` CLI, as today. The slice moves tests; it writes no new assertion.

- **Behavior G148-B1: the real-compiler rows hold in the integration project.**
  - Test: `apps/harness/tests/integration/effect-gate-real-compiler.integration.test.mjs` (new), the 12 moved tests with their titles unchanged.
  - Oracle: the moved assertions, word for word.
  - Expected red: none — pin.
- **Behavior G148-B2: the gate's classification rows hold in the unit project without a process.**
  - Test: `apps/harness/scripts/check-effect-diagnostics.test.mjs`, the 58 remaining tests unchanged.
  - Oracle: the existing assertions, word for word.
  - Expected red: none — pin.
- **TDD-exempt**: moving the 12 tests and the two includes - no product or gate behavior changes, and the fault is a rare timeout that cannot be made red on demand (Q3).

**Proofs on the candidate (each with its output recorded):**
1. **Nothing lost.** `vitest list` on the unit file gives 58 names; on the new file (integration config) 12; the sorted union equals the 70 names listed at `fe4d32d`.
2. **The mutation run keeps its tests.** `vitest list --config apps/harness/vitest.effect-gate-mutation.config.ts` gives the same 70 names as at the base.
3. **Bodies unchanged.** `git diff --color-moved=dimmed-zebra` shows the 12 tests and their fixtures as moved text. The only other changed lines are the imports, the `checker` path, the `links` cleanup leaving the unit file, and the four named copies in the new file (`repository`, `roots` with its cleanup, `fakeRoot`, `canaryFolder`).
4. **No process left in the unit file.** `rg -n "spawnSync|linkEffect|canaryWithoutPlugin" apps/harness/scripts/check-effect-diagnostics.test.mjs`: only the `fakeSpawn` comment and the fake seam.
5. **The moved rows still bite (sabotage, restored after).** In `check-effect-diagnostics.mjs`, make a run with violations answer `ok: true`: `fails on a planted Effect error: 'newPromise'` fails in the integration file.
6. **M3 and the Q5 rule.** Three `pnpm test:integration` runs (JSON reporter, coordinator's GO, CPU rule), all green; in each run the slowest moved row other than `passes on the repository` is at most 7500ms. Otherwise stop and report to Pedro with the numbers. The time of `passes on the repository` in each run is recorded and reported (no threshold beyond its own 30000ms bound).
7. **Gates.** `pnpm check` green (CPU rule), `check:duplicates` and `check:dead-code` green for the new file; the final `check:deep` before push carries the rest.

**Manual acceptance:** none.

## Deferred Work

- **Other script tests that spawn a process** (`check-golden-sql.test.mjs`, `check-stryker-ranges.test.mjs`): no timeout seen. Trigger: a first load timeout in either, or a decision to apply the rule to every script test.
- **#139:** unchanged. Trigger: the slice that reworks the gate script.
- **#122:** M1-M3 are a first recorded measurement for this file only; they do not close #122.

## Verification Notes

- A missed include in the mutation config gives no error, only fewer tests; proof 2 is the guard.
- **The four copies and the gates.** jscpd flags a clone from 10 lines and 60 tokens (`jscpd.json`); the copies are separate fragments of one to five lines, so they cannot form one. knip's harness project is `src/**/*.ts` and `tests/**/*.ts`, so it reads neither `.mjs` test file. Proof 7 runs both gates.
- **`canaryFolder` and shared-vocab-union.** The path string exists today in the gate script (`canaryProject`, `check-effect-diagnostics.mjs:188`, not exported) and in the test (`:713`), which states it on its own on purpose. The new file adds a third statement of it. One owner would mean exporting it from the gate script, which this slice does not edit (non-goal). Named here so it is a seen choice, not a silent one; the slice that reworks the gate script (#139) is the place to give it one owner.
- **Why no helper module.** It would be a fifth path for about ten lines, and the cleanup would still differ between the files (`links`). For the record: a helper not named `*.test.mjs` is matched by neither the unit include (`scripts/**/*.test.mjs`) nor the exact-path integration include, is not in any Stryker `mutate` list, and is outside knip's harness project.
- `repository` resolves with `../../../` from both folders; `checker` does not, and changes.
- The integration project already suffered load timeouts (#94); M3 is why 15000ms is checked and not assumed.
- Evidence of the failures: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-final-check-deep-2.log` and `p4-final-check-deep-2-samples.csv` (local, git-ignored).

## Developer Context

- **2026-11-14: draft written (coordinator instruction; Pedro chose #148 as the next item).**
  - Read at `fe4d32d`: the test file, the gate script's spawn points, the harness Vitest configs, the root unit, integration and coverage configs, `stryker.effect-gate.config.json`, `check-stryker-ranges.mjs`, `ci.yml`, issues #148, #122 and #139.
  - `vitest list` on the file: 70 names, 12 of them in the table above. No test was run.
  - **Approach check:** rejected a project-wide timeout raise and `retry`; weighed (a), (b), (c) above.
  - Q1-Q5 are open. No measurement has been run; the contract is provisional until M1 and M2 are recorded.
- **2026-11-14: Q1-Q5 decided (Pedro, answered to the coordinator through AskUserQuestion; relayed by the coordinator).**
  - **Q1 (a):** move the 12 real rows to the integration project.
  - **Q2 (a):** the 30000ms bound of `passes on the repository` moves unchanged.
  - **Q3 (a):** TDD-exempt, with the mechanical proofs and the sabotage.
  - **Q4 (a):** fast lane.
  - **Q5 (a):** the slowest moved row (other than `passes on the repository`) is at most 7500ms in each of the three M3 runs; otherwise back to Pedro.
  - **M1 and M2:** Pedro released them at 10 runs each; the coordinator gave the implementer the GO, on main at `fe4d32d`, evidence in `.rpiv/evidence/2026-11-14_16-36-18_effect-gate-test-timeouts-148/`.
  - **Not yet approved:** the contract is fixed when the M1 and M2 numbers are recorded here; its approval is Pedro's, asked by the coordinator then.
- **2026-11-15: M1 and M2 recorded; contract fixed (coordinator's numbers, checked by the designer against `m1-m2-summary.txt`).**
  - 20 runs, all exit 0, 0 failed tests; the flake was not reproduced. The cause is contention (about 1 s alone, up to 3.5 s under the unit run; recorded failures 5576ms and 7272ms), so Q1 (a) stands unchanged.
  - **Changed since the draft:** the measurement results section; proof 6 now says each M3 run and records the time of `passes on the repository`; the slice heading no longer says provisional. The deliverable, the four paths, the lane and Q1-Q5 are unchanged.
  - **`passes on the repository`:** 15620ms alone on a cold start (52% of 30000ms). A note; Q2 (a) is unchanged.
  - **Approval:** not yet given. Pedro approves this exact hash; the coordinator asks him.
- **2026-11-15: shared fixtures settled (coordinator's check of `72a0b805`).** The draft said a shared fixture goes in one small module, which would have been a fifth path outside the four listed. Read at `fe4d32d`: the two sets share only `repository`, `roots` with its cleanup, `fakeRoot` and `canaryFolder`. Decision: no module; the new file states its own copies. Paths stay four and the lane stays fast. The integration include names the exact file. `canaryFolder` is named under Verification Notes against shared-vocab-union.
- **2026-11-15: contract approved (Pedro, answered to the coordinator through AskUserQuestion; relayed and confirmed by the coordinator, who validated the hash before asking).**
  - **Approved:** the contract of slice `i148-s1-effect-gate-real-rows` at `content_hash` `9a8c8e9b1d330fd63af6e33cd0632b873fbeb10f7f8e1a7a7dd470f7618d02fe`. Approved copy: `.rpiv/evidence/2026-11-14_16-36-18_effect-gate-test-timeouts-148/approved-9a8c8e9b.md`.
  - **Shared fragments, decided (a):** the four small things are copied into the new file; no helper module. The third statement of `canaryFolder` is parked for #139; Pedro was told it touches shared-vocab-union.
  - **Workspace:** branch `fix/effect-gate-real-rows-148` in the main checkout, no worktree; the coordinator creates it after this record is committed.
  - **Lane label:** fast, recorded over the four paths.
- **2026-11-15: two corrections from the candidate (coordinator; implementer's proofs 1-5 pass, M3 running).**
  - **Correction to Verification Notes.** The note "`repository` resolves with `../../../` from both folders" is wrong. From `apps/harness/scripts` the repository root is `../../../`; from `apps/harness/tests/integration` it is `../../../../`. The new file's `repository` therefore differs from the unit file's by that one path, as the Deliverable already allows ("the two path constants (`repository`, `checker`) change"). The note stays as written (append-only); this line corrects it.
  - **The baseline record is outside the slice commit (coordinator's ruling).** The Deliverable says the move is recorded in `.rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md` with M1-M3; that file is not one of the four Affected paths. It is documentation: it goes in a separate docs commit after M3, not in the slice commit. The entry is drafted there now with M1 and M2, M3 left to fill, uncommitted.
- **2026-11-15: Pedro accepted `i148-s1-effect-gate-real-rows` (fast lane, combined acceptance).** Candidate `f3c89bb` (the 4 contract paths) plus the docs commit `57489a4`.
  - **Checked by the coordinator:** the M3 numbers in `m3-1..3.json` (0 failed; slowest moved row other than `passes on the repository` 1470, 1201 and 1381ms; that row 16324, 15269 and 13573ms), the three proof-7 logs, the two includes, the unchanged gate script and the kept 30000ms bound. `slice-preflight` clean; slice-verifier round 1 passed with 1 warning and no violation.
  - **V1 (warning), resolved:** the baseline record was not in `f3c89bb`. The coordinator ruled that it is documentation and belongs in a separate docs commit outside the 4 paths (`57489a4`). Pedro accepted that ruling with the slice.
  - **Proof 5 differs from the contract's words:** the contract named one failing row (`newPromise`); the sabotage failed 3 moved rows, that one among them, as predicted before the run. Accepted by Pedro.
  - **Not claimed:** the timeout was never reproduced. The proofs show margin (about 1.5 s against 15000ms), not a failure seen to stop.
  - **Polish left as is:** the copied `fakeRoot` TSDoc still says "fake" (moved text); the Constraint's wording of the reclassification rule; the #139 hand-off of `canaryFolder` sits in Verification Notes only.
  - **needs-run:** `check:deep` on main before the push, which is also the first run of the new file under the coverage config. Pedro chose to push later. Main was fast-forwarded to `57489a4` with his approval.

## References

- GitHub issues #148, #122, #139, #94 (`TheMastermindPT/slopstop`).
- `apps/harness/scripts/check-effect-diagnostics.test.mjs`, `check-effect-diagnostics.mjs`.
- `apps/harness/vitest.config.ts`, `vitest.integration.config.ts`, `vitest.effect-gate-mutation.config.ts`; `vitest.config.ts`, `vitest.coverage.config.ts`; `stryker.effect-gate.config.json`; `.github/workflows/ci.yml`.
- `.rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md` (reclassification record).
## TDD Evidence (implement)

### i148-s1-effect-gate-real-rows (2026-11-15; implementer's proofs, verified by the coordinator in the JSON and proof logs; the designer read `i148-s1-proofs.md`)

Candidate: parent `ea4e81f`, branch `fix/effect-gate-real-rows-148`, exactly the four contract paths. Evidence: `.rpiv/evidence/2026-11-14_16-36-18_effect-gate-test-timeouts-148/`.

- **TDD-exempt (Q3 (a)):** no red test; the seven proofs below stand in for it.
- **G148-B1, G148-B2 (pins):** the 12 moved tests pass in `harness-integration`; the 58 remaining tests pass in the unit file in 378ms.
1. **Nothing lost: passed.** Unit file 58 names, new file 12; the multiset equals the 70 at the base, no overlap. The whole unit run lists 3979 (3991 − 12).
2. **Mutation test set: passed.** The mutation config lists 70 names at the base and 70 on the candidate, the same multiset.
3. **Bodies unchanged: passed.** The moved blocks are verbatim. The only differing lines: the `node:path` import, the checker's import path, `repository` (`../../../../`) and `checker`; Biome collapsed the unit file's `node:fs` import.
4. **No process left in the unit file: passed.** Two `rg` hits, neither a process: the `fakeSpawn` doc comment and the recorded-run key `"canaryWithoutPlugin"`. The unit file imports no `node:child_process`.
5. **Sabotage: passed, with a difference from the contract's wording.** The contract named one row (`newPromise`). The sabotage at `check-effect-diagnostics.mjs:254` failed exactly 3 moved rows, as the implementer predicted before running it: planted `newPromise`, planted `unknownInEffectCatch` and the commented gated package. Restored by sha256; 12 passed after.
6. **M3 and the Q5 rule: met in every run.** Three `pnpm test:integration` runs, all exit 0 (85 files, 2246 passed, 6 skipped; 368.8, 381.3, 338.8 s). Slowest moved row other than `passes on the repository`: 1470, 1201, 1381ms (worst 20% of 7500ms). `passes on the repository`: 16324, 15269, 13573ms (at most 54% of 30000ms). Max per row over the three runs: `clean` 1470, `newPromise` 1433, `unknownInEffectCatch` 1406, commented gated package 740, real canary 688, canary plugin removed 683, no Effect v4 601, `a rule turned off` 545, `an empty list` 395, `commented JSONC` 323, unreadable tsconfig 18.
7. **Gates: passed.** `pnpm check` exit 0 (3979 unit tests; depcruise 599 modules); `check:duplicates` 0 clones in 547 files; knip clean. The final `check:deep` before push is still to run.
- **Baseline record:** drafted and filled in `.rpiv/artifacts/evidence/2026-10-04_vitest-coverage-worker-crash-and-gate-baseline.md`, for a separate docs commit.
- **Not claimed:** the timeout was never reproduced, so these proofs show the rows now run with a wide margin (1.5 s against 15 s), not that the old failure was observed and then seen to stop.
