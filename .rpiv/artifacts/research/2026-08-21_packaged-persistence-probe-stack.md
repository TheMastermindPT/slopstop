---
date: 2026-08-21
author: Pedro Mesquita
commit: acf9c8b
branch: main
repository: slopstop
topic: "Exact packaged Windows persistence probe stack"
tags: [research, wayfinder, persistence, electron, libsql, drizzle, windows, packaging]
status: complete
---

# Research: Exact Packaged Windows Persistence Probe Stack

## Research Question

[Issue #35](https://github.com/TheMastermindPT/slopstop/issues/35) asks which exact mutually compatible versions of local libSQL, Drizzle ORM/Kit, Electron 43, Node 24, TypeScript 6, and the current packager should enter a disposable Windows probe, and which packaged-loading, locking, migration, backup, and competing-access claims must remain empirical. The parent map makes the probe disposable decision evidence: it must not create the product schema or leave unused dependencies behind ([issue #28](https://github.com/TheMastermindPT/slopstop/issues/28)).

## Evidence Labels

| Label | Meaning in this document |
| --- | --- |
| `verified` | Directly observed in the checked-out repository, an exact package manifest, or exact-version source. This does not imply that the packaged executable was run during this research. |
| `supported/documented` | An upstream primary source explicitly states the support or behavior. |
| `inferred` | Multiple facts point to the conclusion, but no upstream compatibility contract states it. |
| `probe-required` | The disposable packaged Windows prototype must produce pass/fail evidence before the claim can be used in design. |

Context7 was not exposed as a tool in this session, and installing its CLI would have violated the no-package-install constraint. Library facts were therefore retrieved directly from official registries, official documentation, and exact-tag upstream source.

## Decision Summary

Use the repository's existing toolchain unchanged and probe the stable package line below on **Windows x64 only**:

`Node 24.19.0 (build) / Electron 43.4.0 (packaged Node patch observed at runtime) / pnpm 11.5.1 / TypeScript 6.0.2 / Forge 7.11.2 / Vite 8.2.1 / drizzle-orm 0.45.2 / drizzle-kit 0.31.10 / @libsql/client 0.17.4 / libsql 0.5.29 / @libsql/win32-x64-msvc 0.5.29 / @neon-rs/load 0.0.4`.

This is an **exact probe tuple, not an adoption decision**. Manifest ranges establish only package-manager-level compatibility. They do not establish Electron packaging, TypeScript 6, Windows file behavior, backup, or crash recovery.

## Local Baseline And Boundaries

| Area | Current fact | Classification |
| --- | --- | --- |
| Repository runtime | The root pins pnpm 11.5.1, accepts Node `>=24 <27`, and installs repository-local Node 24.19.0 (`package.json:7-10,55-60`; `.node-version:1`). | `verified` |
| Existing build stack | The catalog pins Electron 43.4.0, all four used Forge packages at 7.11.2, `@electron/fuses` 1.8.0, TypeScript 6.0.2, Vite 8.2.1, and `@types/node` 24.13.3 (`pnpm-workspace.yaml:21-25,31,34,37,48-49`). The lockfile records Electron 43.4.0, Forge 7.11.2, and TypeScript 6.0.2 (`pnpm-lock.yaml:18-29,67-68,100-101,186-197,220-221`). | `verified` |
| Dependency policy | Direct versions are exact through the pnpm catalog, peers and build scripts are strict, and only Electron and esbuild builds are currently allowed (`pnpm-workspace.yaml:5-11,17-55`; `docs/adr/0001-repository-foundation.md:17-21`). | `verified` |
| Persistence ownership | Only the harness may own Drizzle and libSQL; desktop may own Electron but must not import harness source (`docs/adr/0001-repository-foundation.md:26-31`). | `verified` |
| Current persistence dependencies | `apps/harness` currently declares only protocol and Pino, and its lockfile importer has the same two dependencies (`apps/harness/package.json:13-16`; `pnpm-lock.yaml:229-236`). No `libsql` or `drizzle` entry exists in the current lockfile (`.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md:41`). | `verified` |
| Persistence decision | The accepted foundation chooses `@libsql/client` with Drizzle, separate `slopstop.db` and `mastra.db`, WAL, foreign keys, a busy timeout, short transactions, serialized canonical writes, committed SQL migrations, a verified database-native backup, and newer-schema refusal (`docs/adr/0001-repository-foundation.md:52-59`). | `verified` |
| Canonical-state decision | One transaction updates current state, revisions, events, sequence, and idempotent outcomes. Each Project has one OS-lock-protected writer. Backup is quiescent; migration and restore use staged verified copies; newer schemas and broken/missing state are rejected (`docs/adr/0002-project-canonical-state.md:13-20`). | `verified` |
| Build topology | Forge packages with ASAR enabled and builds main, preload, and the harness process entry through the Vite plugin (`apps/desktop/forge.config.ts:6-40`). The packaged harness output is CommonJS `harness.cjs`, and its Vite config currently externalizes only Node built-ins (`apps/desktop/vite.harness.config.ts:6-16`). | `verified` |
| Runtime topology | Main resolves `harness.cjs` beside its own built file and starts it with `utilityProcess.fork()` (`apps/desktop/src/main/main.ts:72-76`; `apps/desktop/src/main/harness-supervisor.ts:207,271-272`). | `verified` |
| Existing package proof | The smoke script only proves that the packaged app reaches harness-ready and exits cleanly (`apps/desktop/tests/e2e/package-smoke.mjs:21-51`). Windows CI runs checks, integration, packaged E2E, launch smoke, and uploads `apps/desktop/out/**` (`.github/workflows/ci.yml:52-90`). It does not exercise persistence. | `verified` |
| Prior research boundary | Existing research already requires exact-version packaged Windows proof and leaves native targets, Electron compatibility, locking, and cross-process behavior unverified (`.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md:74-81,121-127,144-150`). | `verified` |

## Exact Candidate Tuple

### Direct And Existing Versions

| Role | Exact version | Why this candidate |
| --- | --- | --- |
| Probe OS/architecture | `win32-x64-msvc` | The selected native package declares only Windows x64, not Windows arm64 or ia32 ([registry metadata](https://registry.npmjs.org/%40libsql%2Fwin32-x64-msvc/0.5.29)). Broad Windows support is outside the [parent map](https://github.com/TheMastermindPT/slopstop/issues/28). |
| Build Node | `24.19.0` | Keep the repository-local runtime fixed (`package.json:55-60`; `.node-version:1`) so the probe changes persistence variables only. |
| Packaged Node | Node 24, exact patch recorded by the probe | Electron 43.0.0 shipped Node 24.17.0 ([Electron 43 stack changes](https://electronjs.org/blog/electron-43-0)), but the Electron 43.4.0 release page does not publish an exact Node patch ([release page](https://releases.electronjs.org/release/v43.4.0)). The packaged utility process must report its actual `process.versions.node`; host Node 24.19.0 is not evidence for it. |
| Package manager | `pnpm 11.5.1` | Existing exact repository and CI version (`package.json:7-10`; `.github/workflows/ci.yml:24-36,60-72`). |
| TypeScript | `6.0.2` | Existing exact catalog and lock (`pnpm-workspace.yaml:48`; `pnpm-lock.yaml:100-101,162-163`). Compatibility with the new packages remains a probe claim. |
| Node types | `@types/node 24.13.3` | Existing exact catalog (`pnpm-workspace.yaml:31`). Do not change the type baseline during the probe. |
| Electron | `43.4.0` | Existing exact catalog/lock (`pnpm-workspace.yaml:37`; `pnpm-lock.yaml:67-68,220-221`) and an official stable release ([release page](https://releases.electronjs.org/release/v43.4.0)). |
| Forge | `@electron-forge/cli`, `plugin-fuses`, `plugin-vite`, `shared-types` all `7.11.2` | Existing exact stack (`pnpm-workspace.yaml:21-24`). The Vite plugin is explicitly experimental even in Forge 7, so changing it would add an unrelated variable ([Forge Vite documentation](https://www.electronforge.io/config/plugins/vite)). |
| Forge fuses | `@electron/fuses 1.8.0` | Existing exact catalog and current integrity/ASAR fuse configuration (`pnpm-workspace.yaml:25`; `apps/desktop/forge.config.ts:41-48`). |
| Vite | `8.2.1` | Existing exact catalog/lock (`pnpm-workspace.yaml:49`; `pnpm-lock.yaml:103-104`). Its package metadata supports Node `^20.19.0 || >=22.12.0`, which includes build Node 24.19.0 ([registry metadata](https://registry.npmjs.org/vite/8.2.1)). |
| ORM runtime | `drizzle-orm 0.45.2` | This is the current stable registry line and explicitly peers with `@libsql/client >=0.10.0` ([registry metadata](https://registry.npmjs.org/drizzle-orm/0.45.2)). It also contains the stable-line fix for identifier escaping/CWE-89 ([release notes](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.2)). |
| Migration generator | `drizzle-kit 0.31.10` | Current stable CLI metadata has no runtime peer constraint and bundles its CLI dependencies ([registry metadata](https://registry.npmjs.org/drizzle-kit/0.31.10)). Its release replaced `esbuild-register` with `tsx` loading for ESM and CJS configs ([release notes](https://github.com/drizzle-team/drizzle-orm/releases/tag/drizzle-kit%400.31.10)), matching the repository's ESM shape without proving TypeScript 6. |
| libSQL client | `@libsql/client 0.17.4` | Current stable registry metadata depends on `libsql ^0.5.28`, exports a Node entry, and has no declared Node engine ceiling ([registry metadata](https://registry.npmjs.org/%40libsql%2Fclient/0.17.4)). Drizzle's exact peer range admits it, but the packaged combination is still untested. |

### ABI-Critical Locked Closure

The disposable probe must freeze the entire pnpm lockfile. At minimum, its report must assert this exact ABI-critical closure rather than accepting whatever the caret ranges resolve on a later date:

| Package | Exact lock result | Evidence |
| --- | --- | --- |
| `libsql` | `0.5.29` | `@libsql/client@0.17.4` permits `^0.5.28`; `libsql@0.5.29` declares the platform packages as exact optional dependencies ([client metadata](https://registry.npmjs.org/%40libsql%2Fclient/0.17.4), [libsql metadata](https://registry.npmjs.org/libsql/0.5.29)). |
| `@libsql/win32-x64-msvc` | `0.5.29` | Exact Windows x64 optional binary, with `index.node` as its main file ([registry metadata](https://registry.npmjs.org/%40libsql%2Fwin32-x64-msvc/0.5.29)). |
| `@neon-rs/load` | `0.0.4` | `libsql@0.5.29` declares `^0.0.4`; the candidate lock must record 0.0.4 explicitly ([libsql metadata](https://registry.npmjs.org/libsql/0.5.29), [loader metadata](https://registry.npmjs.org/%40neon-rs%2Fload/0.0.4)). |

The expected closure is `inferred` until pnpm writes it to the disposable probe lockfile and a frozen install reproduces it. The current SlopStop lockfile cannot prove it because persistence packages are absent (`pnpm-lock.yaml:229-236`).

## Compatibility: What Is Known And What Is Assumed

| Claim | Classification | Evidence and limit |
| --- | --- | --- |
| Drizzle ORM 0.45.2 accepts `@libsql/client` 0.17.4 at package resolution. | `supported/documented` | The exact ORM manifest declares optional peer `@libsql/client >=0.10.0` ([exact source](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/package.json)). This proves the declared range, not successful execution. |
| Drizzle supports a supplied libSQL client and file URLs. | `supported/documented` | Official setup shows `drizzle-orm/libsql`, `createClient`, and `file:local.db` ([Drizzle SQLite setup](https://orm.drizzle.team/docs/get-started/sqlite-new)). Turso documents `file:path/to/db-file.db` for local `@libsql/client` use ([Turso TypeScript reference](https://docs.turso.tech/sdk/ts/reference)). |
| Node 24 is above the documented client runtime floor. | `supported/documented` | Turso lists Node 12+ among known compatible TypeScript SDK runtimes ([Turso TypeScript reference](https://docs.turso.tech/sdk/ts/reference)). Electron 43.0.0 embeds Node 24.17.0 ([Electron 43 stack changes](https://electronjs.org/blog/electron-43-0)); the exact patch in 43.4.0 remains a runtime observation. Neither statement is an Electron package-layout guarantee. |
| The selected native binary targets Node-API rather than a per-Node V8 ABI. | `verified` | Exact `libsql@0.5.29` source builds Neon with `napi-6` ([Cargo manifest](https://raw.githubusercontent.com/tursodatabase/libsql-js/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/Cargo.toml)); Node documents Node-API's ABI stability and Node-API 6 support in Node 14+ ([Node-API documentation](https://nodejs.org/api/n-api.html#node-api-version-matrix)). |
| The Node-API 6 binary should be ABI-loadable in Electron 43's Node 24.17.0. | `inferred`, `probe-required` | Node-API stability supports the inference, but Electron warns that native modules can differ from normal Node ABI and require Electron-aware rebuild/loading ([Electron native module guide](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)). Neither libSQL source nor its manifest claims Electron 43 support. |
| Drizzle Kit 0.31.10 and Drizzle ORM 0.45.2 are an exact tested pair. | `inferred`, `probe-required` | They are stable releases from one repository, but Kit declares no ORM peer range. Kit's exact source tests libSQL migration using `@libsql/client`, while its dev dependency is only `^0.10.0` ([Kit manifest](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/4aa6ecfee4b4728dadf6f77f071a149878a3c6c0/drizzle-kit/package.json), [migration test](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/4aa6ecfee4b4728dadf6f77f071a149878a3c6c0/drizzle-kit/tests/migrate/libsql-migrate.test.ts)). That is not an exact 0.17.4 test. |
| The stack supports TypeScript 6.0.2. | `probe-required` | The published packages expose types, but their exact source uses older compiler baselines: Kit uses TypeScript `^5.6.3`, libSQL JS uses `^5.4.5`, and the client uses `^4.9.4` ([Kit manifest](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/4aa6ecfee4b4728dadf6f77f071a149878a3c6c0/drizzle-kit/package.json), [libSQL manifest](https://raw.githubusercontent.com/tursodatabase/libsql-js/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/package.json), [client metadata](https://registry.npmjs.org/%40libsql%2Fclient/0.17.4)). Absence of an upper peer bound is not a TypeScript 6 compatibility statement. |
| Current upstream preference for a new local Electron database differs from the accepted ADR. | `supported/documented` | Current Turso guidance recommends `@tursodatabase/database` for new local/embedded Node and Electron use, while retaining `@libsql/client` for ORM integration and existing libSQL integrations ([quickstart](https://docs.turso.tech/sdk/ts/quickstart), [reference](https://docs.turso.tech/sdk/ts/reference)). The candidate keeps `@libsql/client` only because ADR 0001 is binding and Drizzle's stable integration names it (`docs/adr/0001-repository-foundation.md:52-59`). |

## Native Loading And Packaging Constraints

1. `verified`: The Node entry for `@libsql/client@0.17.4` routes file URLs to its sqlite3 client, which imports `libsql` ([Node entry](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/889a2ec3130b9fb3b32fda9e19ebd33864efc509/packages/libsql-client/src/node.ts), [sqlite3 client](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/889a2ec3130b9fb3b32fda9e19ebd33864efc509/packages/libsql-client/src/sqlite3.ts)).
2. `verified`: `libsql@0.5.29` computes a runtime target and dynamically requires `@libsql/${target}`; on Windows x64 that resolves to `@libsql/win32-x64-msvc`, whose entry is `index.node` ([loader source](https://raw.githubusercontent.com/tursodatabase/libsql-js/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/index.js), [platform metadata](https://registry.npmjs.org/%40libsql%2Fwin32-x64-msvc/0.5.29)). This dynamic optional dependency must survive Vite, pnpm pruning, Forge packaging, and ASAR layout.
3. `supported/documented`: Forge's Vite guide recommends treating native modules as externals ([Forge Vite documentation](https://www.electronforge.io/config/plugins/vite)). The current harness build externalizes only Node built-ins (`apps/desktop/vite.harness.config.ts:13-15`), so unchanged bundling is not evidence that `libsql` will be retained.
4. `supported/documented`: Electron can read JavaScript and ordinary resources in ASAR, but archives are read-only, cannot be a working directory, and `process.dlopen` for native modules needs a real file path/extra extraction. Electron documents explicit unpacking for `.node` files ([ASAR limitations](https://www.electronjs.org/docs/latest/tutorial/asar-archives)). Forge provides an auto-unpack native modules plugin, but the existing project does not use it ([Forge auto-unpack documentation](https://www.electronforge.io/config/plugins/auto-unpack-natives); `apps/desktop/forge.config.ts:14-50`).
5. `probe-required`: The smallest initial packaging hypothesis is to keep Kit out of the package, bundle ordinary Drizzle/client JavaScript where Vite can do so, externalize the `libsql` native package boundary, retain its optional Windows package, and explicitly unpack `**/*.node`. This is not a selected production recipe until the artifact inventory and packaged executable prove module resolution.
6. `probe-required`: The probe database must be under a disposable writable directory derived from Electron application data, never under `process.resourcesPath`, `app.asar`, the process CWD, or the migration directory. Electron defines `process.resourcesPath` as the packaged resources directory ([Electron process API](https://www.electronjs.org/docs/latest/api/process#processresourcespath-readonly)); SlopStop's accepted target is `userData/projects/<project-id>/` (`docs/adr/0001-repository-foundation.md:54-59,63-65`).

## Migration And Resource Constraints

| Fact or claim | Classification | Consequence for the probe |
| --- | --- | --- |
| Kit can generate version-controlled SQL; Drizzle also supports applying generated migrations at application runtime. | `supported/documented` | Use `drizzle-kit generate` before packaging and the ORM's runtime libSQL migrator in the packaged harness. Do not package or execute Kit in the application ([migration fundamentals](https://orm.drizzle.team/docs/migrations)). |
| The exact runtime migrator reads `meta/_journal.json` and SQL files synchronously from a caller-supplied `migrationsFolder`. | `verified` | Package both SQL and metadata as immutable resources, resolve an absolute packaged path, and fail distinctly if either is absent or malformed ([exact migrator source](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/src/migrator.ts)). ASAR reads are documented, but the utility-process path is still probe-required ([ASAR documentation](https://www.electronjs.org/docs/latest/tutorial/asar-archives)). |
| The exact Drizzle libSQL migrator creates `__drizzle_migrations`, considers only the latest `created_at`, collects every newer SQL statement plus history inserts, and sends the collection to `client.migrate()`. | `verified` | Assert migration count, history rows, and restart idempotence. Do not assume hashes of already-applied migrations are revalidated ([exact Drizzle libSQL migrator](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/src/libsql/migrator.ts)). |
| The exact local client implementation disables foreign keys, starts one deferred transaction, executes the migration batch, commits, rolls back an active transaction in `finally`, and re-enables foreign keys. | `verified` | A normal statement failure should roll back the whole pending batch. This source does not prove abrupt process-termination behavior ([exact client source](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/889a2ec3130b9fb3b32fda9e19ebd33864efc509/packages/libsql-client/src/sqlite3.ts)). |
| Drizzle's exact migrator does not reject a database whose latest migration timestamp is newer than every packaged migration. | `verified` | A newer database can produce a successful no-op. SlopStop needs a separate application schema/version guard before Drizzle migration, and the probe must prove refusal ([exact Drizzle libSQL migrator](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/src/libsql/migrator.ts); `docs/adr/0002-project-canonical-state.md:20`). |
| `drizzle-kit push` directly diffs and changes a database. | `supported/documented` | It is useful for rapid schema experiments but is not the accepted shipped upgrade protocol. The probe uses generated, committed SQL ([Drizzle SQLite setup](https://orm.drizzle.team/docs/get-started/sqlite-new); `docs/adr/0001-repository-foundation.md:57`). |

## What Documentation Does Not Prove

### Locking And Competing Access

- `supported/documented`: Current Turso reference says concurrent writes are not supported by `@libsql/client` ([Turso TypeScript reference](https://docs.turso.tech/sdk/ts/reference)). This rules out a multi-writer design; it does not state what two Windows processes opening the same local file will observe.
- `supported/documented, not package proof`: SQLite WAL documentation says readers and a writer may overlap, all processes must be on one host, and only one WAL writer exists at a time ([SQLite WAL documentation](https://www.sqlite.org/wal.html)). libSQL is a fork and the selected JS/native package has its own wrapper and build. The SQLite statement alone does not prove exact libSQL 0.5.29 behavior in Electron 43 on Windows.
- `probe-required`: Opening from two utility processes, read-only observer behavior, the configured timeout unit and bound, `SQLITE_BUSY` versus `SQLITE_LOCKED`, release after crash, WAL/SHM cleanup, and behavior across app restart are not specified by the selected package metadata or current Turso client docs.
- `verified`: ADR 0002 requires a separate operating-system lock and writer-generation fence (`docs/adr/0002-project-canonical-state.md:16`). Database locking observed by the probe cannot be promoted into the Project writer lock contract.

### Backup And Restore

- `verified`: The exact `libsql@0.5.29` compatibility API implements `backup()` as `throw new Error("not implemented")` ([exact source](https://raw.githubusercontent.com/tursodatabase/libsql-js/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/index.js)). Drizzle provides no backup abstraction.
- `supported/documented, not package proof`: Upstream SQLite documents `VACUUM INTO` as a transactional, consistent-snapshot alternative to the backup API, but warns that interruption can leave the output incomplete and corrupt ([SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html#vacuuminto)). The selected libSQL binding does not document that statement as its supported backup contract.
- `probe-required`: Whether exact libSQL accepts `VACUUM INTO` for this database, how it interacts with WAL/checkpoints, what happens when the output already exists, whether a killed backup leaves a detectable partial file, and whether a staged restore reopens with identical schema/data all remain empirical.
- `verified`: Copying an open database is not an acceptable sole mechanism, and activation requires quiescence, staged copies, verification, and preservation of the prior copy (`docs/adr/0001-repository-foundation.md:57-59`; `docs/adr/0002-project-canonical-state.md:20`).

### Interrupted And Newer Migrations

- `verified`: Ordinary JavaScript/SQL failure has an explicit rollback path in `@libsql/client@0.17.4` local migration source ([exact source](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/889a2ec3130b9fb3b32fda9e19ebd33864efc509/packages/libsql-client/src/sqlite3.ts)).
- `probe-required`: Hard utility-process termination, Windows logoff/shutdown, or power-loss simulation during a real native transaction is not covered by that `finally` block and has no exact Electron/libSQL guarantee in the reviewed sources.
- `verified`: The exact Drizzle migrator compares only migration time for unapplied work and does not enforce an application maximum schema version ([exact source](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/src/libsql/migrator.ts)).
- `probe-required`: SlopStop's separate newer-schema guard, failed/interrupted migration diagnostic, preservation of the old staged copy, and refusal to reinterpret broken state as fresh must be exercised. These are product requirements (`docs/adr/0002-project-canonical-state.md:20,26`), not library guarantees.

## Bounded Prototype Claim Matrix

The prototype should emit one machine-readable report containing the exact tuple, lockfile hash, package artifact hash, resolved paths, timings, error codes, and each claim result. A crash, timeout, missing candidate, or dropped optional package is a failed claim, never a clean result.

| ID | Claim before probe | Pass evidence | Fail evidence |
| --- | --- | --- | --- |
| C1 | Exact dependency closure is reproducible. `probe-required` | A fresh Windows x64 `pnpm install --frozen-lockfile` succeeds; the report and lock show every direct version above plus `libsql@0.5.29`, `@libsql/win32-x64-msvc@0.5.29`, and `@neon-rs/load@0.0.4`; a second frozen install has the same lock hash. | Any drift, peer warning/error, blocked build, missing optional binary, or non-x64 target. |
| C2 | Kit and ORM work under the repository's Node/TypeScript/ESM policy. `probe-required` | Node 24.19.0 and TypeScript 6.0.2 typecheck probe-owned source under the root strict/Bundler policy, including its explicit `skipLibCheck: true`; Kit 0.31.10 generates SQL/meta; a second generate reports no schema changes; a separate declaration audit records upstream defects without changing this gate. | Probe-source loader/config/TypeScript error, source-level suppression added only to hide incompatibility, a second spurious migration, or missing declaration-audit output. |
| C3 | Forge/Vite preserves the native closure and migrations. `probe-required` | Artifact inventory shows immutable migration SQL/meta at the reported packaged path and the exact `index.node` under an unpacked real path; Kit is absent; `require.resolve()` paths and SHA-256 hashes are recorded. | Native binary omitted, left only inside ASAR, migration resource missing, development path/CWD required, Kit packaged, or unexpected duplicate native versions. |
| C4 | The packaged utility process loads the exact native module. `probe-required` | The packaged Windows executable reports Electron 43.4.0, its actual Node 24 patch, `process.arch === "x64"`, Node-API version, package versions, and resolved `.node` path, then opens and closes a local client without warning. | `MODULE_NOT_FOUND`, `ERR_DLOPEN_FAILED`, `NODE_MODULE_VERSION`, delay-load/procedure error, temp-extraction-only success when explicit unpack was required, a non-Node-24 runtime, or another version mismatch. |
| C5 | Basic durable local behavior works outside resources. `probe-required` | The probe creates the DB only in its disposable application-data directory; enables and reads back WAL, foreign keys, and timeout settings; migrates, inserts, commits, closes, restarts the packaged app, and reads identical rows. | DB/WAL/SHM appears under resources/CWD, pragma does not stick as required, close/reopen fails, data changes, or errors degrade to an empty/fresh DB. |
| C6 | Generated migrations are packaged, atomic on ordinary failure, and idempotent. `probe-required` | Packaged runtime applies the Kit-generated migration, records expected history/hash evidence, and does not reapply on restart. An intentionally failing later migration leaves neither partial schema nor its history row and returns a distinct migration failure. | Partial DDL/data/history, silent no-op, repeated migration, missing resource reported as clean, or foreign keys remain disabled. |
| C7 | Abrupt migration interruption has a safe, classifiable result. `probe-required` | A parent kills the utility process during a deliberately long native migration; reopen yields either the verified pre-migration state or complete post-migration state, never a history/schema split; recovery reports interruption distinctly. Repeat enough times to hit the in-transaction window and record whether the injection did. | Corruption, partial schema/history, fresh-DB fallback, indefinite recovery, or a test that never proves it interrupted an active transaction. |
| C8 | Raw competing access is bounded and observable, not treated as the writer lock. `probe-required` | Process A holds a write transaction while process B performs a read and timed write; the report records whether read succeeds, the exact write delay/result/error code, and post-release recovery. Final integrity/data checks pass. The report states that ADR 0002 still requires a separate OS lock. | Hang beyond the bound, simultaneous conflicting commit, corruption, ambiguous error, stale lock after crash, or promotion of DB contention into the product writer-lock contract. |
| C9 | A quiescent database-native backup and staged restore are viable. `probe-required` | With writes stopped, competing clients closed, and WAL checkpointed, one controlled backup connection creates a new file through the selected SQL path; integrity check, schema version, migration history, and row hashes match; a staged restore is verified before activation; the prior DB remains preserved. Interrupted backup output is rejected and cleaned deliberately. | Use of unimplemented `backup()`, sole raw copy of an open DB, overwrite-in-place, corrupt/partial output accepted, mismatch, or activation before verification. |
| C10 | A newer schema is refused before Drizzle can no-op. `probe-required` | A fixture with application schema version above the packaged maximum is rejected before migration/query, remains byte/hash unchanged, and produces a distinct `newer-schema` diagnostic. Missing/corrupt version metadata has separate failures. | App opens or mutates the newer DB, Drizzle's no-op is treated as success, or missing/broken metadata creates a fresh DB. |

## Rejected Alternatives

| Alternative | Reason for rejection in this probe |
| --- | --- |
| `@tursodatabase/database` | Upstream now recommends it for new local/embedded Electron work and documents concurrent writes, but Drizzle support is beta ([Turso quickstart](https://docs.turso.tech/sdk/ts/quickstart), [Turso reference](https://docs.turso.tech/sdk/ts/reference)). Selecting it would reopen ADR 0001 rather than answer issue #35 against the accepted `@libsql/client` choice (`docs/adr/0001-repository-foundation.md:52-59`). Keep it as the fallback if the probe disproves the accepted stack. |
| `@tursodatabase/serverless`, `@libsql/client/web`, or WASM | Serverless is remote/fetch-only, and the web client does not support local file URLs ([Turso reference](https://docs.turso.tech/sdk/ts/reference)). They do not test the required local Windows persistence or native package boundary. |
| Drizzle 1.0 beta/RC tags | The registry still marks 0.45.2 and 0.31.10 as the stable `latest` lines ([ORM registry](https://registry.npmjs.org/drizzle-orm), [Kit registry](https://registry.npmjs.org/drizzle-kit)). A prerelease would add migration/API churn without providing an Electron compatibility contract. |
| Older `@libsql/client` or Drizzle stable versions | Older age does not remove ASAR, optional-binary, Windows locking, or crash-recovery uncertainty. ORM 0.45.2 also contains a security fix absent from older stable ORM releases ([0.45.2 release](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.2)). |
| `better-sqlite3`, `sqlite3`, or `node:sqlite` | They replace the accepted libSQL driver rather than test it. They may be considered only if issue #35's candidate fails and the persistence ADR is explicitly reopened (`docs/adr/0001-repository-foundation.md:52-59`). |
| Unchanged Vite/ASAR packaging | Current harness Vite externalizes only Node built-ins and Forge has no native-unpack rule (`apps/desktop/vite.harness.config.ts:13-15`; `apps/desktop/forge.config.ts:7-12,14-50`). Official Forge/Electron guidance says native modules should be externalized and `.node` files may need unpacking ([Forge Vite documentation](https://www.electronforge.io/config/plugins/vite), [Electron ASAR documentation](https://www.electronjs.org/docs/latest/tutorial/asar-archives)). |
| `drizzle-kit push` as shipped migration protocol | It bypasses the accepted committed-SQL, staged-backup, and recovery design (`docs/adr/0001-repository-foundation.md:57-59`; `docs/adr/0002-project-canonical-state.md:20`). Drizzle documents generated SQL plus runtime migration as a separate supported flow ([migration fundamentals](https://orm.drizzle.team/docs/migrations)). |

## Source Register

### Local Sources

- `package.json:7-10,18-28,55-60` - package manager, Node range/runtime, deep checks, and package smoke commands.
- `.node-version:1` - repository Node 24.19.0.
- `pnpm-workspace.yaml:5-11,17-55` - strict pnpm policy and exact catalog.
- `pnpm-lock.yaml:18-29,67-68,100-101,186-236` - exact current build stack and persistence-free harness importer.
- `apps/harness/package.json:13-16` - current harness dependencies.
- `apps/desktop/forge.config.ts:6-50` - ASAR, Vite entries, and fuses.
- `apps/desktop/vite.harness.config.ts:6-16` - CommonJS harness output and current external boundary.
- `apps/desktop/src/main/main.ts:72-84` - packaged harness path and smoke shutdown.
- `apps/desktop/src/main/harness-supervisor.ts:207,271-272` - utility-process fork and built entry path.
- `apps/desktop/tests/e2e/package-smoke.mjs:21-51` - current packaged smoke evidence.
- `.github/workflows/ci.yml:52-90` - Windows build/package job.
- `docs/adr/0001-repository-foundation.md:15-21,26-31,35-42,52-59,78-83` - runtime, ownership, packaging, persistence, and testing decisions.
- `docs/adr/0002-project-canonical-state.md:13-28` - canonical transaction, writer, backup, migration, restore, and refusal decisions.
- `.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md:74-81,121-127,144-150` - prior package and runtime unknowns.

### External Primary Sources

- [Issue #35](https://github.com/TheMastermindPT/slopstop/issues/35) and [parent map #28](https://github.com/TheMastermindPT/slopstop/issues/28).
- Official npm metadata: [@libsql/client 0.17.4](https://registry.npmjs.org/%40libsql%2Fclient/0.17.4), [libsql 0.5.29](https://registry.npmjs.org/libsql/0.5.29), [Windows x64 binary 0.5.29](https://registry.npmjs.org/%40libsql%2Fwin32-x64-msvc/0.5.29), [@neon-rs/load 0.0.4](https://registry.npmjs.org/%40neon-rs%2Fload/0.0.4), [drizzle-orm 0.45.2](https://registry.npmjs.org/drizzle-orm/0.45.2), [drizzle-kit 0.31.10](https://registry.npmjs.org/drizzle-kit/0.31.10), [Electron 43.4.0](https://registry.npmjs.org/electron/43.4.0), [Forge Vite plugin 7.11.2](https://registry.npmjs.org/%40electron-forge%2Fplugin-vite/7.11.2), [Vite 8.2.1](https://registry.npmjs.org/vite/8.2.1), and [TypeScript 6.0.2](https://registry.npmjs.org/typescript/6.0.2).
- Exact upstream source: [Drizzle ORM manifest](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/package.json), [Drizzle migration reader](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/src/migrator.ts), [Drizzle libSQL migrator](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/273c78071d4841b497f5144734b38294df7ec64b/drizzle-orm/src/libsql/migrator.ts), [Kit manifest](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/4aa6ecfee4b4728dadf6f77f071a149878a3c6c0/drizzle-kit/package.json), [client Node entry](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/889a2ec3130b9fb3b32fda9e19ebd33864efc509/packages/libsql-client/src/node.ts), [client local implementation](https://raw.githubusercontent.com/tursodatabase/libsql-client-ts/889a2ec3130b9fb3b32fda9e19ebd33864efc509/packages/libsql-client/src/sqlite3.ts), [libSQL native loader](https://raw.githubusercontent.com/tursodatabase/libsql-js/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/index.js), and [libSQL Cargo manifest](https://raw.githubusercontent.com/tursodatabase/libsql-js/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/Cargo.toml).
- Official docs: [Turso TypeScript quickstart](https://docs.turso.tech/sdk/ts/quickstart), [Turso TypeScript reference](https://docs.turso.tech/sdk/ts/reference), [Drizzle SQLite setup](https://orm.drizzle.team/docs/get-started/sqlite-new), [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations), [Electron 43](https://electronjs.org/blog/electron-43-0), [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [Electron ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives), [Forge Vite plugin](https://www.electronforge.io/config/plugins/vite), [Node-API](https://nodejs.org/api/n-api.html#node-api-version-matrix), [SQLite WAL](https://www.sqlite.org/wal.html), and [SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html#vacuuminto).

## Follow-up: Packaged Probe Result

The disposable prototype passed C1-C10 on Windows x64 and was removed after the decision was captured. Its retained machine-readable Evidence is `.rpiv/artifacts/research/2026-08-21_packaged-persistence-boundary-report.json`.

- C2 initially failed because the first probe enabled full upstream declaration checking, while SlopStop's accepted root policy explicitly uses `skipLibCheck: true`. The corrected gate now proves strict probe-owned source under the root policy and records Forge/Drizzle declaration defects as a separate non-blocking warning.
- C3 now hashes a complete ASAR, unpacked-native, and packaged-resource inventory and finds no packaged Drizzle Kit candidate.
- C7 now captures the full baseline before the operation, establishes an active native transaction plus uncommitted write before signalling the kill window, and proves exact pre-operation recovery after termination.
- The packaged runtime reported Electron 43.4.0, Node 24.18.1, Node-API 10, and the expected unpacked Windows x64 libSQL binary. This confirms why the embedded Node patch had to be observed rather than inferred.
- C8 observed a concurrent read and a competing write returning `SQLITE_BUSY` after the configured bound; this does not replace ADR 0002's separate operating-system writer lock.
- C9 proved successful `VACUUM INTO`, staged verification/restore, and rejection of actual interrupted output. C10 proved distinct newer, missing, and corrupt schema-metadata refusal before Drizzle.

These results make the selected runtime stack viable for canonical-state design. They do not promote prototype code into the product, establish broad Windows support, or select the final writer-lock primitive.

## Wayfinder Resolution Recommendation

> Resolve #35 by selecting the exact Windows x64 probe tuple `Node 24.19.0 build / Electron 43.4.0 with its actual packaged Node 24 patch recorded at runtime / pnpm 11.5.1 / TypeScript 6.0.2 / Forge 7.11.2 / Vite 8.2.1 / drizzle-orm 0.45.2 / drizzle-kit 0.31.10 / @libsql/client 0.17.4`, with the frozen ABI closure `libsql 0.5.29 / @libsql/win32-x64-msvc 0.5.29 / @neon-rs/load 0.0.4`. This resolves probe inputs only, not product adoption or an OS-lock primitive. Require prototype claims C1-C10 as disposable packaged evidence. In particular, do not infer Electron/ASAR loading from Node-API, do not infer safe competing access from SQLite WAL, do not use the unimplemented `backup()` method, and do not rely on Drizzle to reject newer schemas. If native loading, generated migrations, bounded contention, interrupted recovery, staged backup/restore, or newer-schema refusal fails, reopen the driver choice and compare `@tursodatabase/database`; otherwise carry the observed limits into canonical-state design and remove the probe dependencies.
