---
date: 2026-08-30T23:53:59+0100
author: Pedro Mesquita
commit: 588462b
branch: decision/ticket-75-convergence-proof-bundle
repository: slopstop-ticket-75
topic: "Convergence proof-bundle contract for issue 75"
tags: [research, convergence, evidence, execution, proof-bundle]
status: complete
last_updated: 2026-08-31T14:10:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Finalized the typed profile, coherent validation, Storage closure, and cumulative limits after adversarial review"
content_hash: 266c375d5321e54f632647d3d017721b617f76cdff0359574c2135f21df54073
---

# Research: Convergence Proof-Bundle Contract

## Research Question

What versioned immutable manifest delivers the required Execution and Evidence proofs to Convergence? Define bundle identity, required typed members, current-decision references, fingerprints, ordering, completeness, limits, invalidation, and query seams without transferring Completion, Candidate, Integration, or canonical transition authority to Convergence.

## Summary

The safe shape is one immutable, versioned proof bundle per exact Convergence proof request. A request selects a versioned requirement profile and exact subjects; it may span several Runs and proof owners because the v1 delivery matrix crosses onboarding, Execution, Evidence, Memory, Language, Frame, and release-proof programs (`.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md:357-377`). The bundle is an inspectable delivery snapshot, not a Completion certificate, Candidate decision, Integration approval, Evidence verdict, Run transition, or release decision.

`ConvergenceProofBundleId` is an opaque stable identity for one request. Each immutable non-negative `BundleVersion` captures one canonical ordered member set. A changed member, observed current-authority tuple, fingerprint, requirement profile, canonicalization rule, limit binding, or causal edge requires a new version. Hashes prove the exact manifest but never replace request, bundle, member, or upstream domain identities (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:29-34`).

The bundle stores closed typed references to Execution records and exact upstream authority. Project Evidence records its stable current-authority slot; external Storage-operation Evidence instead records its exact partition, operation revision, current key, accepted evaluation and decision entries, digests, family verdict, dependencies, and limit usage. A favorable consumer must rerun direct structural validity inside its own command admission and settle before releasing the same read waterline. Replacement of any required upstream authority makes that historical bundle version stale immediately even if asynchronous invalidation materialization is delayed, matching the trusted-read precedent in ADR 0017 (`docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:80-96`).

## Detailed Findings

### Bundle Identity And Lifecycle

- One `ConvergenceProofRequestId` selects an immutable requirement-profile identity/version/fingerprint and exact typed proof subjects. The accepted profile, not an editable request role list, fixes mandatory member roles. The request grants no upstream command, transition, automatic limit override, lease, Effect, or release authority.
- One stable `ConvergenceProofBundleId` belongs to one request. Versions are immutable and append-only. An exact retry of the same Command ID/fingerprint returns its first settlement; every admitted new assembly Command ID creates the next attributed version even when the observed manifest repeats.
- The canonical manifest fingerprint covers schema and canonicalization versions, request and profile references, bundle identity and version, member count, every member position and discriminant, exact references and digests, causal edges, completeness accounting, and bundle-limit usage. Deterministic order and cardinality are part of the hash, following the sealed-manifest precedent (`docs/adr/0011-approved-run-preparation-and-amendment-authority.md:67-72`).
- A historical version never becomes usable again after an authority replacement, even if a later evaluation has equal content or digest. A fresh version must capture the new authority tuple.
- No mutable `current_bundle` pointer grants favorable authority. Consumers receive an exact bundle identity and version and validate it directly.

### Closed Typed Member Model

The root member union should remain closed and relational rather than accepting generic JSON or a bare subject ID:

1. `run-authority` references every exact policy epoch in the selected proof lineage, its accepted plan revision, tasks/DAG, profile, contracts, discipline, approvals, budgets, workspace authority, and fingerprints. Exactly one epoch per Run is marked as the requested current tip; prior epochs remain immutable lineage. Only Run preparation/amendment approval creates or activates those records (`docs/adr/0011-approved-run-preparation-and-amendment-authority.md:25-35`).
2. `sealed-invocation` references one exact Waypoint-parent or Worker seal, invocation context record and hash, expected sequence, task and workspace input, policy epoch, tools, provider/model, budgets, and output schema (`docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md:30-39`).
3. `execution-attempt` references a Model attempt, Tool invocation, Process job, or attributed terminal observation with its exact producer and owner records. A transport result is not semantic success.
4. `effect-chain` references one immutable Effect declaration and exactly one checked lifecycle arm. `no-boundary-crossing` requires conclusive current `EFFECT_NOT_STARTED` and proof that no physical boundary was crossed while preserving any durable intent, `started`, and pre-boundary records that do exist. `boundary-crossed-or-uncertain` carries the actual Journal, pre-boundary, owner-boundary/dispatch, terminal-observation, and reconciliation records. Every selected Storage operation contributes all external Effects and Journals under the same immutable request fingerprint through its selected current revision, while each member preserves its own admission revision (`docs/adr/0013-effect-reconciliation-and-recovery-journal.md:116-130`).
5. `current-evidence-authority` contains a checked partition arm plus a nested closed ADR 0010 family-current-key arm. The Project arm records `EvidenceCurrentAuthorityId`; the external Storage-operation arm separately records the Evidence row's accepted operation revision/Journal ordinal and the currently observed Storage-owner revision/state, plus partition, request fingerprint, current-key tuple, and no invented authority slot. Both retain current version, evaluation and decision identities/entries/digests, fingerprints, evaluator/rule/Capability versions, trust basis, Artifact-state dependencies, family verdict, and exact producer/evaluator limit usage (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:379-411`, `446-467`).
6. `completion-authorization` references exact contracts, Completion subject, current technical evaluation/decision, Finding snapshot, user acceptance, and immutable authorization. It cannot emit authorization or complete the Run (`docs/adr/0012-test-first-completion-proof.md:128-153`).
7. `candidate-provenance` references the accepted `COMPOSITION_COMPLETE` decision, Candidate identity/version/scope/fingerprint, immutable file manifest, baseline, and ordered predecessor-closed Worker-result membership. It cannot select results or accept the Candidate (`docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:52-63`).
8. `integration-application-proof` references an exact target, Candidate, applicability authority used for approval, Completion authorization, user approval, attempt, Effect decisions, before/expected/observed fingerprints, changed paths, lease release, and terminal application proof. It is required only when the request profile requires completed Integration; post-apply validity does not require the intentionally consumed `INTEGRATION_APPLICABLE` pointer to remain current (`docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:86-98`).

The requirement profile fixes ordered roles, typed selectors, cardinalities, freshness, and satisfaction predicates. The accepted integrated MaxReps profile requires all eight member arms. Run/final epoch/Completion subject, Integration target/mode, and ADR 0013 Storage-operation arm/revision are exact request subjects. Required historical epochs, Completion for every Run, Candidate provenance for Candidate subjects, and current Evidence obligations are derived from their complete typed dependency closure. The requester cannot omit a required epoch or Evidence key. Missing roles cannot disappear from the manifest: assembly records the unmet requirement and publishes no complete bundle version.

### Authority Boundaries

- Convergence may assemble, read, validate, and explain references. It cannot accept or invalidate Evidence, advance any `*_current_evaluations` row, select a family verdict, or re-evaluate an upstream subject (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:15-20`, `36-44`).
- Execution retains Run/Worker state, dispatch, attempts, workspaces, results, and operational composition (`docs/adr/0007-supervised-execution-aggregate-ownership.md:15-28`).
- Completion retains technical evaluation, user acceptance, and authorization. A bundle cannot complete a Run (`docs/adr/0012-test-first-completion-proof.md:128-138`).
- Candidate composition and user review remain separate. The bundle cannot read a live worktree as authority, choose Worker results, publish a Candidate, or request changes (`docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:52-84`).
- Integration retains target approval, lease-bearing preparation, attempt lifecycle, apply authority, and application proof (`docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:86-98`).
- Existing direct limit owners remain unchanged. The bundle records their identities, policy values, fingerprints, counters, and omissions but cannot grant headroom or reinterpret exhaustion (`docs/adr/0019-measured-evidence-result-limits-and-approval-authority.md:95-124`).
- Any future release decision remains a separate canonical command and owner. A complete usable bundle is input proof, not `release-ready` state.

### Canonical Order And Causality

- Every member has an explicit non-negative canonical position assigned by fixed role position, request-subject position, closed member-kind/owner order, owner-native ordinal, and stable identity bytes. Edges order by predecessor position, successor position, and closed reason order. Timestamps never decide membership, authority, or freshness (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:22-34`).
- Same-partition Evidence preserves `(project_sequence, entry_ordinal)`. Effect Journal facts preserve their Effect-local ordinal. Execution attempts preserve their owner-local expected sequence. These values are copied as observed ordering evidence, not replaced by bundle position.
- Storage-operation Evidence in `application.db` uses `(operation_journal_ordinal, entry_ordinal)` and an application-operation revision fence. There is no cross-database foreign key, transaction, or total order (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:379-411`).
- Explicit typed causal edges join members across owner sequences. A cross-partition edge proves only the declared identity/hash/request relationship; it cannot claim transactional or timestamp order.
- The manifest records the complete acyclic set of cross-root-member references with exact predecessor and successor positions plus the closed reason `epoch-precedes-epoch`, `policy-authorizes`, `plan-owns-task`, `invocation-creates-attempt`, `effect-precedes-boundary`, `evidence-supports-owner-proof`, `composition-publishes-candidate`, `completion-authorizes-output`, or `integration-applies-candidate`. Evaluation/decision relations contained inside one member are not self-edges.

### Completeness And Limits

The bundle needs a separate provisional profile because it is a delivery manifest, not an Evidence-family result. The starting profile should be `convergence-proof-bundle/0.1.0-local-balanced`, selected by the immutable Convergence proof request and explicitly marked low-confidence local authority. It reuses measured-safe vocabulary without becoming a sixth ADR 0019 Evidence limit owner:

- maximum 256 KiB canonical inline manifest;
- maximum 512 typed members;
- maximum 2,048 causal edges;
- maximum 30 seconds each for deterministic assembly and direct validation/consuming-owner settlement;
- zero copied source, prompt, model-output, secret, environment, full-path, repository-name, remote-URL, or Artifact bytes.

Each referenced Evidence member still carries its own ADR 0019 family policy and producer/evaluator usages. The bundle profile separately limits request admission, manifest assembly, validation/consumer settlement, and retained request/Project history. Reaching a bundle data ceiling records exact or lower-bound omitted counts and publishes no complete version. Validation timeout is broken, not incomplete. These values require measured recalibration before any non-local promotion, using the same privacy exclusions and exact-versus-censored sample separation as ADR 0019 (`docs/adr/0019-measured-evidence-result-limits-and-approval-authority.md:113-145`).

The profile also bounds retained history: 16 versions and 64 assembly attempts per request, 8 MiB canonical history per request, 256 request roots and 256 MiB canonical Convergence history per Project. Per-request user headroom cannot bypass Project ceilings. Reaching a cumulative ceiling rejects before adding prohibited history; no automatic deletion or fresh request resets accounting.

A sealed bundle is complete only when every profile-required role, cardinality, freshness rule, and satisfaction predicate passes, every reference is resolved and integrity-checked, and every required Evidence result has complete limit accounting. A trustworthy terminal role may carry an explicit failed, unavailable, or uncertain owner outcome when its record is complete; that remains visible input proof and never becomes a universal green bundle verdict. Missing records, stale authority, truncation, undecided work, malformed proof, or broken producers remain blockers.

### Direct Validity And Invalidation

`QueryConvergenceProofBundleValidity` is inspection only. A bounded in-process read-admission waterline first lets active relevant operations settle and blocks new relevant mutation admission across participating partitions. Held read transactions then validate bundle schema/hash/order/cardinality and structurally join every required current-authority reference. The Project arm compares its exact stable slot; the external arm compares its exact partition and operation revision. Both compare current version, evaluation, decision, entries, digests, fingerprints, limit bindings, and Artifact-state dependencies. The query also checks pending start/observation anti-joins so an older pointer cannot look favorable while a required decision is unsettled (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:483-490`). A future favorable consumer must run the same validation inside its own command admission and settle its owner decision before releasing that waterline; a prior inspection result authorizes nothing.

The inspection result is a query-only bundle usability projection. It may report `usable-at-observed-waterline`, `not-usable` with a closed ordered set of typed issues, or `failed` when no complete issue set can be trusted. Each issue retains the upstream family verdict and diagnostic references. A broken validation cannot degrade to absent, empty, incomplete, or usable (`.rpiv/decisions/degrade-distinguishes-broken.md:18-24`).

Same-database replacement of a referenced current-authority slot already appends ADR 0017's privacy-bounded `evidence-current-evaluation-replaced` event. A Convergence-owned reverse index can join that generic previous-authority tuple to affected bundle members without requiring Evidence to enumerate bundle dependants or emit another event. External Storage replacement has no cross-database event; direct validation compares its exact current partition authority and reads partition-local history for explanation.

Events support Attention, explanation, and asynchronous materialization only. Delivery lag or consumer failure cannot preserve trust because direct validation is mandatory. Canonical corruption, unreadability, malformed references, or incomplete dependency reads return `validation-failed` or `member-broken`, never an empty or favorable bundle.

## Code References

- `PRODUCT.md:70-72` - Evidence/Memory same-database invalidation and failure behavior.
- `PRODUCT.md:102-116` - Effect, Evidence, limits, Candidate, Completion, Integration, and Artifact ownership.
- `CONTEXT.md:82-91` - Evidence envelope, current authority, and result-limit vocabulary.
- `CONTEXT.md:123-128` - Completion subject, snapshots, acceptance, and authorization.
- `CONTEXT.md:163-169` - Candidate and Integration identities and proof authority.
- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md:30-39` - Sealed invocation identity and inputs.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:22-44` - Evidence envelope and atomic current authority.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:446-490` - Current keys, invalidation, and direct queries.
- `docs/adr/0011-approved-run-preparation-and-amendment-authority.md:25-35` - Run approval and policy-epoch ownership.
- `docs/adr/0012-test-first-completion-proof.md:128-153` - Completion acceptance and authorization boundary.
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md:116-148` - Physical Effect order and crash windows.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:52-98` - Candidate and Integration boundaries.
- `docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:80-96` - Direct trusted-read validation precedent.
- `docs/adr/0019-measured-evidence-result-limits-and-approval-authority.md:95-145` - Direct Evidence limit authority and promotion evidence.

## Integration Points

### Inbound References

- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md:207-219` - Convergence consumes completed program proof without owning behavior.
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md:357-377` - Cross-program proof-delivery profile.
- `.rpiv/artifacts/research/2026-08-26_17-25-29_evidence-result-size-limits.md:295-312` - Ticket 75 consumes Evidence limit policy without receiving authority.

### Outbound Dependencies

- ADR 0009 Execution invocations and attempts.
- ADR 0010 Evidence current-authority slots, decisions, dependencies, and queries.
- ADR 0011 Run policy epochs and accepted plans.
- ADR 0012 Completion authorization.
- ADR 0013 Effect and Recovery chains.
- ADR 0015 Candidate and Integration proof.
- ADR 0017 direct-validation and invalidation-event pattern.
- ADR 0019 family result limits and telemetry privacy.

### Infrastructure Wiring

- `slopstop.db` owns Project-side requests, immutable bundle versions, members, edges, same-database reverse indexes, and invalidation events.
- `application.db` remains the external Storage-operation Evidence partition; bundle references to it use immutable observed identities and revision fences without cross-database foreign keys.
- No production Evidence schema, evaluator registry, Artifact store, or Convergence runtime exists at this commit (`.rpiv/artifacts/research/2026-08-26_17-25-29_evidence-result-size-limits.md:310-312`).

## Architecture Insights

- The bundle is a deep read module: it hides multi-owner proof traversal behind one immutable manifest and one strict validity query while exposing no transition command.
- A requirement profile is safer than inferring all green Evidence because families retain different verdict meanings and some requests legitimately exclude Integration application proof.
- Direct current-authority equality under a held waterline is the trust seam. Inspection informs the user; a favorable consuming command repeats validation and settles before release. Events improve responsiveness and explanation but never replace that in-command check.
- Bundle order explains a cross-owner proof narrative but cannot manufacture a global database order.
- Separate manifest limits prevent a bounded family result from becoming unbounded when many valid results are aggregated.

## Precedents & Lessons

Five similar changes were analyzed.

### Precedent: Typed Evidence Current Authority

**Commit(s)**: `d7d6b10`, `1ddf460` - "docs(evidence): define typed ledger authority" (2026-08-26)

**Lesson**: exact identities and accepted decisions define authority; equal hashes do not.

### Precedent: Completion Proof Snapshots

**Commit(s)**: `f11ff66` - "docs(completion): define test-first proof authority" (2026-08-26)

**Lesson**: zero rows are favorable only after a complete, non-truncated direct query.

### Precedent: Candidate Manifests

**Commit(s)**: `85e6df1` - "docs(integration): define exact candidate composition" (2026-08-26)

**Lesson**: immutable ordered membership and lineage outrank live worktrees and final digests.

### Precedent: Evidence-To-Memory Invalidation

**Commit(s)**: `1710e0c` - "docs(memory): define evidence invalidation authority" (2026-08-30)

**Lesson**: direct validation provides immediate safety; events provide asynchronous materialization and explanation.

### Precedent: Measured Evidence Limits

**Commit(s)**: `6d3d535` - "docs(evidence): define measured result limits" (2026-08-30)

**Lesson**: truncation remains inspectable and blocking; direct owners and privacy-bounded telemetry cannot be replaced by consumer configuration.

### Composite Lessons

- Seal exact identities, current decisions, order, cardinality, and digests together.
- Treat direct complete query results as proof; never infer proof from absence or latest timestamps.
- Keep assembly, validation, explanation, and upstream authority as separate responsibilities.

## Historical Context (from `.rpiv/artifacts/`)

- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md` - v1 program ownership and proof deliveries.
- `.rpiv/artifacts/research/2026-08-26_17-25-29_evidence-result-size-limits.md` - measured Evidence-family limits and ticket-75 dependency.
- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-57-test-first-completion-proof.md` - Completion proof design.
- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-61-parallel-worker-candidate-composition.md` - Candidate and Integration design.
- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-63-evidence-ledger-architecture.md` - Evidence ledger design.

## Developer Context

**Q (`.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md:357-377`): Should the bundle be scoped to one Run/Candidate or to one versioned Convergence proof request that may reference several Runs and proof owners?**

A: Continue with the recommended request-scoped model. A versioned requirement profile fixes the exact mandatory members; the bundle does not aggregate their authority.

## Related Research

- `.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md`
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md`
- `.rpiv/artifacts/research/2026-08-26_17-25-29_evidence-result-size-limits.md`

## Open Questions

1. Which local repositories and workload classes should form the first privacy-safe telemetry cohort before a non-local bundle-limit profile is proposed?
2. Which future canonical owner, if any, will consume a usable bundle to make a separate release decision? Ticket 75 deliberately does not assign that transition.

## Follow-up Research 2026-08-31T12:32:36+0100

ADR 0017's existing `evidence-current-evaluation-replaced` event is already the privacy-bounded same-database fact required to explain why a referenced authority changed (`docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:24-43`). A second `convergence-proof-bundle-invalidated` event would duplicate that fact, make Evidence enumerate Convergence dependants, and add write amplification without improving read safety. The accepted direction therefore reuses the generic replacement event plus a Convergence-owned reverse index for same-database explanation. External Storage-operation Evidence has no cross-database event and remains protected by direct current-authority validation and partition-local history.

This refinement does not change the mandatory validity seam. Every favorable consuming command still reruns bounded structural validation and settles before releasing its read waterline; replacement-event delivery, lookup, or explanation can lag without preserving bundle usability (`docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:80-96`).

## Follow-up Research 2026-08-31T14:10:00+0100

Adversarial review exposed four underspecified parts of the initial synthesis. ADR 0020 now makes the accepted integrated MaxReps profile concrete with eight ordered roles, closed typed subject selectors, cardinality, freshness, and satisfaction predicates; distinguishes Project Evidence authority slots from external Storage-operation revision authority; defines deterministic member and edge ordering from closed owner keys; and scopes promotion evidence independently by operation and dimension.

The same review found that independent per-database reads could validate a state combination that never coexisted and that releasing a read barrier before consumption creates another stale-use race. The accepted refinement uses a bounded in-process read-admission waterline: active relevant operations must settle, new relevant mutation admission pauses, participating revisions are read and rechecked, and failure to acquire or finish within the deadline returns failure rather than a skewed favorable result. Inspection releases the barrier and authorizes nothing. A favorable consuming command must run validation inside its own admission and settle its owner decision before release. This is coordination for coherent reads, not a durable lease, distributed transaction, upstream command, or new canonical authority.

Integration Evidence needs a temporal role as well as an identity. The applicability decision consumed before apply remains `immutable-consumed` provenance because application-proof creation deliberately replaces it. The profile derives the post-apply current Integration-applicability key separately. More generally, owner references declare `immutable-consumed | exact-current`, and only the latter enter the current-Evidence member closure. External Storage Evidence becomes reachable through an exact typed Storage-operation request subject rather than an unbound Project-wide scan.
