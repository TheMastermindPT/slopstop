# TDD evidence: p3-s3-ledger-refusals

- Design: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md` (Follow-up "slice p3-s3-ledger-refusals detailed"), `content_hash 5713e4dc…`, approved copy `approved-19dbee49.md`; append-only check at start: `keep`. Q13-Q17 (a). Contract commit: `6647a30` (the brief alone).
- Base: `6647a30` (the s2 head `42188e8` plus the contract commit).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s3-*.log` (+ `.json` reports) in the main checkout; each log heads with the parent commit, patch digest, command and exit.

## Prediction corrections (coordinator, before the red; the brief table is left unedited)

- **M1:** `expectForbiddenUnchangedChild("events")` declares `{ decode: true }`: `readOutcomeReceipt` decodes `storedEventRowsSchema` (`:304`) before the `:318` check, and the fixture's row is all nulls. r10 is reached by `G8 rejected events`.
- **M2:** r11 is reached by the two `G9 conflict requested` rows `{commandType: other}` and `{commandVersion: 2}`; `G6 stored type precedes G9 conflict` is a successful conflict settle and stays a non-oracle row.
- **Extra reaching rows** (declared with their real literal): r2 also by `G9 conflict requested` `{outcome: applied}`/`{outcome: unchanged}` (the conflict receipt keeps its rejection child); r3 by `G8 rejection fields` `{projectId}`, `{receiptId}`, `{projectSequence: 2}` (no extra raw-UPDATE r3 row: same guard path); r5 by the `orphan receipt` binding row; r14 by the other `G9 conflict requested` rows.
- **r12** (new): `G6 requested stored type` in `canonical-command-repository.integration.test.ts` (raw `UPDATE command_receipts SET command_type`, both receipt reads agree, the command check refuses).

## P3-B9: the refusal table is the one owner of the messages

- Test: `canonical-ledger-refusal.test.ts` (`names one refusal per ledger check, in the prediction table's order`; `refuses %s with its own message` x15, messages written out).
- Red (`p3-s3-b9-red.log`): `Cannot find module './canonical-ledger-refusal.js'`. Green (`p3-s3-b9-green.log`): 16 passed.
- Implementation: `canonical-ledger-refusal.ts`: `CANONICAL_LEDGER_REFUSALS` (15), `CanonicalLedgerRefusalCode`, the message table (`satisfies Record<…>`), `CanonicalLedgerRefusal` (`Data.TaggedError`, `refusal` + `message`), `canonicalLedgerRefusal(refusal)`.

## P3-B8: the oracles name the failure they accept

- New test helper `tests/integration/canonical-ledger-failure.ts` (not in the planned paths; it keeps the 1235-line fixture from growing): `LedgerFailure` = `{ refusal } | { decode: true } | { shape } | { syntax: true } | { sentinel }`, no catch-all, and `expectLedgerFailure(error, expected)`:
  - refusal: `instanceof Error`, `message` equal to the message written out in the helper, then `_tag` `"CanonicalLedgerRefusal"`, then `refusal`;
  - decode: `instanceof Schema.SchemaError`, not a `CanonicalLedgerRefusal`;
  - shape: a plain `Error` (`Error.prototype`, no `_tag`) with that exact message;
  - syntax: `instanceof SyntaxError`; sentinel: `toBe`.
- Every in-scope oracle takes a required expectation (no default): `expectBrokenReplay`, the 8 fixture wrappers, `expectRejectionInsertFault` (the fault is exported as `rejectionInsertFault`), the moved fence oracles, `expectBrokenRecoveryActivation` (asserts `result.error.cause`), and the reconciliation fence, marker and ledger case tables (each row carries `expected`). The two direct recovery tests declare `Initial Writer has recovery records.` and `Canonical recovery source authority is inconsistent.`; `S6-R1 B9` keeps its literal message pin and adds the r7 refusal.
- Declarations were written from the code before the run; the red checked them (below).

## P3-B7 red at the base, P3-B10 pins

- Red, ledger still throwing plain `Error`, every other change in place (`p3-s3-red-*.log` + `.json`):
  - repository: 58 failed, 257 passed; fence: 11 failed, 28 passed; reconciliation: 116 failed, 401 passed; recovery: 91 passed; settlement: 2 failed (P3-B10 a, b), 105 passed.
  - Every failure is exactly `expected undefined to be 'CanonicalLedgerRefusal'`: the message assertion passed and the `_tag` failed, as predicted. No decode, shape, syntax or sentinel row failed: the P3-B8 pins hold at the base.
- **Fixture fault fixed before the red (coordinator accepted):** the first P3-B10b plant used the fixture's result hook, but `repository.verifyFence` reads through `this.owner.client`, not a transaction, so the hook never applied (`verifyFence` resolved `current`). The plant is now stored damage, `UPDATE writer_fence SET activated_at='2026-09-05T12:00:00.500Z'`, as the existing `verifyFence` table does (`p3-s3-red-canonical-project-settlement-2.log`: both P3-B10 rows give the predicted `_tag` red).
- P3-B10: (a) `P3-B10 a ledger refusal rejects its writer submission and the next one is writer-unavailable` (r5 through the production writer: the pending result rejects with the refusal; the next `settle` is `{ status: "completed", result: <writer-unavailable> }`); (b) `P3-B10 an incoherent fence answers the writer's fence check as broken with the refusal as cause` (repository error `WRITER_FENCE_CHECK_FAILED` with the r1 refusal as `cause`; the writer answers `{ status: "broken", code: "WRITER_FENCE_CHECK_FAILED" }`); (c) the recovery activation cause is asserted in every `expectBrokenRecoveryActivation` row; the runtime `project.activate` answer stays pinned by `expectPublicBrokenRecoveryActivation`, unchanged.

## Implementation and green

- `canonical-command-ledger.ts`: each of the 15 checks throws `canonicalLedgerRefusal(<literal>)` (`:365` picks `CONFLICT_RECEIPT_COMMAND` or `REQUESTED_RECEIPT_COMMAND` by `conflict`); guard conditions and order unchanged.
- Green (`p3-s3-green-*.log`): repository 315, fence 39, reconciliation 517 (rerun after the CodeScene refactor: `-2`, 517), recovery 91, settlement 107, driver 5, unit 16. Each file under 40 s.

## Q16: the fence-authority family

- Moved to `canonical-command-fence.integration.test.ts` with the same names and assertions (stale, malformed, observation, F2 rows); only the weak `toBeInstanceOf(Error)` lines became `expectLedgerFailure`. `expectNoSettlementWork` moved to the fixture (both files use it). The fence file runs in the ordinary harness integration project (39 tests, 3.5 s), not the native-long group.
- CodeScene: repository test 9.38 → 10; fence file 10.

## Bindings (each restored by digest)

1. r6/r7 literals swapped (`p3-s3-binding-1-r6-r7-swap.log`): 41 rows fail, including both `S6-R1 B9` rows and the `G6 binding` authority rows. Restored `c5604a93…688b`.
2. r13 back to `throw new Error(<same message>)` (`p3-s3-binding-2-r13-plain-error.log`): 26 rows fail on `_tag` (the `G6 requested` rows and the reconciliation requested rows). Restored.
3. The rejection rows' decode turned into a refusal (`p3-s3-binding-3-decode-as-refusal.log`): the 6 `{decode}` `G8 rejection fields` rows fail. Restored.
4. The final "." dropped from `ORIGINAL_RECEIPT_IS_CONFLICT`'s message (`p3-s3-binding-4-message-dot.log`, `-unit.log`): `S6-R1 B9` x2 and the P3-B9 row fail. Restored `c10ca4a8…75fe`.
5. One oracle's expectation deleted (`p3-s3-binding-5-missing-expectation.log`): `pnpm typecheck` exit 1, `TS2554: Expected 2-3 arguments, but got 1.` Restored `74a5673a…fab4`.
6. **As written** (requested check moved before the r14 check in `readConflict`; `p3-s3-binding-6-conflict-guard-order.log`): does not bite, 143 conflict rows pass. No row fails both checks (the `commandType`/`commandVersion` rows pass r14; the r14 rows pass the command check), so that order is not observable and binding it would need a fabricated row. **Variant (coordinator amendment, like s2's tuple binding):** the outcome read and r15 moved before r14 (`p3-s3-binding-6b-conflict-outcome-first.log`): 10 conflict rows fail (receipt = original, sequence 1 and 3, Project; repository plus reconciliation activation and baseline). Restored `c5604a93…688b`.

## Structural checks (candidate tree)

- `rg -n "throw new Error\(" canonical-command-ledger.ts`: nothing.
- `rg -n 'Data\.TaggedError\("CanonicalLedgerRefusal"\)' apps/harness/src`: one line, `canonical-ledger-refusal.ts:46`.
- Each of the 12 messages: 0 in the ledger. In `apps/harness/src` the brief expects 1 (the table), but the unit test lives beside its source in `src`, so the counts include it; without tests (`-g '!*.test.*'`) the table holds 1 line per message and 2 for each of the 3 shared messages (two literals each).
- `rg -n "toBeInstanceOf\(Error\)"` in the fixture, repository and fence files: only `canonical-command-fixture.ts:1217`, `knownBodyFailure` (out of scope, Q14 (a)).
- `rg -n "canonical-ledger-refusal" packages`: nothing.

## Light checks

- `pnpm typecheck` (`p3-s3-typecheck.log`): exit 0. Biome clean.
- `pnpm check` (`p3-s3-check.log`, CPU 16/7/14, no game process): exit 0, 110 files, 3635 tests passed; typecheck, Effect diagnostics (51 advisory, unchanged; the new module adds no `extendsNativeError`) and dependency-cruiser clean.
- CodeScene 10 on: `canonical-command-ledger.ts`, `canonical-ledger-refusal.ts` and its test, `canonical-command-fixture.ts`, `canonical-ledger-failure.ts`, the repository and fence tests, `canonical-writer-reconciliation-fixture.ts` (9.38 after the table rewrite, back to 10 by moving the baseline-or-activation choice into `expectBrokenLedgerAnswer`, behaviour unchanged, 517 passed again), the reconciliation test, `canonical-writer-recovery-fixture.ts`, the settlement test.

## Mutation run (written, NOT run; waits for the coordinator's GO, runs alone)

- `stryker.ledger.config.json`: mutate `apps/harness/src/storage/canonical-ledger-refusal.ts` (whole file), `apps/harness/src/storage/canonical-command-ledger.ts:63-122` (`coherentCanonicalWriterRelease`, `currentCanonicalSettlementFence`, `readCanonicalWriterFence`) and `:193-459` (`readRejection` to `checkRequestedReceipt`); the writers start at `:461` and are out. `testRunner` vitest, `perTest`, `ignoreStatic`, not incremental, concurrency 4, json + html reporters (`reports/mutation/ledger-harness.{json,html}`), thresholds 90/80/80.
- `apps/harness/vitest.ledger-mutation.config.ts` (`testTimeout` 15 000): the refusal unit test and the repository, fence, reconciliation, recovery, settlement and driver integration files; `vitest list` finds 1090 tests (16 + 315 + 39 + 517 + 91 + 107 + 5).
- Root script: `test:mutation:ledger:harness` = `pnpm exec stryker run stryker.ledger.config.json`.

## Preflight (candidate `ba06c01`)

- preflight: broken (brief format: Behavior entries written as P3-Bn, parser expects Behavior P3-Bn). `slice-preflight` exit 2 from the root, `apps/harness`, `apps/harness/src/storage` and `apps/harness/tests/integration` (`p3-s3-preflight*.log`): "`### Test Contract: p3-s3-ledger-refusals` has no Behavior entries". Coordinator decision (a), the p3-s1 precedent; the brief is not edited. rpiv draft `20261025-204448-b2a409d0` (local). P3-B7 to P3-B10 go to the slice-verifier as unchecked reviewer focus.
- Lane re-check `lane.mjs --range 6647a30..ba06c01`: normal (`lines: 783 > 150`).

## Slice-verifier round 1 (candidate `029d921`) and its follow-up

- Result: passed, 0 violations, 5 warnings; Research OK. Real findings fixed here (no round 2); V1 and V3 go to the coordinator (they change scope or the mutation criterion).
- **V5 (real, fixed):** jscpd (`jscpd.json`, threshold 0) found 1 clone between the refusal table and the oracle helper's written-out message map. The helper now keys its written messages by message (`writtenMessages`, each with the refusals that carry it) and finds a refusal's message through `writtenMessageOf`; a refusal with no written message fails the row. jscpd on the three files: 0 clones.
- **V2 (real, fixed):** in activation mode the 4 forbidden-child rows went to `expectPublicBrokenRecoveryActivation` only and never read `entry.expected`. They now run `expectBrokenAndPublicActivation`: the direct activation with the declared cause (`expectBrokenRecoveryActivation(f, entry.expected)`), then the unchanged public pin.
- **V4 (real, fixed):** a raise-only row in `G9 conflict requested`, `{ commandType: "conformance.counter.other", projectSequence: 1 }` (a stored conflict receipt with both kinds of damage), declared `CONFLICT_RECEIPT_AUTHORITY`. The binding 6 **as written** now bites (`p3-s3-binding-6-written-with-two-damage-row.log`): that row fails; restored `c5604a93…688b`. The variant (`-6b-`) stays recorded and also bites.
- Reruns after the follow-up (`p3-s3-followup-*.log`): repository 316, fence 39, reconciliation 517, recovery 91, settlement 107, driver 5, all exit 0. CodeScene 10 on `canonical-ledger-failure.ts`, `canonical-writer-reconciliation-fixture.ts` and the repository test.
- Polish not changed: the `{ shape }` member also names three plain-Error messages that are not from `canonical-json.ts`; `shapeFailureFor("original", …)` serves the rejection rows; the comment pointing at the moved F2 rows; `{ sentinel: unknown }` admits `undefined` (no row uses it).
- Preflight rerun with Pedro's fixed tool (`p3-s3-preflight-4.log`, candidate `f6be0a0`): no longer broken; exit 1 with only `no-test-line` for P3-B7, P3-B8, P3-B9 and P3-B10 (this contract names its tests in Given/When/Then and test names, not on `Test:` lines; brief format, the class of rpiv issue #3). The two earlier `missing-evidence` lines (`-2`, `-3`) were my wrong log names, corrected in `-4`.
- Mutation ranges unchanged: `canonical-command-ledger.ts` is identical at `ba06c01` and `f6be0a0`, so `:63-122` and `:193-459` still hold.

## V1 and V3 decisions (after the verifier round)

- **V1 (coordinator, under Pedro's Q14 (a) "every weak oracle that reaches the ledger"): new planned path** `apps/harness/tests/integration/canonical-command-repository-faults.integration.test.ts`, raise-only, no assertion removed.
  - `expectGenuineReplayFailure(error, expected)` keeps its two assertions and adds `expectLedgerFailure`. G8 unit: `projectSequence` and `receiptId` → `REJECTION_SOURCE_BINDING`, `detailsHash` → `REJECTION_DETAILS_INTEGRITY`, `retryable` and `detailsText` → decode. G6 unit: events `projectSequence` → `EVENT_SOURCE_BINDING`, the other 7 rows → decode.
  - G7 unit: `rejects.toThrow(/children/)` becomes the same regex on the message plus the declared refusal: `events` → `NON_APPLIED_HAS_EVENTS` (an unchanged receipt over real events), `rejections` → `NON_REJECTED_HAS_REJECTIONS`.
  - Green at the candidate (`p3-s3-faults-green.log`): 92 passed. With the base ledger (`6647a30`) swapped in (`p3-s3-faults-red-at-base-ledger.log` + `.json`): exactly the 6 refusal rows fail, each `expected undefined to be 'CanonicalLedgerRefusal'`; every decode row passes. Ledger restored `c5604a93…688b`. CodeScene 10.
  - The file joins `vitest.ledger-mutation.config.ts`; `vitest list` now finds 1183 tests (+92).
- **V3 (Pedro's amendment, asked by the coordinator):** the main criterion 2 reads "every non-ignored mutant in `canonical-ledger-refusal.ts` Killed or Timeout", and an extra mini run covers the statics that `ignoreStatic` skips:
  - `stryker.ledger-table.config.json`: mutate `canonical-ledger-refusal.ts` only, `ignoreStatic: false`, same runner, coverage, concurrency and thresholds, its own reports (`reports/mutation/ledger-table-harness.{json,html}`);
  - `apps/harness/vitest.ledger-table-mutation.config.ts`: `canonical-ledger-refusal.test.ts` only (16 tests);
  - root script `test:mutation:ledger-table:harness`;
  - pass: exit 0 and every mutant in that file Killed or Timeout; any survivor is listed for Pedro one by one.
- Polish fixed: the comment that pointed at the moved B14/F2 rows now names the fence file. Other polish stays recorded.

## Final gate sequence, first attempt at `20722e0` (stopped)

- Ledger integration files together (`p3-s3-final-ledger-files.log`): 7 files, 1167 passed, exit 0 (68 s); refusal unit (`p3-s3-final-unit.log`): 16 passed, exit 0.
- `pnpm check:duplicates` (`p3-s3-final-duplicates.log`): **exit 1**, 1 clone (12 lines, 75 tokens): the new P3-B10a test repeated the setup of `G6 persisted orphan precedes differing request`. Stopped and reported; `check:dead-code` and `pnpm check` not run.
- Fix (coordinator GO, test-only, assertions unchanged, `jscpd.json` untouched): `orphanTheAppliedReceipt(f)` in `canonical-command-fixture.ts` (register the counter, settle, delete the idempotency pointer), used by both tests. jscpd on the three files: 0 clones; the two files (`p3-s3-clone-fix-two-files.log`): 423 passed, exit 0; CodeScene 10 on the three files.

## Final gates and mutation runs at `cc777ca` (coordinator GO; Pedro confirmed the machine free)

- Restarted gate sequence at `cc777ca`, each exit read before the next: ledger integration files together (`p3-s3-final2-ledger-files.log`) 7 files 1167 passed, exit 0 (68 s); refusal unit (`p3-s3-final2-unit.log`) 16 passed, exit 0; `pnpm check:duplicates` (`p3-s3-final2-duplicates.log`) exit 0, 0 clones; `pnpm check:dead-code` (`p3-s3-final2-dead-code.log`) exit 0, Knip clean (patch digest `e3b0c442…`, the empty patch, so exactly `cc777ca`); CPU 11 (one reading, Pedro's override), no game process; `pnpm check` (`p3-s3-final2-check.log`) exit 0, 110 files, 3635 tests, 51 advisory unchanged.
- **Main mutation run** (`pnpm test:mutation:ledger:harness`, `p3-s3-mutation-ledger.log`, report `mutation-ledger-cc777ca.json`): exit 0, score 98.84 (break 80), 16 min 4 s (23:45:17Z to 00:01:24Z). Refusal module: 2 Killed, 1 Ignored (the `"CanonicalLedgerRefusal"` tag string, static). Ledger ranges: 329 Killed, 10 Timeout, **4 Survived**, 0 NoCoverage:
  1. `canonical-command-ledger.ts:213:5` ConditionalExpression `canonicalJsonText(details) === child.detailsText` → `true` (r4 condition). The hash half still refuses every current row, because each noncanonical-text row stores the hash of its own text. A row with noncanonical details text and the hash of the canonical form would kill it.
  2. `:295:5` ConditionalExpression `canonicalJsonText(payload) === event.payloadText` → `true` (r9 condition). The same shape for event payloads.
  3. `:439:5` ConditionalExpression `row.projectId === command.projectId` → `true` (r14 condition). Every current row that changes `projectId` leaves `generationProjectId` unchanged, so `:447` refuses it anyway. Killing it needs a row whose Project and generation Project both differ. The conflict read filters by `r.project_id=?`, so only a result-hook row reaches it.
  4. `:452:7` ConditionalExpression `receipt.outcome !== "rejected"` → `false` (r15 condition). Every non-rejected conflict row stops earlier at r2 (it keeps its rejection child). A conflict receipt rewritten as applied with no rejection child would make the mutant read `receipt.rejection.code` of an absent rejection (a `TypeError`, not the refusal), so it would be killed.
  - **Pass criterion 2 is not met as written:** all 4 survivors are in refusal-check conditions (r4, r9, r14, r15). Criterion 1 (exit 0, break 80) holds. No row was added (coordinator: survivors go to Pedro one by one first).
- **Table mutation run** (`pnpm test:mutation:ledger-table:harness`, `p3-s3-mutation-ledger-table.log`, report `mutation-ledger-table-cc777ca.json`): exit 0, score 100, 4 s. **Only 3 mutants were generated**, all Killed: the tag string (`:46`), the constructor's object (`:55`) and its block (`:54`). Stryker made no mutant for the 15 tuple literals or the 15 message values (`as const` / `satisfies` table), so this run does not exercise the message table that V3 meant it to cover. The table stays proven by P3-B9 (each literal and its written-out message) and binding 4 (a dropped "." fails P3-B9 and `S6-R1 B9`).

## Pedro's decisions on the mutation results

- **(A) The 4 survivors are killed with raise-only rows, no mutation rerun (one run only).** Each row first passes at the candidate ledger (`p3-s3-kill-rows-pass.log`: the selected rows, 22 passed); then that mutant is applied by hand, the row fails, and the ledger is restored to `c5604a93…688b`:

| Mutant | Location | Replacement | Killing row | Failure under the mutant |
|---|---|---|---|---|
| 98 ConditionalExpression | `canonical-command-ledger.ts:213:5-213:53` | `true` | `G8 rejection details noncanonical canonical hash` (`{ "version":1}` stored with the hash of `{"version":1}`; `REJECTION_DETAILS_INTEGRITY`) | `expected undefined to be an instance of Error` (`p3-s3-kill-mutant-98.log`) |
| 198 ConditionalExpression | `:295:5-295:53` | `true` | `G6 JSON 'noncanonical canonical hash'` (`{ "value":7}` stored with the hash of `{"value":7}`; `EVENT_PAYLOAD_INTEGRITY`) | `expected undefined to be an instance of Error` (`p3-s3-kill-mutant-198-v2.log`; the first try's filter matched no test and proves nothing) |
| 296 ConditionalExpression | `:439:5-439:40` | `true` | `G9 conflict requested` `{ projectId: other, generationProjectId: other }` (`CONFLICT_RECEIPT_AUTHORITY`) | `expected 'Canonical Writer authority must conta…' to be 'Canonical conflict receipt authority …'` (`p3-s3-kill-mutant-296.log`) |
| 335 ConditionalExpression | `:452:7-452:37` | `false` | `G9 conflict applied without rejection` (new fixture scenario `expectAppliedConflictWithoutRejection`: the conflict receipt read as applied, its rejection rows empty; `CONFLICT_RECEIPT_OUTCOME`) | `expected 'Cannot read properties of undefined (…' to be 'Canonical conflict receipt outcome is…'` (`p3-s3-kill-mutant-335.log`) |

  - **Row 3 correction (to report):** a row that changes only the conflict row's `projectId` already exists (`G9 conflict requested {projectId}`) and cannot kill mutant 296, because its unchanged `generationProjectId` makes `:447` refuse first. The killing row changes the Project and the generation Project together, so only `:439` tells it apart.
- **(B) V3 (Pedro's amendment):** the refusal table is proven by P3-B9 and binding 4. Stryker generated no mutant for the `as const` tuple or the `satisfies` message table, so the table run covered 3 mutants only (tag string, constructor object, constructor block), all Killed.
- CodeScene 10 on `canonical-command-fixture.ts` and the repository test.
- Final gates at `7441126`, each exit read before the next: `pnpm check:duplicates` (`p3-s3-final3-duplicates.log`) exit 0, 0 clones; the 7 ledger integration files together (`p3-s3-final3-ledger-files.log`) 1171 passed, exit 0 (72 s); CPU 21/3/7, no game process; `pnpm check` (`p3-s3-final3-check.log`, patch digest empty, so exactly `7441126`) exit 0, 110 files, 3635 tests, 51 advisory unchanged, dependency-cruiser clean.
