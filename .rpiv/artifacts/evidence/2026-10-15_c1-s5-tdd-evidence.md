---
date: 2026-10-15T17:00:00+0100
author: Pedro Mesquita
repository: slopstop
branch: feat/c1-s5-conversation-journey
commit: 9779fbd
status: candidate
tags: [evidence, tdd, conversation, c1, desktop, e2e, journey, seed]
---

# Conversation C1 S5 — the real app — TDD evidence

## Method

S5 follows the design's S5 section and its Developer Context entries "S5 intent review and oracle refinement" (R1-R11, decisions log §66, R6 and R8 amended by §67) and "S5 scope change" (§68). Approved copies: `approved-3e9a2147…f3.md` (R1-R11 with §67); the §68 note is appended in Developer Context and re-stamped (`content_hash 9480fbef…e153`).

- **Base and workspace.** Worktree `slopstop-c1-s5`, branch `feat/c1-s5-conversation-journey`, parent `9779fbd` (base `c8a72d1` plus the coordinator's two design commits). No push, no merge.
- **Lane.** Rigorous.
- **Binding.** Every run is bound to its parent commit and a patch digest of the whole working tree, untracked files included, computed with a temporary index (`GIT_INDEX_FILE`), so the real index is never touched (`scratchpad/s5/digest.sh`). A clean tree digests to `e3b0c442…b855`.
- **Logs.** `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/9068c0c9-c5ca-48a7-8f1c-16ff9cd69e01/scratchpad/s5/logs/`, called `logs/` below. Every log is kept whole.
- **Heavy runs.** Package and the single S5 e2e test under the coordinator's development GO, each after three CPU readings.

## Contract questions raised before the build

- **R6 x R7 x R8 (before any edit).** With three listed rows, the rewound registered Project had to be repository-b, but the journey switched to b before its R5 open, so the later R5 could never record "Updating Project…". Pedro chose option A (§67): the switch to b is its upgrade open.
- **Real red on arrival (R10).** See "Scope change" below. Pedro chose option A (§68).

## Seeding (R8, R11)

- Files: `apps/harness/tests/integration/conversation-journey-ui-seed.integration.test.ts` (env `SLOPSTOP_CONVERSATION_JOURNEY_SEED`), run after the entry seed by `seedConversationJourney` in `apps/desktop/tests/e2e/harness-seed.ts`. Both run in the test file's `beforeAll`.
- Factored, not copied: `activeGenerationDirectory(storageRoot, projectId)` moved from `registration-project-upgrade.integration.test.ts` into `project-storage-upgrade-fixture.ts` and now takes the application storage root (the registry lives directly under `<userData>/storage`; the first seed run failed with "unable to open database file" while the helper assumed an `installation/` child, `logs/seed-1.log`). The registration test passes `path.join(root, "installation")`.
- The seed rewinds repository-b with `rewindToGenerationThree` (R7) and creates the Storage-only Project with `createGenerationThreeProject`.
- **Listing the code reports after seeding** (asserted by `projectId`, three rows, `hiddenCount 0`; `logs/seed-2.log`):

| Row | registration | storage |
|---|---|---|
| repository-a | registered | healthy |
| repository-b | registered | safe-mode, canonical `migration-required` |
| Storage-only `00000000…0010` | unbound | safe-mode, canonical `migration-required` |

## Steps

| Step | Behaviour | Red | Green | Logs |
|---|---|---|---|---|
| 1 | CNV-B19 journey file, recorder helpers, desktop-log helper | expected red "none — composition guard" (R10). Run 1 failed on a test defect: the recorder was installed before the relaunched window mounted `#ws-progress` (now `openProject` waits for the Open button, as `project-upgrade.test.ts` does). Run 2 failed on arrival for a product reason (below) | — | `logs/e2e-1.log`, `logs/e2e-2.log`, `logs/e2e-2-test-results/` |
| 2 | §68: `canOpen` opens a healthy unbound Project | the healthy unbound table row: button disabled, `expected true to be false` at the final assertion; 19 other rows passed | renderer 387/387 | `logs/canopen-red.log`, `logs/canopen-green.log`, `-green-2.log` |
| 2b | the same red re-observed on the final test shape (canOpen restored to HEAD, then the green file copied back) | 1 failed / 19 passed; the restored digest equals the green one (`7757024d…90e3`) | — | `logs/canopen-red-2.log` |
| 3 | CNV-B19 green on a fresh package with the §68 change | — | 1/1 (run 3: 37 s; run 4 with named steps: 17.9 s test, 30.2 s total) | `logs/package-2.log`, `logs/e2e-3.log`, `logs/e2e-4.log`, `logs/e2e-4.json` |

Run 2 is also the observed composition-guard result: everything before the Storage-only reopen passed (four saves with R2, repository-b's R5 upgrade open, the switch back with R4, the Storage-only R5 open and save, R9 after launch 1, and repository-a and repository-b reopened with R4 after the restart).

## Scope change (§68)

After the restart the Storage-only Project's row was disabled ("Storage healthy"): `projects-list.tsx:46-49` opened an unbound Project only in safe mode. Pedro chose the fix inside S5.
- Before the change, the harness path was checked: `registered-project-selection.ts:113-114` returns no refusal for a Project without a registration, and `project-upgrade-runtime.integration.test.ts:89-93` activates an upgraded (healthy) Storage-only Project `active`, `read-write`.
- The table row in `projects-list.test.tsx` covers every case: unbound healthy (opens, new), unbound safe mode `migration-required` and `recovery-required` (open, unchanged), unbound `not-registered`, `unavailable`, `broken` (closed), an incomplete registration (closed), registered with repository `present` (opens) and `missing`, `changed`, `unavailable`, `invalid`, `broken` (closed). An always-openable control row proves the list is ready before each row is judged.

## Durations and limits (R11)

| Item | Limit | Observed |
|---|---|---|
| entry seed (vitest, in `execFileSync`) | 15 s per test, 120 s per subprocess | 10 s wall (`logs/seed-2.log`) |
| journey seed | 15 s per test, 120 s per subprocess | 3 s wall; test body 1.3 s |
| `beforeAll` (both seeds) | 150 s (`test.setTimeout` in the hook). `execFileSync` blocks the event loop, so a hung seed ends at its own 120 s limit, inside the hook | ≈ 12 s (run 4: 30.2 s total − 17.9 s test) |
| the test | 150 s | 17.9 s |
| step: repository-a saves two messages | `expect` 8 s per wait | 1.6 s |
| step: repository-b updates on opening, then saves | | 1.1 s |
| step: repository-a still shows its two messages | | 0.3 s |
| step: the Project without a repository updates, then saves | | 1.1 s |
| step: after a restart, each Project reopens with its messages | | 2.0 s |

The remaining ≈ 12 s of the test are the two launches and closes. No timeout occurred.

## Gates

On digest `7757024d…90e3` (before the CodeScene refactor of the table rows): `pnpm check` exit 0 in 53 s (`logs/gate-check-1.log`); jscpd 0 clones (`logs/gate-jscpd-1.log`); knip exit 0 (`logs/gate-knip-1.log`); touched integration tests passed (registration upgrade 3/3; the seeds and chained upgrade, `logs/int-touched.log`). CodeScene: 10 on every touched file after `projects-list.test.tsx` went from 9.68 (five-argument `it.each` callback) to 10 with object rows. The gates are run again on the final staged content before the commit.

## Heavy runs after the green (coordinator GO, in order, CPU read before each)

All on digest `eb3d411a…df14` (the green tree with the evidence file).

| Run | CPU readings | Result | Log |
|---|---|---|---|
| R10 binding: the save handler replaced with `"hang"` through `replaceHandlers` right after launch 1 (`scratchpad/s5/binding-hang.py`) | 42.1, 33.2, 53.9; retaken 35.6, 29.2, 22.5 | failed as intended in "repository-a saves two messages" at the `"Saved"` wait: expected "Saved", received "Saving…" (29 s). Mutated digest `d6528a0c…f8ea7a`; restored digest equals the green one | `logs/binding-hang.log` |
| `project-upgrade.test.ts` (shared recorder and log helpers) | 26.8, 27.5, 29.4 | 1/1, 10.8 s | `logs/e2e-upgrade.log` |
| `pnpm test:e2e` (package plus the full suite) | 37.3, 42.4, 40.2 | 27/27, 5.6 min | `logs/e2e-full.log` |
| `package:launch-smoke` | 29.4, 33.1, 29.9 | passed, 51 s | `logs/launch-smoke.log` |

No timeout occurred.

## Mutation (later)

S5 changes behaviour (`canOpen`), so one mutation run is due on the final candidate after the candidate review. `projects-list.tsx` is not in the root `stryker.config.json` `mutate` list (only `projects-workspace.tsx` ranges are); the range to add is `apps/desktop/src/renderer/projects-list.tsx:50-56`, with the `projects-list.test.tsx` table as its oracle.

## Review round 1 fixes (decisions log §69)

Table: main checkout `.rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/s5-review-round1.md`. Fixes are a separate commit on top of the slice commit `1665900`.

| id | Fix | Proof |
|---|---|---|
| T1 | — | `pnpm test:integration` on the fixed candidate (below) |
| T2 | The runs above were bound to working-tree digests. `eb3d411a` was reconstructed exactly from `1665900`: a temporary index read `1665900`'s tree, the evidence file was replaced by its pre-heavy-run text (the "Pending" section instead of "Heavy runs after the green" and "Mutation (later)", `status: in-progress`), and `git diff --cached --binary 9779fbd \| sha256sum` gave `eb3d411a…df14`. So the delta `eb3d411a` → `1665900` is that evidence file only. Between `7757024d` (the earlier e2e and gates) and `eb3d411a`: the CodeScene refactor of `projects-list.test.tsx` rows, the design's §68 note and the evidence file. The final runs below rebind everything to the fixed commit. | — |
| T3 | R2b now polls without clearing until the record ends with `""`, then reads once with clear and asserts exactly `[""]`. | Binding `scratchpad/s5/binding-transient.py`: a transient "Transient" line in the slot after the input fails the check at `conversation.test.ts:110` in the candidate (line 118 in the binding-mutated file; received `["", "Transient", ""]`); restored digest equals the green one (`logs/r1-binding-transient.log`, and again on the final recorder shape, `logs/r1-binding-transient-2.log`). This binding does not tell the old check from the new one (the old clearing poll would also have failed it); the old check's gap, a transient line read and cleared by one poll before a later poll saw `[""]`, is closed by the code: the new check reads the whole record once, after the wait, without clearing in between. |
| T4 | `apps/desktop/src/renderer/projects-list.tsx:50-56` (`canOpen`) added to the root `stryker.config.json` `mutate` list; the rule is **CNV-B52** (Developer Context "S5 review round 1", design re-stamped `content_hash ee80406d…`); the table test is named "CNV-B52 decides whether $label can be opened". Stryker runs once on the final candidate after the last round. | — |
| T5 | The red is re-observed on the final test shape (which differs from `1665900`'s only by the CNV-B52 title) with `canOpen` restored to `9779fbd`: only the healthy unbound row failed (button disabled); the restored digest equals the green one. Step 2b above said "the final test shape" for a run on the pre-refactor shape at `7757024d`; this row replaces that claim. | `logs/r1-canopen-red.log` |
| T6 | `withLaunch` runs each launch's part of the journey and closes the app; if the journey fails and the close also fails, the thrown error names the close failure and carries the journey failure as its `cause`, which Playwright prints (round 2, S1); a close failure after a passing journey fails the test. | not bound: a failing close cannot be produced without patching Playwright's `close`; the double-failure branch was never executed (residual) |
| T7 | R9 as built: a successful upgrade writes no harness log line (`harnessUpgradeLogEvents` = `abandoned`, `discardFailed`), so after each launch the test asserts the start lines, no "Harness upgrade event." line and no `HARNESS_LOG_LINE_` code; the TSDoc no longer claims the positive link. **The positive `process-entry` → desktop log link stays unproven in the real app. Round 2 (§70): Pedro accepts it as residual risk at the C1 gate; the carry-forward row keeps one trigger, the first missing upgrade log line in a real run.** | journey and `project-upgrade.test.ts` runs below |
| T8 | `activeGenerationDirectory` throws "No active generation registered for Project <id>" when the row or its `active_generation_id` is missing. | touched integration runs below |
| T9 | `storageOnlyProjectId` decodes with `ProjectIdSchema`. | journey runs |
| T10 | One page-side message reader (`installMessageReader`) built from one `messageParts` selector set, used by both `shownMessages` and the status recorder. | journey runs |
| T11 | A reinstall disconnects the slot's previous observer. | journey runs |
| T12 | `single-instance.test.ts` counts start lines through the shared `startingLines` in `electron-launch.ts`; the shared reader treats only a missing log file as empty (the old copy swallowed every read error). | `logs/r1-e2e-1.log` (3/3 with the upgrade and single-instance files) |

Development runs during the fixes: the three touched e2e files 3/3 in 59.6 s (`logs/r1-e2e-1.log`; the GO named the single S5 file, and the upgrade and single-instance files were run with it), then the journey alone after the CodeScene refactor of the recorder, 1/1 in 17.2 s (`logs/r1-e2e-2.log`). The package was not rebuilt: no product file changed after `package-2`.

## Final runs on the fixed candidate

All on the clean commit `cbbb087` (tree `cb0650e3`, the gated staged tree; working-tree digest `e3b0c442…b855` = no change), in order, under the coordinator's GO, with three CPU readings before each. The only later change is this evidence section, in a docs-only commit.

| Run | CPU readings | Result | Log |
|---|---|---|---|
| `pnpm test:integration` (harness integration, registration, native-long; desktop integration) | 16.2, 23.9, 22.3 | 74 files passed, 3 skipped; 2161 tests passed, 6 skipped; 469 s | `logs/final-integration.log` |
| `pnpm test:e2e` (package plus the full suite) | 38.9, 50, 46.3 and 42.7, 48.3, 46.2 (another project's Docker stack; held and reported, Pedro closed it), then 12.1, 16.9, 13.9 | 27/27, 4.9 min | `logs/final-e2e.log` |
| `package:launch-smoke` | 14.3, 17.9, 10.1 | passed, 48 s | `logs/final-launch-smoke.log` |

No timeout occurred. Gates on the staged fix commit: `pnpm check`, jscpd 0 clones, knip, CodeScene safeguard passed (`logs/r1-gate-staged.log`).

## Review round 2 (the last; decisions log §70)

Table: main checkout `.rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/s5-review-round2.md`. All three reviewers passed T1-T12 with no new defect. Applied without a third round, in one fix commit:
- F1: the design's Developer Context "S5 review round 2" records that R9 does not settle the log-link carry-forward; the positive link is residual risk at the C1 gate, with one remaining trigger (design re-stamped `content_hash 8664099f…`).
- S1: the close failure carries the journey failure as `cause` (T6 row above).
- S2: the T3 row says the binding does not distinguish the old and new checks and argues closure from code.
- S3: the T3 row cites `conversation.test.ts:110`.
- S4: `desktopLogLines` is no longer exported.

**Residual risk (§70):** this fix commit is not reviewed by a third round; the T6 double-failure branch was never executed; the positive `process-entry` → desktop log link is unproven in the real app.

## Final runs on the round 2 commit

All on the clean commit `bd72469` (tree `b0b85f05`, the gated staged tree; working-tree digest `e3b0c442…b855`), in order, under the coordinator's GO, with three CPU readings before each. No harness file changed in round 2, so `pnpm test:integration` was not rerun (its last run is on `cbbb087`, above). The only later change is this evidence section, in a docs-only commit.

| Run | CPU readings | Result | Log |
|---|---|---|---|
| gates on the staged round-2 content | — | `pnpm check` 0, jscpd 0 clones, knip 0, CodeScene safeguard passed (2/2) | `logs/r2-gate-staged.log` |
| `pnpm test:e2e` | 9.4, 17, 10.4 | 27/27, 5.3 min | `logs/r2-final-e2e.log` |
| `package:launch-smoke` | 25.2, 29.1, 23.6 | passed, 47 s | `logs/r2-final-launch-smoke.log` |
| CNV-B52 mutation, once: `pnpm exec stryker run --force --mutate "apps/desktop/src/renderer/projects-list.tsx:50-56"` | 22.9, 26.1, 22.1 | `projects-list.tsx`: 23 mutants, 23 killed, 0 survived, 0 timeout, 0 no coverage; mutation score 100 % (182 s). No survivor to classify. The `✘ … (covered 0)` rows in the log are Stryker's per-test list of tests that killed no mutant, not failures | `logs/r2-stryker-cnv-b52.log` |

No timeout occurred.
