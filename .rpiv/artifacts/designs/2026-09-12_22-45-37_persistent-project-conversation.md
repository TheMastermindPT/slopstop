---
date: 2026-09-12T22:45:37+0100
author: Pedro Mesquita
commit: 97678d2
branch: main
repository: slopstop
topic: "Persistent primary Project Conversation — PC-S1 final intent oracles"
tags: [design, conversation, workspace, persistence, ragnarok]
status: superseded
superseded_by: .rpiv/artifacts/designs/2026-10-09_13-54-08_conversation-c1-local-save.md
last_updated: 2026-10-10T12:00:00+0100
last_updated_by: Claude Code
last_updated_note: "2026-10-10: status set to superseded; PC-S1 merged in reduced scope at e748604 (add-repository and remove-from-list) and conversation saving is now owned by the C1 design 2026-10-09_13-54-08_conversation-c1-local-save.md. Design content unchanged."
content_hash: 62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e
---

# Persistent Primary Project Conversation — PC-S1 v4

## Intent And Contract Identity

This is a narrow test-contract amendment to the approved direction for PC-S1: register/list/select/reopen developer-trusted local Git repositories before persistent Conversation. Retain every effective v3 commitment, scope limit, authority, deferred outcome and behavior ID. No additional feature, source build or integration is authorized here.

The entire v3 brief is preserved at `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v3-brief.md`, raw SHA-256 `e4b0cf7447f361aea1235fede2d4bd877f5df54059d8c7ffa69264eb84ae1f9e`, content hash `d4fe47ccce00a2cdf00fd9e93854fceb446d80239c8eaf8b1394a19b9527c66d`. Resolve its complete v2/v1 inheritance using their recorded raw hashes. This v4 adds only the two exact oracles below; it replaces no requirement. Effective contract is unchanged v1 → explicit v2 replacements → explicit v3 replacements → these v4 additions. Frozen references are the canonical owners of retained clauses, not optional background reading.

## Architecture And Decisions

Unchanged from v3, including D1–D10, prototype trusted-local confirmation, executable two-stage consent, exact durable replay, physical identity, canonical attachment, registry compatibility and observer lifecycle. Strong hostile-config/OS-network confinement stays deferred as ISOL-1 by explicit developer approval. Confidentiality, no application-issued network/helper/hook/model commands, no repository mutation and safe persistence remain mandatory.

## Next Slice

`PC-S1`, with PC-B1…PC-B12 preserved. This amendment does not add or rename a slice. No candidate exists; build workspace, permissions and exact intent acceptance remain pending the full review and developer decision. Conversation messages and later milestones remain deferred as in v3.

## Test Contracts

### PC-B9 — Exact trust selection binding (addition)

- Seam: real registration transport and renderer through preload in Electron.
- Tests: `does not reuse trusted-local consent for another selection` and `requires renewed trust after selected directory replacement` in `apps/harness/tests/integration/project-registration.integration.test.ts` and `apps/desktop/tests/e2e/project-registration.test.ts`.
- Oracle A→B: obtain trusted-local decision for native selection/proposal A. Submit B's distinct selection/proposal while presenting A's decision. Return `unavailable / REPOSITORY_TRUST_REQUIRED`, launch zero identity queries, create no Project/Storage reservation and preserve active selection. The UI presents the new decision bound to B; only explicit acceptance for B permits its normal observation. A's retained decision history is not rewritten.
- Oracle replaced A: after decision capture, replace the selected directory before observer admission so the physical selection identity differs. Reusing its old decision returns `REPOSITORY_TRUST_REQUIRED`, zero identity queries/reservations, and a new visible decision tied to a freshly captured selection. Declining still spawns nothing; acceptance permits fresh observation only under all other guards. Do not retarget an old decision by rewriting its path or identity.
- The corresponding existing D6 refusal is now named `unavailable / REPOSITORY_TRUST_REQUIRED`; it is distinct from a deliberate user cancellation. Exact trusted-local selection means the selection's recorded physical identity, not path text alone. This oracle concerns a changed identity observable at admission; it does not claim the deferred hostile-race sandbox guarantee.
- Expected red: registration has no production consent-binding path yet. A permissive scaffold that accepts any consent would dispatch B/replaced-A incorrectly; minimal interface scaffolding must expose that behavioral failure rather than rely on missing imports.

### PC-B10 — Replacement during version dispatch (addition)

- Seam: public registration observer port, with deterministic executable-identity/child observations; retain the real executable integration control from v3.
- Test: `invalidates a version result when executable identity changes during dispatch` in `apps/harness/src/project-registration-observer.test.ts`.
- Oracle: accept stage-one version inspection for executable E1, start the one bounded `--version` child, then change the observed executable identity to E2 before the post-dispatch verification. Even if output is a syntactically valid version and exit/EOF are successful, return `unavailable / GIT_CONFIRMATION_REQUIRED`; publish no reusable validated version grant or stage-two eligibility; launch zero identity queries. Retain the original user's consent intent and failed/invalidation attempt history rather than deleting or relabelling them as successful validation.
- A subsequent attempt must first obtain stage-one consent for E2 and complete its new before/after identity check, then stage-two consent. It cannot reuse E1's successful-looking stdout. An unchanged E1 control produces the expected version result and still requires explicit stage-two consent before identity queries.
- Expected red: the new observer lacks the post-dispatch bound validation path; a scaffold checking only identity before spawn would accept the stale version result.

### Success Criteria

Retain all v3/frozen inherited success criteria. These additions require fresh intent inspection; they are not evidence that a test or application ran. Keep failure/cancellation/result-history distinctions and all stage/cleanup precedence rules. No source/test files are created during this revision.

## Deferred Work

Unchanged from v3, including ISOL-1 and following Conversation/model/Frame/Board milestones. No previous mandatory PC-S1 proof has been deferred by adding these examples.

## Verification Notes

v3 slice and code intent reviews passed; coverage identified only these two finer-grained oracle gaps. Overall v3 remains failed. Its report is `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v3-review.md`. This revision is a coordinator elaboration of already-approved D6/D8 behavior under ongoing technical correction, not a fabricated new human policy decision. All required reviewers receive the same new composite binding and must report against it.

## Developer Context / Follow-Up

All recorded user decisions remain unchanged: Conversation-first, new Project records with old-data preservation, one Project for linked worktrees, installed trusted Git, allowed effective local config reads without disclosure/helpers, and deferred strong isolation for the trusted-local prototype. Exact v4 intent acceptance is not implied by those earlier decisions.

The canonical artifact path is unchanged; v3's prior raw bytes were moved intact to the snapshot above. Historical packets resolve their old canonical path to the corresponding snapshot. Preserve v1/v2/v3 outcomes and evidence unchanged; there is no TDD execution or accepted candidate to transfer.

## References

- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v3-brief.md` and its fully hashed v2/v1 contract owners.
- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v3-review.md`
- `.rpiv/artifacts/evidence/2026-09-13_pc-s1-intent-v3.json`
- [Delivery #85](https://github.com/TheMastermindPT/slopstop/issues/85)
