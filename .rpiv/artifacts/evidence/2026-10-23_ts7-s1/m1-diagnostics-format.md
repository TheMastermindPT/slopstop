# M1: effect-tsgo diagnostics mode, format and exit codes (ts7-s1-compiler-switch)

- Date: 2026-10-23, Windows 11, worktree `slopstop-105` at `25bf597` plus the uncommitted switch (catalog, root `package.json`, lockfile).
- Tool: `@effect/tsgo` 0.51.1 (`node node_modules/@effect/tsgo/dist/effect-tsgo.cjs diagnostics ...`), TypeScript-Go 7.0.2 resolved through `@typescript/native`.
- Run by: `m1-run.mjs <repo> <outDir> <outsideCwd>` (session scratchpad), every case in the four formats `json`, `text`, `pretty`, `github-actions`.
- Raw outputs: `m1-raw/<case>.<format>.stdout|stderr` and `m1-raw/index.json` (cwd, argv, status, signal, spawn error, duration). `m1-raw/help.-.stdout` is `diagnostics --help`.
- CPU rule: the coordinator's 3-readings-under-30% rule was not met (Windows Search indexing the new `node_modules`; no game process). Pedro told the implementer directly to go ahead ("se foda, toca a andar", 2026-10-23); the run took about 1 minute.
- Scratch projects (`.m1-scratch/`, untracked, deleted after M1): each `tsconfig.json` extends `tsconfig.base.json` (the real plugin block).

## Results (json format; the other formats have the same exit codes)

| Case | Project | Exit | stdout | stderr |
|---|---|---|---|---|
| 1 | `packages/kernel` | 0 | JSON, 0 diagnostics, `filesChecked` 5 | empty |
| 1 | `packages/protocol` | 0 | JSON, 0 diagnostics, `filesChecked` 23 | empty |
| 1 | `apps/harness` | 0 | JSON, 0 errors, 46 warnings, 4 messages, `filesChecked` 300 | empty |
| 1 | `apps/desktop` | 0 | JSON, 0 errors, 4 warnings, 2 messages, `filesChecked` 135 | empty |
| 2 | canary | 1 | JSON, the 4 expected entries (below) | empty |
| 3 | clean | 0 | JSON, `diagnostics: []`, `errors` 0 | empty |
| 4 | planted `unknownInEffectCatch` | 1 | JSON, 1 error + 2 warnings | empty |
| 5 | warnings only | 0 | JSON, 0 errors, 2 `anyUnknownInErrorContext` warnings | empty |
| 6 | plain type error (`const wrong: number = "x"`) | 0 | JSON, `diagnostics: []` | empty |
| 7a | missing tsconfig | 1 | empty | `No files to check. Please provide an existing .ts file or a project tsconfig.json` |
| 7b | invalid tsconfig JSON | 1 | empty | the same line as 7a |
| 7c | canary with `"plugins": []` | 1 | JSON, 4 errors + 2 warnings: the canary set plus `src/planted.test.ts(1,30) error newPromise` and `tests/planted.ts(1,31) error newPromise` | empty |
| 8 | discovery failure (cwd outside the repo) | 1 | `[hh:mm:ss.mmm] ERROR (#1): DiscoveryError: Unable to discover an installed typescript binary.` plus a stack line (not JSON) | empty |

JSON shape: `{ "diagnostics": [{ file, start, length, line, column, endLine, endColumn, severity, code, name, message }], "summary": { filesChecked, filesWithoutPlugin, totalFiles, errors, warnings, messages } }`. `file` is absolute with `/` separators; `severity` is `error`, `warning` or `message`; `name` is the Effect rule.

## Chosen format and exit table

- `<F>` = `json`: one complete document per run carrying file, line, column, severity and rule for every diagnostic, plus summary counts the parser can cross-check.
- Exit 0: no error-level diagnostic (clean or warnings only). Exit 1: error-level diagnostics found, or a broken run (7a, 7b, 8). No other exit was observed.
- Exit 1 alone does not separate "found" from "broken"; the output does: "found" is a complete JSON document whose `summary.errors` > 0 equals its error entries; every broken case observed has no JSON document (empty stdout, or a log line).

## Re-derived canary set (relative to the canary folder)

```
src/canary.ts(3,24) error newPromise
src/canary.ts(4,14) warning anyUnknownInErrorContext
src/canary.ts(4,24) error unknownInEffectCatch
src/canary.ts(4,24) warning anyUnknownInErrorContext
```

Equal to today's `expectedCanary`. The waived line and the two test-file lines are absent. With the plugin block removed (7c) both test-file lines appear, so the canary detects a removed block.

## D3 guarantees

1. Complete, parseable per-diagnostic format: met (`json`).
2. Distinguishable clean, found and broken: met by exit code plus output shape, not by exit code alone (found and broken both exit 1). Every broken case observed exits 1 with no JSON document, so none can read as clean.
3. A discovery failure that is not exit "clean": met (exit 1, `DiscoveryError` on stdout).
4. A canary that proves the real plugin block: met (7c differs from 2).
- Plain type errors: not reported by diagnostics mode (case 6, exit 0, no entry). After the switch, plain type errors belong to the authority (`pnpm typecheck`, TypeScript-Go 7.0.2), as the brief allows; `AGENTS.md` must say so.
