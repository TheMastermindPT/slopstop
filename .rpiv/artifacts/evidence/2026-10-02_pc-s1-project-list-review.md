---
date: 2026-10-02
author: OpenCode
commit: 0994f07
branch: feat/project-registration
repository: slopstop
status: in-progress
---

# PC-S1 — Saved Project Listing

User requested commit and continuation, then explicitly limited main integration to completion of the feature. Parent created `0994f078258d7a697e3165a9157f566e86806ee6` for the53 reviewed implementation/evidence files and `1434c402a73d6808fcd3437127709f3dc7a458f0` on main for eight decisions/reviews. Hooks passed without source drift; both workspaces were clean before this new listing step. No merge or push occurred.

## Delivered

The existing public registration owner now exposes `listProjects()` with a strict protocol DTO. It lists published Projects, visibly incomplete registrations and legacy unbound Storage without misrepresenting them as ready. Missing repository locations remain listed. Multiple confirmation requests do not duplicate Projects. Storage health is reported separately from repository location presence, and access remains `not-assessed`.

Listing does not run Git, change the active Project or expose private paths. Presence of a directory is not represented as a freshly validated Git association. Corrupt or missing registry state remains distinguishable from a legitimately empty list. Legacy migration-required data remains byte-preserved.

## Frozen Reviewed Identity

- Worktree: `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`.
- New base: `0994f078258d7a697e3165a9157f566e86806ee6`; separate from historical integration target.
- Complete eight-path snapshot: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-project-list-r2-2026-10-02-snapshot.json`.
- Snapshot SHA-256: `debde3da253b83010233a16e6248d4903fc59f78f94e80d8a2c6cf48c8b62e11`.
- Patch SHA-256: `5eb73e8b1f7feeb8a03e16a987ab3319d1025f88dff625753be7008c2fe31a09`.
- Candidate evidence:326210 bytes; SHA-256 `1957a4929912529e39fb8591df48f073c398c9caa22bd445f4daa8a5da657cb3`; previous prefix preserved.
- Retained sources/modes/statuses and27 contract references are bound by the snapshot.

## Correction And Final Proof

Initial review found that enumerating only stored request JSON could validate another request when a corrupt row contained that other request's ID. R2 validates each actual row key and reservation relationship before reusing the existing receipt validator. Public Red `bYsmXw` and Green `6v2lh8` prove the cross-row substitution is refused as `REGISTRY_CORRUPT`, with no new Git and no silent database repair.

Final captures under `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-node2420-<ID>/`, source map `78b905c43180fe4dfd9a5a355e0dbb31174b4eeca9f67df23afbe9ddd308d0ef`:

| Capture | Result |
| --- | --- |
| kAYXsQ | Listing5/5 passed |
| XzDChX | Harness typecheck passed |
| U9n5nF | Protocol typecheck passed |
| yyNBRV | Biome passed |

## Independent Review

All roles inspected the same final delta read-only, verified identity and27 bindings before/after, and returned no remaining findings:

| Role | Session | Scoped outcome |
| --- | --- | --- |
| Code | ses_f1d38f34cffeNqiKoS6m6zEsMl | Passed |
| Coverage | ses_f07506f23ffejSvDyTJprR1g4m | Passed |
| Slice | ses_f1d38f1dcffe7O8eyXE9onNXvX | Decisions/Cross-slice/Research OK |

CodeScene remains unavailable and Sonar not assessed. This is not whole-feature acceptance. Selection, reopening, UI, additional-worktree association, pending recovery and final integration checks remain separate outstanding work. Listing changes are uncommitted at this checkpoint; merge waits until the feature is complete as instructed.
