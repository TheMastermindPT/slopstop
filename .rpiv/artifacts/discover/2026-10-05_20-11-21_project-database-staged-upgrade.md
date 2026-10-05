---
date: 2026-10-05T20:11:21+0100
author: Pedro Mesquita
commit: 2a19d40
branch: main
repository: slopstop
topic: "Automatic staged upgrade of an existing Project database (Conversation C1-0)"
tags: [intent, frd, storage, migration, conversation, c1-0, adr-0005]
status: complete
register: plain
consensus: confirmed
last_updated: 2026-10-05T20:11:21+0100
last_updated_by: Pedro Mesquita
content_hash: d45f5d9c6f63fdfd7cca2e00d6197299522aa2568bae31e3a1c0155165b21105
---

# FRD: Automatic staged upgrade of an existing Project database (Conversation C1-0)

## Summary
When the app changes how a Project's data is stored (first case: the Conversation tables arriving in `slopstop.db`, schema version 3 to 4), opening an older Project upgrades it automatically. The upgrade backs the data up, prepares and verifies an upgraded copy, then switches to it in one step, so the user keeps working as if nothing happened. This is a reduced form of ADR 0005's forward migration; the full ADR 0005 journal must be completed later.

## Problem & Intent
In the user's words: "Eu, a usar a app" — "Abro um projeto antigo depois de uma atualização e quero continuar a trabalhar como se nada fosse."

Unacceptable at that moment (all four chosen by the user): losing data ("Perder dados"), waiting long ("Esperar muito"), having to do something ("Ter de fazer algo"), failing silently ("Falhar em silêncio").

Without this, every Project registered before Conversation C1 opens in read-only safe mode (`migration-required`) and can no longer save anything (`apps/harness/src/storage/project-storage-opening.ts:374-389`, `apps/harness/src/active-project-coordinator.ts:452-459`).

## Goals
- An older Project opens normally after an app update, with no user action.
- No data is ever lost or changed by the upgrade.
- Any failure is visible, explained, and leaves the old data intact and readable.
- An interrupted upgrade recovers by itself on the next opening.
- The mechanism serves future additive schema changes, not only Conversation.

## Non-Goals
- The full ADR 0005 Storage-operation journal and Effect intent records (deferred, mandatory follow-up).
- Non-additive migrations (column changes, data rewrites, table removals).
- Downgrades, restore from backup, user-facing backup management, automatic deletion of old generations or backups.
- Migration of `mastra.db` contents (it is copied unchanged if present in the generation).

## Functional Requirements
1. The system SHALL detect, when activating a Project, that its canonical database is a known older schema with a packaged forward path, and SHALL upgrade it automatically without asking the user.
2. Before touching anything, the system SHALL create a database-native backup of the Project's current generation and SHALL record a durable "upgrade in progress" marker identifying the source generation and the target generation.
3. The system SHALL build the upgraded databases in a staging location as a new Storage generation with the same `ProjectId` and a new `StorageGenerationId` (ADR 0006), applying only the packaged additive migrations.
4. Before switching, the system SHALL verify that (a) every pre-existing table has exactly the same content as the source (row count and content fingerprint), (b) the new schema is complete and matches the packaged specification, and (c) SQLite integrity checks pass.
5. The system SHALL switch the active generation in one authoritative step, and only after verification succeeds.
6. After switching, the Project SHALL open read-write exactly as a Project created at the current version would.
7. If any step before the switch fails, the system SHALL discard the staging output, keep the source generation active and unchanged, open the Project read-only, and show: "Não foi possível atualizar este projeto. Os teus dados estão intactos." with the actual reference code and a "Tentar outra vez" action. (Wording is final in meaning; the shipped UI language follows the product's UI language.)
8. "Tentar outra vez" SHALL repeat the whole upgrade from the start.
9. On the next opening after an interruption, the system SHALL use the marker to recover without asking: if the switch did not happen, discard the staging output and restart the upgrade; if the switch happened, confirm the new generation and continue. It SHALL never fall back silently to the older generation.
10. The system SHALL keep the new active generation, the immediately prior generation and the pre-upgrade backup; nothing is deleted automatically (ADR 0005 retention).
11. While the upgrade runs, the window SHALL show "A atualizar o projeto…" instead of a bare busy state.
12. Opening SHALL accept a Project that keeps its prior generation and backup after an upgrade (today opening requires exactly one generation and reports recovery-required otherwise).

## Non-Functional Requirements
- **Performance**: target under 2 seconds for a normal Project, measured by a test; this is a tolerant first target and the user wants it under 1 second eventually.
- **Security**: backups and generations stay under Electron `userData`; no paths, data or content leave the machine; diagnostics follow existing redaction rules.
- **UX / Accessibility**: no prompts on the success path; the progress text and the failure message are reachable by keyboard and screen reader; the reference code is the real code.
- **Reliability**: busy and broken stay distinct (degrade-distinguishes-broken); every failure has a distinct diagnostic; Windows file handles are released explicitly before any rename, with no forced garbage collection; interruption at any step leaves an openable Project.

## Constraints & Assumptions
- ADR 0005 permits non-interactive, data-preserving migration to run automatically (`docs/adr/0005-storage-lifecycle-and-recovery.md:20`) and requires keeping the active and prior generation plus pre-migration backups (`:26`).
- This reduced form replaces ADR 0005's general journal with a single upgrade marker; an ADR 0005 amendment must record this as temporary.
- Existing staged-creation machinery is reused where possible: staging directory, exclusive manifest write, `verifySealed`, hashing and `renameAtomic` (`apps/harness/src/storage/project-storage-store.ts:334-458`, `apps/harness/src/storage/project-storage-file-adapter.ts:132-163`).
- Known blockers to change: the manifest allows only `initial-create` provenance (`project-storage-manifest.ts:37-42,62-63`); `activateRows` activates only an unactivated registration (`project-storage-node-adapters.ts:1284-1289`); registry `creation_state` and the relationship check assume one active generation (`project-storage-database-specs.ts:427-428,888`, `application-database-migration.ts:126-128`); opening requires exactly one generation (`project-storage-node-adapters.ts:1035-1046`); `pendingMigrations` refuses a version change (`generated-migrations.ts:67-72`); the rebuild pin accepts only schema versions 2 and 3 (`generated-migration-resources.ts:252-339`).
- The database worker uses `node:sqlite` with explicit close and the default rollback journal (`local-libsql-worker-client.ts:213,238-269`).
- Assumption: Project databases are small; there are no measured sizes yet.
- New harness code follows the Effect conventions; new SQL runs as Effect programs over the database worker.

## Acceptance Criteria
- [ ] An integration test opens a v3 Project under a v4 build: activation answers read-write, the Conversation tables exist, and every pre-existing table's rows equal the source rows.
- [ ] The same test finds a pre-upgrade backup and the prior generation on disk after the upgrade.
- [ ] For each injected failure point (backup, migrate, verify, before switch, after switch) the integration test shows the documented outcome: before the switch, the Project opens read-only with `Não foi possível atualizar este projeto. Os teus dados estão intactos.` and its reference code, with source data unchanged; after the switch, the Project opens read-write on the new generation.
- [ ] An interruption test (process stopped mid-upgrade, then reopened) ends with an openable Project and no leftover staging output, without user input.
- [ ] "Tentar outra vez" after an injected one-time failure completes the upgrade.
- [ ] A timing test records the upgrade duration of a representative Project and passes under 2 s.
- [ ] An Electron E2E journey shows "A atualizar o projeto…" during the upgrade and then the normal Project view.
- [ ] `pnpm check` passes; touched integration projects pass; CodeScene 10 on touched files; jscpd 0.

## Recommended Approach
A harness-side upgrade step inside Project activation (`storage.acquireActivation`, before the writer is created) that reuses the staged-creation pipeline to build, verify and atomically activate a new Storage generation from a backed-up source, coordinated by one durable upgrade marker in the installation registry, plus registry/manifest/opening changes to allow successive generations.

## Decisions

### Who the upgrade serves
**Question**: What problem must option A solve, for whom, and how do you know it went well?
**Recommended**: n/a — `intent` question
**Chosen**: "Eu, a usar a app" — open an old Project after an update and keep working as if nothing happened.
**Rationale**: the user's own framing of success.

### Unacceptable outcomes
**Question**: What would be unacceptable at that moment?
**Recommended**: n/a — `intent` follow-up
**Chosen**: losing data, waiting long, having to do something, failing silently.
**Rationale**: the four constraints that bound every later choice.

### Runs automatically
**Question**: ADR 0005 already allows a data-preserving upgrade to run without asking. Keep it?
**Recommended**: keep automatic.
**Chosen**: keep — runs on its own.
**Rationale**: evidence: `docs/adr/0005-storage-lifecycle-and-recovery.md:20` + confirmed; matches "Ter de fazer algo" being unacceptable.

### Nothing deleted automatically
**Question**: ADR 0005 keeps the current version, the prior version and the pre-upgrade backup until the user deletes them. Keep it?
**Recommended**: keep.
**Chosen**: keep — nothing is deleted.
**Rationale**: evidence: `docs/adr/0005-storage-lifecycle-and-recovery.md:26` + confirmed; safest, and the databases are small.

### Show progress
**Question**: Opening shows only a busy state with no time limit. Keep it during the upgrade?
**Recommended**: show what it is doing.
**Chosen**: change — show "A atualizar o projeto…".
**Rationale**: evidence: `apps/desktop/src/renderer/projects-workspace.tsx:140-146` + corrected; avoids looking frozen.

### How much of ADR 0005 to build now
**Question**: Full ADR 0005 journal (5–6 slices), reduced A with a single upgrade marker (~3 slices), or in-place with backup (~1 slice)?
**Recommended**: reduced A.
**Chosen**: reduced A — "é importante salientar que depois teremos que completar".
**Rationale**: reuses the staged-creation code and keeps the ADR 0006 generation model at about half the cost; the full journal is a mandatory follow-up.

### On failure
**Question**: If the upgrade fails, what happens to the Project?
**Recommended**: open read-only with a message, reference code and "Tentar outra vez".
**Chosen**: as recommended.
**Rationale**: the user can still read the data and the failure is never silent.

### On interruption
**Question**: If the app closes or the computer shuts down mid-upgrade?
**Recommended**: restart automatically; confirm a completed switch; never fall back silently.
**Chosen**: as recommended.
**Rationale**: no user action, no data loss.

### What verification proves
**Question**: What must verification prove before switching?
**Recommended**: identical old data, complete new schema, integrity.
**Chosen**: as recommended.
**Rationale**: "Perder dados" is the top constraint; a content comparison proves nothing changed.

### Time target
**Question**: Teach-back assumption of under 2 s for a normal Project.
**Recommended**: under 2 s, measured by a test.
**Chosen**: 2 s now — "isto é só uma meta muito tolerante", aiming below 1 s eventually.
**Rationale**: no measurements exist yet; tighten after measuring.

## Open Questions
- None deferred by the user.

## Suggested Follow-ups
- **Mandatory:** complete ADR 0005's Storage-operation journal and Effect intent records, replacing the single upgrade marker (`docs/adr/0005-storage-lifecycle-and-recovery.md:14-16`); track it as a GitHub issue once the user authorizes creating it.
- Amend ADR 0005 to record the reduced form as temporary.
- Tighten the upgrade time target toward under 1 s once real sizes are measured.
- ADR 0006 still references Zod and `mastra.db` (`docs/adr/0006-physical-persistence-layout.md:16,22,103,122`).

## Glossary
| Term | What it means here |
|---|---|
| Schema / estrutura | The list of tables and columns a database has; a new app version may add tables. |
| Generation (versão dos dados) | One complete, self-contained copy of a Project's databases; an upgrade creates a new one and keeps the old one. |
| Staging (cópia preparada) | A temporary folder where the new generation is built before it is used. |
| Atomic switch (trocar de uma vez) | Changing which generation is active in a single step, so it is never half-done. |
| Backup (cópia de segurança) | A copy taken before the upgrade, kept until the user deletes it. |
| Upgrade marker (marca "a atualizar") | A small durable record saying an upgrade is in progress, used to recover after an interruption. |
| Journal (diário) | ADR 0005's full record of every storage operation step; deferred. |
| Safe mode / só de leitura | The Project opens for reading only; nothing can be saved. |
| Integrity check | SQLite's own check that the database file is not damaged. |
| Fingerprint (impressão digital) | A short code computed from a table's content; equal codes mean equal content. |

## Shared Understanding
**Agreed model (in the developer's words):** "Abro um projeto antigo depois de uma atualização e quero continuar a trabalhar como se nada fosse." The app shows "A atualizar o projeto…", backs up, prepares and verifies a new copy, and switches at once; on failure the data is intact and the Project opens read-only with "Tentar outra vez"; an interruption recovers by itself; nothing is deleted.

**Corrected during teach-back:** nothing — the model was confirmed as first stated; the 2 s target was qualified as tolerant, with under 1 s as the eventual goal.

**Residual uncertainty (accepted):** no measured database sizes yet; "Tentar outra vez" repeats the whole upgrade; the full journal becomes a GitHub issue only after the user authorizes it.

## References
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` (section 4: option A)
- `.rpiv/artifacts/handoffs/2026-10-05_conversation-c1-local-save-brief.md`
- `docs/adr/0005-storage-lifecycle-and-recovery.md`, `docs/adr/0006-physical-persistence-layout.md`, `docs/adr/0013-effect-reconciliation-and-recovery-journal.md`
- `.rpiv/artifacts/designs/2026-08-31_16-37-32_project-storage-opening.md`
