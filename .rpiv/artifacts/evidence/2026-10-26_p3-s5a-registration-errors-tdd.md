# TDD record: p3-s5a-registration-errors

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `808a5bf0…`; approved copy `approved-ddcd0b51.md` (main checkout evidence folder).
- Contract commit: `16ab01a` (the brief alone), on `f76e587`.
- Lane: normal (Q6 raise). Q29 (a), Q30 (a), Q31 (a).
- Evidence logs: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5a2-*.log` (main checkout).

## Static prediction, written before any red run

### Test shape

- **P3-B22.** The new `registrationFailures` rows go in `harness-request-diagnostics.test.ts` as an `it.each`. It uses the existing `reportedLine("harness.registration", failure)`.
  - Each row asserts `toMatchObject({ boundary: "harness.registration", answered: "HARNESS_INTERNAL_FAILURE", omittedFailures: 0 })`.
  - It then asserts `line.failures` `toEqual([{ tag }])`, and that the raw line does not contain `REGISTRY_CORRUPT`, `OBSERVER_CLEANUP` or `(5)`.
- **P3-B23.** A new file, `src/registration/registration-error-contract.test.ts`. The `_tag` and `name` assertions go in separate `it.each` blocks, so the `name` red of `RegistrationPublicationCancelled` is seen and not masked by its `_tag` red:
  - (i) `it.each` "carries its tag": `Reflect.get(error, "_tag")` `toBe` the tag.
  - (ii) `it.each` "is named by its class": `error.name` `toBe` the tag.
  - (iii) `it.each` "keeps its error contract": `instanceof` `Error` and its class; `message`; the own field `toBe`; `String(error)`; and `Object.hasOwn(error, "cause")` is `false`.
  - (iv) The equality rows.
  - (v) The verdict rows.

### Prediction at the base (`16ab01a`, tests added, source unchanged)

| Row | Base result | Failure message |
|---|---|---|
| B22 `registryCorrupt()` | FAIL | `expected [ { kind: 'error' } ] to deeply equal [ { tag: 'RegistryFault' } ]` |
| B22 `RegistryFault` pending-recovery | FAIL | same, `RegistryFault` |
| B22 `WindowsObserverApiError(5)` | FAIL | same, `WindowsObserverApiError` |
| B22 `RegistrationPublicationCancelled()` | FAIL | same, `RegistrationPublicationCancelled` |
| B23 (i) tag × 3 | FAIL × 3 | `expected undefined to be 'RegistryFault' // Object.is equality` (and the other two names) |
| B23 (ii) name: RegistryFault, WindowsObserverApiError | pass × 2 | both set an own `name` today |
| B23 (ii) name: RegistrationPublicationCancelled | FAIL | `expected 'Error' to be 'RegistrationPublicationCancelled' // Object.is equality` |
| B23 (iii) contract: RegistryFault, WindowsObserverApiError | pass × 2 | today's classes already keep message, field, `String`, and no own cause |
| B23 (iii) contract: RegistrationPublicationCancelled | FAIL | `expected 'Error' to be 'RegistrationPublicationCancelled' // Object.is equality`, on `String(error)` (its name is `"Error"` today; every earlier assertion of the row passes) |
| B23 (iv) RegistryFault `toEqual` equal failure | pass | |
| B23 (iv) RegistryFault `not.toEqual` REGISTRY_BUSY | pass | |
| B23 (iv) WindowsObserverApiError(5) `not.toEqual` (6) | pass | |
| B23 (v) verdict × 3 | pass × 3 | |

- Expected counts for the red run (the two files):
  - P3-B22: 4 failed; every existing row passes.
  - P3-B23: 5 failed (3 (i) + 1 (ii) + 1 (iii)) and 10 passed (2 (ii) + 2 (iii) + 3 (iv) + 3 (v)).
  - Total: 9 failed; every other row passes.
- (iii) uses the brief's literal strings: `String(error)` is `"<tag>: <message>"`, or `"RegistrationPublicationCancelled"` for the empty message.

### Prediction at green (the 7 classes converted)

- Every row passes.
- `Data.TaggedError(tag)` sets `name` on the prototype and `_tag` as an own field. `YieldableError` drops its own `toString`, so `String(error)` comes from `Error.prototype.toString`: `"<name>: <message>"`, or `"<name>"` when the message is empty.

### Bindings, predicted

1. `RegistryFault` drops `failure` (`super({ message })`):
   - B23 (iii) RegistryFault fails: `expected undefined to be { status: 'broken', code: 'REGISTRY_CORRUPT' }`;
   - B23 (v) `registryFailure(new RegistryFault(f))` `toBe f` fails;
   - B23 (iv) `not.toEqual` REGISTRY_BUSY fails: both lack `failure`, and the message is equal.
   - The (v) `registryReadRejection` → `toEqual` row fails too: `undefined` is not the failure.
2. **Predicted MISMATCH with the brief.** The brief says that removing `errorEqualitySetup` from `vitest.config.ts` makes the P3-B23 `not.toEqual` rows fail ("two iterable Effect errors compare equal"). Statically, they do not fail:
   - Vitest's `iterableEquality` (`node_modules/@vitest/expect/dist/index.js:557-571`) first walks the iterator. That walk is what made two converted errors with different messages equal in V1. Then it compares `Object.entries(a)` with `Object.entries(b)`.
   - `Data.Error`'s constructor assigns the constructor fields as own properties (`InternalRecord.assignProperties(this, args)`, `effect/dist/internal/core.js:370-375`). So `failure` and `code` are own enumerable entries and are compared.
   - So without the tester, `RegistryFault(registryCorruptFailure)` vs `RegistryFault(REGISTRY_BUSY)` differ on `failure`, and `WindowsObserverApiError(5)` vs `(6)` differ on `code`. Both `not.toEqual` rows still pass: **binding 2 does not bite**.
   - These oracles do not rest on the tester. Every way two instances of these classes differ (the message derives from the field) is in an own enumerable field.
   - Options for the coordinator:
     - (a) **Recommended.** Keep the rows. Record binding 2 as non-biting, with this mechanism. Run it to show the rows stay green without the tester.
     - (b) Replace binding 2 with one that bites on these rows through the field. That is already binding 1 (for `failure`) and binding 3 (for `code` → message), so it adds no new proof.
     - (c) Add a row only the tester decides: two instances that differ in message but not in fields. For these classes it can only be built by hand (`Object.defineProperty(error, "message", …)`). It does not match any real construction, so I do not recommend it.
3. `WindowsObserverApiError` builds its message without the code: B23 (iii) WindowsObserverApiError fails with `expected 'Windows observer API failed.' to be 'Windows observer API failed (5).'`. (iv) `(5)` `not.toEqual` `(6)` still passes on `code`.
4. `RegistryFault` keeps `extends Error`:
   - B22 `registryCorrupt()` and pending-recovery rows fail: `expected [ { kind: 'error' } ] to deeply equal [ { tag: 'RegistryFault' } ]`;
   - B23 (i) RegistryFault fails;
   - the effect-tsgo read shows `extendsNativeError` 5 and total 36.

### Structural and gate predictions (on the candidate)

- `rg -n "extends Error\b"` over the 5 source files: 0.
- 36 `new` sites; the 11 `instanceof` lines have no diff hunk.
- `git diff f76e587 --stat`: the 5 source files, the 2 test files, the brief and this record.
- effect-tsgo: total 35; `extendsNativeError` 4; `anyUnknownInErrorContext` 23; `schemaNumber` 6; `unnecessaryFailYieldableError` 2; `message` 7; `error` 0.
- `pnpm check`: exit 0, "35 advisory warnings".

## Coordinator decision on the prediction

- The prediction was accepted. Binding 2, option (a): keep the rows, run binding 2 once and record it as non-biting with its mechanism. Bindings 1 and 3 hold the equality rows. The brief was not edited.

## Red

- The CPU was read first at 5/4/2%.
- `p3-s5a2-red.log` (`npx vitest run src/harness-request-diagnostics.test.ts src/registration/registration-error-contract.test.ts` in `apps/harness`): exit 1, **9 failed | 25 passed**, as predicted.
  - B22 × 4: `expected [ { kind: 'error' } ] to deeply equal [ { tag: … } ]`.
    - Vitest prints the two identical `RegistryFault` messages once.
    - It shortens the `RegistrationPublicationCancelled` expected value as `[ Array(1) ]`; only the wording differs.
  - B23 (i) × 3: `expected undefined to be '<tag>' // Object.is equality`.
  - B23 (ii) and (iii) for RegistrationPublicationCancelled: `expected 'Error' to be 'RegistrationPublicationCancelled' // Object.is equality`.

## Implementation

- The 7 classes are now `Data.TaggedError(<class name>)<{ readonly message: string; readonly <field>: … }>`.
  - Each keeps its positional constructor, which calls `super({ message, <field> })`. `RegistrationPublicationCancelled` is `Data.TaggedError("RegistrationPublicationCancelled") {}`.
  - `Data` is imported from `effect` in the 5 files.
- Biome: no fixes. Harness `tsc --noEmit`: no error.

## Green

- `p3-s5a2-green.log`: exit 0, 34 passed.

## Bindings (by hand, restored by digest)

1. `p3-s5a2-binding-1.log`: `RegistryFault` without `failure`. Exit 1, 4 failed, as predicted:
   - (iii) RegistryFault: `expected undefined to be { status: 'broken', …(1) }`;
   - (iv) `not.toEqual` REGISTRY_BUSY: `expected RegistryFault: … to not deeply equal RegistryFault: …`;
   - (v) `registryFailure(...)` `toBe`: `expected undefined to be { status: 'unavailable', …(1) }`;
   - (v) the `registryReadRejection` row: `expected undefined to deeply equal { status: 'broken', …(1) }`.
   - Restored `e4fbe30f…228f`.
2. `p3-s5a2-binding-2.log`: `setupFiles: []` in `vitest.config.ts`. Exit 0, 34 passed. **NON-BITING, as predicted and accepted.**
   - Mechanism: Vitest's `iterableEquality` (`node_modules/@vitest/expect/dist/index.js:557-571`) walks the iterator, then compares `Object.entries(a)` with `Object.entries(b)`.
   - `Data.Error`'s constructor assigns the constructor fields as own enumerable properties (`InternalRecord.assignProperties(this, args)`, `node_modules/effect/dist/internal/core.js:370-375`).
   - So `failure` and `code` decide the `not.toEqual` rows without the tester. Binding 1 (`failure`) and binding 3 (`code` → message) are the bindings that hold the equality rows.
   - Restored `693f23e9…2780`.
3. `p3-s5a2-binding-3.log`: the message without the code. Exit 1, 1 failed, (iii) WindowsObserverApiError: `expected 'Windows observer API failed.' to be 'Windows observer API failed (5).'`. The (iv) `(5)`/`(6)` row stays green on `code`, as predicted. Restored `f434e655…7a7c`.
4. `p3-s5a2-binding-4.log`: `RegistryFault` back to `extends Error`. Vitest exit 1, 3 failed: B22 rows 0 and 1 (`[ { kind: 'error' } ]`) and B23 (i) RegistryFault (`expected undefined to be 'RegistryFault'`).
   - The effect read (`p3-s5a2-b4-effect.json`, scratchpad): 36 warnings, with `extendsNativeError` 5 (`registry-failure.ts:25` plus the desktop 4). As predicted.
   - Restored `e4fbe30f…228f`.

## Structural checks (candidate, uncommitted)

- `rg -n "extends Error\b"` over the 5 source files: 0 lines.
- Effect read (`p3-s5a2-effect-read.log`, `effect-advisory-p3-s5a2-candidate.json` in the evidence folder): 35 warnings.
  - `extendsNativeError` 4 (the desktop four), `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2 (`existing-registration.ts:56`, `project-storage-upgrade-pipeline.ts:384`, as at the base); no `error`.
- `instanceof`: `git diff f76e587 -U0` has no source line with `instanceof` of the 7 classes. The only hits are the brief's own text.
- `git diff f76e587 --stat` plus the untracked files: the brief, the 5 source files, `harness-request-diagnostics.test.ts`, the new `registration-error-contract.test.ts`, and this record. As listed.
- **MISMATCH (count): the `rg -c "new (…)\b" apps/harness` total is 47, not 36.**
  - Base `f76e587`: 36 (`git grep -c`).
  - Candidate: the 14 source files still total 36, unchanged.
  - The 11 extra lines are this slice's new test rows: 3 in `harness-request-diagnostics.test.ts`, and 8 in `registration-error-contract.test.ts` (10 constructions, 2 lines with two).
  - The brief's "totals 36" predates the test rows; the same kind of mismatch as s5a's 152 = 148 + 4. Stopped and reported. The remaining gates have not run.

## Coordinator decision on the count

- Accepted: 36 source construction sites, unchanged, plus 11 test-row lines.

## Gates (candidate)

- CPU read before the runs: 5/2/2%; before `pnpm check`: 13/2/3%.
- Registration unit suites (`p3-s5a2-registration-unit.log`: `src/registration/`, `src/code-tuples.test.ts`, `src/storage/project-storage-node-errors.test.ts`): exit 0, 10 files, 184 tests.
- Integration. The files named under "Guards" run under `vitest.registration.config.ts`. `registry-witness-race` runs under the integration config. Run alone, one after the other:
  - `p3-s5a2-registration-integration.log`: `project-registration`, `registration-identity-phase`, `registration-identity-query`, `registration-physical-identity`, `registration-physical-limits` and `registration-preparation`. Exit 0, 6 files, 160 tests, 74 s.
  - `p3-s5a2-witness-race-integration.log`: exit 0, 13 tests.
- CodeScene 10 on the 5 source files and the 2 test files.
- `check:duplicates` (`p3-s5a2-duplicates.log`): 0 clones. `check:dead-code` (`p3-s5a2-dead-code.log`): exit 0.
- `pnpm check` (`p3-s5a2-pnpm-check.log`): exit 0.
  - "Effect diagnostics verified; 35 advisory warnings."
  - 114 files, 3727 tests: 3708 + 19 new (4 B22 + 15 B23).
  - No dependency violations.
- No mutation run (Q31).

## Preflight (candidate `26a1637`, base `16ab01a`)

- Candidate patch: `p3-s5a2-candidate-26a1637.patch` (`git diff --binary 16ab01a..26a1637`, sha256 `5f72aae2…c4de`, 7 files, +177 −24).
- `lane.mjs --range 16ab01a..26a1637`: `fast` ("within fast limits"). The approved lane is normal by the Q6 raise.
- `slice-preflight` from the repository root (`p3-s5a2-preflight.log`, with the rpiv fix that is still uncommitted in rpiv-claude): exit 0.
  - Output: `preflight: clean`.
  - It suggests `reprove: --commit 26a1637… --base 16ab01a…`. Not run; the red was observed directly (`p3-s5a2-red.log`).

## Slice-verifier round 1 (candidate `26a1637`, base `16ab01a`)

- `rpiv:slice-verifier`, candidate mode, on the frozen patch. **Result: passed, no findings.** Decisions OK, Cross-slice OK, Research OK.
- Hypotheses, all refuted:
  - H1: name, JSON or inspect readers;
  - H2: the project-listing verdict through `Effect.runPromise`. This one was refuted statically: `causeSquash` returns the error itself, and annotations live in a WeakMap.
  - H3: private tags reaching a log or the wire.
- needs-run, to settle H2 at runtime: `pnpm exec vitest run --config vitest.registration.config.ts tests/integration/registration-stored-damage.integration.test.ts` at `26a1637`. The relevant rows are :188-193 (`REGISTRY_CORRUPT`) and :330 (`REGISTRY_BUSY`). Not run; it waits for the coordinator.
- Successor note: a future `Effect.fail(new RegistryFault(…))` in Part B would trigger `unnecessaryFailYieldableError`; Part B should `yield*` the error instead.

### needs-run (coordinator GO; once, alone; CPU 11/2/0%)

- `p3-s5a2-needs-run-stored-damage.log`: `pnpm exec vitest run --config vitest.registration.config.ts tests/integration/registration-stored-damage.integration.test.ts`, at HEAD `9c581fb` (`apps/` identical to `26a1637`). Exit 0, 11 passed, 0 skipped.
- The runtime path of the listing Effect edge (H2) holds: the `REGISTRY_CORRUPT` rows at :188-193 and the `REGISTRY_BUSY` row at :330.
- s5a-registration-errors is closed by the coordinator.
