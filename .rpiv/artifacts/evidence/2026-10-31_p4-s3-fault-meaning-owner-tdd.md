# TDD record: p4-s3-fault-meaning-owner

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, `content_hash b716fee421125d63300872be2d01435922dd9ca16744aff49b150da31fb56dae`; `validate-artifact: OK`; append-only against `approved-e1e4976b.md`: keep. Q12 (a).
- Worktree `slopstop-p4`, branch `fix/arch-review-phase-4`, rebased onto main `a0ca406`: p4-s1 is `2d57bc0`, p4-s2 is `ab33543`. Both have the same `git patch-id --stable` as before the rebase, so the desktop and protocol source equal the brief's base `3f80587`. Lane normal.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` in the main checkout (`p4-s3-*`).
- Desktop main-process runs use `--config vitest.main.config.ts` (p4-s2 command correction).
- Predictions are written before each run and never edited.

## Baseline: prediction, written before the run

- `p4-s3-baseline-bridge`: `pnpm exec vitest run --config vitest.main.config.ts src/main/project-entry-bridge.test.ts` in `apps/desktop`: exit 0, every row passes. The count observed here is the P4-B8 reference.
- `p4-s3-baseline-protocol`: `pnpm exec vitest run src/harness-failure-protocol.test.ts` in `packages/protocol`: exit 0, **14 passed** (3 + 6 + 1 + 3 + 1).

## Baseline: observed

- `p4-s3-baseline-bridge.log`: exit 0, **111 passed (111)**. This is the P4-B8 reference count.
- `p4-s3-baseline-protocol.log`: exit 0, **14 passed (14)**. Matches.

## P4-B6 red: prediction, written before the run

- Test edit only: `harness-failure-protocol.test.ts` imports `harnessFailureRows` from `./index.js` and adds the brief's rows: key set (1), each code against `harnessFailureRow` (3), each code against each diagnostics table's row with that code (6), `Object.isFrozen` (1); 11 new rows.
- `p4-s3-b6-red`: same protocol command: exit 1, **11 failed, 14 passed (25)**. Reason: `harnessFailureRows` is `undefined` (not exported), so `Object.keys(undefined)` throws, `undefined[code]` throws a TypeError, and `Object.isFrozen(undefined)` is true in ES2015+... 
- (Continuation of the line above, appended before the run; the line is not edited.) `Object.isFrozen(undefined)` returns true, because a non-object counts as frozen. So the frozen row **passes** under this red. The other 10 rows fail with a TypeError: `Object.keys(undefined)` and `undefined[code]`. Final prediction: exit 1, **10 failed, 15 passed (25)**.
- The frozen row gets its own red in the green step: first the export is added without `Object.freeze`, which should give exactly that row failing (1 failed, 24 passed); then the freeze is added.
- The 6 table rows use `find` by `code`, which is exact because each table has exactly one row per harness code (`project-upgrade-protocol.ts:62-64`, `project-conversation-protocol.ts:77-79`, with no other harness code in either table).

## P4-B6 red: observed

- `p4-s3-b6-red.log`: exit 1, **10 failed, 15 passed (25)**. The failures are TypeErrors: "Cannot convert undefined or null to object" for the key row, and "Cannot read properties of undefined (reading '<code>')" for the 9 code rows. The frozen row passes, as predicted. Matches.

## P4-B6 green, step 1 (no freeze): prediction, written before the run

- `harness-failure-protocol.ts` exports `harnessFailureRows`, a `Record<HarnessFailureCode, row>` with each value equal to `harnessFailureRow(code)`, with **no** `Object.freeze`. `index.ts` re-exports it directly from `./harness-failure-protocol.js` on one line. `protocol.ts` is not touched; the brief does not list it.
- `p4-s3-b6-unfrozen`: same command: exit 1, **1 failed, 24 passed (25)**. Only "is frozen" fails (`expected false to be true`).

## P4-B6 green, step 1: observed

- `p4-s3-b6-unfrozen.log`: exit 1, **1 failed, 24 passed (25)**: "is frozen" with `expected false to be true`. Matches.

## P4-B6 green, step 2 (freeze): prediction, written before the run

- The table is wrapped in `Object.freeze`. `p4-s3-b6-green`: exit 0, **25 passed (25)**.

## P4-B6 green, step 2: observed

- `p4-s3-b6-green.log`: exit 0, **25 passed (25)**. Matches.

## P4-B7 red: prediction, written before the run

- New `apps/desktop/src/main/request-fault-meaning.test.ts`: 17 `it.each` rows, one per fault value in the brief, each `expect(faultMeaning(fault)).toEqual(meaning)`. A `harness` fault carries its code's message from `harnessFailureMessages` (the fault type needs a `message`; the meaning ignores it).
- `p4-s3-b7-red`: `pnpm exec vitest run --config vitest.main.config.ts src/main/request-fault-meaning.test.ts` in `apps/desktop`: exit 1, the file fails to load: "Failed to load url ./request-fault-meaning.js" (or the same import-resolution error), **0 tests run**, 1 failed file.

## P4-B7 red: observed

- `p4-s3-b7-red.log`: exit 1, 1 failed file, **no tests**: "Error: Cannot find module './request-fault-meaning.js'" at the test's import line. Matches (the import-resolution error).

## P4-B7 green and the mapper moves: prediction, written before the runs

- New `request-fault-meaning.ts` holds `type FaultMeaning` and `faultMeaning` (body and G25 TSDoc moved unchanged, both now exported). `project-conversation-failure.ts` imports `faultMeaning` and `harnessFailureRows`, and drops its copy, its `harnessRows` and its `Match` import; its two mappers keep their bodies except that `harnessRows[...]` reads `harnessFailureRows[...]`. `project-upgrade-failure.ts` branches on `faultMeaning(fault)` as the brief lists and drops its `Match` and its `harnessRows`.
- `p4-s3-b7-green`: the P4-B7 command: exit 0, **17 passed (17)**.
- `p4-s3-b8-after`: the P4-B8 bridge command: exit 0, **111 passed (111)**, the baseline count. `project-entry-bridge.test.ts` is unedited (`git diff --stat` on it is empty).
- `p4-s3-b6-after`: the protocol command: exit 0, **25 passed (25)**.

## P4-B7 green and the mapper moves: observed

- `p4-s3-b7-green.log`: exit 0, **17 passed (17)**. Matches.
- `p4-s3-b8-after.log`: exit 0, **111 passed (111)**, the baseline count; `git diff --stat` on `project-entry-bridge.test.ts` is empty. Matches.
- `p4-s3-b6-after.log`: exit 0, **25 passed (25)**. Matches.

## Real Stryker row red: prediction, written before the run

- Order note: the source moved before this row was edited, so the old configs fail on two counts at once. The counts differ from the new row, and the two `Match` anchors no longer exist in the rewritten files. The red is still "the new row against the old configs", but its received value is the anchor failure, not a count list.
- Test edit only: the real-repository row in `check-stryker-ranges.test.mjs` becomes `stryker.config.json` `wholeFiles` 35, and `stryker.desktop-s7.config.json` `ranges` 6, `wholeFiles` 3.
- `p4-s3-ranges-red`: `pnpm exec vitest run scripts/check-stryker-ranges.test.mjs` in `apps/harness`: exit 1, **1 failed** (only "passes on the repository's own configs and anchors"); every other row passes. Received `ok: false`, with lines naming exactly the two moved `desktop-s7` entries, `project-upgrade-failure.ts:36-53` and `project-conversation-failure.ts:35-48`, and nothing else. The exact problem code is not predicted.

## Real Stryker row red: observed

- `p4-s3-ranges-red.log`: exit 1, **1 failed, 40 passed (41)**. Only the real-repository row fails. Received `ok: false`, `code: "STRYKER_RANGE_BROKEN"`, with exactly two lines: `project-upgrade-failure.ts:36-53 ends past the file's last line (37)` and `project-conversation-failure.ts:35-48 ends past the file's last line (44)`. Matches. The code is `STRYKER_RANGE_BROKEN` because both old ranges now end past the shorter files.

## Stryker re-anchoring: prediction, written before the runs

- `stryker.desktop-s7.config.json`: the `project-conversation-failure.ts:35-48` entry is removed; `project-upgrade-failure.ts:36-53` becomes `:31-36` (from `const meaning = faultMeaning(fault);` to `return protocolInvalid(request);`); `request-fault-meaning.ts` is added as a whole file after `harness-bridges.ts`.
- `stryker.config.json`: `request-fault-meaning.ts` is added as a whole file after `project-conversation-failure.ts`.
- `stryker-range-anchors.json`: the conversation row is removed and the upgrade row is rewritten to the new entry and texts.
- `vitest.desktop-s7-mutation.config.ts` gains `request-fault-meaning.test.ts`.
- `p4-s3-ranges-green`: the same harness command: exit 0, **41 passed (41)**.
- `p4-s3-mutation-ranges`: `pnpm check:mutation-ranges` at the root: exit 0.

## Stryker re-anchoring: observed

- `p4-s3-ranges-green.log`: exit 0, **41 passed (41)**. Matches.
- `p4-s3-mutation-ranges.log`: exit 0; `stryker.config.json 19 ranges, 35 whole files`, `stryker.desktop-s7.config.json 6 ranges, 3 whole files`. Matches.

## Bindings: prediction, written before the runs

Each binding edits one file in place with `bind4.sh` (backup, then restore checked by digest). Commands run from the worktree root as one `bash -c`, so both files run under one log:
- bindings 1 and 2: the P4-B7 file and the P4-B8 bridge file, both in `apps/desktop` (`--config vitest.main.config.ts`);
- binding 3: the protocol file in `packages/protocol`, then the bridge file.

1. `p4-s3-bind-1`, `request-fault-meaning.ts`: `stopped` maps to `not-sent`. Exit 1.
   - P4-B7: **1 failed**, "gives a stop while pending its one meaning".
   - Bridge: **1 failed**, "answers a conversation save with one strict result: a stop while pending" (`uncertain`/`saveUnconfirmed` becomes `unavailable`/`connectionLost`).
   - The upgrade and read "stop while pending" rows pass, because not-sent and sent-then-lost give the same answer there.
2. `p4-s3-bind-2`, `request-fault-meaning.ts`: `send` with `HARNESS_SESSION_SEND_FAILED` maps to `defect`. Exit 1.
   - P4-B7: **1 failed**, "gives a send that fails its one meaning".
   - Bridge: **3 failed**:
     - the brief's upgrade row "answers every upgrade reply with one strict result: a send that fails" (`connectionLost` becomes `protocolInvalid`);
     - the conversation read and save rows "answers a conversation read|save with one strict result: a send that fails" (`lost` becomes broken with `protocolMessageInvalid`).
   - The brief names only the upgrade row; the two conversation rows also read the owner.
3. `p4-s3-bind-3`, `harness-failure-protocol.ts`: `harnessFailureRows.HARNESS_INTERNAL_FAILURE` is built as `harnessFailureRow("PROTOCOL_MESSAGE_INVALID")`. Exit 1.
   - Protocol: **3 failed**: "holds the owner's HARNESS_INTERNAL_FAILURE row", and "matches the upgrade|conversation diagnostics row for HARNESS_INTERNAL_FAILURE". The key-set row, the frozen row and the other 6 code rows pass; the diagnostics tables use `harnessFailureRow`, not the table.
   - Bridge: **3 failed**: the brief's "answers every upgrade reply with one strict result: request.failure HARNESS_INTERNAL_FAILURE", and "answers a conversation read|save request.failure HARNESS_INTERNAL_FAILURE as broken". The activation, switch, list and registration rows are unaffected (they do not read the table).

## Bindings: observed

1. `p4-s3-bind-1.log`: exit 1; target restored by digest (`1e1cbea2…cce1`).
   - P4-B7: **1 failed, 16 passed (17)**, "gives a stop while pending its one meaning". Matches.
   - Bridge: **2 failed, 109 passed (111)**:
     - "answers a conversation save with one strict result: a stop while pending" (predicted);
     - "answers the closing envelope for work in flight at stop: 'save'" (`project-entry-bridge.test.ts:830`, not predicted).
   - **Stronger than predicted, explained.** The extra row is a second oracle on the same mechanism: `bridge.stop()` with a save pending gives a `stopped` fault. That fault expects `saveUncertain` and, under the binding, gets the not-sent `unavailable` answer. My prediction missed this row because I searched only the fault tables.
2. `p4-s3-bind-2.log`: exit 1; target restored by digest (`1e1cbea2…cce1`).
   - P4-B7: **1 failed, 16 passed (17)**, "gives a send that fails its one meaning". Matches.
   - Bridge: **4 failed, 107 passed (111)**: the three predicted rows (upgrade, conversation read and conversation save "a send that fails"), plus "answers its own envelope when send throws" (`:699`, not predicted).
   - **Stronger than predicted, explained.** In that row, `session.sendError` makes the session send fail with `HARNESS_SESSION_SEND_FAILED`, and the read expects `readLost`. Under the binding it gets the defect answer (broken, `protocolMessageInvalid`). It is the same mechanism through the scripted session, which my search for `postFails` did not find.
3. `p4-s3-bind-3.log`: exit 1; target restored by digest (`8fe059e9…f5c2`).
   - Protocol: **3 failed, 22 passed (25)**, exactly the three predicted rows.
   - Bridge: **3 failed, 108 passed (111)**, exactly the three predicted rows. Matches.
- `git status` after the three runs shows only the slice's intended changes.

## Gates before the candidate

- `p4-s3-typecheck.log`: exit 0.
- Structural checks (brief): `faultMeaning`/`FaultMeaning` only in `request-fault-meaning.ts` (and its test's import); no `harnessRows` outside tests; no `Match` in the two mappers; `index.ts` has no `harnessFailureRow\b` and one `harnessFailureRows` line (`:73`, a direct re-export from `./harness-failure-protocol.js`; `protocol.ts` is not touched).
- `p4-s3-codescene.log`: 10 on the four desktop files and the two protocol files; `index.ts` has no score (re-exports only).
- `p4-s3-knip.log` exit 0; `p4-s3-jscpd.log` exit 0.
- `pnpm check`: held by the CPU rule (CPU 48.7/49/79.2%, 23 League*/TFT* processes). Reported to the coordinator.
- CPU rule after the coordinator's "livre": one reading, 6.9/10.3/9.2%, 0 League*/TFT* processes, free memory 11.36 GB.
- `p4-s3-check.log`: `pnpm check` exit 0. **120 files, 3858 passed (3858)**: 3830 at p4-s2 plus the 11 P4-B6 rows plus the 17 P4-B7 rows. Dependency-cruiser found no violations.
