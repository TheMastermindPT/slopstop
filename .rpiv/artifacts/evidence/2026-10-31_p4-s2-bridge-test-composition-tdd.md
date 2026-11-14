# TDD record: p4-s2-bridge-test-composition

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, `content_hash efa6d2f0ed77f72d027c3e977b1f0c1f3ffd00270290a55dfa4559b0f29d9b5f`; `validate-artifact: OK`; append-only against `approved-efa6d2f0.md`: keep.
- Worktree `slopstop-p4`, branch `fix/arch-review-phase-4`, rebased onto main `73bacf3`; p4-s1 is `ab56351` on top (same patch as the accepted `8f7e883`). The desktop source at `ab56351` equals `19b6166` (p4-s1 touched no desktop file). Lane normal.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` in the main checkout (`p4-s2-*`).
- P4-B4 and P4-B5 are pins (Expected red: none). The bindings prove the oracles bite. Predictions are written before each run and never edited.

## Command correction

- The Success Criteria command `pnpm --filter @slopstop/desktop exec vitest run src/main/...` finds no files: `apps/desktop/vitest.config.ts` is the `desktop-renderer` project (`src/renderer/**`). `p4-s2-baseline.log`: exit 1, "No test files found". The main-process tests are in `vitest.main.config.ts` (`desktop-main`). Every run below adds `--config vitest.main.config.ts` in `apps/desktop`; the file list is the brief's.

## Baseline (before any edit)

- `p4-s2-baseline-2.log`: exit 0, **5 files, 210 passed (210)**.

## Pins after the test edits: prediction, written before the edit

- Edits, tests only first: `setup` and `scripted` (entry), both `bridgeWith` (storage, workspace) and the supervisor row build through `createHarnessBridges`. Storage and workspace keep `bridgeWith` returning the bridge (so the other rows stay unedited) over a new `bridgesWith` that returns the bundle; the five P4-B5 rows and the supervisor row take `release` from the bundle. Oracles exactly as P4-B5 1-5.
- Prediction: the same 5-file command, exit 0, **210 passed (210)**, against unchanged source (factories still present but no longer called from these tests).

## Pins after the test edits: observed

- `p4-s2-pins-tests.log`: exit 0, **210 passed (210)**. Matches. `git diff -U0` shows only the helpers (`setup`, `scripted`, `bridgesWith`/`bridgeWith` in storage and workspace, the supervisor row's construction and cleanup), the imports, and the five P4-B5 rows with the oracle changes listed in the brief.

## TDD-exempt deletion: prediction, written before the edit

- Delete the three factories, `ProjectStorageBridgeOptions`, `WorkspaceBridgeOptions`, and the now-unused `makeHarnessRequestCore` and `HarnessSessionClient` imports in the three bridges. The three `…BridgeOver` TSDocs lose the "standalone bridge ends its private core" clause; `afterStop` stays.
- Prediction: the 5-file command, exit 0, **210 passed (210)**; the three structural `rg` checks print nothing / only `harness-request-core.ts` and `harness-bridges.ts`; desktop typecheck clean.

## TDD-exempt deletion: observed

- `p4-s2-after-delete.log`: exit 0, **210 passed (210)**. Structural: check 1 (factories and option types in `apps/desktop`) prints nothing; check 2 (`makeHarnessRequestCore` outside tests) lists only `harness-request-core.ts:78` and `harness-bridges.ts:1,27`; check 3 (`standalone` in the three bridges) prints nothing. `pnpm --filter @slopstop/desktop typecheck` clean. Matches.

## Bindings: prediction, written before the runs

Each edits one file in place (backup, restore checked by digest) and runs `pnpm exec vitest run --config vitest.main.config.ts <file>` in `apps/desktop` on the brief-named oracle's file.

1. `p4-s2-bind-1`, `project-storage-bridge.test.ts`: `bridgesWith` returns the standalone composition (`projectStorageBridgeOver(core, clock, core.unsubscribe)` over `makeHarnessRequestCore(session)`, with `release` = that bridge's `stop`). Run on the storage file: exit 1, **1 failed**: "rejects mismatched, uncorrelated, disconnected, and stopped requests" (`unsubscribeCalls` 1, expected 0). Oracle 2 passes under this binding (its release is a standalone stop: throws, settles with the stopped text, one unsubscribe). Every other storage row passes.
2. `p4-s2-bind-2`, `harness-bridges.ts`: the workspace bridge gets `core.unsubscribe` instead of `keepCore`. Run on the workspace file: exit 1, **2 failed**: "stops once and rejects later requests without observing the session" (`listenerCount` 0, expected 1) and "settles pending work even when session unsubscribe throws" (`unsubscribeCalls` 2, expected 1: the bridge's stop and `release()` each unsubscribe; the fake counts every call). Every other workspace row passes.
3. `p4-s2-bind-3`, `harness-bridges.ts`: `release()` unsubscribes and runs `failAll` before the bridge-stop loop. Run on the storage file: exit 1, **1 failed**: "settles pending operations even when session unsubscribe throws" (`pending` settles with the transport text, not "Project Storage bridge is stopped."). Every other storage row passes.

## Bindings: observed

1. `p4-s2-bind-1`: exit 1, **1 failed | 14 passed (15)**: "rejects mismatched, uncorrelated, disconnected, and stopped requests", `expected 1 to be +0` at `project-storage-bridge.test.ts:364`. Restored (`572faa52…fa42`). Matches.
2. `p4-s2-bind-2`: exit 1, **2 failed | 30 passed (32)**: "stops once and rejects later requests without observing the session" (`expected +0 to be 1`, `:476`, the `listenerCount`) and "settles pending work even when session unsubscribe throws" (`expected 2 to be 1`, `:1059`). Restored (`a3d852ad…e9b7`). Matches.
3. `p4-s2-bind-3`: exit 1, **1 failed | 14 passed (15)**: "settles pending operations even when session unsubscribe throws", the `pending` answer differs (`:312`). Restored (`a3d852ad…e9b7`). Matches.

## Stryker re-anchoring: prediction, written before the run

- No config edited yet. `pnpm check:mutation-ranges` exits non-zero and names the five moved entries (`desktop-s7` `project-entry-bridge.ts:80-235`, `project-storage-bridge.ts:38-167`, `workspace-bridge.ts:101-271`; `stryker.config.json` `project-entry-bridge.ts:103-103`, `:189-202`), because their anchor lines no longer sit at the recorded lines. No other entry is named.

## Stryker re-anchoring: observed (step 1)

- `p4-s2-ranges-red.log`: exit 1, `STRYKER_RANGE_BROKEN`, naming only the three `desktop-s7` entries ("ends past the file's last line": 225, 151, 257). **Mismatch with the prediction: the two `stryker.config.json` entries were not named.** Explained by the checker, not by the slice: `checkStrykerRanges` collects every problem but reports only the first non-empty code in its order (`check-stryker-ranges.mjs`, `codeOrder.find(...)`), and `STRYKER_RANGE_BROKEN` comes before `STRYKER_RANGE_DRIFT`. Step 2 makes the hidden drift visible.
- Anchors located by content in the edited files: `desktop-s7` entry first `:78`, its closing `}` of `projectEntryBridgeOver` at `:224` (the file's last line, `:225`, is the `ProjectEntryBridge` type); storage `:30-151`; workspace `:93-257`; `stryker.config.json` `:101-101` and `:187-200`. The brief predicted `:78-223` for the entry range; the content says `:224`.

## Stryker re-anchoring: prediction, step 2, written before the edit

- Re-point only the three `desktop-s7` entries (config and `stryker-range-anchors.json` `entry`, anchor texts unchanged) to `project-entry-bridge.ts:78-224`, `project-storage-bridge.ts:30-151`, `workspace-bridge.ts:93-257`.
- Prediction: `pnpm check:mutation-ranges` exit 1, `STRYKER_RANGE_DRIFT`, exactly two lines: `stryker.config.json: apps/desktop/src/main/project-entry-bridge.ts:103-103 moved to apps/desktop/src/main/project-entry-bridge.ts:101-101` and `… :189-202 moved to … :187-200`.

## Stryker re-anchoring: observed (step 2)

- `p4-s2-ranges-red-2.log`: exit 1, `STRYKER_RANGE_DRIFT`, exactly the two predicted lines (`:103-103` moved to `:101-101`, `:189-202` moved to `:187-200`). Matches.

## Stryker re-anchoring: prediction, step 3, written before the edit

- Re-point the two `stryker.config.json` entries (config and anchors) to `:101-101` and `:187-200`.
- Prediction: `pnpm check:mutation-ranges` exit 0 with `stryker.config.json 19 ranges, 34 whole files` and `stryker.desktop-s7.config.json 7 ranges, 2 whole files` (counts unchanged); `check-stryker-ranges.test.mjs` unedited, 41 passed (41).

## Stryker re-anchoring: observed (step 3)

- `p4-s2-ranges-green.log`: `pnpm check:mutation-ranges` exit 0, `stryker.config.json 19 ranges, 34 whole files`, `stryker.desktop-s7.config.json 7 ranges, 2 whole files`. `p4-s2-ranges-test.log`: `check-stryker-ranges.test.mjs` unedited, exit 0, **41 passed (41)**. Matches.
- Final entries: `desktop-s7` `project-entry-bridge.ts:78-224`, `project-storage-bridge.ts:30-151`, `workspace-bridge.ts:93-257`; `stryker.config.json` `project-entry-bridge.ts:101-101`, `:187-200`. Anchor texts unchanged. No test file moved, so the mutation Vitest configs are untouched.

## Gates

- `p4-s2-codescene.log`: CodeScene 10 on the three bridges and the four test files.
- CPU read in its own call before the run: 11.4% and 14.5%, 12.8 GB free, no League/TFT.
- `p4-s2-check.log`: `pnpm check` exit 0 (format, lint, typecheck on the four packages, check:effect, check:mutation-ranges, unit, boundaries), 119 files, **3830 passed (3830)**, 35.65 s.
- `p4-s2-knip.log`: `pnpm check:dead-code` exit 0. `p4-s2-duplicates.log`: `pnpm check:duplicates` exit 0.
- Integration exposure: none in production (only `createHarnessBridges` composes the bridges, unchanged). Knip and the `desktop-main` unit project carry the change; e2e and `package:launch-smoke` are left to the Phase 4 final `check:deep`.
