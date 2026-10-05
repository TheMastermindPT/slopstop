---
date: 2026-10-05T22:10:00+0100
author: Pedro Mesquita
commit: 2d52eeb
branch: main
repository: slopstop
status: complete
topic: "Intent review round 2 of c1-0-s1-staged-upgrade-engine"
---

# Intent review round 2 — c1-0-s1-staged-upgrade-engine

## Plan Review (design step 4, round 2)

Mode: intent. Reviewed target: `.rpiv/artifacts/designs/2026-10-05_20-37-14_project-database-staged-upgrade.md`, raw SHA-256 `7361d4d1790d177dea46171e9d8060c7fba6a6fe4a0942090b36ab639c9b2cb7`; FRD `d45f5d9c…1105`; research `fab466e4…41f8`; base `2d52eeb`. Reviewer-side hashing and Git unavailable (Read/Grep/Glob only); parent hash binding.

- slice-verifier: completed, **failed** — 2 Decisions violations (receipt oracle unrunnable; `after-staged-migration` placement), 1 Cross-slice violation (relationship rule vs in-progress row), Research warnings.
- artifact-code-reviewer: completed, **failed** — 1 blocker, 13 concerns, 6 suggestions.
- artifact-coverage-reviewer: completed, **failed** — 8 blockers, 8 concerns, 5 suggestions.

Unverified assumption flagged by the verifier: `VACUUM INTO` from a read-only connection (Context7 lookup returned no matching passage; to settle by an S1 red run or official docs).

| # | source | severity | theme | finding (condensed) | resolution |
|---|---|---|---|---|---|
| 1 | all | blocker | receipt lookup | UPG-B11 re-add oracle cannot run: a v2 fixture has no publication; a registration-flow Project needs `repository_bindings`. Listing/visibility/selection callers untested. | |
| 2 | verifier, coverage, code | blocker | UPG-B7 checkpoint | `after-staged-migration` inside an open write txn (timeout 0) → SQLITE_BUSY; in-txn verification has no negative. DROP case red is `broken` (verifySealed). Leftover state unpinned. Runtime and identity-row tamper missing. | |
| 3 | verifier, code | blocker | relationship rule | Unscoped "source absent" clause makes every registry start `REGISTRY_CORRUPT` during an in-progress upgrade and after a failed one; must depend on head (older heads lack the table). | |
| 4 | coverage, code | blocker | chain | Chained-upgrade branch and "earliest" ordering untested and undefined. | |
| 5 | coverage | blocker | createdAt rule | Only the agreeing case tested. | |
| 6 | coverage | blocker | backup verification | No failing case or outcome for an unverified backup. | |
| 7 | coverage, code | blocker | eligibility | No CREATE VIEW/TRIGGER/VIRTUAL TABLE or `CREATE INDEX __new_i` negatives. | |
| 8 | coverage | blocker | file adapter | `createDirectoryInProject` refusals untested. | |
| 9 | coverage, code | concern | cap / missing dir | Generation cap boundary and missing retained directory untested. | |
| 10 | code, verifier | concern | typed fakes, pins | `project-storage-store.test.ts:135,176`, `project-storage-lifecycle.integration.test.ts:287`, `project-storage-create.integration.test.ts:1037`; head pins `project-storage-open.integration.test.ts:804,858`, `project-storage-open-recovery.integration.test.ts:53`. | |
| 11 | all | concern | fixture precision | Golden file is a migration script; rejected command consumes a sequence; clock reads (creation 3, backup time); opt-in sequencing. | |
| 12 | verifier | warning | busy vs broken | `NOT_ELIGIBLE` absorbs a transient `unavailable` probe. | |
| 13 | code | concern | mutation | `pnpm test:mutation:project-storage:harness` omitted. | |
| 14 | coverage, code | concern | criteria | Add root `pnpm test:integration`; Windows handle release on S unproven. | |
| 15 | all | suggestion | reds and wording | UPG-B2 red half unreachable; UPG-B10 red order; UPG-B8 missing-module red; UPG-B4 directory entries; step 2/8 copy wording; FR6 real write on T; B12 construction; upgrade-plan refusals. | |

Gate: **failed**. Awaiting user triage (item 1/4 scope) before round 3.
