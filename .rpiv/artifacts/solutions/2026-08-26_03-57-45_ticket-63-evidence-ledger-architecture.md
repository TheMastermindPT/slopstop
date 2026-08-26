---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop
branch: decision/ticket-63-evidence-ledgers
commit: 975776b
status: accepted
research_files:
  - .rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md
tags:
  - solutions
  - ticket-63
  - evidence
  - ledgers
  - provenance
open_questions: []
---

# Ticket 63: Evidence Ledger Architecture

## Problem Statement

Evidence must preserve immutable observations, exact scope, provenance, current authoritative evaluations, and historical decisions across baselines, Worker results, tests, Findings, effects, Candidates, and Integration.

## Constraints

- Missing, broken, stale, ambiguous, rejected, truncated, and uncertain never degrade to clean.
- Execution requests and consumes exact Evidence references but does not compute competing evidence truth.
- A current row and its history may coexist only when they advance atomically under one owner.
- Different evidence families do not share a universal verdict vocabulary.

## Current State

ADR 0006 requires directly queryable current authority plus append-only history. ADR 0008 assigns Run-workspace fingerprints, deltas, recovery observations, effect reconciliation, and safety proofs to Evidence.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Separated ledgers with current evaluations | Clear family ownership and fast reads | Repeated provenance rules | Retain |
| Typed family ledgers | Strong family-specific states | Concept fragmentation | Retain with a narrow common core |
| Content-addressed Evidence graph | Rich provenance and integrity | Graph storage and reachability become domain complexity | Reject as the primary authority model |
| Common core plus typed ledgers and current evaluations | Shared identity without shared verdicts | The common layer can grow too broad | Provisional recommendation |

## Accepted Direction

Define a narrow common Evidence envelope for identity, schema version, producer, subject, Run-workspace, Task-workspace input, Candidate and result fingerprints, artifact references, timestamps, trust basis, and integrity. Each Evidence family owns typed observations, evaluations, decisions, a closed verdict vocabulary, and materialized current evaluations.

The append-only ledger records history. The directly queryable current row stores the accepted current evaluation and references the exact evaluation and decision entries. Both update in one transaction. Divergence is `broken`.

Hashes protect artifact integrity and reproducibility but do not replace durable domain identities.

## Evidence Scope For Parallel Workers

- Worker-local Evidence references the Worker attempt, exact Task workspace, immutable input snapshot, and Worker result.
- Sibling evidence never closes or authorizes another branch implicitly.
- A dependent task starts from a sealed input snapshot, not a live predecessor worktree.
- Candidate validation references the materialized Candidate identity and fingerprint.
- Green evidence from separate branches is not Completion evidence for the combined Candidate.

## Family Boundaries

- Test and completion evaluations use test-specific states and rule versions.
- Finding decisions use stable Finding identity and decision semantics.
- Effect reconciliation distinguishes process observations from effect certainty.
- Candidate and Integration evidence pin exact source and target fingerprints.
- Compound code anchors preserve semantic location independently of line drift.

## Risks And Mitigations

- Universal verdict creep: keep shared fields structural, not semantic.
- Competing current evaluations: prohibit independent writes to history and current rows.
- Stale projections: store evaluation inputs and rule versions; stale is visible.
- Premature graph platform: use explicit typed references and add indexes only for measured queries.

## Approval

The user approved the common Evidence envelope plus typed family ledgers and atomic current evaluations as the final direction for ticket 63.

## Independent Review Closure

ADR 0010 closes the accepted direction at implementation-design depth. It defines exact family verdicts, scope-safe current-evaluation keys and accepted decisions, mutually exclusive current-location anchor outcomes plus a historical-only path, durable rerun producer starts, evaluator identity/version/hash dependencies, versioned Artifact state and journalled retention, Candidate technical verdicts separate from user actions, typed reverse invalidation, discriminated Artifact provenance, concrete table families and indexes, and explicit ticket-criteria coverage without moving Run-workspace or producer lifecycle ownership out of Execution. Model and Tool adapters only emit attributed observations. ADRs 0006 and 0008 also distinguish application `workspaces` from Execution `run_workspaces`.

## Complexity

High. Typed evidence families are core; generalized plugin and graph mechanisms can be deferred.

## References

- `docs/adr/0006-physical-persistence-layout.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `CONTEXT.md`
- GitHub issue `#63`
