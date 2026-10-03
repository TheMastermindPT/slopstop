---
date: 2026-10-03
author: OpenCode
commit: 11b1989
branch: feat/effect-migration
repository: slopstop
status: in-progress
---

# Full Effect Migration — Human Authority

The user answered **“ttudo ok. avanca”** to all four grouped choices in [the joint proposal](../research/2026-10-03_effect-collaboration-proposal.md).

## Approved End-State And Scope

1. Replace Zod with Effect Schema throughout the applicable runtime validation/model boundaries, preserving public wire behavior. Pure Effect schema/type modules may be used in kernel; services and runtime remain outside kernel.
2. Migrate effectful ownership, services, resources, concurrency and cancellation in harness and Electron main to Effect. Keep React for presentation and the legitimate Promise/callback edges required by Electron, native APIs and preload. Remove replaced handwritten coordination and legacy compatibility paths in the final result.
3. Perform a bounded SQL-client experiment before choosing its definitive implementation. Keep the libSQL engine; assess Windows handle release, transaction/uncertain-commit semantics, fencing and worker isolation. Return the choice to the user with results. Drizzle may remain the final schema-generation tool independently of the execution client; its retention is not a legacy execution path.
4. Commit current reviewed UI/documentation, then migrate from that complete state in a separate worktree/branch. Claude implements initially; OpenCode coordinates and independently reviews. Roles may rotate explicitly, with one writer per shared scope. Use focused tests and one meaningful review per coherent step; integrated/package validation belongs at the milestone boundary.

Node/Electron remain. Bun and Alchemy are not selected. Existing behavior and integrity guarantees remain until separately changed by the user. The simplification of registration guarantees, unimplemented ADR policy, and wider product roadmap are still proposals, not automatic migration decisions.

No actual user-data deletion, reset of other worktrees, rewriting of historical evidence, main code merge, push, or automatic selection of a SQL client follows from this approval. Legacy-compatibility removal describes the final implementation, not permission to destroy the existing work.

## Protected Starting State

- UI checkpoint commit: `11b1989bc0cce91df6a8b3e1bbac54a5f5f2267b` on `feat/project-registration`, in `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`.
- The35 candidate paths were checked against the reviewed UI R2 snapshot before commit; no unexpected files or secret-pattern matches were found.
- Normal hooks ran successfully. Biome made one formatting-only line split in `active-project-coordinator.ts`; parent inspected that exact delta. All other reviewed bytes remain identical. The commit is the exact migration base, not the pre-hook snapshot hash.
- Existing main code remains at its prior state; review/research/approval documents are committed separately there. GitHub tickets remain behind the local implementation and must not be mistaken for current code.
- Approved migration workspace: `C:/Users/pedro/Documents/GitHub/ragnarok-effect`, branch `feat/effect-migration`, created from the UI checkpoint above after verifying the destination and branch were unused.

## First Implementation Unit

Effect4 stable, exact dependency pins through the existing catalog. Migrate pure schema/type definitions and the protocol boundary first, preserving strict excess-property rejection, UUID brands, UTC timestamp strings, bigint behavior and public discriminated outcomes. Adapt consumers to actual Effect Schema APIs, not a Zod-shaped compatibility shim. Transitional package coexistence during implementation steps must not survive the complete migration.

Preserve the existing working data/process/renderer boundaries while this unit is built. The user authorized the corresponding updates to current guidance/ADR0001; retain historical reviewed artifact bytes as history rather than pretending they originally selected Effect.

Claude has exclusive source write ownership in the migration worktree once explicitly dispatched. OpenCode owns coordination documents in the source-main workspace and reviews frozen checkpoints. Neither agent's message supplies new human authority.
