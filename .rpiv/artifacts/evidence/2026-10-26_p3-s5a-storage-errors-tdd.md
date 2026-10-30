# TDD evidence: p3-s5a-storage-errors

- Design: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md` (Follow-up "slice p3-s5a-storage-errors detailed"), `content_hash 7c17ee69…`; approved at `7933bc46…`, approved copy `approved-7933bc46.md`; append-only check against the five approved copies (`30f2f102`, `1c3af438`, `19dbee49`, `e4a0b109`, `7933bc46`): `keep` each. Q25-Q28 (a). Contract commit: `ca7125b` (the brief alone).
- Base: `ca7125b` (the s4 head `feb59d9` plus the contract commit).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5a-*.log` in the main checkout.

## Static prediction, written before any red run, sent to the coordinator

### Runtime shape it rests on

A node probe at `ca7125b` (`effect` 4.0.0, `dist/internal/core.js` `Error`/`TaggedError`, `record.js` `assignProperties`) with the Q25 (a) constructor (`message` only when given, `cause` only when `options` has it):

| Construction | `Object.keys` | own names | `String(error)` | `hasOwn(cause)` |
|---|---|---|---|---|
| `new ProjectStorageBrokenError()` | `["_tag"]` | `_tag, stack` | `"ProjectStorageBrokenError"` | false |
| `new ProjectStorageBrokenError("m")` | `["_tag"]` | `_tag, message, stack` | `"ProjectStorageBrokenError: m"` | false |
| `("m", { cause: null })` | `["cause", "_tag"]` | `+ cause` | as above | true, `null` |
| `("m", { cause: err })` | `["_tag"]` | `+ cause` | as above | true, `toBe(err)` |
| `new ProjectStorageOpeningReleaseFailedError(undefined)` | `["cause", "_tag"]` | `+ cause` | `"ProjectStorageBrokenError: Project Storage opening release failed."` | true, `undefined` |
| `new CanonicalProjectApplicationError()` | `["_tag"]` | `_tag, message, stack` | `"CanonicalProjectApplicationError: Canonical Project application returned an invalid result."` | false |

This agrees with the brief's measured shape. One wording point: for the empty message, `String(error)` is the bare name (the native `Error.prototype.toString` rule, unchanged by Effect, which deletes its own `toString`), not `"<name>: "`. The P3-B20 empty-message row asserts `"ProjectStorageBrokenError"`, at the base and after.

### P3-B19: `harness-request-diagnostics.test.ts`, one `it.each` table, 10 rows

Rows: `ProjectStorageBrokenError("C:\\private\\a.db", { cause: new Error("secret") })`, `ProjectStorageOpeningReleaseFailedError(new Error("secret"))`, `ProjectStorageApplicationClientInitializationError("m")` → `ProjectStorageBrokenError`; `ProjectStorageUnavailableError("m")`, `ProjectStorageUpgradeBusyError()` → `ProjectStorageUnavailableError`; `CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED")`, `CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED")`, `CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE")`, `ApplicationDatabaseFault({ status: "broken", code: "REGISTRY_CORRUPT" })`, `CanonicalProjectApplicationError()` → their own name.

Per row, in order: `toMatchObject({ boundary: "project-storage.owner", answered: "PROJECT_STORAGE_OWNER_FAILED", omittedFailures: 0 })`; `failures` `toEqual([{ tag }])`; the raw line contains neither `private` nor `secret`.

| Row | Base `ca7125b` | Candidate |
|---|---|---|
| all 10 | FAIL on `failures`: `expected [ { kind: 'error' } ] to deeply equal [ { tag: '<tag>' } ]` (the `toMatchObject` before it passes) | PASS |
| the 5 existing tests | PASS | PASS |

The `CanonicalProjectWriterReleaseError` row stays `[{ tag }]` with no `code`: `failureEntry` reads a code only for `CanonicalProjectReleaseFailed`.

### P3-B20: `storage/storage-error-contract.test.ts` (new)

Contract table, 11 rows (the 10 above plus `new ProjectStorageBrokenError()` with message `""`). Per row, in this order, with `_tag` last so every preserved assertion runs at the base: `name` is the tag; `instanceof Error`, its own class and (subclass) its parent; `message` exact; `code` / `failure` `toBe` the given value; `String(error)` exact; then `_tag` is the tag.

Cause table, 10 rows: for each of `ProjectStorageBrokenError`, `CanonicalWriterLeaseError`, `ApplicationDatabaseFault`: given an `Error` (`toBe`), given `null` (`null`), no options (`Object.hasOwn(error, "cause")` false); plus `ProjectStorageOpeningReleaseFailedError(undefined)` (`cause` undefined).

| Rows | Base `ca7125b` | Candidate |
|---|---|---|
| 11 contract rows | FAIL on `_tag` only: `expected undefined to be '<tag>'` | PASS |
| 10 cause rows | PASS (the preserved contract, pinned before the change) | PASS |

### P3-B21: `canonical-project-application.test.ts` `invalidResult`, tightened in place

`Object.keys(error)` → `["_tag"]`; own names sorted → `["_tag", "message", "stack"]`; then `Reflect.get(error, "_tag")` is `"CanonicalProjectApplicationError"`. The `name`, `message`, `cause` and both `instanceof` asserts stay, in place.

| Tests | Base `ca7125b` | Candidate |
|---|---|---|
| every test that reaches `invalidResult` (21 call sites) | FAIL: `expected [ 'name' ] to deeply equal [ '_tag' ]` | PASS |
| every other test in the file | PASS | PASS |

### Bindings (each on the candidate, applied by hand, restored by digest)

1. `ProjectStorageBrokenError` drops `options` (`super({ message })`) → the `ProjectStorageBrokenError` cause rows "given an `Error`" (`expected undefined to be Error {…}`) and "given `null`" (`expected undefined to be null`) fail; the "no options" row and P3-B19 stay green.
2. `ProjectStorageOpeningReleaseFailedError` gets its own `Data.TaggedError("ProjectStorageOpeningReleaseFailedError")` → P3-B19's row fails (`[ { tag: 'ProjectStorageOpeningReleaseFailedError' } ]` vs `ProjectStorageBrokenError`), P3-B20's row fails on `name` first (`expected 'ProjectStorageOpeningReleaseFailedError' to be 'ProjectStorageBrokenError'`); with `name` left aside, `instanceof ProjectStorageBrokenError` is false. Its cause row (`undefined`) stays green.
3. `CanonicalWriterLeaseError` left `extends Error` → P3-B19's lease row fails (`[ { kind: 'error' } ]`), P3-B20's lease row fails on `_tag`, and the effect read counts `extendsNativeError` 12.
4. `ProjectStorageBrokenError` passes `{ message, cause: options?.cause }` always → the "no options" row fails (`expected true to be false`); the other two cause rows stay green.
5. Line ranges: `stryker.config.json` (`canonical-project-application.ts:90-101`, `:107-118`) and `stryker.project-storage.config.json` (`application-database-migration.ts:142-284`) move by the class's line delta. Each moved range is realigned and diffed against `feb59d9` text (empty diff). A dry run only on the coordinator's GO.

### Structural checks, predicted

- `rg -n "extends Error\b"` over the 8 files → 0.
- `rg -c "new ProjectStorageBrokenError\("` total 148; the 31 `instanceof` lines unchanged, with no hunk.
- **Prediction that differs from the brief: the effect read gives total 43, not 42.** `extendsNativeError` 20 → 11 (none in the 8 files), `anyUnknownInErrorContext` 23, `schemaNumber` 6, but `unnecessaryFailYieldableError` 2 → **3**: `project-storage-node-registry.ts:245` is `return yield* Effect.fail(new ProjectStorageBrokenError("Project Storage application authority is missing."))`. Once the class is yieldable this is the same rule that already fires at `project-storage-upgrade-pipeline.ts:384` (whose `UpgradeStepError` union is already yieldable). `rg "Effect\.fail\w*\(\s*new <the 9 classes>"` finds no other site. `pnpm check` would print "43 advisory warnings", not 42. `message` advice: 7; no `error` level.

## Coordinator decisions on the prediction (2026-10-26)

- Prediction accepted as written.
- (A) decision (b): `project-storage-node-registry.ts:245` becomes `return yield* new ProjectStorageBrokenError(...)`, so the contract's "no other count rises" stays true: expected effect read total 42, `unnecessaryFailYieldableError` 2. The file joins the touched paths; CodeScene 10 on it and its existing tests stay green. The brief is not edited.
- (B) accepted: the empty-message row asserts the bare name `"ProjectStorageBrokenError"`.

## Red (base `ca7125b` + the three test files) — log `p3-s5a-red.log`

`npx vitest run src/harness-request-diagnostics.test.ts src/storage/storage-error-contract.test.ts src/canonical-project-application.test.ts` (in `apps/harness`): exit 1, 160 failed | 61 passed (221).

- P3-B19: the 10 table rows fail, each on `failures` (`expected [ { kind: 'error' } ] to deeply equal [ { tag: 'ApplicationDatabaseFault' } ]`; Vitest abbreviates the longer tags to `[ Array(1) ]`). The 5 existing tests pass.
- P3-B20: the 11 contract rows fail on `_tag` only (`expected undefined to be '<tag>'`, 7 distinct messages for 11 rows). The 10 cause rows pass.
- P3-B21: 139 tests fail, each with `expected [ 'name' ] to deeply equal [ '_tag' ]` (16 distinct stacks). The other 46 tests in the file pass.
- Every listed failure is one of the predicted messages. As predicted.

## Green — logs `p3-s5a-green.log`, `p3-s5a-green-2.log`

- First green run (`p3-s5a-green.log`): exit 1, 1 failed | 199 passed (200), `ReferenceError: nativeErrorFields is not defined` at `canonical-command-repository.ts:130`. I had left out the helper import in that file, so this was a wiring slip and not a behaviour mismatch. Typecheck reported the same missing import.
- After adding the import (`p3-s5a-green-2.log`): exit 0, 221 passed (221). `pnpm typecheck` exit 0.
- Shape: the 9 classes are `Data.TaggedError(<their name>)`. One pure helper, `nativeErrorFields(message?, options?)` in `project-storage-errors.ts`, owns the Q25 rule (a message only when given, a cause only when `options` has one). Decision (b): `project-storage-node-registry.ts:245` now reads `return yield* new ProjectStorageBrokenError(...)`.
- Harness unit suite (`p3-s5a-harness-unit.log`, `npx vitest run src`): exit 0, 51 files, 1142 passed.
- Effect read (`effect-advisory-p3-s5a-candidate.json`): 42 warnings. `extendsNativeError` 11, none of them in the 8 files. `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2 (`existing-registration.ts:56`, `project-storage-upgrade-pipeline.ts:384`). `message` 7. No `error`-level diagnostic. As predicted after decision (b).

## Bindings

- Binding 1 (`p3-s5a-binding-1.log`, `ProjectStorageBrokenError` drops `options`): exit 1, 2 failed | 219 passed. The failures are "keeps a given error as its cause" (`expected undefined to be Error: cause`) and "keeps a null cause" (`expected undefined to be null`). As predicted. Restored by digest.
- Binding 2 (`p3-s5a-binding-2.log`, the opening-release subclass gets its own tag): exit 1, 2 failed | 219 passed. The P3-B19 row 1 fails (`[ Array(1) ]` vs `[ Array(1) ]`, tag mismatch), and the P3-B20 row fails on `name` (`expected 'ProjectStorageOpeningReleaseFailedErr…' to be 'ProjectStorageBrokenError'`). As predicted. Restored by digest.
- Binding 4 (`p3-s5a-binding-4.log`, `{ message, cause: options?.cause }` passed always): exit 1, 2 failed | 219 passed. "has no own cause without options" fails (`expected true to be false`), as predicted. **MISMATCH:** the empty-message contract row `keeps the contract of 'ProjectStorageBrokenError': ''` also fails (`expected undefined to be ''`). The mutant assigns an own `message: undefined` when no message is given, which hides the prototype's `""`. My prediction named only the cause row. Restored by digest. STOP: reported to the coordinator. Binding 3 has not run.
- Coordinator decision (a) on binding 4: the extra row is accepted and recorded as a prediction mismatch; nothing changes.
- Binding 3 (`p3-s5a-binding-3.log`, `CanonicalWriterLeaseError` left `extends Error`): exit 1, 2 failed | 219 passed. P3-B19 row 6 fails (`[ { kind: 'error' } ]`), and the P3-B20 lease row fails on `_tag` (`expected undefined to be 'CanonicalWriterLeaseError'`). Effect read with the binding applied (`p3-s5a-binding-3-effect.log`, `effect-advisory-p3-s5a-binding-3.json`): 43 warnings, `extendsNativeError` 12, the extra one at `canonical-writer-lease.ts:40`. As predicted. Restored by digest.

## Structural checks (candidate)

- `rg -n "extends Error\b"` over the 8 files: 0 lines.
- `instanceof` lines (non-test `apps/harness/src`): 31, and the `git diff feb59d9` has no hunk on any of them.
- `git diff feb59d9 --stat`: the brief, the 8 source files, `project-storage-node-registry.ts` (decision (b)) and the 3 test files (one of them new). No Stryker config, because no range moved (see below).
- **MISMATCH with the brief's literal check:** `rg -c "new ProjectStorageBrokenError\("` over `apps packages` totals **152**, not 148. Leaving out the two files that hold the new contract rows, the total is 148, the same as `git grep` at `feb59d9`. The extra 4 are the contract's own rows: 3 in `storage-error-contract.test.ts` and 1 in `harness-request-diagnostics.test.ts`, which had 0 at `feb59d9`. No existing site changed. Reported to the coordinator.
- Coordinator decision (a) on the count: 148 existing sites (identical to `feb59d9`) plus 4 contract-row sites.

## Binding 5: line ranges moved

- `stryker.config.json`: `canonical-project-application.ts:90-101` → `91-102`, `:107-118` → `108-119`. `stryker.project-storage.config.json`: `application-database-migration.ts:142-284` → `147-289` (from `remap.py feb59d9`, line diff).
- Text: `git show feb59d9:<file> | sed -n <old>p` against `sed -n <new>p <file>` gives an empty diff (exit 0) for all three ranges (`p3-s5a-binding-5-range-text.log`).
- Mutants per range, counted with Stryker's own instrumenter (`p3-s5a-binding-5-range-mutants.log`): 4 / 8 / 91 at `feb59d9` and 4 / 8 / 91 on the candidate.
- `stryker.project-storage.config.json` mutates the whole `project-storage-node-registry.ts`, which decision (b) touched (`Effect.fail(new …)` → `yield* new …`). Its mutant set changes by construction, not by range.
- Stryker dry run: not run; it waits for the coordinator's GO.

## Gates

- CodeScene 10 on all 12 touched source and test files (the 8, `project-storage-node-registry.ts`, and the 3 tests).
- `pnpm check:duplicates` (`p3-s5a-duplicates.log`): exit 0, 0 clones. `pnpm check:dead-code` (`p3-s5a-dead-code.log`): exit 0.
- `pnpm check`: not run at first. CPU reading 1 was 90%, with League/TFT running. Waiting for a free machine.

## Heavy runs, once the machine was free (Pedro: "machine is free, go"; coordinator order)

- CPU readings, each in its own call: 9%, 16%, 23%. No League, TFT or Overwolf process.
- `pnpm check` (`p3-s5a-check.log`): exit 0. "Effect diagnostics verified; 42 advisory warnings." 113 files and 3703 tests passed; depcruise clean.
- Storage integration batch (`p3-s5a-integration-batch.log`, `pnpm exec vitest run --config vitest.integration.config.ts <13 files>`): exit 0, 13 files, 230 passed, 18.5 s. The 13 files are the 11 that construct or assert the 9 classes (`application-database-authority-cases`, `canonical-generation-four-pin`, `canonical-project-switch`, `canonical-storage-identity-rebuild`, `project-storage-application-client`, `project-storage-create`, `project-storage-lifecycle`, `project-storage-node-adapters`, `project-storage-open-initialization`, `project-storage-upgrade-directories`, `project-storage-upgrade-steps`) and the 2 that use `command-admission-cases.ts`, which constructs `CanonicalCommandRepositoryError` (`active-project-coordinator-real-commands`, `harness-runtime-real-commands`).
- Stryker dry run 1 (`p3-s5a-stryker-dryrun-main.log`, `stryker.config.json --dryRunOnly`): exit 0, 41 files, 3874 mutants. The initial test run succeeded with 2750 tests.
- Stryker dry run 2 (`p3-s5a-stryker-dryrun-project-storage.log`, `stryker.project-storage.config.json --dryRunOnly`): exit 0, 29 files, 3749 mutants. The initial test run succeeded with 604 tests. This is the same mutant count as p3-s4's dry run (`p3-s4-v2-stryker-dryrun.log`, 3749).

## Preflight (candidate `53ecb3c`, base `ca7125b`)

- Candidate patch: `p3-s5a-candidate-53ecb3c.patch` (`git diff --binary ca7125b..53ecb3c`, sha256 `204bc5f9…c285`, 14 files, +287 −52).
- `lane.mjs --range ca7125b..53ecb3c`: `rigorous` (`files: 11 > 5`; sensitive word "migration"). This is the measurement the brief already recorded; the approved lane is normal by the Q6 (a) override.
- `slice-preflight` run from the root, `apps/harness/src` and `apps/harness/src/storage` (`p3-s5a-preflight*.log`): exit 0 each time, with identical output: `preflight: partial`, `unchecked` for P3-B19, P3-B20 and P3-B21. The contract names test files, not test titles. There is no `missing-test-file`, no `missing-test-title`, no `broken`, and no parent diagnostic (the candidate's parent is the base). This is brief format, the same class as s1, s3 and s4 (rpiv issue #3). The brief is not edited. P3-B19 to P3-B21 go to the slice-verifier as unchecked reviewer focus.

## Slice-verifier round 1 (candidate `53ecb3c`, base `ca7125b`)

- `rpiv:slice-verifier`, candidate mode, on the frozen patch `p3-s5a-candidate-53ecb3c.patch`. **Result: failed, one violation.** Decisions OK, Research OK.
- **V1 (Cross-slice, violation): Vitest error equality is lost for the converted classes.**
  - Mechanism: the prototype of Effect 4's `YieldableError` carries `[Symbol.iterator]` (`effect/dist/internal/core.js:71-76,354-365`). Vitest's `iterableEquality` runs before `isErrorEqual` (`@vitest/expect/dist/index.js:271-277,351-358,482-577`). Two instances of the same class therefore compare equal on own enumerable fields only, with no `message` and no truthy `cause`. This holds for `toEqual`, `toStrictEqual`, `toThrow(instance)` and `rejects.*`.
  - Consequence: about 12 existing message assertions in 6 files silently stop checking the message.
  - The files: `project-storage-node-adapters.test.ts:156-157,168-169`, `generated-migrations.test.ts:162-168`, `canonical-storage-identity-rebuild.integration.test.ts:228-229`, `canonical-generation-four-pin.integration.test.ts:85-86`, `project-storage-upgrade-steps.integration.test.ts:92-93,150-151,171-172` and `project-storage-upgrade-directories.integration.test.ts:78,88,170`.
  - The brief's Vitest premise (design lines 981-982) is wrong for these classes.
  - Runtime behaviour is unchanged; the defect is in the test net.
  - **Confirmed by me** with a temporary probe test (deleted afterwards).
    - At the candidate (`p3-s5a-v1-probe-candidate.log`): `expect(new ProjectStorageBrokenError("a")).toEqual(new ProjectStorageBrokenError("b"))` and `toThrow(new ProjectStorageBrokenError("b"))` both pass, exit 0 (2 passed).
    - With `ca7125b`'s `project-storage-errors.ts` (`p3-s5a-v1-probe-base.log`): both fail, exit 1 (2 failed).
    - The source file was restored from `53ecb3c`, and the tree is clean apart from this record.
  - Fix options given by the verifier:
    - (a) add an explicit message assertion beside each listed assertion;
    - (b) one Vitest setup file that registers `expect.addEqualityTesters` for Error pairs (prototype, name, message, a defined cause, own enumerable fields), wired into the unit, integration and mutation configs. It is outside the affected paths, so it needs approval. It also covers the next s5a parts (the desktop needs its own), and it may surface weak oracles on already-tagged errors.
- Refuted by the verifier:
  - The falsy-cause change affects no consumer.
  - No code branches on `isEffect` or iterability for these values, and `runPromise` rejection identity is unchanged.
  - No log or wire path serializes these instances (`toJSON` / inspect). Possible later if someone logs `{ err }`.
  - `nativeErrorFields` is a leaf import with no cycle.
  - Q25-Q28, P3-B19 to P3-B21, decisions (A)(b) and (B), the 152 count and the Stryker realignment all hold.
- Polish (verifier):
  - The "No Stryker config, because no range moved" line in the Structural checks contradicts Binding 5. This is corrected here: both configs changed, as Binding 5 records.
  - "Stryker dry run: not run" is superseded by "Heavy runs".
  - Binding 5 records no base total for `stryker.config.json`, only the per-range counts.

## V1 fix (coordinator decision (b), Pedro's decision relayed): error equality tester

### Prediction, written before the red run

- New rows in `storage-error-contract.test.ts`, under "equality between two converted errors":
  1. different messages under `not.toEqual` and `not.toStrictEqual`;
  2. under `not.toThrow(instance)`;
  3. under `rejects.not.toThrow(instance)` and `rejects.not.toEqual`;
  4. two different truthy causes under `not.toEqual`;
  5. a control: equal message and the same cause stay equal under `toEqual` and `toThrow(instance)`.
- At `53ecb3c` (no tester): rows 1-4 FAIL. Each fails on its first assertion, with Vitest's `.not` message (`expected ProjectStorageBrokenError… to not deeply equal …`, and for `toThrow`, `expected function not to throw an error matching …`), because `iterableEquality` decides first. Row 5 PASSES.
- With the tester: rows 1-5 pass.

### Red, green and binding

- Red (`p3-s5a-v1-red.log`, at `53ecb3c` with the rows added): exit 1, 4 failed | 22 passed. Rows 1-4 fail and row 5 passes, as predicted. The messages:
  - `expected ProjectStorageBrokenError: a { …(1) } to not deeply equal ProjectStorageBrokenError: b { …(1) }`;
  - the cause row: `…: a … to not deeply equal …: a …`;
  - `toThrow` / `rejects.toThrow`: `expected a thrown error not to be ProjectStorageBrokenError: b { …(1) }`.
  - Wording mismatch: I had guessed the `toThrow` text as "expected function not to throw an error matching". The failing rows and their reason are as predicted.
- Tester: `apps/harness/tests/error-equality.ts` registers one tester with `expect.addEqualityTesters`. For an Error pair it requires the same prototype, name and message, a cause when either side defines one, the inner errors of an AggregateError pair, and equal own enumerable fields; any other pair falls through.
  - It is wired as `setupFiles` through `apps/harness/vitest.setup-files.ts` into nine configs: `vitest.config.ts` (unit), `vitest.integration.config.ts`, `vitest.registration.config.ts` and `vitest.native-long.config.ts` (merged with the #94 trace setup), and the `conversation`, `effect-gate`, `ledger`, `ledger-table` and `project-storage` mutation configs.
  - The new path module is added to the harness `tsconfig.json`.
  - Order: Vitest runs custom testers before `iterableEquality` in `toEqual` (`@vitest/expect/dist/index.js:1227`) and `toThrow(instance)` (`:1586`).
- Green (`p3-s5a-v1-green.log`): exit 0, 26 passed. Harness `tsc --noEmit`: no error.
- Binding (`p3-s5a-v1-binding.log`, the registration line removed): exit 1, 4 failed | 22 passed (rows 1-4). Restored by digest.

### Existing tests with the tester active

- Harness unit (`p3-s5a-v1-harness-unit.log`, `npx vitest run` inside `apps/harness`): exit 1, 2 failed | 1237 passed.
  - The 2 failures are `scripts/check-boundaries-parse.test.mjs` "reports a forbidden TypeScript import" ('allowed', 'value import'), with `ENOENT … apps\harness\tsconfig.base.json`. That test depends on the folder it runs from.
  - From the repository root (`p3-s5a-v1-boundaries-from-root.log`, `--project harness`) it passes, exit 0. It is my invocation, not the tester. Every `src` test passes with the tester active.
- Integration batch, the same 13 files (`p3-s5a-v1-integration-batch.log`): exit 1, 2 failed | 228 passed. **STOP: two newly failing existing tests, not edited:**
  1. `tests/integration/project-storage-upgrade-steps.integration.test.ts:150-152`, "finds an unfinished upgrade only from a readable marker: an unreadable marker query is broken".
     - It compares `rejects.toThrow(new ProjectStorageBrokenError("Project Storage upgrade marker could not be read."))`, an instance with no cause.
     - The source throws that message with a cause (`project-storage-upgrade-node-adapter.ts:564`).
     - Vitest's own rule checks a cause only when the expected value defines one. The tester rule decided for this fix, "cause when defined on either side", rejects it ("Compared values have no visual difference").
     - Exposed by the tester's stricter cause rule. It is not a message change.
  2. `tests/integration/project-storage-upgrade-directories.integration.test.ts:261`, "removes only proven upgrade output: adapter, retained or case-variant target".
     - `EPERM: operation not permitted, rename …\.staging-… -> …\.Staging-…` in the test's own setup `rename`, before any equality check.
     - It looks environmental (a Windows lock on a case-only rename), and it passed in the same batch at `53ecb3c`. Not rerun, per the rules.

### Coordinator decision on the two failures (Pedro's decision, relayed by the coordinator)

1. Option (a): keep the symmetric cause rule. `upgrade-steps` :150 pins the real cause and shows that a wrong cause fails.
2. Rerun `project-storage-upgrade-directories.integration.test.ts` once, alone. Stop if EPERM again.

### Pinned cause

- The real cause object is not reachable from the test.
  - The query runs in the database worker.
  - The client rebuilds the failure in the parent (`deserializeWorkerError`, `local-libsql-worker-client.ts:464-469`) as a plain `Error` with its own `name` and `code`.
- A probe (temporary file, deleted, not committed) read the cause at this row:
  - prototype `Error.prototype`;
  - name `LibsqlError`;
  - message `SQLITE_ERROR: no such column: upgrade_id`;
  - own enumerable keys `name`, `code` = `SQLITE_ERROR`;
  - no inner cause.
- The row now expects `new ProjectStorageBrokenError("Project Storage upgrade marker could not be read.", { cause: workerQueryError("SQLITE_ERROR", "SQLITE_ERROR: no such column: upgrade_id") })`.
  - `workerQueryError` builds the cause the way the client does: a plain `Error` with `name` and `code` assigned.
- Prediction, written before the run: the row passes. Each wrong cause fails it with an assertion error:
  - c1: wrong message (`lost_id`);
  - c2: wrong code (`SQLITE_CORRUPT`);
  - c3: wrong name (`Error`);
  - c4: no cause.
- Green (`p3-s5a-v1-cause-green.log`): exit 0, 1 passed | 6 skipped.
- Bindings (`p3-s5a-v1-cause-binding-c1..c4.log`): each exits 1 with 1 failed, and each failure is an `AssertionError` at :150. Each file was restored by digest (`ee1c880c…9585`). As predicted.

### Directories rerun

- `p3-s5a-v1-directories-rerun.log`, the file alone, once: exit 0, 4 passed.
- The EPERM did not recur, so it is recorded as environmental.

### Gates on the V1 fix

- CodeScene: 10 on `tests/error-equality.ts`, `storage-error-contract.test.ts` and `project-storage-upgrade-steps.integration.test.ts`.
  - The 9 vitest configs and `vitest.setup-files.ts` have no functions, so CodeScene returns no score and no findings (`score: null, review: []`).
- `check:duplicates` (`p3-s5a-v1-duplicates.log`): 0 clones.
- `check:dead-code` (`p3-s5a-v1-dead-code.log`): exit 0.
- Integration batch, the same 13 files:
  - `p3-s5a-v1-integration-batch-2.log` is my invocation slip: repo-relative paths run inside `apps/harness`, so it found no test files (exit 1). Nothing ran.
  - `p3-s5a-v1-integration-batch-3.log`, from the repository root as before: exit 0, 230 passed.
- `pnpm check` (`p3-s5a-v1-pnpm-check.log`, CPU read first at 4/7/4%): exit 0.
  - 113 files, 3708 tests (3703 + the 5 equality rows).
  - "42 advisory warnings", as at `53ecb3c`.
  - No dependency violations.
- Not run: Stryker dry runs for the 5 mutation configs that now load the setup file. Left to the coordinator.

### Mutation configs run directly (coordinator decision: instead of Stryker dry runs; no round 2)

- The CPU was read first at 3/6/2%. Each config ran alone, one at a time, from the repository root (`pnpm exec vitest run --config apps/harness/vitest.<name>-mutation.config.ts`), logged as `p3-s5a-v1-mutation-config-<name>.log`. Each exits 0.

| Config | Test files | Tests |
|---|---|---|
| `conversation` | 6 passed | 153 passed |
| `effect-gate` | 1 passed | 65 passed |
| `ledger` | 8 passed | 1187 passed |
| `ledger-table` | 1 passed | 16 passed |
| `project-storage` | 36 passed | 604 passed |

- Proof that the setup file loads (`p3-s5a-v1-mutation-config-setup-load.log`):
  - The registration line in `tests/error-equality.ts` was replaced by `throw new Error("error-equality-setup-loaded")`.
  - Each of the 5 configs exits 1, with every test file failed (6, 1, 8, 1, 36) on that error and no tests run.
  - The file was restored by digest (`ed061607…5f52`).
- s5a is closed by the coordinator. The desktop Vitest configs do not get the tester; this is noted for s5c.
