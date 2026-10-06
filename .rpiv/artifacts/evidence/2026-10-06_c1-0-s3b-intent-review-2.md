---
date: 2026-10-06T21:30:00+0100
author: Pedro Mesquita
commit: 110ea90
branch: main
repository: slopstop
status: complete
topic: "Intent review round 2 (last) of c1-0-s3b-upgrade-window"
---

# Intent review round 2 (last): c1-0-s3b-upgrade-window

- Mode: intent.
- Target: design raw SHA-256 `67898df93d19c56c56a2bfa30622e974ae139d99cdeb8120a7c788f19d570fff`.
- Base: `110ea90`.
- All three reviewers completed. Reviewer-side hashing was unavailable; the referenced hashes matched as text.

## Results

- **artifact-code-reviewer: failed.** 2 blockers, 8 concerns, 6 suggestions.
  - The blockers: the heading oracles in B33 and B35 expected "Project Project without a repository 00000000". The window renders "Project without a repository 00000000" (`projects-list.tsx:17`, `workspace-view.tsx:76`).
  - Concerns:
    - `#ws-progress` was inside the `aria-busy` section;
    - a stale-epoch flow released `selecting`;
    - jscpd would flag the copied seed block;
    - `SEND_FAILED` and `MESSAGE_INVALID` were unpinned;
    - the B32 red was a missing module;
    - the "other follow-up result" branch was unpinned;
    - the restart sequence was ambiguous;
    - the lifetime oracles were incomplete.
- **slice-verifier: failed.**
  - Decisions violation: the heading oracles.
  - Cross-slice violation: the stale-epoch `selecting` release conflicts with `projects-workspace.tsx:158-163`.
  - Research warnings:
    - G5's window-chosen reference is not recorded as a risk;
    - `aria-busy` may hold back announcements;
    - B35 "none — pin" was used for new behavior;
    - the B32 red;
    - unpinned paths;
    - the list row after an upgrade is not observed in E2E;
    - the alert structure.
- **artifact-coverage-reviewer: failed.** 5 blockers, 7 concerns, 2 suggestions.
  - Blockers: `SEND_FAILED`; `aria-live` unpinned; the `not-required` false success; the two heading oracles.
  - Concerns:
    - the list/register regression;
    - the runtime-only `migration-required` negative case;
    - the other follow-up result;
    - the rejected call's view, which contradicted the Intent;
    - the lifetime;
    - a stale follow-up activation;
    - the stale release.

## Applied without a third round (user rule)

- headings corrected;
- `#ws-progress` moved into `<main>`, outside the `aria-busy` section;
- release only in the current epoch;
- a shared `runHarnessSeed` helper;
- new B31 cases for `SEND_FAILED`, direct `MESSAGE_INVALID`, and the list/register regression;
- the B32 red after scaffolding;
- the list handler wording;
- new B33 cases: `aria-live` with no role, the runtime-only negative, the full switch log;
- new B34 cases:
  - the `not-required` false success;
  - the other follow-up result;
  - "No Project selected" on a rejected call;
  - three restart variants;
  - add-flow and reset lifetime;
  - green-on-arrival sub-cases named;
- the alert structure, with "Try again" outside it;
- the focus line named;
- the observer options;
- B35 recast as a composition guard;
- the G5 residual risk recorded;
- the Intent wording for a rejected call;
- G8 named as the exception in the Constraints.

Gate: **failed** (round 2, the last). The final revision is unreviewed; readiness depends on the user's decision.

Residual (not addressed): the list row after an upgrade is observed only in the renderer test (`listProjects` called again), not in E2E.
