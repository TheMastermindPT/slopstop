# TDD record: p4-s8-gated-ipc-helper

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, slice `p4-s8-gated-ipc-helper`, lane normal (Q6 override). Q16 (a): the non-gated variant waits for s9, `main.ts` untouched. Q17 (a): no per-slice run.
- Approved copy: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/approved-8b17cdf5.md` (hash `8b17cdf5…530b`). The branch's brief equals main's (`validate-artifact` OK; append-only `keep`).
- Base: `fix/arch-review-phase-4` rebased onto main `b5501d3`; the brief conflicted three times (the p4-s6 TDD Evidence line now on main), each resolved by taking main's brief. New base `fe86793`; `git diff e34a84f fe86793` over `apps`, `packages`, the Stryker and depcruise configs is empty.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s8-*.log`, each with its parent and working-tree patch digest.

## Baseline: prediction, written before the runs

- `p4-s8-baseline-desktop`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-entry-ipc.test.ts src/main/project-registration-ipc.test.ts src/main/workspace-ipc.test.ts src/main/canonical-writer-package-smoke-main.test.ts` in `apps/desktop`. Exit 0, **100 passed** (9, 8, 3, 80).
- `p4-s8-baseline-ranges-test`: `pnpm exec vitest run --reporter=verbose apps/harness/scripts/check-stryker-ranges.test.mjs` from the root. Exit 0, no failure (count recorded as observed).

## Baseline: observed

- `p4-s8-baseline-desktop.log`: exit 0, **100 passed** (`project-entry-ipc` 9, `project-registration-ipc` 8, `workspace-ipc` 3, `canonical-writer-package-smoke-main` 80). Matches.
- `p4-s8-baseline-ranges-test.log`: exit 0, 41 passed. Matches.

## P4-B25 red: prediction, written before the run

- Edit: `check-stryker-ranges.test.mjs:448`, the `desktop-s6` row becomes `{ config: "stryker.desktop-s6.config.json", ranges: 7, wholeFiles: 5 }`.
- `p4-s8-red-ranges-test`: the baseline ranges-test command. Exit 1, **1 failed, 40 passed**: `passes on the repository's own configs and anchors`, on the `desktop-s6` row (received 14 ranges, 2 whole files).

## P4-B25 red: observed

- `p4-s8-red-ranges-test.log`: exit 1, **1 failed, 40 passed**; `passes on the repository's own configs and anchors`, expected `ranges: 7, wholeFiles: 5`, received `14`, `2`. Matches.

## P4-B23 test (written before any run)

- `apps/desktop/src/main/ipc-gate.test.ts` (new), over `Schema.Struct({ name: Schema.String })`, spy `closing` / `forward` / `accepting`, and a hoisted `ipcMain.handle` mock reset before each test: `registers one handler on its channel`; `forwards the decoded request while the gate is open` (the handler returns `forward`'s own promise); `answers the closing result once the gate closes`; `rejects an invalid value before reading the gate: $gate` (open, closed; synchronous throw, no spy called); `reads the gate on every call`. 6 rows.

## P4-B23 red: prediction, written before the run

- `p4-s8-red-ipc-gate`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/ipc-gate.test.ts` in `apps/desktop`. Exit 1; the file fails to load because `./ipc-gate.js` does not exist (a whole-file failure, no test runs).

## P4-B23 red: observed

- `p4-s8-red-ipc-gate.log`: exit 1, `Cannot find module '/src/main/ipc-gate.js'`, no tests. Matches.

## The helper

- `apps/desktop/src/main/ipc-gate.ts` (new): `IpcGate` (`Readonly<{ accepting(): boolean }>`) and `handleGatedIpc(channel, schema, gate, { closing, forward })`, a plain function: one `ipcMain.handle`; per call `decodeStrict(schema, value)` first, then `gate.accepting()`, then `Promise.resolve(closing(request))` or `forward(request)`. The schema is typed `Parameters<typeof decodeStrict>[0]` with the request type `Schema["Type"]`; no new protocol export.

## P4-B23 green: prediction, written before the run

- `p4-s8-green-ipc-gate`: the same command. Exit 0, **6 passed**.

## P4-B23 green: observed

- `p4-s8-green-ipc-gate.log`: exit 0, **6 passed**. Matches.

## The nine handlers on the helper

- `project-entry-ipc.ts`: six `handleGatedIpc` calls with today's channel, schema, closing answer and forward (`listProjects`: `closing: () => projectListClosing`, `forward: () => projects.list()`); gate typed `IpcGate`; `decodeStrict` and `ipcMain` imports gone; TSDoc unchanged. 72 → 74 lines.
- `workspace-ipc.ts`: two calls (`closing: workspaceQueryClosing`; `closing: (intent) => workspaceIntentClosing(capabilityForIntent(intent))`); gate `IpcGate`; the `WorkspaceIntent` / `WorkspaceQuery` type imports and `ipcMain` gone. 47 → 40 lines; `registerWorkspaceIpc` now `:31`.
- `project-registration-ipc.ts`: the local `IpcGate` goes and is imported from `./ipc-gate.js`; `registerProject` uses the helper (`:60-63`); `chooseRepository` and `getRegistrationCapability` unchanged (their gate lines stay at `:35`, `:43`). 
- `biome format --write` on the five files (formatting only). Desktop `tsc --noEmit`: clean.

## After the handlers: prediction, written before the runs

- `p4-s8-handlers-desktop`: the baseline desktop command plus `src/main/ipc-gate.test.ts`. Exit 0, **106 passed** (9, 8, 3, 80, 6). P4-B24 green throughout: the four files keep their counts.
- `p4-s8-ranges-red`: `pnpm check:mutation-ranges`. Exit 1; the `desktop-s6` IPC entries fail: the six `project-entry-ipc.ts` single lines and `project-registration-ipc.ts:62` (first line found nowhere), and `workspace-ipc.ts:32-47` (the file now has 40 lines; reported as drift or as out of range). `project-registration-ipc.ts:35` and `:43` still pass. No other config fails.

## After the handlers: observed

- `p4-s8-handlers-desktop.log`: exit 0, **106 passed** (9, 8, 3, 80, 6). Matches; P4-B24 holds (the four files keep their counts).
- `p4-s8-ranges-red.log`: exit 1, but **weaker than predicted**: only `STRYKER_RANGE_BROKEN` — `stryker.desktop-s6.config.json: apps/desktop/src/main/workspace-ipc.ts:32-47 ends past the file's last line (40)`. The seven predicted drift entries (six `project-entry-ipc.ts` lines, `project-registration-ipc.ts:62`) are not shown.
- Cause (read in `apps/harness/scripts/check-stryker-ranges.mjs:215-232`): `checkStrykerRanges` collects every problem but returns only the first non-empty class in `codeOrder`, and `STRYKER_RANGE_BROKEN` comes before `STRYKER_RANGE_DRIFT`. My prediction assumed every failing entry would be listed. The red is real; it shows one entry instead of eight.
- STOP: reported to the coordinator before the re-point.

## Coordinator decision on the ranges red

- The coordinator confirmed `check-stryker-ranges.mjs:231`: the check answers only the first problem class, so `STRYKER_RANGE_BROKEN` alone is the tool's designed behaviour. The miss is my prediction's, which assumed every failing entry is listed. Option (a): the contract's red-first proof is P4-B25 (observed 14/2 against 7/5); the green run checks every entry.

## Re-point: prediction, written before the runs

- Session-scratchpad script `p4s8-repoint.py`: `stryker.desktop-s6.config.json` replaces the six `project-entry-ipc.ts` single lines with `ipc-gate.ts` and `project-entry-ipc.ts` (whole files), `project-registration-ipc.ts:62-62` with `:60-63` (the `registerProject` helper call), and `workspace-ipc.ts:32-47` with `workspace-ipc.ts` (whole file). `stryker-range-anchors.json` drops the seven rows for those entries and re-points the `:62` row to `:60-63` (first: the `handleGatedIpc(desktopIpcChannels.registerProject, …` line; last `  });`). `vitest.desktop-s6-mutation.config.ts` adds `ipc-gate.test.ts`.
- `p4-s8-ranges-green`: `pnpm check:mutation-ranges`. Exit 0; `desktop-s6` **7 ranges, 5 whole files**; the other configs unchanged (18/35, desktop-s7 6/3).
- `p4-s8-green-ranges-test`: the ranges-test command. Exit 0, **41 passed** (P4-B25 green).

## Re-point: observed

- `p4-s8-ranges-green.log`: exit 0; `desktop-s6` **7 ranges, 5 whole files**; `stryker.config.json` 18/35, `desktop-s7` 6/3. Matches.
- `p4-s8-green-ranges-test.log`: exit 0, **41 passed**. Matches (P4-B25 green).

## Bindings 1-4: prediction, written before the runs

Pairs in the session scratchpad `p4s8bind/1.py` to `4.py` (each old text matches once), applied by `bind4.sh` in `apps/desktop`. Bindings 1 and 2 run the five files `src/main/ipc-gate.test.ts src/main/project-entry-ipc.test.ts src/main/project-registration-ipc.test.ts src/main/workspace-ipc.test.ts src/main/canonical-writer-package-smoke-main.test.ts` (106 rows); 3 and 4 run their own file.

- `p4-s8-bind-1` (`handleGatedIpc` reads the gate first and answers `closing(value)` without decoding): exit 1, **9 failed, 97 passed**. The closed rows' extra-key `toThrow` fails where the closing answer does not decode its own result: `answers unavailable after the IPC gate closes:` `listProjects`, `upgradeProject`, `readConversation`, `saveConversationMessage` (4 of the 6; `activateProject` and `switchProject` still throw, because `projectActivationUnavailable` / `projectSwitchUnavailable` strictly decode a result that carries the undecoded request); the `registerProject` closed row (1); both workspace closed rows (2); and in `ipc-gate.test.ts` both `rejects an invalid value before reading the gate` rows (2: closed, no throw; open, the gate is read before the throw). This is fewer rows than the brief's list (it names all 6 project-entry rows); the two that stay green are explained above.
- `p4-s8-bind-2` (`handleGatedIpc` forwards when the gate is closed, still reading it): exit 1, **14 failed, 92 passed**: the 6 project-entry closed rows, the `registerProject` closed row, the 2 workspace closed rows (the bridge fake is called), `ipc-gate.test.ts` `answers the closing result once the gate closes` and `reads the gate on every call` (2), and the 3 smoke-main `answers unavailable after quit starts:` rows (`listProjects`, `registerProject`, `queryWorkspace`).
- `p4-s8-bind-3` (`switchProject` closes with `projectActivationUnavailable`), `src/main/project-entry-ipc.test.ts`: exit 1, **1 failed, 8 passed**: `answers unavailable after the IPC gate closes: switchProject`.
- `p4-s8-bind-4` (`submitWorkspaceIntent` decodes with `WorkspaceQuerySchema`), `src/main/workspace-ipc.test.ts`: exit 1, **2 failed, 1 passed**: `keeps workspace IPC handlers narrow and validated` (a valid intent is refused) and `answers workspace unavailable after the IPC gate closes: submitWorkspaceIntent` (its valid intent now fails to decode). The brief names only the first; the second also decodes an intent.
- Each restore prints `OK`.

## Bindings 1-4: observed

- `p4-s8-bind-1.log`: exit 1, **9 failed, 97 passed**; exactly the 9 predicted rows (`activateProject` and `switchProject` closed rows stayed green, as predicted). Restored, digest `f1fe26a8…a529` OK.
- `p4-s8-bind-2.log`: exit 1, **14 failed, 92 passed**; exactly the 14 predicted rows. Restored OK.
- `p4-s8-bind-3.log`: exit 1, **1 failed, 8 passed**; `switchProject`. Restored, digest `1add3d01…449d` OK.
- `p4-s8-bind-4.log`: exit 1, **2 failed, 1 passed**; the 2 predicted rows. Restored, digest `a3ca18c7…5502` OK.
- All match.

## Structural checks (uncommitted candidate on `fe86793`)

- `ipcMain.handle(` outside tests: `ipc-gate.ts` (1), `project-registration-ipc.ts` (2: `getRegistrationCapability`, `chooseRepository`), `main.ts` (2). `gate.accepting()` outside tests: `ipc-gate.ts` and the two in `chooseRepository`. `accepting(): boolean`: `ipc-gate.ts` and `desktop-shutdown.ts:18` only. `decodeStrict(` in `project-entry-ipc.ts` / `workspace-ipc.ts`: only `broadcastWorkspaceNotification`'s. `desktop-s6` names `ipc-gate.ts`, `project-entry-ipc.ts`, `workspace-ipc.ts` as whole files, with no `project-entry-ipc.ts:` or `workspace-ipc.ts:` range; no anchor row names them. `ipc-gate.test.ts`: one hit in the s6 mutation config. `git diff` over `main.ts`, `desktop-shutdown.ts`, `desktop-runtime.ts`, the three IPC tests, preload, renderer, shared and `packages`: empty. Changed paths: only the affected paths and this record. All as the brief states.

## Light gates: prediction, written before the runs

- `p4-s8-typecheck` (`pnpm typecheck`), `p4-s8-biome` (`pnpm exec biome check` on the eight changed code files), `p4-s8-knip` (`pnpm check:dead-code`), `p4-s8-jscpd` (`pnpm check:duplicates`, 0 clones): each exit 0.
- CodeScene 10 on `ipc-gate.ts`, `project-entry-ipc.ts`, `project-registration-ipc.ts`, `workspace-ipc.ts`, `ipc-gate.test.ts`, logged to `p4-s8-codescene.log`.

## Light gates: observed

- `p4-s8-typecheck.log`, `p4-s8-biome.log`, `p4-s8-knip.log`, `p4-s8-jscpd.log` (0 clones): each exit 0. CodeScene 10 on all five files (`p4-s8-codescene.log`). Matches.

## `pnpm check`: prediction, written before the run

- CPU read in its own call: 8.8, 17.5, 8.8 %; 7.6 GB free; no League/TFT process.
- `p4-s8-check`: `pnpm check`. Exit 0; **122 files** (121 + `ipc-gate.test.ts`), **3933 passed** (3927 at `e34a84f` + the 6 `ipc-gate.test.ts` rows; P4-B25 edits a row, adds none).

## `pnpm check`: observed

- `p4-s8-check.log`: exit 0; **122 files, 3933 passed**. Matches.
