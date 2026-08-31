# ADR 0016: Language Observation Intake And Evidence Authority

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

ADR 0008 makes Execution the sole process and Run-workspace authority. ADR 0009 keeps model-visible retrieval bounded and provider-neutral. ADR 0010 names Language Intelligence as an attributed producer but deliberately requires every new Evidence family to define its own subject, scope, records, verdicts, current key, and writer.

Language Server Protocol responses are not automatically proof. Document synchronization uses notifications, push-diagnostic versions may be absent, partial results may precede a terminal response, cancellation can race a late result, and a language server may propose edits. A zero-diagnostic payload can therefore mean complete empty output, stale input, an early push, a truncated result, failed synchronization, or a broken producer.

The accepted decision for issue 74 defines one provider-neutral, task-shaped Language observation intake. It treats the local draft ADR 0003 as revisable until separately published.

## Decisions

### Ownership And V1 Boundary

- Let Execution own Language process sets, process generations, synchronization, ready waterlines, Language checks, operation requests, operation attempts, cancellation, retry, and dispatch. The Application coordinator remains the only process launcher and committed-action authority.
- Let Language Intelligence own immutable attributed operation chunks, terminal observations, semantic enrichments, and mutation proposals. The adapter translates protocol messages and owns no current or canonical state.
- Let Evidence own the `language-observation` family: Evidence observations, evaluations, decisions, invalidation, and one atomic current evaluation per exact check and scope. It never starts, cancels, retries, or settles a Language process or operation.
- Restrict V1 Language checks to four exact source-to-resource pairs: Worker Tool invocation on its task resource, Composition operation on its Composition resource, ADR 0015 Candidate materialization review requirement on its Candidate materialization resource, and Validation request on its Candidate validation resource. Source identity and resource kind remain separate checked fields. The coordination resource has no accepted V1 Language-check consumer and is deferred rather than treated as a Project-wide semantic scope. ADR 0006 application workspaces, canonical Project content, path-only scope, and Integration targets cannot host this family.
- Use the closed read-operation kinds `diagnostics`, `inspect-symbol`, and `find-references`. No raw LSP method catalogue, completion, formatting, rename, code action, or direct edit operation enters the model-facing or Evidence surface.

### Stable Check, Request, Attempt, And Observation Identity

- Give one consumer requirement an opaque Project-scoped `LanguageCheckId`. Its immutable requirement fields fix operation kind and schema, normalized semantic target, result schema, purpose, and a canonical requirement fingerprint. Its checked source union references exactly one Worker Tool invocation, Composition operation, ADR 0015 `CandidateMaterializationReviewRequirementId`, or Validation request plus the exact Run, accepted plan and policy epoch, `EvidenceScopeId`, Run workspace, physical resource, accepted source fingerprint, Capability version, and approved limits. A semantically different operation, target, schema, or purpose requires a new check identity.
- Store the check's current request identity, non-negative request generation, and entity version directly. `AdmitLanguageCheck` creates generation zero. `RetryLanguageCheck` is one private coordinator transaction: it inserts a supersession fence and the next immutable request and attempt, invokes the Evidence-owned invalidation for any old current evaluation, then compare-and-sets the check's active request tuple. It never rewrites or reuses an earlier request or attempt, and no Execution write points an Evidence current row at the new request.
- Give every admitted dispatch one immutable `LanguageOperationRequestId` and one `LanguageOperationAttemptId`. A request fixes operation kind and schema, canonical arguments and fingerprint, dependency-closure requirement, expected ready waterline, timeout, cancellation generation, completion strategy, result schema, and limits.
- Give each terminal attributed producer fact one opaque `LanguageObservationId` bound to one exact attempt. Equal requests, bytes, members, or result digests never merge identities.
- Keep the Language observation separate from ADR 0010's Evidence observation. `RecordLanguageEvidenceObservation` references either one exact terminal Language observation or one exact Execution terminal attempt outcome through a checked source union; it never fabricates a producer result for missing, cancelled, or failed work.

### Process Set, Generation, And Ready Waterline

- Give every admitted resource/toolchain/configuration binding one `LanguageProcessSetId`. Use immutable process-generation identities for starts and restarts under that set.
- Use process-set states `provisioning`, `synchronizing`, `ready`, `stopping`, `stopped`, `recovery-required`, and `broken`. Only checked Execution commands move them. `AcceptLanguageReadyWaterline` is the sole transition into `ready`; process outcomes and adapter callbacks cannot create readiness.
- Give each successful synchronization one immutable `LanguageReadyWaterlineId` binding the process generation, Run-workspace resource and accepted fingerprint, normalized document set and versions, configuration, toolchain, adapter, server, accepted Capability version, synchronization sequence, and completion proof.
- Dispatch requires the process set to be `ready` and its exact current waterline to equal the request. A source change moves the existing set to `synchronizing` and clears only its current-waterline pointer until a new waterline is accepted. Configuration, toolchain, Capability-contract, adapter, or server changes require a different process set and stop the old set; these immutable bindings never change in place. There is no best-effort dispatch or silent fallback.
- Starting, stopping, or restarting the operating-system process follows ADR 0008 Process-job and ADR 0013 Effect ordering. A read-only Language operation against an already ready process records `no-effect` only when its selected Capability proves that it cannot mutate files, Git, credentials, external services, or canonical state. Any required process launch remains a separate Effect.

### Versioned Language Capability Contract

- Add one typed Language contract to an accepted canonical Capability version. It fixes operation kind and schema, adapter/server/toolchain compatibility, synchronization mode, completion strategy, partial-result support, cancellation behavior, dependency-closure method, mutation-callback policy, result schema, and approved limit units.
- Use the completion strategies `terminal-response`, `pull-diagnostics`, and `adapter-barrier`. `diagnostics` requires `pull-diagnostics` or an `adapter-barrier` whose conformance proves source synchronization, terminal completion, complete partial-result assembly, and omitted-member accounting.
- Treat `textDocument/publishDiagnostics` as provisional enrichment unless the selected adapter-barrier contract proves the additional completion conditions. A document version alone is insufficient, and a missing version never becomes current clean Evidence.
- Reject dispatch with `LANGUAGE_CAPABILITY_UNAVAILABLE` when the accepted Capability cannot represent the exact operation, synchronization, completion, schema, cancellation, or limit contract. Never weaken the request to make the adapter succeed.

### Immutable Operation Seal And Dependency Closure

- Seal Project, Run, accepted plan and policy epoch, check, request generation, request, attempt, operation kind/schema, Language process set and generation, ready waterline, Evidence scope, Run workspace, physical resource, Repository resource key, accepted whole-resource source fingerprint as dispatch provenance, Capability and contract version, adapter/server/language/toolchain versions, configuration fingerprint, canonical arguments fingerprint, approved limits, timeout, cancellation generation, producer identity, and command lineage.
- Store the ordered requested document identities, normalized Repository-relative paths, document versions, content identities, and one immutable dependency-closure manifest. The closure uses typed document, project-configuration, toolchain, generated-input, and whole-resource members; machine-local paths and LSP URIs are transport metadata, not portable identity.
- Let an adapter use a narrower closure only when its accepted Capability proves how that closure is complete for the operation. Otherwise require one whole-resource member referencing the exact accepted Run-workspace fingerprint.
- Bind every raw chunk and terminal observation to the same seal. A mismatched process generation, waterline, request, resource, document, schema, or result digest is `LANGUAGE_OBSERVATION_BROKEN`, not another result for the same attempt.
- Keep process generation and the dispatch-time accepted waterline as immutable provenance after terminal completion. Restart clears the process set's current-waterline pointer but does not stale a completed current evaluation when its semantic dependencies remain unchanged. It invalidates active readiness and every in-flight attempt tied to the old generation.

### Chunks, Completion, Empty Output, And Late Results

- Key chunks by attempt and non-negative ordinal. Preserve raw protocol order, normalized typed payload Artifact, chunk digest, member count, cumulative count, and partial-result token when present. Do not let a chunk become an Evidence observation or current authority by itself.
- A terminal Language observation records completion kind, expected and observed chunk count, ordered aggregate digest, total and omitted member counts, final response identity, cancellation observation, and Artifact references. Complete output requires contiguous chunks and the selected Capability's terminal condition.
- Represent a complete zero-member result as `member_count = 0`, `omitted_member_count = 0`, and complete terminal proof. It says only that the exact operation over its dependency closure returned no members. It never means globally clean, no Findings, Test Green, Completion-ready, or Candidate-acceptable.
- Cancellation or supersession writes one immutable request fence at the canonical Project sequence and closes current use of that generation immediately. Later chunks and terminal responses are appended as attributed history with their receive and record ordering, but a result behind that fence cannot support `LANGUAGE_OBSERVATION_COMPLETE` or replace current authority.
- A timed-out, interrupted, or uncertain read-only attempt may be retried under a new request and attempt after Execution fences every older generation. The retry does not claim that the old attempt never ran and never reuses its identity.

### Language-Observation Evidence Family

- Use one Evidence family `language-observation` with a closed operation discriminator. A Language Evidence observation has exactly one `diagnostics`, `inspect-symbol`, or `find-references` typed payload child matching the selected request. A result-source payload references the exact raw typed result without copying it; an attempt-outcome payload references the exact typed request and carries no semantic result members.
- Use the closed verdicts below.

| Verdict | Exact meaning |
| --- | --- |
| `LANGUAGE_OBSERVATION_COMPLETE` | The exact current request produced one complete, integrity-valid, Capability-conformant result over its unchanged dependency closure. A zero-member result is permitted only here with zero omitted members. |
| `LANGUAGE_OBSERVATION_MISSING` | The required process outcome, document, dependency, Artifact, or terminal source record is unavailable and no stronger failure is proved. |
| `LANGUAGE_OBSERVATION_STALE` | The request generation or an exact source, closure, configuration, toolchain, Capability, schema, policy, limit, Artifact-state, or trust dependency no longer matches current authority. |
| `LANGUAGE_OBSERVATION_TRUNCATED` | An approved bound stopped complete member, chunk, document, anchor, path, or result capture. Useful partial data grants no complete authority. |
| `LANGUAGE_OBSERVATION_CANCELLED` | Execution conclusively cancelled the exact attempt and fenced every later result from current use. |
| `LANGUAGE_OBSERVATION_REJECTED` | Trust, policy, scope, independence, schema, or Capability admission refuses the proposed evaluation. |
| `LANGUAGE_OBSERVATION_FAILED` | The admitted server operation returned a conclusive operation failure without a complete semantic result. |
| `LANGUAGE_OBSERVATION_UNCERTAIN` | Started operation continuity or terminal completeness cannot be proved after timeout, interruption, process loss, or conflicting protocol observations. |
| `LANGUAGE_OBSERVATION_AMBIGUOUS` | Complete protocol output cannot select one typed semantic interpretation where the operation contract requires one. |
| `LANGUAGE_OBSERVATION_BROKEN` | Seal, chunk sequence, digest, schema, producer attribution, evaluator execution, or relational integrity is invalid. |

- Apply structural broken, missing, truncation, stale-generation/dependency, conclusive cancellation, conclusive failure, uncertainty, and ambiguity checks before `LANGUAGE_OBSERVATION_COMPLETE`. An accepted `LANGUAGE_OBSERVATION_REJECTED` evaluation is a current non-favorable domain verdict. It is distinct from the Evidence decision action `reject-evaluation`, which advances only `latest_*`; when that action also proves prior current authority stale or broken, the same transaction installs the exact accepted non-favorable replacement required by ADR 0010.
- Evaluate the seal, chunk continuity, Capability contract, limits, freshness, schemas, and integrity with a deterministic Evidence evaluator and implementation hash. It does not call the same live Language server to ask whether its output is valid.
- Key current authority by `(project_id, evidence_scope_id, language_check_id)`. The row references the immutable request generation actually evaluated plus the accepted Language evaluation and decision, never the check's mutable active-request pointer. Favorable consumption directly compares that evaluated tuple with the check's active tuple. Retry atomically installs a stale invalidation before advancing the active tuple, so an older generation cannot be consumed even when its bytes equal the new result.
- A changed closure member, closure proof, configuration, toolchain, Capability, operation schema, request scope, policy epoch, approved limit, Artifact state, or trust basis reverse-invalidates only exact dependent current rows. Under a proved narrow closure, the sealed whole-resource fingerprint remains dispatch provenance and a source change outside the closure does not stale the result. Under whole-resource fallback, that fingerprint is itself the closure dependency and any change invalidates the result.

### Semantic Enrichment, Findings, And Completion

- Bind every symbol, occurrence, definition, diagnostic, and reference location to the exact Language observation, requested document content identity, Evidence scope/fingerprint, and optional existing `CompoundCodeAnchorId`.
- Treat LSP URI, position, symbol, occurrence, definition, server, and Capability metadata as revision-bound semantic hints. ADR 0010 Git, content, revision, text, and syntax inputs remain Compound-code-anchor authority. Language data cannot create an exact, moved, changed, historical-only, deleted, ambiguous, or invalid anchor verdict by itself.
- Permit a current complete diagnostic member to create one attributed `FindingProposalId` only through ADR 0014's normal Finding-observation command and checked `language-observation` proposal-source child. The proposal references this exact current Language evaluation and accepted decision. It cannot allocate `FindingId`, classify or close a Finding, or bypass independent Finding Evidence.
- Permit later Test, Validation, Finding, Finding-recheck, Candidate-review, or Completion evaluations to reference one exact current complete Language evaluation as a typed dependency only when their own family rules allow it. No Language verdict directly proves Red, Green, no Findings, Completion, Candidate acceptance, or Integration applicability.

### Language Mutation Proposals

- Give every edit set emitted through `workspace/applyEdit` while an admitted V1 read operation is active one opaque `LanguageMutationCallbackObservationId`. The callback observation records the exact request, attempt, protocol callback identity, receive order, raw payload Artifact, producer, and closed normalization outcome `proposal-recorded | rejected | broken` before the adapter responds. Only `proposal-recorded` creates one `LanguageMutationProposalId`; rejected or malformed callbacks retain their observation and stable diagnostic without a proposal. Neither record is a terminal Language observation, V1 read-operation kind, Language Evidence verdict, Tool authorization, Candidate delta, or Effect declaration. Actively requesting rename, code action, or formatting needs a later separately admitted mutation-request contract; those methods cannot bypass the closed V1 read surface.
- Bind the proposal to exact Project, Run, process set/generation, source request, attempt, mutation callback observation, Capability, resource and source fingerprint, dependency closure, normalized affected-file manifest, ordered edits per file, expected preimage or absence proof, derived result text Artifacts, schema, producer, and proposal digest. A later terminal Language observation may reference the callback as append-only history but is not required to preserve or reject the intercepted proposal.
- Intercept mutation callbacks before any file or canonical write. The adapter may report only the proposal. A later Execution path must independently admit the operation, validate paths and preimages, obtain policy and user approval where required, classify the Tool and Effects, acquire the required Repository mutation lease, and recheck current source state before a task-resource write. The resulting change must then pass normal Worker-result, Composition, Candidate, review, and Integration authority; Candidate authority is not a circular prerequisite for creating the task-resource result. Rejection or staleness changes no file.

### Commands And Lifecycle

Execution owns these versioned commands:

| Command | Required result |
| --- | --- |
| `CreateLanguageProcessSet` | Create one process set for an exact typed Run resource, toolchain, configuration, and accepted Capability contract. |
| `StartLanguageProcessGeneration` | Follow Process-job and Effect admission, create a new generation, and move `provisioning | stopped -> synchronizing`; never create readiness. |
| `RequestLanguageResynchronization` | Fence new dispatch, clear the current-waterline pointer, and move `ready -> synchronizing` after an accepted source change. |
| `RequestLanguageProcessStop` | Fence new dispatch and move `synchronizing | ready -> stopping` after in-flight attempts are cancelled or fenced. |
| `RecordLanguageProcessOutcome` | Append attributed process or synchronization facts and move an applicable nonterminal state only to `stopped`, `recovery-required`, or `broken`; never create readiness. |
| `ReconcileLanguageProcessSet` | Consume exact process and Effect proof to move `recovery-required -> stopped | broken`; it never resumes dispatch. |
| `AcceptLanguageReadyWaterline` | Create one immutable exact synchronization waterline and move `synchronizing -> ready` after source and Capability recheck. |
| `AdmitLanguageCheck` | Create one stable check, checked consumer-source child, generation-zero request, and admitted attempt under exact current authority. |
| `StartLanguageOperationAttempt` | Recheck process, waterline, resource, fingerprint, Capability, limits, fences, and active check generation, then persist and flush `admitted -> running` before adapter dispatch. |
| `RequestLanguageOperationCancellation` | Compare-and-set `admitted | running -> cancel-requested`, write the request fence, close later current use, and append the cancellation request without inventing a terminal result. |
| `SettleLanguageOperationAttempt` | Consume attributed terminal Language or process facts and move the attempt to completed, cancelled, failed, uncertain, or superseded. |
| `RetryLanguageCheck` | In one coordinated transaction, fence the old request, supersede any nonterminal old attempt, invalidate old current Evidence through its owner, insert new request and admitted attempt identities, and compare-and-set the check's active tuple. |

Language Intelligence contributes only `RecordLanguageObservationChunk`, `RecordLanguageObservation`, and `RecordLanguageMutationCallback` attributed inputs through the coordinator. Every command carrying produced bytes invokes Evidence-owned registration of each Artifact, matching Language provenance child, and initial Artifact-state decision in the same transaction. `RecordLanguageMutationCallback` atomically writes the callback observation and its rejected/broken diagnostic or complete proposal manifest before adapter response; its proposal-recorded arm also registers every derived result Artifact. Language Intelligence does not write Artifact authority. Evidence owns `RecordLanguageEvidenceObservation`, `DecideLanguageObservationEvaluation`, and `InvalidateLanguageObservationCurrentEvaluation`. Every command uses ADR 0006 command idempotency; there is no generic status setter, verdict setter, current-pointer mover, or adapter-owned retry.

### Physical Records And Constraints

ADR 0016 adds these `slopstop.db` families:

| Owner | Tables |
| --- | --- |
| Capability catalogue | `language_capability_contracts`, `language_capability_contract_operations`, `language_capability_completion_strategies` |
| Execution process owner | `language_process_sets`, `language_process_generations`, `language_process_status_transitions`, `language_process_status_transition_conditions`, `language_ready_waterlines`, `language_ready_waterline_documents` |
| Execution check owner | `language_checks`, `language_check_worker_tools`, `language_check_compositions`, `language_check_candidate_materializations`, `language_check_validations`, `language_operation_requests`, `language_operation_request_documents`, `language_operation_dependency_closures`, `language_operation_dependency_documents`, `language_operation_dependency_configurations`, `language_operation_dependency_toolchains`, `language_operation_dependency_generated_inputs`, `language_operation_dependency_whole_resources`, `language_operation_attempts`, `language_operation_request_fences`, `language_operation_cancellation_requests`, `language_operation_status_transitions`, `language_operation_status_transition_conditions` |
| Language producer facts | `language_observations`, `language_observation_chunks`, `language_observation_diagnostics`, `language_observation_symbol_inspections`, `language_observation_references`, `language_observation_semantic_locations`, `language_mutation_callback_observations`, `language_mutation_callback_rejections`, `language_mutation_callback_failures`, `language_mutation_proposals`, `language_mutation_proposal_files`, `language_mutation_proposal_text_edits` |
| Evidence | `language_evidence_observations`, `language_evidence_observation_results`, `language_evidence_observation_attempt_outcomes`, `language_evidence_observation_diagnostics`, `language_evidence_observation_symbol_inspections`, `language_evidence_observation_references`, `language_observation_evaluations`, `language_observation_decisions`, `language_observation_current_evaluations` |

- Key process sets, checks, requests, attempts, waterlines, observations, chunks, proposals, evaluations, and decisions by Project plus opaque identity. Hashes and machine paths are never identity or uniqueness keys.
- Give each process generation, ready waterline, check source, operation kind, dependency closure, Language Evidence source, and Language Evidence operation payload a closed discriminator and exactly one matching typed child. Creation transactions and opening integrity checks reject zero, multiple, or mismatched arms.
- Give a process set a candidate key containing Project, process-set identity, Run resource, Capability contract/version, adapter/server, toolchain fingerprint, and configuration fingerprint. Give each generation a candidate key extending that tuple with generation identity and ordinal, and each waterline one extending it with waterline identity, source fingerprint, synchronization sequence, and completion proof. The process set's nullable current-waterline tuple uses a deferred composite foreign key and is populated only in the same transaction that enters `ready`; every transition out of `ready` clears it without deleting history. Each request references the complete process-generation and dispatch-waterline tuples plus the exact Capability-operation and completion-strategy rows.
- Give the immutable requirement fields of each Language check candidate key `(project_id, language_check_id, evidence_scope_id, run_workspace_resource_id, operation_kind, requirement_fingerprint)`. Each typed source child includes its discriminator literal and uses a composite foreign key to its exact Worker Tool invocation, Composition, ADR 0015 Candidate materialization review requirement, or Validation request owner tuple; duplicated Run, plan, epoch, scope, resource, and fingerprint columns must agree with both owners rather than only the Project.
- Give each immutable request candidate key `(project_id, language_check_id, evidence_scope_id, run_workspace_resource_id, operation_kind, request_generation, language_operation_request_id)`. Store that complete active tuple and entity version on the check with a deferred composite foreign key. Every attempt, raw observation, Evidence observation, evaluation, decision, and current row carries the applicable complete immutable tuple through composite foreign keys; separate ID and generation references are insufficient.
- Use attempt states `admitted`, `running`, `cancel-requested`, `completed`, `cancelled`, `failed`, `uncertain`, and `superseded`; the last five are terminal. Make one attempt unique per request. `StartLanguageOperationAttempt` persists and flushes `running` before dispatch. A fence is unique by request and kind `cancelled | superseded`, stores its command and Project sequence, and prevents complete use even when a late result is later recorded. Retry moves any nonterminal old attempt to `superseded`; an already terminal attempt retains its terminal state while its request gains the supersession fence.
- Key chunks by `(project_id, language_operation_attempt_id, chunk_ordinal)` and make the terminal Language observation one-to-one with the attempt. A terminal observation may follow a cancelled or superseded request only as late history and cannot satisfy complete Evidence. Store message receive order and canonical record order so the fence/result race is deterministic under the Writer.
- Make one dependency-closure root unique per complete request candidate key and make the request reference that exact root. The proved-closure arm has one or more typed dependency members and exact proof metadata; the fallback arm has exactly one whole-resource member and prohibits narrower members. Create the root, selected arm, and complete member set atomically with the request. Every requested document belongs to the same Project, Run resource, and accepted source fingerprint.
- Give each Language Evidence observation one checked `language-result | execution-attempt-outcome` source child. The result arm references the exact raw Language observation and evaluated request tuple. The attempt-outcome arm references the exact settled Execution attempt and permits only missing, cancelled, failed, uncertain, or broken evaluation inputs; it cannot produce complete semantic members. Exactly one typed operation-payload child references either the matching raw result payload or the matching typed request when no result exists.
- Key `language_observation_current_evaluations` by `(project_id, evidence_scope_id, language_check_id)`. Store current and latest pointers under ADR 0010 plus the immutable evaluated request tuple, not a foreign key to the check's mutable active tuple. Composite foreign keys require the accepted evaluation, decision, scope, check, request, operation, resource, and generation to agree. Favorable reads additionally compare the evaluated tuple to the check's active tuple under its entity version.
- Require `LANGUAGE_OBSERVATION_COMPLETE` to use the result source, a complete terminal observation, contiguous chunk ordinals, matching aggregate digest, zero omitted members, no cancellation or supersession fence, unchanged semantic dependencies, the exact waterline accepted at dispatch, and exactly one operation payload. That historical waterline need not remain the process set's active waterline after terminal completion. Every other verdict prohibits favorable downstream use.
- Key each diagnostic member by its complete raw-observation tuple and diagnostic ordinal. Make `finding_proposal_language_sources` unique by that diagnostic key so one diagnostic creates at most one proposal; its composite foreign keys bind the exact current complete evaluation and accepted decision observed under compare-and-set at proposal creation without pointing history at the mutable current row.
- Key each mutation callback observation by Project plus opaque identity and make its complete request/attempt/protocol-callback tuple unique. Store one outcome discriminator and require exactly one matching `language_mutation_proposals`, `language_mutation_callback_rejections`, or `language_mutation_callback_failures` child for `proposal-recorded`, `rejected`, or `broken`; rejection and broken children carry stable reason/diagnostic records and no proposal. Key `language_mutation_proposals` one-to-one by callback observation. Key mutation-proposal files by proposal and non-negative position, with a closed `create | update | rename | delete` shape matching ADR 0010 Candidate-file nullability rules. Reject duplicate normalized source or destination paths. Key text edits by proposal file and edit ordinal. `create` references an exact destination-absence proof under the source fingerprint and a result Artifact; `update` and `rename` reference an immutable path/content/preimage-Artifact capture under that fingerprint plus a result Artifact; `delete` references only that preimage capture and has no result Artifact. Every result uses ADR 0010's `language-produced` mutation-result child for its exact producing proposal-file row. `RecordLanguageMutationCallback` writes the callback observation and exact outcome atomically; the proposal arm additionally writes root, counts, digest, files, edits, absence/preimage proof, provenance, and result Artifacts.

### Direct Queries And Recovery

- Index process sets by Run resource and current state; waterlines by process generation, resource, and source fingerprint; checks by each typed consumer and current generation; requests and attempts by check/generation; chunks and late results by attempt; current Language Evidence by scope and check.
- Index reverse invalidation by source and closure fingerprint, Capability version, configuration, toolchain, operation schema, policy epoch, approved limits, Artifact-state version, trust basis, and current evaluation entry. Do not index LSP URI or raw message text as authority.
- On startup, reconcile nonterminal Language process generations and attempts before new Language dispatch. A lost process generation invalidates its ready waterline and settles in-flight attempts as cancelled, failed, or uncertain from exact observations; it never rewrites completed history or automatically retries.
- Direct anti-joins expose admitted requests without starts, running attempts without terminal settlements, terminal raw observations without Evidence observations, and Evidence observations without decisions. None is inferred as complete, absent, or clean.

### Diagnostics

Use stable diagnostics `LANGUAGE_CAPABILITY_UNAVAILABLE`, `LANGUAGE_RESOURCE_SCOPE_INVALID`, `LANGUAGE_READY_WATERLINE_STALE`, `LANGUAGE_SYNCHRONIZATION_BROKEN`, `LANGUAGE_REQUEST_STALE`, `LANGUAGE_REQUEST_SUPERSEDED`, `LANGUAGE_RESULT_LATE`, `LANGUAGE_RESULT_TRUNCATED`, `LANGUAGE_RESULT_UNCERTAIN`, `LANGUAGE_RESULT_AMBIGUOUS`, `LANGUAGE_RESULT_BROKEN`, `LANGUAGE_DEPENDENCY_CLOSURE_BROKEN`, `LANGUAGE_MUTATION_PROPOSAL_STALE`, and `LANGUAGE_EVIDENCE_NOT_CURRENT`.

## Issue 74 Closure

| Ticket requirement | Explicit answer |
| --- | --- |
| Typed family and schema | One `language-observation` family, one stable check slot, three closed operation payloads, exact producer/Evidence split, and concrete relational records. |
| Producer trust and ownership | Execution admits work, Language Intelligence owns attributed facts, and a deterministic Evidence evaluator independently decides current use. |
| Anchor and snapshot references | Every result binds exact scope/resource fingerprints and dependency closure; semantic data is revision-bound enrichment only. |
| Freshness and invalidation | Typed reverse dependencies invalidate the exact current check; proved closures avoid unrelated invalidation and whole-resource fallback stays safe. |
| Completeness and cardinality | Versioned Capability completion strategies, contiguous chunks, terminal proof, member/omitted counts, and explicit truncation distinguish empty from incomplete. |
| Verdicts and diagnostics | Ten closed family verdicts plus stable operational diagnostics preserve missing, stale, truncated, cancelled, rejected, failed, uncertain, ambiguous, and broken outcomes. |
| Mutation safety | Every valid edit set is a separate immutable proposal requiring later independent Execution admission, approval, lease, preimage-or-absence recheck, and Effect authority; rejected or broken callbacks remain explicit observations. |

## Consequences

### Positive

- Empty or late LSP output cannot become false clean Evidence.
- Language servers remain replaceable behind a versioned Capability contract.
- Completed observations survive harmless process restart while exact source changes invalidate only affected checks.
- Findings, Test proof, Completion, Candidate review, and writes retain their existing owners.

### Negative

- Each operation needs explicit schemas, dependency closure, chunk assembly, and Capability conformance.
- Provider-specific barriers require integration tests before their output can be authoritative.
- Conservative whole-resource fallback may invalidate more observations until narrower closure proof exists.

### Deferred

- The concrete server and adapter selection remains revisable until separately published.
- ADR 0019 fixes the provisional measured Evidence result-size policy, Language-family applicability, direct authority, counting, exhaustion, and promotion gate.
- ADR 0017 owns Evidence-to-Memory invalidation events, terminal Memory staleness, and trusted-read freshness.
- ADR 0020 owns the bounded Convergence proof bundle and direct validity query without changing Language or Evidence authority.
- Debug Adapter Protocol observations remain post-proof work.
