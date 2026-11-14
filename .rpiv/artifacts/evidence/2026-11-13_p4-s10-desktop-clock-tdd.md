# TDD record: p4-s10-desktop-clock

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, slice `p4-s10-desktop-clock`, lane **normal** (the coordinator accepts the candidate). Q19 (b), Q20 (a), Q21 (a).
- Approved copy: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/approved-4a04fb87.md`. The branch's brief equals main's (`validate-artifact` OK; append-only against the approved copy: `keep`).
- Base: `fix/arch-review-phase-4` rebased onto main `92a772f` without conflict; `83ff857` (the brief's `eeae135`; `git diff eeae135 83ff857` over `apps`, `packages`, the Stryker and depcruise configs is empty).
- CPU rule: CPU and `League*` / `TFT*` / `RocketLeague*` / `Overwolf*` read in their own call before any run beyond one small file. No e2e or smoke run (Q21 (a)).
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/p4-s10-*.log`, each with its parent and working-tree patch digest.

## Baseline: prediction, written before the run

- CPU: 11.2, 8.2, 14.3 %; 10.7 GB free; no game process.
- `p4-s10-baseline`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/harness-supervisor.test.ts src/main/canonical-writer-package-smoke.test.ts src/main/canonical-writer-package-smoke-main.test.ts src/main/desktop-runtime.test.ts` in `apps/desktop`. Exit 0, **308 passed** (39, 151, 108, 10).

## Baseline: observed

- `p4-s10-baseline.log`: exit 0, **308 passed** (39, 151, 108, 10). Matches.

## Step 1, scaffold: edits, then prediction, written before the run

- `harness-supervisor.test.ts`: a counter clock (`clockId(n)` = `10000000-2001-4000-8000-` + n padded to 12; `clockTime(n)` = second n of `2001-01-01`, UTC); `supervisorWith(children, clock = counterClock())` passes it as the fourth constructor argument.
- `canonical-writer-package-smoke.test.ts`: the same counter clock, a fresh one per test in `beforeEach`; `run()` passes it as `clock`.
- `canonical-writer-package-smoke-main.test.ts`: the supervisor mock's constructor passes its arguments to `ports.supervisorCreated`; the runtime mock records its ports in a new `ports.runtimePorts` spy.
- `desktop-runtime.test.ts`: no scaffold (as the brief says).
- The counter clock is two small copies (supervisor test, writer test), not a shared peer file, so the slice stays inside its affected paths; `check:duplicates` decides.
- `p4-s10-scaffold`: the baseline command. Exit 0, **308 passed** (39, 151, 108, 10): extra arguments are ignored at the base.

## Step 1, scaffold: observed

- `p4-s10-scaffold.log`: exit 0, **308 passed** (39, 151, 108, 10). Matches.

## Step 2, rows P4-B33 to P4-B38: edits, then prediction, written before the run

- `harness-supervisor.test.ts`: `stamps the handshake with the injected clock` (P4-B33) and `reads the clock afresh for each child's handshake` (P4-B34, the restart path of `sends the same validated trusted roots…`: exit 1, 250 ms, second spawn), both matching the handshake posted on `port2` (`command: "system.handshake"`, `messageId`, `sentAt`).
- `canonical-writer-package-smoke.test.ts`: `stamps every protocol command with the injected clock` (P4-B35) in `scripted full sequence`.
- `canonical-writer-package-smoke-main.test.ts`: a new `describe("the desktop clock in main")` with `gives the supervisor the runtime clock` (P4-B36, `ordinaryLaunch()`) and `gives the writer proof the runtime clock` (P4-B37, the default writer-proof launch), over one helper `expectRuntimeClock` (identity with `ports.runtimePorts.mock.lastCall`, RFC 3339 UTC time between `Date.now()` reads, two distinct v4 UUIDs).
- `desktop-runtime.test.ts`: `hands the supervisor the clock it was given` (P4-B38): one `createSupervisor` call whose fourth argument `toStrictEqual({ createId: ports.createId, now: ports.now })` (Vitest's equality compares functions by identity).
- `p4-s10-red`: the baseline command. Exit 1, **6 failed, 308 passed** (41, 152, 110, 11 = 314):
  - P4-B33: `toMatchObject` fails on `messageId` and `sentAt` (a random UUID and the real time).
  - P4-B34: `toMatchObject` fails on the second handshake's `messageId` and `sentAt`.
  - P4-B35: `expect(ids).toContain(…)` fails on the first command (the fake `createId` was never called: `ids` is empty).
  - P4-B36: the fourth constructor argument is `undefined`: `TypeError` reading `createId` of `undefined` in `expectRuntimeClock`.
  - P4-B37: the runner input has no `clock`: the same `TypeError`.
  - P4-B38: `calls[0][3]` is `undefined`, so `toStrictEqual` fails (expected the object, received `undefined`).

## Step 2, rows: observed

- `p4-s10-red.log`: exit 1, **6 failed, 308 passed** (314). Each failure as predicted: P4-B33 and P4-B34 `toMatchObject` show a random UUID and the real time against `clockId(1)`/`clockTime(1)` and `clockId(2)`/`clockTime(2)`; P4-B35 `expected [] to include '<random uuid>'`; P4-B36 and P4-B37 `TypeError: Cannot read properties of undefined (reading 'createId')`; P4-B38 `expected undefined to strictly equal { createId: [Function Mock], …(1) }`. Matches.

## Step 3, the supervisor (P4-B33, P4-B34 green): edit, then prediction, written before the run

- `harness-supervisor.ts`: `import type { Clock } from "./harness-request-core.js"` (no cycle: the core imports neither the supervisor nor its importers); `readonly #clock: Clock`; the constructor gains a fourth parameter `clock: Clock`; `#connectChild` stamps the handshake with `this.#clock.createId()` and `this.#clock.now()`. `randomUUID` leaves the file.
- `p4-s10-green-supervisor`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/harness-supervisor.test.ts` in `apps/desktop` (one file). Exit 0, **41 passed**.

## Step 3, the supervisor: observed

- `p4-s10-green-supervisor.log`: exit 0, **41 passed**. Matches.

## Step 4, the writer proof (P4-B35 green): edit, then prediction, written before the run

- `canonical-writer-package-smoke.ts`: `import type { Clock } from "./harness-request-core.js"`; `ProofInput` gains `clock: Clock`; the module-level `metadata` becomes `metadata = (clock: Clock) => ({ messageId: clock.createId(), sentAt: clock.now() })`, and its four callers pass `proof.input.clock` (`spawn`) or `owner.proof.input.clock` (`activate`, `command`, `takeover`). `proofId` and `requestId` keep `randomUUID`.
- `p4-s10-green-writer`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/canonical-writer-package-smoke.test.ts` in `apps/desktop` (one file). Exit 0, **152 passed**.

## Step 4, the writer proof: observed (prediction missed)

- `p4-s10-green-writer.log`: exit 1, **7 failed, 145 passed** (152). Prediction was 152 passed; **missed**. P4-B35 passed. The 7 failures are existing rows that run several full sequences in one test with one clock: `rejects fixture 3|4 setup/send failures and retains its handle` (5 sequences each) and `rejects wrong proof, request, step and late duplicate for <step>` (5 sequences each, 5 steps); each fails `expect(reached).toBe(true)` on a later sequence.
- Explanation (from the code, before any change): my scaffold's `clockTime(n)` writes `n` as the seconds field, so from the 60th `now()` read onward it returns `2001-01-01T00:00:60.000Z` and beyond, not a valid instant. `createCommand` decodes every command through `DesktopMessageSchema` (`sentAt: TimestampSchema = UtcInstantSchema`, `protocol.ts:92`, `:494`), so the proof fails at that command, before it reaches the step these rows target. At the scaffold the clock was not read, which is why these rows were green there. A scaffold defect, not a slice or contract defect.
- Fix (scaffold, no assertion change): `clockTime(n)` becomes `new Date(Date.UTC(2001, 0, 1) + n * 1000).toISOString()` in both test files: the same text as before for n < 60 (so `2001-01-01T00:00:0n.000Z` for n < 10, as the brief names it), and a valid instant after.

## Step 4b, the fixed counter clock: prediction, written before the run

- `p4-s10-green-writer-2`: the `p4-s10-green-writer` command. Exit 0, **152 passed**.

## Step 4b: observed

- `p4-s10-green-writer-2.log`: exit 0, **152 passed**. Matches; the explanation holds. (The supervisor test's `clockTime` changed the same way; its values for n < 60 are unchanged, and the combined runs below re-run it.)

## Step 5, the runtime port (P4-B38 green): edit, then prediction, written before the run

- `desktop-runtime.ts`: `import type { Clock } from "./harness-request-core.js"`; `createSupervisor` gains a fourth parameter `clock: Clock`; the supervision Layer calls it with `{ createId: ports.createId, now: ports.now }`, the same functions it gives `createHarnessBridges`.
- `p4-s10-green-runtime`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/desktop-runtime.test.ts` in `apps/desktop` (one file). Exit 0, **11 passed**.

## Step 5: observed

- `p4-s10-green-runtime.log`: exit 0, **11 passed**. Matches.

## Step 6, `main.ts` (P4-B36, P4-B37 green): edit, then prediction, written before the run

- `main.ts`: `import type { Clock } from "./harness-request-core.js"`; one `const desktopClock: Clock = { createId: randomUUID, now: () => new Date().toISOString() }` above the runtime; `makeDesktopRuntime` gets `createId: desktopClock.createId` and `now: desktopClock.now`; its `createSupervisor` port is `(logger, entryPath, bootstrap, clock) => new HarnessSupervisor(entryPath, logger, bootstrap, clock)`; `runCanonicalWriterPackageSmoke` gets `clock: desktopClock`.
- `p4-s10-green-main`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/canonical-writer-package-smoke-main.test.ts` in `apps/desktop` (one file). Exit 0, **110 passed**.

## Step 6: observed

- `p4-s10-green-main.log`: exit 0, **110 passed**. Matches.

## Step 7, the "latched stop" rewording (comments only)

- `desktop-runtime.ts:50` (base `:48`): "each with its own latched stop" → "each with an idempotent stop". `:170-172` (base `:164-165`): `release()` "stops every bridge, where a second stop does nothing, then ends the core" (what `harness-bridges.ts:20-23` says). `:124` (`owned`, "one latched stop") stays.
- `desktop-runtime.test.ts:21` and `:66` reworded to "idempotent stop(s)". No identifier renamed.

## Step 8, the four files together: prediction, written before the run

- `p4-s10-green-all`: the baseline command. Exit 0, **314 passed** (41, 152, 110, 11).

## Step 8: observed

- `p4-s10-green-all.log`: exit 0, **314 passed** (41, 152, 110, 11). Matches.

## Step 9, bindings 1 to 6: predictions, written before the runs

Each binding is applied by `bind4.sh` (backup, apply, run, restore, digest check), and run on its one test file in `apps/desktop` with `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose <file>`.

- `p4-s10-bind-1` (`harness-supervisor.ts`: a `#stamp` read once in the constructor, spread into every handshake; `harness-supervisor.test.ts`): exit 1, **1 failed, 40 passed**: P4-B34 (the second handshake carries `clockId(1)`/`clockTime(1)`). P4-B33 passes (the constructor's read is the first).
- `p4-s10-bind-2` (`harness-supervisor.ts`: `sentAt: new Date().toISOString()` beside `this.#clock.createId()`): exit 1, **2 failed, 39 passed**: P4-B33 on `sentAt`, and P4-B34 on `sentAt` (the brief names P4-B33; P4-B34 also reads `sentAt`).
- `p4-s10-bind-3` (`canonical-writer-package-smoke.ts`: `messageId: randomUUID()`; `canonical-writer-package-smoke.test.ts`): exit 1, **1 failed, 151 passed**: P4-B35, `expected [] to include '<random uuid>'`.
- `p4-s10-bind-4` (`main.ts`: the supervisor port ignores its clock and builds `{ createId: randomUUID, now: () => new Date().toISOString() }`; `canonical-writer-package-smoke-main.test.ts`): exit 1, **1 failed, 109 passed**: P4-B36 on `expect(clock.now).toBe(runtimePorts.now)`. (`createId` stays identical: both are `randomUUID` itself, so identity can only bite on `now`.)
- `p4-s10-bind-5` (`main.ts`: the runner gets `{ ...desktopClock, now: () => "2001-01-01T00:00:00.000Z" }`): exit 1, **1 failed, 109 passed**: P4-B37 on `expect(clock.now).toBe(runtimePorts.now)` (the first failing assertion; the time bounds come after it).
- `p4-s10-bind-6` (`desktop-runtime.ts`: the supervisor's `now: () => new Date().toISOString()`; `desktop-runtime.test.ts`): exit 1, **1 failed, 10 passed**: P4-B38, `toStrictEqual` fails on `now`.

## Step 9: observed

- `p4-s10-bind-1.log`: exit 1, **1 failed, 40 passed**: P4-B34, received `clockId(1)`/`clockTime(1)` for the second handshake. Restored (`a315b768…af66`). Matches.
- `p4-s10-bind-2.log`: exit 1, **2 failed, 39 passed**: P4-B33 and P4-B34, each on `sentAt` (the real time). Restored (`a315b768…af66`). Matches.
- `p4-s10-bind-3.log`: exit 1, **1 failed, 151 passed**: P4-B35, `expected [] to include '<random uuid>'`. Restored (`71da8ef8…81dc`). Matches.
- `p4-s10-bind-4.log`: exit 1, **1 failed, 109 passed**: P4-B36, `expected [Function now] to be [Function now]` in `expectRuntimeClock`. Restored (`5e8ddef1…c00b`). Matches.
- `p4-s10-bind-5.log`: exit 1, **1 failed, 109 passed**: P4-B37, the same `now` identity failure. Restored (`5e8ddef1…c00b`). Matches.
- `p4-s10-bind-6.log`: exit 1, **1 failed, 10 passed**: P4-B38, `toStrictEqual` fails. Restored (`d18ab886…ed2e`). Matches.

## Step 10, the Stryker re-pointing: prediction, written before the run

- `p4-s10-ranges-red`: `pnpm check:mutation-ranges` from the root, before any re-pointing. Exit 1: drift on the moved entries (the checker reports only its first problem class). Expected drifted entries: `main.ts:85-95` and `:379-379` (desktop-s6, the clock value and imports above), `canonical-writer-package-smoke.ts:300-341` (desktop-s6, the import and `ProofInput` field), `desktop-runtime.ts:166-189` (desktop-s7, the import, the port parameter, the supervision call and the comment), `harness-supervisor.ts:61-73`, `:176-233`, `:399-435` (desktop-s8; the import swap keeps the first in place, so `:61-73` may not move, and the field and constructor shift the last two).

## Step 10: observed

- `p4-s10-ranges-red.log`: exit 1, `STRYKER_RANGE_DRIFT` on six entries: `main.ts:85-95` → `89-99`, `main.ts:379-379` → `384-384`, `canonical-writer-package-smoke.ts:300-341` → `302-343`, `desktop-runtime.ts:166-189` → `173-196`, `harness-supervisor.ts:176-233` → `178-235`, `:399-435` → `401-437`. `harness-supervisor.ts:61-73` did not move (the import swap keeps its line count). Matches, with that entry resolved as "may not move".

## Step 11, re-pointed by line: prediction, written before the run

- Edit: those six entries re-pointed to the checker's lines in `stryker.desktop-s6.config.json`, `stryker.desktop-s7.config.json`, `stryker.desktop-s8.config.json` and `stryker-range-anchors.json` (the `entry` lines only; first and last texts unchanged).
- `p4-s10-ranges-green`: `pnpm check:mutation-ranges`. Exit 0, counts unchanged.

## Step 11: observed

- `p4-s10-ranges-green.log`: exit 0; `desktop-s6` 7 ranges, 6 whole files; `desktop-s7` 6, 3; `desktop-s8` 3, 0; `project-storage-desktop` 0, 4. Counts unchanged. Matches. `git diff stryker-range-anchors.json`: only the six `entry` line numbers.

## Step 12, gates: predictions, written before the runs

- `p4-s10-biome`: `pnpm exec biome check <the 8 source and test files>` from the root. Exit 1 or 0: Biome may want the long UUID regex line in `canonical-writer-package-smoke-main.test.ts` wrapped and the supervisor test's `supervisorWith` signature wrapped (both over 100 columns); nothing else.
- `p4-s10-biome.log` observed: exit 1, one format fix (the UUID regex line in `canonical-writer-package-smoke-main.test.ts`); the `supervisorWith` line fits. Applied with `biome format --write` on that file.
- `p4-s10-biome-2`: the same check. Exit 0.
- `p4-s10-biome-2.log` observed: exit 0. Matches.
- `p4-s10-typecheck`: `pnpm typecheck`. Exit 0.
- `p4-s10-knip`: `pnpm knip` (the repo's Knip script). Exit 0.
- `p4-s10-jscpd`: `pnpm check:duplicates`. Exit 0, no clone (the two counter clocks are 9 lines each, under `minLines: 10`).
- Correction before the run: the Knip script is `pnpm check:dead-code` (runs `knip`); `p4-s10-knip` runs that. Same prediction.
- Observed: `p4-s10-typecheck.log` exit 0; `p4-s10-knip.log` exit 0; `p4-s10-jscpd.log` exit 0, "Found 0 clones". Match.

## Step 13, structural checks (observed)

- `harness-supervisor.ts`: no `randomUUID` and no `new Date(`. `canonical-writer-package-smoke.ts`: no `new Date(`; `randomUUID(` at `:742` (`proofId`) and `:763` (`requestId`) only. `new HarnessSupervisor(` outside tests: `main.ts:83` only, four arguments. The protected-paths diff against `83ff857` is empty. `latched stop`: `desktop-runtime.ts:124` only. `git diff 83ff857 --stat`: the 12 affected paths, plus this record (untracked). Outside tests and `harness-log-lines.ts` (a harness-supplied time), `main.ts:65` is the one desktop main `new Date()`.

## Step 14, CodeScene (observed)

- 10: `harness-supervisor.ts`, `canonical-writer-package-smoke.ts`, `main.ts`, `desktop-runtime.ts`, `canonical-writer-package-smoke.test.ts`, `desktop-runtime.test.ts`. `canonical-writer-package-smoke-main.test.ts`: 9.68 (= base; Q20 (a) holds).
- **`harness-supervisor.test.ts`: 9.38 (base 10). Criterion missed.** One finding: "Lines of Code in a Single File" (1040 lines without comments). The base file sat just under the size threshold; the two P4-B33/P4-B34 rows and the counter clock (about 45 lines) push it over. No other smell. Stopped here and reported to the coordinator: the fix (splitting the file, or accepting the size) changes paths or a criterion the brief fixed.

## Step 15, the split (Pedro chose (c), relayed by the coordinator): edit, then prediction, written before the run

- **Deviation (paths outside the contract), recorded as instructed:** `describe("harness upgrade log lines")` moves unchanged (text verbatim; no title or assertion changes) from `harness-supervisor.test.ts` to a new `apps/desktop/src/main/harness-supervisor-log-lines.test.ts`. The helpers both files need move to a new test-only `apps/desktop/src/main/harness-supervisor-test-peers.ts` (after `harness-session-test-peers.ts`): `FakePort`, `FakeChild`, `expectShutdownTimeout`, `logger`, `eventMetadata`, `bootstrap`, `channels` (a cleared `const` array instead of a reassigned `let`), the counter clock, `supervisorWith`, and `resetSupervisorDoubles(mocks, failPosts)`, which does what each file's `beforeEach` did with the channels, the fork and the logger. `vi.mock` stays in each test file (Vitest hoists it per file); `failPortPost` stays in `harness-supervisor.test.ts`, passed to the reset as `() => failPortPost`, so its row is untouched. The trailing `it.each(… "answers broken for a read during $failure")` is outside the describe and stays.
- The new test file is added wherever `harness-supervisor.test.ts` is listed: `vitest.desktop-s7-mutation.config.ts`, `vitest.desktop-s8-mutation.config.ts`, `vitest.project-storage-mutation.config.ts`.
- Rows at step 8: 41 in `harness-supervisor.test.ts` = 23 (`HarnessSupervisor`) + 16 (`harness upgrade log lines`) + 2 (the trailing `it.each`).
- `p4-s10-split`: `pnpm exec vitest run --config vitest.main.config.ts --reporter=verbose src/main/harness-supervisor.test.ts src/main/harness-supervisor-log-lines.test.ts` in `apps/desktop`. Exit 0, **41 passed**: 25 in `harness-supervisor.test.ts`, 16 in `harness-supervisor-log-lines.test.ts` (25 + 16 = 41), with the same titles as at step 8.
- Then `pnpm check:duplicates`: 0 clones.
- Before the run, Biome (`check --write`, then `--unsafe --only=lint/correctness/noUnusedImports` on `harness-supervisor.test.ts`) formatted the new header and removed the imports that moved (`EventEmitter`, `HarnessBootstrapSchema`, `HarnessUpgradeLogLineSchema`, `MessageIdSchema`-free `Logger`, `HarnessShutdownTimeout`, `HarnessSupervisor`). The describe text in the new file is byte-identical to the base's (`diff` empty).

## Step 15: observed (prediction missed)

- `p4-s10-split.log`: exit 1, **25 failed, 16 passed** (41). Every failure is `TypeError: () => {…} is not a constructor` at `new MessageChannelMain()` (`harness-supervisor.ts:493`). Cause: my peers file installs the channel factory as an arrow function; `MessageChannelMain` is called with `new`, and a `vi.fn` whose implementation is an arrow cannot construct. The base used a `function createChannel()` declaration. A peers defect, not a moved-row defect.
- Fix: the factory becomes a named `function createChannel()` in the peers file (reading `failPosts` from the reset).
- `p4-s10-split-2`: the `p4-s10-split` command. Exit 0, **41 passed** (25 + 16), titles identical to step 8.
- Correction to the Biome note above (a slip in my list): the imports removed from `harness-supervisor.test.ts` are `EventEmitter`, `HarnessBootstrapSchema`, `HarnessUpgradeLogLineSchema`, `MessageIdSchema`, `Logger`, `HarnessShutdownTimeout` and `HarnessSupervisor` (each now used only through the peers or the moved block).
- `p4-s10-split-2.log` observed: exit 0, **41 passed**: 25 in `harness-supervisor.test.ts`, 16 in `harness-supervisor-log-lines.test.ts`; the sorted titles equal step 8's. Matches.

## Step 16, gates after the split: predictions, written before the runs

- `p4-s10-biome-3`: `pnpm exec biome check` over the 11 touched source, test and config files. Exit 0.
- `p4-s10-jscpd-2`: `pnpm check:duplicates`. Exit 0, 0 clones.
- `p4-s10-typecheck-2`: `pnpm typecheck`. Exit 0.
- `p4-s10-knip-2`: `pnpm check:dead-code`. Exit 0 (every peers export is imported by a test).

## Step 16: observed

- `p4-s10-biome-3.log`: exit 0 over **13** files (my "11" was a count slip: 8 slice files, 2 new test files, 3 mutation configs). Matches otherwise.
- `p4-s10-jscpd-2.log`: exit 0, "Found 0 clones". Matches.
- `p4-s10-typecheck-2.log`: exit 0. Matches.
- `p4-s10-knip-2.log`: exit 1, **missed**: `FakePort` is an unused export of the peers file (only the peers' own channel factory uses it). Fix: `FakePort` is no longer exported.
- `p4-s10-knip-3`: `pnpm check:dead-code`. Exit 0.
- `p4-s10-knip-3.log` observed: exit 0. Matches.

## Step 17, CodeScene after the split (observed; `p4-s10-codescene.log`)

- 10: `harness-supervisor.test.ts` (was 9.38), `harness-supervisor-log-lines.test.ts` (new), `harness-supervisor-test-peers.ts` (new), and the six files measured at step 14. `canonical-writer-package-smoke-main.test.ts` 9.68 (= base, Q20 (a)). Criterion met.

## Step 18, `pnpm check`: prediction, written before the run

- CPU (own call): 7.2, 12.9, 8 %; 10.1 GB free; no game process.
- `p4-s10-check`: `pnpm check` from the root. Exit 0. Vitest: **124 files, 3991 tests** passed (p4-s9 fix check: 123 files, 3985; +1 file for `harness-supervisor-log-lines.test.ts`, +6 rows).
- `p4-s10-check.log` observed: exit 0, **124 files, 3991 tests** passed. Matches.

## Commit

- One slice commit: the 8 slice files, the 2 new test files, the 3 mutation Vitest configs, the 4 Stryker files and this record. No e2e or smoke run (Q21 (a)); no mutation run (the final Phase 4 run covers `desktop-s6`, `desktop-s7`, `desktop-s8` and `project-storage-desktop`).
