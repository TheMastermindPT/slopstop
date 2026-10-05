---
date: 2026-10-05T23:30:00+0100
author: Pedro Mesquita
commit: 2d52eeb
branch: main
repository: slopstop
status: complete
topic: "Intent review round 3 of c1-0-s1-staged-upgrade-engine"
---

# Intent review round 3 — c1-0-s1-staged-upgrade-engine

## Plan Review (design step 4, round 3)

Mode: intent. Reviewed target: design raw SHA-256 `48bde90ec637da9107a73d627348530ba26376d33ad4bc580f2f82a761696dbe`; FRD `d45f5d9c…1105`; research `fab466e4…41f8`; base `2d52eeb`. Reviewer-side hashing and Git unavailable; parent hash binding.

- slice-verifier: completed, **failed** — 4 Decisions violations (UPG-B7 reds for (c)/(d); no same-count content change; relationship-rule oracles confounded; version-moving plan "inconsistent" clause self-contradictory), 1 Cross-slice violation (mutation Vitest config lacks the eligibility test), 5 Research warnings (UPG-B8 real-disk reads in a unit test; fixture command path — production registry is empty, `process-bootstrap.ts:272`; v2 provenance not cross-checked; S2 conflict with the in-progress clause; lists and unpinned oracles).
- artifact-code-reviewer: completed, **failed** — 0 blockers, 19 concerns, 5 suggestions.
- artifact-coverage-reviewer: completed, **failed** — 14 blockers, 6 concerns, 3 suggestions.

Round-2 items resolved: checkpoint placement, relationship-rule scoping, createdAt negative, eligibility negatives. Moved to the C1 gate by user decision: receipts, chains.

| # | theme | condensed findings | resolution |
|---|---|---|---|
| 1 | outcome shapes | exact result objects and messages unpinned | |
| 2 | version-moving plan | define schema-version ↔ migration-id rule; format 0 and inconsistent pairing cases | |
| 3 | backup | "does not match its manifest" unreachable; runtime backup and post-header page corruption untested; leftover state unpinned | |
| 4 | verification | same-count content change; FK/integrity; runtime identity row; (c)/(d) reds are `broken` | |
| 5 | switch/declare | all-or-nothing untested; S-row equality guard outcome undefined; no post-rename `verifySealed`; marker-before-touching unobserved | |
| 6 | manifest v2 | provenance not cross-checked with registry; `project-storage-manifest.test.ts:152` unlisted | |
| 7 | relationship rule | in-progress negatives; target case confounded; S re-insert state; second-row target | |
| 8 | replay | conflict input undefined; replay against inconsistent authority | |
| 9 | file adapter | containment, `.staging-x`, depth, outside root; error class/message | |
| 10 | fixture | real command path needs a test-only command; writer rows must be resolved and consistent; raw owner factory | |
| 11 | busy | locked `mastra.db` case; probe release on refusal paths | |
| 12 | unit vs integration | UPG-B8 real-file cases; tokenizer edge cases | |
| 13 | gates and lists | mutation Vitest include; typed fakes `project-storage-store.test.ts:100-115,148-169`; `project-storage-node-schemas.ts`; S2 note | |
| 14 | unregistered | `not-registered` must create nothing | |

Gate: **failed**. All items are mechanical contract precision under existing decisions; no new user decision required. Round 4 follows.
