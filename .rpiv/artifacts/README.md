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
- `research/2026-08-26_17-25-29_evidence-result-size-limits.md` measures local repository proxies, documents the confidence limits behind ticket `#78`, and recommends the provisional Evidence result-limit profile later accepted and completed by ADR 0019.
- `research/2026-08-26_18-25-37_ticket-77-artifact-retention-threshold-basis.md` records the low-confidence local measurements, evidence gaps, accepted provisional thresholds, free-space-floor sanity check, and mandatory recalibration gate for ticket `#77`.
- `research/2026-08-30_23-53-59_convergence-proof-bundle-contract.md` traces the cross-owner proof inputs for ticket `#75` and defines the request-scoped identity, typed membership, ordering, boundedness, and direct-validity basis later accepted by ADR 0020.
- `research/2026-08-31_16-13-56_project-storage-opening-health.md` defines the smallest durable Project Storage slice, independent canonical/runtime health, prior-state witness handling, and the harness-owned persistence boundary.
- `research/2026-09-02_19-16-24_harness-capabilities-and-next-step.md` records the accepted recovery sequence for schema authority, shutdown, privacy, bounded logs, prospective TDD, tracker repair, and packaged Project Storage proof.
- `research/2026-09-19_jev-typesafe-primary-sources.md` examines Jev's official capabilities, limitations, privacy and public demos, maps advisory uses to Ragnarok, and records future ideas JEV-F01 (Worker-team composition) and JEV-F02 (governed self-improvement, outside v1 and a possible v2 direction). It recommends evaluating Conversation correction detection first; it is research and deferred exploration, not integration approval or production evidence.
- `research/2026-10-03_jev-ragnarok-benefit-update.md` refreshes Jev's official capabilities, limits, confidence semantics and agent-evaluation evidence, ranks potential benefits for Conversation/context/Workers, and proposes a bounded evaluation without approving integration or sending private project data.
- `research/2026-10-03_skill-procedures-synthesis.md` inventories skill sources and extracts reusable procedures from RPIV, shared skills and enabled Claude plugins. Records concrete complementary/conflicting policies and a proposed evaluation method; discussion with Claude and product adoption remain later human decisions.
- `research/2026-10-03_effect-alchemy-bun-strategic-fit.md` compares current primary-source capabilities with Ragnarok's actual Electron, Node, native-process and persistence boundaries. Separates incremental Effect adoption, Alchemy infrastructure use and Bun tooling/runtime changes; records costs, uncertainties and discussion questions without approving any migration.
- `research/2026-10-03_effect-migration-collaboration-brief.md` records the subsequent human choice of a full Effect migration and onboards the existing Claude Herdr session to the broader product, roadmap, current implementation, pending work and strategic questions. Agent proposals remain subject to human decisions.
- `research/2026-10-03_effect-collaboration-proposal.md` records the actual OpenCode/Claude discussion, corrections and joint full-migration/workflow proposal, with four grouped human choices and a separate broader product-strategy agenda. No new architecture choice is approved by agent agreement alone.
- `research/2026-10-03_product-thesis.md` proposes the product thesis (trust and understanding, not code generation), using the 2026-10-03 manual multi-agent coordination protocol as product specification evidence, with three primary metrics and roadmap consequences pending user decision.
- `research/2026-10-03_inspiration-projects-research.md` surveys Kiro, Spec Kit, Copilot Workspace, Conductor, Vibe Kanban, Aider, Hermes Agent and Prime Agent with sourced mechanisms and criticisms, and lists adoption candidates without approving any.
- `research/2026-10-04_cheap-and-local-model-options.md` prices cheap hosted models (OpenAI, Gemini, DeepSeek, Mistral, OpenRouter) and local models on the user's RTX 3070 for the Conversation workload, with privacy terms and five candidates for paired evaluation.
- `research/2026-10-04_agent-runtime-options-discussion.md` compares ADR 0009 runtime options under verified provider terms; the user chose the hybrid direction to spike (official CLIs as governed Workers, direct Anthropic API for Conversation/Frame, no Mastra on this path) before revising ADR 0009.
- `research/2026-10-03_provider-subscription-terms.md` verifies Anthropic, OpenAI, Google and Copilot rules for subscriptions versus APIs from third-party apps: orchestrating unmodified official CLIs under the user's own login is lowest-risk, reusing subscription tokens is prohibited at Anthropic and Google, and the hybrid runtime remains a proposal.
- `research/2026-10-03_effect-sql-windows-experiment.md` records the authorized disposable SQL experiment: basic transactions pass, but immediate post-close file release differs between the current worker and direct clients. It preserves uncertain-commit semantics and leaves the final client choice to the user.

## Solutions

- `solutions/2026-08-22_22-52-33_end-state-comprehension-strategies.md` compares and exercises Future Walkthrough, Expectation Cards, Prediction Game, and Traceable Mirror before recording the accepted adaptive comprehension approach.
- `solutions/2026-08-26_03-57-45_ticket-57-test-first-completion-proof.md` records the accepted typed Test-first Proof Chain, derived Completion Matrix, fixed contract-specific rules, and immutable Completion authorization for ticket `#57`.
- `solutions/2026-08-26_03-57-45_ticket-58-provider-neutral-agent-runtime.md` records the accepted Execution-owned Turn Machine and immutable Sealed Invocation boundary for provider-neutral, attributable, pausable, and recoverable Model attempts.
- `solutions/2026-08-26_03-57-45_ticket-59-effect-reconciliation.md` records the accepted stable effect identity, immutable declaration, Recovery Journal, typed observer, atomic current-outcome, and query-only Effect Dossier architecture for ticket `#59`.
- `solutions/2026-08-26_03-57-45_ticket-60-approved-run-preparation.md` records the accepted immutable Run-policy-epoch authority, plan-owned Task DAG, one sealed approval view, and non-authoritative reverse invalidation index for ticket `#60`.
- `solutions/2026-08-26_03-57-45_ticket-61-parallel-worker-candidate-composition.md` records the accepted isolated Task-resource, immutable Worker-result composition, Candidate manifest, separate Candidate review, and exact target-specific Integration architecture for ticket `#61`.
- `solutions/2026-08-26_03-57-45_ticket-62-finding-lifecycle.md` records the accepted stable Finding aggregate, immutable decision ledger, bounded remediation and recheck authority, and query-only Validation Episode architecture for ticket `#62`.
- `solutions/2026-08-26_03-57-45_ticket-63-evidence-ledger-architecture.md` records the accepted narrow Evidence envelope, typed family ledgers, exact parallel scope, and atomic current-evaluation architecture for ticket `#63`.
- `solutions/2026-08-26_ticket-74-language-observation-intake.md` records the accepted Execution/Language/Evidence ownership split, task-shaped Language operations, proved completion, fenced retries, semantic enrichment, and proposal-only mutation boundary for ticket `#74`.
- `solutions/2026-08-31_20-24-41_self-evolving-harness-and-developer-leverage.md` records Option 4, Resumable Parallel Work Fabric, as the accepted strategic interpretation of the existing v1 portfolio while preserving GitHub roadmap order, current ADR authority, and explicitly deferred supervision and live-replacement mechanisms.

## Current Authority

- Coordination handoff: `handoffs/2026-10-03_21-16-54_claude-project-coordinator.md` transfers coordination from OpenCode to the separate Herdr agent `coordenador-claude`, after a completed read-and-teach-back exchange. The existing `claude` session remains the implementation author; the handoff distinguishes current approvals, unfinished migration/feature work and deferred strategy.
- `evidence/2026-10-03_baseline-measurement-log.md` is the running five-line-per-task baseline log of work done before Ragnarok (baseline project: a copy of MaxReps, the user's gymapp; chess no longer used).
- `evidence/2026-10-03_pc-s1-guarantee-scope-decision.md` records three user decisions: reduced PC-S1 scope (additional worktree association and Linux deferred, recovery detect-only, reduced limit matrices; data/trust guarantees retained), application.db verify-before-commit with approved oracle changes, and checkpoint commits on the Effect branch without merge or push.

- `plans/2026-08-25_14-53-19_workspace-production-boundary-tracer-bullet.md` is the implemented five-phase Workspace production-boundary plan.
- `validation/2026-08-25_20-05-32_workspace-production-boundary-tracer-bullet.md` records its final runtime, mutation, and Code Health proof.
- `validation/2026-08-25_23-26-11_workspace-supervision-prototype.md` records the accepted fixture-backed prototype, automated journey, Code Health, and degraded-gate Evidence.

- `PRODUCT.md` summarizes durable confirmed product truth.
- `docs/adr/` records SlopStop implementation decisions made after the imported artifacts.
- `.rpiv/decisions/` contains standing rules that bind future work.
- Repository source is the only authoritative implementation.
