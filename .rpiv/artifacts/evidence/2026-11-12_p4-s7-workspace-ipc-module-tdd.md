# TDD record: p4-s7-workspace-ipc-module

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, slice `p4-s7-workspace-ipc-module`, lane normal (Q6 override), Q15 (a): no per-slice heavy run.
- Approved copy: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/approved-043dddf9.md` (hash `043dddf9…3938`). The branch's brief: append-only `keep` against it; `validate-artifact` reports a `content_hash` mismatch caused only by the p4-s6 TDD Evidence line the branch carries and main does not.
- Base: `fix/arch-review-phase-4` rebased onto main `29b46a6` without conflict; `0a67690` (the brief's `e2b1d48`; `git diff e2b1d48 0a67690 -- apps packages` empty).
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s7-*.log`, each with its parent and working-tree patch digest. The helper scripts were recreated in this session's new scratchpad (same behaviour; the old temp copies were gone).

## Baseline: prediction, written before the runs

- `p4-s7-baseline-desktop`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/workspace-bridge.test.ts src/main/canonical-writer-package-smoke-main.test.ts src/main/project-entry-ipc.test.ts` in `apps/desktop`. Exit 0; `workspace-bridge` 39, `canonical-writer-package-smoke-main` 80, `project-entry-ipc` 9.
- `p4-s7-baseline-boundaries`: `pnpm exec vitest run --reporter=verbose apps/harness/scripts/check-boundaries-parse.test.mjs` from the repository root. Exit 0, 2 passed.

## Baseline: observed

- `p4-s7-baseline-desktop.log`: exit 0, 128 passed (`workspace-bridge` 39, `canonical-writer-package-smoke-main` 80, `project-entry-ipc` 9). Matches.
- `p4-s7-baseline-boundaries.log`: exit 0, 2 passed. Matches.

## P4-B19 and P4-B20 tests (written before any run)

- `apps/harness/scripts/check-boundaries-parse.test.mjs`: `forbids importing the Electron entry: $name` (2 rows: a static import from `apps/desktop/src/main/workspace-bridge.test.ts`; `await import("./main.ts")` from `apps/desktop/src/main/project-entry-ipc.test.ts`), each expecting exactly `[{ rule: "no-import-of-electron-entry", from: <importer>, to: "apps/desktop/src/main/main.ts" }]`; and `allows only the smoke wiring test to import the Electron entry` (`canonical-writer-package-smoke-main.test.ts` with `await import("./main.ts")`: no violation, and the module graph contains `main.ts`). Each writes the fixture `apps/desktop/src/main/main.ts`.

## P4-B19 red: prediction, written before the run

- `p4-s7-red-boundaries`: the baseline boundaries command. Exit 1, **2 failed, 3 passed**: both `forbids importing the Electron entry` rows (received `[]`, no such rule); `allows only the smoke wiring test …` and the two `reports a forbidden TypeScript import` rows pass.

## P4-B19 red: observed

- `p4-s7-red-boundaries.log`: exit 1, **2 failed, 3 passed**; both P4-B19 rows received `[]`. Matches.

## The rule: prediction, written before the runs

- `dependency-cruiser.config.cjs`: ninth rule `no-import-of-electron-entry` (from `pathNot` `^apps/desktop/src/main/canonical-writer-package-smoke-main\.test\.ts$`, to `^apps/desktop/src/main/main\.ts$`), with a comment naming Q4 (a) and the exception.
- `p4-s7-green-boundaries`: the same command. Exit 0, **5 passed**.
- `p4-s7-red-check-boundaries`: `pnpm check:boundaries` on the real repository, before the move. Exit 1, exactly one violation: `no-import-of-electron-entry: apps/desktop/src/main/workspace-bridge.test.ts → apps/desktop/src/main/main.ts`; nothing for `canonical-writer-package-smoke-main.test.ts`.

## The rule: observed (do not count)

- Process slip: the rule edit was refused by the edit tool (the file had not been read in this session), and the two runs went ahead on the unchanged config. `p4-s7-green-boundaries.log` (exit 1, 2 failed, 3 passed: the same as the red) and `p4-s7-red-check-boundaries.log` (exit 0, no violation, 588 modules) therefore prove nothing about the rule and do not count. The rule is now applied (one `no-import-of-electron-entry` hit). From now on an edit and a run that depends on it go in separate steps.

## The rule, rerun: prediction, written before the runs

- `p4-s7-green-boundaries-2`: the boundaries command. Exit 0, **5 passed**.
- `p4-s7-red-check-boundaries-2`: `pnpm check:boundaries`, before the move. Exit 1, exactly one violation: `no-import-of-electron-entry` from `apps/desktop/src/main/workspace-bridge.test.ts` to `apps/desktop/src/main/main.ts`; nothing for `canonical-writer-package-smoke-main.test.ts`.

## The rule, rerun: observed

- `p4-s7-green-boundaries-2.log`: exit 0, **5 passed**. Matches.
- `p4-s7-red-check-boundaries-2.log`: exit 1, one violation: `no-import-of-electron-entry: apps/desktop/src/main/workspace-bridge.test.ts → apps/desktop/src/main/main.ts` (588 modules). Matches. This is the real-repository red.

## The move (session-scratchpad script `p4s7-move.py`)

- `workspace-ipc.ts` (new, 47 lines): `broadcastWorkspaceNotification` and `registerWorkspaceIpc`, moved with bodies and signatures unchanged, plus the imports they need. One TSDoc on `registerWorkspaceIpc`, in the style of `project-entry-ipc.ts`.
- `main.ts` (494 → 457): both functions go (26 lines with the blank after them), and so do the six `Workspace*` protocol imports and the `./workspace-bridge.js` import (11 lines net). It imports both from `./workspace-ipc.js`; the calls stay (now `:382` and `:384`). It exports nothing.
- `workspace-test-peers.ts` (new, test-only): `id`, `memoryQuery`, `memoryIntent`, `unavailableQueryResult`, moved unchanged and exported, each with a one-line TSDoc.
- `workspace-ipc.test.ts` (new): `keeps workspace IPC handlers narrow and validated` and `answers workspace unavailable after the IPC gate closes: $channel`, titles and assertions unchanged, at file level (the first was inside `describe("WorkspaceBridge")`, a describe this file has no use for). One hoisted electron mock (`ipcMain.handle`, `BrowserWindow.getAllWindows`), reset in a `beforeEach`. The closed-gate fake bridge's `query` answers `unavailableQueryResult(memoryQuery())` instead of `readyResult(memoryQuery(), 1)` (never called; asserted).
- `workspace-bridge.test.ts` (1168 → 1013): loses the `main.js` import, the five `vi.mock` calls, the `mainMocks` hoist, the `beforeEach` that reset it, the two moved tests and `closingMessage`, the four fixtures (now imported from `./workspace-test-peers.js`), and the `beforeEach` / `desktopIpcChannels` imports only they used.

## After the move: prediction, written before the runs

- `p4-s7-move-desktop`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/workspace-ipc.test.ts src/main/workspace-bridge.test.ts src/main/canonical-writer-package-smoke-main.test.ts src/main/project-entry-ipc.test.ts` in `apps/desktop`. Exit 0, **128 passed**: `workspace-ipc` 3, `workspace-bridge` 36, `canonical-writer-package-smoke-main` 80, `project-entry-ipc` 9.
- `p4-s7-move-check-boundaries`: `pnpm check:boundaries`. Exit 0, no violation; 591 modules (588 + the three new files).
- `p4-s7-ranges-red`: `pnpm check:mutation-ranges`. Exit 1, `STRYKER_RANGE_DRIFT` on exactly the three `stryker.desktop-s6.config.json` `main.ts` entries: `:94-104` (its `first` now at 83), `:273-288` (`export function registerWorkspaceIpc(` no longer in `main.ts`) and `:406-406` (now at 369). No other entry.

## After the move: observed

- `p4-s7-move-desktop.log`: exit 0, **128 passed** (3, 36, 80, 9). Matches.
- `p4-s7-move-check-boundaries.log`: exit 0, no violation, 591 modules. Matches.
- `p4-s7-ranges-red.log`: exit 1, `STRYKER_RANGE_DRIFT` on exactly the three `main.ts` entries: `:94-104` moved to `:83-93`; `:273-288` first line found nowhere; `:406-406` moved to `:369-369`. Matches.

## Re-point and mutation configs: prediction, written before the run

- `stryker.desktop-s6.config.json` and `stryker-range-anchors.json`: `main.ts:83-93`, `workspace-ipc.ts:32-47` (from `export function registerWorkspaceIpc(` to its closing `}`; anchor texts unchanged), `main.ts:369-369`.
- `apps/desktop/vitest.desktop-s6-mutation.config.ts` names `workspace-ipc.test.ts` in place of `workspace-bridge.test.ts`; `apps/desktop/vitest.desktop-s7-mutation.config.ts` adds `workspace-ipc.test.ts` after `workspace-bridge.test.ts`.
- `p4-s7-ranges-green`: `pnpm check:mutation-ranges`. Exit 0; `stryker.desktop-s6.config.json` 14 ranges, 2 whole files; `stryker.config.json` 18 / 35 and `desktop-s7` 6 / 3 unchanged.

## Re-point and mutation configs: observed

- `p4-s7-ranges-green.log`: exit 0; `stryker.config.json` 18 / 35, `desktop-s6` 14 / 2, `desktop-s7` 6 / 3. Matches.

## Bindings 1-4: prediction, written before the runs

Pairs in the session scratchpad `p4s7bind/1.py` to `4.py` (each old text matches once), applied by `bind4.sh` (backup, apply, run, restore, digest check). Bindings 1 and 2 edit `dependency-cruiser.config.cjs` and run from the repository root; binding 2 runs twice (2a the boundaries test, 2b `pnpm check:boundaries`), each with its own apply and restore.

- `p4-s7-bind-1` (the rule deleted), `pnpm exec vitest run --reporter=verbose apps/harness/scripts/check-boundaries-parse.test.mjs`: exit 1, **2 failed, 3 passed**: both `forbids importing the Electron entry` rows (received `[]`).
- `p4-s7-bind-2a` (the rule's `from` loses its `pathNot` exception, `from: {}`), same command: exit 1, **1 failed, 4 passed**: `allows only the smoke wiring test to import the Electron entry` (one violation from the smoke wiring test). The P4-B19 rows stay green.
- `p4-s7-bind-2b` (same mutant), `pnpm check:boundaries`: exit 1, exactly one violation: `no-import-of-electron-entry: apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts → apps/desktop/src/main/main.ts`.
- `p4-s7-bind-3` (`main.ts`: `registerWorkspaceIpc(workspace.owner, { accepting: () => true })`), `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/canonical-writer-package-smoke-main.test.ts` in `apps/desktop`: exit 1, **1 failed, 79 passed**: `answers unavailable after quit starts: queryWorkspace` (the fake bridge is called). The other quit rows use the project-entry handlers and stay green.
- `p4-s7-bind-4` (`workspace-ipc.ts`: the query handler's closed-gate line deleted), `… src/main/workspace-ipc.test.ts` in `apps/desktop`: exit 1, **1 failed, 2 passed**: `answers workspace unavailable after the IPC gate closes: queryWorkspace`.
- Each restore prints `OK`.

## Bindings 1-4: observed

- `p4-s7-bind-1.log`: exit 1, **2 failed, 3 passed**; both P4-B19 rows. Restored, digest `0ab1e225…fac8` OK.
- `p4-s7-bind-2a.log`: exit 1, **1 failed, 4 passed**; `allows only the smoke wiring test …`. Restored OK.
- `p4-s7-bind-2b.log`: exit 1, one violation: `no-import-of-electron-entry: apps/desktop/src/main/canonical-writer-package-smoke-main.test.ts → apps/desktop/src/main/main.ts` (591 modules). Restored OK.
- `p4-s7-bind-3.log`: exit 1, **1 failed, 79 passed**; `desktop runtime in main > answers unavailable after quit starts: queryWorkspace`. Restored, digest `54d7df96…c378` OK.
- `p4-s7-bind-4.log`: exit 1, **1 failed, 2 passed**; `answers workspace unavailable after the IPC gate closes: queryWorkspace`. Restored, digest `dedfbe82…b076` OK.
- All match.
- Process note: the first versions of pairs 1 and 2, written through a shell heredoc, lost one of the config's doubled backslashes and matched nothing; the match check caught it before any run. They were rewritten with the file tool.

## Structural checks (uncommitted candidate on `0a67690`)

- `rg "^export "` on `main.ts`: nothing. `registerWorkspaceIpc|broadcastWorkspaceNotification` in `main.ts`: the import (`:51`) and the two calls (`:382`, `:384`). The `workspace-bridge.test.ts` pattern (`vi.mock|mainMocks|./main.js|…`): nothing. `main.js` under `apps/desktop/src`: only `canonical-writer-package-smoke-main.test.ts:264`. `workspace-ipc.test.ts`: one hit in each mutation config; `workspace-bridge.test.ts` in the s6 mutation config: nothing. The anchor row with `first` `export function registerWorkspaceIpc(` names `workspace-ipc.ts:32-47`, starting at that line. `git diff` over `project-entry-ipc.ts`, `project-registration-ipc.ts`, `desktop-runtime.ts`, `preload`, `renderer`, `shared`: empty. Changed paths: only the affected paths and this record. All as the brief states.

## Light gates: prediction, written before the runs

- `p4-s7-typecheck` (`pnpm typecheck`), `p4-s7-biome` (`pnpm exec biome check` on the eight changed code files), `p4-s7-knip` (`pnpm check:dead-code`), `p4-s7-jscpd` (`pnpm check:duplicates`; 0 clones, none between `workspace-ipc.test.ts` and `workspace-bridge.test.ts`): each exit 0.
- CodeScene 10 on `main.ts`, `workspace-ipc.ts`, `workspace-ipc.test.ts`, `workspace-bridge.test.ts` (and `workspace-test-peers.ts`), logged to `p4-s7-codescene.log`.

## Light gates: observed

- `p4-s7-typecheck.log`, `p4-s7-knip.log`, `p4-s7-jscpd.log` (0 clones): exit 0. Match.
- `p4-s7-biome.log`: **exit 1, weaker than predicted**: formatting only, in two test files: the `./workspace-test-peers.js` import fits one line in `workspace-bridge.test.ts` and `workspace-ipc.test.ts`, and `workspace-bridge.test.ts` kept a blank line before the closing `});` of `describe("WorkspaceBridge")` where the moved test was cut. No lint rule. Fixed with `biome format --write` on those two files (formatting only; no test body changes).

## Formatting fix: prediction, written before the runs

- `p4-s7-biome-2`: the same biome command. Exit 0.
- `p4-s7-move-desktop-2`: the `p4-s7-move-desktop` command. Exit 0, 128 passed (3, 36, 80, 9).

## Formatting fix: observed

- `p4-s7-biome-2.log`: exit 0. `p4-s7-move-desktop-2.log`: exit 0, 128 passed. Match.
- CodeScene 10 on `main.ts`, `workspace-ipc.ts`, `workspace-ipc.test.ts`, `workspace-bridge.test.ts`, `workspace-test-peers.ts` (`p4-s7-codescene.log`). Matches.

## `pnpm check`: held by the CPU rule

- CPU read in its own call: 34.5, 14.4, 10.5 %; 13.3 GB free; **9 League/TFT processes**. The rule fails (a game is running and one sample is over 30 %), so `pnpm check` was not run. The commit, preflight and slice-verifier wait for it.

## `pnpm check`: prediction, written before the run

- Coordinator GO after Pedro's "continue". CPU read in its own call: 7.9, 14.5, 12.2 %; 13.6 GB free; no League/TFT process.
- `p4-s7-check`: `pnpm check`. Exit 0, 120 + 2 = 122 test files (`workspace-ipc.test.ts` new; `check-boundaries-parse.test.mjs` already ran in the harness project, whose include has `scripts/**/*.test.mjs`)... **3926 passed** (3923 + the 3 new boundaries rows; the workspace tests stay 39 in total).

## `pnpm check`: observed

- `p4-s7-check.log`: exit 0; **121 files, 3927 passed**, none failed.
- Differs from the prediction, explained, not weaker: (a) the prediction's "120 + 2 = 122" files was a slip: only `workspace-ipc.test.ts` is a new file, so 121 is right; (b) 3927 = 3924 + 3: the 3923 I started from was the s6 check before `e2b1d48`, which added one protocol row (`covers every harness failure row`), so the base is 3924, plus the 3 new boundaries rows.
