# #123 s6 scoped mutation, rerun after the survivor decision — PASSED under the declared exceptions

- Decisions (Pedro, relayed by the coordinator; decisions log §135): "Corrigir 6 + declarar 7", then "Declarar os 3" for the smoke trio.
- Candidate **`54d30da`**, tree **`f93999ff5eca9169c6fd6f5d911826b9f46e4193`**, on `4516f61`. The fix evidence is in `../2026-10-19_123-s6-kill/`; the first run is in `../2026-10-19_123-s6-mutation/`.
- Before the run: the seven `mutate` sources, both configs and `reports/mutation/` were backed up (`s6-mutation2-backup` in the implementer's scratchpad, with `SHA256SUMS`). CPU 10.2/10.0/11.4, run alone.
- Command `pnpm exec stryker run stryker.desktop-s6.config.json`, 18:20:33-18:21:29 +01:00, "Done in 52 seconds", exit 0 (`mutation.log`). No Defender alert.
- After: `git status` shows only the evidence folders; the source equals `54d30da`; every one of the seven sources matches its backup.

## Result

- Score **94.23**. **212 mutants: 196 Killed, 12 Survived, 0 Timeout, 0 NoCoverage, 4 Ignored.**
- Per file: `canonical-writer-package-smoke.ts` 35, `desktop-runtime.ts` 51, `desktop-shutdown.ts` 63 (was 68: the `:132` restructure removed the guard's mutants), `main.ts` 36, `project-entry-ipc.ts` 18, `project-registration-ipc.ts` 9. `project-entry-bridge.ts:79` still produces no mutant.
- **Every non-killed mutant is an allowed one** (below), so the "all killed" rule holds with its exceptions.
- The three targeted `desktop-shutdown.ts` survivors are now **Killed**: the `:9` tag StringLiteral, the aggregation `>= 1` EqualityOperator (now `:90`), and the `beforeQuit` code (now `:129`, whose AssignmentOperator and OptionalChaining mutants are also Killed).
- K16: the `polling` body BlockStatement `:306-341` is Killed, the register body `:307-340` is Killed, and the canceler `:334-338` mutants are 4 Ignored with the S6-J7 reason. The trailing restore at `:339` is inert and harmless.

## Allowed non-killed (16)

| Mutant(s) | Status | Basis |
| --- | --- | --- |
| `canonical-writer-package-smoke.ts:334-338` (4) | Ignored | S6-J7: defensive interruption canceler, unreachable through the facade (the `// Stryker disable all` directive) |
| `main.ts:123` StringLiteral (`WriterProofReportFailed` tag), `main.ts:133` StringLiteral (message) | Survived | EW8 pair, pre-declared (S6-J7, S6-K14) |
| `desktop-runtime.ts:47`, `:52`, `:56`, `:60`, `:64` StringLiteral (the five `Context.Service` keys) | Survived | **Declared equivalent** (Pedro): any unique key behaves the same; each mutant empties one key, which stays unique |
| `main.ts:106` OptionalChaining (`servicesAtShutdown()?.logger` → `.logger`) | Survived | **Declared equivalent** (Pedro): it differs only when the services were never built, where the S6-L1 (a) catch makes the thrown TypeError invisible, so `exit(1)` follows either way |
| `main.ts:133` ObjectLiteral (`{ message }` → `{}`) | Survived | **Declared equivalent** (Pedro): EW8 class, like the declared message text; `reportUnconfirmedWriterProof` replaces the rejection with fixed lines |
| `canonical-writer-package-smoke.ts:302` ConditionalExpression (`Result.isFailure(waited)` → `false`), `:303` CallExpression (trailing `this.checkWait(options)` removed), `:316` ConditionalExpression (`error === undefined` → `true`) | Survived | **Declared equivalent at the public seam** (Pedro, "Declarar os 3"), reasons below |

### Why the smoke trio is equivalent at the public seam

1. **The checkWait state is monotonic.** A `polling` failure always comes from `checkWait` itself (`proof.assert` / `requireWriterProof`). Everything it reads never goes back: `proof.first` is never cleared, a passed deadline stays passed, `terminal` and the abort never reset. So the facade's trailing `checkWait` re-raises an equivalent failure whenever `:302` or `:316` would let a failure through.
2. **The next step's assert re-raises the same failure.** The real predicates are property reads that never throw, and `OwnedUtility` is internal, so the "throwing predicate" row cannot be built at the seam. Every wait site is followed by an equivalent check: `requireWriterProof`, `proof.assert`, or the next `exchange`'s `proof.assert` with the same stage and limit. For example, after the takeover wait, `call(…, "takeover", maximum)` asserts the same deadline. A row that crossed the takeover deadline in the gap passed both with and without `:303` (dropped; logs in `../2026-10-19_123-s6-kill/attempt-k303/`).
3. **The trailing check predates s6.** `5f1bca3`'s `wait` already ended with `this.checkWait(options)` after its Promise (line 327 there). s6 kept the behaviour; the coordinator decided not to remove it, because removing it would change the timing of failure detection in the post-resume gap.
4. **The facade leaves in Part B.** `wait` is the temporary Promise facade (S6-J2): when the writer package smoke migrates to Effect, the facade and its trailing check go, and these mutants with them.
