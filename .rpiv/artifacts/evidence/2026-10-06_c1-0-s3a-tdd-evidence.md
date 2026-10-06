# C1-0 S3a TDD evidence: `c1-0-s3a-upgrade-request`

Append-only. This file records the evidence for slice `c1-0-s3a-upgrade-request` of `.rpiv/artifacts/designs/2026-10-06_13-20-24_upgrade-request-and-window.md`. The approved design has content hash `257d4fe6eb3a842f39c8b75d2f5db2ec4a00a9cb8eedf070a9f6ce877f8c9c7d`. Build authorization is in `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §8 (commit `a9b347c`).

- Branch `feat/c1-0-s3a-upgrade-request`, created from `main` at `a9b347c`.
- Lane: normal.
- Workspace: the shared main working tree, chosen by the user and coordinator (see deviation 1).

**Digests.** Each red and green state is identified by its parent commit `a9b347c` plus a working-tree digest. The digest is `sha256` (first 16 hex characters) of `git diff HEAD --binary`, followed by every untracked file except `.playwright-mcp/` as `UNTRACKED <path>` and its bytes, in sorted path order.

**Logs.** Logs are kept in the session scratchpad as `ev3/*.txt`.

## UPG-B24: one app instance per `userData`

- Test: `quits a second launch and keeps the first usable`, in `apps/desktop/tests/e2e/single-instance.test.ts`.
- Red, at digest `9df192d1bd04ba1f`. The run was `electron-forge package`, then `playwright test --config playwright.config.ts tests/e2e/single-instance.test.ts`. It failed with `Expected: 0, Received: "running"`: the second instance did not exit within 10 s. Log `b24-red.txt`.
- Implementation in `main.ts`, inside `bootstrap()`:
  - after the package-smoke `userData` override and before `app.whenReady()`, `app.requestSingleInstanceLock()` is called; `false` quits and returns;
  - a `second-instance` event restores the existing window (if minimized) and focuses it.
- Green, at digest `96ea3f759fb5e0e3`: 1 passed in 16.6 s (`b24-green.txt`). After the red, the test gained an assertion that window A really is minimized before B starts; the red reason is unaffected.
- `electron-launch.ts` gained `builtDesktopCommand`, so that B is spawned with the same `electron.exe` and `launch.cjs` shim.

## UPG-B25: strict version-6 `project.upgrade`

- Test: `encodes and decodes the upgrade request and result strictly`, in `packages/protocol/src/protocol.test.ts`.
- Scaffolding: only the factories and the exports.
- Red, at digest `522616445ecc39b7`: a `SchemaError`, because the union expects only the version-5 commands and has no `project.upgrade` (`b25-red.txt`). The first run went red on the version assertion. The test was reordered so that the union is reached first, then re-run.
- Implementation: the new `project-upgrade-protocol.ts` holds the `projectUpgradeDiagnostics` row map, the request schema and a result schema of exact (code, message, retryable) rows. The command and event union entries were added and `protocolVersion` went to 6.
- Green: 1 passed (`b25-green.txt`). After the version pins went from 5 to 6 in 10 files, the protocol package passed 986/986.

## UPG-B26: upgrade through the real harness

- Test: `upgrades a migration-required Project through the harness`, seam (a), in `project-upgrade-runtime.integration.test.ts`.
- Red at digest `95144af6583a73f5`: `expected 'request.failure' to be 'project.upgrade.result'` (`b26-red.txt`).
- Unit routing case: `routes an upgrade to the canonical application and answers its result`, in `src/harness-runtime.test.ts`. Red at digest `4d37b994d3941715`: the fake `upgrade` was never called.
- Implementation:
  - the runtime routes `project.upgrade` through the canonical application;
  - the application passes it through, and the coordinator queues it with a strict pass-through;
  - the `ProjectStorage` service is typed `ProjectStorageOwner & ProjectStorageUpgradePort`;
  - the typed test fakes gained an `unusedProjectUpgrade` stub.
- Green at digest `8797f132258aa806` (both tests).

## UPG-B27: exact mapping, queueing, held Projects, rethrow

- Tests: `maps upgrade outcomes through the harness: <case>`, seam (b), plus `refuses an upgrade while a Project is held or after stop` at the coordinator seam.
- Two corrections before the red:
  - The command answers `status: "coordinator-unavailable"`; my first oracle said `"unavailable"`. That wrong oracle made the test time out, because the held upgrade was never released. The hold is now released in `finally`.
  - The held cases compare the registry and the directory layout, not file bytes (deviation 3).
- Red at digest `678525147b9ca8a4`: 8 failed | 6 passed (`b27-red.txt`).
  - Every mapping row answered `request.failure HARNESS_INTERNAL_FAILURE`, because the strict decode of the storage result fails (no `retryable`).
  - The held cases called storage and answered `upgraded` or `not-required` instead of `rejected`. The held-case re-run was at digest `2b4828de20f95de9`.
- Green on arrival: `not-required`; `not-registered`; the queue case (the command answers `PROJECT_COORDINATOR_UNAVAILABLE` and the activation waits); the listing during an upgrade (F9: safe-mode, `recovery-required` both); and the raw step error (`request.failure HARNESS_INTERNAL_FAILURE`, then safe-mode `migration-required` on S).
- Coordinator unit red at digest `faf752af3e31dec6`: with a retained `release-failed` activation, the upgrade reached storage (`Project upgrade is unused by this fixture.`).
- Implementation:
  - new `src/project-upgrade-outcome.ts`, with `projectUpgradeResult` and `coordinatorUpgradeRefusal`;
  - `coordinator.upgrade` answers stopped, then holding (any state other than `inactive`), then storage;
  - the pipeline uses the protocol rows (its own message tables were dropped);
  - the storage result codes are typed from `projectUpgradeDiagnostics`.
- Green at digest `225fbbc803032000`: integration 14/14, coordinator 23/23.

## UPG-B28: the application re-validates upgrade results

- Test: `rejects an invalid or foreign upgrade result`, in `src/canonical-project-application.test.ts`.
- Red at digest `562be2b191a27aff`: the result passed through, so no `CanonicalProjectApplicationError` was thrown.
- Implementation: `upgrade` validates the result against `ProjectUpgradeResultSchema` and the request's `projectId`.
- Green at digest `0049ca5a0f5e550d`: 181/181.

## UPG-B30: upgrade log lines reach the desktop's local log

- **Mapping.** Test: `maps upgrade diagnostics to log calls` (`src/upgrade-diagnostics-logger.test.ts`).
  - Red at digest `2b7acb2fd2d674f4`, against no-op scaffolding: `expected [] to deeply equal [[…]]`.
  - Green after `createUpgradeDiagnosticsLogger` (`info` / `warn` with ids and class only, no message argument).
- **Real Pino line.** Test: `writes upgrade log lines the desktop accepts` (`tests/integration/harness-logger.integration.test.ts`).
  - Red at digest `b153e0bfab61f6fd`, with a scaffold `createHarnessLogger` that ignored its destination: `expected [] to have a length of 2`.
  - Green at digest `2773a74e57714e01`, after the factory honours the destination and `process-entry.ts` builds its logger with it.
  - `HarnessUpgradeLogLineSchema` and the protocol-owned reason and cause literals were added together with this test.
- **Runtime.** Tests: `logs abandoned upgrades without paths: <case>`.
  - `startHarnessProcessRuntime` gained a required `logger`, unused at first.
  - Red at digest `7166596d5e05905a`, on seam (a): the interrupted case got `expected [] to equal [[info … interrupted]]`, and the busy discard got `expected [] to equal [[warn … busy]]`.
  - The seam (b) cases (a failed upgrade, and an `info` sink that throws) were green on arrival: that fixture wires the logger itself, and S2's `reportSafely` isolates a sink that throws.
  - Implementation: a `process-bootstrap` `UpgradeLog` service passes `createUpgradeDiagnosticsLogger(input.logger)` as the `upgradeDiagnostics` of the coordinator's owner only.
  - Green at digest `2181ed442938d960`: 18/18.
- **Desktop.** Test: `forwards only harness upgrade log lines` (`apps/desktop/src/main/harness-supervisor.test.ts`).
  - Red at digest `9460cba200106a76`: only byte counts plus the existing exit error.
  - After the red, the unchanged `Harness process exited.` error at exit was added to the expected order.
  - Implementation: new `apps/desktop/src/main/harness-log-lines.ts`. It splits lines with a 16 KiB bound and a `StringDecoder`, strictly decodes upgrade lines, and emits the TOO_LONG, INVALID and INCOMPLETE warnings. The supervisor feeds it each stdout chunk and ends it at observation cleanup.
  - Green at digest `0ebfb952de1d7a08`: 21/21.

## UPG-B29: a normal Project upgrades in under 2 s

- Test: `upgrades a generation-two Project in under two seconds` (`registration-project-upgrade-timing.integration.test.ts`), run in the low-parallelism registration project.
- This is a guard and was green on arrival, as predicted, at digest `e3d94e8ed4a7f835`: 353 ms (`b29.txt`). The duration line only appears with `--reporter=verbose`.

## Refactor and gates

- `pnpm check` failed in `canonical-writer-package-smoke-main.test.ts` (`ready is not a function`): its Electron `app` mock had no `requestSingleInstanceLock`. The mock now returns `true`, and the file passes 67/67.
- jscpd first found 3 clones, all removed:
  - the coordinator composition in `process-bootstrap.ts` and the test fixture now share `src/node-active-project-coordinator.ts`;
  - two unused canonical applications now use `unusedCanonicalApplication`;
  - the staged-table conflict is now `conflictingStagedTable`.
- knip flagged 2 exports, now un-exported.
- CodeScene flagged a complex method in the new supervisor test; its helpers were moved to the describe scope.
- `harness-runtime.ts` now takes its protocol-failure and internal-failure messages from the protocol row map (`shared-vocab-union`; identical strings).

## Deviations

1. Workspace: the main working tree on the feature branch (user and coordinator choice), not the normal lane's linked worktree.
2. No approved copy of the design existed. I saved `.rpiv/evidence/2026-10-06_13-20-24_upgrade-request-and-window/approved-257d4fe6….md` from `git show a9b347c:<design>`, the commit that carries the §8 authorization. The append-only check exits 0. That directory is git-ignored.
3. B27 held cases ("another Project active", "the upgrade target held read-write"): the snapshot compares the registry and the directory layout, but not file bytes. Reading a file of a Project held read-write gives EBUSY.
4. B27 `release-failed` is tested at the coordinator seam (`active-project-coordinator.test.ts`), not seam (b).
5. Two new source files are not in the design's list: `src/project-upgrade-outcome.ts` (the mapping) and `src/node-active-project-coordinator.ts` (shared by bootstrap and the test fixture, to remove a clone).
6. "New code uses Effect": the new modules are pure functions (Effect `Result` for decoding). `coordinator.upgrade` follows the surrounding Promise-based coordinator. The design keeps the rethrow uncaught (F2).
7. Test edits made after a red, recorded above: the B25 reorder, the B24 minimized assertion, and the expected exit log in B30 desktop.
8. Green on arrival, recorded above: part of B27, B30 seam (b), and B29 (designed as a guard).
9. There is no unit test of the lock-refused quit path in `main.ts`; it is covered by the B24 E2E.

## Final verification (before the slice commit)

All runs below used the same source and test tree. When the integration run started, the working-tree digest was `1050b5c40a8129e6`. After that, only `.rpiv/` files changed (this record and the design's TDD Evidence link): `find apps packages stryker.config.json -newer <digest file>` lists no file.

- `pnpm check` (root): exit 0, 2329 unit tests passed. It was re-run on the final tree.
- `pnpm test:integration` (root; the harness, registration and desktop projects): exit 0. 61 files passed and 1 was skipped; 2012 tests passed and 4 were skipped; 473 s.
- `pnpm test:e2e`: exit 0, 10 passed in 1.5 min (Playwright workers = 1, including `single-instance.test.ts`).
- `pnpm --filter @slopstop/desktop package:launch-smoke`: exit 0, "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof."
- `pnpm test:mutation` (root Stryker, thresholds unchanged at high 90, low 80, break 80): **87.61**, in 5 min 48 s.
  - Per file: `protocol.ts` 83.4, `harness-runtime.ts` 93.1, `harness-supervisor.ts` 91.8.
  - `project-upgrade-protocol.ts` was added to the scope, but its 39 mutants are all `Ignored`: they are static schema and constant definitions under `ignoreStatic`. It therefore has no measured score.
  - One Stryker child process exited with code 3221225477 while running a mutant in `harness-supervisor.test.ts` ("kills after grace…"). Stryker restarted it and the run completed.
- `pnpm check:duplicates`: 0 clones. knip: clean. `pnpm db:generate:check` (`apps/harness`): no schema changes.
- CodeScene: the pre-commit safeguard passed (49 files checked). Every touched or new source and test file scored 10. CodeScene baselines were not captured before the first edit; all touched files are now at 10, so there is no regression.
- The design's TDD Evidence link was added as an append-only change and re-stamped (`content_hash` `b031715c…`). The append-only diff against the approved copy shows only that section and the `content_hash` line.


## Review round 1 of 2 (candidate `5ff39ed`): fixes

The coordinator's round-1 note lists R1–R9, the cheap fixes, the record-only items and the evidence asks. The user chose to fix them all now; round 2 is the last (conversation-decisions §8).

How states are identified:
- Each state is parent `5ff39ed` plus a working-tree digest computed the same way as above.
- A probe is a temporary edit, restored byte-identical afterwards (checked with `cmp` against the saved fixed copy).
- Logs are in the session scratchpad, `ev4/*.txt`.

### R1: B25 oracle no longer reads the constant under test

- `protocol.test.ts` now holds the design's result table, copied by hand as rows `[status, code, message, retryable]` (12 rows).
- It asserts `Object.values(projectUpgradeDiagnostics)` equals those rows, and it builds every round-trip payload and every invalid case from the table.
- Probe: one message in the constant changed.
  - First form (two literal tables), probe digest `0021a257da39e5c4`: the protocol case and the runtime staged-copy case are both red (`r1-probe-protocol.txt`, `r1-probe-runtime.txt`).
  - Final form, tree digest under probe `5ad41d62320ffa91`: the protocol case is red (`r1-probe-final.txt`). Restored, 43/43.
- jscpd then found the literal table cloned: in the runtime test, in the source, and in the protocol test.
- **User decision:**
  - only the protocol test keeps the literal design table;
  - the runtime test uses `projectUpgradeDiagnostics`, which the protocol test pins to the design table;
  - the table is written as rows, which is closer to the design table and is not a token clone of the source.
  - jscpd is back to 0 without any ignore.

### R2: an out-of-range log `time` no longer crashes desktop main

- Test: `rejects an upgrade line whose time is no date` (`harness-supervisor.test.ts`).
- Red at digest `db7ef489c9b9abf0`: the stdout listener throws `RangeError: Invalid time value` (`r2-red.txt`).
- Fix: `HarnessUpgradeLogLineSchema.time` is now an integer in [−8.64e15, 8.64e15], the ECMAScript Date range. A line outside it is reported as `HARNESS_LOG_LINE_INVALID`.
- Green at digest `49d61cdf6e00ea86`: 22/22.

### R3: the quiescence row now fails without the queue

- Probe: `coordinator.upgrade` runs outside `enqueue` (diff digest `b81450cc61446f33`). The existing case stayed green (`r3-probe.txt`), because the queued activation and `locks.forProject` already produce its answers.
- New case: `a lone command and another Project wait for a running upgrade`.
  - A command sent while the upgrade is held, with no activation queued, must answer `coordinator-unavailable`.
  - An activation of another Project must answer only after the upgrade result.
- Red under the same probe (tree digest `4b1c864f01d35b9a`): the command answered `inactive` (`r3-red.txt`).
- Restored: 2 passed (`r3-green.txt`), at digest `80e8aaad5e997c96`.

### R4: every line is bounded at 16 KiB; `decoder.end()` (cheap)

- New `apps/desktop/src/main/harness-log-lines.test.ts`, with four cases:
  - exactly 16 KiB in one chunk;
  - exactly 16 KiB buffered before its newline;
  - 16 KiB + 1 in one chunk;
  - 16 KiB + 1 across chunks.
- Plus a partial UTF-8 character left at exit.
- Red at digest `9e4539293fdcb139`: 2 failed (16 KiB + 1 in one chunk; partial character), 3 passed (`r4-red.txt`).
- Fix:
  - every completed line is measured; one over 16 KiB gives `HARNESS_LOG_LINE_TOO_LONG` and is not parsed;
  - `end()` appends `decoder.end()` before its emptiness check.
- Green at digest `2e45b1a8bd0d3897`: 5/5 + 22/22.

### R5: harness-failure codes and messages have one owner again

- This is non-behavioural, so there is no red.
- New `packages/protocol/src/harness-failure-protocol.ts` owns:
  - `HarnessFailureCodeSchema`;
  - `harnessFailureMessages` (`satisfies Record<HarnessFailureCode, string>`).
- `protocol.ts` re-exports both, so there is no import cycle.
- The upgrade map's three harness-failure rows are built by `harnessFailureRow(code)`: the code is typed `HarnessFailureCode`, and the message comes from `harnessFailureMessages`.
- `harness-runtime.ts` takes its generic `request.failure` messages from `harnessFailureMessages` again.
- Proof that nothing changed: the R1 design table still equals the map, and protocol plus runtime unit tests pass 1076/1076.
- Restoring ownership was clean, so this is not recorded as a new deviation.

### R6: exactly one internal failure

- The raw-step-error case now asserts exactly one `request.failure` with the command's `causationId`, after the follow-up activation has answered.
- Probe: the runtime sends the internal failure twice (diff digest `d6191b8cfffb4d10`). Red: 2 envelopes instead of 1 (`r6-probe.txt`). Restored.

### R7: the "another Project active" case hashes files

- That case now compares `storageSnapshot`, with file bytes hashed; the upgrade target is not open in it.
- Only "the upgrade target held read-write" keeps the registry-and-layout snapshot.
- Green: 3/3 together with R6 (`r6r7-green.txt`), at digest `2309d1daa0ad1bba`.
- Deviation 3 is now limited to the target-held case.

### R8: mutation scope

- `apps/desktop/src/main/harness-log-lines.ts` was added to `stryker.config.json` `mutate`.
- `project-upgrade-protocol.ts` cannot be measured by mutation: all its mutants are `Ignored`, static definitions under `ignoreStatic`. R1's literal table is its check.
- Deviation 5 now also lists `harness-log-lines.ts`, and `harness-failure-protocol.ts` (R5).

### R9: a writer-proof launch refused the lock now exits

- Test: `quits a writer-proof launch that does not hold the lock without arming its proof` (`canonical-writer-package-smoke-main.test.ts`).
- The first oracle ("`before-quit` not prevented") was wrong. The ordinary shutdown also prevents the first quit, then quits again when it is done. It was corrected before the red to: `app.quit` is called twice (the lock refusal, then the completed shutdown).
- Red with `main.ts` as at `5ff39ed` (tree digest `31db4ad197052554`): `quit` was called once, because the armed writer proof held the quit (`r9-red.txt`).
- Fix:
  - the package-smoke authorization, which sets the `userData` the lock belongs to, still runs before the lock;
  - its state and `writerProofAbort` are assigned only after a successful lock.
- Green at digest `e6177bcc3d0193fd`: 68/68.

### Cheap fixes

- The upgrade log event names have one owner, `harnessUpgradeLogEvents` (protocol). The schema, `upgrade-diagnostics-logger.ts` and the desktop allowlist all use it.
- The TSDoc of `holdExclusiveLock` is back above it.

### Record only

- Deferred Work: the coordinator's activation literals repeat two protocol messages, at `active-project-coordinator.ts` (the `coordinatorStopped` and `storageUnavailable` texts). This is for a later shared-vocabulary extraction; activation is a non-goal of S3a.
- Accepted residual risk (user decision, §8): the link from `process-entry` to the desktop log is proven hop by hop only, with no end-to-end run of the built harness. Revisit at the C1 gate.
- Missing digests from the first build:
  - The B25 green was recorded only after the version pins, at digest `72326b6c86e8b374`. Its first green has no separate digest.
  - The B30 mapping green has no digest: it is unavailable.
- The manual packaged double-launch check is done by the user after these fixes. It is not part of this record.

### Final verification

The gates are re-run on the fix commit itself. Their results, bound to that commit's SHA, are in the round-1 report to the coordinator and in the `ev4/final-*` logs. This file is inside the fix commit, so it cannot record results for that commit.
- Refactor after R9 (CodeScene Complex Method in `bootstrap`, 9.68): the package-smoke authorization and arming moved to `authorizePackageSmoke` and `armPackageSmoke`; `main.ts` back to 10, the R9 case and the file's 68 tests green.

## Review round 2 of 2 (candidate `4d8cabd`): fixes

Coordinator's round-2 note T1-T8. User decision (conversation-decisions §8): fix now, no third round; the coordinator verifies before the squash merge. Each state is identified by parent `4d8cabd` plus a working-tree digest; logs are `ev5/*.txt` in the session scratchpad; probes were restored byte-identical (`cmp`).

### T1
- tests: 'fails a package smoke that does not hold the lock, without arming its proof' (stderr "Package smoke single-instance lock is held by another instance.", app.exit(1), no quit, no whenReady, no runner) and 'quits an ordinary launch that does not hold the lock'.
- red digest fcd8cb5cd56f0115: writes [] instead of the lock message (the smoke quit silently, exit 0) (ev5/t1-red.txt); the ordinary case green.
- impl: refused lock -> ordinary: app.quit(); authorized smoke: refuseSecondPackageSmoke() writes the line then app.exit(1); writerProofAbort not armed.
- green digest 39235f70d8abd997: 69/69 (ev5/t1-green.txt).
### T7
- in the smoke case: authorize invocationCallOrder < requestSingleInstanceLock.
- probe (lock taken before authorization, diff digest 4fdaebf9b26ec21a): red "expected 4 to be less than 3" (ev5/t7-probe.txt); restored.
### T2-T5 (harness-log-lines.test.ts)
- added: overlong unfinished line -> [tooLong] right after the overflowing push and after end() (no INCOMPLETE) [T2]; 16 KiB+1 then a further >16 KiB chunk then newline + valid line -> one tooLong then the forwarded line [T3]; "null" and "42" lines -> no calls, no throw [T4]; time after year 9999 / before year 0000 -> INVALID, no throw, and the two boundary instants forwarded [T5].
- run at digest 4e1fc4ba797c42f7: T5 out-of-range cases red (2 failed | 10 passed, ev5/t2-t5-red.txt); T2, T3, T4 green on arrival (they target surviving mutants 67/69/72/73 and 5/6/7/10).
- T2 probe (remainder bound set to false, diff digest 107967c5d23fa5c5): the T2 case red (ev5/t2-probe.txt); restored.
- impl T5: HarnessUpgradeLogLineSchema.time in [-62167219200000, 253402300799999] (0000-01-01T00:00:00.000Z .. 9999-12-31T23:59:59.999Z).
- green digest 754b0649f8d7aef1: forwarder 12/12 + supervisor 22/22 (ev5/t2-t5-green.txt).
### T6
- lone-command case: before hold.release(), a further command round-trip (answers coordinator-unavailable at once), so the other Project's activation is known to be at the coordinator.
- probe (pendingLifecycle counted, withPermit bypassed for upgrade; diff digest a91c052a99e2083d, tree digest e74999f71fbe19cf): ordering assertion red "expected 3 to be less than 2" (ev5/t6-probe.txt); restored; queue cases 2/2 (ev5/t6-green.txt), digest 085c22b8ec246e9c.
### T8
- designTable rows now start with the key name; the test asserts Object.entries(projectUpgradeDiagnostics) equals the [key, row] pairs.
- first probe (key renamed only in the map) crashed module load (TypeError reading 'code': the result schema reads that key) - not a valid red; second probe renamed the key and its schema use (diff digest c3f3dbc1ee89fa31, tree 68e9757d106ba920): red, entries differ (ev5/t8-probe.txt); restored, 43/43. jscpd 0.

### Deviation notes (supersede earlier entries)

- Deviation 9 ("no unit test of the lock-refused quit path") is superseded: R9 added the unit test, and T1/T7 extend it (package smoke exits 1 with its own stderr line; ordinary launch quits; authorization precedes the lock).
- Deviations 3 and 5 are amended by the round-1 section: deviation 3 now applies only to the target-held case (R7); deviation 5 also lists `apps/desktop/src/main/harness-log-lines.ts` and `packages/protocol/src/harness-failure-protocol.ts`.
- New deviation 10, confirmed by the user (conversation-decisions §8): only the protocol test keeps the literal design table (rows with key, status, code, message, retryable); the runtime tests read `projectUpgradeDiagnostics`, which that test pins key by key.

### Final verification

Gates run on the fix commit itself; their results, bound to its SHA, are in the round-2 report to the coordinator and in the `ev5/final-*` logs. Mutation runs once with `--force`, so its score comes wholly from the fix commit.

## Manual check (Success Criteria)

- 2026-10-06, by the user, on the app packaged during the e2e run at `bcb102b` (`apps/desktop/out/SlopStop-win32-x64/SlopStop.exe`): launched, minimized or covered, launched again. No second window opened; the first window came to the front. Passed.
