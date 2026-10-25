---
date: 2026-10-25T12:24:03+0000
author: Pedro Mesquita
commit: b94f302
branch: main
repository: slopstop
topic: "Architecture review Phase 3, failure classification and diagnostics: L6.1-03, L4-04, L5-04, L3-02, the 51 Effect advisory warnings and their promotion, Phase 2 residuals R2, R6, R8"
tags: [design, architecture-review, polish, failure-classification, diagnostics, effect, registration, ledger, log-link]
parent: .rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md
lane: normal
lane_reasons: ["no upstream lane", "s1 lane.mjs --paths: files: 8 > 5"]
status: in-review
last_updated: 2026-10-25T14:00:00+0000
last_updated_by: Pedro Mesquita
last_updated_note: "Follow-up: Pedro approved 30f2f102; Q1-Q9 decided (Q3 normal + scoped ledger mutation; Q6 three normal overrides)."
content_hash: 83000262558e6f63ea52659a293e1e6af2003f8da1a1ef49902914da6dd5e6ee
---

# Design: Architecture review Phase 3, failure classification and diagnostics

The feature lane is **normal**. The parent review has no lane of its own, so the "no upstream lane" default applies.

- **s1:** `lane.mjs --paths` over the 8 planned source paths answers `normal` (`files: 8 > 5`).
- **Other slices:** each slice has its own `Lane:` line, from `lane.mjs --paths` over its planned paths (table under Deferred Work).
- **What normal means:**
  - no intent review (Pedro, §144: a proportional process);
  - slice-verifier at candidate review, with one candidate round;
  - a full deep review;
  - Pedro accepts the combined result.

> **Measured figures.** The Effect warning counts come from the run of 2026-10-25 at `b94f302`. It used `effect-tsgo diagnostics --format json --list-files` on the canary and the four packages, in the main checkout, with the coordinator's GO, and took 9 s. The output is in `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/effect-*.json`.
> - The total is still **51**, but it is **47 in `apps/harness` + 4 in `apps/desktop`**. §143 said "all in `apps/harness`" with 20 `extendsNativeError`; the measured split is 16 in the harness and 4 in the desktop.
> - Kernel and protocol have 0.
> - The canary matches its planted set (exit 1, as designed).

## Intent

**Outcome.**
- Busy, broken and corrupt are each decided once, by one owner, so the same fault gets the same answer on every path.
- A failure that the harness turns into `HARNESS_INTERNAL_FAILURE` leaves one redacted line in the desktop log.
- The four advisory Effect rules reach a count of 0 and are then promoted to `error`, so `pnpm check:effect` blocks any new hit.

**Scope.**
- **The four review findings (Phase 3):**
  - **L6.1-03:** two busy classifiers;
  - **L4-04:** decode-or-REGISTRY_CORRUPT re-implemented about 20 times;
  - **L5-04:** 14 ledger refusals that throw untyped `Error`, under an oracle that accepts any `Error`;
  - **L3-02:** request-boundary catches that drop the cause (and IX-8, no diagnostics port).
- **Pedro's decisions §143 and §144:**
  - resolve every hit of the four advisory rules (`anyUnknownInErrorContext`, `extendsNativeError`, `schemaNumber`, `unnecessaryFailYieldableError`);
  - then promote the four rules to `error`, only once the count is 0;
  - any deliberate exception is a named per-line waiver that Pedro approves.
- **Phase 2 residuals homed here** (`slopstop-p2/.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/phase-2-residuals-and-amendments.md`):
  - **R2:** `decodeProposalRecord`/`corruptProposal`, `readReservation` and `findCommonReservation` throw `RegistryFault` in Promise code;
  - **R6:** `project-registration-preparation.ts` has CodeScene 8.03;
  - **R8:** the `identity-query-journal.ts` `noDispatch` clock site has no row of its own.

**Non-goals.**
- Migrating registration from Promise code to Effect: that is #123 Part B (the line is drawn under Architecture).
- Phase 5 (SQL plumbing and writer authority): it folds into Part B (§144).
- L4-02 and L4-03 (registration receipt/idempotency verdicts): both are Phase 1.
- L3-01 (coordinator stop drops the release code): Phase 1. This phase gives the dropped code a place to land, but does not re-fix L3-01.
- L6.1-04 (three Node error-code readers): not in Phase 3.
- No change to an issue message, code or envelope protocol version. Precedent `43bc303`: keep every distinct code and message.

**Constraints.**
- AGENTS.md "Effect Usage (effect 4)": typed errors, no bare `throw` in Effect code, plain functions for pure logic.
- `degrade-distinguishes-broken`: a broken case never reports clean.
- `shared-vocab-union`: one owner, proven identity first.
- Sentry/privacy rule: log lines carry tags, codes and counts only, never paths, messages or causes.
- Risk callout from the review: before moving a classifier, list every comparison site with `rg`. Precedent `e55b35b`: one missed consumer.

## Architecture

### Failure classification (s1, L6.1-03)

Today there are two owners with six consumers:
- `storage/sqlite-busy.ts:8` `isSqliteBusy` covers exact `SQLITE_BUSY`/`SQLITE_LOCKED` only, with no cause walk. Its consumers are `registration/registry-failure.ts:37` (→ `REGISTRY_BUSY`) and `conversation/conversation-errors.ts:18` (→ `ConversationStorageBusy`, decision G7).
- `storage/project-storage-node-errors.ts:56` `isBusyStorageError` covers `ProjectStorageUnavailableError`, or any code that `isUnavailableStorageError` accepts, with a walk down `.cause`:
  - the exact codes `EACCES`, `EPERM`, `EBUSY`;
  - the code families `SQLITE_AUTH|BUSY|CANTOPEN|IOERR|LOCKED|PERM|READONLY`, `_*` extensions included.
  - Its consumers are the upgrade verification (`:107`), recovery (`:104`), pipeline (`:485`) and node adapter (`:562`).

The two do not disagree by accident. They answer two different questions:
- **busy:** lock contention, so retry soon;
- **retryable for the upgrade:** busy, or unavailable (Windows file locks, access and I/O), so the staged upgrade waits rather than abandons.

**Proposed shape (Q1 (a)):**
- `project-storage-node-errors.ts` already owns `storageErrorCode`, `isCorruptStorageError` and `isUnavailableStorageError`. It becomes the one module for the four named predicates:
  - `isSqliteBusy` moves here unchanged;
  - `isUnavailableStorageError` stays unchanged;
  - `isBusyStorageError` is renamed `isRetryableStorageError`, because it means busy-or-unavailable, cause included;
  - `isCorruptStorageError` stays unchanged.
- `sqlite-busy.ts` is deleted.
- No consumer changes its verdict.

**Comparison and reference sites** (`rg -n "isSqliteBusy|isBusyStorageError|sqlite-busy" apps packages stryker*.json`, at `b94f302`):
- 2 imports of `isSqliteBusy`;
- 4 imports of `isBusyStorageError` and 1 test;
- `apps/harness/vitest.conversation-mutation.config.ts:11` (includes `sqlite-busy.test.ts`);
- `stryker.conversation.config.json:10` (mutates `sqlite-busy.ts`).

The two config sites are the `e55b35b`-type consumers: if they are missed, the conversation mutation run silently loses the busy predicate. The literal SQLite codes are compared only in `project-storage-node-errors.ts:18-29`, `sqlite-busy.ts:10` and the worker's base-code table (`local-libsql-worker-client.ts:134-139`, a code producer and not a classifier).

### Registry decode (s2, L4-04 + R2 + R8)

Today `registration/` has:
- 19 `registryRows(` call sites in 8 files;
- about 12 bare `decodeStrict` over rows and 7 unguarded `JSON.parse` of stored JSON;
- 11 hand-written `REGISTRY_CORRUPT` throws or constants (`registration-confirmation-store.ts:110` `corrupt`, `registration-proposal-store.ts:91` `corruptProposal`, `list-visibility.ts:18`, and inline at 8 sites).

A bare `decodeStrict` throws a `SchemaError`, which `registryFailure` maps to `INTERNAL_FAILURE`, while the same damage on a guarded path answers `REGISTRY_CORRUPT`.

**Proposed shape:**
- `registry-database.ts` (owner of `registryRows`) gains `decodeRegistryRows(schema, result)` and `decodeRegistryJson(schema, text)`.
- Both fail as `REGISTRY_CORRUPT` and never as a `SchemaError` or `SyntaxError`.
- The helper shape is Q2.
- R2's four sites move onto them.
- R8 adds the missing `noDispatch` clock row (test only).

### Ledger refusals (s3, L5-04)

`storage/canonical-command-ledger.ts` has 14 `throw new Error("Canonical … is inconsistent.")` guards (`:119`, `:201`, `:210`, `:216`, `:252`, `:281`, `:292`, `:298`, `:319`, `:365`, `:404`, `:412`, `:451`, `:455`).
- The shared oracles `canonical-command-fixture.ts:765`, `:1154` and `:1189` assert only `toBeInstanceOf(Error)`.
- One message is pinned elsewhere: `canonical-writer-reconciliation.integration.test.ts:76`.

**Proposed shape:**
- One `Data.TaggedError` (it does not trip `extendsNativeError`) carries a `refusal` literal from a 14-member tuple and keeps each message byte for byte.
- The oracles assert the refusal.
- Settle still rejects (Promise code). Who catches it and how it reaches the wire is unchanged.

### Diagnostics port (s4, L3-02 + IX-8, aligned with #133)

**#133 left this shape** (`7d04277`, brief `designs/2026-10-23_16-18-47_harness-desktop-log-link.md`):
- The harness writes JSON lines.
- The desktop forwarder `apps/desktop/src/main/harness-log-lines.ts` forwards only lines in a closed protocol vocabulary:
  - `harnessUpgradeLogEvents`, decoded by `HarnessUpgradeLogLineSchema`;
  - `harnessFatalCodes` at level 60, decoded by `HarnessFatalLogLineSchema`.
- Any other line is dropped.
- The redacted failure summary (`tag` / cleanup `parts` / release `code` / `kind`, bounded by `HARNESS_FATAL_SUMMARY_BOUND`) is owned by `process-fatal-diagnostics.ts` with its protocol schema.
- No envelope protocol version changed for #133.

So a log call that is only added in the harness never reaches `slopstop.jsonl`.

**Proposed shape (Q4 (a)):**
- One protocol-owned harness **request-failure** line:
  - a code such as `HARNESS_REQUEST_FAILED` at level 40;
  - a `boundary` literal;
  - the same failure summary as the fatal lines.
- The desktop forwarder learns this third kind.
- The harness runtime receives the process logger as a runtime-wide diagnostics port, in place of the feature-scoped `UpgradeEventLogger` alone.
- That port logs one line at each boundary catch:
  - `harness-runtime.ts:407` (message);
  - `:417` (notification);
  - `project-storage-application.ts:117`;
  - `workspace-application.ts:147` and `:192`.
- Summary code is shared with `process-fatal-diagnostics.ts`, not copied.

### Effect advisory warnings and promotion (s5a-s5c, s6)

Measured (2026-10-25, `b94f302`): **51 hits** in total.

| Rule | Harness src | Harness tests | Desktop | Total |
|---|---|---|---|---|
| `anyUnknownInErrorContext` | 20 | 3 | 0 | 23 |
| `extendsNativeError` | 16 | 0 | 4 | 20 |
| `schemaNumber` | 0 | 6 | 0 | 6 |
| `unnecessaryFailYieldableError` | 2 | 0 | 0 | 2 |

The same run also reports `message`-level advice outside the four rules: harness `unnecessaryEffectGen` 2, `preferUnsafeConstructor` 2, `runOfExitToRunExit` 1, and desktop `flatMapConditionalToFilterOrFail` 2. These are out of scope and stay advice.

- **anyUnknownInErrorContext (23 hits in 9 files):**
  - `harness-runtime.ts:112,194,429,443`;
  - `process-bootstrap.ts:120,130,138`;
  - `registration/registration-registry.ts:83,88,215`;
  - `storage/application-database-authority.ts:90,454`;
  - `storage/project-storage-application-client.ts:153,162,198`;
  - `storage/project-storage-store.ts:171,565,571`;
  - `storage/retryable-attempt.ts:11,25`;
  - tests: `harness-runtime.test.ts:322` and `harness-runtime-shutdown.test.ts:375` (×2).
  - Root: the same as the fixed `unknownInEffectCatch` hits (`catch: (cause) => cause`, or a generic `E = unknown` helper, leaves `E = unknown`). The fix maps the cause to a typed error at each site. `retryable-attempt.ts` is a generic helper, and typing it may fix call sites in one go.
- **extendsNativeError (20 classes):**
  - Harness storage and canonical code, 9 classes in 8 files: `canonical-project-application.ts:18`, `canonical-project-writer.ts:62`, `storage/application-database-migration.ts:46`, `storage/canonical-command-repository.ts:126`, `storage/canonical-writer-lease.ts:38`, `storage/project-storage-application-client.ts:19`, `storage/project-storage-errors.ts:1,5`, `storage/project-storage-upgrade-verification.ts:35`.
  - Harness registration, 7 classes in 5 files: `registration-confirmation-store.ts:334,416`, `registry-failure.ts:25`, `repository-physical-observation.ts:27`, `windows-observer-api.ts:71`, `windows-version-child.ts:32,37`.
  - Desktop package-smoke code, 4 classes in 4 files: `apps/desktop/src/main/{package-smoke-authorization.ts:13, package-smoke-verifier.ts:207, project-storage-package-smoke.ts:45, registration-package-smoke.ts:7}`.
  - `retained-application-client.ts:3` (`extends AggregateError`) is not flagged.
  - Converting each class to `Data.TaggedError` or `Schema.TaggedErrorClass` keeps `instanceof Error`, the name and the message. It also **adds a `_tag`**. `process-fatal-diagnostics.ts` `failureEntry` then summarizes such a value as `{ tag }` instead of `{ kind: "error" }`. That is an observable change to fatal and request-failure lines (Q5).
- **schemaNumber (6, tests only):**
  - `canonical-command-registry.test.ts:218,306,328`;
  - `tests/integration/canonical-command-repository-faults.integration.test.ts:35`;
  - `tests/integration/conformance-counter-command.ts:761` (×2).
- **unnecessaryFailYieldableError (2):** `registration/existing-registration.ts:57`, `storage/project-storage-upgrade-pipeline.ts:384`.
- **Promotion (s6):**
  - `tsconfig.base.json:39-42` severities move from `warning` to `error`;
  - the canary expectations (`check-effect-diagnostics.mjs:196-199`, which expect `warning anyUnknownInErrorContext` twice) and their gate tests follow;
  - the waiver mechanism already exists (`effect-diagnostics-waivers.json` + `// Effect waiver EWn:` + `@effect-diagnostics-next-line rule:off`), and a promoted-rule waiver uses it only with Pedro's per-line approval.

### Where the line with #123 Part B is

Part B is the registration Effect migration plus the module-by-module SQL-body pass and Phase 5 (§102, §144). Its removal triggers are already recorded: EW1-EW3 (registration `newPromise` races), the remaining Promise facades, and the conversation-save nesting.

| Concern | Phase 3 does | Part B does |
|---|---|---|
| `RegistryFault` (R2, `extendsNativeError`) | becomes a tagged error, still **thrown** from Promise code; one decode owner answers corrupt | moves it onto the Effect error channel |
| registry decode (L4-04) | pure helpers in `registry-database.ts`, which Part B reuses as they are | calls them inside Effect programs |
| `anyUnknownInErrorContext` in the registration Effect edge (`registration-registry.ts:83,88,215`) | types `E` at the existing Effect sites | migrates the Promise bodies |
| R6 `project-registration-preparation.ts` 8.03 | structural refactor to 10, still Promise code (Q7) | rewrites it as Effect |
| EW1-EW3 waivers (`newPromise`) | untouched (not one of the four rules) | removes them |

The rule is: Phase 3 changes **classification, types and logging** in the current Promise or Effect shape, and Part B changes the **execution model**.

## Decisions

Inherited (not asked again):
- §144: the six phases are the plan; Phases 3 and 4 come before C2; Phase 5 folds into Part B.
- §143 and §144: the 51 warnings are in scope; promote at 0 only; waivers per line, by Pedro.
- §141: #133 owns the harness-to-desktop log link; s9 fatal lines are forwarded.
- Precedent `43bc303`: keep every distinct code and message.

**Open questions (numbered, each with a recommendation and its measured blast radius):**

- **Q1 (s1) busy set.**
  - (a) **Recommended.** One module, four named predicates, no verdict change. The upgrade keeps retrying unavailable codes (it uses `isRetryableStorageError`); registration and conversation keep BUSY/LOCKED only. Blast: 8 source files, 2 config files, 0 behaviour.
  - (b) One busy set for all. Registration and conversation would then answer `REGISTRY_BUSY` / busy for `IOERR`, `CANTOPEN`, `PERM`, `READONLY`, `EACCES`, `EPERM`, `EBUSY`. A permission error would become "retry", and G7 is reopened. This flips 5 pinned rows in `sqlite-busy.test.ts:7-15` (`CANTOPEN`, `IOERR`, `READONLY`, `BUSY_SNAPSHOT`, `EBUSY`).
  - (c) The upgrade narrows to BUSY/LOCKED. Windows `EBUSY`/`EPERM` rename locks would then abandon the upgrade instead of waiting.
  - Weakness of (a): the finding's acceptance line "one busy classification" is met as one owner with named predicates (its own remediation text), not as one set.
- **Q2 (s2) decode helper shape.**
  - (a) **Recommended.** The helpers throw `RegistryFault(REGISTRY_CORRUPT)` like today's guarded sites. That is the minimal change at about 20 call sites, and Part B swaps the throw for `Effect.fail` in one place.
  - (b) The helpers return `Result`, and each Promise caller unwraps it. This is purer, but adds about 20 unwrap branches that Part B deletes again.
- **Q3 (s3) ledger lane.** `lane.mjs` answers **fast** (2 files). The finding calls the idempotency authority the riskiest code in the ledger, and its test strategy names a mutation run.
  - (a) **Recommended.** Raise s3 to normal (raise-only), with one scoped ledger mutation run under the coordinator's GO.
  - (b) Keep fast.
- **Q4 (s4) log path.**
  - (a) **Recommended.** The full path: a protocol line schema, the harness port and the desktop forwarder, like #133. Blast: 8 files in 3 packages; no envelope version change (#133 precedent).
  - (b) Harness only. The line never reaches `slopstop.jsonl`, because the forwarder drops unknown lines, so L3-02's acceptance is not met in the app.
- **Q5 (s5a) `_tag` in summaries.** Converting the native-error classes adds `_tag`, so fatal and request-failure summaries name the class instead of `kind: "error"`.
  - (a) **Recommended.** Accept it and pin it. It is more diagnostic, and tags are already allowed by `HARNESS_FAILURE_TAG_PATTERN`.
  - (b) Strip the tags for these classes. That adds a list to maintain.
- **Q6 (s5a) split and lanes.** The 20 classes split by area into three slices, measured with `lane.mjs --paths`:
  - **s5a-storage** (8 files): **rigorous** (`files: 8 > 5`, plus the sensitive word "migration" from the filename `application-database-migration.ts`; the class there is a fault type, with no SQL). Phase 2 precedent: Q12, a normal override for the same filename.
  - **s5a-registration** (5 files): **fast**.
  - **s5a-desktop** (4 files): **rigorous** (sensitive word "auth" from `package-smoke-authorization.ts`). That file really is the smoke's authorization gate (L2-01).
  - (a) **Recommended.**
    - s5a-storage goes normal by override (filename-only trigger, as Q12).
    - s5a-registration is raised to normal, because it holds `RegistryFault`, the class every registration verdict reads.
    - s5a-desktop goes normal by override, with a pin that each smoke refusal keeps its message and exit; its class change touches no authorization logic.
  - (b) Keep the `lane.mjs` lanes (2 rigorous, with intent reviews).
- **Q7 (R6) home.** The §1500 decision put the 8.03 refactor in Part B; the Phase 2 residual list re-homed it to Phase 3.
  - (a) **Recommended.** Phase 3 (s7), because Part B comes after C2 and s2 works in the same registration area just before it. Accepted cost: Part B rewrites it again as Effect.
  - (b) Leave it in Part B.
- **Q8 (s6) waivers.** None proposed. If the measured count leaves a hit that cannot be fixed without Part B (for example an `anyUnknownInErrorContext` inside a Promise facade), the slice stops and asks Pedro per line. It is never waived in bulk.
- **Q9 (line with Part B).** Confirm the table under Architecture as the boundary.

## Next Slice

### Slice p3-s1-busy-classifier

- **`slice_id`:** `p3-s1-busy-classifier`. Lane: **normal** (`lane.mjs --paths` over the 8 planned source paths: "files: 8 > 5").
- **Finding:** L6.1-03, acceptance "One busy classification used by upgrade, registry and conversation"; remediation "Decide the busy set once; keep unavailable vs busy as separate named predicates in one module".
- **Base:** main `b94f302` (Phase 2 merged). Shares no file with Phase 2's open residuals.
- **Deliverable (Q1 (a)):**
  - `isSqliteBusy` moves into `project-storage-node-errors.ts`, with its TSDoc and the same body.
  - `isBusyStorageError` becomes `isRetryableStorageError`, with the same body and TSDoc that says busy-or-unavailable, cause included.
  - `sqlite-busy.ts` and `sqlite-busy.test.ts` are deleted; their rows move to `project-storage-node-errors.test.ts`.
  - The 6 consumers import from the one module.
  - `vitest.conversation-mutation.config.ts:11` and `stryker.conversation.config.json:10` name the new test and source file.
- **Message and code ledger:** nothing added, removed or changed.
- **Source paths:** `apps/harness/src/storage/{project-storage-node-errors,sqlite-busy,project-storage-upgrade-verification,project-storage-upgrade-recovery,project-storage-upgrade-pipeline,project-storage-upgrade-node-adapter}.ts`, `apps/harness/src/conversation/conversation-errors.ts`, `apps/harness/src/registration/registry-failure.ts`. Config: `apps/harness/vitest.conversation-mutation.config.ts`, `stryker.conversation.config.json`.
- **Test paths:** `apps/harness/src/storage/project-storage-node-errors.test.ts` (absorbs `sqlite-busy.test.ts`).
- **Dependencies:** none.

#### Test Contract: p3-s1-busy-classifier

Public seam: the exports of `project-storage-node-errors.ts`, and `registryFailure` / `conversationStorageFailure` as the verdict owners.

- **Behavior P3-B1 (L6.1-03):** one module answers every storage classification.
  - Test: `classifies each storage error code once` in `project-storage-node-errors.test.ts`.
  - It is one table over the codes `SQLITE_BUSY`, `SQLITE_LOCKED`, `SQLITE_BUSY_SNAPSHOT`, `SQLITE_IOERR`, `SQLITE_IOERR_WRITE`, `SQLITE_CANTOPEN`, `SQLITE_READONLY`, `SQLITE_CORRUPT`, `SQLITE_NOTADB`, `EACCES`, `EPERM`, `EBUSY`, `UNKNOWN`, and no code.
  - Each row asserts all four predicates (`isSqliteBusy`, `isUnavailableStorageError`, `isRetryableStorageError`, `isCorruptStorageError`) imported from this one module.
  - It adds one row for a cause-wrapped `SQLITE_IOERR`: `isRetryableStorageError` true, `isSqliteBusy` false.
  - Expected red: the import fails, because the module exports neither `isSqliteBusy` nor `isRetryableStorageError`.
- **Behavior P3-B2 (pin, Q1 (a)):** no verdict changes.
  - Tests:
    - `registryFailure` maps BUSY/LOCKED to `{ status: "unavailable", code: "REGISTRY_BUSY" }` and the 7 other codes to `{ status: "broken", code: "INTERNAL_FAILURE" }` (today's `sqlite-busy.test.ts:35-49` rows, moved);
    - `conversationStorageFailure` maps BUSY to `ConversationStorageBusy` and `SQLITE_IOERR` to `ConversationStorageBroken` (one new row each);
    - the existing upgrade recovery/pipeline busy rows stay green.
  - Expected red: none (pin), green before and after.
- **TDD-exempt:** the two config path updates. Reason: they are configuration, not behaviour. Oracle: the structural check below, and the conversation mutation config still lists an existing test file (Vitest fails on a missing include only by running nothing, so the structural rg is the proof).

#### Success Criteria: p3-s1-busy-classifier

- Red then green for P3-B1 with the smallest Vitest command; P3-B2 green before and after; then `pnpm check` and `pnpm check:dead-code`.
- `rg -n "sqlite-busy|isBusyStorageError" apps packages stryker.conversation.config.json` finds nothing.
- `rg -n "\"SQLITE_(BUSY|LOCKED)\"" apps/harness/src -g '!*.test.*'` finds only `project-storage-node-errors.ts` and the worker's code table.
- **Heavy runs:** none at the candidate. The conversation mutation run is not required (no logic changed). The coordinator may ask for it once on the final Phase 3 candidate.
- **Binding** (restored by digest): making `isSqliteBusy` accept the `SQLITE_BUSY_*` family makes the P3-B1 `SQLITE_BUSY_SNAPSHOT` row fail, and pointing `registry-failure.ts` at `isRetryableStorageError` makes the P3-B2 `SQLITE_IOERR` row fail.
- CodeScene `code_health_score` on every changed source file (target 10).

## Deferred Work

Each slice gets its full contract when it becomes next. Behavior IDs continue from P3-B3.

| Slice | Content | Planned paths (lane.mjs) | Lane | Trigger |
|---|---|---|---|---|
| `p3-s2-registry-decode` | L4-04 helpers + R2 four sites + R8 `noDispatch` clock row | `registry-database.ts` + 8 registration stores | normal (9 > 5) | after s1; Q2 |
| `p3-s3-ledger-refusals` | L5-04 tagged refusal, 14 codes, oracle asserts the code | `canonical-command-ledger.ts`, `canonical-command-fixture.ts` | fast → normal (Q3) | Q3 |
| `p3-s4-request-failure-log` | L3-02 + IX-8 port and protocol line, desktop forwarder | protocol log schema + index, `harness-runtime.ts`, `process-bootstrap.ts`, `project-storage-application.ts`, `workspace-application.ts`, `process-fatal-diagnostics.ts`, `harness-log-lines.ts` | normal (8 > 5) | Q4; after s3 (the ledger refusal tag reaches the summary) |
| `p3-s5a-storage-errors` | `extendsNativeError`, 9 storage and canonical classes | 8 files (Architecture list) | rigorous → normal by override (Q6) | Q5, Q6; after s4 (summary pin) |
| `p3-s5a-registration-errors` | `extendsNativeError`, 7 registration classes incl. `RegistryFault` | 5 files | fast → normal (Q6) | Q5, Q6; after s2 |
| `p3-s5a-desktop-errors` | `extendsNativeError`, 4 desktop smoke classes | 4 files | rigorous → normal by override (Q6) | Q6 |
| `p3-s5b-error-context` | `anyUnknownInErrorContext`, 23 → 0 | 7 source + 2 test files | normal (7 > 5) | after s4 (shares `harness-runtime.ts`, `process-bootstrap.ts`) |
| `p3-s5c-schema-number-yieldable` | `schemaNumber` 6 (tests) + `unnecessaryFailYieldableError` 2 | 5 files | fast | none |
| `p3-s6-effect-rule-promotion` | four rules to `error`; canary and gate tests | `tsconfig.base.json`, `check-effect-diagnostics.mjs` + test, canary | fast | a re-measured count of 0 on the s5 head; Q8 |
| `p3-s7-preparation-health` | R6 to CodeScene 10, no behaviour change | `project-registration-preparation.ts` | fast | Q7; after s2 |

## Verification Notes

- **Measured baseline:** `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/effect-{apps_harness,apps_desktop,packages_kernel,packages_protocol,apps_harness_scripts_effect-diagnostics-canary}.json` (+ empty `.stderr.txt`). One run, 9 s, at `b94f302`, with the coordinator's GO (CPU 4/2/1). Exits: canary 1 (planted), packages 0. Advisory total 51; `check:effect` passes today with 51 advisory warnings.
- **Risk, s1:** the two config consumers (vitest mutation include, stryker mutate). Missing them silently drops the busy predicate from the conversation mutation run.
- **Risk, s4:** the forwarder rejects unknown lines silently by design. A harness line with no protocol schema looks like it works in harness tests and is absent in the app. #133's e2e proof pattern (LOG-B7) is the reference.
- **Risk, s5a:** an added `_tag` changes the shape of fatal summaries (Q5). `instanceof` checks (`registryFailure`, `isKnownStorageFailure`) must keep working.
- **Risk, s6:** the canary expects `warning anyUnknownInErrorContext` lines. Promotion without updating the canary fails the gate as `EFFECT_GATE_CANARY_MISMATCH`, which is correct, and it must not be "fixed" by loosening the canary.

## Developer Context

- Coordinator instruction (2026-10-25): draft the Phase 3 brief in the main checkout; docs only; no runs; not committed. The measurement is (a), deferred until the machine is idle; replace the provisional figures before reporting. The GO came at CPU 4/2/1; the figures are replaced.
- Phase 2 precedents reused: per-slice detail appended later; the lane override for a filename-only trigger (P2 Q12); D1 ledger "nothing changed".
- Intent approval of this brief is not build authority. The implementer agrees workspace and build with the coordinator.

## References

- `.rpiv/artifacts/architecture-reviews/2026-10-23_16-18-48_whole-project.md` (Phase 3, L6.1-03, L4-04, L5-04, L3-02, IX-8, T3).
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §102, §141, §143, §144, P-S5B-2 (EW register).
- `.rpiv/artifacts/designs/2026-10-23_16-18-47_harness-desktop-log-link.md` (#133).
- `.rpiv/artifacts/research/2026-10-18_20-08-00_typescript-7-and-effect-tsgo-gate.md` (rule counts, roots).
- `slopstop-p2/.rpiv/evidence/2026-10-24_14-34-59_arch-review-phase-2-vocabulary-owners/phase-2-residuals-and-amendments.md` (R2, R6, R8).
- `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`.
- Commits `e55b35b` (missed consumer), `43bc303` (keep codes and messages), `7d04277` (#133 squash).
## Follow-up

### 2026-10-25: Phase 3 brief approved, Q1-Q9 decided (Pedro, confirmed by the coordinator)

- **Approved:** the brief at `content_hash 30f2f102db9359ea4ade13b9586da2859a8a02052d8c03f1eba7ae8d8f97c7e9`. The approved copy is `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-30f2f102.md`. The next slice is `p3-s1-busy-classifier` (lane normal), and its contract (P3-B1, P3-B2) stands as written.
- **As recommended:**
  - **Q1 (a):** one module with four named predicates and no verdict change.
  - **Q2 (a):** the decode helpers throw `RegistryFault(REGISTRY_CORRUPT)`.
  - **Q4 (a):** the full log path (protocol line, harness port, desktop forwarder).
  - **Q5 (a):** an added `_tag` is accepted and pinned.
  - **Q7 (a):** R6 is in Phase 3 (s7).
  - **Q8:** no waivers; a leftover hit stops the slice and Pedro decides that line.
  - **Q9:** the Part B line in the Architecture table stands.
- **Q3:** `p3-s3-ledger-refusals` is raised from fast to **normal**, **with one scoped ledger mutation run**.
  - This is Pedro's explicit choice. It overrides his earlier "no mutation" for this slice only.
  - The run is heavy and needs the coordinator's GO.
- **Q6:** all three s5a slices are **normal**, with recorded lane overrides:
  - `p3-s5a-storage-errors`: rigorous → normal (the filename trigger "migration");
  - `p3-s5a-desktop-errors`: rigorous → normal (the filename trigger "auth"; behaviour unchanged, and each smoke refusal keeps its message and exit);
  - `p3-s5a-registration-errors`: fast → normal (raised).
