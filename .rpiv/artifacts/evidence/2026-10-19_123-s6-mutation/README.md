# #123 s6 scoped mutation (step 10 item 7) — STOPPED on survivors

- GO: Pedro, "Arranca agora", relayed by the coordinator. Candidate `5ed89e5`, tree `b67f0d2f`; HEAD `e0b97ca` adds only evidence (`git diff 5ed89e5 e0b97ca` outside `.rpiv/artifacts/evidence` is empty). Contract `80dd3084…`.
- Before the run: the seven `mutate` sources, the Stryker config, the Vitest mutation config and the old `reports/mutation/` were backed up to the implementer's scratchpad (`s6-mutation-backup`, with its own `SHA256SUMS`). No `git checkout` was used.
- CPU 9.4/9.8/9.3, run alone. Command `pnpm exec stryker run stryker.desktop-s6.config.json` from the worktree root (`mutation.log`, through `tdd-run.sh`). It started at 18:04:27 and ended at 18:05:46 +01:00; Stryker reported "Done in 1 minute and 2 seconds", exit 0.
- After the run: `git status` shows only this folder; the source equals `5ed89e5` (tree `b67f0d2f`); every one of the seven sources matches its backup byte for byte.

## Result

- Mutation score **92.96** (break threshold 80). **217 mutants: 198 Killed, 15 Survived, 0 Timeout, 0 NoCoverage, 4 Ignored.**
- Mutants per file: `canonical-writer-package-smoke.ts` 35, `desktop-runtime.ts` 51, `desktop-shutdown.ts` 68, `main.ts` 36, `project-entry-ipc.ts` 18, `project-registration-ipc.ts` 9. `project-entry-bridge.ts:79-79` (the `unsent` constant) produced **no mutant**.
- Several Killed mutants in `polling` were killed by "Test timed out in 5000ms" (a Vitest test timeout, which Stryker counts as Killed, not as a Stryker Timeout).
- Rule: all killed, except the J7 canceler mutants and the K14 correction. **15 survivors, so the run STOPS for the coordinator.** No rerun and no test edit. The full list is in `non-killed.txt`, and the raw report in `mutation.json.txt` and `desktop-s6.html.txt`.

## K16 (as read in M3)

- The `polling` body BlockStatement `:306:91-341:4` is listed: **Killed** (`expected { status: 'failed', … } to deeply equal { status: 'passed', … }`).
- The `Effect.callback` register body BlockStatement `:307:64-340:6` is listed: **Killed** (Vitest test timeout).
- The canceler: 4 mutants inside `:334-338` (BlockStatement `:334:32-338:8`, BooleanLiteral `:335`, CallExpression `:336` and `:337`), all **Ignored**, with the reason "S6-J7: defensive interruption canceler, unreachable through the facade", taken from the `// Stryker disable all` directive at `:333`.
- `// Stryker restore all` at `:339` is a trailing comment, so it is inert. Only closing braces follow it inside the range, so this is harmless.
- **K16 is met.**

## Survivors (15), listed as reported, not triaged

| Location | Mutator | Replacement | Note |
| --- | --- | --- | --- |
| `canonical-writer-package-smoke.ts:302` | ConditionalExpression | `if (Result.isFailure(waited))` → `false` | facade |
| `canonical-writer-package-smoke.ts:303` | CallExpression | `this.checkWait(options);` removed | facade's final check |
| `canonical-writer-package-smoke.ts:316` | ConditionalExpression | `error === undefined` → `true` | `finish` |
| `desktop-runtime.ts:47`, `:52`, `:56`, `:60`, `:64` | StringLiteral | each Context.Service key → `""` | five service keys |
| `desktop-shutdown.ts:9` | StringLiteral | `"DesktopRuntimeDisposeUnconfirmed"` → `""` | the error's tag |
| `desktop-shutdown.ts:91` | EqualityOperator | `failures.length > 1` → `>= 1` | aggregation threshold |
| `desktop-shutdown.ts:132` | ConditionalExpression | `exitCode !== undefined` → `true` | `beforeQuit` |
| `main.ts:106` | OptionalChaining | `servicesAtShutdown()?.logger` → `servicesAtShutdown().logger` | reporter |
| `main.ts:123` | StringLiteral | `"WriterProofReportFailed"` → `""` | EW8 `_tag`: pre-declared (J7, K14) |
| `main.ts:133` | StringLiteral | the EW8 message → `""` | pre-declared (J7, K14) |
| `main.ts:133` | ObjectLiteral | `{ message: … }` → `{}` | EW8 error fields; not pre-declared |

- Covered by the declared exceptions: `main.ts:123` and the `main.ts:133` StringLiteral (2).
- The other 13 are outside the exceptions, which stops the run under the "all killed" rule.
