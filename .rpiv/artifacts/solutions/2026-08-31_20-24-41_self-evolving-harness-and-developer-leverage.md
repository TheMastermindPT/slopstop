---
date: 2026-08-31T20:24:41+0100
author: Pedro Mesquita
commit: f4685df
branch: design/ticket-86-project-storage
repository: slopstop
topic: "Safe self-evolution and game-changing developer leverage for SlopStop"
confidence: medium
complexity: high
status: accepted
last_updated: 2026-08-31T21:11:14+0100
last_updated_note: "Option 4 accepted as the strategic interpretation of the existing v1 roadmap; terminology and deferred supervision boundaries aligned with current ADRs and GitHub issues."
tags: [solutions, harness, self-evolution, execution, evidence, recovery, developer-experience]
last_updated_by: Pedro Mesquita
---

# Solution Analysis: Safe Self-Evolution And Developer Leverage

**Date**: 2026-08-31T20:24:41+0100
**Author**: Pedro Mesquita
**Commit**: f4685df
**Branch**: design/ticket-86-project-storage
**Repository**: slopstop

## Research Question

How can SlopStop leverage its harness capacities, where they genuinely exist, to become a safely self-evolving harness? Which original or compositional features could materially improve the lives of developers using LLM coding agents? Research should use current external criticism, self-improving-agent research, and the local Hermes Agent, Prime Agent, and Oh My Pi projects as inspiration without copying their unsafe assumptions.

## Summary

**Problem**: Coding agents generate work faster than developers can confidently understand, review, recover, and integrate it. A self-evolving harness can worsen that problem if it optimizes its own prompts or skills without independent evidence, held-out evaluation, permission governance, and rollback.

**Accepted**: **Resumable Evidence Loop**. After the current canonical trust-spine work, build fail-closed, resumable execution; expose compact proof and recovery at developer decision points; then introduce evidence-gated harness evolution. Keep counterfactual replay as a bounded experimental method, not as a causal authority or standalone customer feature.

**Effort**: High. The complete program is multi-release work because most load-bearing Execution, Evidence, Effect, Artifact, Candidate, and persistence owners are accepted architecture rather than implemented behavior.

**Confidence**: Medium. The pain and architectural fit are strongly evidenced. Originality and adoption depend on execution quality, simplicity, and proving that the product reduces total developer minutes rather than adding governance work.

## Problem Statement

Developers do not primarily need another agent that writes more code. They need agent work to become easier to stop, resume, inspect, prove, review, and improve without losing authority.

External evidence supports that framing:

- Stack Overflow's 2025 survey reports 46% distrust AI output accuracy versus 33% who trust it, while 66% identify almost-right output as a major frustration: https://survey.stackoverflow.co/2025/ai
- Sonar's 2026 survey reports 96% do not fully trust AI-generated code's functional correctness and 38% say reviewing it takes more effort than reviewing a colleague's work: https://www.sonarsource.com/state-of-code-developer-survey-report.pdf
- METR's randomized study found experienced open-source developers took 19% longer with early-2025 AI tools while believing they had become faster: https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- CooperBench reports multi-agent cooperation averaging below solo-agent success in its evaluated setting, with failures around commitments, communication, and partner state: https://arxiv.org/html/2601.13295v2
- Public issue reports document hangs, missing child-agent results, Git contention, destructive cleanup, hidden actions, and runaway token consumption. These prove concrete failure shapes, not population frequency.

### Requirements

- Self-evolution must operate through immutable proposals, not direct mutation of live prompts, skills, policies, tools, or source.
- Promotion must bind exact candidate, evaluator, environment, policy, permission, model, and repository identities.
- Held-out evaluation must report both fail-to-pass improvements and pass-to-fail regressions.
- A model's reflection, rationale, or self-grade is never Evidence authority.
- Uncertain, truncated, stale, missing, conflicting, or broken outcomes never become clean or favorable.
- Developer-facing features must reduce review, recovery, or coordination burden rather than create another dashboard or approval ritual.
- Existing SlopStop authority boundaries remain intact: model output is proposal; Application coordinates; Evidence evaluates; users authorize consequential changes.

### Constraints

- The current harness is a typed Electron process-boundary skeleton, not an implemented agent runtime.
- Production boot currently composes unavailable Workspace owners.
- Canonical persistence, AgentRuntime, Runs, Workers, Effects, Evidence, Findings, Artifacts, Candidates, Completion, and Integration are not implemented in source.
- SlopStop is local-first and must not export source, prompts, model output, secrets, environment values, or full paths through telemetry.
- Automatic model fallback, recursive workers, blind effect replay, and silent isolation downgrade remain prohibited.

### Success Criteria

- Interrupted work resumes or produces an explicit recovery decision without duplicated uncertain effects.
- Developers reach accept, reject, recover, or inspect decisions faster than with raw transcripts, logs, and diffs.
- Harness changes improve held-out repository tasks without protected-task regressions or permission expansion.
- Every promoted harness change is reviewable, reversible, provenance-bound, and invalidated when a mandatory dependency changes.
- The system's north-star metric is lower end-to-end developer time from task start to safely accepted change, including setup, waiting, review, recovery, rework, and repeated model spend.

## Current State

### Existing Implementation

- `apps/desktop/src/main/harness-supervisor.ts:221-272` launches and connects one supervised Electron utility process.
- `apps/harness/src/harness-runtime.ts:39-113` implements a validated, versioned request/event transport with sequence and causation identities.
- `apps/harness/src/workspace-application.ts:42-64` defines narrow Workspace owner ports.
- `apps/harness/src/workspace-application.ts:78-148` preserves unavailable and broken outcomes rather than degrading them to ready or empty.
- `apps/harness/src/process-entry.ts:76-82` deliberately starts with unavailable Conversation, Frame, and Memory owners.
- `packages/protocol/src/workspace-protocol.ts:60-100` exposes only Conversation, Frame, and Memory Workspace capabilities.
- `apps/desktop/src/main/workspace-bridge.ts:254-291` rejects stale projections and deduplicates invalidations by capability, scope, and revision.

### Accepted But Unimplemented Leverage

- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md:30-56` defines immutable Sealed Invocations and complete invocation-context provenance.
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md:32-38` defines mutation leases and external-edit invalidation.
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md:118-148` defines pre-boundary journaling and crash-window reconciliation.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:15-44` assigns family-specific, append-only Evidence authority.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:52-98` defines immutable Worker results, deterministic Candidate composition, independent validation, and exact Integration.
- `docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:80-96` requires direct mandatory-dependency validation before trusted retrieval.
- `docs/adr/0018-artifact-retention-quotas-reservations-and-explicit-removal.md:120-174` defines bounded Artifact capacity and explicit retention/removal authority.

### Relevant Inspiration

#### Hermes Agent

- `C:/Users/pedro/Downloads/hermes-agent-main/tools/skill_ledger.py:387-452` records before/after manifests and content-addressed snapshots for skill mutation.
- `C:/Users/pedro/Downloads/hermes-agent-main/agent/curator.py:233-398` implements lifecycle-aware skill curation and protection rules.
- `C:/Users/pedro/Downloads/hermes-agent-main/agent/learning_graph.py:254-323` projects skills and memories as an inspectable learning graph.
- `C:/Users/pedro/Downloads/hermes-agent-main/evals/compaction/runner.py:37-88,194-293` evaluates compaction as factual recall versus retained-token cost.
- Unsafe transfer to avoid: mutation can succeed when ledger recording fails, curation defaults are stronger than commentary suggests, and lossy compaction may discard unsummarized regions.

#### Prime Agent

- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/refinement/refinement.ts:673-844` uses typed refinements, optimistic concurrency, snapshots, and reverse-order rollback.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/modes/daemon/command-recovery-journal.ts:44-171` separates idempotent delivery retry from unsafe execution replay.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/autonomous.ts:284-468` suppresses unchanged failed quality-gate reruns using worktree fingerprints.
- `C:/Users/pedro/Downloads/prime-agent-main/prime-agent-main/packages/coding-agent/src/core/cron-jobs.ts:1549-1628` persists dispatch claims, coalesces missed work, and records interrupted schedules without replay.
- Unsafe transfer to avoid: model-generated Python and shell commands run with user OS permissions; model-authored rationale is not independent evidence; permissive journal parsing can hide malformed records.

#### Oh My Pi

- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/autoresearch/init-experiment.ts:18-85` defines bounded experiments with metric direction, scope, constraints, and iteration limits.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/autoresearch/log-experiment.ts:38-52,126-215` records keep, discard, crash, and check-failed outcomes and supports retrospective distrust of prior results.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/task/isolation-runner.ts:180-340` captures recoverable branch or patch output and preserves salvage when normal capture fails.
- `C:/Users/pedro/Downloads/oh-my-pi-main/oh-my-pi-main/packages/coding-agent/src/subagent/yield-assembly.ts:96-198` assembles typed incremental handoff sections.
- Unsafe transfer to avoid: agent-declared keep can directly commit, out-of-scope work may survive with a warning, and direct merge/apply behavior bypasses SlopStop's Candidate and Integration authority.

## Solution Options

### Option 1: Evidence-Gated Evolution Foundry

**How it works:**

Verified failures, accepted outcomes, review dispositions, and later regressions produce immutable harness-change proposals. A proposal may modify a typed configuration bundle containing prompt sources, skills, tool descriptions, retrieval settings, model-routing rules, test-selection policy, and retry limits. The proposal is evaluated against calibrated local Golden-PR tasks and protected held-out tasks. Promotion requires explicit permission diffs, fail-to-pass and pass-to-fail matrices, independent grading, human approval, and rollback lineage.

**Pros:**

- Directly answers the self-evolving-harness goal without letting the harness rewrite live authority.
- Aligns with SlopStop's Evidence, Capability, Artifact, approval, and invalidation model.
- Converts recurring developer pain into reviewable, repository-specific improvement.
- Strong differentiation when every evaluation binds exact candidate, grader, policy, model, environment, and repository digests.

**Cons:**

- Most prerequisites are not implemented.
- Golden-PR success can overfit local history and does not establish generalized safety.
- Independent evaluator isolation and hidden-task integrity are hard requirements, not optional hardening.
- Evaluation cost may make developers bypass the promotion path.

**Independent scores:** architecture fit 9/10; developer impact 8-9/10; verification 9/10; originality 6-8/10; prerequisite burden 7-9/10.

**Complexity:** Very high, likely multiple releases after the Execution and Evidence spine exists.

**Smallest wedge:** A read-only Golden-PR replay producer for one manually registered, calibrated fixture. It emits typed replay Evidence but cannot promote or mutate any harness capability.

### Option 2: Counterfactual Failure Laboratory

**How it works:**

Capture replay-eligible runs with exact environment, prompt, policy, capability, workspace, and tool identities. Cluster verified failures, then branch at one declared intervention point while holding every other reproducible input constant. Report deterministic, probabilistic, descriptive, invalid, and privacy-incomplete outcomes separately. Allow users or Workers to challenge prior experiment Evidence without rewriting history.

**Pros:**

- Can test whether a harness variable likely changes outcomes instead of trusting model reflection.
- Fits immutable invocation, Evidence replacement, and contamination semantics.
- Useful internally for fault injection and recovery hardening.
- Evidence challenges are a strong way to prevent benchmark contamination from becoming permanent truth.

**Cons:**

- Hosted models make exact causal attribution impossible.
- Replaying stochastic suffixes is expensive and vulnerable to regression-to-the-mean.
- Raw traces contain highly sensitive local data and create large retention obligations.
- A customer-facing laboratory risks producing more material to review than value.

**Independent scores:** architecture fit 8/10; developer impact 8-9/10 in theory; verification 8-9/10; originality 4-8/10; prerequisite burden 9/10.

**Complexity:** Very high.

**Smallest wedge:** Deterministic replay of one completed, no-effect validation command while changing one evaluator configuration variable. Reject provider calls, network access, repository mutation, and uncertain Effects.

### Option 3: Developer Trust Cockpit

**How it works:**

Provide invocation-context diffs, a proof-carrying Candidate receipt, semantic impact-to-proof coverage, deterministic blocker navigation, auditable Attention deduplication, and a review-capacity governor. The default view is one actionable state: safe to review, needs proof, or blocked. Every detail is a projection of owner authority, never a new trust score.

**Pros:**

- Directly attacks review context gathering and opaque blocker diagnosis.
- Maps naturally to Attention, Candidate, Evidence, Finding, Language, and Invocation Context records.
- Some Conversation-context-diff presentation can ship before full Execution.
- Reviewer feedback and proof gaps can later feed high-quality evolution proposals.

**Cons:**

- Most differentiating data owners do not exist yet.
- Semantic diffs, impact graphs, and AI code-review dashboards already have strong analogues.
- A standalone cockpit creates dashboard tax.
- Generic trust scores, hash-only receipts, or noisy radar findings would create false confidence.

**Independent scores:** architecture fit 9/10; developer impact 8/10; verification 7-9/10; originality 5-8/10; prerequisite burden high.

**Complexity:** High for the full cockpit; medium for one proof receipt.

**Smallest wedge:** A read-only Candidate proof receipt showing exact Candidate identity/version, changed-file manifest, current technical validation, blocking Findings, explicit unknowns, and deterministic links to underlying proof.

### Option 4: Resumable Parallel Work Fabric

**How it works:**

Treat Worker activity as durable, effect-aware work governed by Repository mutation leases, checkpoints, Writer generations, Effect reconciliation, immutable Worker results, and query-only Effect Dossiers. Parallel work uses isolated Task resources and deterministic Candidate composition. A restarted harness process reattaches to canonical state and continues only from accepted recovery authority. Operational heartbeats may inform Attention, but they do not own execution authority.

**Pros:**

- Directly addresses lost work, duplicate effects, hangs, Git conflicts, and uncertain recovery.
- Is already the load-bearing shape of SlopStop's accepted architecture.
- Produces the trusted run data needed by every later proof, review, and evolution feature.
- Fail-closed effect uncertainty and independently verifiable recovery salvage bundles can differentiate it from transcript-only resumption.

**Cons:**

- Generic leases, checkpoints, journals, and durable workflows are established table stakes.
- This is the most expensive option because it requires canonical persistence and several missing owners.
- Poor onboarding could erase its value if starting a Run is slower than opening another worktree.
- It enables self-evolution but does not itself learn or optimize.

**Independent scores:** architecture fit 10/10; developer impact 9/10; verification 9-10/10; originality 6-8/10; prerequisite burden 9-10/10.

**Complexity:** Very high, but foundational rather than optional.

**Smallest wedge:** One durable, deterministic, non-mutating Worker Run that persists its Sealed Invocation and Resume capsule, survives a killed harness between turns, and returns exact continuation or explicit unavailable/broken recovery state.

## Comparison

| Criterion | Evolution Foundry | Failure Laboratory | Trust Cockpit | Parallel Work Fabric |
|---|---:|---:|---:|---:|
| Developer impact | High | Medium-high | High if narrow | Very high |
| Self-evolution quality | Very high | High but probabilistic | Medium | Enabling substrate |
| Architecture fit | Very high | High | Very high | Exact fit |
| Originality | Compositional | Compositional | Mostly integration | Rigorous table stakes |
| Integration risk | Very high | Very high | High | Very high |
| Prerequisite burden | Very high | Very high | High | Extreme |
| Verification potential | Very high | High | High | Very high |
| Daily adoption potential | Medium | Low | High if inline | Very high |
| Standalone verdict | Merge later | Kill | Merge | Keep |

## Recommendation

**Selected:** Option 4, Resumable Parallel Work Fabric, as the first investment after the current canonical trust-spine work and as the product spine.

**Combined product thesis:**

> SlopStop makes coding-agent work resumable and fail-closed, delivers it as compact proof at human decision points, and improves its own harness only through held-out, permission-aware, reversible evidence.

### Accepted Decision Boundary

- Option 4 is the strategic interpretation of the existing v1 portfolio, not an eighth program or a new implementation authorization.
- GitHub issue `#1` remains the live roadmap. Issue `#21` controls dependency order, and Project Storage issues `#85`, `#86`, and `#87` remain the current prerequisite work.
- ADRs 0006-0015 remain the binding owners for Writer generations, checkpoints, Repository mutation leases, process jobs, Model attempts, Effects, Evidence, Run preparation, Worker results, Candidate composition, and Integration. This record does not duplicate or supersede them.
- Recovery output from uncertain or broken files is a visibly distinct recovery salvage bundle under ADR 0008. It is never a Candidate or automatic Integration input.
- The Effect Dossier under ADR 0013 is the accepted read-only recovery explanation surface. It has no independent state or write authority.
- Supervision reconnect replay versus full-snapshot replacement and live whole-harness replacement or upgrade semantics remain deferred to future owning supervision and release work. Selecting Option 4 does not decide those mechanisms.

### Rationale

- It solves the most concrete user pain before introducing experimental self-improvement.
- SlopStop cannot evaluate or evolve an execution harness whose Runs, Effects, Evidence, and outputs are not yet trustworthy.
- Its durable records become the high-quality failure and outcome corpus required by the Evolution Foundry.
- The Trust Cockpit has value only as a compact projection of real Execution and Evidence authority.
- Counterfactual replay is useful as an internal method, but causal branding would exceed what hosted-model replay can prove.

### Why Not The Alternatives First

- **Evolution Foundry:** valuable and aligned, but premature before ordinary execution, evaluation, permissions, and rollback are implemented and trusted.
- **Counterfactual Failure Laboratory:** expensive, privacy-heavy, and vulnerable to false causal claims. Retain deterministic fault injection and bounded evidence challenges only.
- **Developer Trust Cockpit:** presentation without authoritative producers becomes fixture theater. Merge a narrow proof receipt and exception Attention into the execution program.

### Trade-offs

- Accept slower delivery of self-evolution in exchange for trustworthy training/evaluation traces.
- Accept distributed-systems implementation complexity in exchange for explicit crash and effect semantics.
- Avoid a broad dashboard in exchange for inline, exception-driven decisions.
- Avoid claims of autonomous self-improvement in exchange for permission-aware, human-promoted harness releases.

## Ranked Feature Portfolio

### Keep: Foundation And Daily Value

1. **Safe Kill And Salvage**: stop one runaway Worker, preserve completed sibling results, capture a bounded recovery salvage bundle from interrupted work, and never treat uncertain salvage as a Candidate or automatic Integration input.
2. **Effect Dossier**: answer what was intended, what crossed a physical boundary, what was observed, what remains uncertain, and which next actions are legal without creating another state authority.
3. **Durable Run Resume**: reattach after a harness restart and resume only from accepted checkpoint and recovery authority without repeating completed work. The supervision transport's replay or snapshot contract remains deferred.
4. **Repository Mutation Lease Attention**: show duplicate, orphaned, or contested mutation ownership as actionable Attention rather than hidden coordination failures.
5. **Proof-Carrying Candidate**: one compact receipt binding intent, manifest, tests, Findings, effects, explicit unknowns, and current applicability.
6. **Why Can't I Proceed?**: trace a blocked Run or Integration backward to the exact missing, stale, broken, or uncertain proof and present only legal next actions.
7. **Invocation Context Diff**: show what model, tools, policies, memories, source attachments, token budgets, and exclusions changed before dispatch.
8. **Semantic Impact-To-Proof Map**: connect changed symbols and affected contracts to the exact checks that cover them, while keeping Language observations non-authoritative.

### Keep Later: Governed Self-Evolution

9. **Harness Release Foundry**: version prompts, skills, tools, retrieval rules, and verification policies as immutable release candidates rather than editable live configuration.
10. **Golden-PR Replay Foundry**: mine calibrated pre-change tasks from local accepted changes with no-op failure, human-solution pass, hidden evaluator isolation, and temporal holdouts.
11. **Pass-Fail Flip Gate**: promote only when targeted fail-to-pass gains outweigh protected pass-to-fail regressions under bounded cost and latency.
12. **Capability Permission Diff**: expose any broadened file, process, network, credential, Git, or MCP authority before promotion.
13. **Evidence Challenge**: allow a user or Worker to challenge prior experiment Evidence for contamination, environmental drift, metric mismatch, or scope violation; accepted challenges stale dependent conclusions without rewriting history.
14. **Outcome Feedback Ledger**: connect accepted agent changes to later test failures, rollbacks, churn, and Findings, then propose narrower task-suitability or verification policies for affected repository areas.
15. **Capability Budget Inspector**: show why each capability is visible to one invocation, its version and prompt cost, and which Evidence families it can influence.
16. **Review-Debt Governor**: limit generated change volume when current proof gaps and human review capacity exceed policy, but measure system queues rather than individual developer productivity.

### Reframe Or Kill

17. **Standalone Trust Dashboard**: kill. Use inline proof receipts and exception-driven Attention instead.
18. **Automatic Prompt Or Skill Self-Editing**: kill. Generate immutable proposals and promote through independent evidence.
19. **Causal Failure Explanation From One Trace**: kill. Report bounded hypotheses or probabilistic interventions with replay eligibility and confidence.
20. **Universal Trust Score**: kill. Preserve family-specific Evidence verdicts and explicit unknowns.
21. **Automatic Replay Of Uncertain Effects**: kill. Reconcile and reauthorize.
22. **Agent-Controlled Keep, Commit, Merge, Or Rollback**: kill. Those remain separate Candidate, Integration, Effect, and user authorities.

## Dependency Order

This is a dependency sequence, not an implementation plan or permission to bypass the GitHub roadmap.

1. **Canonical trust spine**: complete the accepted Project Storage, Writer, Domain Event, Artifact, and read-model foundations through the current `#85`-`#87` work.
2. **Durable single-Worker continuity**: canonical persistence, Writer fencing, command settlement, Sealed Invocation, Resume capsule, and kill/restart proof.
3. **Effect-aware recovery**: one provider or process boundary with pre-boundary Journal facts, explicit uncertain state, reconciler, and read-only Effect Dossier.
4. **Immutable results and proof receipt**: Worker result Artifact, one Candidate, exact Validation, blocking Findings, and compact receipt.
5. **Parallel safety**: Task DAG, isolated resources, Repository mutation leases, sibling preservation, deterministic composition, and recovery salvage bundles.
6. **Developer decision surfaces**: exception Attention, blocker navigator, invocation diff, and semantic impact-to-proof map.
7. **Replay Evidence**: manually registered deterministic replay fixtures with evaluator isolation and calibrated expected outcomes.
8. **Harness Capability releases**: immutable proposal, permission diff, held-out flip matrix, human promotion, rollback lineage, and dependency invalidation.
9. **Experimental optimization**: bounded search over typed harness configuration. Add stochastic counterfactual replay only after replay fidelity and privacy controls are proven.

## Integration Points

- `apps/harness/src/harness-runtime.ts:39-113`: extend the current transport only after new protocol-owned Run, Evidence, and Recovery schemas exist.
- `apps/harness/src/workspace-application.ts:42-64`: follow the narrow owner-port pattern; do not turn WorkspaceApplication into a god coordinator.
- `apps/desktop/src/main/harness-supervisor.ts:167-272`: separate process restart from domain recovery; a restarted utility process must attach to canonical execution state. Live whole-harness replacement remains a later decision.
- `apps/desktop/src/main/workspace-bridge.ts:254-291`: its stale-projection and notification-ordering behavior is relevant precedent, but this record does not select replay or full-snapshot replacement for supervision reconnect.
- `packages/protocol/src/protocol.ts:17-124`: preserve strict versioned discriminated envelopes for every new process-boundary value.
- `packages/kernel/src/workspace-identifiers.ts:1-37`: add domain identities only with their owning vertical slice and shared schema vocabulary.

## Risks

- **Governance burden exceeds saved effort:** default to risk-tiered automation and compact receipts; measure total developer minutes.
- **Evaluator gaming:** execute hidden graders outside candidate-writeable workspaces and rotate holdouts.
- **Historical overfitting:** use time-split protected tasks and require pass-to-fail reporting.
- **False causal confidence:** label replay evidence deterministic, probabilistic, descriptive, invalid, or privacy-incomplete.
- **Trace privacy and storage growth:** local encryption, bounded capture profiles, explicit retention, and no raw external telemetry.
- **Dashboard tax:** put actions in Run, diff, and Attention flows; use a cockpit only as drill-down.
- **Unsafe rollback language:** restoration is a newly authorized Effect; historical outcomes remain immutable.
- **Feature pile:** each slice must prove one user outcome and one authority boundary before adding the next.

## Testing Strategy

### Unit And Contract Tests

- Stable request identity returns a recorded result or explicit uncertainty after reconnect, never duplicate execution.
- Every pre-boundary crash window produces a distinct non-clean state.
- Stale lease holders cannot settle Worker, Effect, Candidate, or checkpoint state.
- Candidate receipts bind exact identities and become stale when mandatory authority changes.
- Permission broadening is detected for file, shell, network, credential, Git, and MCP scopes.
- Ancestor capability changes invalidate dependent promotion Evidence.

### Integration Tests

- Kill the harness before, during, and after provider/process boundaries and verify legal recovery options.
- Stop one Worker while preserving completed siblings and independently materializing their immutable results.
- After an owning supervision decision selects a reconnect contract, prove it never presents mixed-generation state; this test is deferred with that contract.
- Calibrate Golden-PR fixtures by proving no-op failure and accepted human-solution success.
- Attack evaluator isolation through test edits, hidden-test access, hooks, environment manipulation, and grader-path writes.
- Replay a promoted candidate on protected holdouts and automatically reject pass-to-fail regression above policy.

### Product Validation

- Observe 8-12 experienced agent-tool users over 100 multi-step runs.
- Recover useful work in at least 95% of injected interruptions with zero silent overwrites or duplicate uncertain effects.
- Reach a productive next action within two minutes median after interruption.
- Reduce repeated model/token spend after interruption by at least 25%.
- Reduce reviewer context-gathering time by at least 30% for proof-receipt changes.
- Keep irrelevant Attention below one item per ten Runs.
- Demonstrate held-out harness improvement with a paired confidence interval excluding zero and protected-task regression within policy.

## Open Questions

### Resolved During Research

- **Can current harness code self-evolve now?** No. Current source provides process and protocol seams but not the required execution, evidence, persistence, evaluation, or promotion authorities.
- **Should self-evolution mean source self-modification?** No. It should mean evidence-gated release of versioned harness capabilities and policies.
- **Should counterfactual replay become user-facing causal proof?** No. Deterministic replay can produce Evidence; hosted-model interventions remain probabilistic hypotheses.
- **Is a Trust Cockpit a standalone differentiator?** No. Compact proof and recovery projections are valuable; a broad dashboard is derivative and creates adoption risk.
- **What follows the current Project Storage wave?** Durable single-Worker continuity and explicit recovery, then immutable results and proof receipts.
- **Does this decision select supervision replay/full-snapshot or live harness replacement semantics?** No. Both require separate owning decisions when their roadmap work becomes actionable.

### Requires User Input

- **Primary pilot metric:** recommended default is end-to-end developer minutes to safely accepted change, with review time, recovery time, rework, and model spend as components.
- **Golden corpus policy:** recommended default is per-project local storage, temporal holdout, explicit user inclusion, and no cross-project promotion without a second approval.
- **Evolution scope:** recommended first surface is prompt/skill/tool-description/test-selection configuration; source code, safety invariants, permissions, and schema migrations remain outside automatic proposal application.

### Blockers

- No conceptual blocker prevents the recommended architecture.
- Implementation depends on the already-planned canonical persistence and Execution/Evidence authority spine.

## References

### SlopStop

- `PRODUCT.md:15-27` - Personal supervision outcome and authority separation.
- `PRODUCT.md:76-119` - Invocation, execution, evidence, recovery, Candidate, and integration requirements.
- `CONTEXT.md:62-73` - Effect and Recovery Journal vocabulary.
- `CONTEXT.md:82-95` - Family-specific Evidence vocabulary.
- `CONTEXT.md:151-161` - Verified Memory and Capability vocabulary.
- `.rpiv/decisions/degrade-distinguishes-broken.md:18-24` - Broken states must not degrade to clean or absent.
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md` - Workspace, lease, checkpoint, and process lifecycle.
- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md` - Runtime, context, tool, and recovery boundaries.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md` - Evidence authority.
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md` - Effect ordering and reconciliation.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md` - Parallel composition and exact Integration.
- `docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md` - Mandatory dependency invalidation.
- `docs/adr/0018-artifact-retention-quotas-reservations-and-explicit-removal.md` - Replay and Evidence artifact retention.

### External Research And Precedents

- Stack Overflow 2025 AI survey: https://survey.stackoverflow.co/2025/ai
- METR developer productivity study: https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- Agentic Harness Engineering: https://arxiv.org/html/2604.25850
- dsh-continual-evolve: https://github.com/ZK-Andy/dsh-continual-evolve
- RepoAgentBench: https://github.com/HumphreySun98/repoagentbench
- Darwin Godel Machine: https://arxiv.org/html/2505.22954
- DSPy GEPA: https://dspy.ai/api/optimizers/GEPA/overview/
- Causal Agent Replay: https://arxiv.org/html/2606.08275
- Shepherd: https://github.com/shepherd-agents/shepherd
- Anthropic agent evaluation guidance: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- sem semantic diff: https://github.com/Ataraxy-Labs/sem/
- Prime Agent daemon: https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/daemon.md
- Temporal workflow execution: https://docs.temporal.io/workflow-execution
- Cloudflare durable execution: https://github.com/cloudflare/agents/blob/main/docs/durable-execution.md
- CAID: https://arxiv.org/pdf/2603.21489
- CooperBench: https://arxiv.org/html/2601.13295v2
