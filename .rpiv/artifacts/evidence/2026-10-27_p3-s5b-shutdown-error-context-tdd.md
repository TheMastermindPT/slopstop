# TDD record: p3-s5b-shutdown-error-context

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `b7640da8…`; approved copy `approved-abf3cdb5.md` (main checkout evidence folder). Append-only against it: clean (frontmatter plus the 2026-10-27 decision block only).
- Contract commit: `1c63299` (the brief alone), on `8c91754`.
- Lane: normal (Q34 (a)). Q35 (a): the listing stop is `Effect.Effect<void, Error>`. Q36 (a): the four unflagged `Effect.fail(new X(...))` sites go to s5c. Q37 (a): no mutation.
- Evidence logs: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5b-*.log` (main checkout).
- Harness unit tests run with `pnpm --filter @slopstop/harness exec vitest run <files>`.

## Static prediction, written before any run

### Planned change

- `harness-runtime.ts`:
  - `import { type UntypedRejection, untypedRejection, unwrapRejection } from "./effect-rejection.js"` (one new import line; every later line moves by +1);
  - the listing option `stop: Effect.Effect<void, Error>` (`:52`), and `startEffectStop`'s parameter the same (`:112`);
  - `shutdownAfterIntake` returns `Effect.Effect<void, UntypedRejection>` (`:179`); its failure is `return yield* untypedRejection(runtimeShutdownFailure(failures))` (`:197`; no `Effect.fail(new ...)`);
  - `completion = Deferred.makeUnsafe<void, UntypedRejection>()` (`:430`);
  - the edge: `stopPromise = Effect.runPromise(Deferred.await(completion)).catch((failure: unknown) => { throw unwrapRejection(failure); })` (`:435`). The one extra microtask hop is flushed by `advance` (`vi.advanceTimersByTimeAsync` then a real `setImmediate`), so no timing row moves.
- `process-bootstrap.ts`:
  - import `unwrapRejection` beside `untypedRejection` (same line);
  - shutdown: `return yield* untypedRejection(combinedFailure(failures, "Harness process shutdown failed."))` (`:123`);
  - startup: `return yield* untypedRejection(combinedFailure([...], "Harness startup failed."))` (`:133`);
  - startup edge: the existing `.then(onStarted)` becomes `.then(onStarted, (failure: unknown) => { throw unwrapRejection(failure); })` (`:137`; no extra hop);
  - stop edge: `disposal ??= Effect.runPromise(shutdown(stopHarness)).catch((failure: unknown) => { throw unwrapRejection(failure); })` (`:141`).
- Tests: the three fixture parameter types become `Effect.Effect<void, Error>` (`harness-runtime.test.ts:105,333`, `harness-runtime-shutdown.test.ts:377`); every fixture value already fits.
- `combinedFailure` and `runtimeShutdownFailure` keep returning `unknown` (pure functions, no Effect type; not a hit).

### Test shape

- **P3-B26**, in `harness-runtime.test.ts`, inside `describe("shutdown failures while no Project is held")`, 3 new `it`s:
  - (a) `failingRuntime(["canonical", "listing"])` → `instanceof AggregateError`, `message` `toBe("Harness runtime shutdown failed.")`, `errors[0]` `toBe(canonicalFailure)`, `errors[1]` `toBe(listingFailure)`, `not.toBeInstanceOf(UntypedRejection)`;
  - (b) `failingRuntime([])` with `applicationDatabase.stop.mockRejectedValueOnce("database stop refused")` → the stop rejects `toBe("database stop refused")`;
  - (c) `failingRuntime(["storage"])` → `toBe(storageFailure)` and `not.toBeInstanceOf(UntypedRejection)`.
- **P3-B27**, in `process-bootstrap.test.ts`, 2 new `it`s plus 2 added assertions:
  - (d) a `start` that throws the string `"startup refused"`, released layer `Effect.void` → the launch rejects `toBe("startup refused")`;
  - (e) `launchProgram(Effect.void, () => Promise.reject("program refused"))` → the stop rejects `toBe("program refused")`;
  - the `shutdownRows` "both fail" check and the `startupRows` "the dispose dies" check add `not.toBeInstanceOf(UntypedRejection)`.

### Prediction at the base (`1c63299`, tests added, source unchanged)

Every new row and assertion **passes** at the base: the change is type-only, and these rows pin today's values.

| Row | Base | Why |
|---|---|---|
| (a) | pass | failures `[canonical, listing]` (canonical before listing in `shutdownAfterIntake`) → `new AggregateError(failures, "Harness runtime shutdown failed.")`, raw on the error channel |
| (b) | pass | `startStop` turns the rejected string into `["database stop refused"]`; one failure is reported as is; `Cause.squash` gives the `Fail` value itself |
| (c) | pass | one failure as is |
| (d) | pass | `Effect.try` wraps the throw, the generator takes `.cause` back, `combinedFailure` of one value is that value, squashed raw |
| (e) | pass | the same through `Effect.tryPromise` |
| added `not.toBeInstanceOf` × 2 | pass | no `UntypedRejection` exists on these paths today |

- Base run: `harness-runtime.test.ts` +3 passed, `process-bootstrap.test.ts` +2 passed, 0 failed (absolute counts read from the run).

### Red to green: the `effect-tsgo` read (`effect-read.mjs`)

| Read | warnings | `anyUnknownInErrorContext` | `schemaNumber` | `unnecessaryFailYieldableError` | `extendsNativeError` | `message` | total |
|---|---|---|---|---|---|---|---|
| base `8c91754` (recorded) | 31 | 23 | 6 | 2 | 0 | 7 | 38 |
| candidate | **21** | **13** | 6 | 2 | 0 | 7 | **28** |

- The 10 removed hits: `harness-runtime.ts:115,197,435,449`, `process-bootstrap.ts:123,133,141`, `harness-runtime.test.ts:336`, `harness-runtime-shutdown.test.ts:386` × 2.
- The 13 left are exactly the bridge family: `retryable-attempt.ts` × 2, `registration-registry.ts` × 3, `application-database-authority.ts` × 2, `project-storage-application-client.ts` × 3, `project-storage-store.ts` × 3. No `error`.
- The tests at the candidate: the same counts as the base run, 0 failed.

### Bindings (applied by hand on the candidate, restored by digest)

Each binding runs the 7-file set: `harness-runtime.test.ts`, `harness-runtime-shutdown.test.ts`, `process-bootstrap.test.ts`, `process-connection.test.ts`, `process-shutdown.test.ts`, `process-fatal-diagnostics.test.ts`, `harness-request-diagnostics.test.ts`.

**Binding 1: drop the unwrap at the runtime stop edge** (`stopPromise = Effect.runPromise(Deferred.await(completion))`). Every `Fail` of the runtime stop reaches the caller as `UntypedRejection`; defects and interruptions do not change.

- `harness-runtime.test.ts`: **8 failed**:
  - the 4 `it.for` rows "canonical fails", "Storage fails", "both fail", "listing fails" (`expected UntypedRejection{…} to be …`; "both fail": `expected UntypedRejection{…} to be an instance of AggregateError`);
  - "treats a throwing held-Project query as held and reports it" (`:372` `toBe(failure)`);
  - (a), (b), (c).
  - "the listing stop dies" and "the listing stop interrupts itself" stay green (a defect and an interruption are not wrapped).
- `harness-runtime-shutdown.test.ts`: **6 failed**:
  - "stops intake before exposing one observable Project Storage stop promise" (`:96`);
  - "retains synchronous shutdown failures while attempting every cleanup" (`:207`, `toMatchObject({ errors })`: the wrapper has no `errors`);
  - "retains a throwing workspace unsubscribe as a stop failure…" (`:238`);
  - "keeps the shared application database when canonical release withholds Storage" (`:305`);
  - "reports an unconfirmed application database close: alone" (`:348`) and ": with a listing failure" (`:350`).
  - The dispose and "ManagedRuntime disposed" rows stay green (interruption or a value this slice does not wrap).
- `process-bootstrap.test.ts`: **1 failed**: "routes the process runtime through its edges: unsubscribe throws" (`:425`). The process stop unwraps once and is left with the runtime's `UntypedRejection`.
- The 4 guard files: 0 failed (they use fake `launch` / `stopRuntime`).
- Total: **15 failed**.
- Not in the run: `tests/integration/project-storage-lifecycle.integration.test.ts:975` reads the same edge and would fail too.

**Binding 2: drop the unwrap at the process stop edge** (`disposal ??= Effect.runPromise(shutdown(stopHarness))`).

- `process-bootstrap.test.ts`: **6 failed**:
  - `shutdownRows` "both fail", "only the dispose fails", "only the program fails", "the dispose never ends, the program fails";
  - "routes the process runtime through its edges: unsubscribe throws";
  - (e).
  - "both succeed" and "waits for the program before the dispose" stay green.
- The other 6 files: 0 failed.
- Total: **6 failed**.

**Binding 3: drop the unwrap at the process startup edge** (the `.then` loses its rejection handler).

- `process-bootstrap.test.ts`: **4 failed**: the 3 `startupRows` ("the dispose dies with ApplicationDatabaseCloseUnconfirmed", "the dispose takes 10 ms", "the dispose never ends") and (d).
- `process-connection.test.ts:23,56`: green (fake `launch`); outcome recorded. The other files: 0 failed.
- Total: **4 failed**.

**Binding 4: `return yield* Effect.fail(runtimeShutdownFailure(failures))` at the runtime failure, as today** (effect read only, no tests).

- `anyUnknownInErrorContext` **14** (the 13 bridge sites plus `harness-runtime.ts` at the failure line), warnings **22**, total **29**; every other count as the candidate.
- The plain type error this binding also makes (`Effect<void, unknown>` is not assignable to `Effect<void, UntypedRejection>`) is not in this read: `effect-tsgo diagnostics` reports Effect rules only (AGENTS.md). `pnpm typecheck` is not run for the binding.

### Structural checks (candidate)

- `rg -n "Effect\.Effect<[^>]*, unknown>|Deferred(\.Deferred)?<[^>]*, unknown>|makeUnsafe<[^>]*, unknown>"` over the 2 source files → 0 lines.
- `rg -n "unwrapRejection"` over the 2 source files → 3 call lines (runtime stop, process stop, process startup) plus the 2 import lines.
- `rg -n "Effect\.fail\(\s*new "` over the 2 source files → 0 lines.
- `git diff 8c91754 --stat -- apps stryker*.json` → the 5 affected files, plus `stryker.project-storage.config.json` if a range moves.
- Mutation ranges: the `harness-runtime.ts` ranges move by the import line (+1) and each is re-pointed to the same code; the `process-bootstrap.ts` range `103-143` grows by the lines the new rejection handlers take after Biome. A word diff of each range's text before and after shows only the slice's edits.

### Gates

- Guards: `harness-runtime-shutdown`, `process-connection`, `process-shutdown`, `process-fatal-diagnostics`, `harness-request-diagnostics` green.
- `pnpm typecheck` exit 0; `pnpm check` exit 0 with "21 advisory warnings" (CPU rule first).
- CodeScene 10 on the 5 files; jscpd 0 new clones; knip clean.

## Observed (appended after the runs; the prediction above is unchanged)

- Base pins (`p3-s5b-base-pins.log`, source unchanged): 2 files, 121 passed, 0 failed; the 5 new rows are collected (`vitest list`). As predicted.
- Candidate (`p3-s5b-green.log`): the 7-file set, 180 passed, 0 failed.
- Effect read (`p3-s5b-effect-read.log`, `effect-advisory-p3-s5b-candidate.json`): 28 diagnostics, 21 warnings, `anyUnknownInErrorContext` 13 at exactly the bridge sites, `schemaNumber` 6, `unnecessaryFailYieldableError` 2, `message` 7, no `error`. As predicted.
- Binding 2 (`p3-s5b-binding-2.log`): 6 failed, exactly the predicted rows. Restored by digest.
- Binding 3 (`p3-s5b-binding-3.log`): 4 failed, exactly the predicted rows; `process-connection.test.ts` green. Restored by digest.
- Binding 1 (`p3-s5b-binding-1.log`): **mismatch, 17 failed against 15 predicted.** All 15 predicted rows failed, plus 2 more, each `expected UntypedRejection { _tag: 'UntypedRej…' } to be Error: …`:
  - `harness-runtime.test.ts` "awaits canonical release and withholds Storage shutdown after rejection" (`toBe(failure)`): a static miss; this row reads the runtime stop rejection and I left it out of the prediction.
  - `harness-runtime.test.ts` "the listing stop dies": predicted green, wrongly. `startEffectStop` squashes the listing fiber's defect into a reported failure (`[Cause.squash(exit.cause)]`), so the defect joins `failures` and leaves the program inside the `UntypedRejection`, not as a defect of the program. Only an interruption bypasses the wrapper.
  - So `harness-runtime.test.ts` fails 10 (not 8), `harness-runtime-shutdown.test.ts` 6, `process-bootstrap.test.ts` 1. Restored by digest.
  - Bindings 2 and 3 ran in the same command as binding 1, before its output was read.
  - Coordinator decision: binding 1 accepted as 17; from here on, one binding per command.
- Binding 4 (`p3-s5b-binding-4.log`, `effect-advisory-p3-s5b-binding-4.json`): **mismatch.** `anyUnknownInErrorContext` 14 (the 13 bridge sites plus `harness-runtime.ts:198`, the failure line) and 22 warnings, as predicted; but 30 diagnostics, not 29. The extra one is `error:missingEffectError` at `harness-runtime.ts:183` (`return Effect.gen(...)` in `shutdownAfterIntake`): the Effect language service reports that the generator's `unknown` error is missing from the declared `UntypedRejection`. I predicted no `error`, wrongly: the type mismatch surfaces through an Effect rule, so `check:effect` would block this binding. Restored by digest.
- Coordinator decision: binding 4 accepted as observed (a stronger bite).

### Stryker realign (`stryker.project-storage.config.json`)

Each base range (HEAD config) is paired with its candidate range by position, and the text is diffed (`p3-s5b-range-text-2.log`). `p3-s5b-range-text.log` is invalid: it read the already-realigned config as the base, and is superseded. Mutants are counted with Stryker's instrumenter (`p3-s5b-range-mutants.log`).

| Base range | Candidate | Text | Mutants |
|---|---|---|---|
| `harness-runtime.ts:187-190` | `188-191` | byte-identical | 7 → 7 |
| `harness-runtime.ts:91-103` | `92-104` | byte-identical | 9 → 9 |
| `harness-runtime.ts:110-121` | `111-122` | the `stop` parameter type only | 12 → 12 |
| `harness-runtime.ts:181-181` | `182-182` | byte-identical | 1 → 1 |
| `harness-runtime.ts:244-247` | `245-248` | byte-identical | 2 → 2 |
| `harness-runtime.ts:338-355` | `339-356` | byte-identical | 19 → 19 |
| `harness-runtime.ts:431-452` | `432-455` | the `stopPromise` line and its unwrap `.catch` | 15 → 16 |
| `process-bootstrap.ts:274-282` | `283-291` | byte-identical | 1 → 1 |
| `process-bootstrap.ts:103-143` | `103-153` (grown) | the slice's edits; `149-153` newly covers the startup rejection handler and the `.then` closing lines | 23 → 26 |
| `process-bootstrap.ts:58-70`, `72-77`, `84-96` | unchanged | byte-identical | 4 / 3 / 6 |

- The coordinator accepted the realign.
- Dry run (`p3-s5b-stryker-dryrun-project-storage.log`, run alone on the coordinator's GO, CPU 5-17%): exit 0. 29 files and 3753 mutants (3749 at the s5a dry run, plus the 4 above). The initial test run succeeded with 609 tests (604 at s5a, plus the 5 new rows). No mutation run (Q37 (a)).

### Gates

- CodeScene: 10 on `harness-runtime.ts`, `process-bootstrap.ts`, `harness-runtime.test.ts`, `harness-runtime-shutdown.test.ts`, `process-bootstrap.test.ts`.
- `pnpm check:duplicates` (`p3-s5b-duplicates.log`): exit 0, 0 clones. `pnpm check:dead-code` (`p3-s5b-dead-code.log`): exit 0.
- `pnpm check` (`p3-s5b-pnpm-check.log`, CPU 5-8%): exit 0. Typecheck included, "Effect diagnostics verified; 21 advisory warnings.", 115 files, 3752 tests passed (3747 at s5a3, plus 5). The "SlopStop failed to start." stderr line is pre-existing (it is also in the s5a2 and s5a3 logs).
- Structural checks:
  - `unknown` error types in the 2 source files: 0 lines.
  - `unwrapRejection`: the 2 imports plus 3 edges (`harness-runtime.ts:437`, `process-bootstrap.ts:145` stop, `:151` startup).
  - `Effect.fail(new`: 0 lines.
  - `git diff 8c91754 --stat`: the brief, the 5 affected files and `stryker.project-storage.config.json`.

### Candidate

- `4eeb8d4` fix(harness): type the shutdown failures on the error channel (p3-b26, p3-b27), on `1c63299`. Patch: `p3-s5b-candidate-4eeb8d4.patch` (main checkout evidence folder).
- lint-staged Biome changed nothing (`git diff --stat f24d645 4eeb8d4 -- apps stryker.project-storage.config.json` is empty).
- `lane.mjs --range 1c63299..4eeb8d4`: `fast` ("within fast limits"). The approved lane is normal (Q34 (a)).
- `slice-preflight.mjs --base 1c63299 --candidate 4eeb8d4` (`p3-s5b-preflight.log`): `preflight: clean`.

## Verifier round 1 (slice-verifier, candidate mode, on `4eeb8d4`, base `1c63299`)

- Result: **passed, no findings, no alternatives.** Decisions OK, Cross-slice OK, Research OK.
- Hypotheses refuted:
  - The extra `.catch` hop does not reorder any consumer.
  - No `UntypedRejection` reaches `summarizeHarnessFailure`: the 3 edges are the only exits.
  - A one-level unwrap returns every original, and defects pass through.
- needs-run (optional; no finding depends on it): `tests/integration/project-storage-lifecycle.integration.test.ts` and `tests/integration/process-bootstrap.integration.test.ts` under the integration config. They read the runtime stop edge and are outside `pnpm check`.
- Polish:
  - The grown range `process-bootstrap.ts:103-153` adds 3 mutants (23 → 26): the two new rejection-handler bodies, and the pre-existing success-callback body (`(stopHarness) => {…}`). The base range ended before that body's closing line, so it never counted it. This is a little more than "the `.then` closing lines" the realign table says.
  - The brief's fixture citation `harness-runtime.test.ts:105,333` is `:106,360` at the candidate.
  - Pre-existing and outside the slice: the range `process-bootstrap.ts:283-291` starts at the `CanonicalProjects` key string and holds 1 mutant.
- Successor note (bridge slice): the runtime edge unwraps one level only, so the bridge slice must unwrap at its own edges. This is already planned in the brief.

## Needs-run (coordinator GO, run once, alone)

- `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/project-storage-lifecycle.integration.test.ts tests/integration/process-bootstrap.integration.test.ts` from `apps/harness` (`p3-s5b-needs-run-integration.log`).
- Source: `e2c1a06`. The worktree held only the bridge slice's uncommitted test files, none of them in this run.
- Result: exit 0, 2 files, 25 passed. CPU 5% (Pedro: the machine is free; 5 idle `OverwolfBrowser` processes remained).
- With this green the coordinator closes `p3-s5b-shutdown-error-context`. Polish (3) (the `process-bootstrap.ts:283-291` range start) moves to the bridge slice.
