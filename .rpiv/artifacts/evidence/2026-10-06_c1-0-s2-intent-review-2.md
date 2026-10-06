---
date: 2026-10-06T04:10:00+0100
author: Pedro Mesquita
commit: ad823a0
branch: main
repository: slopstop
status: complete
topic: "Intent review round 2 (last) of c1-0-s2-upgrade-failure-and-recovery"
---

# Intent review round 2 (last) — c1-0-s2-upgrade-failure-and-recovery

Mode: intent. Target: design raw SHA-256 `8b9866487e940431f55f3edc505445bd9fd993f142651fae574e473b4e1798c6`; parent `ed78b8c6…`; FRD `d45f5d9c…`; base `ad823a0`.

- slice-verifier: **unavailable** — dispatch denied by the Claude Code auto-mode permission classifier ("Auto-Mode Bypass"); not retried.
- artifact-coverage-reviewer: **unavailable** — not dispatched after the round-1 denial of the same agent; the denial applies to the outcome.
- artifact-code-reviewer: completed, **failed** — 2 blockers, 8 concerns, 3 suggestions:
  1. (blocker) UPG-B6(d): a junction root entry makes opening throw "Project Storage witness must not be a symbolic link." (`project-storage-filesystem-authority.ts:267`).
  2. (blocker) UPG-B21 adapter oracle used inputs inexpressible through typed ids and contradicted itself for other UUIDs.
  3. Entry discard must rethrow `ProjectStorageApplicationClientInitializationError`.
  4. ADR 0005 line 46 "nothing is deleted automatically" must be reworded.
  5. Parent D10 "synchronous throw" item silently dropped.
  6. Seam: `attempt` semantics and one-time failure undefined.
  7. UPG-B18(f) release mechanism impossible.
  8. UPG-B18(g) "pinned at red time" hedge.
  9. UPG-B18(h) already implements E1, making UPG-B23's red unobservable.
  10. Owner-level broken discard has a typed-fake seam (`project-storage-store.test.ts`).
  11–13. (suggestions) busy message only after a marker read; name `existingApplicationClient()`; stale verification note.

All thirteen applied to the design without a further round (user rule: at most two rounds per slice). The final revision is unreviewed.

Gate: **failed / incomplete** (round 2 failed; two of three mandatory reviewers unavailable). Readiness depends on the user's explicit decision.
