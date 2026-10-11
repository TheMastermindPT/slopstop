---
date: 2026-10-10T23:30:00+0100
updated: 2026-10-11
author: Pedro Mesquita
repository: slopstop
branch: feat/94-instrumentation
commit: b679dce
status: fix-candidate
tags: [evidence, measurement, tests, timeouts, load, issue-94]
---

# #94 — Integration tests that time out under load: cause, proof and options

## Bottom line

- **Cause.** The stall-type timeouts reproduced here (2b runs 1-2, 4a) come from **CPU starvation by concurrent work on the same machine**. On this evidence they are not a hang in the code. Some Step 0 stalls at idle (O10/E3, O2/O8) are not explained by this and stay open.
  - A read-only `rg`/`git` burst (the same tool Claude Code agents use to search) saturates every core: 40-100 threads wait for a CPU.
  - Windows shares CPU per thread, so the few threads of a Vitest fork and its SQLite worker get about 1.5% of the machine instead of about 11%.
  - The canonical fixtures' production Storage create then stretches from about 0.3 s to about 13 s, and the tests cross the 15 s budget.
- **Proof.**
  - The same commit passes on a quiet machine, with and without coverage (2a, 2b run 3, 2c).
  - It shows outliers of up to 26x while other agents ran repository searches (2b).
  - It fails with **18 real 15 s timeouts during a controlled synthetic burst, all inside the burst window**, while a control run minutes earlier was clean (4a).
- **Second population.** About 13 registration tests take 5-7 s on a quiet machine (up to 7.8 s with coverage). That leaves about 2x headroom, so any sustained load pushes them toward 15 s.
- **Open.**
  - A code-level contention defect (H1, a 5 s busy wait on the single SQLite worker thread) is not shown by any trace and is not needed to explain the failures, but it is not excluded. Production tracing (P2) would settle it.
  - The real-agent burst was inferred, not measured.
- **Timeouts were not changed.** Remedy options with cost and effect are in the "Options for the user" section.
- **Fix chosen by the user (decisions log §47, §49, §50).**
  - (c) seeded templates for canonical and package-smoke fixtures, plus the cwd fix;
  - D1, a manual clock for the native deadline observer case;
  - the instrumentation stays in the repository, off by default;
  - d-P1 (a migration-resource cache) was measured and dropped.
  - Results are in "Outcome" at the end. Native-long runs about 2.6x faster with an identical pass list, and the 18 burst timeouts of the canonical families no longer occur.

## Method

- **Instrumentation** (branch `feat/94-instrumentation`; after the rebase onto main 9ff3810: aafc4df, 6f04ae1, 720751e, 36d814c, 0d75435, 6c5913f. Before the rebase these were 51eed5f, 365a502, 10e599a, 8c111f6, c857040, 3e00bad, the ids that the raw run logs carry).
  - Test-side only, off unless `SLOPSTOP_TRACE_94=1`, byte-for-byte unchanged behaviour when off (proved in `trace-94.test.ts`).
  - Pieces: per-test phase spans (runner), event-loop delay, an abort dump at the 15 s mark with every step in flight, late-settle events, timed transport exchanges (registration), timed SQLite calls on fixture-owned clients, step markers around the canonical and package-smoke fixture setup, and the real envelope behind "X missing" guards.
- **Load measurement.** `typeperf` at 1 s (CPU, processor queue, disk queue, free memory). From 2c on, a per-process CPU sampler every 2 s: top 10 processes with command lines; its own cost was 0.38% of the 12 logical cores.
- **Run logs.** Each run log carries commit, changed-path count, patch sha256, CPU at start and a note: `registered-project-selection.integration.test.ts` differs structurally from main dfa8d9d (helper extraction in 10e599a, no assertion change), so its durations are not compared naively with history.
- **Raw evidence** (local, not in Git): `.rpiv/evidence/2026-10-10_94-measurements/` in the main checkout. It holds batch folders `2a/ 2b/ 2c/ 4a/` (run logs, Vitest JSON, traces, typeperf and sampler CSVs, process snapshots), the batch scripts, the per-step reports, the Step 0 study and the Step 1 check logs.
- **Tools** (in Git): `.rpiv/artifacts/evidence/2026-10-10_94-tools/`, holding the sampler and the burst script. The analysis scripts stay with the raw evidence.
- **Process.** Every batch ran only with the coordinator's go-ahead.

## Proof

### 2a — registration lane, quiet machine, 4 runs (3 traced, 1 untraced)

- 238/238 four times, no timeout.
- 13 tests above 5 s, 2 above 7 s, none above 10 s. Worst headroom 2.07x.
- Two kinds:
  - **Timer-bound and flat across runs:** the native observer deadline at 7.19-7.25 s, and the identity-query cleanup at about 5.5 s.
  - **Work-bound and moving with load:** registration-list, flow-outcomes, preparation. One went from 2.5 s to 5.6 s in the loaded run.
- **The registration confirm step** (`project.registration.result/registered`) is the costliest single exchange: about 1.7-1.9 s. Every other exchange has a p50 of about 45 ms.
- Hooks are negligible: at most 40 ms.
- The tracing overhead was not measurable, because the untraced run happened to be the loaded one (CPU p90 78%).

### 2b — native-long lane, 4 runs (3 traced, 1 untraced)

- 1133/1133 four times.
- **Outliers of 10-26x their own baseline in runs 1 and 2**, and many 5-10x rows in run 4. Examples:
  - package-smoke "rejects impossible row corruption…": 12458 ms against 471-600, leaving 1.20x headroom;
  - S6 G4 lookup baseline rows: up to 7996 ms against about 400;
  - "requires seconds in settlement clocks…": 5393 ms against about 390.
- **Every run 1 and 2 outlier sat in seconds with CPU at 100% and 43-106 threads waiting.**
  - **Run 4** had 13 rows at 5-10x their median in the other three runs, taking 2.0-3.8 s:
    - canonical-command-repository "rolls back known settlement body faults…": 3451 ms against 356 (9.7x) and 2130 against 387;
    - package-smoke "refuses real legal database corruption…" rows: 3849 against 482 (8.0x), then 3337, 3257, 3008 and 2665 against 471-512;
    - S6 G4 lookup baseline 'rejections' rows: 3047 against 375 (8.1x), then 2319, 2188, 2109, 2064 and 2027 against 380-394.
  - CPU for each row comes from `typeperf-2b.csv`, over the row's own seconds:
    - the two command-repository rows sat at 83-100% CPU with 42 and 54 threads waiting, i.e. saturated;
    - the other rows sat at 37-93% with 0-21 waiting.
    - Run 4's whole-run CPU p90 was 91.
    - So run 4 shows a smaller starvation effect under partial load, not saturation for every row.
  - The untraced run 3 had CPU p90 41, max 58, and no outlier.
- The coordinator matched those windows to the rpiv designer's S4 review: 4 reviewer agents plus claim verifiers, reading the repository with ripgrep and git.
- **Trace:** in every slow canonical test, the traced SQLite calls were short (top 10-360 ms). The time, 2.1-6.1 s, went before the first traced call, inside the fixture's production Storage create, open and stop.

### 2c — both lanes plus the `pnpm test:coverage` shape, coverage on, every other agent paused

- Registration ×2 (238/238), native-long ×2 (1133/1133), then the full coverage run: 4774 passed, 5 skipped, 3 failed.
- **The 3 failures were a defect in the instrumentation's own test** (`trace-94.test.ts`): it was not isolated from a traced lane. They were fixed in 3e00bad and are not #94 timeouts.
- **Zero outliers** (above 5x the quiet median and above 2 s), and no test above 10 s.
- Coverage cost: registration median 1.16x (max 1.49x); native-long 1.01x.
- Sampler: no rg or git in any sample. The only non-test process was an Effect tsgo LSP at 2-3%.
- Raw files of 2c runs 1-2 were overwritten by a script error in 4a (disclosed below). Their numbers (238/238; 199.8 s and 200.3 s; CPU p90 45 and 43; worst headroom 1.93x) come from the analysis taken before the overwrite. Their trace files survived.

### 4a — controlled burst, native-long lane, traced

- **Control run (C):** quiet, 1133/1133 in 261 s, CPU p90 30.
- **Synthetic burst run (S):** 4 loops of `rg -n --no-ignore "Effect"` over the main checkout plus 2 loops of `git log --stat -200`, read-only, from T+60 s for 180 s.
  - Result: **1115 passed, 18 failed, all "Test timed out in 15000ms"**: 9 G6 "rejects corrupted replay children…" and 9 S6 G4 B11 "rejects corrupt uncertainty evidence…".
  - **All 18 aborts fall inside the burst window**, none before or after it.
  - At abort:
    - 6 had the fixture's `canonical-db.create` in flight for about 15.0 s;
    - 9 had `canonical-db.open` in flight, after a slow create;
    - 3 had a settlement call in flight.
  - **Every abandoned step finished later** (late-settle events): create 14.9-16.1 s, open 1.0-2.8 s. So the steps were slow, not stuck.
  - `canonical-db.create` in the burst: p50 13.1 s, against about 0.29 s at idle.
  - Burst window: CPU 100% at p50 and p90; processor queue p50 42, max 97; disk not saturated.
  - Sampler: rg 13.8% against node (the tests) 1.5% per sample. Outside the burst in the same run, node had 11.6%. The sampler itself was starved, with 30 samples instead of about 90.
  - No EBUSY appeared. Earlier gate EBUSY failures follow a timeout: the abandoned body still holds `application.db` while `afterEach` deletes the folder.
- **Agent burst (A): not run.** The stop rule ended the batch after S, and the coordinator then judged S sufficient. **That real agents produce the same effect is inferred, not measured.** It rests on three facts: Claude Code's search tool is ripgrep, the 2b outliers line up with the designer's review window, and S reproduces the mechanism.

## Mechanism in plain terms

ripgrep starts one thread per core per process. Four concurrent searches give 40-50 runnable threads on 12 logical cores. Windows shares CPU per thread at equal priority. A Vitest fork plus its single SQLite worker thread are only a few threads, so they get a few percent of the CPU. Work that takes 0.3 s on a quiet machine then takes over 13 s.

That is a starvation ratio, not "the machine is 2x busier". It explains stalls far larger than a CPU multiplier when concurrent searches run, as in 2b runs 1-2 and 4a.

It does **not** explain every Step 0 observation. The 96x before-metadata stall (O10, E3) ran at idle, on branch code 05a0e99 with a different authority. O2 and O8 failed with stall-type rows while little load was found. Those stay open below.

## Remaining open questions

1. **H1, a code-level contention defect, is not excluded.**
   - `canonical-command-repository.ts:150-161` sets `busy_timeout 5000` on the connection that runs `BEGIN IMMEDIATE`.
   - The worker answers one request at a time on a synchronous `DatabaseSync`.
   - So if another transaction on the same worker holds the write lock, the BEGIN can only end by waiting 5 s and failing with `SQLITE_BUSY`.
   - No trace shows this, and the 4a timeouts are fully explained by starvation. The test side cannot see inside the worker. Production trace P2 would settle it (proposal: `2026-10-10_94-measurements/i94-production-trace-proposal.md`).
2. **The real-agent burst** is inferred (see 4a).
3. **The tracing overhead** was never measured cleanly. No slowdown was visible.
4. **The registration authority join path (H2)** was not exercised by a stall in any run. It stays unobserved, neither confirmed nor excluded.
5. **Stalls without visible load (Step 0).**
   - O10 (E3, before-metadata, about 96x) happened at 1-3% CPU on branch code 05a0e99, whose authority differs from main.
   - O2 and O8 showed stall-type rows with little load found.
   - None of these was reproduced in 2a-4a. Load at their failing minute was never measured. Starvation does not account for them; H1 and H2 remain the candidates.

## Other findings

- **cwd fragility (pre-existing).**
  - `canonical-writer-package-smoke.integration.test.ts:45` uses `path.resolve("apps/harness/drizzle")`, which resolves against the process cwd.
  - Run from `apps/harness`, Storage create answers "broken" and all 135 seed-based cases fail in 2-5 ms. Proved on the clean 8c111f6.
  - Gates and batches run from the root, so they were unaffected.
  - Fix with the #94 fix slice: `path.resolve(import.meta.dirname, "../../drizzle")` or the shared `checkedInMigrationRoot`.
- **Possible order dependence: not established.** A `-t` subset of package-smoke failed the same way, but it ran from the wrong cwd, and the subset was not re-run from the root. With the right cwd the full file passes 149/149.
- **Main-thread blocks of 0.46-0.69 s in some registration tests** (event-loop delay). Likely synchronous `execFileSync(git init)` and test-side `DatabaseSync`. Not verified, and not a cause of timeouts.
- **Earlier side notes, still open.**
  - The standalone authority from `registry-database.ts:59-67` is never stopped by `registration-registry.ts:180-194`.
  - `exchange()` in `registration-flow-fixture.ts` waits for a reply with no deadline.
  - The `ApplicationDatabase` Layer has no finalizer (#123).

## Disclosures

- **4a script error.** The 4a batch script was derived from the 2c script by `sed`, and its `OUT` variable still named the 2c folder. 4a wrote into `2c/`.
  - It overwrote the raw `.log`, `.json` and process snapshots of 2c runs 1-2, and the 2c `batch.log`. The 2c traces for runs 1-2 survived: mixed files were split by wall time.
  - The coordinator decided no re-measure.
  - Future batch scripts take the output folder as an argument and refuse a folder that already holds run files.
- **One Step 1 check went over its 2-minute cap.** A broad `-t "S6 G4"` filter was cut at 115 s by my own `timeout`. No orphan process was left.

## Options for the user

Each option lists its cost and its effect. They can be combined. Timeouts stay untouched unless the user decides otherwise.

**(a) Run heavy lanes only when no agent fan-out runs.** This attacks the cause directly; 2c and 4a show a quiet machine has no stalls.
- **(a1) A written rule** for agents and the coordinator, partly in place already: the user's memory now says "ask the coordinator before any agent fan-out; never while heavy tests run".
  - Cost: none in code. Effect: depends on discipline; human error stays possible.
- **(a2) A lock file the gates check.** `pnpm check:deep`, `test:coverage`, `test:integration` and the push hook create `.slopstop-heavy.lock`, and agents' fan-out tooling refuses to start while it exists.
  - Cost: a small script plus a hook in agent tooling, and it needs a way to enforce it on agents.
  - Effect: strong for the agents we run. It does nothing for other processes such as browsers or OneDrive.
- **(a3) A pre-flight CPU check before heavy lanes.** Sample the processor queue for about 5 s and refuse or warn when it is above a threshold, for example a p90 above 8.
  - Cost: a small script, false refusals on a busy machine, and it does not stop load that starts after the check.
  - Effect: catches the 2b pattern at the start.
- Recommendation: a1 now, plus a3 as a warning. a2 if fan-outs keep colliding.

**(b) Agents search at lower priority or with fewer threads.**
- Options: `rg --threads 2`, or running agent tools below normal priority (`start /belownormal`, Job objects).
- Cost: slower agent searches. Claude Code's built-in search may not expose a thread setting, so it may need a wrapper or a config change. Not verified.
- Effect: removes the starvation ratio. 4 rg processes × 2 threads = 8 threads, or lower-priority threads that yield to tests.
- It treats the mechanism. It does not cover load from other sources.

**(c) Lighter canonical fixtures.**
- Change: create one seeded canonical database per file or worker, a template, and copy it per test, instead of a full production Storage create, open and stop per test.
- Cost: a test-infrastructure change in about 4 fixture files. It must keep any test that really verifies Storage creation on the real path. It needs a review that it does not weaken what those tests prove.
- Effect: removes about 0.3 s per test at idle and most of the starved work. Starvation would stretch a 15 ms file copy, not a 300 ms multi-step create, so the 4a timeouts would likely become passes. Not measured.

**(d) The slowdown population** (about 13 registration tests at 5-7 s idle; 2x headroom).
- Options:
  - reduce per-test work: each work-bound test performs one or more full registrations, and the confirm step costs about 1.8 s;
  - split long tests;
  - make timer-bound tests use shorter injected deadlines where the oracle allows.
- Cost: test changes, each reviewed for oracle strength; timer-bound ones need care.
- Effect: more headroom against any load. It does not address starvation-class stalls on its own.

**(e) Production tracing P2** (worker connection, BEGIN wait, broker pending).
- Cost: opt-in code in `local-libsql-worker-client.ts`, a hot file covered by mutation runs, plus a measurement batch under contention.
- Effect: confirms or excludes H1, the only open code-level hypothesis.
- Recommended only if the user wants certainty before closing #94. The current evidence does not require it.

## Recommended order (for discussion)

1. a1 now, plus the cwd fix and c in the #94 fix slice.
2. a3 or b next.
3. d as a follow-up on the registration lane.
4. e only if wanted.

## Outcome (2026-10-11)

Raw logs for this section, local and not in Git, are under `.rpiv/evidence/2026-10-10_94-measurements/` in the main checkout. Paths below are relative to it:
- `ba/`: the before/after batch, runs 1-7, with Vitest JSON, traces, typeperf, sampler, batch.log and the burst log;
- `fix/`: equivalence, mutation, cwd, D1 and single-file logs, plus step0.log and the step 0 script;
- `step1-checks/`: the pre-fix cwd failure logs.

### Commits

The branch was rebased onto local main 9ff3810, which changed docs only. The code is identical to the pre-rebase head a5c6f21: the only diff is `.rpiv/` documents from main. The raw logs carry the pre-rebase ids shown in brackets.

| change | commit (pre-rebase) |
|---|---|
| (c) canonical template + relocation + equivalence test | 11803f3 (7736505) |
| (c) package-smoke seed template + cwd fix | 0af8402 (36f032f) |
| D1 manual clock for the deadline case | b679dce (a5c6f21) |

### (c) Template, then copy

- **How it works.** `createCanonicalCommandDatabase` builds one real template per (extended, Project) per test file. Each use gets a whole-root copy.
- **A finding.** application.db records `storage_locations.normalized_path = path.resolve(projectRoot)`, an absolute path. A plain copy therefore opens as broken. The copy relocates that one column, which is what a real create at that path writes.
- **Equivalence proof.** `canonical-database-template.integration.test.ts` (4 cases) checks a template copy against a real create:
  - the same file set;
  - the same schema and rows in every database, with root paths replaced by a token;
  - the same payload when opened through the real Storage runtime.
  - Note: with the extra conformance table, the real create also opens as safe-mode/DATABASE_BROKEN, and the copy matches that.
- **Mutations.** Three mutations bind the test: no relocation, an altered row, a missing file. Per-case results, rerun after round 1 with full logs: see "Equivalence mutations (round 1 rerun)" below.
- **package-smoke.** The seed (create, activation, two writer generations, second receipt) is built once per file. Each case gets a copy and a fresh client.
- **cwd fix.** `migrations` now uses `checkedInMigrationRoot`. The file passes 149/149 from the repo root and from apps/harness (`fix/after-smoke-final.log`, `fix/after-smoke-from-harness.log`). Before, it failed from apps/harness: the saved log `step1-checks/pa-smoke-off.log` shows the `-t` subset with 67 failed as "broken". The full-file count of 135 failed was read from the session output; that log was overwritten by a later run. A saved rerun of the pre-fix commit c91d464 from apps/harness reproduces it: 135 failed, 14 passed, with Storage answering "broken" (`fix/cwd-prefix-from-harness.log`, round 1).
- **Assertions.** None removed: the expect counts per file are equal. The canonical fixture's 2 creation expects now run once per template per file, not once per test.

### Equivalence mutations (round 1 rerun)

- **Logs:** `fix/round1/`. Each mutation log carries the head (b740504 plus the staged round-1 fixes), the patch sha256, the command, verbose per-case output and the mutation diff. Every mutated file was restored from a backup with an equal digest.
- **Green before the mutations:** the equivalence test 4/4, the package-smoke file 149/149, and pnpm check, jscpd and knip all exit 0.
- The equivalence test also asserts byte-equal files, all except application.db (round 1, B2).

| mutation of `storage-root-template.ts` | files/rows (ext. true) | files/rows (ext. false) | open (ext. true) | open (ext. false) |
|---|---|---|---|---|
| M1 no relocation | fail | fail | fail | fail |
| M2 altered row (`storage_registrations.activated_at`) | fail | fail | fail | fail |
| M3 missing `.json` files | fail | fail | fail | fail |
| M4 one byte appended to a copied `.json` | fail | fail | pass | pass |

M4 shows that the byte-equality check catches a change the open path does not see.

### Before/after (quiet machine, traced, 2026-10-11 00:33-00:55 UTC)

Logs: `ba/run1-6.log` and `.json`; the pass-list and per-family figures were computed from those JSON files; load data in `ba/typeperf.csv` and `ba/cpu-processes.csv`.

| lane | before (7ff05de) | after (36f032f) |
|---|---|---|
| native-long | 306.1 s, 281.6 s | **118.4 s, 106.3 s** |
| harness-integration | 98.4 s | **73.3 s** |

- **Pass list.** native-long had the same 1100 test names, all passed. harness-integration had the same 630 names plus exactly the 4 new equivalence cases; the same 2 were skipped.
- **Per family** (sum of test time; median per test):

  | family | before | after | median before → after |
  |---|---|---|---|
  | package-smoke | 70 s | 22 s | 460 → 101 ms |
  | canonical-writer-reconciliation | 199 s | 46 s | 393 → 87 ms |
  | canonical-command-repository | 149 s | 28 s | 420 → 69 ms |

### Burst rerun

Logs: `ba/run7.log`, `ba/run7.json`, `ba/run7-trace/` (abort dumps), `ba/run7-burst.log` (window 00:51:56-00:55:02 UTC).

The same synthetic burst as 4a ran on the after commit. CPU was 100% and the processor queue p50 was 48.

- **Canonical families.** The 18 G6 and S6 G4 B11 timeouts of 4a did not recur.
- **7 timeouts remain**, all inside the burst window:
  - 6 conversation busy tests (conversation-store-busy ×4, project-conversation-runtime-busy ×2). They are timer-bound and take 3.6-9.2 s idle by design, so they have 1.6-1.9x headroom.
  - package-smoke "characterizes real Storage Q creation…". The first `seed()` builds the template inside that test, so it pays for a real seed plus its own real create. This is a known residual. The coordinator decided not to move the build into `beforeAll`.
- **Conclusion.** Under a 4-way rg burst, any test that takes more than about 3-5 s idle can still cross 15 s. Only (a) or (b) removes that class; (c) and (d) shrink it.

### D1

- The "preserves the deadline trigger when native cleanup cannot be proved" case now runs its 2 s deadline and 5 s cleanup budget on the existing manual observer clock.
- It went from **7433 ms to 417 ms** (`fix/d1-before-one.log`, `fix/d1-after-one.log`). project-registration.integration.test.ts passes 110/110 (`fix/d1-final.log`), and its assertions are unchanged.
- The real-time 2 s deadline stays covered by `observeHeldDeadline`.
- `manualClock` moved to `registration-manual-clock.ts`, to break a dependency cycle.

### Step 0 and d-P1 (dropped, §50)

Per-open cost of getting the application migrations (200 iterations, idle):

| variant | p50 per open |
|---|---|
| full load (today) | 3.09 ms |
| Effect-cached parse | 0.001 ms |
| cached parse plus a per-open digest of the resource folder | 3.06 ms |

The cold first load took 26.5 ms. Log and script: `fix/step0.log`, `fix/step0-migration-load.ts`.

- **Why dropped.** One registry open costs about 50 ms idle, so the cache would save about 6%: about 0.25-0.3 s per registration-flow test. It would also move resource verification from every open to once per process.
- **Migration resources are immutable by convention only.** When packaged they are an `extraResource` outside the ASAR, not covered by ASAR integrity. In dev, every harness build re-copies them.
- **The user dropped d-P1.** The remaining registration cost is the per-open verification (d-P2, not chosen), the number of opens per step, and the git identity children.

### Still open

- H1, a code-level contention defect: not excluded; P2 production tracing would settle it.
- The real-agent burst: inferred, not measured.
- The tracing overhead: not measured cleanly.
- The (a)/(b) remedies: not chosen now.
- The slowdown population: the registration flow tests still take 4.5-6 s idle, and the conversation busy tests 3.6-9.2 s.
- H2, the registration authority join path: never exercised by a stall, so neither confirmed nor excluded.
- Step 0 stalls without visible load (O10/E3 at idle on branch code, O2/O8): not reproduced and not explained by starvation; see open question 5.
