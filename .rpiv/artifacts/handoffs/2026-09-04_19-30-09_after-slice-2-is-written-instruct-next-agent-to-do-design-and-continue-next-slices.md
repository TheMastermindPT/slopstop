---
date: 2026-09-04T19:30:09+0100
author: Pedro Mesquita
commit: 59fb35b
branch: main
repository: slopstop
topic: "Canonical Project Writer Design Continuation"
tags: [design, project-writer, canonical-storage, typed-command, fencing, protocol]
status: complete
last_updated: 2026-09-04T19:30:09+0100
last_updated_by: Pedro Mesquita
type: feature_development
---

# Handoff: Continue Canonical Project Writer Design After Slice 2

## Task(s)

- **Completed:** Strengthened the architecture for GitHub issue #90, Canonical Project Writer, and obtained approval for the seven-slice decomposition.
- **Completed:** Designed, adversarially verified, checkpointed, and locked Slice 1, Correlated Request Failure. It establishes protocol version 4, causation-required `request.failure`, null-only `system.failure`, and real MessagePort proof.
- **Completed:** Designed, generated, tested at the design-proof level, adversarially verified, checkpointed, and locked Slice 2, Canonical Generation 2. The approved contract is in `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md:611-652`.
- **Work in progress:** Continue the same `/design` workflow with Slice 3, Exclusive Activation. No Slice 3 architecture or Test Contract has been generated yet.
- **Planned:** Generate, independently verify, present, and lock Slices 3-7 one at a time; finalize the design artifact; then produce a phased implementation plan only after design acceptance.
- **Explicit boundary:** This session performed design work only. Do not implement product behavior until the full design and plan are accepted.

## Critical References

- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` - active design, locked Slice 1 and Slice 2, decisions, file map, and remaining slice placeholders.
- `.rpiv/artifacts/research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md` - primary research input and traced current-state evidence.
- `docs/adr/0006-physical-persistence-layout.md` - binding persistence, fencing, settlement, and ordering authority.

## Recent changes

- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md:611-652` - replaced the blank Slice 2 placeholder with its complete affected-file list, five exact red-green behavior contracts, generated-file exemptions, automated gates, and manual checks.
- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md:879-886` - recorded Pedro's Slice 2 approval and marked Slice 2 locked in Design History.
- `.rpiv/tmp-slice2/canonical-schema.ts:28-43` - strengthened persisted numeric constraints with SQLite `typeof(column) = 'integer'` plus positive/nonnegative JavaScript safe-integer bounds.
- `.rpiv/tmp-slice2/canonical-schema.ts:44-566` - holds the exact design-only Drizzle proposal for the generation-2 canonical schema.
- `.rpiv/tmp-slice2/drizzle/canonical/0001_canonical_project_writer.sql:1-489` - regenerated the proposed successor migration after the integer-storage fix.
- No product source file under `packages/` or `apps/` was edited for issue #90.

## Learnings

- The current exact-schema verifier checks table names, named checks, indexes, and foreign keys, but not ordered column definitions. Slice 2 therefore adds an ordered `ColumnSpec` to `DatabaseSpec` and reads `pragma_table_xinfo(?)` to compare position, name, declared type, nullability, default, primary-key position, and hidden/generated state.
- Exact column mismatch diagnostics are locked as `Database required column definition is missing.` and `Database contains an unexpected column definition.`
- SQLite integer affinity alone accepts fractional values. Every persisted Writer generation, Project sequence, event ordinal, command/event version, and aggregate version check must require SQLite storage class `integer` as well as the correct safe-integer bounds.
- The approved final schema has 11 tables, 15 named indexes, and 11 foreign keys: `schema_metadata`, Project-scoped `storage_identity`, `project_state`, four Writer authority/recovery tables, and four command settlement/event tables.
- A real in-memory SQLite proof applied checked-in `0000` plus proposed `0001`, inserted `project_state` before `storage_identity`, and returned `{ "tables": 11, "foreignKeys": [], "integrity": "ok", "fractionalRejected": true }`.
- `writer_recovery_records` has 10 columns. `commit-uncertain` requires a command ID and fingerprint and resolves to `receipt-found | receipt-absent`; `abandoned-active-fence` requires both command fields null and resolves to `generation-superseded`; the resolving generation must exceed the abandoned generation.
- Canonical metadata advances to format 1, schema 2, migration `0001_canonical_project_writer`. Generation-1 Projects remain valid historical storage but opening them returns `DATABASE_MIGRATION_REQUIRED` without migration or mutation.
- Checked-in `apps/harness/drizzle/canonical/0000_fat_doctor_octopus.sql` must remain byte-identical. Its SHA-256 is `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`.
- Fresh creation must insert `project_state` after applying migrations and before inserting `storage_identity`, because identity now references Project state.
- Slice 2's affected test fixtures are explicitly named even though tests do not receive Architecture/File Map entries: `packages/kernel/src/project-storage-identifiers.test.ts`, `apps/harness/src/storage/project-storage-node-adapters.test.ts`, `apps/harness/tests/integration/project-storage-schema-cases.ts`, `apps/harness/tests/integration/project-storage-create.integration.test.ts`, and `apps/harness/tests/integration/project-storage-open.integration.test.ts`.
- The first Slice 2 verifier pass found three issues: fractional SQLite values, temp-only wrong import paths, and incomplete affected-file/test-fixture coverage. All were corrected; the second `rpiv:slice-verifier` pass reported no remaining violations.
- Current Drizzle documentation was retrieved with `pnpm dlx ctx7@latest`; direct `npx ctx7@latest` failed because npm rejected the repo's `devEngines` declaration.

## Artifacts

- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` - active design artifact updated through approved Slice 2.
- `.rpiv/tmp-slice2/canonical-schema.ts` - exact design-generation Drizzle schema proposal; design scratch only.
- `.rpiv/tmp-slice2/schema-metadata-columns.ts` - local generation-sandbox copy preserving target-relative imports.
- `.rpiv/tmp-slice2/storage-schema-constraints.ts` - local generation-sandbox copy preserving target-relative imports.
- `.rpiv/tmp-slice2/drizzle.config.ts` - temporary Drizzle generation configuration.
- `.rpiv/tmp-slice2/drizzle/canonical/0001_canonical_project_writer.sql` - generated proposed migration.
- `.rpiv/tmp-slice2/drizzle/canonical/meta/_journal.json` - generated two-entry migration journal proposal.
- `.rpiv/tmp-slice2/drizzle/canonical/meta/0000_snapshot.json` - copied generation-1 baseline snapshot used by the generator.
- `.rpiv/tmp-slice2/drizzle/canonical/meta/0001_snapshot.json` - generated generation-2 snapshot proposal.
- `.rpiv/artifacts/handoffs/2026-09-04_19-30-09_after-slice-2-is-written-instruct-next-agent-to-do-design-and-continue-next-slices.md` - this handoff.

## Action Items & Next Steps

1. Start a fresh session and run `/rpiv:resume-handoff .rpiv/artifacts/handoffs/2026-09-04_19-30-09_after-slice-2-is-written-instruct-next-agent-to-do-design-and-continue-next-slices.md`.
2. After resuming, invoke `/design` against `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` and explicitly continue from **Slice 3: Exclusive Activation**. Do not restart discovery, research, or the slice decomposition.
3. Read `PRODUCT.md`, `CONTEXT.md`, `.rpiv/decisions/degrade-distinguishes-broken.md`, and the relevant portions of ADR 0006 before naming Slice 3 contracts.
4. Inspect the current lease packaging, Project Storage lifecycle/store, process bootstrap, harness runtime, and protocol seams named in Slice 3's existing Files line.
5. Design exact interfaces and working code shape for the native lease adapter, retained Writer, active-Project coordinator, activation protocol/application mapper, durable generation/token activation transaction, companion-file authority, and composition root.
6. Pin Slice 3 red-green behavior through public seams. At minimum cover writable activation, real contention degrading only on `tryLock() === false`, distinct open/lock/unlock/close failures, generation/token persistence, read-only command denial, stale-fence rejection, and startup inactive state. Keep Safe Project Switching behavior in Slice 4.
7. Dispatch `rpiv:codebase-analyzer` while generating Slice 3, then dispatch `rpiv:slice-verifier` with all locked Slice 1-2 contracts and cross-slice symbols. Resolve every violation before the developer checkpoint.
8. Present the required per-slice developer checkpoint with file-by-file interface summaries, key code snippets, and the exact Test Contract. Wait for Pedro's approval before locking Slice 3 or generating Slice 4.
9. Repeat the same generate -> independent verify -> checkpoint -> approval sequence for Slices 4-7, preserving all approved prior slices verbatim except explicitly approved cross-slice corrections.
10. Finalize and validate the design artifact, including complete Architecture entries and File Map consistency, then produce the phased plan. Do not implement product code in this continuation.

## Other Notes

- The approved seven-slice order is: Correlated Request Failure; Canonical Generation 2; Exclusive Activation; Safe Project Switching; Atomic Typed Settlement; Uncertain Commit Recovery; Packaged Cross-Process Proof.
- Slice 3's current placeholder Files line is at `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md:654` and already names protocol, lease, Writer, coordinator, application, manifest/filesystem/store, runtime/bootstrap/index, native dependency, Desktop staging, workspace catalog, and lockfile targets. Expand it if the exact red tests require additional fixtures.
- `ActiveProjectCoordinator` is the sole session-scoped active-Project authority. Restart starts inactive. `project.open` remains inspection; `project.activate` owns admission, retained Writer ownership, and a fresh `ProjectActivationId` for read-write or read-only activation.
- Writer authority combines a held `fs-native-extensions` exclusive byte-range lock `[0, 1)` on a dedicated companion file with a durable positive Writer generation and SHA-256 token digest. `tryLock() === false` alone means cooperative contention; opening, locking, unlocking, or closing errors are broken diagnostics and must not degrade to read-only.
- A contending process may activate read-only but receives no Writer or write repository. Every Typed command under that activation later returns stable `WRITER_UNAVAILABLE` without entering command-specific work.
- Switching is deliberately Slice 4: close admission, drain at most the currently admitted bounded settlement, release A, and acquire B only after successful release. Release failure retains A and prevents any B acquisition.
- Settlement and uncertainty behavior are deliberately deferred to Slices 5-6. Do not pull command mutation, receipts/events, or commit quarantine into Slice 3 beyond interfaces genuinely required for activation.
- RPIV write hooks repeatedly reported `Node executable unavailable`; manual Node and pnpm commands worked. Re-run artifact validation hooks in the next environment if available rather than weakening any gate.
- Do not run mutation tests unless Pedro explicitly requests them.
- Safety stashes still exist and must not be dropped or applied without explicit instruction: `stash@{0}` `safety: detached workspace browser artifacts 2026-09-04`; `stash@{1}` `safety: detached workspace before main switch 2026-09-04`; `stash@{2}` `safety: pre-main-update deletions 2026-09-04`.
