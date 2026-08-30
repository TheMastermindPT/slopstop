# ADR 0018: Artifact Retention Quotas, Reservations, And Explicit Removal

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

ADR 0010 gives every bounded local Artifact an immutable identity, provenance, expected byte length, and Evidence-owned current availability, integrity, and retention state. It preserves identity and provenance after byte removal and prohibits age or quota from deleting bytes automatically. ADR 0013 makes removal a journalled `project-operation` Effect whose accepted Effect and Artifact-state decisions both precede deletion. ADR 0015 separately owns Run-resource cleanup, while ADR 0005 owns Storage generations, backups, restore, and deletion.

Issue 77 fixes the remaining numeric Artifact-retention policy: one immutable provisional local profile, logical Project and physical installation accounting, durable capacity reservations, a volume free-space floor, purpose- and dependency-aware age eligibility, explicit user removal decisions, and hard admission blocking without automatic deletion.

No production Artifact store or representative workload exists. The values are low-confidence guardrails, not benchmarks, and must be recalibrated before the profile can lose its provisional label.

## Decisions

### Scope And Authority

- Apply this decision only to local bytes represented by ADR 0010 Artifact identities in a SlopStop-managed Artifact store. Include local imported, historical, and research copies but never their external source.
- Exclude Run-workspace resources, Candidate materializations, validation copies, Storage generations, backups, exports, Git repositories, and provider-owned data. Their owners retain their existing policies.
- The Application coordinator remains the sole command and committed-action authority.
- Application policy owns the profile catalogue, installation default selection, installation observations, and installation reservations in `application.db`.
- Project policy owns one immutable selected-profile decision, Project usage reports, and Project reservations in `slopstop.db`.
- Evidence owns Artifact retention purpose, byte holds, retention proposals and decisions, Artifact-state authority, and removal eligibility.
- Only an explicit user command may select a profile, approve removal, defer, retain, reject, or release a user hold. The coordinator may measure, block, diagnose, and propose but never decide for the user.
- Runs, Workers, models, providers, adapters, and Artifact producers cannot override policy, quotas, floor, holds, proposals, or decisions.

### Immutable Provisional Profile

Register this exact built-in profile:

| Field | Value |
| --- | ---: |
| Name | `0.1.0-local-balanced` |
| Confidence | `low` |
| Calibration state | `provisional` |
| Project logical-byte Attention | 8 GiB |
| Project logical-byte hard admission | 10 GiB |
| Installation physical-byte Attention | 24 GiB |
| Installation physical-byte hard admission | 30 GiB |
| Project Artifact ID Attention | 40,000 |
| Project Artifact ID hard admission | 50,000 |
| Installation Artifact ID Attention | 200,000 |
| Installation Artifact ID hard admission | 250,000 |
| Generated-output eligibility | 30 hold-free days |
| Generated-output age Attention | 90 hold-free days |
| Volume free-space floor | `max(2 GiB, 2% of volume capacity)` |

- `GiB` is exactly 1,073,741,824 bytes. Every size and count is a non-negative integer.
- Profile identity and fingerprint cover every value, unit, purpose rule, trigger rule, and accounting-schema version.
- Application and Project decisions select a whole immutable profile. A Project snapshot records the selected values and fingerprint because no cross-database foreign key exists.
- Recalibration creates a new identity and name. It never changes this profile or historical decisions, reservations, proposals, or removals.
- Missing, unknown, stale, mismatched, or broken profile authority blocks new Artifact-byte production but not inspection, reconciliation, explicit removal, or no-byte operations.

### Counted Population

An Artifact remains counted until terminal removal proves all of these:

1. Current accepted Artifact state is `ARTIFACT_REMOVED`.
2. The exact removal Effect is current accepted `EFFECT_COMPLETED_AS_DECLARED`.
3. A complete store-usage observation covers that removal and resulting allocation.

- Available, unavailable, missing, corrupt, stale, broken, and removal-started Artifacts remain counted.
- Removed identity, provenance, sources, imports, decisions, dependencies, and diagnostics remain immutable history after leaving quota counts.
- Equal digests never merge logical Artifact identities.
- A reservation slot without an Artifact identity counts as one reserved Artifact ID. Conversion transfers that count atomically and never counts both.
- Historical removed identities remain available as a diagnostic total but never consume admission quota.

### Logical And Physical Accounting

For a counted Artifact, `artifact_logical_bytes` is its immutable expected byte length.

```text
project_logical_bytes(project) =
  sum(logical bytes for counted Project Artifacts)
  + sum(remaining logical bytes for active Project reservations)

project_artifact_ids(project) =
  count(counted Project Artifact IDs)
  + sum(remaining Artifact ID slots for active Project reservations)

installation_physical_bytes =
  latest complete Artifact-store allocated bytes
  + sum(each active installation reservation's granted physical bytes
        minus bytes explicitly covered for that reservation by the observation)

installation_artifact_ids =
  sum(latest accepted counted-Artifact reports for registered Projects)
  + sum(each active installation reservation's granted Artifact ID slots
        minus slots explicitly covered for that reservation by its Project report)
```

- Project logical bytes count each Artifact identity once, even when identities share bytes or a digest.
- Installation physical bytes count each physical allocation once. A versioned observer handles hard links, reflinks, sparse files, compression, and content addressing without path-based double counting.
- Physical use includes payload allocation and required Artifact-store metadata. It excludes databases, Run resources, Storage generations, backups, and external exports.
- Missing or non-favorable Artifact state never reduces logical accounting. Missing, incomplete, stale, or broken physical observation blocks installation admission and never becomes zero.
- Every store observation records observer/schema versions, store, volume, capacity, free and allocated bytes, completeness, observation time, and installation-reservation waterline.
- Every Project report records Project sequence, profile fingerprint, counted population, logical bytes, Artifact ID count, and installation-reservation waterline.
- Store observations and Project reports have typed reservation-coverage children keyed by exact `ArtifactCapacityReservationId`. Each child records granted, consumed, materialized, and still-reserved values covered by that observation. A later waterline alone never removes a reservation from accounting.
- A dangling installation reservation absent from a Project report or store-observation coverage set remains counted at its full current grant. Covered consumption moves into observed use while uncovered and unconsumed capacity remains reserved, so no value disappears or counts twice.

### Volume Free-Space Floor

```text
free_space_floor(volume) =
  max(2 * GiB, ceil(volume_capacity_bytes * 0.02))

projected_free_bytes(volume) =
  observed_free_bytes
  - outstanding physical reservations not reflected by the observation
  - requested physical reservation bytes
```

Admission requires `projected_free_bytes >= free_space_floor`. The reservation command obtains a fresh operating-system observation before granting capacity; no timestamp-only freshness threshold substitutes for that observation.

- Evaluate the floor independently from nominal quotas; it always wins.
- Missing, inaccessible, identity-conflicting, incomplete, or broken volume observation rejects admission.
- A floor breach never authorizes automatic deletion.

### Capacity Reservations

Every operation that may create or expand Artifact bytes holds one exact `ArtifactCapacityReservationId` before its first byte-producing boundary. It fixes Project, installation, store, volume, owner command and producer, retention purpose, profile identity/fingerprint, accounting schema, maximum logical and physical bytes, maximum Artifact IDs, and admission waterlines.

Use this order:

1. The Application coordinator creates the installation reservation in `application.db` after checking physical bytes, Artifact ID count, and volume floor.
2. The Project writer creates the matching Project reservation in `slopstop.db` after checking logical bytes and Project Artifact IDs.
3. No producer crosses a byte boundary until both records and their owner, profile, store, volume, maxima, identity, and fingerprint agree.
4. Project rejection leaves installation capacity conservatively active until explicit cancellation proves no matching Project reservation and no byte boundary.
5. Produced bytes and identities consume reserved capacity without an accounting gap.
6. Unused capacity releases only after terminal owner settlement or accepted reconciliation proves the final Artifact set and allocation.
7. Installation settlement requires a Project report and complete physical observation covering the consumption waterline.

- Time, process exit, cancellation request, restart, or missing callback never releases a reservation.
- A crash between grants over-counts rather than under-counts.
- Expansion uses the same conservative order as initial admission. The Application command first appends an installation expansion grant; the Project command then appends the matching Project expansion grant. Effective producer capacity is the intersection of the two current matching grants, so added bytes or IDs remain unusable until both exist. Failure between grants leaves the larger installation grant counted but unusable until the Project grant arrives or reconciliation cancels the unused difference.
- Each expansion is atomic only inside its owning database; no cross-database atomicity is claimed. Denial stops further output at the next controlled pre-write boundary.
- A producer within every granted dimension may finish. Exceeding a bound is an explicit overrun and recovery condition.
- Exact duplicate commands return original records; conflicting identity reuse is `IDEMPOTENCY_CONFLICT`.

### Attention And Hard Admission

- Attention is active when current or projected use is greater than or equal to its Attention threshold.
- Reject a reservation when projected use would exceed its hard threshold. At or above hard capacity, reject every positive new reservation or expansion in that scope.
- Attention creates diagnostics and may create eligible proposals. Hard blocking preserves all current bytes and does not cancel an already granted reservation within its bounds.
- No Attention, hard limit, floor, or overrun deletes bytes automatically.

### Retention Purpose

Every Artifact has one immutable purpose distinct from provenance:

| Purpose | Meaning | System age eligibility | System proposal |
| --- | --- | --- | --- |
| `generated-output` | Regenerable or replaceable output whose authoritative inputs and provenance remain available | After 30 hold-free days | At 90 days or quota Attention |
| `durable-record` | Durable proof, manifest, accepted record, or irreplaceable local Evidence | None | None |
| `imported-source` | Local imported, historical, or research source copy | None without explicit Project policy | None without explicit Project policy |

- Purpose is fixed by a versioned producer-to-purpose matrix, not inferred from media type, digest, path, producer name, or UI location. A producer cannot classify its own result opportunistically.
- Profile `0.1.0-local-balanced` contains this exact matrix:

| ADR 0010 provenance arm | Required purpose |
| --- | --- |
| `evidence-produced` | `durable-record` |
| `language-produced/operation-chunk` | `generated-output` |
| `language-produced/terminal-observation` | `durable-record` |
| `language-produced/mutation-callback` | `durable-record` |
| `language-produced/mutation-result` | `generated-output` |
| `imported-source/imported` | `imported-source` |
| `imported-source/historical` | `imported-source` |
| `imported-source/research` | `imported-source` |

- Application policy owns and fingerprints the matrix as part of the profile. Producers supply only their already-typed ADR 0010 provenance arm; the Project writer derives purpose and rejects a supplied mismatch.
- Unknown, missing, unsupported, or origin-incompatible purpose is protected and diagnosed as broken.
- Pressure never silently overrides durable-record or imported-source protection. A user-requested proposal may target a valid protected purpose, but never bypasses a byte hold or broken authority.

### Byte-Requiring Holds And Age

Use the hold kinds `current-evidence-consumer`, `accepted-rerun`, `active-producer`, `unresolved-effect`, `export`, `integration`, `salvage`, and `user-retain`.

- Every hold has opaque identity, exact Artifact, owner identity/version, creation command, and exactly one typed owner child.
- Owner admission and hold creation are one Project Writer transaction whenever the owner lives in `slopstop.db`: current Evidence byte consumption creates `current-evidence-consumer`; an accepted rerun creates `accepted-rerun`; Artifact registration creates `active-producer`; a non-removal Effect that consumes the Artifact bytes creates `unresolved-effect`; Integration admission creates `integration`; and salvage admission creates `salvage`. Current-authority replacement or terminal owner settlement appends the matching release in that owner's transaction.
- An `artifact-removal` Effect never creates an `unresolved-effect` hold on its own target Artifact. Its declaration is admitted only after the exact zero-hold recheck; the later accepted `ARTIFACT_REMOVAL_STARTED` state blocks byte consumers directly until terminal reconciliation. Creating a self-hold would make approved removal impossible and is rejected as a contract violation.
- Export and other application-owned operations first create the Project-side `export` hold and prove its exact identity in the external operation request before dispatch. A terminal external observation is input to a later Project command that releases the hold; no cross-database transaction or missing callback is treated as release.
- A required owner record without its matching hold is a relational or opening-integrity failure. Proposal and removal queries also anti-join active owner records to holds and fail broken rather than assuming that a missing hold means no dependency.
- Release needs an immutable owner release or accepted reconciliation proving bytes are no longer needed. Time, process exit, navigation, inspection, preview, or read never releases or extends a hold.
- Provenance-only references are not byte holds. Any active byte hold makes removal ineligible regardless of age, pressure, profile, or user request.
- `retain` creates `user-retain`; defer and reject create no hold.
- Hold-free age starts when the Artifact first becomes current `ARTIFACT_AVAILABLE_VERIFIED` with no active holds, or when the final hold releases.
- Creating any hold discards the prior interval. Releasing one while another remains starts no interval. A later final release starts a new interval rather than resuming elapsed time.
- Use coordinator-recorded RFC 3339 UTC times. Clock anomaly may delay or surface a proposal but never authorizes removal.

For generated output, eligibility is hold-free start plus 30 days and age Attention is plus 90 days. Thirty days alone creates no system proposal.

### Sealed Proposals And Decisions

Use trigger kinds `age-attention`, `project-logical-byte-attention`, `project-artifact-count-attention`, `installation-physical-byte-attention`, `installation-artifact-count-attention`, and `user-request`.

Each proposal fixes Artifact identity, origin, purpose, expected current state version, profile/fingerprint/calibration, trigger and usage proof, hold-free times, zero-active-hold query fingerprint, current quota and reservation waterlines, expected logical gain, labelled physical estimate, command, Project sequence, and proposal fingerprint.

- The system creates age proposals only for generated output after 90 hold-free days. Quota proposals select only generated output eligible for at least 30 hold-free days.
- Automatic selection orders oldest hold-free start, then greatest logical bytes, then `ArtifactId`. One sealed analysis snapshot fixes the Attention dimensions, usage waterlines, target logical bytes, target estimated physical bytes, and target Artifact ID count needed to return below Attention. Bounded one-Artifact proposal commands stop when cumulative still-undecided proposals from that snapshot meet every target or no eligible candidate remains; proposals do not pretend to reduce current use.
- A snapshot with no positive physical-reclaim estimate creates no installation-byte proposal and keeps Attention visible for manual action. Another equivalent snapshot is prohibited until a proposal decision, Artifact state, hold, profile, usage observation, or reservation waterline changes.
- Durable records and imported sources receive no system proposal under this profile. A user request may target any valid purpose and age subject to current state, hold, and integrity checks.
- At most one undecided proposal exists for one Artifact, state version, profile fingerprint, and trigger fingerprint. A proposal grants no removal or capacity authority.

Use decision actions:

| Action | Effect |
| --- | --- |
| `approve-removal` | Authorizes only a later exact ADR 0010/0013 removal while sealed inputs remain current |
| `defer` | Suppresses the unchanged trigger until exact `defer_until`; creates no hold and does not reset age |
| `retain` | Atomically creates a `user-retain` hold |
| `reject-removal` | Closes this proposal; creates no hold or policy |

- Every action requires an explicit user command. Rejecting does not prevent a later changed trigger or user request.
- Approval starts no Effect and deletes nothing. Before Effect intent, recheck state, profile, proposal, holds, pending observations, current Evidence dependencies, reruns, producers, Effects, export, Integration, and salvage.
- Any changed input or new hold makes approval inapplicable and requires a fresh proposal and decision after the last hold releases.

### Removal And Capacity Release

Approved removal follows ADRs 0010 and 0013 unchanged: flush Effect intent and `started`; record and separately accept current `EFFECT_STARTED_UNSETTLED`; record and separately accept current `ARTIFACT_REMOVAL_STARTED`; only then delete bytes; observe verified absence; accept `ARTIFACT_REMOVED`; decide terminal Effect outcome; and publish covering Project and physical usage observations.

- Removal preserves identity, provenance, source, imports, Evidence links, decisions, state history, and diagnostics.
- Logical bytes and Artifact ID count release only after terminal removal. Physical capacity releases only from a complete store observation, never expected length or a filesystem return.
- Shared allocation remains counted while another retained object requires it. Partial, uncertain, stale, missing, or broken removal remains counted.
- Removal is allowed while admission is hard-blocked because it reconciles or reduces use and creates no Artifact payload.

### Overrun And Recovery

An overrun exists when observed use exceeds a hard threshold, production exceeds a reservation, or free space falls below the floor.

- Preserve every current byte and identity. Block new or expanded reservations only in affected Project, installation, store, or volume scopes.
- Permit inspection, measurement, reconciliation, proposal decisions, and explicit removal.
- A granted producer may continue only within every remaining bound and while the floor remains satisfied. After an excess, it stops before the next controlled write and records requested, granted, consumed, and observed values.
- Unknown, missing, stale, or broken accounting remains hard-blocking.
- Resume only when complete current observations prove all hard limits and the floor are satisfied and every reservation is current or terminally reconciled.
- Recovery never selects or deletes an Artifact automatically.

### Overrides And Recalibration

- Application policy owns installation quotas, maximum allowed Project envelope, and free-space floor. A user may accept an immutable Project profile within that envelope, including an explicit policy enabling proposals for imported sources.
- There are no Run, Worker, model, producer, or one-off bypasses. `retain` and `defer` are Artifact decisions, not policy edits.
- The coordinator may recommend; only the user accepts profiles and removals.

Keep calibration telemetry local and limited to numeric occupancy, growth, reservation, physical/logical ratio, hold, proposal, decision, removal, reclaimed-space, floor, and overrun measurements. It contains no Artifact content, source, prompt, model output, secret, environment value, credential, or raw path.

The calibration window starts at the first qualifying terminal production and spans at least 90 elapsed 24-hour periods. One qualifying production is one unique `ArtifactCapacityReservationId` whose owner reaches a conclusive terminal outcome, creates at least one new Artifact that reaches initial `ARTIFACT_AVAILABLE_VERIFIED`, settles both reservation records, and is covered by a complete Project report and physical observation. Duplicate commands, retries, several Artifacts under one reservation, zero-output attempts, removals, imports, and reconciliations add no extra production count.

The profile remains provisional until the window spans 90 days and includes at least 10,000 distinct qualifying reservation identities. Promotion then requires human confirmation that the sample covers active producer and purpose classes, p50, p95, and p99 analysis, documented platform limitations, a new immutable profile, and explicit user acceptance. Missing the gate does not block local use; it blocks stable calibration claims.

### Physical Records And Constraints

Add to `application.db`:

| Family | Tables |
| --- | --- |
| Profile authority | `artifact_retention_profiles`, `application_artifact_retention_default_decisions` |
| Usage | `artifact_store_usage_observations`, `artifact_store_usage_observation_reservations`, `artifact_store_usage_current_observations`, `installation_project_artifact_usage_reports`, `installation_project_artifact_usage_report_reservations`, `installation_project_artifact_usage_current_reports` |
| Reservations | `installation_artifact_capacity_reservations`, `installation_artifact_capacity_reservation_grants`, `installation_artifact_capacity_reservation_expansions`, `installation_artifact_capacity_reservation_consumptions`, `installation_artifact_capacity_reservation_settlements`, `installation_artifact_capacity_reservation_current` |

Add to `slopstop.db`:

| Family | Tables |
| --- | --- |
| Project authority | `project_artifact_retention_profile_decisions` |
| Purpose and usage | `artifact_retention_purposes`, `project_artifact_usage_reports` |
| Reservations | `artifact_capacity_reservations`, `artifact_capacity_reservation_grants`, `artifact_capacity_reservation_expansions`, `artifact_capacity_reservation_consumptions`, `artifact_capacity_reservation_settlements`, `artifact_capacity_reservation_current` |
| Holds | `artifact_byte_holds`, one typed owner child per hold kind, `artifact_byte_hold_releases` |
| Proposals | `artifact_retention_proposal_analyses`, `artifact_retention_proposal_analysis_targets`, `artifact_retention_requests`, `artifact_retention_decisions`, `artifact_retention_deferrals`, `artifact_retention_retain_holds` |

- Reuse ADR 0010 Artifact state and ADR 0013 Effects. Usage, quota state, hold-free age, eligibility, and overrun are direct projections, not mutable status columns.
- Cross-database records share opaque reservation/report identities, exact fingerprints, and waterlines but no foreign keys or transaction. A mismatch blocks and never chooses the lower value.
- Key profiles by opaque identity with unique name and fingerprint. Key Project decisions by receipt and Project sequence with a full selected snapshot.
- Key purpose one-to-one by Artifact. Key installation and Project reservations with the same `ArtifactCapacityReservationId`; append grants, expansions, consumption, and settlement and prohibit negative remainder or consumption beyond the effective intersection of current matching grants.
- Key observation/report reservation-coverage children by owner and reservation identity. Covered values are non-negative and no greater than the current installation grant. Admission subtracts only exact covered values, never every reservation before a timestamp waterline.
- Give each hold one matching typed owner child and at most one release. Index active holds by Artifact and kind using a release anti-join.
- Index counted state and logical bytes by Project; purpose and hold-free start by Project; active reservations by Project/store/volume/owner; usage by Project sequence and waterline; undecided proposals by Artifact, trigger, profile, and state version; decisions by proposal and action.
- Do not index Artifact content, raw paths, UI-read time, or digest as identity.

### Stable Diagnostics

Use stable codes `ARTIFACT_RETENTION_PROFILE_MISSING`, `ARTIFACT_RETENTION_PROFILE_STALE`, `ARTIFACT_RETENTION_PROFILE_BROKEN`, `ARTIFACT_RETENTION_PURPOSE_BROKEN`, `ARTIFACT_USAGE_MISSING`, `ARTIFACT_USAGE_STALE`, `ARTIFACT_USAGE_BROKEN`, `ARTIFACT_PROJECT_BYTES_ATTENTION`, `ARTIFACT_PROJECT_BYTES_HARD_LIMIT`, `ARTIFACT_PROJECT_COUNT_ATTENTION`, `ARTIFACT_PROJECT_COUNT_HARD_LIMIT`, `ARTIFACT_INSTALLATION_BYTES_ATTENTION`, `ARTIFACT_INSTALLATION_BYTES_HARD_LIMIT`, `ARTIFACT_INSTALLATION_COUNT_ATTENTION`, `ARTIFACT_INSTALLATION_COUNT_HARD_LIMIT`, `ARTIFACT_FREE_SPACE_FLOOR`, `ARTIFACT_CAPACITY_RESERVATION_REQUIRED`, `ARTIFACT_CAPACITY_RESERVATION_EXCEEDED`, `ARTIFACT_CAPACITY_RESERVATION_UNSETTLED`, `ARTIFACT_RETENTION_HOLD_ACTIVE`, `ARTIFACT_RETENTION_NOT_ELIGIBLE`, `ARTIFACT_RETENTION_PROPOSAL_STALE`, `ARTIFACT_REMOVAL_APPROVAL_REQUIRED`, and `ARTIFACT_REMOVAL_CAPACITY_UNRECONCILED`.

Missing, stale, unavailable, uncertain, rejected, malformed, or broken accounting never becomes zero use, released capacity, eligible removal, or clean admission.

### Acceptance Proofs

| Contract | Required proof |
| --- | --- |
| Accounting | Logical identity, shared physical allocation, reserved slots, and terminal removal change the correct counters exactly once. |
| Admission | No byte boundary occurs without matching grants; cross-database crashes remain conservatively reserved. |
| Expansion and floor | Production cannot exceed grants, and the floor rejects work nominal quotas would allow. |
| Exhaustion | Attention proposes only eligible output; hard limits block new production and delete nothing. |
| Purpose and holds | Protected purposes receive no system proposal; holds block removal and reset age only on final release. |
| UI reads | Inspection changes no hold or age record. |
| Proposal and decisions | Proposals seal every input; approve, defer, retain, and reject have distinct user-authorized effects. |
| Removal | No deletion precedes both ADR 0013 and ADR 0010 gates; capacity releases only from terminal proof and covering observation. |
| Recovery | Overrun preserves bytes and blocks until complete reconciliation; failures never report clean capacity. |
| Recalibration | The profile remains provisional before both measurement gates. |

### Issue 77 Closure

| Requirement | Decision |
| --- | --- |
| Thresholds | Immutable low-confidence profile covers Project logical, installation physical, identity counts, and volume floor. |
| Reservations | Producers reserve before writing; crashes over-count rather than under-count. |
| Population | Non-terminally-removed Artifacts and active reservations count; removed history is diagnostic only. |
| Purpose and age | Generated output becomes eligible at 30 hold-free days; protected classes need explicit policy or user request. |
| Proposals | System proposals start at 90 days or quota Attention; approve, defer, retain, and reject remain user decisions. |
| Removal | Existing journalled Effect ordering remains mandatory and deletion is never automatic. |
| Exhaustion | Hard limits and floor block production while preserving bytes. |
| Authority | Application and Project profiles only; no Run, Worker, model, or producer override. |
| Recalibration | Ninety days and 10,000 terminal productions precede a new stable profile claim. |

## Consequences

- Storage exhaustion becomes predictable without automatic evidence loss.
- Logical Project growth remains visible despite physical sharing, while actual allocation protects installation disk capacity.
- Reservations close check-then-write races but conservative dangling reservations may temporarily block work.
- Physical measurement requires platform adapters, and the provisional profile may prove too small or too large.
- Users retain final authority over profile selection and physical removal.

## References

- `.rpiv/artifacts/research/2026-08-26_18-25-37_ticket-77-artifact-retention-threshold-basis.md`
- `docs/adr/0005-storage-lifecycle-and-recovery.md`
- `docs/adr/0006-physical-persistence-layout.md`
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md`
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md`
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md`
- [Issue #77: Set numeric Artifact-retention thresholds](https://github.com/TheMastermindPT/slopstop/issues/77)
