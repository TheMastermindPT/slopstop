---
date: 2026-10-09T16:45:00+0100
author: Pedro Mesquita
repository: slopstop
branch: feat/c1-conversation-local-save
commit: 5700ab9
status: ready
tags: [evidence, tdd, conversation, c1, storage, upgrade, registration]
---

# Conversation C1 S1 — schema 4 and chained upgrades — TDD evidence

Design `.rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md` (status ready, content hash `afdaf570…`), slice S1. Linked worktree `slopstop-c1`, branch `feat/c1-conversation-local-save` from local `main` `5700ab9` (decisions §19). The coordinator approved the build plan below (order B1+B3 → B2 → B23 → B4 → B5 → B5b → B22 → B20 → ADRs → review/refactor → gates → one commit) and the three open points (a) B23 capture at `9aab1cc` in a temporary worktree, (b) B20 in its own file, (c) B1 and B3 reds in one run.

Nothing ran against the real `userData`. Every application root is a fresh directory under the OS temporary folder.

Worktree C:/Users/pedro/Documents/GitHub/slopstop-c1, branch feat/c1-conversation-local-save, base 5700ab9.
Command prefix (apps/harness): `pnpm exec vitest run -c vitest.integration.config.ts <file>`

## CNV-B1 + CNV-B3 red (same run, base 5700ab9, only the new test file added) - 2026-10-09 15:35
File: tests/integration/project-storage-conversation-schema.integration.test.ts
- B1 `creates new Projects at schema 4`: FAIL, schema_metadata received schema_version 3 / last_migration_id 0002_initial_repository_binding (expected 4 / 0003_conversation_messages).
- B3 `upgrades a generation-two Project to schema 4 in one upgrade`: FAIL, upgraded target at schema 3 / 0002 (expected 4 / 0003).
Why one run: B3's red is only observable while no 0003 migration exists; B1's green adds it.

## CNV-B1 + CNV-B3 green - 15:39/15:40
Green after: canonical-schema.ts three tables; drizzle-kit generate --name conversation_messages (0003 + snapshot + journal, generated); specs schema 4 + table specs; generated-migration-resources generation-four pin (0003 statements sha256 a81cce4f...).
Test-side fault fixed before green: the 32768-byte boundary row reused the default ids, so a later case failed for the wrong reason; every case now pins its exact constraint message.

## CNV-B2 guard - 15:40
`upgrades a generation-three Project to schema 4`: written after B1's migration; passed on first run (guard, as the design predicts: at base a v3 Project answers not-required). New createGenerationThreeProject + rewindToGenerationThree.

## Pins updated - 15:41
schema-cases (schema 4, counts, spec lengths 109/75/20/18), create trust-spine counts, upgrade.integration (:100, :505), package-smoke-fixture (:165), rewindToGenerationTwo drops v4 tables. db:generate:check clean. Harness unit 792/792.

## CNV-B23 fidelity guard - 15:47
Capture at 9aab1cc in temp detached worktree %TEMP%/slopstop-c1-capture-9aab1cc (temp application root under OS temp, never userData), command + revision in tests/fixtures/c1-0-upgrade-capture/README.md; worktree removed. createUpgradedOnceProject (createUpgradedProject + target rewound to schema 3) equals the capture: PASS.

## CNV-B4 red - 15:49
File tests/integration/project-storage-chained-upgrade.integration.test.ts, `upgrades a Project that was already upgraded`.
Second upgrade answers `upgraded` (switch done), then acquireActivation -> {"status":"broken","message":"Project Storage upgrade authority is not unique."} (exactly the design's expected red).

## CNV-B4 green - 15:52
Chain rule in application-database-migration.ts (orderUpgradeChain + chainRootCreatedAt / chainRetainedGenerationIds / receiptGenerationResolves; registry gate requireUpgradeChains replaces the COUNT(*) > 1 and per-row target-active SQL). Readers: upgradeChainFor (replaces completedUpgradeFor; last link names the latest upgrade), node-adapters :819 chain root createdAt, :1070 every retained chain generation, proveUnfinishedUpgrade retains every chain source. Test-oracle fix: create-replay identity has no projectId.

## CNV-B5 pin - 15:54
4 cases (`refuses a broken upgrade chain: $name`) on a real chain of two, SQL-corrupted: authority REGISTRY_CORRUPT in all four. Opening: broken for three; "a source still in storage_generations" (staging row) opens safe mode recovery-required (existing recovery path, never read-write) - pinned per case.

## CNV-B5b - 15:58
Case 1 `... upgraded once, then completes the chain`: real stop at after-staged-copy (third ids a3/44, later instants) on an upgraded-once Project; next activation safe-mode migration-required on v3 (gen 24), abandoned(interrupted) diagnostic, first chain row + its source dir + its backup unchanged; a new upgrade completes the chain read-write. Passed on first run: its design red ("not unique") was B4's red, already fixed by B4's green - recorded as guard after B4.
Case 2 `... two completed upgrades retain both sources`: SQL + file-copy seed of an in-progress third upgrade on a chain of two. Bound red observed by temporarily restoring the one-source retained list (proveUnfinishedUpgrade: [upgrade.source, last.source]): activation safe-mode instead of read-write (discard unproven, v2 dir not retained). Restored -> green.

## CNV-B22 pin - 16:00
`accepts a chain of three`: deviation from the design's SQL+file seed, for fidelity: every link is a real upgrade (chain of two, active generation rewound to schema 3, third real upgrade with third ids and later instants; the third link re-applies 0003, no real third migration exists - gap disclosed). Oracle: three links in order, authority current, a SQL-seeded fourth interrupted upgrade is discarded with all three sources and backups retained (filesystem agreement + proof over three), reopening read-write. Passed on first run (pin over S1's rule).

## CNV-B20 - 16:03 red / 16:05 green
File tests/integration/registration-project-upgrade.integration.test.ts (registration lane via the existing `registration-*.test.ts` glob in vitest.registration-files.ts; no list edit needed).
Command: `pnpm exec vitest run -c vitest.registration.config.ts tests/integration/registration-project-upgrade.integration.test.ts`
Red: after a real registration (v4), rewind to v3 (rewindToGenerationThree, generic over a generation directory), runtime `project.upgrade` -> upgraded, then `project.list` -> {"status":"broken","code":"REGISTRY_CORRUPT"} (design's expected red). Observation: the runtime stop then throws "Project listing cleanup is unconfirmed." (process-bootstrap.ts:155) after a broken listing; masks the assertion; disappears once listing is healthy. Not changed in S1.
Green: registration-confirmation-store receiptGenerationAgrees (activated generation of the reservation's create request, else storage registered to the reservation's Project and receiptGenerationResolves over upgradeChainFor). Oracle-word fix: listed storage status is "healthy". Test time 5.75 s (duration 7.26 s).

## Review/refactor gate (self) - 16:10 to 16:40

- Shared registry read `readUpgradeChainRegistry` (one owner for the active generation and present generation ids); fixed a latent bug in the registry gate where a NULL active generation would have read as the text "null".
- `orderUpgradeChain` split into `linkedFromRoot` and `chainAgrees` (complexity).
- Spec helpers moved to `project-storage-spec-builders.ts`, Conversation specs to `project-storage-conversation-specs.ts` (CodeScene: declarations over 1500 lines in `project-storage-database-specs.ts`).
- Touched files with older debt brought to 10: `generated-migration-resources.ts` (8.41 → 10), `registration-confirmation-store.ts` (7.35 → 10), `canonical-writer-package-smoke-fixture.ts` (9.66 → 10). Behaviour unchanged; the affected unit and integration files re-ran green.
- Registration fixture: one `answer` helper for session commands (CodeScene duplication).
- Capture stored as JSON Lines (`capture.jsonl`, converted mechanically from the first pretty JSON capture, data unchanged; the B23 test compares the serialised bytes). Reason: the pretty JSON tripped jscpd on repeated manifest shapes, and `scripts/check-golden-sql.test.mjs` pins `jscpd.json` to its single fixture exclusion, so no exclusion was added.

## Behaviour changes for reviewers

1. `project-storage-upgrade-recovery.integration.test.ts` "a target equal to the retained generation": the discard diagnostic cause is now `broken` (was `unproven`). The rogue staging row puts a completed upgrade's source back in `storage_generations`; the chain rule refuses that registry before the proof compares directories (the registry gate already answered `REGISTRY_CORRUPT` for it before S1). Data stays quarantined in both.
2. CNV-B5 "a source still in storage_generations" opens safe mode `recovery-required` (existing staging-row recovery path), not `broken`; authority is `REGISTRY_CORRUPT`. Pinned per case.
3. G16 reading at 5773476: `started_at` had to increase strictly. Superseded by U1 (round 1): links only, times never checked.
4. CNV-B22 uses three real upgrades (each target rewound to schema 3) instead of an SQL seed (fidelity; no third migration exists).

## Observations not changed in S1

- After a broken `project.list`, the runtime stop throws "Project listing cleanup is unconfirmed." (`process-bootstrap.ts:155`), masking the test's own assertion. Seen during the CNV-B20 red only.
- The package-smoke integration file resolves its migration root from the process cwd (`path.resolve("apps/harness/drizzle")`); run it from the repository root.

## Gates on the frozen candidate

Repository root, worktree `slopstop-c1`:

- `pnpm check`: pass (2441 unit tests; dependency-cruiser no violations).
- `pnpm check:duplicates`: 0 clones. `pnpm check:dead-code` (knip): pass. `pnpm check:architecture`: pass. `db:generate:check`: clean.
- Integration, touched files only: storage files 17 passed / 1 env-gated skip (248 tests); registration lane 15 files (173 tests); package smoke (native-long, from root) 149 passed.
- CodeScene pre-commit safeguard: passed, only improvements. Touched files at 10 except `project-storage-node-adapters.ts` 8.41 (design waiver; verdict stable, 1151 lines unchanged).

Not run, waiting for the coordinator's go-ahead: full integration projects, `pnpm test:e2e`, `package:launch-smoke`, mutation (`stryker.project-storage.config.json` now mutates the chain rule lines and the filesystem agreement, with the chained-upgrade file in its Vitest project).

## Identity of the S1 red/green states (F5)

All S1 states above were uncommitted edits on parent `5700ab9`; the S1 squash is `5773476`. Their working-tree patch digests were not recorded when they happened and cannot be reconstructed exactly, because the tree kept changing between states. Disclosed as a gap. Reproducible evidence for the one temporary revert:

- CNV-B5b case 2 red, reproduced on parent `8f786d4`: the one-source retained list (`[upgrade.source, last.source]`) in `proveUnfinishedUpgrade`, full working-tree patch sha256 `fdeb8e140b447b8bd98b0b75051fa36923182e50e30cb10cd8a0c208400dfa8d` → "two completed upgrades retain both sources" FAILS (`mode` safe-mode instead of read-write). Restored; clean tree.

From round 1 on, every state records its parent commit and the digest of the full working-tree patch (`git add -A -N` then `git diff HEAD --binary | sha256sum`, first 16 hex; U1 and F2 used `git diff`, complete for them because they added no files).

## Approved contract amendments (U2, Pedro, review round 1)

1. CNV-B5 "a source still in storage_generations" opening in safe mode `recovery-required` counts as "never opened".
2. CNV-B5b case 1 is a guard; case 2's red came from temporarily restoring the one-source retention.
3. CNV-B22 uses three real upgrades instead of an SQL seed (gap disclosed: no real third migration).
4. The C1-0 recovery case expects cause `broken` instead of `unproven` (data still quarantined).

## Review round 1 fixes


### U1 links-only chain order
- Red: parent 8291fde, patch ec693b3ae4deedfc (test only). `orders a chain by its links only: a $clock clock` (equal, backward) in project-storage-chained-upgrade.integration.test.ts -> both FAIL, restartApplicationAuthority answered {"status":"broken","code":"REGISTRY_CORRUPT"} instead of "current".
- Green: parent 8291fde, patch f52d5137c3183442. Removed the started_at clause (and the now unused startedAt field/column reads); ADR 0006 2026-10-09 amendment and design G16, S1 file list, :337 and the R2-C5 row reworded. Chain file 11/11.

### F2 chain shapes
- New brokenChainCases rows (pins; pass on current code): "a detached cycle beside the chain", "a last link whose target is not the active generation" -> REGISTRY_CORRUPT, opening broken.
- Binding check for the cycle row: parent 1eb7e3e, patch 22d5699cc8b13f5f (chainAgrees `chain.length === links.length` replaced by `true`) -> the cycle row FAILS; restored.
- Guard `chain.length > links.length` removed as unreachable (unique targets mean no revisit), TSDoc records why; the targets-size check is kept, it is what makes the walk end. Green: parent 1eb7e3e, patch 7865a531196c1951, chain file 13/13.

### F1 receipt rejections
Digest method from here: `git add -A -N` then `git diff HEAD --binary | sha256sum` (includes new untracked files; the earlier `git diff` digests above cover tracked edits only - U1 and F2 added no new files, so they are complete).
- Unit (registry-authority owner) src/storage/application-database-migration.test.ts: resolves the root source (true); refuses a different create request, a generation that is not the root's source (same request), the active generation, and an empty chain. Pins; green at parent b784e3f, patch 5710a0bb3f74b6a0.
  - Binding: drop the create-request comparison (patch ed019997578b9b62) -> "a different create request" FAILS; drop the generation comparison (patch 8b33248f61ad53e9) -> "not the root's source" and "the active generation" FAIL. Restored.
  - Test fix found by the binding check: the "not the root's source" case first used request u1, so it passed for the wrong reason; now uses r1.
- Registration lane: `refuses an upgraded receipt whose Storage belongs to another Project` (real registration, rewind, runtime upgrade, then the Storage's registry rows moved consistently to another Project) -> project.list {"status":"broken","code":"REGISTRY_CORRUPT"}. Green patch ca06844feedd7222. Binding: registration-confirmation-store receipt Project check disabled (patch 7d749102a3314338) -> FAILS. Restored.
  - The known follow-up (broken listing leaves cleanup unconfirmed at stop) is pinned explicitly with `rejects.toThrow("Project listing cleanup is unconfirmed.")`, not swallowed.

### F3 generation-four pin refusals
New tests/integration/canonical-generation-four-pin.integration.test.ts over a copy of the checked-in canonical migrations: loads 0000-0003 (accept); refuses "a changed 0003 statement", "a wrong 0003 tag", "a schema-4 spec with three migrations" with "Generated canonical storage identity rebuild is invalid.". Pins; green at parent 37db771, patch 63abacf1c4a4285f.
Binding (each restored): migrationId comparison dropped (patch 206ae4da91aff519) -> "wrong tag" FAILS; statements hash forced true (patch fa5f592d321e2fde) -> "changed statement" and "wrong tag" FAIL; length check dropped (patch db27a1ebda1035a5) -> "three migrations" FAILS.

### F6 suggestions
- CNV-B1 gains five insert rules (pins, each pinned to its exact message): a reused save id (UNIQUE save_id), a malformed save fingerprint (CHECK ..._save_fingerprint_sha256), a scope kind outside the set (CHECK conversations_scope_kind), a fork message that does not exist (FK), a parent branch from another conversation (FK; the seed now also holds a waypoint conversation with its own root). Green.
- Recovery test renamed "keeps upgrade leftovers quarantined as broken: a target equal to a retained generation"; filesystem-authority.ts guard commented as a backup check the chain rule pre-empts.
- B23 re-capture at 9aab1cc (temp detached worktree, removed): byte-identical to capture.jsonl, sha256 1ad6004bc92582ce16c5042a2efec3308e6eddd455c1ab6da2ce427468380c9a.
- State: parent bf124e6, patch 4ad7cbecc7591d57.

### F4 mutation scope
stryker.project-storage.config.json mutate gains project-storage-spec-builders.ts and project-storage-conversation-specs.ts (moved out of the mutated specs file); line ranges re-pointed at the same functions after the U1/F2 edits (application-database-migration.ts:142-284 = UpgradeLink through requireUpgradeChains; node-adapters 1036-1043 sameDirectories, 1075-1081 filesystemAgrees). Not narrowed. vitest.project-storage-mutation.config.ts gains the conversation-schema, registration-project-upgrade (F1) and application-database-migration unit (F1) files; the chained-upgrade file (U1, F2) was already in.
refactor state parent 8f786d4 patch 9a4751cfbd1b3fc4

### Code Health follow-up
`registration-bootstrap.integration.test.ts` (touched by the 8291fde pin) scored 9.03: its one 179-line case is split into named steps over one session, assertions and order unchanged, 3/3 green, Code Health 10 (`4e8080f`).

### Commits (round 1)
`1eb7e3e` U1, `b784e3f` F2, `37db771` F1, `bf124e6` F3, `00028c9` F6, `8f786d4` F4, `4e8080f` Code Health follow-up, then this evidence commit and a follow-up that binds the gates to its sha.

## Gates bound to `67e74c2` (round-1 final code; this commit changes evidence only)

Clean tree at `67e74c2`, repository root of the worktree:

- `pnpm check`: pass, 2446 unit tests, dependency-cruiser no violations.
- `pnpm check:duplicates`: 0 clones. `pnpm check:dead-code`: pass. `pnpm check:architecture`: pass. `db:generate:check`: clean.
- Round-1 integration files: chained-upgrade, conversation-schema, generation-four-pin, upgrade-recovery 4 files / 31 tests passed; registration-project-upgrade and registration-bootstrap (registration lane) 2 files / 5 tests passed.
- CodeScene `analyze_change_set` against `5700ab9`: quality gate passed, 27 files checked, only improvements. Every touched file at 10 except the waived `project-storage-node-adapters.ts` (8.41, stable).

Heavy sequence (full integration, e2e, launch-smoke, project-storage mutation) not run on `67e74c2`; it waits for the coordinator's go-ahead and runs once on the final S1 commit.

## Design re-stamp (U1)

The C1 design text changed for U1, so its frontmatter now carries `last_updated: 2026-10-09T18:30:00+0100` and a `last_updated_note` citing decision U1 (decisions log §23, main `da60c26`). `validate-artifact --finalizing --stamp` → OK, content hash `493058d63ee903c51e3c99a42ad0d9b647332d8d8fd5e267581b9852f836ea5e` (prior `afdaf570…`; only G16, the S1 chain-rule list, the :337 wording and the R2-C5 row changed). The S1 merge carries the amended design.

## Heavy sequence on `75ce0d1` (coordinator go-ahead; each ran once, with no reruns)

Logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/heavy-75ce0d1/`. Each log header records CPU load and free RAM.

| Run | Result | Duration | CPU / free RAM at start | Log |
|---|---|---|---|---|
| `pnpm test:integration` | exit 0: 66 files passed, 2 skipped; 2076 tests passed, 5 skipped | 546 s | 76% / 9.1 of 31.9 GB | `1-test-integration.log` |
| `pnpm test:e2e` | exit 0: 11/11 passed | 115 s | 12% / 8.9 GB | `2-test-e2e.log` |
| `pnpm package:launch-smoke` | exit 0: "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." | 42 s | 10% / 8.9 GB | `3-package-launch-smoke.log` |
| `pnpm test:mutation:project-storage:harness` | exit 0: 13 files, 3110 mutants, score 86.75 (break 80, high 90) | 60 min | 54% / 8.8 GB | `4-mutation-project-storage.log` |

The integration run started at 76% CPU, above the 15% the coordinator reported; it passed.

## Review round 2 (last): fixes

Pedro decided FIX AND ACCEPT, with no third reviewer round. The coordinator checks the commits. Each new test pins existing behaviour, so the red is a binding run: the guarded code is mutated once, the test fails, and the code is restored. Parent of every state is `75ce0d1`; patch digest = `git add -A -N && git diff HEAD --binary | sha256sum`. Binding logs: `C:/Users/pedro/AppData/Local/Temp/claude/C--Users-pedro-Documents-GitHub-slopstop/b9fedef5-830f-4604-8392-4a1ce696fe8d/scratchpad/r2-bindings/`.

| Pin | Test | Mutation (bound red) | Red patch sha256 | Red outcome |
|---|---|---|---|---|
| Target uniqueness | `application-database-migration.test.ts` "refuses two links into one generation…" (g1->g2, g2->g3, x->g3, g3->x, active g3 → `undefined`) | drop `targets.size !== links.length` | `f518998f4b243d5a48854f121acea405b32899c1acb0deae9f92a134e6d78ead` | the walk never ends: worker heap out of memory (`--max-old-space-size=256`), "Worker exited unexpectedly" |
| Per-Storage grouping (`requireUpgradeChains`) | chained file "checks each Storage's chain on its own: two upgraded Projects in one root" (chain of two plus a second Project upgraded once) | pass every Storage's links to the rule | `863a41eea75f7cd427e54488e031ede14d4cc03e8a63037677a0b63186d5ce61` | `{ status: 'broken', code: 'REGISTRY_CORRUPT' }` instead of `current` |
| Filesystem agreement refusal | chained file "opens a chain of two in safe mode when its directories disagree": a missing chain root source directory; an extra generation directory | `if (!filesystemAgrees && false)` | `2a913a3266ad85d3eacf78956973c561fbc661f29ed7fe4dd59a3caa8c3bcc16` | both cases open `read-write` instead of `safe-mode` recovery-required |

Every restore returned the green patch `b4a92bf2…`. After knip flagged `StorageCreationIds` as an unused export, the type was unexported. The final green state is patch `17d9dd3604da34606e602fb9e6992f0ab47977c585fe8efedf7060fd3122c333`: unit file 6/6, chained file 16/16. The upgrade owner fixture gained an `identity` option (another Storage's creation ids), and `expectReadWriteOn` gained an optional request. Commits: `8b75f56` (target uniqueness), `49c988e` (grouping and directory refusal).

Gates on the green state: `pnpm check` pass (2447 unit tests); `check:duplicates` 0 clones; `check:dead-code` pass; `check:architecture` pass; `db:generate:check` clean. CodeScene `pre_commit_code_health_safeguard`: passed, 4 files, no issues; all four touched files at 10.

Design wording (optional item 5): node-adapters :819 now says the chain root "is found by links (replaces the C1-0 :264 `started_at` rule)". `last_updated` is now `2026-10-09T19:20:00+0100` and the note is extended. Re-stamped: `validate-artifact --finalizing --stamp` OK, content hash `8a67ea7a3b0c9bbbd8a1f1e4efb6e80502f49cfac88c3f380c1d35116aedd93f` (commit `2db7413`). This one-line wording change comes after Pedro's approval of `493058d6…`.

## User acceptances (Pedro, via the coordinator, 2026-10-09)

- The re-stamped design `493058d63ee903c51e3c99a42ad0d9b647332d8d8fd5e267581b9852f836ea5e` is approved. The later stamp `8a67ea7a…` changes only the optional item-5 wording.
- The residual risk is accepted: the original S1 red states were not digested when they ran.
- S1 and S2 commits are squashed at merge (S1 merges only with S2, G15).
- The heavy runs and mutation run once more, on the final S1+S2 candidate.
