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

## Review round 1 and fix round 1

- slice-verifier on `1b4551e`: failed, V1 violation, V2-V5 warnings, polish. Coordinator triage: fix all in new commits, no round 2; focused tests and `pnpm check` are the proof. Contract note appended (`contract.md`, "Note after review round 1").
- **V1 (registry join):**
  - Red: `v1-registry-alias.txt` (`registration-registry.test.ts` 2/10 fail under the alias TEMP); `fix1-v1-red.txt` (new row "joins the registry to an authority of the same folder in either spelling" fails against the `HEAD` `registry-database.ts`: "belongs to another installation root").
  - Fix: `applicationDatabaseFor` compares through `sameInstallation` (raw spelling first, physical only when it differs).
  - Green: `fix1-green.txt`; `fix1-v1-registry-alias.txt` 10/10 under the alias.
- **V2:** T1/T2/T2b roots now live under `os.homedir()` (`slopstop-alias-root-*`, removed after each row; none left behind).
- **V3:** TSDoc of `physicalRootResult` and the contract note describe the real acceptance set.
- **V4:**
  - `StorageRootCanonicalizationError` (`Data.TaggedError`, `reason` + `cause`).
  - `physicalRoot` is now an Effect (`Effect.try`); `physicalRootResult` is a `Result`; `requirePhysicalRoot` throws the tagged error once for synchronous factories.
  - `acquireApplicationDatabaseAuthority` has `E = StorageRootCanonicalizationError`; the bootstrap Layer applies `Effect.orDie`, because its roots were already canonicalized.
  - New rows: the acquire fails on the typed channel for a link root; the composition throws the tagged error (`symbolic-link`, `inspection-failed` with the `ERR_INVALID_ARG_VALUE` cause); unit `physical-root.test.ts` (Result and Effect forms).
  - Effect v4 docs read through Context7 (`/websites/effect_website_v4`: `Data.TaggedError`, `Effect.try`).
- **V5:** `expectNoRootSpelling(text, root)` in `tests/integration/storage-root-privacy.ts` checks the raw and physical spellings, each raw and JSON-escaped. It replaces the 14 `not.toContain(root)` pins (project-storage-create ×11, node-adapters, registration-bootstrap, registration-list). The old pins compared `JSON.stringify` output (doubled backslashes) with a raw Windows path, so on Windows they could never match; the helper's escaped check closes that too. Every pin passes with both spellings.
- **Found while running under the alias (not in the review):**
  - `registry-witness-race` (3 rows): the test hooks matched the listed directory against the raw root, while the authority now lists the physical one. The gated fixture exposes `physicalRoot`, and the hooks compare against it.
  - `project-storage-create` "blocks an orphan location at the deterministic Project path": the fixture seeded the orphan row with the raw (alias) spelling, so the physical lookup no longer saw it, and the create went ahead (`created`). The fixture now seeds what Storage records (the physical spelling).
  - **Residual:** a location row persisted under a non-physical spelling is no longer recognized as a prior-state witness. The packaged app never wrote such rows, because the bootstrap always canonicalized. Only a direct composition caller with an alias root could have.
- **Polish:**
  - Messages are neutral ("Root must not be a symbolic link.", "Root has no existing ancestor.", "Root could not be inspected."), because they also serve the migration resources root.
  - The stale "uses no disk" comments are fixed; the orphaned TSDoc in `canonical-database-template` is merged.
  - Alias logs are saved: `fix1-alias-integration.txt` (first run, 4 reds), `fix1-alias-integration-2.txt`.
- **Runs:**
  - Under the alias: `fix1-alias-integration.txt` (6 files, 4 fails, the reds above), then `fix1-alias-integration-2.txt` (witness-race + create: 2 files, 74/74).
  - Under the normal TEMP: `fix1-long-integration.txt`, 9 files, 138/138 (alias file, authority, witness-race, node-adapters, registration-bootstrap, registration-list, create, process-bootstrap, canonical-database-template). Unit: `fix1-unit.txt` 23/23.
- **Not run:** Ubuntu (T3/T4a/T4b have no POSIX evidence yet; the next CI shows it) and the whole package-smoke file (coordinator decision).
- **`pnpm check` (fix round):** **Pedro (via the coordinator): "continua"**, a CPU-rule override for this run (CPU 48/67/57 %, game running). `pnpm-check-3.log`: exit 0, 97 files, 3340/3340, Effect gate run, no dependency violations. CodeScene safeguard passed, 17 files.
