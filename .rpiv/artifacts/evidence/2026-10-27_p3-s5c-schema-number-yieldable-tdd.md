# TDD record: p3-s5c-schema-number-yieldable

- Brief: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md`, content_hash `463b69bc…`; approved copy `approved-03af7b6d.md` (main checkout evidence folder). Append-only against it: clean (frontmatter plus the 2026-10-27 decision block only).
- Contract commit: `78ee5bb` (the brief alone), on `cdd2027`.
- Lane: normal. Decisions:
  - Q42 (a): return the error itself, no cast; stop if a site does not infer.
  - Q43 (a): `main.ts:129-131` is in; the structural check is multiline.
  - Q44 (b): new proposal-steps integration row.
  - Q45 (a): the desktop equality gap is deferred beyond Phase 3.
  - Q46 (a): the 7 `message` items stay advice.
  - Q47 (a): the `main.ts` desktop-s6 ranges go to s6; the shift is recorded here.
  - Q48 (a): no mutation.
- Evidence logs: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5c-*.log` (main checkout).

## Static prediction, written before any run

### Planned change

- `schemaNumber` (6 sites → `Schema.Finite`):
  - `canonical-command-registry.test.ts:218` (the `decodeTo` target), `:306`, `:328`;
  - `canonical-command-repository-faults.integration.test.ts:41`;
  - `conformance-counter-command.ts:763` `a` and `b`.
- `unnecessaryFailYieldableError`: `existing-registration.ts:56` → `return yield* corrupt`; `project-storage-upgrade-pipeline.ts:384` → `return yield* settled.failure`.
- The 5 non-generator sites return the error itself (Q42 (a)):
  - `conversation-rows.ts:78`: the ternary's failure arm becomes `new ConversationStorageBroken({ cause: rows.failure })`;
  - `conversation-save.ts:40`: `new ConversationStorageBusy({ cause: "The save was not committed." })`;
  - `application-database-authority.ts:278`: `orElse: () => new ApplicationDatabaseCloseUnconfirmed(closeDeadlineMs)`;
  - `harness-supervisor.ts:207`: `return new HarnessShutdownTimeout();`;
  - `main.ts:129-131`: `error ? new WriterProofReportFailed({ message: "…" }) : Effect.void`. It collapses to one line, so every later `main.ts` line moves by −2 (Q47 (a): recorded below; `stryker.desktop-s6.config.json` is not edited).
- Each site's error type must come from inference: a `YieldableError` is an `Effect<never, this>`. A site that needs a cast stops the slice.

### Test shape

- **P3-B31**, `src/canonical-command-registry.test.ts`, 3 new rows. Each goes through `defineCanonicalCommand(...).prepare(...)`, whose decode is `decodeStrictResult(payloadSchema, payload)` (`canonical-command-registry.ts:84-94`):
  - (a) the `:212` "delivers schema-transformed numeric output" definition, `prepare("Infinity")` → `toEqual({ status: "rejected", rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false } })`, and its handler is not called;
  - (b), (c): a table over `payloadSchema` (`counterPayloadSchema`): `{ value: 1, meta: { a: Infinity, b: 1 } }` and `{ value: 1, meta: { a: 1, b: -Infinity } }` → each `toEqual` that rejection.
- **P3-B32**:
  - `project-storage-upgrade-failure.integration.test.ts:267`, unchanged;
  - (d) new `tests/integration/registration-proposal-steps.integration.test.ts`:
    - setup: a fresh root with `consentRegistryOptions(root)`, the registry migrated by `withRegistrationDatabase(options, async () => undefined)` (`initialize-or-open`, because `inspectProposal` opens with `existing-only`), and a fake `ProposalOwner` whose `prepare` resolves `{ status: "prepared", proposalFingerprint: "f".repeat(64) }` and whose `confirm` is a `vi.fn`;
    - `Effect.runPromise(createProposalSteps({ owner, options }).prepare(request))`, with a `step: "prepare"` request of fresh UUIDs, → `toEqual({ status: "broken", code: "REGISTRY_CORRUPT" })`, and `confirm` is not called;
    - cleanup: `stopStandaloneAuthority(options)`, then remove the root.
- **P3-B33**: the guard rows, unchanged:
  - `conversation-rows.test.ts:61` (12 rows);
  - `conversation-uncertain-commit.integration.test.ts:47`;
  - `application-database-authority.test.ts:36` (3 rows);
  - `harness-supervisor.test.ts:615`, `:1102`.

### Prediction at the base (`78ee5bb`, tests added, source unchanged)

- (a), (b), (c): **red, 3 failed**. `Schema.Number` accepts `±Infinity`, so each answers `status: "ready"`: `expected { status: 'ready', run: [Function] } to deeply equal { status: 'rejected', … }`. The existing `prepare("7")` row stays green. The other rows in the file stay green.
- (d): **green** at the base (a new guard). An empty `registration_proposals` makes `readProposal` answer `undefined`, `:56` fails with `corrupt`, and `inspect` catches the `RegistryReadFailed` and maps it with `failureOf(registryCorruptFailure)`. A red here is a finding to report.
- The guard rows: green.

### Green at the candidate

- (a), (b), (c) green, so `canonical-command-registry.test.ts` has 0 failed. (d) green. Every guard row green.
- Effect read: **7 diagnostics, 0 warnings** (`schemaNumber` 0, `unnecessaryFailYieldableError` 0, `anyUnknownInErrorContext` 0, `extendsNativeError` 0), **7 `message`** (the same 7), **no `error`**.
- Structural check: `rg -n -U "Effect\.fail\(\s*new " apps packages` gives 5 matches at the base and **0** at the candidate. `rg -n "Effect\.fail\((corrupt|settled\.failure)\)" apps/harness/src` gives 0.

### Bindings (one per command, applied by hand on the candidate, restored by digest)

1. `canonical-command-registry.test.ts:218` back to `Schema.Number` (run: that file). **1 failed**: (a), answering `ready`.
2. `conformance-counter-command.ts:763`:
   - **2a**, `a` back to `Schema.Number` (run: the registry test file). **1 failed**: (b).
   - **2b**, `b` back to `Schema.Number`, applied separately. **1 failed**: (c).
3. The `return yield* settled.failure` line at `project-storage-upgrade-pipeline.ts:384` deleted (run: `project-storage-upgrade-failure.integration.test.ts`). A failed declared upgrade then reaches `return settled.success`, which is `undefined`, and no longer answers or rejects with its failure. **15 failed**:
   - the 8 `discardedRows` "injected failure at <checkpoint>" (`rejects.toThrow`);
   - "failure during the switch" (broken);
   - the 2 `busyRows` (`busy`);
   - `:267` "a source changed before the switch stays quarantined";
   - the 2 `brokenSourceRows` (source verification throws `ProjectStorageBrokenError` inside a step);
   - `:368` "a busy staged copy is discarded at the next opening" (runs on win32).
   - Green: the backup-fault and staged-copy-fault rows that answer a `failed` result (backup and staged-copy faults, a success value), "keeps a committed switch when a later step fails" (it fails after `:384`) and "upgrades once when two calls race".
   - This file's integration run may take more than 2 minutes. I ask for the GO before I run it.
4. `conversation-rows.ts:78` failure arm → `Effect.succeed([])` (run: `conversation-rows.test.ts`). **12 failed**: every `it.each` row (4 tables × 3 spellings) reads `refused` as a success.
5. `application-database-authority.ts:278` `orElse` → `Effect.void` (run: `application-database-authority.test.ts`). **6 failed**:
   - the 3 rows "rejects an unconfirmed close at the deadline" (state `resolved`, not `rejected`, at `deadline`);
   - "confirms a close that drains…: after an unconfirmed stop" (`rejected` expected at 1 000 ms);
   - "closes a never-stopped authority when its scope closes": "never stopped, lease held" (`dies` expected) and "stopped, unconfirmed" (`prepareNetRow` expects `rejected`).
6. `conversation-save.ts:40` → `new ConversationStorageBroken({ cause: "The save was not committed." })` (run: `conversation-uncertain-commit.integration.test.ts`). **How `:40` is reached:**
   - `saveConversationMessage` (`conversation-save.ts:47-56`) runs `reconcileSave` only when the save answers `commit-uncertain`;
   - `:40` is the reconciliation finding no saved row.
   - Predicted **2 failed**, both on `failedWith("ConversationStorageBusy")`:
     - `:47` "reconciles an uncertain commit by its save id: known client state": the commit is blocked by a reader, so it is uncertain, and the save is not found;
     - `:145` "releases a truly broken client that holds its write lock, then a switch (U1)": commit, rollback and close fail, so the commit is uncertain; the read-only reconciliation finds no save.
   - `:145` is inferred, not traced to the line. Binding 6 decides both.
   - If either row stays green, I report it. I add no row without a decision.
7. `harness-supervisor.ts:207` → `return Effect.void;` (run: `harness-supervisor.test.ts`, desktop main config). **2 failed**:
   - "kills after grace and rejects after the terminal exit deadline" (`:615`);
   - "stops forwarding when a stopping child never exits" (`:1102`).
   - Both reach `expectShutdownTimeout` with a resolved outcome.
8. `existing-registration.ts:56` → `return { proposal, existing: { status: "none" } } as const` with `proposal` undefined (run: the new proposal-steps file). **1 failed**: (d). `preparedOutcome` → `proposalResult` reads `proposal.proposalId` on `undefined`, and the `prepare` Effect dies with a `TypeError`.

### `main.ts` range shift (Q47 (a), recorded, not edited)

- `stryker.desktop-s6.config.json:16-19` holds `main.ts:96-106`, `123-139`, `294-323`, `441-441`.
- Collapsing `:129-131` removes 2 lines inside `123-139`; `294-323` and `441` each move by −2 in the code they hold. The exact text before and after is recorded after the change.
- s6's range-alignment check owns them.

### Gates

- Guards as in the brief's Success Criteria. The integration guards also take the files that import `conformance-counter-command.ts`, listed by `rg` before the run.
- `pnpm typecheck` exit 0. `pnpm check` exit 0; the advisory-warning wording is recorded as observed.
- CodeScene 10 on every touched file; jscpd 0; knip clean. No mutation (Q48 (a)).

## Observed (appended after the runs; the prediction above is unchanged)

- Coordinator: prediction accepted. Two additions:
  - **B8b** (raise-only): `:56` yields a different registry fault, so (d) fails on its `toEqual`, not by a crash. B8 and B8b are both recorded.
  - Name the row that reaches `main.ts:129-131`. If no row does, stop before the green.
- Test edit for (a): the `:212` definition moved into a helper, `transformedNumberCommand(handle)`, which the existing "delivers schema-transformed numeric output" row and the new (a) row share. The existing row's assertions are unchanged; its `expect(payload).toBe(7)` runs inside the helper's `handle`.
- Base, with the tests added and the source unchanged (CPU 6-19%):
  - `p3-s5c-base-unit.log`: `canonical-command-registry.test.ts` 3 failed | 75 passed. (a), (b) and (c) are red, each `expected { Object (status, run) } to deeply equal { status: 'rejected', …(1) }`. As predicted.
  - `p3-s5c-base-integration.log`: **invalid run.** The integration config excludes `tests/integration/registration-*.test.ts` (`No test files found`, exit 1). The file belongs to `vitest.registration.config.ts`, the registration files' config.
  - `p3-s5c-base-registration.log`: under that config, 1 passed. (d) is green at the base. As predicted.
- **`main.ts:129-131` reaching row: none.**
  - `writeWriterProofReport` (`main.ts:124`) is called only at `main.ts:171`, in the package-smoke writer proof.
  - `:129-131` runs only when that proof's `process.stderr.write` calls back with an error.
  - No unit or desktop main test imports `main.ts`. The package smoke runs only the success path.
  - STOP before the green, as the coordinator asked. The rewrite and bindings have not run.

### Pedro's decision on `main.ts:129-131` (relayed by the coordinator; the brief is not edited)

- `writeWriterProofReport` and `WriterProofReportFailed` are extracted, unchanged, into `apps/desktop/src/main/writer-proof-report.ts` (named exports). `main.ts` imports it for its one call (the former `:171`), and drops its `Data` import.
- New unit file `apps/desktop/src/main/writer-proof-report.test.ts` (desktop main project, run from the repository root). `process.stderr.write` is spied and calls back:
  - with no error → `Result.succeed(undefined)`, and `write` is called once with the report text;
  - with an `Error` → the failure is `instanceof WriterProofReportFailed`, `_tag` is `"WriterProofReportFailed"`, `message` is `"Writer proof terminal reporting failed."`, `Object.hasOwn(failure, "cause")` is `false`, and `write` is called once.
- Row before the Q42 rewrite, on the extracted module (`p3-s5c-writer-report-extracted.log`): 2 passed. It is green on value identity, as (d) was: the row is a guard, and the rewrite keeps the same instance.
- Added bindings, predicted before running (one per command):
  - **B8b**: `:56` yields `new RegistryReadFailed({ failure: { status: "unavailable", code: "REGISTRY_BUSY" } })`. **1 failed**, (d) on its `toEqual` (the answer becomes `{ status: "unavailable", code: "REGISTRY_BUSY" }`).
  - **B9**: the writer report fails with a different message. **1 failed**: the error row, on `message`.
  - **B9b**: the writer report error arm → `Effect.void`. **1 failed**: the error row, on `Result.isFailure`.

### Green (candidate in the worktree, uncommitted)

- `pnpm typecheck` (`p3-s5c-typecheck.log`): exit 0. Every Q42 site infers its error type with no cast; there is no stop under Q42 (a).
- `p3-s5c-green-unit.log`: registry, conversation-rows and authority unit, 101 passed. (a), (b) and (c) are green.
- `p3-s5c-green-registration.log`: (d) passed.
- `p3-s5c-green-desktop.log`: `harness-supervisor` and `writer-proof-report`, 41 passed.
- Effect read (`p3-s5c-effect-read.log`, `effect-advisory-p3-s5c-candidate.json`): **7 diagnostics, 0 warnings**, 7 `message` (the same: `unnecessaryEffectGen` 2, `preferUnsafeConstructor` 2, `runOfExitToRunExit` 1, `flatMapConditionalToFilterOrFail` 2), no `error`. As predicted.
- Structural checks:
  - `rg -n -U "Effect\.fail\(\s*new " apps packages` → 0 lines (base 5);
  - `rg -n "Effect\.fail\((corrupt|settled\.failure)\)" apps/harness/src` → 0.

### Light bindings (one per command, each restored by digest)

- B1 (`p3-s5c-binding-1.log`): 1 failed, (a). As predicted.
- B2a (`p3-s5c-binding-2a.log`): 1 failed, (b). As predicted.
- B2b (`p3-s5c-binding-2b.log`): 1 failed, (c). As predicted.
- B4 (`p3-s5c-binding-4.log`): 12 failed (12 of 12). As predicted.
- B5 (`p3-s5c-binding-5.log`): 6 failed, the 6 predicted rows. As predicted.
- B7 (`p3-s5c-binding-7.log`): 2 failed, `:615` and `:1102`. As predicted.
- B8 (`p3-s5c-binding-8.log`): 1 failed, (d), `TypeError: Cannot read properties of undefined (reading 'proposalId')`. As predicted.
- B8b (`p3-s5c-binding-8b.log`): 1 failed, (d), on its `toEqual`: `expected { status: 'unavailable', …(1) } to deeply equal { status: 'broken', …(1) }` (`REGISTRY_BUSY` against `REGISTRY_CORRUPT`). As predicted.
- B9 (`p3-s5c-binding-9.log`): 1 failed, the error row: `expected 'Writer proof report failed.' to be 'Writer proof terminal reporting faile…'`. As predicted.
- B9b (`p3-s5c-binding-9b.log`): 1 failed, the error row: `expected false to be true` (`Result.isFailure`). As predicted.

### Gates so far

- CodeScene 10 on `main.ts`, `writer-proof-report.ts`, `writer-proof-report.test.ts`, `harness-supervisor.ts`, `canonical-command-registry.test.ts`, `registration-proposal-steps.integration.test.ts`, `conversation-rows.ts`, `existing-registration.ts`, `project-storage-upgrade-pipeline.ts`, `application-database-authority.ts`, `conformance-counter-command.ts` and `canonical-command-repository-faults.integration.test.ts`.
- `conversation-save.ts`: CodeScene answers no score (`{"score":null,"review":[]}`; "Could not determine Code Health score"). The file holds only `const` arrow and `Effect.fn` bodies; the base copy cannot be scored outside the repository. Recorded, not 10.
- `pnpm check:duplicates` (`p3-s5c-duplicates.log`): 0 clones. `pnpm check:dead-code` (`p3-s5c-dead-code.log`): exit 0 (knip is clean with the new module).
- Still to run, heavy, waiting for the GO:
  - B3 (`project-storage-upgrade-failure`, integration config);
  - B6 (`conversation-uncertain-commit`, native-long config);
  - the integration guard batch;
  - `pnpm check` (CPU rule).

### Heavy runs (coordinator GO; each run alone; CPU rule)

- The coordinator dropped the full integration and native-long guard batch: `check:deep` runs it at the push.
- `p3-s5c-green-upgrade-failure.log` (CPU 21-25%): the upgrade-failure file on the candidate, 31 passed, 34.6 s.
- B3 (`p3-s5c-binding-3.log`): **15 failed | 16 passed**, exactly the 15 predicted rows. As predicted.
- `p3-s5c-green-uncertain-commit.log` (native-long config, CPU 15-22%): 8 passed, 35.9 s.
- B6 (`p3-s5c-binding-6.log`): 2 failed, `:47` "known client state" and `:145` "U1". These are the 2 predicted rows, but the binding is **invalid as a bite**.
  - Both rows fail with `ReferenceError: ConversationStorageBroken is not defined`. `conversation-save.ts` imports only `ConversationStorageBusy`, and the binding did not add the import.
  - What it does prove: `:40` is evaluated in both rows, so both reach it, including the inferred `:145`.
  - What it does not show: a failure on the `failedWith("ConversationStorageBusy")` assertion.
  - Restored by digest. A corrected binding, **B6v2**, adds the import to the same swap, and is predicted to fail the same 2 rows on their assertion. It waits for the coordinator's GO.
- `pnpm check` (`p3-s5c-pnpm-check.log`, CPU 7-20%): exit 0. Its output reads **"Effect diagnostics verified; 0 advisory warnings."**, with 117 files and 3763 tests (3758 plus 3 registry rows plus 2 writer-report rows).
- The coordinator accepted that `conversation-save.ts` has no CodeScene score; the null result is recorded.
- B6v2 (`p3-s5c-binding-6v2.log`; coordinator GO; run once, alone; CPU 10-13%): the same swap, with `ConversationStorageBroken` imported. **2 failed | 6 passed**, `:47` and `:145`, each on its assertion: `expected { status: 'completed', …(1) } to match object { status: 'completed', …(1) }` (`failedWith("ConversationStorageBusy")`). As predicted. Restored by digest.

### Candidate

- `36337c5` fix: retire the schema number and yieldable error forms (p3-b31 to p3-b33), on `78ee5bb`. Patch: `p3-s5c-candidate-36337c5.patch`.
- lint-staged Biome changed nothing (`git diff --stat a3ec9d8 36337c5 -- apps` is empty).
- `lane.mjs --range 78ee5bb..36337c5`: `normal` ("files: 9 > 5").
- `slice-preflight.mjs` (`p3-s5c-preflight.log`): exit 1, **findings**:
  - `untouched-test-file: P3-B32 …project-storage-upgrade-failure.integration.test.ts`;
  - `untouched-test-file: P3-B33 …conversation-rows.test.ts`.
  - Both are by design. The approved contract names these files' rows as unchanged guards for value-identity rewrites ("Expected red: none"). Their bite is shown by B3 (15 rows) and B4 (12 rows), not by a test edit.
- **`main.ts` range shift (Q47 (a), corrected).** The prediction said −2, from collapsing `:129-131`. Pedro's extraction instead moved the whole `writeWriterProofReport` and its class out of `main.ts` (−18 lines net, +1 import line). The `stryker.desktop-s6.config.json` ranges, mapped by an equal-line diff `78ee5bb` → `36337c5`:
  - `96-106` → `97-107` (+1, the new import);
  - `123-139`: its start (`:123`, inside the removed block) no longer exists; its end → `:121`;
  - `294-323` → `276-305` (−18);
  - `441` → `423` (−18).
  - They are not edited. s6's range-alignment check owns them.
- `git diff cdd2027 --stat`: 14 files. They are the brief's affected paths, the new `writer-proof-report.ts` and its test (Pedro's decision), the new `registration-proposal-steps` file (Q44 (b)), and the brief.

## Verifier round 1 (slice-verifier, candidate mode, on `36337c5`, base `78ee5bb`)

- Result: **passed, no violations, 2 warnings.** Cross-slice WARNING (V1), Decisions WARNING (V2), Research OK.
- Hypotheses refuted:
  - A returned `YieldableError` evaluates to `exitFail(this)`, exactly as `Effect.fail` does, in `flatMap`, `timeoutOrElse.orElse`, `suspend` and `callback`.
  - No consumer feeds a non-finite number to `meta` or to `sqliteScalars`.
  - The extraction is clean for knip, dependency-cruiser, coverage and the bundle.
- **V1 (Cross-slice, warning).**
  - At `4cf6541`, `stryker.desktop-s6.config.json:17` (`main.ts:123-139`) began exactly at `function writeWriterProofReport` (`main.ts:123-135` there).
  - **That unit now lives at `apps/desktop/src/main/writer-proof-report.ts:8-18`, tested by `apps/desktop/src/main/writer-proof-report.test.ts`.** It is in no `mutate` list, and its test is not in `apps/desktop/vitest.desktop-s6-mutation.config.ts`.
  - s6's range-alignment check must follow it across files: re-point the range to `writer-proof-report.ts:8-18` and add the test to the s6 mutation Vitest config. Otherwise it would realign the range to `reportUnconfirmedWriterProof`'s leftover lines and silently drop the unit from mutation.
  - The verifier's alternative: do that re-pointing in s5c (a narrow Q47 (b)), with two config lines and an instrumenter count.
- **V2 (Decisions, warning).**
  - The integration guard batch has no run on the candidate: `canonical-command-repository-faults` and the `conformance-counter-command` importers. The coordinator deferred it to `check:deep` at the push.
  - `conversation-save.ts` has no CodeScene score: an instrument gap, not a 10.
  - The deferral is an explicit acceptance condition: `check:deep` before push must run the faults file and every `conformance-counter-command` importer.
- needs-run: `canonical-command-repository-faults.integration.test.ts` plus every integration file that imports `conformance-counter-command.ts`, on `36337c5`. It settles V2; the coordinator decides whether it runs now or in `check:deep`.
- Polish:
  - The brief's Q47 (a) "−2 line shift" is stale after the extraction; this record corrects it.
  - Two `not.toHaveBeenCalled` assertions (`canonical-command-registry.test.ts:246`, `registration-proposal-steps.integration.test.ts:41`) are vacuous, as the contract specified.
  - The temp-root prefix `"p3-s5c-proposal-steps-"` names a slice ID, not a domain term.

## V1 fix and V2 deferral (coordinator decisions after verifier round 1)

- **V1, fixed now.** This follows Pedro's extraction; it does not reopen Q47.
  - `stryker.desktop-s6.config.json`: `apps/desktop/src/main/main.ts:123-139` → `apps/desktop/src/main/writer-proof-report.ts:8-18`.
  - `apps/desktop/vitest.desktop-s6-mutation.config.ts` adds `apps/desktop/src/main/writer-proof-report.test.ts`.
  - The other `main.ts` ranges stay for s6 (Q47).
- Text match (`p3-s5c-s6-realign.log`):
  - `4cf6541` `main.ts:123-135`, the unit the range was written for, against the candidate's `writer-proof-report.ts:8-18`, differ only by `export` and the Q42 rewrite (`Effect.fail(new …)` → `new …`).
  - At `78ee5bb` the old range had drifted by 1. It held a blank line, the unit (`:124-136`), and the first lines of `reportUnconfirmedWriterProof`.
- Instrumenter count (`p3-s5c-s6-realign.log`): old `main.ts:123-139` at `78ee5bb` **6** → `writer-proof-report.ts:8-18` **5**.
  - The 5 unit mutants are the same before and after: 3 `BlockStatement`, 1 `ObjectLiteral` and 1 `StringLiteral` on the report message.
  - The 1 dropped is `main.ts:139` `StringLiteral` → ``` `` ```, the template text of `reportUnconfirmedWriterProof`. The original `4cf6541` range also reached into that function's first 3 lines (`:137-139`).
  - That template leaves the s6 mutation set with this re-point. Its function is outside the brief's affected units; s6's alignment check owns it, unless the coordinator decides otherwise.
- Dry run of `stryker.desktop-s6.config.json` (`p3-s5c-stryker-dryrun-desktop-s6.log`; coordinator GO; run alone; CPU 4-8%): exit 0, **8 source files** (7 plus `writer-proof-report.ts`), **218 mutants**. The initial run passed with 317 tests.
- **V2, deferred as an explicit acceptance condition.** The integration guard batch runs in `check:deep` before the push and must cover:
  - `canonical-command-repository-faults.integration.test.ts`;
  - every integration file that imports `conformance-counter-command.ts` (`active-project-coordinator-real-commands`, `canonical-command-driver`, `canonical-command-repository`, `canonical-project-activation`, `canonical-project-settlement`, `canonical-project-switch`, `canonical-writer-reconciliation`, `harness-runtime-real-commands`, `project-storage-lifecycle`, and the files that use its fixtures).
  - The `conversation-save.ts` CodeScene null stays an instrument gap, not a 10.
