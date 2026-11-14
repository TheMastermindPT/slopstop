# TDD record: p4-s4-request-skeleton

- Brief: `.rpiv/artifacts/designs/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation.md`, `content_hash 0fb96a63a3331e628cd2ff517ef74cb6e5c06ea287659314468e80849d1dea85`; `validate-artifact: OK`; append-only against `approved-f224f3ad.md`: keep. Q13 (a). No e2e run on this candidate (Pedro).
- Worktree `slopstop-p4`, branch `fix/arch-review-phase-4`, rebased onto main `c721b4c`. The four predecessor commits are now `6b8374b` (s1), `db7ab82` (s2), `86c7f9d` (s3) and `9649ef3` (s3 polish). Each has the same `git patch-id --stable` as before the rebase (`261b79bf…`, `fc8ef68a…`, `5c3128e6…`, `96121e4a…`), so the source equals the brief's base `87f09e8`. Lane normal.
- Evidence logs: `.rpiv/evidence/2026-10-31_15-28-02_arch-review-phase-4-bridge-ipc-consolidation/` in the main checkout (`p4-s4-*`). Desktop main tests use `--config vitest.main.config.ts`.
- Predictions are written before each run and never edited.

## P4-B11 baseline: prediction, written before the run

- The three new-row test edits were written first, before any run. For the baseline they are set aside with `git stash push` on exactly those three files, then restored with `git stash pop`; `git diff --stat` is checked before and after.
- `p4-s4-baseline`: `pnpm exec vitest run --config vitest.main.config.ts src/main/project-entry-bridge.test.ts src/main/project-storage-bridge.test.ts src/main/workspace-bridge.test.ts src/main/harness-bridges.test.ts src/main/harness-request-core.test.ts src/main/harness-supervisor.test.ts` in `apps/desktop`: exit 0, every row passes, 6 files. The per-file counts observed here are the P4-B11 reference; `project-entry-bridge.test.ts` should be 111, as at p4-s3.

## P4-B11 baseline: observed

- `p4-s4-baseline.log`: exit 0, **6 files, 221 passed (221)**. The stash and pop left `git diff --stat` identical (3 test files, 137 insertions). The default reporter prints no per-file counts.
- Prediction for `p4-s4-baseline-files`: the same run under the same stash, with `--reporter=verbose`, so each row names its file. Exit 0, **221 passed**, with `project-entry-bridge.test.ts` at 111.

## P4-B11 baseline per file: observed

- `p4-s4-baseline-files.log`: exit 0, **221 passed (221)**. Per file, from the verbose rows: `project-entry-bridge` 111, `project-storage-bridge` 15, `workspace-bridge` 32, `harness-bridges` 13, `harness-request-core` 11, `harness-supervisor` 39. The raw grep count per file is one higher than these, because the log's `# cmd:` header line names each file once. Matches.

## P4-B9 and P4-B10 red: prediction, written before the run

New rows, tests only. Each invalid input is the operation's valid fixture with one field set to a marker string by `Reflect.set` on a copy:
- entry: `activate` and `upgrade` `projectId`; `switchProject` `to`; read `projectId`; save `saveId`; `register` `step`, with the path-shaped marker `C:/Users/someone/private-invalid-marker`;
- storage: `projectId`;
- workspace: the query's `query` discriminator (`keyof` a union admits only common keys) and the intent's `intent`.

Each P4-B9 row asserts, in order:
1. the call does not throw synchronously;
2. the promise rejects with exactly the fixed error;
3. `util.inspect` of the rejection does not contain the marker;
4. nothing was sent.

P4-B10 is one test whose two cases use `expect.soft`, so both reds show.

`p4-s4-red`: the baseline command, verbose, exit 1, **23 failed, 221 passed (244)**:
- **entry: 12 failed.** Every row throws synchronously from `decodeStrict` (`:121`, `:152`), so the `not.toThrow` assertion fails.
- **storage: 6 failed.**
  - Running: the command builder throws, giving `desktop invalid-command`. `brokenResult` then throws on the invalid request inside the catch, so the promise rejects with a schema error, not the fixed message.
  - Stopped: `broken(unsent)` throws synchronously.
- **workspace: 4 failed.** The same two paths through `brokenQuery` and `brokenIntent`. An invalid intent gives `capabilityForIntent` → `undefined`, which the broken decode rejects.
- **P4-B10: 1 failed, with both soft assertions failing.** The first case answers broken with "Harness returned a mismatched workspace query." The second answers a `query` with `projectId` `id(16)`.
- Every one of the 221 baseline rows passes.

## P4-B9 and P4-B10 red: observed

- `p4-s4-red.log`: exit 1, **23 failed, 221 passed (244)**. The failures split as entry 12, storage 6, workspace 4 and P4-B10 1. Every failure reason matches the prediction:
  - **entry, every row:** "expected [Function] to not throw an error but 'SchemaError(…' was thrown";
  - **storage and workspace running:** "expected a thrown error to be Error: Invalid project-storage request." (or `workspace`); the promise rejected with another error;
  - **storage and workspace stopped:** "expected [Function] to not throw … SchemaError";
  - **P4-B10:** both soft assertions fail, first "expected { status: 'broken', … } to deeply equal { status: 'ready', … }", then the mutated `query`.
- Matches.

## Implementation and green: prediction, written before the run

- **`harness-request-core.ts`** exports `bridgeRequest(core, bridge, operation, input)`, together with `BridgeOperation`, `BridgeHandle` and `EchoRule`. The function runs, in order:
  1. it validates the input with `decodeStrictResult`; a failure answers `Promise.reject(new Error("Invalid <tag> request."))`;
  2. a stopped bridge answers `broken(request, { kind: "unsent" })`;
  3. otherwise the request runs through `core.request` and `decodeReply`;
  4. it compares the echo, with `isDeepStrictEqual`, between `echo.reply(result)` and what the command sent; that is `command.payload` by default, or the rule's `sent(command)`, both captured in the command builder;
  5. it applies the optional `accept`;
  6. `answerRequest` answers last.
- **The three bridges** build their operations on it.
  - Storage, and entry `activate`/`switchProject`/`upgrade`/read/save, echo `result.request`.
  - The workspace query echoes `result.query`, with `accept: acceptQueryResult`. The intent echoes `result.capability` against `capabilityForIntent` of the sent `workspace.intent` payload.
  - `list` validates `{}` with `ProjectListRequestSchema`. This is a deviation from "none for list": the skeleton always takes a schema, and the list command's payload is `{}`. `register` has no echo.
- **Removed:** the `afterStop` parameters and their TSDoc sentences, `keepCore`, the "Settle first" comments, and every `if (stopped) return` re-entry guard. `unsent` stays exported from `project-entry-bridge.ts`.
- `p4-s4-green`: the baseline command, verbose, exit 0, **244 passed (244)**. Per file: entry 123 (111 + 12), storage 21 (15 + 6), workspace 37 (32 + 5), and `harness-bridges` 13, core 11 and supervisor 39, as at the baseline. The pinned test files are unedited, apart from the appended new rows.

## Implementation and green: observed

- `p4-s4-green.log`: exit 0, **244 passed (244)**. Per file: entry 123, storage 21, workspace 37, `harness-bridges` 13, core 11, supervisor 39 (each raw grep count minus the header line). Matches. `tsc --noEmit` in `apps/desktop` is clean, and `biome check --write src/main` applied no fixes.

## Real Stryker row red: prediction, written before the run

- As in p4-s3, the source moved before this row is edited. The new count (18 ranges) is therefore checked against the old configs, whose entries no longer fit the moved files.
- Test edit only: the real-repository row's `stryker.config.json` `ranges` 19 → 18.
- `p4-s4-ranges-red`: `pnpm exec vitest run scripts/check-stryker-ranges.test.mjs` in `apps/harness`: exit 1, **1 failed, 40 passed (41)**, only the real-repository row. Received `ok: false`, with lines for exactly five entries and nothing else:
  - in `stryker.config.json`: `project-entry-bridge.ts:101-101` and `:187-200`;
  - in `desktop-s7`: `project-entry-bridge.ts:78-224`, `project-storage-bridge.ts:30-151` and `workspace-bridge.ts:93-257`.
  
  The three `desktop-s7` ranges now end past the shorter files (177, 131 and 229 lines). The problem code or codes are not predicted.

## Real Stryker row red: observed

- `p4-s4-ranges-red.log`: exit 1, **1 failed, 40 passed (41)**, only the real-repository row. Received `ok: false`, `code: "STRYKER_RANGE_BROKEN"`, with **four** lines, not the five I predicted:
  - `stryker.config.json` `project-entry-bridge.ts:187-200` ends past the file's last line (177);
  - the three `desktop-s7` ranges end past 177, 131 and 229.
- **Differs from the prediction in detail; explained.** `checkStrykerRanges` returns only the first problem code in `codeOrder` (`BROKEN`, `UNANCHORED`, `STALE_ANCHOR`, `DRIFT`) and that code's lines (`check-stryker-ranges.mjs:230-231`). The fifth entry, `project-entry-bridge.ts:101-101`, still fits the file (line 101 is now `        {`), so its problem is a drift, which the `BROKEN` lines mask. The row's red is as predicted; the prediction got the checker's reporting wrong.
- **Proof step: prediction, written before the run.** Re-anchor the four `BROKEN` entries first and leave `:101-101` and its anchor in place:
  - `desktop-s7`: `project-entry-bridge.ts:75-176`, `project-storage-bridge.ts:30-131` and `workspace-bridge.ts:93-229`, with unchanged `first`/`last` texts;
  - `stryker.config.json`: `project-entry-bridge.ts:147-162`, with `first` `    readConversation: run({` and `last` `    }),`.
  
  Run `p4-s4-ranges-drift`, the same command: exit 1, **1 failed, 40 passed**. Received `ok: false`, `code: "STRYKER_RANGE_DRIFT"`, with exactly one line, for `stryker.config.json` `project-entry-bridge.ts:101-101`. Its count is already the new 18 in the test against 19 in the config. But the received value is the failure envelope, so the count does not show.
- **Proof step: observed.** `p4-s4-ranges-drift.log`: exit 1, **1 failed, 40 passed (41)**. Received `code: "STRYKER_RANGE_DRIFT"` with one line: "`stryker.config.json`: `project-entry-bridge.ts:101-101` drifted; first line found nowhere, last line found nowhere". Matches.

## Stryker re-anchoring green: prediction, written before the runs

- Remove `apps/desktop/src/main/project-entry-bridge.ts:101-101` from `stryker.config.json` and its anchor row; the guard now lives in the core's whole-file entry.
- `p4-s4-ranges-green`: exit 0, **41 passed (41)**.
- `p4-s4-mutation-ranges`: exit 0. It reports `stryker.config.json` 18 ranges, 35 whole files, and `desktop-s7` 6 ranges, 3 whole files.

## Stryker re-anchoring green: observed

- `p4-s4-ranges-green.log`: exit 0, **41 passed (41)**. `p4-s4-mutation-ranges.log`: exit 0, `stryker.config.json 18 ranges, 35 whole files`, `stryker.desktop-s7.config.json 6 ranges, 3 whole files`. Matches.

## Bindings: prediction, written before the runs

Each binding edits `harness-request-core.ts` with `bind4.sh` (backup, then restore checked by digest) and runs the six-file P4-B11 command, verbose.

1. **`p4-s4-bind-1`: compare the echo with the caller's input instead of `command.payload`.** `sentEcho = operation.echo?.sent === undefined ? input : sentOf(command)`, so only the payload baseline is replaced; the intent's `sent` rule is untouched.
   - Exit 1, **2 failed**: P4-B10 "correlates a query against the validated command payload instead of caller mutation", and the storage pin "correlates against the validated command payload instead of caller mutation". No other row mutates its input after the call (`Reflect.set` appears elsewhere only on the P4-B9 copies, which never reach the core).
2. **`p4-s4-bind-2`: the stopped guard answers `{ kind: "stopped" }` instead of `unsent`.** Exit 1, at least these **4 failed**:
   - the brief's two pins: workspace "answers the stopped text for a request made after stop" (closing envelope), and entry "settles pending work on malformed input and rejects calls after stop" (`list` closing);
   - the entry row "answers a conversation save with one strict result: a call after stop" (`lost` becomes `uncertain`);
   - `harness-bridges` "shares one core across the three bridges: stop scoped to its bridge" (`list` after the entry stop answers closing).
   
   Rows where `unsent` and `stopped` answer alike still pass: storage (both use the stopped text), and upgrade, read, activation and switch after stop. Any further failing row is explained after the run.
3. **`p4-s4-bind-3`: run the stopped guard before input validation.** The broken answer gets the raw input. Exit 1, **11 failed**, exactly the P4-B9 stopped rows: entry 6, storage 3, workspace 2.
   - **Entry:** activation and switch throw synchronously in their `unavailable` decode. Upgrade, read, save and register resolve with a plain broken or closing object instead of rejecting.
   - **Storage:** `brokenResult` throws synchronously.
   - **Workspace:** `brokenQuery` throws, as does `brokenIntent` over `capabilityForIntent` → `undefined`.
   - Every running row passes.

## Bindings: observed

`harness-request-core.ts` was restored after each run; the digest matched every time (`0b362933…d3b5`).

1. `p4-s4-bind-1.log`: exit 1, **2 failed, 242 passed (244)**, exactly the two predicted rows. Matches.
2. `p4-s4-bind-2.log`: exit 1, **5 failed, 239 passed (244)**: the four predicted rows, plus the workspace pin "stops once and rejects later requests without observing the session" (`workspace-bridge.test.ts:467`, not predicted). **Stronger, explained.** That row's `query` and `submit` after stop expect the stopped text, "Workspace bridge is stopped.". Under the binding they answer the closing envelope. It is the same guard read through a second, already-pinned row.
3. `p4-s4-bind-3.log`: exit 1, **11 failed, 233 passed (244)**: exactly the P4-B9 stopped rows (entry 6, storage 3, workspace 2). Matches.

## Review/refactor: CodeScene on `project-entry-bridge.ts`

- First score: 9.58, from one Large Method: `entryOperations` had 75 lines, against a limit of 70.
- Refactor, with no behavior change: `list` and `register` move to `catalogOperations`, and a small `runner(core, bridge)` turns an operation into its client call. `entryOperations` spreads `catalogOperations` and keeps the five echoing operations.
- The move shifts the lines, so the entry ranges are re-anchored by content, with unchanged texts:
  - `desktop-s7` `project-entry-bridge.ts:75-176` → `:75-194`;
  - `stryker.config.json` `:147-162` → `:165-180`.
- Prediction, written before the runs:
  - `p4-s4-refactor-tests`: the six-file command, exit 0, **244 passed (244)**;
  - `p4-s4-refactor-ranges`: `pnpm check:mutation-ranges`, exit 0, with the same counts (18/35 and 6/3);
  - CodeScene 10 on `project-entry-bridge.ts`.
- Observed: `p4-s4-refactor-tests.log` exit 0, **244 passed (244)**; `p4-s4-refactor-ranges.log` exit 0, 18/35 and 6/3; CodeScene 10 on `project-entry-bridge.ts`. Matches. The bindings ran before this refactor. They edit only `harness-request-core.ts`, which the refactor did not touch, and every row they turned red is unchanged.

## Gate finding: Knip

- `p4-s4-knip.log`: exit 1. Unused exports `decodeReply` (`harness-request-core.ts:169`) and `answerRequest` (`:186`); unused exported type `EchoRule` (`:194`). Cause: the slice moved every caller of the two functions into the core's own `bridgeRequest`, and no other module names `EchoRule`. `rg` finds no use outside `harness-request-core.ts`.
- Fix: drop the three `export` keywords; no body changes. The brief's non-goal "no change to `decodeReply` or `answerRequest`" is about their behavior, which stays the same; only their visibility narrows. This is recorded for the coordinator.
- Prediction, written before the runs:
  - `p4-s4-knip-2`: exit 0;
  - `p4-s4-typecheck-3`: exit 0;
  - `p4-s4-after-knip-tests`: the six-file command, exit 0, **244 passed (244)**;
  - CodeScene on `harness-request-core.ts` stays 10.
- Observed: `p4-s4-knip-2.log` exit 0; `p4-s4-typecheck-3.log` exit 0; `p4-s4-after-knip-tests.log` exit 0, **244 passed (244)**; CodeScene 10 on `harness-request-core.ts`. Matches.
- `p4-s4-jscpd.log` (before this fix; the fix only removes `export` keywords): exit 0, "Found 0 clones."
- `p4-s4-codescene.log` was written before the Knip fix. The rescore of `harness-request-core.ts` after the fix is 10, as recorded here.

## Gates before the candidate

- Structural checks (brief), all as required:
  - `answerRequest(` outside tests appears only in `harness-request-core.ts`;
  - `afterStop`, `keepCore` and "Settle first" appear nowhere in `apps/desktop/src`;
  - `isDeepStrictEqual`, `if (stopped)` and `isStopped()` appear in none of the three bridges;
  - there is no `decodeStrict(...RequestSchema` in `project-entry-bridge.ts`;
  - the existing rows of the three test files are unedited (`git diff --numstat`: additions only).
- CPU rule: one reading, 18.2/16.5/12.9%, 0 League*/TFT* processes, 11.3 GB free.
- `p4-s4-check.log`: `pnpm check` exit 0. **120 files, 3881 passed (3881)**, which is 3858 plus 23 new rows. Dependency-cruiser found no violations.
- Integration exposure: every renderer request now goes through the skeleton.
  - The e2e journeys (`projects`, `registration`, `conversation`, `conversation-accessibility`, `project-upgrade`, `shell`) and `package:launch-smoke` run at the Phase 4 final `check:deep`. Pedro chose no e2e run on this candidate.
  - Harness integration is unaffected (no wire change).

## Follow-up (coordinator decision on verifier V1): the valid-kind intent row

- New P4-B9 rows (running and stopped) in `workspace-bridge.test.ts`: `submit (valid kind)`, a `memory.proposal.review` intent whose `projectId` is the marker. The oracle is the same as the other P4-B9 rows. `withInvalid` now takes any `PropertyKey`, because `projectId` is not a key common to every intent variant.
- `harness-bridges.ts` TSDoc: `release()` stops every bridge; a stop of an already-stopped bridge does nothing.
- **Red at base: prediction, written before the run.**
  - Method: back up the five source files that differ from base (`harness-request-core.ts`, `harness-bridges.ts`, `project-entry-bridge.ts`, `project-storage-bridge.ts`, `workspace-bridge.ts`) with their digests. Write their `9649ef3` contents with `git show`, run, restore from the backups and check the digests.
  - `p4-s4-v1-red-base`: `pnpm exec vitest run --config vitest.main.config.ts src/main/workspace-bridge.test.ts -t "valid kind"` in `apps/desktop`: exit 1, **2 failed** (the other rows are skipped by the filter).
  - Both fail at `rejects.toThrow`, because the promise resolves a broken envelope:
    - running resolves through `invalid-command`, with `brokenIntent("memory", …)`;
    - stopped resolves through the guard, with the stopped text.
- **Green at the candidate: prediction.** `p4-s4-v1-green`: the workspace and bridges files with `--config vitest.main.config.ts`, exit 0, **52 passed** (workspace 37 + 2, bridges 13).
- **Red at base: observed.** `p4-s4-v1-red-base.log`: exit 1, **2 failed, 37 skipped (39)**. Both rows fail with "promise resolved "{ status: 'broken', … }" instead of rejecting" (`WORKSPACE_TRANSPORT_FAILED`). The five files were restored, and `sha256sum -c` printed OK for all five. Matches.
- **Green and gates: observed.**
  - `p4-s4-v1-green.log`: exit 0, **52 passed (52)**. Matches.
  - `p4-s4-v1-typecheck` (desktop): exit 0.
  - `p4-s4-v1-biome`: "No fixes applied", exit 0.
  - `p4-s4-v1-knip`: exit 0.
  - `p4-s4-v1-mutation-ranges`: exit 0.
  - `p4-s4-v1-codescene.log`: 10 on both touched files.
  - By the coordinator's decision, there is no `pnpm check` rerun and no second verifier round.
