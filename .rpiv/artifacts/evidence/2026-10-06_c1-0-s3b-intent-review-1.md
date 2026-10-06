---
date: 2026-10-06T20:10:00+0100
author: Pedro Mesquita
commit: 110ea90
branch: main
repository: slopstop
status: complete
topic: "Intent review round 1 of c1-0-s3b-upgrade-window"
---

# Intent review round 1 (of at most 2): c1-0-s3b-upgrade-window

- Mode: intent.
- Target: `.rpiv/artifacts/designs/2026-10-06_18-48-25_upgrade-window.md`, raw SHA-256 `48e60ec97c784263a7ac9fd4fbe6e2a5fc3f02a7b43bada66217a220d642747a`.
- Base: `110ea90`.
- All three reviewers completed. Reviewer-side hashing was unavailable; the reviewers compared the referenced hashes as text, and those comparisons matched.

## Results

- **artifact-code-reviewer: failed.** 1 blocker, 8 concerns, 8 suggestions.
  - The blocker: an always-mounted `role="status"` collides with the harness status at `app.tsx:113`. This breaks `app.test.tsx:303,309` and `shell.test.ts:87,158,159`.
  - Concerns:
    - desktop-side failures are labelled with the harness `PROTOCOL_MESSAGE_INVALID` message;
    - the shared dispatcher change is not stated as additive (sibling bridges);
    - the list row stays stale after the upgrade;
    - retry and rejection obligations are missing;
    - G5 fails silently;
    - the status oracle is ambiguous;
    - the switch oracle shows only the shape;
    - there is no focus-after-retry oracle;
    - there is no epoch oracle.
- **artifact-coverage-reviewer: failed.** 7 blockers, 5 concerns.
  - Blockers:
    - a rejected `upgradeProject`/`activateProject` has no stated outcome;
    - factory throw and id collision are unpinned;
    - `send` not ok and stop-while-pending are unpinned;
    - the activate/switch regressions are under-pinned;
    - the `main.ts` handler has no observable red;
    - "Updating" during the follow-up activation is unpinned;
    - the always-mounted region is not distinguishable from today's mount-with-text line.
  - Concerns: a second failed retry; focus after retry; the epoch reset; `selecting` across phases; the wrong affected tests.
- **slice-verifier: failed.**
  - Decisions violations:
    - B31 factory/collision/`send` rows;
    - the B35 Expected red cannot be observed in the declared order;
    - the rejected-promise outcome;
    - the ambiguous status oracle;
    - the focus after retry.
  - Cross-slice violations: G6 atomicity against existing tests; the shared `dispatchPendingHarnessEvent` contract with `workspace-bridge.ts` and `project-storage-bridge.ts`.
  - Research warnings:
    - the diagnostic direction;
    - the `HARNESS_SESSION_MESSAGE_INVALID` mapping;
    - a vacuous log oracle;
    - the panel lifetime;
    - the `echoing` literal duplicating `connectionLost`;
    - the mutation scope;
    - a bridge mock is not an API list;
    - no handler unit oracle.

## User decisions on round 1 (2026-10-06)

- A false success (`upgraded`/`not-required` but the follow-up activation is still `migration-required`) shows the failure panel with the protocol row `broken PROJECT_STORAGE_BROKEN` and "Try again" (G5 reopened).
- Desktop-detected failures shown as `PROTOCOL_MESSAGE_INVALID` are accepted as residual risk (G8).

All other findings were applied as contract precision. The changes:
- the progress line becomes an always-mounted `aria-live` paragraph `#ws-progress`, with no `role`, so the existing status queries are untouched;
- the dispatcher change is additive (the message is kept);
- a rejected call has a stated outcome, and the panel has a stated lifetime;
- the list refreshes after the upgrade;
- the IPC handlers are extracted, with a unit oracle;
- the B35 Expected red is "none — pin";
- the mutation scope is narrowed;
- new oracles: factory/collision, `send`, stop while pending, activate/switch regressions, follow-up gating, the same DOM node, a second failed retry, focus after retry, epoch reset, `selecting` across phases;
- the affected tests are corrected;
- the workspace is stated.

Gate: **failed** (round 1). Round 2 is the last.
