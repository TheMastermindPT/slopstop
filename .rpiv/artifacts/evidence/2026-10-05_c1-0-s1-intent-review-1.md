---
date: 2026-10-05T21:10:00+0100
author: Pedro Mesquita
commit: 2d52eeb
branch: main
repository: slopstop
status: complete
topic: "Intent review round 1 of c1-0-s1-staged-upgrade-engine"
---

# Intent review round 1 — c1-0-s1-staged-upgrade-engine

## Plan Review (design step 4, round 1)

Mode: intent. Reviewed target: `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`, raw SHA-256 `4f0b775e148e8238170c2f41f6199d5eac8aa60d29503d40aa346040d65d645a` (recomputed by the parent before and after review: unchanged); FRD content_hash `d45f5d9c6f63fdfd7cca2e00d6197299522aa2568bae31e3a1c0155165b21105`; research content_hash `fab466e46fd043e9a49e1e88f648bd2463fea5c42ac2848a6883f3f13fed41f8`; base `2d52eeb`.

- slice-verifier: completed, **failed** (Decisions and Cross-slice violations; Research warnings). Reviewer-side hashing unavailable (Read/Grep/Glob only); parent recomputed.
- artifact-code-reviewer: completed, **failed** — 4 blockers, 15 concerns, 3 suggestions.
- artifact-coverage-reviewer: completed, **failed** — 17 blockers, 4 concerns, 1 suggestion.

Parent spot-verified against source: `project-storage-node-adapters.ts:839-865` (registration createdAt/activatedAt agreement and canonical create-request fingerprint at opening), `application-database-migration.ts:118-130` (`activated_at` agreement), `registration-confirmation-store.ts:266-272` (receipt generation lookup in `storage_generations`), `project-storage-opening-manifest.ts:44-54` (`provenance.createRequestId`), `project-storage-file-adapter.ts:58-80` (staging-only path, non-recursive project-root mkdir), `project-storage-node-adapters.ts:952-972` (create replay through `storage_generations`). All confirmed.

### Findings grouped by theme (one row per finding retained in the reviewer reports above; grouped here for triage)

| # | source | severity | theme | finding (condensed) | resolution |
|---|---|---|---|---|---|
| 1 | code, verifier | blocker | opening authority | New `created_at` for T and a non-canonical fingerprint break existing opening checks (`node-adapters.ts:843-865`, `:461`, opening-manifest `:52`); switch omits `storage_registrations.activated_at` (`application-database-migration.ts:124`). | |
| 2 | code, verifier | blocker | D2 side effects | Moving S's row out of `storage_generations` breaks registration receipt lookup (`registration-confirmation-store.ts:266`) and changes create replay from `created` to `blocked` (`node-adapters.ts:958-972`). | |
| 3 | verifier | blocker | file adapter | `createDirectoryExclusive` cannot create `.staging-<T>` or `snapshots/<id>` in an existing project root (`file-adapter.ts:58-80`); adapter missing from Affected source. | |
| 4 | code, verifier, coverage | blocker | fixture feasibility | Runtime fixture has constant `generationId` and clock; no `upgradeId` allocator; `failAt` typed `CreationCheckpoint` (`runtime-fixture.ts:104,129-143`). | |
| 5 | code, verifier, coverage | blocker | vacuous oracles | Only 3 canonical tables populated; `projectSequence`/waterline are 0; no waterline source exists. | |
| 6 | verifier, coverage | blocker | missing negative | No behavior makes verification fail (FR4/FR5). | |
| 7 | code, verifier, coverage | blocker | UPG-B6 red | Staging row already yields `recovery-required` (`opening.ts:59-76`); marker rule unprovable; failure codes unpinned; in-progress row never read. | |
| 8 | code, verifier | concern | UPG-B3 red | Extra-directory red is forced already by UPG-B1. | |
| 9 | coverage, code | blocker | manifest versions | Existing `manifestVersion: 2 → unsupported-newer` case (`open.integration.test.ts:491-497`) changes meaning; v3 and malformed v2 unpinned; v2 provenance lacks `createRequestId`; no v2 identity-conflict cases. | |
| 10 | coverage, verifier | blocker | registry 0007 | No oracle for in-place 0006→0007 with Storage rows; relationship rule breaks for chained upgrades; unobservable through Storage path; `harness-registration` command missing. | |
| 11 | coverage | blocker | eligibility | Rules not tested independently; index acceptance untested; runtime-health condition untested; broken/unavailable distinctness untested. | |
| 12 | coverage | blocker | backup | No integrity check on backup files (ADR 0005:19-20); backup manifest identity fields unpinned; ADR 0005:18 sequence/waterline undecided. | |
| 13 | coverage | blocker | opening negative | Extra unregistered directory after a completed upgrade not tested. | |
| 14 | code, verifier | concern | interface consumers | `ProjectStorageOwner` literals in `canonical-writer-package-smoke.integration.test.ts:446,876,938`; head pins in four more files. | |
| 15 | verifier | warning | successive upgrades | C1 schema-4 fails the canonical rebuild pin (`generated-migration-resources.ts:267-288,335-340`); "no extra engine work" is false. | |
| 16 | coverage, verifier | concern | concurrency / sync throw | No racing-upgrade or sync-throw/stop case. | |
| 17 | coverage | concern | generation cap | Cap semantics after the source row moves are undefined. | |
| 18 | verifier | warning | Effect, worker | No Effect-program statement; worker has no read-only open mode. | |
| 19 | all | suggestion | commands, anchors | `db:generate:check`, `check:duplicates`; snapshots scan already settled (`filesystem-authority.ts:193-204`); citation drift `application-schema.ts`. | |

Gate: **failed**. Not clean; awaiting user triage of the reopened decisions before revision and re-review.
