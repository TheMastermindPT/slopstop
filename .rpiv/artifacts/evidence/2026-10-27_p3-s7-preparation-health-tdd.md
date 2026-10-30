# TDD record: p3-s7-preparation-health (P3-B39 to P3-B41)

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, `content_hash 77e146f3533eebb9eb375e9e9f32a21d71c80f18602eb0d16cedbc1ebe1c7f2e`, approved copy `approved-77e146f3.md` (identical, `cmp`). Committed as the contract in `9cbe8b2`.
- Base: `6c18b2b` (s6b closed). Lane normal. Q55-Q59 (a).
- Evidence folder: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/` in the main checkout (logs `p3-s7-*`).
- Predictions are written before each run and never edited; observations are appended.

## Structural red (before the first edit)

- CodeScene `code_health_review` of `apps/harness/src/registration/project-registration-preparation.ts` at `6c18b2b`: **8.03**. Findings:
  - Overall Code Complexity;
  - Complex Method `confirm` (190-222, cc 9) and `inspectConfirmation` (122-173, cc 9);
  - Complex Conditional `inspectConfirmation:137` (2 expressions) and `confirm:208` (2 expressions);
  - Code Duplication 294-305 / 308-319 (the two tracked wrappers).

## Base instrumenter counts (P3-B41, before)

- `range-mutants.mjs stryker.config.json …project-registration-preparation.ts` at `6c18b2b`: `230-277` 38, `292-305` 11, `365-381` 22 (as the brief and the s6b record say). The per-mutant listing (mutator, line, replacement) is `p3-s7-base-range-mutants-6c18b2b.txt`, the base of the P3-B41 mapping.

## Q57 characterization row (P3-B39): prediction, written before the run

- Row: `registration-preparation.integration.test.ts`, "refuses confirmation of a preparation that was never saved before any observation". It builds the fixture without calling `prepare`, sends `validateConfirmation(confirmationRequest(f.request, { proposalId: randomUUID(), proposalFingerprint: "0".repeat(64) }))`, and expects `toEqual({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" })` with `f.dispatches()` unchanged.
- Prediction at the base (source unchanged): **green**, 1 passed (run alone with `-t`). The fixture's registry decisions already created `application.db` with its tables, so `readProposal` answers `undefined` and the `saved === undefined` leg (`:138`) answers the conflict before any observation. Its bite is binding 2, after the refactor.
- Any other answer (for example a broken or not-found code because the database or table is missing) is a stop: the row would then pin a different branch from the one the brief names.

## Q57 characterization row: observed

- `p3-s7-q57-row-base.log` (CPU 12/6/7, no game processes), source at `6c18b2b`: 1 passed, 19 skipped by `-t`. Green, as predicted. Its bite (binding 2) comes after the refactor.

## Base scoped mutation (Q56, heavy run 1 of 4): observed

- Coordinator GO. `p3-s7-mutation-base.log` on `02577b3` (source as at `6c18b2b`), CPU 3/16/3, alone. Config `<scratchpad>/s7/stryker.p3-s7-base.json`: `stryker.config.json` with `mutate` limited to the file's 3 entries, `incremental` off, own report path. Report `p3-s7-mutation-base-report.json`.
- **Exit 1**: the run completed (71 mutants, initial run 52 tests in 6 s, 27 s in all), and the score **63.38** is under `stryker.config.json`'s break threshold of 80. This is the base measurement, not a broken run: `stryker.config.json` runs only the unit projects, and only the 8 CNV-B37 unit cases reach this file (as the brief measured).
- Per range, against the instrumenter counts 38/11/22 (all 71 present):

| Range | Mutants | Killed | Survived | No coverage | Timeout |
|---|---|---|---|---|---|
| `230-277` | 38 | 25 | 4 | 9 | 0 |
| `292-305` | 11 | 8 | 3 | 0 | 0 |
| `365-381` | 22 | 12 | 10 | 0 | 0 |

- Base survivors (line:column, mutator, replacement):
  - `230-277`: 243:7 ConditionalExpression `false` (`dependencies.listing === undefined`); 248:7 ConditionalExpression `true` (`Result.isFailure(result)`); 266:7 ObjectLiteral `{}` and 266:22 StringLiteral `""` (`{ concurrency: "unbounded" }`).
  - `292-305`: 293:5 ConditionalExpression `false` (`listing === undefined`); 302:21 BlockStatement `{}` (the `finally`); 303:13 AssignmentOperator `activeListings += 1` (for `-= 1`).
  - `365-381`: 366:11 ConditionalExpression `false` (`closing !== undefined`); 367:16 BooleanLiteral `false` (`closed = true`); 370:9 ConditionalExpression `false` (`activeBootstraps > 0`); 372:13 ConditionalExpression `true` and EqualityOperator `>= 0` (`activeListings > 0`); 376:13 ConditionalExpression `false`, ConditionalExpression `true`, EqualityOperator `!==`, 376:31 StringLiteral `""`, 376:51 AssignmentOperator `&&=` (`if (result.status === "pending-recovery") unconfirmed ??= result`).
- Base no-coverage (9, all in `cleanupUnconfirmed`'s success leg, 250-251): 250:5 ConditionalExpression `true` (2), `false`, LogicalOperator `||`, EqualityOperator `!==`, 250:31 StringLiteral `""`; 251:5 ConditionalExpression `true`, EqualityOperator `!==`, 251:29 StringLiteral `""`.
- The final scoped run is compared with this base by mutator and source text (Q56): any survivor or no-coverage mutant that is not in this list is new and goes to Pedro as it stands.

## Refactor (P3-B39)

- Shape (Promise code still, no Effect added or removed; `drainPreparations` untouched):
  - one module-level `write(options, operation)` replaces the `write` that `prepare` and `confirm` each defined; `inspectConfirmation`'s identical inline read uses it too;
  - `isSavedProposal(saved, request)` (a type predicate) holds the saved-proposal match as `!(saved === undefined || saved.proposalId !== … || preparationFingerprint(saved) !== …)`, same legs, same order;
  - `identityRefusal(saved, observed)` holds the two comparisons after a fresh observation, executable first (`GIT_CONFIRMATION_REQUIRED`), then physical (`REPOSITORY_IDENTITY_CHANGED`), else `undefined`; the expressions are moved unchanged;
  - `bootstrapFor` holds the bootstrap decision (`reserved.created && dependencies.bootstrap !== undefined && !signal.aborted`, same order), and `completeConfirmation` runs it or reads the stored confirmation (`?? incomplete(request)`); `confirm` calls it with `return await` inside its `try`, so a rejected bootstrap still reaches `registryFailure`;
  - one `tracked(counter, work, failed)` replaces the two wrappers. `counter` is `{ running, pending }`: `listings` carries `pendingListing`, `bootstraps` carries `pendingCreation`. Listing passes `listingCleanupFailed`; bootstrap passes the module-level `bootstrapFailed` (`result.status === "broken"`), outside every range. `close` reads `bootstraps.running` and `listings.running`.
- CodeScene: 9.68 on the first shape (Excess Number of Function Arguments, `tracked` with `pending` as a 4th parameter), then **10.0 with no finding** after `pending` moved into the counter. `pnpm typecheck` exit 0. Biome: no fixes.

## `check:mutation-ranges` red (P3-B40): prediction, written before the run

Read statically from the refactored text against the three anchors (no run): `230-277`'s pair (`const pendingCreation …` / `}`) stands once at distance 47, at 272; `292-305`'s first line (`  const trackedListing: Listing | undefined =`) stands only at 351, and its last line (`        };`) stands nowhere; `365-381`'s pair (`    close: () => {` / `  };`) stands once at distance 16, at 400.

Predicted: exit 1, stderr exactly

```
STRYKER_RANGE_DRIFT
stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:230-277 moved to apps/harness/src/registration/project-registration-preparation.ts:272-319
stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:292-305 drifted; first line found at 351, last line found nowhere
stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:365-381 moved to apps/harness/src/registration/project-registration-preparation.ts:400-416
```

A line for any other file or config is a stop.

## `check:mutation-ranges` red: observed

- `p3-s7-ranges-red.log`: exit 1, `STRYKER_RANGE_DRIFT` with exactly the 3 predicted lines, all `stryker.config.json` entries of this file. As predicted.
- `p3-s7-unit-after-refactor.log`: the 8 CNV-B37 unit cases pass on the refactor (unedited).

## Re-point (Q55 (a)) and recount (P3-B41): prediction, written before the configs are edited and before the count is read

Re-point table (each range follows its logic, never a "moved to" suggestion alone):

| Entry before | Entry after | Unit before → after | First line before → after | Last line before → after |
|---|---|---|---|---|
| `:230-277` | `:272-319` | `pendingCreation` to the end of `drainPreparations` → the same unit, text identical (`diff` of base 230-277 with 272-319 is empty) | `const pendingCreation = …` → same | `}` → same |
| `:292-305` | `:335-352` | `trackedListing` (the listing wrapper) → the shared `tracked` and the listing's call into it (`trackedListing`), contiguous, so one entry | `  const trackedListing: Listing \| undefined =` → `  const tracked =` | `        };` → `    listing === undefined ? undefined : tracked(listings, listing, listingCleanupFailed);` |
| `:365-381` | `:400-416` | `close` → `close`; only `activeBootstraps > 0` / `activeListings > 0` became `bootstraps.running > 0` / `listings.running > 0` | `    close: () => {` → same | `  };` → same |

- Out of every range, as before: `bootstrapFailed`, `trackedBootstrap` (the bootstrap's own call), and the `bootstraps`/`listings` counter objects.
- Q58: `stryker.config.json` keeps 3 ranges in this file, so its count stays 19 ranges and 33 whole files. The real-repository row is **not edited**.

Predicted instrumenter counts (base 38/11/22 = 71): **`272-319` 38, `335-352` 12, `400-416` 22 = 72.**

Mapping (base listing `p3-s7-base-range-mutants-6c18b2b.txt`, by mutator and source text):

- `230-277` → `272-319`: all 38 one to one, same mutator and text, lines +42.
- `292-305` → `335-352` (11 → 12):
  - `listing === undefined` ConditionalExpression `true`, `false`, EqualityOperator `!==` (3) → the same expression in `trackedListing`'s ternary;
  - the wrapper's arrow body BlockStatement → `tracked`'s inner arrow body BlockStatement;
  - `activeListings += 1` AssignmentOperator `-=` → `counter.running += 1` `-=`;
  - the `try` BlockStatement → the `try` BlockStatement;
  - `listingCleanupFailed(result)` ConditionalExpression `true`, `false` → `failed(result)` `true`, `false`;
  - `unconfirmed ??= pendingListing` AssignmentOperator `&&=` → `unconfirmed ??= counter.pending` `&&=`;
  - the `finally` BlockStatement → the `finally` BlockStatement;
  - `activeListings -= 1` AssignmentOperator `+=` → `counter.running -= 1` `+=`.
  - Gained, 1: the outer arrow of `tracked` (its body is an expression, the inner arrow), ArrowFunction `() => undefined`, at 335-340.
  - Removed: none. The bootstrap wrapper's duplicate body was never in a range; its mutants were not counted at the base and are not counted now.
- `365-381` → `400-416`: all 22 one to one by mutator; the two `> 0` comparisons keep their 4 mutants each (`true`/`false`, `>= 0`, `<= 0`), with `bootstraps.running` / `listings.running` in place of `activeBootstraps` / `activeListings`.

No range at 0. A mutant lost without a listed reason is a stop.

## Re-point and recount: observed

- Configs and anchors edited together (the 3 entries in `stryker.config.json`, the 3 anchors rewritten from the new boundary lines).
- `p3-s7-ranges-green.log`: `pnpm check:mutation-ranges` exit 0, `stryker.config.json 19 ranges, 33 whole files` (unchanged, Q58). `p3-s7-ranges-test.log`: `check-stryker-ranges.test.mjs` 41/41, the real-repository row unedited.
- `p3-s7-candidate-range-mutants.txt`: **38, 12, 22 = 72**, as predicted. A mechanical comparison by mutator and replacement text, in order, shows `230-277` → `272-319` and `365-381` → `400-416` one to one (with `activeBootstraps`/`activeListings` read as `bootstraps.running`/`listings.running`). The listing range's mutators are the base 11 plus the 1 predicted ArrowFunction (the outer arrow of `tracked`). No mutant lost.

## Bindings 1, 5 and 6: prediction, written before each run

- **Binding 1** (`trackedListing` given `bootstrapFailed` in place of `listingCleanupFailed`): `project-registration-preparation.test.ts` exit 1, exactly 1 failure, "closes after a broken REGISTRY_CORRUPT listing whose cleanup completed (CNV-B37)", with close answering `{ status: "broken", code: "INTERNAL_FAILURE" }` (a `REGISTRY_CORRUPT` listing is `broken`, so the bootstrap's test records `pendingListing`). The other 7 pass: their broken listings are unconfirmed under both tests, and the others are not broken.
- **Binding 5** (`stryker.config.json` `:400-416` re-pointed to `:400-415`, anchor left at `:400-416`): `pnpm check:mutation-ranges` exit 1, `STRYKER_RANGE_UNANCHORED`, one line `stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:400-415 has no anchor` (the stale `:400-416` anchor is outranked).
- **Binding 6** (the `:335-352` anchor keeps the old text, `  const trackedListing: Listing | undefined =` / `        };`): exit 1, `STRYKER_RANGE_DRIFT`, one line `stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:335-352 drifted; first line found at 351, last line found nowhere`.

## Bindings 1, 5 and 6: observed (each restored by digest)

- **Binding 1** (`p3-s7-binding-1.log`): exit 1, **3 failures**, 5 passed, against 1 predicted: "closes after a broken REGISTRY_CORRUPT / REGISTRY_SCHEMA_NEWER / REGISTRY_SCHEMA_UNKNOWN listing whose cleanup completed (CNV-B37)", each with close answering `{ status: "broken", code: "INTERNAL_FAILURE" }` against `{ status: "closed" }`. Mismatch, harder and explained: the named case is one `it.each` over the three registry-broken codes, and every one of them is `broken`, so the bootstrap's test records `pendingListing` for each. Same reason as predicted; recorded and not chased. Restored `8ac222a2…ae56`.
- **Binding 5** (`p3-s7-binding-5.log`): exit 1, `STRYKER_RANGE_UNANCHORED`, the one predicted line. As predicted. Restored `02aa36fc…3a82`.
- **Binding 6** (`p3-s7-binding-6.log`): exit 1, `STRYKER_RANGE_DRIFT`, the one predicted line. As predicted. Restored `763cab9e…973b`.

## Bindings 2 to 4: prediction, written before the runs (each needs the coordinator's GO; each runs `registration-preparation.integration.test.ts` alone, 21 rows)

- **Binding 2** (`saved === undefined ||` dropped from `isSavedProposal`): exit 1, exactly 1 failure, the Q57 row "refuses confirmation of a preparation that was never saved before any observation". `saved.proposalId` on `undefined` throws inside `inspectConfirmation`'s `try`, so `registryFailure` answers a broken result in place of `REGISTRATION_IDEMPOTENCY_CONFLICT`. Every other row validates a saved proposal.
- **Binding 3** (the fingerprint comparison dropped): exit 1, exactly 1 failure, "refuses confirmation with mismatched proposalFingerprint before any new observation": the request passes the match and goes on to observe, so the answer is not the conflict (and the dispatch count passes 6). The `proposalId` case still passes.
- **Binding 4** (`false &&` before the physical comparison in `identityRefusal`): exit 1, exactly 1 failure, "refuses confirmation when fresh Git administration differs from the saved proposal": the changed administration is no longer refused, so the answer is `confirmation-validated` in place of `REPOSITORY_IDENTITY_CHANGED`.

## Structural checks and gates on the candidate (before the heavy runs)

- `rg -n "createProjectRegistrationPreparation" …/project-registration-owner.ts`: `:4` and `:18`, as at `6c18b2b`.
- `Effect.` uses in the file: identical list to `6c18b2b` (all in `drainPreparations`).
- `git diff 6c18b2b --stat`: the brief, this record, the source file, the integration test (Q57 row), `stryker-range-anchors.json`, `stryker.config.json`. No other path; `check-stryker-ranges.test.mjs` unchanged (Q58).
- `p3-s7-duplicates.log` 0 clones; `p3-s7-dead-code.log` knip exit 0; `p3-s7-pnpm-check.log` (CPU 0/1/15, no game processes) exit 0.

## Registration integration project (Q56, heavy run 2 of 4): observed

- Coordinator GO. `p3-s7-registration-integration.log` on `f577e2c`, CPU 14/11/15, alone, `vitest.registration.config.ts` unedited: **26 files passed, 274 tests passed**, 199.7 s, exit 0. No timeout. As predicted (P3-B39 green across the registration integration project, the Q57 row among them).

## Bindings 2 to 4: observed (coordinator GO; one file per command, each alone after one CPU reading; each restored by digest `8ac222a2…ae56`)

- **Binding 2** (`p3-s7-binding-2.log`, CPU 0/3/7): exit 1, exactly 1 failure, the Q57 row, which received `{ status: "broken", code: "INTERNAL_FAILURE" }` in place of the conflict. As predicted. The file has **20** tests, not the 21 I wrote in the prediction (a counting slip in the text; the row set is the one listed above).
- **Binding 3** (`p3-s7-binding-3.log`, CPU 2/7/4): exit 1, exactly 1 failure, "refuses confirmation with mismatched proposalFingerprint before any new observation", which received the validated answer (`proposalId`, `proposalFingerprint` "000…", …). The `proposalId` case passed. As predicted.
- **Binding 4** (`p3-s7-binding-4.log`, CPU 4/13/1): exit 1, exactly 1 failure, the predicted row "refuses confirmation when fresh Git administration differs from the saved proposal". Mismatch in detail, explained: the received answer is `{ status: "pending-recovery", code: "REGISTRATION_INCOMPLETE", requestId }`, not `confirmation-validated`, because that row calls `f.confirm(…)`, not `validateConfirmation`; with the refusal gone, `confirm` reserves and, with no bootstrap in the fixture, answers `incomplete(request)`. Same row and same cause (the physical refusal is skipped); recorded, not chased.

## Final scoped mutation (Q56, heavy run 4): prediction, written before the GO

- Config `<scratchpad>/s7/stryker.p3-s7-final.json`: the same options as the base config (checked by `diff`), with `mutate` set to the candidate's 3 entries (`272-319`, `335-352`, `400-416`) and its own report path.
- Predicted: 72 mutants; **46 killed, 17 survived, 9 no coverage**, score 63.89, exit 1 under the break of 80 (the same reason as the base: only the unit projects run).
- Survivors and no-coverage mutants: exactly the base set, mapped by mutator and source text (`230-277` → `272-319` at +42 lines; `close` at +35 lines with `bootstraps.running`/`listings.running`; the listing's `listing === undefined` `false`, `finally` `{}` and `-= 1` → `+= 1` now in `trackedListing` and `tracked`). The gained ArrowFunction (the outer arrow of `tracked`) is predicted **killed**: `tracked(...)` would answer `undefined`, so no listing is passed and every unit case with a listing gets `pendingListing` in place of its answer.
- Any survivor or no-coverage mutant outside the mapped base set is new and goes to Pedro as it stands.

## Final scoped mutation (Q56, heavy run 4): observed

- Coordinator GO after the user's "livre". `p3-s7-mutation-final.log` on `66eab09` (source as at `f577e2c`), CPU 13%, no game processes, alone. Report `p3-s7-mutation-final-report.json`.
- **Exit 1**, as predicted: the run completed (72 mutants, initial run 52 tests, 25 s), and the score **63.89** is under the break of 80, for the same reason as the base (only the unit projects run).
- 72 mutants: **46 killed, 17 survived, 9 no coverage**, 0 timeouts. As predicted.
- The gained ArrowFunction (outer arrow of `tracked`, 336): **Killed**, as predicted.
- Comparison with the base by status, mutator, replacement and source line text: 26 not-killed at the base, 26 now. A script match leaves two pairs that differ only in the renamed text, and each is the predicted mapping: `activeListings -= 1` → `+= 1` is now `counter.running -= 1` → `+= 1` (348), and `listing === undefined` `false` is now the same expression on `trackedListing`'s one line (352). **No new survivor and no new no-coverage mutant.**
- Final survivors (17):
  - `272-319`: 285:7 ConditionalExpression `false` (`dependencies.listing === undefined`); 290:7 ConditionalExpression `true` (`Result.isFailure(result)`); 308:7 ObjectLiteral `{}` and 308:22 StringLiteral `""` (`{ concurrency: "unbounded" }`).
  - `335-352`: 347:17 BlockStatement `{}` (the `finally`); 348:9 AssignmentOperator `counter.running += 1` (for `-= 1`); 352:5 ConditionalExpression `false` (`listing === undefined`).
  - `400-416`: 401:11 ConditionalExpression `false` (`closing !== undefined`); 402:16 BooleanLiteral `false` (`closed = true`); 405:9 ConditionalExpression `false` (`bootstraps.running > 0`); 407:13 ConditionalExpression `true` and EqualityOperator `>= 0` (`listings.running > 0`); 411:13 ConditionalExpression `true`, `false`, EqualityOperator `!==`, 411:31 StringLiteral `""`, 411:51 AssignmentOperator `&&=` (`if (result.status === "pending-recovery") unconfirmed ??= result`).
- Final no coverage (9, `cleanupUnconfirmed`'s success leg): 292:5 ConditionalExpression `true` (2), `false`, LogicalOperator `||`, EqualityOperator `!==`, 292:31 StringLiteral `""`; 293:5 ConditionalExpression `true`, EqualityOperator `!==`, 293:29 StringLiteral `""`.
- Stopped here, as the coordinator asked: the survivors go to the user, and none is killed by a test edit without the user's decision (Q56).

## User decision: kill the 26 inside s7 (relayed by the coordinator)

- Pedro chose to kill the 17 survivors and the 9 no-coverage mutants inside s7, as in s6b: unit behaviour rows with exact oracles through `createProjectRegistrationPreparation`, so the scoped config reaches them; a written argument per equivalent mutant, which the coordinator reviews; a real defect is a stop; then CodeScene 10 on the test file, the gates, and one final scoped mutation with a GO.

## The 26, classified before any row is written (static reading of `f577e2c`)

Line numbers are the final run's. Through the unit seam, the only work that can be running is a listing: `prepare`, `validateConfirmation` and `confirm` open the application database first (`withRegistrationDatabase` → `requirePlainEntries` and `openCurrent` on real paths), and the bootstrap runs only after `confirm` reserves in that database.

**Killable by a unit row (10):**

- 285:7 `dependencies.listing === undefined` → `false`, and 352:5 `listing === undefined` → `false` (in `trackedListing`): with no listing, the first calls `undefined(signal)`, and the second wraps `undefined` in `tracked`, whose call throws; either way `listProjects()` rejects in place of answering `pendingListing`.
- 290:7 `Result.isFailure(result)` → `true`, and 292:5 the whole success test → `true`: a listing that answers successfully while close drains it would count as unconfirmed, so close would answer `pendingCleanup` in place of `closed`.
- 292:5 LogicalOperator `||`, 293:5 the right operand → `true`, 293:5 `code !==`: a listing that answers `{ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" }` (a member of the listing's answer union) while close drains it would count as unconfirmed.
- 401:11 `closing !== undefined` → `false`: a second `close()` would build a new promise in place of returning the first.
- 402:16 `closed = true` → `false`: an operation after close would run in place of answering `cancelled`.
- 411:51 `unconfirmed ??= result` → `&&=`: when a listing already recorded `pendingListing` and close's drain answers `pendingCleanup` (a later listing rejected while drained), close would answer `pendingCleanup` in place of the recorded `pendingListing`.

**Equivalent (11), one argument per mutant:**

1. 308:7 ObjectLiteral `{}` (no `concurrency` option, so `Effect.forEach` runs one at a time). Every item is a promise that is already running; the effect only waits for it. Waiting in order gives the same results in the same order, and the whole wait still ends when the last promise settles: each earlier promise is already settled or is awaited first. The timeout wraps the whole `forEach`, so it fires at the same time either way, and interrupting a wait has no side effect. No answer that close gives can differ.
2. 308:22 StringLiteral `""` (`concurrency: ""`): a value that is not `"unbounded"`, `"inherit"` or a number runs `Effect.forEach` one at a time, which is mutant 1's case.
3. 411:13 ConditionalExpression `true` (`unconfirmed ??= result` for every result). `??=` writes only when `unconfirmed` is `undefined`, and the next statement answers `unconfirmed ?? result`. With `unconfirmed` unset, both answer `result`; with it set, both answer `unconfirmed`. Nothing reads `unconfirmed` after this callback: `closing` is memoized, `closed` is already true (every later `run` answers `cancelled` before it reaches `unconfirmed`), and the callback's answer is fixed.
4. 411:13 ConditionalExpression `false` (never assign): same argument; the answer is `unconfirmed ?? result` either way.
5. 411:13 EqualityOperator `!==`: same argument (assigning for the other results, or not assigning, gives the same answer).
6. 411:31 StringLiteral `""` (`result.status === ""`, never true): mutant 4's case.
7. 292:5 the whole success test → `false`;
8. 292:5 EqualityOperator `status !==` (with `code === "OBSERVER_CLEANUP_UNCONFIRMED"`, never true together, since every answer with that code is `pending-recovery`);
9. 292:31 StringLiteral `""` (`status === ""`, never true);
10. 293:29 StringLiteral `""` (`code === ""`, never true). Each of 7-10 makes the drain miss a successful answer with `OBSERVER_CLEANUP_UNCONFIRMED`. `run` checks the same answer (`unconfirmed ??= pendingCleanup` for `pending-recovery` with `OBSERVER_CLEANUP_UNCONFIRMED`), and its `await work` reaction was registered when the work started, before `close` existed, so it runs first in the microtask turn where the work settles. The drain only sees the answer after `Effect.tryPromise`, `Effect.forEach`, `Effect.timeoutOrElse` and `runPromise` settle, and close then answers `unconfirmed ?? result`, which is `pendingCleanup` either way. The success-leg check in `cleanupUnconfirmed` is redundant with `run`'s. Row 7 below pins that answer, so these become covered survivors rather than no-coverage mutants; the final run shows it.
11. 292:5 the left operand → `true` (`true && code === "OBSERVER_CLEANUP_UNCONFIRMED"`): it differs only for an answer with that code and a status other than `pending-recovery`, and none exists. The listing's union (`RegistryPendingRecoverySchema`), `pendingCleanup` and `observeProposal`'s answers all pair that code with `pending-recovery`.

**Not reachable through a unit row (5), and not equivalent:** 347:17 `finally` `{}`, 348:9 `counter.running -= 1` → `+=`, 405:9 `bootstraps.running > 0` → `false`, and 407:13 `listings.running > 0` → `true` and `>= 0`. Each changes only close's timeout answer, and only when, at the budget, a work other than a listing is still running (a bootstrap, or a `prepare` or `confirm` waiting on its observation), or a listing counter is stale while no listing runs. Every such work needs the application database, which unit rows do not create: the reclassification rule puts real-database rows in integration. The registration integration project has rows that close past the budget with a running bootstrap (`registration-bootstrap-guards.integration.test.ts:326-331`) and with a running preparation (`registration-preparation-lifecycle.integration.test.ts:242-247`), which `stryker.config.json` does not run. These 5 go to the coordinator and Pedro for a decision before any integration change.

**Not a defect:** the two redundancies (the drain's success-leg check, and the assignment before close's answer) give the same answers. No row exposes a wrong answer.

## Kill rows: prediction, written before they run

7 new unit rows in `project-registration-preparation.test.ts` (8 → 15). All describe today's correct behaviour, so each passes now (exit 0, 15 passed). Their red is the mutant each one kills, which the final scoped run shows (as in s6b). The fakes have the seam's own `Listing` type, which answers a Promise, so a failing fake rejects (`Effect.fail` does not fit a Promise port). None of the rows waits on time, so no clock is needed.

1. "answers the listing-unavailable failure when no listing is given": `listProjects()` → `{ status: "broken", code: "INTERNAL_FAILURE" }`, then `close()` → `{ status: "closed" }` (kills 285:7, 352:5).
2. "answers the same closing promise to every close": `close()` twice → the same promise (`toBe`), settling to `{ status: "closed" }` (kills 401:11).
3. "answers cancelled without listing once closed": after `close()`, `listProjects()` → `{ status: "cancelled" }`, and the listing was never called (kills 402:16).
4. "closes after a listing that answers while close drains it": the listing answers `listed` on abort; `listProjects()` → `{ status: "cancelled" }` (fenced), and `close()` → `{ status: "closed" }` (kills 290:7 and 292:5 `true`).
5. "closes after a listing that answers a missing registry while close drains it": the listing answers `{ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" }` on abort; `listProjects()` → that answer, and `close()` → `{ status: "closed" }` (kills 292:5 `||`, 293:5 `true`, 293:5 `!==`).
6. "keeps a listing's broken answer when a later listing rejects while close drains it": the first listing answers `{ status: "broken", code: "INTERNAL_FAILURE" }`, and the second rejects on abort; `close()` → `{ status: "broken", code: "INTERNAL_FAILURE" }` (kills 411:51 `&&=`).
7. "stays cleanup-unconfirmed when a listing answers cleanup unconfirmed while close drains it": the listing answers `{ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }` on abort; `close()` → that answer. It kills nothing (arguments 7-10). It pins the answer, and turns those mutants from no coverage into covered survivors.

Predicted final scoped run: 72 mutants, **56 killed** (46 + 10), **16 survived** (the 11 equivalents and the 5 unreachable), **0 no coverage**; score 77.78, exit 1 under the break of 80.

## Kill rows: observed

- `p3-s7-kill-rows.log`: 15 passed (8 + 7), exit 0. As predicted. Each row also checks the listing call's own answer (`cancelled`, the missing-registry answer, the rejection, the cleanup-unconfirmed answer) besides close's.
- CodeScene `project-registration-preparation.test.ts`: 10.0, no finding. `pnpm typecheck` exit 0. Biome: no fixes.
- `p3-s7-kill-duplicates.log` 0 clones; `p3-s7-kill-dead-code.log` knip exit 0; `p3-s7-kill-pnpm-check.log` (CPU 0/11/3, no game processes) exit 0, 3816 tests.

## Coordinator review of the arguments, and the dead statement

- Accepted as equivalent (7): 308 `{}` and `""`; 292 whole `false`, `status !==`, 292 `""`, 293 `""`; 292 left operand `true`.
- Not accepted as equivalent: the 4 at 411. Coordinator decision (the fix over a residual, disclosed to the user): the statement `if (result.status === "pending-recovery") unconfirmed ??= result;` in close's callback is dead code, because the next line already answers `unconfirmed ?? result`. Delete it and keep `return unconfirmed ?? result`.
- The user chose (b) for the 5 unit-unreachable mutants: plant each by hand and run only the cited integration file, one per command, each alone after a CPU reading (GO given).

## Dead statement removed: a behaviour-preserving refactor (no red)

- Change: the callback is now `(result) => { return unconfirmed ?? result; }`. Nothing else changes. Biome: no fixes, no lint finding.
- Proof expected: all 15 unit rows green, unedited; the registration integration rows are not rerun for this (the coordinator's proof is the unit rows).
- The `close` range's last line moves up one. Read statically: `400-416`'s pair (`    close: () => {` / `  };`) no longer stands at distance 16; its first line stands only at 400, and `  };` stands at 70, 88, 209, 394, 415. Predicted `pnpm check:mutation-ranges`: exit 1, `STRYKER_RANGE_DRIFT`, one line `stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:400-416 drifted; first line found at 400, last line found at 70, 88, 209, 394, 415`. Then `close` is re-pointed to `400-415` (the same unit) with its anchor's text unchanged; `stryker.config.json` keeps 19 ranges (Q58: the real row is not edited).
- Predicted recount: `272-319` 38, `335-352` 12, `400-415` **17** (22 less the statement's 5: ConditionalExpression `true` and `false`, EqualityOperator `!==`, StringLiteral `""`, AssignmentOperator `&&=`) = **67**.
- Updated final prediction: 67 mutants; **55 killed** (56 less the `&&=` that row 6 killed), **12 survived** (the 7 accepted equivalents and the 5 unit-unreachable), **0 no coverage**; score 82.09, exit 0 (at or above the break of 80).

## Dead statement removed: observed

- `p3-s7-dead-statement-unit.log`: 15 passed, unedited. As predicted.
- `p3-s7-dead-statement-ranges-red.log`: exit 1, `STRYKER_RANGE_DRIFT`, exactly the predicted line. `close` re-pointed to `400-415` in `stryker.config.json` and `stryker-range-anchors.json` together (anchor text unchanged). `p3-s7-dead-statement-ranges-green.log`: exit 0, `stryker.config.json 19 ranges, 33 whole files`.
- Recount (`range-mutants.mjs`): `272-319` 38, `335-352` 12, `400-415` 17 = 67. As predicted.
- CodeScene `project-registration-preparation.ts`: 10. `pnpm typecheck` exit 0. `p3-s7-dead-statement-pnpm-check.log` (CPU 4/5/5 after two readings over the rule, 7/49/29 and 48/25/14, no game processes; it ran only after a third reading under it) exit 0, 3816 tests.

## The 5 unit-unreachable mutants, planted by hand in integration (user choice (b)): prediction, written before the runs

Each plant is backed up and restored by digest (`bind.sh`), and runs only its cited integration file, alone, after one CPU reading. The only rows in the two files that reach close's timeout answer are `registration-bootstrap-guards.integration.test.ts` "retains active creation as incomplete after close before publication" (a bootstrap still running at the budget) and `registration-preparation-lifecycle.integration.test.ts` "bounds close at the cleanup deadline and retains its uncertain result" (a preparation still running at the budget, no listing, no bootstrap).

- **u1, 347 `finally` `{}`** (the counter is never decremented), file `registration-bootstrap-guards.integration.test.ts`: predicted **survives** (exit 0). The counters are read only at the budget; the one row there has its bootstrap still running, so `bootstraps.running > 0` holds whether or not an earlier work was decremented, and each row builds its own owner, so no stale count crosses rows.
- **u2, 348 `-= 1` → `+= 1`**, same file: predicted **survives**, for the same reason.
- **u3, 405 `bootstraps.running > 0` → `false`**, same file: predicted **killed**, exactly 1 failure, "retains active creation as incomplete after close before publication" (the `close` case): close answers `pendingCleanup` (`OBSERVER_CLEANUP_UNCONFIRMED`; no listing runs) in place of `REGISTRATION_INCOMPLETE`.
- **u4, 407 `listings.running > 0` → `true`**, file `registration-preparation-lifecycle.integration.test.ts`: predicted **killed**, exactly 1 failure, "bounds close at the cleanup deadline and retains its uncertain result": close answers `pendingListing` (`broken`, `INTERNAL_FAILURE`) in place of `OBSERVER_CLEANUP_UNCONFIRMED`.
- **u5, 407 `>= 0`**, same file: predicted **killed**, the same row and answer as u4 (no listing runs, so `0 >= 0`).

If u1 and u2 survive as predicted, they are reported, and an integration row (c) waits for the coordinator's OK. Such a row would let a bootstrap complete, then close with another work still running past the budget, and expect `pendingCleanup`.

## The 5 planted mutants: observed (coordinator GO; each alone after one CPU reading; each restored to `68817a3f…0168`)

- **u1** (`p3-s7-plant-u1.log`, CPU 6/6/18): exit 0, 9 passed. **Survives**, as predicted.
- **u2** (`p3-s7-plant-u2.log`, CPU 2/26/4): exit 0, 9 passed. **Survives**, as predicted.
- **u3** (`p3-s7-plant-u3.log`, CPU 6/9/7): exit 1, exactly 1 failure, "retains active creation as incomplete after close before publication", which received `OBSERVER_CLEANUP_UNCONFIRMED` in place of `REGISTRATION_INCOMPLETE`. **Killed**, as predicted.
- **u4** (`p3-s7-plant-u4.log`, CPU 17/16/25 after one reading over the rule, 15/13/37): exit 1, exactly 1 failure, "bounds close at the cleanup deadline and retains its uncertain result", which received `{ status: "broken", code: "INTERNAL_FAILURE" }`. **Killed**, as predicted.
- **u5** (`p3-s7-plant-u5.log`, CPU 23/25/12): exit 1, the same row and the same answer. **Killed**, as predicted.
- So 405 and both 407 mutants are killed by existing integration rows that `stryker.config.json` does not run. 347 `finally` `{}` and 348 `+=` are killed by no row in the cited file: a stale counter shows only when a counted work has finished and close then times out on a different work. This is reported to the coordinator; an integration row (c) waits for the coordinator's OK.

## (c) row for 347 and 348: prediction, written before it runs (coordinator OK)

- Row in `registration-bootstrap-guards.integration.test.ts`, with the file's own `fixture()`, `gate()` and the file's `createWorkerLocalLibsqlClient` spy pattern: "answers cleanup unconfirmed when close outlasts a held operation after a completed creation".
  1. `f.owner.confirm(f.request)` completes, and its bootstrap registers (decoded by `RegisteredProjectSchema`), so the bootstrap counter went up and back down.
  2. Then the spy holds every application-database call made after that point at a gate (`execute` and `transaction` wait for `release`), and `f.owner.prepare(f.request.preparation)` starts: its first `write(readProposal)` waits at the gate (`entered`).
  3. With `setTimeout`/`clearTimeout` faked, `close()` starts: it is not settled at budget − 1 ms, and at the budget it answers exactly `{ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }` (no bootstrap running, no listing running).
  4. After the gate opens with real timers, the held `prepare` answers `{ status: "cancelled" }` (its replay is fenced after the abort).
  The only waits are the file's gate and the faked budget timer; no real sleep.
- Predicted on `f3c0eef`'s code, the file run alone: exit 0, **10 passed** (9 + 1).
- Its bite, each plant alone on this file: **u1** (`finally` `{}`) and **u2** (`-= 1` → `+= 1`) each fail exactly this row, with close answering `{ status: "pending-recovery", code: "REGISTRATION_INCOMPLETE" }` (a stale `bootstraps.running` above 0 picks `pendingCreation`). The other 9 rows pass.

## (c) row: observed

- First text: `p3-s7-c-row.log` (CPU 5/14/3) 10 passed, as predicted. Bite: `p3-s7-c-row-u1.log` and `p3-s7-c-row-u2.log` each failed exactly this row with `REGISTRATION_INCOMPLETE` in place of `OBSERVER_CLEANUP_UNCONFIRMED`, 9 passed; both restored to `68817a3f…0168`. As predicted.
- `check:duplicates` then failed (`p3-s7-c-duplicates.log`, exit 1): the row's 13-line "still open at budget − 1, settled at the budget" block was a token clone of the same block in "retains active creation as incomplete after close before publication". Fix in the new row only: it checks "still closing" with `Promise.race` against an already settled value, and uses `REGISTRATION_CLEANUP_BUDGET_MS - 1`. No other row changed. `p3-s7-c-duplicates-2.log`: 0 clones.
- Because the row's text changed after its runs, the row and its bite were run again on the final text (one CPU reading each; not a rerun to chase green): `p3-s7-c-row-2.log` (CPU 2/3/4) 10 passed; `p3-s7-c-row-2-u1.log` (CPU 5/13/2) and `p3-s7-c-row-2-u2.log` (CPU 23/11/12) each failed exactly this row with `REGISTRATION_INCOMPLETE`, restored to `68817a3f…0168`. The row is deterministic: its only waits are the gate on the held database calls and the faked budget timer; it passed on both runs.
- `pnpm typecheck` exit 0; `p3-s7-c-dead-code-2.log` knip exit 0; `p3-s7-c-pnpm-check.log` (CPU 6/4/13) exit 0, 3816 tests.
- **CodeScene on `registration-bootstrap-guards.integration.test.ts`: 9.57, not 10.** The two findings (Complex Method cc 10, Large Method 76 lines) are both on the existing row "Storage creation honors %s reservation authority without bypassing witnesses". The file at `a31a78b`, before the new row, scores the same 9.57 with the same two findings (read from a temporary in-repository copy, deleted afterwards); the new row adds no finding. Reaching 10 means refactoring that existing row, which the brief keeps unedited, so it goes to the coordinator before the final mutation.

## Existing row refactored to CodeScene 10 (user choice (b))

- **User-approved exception** to the brief's "integration files unedited" (relayed by the coordinator): the row "Storage creation honors %s reservation authority without bypassing witnesses" in `registration-bootstrap-guards.integration.test.ts` is refactored, test-only. The refactor's behaviour (P3-B39) was already proven on `f577e2c` with every integration file unedited (`p3-s7-registration-integration.log`, 26 files, 274 tests).
- Shape: three module-level helpers and one table. `reservedSeed(f, mode)` reads the reservation and builds the seed (same query, same "Reservation missing" throw, same digest rule). `createSeededStorage(f, seed)` creates through a fresh storage owner and always stops it. `expectRegistryAfter(f, mode, before)` holds the after-checks. `creationByMode` gives the expected creation answer per mode. Cases and order are unchanged: `exact`, `mismatched-digest`, `foreign-witness`.
- Expectations, before → after (same matcher, same expected value, same mode condition):

| # | Before | After |
|---|---|---|
| 1 | `expect(await f.peer(true).confirm(f.request)).toMatchObject({ status: "pending-recovery", code: "REGISTRATION_INCOMPLETE" })` | unchanged, in the row |
| 2 | `exact`: `expect(result).toMatchObject({ status: "ready", result: { status: "created" } })` | `expect(await createSeededStorage(f, seed)).toMatchObject(creationByMode[mode])`, with `creationByMode.exact` the same object |
| 3 | not `exact`: `expect(result).toMatchObject({ status: "ready", result: { status: "blocked", reason: "prior-state-witness", diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" } } })` | the same line; `creationByMode["mismatched-digest"]` and `["foreign-witness"]` are that object (`blockedByWitness`) |
| 4 | `exact`: `expect(f.rows("SELECT * FROM storage_generations")).toHaveLength(1)` | unchanged, in `expectRegistryAfter` |
| 5 | not `exact`: `expect(f.rows("SELECT * FROM storage_generations")).toEqual([])` | unchanged, in `expectRegistryAfter` |
| 6 | not `exact`: `expect(await readFile(…/application.db)).toEqual(before)` | unchanged, in `expectRegistryAfter` |
| 7 | `foreign-witness`: `expect(await readFile(witness, "utf8")).toBe("preserved unrelated bytes")` | unchanged, in the row |

- One ordering detail: the creation answer is now checked after `owner.stop()`, where before it was checked inside the `try`, before the `finally` stopped the owner. The answer is the same value either way, and the owner is stopped in both.
- CodeScene `registration-bootstrap-guards.integration.test.ts`: **10.0, no finding** (9.57 before). `pnpm typecheck` exit 0. Biome: no fixes.
- `p3-s7-witness-row-refactor.log` (CPU 6/8/3): the file alone, **10 passed**, exit 0. `p3-s7-witness-duplicates.log` 0 clones; `p3-s7-witness-dead-code.log` knip exit 0; `p3-s7-witness-pnpm-check.log` (CPU 8/15/14) exit 0, 3816 tests.

## Final scoped mutation on the last candidate: observed

- Coordinator GO. `p3-s7-mutation-final-2.log` on `3b7c84d`, CPU 8/12/6, no game processes, alone. Config `<scratchpad>/s7/stryker.p3-s7-final-2.json`: the base options (checked by `diff`), with `mutate` set to `272-319`, `335-352`, `400-415`. Report `p3-s7-mutation-final-2-report.json`.
- **Exit 0.** 67 mutants (initial run 59 tests, 28 s): **55 killed, 12 survived, 0 no coverage, 0 timeouts; score 82.09.** As predicted (67, 55, 12, 0, 82.09, exit 0).
- The 12 survivors are exactly the predicted set:
  - the 7 equivalents the coordinator accepted: 292:5 the left operand `true`, 292:5 the whole `false`, 292:5 `status !==`, 292:31 `""`, 293:29 `""`, 308:7 `{}` and 308:22 `""`. The 9 base no-coverage mutants are now covered, through row 7;
  - the 5 that unit rows cannot reach, each killed by an integration row that `stryker.config.json` does not run: 347:17 `finally` `{}` and 348:9 `+=` by the (c) row, 405:9 `false` by "retains active creation as incomplete after close before publication", and 407:13 `true` and `>= 0` by "bounds close at the cleanup deadline and retains its uncertain result".
- Base → final: 71 mutants at 63.38 (45 killed, 17 survived, 9 no coverage) → 67 at 82.09 (55 killed, 12 survived, 0 no coverage). The 4 fewer mutants are the removed dead statement's (its fifth, `&&=`, was killed by row 6 before the removal).

## Verifier round 1 (only round) on `7f74be5`: passed with warnings; coordinator decisions

- V1: an s7 entry in the brief's `## TDD Evidence (implement)`, append-only, with the approved changes that supersede the literal P3-B39 oracle; validate and restamp the brief.
- V2 (the fix over a residual): the listing range takes in the `listings` counter object, `335-352` → `333-352`, anchor first line `  const listings = { running: 0, pending: pendingListing };`; one scoped mutation of that range only.
- Polish: corrections appended below; nothing above is rewritten.

## Corrections to earlier entries (appended, the entries stay as written)

- The Bindings 2 to 4 prediction heading says the integration file has "21 rows"; it has **20** tests (as the binding 2 observation already notes).
- The structural check `git diff 6c18b2b --stat` lists the paths at `f577e2c` only. After the user's and the coordinator's later decisions, the slice's diff also holds `apps/harness/src/registration/project-registration-preparation.test.ts` (the 7 kill rows) and `apps/harness/tests/integration/registration-bootstrap-guards.integration.test.ts` (the (c) row and the approved witness-row refactor); `check-stryker-ranges.test.mjs` is still unchanged.
- The final-run accounting line ("The 4 fewer mutants are the removed dead statement's…") is wrong. The count went 71 at the base → 72 after the refactor (+1, the outer ArrowFunction of `tracked`) → 67 after the dead statement's removal, which took all **5** of its mutants (`true`, `false`, `!==`, `""`, and `&&=`, which row 6 had killed). So 71 − 5 + 1 = 67.

## V2 re-point: prediction, written before the edit and the runs

- Edit in two steps. Step 1: `stryker.config.json` `:335-352` → `:333-352`, and the anchor's `entry` to `:333-352`, with its first line still `  const tracked =`. Read statically: `  const tracked =` stands once (335) and the last line stands once (352), in order, with no pair at the new distance 19, so the resized rule names them. Predicted `pnpm check:mutation-ranges`: exit 1, `STRYKER_RANGE_DRIFT`, exactly one line `stryker.config.json: apps/harness/src/registration/project-registration-preparation.ts:333-352 moved to apps/harness/src/registration/project-registration-preparation.ts:335-352`.
- Step 2: the anchor's first line becomes `  const listings = { running: 0, pending: pendingListing };`. Predicted: exit 0, `stryker.config.json 19 ranges, 33 whole files` (Q58: the real row is not edited); `check-stryker-ranges.test.mjs` 41/41.
- Predicted recount: `272-319` 38, `333-352` **13** (12 + the `listings` ObjectLiteral `{}`; the comment line and the number `0` carry no mutant), `400-415` 17 = **68**.
- Predicted scoped mutation of `333-352` only: 13 mutants, **12 killed, 1 survived** (348 `-= 1` → `+= 1`, killed only by the (c) integration row), wait: also 347 `finally` `{}` survives for the same reason, so **11 killed, 2 survived**, 0 no coverage; the new `listings` ObjectLiteral is **killed** (with `{}`, `counter.pending` is `undefined`, so a listing whose cleanup failed records nothing, and "stays broken after a listing whose own cleanup failed (CNV-B37)" gets `{ status: "closed" }`). Score 84.62 under the range's own run.

## V2 re-point: observed

- Step 1 (`p3-s7-v2-ranges-red.log`): exit 1, `STRYKER_RANGE_DRIFT`, exactly the predicted line (`…:333-352 moved to …:335-352`).
- Step 2: the anchor's first line is now `  const listings = { running: 0, pending: pendingListing };`. `p3-s7-v2-ranges-green.log`: exit 0, `stryker.config.json 19 ranges, 33 whole files` (Q58; the real row is unedited). `p3-s7-v2-ranges-test.log`: 41/41.
- Recount (`range-mutants.mjs`): `272-319` 38, `333-352` 13, `400-415` 17 = **68**. As predicted.
- Scoped mutation of `333-352` only (coordinator GO; `p3-s7-v2-listing-mutation.log` on the working tree over `7f74be5`, CPU 3/2/1 after one reading over the rule at 43/14/4, alone; config `<scratchpad>/s7/stryker.p3-s7-v2-listing.json`; report `p3-s7-v2-listing-report.json`): exit 0, 13 mutants, **11 killed, 2 survived** (347 `finally` `{}` and 348 `+=`, both killed by the (c) integration row), 0 no coverage, score 84.62. The new `listings` ObjectLiteral (333:20) is **killed** by "stays broken after a listing whose own cleanup failed (CNV-B37)". As predicted (the prediction text first said 12/1, then corrected itself in place to 11/2 before the run; the 11/2 line is the prediction).

## Brief: s7 TDD Evidence entry (V1)

- Appended to the brief's `## TDD Evidence (implement)` after the s1-s3 entries: the record path, Pedro's decision to kill the 26, the coordinator's 7 accepted equivalents, the dead-statement deletion, the (c) integration row (Pedro's option (b) with the coordinator's OK), Pedro's witness-row exception, the verifier's V2, and that these approved changes supersede the literal P3-B39 oracle and the structural diff check.
- `append-only.mjs` against `approved-77e146f3.md`: `keep`. Stamped with `validate-artifact.mjs --finalizing --stamp`: **`content_hash 9cc682a858ed332161f20db7b9ec13560b9aa7e209f058475c513af61fd91c4a`** (was `77e146f3…7f2e`). A plain validation then answers `OK`. The validator's WARN lines all concern the s1-s3 Test Contracts and were there before.
- `p3-s7-v2-pnpm-check.log` (user's "livre", CPU 4%, no game processes): `pnpm check` exit 0, 3816 tests.
