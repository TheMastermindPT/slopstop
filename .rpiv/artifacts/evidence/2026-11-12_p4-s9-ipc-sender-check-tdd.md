# TDD record: p4-s9-ipc-sender-check

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, slice `p4-s9-ipc-sender-check`, lane **rigorous** (Pedro accepts the candidate). Q18 (a): a `sender` parameter; grouping `{ gate, sender }` is the implementer's choice (R12).
- Approved copy: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/approved-8aaf8757.md` (hash `8aaf8757…99bf`). The branch's brief equals main's (`validate-artifact` OK; append-only `keep`).
- Base: `fix/arch-review-phase-4` rebased onto main `d2d8e3f` without conflict; `8db84db` (the brief's `91669c2`; `git diff 91669c2 8db84db` over `apps`, `packages`, the Stryker and depcruise configs is empty).
- CPU rule (Pedro is gaming): CPU and `League*` / `TFT*` / `RocketLeague*` / `Overwolf*` read in their own call before any run beyond one small file. Heavy runs (`test:e2e`, `package:launch-smoke`) only after the coordinator's GO.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s9-*.log`, each with its parent and working-tree patch digest.

## Baseline: prediction, written before the runs

- CPU: 9, 15.6, 14.9 %; 12.9 GB free; no game process.
- `p4-s9-baseline-desktop`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/ipc-gate.test.ts src/main/project-entry-ipc.test.ts src/main/project-registration-ipc.test.ts src/main/workspace-ipc.test.ts src/main/canonical-writer-package-smoke-main.test.ts` in `apps/desktop`. Exit 0, **106 passed** (6, 9, 8, 3, 80).
- `p4-s9-baseline-ranges-test`: `pnpm exec vitest run --reporter=verbose apps/harness/scripts/check-stryker-ranges.test.mjs` from the root. Exit 0, 41 passed.

## Baseline: observed

- `p4-s9-baseline-desktop.log`: exit 0, **106 passed** (6, 9, 8, 3, 80). Matches.
- `p4-s9-baseline-ranges-test.log`: exit 0, 41 passed. Matches.

## Step 1, P4-B32 red: prediction, written before the run

- Edit: `check-stryker-ranges.test.mjs:448`, the `desktop-s6` row becomes `ranges: 7, wholeFiles: 6`.
- `p4-s9-red-ranges-test`: the baseline ranges-test command. Exit 1, **1 failed, 40 passed**: `passes on the repository's own configs and anchors` (expected 7/6, received 7/5).

## Step 1, P4-B32 red: observed

- `p4-s9-red-ranges-test.log`: exit 1, **1 failed, 40 passed**; expected `wholeFiles: 6`, received `5`. Matches.

## Step 2, P4-B26 test (written before any run)

- `apps/desktop/src/main/ipc-sender.test.ts` (new), 8 rows as the brief names them, over structural fakes (a window whose `webContents` getter throws "Object has been destroyed" once closed, a mutable `mainFrame`, a spy logger with every pino level). Every refusal is matched with `/^IPC call refused: unknown sender\.$/`; each refusal row asserts exactly one `warn({ channel }, "IPC call refused: unknown sender.")` and no other level.
- Interpretation recorded: the fake window becomes destroyed **when** `closed` fires (the flag is set before its listeners run), so a listener that reads `window.webContents` throws inside the emit. That is what Electron documents (do not use the window after `closed`) and what binding 9 needs to bite; "emitting `closed` does not throw" is asserted.

## Step 2, P4-B26 red: prediction, written before the run

- `p4-s9-red-ipc-sender`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/ipc-sender.test.ts` in `apps/desktop` (one small file). Exit 1; the file fails to load (`./ipc-sender.js` does not exist), no tests.

## Step 2, P4-B26 red: observed

- `p4-s9-red-ipc-sender.log`: exit 1, `Cannot find module './ipc-sender.js'`, no tests. Matches.

## Step 2, the rule

- `apps/desktop/src/main/ipc-sender.ts` (new): `ipcSenderRefusedMessage` (`"IPC call refused: unknown sender."`), the structural types (`IpcSenderEvent`, `IpcSender`, a tracked window shape), and `createIpcSender({ logger })` returning `{ track, admit }`, a closure-state factory (R11). `track` reads `webContents.id` once and forgets it on `closed` without reading the window. `admit` reads `event.senderFrame` first; a `null` frame, an untracked `sender.id`, or a frame whose `processId`/`routingId` differ from `event.sender.mainFrame` read on this call each go through one `refuse(channel)`, which logs `warn({ channel }, text)` and throws `new Error(text)`.

## Step 2, P4-B26 green: prediction, written before the run

- `p4-s9-green-ipc-sender`: the same command. Exit 0, **8 passed**.

## Step 2, P4-B26 green: observed

- `p4-s9-green-ipc-sender.log`: exit 0, **8 passed**. Matches.

## Step 3: doubles and the module and entry rows (written before any run; session-scratchpad script `p4s9-step3.py`, then `biome format`)

- Grouping choice (R12): the register functions take `(bridge, gate, sender)` as separate parameters, so the step-3 rows call them with a third argument the base ignores (the red the Order names). The helpers will group `{ gate, sender }` (step 4), which keeps `handleGatedIpc` at four parameters.
- `project-entry-ipc.test.ts`, `project-registration-ipc.test.ts`, `workspace-ipc.test.ts`: a type-only `IpcSender` import, a local `refusingSender` that throws the literal fixed text, and `refuses every channel from an unadmitted sender: $channel` (6 + 3 + 2 = 11 rows). Each row registers with the refusing sender as the third argument and asserts `rejects.toThrow(/^IPC call refused: unknown sender\.$/)` through an async wrapper (a synchronous throw becomes the rejection) and that no bridge fake (and for registration, no dialog) is called. `registeredWith` / `registered` gain an optional third `sender` argument; existing callers unchanged in this step.
- `canonical-writer-package-smoke-main.test.ts` doubles: each window instance has its own `webContents` (counter `id`, own `mainFrame { processId: 100, routingId: id }`); `loadFile` stays pending while `ports.loadHold` is set; `BrowserWindow.fromWebContents` and `dialog.showOpenDialog` are spies; the logger gains `warn: ports.logWarn`; the supervisor gains `getStatus` / `retry` spies; the five other entry fakes and the workspace `submit` become port spies, all answering `{ status: "open-path" }`; `ipcHandler` now calls with the first window's main-frame event (`windowEvent(0)`).
- New `describe("the IPC sender rule in main")` (platform pinned to `win32` so the dialog row reaches the dialog): `refuses a call from a frame that is not the application window: $channel` (P4-B29, 13 rows from `invokeRows`, every invoke channel with a valid value and its port); `admits the application window on every channel before its page finishes loading: $channel` (P4-B30, 13 rows, `loadHold` pending); `admits a window reopened on activate` (P4-B30).

## Step 3 red: prediction, written before the run

- CPU: 8.8, 13.5, 10.3 %; 13.7 GB free; no game process.
- `p4-s9-step3-red`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/ipc-sender.test.ts src/main/ipc-gate.test.ts src/main/project-entry-ipc.test.ts src/main/project-registration-ipc.test.ts src/main/workspace-ipc.test.ts src/main/canonical-writer-package-smoke-main.test.ts` in `apps/desktop`. Exit 1, **24 failed, 128 passed** (152 rows: 8, 6, 15, 11, 5, 107).
  - Failing, for the intended reason (every handler answers whatever its sender, so nothing rejects with the fixed text): the 11 P4-B28 rows and the 13 P4-B29 rows.
  - Passing: every existing row (the doubles change no assertion), the 14 P4-B30 rows (green by design at this state), P4-B26.

## Step 3 red: observed

- `p4-s9-step3-red.log`: exit 1, **24 failed, 128 passed** (152). Failing: the 13 P4-B29 rows and the 6 + 3 + 2 P4-B28 rows; every failure is `promise resolved "…" instead of rejecting` (no other error). Matches.

## Step 4: the scaffold (session-scratchpad script `p4s9-step4.py`, then `biome format`; desktop `tsc --noEmit` clean)

- `ipc-gate.ts`: `IpcGuard = Readonly<{ gate: IpcGate; sender: IpcSender }>`; `handleGatedIpc(channel, schema, guard, answers)` reads `guard.gate` and ignores `guard.sender`; new `handleIpc(channel, _sender, handler)` registers `(event) => handler(event)` without `admit`.
- The three modules take `(bridge, gate, sender)` and pass `{ gate, sender }` to their nine `handleGatedIpc` calls; `getRegistrationCapability` and `chooseRepository` use `handleIpc` (the dialog owner is still `BrowserWindow.fromWebContents(event.sender)`); `ipcMain` leaves `project-registration-ipc.ts`.
- `main.ts`: the three register calls pass a placeholder `const sender: IpcSender = { admit: () => undefined }` (type-only import), commented as the step-4 scaffold; step 6 replaces it with the real rule.
- Existing tests: a local `admittingSender` in `ipc-gate.test.ts`, `project-entry-ipc.test.ts`, `project-registration-ipc.test.ts`, `workspace-ipc.test.ts`; every existing register call gets it (no assertion changes).
- P4-B27 written: `refuses an unadmitted call before decoding or gating: $helper` in `ipc-gate.test.ts` (`handleGatedIpc with a valid value`, `handleGatedIpc with an invalid value`, `handleIpc`), over a refusing spy sender: the registered handler throws the fixed text synchronously; `admit` called once, with `"test:channel"` and the identical event object (`toBe`); `accepting`, `closing`, `forward` and the plain handler not called.

## Step 4 red: prediction, written before the run

- CPU: first read 15.4, 11.4, **35.5** % (over 30: not run); second read 20.8, 14.6, 19.5 %; 13.5 GB free; no game process.
- `p4-s9-step4-red`: the step-3 command. Exit 1, **27 failed, 128 passed** (155: ipc-gate 9 now). Failing: the 3 P4-B27 rows (valid: no throw, it forwards; invalid: the decode error, not the fixed text; `handleIpc`: the handler runs, no throw), plus the 24 step-3 rows, still red for the same reason. Every existing row passes.

## Step 4 red: observed

- `p4-s9-step4-red.log`: exit 1, **27 failed, 128 passed** (155). P4-B27: `with a valid value` and `handleIpc` → "expected [Function] to throw an error"; `with an invalid value` → the decode error ("Expected no excess property…") instead of the fixed text. The 24 step-3 rows still fail as before. Matches.

## Step 5: the helpers check the sender first

- `ipc-gate.ts`: `handleGatedIpc` calls `guard.sender.admit(channel, event)` before `decodeStrict`; `handleIpc` calls `sender.admit(channel, event)` before `handler(event)`. TSDoc updated to say so. Desktop `tsc --noEmit` clean.

## Step 5 green: prediction, written before the run

- CPU: 17.7, 24, 19.3 %; 13.2 GB free; no game process.
- `p4-s9-step5`: the step-3 command. Exit 1, **13 failed, 142 passed** (155): P4-B27 (3) and P4-B28 (11) green; the 13 P4-B29 rows still red, because `main.ts` still passes the admit-all placeholder (and its two harness handlers are still bare); P4-B30 and every existing row pass.

## Step 5 green: observed

- `p4-s9-step5.log`: exit 1, **13 failed, 142 passed** (155); only the 13 P4-B29 rows. Matches.

## Step 6: `main.ts` wiring

- `bootstrap()` builds `const sender = createIpcSender({ logger })` from the main logger after the services, and `const createWindow = () => createActiveWindow(sender)`; the four registrations get `sender` (`registerHarnessIpc(supervisor, sender)` now registers `getHarnessStatus` and `retryHarness` through `handleIpc`); `smokeWindow = await createWindow()` and the reopen path's `create: createWindow`. `createApplicationWindow(options, sender)` calls `sender.track(window)` right after `new BrowserWindow(…)`, before `loadURL` / `loadFile` (`:288` against `:296`, `:300`). The step-4 placeholder is gone; `ipcMain` leaves `main.ts`. A local `type IpcSenderRule = ReturnType<typeof createIpcSender>`. Desktop `tsc --noEmit` clean.

## Step 6 green: prediction, written before the run

- CPU: 14.6, 7.5, 5 %; 14.5 GB free; no game process.
- `p4-s9-step6`: the step-3 command. Exit 0, **155 passed**: P4-B29 (13) green; P4-B30 (14) still green; all else green.

## Step 6 green: observed

- `p4-s9-step6.log`: exit 0, **155 passed**. Matches.

## The P4-B31 dialog-owner row (written late)

- Omission: `opens the folder dialog owned by the calling window` (P4-B31, new) was not in the step-3 batch. Added now: the registration test's electron mock gets a `fromWebContents` spy (reset before each test, so it answers `undefined` as before); the row registers with an open gate, calls `chooseRepository` with an event whose `sender` the spy maps to a sentinel owner, and expects `dialog.showOpenDialog` called once with `(owner, { properties: ["openDirectory"] })`. The brief makes it a pin (green at the base by design); it was not run at the base, because it was written after step 6. Binding 17 proves that it bites.
- `p4-s9-dialog-owner`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-registration-ipc.test.ts` in `apps/desktop` (one small file). Prediction: exit 0, **15 passed** (8 + 3 + 1, with the 3 P4-B28 rows).

## The P4-B31 dialog-owner row: observed

- `p4-s9-dialog-owner.log`: exit 0, **12 passed**. The prediction's total "15" was an arithmetic slip: its own breakdown (8 existing + 3 P4-B28 + 1 new) is 12, which is what ran. No row failed.

## Step 7, Stryker: prediction, written before the runs

- Session-scratchpad script `p4s9-step7.py`: `stryker.desktop-s6.config.json` adds `ipc-sender.ts` (whole file) and moves `project-registration-ipc.ts:35-35` → `:36-36`, `:43-43` → `:44-44`, `:60-63` → `:65-73` (the `registerProject` `handleGatedIpc(` call, now multi-line, to its `  );`), `main.ts:83-93` → `:85-95`, `:369-369` → `:379-379`; `stryker-range-anchors.json` the same entries, with the `registerProject` row's texts now `  handleGatedIpc(` / `  );`; `vitest.desktop-s6-mutation.config.ts` adds `ipc-sender.test.ts`. No range on the `track` line.
- `p4-s9-ranges-green`: `pnpm check:mutation-ranges`. Exit 0; `desktop-s6` **7 ranges, 6 whole files**; `stryker.config.json` 18/35, `desktop-s7` 6/3.
- `p4-s9-green-ranges-test`: the ranges-test command. Exit 0, 41 passed (P4-B32 green).

## Step 7, Stryker: observed

- `p4-s9-ranges-green.log`: exit 0; `desktop-s6` **7 ranges, 6 whole files**; 18/35 and desktop-s7 6/3 unchanged. Matches.
- `p4-s9-green-ranges-test.log`: exit 0, **41 passed**. Matches (P4-B32 green).

## Bindings 1-17: prediction, written before the runs

Pairs written by the session-scratchpad generator `p4s9-bindgen.py` into `p4s9bind/1.py` … `17.py` (each old text matches once; three targets' indentation was corrected before generation), applied by `bind4.sh` in `apps/desktop`. Commands: bindings 1-3 run the six step-3 files (155 rows); 4-11 `src/main/ipc-sender.test.ts` (8); 12-16 `src/main/canonical-writer-package-smoke-main.test.ts` (107); 17 `src/main/project-registration-ipc.test.ts` (12). Multi-file and smoke-main groups only after a CPU read in its own call.

- `p4-s9-bind-1` (gated: `admit` after the decode): **1 failed, 154 passed**: P4-B27 `handleGatedIpc with an invalid value` (the decode error, not the fixed text).
- `p4-s9-bind-2` (gated: `admit` after the gate check, so after the decode too): **2 failed, 153 passed**: P4-B27 `with a valid value` (`accepting` was called) and `with an invalid value` (the decode error). The brief names the first; the second follows because the gate is read after the decode.
- `p4-s9-bind-3` (both helpers: `admit("ipc", event)`): **16 failed, 139 passed**: the 3 P4-B27 rows (the `admit` channel) and the 13 P4-B29 rows (the real rule logs `{ channel: "ipc" }`, so `ports.logWarn`'s exact call fails). The brief names the first three.
- `p4-s9-bind-4` (`sameFrame` compares `routingId` only): **1 failed, 7 passed**: `refuses a frame from another process with the main frame's routing id`.
- `p4-s9-bind-5` (`processId` only): **1 failed, 7 passed**: `refuses a subframe of a tracked window`.
- `p4-s9-bind-6` (no tracked-id check): **3 failed, 5 passed**: `refuses a window it never tracked`, `refuses a tracked window after it closed, without reading it` (the forgotten id is no longer checked) and `logs only the channel of a refused call` (its untracked window is admitted, so no `warn`). The brief names the first.
- `p4-s9-bind-7` (a `null` frame admitted when tracked): **1 failed, 7 passed**: `refuses a call with no sender frame`.
- `p4-s9-bind-8` (`track` stores the main frame's ids; `admit` compares against them): **1 failed, 7 passed**: `admits the new main frame after it is replaced`.
- `p4-s9-bind-9` (the `closed` listener reads `window.webContents.id`): **1 failed, 7 passed**: `refuses a tracked window after it closed, without reading it` (emitting `closed` throws).
- `p4-s9-bind-10` (the `null`-frame branch throws without logging): **1 failed, 7 passed**: `refuses a call with no sender frame`, on the `warn` assertion.
- `p4-s9-bind-11` (the tracked-id refusal adds the frame's `url` to the log fields): **1 failed, 7 passed**: `logs only the channel of a refused call` (`toStrictEqual({ channel })`). Assumption: for the other refusals the extra `url: undefined` field is ignored by `toHaveBeenCalledExactlyOnceWith` (it compares like `toEqual`).
- `p4-s9-bind-12` (`createApplicationWindow` tracks after the load): **13 failed, 94 passed**: every `admits the application window on every channel before its page finishes loading` row (refused while the load is pending).
- `p4-s9-bind-13` (the reopen path creates an untracked window): **1 failed, 106 passed**: `admits a window reopened on activate`.
- `p4-s9-bind-14` (`registerProjectEntryIpc` gets an admit-all sender): **6 failed, 101 passed**: the six project-entry P4-B29 rows (`listProjects`, `activateProject`, `switchProject`, `upgradeProject`, `readConversation`, `saveConversationMessage`). The brief names `listProjects`.
- `p4-s9-bind-15` (`getHarnessStatus` on a bare `ipcMain.handle`): **1 failed, 106 passed**: P4-B29 `getHarnessStatus`.
- `p4-s9-bind-16` (the rule built with a no-op logger): **13 failed, 94 passed**: every P4-B29 row, on the `ports.logWarn` assertion (the refusal itself still happens).
- `p4-s9-bind-17` (`chooseRepository` gets `undefined` as the dialog owner): **1 failed, 11 passed**: `opens the folder dialog owned by the calling window`.
- Each restore prints `OK`.

## Bindings: observed so far

- `p4-s9-bind-4.log` … `p4-s9-bind-11.log` (`ipc-sender.test.ts`): 4 → 1 failed (`… another process with the main frame's routing id`); 5 → 1 (`refuses a subframe …`); 6 → 3 (`never tracked`, `after it closed`, `logs only the channel`); 7 → 1 (`no sender frame`); 8 → 1 (`admits the new main frame …`); 9 → 1 (`after it closed, without reading it`); 10 → 1 (`no sender frame`, on the `warn`); 11 → 1 (`logs only the channel`). Each restored, digest `ee84f84e…95de` OK. All match.
- `p4-s9-bind-17.log`: 1 failed, 11 passed; `opens the folder dialog owned by the calling window`. Restored, digest `252192ea…2998` OK. Matches.

## Blocked by the CPU rule

- CPU read before bindings 1-3 and 12-16: 14.8, 14.4, 6.8 %, but **`RocketLeague_EAC` is running** (Pedro is playing). The rule blocks: bindings 1-3 (six files) and 12-16 (the smoke-main file), the light gates, `pnpm check`, the commit, preflight and review wait for Pedro's "livre".

## Resumed after Pedro's "livre"

- CPU read in its own call: 13, 19.9, 19.2 %; 13.5 GB free; no game process. Bindings 1-3 and 12-16 run with the predictions above.

## Bindings 1-3 and 12-16: observed

- `p4-s9-bind-1.log`: 1 failed (`handleGatedIpc with an invalid value`); `p4-s9-bind-2.log`: 2 failed (`with a valid value`, `with an invalid value`); `p4-s9-bind-3.log`: 16 failed (3 P4-B27 + 13 P4-B29). Restored, digest `69b1bcfc…7d5c` OK. The failing rows match. The totals are 156 rather than the predicted 155: the six-file set now includes the late dialog-owner row (`project-registration-ipc.test.ts` 12), so the passed counts are one higher (155, 154, 140).
- `p4-s9-bind-12.log`: 13 failed, 94 passed; every `admits the application window … before its page finishes loading` row. `p4-s9-bind-13.log`: 1 failed (`admits a window reopened on activate`). `p4-s9-bind-14.log`: 6 failed (the six project-entry P4-B29 rows). `p4-s9-bind-15.log`: 1 failed (P4-B29 `getHarnessStatus`). `p4-s9-bind-16.log`: 13 failed (every P4-B29 row). Each restored, digest `e0bea0f0…f252` OK. All match.
- All 17 bindings observed red as predicted and restored.

## Structural checks (uncommitted candidate on `8db84db`)

- `ipcMain.handle(` outside tests: only `ipc-gate.ts` (2: `handleGatedIpc`, `handleIpc`). `senderFrame`: only `ipc-sender.ts`. `.url` / `.origin` in `ipc-sender.ts`: none. `.track(` in `main.ts`: one, `:288`, in `createApplicationWindow`, before `loadURL` (`:296`) and `loadFile` (`:300`). The fixed text: one definition, `ipc-sender.ts:4`. Test imports of `./ipc-sender.js`: `ipc-sender.test.ts` (value), the four others `import type`. `desktop-s6` names `ipc-sender.ts` whole; its `main.ts` ranges are `:85-95` and `:379-379` (none on `:288`); `ipc-sender.test.ts` once in the s6 mutation config. `git diff` over preload, renderer, shared, `desktop-shutdown.ts`, `desktop-runtime.ts`, `packages`: empty. Changed paths: only the affected paths and this record. All as the brief states.

## Light gates: prediction, written before the runs

- `p4-s9-typecheck` (`pnpm typecheck`), `p4-s9-biome` (`pnpm exec biome check` on the fourteen changed code files), `p4-s9-knip` (`pnpm check:dead-code`), `p4-s9-jscpd` (`pnpm check:duplicates`, 0 clones): each exit 0.
- CodeScene 10 on `ipc-sender.ts`, `ipc-gate.ts`, `project-entry-ipc.ts`, `project-registration-ipc.ts`, `workspace-ipc.ts`, `main.ts`, `ipc-sender.test.ts`, logged to `p4-s9-codescene.log`.

## Light gates: observed (weaker than predicted)

- `p4-s9-typecheck.log` exit 0; `p4-s9-jscpd.log` exit 0, 0 clones. Match.
- `p4-s9-biome.log`: **exit 1**, 3 errors: `noVoidTypeReturn` twice in `ipc-sender.ts` (`admit` returns `refuse(...)` in a `void` method, `:47`, `:48`) and `organizeImports` in `workspace-ipc.test.ts` (the type-only `./ipc-sender.js` import out of order).
- `p4-s9-knip.log`: **exit 1**, `Unused exports (1)`: `ipcSenderRefusedMessage` (`ipc-sender.ts:4`). The tests use the literal text, as the contract requires, so nothing imports it.

## Fixes (behaviour unchanged)

- `ipc-sender.ts`: `refuse` becomes a function declaration with return type `never`, so a plain `refuse(channel);` narrows `frame` without `return` (`tsc --noEmit` clean); the two `return refuse(...)` lines become `refuse(...)`.
- `ipcSenderRefusedMessage` is no longer exported. **Deviation from the brief's wording** ("the exported fixed text"): exporting it fails Knip, and the contract forbids other tests from importing it. The text, its single definition and every assertion are unchanged.
- `workspace-ipc.test.ts`: `biome check --write` sorted the imports (it also collapsed the `workspace-test-peers.js` import onto one line).
- The binding generator's pairs for 6, 7, 10 and 11 follow the new lines (`refuse(channel);`, `function refuse(...)`); all 17 pairs match once. Bindings 4-11 run again on the changed file.

## After the fixes: prediction, written before the runs

- `p4-s9-green-ipc-sender-2`: `ipc-sender.test.ts`. Exit 0, **8 passed**.
- `p4-s9-bind-4-2` … `p4-s9-bind-11-2`: the same failures as `p4-s9-bind-4` … `11` (1, 1, 3, 1, 1, 1, 1, 1 failed of 8), each restored.
- `p4-s9-biome-2` (same fourteen files) and `p4-s9-knip-2`: exit 0.

## After the fixes: observed

- `p4-s9-green-ipc-sender-2.log`: exit 0, 8 passed. `p4-s9-bind-4-2.log` … `p4-s9-bind-11-2.log`: 1, 1, 3, 1, 1, 1, 1, 1 failed, the same rows as before; each restored, digest `7d0b4468…e93e` OK. `p4-s9-biome-2.log` and `p4-s9-knip-2.log`: exit 0. Match.
- CodeScene 10 on all seven files (`p4-s9-codescene.log`). Matches.

## `pnpm check`: prediction, written before the run

- CPU read in its own call: 8.4, 17.3, 17.9 %; 10.3 GB free; no game process.
- `p4-s9-check`: `pnpm check`. Exit 0; **123 files** (122 + `ipc-sender.test.ts`), **3983 passed** (3933 + 50: `ipc-sender` 8, `ipc-gate` 3, `project-entry-ipc` 6, `project-registration-ipc` 4, `workspace-ipc` 2, smoke-main 27; the P4-B32 row is edited, not added).

## `pnpm check`: observed

- `p4-s9-check.log`: exit 0; **123 files, 3983 passed**. Matches.
- Still open for this slice: the s9 run (`pnpm test:e2e`, `package:launch-smoke`) on the committed candidate, with the coordinator's GO; the candidate review he names; Pedro's acceptance.

## Candidate `9192e45` and the coordinator's reading

- Committed as `9192e45` on `8db84db` (staged hash = commit hash `4283630f…`; Biome changed nothing). Preflight `--base 8db84db`: clean (`p4-s9-preflight.log`).
- The coordinator read the diff (`ipc-sender.ts`, `ipc-gate.ts`, `main.ts`) with no objection and **accepted the deviation**: `ipcSenderRefusedMessage` is not exported, because exporting it fails Knip and the contract forbids other tests from importing it.

## The s9 run: prediction, written before the runs

- Coordinator GO; alone, in order, no watcher, no rerun, no timeout change.
- CPU before e2e, in its own call: 28.2, 12.2, 20.4 %; 11.7 GB free; no game process.
- `p4-s9-e2e`: `pnpm test:e2e` (forge package, then Playwright). Exit 0, **27 passed** (as at p4-s6), so the real window's main frame is admitted on every journey, including the calls made while the page loads and after the accessibility reload.
- `p4-s9-launch-smoke`: `pnpm package:launch-smoke`, after a fresh CPU read. Exit 0 ("Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.").

## The s9 run: observed

- `p4-s9-e2e.log` (parent `9192e45`): exit 0, **27 passed** (5.2 min). Matches.
- CPU before the smoke, in its own call: 12.1, 14.3, 12.8 %; 14.3 GB free; no game process.
- `p4-s9-launch-smoke.log` (parent `9192e45`): exit 0, "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." Matches.

## Candidate review round 1 and Pedro's triage

- Table: `p4-s9-candidate-review.md` (slice-verifier passed with V1, V2; code reviewer passed, 1 suggestion; coverage reviewer 1 concern, 3 suggestions; no blocker). Pedro's triage (relayed by the coordinator): **fix all** in one fix round: the coverage concern (a `url` and `origin` on every fake frame, a strict match on `warn.mock.calls`, red with binding 11 moved to the frame-mismatch branch); (a) copy the frame in `eventFrom` and `windowEvent` (red with an identity comparison); (b) a two-window `closed` row (red with `tracked.clear()`); (c) channels derived from `desktopIpcChannels`, with the refusal over the registered handlers (red with a bare handler in `main.ts`); the TSDoc of `registerProjectEntryIpc` and `registerWorkspaceIpc`. **V1 accepted by Pedro** (`ipcSenderRefusedMessage` stays unexported). **V2: run** the dialog-owner pin once against the base. No e2e or smoke rerun; no second review round (the coordinator reviews the fix diff, then Pedro accepts).

## V2, the dialog-owner pin at the base: prediction, written before the run

- Session-scratchpad script `p4s9-base-swap.sh`: backs up `src/main/project-registration-ipc.ts` and `src/main/ipc-gate.ts`, writes their `8db84db` versions (the base registration module needs the base 4-argument `handleGatedIpc`), runs, restores both and checks their digests.
- `p4-s9-v2-base-dialog-owner`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/project-registration-ipc.test.ts` in `apps/desktop` (the candidate test file). Exit 1, **3 failed, 9 passed**: `opens the folder dialog owned by the calling window` **passes** (the base passes `BrowserWindow.fromWebContents(event.sender)` as the owner), as do the 8 base rows; the 3 P4-B28 rows fail (the base has no sender rule, so each handler answers). Both restores print `OK`.

## V2: observed

- `p4-s9-v2-base-dialog-owner.log`: exit 1, **3 failed, 9 passed**; `opens the folder dialog owned by the calling window` ✓ at the base sources; the 3 P4-B28 rows ✗. Both files restored, digests `252192ea…` and `69b1bcfc…` OK. Matches: the pin is green at the base, as the brief states.

## Fix round edits (written before any run)

- `ipc-sender.test.ts`: every fake frame comes from `frame(processId, routingId)` and carries a `url` (`file:///C:/Users/someone/app/index.html`, a local path) and an `origin`; `eventFrom` sends an equal copy of the main frame by default, never the same object; `expectOneRefusalLog` asserts `logger.warn.mock.calls` `toStrictEqual([[{ channel }, "IPC call refused: unknown sender."]])`; `logs only the channel of a refused call` drops its now-redundant frame override; new row `forgets only the window that closed` (two tracked windows, the first closes: the second is admitted, the first refused with one `warn`). 9 rows.
- `canonical-writer-package-smoke-main.test.ts`: `windowEvent` sends a copy of the main frame; `invokeChannels` derives the invoke channels from `desktopIpcChannels` (all but the two main-to-renderer events); new row `registers every invoke channel, and only those, behind the sender rule`: the registered channels equal `invokeChannels`, `invokeRows` covers exactly them, every registered handler refuses `foreignEvent` with the fixed text, and `ports.logWarn` names each channel once. 108 rows.
- TSDoc: `registerProjectEntryIpc` and `registerWorkspaceIpc` now say each handler first admits only a call from SlopStop's own window (the sender rule), then decodes.
- Desktop `tsc --noEmit` clean.

## Fix round: prediction, written before the runs

- `p4-s9-fix-green`: the six-file command. Exit 0, **158 passed** (`ipc-sender` 9, `ipc-gate` 9, `project-entry-ipc` 15, `project-registration-ipc` 12, `workspace-ipc` 5, smoke-main 108).
- Mutants (session-scratchpad generator `p4s9-fixgen.py` → `p4s9fix/*.py`, each matching once; `bind4.sh`, restored by digest):
  - `p4-s9-fix-identity` (`ipc-sender.ts`: `frame !== event.sender.mainFrame` instead of `sameFrame`), `ipc-sender.test.ts` + smoke-main: **20 failed, 97 passed** (117): in `ipc-sender`, `admits the main frame of a tracked window`, `admits the new main frame after it is replaced`, `forgets only the window that closed` (3); in smoke-main the 13 P4-B30 load rows, `admits a window reopened on activate` and the 3 `answers unavailable after quit starts` rows (17). Code and coverage suggestion (a).
  - `p4-s9-fix-clear` (the `closed` listener runs `tracked.clear()`), `ipc-sender.test.ts`: **1 failed, 8 passed**: `forgets only the window that closed`. Suggestion (b).
  - `p4-s9-fix-url-mismatch` (binding 11 moved to the frame-mismatch branch), `ipc-sender.test.ts`: **3 failed, 6 passed**: `refuses a subframe of a tracked window`, `refuses a frame from another process with the main frame's routing id`, `admits the new main frame after it is replaced` (its old frame is refused on that branch). The concern.
  - `p4-s9-fix-url-tracked` (binding 11 as before, on the tracked-id branch), `ipc-sender.test.ts`: **4 failed, 5 passed**: `refuses a window it never tracked`, `refuses a tracked window after it closed, without reading it`, `logs only the channel of a refused call`, `forgets only the window that closed` (the strict match now bites on every row refused there).
  - `p4-s9-fix-bare-channel` (`main.ts` registers a bare `harness:debug` handler), smoke-main: **1 failed, 107 passed**: `registers every invoke channel, and only those, behind the sender rule`. Suggestion (c).

## Fix round: observed

- `p4-s9-fix-green.log`: exit 0, **158 passed** (9, 9, 15, 12, 5, 108). Matches.
- `p4-s9-fix-identity.log`: exit 1, **20 failed, 97 passed**; exactly the predicted rows (3 in `ipc-sender`, 13 + 1 + 3 in smoke-main). Restored, digest `7d0b4468…e93e` OK. Matches.
- `p4-s9-fix-clear.log`: exit 1, **1 failed, 8 passed**; `forgets only the window that closed`. Restored OK. Matches.
- `p4-s9-fix-url-mismatch.log` and `p4-s9-fix-url-tracked.log`: exit 1, **8 failed, 1 passed** each. **Stronger than predicted (3 and 4), explained**: both mutants give `refuse` a second parameter and log `{ channel, url }` on every refusal, so the branches without a URL log `{ channel, url: undefined }`; the new strict match (`toStrictEqual` on `warn.mock.calls`) counts that extra key, which the old `toHaveBeenCalledExactlyOnceWith` ignored. Every refusal row fails; only the admit row passes. The predicted rows are among them. Restored OK.
- `p4-s9-fix-bare-channel.log`: exit 1, **1 failed, 107 passed**; `registers every invoke channel, and only those, behind the sender rule`. Restored, digest `e0bea0f0…f252` OK. Matches.

## Fix gates: prediction, written before the runs

- `p4-s9-fix-typecheck`, `p4-s9-fix-biome` (the five changed files), `p4-s9-fix-knip`, `p4-s9-fix-jscpd` (0 clones), `p4-s9-fix-ranges` (`desktop-s6` 7/6; the TSDoc edits sit inside whole-file entries): each exit 0. CodeScene 10 on `ipc-sender.test.ts`, `project-entry-ipc.ts`, `workspace-ipc.ts` and `canonical-writer-package-smoke-main.test.ts`.

## Fix gates: observed

- `p4-s9-fix-typecheck.log`, `p4-s9-fix-knip.log`, `p4-s9-fix-jscpd.log` (0 clones), `p4-s9-fix-ranges.log` (`desktop-s6` 7/6): exit 0. Match.
- `p4-s9-fix-biome.log`: **exit 1**: `lint/suspicious/useArraySortCompare` at smoke-main `:1076` (a `.sort()` without a compare function in the new sweep row). Slip in the command: it also named `.rpiv` (48 files checked) instead of only the four changed files; the finding is in the test file.
- Fix: one `sorted(channels)` helper (`localeCompare`) for the three sorted comparisons in the sweep row. Desktop `tsc --noEmit` clean. The changed test is to be rerun (smoke-main green and the bare-channel mutant) before the gates.

## Blocked by the CPU rule

- Three reads, no game process: 29.9 / 19.1 / **34.7**; 16.5 / 19.1 / **33.2**; **42.2** / 29.1 / 25.8 %. Top processes at the time were small (system, firefox, spotify, dwm). Stopped before the smoke-main rerun and `pnpm check`; reported to the coordinator.

## Resumed: Pedro says go ahead (coordinator relay; his samples 29/28/17 %, no game)

- The stronger url-mutant results (8 failed each) are accepted by the coordinator as recorded.

## After the sort fix: prediction, written before the runs

- `p4-s9-fix-smoke-green`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/canonical-writer-package-smoke-main.test.ts` in `apps/desktop`. Exit 0, **108 passed**.
- `p4-s9-fix-bare-channel-2`: the bare-channel mutant again, same command. Exit 1, **1 failed, 107 passed**: `registers every invoke channel, and only those, behind the sender rule`. Restore prints `OK`.
- `p4-s9-fix-biome-2`: `pnpm exec biome check` on `ipc-sender.test.ts`, `canonical-writer-package-smoke-main.test.ts`, `project-entry-ipc.ts`, `workspace-ipc.ts` only. Exit 0.

## After the sort fix: observed

- `p4-s9-fix-smoke-green.log`: exit 0, **108 passed**. `p4-s9-fix-bare-channel-2.log`: exit 1, **1 failed, 107 passed** (the sweep row); restored, digest `e0bea0f0…f252` OK. `p4-s9-fix-biome-2.log` (the four files only): exit 0. Match.

## CodeScene on the fix round: one file below 10 (reported before the commit)

- `ipc-sender.test.ts`, `project-entry-ipc.ts`, `workspace-ipc.ts`: 10.
- `canonical-writer-package-smoke-main.test.ts`: **9.24** (Large Method: `beforeEach` 82 lines; Primitive Obsession 38 %). It is touched by this slice since `9192e45`, and I did not score it then (it is not in the brief's CodeScene list, but the standing rule covers every touched file): my gap.
- The base file (`8db84db`, scored as a temporary untracked copy inside the worktree, then deleted) is **9.68**: Primitive Obsession (39 %) only. So the Large Method is this slice's; the Primitive Obsession predates it.
- Fix: the open-path port answers the slice added to `beforeEach` move into `answerOpenPaths()` (`beforeEach` 67 lines). Score now **9.68**, the base level (Primitive Obsession 38 %). Reaching 10 means reworking the primitive arguments across this long-standing test file: outside this slice. Reported to the coordinator as a decision; the commit waits for it.

## After the helper extraction: prediction, written before the runs

- `p4-s9-fix-smoke-green-2`: the smoke-main command. Exit 0, **108 passed**.
- Then a CPU read in its own call, then `p4-s9-fix-check`: `pnpm check`. Exit 0; **123 files, 3985 passed** (3983 + `forgets only the window that closed` + the sweep row).

## Pedro's decision on the smoke-main CodeScene score

- Option (a), relayed by the coordinator: `canonical-writer-package-smoke-main.test.ts` stays at **9.68**, the base level. **Known debt for a later slice:** Primitive Obsession (38 % of its functions take primitive arguments), present at `8db84db` (39 %), not introduced by p4-s9. The Large Method this slice added is gone (`answerOpenPaths()`). The coordinator records the debt in the brief.
- `p4-s9-fix-smoke-green-2.log`: exit 0, **108 passed**. Matches.
- CPU before `pnpm check`, in its own call: 18.2, 12.8, 15.8 %; 12.5 GB free; no game process.
- `p4-s9-fix-check.log`: exit 0; **123 files, 3985 passed**. Matches. CodeScene for the fix round appended to `p4-s9-codescene.log`. One fix commit follows.
