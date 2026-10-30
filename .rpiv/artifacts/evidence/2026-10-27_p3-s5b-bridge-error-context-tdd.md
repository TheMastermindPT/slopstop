# TDD record: p3-s5b-bridge-error-context

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `ee68144f…`; approved copy `approved-abc6f917.md` (main checkout evidence folder). Append-only against it: clean (frontmatter plus the 2026-10-27 decision block only).
- Contract commit: `337c82b` (the brief alone), on `e2c1a06`.
- Lane: normal. Q38 (a): inline unwrap at each edge, no helper. Q39 (a): realign all 8 ranges. Q40 (a): no other range audit (s6 commitment). Q41 (b): one scoped mutation run on the 8 realigned ranges, on the final candidate, alone, on the coordinator's GO; every survivor and no-coverage mutant goes to Pedro unchanged.
- Evidence logs: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5b2-*.log` (main checkout).
- Order: the shutdown part's needs-run (`project-storage-lifecycle` and `process-bootstrap` integration files, on `e2c1a06` code) runs first, when the machine is free.

## Static prediction, written before any run

### Planned change

- `storage/retryable-attempt.ts`:
  - import `{ type UntypedRejection, untypedRejection, unwrapRejection }` from `../effect-rejection.js`;
  - `completion = Deferred.makeUnsafe<void, UntypedRejection>()`;
  - `const attempt = Effect.runPromise(Deferred.await(completion)).catch((failure: unknown) => { throw unwrapRejection(failure); })`. `current = attempt` stays the derived promise, so `current === attempt` still clears a failed attempt;
  - `Deferred.doneUnsafe(completion, Effect.fail(untypedRejection(error)))`.
- `registration/registration-registry.ts`:
  - the import line becomes `{ type UntypedRejection, untypedRejection, unwrapRejection }`, still one line;
  - `pending`, `completion` and the `settle` parameter take `UntypedRejection`;
  - the rejection is settled as `Effect.fail(untypedRejection(error))`;
  - the stop (`:209-227`) is unchanged; its existing `unwrapRejection` now also unwraps admissions.
- `storage/application-database-authority.ts`:
  - one new import line (`../effect-rejection.js`, sorted after `effect`), so every line below it moves by +1;
  - `Initialization = Deferred.Deferred<"absent" | "current", UntypedRejection>`; the two `makeUnsafe` calls (`:372`, `:485`) take the same type;
  - `publish` settles `Effect.fail(untypedRejection(error))`;
  - `joinInFlight`: the existing `.then(map)` becomes `.then(map, (failure: unknown) => { throw unwrapRejection(failure); })`. This is the shutdown part's startup-edge form; it adds no microtask hop. Biome formats it over about 6 lines instead of 3, so the lines below move by about +3 more; the exact moves are read after Biome.
- `storage/project-storage-application-client.ts`:
  - new import line;
  - `initialization` and `candidate` take `UntypedRejection`;
  - `initializeShared` settles `Effect.fail(untypedRejection(error))` and still rethrows the raw `error` to its own caller;
  - `acquire` (`:168`) and `stop` (`:204`): `Effect.runPromise(Deferred.await(initialization)).catch((failure: unknown) => { throw unwrapRejection(failure); })`.
- `storage/project-storage-store.ts` (it already imports both helpers):
  - `AdmittedOperationCompletion`, the `makeUnsafe` (`:562`) and the `settle` parameter take `UntypedRejection`;
  - `:571` settles `Effect.fail(untypedRejection(error))`, after the same raw `error === ownerStoppedError` check;
  - `drainAdmittedOperations`: `.map((failure) => shutdownOperationFailure(unwrapRejection(failure)))`, so it unwraps first and maps second.
- `Effect.fail(untypedRejection(...))` is not a `yield*`, so `unnecessaryFailYieldableError` does not apply. Both of its current hits are `return yield* Effect.fail(...)`.

### Test shape

- **P3-B28**, new `src/storage/retryable-attempt.test.ts`, 5 rows:
  - (a) `start` rejects with the string `"attempt refused"` → the call rejects `toBe("attempt refused")`;
  - (b) `start` throws an `Error` synchronously → rejects `toBe` it and `not.toBeInstanceOf(UntypedRejection)`;
  - (c) after a failed attempt (its rejection caught), the next call returns a different promise and `start` is called twice;
  - (d) after a success, later calls return the same promise and `start` is called once;
  - (e) a call made from inside `start` returns the same promise as the outer call.
- **P3-B29**:
  - **Authority (contract-shape point for the coordinator).** The `joiners` `it.for` at `application-database-authority-cases.integration.test.ts:311` already is "one failing entry per joiner": the registry's gated fresh creation fails with `failure`, and each joiner (Storage's `ensureCurrent`, the registry's `openCurrent`) is checked with `expect(joinedResult).toEqual({ status: "rejected", reason: failure })`. So the brief's measured gap "no row makes a second caller join a failing initialization (authority `:454`)" does not hold for the authority. It holds only for the client. I add no duplicate row. Instead, the existing `it.for` rows add `expect(joinedResult.reason).toBe(failure)` (narrowed on `status === "rejected"`) and `not.toBeInstanceOf(UntypedRejection)`. Coordinator: confirm, or name the separate row you want.
  - Client (`project-storage-application-client.integration.test.ts`), 2 new rows, with `initialize` gated, then throwing `failure = new ProjectStorageUnavailableError(...)`:
    - (f) `first = manager.existing()`; once `initialize` has started, `second = manager.existing()`; release → both reject `toBe(failure)`;
    - (g) `opening = manager.existing()`; once `initialize` has started, `stopping = manager.stop()`; release → `stopping` rejects `toBe(failure)`, `opening` rejects `toBe(failure)`. The client's `close` is called exactly once, by the failed initialization's own cleanup (`initializeRetainedApplicationClient`), never by the stop. That is my reading of "does not close a client".
- **P3-B30**, `src/storage/project-storage-store.test.ts`, 1 new row:
  - (h) `lifecycleDependencies()` with `locks.forProject` replaced by a gated fake. `owner.upgrade(...)` is admitted; `stop()` is called; the gate rejects with the string `"upgrade refused"` → the stop rejects `instanceof AggregateError`, `message` `"Project Storage shutdown failed."`, `errors[0]` `toBe("upgrade refused")`, and no element `instanceof UntypedRejection`. The upgrade's own rejection is caught.

### Prediction at the base (`337c82b`, tests added, source unchanged)

Every new row and added assertion **passes**:

- (a)-(e): today the `Deferred` fails with the raw value, and `runPromise` squashes it to that value.
- Authority `toBe`: today the joiner gets the raw `failure`.
- (f), (g): the raw `ProjectStorageUnavailableError` reaches `translateAcquisitionFailure`, which passes it through (as the existing `:100` row shows), and the stop awaits the raw failure.
- (h): the raw string is drained, and `shutdownOperationFailure` passes a non-`ProjectStorageOpeningReleaseFailedError` through.

Counts:

- `retryable-attempt.test.ts` 5 passed;
- `project-storage-store.test.ts` +1;
- client file +2;
- the authority file has the same count (strengthened rows).

### Red to green: the `effect-tsgo` read

| Read | total | warnings | `anyUnknownInErrorContext` | `schemaNumber` | `unnecessaryFailYieldableError` | `extendsNativeError` | `message` | `error` |
|---|---|---|---|---|---|---|---|---|
| `e2c1a06` (recorded) | 28 | 21 | 13 | 6 | 2 | 0 | 7 | 0 |
| candidate | **15** | **8** | **0** | 6 | 2 | 0 | 7 | 0 |

### Bindings (one per command, applied by hand on the candidate, restored by digest)

- Unit set: `src/storage/retryable-attempt.test.ts`, `src/storage/project-storage-store.test.ts`, `src/registration/registration-registry.test.ts`, `src/canonical-project-writer.test.ts`, `src/storage/canonical-writer-lease.test.ts`, `src/storage/application-database-authority.test.ts`.
- Integration set: the authority cases and the client file, under `vitest.integration.config.ts`.

1. **Drop the unwrap at `retryable-attempt.ts`** (unit set). **7 failed:**
   - `retryable-attempt.test.ts`: 2, rows (a) and (b);
   - `canonical-writer-lease.test.ts`: 1, "resumes native lease release from the failed stage" (`rejects.toMatchObject({ code })`; the wrapper has no `code`);
   - `canonical-project-writer.test.ts`: 4, the close rows that read a release rejection through `closeOnce`: the fence/repository/lease code row ending at `:415`, "retains failed release ownership and resumes cleanup on stop retry", "fails release with the abandon code when the force-close fails (CNV-B36)", and "keeps the S1 retry-at-release after a thrown settlement (U3)".
   - Rows (c), (d) and (e) stay green: they check identity and call counts, not the value.
   - Not in the run: `active-project-coordinator` (`stopOnce`) tests.
2. **Drop the unwrap at `application-database-authority.ts` `joinInFlight`** (integration set). **2 failed:** both `joiners` rows. Their existing `toEqual` already fails on the wrapper, and the added `toBe` fails too. The client file stays green: its `ensureInitialized` is a fake.
3. **Drop the unwrap at the client's `acquire`** (integration set). **1 failed:** (f), on `second`. `translateAcquisitionFailure` normalizes the wrapper to another error.
4. **Drop the unwrap at the client's `stop`** (integration set). **1 failed:** (g), on `stopping`.
5. **Drop the unwrap in `drainAdmittedOperations`** (unit set). **3 failed:** (h), and both rows of "retains a late activation release across shutdown (%i failures)". There the drained activation fails with the raw `f.failure`, so `errors` `toEqual([f.failure])` / `[f.failure, secondFailure]` meets the wrapper. Not in the run: `tests/integration/project-storage-lifecycle.integration.test.ts:194,689`.
6. **Drop `unwrapRejection` at `registration-registry.ts` stop** (unit set). **2 failed:**
   - "waits for an in-flight admission before the database" (`errors[0]` `toBe(refusal)` and `errors[1]` `toBe(unconfirmed)`);
   - "stops the standalone authority of its options: lease held" (`expectUnconfirmedAggregate`, `errors[0]` `toBe(unconfirmed)`; the database stop is already an `UntypedRejection` at the base).
   - "gives the same options a fresh authority…: after an unconfirmed stop" stays green: it checks only the state.
7. **`retryable-attempt.ts` `completion` typed `Deferred<void, unknown>`, the rest as the candidate** (effect read only). `anyUnknownInErrorContext` **1** (`retryable-attempt.ts:11`, the await; the `Effect.fail(untypedRejection(...))` settle is typed and not flagged), 16 diagnostics, 9 warnings, **no `error`**.

### Range realign (`stryker.project-storage.config.json`, Q39 (a))

The intended code and the realigned ranges at `e2c1a06` are the brief's, text-verified there. The candidate's ranges add this slice's moves: +1 in `application-database-authority.ts` for the import line, and about +3 more below `joinInFlight`. The exact numbers are read after Biome.

| Range at `e2c1a06` | Intended (at `e2c1a06`) | Candidate (predicted) | Text vs intended code | Mutants: today → candidate |
|---|---|---|---|---|
| `application-database-authority.ts:51-64` | `56-69` | `57-70` | identical to the `4cf6541` text | 1 → 4 |
| `:155-170` | `164-182` | `165-183` | the `4cf6541` text plus the `physicalRoot` callback added since | 1 → 5 |
| `:179-185` | `193-199` | `194-200` | identical | 1 → 4 |
| `:254-268` | `268-282` | `269-283` | identical | 6 → 12 |
| `:481-484` | `495-498` | `499-502` | identical | 0 → 6 |
| `:509-515` | `523-529` | `527-533` | identical | 2 → 4 |
| `registration-registry.ts:182-200` | `209-227` | `209-227` (no move) | identical (the `stop`; this slice does not edit those lines) | 16 → 13 |
| `process-bootstrap.ts:283-291` | `285-293` | `285-293` (file untouched) | the whole `applicationDatabaseLayer`, as written at `de9966a` | 1 → 1 (the `Effect.gen` body instead of the key string) |

- Total: 28 mutants today, **49** realigned. The brief says "27 … 48" for the 7 bridge ranges; with the `process-bootstrap.ts` range that is 28 and 49.
- No edit lands inside a range: `publish`, `createMissing`, `joinInFlight` and `sharing` are outside all six authority ranges, and the registry edits are outside `209-227`.
- Evidence: a text diff of each candidate range against its intended code, and the instrumenter count at `e2c1a06` (today's ranges) and on the candidate.
- The Q41 (b) scoped mutation run uses exactly these 8 candidate ranges (`--mutate` list recorded), on the final candidate, alone, on the coordinator's GO.

### Structural checks (candidate)

- `unknown` error types over the five source files → 0 lines.
- `unwrapRejection` over the five files names: `retryable-attempt.ts` (attempt), `application-database-authority.ts` (`joinInFlight`), `project-storage-application-client.ts` (`acquire`, `stop`), `project-storage-store.ts` (drain, plus the existing `attempt` helper), `registration-registry.ts` (stop), plus the import lines.
- `Effect.fail(new` over the five files → only `application-database-authority.ts` `orElse` (Q36, s5c), unchanged.
- `git diff e2c1a06 --stat`: the brief, the 5 source files, the 4 test files (1 new) and `stryker.project-storage.config.json`.

### Gates

- Red-green and guard runs as in the brief's Success Criteria.
- A dry run of the whole config: mutant total = 3753 + 21 (the 8 ranges 28 → 49) = **3774**; the tests counted by the dry run go up by the new unit rows that the project-storage mutation config collects.
- `pnpm check` exit 0, "8 advisory warnings".
- CodeScene 10 on every touched file; jscpd 0; knip clean.

## Observed (appended after the runs; the prediction above is unchanged)

- Coordinator decisions on the prediction: accepted. (1) No duplicate authority row: the 2 existing `:311` joiner rows are strengthened, raise-only, and binding 2's prediction stays 2 on them. (2) Row (g) as I read it.
- Shutdown part's needs-run first: green, recorded in its own TDD record (`127a5c2`).
- Base, with the tests added and the source unchanged (CPU 5-14%):
  - unit set (`p3-s5b2-base-unit.log`): 6 files, 115 passed;
  - integration set (`p3-s5b2-base-integration.log`): 2 files, 20 passed;
  - 0 failed. As predicted.
- Candidate:
  - unit set (`p3-s5b2-green-unit.log`): 115 passed; integration set (`p3-s5b2-green-integration.log`): 20 passed.
  - Effect read (`p3-s5b2-effect-read.log`, `effect-advisory-p3-s5b2-candidate.json`): 15 diagnostics, 8 warnings, `anyUnknownInErrorContext` 0, `schemaNumber` 6, `unnecessaryFailYieldableError` 2, `message` 7, no `error`. As predicted.
- Binding 1 (`p3-s5b2-binding-1.log`): **mismatch, 8 failed against 7 predicted.** The 7 predicted rows all failed, plus `canonical-writer-lease.test.ts` "classifies every injected native lease acquisition branch".
  - Its `verifyUnacquiredCleanup` reads `result.error.cause` `toBe(closeFailure)`; the failure reads `expected UntypedRejection { _tag: 'UntypedRej…' } to be Error: close failure`.
  - Mechanism, a static miss: `closeUnacquired` (`canonical-writer-lease.ts:83`) also wraps its cleanup close in `sharedRetry` → `retryableAttempt`, and puts the rejection it catches into the `WRITER_LEASE_CLOSE_FAILED` cause. I counted only the `release` path of `sharedRetry`.
  - Restored by digest. STOP: reported to the coordinator. Bindings 2-7 have not run.
- Coordinator: binding 1 accepted as 8. A later binding that bites harder, with its mechanism explained, is recorded and the run goes on; a binding that bites less, or an unexplained result, stops it.
- Binding 2 (`p3-s5b2-binding-2.log`): 2 failed, both `joiners` rows. As predicted.
- Binding 3 (`p3-s5b2-binding-3.log`): 1 failed, row (f). As predicted.
- Binding 4 (`p3-s5b2-binding-4.log`): 1 failed, row (g). As predicted.
- Binding 5 (`p3-s5b2-binding-5.log`): **4 failed against 3 predicted (harder, explained).** The 3 predicted rows failed, plus "unwraps an opening release failure at shutdown by type" (`errors` `toEqual([releaseFailure])`). The drained `ProjectStorageOpeningReleaseFailedError` now arrives wrapped, so `shutdownOperationFailure` no longer recognizes its type and does not reduce it to its cause. This is the very mechanism the brief named ("unwrap first, map second"); I missed the existing row that pins it.
- Binding 6 (`p3-s5b2-binding-6.log`): 2 failed, the 2 predicted rows. As predicted.
- Binding 7 (`p3-s5b2-binding-7.log`, `effect-advisory-p3-s5b2-binding-7.json`): `anyUnknownInErrorContext` 1, at `retryable-attempt.ts:12` (the await; `:11` in the prediction is the same line before the new import), 16 diagnostics, 9 warnings, no `error`. As predicted.
- Every binding was restored by digest, one binding per command.

### Range realign (candidate)

Each intended range at `e2c1a06` is mapped to the candidate by an equal-line diff, and its text is compared (`p3-s5b2-range-text.log`). Mutants are counted with the instrumenter (`p3-s5b2-range-mutants.log`).

| Today (`e2c1a06`) | Intended (`e2c1a06`) | Candidate | Text | Mutants |
|---|---|---|---|---|
| `application-database-authority.ts:51-64` | `56-69` | `57-70` | byte-identical | 1 → 4 |
| `:155-170` | `164-182` | `165-183` | byte-identical | 1 → 5 |
| `:179-185` | `193-199` | `194-200` | byte-identical | 1 → 4 |
| `:254-268` | `268-282` | `269-283` | byte-identical | 6 → 12 |
| `:481-484` | `495-498` | `499-502` | byte-identical | 0 → 6 |
| `:509-515` | `523-529` | `527-533` | byte-identical | 2 → 4 |
| `process-bootstrap.ts:283-291` | `285-293` | `285-293` | byte-identical | 1 → 1 |
| `registration-registry.ts:182-200` | `209-227` | `209-227` | byte-identical | 16 → 13 |

- Total: 28 → 49. Every candidate range is as predicted.

### Gates

- CodeScene: 10 on the 5 source files and the 4 test files.
- `pnpm check:duplicates`: exit 0, 0 clones. `pnpm check:dead-code`: exit 0.
- `pnpm check` (`p3-s5b2-pnpm-check.log`, CPU 15-16%): exit 0. Typecheck included, "Effect diagnostics verified; 8 advisory warnings.", 116 files, 3758 tests (3752 plus 5 in `retryable-attempt.test.ts` and 1 in the store).
- Structural checks:
  - `unknown` error types: 0 lines.
  - `unwrapRejection` appears at:
    - `retryable-attempt.ts:13`;
    - `application-database-authority.ts:458` (`joinInFlight`);
    - `project-storage-application-client.ts:173` (`acquire`) and `:213` (`stop`);
    - `project-storage-store.ts:177` (drain; `:159` is the existing `attempt`);
    - `registration-registry.ts:224` (stop).
  - `Effect.fail(new`: only `application-database-authority.ts:278` (Q36, s5c).

### Candidate

- `cadf2ab` fix(harness): type the promise bridge failures on the error channel (p3-b28 to p3-b30), on `337c82b`. Patch: `p3-s5b2-candidate-cadf2ab.patch`.
- lint-staged Biome changed nothing (`git diff --stat a87765b cadf2ab -- apps stryker.project-storage.config.json` is empty). `lane.mjs --range 337c82b..cadf2ab`: `normal` ("files: 6 > 5"). `slice-preflight.mjs` (`p3-s5b2-preflight.log`): `preflight: clean`.
- Coordinator: binding 5 accepted (harder, explained).
- Stryker dry run (`p3-s5b2-stryker-dryrun-project-storage.log`; coordinator GO; run alone; CPU 0-3%): exit 0, 29 files, **3774 mutants**, as predicted (3753 plus 21). The initial test run passed with 610 tests (609 plus the new store row).
- The scoped mutation run (Q41 (b)) waits for the final candidate, after the verifier round and any fix, and needs the coordinator's GO.

## Verifier round 1 (slice-verifier, candidate mode, on `cadf2ab`, base `337c82b`)

- Result: **passed, no findings, no alternatives.** Decisions OK, Cross-slice OK, Research OK.
- Hypotheses refuted:
  - A consumer reading an un-unwrapped value: the five Deferreds have exactly six readers, and all six unwrap.
  - `retryableAttempt`'s single-flight, retry and re-entry rules broken by the derived promise.
  - The extra `.catch` hop: refuted statically; its final check in execution is needs-run 1.
- needs-run:
  1. `pnpm --filter @slopstop/harness exec vitest run --config vitest.integration.config.ts tests/integration/project-storage-open-initialization.integration.test.ts tests/integration/application-database-authority.integration.test.ts tests/integration/canonical-writer-lease.integration.test.ts`. These consumer-level joins are not covered by any recorded candidate run. `project-storage-open-initialization` `:138-194` makes two concurrent inspects join one failing client initialization.
  2. The Q41 (b) scoped mutation run on the final candidate.
- Polish:
  - The "Structural checks" `git diff e2c1a06 --stat` claim leaves out the shutdown TDD record's docs-only append (`127a5c2`), which is inside that range.
  - The brief says the Q36 `orElse` site is "not moved"; its text is untouched, but the new import moved it from `:277` to `:278`.
  - The brief's measured gap "no row makes a second caller join a failing initialization (client `:168`)" overlooks `project-storage-open-initialization.integration.test.ts:138-194`.

## Final runs on `cadf2ab` (coordinator GO; each run alone; CPU rule)

- Full dry run, confirmed: `p3-s5b2-stryker-dryrun-project-storage.log`, exit 0, 3774 mutants (predicted 3774), 610 tests in the initial run.
- needs-run 1 (`p3-s5b2-needs-run-integration.log`, CPU 6-14%): `project-storage-open-initialization`, `application-database-authority` and `canonical-writer-lease` integration files. Exit 0, 3 files, 5 passed, among them "clears only the failed shared initialization and retries once".
- Q41 (b) scoped mutation run (`p3-s5b2-scoped-mutation.log`, CPU 6-22%):
  - Config: `p3-s5b2-scoped-mutation-config.json` (main checkout evidence folder). It is `stryker.project-storage.config.json` with `mutate` limited to the 8 candidate ranges (`application-database-authority.ts:57-70, 165-183, 194-200, 269-283, 499-502, 527-533`, `process-bootstrap.ts:285-293`, `registration-registry.ts:209-227`) and with its own report files.
  - Result: exit 0, 3 files, 49 mutants. The initial test run had 393 tests.
  - Counts: **48 killed, 0 timeout, 0 survived, 0 no-coverage, 1 ignored. Mutation score 100.00.**
  - The 1 ignored mutant is not a survivor: `application-database-authority.ts:62` StringLiteral → `""`, on the `Data.TaggedError("ApplicationDatabaseCloseUnconfirmed")` tag string. The class is built once at module load, so with `ignoreStatic: true` Stryker ignores that static mutant.
  - Report: `p3-s5b2-scoped-mutation-report.json`.
