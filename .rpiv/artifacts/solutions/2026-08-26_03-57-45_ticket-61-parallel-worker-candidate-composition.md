---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop-ticket-exploration
branch: no-branch
commit: 975776b
status: accepted
research_files:
  - .rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md
  - .rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md
tags:
  - solutions
  - ticket-61
  - parallel-workers
  - candidate-delta
  - worktrees
  - integration
open_questions: []
---

# Ticket 61: Parallel Worker Candidate Composition

## Problem Statement

Independent mutating Workers should be able to work in parallel without touching the target or hiding conflicts. Their exact results must compose reproducibly into one Candidate that can be validated, approved, applied, recovered, and audited.

## Constraints

- Parallel fan-out is authorized only by an accepted Delegation plan and approved policy epoch.
- Workers do not nest.
- A live worktree is never an input or result contract.
- Composition conflict stops progress; it is never silently resolved.
- Candidate validation happens before target apply.
- Target changes invalidate apply approval rather than entering the Candidate silently.

## Current State

ADR 0008 and current product text assume one primary Run workspace and at most one mutating Worker. That design does not represent the selected parallel mutating topology and requires material revision. Current implementation is still early enough to make this choice deliberately.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Linear Delta Chain | Simple exact lineage | Cannot represent independent sibling mutation efficiently | Retain within a branch and for dependent tasks |
| Provenance Overlay Manifest | Cheap, attributable virtual composition | Branch tests do not prove the combined state | Retain inside CandidateDelta |
| Materialized Candidate Tree | Tests the actual combined bytes | Physical tree can be mistaken for authority | Retain as a managed resource or rebuildable artifact |
| Branch chains plus manifest plus materialization | Supports fan-out, auditability, and final proof | Requires explicit workspace, recovery, and composition contracts | Provisional recommendation |

## Accepted Direction

Adopt an approved fan-out/fan-in topology:

1. The Run binds an immutable baseline and one coordination workspace identity.
2. Each eligible mutating Worker attempt receives a separate Task workspace created from one immutable `TaskInputSnapshot`.
3. Sibling tasks share the same exact input snapshot. Dependent tasks use a selected predecessor result. Tasks with multiple predecessors first receive a deterministically composed input snapshot.
4. A successful Worker publishes one immutable `WorkerResult` containing tree/delta identity, baseline, changed paths, artifact hashes, validation references, and exact attempt provenance.
5. Fan-in selects one result per task and creates one immutable CandidateDelta whose payload contains the provenance manifest, deterministic composition order, compositor version, conflicts, resolutions, and resulting fingerprint.
6. Execution provisions an isolated Candidate materialization resource from that immutable CandidateDelta. The tree is a rebuildable physical resource, not a second authority.
7. Final validation runs on a disposable validation copy or generation of the exact Candidate fingerprint. Validation never mutates the sealed Candidate.
8. Integration alone applies the approved immutable CandidateDelta to the exact target fingerprint.

## Conflict And Resolver Semantics

- A textual, structural, policy, or materialization conflict creates a durable failed Candidate generation and Attention.
- Existing Workers remain completed; the Run does not claim partial success.
- A Resolver Worker requires a new Delegation task, plan revision, policy epoch, baseline/input snapshot, budget, effect declaration, and sealed invocation.
- Resolver attempts are bounded and repeated identical conflict fingerprints stop with a stable diagnostic.
- Original Worker results and conflict evidence remain immutable and referenced by the replacement Candidate.

## Required Workspace Model Revision

- Keep a Run-level coordination or baseline binding.
- Add explicit Task workspaces owned by Worker attempts.
- Add composition and Candidate materialization resources with typed principals.
- Coordinate shared Git common-directory resources separately from worktree resources.
- Allow at most one active mutating effect per physical resource, not merely one lease holder.
- Generalize pause, cancellation, recovery, invalidation, retention, and cleanup across the workspace graph.
- Preserve reachability of baselines and results until no live Candidate, validation, Integration attempt, or salvage reference remains.

This requires revising the singular-workspace assumptions in ADR 0008, the singular references in ADR 0007, `PRODUCT.md`, and `CONTEXT.md` if approved.

## Recovery Invariants

- Provisioning intent is durable before Git or filesystem mutation.
- Retries use new Worker attempts and clean workspaces from the same sealed input.
- Worktree paths, branches, and refs are not identities.
- Candidate generations are idempotent by operation identity and immutable manifest.
- Cancellation during fan-in leaves an incomplete, non-applicable generation.
- Apply starts only under exact target fingerprint and resource lease.
- An uncertain or partial apply enters recovery; it is never auto-retried or reported clean.

## Risks And Mitigations

- Hidden semantic conflicts: always rerun final Candidate validation.
- Non-deterministic fan-in: use topological order plus stable task identity and a versioned compositor.
- Shared Git/cache/service collisions: declare resource keys beyond the worktree path.
- Storage growth: use dependency-aware retention and journaled cleanup; never delete uncertain or uniquely referenced work.
- Mini-Git domain: keep Git branches and merge commands inside adapters; domain authority is immutable snapshots, results, CandidateDelta, and typed evidence.

## Approval

The user approved the fan-out/fan-in topology and the required revision of prior singular-workspace decisions as the final direction for ticket 61.

## Complexity

Very high, but it directly enables the selected product capability. The implementation plan should introduce it in vertical slices rather than weaken the durable contract.

## References

- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `PRODUCT.md`
- `CONTEXT.md`
- GitHub issue `#61`
- [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code worktrees](https://code.claude.com/docs/en/worktrees)
- [OpenAI Codex worktrees](https://developers.openai.com/codex/environments/git-worktrees)
- [Git worktree](https://git-scm.com/docs/git-worktree)
- [Git merge](https://git-scm.com/docs/git-merge)
