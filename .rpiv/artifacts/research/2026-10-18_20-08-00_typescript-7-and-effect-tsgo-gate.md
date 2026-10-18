---
date: 2026-10-18T20:08:00+0100
author: Pedro Mesquita
commit: 53f7da7
branch: main
repository: slopstop
topic: "#105 TypeScript 7 (TypeScript-Go) toolchain compatibility, effect-tsgo diagnostics as a gate, and a curated Effect language service configuration with violation counts (main and #123 Part A)"
tags: [research, typescript-7, typescript-go, effect-tsgo, effect-language-service, toolchain, dependency-cruiser, defender, gates, issue-105, issue-35]
status: complete
lane: rigorous
lane_reasons: ["slices: 2 > 1", "files: 10 > 5", "manifest: package.json", "manifest: packages/kernel/package.json", "manifest: packages/protocol/package.json", "ci config: .github/workflows/ci.yml", "diagnostic: lines unknown", "diagnostic: hub signal unavailable"]
last_updated: 2026-10-18T20:08:00+0100
last_updated_by: Pedro Mesquita
content_hash: dbf67b1adb64a4df5db230905f6e89da68fd4b9f81bbb7a63f30e09b84ead17e
---

# Research: #105 TypeScript 7 and the Effect tsgo gate

## Research Question
GitHub #105 and roadmap Phase 2 item 2 (`.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md:48`), ordered before #123 s6 by the user (decisions log §129, §133):
1. Does the toolchain support TypeScript 7: Vite, Vitest, Electron Forge, Biome, knip, dependency-cruiser, Stryker, drizzle-kit and the typecheck scripts? Which options and behaviours change, how much faster is it, and does it change the Forge/Drizzle lib-check warnings (#35)?
2. Can `effect-tsgo diagnostics` run in the gates?
3. Which curated `diagnosticSeverity` set and plugin options fit the AGENTS.md "Effect Usage (effect 4)" rules, and how many violations exist per rule today, with the #123 Part A code (`refactor/123-effect-lifecycle-part-a`) counted separately?
4. Go/no-go, with migration and rollback steps.

Scope limits (coordinator brief): research only. No change to `package.json`, the lockfile, a tsconfig or code on any branch. Until a go becomes a slice, `pnpm typecheck` (TS 6.0.2) stays authoritative (`AGENTS.md:78`).

## Summary
- **Recommendation: a split verdict.**
  - **GO for the compiler** (TS 7 as `tsc`), but only with the side-by-side layout that Microsoft recommends. Dependency-cruiser and Stryker still need the TS 6 JavaScript API.
  - **NO-GO, for now, for a local Windows Effect gate.** Windows Defender kills the effect-tsgo binary on this PC.
  - **GO for Effect diagnostics as a gate on Linux** (the CI `ubuntu-deep-check` job, plus an optional local Docker script), once Pedro picks the curated rule set below.
- **TS 7 type-checks the repo with 0 errors and is about 5-6x faster.** Measured with the official `typescript@7.0.2` against the repo's TS 6.0.2 (`--noEmit`, Windows, main): kernel 0.14 s vs 0.9 s; protocol 0.31 s vs 1.44 s; harness 0.89 s vs 5.27 s; desktop 1.07 s vs 5.16 s. The whole `pnpm typecheck` goes from about 12.8 s to about 2.4 s of compiler time. The repo uses none of the options TS 7 removed.
- **TS 7 ships no JavaScript API.** The `typescript@7.0.2` main export is only `./lib/version.cjs`. The new API is expected in 7.1. This breaks one gate:
  - `dependency-cruiser` (18.2.0 installed, and also the latest 18.6.0) accepts only `typescript >=2.0.0 <7.0.0` (`node_modules/dependency-cruiser/src/meta.cjs:14`).
  - With TS 7 installed as `typescript`, it cannot parse `.ts` files. Its maintainer says 7.1 is the first TS 7 version it will support.
  - So `pnpm check:boundaries` would stop seeing TypeScript imports. Since 18.1.0 it warns about a missing compiler. The safe layout is two aliases: `typescript` → `npm:@typescript/typescript6@6.0.2` (the API plus a `tsc6` binary) and `@typescript/native` → `npm:typescript@7.0.2` (the `tsc` binary).
  - effect-tsgo already discovers `@typescript/native` by that exact name (`node_modules/@effect/tsgo/lib/getExePath.js:6`).
- **Defender kills the effect-tsgo Windows binary when it runs (#105 finding).**
  - At 19:57:17 Defender quarantined `node_modules/@effect/tsgo-win32-x64/artifacts/typescript/7.0.2/tsc.exe` (Trojan:Win32/Bearfoos.B!ml, ThreatID 2147731849). The trigger was ProcessStart, when a timing script spawned it.
  - This is the third detection after 2026-10-17. On this PC, any Windows effect-tsgo gate (the `diagnostics` command, a patched `tsc`, or the LSP) can be killed.
  - The official `typescript@7.0.2` Windows binary ran 6 times without a detection.
  - Restoring the file is Pedro's call.
- **On Linux, effect-tsgo diagnostics are fast and clean to run.** In `node:24` with read-only mounts, all four packages took about 7.7 s per tree with the default config (0.5 + 1.4 + 3.8 + 1.9 s). With every one of the 119 rules on, it took about 11.3 s. Exit code was 0 everywhere.
- **The nine candidate rules are small today.** In src (non-test) code, `unknownInEffectCatch` has 11 on Part A (8 on main); `newPromise` 9 (10); `globalErrorInEffectFailure` 1 (1); `runEffectInsideEffect` 1 (0). `schemaNumber` has 0 in src and 6 in tests. `tryCatchInEffectGen`, `multipleEffectProvide`, `leakingRequirements` and `scopeInLayerEffect` have 0. Tests add 120 `newPromise` hits on Part A (111 on main).
- **Part A introduced 3 `unknownInEffectCatch`, 1 `runEffectInsideEffect` and 8 `anyUnknownInErrorContext` in src.** It also removed 1 `newPromise` (`project-registration-observer.ts`). Counted over the 16 src files that Part A changed, the candidates are 7 `unknownInEffectCatch` and 1 `runEffectInsideEffect`, plus 31 `newPromise` in its test files.
- **#35 does not change under TS 7.** With `skipLibCheck: false`, TS 6 and TS 7 report the same errors: desktop 2 (`@electron-forge/plugin-vite/dist/VitePlugin.d.ts`); harness 74 (73 in Drizzle's optional-driver declarations, plus 1 in `effect/dist/Channel.d.ts:4991`, `TextDecoderOptions` without the DOM lib). `skipLibCheck: true` stays. effect-tsgo diagnostics ran correctly with it.

## Detailed Findings

### 1. TypeScript 7 status and options
- `typescript@7.0.2` has been the npm `latest` since 2026-07-08 (`next` = 7.1.0-dev.20261018.1). Its main export is `./lib/version.cjs`, plus `./unstable/*` API previews. There is no `createProgram` or `createSourceFile` (`npm view typescript@7.0.2 exports`).
- The removed options are `baseUrl`, `outFile`, `target: ES5`, `module` AMD/System/UMD, `moduleResolution` Classic/node10, `alwaysStrict: false`, `esModuleInterop: false`, `allowSyntheticDefaultImports: false` and `downlevelIteration` (Context7 `/microsoft/typescript-go`, `internal/compiler/program.go`). TS 7 also adopts the 6.0 defaults (`strict` true). `tsconfig.base.json:2-28` uses none of the removed options: Bundler resolution, ESNext module, ES2022 target, and explicit `types` in each package.
- Behaviour: Microsoft says code that compiles cleanly on 6.0 (with `stableTypeOrdering`, without `ignoreDeprecations`) compiles identically on 7.0. The JS/JSDoc analysis changed, but `allowJs: false` (`tsconfig.base.json:4`), and the only `.mjs` in a tsconfig `include` is desktop `tests/**/*.mjs` (`apps/desktop/tsconfig.json:12`). Desktop checked clean under TS 7.
- Microsoft's side-by-side guidance (devblogs "Announcing TypeScript 7.0", 2026-07-08; nx.dev "Use TypeScript 7.0 alongside TypeScript 6.0") gives this layout: `"@typescript/native": "npm:typescript@^7.0.2"` and `"typescript": "npm:@typescript/typescript6@^6.0.2"`. Then `tsc` is 7 and `tsc6` is 6. `@typescript/typescript6` is published at 6.0.0-6.0.2; 6.0.2 matches today's pin (`pnpm-workspace.yaml` catalog `typescript: 6.0.2`).

### 2. Toolchain compatibility (installed versions)
| Tool | Uses the TS JS API? | Under TS 7 alone | Under the alias layout |
|---|---|---|---|
| Typecheck scripts (`tsc --noEmit -p tsconfig.json`, 4 packages) | CLI only | 0 errors, 5-6x faster (measured) | `tsc` = 7 |
| dependency-cruiser 18.2.0 (latest 18.6.0) | Yes: `createSourceFile` (`src/extract/tsc/parse.mjs:8-32`), gated to `<7.0.0` (`src/meta.cjs:14`); the transpiler map gives `.ts` to typescript only (`src/extract/transpile/meta.mjs:58-96`) | **Broken**: `.ts` is not parsed, so boundaries are not checked | Works (resolves TS 6) |
| Stryker 10.0.0 | Only to rewrite a `tsconfig.json` when not in-place (`@stryker-mutator/core/dist/src/sandbox/ts-config-preprocessor.js:30-46`); the repo root has no `tsconfig.json` | Not affected (path not taken) | Works |
| knip 6.34.0 | No: `oxc-parser`, `oxc-resolver`, `jiti` (knip itself is built with TS 7.0.2) | Compatible | Compatible |
| Vite 8.2.1 / `@vitejs/plugin-react` 6.0.5 | No `typescript` dependency | Compatible (to confirm by `package` in the slice) | Compatible |
| Vitest 4.1.10 | Only the typecheck mode spawns `tsc` (not used) | Compatible | Compatible |
| Electron Forge 7.11.2 | Loads `forge.config.ts` through `jiti` (`@electron-forge/core/dist/util/forge-config.js:34,158-174`) | Compatible | Compatible |
| drizzle-kit 0.31.10 | No: `esbuild`, `tsx` | Compatible | Compatible |
| Biome 2.5.8 | No (Rust) | Compatible | Compatible |
| jscpd, likec4 | No `typescript` dependency | Compatible | Compatible |
| commitlint (`cosmiconfig-typescript-loader` 6.3.0) | Peer `typescript >=5`; the config is `.cjs`, so the loader path is not taken | Peer satisfied | Peer satisfied (6.0.2) |
| `@electron-forge/template-webpack-typescript` | Has its own nested TS 5.4.5 | Unaffected | Unaffected |
| VS Code (`.vscode/settings.json:8` `typescript.tsdk`) | Points at `node_modules/typescript/lib` | Must move to the TS 7 extension | Stays TS 6 unless changed |

The scan was done with a scratch script over top-level `node_modules/*/package.json` (dependencies, peerDependencies, optionalDependencies on `typescript`), plus a targeted grep of each tool's dist folder for imports of `typescript`.

### 3. effect-tsgo as a gate
- **CLI (0.51.1):** `effect-tsgo diagnostics --project <tsconfig> --format json|pretty|text|github-actions [--strict] [--severity] [--lspconfig <json>]`. Exit code 1 means diagnostics were found. `--lspconfig` replaces the project plugin config inline. That is how the counts were taken without editing any tsconfig.
- **It needs a native TS ≥ 7 package that it can discover,** and it refuses without one ("DiscoveryError: Unable to discover an installed typescript binary"). It tries `typescript` and then `@typescript/native`. It matches the package `gitHead` against its `upstream.json` (0.51.1 supports 7.0.2 with gitHead `2bd066d…`, which matches the npm package). So the effect-tsgo version and the TS 7 version must move together. The latest effect-tsgo is 0.53.4.
- **Two gate modes** (README): (a) `effect-tsgo patch --typescript` swaps the installed TS 7 `tsc` for the Effect build, so `pnpm typecheck` emits Effect diagnostics, with exit codes controlled by `ignoreEffect{Suggestions,Warnings,Errors}InTscExitCode`; (b) a separate `effect-tsgo diagnostics --project` step, which type-checks again. On this PC both execute the Windows effect binary, which Defender quarantines.
- **CI:** `.github/workflows/ci.yml` has a Linux job (`ubuntu-deep-check`, runs `check:deep:portable`) and a Windows job. A Linux step `effect-tsgo diagnostics --format github-actions` per package would run there without Defender. Whether Defender on the GitHub Windows runner flags the binary is unknown. The local `pre-push` runs `pnpm check:deep` on Windows (`.husky/pre-push`), so the Effect step cannot be in `check` or `check:deep` while the Defender problem stands, unless it is a Docker call or is skipped on Windows. That skip must be visible, never silent (`degrade-distinguishes-broken`).
- **Measured on Linux** (`node:24`, Node 24.22.0, pnpm 11.5.1, frozen lockfile, `--ignore-scripts`; both trees mounted read-only): default config main 0.56/1.40/3.82/1.93 s, Part A 0.50/0.85/3.68/2.04 s (kernel/protocol/harness/desktop). With all rules on, the harness takes 4.8 s. The container and the volume were removed afterwards.

### 4. Violation counts per rule
Format: src/test. "Part A files" = diagnostics inside the 46 `.ts` files that Part A added or changed (merge base `fdda65e`, 31 commits); the counts include older lines in those files. Kernel has 0 everywhere.

**Default config (today's plugin entry):**
| Rule | main | Part A tree | Part A files | Default severity |
|---|---|---|---|---|
| `unknownInEffectCatch` * | 8/0 | 11/0 | 7/0 | warning |
| `schemaNumber` * | 0/6 | 0/6 | 0/0 | message |
| `unnecessaryFailYieldableError` | 2/0 | 2/0 | 0/0 | message |
| `globalErrorInEffectFailure` * | 1/0 | 1/0 | 0/0 | warning |
| `runEffectInsideEffect` * | 0/0 | 1/0 | 1/0 | message |
| `preferUnsafeConstructor` | 0/1 | 0/2 | 0/1 | message |
| `unnecessaryEffectGen`, `runOfExitToRunExit` | 0/0 | 0/1 each | 0/1 each | message |
| `newPromise` * | off by default | | | off |
| `tryCatchInEffectGen`, `multipleEffectProvide`, `leakingRequirements`, `scopeInLayerEffect` * | 0/0 | 0/0 | 0/0 | |
| `floatingEffect` (default error in `src/**`) and the other default-on correctness rules | 0 | 0 | 0 | |

(* = candidate in #105.) The 2026-10-09 issue counts (6 `schemaNumber`, 2 `unnecessaryFailYieldableError`) match. The issue's "2 `unknownInEffectCatch`" is now 8 on main and 11 on Part A.

**All 119 rules on as warnings (noise map, for choosing):**
| Rule | main | Part A tree | Part A files |
|---|---|---|---|
| `asyncFunction` | 612/2570 | 610/2641 | 97/402 |
| `nodeBuiltinImport` | 72/284 | 72/294 | 8/38 |
| `missingPipeableSignature` | 175/144 | 176/144 | 7/5 |
| `newPromise` * | 10/111 | 9/120 | 0/31 |
| `strictBooleanExpressions` | 48/69 | 48/69 | 0/2 |
| `globalDate` | 25/42 | 25/42 | 3/10 |
| `globalTimers` | 13/28 | 12/31 | 0/4 |
| `processEnv` | 10/30 | 10/30 | 0/0 |
| `anyUnknownInErrorContext` | 24/0 | 32/3 | 20/3 |
| `extendsNativeError` | 20/0 | 19/0 | 1/0 |
| `cryptoRandomUUID` | 6/5 | 6/5 | 0/0 |
| `unnecessaryArrowBlock` | 7/1 | 7/1 | 1/0 |
| `deterministicKeys` | 7/0 | 7/1 | 7/1 |
| `schemaSync` | 2/4 | 2/4 | 0/2 |
| `globalConsole` | 0/6 | 0/6 | 0/0 |
| `missedPipeableOpportunity` | 2/1 | 2/1 | 0/0 |
| `globalDateInEffect` | 1/0 | 1/0 | 0/0 |
| `strictEffectProvide` | 0/1 | 0/1 | 0/1 |
| the default-config rules above | same counts | | |

**Part A src locations (candidates):**
- `unknownInEffectCatch`: `apps/harness/src/canonical-project-writer.ts:115`, `process-bootstrap.ts:138`, `process-bootstrap.ts:151`, `registration/registration-listing.ts:55`, `registration/registry-database.ts:85`, `storage/project-storage-node-registry.ts:71`, `storage/project-storage-node-registry.ts:78`. New in Part A: the two in `process-bootstrap.ts` and the one in `registry-database.ts`.
- `runEffectInsideEffect`: `apps/harness/src/process-bootstrap.ts:156`. `Effect.runPromise(shutdown(...))` sits inside a closure that is returned from an `Effect.gen` and called later at the process edge. AGENTS allows `runPromise` at host-adapter edges, so the fix is either a restructure (`runtime.runPromise`, or return the Effect) or a reasoned `@effect-diagnostics-next-line` suppression.
- `anyUnknownInErrorContext`, new in Part A: `process-bootstrap.ts` +5, `registry-database.ts` +1, `harness-runtime.ts` +1, `registration/registration-registry.ts` +1. This has the same root as `unknownInEffectCatch` (`catch: (cause) => cause` leaves `E = unknown`).
- `newPromise` in Part A test files: 31 (for example `project-registration-observer.test.ts:112-291`, `canonical-project-activation.integration.test.ts:261-354`).

**Main src locations outside Part A** (candidates): `unknownInEffectCatch` at `registration/project-registration-preparation.ts:267`, `storage/project-storage-store.ts:158`, `apps/desktop/src/main/desktop-shutdown.ts:32,37`; `globalErrorInEffectFailure` at `apps/desktop/src/main/harness-supervisor.ts:171`; `newPromise` at `registration/repository-identity-query-owner.ts:333`, `registration/repository-physical-observation.ts:192`, `registration/windows-version-child.ts:92`, `storage/local-libsql-worker-client.ts:522,542`, `apps/desktop/src/main/canonical-writer-package-smoke.ts:298`, `harness-pending-request.ts:68` (the G28 core), `main.ts:81`.

### 5. Proposed curated configuration (for Pedro to approve)
Proposed severities:
- **`error`** (each rule is mapped to AGENTS.md "Effect Usage"):
  - `unknownInEffectCatch` and `globalErrorInEffectFailure`: typed errors.
  - `tryCatchInEffectGen`: no bare throw/catch inside Effect.
  - `runEffectInsideEffect`: run only at the edge.
  - `multipleEffectProvide`: no per-request provide.
  - `leakingRequirements`: service operations have `R = never`.
  - `scopeInLayerEffect`: `acquireRelease` in a scoped Layer.
  - The default-on correctness rules keep their defaults (`floatingEffect`, `missingEffectContext`, `missingEffectError`, `missingLayerContext`, …).
  - Today's src cost is 12 `unknownInEffectCatch`-class fixes on Part A, 1 `globalErrorInEffectFailure` and 1 `runEffectInsideEffect`. The other four rules already have 0 hits.
- **`newPromise`:**
  - `error` in `src/**` non-test files, with the 9 legacy sites carrying reasoned next-line suppressions until their migration slice. AGENTS bans `new Promise` coordination only in new code, so the legacy sites are waivers, not violations.
  - `off` in test files through `overrides`. The 120 test uses are gates and fakes. AGENTS asks fakes to fail with `Effect.fail`, but it does not ban `new Promise` in tests. Pedro should confirm this.
- **`warning`** (advisory, visible, does not block):
  - `anyUnknownInErrorContext`: 32 hits, the same root as `unknownInEffectCatch`.
  - `schemaNumber`: 6, tests only.
  - `unnecessaryFailYieldableError`.
  - `extendsNativeError`: 19, a hint toward tagged errors.
- **Left at default or off:** `asyncFunction`, `nodeBuiltinImport`, `missingPipeableSignature`, `strictBooleanExpressions`, `globalDate`/`globalTimers`/`processEnv`/`cryptoRandomUUID`, `deterministicKeys` and the style rules. They are noisy (up to 3,251 hits) and not AGENTS rules. The aggressive `setup` preset stays rejected (issue #105).

Proposed plugin options:
- Keep `refactors`, `quickinfo`, `completions`, `goto` and `renames` at true.
- Set `includeSuggestionsInTsc: false`, so suggestions stay out of the `tsc` output.
- Keep `ignoreEffectSuggestionsInTscExitCode: true` and `ignoreEffectErrorsInTscExitCode: false`.
- Set `ignoreEffectWarningsInTscExitCode: true`, so a warning stays advisory and only an `error` blocks.
- Leave `skipDisabledOptimization` false.
- Use `overrides` for the test globs.
- Promote rules to `error` only in the same slice that puts the Linux gate in place, as issue #105 requires. Otherwise the editor and the gate disagree.

## Code References
- `tsconfig.base.json:2-28` — compiler options; the minimal plugin entry is at `:24-28`; `skipLibCheck: true` is at `:21`.
- `package.json:40` — `typecheck` = `pnpm -r --if-present typecheck`; each package runs `tsc --noEmit -p tsconfig.json`.
- `package.json:23` — `@effect/tsgo` 0.51.1, pinned outside the catalog.
- `pnpm-workspace.yaml` — catalog `typescript: 6.0.2`, `strictPeerDependencies`, `saveExact`, `nodeLinker: hoisted`.
- `AGENTS.md:78` — type-checking authority (TS 6) and LSP advisory status.
- `dependency-cruiser.config.cjs:61` — `tsConfig: { fileName: "tsconfig.base.json" }`.
- `node_modules/dependency-cruiser/src/meta.cjs:14` — `typescript: ">=2.0.0 <7.0.0"`.
- `node_modules/@stryker-mutator/core/dist/src/sandbox/ts-config-preprocessor.js:30-46` — conditional `import('typescript')`.
- `node_modules/@effect/tsgo/lib/getExePath.js:6-34` — TS ≥ 7 discovery (`typescript`, `@typescript/native`, `gitHead`).
- `node_modules/@effect/tsgo-win32-x64/lib/upstream.json` — supported TS 7.0.2 gitHead.
- `.github/workflows/ci.yml` — `ubuntu-deep-check` and the Windows job.
- `.husky/pre-push` — `pnpm check:deep` (runs on Windows).
- `knip.jsonc:3-5` — `@effect/tsgo` and `@effect/language-service` in `ignoreDependencies`.
- `.vscode/settings.json:8` — `typescript.tsdk`.

## Integration Points

### Inbound References
- `apps/*/package.json` and `packages/*/package.json` `typecheck` scripts — call `tsc` from the hoisted bin.
- `pnpm check` and `check:deep` (`package.json:9-11`), `.husky/pre-push`, `ci.yml` — every place that runs typecheck and boundaries.
- The Claude Code local plugin `effect-tsgo-lsp` 0.51.1 (outside the repo) — the agent LSP that runs the Windows effect binary.

### Outbound Dependencies
- npm `typescript@7.0.2`, `@typescript/typescript6@6.0.2`, `@effect/tsgo@0.51.1` (and `@effect/tsgo-<platform>`).

### Infrastructure Wiring
- `tsconfig.base.json` plugins block → the LSP and patched-`tsc` diagnostics; the `diagnostics` CLI reads the same block unless `--lspconfig` is given.

## Architecture Insights
- **The authority problem moves; it does not disappear.** With the alias layout, `tsc` (7) and `tsc6` (6) can never disagree on types: both type-check identically today, and TS 7 is a faithful port. The Effect diagnostics become CI-checkable on Linux, so the LSP and the gate share one configuration.
- **A degrade that looks clean is the main hazard.** Dependency-cruiser with TS 7 as `typescript` is the `degrade-distinguishes-broken` case: it must never report "no violations" without parsing. The slice must prove that `check:boundaries` still sees `.ts` imports, for example with a deliberate forbidden import in a scratch copy.
- **The tool versions are coupled:** `@effect/tsgo` ↔ TS 7 gitHead. Renovate (`renovate.json`) must group them.

## Precedents & Lessons
3 similar past changes analyzed.

### Precedent: Effect tsgo LSP added beside TS 6
**Commit(s)**: `d91833f` — "chore(tooling): add @effect/tsgo and enable the Effect language service plugin" (2026-10-09); `e7f1ba1` — "docs(agents): make pnpm typecheck authoritative over the Effect tsgo LSP"; `0ff211e` — "chore(tooling): declare the Effect tsgo LSP packages to knip"
**Blast radius**: 3 files (`package.json`, `pnpm-lock.yaml`, `tsconfig.base.json`), then AGENTS.md and knip.jsonc
**Follow-up fixes**:
- `0ff211e` — knip flagged the binary-only packages as unused.
**Takeaway**: every new binary-only tool needs a knip entry and an authority statement in AGENTS.md in the same slice.

### Precedent: Defender quarantines of the effect binary
**Commit(s)**: none (an environment event; memory note of 2026-10-17)
**Blast radius**: the LSP binary in `node_modules`; the #123 s3 measurement run was aborted
**Follow-up fixes**:
- `lib/tsc.exe` was restored or reinstalled by 2026-10-18 (how is unknown); `artifacts/typescript/7.0.2/tsc.exe` was quarantined again at 19:57:17 on ProcessStart.
**Takeaway**: on this PC a Windows effect-tsgo step is not a reliable gate; measure and gate on Linux.

### Precedent: #35 lib-check investigation
**Commit(s)**: issue #35 (Forge 7.11.2, Drizzle 0.45.2 under TS 6)
**Blast radius**: `tsconfig.base.json:21` `skipLibCheck: true`
**Takeaway**: the warnings belong to the libraries, not the compiler; TS 7 reproduces them one for one.

### Composite Lessons
- The compiler and the tools that use it are separate concerns: switch `tsc`, and keep the API (`typescript`) on 6 until TS 7.1 and dependency-cruiser support it.
- Prove each degrade path (boundaries, Effect gate on Windows) is visibly broken, never silently clean.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md` — Phase 2 item 2 defines #105.
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` — §129 (#105 before s6, chosen diagnostics applied to Part A), §133 (#105 starts now, research only).
- `.rpiv/artifacts/research/2026-10-16_23-40-39_effect-unit2b-runtime-lifecycle-part-a.md` — the Part A baseline (`run*`, `new Promise` counts).

## Developer Context
**Q (coordinator brief, 2026-10-18): may the research change manifests or code?**
A: No. Counts came from `--lspconfig` and a read-only Docker run; TS 7 timing used a scratchpad install.

**Q (coordinator, after the Defender incident): may a Windows tsgo/tsc.exe run again?**
A: No. The measurement moved to Docker (`node:24`, read-only mounts, named volume removed afterwards), with CPU readings under 30% (4/8/3%). The earlier official TS 7 runs were disclosed and accepted.

## Related Research
- `.rpiv/artifacts/research/2026-10-16_23-40-39_effect-unit2b-runtime-lifecycle-part-a.md`

## Open Questions
Decisions for Pedro:
1. **Compiler switch:** approve a slice that moves `tsc` to TS 7.0.2 with the two aliases (`typescript` → `@typescript/typescript6@6.0.2`, `@typescript/native` → `typescript@7.0.2`)? Or wait for TS 7.1 and dependency-cruiser support?
2. **Where the Effect gate runs:** (a) a Linux CI step only; (b) CI plus a local Docker script; (c) a Defender exclusion for `node_modules/@effect/tsgo-win32-x64` after a hash check, so it runs in `check` on Windows; or (d) defer. Restoring the quarantined `artifacts/typescript/7.0.2/tsc.exe` is a separate decision.
3. **Rule set:** approve the curated severities in Detailed Findings §5, in particular `newPromise` (error in src with waivers, off in tests), `anyUnknownInErrorContext` (warning or error) and `schemaNumber` (warning).
4. **Part A before s6:** fix the 7 `unknownInEffectCatch` and 1 `runEffectInsideEffect` in the Part A files, and the 8 new `anyUnknownInErrorContext` if promoted. Do this as its own slice (s5b) or inside s6?

Migration steps (if 1 is a go):
1. Catalog: `typescript: npm:@typescript/typescript6@6.0.2` and a new `@typescript/native: npm:typescript@7.0.2`; root devDependency `@typescript/native`. Keep `@effect/tsgo` 0.51.1, which matches 7.0.2.
2. `pnpm install`. Check the bins: `tsc --version` = 7.0.2, `tsc6 --version` = 6.0.2.
3. Red proof that boundaries still parse TS: a deliberate forbidden import in a test fixture must fail `check:boundaries`.
4. Run `pnpm check`, `check:dead-code` (knip), `check:duplicates`, `test:mutation` (dry-run scope) and `package:smoke`, with the coordinator's go for the heavy ones.
5. Update `AGENTS.md:78` (authority = TS 7 `tsc`; `tsc6` for API tools), `.vscode/settings.json`, and Renovate grouping for `@effect/tsgo` with TS 7.
6. Effect gate slice (after 2 and 3 are decided): the curated `tsconfig.base.json` plugin block, the Part A and legacy fixes or waivers, and a CI step `effect-tsgo diagnostics --project <pkg>/tsconfig.json --format github-actions` per package on Linux.

Rollback: revert the catalog lines (and the lockfile) to `typescript: 6.0.2`, run `pnpm install`, and confirm that `tsc --version` reports 6.0.2. No source changes depend on TS 7, so a revert commit is enough. The Effect gate reverts on its own: remove the CI step, and the plugin block falls back to advisory LSP severities.
