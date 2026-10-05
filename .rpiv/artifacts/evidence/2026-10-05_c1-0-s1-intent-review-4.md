---
date: 2026-10-06T00:30:00+0100
author: Pedro Mesquita
commit: 2d52eeb
branch: main
repository: slopstop
status: complete
topic: "Intent review round 4 of c1-0-s1-staged-upgrade-engine"
---

# Intent review round 4 — c1-0-s1-staged-upgrade-engine

## Plan Review (design step 4, round 4)

Mode: intent. Reviewed target: design raw SHA-256 `c4391480223fd418b4e27f0aa8fd53890723a52e3023dd39863646001499a575`; FRD `d45f5d9c…1105`; research `fab466e4…41f8`; base `2d52eeb`.

- slice-verifier: completed, **failed** — 3 Decisions violations, 0 Cross-slice, 5 Research warnings.
- artifact-code-reviewer: completed, **failed** — 0 blockers, 13 concerns, 5 suggestions.
- artifact-coverage-reviewer: **unavailable** — dispatch denied by the Claude Code auto-mode permission classifier ("Auto-Mode Bypass"). Not retried or worked around. Mandatory review missing → gate blocked regardless of the other results.

| # | source | theme | condensed finding | resolution |
|---|---|---|---|---|
| 1 | verifier, code | red order | UPG-B3/UPG-B10 reds cannot both hold in order B1→B2→B10→B3; several B10 cases green on arrival; `manifestVersion: 3` already red-less | |
| 2 | verifier, code | stale reds | UPG-B4, UPG-B9, UPG-B17 reds describe a scaffold replaced by B1; per-case reds/guards needed | |
| 3 | verifier | fixture | resolved `writer_recovery_records` row needs a later resolver generation (CHECK + FK, golden `:365,442-451`); insert after the second activation | |
| 4 | code, verifier | classifier | scanner emits no `;` token (`sqlite-schema-scanner.ts:121`); classifier return union undefined; TEMP / IF NOT EXISTS / AS SELECT and trailing `;` cases | |
| 5 | code, verifier | backup | busy open errors must stay `unavailable` (`project-storage-node-errors.ts:16-30`); read back backup identity/heads (ADR 0005:19); exact backup-manifest JSON keys; pinned corruption offset | |
| 6 | code | messages | exact messages for health-unavailable and switch-guard outcomes | |
| 7 | code | released | handle release on UPG-B9 paths; verifier: on `.staging-T/` and `snapshots/U/` after failures | |
| 8 | code | swap cases | UPG-B10 swapped manifests must keep every identity field equal | |
| 9 | code, verifier | mutation | `mutate` lacks `generated-migrations.ts`, `project-storage-manifest.ts` | |
| 10 | verifier | injected errors | which layer catches injected errors in UPG-B17 (adapter precedent converts to broken, `project-storage-node-adapters.ts:1617-1619`) | |
| 11 | code | negatives | step-6 integrity isolate; runtime `broken` for two completed rows without restart | |
| 12 | verifier | locations | UPG-B2, B3, B4, B5, B7, B9 name no test file | |

Gate: **blocked** (failed reviews plus one unavailable mandatory review).
