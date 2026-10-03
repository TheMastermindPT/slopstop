---
date: 2026-10-03
author: OpenCode
commit: 11b1989
branch: feat/effect-migration
repository: slopstop
status: in-progress
---

# Effect Migration — Unit 1 Independent Review

Reviewer: OpenCode. Author: Claude, existing Herdr session `70d2264c-812f-43f3-9930-4a708f894feb`. Scope: replacement of Zod schemas and consumers, not the later Effect service/runtime migration. User-approved workflow is one coherent review per step, with focused remediation and truthful retained failures.

## Reviewed Input And Outcome

Candidate: `C:/Users/pedro/Documents/GitHub/ragnarok-effect`, branch `feat/effect-migration`, base `11b1989bc0cce91df6a8b3e1bbac54a5f5f2267b`. Author froze153 modified and4 added files. The handoff is retained at the Claude scratchpad `unit1-handoff.md`, with follow-up messages listing exact logs and their limitations. No candidate commit or migration acceptance was granted.

**Initial review requires changes:** resource-staging order is not deterministic, and runtime diagnostic metadata exists solely for old test assertions. These findings were returned to Claude together as one remediation round. OpenCode did not edit the implementation worktree.

## Findings

### R1 — Packaging completion can precede runtime staging

`apps/desktop/vite.harness.config.ts` copies migrations/native runtime packages asynchronously in `closeBundle`. The installed Forge Vite plugin (`node_modules/@electron-forge/plugin-vite/src/VitePlugin.ts:262-329`) prepends a `build-done` plugin whose `closeBundle` resolves the build-completion promise at lines288–292. That signal can precede completion of our parallel async copy hook.

The author observed an asar missing the libSQL Windows binding when staging the full Effect package. Restricting Effect to runtime files reduced staging time and made resource preflight pass, but does not establish an ordering guarantee. Keep that size optimization independently; move/coordinate staging through an awaited build/Forge boundary that completes before packaging proceeds. Prove the barrier with a controlled delayed copy and confirm the packaged worker resources. Do not replace the dependency with a sleep or an assumed copy duration.

Sources: installed plugin code above and [Rollup writeBundle documentation](https://rollupjs.org/plugin-development/#writebundle), which describes an asynchronous hook at the end of writing. Vite8/Rolldown behavior must be checked in the actual corrective implementation.

### R2 — Test-only schema diagnostic details should not enlarge production compatibility code

Baseline `packages/protocol/src/protocol.ts` exposes `ProtocolParseIssue` as `code` and `path`. The candidate's richer `message`, `keys` and `branches` summaries are consumed only by protocol tests/test-support, not production applications. Preserve the required public code/path policy, including whole-union behavior, while moving Effect-native extraction of test-only details into test support. Do not weaken accept/reject, excess-key or path assertions to make migration pass.

## Evidence Verified And Qualifications

- Author reports all package typechecks including tests passing and987/987 kernel/protocol tests, including characterization. Parent inspected the exact validators for strict nested keys, safe integers, shallow freezing and preserved public diagnostic shape during implementation.
- `integration-effect2.log` and `integration-baseline.log`: parent independently compared sorted full `FAIL` header lines, including project/file/test path and repeated names:200/200 equal. The author supplied finer first-error TSVs with141 rows each; a random temporary-path value was the reported difference. These reports retain168 reported failures; neither is a passing integration gate.
- Unit run reports2370 passed,19 failed,2 skipped and a worker crash. The reported counts do not cover all2484 announced cases; the missing results are not assumed passed. The author's baseline affected-file unit reruns were console-only, not retained full proof; a bounded retained comparison was requested rather than another complete suite.
- Integration runs also have incomplete terminal reporting due to worker failures. Equal observed failing sets cannot establish correctness of uncompleted cases.
- Projects Electron journey passes. Two shell E2E failures also appear at baseline. Package smoke fails at the bootstrap-timeout stage both before and after migration; this is separate from R1's runtime-copy problem.
- A baseline-Zod-created registry was read with Effect and its persisted fingerprints checked. The temporary test was deleted from the worktree but its source was retained in the scratchpad; parent requested exact source/command/result references. This is migration evidence, not a new permanent legacy compatibility path.
- Baseline comparisons temporarily stashed only the author's own changes; restoration counts were console-only. No broad baseline pass or exact restoration manifest is inferred from counts alone. Subsequent comparisons should use the preserved clean `ragnarok-pc-s1` worktree instead of further stash cycles.
- Symbol-key input narrowing is recorded for the empty-object schema. JSON/structured-clone behavior remains the relevant process contract; no universal claim about arbitrary in-process objects was made by this review.

## SQL Collaboration At This Checkpoint

Claude supports retaining the libSQL worker as a native edge and migrating its parent-side coordination to Effect; Drizzle remains a schema tool. Effect SQL inside the worker might not remove enough responsibility to justify an additional layer. This is a joint recommendation, not a user-approved client choice.

The current worker source explicitly forces GC after closing its last SDK client. This is consistent with the observed file-release difference in the [SQL experiment](../research/2026-10-03_effect-sql-windows-experiment.md), but a comment alone does not prove native-finalizer causation or explain historic crashes. No extra GC flags were enabled on the application's utility process. Any such change remains a separate decision.

## Next Checkpoint

Claude may implement R1/R2 and retain focused test/type/package evidence, then freeze again. Existing baseline failures remain on the milestone's unresolved list; they are not dismissed or counted as migration successes. No second migration unit, commit or main merge is authorized by this initial review record. The later SQL choice is recorded separately in `2026-10-03_effect-sql-owner-decision.md`.

## Remediation Re-review — R1/R2 Resolved

Parent verified the frozen tracked patch against the actual worktree: SHA-256 `ec0dc281fec9371807d40b34b4b3cc830389ed0ffd3c776b0a5e4e6983269082`,155 modified files and six added files, with an empty index. Base remains `11b1989bc0cce91df6a8b3e1bbac54a5f5f2267b`. This is a technical checkpoint within the ongoing complete migration, not user acceptance or a passing global gate.

### R1

Staging now uses the awaited `writeBundle` boundary through `apps/desktop/build/harness-runtime-staging-plugin.ts`. A real Vite contract test holds staging pending and observes Forge-style completion. Parent read the actual source and retained results:

- `staging-contract-red-closeBundle.log`: the baseline hook shape produces `build-done` before `stage-start`, demonstrating the ordering defect directly.
- `staging-contract-green-writeBundle.log`: passes with `stage-start`, `stage-end`, then `build-done`.
- `r1-package.log`: package build succeeds.
- `r1-asar-inspection.log`: libSQL Windows binding exists, its native binary is unpacked, and the498 staged Effect runtime files include `dist/index.js`.
- `r1-e2e-projects.log`: the real Electron Projects journey passes using the staged `.vite` output and SQLite worker.
- `r1-package-smoke.log`: resource preflight passes, but the fused packaged executable still times out at the baseline bootstrap scenario. **A successful worker launch from that packaged executable is not proven.**

R1 is resolved as an ordering defect. The smaller runtime-only Effect copy remains a separate valid size optimization. Test-maintenance note: release the held staging promise and await the build in a finally block if this regression test is changed later, so a failing assertion cannot leave its test build pending. This is not a new production blocker or reason for another broad run.

### R2

Production `summarizeSchemaError` now returns only code/path. Message/key extraction and detailed assertions live in test support and operate on Effect issues. The shared internal issue walker retains an `expandWholeUnions` option used by test support; it is not exported from the protocol index or a Zod runtime API. This is a nonblocking simplification note, not an unresolved public-data leak. No additional rewrite cycle was requested merely for that option.

Protocol/kernel987/987, all package typechecks, format/lint/boundaries and the focused staged Electron journey are reported and retained. No direct Zod source/test import or direct dependency remains; transitive development-tool dependencies are untouched.

### Baseline Comparison And Remaining Proof

The previously console-only19-case comparison is now retained. `unit19-baseline-pc-s1.log` and `unit19-migrated.log` ran the same four files; each reports19 failed/175 passed. Their full-name/first-error TSVs are byte-identical, SHA-256 `da351e9e4b1a0b72022769d8efcb1c17399eafc1b531123f5dd3125b97a1c88f`. Parent independently checked that identity. Baseline source was the preserved clean registration worktree at11b1989, not another stash cycle.

The retained baseline-record proof source shows the migrated decoder reading two baseline-written proposals/reservations/publications and comparing stored fingerprints, then listing both Projects. Its source/command/result header is preserved as `retained-baseline-records-proof.integration.test.ts`; its original one-test pass was console-only and is not claimed as a newly rerun parent check.

Unit/integration crash-cut cases,19 unit failures,168 reported integration failures, old shell E2E expectations, package-bootstrap timeout and baseline Knip findings remain unresolved at milestone level. Observed matching failures are not green results and say nothing conclusive about uncompleted cases.

### Added-file Identity

| Path | SHA-256 |
| --- | --- |
| apps/desktop/build/harness-runtime-staging-plugin.test.ts | 3eccd2acbc4c7ce44da4be0b2c976d4a50324764a84487f52c6c0b0485d0c1e3 |
| apps/desktop/build/harness-runtime-staging-plugin.ts | b4110483b3564378c1aec5a0274529380aa62ea24bad296334b7723e4798c7f5 |
| apps/harness/src/storage/sql-integer-schema.ts | 87b9aa7c55420c4b360eeeaf10875c20930c4e131adcfb9aecc52af698ac0e65 |
| packages/protocol/src/decode-with-issues.test-support.ts | 8bc4ac6bab7ae2ed483905f03fb9b0dad00fa83afc5c8f7953af5e629fb58861 |
| packages/protocol/src/schema-boundary-characterization.test.ts | 788c083e1c58a006086bafe158180ef74ac9dac1da4eade4fce31ead992b0681 |
| packages/protocol/src/schema-codec.ts | bb89f8b0eb67833fc020a58a349820be8ae01bcb952306d355dbd3831639f36d |

All log filenames above are relative to the existing Claude session scratchpad named in the unit handoff. No source edits, tests or commits were made by the parent during this re-review. Claude was asked for a short Unit2 plan before further source edits, focused on Effect-managed lifecycle and the related baseline admission/shutdown failures.
