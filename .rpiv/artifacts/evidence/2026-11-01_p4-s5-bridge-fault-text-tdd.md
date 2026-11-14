# TDD record: p4-s5-bridge-fault-text

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, `content_hash c75516dcd4c465cab766be302e6d87cafec42b9c0ed5cffafcd37086bfeb77f7`; `validate-artifact: OK`; append-only against `approved-c75516dc.md`: keep. Lane normal.
- Worktree `slopstop-p4`, branch `fix/arch-review-phase-4`, rebased onto main `39e37b1`. The brief's base `603298b` is now `4ca3023`; `git diff 603298b 4ca3023 -- apps packages stryker*.json` is empty, so the source equals the base.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` in the main checkout (`p4-s5-*`). Desktop main tests use `--config vitest.main.config.ts`.
- Predictions are written before each run and never edited.

## P4-B13 baseline: observed

- `p4-s5-baseline.log` (parent `4ca3023`, no edits): `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose` over the storage, workspace, harness-bridges and core test files. Exit 0, **4 files, 84 passed (84)**. Per file (grep count minus the `# cmd:` line): `project-storage-bridge` 21, `workspace-bridge` 39, `harness-bridges` 13, `harness-request-core` 11. The first three are the P4-B13 pin counts.

## P4-B12 red: prediction, written before the run

- Test edit only: `harness-request-core.test.ts` imports `bridgeFaultText` and `type ProjectRequestFault` and adds `describe("bridge fault text")` with the 17-row `it.each` `names every request fault in the bridge's words: %s`.
- `p4-s5-red`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/harness-request-core.test.ts` in `apps/desktop`. Exit 1; **17 failed, 11 passed (28)**. Each of the 17 fails with a `TypeError` that `bridgeFaultText` is not a function (the import of a missing export is `undefined` under Vite's ESM transform, not a load error). The 11 existing rows pass.

## P4-B12 red: observed

- `p4-s5-red.log`: exit 1, **17 failed, 11 passed (28)**; each failure reads `bridgeFaultText is not a function`. Matches.

## Implementation

- `harness-request-core.ts`: `bridgeNeutralText` removed; exports `bridgeFaultText(fault, texts)` and its `BridgeFaultTexts` type (`{ noun, stopped, echo }`). A `Match` over the seven kinds, with two private helpers (`protocolFaultText`, `desktopFaultText`) that build each text per answer, never at module load. The core now imports `harnessSendFailureMessage`.
- `project-storage-bridge.ts`: `desktopText`, `protocolText`, `faultText` and the `Match`, `ProjectRequestFault` and `harnessSendFailureMessage` imports removed; `const stoppedText` kept; the broken answer calls `bridgeFaultText` with noun `Project Storage`, `stoppedText` and its echo text.
- `workspace-bridge.ts`: `desktopText`, `protocolText`, `faultText` and the same imports removed; both broken answers call `bridgeFaultText` with noun `workspace`, the stopped text inline and their own echo text. The `stopped` fault still answers the closing envelope first.

## P4-B12 green and P4-B13 pins: prediction, written before the run

- `p4-s5-green`: the baseline command (`--reporter=verbose`, the storage, workspace, harness-bridges and core test files). Exit 0, **4 files, 101 passed (101)**: storage 21, workspace 39, harness-bridges 13 (the pins, unchanged from the baseline) and core 28 (11 + 17). The three pin test files have no diff.

## P4-B12 green and P4-B13 pins: observed

- `p4-s5-green.log`: exit 0, **4 files, 101 passed (101)**; storage 21, workspace 39, harness-bridges 13, core 28. `git diff --stat` lists only the core, its test and the two bridges; the three pin test files are unedited. Matches.

## Stryker ranges: an unrecorded run

- `p4-s5-ranges-red.log` ran without a saved prediction: the command that should have appended it failed first (a `tail -1` over two files), so the append did not run, and the log ran after it. Its result (exit 1, `STRYKER_RANGE_BROKEN` on `project-storage-bridge.ts:30-131` past line 107 and `workspace-bridge.ts:93-229` past line 204, nothing else) is not counted as a predicted red. The run is repeated below with its prediction recorded first.

## Stryker ranges red: prediction, written before the run

- The edits removed lines above and inside both `desktop-s7` bridge ranges: `project-storage-bridge.ts` is now 107 lines (`const stoppedText` at 28), `workspace-bridge.ts` 204 lines (`const closingDiagnostic` at 90). No file is edited since `p4-s5-ranges-red`.
- `p4-s5-ranges-red-2`: `pnpm check:mutation-ranges` at the repo root. Exit 1, `STRYKER_RANGE_BROKEN`: `project-storage-bridge.ts:30-131` and `workspace-bridge.ts:93-229` end past the file's last line (107, 204). No other entry is reported.

## Stryker ranges red: observed

- `p4-s5-ranges-red-2.log`: exit 1, `STRYKER_RANGE_BROKEN` on exactly the two entries, past lines 107 and 204. Matches.

## Stryker ranges green: prediction, written before the run

- Re-pointed by line only, in `stryker.desktop-s7.config.json` and `stryker-range-anchors.json` (texts `first`/`last` unchanged): `project-storage-bridge.ts:28-107` (from `const stoppedText` to the file's last `}`), `workspace-bridge.ts:90-204` (from `const closingDiagnostic = {` to the file's last `}`). Counts unchanged, so `check-stryker-ranges.test.mjs` is not edited.
- `p4-s5-ranges-green`: `pnpm check:mutation-ranges`. Exit 0.

## Stryker ranges green: observed

- `p4-s5-ranges-green.log`: exit 0; `stryker.config.json` 18 ranges, 35 whole files; `stryker.desktop-s7.config.json` 6 ranges, 3 whole files (both as at `603298b`). Matches.

## Bindings: prediction, written before the runs

Each binding edits only `harness-request-core.ts` (pairs in the session scratchpad `p4s5bind/1.py` to `3.py`), runs `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose` over the core, storage, workspace and harness-bridges test files in `apps/desktop`, then restores the file from its backup and checks its digest.

- `p4-s5-bind-1` (the `uncorrelated` text without the noun): exit 1, **5 failed, 96 passed (101)**:
  - core `names every request fault in the bridge's words: protocol uncorrelated`;
  - storage `rejects mismatched, uncorrelated, disconnected, and stopped requests` and `fails all pending work as protocol on uncorrelated result`;
  - workspace `rejects invalid response correlation`;
  - harness-bridges `cross-bridge uncorrelated result` (not named in the brief's binding; its storage answer carries the same template text, `harness-bridges.test.ts:309`).
- `p4-s5-bind-2` (`unsent` answers `texts.echo`): exit 1, **4 failed, 97 passed (101)**:
  - core `... : unsent`;
  - storage `rejects mismatched, uncorrelated, disconnected, and stopped requests` (open after stop);
  - workspace `answers the stopped text for a request made after stop` and `stops once and rejects later requests without observing the session` (its two after-stop requests; not named in the brief's binding, same guard);
  - no harness-bridges row: every `storageStopped` answer there is work pending at stop, the `stopped` kind.
- `p4-s5-bind-3` (`transport` text changed to "Harness session dropped."): exit 1, **6 failed, 95 passed (101)**:
  - core `... : transport`;
  - storage `rejects mismatched, uncorrelated, disconnected, and stopped requests` (disconnected);
  - workspace `fails all pending work on disconnect` and `keeps a connected pending request until response or lifecycle failure` (not named in the brief);
  - harness-bridges `a throwing shared stop` and `release with two failures` (both expect `queryTransport`; not named in the brief).
- Each restore prints `OK`.

## Bindings: observed

- `p4-s5-bind-1.log`: exit 1, **5 failed, 96 passed (101)**; exactly the five predicted rows. Restored, digest `acbb6aa5…b06b` OK.
- `p4-s5-bind-2.log`: exit 1, **4 failed, 97 passed (101)**; exactly the four predicted rows. Restored OK.
- `p4-s5-bind-3.log`: exit 1, **6 failed, 95 passed (101)**; exactly the six predicted rows. Restored OK.
- Each binding catches more rows than the brief names (bind-1: harness-bridges `cross-bridge uncorrelated result`; bind-2: workspace `stops once and rejects later requests without observing the session`; bind-3: workspace `keeps a connected pending request until response or lifecycle failure`, harness-bridges `a throwing shared stop` and `release with two failures`). Each was named in the prediction with its reason: the same owner text reaches those rows.

## Structural checks and gates (uncommitted candidate on `4ca3023`)

- Structural checks from the brief: the storage and workspace bridges hold no `Match`, `faultText`, `desktopText`, `protocolText`, `bridgeNeutralText` or `harnessSendFailureMessage`; no `bridgeNeutralText` anywhere in `apps/desktop/src`; one `export function bridgeFaultText` (`harness-request-core.ts:43`). `git diff 603298b --stat` lists the six affected paths plus the two documents main changed since (this brief and `2026-10-05_conversation-decisions.md`, the coordinator's commits).
- CodeScene 10 on the core, both bridges and the core test (`p4-s5-codescene.log`).
- `p4-s5-typecheck.log` exit 0; `p4-s5-knip.log` exit 0 (`bridgeFaultText` and `BridgeFaultTexts` are used); `p4-s5-jscpd.log` exit 0 (no clone between the two bridges).
- CPU before `pnpm check`: 10.9%, 13.3 GB free, no League/TFT. `p4-s5-check.log` exit 0, **120 files, 3900 passed (3900)** (3883 at the base plus the 17 P4-B12 rows); dependency-cruiser clean.
- Full-integration exposure (not run on this candidate, per the brief): the e2e journeys that show a storage or workspace fault text (`conversation.test.ts`, `conversation-accessibility.test.ts`, `projects.test.ts`) and `package:launch-smoke`; one run each at the Phase 4 final `check:deep`.

## Follow-up (coordinator decision: take the verifier polish)

- p4-s5 accepted on substance at `bb61356`. The coordinator decided to take the polish: `workspaceBridgeOver` gains `workspaceFaultText(fault, echo)`, built inside the function, the one owner of the workspace noun and stopped text; both broken answers call it. No text change, no new behavior: the P4-B13 pins are the oracle, so no red is expected. The file is now 200 lines, `const closingDiagnostic` at 91, so the `desktop-s7` workspace range and its anchor row are re-pointed to `workspace-bridge.ts:91-200`.

## Follow-up: prediction, written before the runs

- `p4-s5-v1-tests`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/workspace-bridge.test.ts src/main/harness-bridges.test.ts` in `apps/desktop`. Exit 0, **52 passed (52)**: workspace 39, harness-bridges 13, as before.
- `p4-s5-v1-ranges`: `pnpm check:mutation-ranges`, exit 0 with the same counts (`stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files).
- `p4-s5-v1-typecheck` (`pnpm --filter @slopstop/desktop typecheck`), `p4-s5-v1-biome` (`pnpm exec biome check` on the file), `p4-s5-v1-knip`, `p4-s5-v1-jscpd`: each exit 0. CodeScene 10 on `workspace-bridge.ts`.

## Follow-up: observed

- `p4-s5-v1-tests.log`: exit 0, **52 passed (52)**; workspace 39, harness-bridges 13. Matches.
- `p4-s5-v1-ranges.log`: exit 0; `stryker.config.json` 18 ranges, 35 whole files; `desktop-s7` 6 ranges, 3 whole files. Matches.
- `p4-s5-v1-typecheck.log`, `p4-s5-v1-biome.log`, `p4-s5-v1-knip.log`, `p4-s5-v1-jscpd.log`: each exit 0. CodeScene 10 (`p4-s5-v1-codescene.log`). Matches.
