# ADR 0017: Evidence-To-Memory Invalidation And Trusted Read Authority

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

ADR 0010 makes each Evidence family the sole owner of its observations, evaluations, decisions, and exact current evaluation. Verified Memory may preserve a claim accepted against that authority, but it cannot become a second truth path. When any required Evidence decision stops being current, the affected Memory Revision must stop participating in trusted retrieval without waiting for an asynchronous projection to catch up.

Evidence and Verified Memory both live in the Project's `slopstop.db`. A Runtime handoff, cross-database outbox, or distributed transaction would invent a boundary that does not exist. The remaining contract needs one durable replacement event, exact Memory-owned dependency bindings, immediate read-time validation, idempotent asynchronous settlement, and explicit failure containment.

This decision defines that contract. It does not define Memory proposal generation, search ranking, library presentation, or post-v1 revocation and deletion. It also replaces the earlier issue `#13` suggestion that unchanged claim text could add verification to the same stale revision: re-verification always creates a new Memory Revision.

## Decisions

### Authority And Boundary

- Evidence owns current-authority replacement and the Canonical event emitted by that replacement. It never queries Memory dependants, writes Memory state, or decides whether a claim remains trusted.
- Memory owns immutable Memory Revisions, mandatory Evidence dependencies, informational Evidence references, revision trust, invalidation settlement, and trusted retrieval. It never interprets or changes an Evidence verdict or current pointer.
- The Application coordinator schedules consumption and submits typed Memory commands. Scheduling grants no Evidence or Memory authority.
- This same-database path uses neither Runtime handoff tables nor ADR 0013 Effect and Recovery Journal machinery. Canonical events notify and audit; replay never rebuilds Evidence or Memory authority.

### Canonical Replacement Event

Use Canonical event type `evidence-current-evaluation-replaced` version `1`. Every `slopstop.db` transaction that replaces a non-null current Evidence evaluation inserts exactly one event per replaced current row in the same transaction.

The event envelope uses ADR 0006's opaque `EventId`, command receipt, Project sequence, event ordinal, aggregate reference and version, event type and version, canonical payload, and payload hash. The aggregate reference is ADR 0010's stable `EvidenceCurrentAuthorityId`, while the aggregate version is the replacement current version; the required family-subject child proves the exact family-and-scope current row owning that stable slot. Its required relational child contains:

| Group | Required contract |
| --- | --- |
| Current key | Evidence family, exact `EvidenceScopeId`, and the family-owned subject key required to resolve that current row. |
| Previous authority | Previous current version, evaluation identity and `EvidenceEntryId`, accepted decision identity and `EvidenceEntryId`, and both immutable record digests. |
| Causal decision | The exact newly accepted family decision and Evidence entry that displaced the previous authority. |
| Replacement authority | Replacement current version, evaluation identity and `EvidenceEntryId`, accepted decision identity and `EvidenceEntryId`, and both immutable record digests. |
| Structural cause | Exactly `mandatory-evidence-no-longer-current`. |

- The causal decision is the replacement authority's accepted decision in version `1`; storing the explicit role keeps the payload evolvable without a free-text cause.
- The payload contains no claim text, Evidence payload, Artifact bytes, source text, path, prompt, model output, diagnostic body, credentials, machine location, free-text reason, or copied family verdict. Detailed explanation remains in immutable Evidence history.
- The typed relational child, canonical payload, and payload hash must agree. Opening integrity checks reject a mismatch.
- Establishing a family's first accepted current evaluation emits no replacement event. A rejected proposal that changes only `latest_*` emits none.
- A command replacing several current rows emits one event per row. The events share the receipt and Project sequence and use distinct deterministic ordinals from the command's closed affected-row order.
- A committed non-initial current replacement without its exact event is a canonical integrity failure. No separate `PublishMemoryInvalidation` command exists.

### Mandatory Dependencies And Informational References

- Every accepted Memory Revision has one immutable non-empty mandatory dependency set. Each member root selects exactly one family-current-key child. That child binds one exact Evidence family, scope, complete family current key, current version, evaluation identity and entry, accepted decision identity and entry, and both record digests observed at acceptance through real family-owned composite foreign keys.
- The dependency-set root records schema and canonicalization versions, member count, and an ordered set hash. The root, all members, and the accepted trust state are created atomically.
- The Memory acceptance command rechecks in the Writer transaction that every member is the exact current accepted authority for its family key and is eligible under the accepted Memory verification policy. A concurrent Evidence replacement rejects acceptance.
- Changing claim semantics, applicability scope, limitations, verification policy, or mandatory Evidence selection creates another Memory Revision.
- Informational Evidence references use a separate relation. They provide provenance and navigation but never enter the mandatory-set hash, invalidation lookup, effective-trust query, or trusted-retrieval eligibility.
- Evidence stores no `MemoryId` or `MemoryRevisionId`. Memory's reverse dependency index maps one previous Evidence authority to its affected revisions.
- V1 mandatory dependencies reference only same-Project Evidence in the same `slopstop.db`. External Storage-operation Evidence needs a future explicit cross-database contract before it can become mandatory Memory authority.

### Memory Revision Trust

Use the Memory Revision trust states `accepted`, `stale`, and `broken`.

- `accepted` means the revision was explicitly accepted after its complete mandatory dependency set was proved current.
- Any mandatory member ceasing to equal exact current Evidence authority makes the revision effectively stale immediately and eventually materializes `accepted -> stale`.
- `stale` is terminal for that revision. Re-verification creates and explicitly accepts a new revision; it never restores the old revision.
- `broken` is reserved for Memory-owned integrity or proof failure, including a revision digest failure, malformed or incomplete dependency set, count or set-hash mismatch, invalid trust transition, or settlement-target mismatch.
- A replaced Evidence decision makes the old Memory Revision stale regardless of whether the replacement is favorable, stale, missing, rejected, ambiguous, truncated, or broken. Evidence replacement never makes the Memory Revision broken by itself.
- Memory Topics have no trust state.
- Every materialized trust transition is append-only, references its command receipt and Project sequence, and preserves prior state, next state, cause, and source invalidation event. The transition is directly queryable and does not emit a second Canonical event.
- If several replacement events affect one accepted revision, the earliest applicable event by `(project_sequence, event_ordinal)` causes the sole stale transition. Later events remain settled history without another transition.

### At-Least-Once Settlement

The coordinator queries replacement events without completed Memory settlement and submits `SettleMemoryInvalidationEvent` with source `EventId`, expected payload hash, consumer contract version, and the exact affected Memory Revision identities and trust versions found through the reverse dependency index. The kernel recomputes that set inside the fenced transaction.

- First delivery verifies the Canonical event, relational child, payload hash, referenced Evidence records, canonical order, and complete affected set.
- Every still-accepted affected revision transitions atomically to stale. Already-stale or broken revisions receive an immutable target outcome without another trust transition.
- Target outcomes and the event settlement commit in one transaction. A stale version, changed target set, broken reference, ordering conflict, or fan-out-limit breach writes no partial result.
- Settlement is unique by `EventId` and stores the canonical payload hash. Exact redelivery returns `unchanged`; the same ID with another supplied hash returns `MEMORY_INVALIDATION_EVENT_HASH_CONFLICT` and changes no Memory state.
- If the stored event, typed child, or stored hash disagree, Project persistence enters recovery rather than treating the delivery as an ordinary hash conflict.
- An earlier applicable event for one revision must settle before a later overlapping event. This fence does not block events whose affected revision sets are disjoint.
- An event with no mandatory Memory dependants receives a valid zero-target settlement.

### Trusted Read Authority

Every trusted Memory query uses one consistent `slopstop.db` read transaction and performs these steps before ranking, handoff construction, or prompt inclusion:

1. Validate Project identity, caller authorization, applicability scope, and read budget.
2. Select candidate revisions whose materialized trust state is `accepted`.
3. Validate each revision digest and its mandatory dependency-set schema, count, ordering, and set hash. A failure here is Memory-owned broken proof: return `failed`, expose effective `broken`, and schedule the typed broken command rather than continuing authority comparison.
4. Resolve every mandatory dependency against a query-only structural union of ADR 0010's family current tables.
5. Require exact equality of family, scope, family current key, current version, evaluation identity and entry, accepted decision identity and entry, and both stored record digests.
6. Treat an otherwise integrity-valid dependency that no longer equals current Evidence authority as effective `stale` immediately, even if asynchronous settlement has not materialized the transition.
7. Exclude informational Evidence references from eligibility.
8. Apply ranking and count or token limits only after proving trust eligibility.
9. Audit the observed Project sequence and exact returned Memory Revision and dependency authorities.

The structural union contains only identity, family, scope, current version, evaluation, and decision references. It owns no current pointer and defines no universal Evidence verdict.

Trusted retrieval results remain `complete`, `empty`, `truncated`, or `failed`. `empty` requires a complete eligible query with no match. Unreadable authority, unsupported schema, incomplete proof, or query failure is `failed`; it never degrades to empty, accepted, or clean. Explicit stale-history inspection remains available but cannot enter a trusted handoff or satisfy an Evidence gate.

### Failure Containment And Recovery

- A valid event that the current consumer version cannot permanently settle records one attributable consumer failure with the exact event, hash, consumer version, one closed diagnostic code, allowlisted bounded metadata, and affected revisions. Diagnostic records contain no event payload, Evidence content, claim, prompt, model output, source text, path, credential, environment value, or machine location. The event remains unsettled and a repaired consumer version may retry it.
- Such a failure makes only the affected revisions effectively stale and creates visible Attention. Unrelated revisions and disjoint events remain usable.
- Attention is a direct projection over unresolved consumer failures anti-joined to a later valid settlement. It is not another mutable status.
- A consumer failure does not make a Memory Revision broken. `broken` requires Memory-owned integrity failure.
- Canonical event parse failure, missing typed child, invalid Project or event order, foreign-key mismatch, payload-hash mismatch, or unreadable Evidence ledger places canonical Project persistence into the applicable `recovery-required`, `corrupt`, `unsupported-newer`, `unavailable`, or `broken` state. Unreadable Memory rows or broken relational constraints do the same. A readable and structurally bound Memory Revision with an invalid revision digest or dependency-set count/hash is instead isolated as effective Memory `broken`; trusted retrieval returns `failed` for that revision and submits `MarkMemoryRevisionBroken` without blocking unrelated Project state. Opening remains read-only only for the Project-wide cases and never creates fresh defaults.
- Startup directly queries unsettled replacement events and unresolved failures. It does not replay unrelated Canonical events or infer completion from timestamps.

### Commands And Transactions

| Command role | Atomic behavior |
| --- | --- |
| Existing `Decide<Family>Evaluation` | When accepting a replacement for non-null current authority, write the evaluation, decision, current advance, Canonical replacement event, and typed child together. |
| Existing `Invalidate<Family>CurrentEvaluation` | Install the exact non-favorable replacement and the same replacement event without writing Memory. |
| Memory revision acceptance | Create the immutable revision, complete mandatory dependency set, informational references, and accepted trust state only after same-transaction Evidence recheck. |
| `SettleMemoryInvalidationEvent` | Verify event and complete affected set, append applicable stale transitions, and write target outcomes plus final settlement, or change nothing. |
| `RecordMemoryInvalidationConsumerFailure` | Record one attributable permanent failure and its exact target set without settling the event or changing Evidence. |
| `MarkMemoryRevisionBroken` | Require exact Memory-owned integrity proof and expected trust version; Evidence replacement is not a valid broken cause. |
| Trusted Memory query | Read and audit effective trust without moving any Memory or Evidence pointer. |

Do not expose a generic Memory state setter, generic event acknowledgement, universal Evidence verdict lookup, dead-letter command that marks failure as settled, or command that lets Memory alter Evidence authority.

### Physical Records And Constraints

ADR 0017 adds these logical families to `slopstop.db`:

| Owner | Tables |
| --- | --- |
| Minimum Memory roots | `memory_topics`, `verified_memories`, `memory_revisions`, `memory_revision_verification_policies`, `memory_revision_acceptance_decisions` |
| Typed Evidence event | `evidence_current_evaluation_replacement_events` plus one checked family-subject child per ADR 0010 current-key family |
| Mandatory dependencies | `memory_revision_evidence_dependency_sets`, `memory_revision_mandatory_evidence_dependencies` plus one checked family-current-key child per ADR 0010 family |
| Informational provenance | `memory_revision_informational_evidence_references` |
| Revision trust | `memory_revision_trust_states`, `memory_revision_trust_transitions` |
| Event settlement | `memory_invalidation_event_settlements`, `memory_invalidation_event_targets` |
| Permanent consumer failure | `memory_invalidation_consumer_failures`, `memory_invalidation_consumer_failure_targets` |

- The minimum roots make this contract relationally complete without defining the deferred proposal, claim-content, search, ranking, or deletion schemas. Key Topics, memories, revisions, and acceptance decisions by Project plus opaque identity. A revision references one memory, immutable claim/applicability/limitation digests, author, and provenance. Its one-to-one verification-policy child stores the closed policy schema/version, canonical policy fields, and digest accepted for that revision; it is revision-owned rather than a reusable authority. The acceptance decision is explicitly user-authorized and unique per revision; the same transaction creates accepted trust, the policy child, and the complete mandatory dependency set.
- Key replacement-event roots by `(project_id, event_id)` and require one exact `canonical_events` row of the declared type and version. Its aggregate reference uses the stable `EvidenceCurrentAuthorityId` from ADR 0010's common `evidence_current_authority_slots` root and the replacement current version. Exactly one `evidence_current_evaluation_replacement_<family>_subjects` child must match the root's family and reference that slot plus the complete prior and replacement current-key tuples.
- Make each prior and replacement evaluation-and-decision tuple unique per current replacement. Previous, causal, and replacement entries must share Project, family, scope, and family current key.
- Key dependency-set roots one-to-one by Memory Revision. Key member roots by revision and non-negative position, make each exact evaluation-and-decision tuple unique within a revision, and require at least one member. Each root selects exactly one `memory_revision_mandatory_<family>_dependencies` child whose composite foreign keys bind the complete ADR 0010 family current key, scope, version, evaluation, and accepted decision; a generic subject ID or JSON current key is prohibited.
- Key trust state one-to-one by revision. Make `(project_id, memory_revision_id, trust_version)` unique for transitions; a stale transition references one exact source event.
- Key settlement one-to-one by event. Store payload hash, consumer contract version, settling receipt and Project sequence, target count, and target-set hash. Key targets by event and position with outcomes `staled`, `already-stale`, or `already-broken`.
- Key consumer failures by opaque identity and exact event/hash/consumer version. Failure targets are unique by failure and Memory Revision.
- Use real same-Project composite foreign keys and `RESTRICT` or `NO ACTION` for immutable Event, Evidence, Memory, transition, and settlement history. Hashes prove records and sets; they never replace identity or ordering.

Required direct indexes cover replacement events by Project order and prior or replacement Evidence authority; mandatory dependencies by exact Evidence evaluation and decision; trust state and transitions by revision; settlements and unresolved failures by event and affected revision. Unsettled work is the replacement-event anti-join to settlement, never a global consumer cursor.

### Acceptance Proofs

| Proof | Required observation |
| --- | --- |
| Atomic replacement | Fault injection exposes either old current authority with no event, or replacement authority with exactly one valid event. |
| Initial and rejected evaluations | First accepted authority and latest-only rejection emit no replacement event. |
| Multi-row replacement | Replacing `N` current rows creates `N` ordered events under one receipt and Project sequence. |
| Privacy and integrity | Events contain only the declared identities, versions, hashes, and cause; altered payload or relational child places Project persistence in read-only recovery and never returns empty or trusted Memory. |
| Delivery lag | Paused consumption leaves materialized state accepted while trusted read and the library expose effective stale and exclude the revision. |
| At-least-once delivery | Repeated Event ID/hash creates one settlement and at most one trust transition. |
| Terminal stale | Re-verification creates a new accepted revision while the prior revision remains stale. |
| Mandatory versus informational | Replacing a mandatory dependency stales the revision; replacing only an informational reference does not. |
| Failure classification | Any Evidence replacement stales the old revision; only broken Memory proof uses Memory `broken`. |
| Acceptance race | Evidence replacement between proposal review and acceptance rejects the Memory command without an accepted revision. |
| Ordering | Overlapping events delivered out of order retain the earliest canonical event as the stale cause. |
| Consumer failure | Only affected revisions are excluded, Attention is visible, unrelated Memory remains trusted, and the event remains unsettled. |
| Restart | Direct indexed queries recover unsettled events and unresolved failures without generic replay. |

### Issue 76 Closure

| Ticket requirement | Explicit answer |
| --- | --- |
| Event identity and payload | One opaque Canonical Event ID and typed relational child per replaced current evaluation, with exact prior, causal, and replacement Evidence authority. |
| Ordering and idempotency | Canonical Project sequence and event ordinal; at-least-once settlement is unique by Event ID and verified payload hash. |
| Invalidation reason | Closed `mandatory-evidence-no-longer-current`; detailed explanation remains Evidence-owned. |
| Stale transition | Any mandatory dependency replacement causes terminal `accepted -> stale`; re-verification creates a new revision. |
| Trusted-read safety | Every trusted query directly proves that all mandatory Evidence decisions remain exact current authority. |
| Delivery lag and recovery | Effective stale is immediate; materialization may catch up asynchronously, while attributable failures are revision-scoped and ledger failures enter persistence recovery. |
| Privacy and separation | Events copy no private Evidence content; Evidence never writes Memory and Memory never changes Evidence authority. |

## Consequences

- Trusted Memory cannot remain usable merely because asynchronous materialization is delayed.
- Evidence replacement gains one small typed Canonical-event write per replaced current row.
- Trusted reads pay a bounded relational validation cost proportional to returned revisions and their mandatory dependencies.
- Stale history, exact causes, duplicate deliveries, and consumer failures remain inspectable without giving event replay authority.
- The contract adds tables and indexes, but avoids a distributed transaction, duplicate Evidence truth, or global Memory outage for one attributable consumer failure.
- ADR 0020 may use the generic replacement event and exact previous-authority tuple to explain a stale Convergence proof-bundle member. It adds no bundle-specific Evidence event and never substitutes event delivery for direct validity.

## References

- `PRODUCT.md`
- `CONTEXT.md`
- `docs/adr/0006-physical-persistence-layout.md`
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md`
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md`
- `docs/adr/0016-language-observation-intake-and-evidence-authority.md`
- `docs/adr/0020-convergence-proof-bundle-and-direct-validity-authority.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md`
- [Issue #13: Charter the verified-memory program](https://github.com/TheMastermindPT/slopstop/issues/13)
- [Issue #76: Define the Evidence-to-Memory invalidation event contract](https://github.com/TheMastermindPT/slopstop/issues/76)
