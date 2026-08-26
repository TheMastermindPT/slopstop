---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop
branch: no-branch
commit: 975776b
status: accepted
research_files:
  - .rpiv/artifacts/research/2026-08-14_12-09-42_custom-coding-harness-options.md
  - .rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md
  - .rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md
tags:
  - solutions
  - ticket-58
  - agent-runtime
  - provider-portability
  - turn-control
open_questions: []
---

# Ticket 58: Provider-Neutral Agent Runtime Contracts

## Problem Statement

The harness must run bounded agent turns across providers and optional agent runtimes without allowing any provider, model, or runtime database to own canonical Run or Worker state. Each invocation must remain attributable, portable, pausable, and recoverable.

## Constraints

- Execution remains the sole owner of Run and Worker transitions.
- A Model attempt is the durable attributed record of one admitted provider-dispatch attempt, not proof by itself that the provider was invoked and not a competing aggregate.
- Tool access, budgets, provider, model, context, and completion authority must be pinned to an approved Run policy epoch.
- Runtime output is an observation or proposal, never canonical domain truth.
- Parallel Workers each own an independent sequence of turns; the Waypoint parent owns fan-out and fan-in.

## Current State

No production agent loop exists. ADR 0007 already fixes aggregate authority and attributed Model attempts. Current Mastra agent/session APIs are useful precedents but are beta surfaces and cannot define the durable contract.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Sealed Invocation Packet | Strong provider-neutral boundary per call | Does not by itself own the sequence between turns | Retain as a value object |
| Coordinator-Owned Turn Machine | Explicit Run pause, Worker stop, retry, and recovery sequencing | Can duplicate Worker state if modeled as another aggregate | Retain as internal Execution mechanism |
| Runtime-Owned Session with Conformance Ledger | Reuses framework memory and loop features | Runtime drift, beta APIs, and competing authority | Keep only behind an adapter |
| Combined contract | Preserves authority and portability | Requires strict separation between lifecycle and invocation data | Provisional recommendation |

## Accepted Direction

Use a harness-owned Turn Machine inside the Execution runtime. It may prepare one immutable Sealed Invocation containing the exact proposed inputs before dispatch policy is settled. A policy or command rejection creates no Model attempt. For an admitted provider dispatch, Execution persists Recovery Journal `started`, creates and flushes one Model attempt referencing the admitted seal, and only then crosses the adapter boundary. The attempt distinguishes `proven-not-started`, `provider-invocation-observed`, and `invocation-uncertain`; this pre-boundary identity is required so a crash after a possible external call cannot leave provider evidence, late output, cost, or uncertainty without an exact durable owner. External runtimes and providers consume only admitted records through adapters and emit normalized attributed observations that Execution records.

The Turn Machine is not a new domain aggregate. Durable state remains in Run, Worker, Model attempt, Control request, Process job, and recovery records. Only validated Execution commands may move Worker state.

## Proposed Contract Shape

- `SealedInvocationId` identifies one immutable candidate invocation input that command or policy admission may reject before a Model attempt exists.
- The record pins Run, Waypoint parent or Worker, Delegation task when applicable, plan revision, policy epoch, workspace/result input, provider, model, tool policy, budgets, exact Invocation context record, and completion expectations.
- Conversation keeps its response-message-bound Context record. Execution separately owns an Invocation context record for each Waypoint-parent or Worker candidate, including purpose, ordered sources, inclusion/exclusion reasons, trust/scope, token contribution, provider delivery mode, typed retrieval, recent turns, compaction inputs/output, transformations, artifact hashes, and deterministic output hash. Model-based compaction uses a normal specialized `context-compaction` Sealed Invocation, Command, Recovery Journal, Model attempt, usage and budget, and produces an artifact only for a later context record; no recursive or unreported call is allowed.
- A `ModelAttempt` references the admitted sealed invocation, provider request identity when available, closed normalized usage and output observations, output artifact, Command ID and fingerprint, Declared effect set, Recovery Journal reference, and exact boundary classification. `provider-unavailable` and `model-unavailable` are distinct from generic provider rejection and failure, and only those explicit availability observations enter model recovery behavior.
- Every complete model-visible tool proposal receives one durable Tool invocation identity. Before any rewrite, persist validation of its proposed effect classification, declared scope, risk class, required approval, Capability, schema, and policy. Only an accepted result permits an explicit project-owned rewrite. Proposed and final authorized argument artifacts and hashes, rewrite source/reason, and original/final risk and effect classes remain explicit; the complete validation reruns on final arguments, while command and effect fingerprints bind those final arguments. Adapters and providers cannot rewrite arguments invisibly.
- Read-only typed retrieval is distinct from mutating or external effects. Its exact typed result enters the Invocation context record and only then becomes an explicit input to a later Sealed Invocation; effectful tool calls follow ADR 0008 idempotency and recovery identity.
- The adapter may use Mastra or another runtime internally, but its sessions, retries, callbacks, and storage have no canonical authority.
- Run pause/cancellation and Worker stop are separate controls whose portable checkpoints prove zero in-flight Model attempts and Tool invocations, not only process/effect quiescence. Worker availability failure creates a typed warning-time effect snapshot and Worker stop request; final stop facts are separate Evidence-backed classifications that may refine uncertainty. Same-model Retry or an approved linked model replacement is unavailable while the Run is `recovery-required` or another recomputed blocker prevents dispatch. The advertised Cancel action submits `RequestRunCancellation`; task-level redirection or removal uses Change request.
- Model change follows `pending-approval -> approved -> applied`, with explicit rejection and supersession. `/model` and the graphical picker submit the same request. Approval creates a non-current profile revision and policy epoch; applying a healthy Waypoint-parent change affects future parent invocations and later inheriting Workers while preserving existing Workers and explicit overrides, and applying a stopped-Worker change creates only a linked replacement. No path selects fallback automatically.
- Waypoint-parent `provider-unavailable` or `model-unavailable` adds only its matching blocker, closes new Worker dispatch, and queues active Worker results. `RecoverWaypointParentModel` removes only the proved condition and recomputes every other blocker; `blocked -> running` occurs only when dispatch is otherwise legal. `ApplyRunRecoveryReconciliation` provides the separate Evidence-backed exit from `recovery-required` using the same remove-one-condition and full-recompute rule before retry or replacement.
- ADR 0006 application Workspace identity and ADR 0008 Execution Run-workspace identity remain separate. AgentRuntime and effect records reference `run_workspaces`, never application `workspaces`.
- Shared adapter conformance and the exact real-provider expansion gate both require same-model stopped-Worker retry, generic rejection, generic failure, `provider-unavailable`, `model-unavailable`, timeout, cancellation, and effect recovery; a weaker real-provider proof cannot justify portfolio expansion.

## Interaction With Parallel Workers

Each Worker attempt has its own Turn Machine instance and sealed invocations. The Waypoint parent owns logical fan-out, fan-in, and result synthesis under the approved Task DAG, while the deterministic Application coordinator owns dispatch admission. No Worker creates another Worker, and no provider runtime controls fan-out or fan-in.

## Risks And Mitigations

- Duplicate Worker and Turn state: keep the Turn Machine internal and reconstruct it from command settlements, Model attempts, Tool invocations, Control requests, and recovery records.
- Oversized invocation records: store large content as artifacts and keep an immutable manifest in the record.
- Provider-specific capabilities: translate only through a versioned adapter capability report; do not leak provider vocabulary into domain state.
- Runtime version drift: conformance tests exercise the adapter contract, while domain recovery remains runtime-independent.

## Approval

The user approved the combined contract as the final direction for ticket 58 and as a dependency of ticket 60.

## Complexity

High. This is a durable boundary design; implementation effort is intentionally not estimated before the implementation plan.

## References

- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `PRODUCT.md`
- `CONTEXT.md`
- GitHub issue `#58`
