---
date: 2026-10-15T20:38:03+0100
author: Pedro Mesquita
commit: 8fcee45
branch: refactor/110-split-node-adapters
repository: slopstop
topic: "#110: split project-storage-node-adapters.ts along its ownership boundaries, behaviour unchanged"
tags: [design, storage, refactor, code-health, harness, effect]
lane: rigorous
lane_reasons: ["files: 11 > 5", "user raise: rigorous (decisions log §73)"]
status: ready
last_updated: 2026-10-16T13:10:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Developer Context appended for contingency 1, §76, §77-§80, candidate review round 1 (decisions log §81) and round 2 (§82). Mutation project testTimeout and include kept in the slice (decisions log §75). Revision 2 after the intent review (decisions log §74): owners for every declaration, real dependency direction, check:boundaries cycle gate, registry factory narrowed, predicates first, mutation baseline ranges, checkpoints without commits, locks and registry operations converted to Effect behind a Promise facade."
content_hash: 3512730a4ee75924555e1e9b661d84209202d2f7ae6b3ad8f90fe01b8fd52bdb
---

# Design: split `project-storage-node-adapters.ts` (#110)

Lane: rigorous. `lane.mjs --paths` over the planned files reports normal (revision 2 file set: files 11 > 5); Pedro raised it to rigorous (§73), because every Project open, create and upgrade goes through this file.

## Intent

Close the CodeScene waiver of decisions log §6 (:68): split `apps/harness/src/storage/project-storage-node-adapters.ts` (1813 lines, 1151 lines of code, CodeScene 8.41) into files that each own one part of Project Storage's Node adapter, so every resulting file scores 10. Behaviour does not change. Pedro chose (§74) to convert the two new factories to Effect now (below).

What CodeScene reports today: "Lines of Code in a Single File" (1151) and two "Complex Conditional" findings, `requireCurrentMetadata` (:373, five conditions) and `createNodeAdapters.registryWitnesses` (:1582, two conditions). Nothing else.

## The split

Function bodies move verbatim (only import and export lines change), except the two predicates and the two factories, which are described separately. Line numbers are at `8fcee45`.

| New file | Owns | Moves |
|---|---|---|
| `project-storage-node-support.ts` | small Node helpers and the shared type aliases | types `LocalClient`, `LocalTransaction`, `AllocatedCreation`, `ProjectStorageGenerationPaths` (:126-133); `createLocalClient`, `normalizeStorageError`, `lstatIfPresent`, `requirePlainDirectory`, `requirePlainFile`, `exactlyOne` (:179-210); `readPlainFile`, `sha256File` (:588-595); `assertRowsAffected` (:1246-1249) |
| `project-storage-database-authority.ts` | one database's migration metadata, integrity and identity | `metadataRows`, `migrationMetadataSql`, `createMigrationTarget`, `assertKnownAuthority`, `assertCurrentAuthority`, `requireForeignKeys`, `stringScalarRows`, `inspectDatabaseIntegrity`, `requireDatabaseIntegrity`, `requireApplicationIntegrity`, `requireCurrentMetadata`, `insertDatabaseIdentity`, `databaseIdentityMatches` (:211-482); predicate `metadataIsStale` (new, below) |
| `project-storage-database-build.ts` | building a generation's databases and verifying a sealed generation | type `ClosedDatabaseBuild` (:134-136); `insertCanonicalProjectState`, `buildDatabase`, `verifyOwnedDatabase` (:483-587); `requireManifestIdentity`, `requireActivationBaseline`, `verifySealedGeneration` (:596-662) |
| `project-storage-registry-rows.ts` | reading and writing the application registry's rows | constant `maximumRegistryGenerationsPerProject` (:159); row readers `generationRowsByRequest` … `hasGenerationLocationWitness` (:663-749); `registryWitnessKinds`, `requireUniqueRegistryWitnessRows` (:750-775); `insertStagingRows`, `activateRows` (:1250-1345) |
| `project-storage-create-inspection.ts` | classifying a create request against the registry | type `CreateInspection` (:137-139); `requireStagingCreateAuthority`, `requireActiveCreateAuthority`, `requireCanonicalCreateRequestFingerprint`, `requireRegisteredProjectAuthority`, `inspectExistingCreateGeneration`, `activeReplay`, `inspectCreateRows`, `inspectUpgradedCreate` (:776-1002); `inspectProjectRegistration` (:1221-1244) |
| `project-storage-healthy-opening.ts` | selecting and probing the generation a healthy open uses | types `OpeningSelection`, `HealthyOpeningSelectionInput`, `MutableOpeningClients` (:141-157); `activeGenerationFor`, `requireActiveRegistrationAgreement`, `sameDirectories`, `selectHealthyOpening`, `confirmHealthyOpening`, `inspectHealthyOpeningDatabase`, `completeOpeningDatabaseProbe`, `settledOpeningProbes` (:1003-1220); new type `ProjectDatabaseClientOpener`, the parameter type of `openProjectDatabaseClient` (:173-176), declared here |
| `project-storage-node-registry.ts` | the registry operations that need the closure's parts (Effect) | from the closure: `registryWitnesses` (:1552-1590), `declareStaging` (:1610-1665), `activate` (:1666-1709); predicate `isSeededReservation` (new, below) |
| `project-storage-locks.ts` | the create permit and the per-Project permits (Effect service) | from the closure: `locks` (:1771-1790) and `ProjectLockEntry` (:140) |
| `project-storage-node-adapters.ts` (kept) | composing the store dependencies | `NodeProjectStorageOptions` (its `openProjectDatabaseClient` field now references `ProjectDatabaseClientOpener`), the defaults (ids, clock, failures), paths, the application-database lifecycle (`ensureApplicationDatabase`, `applicationClients`, `requireApplicationAuthority`, `prepareCreate`, `stop`), `inspectOpening`, `inspectCreate`, `databases`, `upgrades`, `witnesses`, the `registry` object, `createNodeProjectStorageDependencies` and every current export |

The trailing import block (:1802-1813) moves to the top of the file that uses each import (`upgradeChainFor` is used by create inspection :823 and healthy opening :1074; `upgradedCreateRequest` and `UpgradedCreateRequest` by create inspection; `seedInitialRepositoryBinding` by database build; `Schema` by the authority and registry-row readers).

**Dependency direction** (no import goes the other way, types included):
- support ← every other new file;
- database authority ← database build;
- registry rows ← create inspection ← healthy opening (healthy opening calls create inspection; create inspection never imports healthy opening);
- registry rows, create inspection ← node registry;
- the composition imports all of them; no new file imports the composition. `NodeProjectStorageOptions` references `ProjectDatabaseClientOpener` from healthy opening, so healthy opening has no type import back to the composition.

**Public surface is unchanged.** `project-storage-node-adapters.ts` keeps every export it has today: `createNodeProjectStorageDependencies`, `NodeProjectStorageOptions`, and the re-exports `requireDeclaredSchemaObjects`, `loadGeneratedMigrations`, `DatabaseSpec`, `databaseSpecs`, `withWriteTransaction`, `createOpeningRelease`. Its importers (3 source files, 20 test files and fixtures, `project-storage-upgrade-peer.mjs`; the mutation vitest config names its unit test) change nothing. Each new file exports only what a sibling imports.

## The two predicates (first checkpoint)

Each predicate returns the original condition expression verbatim, and its single call site keeps the same branch and the same statement. The names state what the expression is, so no call site negates anything:

`metadataIsStale(metadata: MetadataRow, spec: DatabaseSpec, lastMigration: GeneratedMigration | undefined): boolean` in the authority file (was :373-380) returns exactly:

```ts
lastMigration === undefined ||
  metadata.metadataKey !== spec.metadataKey ||
  metadata.databaseKind !== spec.databaseKind ||
  metadata.formatVersion !== spec.formatVersion ||
  metadata.schemaVersion !== spec.schemaVersion ||
  metadata.lastMigrationId !== lastMigration.migrationId
```

Its call site: `if (metadataIsStale(metadata, spec, lastMigration)) throw new ProjectStorageBrokenError("Database metadata authority is not current.");`.

`isSeededReservation(seed, projectId, rows): boolean` in the node registry file (was :1582-1587) returns exactly:

```ts
seed !== undefined &&
  seed.projectId === projectId &&
  JSON.stringify(rows) === JSON.stringify([[seed.reservationId, seed.reservationFingerprint]])
```

Its call site: `if (isSeededReservation(seed, projectId, reservations.rows)) return kinds;`.

The `lastMigration === undefined` short-circuit stays first. `options.initialRepositoryBinding` is still read at call time (:1581), not captured at construction; `databases.verifySealed` is still looked up at call time in `activate` (:1675). The move diff (`git diff --color-moved=zebra --color-moved-ws=allow-indentation-change`) is the static proof of the verbatim expression.

Guards: `registration-bootstrap-guards.integration.test.ts:424-503` (`Storage creation honors %s reservation authority…`, win32 only) reaches both branches of `isSeededReservation`; `requireCurrentMetadata`'s throw (:381) is reached by no existing test (recorded residual; the mutation run below shows it as no-coverage or survived and it is reported, not hidden).

## Effect conversion of the factories (Pedro, §74: "Novo, converter já")

Only verbatim-moved functions keep their Promise form; their SQL bodies stay for #123 (D1). The two factories are new code and follow AGENTS.md "Effect Usage (effect 4)" (Context7 `/websites/effect_website_v4`, Semaphore and Layer pages, read 2026-10-15):

**`project-storage-locks.ts`: an Effect service.**
- `class ProjectStorageLocks extends Context.Service<ProjectStorageLocks, {...}>()("harness/ProjectStorageLocks", { make })` with `static readonly layer = Layer.effect(this, this.make)`.
- `make` is an `Effect.gen` that creates one create permit (`Semaphore.make(1)`) and the per-Project table (a `Map<ProjectId, { semaphore, users }>` owned by the service value).
- Operations take and return Effects (requirements `never`): `forCreate(effect)` and `afterCreateDrain(effect)` both run `createPermit.withPermits(1)(effect)` (one shared permit); `forProject(projectId, effect)` is `Effect.acquireUseRelease`: acquire gets or creates the entry and increments `users` in one `Effect.sync` (a synchronous `Semaphore.makeUnsafe(1)` keeps get-or-create atomic), use runs `entry.semaphore.withPermits(1)(effect)`, release decrements and deletes the entry when it is unused and still the current one, exactly as :1781-1787 do.
- **Temporary Promise facade** for the existing `ProjectStorageStoreDependencies["locks"]` callers: `createProjectStorageLocksFacade()` builds one service value per `createNodeAdapters` call (`Effect.runSync(ProjectStorageLocks.make)`; no module-level state, no runtime per call) and maps each Promise operation with `Effect.runPromise(locks.forCreate(Effect.promise(operation)))`-style adapters that keep the operation's rejection value identical. If the pins show `Effect.promise` changes the rejection identity, the adapter uses `Effect.tryPromise` with an identity `catch` instead; the pin decides. The facade is deleted when the store's callers are Effects (#123 Unit 2).
- `permit-lock.ts` is not changed (the active-project coordinator also uses it).

**`project-storage-node-registry.ts`: Effect programs.** `createNodeRegistryOperations(input)` takes one input object (`client` accessors, `requireApplicationAuthority`, `prepareCreate`, `projectRootFor`, `clock`, `failures`, `databases`, `options`) and returns only `registryWitnesses`, `declareStaging` and `activate`, each an `Effect.fn` program that calls the verbatim-moved Promise helpers through `Effect.tryPromise`. Expected failures stay the existing `ProjectStorageBrokenError` / `ProjectStorageUnavailableError` on the error channel (the `catch` narrows to those two; anything else is a defect), so the store sees the same error objects; converting those classes to tagged errors is #123's. The composition builds `registry` from `inspectCreate`, `prepareCreate`, `stop` and Promise facades of the three operations (`Effect.runPromise`), and keeps the application-database lifecycle. The inline reservation SQL of `registryWitnesses` (:1572-1579) moves verbatim into a Promise helper `reservationRows(client, projectId)` in registry rows, called from the program.

**Lock semantics, pinned before conversion.** No existing test asserts them directly; the lifecycle tests wrap the real locks (`project-storage-lifecycle.integration.test.ts:355-372`, `:445-478`, `:880` "settles operations admitted before Storage stop once the held create drains") and `registry-witness-race.integration.test.ts` exercises queued callers. So a new unit file `apps/harness/src/storage/project-storage-locks.test.ts` first pins, through `createNodeProjectStorageDependencies(...).locks` on the **current** code (it must pass before any move, recorded as a guard, then stay unchanged):
1. `forCreate` runs one operation at a time, in arrival order;
2. `afterCreateDrain` waits for a held `forCreate` and every create already waiting, and a later `forCreate` waits for it (one shared permit);
3. `forProject` serializes operations for the same Project in arrival order;
4. `forProject` for different Projects runs concurrently;
5. `forProject` is independent of the create permit;
6. two `createNodeProjectStorageDependencies` instances share no permit;
7. a rejected operation rejects with the identical error object, and the permit is released so the next operation runs.
Each pin is bound once (a mutation of the current lock code, for example a shared per-Project permit for pin 4, makes it fail; restored by digest). The per-Project table cleanup (:1785-1787) is not observable through the public surface (recorded). An Effect-level test of `ProjectStorageLocks.layer` with `TestClock`-free deterministic Deferreds covers the same rows at the service level.

## Behaviour-preserving rule

- No assertion in any existing test changes; no existing test file changes (the new pin file and, for mutation, the vitest include are the only test-side additions).
- Verbatim moves are proved by `git diff --color-moved=zebra --color-moved-ws=allow-indentation-change`, saved per checkpoint.
- The predicates are verbatim expressions; the factories are the only rewritten logic, and the pins plus the existing integration tests guard them.

## Guarding tests

| Part | Existing tests (through `createNodeProjectStorageDependencies` or the owner) |
|---|---|
| public re-exports | `project-storage-node-adapters.test.ts` (unit; it guards the re-exported helpers only) |
| support, database authority, build, sealed verification | `project-storage-node-adapters.integration.test.ts`, `project-storage-create.integration.test.ts`, `canonical-storage-identity-rebuild`, `canonical-generation-four-pin`, `project-storage-schema-cases` users |
| registry rows, witnesses, staging and activation | `project-storage-create`, `project-storage-lifecycle`, `project-storage-open-recovery`, `registry-witness-race`, `registration-list`, `registration-bootstrap-guards` (`isSeededReservation` :424-503), `application-database-authority-cases` |
| create inspection, upgraded create | `project-storage-create`, `project-storage-chained-upgrade`, `project-storage-upgrade-recovery`, `registration-project-upgrade` |
| healthy opening and probes | `project-storage-open.integration.test.ts`, `project-storage-open-initialization`, `project-storage-lifecycle`, `project-storage-upgrade`, `project-upgrade-runtime`, `project-storage-filesystem-authority` |
| locks | the new `project-storage-locks.test.ts` pins; `project-storage-lifecycle`, `registry-witness-race` |

**Per-checkpoint command set** (each run's log kept, bound to parent and patch digest):
1. `pnpm exec biome check --write` on the touched files; `pnpm typecheck`; `pnpm check:boundaries`;
2. `pnpm exec vitest run apps/harness/src/storage/project-storage-node-adapters.test.ts apps/harness/src/storage/project-storage-locks.test.ts apps/harness/src/storage/project-storage-store.test.ts`;
3. `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts project-storage-create project-storage-lifecycle project-storage-open project-storage-node-adapters registry-witness-race project-storage-chained-upgrade project-storage-upgrade project-upgrade-runtime application-database-authority`;
4. `pnpm exec vitest run --config apps/harness/vitest.registration.config.ts registration-list registration-bootstrap-guards registration-project-upgrade`;
5. `pnpm check:duplicates`; `pnpm check:dead-code`; CodeScene on every touched file.

Runs 3 and 4 are measured on their first use; if either takes over 2 minutes, every later use needs the coordinator's GO. Always under the coordinator's GO: `pnpm test:integration`, `pnpm test:e2e`, `package:launch-smoke`, both mutation runs, and any pin binding run that is heavy.

## Mutation obligation

- **Baseline on `8fcee45`, before any change**, with the existing test set: `stryker.project-storage.config.json` with its `mutate` list plus `apps/harness/src/storage/project-storage-node-adapters.ts:373-380` and `:1582-1587` (the predicate expressions), and `apps/harness/tests/integration/registration-bootstrap-guards.integration.test.ts` added to `vitest.project-storage-mutation.config.ts` `include` (config only; if it cannot run in that project, the gap is recorded instead). The temporary config change for the baseline is recorded and becomes the committed config with the moved ranges.
- **Final** on the final candidate after the last review round: the same ranges at their new places (`sameDirectories` :1036-1043 and :1075-1081 in healthy opening; the predicates in their files), plus `project-storage-locks.ts` and `project-storage-node-registry.ts` (new Effect code; the pins and the integration tests as oracles).
- Compared per range and per mutant (location, mutator, status), not per file. Any mutant killed in the baseline that survives in the final stops the work for a decision. Both runs need the coordinator's GO.

## Gates

On every checkpoint, the command set above; CodeScene: no score drop and no new smell on any touched file. On the final state: CodeScene 10 on every resulting file, `pnpm check`, `pnpm check:duplicates`, `pnpm check:dead-code`, `pnpm check:boundaries` (the cycle gate: dependency-cruiser `no-circular`; it ignores type-only imports, hence the `ProjectDatabaseClientOpener` placement), `pnpm check:architecture` (the LikeC4 model only), then `pnpm test:integration`, `pnpm test:e2e`, `package:launch-smoke` and the final mutation run. Close the waiver in the decisions log on acceptance.

Contingency: if the support file (or another) gets "Primitive Obsession" or "Excess Number of Function Arguments", the arguments are grouped into one input object with the smallest signature change, recorded in the evidence.

## Commits and checkpoints

One slice commit. The steps are uncommitted checkpoints, each recorded with its parent, the patch digest of the whole working tree and its test logs:
0. pins (`project-storage-locks.test.ts`) pass on the current code; bindings recorded; baseline mutation (GO);
1. the two predicates;
2. support; 3. database authority; 4. database build; 5. registry rows; 6. create inspection; 7. healthy opening;
8. locks service and facade; 9. registry operations and facade; 10. composition tidy-up and mutation config ranges.

## Risks

- **A hidden cycle.** `check:boundaries` catches value cycles; type-only back-edges are prevented by the placement above and reviewed in the move diff.
- **The composition may still be large.** It keeps about 250 lines; if CodeScene still flags it, `inspectOpening` moves beside the healthy opening (recorded).
- **Effect facade changes timing or error identity.** Pins 1-7 run before and after; an identity or ordering change fails them.
- **Mutation ranges drift**; the baseline names the old ranges and the comparison is per mutant.
- **Concurrent work.** The coordinator holds edits to this file while #110 runs.

## Deferred

- The moved SQL bodies' Effect migration, the storage error classes as tagged errors, and removing the lock and registry facades: #123.

## Developer Context

### Approval and lane (decisions log §73, 2026-10-15)

- Pedro approved this brief, including D1: verbatim-moved code keeps its Promise form and counts as untouched for the Effect rules; #123 owns the moved SQL bodies and the permit locks.
- Pedro raised the lane from normal (the lane tool's answer, files 10 > 5) to rigorous. The coordinator runs the three-role intent review (slice-verifier, code and coverage reviewers) before any source edit.

### Intent review round 1 and revision 2 (decisions log §74, 2026-10-15)

The intent review of `bbc497a` (`content_hash aa5dff59…`) found 3 blockers and several concerns; Pedro decided all items. Revision 2 changes: `inspectProjectRegistration` moves to create inspection and the real direction is healthy opening → create inspection; the cycle gate is `pnpm check:boundaries` (depcruise ignores type-only imports, so `ProjectDatabaseClientOpener` is declared in healthy opening); every top-level declaration has an owner (types :126-157, the constant :159 to registry rows); the registry factory returns only `registryWitnesses`, `declareStaging`, `activate`, takes one input object, and the composition owns `inspectCreate`, `prepareCreate`, `stop` and the application-database lifecycle; the guard table adds `project-storage-open` and `registry-witness-race`, the unit test guards the re-exports only, and the per-checkpoint commands and GO runs are named; the predicates return the original expressions verbatim, come first, name their guards, and record the unreached :381 throw; the mutation baseline adds the predicate ranges and `registration-bootstrap-guards`, compared per mutant; CodeScene 10 on the final state with no drop per checkpoint, and the Primitive Obsession contingency; one slice commit with uncommitted checkpoints; Pedro chose "Novo, converter já": the locks become an Effect service with a Layer and the registry operations Effect programs, behind temporary Promise facades, with lock semantics pinned first; gate names `pnpm check:dead-code`; move diffs with `--color-moved-ws=allow-indentation-change`; call-time reads :1581 and :1675 kept.

### Baseline dry-run timeout (decisions log §75, 2026-10-15)

- The first baseline run stopped in Stryker's initial test run: `registration-bootstrap-guards.integration.test.ts:130` timed out at Vitest's 5 s default, because the mutation project set no `testTimeout` (the file runs at 15 s in the registration project). No mutant was tested; the log is kept.
- Pedro chose to give the mutation project `testTimeout: 15_000` (the file's usual limit) and keep `registration-bootstrap-guards` in its `include`. Both `vitest.project-storage-mutation.config.ts` changes are part of the slice, not temporary. The `mutate` ranges added for the baseline (`:373-380`, `:1582-1587`) are replaced by the moved ranges in checkpoint 10.

### Support-file contingency (checkpoint 2, 2026-10-15)

- At checkpoint 2 the support file met the contingency named under Gates: the five positional wrappers moved from the closure were removed, and their call sites use the existing object-argument helpers instead. Same calls, arguments and errors. Recorded in the TDD evidence as contingency 1.

### Checkpoint 6 duplication (decisions log §76, 2026-10-15)

- The verbatim-moved create inspection scored 8.81 (Code Duplication between the staging and active create authority reads, plus Overall Code Complexity), a smell the large file had hidden and the contingency above did not cover.
- Pedro chose one private helper `createAuthorityRows({ client, generation, message })` for the shared read. It keeps the Promise form (D1). Same queries, order, messages and errors. Recorded in the evidence as contingency 2.

### Launch-smoke regression and fix (decisions log §77-§80, 2026-10-16)

- On the slice commit `343d1ba`, `package:launch-smoke` failed at the writer-proof scenario. Pedro authorised a diagnostic sequence (§77-§79). Main passed the same smoke, so it was a #110 regression.
- Cause (§80): with the new module graph, Rolldown put its runtime helpers into the Storage chunk. That chunk loads `fs-native-extensions`, and the writer-proof fixture entry required it at load time. So the addon loaded before the fixture's native-origin check, and the check failed.
- Pedro chose a build configuration fix plus a guard; the product code and the native-origin check are unchanged. These files are outside this brief's file map:
  - `apps/desktop/vite.harness.config.ts`: one `codeSplitting` group for kernel, protocol and Effect;
  - `apps/desktop/tests/e2e/package-smoke-load-order.mjs`: the load-order guard;
  - `apps/desktop/tests/e2e/package-smoke.mjs`: runs the guard in the writer archive preflight.
- Fix commit `65a10bb`. Evidence: `.rpiv/artifacts/evidence/2026-10-15_110-tdd-evidence.md`.

### Candidate review round 1 (decisions log §81, 2026-10-16)

- Round 1 on `65a10bb` failed (table T1-T13). Pedro chose "Corrigir tudo"; round 2 is the last round. The fix round is a new commit on the branch; the branch is squashed into one main commit at integration (T8).
- T1: the facade had changed the lock hand-off order. Effect's Semaphore wakes waiters on a dispatcher task. A `runPromise` fiber does not flush that task when it releases, so a caller that arrived after the release could take the permit before the queued waiters. The facade goes back to the base algorithm, `permit-lock.ts` `withPermit`, over the service's own permits. The permit is taken through Effect and released with `runSync`. This restores the synchronous FIFO hand-off and the base's deferred start. The service exposes `createPermit` and `retainProject` for that facade, and #123 removes them with it.
  - Within Effect, the service's own operations keep Effect's Semaphore order. A caller that arrives at release can still overtake a queued waiter. No caller uses them yet. This is recorded as a residual for #123.
- T2: the final mutation covers the whole of `project-storage-locks.ts` and of `project-storage-node-registry.ts`, as brief :138 says. The mutation `include` adds both lock tests, `project-storage-lifecycle` and `registry-witness-race`.
- The other fixes:
  - T3: a pin for a third caller;
  - T4: registry error-mapping tests;
  - T5: a unit test for the load-order guard, IIFE handling, a distinct no-requires result and a printed chain;
  - T6: this record;
  - T7: the evidence;
  - T9: moot, because the facade no longer uses `Effect.promise`;
  - T10: `storageFailureFor` in `project-storage-node-errors.ts`, and `Effect.try` for the synchronous step;
  - T11: `NodeRegistryInput` is no longer exported;
  - T12: TSDoc on the registry facades;
  - T13: the configuration comment.

### Candidate review round 2 (decisions log §82, 2026-10-16)

- U2: the round 1 fixes touched files outside the map, against :111 ("no existing test file changes"): the launcher fixture body in `apps/desktop/src/main/package-smoke-launcher.test.ts` (no assertion changed), the T4 cases added to the existing `apps/harness/tests/integration/project-storage-node-adapters.integration.test.ts`, `apps/desktop/playwright.config.ts` (`testIgnore`), `apps/desktop/vitest.main.config.ts` (include) and the new unit test `apps/desktop/tests/e2e/package-smoke-load-order.test.mjs`. Round 2 adds one case to the launcher test (U3) and the integration file to the mutation include (U1). Recorded here for Pedro's acceptance.
- Fixed in round 2: U1 mutation include, U3 launcher guard-failure case, U4 a top-level class static block counts as load time, U5 committed start-deferral pin, U8 a status-neutral message, U10 the 6e5d915 heavy runs recorded. U6, U9 and U11 go to #123; U7 and U12 are residuals in the evidence.
