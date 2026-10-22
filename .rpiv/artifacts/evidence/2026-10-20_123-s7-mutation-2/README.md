# #123 s7 scoped mutation rerun — STOPPED: one non-killed mutant outside the allowed list

- Decision: Pedro "Matar todos os possíveis" (decisions log §137). Kill commit **`f88f3a3`** (tree `f0c7898665b905cd1e5ff33bd98d0f7c6f228934`) on `32ca10a`; its rows, bindings and gates are in `../2026-10-20_123-s7-kill/`.
- Run: backups of the nine sources and both configs (scratchpad `s7-mutation2-backup`, with `SHA256SUMS`). The first CPU readings were 31.9/31/41.3, so I waited for three consecutive readings under 30: 28.0/27.4/27.1. Alone. `pnpm exec stryker run stryker.desktop-s7.config.json`, 2 min 39 s, exit 0, dry run 327 tests (`mutation.log`, `run-meta.txt`). No timeout, no error, no Defender alert. After: all nine sources match the backup (`after-run.txt`).

## Result

- Score **97.53**. **447 mutants: 435 Killed, 11 Survived, 0 Timeout, 0 NoCoverage, 1 Ignored** (`non-killed.txt`).
- Of the 17 first-run survivors, **6 are now Killed** by the new rows and the restructure: core `:83`, session `:117`, entry `:157`, `:158`, `:172`, `:179`.
- 10 survivors are the declared equivalents below (E1-E9).
- **1 survivor is outside the allowed list: `workspace-bridge.ts:101:21` StringLiteral (`stoppedText` → `""`).**
  - The new row `answers the stopped text for a request made after stop` kills this exact mutant when it is applied in the source (`../2026-10-20_123-s7-kill/bind-m101.log`: 1 failed, restored MATCH).
  - Stryker still reports it Survived. The report marks it `static: true` and covered by 80 tests. The value is read once, when the module loads, so a mutant that is switched on per test while the module is already loaded never changes it. Storage's twin `:38` is `static: true` with no coverage, so `ignoreStatic` marks that one Ignored.
  - The rule says STOP: no rerun. Options for you: (a) accept it as killed on the binding evidence (a tooling limit for static mutants); (b) restructure, e.g. use the literal inside `faultText`'s `unsent` arm so it is no longer a module-level static (one more rerun); (c) a directive. I did none of these.

## Declared equivalent (8), for the coordinator's verification

Lines are at `cf95b0a` (the first run's numbering); none of these lines moved in `f88f3a3`.

| # | Mutant | Why no public-seam test can tell it apart |
| --- | --- | --- |
| E1 | `harness-request-core.ts:151` ConditionalExpression: `entries.get(id)?.done === done` → `true` | The interrupt finalizer runs only while the request waits on its own `Deferred`. While it waits, its entry is still in the map, and no other entry with that id can be added: `request` refuses a second one as `identity-collision`. So the entry under `id` is always this request's, and the condition is always true. Once the reply settles the entry, the fiber resumes in the same turn, so an interrupt arrives too late to run the finalizer. Probe: a row that replies, registers a new request with the same id at once, then interrupts the first fiber passed against both `:151` mutants (`../2026-10-20_123-s7-kill/probe-m151-*-equivalent.log`), so the row was not kept. |
| E2 | `harness-request-core.ts:151` OptionalChaining: `entries.get(id)?.done` → `entries.get(id).done` | Same reason: when the finalizer runs, `entries.get(id)` is always defined (E1), so the optional chain never short-circuits. Same probe. |
| E3 | `project-conversation-failure.ts:40` ObjectLiteral: `({ meaning: "malformed-reply" })` → `({})` | `"malformed-reply"` is never tested by name. Its two consumers check other meanings and fall through. `readConversationFailure` checks `harness`, then `not-sent`/`sent-then-lost`, and otherwise returns `broken` `protocolMessageInvalid`. `saveConversationFailure` checks `harness`, `not-sent` and `defect`, and otherwise returns `uncertain` `saveUnconfirmed`. A meaning of `undefined` takes the same fall-through as `"malformed-reply"` in both, so every output is the same. |
| E4 | `project-conversation-failure.ts:40` StringLiteral: `"malformed-reply"` → `""` | Same as E3: `""` is also unchecked and falls through to the same answers. |
| E5 | `project-storage-bridge.ts:63` BooleanLiteral: `{ ok: false, error: { code } }` → `ok: true` | `harnessSendFailureMessage` (`harness-send-failure.ts:3-14`) switches on `result.error.code` only and never reads `ok`; `ok: false` exists only to satisfy its parameter type. The text is the same for any `ok`. |
| E6 | `workspace-bridge.ts:143` BooleanLiteral: the same `ok: false` → `true` | Same as E5. |
| E7 | `project-storage-bridge.ts:121` OptionalChaining: `command?.payload` → `command.payload` | The echo check runs only inside `Effect.flatMap` after `core.request` succeeded with a reply. A reply can only settle a registered entry. The core registers an entry only after `build()` returned a command, and `build` assigns `command` before returning it. If `build` throws, the request fails `invalid-command` before any reply. So `command` is always defined when the check runs. |
| E8 | `workspace-bridge.ts:171:9` and `:182:9` ConditionalExpression: `previous !== undefined` → `true` (2 mutants) | When `previous` is `undefined`, the mutant leaves `revision <= undefined` (`:171`) or `revision < undefined` (`:182`). A number compared with `undefined` is always `false` in JavaScript (`undefined` becomes `NaN`), which is exactly what the original `false && …` gives. When `previous` is defined, both are the same expression. So no input tells them apart. |
| E9 | `workspace-bridge.ts:262` CallExpression: `notificationListeners.clear()` removed | The stop calls `removeObserver()` just before, so the core never calls `publishNotification` again, and only `publishNotification` reads the set. After stop no listener can be called, cleared or not; the set is private. The clear only drops references for the garbage collector. The K4 row `notifications after stop` pins the observable part. |

E8 covers two mutants, so the list is 10 mutants: E1, E2, E3, E4, E5, E6, E7, E8 ×2, E9.
