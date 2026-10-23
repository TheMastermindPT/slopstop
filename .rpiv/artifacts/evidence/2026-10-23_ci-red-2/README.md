# fix/ci-red-2: TDD evidence (2026-10-23, #142)

- Branch `fix/ci-red-2` from `c79f39f`, main checkout. Decisions: Pedro, decisions log at `c79f39f` (no brief, no review). Diagnosis: `../2026-10-23_ci-red-diagnosis-2.md`.
- No timeout was changed (C5 stays open, to be re-measured after this CI run).

## C1: the `opencode` temporary parent

- **Red** (`c1-red.txt`): `project-list-runtime` with `TEMP`/`TMP` set to a new empty folder fails with `ENOENT … mkdtemp '…\slopstop-c1-empty\opencode\pc-list-transport-XXXXXX'`, which is the CI error. Pedro's `%TEMP%\opencode` was not touched.
- **Change:**
  - `temporaryRoot(prefix)` in `apps/harness/tests/integration/temporary-root.ts` and `apps/desktop/tests/e2e/temporary-root.ts` creates `tmpdir()/opencode` recursively, then calls `mkdtemp`. There are two copies because apps never import one another.
  - It is used at all 22 former `mkdtemp(path.join(tmpdir(), "opencode/…"))` sites (16 in harness integration, 6 in desktop e2e) and in `project-registration`'s own `createRoot`.
  - The replacement was mechanical, done with a script (session scratchpad `c1-replace.mjs`) and then Biome.
- **Green**, each with a fresh empty `TEMP`:
  - `project-list-runtime` 1/1 (`c1-green-list.txt`);
  - `registration-list` 5/5 (`c1-green-reglist.txt`).
- The desktop e2e sites were not run (an e2e run is heavy). They are covered by typecheck and the next CI.

## C3: Git version not hard-coded

- **Red:** CI only. The runner has Git `2.56.0.windows.2`, and the test hard-coded `2.53.0.windows.1`, which is exactly this machine's Git (`git --version`: `2.53.0.windows.1`), so the red cannot be shown here.
- **Change:** the two real-Git rows of `project-registration.integration.test.ts` assert `version` against `/^\d+\.\d+\.\d+\.windows\.\d+$/`. The first row also decodes the result through `GitVersionInspectionResultSchema` (strict), as before.
- The fake-stdout rows keep `2.53.0.windows.1`: they feed that text themselves.
- **Green** (`c3-green.txt`): 2/2.

## C4: POSIX file semantics (issue #143)

- **Change:** `it.runIf(process.platform === "win32")` with a comment naming #143 on 5 rows:
  - `project-storage-upgrade-directories`: "adapter, retained or case-variant target" and "adapter, held handle";
  - `project-storage-upgrade-recovery`: "owner, held handle";
  - `project-storage-upgrade-failure`: "a busy staged copy is discarded at the next opening";
  - `project-upgrade-runtime`: "a busy discard".
- `git diff -w` shows only the wrapper, the comment and Biome's line wrapping.
- **Windows** (`c4-windows.txt`): the 5 rows still run, 5/5 pass.
- **Red/green:** CI only (Ubuntu).
- **Note:** the case-variant row also checks the "retained" target, which is portable. That part loses Linux coverage until #143 decides.

## C2: CI only

- `.github/workflows/ci.yml`, Windows job: a first step writes `TEMP` and `TMP` = `$env:RUNNER_TEMP` (a long path) to `GITHUB_ENV`. The `runner` context is not available in a job-level `env`.
- Proof: the next CI run. The local proof of the cause is in diagnosis 2 (8.3 alias versus long name).

## Gates

- Biome check on all changed files: clean.
- CodeScene: the pre-commit safeguard passed (25 files); `temporary-root.ts`, `project-registration` and `upgrade-directories` each score 10.
- `pnpm check`:
  - At 2026-10-23 ~15:00 it was held: the CPU rule failed (28, 33 and 15 %, with LeagueClient and TFTAcademy running).
  - The coordinator gave the GO with the machine free. My own readings: 5, 5 and 7 %, no game process.
  - First run (`pnpm-check.log`): exit 1, a typecheck error. `createRecordedNativeObserver` takes the branded `VersionObservationId`, and the C3 edit had passed a plain string.
  - Fix: keep the strict decode of the expected result (its version is a commented placeholder) and compare with `{ ...expected, version: expect.stringMatching(gitForWindowsVersion) }`. C3 rows rerun 2/2 (`c3-green-2.txt`).
  - Second run (`pnpm-check-2.log`): exit 0, 3338/3338, Effect gate verified, no dependency violations.
