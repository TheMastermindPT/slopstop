# ADR 0011: Approved Run Preparation And Amendment Authority

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

ADR 0007 makes a Run point to exact contract, Delegation-plan, profile, and policy revisions without creating a generic Run revision. ADR 0008 fixes one immutable Run-workspace binding and requires exact fingerprints, leases, and effect recovery. ADR 0009 requires every Sealed Invocation to pin current dispatch authority. ADR 0010 keeps Evidence scope-specific and independently authoritative.

The remaining decision must let the user review one complete proposal before any accepted plan, task identity, or policy epoch exists. It must also define how amendments preserve or invalidate prior work without allowing a model-specific command, runtime queue, reverse index, or presentation projection to become approval authority.

## Decisions

### Authority Boundaries

- Use one immutable `Run policy epoch` as the approved authority basis for Run dispatch. An epoch belongs to one Run, has a strictly increasing non-negative epoch number, references its sealed proposal and separate approval decision, and is created and activated only by `ApproveRunPreparation` or `ApproveRunAmendment`.
- Keep one exact accepted `DelegationPlanRevision` as the sole owner of the Task DAG. Accepted Delegation tasks and dependency edges are created only in the same approval transaction that creates the selecting epoch.
- Keep a `DelegationPlanProposal` separate from an accepted plan revision. Its node keys, dependencies, fan-out declarations, and fingerprints are provisional and have no `DelegationTaskId`, Task DAG, or dispatch authority.
- Seal one `Run approval proposal` and project one complete user-visible `Run approval view` before the approval decision. A compatible `RunAmendmentProposal` is its one-to-one amendment extension and owns all immutable prior task, Worker, result, and started-effect classification rows. Neither proposal nor view is an epoch or an accepted plan.
- Permit an `Approval Dependency Graph` only as a rebuildable reverse invalidation and explanation index over existing authoritative references. It adds no precedence edge, acceptance state, applicability decision, or dispatch authority.
- Derive ready, blocked, fan-out, fan-in, and concurrency views from the current epoch, its accepted plan DAG, exact live preconditions, Worker facts, and Evidence. Persist none of those views as authority.
- Do not create a generic Run revision, Run charter, flattened effective-policy snapshot, second approval aggregate, second Task DAG, or generalized graph authority. The `runs` row remains ADR 0007's directly queryable current pointer holder, but stores no separate current Run-profile pointer; the current epoch alone selects the current profile revision.

### Proposal Before Decision, Epoch After Decision

The preparation sequence is deliberately non-circular:

1. `SubmitRunPreparation` writes an immutable Delegation-plan proposal and one exact Run-profile selection. Initial preparation requires a complete resolved `RunProfileProposal`; an amendment selects either its predecessor's exact Run-profile revision unchanged or a complete replacement proposal.
2. It writes one immutable Run approval proposal containing exact pre-decision inputs and a canonical manifest hash. A Run amendment also writes its immutable task, Worker, result, carried-result, and started-effect classification children before sealing.
3. It writes one bounded Run approval view that projects that already-sealed proposal and repeats its manifest hash.
4. An approval or rejection command writes a separate decision and command receipt against the exact proposal and view hash.
5. Only an approval transaction creates accepted Delegation-task identities, the accepted plan revision and Task DAG, the initial Run-profile revision or an amendment replacement revision, and the Run policy epoch. The epoch references the proposal identity and hash, amendment classification-set hash when applicable, approval decision, and receipt.

The proposal and view never reference the later decision, receipt, accepted plan revision, accepted task identities, accepted Run-profile revision, or epoch. The accepted records may reference the earlier proposal. Rejection or supersession creates none of those accepted records.

### Exact Owned Inputs

A sealed Run approval proposal references only authority already owned by accepted decisions:

- exact Project, Run, Waypoint, Waypoint revision, Action family, and Action version;
- exact accepted Behavior Contract, Test Contract, and Completion Contract revisions plus the clause identities covered by proposed work;
- exact Delegation-plan proposal identity, provisional-node fingerprints, and canonical proposal fingerprint;
- exact current Project-profile revision and a discriminated Run-profile selection: initial preparation must reference one complete resolved Run-profile proposal, while an amendment must reference either the exact predecessor profile revision unchanged or one complete resolved replacement proposal;
- exact current Run workspace, immutable mode and baseline, starting fingerprint, physical-resource identity when applicable, and task-input requirements;
- exact current Evidence evaluation decisions, Evidence scope fingerprints, Artifact-state versions, trust bases, and prior accepted Worker-result selections;
- exact predecessor epoch, accepted plan revision, and Run-profile revision for an amendment;
- exact compatible Run amendment request, contained Model-change Control requests, and immutable proposal-child classifications for every prior task, Worker, result, carried result, and Recovery-Journal-started effect when applicable;
- exact budget, cost, token, time, retry, remediation, output, and concurrency proposal values owned by this decision, plus one canonical limits fingerprint;
- canonical encoding version, profile fingerprint, amendment classification-set hash when applicable, proposal manifest hash, Writer generation, Project sequence, and submission receipt.

The proposal's comprehension result is a sealed condition over the exact currently owned Waypoint and contract revisions, not a foreign key to a separate Comprehension-checkpoint aggregate. Prompt compiler sources, visible tools, provider capability reports, and per-invocation budgets remain ADR 0009-owned inputs and are pinned when a Sealed Invocation is prepared.

An accepted epoch references the proposal identity and hash, approval decision and receipt, accepted Delegation-plan revision, accepted Run-profile revision, exact predecessor epoch when applicable, and the same currently owned workspace, profile, contract, Evidence, Artifact-state, and limit fingerprints selected by the proposal. For an amendment it also references the exact `RunAmendmentProposalId` and classification-set hash whose immutable children the decision accepted. It copies neither independently owned revision content nor amendment classification rows.

### Complete Resolved Run Profile

- Initial preparation always contains one immutable complete resolved Run-profile proposal. Every value is present even when inherited unchanged from Application or Project defaults, and each value records its exact source identity, source version or accepted revision, resolution rule version, normalized resolved value, position when ordered, and contribution to the profile fingerprint.
- `SubmitRunPreparation` rejects an initial proposal with an absent, partial, unresolved, stale, or broken profile. The approval view shows the complete resolved values and provenance, not only overrides.
- `ApproveRunPreparation` creates the accepted Run-profile revision only by copying and re-verifying that sealed resolved proposal in the approval transaction. It cannot resolve a default, add a value, or choose authority that the user did not see.
- A Run amendment uses one closed selection: `retain-current-profile` references the exact profile revision selected by the predecessor epoch, while `replace-profile` references one complete resolved replacement proposal. Model change requires `replace-profile`.
- Each accepted Run-profile revision references its source proposal and exact fingerprint. Current profile lookup follows `runs.current_run_policy_epoch_id -> run_policy_epochs.run_profile_revision_id`; no `runs.current_run_profile_revision_id` or equivalent pointer exists.

Action-prompt revisions, development-discipline decisions, one-Run exceptions, and testability proposals have no owner record in the current decision set. This ADR creates no table, foreign key, or accepted placeholder for them. A proposal that needs one remains blocked with `UNOWNED_AUTHORITY_REFERENCE` until a later accepted owner decision defines its identity, lifecycle, and persistence.

### One Sealed Approval View

- Build the Run approval view only from the sealed proposal. Show the objective, comprehension result, contract coverage, provisional tasks and dependencies, fan-out groups, fan-in order, workspace topology, task inputs, complete resolved Run-profile values and sources, provider/model choices, tools and Capability requirements resolved from currently owned inputs, effect scopes, budgets and limits, required later per-effect approvals, live restrictions, unresolved conditions, and the complete diff from the current epoch for an amendment. An amendment view also shows every task, Worker, result, carried-result, and started-effect classification row with its exact identity, decision, Evidence, and carry-forward meaning; each started-effect row additionally shows its unique-key variant and reconciliation decision.
- Seal the canonical proposal manifest and separately bounded human-readable projection with their encoding versions, artifact identities, sizes, and hashes. The canonical manifest includes the profile fingerprint and a deterministic ordered encoding of every amendment-classification child row. Its `classification_set_hash` covers the owning `RunAmendmentProposalId`, row kind, identity, all decision fields, order, and cardinality, so a corrected proposal receives a distinct hash even when every classification value repeats. The approval decision binds the proposal manifest hash, classification-set hash when present, and view projection hash.
- Always show the complete proposal. The UI may collapse unchanged sections but cannot approve a filtered subset or omit unchanged authority from the sealed hash.
- A correction creates a new Delegation-plan proposal, Run approval proposal, view, and hashes. Every corrected Run amendment proposal always inserts a new complete immutable classification child set owned by that new proposal and computes a new owner-bound classification-set hash, even when all classifications repeat unchanged. It never reuses or reparents prior proposal-owned rows and never edits an existing proposal child, proposal, view, decision, accepted plan, accepted task, profile revision, or epoch.
- Fine-grained future effect approvals remain independent. The view states each requirement but cannot pre-approve unknown Tool arguments or effects.

### Contracts, Comprehension, And Future Authorities

- Preparation records one comprehension condition proving that the exact Behavior Contract's consequential, ambiguous, disputed, limit, and failure expectations are visible and settled in the sealed proposal. A pending, disputed, rejected, stale, missing, or broken condition grants no dispatch authority.
- Every provisional task node links to at least one exact Behavior Contract or Completion Contract clause and declares the Test Contract checks or currently owned Evidence it is expected to produce. Coverage is many-to-many and gaps are visible in the approval view.
- A changed Behavior, Test, Completion, Waypoint, Project-profile, or other owned revision always creates a changed proposal and requires another approval. Text equality does not let a different accepted identity enter silently.
- Prompt content is compiled and sealed through ADR 0009's owned prompt compiler sources and Invocation context record. This ADR does not invent an Action-prompt revision owner. A changed compiled source or prompt hash requires a new Sealed Invocation and dispatch admission under the current epoch.
- Test-first remains the default discipline fixed by the repository foundation and Product contract. When the exact Test Contract cannot define an owned proof route, preparation blocks with `TESTABILITY_AUTHORITY_MISSING`. This ADR does not manufacture a one-Run exception or testability proposal to bypass that absence.

### Delegation Plan Proposal And Accepted Task DAG

- Give each Run one stable `DelegationPlanId`. A `DelegationPlanProposal` has one immutable proposal identity, canonical encoding and fingerprint, proposed-by attribution, optional predecessor accepted revision, and ordered provisional nodes addressed only by proposal-local keys.
- A provisional node fingerprint covers role, purpose, contract-clause links, result schema, model-selection rule, currently owned Project-profile requirements, tool schema hashes, effect scopes, workspace/input requirement, budget and limit allocations, risk class, approval requirements, and completion handoff.
- A proposal may select an unchanged accepted predecessor task by exact `DelegationTaskId` and fingerprint. New or changed content has only a provisional node key until approval.
- `ApproveRunPreparation` or `ApproveRunAmendment` atomically allocates the accepted `DelegationPlanRevision`, creates `DelegationTaskId` values for new nodes, records exact revision membership, and writes accepted dependency, fan-out, independence, input, and ordering rows. A rejected or superseded proposal creates no accepted task identity or DAG row.
- Store directed predecessor edges, fan-out groups, pairwise independence declarations, and deterministic fan-in order only under the accepted plan revision. Reject self-edges, duplicate edges, references to non-member tasks, and any directed cycle.
- A task is derived ready only when every predecessor and exact input requirement is satisfied; the current epoch selects its accepted plan and fingerprint; required Evidence, policy, budget, workspace, capability, slot, and live restrictions permit dispatch; and no pending Control request closes dispatch.
- The Waypoint parent may propose fan-out and interpret fan-in. The deterministic Application coordinator recomputes and admits each dispatch. A Worker, provider, runtime, or adapter may never create a task, dependency, sibling, join, retry, Resolver, or result acceptance implicitly.

### Exact Fan-Out And Task Inputs

A mutating sibling set may dispatch concurrently only when the accepted plan and current epoch prove all of these facts:

- every task belongs to one exact approved fan-out group;
- every pair is explicitly independent for the approved effect scopes and has no Task-DAG path between them;
- every sibling uses the same exact immutable source input and accepted baseline fingerprint;
- every task has an isolated mutation resource, with no shared mutable checkout, lease, Git administrative resource, credential mutation, or unpartitioned external-state scope;
- the group fixes maximum concurrency, shared and per-task budgets, deterministic downstream composition order, and conflict behavior;
- current workspace, slot, policy, capability, Evidence, budget, and live-restriction checks pass independently for every admission.

Read-only siblings may share one physical resource only under ADR 0008 read claims at the same accepted fingerprint. A plan declaration cannot weaken ADR 0008's mutation rules or grant Candidate authority.

- One-predecessor input selects one exact accepted predecessor result through a newly sealed task-input snapshot.
- Multi-predecessor input materializes all required accepted results in the accepted plan's order. The snapshot records composer identity/version, source identities and hashes, baseline, canonicalization, conflict behavior, output artifacts and fingerprint, producer attempt, and Evidence decision.
- Missing, rejected, stale, changed, conflicting, truncated, uncertain, or broken input stays distinctly blocked and never becomes an empty composition.
- A composition conflict creates Attention and a typed blocked condition. It creates no implicit Worker, task, retry, Candidate, or Integration action.
- Candidate selection, Candidate materialization, Candidate review, and Integration remain outside this decision and with their existing owners.

### Resolver Work

- Resolving a composition conflict is new scoped work. Dispatch requires an independently submitted Run amendment request, a new provisional Resolver node, generic amendment approval, a new accepted Resolver task identity, a new accepted plan revision, and a new Run policy epoch.
- The Resolver proposal pins the exact conflict observation, predecessor results and hashes, composition specification, workspace input, provider/model rule, currently owned tool and capability requirements, effect scope, budget, Evidence requirements, and result schema.
- An approved Resolver receives a fresh Worker, Invocation context record, Sealed Invocation, Command ID, and Recovery Journal identity. It is not a retry, hidden fan-in hook, or Candidate repair.

### Initial Preparation And Run Amendments

- A manual Action creates no Run until `BeginAction`. That command rechecks Action availability, acquires the Run slot, creates the Run and Waypoint parent in `draft`, and records the manual cause.
- `PrepareAutomaticAction` may create a `draft` Run and prepare a proposal, but cannot approve an epoch, enter `ready`, start a Worker, or cross a model, tool, process, workspace-mutation, or external-effect boundary.
- `SubmitRunPreparation` accepts a `draft` initial Run, an `amendment-requested` Run, or an `awaiting-approval` Run with the exact pending proposal. It validates provisional-plan acyclicity, complete manifest inputs, the required initial resolved profile or amendment profile-selection variant, amendment compatibility and complete newly owned classification children when applicable, and expected versions; seals the proposal and view; and moves the Run to `awaiting-approval`. Replacing a pending amendment proposal marks that proposal `superseded`, inserts a new complete child set under the replacement even when values repeat, computes the replacement's owner-bound hash, and records an `awaiting-approval -> awaiting-approval` self-transition with a new Entity version.
- `RejectRunPreparation` records an attributed initial rejection and moves `awaiting-approval -> draft` without accepted tasks, plan revision, profile revision, or epoch. `RejectRunAmendment` rejects the amendment and its contained pending Model-change requests, then moves `awaiting-approval -> amendment-requested`; the prior epoch remains current and dispatch stays closed.
- `ApproveRunPreparation` applies to the exact current non-superseded proposal whose kind is `initial`, terminal decision is absent, hashes match, and Run has no current or historical epoch. The proposal need not be the first proposal attempted: correction and rejection cycles may produce any number of terminal initial proposals before the current one. Its one fenced transaction writes the decision and receipt, creates the accepted plan revision, tasks and DAG, creates the Run-profile revision exactly from the sealed resolved profile proposal, creates and activates epoch 0, updates only the Run's current plan and epoch pointers, and moves `awaiting-approval -> ready`.
- `StartRun` re-evaluates the current epoch and all live dispatch preconditions. It moves `ready -> running` only when none is unresolved and still does not dispatch a task until that task's own exact admission succeeds.
- `SubmitRunAmendmentRequest` first proves the requested intent is compatible with the existing Run. An incompatible command returns `RUN_AMENDMENT_INCOMPATIBLE` and atomically persists ADR 0006's mandatory rejected command receipt, structured `command_rejections` row, and `command_idempotency` settlement. It writes no Run amendment request, Run aggregate change, lifecycle transition, or Canonical event. A compatible request records one Run-targeted Control request against exact Run, epoch, plan, workspace, and condition versions, closes new Run dispatch immediately, and moves the Run to `amendment-requested`. In-flight work may only settle to the selected safe boundary.
- A compatible amendment preserves Run, Waypoint, Action, and immutable Run-workspace mode/baseline/resource binding. It may change contracts, tasks, dependencies, models, budgets, or prior-work selection only through a new proposal and generic approval.
- `ApproveRunAmendment` recomputes compatibility and verifies the exact current non-superseded amendment proposal, view hash, manifest hash, profile-selection fingerprint, classification-set hash, child-row identities and cardinality, and every live compare-and-set input. In one transaction it writes the decision and receipt, thereby accepts exactly those immutable proposal-child classifications, creates the accepted plan revision and new tasks and DAG, retains the predecessor profile revision or creates the replacement revision exactly as sealed, creates and activates the next epoch referencing the amendment proposal and classification-set hash, updates only the Run's current plan and epoch pointers, marks the Run amendment request applied, and moves contained Model-change requests to `approved-pending-apply`. It inserts no epoch-owned classification copy. It selects `ready` or `blocked` only after the complete lifecycle evaluator runs. `StartRun` separately reopens dispatch.
- `SubmitModelChange` never creates or activates a profile revision or epoch. It creates or attaches its exact target and proposed provider/model values to a Run amendment request. Sealing the amendment makes it `amendment-attached`; only `ApproveRunAmendment` may make it `approved-pending-apply` with an already-current epoch and the profile revision that epoch selects.
- `ApplyWaypointParentModelChange` and `ReplaceStoppedWorkerModel` consume an `approved-pending-apply` request and its already-current epoch. They may update the parent selection or create the linked replacement Worker and mark the request applied, but cannot create or activate profile or epoch authority.
- Contradictory intent is outside Run amendment authority. It uses ADR 0007's single existing `SupersedeRun` transaction; this ADR defines no second supersession path or write set. Any continuation begins as a new Run under normal Run-slot authority.

### Prior Work And Started Effects

Every sealed `RunAmendmentProposal` owns immutable child rows that classify each prior task, Worker, and result exactly once. The rows exist before approval, appear in the sealed view, and contribute to the proposal manifest and classification-set hashes:

| Classification | Meaning |
| --- | --- |
| `not-started-retained` | The same accepted task identity and fingerprint remains selected and no Worker or effect started. |
| `checkpointed-worker-retained` | The same Worker reached a portable checkpoint and its task, input, workspace, effect scope, model rule, and remaining budget are unchanged. |
| `accepted-result-carried` | The proposal selects one exact terminal result, Artifact set, Evidence decision, input/result fingerprint, Worker, task, and source epoch for acceptance by reference. |
| `completed-unselected` | Prior work remains immutable history but the new plan does not consume it. |
| `invalidated` | Changed authority or input makes the prior item inapplicable. |
| `abandoned` | The user excludes reconciled prior work while history remains. |
| `recovery-required` | A required output or effect is uncertain, missing, or broken and prevents approval. |

Every effect identity whose Recovery Journal reached `started` receives exactly one immutable child row of that same `RunAmendmentProposal`. The row is sealed and shown before approval and binds the exact effect identity, external or provider unique key when available, source Command ID and fingerprint, source epoch, terminal or recovery decision, Evidence reconciliation decision, and one closed carry-forward semantic:

| Effect decision | Required amendment meaning |
| --- | --- |
| `completed-retained` | Preserve the proved terminal effect and explicitly select its result or external state under the new plan. |
| `completed-unselected` | Preserve history but grant no new plan dependency or authority from the effect. |
| `failed-closed` | Preserve conclusive failure; any retry requires a fresh effect identity and unique key after approval. |
| `cancelled-closed` | Preserve conclusive cancellation; any later attempt uses fresh identities. |
| `proven-not-started` | Preserve the consumed local identity while proving no external effect occurred; later work still uses fresh identities. |
| `compensated` | Reference the distinct terminal compensation effect and Evidence proving the original external state is reconciled. |
| `recovery-required` | Preserve uncertainty and block amendment approval; never carry, retry, or report clean. |

- Carry-forward is never inferred from labels, paths, prose, timestamps, or hashes alone. Hashes bind the complete immutable proposal-child set but do not replace selected identities.
- A checkpointed Worker continues only after `StartRun`, with a fresh Invocation context record and Sealed Invocation referencing the retained Worker and new epoch. Historical and in-flight invocations keep their source epoch.
- Any missing task, Worker, result, or started-effect row produces `PRIOR_WORK_UNCLASSIFIED`. Any missing started-effect identity, unique-key field, decision, reconciliation Evidence, or carry-forward semantic also produces `STARTED_EFFECT_UNCLASSIFIED`. If an effect kind has no external unique key, the row records the explicit `unsupported` variant rather than an empty value.
- Classification children are immutable after sealing and belong to exactly one amendment proposal. Every correction or recovered effect creates a new amendment proposal, newly allocated complete child set, view, manifest hash, and owner-bound classification-set hash. This is required even when every value repeats; rows and hashes from the old proposal are never reused, shared, or reparented.
- `ApproveRunAmendment` cannot commit while any classification row is absent, differs from the sealed view or hashes, is inconsistent with Recovery Journal or Evidence, or is `recovery-required`. The approval decision accepts that exact child set atomically. The accepted epoch references its amendment proposal and classification-set hash and owns no duplicate classification row.

### Live Restrictions Versus Added Power

- Compute dispatch authority as the intersection of the immutable current epoch and separately owned current live ceilings, revocations, availability, Control requests, budget waterlines, workspace facts, Evidence, and safety conditions.
- A later restriction applies immediately without another approval and never rewrites the epoch. Removing it restores at most authority already present in that epoch after exact recovery and applicability checks.
- Added power always requires another approved epoch. This includes a broader task, fan-out group, tool, capability, effect scope, workspace mode, provider/model permission, result input, budget, relaxed limit, or reduced approval requirement.
- A runtime component may narrow its own action below current authority but cannot persist that choice as policy or later widen above live restrictions without re-evaluation.

### Unresolved Conditions And Stop Semantics

| Condition | Required behavior |
| --- | --- |
| `pending` | A required decision, Evidence item, predecessor, checkpoint, or input has not settled. Keep dispatch closed. |
| `rejected` | An exact proposal, Evidence evaluation, or approval was refused. Preserve that decision. |
| `changed` | A pre-decision reference differs from the seal. Create a new proposal; do not relabel the old one stale. |
| `stale` | Accepted authority no longer applies to the exact current subject, fingerprint, Evidence, Artifact state, or trust basis. |
| `conflicting` | Complete inputs disagree or composition is not deterministic. Require replanning. |
| `missing` | Required authority or bytes are conclusively unavailable. Never substitute empty content. |
| `uncertain` | A started effect has no proved terminal outcome. Enter or retain recovery. |
| `broken` | Parsing, integrity, DAG validation, index rebuild, evaluator execution, or authoritative lookup failed. Emit a distinct diagnostic and never report ready, clean, or no impact. |

A safe preparation stop occurs before proposal dispatch and needs no effect recovery. A hard execution stop closes affected dispatch when current authority or safety is lost. Any uncertain started effect moves or keeps the Run in `recovery-required`; no approval, amendment, retry, Resolver, or dispatch may degrade that state to a clean block.

### Read-Only Side Questions

- `SubmitRunSideQuestion` creates a separate immutable typed question against one exact Run, current epoch, bounded context manifest, and side-question budget authority. It changes no Run, plan, task, Worker, workspace, Candidate, or Evidence authority.
- Its invocation uses purpose `run-side-question`, coordination-safe typed retrieval, no mutating or external-effect tool other than the admitted provider call, and ADR 0009 attribution, usage, budget, and recovery contracts. Its answer is attributed untrusted output.
- `RecordRunSideQuestionAnswer` stores the bounded answer and references used. There is no promotion command or promotion table. If the user later wants steering, model change, or replanning, that intent is submitted independently through its normal typed command and does not inherit authority from the question or answer.

### Task DAG Validation And Approval Index

- Validate the provisional plan graph at submission and the accepted Task DAG in the approval transaction. Repeat accepted-DAG validation when opened, migrated, restored, or imported. Use the canonical Writer transaction, not a SQL trigger.
- The Task DAG is the only preparation precedence graph. A task cannot require its own or a descendant's future Evidence, Artifact, result, approval, or composition. Multi-predecessor input may depend only on accepted strict-predecessor results.
- Any externally owned preparation condition must settle before approval. It is not represented as an edge to work inside the proposed Run.
- Require at least one source task for every Task-DAG component. Reject zero-concurrency fan-out, impossible budget reservation, mutually exclusive requirements, and plans whose only readiness path depends on unauthorized future work.
- Approval-index edges are only reverse projections of existing forward relational references. They add no Task-DAG, preparation, Evidence, approval, or authorization edge. Every possible impact found through the index is rechecked against authoritative proposal or epoch references.
- If the index is absent, stale, or broken, use a bounded authoritative relational scan or block the input-changing command with `APPROVAL_INDEX_BROKEN`. Never infer no impact. Rebuilding the index changes no proposal, decision, plan, epoch, Run, or Evidence record.

### Commands, Transactions, And Idempotency

| Command | Atomic write or result |
| --- | --- |
| `SubmitRunPreparation` | Delegation-plan proposal and provisional nodes; required complete resolved Run-profile proposal for initial preparation or exact retain/replace profile selection for amendment; immutable amendment-classification children when applicable; sealed proposal and view; conditions; receipt; optional proposal supersession; and `awaiting-approval` transition or self-transition. |
| `RejectRunPreparation` | Initial rejection decision, receipt, and `draft` transition; no accepted plan, task, profile, or epoch. |
| `ApproveRunPreparation` | Verification and approval of the current non-superseded initial proposal with no prior epoch; decision and receipt; accepted plan/tasks/DAG; exact proposed Run-profile revision; epoch 0; Run plan/epoch pointers; and `ready` transition. |
| `SubmitRunAmendmentRequest` | Compatibility proof followed by Run-targeted Control request, dispatch closure, receipt, and `amendment-requested` transition; incompatible intent returns `RUN_AMENDMENT_INCOMPATIBLE` with only the mandatory durable rejected receipt, structured rejection, and idempotency settlement, and no Run/request/lifecycle domain write or Canonical event. |
| `RejectRunAmendment` | Rejection decision and receipt, contained Model-change rejection, and return to `amendment-requested`; prior epoch unchanged. |
| `ApproveRunAmendment` | Re-verification of compatibility, proposal/view/profile/classification hashes and immutable classification children; decision and receipt accepting exactly those rows; accepted plan/tasks/DAG; retained or exact replacement Run-profile revision; next active epoch referencing the proposal classification set; applied amendment request; contained Model changes moved to `approved-pending-apply`; Run plan/epoch pointers; and recomputed `ready` or blocked result. |
| `SubmitRunSideQuestion` | Question, bounded context manifest, admitted side-question seal when applicable, and receipt; no lifecycle transition. |
| `RecordRunSideQuestionAnswer` | Attributed answer artifacts, usage, recovery classification, and receipt; no authority transition. |

- Apply ADR 0006 command idempotency before every command. An exact retry of an incompatible amendment submission returns its original rejected receipt and appends nothing. Reusing a Command ID with different content returns the durable `IDEMPOTENCY_CONFLICT` rejection receipt and starts no effect.
- Compare-and-set the expected Run Entity version, Run slot, current accepted plan and epoch, current pending proposal identity, proposal manifest and view hashes, profile fingerprint, amendment classification-set hash and child cardinalities when applicable, Run amendment request, Run-workspace identity and fingerprint, every classified or retained Worker and slot version, Evidence current versions, Writer generation, and every currently owned accepted revision.
- Each approval is one declared fenced transaction. No accepted plan revision or task can commit without its exact epoch and decision, and no epoch can commit without its earlier sealed proposal, separate decision and receipt, accepted plan, accepted profile revision, exact immutable amendment-classification set when applicable, and Run plan/epoch-pointer update. Approval never resolves an unseen initial profile value or inserts an amendment classification.
- A stale compare-and-set or changed proposal rejects before authority changes. An unexpected transaction or evaluator failure is a broken internal failure, not user rejection.

### Physical Records

Execution adds these owner tables to `slopstop.db` under ADR 0006's Project-scoped keys, immutable history, command settlement, migrations, and Writer fencing:

| Family | Tables |
| --- | --- |
| Delegation-plan proposal | `delegation_plan_proposals`, `delegation_plan_proposal_nodes`, `delegation_plan_proposal_contract_clauses`, `delegation_plan_proposal_dependencies`, `delegation_plan_proposal_fanout_groups`, `delegation_plan_proposal_fanout_nodes`, `delegation_plan_proposal_independence`, `delegation_plan_proposal_input_requirements`, `delegation_plan_proposal_profile_requirements`, `delegation_plan_proposal_tool_requirements`, `delegation_plan_proposal_effect_scopes`, `delegation_plan_proposal_budget_limits`, `delegation_plan_proposal_model_selections` |
| Accepted Delegation plan | `delegation_plans`, `delegation_plan_revisions`, `delegation_tasks`, `delegation_plan_revision_tasks`, `delegation_task_contract_clauses`, `delegation_task_dependencies`, `delegation_fanout_groups`, `delegation_fanout_group_tasks`, `delegation_task_independence`, `delegation_task_input_requirements`, `delegation_task_profile_requirements`, `delegation_task_tool_requirements`, `delegation_task_effect_scopes`, `delegation_task_budget_limits`, `delegation_task_model_selections` |
| Run-profile proposal | `run_profile_proposals`, `run_profile_proposal_resolved_values`, `run_profile_proposal_sources` |
| Proposal and approval | `run_approval_proposals`, `run_amendment_proposals`, `run_amendment_proposal_prior_work_classifications`, `run_amendment_proposal_carried_results`, `run_amendment_proposal_started_effect_classifications`, `run_approval_proposal_budget_limits`, `run_approval_proposal_evidence_dependencies`, `run_approval_proposal_artifact_state_dependencies`, `run_approval_proposal_conditions`, `run_approval_views`, `run_approval_decisions` |
| Accepted profile and epoch | `run_profile_revisions`, `run_profile_revision_resolved_values`, `run_profile_revision_sources`, `run_policy_epochs`, `run_policy_epoch_budget_limits` |
| Sealed task input | `task_input_snapshots`, `task_input_predecessor_results`, `task_input_compositions`, `task_input_composition_conflicts` |
| Side question | `run_side_questions`, `run_side_question_answers` |
| Rebuildable approval index | `approval_dependency_index_generations`, `approval_dependency_index_nodes`, `approval_dependency_index_edges` |

- `run_policy_epochs` and `run_profile_revisions` are the same tables reserved by ADR 0007. ADR 0007's `runs.current_run_policy_epoch_id` and `runs.current_delegation_plan_revision_id` remain authoritative. `runs.pending_run_approval_proposal_id` is nullable and points only to the exact current undecided proposal; correction replaces it, rejection or approval clears it, and ADR 0007's terminal-state invariant prohibits it on a terminal Run. There is no current Run-profile pointer on `runs`; each epoch has one required `run_profile_revision_id`, and history resolves through each exact epoch reference.
- Key provisional nodes by proposal-local key. They have no foreign key to `delegation_tasks`. Approval stores an explicit proposal-node-to-task mapping in accepted plan membership; rejection and supersession store no mapping.
- Require every initial `run_approval_proposals` row to reference one complete `run_profile_proposals` row in the same Project and Run. Store every resolved profile value with a closed value kind, normalized typed value, exact inheritance source and source version or accepted revision, resolution-rule version, and stable position. The profile fingerprint covers all rows and sources. An accepted profile revision and its children match that proposal exactly and reference it as provenance.
- Store only pre-decision inputs on `run_approval_proposals`: exact currently owned revisions and fingerprints, the Delegation-plan proposal, required initial profile proposal or amendment retain/replace profile selection, current workspace and baseline, predecessor authority for amendments, contained Run amendment and Model-change requests, limits and profile fingerprints, amendment classification-set hash when applicable, encoding version, manifest hash, Writer generation, Project sequence, and submission receipt.
- Make `run_amendment_proposals` a one-to-one extension of a compatible amendment-kind `run_approval_proposals` row. Its immutable child rows own every prior task, Worker, result, carried-result selection, and Recovery-Journal-started effect classification. Key each child by the owning amendment proposal plus its source identity; a row cannot belong to or satisfy completeness for another proposal. Every corrected proposal inserts its own complete rows. The root stores typed child cardinalities and an owner-bound `classification_set_hash`; the canonical manifest covers the owning proposal identity and complete deterministically ordered rows. No classification table is keyed by epoch.
- Store one view per proposal and one terminal `approved`, `rejected`, or `superseded` decision. The view references only the proposal and repeats its profile and classification hashes. The decision references the proposal, manifest, profile, classification, and view hashes. Only an approved decision may be referenced by an epoch.
- Key epochs by Project, Run, and epoch identity and make `(project_id, run_id, epoch_number)` unique. Each nonzero epoch points to the immediately preceding epoch. The epoch references its proposal hash, approval decision and receipt, accepted plan revision, required accepted profile revision, and currently owned authority inputs. An amendment epoch also references the exact amendment proposal and classification-set hash, thereby accepting its immutable children without copying them. It never points to a proposed task node or owns mutable classifications.
- Use real composite foreign keys only to exact owners already defined by accepted decisions. Project-profile requirements reference the exact Project-profile revision and child decision. Plan-owned tool rows store requirements and schema fingerprints, not tool authority; dispatch must resolve them through the current Project profile and ADR 0009 capability report. Any requirement that depends on an owner row that does not yet exist remains a proposal condition and cannot appear in accepted plan or epoch rows.
- Store every prior-work classification once per amendment proposal and source identity. Store every Recovery-Journal-started effect once per amendment proposal and effect identity, with unique-key variant, source command, decision, reconciliation Evidence, and carry-forward semantic. Composite uniqueness and child-count checks prove completeness separately for each proposal; equal values across proposals still require distinct rows and owner-bound hashes. `recovery-required` prohibits approval and epoch creation.
- Incompatible amendment submissions use only ADR 0006's existing `command_idempotency`, `command_receipts`, and `command_rejections` tables. They create no `control_requests`, `control_request_run_amendments`, Run transition, amendment proposal, or Canonical event row.
- Keep task-input snapshots distinct from ADR 0010 Candidate scopes. A composition conflict contains no Worker, Candidate, or Integration identity.
- Treat approval-index rows as disposable cache data. They contain source identities needed for reverse lookup but no current pointer, decision action, precedence position, or foreign key that can authorize dispatch.

### Direct Queries And Required Indexes

- Query current dispatch authority through `runs` to its current epoch and accepted plan revision. Resolve the current Run profile only through that epoch's required profile revision. Query an epoch's approval through its proposal hash, decision, receipt, and view; for an amendment, follow its amendment-proposal identity and classification-set hash to the immutable classification children. Never select by latest timestamp.
- Index plan proposals by Run and Project sequence, provisional nodes by proposal and position, and proposal dependencies by both endpoints. Index accepted plan revisions by Run and revision number, membership by revision and position, contract links by contract/clause, dependencies by both endpoints, fan-out groups by revision, and input requirements by task.
- Index profile proposals by Run and Project sequence, fingerprint, source identity/revision, resolution-rule version, and resolved value kind. Index approval proposals by Run and Project sequence, every currently owned revision and fingerprint, profile-selection kind and fingerprint, predecessor epoch, amendment request, Model-change request, limits fingerprint, Evidence decision, Evidence scope fingerprint, Artifact-state version, condition code, classification-set hash, manifest hash, view hash, and decision action.
- Index amendment proposal classifications by proposal and subject kind/identity; carried results by proposal and exact source task/Worker/result; started effects by proposal and effect identity, unique-key variant, source Command ID, decision, reconciliation Evidence, and carry-forward semantic.
- Index epochs by Run and epoch number, predecessor epoch, proposal hash, approval decision and receipt, accepted plan/profile revisions, amendment proposal and classification-set hash, limits fingerprint, Evidence decision, and Artifact-state version. Prior-work and started-effect lookup uses the referenced amendment proposal tables, not epoch-owned copies.
- Index task-input snapshots by Run, epoch, target task, and source fingerprint; predecessor selections by predecessor task and Worker result; compositions by target task and output fingerprint; conflicts by composition and unresolved state.
- Index side questions by Run and Project sequence and answers by question and Model attempt. There is no promotion index.
- Index approval dependency edges for reverse lookup by `(project_id, source_kind, source_id, source_version_or_fingerprint, target_kind, target_id)` and by target. Every lookup is followed by authoritative reference comparison.
- Add no ready queue, transitive-closure table, generalized reachability index, JSON authority index, or Candidate materialization table.

### Stable Diagnostics

Use at least these stable failures and conditions:

`RUN_PREPARATION_INCOMPLETE`, `RUN_PREPARATION_APPROVAL_REQUIRED`, `RUN_PREPARATION_REJECTED`, `RUN_PREPARATION_CHANGED`, `RUN_PREPARATION_STALE`, `RUN_PREPARATION_BROKEN`, `RUN_PROFILE_PROPOSAL_REQUIRED`, `RUN_PROFILE_PROPOSAL_UNRESOLVED`, `RUN_PROFILE_PROPOSAL_CHANGED`, `COMPREHENSION_CONDITION_REQUIRED`, `CONTRACT_COVERAGE_INCOMPLETE`, `TESTABILITY_AUTHORITY_MISSING`, `UNOWNED_AUTHORITY_REFERENCE`, `DELEGATION_PLAN_PROPOSAL_INVALID`, `DELEGATION_PLAN_CYCLIC`, `DELEGATION_TASK_INPUT_MISSING`, `DELEGATION_TASK_INPUT_STALE`, `DELEGATION_TASK_INPUT_BROKEN`, `FANOUT_NOT_AUTHORIZED`, `FANOUT_RESOURCE_CONFLICT`, `FANIN_PENDING`, `FANIN_CONFLICTING`, `FANIN_BROKEN`, `PREPARATION_DEADLOCK`, `RUN_AMENDMENT_REQUIRED`, `RUN_AMENDMENT_INCOMPATIBLE`, `RUN_AMENDMENT_CLASSIFICATION_HASH_MISMATCH`, `MODEL_CHANGE_REQUIRES_AMENDMENT`, `PRIOR_WORK_UNCLASSIFIED`, `STARTED_EFFECT_UNCLASSIFIED`, `CARRY_FORWARD_STALE`, `ADDED_POWER_REQUIRES_APPROVAL`, `LIVE_RESTRICTION_APPLIED`, `RESOLVER_REPLAN_REQUIRED`, `APPROVAL_INDEX_BROKEN`, and `IDEMPOTENCY_CONFLICT`.

### Issue 60 Closure

| Issue requirement | Explicit contract |
| --- | --- |
| Exact epoch authority | Only `ApproveRunPreparation` and `ApproveRunAmendment` create and activate an epoch. Target-specific model apply commands consume already-current authority. |
| Proposal before approval | Delegation-plan proposal, Run approval proposal, and view are sealed before a separate decision. The accepted epoch references proposal hash plus decision and receipt without self-reference. |
| Proposal versus accepted plan | Provisional nodes have proposal-local keys only. Accepted task identities, plan revision, and Task DAG are created atomically with approval; rejection creates none. |
| Complete initial Run profile | Initial preparation always seals one complete resolved profile proposal, including inherited values and sources. Approval creates the revision only from those visible rows and cannot introduce unseen authority. |
| Corrected initial approval | `ApproveRunPreparation` accepts the exact current non-superseded initial proposal whenever the Run has no epoch; earlier corrected, rejected, or superseded proposals do not create a first-proposal deadlock. |
| Behavior and Test control | Exact accepted contract revisions and clause coverage are relational. Missing owned proof authority blocks rather than creating an exception or testability placeholder. |
| Comprehension | One sealed proposal condition covers the exact owned Waypoint and contract revisions; it is not an invented accepted aggregate. |
| Currently owned references | No Action-prompt, development-discipline, one-Run-exception, or testability-proposal foreign key exists. Any later authority needs its own accepted owner decision first. |
| Manual and automatic preparation | Manual Actions require `BeginAction`; automatic Actions may prepare only to `awaiting-approval` and cannot dispatch or start effects. |
| Compatible Run amendment only | Active execution uses Run amendment request/proposal only for compatible change. An incompatible submission persists the mandatory durable rejected command receipt, structured rejection, and idempotency settlement but creates no Run/request/lifecycle domain write or Canonical event; contradictory intent uses ADR 0007's single `SupersedeRun` transaction before any new Run. Candidate change request remains a separate closed-Candidate review action. |
| Model change routing | `SubmitModelChange` attaches to a Run amendment. Generic amendment approval alone creates and activates profile and epoch authority. |
| Prior tasks and started effects | Every prior task, Worker, result, carried result, and Recovery-Journal-started effect is an immutable child of the exact sealed amendment proposal and visible in its view. Every corrected proposal owns a newly allocated complete set and owner-bound hash even when values repeat; prior rows are never reused. Approval verifies and accepts that exact set, while the epoch references it and stores no duplicate classification. |
| One current profile path | `runs` has no current profile pointer. The current epoch requires the accepted Run-profile revision, preserving history through exact epoch references. |
| Read-only Side questions | A question and answer have no execution authority and no promotion command. Later steering is an independent typed intent. |
| Approval Dependency Graph | The graph is a disposable reverse invalidation/explanation index only and never adds precedence or authorization edges. |
| Candidate boundary | This decision owns task input and dispatch only. Candidate construction, review, and Integration remain with their existing owners. |
| Failure distinctions | Pending, rejected, changed, stale, conflicting, missing, uncertain, and broken remain distinct; none becomes ready or clean. |
| Physical proof | Separate proposal and accepted tables, required resolved-profile rows, proposal-keyed non-reusable classification children and owner-bound hashes, epoch references without duplicate classifications, rejected-command-only settlement for incompatible submissions, epoch-only current-profile lookup, forward owner foreign keys, and bounded reverse indexes make the contract implementable. |

## Consequences

- The user approves one coherent proposal, but accepted task identities, plan authority, profile authority, and epoch authority exist only after the approval transaction.
- Model changes cannot bypass generic Run amendment approval. Applying an approved target change no longer doubles as policy activation.
- Parallelism remains explicit and reproducible. Providers and runtimes cannot manufacture tasks, joins, Resolver work, or Candidate authority.
- Amendments require detailed effect reconciliation, but old work, approvals, and invocations remain attributable rather than being rewritten under a new plan.
- Missing future owner concepts block visibly instead of gaining accidental authority through invented tables or foreign keys.
- Losing the Approval Dependency Graph affects performance and explanation, not precedence or authorization. A broken index remains visible and never means no impact.

## References

- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-60-approved-run-preparation.md`
- `.rpiv/artifacts/discover/2026-08-14_14-57-58_personal-multi-agent-coding-harness.md`
- `.rpiv/artifacts/discover/2026-08-14_15-32-56_personal-multi-agent-coding-harness-refined.md`
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md`
- `docs/adr/0006-physical-persistence-layout.md`
- `docs/adr/0007-supervised-execution-aggregate-ownership.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md`
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md`
- GitHub issue `#60`
