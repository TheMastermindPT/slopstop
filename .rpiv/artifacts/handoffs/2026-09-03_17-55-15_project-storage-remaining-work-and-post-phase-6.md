---
date: 2026-09-03T17:55:15+0100
author: Pedro Mesquita
commit: 3d138c3
branch: feat/ticket-87-project-storage
repository: slopstop-ticket-87
topic: "Project Storage Opening Feature Implementation"
tags: [implementation, project-storage, harness, electron, packaging]
status: complete
last_updated: 2026-09-03T17:55:15+0100
last_updated_by: Pedro Mesquita
type: feature_development
---

# Handoff: Complete Project Storage Phases 4-6

## Task(s)

- **Original task, in progress:** implement the accepted six-phase Project Storage plan end to end on `feat/ticket-87-project-storage`, using strict public-seam red-green-review/refactor slices. The source of truth is `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md`.
- **Phases 1-3, completed:** identities/protocol, harness dispatch, staged creation, durable witness refusal, exact replay/locking, migrations, mutation proof, and recovery evidence are implemented and verified. Do not redesign them while finishing opening.
- **Phase 4, in progress:** opening health, registry/filesystem recovery, and session lifecycle. Eleven real-libSQL opening cases pass. The final planned opening matrix and lifecycle suite are not complete.
- **Phase 5, not started:** Electron Main bridge and trusted bootstrap.
- **Phase 6, not started:** native packaging and packaged persistence proof.
- **User request for this handoff:** tell the next agent exactly what remains and what to do after Phase 6 is complete. The ordered checklist is in `Action Items & Next Steps`.

## Critical References

- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` - accepted implementation contract, test contracts, phase gates, and recovery ledger. Read Phase 4 at line 6637, Phase 5 at 8851, Phase 6 at 10474, and the live Phase 4 recovery ledger at 11941.
- `PRODUCT.md` - durable product truth and privacy/security intent.
- `CONTEXT.md` - required domain vocabulary. Also obey `.rpiv/decisions/degrade-distinguishes-broken.md`: a genuine failure must never degrade to clean absence.

## Recent changes

- `apps/harness/src/storage/project-storage-opening.ts:29-164` now owns recovery identity projection, clean-absence versus recovery decisions, registered incomplete/staging recovery, opaque release construction, and the internal opening evidence unions.
- `apps/harness/src/storage/project-storage-opening.ts:191-229` now calculates format/schema and migration compatibility and validates agreement between database metadata, manifest metadata, and supported authority.
- `apps/harness/src/storage/project-storage-opening.ts:345-370` now classifies probe evidence in the accepted order: identity conflict, newer, unknown, FK disabled, integrity/domain corruption, known older, healthy.
- `apps/harness/src/storage/project-storage-node-adapters.ts:375-421` changed identity inspection from exception-only validation to `databaseIdentityMatches`, allowing valid disagreement to reach public `identity-conflict` instead of collapsing to broken. Creation/sealed verification still rejects disagreement.
- `apps/harness/src/storage/project-storage-node-adapters.ts:902-956` joins registration, generation, direct normalized-path location, and filesystem evidence before clean absence; it returns recovery for no-registration witnesses, all-null active registration, and staging residue.
- `apps/harness/src/storage/project-storage-node-adapters.ts:958-1012` opens selected databases, validates database-manifest metadata agreement, emits decisive identity/newer/unknown facts before current-schema checks, and preserves strict corruption/broken catches.
- `apps/harness/src/storage/project-storage-node-errors.ts` and `.test.ts` recognize only exact `SQLITE_CORRUPT` and `SQLITE_NOTADB` as corruption; nearby, suffixed, absent, and unexpected codes do not widen to corrupt.
- `apps/harness/src/storage/project-storage-node-schemas.ts:17-24` owns SQLite integer scalar parsing, moved out of the large adapter to retain Code Health 10.0.
- `apps/harness/src/storage/project-storage-opening.test.ts:24-79` proves corrupt versus broken and compatibility precedence, including identity over newer/integrity, newer over unknown, corruption over known older, and unknown as broken.
- `apps/harness/tests/integration/project-storage-open.integration.test.ts:239-642` contains eleven public MessageChannel/opening cases: healthy mutable bytes, canonical missing, exact SQLite corruption, unexpected SQL broken, unsupported newer, identity conflict, filesystem-only recovery, clean absence, orphan location consistency, incomplete registration, and active-plus-staging recovery.
- `apps/harness/tests/integration/project-storage-open.integration.test.ts:128-174` provides the exact selected safe-mode oracle: full payload/identity, no path, Project close, rename probes for both generation databases before stop, and unchanged complete durable snapshot.
- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md:11941-11979` records Phase 4 evidence through active-plus-staging recovery. It is stale at 9 opening cases/186 unit tests and does not yet record unsupported-newer or identity-conflict.

## Learnings

- Work only in `C:\Users\pedro\AppData\Local\Temp\opencode\slopstop-ticket-87`. The shared workspace `C:\Users\pedro\Documents\GitHub\slopstop` must remain untouched.
- Current branch is `feat/ticket-87-project-storage`, current accepted base commit is `3d138c3`, and the Phase 4 files are intentionally uncommitted/untracked. Do not discard them.
- Latest verified state: opening integration 11/11; creation integration 60/60; `pnpm check` passes format, lint, all workspace typechecks, 187 unit tests, and package boundaries; `git diff --check` passes. All touched production/test files report Code Health 10.0.
- Application and generation local-libSQL pools must stay process-wide (`"application"` and `"generation"`). Per-client worker pools caused Windows hangs.
- Opening release and session close are asynchronous `Promise<void>` operations because the local libSQL client closes asynchronously. The developer explicitly chose `Follow the plan` for this plan/implementation mismatch.
- Opening must never compare mutable database bytes to activation baselines. Existing healthy proof mutates `PRAGMA user_version` only to demonstrate byte divergence without changing logical authority.
- Clean absence is legal only when application authority is genuinely absent and registration, generation, direct-location, and filesystem witness sets are all empty. Any witness yields recovery or a distinct failure.
- Application authority/integrity is top-level authority and must be checked before returning Project-specific selected, recovery, or absent evidence. Genuine application corruption/broken/unavailable must never become Project recovery or clean absence.
- The checked-in canonical migration directory currently has one migration. A practical real-libSQL `migration-required` fixture can set both database and manifest format/schema below supported while retaining the known migration ID; unknown migration IDs must remain broken.
- The current early compatibility probe uses valid placeholder success facts only when identity/newer/unknown already determines classification. Before expanding the probe matrix, keep the accepted classifier precedence pinned with pure tests and avoid making unknown evidence look current.
- Independent `task` review agents repeatedly inspected the primary workspace instead of this temp worktree, even when given an absolute path. They cited nonexistent files and stale line text. Verify every finding against the absolute temp-worktree path before acting. Direct reads proved the current exact payload at `project-storage-open.integration.test.ts:148-160`, close/rename at 162-170, and precedence at `project-storage-opening.test.ts:41-79`.
- `ctx7` is unavailable in this environment because Node `v26.5.0` conflicts with its required `24.19.0`. Do not silently claim current third-party documentation was retrieved.

## Artifacts

- `.rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` - updated accepted plan and recovery ledger.
- `.rpiv/artifacts/handoffs/2026-09-03_17-55-15_project-storage-remaining-work-and-post-phase-6.md` - this handoff.
- `apps/harness/src/storage/project-storage-opening.ts` - new Phase 4 domain decisions and release behavior.
- `apps/harness/src/storage/project-storage-opening.test.ts` - new pure opening classification tests.
- `apps/harness/src/storage/project-storage-node-adapters.ts` - new real Node/libSQL opening implementation.
- `apps/harness/src/storage/project-storage-node-errors.ts` - new exact Node/SQLite error-code classification.
- `apps/harness/src/storage/project-storage-node-errors.test.ts` - new exact positive/negative error-code tests.
- `apps/harness/src/storage/project-storage-node-schemas.ts` - new Phase 4 row schemas and scalar parsing.
- `apps/harness/tests/integration/project-storage-open.integration.test.ts` - new real-libSQL structured-clone opening suite.

## Action Items & Next Steps

1. Resume in the exact temp worktree and immediately run `git status --short`; confirm the eight listed Phase 4 files and plan changes remain present. Do not switch to or edit the primary workspace.
2. Update the Phase 4 recovery ledger at the end of the plan with the completed `unsupported-newer` and `identity-conflict` Red/Green/review/refactor evidence. Update the verification line from 9/9 and 186 to 11/11 and 187. Record that stale review-agent claims were rejected only after absolute-path verification.
3. Implement the rest of Phase 4 one public-seam slice at a time. For every behavior: focused failing test, minimal implementation, focused Green, independent actual-worktree review, refactor/CodeScene gate, then ledger entry.
4. Add real `migration-required`: database and manifest agree on known older format/schema; canonical health is exact migration-required while runtime remains healthy; no mutation; full identity; close and both rename probes before stop.
5. Add unknown and contradictory metadata cases: unknown migration, mixed older/newer version directions, metadata key/kind mismatch, and database-manifest disagreement must remain exact broken, never migration-required or unsupported-newer.
6. Add real integrity precedence: corrupt/integrity-invalid authority must beat migration-required. The pure precedence test exists, but the Node probe still needs real foreign-key/integrity facts instead of converting every `ProjectStorageBrokenError` to broken.
7. Add per-database `unavailable`: access/open failures must map to `DATABASE_UNAVAILABLE`, independently for canonical and runtime, without widening ENOENT to unavailable or leaking paths/caught text. Keep application-database unavailable as top-level owner failure, not per-database safe mode.
8. Complete independent runtime health: canonical healthy with runtime missing, corrupt, broken, identity-conflict, migration-required, unsupported-newer, and unavailable. Runtime probing may inspect only SlopStop-owned adapter tables plus SQLite facts, never Mastra-private schema.
9. Implement the selected-manifest matrix. Missing, malformed/corrupt, unavailable, unsupported-newer, and internally contradictory manifest outcomes must use the exact plan status/diagnostic and release behavior rather than collapsing through the outer top-level broken catch.
10. Complete registry/filesystem opening authority: incomplete active generation/location, sole orphan generation with only known identity fields, multiple/contradictory active authority, exact ordinary generation directory, root-level database/sidecar witnesses, tombstone, unfinished operation, symlink/type errors, and bounded witness cardinality. Recovery states must preserve all and only trustworthy identity fields.
11. Add the application authority ordering matrix from the plan, including integrity corruption before Project recovery/absence. Confirm opening never creates absent `application.db`.
12. Add shared application-client initialization tests across Projects: one deferred initialization, shared failure, close of the failed client, clearing only the failed promise, and exactly one successful retry.
13. Create `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts`. Cover repeated open/reopen, multiple retained sessions, close of one Project only, last-session release, close without session, admitted operations draining during stop, late operations rejected, canonical-before-runtime release, attempted-all ordered aggregate failures, registry-close failure, and one retained idempotent stop Promise.
14. Run the complete Phase 4 gates from plan lines 8828-8847: opening integration, lifecycle integration, pure opening/adapter tests, store regression, 60 creation integrations, harness typecheck, boundaries, architecture, manual privacy/authority inspection, and separate review/refactor with no unresolved blocker. Only then check Phase 4 success criteria and proceed.
15. Implement Phase 5 exactly from plan line 8851. Main deliverables are the Electron Main Project Storage bridge, trusted root/bootstrap derivation, immutable parsed bootstrap reuse, fresh MessagePort per child spawn, supervisor retry/shutdown lifecycle, bounded JSONL logs, Sentry opt-in sanitization, migration resource staging, process composition, and idempotent Desktop shutdown.
16. Keep renderer/preload/IPC public surface unchanged in Phase 5. Project Storage must expose no renderer method, channel, Electron object, Node API, database client, or local path. Run all Phase 5 commands and manual checks at plan lines 10447-10470, including Desktop mutation proof and production process-bootstrap integration.
17. Do not enter Phase 6 until every Phase 1-5 automated/manual/review gate is evidenced. Phase 6 is an admission-gated packaging phase, not a place to repair earlier behavior.
18. Implement Phase 6 exactly from plan line 10474: native dependency ownership/staging, Forge ASAR/unpack ordering, packaged migration resources, strict package-smoke bootstrap guards, bridge-only storage smoke API, healthy/recovery persistence scenarios, child-close-before-cleanup discipline, no renderer API expansion, and idempotent quit/failure shutdown.
19. Run every Phase 6 success criterion at plan lines 11536-11559: renderer boundary lock, migration reproducibility, both mutation gates, Desktop typecheck, `pnpm check`, full integration, architecture, `pnpm package:smoke`, independent review/refactor, `pnpm check:deep`, and final `/rpiv:validate` against the accepted plan.
20. After Phase 6 is complete, update every applicable phase checkbox and the recovery ledger with exact command counts/results. Do not mark a criterion complete from intent or a partial command.
21. After Phase 6 is complete, run a final whole-branch review against the accepted base/merge-base, verify every finding against this worktree, fix all blocker/concern regressions, and repeat the affected package/integration/deep/package-smoke gates.
22. After Phase 6 is complete, run `/rpiv:validate .rpiv/artifacts/plans/2026-08-31_21-44-55_87-project-storage-opening.md` again if any post-review code or evidence changed. The final validation artifact must show all phases and success criteria satisfied.
23. After Phase 6 is complete, inspect `git status`, `git diff`, `git diff --check`, and recent history. Stage only intended ticket-87 files and artifacts; never stage credentials, generated local databases, userData, logs, package output, or unrelated concurrent changes.
24. Do not commit, merge, push, or delete branches/worktrees without explicit user authorization. If authorized, use the structured commit workflow, preserve logical commit boundaries, run hooks normally, and report commit hashes. Never amend or force-push unless explicitly requested.
25. After authorized integration, confirm `feat/ticket-87-project-storage` has no unique unmerged commits before removing its temporary worktree or deleting obsolete branches. Never force-delete useful work. Leave `C:\Users\pedro\Documents\GitHub\slopstop` clean and on the user's intended branch.
26. Finish with a concise delivery report: implemented behavior, exact passing gates/counts, packaged proof location/result, validation artifact, commits/PR if authorized, known residual risks, and whether ticket 87 can be closed.

## Other Notes

- Fast gate: `pnpm check`; deep gate: `pnpm check:deep`; architecture: `pnpm check:architecture`; package proof: `pnpm package:smoke`.
- Focused opening command: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-open.integration.test.ts`.
- Focused creation regression: `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/project-storage-create.integration.test.ts`.
- Relevant mutation gates: `pnpm test:mutation:project-storage:harness` and, after Desktop work, `pnpm test:mutation:project-storage:desktop`.
- Phase 3's recorded harness mutation result was 92.18% with zero `NoCoverage`; do not weaken thresholds or tests to preserve it.
- Keep diagnostics stable and path-free. Never include source text, prompts, environment values, migration SQL, database content, caught error text, full local paths, harness stdout/stderr, or process error locations in protocol output, logs, or Sentry.
- `safe-mode` retains only an opaque release handle and exposes no mutating method. Every opened client must be attempted exactly once during close/stop even when another release fails.
