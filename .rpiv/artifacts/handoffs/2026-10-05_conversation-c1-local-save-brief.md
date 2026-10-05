---
date: 2026-10-05
author: coordenador-claude (Claude Code), for the implementer agent
repository: slopstop
status: approved-to-plan
tags: [conversation, c1, local-save, persistence]
---

# Brief: Conversation C1 — save and reopen messages locally, no model

## Authority

- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` (user decisions of 2026-10-05; section 3 fixes this slice as "save and reopen with no model").
- `.rpiv/artifacts/evidence/2026-09-12_pc-s1-intent-v1-brief.md`: "Proposed ownership", "Inherited and settled", "Proposed product behavior" and the Conversation contract paragraph at the end of "Next Slice". These are the inherited requirements for this slice.
- ADR 0006 (Conversation tables in the Project database, outside canonical sequence/revision/event authority; tables only with their first behaviour), ADR 0004 (the primary Project conversation never enters Board), ADR 0009 Amendment 1 (SlopStop owns all history).
- `PRODUCT.md`, `CONTEXT.md`, AGENTS.md architecture and test discipline.

## Scope

1. The primary Project conversation of the active Project: the user writes a message, saves it locally, and sees it again after switching Projects and after an app restart.
2. Explicit local-save wording ("Save locally") with a visible note that no model is connected yet. "Saved" appears only after durable acknowledgement, never on transport success. Authored text stays recoverable in the UI while a save is pending or failed.
3. A truthful protocol contract for local save. The existing `conversation.message.submit` intent requires a Context proposal and reports "forwarded" (`packages/protocol/src/workspace-protocol.ts`); do not fabricate a Context proposal and do not read "forwarded" as saved. Propose the contract in the plan.
4. Out of scope: any model call, dummy reply or Context record; branches; attachments; Waypoint conversations; durable unsubmitted drafts; Frame.

## Required behaviour (contract)

- Save and reopen preserve message identity, text and order (cursor).
- An exact retry returns the original save result, with no duplicate.
- An explicit revision conflict is reported as such.
- An uncertain commit is reconciled against its own durable identity, never resubmitted with a new identity.
- No premature "saved" status.
- Cross-Project and stale-activation submissions are rejected.
- Project switch and close drain admitted Conversation work; new work is refused after admission closes.
- Saving a message never advances the canonical command sequence, revision or events.
- No synthetic model response and no acceptance authority.
- Busy and broken storage stay distinct (degrade-distinguishes-broken).

## Questions to answer in the plan (not decisions to take alone)

- **Existing Projects and the new tables.** `project-storage-opening.ts` classifies a known-older Project schema as `migration-required` safe mode, and there is no approved forward migration for Project databases. Adding Conversation tables could put every already-registered Project into safe mode. State exactly what happens to a Project created before C1 and propose options; the user decides.
- Where the Conversation owner sits relative to the active-Project coordinator queue and the database worker.
- The protocol contract for local save and for reading the conversation.

## Method

- Feature branch from current main (ask the user through your ask tool). Effect conventions for new harness code and SQL (Effect programs over the `node:sqlite` database worker), Effect Schema with the strict decode policy in protocol; desktop and renderer keep their pattern.
- Plan first, no code: 3–7 vertical slices, each with behaviour, public seam, files and risks. Wait for approval.
- Per slice: failing behaviour test at the agreed seam, minimal implementation, green, separate review/refactor. Read the gates before every commit. CodeScene 10 on touched files, jscpd 0.
- Real-I/O tests go to the integration projects (standing reclassification rule). Electron journeys in `apps/desktop/tests/e2e/`.
- Gates: `pnpm check`, touched suites, touched integration projects, e2e; report what was not run. No `--no-verify`; no timeout or oracle changes.
- Product questions go to the coordinator.
