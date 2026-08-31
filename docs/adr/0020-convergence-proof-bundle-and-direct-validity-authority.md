# ADR 0020: Convergence Proof Bundle And Direct Validity Authority

- Status: Accepted
- Date: 2026-08-31
- Decision owners: Pedro Mesquita
- Issue: [#75](https://github.com/TheMastermindPT/slopstop/issues/75)
- Research: [Convergence proof-bundle contract](../../.rpiv/artifacts/research/2026-08-30_23-53-59_convergence-proof-bundle-contract.md)

## Context

The v1 Convergence program consumes completed proof from several programs but does not own their behavior. ADRs 0009 through 0019 now define the Execution records, current Evidence authority, Completion authorization, Candidate provenance, Integration application proof, Effect ordering, result limits, and invalidation inputs that Convergence must inspect. No accepted decision defines how those records become one bounded, versioned delivery without being flattened into a new universal verdict or transition authority.

A bundle scoped only to one Run or Candidate is insufficient. The accepted proof-delivery matrix includes several Runs and owners, plus proof that is not a Candidate. A mutable report is also unsafe: current Evidence may be replaced after assembly, external Storage-operation Evidence cannot join a `slopstop.db` transaction, and equal hashes do not restore old authority.

The contract therefore needs one request-scoped immutable manifest, closed typed members, exact current-authority references, deterministic ordering, explicit limits and completeness, an inspection seam, and mandatory in-command validation for favorable consumption. Assembly and validation may explain upstream truth; they must not accept Evidence, complete a Run, accept a Candidate, approve or apply Integration, decide recovery, or make a release transition.

## Decisions

### Profile And Request Identity

- Adopt immutable profile `convergence-proof-bundle/0.1.0-local-balanced` as the v1 implementation and fixture default. Mark it `provisional-local` with low confidence. It is not production-derived.
- Give every profile an opaque `ConvergenceProofProfileId`, stable name, semantic version, canonical encoding version, confidence class, ordered typed request-subject requirements and cardinalities, ordered requirement-role definitions, freshness rules, limit values, privacy rules, and one fingerprint covering all fields.
- Keep the canonical profile catalogue in `application.db`. Before use, admit one immutable same-identity Project snapshot into `slopstop.db`. The copies agree by identity, version, canonical values, and fingerprint but claim no cross-database foreign key or transaction.
- A changed request-subject arm or cardinality, requirement role, freshness rule, ordering rule, limit, privacy rule, confidence claim, or canonicalization rule creates a new profile version and fingerprint. It never rewrites an earlier request or bundle.
- `RequestConvergenceProofBundle` atomically creates one immutable `ConvergenceProofRequestId` and its one stable opaque `ConvergenceProofBundleId`. The request binds one exact profile identity/version/fingerprint, attributed requester, Project, exact typed proof subjects, required time/revision window where applicable, and canonical request fingerprint. ADR 0006 idempotency settles exact retries once and rejects conflicting Command-ID reuse. A rejected request persists only its receipt, structured rejection, and idempotency settlement and creates neither identity; a later assembly failure retains both request and bundle root for another explicit version attempt.
- The request is inert read authority. It grants no upstream command, Run transition, Evidence decision, Candidate decision, Completion authorization, Integration approval or attempt, lease, Effect, process, credential, remote access, mutation, retry, headroom over an Evidence-family result, or release decision.
- An exact user-approved request-local bundle headroom decision may raise only the per-request limits below. It stores changed dimensions, old/new values, reason, one-request scope, request fingerprint, canonical approval view hash, and decision receipt. Create the request and headroom decision atomically. Project-cumulative ceilings require a promoted profile or future explicit retention decision and cannot be bypassed by request headroom. No profile name, environment variable, producer choice, or automatic retry grants headroom.

### Bundle Identity And Versions

- The bundle root allocated with its request owns explicit non-negative `ConvergenceProofBundleVersion` values. No assembly attempt allocates or replaces the root.
- Each version is immutable and append-only. It contains profile and request references, schema/canonicalization versions, member and causal-edge counts, canonical member-set and edge-set hashes, bundle-limit usage, assembly producer/version, Project sequence and Writer generation, and one canonical bundle fingerprint.
- The fingerprint covers bundle identity and version, bundle schema and canonicalization versions, assembly producer identity/version/implementation hash, profile and request fingerprints, every ordered member discriminant and exact reference, every causal edge, required-role satisfaction, limit usage, and all declared counts. Hashes prove exact bytes and sets; they never replace domain identity, version, lineage, or current authority.
- Canonical command idempotency uses ADR 0006's normalized immutable command fingerprint. An exact retry of one settled assembly command returns its first recorded attempt and bundle version or failure even when upstream authority later changes. Reusing its Command ID with another command fingerprint is a conflict. Every admitted assembly with a new Command ID is a distinct attributed observation and creates the next version even when the resolved manifest otherwise equals its predecessor; changed authority or any changed member, requirement, order, causal edge, limit, producer implementation, schema, or canonicalization rule likewise requires a new command and next version.
- A historical stale version never becomes usable again, even when later authority has equal content or digests. A fresh assembly must capture the new exact authority in another version.
- There is no favorable `current_bundle` pointer. Callers receive and validate one exact bundle identity/version. Latest timestamps and maximum version inference grant no authority.

### Closed Requirement And Member Model

Each profile contains ordered requirement roles. A role fixes one member kind; one selector from `required-run-epochs | run-sealed-invocations | invocation-attempts | declared-effects | derived-evidence-obligations | request-runs | repository-mutating-runs | request-integration-targets`; one cardinality from `exactly-one | exactly-one-per-subject | complete-set`; a non-negative minimum and maximum; freshness `immutable-history | exact-current-authority | immutable-lineage-with-current-tip`; and satisfaction `structural-record | trustworthy-terminal | exact-outcome-set`. An `exact-outcome-set` stores only values from the selected owner's closed vocabulary. Require `minimum <= maximum`. `exactly-one` requires both values to be `1`; `exactly-one-per-subject` emits one member for every distinct selector subject; `complete-set` emits every distinct member in the selector's closed dependency result. `immutable-lineage-with-current-tip` integrity-checks every immutable predecessor and requires the one marked final member per root subject to remain the owner's exact current pointer. A complete bundle satisfies every role exactly. Supporting members use separately declared roles and cannot compensate for a missing required role.

Use the closed root `ConvergenceProofMemberKind`:

| Member kind | Required contract | Authority retained by owner |
| --- | --- | --- |
| `run-authority` | Exact Run, accepted plan revision and Task DAG, profile, one policy epoch, contracts, discipline, approvals, budgets, workspace authority, fingerprints, and whether it is the request's final epoch. | Run preparation/amendment alone creates and activates plan/profile/epoch authority. |
| `sealed-invocation` | Exact Waypoint-parent or Worker seal, invocation-context record/hash, expected sequence, Task/workspace input, policy epoch, visible tools, provider/model, budget, and output schema. | Execution alone admits dispatch and creates attempts. |
| `execution-attempt` | Exact Model attempt, Tool invocation, Process job, or attributed terminal observation with its producer, owner, seal, command, usage, result, and Artifact references. | Execution and the typed owner retain lifecycle and semantic consumption. |
| `effect-chain` | Exact Effect declaration plus one checked `no-boundary-crossing | boundary-crossed-or-uncertain` lifecycle arm. The no-boundary arm carries every Journal fact that exists, conclusive current `EFFECT_NOT_STARTED`, and owner-specific proof/anti-joins that no physical boundary was crossed; it may include durable `started` and pre-boundary records. The other arm carries the actual Journal facts/ordinals, `started-before-boundary` observation, accepted `EFFECT_STARTED_UNSETTLED` decision/version, owner boundary/dispatch records when present, terminal observations, and current reconciliation decision. | Evidence decides current Effect outcome; the subject owner consumes it and decides its own lifecycle. |
| `current-evidence-authority` | One nested closed ADR 0010 family-current-key arm with the exact authority tuple and dependencies below. | The family alone evaluates, accepts, invalidates, and advances current authority. |
| `completion-authorization` | Exact contracts, Completion subject, Finding snapshot, current technical evaluation/decision, user acceptance, and immutable authorization. | Completion owns acceptance/authorization; Execution alone completes the Run after recheck. |
| `candidate-provenance` | Exact accepted `COMPOSITION_COMPLETE` decision, Candidate identity/version/scope/fingerprint, file manifest, baseline, and ordered predecessor-closed Worker-result membership. | Composition publishes the Candidate; Candidate user review remains separate. |
| `integration-application-proof` | Exact target, Candidate, approval inputs, Completion authorization, attempt, Effect decisions, before/expected/observed fingerprints, changed paths, lease release, and terminal application proof. | Integration alone approves, prepares, applies, and creates application proof. |

- The accepted local-balanced fixture profile is the v1 integrated MaxReps shape:

| Role position | Member kind | Selector and cardinality | Freshness | Satisfaction |
| ---: | --- | --- | --- | --- |
| `0` | `run-authority` | `required-run-epochs`, `complete-set`, minimum `1`, maximum `128` | `immutable-lineage-with-current-tip` | `structural-record` |
| `1` | `sealed-invocation` | `run-sealed-invocations`, `complete-set`, minimum `1`, maximum `128` | `immutable-history` | `structural-record` |
| `2` | `execution-attempt` | `invocation-attempts`, `complete-set`, minimum `1`, maximum `128` | `immutable-history` | `trustworthy-terminal` |
| `3` | `effect-chain` | `declared-effects`, `complete-set`, minimum `1`, maximum `128` | `exact-current-authority` | `trustworthy-terminal` |
| `4` | `current-evidence-authority` | `derived-evidence-obligations`, `exactly-one-per-subject`, minimum `1`, maximum `256` | `exact-current-authority` | `trustworthy-terminal` |
| `5` | `completion-authorization` | `request-runs`, `exactly-one-per-subject`, minimum `1`, maximum `64` | `exact-current-authority` | `structural-record` |
| `6` | `candidate-provenance` | `repository-mutating-runs`, `exactly-one-per-subject`, minimum `1`, maximum `64` | `immutable-history` | `structural-record` |
| `7` | `integration-application-proof` | `request-integration-targets`, `exactly-one-per-subject`, minimum `1`, maximum `64` | `immutable-history` | `structural-record` |

- Request subjects use the closed arms `run`, `integration-target-mode`, and `storage-operation`. The Run arm fixes Run, final policy epoch, accepted plan, Completion-contract revision, and exact Completion subject arm `candidate | non-repository-output`; the Integration arm fixes target, Candidate, mode, and terminal-proof requirement. The Storage arm fixes ADR 0013's exact `backup | export | migration | restore | import | runtime-reset | delete` operation child, `StorageOperationId`, `StorageId`, immutable request fingerprint, application-operation revision, Journal identity, and every operation-specific generation, snapshot, package, quarantine, or tombstone identity. Request subject keys are canonically ordered and unique; a duplicate Run, Candidate/target/mode, or Storage-operation/revision key rejects the request rather than creating another position.
- The accepted integrated profile requires `1..64` Run subjects, `1..64` Integration target/mode subjects, and `1..64` Storage-operation subjects. A different journey needs another versioned profile and cannot encode absence by omitting a required subject arm.
- `required-run-epochs` is the complete transitive set of policy epochs referenced by the request's final epochs, accepted carried-result classifications, seals, attempts, Worker results, Composition members, Candidates, Completion authorizations, Integration proofs, and all derived Project Evidence obligations. It marks exactly one final epoch per Run and cannot omit an older epoch that authorized a carried or Evidence member.
- Every owner-to-Evidence reference declares `immutable-consumed | exact-current`. `immutable-consumed` stays nested provenance in its owner member and is never reinterpreted as current. `derived-evidence-obligations` contains only the complete typed `exact-current` dependency closure of selected Run epochs, seals, attempts, Effects, Completion authorizations, Candidates, Candidate technical review, Candidate user decisions, Integration application proofs, and Storage operations, plus profile-declared subject-parameterized current queries. Assembly derives and de-duplicates obligations by partition, family, and complete native current key. The requester cannot add, remove, weaken, or relabel an Evidence obligation.
- For every terminal Integration proof, the applicability decision consumed before apply is `immutable-consumed`. The accepted profile instead derives the post-apply current Integration-applicability key that references the application proof and currently reports the owner's exact `INTEGRATION_ALREADY_APPLIED` or other terminal result. It never requires the intentionally replaced pre-apply `INTEGRATION_APPLICABLE` pointer to remain current.
- Profile-declared Evidence queries are closed functions of one exact request subject and profile query position. The integrated profile derives current Completion and Candidate-review Evidence from each Run, post-apply Integration authority from each Integration subject, current Effect authority from each declared Effect, and external current Effect/operation Evidence from each Storage subject. No profile query may scan an unbound Project-wide latest row.
- The seal, attempt, and Effect selectors form one predecessor-closed proof graph rooted at each selected Completion subject, terminal Integration proof, and Storage operation. `run-sealed-invocations` includes every seal that authorized a selected attempt or result; `invocation-attempts` includes every attempt referenced by those owner records; `declared-effects` includes every Effect referenced by those attempts, Completion, Candidate composition, and Integration. For Storage, it includes every Effect identity/declaration bound to the selected `StorageOperationId` and immutable request fingerprint whose own admission revision is at or before the subject's selected current revision, including superseded attempts and retries required by that operation's predecessor chain. Each member preserves its own admission revision. Unrelated abandoned Run or Storage history is not silently included, while every referenced predecessor is mandatory.
- Completion derives exactly once for every request Run from that Run's fixed Candidate or permitted typed non-repository subject. Candidate provenance derives only for the Candidate arm and cannot introduce an unrequested Run. Every Integration target must reference the exact Candidate fixed by one request Run.
- `trustworthy-terminal` means the selected owner completed its own record/evaluation and limit accounting without stale authority, missing record, truncation, evaluator failure, malformed proof, or undecided observation. It may carry an explicit non-favorable owner outcome such as a failed test or uncertain Effect. That outcome remains visible and may block a later release decision, but bundle assembly never reinterprets it as success or selects release policy.
- A future narrower or different journey needs another immutable profile version with its complete role matrix. A request cannot zero, omit, or weaken one of this accepted profile's rows.

- Every member root stores bundle/version, canonical position, requirement-role position, member kind, owner partition, freshness rule, member schema version, immutable observed record digest, and one typed child. Generic JSON, a polymorphic subject ID, a path, a digest-only member, or an untyped external reference is prohibited.
- A `current-evidence-authority` child selects exactly one partition arm. `project-current-authority` requires ADR 0010's stable `EvidenceCurrentAuthorityId` plus one complete family-current-key child in `slopstop.db`. `external-storage-current-authority` requires the Storage-operation partition identity, immutable request fingerprint, the Evidence row's accepted application-operation revision and Journal ordinal, the separately observed current Storage-owner operation revision/state, current-key tuple/version, and complete family key; ADR 0010 deliberately gives it no `EvidenceCurrentAuthorityId`.
- Both partition arms store family, subject/version, scope or Project-operation dependencies, input/result fingerprints, current version, evaluation identity/entry/digest, accepted decision identity/entry/digest, family verdict, evaluator/version/implementation hash, rule and Capability versions, trust basis, Artifact-state dependencies, approved-limit binding, and producer/evaluator usage references.
- Copied family verdicts are historical explanation only. They do not become a bundle verdict and cannot be interpreted without the family discriminator and exact current-authority recheck.
- `completion-authorization` and `integration-application-proof` members preserve their exact nested Evidence and user-decision references. `candidate-provenance` preserves immutable Composition and Candidate lineage; current technical Candidate review is a separately derived Evidence obligation, while user review remains in the Completion/Integration records that consumed it. None collapses those decisions into bundle-owned acceptance.
- The integrated local-balanced profile requires terminal Integration application proof. A future pre-Integration profile must be a separately versioned complete matrix; the request cannot weaken this row.

### Canonical Ordering And Causal Edges

- Assign every member a unique contiguous non-negative position. Role position fixes the root kind order `run-authority`, `sealed-invocation`, `execution-attempt`, `effect-chain`, `current-evidence-authority`, `completion-authorization`, `candidate-provenance`, `integration-application-proof` as `0..7`.
- Within a role, order by request-subject position and then its closed native key: Run authority by Run subject position, epoch number, and epoch identity; seals by target kind `waypoint-parent < worker`, target identity, expected sequence, and seal identity; attempts by owning seal position, kind `model < tool < process < terminal-observation`, owner sequence, and identity; Effects by subject kind `run-worker < project-operation < integration`, owner position, effect ordinal, and identity; Project Evidence by its lowest deriving request-subject position, source kind `owner-derived < profile-query`, source position (`0` for owner-derived, positive declared query position otherwise), ADR 0010 family declaration order, scope identity, canonical family-current-key bytes, and authority slot; external Storage Evidence by its Storage-subject position, the same source-kind/position order, operation-journal ordinal, ADR 0010 family order, and canonical current-key bytes; Completion and Candidate by Run subject position then authorization or Candidate version/identity; Integration by request target position, mode order, and application-proof identity. A shared Evidence obligation uses the lowest deriving subject position while retaining all deriving-subject links.
- Preserve each owner's native order as observed data: Execution owner-local expected sequence, `slopstop.db` Evidence `(project_sequence, entry_ordinal)`, Effect-local Journal ordinal, and external Storage-operation `(operation_journal_ordinal, entry_ordinal)`.
- Producer and recorded timestamps are explanatory only. They never select membership, current authority, order, or freshness.
- Store one ordered acyclic causal-edge set over distinct root-member positions. Every cross-member reference requires exactly one matching edge with one closed reason: `epoch-precedes-epoch`, `policy-authorizes`, `plan-owns-task`, `invocation-creates-attempt`, `effect-precedes-boundary`, `evidence-supports-owner-proof`, `composition-publishes-candidate`, `completion-authorizes-output`, or `integration-applies-candidate`. Conversely, every stored edge must be entailed by exactly one compatible typed cross-member owner relation, and that relation deterministically selects the reason; callers cannot submit an edge or reason. Evaluation/decision relations contained within one typed member are not root edges. Edge order is predecessor position, successor position, then this declared reason order; self-edges, duplicate tuples, fabricated edges, and an empty edge set when more than one member exists are prohibited.
- A same-partition Evidence dependency edge must agree with ADR 0010's earlier-entry constraint. An edge between partitions proves only the declared immutable identity/hash/request relation. It cannot claim a transaction, foreign key, total order, or timestamp order across databases.
- Canonical member and edge order, counts, and hashes are checked at assembly, opening integrity, and every direct validity query.

### Provisional Bundle Limits

The bundle is a delivery manifest, not a seventeenth Evidence family. Its profile and headroom do not alter ADR 0019's five direct Evidence-limit owner arms or any referenced family usage.

| Dimension | `0.1.0-local-balanced` value | Meaning |
| --- | ---: | --- |
| Canonical inline manifest | `262144` bytes (256 KiB) | Maximum canonical request, version, member, edge, and issue bytes; existing Artifact bytes are references only. |
| Typed members | `512` | Maximum retained member roots across all roles. |
| Causal edges | `2048` | Maximum retained typed predecessor/successor edges. |
| Deterministic assembly time | `30000` milliseconds | Maximum local monotonic time from admitted command start through source resolution, validation, canonicalization, and terminal settlement. |
| Deterministic validation time | `30000` milliseconds | Inspection: admission through final return. Favorable consumption: owner-command admission through validation and committed or rejected owner settlement before waterline release. |
| Bundle versions per request | `16` | Maximum immutable published versions under one request. |
| Assembly attempts per request | `64` | Maximum terminal complete, failed, exhausted, or timed-out attempts under one request. |
| Retained canonical bytes per request | `8388608` bytes (8 MiB) | Maximum request, attempts, usages, issues, versions, members, and edges retained under one request. |
| Bundle requests per Project | `256` | Maximum immutable request roots retained by one Project. |
| Retained canonical bundle bytes per Project | `268435456` bytes (256 MiB) | Maximum canonical Convergence request and bundle history retained by one Project. |

- Values are non-negative integers; `0` means zero permitted, not unlimited. Equality at a data ceiling remains complete. Exhaustion occurs only before appending the next required canonical unit.
- The manifest copies no prompt, source text, model output, secret, environment value, full local path, repository name, remote URL, credential, or Artifact bytes. It may store only approved opaque identities, versions, bounded enums, counters, ordinals, fingerprints, digests, and allowlisted diagnostics.
- Assembly records one immutable usage with ceilings, retained counts, exact observed counts when bounded work proves them, otherwise lower bounds, first omitted position when known, elapsed time, and `complete | exhausted | timed-out | broken`.
- Data exhaustion appends `CONVERGENCE_PROOF_BUNDLE_LIMIT_EXHAUSTED`, preserves an exact or lower-bound omitted count, and publishes no bundle version. A partial prefix is inspectable only through the failed assembly attempt; it is not a truncated but usable manifest.
- Assembly or validation timeout is broken because no trustworthy complete result exists. It is not an Evidence-family truncation verdict.
- There is no automatic retry or larger-limit fallback. Another attempt needs a new command; values above a per-request profile ceiling require the exact request-local headroom decision, while Project-cumulative ceilings cannot use request headroom.
- Reaching a cumulative request ceiling rejects another assembly with `CONVERGENCE_PROOF_HISTORY_LIMIT_REACHED` and no attempt/version write. Reaching a Project ceiling rejects another request or assembly before allocating identities or history. No deletion, compaction, rollover request, or new request may bypass these ceilings; future retention or promoted limits require a separate explicit decision.
- Promotion follows ADR 0019's evidence discipline without sharing its tables. Use separate `request-admission`, `assembly`, `validation`, and `project-history` cohorts. Request count and Project-retained bytes belong to `project-history`; versions, attempts, and per-request retained bytes belong to `assembly`; manifest/member/edge usage belongs to `assembly`; validation duration belongs to `validation`; request validation duration and subject cardinality belong to `request-admission`. Every promoted dimension requires at least 200 terminal samples for its cohort, five human-confirmed materially different repositories, complete applicable-dimension data, resolved exhaustion/timeout anomalies, exact/censored separation, and human review before a non-local profile. A P99 claim requires 1000 exact samples for that cohort and dimension plus the same repository/review gate; samples from another cohort or dimension cannot satisfy it.
- Bundle telemetry stores only profile/version, dimension, retained/observed exact or lower-bound counts, exhaustion/timeout, elapsed time, bounded anonymous cohort identity, and product version. External transmission requires separate consent; this ADR grants none.

### Assembly Completeness And Atomicity

- `AssembleConvergenceProofBundle` is a pure bounded local read followed by one terminal canonical transaction. It resolves the request's exact profile and subjects, expands every requirement role in canonical order, validates each source record and current-authority tuple, accounts for limits, builds edges, and computes canonical hashes in memory. A crash before the terminal transaction commits leaves neither attempt, command settlement, nor bundle version, so an exact Command-ID/fingerprint retry may recompute safely.
- A bundle version exists only when every role selector and cardinality is satisfied, every required source and digest is readable, every `exact-current-authority` member is exact current authority, every required family result has complete ADR 0019 usage, and every role's declared satisfaction predicate passes. A missing source record, stale authority, rejected Evidence proposal with no accepted current evaluation, unresolved conflict, truncated result, undecided observation, malformed proof, or broken producer/evaluator blocks publication.
- A family verdict keeps its own meaning. `trustworthy-terminal` may carry an explicit complete non-favorable or uncertain owner outcome; `exact-outcome-set` admits only its profile-owned closed values. Neither turns that outcome into success. Source unreadability is `member-unavailable`, while an upstream family's explicit `*_UNAVAILABLE` verdict remains inspectable under its own discriminator when the role admits it.
- Map stale authority to `authority-replaced`; rejected proposal, unresolved conflict, and undecided observation to their distinct `member-rejected`, `member-conflicting`, and `member-undecided` issues; missing source to `required-member-missing` or `member-unavailable`; and limit exhaustion to `member-truncated`. Preserve the exact owner/family state and diagnostic in every issue.
- A required data-exhausted family member makes assembly incomplete. An evaluator timeout, malformed reference, digest failure, unsupported schema, or broken source makes assembly broken. Broken never degrades to missing, empty, exhausted, or complete.
- Before source resolution, the Application coordinator acquires one bounded in-process read-admission waterline over the Project canonical writer and every participating external Storage-operation journal. It admits no new relevant mutation command while held, waits for active relevant operations to settle within the assembly deadline, opens external read transactions and local generation-fenced reads only after acquisition, and carries the Project writer admission into its own terminal settlement. That settlement is the only write admitted through the waterline. The waterline is neither a durable lease nor a cross-database transaction and grants no upstream write or Effect authority; a process crash produces no bundle.
- In `slopstop.db`, the terminal assembly transaction rechecks local current authority and fences the request, bundle version, all members/edges, usage, and complete assembly result under one Writer generation and Project sequence. External Storage-operation Evidence is read under its waterline-held application-operation revision and request fingerprint; the bundle stores its partition, revision, ordinals, identities, and digests. A later replacement after release may make the new bundle immediately non-usable and is caught by direct validation.
- A complete transaction writes terminal attempt, command settlement, version, members, edges, usage, and hashes atomically. A failed, exhausted, or timed-out transaction writes its terminal attempt, command settlement, exact typed issues, and usage but no bundle version, member, or edge rows. An unexpected transaction failure writes none of those records and cannot report a complete attempt.

### Direct Validity And Invalidation

`QueryConvergenceProofBundleValidity` is an inspection seam, not reusable command authority. It reports whether one exact bundle identity/version was usable at its observed waterline. Every command that would consume a favorable bundle must instead invoke the same private validation inside its own command admission, keep the waterline through its owner transaction and decision settlement, and release only after that settlement commits or rejects. The consumer stores the exact bundle version and observed partition fences but owns its decision; Convergence writes no release or upstream transition authority.

For either mode, the Application coordinator first acquires the bounded in-process read-admission waterline over all participating writers. If an active operation cannot settle or admission cannot close before the validation deadline, validation returns `failed`; it never validates skewed snapshots. Permit at most one active validation waterline per Project, coalesce an exact duplicate inspection, and retain no unbounded waiting queue. A mutation command already queued wins before another inspection validation; cancellation and queue wait count against the same deadline. For favorable consumption, the same deadline also covers the consuming owner's commit or rejection; expiry rolls back or rejects with no owner transition before releasing the waterline. While the waterline is held, validation opens one consistent read per partition and:

1. validates Project/request/profile identity, schemas, canonicalization versions, hashes, contiguous positions, counts, edge acyclicity, privacy contract, and stored limit usage;
2. validates every immutable-history member's exact identity, version, digest, and owner relation;
3. resolves each exact-current Evidence member through a query-only structural union of ADR 0010 family current tables;
4. for `project-current-authority`, requires exact equality of stable authority slot, family/current key, scope, current version, evaluation/decision identities and entries, both digests, limit binding, Artifact-state dependencies, and declared fingerprints;
5. checks direct pending-start and pending-observation anti-joins so an older favorable pointer cannot hide undecided work;
6. rechecks required Completion, Candidate, Run, and Integration invariants according to each member's declared freshness rule;
7. for `external-storage-current-authority`, requires exact equality of partition identity, request fingerprint, the Evidence row's accepted application-operation revision/Journal ordinal, the separately current Storage-owner operation revision/state, family/current key, current version, evaluation/decision tuple, digests, limits, and typed dependencies without requiring an unavailable authority slot;
8. rechecks every participating Writer generation and operation revision before releasing the waterline, then audits the observed Project sequence, external revisions, bundle identity/version, and exact returned issue set.

- Inspection returns `usable-at-observed-waterline` only when every check succeeds. Otherwise it returns `not-usable` with a closed ordered issue set: `authority-replaced`, `required-member-missing`, `member-incomplete`, `member-rejected`, `member-conflicting`, `member-undecided`, `member-truncated`, `member-unavailable`, `member-broken`, `integrity-broken`, or `external-partition-changed`. These issues denote a role, source, freshness, or integrity violation. A non-favorable or uncertain owner verdict admitted by `trustworthy-terminal` remains visible payload and creates no issue merely because it is non-favorable or uncertain.
- The top-level result is bundle usability, not an Evidence verdict. Every member issue preserves the upstream family, family verdict, owner, authority tuple, and diagnostic reference. No issue rewrites or normalizes that upstream meaning.
- If integrity or infrastructure fails before a complete issue set exists, return top-level `failed` with `CONVERGENCE_PROOF_VALIDATION_FAILED` or the more specific timeout diagnostic. It never returns `usable-at-observed-waterline`, `empty`, or an incomplete issue set as if complete.
- Reuse ADR 0017's existing same-database `evidence-current-evaluation-replaced` Canonical event for explanation. A Convergence-owned reverse index maps the event's exact previous authority tuple to affected bundle members. Evidence emits no bundle-specific event and never queries bundle dependants.
- Replacement-event lag, lookup failure, or missing asynchronous explanation cannot preserve usability because direct validation inside every favorable consuming command is mandatory. The event and reverse index own no bundle status or current pointer.
- External Storage-operation Evidence emits no ADR 0017 event. Direct comparison against its current authority and immutable partition history is the complete safety seam.
- A stale bundle remains immutable history. `ReassembleConvergenceProofBundle` is not a repair command; it is another explicit assembly command that creates a new version only after all current requirements pass.

### Queries And Forbidden Commands

Expose versioned read seams:

- `GetConvergenceProofBundle` returns one exact immutable version and typed members.
- `QueryConvergenceProofBundleValidity` returns inspection-only usability at one observed waterline or explicit failure; its result cannot authorize a later command.
- `ExplainConvergenceProofBundleIssue` joins immutable upstream history and generic replacement events without changing authority.
- `ListConvergenceProofBundleVersions` lists versions under one request/bundle identity and never chooses one as favorable.

Do not expose a generic member writer, bundle status setter, current-bundle pointer mover, Evidence verdict lookup, release-ready setter, event acknowledgement that implies validity, retry-with-headroom command, or command that lets Convergence accept Completion/Candidate/Integration or move Run/Worker/Effect/Recovery authority.

### Physical Records And Constraints

Add the following logical records:

| Partition | Records |
| --- | --- |
| `application.db` | `application_convergence_proof_profiles`, ordered typed request-subject requirements, ordered requirement roles, profile limits, promotion reports/decisions, and published profile manifests. |
| `slopstop.db` profile snapshot | `convergence_proof_profiles`, typed request-subject requirements/cardinalities, requirement roles, limit values, and source profile fingerprint. |
| Request | `convergence_proof_requests`, typed request subjects, optional request-local headroom approval, and exact decision receipt. |
| Bundle | `convergence_proof_bundles`, immutable versions, members, causal edges, set hashes, and fingerprints. |
| Typed members | One checked child for each root member kind, one checked Project/external partition child for current Evidence, plus one family-current-key child per ADR 0010 family. |
| Assembly | `convergence_proof_bundle_assembly_attempts`, usages, dimension counts, exhausted dimensions, and ordered typed issues. |
| Reverse explanation | Local `convergence_proof_bundle_evidence_dependencies` keyed by exact authority slot/version/evaluation/decision tuple and bundle member; external dependency indexes keyed by the checked Storage-operation locator and revision. |
| Telemetry/promotion | Privacy-bounded terminal counters and sealed proposed-profile manifests/decisions. |

- Key all Project records by `ProjectId` plus opaque identity. Use non-negative explicit versions and positions. Real same-Project composite foreign keys bind every local member to its exact owner/version and each current-Evidence member to its complete ADR 0010 tuple.
- Exactly one typed member child must agree with the root discriminant. A current-Evidence child requires exactly one partition child and one matching family-current-key child. Opening integrity checks reject missing, multiple, or mismatched children and prohibit an authority slot on the external arm.
- Make every request subject's canonical native key unique under its request. Make every role member's `(role_position, native_subject_key)` unique within a bundle version, and require its typed child owner key to equal that native key. Enforce role `minimum <= maximum`, the fixed `exactly-one` bounds, exact selector cardinality, derived Evidence de-duplication, one final epoch per Run, complete required-epoch closure including Evidence policy dependencies, one Completion subject per requested Run, and accepted profile subject-arm cardinalities during request/assembly settlement and opening integrity.
- Make `(project_id, convergence_proof_request_id)` unique to one bundle root and `(project_id, convergence_proof_bundle_id, bundle_version)` unique to one version. Make member positions and edge positions contiguous and unique within a version.
- Store external Storage-operation member locators as a checked typed arm with partition identity, operation identity, request fingerprint, Evidence-accepted operation revision/Journal ordinal, separately observed current owner revision/state, entry ordinal, record identity/version, and digest. It has no cross-database foreign key.
- Use `RESTRICT` or `NO ACTION` for immutable request, bundle, member, edge, upstream authority, event, and assembly history. Deleting physical Artifact bytes never deletes manifest identity or provenance.
- Index bundles by request/profile/version, members by role/kind/owner, Evidence dependencies by exact current-authority tuple, edges by predecessor/successor, attempts by request/result, and usages/exhaustion by profile/dimension/completion. Do not index timestamps for authority or generalized graph reachability.

### Diagnostics And Proof Obligations

Use stable diagnostics `CONVERGENCE_PROOF_PROFILE_MISSING`, `CONVERGENCE_PROOF_PROFILE_STALE`, `CONVERGENCE_PROOF_REQUEST_STALE`, `CONVERGENCE_PROOF_REQUIRED_MEMBER_MISSING`, `CONVERGENCE_PROOF_CARDINALITY_MISMATCH`, `CONVERGENCE_PROOF_MEMBER_SCHEMA_UNSUPPORTED`, `CONVERGENCE_PROOF_MEMBER_INTEGRITY_BROKEN`, `CONVERGENCE_PROOF_AUTHORITY_REPLACED`, `CONVERGENCE_PROOF_MEMBER_INCOMPLETE`, `CONVERGENCE_PROOF_MEMBER_REJECTED`, `CONVERGENCE_PROOF_MEMBER_CONFLICTING`, `CONVERGENCE_PROOF_MEMBER_UNDECIDED`, `CONVERGENCE_PROOF_MEMBER_TRUNCATED`, `CONVERGENCE_PROOF_MEMBER_UNAVAILABLE`, `CONVERGENCE_PROOF_MEMBER_BROKEN`, `CONVERGENCE_PROOF_BUNDLE_LIMIT_EXHAUSTED`, `CONVERGENCE_PROOF_HISTORY_LIMIT_REACHED`, `CONVERGENCE_PROOF_ASSEMBLY_TIMED_OUT`, `CONVERGENCE_PROOF_VALIDATION_TIMED_OUT`, `CONVERGENCE_PROOF_EXTERNAL_PARTITION_CHANGED`, and `CONVERGENCE_PROOF_VALIDATION_FAILED`.

Implementation must prove through public request, assembly, and query seams plus consuming-owner integration tests:

- opaque request/bundle identities remain distinct from fingerprints and equal hashes never restore stale authority;
- exact duplicate Command ID/fingerprint request or assembly is idempotent, a changed fingerprint conflicts for that Command ID, a rejected request writes no request/bundle identities, and every admitted new assembly command creates a new version even when its observed manifest repeats;
- every member arm, nested family-current-key arm, role cardinality, position, set hash, and causal edge is structurally complete;
- equality at each bundle ceiling remains complete and the next unit records exact/lower-bound exhaustion with no bundle version;
- assembly/validation timeout and malformed proof are broken, never absent, empty, truncated, or usable;
- crash injection before and during terminal assembly settlement proves that attempt, settlement, version, members, edges, usage, and hashes are all absent or all committed and that retry is safe;
- a required ADR 0019 truncated member blocks assembly while its family verdict remains unchanged;
- a complete trustworthy-terminal member with an explicit failed, unavailable, or uncertain owner outcome remains typed proof, does not become universal success, and does not fail assembly merely because its owner outcome is non-favorable;
- amended Runs include every epoch that authorized a seal, result, carried result, Candidate member, Completion authorization, or Integration proof, with exactly one final epoch per Run;
- replacing a requested Run's final epoch makes the lineage member non-usable without invalidating its intact historical predecessors;
- Effect chains accept only the checked no-boundary-crossing or boundary-crossed-or-uncertain arm, preserve any durable `started` fact in either arm, and never infer no effect from absent Journal rows;
- every requested Run has exactly one Candidate or permitted non-repository Completion subject and one matching Completion authorization, while Candidate provenance appears only for the Candidate arm;
- derived Evidence obligation closure cannot be weakened by request input and includes every current technical dependency of the selected owner records;
- consumed pre-apply Integration applicability remains immutable provenance while post-apply current authority is derived separately and checked directly;
- every Storage subject resolves its complete external Evidence closure through the exact operation arm/revision without a Run or cross-database foreign key;
- every Storage subject contributes all of its declared Effects and Journals through the selected current revision, including prior-revision attempts and retries under the same immutable request fingerprint, to the same predecessor-closed member graph;
- cumulative request and Project limits reject growth before allocating prohibited history and cannot be bypassed by another Command ID or request;
- same-database Evidence replacement makes validity non-usable immediately and ADR 0017's existing event explains it without a new bundle event;
- external Storage-operation replacement is detected without a cross-database transaction, event, timestamp order, or stale favorable fallback;
- the read-admission waterline either observes settled coherent partition revisions or fails within the applicable deadline; an inspection result authorizes nothing after release, while a favorable consumer validates and settles its own decision before release;
- every causal edge is both complete for and entailed by one compatible typed cross-member relation; no caller-supplied or fabricated edge passes validation;
- consumed Integration applicability does not invalidate an immutable terminal application proof merely because apply intentionally replaced applicability authority;
- Convergence cannot move any Evidence, Completion, Candidate, Integration, Run, Worker, Effect, Recovery, lease, or release authority;
- profile and telemetry records contain none of the prohibited private content and no promotion can pass below its sample/repository/review gate.

### Issue 75 Closure

| Ticket requirement | Explicit answer |
| --- | --- |
| Bundle identity | One stable opaque `ConvergenceProofBundleId` per immutable request, with append-only non-negative versions. |
| Required typed members | One versioned profile defines closed roles/cardinalities over eight member arms and ADR 0010's nested family-current-key union. |
| Current-decision references | Project Evidence stores and rechecks its stable slot/version/evaluation/decision/digest tuple; external Storage Evidence stores and rechecks its complete partition/revision/current-key tuple without inventing a slot. |
| Fingerprints | Canonical request, profile, member-set, edge-set, and bundle fingerprints cover exact identities, versions, order, counts, and schemas without replacing them. |
| Ordering | Explicit canonical member/edge positions preserve owner-local orders and causal edges without inventing timestamp or cross-partition total order. |
| Completeness | A version exists only when every profile role, cardinality, freshness rule, and satisfaction predicate passes; explicit non-favorable owner outcomes remain typed proof rather than a universal bundle failure. |
| Limits | Provisional per-manifest, time, per-request history, and Project-cumulative ceilings bound assembly, validation, versions, attempts, requests, and retained canonical bytes without changing ADR 0019 family authority. |
| Invalidation | Direct current-authority validation inside every favorable consuming command makes old versions non-usable immediately; generic ADR 0017 replacement events provide same-database explanation only. |
| Query seams | Exact get, inspection-only validity, explanation, and version-list queries own no status, verdict, replay, or transition authority. |
| Owner separation | Completion, Candidate, Integration, Execution, Evidence, Effect/Recovery, and future release decisions remain with their existing or future explicit owners. |

## Consequences

### Positive

- Convergence receives one bounded, inspectable proof delivery without becoming a second Evidence or transition authority.
- Exact current-decision equality prevents a sealed but stale report from remaining favorable.
- Requirement profiles support integrated journeys and narrower requests without an implicit all-green rule.
- Reusing ADR 0017 replacement events avoids duplicate facts and Evidence-to-Convergence coupling.
- Separate manifest limits prevent bounded family results from becoming unbounded in aggregation.

### Negative

- Assembly and every favorable consuming command pay bounded multi-owner relational validation cost.
- Eight typed member arms, family-current-key children, causal edges, external locators, and reverse indexes require substantial schema and fixture work.
- Cross-database Storage proof can become stale immediately after assembly because no distributed transaction exists; direct validation remains mandatory.
- The provisional profile may reject legitimate integrated journeys until privacy-safe telemetry supports recalibration or the user approves request-local headroom.

## Rejected Alternatives

- **One bundle per Run or Candidate:** cannot represent the cross-program Convergence proof-delivery matrix or non-Candidate proof.
- **One mutable current report:** hides historical authority changes and turns a projection into a second truth path.
- **Copy all upstream payloads:** breaks privacy and Artifact bounds while duplicating owner state.
- **One generic pass/fail verdict:** erases family-specific missing, stale, truncated, uncertain, and broken meanings.
- **Trust the sealed fingerprint forever:** hashes prove bytes, not current authority.
- **Emit a bundle-specific invalidation event:** duplicates ADR 0017's generic replacement fact and makes Evidence enumerate Convergence dependants.
- **Use ADR 0019 as a sixth Evidence-family owner:** the manifest is not an Evidence result and must not widen the five-arm authority union.
- **Infer order from timestamps or force one order across databases:** neither is an authority or transaction boundary.
- **Publish partial bundles on exhaustion:** allows incomplete proof to masquerade as a selectable version.

## References

- [ADR 0007: Supervised Execution Aggregate Ownership](0007-supervised-execution-aggregate-ownership.md)
- [ADR 0009: Provider-Neutral Agent Runtime And Turn Contracts](0009-provider-neutral-agent-runtime-and-turn-contracts.md)
- [ADR 0010: Typed Evidence Ledgers And Atomic Current Evaluations](0010-typed-evidence-ledgers-and-atomic-current-evaluations.md)
- [ADR 0011: Approved Run Preparation And Amendment Authority](0011-approved-run-preparation-and-amendment-authority.md)
- [ADR 0012: Test-First Completion Proof](0012-test-first-completion-proof.md)
- [ADR 0013: Effect Reconciliation And Recovery Journal](0013-effect-reconciliation-and-recovery-journal.md)
- [ADR 0015: Parallel Worker Candidate Composition And Exact Integration](0015-parallel-worker-candidate-composition-and-exact-integration.md)
- [ADR 0017: Evidence-To-Memory Invalidation And Trusted Read Authority](0017-evidence-to-memory-invalidation-and-trusted-read-authority.md)
- [ADR 0019: Measured Evidence Result Limits And Approval Authority](0019-measured-evidence-result-limits-and-approval-authority.md)
- [Standing decision: degrade distinguishes broken](../../.rpiv/decisions/degrade-distinguishes-broken.md)
- [V1 program requirements coverage](../../.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md)
- [Convergence proof-bundle research](../../.rpiv/artifacts/research/2026-08-30_23-53-59_convergence-proof-bundle-contract.md)
