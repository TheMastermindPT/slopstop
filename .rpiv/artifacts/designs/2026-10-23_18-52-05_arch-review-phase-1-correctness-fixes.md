---
date: 2026-10-23T18:52:05+0100
author: Pedro Mesquita
commit: 7d04277
branch: main
repository: slopstop
topic: "Architecture review Phase 1, quick correctness fixes: L4-01, L4-02, L4-03, L3-01, L1-04, L5-01, L5-05, L5-06, L6.1-01, L6.1-02, L1-11, L8-02"
tags: [design, architecture-review, polish, registration, observer-recovery, failure-classification, writer-fence, sentry, privacy, likec4]
parent: .rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md
lane: normal
lane_reasons: ["no upstream lane", "s2 lane.mjs --paths: files: 13 > 5"]
status: in-review
last_updated: 2026-10-23T20:30:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Pedro's decisions appended (Q1 a, Q2 a, Q3 a, Q4 a); brief approved from f8987631. Earlier: lean brief written; two slices; Q1-Q4 open."
content_hash: a5f8e982962cd31b868bf7c1554eaa093e9a54d9fcff3fe5ebc70ba3de5c80d9
---

# Design: Architecture review Phase 1, quick correctness fixes

The feature lane is **normal**: the parent review carries no lane, so the "no upstream lane" default applies.
- **s1:** `lane.mjs --paths` answers `fast` ("within fast limits"). A slice never runs below its feature, so s1 runs **normal**.
- **s2:** `lane.mjs --paths` answers `normal` ("files: 13 > 5").
- **What normal means here:** a linked worktree per slice, no intent review (Pedro, §144: proportional process), slice-verifier at candidate review with **one** candidate review round, a full deep review, and Pedro's acceptance of the combined result.

## Intent

**Outcome.** Twelve small defects stop reporting wrong outcomes:
- a registration stuck forever after a harness kill (L4-01);
- transient failures shown as corruption or as bugs (L4-02, L4-03);
- a shutdown failure that loses its code (L3-01);
- a privacy leak path to Sentry (L1-04);
- a write-authority check weaker than its sibling (L5-01);
- tests whose oracles cannot fail (L5-05, L5-06);
- two hidden duplications (L6.1-01, L6.1-02);
- an unlogged window failure (L1-11);
- an architecture model that misstates the code (L8-02).

**Scope.** Phase 1 of the review's Consolidated polish plan. Pedro accepted it as the plan (decisions log §144, "Aceitar as fases como plano"). Each finding's section in the parent review is authoritative for its evidence. This brief owns the behavior contracts.

**Non-goals.**
- Phase 2-6 findings, including L4-04 (decode-or-corrupt everywhere) and L6.1-03 (two busy classifiers). Phase 3 owns failure classification as a whole. Phase 1 fixes only the three named misclassifications.
- New registration recovery states beyond what the existing reconcilers already prove (see Q2).
- Changing which Sentry events are sent, other than removing native minidump uploads.
- The ADR on where domain behavior lives (L8-02 remediation 2; see Q4).

**Constraints.**
- AGENTS.md:
  - Safety And Privacy: nothing with local paths or process memory goes to Sentry.
  - Effect Usage: touched harness code follows the rules.
  - Test Discipline: red-green through public seams.
- `degrade-distinguishes-broken`: busy, internal and corrupt stay three distinct answers.
- `shared-vocab-union`: one fence reader; one metadata projection.

## Architecture

### s1, harness registration recovery (L4-01, L4-02, L4-03)

**L4-01: wire the restart reconciler.** `createRegistryObserverJournal(...).reconcileObservers(absence?)` (`observer-journal.ts:286-292`) settles unsettled observation rows. It settles rows with durable terminal proof, and rows whose recorded child is proven absent by the Windows absence port (`windows-observer-absence.ts:80`). Today only tests call it (11 test calls; review L4-01; verified at `7d04277`).

The production composition of registration is `projectRegistrationLayer` (`process-bootstrap.ts:274-313`). The observer's admission check, `hasUnsettled()`, refuses every registration while any row is unsettled (`project-registration-observer.ts:131-133`).

The slice adds one call: `registry.reconcileObservers(createWindowsObserverAbsencePort())`, inside the Layer, after `createRegistrationRegistry` and before the Layer returns. The runtime accepts no message before its Layers are built, so the reconciliation finishes before admission opens. Its outcome:
- `settled`: registration is admitted normally.
- `pending-recovery`, `REGISTRY_BUSY` or broken: the harness still starts. The admission gate keeps answering `OBSERVER_CLEANUP_UNCONFIRMED` (or the registry failure), exactly as today. So a failed reconciliation is never reported as clean, and never blocks Projects or Conversations. Placement and the failure policy are **Q1**.
- On a platform other than `win32`, the port is not passed, so only terminal proof is reconciled. The product is Windows-only today.

What the reconciler cannot settle: an observation whose intent was committed but whose child row was never recorded. `reconcileAbsentOwners` and `queryChildIsSettled` both need a child identity (`observer-journal.ts:72`, `:258-262`). A kill in that short window still leaves registration refused. That is the existing safety rule: absence that cannot be proven is never assumed. Whether to accept that as a named residual is **Q2**.

**L4-02: narrow the receipt check's catch.** `readPublication` (`registration-confirmation-store.ts:311-328`) wraps decode, agreement and the SQL reads of `receiptGenerationAgrees` (`:335-359`, including `upgradeChainFor`) in one `catch { throw corrupt(); }`. After the fix:
- Decode and agreement failures stay `REGISTRY_CORRUPT`.
- A SQL execute failure propagates unchanged to the callers' `registryFailure` (`registry-failure.ts:31-40`): busy or locked gives `REGISTRY_BUSY`; any other error gives `broken / INTERNAL_FAILURE`; a `RegistryFault` or `ApplicationDatabaseFault` keeps its own failure.

The mechanism is the implementer's choice (separate the reads from the decode, or classify in the catch). The contract fixes the three outcomes.

**L4-03: typed conflict.** In `prepareExecutable` (`registration-registry.ts:121-122`), a reused `selectionId` with a different `executablePath` throws `new RegistryFault({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" })`, the same failure as the sibling `decideVersion` (`:142-146`). The return type already allows it: `RegistryFailure` includes `RegistrationIdempotencyConflictSchema` (`registry-failure.ts:9-20`). The flow maps it through `failureOf` (`project-registration-flow.ts:110-113`).

### s2, mixed correctness polish

**L3-01: typed release failure on stop.** `stop` (`active-project-coordinator.ts:657-666`) throws a plain `Error` and drops `result.code` (a `CanonicalProjectActivationDiagnosticCode`, `:149-155`). After the fix:
- `stop` fails with a tagged error `CanonicalProjectReleaseFailed` (a `Data.TaggedError`, AGENTS.md Effect Usage) that carries `code`.
- The retry rule (`stopOnce`, `:668-669`) is unchanged.
- The s9 fatal summary already names a valid `_tag` (`process-fatal-diagnostics.ts:80-87`), so the shutdown fatal line names the tag. Whether it also names the code is **Q3**. Under Q3 (a), the summary entry for this tag gains `code`, taken from the protocol's activation diagnostic codes. That extends `HarnessFatalLogLineSchema` from #133 (the same pattern as `parts` for `RegistrationCleanupUnconfirmed`), and the desktop forwarder rows decode it.

**L1-04: no native minidumps.** `Sentry.init` (`crash-reporting.ts:99-103`) gets `integrations: (defaults) => defaults.filter(...)`, removing the integration named `SentryMinidump`.
- `@sentry/electron` 7.16.0's default main-process list starts with `sentryMinidumpIntegration()`, which uploads native crash dumps outside `beforeSend`. Context7 `/getsentry/sentry-electron`, MIGRATION.md "Disable Native Crash Reporting" and `src/main/sdk.ts` `getDefaultIntegrations`.
- `attachScreenshot` stays unset.
- The `vars` and context lines are already stripped by `sanitizeFrame` (`crash-reporting.ts:35-47`).

**L1-11: observed window creation on activate.** `reopenWindowWhenNoneIsOpen` (`main.ts:458-462`) handles a rejected `createActiveWindow()`:
- It logs one `error` on the main logger, `{ code: "DESKTOP_WINDOW_CREATE_FAILED" }`, with "Window creation failed.". There is no message text or path.
- It does not exit. The app stays up, and the next `activate` tries again.

To make this testable without importing the side-effecting entry (review L1-10), the reopen rule moves to a small `apps/desktop/src/main/window-reopen.ts` with injected `windowCount`, `create` and `logger`. `main.ts` wires it.

**L5-01: one fence reader.** `verifyFence` (`canonical-command-repository.ts:489-508`) reads through `readCanonicalWriterFence` (`canonical-command-ledger.ts:93-120`) with the same coherence rule as settlement: project ids, generation and digest equality, `activatedAt` equal to `generationAcquiredAt`, and a coherent release. The outcomes:
- An incoherent fence row now fails the check: `CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED")`, through its existing catch. It is broken, not stale.
- A coherent row that is not this writer's current fence stays `stale`.
- No fence row stays `stale`.

The ledger reader takes a transaction, while `verifyFence` reads outside one (`this.owner.client`). The reader widens to `Pick<LocalLibsqlClient, "execute">`, the same pattern as `readFenceRows` (`:165-167`). `priorFence` (`:186-215`) keeps `readFenceRows` for now (Deferred Work), so its errors do not change in this phase.

**L5-05 and L5-06: oracles that can fail.**
- **L5-05:** the two rows at `canonical-writer-reconciliation.integration.test.ts:703` and `:718` use the shared helper that pins `WRITER_FENCE_ACTIVATION_FAILED` (`canonical-writer-recovery-fixture.ts:153`).
- **L5-06:** `toBeTypeOf("function")` assertions (12 sites at `7d04277`, across 10 files) and the `not implemented` guard (1 site, `canonical-command-repository-faults.integration.test.ts:196`) are deleted where they only held during the red phase. A site that guards a real export contract may stay, but only if it is rewritten to call the function and assert a behavior.

**L6.1-01: a recognizer, not a message comparison.** `project-storage-errors.ts:10` gets a `ProjectStorageOpeningReleaseFailedError` (a subclass of `ProjectStorageBrokenError` with the same message). Its two constructions (`project-storage-store.ts:702`, `project-storage-upgrade-pipeline.ts:179`) use it. The shutdown unwrapping (`project-storage-store.ts:147`) recognizes it with `instanceof`. No `error.message ===` comparison remains in `apps/harness/src/storage`.

**L6.1-02: one metadata projection.** The build verification (`project-storage-database-build.ts:122-139`) calls `expectedOpeningMetadata` and `openingMetadataAgrees` (`project-storage-opening.ts:248-275`; the latter is exported). The `databaseKind` mapping is the implementer's, with the existing build tests as the oracle.

**L8-02: the model states what is.** `docs/architecture/model.c4` changes in three places:
- **Kernel** (`:34-35`): "Framework-independent domain types: branded identities and pure Effect Schema data. Domain behavior lives in harness storage today."
- **Protocol** (`:39`): technology "TypeScript, Effect Schema" (Zod is not a dependency; AGENTS.md TypeScript).
- **Canonical store** (`:44`): technology "node:sqlite (worker), Drizzle schema and migrations". Evidence: `local-libsql-worker-client.ts:128` requires `node:sqlite`, and `drizzle-orm` and `drizzle-kit` are in `apps/harness/package.json:21,28`. The old "libSQL" client contract stays only as an internal name.

## Decisions

- **D1. Two slices.**
  - s1 holds the three registration findings, which share one owner and its integration fixtures.
  - s2 holds the other nine. They are small and independent, and one candidate review covers them at low cost.
  - Rejected: one slice. The L4-01 restart proof is the only heavy item, and it would hold up the review of nine unrelated fixes. Also rejected: a slice per finding, which would mean twelve review rounds for about 14 files.
- **D2. L4-01 runs at Layer build** (Q1 (a) recommended). The runtime opens admission only after the Layer is built. A failure keeps today's gate answer and never fails the harness start.
- **D3. L4-02 and L4-03 keep the existing vocabulary.** No new codes; `REGISTRY_BUSY`, `INTERNAL_FAILURE`, `REGISTRY_CORRUPT` and `REGISTRATION_IDEMPOTENCY_CONFLICT` all exist.
- **D4. L5-01: an incoherent fence is broken, not stale.** This follows `degrade-distinguishes-broken`: a fence row that contradicts itself is a broken invariant, and "stale" would ask the caller to retry against corrupt authority.
- **D5. L1-04: minidumps are disabled, not scrubbed.** AGENTS.md forbids paths and memory in Sentry, and a minidump cannot be redacted field by field. Native crash triage is lost while consent and a DSN are set. The review's alternative (keeping minidumps with a separate consent) is deferred.
- **D6. L1-11: log, no exit.** The activate path happens after startup, so exiting would kill a running app over a window. The log line carries a code only.
- **D7. Heavy runs, sized to the change** (Pedro, 2026-10-23; §144).
  - s1: the new L4-01 restart integration file, plus the L4-03 row in `project-registration.integration.test.ts` filtered by name, run **once at the candidate** with the coordinator's GO.
  - s2: the touched integration files (`canonical-writer-reconciliation.integration.test.ts`, `canonical-command-repository.integration.test.ts`, `canonical-command-repository-faults.integration.test.ts`), once at the candidate.
  - Neither slice touches the e2e, smoke or packaging surface. `main.ts` only moves the activate rule. So the full `test:integration`, e2e and `package:smoke` run in `check:deep` before the push.
  - No mutation run, because these are polish fixes; Pedro may ask for a scoped one.
- **D8. Approach check: not run.** This follows Pedro's proportional process, as in #105 and #133. It can run on request.

## Next Slice

### Slice p1-s1-registration-recovery (detailed 2026-10-23)

- `slice_id`: `p1-s1-registration-recovery`. Lane: **normal**. `lane.mjs --paths` says `fast` over 7 planned files, raised to the feature lane, normal.
- Base: main `7d04277`.
- Behaviors: P1-B1..P1-B3.
- Source paths:
  - `apps/harness/src/process-bootstrap.ts` (`projectRegistrationLayer`);
  - `apps/harness/src/registration/registration-confirmation-store.ts`;
  - `apps/harness/src/registration/registration-registry.ts`.
- Test paths:
  - new `apps/harness/tests/integration/registration-restart-reconciliation.integration.test.ts` (with a peer script, following `registration-storage-upgrade-kill.integration.test.ts:26-57`);
  - `apps/harness/tests/integration/project-registration.integration.test.ts`;
  - new `apps/harness/src/registration/registration-confirmation-store.test.ts`.
- Dependencies: none beyond main.

### Test Contract: p1-s1-registration-recovery

Public seams:
- the harness runtime through its transport port (AGENTS.md foundation seam), built by `launchHarnessProcessRuntime(roots, { transport, logger })` (`process-bootstrap.ts`);
- the registry through `createRegistrationRegistry` (`registryAt` in the integration fixtures);
- the confirmation store's exported `readPublication`, which two modules use (`existing-registration.ts:63`, `registration-confirmation-store.ts:211`), driven with a recording fake transaction.

- **Behavior P1-B1 (L4-01):** after a harness killed mid-query restarts, registration is admitted again.
  - Test: `admits registration after a harness killed mid-query restarts` → the new integration file.
    1. A peer Node process runs a registry version observation with a real Git child (`createWindowsVersionChild`) and reports over IPC once the child row is recorded.
    2. The parent kills the peer. A fresh `registryAt(root).hasUnsettled()` answers `true` (precondition).
    3. The parent then builds the production runtime on the same roots with a recording transport and waits for it to be ready.
    - Oracles: a fresh `registryAt(root).hasUnsettled()` answers `false`. The first registration request through the transport that reaches observer admission (the git-version inspection step with an accepted consent) answers anything **except** `{ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" }`. The settled outcome row is `{ status: "broken", code: "INTERNAL_FAILURE", reconciliation: "exact-owner-absence" }`, or the terminal-proof form when the child's terminal was recorded.
  - Test: `starts and keeps the gate closed when reconciliation cannot settle` → same file. The unsettled row's child is still alive (held, not killed), so the absence probe answers present. The runtime still starts (ready), and the admission request answers `OBSERVER_CLEANUP_UNCONFIRMED`.
  - Expected red: the first test's admission request answers `OBSERVER_CLEANUP_UNCONFIRMED` and `hasUnsettled()` stays `true`. The second test is a pin.
- **Behavior P1-B2 (L4-02):** a SQL failure while checking a receipt keeps its own class.
  - Test: `classifies a receipt check failure: $name` → `registration-confirmation-store.test.ts`, `it.each`. A fake transaction answers the publication row and the reservation's agreeing receipt, then:
    - throws an error with code `SQLITE_BUSY` on the `storage_generations` query → `readPublication` rejects, and `registryFailure(rejection)` equals `{ status: "unavailable", code: "REGISTRY_BUSY" }`;
    - throws a plain `Error("I/O")` there → `{ status: "broken", code: "INTERNAL_FAILURE" }`;
    - answers a generation row for another project → `{ status: "broken", code: "REGISTRY_CORRUPT" }`;
    - stores a receipt JSON that does not decode → `REGISTRY_CORRUPT`.
  - Expected red: the first two rows answer `REGISTRY_CORRUPT`. The last two are pins.
- **Behavior P1-B3 (L4-03):** a conflicting executable selection is a client conflict.
  - Test: `rejects a reused selection with another executable path` → `project-registration.integration.test.ts`. `prepareExecutable` with path A answers `prepared`; the same `selectionId` with path B answers exactly `{ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" }`; the same id with path A again answers `prepared` (replay).
  - Expected red: the second call answers `{ status: "broken", code: "INTERNAL_FAILURE" }`.

### Success Criteria: p1-s1-registration-recovery

- Red then green for each behavior with the smallest Vitest command, then `pnpm check`.
- Once at the candidate, with the coordinator's GO (D7): the new restart integration file, and `project-registration.integration.test.ts -t "reused selection"`.
- Bindings, each restored by digest:
  - removing the Layer call makes P1-B1's first test fail;
  - restoring the bare catch makes P1-B2's busy row fail;
  - restoring the plain `Error` makes P1-B3 fail.
- CodeScene `code_health_score` on every changed source file (target 10).

### Slice p1-s2-correctness-polish

- `slice_id`: `p1-s2-correctness-polish`. Lane: **normal** (`lane.mjs --paths`, "files: 13 > 5").
- Base: s1's gate-passed candidate.
- Behaviors: P1-B4..P1-B12.
- Source paths:
  - `apps/harness/src/active-project-coordinator.ts`;
  - (Q3 (a)) `apps/harness/src/process-fatal-diagnostics.ts`, `packages/protocol/src/harness-fatal-log-protocol.ts`;
  - `apps/desktop/src/main/crash-reporting.ts`, `apps/desktop/src/main/main.ts`, new `apps/desktop/src/main/window-reopen.ts`;
  - `apps/harness/src/storage/canonical-command-repository.ts`, `apps/harness/src/storage/canonical-command-ledger.ts`;
  - `apps/harness/src/storage/project-storage-errors.ts`, `apps/harness/src/storage/project-storage-store.ts`, `apps/harness/src/storage/project-storage-upgrade-pipeline.ts`;
  - `apps/harness/src/storage/project-storage-database-build.ts`, `apps/harness/src/storage/project-storage-opening.ts`;
  - `docs/architecture/model.c4`.
- Test paths: the tests named in each behavior.

### Test Contract: p1-s2-correctness-polish

- **Behavior P1-B4 (L3-01):** a failed stop carries its release code.
  - Test: `fails stop with the release code: $code` → the coordinator's unit test (`active-project-coordinator.test.ts`, the existing release-failure fake), `it.each` over `WRITER_FENCE_STALE` and one retryable code.
    - `stop()` rejects with a value whose `_tag` is `"CanonicalProjectReleaseFailed"` and whose `code` is the fake's code.
    - A second `stop()` retries the release, as today.
  - Test (Q3 (a)): `summarizes a release failure with its code` → `process-fatal-diagnostics.test.ts`: the summary of that error is `{ failures: [{ tag: "CanonicalProjectReleaseFailed", code: "<code>" }], omittedFailures: 0 }`.
  - Test (Q3 (a)): `harness-fatal-log-protocol.test.ts` gets these rows:
    - the line with `code` decodes;
    - an unknown `code` fails;
    - `code` on any other tag fails.
  - The `harness-log-lines.test.ts` forward row includes the `code`.
  - Expected red: the rejection is a plain `Error` with no `_tag` or `code`.
- **Behavior P1-B5 (L1-04):** no native crash dump upload is configured.
  - Test: `initializes Sentry without native minidumps` → `crash-reporting.test.ts` (the captured init options, `:65`). The `integrations` option is a function. Given `[{ name: "SentryMinidump" }, { name: "ElectronBreadcrumbs" }, { name: "MainProcessSession" }]`, it returns the last two in order. `attachScreenshot` is not `true`. `beforeSend` is still the sanitizer.
  - Expected red: `integrations` is `undefined`.
- **Behavior P1-B6 (L1-11):** a failed reopen is logged, not unhandled.
  - Test: `logs a failed window reopen` → new `window-reopen.test.ts`. With zero windows and a `create` that rejects, the rule logs exactly one `error` `({ code: "DESKTOP_WINDOW_CREATE_FAILED" }, "Window creation failed.")` and leaves no unhandled rejection.
  - Test: `opens no window while one exists`: with one window, `create` is not called.
  - Test: `opens a window when none exists`: `create` is called once, and nothing is logged.
  - Expected red: the module does not exist. After extraction with `void`, the first test sees no log.
- **Behavior P1-B7 (L5-01):** the fence check refuses an incoherent fence.
  - Test: `fails the fence check on an incoherent fence: $name` → `canonical-command-repository.integration.test.ts` (with `canonical-command-repository-fixture.ts`), `it.each`. Rows: `activated_at` differs from the generation's `acquired_at`; the generation row's `project_id` differs. Each rejects with `CanonicalCommandRepositoryError` code `WRITER_FENCE_CHECK_FAILED`.
  - Pins: a coherent current fence answers `{ status: "current" }`; a coherent fence of another generation answers `{ status: "stale" }`; no row answers `stale`.
  - Expected red: the incoherent rows answer `{ status: "current" }`.
- **Behavior P1-B8 (L5-05):** both recovery-refusal rows pin the code.
  - The rows at `canonical-writer-reconciliation.integration.test.ts:703` and `:718` assert through the shared helper (`code: "WRITER_FENCE_ACTIVATION_FAILED"`).
  - Binding: changing the guard's code in the source makes both rows fail (restored by digest). Expected red: none, test strengthening.
- **Behavior P1-B9 (L5-06):** no red-phase scaffolding oracle remains.
  - `rg -n 'toBeTypeOf\("function"\)|not implemented' apps/harness -g '*.ts'` finds no remaining site, except any rewritten to assert behavior (listed in the slice evidence with a reason).
  - Exempt from red-green: deleting a non-failing assertion changes no behavior.
- **Behavior P1-B10 (L6.1-01):** shutdown recognizes the variant by type.
  - Test: `unwraps an opening release failure at shutdown by type` → `project-storage-store.test.ts`. A `ProjectStorageOpeningReleaseFailedError` is unwrapped as today. A `ProjectStorageBrokenError` with the same message text but not that type is **not** unwrapped.
  - Plus `rg -n 'error\.message ===' apps/harness/src/storage` finds nothing.
  - Expected red: the plain error with the same message is unwrapped.
- **Behavior P1-B11 (L6.1-02):** one opening metadata projection.
  - The existing build tests stay green unchanged. `project-storage-database-build.ts` contains no inline `formatVersion`, `schemaVersion` or `lastMigrationId` projection of the manifest.
  - Exempt from red-green: a refactor under existing oracles.
- **Behavior P1-B12 (L8-02):** the architecture model matches the code.
  - `pnpm check:architecture` passes. `model.c4` contains no "Zod" and no "libSQL" technology, and the kernel description says "domain types", not behavior. Checked at review.

### Success Criteria: p1-s2-correctness-polish

- Red then green for each behavior that has an expected red, then `pnpm check`.
- Once at the candidate, with the coordinator's GO: the touched integration files (D7).
- Bindings as listed per behavior.
- CodeScene on every changed source file.
- **Manual (Pedro, at the combined acceptance):** none needed beyond reading the `model.c4` diff. L1-04 cannot be exercised without a DSN and consent, so the unit test is its proof.

## Deferred Work

- **`priorFence` onto the shared fence reader** (L5-01, second reader). Trigger: Phase 3 (failure classification), which owns the change in its thrown errors.
- **Minidumps with separate consent and scrubbing** (L1-04 alternative). Trigger: a native crash that cannot be triaged without a dump.
- **The domain-behavior ADR** (L8-02 remediation 2). Trigger: Phase 6 commands, or Q4 (b).
- **Recovery of an intent with no recorded child** (if Q2 (a)). Trigger: a real stuck registration reported as `OBSERVER_CLEANUP_UNCONFIRMED` after a crash.

## Verification Notes

- **Risk: the Git child survives the peer kill.** P1-B1's main row needs the observer's Job to end the child when the peer dies. If it does not, the absence probe answers present and the row fails for an honest reason. In that case the implementer stops and reports; the test is never weakened (AGENTS.md "Do not weaken a gate").
- **Risk: L4-01 reconciliation adds startup time.** It runs one write transaction plus one absence probe per unsettled row. In the normal case (no unsettled rows) it runs one transaction. It is not measured here; it is checked at the candidate's dev launch.
- **Risk: L5-01 changes a write-path answer.** An incoherent fence was previously `current`, so a writer could proceed. It is now broken. No production row can be incoherent unless the database is corrupt, which settlement already refuses. So this aligns the two checks and blocks no valid writer. P1-B7's pins guard the valid cases.
- **Baseline counts at `7d04277`:** `toBeTypeOf("function")` 12 sites (the review counted 13 at `e2ef472`); `not implemented` 1 site (review: 4).
- Evidence folder: `.rpiv/evidence/2026-10-23_18-52-05_arch-review-phase-1-correctness-fixes/`.

## Developer Context

- 2026-10-23, the coordinator relayed Pedro's choice (§144): Phase 1 next, as a lean brief, with slices only where they help, the lane per slice, a proportional process, and the L4-01 restart test planned once at the candidate. A push with `check:deep` was running on main, so no test was run for this brief. Every source fact was read at `7d04277`.
- Open questions for Pedro, with recommendations:
  - **Q1. Where and how the L4-01 reconciler runs.**
    - (a) **Recommended:** once, at the registration Layer build, before admission opens. A failed or partial reconciliation does not fail the start and keeps today's gate answer.
    - (b) The same, but a reconciliation failure fails the harness start.
    - (c) Lazily, on each admission check that finds unsettled rows. That retries for free, but it runs next to a live observation of the same process, which needs its own proof.
  - **Q2. A kill before the child row is recorded.** The intent row exists, and the child identity does not.
    - (a) **Recommended:** accept it as a named residual. Absence cannot be proven without an identity, and assuming it would break the existing safety rule. The window is short.
    - (b) Design a recovery now, for example a bounded wait plus a Job-name probe. This is a new recovery state and widens s1.
  - **Q3. Logging the release code on a failed shutdown (L3-01).**
    - (a) **Recommended:** the summary entry for `CanonicalProjectReleaseFailed` gains `code`, from the protocol's activation diagnostic codes. This extends the #133 fatal schema, the same way `parts` already works. It meets the finding's acceptance ("a failed stop logs its release code").
    - (b) Tag only. The log says a release failed but not why. The acceptance is then met only in part, as a named residual.
  - **Q4. L8-02's ADR.**
    - (a) **Recommended:** now, only correct `model.c4` to the facts; the ADR waits for the Phase 6 trigger.
    - (b) Write the ADR in this phase. It is a real decision (does domain behavior move to the kernel?), which Pedro would have to make now.
- **2026-10-23, Pedro's decisions (AskUserQuestion in the coordinator's session, relayed by coordenador-claude):** Q1 (a), Q2 (a), Q3 (a), Q4 (a). Pedro approved the brief with these choices applied, from the stamped copy `f8987631bd70…`. What they settle:
  - Q1 (a): the reconciler runs once at the registration Layer build, before admission opens. A failed or partial reconciliation keeps today's gate answer and never fails the start (Architecture s1, D2, P1-B1 as written).
  - Q2 (a): a kill after the intent is committed and before the child row is recorded stays refused (`OBSERVER_CLEANUP_UNCONFIRMED`). It is a **named residual** of s1, named at acceptance; its recovery stays in Deferred Work with its trigger.
  - Q3 (a): the summary entry for `CanonicalProjectReleaseFailed` gains `code`, from the protocol's activation diagnostic codes. That extends `HarnessFatalLogLineSchema` (#133). The P1-B4 rows marked "(Q3 (a))" and the s2 source paths marked "(Q3 (a))" are part of the contract.
  - Q4 (a): s2 corrects only `model.c4` (P1-B12). The domain-behavior ADR waits for the Phase 6 trigger (Deferred Work).
  - The lane stays normal for both slices. This approval covers document intent only. Build authority and the workspace (a linked worktree per slice) are agreed at `/rpiv:implement`.
- **2026-10-23, P1-B1 placement change (coordinator decision, option (A), disclosed to Pedro; keeps Q1 (a)):**
  - Found at the P1-B1 green: the harness builds its Layers synchronously. `launchHarnessProcessRuntime`'s `start` calls `runtime.runSync`, and four `process-bootstrap.test.ts` rows call `runtime.runSync` on `harnessServicesLayer`. Awaiting `reconcileObservers` inside `projectRegistrationLayer` made the Layer async: `AsyncFiberError`, and the runtime never started. Awaiting `runtime.context()` before `start` instead broke 6 existing rows. That attempt was reverted.
  - Placement now:
    - The Layer forks the one reconciliation in its scope (`Effect.forkScoped`), so the Layer stays synchronous.
    - The observer's admission port (`reconciledAdmission`) awaits that fiber's exit before `registry.hasUnsettled()`. Admission still never opens before the reconciliation ends, and the start, Projects and Conversations are never delayed.
    - A failure, a defect, or an interruption at shutdown ends the fiber. Admission then reads the journal itself, so unsettled rows keep `OBSERVER_CLEANUP_UNCONFIRMED`: never a startup failure, never a silent "settled".
  - A new installation (no `application.db`) is not reconciled, because it has no journal and reconciling would create its database at start. Found through `process-bootstrap.test.ts` "unsubscribe throws": a stop during an in-flight reconciliation over that row's made-up roots reported the reconciliation's failure.
  - Added row (coordinator requirement): `keeps the gate answer when the start's reconciliation fails`, in the restart file. An injected absence fault makes the reconciliation broken over a row it would otherwise settle; admission answers `OBSERVER_CLEANUP_UNCONFIRMED` and the row stays unsettled.
  - Residual: the other observer-unsettled gates (`authorizeQueries` in `repository-trust.ts`) do not wait for the start's reconciliation. During its few milliseconds they may still answer `OBSERVER_CLEANUP_UNCONFIRMED`: a retryable gate answer, never a wrong success.
- **2026-10-23, s1 fix round 1 (slice-verifier round 1 on `a275c51`: V1 violation, V2-V4 warnings; coordinator decisions, Pedro decided V2):**
  - **V1:** the start's reconciliation no longer goes through the registry's tracked runner. Before, a stop that overlapped it awaited its rejection, which happens on any unsettled row, probe error, busy or corrupt journal, and reported `RegistrationCleanupUnconfirmed` / `HARNESS_SHUTDOWN_FAILED`. `registry.reconcileAtStart` now runs `reconcileObservers` untracked, and the Layer forks it.
    - Row: `stops cleanly while the start's reconciliation is still running`.
    - Red: `dispose()` rejected with `parts: ["registry"]`. Then green.
  - **V2 (Pedro: "Fazer as duas esperarem"):** both unsettled-observer gates wait for the same one reconciliation before their transaction. They are the observer admission (`hasUnsettled`) and the trust authorization (`admitRepositoryIdentityQueries`, which runs `authorizeQueries`). The wait lives in the registry, which owns the start reconciliation's `Deferred`. This replaces the bootstrap admission adapter, and the earlier residual line above no longer holds.
    - A failed reconciliation still never fails the start, and the gates then read the journal, so unsettled rows keep `OBSERVER_CLEANUP_UNCONFIRMED`.
    - Row: `holds trust authorization until the start's reconciliation ends`.
    - Its first red attempt (holding the absence probe inside the reconciliation's transaction) passed with no gate change. The application database authority admits one write transaction at a time, so the authorization already queued behind it.
    - The red was observed by holding the reconciliation's entry check before the write permit (the existing `lstatIfPresent` seam): the authorization answered `pending-recovery / OBSERVER_CLEANUP_UNCONFIRMED`. Then green.
  - **New-installation skip (kept):** with no `application.db`, there is no journal and nothing to reconcile, so the start does not create the database.
  - **V4 (`degrade-distinguishes-broken`):** a reconciliation that answers anything other than `settled` or `pending-recovery`, or that rejects, logs one warning `{ code: "REGISTRATION_RECONCILIATION_FAILED" }` through the process logger, with no path or message value. The desktop forwards only known upgrade and fatal lines, so this line stays in the harness log. Rows 2 and 3 of the restart file assert the warnings: none for `pending-recovery`, one for a broken reconciliation.
  - **V3:** `-t "reused selection"` reran green at the fix-round content. The Verification Notes dev-launch startup check is skipped (coordinator: dev mode renders blank, #137). It is a **named residual**.
  - **Corrections to the 2026-10-23 placement entry:**
    - "the start, Projects and Conversations are never delayed" is overstated. Their first write on the shared application database authority can queue behind the reconciliation's one write transaction, for milliseconds.
    - "an interruption at shutdown ends the fiber" is overstated too. The fiber is interrupted at runtime dispose, after the stop program, and its untracked transaction is not cancelled.
- **2026-10-24, s2 (`p1-s2-correctness-polish`) implementation notes:**
  - **P1-B7 oracle change (Pedro approved option (a), AskUserQuestion in the coordinator's session; follows D4):**
    - With the settlement reader, four existing rows of `canonical-command-repository-writer-state.integration.test.ts` (`verifyStaleCases` rows 2-5) are incoherent fences: fence `writer_generation=2` with no generation 2; a fence-only token digest; a fence-only release; a fence-only `released_at`. They no longer answer `stale`; they reject with `WRITER_FENCE_CHECK_FAILED`.
    - Row 1 (the fence of another Project, so no row for this Project) stays `stale`.
    - The file joins s2's scope and its candidate run, which is now four integration files.
  - **P1-B9 count:** the `not implemented` assertions were 4, not 1: three in `canonical-command-fixture.ts` and one in the faults file. All were deleted. The `toBeTypeOf("function")` sites were 12; none was kept. One of them (`workspace-application.test.ts`) only referenced a function that carries `@ts-expect-error` type checks; it is now referenced with `void`.
  - **P1-B11 oracle gap:** no existing test asserts the build's "metadata disagrees with the manifest" branch. The refactor stays under the agreeing-path oracles only.
  - **P1-B4:** the protocol owns `CANONICAL_PROJECT_RELEASE_FAILURE_TAG`, and the coordinator's error uses it. The fatal summary echoes a `code` only when it is one of the protocol's activation codes; any other value is dropped, never echoed.
  - **P1-B6:** the reopen rule is an Effect in `window-reopen.ts`, and `main.ts` runs it at the `activate` edge with the desktop logger.
  - **CodeScene:** `crash-reporting.ts` was 9.68 at the base (a complex conditional in `initializeCrashReporting`). The consent and DSN check moved to `consentedDsn`, which brings it to 10.
- **2026-10-24, s2 candidate review (slice-verifier, candidate `e3baa87`): passed, no violations. Coordinator: no code fix round.**
  - **P1-B7 Expected red correction:** at the base, not every incoherent row answered `current`, so the Expected red and the Verification Notes overstate it. The generation-belongs-to-another-Project row and writer-state `verifyStaleCases` rows 2-5 answered `stale`; the TDD log records it. Either way, the base gave an answer where the settlement reader now rejects.
  - **Reader parameter:** `readCanonicalWriterFence` widened to `Pick<LocalLibsqlTransaction, "execute">`, not `Pick<LocalLibsqlClient, "execute">` as the slice text says. The two are type-compatible for this use.
  - **P1-B9 count correction:** the 12 deleted `toBeTypeOf("function")` sites are 9 typeof-throw pairs, 2 `Reflect.get` guards and 1 `void` reference. The TDD log's "11 pairs" is wrong; the count above (12 sites) holds.
  - **Commits:** the slice is two commits (`24c1f94` and the test-only `e3baa87`); the coordinator squashes them at integration.
  - **Known test limit:** the fatal summary unit test builds the release failure as a plain `{ _tag, code }` object, not the `CanonicalProjectReleaseFailed` class; the two join through those field names only.
  - **Cross-slice V1 (warning):** main's `c11ac74` and `262c5e5` touch files s2 edits (`canonical-command-repository-fixture.ts`, `project-storage-store.test.ts`), and s2's P1-B7 rows newly import that fixture. No run covers the combined result. The coordinator runs the four D7 integration files, `check:duplicates` and `pnpm check` on the squashed tree, then `check:deep` (full `test:integration`) before the push.

## References

- Parent: `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md`, sections L4-01, L4-02, L4-03, L3-01, L1-04, L5-01, L5-05, L5-06, L6.1-01, L6.1-02, L1-11, L8-02, and "Consolidated polish plan > Phase 1".
- Decisions log `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §144.
- Evidence `.rpiv/artifacts/evidence/2026-09-13_pc-s1-implementation.md` (the 2026-09-20 entry: "final application startup wiring is not delivered here").
- #133 design `.rpiv/artifacts/designs/2026-10-23_16-18-47_harness-desktop-log-link.md` (the fatal schema that Q3 (a) extends).
- Sentry Electron docs via Context7 `/getsentry/sentry-electron` (MIGRATION.md "Disable Native Crash Reporting"; `src/main/sdk.ts` `getDefaultIntegrations`).
- Standing decisions: `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`.
