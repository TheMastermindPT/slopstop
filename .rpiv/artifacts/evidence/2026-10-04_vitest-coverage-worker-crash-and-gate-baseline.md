---
date: 2026-10-04
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
status: open
tags: [testing, gate, vitest, coverage, pre-existing]
---

# Vitest coverage gate: pre-existing worker crash and baseline comparison

## Pre-existing defect: Vitest fork worker crash
- Symptom: `Error: [vitest-pool]: Worker forks emitted error` / `Caused by: Error: Worker exited unexpectedly`; the affected test file does not run, so the gate fails.
- Environment: Vitest 4.1.10, Node 24.20.0, Windows 11.
- Seen in 2 of 4 partial coverage runs of the three registration integration files: at `11b1989` (pre-Effect) it lost `registration-list.integration.test.ts`; at `667bc44` it lost `registration-bootstrap-guards` and `registered-project-selection`. Not seen in 1 full base coverage run nor in the full HEAD runs. Also seen on main's `pnpm check` (unit tests) under load on 2026-10-04.
- Classification: **pre-existing**, not caused by the Effect migration; root cause unknown (candidate class: native crash of a test process using the libSQL worker/native modules). Earlier native-handle fixes (2a "C") reduced, but did not eliminate, unexpected exits.
- Follow-up: diagnose with a bounded investigation after the merge; create a GitHub issue only when the user asks.

## Coverage gate baseline (`pnpm test:coverage`, machine free)

| Revision | Failed tests | Assertion failures | Timeouts | Duration |
| --- | --- | --- | --- | --- |
| `11b1989` (before Effect) | 187 in 11 files | ~180 (suites later fixed by the migration) | 2 test (15 s) + 3 hook (10 s) | 499 s |
| `667bc44` (Effect HEAD) | 4 in 3 files | 0 | 4 test (15 s) | ~471 s |

- The coverage gate was **never green** before the migration. The `registered-project-selection` "runtime switches between two registered Projects" timeout already existed at the base.
- The remaining four timeouts occur only with V8 coverage instrumentation and all 89 files in parallel; in isolation the same tests take ~7–11 s with coverage (HEAD 5–15% slower than base).
- User decision (2026-10-04): **option A**, i.e. reduce parallelism only for the coverage run, keeping every test, assertion, timeout and threshold. Making the heavy registration tests lighter (option C) stays as a later improvement. Raising timeouts was not chosen.
- User confirmation (2026-10-04): option C (lighter heavy registration tests) is planned **after the Effect migration and merge**, as the preferred long-term fix.

## Bounded crash diagnosis after the merge (2026-10-04, ~55 min, diagnostic only)

- Experiment 2, forced `gc()` removed from the libSQL worker client: the native `0xC0000005` crash still appeared (1 in the first run). The forced `gc()` is **not** the cause. Without it, files stay locked and the run degenerates (600+ hook timeouts), so it was stopped after ~25 min.
- Experiment 3, Vitest pool `threads` instead of `forks` (coverage on, `maxWorkers: "50%"`): 2 runs, 0 native crashes. Run 1 (674 s, 6 timeouts, coverage report failed because `coverage/.tmp` was deleted) was contaminated by a residual process from experiment 2. Run 2 (clean): 494 s, 88 files, 4148 passed / 3 skipped, 0 failures, 0 timeouts, thresholds met.
- Known: the crash is native and tied to the `forks` pool under V8 coverage. Unknown: the exact native module; whether `threads` stays stable over more samples. Deeper diagnosis (crash dumps) needs administrator rights, which the user declined.
- Option C step done: `cc4fd69` registers both Projects of the selection-switch test in one registry session (same assertions and 15 s timeout); 9.0 s -> 7.9 s without coverage, ~8.8 s -> ~8.7 s under coverage.
- User decision (2026-10-04): use pool `threads` **only** in `vitest.coverage.config.ts` (tests, timeouts, thresholds and `maxWorkers` unchanged). This works around the crash, it does not root-cause it. The next single `check:deep` run counts as the third sample; if the crash reappears, the gate is reported as broken, without reruns.
- First `check:deep` after that decision (HEAD `ac78ab6`, 562 s, machine free): `pnpm check` passed; `test:coverage` failed with 4141 passed / 1 failed / 3 skipped, 1 timeout (selection-switch test, 15018 ms) and 1 native worker crash (~9 tests lost). The output named `Worker forks`: the root `pool` key never reached the file-based projects (no `extends`), so this run was still on forks and says nothing about threads. Experiment 3 had used the CLI flag `--pool=threads`, which overrides every project. Fix: pass `--pool=threads --maxWorkers=50%` in the `test:coverage` script, as measured; same decision, implemented correctly.

## Probable cause: libsql-js worker-thread unload on Windows (2026-10-04)

- `threads` did not fix the crash: with the CLI flag confirmed active, the whole Vitest process died with `0xC0000005` after ~480 s. Reverted to forks in `3ef03c9` (`--maxWorkers=50%` kept as a CLI flag).
- The crash also occurs with the istanbul coverage provider, so it is not specific to V8 coverage. Subset runs (libSQL-only, koffi-using) did not crash in isolation.
- Known upstream defect matching the symptom: when a worker_thread that loaded the libsql addon exits, Node unloads the DLL while libsql runtime threads still run. Fixed by libsql-js PR #235 (merged 2026-09-18, verified), shipped only in `0.6.0-pre.42`/`pre.43`; the project uses `libsql` 0.5.29. A rarer double `sqlite3_close_v2` crash remains unfixed upstream.
- Production exposure: the harness also runs libSQL in worker threads, so the product may be affected, not only tests.
- User decisions: experiment A (load the addon once on each test fork's main thread, diagnostic only); if it confirms the cause, option B: upgrade to `libsql` `0.6.0-pre.43`.

## Capture and narrowing, investigation parked (2026-10-04)

- Experiment A refuted: with the addon pinned on each fork's main thread, run 3 of 3 crashed in a pinned fork. Option B therefore not taken.
- ProcDump (user level, attached only to own forks) captured the crash: read access violation in `@libsql/win32-x64-msvc/index.node` (libsql 0.5.29) at `+0x55661e`, heap address (use-after-free pattern); `koffi.node` loaded but absent from the faulting stack. Dump deleted.
- Reproduces in isolation, without coverage: `registration-identity-query-lifecycle.integration.test.ts` crashes in ~12-25% of 14 s runs. Coverage is not required.
- Findings: `@libsql/client` 0.17.4 `transaction()` detaches the connection and nothing closes it explicitly; in libsql 0.5.29 `Database.close()` only drops an `Arc`, so files are released only by GC finalizers (why the worker forces `gc()`). Explicit per-transaction close could not release the file; removing `client.close()` made crashes more frequent; libsql `0.6.0-pre.43` (rewritten, deterministic close, module pin) crashed as often or more, and its published optional dependencies use unscoped names that 404.
- Narrowing: cases "preserves cancellation instant" and "rechecks settlement" crash (~2/15 each); "does not settle late success" 0/15. No parent `terminate()` occurred in a crashing fork; the crash follows a `close-client` with no pending request (worker-side close, forced `gc()`, finalizers, or fork exit). Timing-sensitive: synchronous logging hides it.
- Unknown: exact trigger and function. Earlier full-run crashes also hit other registration files, so quarantining one file may not suffice.
- Status: investigation parked by the coordinator after the agreed limit; next cheap step if resumed: a focused dump of this file to see whether the stack is in the close/finalizer path.
