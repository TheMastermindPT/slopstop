---
date: 2026-10-03
author: coordenador-claude (Claude Code), for Pedro Mesquita
branch: main
repository: slopstop
status: decided
---

# PC-S1 guarantee scope, application.db oracle change and checkpoint commits — Human Decisions

Three explicit user decisions given to the coordinator on 2026-10-03, after the coordinator presented options with their concrete user-facing losses. They clarify pending work; they do not rewrite the frozen PC-S1 v1–v4 briefs or historical reviews.

## 1. PC-S1 guarantee scope

The user accepted the coordinator's recommendation ("estou ok em relação às tuas sugestões para a lista de garantias").

**Retained unchanged (data and trust):** no repository mutation and no application-issued network/credential/hook commands (PC-B9); Git configuration and raw diagnostics never persisted, logged or sent to models; linked worktrees share one Project and clones stay separate (PC-B2 identity rule); one Project per common directory across concurrent processes (PC-B3); interrupted creation never fabricates success nor deletes data (PC-B6 core); failures never shown as an empty list or healthy state (PC-B7); old Projects preserved in safe mode and no registry reset (PC-B8); per-selection trust and two-stage Git consent (PC-B9/B10, already built).

**Changed for PC-S1:**

- **B1 — Additional worktree association deferred.** D4/D10 `identity.workspace.attach`, its three rejection codes and the concurrent-association matrix leave PC-S1. Selecting a linked worktree of an existing Project reports that it belongs to Project P and that adding further worktrees is not yet supported. It must never create a second Project or overwrite A's location. Loss: one worktree per Project until the later feature.
- **B2 — Interrupted-creation recovery: detect and show only.** Incomplete/recovery-required states stay visible and truthful; no recovery flow or button in PC-S1. Loss: a crash mid-registration leaves that repository blocked until the recovery feature. No data loss.
- **B3 — Observer limit matrices reduced.** Limits and precedence rules stay identical; tests cover one case per limit and one precedence combination per family instead of every boundary permutation. Loss: an edge case may surface a less precise code; no data risk.
- **B4 — Linux out of PC-S1.** PC-S1 is declared Windows-only; Linux returns the existing explicit `IDENTITY_CAPABILITY_UNAVAILABLE`, never an implied pass. Loss: no Linux support until its own conformance proof.

ISOL-1 remains deferred as decided on 2026-09-13. Remaining PC-S1 after this decision: add-repository UI, reduced limit matrices, packaged proof, authorized integration.

## 2. application.db authority — contract conflict option (ii)

The user answered "sim, aprovo a opção (ii)". The shared application.db migrator keeps verify-before-commit (rollback on mismatch) and the explicit known-head pin, matching PC-B8 (exact known-old validation, never a published partial schema). Approved oracle changes:

- 7 `project-storage-create` "rejects one same-name altered …" tests assert rollback plus the precise diagnostic instead of committed altered tables, and define an explicit outcome for an empty `application.db` left by a failed fresh initialization (never an internal "no schema" error on next start, never broken→healthy).
- 2 `project-storage-open` tests keep their intent (upgrade known older authority before create) using a real known older head instead of the synthetic `0006_opening_probe` resource.

Consequence accepted: every future application.db migration must be declared explicitly in code.

## 3. Checkpoint commits

The user approved safeguarding the uncommitted migration ("era melhor salvaguardarmos"). The implementer commits coherent checkpoints on `feat/effect-migration` in `ragnarok-effect`. No merge, no push, no hook bypass; a failing hook is reported, not circumvented. Merge to main remains conditional on feature completion and explicit authorization.
