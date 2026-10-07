---
date: 2026-10-07T20:20:00+0100
author: Pedro Mesquita
repository: slopstop
branch: feat/c1-0-s5-deep-review-fixes
commit: bde79ff
status: ready
tags: [evidence, tdd, c1-0, s5]
---

# C1-0 S5 — deep-review fixes: TDD evidence

Branch `feat/c1-0-s5-deep-review-fixes` from `main` `3b833e1`. Source: `.rpiv/artifacts/reviews/2026-10-07_16-47-49_2a19d40-e1c0a99-c1-0-staged-upgrade.md`. Brief: the coordinator's S5 brief (user approved: the 9 important findings plus Q49 and Q50). I1 mechanism: option B (user choice relayed by the coordinator).

Lane: rigorous. The parent design slices were rigorous, and the S5 change set touches IPC, the preload, the protocol and the storage-upgrade paths.

Red/green logs are under the implementer's scratchpad `s5/` (`*-red.log`, `*-green.log`). The gate logs carry the SHA on their first line.

| Item | Commit | Change (file:line at HEAD) | Red | Green |
| --- | --- | --- | --- | --- |
| I2 / Q11 | `8524c8b` | `apps/harness/src/storage/project-storage-upgrade-node-adapter.ts` `unfinishedUpgradeRows`: a busy registry throws `ProjectStorageUnavailableError(projectStorageUpgradeBusyMessage)` | `project-storage-upgrade-steps…`: "a busy registry answers busy" resolved `undefined` | 6/6 |
| Q8 | `10e48bc` | `apps/harness/src/storage/application-database-migration.ts` `requireUpgradeRelationships`: `r.project_id IS NOT u.project_id` is corrupt | two new rows (in-progress and completed marker of another Project) answered `"current"` | 11/11 |
| Q14 | `b7d15d8` | `project-storage-upgrade-pipeline.ts` `releaseOpening`: a release failure answers broken "Project Storage opening release failed." | store unit test: raw `Injected opening release failure.` escaped | 36/36 |
| I1 / Q7 (option B) | `470d1cc` | `apps/harness/src/harness-runtime.ts` `stopCanonicalThenStorage`; `active-project-coordinator.ts` `holdsProject`; `canonical-project-application.ts` | runtime unit: "stops Storage together … while no Project is held" fails on the old runtime; coordinator `holdsProject` test fails without it; integration "a quit during a running upgrade stops it cooperatively" saw marker `completed` | runtime 92/92, coordinator + application 205/205, upgrade runtime 20/20 |
| I1 held order | `470d1cc` | same | "stops Storage only after canonical release while a Project is held" is a regression guard; it passes on both old and new code | — |
| Q13 | `470d1cc` | pipeline `committingStep` for the switch; the post-switch checkpoint is skipped once the owner stops | "answers upgraded when the owner stops after the switch committed" got `unavailable` | upgrade + failure files 51/51 |
| Q4 | `109290d` | `apps/desktop/src/main/harness-supervisor.ts` `#quietObservation`: a stopping child keeps only the upgrade-line forwarder until exit | "forwards upgrade lines written during shutdown until the child exits" got no forwarded line | 35/35 |
| Q18 | `27bf536`, `1c49633` | `project-storage-filesystem-authority.ts` `projectRootPath` and `upgradeOutputNames`. In round 1 they served proof and removal, and the creation paths used only `projectRootPath`. In round 2 (`1c49633`) the creation paths also derive their `.staging-<id>` and `<id>` names from `upgradeOutputNames` | refactor, no behaviour change | recovery, directories and failure files 45/45 |
| Q9 | `3d7af35` | `tests/integration/local-database-worker-client.integration.test.ts` read-only test | shown red with `readOnly` removed from the worker's `DatabaseSync` open (write resolved) | 1/1 |
| Q38 | `e8976ca` | "declares first…" records staging absence at `after-backup-copied` / `after-backup-verified` | shown red by running `buildTarget` before `backupSource` | 1/1 |
| Q39 | `e8976ca` | "keeps an unfinished upgrade on a plain opening, which answers recovery-required" | shown red by making `open` call `discardUnfinishedUpgrade` | 1/1 |
| I3 (+Q26–Q28) | `59244f8` | `packages/protocol/src/availability-messages.ts` (one owner); `storageBusy` row; `project-upgrade-outcome.ts` maps busy to it; coordinator and bridge read the shared texts; protocol version 6 → 7 | runtime "a busy source" expected the busy text and got "Project Storage is unavailable." | unit 2427/2427; runtime, harness-runtime and activation integration 31/31; version-pinned fixtures 231/231 |
| Q49 | `beabbac` | `apps/desktop/src/renderer/upgrade-problem.tsx`: "Try again" only when `diagnostic.retryable` | six rows marked `retryable: false` still showed it | desktop 654/654 |
| Q50 | `beabbac` | `use-project-upgrade.ts` `needsUpgrade` also requires a healthy runtime | "does not update a migration-required canonical database with a runtime needing recovery" sent an upgrade | desktop 654/654 |

## Oracle changes (call these out to the user)

- `harness-supervisor.test.ts` "removes child process observers on stop and exit": after `stop()`, stdout now keeps one listener (the upgrade-line forwarder) until exit. It used to have none. Raw output is still not logged at info or error. Required by Q4.
- `project-upgrade.test.tsx` "shows a false %s success as a broken update": `storageBroken` is not retryable, so the panel shows no "Try again". It used to show it. Required by Q49. The design's F3 is superseded (append-only Follow-up).
- `project-upgrade.test.tsx` "shows the panel for %s": "Try again" now follows `row.retryable`, not `status === "refused"`.
- `project-upgrade-runtime.integration.test.ts` "a busy source": the result carries the new `storageBusy` row (I3).
- `protocol.test.ts` design table: the `storageBusy` row is appended, and `protocolVersion` is pinned at 7 everywhere.
- The test-composed upgrade runtime (`project-upgrade-runtime-fixture.ts`, seam b) now passes the fixture's Storage owner as the runtime's `projectStorageApplication`, so the runtime stops it as the process runtime does.

## Documentation

- `harness-runtime.ts` shutdown comment rewritten. Correction from review round 1: the old canonical-before-Storage order is also stated in `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md:11127` and `.rpiv/artifacts/evidence/2026-10-03_effect-unit2-lifecycle-plan.md:25,66`. Those texts stay true while a Project is held, which keeps the old order. With no Project held, Storage now stops together with the canonical application, and a canonical failure no longer withholds the application database once Storage stopped (round 2). They are historical records and were not edited.
- ADR 0005: one refinement line in the staged-upgrade amendment, covering the window rule, "Try again", the busy text and protocol 7, the quit behaviour, upgraded after the switch, and a foreign marker being corrupt.
- Append-only Follow-ups were added to `2026-10-06_02-02-21_upgrade-failure-and-recovery.md`, `2026-10-06_13-20-24_upgrade-request-and-window.md` (F3 and F5 superseded) and `2026-10-06_18-48-25_upgrade-window.md`.

## Gates at `fc36203`

`pnpm check` (format, lint, typecheck, 2428 unit tests, boundaries), `check:dead-code`, `check:duplicates` (0 clones) and `check:architecture` all exit 0. The CodeScene change set against `3b833e1` passed with no issues (after `22de66f` removed two jscpd clones and `fc36203` split four Complex Methods).

**Not run (they need the coordinator's go-ahead):** e2e, package launch-smoke, mutation and the full integration suite. Only the targeted integration files listed above were run.

## Limits and notes

- I2: a busy marker lookup answers busy with no `discard-failed` diagnostic. The event schema needs an upgrade id, and none is known before the marker has been read. *(Superseded by review round 2: a non-busy unreadable marker query answers broken, and a typed registry failure passes through unchanged, both without a discard-failed line; see ADR 0005's round-2 refinement line.)*
- Q50 checks runtime health only. A safe-mode result with a null source generation still sends an upgrade, which the harness refuses (`PROJECT_UPGRADE_NOT_ELIGIBLE`). The renderer fixtures use a null identity throughout.
- I1: a single long SQLite statement (for example `VACUUM INTO`) is not interrupted in the middle. The stop takes effect at the next step boundary, and the desktop's 5 s kill still applies.
- `holdsProject` is optional on the coordinator and application ports. When it is missing, the port is treated as holding a Project, so the shutdown order stays the old one.

## Review round 2 (last round; brief `s5-round2-brief.md`; user decisions U5–U7)

Red/green logs are in the implementer's scratchpad `s5r2/`. The red/green logs named in the table carry their identity on the first line: HEAD, plus a digest of the working-tree patch for test-only or mutated runs. *(Correction, round 3: seven exploratory logs have no identity line: `busy-integ`, `busy-registration`, `busy-unit`, `codescene-refactor-integ`, `items-9-11-integ`, `items-9-11-unit` and `q4-green-try`. They are supporting runs, not the cited red or green evidence.)*

| Item | Commit | Change | Red | Green |
| --- | --- | --- | --- | --- |
| 1 Blocker I2 (unreadable) | `76d4f92` | `project-storage-upgrade-node-adapter.ts` `markerQueryFailure`: a non-busy failed marker query is broken ("Project Storage upgrade marker could not be read."); docstrings in the node adapter and in `project-storage-upgrade.ts` | `i2-unreadable-red.log`: resolved `undefined` | `i2-unreadable-green.log` 7/7; regressions `i2-regress*.log` 169 + 16 |
| 1 owner-seam busy | `76d4f92` | recovery test "answers busy, retryable, when the marker lookup meets a busy registry at activation" | `i2-owner-busy-red.log` (mutation: busy branch removed; answered broken) | `i2-owner-busy-green.log` |
| 2 U7 G5 | `11e3e81` | `use-project-upgrade.ts` `canonicalNeedsMigration` used for the post-upgrade check | `u7-red.log` (use-project-upgrade.ts at HEAD). The red was first seen at the test's initial run; after the label fix it was re-observed after green by stashing the implementation | `u7-green.log` 89/89 |
| 3 busy discriminant | `b0939d6` | `ProjectStorageUpgradeBusyError`; the outcome carries `busy: true`; `project-upgrade-outcome.ts` maps on the discriminant | `busy-discriminant-red.log` (text-equality mapping) | `busy-discriminant-green.log` 95 + 1; registration 17 |
| 4 Q4 stdout end and timeout | `cb02e8f` | `harness-supervisor.ts`: exit only quiets the observation; the forwarder ends on stdout end or close (immediately when there is no stdout); the shutdown timeout removes the observation | `q4-red.log` (2 new tests) | `q4-green.log` 564/564 |
| 5a/6 not-held failures, holdsProject guard | `96e7ec7` | `harness-runtime.ts` `heldProject`, `stopCanonicalThenStorage`. Rule: with no Project held, Storage's own result decides whether the application database stops; a canonical failure is reported. A throwing held query counts as held and is reported | `i1-failures-red.log` | `i1-failures-green.log` 96/96 |
| 5b holdsProject while activating and releasing | `96e7ec7` | coordinator test | `i1-coordinator-red-active.log`, `i1-coordinator-red-true.log` (mutations: active-only; constant `() => true` scaffold) | `i1-activating-green.log` |
| 5c/5f queued activation, answers | `6fd529e` | quit test runs alone and with an admitted queued activation; seam (b) records Storage answers (owner stopped). The wire reply cannot be observed once the intake is closed | `i1-quit-red-reverted-order.log` (PARENT + patch digest: `stopCanonicalThenStorage` forced to the held order, fixture kept) | `i1-quit-green.log` 21/21 |
| 5e held-order mutation | `6fd529e` | — | `i1-held-order-red.log` (together order forced) | — |
| 5g seam (a) | — | **Not done.** The real process runtime has no step hook to hold an upgrade mid-way. Adding one would be new test-only production wiring | — | — |
| 7 Q13 post-switch | `c79613d` | the post-switch checkpoint runs as a committing step | `q13-red.log` (after-upgrade-switch row) | `q13-green.log` 53/53 |
| 8 Q9 errors | `1c49633` | asserts /readonly/i and /unable to open/i | — (assertion strengthening) | `q9-green.log` |
| 9 Q14 vocabulary | `1c49633` | `openingReleaseFailedMessage` in `project-storage-errors.ts` | refactor | `items-9-11-*.log` |
| 10 Q18 creation | `1c49633` | creation paths use `upgradeOutputNames` | refactor | same |
| 11 title | `1c49633` | `protocol.test.ts` "protocol version 7" | — | same |
| CodeScene | `bde79ff` | split `markerQueryFailure`, `#watchLogging` and the supervisor stop/exit test | — | `codescene-change-set.log`: passed. `project-storage-node-adapters.ts` is stable at 1151 LOC (+1) under the S1 waiver |

Round-2 oracle changes: the owner-level busy constants carry `busy: true`. The supervisor tests emit stdout `end` before or after exit. Two runtime tests now include `application-database` in the stop calls.

## Review round 3 fix (single commit; user decisions U8 and the residual issues)

Logs are in the implementer's scratchpad `s5r3/`; `red.log` carries the identity line (HEAD plus a test-only patch digest).

| Item | Change | Red | Green |
| --- | --- | --- | --- |
| X5 | `harness-supervisor.ts` `#watchOutput`: stdout `end` or `close` only detaches stdout and ends the line forwarder. Stderr logging and the error listener stay until exit, quiet or remove | `red.log`: "keeps stderr logging and the error listener when stdout end/close arrives before exit" (2 rows) | `green.log` |
| Busy type pinned | the steps test asserts `ProjectStorageUpgradeBusyError` at the marker lookup | pin (already true) | `green.log` |
| Typed pass-through | `markerQueryFailure` returns a typed `ProjectStorageUnavailableError` unchanged; only raw busy codes become busy. New unit test `project-storage-upgrade-node-adapter.test.ts` | `red.log` (the typed error was rewrapped as busy) | `green.log` |
| Required discriminant | the upgrade outcome's `unavailable` arm carries `reason: "busy" | "unavailable"`, and the mapping reads it | refactor (type) | `green.log` |

Oracle changes:
- Owner-level upgrade outcomes carry `reason`.
- The locked-registry activation test now answers the registry authority's own typed "Project Storage authority is unavailable." (passed through) instead of the busy text, and is retitled.

Residuals tracked as GitHub issues (user decision): [#95 Prove a real-process quit during a running upgrade and assert its wire reply](https://github.com/TheMastermindPT/slopstop/issues/95) (5g/5f); [#96 Keep harness upgrade log lines that arrive after the child exits on quit](https://github.com/TheMastermindPT/slopstop/issues/96) (W1); [#97 Add mutation scope for the C1-0 S5 upgrade and shutdown branches](https://github.com/TheMastermindPT/slopstop/issues/97).

## Heavy gates (coordinator)

The coordinator ran these at `f5d93e7`. Logs are in the coordinator's scratchpad (`C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/31015069-2c8a-4de8-a12f-6d8d594a536c/scratchpad/`); each log's first line is `HEAD f5d93e7` (the base coverage log carries `HEAD 3b833e1`).

| Gate | Log | Result |
| --- | --- | --- |
| `pnpm check:deep` | `s5-check-deep.log` | **Failed** at `test:coverage`: 3 registration tests timed out at 15 s, then EBUSY on cleanup (`registration-list-removal-race` x2, `registration-identity-query-lifecycle` "instant 9000 unconfirmed=false"); 4471 passed, 5 skipped. The machine had other load. Later stages did not run |
| Coverage stage alone, base `3b833e1` (diagnostic) | `cov-base.log`, `cov-base.json` | 4442 passed, idle machine |
| Coverage stage alone, `f5d93e7` (diagnostic) | `cov-s5.log`, `cov-s5.json` | 4474 passed, idle machine |
| `pnpm test:integration` | `s5-test-integration.log` | 2033 passed, 5 skipped |
| `pnpm test:e2e` | `s5-test-e2e.log` | 11 passed |
| `pnpm package:launch-smoke` | `s5-package-launch-smoke.log` | exit 0 |
| Mutation `stryker.config.json` (`--force`) | `s5-mutation-1.log` | 88.41 |
| Mutation `stryker.project-storage-desktop.config.json` (`--force`) | `s5-mutation-2.log` | 87.14 |
| Mutation `stryker.project-storage.config.json` (`--force`) | `s5-mutation-3.log` | 85.40 (break 80) |

The two coverage runs are a user-approved diagnostic, not a rerun to chase green. On an idle machine, the 13 tests of the two failing files took 1.2-4.6 s at `f5d93e7` against 1.4-5.2 s at base, and the registration lane's common tests took 276 s against 290 s. S5 did not slow them. The failure is the same load-sensitive mode tracked in [#94](https://github.com/TheMastermindPT/slopstop/issues/94).
