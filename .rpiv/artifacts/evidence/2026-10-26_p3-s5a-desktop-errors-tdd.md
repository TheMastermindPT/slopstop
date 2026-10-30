# TDD record: p3-s5a-desktop-errors

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `832fdc61…`; approved copy `approved-d8fdc66c.md` (main checkout evidence folder).
- Contract commit: `e326932` (the brief alone), on `7bdb4f6`.
- Lane: normal (Q6 override). Q32 (a): no desktop tester. Q33 (a): no mutation.
- Evidence logs: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5a3-*.log` (main checkout).
- Desktop main tests run with `--config vitest.main.config.ts` from `apps/desktop`.

## Static prediction, written before any red run

### Test shape

- **P3-B24.** New file `src/main/package-smoke-error-contract.test.ts`, three rows:
  - `new PackageSmokeAuthorizationError()`;
  - `new WriterProofError("native-preflight")`;
  - `new RegistrationPackageSmokeError("list")`.

  The assertions are split into separate `it.each` blocks, so that each binding's failure shows on its own row:
  - (i) `_tag` `toBe` the class name;
  - (ii) `name` `toBe` the class name;
  - (iii) the contract: `instanceof Error` and its own class; `message` `toBe` the fixed text (plus `toBe(packageSmokeAuthorizationFailureMessage)` for authorization); `stage` `toBe` the given stage, for the two stage classes; `Object.hasOwn(error, "cause")` `false`;
  - (iv) `String(error)` `toBe` `"<name>: <message>"`;
  - (v) `Object.keys(error).sort()` `toEqual` `["_tag"]` or `["_tag", "stage"]`.

  Equality rows:
  - (vi) `RegistrationPackageSmokeError("list")` `not.toEqual` `("register")`;
  - (vii) `WriterProofError("cleanup")` `toEqual` `("cleanup")`;
  - (viii) `WriterProofError("cleanup")` `not.toEqual` `("internal")`.

  That is 18 tests.
- **P3-B25.** In `src/main/project-storage-package-smoke.test.ts`:
  - The existing "classifies an unexpected absent-Project result" row keeps its assertions. After its `projectStoragePackageSmokeFailureStage(failure)` `toBe("absent-project-open")`, it adds:
    - `Reflect.get(failure, "_tag")` `toBe("ProjectStoragePackageSmokeError")`;
    - `name`;
    - `instanceof Error`;
    - `message` `toBe("Packaged Project Storage smoke failed.")`;
    - `stage` `toBe("absent-project-open")`;
    - `Object.hasOwn(failure, "cause")` `false`.
  - New `it.each`, 2 rows: `projectStoragePackageSmokeFailureStage(new RegistrationPackageSmokeError("list"))` and `(new Error("Packaged Project Storage smoke failed."))` are `undefined`.

### Prediction at the base (`e326932`, tests added, source unchanged)

Today each class is a plain `Error` subclass with `override readonly name = "<class>"`. That is an own enumerable class field, so the own keys today are `["name"]` or `["name", "stage"]`. Not iterable.

| Row | Base | Failure message |
|---|---|---|
| B24 (i) tag × 3 | FAIL × 3 | `expected undefined to be '<class>' // Object.is equality` |
| B24 (ii) name × 3 | pass × 3 | the own `name` field equals the class name |
| B24 (iii) contract × 3 | pass × 3 | |
| B24 (iv) `String` × 3 | pass × 3 | `"<name>: <message>"` from `Error.prototype.toString` |
| B24 (v) own keys × 3 | FAIL × 3 | `expected [ 'name' ] to deeply equal [ '_tag' ]`; `expected [ 'name', 'stage' ] to deeply equal [ '_tag', 'stage' ]` (× 2) |
| B24 (vi), (vii), (viii) | pass × 3 | non-iterable errors: Vitest's error equality compares name, message, cause and own enumerable fields, so `stage` decides |
| B25 existing row | FAIL | `expected undefined to be 'ProjectStoragePackageSmokeError' // Object.is equality`; the existing stage assertion before it passes |
| B25 `undefined` × 2 | pass × 2 | |

- Red counts:
  - B24 file: 6 failed | 12 passed.
  - B25 file: 1 failed; the other rows pass (the 2 new rows included).
  - Total: **7 failed**.

### Prediction at green (the 4 classes converted)

- Every row passes.
- `Data.TaggedError(tag)` puts `name` on the prototype, `_tag` as an own enumerable field, and `stage` as an own enumerable field (`InternalRecord.assignProperties`, `node_modules/effect/dist/internal/core.js:370-375`).
- `message` is set by the native `Error` constructor as an own non-enumerable property, and `assignProperties` writes onto that existing property. So `Object.keys` is `["_tag"]` or `["_tag", "stage"]`.
- `String(error)` comes from `Error.prototype.toString`, because `YieldableError` deletes its own `toString`.

### Bindings: premises against `Data.Error`'s own enumerable fields

After the change, two converted desktop errors are iterable. With no desktop tester (Q32), Vitest's `iterableEquality` (`node_modules/@vitest/expect/dist/index.js:557-571`) walks the iterator (equal) and then compares `Object.entries`: only `_tag` and `stage`. `toEqual`, `rejects.toEqual` and `toThrowError(instance)` therefore never compare `message`, `name` or `cause` between two converted errors. Each binding is predicted with that premise:

1. **`RegistrationPackageSmokeError` drops `stage`** (`super({ message } as never)`). Run on the B24 file and `registration-package-smoke.test.ts`.
   - B24 (iii) Registration fails: `expected undefined to be 'list'`.
   - B24 (v) Registration fails: `expected [ '_tag' ] to deeply equal [ '_tag', 'stage' ]`.
   - B24 (vi) fails, because neither side has `stage` and the entries are `[["_tag", …]]` on both. The message is `expected RegistrationPackageSmokeError: … to not deeply equal …`.
   - `registration-package-smoke.test.ts:62` × 3 **stays green**, for the same reason: both sides lack `stage`.
   - Predicted: 3 failed.
2. **`RegistrationPackageSmokeError` message without the final period.** Run on the same two files.
   - B24 (iii) Registration fails: `expected 'Packaged registration smoke failed' to be 'Packaged registration smoke failed.'`.
   - B24 (iv) Registration fails: `expected 'RegistrationPackageSmokeError: Packaged registration smoke failed' to be 'RegistrationPackageSmokeError: Packaged registration smoke failed.'`.
   - `:62` × 3 **stays green**: `message` is own non-enumerable, and `iterableEquality` reads only `Object.entries`. This is the binding's premise row; it proves the message is pinned by P3-B24, not by `:62`.
   - Predicted: 2 failed.
3. **`WriterProofError` drops `stage`** (`super({ message } as never)`). Run on the B24 file, `package-smoke-verifier.test.ts` and `canonical-writer-package-smoke.test.ts`.
   - B24 (iii) WriterProofError fails: `expected undefined to be 'native-preflight'`.
   - B24 (v) WriterProofError fails: `expected [ '_tag' ] to deeply equal [ '_tag', 'stage' ]`.
   - B24 (viii) `not.toEqual` fails, because both sides lack `stage`. B24 (vii) `toEqual` stays green.
   - `package-smoke-verifier.test.ts:88-92` `toMatchObject({ …, stage: "native-preflight" })` fails.
   - In `canonical-writer-package-smoke.test.ts`, the `:187` row fails, because the proof's stage comes from `error.stage` (`canonical-writer-package-smoke.ts:267,920`), which is now `undefined`. The other `stage` rows of that file that depend on a thrown `WriterProofError` fail too. I do not predict their exact count, only that `:187` is among them, and no row outside those three files is affected.
4. **`ProjectStoragePackageSmokeError` keeps `extends Error`** (the current class). Run on the B25 file, then the effect read.
   - The B25 existing row fails: `expected undefined to be 'ProjectStoragePackageSmokeError'`.
   - The effect read shows 32 warnings, with `extendsNativeError` 1 (`project-storage-package-smoke.ts`).

### Structural and gate predictions (candidate)

- `rg -n "extends Error\b"` over the 4 source files: 0.
- `new` sites:
  - The brief's count (14 total, 9 source) is taken at `7bdb4f6`. At the candidate, the source still totals 9.
  - The total rises by this slice's new test lines: B24 builds 9 instances on 8 lines (the authorization row, `WriterProofError` × 5 in rows and equality, `RegistrationPackageSmokeError` × 3), and B25 adds 1 (`RegistrationPackageSmokeError("list")`).
  - Predicted total: 14 + the new test lines. The exact number is checked against the files, as in s5a-registration (36 + 11).
- `requireWriterProof(`: 54 lines, unchanged. The 4 `instanceof` lines: no diff hunk.
- `rg -n "Effect\.fail\(new " apps/desktop/src`: 0.
- `git diff 7bdb4f6 --stat`: the brief, the 4 source files, the 2 test files, and this record.
- Effect read: 38 diagnostics, 31 warnings; `extendsNativeError` 0; `anyUnknownInErrorContext` 23; `schemaNumber` 6; `unnecessaryFailYieldableError` 2; `message` 7; `error` 0.
- `pnpm check`: exit 0, "31 advisory warnings".

## Coordinator decision on the prediction

- Accepted. GO for red and green.
- Condition: before binding 3, list statically the exact rows it fails in the 3 files, then apply it and compare; a mismatch is recorded.
- The `:62` rows staying green under b1/b2 are the known Q32 gap.

## Red

- CPU 12/17/11%.
- `p3-s5a3-red.log` (`npx vitest run --config vitest.main.config.ts src/main/package-smoke-error-contract.test.ts src/main/project-storage-package-smoke.test.ts`, in `apps/desktop`): exit 1, **7 failed | 47 passed**, as predicted:
  - B24 (i) × 3: `expected undefined to be '<class>'`;
  - B24 (v) × 3: `expected [ 'name' ] to deeply equal [ '_tag' ]` and `expected [ 'name', 'stage' ] to deeply equal [ '_tag', 'stage' ]`, printed once for the two;
  - B25: `expected undefined to be 'ProjectStoragePackageSmokeError'`.
- Test shape note: the B24 authorization row pins the literal "Package smoke authorization failed." and, in (iii), `toBe(packageSmokeAuthorizationFailureMessage)`. The B24 file has 18 tests, as predicted.

## Implementation

- The 4 classes are now `Data.TaggedError(<class>)<{ readonly message: string; readonly stage: … }>` (the authorization class has `message` only), with their positional constructors: `super({ message, stage })`.
- The `override readonly name` fields are removed.
- `Data` is imported from `effect`. Biome sorted the imports and formatting in 4 files. Desktop `tsc --noEmit`: no error.

## Green

- `p3-s5a3-green.log`: exit 0, 54 passed.

## Binding 3: static list of failing rows, written before applying it

Mechanism: with `stage` dropped, every `WriterProofError` has `stage: undefined`. That includes the one `Proof.fail` builds itself (`canonical-writer-package-smoke.ts:96-98`). A failed outcome then carries `stage: first.stage` = `undefined` (`:932`). A passed outcome is unchanged. No source code branches on `error.stage` except `:267` and `:920`, and those feed `fail(undefined)`. `cleanupFailures` entries are plain objects and keep their stage.

- `package-smoke-error-contract.test.ts`: 3 rows. (iii) WriterProofError (`expected undefined to be 'native-preflight'`), (v) WriterProofError (`expected [ '_tag' ] to deeply equal [ '_tag', 'stage' ]`), and (viii) `not.toEqual`. (vii) stays green.
- `package-smoke-verifier.test.ts`: every row that calls `expectNativeFailure` (`:88-92` `toMatchObject({ …, stage: "native-preflight" })`), **50 rows**:
  - `:163` physical binding × 9;
  - `:212` contradictory manifest × 6;
  - `:227` sanitizes exception × 7;
  - `:255` alternate JS entry × 5;
  - `:263` native candidate × 6;
  - `:300` load witnesses × 2;
  - `:307` caught failed delegation × 1;
  - `:338` missing native API × 6;
  - `:352` unsupported target × 3;
  - `:361` invalid package input × 5.
- `canonical-writer-package-smoke.test.ts`: every row that asserts the outcome's `stage`, **26 rows**:
  - `:173` clean-stop modes `false-kill`, `throw-kill`, `missing-witness` × 3 (`stream-reset` and `service-stop` pass);
  - `:379` × 1;
  - `:393` "failed wait" × 1 ("passed proof" passes);
  - `:655` abort before entry × 1;
  - `:698` stdout/stderr × 2;
  - `:714` × 1;
  - `:742` × 1;
  - `:843` cleanup exit × 3;
  - `:882` abort during × 7;
  - `:940` UTF-8 bytes × 2;
  - `:959` × 1;
  - `:965` × 1;
  - `:997` × 1;
  - `:1009` × 1.
  - The rows that check only `status`, `cleanupSafe` or `cleanupFailures` pass.
- **Predicted total: 79 failed** in the 3 files.

## Bindings (by hand, restored by digest; CPU 5/10/4%)

1. `p3-s5a3-binding-1.log`: `RegistrationPackageSmokeError` without `stage`. Exit 1, **3 failed | 19 passed**, as predicted: B24 (iii) Registration, (v) Registration and (vi) `not.toEqual`.
   - `registration-package-smoke.test.ts:62` × 3 stays green: both sides lack `stage`.
   - **This is the known Q32 gap (coordinator):** no desktop tester, so `:62` cannot see a missing `stage` when both sides lack it, nor a wrong message.
   - Restored `f6f11a79…e49a`.
2. `p3-s5a3-binding-2.log`: the message without the final period. Exit 1, **2 failed | 20 passed**, as predicted: B24 (iii) Registration and (iv) `String`.
   - `:62` × 3 stays green: `message` is own non-enumerable, and `iterableEquality` reads only `Object.entries`. This is the premise row, and the same known Q32 gap. The message is pinned by P3-B24.
   - Restored `f6f11a79…e49a`.
3. `p3-s5a3-binding-3.log`: `WriterProofError` without `stage`, the three files run from `apps/desktop`. Exit 1, **89 failed | 153 passed. MISMATCH with the static list (79).**
   - `package-smoke-error-contract.test.ts`: 3 failed. Exactly the predicted (iii), (v) and (viii).
   - `canonical-writer-package-smoke.test.ts`: 26 failed. Exactly the 26 listed rows, by name.
   - `package-smoke-verifier.test.ts`: **60 failed, predicted 50. The run is invalid for this file.**
     - Every row fails in its setup, `configureNativeTarget` (`package-smoke-verifier.test.ts:65`), with `ENOENT … apps\desktop\node_modules\fs-native-extensions\prebuilds\win32-x64\fs-native-extensions.node`.
     - The test reads the real prebuild through `path.resolve("node_modules/…")`, which resolves against the current folder. The package exists only in the root `node_modules`, so the file assumes it runs from the repository root.
     - My invocation, from `apps/desktop`, broke all 60 rows before any assertion. The 10 "extra" rows are success rows (`accepts pinned …` × 5, `accepts the corresponding unpacked spelling` × 2, `preserves omitted dlopen flags`, `allows a caught rejected candidate`, `counts only the successful delegation`). They failed on the same `ENOENT`, not on the binding.
     - The binding's effect on this file is therefore **not observed**.
   - Restored `7b800f43…7236`.
   - Not rerun: stopped and reported. The proposed rerun is binding 3 once, from the repository root (`pnpm exec vitest run --project desktop-main …`, or the root config). The guards that include `package-smoke-verifier.test.ts` would also run from the root.
   - Note: the brief's red-green command (`pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts …`) runs in `apps/desktop` too. It names only the B24/B25 files, which do not read that fixture.

## Binding 3, rerun from the repository root (coordinator GO: the first valid observation)

- `p3-s5a3-binding-3-root.log`: `pnpm exec vitest run --project desktop-main <the 3 files>` from the root, CPU 15/19/13%.
- Exit 1, **79 failed | 163 passed. It matches the static list exactly:**
  - B24: 3, (iii), (v) and (viii) for WriterProofError;
  - `package-smoke-verifier.test.ts`: 50, the ten listed groups, every `expectNativeFailure` row;
  - `canonical-writer-package-smoke.test.ts`: 26, the listed rows by name.
- No `ENOENT`, and no success row failed. Restored `7b800f43…7236`.

## Guards (from the repository root)

- `p3-s5a3-guards-main.log`: `--project desktop-main` with `registration-package-smoke`, `package-smoke-verifier`, `canonical-writer-package-smoke`, `canonical-writer-package-smoke-main`, plus the two red-green files. Exit 0, 6 files, 362 passed.
- `p3-s5a3-guards-integration.log`: `--config vitest.integration.config.ts --project desktop-integration tests/integration/package-smoke-authorization.integration.test.ts`. Exit 0, 95 passed, 3 skipped.
  - The 3 skips come from the host: `context.skip` at `:132`, "File symlink creation denied by this host (EPERM)". They are not this slice's.

## Binding 4

- `p3-s5a3-binding-4.log`: `ProjectStoragePackageSmokeError` back to `extends Error`.
  - Vitest: 1 failed | 35 passed, the B25 row: `expected undefined to be 'ProjectStoragePackageSmokeError'`.
  - Effect read: 32 warnings, with `extendsNativeError` 1 (`project-storage-package-smoke.ts:46`).
  - As predicted. Restored `28a843c8…6c6d`.

## Structural checks (candidate, uncommitted)

- `extends Error\b` in the 4 source files: 0.
- Effect read (`p3-s5a3-effect-read.log`, `effect-advisory-p3-s5a3-candidate.json`): 31 warnings, 38 diagnostics.
  - `extendsNativeError` 0; `anyUnknownInErrorContext` 23; `schemaNumber` 6; `unnecessaryFailYieldableError` 2; `message` 7 (2 + 2 + 1 + 2); `error` 0.
  - As predicted.
- `requireWriterProof(`: 54 lines. `instanceof` of the 4 classes: no hunk in `git diff 7bdb4f6`.
- `git diff 7bdb4f6 --stat` plus the untracked files: the brief, the 4 source files, the 2 test files, and this record.
- **MISMATCH 1 (brief check): `rg -n "Effect\.fail\(new " apps/desktop/src` gives 1 line, not 0.**
  - The line is `apps/desktop/src/main/harness-supervisor.ts:207` `return Effect.fail(new HarnessShutdownTimeout());`.
  - It already exists at the base `7bdb4f6` (`git grep`), and this slice does not touch it.
  - The brief's "→ 0" did not hold at its own base. The slice adds no `Effect.fail(new` line.
- **MISMATCH 2 (my count): `new` sites total 22.**
  - Base 14; source still 9, unchanged.
  - +8 test lines: 7 in `package-smoke-error-contract.test.ts` (9 instances: the equality rows put 2 on one line twice and split 1 over 2 lines) and 1 in `project-storage-package-smoke.test.ts`.
  - My prediction said "9 instances on 8 lines" for B24. The file has 7 lines. My static line count was off by one; the rows themselves are as predicted.
- Stopped and reported. CodeScene, duplicates, dead code and `pnpm check` have not run yet.

## Coordinator decision on the structural mismatches

- Both accepted as recorded. `harness-supervisor.ts:207` is pre-existing and noted for s5b/s6; the line count is 7, not 8.

## Gates (candidate, uncommitted)

- CodeScene 10 on the 4 source files and the 2 test files.
- `check:dead-code` (`p3-s5a3-dead-code.log`): exit 0.
- **`check:duplicates` (`p3-s5a3-duplicates.log`): exit 1, "Found 1 clones". GATE FAILURE:**
  - `apps/desktop/src/main/package-smoke-error-contract.test.ts [43:40 - 57:9]` (15 lines, 135 tokens) duplicates `apps/harness/src/registration/registration-error-contract.test.ts [49:39 - 63:9]`.
  - The duplicated span is the "carries its tag" and "is named by its class" `it.each` blocks and the start of the contract block. I copied the row shape across apps, and the apps may not import each other.
  - Not rerun; reported.
  - Proposed fix, test-only, with the same assertions and the same 18 tests: restructure the desktop file as `describe.each(contractRows)("$tag", (row) => { it("carries its tag") … })`, one `describe` per class, so its token shape no longer matches the harness file. Then rerun the B24 file (all green), `check:duplicates`, and `pnpm check`.
  - The red observed for these rows stays valid: the assertions do not change, only the grouping.

## Duplicate fix (coordinator GO: regroup with `describe.each`; `jscpd.json` untouched)

- `package-smoke-error-contract.test.ts` now groups its five per-class checks under `describe.each(contractRows)("$tag", …)`, one `describe` per class, with `const { tag, error, message, stage } = row`. The test titles change from "`<tag>` carries its tag" to "`<tag>` > carries its tag". There are still 18 tests.
- Assertions unchanged:
  - A whitespace-normalized extraction of every `expect(…)` statement gives 13 before and 13 after, identical in order (`p3-s5a3-regroup-assertions.txt`).
  - A word diff of the assertion lines alone, 15 lines on each side, has **0 changed words** (`p3-s5a3-regroup-word-diff.txt`).
  - A plain `git diff --word-diff` of the whole file shows moved assertions only because its line alignment shifts by one block.
- Biome: no fixes. CodeScene 10.
- B24/B25 green from the root (`p3-s5a3-regroup-green.log`, CPU 10/12/9%): exit 0, 54 passed.
- `check:duplicates` (`p3-s5a3-duplicates-2.log`): exit 0, "Found 0 clones".
- **Follow-up for s5c (coordinator):** if s5c's Q32 trigger creates a shared test-support owner for Error equality, both contract tests move onto it. Those are `apps/harness/src/registration/registration-error-contract.test.ts` and `apps/desktop/src/main/package-smoke-error-contract.test.ts` (and, by the same shape, `apps/harness/src/storage/storage-error-contract.test.ts`).

## pnpm check

- `p3-s5a3-pnpm-check.log`, CPU 7/7/5%: exit 0.
  - "Effect diagnostics verified; 31 advisory warnings."
  - 115 files, 3747 tests: 3727 + 20 new (18 B24 + 2 B25).
  - No dependency violations.
- No mutation (Q33). No package smoke (the deep gate before push runs it).

## Preflight (candidate `d39b18c`, base `e326932`)

- Candidate patch: `p3-s5a3-candidate-d39b18c.patch` (`git diff --binary e326932..d39b18c`, sha256 `d42d85b2…a60b`, 6 files, +130 −18).
- `lane.mjs --range e326932..d39b18c`: `rigorous`, from the sensitive word "auth" in `package-smoke-authorization.ts`, as the brief recorded. The approved lane is normal by the Q6 override.
- `slice-preflight` from the root (`p3-s5a3-preflight.log`): exit 0, `preflight: clean`. The suggested reprove was not run; the red was observed directly.

## Slice-verifier round 1 (candidate `d39b18c`, base `e326932`)

- `rpiv:slice-verifier`, candidate mode, on the frozen patch. **Result: passed, no findings.** Decisions OK, Cross-slice OK, Research OK.
- Refuted:
  - H1: serialization or own shape. The only outputs are constant stderr strings and exit codes, and no class is logged, posted or cloned.
  - H2: a silently weakened equality oracle. The weakening is real, but it is the approved Q32 (a) gap, and P3-B24 pins every message.
  - H3: the Effect shape changing control flow. The only Effect path wraps the error in `untypedRejection` and rethrows it by identity; `EffectProto` has no `then`.
- Non-blocking notes:
  - The Q32 gap (decided; s5c).
  - The debug shape (`toJSON`, `inspect`, stack header) changed under Q5/Q29, with no current consumer. A later Pino `{ err }` log of these classes should check the serialized shape.
- needs-run: `pnpm check:deep` (packaged smoke) before push, as the brief plans. Not required by this slice's Success Criteria.
- polish, recorded and not acted on:
  1. The brief says `it.each`; the candidate uses `describe.each` (accepted regroup).
  2. The brief's `Effect.fail(new` → 0 was false at its own base (accepted).
  3. The brief's command form runs in `apps/desktop`, where `package-smoke-verifier.test.ts:65` cannot find the root prebuild. Guards with that file must run from the root.
  4. The harness fixture `canonical-writer-package-smoke-entry.ts:287-289` mirrors only name, message and stage. This is harmless: its refusal is caught inside the utility process.
