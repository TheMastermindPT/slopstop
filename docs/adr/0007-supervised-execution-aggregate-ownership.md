# ADR 0007: Supervised Execution Aggregate Ownership

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

Supervised execution needs durable Run, Worker, and steering state without allowing a model, runtime callback, or worker result to become canonical authority. The accepted status families already distinguish Run, Worker, Control request, Waypoint, Action availability, and external Evidence states. The physical persistence layout reserves owner-specific current and transition tables, but it deliberately leaves Execution aggregates to their owner. This decision fixes those aggregate boundaries, exclusivity rules, transition authority, retry identity, model attribution, and the inputs to Action availability before workspace, AgentRuntime, and plan-content designs proceed.

## Decisions

### Aggregate Boundaries

- A `Run` is one supervised attempt to perform one exact Action version on one Waypoint. It owns current execution lifecycle, exact contract and policy references, and links to its parent, workers, Control requests, workspace, Evidence, and recovery records.
- A `Waypoint parent` is the single logical AI supervisor of one Run. It is a singleton child, not a Worker and not another status family. Restart, resume, compaction, runtime session replacement, and future model changes preserve its identity.
- A `Delegation task` is immutable content inside an accepted Delegation plan revision. A `Worker` is one concrete attempt to perform that task. Task identity remains stable while terminal retry creates a new Worker identity.
- A `Control request` is one durable immutable intent targeted at a Run, its Waypoint parent, or one of its Workers. It owns a directly queryable lifecycle, while transport delivery remains in the canonical-to-runtime handoff protocol.
- A `Model attempt` is an append-only attributed invocation record for a parent or Worker. It is not an aggregate, cannot set status, and gains no authority from model output.

### Run Exclusivity And Lifecycle

- Permit at most one nonterminal Run per Waypoint, independent of Action. A `run_slots` current projection owns that exclusivity without adding Execution state to the Waypoint aggregate.
- Create the slot atomically with the Run and retain it through `draft`, `awaiting-approval`, `ready`, `running`, `pause-requested`, `paused`, `change-requested`, `blocked`, `recovery-required`, `ready-for-validation`, and `cancel-requested`. Release it atomically only when the Run reaches `cancelled`, `failed`, `superseded`, or `completed`.
- Use the primary preparation path `draft -> awaiting-approval -> ready -> running -> ready-for-validation`. Pause follows `running -> pause-requested -> paused -> ready`. Safe idle work may cancel directly; active work follows `cancel-requested -> cancelled | recovery-required`.
- A compatible Change request follows `change-requested -> awaiting-approval` with a new exact approved revision. Materially contradictory intent follows `change-requested -> superseded` and creates a new Run if the user continues.
- Permit `ready-for-validation -> running` only for independently authorized remediation. Permit `ready-for-validation -> completed` only with current Evidence-authority completion authorization. Only evidence-backed reconciliation may move a Run out of `recovery-required`.
- Treat `cancelled`, `failed`, `superseded`, and `completed` as terminal. Provider, Capability, Budget, policy, workspace, dependency, or validation problems that may change leave a Run `blocked`; they do not manufacture terminal failure.

### Run State And Versioned Content

- Keep one directly queryable `runs` current row with Waypoint, Action family/version, Run status family/version, Entity version, current Behavior Contract, Test Contract, Delegation plan revision, Run policy epoch, Waypoint parent identity, Resume capsule reference, Workspace and fingerprint waterline, causation, creation sequence, last-transition sequence, and optional terminal sequence.
- Do not create generic Run revisions. Behavior Contracts, Test Contracts, Delegation plans, policy epochs, Resume capsules, and Change-request decisions retain separate versioned ownership.
- Pin every Run reference to an exact revision. A newly accepted Project profile, contract, plan, or Capability version never changes an existing Run silently. A compatible amendment changes current pointers through an attributed command and preserves the exact references used by prior dispatches and Model attempts.
- Use the closed v1 Run cause vocabulary `ACTION_SELECTED`, `PREPARATION_COMPLETE`, `APPROVAL_REQUIRED`, `PLAN_APPROVED`, `EXECUTION_STARTED`, `PAUSE_REQUESTED`, `SAFE_CHECKPOINT_REACHED`, `RESUME_APPROVED`, `CHANGE_REQUESTED`, `AMENDMENT_APPROVAL_REQUIRED`, `DEPENDENCY_BLOCKED`, `BUDGET_EXHAUSTED`, `POLICY_BLOCKED`, `CAPABILITY_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `WORKSPACE_INVALIDATED`, `RECOVERY_REQUIRED`, `VALIDATION_REQUESTED`, `VALIDATION_FINDINGS_OPEN`, `REMEDIATION_AUTHORIZED`, `COMPLETION_AUTHORIZED`, `CANCEL_REQUESTED`, `USER_CANCELLED`, `RUN_SUPERSEDED`, and `EXECUTION_FAILED`. One cause explains a transition; ordered condition codes explain why current state remains blocked or recovery-required.

### Commands And Preconditions

- Move Run lifecycle only through versioned intent or observation commands: `BeginAction`, `PrepareAutomaticAction`, `SubmitRunPreparation`, `ApproveRunPreparation`, `StartRun`, `RequestRunPause`, `ConfirmRunPaused`, `ResumeRun`, `SubmitChangeRequest`, `ApproveRunAmendment`, `RecordRunBlocked`, `RequireRunRecovery`, `SubmitRunForValidation`, `AuthorizeRunRemediation`, `AuthorizeRunCompletion`, `RequestRunCancellation`, `ConfirmRunCancelled`, `RecordRunFailure`, and `SupersedeRun`. There is no `SetRunStatus`.
- Require each mutating command to cover the expected Run Entity version and every applicable Worker or Control request version, Delegation plan revision, policy epoch, Workspace identity and fingerprint, Run slot ownership, and exact Evidence or recovery authorization.
- Allow a specific Execution command to update several Execution-owned aggregates atomically only when its versioned contract declares the complete write set. Keep the canonical prohibition on a public generic batch.
- Accept external inputs only as attributed, versioned envelopes. Users supply intent and approval; runtime supplies proposed observations or results; Evidence supplies Finding, remediation, invalidation, and completion authority; Recovery supplies reconciliation; policy supplies one dispatch-bound decision. Execution validates the input and computes the transition. No external owner writes Execution status directly.

### Worker Attempts And Slots

- Key `worker_slots` by Project, Run, and Delegation task identity, with a unique current Worker. Create the slot when a Worker is queued and retain it through pause, resume, and safely reconciled interruption. Release it only when the Worker reaches terminal `failed`, `succeeded`, or `cancelled`.
- Preserve Worker identity for pause, resume, and reconciled interruption. Retry after a terminal result creates a new Worker with `retry_of_worker_id`, references the same exact Delegation task, and acquires the vacant slot. Parallel attempts for one Run task are invalid.
- Continue to use the accepted Worker commands and status family. A Worker may submit an attributed result, but the Execution owner validates task, plan, policy, Workspace fingerprint, result shape, and current authority before moving it to `succeeded`.

### Parent And Model Attribution

- Key `waypoint_parents` by Project and Run, and make `parent_id` unique. Create the parent atomically with the Run and preserve it until the Run remains as immutable history.
- Keep only current Resume capsule, runtime session, latest Model attempt, creation, and recovery references on the parent row. Derive parent availability from Run, Runtime handoff, and recovery state rather than adding a duplicate parent status family.
- Append every parent or Worker model invocation to `model_attempts`. Attribute exact Run, parent or Worker, provider, model, settings, Run policy epoch, prompt version and hash, Context record, Capability versions, limits, and result classification. The AgentRuntime decision owns the exact invocation and result schemas.

### Control Requests

- Store immutable intent and payload plus a directly queryable accepted Control request lifecycle and append-only transition history. Retry after a terminal result creates a new linked Control request. An `uncertain` request preserves identity until conclusive reconciliation; abandonment does not rewrite it as failure.
- Store `run_id` for every request. Enforce target shape with `target_kind`: a Run target has no child target, a parent target has the same Run's required `parent_id`, and a Worker target has the same Run's required `worker_id`. Checks and composite foreign keys prevent cross-Run or cross-Project targets.
- Use `control_request_dispatches` to link domain selection to an exact `runtime_handoff_id`. Delivery attempts and acknowledgements remain in the handoff ledger. Use `control_request_outcomes` only for the attributed domain interpretation that advances Control-request lifecycle.

### Physical Tables

Execution adds the following owner tables to `slopstop.db` under the key, transition, and migration rules of ADR 0006:

| Family | Tables |
| --- | --- |
| Run | `runs`, `run_slots`, `run_status_transitions`, `run_status_transition_conditions` |
| Parent | `waypoint_parents` |
| Worker | `workers`, `worker_slots`, `worker_status_transitions`, `worker_status_transition_conditions` |
| Control request | `control_requests`, `control_request_status_transitions`, `control_request_status_transition_conditions`, `control_request_dispatches`, `control_request_outcomes` |
| Attribution and policy | `model_attempts`, `run_policy_epochs` |

- Keep Delegation plan revisions and tasks, Resume capsules, runtime sessions, Workspaces, Process jobs, and effect records in their own owner decisions. These Execution tables store exact references without pre-empting those schemas.

### Action Availability

- Compute one versioned live projection for each Project, Waypoint, Action family, and Action version. It is derived and cannot be set by a command or accepted as canonical status.
- Include in its input fingerprint the Project lifecycle, readiness, persistence health, Writer or observer freshness, Waypoint state and Entity version, blocking relationships, Run slot, Action-required contracts, applicable policy preparation, Capability and provider availability, Workspace and Budget availability, Evidence gates, recovery state, and every evaluator version.
- Permit a non-authoritative cache keyed by that complete input fingerprint. `BeginAction` and `PrepareAutomaticAction` carry the observed projection version and fingerprint, then re-evaluate availability against current authoritative inputs during command settlement. A stale projection, missing input, or broken evaluator never authorizes Run creation.

## Consequences

- Run, Worker, and Control-request current state remains directly queryable while append-only transitions and attempts preserve exact attribution and history.
- Slot projections make duplicate active Runs and Workers structurally difficult without coupling Execution lifecycle to Waypoint or Delegation-plan aggregates.
- Keeping one logical parent across recovery prevents runtime-session or model-call churn from appearing as duplicate supervision.
- Exact revision, policy, Workspace, Evidence, and recovery preconditions make commands larger, but prevent stale approvals and model output from silently gaining authority.
- Workspace mechanics, Process jobs, AgentRuntime schemas, prompt and context behavior, plan content, measured limits, and the detailed Execution-to-Evidence handoff remain with their dedicated map tickets.
