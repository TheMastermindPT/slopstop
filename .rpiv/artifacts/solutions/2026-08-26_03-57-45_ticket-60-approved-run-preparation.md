---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop
branch: decision/ticket-60-approved-run-preparation
commit: 9695484
status: accepted
research_files:
  - .rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md
  - .rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md
tags:
  - solutions
  - ticket-60
  - approval
  - delegation-plan
  - policy-epoch
open_questions: []
---

# Ticket 60: Approved Run Preparation

## Problem Statement

A user must understand and approve the exact authority basis before a Run dispatches work. The basis must support provider selection, capabilities, budgets, workspace topology, independent parallel tasks, dependencies, and later plan amendments without rewriting history.

## Constraints

- There is no generic mutable Run revision.
- Contracts, Project profiles, Delegation plans, capabilities, and policies retain independent revision identities.
- Added authority requires fresh approval. Later restrictions may apply live where policy permits.
- Resolver work created after a composition conflict is new work, not a retry of an existing task.

## Current State

The domain already defines immutable Delegation plan revisions, Delegation tasks, Run policy epochs, and exact revision pinning. Parallel mutating Worker workspaces require the plan to declare independence and exact baseline dependencies.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Sealed Preparation Snapshot | Clear all-or-nothing approval | Small changes appear to invalidate everything | Retain as the user-visible epoch view |
| Approval Dependency Graph | Selective invalidation | Can become a second approval authority | Retain only as a derived index |
| Run Charter Epochs | Explicit evolution through approved versions | A flexible charter can hide what was pinned | Retain as `Run policy epoch` |
| Sealed epoch plus distinct graphs | Coherent approval and parallel execution | Three apparent sources of truth | Provisional recommendation after simplification |

## Accepted Direction

Use the existing Run policy epoch as the immutable authority basis. First seal a non-authoritative Run approval proposal and its complete view. Initial preparation always includes a complete resolved Run-profile proposal, including inherited values and exact sources. A separate generic approval transaction then creates the accepted Delegation plan revision, Delegation-task identities, Task DAG, exact proposed Run-profile revision, and epoch; the epoch references the earlier proposal hash plus the approval decision and receipt. The current Run profile is reached only through the current epoch.

Store provisional task nodes only in a Delegation-plan proposal. Rejection creates no accepted task identities. Store the Task DAG only inside the plan revision created by approval, and derive ready, blocked, fan-out, and fan-in views from that immutable DAG plus current Worker facts.

An Approval Dependency Graph may exist only as a rebuildable reverse index that explains which approved references are affected by a proposed change. It never decides authority. The policy epoch and current dispatch preconditions decide applicability.

## Parallel Worker Rules

- The plan proposes which mutating tasks are independent and therefore eligible for isolated workspaces.
- The user approval of the epoch authorizes that fan-out.
- Sibling tasks reference the same exact immutable input snapshot.
- A dependent task references one exact predecessor result or one materialized immutable input composed from all required predecessors.
- The composition order is deterministic and part of the sealed task-input provenance; Candidate provenance remains separately owned.
- A conflict does not create an implicit Worker. It creates Attention and requires a Run amendment request whose generic approval creates the accepted revised plan and new policy epoch before a Resolver Worker may dispatch.

## Cross-Graph Invariant

The Task DAG is the only precedence graph. Evidence required to approve a task must be preparation evidence or be produced by an earlier Task-DAG predecessor. In-run evidence cannot authorize the same task that must produce it. The approval invalidation index adds no precedence or authorization edge and therefore cannot participate in that cycle.

## Risks And Mitigations

- Duplicate DAGs: persist dependencies only in the Delegation plan revision.
- Hidden partial approval: always show the complete sealed proposal view plus a diff from the previous epoch.
- Resolver bypass: require a new task identity, plan revision, epoch, sealed invocation, baseline, budget, and effect scope.
- Carry-forward ambiguity: seal every task, Worker, result, carried result, and already-started effect classification as an immutable child of the exact Run amendment proposal and show it in the view. Every correction allocates a new complete child set and owner-bound hash even when values repeat; no proposal reuses another proposal's rows. Approval accepts that set, while the epoch references it without copying the rows.
- Amendment overreach: admit only compatible Run amendment requests. An incompatible submission persists the mandatory rejected command receipt and idempotency settlement but creates no request or lifecycle write. Contradictory intent uses the existing `SupersedeRun` authority and a separate new Run.

## Approval

The user approved immutable Run policy epochs, one plan-owned Task DAG, and a non-authoritative invalidation index as the final direction for ticket 60.

## Implemented Decision

`docs/adr/0011-approved-run-preparation-and-amendment-authority.md` records the complete implementable authority, command, transition, persistence, query, fan-out, fan-in, amendment, carry-forward, Resolver, and issue-closure contract.

## Complexity

High. The authority model is essential; advanced invalidation indexes can be deferred.

## References

- `docs/adr/0011-approved-run-preparation-and-amendment-authority.md`
- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- `CONTEXT.md`
- `PRODUCT.md`
- GitHub issue `#60`
