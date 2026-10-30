# TDD record: p3-s6a-effect-rule-promotion

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `c14caef2…`; approved copy `approved-1432f57c.md` (main checkout evidence folder). Append-only against it: clean (frontmatter plus the 2026-10-27 decision block only).
- Contract commit: `6be7f7e` (the brief alone), on `07c46e5`.
- Lane: normal. Decisions:
  - Q49 (a): split; s6a goes first.
  - Q50 (a): one canary plant per unwitnessed rule; every key is taken from the compiler.
  - Q51 (a): no mutation for s6a.
- Evidence logs: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s6a-*.log` (main checkout).

## Static prediction, written before any run

### Planned change

- `tsconfig.base.json:39-42`: `anyUnknownInErrorContext`, `schemaNumber`, `unnecessaryFailYieldableError` and `extendsNativeError` change from `"warning"` to `"error"`. Nothing else changes; the test-file override stays `newPromise: off` only.
- `canary.ts`. Line 1 becomes `import { Data, Effect, Schema } from "effect";`, so the columns on lines 3 and 4 do not move. Lines 9-16 are appended:

  ```ts
  9  export const unbounded = Schema.Number;
  10 class CanaryRefusal extends Data.TaggedError("CanaryRefusal") {}
  11 const refusal = new CanaryRefusal();
  12 export const refused = Effect.gen(function* () {
  13   yield* Effect.void;
  14   return yield* Effect.fail(refusal);
  15 });
  16 export class CanaryNativeError extends Error {}
  ```

  - Line 13 keeps the generator from being a single `return yield*`, so the `message` rule `unnecessaryEffectGen` does not fire. The gate reads every severity, so a `message` would also be a canary key.
  - There is no `Effect.fail(new …)`, so the s5c multiline check stays at 0.
- `expectedCanary` (`check-effect-diagnostics.mjs`), the gate-test tables (`canaryEntries`, `missingEverything`, the `canaryRows` "missing the last expected diagnostic" row, the `differenceRows` keys) and `effect-diagnostics-recorded.json` `canaryWithoutPlugin` take the compiler's keys. The `canary` recorded entry is not read by any test (only `canaryWithoutPlugin` is, through `recordedRun`). It is re-recorded too, so the two stay a pair.

### Predicted keys (positions predicted; the real ones are taken from the compiler at the red and pinned)

| Key | Source |
|---|---|
| `src/canary.ts(3,24) error newPromise` | unchanged |
| `src/canary.ts(4,14) error anyUnknownInErrorContext` | today `warning` |
| `src/canary.ts(4,24) error unknownInEffectCatch` | unchanged |
| `src/canary.ts(4,24) error anyUnknownInErrorContext` | today `warning` |
| `src/canary.ts(9,26) error schemaNumber` | `Schema.Number` (column predicted at `Schema`) |
| `src/canary.ts(14,17) error unnecessaryFailYieldableError` | `Effect.fail(refusal)` (column predicted at `Effect`) |
| `src/canary.ts(16,14) error extendsNativeError` | the class name (column predicted at `CanaryNativeError`; it may be at `Error`, col 40) |

If the compiler gives another column, or any extra diagnostic on lines 9-16, I record it as an observed mismatch. An extra diagnostic means the plant has the wrong shape: I stop, and I do not add the key.

### Red at the base

Run on `6be7f7e` with the new canary, `expectedCanary` and test tables, but the old `tsconfig.base.json` (rules at `warning`). The `canaryWithoutPlugin` recording and the plugin-removed real row's `lines` keep today's values (`check-effect-diagnostics.test.mjs`): **3 failed**.

1. "runs the canary before any package: real canary": `ok: false`, `EFFECT_GATE_CANARY_MISMATCH`, 10 lines:
   - `extra … warning` for (4,14) and (4,24) `anyUnknownInErrorContext`, (9,26) `schemaNumber`, (14,17) `unnecessaryFailYieldableError` and (16,14) `extendsNativeError`;
   - `missing … error` for the same 5.
   - There is no `canary exit` line, because exit 1 comes from the `newPromise` error.
2. "plugin removed, real compiler": its pinned 2 lines against the new `expectedCanary`. It fails with those 10 lines plus the 2 test-file `extra … error newPromise` lines (reasoning below).
3. The fake "plugin removed" `canaryRows` row: the old recording holds the old keys, and the new expected set does not match it. Its exact lines are recorded at the run.

The other fake rows use `canaryEntries` together with `expectedCanary`, so they pass.

### Green at the candidate

- With `tsconfig.base.json` promoted, the real canary row passes (`ok: true, canary: "matched"`).
- **P3-B35, a point for the coordinator (the brief's expectation differs from today's evidence).**
  - The brief expects the plugin-removed real row to change on the candidate: `missing … error <rule>` for each promoted line whose effect-tsgo *default* severity is not `error`. The `schema.json` defaults are `anyUnknownInErrorContext` off, `schemaNumber` suggestion, `unnecessaryFailYieldableError` suggestion and `extendsNativeError` off.
  - Today's recorded plugin-removed output is evidence against defaults applying. It equals the expected set (`error newPromise`, whose default is `off`; `warning anyUnknownInErrorContext`, whose default is `off`) plus only the 2 test-file `newPromise` lines. With `plugins: []`, the severities still follow `tsconfig.base.json`, and only the test-file override is lost.
  - **My prediction:** on the candidate the plugin-removed real row gives exactly today's 2 lines (`extra src/planted.test.ts(1,30) error newPromise`, `extra tests/planted.ts(1,31) error newPromise`). Its `lines` do not change, and P3-B35 has **no red** of its own beyond the base run above.
  - If the compiler instead gives default-severity lines, I record them as observed, pin them, and report.
- The fake "plugin removed" row passes against the re-recorded `canaryWithoutPlugin` with the same 2 lines.
- `check-effect-diagnostics.test.mjs` has 0 failed.
- Effect read: 7 diagnostics, all `message`, 0 warnings, no `error`. The canary is not in the read; it is its own project.
- `pnpm check:effect`: exit 0, "Effect diagnostics verified; 0 advisory warnings."

### Bindings (one per command, applied by hand on the candidate, restored by digest)

The run for B1 and B2 is `pnpm --filter @slopstop/harness exec vitest run scripts/check-effect-diagnostics.test.mjs`.

1. One rule back to `"warning"` in `tsconfig.base.json`, 4 separate runs. Each run fails **2 rows**: the real canary row and the plugin-removed real row (its severities follow the base config, by the reasoning above). The real canary row's lines in each run:
   - **B1a** `anyUnknownInErrorContext`: 4 lines (`extra … warning` and `missing … error` at (4,14) and (4,24));
   - **B1b** `schemaNumber`: 2 lines at (9,26);
   - **B1c** `unnecessaryFailYieldableError`: 2 lines at (14,17);
   - **B1d** `extendsNativeError`: 2 lines at (16,14).
   - The fake rows stay green.
2. **B2**: line 9 becomes `export const unbounded = Schema.Finite;` (the plant is removed in place, so no later line moves). **2 rows fail**:
   - the real canary row, with exactly `missing src/canary.ts(9,26) error schemaNumber`;
   - the plugin-removed real row, the same `missing` line plus its 2 extras.
3. **B3**: `apps/harness/src/storage/local-libsql-worker-client.ts`, at the `Schema.Finite` near `:24`, becomes `Schema.Number`. **`pnpm check:effect` exits 1**, with a blocking line naming `apps/harness: …local-libsql-worker-client.ts(<line>,<col>) error schemaNumber` in the gate's error format, and no success line. Restored by digest. (CPU rule.)

### Structural checks (candidate)

- `rg -n '"(anyUnknownInErrorContext|schemaNumber|unnecessaryFailYieldableError|extendsNativeError)": "error"' tsconfig.base.json` → 4 lines.
- `rg -n '": "warning"' tsconfig.base.json` → 0 lines.
- `rg -n -U "Effect\.fail\(\s*new " apps packages` → 0 lines.
- `git diff 07c46e5 --stat`: the brief and the 5 s6a paths.

### Gates

- `pnpm typecheck` and `pnpm check` exit 0.
- CodeScene 10 on `check-effect-diagnostics.mjs` and its test (and on `canary.ts`).
- jscpd 0; knip clean. No mutation (Q51 (a)).

## Observed (appended after the runs; the prediction above is unchanged)

- **Plant lines: a static misread, corrected before any run.** `canary.ts` had 7 lines, not 8: the `plantedInTest` line I counted belongs to `src/planted.test.ts`. The plants are lines 8-15, one line earlier than predicted.
- Keys from the compiler (`p3-s6a-canary-keys-base-config.log`, the old config, before the expected set was edited):
  - `(8,33) warning schemaNumber`: the column is at `Number`, not at `Schema` as predicted;
  - `(13,10) warning unnecessaryFailYieldableError`: at `yield*`, not at `Effect`;
  - `(15,14) warning extendsNativeError`: at the class name, as predicted;
  - no extra diagnostic on lines 8-15, so the plant shape is right.
- These compiler keys are pinned in `expectedCanary`, `canaryEntries`, `missingEverything` (in the gate's sorted order), the "missing the last expected diagnostic" row (now `entries.slice(0, -1)` → `missing src/canary.ts(15,14) error extendsNativeError`) and `secondKey`.
- Red (`p3-s6a-red.log`, the old `tsconfig.base.json`): **4 failed | 61 passed**, against 3 predicted (harder, explained).
  - The 3 predicted rows:
    - real canary: `ok: false`;
    - plugin removed, real compiler: `extra … warning` ×5 and `missing … error` ×5, plus the 2 test-file `newPromise` extras;
    - fake "plugin removed": against the old recording.
  - Plus "passes on the repository" (`:824`). It runs the whole gate with its canary on the repository, so the same canary mismatch fails it. I missed it.
- **P3-B35, prediction against the brief (decided by the compiler).** I recorded `canaryWithoutPlugin` exactly as the test builds it: a temporary root, the canary copied, an `effect` junction, `extends` the repository base, and `plugins: []`. Scratch script `record-noplugin.mjs`.
  - On the candidate it gives the 7 expected keys at `error` plus the 2 test-file `newPromise` lines.
  - So the severities follow `tsconfig.base.json`, not the effect-tsgo defaults. The plugin-removed rows keep today's 2 lines, as predicted, and the brief's "missing … error <rule> for default-not-error rules" does not happen.
  - A side note: the same recipe inside the repository (relative `extends`) keeps even the test-file override, and gives only the 7 keys. Only the copied root loses it.
- Recordings: `canary` (an in-repository run) and `canaryWithoutPlugin` (the temporary-root recipe) were re-recorded. `<root>` replaces the root, and the JSON round-trips byte-identically.
- `pnpm check:effect` (`p3-s6a-check-effect.log`) on the candidate: exit 0, "Effect diagnostics verified; 0 advisory warnings."
- **Green (`p3-s6a-green.log`): 1 failed | 64 passed, an unpredicted green failure. STOP.**
  - The row is "fails on a planted Effect error: 'unknownInEffectCatch'" (`:107`, `plantedRows`).
  - Its temporary project extends the repository base and has its own plugin entry with only `unknownInEffectCatch` and `newPromise` at `error`. Its source `Effect.tryPromise({ …, catch: (cause) => cause })` now also gives 2 `anyUnknownInErrorContext` errors (line 4).
  - So `result.violations` is 3 entries, not `[violation]`.
  - Mechanism: as with P3-B35, the base config's severities reach that project even under its own plugin entry, and the promotion makes `anyUnknownInErrorContext` an error there.
  - That row is not among the brief's s6a test-table edits. Reported to the coordinator for a decision.
- Coordinator decision (a): the planted rows' own plugin entry turns off `anyUnknownInErrorContext`, with proof. With the override the row must give exactly 1 violation; without it, 3. The 3-without case is the row's binding, already observed in `p3-s6a-green.log`: 3 violations, `anyUnknownInErrorContext`, `unknownInEffectCatch`, `anyUnknownInErrorContext`, all on line 4.
- Green 2 (`p3-s6a-green-2.log`, CPU 9-13% before; `plantedProject`'s `diagnosticSeverity` adds `anyUnknownInErrorContext: "off"`, and its TSDoc says why): **1 failed | 64 passed**.
  - The planted `unknownInEffectCatch` row **passes**, so the child key overrides the base key and the row is back to exactly 1 violation.
  - The 1 failure is a **timeout**: "passes on the repository" ran 32.6 s against its 30 000 ms limit. The file took 37.2 s against 12.5 s in green 1, where that row passed.
  - Not rerun (gate-timeout rule). Reported to the coordinator before any rerun.
- Diagnostic rerun (`p3-s6a-green-3.log`, verbose; coordinator GO; run once, alone; CPU 7-15% before, 5 idle `OverwolfBrowser`): **65 passed**, 12.35 s.
  - Slowest rows: "passes on the repository" 8 034 ms (32.6 s in green 2), the 3 planted rows 847-984 ms, the 2 real canary rows about 420 ms.
  - CPU during the run (`p3-s6a-green-3-cpu.log`, background sampler, 2 s): 2-31 %, with `tsc` children of the gate on top and no heavy outside process.
  - The green-2 timeout did not come back. Its cause is not identified; nothing in this run shows load.

### Bindings (one per command, each restored by digest)

The gate test file is the run for each binding. The real canary row's `toMatchObject` does not print its lines; the plugin-removed real row prints them, and they are quoted below.

- B1a `anyUnknownInErrorContext` (`p3-s6a-binding-1a.log`): **3 failed** against 2 predicted (harder, explained).
  - The predicted 2 failed: the real canary row and the plugin-removed real row. The latter shows exactly `extra (4,14)` and `(4,24) warning anyUnknownInErrorContext`, and `missing (4,14)` and `(4,24) error anyUnknownInErrorContext`, plus its 2 test-file extras.
  - Plus "passes on the repository", which runs the same canary (the red's mechanism).
- B1b `schemaNumber` (`p3-s6a-binding-1b.log`): 3 failed (same 3 rows). The lines are `extra (8,33) warning` and `missing (8,33) error schemaNumber`.
- B1c `unnecessaryFailYieldableError` (`p3-s6a-binding-1c.log`): 3 failed (same 3 rows). The lines are `extra (13,10) warning` and `missing (13,10) error`.
- B1d `extendsNativeError` (`p3-s6a-binding-1d.log`): 3 failed (same 3 rows). The lines are `extra (15,14) warning` and `missing (15,14) error`.
- B2: the plant becomes `Schema.Finite` in place (`p3-s6a-binding-2.log`). 3 failed (same 3 rows), with exactly `missing src/canary.ts(8,33) error schemaNumber` (plus the 2 extras on the plugin-removed row).
- B4: the planted rows' `anyUnknownInErrorContext: "off"` is removed (`p3-s6a-binding-4-override.log`). 1 failed, the planted `unknownInEffectCatch` row, back to its 3 violations. With the override it gives exactly 1, so the override is load-bearing.
- B3: line 24 of `local-libsql-worker-client.ts` back to `Schema.Number` (`p3-s6a-binding-3.log`; run alone; CPU 0-15%; digest before, restored by digest after).
  - `pnpm check:effect` **exit 1**: `EFFECT_GATE_VIOLATIONS`, `apps/harness/src/storage/local-libsql-worker-client.ts(24,10) schemaNumber`, and no success line. As predicted.
  - The gate's line format is `path(line,col) rule`, without the word `error`.

### Gates so far

- Effect read (`p3-s6a-effect-read.log`, `effect-advisory-p3-s6a-candidate.json`): 7 diagnostics, all `message`; 0 warnings; 0 errors.
- Structural checks:
  - the 4 promoted rules at `"error"`: 4 lines;
  - `": "warning"` in `tsconfig.base.json`: 0;
  - multiline `Effect.fail(new`: 0;
  - `git diff 07c46e5 --stat`: the brief and the 5 s6a paths.
- CodeScene: 10 on `check-effect-diagnostics.mjs`, its test, and `canary.ts`.
- jscpd: 0 clones. knip: clean.
- `pnpm check`: not run yet. The CPU read gave 22/48/28 %, with `LeagueClient` running, so it waits for Pedro's word that the machine is free.
- `pnpm check` (`p3-s6a-pnpm-check.log`):
  - Run on the coordinator's GO after Pedro said the machine was free. The read was 7/5/7 % with League and TFT closed, and **5 idle `OverwolfBrowser` processes still running** (recorded as the coordinator asked).
  - Result: exit 0, "Effect diagnostics verified; 0 advisory warnings.", 117 files, 3763 tests.
- `pnpm check:duplicates` after the check (`p3-s6a-duplicates-2.log`): 0 clones.

### Candidate

- `b5013e9` fix(harness): promote the four effect rules to errors with a canary per rule (p3-b34, p3-b35), on `6be7f7e`. Patch: `p3-s6a-candidate-b5013e9.patch`.
- lint-staged Biome changed nothing (`git diff --stat f57a9e5 b5013e9 -- apps tsconfig.base.json` is empty).
- `lane.mjs --range 6be7f7e..b5013e9`: `fast` ("within fast limits"). The approved lane is normal.
- `slice-preflight.mjs` (`p3-s6a-preflight.log`): `preflight: clean`.
- Mismatches, all harder and explained:
  - the red failed 4 rows against 3 predicted;
  - B1a-d and B2 each failed 3 rows against 2 predicted (the repository row runs the same canary).
- Prediction against the brief: P3-B35's plugin-removed lines do not change (the compiler decided).
- Misreads recorded above: the canary's line count, and 2 columns.
- The planted-row override is the coordinator's decision (a), shown load-bearing by B4.

## Verifier round 1 and the V1 fix (coordinator decisions; the brief is not edited)

- Verifier round 1, the only round: **passed with warnings**.
- **V1 (cross-slice; the gap predates s6a).** A gated package's own tsconfig could declare an `@effect/language-service` plugin entry and turn a promoted rule off, key by key, as B4 showed for a child override. The canary would still match, because it covers only its own project.
- Fixed now in s6a, red then green:
  - code **`EFFECT_GATE_PLUGIN_OVERRIDE`**, line `<project>/tsconfig.json declares compilerOptions.plugins`;
  - checked for every scanned project that is in `defaultProjects`;
  - the tsconfig is parsed as JSONC: comments and trailing commas give the right answer;
  - `"plugins": []` counts as declaring the key, because it replaces the base list;
  - an unreadable tsconfig is `EFFECT_GATE_BROKEN` (`<project>/tsconfig.json is unreadable`);
  - a missing tsconfig is left to the run, where effect-tsgo already fails it (the recorded `missingTsconfig` row).
- Polish in the same commit: the `expectedCanary` TSDoc and the removed-plugin claim in `checkCanary`'s TSDoc are corrected to the recorded behaviour. With `plugins: []`, the base severities stay.
- Rows, written before the gate change: the gated package `packages/kernel` under a temporary root, with a planted `Schema.Number`.
  - `refuses a gated package that declares its own plugins: $name`, 3 rows: "a rule turned off" (`schemaNumber: "off"`), "an empty list" (`"plugins": []`), and "commented JSONC with a trailing comma" (rule off). Each expects exactly `{ ok: false, code: "EFFECT_GATE_PLUGIN_OVERRIDE", lines: [declared] }`, CLI exit 1, and that exact stderr.
  - `checks a commented gated package without plugins and blocks its violation`: a JSONC tsconfig with no `plugins` must not be refused. It is `EFFECT_GATE_VIOLATIONS` on `packages/kernel/src/a.ts` line 2, `schemaNumber`.
  - `refuses a gated package whose tsconfig cannot be read` (`{ not a config`) → `EFFECT_GATE_BROKEN`, `packages/kernel/tsconfig.json is unreadable`.
- Predicted red, today's gate on these rows: **4 failed**.
  - "a rule turned off": `ok: true`, and the CLI exits 0. This is the verifier's needs-run: today `check:effect` passes such a package.
  - "commented JSONC": `ok: true`, CLI exit 0, for the same reason.
  - "an empty list": `EFFECT_GATE_VIOLATIONS` (`schemaNumber`). With `plugins: []` the base severities stay, so it is caught today, but not under the new code.
  - "unreadable": the run itself fails, as `EFFECT_GATE_BROKEN` with other lines or as another code. The exact result is recorded.
  - The commented row without plugins passes (a guard).
- V1 red (`p3-s6a-v1-red.log`; CPU 8/14/13 % on the third read; 5 idle `OverwolfBrowser`): **7 failed | 63 passed**.
  - The 4 predicted V1 reds, as predicted:
    - "a rule turned off": `ok: true, warnings: 0, projects: ["packages/kernel"]`. **Today the gate passes a package that turns a promoted rule off.** This settles the verifier's needs-run.
    - "commented JSONC with a trailing comma": `ok: true`, likewise.
    - "an empty list": `EFFECT_GATE_VIOLATIONS`, `packages/kernel/src/a.ts(2,33) schemaNumber`. The base severities stay under `plugins: []`.
    - "unreadable": `EFFECT_GATE_BROKEN` with `packages/kernel: exit 0 with unreadable output` and the report head. effect-tsgo exits 0 with `filesWithoutPlugin: 1` and no `files` list.
  - The commented row without plugins passed, as a guard.
  - **Unpredicted: 3 timeouts.** The 3 `plantedRows` rows ("unknownInEffectCatch", "newPromise", "clean") timed out at the 5 000 ms default, at 7.5-8.7 s. They took about 0.85-0.98 s in green 3. This is the slow-machine pattern of green 2 again.
  - STOP: reported to the coordinator, with no rerun and no timeout change. There was no CPU sampler during this run.
- **Cause, found by the coordinator:** Pedro was running tests in another project on this machine. That outside load came in bursts, and my CPU reads fell between them. It explains both timeouts: green 2's "passes on the repository" and these 3 planted rows.
- `p3-s6a-v1-red.log` is **invalid as a red**, because it ran under outside load. The next red is the first valid run, not a rerun to chase green. It waits for the coordinator's "livre", then one CPU read, then it runs alone with a CPU sampler. Predicted: exactly the 4 V1 reds, everything else green.
- **V1 red, the first valid run** (`p3-s6a-v1-red-2.log`): run after the coordinator's "livre" (CPU 2/4/3 %, 5 idle `OverwolfBrowser`), alone, with a CPU sampler (`p3-s6a-v1-red-2-cpu.log`). **4 failed | 66 passed**: exactly the 4 V1 rows, everything else green, 14.2 s. As predicted.
- Green:
  - `checkPluginOverrides` (`check-effect-diagnostics.mjs`) runs after the waiver register and before the package runs. It parses each scanned default project's `tsconfig.json` with TypeScript's `parseConfigFileTextToJson` (the TypeScript 6 JavaScript API, the `typescript` package that AGENTS.md keeps for tools).
  - `readConfig` passes a `/`-separated file name, because TypeScript asserts one in its diagnostics.
  - First green (`p3-s6a-v1-green.log`): 1 failed, the unreadable row, on that assertion (`Debug Failure. Expected C:/… === C:\…`). Fixed with the `/` file name.
  - `p3-s6a-v1-green-2.log`: 70 passed.
  - `pnpm check:effect` on the repository (`p3-s6a-v1-check-effect.log`): exit 0, "0 advisory warnings". The 4 real package tsconfigs declare no `plugins`.
- Binding (`p3-s6a-binding-5-plugin-check.log`): the `checkPluginOverrides` call is removed. **4 failed**, exactly the 4 V1 rows. Restored by digest.
- Polish: the `expectedCanary` TSDoc now names the four promoted rules' lines. The `checkCanary` TSDoc now says that with `"plugins": []` the base severities stay and only the test-file override is lost, and that a package's own plugin entry is refused by `checkPluginOverrides`.
- CodeScene: `check-effect-diagnostics.mjs` scored 9.68 at first (Complex Conditional, 2 conditions in `checkPluginOverrides`). The read moved into `readConfig`, and it now scores **10**. The test file scores 10.
- Refactor green (`p3-s6a-v1-green-refactor.log`): 70 passed.
- Gates:
  - `pnpm check:duplicates` (`p3-s6a-v1-duplicates.log`, then `-2` after the check): 0 clones;
  - `pnpm check:dead-code` (`p3-s6a-v1-dead-code.log`): exit 0;
  - `pnpm check` (`p3-s6a-v1-pnpm-check.log`; CPU 0/9/4 %; 5 idle `OverwolfBrowser`): exit 0, "0 advisory warnings", 117 files, 3768 tests (3763 plus the 5 new gate rows).
- Commit `d8c1ce0` fix(harness): refuse a gated package that declares its own effect plugin entry (patch `p3-s6a-v1-d8c1ce0.patch`); lint-staged Biome changed nothing.
