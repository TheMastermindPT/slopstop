# TDD evidence: p3-s1-busy-classifier

- Design: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md` (Next Slice, p3-s1), `content_hash 83000262…`, approved copy `approved-30f2f102.md`; append-only check at start: `keep`. Q1 (a).
- Base: `8a84ddb` (main with the Phase 3 brief; the brief's base `b94f302` plus that docs commit).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s1-*.log` in the main checkout. Each log heads with the parent commit and the working-tree patch digest.

## Comparison sites (precedent `e55b35b`)

- `rg -n "isSqliteBusy|isBusyStorageError|sqlite-busy|isUnavailableStorageError|isCorruptStorageError"` over the whole repository (outside `node_modules` and `.rpiv`) at the base: the 2 `isSqliteBusy` imports, the 4 `isBusyStorageError` imports and 1 test, `vitest.conversation-mutation.config.ts:11`, `stryker.conversation.config.json:10`; the same set as the brief. `isUnavailableStorageError`/`isCorruptStorageError` consumers keep their names and imports.

## P3-B1: one module answers every storage classification

- Test: `classifies each storage error code once: $name` in `apps/harness/src/storage/project-storage-node-errors.test.ts` (15 rows: the 13 codes, no code, and a cause-wrapped `SQLITE_IOERR`; each row asserts all four predicates as one object).
- Red (`p3-s1-b1-red.log`): 15 failed, `TypeError: isSqliteBusy is not a function`; the module exports neither `isSqliteBusy` nor `isRetryableStorageError`. Matches the Expected red.
- Implementation: `isSqliteBusy` moved into `project-storage-node-errors.ts` with its TSDoc and body; `isBusyStorageError` renamed `isRetryableStorageError` (same body, TSDoc: busy or unavailable, cause included, wider than `isSqliteBusy`); the 6 consumers import from the one module; `sqlite-busy.ts` and `sqlite-busy.test.ts` deleted. The existing cause-walk rows are renamed `knows a retryable storage error, directly or by its cause`.
- Green (`p3-s1-b1-green.log`): 15 passed.

## P3-B2: no verdict changes (pin)

- Tests (`the busy verdicts stay as they were`, same file): `registryFailure` maps BUSY/LOCKED to `{ status: "unavailable", code: "REGISTRY_BUSY" }` and the 7 other codes to `{ status: "broken", code: "INTERNAL_FAILURE" }` (moved from `sqlite-busy.test.ts`); `conversationStorageFailure` maps `SQLITE_BUSY` to `ConversationStorageBusy` and `SQLITE_IOERR` to `ConversationStorageBroken` (class, `_tag` and the same `cause`).
- Before (`p3-s1-b2-pin-before.log`): 18 passed. Node adapter and upgrade outcome units (`p3-s1-b2-pin-before-node-adapter.log`): 4 passed.
- After (`p3-s1-b2-pin-after.log`): the whole node-errors file plus those two files, 68 passed.
- **Pending (heavy, coordinator GO):** the upgrade recovery and pipeline busy rows live in integration tests (`project-storage-upgrade-recovery`, `-failure`, `-steps` integration files), not in unit files as the contract implies. Their before run can use the main checkout (same `8a84ddb` sources).

## TDD-exempt configuration

- `vitest.conversation-mutation.config.ts` includes `project-storage-node-errors.test.ts`; `stryker.conversation.config.json` mutates `project-storage-node-errors.ts`.
- Oracle: `rg -n "sqlite-busy|isBusyStorageError" apps packages stryker.conversation.config.json` finds nothing (exit 1); `rg -n "\"SQLITE_(BUSY|LOCKED)\"" apps/harness/src -g '!*.test.*'` finds only `project-storage-node-errors.ts` (28, 34, 37) and `local-libsql-worker-client.ts:135`.
- **Risk (to report):** the conversation mutation run now mutates the whole `project-storage-node-errors.ts`, including `storageFailureFor` and `normalizeStorageError`, which no test in its include list exercises directly. Those mutants may survive and lower the run's score (break 80).

## Bindings (each restored by digest)

- `isSqliteBusy` accepts the `SQLITE_BUSY*` family (`p3-s1-binding-busy-family.log`): P3-B1 `SQLITE_BUSY_SNAPSHOT` and P3-B2 `registryFailure maps SQLITE_BUSY_SNAPSHOT to INTERNAL_FAILURE` fail. Restored `4be3ddf7…8322`.
- `registry-failure.ts` on `isRetryableStorageError` (`p3-s1-binding-registry-retryable-v2.log`): the 5 `registryFailure` rows for `SQLITE_CANTOPEN`, `SQLITE_IOERR`, `SQLITE_READONLY`, `SQLITE_BUSY_SNAPSHOT`, `EBUSY` fail. Restored `d31b4555…0e7b`. The first attempt (`p3-s1-binding-registry-retryable.log`) left the import unchanged and failed by `ReferenceError`; it is void.
- `conversation-errors.ts` on `isRetryableStorageError` (`p3-s1-binding-conversation-retryable.log`, beyond the contract): `conversationStorageFailure maps SQLITE_IOERR to ConversationStorageBroken` fails. Restored `53db8ad1…3702`.

## Light checks

- `tsc --noEmit -p tsconfig.json`: harness, protocol, desktop exit 0. Biome clean.
- Harness unit suite (`p3-s1-harness-unit.log`): 50 files, 1162 passed.
- CodeScene: 10 on `project-storage-node-errors.ts`, its test, the 4 upgrade files, `conversation-errors.ts`, `registry-failure.ts`.

## Amendment (coordinator, Pedro's maximum-quality ask): direct rows for `storageFailureFor` and `normalizeStorageError`

- Reason: the conversation mutation run mutates the whole `project-storage-node-errors.ts` now; these rows keep its scope meaningful. Test-only (pins of today's behaviour), accepted amendment.
- Tests (`the storage failure an error stands for`, same file): a known failure (broken, unavailable, a broken subclass) is returned and thrown as the same instance; `SQLITE_BUSY`, `SQLITE_IOERR_WRITE`, `EPERM` answer `ProjectStorageUnavailableError` with `Project Storage authority is unavailable.` and no `cause` property; `SQLITE_CORRUPT`, a plain error, a cause-wrapped `SQLITE_BUSY` and a non-error value answer `ProjectStorageBrokenError` with the caller's message and the original value as `cause`. Each row checks `storageFailureFor` and the value `normalizeStorageError` throws.
- First run: the 3 unavailable rows failed on my oracle (`cause: undefined` in `toMatchObject` needs the key; the class leaves it absent). The oracle is now `not.toHaveProperty("cause")`, which is the exact shape.
- Green (`p3-s1-amendment-green.log`): the whole file, 74 passed.
- Bindings (restored `4be3ddf7…8322` each): no known-failure return (`p3-s1-binding-known-kept.log`): the 3 known rows fail; no `cause` on the broken answer (`p3-s1-binding-broken-cause.log`): the 4 broken rows fail; the unavailable message changed (`p3-s1-binding-unavailable-message.log`): the 3 unavailable rows fail.
- CodeScene: the test file stays 10. `tsc --noEmit` harness exit 0.

## Heavy gates (coordinator GO; my CPU readings 2/1/7, no game process)

- `pnpm check` (`p3-s1-check.log`): exit 0, 108 files, 3610 tests passed; typecheck, Effect diagnostics (51 advisory warnings, unchanged) and dependency-cruiser clean.
- `pnpm check:duplicates` (`p3-s1-duplicates.log`): exit 0, 0 clones. `pnpm check:dead-code` (`p3-s1-dead-code.log`): exit 0, Knip clean. Each exit read before the next.
- P3-B2 upgrade integration rows (`project-storage-upgrade-recovery`, `-failure`, `-steps`): before in the main checkout at `8a84ddb` (`p3-s1-b2-upgrade-integration-before.log`): 3 files, 49 passed, exit 0; after in p3 (`p3-s1-b2-upgrade-integration-after.log`): 3 files, 49 passed, exit 0.

## Preflight follow-up (candidate `05d8c45`)

- `slice-preflight` (`p3-s1-busy-classifier-preflight.log`, run from the worktree root): `missing-test-file: P3-B1 project-storage-node-errors.test.ts` (the contract names the bare filename, which resolves only from `apps/harness/src/storage`), and `no-test-line: P3-B2` (the brief writes `Tests:` with a list, which the tool does not read as a test line).
- Code-side fix: the P3-B1 rows sit under `describe("classifies each storage error code once")`, each row named `$name`, so the contract title is a literal in the file (before: one `it.each` titled `classifies each storage error code once: $name`). 15 passed. Test-only follow-up commit.
- Second preflight (`p3-s1-busy-classifier-preflight-2.log`, from `apps/harness/src/storage`, candidate `1f93e4d`): only `finding: no-test-line: P3-B2` remains (exit 1). Coordinator decision (b), the Phase 2 s1 precedent: recorded as a brief-format finding; P3-B2 goes to the slice-verifier as unchecked reviewer focus. rpiv issue draft `20261025-150017-075be3a8` (local; filing needs Pedro's approval).

## Slice-verifier round 1 follow-up (candidate `9873a28`)

- Result: passed, 0 violations, 2 warnings. Coordinator: one follow-up commit (test, comment, notes), no integration rerun (no upgrade code touched; `check:deep` at the push covers it), no round 2.
- V1 fix: the two `isSqliteBusy` rows the move dropped (`a non-error value` `"SQLITE_BUSY"` and `null`) are in the P3-B1 table, with all four predicates false. The whole file: 76 passed (`p3-s1-followup-test.log`); `tsc --noEmit` harness exit 0; Biome clean.
- `vitest.conversation-mutation.config.ts` comment: it now names the storage classification module that owns the busy predicate.
- V2 note (no run, coordinator): `stryker.conversation.config.json` now mutates the whole `project-storage-node-errors.ts`, so a later conversation run has a new baseline, not comparable with c1-s3's 11 `sqlite-busy.ts` mutants; `stryker.project-storage.config.json:47` already mutated that file and now also mutates `isSqliteBusy`, whose mutants the P3-B1 table kills. Neither run happens in Phase 3 unless Pedro asks; Phase 3's one mutation run is the scoped ledger run for s3.
- Log identity: only the logs written through the helper carry the parent commit, patch digest, command and exit. `p3-s1-check.log`, `p3-s1-duplicates.log`, `p3-s1-dead-code.log` and both `p3-s1-b2-upgrade-integration-*.log` carry neither digest nor command (the integration logs name their checkout and commit), and `p3-s1-dead-code.log` has no exit line. Their tree is the uncommitted slice after the amendment (later committed unchanged as `05d8c45`; checked with `git diff --quiet 05d8c45`); each exit (all 0) was read from the shell before the next gate. `p3-s1-b2-pin-before.log` names two upgrade unit files that do not exist; only the node-errors file ran there.
- Brief polish (not edited, append-only): the base `registryFailure` rows are `sqlite-busy.test.ts:36-50`, not `:35-49`.
