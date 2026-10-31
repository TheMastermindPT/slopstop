# TDD record: p3-eperm-case-rename

- Branch `fix/eperm-case-rename` in `slopstop-p3`, from local main `25780d1` (the Phase 3 squash), with Pedro's approval relayed by the coordinator. Lane normal. No issue ref: #94 is about registration timeouts under coverage (closed), not this.
- Origin: the Phase 3 pre-push `check:deep` failed one integration test. `project-storage-upgrade-recovery.integration.test.ts` > "keeps unproven upgrade leftovers quarantined: a case-variant staging prefix" hit `EPERM` on the test's own case-only rename (`:299`), right after `await stopped.stopping`. The file passed in acceptance run 4. `project-storage-upgrade-directories.integration.test.ts:261` has the same pattern and failed the same way during p3-s5a.
- Investigation (read-only, verdict B, reported to the coordinator): `stop()` settles only after the upgrade operation settles. The operation ends at the `after-staged-copy` checkpoint. The staged files are written by `VACUUM INTO` inside `withDatabase`, which awaits the worker's `db.close()`. So no product handle under `.staging-<id>` is left when `stopping` settles.
- Diagnostic, uncommitted (`p3-eperm-diagnostic.log`; CPU 17.6%, 11.17 GB free, no League/TFT). The rename was wrapped to retry and log. 20 sequential runs of the case alone: 20 passed, 0 EPERM/EACCES/EBUSY, every rename succeeded at attempt 1. The file was restored by digest (`b87ad016…ef4d3`). So the transient did not reproduce in an idle, single-case run; it appeared only under the full `check:deep` load. The coordinator's step 3 applies ("no EPERM appeared in 20 runs").
- Contract (from the coordinator): the helper `renameWhenReleased(from, to)` in `apps/harness/tests/integration` retries a rename on `EPERM`/`EACCES`/`EBUSY` up to 10 attempts, 50 ms apart, and rethrows the last error. Any other code is rethrown at once. The rename and the delay are injectable, so the rows use no real sleeps. It is used at `upgrade-recovery:299` and `upgrade-directories:261`. No product change, no timeout raised.
- Evidence folder: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/` in the main checkout (logs `p3-eperm-*`).
- Predictions are written before each run and never edited; observations are appended.

## Red: prediction, written before the run

- New `apps/harness/tests/integration/rename-when-released.ts`, a deliberate no-retry stub: `renameWhenReleased(from, to, io = nodeIo)` calls `io.rename(from, to)` once. It has the final signature, so the red is behavioural, not an import error.
- New `apps/harness/tests/integration/rename-when-released.test.ts` (it runs in `harness-integration`, like `trace-94.test.ts`), 5 rows with a fake `io` that records renames and delays:
  1. `it.each` over EPERM, EACCES and EBUSY: "renames once Windows releases the files after two %s failures". The fake fails twice with that code, then succeeds. It resolves, with 3 renames and delays `[50, 50]`.
  2. "rethrows the last EPERM after 10 attempts". The fake always fails with EPERM, and after 20 calls throws a distinct non-transient sentinel, so an unbounded loop answers the wrong error. It rejects with the 10th EPERM error (`toBe`), with 10 renames and 9 delays of 50.
  3. "rethrows any other failure at once": ENOENT rejects with that error, with 1 rename and no delay.
- Command: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts rename-when-released.test.ts`.
- Prediction against the stub: exit 1, **4 failed | 1 passed (5)**. Rows 1 (×3) reject with the first failure. Row 2 rejects with the 1st EPERM, not the 10th, and with 1 rename. Row 3 passes.

## Red: observed

- `p3-eperm-red.log`: exit 1, **4 failed | 1 passed (5)**. The three release-code rows rejected with the attempt-1 error ("instead of resolving"). The 10-attempt row received `EPERM on attempt 1.`, not attempt 10 (`Object.is`). The other-failure row passed. Matches the prediction.

## Green: prediction, written before the edit

- `renameWhenReleased` loops: it attempts the rename; on failure it rethrows when `attempt >= 10` or the error's `code` is not in `{EPERM, EACCES, EBUSY}`, otherwise it awaits `io.delay(50)` and tries again. The code is read with `Reflect.get(Object(error), "code")`.
- Prediction: same command, exit 0, **5 passed (5)**.

## Green: observed

- `p3-eperm-green.log`: exit 0, **5 passed (5)**. Matches the prediction.

## Call sites

- `project-storage-upgrade-recovery.integration.test.ts:299` and `project-storage-upgrade-directories.integration.test.ts:261` now call `renameWhenReleased`. The recovery file's `rename` import is removed, because `:299` was its only use. The directories file keeps `rename`, because `:230` still renames a project root, which is out of scope. Biome check of the folder: no fixes.

## Bindings: prediction, written before the runs

Each binding edits `rename-when-released.ts` in place (backup first, restore by digest), then runs the green command.

- (1) no retry: the catch rethrows every error. Prediction: exit 1, **4 failed | 1 passed**, the same rows as the red.
- (2) wrong code set: `EBUSY` dropped from the set. Prediction: exit 1, **1 failed | 4 passed**, the EBUSY row.
- (3) unbounded loop: the `attempt >= maxAttempts` bound dropped. Prediction: exit 1, **1 failed | 4 passed**, the 10-attempt row. It rejects with the attempt-11 ENOTSUP sentinel, which is not the 10th EPERM, so there is no hang.

## Bindings: observed

| Binding | Log | Result | Failing rows | Restore |
|---|---|---|---|---|
| (1) no retry | `p3-eperm-bind-1.log` | exit 1, 4 failed / 1 passed | three release-code rows, 10-attempt row | `f696d799…d961` OK |
| (2) EBUSY dropped | `p3-eperm-bind-2.log` | exit 1, 1 failed / 4 passed | the EBUSY row | `f696d799…d961` OK |
| (3) bound dropped | `p3-eperm-bind-3.log` | exit 1, 1 failed / 4 passed | the 10-attempt row | `f696d799…d961` OK |

- All three match the predictions.

## Gates (before the commit), each after its own CPU reading with no League/TFT

- CodeScene `code_health_score` is 10 on `rename-when-released.ts`, `rename-when-released.test.ts`, `project-storage-upgrade-recovery.integration.test.ts` and `project-storage-upgrade-directories.integration.test.ts`.
- `p3-eperm-dead-code.log`: knip exit 0. `p3-eperm-duplicates.log`: 0 clones, exit 0 (CPU 12.1%).
- `p3-eperm-pnpm-check.log`: exit 0, 118 files, 3816 tests; depcruise 585 modules, 0 violations (CPU 10.7%).
- `p3-eperm-call-sites.log`: the two call-site files run alone, 2 files, 15 passed, exit 0 (CPU 4%).
- No `check:deep` here: the coordinator runs the pre-push.
