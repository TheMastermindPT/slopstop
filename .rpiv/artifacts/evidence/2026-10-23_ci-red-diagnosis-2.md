# CI red diagnosis 2: integration layer (2026-10-23, issue #142)

- Scope: diagnosis, read-only in code (gh logs and code), bounded (about 45 min). Issue #142.
- Source: run 39952793922 (`c3898ef`). Jobs:
  - 120411137407 (Ubuntu deep check, failing step `pnpm check:deep:portable`, inside `test:coverage`);
  - 120411138149 (Windows, step `Run harness integration tests`).
- Older Windows runs for "since when": 37333441934 (`95e2c85`), 37931475806 and 38075348284. Raw logs: session scratchpad `ci2/` and `ci/`, not committed.
- Local probes:
  - eight single-test runs (one `-t` row each, 1-5 s), no suite, no heavy run;
  - each probe set `TEMP`/`TMP` to a probe folder, `C:\Users\pedro\AppData\Local\Temp\slopstopprobe8dot3` or its 8.3 alias `SLFA5E~1`;
  - the probe folders were deleted afterwards;
  - outputs are `ci2/probe*.txt`.

## Bottom line

- **Never green on CI.** All 17 failing files were added after the last green push `59fb35b` (2026-09-04): first added 2026-09-10, last 2026-10-10. Ubuntu never reached this layer before `15862fd`, because the unit stage failed first. Windows has had most of the same failures since `95e2c85`.
- **Four causes. Three are test environment, and one is open.** (C2 and C4 also leave a product question for Pedro.)

| # | Cause | Kind | Files (Ubuntu U, Windows W) | Fix size |
|---|---|---|---|---|
| C1 | `mkdtemp(tmpdir()/opencode/…)`: the `opencode` parent exists only if `project-registration.integration.test.ts` ran first (it alone does `mkdir … opencode`), or on a machine where another tool created it (Pedro's machine has `%TEMP%\opencode`) | test environment / order dependence | U5: project-list-runtime, registration-list, registration-identity-query, registration-identity-query-lifecycle, registration-visibility-upgrade. W2: registration-preparation (17/17), project-list-runtime | small: one shared helper that does `mkdir(parent, { recursive: true })` before `mkdtemp`, used by about 20 call sites in harness integration and desktop e2e; or drop the `opencode` segment |
| C2 | Windows runner `tmpdir()` is the 8.3 short path `C:\Users\RUNNER~1\…`; the product canonicalizes roots (`realpathSync.native` in `process-bootstrap.ts`) to `C:\Users\runneradmin\…` | runner path shape; exposes a product question (see C2) | W: project-conversation-runtime (6 fast "broken" rows), project-upgrade-runtime (2), registered-project-selection (5, with EBUSY/timeout follow-ons), registration-identity-phase (2), canonical-writer-package-smoke (93), project-conversation-runtime-busy (2) | CI: 2 lines (`TEMP`/`TMP` = `${{ runner.temp }}`); or tests use `realpath(tmpdir())`; or the product fix (a slice) |
| C3 | Git version hard-coded `2.53.0.windows.1` (the local install); runner has `2.56.0.windows.2` | machine assumption | W: project-registration (2 rows, native Windows observer) | small: assert against the version read from `git --version` on the host, or a pattern |
| C4 | POSIX file semantics on Linux: an open SQLite handle does not block remove/rename; names differing in case are distinct | platform assumption (Windows file locking, case-insensitive names) | U4: project-storage-upgrade-directories (2 rows), project-storage-upgrade-failure (1), project-storage-upgrade-recovery (1), project-upgrade-runtime (1) | small: those rows `runIf(win32)`; product question below |
| C5 | Timeouts at their bounds under full CI load, not reproduced in isolation | open: contention or hang, not linear slowness | W: canonical-project-settlement (9 rows), project-conversation-runtime (5 rows at 30-40 s), possibly follow-ons in registered-project-selection and package-smoke | see C5 |

## C1: the `opencode` temp parent

- Ubuntu: `ENOENT: no such file or directory, mkdtemp '/tmp/opencode/pc-…'` (13 rows in 5 files).
- Windows: the same error under `C:\Users\RUNNER~1\AppData\Local\Temp\opencode\…`, in registration-preparation (17/17 rows) and project-list-runtime.
- Only `project-registration.integration.test.ts:116` creates the parent. A file passes only when that file ran earlier in the same run, or when the machine already has the folder.
- Locally, `C:\Users\pedro\AppData\Local\Temp\opencode` exists; it belongs to another tool, not to SlopStop. That is the same masking pattern as the stray `effect` install in diagnosis 1.
- Fix: a shared `tempRoot(prefix)` helper that creates the parent first. The `opencode` name looks like it was copied from an agent sandbox convention; dropping it is equally fine. Size: about 20 call sites, mechanical. Red: delete the local `%TEMP%\opencode` (Pedro's call; it may belong to the opencode tool) and run one of those files alone.

## C2: 8.3 short temp path on the Windows runner (proven locally)

- Evidence from CI:
  - `registration-identity-phase` expects `C:/Users/RUNNER~1/AppData/Local/Temp/opencode/…/main/.git` and receives `C:/Users/runneradmin/AppData/Local/Temp/…`;
  - the log shows 65 `RUNNER~1` occurrences.
- Local proof: one row per file, same folder, with `TEMP` set to its long name and then to its 8.3 alias `SLFA5E~1`.

| Row | Long name | 8.3 alias |
|---|---|---|
| project-conversation-runtime "reads null, then the saved messages" | pass | fail: `Activation failed: … PROJECT_STORAGE_BROKEN "Project Storage activation failed."` (the CI error) |
| canonical-writer-package-smoke "rejects a retained live Writer" | pass | fail |
| registered-project-selection "runtime reopens the same registered generation" | pass | fail |
| project-upgrade-runtime "upgrades a migration-required Project through the harness" | pass | fail |

- Explains the 93 package-smoke failures. They are the same 93 on every Windows run since `95e2c85`: deterministic, so the cause is the environment and not load.
- **Product question (Pedro):**
  - The product answers `broken` for a valid alias of a real folder. Real users rarely have 8.3 paths, but a short path can arrive (old tools, `%TEMP%` on some accounts, a user typing `PROGRA~1`).
  - Under `degrade-distinguishes-broken`, `broken` is at least not a false clean. Whether an alias should be accepted (canonicalized once at the boundary) or refused with a clear diagnostic is a product decision.
  - The test-side fixes make CI honest either way.
- Side note: one probe with `TEMP` under the deep session scratchpad (about 150 characters) failed differently (`status: 'unavailable'` in `createCurrentProject`). It looks like a long-path limit. Not traced; worth a separate check if real Project paths can be that deep.

## C3: hard-coded Git version

- `project-registration.integration.test.ts:329` and `:1000` expect `2.53.0.windows.1` (added in `c92171c`, 2026-09-26). The runner has `2.56.0.windows.2`.
- Fix: compare with the host's `git --version`, or with a version pattern. Small.

## C4: POSIX semantics on Ubuntu

- **Held handle.** The rows hold a `DatabaseSync` (or file handle) open and expect `ProjectStorageUnavailable … "Project Storage is busy"`.
  - On Linux an open file can be removed or renamed. The removal succeeds ("promise resolved instead of rejecting"), the next opening is `ready` instead of `unavailable`, and the logged event is `abandoned` instead of `discard-failed`/`busy`.
  - Rows: `upgrade-directories` "adapter, held handle"; `upgrade-recovery` "owner, held handle"; `upgrade-failure` "a busy staged copy…"; `upgrade-runtime` "a busy discard".
- **Case variants.** `upgrade-directories` "adapter, retained or case-variant target" expects a refusal when a case-variant name (`…0000FA` next to `…0000fa`) exists, and expects `.staging-…fa` to survive.
  - On a case-sensitive file system they are two distinct names. The product removes the staging folder and resolves.
- Fix: run these rows only on win32. Small, about 5 rows.
- **Product question:** SlopStop is also packaged for Linux (CI builds `SlopStop-linux-x64`).
  - On Linux, "busy" (a held file) cannot be detected by remove/rename failure.
  - On macOS (case-insensitive by default) the case-variant rule may matter again.
  - Whether these guarantees need a POSIX design (for example advisory locks) is Pedro's call. It is not a CI fix.

## C5: Windows timeouts (open)

Measured durations (CI = this run; local = Pedro's machine):

| Row | CI | Local |
|---|---|---|
| settlement "durably rejects commands with the production empty registry" | timed out at 15 000 ms | 743 ms (probe, today); passes under the 8.3 alias too |
| settlement, 7 other rows | timed out at about 25 000 ms | whole file 13.8 s (`#94` run6, `36f032f`, 2026-10-11); CI whole file 249.3 s |
| conversation "maps an injected storage failure…" (seam b), 3 siblings | timed out at about 40 000 ms | 690 ms (probe); passes under the 8.3 alias too |
| conversation "keeps message identity after a switch…" | timed out at 30 000 ms | 1 259 ms (#94) |
| whole unit suite (`pnpm check` vitest) | 82.7 s | 28.8 s (today) |

- The general CI slowdown is about 2.9× (the unit suite). These rows are 20-60× slower, at exactly their bounds, so they look like waits that never finish (contention, or a hang behind a held lock), not slow work.
- They do not reproduce in isolation with or without the 8.3 path. They run in the `harness-integration` project (`maxWorkers: "50%"`, 2 workers on the 4-vCPU runner), next to the C2 files that fail with broken activations and leave handles behind (one EBUSY on `rmdir` is visible in registered-project-selection).
- Recommendation: fix C1-C3 first and re-measure. Some C5 rows may be follow-ons of broken runs in a parallel file.
- **Options if timeouts remain (nothing changed now):**
  1. Per-test bounds. Not recommended blind: a 20-60× ratio is not covered by a bigger bound, and it would hide a hang.
  2. Lower CI concurrency: `maxWorkers: 1` for `harness-integration` on CI only. This costs wall time (the step already takes 1 271 s; the job limit is 35 min).
  3. A larger runner (paid, 8+ vCPU).
  4. One diagnostic CI run with `trace94TestOptions` on, uploading its trace as an artifact, to see what the timed-out rows wait on. This is the cheapest way to tell contention from a hang.

## Per-file table

| File | Job | Fails | Class | Since |
|---|---|---|---|---|
| project-list-runtime | U, W | 1/1 | C1 | file added 2026-10-03; W red since `95e2c85` |
| registration-list | U (W earlier) | 2/5 | C1 | added 2026-10-03 |
| registration-identity-query | U | 2/7 | C1 | added 2026-10-02 |
| registration-identity-query-lifecycle | U | 9/9 | C1 | added 2026-10-02 |
| registration-visibility-upgrade | U | 1/1 | C1 | added 2026-10-05 |
| registration-preparation | W | 17/17 | C1 | added 2026-10-02; W since `95e2c85` |
| project-storage-upgrade-directories | U | 2/4 | C4 (case and held handle) | added 2026-10-06 |
| project-storage-upgrade-failure | U | 1/31 | C4 | added 2026-10-06 |
| project-storage-upgrade-recovery | U | 1/11 | C4 | added 2026-10-06 |
| project-upgrade-runtime | U 1/21 (C4); W 2/21 (C2, proven) | | C4 / C2 | added 2026-10-06 |
| registration-identity-phase | W | 2/6 | C2 | added 2026-10-02; W since `95e2c85` |
| registered-project-selection | W | 5/9 | C2 (proven) + EBUSY/timeout follow-ons | added 2026-10-03; W since `95e2c85` |
| canonical-writer-package-smoke | W | 93/149 | C2 (proven) | added 2026-09-12; the same 93 since `95e2c85` |
| project-conversation-runtime-busy | W | 2/5 | C2 (likely: same fixture and error, not probed) | added 2026-10-10 |
| project-conversation-runtime | W | 11/23 | 6 × C2 (proven), 5 × C5 | added 2026-10-10; W since `38075348284` |
| project-registration | W | 2/110 | C3 | rows from `c92171c` (2026-09-26) |
| canonical-project-settlement | W | 9/105 | C5 | added 2026-09-10; first seen red in this run |

## Proposed order

1. C1, C2 (test or CI side) and C3: one small test-only fix slice. This should take most of both jobs to green.
2. C4: `runIf(win32)` on the listed rows, plus a product decision on POSIX guarantees.
3. Re-run CI. Then measure C5 with a trace run before choosing between concurrency and a larger runner.
4. C2 product question: accept and canonicalize 8.3 aliases, or refuse them clearly. Pedro decides.
