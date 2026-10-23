# Writer-state "hang": diagnosis

Date: 2026-10-23. Checkout: main at `262c5e5`. Tracked files unchanged. File under test: `apps/harness/tests/integration/canonical-command-repository-writer-state.integration.test.ts`.

## Verdict

**Test-only slowness under disk contention, not a product hang.** Both rows are not "< 1 s" work. Each row runs many cases one after another and creates a fresh SQLite fixture for each case: 17 fixtures in "validates and advances generation-2 Writer state" and 10 in "verifies and releases only the current durable Writer fence". Each fixture seeds its database by running the canonical migrations with `DatabaseSync` on the test's main thread, in autocommit mode. That makes about 40 fsync-bound transactions per fixture. The 30 s bound is therefore a budget for 10-17 fsync-heavy seeds, and it runs out when other files compete for the disk, as they do in `check:deep`.

Limit: no 30 s timeout was reproduced in 10 runs. The classification rests on the instrumentation below: with the machine loaded, no single operation ever waited more than 1.9 s, and the rows slowed roughly in proportion to the extra disk load. A hang that only appears under the full `check:deep` mix is not excluded by these runs; see "What would settle it".

## Evidence

Runs: the single file alone in the `harness-integration` project (`vitest.integration.config.ts`). The coordinator authorized running while Pedro played. CPU (3 readings) and game processes are in the first line of each log. Raw logs, traces, the scratch instrumentation and the benches are in the gitignored `.rpiv/evidence/2026-10-23_writer-state-hang/`.

| Run | Condition | CPU % | validates | verifies | Longest single wait |
|---|---|---|---|---|---|
| r01 | plain file, League client open | 33/12/20 | (tests 10.7 s total) | | not instrumented |
| r02 | plain, verbose | 60/47/58 | 5 921 ms | 3 177 ms | not instrumented |
| r03 | instrumented | 38/37/33 | 5 571 ms | 3 601 ms | 528 ms (fixture create) |
| r04-r08 | instrumented, TFT match running | 29-97 | 6 245-7 386 ms | 3 322-5 600 ms | 711 ms (fixture create) |
| r09 | instrumented + 4 fsync loaders | 76-87 | 17 629 ms | 9 796 ms | 1 068 ms (fixture create) |
| r10 | instrumented + 4 fsync loaders | 68-69 | 23 305 ms | 17 890 ms | 1 900 ms (fixture create) |

The instrumentation, a scratch copy of the test that has been deleted:
- It timed every worker-client request (open, execute, begin, commit, close), every fixture create and dispose, and every synchronous helper (`mutate`, `rows`, `snapshot`).
- A 1 s watchdog logged any operation in flight for more than 2 s, plus main-thread event-loop stalls.

What it showed:
- **Worker requests never wait.** There are 601 requests per run. The slowest is always the first `PRAGMA foreign_keys = ON`, which includes the shared worker's start: 202-511 ms. No request was ever in flight for more than 2 s, even under load.
- **Fixture creation dominates.** It takes 300-700 ms per fixture with the game running and up to 1.9 s with the loaders. It blocks the main thread: the event-loop p99 is 325-530 ms, and 1.6-1.75 s under load.
- **The `STILL WAITING` lines are whole case loops,** such as `rejectPriorStates` (12 fixtures), never one operation.

Seed breakdown (`bench/seed-bench.mjs`, a copy of `seedCanonicalDatabase` plus the fixture root, 20 iterations, game running):

| Step | Default p50 / max | `synchronous=OFF` p50 / max |
|---|---|---|
| migration 0000 | 23 / 90 ms | 4 / 9 ms |
| migration 0001 (about 40 statements, autocommit) | 286 / 420 ms | 66 / 245 ms |
| `project_state` insert | 10 / 25 ms | 2 / 5 ms |
| mkdtemp, read, open, close, rm | 1-2 ms each | same |

Copying a seeded template instead (`bench/copy-bench.mjs`): **p50 21 ms, max 115 ms**, against about 320 ms for a seed.

## Mechanism

1. Every case calls `fixture()`, and `seedCanonicalDatabase` runs `0000` and `0001` with `DatabaseSync.exec` on a new file. Each DDL statement commits on its own, and each commit flushes to disk (default `synchronous=FULL`).
2. One row runs 10-17 fixtures in sequence inside one `it`, so its 30 s bound covers about 10-17 × (seed + activation).
3. In `check:deep`, the `harness-integration` project runs with `maxWorkers: "50%"` next to other SQLite-heavy files, and Windows Defender scans new `%TEMP%` files. Disk flushes queue up behind them, the per-fixture seed grows from about 0.3 s to 1.5-3 s, and the row reaches 30 s.
4. Even when "alone" (no game), the run is not alone on the disk inside `check:deep`, so the observation fits the same mechanism.

C5 in `2026-10-23_ci-red-diagnosis-2.md` has the same shape: rows that build many real SQLite stores in sequence hit their bounds under load. This diagnosis suggests C5's "20-60× slower" may partly be fsync contention, not CPU.

## Proposed fix (test-only)

- **F1, recommended (small: one fixture file, about 15 lines).** In `canonical-command-repository-fixture.ts`, seed the canonical database once per test file into a template, then `copyFile` it into each fixture root. The precedent is `storage-root-template.ts` from #94 (`copyFromTemplate`). The existing rows stay unchanged as the oracle. Expected effect: about 27 × 300 ms of main-thread fsync work drops to about 27 × 20 ms per run. The `canonical-command-repository-faults` file, which shares the fixture, benefits too.
- **F2, optional (medium).** Split the multi-case rows into `it.each` rows (prior drifts, release instants, stale cases, broken queries), so each case has its own bound and a failure names its case. This changes the test layout, so a reviewer should see it.
- **Not recommended:** raising the 30 s bound (AGENTS.md: never weaken a gate), or `synchronous=OFF` alone. It gives 4× and is cheap, but the template removes the seed cost entirely.
- **No product change.** No product path waited in any run: the worker client, the activation, the fence verification and the release all answered quickly.

## What would settle it

- One `check:deep` (or `test:integration`) run with `SLOPSTOP_TRACE_94=1` and these two rows. If a timed-out row shows its time spread over fixture creates, as here, F1 is the fix. If it shows one request in flight for the whole bound, that is a real wait: reopen the diagnosis on the worker broker.
- Alternatively: F1 first, then rerun `check:deep`. If these rows keep timing out after the seed cost is gone, the cause is something else.
