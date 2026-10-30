# TDD record: p3-s8-trace-94-oracle

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, `content_hash 9cc682a858ed332161f20db7b9ec13560b9aa7e209f058475c513af61fd91c4a`, approved copy `approved-9cc682a8.md`.
- Base: `f99b325` (s7 closed). Lane normal. Refs #129.
- Origin: the Phase 3 acceptance run 3 (`p3-acceptance-check-deep-3.log`) failed in `pnpm test:coverage`. In `apps/harness/tests/integration/trace-94.test.ts`, 6 of 14 tests failed ("#94 trace wiring in the integration configs", 3 configs × off/on). `5345b07` added `errorEqualitySetup` as the first setup file in the three integration configs; the #94 oracle still expected no `setupFiles` when off and exactly the trace setup when on.
- Pedro's decision (relayed by the coordinator): a test-only mini-slice. No Vitest config changes and nothing in `5345b07` changes. Only the wiring oracle changes, to exact values:
  - OFF: `setupFiles` is exactly `[…tests/error-equality.ts]`, and there is no `runner` key;
  - ON: `setupFiles` is exactly `[…tests/error-equality.ts, …trace-94-setup.ts]` in that order, and `runner` ends `trace-94-runner.ts`.
  - The test names stay truthful.
- Evidence folder: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/` in the main checkout (logs `p3-s8-*`).
- Predictions are written before each run and never edited; observations are appended.

## Red: prediction, written before the run

- Command: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts trace-94.test.ts`, from the worktree root at `f99b325`, with `SLOPSTOP_TRACE_94` unset.
- Prediction: exit 1, 1 file failed, **6 failed | 8 passed (14)**. The 6 are the same rows as run 3, for the same reasons:
  - the three "adds no setup file or runner to … when off" rows fail at `not.toContain("setupFiles")`;
  - the three "adds the setup file and runner to … when on" rows fail at `toMatchObject`, with received `setupFiles` `[…error-equality.ts, …trace-94-setup.ts]`.
- Any other count or reason is a stop.

## Red: observed

- `p3-s8-red.log`, parent `f99b325`: exit 1, 1 file failed, **6 failed | 8 passed (14)**. The 3 off rows fail at `not.toContain("setupFiles")` and the 3 on rows at `toMatchObject`, as in run 3. Matches the prediction.

## Green: prediction, written before the edit

- Edit (test-only, `trace-94.test.ts`): the two `it.each` rows of "#94 trace wiring in the integration configs" become exact:
  - "adds no trace setup file or runner to %s when off": `options.setupFiles` `toEqual([stringMatching(/[\/]tests[\/]error-equality\.ts$/)])`, and `Object.keys(options)` does not contain `runner`;
  - "adds the trace setup file after the error equality setup, and the runner, to %s when on": `options.setupFiles` `toEqual([…error-equality.ts, …[\/]integration[\/]trace-94-setup.ts])`, so exact length and order, and `options.runner` matches `/[\/]integration[\/]trace-94-runner\.ts$/`.
- Prediction: same command, exit 0, **14 passed (14)**.

## Green: observed

- `p3-s8-green.log`: exit 0, **14 passed (14)**. Matches the prediction. Biome formatted the file before the run.

## Bindings: prediction, written before the runs

Each binding edits one config file in place (backup first, restore by digest after the run), then runs the same command as the green. The configs are never committed changed.

- (a) `apps/harness/vitest.integration.config.ts`: `setupFiles: [errorEqualitySetup, ...]` → `setupFiles: [...]` (error equality dropped). Prediction: exit 1, **2 failed | 12 passed**. Off on `vitest.integration.config.js` fails because it receives `[]`. On on `vitest.integration.config.js` fails because it receives `[…trace-94-setup.ts]` only.
- (b) `apps/harness/vitest.trace-94.ts`: `process.env["SLOPSTOP_TRACE_94"] === "1"` → `true` (tracing always on). Prediction: exit 1, **3 failed | 11 passed**. The three off rows fail: `setupFiles` has two entries, and a `runner` key exists. The three on rows pass. The helper rows outside the wiring block do not read this module. If any of them fails too, that is recorded as an extra red with its cause.
- (c) `apps/harness/vitest.registration.config.ts`: the trace setup is put before `errorEqualitySetup`. Prediction: exit 1, **1 failed | 13 passed**, which is the on row on `vitest.registration.config.js` (order). Its off row stays green (`[…error-equality.ts]`).

## Bindings: observed

| Binding | Log | Result | Failing rows | Restore |
|---|---|---|---|---|
| (a) error equality dropped, integration config | `p3-s8-bind-a.log` | exit 1, 2 failed / 12 passed | off and on, `vitest.integration.config.js` | digest `d3600139…654c` OK |
| (b) tracing always on | `p3-s8-bind-b.log` | exit 1, 3 failed / 11 passed | the three off rows | digest `39920b11…39d4` OK |
| (c) trace setup first, registration config | `p3-s8-bind-c.log` | exit 1, 1 failed / 13 passed | on, `vitest.registration.config.js` | digest `c8f046f0…11c6` OK |

- All three match the predictions. Afterwards `git status` shows only the test file and this record.

## Gates (before the commit)

- CodeScene `code_health_score` of `apps/harness/tests/integration/trace-94.test.ts`: **10**.
- `p3-s8-dead-code.log` (`pnpm check:dead-code`, knip): exit 0.
- `p3-s8-duplicates.log` (`pnpm check:duplicates`): exit 0.
- `p3-s8-pnpm-check.log` (CPU 2.2% at 17:04:17, no League/TFT): exit 0. Vitest 118 files, 3816 tests passed; depcruise 583 modules, 0 violations.
- No `check:deep` here: acceptance run 4 needs Pedro's GO after the review.
