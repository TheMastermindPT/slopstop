---
date: 2026-10-03
author: OpenCode
commit: 0994f07
branch: feat/project-registration
repository: slopstop
status: in-progress
---

# PC-S1 — Select, Switch And Reopen Registered Projects

Selection is wired through the existing runtime commands `project.activate` and `project.switch`. The existing ActiveProjectCoordinator remains the sole activation/writer owner. Registered-target physical validation precedes opening; canonical binding/Workspace validation precedes acquiring the writer. Older Storage retains migration-required safe mode; another live writer yields read-only access with command rejection.

## Frozen Identity

- Candidate worktree: `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`.
- Base: `0994f078258d7a697e3165a9157f566e86806ee6`.
- Snapshot: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-project-selection-r3-2026-10-03-snapshot.json`.
- Snapshot SHA-256: `3b3948251a4d9fb84e72583c4b5e7e8024d451fa0210cb30b300b2bf65958470`.
- Complete patch SHA-256: `98db973d5d4e1debee45c7ca35a4a1cecedfa277ec15274768efead52515e4e9`.
- Manifest:15 paths, retained contents/modes/statuses and27 contract references; includes the prior uncommitted listing checkpoint.
- Candidate evidence:343831 bytes, SHA-256 `1cce3f2c4b75b58096d64f77a505a5d02024cc6553d79411b1fac51b4119586e`; previous history preserved.

## Proof

The runtime tests cover missing repository, changed Git administration, mismatched canonical binding, older safe-mode generation, restart/reopen without Git or creation, failed preflight switch preserving the old activation, competing writer read-only mode, successful A-to-B switch releasing A's writer, and replacement of the repository root. A-to-B also verifies old-command refusal and writable reopening of A in another runtime without generation creation.

Parent directly ran the eight-case pre-correction suite: `z9CRvg`,8/8 in47.44seconds. Independent review then found a concrete diagnostic mismatch for root replacement: a preparation-specific trust code was not valid at the activation boundary. Red `iQFJvy` and Green `EPXbo6` establish its translation to `rejected / REPOSITORY_IDENTITY_CHANGED`, with zero writer acquisition and unchanged Storage.

Final R3 capture `oeiGSh` passed9/9. Harness/protocol typechecks and Biome passed against the same final map `1ed6f1284ed5f731a090ee81b3c20bc33e8d0ee3b6f5ce780c5bd46084acd529`. The earlier29/29 coordinator regression applied to unchanged coordinator production. Captures are retained under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-<ID>/`.

## Generation Finding Disposition

An initial coverage finding proposed requiring active `generationId` to equal the initial publication receipt's generation. The author challenged this against ADR0005:20–22 and ADR0006:17–18,124. Independent reviewers confirmed that Storage owns the current generation through its active pointer, manifest and database identity checks; the receipt is immutable history. The coverage reviewer explicitly falsified and withdrew that finding. No risk waiver or weaker check was introduced, and no new generation-equality check was added. Full migration/restore behavior is still outside this selection checkpoint.

## Independent Final Review

All roles verified the same R3 target and27 contract bindings read-only:

| Role | Session | Scoped outcome |
| --- | --- | --- |
| Code | ses_f1d38f34cffeNqiKoS6m6zEsMl | Passed; root diagnostic fixed |
| Coverage | ses_f07506f23ffejSvDyTJprR1g4m | Passed; historical-generation finding withdrawn as falsified |
| Slice | ses_f1d38f1dcffe7O8eyXE9onNXvX | Decisions/Cross-slice/Research OK |

CodeScene remains unavailable and Sonar not assessed. UI/preload wiring, transport for listing/registration, worktree association and remaining recovery/global checks are not claimed complete. No new commit or merge occurred; main integration waits for feature completion as instructed.
