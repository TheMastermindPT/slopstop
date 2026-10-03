---
date: 2026-10-03
author: OpenCode
commit: 0994f07
branch: feat/project-registration
repository: slopstop
status: in-progress
---

# PC-S1 — Real Projects List, Open And Switch UI

Connected the existing Projects surface to the actual harness listing and activation owners through strict protocol messages, desktop main bridging and a narrow preload API. The renderer receives neither Node APIs nor private repository paths. Successful activation/switch results drive the displayed Project; pre-release switch refusal preserves the current session. Old responses from an earlier harness lifecycle cannot replace the current view.

The interface displays saved Projects, empty/error states, read-only access and safe-mode diagnostics. New repository registration and Conversation remain explicitly unavailable in this checkpoint; no mock registration flow is presented as delivered.

## Frozen Final Identity

- Candidate: `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`.
- Base: `0994f078258d7a697e3165a9157f566e86806ee6`.
- Snapshot: `C:/Users/pedro/AppData/Local/Temp/opencode/pc-s1-project-ui-r2-2026-10-03-snapshot.json`.
- Snapshot SHA-256: `39612e2cb9bb9bc67e59115d1076ff90d58bc3ff60a6c65305d09ed53487b355`.
- Complete patch SHA-256: `404015921efd752e681799e7fa0a22f0335b7b52ec705d9ca76e8b8b8e629bb2`.
- Manifest:35 paths with retained sources, modes/statuses and27 contract references.
- Evidence:356851 bytes, SHA-256 `fcf310ff6ec3fb40d0f6217ddd0855ff160574803f3e9e80910b86dea2c0c335`, earlier prefixes preserved.

## Proof And Review Correction

The first implementation passed72 focused tests and a real Electron list/open/switch journey, followed by a small opening-function refactor with affected checks and Electron confirmation. Those results remain attached to their original identities.

Independent review found that a healthy canonical database with missing/corrupt runtime was misleadingly labelled "Safe mode · healthy". R2 displays the nonhealthy Canonical and Runtime conditions in both list and opened view, reports "Writes unavailable", and removes the healthy connection claim. Red `Z5Jkw4` reproduced three incorrect presentations; Green `10rn3a` passed10/10 renderer tests. Added delayed list/activation tests characterize the existing epoch guards.

Final real Electron capture `I7zGiX` passed1/1: two real registered Projects were listed, opened and switched; then the disposable runtime database was removed and the UI correctly reported "Runtime missing" and unavailable writes. The renderer remained isolated from Node. Screenshots are retained at `C:/Users/pedro/AppData/Local/Temp/opencode/pc-ui-proof-tw0NxU/`.

The initial E2E backup-location failure remains a fixture failure in history. The final E2E capture matches the complete frozen tree; renderer Green, desktop typecheck and build have identical final production bytes, with only the later E2E backup destination changed. Biome passed against final bytes. No unexecuted whole-tree typecheck is inferred from that earlier run.

CodeScene reviewed the opening component at10.0 after refactoring; this is a file result, not a global gate. Sonar remains not assessed after an authorization failure; no further attempt or configuration change followed. Existing agent guidance was not modified.

## Independent Final Review

All roles inspected the same frozen target read-only, checking current/retained contents and27 contract bindings:

| Role | Session | Scoped outcome |
| --- | --- | --- |
| Code | ses_f1d38f34cffeNqiKoS6m6zEsMl | Passed; health finding closed |
| Coverage | ses_f07506f23ffejSvDyTJprR1g4m | Passed; safe-mode and stale-response proof gaps closed |
| Slice | ses_f1d38f1dcffe7O8eyXE9onNXvX | Decisions/Cross-slice/Research OK |

No new commit or merge occurred. Remaining feature work includes the native registration/consent UI, association of additional worktrees, recovery actions and final combined validation. Main integration waits until the feature is complete, as instructed.
