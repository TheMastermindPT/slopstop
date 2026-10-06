---
date: 2026-10-06T03:00:00+0100
author: Pedro Mesquita
commit: ad823a0
branch: main
repository: slopstop
status: complete
topic: "Intent review round 1 of c1-0-s2-upgrade-failure-and-recovery"
---

# Intent review round 1 (of at most 2) — c1-0-s2-upgrade-failure-and-recovery

Mode: intent. Target: `.rpiv/artifacts/designs/2026-10-06_02-02-21_upgrade-failure-and-recovery.md`, raw SHA-256 `661d8a131128d10edbef6df2e99add078bc884a884d07dafbfc397295dcd8ac4`; parent design `ed78b8c6…`; FRD `d45f5d9c…`; base `ad823a0`.

- slice-verifier: completed, **failed** — Decisions violations (B18(e) vs B21; B6(a)/(c) unreachable; broken discard at opening undefined; B23(a)/(b); no Lane line), Cross-slice violations (S1 UPG-B11 in-progress seeds; S1 UPG-B17 and broken-source oracles not reopened; seam fixture constant ids; shipped ADR 0005 amendment contradicted), Research warnings (second-process live upgrade; kill-test project; peer cannot import the runtime fixture; handle type; busy message conversion; discard on every activation with absent `application.db`; waived-file readers).
- artifact-code-reviewer: completed, **failed** — 3 blockers, 8 concerns, 4 suggestions (overlapping the verifier; plus `discardFailed` reason, symlink refusal, adapter refusing non-T directories, `NodeProjectStorageOptions` field, stop() not awaited).
- artifact-coverage-reviewer: **unavailable** — dispatch denied by the Claude Code auto-mode permission classifier ("Auto-Mode Bypass"); not retried or worked around.

Verified by parent: `docs/adr/0005-storage-lifecycle-and-recovery.md:45-46` (shipped with S1) states that a failed upgrade keeps the marker and outputs; no `requestSingleInstanceLock` exists under `apps/`.

Gate: **failed** (round 1). Decisions needed: ADR amendment timing; second-instance protection.
