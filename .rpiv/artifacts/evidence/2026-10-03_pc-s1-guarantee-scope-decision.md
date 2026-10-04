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

## 4. Implementation record (2026-10-03, ragnarok-effect `feat/effect-migration`)

- `daee118` checkpoint of the reviewed identity (tracked diff sha256 `c8c459a1…6df`); `18d9761` fixes coordinator finding R-1 (a fresh application.db counted as observed before the file existed, reproduced RED first); `32c52fa` applies option (ii). Hooks were not bypassed; no push or merge.
- `32c52fa` carries the user-approved oracle change: 7 `project-storage-create` cases now require rollback, no application.db left and the same refusal after restart (RED first, then 61/61). A rejected fresh initialization's empty file (plain, size 0, created by the sole initializer) is removed; a failed removal is a distinct failure; a schema-less file the authority did not create is `REGISTRY_CORRUPT` / Storage's precise refusal and is left untouched.
- The `project-storage-open` case "has known but non-current migration" left the no-mutation table: under the approved PC-B8 contract a known older head is migrated before list/register/select, so open now upgrades it. A dedicated test proves head `0005`, equal prior rows, another Project's files byte-identical and the exact safe-mode result; pre-commit failure keeps the old schema (registration checkpoint cases). The table keeps unknown head and adds newer head, both broken without mutation. Decided by the coordinator as a consequence of option (ii) + PC-B8, reported to the user.
- Coordinator review accepted `32c52fa`. Limitation: two concurrent fresh initializers that both fail leave the empty file, so the next start reports typed `REGISTRY_CORRUPT`.
- Package proof: the bootstrap scenario now passes (previous blocker `storage-healthy-project-create` resolved); smoke fails at the next stage, `writer-proof scenario`, cause not yet known. Baseline failures stay visible: project-registration 1, project-storage-open 2, project-storage-lifecycle 9, canonical-writer-package-smoke 81 (not rerun).
- Writer proof diagnosis: the Electron port-GC hypothesis was refuted (strong references retained, retention code unchanged since `11b1989`). Root cause is pre-existing, not an Effect regression: the packaged writer-proof audit fixture pinned the canonical table set and head from before canonical migration `0002_initial_repository_binding` (added in `0994f07`), which also explains the 81 baseline `canonical-writer-package-smoke` failures. `f7e02dd` updates only the fixture's expected tables and metadata (`schema_version 3`, head `0002`) to the already-approved schema; assertions stay exact. RED 81 → 4 → GREEN 149/149. Coordinator accepted it as alignment of stale expected values, not a relaxed oracle.
- **Full `package:smoke` passes** at `f7e02dd`: "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof." The application.db checkpoint is closed. Remaining visible baseline failures: project-storage-open 2, project-registration 1, project-storage-lifecycle 9.
- Step 0 of the remaining Effect plan: all 12 baseline failures resolved by test-only alignment; no product source changed. `d5efcbf` derives the "newer canonical" seed from the supported spec + 1 (was a fixed schema 2, older than spec 3) → open 45/45. `c1ea344` restores the previous registry by dropping the registration tables added after it (cause confirmed from the failure diff) → registration 128/128. `689f3b9`: the lifecycle tests called Storage directly one microtask after `runtime.stop()`, but the approved 2a shutdown contract stops Storage only after canonical release; the test now waits for the Storage stop request (a signal, not a timer) and still asserts stop unsettled, all three operations unavailable and no extra Project locks → lifecycle 20/20. Coordinator accepted all three as alignment with approved contracts, without weakened assertions. Follow-up for the Storage owner step: prove that operations admitted before the Storage stop settle after drain instead of waiting indefinitely.

## 5. Remaining Effect migration order — Human Decision

After the implementer's read-only plan (103 files, ~23.4k lines inventoried; full remaining migration estimated at 10–13 application.db-sized sessions, high uncertainty), the coordinator presented: A) full migration as approved, then PC-S1; B) core first and re-decide; C) stop the migration now. The user chose **B**: execute 2b-1 (ManagedRuntime/Layers and Scope-based shutdown preserving the 2a D invariants) and 2b-2 (Storage owner, client manager, SerialLock → Semaphore, plus the drain follow-up), then stop and report the real cost per step so the user decides whether to continue (2b-3 onward) or move to PC-S1/Conversation. "No legacy layers" still holds: any mixed state is temporary and must be removed in the final delivery. Shutdown/cancellation semantics that would change pending-recovery outcomes come to the user first.

The user also asked the coordinator to make the first commit of `C:/Users/pedro/Documents/GitHub/chess` (baseline project): `3fd700f`, 41 spec/prototype files, no remote, no push.

## 6. Migration continuation, merge timing and branch housekeeping — Human Decisions

- After 2b-1 (~7 min) and 2b-2 (~32 min) came in far below estimate, the user chose to **continue the Effect migration to the end** (2b-3 registration, 2b-4 coordinator/writer, 2b-5 authority facade removal, 2c desktop main, 2d cleanup and deep gate).
- **First merge to main right after the Effect migration completes**, clarifying the earlier "merge when the feature is finished": main will receive the full migration plus the partial, working PC-S1 (list/open/switch Projects); the remaining reduced PC-S1 continues on a new branch. **Push to GitHub after that merge** (main was 20 commits ahead of origin on 2026-10-03).
- Housekeeping done by the coordinator: pruned three stale temporary worktree records; deleted local `feat/canonical-project-writer` (fully contained in main). `feat/project-registration` becomes redundant after the merge (its 3 commits are inside `feat/effect-migration`). Salvage branches `salvage/dirty-2026-08-31`, `salvage/port-dirty-2026-08-31` and `origin/decision/ticket-63-evidence-ledgers` are under read-only review; nothing deleted without user approval.

## 7. Owner-failure residue after the application.db authority — Human Decision (2026-10-04)

During 2d the implementer found a real regression: `project-storage-open-recovery` "normalizes mutable application initialization failure at the owner boundary" passes at `11b1989` but fails since `daee118`, because the shared authority migrates application.db before the client initialization hook; when the hook fails on a fresh root, a migrated empty application.db remains (result still broken / `PROJECT_STORAGE_OWNER_FAILED`). Option B (delete the shared database) was excluded by the coordinator. The user approved **C conditionally**: if restoring the old order (A) breaks fresh creation or authority tests (risk: the hook's PRAGMA would create the file before the authority initializes), the test expects the same failure plus a valid current-schema application.db with no rows or Project files from that attempt, and a working next start, because application.db is now an installation resource rather than part of a Storage create attempt. If A is proven safe, A is applied with no oracle change.

Update (2026-10-04): the user then chose **C unconditionally** ("passa para a C"); the A experiment was abandoned.

## 8. Push policy — Human Decision (2026-10-04)

A push attempt (CLI and GitHub Desktop) failed because the `.husky/pre-push` deep gate fails on main's pre-Effect code (a Vitest worker exited unexpectedly in `pnpm check`, under load). The user confirmed: **never bypass the hook with `--no-verify`**; push only after the Effect merge, running the full deep gate once on the integrated tree without parallel test load, fixing any failure first. The archive tag push and the removal of `origin/decision/ticket-63-evidence-ledgers` follow that push.

## 8. PC-S1 additions from the UI prototype review — Human Decisions (2026-10-04)

- **Default Project name** = the name of the worktree root folder; no editing in PC-S1.
- **"Remove from list" (option A) joins PC-S1:** hides a Project from the saved list while keeping its Ragnarok data; the Git repository is never touched; only a non-active Project can be removed; explicit confirmation; registry busy vs broken stay distinct with the list unchanged; re-adding the same folder returns the same Project without duplication. **Deleting Ragnarok data (option B) stays deferred** to the explicit-removal work (ADR 0018).
- Answers given by the coordinator from existing contracts: Linux can be refused before the folder picker (platform known at startup) while volume capability is only known after selection; the Git executable approval (D8) is tied to the executable identity and persists across folders, while trusted-local consent (D6) is always per folder; adding an already-registered folder returns `already-registered` with an Open action.
