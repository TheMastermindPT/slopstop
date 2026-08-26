---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop
branch: decision/ticket-57-completion-proof
commit: 975776b
status: accepted
research_files:
  - .rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md
  - .rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md
tags:
  - solutions
  - ticket-57
  - tdd
  - completion
  - proof-chain
open_questions: []
---

# Ticket 57: Test-First Completion Proof

## Problem Statement

Completion must be justified by exact, inspectable evidence rather than by Worker claims, a green command alone, or a checklist that merely links requirements to tests.

## Constraints

- Test-first is the default discipline, not a mandatory global pipeline.
- A plan may contain an explicitly approved discipline exception with alternative proof.
- Completion and Integration remain separate facts.
- Candidate composition can invalidate proof that was green in individual Worker workspaces.

## Current State

The product requires red-green behavior proof at an agreed public seam, followed by a separate review/refactor gate. Evidence owns completion authority; Execution only consumes a precise authorization.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Clause Coverage Ledger | Simple requirement coverage | Can become a tautological checklist | Retain as a projection |
| Test-First Proof Chain plus Completion Matrix | Strong causal and scope lineage | Needs explicit non-TDD exceptions | Retain as the evidence basis |
| Predicate-Based Completion Certificate | Machine-verifiable extensibility | A generic rule language can certify the wrong intent | Defer |
| Proof chain plus fixed rules | Strong proof and visible automatic decision | Rules may accidentally become a mandatory pipeline | Provisional recommendation with policy typing |

## Accepted Direction

Store immutable typed observations and evaluations for baseline, Red, Green, unchanged reruns, review, and approved exceptions. Build the Proof Chain through exact Evidence references. Derive a Completion Matrix by contract clause for human inspection.

Use a small, versioned, contract-specific completion rule set rather than a generic predicate language. The rules evaluate the approved Behavior, Test, and Completion contracts and their exact policy epoch. A strict TDD plan requires Red and Green. An approved exception requires its declared alternative proof instead.

Resolve discipline from an append-only Application default decision or the exact override child of an accepted Project-profile revision. Each applicable Run policy epoch references one ordered immutable Run discipline decision; amendments may append later decisions without rewriting the decisions retained by historical invocations, Evidence, or authorizations.

When all required evaluations are current and no blocking condition remains, Evidence exposes exact Completion readiness over its current evaluations, rule versions, Findings, Candidate or permitted typed non-repository subject, and contract revisions. The user must then accept, reject, or request changes against that exact proof. Only a current Evidence-ready result plus the exact accepted user decision can produce one immutable `CompletionAuthorization`; it is not a second mutable completion state.

Completion Finding snapshots reference immutable Finding evaluations and accepted decisions while copying the observed materialized-current version and hash. Discipline exceptions and Run change classifications remain immutable proposals; separate append-only supersession records express replacement or explicit absence, and current applicability is derived from exact acceptance, no supersession, and unchanged pinned inputs.

## Parallel Worker Semantics

- A Worker may prove its own Delegation task on its sealed result.
- Proof inherited by a dependent Worker is pinned to the exact predecessor result.
- The fan-in Candidate receives a fresh final validation scope.
- Composition-sensitive proofs rerun on the Candidate tree.
- The Run cannot complete by summing green sibling results.

## Risks And Mitigations

- Checklist theater: require evidence semantics and exact scope, not only links.
- Mandatory pipeline: select proof obligations from approved contract and policy, not from one universal sequence.
- Stale Green: invalidate when Candidate, command set, toolchain, lockfile, rule version, or relevant Finding changes.
- Duplicate authority: keep matrices and UI certificates as projections of Evidence evaluations.

## Approval

The user approved the Proof Chain, derived Completion Matrix, versioned fixed rules, and immutable Completion Authorization as the final direction for ticket 57.

## Complexity

High. The first implementation can support only the initial behavior and exception rule sets without a generic rule language.

## References

- `PRODUCT.md`
- `CONTEXT.md`
- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- GitHub issue `#57`
