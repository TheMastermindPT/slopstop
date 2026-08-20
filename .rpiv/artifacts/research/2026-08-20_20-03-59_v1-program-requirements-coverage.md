---
date: 2026-08-20T20:03:59+0100
author: Pedro Mesquita
commit: c2d2582
branch: main
repository: slopstop
topic: "Coverage of confirmed requirements across proposed v1 programs"
tags: [research, wayfinder, requirements, coverage, programs, v1]
status: complete
last_updated: 2026-08-20T20:19:56+0100
last_updated_by: Pedro Mesquita
source_issue: https://github.com/TheMastermindPT/slopstop/issues/16
---

# Research: V1 Program Requirements Coverage

## Research Question

Where does every confirmed requirement and standing decision belong: a proposed v1 program, a post-v1 program, a cross-cutting invariant, or an explicit non-goal? Which requirements are omitted, duplicated, or still depend on a later charter/release decision?

## Bottom Line

The existing seven proposed v1 programs appear able to cover the confirmed scope. No new program is currently indicated, but the charters must validate the proposed ownership and explicit producer-consumer handoffs before the roadmap can rely on it.

Four gaps must remain visible until their charter resolves them:

1. The design-only DAP safety seam belongs with language intelligence now even though live DAP behavior is post-v1.
2. Test-first policy, runtime enforcement, and red/green evidence span three programs and need a fixed handoff.
3. The capability catalogue needs one record owner and explicit consumers.
4. Read-only side questions and user-reviewed refinement proposals were not explicitly included or deferred by the accepted release contract; they need named candidate owners and an explicit v1/post-v1 placement decision.

The proposed mapping below assigns one primary owner to each durable behavior while leaving final charter boundaries and total sequencing to their existing Wayfinder tickets.

## Authority Order

Later accepted decisions narrow earlier broad requirements:

1. [Define the personally usable v1 release contract](https://github.com/TheMastermindPT/slopstop/issues/15#issuecomment-5359600482) controls v1 scope and explicit deferrals.
2. `PRODUCT.md`, `CONTEXT.md`, accepted ADRs, and `.rpiv/decisions/` control durable product, domain, architecture, and standing implementation rules.
3. [Select the representative v1 proof scenario](https://github.com/TheMastermindPT/slopstop/issues/14#issuecomment-5359917286) fixes the proof corpus without superseding product or architecture.
4. [Verify runtime constraints that affect program order](https://github.com/TheMastermindPT/slopstop/issues/12#issuecomment-5360325037) qualifies feasibility and candidate ordering without assigning ownership.
5. The three confirmed/refined FRDs under `.rpiv/artifacts/discover/` retain requirements not narrowed or superseded above.
6. Historical option research remains evidence but is not current authority.

When two sources conflict on v1 scope, the accepted release contract controls placement while the broader requirement remains post-v1 intent unless explicitly rejected.

Derived issue labels used below are reading aids, not identifiers stored in GitHub: `ISSUE15-J` means an ordered journey bullet, `ISSUE15-P` a proof-layer bullet, `ISSUE15-I` an invariant, and `ISSUE15-D` a deferred item in the issue 15 resolution. `ISSUE14-*` and `ISSUE12-*` refer to ordered material statements in those resolution comments. The links above remain the authoritative citations.

## Program Ownership Rules

- Every implemented durable record or behavior eventually needs one primary owner. Placement-dependent requirements remain explicitly unresolved with candidate owners until their charter classifies them.
- Consumers receive an explicit handoff artifact or command rather than sharing write authority.
- Cross-cutting invariants bind every program and are not delegated to one safety program.
- A later charter may refine the proposed owner, but it must preserve coverage or record an explicit scope change.
- The sequencing ticket chooses hard blockers only after program ownership is accepted.

## Proposed V1 Program Map

### Project Onboarding And Canonical State

Primary ticket: [Charter the project onboarding and canonical-state program](https://github.com/TheMastermindPT/slopstop/issues/20)

Primary ownership:

- Project, Feature, Waypoint, relationship, revision, and fixed status-family records.
- Relationship semantics (`blocks`, `related-to`, `derived-from`), readiness effects, and worker-task promotion into a Waypoint. If restoration is chartered for v1, canonical state owns restoration as a new recoverable revision.
- Versioned action/prompt records and the rule that workers cannot silently replace approved prompts.
- Separate project, execution, and conversation graph identities without shared state authority.
- Application and project profile records, project classification, trust/readiness evidence, and progressive gating.
- Canonical workspace identity, fingerprint inputs, leases, and selected workspace mode records.
- Capability catalogue records, provenance, trust, collision visibility, and repository-detected capability state.
- Canonical `slopstop.db`, schema, migrations, verified backup, newer-schema refusal, and local storage policy.
- Separate registration for Mastra-owned persistence without making it canonical.
- Configuration validation, machine-local paths, and credential references without exposing secret material.

Named consumers:

- Supervised execution consumes accepted Waypoint revisions, workspace leases, project profiles, and trusted capability records.
- Evidence consumes workspace fingerprints and canonical IDs.
- Memory consumes project/revision scope.
- Language intelligence consumes workspace identity and trusted server definitions.
- Frame/supervision renders and edits canonical records through typed commands.

Key sources: `CONTEXT.md:7-15,31-41`; `PRODUCT.md:27,31-43`; FRD1 requirements 1-25 and 74-76; FRD2 requirements 1-29 and 90-112; ADR 0001 `:52-66`; runtime constraints ISSUE12-4 and ISSUE12-7.

### Supervised Waypoint Execution

Primary ticket: [Charter the supervised Waypoint execution program](https://github.com/TheMastermindPT/slopstop/issues/17)

Primary ownership:

- Deterministic application coordinator behavior for scheduling, policy, budgets, and legal lifecycle transitions.
- Resumable Waypoint parent behavior, approved delegation plans, bounded non-nesting workers, and worker registry.
- Different Waypoints may overlap, but each Waypoint has at most one active parent run.
- Manual Begin, action availability, and legal execution transitions. If automatic preparation is chartered for v1, execution may prepare only up to the approval boundary. Execution submits typed transition commands; canonical state validates and persists status records.
- Project-owned `AgentRuntime`, deterministic test substitute, pinned Mastra adapter, selected provider adapter, and concrete model resolution.
- Action queue, typed steering/lifecycle actions, dispatch checkpoints, pause/resume/cancel/retry delivery, and parent failure behavior.
- Capability selection from the canonical catalogue, prompt-packet compilation, source manifests, and dispatch-time trust filtering.
- Permission/effect resolution, approved tool arguments, managed ProcessJob dispatch, and structured edit proposals.
- Execution-workspace allocation, worktree creation/ownership, exclusive editable-checkout leases, isolation failure, and cleanup requests. Evidence separately owns fingerprints, deltas, and integration proof.
- Runtime enforcement of the selected test-first discipline before production mutation.
- Read-only side-question execution if its charter keeps that capability in v1.
- Generation/evaluation of reviewed refinement proposals if its charter keeps that capability in v1; automatic refinement remains post-v1.

Named consumers and producers:

- Canonical state provides Waypoint/run intent, profiles, trusted capabilities, and workspace leases.
- Evidence provides accepted evidence gates and receives attributed effects, process results, and worker deltas.
- Frame/supervision receives typed events and sends validated commands; chat remains non-authoritative.
- Convergence receives one real-model path and one deterministic CI path.

Key sources: `CONTEXT.md:10-19,22,26-27`; FRD1 requirements 26-50 and 64-75; FRD2 requirements 25-50, 113-148; ISSUE15-J5, J7, J9, P1-P3, I1-I3, I9, I11; ISSUE12-2 and ISSUE12-3.

### Evidence, Validation, Recovery, And Integration

Primary ticket: [Charter the evidence, validation, recovery, and integration program](https://github.com/TheMastermindPT/slopstop/issues/19)

Primary ownership:

- Stable evidence IDs, evidence registration/acceptance, base compound anchors, source/workspace/revision binding, and explicit stale/ambiguous/broken states.
- Evidence gates and completion contracts.
- Baseline, distinct red, minimal green, refactor-preservation, change-aware gate, and exception evidence.
- Stable Finding records, independent validators, bounded remediation handoffs, recheck of the same Finding ID, and risk-acceptance records.
- Recovery Journal records, uncertain-side-effect handling, resume evidence, and non-replay policy.
- Machine-readable Git state, workspace fingerprints, worker-only deltas, conflict/dirty-state evidence, recovery/integration records, and explicit integration. Execution owns workspace/worktree creation, active ownership, and cleanup requests.
- Validation of approved deltas before workspace cleanup.

Named consumers and producers:

- Execution requests evidence gates, submits attributed effects, and consumes recovery decisions without owning evidence truth.
- Memory consumes accepted evidence IDs and invalidation events.
- Language intelligence contributes revision-fresh semantic enrichment and diagnostics; Git/content/syntax remain durable anchor authority.
- Convergence consumes red/green, Finding/remediation, crash/recovery, and integration proof.

Key sources: `CONTEXT.md:16-17,20,23-27`; FRD1 requirements 26-30 and 51-73; FRD2 requirements 30-43, 57-89, 117-122, 136-144; ISSUE15-J10-J13 and I4-I7; ISSUE14-4 through ISSUE14-10; ISSUE12-5.

### Verified Memory

Primary ticket: [Charter the verified-memory program](https://github.com/TheMastermindPT/slopstop/issues/13)

Primary ownership:

- Memory claim, provenance, evidence links, project/revision scope, confidence, policy, timestamps, and invalidation dependency records.
- V1 lifecycle only: create, accept, bounded retrieve, stale, and reverify.
- Removal of stale claims from trusted retrieval and delivery of bounded memory handoffs.

Named handoffs:

- Evidence is the only source of accepted proof and invalidation events.
- Execution consumes bounded retrieval but cannot create trusted memory through conversation alone.
- Frame/supervision renders rationale and stale/reverified state.

Post-v1 memory scope:

- Proposed/rejected/revoked/deleted governance beyond the v1 proof.
- Hybrid semantic retrieval, cross-project preferences, advanced inspection/edit/delete flows, and richer ranking policy.

Key sources: `CONTEXT.md:21`; FRD1 requirements 58-63; FRD2 requirement 19; ISSUE15-J6, J12, D5, I6-I7.

### TypeScript Language Intelligence

Primary ticket: [Charter the TypeScript language-intelligence program](https://github.com/TheMastermindPT/slopstop/issues/24)

Primary ownership:

- TypeScript/JavaScript LSP definition/selection observations, private language-process lifecycle per concurrent workspace, synchronization, cancellation, restart/replay, and bounded result state. Execution remains the sole ProcessJob/effect-contract owner; canonical state alone accepts and persists capability trust records.
- Revision-fresh diagnostics, definitions/navigation, semantic enrichment, and explicit broken/truncated/stale states.
- Preview-only language mutations routed through execution permissions and structured-edit checks.
- A versioned design-only DAP boundary/safety contract covering adapter provenance observations, consumption of execution-owned ProcessJobs/permissions, framed transport, redaction, evidence identity, and crash uncertainty. Live DAP behavior remains post-v1; convergence accepts the boundary contract as documentation evidence.

Named handoffs:

- Canonical state provides workspace identity and trusted capability/server records.
- Execution provides ProcessJob, permission, and structured-edit seams.
- Evidence owns durable anchors and accepts optional semantic enrichment/diagnostics without treating diagnostics as red-green proof.

Key sources: `CONTEXT.md:28-29`; FRD3 requirements 1-53; PRODUCT-47; ISSUE15-J8, I8, D1-D2; ISSUE12-1, ISSUE12-6, ISSUE12-7.

### Frame And Supervision Experience

Primary ticket: [Charter the Frame and supervision experience program](https://github.com/TheMastermindPT/slopstop/issues/25)

Primary ownership:

- Application onboarding presentation for provider/defaults/privacy and project-onboarding readiness interaction, without owning their canonical records.
- Candidate minimum v1 Frame flow that captures one Feature and two user-accepted related Waypoints; the charter decides whether this is sufficient for the accepted release journey.
- Candidate Frame interview behavior uses adaptive grilling, presents dependent or important decisions one at a time, and batches only independent routine details; the charter decides its v1 placement explicitly.
- Candidate minimum galaxy/tree/plain-text projections required to understand those Waypoints. The release contract keeps rich spatial manipulation post-v1; the charter records the exact boundary.
- Append-only Board projection, typed event visibility, agent inspection, approval/rejection, Pause/Resume, recovery choices, and explicit integration interaction.
- Keyboard/plain-text equivalents, non-color status cues, reduced motion, responsive desktop behavior, and accessible error/recovery states. The foundation's 640x480 shell result is historical evidence, not an established minimum for the future workspace.
- Side-question presentation if the execution charter keeps read-only side questions in v1.
- Review/acceptance presentation for manually reviewed refinement proposals if they remain in v1.

Named handoffs:

- Canonical state owns records; the UI submits typed commands.
- Execution owns lifecycle actions and event production.
- Evidence owns proof/failure/integration authority.
- Memory and language programs own their state; the UI only projects it.

Explicit v1 limit:

- “Decision Canvas” means the minimum accepted Frame decision flow, not the rich manipulation, undo, progressive galaxy zoom, free orbital placement, or final visual identity described in earlier FRDs.

Key sources: `PRODUCT.md:33-35,49-51,70-72`; FRD1 requirements 3-10, 39, 42-50, 56, 77-82; FRD2 requirements 35-39, 44-50, 145-148; DESIGN current accessibility/minimum-window constraints; ISSUE15-J2, J4, J7, J9, D6-D8.

### V1 Convergence And Release Proof

Primary ticket: [Charter the v1 convergence and release-proof program](https://github.com/TheMastermindPT/slopstop/issues/23)

Primary ownership:

- The integrated MaxReps proof journey and its repeatable Windows environment.
- Verification of the integrated threat model, including the fact that utility-process separation is not a proven OS security sandbox.
- Release evidence for privacy, secret/redaction, observability, performance targets, migration/backup, recovery drills, packaging, and known limitations. Upstream programs own the behaviors.
- Final release gate across real-model acceptance and deterministic destructive-edge CI proofs.
- Explicit preservation of the fixed corpus's `.stryker-tmp`, CodeScene, and stale-script limitations until readiness/validation proves whether they block the timer goal.

This program consumes completed program evidence; it does not own the upstream behavior.

Key sources: ISSUE15 complete release contract; ISSUE14 proof corpus; ISSUE12 runtime probes; ADR 0001 `:68-99`; `PRODUCT.md:53-60`.

## Cross-Cutting Invariants

These rules bind every v1 program and cannot be assigned away:

| Invariant | Sources |
| --- | --- |
| Only validated typed commands change canonical state; chat, summaries, model citations, and UI projections have no state authority. | `CONTEXT.md:18-19,35-41`; ISSUE15-I2 |
| Project, execution, and conversation graphs remain distinct. Status families remain distinct. | `CONTEXT.md:31-41` |
| Frame, Research, Implement, and Validate are capabilities, not a mandatory global pipeline. Program order must not become a fixed per-Waypoint execution pipeline. | `PRODUCT.md:21,34`; `CONTEXT.md:14`; FRD1-23-25; FRD2-8 |
| Parents coordinate only; effects and canonical evidence belong to bounded attributed non-nesting workers. | `PRODUCT.md:27,45`; ISSUE15-I3 |
| Approval binds plan, workspace, arguments, effects, budgets, and policy before dispatch/integration. Material change requires fresh approval. | FRD1-38, 65-69; FRD2-113-116; ISSUE15-I1 |
| Selected isolation never silently weakens and unrelated work remains untouched. | `PRODUCT.md:46`; ISSUE15-I4 |
| Started effects are journaled; uncertain effects never auto-replay. | `CONTEXT.md:23-24`; FRD2-30-34; ISSUE15-I5 |
| Broken, unknown, stale, ambiguous, truncated, unsupported, and clean remain distinct. | `PRODUCT.md:23,46,64-66`; `.rpiv/decisions/degrade-distinguishes-broken.md`; ISSUE15-I6 |
| Evidence, memory, diagnostics, edits, and commands bind to exact workspace/source revisions. | `CONTEXT.md:20,25`; ISSUE15-I7 |
| LSP writes are proposals; diagnostics never replace red-green evidence. | FRD3-14-31; ISSUE15-I8 |
| No automatic model fallback. Concrete provider/model is recorded for each attempt. | `PRODUCT.md:46`; FRD2-123-131; ISSUE15-I9 |
| Secrets remain local and sensitive content is redacted. Renderer has no unrestricted Node access. | `PRODUCT.md:39-40`; ADR 0001 `:44-74`; ISSUE15-I10 |
| Jobs, outputs, retries, time, context, workers, and cost remain bounded. | FRD1-40; FRD2-140-144; ISSUE15-I11 |
| Every visual interaction has keyboard/plain-text parity and status is not color-only. | `PRODUCT.md:70-72`; FRD1-79-82 |
| Shared vocabularies have one union owner; copied variants migrate only after identity is proven. | `.rpiv/decisions/shared-vocab-union.md` |
| Dependencies are installed only with first exercised behavior; framework types stay behind project-owned boundaries. | `PRODUCT.md:68`; ADR 0001 `:24-31,76-83` |

## Foundation And Engineering Constraint Placement

Accepted ADR and active AGENTS rules are classified as follows rather than treated as an unowned overlay:

| Constraint family | Classification |
| --- | --- |
| Monorepo topology, package ownership, import direction, exact dependency pins, build-script allowlist, strict TypeScript/ESM, Zod boundaries, branded IDs, sequence/time conventions, and typed expected failures | Cross-cutting implementation invariant; every program preserves it and dependency-cruiser/type/lint gates verify it. |
| One supervised harness process, transferred message port, versioned protocol, exact handshake, explicit lifecycle states, and bounded restart | Existing platform substrate consumed by all v1 programs; supervised execution extends behavior without moving Electron ownership out of desktop. |
| Renderer sandbox/context isolation, no Node integration, narrow preload, CSP, navigation/window denial, ASAR integrity, fuses, safeStorage, local redacted logs, and consent-gated telemetry | Cross-cutting security/privacy invariant; owning adapters implement it and convergence verifies the integrated proof. |
| Canonical/Mastra database separation, migrations, backup, local paths, and validated configuration | Project onboarding and canonical state primary ownership; exact Mastra persistence is consumed by supervised execution. |
| Public-seam tests, red-green discipline, risk-based coverage/mutation, fast/deep gates, no gate weakening, and distinct broken invocation | Cross-cutting quality invariant implemented through the Test-First Handoff; repository gates verify implementation-wide compliance. |
| Windows-first packaging, Ubuntu/Windows CI, packaged smoke, and production fuses | V1 convergence owns integrated proof; desktop/platform code owns behavior. Installers, signing, update, publishing, release automation, and public license remain post-v1. |
| Canonical document roles, executable LikeC4, CSS Modules, and no speculative router/state library | Cross-cutting repository/architecture invariant; affected programs update the model and add dependencies only with first behavior. |

## Test-First Handoff

Test-first is one policy chain with three owners, not three independent implementations:

| Stage | Primary owner | Handoff |
| --- | --- | --- |
| Store application/project/run discipline profile, approved exception, and baseline workspace identity | Project onboarding and canonical state | Immutable profile/revision snapshot passed to execution |
| Enforce plan quality, test-author role, red-before-production-mutation, smallest green, and refactor-preservation transitions | Supervised Waypoint execution | Attributed commands/results passed to evidence |
| Register baseline/red/green/refactor evidence, separate existing failures, enforce change-aware gates, and preserve exception rationale | Evidence, validation, recovery, and integration | Gate verdict and evidence IDs returned to execution/convergence |

Primary sources: `PRODUCT.md:44`; ADR 0001 `:76-83`; FRD2 requirements 57-75; ISSUE15-J10 and P2-P3.

## Capability Catalogue Handoff

| Responsibility | Owner |
| --- | --- |
| Persist catalogue entries, provenance, trust, discovery evidence, collision state, and profile enablement | Project onboarding and canonical state |
| Select capabilities for an approved plan, compile bounded prompt packets, re-resolve tools, and enforce permissions at dispatch | Supervised Waypoint execution |
| Register analyzers/tool results as evidence and distinguish broken invocation from absent capability | Evidence, validation, recovery, and integration |
| Publish LSP discovery/provenance observations and consume accepted definitions | TypeScript language intelligence |
| Present provenance, trust, collisions, plan selection, and diagnostics | Frame and supervision experience |

Primary sources: `CONTEXT.md:22`; FRD1 requirements 64-66; FRD2 requirements 25-29, 51-56, 132-152; FRD3 requirements 1-10.

## Placement-Dependent Requirements

These requirements are confirmed but not explicitly placed by the accepted release journey. They must not disappear silently:

| Requirement | Candidate primary owner | Required decision |
| --- | --- | --- |
| Read-only “Ask about this run” with bounded context and no mutation authority | Supervised Waypoint execution; Frame is UI consumer | Execution and Frame charters decide v1 versus post-v1. |
| User-reviewed prompt/skill/recipe refinement proposals with provenance, diff, evaluation, rollback, and acceptance | Execution owns proposal/evaluation; canonical state stores revisions; Frame presents acceptance | Charters decide whether manual proposals are v1. Automatic refinement/experiments remain post-v1. |
| Adaptive Frame grilling, one-at-a-time dependent decisions, and batching only independent routine details | Frame and supervision experience | Frame charter decides whether these confirmed interview mechanics are part of the minimum v1 Frame journey. |
| Waypoint revision restoration, automatic-start preparation, Board filters, aggregate activity feed, full prompt-manifest controls | Canonical, execution, or Frame according to behavior | Relevant charters classify minimum v1 versus post-v1. |
| Full compound-anchor resolution and artifact import/link behavior beyond the representative proof | Evidence | Evidence charter decides minimum v1 seam. |
| Greenfield scaffolding beyond opening the existing MaxReps corpus | Project onboarding and canonical state | Onboarding charter decides whether v1 supports create-new or only existing repositories. |
| Exact numeric budgets, limits, retention, timeouts, and result caps | Owning charters; convergence verifies | Remain map fog until workload/probe evidence supports values. |
| Exact provider/model and exact TypeScript LSP packages | Execution and language charters | Select one each; broader parity is post-v1. |

## Post-V1 Program Families

| Family | Deferred requirements |
| --- | --- |
| Live debugging | FRD3 requirements 32-53 implementation; memory/disassembly/custom adapter features remain later still. The v1 language program preserves only the safety seam. |
| Advanced verified memory | Full lifecycle/governance, semantic/hybrid retrieval, advanced ranking, cross-project preferences, rich edit/revoke/delete. |
| Rich Frame and galaxy | Full Decision Canvas manipulation/undo, free orbital placement, progressive zoom, rich graph editing, final visual identity. |
| Capability refinement and experiments | Automatic prompt/skill/recipe refinement, forks, branch compass, automated experiments, confidence benchmarking, generated-skill experiments. |
| Language/provider breadth | Languages beyond TS/JS, several simultaneously active providers, automatic fallback remains prohibited rather than deferred. |
| Distribution | Installer, signing, auto-update, publishing, and release automation. |

## Explicit Non-Goals For This V1 Map

- Multi-user collaboration, cloud sync, and hosted execution.
- Several simultaneously active projects.
- Complete built-in editor or IDE parity.
- Unrestricted arbitrary effects, recursive workers, silent isolation downgrade, or automatic model fallback.
- Offline/multi-device continuity for the MaxReps timer proof.
- Treating historical OpenCode/Tauri option research as current architecture.

## Source Coverage Ledger

This ledger accounts for every numbered FRD range and durable overlay. Placement-dependent rows remain explicit research outcomes rather than pretending ownership is settled.

| Source range | Primary classification |
| --- | --- |
| FRD1 1-25 | Canonical state; minimal Frame; placement-dependent domain mechanics |
| FRD1 26-50 | Execution; evidence gates; Frame/Board; cross-cutting command authority |
| FRD1 51-57 | Evidence and anchors |
| FRD1 58-63 | V1 memory subset plus post-v1 advanced memory |
| FRD1 64-76 | Capability handoff; workspace/Git/recovery; execution/runtime; local persistence |
| FRD1 77-82 | Minimal Frame/accessibility plus post-v1 rich galaxy |
| FRD2 1-24 | Lineage restatement of FRD1 core model |
| FRD2 25-29 | Capability catalogue handoff |
| FRD2 30-34 | Evidence/recovery and cross-cutting uncertain-effect invariant |
| FRD2 35-39 | Execution lifecycle plus Frame interaction |
| FRD2 40-50 | Evidence gates, durable Board/context, placement-dependent side questions |
| FRD2 51-56 | Placement-dependent reviewed refinement; automatic refinement post-v1 |
| FRD2 57-75 | Test-first three-program handoff |
| FRD2 76-89 | Evidence Findings, validation, remediation, and approval invariants |
| FRD2 90-112 | Application/project onboarding and canonical state |
| FRD2 113-122 | Execution permissions and workspace/worktree lifecycle; evidence-owned fingerprints, deltas, recovery, and integration proof |
| FRD2 123-131 | Execution provider/model policy and no-fallback invariant |
| FRD2 132-144 | Execution prompt/effect/process substrate; evidence receives results |
| FRD2 145-148 | Frame/supervision projections and inspectors |
| FRD2 149-153 | Placement-dependent reviewed resources; experiments post-v1 |
| FRD3 1-31 | V1 TypeScript/JavaScript language intelligence and evidence handoff |
| FRD3 32-53 | V1 design-only DAP safety seam; live DAP post-v1 |
| PRODUCT.md | V1 outcome, process/security boundaries, cross-cutting principles, explicit deferrals |
| CONTEXT.md | Canonical vocabulary, status-family separation, and three-graph invariant |
| ADR 0001 | Foundation/engineering constraint table; canonical state; execution substrate; convergence proof; post-v1 distribution |
| DESIGN.md | Current shell/minimum-window evidence, accessibility invariants, provisional style only |
| AGENTS.md | Foundation/engineering cross-cutting invariants and repository gates |
| `.rpiv/decisions/*` | Failure distinction and shared-vocabulary union invariants |
| ISSUE15 | Controlling v1 journey, invariants, CI/manual proof split, and deferrals |
| ISSUE14 | Fixed MaxReps corpus, timer goal, worktree, known non-clean baseline evidence |
| ISSUE12 | Runtime qualifications, exact-version probes, and candidate ordering constraints |

## Proof Deliveries To Convergence

| Program | Required evidence delivery |
| --- | --- |
| Project onboarding and canonical state | Fresh local state, provider/project profiles, read-only scan/trust/readiness, canonical records, capability provenance, workspace identity, persistence migration/backup probe |
| Supervised Waypoint execution | Two overlapping related parents, approved plans, attributed workers, execution-workspace lifecycle, real provider path, deterministic `AgentRuntime`, Pause/Resume, bounded events, test-first runtime enforcement |
| Evidence/validation/recovery/integration | Evidence gate, red/green chain, stable Finding, separate remediation/recheck, recovery journal, checkpoint restart, stale/dirty/broken distinctions, workspace fingerprint, worker-only delta, explicit integration |
| Verified memory | Create/accept/retrieve handoff, stale on code change, reverify through later accepted evidence |
| TypeScript language intelligence | Revision-bound TS/JS LSP navigation or diagnostics, fresh/broken/truncated distinctions, crash/replay, preview-only mutation safety, and a versioned design-only DAP boundary contract accepted by convergence |
| Frame and supervision experience | Accepted Frame/two-Waypoint boundary, agent inspection, approvals, Pause/Resume/recovery/integration interaction, keyboard/plain-text parity, and responsive desktop proof at chartered viewports |
| V1 convergence and release proof | Complete packaged Windows MaxReps journey, threat/privacy/performance/migration/recovery evidence, real-model acceptance, deterministic destructive-edge CI, known limitations |

## Coverage Prompts For Charter Review

- Canonical-state charter should decide application/project profiles, workspace identity, sole acceptance/persistence of capability catalogue records, database ownership, and migrations/backups.
- Execution charter should decide deterministic/real runtimes, capability selection, prompt/permission/ProcessJob substrate, execution-workspace lifecycle, runtime TDD enforcement, and explicit side-question/refinement placement.
- Evidence charter should decide base anchors, red/green evidence, Findings, Recovery Journal, Git fingerprints/deltas, recovery/integration records, and explicit integration without taking execution-workspace ownership.
- Memory charter should preserve accepted evidence/invalidation as external inputs and avoid an independent truth path.
- Language charter should decide how it will satisfy PRODUCT's required pre-DAP boundary design while retaining live DAP as post-v1; if it is not the producer, it must identify another owner. Convergence should accept the resulting versioned contract.
- Frame charter should test the candidate minimum Decision Canvas/galaxy acceptance flow against the release contract and explicitly place side-question/refinement UI while keeping deferred rich manipulation out of v1.
- Convergence charter should consume the proof-delivery table and preserve fixed corpus limitations as explicit evidence without claiming ownership of upstream behavior.

## Open Questions Preserved For Later Tickets

- Whether read-only side questions and manually reviewed refinement proposals are v1 or post-v1.
- Whether v1 project onboarding supports greenfield creation or only existing repositories.
- Which detailed domain mechanics beyond the representative journey are needed for personal usability.
- Exact provider/model, exact LSP implementation, numeric limits, retention, and performance targets.
- The total program order, parallel branches, convergence gates, and first detailed program map.
