---
date: 2026-10-10T18:00:00+0100
author: Pedro Mesquita
repository: slopstop
branch: feat/c1-s3-conversation-protocol
commit: cc4178f
status: in-review
tags: [evidence, tdd, conversation, c1, protocol, coordinator, runtime]
---

# Conversation C1 S3 — protocol v8, coordinator admission, runtime — TDD evidence

## Method

S3 follows the approved design revision 4.3. Its identity:
- `content_hash 5ff869b7…`, commit `5ec6419`;
- the approved copy is under `.rpiv/evidence/2026-10-09_13-54-08_conversation-c1-local-save/`;
- the append-only check found no difference.

The work runs in the worktree `slopstop-c1-s3`, on the branch `feat/c1-s3-conversation-protocol` from main `cc4178f`.

Each step is one commit, red first.
- **Binding.** Every red, green and binding run is bound by its parent commit and a patch digest (`git add -A -N; git diff HEAD --binary | sha256sum`).
- **Logs.** Each is logged with a header (label, parent, patch sha256, changed files, command, exit, duration) in `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/s3/logs/`, called `logs/` below.
- **Guards.** A row that passes on arrival is a guard, bound by a recorded mutation.
- **Restoring after a mutation.** The mutated file is restored from a backup copy, then the restored patch digest is checked against the green one.

## Steps

| Step | Commit | Behaviours | Red | Green | Bindings |
|---|---|---|---|---|---|
| 1 | `0682bef` | CNV-B12: protocol v8, `project-conversation-protocol.ts`, version pins (10 files + the desktop pin) | A `bf1c0add`: the union rejects the commands (`invalid_value` at `command`). B `94b3a471`: the bound rows and text rows pass against a plain-typed scaffold; `activationId` and `projectId` are guards | `3020598c`, 68/68 | — |
| 1b | `e9d4e78` | CNV-B12 UTF-8 size pins against the platform encoder (coordinator request) | guards | `3140c15c`, 73/73 | 4 counter mutations, each red |
| 2 | `690e408` | CNV-B36 (6a): `WRITER_CLIENT_ABANDON_FAILED` in writer, coordinator and protocol; U3 guards | writer `01ea920d` (S2 pin T2 sees `WRITER_REPOSITORY_CLOSE_FAILED`; its assertion changes here); coordinator `e14d4c41` (`decodeStrict` rejects the code); protocol `e2046cd0` (rows fail to decode) | `9500633b`, 338/338 | — |
| 3 | `3cc4aee` | CNV-B29: `admitActiveWork`; `conversationRead`/`conversationSave` facades | `217c62d9`: every refusal answered `broken` while `execute` was right | `7384c1d0`, 37/37 | read-only check before the Project check: the 2 read-only refusal rows fail (`d7fe19d1`) |
| 4 | `b489324` | CNV-B40: strict conversation results with exact request echo | `6087d77a`: a foreign result passed; a synchronous owner throw escaped as a throw | `d2cca9ca`, 184/184 | — |
| 5a | `fa4fc33` | CNV-B13 seam (a) plain rows, CNV-B39 dispatch, CNV-B30 identity; coordinator save and read paths | seam (a) `9acbf727`: 8 rows answered `request.failure HARNESS_INTERNAL_FAILURE` (the registry misroute); B39 unit `8ffeb8ef`: the coordinator was never called | seam (a) 8/8, units 318/318 | — |
| 5b | `432b021` | CNV-B13 seam (b) rows, busy native-long file, opener pass-through, node wiring | guards (5a implementation) | runtime 10/10; busy 3/3 | busy/broken swap (both files), writer-unavailable as broken, uncertain as a storage failure |
| 6 | `7a03f8f` | CNV-B14 phase 1: read-only reads drained | unit `fa90a659`: the release ran with the read held; runtime `f656a062`: switch and stop answered while the read was held | `9c112f70`, runtime 12/12, coordinator 41/41 | registration after the first await: 4 same-turn rows fail (`2dfab128`) |
| 7 | `7b5b808` | CNV-B38: a refused read falls back to the read-only reader | `ca226441`: the refused read answered `broken`; the port was never called | `b7774f62`, 47/47 + runtime 12/12 | — |
| 8 | `8502765` | CNV-B13 closure rows and queued-read rows | guards (see deviations) | `2bd57fd8` runtime; busy closure `ccd79240` | no fallback: 4 closure and queued rows fail (`f66345ea`); busy swap (`26119346`) |
| 9 | `3b7d0a1` | CNV-B14 phase 2 and writer-held rows | guards | `cbdbaabf`, runtime 22/22, coordinator 49/49 | after-await: 6 same-turn rows fail; registration skipped + `closeOnce` ignoring Conversation work: 4 writer-held rows fail with "Canonical Project activation release failed." (`5b60f9d6`) |
| 10 | `17506ad` | CNV-B37 (#102): listing cleanup rule, listing adapter, pin flip | preparation `4edb1881`; adapter `d3618d70`; pin with the preparation fix undone `153dbf0f` | `663826a0`: units 12/12, pin 2/2 | — |
| 11 | this commit | CNV-B15 pin, evidence | pin | `logs/s11-b15-pin.log`: canonical, active-project and command integration 284/284 | — |

## Deviations and disclosures

- **Step 1.**
  - The first red run (`de16149c`) was not the contract's red: at version 7, every version-8 command answered `PROTOCOL_VERSION_UNSUPPORTED`. The version moved to 8 in the scaffold, and red A was recorded.
  - The UTF-8 size is counted per code point, the same count `TextEncoder` gives; the protocol package targets lib ES2022, with no `TextEncoder` type. Pinned in 1b.
  - Until step 5, the runtime let conversation commands fall to the registry handler, typed: a non-registration payload is strict-decoded as a registration request. This kept the designed misroute.
- **Step 3.**
  - The first red run did not leave the pending rows pending (the arrangement awaited the lifecycle it started). The test was fixed, and the red re-recorded against a scaffold-equivalent mutation.
  - A `git checkout` restore emptied a new intent-to-add file. It was rewritten; its digest equals the green digest.
- **Step 5a.** The first red run had a TypeError in the paging row, and a vacuous CNV-B30 (`undefined` equal to `undefined`). Both tests were fixed before the recorded red.
- **Step 5b (#94).**
  - The first busy file put two real-lock busy waits (7389 ms + 7418 ms) in one test, which timed out at 15815 ms (`logs/s5b-busy-rows.log`, kept). This was reported before any rerun.
  - With the coordinator's approval, the design row "storage busy (a, real lock)" is now two tests (save, read), with the same oracles and no timeout raised. The split ran once, 3/3.
- **Step 6.**
  - A request carried the activation's `access` field; fixed.
  - The switch row did not discriminate, because re-activation outlasted the read. The row now waits up to 2 s real time for the lifecycle while the read is held.
  - The teardown now opens the gate in `finally`.
  - A one-microtask registration delay survived as a mutation (kept); the binding uses one event-loop turn after starting the work.
- **Step 7.** The first red run had an untyped fake writer read; it is typed now.
- **Step 8.**
  - CNV-B38 landed in step 7, the approved plan order, so the closure rows passed on arrival. They are bound by the design's own red behaviour as a mutation (refusal answers `broken`).
  - The design's queued-row binding (a pre-slot closure check) cannot be written: no pre-slot closure flag exists (G18). The rows are bound by the no-fallback mutation instead.
- **Step 9.** The combined mutation with a one-turn registration delay survived for the writer-held rows, because the held work registers before reaching its hold. With registration skipped, the rows fail as predicted.
- **Step 10.** The pin's red was observed with the preparation fix undone. The rejection carried the new `RegistrationCleanupUnconfirmed` (parts: listing), not the old text, because the adapter changed in the same step.

## Busy margins (#94)

| Wait | Configured | Measured |
|---|---|---|
| Runtime save behind an exclusive lock | 5 s | 7414 ms |
| Runtime read behind an exclusive lock | 5 s | 7396 ms |
| Runtime save whose reconciliation cannot read (uncertain) | 5 s + 2 s | 8748 ms |
| Fallback read behind a held lock (abandonment / failed settlement) | 2 s | 3191 / 3211 ms |

## Open

- **CodeScene waiver (Pedro, decisions log §39, option a).** `project-registration-preparation.ts` scores 8.03 before and after S3, the same as on main (`cc4178f`). Its mean cyclomatic complexity went from 4.50 to 4.31. The debt is old: complex `confirm` and `inspectConfirmation`, complex conditionals, and the duplicated tracked wrappers. It is accepted for C1 S3 only, and the file is not touched further in S3. The refactor to 10 is issue #129, after the #94 measurements.
- **Not yet run.** Heavy runs on the final candidate (integration, e2e, launch-smoke, both mutation configs) and the candidate review: slice-verifier plus the code and coverage reviewers.

## Candidate review round 1 (candidate `5e048d2`)

The coordinator ran the review: code, slice and coverage reviewers, with each finding checked by a claim verifier. No production routing or drain defect was found. The fixes below are fixes to the test contract and the evidence, plus one predicate (G19). Logs are under `logs/`, named `r1-*`, and each is bound by its parent and patch digest.

| Item | Commit | Fix | Binding (parent, digest, result) |
|---|---|---|---|
| T7: exact UTF-8 boundaries | `e879bdf` | U+007F/U+0080, U+07FF/U+0800 and U+FFFF/U+10000, checked against `TextEncoder` | `<` → `<=` at 0x80, 0x800 and 0x10000: 1 failure each (`5e048d2`; `6aa64473`, `f89f27d2`, `924f6111`) |
| T5: unit oracles for the save mapping | `bd7823e` | New `active-project-conversation.test.ts`. Save rows: saved, conflict, rejected, writer-unavailable, stale-writer, busy, broken, uncertain, read-only. Read rows: the page, busy and broken | 6 mutations, each with at least 1 failure (`e879bdf`). The first conflict mutation survived (`6ab613c3`) because the row's revision matched the mutated value. The row now uses revision 3, and the mutation fails (`15b1cdd3`) |
| T6: G17 snapshot failure | `bd7823e` | Coordinator row: after the snapshot throws, the writer's `conversationRead` answers writer-unavailable and the read falls back | No fallback: 1 failure (`db9f6c3f`) |
| T9: B29 unit row | `bd7823e` | `switchFixture(realCommands, extra)` injects a fake read-only reader; the row asserts the page | Green 49/49 (`72ecf198`) |
| Suggestion: `readOnlyPage` TSDoc | `bd7823e` | Removed | — |
| T1: teardown masking (#102) | `78a527d` | `runThenCleanUp` and `cleanUpAll` report the body failure first, then every cleanup failure (as an AggregateError). Both `inRuntime` helpers and the runtimes' `stop` use them. The abandonment and closure rows end with `expectSourceReleased` | Cleanup before the body: 4 failures (`bd7823e`, `4dde8907`). Runtime 22/22 and busy 5/5 (`76c519d3`) |
| T2: fallback paging row | `d0987e2` | Seam (b), failed-settlement closure, 101 messages: the page after null gives 100 messages and nextCursor 100; the page after 100 gives 1 message and null. Both pages come through the read-only fallback | No fallback: 1 failure (`78a527d`, `372a37e8`) |
| T3: phase-2 oracles | `d0987e2` | `expectLifecycleAfterHeldWork(whilePending)` and `expectRefusedWhilePending`: a save and a read during the pending switch or stop answer `coordinator-unavailable`, and the read shows the message after returning to the Project | No pending refusal: 2 failures (`5a5b9d11`) |
| T8: queued-read discrimination | `d0987e2` | The queued rows hold the fault `/ORDER BY cursor LIMIT/`, which must stay unconsumed, so the read never ran in the slot | No in-slot refusal: the first run gave 1 failure and 1 pass (`10aa4740`); with both closure kinds queued, 2 failures (`4b6cc929`) |
| Platform suggestion | `d0987e2` | The held per-request drain rows run on win32 only, like the CNV-B13 read-only rows (see the disclosures) | — |
| T4: root Stryker list | `e346158` | S3 ranges added (listed below) | Not run yet (heavy) |
| G19: allowlist | `f99251a` | `listingCleanupFailed` is true for any broken code except `REGISTRY_SCHEMA_UNKNOWN`, `REGISTRY_SCHEMA_NEWER` and `REGISTRY_CORRUPT`. It is typed on the `Listing` result | Negation: 4 failures (`3b591cb3`). `REGISTRY_CORRUPT` dropped: 1 failure (`b8e48b45`). Green 7/7 (`dc69f7a2`) |
| T10 and the evidence omissions | this commit | Below | — |

Every round-1 commit passed the gates and the CodeScene pre-commit safeguard. The gates are `pnpm check`, `check:duplicates`, `check:dead-code` and `check:architecture` (logs: `logs/r1-*-check.log` and the files beside it).

### Disclosures added in round 1

- **Invalid step-2 coordinator red.**
  - The first run (`s2-b36-coordinator-red-INVALID-no-test.log`, parent `0682bef`, digest `48f3c341`) matched no test: all 25 were skipped, because the `-t CNV-B36` row was not written yet.
  - It is not red evidence. The recorded red is `e14d4c41`.
- **Replaced B40 red.**
  - The first red (`s4-b40-red.log`, `fd48faeb`) failed for the expected reasons: the foreign result passed, and the synchronous throw escaped.
  - Its test then dropped two casts and used `Reflect.set` instead. The failures stayed the same, and the recorded red is `6087d77a`.
  - Both logs are kept.
- **Scope move.**
  - The design puts admission and the conversation routing in `active-project-coordinator.ts`.
  - They live in two new files instead:
    - `active-work-admission.ts` (`admitActiveWork`);
    - `active-project-conversation.ts` (the read and save programs, and the G17 fallback).
  - The coordinator keeps the admit and drained wiring and the two Promise facades.
  - The Stryker list mutates the two new files whole.
- **UTF-8 mechanism.**
  - The protocol counts UTF-8 bytes per code point, 1 to 4 bytes depending on the range. It does this because its lib is ES2022, which has no `TextEncoder` type.
  - The tests compare that count with the platform `TextEncoder` at every boundary (T7).
- **Platform gating.**
  - Only Windows was available.
  - The CNV-B13 read-only rows and the CNV-B14 held per-request drain rows depend on how the platform behaves under a held SQLite lock. Both are therefore gated with `it.runIf(process.platform === "win32")`.
  - Linux behaviour is not checked. On Linux these rows are skipped, not passed.
- **G19 and the waiver.**
  - G19 touches `project-registration-preparation.ts` although §39 said "not touched further in S3", because round 1 asked for this change.
  - Today the listing answers no broken code outside the allowlist, so behaviour is unchanged and no red is possible. Two mutations bind the change instead.
  - The file stays at 8.03.

### Root Stryker `mutate` additions (T4, line ranges at `f99251a`)

- `packages/protocol/src/project-conversation-protocol.ts` (whole file);
- `packages/protocol/src/canonical-project-protocol.ts:156-156`, `:252-252`, `:419-419` (CNV-B36);
- `apps/harness/src/active-project-conversation.ts` and `apps/harness/src/active-work-admission.ts` (whole files);
- `apps/harness/src/active-project-coordinator.ts:513-539` (admit, the ports and drained) and `:705-724` (command admission and the two facades);
- `apps/harness/src/canonical-project-application.ts:90-101` (the wrappers) and `:107-118` (`sameRequest`);
- `apps/harness/src/registration/project-registration-preparation.ts:225-279`, `:294-307`, `:367-383`;
- `apps/harness/src/registration/registration-listing.ts` (whole file).

The unit oracles for these ranges are:
- `project-conversation-protocol.test.ts`;
- `canonical-project-protocol.test.ts`;
- `active-project-conversation.test.ts`;
- `active-project-coordinator.test.ts`;
- `canonical-project-application.test.ts`;
- `project-registration-preparation.test.ts`;
- `registration-listing.test.ts`.

### Code Health (T10, at `f99251a`)

Every TypeScript file that S3 touches scores 10, with these exceptions:
- `apps/harness/src/registration/project-registration-preparation.ts` scores 8.03, which is waived (§39, #129).
- `code_health_score` answered "Could not determine Code Health score" for three files (retried once for `conversation-save.ts`). The pre-commit safeguard passed on each commit that changed them. The files:
  - `apps/harness/src/conversation/conversation-save.ts`;
  - `apps/harness/vitest.native-long-files.ts`;
  - `packages/protocol/src/index.ts`.

The files that score 10:
- desktop: `canonical-writer-package-smoke-test-peers.ts`;
- harness, source and test files:
  - `active-project-conversation(.test).ts`, `active-project-coordinator(.test).ts`, `active-work-admission.ts`;
  - `canonical-project-application(.test).ts`, `canonical-project-writer(.test).ts`;
  - `conversation-store.ts`, `harness-runtime(.test).ts`, `node-active-project-coordinator.ts`, `process-bootstrap.ts`;
  - `project-registration-preparation.test.ts`, `registration-listing(.test).ts`;
- every changed file under `apps/harness/tests/integration/` (16 files);
- protocol: `canonical-project-protocol(.test).ts`, `canonical-writer-smoke-protocol.test.ts`, `project-conversation-protocol(.test).ts`, `protocol(.test).ts`, `schema-boundary-characterization.test.ts`.

### Pre-existing, follow-up only (not fixed in S3)

These go to #129 or a new issue:
- In the listing adapter's stop, an owner or observer `close` that rejects becomes a defect, and the registry stop is skipped (slice review R4).
- A cleanup failure classified as busy becomes `unavailable REGISTRY_BUSY` and is not counted as unconfirmed (coverage review F11).

### Still open

These heavy runs on the final candidate wait for the coordinator's go-ahead:
- integration;
- e2e;
- launch-smoke;
- `pnpm exec stryker run --force` (root config);
- `stryker.conversation.config.json`.

Review round 2, the last, follows.

## Heavy runs on `6bb1345` (after round 1)

With the coordinator's go-ahead, the five runs below ran one after another, once each, on a clean tree. Every header records parent `6bb1345` and patch digest `e3b0c442` (the empty diff). Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/heavy-6bb1345/`. This section replaces the "Still open" list of round 1 for these runs. Round 3 changes tests, so the final candidate gets fresh heavy runs, recorded below them.

| Run | Result | Duration |
|---|---|---|
| `pnpm test:integration` | 72 files passed, 2 skipped; 2143 tests passed, 5 skipped | 529 s |
| `pnpm test:e2e` | 11/11 | 111 s |
| `pnpm package:launch-smoke` | passed: renderer isolation, Project Storage and Writer proof | 41 s |
| `pnpm exec stryker run --force` (root) | 87.66 (break 80); 2615 mutants in 23 files | 505 s |
| `pnpm exec stryker run stryker.conversation.config.json` | 92.41 (break 80); 400 mutants in 7 files | 705 s |

**Runner crash (#94 observation).**
- During the root run, at 17:10:30, one Stryker test-runner process exited with code 3221225477 (a Windows access violation) while it was running `harness-supervisor.test.ts` mutants.
- Stryker replaced the runner and finished. No timeout occurred, and nothing was rerun.

**Per-file mutation scores for the S3 files.** Score = (killed + timeout) / (killed + timeout + survived + no coverage).

| File (root config) | Score | Killed | Survived | No coverage |
|---|---|---|---|---|
| `project-conversation-protocol.ts` | 97.44 | 38 | 1 | 0 |
| `protocol.ts` | 80.10 | 161 | 13 | 27 |
| `canonical-project-protocol.ts` (CNV-B36 lines) | — | 0 mutants | — | — |
| `active-project-conversation.ts` | 94.85 | 92 | 5 | 0 |
| `active-work-admission.ts` | 94.59 | 35 | 2 | 0 |
| `active-project-coordinator.ts` (ranges) | 59.09 | 26 | 11 | 7 |
| `canonical-project-application.ts` (ranges) | 91.67 | 11 | 1 | 0 |
| `harness-runtime.ts` | 94.94 | 225 | 6 | 6 |
| `registration/project-registration-preparation.ts` (ranges) | 61.11 | 44 | 19 | 9 |
| `registration/registration-listing.ts` | 94.44 | 34 | 2 | 0 |

| File (conversation config) | Score | Killed | Survived | No coverage |
|---|---|---|---|---|
| `canonical-project-writer.ts` | 93.13 | 122 | 8 | 1 |
| `conversation/conversation-store.ts` | 93.70 | 119 | 8 | 0 |
| `canonical-writer-conversation.ts` | 93.15 | 68 | 5 | 0 |
| `conversation/conversation-save.ts` | 86.36 | 19 | 3 | 0 |
| `conversation/conversation-rows.ts` | 86.67 | 13 | 1 | 1 |
| `conversation/conversation-errors.ts` | 33.33 | 1 | 2 | 0 |
| `storage/sqlite-busy.ts` | 100.00 | 11 | 0 | 0 |

- **`canonical-project-protocol.ts` has no mutants.** Its CNV-B36 lines (`WRITER_CLIENT_ABANDON_FAILED` in three module-level code lists) are static, so `ignoreStatic` skips them.
  - The protocol unit rows cover them (step 2).
  - The writer's throw of that code (`canonical-project-writer.ts:286-290`) is mutated by the conversation config: all 5 mutants were killed.
- **`protocol.ts` and `harness-runtime.ts`** were already listed in the root config before S3. S3 added the conversation commands and their dispatch.

## Review round 2 and round 3 (decisions log §40)

Round 2, the last, closed every round-1 item and found no production defect. Pedro approved a short, bounded round 3 for the remaining items (§40). Logs are under `logs/`, named `r3-*`.

| Item | Commit | Fix | Binding (parent, digest, result) |
|---|---|---|---|
| A: the `broken` operand of the G19 predicate | `789670f` | CNV-B37 row: a successful listing closes `closed` | Before the row, the mutant `true` survived: `logs/r3-a-before-row-mut-survives.log` (digest `b1cf18f1`, 7/7 passed), against the green `logs/r3-a-before-row-green.log` (digest `e3b0c442`). Their header labels read `r3-a-mut-broken-true` and `r3-a-green` because the files were renamed after the run, so cite them by filename and digest. With the row, the mutant fails (`6bb1345`, `7ccfa964`) |
| B: the reconciliation opener pass-through | `789670f` | The uncertain row asserts that the injected opener was called once with the activation's database path | Opener dropped: 1 failure (`903865cf`) |
| C: the writer-slot read arguments | `789670f` | A unit row reads through `writer.conversationRead` and checks the Project and the cursor in the statements | Arguments replaced by `{}`: 1 failure (`40d8f9b5`) |
| E: the coordinator range | `ae9c7de` | `active-project-coordinator.ts:705-724` narrowed to `:705-708` (command admission) and `:715-724` (the facades). The pre-existing `execute` settle path at 709-712 has no unit oracle; CNV-B15 integration covers it | — |
| E: killable survivors | `5a2e13f` | Unit rows: a request with an extra key is rejected (CNV-B40); the listing's `list` (CNV-B37); the listing error carries `cause` only when the registry stop failed (CNV-B37); the text-problem message (CNV-B12); the coordinator's injected ids and reconciliation opener (CNV-B29) | 6 mutations, 1 to 2 failures each (`7ea8a30`; `aedeb4a9`, `8f31511e`, `f243adb8`, `292e716f`, `ee63074a`, `906aeca8`); restored digest `475a6c71` equals green |
| F: test teardown | `7ea8a30` | The remaining `try/finally` teardowns that stop runtimes use `runThenCleanUp`; the queued-read rows clear their unused writer fault in cleanup | File 23/23 (`3704bccb`). Cleanup made a no-op: the next queued-read row fails (`07988e90`) |
| H: main | `0c604bd` | Merged main `4b396d4` (decisions log §39 and §40; docs only) | — |

**Remaining `try/finally` blocks.** Three remain in `project-conversation-runtime.integration.test.ts`. Each runs only a synchronous `restore()` or `open()` that cannot throw, so none can hide a body failure.

### Survivor dispositions (E)

These come from the root run on `6bb1345`. Five read-only agents classified each survivor outside the reviewed list, each trying to construct a killing input. Rows marked "killed in round 3" now have a unit oracle.

| Location | Mutant | Disposition |
|---|---|---|
| coordinator 519 | `??` → `&&` on `createConversationId` | Killed in round 3 (`5a2e13f`) |
| coordinator 523 | condition `true`, `!==` | Killed in round 3 (`5a2e13f`) |
| coordinator 523 | condition `false` | Equivalent: an `undefined` key and an absent key reach the same `=== undefined` check (`active-project-conversation.ts:158`) |
| coordinator 525 (no coverage) | `{}` for the opener spread | Covered by the new opener row; the old run predates it |
| coordinator 536 | `admitted.delete` removed | Unobservable: the deferred is already done, so a stale entry is awaited at once; it only grows a Set |
| coordinator 705, 721 | `kind` literal `""` | Equivalent: the read-only check in each caller gives the same answer |
| coordinator 708 | condition `false`, literal | Type narrowing: admission already refused a read-only command with the same row |
| coordinator 709-712 (no coverage) | `execute` settle path | Removed from the range (pre-existing; CNV-B15 integration) |
| coordinator 718, 723 | `admitted` check → `true` | Equivalent in practice: a refused request draining adds only a done deferred |
| `active-work-admission.ts:49` | condition `false`; `"read-only"` → `""` | Unobservable: each caller re-checks read-only and gives the same row (`active-project-coordinator.ts:708`, `active-project-conversation.ts:146`). The difference is only `admitted` membership and microtask timing |
| `active-project-conversation.ts:113` | arguments `{}` | Killed in round 3 (C) |
| `active-project-conversation.ts:158-160` | opener pass-through | Killed in round 3 (B) |
| `canonical-project-application.ts:114` | length check `true` | Killed in round 3 (`5a2e13f`) |
| `registration-listing.ts:49`, `:55` | `list` → `undefined`; `{ cause }` always | Killed in round 3 (`5a2e13f`) |
| `project-conversation-protocol.ts:122` | message `""` | Killed in round 3 (`5a2e13f`) |
| preparation 241 | `broken` operand `true` | Killed in round 3 (A) |
| preparation 245, 250, 252-253, 267-268, 295, 304-305, 368-378 | cleanup counters, timeout choice, unconfirmed merge | Pre-existing (#129). The 378 write is dead: `unconfirmed` is already set on that path |

### Win32-only rows (G, §40)

The CNV-B13 read-only rows and the CNV-B14 phase-1 per-request drain rows run only on Windows (`it.runIf(process.platform === "win32")`), whereas the design (:617) states them without a platform. Pedro accepted this as a recorded deviation: v1 targets Windows, and Linux is deferred to #112. Revisit it when Linux enters. On Linux these rows are skipped, not passed.

### Still open

- Fresh heavy runs on the final candidate: integration, e2e, launch-smoke, `pnpm exec stryker run --force` (root) and `stryker.conversation.config.json`. These wait for the coordinator's go-ahead.
- After them, one verifier limited to the round-3 fixes.

## Final heavy runs on `97aeaa1` (final candidate)

The coordinator gave the go-ahead after round 3. The five runs ran one after another, once each, on a clean tree, from the S3 worktree root. Every header records parent `97aeaa1` and patch digest `e3b0c442` (the empty diff). Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/heavy-97aeaa1/`. There was no timeout, no rerun and no runner crash.

| Run | Result | Duration |
|---|---|---|
| `pnpm test:integration` | 72 files passed, 2 skipped; 2143 tests passed, 5 skipped | 513 s |
| `pnpm test:e2e` | 11/11 | 109 s |
| `pnpm package:launch-smoke` | passed: renderer isolation, Project Storage and Writer proof | 40 s |
| `pnpm exec stryker run --force` (root) | 88.25 (break 80); 2610 mutants instrumented in 23 files | 464 s |
| `pnpm exec stryker run stryker.conversation.config.json` | 92.41 (break 80); 400 mutants in 7 files | 801 s |

**Stale mutants in the root report.**
- In force mode the root run instrumented 2610 mutants: its log says "0 of 2610 mutant result(s) are reused". Its JSON report still lists 2615.
- The five extra mutants are the `execute` settle-path mutants at `active-project-coordinator.ts:710` (4) and `:712` (1), all NoCoverage. Round 3 took those lines out of the range (`ae9c7de`), and this run never instrumented them.
- They were carried over from the earlier incremental report, because the coordinator source has not changed since that run.
- The scores below leave them out. Stryker's 88.25 includes them, so the true root score is slightly higher.

**Per-file mutation scores for the S3 files.** Score = (killed + timeout) / (killed + timeout + survived + no coverage).

| File (root config) | Score | Killed | Survived | No coverage |
|---|---|---|---|---|
| `project-conversation-protocol.ts` | 100.00 | 39 | 0 | 0 |
| `protocol.ts` | 80.10 | 161 | 13 | 27 |
| `canonical-project-protocol.ts` (CNV-B36 lines) | — | 0 mutants (static; see the 6bb1345 run) | — | — |
| `active-project-conversation.ts` | 98.97 | 96 | 1 | 0 |
| `active-work-admission.ts` | 94.59 | 35 | 2 | 0 |
| `active-project-coordinator.ts` (ranges, stale mutants left out) | 76.92 | 30 | 8 | 1 |
| `canonical-project-application.ts` (ranges) | 100.00 | 12 | 0 | 0 |
| `harness-runtime.ts` | 94.94 | 225 | 6 | 6 |
| `registration/project-registration-preparation.ts` (ranges) | 62.50 | 45 | 18 | 9 |
| `registration/registration-listing.ts` | 100.00 | 36 | 0 | 0 |

| File (conversation config) | Score | Killed | Survived | No coverage |
|---|---|---|---|---|
| `canonical-project-writer.ts` | 93.13 | 122 | 8 | 1 |
| `conversation/conversation-store.ts` | 93.70 | 119 | 8 | 0 |
| `canonical-writer-conversation.ts` | 93.15 | 68 | 5 | 0 |
| `conversation/conversation-save.ts` | 86.36 | 19 | 3 | 0 |
| `conversation/conversation-rows.ts` | 86.67 | 13 | 1 | 1 |
| `conversation/conversation-errors.ts` | 33.33 | 1 | 2 | 0 |
| `storage/sqlite-busy.ts` | 100.00 | 11 | 0 | 0 |

**Remaining S3 survivors.** Every one has a disposition in the round-3 table above. No new survivor appeared, and the round-3 rows killed every mutant they target.
- Coordinator:
  - 523 `false`: equivalent;
  - 536: unobservable;
  - 705 and 721 kind literals: equivalent;
  - 708 `false` and literal: type narrowing;
  - 708 "read-only" literal (no coverage): the same narrowing, because admission already refuses that case;
  - 718 and 723: equivalent in practice.
- `active-project-conversation.ts:158` `false`: equivalent. It is the same `undefined`-key case as coordinator 523 `false`.
- `active-work-admission.ts:49` (two mutants): unobservable.
- Preparation 245, 250, 252-253, 267-268, 295, 304-305 and 368-378: pre-existing, tracked in #129.

### Status

The final candidate is `97aeaa1`. These results are recorded as evidence only, and this record changes no code. One verifier, limited to the round-3 fixes, follows. The S3 merge decision is Pedro's.
