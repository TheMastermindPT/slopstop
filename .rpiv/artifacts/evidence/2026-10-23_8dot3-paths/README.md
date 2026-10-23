# C2 product slice: 8.3 aliases canonicalized (TDD evidence, 2026-10-23)

- Contract: `contract.md` (coordinator GO as written; Q1 keep the `ci.yml` TEMP workaround, Q2 package-smoke verifier out of scope).
- Branch `fix/ci-red-2` after `b08bafd`. Alias used: `C:\Users\pedro\AppData\Local\Temp\SLFA5E~1` = `…\Temp\slopstopprobe8dot3`.

## Red

- `red.txt`: `storage-root-alias.integration.test.ts`, 5 of 6 fail for the contract reason:
  - T1 long→alias, T2 alias→long, T2b missing child of the alias: `broken` instead of `opened` (the CI error: "Registered Project Storage authority is inconsistent.").
  - T4a junction root: the composition accepted it (no throw).
  - T4b root with a NUL byte: the composition accepted it (no throw).
  - T3 (a copied root whose rows name another folder) passes already and stays as the guard: `broken`, `PROJECT_STORAGE_OWNER_FAILED`, "Registered Project Storage authority is inconsistent." (pinned exactly).

## Change

- `apps/harness/src/storage/physical-root.ts`: `physicalRoot`, moved out of `process-bootstrap.ts` with the same semantics (symbolic link refused, nearest existing ancestor `realpathSync.native`, missing segments appended, non-ENOENT errors thrown as is). It now also `path.resolve`s its input. Messages are now "Storage root must not be a symbolic link." / "Storage root has no existing ancestor." (were "Harness bootstrap root …"; no test or consumer matched the old text).
- Callers: the bootstrap (`trustedRoot`), the storage composition (`createNodeAdapters`: storage and migration roots) and the application database authority (`createAuthorityParts`). `path.resolve` replaced at those two entries only.
- The strict checks are unchanged: `normalizedPath === expectedProjectRoot` and "Application database authority belongs to another installation root".

## Test-side corrections (product already canonical, expectations assumed the raw spelling)

- `registration-identity-phase`: the expected Git paths are `realpathSync.native` of the fixture folders (`canonicalGitPaths`). Git already answered the long name.
- `storage-root-template.ts` `relocateStorageLocations`: relocates from/to the physical spellings (Storage now records the physical root).
- `canonical-writer-package-smoke` `seedOwner`: the "inside its root" guard compares with the physical root.
- `canonical-database-template` `rootFree`: strips the physical root.

## Green

- `green.txt`: new file 6/6.
- Under `TEMP`/`TMP` = alias (`t6-alias.txt`, `template-alias.txt`, `t5-package-smoke-row-alias-2.txt`, console for the rest):
  - `project-upgrade-runtime` 21/21, `project-conversation-runtime` 23/23, `project-conversation-runtime-busy` 5/5, `registered-project-selection` 9/9, `registration-identity-phase` 6/6, `canonical-database-template` 4/4;
  - `canonical-writer-package-smoke` "rejects a retained live Writer" 1/1. The whole file (149 rows) was not run under the alias: coordinator decision (proportional runs), the new rows plus this row are enough.
- Under the normal `TEMP` (`focused-long.txt`): 11 files, 160/160 (new file, process-bootstrap, project-storage-open, node-adapters, filesystem-authority, the 5 CI files, registration-bootstrap) in 142 s; `template-long.txt` 4/4; `t6-long.txt` 6/6.
  - Disclosure: that focused run took 142 s, over the 2-minute heavy-run line, without a prior GO; the coordinator noted it as fine.

## Out of scope (coordinator decisions)

- Q1: `ci.yml` keeps `TEMP`/`TMP` = `RUNNER_TEMP`; T1/T2/T2b make their own alias on every Windows run.
- Q2: `package-smoke-verifier.ts:253` and `package-smoke-runtime.ts:39` still refuse a proof file reached through an 8.3 path (`realpath(file) === file`); test tool, not product.
- T4b uses a NUL byte as the non-ENOENT inspection failure. A real permission failure (EPERM/EACCES) is not reproduced; it takes the same `throw error` branch.

## Gates

- Biome on all touched files: clean.
- CodeScene: first safeguard failed on `registration-identity-phase` (String Heavy Function Arguments, 41.2% vs 39%) from the first helper; replaced by `canonicalGitPaths(fixture, linked)`. Second safeguard: passed, 9 files. `physical-root.ts`, `storage-root-alias…`, `process-bootstrap.ts` score 10.
- `pnpm check`:
  - Held at first: the CPU rule failed twice (53/34/45 %, 52/59/40 %; LeagueClient, TFTAcademy, TFTClient running).
  - **Pedro (via the coordinator): "nao esta livre, mas continua"**, a CPU-rule override for this step.
  - First run (`pnpm-check.log`): exit 1, typecheck. `windowsVerbatimArguments` is not in `ExecFileSyncOptions`. The alias helper now uses `execSync` (runs through `cmd.exe` on Windows); new file rerun 6/6 (`green-2.txt`).
  - Second run (`pnpm-check-2.log`): exit 0, 96 files, 3338/3338, Effect gate run, no dependency violations. The "SlopStop failed to start." stderr line is also in the previous green log (expected test output).
- CodeScene safeguard after the fix: passed, 9 files.
