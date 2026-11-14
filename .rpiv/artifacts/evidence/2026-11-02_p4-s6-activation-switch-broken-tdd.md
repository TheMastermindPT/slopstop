# TDD record: p4-s6-activation-switch-broken

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, `content_hash 5ce0d79b8503cb91826b598a2870f62f96eb2d71604e98641115cd3436a4e52c` (main `11789f5`: the approved `77d46ce1…0cd7` plus one appended Developer Context line); `validate-artifact: OK`; append-only against `approved-77d46ce1.md`: keep. Lane **rigorous**; Q14 (a).
- Worktree `slopstop-p4`, branch `fix/arch-review-phase-4`, rebased onto main `11789f5`. One conflict, in this brief's `## TDD Evidence (implement)`: main's p4-s5 line (with its acceptance) replaced the s5 commit's shorter line; the brief equals main's. The brief's base `d885c9b` is now `be54239`; `git diff d885c9b be54239 -- apps packages stryker*.json` is empty.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` in the main checkout (`p4-s6-*`). Desktop main tests use `--config vitest.main.config.ts`; per-file counts come from `--reporter=verbose` rows (grep count minus the `# cmd:` line when the file is named there).
- Predictions are written before each run and never edited.

## Test edits (written before any run)

- `packages/protocol/src/canonical-project-protocol.test.ts`: new `describe("harness rows in a broken activation and switch")` with `carries an exact harness row in a broken %s: %s` (6 rows: activation and switch × the 3 codes), oracle as in P4-B15.
- `packages/protocol/src/protocol.test.ts` (P4-B16, only the five named tests): titles `… at protocol version 10`, `… under protocol version 10` (×2), `refuses a version-9 peer as an unsupported version` (its peer literals `8` → `9`); `toBe(9)` → `toBe(10)` at the four sites; the literals inside those tests (`:295`, `:345`, `:351`, `:1008`) → `10`. The other five literals in this file (`:235`, `:270`, `:659`, `:713`, `:732`, in tests and fixtures P4-B16 does not name) move with `protocol.ts` at green, as whole-file pins.
- `apps/desktop/src/main/project-entry-bridge.test.ts`: deleted `rejects activation replies for a different Project even with a matching message correlation`, `keeps the activation result unchanged on %s`, `keeps the switch result unchanged on %s` (with `legacyFaults`, `projectConnectionUnavailable`). Added P4-B14 `answers a broken %s with its harness row: %s` (12 table rows: 2 operations × 3 `request.failure` codes, a session protocol error, a wrong-event reply, a reply for another Project; plus 2 × an invalid local message id and 2 × a send refused as `HARNESS_SESSION_MESSAGE_INVALID` through `ScriptedHarnessSession`: 16) and P4-B18 `keeps a %s unavailable when it was not sent or was lost: %s` (8 rows).

## Baseline: prediction, written before the run

- The three edited test files are set aside with `git stash push` on exactly those files, then restored with `git stash pop`; `git diff --stat` checked before and after.
- `p4-s6-baseline-desktop`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-entry-ipc.test.ts src/main/request-fault-meaning.test.ts src/main/project-entry-bridge.test.ts` in `apps/desktop`: exit 0, all pass. `request-fault-meaning` 17 rows (as at p4-s3).
- `p4-s6-baseline-renderer`: `pnpm exec vitest run --reporter=verbose src/renderer/app.test.tsx` in `apps/desktop`: exit 0, all pass.
- `p4-s6-baseline-protocol`: `pnpm exec vitest run --reporter=verbose src/harness-fatal-log-protocol.test.ts src/canonical-project-protocol.test.ts src/protocol.test.ts` in `packages/protocol`: exit 0, all pass.
- `p4-s6-baseline-harness`: `pnpm exec vitest run --reporter=verbose src/process-fatal-diagnostics.test.ts` in `apps/harness`: exit 0, all pass.
- The per-file counts observed are the P4-B18 pins and the reference for the red and green counts.

## Baseline: observed

- Stash and pop left `git diff --stat` identical (3 test files, 259 insertions, 68 deletions).
- `p4-s6-baseline-desktop.log`: exit 0, **149 passed (149)**: `project-entry-ipc` 9, `request-fault-meaning` 17, `project-entry-bridge` 123.
- `p4-s6-baseline-renderer.log`: exit 0, **10 passed** (`app.test.tsx`).
- `p4-s6-baseline-protocol.log`: exit 0, **392 passed (392)**: `harness-fatal-log-protocol` 62, `canonical-project-protocol` 280, `protocol` 50.
- `p4-s6-baseline-harness.log`: exit 0, **18 passed** (`process-fatal-diagnostics`).
- Matches. The P4-B18 whole-file pins: `project-entry-ipc` 9, `request-fault-meaning` 17, `app` 10, `harness-fatal-log-protocol` 62, `process-fatal-diagnostics` 18.

## P4-B14, P4-B15, P4-B16 red: prediction, written before the run

- `p4-s6-red-protocol`: `pnpm exec vitest run --reporter=verbose src/canonical-project-protocol.test.ts src/protocol.test.ts` in `packages/protocol`. Exit 1, **11 failed, 325 passed (336)**:
  - `canonical-project-protocol` 286 rows (280 + 6): the 6 `carries an exact harness row in a broken %s: %s` rows fail at the first assertion (`decodeStrict` throws: the activation `broken` arm rejects a harness code; the switch result has no `broken` status). Every other row passes.
  - `protocol` 50 rows: 5 fail. `expect(protocolVersion).toBe(10)` receives `9` in `parses workspace commands and correlated result events under protocol version 10`, `round-trips Project Storage envelopes under protocol version 10`, `refuses a version-9 peer as an unsupported version` and `encodes and decodes the upgrade request and result strictly` (in the last, an earlier assertion may fail first: its expected command carries `protocolVersion: 10`); `parses only correctly scoped failure events at protocol version 10` fails because its version-10 event answers `PROTOCOL_VERSION_UNSUPPORTED`.
- `p4-s6-red-desktop`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-entry-bridge.test.ts` in `apps/desktop`. Exit 1, **16 failed, 124 passed (140)** (123 − 7 deleted + 24 new). The 16 P4-B14 rows fail: each answer is `unavailable` (activate, retryable `true`) or `coordinator-unavailable` (switch, retryable `false`) with `PROJECT_COORDINATOR_UNAVAILABLE` and the connection-lost message. The 8 P4-B18 `keeps a %s unavailable …` rows pass.

## Red: observed

- `p4-s6-red-protocol.log`: exit 1, **11 failed, 325 passed (336)**; exactly the 6 P4-B15 rows and the 5 P4-B16 tests. Reasons: 3 activation rows `Expected "PROJECT_STORAGE_BROKEN" | …` (the code list), 3 switch rows `Expected { "status": "target-result" } | … | "release-failed"` (no `broken`); 3 × `expected 9 to be 10`; the scoped-failure test `expected { ok: false … } to deeply equal { ok: true … }`; the upgrade test `expected { protocolVersion: 9 … } to deeply equal { protocolVersion: 10 … }` (its earlier command assertion, as allowed). Matches.
- `p4-s6-red-desktop.log`: exit 1, **16 failed, 124 passed (140)**; exactly the 16 P4-B14 rows: 8 activate rows `expected { status: 'unavailable' … } to deeply equal { status: 'broken' … }`, 8 switch rows `expected { …(3) }` (the diffs show `"status": "coordinator-unavailable"`). The 8 `keeps a %s unavailable …` rows pass. Matches.

## Implementation

- `protocol.ts`: `protocolVersion = 10 as const`.
- `canonical-project-protocol.ts`: imports `exactRowSchema` and `harnessFailureRows` (package-internal); `activationDiagnosticSchema(codes)` split out of `activationFailureSchema` (whose status is now `rejected | unavailable`); `harnessRowSchema` (the three exact rows) and `activationBrokenDiagnosticSchema` (today's broken diagnostic, unchanged codes, or a harness row); the activation `broken` arm uses it; the switch result gains `{ status: "broken", request, diagnostic: harnessRowSchema }`. `canonicalProjectActivationDiagnosticCodes` and `index.ts` unchanged.
- `harness-failure-protocol.ts`: TSDoc only ("every desktop fault mapper reads (upgrade, conversation, activation and switch)").
- `project-entry-bridge.ts`: `projectActivationFailure` and `projectSwitchFailure` (module-private, beside the unavailable answers) read `faultMeaning`; `activate` and `switchProject` take them as `broken`; the `unavailable` comment rewritten. `projectActivationUnavailable`/`projectSwitchUnavailable` unchanged.
- P4-B17: `protocolVersion: 9,` → `10,` in the ten listed files (harness-runtime.test.ts 10 sites, harness-runtime.integration 3, recovery fixture 2, the others 1), and the five remaining `protocol.test.ts` literals (`:235`, `:270`, `:659`, `:713`, `:732`). The literal regex now finds only the version-9 peer (`protocol.test.ts:519-520`).

## Green: prediction, written before the run

- `p4-s6-green-protocol`: `pnpm exec vitest run --reporter=verbose` over `harness-fatal-log-protocol`, `canonical-project-protocol`, `protocol`, `canonical-writer-smoke-protocol`, `schema-boundary-characterization`, `project-conversation-protocol` test files in `packages/protocol`. Exit 0, all pass; `harness-fatal-log-protocol` 62, `canonical-project-protocol` 286, `protocol` 50.
- `p4-s6-green-desktop`: `--config vitest.main.config.ts --reporter=verbose` over `project-entry-ipc`, `request-fault-meaning`, `project-entry-bridge` in `apps/desktop`. Exit 0, **166 passed (166)**: 9, 17, 140.
- `p4-s6-green-renderer`: `app.test.tsx`, exit 0, 10 passed.
- `p4-s6-green-harness`: `--reporter=verbose` over `src/process-fatal-diagnostics.test.ts src/harness-runtime.test.ts` in `apps/harness`. Exit 0, all pass; `process-fatal-diagnostics` 18.

## Green: observed — STOP (weaker than predicted)

- `p4-s6-green-desktop.log`: exit 0, **166 passed**: 9, 17, 140. Matches.
- `p4-s6-green-renderer.log`: exit 0, 10 passed. Matches.
- `p4-s6-green-harness.log`: exit 0, **121 passed**: `process-fatal-diagnostics` 18, `harness-runtime` 103. Matches.
- `p4-s6-green-protocol.log`: **exit 1, 4 failed, 1137 passed (1141)**. Not predicted. Per file: `harness-fatal-log-protocol` 62, `canonical-project-protocol` 286 (4 failed), `protocol` 50, `canonical-writer-smoke-protocol` 644, `schema-boundary-characterization` 16, `project-conversation-protocol` 83.
  - Failing: the P4-B18 pin `validates switch result branches and destination correlation` for the switch targets `PROJECT_STORAGE_BROKEN`, `WRITER_LEASE_OPEN_FAILED`, `WRITER_LEASE_LOCK_FAILED`, `WRITER_FENCE_ACTIVATION_FAILED` (the broken activation targets). Each at `rejectsSwitchExtras` → `rejectsField` (`canonical-project-protocol.test.ts:63`): an extra key on `["target", "diagnostic"]` is still rejected, but the leaf issue is `invalid_union` at `target.diagnostic`, not the expected `unrecognized_keys`.
  - Cause (read, not yet proved by a run): the activation `broken` diagnostic is now a plain `Schema.Union` (`activationBrokenDiagnosticSchema`), whose failure the issue walk reports as one `invalid_union`; the test support expands only unions registered by `wholeUnion` (`schema-codec.ts:115-121`, `expandWholeUnions`). The module already builds its other diagnostic union that way (`switchReleaseDiagnosticSchema = wholeUnion([...])`). Likely fix: build `activationBrokenDiagnosticSchema` (and `harnessRowSchema`) with `wholeUnion`; no test edit, the pin unchanged.
  - Stopped here and reported to the coordinator; no fix applied.

## Deviation: the diagnostic unions use `wholeUnion` (coordinator GO)

- The coordinator read `schema-codec.ts:187-207` (a whole union expands into its members only when `expandWholeUnions` is asked for; a plain union with several failed members collapses to one `invalid_union`) and gave GO: build `activationBrokenDiagnosticSchema` and `harnessRowSchema` (itself a union of the three exact rows) with `wholeUnion`, as `switchReleaseDiagnosticSchema` already is. No test edit; the pin is unchanged.
- Edit: `canonical-project-protocol.ts:207` `harnessRowSchema = wholeUnion(…)`, `:210` `activationBrokenDiagnosticSchema = wholeUnion([…])`. Nothing else.

## Green after the deviation: prediction, written before the run

- `p4-s6-green-protocol-2`: the same command as `p4-s6-green-protocol`. Exit 0, **1141 passed (1141)**; per file 62, 286, 50, 644, 16, 83. The four `validates switch result branches and destination correlation` rows for the broken activation targets pass: the expanded walk now reaches the free diagnostic member, whose extra key is `unrecognized_keys` at `["target", "diagnostic"]`.
- `p4-s6-green-desktop-2`: the same command as `p4-s6-green-desktop`. Exit 0, **166 passed** (9, 17, 140).

## Green after the deviation: observed

- `p4-s6-green-protocol-2.log`: exit 0, **1141 passed (1141)**; 62, 286, 50, 644, 16, 83. Matches.
- `p4-s6-green-desktop-2.log`: exit 0, **166 passed** (9, 17, 140). Matches.

## Boundary summaries unchanged (coordinator request)

- Probe: a temporary test (`packages/protocol/src/zz-p4s6-summary-probe.test.ts`, never committed, deleted after; copy `p4-s6-summary-probe.test.ts.txt` in the evidence folder) runs `summarizeSchemaError` (non-expanded, the boundary summary) through both result schemas and `parseHarnessMessage` on a `project.activate.result` / `project.switch.result` envelope, over 15 activation inputs and 22 switch inputs, each rejected at both the base and the candidate (74 entries). Run once at the candidate, then with `canonical-project-protocol.ts`, `protocol.ts` and `harness-failure-protocol.ts` swapped to their `be54239` contents and restored (digests `1613bf2d…`, `b74c3be2…`, `adedeb99…` identical before and after).
- Outputs: `p4-s6-summary-probe-base.json`, `p4-s6-summary-probe-candidate.json`. **70 of 74 entries identical; no input accepted on either side.** All 30 activation entries (schema and event) are identical, including the broken diagnostic with an extra key, an unknown code, a changed harness row and a harness row under `unavailable`.
- The 4 that differ are the switch inputs with status `broken` (a status the base did not have): `broken storage diagnostic` and `broken harness changed message`, schema and event. Base: `invalid_union` at the root (`payload`); candidate: `invalid_union` at `diagnostic` (`payload.diagnostic`). This is the new switch arm, by design: the status now exists and only its diagnostic is wrong.

## Bindings: prediction, written before the runs

Pairs in the session scratchpad `p4s6bind/1.py` to `7.py`, applied by `bind4.sh` (backup, apply, run, restore, digest check). Bindings 1, 2, 3, 5 edit `project-entry-bridge.ts` and run `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-entry-bridge.test.ts` in `apps/desktop` (140 rows); bindings 4, 6, 7 edit `canonical-project-protocol.ts` and run `pnpm exec vitest run --reporter=verbose src/canonical-project-protocol.test.ts` in `packages/protocol` (286 rows). Vitest does not typecheck, so the type-breaking mutants (4, 7) run.

- `p4-s6-bind-1` (activation: a defect answers `projectActivationUnavailable`): exit 1, **4 failed, 136 passed**: the `activate` rows `a wrong-event reply`, `a reply for another Project`, `an invalid local message id` (named in the brief) and `a send refused as an invalid message` (not named in the brief: `faultMeaning` makes that send a defect too). No `switchProject` row fails.
- `p4-s6-bind-2` (switch: `harness` answers `projectSwitchUnavailable`): exit 1, **3 failed, 137 passed**: the three `switchProject` `request.failure` rows.
- `p4-s6-bind-3` (switch: not-sent falls through to broken with the protocol-invalid row): exit 1, **2 failed, 138 passed**: `keeps a switchProject unavailable when it was not sent or was lost: a call after stop` and `…: a send that fails`.
- `p4-s6-bind-4` (the three harness codes join the activation broken code list instead of the exact rows): exit 1, **3 failed, 283 passed**: the 3 `carries an exact harness row in a broken activation: %s` rows, at the changed-message rejection (the free arm accepts any message).
- `p4-s6-bind-5` (both mappers treat every `send` as not-sent): exit 1, **2 failed, 138 passed**: `answers a broken activate …: a send refused as an invalid message` and the `switchProject` one.
- `p4-s6-bind-6` (the switch `broken` diagnostic is the activation broken union): exit 1, **3 failed, 283 passed**: the 3 `carries an exact harness row in a broken switch: %s` rows, at the `PROJECT_STORAGE_BROKEN` rejection.
- `p4-s6-bind-7` (the three harness codes join `canonicalProjectActivationDiagnosticCodes`, exact rows kept): exit 1, **6 failed, 280 passed**: all 6 P4-B15 rows at the `Schema.is(CanonicalProjectActivationDiagnosticCodeSchema)` assertion. If another row of the file enumerates that tuple it would fail too; none is known.
- Each restore prints `OK`.

## Bindings: observed

- `p4-s6-bind-1.log`: exit 1, **4 failed, 136 passed**; exactly the 4 predicted `activate` rows. Restored, digest `d2da5c51…4b62` OK.
- `p4-s6-bind-2.log`: exit 1, **3 failed, 137 passed**; the 3 `switchProject` `request.failure` rows. Restored OK.
- `p4-s6-bind-3.log`: exit 1, **2 failed, 138 passed**; the 2 predicted `keeps a switchProject unavailable …` rows. Restored OK.
- `p4-s6-bind-5.log`: exit 1, **2 failed, 138 passed**; the 2 send-refused rows. Restored OK.
- `p4-s6-bind-4.log`: exit 1, **3 failed, 283 passed**; the 3 activation P4-B15 rows, at `canonical-project-protocol.test.ts:1004` (the changed-message rejection). Restored, digest `1613bf2d…0cc6` OK.
- `p4-s6-bind-6.log`: exit 1, **3 failed, 283 passed**; the 3 switch P4-B15 rows, at `:1021` on its first diagnostic, `PROJECT_STORAGE_BROKEN`. Restored OK.
- `p4-s6-bind-7.log`: exit 1, **6 failed, 280 passed**; all 6 P4-B15 rows, at `:1029` (`Schema.is`). Restored OK.
- All match. Binding 1 caught one row more than the brief names (`a send refused as an invalid message`), predicted with its reason.

## Stryker ranges red: prediction, written before the run

- `project-entry-bridge.ts` is now 229 lines: `function projectActivationFailure(` at 83, `export const unsent` at 109, `readConversation: run({` at 199 (its `}),` at 206; `saveConversationMessage` ends at 214), the closing `}` of `projectEntryBridgeOver` at 228.
- `p4-s6-ranges-red`: `pnpm check:mutation-ranges`. Exit 1, `STRYKER_RANGE_DRIFT` on exactly two entries: `stryker.desktop-s7.config.json` `project-entry-bridge.ts:75-194` (its `first` text `export const unsent …` is no longer at line 75) and `stryker.config.json` `project-entry-bridge.ts:165-180` (`readConversation: run({` is no longer at 165). Nothing BROKEN, UNANCHORED or STALE_ANCHOR (both ends lie inside the file and both anchor rows still match their config entries).

## Stryker ranges red: observed

- `p4-s6-ranges-red.log`: exit 1, `STRYKER_RANGE_DRIFT` on exactly the two entries. The checker proposes `stryker.config.json` `:199-214` and `desktop-s7` `:109-228` (following the old `export const unsent` anchor, which would leave both mappers unmutated, as the brief warns). Matches.

## Stryker ranges green: prediction, written before the run

- Re-pointed: `stryker.desktop-s7.config.json` `project-entry-bridge.ts:83-228`, anchor row `first` changed to `function projectActivationFailure(` (`last` `}` unchanged); `stryker.config.json` `project-entry-bridge.ts:199-214`, anchor row line numbers only.
- `p4-s6-ranges-green`: `pnpm check:mutation-ranges`. Exit 0; `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files (unchanged). `check-stryker-ranges.test.mjs` not edited.

## Stryker ranges green: observed

- `p4-s6-ranges-green.log`: exit 0; `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files. Matches.

## Structural checks and light gates (uncommitted candidate on `be54239`)

- Structural checks: none of the three deleted tests remain; the version regex finds only the version-9 peer (`protocol.test.ts:519-520`); no "both desktop mappers"; `harnessFailureRows` in `project-entry-bridge.ts` at the import and the two mappers, `faultMeaning(` at the two mappers; the `desktop-s7` anchor `first` is `function projectActivationFailure(` (one hit) and the range starts at its line 83; `git diff be54239` over `project-entry-ipc.ts`, `renderer`, `preload`, `index.ts` is empty.
- `p4-s6-typecheck.log` exit 0; `p4-s6-knip.log` exit 0; `p4-s6-jscpd.log` exit 0, 0 clones.
- **CodeScene: `project-entry-bridge.ts` 9.38** (Code Duplication: `projectActivationFailure` 83-93 and `projectSwitchFailure` 96-106); `canonical-project-protocol.ts`, both test files 10 (`p4-s6-codescene.log`). The CodeScene-10 gate is not met. Reported to the coordinator before any refactor: sharing the classification between the two mappers changes what bindings 1, 2, 3 and 5 prove (each would bite both operations, so binding 1's "the switchProject rows stay green" no longer holds).

## Deviation: one shared entry fault mapper (coordinator decision, CodeScene 10)

- The coordinator took option (a): `projectActivationFailure` and `projectSwitchFailure` become `entryFailure(projectActivationUnavailable)` and `entryFailure(projectSwitchUnavailable)`. `entryFailure<Request, Result>(unavailableAnswer)` (`project-entry-bridge.ts:83`) holds the one classification; the per-operation unavailable answer is its input and the result shape follows from it. Behavior is meant to be unchanged; the file is now 217 lines.
- CodeScene on the refactored file: **10** (was 9.38). Typecheck of `apps/desktop` (`tsc --noEmit`) clean, no output.
- Consequence: bindings 1, 2, 3 and 5 now mutate the one shared mapper, so each bites both operations. Their earlier observations stay as history for the two-mapper candidate; they are re-predicted and rerun below as `p4-s6-rbind-<n>`. Bindings 4, 6 and 7 edit `canonical-project-protocol.ts`, which this refactor does not touch; their observations stand.

## Re-pointed bindings: prediction, written before the runs

Pairs in the session scratchpad `p4s6rbind/1.py`, `2.py`, `3.py`, `5.py` (each old text matches once), run by `bind4.sh` with the same command as before in `apps/desktop` (140 rows).

- `p4-s6-rbind-1` (a defect answers the unavailable answer): exit 1, **8 failed, 132 passed**: for both `activate` and `switchProject`, `a wrong-event reply`, `a reply for another Project`, `an invalid local message id`, `a send refused as an invalid message`.
- `p4-s6-rbind-2` (a harness failure answers the unavailable answer): exit 1, **6 failed, 134 passed**: the three `request.failure` rows for both operations.
- `p4-s6-rbind-3` (not-sent falls through to the protocol-invalid row): exit 1, **4 failed, 136 passed**: `keeps a %s unavailable …: a call after stop` and `…: a send that fails`, for both operations.
- `p4-s6-rbind-5` (every `send` fault is not-sent): exit 1, **2 failed, 138 passed**: the two `a send refused as an invalid message` rows (unchanged: the earlier pair already edited both mappers).
- Each restore prints `OK`.

## Stryker ranges after the refactor: prediction, written before the run

- Re-pointed before the run: `stryker.desktop-s7.config.json` `project-entry-bridge.ts:83-216`, anchor `first` `function entryFailure<Request, Result>(` (`last` `}` unchanged); `stryker.config.json` `project-entry-bridge.ts:187-202`, anchor row line numbers only. The desktop-s7 range still starts at the mapper, so it stays mutated.
- `p4-s6-ranges-green-2`: `pnpm check:mutation-ranges`. Exit 0; `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files.

## Re-pointed bindings: observed

- `p4-s6-rbind-1.log`: exit 1, **8 failed, 132 passed**; exactly the 8 predicted rows. Restored, digest `aab2dd14…6e17` OK.
- `p4-s6-rbind-2.log`: exit 1, **6 failed, 134 passed**; the 6 `request.failure` rows. Restored OK.
- `p4-s6-rbind-3.log`: exit 1, **4 failed, 136 passed**; the 4 predicted `keeps a %s unavailable …` rows. Restored OK.
- `p4-s6-rbind-5.log`: exit 1, **2 failed, 138 passed**; the 2 send-refused rows. Restored OK.
- All match.

## Process slip: `p4-s6-green-3` ran without a saved prediction and with a wrong path

- `p4-s6-green-3.log` named `src/main/ipc.test.ts`, a file that does not exist (the earlier run used `src/main/project-entry-ipc.test.ts`); Vitest ran the other 2 files: exit 0, 157 passed (`request-fault-meaning` 17, `project-entry-bridge` 140). No prediction was written before it. It does not count; it is repeated below as `p4-s6-green-4` with its prediction.

## Stryker ranges after the refactor: observed (weaker than predicted)

- `p4-s6-ranges-green-2.log`: exit 1, `STRYKER_RANGE_DRIFT` on `stryker.desktop-s7.config.json` `project-entry-bridge.ts:83-216`, "first line found nowhere". Cause: the anchor `first` must be the whole source line, and the prediction's text was only its prefix `function entryFailure<Request, Result>(`. The `stryker.config.json` entry passed. Fixed: `first` is now the whole line `function entryFailure<Request, Result>(unavailableAnswer: (request: Request) => Result) {`.

## Green after the refactor and ranges: prediction, written before the runs

- `p4-s6-green-4`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-entry-ipc.test.ts src/main/request-fault-meaning.test.ts src/main/project-entry-bridge.test.ts` in `apps/desktop`. Exit 0, **166 passed** (9, 17, 140), as in `p4-s6-green-desktop-2`.
- `p4-s6-ranges-green-3`: `pnpm check:mutation-ranges`. Exit 0; `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files.

## Green after the refactor and ranges: observed

- `p4-s6-green-4.log`: exit 0, **166 passed** (`project-entry-ipc` 9, `request-fault-meaning` 17, `project-entry-bridge` 140). Matches.
- `p4-s6-ranges-green-3.log`: exit 0; `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files. Matches.

## Light gates after the refactor: prediction, written before the runs

- `p4-s6-typecheck-2` (`pnpm typecheck`), `p4-s6-knip-2` (`pnpm check:dead-code`), `p4-s6-jscpd-2` (`pnpm check:duplicates`): each exit 0; jscpd 0 clones.
- CodeScene on `project-entry-bridge.ts`: 10, appended to `p4-s6-codescene.log`.

## Light gates after the refactor: observed

- `p4-s6-typecheck-2.log`, `p4-s6-knip-2.log`, `p4-s6-jscpd-2.log` (0 clones): each exit 0. CodeScene `project-entry-bridge.ts` 10, appended to `p4-s6-codescene.log`. Matches.

## `pnpm check`: prediction, written before the run

- CPU read in its own call: 3, 9.8, 7 %; 13.9 GB free; no League/TFT process.
- `p4-s6-check`: `pnpm check`. Exit 0, no failed test. The total is not predicted as an exact number (the slice adds and removes rows across four packages); it is recorded as observed.

## `pnpm check`: observed

- `p4-s6-check.log`: exit 0; 120 test files, **3923 passed**, none failed (s5 was 3900). The one `SlopStop failed to start.` line is a test's stderr, present once in `p4-s5-check.log` as well. Matches.

## Candidate commit

- `b0a4cc3` on `be54239`: 22 files. Biome changed nothing: the staged diff hash equals the commit diff hash (`96b491b6…`).
- Process slip: the message file had no blank line after the header, so git took the header and the first body paragraph as the subject (commitlint only warned, `body-leading-blank`). The coordinator decided to leave it: the phase branch is squashed into main at the end. From now on every message file keeps the blank line after the header.

## Q14 heavy runs on `b0a4cc3`: prediction, written before the runs

- Coordinator GO after Pedro's "livre". CPU read in its own call: 3.3, 2.6, 2.9 %; 13.3 GB free; no League/TFT process. One run at a time, no watcher, no timeout change, no rerun.
- `p4-s6-e2e`: `pnpm test:e2e` (forge package, then Playwright). Exit 0, no failed test.
- `p4-s6-integration`: `pnpm test:integration` at the root (the only integration entry: harness integration, registration, native-long, and desktop integration projects). Exit 0, no failed test; the pinned `protocolVersion: 10` fixtures decode.
- `p4-s6-launch-smoke`: `pnpm package:launch-smoke`. Exit 0.

## Q14 heavy runs on `b0a4cc3`: observed

- `p4-s6-e2e.log`: exit 0, **27 passed** (5.2 min). Matches.
- `p4-s6-integration.log`: exit 0; 81 files passed, 3 skipped; **2234 passed, 6 skipped**, none failed. The same 6 skips appear in Phase 3 (`p3-acceptance-check-deep-4.log`): host-gated rows (for example the symlink row that skips on EPERM). Matches.
- `p4-s6-launch-smoke.log`: exit 0, "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." Matches.

## History marker (pre-refactor sections)

- The sections "Bindings: prediction" and "Bindings: observed" for bindings 1, 2, 3 and 5, "Stryker ranges red/green", and "Structural checks and light gates (uncommitted candidate on `be54239`)", and the first entry of `p4-s6-codescene.log`, describe the two-mapper state (`projectActivationFailure` at 83-93, `projectSwitchFailure` at 96-106, file 229 lines). They are history. The current state is in "Deviation: one shared entry fault mapper" and the sections after it.

## Candidate review round 1 and Pedro's triage

- Review table: `p4-s6-candidate-review.md` (0 blockers, 1 concern, 1 warning, 1 suggestion). Pedro's triage (relayed by the coordinator): (1) fix the P4-B15 code/message pairing pin and build `harnessRowSchema` as an explicit tuple; (2) the shared `entryFailure` accepted as a deviation, recorded in the brief by the coordinator; (3) run the sent-then-lost binding. Polish: the brief TDD Evidence line and this history marker. One fix commit; no heavy rerun; no second review round.

## Fix (1): test edit, written before any run

- `canonical-project-protocol.test.ts`, inside `carries an exact harness row in a broken %s: %s`: after the changed-message rejection, for each of the two other harness codes, reject the row carrying that code's message (`{ ...row, message: protocol.harnessFailureRows[other].message }`). Row count unchanged (286 in the file).

## Fix (1) red against the cross-product mutant: prediction, written before the run

- Mutant (`p4s6fix/cross.py`, applied by `bind4.sh`, restored by digest): `harnessRowSchema` becomes one `Schema.Struct({ code: HarnessFailureCodeSchema, message: Schema.Literals(Object.values(harnessFailureMessages)), retryable: Schema.Literal(false) })`.
- `p4-s6-fix-red-cross`: `pnpm exec vitest run --reporter=verbose src/canonical-project-protocol.test.ts` in `packages/protocol`. Exit 1, **6 failed, 280 passed**: all 6 `carries an exact harness row in a broken %s: %s` rows, at the new mixed-pair rejection (the first other code's message is accepted). Restore prints `OK`.

## Fix (1) red: observed

- `p4-s6-fix-red-cross.log`: exit 1, **6 failed, 280 passed**; all 6 P4-B15 rows, at `canonical-project-protocol.test.ts:1006` (the mixed-pair rejection). Restored, digest `1613bf2d…0cc6` OK. Matches.

## Fix (1) implementation

- `canonical-project-protocol.ts`: `harnessRowSchema = wholeUnion([exactRowSchema(harnessFailureRows.PROTOCOL_MESSAGE_INVALID), exactRowSchema(harnessFailureRows.PROTOCOL_VERSION_UNSUPPORTED), exactRowSchema(harnessFailureRows.HARNESS_INTERNAL_FAILURE)])`, an explicit tuple so each code keeps its message in the type (as `project-upgrade-protocol.ts:123-128`). Runtime acceptance unchanged.

## Fix green and sent-then-lost binding: prediction, written before the runs

- `p4-s6-fix-green-protocol`: `pnpm exec vitest run --reporter=verbose src/harness-failure-protocol.test.ts src/canonical-project-protocol.test.ts src/protocol.test.ts` in `packages/protocol`. Exit 0, **398 passed** (62 + 286 + 50), as in `p4-s6-green-protocol-2` for these files.
- `p4-s6-fix-green-desktop`: the `p4-s6-green-4` command. Exit 0, **166 passed** (desktop code unchanged).
- `p4-s6-bind-lost` (`p4s6fix/lost.py`: `entryFailure` answers unavailable only for `not-sent`; `sent-then-lost` falls through to the protocol-invalid row), `project-entry-bridge.test.ts` in `apps/desktop`: exit 1, **6 failed, 134 passed**: `keeps a %s unavailable …: a lost connection while pending` and `…: a stop while pending` for `activate` and `switchProject`, and `answers the closing envelope for work in flight at stop: activate` and `…: switch`. Restore prints `OK`.

## Fix green and sent-then-lost binding: observed

- `p4-s6-fix-green-protocol.log`: exit 0, **361 passed** (`harness-failure-protocol` 25, `canonical-project-protocol` 286, `protocol` 50). **Does not match, and does not count**, for two explained reasons: (a) the tuple edit had not been applied (the edit tool refused it because the file had not been read in this session), so this run is on the old `Object.values(...).map(exactRowSchema)` schema: it shows only that the new rejection passes on the per-row union; (b) the prediction's 62 was the `harness-fatal-log-protocol` count, not `harness-failure-protocol` (25). The 361 rows themselves are the files' real counts.
- `p4-s6-fix-green-desktop.log`: exit 0, **166 passed**. Matches.
- `p4-s6-bind-lost.log`: exit 1, **6 failed, 134 passed**; exactly the 6 predicted rows. Restored, digest `aab2dd14…6e17` OK. Matches.
- The tuple edit is now applied (`canonical-project-protocol.ts:207-211`).

## Fix green after the tuple edit: prediction, written before the run

- `p4-s6-fix-green-protocol-2`: the same command. Exit 0, **361 passed** (25, 286, 50).

## Fix green after the tuple edit: observed

- `p4-s6-fix-green-protocol-2.log`: exit 0, **361 passed** (25, 286, 50). Matches.
- Brief TDD Evidence line updated to the final identity (append-only `keep`). No Stryker entry names `canonical-project-protocol.ts`, so its four new lines move no range.

## Fix gates: prediction, written before the runs

- `p4-s6-fix-typecheck`, `p4-s6-fix-knip`, `p4-s6-fix-jscpd` (0 clones), `p4-s6-fix-ranges` (`pnpm check:mutation-ranges`; 18/35 and desktop-s7 6/3), `p4-s6-fix-biome` (`pnpm exec biome check` on the two changed source files): each exit 0.
- CodeScene 10 on `canonical-project-protocol.ts` and `canonical-project-protocol.test.ts`, appended to `p4-s6-codescene.log`.

## Fix gates: observed

- `p4-s6-fix-typecheck.log`, `p4-s6-fix-knip.log`, `p4-s6-fix-jscpd.log` (0 clones), `p4-s6-fix-ranges.log` (18/35; desktop-s7 6/3), `p4-s6-fix-biome.log`: each exit 0. CodeScene 10 on both protocol files (`p4-s6-codescene.log`). Matches.

## Fix `pnpm check`: prediction, written before the run

- CPU read in its own call: 6.1, 3.2, 4.6 %; 9.3 GB free; no League/TFT process.
- `p4-s6-fix-check`: `pnpm check`. Exit 0, **3923 passed** (the fix adds assertions inside existing rows, no rows).

## Fix `pnpm check`: observed

- `p4-s6-fix-check.log`: exit 0; 120 files, **3923 passed**. Matches. The fix goes in one commit after `b0a4cc3`.

## Coordinator correction after `7f43278`

- The coordinator's diff review: the explicit `harnessRowSchema` tuple loses completeness (a fourth `HarnessFailureCode` would be rejected in a broken activation or switch, and the test's `codes` list, only `satisfies readonly HarnessFailureCode[]`, would not notice). Fix: (a) back to `wholeUnion(Object.values(harnessFailureRows).map(exactRowSchema))`, since the pairing is now pinned by the cross-message rows; (b) pin completeness in the test.

## Completeness pin: test edit, written before any run

- `canonical-project-protocol.test.ts`, in `describe("harness rows in a broken activation and switch")`: new `it("covers every harness failure row")` asserting `[...codes].sort()` equals `Object.keys(protocol.harnessFailureRows).sort()`. The file goes to 287 rows.

## Completeness pin red: prediction, written before the run

- Mutant (`p4s6fix/extra.py`, on `harness-failure-protocol.ts`, restored by digest): `harnessFailureRows` gains a hypothetical fourth key `HARNESS_EXTRA_FAILURE` with its own row (Vitest does not typecheck, so the `satisfies` mismatch does not stop the run).
- `p4-s6-fix2-red-extra`: `pnpm exec vitest run --reporter=verbose src/harness-failure-protocol.test.ts src/canonical-project-protocol.test.ts` in `packages/protocol`. Exit 1, **2 failed, 310 passed** (25 + 287 = 312): `covers every harness failure row` (the new pin) and `harness-failure-protocol.test.ts` `has one row per harness failure code` (the owner's own key check). No other row fails: every other row iterates a fixed code list, and the schema still accepts the three real rows. Restore prints `OK`.

## Completeness pin red: observed

- `p4-s6-fix2-red-extra.log`: exit 1, **2 failed, 310 passed**; exactly the 2 predicted rows. Restored, digest `adedeb99…6b3a` OK. Matches.

## Correction (a) and green: prediction, written before the runs

- `canonical-project-protocol.ts:207` is back to `wholeUnion(Object.values(harnessFailureRows).map(exactRowSchema))`, the same line as at `b0a4cc3` (`git diff b0a4cc3` on that file is empty).
- `p4-s6-fix2-green-protocol`: `pnpm exec vitest run --reporter=verbose src/harness-failure-protocol.test.ts src/canonical-project-protocol.test.ts src/protocol.test.ts` in `packages/protocol`. Exit 0, **362 passed** (25, 287, 50).
- Gates: `p4-s6-fix2-typecheck`, `p4-s6-fix2-knip`, `p4-s6-fix2-ranges` (18/35; desktop-s7 6/3), `p4-s6-fix2-biome` (the two protocol files): each exit 0. CodeScene 10 on both protocol files. No Stryker entry names either file, so no range moves and no `pnpm check` rerun.

## Correction (a) and green: observed

- `canonical-project-protocol.ts` equals its `b0a4cc3` version (`git diff b0a4cc3` on the file is empty).
- `p4-s6-fix2-green-protocol.log`: exit 0, **362 passed** (25, 287, 50). Matches.
- `p4-s6-fix2-typecheck.log`, `p4-s6-fix2-knip.log`, `p4-s6-fix2-ranges.log` (18/35; desktop-s7 6/3), `p4-s6-fix2-biome.log`: each exit 0. CodeScene 10 on both protocol files (`p4-s6-codescene.log`). Matches. One commit after `7f43278`.
