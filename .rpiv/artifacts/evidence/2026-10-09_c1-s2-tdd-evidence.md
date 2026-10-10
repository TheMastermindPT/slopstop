---
date: 2026-10-09T21:45:00+0100
author: Pedro Mesquita
repository: slopstop
branch: feat/c1-conversation-local-save
commit: 741f0f5
status: ready
tags: [evidence, tdd, conversation, c1, writer, storage]
---

# Conversation C1 S2 — conversation store — TDD evidence

## Method

S2 builds on the accepted S1 head `741f0f5`, following the S2 build plan the coordinator approved (P1 to P4). Each step is one commit: red, minimal green, then refactor.

Every red and green is bound by its parent commit plus a patch digest:

```
git add -A -N
git diff HEAD --binary | sha256sum
```

Most new tests pin behaviour that an earlier step had already put in place. Each such test is a guard, bound once by a single code mutation that makes it fail; the code is then restored.

Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/s2-bindings/`, called `s2-bindings/` below.

## Steps

| Step | Commit | Behaviours | Red (patch) | Green / final | Binding |
|---|---|---|---|---|---|
| 1 | `c83414d` | CNV-B28: `isSqliteBusy`; `registryFailure` migrated | `b29909a8` (module missing) | parity before migration `06d015a7`, after `6b82cd36`, 21/21 | — |
| 2 | `96a7832` | CNV-B6: store scaffold, writer slot (Semaphore 1), `conversation(work)` facade, `createWriter` factory | `0ef1f16f` (stub save, read → null) | `d1ba19f6`; final `41451519` | — |
| 3 | `cedfbf5` | CNV-B7, B8, B26, B27 | `68a612e9` | `c4bdb5af`, 4/4; final `a7691a02`, 5/5 | B27: slot bypassed `96b14a01` → "transaction is already owned" |
| 4 | `031a578` | CNV-B11: fence check before any write; separate `conversationRead` | final test form, bound | 6/6; final `56dea518` | fence check skipped `41bfae4b` → save completes |
| 5 | `3f1e526` | CNV-B25 part one: partial state broken; `readProjectConversationReadOnly` | partial `a0387828`; reader `970351da` | 12/12 | — |
| 6 | `dd6fe5c` | CNV-B24: typed `WriterOwnerBusy` → `command-busy`; serialization both orders | unit `7c922e62` | unit `2939bafe`, 29/29 | settlement out of slot `29df9b61` → "already owned" |
| 7 | `29bea84` | CNV-B9; CNV-B25 lock cases (native-long) | `bc1e2b14` | 9/9 | — |
| 8 | `1bc8f35` | CNV-B10 (a), (b), (b2), (c) (native-long) | `560f455a` | `d8f381e1`, 4/4 | normal release forced `46c150b6`; in-slot re-check removed `db33b819` |
| 9 | `de254e8` | `stryker.conversation.config.json`, `vitest.conversation-mutation.config.ts` (76 tests), `test:mutation:conversation:harness` | — | see Heavy runs | — |

Disclosed test-side corrections after a red (assertions kept):
- Step 2: the canonical snapshot moved inside the activation, because activation writes `project_state`.
- Step 3: the paging helper was retyped (a type error only).
- Step 4: the first reds failed in the test's own raw SQL (an FK, then an incoherent fence). The fence now moves coherently and is restored before release.
- Step 5: the root-branch case had saved first, so its insert hit the unique index.
- Step 7: the canonical pin now runs before the bodies' own command.

Approved assertion change (R2-C2): `canonical-writer-reconciliation.integration.test.ts` now expects the typed `WriterOwnerBusy` (same message) instead of a plain `Error`.

## Scope moves

- **B25 lock cases moved to step 7** (coordinator-approved). They needed the busy mapping: a lock held during a read, a short external commit with read-only, and an exclusive lock past 2 s.
- **B24 and B27 are guards.** The slot landed in step 2, so the design's predicted reds cannot appear. Each is bound by a mutation instead.

## Design-vs-result gaps

- **B7 red.** The design predicted "a second row is inserted". The `UNIQUE save_id` index made the retry fail with `SQLITE_CONSTRAINT`, so it read as broken.
- **B10 (b) red.** The design predicted the switch answers `release-failed`, because `releaseFence` runs on the abandoned client. The injected close fault leaves the real client usable, so with the normal release stages forced the switch releases. The binding shows up as a missing `abandoned-active-fence` recovery instead.

## Deviations (accepted by the user, 2026-10-09, decision via the coordinator)

- **6a (accepted).** `WRITER_CLIENT_ABANDON_FAILED` is not in the protocol release vocabulary, and adding it needs protocol v8 (S3). Until then, a failed force-close reports `WRITER_REPOSITORY_CLOSE_FAILED`, with cause `WRITER_CLIENT_ABANDON_FAILED`.
- **6b (accepted).** `project.close` is a storage-level command that does not pass through the coordinator. The S2 "second run" of CNV-B10 (b) therefore uses `coordinator.stop()`.

## Busy margins (#94)

Recorded in `s2-bindings/b9-busy-durations.log`:

| Wait | Configured | Measured |
|---|---|---|
| Writer save or read behind an exclusive lock | `busy_timeout` 5 s | about 7.4 s |
| Read-only read behind a held lock | 2 s | 3.2 s |
| Read-only read through a 500 ms commit | — | 584 ms (succeeds) |

These run in the native-long project with a 15 s per-test timeout. A timeout under load is a finding, never a reason to raise the timeout (coordinator).

**Timeout under load (#94).** During step 8, one native-long gate run timed out on an existing case: `S6 G4 lookup baseline ledger 'rejections' 'rejected'` at 15.2 s (1 failed, 1120 passed). That run's output exists only in the session transcript. The next run passed 1121/1121, with CPU load 39% when it ended; its log is `s2-bindings/native-long-rerun-after-timeout.log`. From now on, any gate timeout is reported to the coordinator before any rerun.

## Gates at the step 8 head (`1bc8f35`)

- `pnpm check`: pass, 2469 unit tests.
- `check:duplicates`: 0 clones. `check:dead-code`: pass. `check:architecture`: pass.
- Integration `canonical-*`, `active-project-*`, `conversation-*` and `project-storage-create*`: 13 files, 358 tests.
- Native-long: 1121/1121.
- CodeScene `pre_commit_code_health_safeguard`: passed, 11 files. Touched files at 10; `conversation-save.ts` gets no score because it is too small.

## Heavy runs on `5a85033`

Run once each, in sequence, after the coordinator's go-ahead, on `5a85033` (candidate `de254e8` plus the evidence-only acceptance commit). No reruns, nothing else in parallel; every run exited 0.

Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/heavy-5a85033/`, called `heavy-5a85033/` below.

| Run | Command | Result | Duration | Log |
|---|---|---|---|---|
| 1 | `pnpm test:integration` | 70 files passed, 2 skipped; 2105 tests passed, 5 skipped, 0 failed | 676 s | `1-test-integration.log` |
| 2 | `pnpm test:e2e` | 11/11 passed | 150 s | `2-test-e2e.log` |
| 3 | `pnpm package:launch-smoke` | passed: "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." | 48 s | `3-package-launch-smoke.log` |
| 4 | `pnpm test:mutation:project-storage:harness` | score **87.52** (break 80, high 90); 3110 mutants: 873 killed, 32 timeout, 115 survived, 14 no coverage, 2076 ignored | 4140 s | `4-mutation-project-storage.log`, `4-mutation-project-storage.json` |
| 5 | `pnpm test:mutation:conversation:harness` (first run) | score **84.12** (break 80, high 90); 377 mutants: 302 killed, 38 survived, 19 no coverage, 18 ignored | 726 s | `5-mutation-conversation.log`, `5-mutation-conversation.json` |

No timeouts and no Stryker worker crashes were logged. Both mutation scores pass the break threshold but are below high.

Per-file scores (covered mutants), project storage: `project-storage-protocol.ts` 100.00, `process-fatal-diagnostics.ts` 100.00, `sqlite-schema-expression.ts` 94.19, `application-database-migration.ts` (lines 142-284) 92.39, `generated-migrations.ts` 92.31, `project-storage-manifest.ts` 88.89, `project-storage-upgrade-eligibility.ts` 85.86, `database-schema-verifier.ts` 83.53, `project-storage-node-adapters.ts` (line ranges) 70.83, `project-storage-upgrade-recovery.ts` 64.91. The three spec files have no scored mutants.

Per-file scores, conversation: `sqlite-busy.ts` 100.00, `conversation-store.ts` 90.91, `conversation-rows.ts` 86.67, `canonical-project-writer.ts` 83.74, `conversation-save.ts` 81.82, `canonical-writer-conversation.ts` 71.88, `conversation-errors.ts` 33.33.

**Known survivors, pending review.** `project-storage-upgrade-recovery.ts` (64.91), `project-storage-node-adapters.ts` (70.83), `canonical-writer-conversation.ts` (71.88) and `conversation-errors.ts` (33.33). No tests were changed for them (coordinator). The three-reviewer candidate review judges whether any survivor in `canonical-writer-conversation.ts` or `conversation-errors.ts` hides an untested behaviour; any fix goes in a review round.

## Review round 1 (candidate `ba2b381`)

All three reviewers failed `ba2b381`. The consolidated list, with user decisions U1-U4 (2026-10-10, via the coordinator), is in the coordinator's `c1-s2-round1.md`.

Every run below has a log with an identity header: label, parent, patch sha256 of `git add -A -N; git diff HEAD --binary`, changed files, command, exit and duration. Logs are in `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/s2-round2/`, called `s2-round2/` below. Digests show their first 8 hex characters.

### Code fixes

| Fix | Commit | Red (parent, patch, log) | Green (patch, log) | Guards bound |
|---|---|---|---|---|
| F1: work queued behind a failure that closed admission answers `writer-unavailable` | `a257463` | `ba2b381`, `be03449d`, `f1-red-unit.log`: the queued save rejected with the raw `Unexpected Conversation work.` | `1a0f81da`, `f1-green-unit.log` (30/30); final `e0fd8248`, `f1-queued-save-abandon-green.log` (4/4) | Queued save behind an abandonment: the Conversation in-slot check is reduced to `failed`. `40a726a4`, `f1-queued-save-abandon-mutation-2.log`: 2 failed, the save answered `completed`. |
| F2: a defect in Conversation work stays a defect | `9760597` | `a257463`, `77953b85`, `f2-red.log`: the defect resolved as a storage outcome | `4b25615c`, `f2-green.log` (14/14) | — |
| F3: read-only client open and close failures are typed | `1bfde86` | `9760597`, `6f4d3c21`, `f3-red.log`: the injected open and close failures escaped as defects | `f093cf2d`, `f3-green.log` (15/15), `f3-green-store.log` (14/14) | — |

F1 keeps the S1 pin `canonical-project-writer.test.ts` "G12 close drains accepted …": a plain `close()` still drains admitted work. Only a failure (`failed`) or an abandonment refuses queued work in the slot.

### Tests

| Item | Commit | Binding (mutation → failure) | Log |
|---|---|---|---|
| T2: 6a release | `38feb53` | Abandon cause dropped → `fails release with the abandon cause …` fails. | `t2-mutation-abandon-cause-dropped-2.log` (`04f71a4b`) |
| T3: pre-slot admission | `38feb53` | Pre-slot `admissionClosed` check removed → fails. | `t3-mutation-pre-slot-admission-2.log` (`7d7f3dda`) |
| T4: plain close drains Conversation work | `38feb53` | Close drains only the settlement → fails. | `t4-mutation-close-skips-conversations-4.log` (`23afccb7`) |
| T6: busy owner on the Conversation path | `38feb53` | `WriterOwnerBusy` rethrown → fails. | `t6-mutation-busy-rethrown-2.log` (`3220617b`) |
| T1: force-close proof; U1: lock-holding broken client | `2811b62` | `abandonClient` made a no-op → the switch, stop and U1 cases fail. In U1 the switch cannot take the held lock, and its cleanup hook then times out (under the mutation only). | `t1-u1-mutation-abandon-skips-close.log` (`2bdfbc56`) |
| T5: read with a failed close | `2811b62` | Read close mapped to busy → fails. | `t5-mutation-read-close-busy.log` (`ebc8d2da`) |
| T7: fence-check faults | `2811b62` | Every pre-commit failure classified broken → `fence check SQLITE_LOCKED` fails. | `t7-mutation-body-failure-always-broken.log` (`b730e12c`) |
| T8: canonical snapshot through B10(b) | `2811b62` | A test-side raw `UPDATE project_state` after the abandonment → both runs fail. No single source mutation reaches it without failing an earlier assertion. | `t8-test-side-canonical-write-2.log` (`a74482e2`) |
| T9: B10(a) and B10(c) durations | `2811b62` | Recording only. | `t9-busy-and-b10-durations.log` |
| T10: read-only client and fingerprint formula | `2811b62` | `readOnly: false` → fails; scope `"projects"` → fails. | `t10-mutation-read-only-off.log` (`4a4ad254`), `t10-mutation-fingerprint-scope.log` (`59c0fe58`) |

Greens:
- **Unit:** `767445bd`, `t-unit-green-4.log` (34/34).
- **Integration:** `7687fe23`:
  - `t-busy-green.log` (12/12);
  - `t-store-green.log` (14/14);
  - `t-integration-green-conversation.log` (299/299);
  - the native-long rerun below (1127/1127).
- **After the jscpd fix:** `baf0daaa`, `t-dedupe-green.log` (19/19).

Disclosed process faults (none of them changed an assertion):
- **Reverted tests.** A restore step (`git checkout -- apps/harness/src`) also reverted the uncommitted unit tests. Three binding runs then ran without those tests, so they bind nothing; their logs are kept as `*-INVALID-tests-reverted.log`. The tests were rewritten and all four were bound again (`-2` logs).
- **T4 strengthened.** Its first two forms survived the mutation (`-2` and `-3` logs) because of a microtask race. The test now records the work in the release log and lets one event-loop turn pass before opening the gate.
- **T8 first run.** It used a wrong file path and ran no test: `t8-test-side-canonical-write-INVALID-wrong-path.log`.
- **Native-long invocation error.** `t-integration-green-native-long.log` (`7687fe23`) had 135 failures, all in `canonical-writer-package-smoke.integration.test.ts` at `seed()`: `expected 'broken' to be 'ready'`. The cause was the working directory, not the code:
  - Vitest ran with cwd `apps/harness` (through `pnpm --filter … exec`);
  - that file resolves `path.resolve("apps/harness/drizzle")` from cwd, so the path did not exist.
  This was reported to the coordinator before any rerun. One approved rerun ran from the repo root, on the same parent and patch (`7687fe23` reconstructed and re-checked): `t-integration-green-native-long-rerun-root.log`, 1127/1127.
- **jscpd.** Moving `timed()` into the fixture made `exclusiveLock` and `failedWith` a clone (`t-integration-duplicates.log`). Both moved into the conversation fixture (`t-integration-final-duplicates.log`: 0 clones).

### Busy margins (#94), round 2

From `t9-busy-and-b10-durations.log` (parent `2811b62`, clean tree):

| Wait | Configured | Measured |
|---|---|---|
| B10(a) save with a commit blocked by a reader | `busy_timeout` 5 s | 5552 ms |
| B10(c) save whose reconciliation read cannot run | 5 s, then read-only 2 s | 8699 ms |
| Save behind an exclusive lock | 5 s | 7384 ms |
| Writer read behind an exclusive lock | 5 s | 7417 ms |
| Read-only read behind a held lock | 2 s | 3187 ms |
| Read-only read through a 500 ms commit | — | 579 ms |

B10(c), at 8.7 s, comes closest to the 15 s native-long timeout.

### E1: the eight missing reds (U4)

Each red was reproduced at its recorded parent with its recorded patch, rebuilt from the session transcript. Every digest matches, so all eight are verified. Logs and patches are in `.../scratchpad/s2-reds/`.

| Step | Digest | Parent | Red |
|---|---|---|---|
| 1 | `b29909a8` | `741f0f5` | Module `./sqlite-busy.js` missing. |
| 2 | `0ef1f16f` | `c83414d` | The read answered `null`. |
| 3 | `68a612e9` | `96a7832` | 3 failed: the retry was broken (SQLITE_CONSTRAINT), the conflict saved, and paging was wrong. |
| 5 partial | `a0387828` | `031a578` | Four partial states read as valid. |
| 5 reader | `970351da` | `031a578` plus the step-5 tree | `readProjectConversationReadOnly` missing. |
| 6 | `7c922e62` | `3f1e526` | `WriterOwnerBusy` rejected instead of answering `command-busy`. |
| 7 | `bc1e2b14` | `dd6fe5c` | Four lock cases failed. |
| 8 | `560f455a` | `29bea84` | Four B10 cases failed. |

During the replay, a path-mapping bug once wrote to an old scratch script (`edit-s2-b10-fixture.cjs`). Nothing in the repository was touched, and the digest matched once the mapping was fixed.

### E2: step 8 green (an undisclosed change, now recorded)

The step 8 green `d8f381e1` re-checked `admissionClosed` in the slot. That broke five writer unit tests, because a plain `close()` must drain admitted work. The committed form therefore re-checks only `abandoned`: `b10b-queued-recheck-2.log`, restored `70c9e4e6`.

Two restored digests were not listed before: B11 `8579c425` (`b11-fence.log`) and B24 `f8470cf3` (`b24-settlement-slot.log`).

F1 now adds the failure flag, so a failed settlement also refuses queued work.

### E3: the B10(b) fault seam

The B10(b) close fault is injected in the fixture's transaction wrapper (`faultingClient` in `project-storage-upgrade-fixture.ts`), not at the classification seam that R2-C9 names. The wrapper now also fails `commit` and `rollback` without running them (U1).

### U2: read after abandonment

S2 proves only the primitive: `readProjectConversationReadOnly` and `withReadOnlyClient` read through a per-request read-only client (B25, T10). Nothing yet routes a read to that client after the writer's admission closes. That routing belongs to S3, in a CNV-B13 row (user decision).

### U3: G2 "for both paths" (a design-vs-result gap)

Abandonment covers only Conversation work. A settlement whose transaction close fails keeps the S1 retry-at-release (user decision). F1 closes the gap users would see: work queued behind that failure answers `writer-unavailable`.

## Round-2 heavy runs on `1b9ef39`

Run once each, from the repository root, in sequence, after the coordinator's go-ahead. There were no reruns, and nothing else ran in parallel. Every run exited 0.

Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/heavy-1b9ef39/`.

| Run | Command | Result | Duration | Log |
|---|---|---|---|---|
| 1 | `pnpm test:integration` | 70 files passed, 2 skipped; 2113 tests passed, 5 skipped, 0 failed | 509 s | `1-test-integration.log` |
| 2 | `pnpm test:e2e` | 11/11 passed | 120 s | `2-test-e2e.log` |
| 3 | `pnpm package:launch-smoke` | passed: "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." | 39 s | `3-package-launch-smoke.log` |
| 4 | `pnpm test:mutation:conversation:harness` | score **90.26** (break 80, high 90), up from 84.12. 398 mutants: 343 killed, 33 survived, 4 no coverage, 18 ignored; 89 tests | 761 s | `4-mutation-conversation.log`, `4-mutation-conversation.json` |

No timeouts and no Stryker worker crashes were logged.

Per-file scores (covered mutants), with the `5a85033` score in brackets:

| File | Score |
|---|---|
| `sqlite-busy.ts` | 100.00 (100.00) |
| `canonical-project-writer.ts` | 92.25 (83.74) |
| `conversation-store.ts` | 92.13 (90.91) |
| `canonical-writer-conversation.ts` | 87.67 (71.88) |
| `conversation-rows.ts` | 86.67 (86.67) |
| `conversation-save.ts` | 81.82 (81.82) |
| `conversation-errors.ts` | 33.33 (33.33) |

`conversation-errors.ts` is a very small file, so its score barely moves.

**Project-storage mutation not rerun.** Round 1 changed no file that `stryker.project-storage.config.json` mutates. As proof, `git diff --name-only ba2b381 1b9ef39` over that config's `mutate` paths is empty. Its score therefore stays 87.52, from `5a85033`. Round 2 reviewers rejected carrying that score forward (`candidate-workflow.md`: "a run on an earlier candidate never counts for a later one"), so it reruns on the final head; see Round 3.

The B10(c) save, at 8.7 s, is the case closest to the 15 s native-long budget (#94).

These heavy-run headers record the commit and CPU/RAM, but no tree digest. The tree was clean when the sequence started: `git status --short` was empty right before launch, as recorded in the session. From round 3 on, the header also records the changed-path count and the patch sha256.

## Review round 3 (candidate `ad63594`, bounded, user-approved)

Round 2 (three reviewers plus adversarial verification) closed every round-1 item. It found four verified concerns, A to D; the user approved this bounded round 3 (decisions log §32). The list is in the coordinator's `c1-s2-round2.md`. The logs are in `s2-round2/`, with an `r3-` prefix.

| Item | Commit | Red or binding (parent, patch, log) | Green |
|---|---|---|---|
| A: abandon an unfinished client when the work rejects (the check now runs in `finally`) | `41f32fa` | Red: `ad63594`, `cab2c9c8`, `r3-a-red.log`. A defect whose transaction left the client unfinished kept admission open: the next save answered `completed`. | `4c087683`, `r3-a-green.log` (35/35) |
| B: a failed settlement closes admission inside the slot, before the permit is released | `f8d42d0` | Red: `41f32fa`, `ec816db9`, `r3-b-red.log`. The test probes every microtask turn after the failure. Probe 3 took the free permit and reached the repository. | `3a5a1aaa`, `r3-b-green.log` (36/36); integration `r3-b-green-integration.log` (299/299); formatted final `886f5a84` |
| C: a non-busy repository rejection is rethrown on save and read | `f02055e` | Binding: rejection mapped to busy → fails. `7bd47c90`, `r3-c-mutation-non-busy-as-busy.log` | `966d25b9`, `r3-c-unit-green.log` (39/39) |
| Suggestion: read-path `WriterOwnerBusy` → `ConversationStorageBusy` | `f02055e` | Binding: mapped to broken → fails. `9062ffee`, `r3-read-busy-mutation-as-broken.log` | as above |
| Suggestion: `admissionClosed` after an abandonment (a command answers synchronously, without the repository) | `f02055e` | Binding: flag removed → fails. `5c798878`, `r3-abandon-admission-mutation.log` | as above |
| Suggestion: read-only `ROLLBACK` release | `f02055e` | Binding: release skipped → fails. `f0acd1e6`, `r3-rollback-mutation-skipped.log` | `1ded7656`, `r3-readonly-green.log` (15/15) |
| Suggestion: read-only close-failure tag | `f02055e` | Binding: close made untyped (`Effect.promise`) → fails. `41edb8b1`, `r3-readonly-close-mutation-untyped.log` | as above |
| Suggestion: reconciled status check (a reused save id answers `rejected` unchanged) | `f02055e` | Binding: `replayed: false` added to every found row → fails. `f9987240`, `r3-reconciled-status-mutation.log` | `2c2ab46c`, `r3-reconciled-green-2.log` (8/8) |

Two notes on the table:
- **B is deterministic.** Microtask order is fixed, so the probe sweep reproduces the gap every time. The fix keeps `WriterOwnerBusy` → `command-busy` with admission open (existing pin, still green).
- **The first reconciled-reuse run failed in the test itself.** Its foreign row's fingerprint broke the `save_fingerprint` sha256 check: `r3-reconciled-green.log`. The row now uses a 64-hex fingerprint.

### Weaker reds rebound with scaffolds

Both reds were rebound in a temporary worktree (since removed). Each first applied its recorded patch, which matched its digest, then added the smallest scaffold that reaches an assertion. Logs and patches are in `.../scratchpad/s2-reds/`.

| Red | Parent | Base digest | Scaffold | Scaffolded digest | Red now |
|---|---|---|---|---|---|
| Step 5 reader | `031a578` | `970351da` (match) | An exported `readProjectConversationReadOnly` stub with the real signature, answering `{ conversation: null }` | `b9040a1f` | Assertion: got `conversation: null`, expected revision 101 and nextCursor 100 (`step5-reader-scaffolded-red.log`) |
| Step 8 B10(a) | `29bea84` | `560f455a` (match) | A commit or close failure returns `{ status: "commit-uncertain" }`; `saveConversationMessage` passes it through unreconciled | `60e176a5` | Assertion: got the unreconciled `commit-uncertain`, expected `ConversationStorageBusy`; the two "unknown client state" cases fail the same way (`step8-b10a-scaffolded-red.log`) |

The original reds stay recorded: a missing export, and a raw `SQLITE_BUSY` rejection. The scaffolded runs are the assertion-level proof.

### Project-storage mutate paths

The real path list and both diffs are in `s2-round2/project-storage-mutate-diff-f02055e.log`, at HEAD `f02055e`, clean tree. It lists the 13 paths from the `mutate` list. Both `git diff --name-only ba2b381 HEAD` and `git diff --name-only 741f0f5 HEAD` over them are empty. The earlier `heavy-1b9ef39/project-storage-mutate-diff.log` was rewritten with the same real list at `41f32fa`. The coordinator reruns both mutation configs on the final head.

### Gates of record (final code head `f02055e`, clean tree)

Run at `f02055e` with no local changes (patch digest `e3b0c442`, the empty diff):

| Gate | Result | Log |
|---|---|---|
| `pnpm check` (format, lint, typecheck, unit, boundaries) | pass | `record-f02055e-check.log` |
| `pnpm check:duplicates` (jscpd) | 0 clones | `record-f02055e-duplicates.log` |
| `pnpm check:dead-code` (knip) | pass | `record-f02055e-dead-code.log` |
| `pnpm check:architecture` | pass | `record-f02055e-architecture.log` |
| CodeScene | 10 on every file touched in round 3: `canonical-project-writer.ts`, `canonical-writer-conversation.ts`, `conversation-store.ts`, `canonical-project-writer.test.ts`, `conversation-store.integration.test.ts`, `conversation-uncertain-commit.integration.test.ts`; `pre_commit_code_health_safeguard` passed on each commit | `r3-*-codescene.log` |

This evidence-only commit changes no code, so these gates stand for the next head as well.

## Final-head heavy runs on `ac6569c`

Run after the coordinator's go-ahead, from the repository root. The five runs ran in sequence, once each, with no reruns and nothing else in parallel. Every run exited 0.

Every log header records the same clean tree: commit `ac6569c`, 0 changed paths, and patch sha256 `e3b0c442…` (the empty diff).

Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/heavy-ac6569c/`.

| Run | Command | Result | Duration | Log |
|---|---|---|---|---|
| 1 | `pnpm test:integration` | 70 files passed, 2 skipped; 2115 tests passed, 5 skipped, 0 failed | 509 s | `1-test-integration.log` |
| 2 | `pnpm test:e2e` | 11/11 passed | 111 s | `2-test-e2e.log` |
| 3 | `pnpm package:launch-smoke` | passed: "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." | 40 s | `3-package-launch-smoke.log` |
| 4 | `pnpm test:mutation:project-storage:harness` | score **87.52** (break 80, high 90). 3110 mutants: 876 killed, 29 timeout, 115 survived, 14 no coverage, 2076 ignored; 152 tests | 3240 s | `4-mutation-project-storage.log`, `4-mutation-project-storage.json` |
| 5 | `pnpm test:mutation:conversation:harness` | score **92.45** (break 80, high 90). 402 mutants: 355 killed, 27 survived, 2 no coverage, 18 ignored; 96 tests | 815 s | `5-mutation-conversation.log`, `5-mutation-conversation.json` |

No timeouts and no Stryker worker crashes were logged.

Project-storage per-file scores:

| File | Score |
|---|---|
| `project-storage-protocol.ts` | 100.00 |
| `process-fatal-diagnostics.ts` | 100.00 |
| `sqlite-schema-expression.ts` | 94.19 |
| `application-database-migration.ts` (lines 142-284) | 92.39 |
| `generated-migrations.ts` | 92.31 |
| `project-storage-manifest.ts` | 88.89 |
| `project-storage-upgrade-eligibility.ts` | 85.86 |
| `database-schema-verifier.ts` | 83.53 |
| `project-storage-node-adapters.ts` (line ranges) | 70.83 |
| `project-storage-upgrade-recovery.ts` | 64.91 |

The three spec files have no scored mutants.

Conversation per-file scores, with the `1b9ef39` score and then the `5a85033` score in brackets:

| File | Score |
|---|---|
| `sqlite-busy.ts` | 100.00 (100.00, 100.00) |
| `conversation-store.ts` | 93.70 (92.13, 90.91) |
| `canonical-project-writer.ts` | 93.23 (92.25, 83.74) |
| `canonical-writer-conversation.ts` | 93.15 (87.67, 71.88) |
| `conversation-rows.ts` | 86.67 (86.67, 86.67) |
| `conversation-save.ts` | 86.36 (81.82, 81.82) |
| `conversation-errors.ts` | 33.33 (33.33, 33.33) |

`conversation-errors.ts` is a very small file, so its score barely moves.

**Item D closed.** The project-storage score now comes from a run on the final head, not a carried-forward one. It equals the `5a85033` score (87.52), as expected, since no file it mutates changed in S2 (`s2-round2/project-storage-mutate-diff-f02055e.log`).

The known project-storage survivors stay as recorded and pending review: `project-storage-upgrade-recovery.ts` at 64.91 and `project-storage-node-adapters.ts` at 70.83.
