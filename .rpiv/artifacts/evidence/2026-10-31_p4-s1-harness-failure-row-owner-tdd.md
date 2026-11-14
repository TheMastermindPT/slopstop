# TDD record: p4-s1-harness-failure-row-owner

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, `content_hash 16db782f36c301c9e17d5411a3e98f673c1aa513363cf9e3a26fa8d3ec7a68d6`; `validate-artifact: OK`; append-only against the main checkout's `approved-16db782f.md`: keep (exit 0).
- Worktree `slopstop-p4`, branch `fix/arch-review-phase-4`, base `0fc425c` (docs-only after the brief's `d34a025`). Lane normal. Defender exclusion confirmed by Pedro before `pnpm install`.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` in the main checkout (`p4-s1-*`). Each log carries the parent commit and the worktree patch digest.
- Predictions are written before each run and never edited; observations are appended.

## Baseline (P4-B3, before any source edit)

- `p4-s1-baseline-b3.log`: `pnpm exec vitest run src/project-conversation-protocol.test.ts src/protocol.test.ts` in `packages/protocol`: exit 0, 2 files, **133 passed (133)**.

## Red P4-B1 and P4-B2: prediction, written before the run

- New `packages/protocol/src/harness-failure-protocol.test.ts`, 14 rows: P4-B1 3 direct rows plus 6 table rows (`Object.values(table)` `toContainEqual(harnessFailureRow(code))`); P4-B2 5 rows through `decodeWithIssues` (the strict policy): own row decodes to itself; changed message, `retryable: true`, changed code each answer exactly `[{ code: "invalid_value", path: [<field>] }]`; an extra key answers `[{ code: "unrecognized_keys", path: [], keys: ["extra"] }]`.
- No source edit. `harness-failure-protocol.ts` exports neither `harnessFailureRow` nor `exactRowSchema`. Every call happens inside a row body, so collection succeeds.
- Command: `pnpm exec vitest run src/harness-failure-protocol.test.ts` in `packages/protocol`.
- Prediction: exit 1, **14 failed (14)**, each with a `TypeError` that the missing export is not a function (Vitest's module runner yields `undefined` for a missing named export). A file-level load error instead would be a mismatch: stop and report.
- Note on the brief's binding 1 ("every P4-B1 row fails"): with the contract's oracle the six table rows compare against `harnessFailureRow(code)` itself, and the tables are built from that owner, so a `retryable: true` owner moves both sides. Binding 1 is therefore predicted to turn exactly the 3 direct rows red, not 9. Binding 3 covers the table rows.

## Red P4-B1 and P4-B2: observed

- `p4-s1-red.log`: exit 1, **14 failed (14)**. Every row failed with `TypeError: harnessFailureRow is not a function` (the P4-B2 rows reach `harnessFailureRow` in their row builder before `exactRowSchema`). Collection succeeded. Matches the prediction.

## Green P4-B1 and P4-B2: prediction, written before the edit

- `harness-failure-protocol.ts` exports `harnessFailureRow(code)` (the same body as the two copies) and `exactRowSchema(row)` (the `rowSchema` body, generic over any `Readonly<{ code: string; message: string; retryable: boolean }>` row).
- `project-upgrade-protocol.ts` and `project-conversation-protocol.ts` import both and delete their copies; their `rowSchema` calls become `exactRowSchema`. `index.ts` is not touched.
- Prediction: `pnpm exec vitest run src/harness-failure-protocol.test.ts`: exit 0, **14 passed (14)**. P4-B3: `pnpm exec vitest run src/project-conversation-protocol.test.ts src/protocol.test.ts`: exit 0, **133 passed (133)**, unedited, as at baseline.

## Green P4-B1 and P4-B2: observed

- `p4-s1-green.log`: exit 0, **14 passed (14)**. `p4-s1-green-b3.log`: exit 0, **133 passed (133)**, test files unedited. Matches the prediction.

## Red P4-B3 (Q7 (a)): prediction, written before the run

- Edit only `apps/harness/scripts/check-stryker-ranges.test.mjs`, the real-repository row: `stryker.config.json` `wholeFiles: 33` becomes `34`. No config edit yet.
- Command: `pnpm exec vitest run scripts/check-stryker-ranges.test.mjs` in `apps/harness`.
- Prediction: exit 1, **1 failed**, only "passes on the repository's own configs and anchors", its diff showing `wholeFiles` expected 34, received 33 for `stryker.config.json`. Every other row passes.

## Red P4-B3 (Q7 (a)): observed

- `p4-s1-stryker-red.log`: exit 1, **1 failed | 40 passed (41)**: "passes on the repository's own configs and anchors", with `wholeFiles` expected 34, received 33. Matches the prediction.

## Green P4-B3 (Q7 (a)): prediction, written before the edit

- `stryker.config.json` `mutate` gains `"packages/protocol/src/harness-failure-protocol.ts"` right after `project-conversation-protocol.ts`.
- Prediction: the same command exits 0, **41 passed (41)**; `pnpm check:mutation-ranges` exits 0.

## Green P4-B3 (Q7 (a)): observed

- `p4-s1-stryker-green.log`: exit 0, **41 passed (41)**. `p4-s1-mutation-ranges.log`: `pnpm check:mutation-ranges` exit 0, "stryker.config.json 19 ranges, 34 whole files". Matches the prediction.

## Bindings: prediction, written before the runs

Each binding edits one file in place (backup first, restore checked by digest), then runs `pnpm exec vitest run src/harness-failure-protocol.test.ts` in `packages/protocol`.

1. `p4-s1-bind-1`, owner `harnessFailureRow` answers `retryable: true`: exit 1, **4 failed | 10 passed (14)**: the 3 "builds the … row" rows, and "rejects a retryable row" (the owner's own row is now retryable, so the change is a no-op and decodes). The 6 table rows pass, because the tables are built from the same owner (see the note under the first red prediction); the brief's "every P4-B1 row fails" does not hold for them.
2. `p4-s1-bind-2`, `exactRowSchema` types `message` as `Schema.String`: exit 1, **1 failed | 13 passed (14)**: "rejects a changed message" only.
3. `p4-s1-bind-3`, `project-upgrade-protocol.ts` keeps a local `harnessFailureRow` whose message is `` `${code}.` ``: exit 1, **3 failed | 11 passed (14)**: the 3 "the upgrade diagnostics carry the owner's … row" rows only.

## Bindings: observed

1. `p4-s1-bind-1`: exit 1, **4 failed | 10 passed (14)**: the 3 "builds the … row" rows and "rejects a retryable row". Restored by digest (`34474794…39a4`). Matches the prediction.
2. `p4-s1-bind-2`: exit 1, **1 failed | 13 passed (14)**: "rejects a changed message". Restored by digest (`34474794…39a4`). Matches.
3. `p4-s1-bind-3`: exit 1, **3 failed | 11 passed (14)**: the 3 upgrade table rows. Restored by digest (`0783c614…46a5`). Matches.

## Format and gates

- Biome reformatted two touched files (line wrapping in the new test and in `project-upgrade-protocol.ts`); no logic change. `p4-s1-green-after-format.log`: the slice test plus P4-B3 files, exit 0, **147 passed (147)**.
- Structural checks: `rg -n "function (harnessFailureRow|rowSchema|exactRowSchema)" packages/protocol/src` lists only `harness-failure-protocol.ts`; `index.ts` names neither helper.
- `pnpm --filter @slopstop/protocol typecheck`: clean. CodeScene 10 on `harness-failure-protocol.ts`, its test, `project-upgrade-protocol.ts`, `project-conversation-protocol.ts` and `check-stryker-ranges.test.mjs`.
- `p4-s1-check.log`: `pnpm check` **exit 1**, run on Pedro's direct order while League/TFT was open (23 processes; CPU 34-50% before, 88.1% after; 4.3 GB free). 3 failed | 3827 passed (3830), all 5000 ms timeouts in files the slice does not touch: `project-conversation.test.tsx` CNV-B31 (5136 ms) and `check-effect-diagnostics.test.mjs` planted rows `unknownInEffectCatch` (11515 ms) and `newPromise` (15951 ms). Reported to the coordinator; no timeout raised.
- `p4-s1-check-2.log`: after Pedro closed the game and said it was free (one reading: CPU 9.1% then 3.2%, 13.7 GB free, no League/TFT), `pnpm check` **exit 0**, 119 files, **3830 passed (3830)**, 36.81 s. Same tree (same patch digest as the first run).
- `p4-s1-knip.log`: `pnpm check:dead-code` exit 0. `p4-s1-duplicates.log`: `pnpm check:duplicates` exit 0.
