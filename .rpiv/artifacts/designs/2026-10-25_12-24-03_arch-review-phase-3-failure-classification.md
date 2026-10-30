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
last_updated: 2026-10-28T00:53:46+0000
last_updated_by: Pedro Mesquita
last_updated_note: "TDD Evidence: p3-s7-preparation-health entry with its approved changes (verifier V1)."
content_hash: 5fa2780c18993786a3a6dca49c05835539136b00e29acae9e6501f571f95b6ee
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

### 2026-10-25: slice p3-s2-registry-decode detailed

Measured read-only at `fd9afcd` (worktree `slopstop-p3`, `fix/arch-review-phase-3`, s1 closed). This contract follows Q2 (a): the helpers throw `RegistryFault(REGISTRY_CORRUPT)`. The figures below replace the approximate ones under Architecture ("about 12", "7 unguarded", "11 hand-written").

#### Slice p3-s2-registry-decode

- **`slice_id`:** `p3-s2-registry-decode`. Lane: **normal** (`lane.mjs --paths` over the 11 source paths below: "files: 11 > 5").
- **Findings:** L4-04 (one decode owner for stored registry data), R2 (the four guarded Promise sites keep throwing; they move onto the owner), R8 (the missing `noDispatch` clock row).
- **Base:** `fd9afcd`. It shares no file with s1.

**Measured inventory: 33 decode sites over stored registry data, in 8 files.** One rule decides scope: a decode is in scope when its input is a value read from `application.db`.
- 19 `registryRows(` call sites (the definition at `registry-database.ts:49` is extra);
- 3 decodes of raw cells: `identity-query-consent.ts:132`, `observer-journal.ts:179`, `repository-trust.ts:187`;
- 11 `JSON.parse` of a stored column.

Out of scope, so they stay as today:
- decodes of caller input (for example `repository-trust.ts:225`, `identity-query-consent.ts:157`);
- values the harness builds (`randomUUID`, constructed records);
- child and port outputs;
- other owners' results (`project-listing.ts:91,120`, `registration-storage-bootstrap.ts:140`).

None of these is stored data, so their failure is not registry corruption.

| Group | Sites (`file:line` at `fd9afcd`) | Today on stored damage |
|---|---|---|
| Guarded, 13 | `list-visibility.ts:33`; `project-listing.ts:133`; `registration-proposal-store.ts:95` (JSON), `:123`; `registration-confirmation-store.ts:146`, `:147` (JSON), `:164`, `:192` (JSON), `:242`, `:354`, `:356` (JSON), `:457`, `:474` | `REGISTRY_CORRUPT` |
| Bare, 20 | `executable-consent-store.ts:32`, `:46`; `identity-query-consent.ts:68`, `:70` (JSON), `:94`, `:132`; `repository-trust.ts:110`, `:112` (JSON), `:153`, `:187`; `observer-journal.ts:77` (JSON), `:81` (JSON), `:95`, `:156`, `:158` (JSON), `:179`, `:246`, `:248` (JSON), `:278`, `:280` (JSON) | `INTERNAL_FAILURE` |

At `identity-query-consent.ts:70` and `repository-trust.ts:112` the decode is already guarded. Only the `JSON.parse` is bare.

**Today's answer for a bare site, traced statically.**
- A `SchemaError` from `decodeStrict` (`Schema.decodeUnknownSync`, `schema-codec.ts:29-31`) or a `SyntaxError` from `JSON.parse` reaches `registryFailure` (`registry-failure.ts:32-42`).
  - That function has no branch for either error.
  - `isSqliteBusy` reads no code from them.
  - So it answers `{ status: "broken", code: "INTERNAL_FAILURE" }`.
- Every bare site reaches that boundary:
  - the owners' `.catch(registryFailure)` (`repository-trust.ts:225-242`, `identity-query-consent.ts:155-165`, `observer-journal.ts:302-308`);
  - `registration-registry.ts:159,190`;
  - the version observer (`project-registration-observer.ts:144`);
  - the identity-query owner (`repository-identity-query-owner.ts:311`).
- No intermediate catch on these paths turns them into another code. `repository-identity-query-owner.ts:183` catches only inside `runQuery`, and `runQuery` decodes no stored rows.
- No existing test pins `INTERNAL_FAILURE` for stored damage (`rg` over `tests/integration/registration-*` and `src/registration/*.test.ts`). The `INTERNAL_FAILURE` rows found there are port failures and stored outcomes.

**What the database already refuses (measured; this settles "does a SyntaxError map to INTERNAL_FAILURE today").**
- All 11 stored JSON columns carry `CHECK(json_valid(...))`:
  - `drizzle/application/0001_project_registration.sql:37,70,126`;
  - `0002_identity_query_attempts.sql:15-18`;
  - `0003:7`, `0004:7,18`, `0005:8`.
- Every `openCurrent` runs `migrateOn` → `firstRequiredApplicationMigration` → `requireIntegrity`:
  - the chain is `application-database-authority.ts:427-430,327-331` and `application-database-migration.ts:346-357,317-321`;
  - `requireIntegrity` runs `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
- SQLite's `integrity_check` reports CHECK, NOT NULL and UNIQUE violations (sqlite.org, `pragma.html#pragma_integrity_check`).
- Consequences:
  - Text that is not JSON cannot be written with checks on.
  - If it is written with `ignore_check_constraints` or by an outside tool, every later open refuses the whole database as `REGISTRY_CORRUPT` (`ApplicationDatabaseFault`) before any site reads the row.
  - So the `SyntaxError` → `INTERNAL_FAILURE` mapping is real in the code but **not reachable through the authority**.
  - The same holds for values outside a CHECK list (the `decision` columns) and for foreign keys.

**Observable flips, 9 of the 20.** In each, the CHECKs accept the damage but the row schema refuses it:

| Row | Site | Plant (checks on) | Public operation |
|---|---|---|---|
| a | `executable-consent-store.ts:32` | selection `captured_at = 'not-a-time'` | `registry.decideVersion` with a new consent id |
| b | `repository-trust.ts:110` | selection `directory_path` set to a BLOB | `registry.decideRepositoryTrust` with a new trust id |
| c | `observer-journal.ts:95` | an unsettled attempt whose `observation_id` is uppercase (no uuid CHECK on that table) | `registry.reconcileAtStart(undefined)` |
| d | `observer-journal.ts:77` | unsettled attempt `child_json = '{}'` | `registry.reconcileAtStart(undefined)` |
| e | `observer-journal.ts:81` | unsettled attempt with a valid child, `terminal_json = '{}'` | `registry.reconcileAtStart(undefined)` |
| f | `observer-journal.ts:158` | outcome `result_json = '{}'` | `observer.inspectGitVersion` for that consent and selection |
| g | `observer-journal.ts:179` | complete terminal with no outcome, `exit_code = 'x'` (INTEGER affinity keeps the text) | `registry.reconcileAtStart(undefined)` |
| h | `observer-journal.ts:248` | child with a complete terminal and no outcome, `identity_json = '{}'` | `registry.reconcileAtStart(undefined)` |
| i | `observer-journal.ts:280` | child with no terminal and no outcome, `identity_json = '{}'` | `registry.reconcileAtStart(<absence port>)` |

**Defended sites, 11 of the 20:** `executable-consent-store.ts:46`; `identity-query-consent.ts:68`, `:70`, `:94`, `:132`; `repository-trust.ts:112`, `:153`, `:187`; `observer-journal.ts:156`, `:246`, `:278`.
- At `fd9afcd` no plant was found that their CHECKs and foreign keys accept and their row schema refuses.
- They move onto the owner too, so one shape holds and a later loosened CHECK cannot reopen the gap.
- Their proof is P3-B3 plus the structural checks.
- If the implementer finds a reachable plant for one of them, a P3-B4 row is added (raise-only) and recorded in `## TDD Evidence (implement)`.

**Deliverable:**
- **`registry-failure.ts`** gains the one corrupt value and its constructor:
  - `registryCorruptFailure = { status: "broken", code: "REGISTRY_CORRUPT" } as const`;
  - `registryCorrupt(): RegistryFault`.
- **`registry-database.ts`**, the owner of `registryRows`, gains:
  - `decodeRegistryRows(schema, result: LocalLibsqlResultSet)`: a strict decode of the named rows;
  - `decodeRegistryJson(schema, text: string)`: `JSON.parse` and then a strict decode.
  - Any decode or parse failure throws `registryCorrupt()`, never a `SchemaError` or a `SyntaxError`.
  - `registryRows` is no longer exported.
- **The 33 sites use the helpers:**
  - The three raw-cell sites alias their one column, for example `SELECT decision`, `exit_code AS exitCode`, and use a one-field struct row schema. The SQL predicates do not change.
  - The guarded sites lose their local mapping.
- **R2:**
  - `decodeProposalRecord` and `corruptProposal` go (`registration-proposal-store.ts:91-99`).
  - `readReservation`'s catch-all goes (`registration-confirmation-store.ts:145-152`). A missing reservation row throws `registryCorrupt()` explicitly; today that answer comes from a `TypeError` caught by the catch-all.
  - `decodeSavedRequest`'s catch goes (`:189-196`).
  - `findCommonReservation` uses the helper (`:242-247`).
  - `readPublication`'s catch stays (`:379-382`). It separates `ReceiptReadFailed` from corruption.
  - They still throw (Q2 (a)). Part B swaps the throw for `Effect.fail` in the two helpers.
- **The hand-written `REGISTRY_CORRUPT` (12 lines in 8 files) all use the owner:**
  - Decode guards disappear into the helpers: `identity-query-consent.ts:72`, `project-listing.ts:142`, `repository-trust.ts:114`.
  - Agreement checks call `registryCorrupt()`: `identity-query-consent.ts:80`; `observer-journal.ts:79,164,250,282`; the constants `registration-confirmation-store.ts:110` and `registration-proposal-store.ts:91`.
  - Effect side (Q11): `list-visibility.ts` decodes inside its `registryRead` callback, so `registryRead`'s existing `registryFailure` mapping gives the same `RegistryReadFailed` value, and its local `corrupt` goes. `existing-registration.ts:41` uses `registryCorruptFailure`.
- **Message and code ledger (D1):**
  - Messages: nothing added, removed or changed.
  - Codes: the 20 bare sites answer `REGISTRY_CORRUPT` instead of `INTERNAL_FAILURE` for stored damage (Q12).
  - Wire: no change; `REGISTRY_CORRUPT` is already in `RegistryBrokenCodeSchema` (`project-registration-protocol.ts:53`).
  - The desktop has no code-specific handling for either code (`rg` over `apps/desktop/src`).
  - The start reconciliation still logs only `REGISTRATION_RECONCILIATION_FAILED` (`process-bootstrap.ts:304`).
- **Source paths** (all under `apps/harness/src/registration/`): `registry-database.ts`, `registry-failure.ts`, `executable-consent-store.ts`, `identity-query-consent.ts`, `repository-trust.ts`, `observer-journal.ts`, `project-listing.ts`, `list-visibility.ts`, `existing-registration.ts`, `registration-proposal-store.ts`, `registration-confirmation-store.ts`.
- **Test paths:**
  - new `apps/harness/src/registration/registry-database.test.ts`;
  - new `apps/harness/tests/integration/registration-stored-damage.integration.test.ts`;
  - `apps/harness/src/registration/registration-confirmation-store.test.ts`;
  - `apps/harness/tests/integration/registration-clock.integration.test.ts`.
- **Dependencies:** none on s1. s5a-registration and s7 come after it (shared registration files).

#### Test Contract: p3-s2-registry-decode

Public seams:
- the two helpers through their module exports;
- the registration owners' public operations (`createRegistrationRegistry`, the version observer's `inspectGitVersion`), over a real `application.db` on Windows x64, as in the peer registration integration tests;
- `findCommonReservation` over a fake transaction, as in its existing test.

- **Behavior P3-B3 (L4-04):** stored registry data that does not decode answers `REGISTRY_CORRUPT`.
  - Test: `classifies stored registry data that does not decode as corrupt (%s)` in `registry-database.test.ts`. Rows:
    - `decodeRegistryRows` on a result set whose row fails the schema;
    - `decodeRegistryJson` on `'{'` (a `SyntaxError` today);
    - `decodeRegistryJson` on `'{}'` against a schema with a required field.
  - Oracle for each row: the call throws a `RegistryFault` whose `failure` equals `{ status: "broken", code: "REGISTRY_CORRUPT" }` exactly, and `registryFailure(thrown)` equals the same value.
  - Two success rows: `decodeRegistryRows` returns the named, decoded rows (`toEqual`), and `decodeRegistryJson` returns the decoded value.
  - Expected red: the import fails, because `registry-database.ts` exports neither helper.
- **Behavior P3-B4 (L4-04, Q12):** stored damage the database admits answers `REGISTRY_CORRUPT` at every observable site.
  - Test: `answers a stored registration value that does not decode as corrupt (%s)` in `registration-stored-damage.integration.test.ts`. There are 9 rows, a to i from the table above, one per site.
  - Each row builds its scenario with the existing fixtures, plants the damage with `node:sqlite` while checks are on, and calls the named public operation.
  - Oracle: the answer equals `{ status: "broken", code: "REGISTRY_CORRUPT" }` exactly.
  - Precondition in each row: the planted value reads back from the database, and the database is still healthy before the call (`PRAGMA integrity_check` answers `ok`). So the corrupt answer cannot come from the open.
  - Expected red: each row answers exactly `{ status: "broken", code: "INTERNAL_FAILURE" }`. Any other red (another code, a rejection, or `REGISTRY_CORRUPT` before the change) means the plant did not reach its site. That is a fixture fault to fix, never a red to accept.
- **Behavior P3-B5 (pin, R2):** the guarded reservation reads keep their answer once their catch-all is gone.
  - Test: two rows added to the existing `classifies a stored reservation … as corrupt` table in `registration-confirmation-store.test.ts`:
    - the reservation-id row is found but the reservation row is absent;
    - the reservation `recordJson` is `'{'`.
  - Oracle: `registryFailure(rejection)` equals `{ status: "broken", code: "REGISTRY_CORRUPT" }`.
  - Expected red: none (pin; today the catch-all answers it).
  - The existing corrupt rows in `registration-preparation.integration.test.ts:265,429`, `registration-list.integration.test.ts:110`, the trust case `registration-repository-trust-cases.ts:477-486` and the consent cases stay green unchanged.
- **Behavior P3-B6 (pin, R8):** the no-dispatch settlement is stamped from the injected clock.
  - Test: `stamps the no-dispatch settlement from the injected clock` in `registration-clock.integration.test.ts`, under the file's existing Windows guard.
  - The scenario is `createRepositoryTrustScenario`, with trust accepted.
  - The owner is `createRepositoryIdentityQueryOwner(registry, { ...consentRegistryOptions(root), clock }, root, child)`. Its child returns `{ status: "unavailable", code: "GIT_UNAVAILABLE" }` without calling `onOwned`, so `repository-identity-query-owner.ts:117-119` calls `noDispatch`.
  - Oracle:
    - the result equals that value;
    - the one attempt row has `child_json` NULL, which proves the path did not go through `settle`;
    - its `settled_at` equals `2026-10-24T12:00:00.000Z`;
    - its `result_json` equals `JSON.stringify` of the result.
  - Expected red: none (pin; P2 already rebound the site). This closes R8's unproven gap.
- **TDD-exempt:**
  - Moving the 13 guarded and the 11 defended sites onto the helpers, and pointing the agreement checks at `registryCorrupt()`.
  - Reason: same answer at each site. P3-B3 proves the helper and P3-B5 proves the R2 paths.
  - Oracle: the structural checks below, and the registration tests stay green.

#### Success Criteria: p3-s2-registry-decode

- Red then green for P3-B3 and P3-B4 with the smallest Vitest command, then `pnpm check` and `pnpm check:dead-code`. P3-B5 and P3-B6 are green before and after.
- Structural checks over `apps/harness/src/registration -g '!*.test.*'`:
  - `rg -n "registryRows\("` finds only `registry-database.ts`;
  - `rg -n "JSON\.parse"` finds only `registry-database.ts`;
  - `rg -n "decodeStrict(Result)?\([^)]*\.rows\b"` finds nothing;
  - `rg -n '"REGISTRY_CORRUPT"'` finds exactly one line, in `registry-failure.ts`;
  - `rg -n "catch \{"` finds none in `registration-proposal-store.ts` and only the `readPublication` catch in `registration-confirmation-store.ts`.
- **Heavy runs:**
  - The red-green command for P3-B4 is `registration-stored-damage.integration.test.ts` (real SQLite, Windows x64). The implementer tells the coordinator before it if it takes over 2 minutes.
  - Once at the candidate, with the coordinator's GO: `project-registration.integration.test.ts`, `registration-restart-reconciliation.integration.test.ts`, `registration-identity-query-lifecycle.integration.test.ts`, `registration-clock.integration.test.ts` and `registration-preparation.integration.test.ts` (the touched read paths).
  - The rest run in `check:deep` before the push. No mutation run.
- **Bindings,** each restored by digest:
  - the helper rethrowing the raw error makes P3-B3 and every P3-B4 row fail;
  - `observer-journal.ts:158` going back to a bare `decodeStrict(…, JSON.parse(…))` makes P3-B4 row f fail;
  - `readReservation` returning `undefined` for a missing row makes the first P3-B5 row fail.
- CodeScene `code_health_score` on every changed source file (target 10).

#### Open questions for p3-s2 (numbered after Q9)

- **Q10, scope of "over rows."**
  - (a) **Recommended.** The 33 sites whose input is read from `application.db` (the rule above). Blast: 11 source files, 4 test files, 20 answers flip.
  - (b) Only the R2 sites and the 7 bare `JSON.parse`. This leaves 13 bare row and cell decodes on `INTERNAL_FAILURE`, so L4-04's "one decode owner" is not met and the `rg` checks cannot be exact.
- **Q11, the Effect-side sites (`list-visibility.ts:18`, `existing-registration.ts:41`).**
  - (a) **Recommended.** They join the owner: the same `RegistryReadFailed` value, 2 files, no change in behaviour, and Part B has one constant to switch.
  - (b) They stay until Part B. Two hand-written corrupt values remain.
- **Q12, the behaviour change and its proof.**
  - (a) **Recommended.** Accept the 20-site flip from `INTERNAL_FAILURE` to `REGISTRY_CORRUPT` for stored damage. Prove the 9 observable sites per row (P3-B4), and the 11 defended sites at the helper (P3-B3) and structurally.
  - (b) Also plant CHECK-violating damage for the 11 defended sites. Rejected: `integrity_check` refuses the whole database at open as `REGISTRY_CORRUPT`, so those rows would pass today for the wrong reason (a false proof).
  - (c) Leave the defended sites bare. Two shapes stay, and a loosened CHECK reopens `INTERNAL_FAILURE`.

### 2026-10-25: p3-s2 approved, Q10-Q12 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s2-registry-decode` at `content_hash 1c3af43880d6de9b96dd47f1f7b54e6cb241e8fd56ada51018d92dbb3f426fca`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-1c3af438.md` (main checkout). The contract (P3-B3 to P3-B6) stands as written. Lane normal.
- **Q10 (a):** the 33-site rule; a decode is in scope when its input is read from `application.db`.
- **Q11 (a):** `list-visibility.ts` and `existing-registration.ts` join the owner with the same `RegistryReadFailed` value.
- **Q12 (a):** the 20 bare sites answer `REGISTRY_CORRUPT` for stored damage; 9 observable sites proven by P3-B4 rows, 11 defended sites by P3-B3 and the structural checks.

### 2026-10-25: slice p3-s3-ledger-refusals detailed

Coordinator instruction (2026-10-25): detail s3 just in time, append-only, lane normal per Q3 (a) plus the one scoped ledger mutation run Pedro chose; open choices as Q13+ with a recommendation, not decided. Measured read-only at `42188e8` (the p3-s2 head). Predecessor guarantees used: none from s2 (s3 touches no registration file); s1's `project-storage-node-errors.ts` is not touched.

#### Slice p3-s3-ledger-refusals

- **Lane:** normal. `lane.mjs --paths` over the planned paths below answers `normal` (`files: 8 > 5`, `manifest: package.json`). Q3 (a) already raised it from fast; the measurement now agrees on its own.
- **Finding:** L5-04 (acceptance: "the shared oracle asserts a specific refusal code"; test strategy: "mutation run on the ledger after the change").

**Measured at `42188e8` (read-only):**

- `canonical-command-ledger.ts` has 14 `throw new Error(...)` statements (`:119`, `:201`, `:210`, `:216`, `:252`, `:281`, `:292`, `:298`, `:319`, `:365`, `:404`, `:412`, `:451`, `:455`). `:365` is one statement with two messages (a ternary on `conflict`), so there are **15 refusal checks** and **12 distinct messages**: `:281` and `:412` share "Canonical original receipt authority is inconsistent.", `:365` (conflict branch) and `:451` share "Canonical conflict receipt authority is inconsistent.", `:365` (requested branch) and `:404` share "Canonical requested receipt authority is inconsistent.". The Architecture text's "14-member tuple" counted statements (Q13).
- Other failures that leave the same readers are **not** ledger refusals: `decodeStrict` (`Schema.SchemaError`), the `canonical-json.ts` helpers (`canonicalResultObjects` `:18`, `:20`; `canonicalExactlyOne` `:28`; `canonicalChangedOnce` `:33`; plain `Error` with fixed messages) and `JSON.parse` in `parseCanonicalJson` (`SyntaxError`). Q15.
- Who sees a refusal today:
  - `repository.settle` rejects with the raw error (the fixture's `knownBodyFailure(f, sentinel)` rows prove identity passes through); `canonical-project-writer.ts:181-188` closes admission and rethrows any non-`WriterOwnerBusy` error.
  - `verifyFence` (`canonical-command-repository.ts:499-516`) wraps it as `CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED", { cause })`; the writer answers `{ status: "broken", code: "WRITER_FENCE_CHECK_FAILED" }`.
  - Activation (`failedActivation`, `:578`) wraps it with `cause`; the recovery oracles assert `WRITER_FENCE_ACTIVATION_FAILED` and the wire message "Writer fence could not be activated.".
  - `process-fatal-diagnostics.ts:95-102` would name the tag instead of `kind: "error"`, but no settle or activation path reaches a fatal sink today; s4 owns the request-failure log.
- Weak oracles (`toBeInstanceOf(Error)` with no further assertion on the value) in the ledger test files:
  - `canonical-command-fixture.ts:1154` `expectBrokenReplay` (the shared oracle; 2 test files, about 200 rows through `it.each`);
  - `canonical-command-fixture.ts:765` `expectRejectionInsertFault` (modes 0 and 2 reach `canonicalChangedOnce` in `persistRejection`);
  - `canonical-command-repository.integration.test.ts:884` (malformed fence, 23 rows), `:914` (fence observation shapes, 4 rows), `:1549` (F2 fractional fence pairs);
  - out of the ledger: `canonical-command-fixture.ts:1189` `knownBodyFailure` (handler body failures) and `canonical-command-driver.integration.test.ts:87` (commit error).
  - The one pinned message: `canonical-writer-reconciliation.integration.test.ts:76`.
- CodeScene at `42188e8`: `canonical-command-ledger.ts` 10.0; `canonical-command-fixture.ts` 10.0; `canonical-writer-reconciliation-fixture.ts` 10; `canonical-writer-recovery-fixture.ts` 10; `canonical-writer-reconciliation.integration.test.ts` 10; **`canonical-command-repository.integration.test.ts` 9.38** ("Lines of Code in a Single File", 1007 LoC). Q16.
- No mutation config mutates the ledger today (`rg canonical stryker*.json`: only the writer, conversation and protocol). There is no prior ledger score.

**Deliverable:**

- New `apps/harness/src/storage/canonical-ledger-refusal.ts`, the one owner:
  - `CANONICAL_LEDGER_REFUSALS`, a readonly tuple of the refusal literals (15 under Q13 (a)), and the type derived from it;
  - one message per literal, byte for byte the message thrown today;
  - `class CanonicalLedgerRefusal extends Data.TaggedError("CanonicalLedgerRefusal")<{ readonly refusal: …; readonly message: string }>` (the `WriterOwnerBusy` / `RegistryReadFailed` shape) and one constructor `canonicalLedgerRefusal(refusal)` that fills the message from the table.
  - It is not a protocol code: nothing in `packages/protocol` changes.
- `canonical-command-ledger.ts`: each of the 15 checks throws `canonicalLedgerRefusal(<its literal>)`; no `throw new Error(` remains in the file. The guard conditions, their order and every other line stay as they are.
- The oracles take a required expectation (no default, no "any error" member), a closed union:
  - `{ refusal: <literal> }`: `_tag` `"CanonicalLedgerRefusal"`, `refusal` equal, `message` equal to the literal message written out in the test, `instanceof Error`;
  - `{ decode: true }`: `instanceof Schema.SchemaError`, and not a refusal;
  - `{ shape: <exact message> }`: a plain `Error` (no `_tag`) with that exact `canonical-json.ts` message;
  - `{ syntax: true }`: `instanceof SyntaxError`;
  - `{ sentinel: <value> }`: `toBe` identity, the existing SQL-exception rows.
- Oracles in scope (Q14 (a)): `expectBrokenReplay`, `expectRejectionInsertFault` modes 0 and 2, the three inline fence oracles, and `expectBrokenRecoveryActivation` / `expectRecoveryLedgerCase` (the activation's `error.cause` is asserted with the same expectation; the wire answer stays as pinned). Every existing call site declares its expectation.
- Q16 (a): the fence-authority family moves to a new `canonical-command-fence.integration.test.ts`.
- Mutation: new `stryker.ledger.config.json`, `apps/harness/vitest.ledger-mutation.config.ts`, and the root script `test:mutation:ledger:harness` (below).

**Planned paths (lane.mjs input):** `apps/harness/src/storage/canonical-ledger-refusal.ts`, `apps/harness/src/storage/canonical-ledger-refusal.test.ts`, `apps/harness/src/storage/canonical-command-ledger.ts`, `apps/harness/tests/integration/canonical-command-fixture.ts`, `apps/harness/tests/integration/canonical-command-repository.integration.test.ts`, `apps/harness/tests/integration/canonical-command-fence.integration.test.ts`, `apps/harness/tests/integration/canonical-writer-reconciliation-fixture.ts`, `apps/harness/tests/integration/canonical-writer-reconciliation.integration.test.ts`, `apps/harness/tests/integration/canonical-writer-recovery-fixture.ts`, `apps/harness/tests/integration/canonical-project-settlement.integration.test.ts`, `stryker.ledger.config.json`, `apps/harness/vitest.ledger-mutation.config.ts`, `package.json`.

**Constraints:**

- Promise code stays Promise code (Architecture: "Settle still rejects"; §103 point 4 moved the Promise facades to #123 Part B). Throwing the tagged value is the Q2 (a) precedent; Part B turns it into `Effect.fail`. No `Effect.runPromise`, no new runtime, no `Effect.provide`.
- `Data.TaggedError` (not `extends Error`), so the slice adds no `extendsNativeError` warning; `check:effect` stays at its measured advisory count for this file (0 before, 0 after).
- No guard is reordered, merged, removed or added. A row whose observed failure differs from the prediction table below is a **stop and report** to the coordinator, never a silent edit of the prediction or of the guard.
- D1 ledger: nothing on the wire changes. Every envelope, code, status, diagnostic message and retryable flag stays; the settle rejection's message stays byte for byte; only the rejected value's class changes (plain `Error` to `CanonicalLedgerRefusal`, still `instanceof Error`).

#### Test Contract: p3-s3-ledger-refusals

Public seams: `LocalCanonicalCommandRepository.settle` and `verifyFence` through `createSettlementFixture` (real SQLite, `tests/integration/`); recovery activation through `activateRecovery` and the runtime `project.activate` request (`createRecoveryRuntime`); the writer's `settle` and `verifyFence` (`canonical-project-settlement.integration.test.ts`); the refusal module's exports (unit, beside source).

**Prediction table (P3-B7).** Each refusal is reached by the named row family at `42188e8`; "new" means no current row is known to reach it and the slice adds one. Literal names are proposals under Q13 (a).

| # | Site | Literal | Reaching row (family) |
|---|---|---|---|
| r1 | `:119` | `SETTLEMENT_FENCE_INCOHERENT` | malformed fence "Project mismatched", "joined generation mismatched", "joined digest mismatched", "active released fence"; F2 unequal pairs |
| r2 | `:201` | `NON_REJECTED_HAS_REJECTIONS` | "G6 applied rejection child"; `expectForbiddenUnchangedChild("rejections")` |
| r3 | `:210` | `REJECTION_SOURCE_BINDING` | new: a rejected original whose rejection child names another receipt or sequence (raw `UPDATE command_rejections`) |
| r4 | `:216` | `REJECTION_DETAILS_INTEGRITY` | reconciliation `rejections` rows with non-canonical `detailsText` and its own correct hash |
| r5 | `:252` | `ORIGINAL_RECEIPT_ORPHANED` | "G6 persisted orphan precedes differing request" |
| r6 | `:281` | `ORIGINAL_RECEIPT_AUTHORITY` | `originalAuthorityCases` pointer and receipt binding rows (fingerprint mismatch, Project, command, time, sequence above current, generation rows) |
| r7 | `:412` | `ORIGINAL_RECEIPT_IS_CONFLICT` | `canonical-writer-reconciliation.integration.test.ts:59` "S6-R1 B9" (values 7 and 8) |
| r8 | `:292` | `EVENT_SOURCE_BINDING` | `replayChildCases` "Project binding", "receipt binding", "sequence binding", "time binding" |
| r9 | `:298` | `EVENT_PAYLOAD_INTEGRITY` | G6 JSON "noncanonical correct hash", "reordered correct hash", "wrong digest", "changed payload only", "persisted digest" |
| r10 | `:319` | `NON_APPLIED_HAS_EVENTS` | `expectForbiddenUnchangedChild("events")` |
| r11 | `:365` conflict | `CONFLICT_RECEIPT_COMMAND` | "G6 stored type precedes G9 conflict" (`expectFirstConflict(conflictCases[2])`) |
| r12 | `:365` requested | `REQUESTED_RECEIPT_COMMAND` | new: raw `UPDATE command_receipts SET command_type=…` on an applied receipt, then replay (both reads see it, so `:403` passes and `:365` fires) |
| r13 | `:404` | `REQUESTED_RECEIPT_AUTHORITY` | "G6 requested fingerprint/type/version/identity/Project/command" (observer changes the second read only) |
| r14 | `:451` | `CONFLICT_RECEIPT_AUTHORITY` | reconciliation `requested` conflict-family rows (sequence, generation, receipt identity, fingerprint) |
| r15 | `:455` | `CONFLICT_RECEIPT_OUTCOME` | reconciliation `rejections` conflict-family rows (`TEST_COUNTER_REJECTED`, `COMMAND_TYPE_UNSUPPORTED`, `COMMAND_PAYLOAD_INVALID`) |

Rows in the same families whose damage is caught first by a decode or a helper (for example "pointer fingerprint malformed", "count null", "original width", "G6 JSON malformed JSON", "nonfinite JSON") declare `{ decode: true }`, `{ shape: … }` or `{ syntax: true }`; the implementer writes each declaration from reading the code before running it, and the red run checks it.

Behaviors:

- **P3-B7: each ledger check refuses with its own refusal.**
  - Given: the fixture state of each row in the table (r1–r15), at least one row per literal.
  - When: `repository.settle(text)` (r1 through the fence read; r7 with the conflicting request text).
  - Then: the rejection is `CanonicalLedgerRefusal` with `_tag` `"CanonicalLedgerRefusal"`, `refusal` the row's literal, `message` the exact current message (written as a string literal in the test), `instanceof Error` true; the snapshot is unchanged and no replay work ran (the oracle's existing assertions stay).
  - Expected red at the base: the message assertion passes and the `_tag` assertion fails (`expected undefined to be "CanonicalLedgerRefusal"`) for every refusal row; for r3 and r12 the same, once the new rows exist. A different red (for example a `SchemaError` where a refusal was predicted) stops the slice for a report.
- **P3-B8: the oracles name the failure they accept.**
  - Given: every existing call of the in-scope oracles (Q14).
  - When: the row runs.
  - Then: it passes only for its declared expectation; the union has no catch-all member and the parameter has no default.
  - Expected red: none for the `decode`, `shape`, `syntax` and `sentinel` rows. They are pins that run green at the base, and that proves the declarations against the code before it changes. The refusal rows are P3-B7's red.
- **P3-B9: the refusal table is the one owner of the messages.** (unit, `canonical-ledger-refusal.test.ts`)
  - Then: `CANONICAL_LEDGER_REFUSALS` has exactly the literals of the prediction table, in that order; `canonicalLedgerRefusal(r).message` equals the message written out in the test for each of them (12 distinct strings); the value is `instanceof Error` and carries `_tag` and `refusal`.
  - Expected red: the module does not exist (import fails) at the base.
- **P3-B10 (pin): what callers answer stays the same.**
  - a. Writer: a ledger refusal during a writer `settle` rejects that submission with the refusal, and the next `settle` answers `writer-unavailable` (`canonical-project-settlement.integration.test.ts`, a real refusal such as r5, not a fake).
  - b. Writer `verifyFence` on an incoherent fence (r1 state) answers `{ status: "broken", code: "WRITER_FENCE_CHECK_FAILED" }`; the repository's `CanonicalCommandRepositoryError` carries `cause` equal to the r1 refusal.
  - c. Recovery activation on a ledger-refusal case answers `status: "broken"` with `WRITER_FENCE_ACTIVATION_FAILED` and "Canonical Writer fence activation failed.", and `error.cause` is the refusal; the runtime `project.activate` answer stays `{ code: "WRITER_FENCE_ACTIVATION_FAILED", message: "Writer fence could not be activated.", retryable: false }`.
  - Expected red: only the `_tag`/`cause` refusal assertions in a–c are red at the base; everything else is green at the base and after.

**Bindings that bite (each shown failing once, then reverted; listed in the TDD record with the failing row and its message):**

1. Swap the literals of r6 and r7 (same message): the r6 and r7 rows fail; this proves a literal per check bites where the message cannot.
2. Restore `throw new Error(<same message>)` at one site (r13): its rows fail on `_tag`.
3. Turn one decode site in a predicted `{ decode: true }` row's path into a refusal: that row fails (the union separates kinds).
4. Drop the final "." from one message in the table: P3-B9 and `canonical-writer-reconciliation.integration.test.ts:76` fail.
5. Delete the expectation argument at one oracle call: `pnpm typecheck` exits non-zero with TS2554 (read the exit code, not the summary).
6. Swap two adjacent guards' order in `readConflict` (r14 before the requested check): the reconciliation conflict rows fail.

**Structural checks (on the candidate):**

- `rg -n "throw new Error\(" apps/harness/src/storage/canonical-command-ledger.ts` → 0 lines.
- `rg -n "Data\.TaggedError\(\"CanonicalLedgerRefusal\"\)" apps/harness/src` → exactly 1 line (the owner).
- Each of the 12 messages: `rg -F -c "<message>" apps/harness/src` → 1 (the table), and `rg -F "<message>" apps/harness/src/storage/canonical-command-ledger.ts` → 0.
- `rg -n "toBeInstanceOf\(Error\)" apps/harness/tests/integration/canonical-command-fixture.ts apps/harness/tests/integration/canonical-command-repository.integration.test.ts apps/harness/tests/integration/canonical-command-fence.integration.test.ts` → only lines that are followed in the same oracle by an exact assertion on the value, or `knownBodyFailure` (`:1189` today), under Q14 (a). The implementer lists each surviving line in the TDD record.
- `rg -n "canonical-ledger-refusal" packages` → 0 (not a protocol vocabulary).

#### Success Criteria: p3-s3-ledger-refusals

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run --config vitest.integration.config.ts <the touched integration files>` and `pnpm --filter @slopstop/harness exec vitest run src/storage/canonical-ledger-refusal.test.ts`. The five ledger integration files run real SQLite; if one run passes 2 minutes, tell the coordinator before the next one.
- `pnpm typecheck` exit 0; `pnpm check` exit 0 (it runs `check:effect`; the advisory count must not rise; read CPU first in its own call).
- CodeScene 10 on every touched file, including the pre-existing 9.38 of the repository test (Q16).
- At the candidate, with the coordinator's GO: the 6 ledger test files together, and the scoped mutation run below, alone.

**The scoped ledger mutation run (waits for the coordinator's GO; runs alone):**

- **Config:** `stryker.ledger.config.json`, written like `stryker.project-storage.config.json`: `testRunner` vitest, `coverageAnalysis` `perTest`, `ignoreStatic` true, `incremental` false, `concurrency` 4, reporters json and html, `htmlReporter.fileName` `reports/mutation/ledger-harness.html`, `jsonReporter.fileName` `reports/mutation/ledger-harness.json`, thresholds high 90 / low 80 / break 80.
- **Mutate scope (exact):**
  - `apps/harness/src/storage/canonical-ledger-refusal.ts` (whole file);
  - `apps/harness/src/storage/canonical-command-ledger.ts`, the reader functions only: at `42188e8` lines `62-121` (`coherentCanonicalWriterRelease`, `currentCanonicalSettlementFence`, `readCanonicalWriterFence`) and `192-461` (`readRejection` to `checkRequestedReceipt`). The writers `persistRejection`, `persistOriginalPointer`, `persistCanonicalSettlement` (`463-560`) are out. The candidate's ranges are the same functions; the implementer writes the exact candidate line ranges into the config and the TDD record before the run, and a range that covers anything outside those functions is a fault.
- **Tests (`apps/harness/vitest.ledger-mutation.config.ts`, `testTimeout` 15 000 like the integration config):** `src/storage/canonical-ledger-refusal.test.ts` and `tests/integration/` `canonical-command-repository`, `canonical-command-fence`, `canonical-writer-reconciliation`, `canonical-writer-recovery`, `canonical-project-settlement`, `canonical-command-driver` (`.integration.test.ts`).
- **Command:** `pnpm test:mutation:ledger:harness` (root script: `pnpm exec stryker run stryker.ledger.config.json`), from the worktree root, with nothing else running.
- **Baseline:** Q17.
- **Pass criterion (all three):**
  1. Stryker exits 0 (the break threshold of 80 holds), read from the real exit code;
  2. in the JSON report, every mutant whose location is one of the 15 refusal checks (the guard condition and its `throw`) and every mutant in `canonical-ledger-refusal.ts` is `Killed` or `Timeout`;
  3. every other `Survived` or `NoCoverage` mutant in the scope is listed in the TDD record with its location and replacement, and is either killed by an added row (raise-only) or shown equivalent and accepted by Pedro per mutant. None is waived in bulk.
- **Evidence:** the JSON report is copied to `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/mutation-ledger-<candidate sha>.json` with the score, the run time and the exit code in the TDD record.

Manual: none.

#### Open questions for p3-s3 (numbered after Q12)

- **Q13: refusal vocabulary.**
  - (a) **Recommended.** One literal per check: 15 literals, 12 messages kept byte for byte. The shared-message pairs (`:281`/`:412`, `:365`/`:451`, `:365`/`:404`) become distinguishable, which is what L5-04 asks ("a guard swapped for another refusal still passes"). Blast: 1 new file, 15 lines in the ledger.
  - (b) One literal per message: 12 literals. Simpler, but r6/r7, r11/r14 and r12/r13 swaps stay invisible to the oracle.
  - (c) One per throw statement: 14 literals, the Architecture's count. `:365` would carry one literal for two messages, so the literal no longer names the check.
- **Q14: which oracles.**
  - (a) **Recommended.** Every weak oracle that reaches ledger code: `expectBrokenReplay` (`:1154`), `expectRejectionInsertFault` modes 0/2 (`:765`), the inline fence oracles (`:884`, `:914`, `:1549`), and the activation cause in the recovery oracles. `knownBodyFailure` (`:1189`, handler failures) and the driver's `:87` stay out: not ledger. Blast: about 230 row declarations across 4 test files and 3 fixtures; no assertion is removed.
  - (b) Only the shared `expectBrokenReplay`, the finding's literal acceptance. The fence oracles keep accepting any `Error`, and r1 has no oracle that names it.
- **Q15: decode and helper failures inside the ledger.**
  - (a) **Recommended.** They stay what they are (`SchemaError`, the `canonical-json.ts` errors, `SyntaxError`) and the oracle asserts their exact kind. `canonical-json.ts` serves conversation, repository, recovery and settlement too; typing it belongs to its own owner change (or Part B).
  - (b) Wrap them as refusals too (`DECODE`, `SHAPE`). Every replay failure would carry one class, but `canonical-json.ts` and its 4 consumers join the slice (lane stays normal, the mutation scope grows).
- **Q16: the repository test's 9.38.**
  - (a) **Recommended.** Move the fence-authority family (stale, malformed, observation, F2 rows; about 200 lines) to `canonical-command-fence.integration.test.ts` with the same test names and assertions, the only change being the oracle expectation. Under the reclassification rule the coordinator approves the move. Both files reach 10.
  - (b) Accept 9.38 as pre-existing debt. That breaks "CodeScene 10 on touched files", and the file grows by the new declarations.
- **Q17: mutation baseline.**
  - (a) **Recommended.** The one run Pedro chose, on the candidate. The baseline is the absolute criterion above (break 80, every refusal-check mutant killed). The base's weakness is already proven by the P3-B7 red at the base and by bindings 1–2, so no second run is needed.
  - (b) Two runs with the same config: first at `42188e8` with the old oracles (the baseline score), then on the candidate; pass also needs a higher score than the base. It is a measured delta, but it doubles the cost and it is not the "one run" Pedro chose.

### 2026-10-25: p3-s3 approved, Q13-Q17 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s3-ledger-refusals` at `content_hash 19dbee497d277e1280036c91cd4ec6a1d366c383804719125eea7607bd753a44`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-19dbee49.md` (main checkout). The contract (P3-B7 to P3-B10), the prediction table, the bindings and the scoped mutation run stand as written. Lane normal.
- **Q13 (a):** 15 refusal literals, one per check; the 12 messages stay byte for byte.
- **Q14 (a):** every weak oracle that reaches ledger code takes a required exact expectation (`:1154`, `:765`, `:884`, `:914`, `:1549`, the recovery activation cause); `knownBodyFailure` and the driver's `:87` stay out.
- **Q15 (a):** decode, shape and syntax failures keep their kind and are asserted exactly; `canonical-json.ts` is not touched.
- **Q16 (a):** the fence-authority family moves to `canonical-command-fence.integration.test.ts` with the same names and assertions, the oracle expectation being the only change; the coordinator approved the move.
- **Q17 (a):** one mutation run on the candidate, with the absolute criterion; it waits for the coordinator's GO and runs alone.

### 2026-10-26: slice p3-s4-request-failure-log detailed

Coordinator instruction (2026-10-26): detail s4 just in time, append-only, Q4 (a) (the full path through the desktop forwarder). Measured read-only at `9e2fdde` (the p3-s3 head). Predecessor guarantees used: s3's `CanonicalLedgerRefusal` is a `Data.TaggedError`, so a ledger refusal that reaches a request boundary summarizes as `{ tag: "CanonicalLedgerRefusal" }` (the Deferred Work trigger "the ledger refusal tag reaches the summary"); s1 and s2 files are not touched.

#### Slice p3-s4-request-failure-log

- **Lane:** normal. `lane.mjs --paths` over the planned paths below answers `normal` (`files: 9 > 5`). No sensitive word.
- **Findings:** L3-02 (acceptance: "each boundary catch logs one redacted line"; test strategy: "runtime test with a throwing handler asserts one log line without paths or messages") and IX-8 (the root: no runtime-wide diagnostics port).

**Measured at `9e2fdde` (read-only):**

- **Boundary sites.** I swept every `catch` in `apps/harness/src`, not only the ones the finding names. Six sites answer a request or notification with a fixed failure and drop the value:

  | Boundary literal | Site | Answer sent (unchanged) | Value reaching it |
  |---|---|---|---|
  | `harness.message` | `harness-runtime.ts:407` (`.catch(() =>`) | `HARNESS_INTERNAL_FAILURE`, correlated to the message id | any rejection of a message handler: canonical, storage, workspace, conversation, listing, a throwing `transport.send` |
  | `harness.notification` | `harness-runtime.ts:417` (`catch {`) | `system.failure` `HARNESS_INTERNAL_FAILURE` | the `WorkspaceNotificationSchema` decode (`Schema.SchemaError`, a `Data.TaggedError("SchemaError")`), or a throwing `transport.send` |
  | `harness.registration` | `harness-runtime.ts:350` (an `Exit` failure, not a `catch`) | `HARNESS_INTERNAL_FAILURE` | `Cause.squash(exit.cause)`: the first `Fail`, else the first `Die`, else `Error("All fibers interrupted without error")` (`effect/dist/internal/effect.js:171-180`) |
  | `project-storage.owner` | `project-storage-application.ts:117` (`catch {`) | `broken` `PROJECT_STORAGE_OWNER_FAILED` "Project Storage owner failed." | an owner rejection, or a throw inside `mapOwnerOutcome` |
  | `workspace.query` | `workspace-application.ts:147` (`catch {`) | `broken` `WORKSPACE_PRODUCER_FAILED` "<Capability> producer failed." | a port `query` rejection |
  | `workspace.intent` | `workspace-application.ts:192` (`catch {`) | `broken` `WORKSPACE_PRODUCER_FAILED` "<Capability> producer failed." | a port `submit` rejection |

  - The finding counts 4 sites; the brief's Architecture names 5. `:350` is the sixth: it answers like `:407` but from an `Exit`, so a `catch` sweep misses it (the `e55b35b` lesson).
  - The other `catch` sites map to their own domain codes, which the answer already carries (for example the release codes at `active-project-coordinator.ts:313` and the writer's `canonical-project-writer.ts:259-286`). They are not request-boundary catch-alls and stay out.
  - In production, `process-bootstrap.ts:206` installs `createUnavailableWorkspaceApplication()`, whose ports never throw. So the two workspace sites are unreachable in the app today and reachable only with a real port; the rows prove them through `createWorkspaceApplication` with throwing ports.
  - The protocol-parse failure (`:386-392`, `PROTOCOL_MESSAGE_INVALID` / `PROTOCOL_VERSION_UNSUPPORTED`) is an expected failure with its own code, not a catch: it gets no line.
- **Reaching rows at the base** (each runs green today; the slice adds the log assertion):

  | Boundary | Row | Value | Predicted summary |
  |---|---|---|---|
  | `harness.message` | `harness-runtime.test.ts` "round-trips canonical activation and contains canonical request failures" (activate rejects with `Error("C:\\private\\project\\slopstop.db")`, execute with `Error("secret command payload")`) | plain `Error` ×2 | two lines, each `failures: [{ kind: "error" }], omittedFailures: 0` |
  | `harness.message` | "reports a neutral internal failure when Project dispatch throws" (`open` throws `Error(<path>)`) | plain `Error` | `[{ kind: "error" }]` |
  | `harness.message` | "turns an unexpected application rejection into correlated harness failure" (workspace `query` throws at application level) | plain `Error` | `[{ kind: "error" }]` |
  | `harness.notification` | "turns an invalid workspace notification into harness failure"; `failureScopeCases` kind `notification` | `SchemaError` | `[{ tag: "SchemaError" }]` |
  | `harness.registration` | "answers registration exits on the process runtime: handle dies" (`Effect.die(new Error("private registration defect"))`) | plain `Error` | `[{ kind: "error" }]` |
  | `harness.registration` | "…: handle interrupts itself before any stop" (`Effect.interrupt`) | `Error("All fibers interrupted without error")` (Q19 (a)) | `[{ kind: "error" }]` |
  | `project-storage.owner` | `project-storage-application.test.ts:104-109` (owner throws `Error("private owner failure")`) | plain `Error` | `[{ kind: "error" }]` |
  | `workspace.query` | `workspace-application.test.ts` "distinguishes thrown producers from invalid projections" (`:164`, `Error("provider failed")`) | plain `Error` | `[{ kind: "error" }]` |
  | `workspace.intent` | `workspace-application.test.ts:108` (`Error("forwarding failed")`) | plain `Error` | `[{ kind: "error" }]` |

  No line for: the `PROTOCOL_MESSAGE_INVALID` rows of `failureScopeCases`, any successful request, an owner that returns a `broken` or `unavailable` outcome (no catch), and "interrupts an in-flight registration request at dispose without a reply" (`:349` returns before `:350`).
- **The harness log today** (`process-entry.ts:32`, `harness-logger.ts`): one Pino logger, JSON on stdout, `base: { service: "harness" }`. The runtime receives none: `HarnessRuntimeIo.logger` is typed `UpgradeEventLogger` (`info(object)`, `warn(object)`, no message argument) and reaches only `UpgradeLog` (`process-bootstrap.ts:225`), the upgrade diagnostics and the reconciliation warning (`:304`).
- **The desktop forwarder** (`harness-log-lines.ts:44-52`) keeps a line only if it names a known upgrade `event`, or a known fatal `code` at level 60. Anything else is dropped without a trace. That includes the existing `{ code: "REGISTRATION_RECONCILIATION_FAILED" }` warning at `process-bootstrap.ts:304`: it never reaches `slopstop.jsonl` today (Q24).
- **e2e:** `expectDesktopLog` (`apps/desktop/tests/e2e/electron-launch.ts:72-83`) counts start lines, compares the upgrade lines, and refuses any `HARNESS_LOG_LINE_` code. It does not look at other forwarded lines.
- **Blast radius of a required port** (`rg -F -c`): `startHarnessRuntime(` 38 calls in 16 files; `createProjectStorageApplication(` 22 in 12; `createUnavailableProjectStorageApplication(` 28 in 7; `createWorkspaceApplication(` 6 in 2; `createUnavailableWorkspaceApplication(` 33 in 14; `harnessServicesLayer(` 4 in 2; `launchHarnessProcessRuntime(` 3 in 2; `startHarnessProcessRuntime(` 11 in 9. Q20.
- **CodeScene at `9e2fdde`:** 10 on `harness-runtime.ts`, `process-bootstrap.ts`, `project-storage-application.ts`, `workspace-application.ts`, `harness-log-lines.ts`, `harness-fatal-log-protocol.ts`, `harness-runtime.test.ts`, `process-bootstrap.test.ts`, `project-storage-application.test.ts`, `workspace-application.test.ts`, `harness-log-lines.test.ts`, `protocol.test.ts`. No touched file starts below 10.

**Deliverable:**

- **Protocol** (`packages/protocol/src/harness-fatal-log-protocol.ts`, exported from `index.ts`):
  - `HARNESS_REQUEST_BOUNDARIES`, the 6 literals above, and `harnessRequestBoundaryAnswers`, one table from boundary to the code it answers (`HARNESS_INTERNAL_FAILURE` ×3, `PROJECT_STORAGE_OWNER_FAILED`, `WORKSPACE_PRODUCER_FAILED` ×2);
  - `harnessRequestFailureCode = "HARNESS_REQUEST_FAILED"` and its one fixed message `"Harness request failed."`;
  - `HarnessRequestFailureLogLineSchema`: exactly `{ level: 40, time, service: "harness", code: "HARNESS_REQUEST_FAILED", msg: "Harness request failed.", boundary, answered, failures, omittedFailures }`. It is a union by boundary, so `answered` must be that boundary's code. `failures` / `omittedFailures` reuse the fatal summary fields (the same entry union, the same bound of 16), so the two summaries cannot drift apart.
  - No envelope protocol version changes (#133 precedent): this is a log line, not a message.
- **Harness writer:** new `apps/harness/src/harness-request-diagnostics.ts`:
  - `HarnessRequestDiagnostics = Readonly<{ requestFailed(boundary, failure: unknown): void }>`;
  - `createHarnessRequestDiagnostics(logger)`. It writes `logger.warn({ code, boundary, answered: harnessRequestBoundaryAnswers[boundary], ...summarizeHarnessFailure(failure) }, message)`. It imports the summarizer from `process-fatal-diagnostics.ts` (shared, not copied) and never reads the failure's message, cause or stack. It **never throws**: a throwing logger is swallowed, so a log failure cannot change an answer.
- **Wiring (Effect 4):**
  - The process logger becomes one runtime-wide service, built by a Layer in `harnessServicesLayer` (Q22). `HarnessRuntimeIo.logger` is widened to the two Pino calls it uses with a message argument (`info(object, message?)`, `warn(object, message?)`).
  - `launchHarnessProcessRuntime` reads the diagnostics once in its existing `runtime.runSync` and passes them to `startHarnessRuntime`, `createProjectStorageApplication` and `createUnavailableWorkspaceApplication` / `createWorkspaceApplication`.
  - No `Effect.runPromise` at a call site, no runtime per call, no `Effect.provide` per request. The port is a synchronous plain call, like the `UpgradeLog` and `HarnessFatalSink` precedents.
- **Call sites:**
  - Each of the 6 boundaries binds its value and calls `requestFailed(<its literal>, <value>)` exactly once, then answers exactly as today.
  - `:350` passes `Cause.squash(exit.cause)` (Q19).
  - No `catch {` remains at the four `catch` sites.
- **Desktop forwarder** (`harness-log-lines.ts`): a third candidate kind, `code === "HARNESS_REQUEST_FAILED"` at level 40.
  - It is decoded strictly with the protocol schema and logged as `logger.warn({ source: "harness", attempt, code, boundary, answered, failures, omittedFailures, harnessTime }, "Harness request failure.")`.
  - A line that fails the decode logs `warn({ code: "HARNESS_LOG_LINE_INVALID", attempt, requestCode: "HARNESS_REQUEST_FAILED" }, "Harness request failure log line rejected.")`.
- **e2e pin** (Q23): `expectDesktopLog` also refuses any `"Harness request failure."` line, so every journey proves it hits no boundary catch.

**Planned paths (lane.mjs input):** `packages/protocol/src/harness-fatal-log-protocol.ts`, `packages/protocol/src/harness-fatal-log-protocol.test.ts`, `packages/protocol/src/index.ts`, `apps/harness/src/harness-request-diagnostics.ts`, `apps/harness/src/harness-request-diagnostics.test.ts`, `apps/harness/src/harness-runtime.ts`, `apps/harness/src/harness-runtime.test.ts`, `apps/harness/src/process-bootstrap.ts`, `apps/harness/src/process-bootstrap.test.ts`, `apps/harness/src/project-storage-application.ts`, `apps/harness/src/project-storage-application.test.ts`, `apps/harness/src/workspace-application.ts`, `apps/harness/src/workspace-application.test.ts`, `apps/harness/src/process-fatal-diagnostics.ts`, `apps/desktop/src/main/harness-log-lines.ts`, `apps/desktop/src/main/harness-log-lines.test.ts`, `apps/desktop/tests/e2e/electron-launch.ts`. Under Q20 (a), add the test files that construct the runtime or the applications (a shared recording / silent diagnostics fixture beside `silentHarnessLogger`, `tests/integration/project-storage-runtime-fixture.ts:40`).

**Constraints:**

- Redaction: a line carries only codes, the boundary literal, tags (`HARNESS_FAILURE_TAG_PATTERN`), cleanup part names, release codes, value kinds and counts. It never carries a message, a path, a cause, a stack, a request payload or a message id (Q21).
- D1 ledger: nothing on the wire changes. Every envelope, code, status, diagnostic message and retryable flag stays; the only new output is one log line per boundary failure.
- degrade-distinguishes-broken: the port has no "silent" default in production code (Q20); a failure at a boundary is logged, never only answered.
- Effect 4: no new error types; no `extendsNativeError` or `anyUnknownInErrorContext` warning added (`check:effect` advisory count does not rise).

#### Test Contract: p3-s4-request-failure-log

- **Behavior P3-B11: the protocol owns one exact request-failure log line.**
  - Test: `packages/protocol/src/harness-fatal-log-protocol.test.ts`.
  - Accepts, for each of the 6 boundaries, `{ level: 40, time: <epoch ms>, service: "harness", code: "HARNESS_REQUEST_FAILED", msg: "Harness request failed.", boundary, answered: <its code>, failures: [{ kind: "error" }], omittedFailures: 0 }`, and the entry shapes `{ tag }`, `{ tag: "RegistrationCleanupUnconfirmed", parts }`, `{ tag: "CanonicalProjectReleaseFailed", code }`.
  - Rejects:
    - each extra key `message`, `err`, `stack`, `cause`, `messageId`;
    - `msg` other than the fixed text;
    - level 30, 50 and 60;
    - an unknown boundary;
    - `answered` from another boundary (`project-storage.owner` with `HARNESS_INTERNAL_FAILURE`);
    - a tag `"C:\\private"` (pattern);
    - 17 failures;
    - `omittedFailures` -1 or 0.5.
  - Expected red: `HarnessRequestFailureLogLineSchema` is not exported, so the import is `undefined` and the first decode throws (`TypeError`) before any assertion.
- **Behavior P3-B12: the harness writer emits that line and nothing private.**
  - Test: `apps/harness/src/harness-request-diagnostics.test.ts`, with `createHarnessLogger(<captured destination>)` (the real Pino options).
  - For `new Error("C:\\private\\project\\slopstop.db", { cause: new Error("secret cause") })` at `harness.message`: exactly one line. It decodes strictly with P3-B11 as `failures: [{ kind: "error" }], omittedFailures: 0`, and its raw text contains none of `private`, `slopstop.db`, `secret`, `C:\\`, `stack`.
  - For a `canonicalLedgerRefusal("ORIGINAL_RECEIPT_ORPHANED")` value (the s3 owner): `[{ tag: "CanonicalLedgerRefusal" }]`.
  - For an `AggregateError` of 17 errors: 16 entries and `omittedFailures: 1`.
  - For `project-storage.owner`: `answered: "PROJECT_STORAGE_OWNER_FAILED"`.
  - A logger whose `warn` throws: `requestFailed` returns normally.
  - Expected red: the module does not exist (import fails).
- **Behavior P3-B13: each runtime boundary reports its failure once and answers as before.**
  - Test: `apps/harness/src/harness-runtime.test.ts`, with a recording port (it records `{ boundary, failure }` and asserts `failure` by identity, `toBe`).
  - The rows are the runtime rows of the reaching table. Each records exactly one call: `harness.message` with the rejected value; `harness.notification` with a value `instanceof Schema.SchemaError`; `harness.registration` with the defect for "handle dies", and with an `Error` whose message is `"All fibers interrupted without error"` for "handle interrupts itself". The round-trip row records two calls, in order.
  - Every reply envelope stays exactly as asserted today.
  - The no-line rows (protocol-invalid, successes, interrupt at dispose) record zero calls.
  - Expected red: zero calls recorded (`expected [] to deeply equal [{ boundary: "harness.message", … }]`) on every reaching row; the zero-call rows are green-at-base pins.
- **Behavior P3-B14: the Project Storage and workspace catches report once and answer as before.**
  - Test: `apps/harness/src/project-storage-application.test.ts`, `apps/harness/src/workspace-application.test.ts`, with the recording port.
  - A throwing owner records one `project-storage.owner` call with the thrown value (`toBe`), and the answer stays `broken` / `PROJECT_STORAGE_OWNER_FAILED` / "Project Storage owner failed.".
  - A throwing port `query` records one `workspace.query` call and a throwing `submit` one `workspace.intent` call, and both answers stay `WORKSPACE_PRODUCER_FAILED` with their capability message.
  - Owners returning `broken`, `unavailable` or an invalid `ready` result record zero calls.
  - Expected red: zero calls on the three throwing rows.
- **Behavior P3-B15: the process runtime writes the line through its Layer.**
  - Test: `apps/harness/src/process-bootstrap.test.ts`, through the real `startHarnessProcessRuntime` (the "routes the process runtime through its edges" pattern), with `createHarnessLogger(<captured destination>)` as `logger`.
  - The transport's `send` throws once, on the `system.ready` answer to a handshake. Then the destination holds exactly one line with `code: "HARNESS_REQUEST_FAILED"`. It decodes strictly with P3-B11 as `boundary: "harness.message", answered: "HARNESS_INTERNAL_FAILURE", failures: [{ kind: "error" }], omittedFailures: 0`, and the next `send` carries the `request.failure` `HARNESS_INTERNAL_FAILURE` as today.
  - Expected red: zero lines with that code.
- **Behavior P3-B16: the desktop forwards the line and only a valid one.**
  - Test: `apps/desktop/src/main/harness-log-lines.test.ts`.
  - A valid line (the P3-B11 accepted shape, as JSON text plus newline) gives exactly one `warn` call: `({ source: "harness", attempt, code: "HARNESS_REQUEST_FAILED", boundary, answered, failures, omittedFailures, harnessTime: <ISO of time> }, "Harness request failure.")`. It has no `level`, `time`, `service` or `msg` keys.
  - The same line with an extra `message` key gives exactly one `warn({ code: "HARNESS_LOG_LINE_INVALID", attempt, requestCode: "HARNESS_REQUEST_FAILED" }, "Harness request failure log line rejected.")`.
  - The same line at level 30 gives no call.
  - The existing upgrade and fatal rows stay as they are.
  - Expected red: zero calls for the valid line (it is dropped today).
- **Behavior P3-B17 (pin): no app journey hits a boundary catch.**
  - Test: `apps/desktop/tests/e2e/electron-launch.ts` `expectDesktopLog`, used by every journey: zero lines with `msg: "Harness request failure."`.
  - Expected red: none. It is green at the base, where such lines are dropped anyway, and it pins the journeys once the line is forwarded. It runs in the e2e set (`check:deep`, or with the coordinator's GO).

**Bindings that bite.** Each one is shown failing on a named row, then reverted, and listed in the TDD record with the failing row and its assertion message. All six fail a row by construction; none relies on an unobservable path.

1. Delete the `requestFailed` call at `:417`. P3-B13 "turns an invalid workspace notification into harness failure" fails (expects 1 call, gets 0).
2. Spread the failure into the line in the writer (`err: failure`). P3-B12 fails twice: the strict decode rejects `err`, and the raw text contains `private`.
3. Swap the boundary literals of `workspace-application.ts:147` and `:192`. Both P3-B14 workspace rows fail on `boundary`.
4. In `launchHarnessProcessRuntime`, pass a no-op port instead of the Layer's. P3-B15 fails (0 lines).
5. In the forwarder, accept the request code only at level 60. P3-B16's valid row fails (0 calls).
6. Make `:350` pass `exit.cause` instead of the squashed value. P3-B13 "handle dies" fails on identity (`toBe`).
7. Delete the diagnostics argument at one `createProjectStorageApplication` call. `pnpm typecheck` exits non-zero (TS2554 or TS2345); read the exit code.

**Structural checks (on the candidate):**

- `rg -n "catch \{" apps/harness/src/harness-runtime.ts apps/harness/src/project-storage-application.ts apps/harness/src/workspace-application.ts` → 0 lines.
- `rg -n "requestFailed\(" apps/harness/src --glob '!*.test.ts'` → exactly 6 call lines, one per boundary literal.
- `rg -n "function summarizeHarnessFailure" apps` → 1 (`process-fatal-diagnostics.ts`). `rg -n "summarizeHarnessFailure\(" apps/harness/src --glob '!*.test.ts'` → only `process-fatal-diagnostics.ts` and `harness-request-diagnostics.ts`.
- `rg -n "HARNESS_REQUEST_FAILED" packages/protocol/src --glob '!*.test.ts'` → defined once. `rg -n "HarnessRequestFailureLogLineSchema" apps/desktop/src` → the forwarder imports it.
- `rg -n "runPromise|runFork|ManagedRuntime" apps/harness/src/harness-request-diagnostics.ts apps/harness/src/project-storage-application.ts apps/harness/src/workspace-application.ts` → 0.

#### Success Criteria: p3-s4-request-failure-log

Automated (smallest first; each read by its real exit code):

- Red-green:
  - `pnpm --filter @slopstop/protocol exec vitest run src/harness-fatal-log-protocol.test.ts`;
  - `pnpm --filter @slopstop/harness exec vitest run src/harness-request-diagnostics.test.ts src/harness-runtime.test.ts src/project-storage-application.test.ts src/workspace-application.test.ts src/process-bootstrap.test.ts`;
  - `pnpm --filter @slopstop/desktop exec vitest run src/main/harness-log-lines.test.ts`.
- After the call-site migration (Q20): the harness integration files that construct the runtime, run as one batch; tell the coordinator first if it passes 2 minutes.
- `pnpm typecheck` exit 0; `pnpm check` exit 0 (`check:effect` advisory count must not rise; read CPU first in its own call).
- CodeScene 10 on every touched file.
- At the candidate, with the coordinator's GO: the e2e journeys for P3-B17. They also run in `check:deep` before the push.
- No mutation run. The project-storage mutation config already mutates `process-fatal-diagnostics.ts` (the shared summarizer) and parts of `harness-runtime.ts` and `process-bootstrap.ts`; if the coordinator wants it rerun on the candidate, that is his call.

Manual: none.

#### Open questions for p3-s4 (numbered after Q17)

- **Q18: which sites.**
  - (a) **Recommended.** The 6 boundaries above, including `:350` (an `Exit` failure that answers like `:407`) and the two workspace sites (unreachable in the app today, real once a port exists).
  - (b) The 5 the Architecture names. `:350` keeps answering `HARNESS_INTERNAL_FAILURE` with no line.
- **Q19: what `:350` reports.**
  - (a) **Recommended.** `Cause.squash(exit.cause)`, the `harness-runtime.ts:116` precedent. One value; a self-interrupt shows as `{ kind: "error" }`.
  - (b) Every `Fail` and `Die` value of the cause, in order (as an aggregate the summary flattens), plus a new value kind `interrupt` for interrupts. It is more exact, but the new kind changes the shared fatal vocabulary too.
- **Q20: how the port reaches the call sites.**
  - (a) **Recommended.** A required parameter on `startHarnessRuntime`, `createProjectStorageApplication` and both workspace factories, with a recording fixture and a silent one for tests. A forgotten wiring fails `pnpm typecheck`. Blast: about 140 call sites in about 30 test files, all mechanical.
  - (b) Optional with a no-op default. Small blast, but a production wiring that forgets it logs nothing, and only P3-B15 would notice for the runtime (not for the two applications).
- **Q21: line fields.**
  - (a) **Recommended.** Code, boundary, answered code and the summary only: the coordinator's bar of tags, codes and counts.
  - (b) Also the request `command` literal and the `messageId`. They give better correlation, but a message id is not on the bar, and the application sites do not know the message id.
- **Q22: the service.**
  - (a) **Recommended.** One process-log service (`HarnessLog`) in place of `UpgradeLog`. Upgrade diagnostics, the reconciliation warning and the request diagnostics are all built from it: the runtime-wide port IX-8 asks for. Blast: `process-bootstrap.ts` and its test.
  - (b) Keep `UpgradeLog` and add a second `RequestDiagnostics` service. That keeps two log ports for one logger.
- **Q23: proof in the real app.**
  - (a) **Recommended.** P3-B15 (the real process runtime, real Pino, strict decode) plus P3-B16 (the forwarder on the same schema) plus the P3-B17 pin in every journey. No journey can plant a boundary failure without a test-only fault in the packaged harness.
  - (b) A new e2e journey that plants a failure (for example a seeded damage that makes a request handler throw) and reads `"Harness request failure."` in `slopstop.jsonl`. It is the LOG-B7 pattern, at the cost of one more Windows e2e and a seed that must reach a catch-all.
- **Q24: the dropped `REGISTRATION_RECONCILIATION_FAILED` line.**
  - (a) **Recommended.** Fold it in. Its line gets a protocol schema (`code`, level 40, a fixed message) and becomes a fourth forwarder kind, with one row on each side. It is the same IX-8 root: a harness diagnostic the desktop drops. Blast: `process-bootstrap.ts:304` and the two forwarder files, all already touched.
  - (b) Record it as a residual for a later slice.

### 2026-10-26: p3-s4 approved, Q18-Q24 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s4-request-failure-log` at `content_hash e4a0b10923f443d61495918bb17461554c2f57d2257e2b70168e6948553fde86`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-e4a0b109.md` (main checkout). The contract (P3-B11 to P3-B17), the reaching table, the bindings and the structural checks stand as written. Lane normal. No mutation run.
- **Q18 (a):** all 6 boundaries, including `harness-runtime.ts:350` and the two workspace sites.
- **Q19 (a):** `:350` reports `Cause.squash(exit.cause)`, the `:116` precedent; the fatal vocabulary does not change.
- **Q20 (a):** the diagnostics port is a required parameter of `startHarnessRuntime`, `createProjectStorageApplication` and both workspace factories, with recording and silent test fixtures; a missing wiring fails `pnpm typecheck`.
- **Q21 (a):** the line carries the code, the boundary, the answered code and the summary only; no `command`, no `messageId`.
- **Q22 (a):** one process-log service (`HarnessLog`) in place of `UpgradeLog`; upgrade diagnostics, the reconciliation warning and the request diagnostics are built from it.
- **Q23 (a):** the app proof is P3-B15, P3-B16 and the P3-B17 pin in every journey; no new planted-failure journey.
- **Q24 (a):** the dropped `REGISTRATION_RECONCILIATION_FAILED` line is folded in: a protocol schema for its line and a fourth forwarder kind, with one row on each side. This adds behavior beyond P3-B11 to P3-B17; the implementer gives it the next free ID (P3-B18) in the TDD record, with its expected red, before writing it.

### 2026-10-26: slice p3-s5a-storage-errors detailed

Coordinator instruction (2026-10-26): detail the first s5a part just in time, append-only, next ID P3-B19, with the warning inventory taken from a fresh `pnpm check:effect` read at `feb59d9` (the p3-s4 head). The first part is `p3-s5a-storage-errors`, the first s5a row of the Deferred Work table; its trigger "after s4 (summary pin)" is met. `p3-s5a-registration-errors` and `p3-s5a-desktop-errors` stay deferred and get their own detail later. Q5 (a) (accept and pin the added `_tag`) and Q6 (a) (normal lane by override) are inherited, not asked again.

#### Fresh inventory at `feb59d9`

- `pnpm check:effect` in `slopstop-p3` at `feb59d9`: exit 0, "Effect diagnostics verified; 51 advisory warnings." (CPU 20% before the run; log `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5a-check-effect-feb59d9.log`, main checkout).
- Per-diagnostic list: the same `effect-tsgo diagnostics --format json` binary on the four packages, saved as `.../effect-advisory-feb59d9.json` (same folder).
- Totals are unchanged from `b94f302`: `anyUnknownInErrorContext` 23, `extendsNativeError` 20, `schemaNumber` 6, `unnecessaryFailYieldableError` 2. The `message`-level advice is also unchanged: 7 (`unnecessaryEffectGen`, `preferUnsafeConstructor`, `runOfExitToRunExit`, `flatMapConditionalToFilterOrFail`).
- Line drift since the Architecture list (same hits, new lines; for the later slices):
  - `extendsNativeError`: `registration-confirmation-store.ts:313,395` (was 334, 416).
  - `anyUnknownInErrorContext`: `harness-runtime.ts:115,197,435,449`; `process-bootstrap.ts:123,133,141`; `harness-runtime.test.ts:336`; `harness-runtime-shutdown.test.ts:386` (×2).
  - `schemaNumber`: `canonical-command-repository-faults.integration.test.ts:41`; `conformance-counter-command.ts:763` (×2).
  - `unnecessaryFailYieldableError`: `existing-registration.ts:56`.
- The storage group of this slice, as measured: `canonical-project-application.ts:18`, `canonical-project-writer.ts:62`, `storage/application-database-migration.ts:46`, `storage/canonical-command-repository.ts:126`, `storage/canonical-writer-lease.ts:38`, `storage/project-storage-application-client.ts:19`, `storage/project-storage-errors.ts:1,5`, `storage/project-storage-upgrade-verification.ts:35`. That is 9 classes in 8 files, as in the Architecture list.

#### Slice p3-s5a-storage-errors

- **Lane:** normal by override (Q6 (a)). `lane.mjs --paths` over the 8 source files plus one new test file answers `rigorous` (`files: 8 > 5`; sensitive word "migration" from the filename `application-database-migration.ts`). The class there is a fault type; the slice touches no SQL and no migration step.
- **Deliverable:** the 9 classes stop extending `Error` and become `Data.TaggedError(<their current name>)` classes. Every class keeps its constructor signature, its message, its `cause`, its extra fields (`code`, `failure`), its `name` and every `instanceof` answer. The only intended observable change is the added `_tag`, which the failure summary now reports (Q5).
- **Affected paths:**
  - source: the 8 files above;
  - tests: `apps/harness/src/storage/storage-error-contract.test.ts` (new), `apps/harness/src/harness-request-diagnostics.test.ts`, `apps/harness/src/canonical-project-application.test.ts`;
  - config: `stryker.config.json` and `stryker.project-storage.config.json`, only if a line range moves (binding 5).
- **Dependencies:** s4 (the request-failure line and `summarizeHarnessFailure` at `process-fatal-diagnostics.ts:145`). No s1 to s3 file is touched.

**Measured at `feb59d9` (read-only):**

- **Effect 4 runtime shape** (`node_modules/effect` 4.0.0, `dist/internal/core.js:354-398`, and a probe run in node):
  - `Data.TaggedError(tag)` puts `name = tag` on the prototype, and `_tag = tag` as an own enumerable field.
  - Its constructor passes `message` and a truthy `cause` to the native `Error`, then assigns every args key onto the instance. So `message` and a truthy `cause` stay own and non-enumerable, as today. A falsy `cause` (for example `null`) is assigned as an own enumerable field, with the same value.
  - `instanceof Error` holds. `String(error)` stays `"<name>: <message>"`. A subclass inherits both `name` and `_tag`.
  - Instances become yieldable (`yield*` fails with them). No touched code yields or checks Effects on these values today (`rg "isEffect\(" apps/harness/src apps/desktop/src` → 0).
- **Call sites** (counted with `rg` over `apps` and `packages`):

  | Class | Kind | `new` sites (src / all) | `instanceof` sites | Constructor today |
  |---|---|---|---|---|
  | `CanonicalProjectApplicationError` | exported | 2 / 2 | 0 (test: `toBeInstanceOf`) | `()` with a fixed message |
  | `CanonicalProjectWriterReleaseError` | exported | 5 / 6 | 1 (`active-project-coordinator.ts:295`) | `(code, options?)`, fixed message |
  | `ApplicationDatabaseFault` | exported | 5 / 5 | 2 (`registry-failure.ts:44`, `project-storage-node-adapters.ts:171`) | `(failure, options?)`, fixed message |
  | `CanonicalCommandRepositoryError` | exported | 6 / 12 | 0 | `(code, options?)`, message by code |
  | `CanonicalWriterLeaseError` | exported | 6 / 11 | 2 (`canonical-project-writer.ts:277`, `active-project-coordinator.ts:299`) | `(code, options?)`, message by code |
  | `ProjectStorageUnavailableError` | exported; subclass `ProjectStorageUpgradeBusyError` | 4 / 13 | 6 | native `(message?, options?)` |
  | `ProjectStorageBrokenError` | exported; subclasses `ProjectStorageOpeningReleaseFailedError`, `ProjectStorageApplicationClientInitializationError` | **128 / 148** in 43 files | 18 | native `(message?, options?)` |
  | `ApplicationClientInitializationFailure` | module-private | 1 / 1 | 1 (same file, `:88`) | native |
  | `StagedCopyMismatch` | module-private | 7 / 7 | 1 (same file, `:137`) | native, no message |

- **Code that reads `cause`:** `application-database-migration.ts:314` (`instanceof ProjectStorageBrokenError && error.cause === undefined`) and `project-storage-store.ts:147` (`instanceof ProjectStorageOpeningReleaseFailedError && error.cause !== undefined`). Both depend on `cause` being exactly what the constructor got.
- **Where the change is seen:**
  - `summarizeHarnessFailure` gives `{ kind: "error" }` for each of these values today (`failureEntry`, `process-fatal-diagnostics.ts:95`); after the change it gives `{ tag: <name> }`.
  - `CanonicalProjectWriterReleaseError`'s `code` does not enter the summary: only `CanonicalProjectReleaseFailed` carries a code (`:101`).
  - Every class name matches `HARNESS_FAILURE_TAG_PATTERN` (the longest tag, `ApplicationClientInitializationFailure`, has 38 characters; the limit is 64), so the desktop schema accepts the lines unchanged. The desktop is not touched.
  - No current test oracle summarizes one of these classes. The `{ kind: "error" }` oracles of s4 use plain `Error`s, so they stay green.
- **Oracles that pin today's own keys:** `canonical-project-application.test.ts:367-369` asserts `Object.keys(error)` is `["name"]` and the own property names are `["message", "name", "stack"]`. After the change they are `["_tag"]` and `["_tag", "message", "stack"]` (P3-B21).
- **Vitest 4.1.10 equality** (`@vitest/expect` `isErrorEqual`, `subsetEquality`):
  - `toEqual` between two errors compares `name`, `message`, a defined `cause` and the spread own enumerable fields. Comparisons between two instances of the same converted class stay equal.
  - `toMatchObject({ name })` reads through the prototype, so the seven `name: "ProjectStorage…Error"` oracles (`project-storage-node-adapters.test.ts:228,240`, `project-storage-node-errors.test.ts:347,369`, and `project-storage-create`, `-node-adapters`, `-open-initialization` integration files) stay green.
- **Mutation configs with line ranges in touched files:** `stryker.config.json:19-20` (`canonical-project-application.ts:90-101`, `:107-118`) and `stryker.project-storage.config.json:17` (`application-database-migration.ts:142-284`). Both sit below the class, so a class whose line count changes moves them. `stryker.conversation.config.json` mutates the whole `canonical-project-writer.ts`.
- **CodeScene** on the 8 source files at `feb59d9`: all 10.

**Constraints:**

- D1 ledger: nothing on the wire changes; every code, message, status and envelope stays. Precedent `43bc303`.
- Each class keeps its constructor signature (Q25), so none of the 219 construction sites (48 files, subclasses included) changes.
- Each subclass keeps its parent's tag (Q26), so every `name` stays as it is today.
- Effect 4: `Data.TaggedError`, the `WriterOwnerBusy` (`canonical-command-repository.ts:140`) and `CanonicalProjectReleaseFailed` precedents. Classes thrown from Promise code stay thrown; moving them onto the error channel is not this slice.
- `check:effect`: the `extendsNativeError` count falls by exactly 9, and no other count rises (binding 1).

#### Test Contract: p3-s5a-storage-errors

- **Behavior P3-B19: a converted storage failure is summarized by its tag on the request-failure line.**
  - Test: `apps/harness/src/harness-request-diagnostics.test.ts`, through `createHarnessRequestDiagnostics(createHarnessLogger(<captured destination>))` and the strict `HarnessRequestFailureLogLineSchema` decode (the P3-B12 seam).
  - A table with one row per exported class and subclass:
    - `new ProjectStorageBrokenError("C:\\private\\a.db", { cause: new Error("secret") })` → `failures: [{ tag: "ProjectStorageBrokenError" }]`;
    - `new ProjectStorageOpeningReleaseFailedError(new Error("secret"))` and `new ProjectStorageApplicationClientInitializationError("m")` → `[{ tag: "ProjectStorageBrokenError" }]`;
    - `new ProjectStorageUnavailableError("m")` and `new ProjectStorageUpgradeBusyError()` → `[{ tag: "ProjectStorageUnavailableError" }]`;
    - `new CanonicalCommandRepositoryError("WRITER_FENCE_CHECK_FAILED")` → `[{ tag: "CanonicalCommandRepositoryError" }]`;
    - `new CanonicalWriterLeaseError("WRITER_LEASE_LOCK_FAILED")` → `[{ tag: "CanonicalWriterLeaseError" }]`;
    - `new CanonicalProjectWriterReleaseError("WRITER_FENCE_STALE")` → `[{ tag: "CanonicalProjectWriterReleaseError" }]`, exactly, with no `code` key;
    - `new ApplicationDatabaseFault(<a broken failure>)` → `[{ tag: "ApplicationDatabaseFault" }]`;
    - `new CanonicalProjectApplicationError()` → `[{ tag: "CanonicalProjectApplicationError" }]`.
  - Each row is at `project-storage.owner` with `answered: "PROJECT_STORAGE_OWNER_FAILED"` and `omittedFailures: 0`. Each entry is compared with `toEqual` on the decoded `failures`. The raw line contains neither `private` nor `secret`.
  - Expected red: every row decodes with `failures: [{ kind: "error" }]` (`expected [{ kind: "error" }] to deeply equal [{ tag: "ProjectStorageBrokenError" }]`).
- **Behavior P3-B20: each converted class keeps its error contract and gains its tag.**
  - Test: `apps/harness/src/storage/storage-error-contract.test.ts` (new), constructing each exported class and subclass through its module export.
  - Per row, exactly:
    - `_tag` and `name` equal the expected tag (P3-B19's table);
    - `instanceof Error`, `instanceof` its own class and, for a subclass, `instanceof` its parent;
    - `message` is the class's fixed or by-code text (for example `"Canonical Writer fence verification failed."` for `WRITER_FENCE_CHECK_FAILED`, `"Writer lease could not be acquired."`, `"Canonical Project Writer release failed."`, `"Application database authority refused the operation."`, `"Project Storage opening release failed."`), the given message for the `ProjectStorage*` classes, and `""` for `new ProjectStorageBrokenError()`;
    - `code` / `failure` is the given value (`toBe`);
    - `String(error)` is `"<name>: <message>"`.
  - `cause` rows for `ProjectStorageBrokenError`, `CanonicalWriterLeaseError` and `ApplicationDatabaseFault`:
    - given an `Error` → `toBe` that error;
    - given `null` → `error.cause` is `null`;
    - given no options → `Object.hasOwn(error, "cause")` is `false`;
    - `new ProjectStorageOpeningReleaseFailedError(undefined)` → `error.cause` is `undefined` (the `project-storage-store.ts:147` reading).
  - Expected red: the `_tag` assertion fails on every row (`expected undefined to be "ProjectStorageBrokenError"`). Every other assertion is green at the base and pins the preserved contract.
- **Behavior P3-B21: the sanitized canonical application error shows its tag and nothing private.**
  - Test: `apps/harness/src/canonical-project-application.test.ts` `invalidResult`, its existing oracle tightened in place.
  - `Object.keys(error)` is `["_tag"]`; `Object.getOwnPropertyNames(error).sort()` is `["_tag", "message", "stack"]`; `error._tag` is `"CanonicalProjectApplicationError"`. The existing `name`, `message`, `cause` undefined and `instanceof` asserts stay.
  - Expected red: `expected [ 'name' ] to deeply equal [ '_tag' ]`.
- **Non-behavioral part:** `ApplicationClientInitializationFailure` and `StagedCopyMismatch` are module-private. Both are translated or caught inside their module (`project-storage-application-client.ts:88`, `project-storage-upgrade-verification.ts:137`), so their tag cannot be seen from a public seam. Their conversion is guarded by the existing suites of the two modules staying green and by binding 1; no new row.

**Bindings that bite.** Each one is shown failing on a named row, then reverted, and listed in the TDD record with its assertion message.

1. Make `ProjectStorageBrokenError`'s constructor drop `options` (`super({ message })`). The P3-B20 `cause` rows fail (`toBe` the given error, and `null`).
2. Give `ProjectStorageOpeningReleaseFailedError` its own `Data.TaggedError` tag instead of inheriting. P3-B19 and P3-B20 fail on its tag, and `instanceof ProjectStorageBrokenError` fails.
3. Leave `CanonicalWriterLeaseError` extending `Error`. P3-B19's lease row stays `{ kind: "error" }`, and binding 1's count shows `extendsNativeError` 12.
4. Pass `{ message, cause: options?.cause }` unconditionally in `ProjectStorageBrokenError`. The P3-B20 "no options" row fails (`Object.hasOwn(error, "cause")` is `true`).
5. If a class's line count changes, the moved ranges are realigned. Each realigned range must cover the same text as at `feb59d9`: `git show feb59d9:<file> | sed -n <old range>p` and `sed -n <new range>p <file>` diff empty, recorded in the TDD record. A Stryker dry run on that config shows the same mutant count as at the base (with the coordinator's GO, as `p3-s4-v2-stryker-dryrun.log`).

**Structural checks (on the candidate):**

- `rg -n "extends Error\b" <the 8 source files>` → 0 lines.
- `rg -c "new ProjectStorageBrokenError\(" apps packages` totals 148, and `git diff feb59d9 --stat` lists only the affected paths above.
- `rg -n "instanceof (CanonicalProjectWriterReleaseError|ApplicationDatabaseFault|CanonicalWriterLeaseError|ProjectStorage\w+Error|ApplicationClientInitializationFailure|StagedCopyMismatch)" apps/harness/src --glob '!*.test.ts'` → the same 31 lines as at `feb59d9`, with no diff hunk on any of them.
- The `effect-tsgo diagnostics --format json` read (the `effect-advisory-feb59d9.json` method) at the candidate:
  - total 42;
  - `extendsNativeError` 11, with none in the 8 files;
  - `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2;
  - no `error`-level diagnostic;
  - `message` advice still 7.

#### Success Criteria: p3-s5a-storage-errors

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run src/harness-request-diagnostics.test.ts src/storage/storage-error-contract.test.ts src/canonical-project-application.test.ts`.
- The unit suites of the 8 modules and of the `instanceof` consumers (`active-project-coordinator`, `project-storage-store`, `project-storage-upgrade-*`, `project-storage-node-*`, `registry-failure`).
- The harness storage integration files, as one batch; tell the coordinator first if it passes 2 minutes.
- `pnpm typecheck` exit 0. `pnpm check` exit 0 with "42 advisory warnings" (read CPU first, in its own call).
- CodeScene 10 on every touched file, the test files included.
- No mutation run (Q28). Binding 5's dry run only if a range moved.

Manual: none.

#### Open questions for p3-s5a-storage-errors (numbered after Q24)

- **Q25: constructor shape.**
  - (a) **Recommended.** `Data.TaggedError(<name>)` with a constructor that keeps today's positional signature: `(message?, options?)` for the `ProjectStorage*` classes, `(code, options?)`, `(failure, options?)` or `()` for the others. It forwards `cause` only when `options` has it, and `message` only when one is given. This is the `WriterOwnerBusy` precedent. Blast: 8 files; 0 of the 219 construction sites change.
  - (b) The plain object constructor `new X({ message, cause })` everywhere. It is the idiomatic Effect shape, but it rewrites 219 construction sites in 48 files (148 for `ProjectStorageBrokenError` alone), for no behaviour gain.
  - (c) `Schema.TaggedErrorClass`. No boundary decodes these values, and `cause: unknown` needs a schema of its own, so it adds a schema without a use.
- **Q26: subclass tags.**
  - (a) **Recommended.** `ProjectStorageOpeningReleaseFailedError`, `ProjectStorageApplicationClientInitializationError` and `ProjectStorageUpgradeBusyError` inherit their parent's tag. Their `name` stays what it is today, and so do the pinned `name` oracles.
  - (b) Each subclass gets its own tag. That is more diagnostic in a summary, but it changes three `name`s that tests and `toMatchObject` oracles read, and it leaves `_tag` disagreeing with the parent's for `catchTag`-style matching in Part B.
- **Q27: the canonical application error's own-key oracle.**
  - (a) **Recommended.** Tighten it to the exact new keys (P3-B21). It still proves that no private field or cause leaks.
  - (b) Loosen it to "no `cause`, no field other than `_tag`/`name`". It is weaker, and not needed.
- **Q28: mutation.**
  - (a) **Recommended.** No mutation run. The change is type shape and preserved fields, which P3-B20 pins exactly. Only binding 5's dry run, and only if a range moved.
  - (b) One project-storage mutation run on the candidate, under the coordinator's GO.

### 2026-10-26: p3-s5a-storage-errors approved, Q25-Q28 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s5a-storage-errors` at `content_hash 7933bc46d1858291d75a1601cb447e3e8b4c372dc325c1918ec084e78cccbee4`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-7933bc46.md` (main checkout). The contract (P3-B19 to P3-B21), the measured tables, the five bindings and the structural checks stand as written. Lane normal by the Q6 override.
- **Q25 (a):** `Data.TaggedError(<current name>)` with each class's positional constructor kept; `cause` is forwarded only when `options` has it, and `message` only when one is given. None of the 219 construction sites changes.
- **Q26 (a):** the three subclasses inherit their parent's tag; no `name` changes.
- **Q27 (a):** the canonical application error's own-key oracle is tightened to the exact new keys (P3-B21).
- **Q28 (a):** no mutation run; binding 5's Stryker dry run only if a line range moves.

### 2026-10-26: slice p3-s5a-registration-errors detailed

Coordinator instruction (2026-10-26): detail the next s5a part just in time, append-only, next ID P3-B22, from a fresh `pnpm check:effect` read at `f76e587` (the p3-s5a-storage head). Its Deferred Work trigger "after s2" is met.

Inherited, not asked again:
- Q5 (a): the added `_tag` is accepted and pinned.
- Q6 (a): normal lane.
- Q25 (a): `Data.TaggedError(<name>)` with the positional constructor kept.
- Q26 (a): a subclass inherits its parent's tag. There is no subclass here.
- Q9: the Part B line. `RegistryFault` is still **thrown** from Promise code; moving it onto the error channel is Part B.

Carried forward from p3-s5a-storage (coordinator):
- The harness Error equality tester (`apps/harness/tests/error-equality.ts`, `errorEqualitySetup` in `apps/harness/vitest.setup-files.ts`, with the symmetric cause rule Pedro decided) already applies to every harness test.
- Effect `YieldableError` instances are iterable, so without the tester Vitest compares two of them as equal iterables. Every oracle here that compares converted errors relies on the tester.
- The desktop configs lack the tester; that is for s5c, not this slice.

#### Fresh inventory at `f76e587`

- `pnpm check:effect` in `slopstop-p3` at `f76e587`: exit 0, "Effect diagnostics verified; 42 advisory warnings." (CPU 4% before the run).
- The per-diagnostic read, with the same `effect-tsgo diagnostics --format json` method as `effect-advisory-feb59d9.json`, is saved as `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/effect-advisory-f76e587.json` (main checkout), with the log `p3-s5a2-check-effect-f76e587.log`.
- Totals:
  - `anyUnknownInErrorContext` 23: the sites as at `feb59d9`, except `project-storage-application-client.ts:159,168,204` (was 153, 162, 198);
  - `extendsNativeError` 11;
  - `schemaNumber` 6;
  - `unnecessaryFailYieldableError` 2;
  - `message` advice 7;
  - `error` 0.
- `extendsNativeError` 11:
  - this slice's 7 in 5 files: `registration/registration-confirmation-store.ts:313,395`, `registration/registry-failure.ts:25`, `registration/repository-physical-observation.ts:27`, `registration/windows-observer-api.ts:71`, `registration/windows-version-child.ts:32,37`;
  - the 4 desktop classes of `p3-s5a-desktop-errors`: `package-smoke-authorization.ts:13`, `package-smoke-verifier.ts:207`, `project-storage-package-smoke.ts:45`, `registration-package-smoke.ts:7`.

#### Slice p3-s5a-registration-errors

- **Lane:** normal (Q6 (a), raised). `lane.mjs --paths` over the 5 source files plus the two test files answers `fast` (within fast limits). It is raised because `RegistryFault` is the class every registration verdict reads (`registryFailure`, `registry-failure.ts:40`).
- **Deliverable:** the 7 classes stop extending `Error` and become `Data.TaggedError(<their class name>)` classes, with today's positional constructors (Q25). Each keeps its message, its own field (`failure`, `code`, `result`, `occurredAt`) and every `instanceof` answer. Two observable changes:
  - the added `_tag`, which the failure summary now reports (Q5);
  - the `name` of four classes, which today is the inherited `"Error"` (Q29).
- **Affected paths:**
  - source: the 5 files above;
  - tests: `apps/harness/src/registration/registration-error-contract.test.ts` (new) and `apps/harness/src/harness-request-diagnostics.test.ts`.
  - No mutation or Vitest config names any of the 5 files (`rg` over `stryker*.json` and `apps/harness/vitest*.ts` → 0).
- **Dependencies:** s2 (the registry decode owner and `registryCorrupt()`), s4 (the request-failure line), s5a-storage (the equality tester and the `Data.TaggedError` shape with positional constructors).

**Measured at `f76e587` (read-only):**

| Class | Kind | `new` sites (src / all) | `instanceof` sites | Constructor | `name` today |
|---|---|---|---|---|---|
| `RegistryFault` | exported | 12 / 12 in 11 files (`registryCorrupt()` among them) | 1 (`registry-failure.ts:43`); test `toBeInstanceOf` at `registry-database.test.ts:30` | `(failure)`, fixed message "Project registration registry refused the operation." | `"RegistryFault"` (own field) |
| `WindowsObserverApiError` | exported | 5 / 5 (`windows-observer-api.ts:88,116`, `windows-observer-absence.ts:23,36,58`) | 1 (`windows-file-identity.ts:85`) | `(code: number)`, message `Windows observer API failed (<code>).` | `"WindowsObserverApiError"` (own field) |
| `RegistrationPublicationCancelled` | exported | 2 / 2 (`registration-confirmation-store.ts:406,414`) | 1 (`registration-storage-bootstrap.ts:241` → `incomplete`) | `()`, message `""` | `"Error"` |
| `ReceiptReadFailed` | module-private | 1 / 1 (`:326`) | 1 (`:359`, which rethrows `error.failure`) | `(failure: unknown)`, "A receipt check read failed." | `"ReceiptReadFailed"` (own field) |
| `PhysicalFault` | module-private | 12 / 12 | 1 (`:37` → `error.result`) | `(result)`, "Physical repository observation failed." | `"Error"` |
| `ObserverLimitError` | module-private | 3 / 3 | 3 (`windows-version-child.ts:60,525,587`) | `(occurredAt)`, "Windows observer limit exceeded." | `"Error"` |
| `ObserverCancelledError` | module-private | 1 / 1 | 3 (`:61,524,587`) | `(occurredAt)`, "Windows observer cancelled." | `"Error"` |

- **Totals:** 36 construction sites and 11 `instanceof` sites. No test constructs one of these classes or reads their messages (`rg` over `src` and `tests`). Only `toBeInstanceOf(RegistryFault)` reads them.
- **The Effect edge:**
  - `registry-effect.ts:16` `registryReadRejection` returns `RegistryFault | RegistryReadFailed` (`RegistryReadFailed` is already a `Data.TaggedError`).
  - `project-listing.ts:133` runs `Effect.runPromise(Effect.mapError(readHiddenProjectIds(transaction), registryReadRejection))`. The rejection value then reaches `registryFailure`, which reads `instanceof RegistryFault`. That is the s2 user-decided amendment path (listing `REGISTRY_CORRUPT` / `REGISTRY_BUSY`, P3-B4 row j). It must keep answering the same.
  - No `Effect.fail(<RegistryFault>)` exists (`rg "Effect\.fail\(" apps/harness/src/registration` → `existing-registration.ts:56` with a `RegistryReadFailed`, `registration-registry.ts:88` with an `unknown`, `registration-listing.ts:73`, `registry-effect.ts:56`). So the conversion should add no `unnecessaryFailYieldableError` hit; binding 4's read proves it.
- **Where the summary sees them:** a `RegistryFault` or `WindowsObserverApiError` that escapes to `harness.registration` (`harness-runtime.ts:350`, `Cause.squash`) or `harness.message` summarizes as `{ kind: "error" }` today and as `{ tag: <name> }` after. `WindowsObserverApiError`'s numeric `code` does not enter the summary: only `CanonicalProjectReleaseFailed` carries a code. The longest tag is `RegistrationPublicationCancelled`, 32 characters, within `HARNESS_FAILURE_TAG_PATTERN`.
- **Guards for the private classes** (existing suites):
  - `ReceiptReadFailed`: `registration-confirmation-store.test.ts`;
  - `PhysicalFault`: `tests/integration/registration-physical-identity.integration.test.ts` and `registration-physical-limits.integration.test.ts`;
  - `ObserverLimitError` / `ObserverCancelledError`: the `OBSERVATION_LIMIT_EXCEEDED` and `CANCELLED` rows of `tests/integration/project-registration.integration.test.ts:169-222`, plus `registration-identity-phase`, `registration-identity-query`, `registration-physical-identity` and `registration-preparation` integration files.
- **CodeScene** on the 5 source files at `f76e587`: all 10.

**Constraints:**

- D1 ledger: nothing on the wire changes; every registry verdict, code and message stays (precedent `43bc303`).
- Each class keeps its constructor signature (Q25), so none of the 36 construction sites changes.
- `RegistryFault` stays thrown from Promise code (Q9); no registration body moves to Effect.
- `check:effect`: `extendsNativeError` falls by exactly 7, and no other count rises (binding 4).

#### Test Contract: p3-s5a-registration-errors

- **Behavior P3-B22: a converted registration failure is summarized by its tag on the request-failure line.**
  - Test: `apps/harness/src/harness-request-diagnostics.test.ts`, through the P3-B12/P3-B19 seam: `createHarnessRequestDiagnostics(createHarnessLogger(<captured destination>))` and the strict `HarnessRequestFailureLogLineSchema` decode.
  - Rows at `harness.registration` with `answered: "HARNESS_INTERNAL_FAILURE"`:
    - `registryCorrupt()` → `failures: [{ tag: "RegistryFault" }]`;
    - `new RegistryFault({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" })` → `[{ tag: "RegistryFault" }]`;
    - `new WindowsObserverApiError(5)` → `[{ tag: "WindowsObserverApiError" }]`, exactly, with no `code` key;
    - `new RegistrationPublicationCancelled()` → `[{ tag: "RegistrationPublicationCancelled" }]`.
  - Each row has `omittedFailures: 0`, and each decoded `failures` is compared with `toEqual`. The raw line contains neither `REGISTRY_CORRUPT`, `OBSERVER_CLEANUP` nor `(5)`.
  - Expected red: every row decodes with `failures: [{ kind: "error" }]`.
- **Behavior P3-B23: each exported registration class keeps its error contract and gains its tag.**
  - Test: `apps/harness/src/registration/registration-error-contract.test.ts` (new), in the `storage-error-contract.test.ts` row shape.
  - Per row, exactly:
    - `_tag` and `name` equal the class name;
    - `instanceof Error` and `instanceof` its own class;
    - `message`: "Project registration registry refused the operation." for `RegistryFault`, `"Windows observer API failed (5)."` for `new WindowsObserverApiError(5)`, `""` for `RegistrationPublicationCancelled`;
    - the own field by identity: `failure` `toBe` the given object, `code` `toBe` 5;
    - `String(error)` is `"<name>: <message>"`, or `"RegistrationPublicationCancelled"` for the empty message;
    - `Object.hasOwn(error, "cause")` is `false`.
  - Equality rows, which need the tester:
    - `new RegistryFault(registryCorruptFailure)` `toEqual` another with an equal failure;
    - `not.toEqual` one with `{ status: "unavailable", code: "REGISTRY_BUSY" }`;
    - `new WindowsObserverApiError(5)` `not.toEqual` `new WindowsObserverApiError(6)`.
  - The verdict is unchanged:
    - `registryFailure(new RegistryFault(f))` `toBe` `f`;
    - `registryFailure(registryReadRejection(new RegistryReadFailed({ failure: registryCorruptFailure })))` `toEqual` `registryCorruptFailure`;
    - `registryReadRejection(...)` for an `INTERNAL_FAILURE` failure `toBe` the given `RegistryReadFailed`.
  - Expected red: the `_tag` assertion fails on every row (`expected undefined to be "RegistryFault"`). `RegistrationPublicationCancelled`'s `name` row also fails (`expected "Error" to be "RegistrationPublicationCancelled"`). The equality and verdict rows are green at the base and pin the preserved contract.
- **Non-behavioral part:** `ReceiptReadFailed`, `PhysicalFault`, `ObserverLimitError` and `ObserverCancelledError` are module-private. Each is caught and translated inside its module (the `instanceof` sites above), so its tag and name cannot be seen from a public seam. Their conversion is guarded by the named existing suites staying green and by binding 4; there is no new row.

**Bindings that bite.** Each one is shown failing on a named row, then reverted, and listed in the TDD record with its assertion message.

1. Make `RegistryFault`'s constructor drop `failure` (`super({ message })`). The P3-B23 `failure` `toBe` row and the `registryFailure(...)` `toBe f` row fail.
2. Remove `errorEqualitySetup` from `apps/harness/vitest.config.ts:9` `setupFiles` (the unit config, then revert). The P3-B23 `not.toEqual` rows fail (two iterable Effect errors compare equal), which proves those oracles rest on the tester.
3. Build `WindowsObserverApiError`'s message without the code (`"Windows observer API failed."`). P3-B23's message row fails.
4. Leave `RegistryFault` extending `Error`. P3-B22's two `RegistryFault` rows stay `{ kind: "error" }`, and the `effect-tsgo` read shows `extendsNativeError` 5.

**Structural checks (on the candidate):**

- `rg -n "extends Error\b" <the 5 source files>` → 0 lines.
- `rg -c "new (RegistryFault|WindowsObserverApiError|RegistrationPublicationCancelled|ReceiptReadFailed|PhysicalFault|ObserverLimitError|ObserverCancelledError)\b" apps/harness` totals 36. The 11 `instanceof` lines are unchanged; `git diff f76e587` has no hunk on any of them.
- `git diff f76e587 --stat` lists only the affected paths above.
- The `effect-tsgo diagnostics --format json` read at the candidate:
  - total 35;
  - `extendsNativeError` 4 (the desktop four only);
  - `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2;
  - no `error`;
  - `message` advice still 7.

#### Success Criteria: p3-s5a-registration-errors

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run src/harness-request-diagnostics.test.ts src/registration/registration-error-contract.test.ts`.
- The registration unit suites (`src/registration/`, `src/code-tuples.test.ts`, `src/storage/project-storage-node-errors.test.ts`).
- The registration integration files named under "Guards", plus `registry-witness-race.integration.test.ts`, as one batch. Tell the coordinator first if it passes 2 minutes.
- `pnpm typecheck` exit 0. `pnpm check` exit 0 with "35 advisory warnings" (read CPU first, in its own call).
- CodeScene 10 on every touched file, the test files included.
- No mutation run (Q31).

Manual: none.

#### Open questions for p3-s5a-registration-errors (numbered after Q28)

- **Q29: the `name` of the four classes that inherit `"Error"` today** (`RegistrationPublicationCancelled`, `PhysicalFault`, `ObserverLimitError`, `ObserverCancelledError`).
  - (a) **Recommended.** Accept the change: their `name` becomes their tag, which `Data.TaggedError` puts on the prototype. Three are module-private, and the fourth is caught at one site (`registration-storage-bootstrap.ts:241`). No oracle or log reads their `name`. P3-B23 pins the exported one.
  - (b) Keep `"Error"` by overriding `name`. Then `name` disagrees with `_tag`, and the summary would still show the tag; this keeps a misleading name for no reader.
- **Q30: the proof seam for P3-B22.**
  - (a) **Recommended.** The request-diagnostics seam (P3-B12/P3-B19), on the real logger with the strict decode. Since s4, every boundary goes through that one `summarizeHarnessFailure`.
  - (b) Also a runtime row that makes a registration handle fail with a `RegistryFault` and reads the `harness.registration` line (the P3-B13 pattern). It is stronger, but it re-proves the s4 wiring for a type change.
- **Q31: mutation.**
  - (a) **Recommended.** No mutation run. No config mutates the 5 files, and the change is type shape plus preserved fields, which P3-B23 pins.
  - (b) A scoped registration mutation run under the coordinator's GO. It would need a new config.

### 2026-10-26: p3-s5a-registration-errors approved, Q29-Q31 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s5a-registration-errors` at `content_hash ddcd0b513451e32ffba3f729807c61742d7d37b3cd735123bc8d00098a09bf63`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-ddcd0b51.md` (main checkout). The contract (P3-B22, P3-B23), the measured table, the four bindings and the structural checks stand as written. Lane normal (Q6 raise).
- **Q29 (a):** the four classes that inherit `"Error"` today take their tag as `name`.
- **Q30 (a):** P3-B22 is proven at the request-diagnostics seam; no new runtime row.
- **Q31 (a):** no mutation run.

### 2026-10-26: slice p3-s5a-desktop-errors detailed

Coordinator instruction (2026-10-26): detail the last s5a part just in time, append-only, next ID P3-B24, from a fresh `pnpm check:effect` read at `7bdb4f6` (the p3-s5a-registration head). Its Deferred Work row (Q6) has no other dependency.

Inherited, not asked again:
- Q5 (a): the added `_tag` is accepted and pinned.
- Q6 (a): normal lane by override; each smoke refusal keeps its message and exit code.
- Q25 (a): `Data.TaggedError(<name>)` with the positional constructor kept.
- Q29 (a): `name` becomes the tag, on the prototype. Here every tag equals today's `name`, so no `name` value changes.

Carried forward (coordinator):
- The desktop Vitest configs lack the Error equality tester (Q32 decides this slice's answer).
- A binding about equality must count `Data.Error`'s own enumerable fields. `p3-s5a-registration-errors` binding 2 did not bite: its `not.toEqual` rows differed in an own enumerable field (`failure`, `code`), which Vitest compares without the tester.
- An Effect program fails with a tagged error by `yield*`, never `Effect.fail(new X(...))`.

#### Fresh inventory at `7bdb4f6`

- `pnpm check:effect` in `slopstop-p3` at `7bdb4f6`: exit 0, "Effect diagnostics verified; 35 advisory warnings." (CPU 10% before the run). Log: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5a3-check-effect-7bdb4f6.log` (main checkout).
- The per-diagnostic read (same method as `effect-advisory-f76e587.json`) is saved as `effect-advisory-7bdb4f6.json` in the same folder. 42 diagnostics:
  - `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2;
  - `extendsNativeError` 4: `apps/desktop/src/main/package-smoke-authorization.ts:13`, `package-smoke-verifier.ts:207`, `project-storage-package-smoke.ts:45`, `registration-package-smoke.ts:7`;
  - `message` advice 7; `error` 0.

#### Slice p3-s5a-desktop-errors

- **Lane:** normal by override (Q6 (a)). `lane.mjs --paths` over the 4 source files and the two test files answers `rigorous` (sensitive word "auth" from the filename `package-smoke-authorization.ts`). The class there is a fixed refusal; the slice changes no authorization rule.
- **Deliverable:** the 4 classes stop extending `Error` and become `Data.TaggedError(<their class name>)` classes, with today's positional constructors (Q25). Each passes its fixed `message` (and `stage`) as fields, keeps every `instanceof` answer, and every refusal keeps its stderr text and exit code. The one observable change is the added `_tag` (Q5); `name` moves from an own field to the prototype with the same value.
- **Affected paths:**
  - source: the 4 files above;
  - tests: `apps/desktop/src/main/package-smoke-error-contract.test.ts` (new, run by `vitest.main.config.ts`) and `apps/desktop/src/main/project-storage-package-smoke.test.ts`.
- **Dependencies:** s5a-storage (the `Data.TaggedError` shape with positional constructors). No harness file is touched.

**Measured at `7bdb4f6` (read-only):**

| Class | Kind | `new` sites (src / all) | `instanceof` sites | Constructor | Own enumerable keys today |
|---|---|---|---|---|---|
| `PackageSmokeAuthorizationError` | exported | 2 / 6 (`package-smoke-authorization.ts:32,148`; tests: authorization integration 2, `canonical-writer-package-smoke-main.test.ts` 2) | 1 (`main.ts:502` → stderr `packageSmokeAuthorizationFailureMessage`, exit 1) | `()`, message `packageSmokeAuthorizationFailureMessage` ("Package smoke authorization failed.") | `name` |
| `WriterProofError` | exported | 3 / 3 (`package-smoke-verifier.ts:215` in `requireWriterProof`, `:318`; `canonical-writer-package-smoke.ts:98`) | 2 (`canonical-writer-package-smoke.ts:267,920` → `error.stage`) | `(stage)`, "Packaged Writer proof failed." | `name`, `stage` |
| `ProjectStoragePackageSmokeError` | module-private | 1 / 1 (`project-storage-package-smoke.ts:73`) | 1 (`:80` `projectStoragePackageSmokeFailureStage` → `error.stage`) | `(stage)`, "Packaged Project Storage smoke failed." | `name`, `stage` |
| `RegistrationPackageSmokeError` | exported | 3 / 4 (`registration-package-smoke.ts:74,80,81`; test `:62`) | 0 | `(stage)`, "Packaged registration smoke failed." | `name`, `stage` |

- **Totals:** 9 source and 14 total construction sites, 4 `instanceof` sites. `requireWriterProof(` appears on 54 lines (`package-smoke-verifier.ts` 15 with its definition, `canonical-writer-package-smoke.ts` 39); none changes.
- **Effect 4 shape** (`effect` 4.0.0 `dist/internal/core.js:367-398`, `dist/internal/record.js:2-21`): `name = tag` on the prototype; `_tag` own enumerable; `message` goes to the native `Error` and stays own and **non-enumerable** (`assignProperty` writes `self[key] = value` onto the existing property); `stage` own enumerable; no `cause` unless a truthy one is passed.
- **Vitest 4.1.10 equality without the tester** (`@vitest/expect` `iterableEquality`, `dist/index.js:481-577`; the `toThrow` matcher, `:1549-1593`, with an Error instance uses the same `equals` with `iterableEquality`): two converted errors are iterable, so `toEqual`, `rejects.toEqual` and `toThrowError(new X())` compare only the constructor and `Object.entries` (`_tag`, `stage`). `name`, `message` and `cause` are not compared. `toMatchObject({ name, message, stage })` (`package-smoke-verifier.test.ts:88-92`) reads each key directly and stays exact.
- **Desktop oracles that compare these errors today:** `registration-package-smoke.test.ts:62` (`rejects.toEqual(new RegistrationPackageSmokeError(stage))`, 3 stages) and `tests/integration/package-smoke-authorization.integration.test.ts:35,193` (`toThrowError(new PackageSmokeAuthorizationError())`). After the change they still bite on a wrong class or a wrong stage, not on a wrong message. P3-B24 pins each message directly, so no row loses a real check. No desktop test compares the 4 existing desktop `Data.TaggedError` classes (`UntypedRejection`, `WriterProofReportFailed`, `HarnessShutdownTimeout`, `DesktopRuntimeDisposeUnconfirmed`) by equality (`rg` → 0).
- **Refusal message and exit guards** (existing, unchanged, must stay green):
  - authorization: `canonical-writer-package-smoke-main.test.ts:676-686` (stderr "Package smoke authorization failed.\n", `app.exit(1)`, no readiness) and the "authorization refused" no-runtime row (`:833-841`);
  - writer: `canonical-writer-package-smoke-main.test.ts` `failed(<stage>)` rows (`:153,505,614,670`) and the stage rows of `canonical-writer-package-smoke.test.ts` (`:187,389,395,659,708,725,736-757`); native preflight: `package-smoke-verifier.test.ts:81-95`;
  - storage: `project-storage-package-smoke.test.ts:128-148`;
  - registration: `registration-package-smoke.test.ts:50-63`.
- **Not touched:** the harness fixture `apps/harness/tests/integration/canonical-writer-package-smoke-entry.ts:287-289` builds its own plain `Error` named `WriterProofError`; it mirrors the shape for the harness test only and nothing compares it with the desktop class. `tests/e2e/package-smoke.mjs` reads only stderr text, which does not change.
- **Effect edge:** none. All 4 classes are thrown from sync or Promise code; no `Effect.fail` takes one (`rg "Effect\.fail\(" apps/desktop/src/main` → 10 lines, none with these classes).
- **Mutation:** `stryker.config.json:29` mutates the whole `package-smoke-verifier.ts` (no line range, so line moves do not matter). No Stryker config names the other 3 files.
- **CodeScene** on the 4 source files at `7bdb4f6`: all 10.

**Constraints:**

- D1 ledger: nothing on the wire or on stderr changes; every stage, message and exit code stays (precedent `43bc303`).
- Each class keeps its constructor signature (Q25), so none of the 14 construction sites and none of the 54 `requireWriterProof(` lines changes.
- No throw moves onto an Effect error channel here. If a later change does, it uses `yield* new X(...)`, never `Effect.fail(new X(...))`; this slice adds no `unnecessaryFailYieldableError` hit (structural check).
- No `cause` is passed, so `not.toHaveProperty("cause")` (`package-smoke-verifier.test.ts:94`, harness `:868`) stays true.
- `check:effect`: `extendsNativeError` falls by exactly 4, to 0, and no other count rises.

#### Test Contract: p3-s5a-desktop-errors

- **Behavior P3-B24: each exported desktop smoke class keeps its error contract and gains its tag.**
  - Test: `apps/desktop/src/main/package-smoke-error-contract.test.ts` (new), one `it.each` row per class: `new PackageSmokeAuthorizationError()`, `new WriterProofError("native-preflight")`, `new RegistrationPackageSmokeError("list")`.
  - Per row, exactly:
    - `_tag` and `name` equal the class name;
    - `instanceof Error` and `instanceof` its own class;
    - `message` `toBe` "Package smoke authorization failed." (also `toBe(packageSmokeAuthorizationFailureMessage)`), "Packaged Writer proof failed.", "Packaged registration smoke failed.";
    - `stage` `toBe` the given stage (the two stage classes);
    - `String(error)` is `"<name>: <message>"`;
    - `Object.hasOwn(error, "cause")` is `false`;
    - `Object.keys(error).sort()` is `["_tag"]` for the authorization class and `["_tag", "stage"]` for the other two.
  - Equality rows, which rest on the own enumerable `stage`, not on a tester:
    - `new RegistrationPackageSmokeError("list")` `not.toEqual` `new RegistrationPackageSmokeError("register")`;
    - `new WriterProofError("cleanup")` `toEqual` `new WriterProofError("cleanup")` and `not.toEqual` `new WriterProofError("internal")`.
  - Expected red: the `_tag` assertion fails on every row (`expected undefined to be "PackageSmokeAuthorizationError"`), and the own-key rows fail (`["name"]` / `["name", "stage"]` against `["_tag"]` / `["_tag", "stage"]`). The message, stage, `String`, cause and equality rows are green at the base and pin the preserved contract.
- **Behavior P3-B25: the Project Storage smoke refusal carries its tag and still reports its stage.**
  - Test: `apps/desktop/src/main/project-storage-package-smoke.test.ts`, the existing "classifies an unexpected absent-Project result" row (`:128-148`) through `runProjectStoragePackageSmoke` with its fake bridge.
  - The rejection value, exactly: `_tag` and `name` "ProjectStoragePackageSmokeError", `instanceof Error`, `message` "Packaged Project Storage smoke failed.", `stage` "absent-project-open", `Object.hasOwn(failure, "cause")` `false`; `projectStoragePackageSmokeFailureStage(failure)` still `toBe("absent-project-open")`.
  - New rows: `projectStoragePackageSmokeFailureStage(new RegistrationPackageSmokeError("list"))` and `(new Error("Packaged Project Storage smoke failed."))` are both `undefined`, so `main.ts` keeps reporting a non-storage rejection as plain `storage`.
  - Expected red: the `_tag` row fails (`expected undefined to be "ProjectStoragePackageSmokeError"`). The stage and `undefined` rows are green at the base.

**Bindings that bite.** Each one is shown failing on a named row, then reverted, and listed in the TDD record with its assertion message.

1. Make `RegistrationPackageSmokeError`'s constructor drop `stage` (`super({ message })`). P3-B24's `stage` and own-key rows fail, and its `not.toEqual` row fails (neither side has a `stage`, so they compare equal). `registration-package-smoke.test.ts:62` stays green for the same reason, and the TDD record says so.
2. Change `RegistrationPackageSmokeError`'s message to "Packaged registration smoke failed" (no period). The premise row: `registration-package-smoke.test.ts:62` **stays green** (Vitest compares converted errors by constructor and own enumerable fields; `message` is non-enumerable). P3-B24's message and `String` rows fail. This proves the message is pinned by P3-B24, not by `:62`.
3. Drop `stage` from `WriterProofError`'s fields. P3-B24's `stage` and equality rows, `package-smoke-verifier.test.ts:88-92` (`stage: "native-preflight"`) and the `canonical-writer-package-smoke.test.ts:187` stage row fail.
4. Leave `ProjectStoragePackageSmokeError` extending `Error`. P3-B25's `_tag` row fails, and the `effect-tsgo` read shows `extendsNativeError` 1.

**Structural checks (on the candidate):**

- `rg -n "extends Error\b" <the 4 source files>` → 0 lines.
- `rg -c "new (PackageSmokeAuthorizationError|WriterProofError|ProjectStoragePackageSmokeError|RegistrationPackageSmokeError)\(" apps packages` totals 14 (9 in source); `rg -c "requireWriterProof\(" apps` totals 54. The 4 `instanceof` lines are unchanged; `git diff 7bdb4f6` has no hunk on any of them.
- `rg -n "Effect\.fail\(new " apps/desktop/src` → 0 lines.
- `git diff 7bdb4f6 --stat` lists only the affected paths above.
- The `effect-tsgo diagnostics --format json` read at the candidate:
  - total 38 diagnostics, 31 warnings;
  - `extendsNativeError` 0;
  - `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2;
  - no `error`; `message` advice still 7.

#### Success Criteria: p3-s5a-desktop-errors

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/package-smoke-error-contract.test.ts src/main/project-storage-package-smoke.test.ts`.
- The guards: `src/main/registration-package-smoke.test.ts`, `src/main/package-smoke-verifier.test.ts`, `src/main/canonical-writer-package-smoke.test.ts`, `src/main/canonical-writer-package-smoke-main.test.ts` (main config) and `tests/integration/package-smoke-authorization.integration.test.ts` (integration config). Tell the coordinator first if a batch passes 2 minutes.
- `pnpm typecheck` exit 0. `pnpm check` exit 0 with "31 advisory warnings" (read CPU first, in its own call).
- CodeScene 10 on every touched file, the test files included.
- No mutation run unless Q33 says so; no package smoke (the deep gate before push runs it).

Manual: none.

#### Open questions for p3-s5a-desktop-errors (numbered after Q31)

- **Q32: a desktop Error equality tester.**
  - (a) **Recommended.** Not in this slice. Every P3-B24/P3-B25 oracle reads `message`, `name` and `cause` directly, and the equality rows rest on the own enumerable `stage`, which Vitest compares without a tester (binding 2 proves the premise). The gap moves with s5c as already written, with this trigger: the first desktop oracle that compares two converted errors differing only in `message` or `cause`. When it lands it uses one owner shared by both apps (`shared-vocab-union`), with Pedro's symmetric cause rule, not a copy.
  - (b) Add a copy of `apps/harness/tests/error-equality.ts` to the desktop main and integration configs now. Apps never import each other, so this is a 30-line duplicate that `shared-vocab-union` forbids and jscpd may flag.
  - (c) Extract one owner now (for example a root test-support file both apps' configs list in `setupFiles`). Correct end state, but it touches the 4 harness configs and `vitest.setup-files.ts` in a slice about 4 desktop classes.
- **Q33: mutation.**
  - (a) **Recommended.** No mutation run. `stryker.config.json` mutates `package-smoke-verifier.ts` as a whole file, and the change there is the class shape with preserved fields, which P3-B24 and binding 3 pin.
  - (b) A scoped run of the default config's `package-smoke-verifier.ts` mutants under the coordinator's GO.

### 2026-10-26: p3-s5a-desktop-errors approved, Q32-Q33 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s5a-desktop-errors` at `content_hash d8fdc66c52c2b0b3d43a7dcebad069763fb71766a1cc38e2a294dc67c860e56b`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-d8fdc66c.md` (main checkout). The contract (P3-B24, P3-B25), the measured table, the four bindings and the structural checks stand as written. Lane normal by the Q6 override.
- **Q32 (a):** no desktop Error equality tester in this slice. The gap stays with `p3-s5c-schema-number-yieldable`, triggered by the first desktop oracle that compares two converted errors differing only in `message` or `cause`; it lands as one owner shared by both apps (`shared-vocab-union`) with the symmetric cause rule.
- **Q33 (a):** no mutation run.

### 2026-10-26: slice p3-s5b detailed, split into shutdown and bridge parts

Coordinator instruction (2026-10-26): detail `p3-s5b-error-context` just in time, append-only, next ID P3-B26, from a fresh `pnpm check:effect` read at `8c91754` (the s5a family head). Its Deferred Work trigger "after s4" is met.

Inherited, not asked again:
- Q8 (a): no waiver proposed; a hit that cannot be fixed without Part B stops the slice for a per-line question.
- The Part B line: Phase 3 types `E` at the existing Effect sites; Part B migrates the Promise bodies.
- Q32 (a): the desktop Error equality tester stays with s5c.

Carried forward (coordinator):
- `apps/desktop/src/main/harness-supervisor.ts:207` `Effect.fail(new HarnessShutdownTimeout())`, found during s5a3 (Q36 places it).
- The debug shape of an Effect error (`toJSON` / `inspect`) matters wherever a Pino `{ err }` log receives one.

#### Fresh inventory at `8c91754`

- `pnpm check:effect` in `slopstop-p3` at `8c91754`: exit 0, "Effect diagnostics verified; 31 advisory warnings." (CPU 14% before the run). Log: `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5b-check-effect-8c91754.log` (main checkout). The per-diagnostic read is `effect-advisory-8c91754.json` in the same folder.
- The coordinator's expectation is confirmed: 38 diagnostics, of them `anyUnknownInErrorContext` 23, `schemaNumber` 6, `unnecessaryFailYieldableError` 2 (`existing-registration.ts:56`, `project-storage-upgrade-pipeline.ts:384`), `message` advice 7, `extendsNativeError` 0, `error` 0.
- The 23 `anyUnknownInErrorContext` hits, by line:column at `8c91754`, fall in two families:

| Family | Site | What carries `E = unknown` |
|---|---|---|
| Shutdown aggregation | `harness-runtime.ts:115:33` | `runtime.runFork(stop)`, `stop: Effect.Effect<void, unknown>` (option type `:52`) |
| | `harness-runtime.ts:197:44` | `Effect.fail(runtimeShutdownFailure(failures))`, which returns `unknown` (`:80-84`) |
| | `harness-runtime.ts:435:37` | `Effect.runPromise(Deferred.await(completion))`, `completion: Deferred<void, unknown>` (`:430`) |
| | `harness-runtime.ts:449:37` | `runtime.runFork(shutdownAfterIntake(...))`, declared `Effect.Effect<void, unknown>` (`:179`) |
| | `process-bootstrap.ts:123:23`, `:133:21` | `Effect.fail(combinedFailure(...))`, which returns `unknown` (`:76-78`) |
| | `process-bootstrap.ts:141:38` | `Effect.runPromise(shutdown(stopHarness))` |
| | `harness-runtime.test.ts:336:7` | the fixture parameter `stop: Effect.Effect<void, unknown>` (`:333`) |
| | `harness-runtime-shutdown.test.ts:386:7`, `:386:13` | the fixture parameter `listingStop: Effect.Effect<void, unknown>` (`:377`) |
| Promise→Deferred bridges | `storage/retryable-attempt.ts:11:39`, `:25:41` | `Deferred<void, unknown>` settled with `Effect.fail(error)` from a rejection; `Effect.runPromise(Deferred.await(...))` |
| | `registration/registration-registry.ts:83:39`, `:88:34`, `:215:27` | the same, per admitted operation (`:75-90`), drained in `stop` (`:209-222`) |
| | `storage/application-database-authority.ts:90:51`, `:454:30` | `Initialization = Deferred<"absent" \| "current", unknown>` (`:85`), joined by `joinInFlight` |
| | `storage/project-storage-application-client.ts:159:38`, `:168:64`, `:204:65` | `Deferred<LocalLibsqlClient \| undefined, unknown>` (`:110`), awaited by `acquire` and `stop` |
| | `storage/project-storage-store.ts:171:59`, `:565:39`, `:571:78` | `AdmittedOperationCompletion = Deferred<void, unknown>` (`:139`) |

- Shutdown family: 10 hits in 2 source and 2 test files. Bridge family: 13 hits in 5 source files.

**Effect 4 facts the slice rests on** (`effect` 4.0.0):
- `Effect.runPromise` rejects with `Cause.squash(exit.cause)` (`dist/internal/effect.js:2539-2547`): the first `Fail` error itself, else the first defect, else `new Error("All fibers interrupted without error")` (`:171-180`). So a typed wrapper on the error channel leaves a Promise facade as the wrapper unless that facade unwraps it.
- The harness precedent is `apps/harness/src/effect-rejection.ts`: `UntypedRejection` (`Data.TaggedError`, own field `cause`), `untypedRejection` as the `catch` of `Effect.try` / `Effect.tryPromise`, and `unwrapRejection`, which returns the original value where it leaves the Effect. It is already used at `canonical-project-writer.ts:110-113`, `process-bootstrap.ts:116,129`, `registration-listing.ts:61`, `registry-database.ts:128-133`, `project-storage-node-registry.ts:72,79` and `project-storage-store.ts:156-160`.

**The debug-shape note:** no value of either family reaches a Pino `{ err }` log. The harness logs failures only through `summarizeHarnessFailure` (s4). The one `{ err }` call in either app is `apps/desktop/src/main/main.ts:103` (desktop shutdown), which no s5b file feeds (`rg "\{ ?err[:,} ]|err: " apps/*/src` outside tests → that line only). Because every wrapper is unwrapped where it leaves the Effect, the fatal and request-failure summaries keep seeing today's values. That is the slice's main risk: one missed unwrap turns a fatal line from the real failure into `{ tag: "UntypedRejection" }`.

**The `Effect.fail(new X(...))` sites outside the rule:** `unnecessaryFailYieldableError` does not flag four sites where an `Effect.fail(new X(...))` is returned rather than yielded: `harness/src/conversation/conversation-rows.ts:78`, `conversation/conversation-save.ts:40`, `storage/application-database-authority.ts:277`, `desktop/src/main/harness-supervisor.ts:207` (`rg -n "Effect\.fail\(\s*new " apps packages` outside tests). None is an `anyUnknownInErrorContext` hit (Q36).

#### Slice p3-s5b-shutdown-error-context

- **Lane:** normal (Q34 (a): the brief's recorded lane holds for both parts). `lane.mjs --paths` over the 2 source and 3 test files answers `fast` (within fast limits). It stays normal because both edges feed the fatal and request-failure lines (s4) and two mutation configs hold line ranges in these files.
- **Deliverable:** the shutdown family's 10 hits go to 0 with no observable change.
  - The aggregated runtime and process failures travel on the error channel as `UntypedRejection` (cause = today's value: the single failure, or the `AggregateError`), and are unwrapped with `unwrapRejection` at each of the three Promise edges: the runtime stop (`harness-runtime.ts:435`), the process stop (`process-bootstrap.ts:141`) and the process startup (`process-bootstrap.ts:126`).
  - The listing stop option is typed `Effect.Effect<void, Error>` (Q35). Its one producer, `createRegistrationListing` (`registration-listing.ts:84`), fails with `RegistrationCleanupUnconfirmed`, an `Error`. The test fixtures' parameter types follow (`harness-runtime.test.ts:105,333`, `harness-runtime-shutdown.test.ts:377`); every fixture value already fits (`Effect.die`, `Effect.interrupt`, `Effect.sync`, `Effect.fail(new Error(...))` at `harness-runtime.test.ts:294` and `harness-runtime-shutdown.test.ts:329`).
- **Affected paths:**
  - source: `apps/harness/src/harness-runtime.ts`, `apps/harness/src/process-bootstrap.ts`;
  - tests: `apps/harness/src/harness-runtime.test.ts`, `apps/harness/src/harness-runtime-shutdown.test.ts`, `apps/harness/src/process-bootstrap.test.ts`;
  - config: `stryker.project-storage.config.json`, only if a line range moves.
- **Dependencies:** s4 (the request-failure line and `summarizeHarnessFailure`), u2b-s9 (the fatal sinks that read the startup and shutdown rejections).

**Measured at `8c91754` (read-only):**

- **Existing identity oracles (guards, unchanged, must stay green):**
  - runtime stop: `harness-runtime.test.ts:306-312` `expectShutdownError` (one failure `toBe`, several `AggregateError` with `errors` `toEqual` in order) over the owner rows from `:314`; the listing stop rows `:340-357` (a defect `toBe`; an interruption stays `Error` "All fibers interrupted without error" and stops nothing more); `harness-runtime-shutdown.test.ts:96` (`rejects.toBe(shutdownFailure)`, the shared first stop), `:238`, `:305`, and `:347-355` (an unconfirmed database close alone `toBe`, with a listing failure as `AggregateError` `[listingFailure, unconfirmed]` by identity);
  - process stop: `process-bootstrap.test.ts` `shutdownRows` (`:222-290`: both fail → `AggregateError` "Harness process shutdown failed." `[programFailure, disposeFailure]`; one fails → `toBe`; dispose unconfirmed after 50 ms) and `:425` (`rejects.toBe(unsubscribeFailure)`);
  - process startup: `process-bootstrap.test.ts` `startupRows` (`:342-380`: `toBe(startupFailure)`, or `AggregateError` "Harness startup failed." with the dispose failure second);
  - the fatal lines: `process-connection.test.ts:23,56` and `process-shutdown.test.ts:10`.
- **Gaps those oracles leave:** no row pins the runtime's aggregate message "Harness runtime shutdown failed." (`rg` over tests → 0), and every rejection value in these rows is an `Error`, so nothing pins that a non-`Error` rejection (a thrown string) still leaves each edge unchanged.
- **Mutation configs:** `stryker.config.json:13` mutates the whole `harness-runtime.ts`. `stryker.project-storage.config.json:32-43` holds ranges `harness-runtime.ts:91-103, 110-121, 181-181, 187-190, 244-247, 338-355, 431-452` and `process-bootstrap.ts:58-70, 72-77, 84-96, 103-143`, which match today's code. A range whose code moves is re-pointed to the same code, shown by a word diff of the range text before and after (the s5a precedent).
- **CodeScene** at `8c91754`: `harness-runtime.ts`, `process-bootstrap.ts`, `harness-runtime.test.ts`, `harness-runtime-shutdown.test.ts`, `process-bootstrap.test.ts` all 10.

**Constraints:**

- No observable change: every stop and startup rejects with today's value by identity, every shared stop still returns one promise, and an interruption stays an interruption (never a domain error).
- No `UntypedRejection` leaves either file: each Promise edge unwraps (`unwrapRejection`), as `canonical-project-writer.ts:113` does.
- No new `Effect.fail(new ...)`; a new failure inside a generator is `yield*`ed. No `{ err }` log is added.
- No Promise body moves to Effect (Part B line); the three edges stay Promise facades.
- `check:effect`: `anyUnknownInErrorContext` falls by exactly 10, to 13 (the bridge family only), and no other count rises.

#### Test Contract: p3-s5b-shutdown-error-context

- **Behavior P3-B26: the harness runtime stop rejects with exactly today's shutdown failure.**
  - Test: `apps/harness/src/harness-runtime.test.ts`, the `failingRuntime` / `expectShutdownError` block (`:283-357`), through `startHarnessRuntime(...)`'s returned stop.
  - New rows:
    - two failing owners (canonical and listing) → the rejection is `instanceof AggregateError`, `message` `toBe("Harness runtime shutdown failed.")`, `errors[0]` and `errors[1]` `toBe` the two failures in order, and `not.toBeInstanceOf(UntypedRejection)`;
    - an application database stop that rejects with the string `"database stop refused"` (no other failure) → the stop rejects `toBe("database stop refused")`;
    - one failing owner → `toBe` the failure and `not.toBeInstanceOf(UntypedRejection)`.
  - Expected red: none at the base. These rows pin preserved behaviour (the change is type-only), and they are green before and after. The slice's red-to-green is the `effect-tsgo` read (10 hits → 0 in these 4 files); the bite of the rows is shown by bindings 1 and 3.
- **Behavior P3-B27: the process runtime's startup and stop reject with exactly today's failure.**
  - Test: `apps/harness/src/process-bootstrap.test.ts`, through `launchOnProcessRuntime(...)` (`:159`, `:323`).
  - New rows:
    - a `start` that throws the string `"startup refused"`, with a clean dispose → the launch rejects `toBe("startup refused")`;
    - a stop whose program rejects with the string `"program refused"`, with a clean dispose → the stop rejects `toBe("program refused")`;
    - the "both fail" shutdown row and the "dispose dies" startup row also assert `not.toBeInstanceOf(UntypedRejection)`.
  - Expected red: none at the base, as for P3-B26; bindings 2 and 3 show the bite.

**Bindings that bite.** Each one is shown failing on a named row, then reverted, and listed in the TDD record with its assertion message.

1. Drop the unwrap at the runtime stop edge (`harness-runtime.ts`, the `stopPromise` line). P3-B26's three rows fail (`expected UntypedRejection{…} to be …`), and so do `harness-runtime.test.ts:306-312` and `harness-runtime-shutdown.test.ts:96`.
2. Drop the unwrap at the process stop edge (`process-bootstrap.ts`, the `disposal` line). P3-B27's `"program refused"` row and the "only the program fails" / "only the dispose fails" shutdown rows fail.
3. Drop the unwrap at the process startup edge (`process-bootstrap.ts`, the first `Effect.runPromise`). P3-B27's `"startup refused"` row and the "the dispose takes 10 ms" startup row (`toBe(startupFailure)`) fail. The fatal-line guards `process-connection.test.ts:23,56` are read in the same run and their outcome is recorded.
4. Leave `runtimeShutdownFailure`'s value unwrapped on the error channel (`Effect.fail(runtimeShutdownFailure(failures))` as today). The `effect-tsgo` read shows `anyUnknownInErrorContext` 14 (`harness-runtime.ts:197` back).

**Structural checks (on the candidate):**

- `rg -n "Effect\.Effect<[^>]*, unknown>|Deferred(\.Deferred)?<[^>]*, unknown>|makeUnsafe<[^>]*, unknown>" apps/harness/src/harness-runtime.ts apps/harness/src/process-bootstrap.ts` → 0 lines.
- `rg -n "unwrapRejection" apps/harness/src/harness-runtime.ts apps/harness/src/process-bootstrap.ts` names the three edges.
- `rg -n "Effect\.fail\(\s*new " apps/harness/src/harness-runtime.ts apps/harness/src/process-bootstrap.ts` → 0 lines.
- `git diff 8c91754 --stat` lists only the affected paths above.
- The `effect-tsgo diagnostics --format json` read at the candidate:
  - total 28 diagnostics, 21 warnings;
  - `anyUnknownInErrorContext` 13, exactly the bridge family's sites;
  - `schemaNumber` 6, `unnecessaryFailYieldableError` 2, `extendsNativeError` 0;
  - no `error`; `message` advice still 7.

#### Success Criteria: p3-s5b-shutdown-error-context

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run src/harness-runtime.test.ts src/process-bootstrap.test.ts`, then the `effect-tsgo` read.
- The guards: `src/harness-runtime-shutdown.test.ts`, `src/process-connection.test.ts`, `src/process-shutdown.test.ts`, `src/process-fatal-diagnostics.test.ts`, `src/harness-request-diagnostics.test.ts`.
- `pnpm typecheck` exit 0. `pnpm check` exit 0 with "21 advisory warnings" (read CPU first, in its own call).
- CodeScene 10 on every touched file, the test files included.
- No mutation run unless Q37 says so.

Manual: none.

#### Slice p3-s5b-bridge-error-context (deferred, measured)

- **Content:** the bridge family's 13 hits in `retryable-attempt.ts`, `registration-registry.ts`, `application-database-authority.ts`, `project-storage-application-client.ts`, `project-storage-store.ts`. Planned shape: each `Deferred<_, unknown>` becomes `Deferred<_, UntypedRejection>`, settled with `untypedRejection(error)`, and each Promise edge that awaits one unwraps (`retryable-attempt.ts:11`, `application-database-authority.ts:454`, `project-storage-application-client.ts:168,204`); `registration-registry.ts:224` and `project-storage-store.ts` already unwrap or map their drained failures.
- **Measured:** `lane.mjs --paths` over the 5 files answers `fast`; normal by Q34 (a). `retryableAttempt` has three callers (`canonical-project-writer.ts:134`, `active-project-coordinator.ts:682`, `storage/canonical-writer-lease.ts:50`) and no unit test of its own; `project-storage-application-client` has no unit test file (its oracles are in `tests/integration/project-storage-application-client.integration.test.ts:100,147`). `stryker.project-storage.config.json:26-31,50` holds ranges in `application-database-authority.ts` and `registration-registry.ts`.
- **Trigger:** `p3-s5b-shutdown-error-context` accepted. Its contract (next free ID then) is written at that point, from a fresh read.
- **Mapping:** the planned `p3-s5b-error-context` (23 → 0) is now `p3-s5b-shutdown-error-context` (10) + `p3-s5b-bridge-error-context` (13). No behavior ID was issued for the old slice, so none moves.

#### Open questions for p3-s5b (numbered after Q33)

- **Q34: split s5b in two.**
  - (a) **Recommended.** Split as above: `p3-s5b-shutdown-error-context` now (10 hits, 2 source + 3 test files), `p3-s5b-bridge-error-context` next (13 hits, 5 source files). Both stay normal, the lane the brief recorded for s5b. The two families share no file and have different edges and different guards; together they are 7 source files, 4 test files and two mutation configs.
  - (b) One slice of 23 hits, as planned. One review round covers both, but the contract doubles (9 Promise edges, two of them with no unit test).
- **Q35: the listing stop option's error type.**
  - (a) **Recommended.** `Effect.Effect<void, Error>`. Its one producer fails with an `Error` subclass, the existing fixtures fit unchanged, and `harness-runtime.ts` does not need to import a registration type.
  - (b) Export the exact type from `registration-listing.ts` (`RegistrationCleanupUnconfirmed`, private today) and use it. More precise, but the fixtures at `harness-runtime.test.ts:294` and `harness-runtime-shutdown.test.ts:329` must then fail with that class, which changes their test values.
- **Q36: the four `Effect.fail(new X(...))` sites the rule does not flag** (`conversation-rows.ts:78`, `conversation-save.ts:40`, `application-database-authority.ts:277`, `harness-supervisor.ts:207`).
  - (a) **Recommended.** They go to `p3-s5c-schema-number-yieldable`, beside the two `unnecessaryFailYieldableError` hits: same fix (return or `yield*` the error itself), and none is an `anyUnknownInErrorContext` hit. s5c's structural check becomes `rg -n "Effect\.fail\(\s*new " apps packages` → 0 outside tests.
  - (b) Fold them into s5b. They share no file with the shutdown part, and only `application-database-authority.ts` with the bridge part.
  - (c) Leave them: the rule does not count them, so s6's count of 0 does not need them. This keeps a pattern AGENTS.md forbids in new and touched code.
- **Q37: mutation for the shutdown part.**
  - (a) **Recommended.** No mutation run. The change is error-channel types plus three unwrap calls, and bindings 1 to 3 remove each unwrap and show a named row failing, which is the mutant that matters. Moved ranges are re-pointed and word-diffed.
  - (b) A scoped `stryker.project-storage.config.json` run on the `harness-runtime.ts` and `process-bootstrap.ts` ranges under the coordinator's GO.

### 2026-10-27: p3-s5b-shutdown-error-context approved, Q34-Q37 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s5b-shutdown-error-context` at `content_hash abf3cdb5ee0f973083ca797d0f77b17b25eaff378792d8b4e22320a62daa47bf`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-abf3cdb5.md` (main checkout). The contract (P3-B26, P3-B27), the measured reads, the four bindings, the guard rows and the structural checks stand as written. Lane normal (Q34 (a); `lane.mjs --paths` answers `fast`).
- **Q34 (a):** s5b is split. `p3-s5b-shutdown-error-context` is the next slice; `p3-s5b-bridge-error-context` stays deferred, triggered by the shutdown part's acceptance.
- **Q35 (a):** the listing stop option is typed `Effect.Effect<void, Error>`; `RegistrationCleanupUnconfirmed` stays private.
- **Q36 (a):** the four `Effect.fail(new X(...))` sites the rule does not flag (`conversation-rows.ts:78`, `conversation-save.ts:40`, `application-database-authority.ts:277`, `harness-supervisor.ts:207`) move to `p3-s5c-schema-number-yieldable`.
- **Q37 (a):** no mutation run.

### 2026-10-27: slice p3-s5b-bridge-error-context detailed

The deferred bridge part (trigger: `p3-s5b-shutdown-error-context` passed its verifier at `e2c1a06`) is detailed from a fresh read at `e2c1a06`. Behavior IDs P3-B28 to P3-B30. This section does not change the shutdown part's contract.

**Fresh read at `e2c1a06`** (`pnpm check:effect` exit 0, "21 advisory warnings", 19 s; `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5b2-check-effect-e2c1a06.log`, `effect-advisory-e2c1a06.json`, main checkout):

- 28 diagnostics: `anyUnknownInErrorContext` 13, `schemaNumber` 6, `unnecessaryFailYieldableError` 2 (`existing-registration.ts:56`, `project-storage-upgrade-pipeline.ts:384`), `message` advice 7, `extendsNativeError` 0, no `error`. As the shutdown part's TDD record predicted.
- The 13 hits are exactly the bridge family. They come from five `Deferred<_, unknown>` declarations, one per file:

| File | Declaration | Hits | Where the failure leaves |
|---|---|---|---|
| `storage/retryable-attempt.ts` | `completion` `:10` | `:11` (await), `:25` (`Effect.fail(error)`) | Promise edge `:11` (`Effect.runPromise`) |
| `registration/registration-registry.ts` | `pending` `:75`, `completion` `:80`, `settle` `:82` | `:83`, `:88`, `:215` (await) | drained in `stop` (`Effect.result`), already `unwrapRejection` at `:222-223` |
| `storage/application-database-authority.ts` | `type Initialization` `:85` (made at `:372`, `:485`) | `:90` (`publish`), `:454` (await) | Promise edge `:454` (`joinInFlight`) |
| `storage/project-storage-application-client.ts` | `initialization` `:110`, `candidate` `:152` | `:159`, `:168`, `:204` | Promise edges `:168` (`acquire`) and `:204` (`stop`) |
| `storage/project-storage-store.ts` | `type AdmittedOperationCompletion` `:139`, `completion` `:562`, `settle` `:564` | `:171` (await), `:565`, `:571` | drained in `drainAdmittedOperations` (`:164-176`), mapped by `shutdownOperationFailure` only |

- **A correction to the deferred entry:** it said `project-storage-store.ts` "already unwraps or maps" its drained failures. It maps them (`shutdownOperationFailure`, `:146-150`) but does not unwrap them. Once the completion carries an `UntypedRejection`, the drain must unwrap first and map second; otherwise `shutdownOperationFailure` no longer sees a `ProjectStorageOpeningReleaseFailedError` and the stop aggregate holds wrappers.
- **The successor note** (shutdown TDD record, `.rpiv/artifacts/evidence/2026-10-27_p3-s5b-shutdown-error-context-tdd.md:189`): the runtime edge unwraps one level only, so each bridge unwraps at its own edge. This slice does that: four Promise edges and two drains, listed above.

**The misaligned mutation ranges** (`stryker.project-storage.config.json`; counts from Stryker's instrumenter, `p3-s5b2-range-mutants-e2c1a06.log`):

- `process-bootstrap.ts:283-291`, the range the coordinator named. It was written at `de9966a` as `262-268`, the whole `applicationDatabaseLayer` (`const applicationDatabaseLayer = Layer.effect(` to `);`). At `961eee1` it was re-pointed 2 lines short (`275-281`), and it has started at the `CanonicalProjects` key string ever since. Its one mutant today is that key string (0-based line 282). The intended code is now `285-293`, text-verified, where its one mutant is the `Effect.gen` body (0-based line 286).
- **The same drift sits in the two bridge files this slice edits.** Their 7 ranges were written at `4cf6541`, and the files have moved since (`dff9a8e`, `e55b35b`, `4dbd834`, `316e596`); no realign followed. Each range is re-derived by a `git diff -U0 4cf6541` line map and checked by text against the code it held at `4cf6541`:

| Range today | Holds today | Intended code (at `4cf6541`) | Realigned | Mutants today → realigned (at `4cf6541`) |
|---|---|---|---|---|
| `application-database-authority.ts:51-64` | imports and the type tail | `APPLICATION_DATABASE_CLOSE_DEADLINE_MS` doc to `ApplicationDatabaseCloseUnconfirmed` | `56-69` | 1 → 4 (4) |
| `:155-170` | `AuthorityParts` tail and `createApplicationDatabaseAuthority` | the `acquireApplicationDatabaseAuthority` doc and body | `164-182` | 1 → 5 (4; +1 is the `physicalRoot` callback added since) |
| `:179-185` | the acquire's last lines | `closeDeadlineMs` to `let stopped = false` | `193-199` | 1 → 4 (4) |
| `:254-268` | the code before `close` | the bounded `close` | `268-282` | 6 → 12 (12) |
| `:481-484` | no mutant | `closeIfNeverStopped` | `495-498` | 0 → 6 (6) |
| `:509-515` | the code before `stop` | `stop` / `withhold` | `523-529` | 2 → 4 (4) |
| `registration-registry.ts:182-200` | the consent `record` and `resolve` bodies | the registry `stop` | `209-227` | 16 → 13 (13) |

- In total, the 7 ranges hold 27 mutants today, mostly of code they were not written for, and 48 once realigned, the counts they held at `4cf6541` plus the one `physicalRoot` callback. The slice moves these files' lines (a new import in `application-database-authority.ts` shifts every range below it), so their ranges are re-pointed in this slice anyway (Q39).

#### Slice p3-s5b-bridge-error-context

- **Lane:** normal. `lane.mjs --paths` over the 5 source files, the 4 test files and the config answers `normal` ("files: 6 > 5").
- **Deliverable:** the bridge family's 13 hits go to 0 with no observable change.
  - Each of the five declarations becomes `Deferred<_, UntypedRejection>`, and each `settle` / `publish` parameter becomes `Effect.Effect<_, UntypedRejection>`. A rejection is settled as `untypedRejection(error)` (`effect-rejection.ts:15`), never as `Effect.fail(new ...)`.
  - Each failure is unwrapped (`unwrapRejection`) where it leaves the Effect:
    - the Promise edges `retryable-attempt.ts:11`, `application-database-authority.ts:454`, `project-storage-application-client.ts:168` and `:204` take the shutdown part's form: `.catch((failure: unknown) => { throw unwrapRejection(failure); })` (Q38);
    - `registration-registry.ts` keeps its unwrap at `:222-223`, which now becomes load-bearing;
    - `project-storage-store.ts` `drainAdmittedOperations` unwraps before `shutdownOperationFailure`.
  - Unchanged identity rules:
    - `retryableAttempt` keeps `current === attempt`: the stored promise is the unwrapped one, so a failed attempt still clears itself and a success stays the answer;
    - the store still compares the raw rejection with `ownerStoppedError` before it wraps anything (`:571`).
  - `stryker.project-storage.config.json`: the 8 ranges above are realigned to their intended code, and any range this slice's edits move is re-pointed the same way (the s5a and s5b precedent: a word diff of each range's text before and after, plus the instrumenter count).
- **Affected paths:**
  - source: `apps/harness/src/storage/retryable-attempt.ts`, `apps/harness/src/registration/registration-registry.ts`, `apps/harness/src/storage/application-database-authority.ts`, `apps/harness/src/storage/project-storage-application-client.ts`, `apps/harness/src/storage/project-storage-store.ts`;
  - tests: `apps/harness/src/storage/retryable-attempt.test.ts` (new), `apps/harness/src/storage/project-storage-store.test.ts`, `apps/harness/tests/integration/application-database-authority-cases.integration.test.ts`, `apps/harness/tests/integration/project-storage-application-client.integration.test.ts`;
  - config: `stryker.project-storage.config.json`.
- **Dependencies:** `p3-s5b-shutdown-error-context` (verified at `e2c1a06`; it leaves exactly these 13 hits), and the `effect-rejection.ts` owner (no change to it).

**Measured at `e2c1a06` (read-only):**

- **Existing identity oracles (guards, unchanged, must stay green):**
  - registry stop: `registration-registry.test.ts:215-240`. An admission refused during stop is `errors[0]` `toBe(refusal)` and travels through a `pending` completion; the unconfirmed close is `errors[1]`. `expectUnconfirmedAggregate` (`:76-93`) is the other stop row;
  - store stop: `project-storage-store.test.ts:700-740` ("retains a late activation release across shutdown", `errors` `toEqual([f.failure])` / `[f.failure, secondFailure]` after the `Set`), `:763-805` (`errors` `toEqual([registryFailure])`), and `:742` (an operation whose lock threw before admission is not waited for);
  - authority: `application-database-authority-cases.integration.test.ts:335` (`rejects.toBe(failure)` for a failed fresh creation, single caller), `:212`, `:269`, `:285`, `:355` and the `joiners` table (`:297`) (joins that succeed);
  - application client: `project-storage-application-client.integration.test.ts:35` (stop waits for a pending initialization), `:83` (`rejects.toBe(failure)` for typed unavailability, single caller), `:107`;
  - `retryableAttempt` callers: `canonical-project-writer.test.ts` and `storage/canonical-writer-lease.test.ts`.
- **Gaps those oracles leave:**
  - `retryableAttempt` has no test of its own;
  - no row makes a second caller join a failing initialization (authority `:454`, client `:168`);
  - no row makes the client's stop await a failing one (`:204`);
  - no store row pins a drained operation's rejection by identity with `toBe`;
  - every rejection in these rows is an `Error`.
- **CodeScene** at `e2c1a06`: all 10. Source: `retryable-attempt.ts`, `registration-registry.ts`, `application-database-authority.ts`, `project-storage-application-client.ts`, `project-storage-store.ts`. Tests: `project-storage-store.test.ts`, `registration-registry.test.ts`, `application-database-authority-cases.integration.test.ts`, `project-storage-application-client.integration.test.ts`.

**Constraints:**

- No observable change: every promise rejects with today's value by identity, every shared or joined promise stays the same promise, and a stop still waits for what it waits for today.
- No `UntypedRejection` leaves any of the five files.
- No new `Effect.fail(new ...)`; no `{ err }` log is added.
- No Promise body moves to Effect (Part B line). The edges stay Promise facades.
- `check:effect`: `anyUnknownInErrorContext` falls by exactly 13, to 0, and no other count rises. A changed type that the Effect language service reports as an `error` (as `missingEffectError` did in the shutdown part's binding 4) blocks the slice.

#### Test Contract: p3-s5b-bridge-error-context

- **Behavior P3-B28: `retryableAttempt` keeps its single-flight and retry rules and rejects with the attempt's own failure.**
  - Test: `apps/harness/src/storage/retryable-attempt.test.ts` (new), through `retryableAttempt(start)`'s returned function with fake `start` functions.
  - Rows:
    - a `start` that rejects with the string `"attempt refused"` → the call rejects `toBe("attempt refused")`;
    - a `start` that throws an `Error` synchronously → the call rejects `toBe` that error and `not.toBeInstanceOf(UntypedRejection)`;
    - after a failed attempt the next call starts again (`start` called twice) and returns a new promise;
    - after a successful attempt, later calls return the same promise and `start` is called once;
    - a call made while `start` is running (re-entry from inside `start`) returns the same promise.
  - Expected red: none at the base. The change is type-only, and the rows pin preserved behaviour. The red-to-green is the `effect-tsgo` read; binding 1 shows the bite.
- **Behavior P3-B29: a caller joining a failing initialization, and a stop awaiting one, reject with that initialization's own failure.**
  - Test: `apps/harness/tests/integration/application-database-authority-cases.integration.test.ts` and `apps/harness/tests/integration/project-storage-application-client.integration.test.ts` (integration, real disk; the test reclassification rule).
  - Rows:
    - `application-database-authority-cases.integration.test.ts`, through the authority's `openCurrent` and `ensureCurrent`: the `:269` fixture with the gated fresh creation failing with `failure` (`withGatedAuthority`'s failure argument, as at `:335`) → the registry's `openCurrent` rejects `toBe(failure)`, and Storage's `ensureCurrent`, joining it, rejects `toBe(failure)`. Where the `joiners` table (`:297`) fits, the row is one failing entry per joiner there;
    - `project-storage-application-client.integration.test.ts`, through `createApplicationClientManager(...)`:
      - a second `existing()` started while the first one's `initialize` is pending, which then throws `new ProjectStorageUnavailableError(...)` → both reject `toBe(failure)`;
      - a `stop()` started while that initialization is pending → it rejects `toBe(failure)` and does not close a client.
  - Expected red: none at the base, as for P3-B28. The implementer runs the new rows at the base first and records them green. A row that is red at the base is a finding; it is reported, and the contract is not adjusted to fit. Bindings 2, 3 and 4 show the bite.
- **Behavior P3-B30: a stop's aggregate holds each drained operation's own failure.**
  - Test: `apps/harness/src/storage/project-storage-store.test.ts`, through the owner's `stop()`.
  - New row: an admitted operation (an `upgrade` whose fake dependency rejects with the string `"upgrade refused"` after `stop()` is called) → the stop rejects `instanceof AggregateError`, `message` `toBe("Project Storage shutdown failed.")`, `errors[0]` `toBe("upgrade refused")`, and no element `instanceof UntypedRejection`.
  - The registry side is covered by the existing guard `registration-registry.test.ts:215-240` (`errors[0]` `toBe(refusal)`), which this slice makes load-bearing.
  - Expected red: none at the base; bindings 5 and 6 show the bite.

**Bindings that bite.** Each one is shown failing on a named row, then reverted by digest, and listed in the TDD record with its assertion message.

1. Drop the unwrap at `retryable-attempt.ts:11`. P3-B28's two rejection rows fail (`expected UntypedRejection{…} to be …`). The callers' rows are read in the same run and their outcome is recorded.
2. Drop the unwrap at `application-database-authority.ts:454` (`joinInFlight`). P3-B29's authority row fails on the joiner.
3. Drop the unwrap at `project-storage-application-client.ts:168` (`acquire`). P3-B29's joining `existing()` row fails, because `translateAcquisitionFailure` no longer sees the `ProjectStorageUnavailableError`.
4. Drop the unwrap at `project-storage-application-client.ts:204` (`stop`). P3-B29's stop row fails.
5. Drop the unwrap in `drainAdmittedOperations` (`project-storage-store.ts`). P3-B30's row fails. `:700-740` is read in the same run and its outcome is recorded.
6. Drop `unwrapRejection` at `registration-registry.ts:222-223`. `registration-registry.test.ts:215-240` fails on `errors[0]`.
7. Leave `retryable-attempt.ts`'s `completion` typed `Deferred<void, unknown>`, with the rest as the candidate. The `effect-tsgo` read shows `anyUnknownInErrorContext` 1 or 2 at `retryable-attempt.ts` only, and no `error`; the implementer records the exact count.

**Structural checks (on the candidate):**

- `rg -n "Effect\.Effect<[^>]*, unknown>|Deferred(\.Deferred)?<[^>]*, unknown>|makeUnsafe<[^>]*, unknown>"` over the five source files → 0 lines.
- `rg -n "unwrapRejection"` over the five source files names the four Promise edges, the store drain and the registry stop.
- `rg -n "Effect\.fail\(\s*new "` over the five source files → 0 lines. The `application-database-authority.ts:277` `orElse` site is Q36's, owned by s5c; this slice does not move it.
- `git diff e2c1a06 --stat` lists only the affected paths above.
- The `stryker.project-storage.config.json` diff changes only the 8 realigned ranges and any range this slice's edits move. Each range's text is shown against its intended code, and the instrumenter counts are recorded (expected: 4, 5, 4, 12, 6, 4, 13 and 1, before any move this slice causes).
- The `effect-tsgo diagnostics --format json` read at the candidate:
  - total 15 diagnostics, 8 warnings;
  - `anyUnknownInErrorContext` 0;
  - `schemaNumber` 6, `unnecessaryFailYieldableError` 2, `extendsNativeError` 0;
  - no `error`; `message` advice still 7.

#### Success Criteria: p3-s5b-bridge-error-context

Automated (smallest first; each read by its real exit code):

- Red-green:
  - `pnpm --filter @slopstop/harness exec vitest run src/storage/retryable-attempt.test.ts src/storage/project-storage-store.test.ts src/registration/registration-registry.test.ts`;
  - `pnpm --filter @slopstop/harness exec vitest run --config vitest.integration.config.ts tests/integration/application-database-authority-cases.integration.test.ts tests/integration/project-storage-application-client.integration.test.ts`;
  - then the `effect-tsgo` read.
- The guards: `src/canonical-project-writer.test.ts`, `src/storage/canonical-writer-lease.test.ts`, `src/storage/application-database-authority.test.ts`.
- A Stryker dry run of `stryker.project-storage.config.json` (it initial-test-runs the suite and counts mutants; no mutation run unless Q41 says so). This needs the coordinator's go-ahead as a heavy run.
- `pnpm typecheck` exit 0. `pnpm check` exit 0 with "8 advisory warnings" (read CPU first, in its own call).
- CodeScene 10 on every touched file, the test files included.

Manual: none.

#### Open questions (p3-s5b-bridge-error-context)

- **Q38: the form of the Promise-edge unwrap.**
  - (a) **Recommended.** The shutdown part's inline form at each of the four edges. With the shutdown part's three, that makes seven copies of a three-line lambda. Each copy is visible at its edge, and the slice touches no accepted file.
  - (b) A small helper in `effect-rejection.ts` (`rethrowUnwrapped(failure): never`), used at all seven edges. That gives one owner, but it reopens `harness-runtime.ts` and `process-bootstrap.ts` source, whose rows (P3-B26, P3-B27) would guard the move.
- **Q39: the scope of the range realign.**
  - (a) **Recommended.** Realign all 8: the `process-bootstrap.ts` range the coordinator named, plus the 7 in the two bridge files. The slice moves those files' lines and must re-point their ranges anyway; re-pointing a misaligned range by line offset would keep it misaligned.
  - (b) Only the `process-bootstrap.ts` range; the other 7 are reported for a later slice.
- **Q40: ranges in files this slice does not edit.** No check in the repo keeps Stryker line ranges aligned with their code. This read audited only the 8 ranges above; the other line ranges in `stryker.project-storage.config.json` and the other configs were not audited.
  - (a) **Recommended.** Leave them out of this slice. Add one check to s6 (rule promotion): each line range in every Stryker config is re-derived from its writing commit and matched by text.
  - (b) Audit every range in this slice.
- **Q41: mutation for this slice.**
  - (a) **Recommended.** No mutation run (as Q37), only the dry run and the instrumenter counts.
  - (b) A scoped run of `stryker.project-storage.config.json` limited to the 8 realigned ranges (49 mutants by the instrumenter), since most of them have not been mutated since the files moved.

### 2026-10-27: p3-s5b-bridge-error-context approved, Q38-Q41 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s5b-bridge-error-context` at `content_hash abc6f917521b3c16f1ef8a00d0b55f05e06c06e070bc5a75deaf1447bb91a9ac`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-abc6f917.md` (main checkout). The contract (P3-B28 to P3-B30), the measured tables, the seven bindings, the guard rows and the structural checks stand as written. Lane normal.
- **Q38 (a):** each of the four Promise edges takes the shutdown part's inline unwrap form; no helper, and no accepted file is reopened.
- **Q39 (a):** all 8 ranges are realigned in this slice (`process-bootstrap.ts:283-291` to `285-293`, the 6 `application-database-authority.ts` ranges and the `registration-registry.ts` range), each matched by text to its intended code, with the instrumenter counts recorded.
- **Q40 (a):** no audit of other ranges in this slice. **s6 commitment:** `p3-s6-effect-rule-promotion` adds a range-alignment check. Each line range in every Stryker config is re-derived from the commit that wrote it and matched by text to its intended code today. A range that matches is kept, and a drifted range is realigned or reported. The check reports its result per config.
- **Q41 (b):** one scoped mutation run of `stryker.project-storage.config.json`, limited to the 8 realigned ranges (49 mutants by the instrumenter before this slice's moves), on the final candidate.
  - It runs alone, under the CPU rule (CPU read in its own call first) and with the coordinator's GO.
  - Every survivor, and every mutant without coverage, is shown to Pedro as it stands, with its file, line and mutator. None is waived or killed by editing tests without his decision.
  - The dry run of the whole config stays in the Success Criteria. The scoped run's config or `--mutate` list is recorded in the TDD record.

### 2026-10-27: slice p3-s5c-schema-number-yieldable detailed

The deferred s5c row (trigger: none; the s5b family closed at `cdd2027`) is detailed from a fresh read at `cdd2027`. Behavior IDs P3-B31 to P3-B33. It carries Q36 (a), the Q32 (a) trigger and the `message` advice. This section changes no earlier slice's contract.

**Fresh read at `cdd2027`** (`pnpm check:effect` exit 0, "8 advisory warnings"; CPU 4% before the run; `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s5c-check-effect-cdd2027.log`, `effect-advisory-cdd2027.json`, main checkout):

- 15 diagnostics: `schemaNumber` 6, `unnecessaryFailYieldableError` 2, `message` advice 7, `anyUnknownInErrorContext` 0, `extendsNativeError` 0, no `error`. As the bridge part predicted.
- Three `schemaNumber` lines have moved since `b94f302`: `canonical-command-repository-faults.integration.test.ts:35` is now `:41`, and `conformance-counter-command.ts:761` (×2) is now `:763` (×2).

| Rule | Site at `cdd2027` | What it is |
|---|---|---|
| `schemaNumber` | `src/canonical-command-registry.test.ts:218` | the target of the "delivers schema-transformed numeric output" row's `Schema.decodeTo(Schema.Number, transform(Number))` |
| `schemaNumber` | `src/canonical-command-registry.test.ts:306`, `:328` | `payloadSchema: Schema.Number` in two type-level rows (`expectTypeOf(payload).toEqualTypeOf<number>()`) |
| `schemaNumber` | `tests/integration/canonical-command-repository-faults.integration.test.ts:41` | `sqliteScalars`, the fault fixture's row decoder (used at `:48`, `:55`) |
| `schemaNumber` | `tests/integration/conformance-counter-command.ts:763` (×2) | `counterPayloadSchema.meta`'s `a` and `b` |
| `unnecessaryFailYieldableError` | `registration/existing-registration.ts:56` | `return yield* Effect.fail(corrupt)` (`corrupt` is the module-level `RegistryReadFailed`, `:41`) |
| `unnecessaryFailYieldableError` | `storage/project-storage-upgrade-pipeline.ts:384` | `return yield* Effect.fail(settled.failure)` |

- `Schema.Finite` is the fix the rule names. It already has a user in source (`storage/local-libsql-worker-client.ts:24,295`). Its `Type` is `number`, so the type-level rows are unchanged.

**The `Effect.fail(new X(...))` sites (Q36 (a)).** The single-line `rg -n "Effect\.fail\(\s*new " apps packages` finds Q36's four. A multiline `rg -n -U` finds **a fifth**, which the single-line form cannot see:

| Site at `cdd2027` | Context | Class |
|---|---|---|
| `harness/src/conversation/conversation-rows.ts:78` | `flatMap` ternary, decode failure | `ConversationStorageBroken` (`Data.TaggedError`) |
| `harness/src/conversation/conversation-save.ts:40` | `flatMap` ternary, reconciliation found no save | `ConversationStorageBusy` (`Data.TaggedError`) |
| `harness/src/storage/application-database-authority.ts:278` | `timeoutOrElse` `orElse` | `ApplicationDatabaseCloseUnconfirmed` (`Data.TaggedError`) |
| `desktop/src/main/harness-supervisor.ts:207` | `Effect.suspend` body after the degraded status | `HarnessShutdownTimeout` (`Data.TaggedError`) |
| `desktop/src/main/main.ts:129-131` (new) | `Effect.callback` `resume` ternary, `stderr.write` error | `WriterProofReportFailed` (`Data.TaggedError`, `:120`) |

- None is in a generator, so none is an `unnecessaryFailYieldableError` hit, and no test file has one.
- **What "return the error itself" means in Effect 4.0.0, verified in the installed package:** a `YieldableError` is an Effect. Its type carries `[Effect.TypeId]: Variance<never, this, never>` (`effect/dist/Cause.d.ts:1221-1224`), which satisfies `Effect<never, this, never>` (`Effect.d.ts:80-86`: the other members are optional). At run time its prototype is a primitive whose `evaluate()` returns `exitFail(this)` (`effect/dist/internal/core.js:354-365`). So `new X(...)` in an Effect position fails with that same instance, exactly as `Effect.fail(new X(...))` does.
- **Where this is stricter than upstream:** the Effect 4 docs (Context7 `/websites/effect_website_v4`, "Expected Errors > Creating Expected Errors") show `Effect.fail(new UserNotFound({ id }))` in a ternary as their own example. The project bar ("never `Effect.fail(new X)`") is the coordinator's and Q36's, not Effect's. Q42 asks for the form.

**Q32 (a) trigger: s5c does not trip it.** The trigger is the first desktop oracle that compares two converted errors differing only in `message` or `cause`. s5c's desktop work is two sites:

- `harness-supervisor.ts:207`: its rows (`harness-supervisor.test.ts:615` "kills after grace and rejects after the terminal exit deadline", `:1102` "stops forwarding when a stopping child never exits") go through `expectShutdownTimeout` (`:84-91`). That helper reads `toBeInstanceOf` and `toMatchObject` against a plain object, never two errors.
- `main.ts:129`: no automated row reaches it (below).

s5c adds no desktop oracle. The existing desktop error-equality rows (`package-smoke-error-contract.test.ts:83,87`, `registration-package-smoke.test.ts:62`) are s5a-desktop's; they rest on the own enumerable `stage` (that slice's binding 2). After s5c, no Phase 3 slice owns the gap; Q45 places it.

**Reaching rows (measured statically at `cdd2027`):**

| Site | Reaching row | How it reaches |
|---|---|---|
| `existing-registration.ts:56` | **none** | `inspectProposal` is reached only through `createProposalSteps` (`registration-proposal-steps.ts:101`), after `owner.prepare` answers `prepared`. The branch needs the proposal row absent at that point. No test deletes it. The only test edit of `registration_proposals` (`registration-preparation.integration.test.ts:419`, `record_json = '{}'`) fails earlier, in `readProposal`'s decode (`registration-proposal-store.ts:114-115`). |
| `project-storage-upgrade-pipeline.ts:384` | `project-storage-upgrade-failure.integration.test.ts:267` "a source changed before the switch stays quarantined" | `switchActive` throws `ProjectStorageBrokenError` (`project-storage-upgrade-node-adapter.ts:327`). `committingStep` maps it to `UpgradeSwitchFailed`, `settled` is a failure, and `:384` yields it. The row asserts `{ status: "broken", message: "Project Storage upgrade source changed before the switch." }`. |
| `conversation-rows.ts:78` | `conversation-rows.test.ts:61` "treats a stored row with a non-strict identity as broken storage ($name)" | direct, `toBeInstanceOf(ConversationStorageBroken)` |
| `conversation-save.ts:40` | `conversation-uncertain-commit.integration.test.ts:47` "reconciles an uncertain commit by its save id: known client state" (`failedWith("ConversationStorageBusy")`, `:60`) | likely: the blocked commit is reconciled and no save is found. Not proven statically; binding 6 proves or disproves it. |
| `application-database-authority.ts:278` | `application-database-authority.test.ts:46` "rejects an unconfirmed close at the deadline: $name" | direct: pending at `deadline - 1`, rejected at `deadline`, `toMatchObject({ _tag, message, deadlineMs })` |
| `harness-supervisor.ts:207` | `harness-supervisor.test.ts:615`, `:1102` | through `expectShutdownTimeout` |
| `main.ts:129` | **none** | `writeWriterProofReport` runs only in the package-smoke writer proof (`main.ts:171`), on a failed `stderr.write`. The `Effect.callback<void, WriterProofReportFailed>` signature type-checks the value. |

**Mutation configs over these files** (read at `cdd2027`):

- `stryker.conversation.config.json` mutates `conversation-rows.ts` and `conversation-save.ts` whole.
- `stryker.project-storage.config.json:29` holds `application-database-authority.ts:269-283`, which contains `:278`. That is one of s5b-bridge's realigned ranges; a one-line edit does not move it.
- `stryker.desktop-s8.config.json:5` holds `harness-supervisor.ts:176-233`, which contains `:207`. One-line edit, no shift. `stryker.config.json:26` and `stryker.project-storage-desktop.config.json:4` mutate the file whole.
- `stryker.desktop-s6.config.json:16-19` holds `main.ts:96-106`, `123-139`, `294-323`, `441-441`, written at `4cf6541`. The text there today does not match whole units: `:139` is inside the next function, `:294` is mid-signature, `:323` is inside `BrowserWindow` options, and `:441` is `supervisor.start();`. They have drifted since `4cf6541`, the drift the s6 range-alignment commitment (Q40 (a)) covers. Collapsing `main.ts:129-131` to one line (95 columns, within Biome's `lineWidth` 100) moves every later line up by 2. Q47 asks who re-points them.
- `existing-registration.ts` and `project-storage-upgrade-pipeline.ts` are in no config.

**The `message` advice (7, all outside the four rules):**

- harness tests: `unnecessaryEffectGen` at `process-bootstrap.test.ts:97,125`, `preferUnsafeConstructor` at `application-database-authority.test.ts:168` and `project-storage-locks.test.ts:22`, `runOfExitToRunExit` at `application-database-authority.test.ts:178`;
- desktop source: `flatMapConditionalToFilterOrFail` at `project-entry-bridge.ts:128` and `project-storage-bridge.ts:120`.
- The approved Architecture says these "are out of scope and stay advice" (Architecture, "Effect advisory warnings and promotion"). s6 promotes only the four rules, and `message` never blocks `check:effect`. Q46 asks whether to keep that.

#### Slice p3-s5c-schema-number-yieldable

- **Lane:** normal. `lane.mjs --paths` over the 10 paths below answers `normal` ("files: 8 > 5"). The deferred row's "fast, 5 files" predates Q36 and the fifth site.
- **Deliverable:** the last 8 advisory warnings and the 5 `Effect.fail(new X(...))` sites go to 0. The only observable change is in two test fixtures: they now reject non-finite numbers.
  - `schemaNumber`: each of the 6 sites becomes `Schema.Finite`.
  - `unnecessaryFailYieldableError`: `return yield* corrupt` and `return yield* settled.failure`.
  - The 5 non-generator sites take the form Q42 settles. Recommended: return the error itself (`new X(...)`), with no cast.
- **Affected paths:**
  - source: `apps/harness/src/registration/existing-registration.ts`, `apps/harness/src/storage/project-storage-upgrade-pipeline.ts`, `apps/harness/src/conversation/conversation-rows.ts`, `apps/harness/src/conversation/conversation-save.ts`, `apps/harness/src/storage/application-database-authority.ts`, `apps/desktop/src/main/harness-supervisor.ts`, `apps/desktop/src/main/main.ts`;
  - test fixtures and tests: `apps/harness/src/canonical-command-registry.test.ts`, `apps/harness/tests/integration/canonical-command-repository-faults.integration.test.ts`, `apps/harness/tests/integration/conformance-counter-command.ts`;
  - config: only if Q47 says so (`stryker.desktop-s6.config.json`).
- **Dependencies:** the s5b family (closed at `cdd2027`; it leaves exactly these 8 warnings). s6 depends on this slice, because it promotes only at count 0.

**Constraints:**

- Every production failure stays the same instance, tag, message and timing. In particular, the authority close still rejects at exactly `closeDeadlineMs`, and the supervisor still sets its degraded status before it fails.
- No cast and no `as` to make a returned error type-check. If a site does not infer `E` without one, the implementer stops and reports; it is not forced.
- No new `Effect.fail(new ...)` anywhere, in source or tests.
- No `@effect-diagnostics-next-line` waiver. Waivers need Pedro's per-line approval, and none is asked for.
- `check:effect`: `schemaNumber` and `unnecessaryFailYieldableError` fall to 0, and no other count rises. Any `error` blocks the slice.

#### Test Contract: p3-s5c-schema-number-yieldable

- **Behavior P3-B31: the conformance fixtures' numeric schemas reject non-finite numbers.**
  - Test: `apps/harness/src/canonical-command-registry.test.ts`, through `defineCanonicalCommand(...).prepare(payload)`. `CanonicalJsonValue` is a plain `number` there (`canonical-project-protocol.ts:297-303`), so the rows need no cast.
  - Rows (new):
    - the `:212` "delivers schema-transformed numeric output" definition, `prepare("Infinity")` → `toEqual({ status: "rejected", rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false } })`, and the handler is not called. The existing `prepare("7")` row stays green.
    - `counterPayloadSchema` (the file's `payloadSchema`, `:183`), table `[{ value: 1, meta: { a: Infinity, b: 1 } }, { value: 1, meta: { a: 1, b: -Infinity } }]` → each `prepare` result `toEqual` that rejection.
  - The type-level rows at `:306` and `:328` and the faults fixture's `sqliteScalars` (`:41`) keep their rows unchanged and green. Their oracle is the `effect-tsgo` read; they have no runtime row, because no fixture feeds them a non-finite value.
  - Expected red, observed at the base before the change: all three rows answer `status: "ready"`, because `Schema.Number` accepts non-finite numbers.
- **Behavior P3-B32: the two yielded failures stay the same failures.**
  - Test: `apps/harness/tests/integration/project-storage-upgrade-failure.integration.test.ts`, the row at `:267` through the upgrade owner's `upgrade(openRequest)`, unchanged and green (integration, real disk).
  - `existing-registration.ts:56` has no reaching row (above); Q44 decides.
  - Expected red: none. `yield* x` and `Effect.fail(x)` both evaluate to `exitFail(x)` (`core.js:354-365`). The red-to-green is the `effect-tsgo` read, `unnecessaryFailYieldableError` 2 → 0. Binding 3 shows the row bites.
- **Behavior P3-B33: the five returned errors stay the same failures.**
  - Test: `apps/harness/src/conversation/conversation-rows.test.ts` (`:61`), `apps/harness/tests/integration/conversation-uncertain-commit.integration.test.ts` (`:47`), `apps/harness/src/storage/application-database-authority.test.ts` (`:46`) and `apps/desktop/src/main/harness-supervisor.test.ts` (`:615`, `:1102`; desktop main config), each row unchanged and green. `main.ts:129` has no row (above).
  - Expected red: none, for the same reason as P3-B32. The red-to-green is the structural check: the multiline `rg` finds 5 before and 0 after.

**Bindings that bite.** Each one is shown failing on a named row, then reverted by digest, and listed in the TDD record with its assertion message.

1. Revert `canonical-command-registry.test.ts:218` to `Schema.Number`. P3-B31's `"Infinity"` row fails (`ready`).
2. Revert `conformance-counter-command.ts:763` `a` to `Schema.Number`, then, separately, `b`. The matching P3-B31 table row fails each time.
3. Delete the `return yield* settled.failure` line at `project-storage-upgrade-pipeline.ts:384`. `project-storage-upgrade-failure.integration.test.ts:267` fails.
4. `conversation-rows.ts:78` → `Effect.succeed([])`. `conversation-rows.test.ts:61` fails.
5. `application-database-authority.ts:278` → `Effect.void`. `application-database-authority.test.ts:46` fails at `deadline`.
6. `conversation-save.ts:40` → `new ConversationStorageBroken({ cause: ... })`. `conversation-uncertain-commit.integration.test.ts:60` fails, which proves it reaches. If it stays green, the row does not reach `:40`. The implementer then reports that, and does not add a row without a decision.
7. `harness-supervisor.ts:207` → `Effect.void`. `harness-supervisor.test.ts:615` and `:1102` fail.
8. Only if Q44 is (b): `existing-registration.ts:56` → `return { proposal, existing: { status: "none" } } as const` with `proposal` undefined. The new row fails.

**Structural checks (on the candidate):**

- `rg -n -U "Effect\.fail\(\s*new " apps packages` → 0 lines. This is the multiline form, which replaces Q36's single-line check, because the single-line form misses `main.ts`.
- `rg -n "Effect\.fail\((corrupt|settled\.failure)\)" apps/harness/src` → 0 lines.
- `git diff cdd2027 --stat` lists only the affected paths above.
- The `effect-tsgo diagnostics --format json` read at the candidate:
  - total 7 diagnostics, all `message` advice (the same 7, unless Q46 says otherwise);
  - 0 warnings: `schemaNumber` 0, `unnecessaryFailYieldableError` 0, `anyUnknownInErrorContext` 0, `extendsNativeError` 0;
  - no `error`.

#### Success Criteria: p3-s5c-schema-number-yieldable

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run src/canonical-command-registry.test.ts`, then the `effect-tsgo` read.
- Guards:
  - `pnpm --filter @slopstop/harness exec vitest run src/conversation/conversation-rows.test.ts src/storage/application-database-authority.test.ts`;
  - `pnpm --filter @slopstop/harness exec vitest run --config vitest.integration.config.ts tests/integration/project-storage-upgrade-failure.integration.test.ts tests/integration/conversation-uncertain-commit.integration.test.ts tests/integration/canonical-command-repository-faults.integration.test.ts`, plus the integration files that import `conformance-counter-command.ts` (the implementer lists them by `rg`). This needs the coordinator's go-ahead if it exceeds 2 minutes.
  - `pnpm --filter @slopstop/desktop exec vitest run --config vitest.main.config.ts src/main/harness-supervisor.test.ts`.
- `pnpm typecheck` exit 0. `pnpm check` exit 0 with no "advisory warnings" count, or "0 advisory warnings"; the exact wording is recorded (read CPU first, in its own call).
- CodeScene 10 on every touched file, the test files included.

Manual: none. `main.ts:129` is exercised only by the package smoke in the deep gate before push.

#### Open questions (p3-s5c-schema-number-yieldable)

- **Q42: the form for the five non-generator sites.**
  - (a) **Recommended.** Return the error itself (`new X(...)`), as Q36 (a) said ("return or `yield*` the error itself"). The behaviour is identical (verified above), the structural check can be 0, and no cast is used. The risk is type inference in a ternary next to `Effect.succeed`; the constraint makes the implementer stop rather than cast.
  - (b) Keep `Effect.fail(new X(...))` outside generators, the form the Effect 4 docs use, and drop the structural check. This reopens Q36.
- **Q43: the fifth site, `main.ts:129`.**
  - (a) **Recommended.** In this slice, with the check switched to multiline. It is the same pattern, and leaving it would make s6's count-0 premise false for this pattern.
  - (b) Leave it out, and record it as a known exception to the check.
- **Q44: `existing-registration.ts:56` has no reaching row.**
  - (a) **Recommended.** Rewrite it without a new row, and record it as unreached in the TDD record. The rewrite is value-identical (`exitFail(corrupt)` both ways), and the same `corrupt` instance is yielded.
  - (b) Add a row through `createProposalSteps(...).prepare`, with a fake `ProposalOwner` that answers `prepared` on a real registry with no proposal row → the answer is `failureOf(registryCorrupt)`. That is a new fixture for an identity rewrite (binding 8).
- **Q45: the desktop error-equality gap after s5c.**
  - (a) **Recommended.** Move it to Deferred Work beyond Phase 3, with no owning slice and the same trigger (the first desktop oracle comparing two converted errors that differ only in `message` or `cause`). It lands then as one owner shared by both apps (`shared-vocab-union`), with the symmetric cause rule. s5c does not trip the trigger.
  - (b) Extract the shared owner in s5c now. That touches the 4 harness Vitest configs and `vitest.setup-files.ts` in a slice about schema and failure forms.
- **Q46: the 7 `message` advice items.**
  - (a) **Recommended.** They stay advice, as the approved Architecture says. They are not among the four rules, s6 does not promote them, and two of them are desktop source bridges.
  - (b) Fix the 5 harness test-file items in s5c (`Scope.makeUnsafe`, `Deferred.makeUnsafe`, `Effect.runPromiseExit`, and removing the two single-return `Effect.gen`). They are mechanical, but they add 3 test files.
  - (c) Fix all 7, including the two desktop bridges' `Effect.filterOrFail`. That is a source change in two IPC bridges.
- **Q47: `stryker.desktop-s6.config.json`'s `main.ts` ranges.**
  - (a) **Recommended.** Leave them to s6's range-alignment check, which re-derives every range from its writing commit (`4cf6541`) whatever its current offset. The 2-line shift is recorded in s5c's TDD record. They are already drifted, and no mutation run here needs them.
  - (b) Re-point the 4 ranges in s5c, using the s5b-bridge method (text-matched to `4cf6541`, with instrumenter counts).
- **Q48: mutation for this slice.**
  - (a) **Recommended.** No mutation run. Every source edit is a value-identical rewrite, and the test fixtures are not mutated.
  - (b) A scoped run of `stryker.conversation.config.json` over the two conversation files, under the coordinator's go-ahead.

### 2026-10-27: p3-s5c-schema-number-yieldable approved, Q42-Q48 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s5c-schema-number-yieldable` at `content_hash 03af7b6d2204e4180899a8e109513debff5631df22b9eababb1739477a258a7f`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-03af7b6d.md` (main checkout). The contract (P3-B31 to P3-B33), the measured tables, the eight bindings, the guard rows and the structural checks stand as written, with the P3-B32 row Q44 (b) adds below. Lane normal.
- **Q42 (a):** the five non-generator sites return the error itself (`new X(...)`), with no cast. A site that does not infer its error type without a cast stops the implementer, who reports it.
- **Q43 (a):** `main.ts:129-131` is in this slice. The structural check is the multiline `rg -n -U "Effect\.fail\(\s*new " apps packages` → 0.
- **Q44 (b):** a new row reaching `existing-registration.ts:56` joins **P3-B32**.
  - Test: `apps/harness/tests/integration/registration-proposal-steps.integration.test.ts` (new; integration, because it uses a real registry database), through `createProposalSteps({ owner, options }).prepare(request)`.
  - Row: `owner` is a fake `ProposalOwner` whose `prepare` resolves `{ status: "prepared", proposalFingerprint: <a fingerprint> }` and writes nothing. `options` is a real migrated registry with no `registration_proposals` row for the request. The answer is `toEqual({ status: "broken", code: "REGISTRY_CORRUPT" })` (`registryCorruptFailure`, `registry-failure.ts:35`, through `failureOf`), and the fake `confirm` is not called.
  - Expected red: none at the base. The row is a new guard and is recorded green at the base before the rewrite. A row that is red at the base is a finding: it is reported, and the contract is not adjusted to fit.
  - Binding 8 applies as written: `existing-registration.ts:56` → `return { proposal, existing: { status: "none" } } as const` with `proposal` undefined, and this row fails.
  - The affected test paths gain this file. With it, `lane.mjs` still answers normal.
- **Q45 (a):** the desktop error-equality gap moves to Deferred Work beyond Phase 3, with no owning slice. Its trigger is the first desktop oracle that compares two converted errors differing only in `message` or `cause`. It then lands as one owner shared by both apps (`shared-vocab-union`), with the symmetric cause rule. s5c does not trip it.
- **Q46 (a):** the 7 `message` advice items stay advice, as the approved Architecture says. The candidate's `effect-tsgo` read shows the same 7.
- **Q47 (a):** `stryker.desktop-s6.config.json`'s `main.ts` ranges are left to s6's range-alignment check (the Q40 (a) commitment). The −2 line shift after `main.ts:131` is recorded in the s5c TDD record.
- **Q48 (a):** no mutation run for this slice.

### 2026-10-27: slice p3-s6-effect-rule-promotion detailed, split into promotion and range-alignment parts

The deferred s6 row (trigger: a re-measured count of 0 on the s5 head; Q8) is detailed from a fresh read at `07c46e5`. Behavior IDs P3-B34 to P3-B38. It carries the four-rule promotion, the Q40 (a) range-alignment commitment, Q47 (a) and the `writer-proof-report.ts` move. This section changes no earlier slice's contract.

**Fresh read at `07c46e5`** (CPU 4% before the run; an earlier read of 91% deferred it; `pnpm check:effect` exit 0, "Effect diagnostics verified; 0 advisory warnings."; `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s6-check-effect-07c46e5.log`, `effect-advisory-07c46e5.json`, main checkout):

- 7 diagnostics, all `message`: `unnecessaryEffectGen` 2, `preferUnsafeConstructor` 2, `runOfExitToRunExit` 1, `flatMapConditionalToFilterOrFail` 2 (Q46 (a): they stay advice).
- `anyUnknownInErrorContext`, `extendsNativeError`, `schemaNumber` and `unnecessaryFailYieldableError` are 0 in all four projects, tests included. **The trigger holds.** Q8 needs no per-line question.
- No `@effect-diagnostics-next-line` for any of the four rules exists in `apps` or `packages`. The waiver register (`effect-diagnostics-waivers.json`) holds only `newPromise` entries (EW1-EW5, EW9).

**The promotion surface (read at `07c46e5`):**

- `tsconfig.base.json:39-42`: the four rules are `"warning"`. The test-file override (`:49-51`) turns off only `newPromise`, so the promoted rules apply to test files too, as the count of 0 assumes.
- The canary (`apps/harness/scripts/effect-diagnostics-canary/src/canary.ts`) witnesses only one of the four rules: `untyped` (`:4`) yields `warning anyUnknownInErrorContext` twice (`check-effect-diagnostics.mjs:196-199`, `expectedCanary`).
  - **A gap:** after the promotion, a severity reverted to `warning` for `schemaNumber`, `unnecessaryFailYieldableError` or `extendsNativeError` would pass the canary unseen. It would also pass every package scan, which only counts warnings.
- The gate tests that name canary keys are `check-effect-diagnostics.test.mjs`:
  - `canaryEntries` (`:640-645`) and `missingEverything` (`:701-706`);
  - the `canaryRows` "missing the last expected diagnostic" (`:731`), the `differenceRows` keys (`:761-764`), the real canary row (`:681`) and the plugin-removed real-compiler row (`:688-699`).
  - The plugin-removed row's lines come from the effect-tsgo defaults. After the promotion they change (the defaults keep `anyUnknownInErrorContext` at `warning`), and the exact new lines are read from the real compiler.
- `effect-diagnostics-recorded.json` (`clean`, `warnings`, `planted`, `canary`, `canaryWithoutPlugin`, …) holds recorded outputs for the parser rows. Its `canary` and `canaryWithoutPlugin` entries carry today's `warning anyUnknownInErrorContext` and are re-recorded from the real compiler. The `warnings` and `planted` entries test counting and blocking; they are not about this config and stay as recorded.
- `stryker.effect-gate.config.json` mutates `check-effect-diagnostics.mjs` whole, through `apps/harness/vitest.effect-gate-mutation.config.ts`.
- `pnpm typecheck` runs plain TypeScript 7 `tsc` with no language-service plugin, so the promotion does not touch it. The editor and agent LSP will show the four rules as errors; that is advisory (AGENTS.md "Type checking authority").

**The Stryker range audit (read-only, at `07c46e5`;** `p3-s6-range-audit-07c46e5.json`, main checkout; scratch script `range-audit.mjs`, not committed).

- Every `"file:a-b"` entry in the 10 root `stryker*.json` was read. Its writing commit was taken from `git blame` of its config line, and its text at that commit was compared with today's text at the same lines. When they differ, the audit looks for the old block, matched exactly, elsewhere in today's file.
- **81 line ranges in 6 configs** (4 configs have none):

| Config | Ranges | Aligned at the blamed commit | Shifted (block found once) | Changed or ambiguous |
|---|---|---|---|---|
| `stryker.config.json` | 23 | 14 | 6 | 3 |
| `stryker.desktop-s6.config.json` | 16 | 13 | 2 | 1 |
| `stryker.desktop-s7.config.json` | 7 | 7 | 0 | 0 |
| `stryker.desktop-s8.config.json` | 3 | 2 | 0 | 1 |
| `stryker.ledger.config.json` | 2 | 2 | 0 | 0 |
| `stryker.project-storage.config.json` | 30 | 24 | 4 | 2 |

- **Shifted** (text-identical block, one location):
  - `stryker.config.json`: `canonical-project-protocol.ts:156` → `149`; `active-project-coordinator.ts:513-539` → `522-548`, `705-708` → `718-721`, `715-724` → `728-737`; `project-registration-preparation.ts:294-307` → `292-305`, `367-383` → `365-381`;
  - `stryker.project-storage.config.json`: `registration-listing.ts:24-86` → `23-85`; `project-registration-observer.ts:96-112` → `97-113`, `146-161` → `147-162`; `registry-database.ts:79-90` → `126-137`.
- **Changed:**
  - `canonical-project-protocol.ts:252` and `:419`: both held `"WRITER_CLIENT_ABANDON_FAILED",`, and that literal no longer exists in the file. The ranges are dead: no realign is possible, so they are reported.
  - `project-registration-preparation.ts:225-279`: its first line (`const pendingCreation = …`) is now at `:230`, and the unit has changed. The diff map gives `230-277`. This is the file `p3-s7-preparation-health` refactors.
  - `harness-supervisor.ts:176-233` (`stryker.desktop-s8`) and `application-database-authority.ts:269-283` (`stryker.project-storage`): edited in place (s5c's one-line rewrites). The boundary lines are where they were, and the diff maps both to themselves.
  - `project-storage-upgrade-node-adapter.ts:558-564`: the first line (`function markerQueryFailure`) is now at `:560`, with the unit edited. The text gives `560-566`; the diff map gives `561-567`, the map's known off-by-one on pure insertions. The text wins.
- **The blamed commit is not always the writing commit.** 56 of the 81 ranges blame to squash commits:

| Squash | Ranges | Pre-squash source |
|---|---|---|
| `4cf6541` | 35 | named in the message (`refactor/123-effect-lifecycle-part-a`, `fdda65e..6561077`); its objects are reachable |
| `34b7477` | 9 | not named; no branch ref |
| `c8a72d1` | 8 | not named; no branch ref |
| `ff162f5` | 3 | not named; no branch ref |
| `67f59fc` | 1 | not named; no branch ref |

  - A squash is the state *after* review rounds that may have moved code without moving the range. A range can therefore be wrong at its squash. `stryker.desktop-s6` proves it: the four `main.ts` ranges were written at `34641bc` (the s6 review round 1, inside `4cf6541`'s source range). At `34641bc` they held exact units, and by the squash three of them had drifted.
- **`stryker.desktop-s6`'s `main.ts` ranges, re-derived from `34641bc`** (Q47 (a)):

| Range | Unit at `34641bc` | Where it is at `07c46e5` |
|---|---|---|
| `main.ts:96-106` | `let shutdownServices` to the `reportFailure` line of `createDesktopShutdown` | `main.ts:94-104`, text-identical. The squash-based audit says `98-108`; that is wrong, because the range had already drifted at the squash. |
| `main.ts:123-139` | the `WriterProofReportFailed` class (`:123-125`) and `writeWriterProofReport` (`:127-139`) | `writer-proof-report.ts:4-18` (the class `:4-6`, the function `:8-18`). `07c46e5` re-pointed it to `:8-18`, which leaves out the class line and its `"WriterProofReportFailed"` tag literal. |
| `main.ts:294-323` | the `workspaceClosing` constant and `registerWorkspaceIpc` | changed: `registerWorkspaceIpc` is now `main.ts:273-288`, and the constant was replaced by `workspaceQueryClosing` / `workspaceIntentClosing`, imported from the workspace bridge module (`main.ts:60-61`). |
| `main.ts:441-441` | `if (!desktopShutdown.accepting()) return;` (the quit-before-readiness guard) | `main.ts:406`, text-identical. At the squash the range held a blank line, so it has had 0 mutants since `4cf6541`. |

- **The dropped `main.ts:139` template mutant:** at `34641bc`, `123-139` ended at `writeWriterProofReport`'s closing brace. `reportUnconfirmedWriterProof` (`:141` there, `main.ts:120` today) was never in the range. The squash's +4 drift swept its first 3 lines in, and that is the `StringLiteral` mutant `07c46e5` dropped. Its only callers are the package-smoke paths (`main.ts:479`), and no unit row reaches it (Q53).

#### Split

Like s5b, s6 splits into two parts. Each has its own candidate, verifier and acceptance, and they share no source file:

- `p3-s6a-effect-rule-promotion` (P3-B34, P3-B35): the severities, the canary and the gate rows.
- `p3-s6b-stryker-range-alignment` (P3-B36 to P3-B38): the alignment check, the anchors and the realign of the 81 ranges.

Q49 asks whether to split. If (b), the two parts form one slice with all five behaviours.

#### Slice p3-s6a-effect-rule-promotion

- **Lane:** normal. `lane.mjs --paths` over the s6 paths answers `normal` ("files: 10 > 5"; "manifest: package.json", which is in s6b). s6a alone touches 5 files, `tsconfig.base.json` among them, which configures every package's checks.
- **Deliverable:**
  - `tsconfig.base.json:39-42`: the four rules move from `"warning"` to `"error"`.
  - The canary plants one line for each of the three rules it does not witness (Q50): a `Schema.Number`, a `yield* Effect.fail(<a yieldable error held in a const>)` inside `Effect.gen` (never `Effect.fail(new …)`, so the s5c structural check stays 0), and a `class … extends Error`.
  - `expectedCanary`, the gate test keys and the two recorded canary entries change accordingly. Each new key comes from the real compiler's output on the candidate, never typed in by hand.
- **Affected paths:** `tsconfig.base.json`, `apps/harness/scripts/effect-diagnostics-canary/src/canary.ts`, `apps/harness/scripts/check-effect-diagnostics.mjs` (`expectedCanary` only), `apps/harness/scripts/check-effect-diagnostics.test.mjs`, `apps/harness/scripts/effect-diagnostics-recorded.json` (the `canary` and `canaryWithoutPlugin` entries only).
- **Dependencies:** the s5 family (count 0 at `07c46e5`).

**Constraints:**

- The canary is never loosened. The expected set stays exact, with every line `extra` or `missing`, as `:219-233` does today (Verification Notes, "Risk, s6").
- No waiver is added. A hit that appears between `07c46e5` and the candidate stops the slice and goes to Pedro per line (Q8).
- The `message`-level rules are not touched (Q46 (a)), and no other rule's severity changes.
- The gate's success line keeps its wording ("Effect diagnostics verified; 0 advisory warnings.").

#### Test Contract: p3-s6a-effect-rule-promotion

- **Behavior P3-B34: the canary proves that each of the four promoted rules is active at `error`.**
  - Test: `apps/harness/scripts/check-effect-diagnostics.test.mjs`, through `checkEffectDiagnostics({ root: repository, projects: [], canary: true })`, the real canary row (`:681`), which already exists.
  - Oracle: `toMatchObject({ ok: true, canary: "matched" })`, against an `expectedCanary` that holds, besides today's two errors:
    - `src/canary.ts(4,14) error anyUnknownInErrorContext` and `src/canary.ts(4,24) error anyUnknownInErrorContext`;
    - one `error schemaNumber`, one `error unnecessaryFailYieldableError` and one `error extendsNativeError` line, at the planted positions.
  - The fake-run tables (`canaryEntries`, `missingEverything`, `canaryRows`, `differenceRows`) take the same keys, so every mismatch row still names its exact lines.
  - Expected red, observed at the base with the new canary and expected set but the old `tsconfig.base.json`: `EFFECT_GATE_CANARY_MISMATCH`. Its lines: `extra … warning <rule>` and `missing … error <rule>` for each of the five promoted lines. The implementer records the exact lines.
- **Behavior P3-B35: a canary without the plugin is still a mismatch, and it names the promoted lines.**
  - Test: `apps/harness/scripts/check-effect-diagnostics.test.mjs`, the plugin-removed real-compiler row (`:688`) and the fake "plugin removed" row (`canaryRows`, recorded `canaryWithoutPlugin`).
  - Oracle: `toEqual({ ok: false, code: "EFFECT_GATE_CANARY_MISMATCH", lines })`, where `lines` are exactly what the real compiler gives on the candidate. They are expected to keep today's two `extra … error newPromise` test-file lines and to add `missing … error <rule>` for each promoted line whose default severity is not `error`.
  - Expected red: the row's old `lines` fail on the candidate. The new `lines` are read from the real compiler, then pinned.

**Bindings that bite** (each shown failing on a named row, then reverted by digest, and listed in the TDD record):

1. For each of the four rules in turn, set it back to `"warning"` in `tsconfig.base.json`. The real canary row fails with exactly that rule's `extra … warning` / `missing … error` lines (4 runs).
2. Remove the planted `schemaNumber` line from `canary.ts`. The real canary row fails with `missing … error schemaNumber`.
3. With the candidate config, put one `Schema.Number` into a harness source file (for example `apps/harness/src/storage/local-libsql-worker-client.ts`, next to its `Schema.Finite`). `pnpm check:effect` exits 1, naming that file, line and `schemaNumber`. This needs the CPU rule.

**Structural checks (on the candidate):**

- `rg -n '"(anyUnknownInErrorContext|schemaNumber|unnecessaryFailYieldableError|extendsNativeError)": "error"' tsconfig.base.json` → 4 lines; `rg -n '": "warning"' tsconfig.base.json` → 0 lines.
- `rg -n -U "Effect\.fail\(\s*new " apps packages` → 0 lines (the s5c check, the canary included).
- `git diff 07c46e5 --stat` lists only the s6a affected paths and the brief.
- The `effect-tsgo` read at the candidate: 7 diagnostics, all `message`; 0 warnings; no `error` outside the canary.

#### Success Criteria: p3-s6a-effect-rule-promotion

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run scripts/check-effect-diagnostics.test.mjs`.
- `pnpm check:effect` exit 0 with "0 advisory warnings" (read CPU first, in its own call).
- `pnpm typecheck` exit 0; `pnpm check` exit 0.
- CodeScene 10 on `check-effect-diagnostics.mjs` and its test.
- Mutation: per Q51.

Manual: none.

#### Slice p3-s6b-stryker-range-alignment

- **Lane:** normal (by the same `lane.mjs` read: `package.json` is a manifest, and the configs and the new script are more than 5 files).
- **Deliverable:**
  1. **A check** (Q52), `apps/harness/scripts/check-stryker-ranges.mjs`, run as `pnpm check:mutation-ranges` inside `pnpm check`. Its scope:
     - It reads every root `stryker*.json` and a sidecar `stryker-range-anchors.json`, which holds, for each `"file:a-b"` entry, the config, the entry, and the exact text of line `a` and line `b` when the range was last aligned.
     - It needs no git and no history, and it never rewrites a config.
     - It fails, with one distinct code each (`degrade-distinguishes-broken`):
       - `STRYKER_RANGE_DRIFT`: line `a` or line `b` no longer holds its anchor text. When the anchored pair is found at exactly one other place, at the same distance in the same file, the line names that range; otherwise it names where each line was found.
       - `STRYKER_RANGE_UNANCHORED`: a range with no anchor.
       - `STRYKER_RANGE_STALE_ANCHOR`: an anchor with no range.
       - `STRYKER_RANGE_BROKEN`: an unreadable or invalid config or anchor file, a missing source file, `a > b`, a range past the end of the file, or a `mutate` entry with a line or column form the check does not parse.
     - An edit inside a range whose boundary lines stay put passes.
     - Its output names each config with its result, or `ok` with a per-config count.
  2. **The one-off realign** of the 81 ranges, with every range re-derived from its writing commit:
     - The writing commit is the commit that last wrote the range's config line. When that is a squash, it is the pre-squash commit inside the squash's named source range, found with `git log -S'<entry>' <source tip>`. When the source is not reachable (`34b7477`, `c8a72d1`, `ff162f5`, `67f59fc`), the range is read against the squash and recorded as "writing commit unreachable, read at the squash", never as aligned.
     - Each range ends in one of these states, per config:
       - kept (text-identical);
       - realigned (the block found once, re-pointed, word-diffed);
       - followed (the unit moved to another file, re-pointed there, as for `writer-proof-report.ts`);
       - reported, not realigned: a dead or changed unit, ambiguous text, or an unreachable writing commit. These go to Pedro as they stand. None is deleted or re-pointed by judgment without his decision, except where a question below decides it.
     - Every changed range has instrumenter mutant counts before and after (the `range-mutants.mjs` method of s5b-bridge).
  3. **The anchors file** is written from the realigned configs and committed with them. From then on, a range realign is a deliberate edit of the config and its anchors together.
- **Affected paths:** `apps/harness/scripts/check-stryker-ranges.mjs` (new), `apps/harness/scripts/check-stryker-ranges.test.mjs` (new), `stryker-range-anchors.json` (new), `package.json` (`check:mutation-ranges` and its place in `check`), and the configs with realigned or followed ranges: `stryker.config.json`, `stryker.desktop-s6.config.json`, `stryker.desktop-s8.config.json`, `stryker.project-storage.config.json`. Each config's mutation Vitest config changes only if a followed range needs a new test file (as `07c46e5` did).
- **Dependencies:** none on s6a. `p3-s7-preparation-health` follows s6b, because s7 edits `project-registration-preparation.ts`, which holds 3 `stryker.config.json` ranges; from then on, s7 moves their anchors with the code.

**Constraints:**

- The check is pure and fast; it is the first `pnpm check` step that reads Stryker configs.
- It treats whole-file entries and globs as out of scope and lists them in a separate count. It never skips an entry silently.
- The realign removes or re-points no range on judgment, except as decided below. Dead ranges (`canonical-project-protocol.ts:252`, `:419`) and changed units (`main.ts:294-323`, `project-registration-preparation.ts:225-279`) are reported.

#### Test Contract: p3-s6b-stryker-range-alignment

- **Behavior P3-B36: a config whose ranges match their anchors passes.**
  - Test: `apps/harness/scripts/check-stryker-ranges.test.mjs`, through the exported `checkStrykerRanges({ root })` on temporary roots holding small configs, anchors and source files.
  - Rows:
    - two configs, three anchored ranges, all matching → `toEqual({ ok: true, configs: [{ config, ranges: n, wholeFiles: m }, …] })`;
    - the same tree with a line inserted *inside* one range, boundaries unchanged → the same `ok` result.
  - Expected red: the module does not exist (import failure). That red is recorded, then the first green.
- **Behavior P3-B37: every drift and every broken input fails with its own code and exact lines.**
  - Test: `apps/harness/scripts/check-stryker-ranges.test.mjs`, through `checkStrykerRanges({ root })` on temporary roots, as P3-B36.
  - Rows, each `toEqual({ ok: false, code, lines })`:
    - a line inserted above a range → `STRYKER_RANGE_DRIFT`, naming the config, the entry and the single re-pointed range;
    - a boundary line whose text changed → `STRYKER_RANGE_DRIFT`, with no suggestion;
    - the anchored pair found twice → `STRYKER_RANGE_DRIFT`, naming both places;
    - a new range with no anchor → `STRYKER_RANGE_UNANCHORED`;
    - an anchor whose range was removed → `STRYKER_RANGE_STALE_ANCHOR`;
    - a missing source file, a range past the end of the file, `a > b`, invalid JSON in a config, invalid JSON in the anchors, and a `file:1:2-3:4` entry → each `STRYKER_RANGE_BROKEN`, with a line that names the cause.
  - Expected red: as P3-B36. The rows are written before the module.
- **Behavior P3-B38: the repository's own configs pass, and `pnpm check` runs the check.**
  - Test: `apps/harness/scripts/check-stryker-ranges.test.mjs`, a real-repository row through `checkStrykerRanges({ root: repository })` → `ok: true`, with a per-config count that totals 81 ranges (or the count after the reported ranges Pedro decides), plus the whole-file count.
  - Expected red, observed: before the anchors file exists, the real row fails with `STRYKER_RANGE_UNANCHORED` for every range. After the realign, the anchors are written from the realigned configs, and the row passes. The row therefore proves that the anchors match the configs, not that the ranges hold their intended code; that proof is the realign table. The TDD record says so.
  - `package.json`: `check` contains `pnpm check:mutation-ranges`. Structural check below.

**Bindings that bite:**

1. Make the boundary comparison ignore line `b`. P3-B37's "boundary line whose text changed" row fails when it changes only `b`. (The row table takes both an `a` case and a `b` case.)
2. Make an unreadable source file return `ok`. The missing-file row fails.
3. Drop the "found twice" branch, so the first location wins. The "found twice" row fails.
4. Skip entries with column forms instead of failing. The `file:1:2-3:4` row fails.

**Structural checks (on the candidate):**

- `node -e` over `package.json`: `scripts.check` includes `pnpm check:mutation-ranges`.
- `pnpm check:mutation-ranges` exit 0 on the candidate, and exit 1 with `STRYKER_RANGE_DRIFT` after a one-line insertion above any range (then reverted).
- The realign table in the TDD record has one row per range: config, entry before → after, state, writing commit (and the squash it came through), mutants before → after.

#### Success Criteria: p3-s6b-stryker-range-alignment

Automated (smallest first; each read by its real exit code):

- Red-green: `pnpm --filter @slopstop/harness exec vitest run scripts/check-stryker-ranges.test.mjs`.
- `pnpm check:mutation-ranges` exit 0. `pnpm check` exit 0 (read CPU first, in its own call).
- A Stryker dry run of each config whose ranges changed (`stryker.config.json`, `stryker.desktop-s6.config.json`, `stryker.desktop-s8.config.json`, `stryker.project-storage.config.json`). Each one is a heavy run: the coordinator's GO, one at a time, under the CPU rule.
- CodeScene 10 on the new script and its test.
- Mutation: per Q51.

Manual: none.

#### For the final acceptance (not s6)

- **V2 from s5c:** `check:deep` before the push must run `canonical-command-repository-faults.integration.test.ts` and every integration file that imports `conformance-counter-command.ts`, as listed in the s5c TDD record (`2026-10-27_p3-s5c-schema-number-yieldable-tdd.md:238-240`). It belongs to the Phase 3 final acceptance, not to s6.

#### Open questions (p3-s6-effect-rule-promotion)

- **Q49: split s6.**
  - (a) **Recommended.** Split into `p3-s6a-effect-rule-promotion` and `p3-s6b-stryker-range-alignment`. They share no file. The promotion is small and closes the Effect work, while the range work is a new gate plus an 81-range audit. A slip in one should not hold the other.
  - (b) One slice with P3-B34 to P3-B38.
- **Q50: canary witnesses for the three unwitnessed rules.**
  - (a) **Recommended.** Plant one line for each in `canary.ts`, so that every promoted rule has a canary key. Otherwise a severity reverted to `warning` for three of the four rules passes the gate unseen.
  - (b) No new lines. The canary keeps witnessing `anyUnknownInErrorContext` only.
- **Q51: mutation.**
  - (a) **Recommended.** No run for s6a: its gate change is the `expectedCanary` data, which the canary rows pin exactly. For s6b, one run of a new `stryker.stryker-ranges.config.json` over `check-stryker-ranges.mjs`, on the final candidate, alone, with the coordinator's GO and the CPU rule. Every survivor and every mutant without coverage goes to Pedro as it stands. A new gate's typical failure is a silent pass, which mutation is built to find.
  - (b) No mutation in either part.
  - (c) Also a run of `stryker.effect-gate.config.json` for s6a.
- **Q52: how the automatic check knows a range is aligned.**
  - (a) **Recommended.** Boundary anchors in a sidecar file, checked with no git (P3-B36 to P3-B38). It is fast, works on any clone, and catches every shift and every moved unit, while edits inside a unit pass.
  - (b) Re-derive from the writing commit at every run (`git blame` → that commit's text → match). This is the audit's method, but as a gate it needs full history and it reads squashes wrongly: 56 of the 81 ranges blame to a squash, and `stryker.desktop-s6` shows ranges already drifted at their squash.
  - (c) Keep the anchors inside each `stryker*.json` (an extra key per entry) instead of a sidecar. One file to edit, but Stryker's config schema does not know the key, and every config changes shape.
- **Q53: the `main.ts` items carried from Q47 and `07c46e5`.**
  - (a) **Recommended.** Each goes back to its `34641bc` intent:
    - `main.ts:96-106` → `94-104`;
    - `441-441` → `406-406`;
    - `writer-proof-report.ts:8-18` → `4-18`, taking the class line back in;
    - `294-323` is reported as changed, with `registerWorkspaceIpc` at `273-288` offered as its realign, and Pedro decides that one;
    - the `reportUnconfirmedWriterProof` template mutant is not re-added, because it was never in the intended range.
  - (b) Keep `07c46e5`'s `8-18` and add a range for `reportUnconfirmedWriterProof` (`main.ts:120-127`), so the dropped mutant returns. Package smoke is its only reach, so it would show as no-coverage in the unit-run configs.
- **Q54: the dead and changed ranges.**
  - (a) **Recommended.** Report them in s6b with their measured state, and take Pedro's per-range decision before the anchors are written. The cases: `canonical-project-protocol.ts:252` and `:419` are dead, `project-registration-preparation.ts:225-279` is changed (diff map `230-277`), and `main.ts:294-323` is changed. A range removed or re-pointed without his decision would hide lost mutation coverage.
  - (b) Remove the two dead ranges and re-point the changed ones by the diff map in s6b, and record it.

### 2026-10-27: p3-s6 approved and split, Q49-Q54 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s6-effect-rule-promotion` at `content_hash 1432f57c1acbc343c570bcd49ea5e790dec28dc4a6b2aca2e2f357083bf800aa`; approved copy `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/approved-1432f57c.md` (main checkout). Both contracts (P3-B34 to P3-B38), the measured tables, the bindings and the structural checks stand as written. Lane normal for both parts.
- **Q49 (a):** s6 splits into `p3-s6a-effect-rule-promotion` (P3-B34, P3-B35) and `p3-s6b-stryker-range-alignment` (P3-B36 to P3-B38). **Order:** s6a goes first. s6b starts after s6a closes, and `p3-s7-preparation-health` follows s6b.
- **Q50 (a):** the canary plants one line for each of `schemaNumber`, `unnecessaryFailYieldableError` and `extendsNativeError`. Every promoted rule has a canary key, taken from the real compiler's output, never typed in by hand.
- **Q51 (a):**
  - s6a has no mutation run.
  - s6b has one scoped run of a new `stryker.stryker-ranges.config.json` over `check-stryker-ranges.mjs`, on the final candidate. It runs alone, under the CPU rule, with the coordinator's GO. Every survivor and every mutant without coverage goes to Pedro as it stands, and none is waived or killed by editing tests without his decision.
- **Q52 (a):** the automatic check uses boundary anchors in the sidecar `stryker-range-anchors.json`, with no git at check time, and runs inside `pnpm check` as `pnpm check:mutation-ranges`. A realign from then on edits the config and its anchors together.
- **Q53 (a):** the `stryker.desktop-s6.config.json` `main.ts` items go back to their `34641bc` intent:
  - `main.ts:96-106` → `94-104`, and `441-441` → `406-406`;
  - `writer-proof-report.ts:8-18` → `4-18`, taking the class line back in;
  - `main.ts:294-323` is reported as changed, with `registerWorkspaceIpc` at `273-288` offered as its realign; Pedro decides it under Q54;
  - the `reportUnconfirmedWriterProof` template mutant is not re-added.
- **Q54 (a):** s6b reports the dead and changed ranges with their measured state (`canonical-project-protocol.ts:252` and `:419` dead; `project-registration-preparation.ts:225-279` and `main.ts:294-323` changed). Pedro decides each one before the anchors are written; none is removed or re-pointed without his decision.
- **Final acceptance, carried:** the s5c V2 condition (`check:deep` runs the faults file and every `conformance-counter-command.ts` importer) belongs to the Phase 3 final acceptance.

### 2026-10-27: slice p3-s7-preparation-health detailed

Read at `fix/arch-review-phase-3` `6c18b2b` (s6b closed). Docs only; no test, gate or mutation run for this detailing. Closes R6 and #129.

**Measured at `6c18b2b`:**

- CodeScene `code_health_score` of `apps/harness/src/registration/project-registration-preparation.ts` (382 lines): **8.03**. The review lists four findings:
  - Complex Method: `confirm` (`:190-222`, cc 9) and `inspectConfirmation` (`:122-173`, cc 9);
  - Complex Conditional: `inspectConfirmation:137-141` (saved proposal match) and `confirm:208` (bootstrap decision);
  - Code Duplication: the `trackedListing` (`:292-305`) and `trackedBootstrap` (`:306-319`) wrappers;
  - Overall Code Complexity (the mean).
- Only `project-registration-owner.ts:4,18` imports the file in source. The exported `createProjectRegistrationPreparation(registry, options, controlDirectory, child?, bootstrap?, listing?)` and its returned `{ listProjects, confirm, prepare, validateConfirmation, close }` are the public seam.
- `stryker.config.json` holds three ranges in the file, each anchored in `stryker-range-anchors.json:34,46,52`:

| Entry | Unit | Instrumenter mutants (s6b record) |
|---|---|---|
| `:230-277` | `pendingCreation` to the end of `drainPreparations` | 38 |
| `:292-305` | `trackedListing` | 11 |
| `:365-381` | `close` | 22 |

- The only pinned counts in the repository are range and whole-file counts per config, in the real-repository row of `apps/harness/scripts/check-stryker-ranges.test.mjs:446-455` (`stryker.config.json`: 19 ranges, 33 whole files). No test pins mutant counts; those live in the s6b TDD record (`2026-10-27_p3-s6b-stryker-range-alignment-tdd.md:83,134-135,264-266`).
- `stryker.config.json` runs the root `vitest.config.ts` unit projects. The integration tests are not in its run. So the three ranges are reached only by the 8 unit cases of `project-registration-preparation.test.ts` (CNV-B37, listing and close), and every other line of the file is reached only by Windows integration tests.
- Reaching for the branches the refactor moves (static read of the registration integration project, `apps/harness/vitest.registration.config.ts`, 26 files):

| Branch | Row that reaches it | State |
|---|---|---|
| saved proposal match, `proposalId` and `proposalFingerprint` legs (`:139-140`) | `registration-preparation.integration.test.ts:346`, "refuses confirmation with mismatched %s before any new observation" (each of the two fields) | found |
| saved proposal missing (`:138`) | none found | gap |
| executable identity changed after a fresh observation (`:147-154`) | none found. Row `:126` answers `GIT_CONFIRMATION_REQUIRED` with `dispatches()` still 6, so its answer comes before Git, not from this comparison | gap |
| physical identity changed (`:155-163`) | `registration-preparation.integration.test.ts:299`, "refuses confirmation when fresh Git administration differs from the saved proposal" | found |
| bootstrap runs (`:208`, created, bootstrap present, not aborted) | `registration-bootstrap-guards.integration.test.ts:304` (each) and `:360` | found |
| no bootstrap (`:216-217`, `incomplete(request)`) | `registration-preparation.integration.test.ts:189` | found |
| bootstrap skipped because aborted (`:208`, `signal.aborted` leg) | none found | gap |
| listing tracking (`:292-305`) | the 8 unit cases of `project-registration-preparation.test.ts` | found |
| bootstrap tracking (`:306-319`) | `registration-bootstrap-guards.integration.test.ts:304` (each) | found |

- Lane: `lane.mjs --paths` over the source file, `stryker.config.json`, `stryker-range-anchors.json` and `check-stryker-ranges.test.mjs` answers `fast` ("within fast limits"; slices, lines and hub signal unknown). The feature lane is `normal`, and a slice never runs below its feature lane. The Deferred Work table's `fast` for this slice was written before that rule was applied here; **this slice's lane is normal.**

#### Slice p3-s7-preparation-health

- **Lane:** normal.
- **Deliverable:**
  1. **A behaviour-preserving refactor** of `project-registration-preparation.ts` to CodeScene 10. It is still Promise code (Q7 (a): `#123` Part B rewrites it as Effect). By responsibility:
     - the saved-proposal match (`:137-141`) becomes one named predicate;
     - the two identity comparisons after a fresh observation (`:147-163`) become one function that answers the refusal (`GIT_CONFIRMATION_REQUIRED` or `REPOSITORY_IDENTITY_CHANGED`) or nothing, with the executable check first, as today;
     - the bootstrap decision in `confirm` (`:208-215`) becomes its own step;
     - the `write` helper that `prepare` and `confirm` each define becomes one module-level helper;
     - the two tracked wrappers become one tracker that counts the running work and records the unconfirmed answer when the work's own failure test says so. Listing passes `listingCleanupFailed` and `pendingListing`; bootstrap passes "status is broken" and `pendingCreation`.

     Each moved condition keeps its expression and its order. No answer, code or order of side effects changes.
  2. **The re-anchoring** (V4, s6b verifier). Each of the file's `stryker.config.json` ranges is re-pointed to the code that holds the same logic after the refactor (Q55), and its anchor in `stryker-range-anchors.json` is rewritten from the new boundary lines, in the same change.
  3. **The recount** (V4). Instrumenter mutant counts before and after for every one of the file's ranges, with a written mapping, and the real-repository row's counts, which change only if the number of ranges changes (Q58).
- **Affected paths:**
  - `apps/harness/src/registration/project-registration-preparation.ts`;
  - `stryker.config.json` and `stryker-range-anchors.json` (V4);
  - `apps/harness/scripts/check-stryker-ranges.test.mjs`, only its real-repository row and only if the range count of `stryker.config.json` changes (Q58);
  - `apps/harness/tests/integration/registration-preparation.integration.test.ts`, only for the characterization row of Q57;
  - the s7 TDD record.

  No other test changes. `project-registration-owner.ts` does not change.
- **Dependencies:** s6b closed (`6c18b2b`). It is the last Phase 3 slice. The Phase 3 final acceptance follows it, carrying the s5c V2 condition.

**Constraints:**

- The exported signature, the returned object and every answer stay as they are. The existing unit and integration rows run unedited.
- The refactor adds no Effect code and removes none. `drainPreparations` keeps its `Effect.runPromise` facade as it is: Part B owns it.
- The configs and anchors change in the same commit as the refactor's final shape, never before.
- A range is never widened to the whole file, and never re-pointed only by the check's "moved to" suggestion. A suggestion follows the boundary lines, not the logic inside them.

#### Test Contract: p3-s7-preparation-health

- **Behavior P3-B39: the refactor changes no answer of the preparation owner.**
  - Test: `apps/harness/src/registration/project-registration-preparation.test.ts`, through `createProjectRegistrationPreparation(...)` with a fake listing (the 8 CNV-B37 cases, unedited), and the registration integration project `apps/harness/vitest.registration.config.ts` (26 files, unedited except the Q57 row), through the same function and `createProjectRegistrationOwner`.
  - Oracle: the same exact `toEqual` answers as at `6c18b2b`. `git diff 6c18b2b --stat -- '*.test.ts'` lists no file except the Q57 row's.
  - Expected red: none in behaviour; this is a refactor. The structural red is the CodeScene read: 8.03 at `6c18b2b`, recorded before the first edit.
  - Q57 row (characterization, written and run green **before** the refactor): `validateConfirmation` for a well-formed request whose preparation was never saved → `toEqual({ status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" })`, with no Git dispatch (`dispatches()` unchanged). It passes at the base because it pins today's answer; its bite is binding 2.
- **Behavior P3-B40: the file's ranges are re-anchored to the logic they held.**
  - Test: `apps/harness/scripts/check-stryker-ranges.test.mjs`, through `checkStrykerRanges({ root: repository })` (the real-repository row), and `pnpm check:mutation-ranges` read by its exit code.
  - Expected red, observed: with the refactor in place and the configs not yet edited, `pnpm check:mutation-ranges` exits 1 with `STRYKER_RANGE_DRIFT`, and its lines name only `stryker.config.json` entries of `project-registration-preparation.ts`. The implementer writes the predicted lines (one per moved entry, "moved to …" or "drifted; first line found …") into the TDD record from the real diff, before running it. Any line for another file or config is a stop.
  - Green: the configs and anchors are edited together. `pnpm check:mutation-ranges` exits 0, and the real row passes.
  - Re-point table in the TDD record: entry before → after; the unit before → after by name; first and last line text before → after.
- **Behavior P3-B41: the recount accounts for every mutant.**
  - Test: `apps/harness/scripts/check-stryker-ranges.test.mjs`, through `checkStrykerRanges({ root: repository })` for the range count (Q58), and the instrumenter method of s5b-bridge (`range-mutants.mjs`) on `stryker.config.json` for this file, before (`6c18b2b`: 38, 11, 22) and on the candidate.
  - Prediction first: the expected count per new range, and the mapping, are written in the TDD record before the count is read. The mapping takes each base mutant by mutator and source text to a mutant in a new range, or lists it as removed with the reason (for example, the second tracked wrapper's duplicate body). Every gained mutant is listed with its line.
  - Expected red, by Q58:
    - if the range count of `stryker.config.json` changes, the real row's expected count is edited first. The row fails with the old count, observed, and then passes after the config edit;
    - if it does not change, the row is not edited, and the TDD record says so.
  - No range ends with 0 mutants. A mutant lost without a listed reason is a stop.

**Bindings that bite (each restored after):**

1. In the shared tracker, give the listing the bootstrap's failure test ("status is broken"). The unit case "closes after a broken REGISTRY_CORRUPT listing whose cleanup completed (CNV-B37)" fails: close answers `{ status: "broken", code: "INTERNAL_FAILURE" }`.
2. In the saved-proposal predicate, drop the `saved === undefined` leg (treat a missing proposal as matching). The Q57 row fails.
3. In the same predicate, drop the fingerprint comparison. `registration-preparation.integration.test.ts:346` `[proposalFingerprint]` fails.
4. In the identity function, skip the physical comparison. `registration-preparation.integration.test.ts:299` fails.
5. Re-point one range in `stryker.config.json` and leave its old anchor. `pnpm check:mutation-ranges` exits 1 with `STRYKER_RANGE_UNANCHORED`.
6. Keep the old anchor text for a re-pointed range. `pnpm check:mutation-ranges` exits 1 with `STRYKER_RANGE_DRIFT` for that entry.

Bindings 2 to 4 run the integration files they name, which is part of the Q56 integration run. They need the CPU rule and the coordinator's GO.

**Measured gaps, recorded and not closed here:** the executable-identity refusal after a fresh observation (`:147-154`) and the aborted leg of the bootstrap decision (`:208`) have no reaching row. The refactor moves their expressions unchanged. A row for the first one needs a second Git executable in the fixture. Both go to the Phase 3 final acceptance as named gaps.

**Structural checks (on the candidate):**

- CodeScene `code_health_score` = 10.0 for `project-registration-preparation.ts`, and `code_health_review` lists no finding.
- `git diff 6c18b2b --stat` lists only the affected paths above and the brief and record.
- `rg -n "createProjectRegistrationPreparation" apps/harness/src/registration/project-registration-owner.ts` gives the same line as at `6c18b2b` (`:4,18`).
- `rg -n "Effect\." apps/harness/src/registration/project-registration-preparation.ts` gives the same uses as at `6c18b2b`, inside `drainPreparations`.

#### Success Criteria: p3-s7-preparation-health

Automated (smallest first; each read by its real exit code):

- `pnpm --filter @slopstop/harness exec vitest run src/registration/project-registration-preparation.test.ts` (8 cases) before and after.
- `pnpm check:mutation-ranges`: exit 1 (the P3-B40 red), then exit 0.
- `pnpm --filter @slopstop/harness exec vitest run scripts/check-stryker-ranges.test.mjs`.
- The registration integration project on the candidate, per Q56.
- `pnpm typecheck` and `pnpm check` exit 0 (read CPU first, in its own call).
- CodeScene 10 on the file. CodeScene 10 also on `check-stryker-ranges.test.mjs` if it changes.
- Mutation: per Q56.

Manual: none.

#### Open questions (p3-s7-preparation-health)

- **Q55: where the ranges go after the refactor.**
  - (a) **Recommended.** Keep three-range intent: each range follows its logic.
    - `230-277` moves with the same unit, `pendingCreation` to the end of `drainPreparations`.
    - `close` keeps its own range.
    - The listing range covers the shared tracker and the listing's call into it. They are one range if they are contiguous, two if not. The bootstrap's own failure test stays out of range, as today.

    The unit cases reach all of it through the listing, so the shared tracker's mutants are killed the way the listing wrapper's are today.
  - (b) The whole file. It adds `prepare`, `inspectConfirmation` and `confirm` mutants that no unit test reaches, since `stryker.config.json` does not run integration tests. They would show as no-coverage mutants.
  - (c) Accept the check's "moved to" suggestions as they come. That is fast, but a suggestion follows the boundary lines only: a range whose inside the refactor emptied would pass.
- **Q56: proof that the refactor kept the mutants killed, and the integration run.**
  - (a) **Recommended.** Two scoped mutation runs of `stryker.config.json` with `--mutate` limited to this file's entries: one at `6c18b2b` (the base ranges) and one on the final candidate (the new ranges). Each runs alone, under the CPU rule, with the coordinator's GO. Survivors are compared by mutator and source text. A new survivor goes to Pedro as it stands; none is killed by editing tests without his decision.

    Plus one run of the registration integration project (`vitest.registration.config.ts`, 26 files, Windows) on the candidate, on an idle machine, with the GO, as #129 asks.
  - (b) Only the run on the candidate. Every survivor goes to Pedro, but there is no base to tell old survivors from new ones.
  - (c) No mutation run: instrumenter counts only, and the integration run at `check:deep`.
- **Q57: the saved-proposal-missing branch has no reaching row.**
  - (a) **Recommended.** Add one characterization row (P3-B39) to `registration-preparation.integration.test.ts` before the refactor: `validateConfirmation` for a preparation never saved → `REGISTRATION_IDEMPOTENCY_CONFLICT`, no Git dispatch. It is cheap with the file's own fixture, and binding 2 needs it. The executable-identity and aborted-bootstrap gaps stay recorded (above).
  - (b) No new row. All three gaps are recorded, and binding 2 is dropped.
- **Q58: the pinned counts.**
  - (a) **Recommended.** The only pin stays the real-repository row's range and whole-file counts. If `stryker.config.json`'s range count changes (for example 19 → 20 when the listing range splits in two), that row is edited first and its red observed. Mutant counts stay in the TDD record with the prediction-first mapping (P3-B41).
  - (b) Add a test that pins the instrumenter's mutant count per range. It would catch a silent loss on every later edit, but it puts the Stryker instrumenter into the unit run and is a new tool, outside R6.
- **Q59: closing #129.**
  - (a) **Recommended.** The s7 commit says `refs #129`. Closing the issue is a GitHub write: it happens after the Phase 3 integration, with Pedro's OK.
  - (b) The commit says `closes #129`, so the issue closes when the commit reaches `main`.

### 2026-10-27: p3-s7-preparation-health approved, Q55-Q59 decided (Pedro, confirmed by the coordinator)

- **Approved:** `p3-s7-preparation-health` at `content_hash 20b72a18c7865c95572600fdc3178f536293281b964176b4bfbffc4dab59ee97`. The contract (P3-B39 to P3-B41), the measured tables, the six bindings, the recorded gaps and the structural checks stand as written. Lane normal.
- **Q55 (a):** each range follows its logic. `230-277` moves with its unit, `pendingCreation` to the end of `drainPreparations`. `close` keeps its own range. The listing range covers the shared tracker and the listing's call into it, as one entry or two. It is never the whole file, and it is never re-pointed by a "moved to" suggestion alone.
- **Q56 (a):** two scoped mutation runs of `stryker.config.json`, with `--mutate` limited to this file's entries: one at `6c18b2b` and one on the final candidate. There is also one run of the registration integration project (`vitest.registration.config.ts`) on the candidate. Each run goes alone, under the CPU rule, with the coordinator's GO. Every new survivor goes to Pedro as it stands, and none is killed by editing tests without his decision.
- **Q57 (a):** the characterization row is added to `registration-preparation.integration.test.ts` before the refactor. It covers `validateConfirmation` for a preparation never saved: the answer is `REGISTRATION_IDEMPOTENCY_CONFLICT`, with no Git dispatch.
- **Q58 (a):** no new pin for mutant counts. The real-repository row's range and whole-file counts stay the only pin. That row is edited red-first only if the range count of `stryker.config.json` changes.
- **Q59 (a):** this follows Pedro's standing rule. The s7 commit says `refs #129`. Closing the issue is a GitHub write: it happens after the Phase 3 integration, with Pedro's OK.

## TDD Evidence (implement)

- `p3-s1-busy-classifier`: `.rpiv/artifacts/evidence/2026-10-25_p3-s1-busy-classifier-tdd.md`. Accepted amendment (coordinator, Pedro's maximum-quality ask): direct test rows for `storageFailureFor` and `normalizeStorageError`, test-only, because the conversation mutation run now mutates the whole `project-storage-node-errors.ts`.
- `p3-s2-registry-decode`: `.rpiv/artifacts/evidence/2026-10-25_p3-s2-registry-decode-tdd.md`. Accepted amendment (coordinator): a missing reservation row is refused by the one-element `reservationKeyRowsSchema` tuple, at the base and now, not by a `TypeError` in the catch-all; the explicit guard was unreachable and is not in the code, and the third binding is the one on that tuple.
- `p3-s2-registry-decode`, user-decided amendment (Pedro, 2026-10-25, D1 ledger; confirmed by the coordinator): `listProjects` answers `REGISTRY_CORRUPT` for hidden-row damage and `REGISTRY_BUSY` for a busy hidden-row read (before: `INTERNAL_FAILURE`, at the listing's `Effect.runPromise` facade). Proven by the raise-only P3-B4 row j and a busy listing row; commit `ab6def2`.
- `p3-s3-ledger-refusals`: `.rpiv/artifacts/evidence/2026-10-25_p3-s3-ledger-refusals-tdd.md`. Coordinator amendments, the brief table unedited: prediction corrections M1 (`expectForbiddenUnchangedChild("events")` is a decode) and M2 (r11 is reached by the two `G9 conflict requested` command rows), the extra reaching rows (r2, r3, r5, r14), binding 6 replaced by the outcome-before-r14 variant, and the P3-B10b plant as stored damage.
- `p3-s7-preparation-health`: `.rpiv/artifacts/evidence/2026-10-27_p3-s7-preparation-health-tdd.md`. Approved changes after the slice's first green, each recorded there with its prediction and runs:
  - **Pedro's decision (relayed by the coordinator): kill the 26** base survivors and no-coverage mutants of the file's ranges inside s7, as in s6b. Seven unit rows in `apps/harness/src/registration/project-registration-preparation.test.ts`, through `createProjectRegistrationPreparation`, with exact oracles.
  - **The coordinator's 7 accepted equivalents**, each argued in the record: 292 the left operand `true`, the whole `false`, `status !==` and `""`; 293 `""`; 308 `{}` and `""` (the `concurrency` option).
  - **The coordinator's dead-statement deletion** (the fix over a residual, disclosed to Pedro): close's `if (result.status === "pending-recovery") unconfirmed ??= result;` is removed, because the next line already answers `unconfirmed ?? result`. It is behaviour-preserving: the 15 unit rows pass unedited, and the `close` range is re-pointed `400-416` → `400-415`.
  - **The (c) integration row**, from Pedro's option (b) ("a survivor gets an integration row"), with the coordinator's OK on the row: "answers cleanup unconfirmed when close outlasts a held operation after a completed creation" in `registration-bootstrap-guards.integration.test.ts`. It kills 347 `finally` `{}` and 348 `+=`, which no unit row can reach. 405 and both 407 mutants are proven killed by existing integration rows, each planted by hand.
  - **Pedro's approved witness-row exception**: the existing row "Storage creation honors %s reservation authority without bypassing witnesses" in the same file is refactored, test-only, to CodeScene 10. Its cases, their order and its seven expectations are unchanged (the before → after table is in the record).
  - **The verifier's V2** (coordinator decision): the listing range takes in the `listings` counter object, `335-352` → `333-352`, and its new ObjectLiteral mutant is killed by "stays broken after a listing whose own cleanup failed (CNV-B37)".
  - These approved changes **supersede the literal P3-B39 oracle** "`git diff 6c18b2b --stat -- '*.test.ts'` lists no file except the Q57 row's" and the structural check "`git diff 6c18b2b --stat` lists only the affected paths above and the brief and record". The slice's test diff also holds `project-registration-preparation.test.ts` and `registration-bootstrap-guards.integration.test.ts`, as approved above.
  - Outcome: CodeScene 10 on the source and both touched test files. The final scoped mutation of the three ranges (on `3b7c84d`) found 67 mutants, 55 killed and 12 survived (the 7 accepted equivalents and the 5 that only integration reaches), 0 no coverage, score 82.09, exit 0; the V2 range run is recorded with it.
- `p3-s8-trace-94-oracle`: `.rpiv/artifacts/evidence/2026-10-30_p3-s8-trace-94-oracle-tdd.md`. A test-only mini-slice that Pedro chose (relayed by the coordinator) after acceptance run 3 (`p3-acceptance-check-deep-3.log`) failed in `pnpm test:coverage`. In `apps/harness/tests/integration/trace-94.test.ts`, 6 of 14 tests failed, because `5345b07` added `errorEqualitySetup` as the first setup file in the three integration configs. No Vitest config changes and nothing in `5345b07` changes. The "#94 trace wiring in the integration configs" oracle becomes exact: off is `[…error-equality.ts]` with no `runner`; on is `[…error-equality.ts, …trace-94-setup.ts]` in that order, with `runner` `…trace-94-runner.ts`. The row names say "trace setup file".
  - Results: red 6 failed / 8 passed, as in run 3. Green 14/14.
  - Bindings, each restored by digest: (a) dropping error equality from the integration config fails off and on for that config; (b) tracing always on fails the three off rows; (c) the trace setup put first in the registration config fails that config's on row.
  - Gates: CodeScene 10, knip and jscpd exit 0, `pnpm check` exit 0 (3816 tests).

### Phase 3 acceptance

Logs are in the evidence folder `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/` of the main checkout. Every run was `pnpm check:deep` alone in `slopstop-p3`, with no rerun to chase green, no raised timeout and no weakened gate.

- **Run 1** (`p3-acceptance-check-deep.log`, at `f99b325`): Pedro stopped it. Only `pnpm check` finished (118 files, 3816 tests passed) and there is no exit line. It counts as neither a pass nor a failure.
- **Run 2** (`p3-acceptance-check-deep-2.log`, at `f99b325`): classified **BROKEN** (environment). About 80 s in, after format, lint, typecheck and `check:effect` passed, the next step could not start: `exit code 3221225794` (0xC0000142, STATUS_DLL_INIT_FAILED). No tests ran. It came after a low-memory reap the same day.
- **Run 3** (`p3-acceptance-check-deep-3.log`, at `f99b325`): **failed**, exit 1. `pnpm check` passed (3816 tests). `pnpm test:coverage` failed with 6 failed / 6039 passed / 6 skipped, all in `apps/harness/tests/integration/trace-94.test.ts`. This was a regression from `5345b07`, which made `error-equality.ts` the first setup file in the three integration configs while the #94 wiring oracle still expected the old values. It was fixed test-only by `p3-s8-trace-94-oracle` (`4b8e7b0`, brief entry `c5dde0e`).
- **Run 4** (`p3-acceptance-check-deep-4.log`, at `c5dde0e`, clean; CPU 4.5%, 13.53 GB free, no League/TFT): **passed**, exit 0, 17:45:24Z to 18:05:34Z (20m10s).

  | Step | Result |
  |---|---|
  | `pnpm check` | format, lint, typecheck, `check:effect` 0 advisory warnings, Stryker ranges verified; Vitest 118 files, 3816 passed; depcruise 583 modules, 0 violations |
  | `test:coverage` | 201 files (198 passed, 3 skipped); 6051 tests (6045 passed, 6 skipped); statements 94.39, branches 89.85, functions 96.29, lines 95.83 |
  | `test:integration` | 83 files (80 passed, 3 skipped); 2235 tests (2229 passed, 6 skipped) |
  | `check:deep:shared` | Knip exit 0; golden SQL 2 pinned files; jscpd 0 clones; likec4 valid |
  | `test:e2e` | Electron package built; Playwright 27 passed |
  | `package:launch-smoke` | packaged renderer isolation, Project Storage and Writer proof validated |

- **s5c V2** (`p3-acceptance-s5c-v2.log`, at `c5dde0e`): the root integration config, `--reporter=verbose`, exactly 10 files, exit 0, **1140 passed / 0 failed / 0 skipped**.

  | Project | File | Passed |
  |---|---|---|
  | harness-native-long | `canonical-command-repository-faults` | 92 |
  | harness-integration | `active-project-coordinator-real-commands` | 7 |
  | harness-integration | `canonical-command-driver` | 5 |
  | harness-native-long | `canonical-command-repository` | 320 |
  | harness-integration | `canonical-project-activation` | 3 |
  | harness-integration | `canonical-project-settlement` | 107 |
  | harness-integration | `canonical-project-switch` | 65 |
  | harness-native-long | `canonical-writer-reconciliation` | 517 |
  | harness-integration | `harness-runtime-real-commands` | 3 |
  | harness-integration | `project-storage-lifecycle` | 21 |

- The coordinator accepted run 4 and s5c V2. Pedro authorised the squash and push, which the coordinator does in the main checkout. Refs #129. Closing the issue is a separate GitHub write.
