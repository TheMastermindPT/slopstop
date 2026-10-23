# fix/ci-red: TDD evidence (2026-10-23)

- Branch `fix/ci-red` from `30c905f`, main checkout. Decisions: Pedro, decisions log at `30c905f` (fix now, no designer brief, no review round). Diagnosis: `../2026-10-23_ci-red-diagnosis.md`.
- Pedro deleted the stray `C:\Users\pedro\node_modules` before this work (checked: the folder is absent).

## B: Effect gate fixtures (`apps/harness/scripts/check-effect-diagnostics.test.mjs`)

- Red (`b-red.txt`): with the stray install gone, the CI failures reproduce locally, as expected:
  - `fails on a planted Effect error: 'unknownInEffectCatch'` gives `{ ok: true, warnings: 0, … }`;
  - `plugin removed, real compiler` lists the 3 extra `missing …` lines.
- Change: each temporary root gets `node_modules/effect` linked to the repository copy (`linkEffect`: a junction on win32, a `dir` symlink elsewhere, target `realpathSync`). The `paths` mapping is dropped. `afterEach` unlinks the links before it removes the roots.
- Green (`b-green.txt`): 62/62. `node_modules/effect` in the repository still holds 8 entries after the run.

## Hardening measurement

- `list-files/` holds `effect-tsgo diagnostics --format json --list-files` for the canary and the four packages:
  - 466 files, all `detectedEffect: "v4"`;
  - this includes 54 renderer files (`apps/desktop/src/renderer`).
- No checked file legitimately reports `unknown`, so the rule went ahead.
- M2 (`m2-list-files/`, script `m2-list-files.mjs` in the session scratchpad) ran each case with and without `--list-files`: canary, kernel, a linked temp planted project and an unlinked one.
  - `--list-files` only adds a top-level `files` array of `{ file, detectedEffect, supportedEffect }`. `diagnostics` and `summary` are identical in every case.
  - Unlinked: `unknown/v3`, exit 0, `errors` 0 (the CI silent clean). Linked: `v4/v4`, exit 1, 1 error.
- The M1 recorded fixtures stay verbatim. The test helper `recordedRun` adds the `files` list that M2 shows `--list-files` adds; `files: null` keeps the recorded report without it.

## B-hardening: the gate (`apps/harness/scripts/check-effect-diagnostics.mjs`)

- Red (`h-red.txt`), 4 rows, each for its expected reason:
  - `fails on a file that resolves no Effect v4` (real compiler, unlinked root): `{ ok: true }` instead of `EFFECT_GATE_BROKEN`;
  - `runs effect-tsgo diagnostics on each project`: argv without `--list-files`;
  - `classifies a diagnostics run: 'report without a file list'`: `ok: true` instead of broken;
  - `classifies a diagnostics run: 'file without Effect v4'`: `ok: true` instead of broken.
- Change: the gate passes `--list-files`. `readReport` requires a valid `files` list; without one the run is unreadable and therefore `EFFECT_GATE_BROKEN`. Any listed file whose `detectedEffect` is not `v4` fails as `EFFECT_GATE_BROKEN`, line `<project>: <file> detects Effect <version>, not v4`. This applies to the canary and to every package.
- Green (`h-green.txt`): 65/65. The real gate prints `Effect diagnostics verified; 50 advisory warnings.` (exit 0).
- AGENTS.md: the authority line names the new broken case.

## C: `passes on the repository`

- Timeout `15_000` changed to `30_000` on that row only, as Pedro approved. The comment records the CI timings (12.6-13.4 s).

## A: `apps/desktop/src/main/package-smoke-launcher.test.ts`

- Red: CI only (Ubuntu deep check, 77 rows, see the diagnosis). It cannot be observed on this Windows host.
- Correction to the diagnosis: the test already forces `process.platform`/`arch` to `win32`/`x64` in `beforeEach`. The Linux failure therefore comes from the host itself (POSIX `path`, Windows paths such as `Program Files`), not from the script reading `process.platform`. The fix is the same.
- Change: the hooks and rows sit in `describe.runIf(hostPlatform === "win32")("package smoke launcher", …)`. `hostPlatform` is captured at module load, before `beforeEach` overrides `process.platform`. `git diff -w` shows only the wrapper, the import and Biome line wrapping.
- Windows (`a-before.txt`, `a-after.txt`): 101/101 before and after.
- The Linux skip is proven only by the next CI run.

## Gates

- CPU: 3, 2 and 2 %; no League/TFT/Overwolf process.
- `pnpm check` (`pnpm-check.log`): exit 0, 3338/3338 (3335 + 3 new rows).
- CodeScene: 10 on all three changed source files. The pre-commit safeguard passed.
