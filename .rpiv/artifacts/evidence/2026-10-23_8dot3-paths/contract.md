# C2 product slice: accept and canonicalize 8.3 aliases (contract, 2026-10-23)

- Decision: Pedro, "Aceitar e converter" (decisions log §143). Branch `fix/ci-red-2`, separate commits after `b08bafd`. No designer brief; this contract replaces it. One candidate review round (slice-verifier).
- Diagnosis: `../2026-10-23_ci-red-diagnosis-2.md` C2.

## What the trace shows (before any code)

- Red reproduced today with `TEMP`/`TMP` = `C:\Users\pedro\AppData\Local\Temp\SLFA5E~1` (8.3 alias of `slopstopprobe8dot3`): `project-upgrade-runtime` "upgrades a migration-required Project through the harness" answers `broken`.
- Exact refusal (temporary log, removed, tree clean): `ProjectStorageBrokenError: Registered Project Storage authority is inconsistent.` at `requireActiveCreateAuthority` (`project-storage-create-inspection.ts:91`), the check `location.normalizedPath === input.expectedProjectRoot`.
- Mechanism: two openers of the same storage use two spellings of one folder.
  - `process-bootstrap.ts` `trustedRoot` canonicalizes (`realpathSync.native`, which expands 8.3 to the long name).
  - The storage composition (`createNodeProjectStorageDependencies`, `project-storage-node-adapters.ts:104`) and `createAuthorityParts` (`application-database-authority.ts:173`) only `path.resolve` their root. Whoever opens through them with an alias writes or expects the alias spelling.
  - The rows mix both: the fixtures seed through the composition with the raw `tmpdir()` root, then the runtime opens through the bootstrap (long), or the reverse (`canonical-writer-package-smoke` `replacement()` opens with the raw root what the child wrote long).
- Repository paths: `registration-identity-phase` fails the other way. The product (Git) already answers the long name; the test expects the alias. Product behaviour there is already "canonicalize".
- Production today: Electron passes `userData/storage` through the bootstrap, so the packaged app already canonicalizes its storage root. The gap is that canonicalization lives only in the bootstrap, not in the storage owner that persists `normalizedPath`.
- The product never uses `os.tmpdir()` (no product temp root).

## Behaviours

- **B1.** One owner, `physicalRoot(root)` (moved out of `process-bootstrap.ts` into a storage module, same semantics): a symbolic-link root is refused; the nearest existing ancestor is `realpathSync.native`-resolved and the missing segments are appended; a non-ENOENT failure propagates (never a silent fallback to the raw path).
- **B2.** The storage composition canonicalizes its roots at entry: `createNodeProjectStorageDependencies` (application storage root and migration resources root) and the application database authority. Every path it derives and persists (`normalizedPath`, project roots, generation directories, `application.db`) is under the long, canonical root. The bootstrap keeps calling `physicalRoot` (idempotent).
- **B3.** Same folder, any spelling: storage created through the long root opens `read-write` with the same identity through its 8.3 alias, and the reverse.
- **B4. Unchanged refusals.** `normalizedPath === expectedProjectRoot` stays a strict string check. A different folder (copied or moved storage, another root) still answers `broken`. Symbolic-link roots and witnesses are still refused. Only the 8.3 alias of the same folder is newly accepted, because it canonicalizes to the identical string.
- **B5. degrade-distinguishes-broken.** A root whose canonicalization fails for a reason other than "missing" is a distinct failure (the bootstrap: startup failure; the composition: thrown, mapped as today), never a clean or not-registered answer.
- **B6. Repository paths.** No product change: the registration identity already reports the long name. The test expectation is corrected to the canonical path (`realpath.native` of the fixture), which asserts the product canonicalizes.

## Roots in scope

| Root | Where canonicalized | Change |
|---|---|---|
| userData storage root (`applicationStorageRoot`) | bootstrap (today) + storage composition and application database authority (new) | product |
| Projects root `…/projects/<projectId>` | derived from the canonical root (B2) | none of its own |
| Migration resources root | bootstrap (today) + storage composition (new) | product |
| Repository paths | Git / registration identity (today, already long) | test expectation only |
| Temp | none in the product | test fixtures keep `temporaryRoot`; no change |

## Test rows (red first)

| Row | Seam | Today | After |
|---|---|---|---|
| T1 long then alias: create with the long root, `acquireActivation` with the 8.3 alias | storage composition, real disk (integration, win32) | red: `broken` "Registered Project Storage authority is inconsistent." | `ready`, `read-write`, same identity |
| T2 alias then long: the reverse | same | red | `ready`, same identity |
| T3 refusal kept: a storage whose rows name another folder | same | broken | broken (unchanged) |
| T4 symbolic-link (junction) root refused, missing root resolved through its ancestor | `physicalRoot` unit + composition | the bootstrap refusal has no test today | refused with the distinct message; missing root gives canonical ancestor + segments |
| T5 the CI rows under `TEMP` = alias: `project-upgrade-runtime` (2), `project-conversation-runtime` (6), `project-conversation-runtime-busy` (2), `registered-project-selection` (5), `canonical-writer-package-smoke` (one row, then the file) | existing integration rows | red (reproduced) | green, no test change |
| T6 `registration-identity-phase` 2 rows | test expectation | red under alias | green under alias and long name |

- T1/T2 need a real 8.3 alias. The row gets it from Windows (`cmd /c for %I in ("<dir>") do @echo %~sI`). If the volume has 8.3 names disabled (alias equals the long name), the row fails with "no 8.3 alias available", never passes silently.
- T5/T6 are run once with the alias and once with the normal `TEMP`.

## Out of scope / open

- **Q1 (CI workaround).** `ci.yml` sets `TEMP`/`TMP` = `RUNNER_TEMP` (long) since `b08bafd`. Recommendation: keep it in this slice and let the 8.3 coverage come from T1/T2 (they make their own alias). Removing it would also run every integration file on the alias on CI; that is a separate choice.
- **Q2 (package smoke).** `package-smoke-verifier.ts:253` and `package-smoke-runtime.ts:39` require `realpath(file) === file`, so a package proof under an 8.3 path is refused. That is a proof tool, not user storage; left unchanged unless Pedro wants it in scope.
- The long-path probe (`createCurrentProject` `unavailable` at ~150 characters) is not part of this slice.

## Gates

- Red-green per row with the smallest Vitest command; `pnpm check` under the CPU rule; CodeScene 10 on touched files; one slice-verifier candidate round. No timeout raised, no push, no merge.

## Note after review round 1 (2026-10-23, appended; earlier text kept)

- **B4 as built (V3, coordinator decision: reword).** The composition accepts every spelling the operating system resolves to the same folder: a Windows 8.3 alias, another letter case, or a path through a link above the nearest existing entry. A link at the nearest existing entry is refused. A different folder is still refused (T3; the registry's "belongs to another installation root" refusal is now pinned too). The packaged app's acceptance set is unchanged: the bootstrap already applied this function.
- **B5 as built (V4, coordinator decision: fix).** A canonicalization failure is the tagged `StorageRootCanonicalizationError` (`reason`: `symbolic-link`, `no-existing-ancestor`, `inspection-failed`, with the original `cause`). `acquireApplicationDatabaseAuthority` fails on its typed channel. The synchronous factories (the storage composition, `createApplicationDatabaseAuthority`, the registry join) and the bootstrap check throw that tagged error once, through `requirePhysicalRoot`. The bootstrap Layer turns the acquire's error into a defect (`Effect.orDie`), because the roots were already canonicalized and the startup failure reports it.
- **B2 extended (V1).** The registry join (`applicationDatabaseFor`) compares the injected authority with the physical spelling of its root. It reads the disk only when the raw spelling differs.
- **T1/T2/T2b (V2).** The alias rows use roots under `os.homedir()`, because the system volume keeps 8.3 names and a CI temp volume may not.
