---
date: 2026-10-23T00:38:22+0100
author: Pedro Mesquita
commit: 0c0842f
branch: main
repository: slopstop
topic: "#105 TypeScript 7 compiler switch (alias layout), the Effect gate in effect-tsgo diagnostics mode, s5b residuals R2-1/R2-2 and #139 gate-script mutants"
tags: [design, typescript-7, typescript-go, effect-tsgo, effect-gate, dependency-cruiser, toolchain, defender, mutation, issue-105, issue-139]
parent: .rpiv/artifacts/research/2026-10-18_20-08-00_typescript-7-and-effect-tsgo-gate.md
lane: normal
lane_reasons: ["files: 11 > 5", "manifest: package.json", "manifest: pnpm-lock.yaml", "user decision (§143): lane normal from lane.mjs --paths, over the research lane rigorous"]
status: in-review
last_updated: 2026-10-23T01:30:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Pedro's §143 decisions applied before approval: lane normal, Q1 (a) one slice, Q2 (b) gate moves to effect-tsgo diagnostics mode with opening measurement M1 and a stop rule, Q3 (a), Q4 (a), Q5 (a). Earlier: lean brief written, lane rigorous inherited, Q1-Q5 open."
content_hash: 411b3efe7090f517890db338c15d28a4731d7f7eb4ec5a9b49be85cc03c6a1d3
---

# Design: #105 TypeScript 7 compiler switch

Lane: **normal**, Pedro's decision (§143). `lane.mjs --paths` over the planned files answers `normal` ("files: 11 > 5", "manifest: package.json", "manifest: pnpm-lock.yaml"). Pedro set the feature lane to that result instead of the research lane (`rigorous`), so: linked worktree, no intent review, no approach-check dispatch, slice-verifier at candidate review with **one** candidate review round (Pedro), full deep-review, and Pedro's acceptance of the result.

## Intent

**Outcome.** `pnpm typecheck` runs TypeScript 7.0.2 (TypeScript-Go, about 5-6x faster, 0 errors today; research §1, Summary). The tools that need the TypeScript JavaScript API keep TypeScript 6.0.2, so no gate silently stops seeing TypeScript. The Effect gate moves to `effect-tsgo diagnostics` mode, which runs the Effect build matched to the installed TypeScript 7, and it still never reports a broken or unreadable run as clean. The two s5b residuals in the gate's output are fixed, and every mutant of the final gate script is killed or proven equivalent (#139).

**Scope** (decisions log §134 item 1, §143):
1. The alias layout: catalog `typescript` → `npm:@typescript/typescript6@6.0.2`, new `@typescript/native` → `npm:typescript@7.0.2`; root devDependency `@typescript/native`.
2. A durable proof that `pnpm check:boundaries` still parses TypeScript imports.
3. The Effect gate in `effect-tsgo diagnostics` mode (D3), with its parser built from recorded real output (M1).
4. s5b residuals R2-1 (the 20-line cap truncates the `EFFECT_GATE_VIOLATIONS` list) and R2-2 (a duplicated canary line gives a mismatch with empty lines) (decisions log §134, `:1512`).
5. #139: every non-killed mutant of the final `apps/harness/scripts/check-effect-diagnostics.mjs` killed or proven equivalent; the Stryker-sandbox failure of the two real-compiler rows investigated, time-boxed (Q4 (a)).
6. The authority text (`AGENTS.md:78`, the editor stays advisory), the Defender note, and Renovate grouping.

**Non-goals.** TypeScript 7.1 and a dependency-cruiser that supports it (Deferred). New Effect rules or severity changes (the curated set of §134 item 3 is unchanged). A `ci.yml` change: both CI jobs already run `pnpm check` (§134 coordinator decision). Moving the editor to TypeScript 7 (Q3 (a)). `skipLibCheck` (#35: unchanged under TS 7, research Summary). A fallback to tsc mode (Pedro, §143).

**Constraints.** `degrade-distinguishes-broken`: a tool that cannot parse, or a gate whose run or output it cannot trust, fails visibly and never reports clean. The heavy-run policy of 2026-10-23: integration, e2e and smoke run in the `check:deep` before the push, not per slice, unless the slice touches their surface (D8).

## Architecture

**Ownership after the switch.**

| Need | Package (alias) | Binary | Used by |
|---|---|---|---|
| Type checking (authority) | `@typescript/native` = `typescript@7.0.2` | `tsc` | the four `typecheck` scripts (`apps/*/package.json`, `packages/*/package.json`: `tsc --noEmit -p tsconfig.json`) |
| TypeScript JavaScript API | `typescript` = `@typescript/typescript6@6.0.2` | `tsc6` (not a gate) | dependency-cruiser (`createSourceFile`, gated `<7.0.0`, `node_modules/dependency-cruiser/src/meta.cjs:14`); Stryker's conditional tsconfig rewrite (`@stryker-mutator/core/dist/src/sandbox/ts-config-preprocessor.js:30-46`, path not taken today); the editor's built-in TypeScript (`.vscode/settings.json:8`, advisory, Q3 (a)) |
| Effect diagnostics (gate, LSP) | `@effect/tsgo` 0.51.1 + `@effect/tsgo-<platform>` | `effect-tsgo` (Node CLI, `node_modules/@effect/tsgo/package.json` `bin`), which runs `artifacts/typescript/<version>/tsc` | `pnpm check:effect`; the editor/agent LSP |

**How diagnostics mode finds its binary.** `@effect/tsgo/lib/getExePath.js:6-89` resolves `typescript`, then `@typescript/native`, from `process.cwd()`, takes the first with major ≥ 7 and a `gitHead`, and runs the artifact whose `upstream.json` component has that `gitHead`; otherwise it throws ("Unable to resolve a native TypeScript package…", "No packaged Effect TypeScript executable matches…"). Under the alias layout, `typescript` (6.0.2) is skipped and `@typescript/native` 7.0.2 (gitHead `2bd066d87f5bafd315be9f40889d0a60b9e58e0b`) matches the `7.0.2` component (`node_modules/@effect/tsgo-win32-x64/lib/upstream.json`). So the gate and the authority run the same TypeScript-Go version, and a later mismatch fails at discovery instead of passing on an older build.

**The gate today** (`apps/harness/scripts/check-effect-diagnostics.mjs`): `lib/tsc` in tsc mode (`:25-38`, `:77-94`), a regex parser of `file(line,col): error|warning TSnnnn` plus `effect(<rule>)` (`:10-13`, `:40-63`), the canary first (`:130-175`), the waiver register (`:199-301`), and a block on every `error`-level Effect diagnostic and every non-Effect error (`:107-128`, `:181-197`).

**The gate after the switch.**
- **Run.** For each project, spawn `effect-tsgo diagnostics --project <project>/tsconfig.json --format <F>` from the repository root, with no `--lspconfig`, so the project's real plugin block is what runs (the canary then proves it). `<F>` is the format M1 shows to carry file, line, column, severity and rule per diagnostic (preferably `json`).
- **Parse.** A parser written from M1's recorded output. Output that does not parse as that format, completely, is `EFFECT_GATE_BROKEN` with the first non-empty lines; never clean.
- **Classify.** By M1's recorded exit-code table, with these invariants that hold whatever the table says:
  - a run that did not start, was killed or has no exit status is `EFFECT_GATE_BINARY_FAILED` (as today);
  - a discovery failure (no TypeScript ≥ 7, no matching Effect build, a missing platform package) is `EFFECT_GATE_BINARY_MISSING`, with its cause line;
  - an exit code not in the table is `EFFECT_GATE_BROKEN`;
  - an exit that means "clean" with any error-level entry, or an exit that means "found" with no entry that explains it, is `EFFECT_GATE_BROKEN`;
  - error-level Effect diagnostics block (`EFFECT_GATE_VIOLATIONS`); warnings are counted, never blocking.
- **Canary, register, order.** Unchanged in role: the canary runs first and must match its exact expected set (re-derived in M1; the planted `newPromise` and `unknownInEffectCatch` errors present, the waived line and the two test-file lines absent), then the waiver register, then the four packages.
- **Type errors.** Whether diagnostics mode reports plain TypeScript errors is an M1 fact. After the switch, plain type errors are the authority's job (`pnpm typecheck` runs the same TypeScript-Go 7.0.2), so the gate no longer needs to treat them as broken runs; if diagnostics mode does report them, they stay `EFFECT_GATE_BROKEN` as today. `AGENTS.md:78` states whichever M1 shows.

**Boundaries proof (B2).** A unit test drives dependency-cruiser's JavaScript API on a temporary fixture tree with the repository's rule set and `tsConfig`, and asserts a forbidden TypeScript import is reported. It guards the switch now and any later removal of the TS 6 alias.

**Process boundaries.** None change. No product source changes; the protocol, harness runtime and desktop are untouched.

## Decisions

- **D1 (inherited, §134 item 1, research §2): the alias layout.** Rejected: TS 7 alone as `typescript`, because dependency-cruiser 18.x accepts only `>=2.0.0 <7.0.0` (`node_modules/dependency-cruiser/src/meta.cjs:14`) and would stop parsing `.ts`, a silent degrade of `pnpm check:boundaries`. Rejected: waiting for TS 7.1 (Pedro chose "Depois da Parte A", now).
- **D2 (inherited, §134 item 2): the gate runs in `pnpm check` on Windows (relying on the Defender folder exclusion) and in CI `ubuntu-deep-check`** (through `pnpm check:deep:portable` → `pnpm check`, `package.json:14`, `:20`; the Windows CI job runs `pnpm check` too, `.github/workflows/ci.yml:74-75`). No `ci.yml` change.
- **D3 (Pedro, §143, Q2 (b)): the gate moves to `effect-tsgo diagnostics` mode now**, with M1 before the parser and a stop rule: if M1 shows the mode cannot meet the guarantees (a complete, parseable per-diagnostic format; distinguishable exits for clean, found and broken; a discovery failure that is not exit "clean"; a canary that proves the real plugin block), the implementer stops and reports to the coordinator. No silent fallback to tsc mode. Rejected: tsc mode with version-matched selection (the earlier proposal) and keeping `lib/tsc`; patch mode stays rejected (it replaces the authority `tsc` with the Effect build, research §3).
- **D4: the type-checking authority after the switch is `pnpm typecheck`, running TypeScript 7.0.2** (`tsc` from `@typescript/native`). `tsc6` (6.0.2) exists only for the JavaScript-API tools and is not a gate. The editor's built-in TypeScript stays 6.0.2 (`.vscode/settings.json:8` unchanged, Q3 (a)) and is advisory, like the LSP. `AGENTS.md:78` is reworded (B7). `CLAUDE.md` names no TypeScript version itself (checked: no `6.0.2` or `TS 6` in it); it reaches that text only through its `@AGENTS.md` import, so it needs no edit.
- **D5: R2-1.** The `EFFECT_GATE_VIOLATIONS` failure lists every violation; the 20-line cap stays for every other code.
- **D6: R2-2.** The canary comparison counts each key (a multiset), so a duplicated diagnostic is named as `extra <key>`; a mismatch never has an empty detail list.
- **D7: the Defender note becomes durable guidance.** On Windows, the Effect build needs a Defender folder exclusion for `node_modules\@effect\tsgo-win32-x64` in every checkout or worktree (§134 research decisions); diagnostics mode runs `artifacts/typescript/7.0.2/tsc.exe`, the file quarantined on 2026-10-18 (research §3), which that exclusion covers. On every `@effect/tsgo` or `@typescript/native` bump, the coordinator re-verifies each `tsc.exe` against the npm tarball hash before any run. The official `typescript@7.0.2` `tsc.exe` ran 6 times without a detection (research Summary).
- **D8: heavy runs (policy 2026-10-23).** No product source changes, so no per-slice integration, e2e or `package:smoke` run; the pre-push `check:deep` covers them, including Vite and Forge under the new lockfile. The one heavy run is the scoped gate-script mutation, once, on the final candidate.
- **D9 (Pedro, §143, Q1 (a)): one slice.**
- **D10 (Pedro, §143, Q4 (a)): M2 is time-boxed** (one attempt, at most one hour of agent time); if configuration cannot make the two real-compiler rows run in the sandbox, they stay out of the mutation run only (§142 coordinator decisions a/a2) and fake-compiler rows kill the mutants they would have covered.
- **D11 (Pedro, §143, Q5 (a)): Renovate** gets one group for `typescript`, `@typescript/native`, `@effect/tsgo` and `@effect/tsgo-*`, with `dependencyDashboardApproval: true`, so no bump lands before the D7 hash check.

## Next Slice

### Slice ts7-s1-compiler-switch (detailed 2026-10-23)

- **slice_id:** `ts7-s1-compiler-switch`
- **Lane:** normal (Pedro, §143; equal to `lane.mjs --paths`).
- **Base:** `main` at `0c0842f` (Part A integrated as `4cf6541`, §142).
- **Behaviour IDs:** TS7-B1 … TS7-B7.
- **Affected files:**
  - `pnpm-workspace.yaml` (catalog), `package.json` (root devDependency `@typescript/native`), `pnpm-lock.yaml`.
  - `apps/harness/scripts/check-effect-diagnostics.mjs` and `.test.mjs`; recorded M1 output used as test fixtures (location chosen by the implementer beside the test, outside every tsconfig `include` and the waiver scan).
  - `apps/harness/scripts/check-boundaries-parse.test.mjs` (new; name proposed).
  - `AGENTS.md` (`:78` authority and editor; an Environment bullet for D7).
  - `renovate.json` (D11).
  - `knip.jsonc` only if `pnpm check:dead-code` flags `@typescript/native` or `typescript` (with a reason comment, as for `@effect/tsgo`, `knip.jsonc:2-4`).
  - Mutation scope: a scoped Stryker config and Vitest config for the gate script (new, as for s6-s8), plus its `knip.jsonc` entry.
- **Opening steps (before the parser is written):**
  - **M1, the diagnostics-mode format.** After the switch is installed (B1), run `effect-tsgo diagnostics --project <tsconfig> --format <F>` for each format the CLI offers (`json`, `text`, `pretty`, `github-actions`; research §3), from the repository root, and record verbatim stdout, stderr and the exit code for:
    1. each of the four packages (the repository, today's state);
    2. the canary project;
    3. a clean project (a scratch project with the real plugin block and no hits);
    4. a planted error (a scratch `unknownInEffectCatch`);
    5. warnings only (a scratch `anyUnknownInErrorContext` with no error);
    6. a plain TypeScript type error with no Effect hit;
    7. broken configuration: a missing tsconfig; an invalid tsconfig JSON; the plugin block removed;
    8. discovery failure: run from a directory where no TypeScript ≥ 7 resolves.
    - Where: Docker `node:24` with read-only mounts as in research §3, or Windows with the exclusion in place; either needs the coordinator's GO (CPU rule). Save to `.rpiv/evidence/2026-10-23_00-38-22_typescript-7-compiler-switch/m1-diagnostics-format.md` with the raw outputs, and the chosen `<F>`, the exit-code table and the re-derived canary set.
    - **Stop rule (D3):** if any guarantee in D3 fails in M1, stop and report to the coordinator before writing the parser.
  - **M2, the sandbox canary failure (#139, D10).** Reproduce once why "runs the canary before any package: real canary" and "passes on the repository" fail inside the Stryker sandbox (`.rpiv/artifacts/evidence/2026-10-22_123-combined-mutation-3/`), and record the cause and the outcome.
- **Order of work:** the switch (B1, B2 pin); M1; the gate rewrite (B3 red→green from M1 fixtures); R2-1 (B4); R2-2 (B5); the #139 rows (B6); the docs (B7); M2; then the review/refactor gate, CodeScene, and the scoped mutation once on the final candidate.

### Test Contract: ts7-s1-compiler-switch

- **Fixtures.** Gate rows call `checkEffectDiagnostics({ root, projects, canary, register, resolve, exists, spawn })` with fake `spawn` results whose stdout, stderr and status are M1's recorded outputs (paths rewritten to the fake root), and temporary roots for the register (`check-effect-diagnostics.test.mjs` style). Where a row names "the recorded <case>", it means M1 case <case> verbatim.
- **Behavior TS7-B1**: the authority compiler is TypeScript 7.0.2, and the JavaScript API stays 6.0.2.
  - Seam: the installed toolchain from the repository root.
  - Test: `pnpm exec tsc --version`, `pnpm exec tsc6 --version`, `node -e "const ts=require('typescript');console.log(ts.version, typeof ts.createSourceFile)"` -> evidence log `ts7-s1-toolchain.log` (a command check, not a Vitest row).
  - Oracle: `Version 7.0.2`; `Version 6.0.2`; `6.0.2 function`. `pnpm typecheck` exits 0 for all four packages.
  - Expected red at `0c0842f`: `tsc --version` prints `Version 6.0.2`; `tsc6` is not found.
- **Behavior TS7-B2**: `check:boundaries` still parses TypeScript and reports a forbidden import.
  - Seam: dependency-cruiser's JavaScript API (`cruise`) with the rule set and options of `dependency-cruiser.config.cjs`, on a temporary tree.
  - Test: `reports a forbidden TypeScript import: $name` -> `apps/harness/scripts/check-boundaries-parse.test.mjs` (`it.each`). Rows:
    - `value import`: `apps/desktop/src/a.ts` has `import { x } from "../../harness/src/b.ts";` → exactly one violation, rule `no-app-to-app-imports`, from `apps/desktop/src/a.ts` to `apps/harness/src/b.ts`;
    - `type-only import`: `import type { X } from "../../harness/src/b.ts";` → the same single violation;
    - `allowed`: `apps/desktop/src/a.ts` imports a sibling `./c.ts` → 0 violations, and the module list contains `apps/desktop/src/c.ts`.
  - Expected red: none — pin (TS 6 is the API before and after the switch).
  - Binding (evidence, restored by digest): with `typescript` temporarily resolving to TS 7 (a scratch install), the `value import` and `type-only import` rows fail (0 violations).
- **Behavior TS7-B3**: the gate runs `effect-tsgo diagnostics` per project and classifies each run so that no broken or unreadable run is clean.
  - Seam: `checkEffectDiagnostics` with fake `resolve`, `exists` and `spawn`.
  - Test: `runs effect-tsgo diagnostics on each project` -> `check-effect-diagnostics.test.mjs`. Oracle: `projects` `["packages/kernel", "apps/desktop"]`, recorded clean runs → two spawns, in that order, each `node <@effect/tsgo bin> diagnostics --project <project>/tsconfig.json --format <F>` with `cwd` the root and no `--lspconfig`; result `{ ok: true, warnings: 0, projects: ["packages/kernel", "apps/desktop"] }`.
  - Test: `classifies a diagnostics run: $name` -> `check-effect-diagnostics.test.mjs` (`it.each`). Rows:
    - `clean`: the recorded clean run → ok, 0 warnings;
    - `warnings only`: the recorded case 5 → ok, warnings = the recorded count;
    - `planted error`: the recorded case 4 → `EFFECT_GATE_VIOLATIONS`, `violations` exactly the recorded `{ file, line, rule }`;
    - `plain type error`: the recorded case 6 → per M1: `EFFECT_GATE_BROKEN` naming it if reported, otherwise ok (and `AGENTS.md` says so);
    - `missing tsconfig`, `invalid tsconfig`: the recorded case 7 runs → `EFFECT_GATE_BROKEN` (or `EFFECT_GATE_BINARY_FAILED` if M1 shows no exit status), never ok;
    - `discovery failure`: the recorded case 8 → `EFFECT_GATE_BINARY_MISSING`, with its first stderr line;
    - `unparseable output`: a "found" exit with output that is not the format (for example one truncated record) → `EFFECT_GATE_BROKEN` with the first non-empty lines;
    - `clean exit with an error entry`: the clean exit status with the planted-error output → `EFFECT_GATE_BROKEN`;
    - `found exit with no entry`: the "found" exit status with empty output → `EFFECT_GATE_BROKEN`;
    - `unknown exit`: status 7 → `EFFECT_GATE_BROKEN` `"<project>: exit 7"`;
    - `killed`, `spawn error`, `no status`: as the existing `binaryRows` (`:186`) → `EFFECT_GATE_BINARY_FAILED`;
    - `no effect-tsgo`: `@effect/tsgo` cannot be resolved → `EFFECT_GATE_BINARY_MISSING` `"cannot resolve @effect/tsgo"`, no spawn.
  - Test: `runs the canary before any package: $name` (the existing rows at `:261-294`, kept with their names) -> `check-effect-diagnostics.test.mjs`. The `plugin removed` row uses M1 case 7's plugin-removed canary output → `EFFECT_GATE_CANARY_MISMATCH`, so a removed plugin block cannot pass.
  - Expected red: against the scaffold (the spawn command switched, the old regex parser and classification kept), `runs effect-tsgo diagnostics on each project` passes only if the command is right, and every recorded-output row fails because the regex parser reads none of the new format (`planted error` answers ok; `discovery failure` answers `EFFECT_GATE_BROKEN` or ok).
- **Behavior TS7-B4**: a violations failure names every violation; other failures stay capped at 20 lines.
  - Test: `lists every violation: $count` -> `check-effect-diagnostics.test.mjs`. Rows `count` = 20, 21, 25 error-level Effect diagnostics (recorded format) → `EFFECT_GATE_VIOLATIONS`, `lines.length` = `count`, each `<file>(<line>,<col>) <rule>` in output order, `violations.length` = `count`.
  - Test: `caps other failure details at 20 lines: $count` -> `check-effect-diagnostics.test.mjs`. Rows: 20 waiver-register `unregistered directive` lines → all 20; 21 → the first 19 then exactly `… 2 more`; 25 → the first 19 then `… 6 more`.
  - Expected red: the 21 and 25 violation rows show 20 lines ending in `… N more` (R2-1). The cap rows: none — pin (they kill the `:20` survivors).
- **Behavior TS7-B5**: a canary mismatch always names what differs, duplicates included.
  - Test: `names every canary difference: $name` -> `check-effect-diagnostics.test.mjs` (`it.each`, fake canary spawn in the recorded format). Rows, each `EFFECT_GATE_CANARY_MISMATCH` with `lines` exactly:
    - `duplicated line`: the expected set plus a second copy of its first key → `["extra <first key>"]`;
    - `duplicate replaces a line`: one expected key missing and another duplicated (same length) → `["extra <dup>", "missing <gone>"]`;
    - `moved`: one key's column + 1 → `["extra <moved>", "missing <original>"]`;
    - `clean exit, same set`: the expected set with the clean exit status → `["canary exit <clean status>"]`;
    - `matched`: the expected set in any order with the "found" status → the gate continues and the full call answers `canary: "matched"`.
    - Invariant in every mismatch row: `lines.length > 0`.
  - Expected red: `duplicated line` gives `lines` `[]` (R2-2); `duplicate replaces a line` gives only `["missing <gone>"]`. Other rows: none — pin (they kill the `:159-173` survivors without the real compiler, D10).
- **Behavior TS7-B6**: the remaining #139 survivor groups each have a killing row.
  - Test: `scans every registered location: $name` -> `check-effect-diagnostics.test.mjs`. Rows (temporary roots, one unregistered directive each, → `EFFECT_GATE_WAIVER_UNREGISTERED` naming that file): `apps/x/src/deep/a.ts` (recursive); `packages/y/src/a.ts` (both areas); a root-level `apps/x/a.ts`; `apps/x/tests/a.ts`. And `apps/x/src/node_modules/z/a.ts` is not scanned (the kept S5B-R2-6 row).
  - Test: `rejects an incomplete waiver entry: $name` -> `check-effect-diagnostics.test.mjs`. Rows: `reason` `"   "`; `removeWhen` missing; `reason` a number → `EFFECT_GATE_BROKEN`, `lines` exactly `["<id>: missing reason"]` (or `removeWhen`).
  - The `projects` survivor (`:191`) is killed by `runs effect-tsgo diagnostics on each project` (B3); the parser survivors (`:44`, `:51`, `:60`) go with the regex parser, and the new parser's mutants are covered by B3 and B4.
  - Expected red: none — pin (the current scan and register checks behave this way).
- **Behavior TS7-B7**: the docs state the new authority, the editor and the Defender rule.
  - Test: none (documentation). Checked at candidate review against D4 and D7: `AGENTS.md:78` names `pnpm typecheck` with TypeScript 7.0.2 (`@typescript/native`) as the authority, `typescript`/`tsc6` 6.0.2 as the JavaScript API for tools, the editor's built-in TypeScript (6.0.2) and the LSP as advisory, and `pnpm check:effect` as `effect-tsgo diagnostics` blocking every error-level Effect diagnostic and every broken run (with M1's answer on plain type errors); one Environment bullet carries D7.
- **TDD-exempt:**
  - The catalog, root `package.json` and lockfile change — proven by TS7-B1, TS7-B2 and `pnpm check`.
  - `AGENTS.md`, `renovate.json`, `knip.jsonc` — configuration and documentation; `renovate.json` checked with `npx --yes --package renovate renovate-config-validator` if available, otherwise by review.
  - The mutation configuration files — checked by the scoped run and `pnpm check:dead-code`.

### Success Criteria: ts7-s1-compiler-switch

**Automated:**
- Red then green per behaviour: `pnpm exec vitest run --project harness apps/harness/scripts/check-effect-diagnostics.test.mjs apps/harness/scripts/check-boundaries-parse.test.mjs [-t <name>]`; TS7-B1 by its commands, logged.
- `pnpm check` (with `check:effect` in diagnostics mode and `check:boundaries`); `pnpm check:boundaries` shows no missing-compiler warning; `pnpm check:dead-code`; `pnpm check:duplicates`.
- Bindings, each restored by digest: TS7-B2 with `typescript` at 7; TS7-B3 treating unparseable output as clean makes `unparseable output` fail, and passing `--lspconfig '{}'` makes the canary `plugin removed`-class mismatch appear on the real canary; TS7-B4 re-adding the cap to violations makes the 21 row fail; TS7-B5 a set-based comparison makes `duplicated line` fail; the R2-5 planted `unknownInEffectCatch` still fails `pnpm check:effect` on the switched tree.
- CodeScene `code_health_score` on every changed source file, raw output saved (target 10, AGENTS.md).
- **Scoped mutation** once on the final candidate, with the coordinator's GO: `mutate` = `apps/harness/scripts/check-effect-diagnostics.mjs`; tests = its test file (with M2's outcome for the two real-compiler rows). Pass rule: every counted mutant killed (a `Timeout` counts as killed) or declared equivalent with a written reason the coordinator accepts (#139 "Done when").
- Not per slice (D8): integration, e2e, `package:smoke`; they run in the pre-push `check:deep`.

**Manual:**
- On Windows, outside the agent, in the main checkout after integration (the exclusion exists there): `pnpm check` passes and reports `Effect diagnostics verified`.
- The first CI run after the push: both jobs green, the Linux job showing the Effect gate ran.

## Deferred Work

- **TypeScript 7.1 and dependency-cruiser support.** Trigger: TS 7.1 ships its JavaScript API and dependency-cruiser declares support. Then drop the `@typescript/typescript6` alias; TS7-B2 is the guard.
- **The editor on TypeScript 7** (Q3 (a) kept it on 6). Trigger: the alias is dropped, or Pedro asks.
- **Forwarding harness fatal lines to the desktop log** stays with #133 (§141); unrelated to this slice.

## Verification Notes

- Risks: the silent-clean degrades (boundaries without a parse; a gate whose output it cannot read) are the main hazard; TS7-B2 and TS7-B3 pin them, and M1's stop rule guards the mode choice itself.
- Defender: diagnostics mode runs `artifacts/typescript/7.0.2/tsc.exe` (D7). A new worktree for this slice needs Pedro's exclusion before any gate run or M1 on Windows.
- Baseline: `pnpm check` green at `0c0842f` (§142); 50 advisory warnings from the gate at s5b.
- Evidence: `.rpiv/evidence/2026-10-23_00-38-22_typescript-7-compiler-switch/` (planned: M1, M2, toolchain log, bindings, CodeScene, mutation); #139 baseline `.rpiv/artifacts/evidence/2026-10-22_123-combined-mutation-3/non-killed.txt`.
- Rollback (research): revert the catalog, lockfile and gate script together, `pnpm install`, confirm `tsc --version` 6.0.2. A partial revert (TS 6 with the diagnostics-mode gate) fails visibly at discovery (`EFFECT_GATE_BINARY_MISSING`), never clean.

## Developer Context

**Q (coordinator, 2026-10-23, §143): write a lean brief for the #105 compiler switch, with R2-1, R2-2 and #139; state the gate mode, the authority, the Defender note and the lane; propose the slicing and list questions.**
A: First version written with lane rigorous (inherited) and Q1-Q5 open (`content_hash b915fb3d…`, not approved).

**Pedro's decisions (§143, through the coordinator), applied directly because the brief was not yet approved:**
- Lane normal (the `lane.mjs` result): no intent review, no approach-check dispatch, one candidate review round.
- Q1 (a): one slice (D9).
- Q2 (b): diagnostics mode now, with an opening measurement of the real output and exit codes on the repository and the canary (clean, planted error, warning only, broken config) before the parser; the parser is built from that output; the canary still proves no silent clean; unparseable output is BROKEN; if the mode cannot meet those guarantees, stop and report, no silent fallback to tsc mode (D3, M1).
- Q3 (a): the editor stays on TS 6; AGENTS.md says the editor is advisory (D4).
- Q4 (a): M2 time-boxed, then fake-compiler rows (D10).
- Q5 (a): one Renovate group with `dependencyDashboardApproval` (D11).
- Approach check: `not run (lane normal, Pedro's decision)`.
- Intent approval is distinct from build authority; branch and worktree wait for Pedro (§143).

**Implementation (ts7-s1-compiler-switch, 2026-10-23, implementer; decisions through the coordinator):**
- TS7-B2 `type-only import` row dropped (Pedro, (b)). Its oracle was false before the switch too: `dependency-cruiser.config.cjs` has no `tsPreCompilationDeps`, so `check:boundaries` ignores `import type`; turning it on gives 9 type-only `no-circular` errors and no cross-app one. Issue #141 holds the gap. The `value import` row keeps the parse proof.
- M1 run on Windows with the CPU rule not met (Windows Search indexing; no game); Pedro told the implementer directly to go ahead. Result: `--format json`; exit 0 = no error-level entry, exit 1 = errors found or a broken run.
- M1 stop-rule call (coordinator, disclosed to Pedro): D3's "distinguishable exits" is met by exit code plus output shape. The gate needs a complete JSON report whose summary counts match its entries, with exit 0 = 0 errors and exit 1 = more than 0. Anything else is `EFFECT_GATE_BROKEN`, and a `DiscoveryError` line is `EFFECT_GATE_BINARY_MISSING`. Diagnostics mode does not report plain type errors (M1 case 6); `pnpm typecheck` owns them.
- Deviation from the TS7-B3 oracle text (spawn `cwd` and `--project` form): the gate spawns `effect-tsgo` with `cwd` set to the repository that holds the script, and passes `--project` as the absolute `<root>/<project>/tsconfig.json`. `effect-tsgo` finds TypeScript 7 only from its working directory (M1 case 8), so a `cwd` of a temporary root is a discovery failure. When `root` is the repository, the run is the same as the brief's.
- The gate's mutation scope moves out of `stryker.project-storage.config.json`, whose ranges pointed at the old script, into `stryker.effect-gate.config.json`.

**Candidate review round 1 (slice-verifier, candidate `5ad6553`, 2026-10-23): passed, 0 violations, 3 warnings; coordinator triage disclosed to Pedro; no round 2.**
- V1, D4 correction: VS Code no longer gets TypeScript 6.0.2. The alias puts the `@typescript/typescript6` wrapper at `node_modules/typescript`, whose `lib/` has no `tsserver.js`, so `typescript.tsdk` (`.vscode/settings.json:8`, unchanged) is not a valid workspace TypeScript, and VS Code uses its own bundled TypeScript (version not pinned). D4's and the table's "editor's built-in TypeScript stays 6.0.2" is replaced by that; the editor stays advisory. `AGENTS.md` is reworded accordingly.
- V2: `pnpm check:dead-code` (exit 0) and `pnpm check:duplicates` (0 clones) recorded at `5ad6553`; no `knip.jsonc` entry needed.
- V3: "passes on the repository" takes about 7.6 s alone (15 s bound, unchanged); only its comment is updated.
- Brief text corrections: in M1 the discovery failure's `DiscoveryError` line is on stdout, not stderr (TS7-B3 `discovery failure` row). Discovery is done by the `effect-tsgo` CLI from its working directory by TypeScript major version and file hash (`dist/effect-tsgo.cjs`), not by `lib/getExePath.js` gitHead matching as the Architecture section says.
- Mutation: Pedro dropped M2 and the scoped gate-script mutation ("esquece a mutacao", 2026-10-23). #139's "every mutant killed or equivalent" and D10 stay unproven residuals.

## TDD Evidence (implement)

- ts7-s1-compiler-switch: `.rpiv/artifacts/evidence/2026-10-23_ts7-s1/` (toolchain red/green logs, `defender-and-hashes.log`, `m1-diagnostics-format.md` and `m1-raw/`, `b3-red-scaffold.log`, `green.log`, `bindings/`, `bindings-real/`, `codescene.log`).

## References

- Research: `.rpiv/artifacts/research/2026-10-18_20-08-00_typescript-7-and-effect-tsgo-gate.md` (content_hash `dbf67b1a…`)
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §134 (`:1426-1523`), §142, §143
- s5b brief (the gate's earlier contract): `.rpiv/artifacts/designs/2026-10-17_00-35-29_effect-unit2b-runtime-lifecycle-part-a.md`, `### Slice u2b-s5b-effect-gate`
- Issues: #105, #139, #133
- Standing decisions: `.rpiv/decisions/degrade-distinguishes-broken.md`
- Sources: `apps/harness/scripts/check-effect-diagnostics.mjs`, `node_modules/@effect/tsgo/lib/getExePath.js`, `node_modules/@effect/tsgo/README.md:30-36`, `node_modules/@effect/tsgo-win32-x64/lib/upstream.json`, `node_modules/dependency-cruiser/src/meta.cjs:14`, `dependency-cruiser.config.cjs`, `package.json`, `pnpm-workspace.yaml:65`, `AGENTS.md:78`, `.vscode/settings.json:8`, `renovate.json`, `knip.jsonc:2-4`
