---
date: 2026-10-09T01:40:00+0100
author: Pedro Mesquita
repository: slopstop
branch: fix/registry-witness-race
commit: 18510d6
status: ready
tags: [evidence, tdd, registration, application-database]
---

# Registry witness race — TDD evidence

Branch `fix/registry-witness-race` from local `main` `2c6b3d2`. Trigger: the pre-push `check:deep` on local `main` failed one e2e test, `apps/desktop/tests/e2e/registration.test.ts:141`. The add flow on a fresh userData showed "Ragnarok couldn't add this repository" with reference `REGISTRY_MISSING_WITH_WITNESS`. User decision (relayed by the coordinator): the one-owner fix.

## Root cause

`apps/harness/src/registration/registry-database.ts` `prepareFile` (at `2c6b3d2`, lines 79-97) made two separate reads:

1. it saw `application.db` missing;
2. it then saw the root directory non-empty, and refused with `REGISTRY_MISSING_WITH_WITNESS`.

On a fresh install, the startup Project listing (`project-listing.ts:219`) creates the database through the shared application database authority. An add that starts while the listing is still creating it can see the new database land between the two reads. It then reports that new database as a witness of lost state. The authority already stated the opposite rule: a fresh creation still in flight must not be seen as a witness. The leftover proof folder of the failed run supports this: the database was created and migrated about 0.43 s after launch, and it held no registration rows.

## Change

- `application-database-authority.ts` owns the missing-file decision. Its `prepare` runs one decision at a time (an Effect `Semaphore` of one permit, the module's admission idiom). It takes a root-witness policy:
  - `refuse` (used by `openCurrent`, the registry's path): a missing database under a root that holds entries is `REGISTRY_MISSING_WITH_WITNESS`, unless the entries are this authority's own fresh creation in flight;
  - `ignore` (used by `ensureCurrent`, Storage's path): the witness rule is unchanged (see below; its concurrency changed).
- `openCurrent` first awaits an initialization in flight, as `ensureCurrent` does. A fresh creation it starts is shared in the same slot, so later callers join it instead of racing it. It still opens one client per call.
- `registry-database.ts` `prepareFile` keeps only the plain-entry checks and the existing-only missing check. The directory read is removed. (Superseded by the T5 fix in `05a0e99`: `requirePlainEntries` keeps only the plain-entry checks, and the existing-only missing check moved to the authority.)

**Storage's witness rule is deliberately unchanged; its concurrency is not.** `ensureCurrent` is called by Project Storage (`project-storage-node-adapters.ts` `ensureApplicationDatabase`). Storage has its own precise prior-state witness scan, and it answers `PRIOR_STATE_WITNESS` with the kinds it found. Applying the coarse root-non-empty rule there would replace that precise diagnostic with `REGISTRY_MISSING_WITH_WITNESS`, so Storage's path uses the `ignore` policy. The rule still has one owner (the authority's `prepare`), and the policy argument selects it. Decision approved by the coordinator.

Storage's concurrency did change, and the coordinator accepted it (round-1 decision D1): one creation at a time is the point of the one-owner fix. `ensureCurrent` now joins a fresh creation that `openCurrent` shares. It waits for that creation and takes its outcome, success or failure, instead of starting a second initializer beside it. The first version of this file said "Storage's path is deliberately unchanged"; that was wrong for concurrency.

This holds only for callers that arrive after the creation is registered (corrected in the final fixes, L4). A caller in create mode that checked for an initialization before the registration does not join. That includes a registry `openCurrent` queued on the decision permit, and Storage's `ensureCurrent`, which registers its own initialization first. Once it decides, the fresh creation's exemption applies (`createdEmpty`): it answers `present` and opens its own client beside the creator, as a second initializer. T1 pins this for two registry calls: two clients open and both callers succeed. No test pins the Storage variant on its own. This is recorded as accepted behaviour (the coordinator's L4 option), not hidden. The L1 fix below removes only the same-tick case between two `ensureCurrent` calls, and between `ensureCurrent` and a registration in the same tick.

## Red-green

Logs are in the implementer's scratchpad `witness/`. Each first line carries HEAD plus the working-tree state.

| Test | Red | Green |
| --- | --- | --- |
| R1 `registry-witness-race.integration.test.ts` "opens the registry when the authority's own fresh creation lands between the missing check and the witness check" (through `withRegistrationDatabase`; a `node:fs/promises` `readdir` hook, scoped to this file, lets the in-flight creation land inside the window) | `r1-red.log`: the add answers `{ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" }`, the exact e2e verdict, and the startup listing opens | `r1-r2-green.log`, `green-integration.log` |
| R2 `application-database-authority-cases` "lets openCurrent join an initialization already in flight" | `r1-r2-red.log`: `openCurrent` settled at once (no join) | same |
| R3 same file, "refuses a missing database under a witnessed root on the registry path only" (pins the policy: `openCurrent` refuses and creates nothing; `ensureCurrent` still creates; the marker is kept) | `r3-on-old-src.log` (tests on the `2c6b3d2` source): fails, because the authority had no root rule | `r3-pin.log` |

R1's bounded fallback (`settledWithin`, 500 ms) opens the gate when no directory read happens. It stays inside the default 15 s test timeout, and no timeout was raised. The gated-first-client authority setup moved to `application-database-gated-fixture.ts` and is shared with the existing case "lets a second initializer proceed while the first is still creating a fresh database", whose assertions are unchanged.

## Existing witness guards

| Guard | Why it stays green | Log |
| --- | --- | --- |
| `application-database-authority-cases` "refuses to recreate an application database it already observed" | same `observed` branch in `prepare` | `green-integration.log` |
| `registration-preparation` "refuses missing registry replay without observing or recreating installation storage" | existing-only path, still in `registry-database.ts` | `green-registration.log` |
| `registration-list` witnessed root (marker file, no database) | now refused by the authority as `ApplicationDatabaseFault`; `registryFailure` maps it to the same `{ pending-recovery, REGISTRY_MISSING_WITH_WITNESS }`; no database created, marker kept | `green-registration.log` |
| `project-registration` witness case | same mapping | `green-registration.log` |

Targeted runs: harness integration files touching the authority (`application-database-authority*`, the new R1 file, `project-storage-upgrade*`): 9 files, 88 passed. Registration lane files (`registration-list`, `registration-preparation`, `project-registration`): 3 files, 132 passed.

## Gates

`pnpm check` exit 0 (2441 unit tests); `check:duplicates` 0 clones; `check:dead-code` exit 0; `check:architecture` exit 0; CodeScene 10.0 on every changed file (a first `decideMissingFile` at cc 9 was split into `createMissing`).

Round-1 heavy runs (coordinator go-ahead, at `3d3e9ee`): full integration 2036 passed, 5 skipped (`full-integration.log`); e2e 11 passed, including `registration.test.ts:87`, `:141` and `:179` (`e2e.log`). One green e2e run does not prove an intermittent race is gone; R1 is the deterministic proof. Coverage and mutation are not planned.

## Candidate review round 1 fixes (commit `b22501e`)

Logs are in the implementer's scratchpad `witness/r2/`.

### Red-green binding

| Run | Tree | Result |
| --- | --- | --- |
| `bound-red-round1.log` | `apps/harness/src` at `2c6b3d2`, tests at `3d3e9ee` (test patch `2c6b3d2..3d3e9ee` digest `eb75478bcfc1a0c3`) | R1, R2 and R3 fail. R1's add answers `{ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" }` |
| `bound-red-round2.log` | `apps/harness/src` at `3d3e9ee`, tests at `b22501e` (test patch `3d3e9ee..b22501e` digest `3a2763f65c81291b`) | only "ends the fresh-creation exemption when that creation fails" fails (the open recreated the database) |
| `bound-green.log` | clean `b22501e` | 18 passed |

The earlier round-1 logs (`witness/r1-red.log`, `r1-r2-red.log`, `r3-on-old-src.log`) ran on working-tree bytes before formatting. The bound runs above replace them as the red proof.

### Changes

| Item | Change | Proof |
| --- | --- | --- |
| D1 | Evidence corrected (above). Pins: "lets Storage's ensureCurrent join the registry's fresh creation instead of racing it" (it stays pending, then answers `current` with one client opened); "passes the registry's failed fresh creation on to Storage's ensureCurrent / the registry's openCurrent and removes its empty file" | green in `bound-green.log`. The removal is not vacuous: with the `unlink` disabled, both cases fail (`t4-unlink-mutation-red.log`) |
| D2 | `discardFailedCreation` ends `createdEmpty` when the sole initializer discards a failed fresh creation. With another initializer still in flight, the creation and its exemption stay with that one, whose own success or failure ends it | "ends the fresh-creation exemption when that creation fails": red in `bound-red-round2.log`, green after |
| T1 | "exempts the authority's own creation in flight from the witness rule when two callers decide in turn": two registry calls start in the same tick, so the second decides while the first creation is in flight and opens its own client | removing `if (createdEmpty) return;` in `refuseWitnessedRoot` turns it red (`t1-mutation-red.log`: the second caller is refused, so 1 client opens instead of 2) |
| T2 | R1's `untilPresent` throws when its attempts run out | — |
| T3 | "answers broken, not a witness, when the root cannot be listed": an `EACCES` root listing gives `{ status: "broken", code: "INTERNAL_FAILURE" }`, and no `application.db` is created | green (characterization) |
| T4 | covered by the D1 failure pins, for both joiners: both reject with the creator's own error object, `application.db` is removed, and only one client opens. An unhandled rejection would fail the Vitest run | green |
| T5 | "lets an open-only openCurrent wait for a fresh creation in flight, then open it"; "lets callers that join an in-flight 'absent' answer create or stay absent by their own policy" (an `lstat` hook holds `ensureCurrent({ createIfMissing: false })`; a creating `openCurrent` then creates, and an open-only one answers absent) | green (characterization) |
| Q1 | `missingWithWitnessFailure` in `application-database-migration.ts` is the one owner of the failure value, and `ApplicationDatabaseFailure` derives from it. The authority (`requireExistingFile`, the witness rule) and `registry-database.ts` (both refusals) build their faults from it | `pnpm check` |
| Q2 | The round-1 brief note "a joiner of a failed initialization retries its own prepare" was false. `joinInFlight` passes the creator's rejection on, and I kept that: the joiner gets the real cause, and the creator's cleanup has already run. The T4 pins assert it | — |

### Authority test `:128`

"admits a fresh Project create behind the registry's initial migration on one application database" still passes, and its name is still accurate: the create waits behind the registry's migration and does not fail busy. The mechanism changed. Storage's `ensureCurrent` now joins the registry's shared creation, so it no longer starts a second migration transaction that waits on the admission semaphore. Admission under a held write transaction stays covered by "admits one application database write transaction until the worker confirms it closed".

### T5 analysis: the existing-only pre-check (`registry-database.ts` `requireExistingRegistryFile`)

Yes, in principle. The existing-only mode checks for `application.db` with its own `lstat` before it reaches the authority, so it neither joins nor waits for an in-flight creation. An existing-only operation that runs while another caller's fresh creation is in flight, before the file exists, answers `REGISTRY_MISSING_WITH_WITNESS`.

The product's flows do not reach it today. Every existing-only caller either runs after an initialize-or-open step of the same flow (which completes the creation before it returns) or acts on an already listed Project (whose database exists):
- repository trust's re-open (`registration-registry.ts` `prepareAndRun` initializes first);
- existing registration and the identity journal (both after trust);
- preparation and the publish step;
- list visibility and registered-Project selection (a listed Project).

A renderer could still call list visibility with a crafted id on a fresh install. Without a creation in flight, that already answers the same witness (unchanged behaviour), so the in-flight case gives no new answer.

Proposed fix (built in `05a0e99` after the coordinator's decision; see the next section):
1. Drop the `lstat` missing-check from `requireExistingRegistryFile`, and run its plain-entry checks only when the file is present. `openCurrent({ createIfMissing: false })`, which joins, then decides, and `withRegistrationDatabase` keeps its one refusal when no client comes back.
2. Register `openCurrent`'s shared creation inside the decision permit. An open-only caller that decides after a creation starts but before it is registered then also waits instead of answering absent.

### Targeted runs and gates

- Harness integration (`application-database-authority*`, the R1 file, `project-storage-upgrade*`, and the Storage `PRIOR_STATE_WITNESS` and failed-initialization files `project-storage-create`, `project-storage-lifecycle`, `project-storage-open-recovery`, `project-storage-application-client`): 13 files, 188 passed (`targeted-integration.log`).
- Registration lane (`registration-list`, `registration-preparation`, `project-registration`, `registration-bootstrap-guards`): 4 files, 141 passed (`targeted-registration.log`).
- `pnpm check` exit 0 (2441); `check:duplicates` 0 clones; `check:dead-code` exit 0; `check:architecture` exit 0 (`architecture.log`).
- CodeScene `pre_commit_code_health_safeguard` passed, with 6 eligible files and no issues (`codescene.log`).
- Full integration and e2e after round 2: each needs the coordinator's go-ahead.

## T5 fix (commit `05a0e99`)

User decision (relayed by the coordinator): fix T5 now, as proposed. Logs are in the implementer's scratchpad `witness/r3/` (and `witness/r4/` for the A/B diagnostic).

### Change

- `registry-database.ts`: `prepareFile` and `requireExistingRegistryFile` become `requirePlainEntries`. It checks the root and `application.db` as plain entries only when each is present, in both modes. Whether a missing database is created, refused as a witness, or waited for is the authority's call. `withRegistrationDatabase` keeps its one refusal (`missingWithWitnessFailure`) when `openCurrent` returns no client.
- `application-database-authority.ts`: `openCurrent`'s shared creation is registered inside the decision permit (`createMissing` with `share`). An open-only registry caller that decides while that creation is in flight gets `join` (`missingWithoutCreating`), waits for it, and decides again. Storage's `ensureCurrent` path is unchanged (`share: false`).

### Red-green binding

| Run | Tree | Result |
| --- | --- | --- |
| `bound-red.log` | `apps/harness/src` at `b22501e`, tests at `05a0e99` (test patch `b22501e..05a0e99` digest `bee697310bb309bd`) | 2 failed, 20 passed. "lets an existing-only registry operation wait for another caller's fresh creation, then open": the existing-only call settles early with `{ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" }` instead of waiting and opening. "lets an open-only caller that decides between a creation and its registration wait for it": it settles early and opens nothing |
| `bound-green.log` | clean `05a0e99` | 22 passed |

Pin: "never creates a database for an existing-only operation on $name" (an empty root and an absent root). Both answer the witness, create no `application.db`, and open no client.

### Targeted runs and gates

The targeted runs and gates ran on the working tree that became `05a0e99` (first line of each log: `417344f` + the T5 fix working tree). `bound-green.log` is the run on the clean commit.

- Harness integration (the same 13 files as round 1): 192 passed (`targeted-integration.log`).
- Registration lane (all 10 lane files): 187 passed (`targeted-registration.log`).
- `pnpm check` exit 0 (2441); `check:duplicates` exit 0; `check:dead-code` exit 0; `check:architecture` exit 0.
- CodeScene `pre_commit_code_health_safeguard` passed, with 3 eligible files and no issues; `application-database-authority.ts` scores 10.0 (`codescene.log`).

### Heavy runs (coordinator go-ahead, at `05a0e99`)

**Full integration: RED** (`full-integration.log`, run once, not rerun): 2 failed, 2046 passed, 5 skipped. Both failures are in the `harness-registration` lane:
- `project-registration` "rolls back the registry extension at before-metadata": timed out at 15000 ms (15007 ms), then `EBUSY: resource busy or locked, unlink '...\pc-s1-migration-rollback-AtjZGO\application.db'` during cleanup;
- `registered-project-selection` "runtime switches between two registered Projects and releases the old writer without creating Storage": timed out (17702 ms).

**A/B diagnostic** (coordinator go-ahead, user approval, idle machine, nothing else running). Only the two failing files, in the registration-lane config, alternating 5 runs on `417344f` (before the T5 fix, in a temporary worktree since removed) and 5 on `05a0e99`. Logs: `witness/r4/run{1..5}-{A,B}.log` and `.json` (HEAD on the first line), `table.md`, `ab.sh`.

| Run | Side | Result | Tests | Total (s) | before-metadata (ms) | switch Projects (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A `417344f` | pass | 119/119 | 69.4 | 113 | 6431 |
| 1 | B `05a0e99` | pass | 119/119 | 69.4 | 119 | 7276 |
| 2 | A | pass | 119/119 | 68.4 | 117 | 6491 |
| 2 | B | pass | 119/119 | 68.0 | 113 | 6387 |
| 3 | A | pass | 119/119 | 69.6 | 113 | 6675 |
| 3 | B | pass | 119/119 | 68.8 | 120 | 6745 |
| 4 | A | pass | 119/119 | 70.1 | 118 | 7107 |
| 4 | B | pass | 119/119 | 68.5 | 156 | 6622 |
| 5 | A | pass | 119/119 | 69.2 | 118 | 6488 |
| 5 | B | pass | 119/119 | 68.2 | 113 | 6500 |

Means: A 69.4 s total, before-metadata 116 ms, switch 6638 ms; B 68.6 s, 124 ms, 6706 ms.

Verdict, accepted by the coordinator: issue #94, with no measurable change from `05a0e99`.
- The coordinator's suspicion was that `05a0e99` now serialises opens of a present database. Every `openCurrent` on a present database does take the decision permit, but that was already true at `3d3e9ee` (round 1, full integration green), and `05a0e99` does not change it. On that path the permit holds one `lstat`; opening, foreign keys and migration run after its release, so opens still overlap.
- The before-metadata case uses a present previous registry with an injected migration failure. `createdEmpty` stays false, so the T5 code (join, share, `discardFailedCreation`) is not on its path. The #94 timeouts reported earlier (`8138ed9`, `e1c0a99`) predate this branch.

Caveats:
- before-metadata takes about 115 ms idle but reached 15000 ms in the full run, about 130 times longer. That looks like a stalled step, not a general slowdown (the #94 question of whether a hung step is involved).
- Neither side reproduced the timeout on an idle machine. "No measurable change" is not "proven unrelated".

**e2e: green** (`e2e.log`, run once): 11 passed, including `registration.test.ts:87`, `:141` and `:179`.

The full suite was not run again; the pre-push hook runs it at push time.

## Final fixes after review round 2 (commit `18510d6`)

User decision (relayed by the coordinator): fix all leftovers in one final commit set, with no third review. Logs are in the implementer's scratchpad `witness/r5/`.

### Changes

| Item | Change | Proof |
| --- | --- | --- |
| L1 | `joinInFlight` is synchronous when nothing is in flight. `ensureCurrent` reads the initialization slot and registers its own with no pause between them. Two `ensureCurrent` calls in the same tick now share one fresh creation. A Storage call that starts in the job where the registry's creation registers no longer replaces that creation in the slot. Before, a later existing-only registry open joined Storage's `absent` and answered `REGISTRY_MISSING_WITH_WITNESS`; it is reachable, as the red shows. | "lets two Storage initializers started in the same tick share one fresh creation" (red: `opens` 2, not 1). "keeps the registry's fresh creation joinable when Storage starts in the tick it is registered" (a `mkdir` hook settles the root's creation and starts Storage's `ensureCurrent({ createIfMissing: false })` in the same job; red: the existing-only open settles at once with `{ status: "pending-recovery", code: "REGISTRY_MISSING_WITH_WITNESS" }`) |
| L2 | The initialization slot is an Effect `Deferred`, completed with the run's exact outcome by `publish`, as in `project-storage-application-client.ts`. The hand-rolled resolver and its rejection guard are gone. The D1 failure pins still pass: the joiners' rejection equals the creator's error (`toEqual`, so equality of value, not proof of identity). | `bound-green.log` |
| L3 | `application-database-authority-cases` "lets a second initializer proceed while the first is still creating a fresh database" is renamed "lets a later initializer join a fresh database still being created instead of failing" (assertions unchanged). R1's hook comment now says the add joins and never lists the root, so the bounded fallback opens the gate; the hook stays to reproduce the race on the old code. | — |
| L4 | The Change section above: the `prepareFile` line is marked superseded by T5, and the D1 paragraph is limited to callers that arrive after registration, with the T1 second initializer recorded as accepted behaviour. | — |
| L5 | "refuses $name in place of application.db as broken in $mode mode" (a directory and a junction, each in `initialize-or-open` and `existing-only`, through `withRegistrationDatabase`): `{ status: "broken", code: "INTERNAL_FAILURE" }` and no client opened. | It is green on the old code too, so it is a characterization pin. It is not vacuous: with the `application.db` plain-file check in `requirePlainEntries` disabled, all 4 cases fail, because a client opens (`l5-mutation-red.log`) |

### Red-green binding

| Run | Tree | Result |
| --- | --- | --- |
| `bound-red.log` | `apps/harness/src` at `e88f1b9`, tests at `18510d6` (test patch `e88f1b9..18510d6` digest `84a6abeebde4ed59`) | 2 failed, 26 passed: the two L1 tests |
| `bound-green.log` | clean `18510d6` | 28 passed |

`red.log` is the same red on the working tree before the fix, with the same test digest.

### Targeted runs and gates

- Harness integration (the same 13 files as round 1): 198 passed (`targeted-integration.log`).
- Registration lane, all 21 files (`vitest.registration.config.ts`), three runs, none hidden:
  1. With the fix: **RED**, 24 failed and 212 passed, in 413 s (`targeted-registration.log`). The failures were 15 s timeouts plus EBUSY or ENOTEMPTY on cleanup, across 8 files; `registered-project-selection` failed 9 of 9. Even the non-test phases were slow: transform 5.86 s, import 18.66 s.
  2. Without the fix (`src` at `e88f1b9`, same tests): 236 passed in 161 s; transform 1.36 s, import 8.93 s (`registration-lane-head.log`). `registered-project-selection` alone with the fix: 9 passed (`selection-fix.log`).
  3. With the fix again, CPU sampled every 10 s: 236 passed in 157 s; transform 2.21 s, import 9.34 s; CPU mean 19 %, max 31 % (`registration-lane-fix2.log`, `cpu-lane-fix2.log`).

  Reading: run 1 matches the #94 load mode. Its transform and import phases, which the change does not touch, were 2 to 4 times slower, and the same tree passed at normal speed in run 3. The CPU was not sampled during run 1, so the load there is inferred, not measured.
- `pnpm check` exit 0 (2441); `check:duplicates` 0 clones; `check:dead-code` exit 0; `check:architecture` exit 0.
- CodeScene `pre_commit_code_health_safeguard` passed, with 3 eligible files and no issues; `code_health_review` gives 10.0 for the authority and both test files (`codescene.log`).
- Full integration and e2e were not run; the pre-push hook runs them.
