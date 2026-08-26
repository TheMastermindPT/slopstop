# ADR 0014: Finding Validation Remediation And Recheck Authority

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

ADR 0010 gives Validation producers typed Finding-proposal and Finding-recheck Evidence, exact scopes, and append-only evaluations. ADR 0012 makes current Finding disposition a mandatory Completion dependency. ADR 0007 reserves Run validation and remediation transitions.

Those decisions do not yet define one owner for Finding disposition. Evidence verdicts currently mix technical claim evaluation with open, remediation, closure, risk, out-of-scope, and supersession state. Validator attempts can therefore appear to decide the Finding they merely observed. Remediation has no exact handoff or consumable limits, and no contract decides whether a recheck continues one Finding or discovered a materially new problem.

The accepted solution for issue 62 makes Finding the sole canonical aggregate authority, retains immutable decisions and atomic current state, and keeps Validation Episodes as rebuildable read models only.

## Decisions

### Finding Identity And Owner

- Give every admitted material problem one opaque Project-scoped `FindingId`. The Application coordinator's Finding component is the sole writer of Finding identity, classification, disposition, entity version, and current decision pointer.
- Keep the Finding root's identity and origin fields immutable. Bind them to one settled `FindingProposalId`, originating Run, exact originating Evidence scope and fingerprint, normalized material claim, stable rule identity and version, typed subject identity and version, first accepted `FINDING_PRESENT` evaluation and decision, producer attribution, and creation Project sequence. The proposal carries a checked source union of exact `ValidationRequestId`, exact authorized user/imported trusted-source record, or one current complete ADR 0016 Language diagnostic member and its accepted evaluation decision. Direct trusted and non-Validation Language proposals do not invent a Validation request.
- A hash verifies one normalized claim but never becomes Finding identity. Equal claims from separate scopes or independent observations do not merge automatically.
- Store directly queryable `current_finding_decision_id`, `current_state`, `current_class`, and `entity_version` on the Finding row. Every value must agree with the referenced immutable decision through composite foreign keys and checks. A mismatch is `FINDING_AUTHORITY_BROKEN`; it is never repaired from timestamps or a Validation Episode.
- A stale or superseded Worker result does not delete its Findings. Applicability may change through Evidence and a later Finding decision while historical identity, scope, decisions, and correlations remain.

### Technical Evidence Versus Finding Disposition

- Keep ADR 0010 `finding` and `finding-recheck` as Evidence families. The initial family is keyed by `FindingProposalId`; the recheck family is keyed by an admitted `FindingId`. They own attributed observations, technical evaluations, evaluation decisions, and scope-keyed materialized current evaluations only. They do not own Finding identity, classification, or disposition.
- Use the Finding-family verdicts `FINDING_PRESENT`, `FINDING_NOT_PRESENT`, `FINDING_CHANGED`, `FINDING_NOT_APPLICABLE`, `FINDING_STALE`, `FINDING_AMBIGUOUS`, `FINDING_TRUNCATED`, `FINDING_REJECTED`, and `FINDING_BROKEN`. These verdicts describe the evaluated claim, not whether an admitted Finding is open, waived, assigned, or closed.
- Retain ADR 0010's `RECHECK_*` verdicts for a fresh evaluation of one admitted `FindingId`. A recheck decision accepts or rejects its technical evaluation and cannot change Finding state by itself.
- Every Finding decision that consumes technical Evidence references the exact immutable evaluation, Evidence entry, accepted evaluation decision, current-evaluation version, evaluator implementation hash, rules, scope fingerprint, and trust basis. Validation, rerun, and recheck sources also require their exact producer attempt; an authorized direct user/import source instead requires its exact source command or import record and prohibits a fabricated attempt. Finding never copies or rewrites the Evidence payload.
- Pending, rejected, stale, ambiguous, truncated, missing, or broken Finding or recheck Evidence grants no favorable Finding transition. A prior favorable Finding state whose required Evidence becomes inapplicable is blocked from favorable consumption and must receive the applicable explicit Finding decision; no old state is silently restored.

### Immutable Finding Decision Ledger

- Give every decision one opaque `FindingDecisionId`, non-negative decision sequence, exact predecessor decision, expected Finding entity version, action, resulting state and class, actor and actor-authority kind, required reason, policy and contract references, exact Evidence dependencies, command receipt, Project sequence, and Writer generation.
- Use the closed v1 actions `admit`, `classify`, `authorize-remediation`, `submit-fix`, `record-no-fix`, `close-verified`, `reopen`, `accept-risk`, `defer`, `mark-false-positive`, `mark-out-of-scope`, and `supersede`.
- Use the closed current states `open`, `remediation-authorized`, `fix-submitted`, `closed-verified`, `risk-accepted`, `deferred`, `false-positive`, `out-of-scope`, and `superseded`. `reopen` is an action whose resulting state is `open`; it is not a second historical-state family.
- Use the closed current classes `blocking` and `advisory`. Classification is an explicit Finding decision under the exact rule, Completion contract, risk policy, and scope. Severity is Evidence input and never silently determines class.
- Each accepted command appends exactly one decision and atomically compare-and-sets the Finding's current decision, state, class, and entity version. Rejected commands append only their normal durable rejection receipt. There is no `SetFindingStatus`, mutable decision action, decision supersession pointer, replay-derived head, or independently writable Finding current table.
- Permit `classify` to retain state while changing class under exact policy. Every other action has one checked transition from the expected current state. A command cannot skip required remediation, recheck, user, policy, or scope authority merely by choosing the desired resulting state.

| Action | Allowed predecessor | Resulting state |
| --- | --- | --- |
| `admit` | no Finding | `open` |
| `classify` | any state except `superseded` | unchanged |
| `authorize-remediation` | `open` | `remediation-authorized` |
| `submit-fix` | `remediation-authorized` | `fix-submitted` |
| `record-no-fix` | `remediation-authorized` | `open` |
| `close-verified` | `open` or `fix-submitted` | `closed-verified` |
| `reopen` | `fix-submitted`, `closed-verified`, `risk-accepted`, `deferred`, `false-positive`, or `out-of-scope` | `open` |
| `accept-risk` | `open` | `risk-accepted` |
| `defer` | `open` | `deferred` |
| `mark-false-positive` | `open` | `false-positive` |
| `mark-out-of-scope` | `open` | `out-of-scope` |
| `supersede` | any state except `superseded` | `superseded` |

- `authorize-remediation` additionally requires that every prior authorization has either no terminal submission or one fix/no-fix submission with its required fresh recheck and resulting Finding decision. For a no-fix submission with current accepted `RECHECK_REPRODUCED`, the next `AuthorizeFindingRemediation` consumes that exact recheck and is itself the resulting decision; `RECHECK_RESOLVED` instead permits closure. A terminal submission awaiting recheck or carrying any other non-favorable recheck blocks another round without introducing another mutable state.

### Admission And Material Identity

- A validator, analyzer, Worker, current complete ADR 0016 Language diagnostic, user, or imported trusted source may create one immutable `FindingProposalId` with its attributed Finding observation. A Language source remains a proposal from an observed diagnostic, not independent proof that the material Finding exists. Only `AdmitFinding` allocates `FindingId` and creates the canonical Finding and initial `admit` decision after current accepted `FINDING_PRESENT`, exact rule and scope, identity matching, trust, and policy checks.
- The producer that proposed the observation cannot issue the admission decision. Admission is a deterministic coordinator command under accepted policy or explicit authorized user decision. A model, tool, validator, or Evidence evaluator never calls an internal status setter.
- Treat a claim as the same material Finding only when stable rule identity, normalized material assertion, typed subject identity, applicable semantic scope, and expected impact remain the same. A moved code anchor with unchanged semantic content remains the same Finding.
- Settle each proposal exactly once with a closed outcome. `created` allocates one `FindingId` and admission decision; `attached-to-existing` preserves the independent Evidence and links it to the matching Finding without advancing that Finding's decision. Current accepted `FINDING_NOT_PRESENT` and `FINDING_NOT_APPLICABLE` permit `dismissed-not-present` and `dismissed-not-applicable`. Current accepted `FINDING_CHANGED` permits `superseded-by-proposal` only with one exact successor `FindingProposalId`. A material-identity conflict rejects the command without a settlement, so the proposal remains visibly blocking until later Evidence supports a valid outcome. Stale, ambiguous, truncated, rejected, or broken Evidence also permits no settlement. The settlement tuple and command receipt are unique, so a second Command ID cannot settle the same proposal again.
- Use `AdmitFinding` only for current accepted `FINDING_PRESENT`, producing `created` or `attached-to-existing`; an identity conflict is the durable rejected command receipt described above. Use `ResolveFindingProposal` for the typed non-admission outcomes. A dismissed proposal proves only its exact technical claim/scope; it never hides another proposal or Finding.
- A materially changed rule, assertion, subject, semantic scope, applicability condition, or impact receives a new `FindingId`. `RECHECK_CHANGED` must name a `FindingProposalId`; admitting or attaching that proposal atomically writes the required `discovered-during-recheck` correlation to the original Finding and cannot close, supersede, or mutate the original automatically. Only this settlement path may create that correlation kind; `CorrelateFindings` owns the other kinds.
- Correlations use the closed kinds `same-root-cause`, `discovered-during-recheck`, `candidate-reproduction`, `scope-related`, and `supersedes-material-claim`. They explain relationships and grant no transition authority.

### Validation Requests And Episode Projection

- Create one immutable `ValidationRequestId` before validator dispatch. Bind it to exact Run, accepted plan and policy epoch, validator role and independence policy, Completion contract and selected rules, subject scope and fingerprint, Candidate or permitted typed output, budgets, producer requirements, and request command receipt.
- Treat the Validation request as Execution's immutable dispatch contract defined here, not as Finding disposition. ADR 0007 `SubmitRunForValidation` owns its only creation transaction; Finding records may reference it but never create or mutate it.
- A validator is an attributed Execution Worker role. It receives a read-only repository claim where a repository exists, may run only admitted validation commands and effects, and may append Evidence observations or Finding proposals. It cannot mutate repository content, accept its own Evidence evaluation, admit a Finding, change Finding disposition, authorize remediation, accept risk, or complete a Run.
- Define a Validation Episode as a rebuildable read model keyed by one `ValidationRequestId`. It groups only records carrying that exact causal request: validator Worker and producer attempts, commands, observations, evaluations, proposals and admitted Findings, decisions, remediation handoffs, fix or no-fix submissions, and rechecks. A Language diagnostic proposal belongs only when its checked Language-check source carries that same Validation request. Direct trusted-source and other Language records without that causal request are outside the Episode.
- Add no `validation_episodes`, episode status, episode current pointer, episode decision, or episode-owned Finding membership table. The projection can be rebuilt from exact forward references and changes no authority when rebuilt, absent, stale, or broken.
- Tool-argument validation in ADR 0009 remains invocation admission and is not a Validation Episode or Finding decision.

### Independence

- Separate the roles `finding-producer`, `validator`, `remediation-worker`, and `rechecker` as attributed roles, not authority aggregates. Policy selects whether one actor may hold compatible roles; no role alone grants a Finding decision.
- A validator is always repository read-only. A production-mutating Worker cannot provide the independent validation or recheck for its own output. Its model attempts, tools, Process jobs, delegated descendants, and imported self-produced artifacts do not satisfy that independence by changing producer labels.
- Permit the original validator to recheck only when it did not perform or direct the remediation, remains qualified under the current evaluator/rule/Capability policy, and the accepted risk recipe does not require a distinct validator. Otherwise require a new qualified validator and producer attempt.
- The actor accepting risk, marking false positive, marking out of scope, or superseding a Finding must have the exact user or policy authority selected by the Completion contract. A validator may recommend any action but cannot decide it.
- Store the exact independence evaluation and actor relationships with each admission, remediation authorization, recheck request, and disposition decision. Missing, ambiguous, stale, or broken independence proof fails closed.

### Blocking Advisory Risk And Deferral

- A current `blocking` Finding blocks technical Completion while its state is `open`, `remediation-authorized`, `fix-submitted`, or `deferred`. It stops being a blocker only through current applicable `closed-verified`, `risk-accepted`, `false-positive`, `out-of-scope`, or `superseded` authority that the exact Completion contract permits.
- A current `advisory` Finding remains visible and enters Completion snapshots. It blocks only when the exact Completion contract, risk rule, or user decision requires its disposition before Completion. Changing between blocking and advisory requires a `classify` decision and invalidates every dependent Finding snapshot and Completion evaluation.
- `AcceptFindingRisk` requires actor authority, exact policy and Completion-contract permission, Finding scope and fingerprint, residual risk, reason, expiry, review owner, and current technical Evidence. It does not imply a fix, close the Finding, change Effect or Recovery truth, or satisfy a contract that prohibits acceptance.
- Before an expired risk or deferral decision is materialized as reopened, every authority query treats it as non-favorable and blocks consumption. Before any favorable consumer proceeds, the deterministic coordinator submits idempotent `ReopenFinding` with canonical time, expected decision, and entity version; that transaction appends the explicit decision, returns state to `open`, and invalidates dependants. No scheduler mutates state without a command receipt.
- `DeferFinding` records why automated remediation stops, the next review trigger or expiry, and required user Attention. A deferred blocking Finding remains blocking. Deferral is not accepted risk, closure, out-of-scope, or exhaustion.
- `MarkFindingFalsePositive` requires current accepted technical Evidence proving the material claim does not apply under the same rule and scope plus the required actor authority. Silence, a failed validator, deleted bytes, stale scope, or a different claim cannot support it.

### Remediation Handoff And Budgets

- `AuthorizeFindingRemediation` appends the Finding decision, creates one immutable `FindingRemediationAuthorizationId`, and moves the Finding to `remediation-authorized` atomically. Execution may dispatch remediation only from that exact current authorization.
- Store one immutable handoff containing Finding identity and expected entity version, current decision and class, exact Finding-authority snapshot, originating and current Evidence, Behavior/Test/Completion clauses, relevant Findings and correlations, accepted plan and policy epoch, permitted task set, target roles and independence rule, repository scope, expected starting fingerprint, permitted tools and effects, required Test Author phase, Fixed test set when applicable, artifacts, output contract, and budget reservation. It contains no future Worker identity.
- A remediation authorization grants only the named scope and round. The Worker also requires ADR 0012's current accepted Run change classification before repository mutation and ADR 0013's declared Effect authority before a physical boundary. The Finding authorization replaces neither.
- Define one remediation round as one authorization, zero or more bounded remediation Workers under its plan task set, one terminal fix submission or explicit no-fix submission, and the required fresh recheck outcome. A later round requires a new authorization and handoff.
- Pin exact non-negative limits for remediation rounds, remediation Workers, validator and rechecker attempts, commands, elapsed time, model tokens, cost, and effect scope to the accepted plan and Run policy epoch. Reserve and consume them through the existing budget authority and persisted waterlines; there are no hidden defaults or reset-on-retry semantics.
- When any required remediation or validation limit is exhausted, preserve every Finding and Evidence record, close new affected dispatch, and keep or move the Run to `blocked` with `FINDING_REMEDIATION_EXHAUSTED`. Emit user Attention containing the exact exhausted limit, current Findings, rounds, costs, remaining options, and snapshot fingerprint. Exhaustion is not failure, deferral, risk acceptance, out-of-scope, or closure.

### Fix Submission And Fresh Recheck

- `SubmitFindingFix` requires the exact current remediation authorization, handoff fingerprint, Worker result, Candidate or Task-workspace result, change classification, final scope fingerprint, tests and artifacts, effect outcomes, usage, and expected Finding version. It appends a `submit-fix` decision, creates one immutable fix submission, and moves state to `fix-submitted`; it never closes the Finding.
- `SubmitFindingNoFix` requires the exact current remediation authorization, handoff, complete terminal Worker results or proved no-dispatch outcome, consumed usage, exact reason, and expected Finding version. It appends `record-no-fix`, creates one immutable no-fix submission, and returns state to `open`; exhaustion remains a separate blocking condition and never becomes deferral or closure.
- Create one immutable `FindingRecheckRequestId` for the same `FindingId`. Bind it to the exact fix submission, no-fix submission, or explicit current subject; prior technical evaluation; current scope and target fingerprint; rule and evaluator versions; independence requirement; accepted plan and policy epoch; limits; causal Validation request; and request receipt. A later producer-attempt start links the request to a new `EvidenceProducerAttemptId`; the immutable request cannot reference a future attempt.
- Every recheck uses a new producer-attempt identity and fresh observations. It reuses the same Finding identity only for the same material claim. Historical rechecks remain ordered and directly queryable.
- Current accepted `RECHECK_RESOLVED` permits, but does not perform, `CloseFindingVerified`. That command requires the exact recheck evaluation and decision, unchanged material identity, current subject, current Finding version, and policy. For a fix source it also requires immutable subject-lineage proof that the target descends from the fix submission and still contains its accepted remediation delta; for a no-fix or explicit-current-subject source it requires that exact current source arm. It appends `close-verified` and moves state atomically.
- Current accepted `RECHECK_REPRODUCED` permits `ReopenFinding` from `fix-submitted`, retains the same Finding identity, and may support another bounded remediation round. `RECHECK_STALE`, `RECHECK_AMBIGUOUS`, `RECHECK_TRUNCATED`, `RECHECK_REJECTED`, or `RECHECK_BROKEN` cannot close or downgrade the Finding.
- `RECHECK_NOT_APPLICABLE` requires an explicit authorized Finding decision. If the same claim no longer applies because an accepted subject was intentionally removed or replaced, policy may permit verified closure, out-of-scope, or supersession. The recheck alone chooses none of them.
- Newly discovered material problems always create new Finding proposals and identities. A recheck cannot hide them in the original Finding's payload or expand its remediation scope.

### Scope Expansion And Derived Waypoints

- Bind every Finding to one exact originating Evidence scope. Derive current applicability only from the current immutable Finding decision's required one-to-one applicability child, which references exact Evidence, scope, fingerprint, rule, and policy inputs. Findings from sibling Workers, Worker results, Task workspaces, Candidates, targets, or Runs remain separate unless exact recheck or correlation records relate them.
- Candidate validation may reproduce an existing Task-workspace Finding only through an exact recheck or correlation against the Candidate scope. It never copies a green or open state from the Worker scope into Candidate authority.
- `MarkFindingOutOfScope` requires proof that the claim is real, outside the accepted current remediation scope, and not required by a current Completion obligation. It creates or references one immutable derived-Waypoint proposal but creates no Waypoint, Run amendment, task, Worker, or broader permission.
- A user may later accept the derived Waypoint through normal Waypoint authority. Expanding only the active Run's remediation scope for the same material claim requires a compatible Run amendment, accepted revised plan, new policy epoch, `ReopenFinding` from `out-of-scope` when applicable, optional `ClassifyFinding`, and fresh remediation authorization. A change to the claim's semantic scope instead creates a new correlated proposal and Finding. No Finding decision widens scope itself.
- `SupersedeFinding` requires a newly admitted materially different Finding and a `supersedes-material-claim` correlation. It preserves the original and cannot be used merely to reset remediation budgets, erase an unresolved claim, or reuse a changed scope under the old identity.

### Typed Coordinator Inputs And Run Lifecycle

- Define one immutable `FindingAuthoritySnapshotId` as a direct query result over exact Finding roots, current decisions, classes, states, current technical and recheck Evidence, pending proposal set, risk/deferral expiry, Completion rules, scope fingerprints, observed Project sequence, Writer generation, query schema/version, and canonical query fingerprint. Project sequence is audit metadata, not a validity waterline.
- Each ordered member references immutable Finding and decision identities, the exact Evidence evaluation entries and accepted evaluation decisions used, current Finding entity version, class and state, applicability result, blocking diagnosis, and current-row hash observed. It has no foreign key to a mutable current pointer and owns no disposition.
- Derive one closed coordinator result from a current snapshot: `validation-clear`, `remediation-authorized`, `recheck-required`, `blocked-findings`, `blocked-exhausted`, or `broken`. Only `validation-clear` and `remediation-authorized` are favorable authorizations, and each carries the exact snapshot or remediation authorization it consumes. The result is an immutable command input, not another current aggregate.
- `SubmitRunForValidation` creates the exact Validation request and moves eligible work to `ready-for-validation`. Current open Finding authority may retain that state while validation, user disposition, remediation authorization, or recheck is pending.
- `AuthorizeRunRemediation` requires the exact current `remediation-authorized` Finding decision, `FindingRemediationAuthorizationId`, handoff and snapshot fingerprints, expected Run and Finding versions, accepted plan and policy epoch, available budget, and no other blocker. It moves `ready-for-validation -> running` only for the authorized tasks and scope.
- The same Execution transaction allocates any concrete remediation Workers and appends their immutable dispatch bindings to the authorization, handoff, selected task, role, and reserved limit. These later bindings do not mutate the handoff and cannot widen its task, role, scope, tool, effect, or budget sets.
- Every later retry or replacement command that creates another remediation Worker repeats those checks, consumes the remaining round limit, and appends its dispatch binding atomically as required by ADR 0007. There is no unbound remediation Worker path.
- A blocking Finding without current remediation authority keeps dispatch closed. Exhaustion or required user choice moves or keeps the Run `blocked` with its exact condition. Execution removes only the condition proved resolved and reruns the complete lifecycle evaluator; Finding never writes Run status directly.
- `AuthorizeRunCompletion` consumes ADR 0012 Completion authorization plus a fresh matching `validation-clear` snapshot. In the same Writer-fenced transaction it reruns the scoped query and rejects changed membership, pending proposal set, Finding decision, state, class, entity version, Evidence pointer, expiry, scope, rule, or query fingerprint. Unrelated Project writes and sequence changes do not stale the snapshot.

### Completion And Invalidation

- ADR 0012 Completion Finding snapshots consume Finding aggregate authority, not Validation Episode membership or technical recheck current rows alone. Each member references the exact Finding root/current decision and the technical Evidence decisions supporting its applicability.
- A zero-member snapshot is favorable only after the authoritative direct query completes with no missing, pending, ambiguous, truncated, stale, or broken input. Missing Finding rows or a broken Validation Episode projection never means no Findings.
- Any persisted Finding-proposal creation, relevant proposal evaluation or settlement, Finding admission, decision, class, state, entity version, correlation affecting material identity, technical recheck, scope fingerprint, rule, evaluator, or snapshot-query change reverse-invalidates dependent current Completion evaluation in the same Project transaction through the scoped proposal/Finding dependency index. Time-based expiry blocks every favorable read immediately; its subsequent `ReopenFinding` settlement performs normal transactional invalidation. Immutable snapshots are never mutated or marked invalid.
- Blocking Findings require exact allowed disposition at Completion time. Advisory Findings remain snapshot members and follow the exact Completion-contract rule. Historical closure, expired risk, stale recheck, out-of-scope without current scope proof, or supersession without a valid successor never satisfies Completion.
- Finding risk acceptance cannot satisfy unresolved Effect or Recovery, Candidate, Test, Artifact, contract, or human Completion-acceptance obligations.

### Commands And Transactions

- Use the canonical Finding commands `AdmitFinding`, `ResolveFindingProposal`, `ClassifyFinding`, `AuthorizeFindingRemediation`, `SubmitFindingFix`, `SubmitFindingNoFix`, `CloseFindingVerified`, `ReopenFinding`, `AcceptFindingRisk`, `DeferFinding`, `MarkFindingFalsePositive`, `MarkFindingOutOfScope`, `CorrelateFindings`, and `SupersedeFinding`.
- ADR 0007 `SubmitRunForValidation` is the sole creator of an immutable Validation request. Use `RequestFindingRecheck` for the later immutable recheck input. The private `CaptureFindingAuthority` command atomically writes one immutable snapshot and its one-to-one coordinator result. Validation Episode queries allocate no Command ID or authority record.
- Every command requires its own Command ID and fingerprint, actor authority, exact inputs, and Writer generation. `AdmitFinding` and `ResolveFindingProposal` fix one proposal and expected settlement absence; a one-Finding command fixes its expected entity version and current decision; `CorrelateFindings` fixes both ordered Finding versions and rejects the reserved `discovered-during-recheck` kind; `CaptureFindingAuthority` fixes its complete query parameters. Exact retry returns the original receipt, conflicting reuse is `IDEMPOTENCY_CONFLICT`, and a stale compare-and-set changes nothing.
- The same Finding decision transaction writes its specialized child records, advances current Finding fields, writes its transition history and condition rows where applicable, reverse-invalidates affected current Completion evaluations, and emits the canonical event. It cannot leave a decision appended without the matching current aggregate advance or vice versa.
- `AdmitFinding` atomically settles the proposal and, only for `created`, creates the Finding root and initial decision; `attached-to-existing` and conflict outcomes do not advance a Finding. Every decision command other than admission requires an existing Finding. `CorrelateFindings` writes only one typed relationship and no disposition. No generic batch, status setter, replay repair, Validation Episode write, or cross-Finding decision batch is public.
- A command affecting several Findings fixes the exact ordered Finding set and expected versions before mutation, then invokes one owner command per Finding under the coordinator's declared private transaction when atomic Completion invalidation requires it. If any compare-and-set or fan-out bound fails, none of those Finding decisions or dependent favorable current evaluations change.

### Physical Records

Add these Application-coordinator records to `slopstop.db` under ADR 0006 Project keys, command idempotency, Project sequence, Writer fencing, and owner-transition rules. Validation requests and remediation Worker dispatches are Execution-owned; Finding proposals and request-attempt links are Evidence-owned; the remaining records have the Finding owner declared here:

| Family | Tables |
| --- | --- |
| Finding proposal settlement | `finding_proposal_settlements` |
| Finding authority | `findings`, `finding_decisions`, `finding_decision_applicabilities`, `finding_decision_evidence_dependencies`, `finding_decision_policy_dependencies`, `finding_status_transitions`, `finding_status_transition_conditions` |
| Finding decision shapes | `finding_admissions`, `finding_classifications`, `finding_reopenings`, `finding_verified_closures`, `finding_risk_acceptances`, `finding_deferrals`, `finding_false_positive_decisions`, `finding_out_of_scope_decisions`, `finding_supersessions` |
| Validation requests | `validation_requests`, `validation_request_rules`, `validation_request_independence_requirements`, `validation_request_budget_limits` |
| Evidence producer-request links | `validation_request_producer_attempts`, `finding_recheck_request_producer_attempts` |
| Finding relationships | `finding_correlations`, `finding_derived_waypoint_proposals` |
| Remediation | `finding_remediation_authorizations`, `finding_remediation_handoffs`, `finding_remediation_handoff_findings`, `finding_remediation_handoff_correlations`, `finding_remediation_handoff_clauses`, `finding_remediation_handoff_tasks`, `finding_remediation_handoff_roles`, `finding_remediation_handoff_scopes`, `finding_remediation_handoff_tools`, `finding_remediation_handoff_effects`, `finding_remediation_handoff_tests`, `finding_remediation_handoff_artifacts`, `finding_remediation_handoff_output_contracts`, `finding_remediation_handoff_independence_requirements`, `finding_remediation_handoff_limits`, `finding_fix_submissions`, `finding_no_fix_submissions` |
| Remediation dispatch | `finding_remediation_worker_dispatches` |
| Recheck requests | `finding_recheck_requests`, `finding_recheck_subject_lineage`, `finding_recheck_independence_requirements`, `finding_recheck_budget_limits` |
| Coordinator snapshots | `finding_authority_snapshots`, `finding_authority_snapshot_members`, `finding_authority_snapshot_proposals`, `finding_coordinator_results` |

- ADR 0010 retains `finding_observations`, `finding_evaluations`, `finding_evaluation_decisions`, `finding_current_evaluations`, `finding_recheck_observations`, `finding_recheck_evaluations`, `finding_recheck_decisions`, and `finding_recheck_current_evaluations` as technical Evidence tables. Initial Finding Evidence references `FindingProposalId`; recheck Evidence references admitted `FindingId`. None stores Finding state or class.
- Reuse ADR 0010 `finding_proposals` and their checked Validation, trusted-direct, or Language-observation source children as technical Evidence input. The Language child carries the exact diagnostic member, Language check/request generation, current complete evaluation, and accepted decision through composite foreign keys. Key `finding_proposal_settlements` one-to-one by proposal and command receipt. Every settlement references the exact immutable technical evaluation, Evidence entry, accepted Evidence decision, and copied observed current version that authorized it; checked outcome/verdict pairs require `FINDING_PRESENT` for `created` or `attached-to-existing`, `FINDING_NOT_PRESENT` for `dismissed-not-present`, `FINDING_NOT_APPLICABLE` for `dismissed-not-applicable`, and `FINDING_CHANGED` for `superseded-by-proposal`. Require exactly one matching new Finding, existing Finding, no-Finding, or successor-proposal result arm. Identity conflict, stale, ambiguous, truncated, rejected, or broken Evidence creates no settlement. A Finding can have one created settlement and many attached proposal settlements.
- Key `findings` by `(project_id, finding_id)` and make the root's proposal settlement unique. Its mutable current tuple has a deferred composite foreign key to one immutable decision; no historical record references that mutable tuple.
- Key decisions by `(project_id, finding_decision_id)`, make `(project_id, finding_id, decision_sequence)` and command receipt unique, require predecessor sequence and resulting version to be consecutive, and make `(project_id, finding_id, finding_decision_id, resulting_entity_version, resulting_state, resulting_class)` unique. Snapshots, authorizations, submissions, and command inputs reference this immutable resulting tuple rather than mutable `findings` columns.
- Require every decision to have exactly one `finding_decision_applicabilities` child with the exact Evidence scope, fingerprint, rule, policy, evaluation, Evidence entry, and accepted evaluation decision that establish applicability. Require exactly the specialized action child permitted by the closed transition matrix; no universal nullable disposition payload is allowed.
- Key validation and recheck requests by opaque identity and make their command receipts unique. Later Evidence-owned start transactions create new `EvidenceProducerAttemptId` values and append one-to-one `validation_request_producer_attempts` or `finding_recheck_request_producer_attempts`; ADR 0014 defines these link schemas but neither Execution nor Finding writes them. Request rows never reference a future attempt or copy producer lifecycle.
- Every proposal, Finding decision, handoff, fix or no-fix submission, recheck request, correlation, and request-attempt link created within a Validation cycle stores its exact causal `ValidationRequestId`. A checked direct-trusted-source arm or non-Validation Language-observation arm replaces that reference only where direct operation is permitted. A Validation-sourced Language arm must carry the same `ValidationRequestId`. This causal link rebuilds one Episode but grants no authority.
- Key remediation authorizations, fix submissions, and no-fix submissions by opaque identity, make each authorizing or submission decision unique, and use composite foreign keys to the exact immutable Finding-decision result, plan, epoch, scope fingerprint, budget reservation, Worker result or proved no-dispatch outcome, and Candidate or Task-workspace output. Require every handoff task/role/scope/tool/effect/test/artifact/output/limit set as ordered relational children; JSON cannot carry authority. Key later Execution-owned Worker dispatches by authorization, Worker, task, and role and require every selection to be a subset of that immutable handoff.
- Key recheck subject lineage by request and source/target fingerprint. A fix-sourced row must prove the current target descends from the exact submitted output and retains its accepted remediation delta; a no-fix or explicit-current-subject row uses its separate checked arm.
- Key snapshots by opaque identity, capture command receipt, and query fingerprint. Key Finding members and blocking/unsettled proposal members separately by snapshot and stable position and make each identity unique within its member set. A proposal member uses one checked arm: `pending-observation` references the proposal and observation with null evaluation/decision; `latest-rejected` references the proposal plus latest rejected evaluation/decision with no current pointer; `current-evaluated` references the proposal and exact accepted current evaluation/decision/version. Every proposal-member arm requires settlement absence; a terminal settlement removes the proposal from this blocking set, while `created` or `attached-to-existing` is represented through its Finding member. Finding members reference the immutable Finding-decision result and exact Evidence observed. Store copied row hashes and versions only as observations. Make `finding_coordinator_results` one-to-one with the snapshot. A snapshot is never mutated or invalidated; consumers rerun and compare its scoped query.
- Add no `validation_episodes`, mutable remediation round, mutable Finding assignment, generalized issue table, JSON authority, or second Finding current table.

### Direct Queries And Diagnostics

- Query one Finding through its root and current decision composite key. Query history by Finding and decision sequence. Never select the latest timestamp or infer state from recheck history.
- Query applicable Completion Findings by Run, exact Completion scope and fingerprint, current decision/class/state, contract/rule, and entity version. Anti-join pending unsettled proposals, rechecks, expired risk or deferral, stale scope, and broken authority before returning `validation-clear`.
- Index technical Finding current evaluations by proposal and scope and recheck current evaluations by admitted Finding and scope. Index proposal settlements by material-identity tuple, outcome, target Finding, and successor proposal; snapshot proposal members by proposal, scope, rule, and technical current version; Findings by Run, originating scope, current state/class/decision, and entity version; decision applicability by scope/fingerprint/rule/evaluation; decisions by action/state/class and Project sequence; pending observations by proposal or Finding and scope; causal records by Validation request; remediation by authorization and Finding; Worker dispatches by authorization/task/role and Worker; fix/no-fix submissions by Worker result or proved no-dispatch outcome and fingerprint; recheck requests by Finding and source submission; correlations by both Finding endpoints; and derived-Waypoint proposals by source Finding.
- Use the stable diagnostics `FINDING_AUTHORITY_MISSING`, `FINDING_AUTHORITY_STALE`, `FINDING_AUTHORITY_BROKEN`, `FINDING_ADMISSION_REJECTED`, `FINDING_IDENTITY_CHANGED`, `FINDING_INDEPENDENCE_REQUIRED`, `FINDING_REMEDIATION_REQUIRED`, `FINDING_REMEDIATION_EXHAUSTED`, `FINDING_RECHECK_REQUIRED`, `FINDING_RECHECK_STALE`, `FINDING_SCOPE_EXPANSION_REQUIRED`, `FINDING_USER_DECISION_REQUIRED`, `FINDING_RISK_ACCEPTANCE_EXPIRED`, and `FINDING_COMPLETION_BLOCKED`.
- Missing, rejected, stale, ambiguous, truncated, uncertain, or broken input never produces an empty Finding set, advisory downgrade, accepted risk, verified closure, completed Validation Episode, or clear coordinator result.

### Issue 62 Closure

| Ticket requirement | Explicit answer |
| --- | --- |
| Validator records | Immutable Validation requests anchor attributed read-only validator Workers, commands, producer attempts, observations, and Evidence. Validation Episodes are rebuildable views only. |
| Stable Finding authority | One settled proposal creates or attaches to one stable Finding root; an immutable decision ledger and atomic current decision/state/class/version have no competing episode or Evidence disposition head. |
| Status transitions | The closed action/state matrix, action-specific relational children, and checked predecessor/current-version rules replace generic status mutation and include an explicit no-fix outcome. |
| Independence | Producer, validator, remediation Worker, rechecker, and deciding actor relationships are explicit; a production mutator cannot independently validate or recheck its own work. |
| Budgets | Exact epoch-owned limits cover rounds, Workers, validator/rechecker attempts, commands, time, tokens, cost, and effects; exhaustion blocks and preserves history. |
| Remediation handoff | One immutable authorization and handoff pins Findings, Evidence, clauses, scope, permissions, tests, fingerprints, effects, output, and reserved limits. |
| Blocking and advisory | Classification is a typed Finding decision. Blocking always follows contract gates; advisory remains visible and blocks only under exact contract or policy. |
| Acknowledgement limits | Risk acceptance is typed, actor- and policy-authorized, scoped, reasoned, residual-risk-bound, expiring, and unable to rewrite other proof families. |
| Out-of-scope promotion | An exact decision may propose a derived Waypoint but cannot create it or widen the current Run; expansion needs normal approval. |
| Same-Finding recheck | Every fresh recheck uses the same Finding only for the same material claim, a new producer attempt, exact current scope, and immutable ordered history. |
| New problems | Materially different rule, claim, subject, scope, applicability, or impact creates a new correlated Finding identity. |
| Exhaustion | The Run becomes or remains blocked with a typed condition and user Attention; Findings and Evidence are not erased or relabelled. |
| Coordinator authorization | Exact immutable snapshots derive closed clear, remediation, recheck, blocked, exhausted, or broken results; Execution consumes only current favorable variants and recomputes lifecycle. |

## Consequences

### Positive

- One aggregate answers current Finding disposition without trusting UI episodes or replay.
- Validation and recheck remain independently attributable Evidence and cannot silently close their own Findings.
- Remediation is bounded, scope-safe, test-aware, and directly connected to Run authority.
- Completion snapshots can detect every relevant Finding authority change precisely.

### Costs

- Finding decisions, remediation handoffs, rechecks, and Completion require several exact references and compare-and-set checks.
- A materially changed claim needs a new Finding and explicit correlation rather than editing the old record.
- Rich Validation Episode screens must be rebuilt from source records instead of reading one mutable episode row.

### Rejected Alternatives

- Do not make Validation Episode a coordinator aggregate or status owner.
- Do not let Evidence recheck decisions write Finding disposition directly.
- Do not use one mutable Finding status without an immutable decision ledger.
- Do not let risk acceptance, out-of-scope, deferral, or exhaustion manufacture closure.
- Do not copy sibling Finding state into a Candidate or final Completion scope.

## References

- `PRODUCT.md`
- `CONTEXT.md`
- `AGENTS.md`
- ADR 0006: Physical Persistence Layout
- ADR 0007: Supervised Execution Aggregate Ownership
- ADR 0008: Run Workspace Mutation Lease And Process Job Lifecycle
- ADR 0009: Provider-Neutral Agent Runtime And Turn Contracts
- ADR 0010: Typed Evidence Ledgers And Atomic Current Evaluations
- ADR 0011: Approved Run Preparation And Amendment Authority
- ADR 0012: Test-First Completion Proof
- ADR 0013: Effect Reconciliation And Recovery Journal
- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-62-finding-lifecycle.md`
- GitHub issues `#54` and `#62`
