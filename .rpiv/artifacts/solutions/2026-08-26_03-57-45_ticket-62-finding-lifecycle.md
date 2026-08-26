---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop-ticket-exploration
branch: no-branch
commit: 975776b
status: accepted
research_files:
  - .rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md
tags:
  - solutions
  - ticket-62
  - findings
  - validation
  - decisions
open_questions: []
---

# Ticket 62: Finding Lifecycle And Recheck Authority

## Problem Statement

A Finding needs stable identity across validation, remediation, recheck, risk acceptance, dismissal, reopening, and changing repository scopes. Validation runs must report evidence without becoming a second owner of Finding state.

## Constraints

- Validators are repository read-only but may append attributed Evidence and propose Findings.
- A recheck uses the same Finding identity.
- Findings from one Worker result do not implicitly transfer to another result or the final Candidate.
- Decisions require exact scope, rationale, authority, and evidence references.

## Current State

The requirements already demand independent validators, bounded remediation handoffs, stable Finding IDs, recheck, and explicit risk acceptance.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Finding-Centred Aggregate | Clear identity and transition authority | Needs durable history | Retain as the authority |
| Validation Episode Coordinator | Understandable validation cycles | Can compete with Finding and Worker state | Retain only as a projection |
| Decision Ledger with Finding Head | Strong audit history | Can become a second state machine | Retain atomically inside Finding ownership |
| Finding aggregate plus decisions and read views | Authority, auditability, and operational clarity | Requires precise append versus decision permissions | Provisional recommendation |

## Accepted Direction

Make Finding the sole aggregate authority for current state and allowed transitions. Every accepted state change appends an immutable Finding decision and atomically advances `currentDecisionId`, state, and entity version. Divergence is `broken`.

Validators append observations and may propose a new Finding or recheck result. They cannot resolve, dismiss, waive, or reopen one directly. A validated command with the required user, policy, or Evidence authority performs the transition.

A Validation Episode is a rebuildable read model grouping the Worker attempt, commands, observations, Findings, and decisions associated with one validation cycle. It owns no repository mutation and no Finding state.

## Parallel Worker Semantics

- Every Finding subject pins a Worker result, Candidate, target, or another exact evidence scope.
- Sibling findings remain separate unless an explicit correlation relates them.
- A stale or superseded Worker result does not erase its Findings.
- Candidate validation may reproduce an existing Finding, create a related Finding, or prove it no longer applies; a typed recheck records that relationship.
- A Resolver Worker receives exact conflict and Finding inputs through a newly approved task.

## Risks And Mitigations

- Two authorities: decisions and current state advance in one Finding transaction.
- Validators with excessive power: separate append permission from decision permission.
- Lost history after supersession: retain all decisions and scopes; current views never delete historical Findings.
- Endless remediation: bound handoffs and Resolver attempts through approved policy.

## Approval

The user approved Finding as the sole authority with immutable decisions, atomic current state, and read-only Validation Episode projections as the final direction for ticket 62.

## Complexity

Medium to high. The aggregate and decision semantics are core; richer episode views can be deferred.

## References

- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- `CONTEXT.md`
- `PRODUCT.md`
- GitHub issue `#62`
