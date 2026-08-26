# SlopStop RPIV Artifacts

The 2026-08-14 discover and research artifacts were copied byte-for-byte from the `rpiv-claude` repository. Their original frontmatter, source repository, commit, branch, timestamps, and content hashes are preserved as provenance. Later SlopStop decisions do not rewrite those historical records. Newer artifacts produced directly in SlopStop record their own repository provenance.

## Requirements Lineage

1. `discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md` establishes the confirmed product model.
2. `discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md` adds Prime Agent and Oh My Pi mechanisms, test discipline, remediation, and onboarding.
3. `discover/2026-08-14_16-18-18_lsp-debugger-refinement.md` adds first-proof LSP requirements and the post-proof debugger seam.
4. `discover/2026-08-22_19-18-10_workspace-supervision-experience.md` confirms the attention-first workspace, source and Change-review navigation, direct scoped model conversations, scoped models, and isolated React prototype boundary.

## Research

- `research/2026-08-14_12-09-42_custom-coding-harness-options.md` compares agent-runtime and orchestration options, separates Project, Execution, and Conversation graphs, and argues that framework sessions must not own durable Project truth. Some recommendations were superseded by confirmed FRDs; it remains evidence, not current authority.
- `research/2026-08-20_19-27-59_runtime-constraints-program-order.md` verifies Mastra, provider, tool-call, cancellation, idempotency, and crash-recovery constraints that require project-owned Run identity and deterministic gates before production concurrency or effects.
- `research/2026-08-20_20-03-59_v1-program-requirements-coverage.md` maps confirmed requirements, including supervised agent-runtime, context, model-unavailability, and no-fallback behavior, to proposed v1 programs, cross-cutting invariants, and explicit non-goals.
- `research/2026-08-22_workspace-ux-patterns.md` compares primary-source patterns for graph navigation, workspace sidebars and panels, settings access, model selection, and a night-blue inspector hierarchy.
- `research/2026-08-25_14-22-52_workspace-production-boundaries.md` traces current and missing production seams for Conversation, Frame, Review, response-bound Context records, and Memory projections. It identifies a future separate Execution-owned Worker-attempt context record but does not define ADR 0008 Run-workspace or effect-recovery semantics.

## Solutions

- `solutions/2026-08-22_22-52-33_end-state-comprehension-strategies.md` compares and exercises Future Walkthrough, Expectation Cards, Prediction Game, and Traceable Mirror before recording the accepted adaptive comprehension approach.
- `solutions/2026-08-26_03-57-45_ticket-58-provider-neutral-agent-runtime.md` records the accepted Execution-owned Turn Machine and immutable Sealed Invocation boundary for provider-neutral, attributable, pausable, and recoverable Model attempts.
- `solutions/2026-08-26_03-57-45_ticket-63-evidence-ledger-architecture.md` records the accepted narrow Evidence envelope, typed family ledgers, exact parallel scope, and atomic current-evaluation architecture for ticket `#63`.

## Current Authority

- `plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md` is the implemented five-phase Workspace production-boundary plan.
- `validation/2026-08-25_20-05-32_workspace-production-boundary-tracer-bullet.md` records its final runtime, mutation, and Code Health proof.
- `validation/2026-08-25_23-26-11_workspace-supervision-prototype.md` records the accepted fixture-backed prototype, automated journey, Code Health, and degraded-gate Evidence.

- `PRODUCT.md` summarizes durable confirmed product truth.
- `docs/adr/` records SlopStop implementation decisions made after the imported artifacts.
- `.rpiv/decisions/` contains standing rules that bind future work.
- Repository source is the only authoritative implementation.
