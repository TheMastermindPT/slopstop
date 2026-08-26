---
date: 2026-08-26T03:57:45+0100
researcher: OpenCode
repository: slopstop
branch: decision/ticket-59-effect-reconciliation
commit: 9695484
status: accepted
research_files:
  - .rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md
tags:
  - solutions
  - ticket-59
  - effects
  - recovery
  - reconciliation
open_questions: []
---

# Ticket 59: External Effect Reconciliation

## Problem Statement

After crashes, retries, cancellation, or lost process observation, the harness must distinguish whether an external effect did not happen, happened, partially happened, or remains uncertain. It must never repeat or report an effect safely without Evidence.

## Constraints

- Intent and `started` are durably flushed before execution.
- Once `started` is durable, the effect identity is consumed even when later Evidence proves that the external boundary was not crossed.
- Every Effect has exactly one closed subject arm: `run-worker`, `project-operation`, or `integration`. Project operations do not require a fabricated Run or Run workspace.
- Process exit, adapter return, cancellation acknowledgement, and risk acceptance are not semantic or effect success.
- The Application coordinator owns the common Effect identity/declaration mechanism. Execution, the Artifact/Storage operation owner, or Integration retains its subject arm's operation lifecycle and attributed owner observations. Evidence owns Recovery Journal facts, typed effect observations, evaluations, decisions, and the current effect outcome.
- Integration apply remains a separate aggregate and effect boundary.
- Recording an Effect observation and deciding its evaluation are separate commands. A crash between them leaves a direct unresolved blocker and never exposes an old or absent current pointer as clean.
- Missing, broken, truncated, rejected, stale, or uncertain recovery inputs never become clean, absent, safe, or completed.

## Current State

ADR 0008 defines append-before-execute Recovery Journal semantics, Process-job terminal observations, conservative leases, and Evidence-owned reconciliation. ADR 0010 defines the Effect and Recovery Evidence families and their atomic current evaluations.

## Options Considered

| Option | Strength | Main risk | Disposition |
| --- | --- | --- | --- |
| Unified Effect Dossier | One understandable operational story | Can become a second process or Evidence ledger | Retain as a query/view only |
| Effect Fact Ledger plus projection | Strong crash recovery and auditability | Can become generic event sourcing | Retain as typed Recovery Journal facts |
| Typed Reconciliation Chambers | Correct effect-specific observation | Can fragment one operation across modules | Retain as adapters that observe only |
| Stable effect plus facts, projection, and typed reconcilers | Preserves identity, history, and specialized recovery | Requires strict authority boundaries | Accepted |

## Accepted Direction

Give every effect one stable `EffectId`, exactly one `run-worker`, `project-operation`, or `integration` subject, and one immutable relational declaration. The common root contains only identity, subject kind, command, final argument, and declaration hash. Subject children require only their exact owner, operation, scope, workspace, and before-state fields. Other declaration children record admission authority, policy and Capability versions, approval, budget, lease/read claim or explicit none, idempotency, cancellation, observer versions, terminal proof, and typed resource keys. ADR 0013 alone owns the closed `DeclaredEffectSet` class and resource-key vocabularies, including `project-storage` and its logical registry, operation, generation, Project snapshot, backup, export, import-source, and deletion-tombstone keys without machine paths. The Application coordinator owns this common mechanism; Execution, the Artifact/Storage operation owner, or Integration retains the selected arm's lifecycle and owner observations. The Evidence writer appends Recovery Journal facts against the same effect identity. Typed reconcilers observe files, Git, local Artifacts, Project Storage, processes, external services, and credential access and emit attributed typed observations; they never select an outcome or authorize retry.

Keep `run-worker`, Artifact-removal, and Integration partitions in `slopstop.db`. Keep the Storage-operation partition in `application.db` beside its external operation journal, where it survives migration, generation replacement, runtime reset, or deletion. It uses operation-journal ordering and application operation revision instead of a fabricated Project sequence or Writer generation. No cross-database foreign key or transaction is claimed.

Every physical Effect first flushes intent and `started`. `RecordEffectObservation` then appends the exact `started-before-boundary` observation and Journal reconciliation fact without an evaluation, decision, or current-pointer write. A separate `DecideEffectReconciliation` command accepts current `EFFECT_STARTED_UNSETTLED`; only then may the owner flush its Model attempt, Tool-invocation effect-start observation, Process-job `starting` transition, `ARTIFACT_REMOVAL_STARTED` observation, Storage-operation step, or Integration apply-start boundary record. Artifact removal additionally runs `DecideArtifactStateEvaluation`, persists the accepted removal-started decision, and atomically advances current Artifact state before byte deletion. Only after every applicable owner gate may the physical boundary be crossed. Terminal observations and their decision happen later. Pending `started` facts and undecided observations are direct indexed blockers, so every crash window is queryable and cannot make an older current evaluation appear clean. The source's provisional `EffectOutcomeHead` name is replaced by ADR 0010's existing current evaluation; there is no second current pointer, writer, or dossier authority. The Effect Dossier is a read-only projection over the subject/declaration, Journal facts, owner observations, Evidence history, current Effect evaluation, applicable Run Recovery evaluation, and applicable Artifact/Storage/Integration owner state.

Individual Artifact removal is a `project-operation` Effect with an `artifact-removal` arm. It requires the exact Artifact, Artifact-state version, accepted removal decision, and both required ADR 0013 Artifact resource keys. The accepted pre-boundary Effect decision precedes the `ARTIFACT_REMOVAL_STARTED` observation. `DecideArtifactStateEvaluation` then persists its accepted decision and advances current Artifact state atomically before byte deletion. Pending removal blocks byte use even while the older Artifact current pointer still exists.

Use ADR 0010's exact Effect outcome vocabulary. Cancellation, Process-job status, remote acknowledgement, rollback, abandonment, and accepted risk remain inputs or separate actions; none is another effect-outcome vocabulary. Avoid the generic term `settlement` here because ADR 0006 reserves it for durable command processing.

## Retry And Recovery Direction

- The canonical command-idempotency check runs before effect declaration or dispatch. An exact command retry returns its original receipt and identities; a conflicting fingerprint is rejected.
- An effect with durable `started` is never relaunched. A retry uses a new command, owner-attempt identity, `EffectId`, Recovery Journal, before fingerprint, budget decision, and applicable coordination proof after exact Effect authorization plus matching Run Recovery, Artifact/Storage, or Integration authority for its subject.
- A transport resend may remain under the existing identity only when the remote system proves the same request and idempotency identity. That is continuation of one dispatch, not a new effect attempt or exactly-once behavior.
- Cancellation closes new dispatch and appends request and observation facts, but the real effect is still evaluated as not started, completed, failed with no effect, partial, scope-violating, missing, truncated, uncertain, rejected, or broken.
- Compensation or rollback is another declared effect linked to the original. It never rewrites the original outcome.
- Abandonment records that recovery will not continue automatically while preserving the unresolved outcome and blockers. Risk acceptance may explain why the user proceeds outside a safety claim; it cannot create successful recovery, a Safe checkpoint, retry authority, or Integration applicability.

## Parallel Subject Semantics

- Every effect pins one exact subject arm and its matching Evidence scope, before state, policy, declaration classes, and typed resource keys. A Run/Worker arm pins its Run target and workspace arm; a Project operation pins Artifact or Storage operation state; Integration pins Candidate and target state.
- Separate worktrees do not isolate shared Git administration, refs, hooks, caches, services, credentials, or remote resources. These require declared resource keys and coordination.
- Independent effects may run in parallel only when their subject scopes remain distinct where required and every shared-resource access is compatible. Mutation, unknown access, or an unresolved effect closes conflicting dispatch on that resource key.
- Fan-in combines selected repository deltas. It never merges, hides, or collectively reconciles unrelated remote, credential, process, or local-artifact effects.
- Cancellation retains completed facts and reconciles active or uncertain effects before leases, checkpoints, Integration, discard, or cleanup can claim safety.

## Historical Evidence

Historical logs, provider receipts, Git reflog material, exported manifests, and local artifacts enter through ADR 0010's `imported-source` Artifact provenance with exact source, importer, trust basis, integrity, and observed time. They may support a typed reconciliation when they bind conclusively to the effect identity and declaration. They cannot be backdated into Recovery Journal facts, manufacture a missing `started` record, or turn absence of a log into proof that no effect occurred.

## Risks And Mitigations

- Duplicate process truth: Process jobs report execution observations; they never imply effect outcome.
- Premature retry: require conclusive current Effect Evidence, exact subject-owner safety authority, and a new identity after `started`.
- False current during a crash window: anti-join pending starts and undecided observations before every favorable consumer; never infer their verdict from an old or absent pointer.
- Giant reconciler: keep one domain contract and typed adapter observers for each effect class.
- Unbounded shared resources: require each Capability and final authorized action to declare exact effect classes, scopes, and resource keys before dispatch.
- Duplicate current authority: use only ADR 0010 current evaluations; keep the Dossier query-only.
- False clean recovery: preserve missing, broken, truncated, rejected, stale, and uncertain inputs as explicit blockers.

## Approval

The user approved stable effect identity, the closed three-arm subject union, immutable relational declaration, append-only Recovery Journal facts, separate observation and decision commands, typed observer reconcilers, ADR 0010 atomic accepted current outcomes, exact Artifact removal keys, the `project-storage` declaration and logical keys, delete generation membership, universal pre-boundary `EFFECT_STARTED_UNSETTLED`, and a read-only dossier projection as the final direction for ticket 59.

## Implementation-Design Closure

ADR 0013 closes the accepted direction at implementation-design depth. It fixes authority boundaries, the exact subject and shared vocabularies, relational declaration children, Project Storage resources and delete membership, Journal facts, existing ADR 0010 outcomes, mandatory two-step pre-boundary and terminal observation/decision authority, append and flush order, crash windows, typed observer sufficiency, idempotency, subject-specific retry authorization, cancellation, compensation, abandonment, historical Artifact use, exact Artifact removal keys, parallel scopes, Integration separation, commands, tables, constraints, indexes, startup recovery queries, and explicit issue-closure coverage.

## Complexity

High. Initial typed reconcilers cover workspace files, Git index/refs/worktree administration, local Artifacts, Project Storage, Process jobs, external services, and credential access. Generalized plugins and cross-effect analytics remain deferred.

## References

- `docs/adr/0006-physical-persistence-layout.md`
- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md`
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md`
- `PRODUCT.md`
- `CONTEXT.md`
- GitHub issue `#59`
