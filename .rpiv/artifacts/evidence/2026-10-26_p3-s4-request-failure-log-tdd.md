# TDD evidence: p3-s4-request-failure-log

- Design: `.rpiv/artifacts/designs/2026-10-25_12-24-03_arch-review-phase-3-failure-classification.md` (Follow-up "slice p3-s4-request-failure-log detailed"), `content_hash cf336cff…`, approved copy `approved-e4a0b109.md`; append-only check at start: `keep`. Q18-Q24 (a). Contract commit: `1bba9ac` (the brief alone).
- Base: `1bba9ac` (the s3 head `9e2fdde` plus the contract commit).
- Raw logs (gitignored, local): `.rpiv/evidence/2026-10-25_12-24-03_arch-review-phase-3-failure-classification/p3-s4-*.log` in the main checkout.

## P3-B18 (Q24 (a)), written before any code, sent to the coordinator for his check

**Behavior P3-B18: the start's reconciliation warning reaches the desktop log as one exact line.**

- Bound by Q24 (a): a protocol schema for the line (`code`, level 40, a fixed message) and a fourth forwarder kind, with one row on each side.
- **Protocol (owner, `harness-fatal-log-protocol.ts`, exported from `index.ts`):**
  - `harnessReconciliationFailureCode = "REGISTRATION_RECONCILIATION_FAILED"` and its fixed message `"Registration reconciliation failed."`;
  - `HarnessReconciliationFailureLogLineSchema`: exactly `{ level: 40, time: <epoch ms>, service: "harness", code: "REGISTRATION_RECONCILIATION_FAILED", msg: "Registration reconciliation failed." }`, decoded strictly (no other key).
  - This schema is interface scaffolding for the two rows below; it is written first, without behaviour, so the rows' reds are behavioural.
- **Harness writer (`process-bootstrap.ts:304`):** `logger.warn({ code: "REGISTRATION_RECONCILIATION_FAILED" }, "Registration reconciliation failed.")`, through the `HarnessLog` service (Q22). Same object, same level; only the message is added. Nothing else in the line.
- **Desktop forwarder (`harness-log-lines.ts`):** a fourth candidate kind, `code === "REGISTRATION_RECONCILIATION_FAILED"` at level 40, decoded strictly with the schema and logged as `logger.warn({ source: "harness", attempt, code: "REGISTRATION_RECONCILIATION_FAILED", harnessTime: <ISO of time> }, "Harness registration reconciliation failure.")`. A line that fails the decode logs `warn({ code: "HARNESS_LOG_LINE_INVALID", attempt, reconciliationCode: "REGISTRATION_RECONCILIATION_FAILED" }, "Harness reconciliation log line rejected.")` (the same shape as the upgrade and fatal kinds).

**Rows:**

1. **Harness side.** In `tests/integration/registration-restart-reconciliation.integration.test.ts`, "keeps the gate answer when the start's reconciliation fails":
   - Given: the existing scenario, where the restart's reconciliation fails on an inaccessible-process fault.
   - When: the process runtime starts with a logger that tees each call to `createHarnessLogger(<captured destination>)`, the real Pino options.
   - Then: the existing assertions stay, `recording.warnings` included. The destination holds exactly one line with that `code`, and it decodes strictly with `HarnessReconciliationFailureLogLineSchema` as `{ level: 40, service: "harness", code: "REGISTRATION_RECONCILIATION_FAILED", msg: "Registration reconciliation failed." }` plus `time`.
   - Expected red, with the schema already in place: the strict decode fails because the line has no `msg`. Today the writer passes no message, so Pino writes no `msg` key.
2. **Desktop side.** In `apps/desktop/src/main/harness-log-lines.test.ts`:
   - Given: a valid line (the schema's accepted shape, JSON text plus newline).
   - When: it goes through the forwarder.
   - Then: exactly one `warn` call, `({ source: "harness", attempt, code: "REGISTRATION_RECONCILIATION_FAILED", harnessTime: <ISO of time> }, "Harness registration reconciliation failure.")`, with no `level`, `time`, `service` or `msg` key.
   - Expected red: zero calls, because the forwarder drops the line today.

**For the coordinator to decide (it is beyond "one row on each side"):** 3. a desktop invalid row, where the same line with an extra `message` key gives exactly one `warn({ code: "HARNESS_LOG_LINE_INVALID", attempt, reconciliationCode: "REGISTRATION_RECONCILIATION_FAILED" }, "Harness reconciliation log line rejected.")`. Its expected red is zero calls. Without it, the invalid branch of the fourth kind has no row (the upgrade and fatal kinds each have one). I recommend adding it.

**Bindings:**

- b18a: the writer at `:304` passes no message → harness row 1 fails on the strict decode (`msg` is missing).
- b18b: the forwarder accepts the reconciliation code only at level 60 → desktop row 2 fails (0 calls).
- b18c (only with row 3): the forwarder skips the decode and forwards the raw object → row 3 fails (it gets the forwarded call, not `HARNESS_LOG_LINE_INVALID`).

**Redaction:** the line carries only the code, the level, the time, the service and a fixed message. No path, cause or registry value is added.

**Coordinator check (2026-10-26):** P3-B18 approved as written, including row 3. Conditions: row 1 keeps every existing assertion; row 2 also asserts zero calls for the same code at levels 50 and 60; b18a-c applied by hand and restored by digest; row 1 is a light Windows integration run, alone.

## P3-B11 red (run before the prediction-table instruction arrived; disclosed)

- `p3-s4-b11-red.log`: 24 new rows failed with `TypeError: Cannot read properties of undefined (reading 'ast')` (the schema is not exported), 38 existing fatal rows passed. Matches the contract's Expected red.

## Static prediction for P3-B12 to P3-B17 (read from the code at `1bba9ac`, before their reds)

| Behavior | Row | Site reached | Predicted value / summary | Predicted red |
|---|---|---|---|---|
| P3-B12 | `Error(<path>, { cause })` at `harness.message` | writer | `[{ kind: "error" }]`, 0 omitted; no `private`, `slopstop.db`, `secret`, `C:\`, `stack` in the raw text | module missing (import fails) |
| P3-B12 | `canonicalLedgerRefusal("ORIGINAL_RECEIPT_ORPHANED")` | writer | `[{ tag: "CanonicalLedgerRefusal" }]` | same |
| P3-B12 | `AggregateError` of 17 | writer | 16 entries, `omittedFailures: 1` | same |
| P3-B12 | `project-storage.owner` | writer | `answered: "PROJECT_STORAGE_OWNER_FAILED"` | same |
| P3-B12 | `warn` throws | writer | `requestFailed` returns | same |
| P3-B13 | `harness-runtime.test.ts:172` round-trip | `:407` | 2 calls, in order, each the rejected `Error` (`toBe`) | `expected [] to deeply equal [...]` |
| P3-B13 | `:813` Project dispatch throws | `:407` | 1 call, the thrown `Error` | same |
| P3-B13 | `:694` application rejection | `:407` | 1 call | same |
| P3-B13 | `:864` invalid notification | `:417` | 1 call, `instanceof Schema.SchemaError` (`decodeStrict` inside the `try`) | same |
| P3-B13 | `failureScopeCases` kind `notification` | `:417` | 1 call | same |
| P3-B13 | `:1335` "handle dies" | `:350` | 1 call, the defect (`toBe`), via `Cause.squash` | same |
| P3-B13 | `:1340` "handle interrupts itself before any stop" | `:350` (`stopPromise` undefined, so it does not return at `:349`) | 1 call, an `Error` with message `All fibers interrupted without error` | same |
| P3-B13 | protocol-invalid rows, successes, `:1280` interrupt at dispose | none (`:386-392` answers without a catch; `:349` returns) | 0 calls | green at the base (pin) |
| P3-B14 | `project-storage-application.test.ts:104-109` owner throws | `:117` | 1 call, the thrown `Error` (`toBe`); answer unchanged | zero calls |
| P3-B14 | owner `broken` / `unavailable` / invalid `ready` | none: the invalid `ready` path uses `decodeStrictResult` → `PROJECT_STORAGE_RESULT_INVALID`, no throw | 0 calls | green at the base (pin) |
| P3-B14 | `workspace-application.test.ts:164` `query` throws | `:147` | 1 `workspace.query` call | zero calls |
| P3-B14 | `:108` `submit` throws | `:192` | 1 `workspace.intent` call | zero calls |
| P3-B14 | invalid projection | none: `readyQueryResult` returns `undefined` → `WORKSPACE_PROJECTION_INVALID`, no throw | 0 calls | green at the base (pin) |
| P3-B15 | `transport.send` throws once on the `system.ready` answer | `:407` (the throw rejects `handleMessage`) | 1 line `boundary: "harness.message"`, `answered: "HARNESS_INTERNAL_FAILURE"`, `[{ kind: "error" }]`; the next `send` is `request.failure` `HARNESS_INTERNAL_FAILURE` | zero lines with that code |
| P3-B16 | valid line / extra `message` / level 30 | forwarder | 1 forwarded `warn` / 1 `HARNESS_LOG_LINE_INVALID` / 0 calls | zero calls on the valid row (and on the invalid row) |
| P3-B17 | every journey | e2e | zero `"Harness request failure."` lines | none (pin; coordinator GO) |
| P3-B18 | rows 1-3 | `process-bootstrap.ts:304`, forwarder | as approved | as approved |

## Coordinator notes and decisions recorded during the slice

- Prediction table accepted; P3-B11's early red accepted as disclosed. Zero-call pins assert exactly `[]` on the port; the `:350` self-interrupt row pins the exact squashed message and exactly one call.
- **Command note (coordinator, recorded; the brief is not edited):** the contract's desktop command `pnpm --filter @slopstop/desktop exec vitest run src/main/harness-log-lines.test.ts` finds no file, because the default desktop config is the renderer's. Main-process tests run with `--config vitest.main.config.ts`, used throughout.
- **Port on `createUnavailableProjectStorageApplication` (coordinator accepted):** it delegates to `createProjectStorageApplication`, so it takes the port as a required parameter too. A silent default there would be a silent port in production code, against degrade-distinguishes-broken.

## Reds (each matched its prediction; logs `p3-s4-*-red*.log`)

- P3-B12 (`p3-s4-b12-red.log`): `Cannot find module './harness-request-diagnostics.js'`.
- P3-B13 (`p3-s4-b13-red.log` + `.json`): 7 rows, `expected [] to have a length of N but got +0` (the round trip expects 2; the others expect 1); the zero-call pins passed. This is the contract's zero-call red, worded as a length check.
- P3-B14 (`p3-s4-b14-red.log` + `.json`): the 3 throwing rows, zero calls; the pins passed.
- P3-B15 (`p3-s4-b15-red-3.log`): zero request-failure lines (`-red.log` and `-red-2.log` did not load the file, because of a newline quoting slip in the shared destination; they prove nothing).
- P3-B16 and P3-B18 desktop (`p3-s4-b16-b18-desktop-red-3.log` + `.json`; `-red.log`, `-red-2.log` found no file, see the command note): the valid and invalid rows for both kinds, zero calls; level 30, 50 and 60 drop pins passed.
- P3-B18 harness row 1 (`p3-s4-b18-harness-red.log`, schema scaffold in place): `SchemaError: Missing key at ["msg"]`.

## Implementation

- Protocol: `HARNESS_REQUEST_BOUNDARIES`, `harnessRequestBoundaryAnswers`, `harnessRequestFailureCode`, `harnessRequestFailureMessage`, `HarnessRequestFailureLogLineSchema` (a union by boundary over the shared summary fields); `harnessReconciliationFailureCode`, `harnessReconciliationFailureMessage`, `HarnessReconciliationFailureLogLineSchema`.
- `harness-request-diagnostics.ts`: `createHarnessRequestDiagnostics(logger)` writes `warn({ code, boundary, answered, ...summarizeHarnessFailure(failure) }, message)` and swallows a throwing logger.
- The 6 boundaries call `requestFailed` once, then answer as before (`:350` passes `Cause.squash(exit.cause)`); no `catch {` remains at the four catch sites.
- `process-bootstrap.ts`: `HarnessLog` (one service, built by the Layer) replaces `UpgradeLog`; `HarnessProcessLogger` is the two Pino calls with an optional message; the diagnostics are built once from `HarnessLog` in the existing `runSync` and passed to the runtime and both applications; the reconciliation warning now carries its fixed message.
- Desktop forwarder: two level-40 kinds (request failure, reconciliation), each strictly decoded with its own invalid-line diagnostic; the dispatch is a `switch` (CodeScene: the if-chain was complexity 9).
- Q20 migration: 19 test files; checked with a whitespace-insensitive word diff that only the port was added (plus Biome re-wraps); no assertion changed. Shared test fixtures in `tests/integration/request-diagnostics-fixture.ts` (silent, recording, and the memory log destination, so no test copies it).

## Greens

- Protocol (`p3-s4-b11-green.log`) 62; harness units B12-B15 (`p3-s4-b12-b15-green.log`) 135; desktop forwarder (`p3-s4-b16-b18-desktop-green.log`) 31; P3-B18 harness row 1 (`p3-s4-b18-harness-green.log`) 1 passed, 2 s.
- Integration batch (coordinator GO (a); `p3-s4-integration-batch.log`): 50 files, 48 passed and 2 skipped, 1704 tests passed and 2 skipped, exit 0, 380 s. The 2 skipped are the e2e UI seed files (`project-upgrade-ui-seed`, `conversation-journey-ui-seed`), which run only when their seed environment variable is set.

## Bindings (each applied by hand, its row failing, restored by digest)

1. `:417` call deleted (`p3-s4-binding-1.log`): `turns an invalid workspace notification into harness failure` fails.
2. `err: failure` spread into the line (`-2`): 4 writer rows fail on the strict decode (including the raw-text row).
3. Workspace boundary literals swapped (`-3`): both workspace rows fail.
4. A no-op port in `launchHarnessProcessRuntime` (`-4`): the P3-B15 row fails (no line).
5. Request lines accepted only at level 60 (`-5`): the valid and invalid request rows fail (0 calls).
6. `:350` passes `exit.cause` (`-6`): "handle dies" and "handle interrupts itself" fail.
7. Port argument deleted at one `createProjectStorageApplication` call (`-7`): `pnpm typecheck` exit 1, `TS2554: Expected 2 arguments, but got 1.`
- b18a, the writer without its message (`-b18a`): harness row 1 fails. b18b, reconciliation only at level 60 (`-b18b`): the valid row, the invalid row and the level-60 drop row fail. b18c, the decode skipped (`-b18c`): the invalid row fails (it gets the forwarded call).
- Bindings 5, b18b and b18c ran before the forwarder's `switch` refactor; they target `candidateOf` and the decoders, which the refactor did not touch (31 passed after it).

## CodeScene and the test move

- `harness-runtime.test.ts` reached 1013 lines (9.38). The self-contained "registration requests on the process runtime" block moved unchanged to `harness-runtime-registration.test.ts` (with its two small helpers); both files score 10 and run the same 104 tests.
- 10 on every other touched file (the protocol `index.ts` has no score).

## Structural checks

- `catch \{` in the three files: nothing. `requestFailed(` outside tests: 6 call lines, one per boundary (plus the method's declaration in the type). `function summarizeHarnessFailure`: only `process-fatal-diagnostics.ts`; its callers: `process-fatal-diagnostics.ts` and `harness-request-diagnostics.ts`. `HARNESS_REQUEST_FAILED`: defined once (`harness-fatal-log-protocol.ts:148`); the forwarder imports `HarnessRequestFailureLogLineSchema`. `runPromise|runFork|ManagedRuntime` in the diagnostics and the two applications: nothing.

## Candidate gates, first attempt at `3c5e7fb` (stopped)

- `pnpm check:duplicates` (`p3-s4-duplicates.log`): **exit 1**, 3 clones, all from this slice:
  - two existing near-identical `startHarnessRuntime` option blocks pushed over the 60-token threshold by the added port line (`harness-runtime-shutdown.test.ts` 323-333 / 374-383, `harness-runtime.test.ts` 617-628 / 682-693);
  - `memoryLogDestination` copying `harness-logger.integration.test.ts`' `memoryDestination`.
- Stopped and reported; `check:dead-code` and `pnpm check` were not run.
- Fix (coordinator GO; test-only, follow-up commit, `jscpd.json` untouched):
  - `harness-runtime-shutdown.test.ts`: a local `unusedRuntimeOptions()`; each block spreads it and sets its own listing, database and runtime;
  - `harness-runtime.test.ts`: a local `startWorkspaceRuntime(transport, workspaceApplication, firstId)` for the two workspace blocks;
  - `harness-logger.integration.test.ts`: uses the fixture's `memoryLogDestination` and drops its copy.
- Word diff of the fix (`git diff -w --word-diff=porcelain`): 0 changed words matching `expect(`, `toBe`, `toEqual`, `toMatch`, `toHave`, `toThrow`, `rejects` or `resolves`. jscpd on the four files: 0 clones.
- The two unit files (`p3-s4-clonefix-units.log`): 114 passed; the logger integration file (`p3-s4-clonefix-logger.log`): 4 passed. CodeScene 10 on all three files.
- The registration-block move (`harness-runtime-registration.test.ts`, unchanged, 104 tests) was approved by the coordinator.

## Candidate gates at `1dea982`, then the P3-B17 pin

- `pnpm check:duplicates` (`p3-s4-duplicates-2.log`): exit 0, 0 clones. `pnpm check:dead-code` (`p3-s4-dead-code.log`, patch digest empty, so exactly `1dea982`): exit 0, Knip clean. `pnpm check` (`p3-s4-check.log`, run without a CPU wait per Pedro's machine-busy GO): exit 0, 112 files, 3672 tests, 51 advisory unchanged, dependency-cruiser clean.
- **P3-B17 pin** (written after those gates, so not yet run): `expectDesktopLog` now also asserts zero desktop log lines with `msg: "Harness request failure."`, beside the existing `HARNESS_LOG_LINE_` refusal. `pnpm typecheck` (`p3-s4-typecheck-b17.log`) exit 0; Biome clean; CodeScene 10. Its run needs the coordinator's separate GO (the e2e journeys, alone); it also runs in `check:deep`.

## Preflight (candidate `0dacc06`, base `1bba9ac`)

- Candidate patch: `p3-s4-candidate-0dacc06.patch` (`git diff --binary 1bba9ac..0dacc06`, sha256 `27973c4e…6119`, 33 files, +1347 −383). `lane.mjs --range`: normal (456 lines > 150).
- `slice-preflight` from the root, `packages/protocol/src`, `apps/harness/src`, `apps/desktop/src/main`, `apps/harness/tests/integration` and `apps/desktop/tests/e2e` (`p3-s4-preflight*.log`): exit 0, `preflight: partial`, the same seven lines everywhere: `unchecked` for P3-B11 to P3-B17 (the contract names test files and fixtures, not test titles). Plus `diagnostic: the candidate's parent is not the base` (three commits: slice, clone fix, pin). No `missing-test-file`, no `missing-test-title`, no `broken`. Brief format, the s1/s3 class (rpiv issue #3); the brief is not edited. P3-B11 to P3-B17 go to the slice-verifier as unchecked reviewer focus.
- Fact for P3-B17: the brief says `expectDesktopLog` is "used by every journey"; at `0dacc06` only `conversation.test.ts` (two calls) and `project-upgrade.test.ts` (one call) call it.

## Slice-verifier round 1 (candidate `0dacc06`, base `1bba9ac`)

- `rpiv:slice-verifier`, candidate mode, frozen patch `p3-s4-candidate-0dacc06.patch`. Result: **failed**, two violations and one warning.
- **V1 (Decisions, violation):** the P3-B17 / Q23 (a) pin sits only in `expectDesktopLog`, called by `conversation.test.ts` (two calls) and `project-upgrade.test.ts` (one); `registration.test.ts`, `projects.test.ts`, `shell.test.ts`, `renderer-foundation.test.ts`, `conversation-accessibility.test.ts` and `single-instance.test.ts` never assert it, and registration and projects drive the reachable boundary catches. The brief's "used by every journey" (`:855`) was a wrong premise. Options: (a) a shared refusal helper called by every journey that launches the built desktop; (b) an approved append-only amendment narrowing Q23.
- **V2 (Cross-slice, violation), confirmed by me:** `stryker.project-storage.config.json` targets `harness-runtime.ts` by line ranges that were exact at base; the slice shifts them (base `:349-350` guard and internal failure are now `:352-354`, outside `:335-351`; the stop tail `:447-452` leaves `:425-446`; four more ranges off by 3). `apps/harness/vitest.project-storage-mutation.config.ts` does not include the moved `harness-runtime-registration.test.ts`. Fix: config only (add the file, re-derive the ranges to `:91-103`, `:110-121`, `:181`, `:187-190`, `:244-247`, `:338-355`, `:431-452`); the `process-bootstrap.ts` ranges were already stale at base.
- **V3 (Cross-slice, warning):** `harnessRequestBoundaryAnswers` is a `string`-typed second copy of codes the sites still hard-code; only `harness.message` is cross-checked (P3-B15). No consequence today.
- Refuted: upgrade and fatal lines still flow and decode after the `HarnessLog` swap; no boundary logs a message, cause or stack; logging cannot change an answer. P3-B11..B16 and B18, Q18-Q22 and Q24 hold; the bindings guard real mechanisms; the Q20 migration weakened no assertion.
- Open (H1): a request in flight at close could log a request failure and make the pin fail; only the e2e run can settle it.
- Polish: new test literals lost backslashes (`"C:private"`, `"C:private\registry"`); "moved unchanged" is loose (the block gained the P3-B13 assertions and a fourth helper parameter); `warningKinds[code]` reads inherited keys (`Object.hasOwn` or a `Map` is exact); one TSDoc line is over width.

## Verifier round 1 fixes (coordinator decisions; no round 2)

- **V1 (a), `56a8d62`:** `electron-launch.ts` exports `expectNoHarnessRequestFailure(userData, fromLine = 0)` (no `msg: "Harness request failure."` line and no `HARNESS_LOG_LINE_` code from `fromLine` on) and `desktopLogLength(userData)`; `expectDesktopLog` calls the helper. Every journey that launches the built desktop calls it after its last close: `registration` (4), `projects` (1), `renderer-foundation` (6), `conversation-accessibility` (2, the loop counts once), `single-instance` (both userData folders), `shell` (`afterEach`), and `conversation` and `project-upgrade` through `expectDesktopLog`. `shell.test.ts` runs on the default userData, so it reads only the lines after its launch (offset taken right after `electron.launch`; residual: a failure written before that read would be missed). Helper binding (`p3-s4-v1-helper-binding.log`, temporary spec, deleted after): clean log and missing log pass; a request-failure line, an invalid-line code and a newer line past the offset each fail; an older line before the offset is skipped. 5 passed. CodeScene 10 on the seven files.
- **V2, `e3b9171`:** ranges re-derived by line diff (`remap.py`): harness-runtime.ts from `1bba9ac`, process-bootstrap.ts from `4cf6541` (the commit that wrote them). Each new range holds byte-identical code to its old target; only `338-355` gains the new `requestFailed` line.

  | File | Old | New | Mutants old-on-written / new-on-candidate / old-on-candidate (unfixed) |
  |---|---|---|---|
  | harness-runtime.ts | 88-100 | 91-103 | 9 / 9 / 7 |
  | harness-runtime.ts | 107-118 | 110-121 | 12 / 12 / 9 |
  | harness-runtime.ts | 178-178 | 181-181 | 1 / 1 / 0 |
  | harness-runtime.ts | 184-187 | 187-190 | 7 / 7 / 4 |
  | harness-runtime.ts | 241-244 | 244-247 | 2 / 2 / 0 |
  | harness-runtime.ts | 335-351 | 338-355 | 18 / 19 (+1: the `requestFailed` boundary literal) / 13 |
  | harness-runtime.ts | 425-446 | 431-452 | 15 / 15 / 13 |
  | process-bootstrap.ts | 275-281 | 274-282 | 1 / 1 / 0 |
  | process-bootstrap.ts | 81-93 | 58-70 | 4 / 4 / 3 |
  | process-bootstrap.ts | 95-100 | 72-77 | 3 / 3 / 0 |
  | process-bootstrap.ts | 107-119 | 84-96 | 6 / 6 / 5 |
  | process-bootstrap.ts | 126-166 | 103-143 | 23 / 23 / 10 |

  `harness-runtime-registration.test.ts` added to `vitest.project-storage-mutation.config.ts`. Counts come from Stryker's own instrumenter per range (`range-mutants.mjs`; `p3-s4-v2-range-mutants*.log`). Stryker dry run (`p3-s4-v2-stryker-dryrun.log`, `--dryRunOnly`): exit 0, 29 files, 3749 mutants instrumented, initial run 604 tests passed in 3 min 32 s, the moved registration file in the run.
- **V3, `1c79255`:** `harnessRequestBoundaryAnswers` satisfies `Record<HarnessRequestBoundary, string>` and, per boundary, `HarnessFailureCode`, `ProjectStorageDiagnosticCode` or `WorkspaceDiagnostic["code"]`. Bindings (`p3-s4-v3-binding-{a,b,c,d}.log`), each typecheck exit 1: a project-storage code under `harness.message` (TS2322), a workspace code under `project-storage.owner` (TS2322), a harness code under `workspace.query` (TS2322), the `workspace.intent` entry removed (TS1360). Protocol tests 62 passed; CodeScene 10.
- **Polish, `8baf96f`:** `warningKinds` is a `Map` (binding `p3-s4-polish-map-binding.log`: dropping the reconciliation entry fails the two reconciliation rows); path literals escaped again (`"C:\private\project"`, `"C:\private\registry"`, tag `"C:\private"`); one TSDoc line rewrapped. The optional inherited-key row was not added: with the old object lookup the `switch` already dropped such a line, so the row would pass on both versions and bite nothing. Reruns: protocol 62, forwarder 31; CodeScene 10.
- **Wording correction:** where this record says the registration block was "moved unchanged", read "moved, with the P3-B13 assertions and a fourth helper parameter added" (verifier round 1 polish).

## Gates after the round-1 fixes (candidate `8baf96f`)

- `pnpm check:duplicates` (`p3-s4-r1-duplicates.log`): exit 0, 0 clones. `pnpm check:dead-code` (`p3-s4-r1-dead-code.log`): exit 0.
- `pnpm check`, first run (`p3-s4-r1-check.log`): exit 1. Three `check-effect-diagnostics.test.mjs` rows ("fails on a planted Effect error": `unknownInEffectCatch`, `newPromise`, `clean`) timed out at the 5000 ms default while League, TFT and TFTAcademy ran (CPU 66%); 3669 other tests passed. Reported before any rerun; Pedro decided one rerun on a free machine.
- `pnpm check`, rerun (`p3-s4-r1-check-2.log`, CPU 10%, no League/TFT/Overwolf process): exit 0, 112 files, 3672 tests, 51 advisory unchanged, dependency-cruiser clean. The three rows passed within the default, so the first failure was machine load, not a defect.
- Full e2e, once, alone (`p3-s4-r1-e2e.log`, `pnpm test:e2e` from `apps/desktop`: Forge package, then Playwright): exit 0, 27 passed in 5.1 min. Every journey now runs the request-failure refusal; no request-failure line appeared (H1 not seen).
