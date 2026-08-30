# ADR 0019: Measured Evidence Result Limits And Approval Authority

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita
- Issue: [#78](https://github.com/TheMastermindPT/slopstop/issues/78)
- Research: [Measured Evidence result-size limits](../../.rpiv/artifacts/research/2026-08-26_17-25-29_evidence-result-size-limits.md)

## Context

ADR 0010 requires bounded Evidence families and makes approved limits part of every evaluation key, but deliberately deferred numeric defaults. It also gives approved-limit dependencies only Delegation-plan and Run-policy-epoch owner arms. That union cannot represent Project-operation Effect and Artifact-state Evidence or Integration-target Evidence captured before an Integration approval exists.

The repository contains no production Evidence rows, customer corpus, or family-specific benchmark. Local repository measurements provide only conservative engineering proxies. The first limits therefore need a named immutable provisional profile, explicit counting rules, family applicability, visible exhaustion, and a promotion gate that prevents local defaults from being described as production-derived.

Integration has an additional ordering defect. ADR 0015 requires current Integration-target Evidence before `SubmitIntegrationForApproval`, but previously allowed target capture only from a later Integration attempt created after approval. The result is circular authority. Limits must have a direct owner while that first read-only capture is performed.

## Decisions

### Policy Identity And Confidence

- Adopt immutable policy `evidence-result-limits/0.1.0-local-balanced` as the V1 implementation and fixture default.
- Mark the complete policy and every family applicability row `provisional-local` with low confidence. These values are conservative engineering defaults, not production percentiles, service-level claims, or customer workload evidence.
- Give every policy an opaque `EvidenceResultLimitPolicyId`, stable policy name, semantic version, canonical encoding version, confidence class, immutable ordered dimension values, immutable family-applicability rows, and one canonical fingerprint covering all of those fields.
- Keep the canonical product-policy catalogue in `application.db` under `application_evidence_result_limit_policies`, `application_evidence_result_limit_policy_values`, and `application_evidence_result_limit_family_applicability`. Each Project Evidence partition admits an immutable local snapshot with the same identity, version, canonical values, applicability, and fingerprint before use; the external Storage-operation partition does the same beside its journal. These copies claim no cross-database foreign key or transaction.
- A corrected value, counting rule, family applicability row, or confidence claim creates a new immutable policy version and fingerprint. It never rewrites this policy or relabels Evidence produced under it.
- Reserve `strict`, `balanced`, and `headroom` only as test-scenario labels. `balanced` resolves to this accepted profile. `strict` and named `headroom` profiles are fixtures and are not selectable runtime policy. Runtime headroom is an exact immutable set of resolved values approved by the direct authority owner; it is not a profile-name switch.
- Provide no `unlimited` value, sentinel meaning unlimited, environment-variable bypass, producer-selected widening, or automatic retry with a larger limit.

### Accepted Provisional Values

| Dimension | Canonical value | Meaning |
| --- | ---: | --- |
| Inline payload bytes | `262144` bytes (256 KiB) | Maximum canonical bytes stored directly across the family's typed result payload rows, excluding common envelope and limit-accounting metadata. |
| Newly created Artifact bytes | `2097152` bytes (2 MiB) | Sum of expected byte lengths for Artifacts first created by this result; references to existing Artifacts do not spend the bytes again. |
| Normalized rows | `2048` | Maximum family-owned typed result rows materialized for one result. |
| Semantic members | `512` | Maximum domain members represented by the result. |
| Distinct normalized paths | `256` | Maximum unique normalized repository or document paths directly materialized. |
| Conflict records | `256` | Maximum direct conflict records. |
| Compound anchors | `512` | Maximum distinct Compound-code-anchor identities directly emitted or resolved. |
| Candidates per anchor | `64` | Maximum ordered current-location candidates retained for one anchor. |
| Deterministic evaluator time | `30000` milliseconds | Maximum monotonic wall-clock time after all evaluator inputs are locally available. |

- Values are non-negative integers in their stated units. `0` means zero permitted material, never unlimited.
- A result is complete when its final material is equal to a ceiling. Exhaustion occurs only when the next required unit would exceed an applicable ceiling or evaluator time reaches its deadline before a trustworthy terminal evaluation exists.
- Policy metadata, the common Evidence envelope, `EvidenceResultLimitUsage`, and exhaustion metadata do not spend the result's row, member, or inline-byte limits. Family payload, ordered child, link, and diagnostic rows do.
- One material item may spend several dimensions. For example, a conflict row spends one normalized row and one conflict; when it is also a semantic member, it spends one member. An anchor candidate spends one normalized row, one semantic member, and one candidate position under its anchor.

### Closed Family Applicability

The policy shape is common, but only direct materialization spends a family dimension. A typed reference to an already bounded dependency spends the consuming result's row and member when materialized, but it does not spend the dependency's path, conflict, anchor, or Artifact-byte limit again.

| Evidence family | Inline bytes | New Artifact bytes | Rows | Members | Paths | Conflicts | Anchors | Candidates per anchor | Evaluator time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `run-workspace-fingerprint` | yes | yes | yes | yes | yes | no | no | no | yes |
| `run-workspace-baseline` | yes | yes | yes | yes | yes | no | no | no | yes |
| `worker-delta` | yes | yes | yes | yes | yes | no | no | no | yes |
| `test` | yes | yes | yes | yes | yes | no | no | no | yes |
| `completion` | yes | yes | yes | yes | yes | no | no | no | yes |
| `finding` | yes | yes | yes | yes | yes | no | yes | no | yes |
| `finding-recheck` | yes | yes | yes | yes | yes | no | yes | no | yes |
| `effect` | yes | yes | yes | yes | yes | no | no | no | yes |
| `recovery` | yes | yes | yes | yes | yes | no | no | no | yes |
| `language-observation` | yes | yes | yes | yes | yes | no | yes | no | yes |
| `composition` | yes | yes | yes | yes | yes | yes | no | no | yes |
| `candidate-review` | yes | yes | yes | yes | yes | yes | yes | no | yes |
| `integration-target-fingerprint` | yes | yes | yes | yes | yes | yes | no | no | yes |
| `integration-applicability` | yes | yes | yes | yes | yes | yes | no | no | yes |
| `anchor-resolution` | yes | yes | yes | yes | yes | no | yes | yes | yes |
| `artifact-state` | yes | yes | yes | yes | no | no | no | no | yes |

- Count semantic members by the closed family rule below. Within one result, the canonical `(member_kind, member_identity, member_version_or_position)` tuple is unique. A repeated reference to the same tuple spends one member but every distinct family-owned link row still spends one normalized row.

| Evidence family | Closed semantic-member identity |
| --- | --- |
| `run-workspace-fingerprint` | One captured tracked, relevant-untracked, index-entry, ref/HEAD, conflict-state, or declared metadata member at its canonical position. |
| `run-workspace-baseline` | One exact baseline dependency, approved dirty member, or current-capture member selected by the baseline observation. |
| `worker-delta` | One immutable delta file/change member at its manifest position. |
| `test` | One contract check, parsed test case, command-result member, or typed path-bearing diagnostic at its producer identity and position. |
| `completion` | One typed Completion obligation or exact Evidence, Finding, Effect, contract, Candidate, discipline, classification, or user-authorization dependency. |
| `finding` | One typed claim, subject, location, rule, impact, Artifact, or Compound-code-anchor member. |
| `finding-recheck` | One typed reproduction, resolution, changed-claim, location, Artifact, or anchor member for the admitted Finding. |
| `effect` | One declared class/resource member or attributed Journal, owner, observer, fingerprint, terminal, or scope observation. |
| `recovery` | One exact current Effect dependency, unresolved condition, workspace observation, compensation member, or Safety-proof obligation for the Run. |
| `language-observation` | One exact chunk, document, diagnostic, reference, symbol, occurrence, definition, Artifact, or attempt-outcome member. |
| `composition` | One selected Worker result, Task-input snapshot, manifest member, output member, physical-operation observation, or typed conflict. |
| `candidate-review` | One Candidate member, review obligation, validation producer result, blocker, Finding, path, typed conflict, or Compound-code-anchor reference. |
| `integration-target-fingerprint` | One tracked, relevant-untracked, index-entry, ref/HEAD, conflict-state, dirty-manifest, or canonical target metadata member. |
| `integration-applicability` | One exact Candidate, review, Completion, lifecycle, target, expected-path, dirty-policy, proposed-apply, or predicted-conflict dependency. |
| `anchor-resolution` | The subject anchor, one ordered candidate location, or one typed corroborating input. |
| `artifact-state` | One reachability, byte-presence, size, digest, integrity, retention, removal, store, or observer-result member. |

- Store every row above immutably under the policy version. A new Evidence family requires an explicit applicability row in a new policy version before admission.
- Admission rejects a missing applicability row, an applicable dimension without a representable Capability ceiling, or a family result shape that can directly exhaust a dimension but has no exact family-owned truncation outcome. For `candidate-review`, the truncation outcome is `CANDIDATE_BLOCKED` with required blocker kind `truncated`; every other family uses its exact truncated verdict. It does not silently omit the dimension or use another family's verdict.

### Direct Limit Authority

- Expand ADR 0010's approved-limit owner union to the closed kinds `delegation-plan`, `run-policy-epoch`, `effect-declaration`, `integration-applicability-request`, and `integration-approval`.
- Every owner fixes one policy identity/version/fingerprint, its complete ordered resolved values, the resolved-values fingerprint, and any stricter Capability ceiling. Exactly one real typed owner child exists; a generic owner string or polymorphic ID is not authority.
- Select Run-bound owners deterministically from the typed result source. A result whose family schema requires `DelegationTaskId` uses the exact accepted Delegation-plan revision that owns that task and allocation. Every other Run-bound result uses the exact Run-policy epoch that admitted its operation. When a task result also depends on an epoch, the epoch remains a separate policy dependency but is not a second limit owner. An input cannot select either arm by preference.
- Use the exact Effect declaration for Project-operation Effect and Artifact-state work outside a Run. Recovery remains restricted to ADR 0013's `run-worker` subject and therefore uses the Run-bound rule above. The external `storage-operation` partition records the same immutable Effect-owner tuple beside its operation journal in `application.db`; it does not claim a cross-database foreign key or transaction.
- An initial Artifact-state result created with Artifact bytes uses its own `artifact-state` binding to the same direct owner, policy, and resolved values as the producing operation. Later Artifact-state checks use a fresh `artifact-state` binding to the Run, Integration, or Project-operation Effect that directly requested them. V1 admits no standalone background Artifact integrity or retention scan outside those owners; such a scanner requires a later direct-owner decision and cannot invent an Effect merely to obtain limits.
- Use the exact Integration applicability request for the first target capture and its applicability evaluation. Use the exact Integration approval for preparation, pre-apply capture, and apply reconciliation after approval.
- A stricter live Capability ceiling may reduce admission or cause explicit pre-production rejection. It cannot silently alter the approved policy dependency or turn a truncated result into complete Evidence.

### Explicit Headroom

- Values above `0.1.0-local-balanced` are added power. The direct owner must contain an exact immutable `EvidenceLimitHeadroomApprovalId` with attributed user decision, reason, family, changed dimensions, old and new values, affected operation, expiry or one-operation scope, canonical view hash, and decision receipt.
- Run headroom is visible in and accepted through the sealed Run proposal and resulting Delegation-plan or epoch authority. Project-operation headroom is visible in the Effect declaration's approval. Pre-approval Integration headroom is accepted with the exact applicability request; post-approval headroom is accepted in the Integration approval.
- A generic Application or Project profile may propose values but cannot grant headroom. Producer code, adapters, evaluators, environment variables, and retry logic cannot widen it.
- Headroom applies only to the exact direct owner and operation. It does not become a new default, carry to a retry, or survive a changed policy, family, subject, scope, target, Candidate, Effect, or owner version.
- Create the direct owner and its headroom approval in one fenced transaction using deferred reciprocal composite foreign keys. The headroom row references exactly that owner arm, operation fingerprint, and resolved-values fingerprint; the owner references exactly that approval. Neither row can commit, exist, or be reused without the other. A pre-decision proposal and human-readable view may exist earlier but grant no headroom.

### Production Counting And Exhaustion

- Every family producer and evaluator records one immutable `EvidenceResultLimitUsageId` for its exact observation or evaluation entry, stage `producer-result | evaluator-result`, immutable approved-limit binding, applicable dimensions, ceilings, retained counts, observed counts when known, count precision `exact | lower-bound`, elapsed evaluator milliseconds when applicable, and completion `complete | exhausted | timed-out`. Evaluation usage also has the normal evaluation-only typed dependency to that same binding; observation usage does not pretend to be an evaluation dependency.
- Check each next append against all applicable dimensions before retaining it. Stop at the first deterministic boundary that would exceed a ceiling. Preserve the ordered retained prefix or the family contract's explicitly defined deterministic subset; never retain an arbitrary scheduler-dependent subset.
- When several dimensions would be exceeded by the same next item, record every exhausted dimension in canonical dimension order. The first omitted ordinal belongs to the family's deterministic material order, not database insertion order.
- An exact omitted count is optional only when computing it would require work beyond the approved bounds. Otherwise record a lower bound. `unknown`, empty, or guessed omission values are prohibited.
- On data exhaustion, append `EVIDENCE_RESULT_LIMIT_EXHAUSTED` with family, stage, policy identity/version/fingerprint, approved owner, subject, scope, producer attempt when applicable, every exhausted dimension, ceiling, retained count, observed exact count or lower bound, omitted exact count or lower bound, first omitted ordinal when known, elapsed time, and retained Artifact links.
- Data exhaustion selects that family's exact truncation outcome. Add `ARTIFACT_STATE_TRUNCATED` for Artifact-state Evidence; `candidate-review` instead selects `CANDIDATE_BLOCKED` with required blocker kind `truncated`. Partial material remains inspectable but cannot support complete, clean, safe, applicable, approvable, accepted, or absent claims.
- Deterministic evaluator time starts only when every required input is locally available and validated for the evaluator. Producer, queue, process, test-command, Language-server, remote-reconciler, and cancellation times retain their own budgets.
- On evaluator timeout, append `EVIDENCE_EVALUATOR_TIME_EXHAUSTED` with the same authority and usage fields and select that family's broken verdict. Timeout is not a truncated data set, `TEST_TIMED_OUT`, or `LANGUAGE_OBSERVATION_UNCERTAIN`.
- Result-size exhaustion never resets or replaces ADR 0014 remediation/validation rounds or ADR 0015 cumulative conflict-lineage attempts. `FINDING_REMEDIATION_EXHAUSTED` and `CANDIDATE_CONFLICT_REPEATED` remain their distinct terminal blockers.
- There is no automatic retry on exhaustion or timeout. A retry requires the family's existing explicit rerun or owner retry authority. Default local-balanced values may reuse the immutable policy version under the retry's applicable direct owner. Any headroom, even unchanged values, requires a fresh exact headroom approval for the retry and a new direct owner identity where that owner's lifecycle requires one; prior headroom never carries forward.

### First Integration Applicability Capture

- Add immutable `IntegrationApplicabilityRequestId` owned by Integration and command `RequestIntegrationApplicabilityEvaluation`. It binds the exact Candidate/version/fingerprint, current technical Candidate-review decision, accepted Candidate user decision, Completion authorization, originating Run lifecycle version and cancellation check, `IntegrationTargetId`, Repository binding, working-tree-only mode, declared expected paths and dirty-target policy, proposed apply declaration and exact Effect/resource-key set, exact result-limit owner values, request fingerprint, and attributed requester.
- The command creates one inert read-only `IntegrationApplicabilityCaptureId`. It grants no Integration approval, attempt, mutation lease, Effect, process, credential access, remote access, cost, or mutation authority.
- The pre-approval target observer must be an in-process, strictly local, read-only adapter operating under the Repository coordination waterline. It captures tracked files, relevant untracked files, index, ref/HEAD, conflict state, dirty manifest, canonicalization version, and before/after consistency proof. If complete consistency cannot be proved without a process, credential, remote call, cost, mutation, or effect, the operation is unsupported and records the exact missing, uncertain, truncated, or broken observation without crossing that boundary.
- `RecordIntegrationApplicabilityCaptureOutcome` records only the Integration-owned attributed source envelope. Evidence then uses `RecordIntegrationTargetObservation` and `DecideIntegrationTargetEvaluation` with source kind `applicability-request` and the request as approved-limit owner. `DecideIntegrationApplicabilityEvaluation` consumes that exact current target fingerprint and the same request inputs.
- `SubmitIntegrationForApproval` requires current `INTEGRATION_APPLICABLE` Evidence for the exact non-superseded request and target fingerprint. The sealed approval request carries that `IntegrationApplicabilityRequestId`, applicability decision/version, target fingerprint, and complete approved limits. A changed Candidate, user decision, Completion authorization, Run lifecycle, target fingerprint, policy, limits, paths, dirty manifest, or apply declaration requires a new applicability request and evaluation.
- Key one `integration_applicability_request_current` row by exact Candidate identity/version, Integration target, and mode. `RequestIntegrationApplicabilityEvaluation` compare-and-sets that row and appends one immutable `integration_applicability_request_supersessions` row from predecessor to successor in the same transaction. If the predecessor has a pending or accepted Integration approval request but no nonterminal attempt, the same transaction appends `integration_approval_request_supersessions`, invalidates the old current `INTEGRATION_APPLICABLE` evaluation to `INTEGRATION_TARGET_STALE` or the exact changed-input verdict, and removes all start authority while preserving the user decision as history. A nonterminal attempt rejects replacement until it settles. The request-current row plus supersession anti-join proves `non-superseded`; timestamps and latest-row inference do not.
- After approval, preparation still obtains the exclusive mutation lease and captures the complete target again. Preparation and pre-apply observations use source kinds `preparation` and `pre-apply` with the Integration approval as limit owner. Either capture must equal the approved fingerprint by complete canonical field equality or settle no-effect with the exact stale, conflicting, truncated, missing, unsupported, or broken condition.

### Storage And Constraints

- Add local snapshot records `evidence_result_limit_policies`, `evidence_result_limit_policy_values`, and `evidence_result_limit_family_applicability` to each Evidence partition that consumes the Application policy. The external Storage-operation partition stores the same immutable local snapshot and source fingerprint because it cannot reference `slopstop.db`.
- Replace the two-arm dependency owner with root `evidence_approved_limit_bindings` and exactly one child in `evidence_approved_limit_binding_delegation_plans`, `evidence_approved_limit_binding_run_policy_epochs`, `evidence_approved_limit_binding_effect_declarations`, `evidence_approved_limit_binding_integration_applicability_requests`, or `evidence_approved_limit_binding_integration_approvals`.
- The binding root stores family, policy identity/version/fingerprint, resolved-values fingerprint, and optional headroom approval. Each child has a real same-partition composite foreign key to its direct owner and agrees on Project, operation, subject, scope, family, and owner version. Creation transactions and opening integrity checks require exactly one matching child. Producer and evaluator usage reference the binding. Evaluation-only `evidence_approved_limit_dependencies` reference the same complete binding tuple for reverse invalidation.
- Add `evidence_result_limit_usages` keyed by exact Evidence observation or evaluation entry and stage. Add ordered `evidence_result_limit_usage_dimensions` and `evidence_result_limit_exhaustions`. A complete usage prohibits exhaustion rows and requires every applicable retained count at or below its ceiling. Exhausted usage requires at least one exhaustion row and the family truncation outcome, including Candidate's exact verdict/blocker pair. Timed-out usage requires the evaluator stage, evaluator-time exhaustion diagnostic, and family broken verdict.
- Add `evidence_limit_headroom_approvals` with exactly one typed child for the same direct owner union and deferred reciprocal owner constraint. Create both sides atomically; no headroom row may be shared by several operations.
- Add Integration owner records `integration_applicability_requests`, `integration_applicability_request_current`, `integration_applicability_request_supersessions`, `integration_applicability_captures`, `integration_applicability_capture_outcomes`, and `integration_approval_request_supersessions`. Add ADR 0010 target-observation source `integration_target_observation_applicability_request_sources`; the three source arms are now applicability request, preparation, and pre-apply.
- Index approved-limit bindings by every typed owner plus family and policy fingerprint, and evaluation dependencies by binding plus evaluation entry. Index usage by family, policy, stage, completion, subject, scope, and recorded Project sequence or external operation ordinal. Index exhaustion by dimension and policy. Index Integration applicability requests by Candidate, target, request fingerprint, and current/superseding relation.
- Reverse invalidation follows ADR 0010. A changed policy version, resolved-values fingerprint, direct owner, headroom approval, or stricter Capability dependency invalidates only exact current dependent evaluations to their family stale or broken result; it never reinterprets historical usage.

### Local Telemetry And Promotion

- Record local telemetry only from terminal usage rows. Store family, policy version, dimension, applicable/not-applicable state, retained count, observed exact count or lower bound, exhaustion/timeout flag, evaluator elapsed milliseconds, bounded repository cohort identity, and product version. Do not store prompts, source text, model output, Artifact bytes, secrets, environment values, full local paths, repository names, or remote URLs.
- Local aggregation within the user's installation is permitted for product operation. Any external transmission requires separate explicit consent and a separately reviewed payload; this ADR grants none.
- The Application coordinator owns promotion review as product-policy publication, not Evidence truth. `BuildEvidenceResultLimitPromotionReport` reads only terminal usage counters through a versioned bounded query and creates one immutable sealed report plus one complete proposed-policy manifest containing the new policy identity, semantic version, confidence class, every ordered value, every family-applicability row, canonical encoding version, and fingerprint. `DecideEvidenceResultLimitPromotion` appends the attributed human decision over the exact report and proposed-policy-manifest hashes. `PublishEvidenceResultLimitPolicy` only copies that accepted manifest idempotently into the Application catalogue after reproducing the gates; it cannot choose or change a value, family row, identity, version, confidence class, or fingerprint.
- A promotion review seals its telemetry query/version, time window, policy version, exact active family set, per-family sample counts, repository-cohort counts, exclusions, percentiles, exhaustion rates, evaluator-time distributions, proposed-policy manifest, reviewer, decision, and canonical report-manifest fingerprint. A family is active when at least one terminal result under the reviewed policy exists in the cohort.
- The shared policy remains provisional while any active family has fewer than 200 terminal results, fewer than five human-confirmed materially different repositories, missing applicable-dimension data, unresolved truncation/timeout anomalies, or no human review. Distinct local Repository bindings alone are insufficient; the review must confirm material diversity without persisting identifying source data.
- A P99 claim for one family requires at least 1000 terminal results for that family, five materially different repositories, exact percentile computation over the sealed cohort, and human review. Families without that evidence remain unclaimed even if another family qualifies.
- Percentiles use only samples whose applicable observed count or elapsed time is exact. Lower-bound observations are censored samples: report them separately and never substitute the lower bound as an exact value. They still count as terminal results for the 200-result activity gate, but an unresolved censored or exhausted sample that could change a promoted threshold blocks stable promotion. A P99 claim requires at least 1000 exact samples for that family and dimension in addition to the family-level terminal-result gate.
- Activating a family not covered by a stable promotion review uses a provisional policy version until a later review covers it. Promotion creates a new immutable policy version and confidence class; it never relabels `0.1.0-local-balanced` or Evidence already bound to it.
- Store local promotion authority in `application.db` as `evidence_result_limit_promotion_reports`, `evidence_result_limit_promotion_report_families`, `evidence_result_limit_promotion_report_repository_cohorts`, `evidence_result_limit_promotion_report_dimensions`, `evidence_result_limit_proposed_policy_manifests`, `evidence_result_limit_proposed_policy_values`, `evidence_result_limit_proposed_policy_family_applicability`, and `evidence_result_limit_promotion_decisions`. The sealed report stores its bounded query version/fingerprint, source-project count, source-usage count, time window, profile fingerprint, aggregate counters, exact/censored counts, canonical report-manifest bytes capped at 256 KiB and their fingerprint, and no Project-scoped Artifact reference or prohibited source content. Published Application policy versions reference the exact accepted decision and proposed manifest. Project Evidence partitions later copy the immutable published policy identity/version/fingerprint through normal admission; no cross-database foreign key or transaction is claimed.

### Diagnostics And Proof Obligations

Use stable diagnostics `EVIDENCE_RESULT_LIMIT_POLICY_MISSING`, `EVIDENCE_RESULT_LIMIT_POLICY_STALE`, `EVIDENCE_RESULT_LIMIT_FAMILY_UNSUPPORTED`, `EVIDENCE_RESULT_LIMIT_CAPABILITY_UNSUPPORTED`, `EVIDENCE_RESULT_LIMIT_OWNER_MISSING`, `EVIDENCE_RESULT_LIMIT_OWNER_MISMATCH`, `EVIDENCE_RESULT_LIMIT_HEADROOM_REQUIRED`, `EVIDENCE_RESULT_LIMIT_EXHAUSTED`, `EVIDENCE_EVALUATOR_TIME_EXHAUSTED`, `EVIDENCE_RESULT_LIMIT_USAGE_BROKEN`, `INTEGRATION_APPLICABILITY_REQUEST_STALE`, `INTEGRATION_APPLICABILITY_CAPTURE_UNSUPPORTED`, and `INTEGRATION_APPLICABILITY_CAPTURE_INCONSISTENT`.

Implementation must prove through public family commands and direct queries:

- equality at each ceiling remains complete, while the next deterministic unit produces exact truncated usage and diagnostic metadata;
- every applicable dimension is counted and every non-applicable dimension is absent, not zero-filled;
- simultaneous dimension exhaustion records all dimensions in canonical order;
- exact and lower-bound omission forms preserve the same non-favorable authority;
- evaluator timeout selects each family's broken verdict and never its truncated verdict;
- all five owner arms enforce exactly one real child, direct-owner equality, immutable policy identity, and reverse invalidation;
- headroom without its exact user decision rejects before production and never retries automatically;
- the first Integration applicability capture can establish target Evidence without approval while crossing no process, credential, remote, cost, mutation, lease, or Effect boundary;
- preparation rechecks under the mutation lease and changed target state requires new applicability and approval;
- telemetry omits prohibited content and promotion cannot pass below any family or repository threshold.

## Consequences

### Positive

- Every Evidence family has one explicit bounded default and counting vocabulary without sharing verdict semantics.
- Exhaustion remains useful for inspection while never presenting partial proof as complete or clean.
- Non-Run Evidence and each Integration stage now have direct immutable limit owners.
- The first Integration fingerprint no longer depends circularly on an approval that itself requires that fingerprint.
- A measurable promotion gate keeps provisional local defaults honest.

### Negative

- Producers and evaluators must account for several overlapping dimensions and preserve deterministic omission metadata.
- Five direct owner arms and three Integration-target capture sources require more relational tables and constraints than one generic configuration reference.
- Conservative defaults may truncate legitimate large local work until the user explicitly approves operation-specific headroom.
- Stable production claims remain unavailable until real family telemetry exists.

## Rejected Alternatives

- **One byte limit for all results:** does not bound row-heavy, path-heavy, conflict-heavy, or anchor-heavy results.
- **Per-family unrelated profiles:** duplicates counting concepts and lets sibling schemas drift. One policy plus explicit applicability preserves a shared vocabulary without sharing verdicts.
- **Automatic headroom or retry with larger values:** converts a safety boundary into producer-controlled added power and hides the original truncation.
- **Reuse the Application or Project profile as the dependency owner:** a default can propose values but does not directly authorize one Run, Effect, or Integration operation.
- **Treat evaluator timeout as truncation:** a timeout proves no trustworthy evaluator completion, not a deterministic bounded result.
- **Create the first Integration attempt before approval:** grants lease-bearing operation identity too early and still confuses read-only applicability with mutation authority.
- **Capture the first target through Git subprocesses or remote calls:** crosses process or external-effect boundaries before an owner exists for those effects.
- **Promote from repository measurements alone:** local files and tests are only proxies and cannot support production percentile claims.

## References

- [ADR 0010: Typed Evidence Ledgers And Atomic Current Evaluations](0010-typed-evidence-ledgers-and-atomic-current-evaluations.md)
- [ADR 0011: Approved Run Preparation And Amendment Authority](0011-approved-run-preparation-and-amendment-authority.md)
- [ADR 0013: Effect Reconciliation And Recovery Journal](0013-effect-reconciliation-and-recovery-journal.md)
- [ADR 0014: Finding Validation, Remediation, And Recheck Authority](0014-finding-validation-remediation-and-recheck-authority.md)
- [ADR 0015: Parallel Worker Candidate Composition And Exact Integration](0015-parallel-worker-candidate-composition-and-exact-integration.md)
- [ADR 0016: Language Observation Intake And Evidence Authority](0016-language-observation-intake-and-evidence-authority.md)
- [Standing decision: degrade distinguishes broken](../../.rpiv/decisions/degrade-distinguishes-broken.md)
